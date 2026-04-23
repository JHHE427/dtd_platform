#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import shutil
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path


DEFAULT_DB = Path("/Users/jhhe/Documents/Playground/dtd_vote2_formal_build/dtd_network_vote2_formal.sqlite")
DEFAULT_RESULTS = Path("/Users/jhhe/Downloads/resultsdti/Candidates_withNames_andDisease_TXGNN.csv")
AUDIT_TABLE = "src_expanded_dti_candidates_txgnn"
FORMAL_TABLE = "src_highconfidence_expand_vote4_top50_tx07"
RESULTS_SOURCE = "Candidates_withNames_andDisease_TXGNN.csv"


def norm(text: object) -> str:
    value = str(text or "").strip().casefold()
    value = value.replace("(disease)", "")
    value = value.replace("_", " ").replace("-", " ")
    return " ".join(value.split())


def clean_text(text: object) -> str:
    value = str(text or "").strip()
    return "" if value.lower() in {"nan", "none", "na", "n/a", "<na>"} else value


def as_int(text: object, default: int = 0) -> int:
    try:
        return int(float(str(text).strip()))
    except (TypeError, ValueError):
        return default


def as_float(text: object) -> float | None:
    try:
        value = float(str(text).strip())
    except (TypeError, ValueError):
        return None
    return value if value == value else None


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
        return list(csv.DictReader(handle))


def disease_lookup(conn: sqlite3.Connection) -> dict[str, tuple[str, str]]:
    lookup: dict[str, tuple[str, str]] = {}
    for disease_id, label, display_name in conn.execute(
        "SELECT id, label, display_name FROM network_nodes WHERE node_type='Disease'"
    ):
        name = clean_text(display_name or label or str(disease_id).removeprefix("DIS::"))
        if name:
            lookup.setdefault(norm(name), (str(disease_id), name))
            lookup.setdefault(norm(str(disease_id).removeprefix("DIS::")), (str(disease_id), name))
    try:
        for disease_id, alias, canonical in conn.execute(
            "SELECT disease_id, alias, canonical_name FROM disease_aliases"
        ):
            name = clean_text(canonical or str(disease_id).removeprefix("DIS::"))
            if alias and name:
                lookup.setdefault(norm(alias), (str(disease_id), name))
    except sqlite3.OperationalError:
        pass
    return lookup


def existing_formal_keys(conn: sqlite3.Connection, lookup: dict[str, tuple[str, str]]) -> set[tuple[str, str, str]]:
    keys: set[tuple[str, str, str]] = set()
    for row in conn.execute(f"SELECT Drug_ID, Target_ID, Ensemble_Disease_Name FROM {FORMAL_TABLE}"):
        drug_id, target_id, disease_name = row
        canonical = lookup.get(norm(disease_name), ("", clean_text(disease_name)))[1]
        keys.add((clean_text(drug_id), clean_text(target_id), norm(canonical)))
    return keys


def current_nodes(conn: sqlite3.Connection, node_type: str) -> set[str]:
    return {str(row[0]) for row in conn.execute("SELECT id FROM network_nodes WHERE node_type=?", (node_type,))}


def ensure_candidate_nodes(conn: sqlite3.Connection, rows: list[dict[str, str]], lookup: dict[str, tuple[str, str]]) -> dict[str, int]:
    drugs = current_nodes(conn, "Drug")
    targets = current_nodes(conn, "Target")
    diseases = current_nodes(conn, "Disease")
    inserted = {"Drug": 0, "Target": 0, "Disease": 0}
    for row in rows:
        drug_id = clean_text(row.get("Drug_ID"))
        if drug_id and drug_id not in drugs:
            label = clean_text(row.get("Drug_Name")) or drug_id
            conn.execute(
                "INSERT OR IGNORE INTO network_nodes(id,label,node_type,display_name,source) VALUES(?,?,?,?,?)",
                (drug_id, label, "Drug", label, "expanded_dti_candidate"),
            )
            drugs.add(drug_id)
            inserted["Drug"] += 1
        target_id = clean_text(row.get("Target_ID"))
        if target_id and target_id not in targets:
            label = clean_text(row.get("target_name")) or clean_text(row.get("gene_name")) or target_id
            conn.execute(
                "INSERT OR IGNORE INTO network_nodes(id,label,node_type,display_name,source) VALUES(?,?,?,?,?)",
                (target_id, label, "Target", label, "expanded_dti_candidate"),
            )
            targets.add(target_id)
            inserted["Target"] += 1
        disease_raw = clean_text(row.get("Predicted_Disease_TXGNN"))
        disease_id, disease_label = lookup.get(norm(disease_raw), (f"DIS::{disease_raw}", disease_raw))
        if disease_id and disease_id not in diseases:
            conn.execute(
                "INSERT OR IGNORE INTO network_nodes(id,label,node_type,display_name,source) VALUES(?,?,?,?,?)",
                (disease_id, disease_label, "Disease", disease_label, "expanded_dti_candidate"),
            )
            diseases.add(disease_id)
            lookup.setdefault(norm(disease_label), (disease_id, disease_label))
            inserted["Disease"] += 1
    return inserted


