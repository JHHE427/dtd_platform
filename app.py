#!/usr/bin/env python3
from __future__ import annotations

import os
import json
import sqlite3
from collections import deque
from pathlib import Path
from typing import Any

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
