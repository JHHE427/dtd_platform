#!/usr/bin/env python3
from __future__ import annotations

import os
import json
import csv
import sqlite3
from collections import Counter, deque
from itertools import combinations
from pathlib import Path
from typing import Any
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
STRUCTURE_DIR = STATIC_DIR / "structures"
BRAND_ICON = STATIC_DIR / "brand-icon.svg"
DEFAULT_DB_PATH = BASE_DIR / "dtd_network_vote2_formal.sqlite"
DB_PATH = Path(os.environ.get("DTD_DB_PATH", DEFAULT_DB_PATH)).expanduser()
DEFAULT_ORIGINS = "http://127.0.0.1:8787,http://localhost:8787"
DEFAULT_SEVEN_MODEL_FILENAME = "Candidates_withNames_andDisease_TXGNN.csv"
DEFAULT_NCRNA_SUMMARY_FILENAME = "known_ncrna_drug_summary_hs.json"
DEFAULT_NCRNA_EVIDENCE_FILENAME = "known_ncrna_drug_evidence_hs.csv"
DEFAULT_NCRNA_EDGES_FILENAME = "known_ncrna_drug_edges_hs.csv"
DEFAULT_TTD_SUMMARY_FILENAME = "ttd_summary.json"
DEFAULT_TTD_OVERLAP_FILENAME = "ttd_released_overlap.csv"
DEFAULT_RELEASED_DTI_AUDIT_FILENAME = "released_dti_audit_summary.json"
LEGACY_RELEASED_DTI_AUDIT_FILENAMES = ("vote_ge_2_release_summary.json",)
DEFAULT_RELEASED_DTI_TTD_FILENAME = "released_dti_ttd_summary.json"
LEGACY_RELEASED_DTI_TTD_FILENAMES = ("vote_ge_2_ttd_summary.json",)
DEFAULT_RELEASED_DISEASE_SUMMARY_FILENAME = "released_disease_summary.json"
LEGACY_RELEASED_DISEASE_SUMMARY_FILENAMES = ("vote_ge_2_proxy_summary.json",)
SEVEN_MODEL_FIELDS = [
    ("graphdta_score", "GraphDTA"),
    ("dtiam_score", "DTIAM"),
    ("drugban_score", "DrugBAN"),
    ("deeppurpose_score", "DeepPurpose"),
    ("deepdtagan_score", "DeepDTAGen"),
    ("moltrans_score", "MolTrans"),
    ("conplex_score", "Conplex"),
]
REPRESENTATIVE_DRUGS = [
    ("DB01229", "Paclitaxel"),
    ("DB00619", "Imatinib"),
    ("DB01409", "Tiotropium"),
    ("DB00897", "Triazolam"),
    ("DB00623", "Fluphenazine"),
    ("DB09030", "Vorapaxar"),
    ("DB00706", "Tamsulosin"),
    ("DB01126", "Dutasteride"),
    ("DB00361", "Vinorelbine"),
]


def parse_cors_origins() -> tuple[list[str], bool]:
    raw = os.environ.get("DTD_CORS_ORIGINS", DEFAULT_ORIGINS).strip()
    origins = [x.strip() for x in raw.split(",") if x.strip()]
    if "*" in origins:
        return ["*"], False
    return origins, True


class AssetCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        if resp is None:
            return Response(status_code=404)
        path = request.url.path
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if path.startswith("/assets/") and resp.status_code == 200:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path in {"/", "/index.html"} and resp.status_code == 200:
            resp.headers["Cache-Control"] = "no-cache"
        return resp

from contextlib import asynccontextmanager
import asyncio
from concurrent.futures import ThreadPoolExecutor

def _apply_db_pragmas_once() -> None:
    """Set file-level pragmas (WAL) on startup via a writable connection."""
    if not DB_PATH.exists():
        return
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.commit()
        finally:
            conn.close()
    except sqlite3.OperationalError:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    _apply_db_pragmas_once()
    # Asynchronously preload static massive CSV files on boot
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=4) as executor:
        f1 = loop.run_in_executor(executor, load_seven_model_lookup)
        f2 = loop.run_in_executor(executor, load_ncrna_drug_summary)
        f3 = loop.run_in_executor(executor, load_ttd_summary)
        f4 = loop.run_in_executor(executor, load_released_dti_audit)
        f5 = loop.run_in_executor(executor, load_released_disease_summary)
        f6 = loop.run_in_executor(executor, load_ttd_overlap_rows)
        f7 = loop.run_in_executor(executor, load_ncrna_drug_evidence_rows)
        f8 = loop.run_in_executor(executor, load_ncrna_drug_edge_rows)
        f9 = loop.run_in_executor(executor, load_ncrna_id_lookup)
        await asyncio.gather(f1, f2, f3, f4, f5, f6, f7, f8, f9)
    yield

app = FastAPI(title="Disease Network Atlas", version="1.0.0", lifespan=lifespan)
origins, allow_credentials = parse_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1200)
app.add_middleware(AssetCacheMiddleware)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.exception_handler(sqlite3.OperationalError)
def sqlite_operational_error_handler(_, exc: sqlite3.OperationalError):
    return JSONResponse(status_code=500, content={"detail": "Database operation failed", "error": str(exc)})


def get_conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Database not found: {DB_PATH}")
    # Read-only URI avoids accidental writes and allows safer concurrent access.
    uri = f"file:{DB_PATH}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Per-connection pragmas tuned for read-heavy analytics workload.
    conn.execute("PRAGMA cache_size=-200000")   # ~200MB page cache
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA mmap_size=268435456")  # 256MB
    return conn


def db_dep() -> Any:
    """FastAPI dependency yielding a sqlite connection bound to the request."""
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


def normalize_list(values: str | None) -> list[str]:
    if not values:
        return []
    return [v.strip() for v in values.split(",") if v.strip()]


def to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