def recreate_audit_table(conn: sqlite3.Connection, rows: list[dict[str, str]], statuses: dict[int, tuple[str, str, str, str]]) -> None:
    conn.execute(f"DROP TABLE IF EXISTS {AUDIT_TABLE}")
    conn.execute(
        f"""
        CREATE TABLE {AUDIT_TABLE} (
            Drug_ID TEXT,
            Target_ID TEXT,
            pair_id TEXT,
            Core5_Votes INTEGER,
            Optional_Votes INTEGER,
            Total_Votes_Optional7 INTEGER,
            Supporting_Models TEXT,
            graphdta_score REAL,
            dtiam_score REAL,
            drugban_score REAL,
            deeppurpose_score REAL,
            deepdtagan_score REAL,
            moltrans_score REAL,
            conplex_score REAL,
            Drug_Name TEXT,
            Drug_Type TEXT,
            target_name TEXT,
            gene_name TEXT,
            uniprot_accession TEXT,
            organism TEXT,
            Predicted_Disease_TXGNN TEXT,
            Disease_Probability_TXGNN REAL,
            Disease_Type_TXGNN TEXT,
            canonical_disease_id TEXT,
            canonical_disease_name TEXT,
            formal_expansion_status TEXT,
            formal_expansion_reason TEXT
        )
        """
    )
    insert_sql = f"""
        INSERT INTO {AUDIT_TABLE} VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
    """
    payload = []
    for idx, row in enumerate(rows):
        disease_id, disease_label, status, reason = statuses[idx]
        payload.append(
            (
                clean_text(row.get("Drug_ID")),
                clean_text(row.get("Target_ID")),
                clean_text(row.get("pair_id")),
                as_int(row.get("Core5_Votes")),
                as_int(row.get("Optional_Votes")),
                as_int(row.get("Total_Votes_Optional7")),
                clean_text(row.get("Supporting_Models")),
                as_float(row.get("graphdta_score")),
                as_float(row.get("dtiam_score")),
                as_float(row.get("drugban_score")),
                as_float(row.get("deeppurpose_score")),
                as_float(row.get("deepdtagan_score")),
                as_float(row.get("moltrans_score")),
                as_float(row.get("conplex_score")),
                clean_text(row.get("Drug_Name")),
                clean_text(row.get("Drug_Type")),
                clean_text(row.get("target_name")),
                clean_text(row.get("gene_name")),
                clean_text(row.get("uniprot_accession")),
                clean_text(row.get("organism")),
                clean_text(row.get("Predicted_Disease_TXGNN")),
                as_float(row.get("Disease_Probability_TXGNN")),
                clean_text(row.get("Disease_Type_TXGNN")),
                disease_id,
                disease_label,
                status,
                reason,
            )
        )
    conn.executemany(insert_sql, payload)
    conn.execute(f"CREATE INDEX idx_{AUDIT_TABLE}_pair ON {AUDIT_TABLE}(Drug_ID, Target_ID)")
    conn.execute(f"CREATE INDEX idx_{AUDIT_TABLE}_disease ON {AUDIT_TABLE}(canonical_disease_name)")
    conn.execute(f"CREATE INDEX idx_{AUDIT_TABLE}_status ON {AUDIT_TABLE}(formal_expansion_status)")


