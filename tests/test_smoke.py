"""Smoke tests for critical DTD Atlas endpoints.

Run with:
    DTD_DB_PATH=/path/to/dtd_network_vote2_formal.sqlite pytest -q
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure DB path is set before importing app.
if not os.environ.get("DTD_DB_PATH"):
    default = Path(__file__).resolve().parents[2] / "dtd_vote2_formal_build" / "dtd_network_vote2_formal.sqlite"
    if default.exists():
        os.environ["DTD_DB_PATH"] = str(default)

import app as dtd_app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(dtd_app.app) as c:
        yield c


def _skip_if_no_db():
    path = dtd_app.DB_PATH
    if not Path(path).exists():
        pytest.skip(f"DB not present at {path}")


def test_health(client):
    _skip_if_no_db()
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("nodes", 0) > 0
    assert data.get("edges", 0) > 0


def test_ready(client):
    _skip_if_no_db()
    r = client.get("/api/ready")
    assert r.status_code == 200


def test_meta_stats(client):
    _skip_if_no_db()
    r = client.get("/api/meta/stats")
    assert r.status_code == 200
    data = r.json()
    assert "node_by_type" in data and "edge_by_type" in data


def test_nodes_listing(client):
    _skip_if_no_db()
    r = client.get("/api/nodes?page=1&page_size=5")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and isinstance(data["items"], list)


def test_edges_listing(client):
    _skip_if_no_db()
    r = client.get("/api/edges?page=1&page_size=5")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("items"), list)


def test_search(client):
    _skip_if_no_db()
    r = client.get("/api/search?q=drug&limit=3")
    assert r.status_code == 200


def test_graph_center_required(client):
    _skip_if_no_db()
    r = client.get("/api/graph")
    # Without center_id and whole_graph, server should reject.
    assert r.status_code in (422, 400)


def test_graph_with_center(client):
    _skip_if_no_db()
    # Pick a real node id to use as center.
    conn = sqlite3.connect(str(dtd_app.DB_PATH))
    try:
        row = conn.execute("SELECT id FROM network_nodes LIMIT 1").fetchone()
    finally:
        conn.close()
    if not row:
        pytest.skip("network_nodes is empty")
    center_id = row[0]
    r = client.get(f"/api/graph?center_id={center_id}&mode=full&depth=1&limit=50")
    assert r.status_code == 200
    data = r.json()
    assert data["center_id"] == center_id
    assert isinstance(data.get("nodes"), list)
    assert isinstance(data.get("edges"), list)


def test_pragma_readonly():
    """get_conn should return a read-only connection that rejects writes."""
    _skip_if_no_db()
    conn = dtd_app.get_conn()
    try:
        with pytest.raises(sqlite3.OperationalError):
            conn.execute("CREATE TABLE __smoke_test_should_fail (x INTEGER)")
    finally:
        conn.close()