@lru_cache(maxsize=1)
def resolve_seven_model_file() -> Path | None:
    explicit_file = os.environ.get("DTD_RESULTS_DTI_FILE")
    explicit_dir = os.environ.get("DTD_RESULTS_DTI_DIR")
    candidates = []
    if explicit_file:
        candidates.append(Path(explicit_file).expanduser())
    if explicit_dir:
        candidates.append(Path(explicit_dir).expanduser() / DEFAULT_SEVEN_MODEL_FILENAME)
    candidates.extend(
        [
            BASE_DIR / "resultsdti" / DEFAULT_SEVEN_MODEL_FILENAME,
            BASE_DIR / "data" / "resultsdti" / DEFAULT_SEVEN_MODEL_FILENAME,
            Path("/Users/jhhe/Downloads/resultsdti") / DEFAULT_SEVEN_MODEL_FILENAME,
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_seven_model_lookup() -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    seven_model_file = resolve_seven_model_file()
    if not seven_model_file:
        return lookup
    with seven_model_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            pair_id = (row.get("pair_id") or "").strip()
            if not pair_id:
                drug_id = (row.get("Drug_ID") or "").strip()
                target_id = (row.get("Target_ID") or "").strip()
                if drug_id and target_id:
                    pair_id = f"{drug_id}|{target_id}"
            if not pair_id:
                continue
            supporting = [x.strip() for x in (row.get("Supporting_Models") or "").split(";") if x.strip()]
            scores = {}
            for field, label in SEVEN_MODEL_FIELDS:
                raw = row.get(field)
                try:
                    scores[label] = float(raw) if raw not in (None, "", "NA") else None
                except ValueError:
                    scores[label] = None
            lookup[pair_id] = {
                "pair_id": pair_id,
                "supporting_models": supporting,
                "scores": scores,
                "core5_votes": row.get("Core5_Votes"),
                "optional_votes": row.get("Optional_Votes"),
                "total_votes_optional7": row.get("Total_Votes_Optional7"),
            }
    return lookup


@lru_cache(maxsize=1)
def resolve_ncrna_summary_file() -> Path | None:
    explicit_file = os.environ.get("DTD_NCRNA_SUMMARY_FILE")
    explicit_dir = os.environ.get("DTD_NCRNA_OUTPUT_DIR")
    candidates = []
    if explicit_file:
        candidates.append(Path(explicit_file).expanduser())
    if explicit_dir:
        candidates.append(Path(explicit_dir).expanduser() / DEFAULT_NCRNA_SUMMARY_FILENAME)
    candidates.extend(
        [
            BASE_DIR.parent / "ncrna_drug_output" / DEFAULT_NCRNA_SUMMARY_FILENAME,
            BASE_DIR / "ncrna_drug_output" / DEFAULT_NCRNA_SUMMARY_FILENAME,
            BASE_DIR / "data" / "ncrna_drug_output" / DEFAULT_NCRNA_SUMMARY_FILENAME,
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_ncrna_drug_summary() -> dict[str, Any]:
    summary_file = resolve_ncrna_summary_file()
    if not summary_file:
        return {}
    with summary_file.open("r", encoding="utf-8") as handle:
        summary = json.load(handle)

    type_distribution = [
        {"ncrna_type": key, "count": value}
        for key, value in sorted(
            (summary.get("ncrna_type_distribution") or {}).items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]
    relation_distribution = [
        {"relation_category": key, "count": value}
        for key, value in sorted(
            (summary.get("relation_category_distribution") or {}).items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]
    fda_distribution = [
        {"fda_label": key, "count": value}
        for key, value in sorted(
            (summary.get("fda_distribution") or {}).items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]
    overview = {
        "evidence_rows": int(summary.get("human_evidence_rows") or 0),
        "unique_edges": int(summary.get("human_unique_edges") or 0),
        "unique_ncrnas": int(summary.get("human_unique_ncrnas") or 0),
        "unique_drugs": int(summary.get("human_unique_drugs") or 0),
        "unique_drugbank_ids": int(summary.get("human_unique_drugbank_ids") or 0),
        "top_ncrna_type": type_distribution[0]["ncrna_type"] if type_distribution else None,
        "top_relation_category": relation_distribution[0]["relation_category"] if relation_distribution else None,
        "approved_rows": next((item["count"] for item in fda_distribution if item["fda_label"].lower() == "approved"), 0),
        "source_label": "ncRNADrug curated human-known evidence",
    }
    return {
        "overview": overview,
        "type_distribution": type_distribution,
        "relation_distribution": relation_distribution,
        "fda_distribution": fda_distribution,
        "top_drugs": summary.get("top_drugs") or [],
        "top_ncrnas": attach_ncrna_ids(summary.get("top_ncrnas") or []),
    }


def resolve_ncrna_output_file(filename: str) -> Path | None:
    explicit_dir = os.environ.get("DTD_NCRNA_OUTPUT_DIR")
    candidates = []
    if explicit_dir:
        candidates.append(Path(explicit_dir).expanduser() / filename)
    candidates.extend(
        [
            BASE_DIR.parent / "ncrna_drug_output" / filename,
            BASE_DIR / "ncrna_drug_output" / filename,
            BASE_DIR / "data" / "ncrna_drug_output" / filename,
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def resolve_ttd_summary_file() -> Path | None:
    explicit_file = os.environ.get("DTD_TTD_SUMMARY_FILE")
    explicit_dir = os.environ.get("DTD_TTD_OUTPUT_DIR")
    candidates = []
    if explicit_file:
        candidates.append(Path(explicit_file).expanduser())
    if explicit_dir:
        candidates.append(Path(explicit_dir).expanduser() / DEFAULT_TTD_SUMMARY_FILENAME)
    candidates.extend(
        [
            BASE_DIR.parent / "ttd_output" / DEFAULT_TTD_SUMMARY_FILENAME,
            BASE_DIR / "ttd_output" / DEFAULT_TTD_SUMMARY_FILENAME,
            BASE_DIR / "data" / "ttd_output" / DEFAULT_TTD_SUMMARY_FILENAME,
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_ttd_summary() -> dict[str, Any]:
    summary_file = resolve_ttd_summary_file()
    if not summary_file:
        return {}
    with summary_file.open("r", encoding="utf-8") as handle:
        summary = json.load(handle)

    target_type_distribution = [
        {"target_type": key, "count": value}
        for key, value in sorted(
            (summary.get("ttd_target_type_distribution") or {}).items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]
    drug_status_distribution = [
        {"status_label": key, "count": value}
        for key, value in sorted(
            (summary.get("ttd_drug_status_distribution") or {}).items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]
    moa_distribution = [
        {"moa_label": key, "count": value}
        for key, value in sorted(
            (summary.get("ttd_moa_distribution") or {}).items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]

    overview = {
        "ttd_targets": int(summary.get("ttd_targets") or 0),
        "ttd_drugs": int(summary.get("ttd_drugs") or 0),
        "ttd_crossmatched_drugs": int(summary.get("ttd_crossmatched_drugs") or 0),
        "ttd_drug_disease_rows": int(summary.get("ttd_drug_disease_rows") or 0),
        "ttd_target_disease_rows": int(summary.get("ttd_target_disease_rows") or 0),
        "ttd_drug_target_moa_rows": int(summary.get("ttd_drug_target_moa_rows") or 0),
        "released_rows": int(summary.get("released_rows") or 0),
        "ttd_supported_released_rows": int(summary.get("ttd_supported_released_rows") or 0),
        "ttd_supported_consensus_rows": int(summary.get("ttd_supported_consensus_rows") or 0),
        "ttd_supported_approved_drug_rows": int(summary.get("ttd_supported_approved_drug_rows") or 0),
        "ttd_drug_target_supported_rows": int(summary.get("ttd_drug_target_supported_rows") or 0),
        "ttd_drug_disease_supported_rows": int(summary.get("ttd_drug_disease_supported_rows") or 0),
        "ttd_target_disease_supported_rows": int(summary.get("ttd_target_disease_supported_rows") or 0),
        "ttd_triply_supported_rows": int(summary.get("ttd_triply_supported_rows") or 0),
        "top_target_type": target_type_distribution[0]["target_type"] if target_type_distribution else None,
        "top_drug_status": drug_status_distribution[0]["status_label"] if drug_status_distribution else None,
        "top_moa": moa_distribution[0]["moa_label"] if moa_distribution else None,
        "source_label": "TTD therapeutic target validation layer",
    }
    return {
        "overview": overview,
        "target_type_distribution": target_type_distribution,
        "drug_status_distribution": drug_status_distribution,
        "moa_distribution": moa_distribution,
        "top_supported_drugs": summary.get("top_supported_drugs") or [],
        "top_supported_targets": summary.get("top_supported_targets") or [],
    }


def resolve_released_dti_audit_file() -> Path | None:
    explicit_file = os.environ.get("DTD_RELEASED_DTI_AUDIT_FILE") or os.environ.get("DTD_EXPANDED_DTI_AUDIT_FILE")
    explicit_dir = os.environ.get("DTD_RELEASED_DTI_AUDIT_DIR") or os.environ.get("DTD_EXPANDED_DTI_AUDIT_DIR")
    candidates = []
    if explicit_file:
        candidates.append(Path(explicit_file).expanduser())
    if explicit_dir:
        base_dir = Path(explicit_dir).expanduser()
        candidates.append(base_dir / DEFAULT_RELEASED_DTI_AUDIT_FILENAME)
        candidates.extend(base_dir / name for name in LEGACY_RELEASED_DTI_AUDIT_FILENAMES)
    for filename in (DEFAULT_RELEASED_DTI_AUDIT_FILENAME, *LEGACY_RELEASED_DTI_AUDIT_FILENAMES):
        candidates.extend(
            [
                BASE_DIR.parent / "dti_vote_ge_2_output" / filename,
                BASE_DIR / "dti_vote_ge_2_output" / filename,
                BASE_DIR / "data" / "dti_vote_ge_2_output" / filename,
            ]
        )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_released_dti_audit() -> dict[str, Any]:
    audit_file = resolve_released_dti_audit_file()
    if not audit_file:
        return {}
    with audit_file.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {
        "release_filtered_pairs": int(data.get("release_filtered_pairs") or data.get("vote_ge_2_pairs") or 0),
        "vote_distribution": data.get("vote_distribution") or {},
        "unique_drugs": int(data.get("unique_drugs") or 0),
        "unique_targets": int(data.get("unique_targets") or 0),
        "merged_overlap_rows": int(data.get("merged_overlap_rows") or 0),
        "merged_overlap_pairs": int(data.get("merged_overlap_pairs") or 0),
        "merged_overlap_diseases": int(data.get("merged_overlap_diseases") or 0),
        "released_prediction_rows": int(data.get("released_prediction_rows") or data.get("predicted_release_ready_rows") or 0),
        "curated_overlap_rows": int(data.get("curated_overlap_rows") or data.get("known_overlap_rows") or 0),
        "reference_release_rows": int(data.get("reference_release_rows") or data.get("old_release_rows") or 0),
        "reference_release_pairs": int(data.get("reference_release_pairs") or data.get("old_release_pairs") or 0),
        "additional_released_pairs": int(data.get("additional_released_pairs") or data.get("new_pairs_not_in_merged") or 0),
        "coverage_note": (
            "The current formal release uses the broadened DTI intake together with curated drug-disease and target-disease alignment "
            "to define the released disease-linked network now used across the atlas."
        ),
    }


def resolve_released_dti_ttd_file() -> Path | None:
    explicit_file = os.environ.get("DTD_RELEASED_DTI_TTD_FILE") or os.environ.get("DTD_EXPANDED_DTI_TTD_FILE")
    explicit_dir = os.environ.get("DTD_RELEASED_DTI_TTD_DIR") or os.environ.get("DTD_EXPANDED_DTI_TTD_DIR")
    candidates = []
    if explicit_file:
        candidates.append(Path(explicit_file).expanduser())
    if explicit_dir:
        base_dir = Path(explicit_dir).expanduser()
        candidates.append(base_dir / DEFAULT_RELEASED_DTI_TTD_FILENAME)
        candidates.extend(base_dir / name for name in LEGACY_RELEASED_DTI_TTD_FILENAMES)
    for filename in (DEFAULT_RELEASED_DTI_TTD_FILENAME, *LEGACY_RELEASED_DTI_TTD_FILENAMES):
        candidates.extend(
            [
                BASE_DIR.parent / "dti_vote_ge_2_output" / filename,
                BASE_DIR / "dti_vote_ge_2_output" / filename,
                BASE_DIR / "data" / "dti_vote_ge_2_output" / filename,
            ]
        )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_released_dti_ttd_summary() -> dict[str, Any]:
    summary_file = resolve_released_dti_ttd_file()
    if not summary_file:
        return {}
    with summary_file.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {
        "release_filtered_pairs": int(data.get("release_filtered_pairs") or data.get("vote_ge_2_pairs") or 0),
        "release_filtered_unique_drugs": int(data.get("release_filtered_unique_drugs") or data.get("vote_ge_2_unique_drugs") or 0),
        "release_filtered_unique_targets": int(data.get("release_filtered_unique_targets") or data.get("vote_ge_2_unique_targets") or 0),
        "ttd_supported_pairs": int(data.get("ttd_supported_pairs") or 0),
        "ttd_supported_pair_pct": float(data.get("ttd_supported_pair_pct") or 0.0),
        "top_pair_moa": data.get("top_pair_moa"),
        "pair_moa_distribution": data.get("pair_moa_distribution") or {},
        "released_rows": int(data.get("released_rows") or data.get("release_ready_rows") or 0),
        "ttd_supported_released_rows": int(data.get("ttd_supported_released_rows") or data.get("ttd_supported_release_ready_rows") or 0),
        "ttd_drug_disease_supported_rows": int(data.get("ttd_drug_disease_supported_rows") or 0),
        "ttd_target_disease_supported_rows": int(data.get("ttd_target_disease_supported_rows") or 0),
        "ttd_drug_target_supported_rows": int(data.get("ttd_drug_target_supported_rows") or 0),
        "ttd_supported_consensus_rows": int(data.get("ttd_supported_consensus_rows") or 0),
        "top_supported_pair_drugs": data.get("top_supported_pair_drugs") or [],
        "top_supported_pair_targets": data.get("top_supported_pair_targets") or [],
        "top_supported_release_drugs": data.get("top_supported_release_drugs") or [],
        "coverage_note": (
            "TTD support is reported for the current formal release through pair-level target-drug support, disease-linked overlap, "
            "and target-centric mode-of-action annotation."
        ),
    }


def resolve_released_disease_summary_file() -> Path | None:
    explicit_file = os.environ.get("DTD_RELEASED_DISEASE_SUMMARY_FILE")
    explicit_dir = os.environ.get("DTD_RELEASED_DISEASE_SUMMARY_DIR")
    candidates = []
    if explicit_file:
        candidates.append(Path(explicit_file).expanduser())
    if explicit_dir:
        base_dir = Path(explicit_dir).expanduser()
        candidates.append(base_dir / DEFAULT_RELEASED_DISEASE_SUMMARY_FILENAME)
        candidates.extend(base_dir / name for name in LEGACY_RELEASED_DISEASE_SUMMARY_FILENAMES)
    for filename in (DEFAULT_RELEASED_DISEASE_SUMMARY_FILENAME, *LEGACY_RELEASED_DISEASE_SUMMARY_FILENAMES):
        candidates.extend(
            [
                BASE_DIR.parent / "dti_vote_ge_2_output" / filename,
                BASE_DIR / "dti_vote_ge_2_output" / filename,
                BASE_DIR / "data" / "dti_vote_ge_2_output" / filename,
            ]
        )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_released_disease_summary() -> dict[str, Any]:
    summary_file = resolve_released_disease_summary_file()
    if not summary_file:
        return {}
    with summary_file.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {
        "released_rows": int(data.get("released_rows") or data.get("proxy_rows") or 0),
        "released_pairs": int(data.get("released_pairs") or data.get("proxy_pairs") or 0),
        "released_unique_drugs": int(data.get("released_unique_drugs") or data.get("proxy_unique_drugs") or 0),
        "released_unique_targets": int(data.get("released_unique_targets") or data.get("proxy_unique_targets") or 0),
        "released_unique_diseases": int(data.get("released_unique_diseases") or data.get("proxy_unique_diseases") or 0),
        "top_vote": int(data.get("top_vote") or 0),
        "top_support_pattern": data.get("top_support_pattern"),
        "vote_distribution": data.get("vote_distribution") or {},
        "algo_distribution": data.get("algo_distribution") or {},
        "top_rows": data.get("top_rows") or [],
        "top_drugs": data.get("top_drugs") or [],
        "top_targets": data.get("top_targets") or [],
        "top_diseases": data.get("top_diseases") or [],
        "coverage_note": (
            "Released disease-linked rows are retained when the broadened DTI intake is supported by curated disease context "
            "and carried into the current formal release."
        ),
        "source_note": data.get("source_note") or "Curated disease-linked release layer",
    }


def resolve_ttd_output_file(filename: str) -> Path | None:
    explicit_dir = os.environ.get("DTD_TTD_OUTPUT_DIR")
    candidates = []
    if explicit_dir:
        candidates.append(Path(explicit_dir).expanduser() / filename)
    candidates.extend(
        [
            BASE_DIR.parent / "ttd_output" / filename,
            BASE_DIR / "ttd_output" / filename,
            BASE_DIR / "data" / "ttd_output" / filename,
        ]
    )
    for path in candidates:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def load_ttd_overlap_rows() -> list[dict[str, Any]]:
    overlap_file = resolve_ttd_output_file(DEFAULT_TTD_OVERLAP_FILENAME)
    if not overlap_file:
        return []
    with overlap_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row in reader:
            drug_id = (row.get("Drug_ID") or "").strip()
            target_id = (row.get("Target_ID") or "").strip()
            disease_label = (row.get("Ensemble_Disease_Name") or "").strip()
            if not drug_id or not target_id or not disease_label:
                continue
            def as_int(key: str) -> int:
                try:
                    return int(float(row.get(key) or 0))
                except (TypeError, ValueError):
                    return 0
            def as_float(key: str) -> float | None:
                raw = row.get(key)
                try:
                    return float(raw) if raw not in (None, "", "NA", "nan") else None
                except (TypeError, ValueError):
                    return None
            def as_bool(key: str) -> bool:
                return str(row.get(key) or "").strip().lower() in {"1", "true", "yes"}
            rows.append(
                {
                    "drug_id": drug_id,
                    "drug_label": (row.get("Drug_Name") or "").strip() or drug_id,
                    "target_id": target_id,
                    "target_label": (row.get("gene_name") or "").strip() or target_id,
                    "gene_name": (row.get("gene_name") or "").strip() or None,
                    "disease_id": f"DIS::{disease_label}",
                    "disease_label": disease_label,
                    "n_algo_pass": as_int("n_algo_pass"),
                    "Total_Votes_Optional7": as_int("Total_Votes_Optional7"),
                    "TXGNN_score": as_float("TXGNN_score"),
                    "ENR_FDR": as_float("ENR_FDR"),
                    "ttd_drug_target_supported": as_bool("ttd_drug_target_supported"),
                    "ttd_drug_disease_supported": as_bool("ttd_drug_disease_supported"),
                    "ttd_target_disease_supported": as_bool("ttd_target_disease_supported"),
                    "ttd_moa": (row.get("ttd_moa") or "").strip() or None,
                    "ttd_dd_status": (row.get("ttd_dd_status") or "").strip() or None,
                    "ttd_td_status": (row.get("ttd_td_status") or "").strip() or None,
                    "ttd_any_supported": as_bool("ttd_any_supported"),
                    "ttd_triply_supported": as_bool("ttd_triply_supported"),
                    "ttd_approved_drug": as_bool("ttd_approved_drug"),
                    "consensus_row": as_bool("consensus_row"),
                }
            )
    return rows


@lru_cache(maxsize=1)
def load_ncrna_drug_evidence_rows() -> list[dict[str, Any]]:
    evidence_file = resolve_ncrna_output_file(DEFAULT_NCRNA_EVIDENCE_FILENAME)
    if not evidence_file:
        return []
    with evidence_file.open("r", encoding="utf-8", newline="") as handle:
        return attach_ncrna_ids(list(csv.DictReader(handle)))


@lru_cache(maxsize=1)
def load_ncrna_drug_edge_rows() -> list[dict[str, Any]]:
    edge_file = resolve_ncrna_output_file(DEFAULT_NCRNA_EDGES_FILENAME)
    if not edge_file:
        return []
    with edge_file.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


@lru_cache(maxsize=1)
def load_ncrna_id_lookup() -> dict[tuple[str, str], str]:
    candidates: dict[tuple[str, str], set[str]] = {}
    for row in load_ncrna_drug_edge_rows():
        name = str(row.get("ncRNA_Name") or "").strip()
        ncrna_type = str(row.get("ncRNA_Type") or "").strip()
        ncrna_id = str(row.get("ncrna_id") or "").strip()
        if not (name and ncrna_type and ncrna_id):
            continue
        candidates.setdefault((name, ncrna_type), set()).add(ncrna_id)

    resolved: dict[tuple[str, str], str] = {}
    for key, values in candidates.items():
        if len(values) == 1:
            resolved[key] = next(iter(values))
    return resolved


def attach_ncrna_ids(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lookup = load_ncrna_id_lookup()
    enriched: list[dict[str, Any]] = []
    for item in items:
        name = str(item.get("ncRNA_Name") or "").strip()
        ncrna_type = str(item.get("ncRNA_Type") or "").strip()
        ncrna_id = str(item.get("ncrna_id") or "").strip() or lookup.get((name, ncrna_type), "")
        enriched.append({**item, "ncrna_id": ncrna_id or None})
    return enriched


def paginate_list(items: list[dict[str, Any]], page: int, page_size: int) -> dict[str, Any]:
    total = len(items)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items[start:end],
    }


def infer_ncrna_type_from_id(node_id: str) -> str:
    upper = str(node_id or "").upper()
    if upper.startswith("MIRNA::"):
        return "miRNA"
    if upper.startswith("LNCRNA::"):
        return "lncRNA"
    if upper.startswith("CIRCRNA::"):
        return "circRNA"
    return "ncRNA"


def build_ncrna_evidence(node: dict[str, Any]) -> dict[str, Any]:
    node_id = node.get("id", "")
    node_type = node.get("node_type", "")
    if node_type not in {"Drug", "ncRNA"}:
        return {"available": False, "row_count": 0, "top_rows": []}

    rows = load_ncrna_drug_edge_rows()
    if not rows:
        return {"available": False, "row_count": 0, "top_rows": []}

    matched: list[dict[str, Any]] = []
    for row in rows:
        if node_type == "Drug":
            drug_ids = {str(row.get("drug_id_final") or "").strip(), str(row.get("DrugBank_ID") or "").strip(), str(row.get("drug_id_or_name") or "").strip()}
            if node_id in drug_ids:
                matched.append(row)
        elif str(row.get("ncrna_id") or "").strip() == node_id:
            matched.append(row)

    if not matched:
        return {"available": False, "row_count": 0, "top_rows": []}

    matched.sort(
        key=lambda row: (
            -int(row.get("evidence_rows") or 0),
            str(row.get("ncRNA_Name") or ""),
            str(row.get("Drug_Name") or ""),
        )
    )

    relation_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()
    fda_counter: Counter[str] = Counter()
    counterpart_ids: set[str] = set()
    for row in matched:
        for item in str(row.get("relation_categories") or "").split(";"):
            value = item.strip()
            if value:
                relation_counter[value] += 1
        ncrna_type = str(row.get("ncRNA_Type") or "").strip()
        if ncrna_type:
            type_counter[ncrna_type] += 1
        fda_label = str(row.get("fda_status") or "").strip()
        if fda_label:
            fda_counter[fda_label] += 1
        counterpart_ids.add(
            str(
                row.get("ncrna_id") if node_type == "Drug" else row.get("drug_id_final") or row.get("DrugBank_ID") or row.get("Drug_Name")
            ).strip()
        )

    top_rows: list[dict[str, Any]] = []
    for row in matched[:8]:
        if node_type == "Drug":
            counterpart_label = row.get("ncRNA_Name") or row.get("ncrna_id")
            counterpart_id = row.get("ncrna_id")
            counterpart_type = row.get("ncRNA_Type") or infer_ncrna_type_from_id(counterpart_id)
        else:
            counterpart_label = row.get("Drug_Name") or row.get("drug_id_final") or row.get("DrugBank_ID")
            counterpart_id = row.get("drug_id_final") or row.get("DrugBank_ID")
            counterpart_type = "Drug"
        top_rows.append(
            {
                "counterpart_label": counterpart_label,
                "counterpart_id": counterpart_id,
                "counterpart_type": counterpart_type,
                "evidence_rows": int(row.get("evidence_rows") or 0),
                "unique_pmids": int(row.get("unique_pmids") or 0),
                "relation_categories": row.get("relation_categories") or "-",
                "phenotypes": row.get("phenotypes") or "-",
                "conditions": row.get("conditions") or "-",
                "fda_status": row.get("fda_status") or "NA",
                "target_genes": row.get("target_genes") or "-",
                "pathways": row.get("pathways") or "-",
                "min_year": row.get("min_year") or "-",
                "max_year": row.get("max_year") or "-",
            }
        )

    return {
        "available": True,
        "focus_type": node_type,
        "counterpart_type": "ncRNA" if node_type == "Drug" else "Drug",
        "row_count": len(matched),
        "unique_counterparts": len([value for value in counterpart_ids if value]),
        "top_ncrna_type": type_counter.most_common(1)[0][0] if type_counter else (infer_ncrna_type_from_id(node_id) if node_type == "ncRNA" else None),
        "top_relation_category": relation_counter.most_common(1)[0][0] if relation_counter else None,
        "top_fda_label": fda_counter.most_common(1)[0][0] if fda_counter else None,
        "top_rows": top_rows,
    }


def build_ncrna_linked_released_results(conn: sqlite3.Connection, node: dict[str, Any]) -> dict[str, Any]:
    node_id = node.get("id", "")
    node_type = node.get("node_type", "")
    if node_type not in {"Drug", "ncRNA"}:
        return {"available": False, "row_count": 0, "top_rows": []}

    edge_rows = load_ncrna_drug_edge_rows()
    if not edge_rows:
        return {"available": False, "row_count": 0, "top_rows": []}

    if node_type == "Drug":
        linked_drug_ids = {node_id}
    else:
        linked_drug_ids = {
            str(row.get("drug_id_final") or row.get("DrugBank_ID") or "").strip()
            for row in edge_rows
            if str(row.get("ncrna_id") or "").strip() == node_id
        }
    linked_drug_ids = {value for value in linked_drug_ids if value}
    if not linked_drug_ids:
        return {"available": False, "row_count": 0, "top_rows": []}

    placeholders = ",".join(["?"] * len(linked_drug_ids))
    prediction_rows = to_dicts(
        conn.execute(
            f"""
            SELECT
                h.Drug_ID AS drug_id,
                COALESCE(nd.display_name, nd.label, h.Drug_Name, h.Drug_ID) AS drug_label,
                h.Target_ID AS target_id,
                COALESCE(nt.display_name, nt.label, h.target_name, h.Target_ID) AS target_label,
                ('DIS::' || h.Ensemble_Disease_Name) AS disease_id,
                COALESCE(nx.display_name, nx.label, h.Ensemble_Disease_Name) AS disease_label,
                COALESCE(h.gene_name, '-') AS gene_name,
                CAST(COALESCE(h.n_algo_pass, 0) AS INTEGER) AS n_algo_pass,
                CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER) AS seven_model_votes,
                CAST(COALESCE(h.TXGNN_score, -1) AS REAL) AS txgnn_score,
                CAST(COALESCE(h.ENR_FDR, 999999) AS REAL) AS enr_fdr,
                CASE
                    WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                         AND COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true')
                         AND COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR + RWR'
                    WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                         AND COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR'
                    WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                         AND COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + RWR'
                    WHEN COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true')
                         AND COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR + RWR'
                    WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN only'
                    WHEN COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR only'
                    WHEN COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'RWR only'
                    ELSE 'No method passed'
                END AS support_pattern
            FROM src_highconfidence_expand_vote4_top50_tx07 h
            LEFT JOIN network_nodes nd ON nd.id = h.Drug_ID
            LEFT JOIN network_nodes nt ON nt.id = h.Target_ID
            LEFT JOIN network_nodes nx ON nx.id = ('DIS::' || h.Ensemble_Disease_Name)
            WHERE h.Drug_ID IN ({placeholders})
            """,
            list(linked_drug_ids),
        ).fetchall()
    )
    if not prediction_rows:
        return {"available": False, "row_count": 0, "top_rows": []}

    edge_rows_by_drug: dict[str, list[dict[str, Any]]] = {}
    for row in edge_rows:
        drug_id = str(row.get("drug_id_final") or row.get("DrugBank_ID") or "").strip()
        if drug_id in linked_drug_ids:
            edge_rows_by_drug.setdefault(drug_id, []).append(row)

    top_rows = []
    for row in sorted(
        prediction_rows,
        key=lambda item: (
            -int(item.get("n_algo_pass") or 0),
            -int(item.get("seven_model_votes") or 0),
            -float(item.get("txgnn_score") or -1),
            float(item.get("enr_fdr") or 999999),
            str(item.get("drug_label") or ""),
            str(item.get("disease_label") or ""),
        ),
    )[:8]:
        linked_edges = edge_rows_by_drug.get(str(row.get("drug_id") or ""), [])
        linked_ncrna_names = sorted({str(item.get("ncRNA_Name") or "").strip() for item in linked_edges if str(item.get("ncRNA_Name") or "").strip()})
        top_rows.append(
            {
                **row,
                "linked_ncrna_count": len({str(item.get("ncrna_id") or "").strip() for item in linked_edges if str(item.get("ncrna_id") or "").strip()}),
                "top_ncrna_name": linked_ncrna_names[0] if linked_ncrna_names else None,
                "top_ncrna_id": next(
                    (
                        str(item.get("ncrna_id") or "").strip()
                        for item in sorted(
                            linked_edges,
                            key=lambda edge: (
                                str(edge.get("ncRNA_Name") or ""),
                                str(edge.get("ncrna_id") or ""),
                            ),
                        )
                        if str(item.get("ncrna_id") or "").strip()
                    ),
                    None,
                ),
                "top_relation_category": max(
                    (
                        rel
                        for rel in Counter(
                            item.strip()
                            for edge in linked_edges
                            for item in str(edge.get("relation_categories") or "").split(";")
                            if item.strip()
                        ).items()
                    ),
                    key=lambda item: (item[1], item[0]),
                    default=(None, 0),
                )[0],
            }
        )

    consensus_count = sum(1 for row in prediction_rows if int(row.get("n_algo_pass") or 0) == 3 and int(row.get("seven_model_votes") or 0) >= 4)
    approved_count = 0
    fda_labels = Counter()
    relation_counter = Counter()
    linked_ncrna_ids: set[str] = set()
    for drug_id in linked_drug_ids:
        for edge in edge_rows_by_drug.get(drug_id, []):
            if str(edge.get("fda_status") or "").strip().lower() == "approved":
                approved_count += 1
            label = str(edge.get("fda_status") or "").strip()
            if label:
                fda_labels[label] += 1
            for item in str(edge.get("relation_categories") or "").split(";"):
                value = item.strip()
                if value:
                    relation_counter[value] += 1
            linked_ncrna_id = str(edge.get("ncrna_id") or "").strip()
            if linked_ncrna_id:
                linked_ncrna_ids.add(linked_ncrna_id)

    return {
        "available": True,
        "focus_type": node_type,
        "row_count": len(prediction_rows),
        "linked_drug_count": len(linked_drug_ids),
        "linked_ncrna_count": len(linked_ncrna_ids),
        "consensus_row_count": consensus_count,
        "approved_link_count": approved_count,
        "top_relation_category": relation_counter.most_common(1)[0][0] if relation_counter else None,
        "top_fda_label": fda_labels.most_common(1)[0][0] if fda_labels else None,
        "top_rows": top_rows,
    }


def enrich_with_seven_models(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lookup = load_seven_model_lookup()
    enriched: list[dict[str, Any]] = []
    for item in items:
        pair_id = item.get("pair_id") or f'{item.get("Drug_ID", "")}|{item.get("Target_ID", "")}'
        model_info = lookup.get(pair_id, {})
        enriched.append(
            {
                **item,
                "pair_id": pair_id,
                "seven_model_supporting_models": model_info.get("supporting_models", []),
                "seven_model_scores": model_info.get("scores", {}),
                "seven_model_core5_votes": model_info.get("core5_votes"),
                "seven_model_optional_votes": model_info.get("optional_votes"),
                "seven_model_total_votes": model_info.get("total_votes_optional7") or item.get("Total_Votes_Optional7"),
            }
        )
    return enriched


def build_support_pattern_label(row: sqlite3.Row | dict[str, Any]) -> str:
    def is_on(value: Any) -> bool:
        return str(value) in {"1", "True", "true"}

    tx = is_on(row.get("TXGNN_pass") if isinstance(row, dict) else row["TXGNN_pass"])
    enr = is_on(row.get("ENR_pass") if isinstance(row, dict) else row["ENR_pass"])
    rwr = is_on(row.get("RWR_pass") if isinstance(row, dict) else row["RWR_pass"])
    active = [label for label, ok in (("TXGNN", tx), ("ENR", enr), ("RWR", rwr)) if ok]
    return " + ".join(active) if active else "No method passed"


def build_online_analysis_where(
    focus: str,
    focus_type: str,
    min_algo_pass: int,
    min_votes: int,
    ncrna_type: str | None,
    txgnn_pass: str | None,
    enr_pass: str | None,
    rwr_pass: str | None,
) -> tuple[str, list[Any]]:
    where = ["CAST(COALESCE(h.n_algo_pass, 0) AS INTEGER) >= ?", "CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER) >= ?"]
    params: list[Any] = [min_algo_pass, min_votes]

    if focus_type == "Drug":
        where.append("h.Drug_ID = ?")
        params.append(focus)
    elif focus_type == "Target":
        where.append("h.Target_ID = ?")
        params.append(focus)
    elif focus_type == "Disease":
        disease_label = focus.removeprefix("DIS::")
        where.append("h.Ensemble_Disease_Name = ?")
        params.append(disease_label)
    elif focus_type == "ncRNA":
        linked_drug_ids = sorted({
            str(row.get("drug_id_final") or row.get("DrugBank_ID") or "").strip()
            for row in load_ncrna_drug_edge_rows()
            if str(row.get("ncrna_id") or "").strip() == focus
            and (not ncrna_type or str(row.get("ncRNA_Type") or "").strip() == ncrna_type)
            and str(row.get("drug_id_final") or row.get("DrugBank_ID") or "").strip()
        })
        if not linked_drug_ids:
            where.append("1 = 0")
        else:
            placeholders = ",".join(["?"] * len(linked_drug_ids))
            where.append(f"h.Drug_ID IN ({placeholders})")
            params.extend(linked_drug_ids)
    else:
        raise HTTPException(status_code=422, detail=f"Online analysis is not available for node type: {focus_type}")

    if txgnn_pass:
        where.append("CAST(h.TXGNN_pass AS TEXT) = ?")
        params.append(txgnn_pass)
    if enr_pass:
        where.append("CAST(h.ENR_pass AS TEXT) = ?")
        params.append(enr_pass)
    if rwr_pass:
        where.append("CAST(h.RWR_pass AS TEXT) = ?")
        params.append(rwr_pass)

    return " AND ".join(where), params


def get_node_annotation(conn: sqlite3.Connection, node_id: str, node_type: str) -> dict[str, Any]:
    try:
        row = conn.execute(
            """
            SELECT
                node_id, node_type, smiles, molecular_formula, target_sequence, uniprot_accession, annotation_source, updated_at,
                text_description, side_effect_summary, ontology_terms, synonyms_json,
                target_summary, disease_summary, drug_summary, ncrna_summary, ttd_summary, modality_sources_json
            FROM node_annotations
            WHERE node_id = ?
            """,
            [node_id],
        ).fetchone()
    except sqlite3.OperationalError:
        try:
            row = conn.execute(
                """
                SELECT node_id, node_type, smiles, molecular_formula, target_sequence, uniprot_accession, annotation_source, updated_at
                FROM node_annotations
                WHERE node_id = ?
                """,
                [node_id],
            ).fetchone()
        except sqlite3.OperationalError:
            row = None

    ann = {
        "node_id": node_id,
        "node_type": node_type,
        "smiles": None,
        "molecular_formula": None,
        "structure_image_url": None,
        "target_sequence": None,
        "uniprot_accession": None,
        "annotation_source": None,
        "text_description": None,
        "side_effect_summary": None,
        "ontology_terms": None,
        "synonyms_json": None,
        "target_summary": None,
        "disease_summary": None,
        "drug_summary": None,
        "ncrna_summary": None,
        "ttd_summary": None,
        "modality_sources_json": None,
    }
    if row:
        ann.update(dict(row))

    if node_type == "Target" and not ann.get("uniprot_accession"):
        try:
            x = conn.execute(
                """
                SELECT MAX(UniProt_ID) AS UniProt_ID
                FROM src_known_dti_drugbank_be
                WHERE Target_ID = ?
                """,
                [node_id],
            ).fetchone()
            if x and x["UniProt_ID"]:
                ann["uniprot_accession"] = x["UniProt_ID"]
                ann["annotation_source"] = ann["annotation_source"] or "src_known_dti_drugbank_be"
        except sqlite3.OperationalError:
            pass
    if node_type == "Drug":
        p = STRUCTURE_DIR / f"{node_id}.png"
        s = STRUCTURE_DIR / f"{node_id}.svg"
        if p.exists():
            ann["structure_image_url"] = f"/static/structures/{node_id}.png"
        elif s.exists():
            ann["structure_image_url"] = f"/static/structures/{node_id}.svg"
    if node_type == "Disease":
        try:
            alias_rows = conn.execute(
                """
                SELECT alias
                FROM disease_aliases
                WHERE disease_id = ?
                ORDER BY LENGTH(alias), alias
                """,
                [node_id],
            ).fetchall()
        except sqlite3.OperationalError:
            alias_rows = []
        alias_values = [str(row["alias"]).strip() for row in alias_rows if str(row["alias"]).strip()]
        if alias_values:
            existing: list[str] = []
            if ann.get("synonyms_json"):
                try:
                    parsed = json.loads(ann["synonyms_json"])
                    if isinstance(parsed, list):
                        existing = [str(x).strip() for x in parsed if str(x).strip()]
                except json.JSONDecodeError:
                    existing = []
            merged = []
            seen = set()
            for value in [*existing, *alias_values]:
                key = value.casefold()
                if key in seen:
                    continue
                seen.add(key)
                merged.append(value)
            ann["synonyms_json"] = json.dumps(merged[:30], ensure_ascii=False)
    if node_type == "ncRNA":
        ann["annotation_source"] = ann["annotation_source"] or "ncRNADrug curated human-known evidence"
        ann["ontology_terms"] = ann["ontology_terms"] or infer_ncrna_type_from_id(node_id)
    return ann


def build_multimodal_profile(
    node: dict[str, Any], annotation: dict[str, Any], edge_stats: list[dict[str, Any]]
) -> dict[str, Any]:
    counts_by_category: dict[str, int] = {}
    counts_by_type: dict[str, int] = {}
    for item in edge_stats:
        counts_by_category[item["edge_category"]] = counts_by_category.get(item["edge_category"], 0) + int(item["count"] or 0)
        counts_by_type[item["edge_type"]] = counts_by_type.get(item["edge_type"], 0) + int(item["count"] or 0)

    node_type = node["node_type"]
    modalities: list[dict[str, Any]] = []
    if node_type == "Drug":
        modalities = [
            {
                "key": "smiles",
                "label": "SMILES",
                "available": bool(annotation.get("smiles")),
                "detail": "Canonical chemical string" if annotation.get("smiles") else "Not available yet",
            },
            {
                "key": "formula",
                "label": "Formula",
                "available": bool(annotation.get("molecular_formula")),
                "detail": annotation.get("molecular_formula") or "Not available yet",
            },
            {
                "key": "structure",
                "label": "Structure",
                "available": bool(annotation.get("structure_image_url")),
                "detail": "2D structure figure" if annotation.get("structure_image_url") else "No structure image",
            },
            {
                "key": "targets",
                "label": "Target Links",
                "available": counts_by_category.get("Drug-Target", 0) > 0,
                "detail": f'{counts_by_category.get("Drug-Target", 0)} linked targets',
            },
            {
                "key": "indications",
                "label": "Disease Links",
                "available": counts_by_category.get("Drug-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("Drug-Disease", 0)} linked diseases',
            },
            {
                "key": "ncrna_links",
                "label": "ncRNA Links",
                "available": counts_by_category.get("ncRNA-Drug", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Drug", 0)} linked ncRNAs',
            },
            {
                "key": "ncrna_disease_links",
                "label": "ncRNA-Disease Context",
                "available": counts_by_category.get("ncRNA-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Disease", 0)} linked ncRNA-disease edges',
            },
            {
                "key": "predictions",
                "label": "Predicted Evidence",
                "available": counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0) > 0,
                "detail": f'{counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0)} predictive edges',
            },
            {
                "key": "description",
                "label": "Description",
                "available": bool(annotation.get("text_description")),
                "detail": "PubChem/PUG text summary" if annotation.get("text_description") else "No textual description",
            },
            {
                "key": "ontology",
                "label": "Ontology",
                "available": bool(annotation.get("ontology_terms")),
                "detail": "Drug class / ontology terms" if annotation.get("ontology_terms") else "No ontology terms",
            },
        ]
    elif node_type == "Target":
        modalities = [
            {
                "key": "uniprot",
                "label": "UniProt",
                "available": bool(annotation.get("uniprot_accession")),
                "detail": annotation.get("uniprot_accession") or "Not resolved",
            },
            {
                "key": "sequence",
                "label": "Sequence",
                "available": bool(annotation.get("target_sequence")),
                "detail": "Protein sequence available" if annotation.get("target_sequence") else "Sequence unavailable",
            },
            {
                "key": "drug_links",
                "label": "Drug Links",
                "available": counts_by_category.get("Drug-Target", 0) > 0,
                "detail": f'{counts_by_category.get("Drug-Target", 0)} linked drugs',
            },
            {
                "key": "disease_links",
                "label": "Disease Mechanism",
                "available": counts_by_category.get("Target-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("Target-Disease", 0)} linked diseases',
            },
            {
                "key": "ncrna_links",
                "label": "ncRNA Links",
                "available": counts_by_category.get("ncRNA-Target", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Target", 0)} linked ncRNAs',
            },
            {
                "key": "predictions",
                "label": "Predicted Evidence",
                "available": counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0) > 0,
                "detail": f'{counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0)} predictive edges',
            },
        ]
    elif node_type == "ncRNA":
        modalities = [
            {
                "key": "drug_links",
                "label": "Drug Links",
                "available": counts_by_category.get("ncRNA-Drug", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Drug", 0)} linked drugs',
            },
            {
                "key": "target_links",
                "label": "Target Links",
                "available": counts_by_category.get("ncRNA-Target", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Target", 0)} linked targets',
            },
            {
                "key": "disease_links",
                "label": "Disease Links",
                "available": counts_by_category.get("ncRNA-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Disease", 0)} linked diseases',
            },
            {
                "key": "known",
                "label": "Known Evidence",
                "available": counts_by_type.get("Known", 0) > 0,
                "detail": f'{counts_by_type.get("Known", 0)} curated evidence edges',
            },
            {
                "key": "ontology",
                "label": "ncRNA Class",
                "available": bool(annotation.get("ontology_terms")),
                "detail": annotation.get("ontology_terms") or "Class unavailable",
            },
            {
                "key": "description",
                "label": "Curated Layer",
                "available": True,
                "detail": "Known ncRNA-drug evidence retained as a formal release module.",
            },
        ]
    else:
        modalities = [
            {
                "key": "drug_links",
                "label": "Drug Associations",
                "available": counts_by_category.get("Drug-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("Drug-Disease", 0)} linked drugs',
            },
            {
                "key": "target_links",
                "label": "Target Mechanisms",
                "available": counts_by_category.get("Target-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("Target-Disease", 0)} linked targets',
            },
            {
                "key": "ncrna_links",
                "label": "ncRNA Context",
                "available": counts_by_category.get("ncRNA-Disease", 0) > 0,
                "detail": f'{counts_by_category.get("ncRNA-Disease", 0)} linked ncRNAs',
            },
            {
                "key": "known",
                "label": "Known Evidence",
                "available": counts_by_type.get("Known", 0) + counts_by_type.get("Known+Predicted", 0) > 0,
                "detail": f'{counts_by_type.get("Known", 0) + counts_by_type.get("Known+Predicted", 0)} supported edges',
            },
            {
                "key": "predicted",
                "label": "Predicted Evidence",
                "available": counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0) > 0,
                "detail": f'{counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0)} predictive edges',
            },
        ]

    available_count = sum(1 for item in modalities if item["available"])
    weight_map = {
        "smiles": 1.6,
        "structure": 1.4,
        "targets": 1.2,
        "indications": 1.2,
        "ncrna_links": 1.0,
        "predictions": 1.0,
        "description": 0.8,
        "ontology": 0.8,
        "uniprot": 1.4,
        "sequence": 1.6,
        "drug_links": 1.1,
        "disease_links": 1.1,
        "target_links": 1.1,
        "known": 1.0,
        "predicted": 1.0,
    }
    total_weight = sum(weight_map.get(item["key"], 1.0) for item in modalities) or 1.0
    available_weight = sum(weight_map.get(item["key"], 1.0) for item in modalities if item["available"])
    quality_score = round((available_weight / total_weight) * 100, 1)
    if quality_score >= 85:
        quality_tier = "High"
    elif quality_score >= 60:
        quality_tier = "Medium"
    else:
        quality_tier = "Low"
    missing_modalities = [item["label"] for item in modalities if not item["available"]]
    return {
        "available_modalities": available_count,
        "total_modalities": len(modalities),
        "coverage_ratio": (available_count / len(modalities)) if modalities else 0.0,
        "quality_score": quality_score,
        "quality_tier": quality_tier,
        "missing_modalities": missing_modalities,
        "modalities": modalities,
        "counts_by_category": counts_by_category,
        "counts_by_type": counts_by_type,
        "annotation_source": annotation.get("annotation_source"),
    }


def build_mechanism_snapshot(
    node: dict[str, Any], top_links: list[dict[str, Any]], source_rows: list[dict[str, Any]]
) -> dict[str, Any]:
    by_neighbor_type: dict[str, list[dict[str, Any]]] = {"Drug": [], "Target": [], "Disease": [], "ncRNA": []}
    for item in top_links:
        ntype = item.get("neighbor_type")
        if ntype in by_neighbor_type and len(by_neighbor_type[ntype]) < 3:
            by_neighbor_type[ntype].append(item)

    evidence_sources = [
        {
            "name": row["evidence_source"] or "Unknown source",
            "count": int(row["count"] or 0),
        }
        for row in source_rows
    ]

    category_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    for item in top_links:
        category_counts[item["edge_category"]] = category_counts.get(item["edge_category"], 0) + 1
        type_counts[item["edge_type"]] = type_counts.get(item["edge_type"], 0) + 1

    context_summary: list[str] = []
    if category_counts:
        dominant_category = max(category_counts.items(), key=lambda x: x[1])[0]
        context_summary.append(f"Dominant local relation type: {dominant_category}.")
    predicted_support = type_counts.get("Predicted", 0) + type_counts.get("Known+Predicted", 0)
    if predicted_support:
        context_summary.append(f"Prediction-supported links in the top mechanism view: {predicted_support}.")
    key_targets = [item["neighbor_label"] for item in by_neighbor_type.get("Target", [])][:3]
    key_diseases = [item["neighbor_label"] for item in by_neighbor_type.get("Disease", [])][:3]
    key_ncrnas = [item["neighbor_label"] for item in by_neighbor_type.get("ncRNA", [])][:3]
    if key_targets:
        context_summary.append(f"Key target context: {' | '.join(key_targets)}.")
    if key_diseases:
        context_summary.append(f"Key disease context: {' | '.join(key_diseases)}.")
    if key_ncrnas:
        context_summary.append(f"Key ncRNA context: {' | '.join(key_ncrnas)}.")

    return {
        "node_type": node["node_type"],
        "top_links": top_links[:6],
        "by_neighbor_type": by_neighbor_type,
        "evidence_sources": evidence_sources[:6],
        "category_counts": category_counts,
        "type_counts": type_counts,
        "context_summary": context_summary,
    }


def build_related_context(conn: sqlite3.Connection, node: dict[str, Any]) -> dict[str, Any]:
    node_id = node["id"]
    node_type = node["node_type"]
    if node_type not in {"Drug", "Target", "Disease"}:
        return {"available": False, "primary": [], "secondary": []}

    if node_type == "Drug":
        primary_type = "Disease"
        secondary_type = "Target"
        primary_label = "Cross-associated diseases"
        secondary_label = "Linked targets"
    elif node_type == "Target":
        primary_type = "Disease"
        secondary_type = "Drug"
        primary_label = "Cross-associated diseases"
        secondary_label = "Linked drugs"
    else:
        primary_type = "Target"
        secondary_type = "Drug"
        primary_label = "Linked targets"
        secondary_label = "Linked drugs"

    def fetch_grouped(neighbor_type: str, limit: int) -> list[dict[str, Any]]:
        rows = conn.execute(
            """
            SELECT
                n.id AS neighbor_id,
                n.label AS neighbor_label,
                n.node_type AS neighbor_type,
                COUNT(*) AS link_count,
                MAX(e.weight) AS max_weight,
                MAX(COALESCE(e.support_score, -1)) AS max_support_score,
                GROUP_CONCAT(DISTINCT e.edge_category) AS edge_categories,
                GROUP_CONCAT(DISTINCT e.edge_type) AS edge_types
            FROM network_edges e
            JOIN network_nodes n
              ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE (e.source = ? OR e.target = ?)
              AND n.node_type = ?
            GROUP BY n.id, n.label, n.node_type
            ORDER BY
              COUNT(*) DESC,
              MAX(e.weight) DESC,
              MAX(COALESCE(e.support_score, -1)) DESC,
              n.label ASC
            LIMIT ?
            """,
            [node_id, node_id, node_id, neighbor_type, limit],
        ).fetchall()
        return [
            {
                "neighbor_id": row["neighbor_id"],
                "neighbor_label": row["neighbor_label"],
                "neighbor_type": row["neighbor_type"],
                "link_count": int(row["link_count"] or 0),
                "max_weight": int(row["max_weight"] or 0),
                "max_support_score": None if row["max_support_score"] is None or float(row["max_support_score"]) < 0 else float(row["max_support_score"]),
                "edge_categories": [item for item in str(row["edge_categories"] or "").split(",") if item],
                "edge_types": [item for item in str(row["edge_types"] or "").split(",") if item],
            }
            for row in rows
        ]

    primary_rows = fetch_grouped(primary_type, 10)
    secondary_rows = fetch_grouped(secondary_type, 8)
    return {
        "available": bool(primary_rows or secondary_rows),
        "primary_label": primary_label,
        "secondary_label": secondary_label,
        "primary": primary_rows,
        "secondary": secondary_rows,
    }


def build_algorithm_evidence(conn: sqlite3.Connection, node: dict[str, Any]) -> dict[str, Any]:
    node_id = node["id"]
    node_type = node["node_type"]
    if node_type == "Drug":
        where_sql = "h.Drug_ID = ?"
        params: list[Any] = [node_id]
    elif node_type == "Target":
        where_sql = "h.Target_ID = ?"
        params = [node_id]
    elif node_type == "Disease":
        disease_name = node_id.replace("DIS::", "", 1)
        where_sql = "h.Ensemble_Disease_Name = ?"
        params = [disease_name]
    else:
        return {"available": False, "row_count": 0, "methods": [], "top_rows": []}

    summary_row = conn.execute(
        f"""
        SELECT
            COUNT(*) AS row_count,
            SUM(CASE WHEN COALESCE(h.TXGNN_pass, 0) != 0 THEN 1 ELSE 0 END) AS txgnn_count,
            SUM(CASE WHEN COALESCE(h.ENR_pass, 0) != 0 THEN 1 ELSE 0 END) AS enr_count,
            SUM(CASE WHEN COALESCE(h.RWR_pass, 0) != 0 THEN 1 ELSE 0 END) AS rwr_count,
            AVG(COALESCE(h.TXGNN_score, 0)) AS avg_txgnn_score,
            AVG(COALESCE(h.Total_Votes_Optional7, 0)) AS avg_total_votes,
            MAX(COALESCE(h.Total_Votes_Optional7, 0)) AS max_total_votes,
            MIN(h.ENR_FDR) AS best_enr_fdr,
            MAX(COALESCE(h.n_algo_pass, 0)) AS max_n_algo_pass
        FROM src_highconfidence_expand_vote4_top50_tx07 h
        WHERE {where_sql}
        """,
        params,
    ).fetchone()
    row_count = int((summary_row["row_count"] if summary_row else 0) or 0)
    if row_count <= 0:
        return {"available": False, "row_count": 0, "methods": [], "top_rows": []}

    top_rows = conn.execute(
        f"""
        SELECT
            h.pair_id,
            h.Drug_ID,
            COALESCE(nd.display_name, nd.label, h.Drug_Name) AS Drug_Label,
            h.Target_ID,
            COALESCE(nt.display_name, nt.label, h.target_name) AS Target_Label,
            ('DIS::' || h.Ensemble_Disease_Name) AS Disease_ID,
            COALESCE(nx.display_name, nx.label, h.Ensemble_Disease_Name) AS Disease_Label,
            h.gene_name,
            h.n_algo_pass,
            h.TXGNN_pass,
            h.ENR_pass,
            h.RWR_pass,
            h.TXGNN_score,
            h.ENR_FDR
        FROM src_highconfidence_expand_vote4_top50_tx07 h
        LEFT JOIN network_nodes nd ON nd.id = h.Drug_ID
        LEFT JOIN network_nodes nt ON nt.id = h.Target_ID
        LEFT JOIN network_nodes nx ON nx.id = ('DIS::' || h.Ensemble_Disease_Name)
        WHERE {where_sql}
        ORDER BY h.n_algo_pass DESC, h.TXGNN_score DESC, h.ENR_FDR ASC, h.Drug_ID, h.Target_ID
        LIMIT 3
        """,
        params,
    ).fetchall()

    methods = [
        {
            "key": "TXGNN",
            "label": "TXGNN",
            "positive_count": int((summary_row["txgnn_count"] if summary_row else 0) or 0),
            "row_count": row_count,
            "coverage_pct": round(((summary_row["txgnn_count"] or 0) / row_count) * 100, 1),
            "headline": f'avg score {round(float((summary_row["avg_txgnn_score"] or 0) or 0), 3)}',
        },
        {
            "key": "ENR",
            "label": "ENR",
            "positive_count": int((summary_row["enr_count"] if summary_row else 0) or 0),
            "row_count": row_count,
            "coverage_pct": round(((summary_row["enr_count"] or 0) / row_count) * 100, 1),
            "headline": (
                f'best FDR {round(float(summary_row["best_enr_fdr"]), 4)}'
                if summary_row and summary_row["best_enr_fdr"] is not None
                else "best FDR unavailable"
            ),
        },
        {
            "key": "RWR",
            "label": "RWR",
            "positive_count": int((summary_row["rwr_count"] if summary_row else 0) or 0),
            "row_count": row_count,
            "coverage_pct": round(((summary_row["rwr_count"] or 0) / row_count) * 100, 1),
            "headline": f'max vote tier {int((summary_row["max_n_algo_pass"] if summary_row else 0) or 0)}',
        },
        {
            "key": "Optional7",
            "label": "7-model vote",
            "positive_count": int((summary_row["max_total_votes"] if summary_row else 0) or 0),
            "row_count": row_count,
            "coverage_pct": round(((summary_row["avg_total_votes"] or 0) / 7) * 100, 1),
            "headline": (
                f'avg votes {round(float((summary_row["avg_total_votes"] or 0) or 0), 2)} / 7'
            ),
        },
    ]

    enriched_rows = enrich_with_seven_models(to_dicts(top_rows))
    pair_counts: dict[str, int] = {}
    pattern_counts: dict[str, int] = {}
    for row in enriched_rows:
        supporting_models = sorted(set(row.get("seven_model_supporting_models") or []))
        if supporting_models:
            pattern_label = " + ".join(supporting_models)
            pattern_counts[pattern_label] = pattern_counts.get(pattern_label, 0) + 1
        for left, right in combinations(supporting_models, 2):
            pair_label = f"{left} + {right}"
            pair_counts[pair_label] = pair_counts.get(pair_label, 0) + 1

    return {
        "available": True,
        "row_count": row_count,
        "max_n_algo_pass": int((summary_row["max_n_algo_pass"] if summary_row else 0) or 0),
        "avg_total_votes": round(float((summary_row["avg_total_votes"] if summary_row else 0) or 0), 2),
        "max_total_votes": int((summary_row["max_total_votes"] if summary_row else 0) or 0),
        "methods": methods,
        "top_rows": enriched_rows,
        "top_dti_pairs": [
            {"pair_label": label, "count": count}
            for label, count in sorted(pair_counts.items(), key=lambda item: (-item[1], item[0]))[:3]
        ],
        "top_dti_patterns": [
            {"pattern_label": label, "count": count}
            for label, count in sorted(pattern_counts.items(), key=lambda item: (-item[1], item[0]))[:3]
        ],
    }


def build_ttd_node_evidence(node: dict[str, Any]) -> dict[str, Any]:
    node_id = node["id"]
    node_type = node["node_type"]
    overlap_rows = load_ttd_overlap_rows()
    if not overlap_rows:
        return {
            "available": False,
            "row_count": 0,
            "consensus_row_count": 0,
            "approved_row_count": 0,
            "support_types": [],
            "top_moas": [],
            "top_rows": [],
        }

    if node_type == "Drug":
        matched_rows = [row for row in overlap_rows if row.get("drug_id") == node_id and row.get("ttd_any_supported")]
    elif node_type == "Target":
        matched_rows = [row for row in overlap_rows if row.get("target_id") == node_id and row.get("ttd_any_supported")]
    elif node_type == "Disease":
        matched_rows = [row for row in overlap_rows if row.get("disease_id") == node_id and row.get("ttd_any_supported")]
    else:
        matched_rows = []

    if not matched_rows:
        return {
            "available": False,
            "row_count": 0,
            "consensus_row_count": 0,
            "approved_row_count": 0,
            "support_types": [],
            "top_moas": [],
            "top_rows": [],
        }

    def support_label(row: dict[str, Any]) -> str:
        parts: list[str] = []
        if row.get("ttd_drug_target_supported"):
            parts.append("Drug-Target")
        if row.get("ttd_drug_disease_supported"):
            parts.append("Drug-Disease")
        if row.get("ttd_target_disease_supported"):
            parts.append("Target-Disease")
        return " + ".join(parts) if parts else "TTD-supported"

    support_counter: Counter[str] = Counter()
    moa_counter: Counter[str] = Counter()
    seen_nodal_partners: set[str] = set()
    enriched_rows: list[dict[str, Any]] = []
    for row in matched_rows:
        row_copy = dict(row)
        row_copy["ttd_support_label"] = support_label(row_copy)
        support_counter[row_copy["ttd_support_label"]] += 1
        if row_copy.get("ttd_moa"):
            moa_counter[row_copy["ttd_moa"]] += 1
        if node_type == "Drug" and row_copy.get("target_id"):
            seen_nodal_partners.add(str(row_copy["target_id"]))
        elif node_type == "Target" and row_copy.get("drug_id"):
            seen_nodal_partners.add(str(row_copy["drug_id"]))
        elif node_type == "Disease" and row_copy.get("drug_id"):
            seen_nodal_partners.add(str(row_copy["drug_id"]))
        enriched_rows.append(row_copy)

    enriched_rows.sort(
        key=lambda row: (
            -(int(row.get("n_algo_pass") or 0)),
            -(int(row.get("Total_Votes_Optional7") or 0)),
            -(float(row.get("TXGNN_score") or 0)),
            float(row.get("ENR_FDR") or 1e9),
            str(row.get("drug_label") or ""),
            str(row.get("target_label") or ""),
        )
    )
    return {
        "available": True,
        "row_count": len(enriched_rows),
        "consensus_row_count": sum(1 for row in enriched_rows if row.get("consensus_row")),
        "approved_row_count": sum(1 for row in enriched_rows if row.get("ttd_approved_drug")),
        "linked_partner_count": len(seen_nodal_partners),
        "support_types": [
            {"label": label, "count": count}
            for label, count in support_counter.most_common(4)
        ],
        "top_moas": [
            {"label": label, "count": count}
            for label, count in moa_counter.most_common(4)
        ],
        "top_rows": enriched_rows[:4],
    }


def build_drug_comparison(conn: sqlite3.Connection, left_id: str, right_id: str) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT id, label, node_type, display_name, source
        FROM network_nodes
        WHERE id IN (?, ?)
        """,
        [left_id, right_id],
    ).fetchall()
    node_map = {row["id"]: dict(row) for row in rows}
    if left_id not in node_map or right_id not in node_map:
        raise HTTPException(status_code=404, detail="One or both drug nodes were not found")
    if node_map[left_id]["node_type"] != "Drug" or node_map[right_id]["node_type"] != "Drug":
        raise HTTPException(status_code=400, detail="Drug comparison requires two Drug nodes")

    def collect_neighbors(node_id: str) -> tuple[dict[str, set[str]], dict[str, int]]:
        neighbor_rows = conn.execute(
            """
            SELECT
                CASE WHEN e.source = ? THEN e.target ELSE e.source END AS neighbor_id,
                n.label AS neighbor_label,
                n.node_type AS neighbor_type,
                e.edge_type
            FROM network_edges e
            JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE e.source = ? OR e.target = ?
            """,
            [node_id, node_id, node_id, node_id],
        ).fetchall()
        by_type: dict[str, set[str]] = {"Target": set(), "Disease": set(), "Drug": set()}
        edge_mix: dict[str, int] = {}
        for row in neighbor_rows:
            by_type.setdefault(row["neighbor_type"], set()).add(row["neighbor_id"])
            edge_mix[row["edge_type"]] = edge_mix.get(row["edge_type"], 0) + 1
        return by_type, edge_mix

    left_neighbors, left_mix = collect_neighbors(left_id)
    right_neighbors, right_mix = collect_neighbors(right_id)

    def summarize_overlap(node_type: str) -> dict[str, Any]:
        left_set = left_neighbors.get(node_type, set())
        right_set = right_neighbors.get(node_type, set())
        shared = sorted(left_set & right_set)
        union = left_set | right_set
        labels = {}
        if shared:
            placeholders = ",".join(["?"] * len(shared))
            for row in conn.execute(
                f"SELECT id, label FROM network_nodes WHERE id IN ({placeholders})",
                shared,
            ).fetchall():
                labels[row["id"]] = row["label"]
        return {
            "shared_count": len(shared),
            "left_count": len(left_set),
            "right_count": len(right_set),
            "jaccard": round((len(shared) / len(union)), 3) if union else 0.0,
            "shared_ids": shared,
            "shared_examples": [{"id": item, "label": labels.get(item, item)} for item in shared[:8]],
        }

    target_overlap = summarize_overlap("Target")
    disease_overlap = summarize_overlap("Disease")
    shared_score = round(((target_overlap["jaccard"] * 0.6) + (disease_overlap["jaccard"] * 0.4)) * 100, 1)
    if shared_score >= 50:
        interpretation = "High mechanistic overlap"
    elif shared_score >= 20:
        interpretation = "Moderate mechanistic overlap"
    else:
        interpretation = "Distinct network neighborhoods"

    return {
        "left": node_map[left_id],
        "right": node_map[right_id],
        "target_overlap": target_overlap,
        "disease_overlap": disease_overlap,
        "left_edge_mix": left_mix,
        "right_edge_mix": right_mix,
        "shared_mechanism_score": shared_score,
        "interpretation": interpretation,
    }


def build_drug_compare_subgraph(conn: sqlite3.Connection, left_id: str, right_id: str) -> dict[str, Any]:
    comparison = build_drug_comparison(conn, left_id=left_id, right_id=right_id)
    keep_ids = {left_id, right_id}
    keep_ids.update(comparison["target_overlap"]["shared_ids"])
    keep_ids.update(comparison["disease_overlap"]["shared_ids"])
    if len(keep_ids) <= 2:
        for drug_id in (left_id, right_id):
            rows = conn.execute(
                """
                SELECT
                    CASE WHEN e.source = ? THEN e.target ELSE e.source END AS neighbor_id,
                    n.node_type
                FROM network_edges e
                JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
                WHERE (e.source = ? OR e.target = ?)
                  AND n.node_type IN ('Target', 'Disease')
                ORDER BY e.weight DESC, e.support_score DESC, n.label
                LIMIT 6
                """,
                [drug_id, drug_id, drug_id, drug_id],
            ).fetchall()
            for row in rows:
                keep_ids.add(row["neighbor_id"])
    if not keep_ids:
        return {"center_id": left_id, "depth": 1, "mode": "compare", "nodes": [], "edges": []}
    placeholders = ",".join(["?"] * len(keep_ids))
    node_rows = conn.execute(
        f"""
        SELECT id, label, node_type, display_name, source
        FROM network_nodes
        WHERE id IN ({placeholders})
        ORDER BY node_type, label
        """,
        sorted(keep_ids),
    ).fetchall()
    edge_rows = conn.execute(
        f"""
        SELECT source, target, edge_category, edge_type, evidence_source,
               weight, display_color, support_score, remark
        FROM network_edges
        WHERE source IN ({placeholders}) AND target IN ({placeholders})
        ORDER BY weight DESC, support_score DESC
        LIMIT 400
        """,
        [*sorted(keep_ids), *sorted(keep_ids)],
    ).fetchall()
    return {
        "center_id": left_id,
        "depth": 1,
        "mode": "compare",
        "comparison": comparison,
        "nodes": to_dicts(node_rows),
        "edges": to_dicts(edge_rows),
    }


def has_core_source_table(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='src_highconfidence_expand_vote4_top50_tx07' LIMIT 1"
    ).fetchone()
    return row is not None


def core_mode_filter(alias: str = "e") -> str:
    return f"""
    (
        (
            {alias}.edge_category = 'Drug-Target'
            AND EXISTS (
                SELECT 1
                FROM src_highconfidence_expand_vote4_top50_tx07 hc
                WHERE hc.Drug_ID = {alias}.source
                  AND hc.Target_ID = {alias}.target
            )
        )
        OR (
            {alias}.edge_category = 'Drug-Disease'
            AND {alias}.edge_type = 'Predicted'
            AND {alias}.evidence_source = 'HighConfidence_expand_vote4_top50_TX07.csv'
        )
        OR (
            {alias}.edge_category = 'Target-Disease'
            AND {alias}.edge_type = 'Predicted'
            AND {alias}.evidence_source = 'HighConfidence_expand_vote4_top50_TX07.csv'
        )
    )
    """


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/favicon.ico")
def favicon() -> Response:
    if BRAND_ICON.exists():
        return FileResponse(BRAND_ICON, media_type="image/svg+xml")
    return Response(status_code=204)


@app.get("/apple-touch-icon.png")
def apple_touch_icon() -> Response:
    if BRAND_ICON.exists():
        return RedirectResponse(url="/static/brand-icon.svg", status_code=307)
    return Response(status_code=204)


@app.get("/apple-touch-icon-precomposed.png")
def apple_touch_icon_precomposed() -> Response:
    if BRAND_ICON.exists():
        return RedirectResponse(url="/static/brand-icon.svg", status_code=307)
    return Response(status_code=204)


@app.get("/api/health")
def health() -> dict[str, Any]:
    conn = get_conn()
    try:
        cur = conn.execute("SELECT COUNT(*) AS n FROM network_nodes")
        nodes = cur.fetchone()["n"]
        cur = conn.execute("SELECT COUNT(*) AS n FROM network_edges")
        edges = cur.fetchone()["n"]
    finally:
        conn.close()
    return {"ok": True, "nodes": nodes, "edges": edges, "db_accessible": True}


@app.get("/api/ready")
def ready() -> dict[str, Any]:
    conn = get_conn()
    try:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('network_nodes','network_edges')"
        ).fetchall()
        table_names = {r["name"] for r in tables}
        if "network_nodes" not in table_names or "network_edges" not in table_names:
            raise HTTPException(status_code=503, detail="Required tables not ready")
    finally:
        conn.close()
    return {"ok": True}


@app.get("/api/meta/stats")
def meta_stats() -> dict[str, Any]:
    conn = get_conn()
    try:
        node_by_type = to_dicts(
            conn.execute(
                "SELECT node_type, COUNT(*) AS count FROM network_nodes GROUP BY node_type ORDER BY node_type"
            ).fetchall()
        )
        edge_by_type = to_dicts(
            conn.execute(
                """
                SELECT edge_category, edge_type, COUNT(*) AS count
                FROM network_edges
                GROUP BY edge_category, edge_type
                ORDER BY edge_category, edge_type
                """
            ).fetchall()
        )
    finally:
        conn.close()
    return {"node_by_type": node_by_type, "edge_by_type": edge_by_type}


@app.get("/api/meta/research-summary")
def meta_research_summary() -> dict[str, Any]:
    conn = get_conn()
    try:
        ncrna_summary = load_ncrna_drug_summary()
        ncrna_overview = ncrna_summary.get("overview") or {}
        ttd_summary = load_ttd_summary()
        ttd_overview = ttd_summary.get("overview") or {}
        ttd_overlap_rows = load_ttd_overlap_rows()

        overview = {
            "nodes": conn.execute("SELECT COUNT(*) FROM network_nodes").fetchone()[0],
            "edges": conn.execute("SELECT COUNT(*) FROM network_edges").fetchone()[0],
            "drugs": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='Drug'").fetchone()[0],
            "targets": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='Target'").fetchone()[0],
            "diseases": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='Disease'").fetchone()[0],
            "ncrnas": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='ncRNA'").fetchone()[0],
            "disease_aliases": conn.execute("SELECT COUNT(*) FROM disease_aliases").fetchone()[0],
        }

        source_tables = [
            {
                "dataset": "Drug-Target merged layer",
                "table": "src_dti_layer_known_predicted_merged_tx07",
                "description": "Integrated known and predicted DTI layer used for formal Drug-Target edges.",
            },
            {
                "dataset": "Drug-Disease known",
                "table": "src_known_drug_disease_drugbank",
                "description": "DrugBank indication-derived Drug-Disease evidence.",
            },
            {
                "dataset": "Target-Disease loose",
                "table": "src_known_target_disease_ctd_alltargets",
                "description": "CTD-based Target-Disease evidence including exact and substring matching.",
            },
            {
                "dataset": "Formal expanded prediction set",
                "table": "src_highconfidence_expand_vote4_top50_tx07",
                "description": "Formal prediction rows after vote>=2 release plus resultsdti TXGNN disease-candidate expansion; used for predicted Drug-Disease, Target-Disease, and synchronized Drug-Target edges.",
            },
        ]
        for item in source_tables:
            table = item["table"]
            item["rows"] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        if ncrna_overview:
            source_tables.append(
                {
                    "dataset": "ncRNA-Drug known",
                    "table": "external:ncrna_drug_known_hs",
                    "description": "Curated human ncRNA-drug evidence retained as a formal known-only result layer.",
                    "rows": ncrna_overview["evidence_rows"],
                }
            )
        if ttd_overview:
            source_tables.append(
                {
                    "dataset": "TTD therapeutic-target validation",
                    "table": "external:ttd_therapeutic_target_layer",
                    "description": "Therapeutic Target Database target-drug-disease mappings used as an external validation and annotation layer.",
                    "rows": ttd_overview["ttd_drug_target_moa_rows"] + ttd_overview["ttd_drug_disease_rows"] + ttd_overview["ttd_target_disease_rows"],
                }
            )
        for derived_table, dataset, description in [
            (
                "src_expanded_dti_candidates_txgnn",
                "resultsdti TXGNN disease-candidate expansion",
                "Seven-model DTI candidates with TXGNN disease assignment; new drug-target-disease keys are promoted into the formal prediction layer with full audit status.",
            ),
            (
                "ncrna_disease_candidates",
                "ncRNA phenotype disease expansion",
                "Filtered ncRNA phenotype terms promoted into disease nodes and ncRNA-Disease evidence.",
            ),
            (
                "opentargets_target_disease_matches",
                "OpenTargets target-disease expansion",
                "High-score OpenTargets associations mapped through Ensembl-UniProt-target and ontology labels.",
            ),
        ]:
            try:
                rows = conn.execute(f"SELECT COUNT(*) FROM {derived_table}").fetchone()[0]
            except sqlite3.OperationalError:
                rows = 0
            if rows:
                source_tables.append(
                    {
                        "dataset": dataset,
                        "table": derived_table,
                        "description": description,
                        "rows": rows,
                    }
                )

        src_prediction_cols = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(src_highconfidence_expand_vote4_top50_tx07)").fetchall()
        }
        src_disease_id_expr = (
            "COALESCE(Disease_ID, 'DIS::' || Ensemble_Disease_Name)"
            if "Disease_ID" in src_prediction_cols
            else "('DIS::' || Ensemble_Disease_Name)"
        )
        src_disease_label_expr = (
            "COALESCE(Disease_Label, Ensemble_Disease_Name)"
            if "Disease_Label" in src_prediction_cols
            else "Ensemble_Disease_Name"
        )
        if "Drug_Name" in src_prediction_cols and "Drug_Label" in src_prediction_cols:
            src_drug_label_expr = "COALESCE(Drug_Name, Drug_Label, Drug_ID)"
        elif "Drug_Name" in src_prediction_cols:
            src_drug_label_expr = "COALESCE(Drug_Name, Drug_ID)"
        elif "Drug_Label" in src_prediction_cols:
            src_drug_label_expr = "COALESCE(Drug_Label, Drug_ID)"
        else:
            src_drug_label_expr = "Drug_ID"

        target_name_candidates: list[str] = []
        if "target_name" in src_prediction_cols:
            target_name_candidates.append("target_name")
        if "Target_Name" in src_prediction_cols:
            target_name_candidates.append("Target_Name")
        if "Target_Label" in src_prediction_cols:
            target_name_candidates.append("Target_Label")
        if "gene_name" in src_prediction_cols:
            target_name_candidates.append("gene_name")
        target_name_candidates.append("Target_ID")
        src_target_label_expr = f"COALESCE({', '.join(target_name_candidates)})"

        src_gene_name_expr = "COALESCE(gene_name, '-')" if "gene_name" in src_prediction_cols else "'-'"
        src_support_pattern_expr = (
            "support_pattern"
            if "support_pattern" in src_prediction_cols
            else """
            CASE
                WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                     AND COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true')
                     AND COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR + RWR'
                WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                     AND COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR'
                WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                     AND COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + RWR'
                WHEN COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true')
                     AND COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR + RWR'
                WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN only'
                WHEN COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR only'
                WHEN COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'RWR only'
                ELSE 'No method passed'
            END
            """
        )

        edge_summary = to_dicts(
            conn.execute(
                """
                SELECT edge_category, edge_type, COUNT(*) AS count
                FROM network_edges
                GROUP BY edge_category, edge_type
                ORDER BY edge_category, edge_type
                """
            ).fetchall()
        )

        pred = conn.execute(
            """
            SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT Drug_ID) AS drugs,
                COUNT(DISTINCT Target_ID) AS targets,
                COUNT(DISTINCT Ensemble_Disease_Name) AS diseases,
                COUNT(DISTINCT pair_id) AS pairs,
                SUM(CASE WHEN TXGNN_pass IN (1, '1', 'True', 'true') THEN 1 ELSE 0 END) AS txgnn_pass,
                SUM(CASE WHEN ENR_pass IN (1, '1', 'True', 'true') THEN 1 ELSE 0 END) AS enr_pass,
                SUM(CASE WHEN RWR_pass IN (1, '1', 'True', 'true') THEN 1 ELSE 0 END) AS rwr_pass
            FROM src_highconfidence_expand_vote4_top50_tx07
            """
        ).fetchone()

        algo_distribution = to_dicts(
            conn.execute(
                """
                SELECT CAST(n_algo_pass AS TEXT) AS algorithm_support, COUNT(*) AS count
                FROM src_highconfidence_expand_vote4_top50_tx07
                GROUP BY CAST(n_algo_pass AS TEXT)
                ORDER BY CAST(n_algo_pass AS INTEGER)
                """
            ).fetchall()
        )
        vote_distribution = to_dicts(
            conn.execute(
                """
                SELECT CAST(Total_Votes_Optional7 AS TEXT) AS total_votes, COUNT(*) AS count
                FROM src_highconfidence_expand_vote4_top50_tx07
                GROUP BY CAST(Total_Votes_Optional7 AS TEXT)
                ORDER BY CAST(Total_Votes_Optional7 AS INTEGER)
                """
            ).fetchall()
        )
        support_pattern_distribution = to_dicts(
            conn.execute(
                """
                SELECT
                    CASE
                        WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR + RWR'
                        WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR'
                        WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + RWR'
                        WHEN COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR + RWR'
                        WHEN COALESCE(TXGNN_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN only'
                        WHEN COALESCE(ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR only'
                        WHEN COALESCE(RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'RWR only'
                        ELSE 'No method passed'
                    END AS support_pattern_label,
                    COUNT(*) AS count
                FROM src_highconfidence_expand_vote4_top50_tx07
                GROUP BY support_pattern_label
                ORDER BY count DESC, support_pattern_label
                """
            ).fetchall()
        )

        released_prediction_rows = to_dicts(
            conn.execute(
                f"""
                WITH ranked AS (
                    SELECT
                        Drug_ID,
                        Target_ID,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                CAST(COALESCE(n_algo_pass, 0) AS INTEGER) DESC,
                                CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                                CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                                CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC,
                                Drug_ID,
                                Target_ID,
                                {src_disease_id_expr}
                        ) AS result_rank,
                        Total_Votes_Optional7
                    FROM src_highconfidence_expand_vote4_top50_tx07
                )
                SELECT Drug_ID, Target_ID, result_rank, Total_Votes_Optional7
                FROM ranked
                """
            ).fetchall()
        )
        released_prediction_rows = enrich_with_seven_models(released_prediction_rows)
        dti_model_counter: Counter[str] = Counter()
        dti_pair_counter: Counter[tuple[str, str]] = Counter()
        dti_pattern_counter: Counter[str] = Counter()
        dti_model_score_accumulator = {label: [] for _, label in SEVEN_MODEL_FIELDS}

        for row in released_prediction_rows:
            scores = row.get("seven_model_scores") or {}
            supporting = set(row.get("seven_model_supporting_models") or [])
            active_models = []
            for _, label in SEVEN_MODEL_FIELDS:
                score = scores.get(label)
                if label in supporting or score is not None:
                    active_models.append(label)
                    dti_model_counter[label] += 1
                    if score is not None:
                        dti_model_score_accumulator[label].append(float(score))
            if active_models:
                pattern_label = " + ".join(active_models)
                dti_pattern_counter[pattern_label] += 1
                for left, right in combinations(active_models, 2):
                    dti_pair_counter[(left, right)] += 1

        dti_model_consistency = {
            "model_coverage": [
                {
                    "model": label,
                    "count": dti_model_counter[label],
                    "share_pct": round((dti_model_counter[label] / pred["total_rows"]) * 100, 2) if pred["total_rows"] else 0.0,
                    "avg_score": round(sum(dti_model_score_accumulator[label]) / len(dti_model_score_accumulator[label]), 4)
                    if dti_model_score_accumulator[label]
                    else None,
                }
                for _, label in SEVEN_MODEL_FIELDS
            ],
            "top_pairs": [
                {
                    "pair_label": f"{left} + {right}",
                    "count": count,
                    "share_pct": round((count / pred["total_rows"]) * 100, 2) if pred["total_rows"] else 0.0,
                }
                for (left, right), count in dti_pair_counter.most_common(10)
            ],
            "top_patterns": [
                {
                    "pattern_label": pattern,
                    "count": count,
                    "share_pct": round((count / pred["total_rows"]) * 100, 2) if pred["total_rows"] else 0.0,
                }
                for pattern, count in dti_pattern_counter.most_common(10)
            ],
        }

        target_disease_match = to_dicts(
            conn.execute(
                """
                SELECT COALESCE(match_type, 'NA') AS match_type, COUNT(*) AS count
                FROM src_known_target_disease_ctd_alltargets
                GROUP BY COALESCE(match_type, 'NA')
                ORDER BY count DESC
                """
            ).fetchall()
        )

        disease_distribution = to_dicts(
            conn.execute(
                """
                SELECT
                    n.id AS disease_id,
                    n.label AS disease_label,
                    COUNT(*) AS edge_count
                FROM network_edges e
                JOIN network_nodes n ON n.id = e.target
                WHERE e.edge_category IN ('Drug-Disease', 'Target-Disease')
                  AND n.node_type = 'Disease'
                GROUP BY n.id, n.label
                ORDER BY edge_count DESC, n.label
                LIMIT 10
                """
            ).fetchall()
        )
        disease_total_links = conn.execute(
            """
            SELECT COUNT(*)
            FROM network_edges e
            JOIN network_nodes n ON n.id = e.target
            WHERE e.edge_category IN ('Drug-Disease', 'Target-Disease')
              AND n.node_type = 'Disease'
            """
        ).fetchone()[0]
        for item in disease_distribution:
            item["share_pct"] = round((item["edge_count"] / disease_total_links) * 100, 2) if disease_total_links else 0.0

        drug_distribution = to_dicts(
            conn.execute(
                f"""
                SELECT
                    Drug_ID AS drug_id,
                    {src_drug_label_expr} AS drug_label,
                    COUNT(*) AS row_count
                FROM src_highconfidence_expand_vote4_top50_tx07
                GROUP BY Drug_ID, drug_label
                ORDER BY row_count DESC, drug_label
                LIMIT 10
                """
            ).fetchall()
        )
        drug_total_rows = pred["total_rows"] or 0
        for item in drug_distribution:
            item["share_pct"] = round((item["row_count"] / drug_total_rows) * 100, 2) if drug_total_rows else 0.0

        target_distribution = to_dicts(
            conn.execute(
                f"""
                SELECT
                    Target_ID AS target_id,
                    {src_target_label_expr} AS target_label,
                    MAX(COALESCE(gene_name, '')) AS gene_name,
                    COUNT(*) AS row_count
                FROM src_highconfidence_expand_vote4_top50_tx07
                GROUP BY Target_ID, target_label
                ORDER BY row_count DESC, target_label
                LIMIT 10
                """
            ).fetchall()
        )
        for item in target_distribution:
            item["share_pct"] = round((item["row_count"] / drug_total_rows) * 100, 2) if drug_total_rows else 0.0

        released_disease_top_rows = to_dicts(
            conn.execute(
                f"""
                WITH ranked AS (
                    SELECT
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        Target_ID AS target_id,
                        {src_target_label_expr} AS target_label,
                        COALESCE(gene_name, '') AS gene_name,
                        {src_disease_id_expr} AS disease_id,
                        Ensemble_Disease_Name AS disease_label,
                        CAST(COALESCE(n_algo_pass, 0) AS INTEGER) AS n_algo_pass,
                        CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) AS Total_Votes_Optional7,
                        ROUND(CAST(COALESCE(TXGNN_score, 0) AS REAL), 4) AS TXGNN_score,
                        CASE
                            WHEN ENR_FDR IS NULL OR TRIM(CAST(ENR_FDR AS TEXT)) = '' THEN NULL
                            ELSE CAST(ENR_FDR AS REAL)
                        END AS ENR_FDR,
                        COALESCE(NULLIF(TRIM(support_pattern), ''), 'No algorithm support') AS support_pattern,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                CAST(COALESCE(n_algo_pass, 0) AS INTEGER) DESC,
                                CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                                CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                                CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC,
                                Drug_ID,
                                Target_ID,
                                Ensemble_Disease_Name
                        ) AS result_rank
                    FROM src_highconfidence_expand_vote4_top50_tx07
                )
                SELECT
                    result_rank,
                    drug_id,
                    drug_label,
                    target_id,
                    target_label,
                    gene_name,
                    disease_id,
                    disease_label,
                    n_algo_pass,
                    Total_Votes_Optional7,
                    TXGNN_score,
                    ENR_FDR,
                    support_pattern
                FROM ranked
                ORDER BY result_rank
                LIMIT 12
                """
            ).fetchall()
        )
        released_top_diseases = to_dicts(
            conn.execute(
                f"""
                SELECT
                    {src_disease_id_expr} AS disease_id,
                    Ensemble_Disease_Name AS disease_label,
                    COUNT(*) AS row_count
                FROM src_highconfidence_expand_vote4_top50_tx07
                GROUP BY disease_id, disease_label
                ORDER BY row_count DESC, disease_label
                LIMIT 10
                """
            ).fetchall()
        )

        representative_rows: list[dict[str, Any]] = []
        rep_ids = [item[0] for item in REPRESENTATIVE_DRUGS]
        rep_name_map = dict(REPRESENTATIVE_DRUGS)
        placeholders = ",".join(["?"] * len(rep_ids))
        rep_query = conn.execute(
            f"""
            SELECT
                Drug_ID,
                {src_drug_label_expr} AS drug_label,
                Target_ID,
                {src_target_label_expr} AS target_label,
                Ensemble_Disease_Name,
                TXGNN_score,
                ENR_FDR,
                n_algo_pass,
                Total_Votes_Optional7
            FROM src_highconfidence_expand_vote4_top50_tx07
            WHERE Drug_ID IN ({placeholders})
            ORDER BY Drug_ID, TXGNN_score DESC, ENR_FDR ASC
            """,
            rep_ids,
        ).fetchall()
        seen_rep = set()
        for row in rep_query:
            drug_id = row["Drug_ID"]
            if drug_id in seen_rep:
                continue
            representative_rows.append(
                {
                    "drug_id": drug_id,
                    "drug_label": row["drug_label"] or rep_name_map.get(drug_id, drug_id),
                    "target_id": row["Target_ID"],
                    "target_label": row["target_label"] or row["Target_ID"],
                    "disease_label": row["Ensemble_Disease_Name"],
                    "txgnn_score": row["TXGNN_score"],
                    "enr_fdr": row["ENR_FDR"],
                    "n_algo_pass": row["n_algo_pass"],
                    "seven_model_votes": row["Total_Votes_Optional7"],
                }
            )
            seen_rep.add(drug_id)
        for drug_id, label in REPRESENTATIVE_DRUGS:
            if drug_id not in seen_rep:
                representative_rows.append(
                    {
                        "drug_id": drug_id,
                        "drug_label": label,
                        "target_id": None,
                        "target_label": None,
                        "disease_label": None,
                        "txgnn_score": None,
                        "enr_fdr": None,
                        "n_algo_pass": None,
                        "seven_model_votes": None,
                    }
                )

        representative_cases = to_dicts(
            conn.execute(
                f"""
                WITH ranked AS (
                    SELECT
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        Target_ID AS target_id,
                        {src_target_label_expr} AS target_label,
                        {src_disease_id_expr} AS disease_id,
                        {src_disease_label_expr} AS disease_label,
                        {src_gene_name_expr} AS gene_name,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                CAST(COALESCE(n_algo_pass, 0) AS INTEGER) DESC,
                                CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                                CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                                CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC,
                                Drug_ID,
                                Target_ID,
                                {src_disease_id_expr}
                        ) AS result_rank,
                        n_algo_pass,
                        Total_Votes_Optional7,
                        TXGNN_score,
                        ENR_FDR,
                        {src_support_pattern_expr} AS support_pattern
                    FROM src_highconfidence_expand_vote4_top50_tx07
                )
                SELECT *
                FROM ranked
                ORDER BY result_rank ASC
                LIMIT 12
                """
            ).fetchall()
        )

        high_consensus_cases = to_dicts(
            conn.execute(
                f"""
                WITH ranked AS (
                    SELECT
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        Target_ID AS target_id,
                        {src_target_label_expr} AS target_label,
                        {src_disease_id_expr} AS disease_id,
                        {src_disease_label_expr} AS disease_label,
                        {src_gene_name_expr} AS gene_name,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                                CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                                CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC,
                                Drug_ID,
                                Target_ID,
                                {src_disease_id_expr}
                        ) AS result_rank,
                        n_algo_pass,
                        Total_Votes_Optional7,
                        TXGNN_score,
                        ENR_FDR,
                        {src_support_pattern_expr} AS support_pattern
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    WHERE CAST(COALESCE(n_algo_pass, 0) AS INTEGER) = 3
                      AND CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) >= 4
                )
                SELECT *
                FROM ranked
                ORDER BY result_rank ASC
                LIMIT 12
                """
            ).fetchall()
        )

        disease_result_rows = to_dicts(
            conn.execute(
                f"""
                WITH disease_agg AS (
                    SELECT
                        {src_disease_id_expr} AS disease_id,
                        {src_disease_label_expr} AS disease_label,
                        COUNT(*) AS row_count,
                        MAX(CAST(COALESCE(n_algo_pass, 0) AS INTEGER)) AS max_algo_pass,
                        MAX(CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER)) AS max_votes,
                        MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) AS top_txgnn_score,
                        MIN(CAST(COALESCE(ENR_FDR, 999999) AS REAL)) AS best_enr_fdr
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY disease_id, disease_label
                )
                SELECT *
                FROM disease_agg
                ORDER BY row_count DESC, disease_label
                LIMIT 15
                """
            ).fetchall()
        )

        approved_drug_deep_results = to_dicts(
            conn.execute(
                f"""
                SELECT
                    Drug_ID AS drug_id,
                    {src_drug_label_expr} AS drug_label,
                    COUNT(*) AS row_count,
                    MAX(CAST(COALESCE(n_algo_pass, 0) AS INTEGER)) AS max_algo_pass,
                    MAX(CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER)) AS max_votes,
                    MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) AS top_txgnn_score,
                    MIN(CAST(COALESCE(ENR_FDR, 999999) AS REAL)) AS best_enr_fdr
                FROM src_highconfidence_expand_vote4_top50_tx07
                WHERE Drug_ID IN ({placeholders})
                GROUP BY Drug_ID, drug_label
                ORDER BY max_algo_pass DESC, max_votes DESC, top_txgnn_score DESC, drug_label
                """
                ,
                rep_ids,
            ).fetchall()
        )

        disease_spotlights = to_dicts(
            conn.execute(
                f"""
                WITH disease_scope AS (
                    SELECT
                        {src_disease_id_expr} AS disease_id,
                        {src_disease_label_expr} AS disease_label,
                        COUNT(*) AS row_count
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY disease_id, disease_label
                    ORDER BY row_count DESC, disease_label
                    LIMIT 6
                ),
                top_drug AS (
                    SELECT
                        {src_disease_id_expr} AS disease_id,
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY {src_disease_id_expr}
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_drug_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY disease_id, drug_id, drug_label
                ),
                top_target AS (
                    SELECT
                        {src_disease_id_expr} AS disease_id,
                        {src_target_label_expr} AS target_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY {src_disease_id_expr}
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_target_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY disease_id, target_label
                ),
                disease_metrics AS (
                    SELECT
                        {src_disease_id_expr} AS disease_id,
                        MAX(CAST(COALESCE(n_algo_pass, 0) AS INTEGER)) AS max_algo_pass,
                        MAX(CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER)) AS max_votes,
                        MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) AS top_txgnn_score,
                        MIN(CAST(COALESCE(ENR_FDR, 999999) AS REAL)) AS best_enr_fdr
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY disease_id
                )
                SELECT
                    ds.disease_id,
                    ds.disease_label,
                    ds.row_count,
                    td.drug_id AS top_drug_id,
                    td.drug_label AS top_drug_label,
                    tt.target_label AS top_target_label,
                    dm.max_algo_pass,
                    dm.max_votes,
                    dm.top_txgnn_score,
                    dm.best_enr_fdr
                FROM disease_scope ds
                LEFT JOIN top_drug td ON td.disease_id = ds.disease_id AND td.rn = 1
                LEFT JOIN top_target tt ON tt.disease_id = ds.disease_id AND tt.rn = 1
                LEFT JOIN disease_metrics dm ON dm.disease_id = ds.disease_id
                ORDER BY ds.row_count DESC, ds.disease_label
                """
            ).fetchall()
        )

        drug_spotlights = to_dicts(
            conn.execute(
                f"""
                WITH drug_scope AS (
                    SELECT
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        COUNT(*) AS row_count
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY drug_id, drug_label
                    ORDER BY row_count DESC, drug_label
                    LIMIT 6
                ),
                top_disease AS (
                    SELECT
                        Drug_ID AS drug_id,
                        {src_disease_label_expr} AS disease_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY Drug_ID
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_disease_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY drug_id, disease_label
                ),
                top_target AS (
                    SELECT
                        Drug_ID AS drug_id,
                        {src_target_label_expr} AS target_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY Drug_ID
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_target_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY drug_id, target_label
                ),
                drug_metrics AS (
                    SELECT
                        Drug_ID AS drug_id,
                        MAX(CAST(COALESCE(n_algo_pass, 0) AS INTEGER)) AS max_algo_pass,
                        MAX(CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER)) AS max_votes,
                        MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) AS top_txgnn_score,
                        MIN(CAST(COALESCE(ENR_FDR, 999999) AS REAL)) AS best_enr_fdr
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY drug_id
                )
                SELECT
                    ds.drug_id,
                    ds.drug_label,
                    ds.row_count,
                    td.disease_label AS top_disease_label,
                    tt.target_label AS top_target_label,
                    COALESCE(ann.disease_summary, td.disease_label) AS disease_summary,
                    dm.max_algo_pass,
                    dm.max_votes,
                    dm.top_txgnn_score,
                    dm.best_enr_fdr
                FROM drug_scope ds
                LEFT JOIN top_disease td ON td.drug_id = ds.drug_id AND td.rn = 1
                LEFT JOIN top_target tt ON tt.drug_id = ds.drug_id AND tt.rn = 1
                LEFT JOIN drug_metrics dm ON dm.drug_id = ds.drug_id
                LEFT JOIN node_annotations ann ON ann.node_id = ds.drug_id
                ORDER BY ds.row_count DESC, ds.drug_label
                """
            ).fetchall()
        )

        target_spotlights = to_dicts(
            conn.execute(
                f"""
                WITH target_scope AS (
                    SELECT
                        Target_ID AS target_id,
                        {src_target_label_expr} AS target_label,
                        COUNT(*) AS row_count
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY target_id, target_label
                    ORDER BY row_count DESC, target_label
                    LIMIT 6
                ),
                top_disease AS (
                    SELECT
                        Target_ID AS target_id,
                        {src_disease_label_expr} AS disease_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY Target_ID
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_disease_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY target_id, disease_label
                ),
                top_drug AS (
                    SELECT
                        Target_ID AS target_id,
                        {src_drug_label_expr} AS drug_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY Target_ID
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_drug_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY target_id, drug_label
                ),
                target_metrics AS (
                    SELECT
                        Target_ID AS target_id,
                        MAX(CAST(COALESCE(n_algo_pass, 0) AS INTEGER)) AS max_algo_pass,
                        MAX(CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER)) AS max_votes,
                        MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) AS top_txgnn_score,
                        MIN(CAST(COALESCE(ENR_FDR, 999999) AS REAL)) AS best_enr_fdr
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY target_id
                )
                SELECT
                    ts.target_id,
                    ts.target_label,
                    ts.row_count,
                    td.disease_label AS top_disease_label,
                    tg.drug_label AS top_drug_label,
                    COALESCE(ann.disease_summary, td.disease_label) AS disease_summary,
                    tm.max_algo_pass,
                    tm.max_votes,
                    tm.top_txgnn_score,
                    tm.best_enr_fdr
                FROM target_scope ts
                LEFT JOIN top_disease td ON td.target_id = ts.target_id AND td.rn = 1
                LEFT JOIN top_drug tg ON tg.target_id = ts.target_id AND tg.rn = 1
                LEFT JOIN target_metrics tm ON tm.target_id = ts.target_id
                LEFT JOIN node_annotations ann ON ann.node_id = ts.target_id
                ORDER BY ts.row_count DESC, ts.target_label
                """
            ).fetchall()
        )

        top_consensus_leaderboard = to_dicts(
            conn.execute(
                f"""
                SELECT
                    Drug_ID AS drug_id,
                    {src_drug_label_expr} AS drug_label,
                    Target_ID AS target_id,
                    {src_target_label_expr} AS target_label,
                    {src_disease_id_expr} AS disease_id,
                    {src_disease_label_expr} AS disease_label,
                    CAST(COALESCE(n_algo_pass, 0) AS INTEGER) AS n_algo_pass,
                    CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) AS Total_Votes_Optional7,
                    CAST(COALESCE(TXGNN_score, -1) AS REAL) AS TXGNN_score,
                    CAST(COALESCE(ENR_FDR, 999999) AS REAL) AS ENR_FDR
                FROM src_highconfidence_expand_vote4_top50_tx07
                WHERE CAST(COALESCE(n_algo_pass, 0) AS INTEGER) >= 2
                ORDER BY
                    CAST(COALESCE(n_algo_pass, 0) AS INTEGER) DESC,
                    CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                    CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                    CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC
                LIMIT 15
                """
            ).fetchall()
        )

        top_approved_leaderboard = to_dicts(
            conn.execute(
                f"""
                SELECT
                    Drug_ID AS drug_id,
                    {src_drug_label_expr} AS drug_label,
                    Target_ID AS target_id,
                    {src_target_label_expr} AS target_label,
                    {src_disease_id_expr} AS disease_id,
                    {src_disease_label_expr} AS disease_label,
                    CAST(COALESCE(n_algo_pass, 0) AS INTEGER) AS n_algo_pass,
                    CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) AS Total_Votes_Optional7,
                    CAST(COALESCE(TXGNN_score, -1) AS REAL) AS TXGNN_score,
                    CAST(COALESCE(ENR_FDR, 999999) AS REAL) AS ENR_FDR
                FROM src_highconfidence_expand_vote4_top50_tx07
                WHERE Drug_ID IN ({placeholders})
                ORDER BY
                    CAST(COALESCE(n_algo_pass, 0) AS INTEGER) DESC,
                    CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                    CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                    CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC
                LIMIT 15
                """,
                rep_ids,
            ).fetchall()
        )

        released_dti_audit = load_released_dti_audit()
        released_dti_ttd_summary = load_released_dti_ttd_summary()
        released_disease_summary = load_released_disease_summary()
        if released_dti_audit:
            released_dti_audit["released_prediction_rows"] = int(pred["total_rows"] or 0)
        if released_disease_summary:
            released_disease_summary["additional_released_rows"] = int(released_disease_summary.get("released_rows") or 0)
            released_disease_summary["additional_released_pairs"] = int(released_disease_summary.get("released_pairs") or 0)
            released_disease_summary["released_rows"] = int(pred["total_rows"] or 0)
            released_disease_summary["released_pairs"] = int(pred["pairs"] or 0)
            released_disease_summary["released_unique_drugs"] = int(pred["drugs"] or 0)
            released_disease_summary["released_unique_targets"] = int(pred["targets"] or 0)
            released_disease_summary["released_unique_diseases"] = int(pred["diseases"] or 0)
            released_disease_summary["top_support_pattern"] = (
                support_pattern_distribution[0]["support_pattern_label"] if support_pattern_distribution else "NA"
            )
            released_disease_summary["vote_distribution"] = {
                str(item.get("total_votes")): int(item.get("count") or 0) for item in vote_distribution
            }
            released_disease_summary["algo_distribution"] = {
                str(item.get("algorithm_support")): int(item.get("count") or 0) for item in algo_distribution
            }
            released_disease_summary["top_rows"] = released_disease_top_rows
            released_disease_summary["top_targets"] = target_distribution
            released_disease_summary["top_drugs"] = drug_distribution
            released_disease_summary["top_diseases"] = released_top_diseases
        if released_dti_ttd_summary:
            released_dti_ttd_summary["released_rows"] = int(pred["total_rows"] or 0)
            released_dti_ttd_summary["ttd_supported_released_rows"] = int(
                (ttd_overview.get("ttd_supported_released_rows") if ttd_overview else 0)
                or released_dti_ttd_summary.get("ttd_supported_released_rows")
                or 0
            )

        release_filtered_pairs = int((released_dti_audit.get("release_filtered_pairs") if released_dti_audit else 0) or 9912)
        pipeline_shrinkage = {
            "raw_dti_pairs": 18016322,
            "vote4_retained": 9912,
            "release_filtered_pairs": release_filtered_pairs,
            "released_prediction_rows": pred["total_rows"],
            "formal_network_edges": overview["edges"],
            "formal_nodes": overview["nodes"],
        }

        support_tier_overview = {
            "released_support": [
                {
                    "tier": f"{item['algorithm_support']}/3",
                    "count": item["count"],
                    "share_pct": round((item["count"] / pred["total_rows"]) * 100, 2) if pred["total_rows"] else 0.0,
                }
                for item in algo_distribution
            ],
            "seven_model_support": [
                {
                    "tier": f"{item['total_votes']}/7",
                    "count": item["count"],
                    "share_pct": round((item["count"] / pred["total_rows"]) * 100, 2) if pred["total_rows"] else 0.0,
                }
                for item in vote_distribution
            ],
            "high_consensus_rows": len(high_consensus_cases),
        }

        result_tables = [
            {"name": "Formal network nodes", "rows": overview["nodes"], "description": "Unified node table used by the platform."},
            {"name": "Formal network edges", "rows": overview["edges"], "description": "Unified edge table used by the platform."},
            {"name": "Disease aliases", "rows": overview["disease_aliases"], "description": "Disease synonym expansion and normalization mapping."},
            {"name": "Predicted high-confidence rows", "rows": pred["total_rows"], "description": "Rows retained in the current high-confidence prediction table."},
            {"name": "Pipeline shrinkage summary", "rows": 5, "description": "Scale reduction from raw DTI candidates to released disease network results."},
            {"name": "Support tier overview", "rows": len(algo_distribution) + len(vote_distribution), "description": "Released-method and seven-model support tiers for retained rows."},
            {"name": "Drug-level prediction distribution", "rows": len(drug_distribution), "description": "Top retained drugs ranked by released prediction-row count."},
            {"name": "Target-level prediction distribution", "rows": len(target_distribution), "description": "Top retained targets ranked by released prediction-row count."},
            {"name": "Disease-level result table", "rows": len(disease_result_rows), "description": "Disease-centered released prediction summaries."},
            {"name": "Disease summary table", "rows": len(disease_spotlights), "description": "Top diseases with leading drugs, targets, and retained support levels."},
            {"name": "Drug summary table", "rows": len(drug_spotlights), "description": "Top drugs with dominant diseases, targets, and retained support peaks."},
            {"name": "Target summary table", "rows": len(target_spotlights), "description": "Top targets with dominant diseases, drugs, and retained support peaks."},
            {"name": "Consensus result table", "rows": len(high_consensus_cases), "description": "Rows jointly retained by all three released methods and strong 7-model vote support."},
            {"name": "Consensus priority table", "rows": len(top_consensus_leaderboard), "description": "Highest-priority released rows ranked by support and score."},
            {"name": "Approved drug result table", "rows": len(approved_drug_deep_results), "description": "Approved drugs ranked by released prediction support."},
            {"name": "Approved drug priority table", "rows": len(top_approved_leaderboard), "description": "Best supported retained rows among approved drugs."},
            {"name": "Selected prediction results", "rows": len(representative_cases), "description": "High-support released rows selected for direct review."},
        ]
        ncrna_linked_results: dict[str, Any] = {
            "available": False,
            "overview": {},
            "top_linked_drugs": [],
            "top_linked_consensus_cases": [],
            "top_linked_selected_approved": [],
        }
        if ncrna_overview:
            result_tables.extend(
                [
                    {
                        "name": "Known ncRNA-drug evidence",
                        "rows": ncrna_overview["evidence_rows"],
                        "description": "Curated human ncRNA-drug evidence rows incorporated as a formal known-only module.",
                    },
                    {
                        "name": "ncRNA summary table",
                        "rows": len(ncrna_summary.get("top_ncrnas") or []),
                        "description": "Top ncRNAs ranked by human-known ncRNA-drug evidence rows.",
                    },
                    {
                        "name": "ncRNA drug summary table",
                        "rows": len(ncrna_summary.get("top_drugs") or []),
                        "description": "Top drugs ranked by curated human ncRNA-drug evidence rows.",
                    },
                ]
            )
        if ncrna_linked_results.get("available"):
            result_tables.extend(
                [
                    {
                        "name": "ncRNA-linked released result table",
                        "rows": ncrna_linked_results["overview"]["released_row_count"],
                        "description": "Released prediction rows whose drugs also appear in the curated ncRNA-drug layer.",
                    },
                    {
                        "name": "ncRNA-linked consensus result table",
                        "rows": len(ncrna_linked_results.get("top_linked_consensus_cases") or []),
                        "description": "Consensus-tier released rows linked to curated ncRNA-drug evidence through shared drugs.",
                    },
                    {
                        "name": "ncRNA-linked approved result table",
                        "rows": len(ncrna_linked_results.get("top_linked_selected_approved") or []),
                        "description": "Selected approved-drug released rows linked to the curated ncRNA-drug layer.",
                    },
                ]
            )
        if ttd_overview:
            result_tables.extend(
                [
                    {
                        "name": "TTD therapeutic target summary",
                        "rows": ttd_overview["ttd_targets"],
                        "description": "TTD targets contributing therapeutic target annotations and disease mappings.",
                    },
                    {
                        "name": "TTD-supported released result table",
                        "rows": ttd_overview["ttd_supported_released_rows"],
                        "description": "Released rows overlapping TTD drug-disease or target-disease mappings.",
                    },
                    {
                        "name": "TTD-supported consensus result table",
                        "rows": sum(1 for row in ttd_overlap_rows if row.get("consensus_row") and row.get("ttd_any_supported")),
                        "description": "Consensus-tier released rows additionally supported by TTD therapeutic target mappings.",
                    },
                    {
                        "name": "TTD-supported approved result table",
                        "rows": sum(1 for row in ttd_overlap_rows if row.get("ttd_approved_drug") and row.get("ttd_any_supported")),
                        "description": "Approved-drug released rows overlapping TTD therapeutic target knowledge.",
                    },
                    {
                        "name": "TTD-supported target summary",
                        "rows": len(ttd_summary.get("top_supported_targets") or []),
                        "description": "Leading released targets supported by TTD therapeutic target knowledge.",
                    },
                ]
            )
        if released_disease_summary.get("released_rows"):
            result_tables.extend(
                [
                    {
                        "name": "Released disease-linked result table",
                        "rows": released_disease_summary["released_rows"],
                        "description": "Disease-linked released rows incorporated into the current formal release through the broadened DTI intake together with curated drug-disease and target-disease intersection.",
                    },
                    {
                        "name": "Released target summary",
                        "rows": len(released_disease_summary.get("top_targets") or []),
                        "description": "Top targets represented in the current released disease-linked layer.",
                    },
                    {
                        "name": "Released drug summary",
                        "rows": len(released_disease_summary.get("top_drugs") or []),
                        "description": "Top drugs represented in the current released disease-linked layer.",
                    },
                ]
            )

        approved_validation = {
            "approved_total": 4640,
            "entered_dti_space": 1761,
            "entered_high_confidence": 222,
            "retained_final": 221,
            "dti_space_coverage_pct": 37.9,
            "final_retention_pct": 99.5,
            "approved_mean_txgnn": 0.9831,
            "nonapproved_mean_txgnn": 0.9466,
            "mann_whitney_p": "2.53×10⁻¹¹⁷",
            "cohens_d": 0.497,
            "summary": "Approved-drug loss occurs primarily before or during DTI-space coverage and vote-based filtering; once an approved drug enters the high-confidence candidate set, it is almost always retained in the final network.",
        }
        if ncrna_overview:
            ncrna_edge_rows = load_ncrna_drug_edge_rows()
            edge_rows_by_drug: dict[str, list[dict[str, Any]]] = {}
            for row in ncrna_edge_rows:
                drug_id = str(row.get("drug_id_final") or row.get("DrugBank_ID") or "").strip()
                if not drug_id:
                    continue
                edge_rows_by_drug.setdefault(drug_id, []).append(row)

            released_prediction_detail = to_dicts(
                conn.execute(
                    f"""
                    SELECT
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        Target_ID AS target_id,
                        {src_target_label_expr} AS target_label,
                        {src_disease_id_expr} AS disease_id,
                        {src_disease_label_expr} AS disease_label,
                        {src_gene_name_expr} AS gene_name,
                        CAST(COALESCE(n_algo_pass, 0) AS INTEGER) AS n_algo_pass,
                        CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) AS Total_Votes_Optional7,
                        CAST(COALESCE(TXGNN_score, -1) AS REAL) AS TXGNN_score,
                        CAST(COALESCE(ENR_FDR, 999999) AS REAL) AS ENR_FDR,
                        {src_support_pattern_expr} AS support_pattern
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    """
                ).fetchall()
            )

            overlap_rows = [row for row in released_prediction_detail if row.get("drug_id") in edge_rows_by_drug]
            selected_approved_ids = {row["drug_id"] for row in approved_drug_deep_results if row.get("drug_id")}
            overlap_drug_ids = {row["drug_id"] for row in overlap_rows if row.get("drug_id")}
            overlap_ncrna_ids = {
                str(edge.get("ncrna_id") or "").strip()
                for drug_id in overlap_drug_ids
                for edge in edge_rows_by_drug.get(drug_id, [])
                if str(edge.get("ncrna_id") or "").strip()
            }

            relation_counter: Counter[str] = Counter()
            type_counter: Counter[str] = Counter()
            for drug_id in overlap_drug_ids:
                for edge in edge_rows_by_drug.get(drug_id, []):
                    for item in str(edge.get("relation_categories") or "").split(";"):
                        value = item.strip()
                        if value:
                            relation_counter[value] += 1
                    ncrna_type = str(edge.get("ncRNA_Type") or "").strip()
                    if ncrna_type:
                        type_counter[ncrna_type] += 1

            overlap_drug_summary: list[dict[str, Any]] = []
            for drug_id, rows in edge_rows_by_drug.items():
                drug_overlap_rows = [row for row in overlap_rows if row.get("drug_id") == drug_id]
                if not drug_overlap_rows:
                    continue
                top_case = sorted(
                    drug_overlap_rows,
                    key=lambda row: (
                        -int(row.get("n_algo_pass") or 0),
                        -int(row.get("Total_Votes_Optional7") or 0),
                        -float(row.get("TXGNN_score") or -1),
                        float(row.get("ENR_FDR") or 999999),
                        str(row.get("target_label") or ""),
                        str(row.get("disease_label") or ""),
                    ),
                )[0]
                linked_ncrna_names = sorted({str(row.get("ncRNA_Name") or "").strip() for row in rows if str(row.get("ncRNA_Name") or "").strip()})
                overlap_drug_summary.append(
                    {
                        "drug_id": drug_id,
                        "drug_label": top_case.get("drug_label") or drug_id,
                        "released_row_count": len(drug_overlap_rows),
                        "linked_ncrna_count": len({str(row.get("ncrna_id") or "").strip() for row in rows if str(row.get("ncrna_id") or "").strip()}),
                        "top_ncrna_name": linked_ncrna_names[0] if linked_ncrna_names else None,
                        "top_relation_category": max(
                            (
                                rel
                                for rel in Counter(
                                    item.strip()
                                    for row in rows
                                    for item in str(row.get("relation_categories") or "").split(";")
                                    if item.strip()
                                ).items()
                            ),
                            key=lambda item: (item[1], item[0]),
                            default=(None, 0),
                        )[0],
                        "max_algo_pass": max(int(row.get("n_algo_pass") or 0) for row in drug_overlap_rows),
                        "max_votes": max(int(row.get("Total_Votes_Optional7") or 0) for row in drug_overlap_rows),
                        "top_txgnn_score": max(float(row.get("TXGNN_score") or -1) for row in drug_overlap_rows),
                        "best_enr_fdr": min(float(row.get("ENR_FDR") or 999999) for row in drug_overlap_rows),
                    }
                )
            overlap_drug_summary.sort(
                key=lambda row: (
                    -int(row["released_row_count"]),
                    -int(row["max_algo_pass"]),
                    -int(row["max_votes"]),
                    -float(row["top_txgnn_score"]),
                    float(row["best_enr_fdr"]),
                    str(row["drug_label"]),
                )
            )

            overlap_consensus_cases = []
            for row in overlap_rows:
                if int(row.get("n_algo_pass") or 0) != 3 or int(row.get("Total_Votes_Optional7") or 0) < 4:
                    continue
                drug_edges = edge_rows_by_drug.get(row.get("drug_id"), [])
                linked_ncrna_names = sorted({str(item.get("ncRNA_Name") or "").strip() for item in drug_edges if str(item.get("ncRNA_Name") or "").strip()})
                overlap_consensus_cases.append(
                    {
                        **row,
                        "linked_ncrna_count": len({str(item.get("ncrna_id") or "").strip() for item in drug_edges if str(item.get("ncrna_id") or "").strip()}),
                        "top_ncrna_name": linked_ncrna_names[0] if linked_ncrna_names else None,
                    }
                )
            overlap_consensus_cases.sort(
                key=lambda row: (
                    -int(row.get("Total_Votes_Optional7") or 0),
                    -float(row.get("TXGNN_score") or -1),
                    float(row.get("ENR_FDR") or 999999),
                    str(row.get("drug_label") or ""),
                )
            )

            overlap_selected_approved = []
            for row in overlap_rows:
                if row.get("drug_id") not in selected_approved_ids:
                    continue
                drug_edges = edge_rows_by_drug.get(row.get("drug_id"), [])
                linked_ncrna_names = sorted({str(item.get("ncRNA_Name") or "").strip() for item in drug_edges if str(item.get("ncRNA_Name") or "").strip()})
                overlap_selected_approved.append(
                    {
                        **row,
                        "linked_ncrna_count": len({str(item.get("ncrna_id") or "").strip() for item in drug_edges if str(item.get("ncrna_id") or "").strip()}),
                        "top_ncrna_name": linked_ncrna_names[0] if linked_ncrna_names else None,
                    }
                )
            overlap_selected_approved.sort(
                key=lambda row: (
                    -int(row.get("n_algo_pass") or 0),
                    -int(row.get("Total_Votes_Optional7") or 0),
                    -float(row.get("TXGNN_score") or -1),
                    float(row.get("ENR_FDR") or 999999),
                    str(row.get("drug_label") or ""),
                )
            )

            ncrna_linked_results = {
                "available": bool(overlap_rows),
                "overview": {
                    "released_row_count": len(overlap_rows),
                    "consensus_row_count": len(overlap_consensus_cases),
                    "selected_approved_row_count": len(overlap_selected_approved),
                    "linked_drug_count": len(overlap_drug_ids),
                    "linked_ncrna_count": len(overlap_ncrna_ids),
                    "top_relation_category": relation_counter.most_common(1)[0][0] if relation_counter else None,
                    "top_ncrna_type": type_counter.most_common(1)[0][0] if type_counter else None,
                },
                "top_linked_drugs": overlap_drug_summary[:10],
                "top_linked_consensus_cases": overlap_consensus_cases[:10],
                "top_linked_selected_approved": overlap_selected_approved[:10],
            }

        ttd_supported_results = {"available": False, "overview": {}, "top_consensus_cases": [], "top_approved_rows": []}
        if ttd_overlap_rows:
            supported_rows = [row for row in ttd_overlap_rows if row.get("ttd_any_supported")]
            supported_consensus = [row for row in supported_rows if row.get("consensus_row")]
            supported_approved = [row for row in supported_rows if row.get("ttd_approved_drug")]

            def support_label(row: dict[str, Any]) -> str:
                parts = []
                if row.get("ttd_drug_target_supported"):
                    parts.append("Drug-Target")
                if row.get("ttd_drug_disease_supported"):
                    parts.append("Drug-Disease")
                if row.get("ttd_target_disease_supported"):
                    parts.append("Target-Disease")
                return " + ".join(parts) if parts else "TTD-supported"

            for row in supported_rows:
                row["ttd_support_label"] = support_label(row)

            supported_consensus.sort(
                key=lambda row: (
                    -int(row.get("n_algo_pass") or 0),
                    -int(row.get("Total_Votes_Optional7") or 0),
                    -float(row.get("TXGNN_score") or -1),
                    float(row.get("ENR_FDR") or 999999),
                    str(row.get("drug_label") or ""),
                )
            )
            supported_approved.sort(
                key=lambda row: (
                    -int(row.get("n_algo_pass") or 0),
                    -int(row.get("Total_Votes_Optional7") or 0),
                    -float(row.get("TXGNN_score") or -1),
                    float(row.get("ENR_FDR") or 999999),
                    str(row.get("drug_label") or ""),
                )
            )

            ttd_supported_results = {
                "available": bool(supported_rows),
                "overview": {
                    "released_row_count": len(supported_rows),
                    "consensus_row_count": len(supported_consensus),
                    "approved_row_count": len(supported_approved),
                    "drug_target_supported_rows": sum(1 for row in supported_rows if row.get("ttd_drug_target_supported")),
                    "drug_disease_supported_rows": sum(1 for row in supported_rows if row.get("ttd_drug_disease_supported")),
                    "target_disease_supported_rows": sum(1 for row in supported_rows if row.get("ttd_target_disease_supported")),
                    "top_moa": next((row.get("ttd_moa") for row in supported_rows if row.get("ttd_moa")), None),
                },
                "top_consensus_cases": supported_consensus[:10],
                "top_approved_rows": supported_approved[:10],
            }

        target_spotlight_map = {str(item.get("target_id") or ""): item for item in target_spotlights}
        ttd_target_rows: dict[str, list[dict[str, Any]]] = {}
        for row in ttd_overlap_rows:
            if not row.get("ttd_any_supported"):
                continue
            target_id = str(row.get("target_id") or "").strip()
            if not target_id:
                continue
            ttd_target_rows.setdefault(target_id, []).append(row)

        target_centric_module_rows: list[dict[str, Any]] = []
        candidate_target_ids: list[str] = []
        candidate_target_ids.extend([str(item.get("Target_ID") or "") for item in (ttd_summary.get("top_supported_targets") or [])])
        candidate_target_ids.extend([str(item.get("target_id") or "") for item in target_spotlights])
        seen_target_ids: set[str] = set()
        for target_id in candidate_target_ids:
            if not target_id or target_id in seen_target_ids:
                continue
            seen_target_ids.add(target_id)
            spotlight = target_spotlight_map.get(target_id, {})
            overlap_rows = ttd_target_rows.get(target_id, [])
            support_counter: Counter[str] = Counter()
            moa_counter: Counter[str] = Counter()
            for row in overlap_rows:
                if row.get("ttd_drug_target_supported"):
                    support_counter["Drug-Target"] += 1
                if row.get("ttd_drug_disease_supported"):
                    support_counter["Drug-Disease"] += 1
                if row.get("ttd_target_disease_supported"):
                    support_counter["Target-Disease"] += 1
                if row.get("ttd_moa"):
                    moa_counter[str(row["ttd_moa"])] += 1
            top_support = support_counter.most_common(1)[0][0] if support_counter else None
            top_moa = moa_counter.most_common(1)[0][0] if moa_counter else None
            target_centric_module_rows.append(
                {
                    "target_id": target_id,
                    "target_label": spotlight.get("target_label")
                    or next((row.get("target_label") for row in overlap_rows if row.get("target_label")), None)
                    or target_id,
                    "released_rows": int(spotlight.get("row_count") or 0),
                    "consensus_rows": sum(1 for row in overlap_rows if row.get("consensus_row")),
                    "top_disease_label": spotlight.get("top_disease_label"),
                    "top_drug_label": spotlight.get("top_drug_label"),
                    "max_algo_pass": int(spotlight.get("max_algo_pass") or 0),
                    "max_votes": int(spotlight.get("max_votes") or 0),
                    "ttd_supported_rows": len(overlap_rows),
                    "top_ttd_support": top_support,
                    "top_ttd_moa": top_moa,
                    "top_linked_rows": sorted(
                        [
                            {
                                "drug_id": row.get("drug_id"),
                                "drug_label": row.get("drug_label"),
                                "disease_id": row.get("disease_id"),
                                "disease_label": row.get("disease_label"),
                                "n_algo_pass": int(row.get("n_algo_pass") or 0),
                                "Total_Votes_Optional7": int(row.get("Total_Votes_Optional7") or 0),
                                "TXGNN_score": row.get("TXGNN_score"),
                                "ENR_FDR": row.get("ENR_FDR"),
                                "ttd_support_label": support_label(row),
                                "ttd_moa": row.get("ttd_moa"),
                            }
                            for row in overlap_rows
                        ],
                        key=lambda row: (
                            -int(row.get("n_algo_pass") or 0),
                            -int(row.get("Total_Votes_Optional7") or 0),
                            -float(row.get("TXGNN_score") or -1),
                            float(row.get("ENR_FDR") or 999999),
                            str(row.get("drug_label") or ""),
                            str(row.get("disease_label") or ""),
                        ),
                    )[:3],
                }
            )

        target_centric_module_rows.sort(
            key=lambda item: (
                -int(item.get("ttd_supported_rows") or 0),
                -int(item.get("released_rows") or 0),
                -int(item.get("consensus_rows") or 0),
                -int(item.get("max_algo_pass") or 0),
                -int(item.get("max_votes") or 0),
                str(item.get("target_label") or ""),
            )
        )
        target_centric_module = {
            "available": bool(target_centric_module_rows),
            "overview": {
                "selected_target_count": len(target_centric_module_rows[:8]),
                "ttd_supported_target_count": len([item for item in target_centric_module_rows if int(item.get("ttd_supported_rows") or 0) > 0]),
                "consensus_supported_target_count": len([item for item in target_centric_module_rows if int(item.get("consensus_rows") or 0) > 0]),
                "leading_moa": next((item.get("top_ttd_moa") for item in target_centric_module_rows if item.get("top_ttd_moa")), None),
            },
            "rows": target_centric_module_rows[:8],
        }

        disease_annotation_rows = to_dicts(
            conn.execute(
                """
                SELECT
                    node_id,
                    drug_summary,
                    target_summary,
                    ncrna_summary,
                    ttd_summary
                FROM node_annotations
                WHERE node_type = 'Disease'
                """
            ).fetchall()
        )
        disease_annotation_map = {str(item.get("node_id") or ""): item for item in disease_annotation_rows}
        disease_centric_module_rows: list[dict[str, Any]] = []
        for item in disease_spotlights[:8]:
            disease_id = str(item.get("disease_id") or "").strip()
            ann = disease_annotation_map.get(disease_id, {})
            top_linked_rows = to_dicts(
                conn.execute(
                    f"""
                    SELECT
                        Drug_ID AS drug_id,
                        {src_drug_label_expr} AS drug_label,
                        Target_ID AS target_id,
                        {src_target_label_expr} AS target_label,
                        CAST(COALESCE(n_algo_pass, 0) AS INTEGER) AS n_algo_pass,
                        CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) AS Total_Votes_Optional7,
                        CAST(COALESCE(TXGNN_score, -1) AS REAL) AS TXGNN_score,
                        CAST(COALESCE(ENR_FDR, 999999) AS REAL) AS ENR_FDR,
                        COALESCE(support_pattern, {src_support_pattern_expr}) AS support_pattern
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    WHERE {src_disease_id_expr} = ?
                    ORDER BY
                        CAST(COALESCE(n_algo_pass, 0) AS INTEGER) DESC,
                        CAST(COALESCE(Total_Votes_Optional7, 0) AS INTEGER) DESC,
                        CAST(COALESCE(TXGNN_score, -1) AS REAL) DESC,
                        CAST(COALESCE(ENR_FDR, 999999) AS REAL) ASC,
                        {src_drug_label_expr},
                        {src_target_label_expr}
                    LIMIT 3
                    """,
                    [disease_id],
                ).fetchall()
            )
            disease_centric_module_rows.append(
                {
                    "disease_id": disease_id,
                    "disease_label": item.get("disease_label") or disease_id.removeprefix("DIS::"),
                    "released_rows": int(item.get("row_count") or 0),
                    "top_drug_id": item.get("top_drug_id"),
                    "top_drug_label": item.get("top_drug_label"),
                    "top_target_label": item.get("top_target_label"),
                    "max_algo_pass": int(item.get("max_algo_pass") or 0),
                    "max_votes": int(item.get("max_votes") or 0),
                    "drug_summary": ann.get("drug_summary"),
                    "target_summary": ann.get("target_summary"),
                    "ncrna_summary": ann.get("ncrna_summary"),
                    "ttd_summary": ann.get("ttd_summary"),
                    "top_linked_rows": top_linked_rows,
                }
            )

        disease_centric_module = {
            "available": bool(disease_centric_module_rows),
            "overview": {
                "selected_disease_count": len(disease_centric_module_rows),
                "ncrna_context_count": len(
                    [
                        item
                        for item in disease_centric_module_rows
                        if item.get("ncrna_summary") and "No ncRNA-linked" not in str(item.get("ncrna_summary"))
                    ]
                ),
                "ttd_context_count": len(
                    [
                        item
                        for item in disease_centric_module_rows
                        if item.get("ttd_summary") and "No TTD-supported" not in str(item.get("ttd_summary"))
                    ]
                ),
                "leading_drug": next((item.get("top_drug_label") for item in disease_centric_module_rows if item.get("top_drug_label")), None),
            },
            "rows": disease_centric_module_rows,
        }

        return {
            "overview": overview,
            "source_tables": source_tables,
            "edge_summary": edge_summary,
            "prediction_summary": {
                "total_rows": pred["total_rows"],
                "drugs": pred["drugs"],
                "targets": pred["targets"],
                "diseases": pred["diseases"],
                "txgnn_pass": pred["txgnn_pass"],
                "enr_pass": pred["enr_pass"],
                "rwr_pass": pred["rwr_pass"],
                "algorithm_support_distribution": algo_distribution,
                "vote_distribution": vote_distribution,
                "support_pattern_distribution": support_pattern_distribution,
                "dti_model_consistency": dti_model_consistency,
            },
            "target_disease_match": target_disease_match,
            "disease_distribution": {
                "total_links": disease_total_links,
                "top_diseases": disease_distribution,
            },
            "drug_distribution": {
                "total_rows": drug_total_rows,
                "top_drugs": drug_distribution,
            },
            "target_distribution": {
                "total_rows": drug_total_rows,
                "top_targets": target_distribution,
            },
            "approved_validation": approved_validation,
            "pipeline_shrinkage": pipeline_shrinkage,
            "support_tier_overview": support_tier_overview,
            "high_consensus_cases": high_consensus_cases,
            "disease_results": disease_result_rows,
            "disease_spotlights": disease_spotlights,
            "drug_spotlights": drug_spotlights,
            "target_spotlights": target_spotlights,
            "top_consensus_leaderboard": top_consensus_leaderboard,
            "approved_drug_deep_results": approved_drug_deep_results,
            "top_approved_leaderboard": top_approved_leaderboard,
            "representative_drugs": representative_rows,
            "representative_cases": representative_cases,
            "ncrna_summary": ncrna_summary,
            "ncrna_linked_results": ncrna_linked_results,
            "released_dti_audit": released_dti_audit,
            "released_dti_ttd_summary": released_dti_ttd_summary,
            "released_disease_summary": released_disease_summary,
            "ttd_summary": ttd_summary,
            "ttd_supported_results": ttd_supported_results,
            "target_centric_module": target_centric_module,
            "disease_centric_module": disease_centric_module,
            "result_tables": result_tables,
        }
    finally:
        conn.close()


@app.get("/api/nodes")
def list_nodes(
    node_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=200),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        where = []
        params: list[Any] = []
        if node_type:
            where.append("node_type = ?")
            params.append(node_type)
        if q:
            kw = f"%{q.strip()}%"
            where.append(
                """
                (
                    label LIKE ?
                    OR id LIKE ?
                    OR EXISTS (
                        SELECT 1
                        FROM node_annotations na
                        WHERE na.node_id = network_nodes.id
                          AND na.synonyms_json LIKE ?
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM disease_aliases da
                        WHERE da.disease_id = network_nodes.id
                          AND da.alias LIKE ?
                    )
                )
                """
            )
            params.extend([kw, kw, kw, kw])
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        total = conn.execute(f"SELECT COUNT(*) AS n FROM network_nodes {where_sql}", params).fetchone()["n"]
        offset = (page - 1) * page_size
        rows = conn.execute(
            f"""
            SELECT id, label, node_type, display_name, source
            FROM network_nodes
            {where_sql}
            ORDER BY node_type, label
            LIMIT ? OFFSET ?
            """,
            [*params, page_size, offset],
        ).fetchall()
        return {"total": total, "page": page, "page_size": page_size, "items": to_dicts(rows)}
    finally:
        conn.close()


@app.get("/api/results/ncrna/evidence")
def list_ncrna_evidence(
    q: str | None = Query(default=None),
    ncrna_type: str | None = Query(default=None),
    relation_category: str | None = Query(default=None),
    fda: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> dict[str, Any]:
    items = load_ncrna_drug_evidence_rows()
    q_norm = (q or "").strip().lower()

    filtered: list[dict[str, Any]] = []
    for row in items:
        if ncrna_type and row.get("ncRNA_Type") != ncrna_type:
            continue
        if relation_category and row.get("relation_category") != relation_category:
            continue
        if fda and row.get("FDA") != fda:
            continue
        if q_norm:
            haystack = " ".join(
                [
                    row.get("ncRNA_Name", ""),
                    row.get("Drug_Name", ""),
                    row.get("DrugBank_ID", ""),
                    row.get("Phenotype", ""),
                    row.get("Condition", ""),
                    row.get("Reference", ""),
                ]
            ).lower()
            if q_norm not in haystack:
                continue
        filtered.append(row)

    filtered.sort(
        key=lambda row: (
            row.get("ncRNA_Name", ""),
            row.get("Drug_Name", ""),
            row.get("Published_Year", ""),
        )
    )
    return paginate_list(filtered, page, page_size)


@app.get("/api/results/ncrna/edges")
def list_ncrna_edges(
    q: str | None = Query(default=None),
    ncrna_type: str | None = Query(default=None),
    relation_category: str | None = Query(default=None),
    fda: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> dict[str, Any]:
    items = load_ncrna_drug_edge_rows()
    q_norm = (q or "").strip().lower()

    filtered: list[dict[str, Any]] = []
    for row in items:
        if ncrna_type and row.get("ncRNA_Type") != ncrna_type:
            continue
        if relation_category and relation_category not in (row.get("relation_categories") or ""):
            continue
        if fda and row.get("fda_status") != fda:
            continue
        if q_norm:
            haystack = " ".join(
                [
                    row.get("ncRNA_Name", ""),
                    row.get("Drug_Name", ""),
                    row.get("DrugBank_ID", ""),
                    row.get("phenotypes", ""),
                    row.get("conditions", ""),
                    row.get("target_genes", ""),
                ]
            ).lower()
            if q_norm not in haystack:
                continue
        filtered.append(row)

    filtered.sort(
        key=lambda row: (
            -int(row.get("evidence_rows") or 0),
            row.get("ncRNA_Name", ""),
            row.get("Drug_Name", ""),
        )
    )
    return paginate_list(filtered, page, page_size)


@app.get("/api/search")
def search(
    q: str = Query(min_length=1),
    node_type: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        params: list[Any] = []
        where = """
            (
                label LIKE ?
                OR id LIKE ?
                OR EXISTS (
                    SELECT 1
                    FROM node_annotations na
                    WHERE na.node_id = network_nodes.id
                      AND na.synonyms_json LIKE ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM disease_aliases da
                    WHERE da.disease_id = network_nodes.id
                      AND da.alias LIKE ?
                )
            )
        """
        kw = f"%{q.strip()}%"
        params.extend([kw, kw, kw, kw])
        if node_type:
            where += " AND node_type = ?"
            params.append(node_type)
        rows = conn.execute(
            f"""
            SELECT id, label, node_type, display_name
            FROM network_nodes
            WHERE {where}
            ORDER BY
                CASE WHEN label = ? THEN 0 ELSE 1 END,
                LENGTH(label),
                label
            LIMIT ?
            """,
            [*params, q.strip(), limit],
        ).fetchall()
        return {"items": to_dicts(rows)}
    finally:
        conn.close()


@app.get("/api/suggest")
def suggest(
    q: str = Query(min_length=1),
    node_type: str | None = Query(default=None),
    limit: int = Query(default=8, ge=1, le=30),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        term = q.strip()
        kw = f"%{term}%"
        prefix = f"{term}%"
        params: list[Any] = [kw, kw, kw, kw]
        where = """
            (
                label LIKE ?
                OR id LIKE ?
                OR EXISTS (
                    SELECT 1
                    FROM node_annotations na
                    WHERE na.node_id = network_nodes.id
                      AND na.synonyms_json LIKE ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM disease_aliases da
                    WHERE da.disease_id = network_nodes.id
                      AND da.alias LIKE ?
                )
            )
        """
        if node_type:
            where += " AND node_type = ?"
            params.append(node_type)
        rows = conn.execute(
            f"""
            SELECT id, label, node_type, display_name
            FROM network_nodes
            WHERE {where}
            ORDER BY
                CASE WHEN id = ? OR label = ? THEN 0 ELSE 1 END,
                CASE WHEN id LIKE ? OR label LIKE ? THEN 0 ELSE 1 END,
                LENGTH(label),
                label
            LIMIT ?
            """,
            [*params, term, term, prefix, prefix, limit],
        ).fetchall()
        return {"items": to_dicts(rows)}
    finally:
        conn.close()


@app.get("/api/edges")
def list_edges(
    edge_category: str | None = Query(default=None),
    edge_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=300),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        where = []
        params: list[Any] = []

        categories = normalize_list(edge_category)
        if categories:
            placeholders = ",".join(["?"] * len(categories))
            where.append(f"e.edge_category IN ({placeholders})")
            params.extend(categories)

        types = normalize_list(edge_type)
        if types:
            placeholders = ",".join(["?"] * len(types))
            where.append(f"e.edge_type IN ({placeholders})")
            params.extend(types)

        if q:
            kw = f"%{q.strip()}%"
            where.append(
                "(e.source LIKE ? OR e.target LIKE ? OR ns.label LIKE ? OR nt.label LIKE ? OR e.remark LIKE ?)"
            )
            params.extend([kw, kw, kw, kw, kw])

        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS n
            FROM network_edges e
            LEFT JOIN network_nodes ns ON ns.id=e.source
            LEFT JOIN network_nodes nt ON nt.id=e.target
            {where_sql}
            """,
            params,
        ).fetchone()["n"]

        offset = (page - 1) * page_size
        rows = conn.execute(
            f"""
            SELECT
                e.source, ns.label AS source_label, ns.node_type AS source_type,
                e.target, nt.label AS target_label, nt.node_type AS target_type,
                e.edge_category, e.edge_type, e.evidence_source, e.weight, e.display_color,
                e.support_score, e.remark
            FROM network_edges e
            LEFT JOIN network_nodes ns ON ns.id=e.source
            LEFT JOIN network_nodes nt ON nt.id=e.target
            {where_sql}
            ORDER BY e.weight DESC, e.support_score DESC, e.source, e.target
            LIMIT ? OFFSET ?
            """,
            [*params, page_size, offset],
        ).fetchall()

        return {"total": total, "page": page, "page_size": page_size, "items": to_dicts(rows)}
    finally:
        conn.close()