def insert_formal_rows(conn: sqlite3.Connection, rows: list[dict[str, str]], statuses: dict[int, tuple[str, str, str, str]]) -> int:
    insert_sql = f"""
        INSERT INTO {FORMAL_TABLE} (
            Drug_ID, Drug_Name, Target_ID, target_name, gene_name,
            Total_Votes_Optional7, pair_id, Ensemble_Disease_Name,
            n_algo_pass, TXGNN_pass, ENR_pass, RWR_pass,
            TXGNN_score, ENR_FDR, score_RWR, support_pattern
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """
    payload = []
    for idx, row in enumerate(rows):
        disease_id, disease_label, status, _reason = statuses[idx]
        if status != "added_to_formal":
            continue
        total_votes = as_int(row.get("Total_Votes_Optional7"))
        txgnn_score = as_float(row.get("Disease_Probability_TXGNN"))
        payload.append(
            (
                clean_text(row.get("Drug_ID")),
                clean_text(row.get("Drug_Name")),
                clean_text(row.get("Target_ID")),
                clean_text(row.get("target_name")),
                clean_text(row.get("gene_name")),
                total_votes,
                clean_text(row.get("pair_id")) or f"{clean_text(row.get('Drug_ID'))}|{clean_text(row.get('Target_ID'))}",
                disease_label,
                1,
                1,
                0,
                0,
                txgnn_score,
                None,
                None,
                f"TXGNN disease candidate + {total_votes}/7 DTI model vote",
            )
        )
    conn.executemany(insert_sql, payload)
    return len(payload)


def edge_exists(conn: sqlite3.Connection) -> set[tuple[str, str, str, str]]:
    return {
        (str(source), str(target), str(category), str(edge_type))
        for source, target, category, edge_type in conn.execute(
            "SELECT source,target,edge_category,edge_type FROM network_edges"
        )
    }


def insert_edges(conn: sqlite3.Connection, rows: list[dict[str, str]], statuses: dict[int, tuple[str, str, str, str]]) -> dict[str, int]:
    existing = edge_exists(conn)
    edges: dict[tuple[str, str, str, str], dict[str, object]] = {}

    def add_edge(source: str, target: str, category: str, edge_type: str, score: float | int | None, remark: str) -> None:
        if not source or not target:
            return
        key = (source, target, category, edge_type)
        if key in existing:
            return
        cur = edges.get(key)
        if cur is None:
            edges[key] = {
                "source": source,
                "target": target,
                "edge_category": category,
                "edge_type": edge_type,
                "evidence_source": RESULTS_SOURCE,
                "weight": 1,
                "display_color": "orange" if category == "Drug-Target" else "lightgreen" if category == "Drug-Disease" else "pink",
                "support_score": score,
                "remark": remark,
                "rows": 1,
            }
            return
        cur["rows"] = int(cur["rows"]) + 1
        old_score = cur.get("support_score")
        if isinstance(score, (int, float)) and (old_score is None or float(score) > float(old_score)):
            cur["support_score"] = score

    pair_votes: dict[tuple[str, str], int] = {}
    pair_models: dict[tuple[str, str], str] = {}
    drug_disease_scores: dict[tuple[str, str], list[float]] = defaultdict(list)
    target_disease_scores: dict[tuple[str, str], list[float]] = defaultdict(list)

    for idx, row in enumerate(rows):
        disease_id, disease_label, status, _reason = statuses[idx]
        if status != "added_to_formal":
            continue
        drug_id = clean_text(row.get("Drug_ID"))
        target_id = clean_text(row.get("Target_ID"))
        total_votes = as_int(row.get("Total_Votes_Optional7"))
        txgnn_score = as_float(row.get("Disease_Probability_TXGNN"))
        pair = (drug_id, target_id)
        pair_votes[pair] = max(pair_votes.get(pair, 0), total_votes)
        pair_models[pair] = clean_text(row.get("Supporting_Models"))
        if txgnn_score is not None:
            drug_disease_scores[(drug_id, disease_id)].append(txgnn_score)
            target_disease_scores[(target_id, disease_id)].append(txgnn_score)

    for (drug_id, target_id), total_votes in pair_votes.items():
        add_edge(
            drug_id,
            target_id,
            "Drug-Target",
            "Predicted",
            total_votes,
            f"expanded_resultsdti;max_votes={total_votes};models={pair_models.get((drug_id, target_id), '')}",
        )
    for (drug_id, disease_id), scores in drug_disease_scores.items():
        add_edge(
            drug_id,
            disease_id,
            "Drug-Disease",
            "Predicted",
            max(scores),
            f"expanded_resultsdti;rows={len(scores)};txgnn_disease_probability={max(scores):.4g}",
        )
    for (target_id, disease_id), scores in target_disease_scores.items():
        add_edge(
            target_id,
            disease_id,
            "Target-Disease",
            "Predicted",
            max(scores),
            f"expanded_resultsdti;rows={len(scores)};txgnn_disease_probability={max(scores):.4g}",
        )

    payload = [
        (
            edge["source"],
            edge["target"],
            edge["edge_category"],
            edge["edge_type"],
            edge["evidence_source"],
            edge["weight"],
            edge["display_color"],
            edge["support_score"],
            edge["remark"],
        )
        for edge in edges.values()
    ]
    conn.executemany(
        """
        INSERT INTO network_edges(source,target,edge_category,edge_type,evidence_source,weight,display_color,support_score,remark)
        VALUES(?,?,?,?,?,?,?,?,?)
        """,
        payload,
    )
    counts: dict[str, int] = defaultdict(int)
    for edge in edges.values():
        counts[f"{edge['edge_category']}|{edge['edge_type']}"] += 1
    return dict(counts)


