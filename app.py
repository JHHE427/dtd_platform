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
DEFAULT_DB_PATH = "/Users/jhhe/Documents/dtdplat/dtd_network.sqlite"
DB_PATH = Path(os.environ.get("DTD_DB_PATH", DEFAULT_DB_PATH)).expanduser()
DEFAULT_ORIGINS = "http://127.0.0.1:8787,http://localhost:8787"
RESULTS_DTI_DIR = Path("/Users/jhhe/Downloads/resultsdti")
SEVEN_MODEL_FILE = RESULTS_DTI_DIR / "Candidates_withNames_andDisease_TXGNN.csv"
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
        path = request.url.path
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if path.startswith("/assets/") and resp.status_code == 200:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path in {"/", "/index.html"} and resp.status_code == 200:
            resp.headers["Cache-Control"] = "no-cache"
        return resp

app = FastAPI(title="DTD Atlas", version="1.0.0")
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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_list(values: str | None) -> list[str]:
    if not values:
        return []
    return [v.strip() for v in values.split(",") if v.strip()]


def to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


@lru_cache(maxsize=1)
def load_seven_model_lookup() -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    if not SEVEN_MODEL_FILE.exists():
        return lookup
    with SEVEN_MODEL_FILE.open("r", encoding="utf-8-sig", newline="") as handle:
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
                node_id, node_type, smiles, target_sequence, uniprot_accession, annotation_source, updated_at,
                text_description, side_effect_summary, ontology_terms, synonyms_json,
                target_summary, disease_summary, modality_sources_json
            FROM node_annotations
            WHERE node_id = ?
            """,
            [node_id],
        ).fetchone()
    except sqlite3.OperationalError:
        try:
            row = conn.execute(
                """
                SELECT node_id, node_type, smiles, target_sequence, uniprot_accession, annotation_source, updated_at
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
                "key": "predictions",
                "label": "Predicted Evidence",
                "available": counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0) > 0,
                "detail": f'{counts_by_type.get("Predicted", 0) + counts_by_type.get("Known+Predicted", 0)} predictive edges',
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
    by_neighbor_type: dict[str, list[dict[str, Any]]] = {"Drug": [], "Target": [], "Disease": []}
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
    if key_targets:
        context_summary.append(f"Key target context: {' | '.join(key_targets)}.")
    if key_diseases:
        context_summary.append(f"Key disease context: {' | '.join(key_diseases)}.")

    return {
        "node_type": node["node_type"],
        "top_links": top_links[:6],
        "by_neighbor_type": by_neighbor_type,
        "evidence_sources": evidence_sources[:6],
        "category_counts": category_counts,
        "type_counts": type_counts,
        "context_summary": context_summary,
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
        overview = {
            "nodes": conn.execute("SELECT COUNT(*) FROM network_nodes").fetchone()[0],
            "edges": conn.execute("SELECT COUNT(*) FROM network_edges").fetchone()[0],
            "drugs": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='Drug'").fetchone()[0],
            "targets": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='Target'").fetchone()[0],
            "diseases": conn.execute("SELECT COUNT(*) FROM network_nodes WHERE node_type='Disease'").fetchone()[0],
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
                "dataset": "High-confidence prediction set",
                "table": "src_highconfidence_expand_vote4_top50_tx07",
                "description": "Multi-model predicted Drug-Disease and Target-Disease candidates.",
            },
        ]
        for item in source_tables:
            table = item["table"]
            item["rows"] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

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

        if "Target_Name" in src_prediction_cols and "Target_Label" in src_prediction_cols:
            src_target_label_expr = "COALESCE(Target_Name, Target_Label, Target_ID)"
        elif "Target_Name" in src_prediction_cols:
            src_target_label_expr = "COALESCE(Target_Name, Target_ID)"
        elif "Target_Label" in src_prediction_cols:
            src_target_label_expr = "COALESCE(Target_Label, Target_ID)"
        else:
            src_target_label_expr = "Target_ID"

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
                        {src_drug_label_expr} AS drug_label,
                        ROW_NUMBER() OVER (
                            PARTITION BY {src_disease_id_expr}
                            ORDER BY
                                COUNT(*) DESC,
                                MAX(CAST(COALESCE(TXGNN_score, -1) AS REAL)) DESC,
                                {src_drug_label_expr}
                        ) AS rn
                    FROM src_highconfidence_expand_vote4_top50_tx07
                    GROUP BY disease_id, drug_label
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
                    dm.max_algo_pass,
                    dm.max_votes,
                    dm.top_txgnn_score,
                    dm.best_enr_fdr
                FROM drug_scope ds
                LEFT JOIN top_disease td ON td.drug_id = ds.drug_id AND td.rn = 1
                LEFT JOIN top_target tt ON tt.drug_id = ds.drug_id AND tt.rn = 1
                LEFT JOIN drug_metrics dm ON dm.drug_id = ds.drug_id
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
                    tm.max_algo_pass,
                    tm.max_votes,
                    tm.top_txgnn_score,
                    tm.best_enr_fdr
                FROM target_scope ts
                LEFT JOIN top_disease td ON td.target_id = ts.target_id AND td.rn = 1
                LEFT JOIN top_drug tg ON tg.target_id = ts.target_id AND tg.rn = 1
                LEFT JOIN target_metrics tm ON tm.target_id = ts.target_id
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

        pipeline_shrinkage = {
            "raw_dti_pairs": 18016322,
            "vote4_retained": 9912,
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
            {"name": "Pipeline shrinkage summary", "rows": 5, "description": "Scale reduction from raw DTI candidates to released atlas results."},
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
            raise HTTPException(status_code=404, detail=f"Released atlas node not found: {focus}")

        focus_type = focus_row["node_type"]
        focus_label = focus_row["display_name"]
        where_sql, params = build_online_analysis_where(
            focus=focus,
            focus_type=focus_type,
            min_algo_pass=min_algo_pass,
            min_votes=min_votes,
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
            raise HTTPException(status_code=404, detail=f"Released atlas node not found: {focus}")

        where_sql, params = build_online_analysis_where(
            focus=focus,
            focus_type=focus_row["node_type"],
            min_algo_pass=min_algo_pass,
            min_votes=min_votes,
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
        algorithm_evidence = build_algorithm_evidence(conn, node_dict)

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
                "algorithm_evidence": algorithm_evidence,
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
            "algorithm_evidence": algorithm_evidence,
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

            for fid in frontier_list:
                if len(edge_map) >= limit:
                    break
                rows = conn.execute(
                    f"""
                    SELECT source, target, edge_category, edge_type, evidence_source,
                           weight, display_color, support_score, remark
                    FROM network_edges e
                    WHERE (e.source = ? OR e.target = ?)
                    {extra_filter}
                    ORDER BY weight DESC, support_score DESC
                    LIMIT ?
                    """,
                    [fid, fid, *extra_params, per_node_cap],
                ).fetchall()

                for e in rows:
                    key = (e["source"], e["target"], e["edge_category"], e["edge_type"])
                    if key in edge_map:
                        continue
                    edge_map[key] = dict(e)
                    s, t = e["source"], e["target"]
                    if s not in node_ids:
                        next_frontier.add(s)
                    if t not in node_ids:
                        next_frontier.add(t)
                    node_ids.add(s)
                    node_ids.add(t)
                    if len(edge_map) >= limit:
                        break

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