@app.get("/api/results/predictions")
def list_prediction_results(
    q: str | None = Query(default=None),
    n_algo_pass: str | None = Query(default=None),
    txgnn_pass: str | None = Query(default=None),
    enr_pass: str | None = Query(default=None),
    rwr_pass: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        where = ["1=1"]
        params: list[Any] = []
        if q:
            kw = f"%{q.strip()}%"
            where.append(
                """
                (
                    h.Drug_ID LIKE ?
                    OR h.Target_ID LIKE ?
                    OR h.Ensemble_Disease_Name LIKE ?
                    OR h.Drug_Name LIKE ?
                    OR h.target_name LIKE ?
                    OR h.gene_name LIKE ?
                )
                """
            )
            params.extend([kw, kw, kw, kw, kw, kw])
        if n_algo_pass:
            where.append("CAST(h.n_algo_pass AS TEXT) = ?")
            params.append(n_algo_pass)
        if txgnn_pass:
            where.append("CAST(h.TXGNN_pass AS TEXT) = ?")
            params.append(txgnn_pass)
        if enr_pass:
            where.append("CAST(h.ENR_pass AS TEXT) = ?")
            params.append(enr_pass)
        if rwr_pass:
            where.append("CAST(h.RWR_pass AS TEXT) = ?")
            params.append(rwr_pass)

        where_sql = " AND ".join(where)
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS n
            FROM src_highconfidence_expand_vote4_top50_tx07 h
            WHERE {where_sql}
            """,
            params,
        ).fetchone()["n"]

        offset = (page - 1) * page_size
        rows = conn.execute(
            f"""
            WITH filtered AS (
                SELECT
                    h.*,
                    ROW_NUMBER() OVER (
                        ORDER BY h.n_algo_pass DESC, h.TXGNN_score DESC, h.ENR_FDR ASC, h.Drug_ID, h.Target_ID
                    ) AS result_rank
                FROM src_highconfidence_expand_vote4_top50_tx07 h
                WHERE {where_sql}
            )
            SELECT
                f.result_rank,
                f.Drug_ID,
                COALESCE(nd.display_name, nd.label, f.Drug_Name) AS Drug_Label,
                f.Drug_Name,
                f.Target_ID,
                COALESCE(nt.display_name, nt.label, f.target_name) AS Target_Label,
                f.target_name AS Target_Name,
                f.gene_name,
                ('DIS::' || f.Ensemble_Disease_Name) AS Disease_ID,
                f.Ensemble_Disease_Name,
                COALESCE(nx.display_name, nx.label, f.Ensemble_Disease_Name) AS Disease_Label,
                f.n_algo_pass,
                f.TXGNN_pass,
                f.ENR_pass,
                f.RWR_pass,
                f.TXGNN_score,
                f.ENR_FDR,
                f.Total_Votes_Optional7,
                (
                    'TXGNN:' || CAST(COALESCE(f.TXGNN_pass, 0) AS TEXT) ||
                    ' | ENR:' || CAST(COALESCE(f.ENR_pass, 0) AS TEXT) ||
                    ' | RWR:' || CAST(COALESCE(f.RWR_pass, 0) AS TEXT)
                ) AS support_pattern,
                'HighConfidence_expand_vote4_top50_TX07' AS source_table
            FROM filtered f
            LEFT JOIN network_nodes nd ON nd.id = f.Drug_ID
            LEFT JOIN network_nodes nt ON nt.id = f.Target_ID
            LEFT JOIN network_nodes nx ON nx.id = ('DIS::' || f.Ensemble_Disease_Name)
            ORDER BY f.result_rank ASC
            LIMIT ? OFFSET ?
            """,
            [*params, page_size, offset],
        ).fetchall()
        return {"total": total, "page": page, "page_size": page_size, "items": enrich_with_seven_models(to_dicts(rows))}
    finally:
        conn.close()


@app.get("/api/analysis/online")
def online_analysis(
    focus_id: str = Query(..., min_length=1),
    min_algo_pass: int = Query(default=1, ge=1, le=3),
    min_votes: int = Query(default=0, ge=0, le=7),
    ncrna_type: str | None = Query(default=None),
    txgnn_pass: str | None = Query(default=None),
    enr_pass: str | None = Query(default=None),
    rwr_pass: str | None = Query(default=None),
    limit: int = Query(default=12, ge=5, le=50),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        focus = focus_id.strip()
        focus_row = conn.execute(
            "SELECT id, node_type, COALESCE(display_name, label, id) AS display_name FROM network_nodes WHERE id = ?",
            [focus],
        ).fetchone()
        if not focus_row:
            raise HTTPException(status_code=404, detail=f"Released disease network node not found: {focus}")

        focus_type = focus_row["node_type"]
        focus_label = focus_row["display_name"]
        where_sql, params = build_online_analysis_where(
            focus=focus,
            focus_type=focus_type,
            min_algo_pass=min_algo_pass,
            min_votes=min_votes,
            ncrna_type=ncrna_type,
            txgnn_pass=txgnn_pass,
            enr_pass=enr_pass,
            rwr_pass=rwr_pass,
        )
        total_rows = conn.execute(
            f"SELECT COUNT(*) AS n FROM src_highconfidence_expand_vote4_top50_tx07 h WHERE {where_sql}",
            params,
        ).fetchone()["n"]

        summary_row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT h.Drug_ID) AS drugs,
                COUNT(DISTINCT h.Target_ID) AS targets,
                COUNT(DISTINCT h.Ensemble_Disease_Name) AS diseases,
                MAX(CAST(COALESCE(h.n_algo_pass, 0) AS INTEGER)) AS max_algo_pass,
                MAX(CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER)) AS max_votes,
                AVG(CAST(COALESCE(h.TXGNN_score, 0) AS REAL)) AS avg_txgnn_score,
                MIN(CAST(COALESCE(h.ENR_FDR, 999999) AS REAL)) AS best_enr_fdr
            FROM src_highconfidence_expand_vote4_top50_tx07 h
            WHERE {where_sql}
            """,
            params,
        ).fetchone()

        method_distribution = to_dicts(
            conn.execute(
                f"""
                SELECT
                    CASE
                        WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR + RWR'
                        WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + ENR'
                        WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN + RWR'
                        WHEN COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true')
                             AND COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR + RWR'
                        WHEN COALESCE(h.TXGNN_pass, 0) IN (1, '1', 'True', 'true') THEN 'TXGNN only'
                        WHEN COALESCE(h.ENR_pass, 0) IN (1, '1', 'True', 'true') THEN 'ENR only'
                        WHEN COALESCE(h.RWR_pass, 0) IN (1, '1', 'True', 'true') THEN 'RWR only'
                        ELSE 'No method passed'
                    END AS support_pattern_label,
                    COUNT(*) AS count
                FROM src_highconfidence_expand_vote4_top50_tx07 h
                WHERE {where_sql}
                GROUP BY support_pattern_label
                ORDER BY count DESC, support_pattern_label
                """,
                params,
            ).fetchall()
        )
        vote_distribution = to_dicts(
            conn.execute(
                f"""
                SELECT CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER) AS total_votes, COUNT(*) AS count
                FROM src_highconfidence_expand_vote4_top50_tx07 h
                WHERE {where_sql}
                GROUP BY CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER)
                ORDER BY CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER) DESC
                """,
                params,
            ).fetchall()
        )

        top_rows = to_dicts(
            conn.execute(
                f"""
                WITH filtered AS (
                    SELECT
                        h.*,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                CAST(COALESCE(h.n_algo_pass, 0) AS INTEGER) DESC,
                                CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER) DESC,
                                CAST(COALESCE(h.TXGNN_score, -1) AS REAL) DESC,
                                CAST(COALESCE(h.ENR_FDR, 999999) AS REAL) ASC
                        ) AS result_rank
                    FROM src_highconfidence_expand_vote4_top50_tx07 h
                    WHERE {where_sql}
                )
                SELECT
                    f.result_rank,
                    f.Drug_ID,
                    COALESCE(nd.display_name, nd.label, f.Drug_Name) AS Drug_Label,
                    f.Target_ID,
                    COALESCE(nt.display_name, nt.label, f.target_name) AS Target_Label,
                    ('DIS::' || f.Ensemble_Disease_Name) AS Disease_ID,
                    COALESCE(nx.display_name, nx.label, f.Ensemble_Disease_Name) AS Disease_Label,
                    COALESCE(f.gene_name, '-') AS gene_name,
                    f.n_algo_pass,
                    f.TXGNN_pass,
                    f.ENR_pass,
                    f.RWR_pass,
                    f.TXGNN_score,
                    f.ENR_FDR,
                    f.Total_Votes_Optional7
                FROM filtered f
                LEFT JOIN network_nodes nd ON nd.id = f.Drug_ID
                LEFT JOIN network_nodes nt ON nt.id = f.Target_ID
                LEFT JOIN network_nodes nx ON nx.id = ('DIS::' || f.Ensemble_Disease_Name)
                ORDER BY f.result_rank ASC
                LIMIT ?
                """,
                [*params, limit],
            ).fetchall()
        )
        top_rows = enrich_with_seven_models(top_rows)
        for item in top_rows:
            item["support_pattern"] = build_support_pattern_label(item)

        return {
            "focus_id": focus,
            "focus_label": focus_label,
            "focus_type": focus_type,
            "filters": {
                "min_algo_pass": min_algo_pass,
                "min_votes": min_votes,
                "ncrna_type": ncrna_type,
                "txgnn_pass": txgnn_pass,
                "enr_pass": enr_pass,
                "rwr_pass": rwr_pass,
                "limit": limit,
            },
            "summary": {
                "total_rows": summary_row["total_rows"] or 0,
                "drugs": summary_row["drugs"] or 0,
                "targets": summary_row["targets"] or 0,
                "diseases": summary_row["diseases"] or 0,
                "max_algo_pass": summary_row["max_algo_pass"] or 0,
                "max_votes": summary_row["max_votes"] or 0,
                "avg_txgnn_score": round(summary_row["avg_txgnn_score"], 4) if summary_row["avg_txgnn_score"] is not None else None,
                "best_enr_fdr": round(summary_row["best_enr_fdr"], 8) if summary_row["best_enr_fdr"] is not None else None,
            },
            "method_distribution": method_distribution,
            "vote_distribution": vote_distribution,
            "top_rows": top_rows,
            "total_rows": total_rows,
        }
    finally:
        conn.close()