def run(db_path: Path, results_csv: Path, backup: bool = True) -> dict[str, object]:
    if not db_path.exists():
        raise FileNotFoundError(db_path)
    if not results_csv.exists():
        raise FileNotFoundError(results_csv)
    backup_path = None
    if backup:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = db_path.parent / f"backup_before_resultsdti_expand_{stamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / db_path.name
        shutil.copy2(db_path, backup_path)

    rows = load_rows(results_csv)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys=OFF")
        lookup = disease_lookup(conn)
        ensure_inserted = ensure_candidate_nodes(conn, rows, lookup)
        existing_keys = existing_formal_keys(conn, lookup)
        statuses: dict[int, tuple[str, str, str, str]] = {}
        seen_new: set[tuple[str, str, str]] = set()
        for idx, row in enumerate(rows):
            disease_id, disease_label = lookup.get(norm(row.get("Predicted_Disease_TXGNN")), ("", ""))
            key = (clean_text(row.get("Drug_ID")), clean_text(row.get("Target_ID")), norm(disease_label))
            if not disease_id or not disease_label:
                statuses[idx] = ("", "", "skipped", "disease_not_mapped")
            elif not key[0] or not key[1]:
                statuses[idx] = (disease_id, disease_label, "skipped", "missing_drug_or_target_id")
            elif key in existing_keys:
                statuses[idx] = (disease_id, disease_label, "already_present", "drug_target_disease_key_exists")
            elif key in seen_new:
                statuses[idx] = (disease_id, disease_label, "duplicate_candidate", "duplicate_within_candidate_file")
            else:
                statuses[idx] = (disease_id, disease_label, "added_to_formal", "new_drug_target_disease_key")
                seen_new.add(key)
        recreate_audit_table(conn, rows, statuses)
        inserted_formal = insert_formal_rows(conn, rows, statuses)
        inserted_edges = insert_edges(conn, rows, statuses)
        conn.commit()
        try:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        except sqlite3.OperationalError:
            # A live local reader can keep WAL open; committed data remains valid.
            pass

        status_counts: dict[str, int] = defaultdict(int)
        for _disease_id, _disease_label, status, _reason in statuses.values():
            status_counts[status] += 1
        summary = {
            "db_path": str(db_path),
            "results_csv": str(results_csv),
            "backup_path": str(backup_path) if backup_path else None,
            "candidate_rows": len(rows),
            "status_counts": dict(status_counts),
            "inserted_formal_rows": inserted_formal,
            "inserted_nodes": ensure_inserted,
            "inserted_edges": inserted_edges,
            "formal_rows_after": conn.execute(f"SELECT COUNT(*) FROM {FORMAL_TABLE}").fetchone()[0],
            "network_nodes_after": conn.execute("SELECT COUNT(*) FROM network_nodes").fetchone()[0],
            "network_edges_after": conn.execute("SELECT COUNT(*) FROM network_edges").fetchone()[0],
        }
        return summary
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Expand the formal DTD SQLite release with resultsdti TXGNN disease candidates.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--results", type=Path, default=DEFAULT_RESULTS)
    parser.add_argument("--no-backup", action="store_true")
    parser.add_argument("--summary", type=Path)
    args = parser.parse_args()
    summary = run(args.db, args.results, backup=not args.no_backup)
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    if args.summary:
        args.summary.parent.mkdir(parents=True, exist_ok=True)
        args.summary.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