@app.get("/api/analysis/online/subgraph")
def online_analysis_subgraph(
    focus_id: str = Query(..., min_length=1),
    min_algo_pass: int = Query(default=1, ge=1, le=3),
    min_votes: int = Query(default=0, ge=0, le=7),
    ncrna_type: str | None = Query(default=None),
    txgnn_pass: str | None = Query(default=None),
    enr_pass: str | None = Query(default=None),
    rwr_pass: str | None = Query(default=None),
    limit: int = Query(default=20, ge=5, le=80),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        focus = focus_id.strip()
        focus_row = conn.execute(
            "SELECT id, node_type, COALESCE(display_name, label, id) AS display_name FROM network_nodes WHERE id = ?",
            [focus],
        ).fetchone()
        if not focus_row:
            raise HTTPException(status_code=404, detail=f"Released disease network node not found: {focus}")

        where_sql, params = build_online_analysis_where(
            focus=focus,
            focus_type=focus_row["node_type"],
            min_algo_pass=min_algo_pass,
            min_votes=min_votes,
            ncrna_type=ncrna_type,
            txgnn_pass=txgnn_pass,
            enr_pass=enr_pass,
            rwr_pass=rwr_pass,
        )
        rows = to_dicts(
            conn.execute(
                f"""
                SELECT
                    h.Drug_ID,
                    h.Target_ID,
                    ('DIS::' || h.Ensemble_Disease_Name) AS Disease_ID
                FROM src_highconfidence_expand_vote4_top50_tx07 h
                WHERE {where_sql}
                ORDER BY
                    CAST(COALESCE(h.n_algo_pass, 0) AS INTEGER) DESC,
                    CAST(COALESCE(h.Total_Votes_Optional7, 0) AS INTEGER) DESC,
                    CAST(COALESCE(h.TXGNN_score, -1) AS REAL) DESC,
                    CAST(COALESCE(h.ENR_FDR, 999999) AS REAL) ASC
                LIMIT ?
                """,
                [*params, limit],
            ).fetchall()
        )
        node_ids = {focus}
        for row in rows:
            node_ids.update([row["Drug_ID"], row["Target_ID"], row["Disease_ID"]])
        node_ids = {node_id for node_id in node_ids if node_id}
        if not node_ids:
            return {"center_id": focus, "depth": 1, "mode": "online-analysis", "nodes": [], "edges": []}

        placeholders = ",".join(["?"] * len(node_ids))
        node_rows = to_dicts(
            conn.execute(
                f"""
                SELECT id, label, node_type, display_name, source, modality_class
                FROM network_nodes
                WHERE id IN ({placeholders})
                ORDER BY node_type, label
                """,
                list(node_ids),
            ).fetchall()
        )
        edge_rows = to_dicts(
            conn.execute(
                f"""
                SELECT *
                FROM network_edges
                WHERE source IN ({placeholders})
                  AND target IN ({placeholders})
                ORDER BY support_score DESC, weight DESC, source, target
                """,
                [*node_ids, *node_ids],
            ).fetchall()
        )
        return {
            "center_id": focus,
            "depth": 1,
            "mode": "online-analysis",
            "nodes": node_rows,
            "edges": edge_rows,
        }
    finally:
        conn.close()


@app.get("/api/node/{node_id:path}/neighbors")
def node_neighbors(
    node_id: str,
    edge_category: str | None = Query(default=None),
    edge_type: str | None = Query(default=None),
    q: str | None = Query(default=None),
    order_by: str = Query(default="weight_desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM network_nodes WHERE id = ? LIMIT 1", [node_id]).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail=f"Node not found: {node_id}")

        where = ["(e.source = ? OR e.target = ?)"]
        params: list[Any] = [node_id, node_id]

        categories = normalize_list(edge_category)
        if categories:
            ph = ",".join(["?"] * len(categories))
            where.append(f"e.edge_category IN ({ph})")
            params.extend(categories)

        types = normalize_list(edge_type)
        if types:
            ph = ",".join(["?"] * len(types))
            where.append(f"e.edge_type IN ({ph})")
            params.extend(types)

        if q:
            kw = f"%{q.strip()}%"
            where.append("(n.label LIKE ? OR n.id LIKE ?)")
            params.extend([kw, kw])

        where_sql = " AND ".join(where)
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS n
            FROM network_edges e
            JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE {where_sql}
            """,
            [node_id, *params],
        ).fetchone()["n"]

        offset = (page - 1) * page_size
        order_sql = {
            "weight_desc": "e.weight DESC, e.support_score DESC, n.label",
            "score_desc": "e.support_score DESC, e.weight DESC, n.label",
            "label_asc": "n.label ASC, e.weight DESC, e.support_score DESC",
        }.get(order_by, "e.weight DESC, e.support_score DESC, n.label")

        rows = conn.execute(
            f"""
            SELECT
                CASE WHEN e.source = ? THEN e.target ELSE e.source END AS neighbor_id,
                n.label AS neighbor_label,
                n.node_type AS neighbor_type,
                e.edge_category,
                e.edge_type,
                e.support_score,
                e.display_color,
                e.weight
            FROM network_edges e
            JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT ? OFFSET ?
            """,
            [node_id, node_id, *params, page_size, offset],
        ).fetchall()
        return {"total": total, "page": page, "page_size": page_size, "items": to_dicts(rows)}
    finally:
        conn.close()


@app.get("/api/node/{node_id:path}")
def node_detail(
    node_id: str,
    include_neighbors: bool = Query(default=False),
    neighbor_page: int = Query(default=1, ge=1),
    neighbor_page_size: int = Query(default=50, ge=1, le=500),
    neighbor_q: str | None = Query(default=None),
    neighbor_edge_category: str | None = Query(default=None),
    neighbor_edge_type: str | None = Query(default=None),
    neighbor_order_by: str = Query(default="weight_desc"),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        node = conn.execute(
            "SELECT id, label, node_type, display_name, source FROM network_nodes WHERE id = ?",
            [node_id],
        ).fetchone()
        if not node:
            raise HTTPException(status_code=404, detail=f"Node not found: {node_id}")
        node_dict = dict(node)
        annotation = get_node_annotation(conn, node_id=node_dict["id"], node_type=node_dict["node_type"])

        edge_stats = conn.execute(
            """
            SELECT edge_category, edge_type, COUNT(*) AS count
            FROM network_edges
            WHERE source = ? OR target = ?
            GROUP BY edge_category, edge_type
            ORDER BY count DESC
            """,
            [node_id, node_id],
        ).fetchall()
        edge_stats_dicts = to_dicts(edge_stats)
        multimodal_profile = build_multimodal_profile(node_dict, annotation, edge_stats_dicts)
        mechanism_rows = conn.execute(
            """
            SELECT
                CASE WHEN e.source = ? THEN e.target ELSE e.source END AS neighbor_id,
                n.label AS neighbor_label,
                n.node_type AS neighbor_type,
                e.edge_category,
                e.edge_type,
                e.support_score,
                e.weight,
                e.evidence_source
            FROM network_edges e
            JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE e.source = ? OR e.target = ?
            ORDER BY e.weight DESC, e.support_score DESC, n.label
            LIMIT 12
            """,
            [node_id, node_id, node_id, node_id],
        ).fetchall()
        evidence_source_rows = conn.execute(
            """
            SELECT evidence_source, COUNT(*) AS count
            FROM network_edges
            WHERE source = ? OR target = ?
            GROUP BY evidence_source
            ORDER BY count DESC, evidence_source
            LIMIT 12
            """,
            [node_id, node_id],
        ).fetchall()
        mechanism_snapshot = build_mechanism_snapshot(
            node_dict,
            to_dicts(mechanism_rows),
            to_dicts(evidence_source_rows),
        )
        related_context = build_related_context(conn, node_dict)
        algorithm_evidence = build_algorithm_evidence(conn, node_dict)
        ttd_evidence = build_ttd_node_evidence(node_dict)
        ncrna_evidence = build_ncrna_evidence(node_dict)
        ncrna_linked_results = build_ncrna_linked_released_results(conn, node_dict)

        if not include_neighbors:
            neighbor_rows = conn.execute(
                """
                SELECT
                    CASE WHEN e.source = ? THEN e.target ELSE e.source END AS neighbor_id,
                    n.label AS neighbor_label,
                    n.node_type AS neighbor_type,
                    e.edge_category,
                    e.edge_type,
                    e.support_score,
                    e.display_color
                FROM network_edges e
                JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
                WHERE e.source = ? OR e.target = ?
                ORDER BY e.weight DESC, e.support_score DESC
                LIMIT 200
                """,
                [node_id, node_id, node_id, node_id],
            ).fetchall()
            return {
                "node": node_dict,
                "annotation": annotation,
                "edge_stats": edge_stats_dicts,
                "multimodal_profile": multimodal_profile,
                "mechanism_snapshot": mechanism_snapshot,
                "related_context": related_context,
                "algorithm_evidence": algorithm_evidence,
                "ttd_evidence": ttd_evidence,
                "ncrna_evidence": ncrna_evidence,
                "ncrna_linked_results": ncrna_linked_results,
                "neighbors": to_dicts(neighbor_rows),
            }

        where = ["(e.source = ? OR e.target = ?)"]
        params: list[Any] = [node_id, node_id]
        categories = normalize_list(neighbor_edge_category)
        if categories:
            ph = ",".join(["?"] * len(categories))
            where.append(f"e.edge_category IN ({ph})")
            params.extend(categories)
        types = normalize_list(neighbor_edge_type)
        if types:
            ph = ",".join(["?"] * len(types))
            where.append(f"e.edge_type IN ({ph})")
            params.extend(types)
        if neighbor_q:
            kw = f"%{neighbor_q.strip()}%"
            where.append("(n.label LIKE ? OR n.id LIKE ?)")
            params.extend([kw, kw])

        where_sql = " AND ".join(where)
        total = conn.execute(
            f"""
            SELECT COUNT(*) AS n
            FROM network_edges e
            JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE {where_sql}
            """,
            [node_id, *params],
        ).fetchone()["n"]

        order_sql = {
            "weight_desc": "e.weight DESC, e.support_score DESC, n.label",
            "score_desc": "e.support_score DESC, e.weight DESC, n.label",
            "label_asc": "n.label ASC, e.weight DESC, e.support_score DESC",
        }.get(neighbor_order_by, "e.weight DESC, e.support_score DESC, n.label")

        offset = (neighbor_page - 1) * neighbor_page_size
        neighbor_rows = conn.execute(
            f"""
            SELECT
                CASE WHEN e.source = ? THEN e.target ELSE e.source END AS neighbor_id,
                n.label AS neighbor_label,
                n.node_type AS neighbor_type,
                e.edge_category,
                e.edge_type,
                e.support_score,
                e.display_color,
                e.weight
            FROM network_edges e
            JOIN network_nodes n ON n.id = CASE WHEN e.source = ? THEN e.target ELSE e.source END
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT ? OFFSET ?
            """,
            [node_id, node_id, *params, neighbor_page_size, offset],
        ).fetchall()

        return {
            "node": node_dict,
            "annotation": annotation,
            "edge_stats": edge_stats_dicts,
            "multimodal_profile": multimodal_profile,
            "mechanism_snapshot": mechanism_snapshot,
            "related_context": related_context,
            "algorithm_evidence": algorithm_evidence,
            "ttd_evidence": ttd_evidence,
            "ncrna_evidence": ncrna_evidence,
            "ncrna_linked_results": ncrna_linked_results,
            "neighbors_page": {
                "total": total,
                "page": neighbor_page,
                "page_size": neighbor_page_size,
                "items": to_dicts(neighbor_rows),
            },
        }
    finally:
        conn.close()


@app.get("/api/annotation/node/{node_id:path}")
def node_annotation(node_id: str) -> dict[str, Any]:
    conn = get_conn()
    try:
        node = conn.execute("SELECT id, node_type FROM network_nodes WHERE id = ?", [node_id]).fetchone()
        if not node:
            raise HTTPException(status_code=404, detail=f"Node not found: {node_id}")
        return {"annotation": get_node_annotation(conn, node["id"], node["node_type"])}
    finally:
        conn.close()


@app.get("/api/compare/drugs")
def compare_drugs(
    left_id: str = Query(min_length=1),
    right_id: str = Query(min_length=1),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        return build_drug_comparison(conn, left_id=left_id, right_id=right_id)
    finally:
        conn.close()


@app.get("/api/compare/drugs/subgraph")
def compare_drugs_subgraph(
    left_id: str = Query(min_length=1),
    right_id: str = Query(min_length=1),
) -> dict[str, Any]:
    conn = get_conn()
    try:
        return build_drug_compare_subgraph(conn, left_id=left_id, right_id=right_id)
    finally:
        conn.close()


@app.get("/api/path")
def shortest_path(
    source_id: str = Query(min_length=1),
    target_id: str = Query(min_length=1),
    max_hops: int = Query(default=4, ge=1, le=6),
    mode: str = Query(default="core", pattern="^(core|full)$"),
    edge_category: str | None = Query(default=None),
    edge_type: str | None = Query(default=None),
) -> dict[str, Any]:
    categories = set(normalize_list(edge_category))
    types = set(normalize_list(edge_type))
    conn = get_conn()
    try:
        source = conn.execute("SELECT id, label, node_type FROM network_nodes WHERE id = ?", [source_id]).fetchone()
        target = conn.execute("SELECT id, label, node_type FROM network_nodes WHERE id = ?", [target_id]).fetchone()
        if not source or not target:
            raise HTTPException(status_code=404, detail="Source or target node not found")
        if source_id == target_id:
            return {"found": True, "hops": 0, "nodes": [dict(source)], "edges": []}

        if mode == "core" and not has_core_source_table(conn):
            raise HTTPException(status_code=503, detail="Core mode source table is not available in current database")

        def extra_filter() -> tuple[str, list[Any]]:
            filters = []
            vals: list[Any] = []
            if categories:
                ph = ",".join(["?"] * len(categories))
                filters.append(f"edge_category IN ({ph})")
                vals.extend(sorted(categories))
            if types:
                ph = ",".join(["?"] * len(types))
                filters.append(f"edge_type IN ({ph})")
                vals.extend(sorted(types))
            if mode == "core":
                filters.append(core_mode_filter("e"))
            return (" AND " + " AND ".join(filters)) if filters else "", vals

        q = deque([(source_id, 0)])
        visited = {source_id}
        parent: dict[str, str] = {}
        parent_edge: dict[str, dict[str, Any]] = {}
        found = False
        edge_scan_cap = 12000
        scanned_edges = 0

        while q and not found:
            cur, depth = q.popleft()
            if depth >= max_hops:
                continue
            extra_sql, extra_vals = extra_filter()
            rows = conn.execute(
                f"""
                SELECT source, target, edge_category, edge_type, evidence_source,
                       weight, display_color, support_score, remark
                FROM network_edges e
                WHERE (e.source = ? OR e.target = ?)
                {extra_sql}
                ORDER BY weight DESC, support_score DESC
                LIMIT 2000
                """,
                [cur, cur, *extra_vals],
            ).fetchall()
            scanned_edges += len(rows)
            if scanned_edges > edge_scan_cap:
                break

            for r in rows:
                s, t = r["source"], r["target"]
                nb = t if s == cur else s
                if nb in visited:
                    continue
                visited.add(nb)
                parent[nb] = cur
                parent_edge[nb] = dict(r)
                if nb == target_id:
                    found = True
                    break
                q.append((nb, depth + 1))

        if not found:
            return {"found": False, "hops": None, "nodes": [], "edges": []}

        path_nodes = [target_id]
        while path_nodes[-1] != source_id:
            path_nodes.append(parent[path_nodes[-1]])
        path_nodes.reverse()

        edges = [parent_edge[nid] for nid in path_nodes[1:]]
        placeholders = ",".join(["?"] * len(path_nodes))
        node_rows = conn.execute(
            f"""
            SELECT id, label, node_type, display_name, source
            FROM network_nodes
            WHERE id IN ({placeholders})
            """,
            path_nodes,
        ).fetchall()
        node_map = {r["id"]: dict(r) for r in node_rows}
        nodes = [node_map[nid] for nid in path_nodes if nid in node_map]
        return {"found": True, "hops": len(edges), "nodes": nodes, "edges": edges}
    finally:
        conn.close()


@app.get("/api/graph")
def graph(
    center_id: str | None = Query(default=None),
    depth: int = Query(default=1, ge=1, le=2),
    limit: int = Query(default=300, ge=10, le=20000),
    mode: str = Query(default="core", pattern="^(core|full)$"),
    whole_graph: bool = Query(default=False),
    edge_category: str | None = Query(default=None),
    edge_type: str | None = Query(default=None),
) -> dict[str, Any]:
    categories = set(normalize_list(edge_category))
    types = set(normalize_list(edge_type))
    conn = get_conn()
    try:
        if mode == "core" and not has_core_source_table(conn):
            raise HTTPException(status_code=503, detail="Core mode source table is not available in current database")

        def category_type_filter() -> tuple[str, list[Any]]:
            filters = []
            fparams: list[Any] = []
            if categories:
                placeholders = ",".join(["?"] * len(categories))
                filters.append(f"e.edge_category IN ({placeholders})")
                fparams.extend(sorted(categories))
            if types:
                placeholders = ",".join(["?"] * len(types))
                filters.append(f"e.edge_type IN ({placeholders})")
                fparams.extend(sorted(types))
            if mode == "core":
                filters.append(core_mode_filter("e"))
            return (" AND " + " AND ".join(filters)) if filters else "", fparams

        if whole_graph:
            extra_filter, extra_params = category_type_filter()
            rows = conn.execute(
                f"""
                SELECT source, target, edge_category, edge_type, evidence_source,
                       weight, display_color, support_score, remark
                FROM network_edges e
                WHERE 1=1
                {extra_filter}
                ORDER BY weight DESC, support_score DESC
                LIMIT ?
                """,
                [*extra_params, limit],
            ).fetchall()
            edges = [dict(r) for r in rows]
            node_ids: set[str] = set()
            for e in edges:
                node_ids.add(e["source"])
                node_ids.add(e["target"])
            if node_ids:
                placeholders = ",".join(["?"] * len(node_ids))
                nodes = to_dicts(
                    conn.execute(
                        f"""
                        SELECT id, label, node_type, display_name, source
                        FROM network_nodes
                        WHERE id IN ({placeholders})
                        ORDER BY node_type, label
                        """,
                        sorted(node_ids),
                    ).fetchall()
                )
            else:
                nodes = []
            return {"center_id": "__ALL__", "depth": depth, "mode": mode, "whole_graph": True, "nodes": nodes, "edges": edges}

        if not center_id:
            raise HTTPException(status_code=422, detail="center_id is required unless whole_graph=true")
        center = conn.execute("SELECT id, label, node_type FROM network_nodes WHERE id = ?", [center_id]).fetchone()
        if not center:
            raise HTTPException(status_code=404, detail=f"Center node not found: {center_id}")

        frontier = {center_id}
        visited_frontier = {center_id}
        node_ids = {center_id}
        edge_map: dict[tuple[str, str, str, str], dict[str, Any]] = {}

        for _ in range(depth):
            if not frontier or len(edge_map) >= limit:
                break
            frontier_list = sorted(frontier)
            # Distribute budget across frontier nodes so one hub does not consume all edges.
            per_node_cap = max(4, min(80, limit // max(1, len(frontier_list))))
            extra_filter, extra_params = category_type_filter()
            next_frontier: set[str] = set()

            # Single batched IN-query per hop instead of one query per frontier node.
            ph = ",".join(["?"] * len(frontier_list))
            fetch_cap = max(limit * 4, per_node_cap * len(frontier_list) * 2)
            rows = conn.execute(
                f"""
                SELECT source, target, edge_category, edge_type, evidence_source,
                       weight, display_color, support_score, remark
                FROM network_edges e
                WHERE (e.source IN ({ph}) OR e.target IN ({ph}))
                {extra_filter}
                ORDER BY weight DESC, support_score DESC
                LIMIT ?
                """,
                [*frontier_list, *frontier_list, *extra_params, fetch_cap],
            ).fetchall()

            per_node_count: dict[str, int] = {fid: 0 for fid in frontier_list}
            for e in rows:
                if len(edge_map) >= limit:
                    break
                key = (e["source"], e["target"], e["edge_category"], e["edge_type"])
                if key in edge_map:
                    continue
                s, t = e["source"], e["target"]
                # Which frontier endpoint owns this edge (both may be in frontier).
                owner = s if s in per_node_count else t if t in per_node_count else None
                if owner is not None and per_node_count[owner] >= per_node_cap:
                    continue
                if owner is not None:
                    per_node_count[owner] += 1
                edge_map[key] = dict(e)
                if s not in node_ids:
                    next_frontier.add(s)
                if t not in node_ids:
                    next_frontier.add(t)
                node_ids.add(s)
                node_ids.add(t)

            frontier = next_frontier - visited_frontier
            visited_frontier |= frontier

        edges = list(edge_map.values())[:limit]
        # Bridge completion: densify subgraph by adding edges among already selected nodes.
        if len(edges) < limit and len(node_ids) > 1:
            remain = limit - len(edges)
            node_list = sorted(node_ids)
            ph = ",".join(["?"] * len(node_list))
            extra_filter, extra_params = category_type_filter()
            bridge_rows = conn.execute(
                f"""
                SELECT source, target, edge_category, edge_type, evidence_source,
                       weight, display_color, support_score, remark
                FROM network_edges e
                WHERE e.source IN ({ph}) AND e.target IN ({ph})
                {extra_filter}
                ORDER BY weight DESC, support_score DESC
                LIMIT ?
                """,
                [*node_list, *node_list, *extra_params, remain * 3],
            ).fetchall()
            for e in bridge_rows:
                key = (e["source"], e["target"], e["edge_category"], e["edge_type"])
                if key in edge_map:
                    continue
                edge_map[key] = dict(e)
                if len(edge_map) >= limit:
                    break
            edges = list(edge_map.values())[:limit]
        node_ids = {center_id}
        for e in edges:
            node_ids.add(e["source"])
            node_ids.add(e["target"])

        placeholders = ",".join(["?"] * len(node_ids))
        nodes = to_dicts(
            conn.execute(
                f"""
                SELECT id, label, node_type, display_name, source
                FROM network_nodes
                WHERE id IN ({placeholders})
                ORDER BY node_type, label
                """,
                sorted(node_ids),
            ).fetchall()
        )
        return {"center_id": center_id, "depth": depth, "mode": mode, "nodes": nodes, "edges": edges}
    finally:
        conn.close()


@app.get("/{full_path:path}")
def spa_fallback(full_path: str) -> Response:
    path = f"/{full_path}".rstrip("/")
    if path.startswith("/api") or path.startswith("/assets") or path.startswith("/static"):
        return Response(status_code=404)
    return FileResponse(STATIC_DIR / "index.html")
