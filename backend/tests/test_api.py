"""G1 API tests: 0 machine calls, demo/replay, db migration, host checks."""
import ast
import socket
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db
from app.api import create_app


@pytest.fixture
def client(monkeypatch):
    # Hard guarantee: any outbound socket connect during API tests fails the test.
    real_connect, real_connect_ex = socket.socket.connect, socket.socket.connect_ex

    def guard(real):
        def inner(self, address, *a, **k):
            # Windows' asyncio loop uses a loopback socketpair internally; anything else is a failure.
            host = address[0] if isinstance(address, tuple) else address
            if host not in ("127.0.0.1", "::1"):
                raise AssertionError(f"non-loopback connect attempted: {address!r}")
            return real(self, address, *a, **k)
        return inner

    monkeypatch.setattr(socket.socket, "connect", guard(real_connect))
    monkeypatch.setattr(socket.socket, "connect_ex", guard(real_connect_ex))
    return TestClient(create_app(":memory:"))


def test_health_declares_no_machine_access(client):
    j = client.get("/api/v1/health").json()
    assert j["mode"] == "DEMO" and j["machine_access"] == "READ_ONLY_ON_CONSENT" and j["db_schema"] == len(db.MIGRATIONS)


def test_only_one_machine_route_and_no_transport_import():
    app = create_app(":memory:")
    paths = {getattr(r, "path", "") for r in app.routes}
    assert {p for p in paths if "printer" in p or "connect" in p or "live" in p} == {"/api/v1/live/capture"}
    src = Path(__file__).resolve().parents[1] / "app"
    for f in ("api.py", "db.py", "__main__.py"):
        tree = ast.parse((src / f).read_text(encoding="utf-8"))
        for n in ast.walk(tree):
            names = [a.name for a in n.names] if isinstance(n, ast.Import) else [n.module or ""] if isinstance(n, ast.ImportFrom) else []
            assert not any("transport" in x for x in names), f


def test_interpret_known_unknown_malformed(client):
    k = client.post("/api/v1/errors/interpret", json={"code": "0002-0525-0002-0002"}).json()
    assert k["source"] == "USER_REPORTED" and k["decoding"]["status"] == "KNOWN" and k["decoding"]["classification"] == "OBSERVED"
    assert "may not represent the actual fault" in " ".join(k["limits"])
    u = client.post("/api/v1/errors/interpret", json={"code": "0003-0529-0001-0009"}).json()
    assert u["decoding"]["status"] == "STRUCTURE_ONLY" and u["decoding"]["classification"] == "INCONCLUSIVE"
    m = client.post("/api/v1/errors/interpret", json={"code": "０００２-0525-0002-0002"}).json()
    assert m["decoding"]["status"] == "MALFORMED"
    assert client.post("/api/v1/errors/interpret", json={"code": "A" * 500}).status_code == 422
    assert client.post("/api/v1/errors/interpret", json={}).status_code == 422


def test_demo_banner_and_scenarios(client):
    j = client.get("/api/v1/demo/scenarios").json()
    assert "SYNTHETIC" in j["banner"] and len(j["scenarios"]) >= 8


@pytest.mark.parametrize("name", ["../../etc/passwd", "..%2f..%2fx", "Known", "nope", "a" * 200])
def test_scenario_name_cannot_escape(client, name):
    assert client.get(f"/api/v1/demo/scenarios/{name}").status_code in (404, 422)
    assert client.post("/api/v1/replays", json={"scenario": name}).status_code in (404, 422)


def test_replay_matches_golden_and_is_stored(client):
    names = client.get("/api/v1/demo/scenarios").json()["scenarios"]
    for n in names:
        r = client.post("/api/v1/replays", json={"scenario": n}).json()
        assert r["matches_golden"] is True and r["source_status"] == "REPLAYED_FROM_SYNTHETIC" and r["mode"] == "REPLAY"
    again = client.post("/api/v1/replays", json={"scenario": "known_code_feeder3"}).json()
    first = client.post("/api/v1/replays", json={"scenario": "known_code_feeder3"}).json()
    assert again["findings_sha256"] == first["findings_sha256"] and again["replay_id"] != first["replay_id"]


def test_wrong_host_header_rejected(client):
    assert client.get("/api/v1/health", headers={"host": "evil.example"}).status_code == 400


def test_docs_endpoints_disabled(client):
    for p in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(p).status_code == 404


def test_compatibility_claims_only_what_h01_h02_prove(client):
    j = client.get("/api/v1/compatibility").json()
    real = {c["name"] for c in j["capabilities"] if c["status"] == "TESTED_REAL"}
    assert real == {"Moonraker HTTP :7125", "Objects list / query", "WebSocket subscribe", "Official firmware version", "Deterministic replay"}
    never = {c["name"]: c["status"] for c in j["capabilities"] if c["name"] in ("Live error codes", "Toolhead 1-4 mapping")}
    assert set(never.values()) == {"UNTESTED"}
    assert all(r["errors_live"] == "UNTESTED" and r["toolhead_mapping"] == "UNTESTED" for r in j["rows"])
    assert [r["rest_readonly"] for r in j["rows"] if r["firmware"] == "V2.0.0"] == ["UNTESTED"]  # only the observed firmware is claimed


def test_real_capture_endpoint(client):
    j = client.get("/api/v1/real/captures/h02_normal_print").json()
    assert j["source_status"] == "REAL" and j["matches_golden"] is True and len(j["observations"]) == 50
    assert j["provenance"]["outbound_non_subscribe"] == 0
    assert client.get("/api/v1/real/captures/../x").status_code in (404, 422)
    assert client.get("/api/v1/real/captures/nope").status_code == 404


def test_migration_idempotent_and_refuses_newer_db(tmp_path):
    p = str(tmp_path / "a.sqlite3")
    c = db.connect(p)
    assert db.migrate(c) == len(db.MIGRATIONS)
    c.close()
    raw = sqlite3.connect(p)
    raw.execute("PRAGMA user_version=99")
    raw.commit()
    raw.close()
    with pytest.raises(RuntimeError):
        db.connect(p)


def test_main_binds_localhost_by_default_and_the_exe_always():
    app_dir = Path(__file__).resolve().parents[1]
    src = (app_dir / "app" / "__main__.py").read_text(encoding="utf-8")
    # default stays loopback; widening needs U1DOCTOR_HOST, which only the Docker image sets (and publishes on the host loopback)
    assert 'os.environ.get("U1DOCTOR_HOST", "127.0.0.1")' in src and "0.0.0.0" not in src
    exe = (app_dir / "app" / "desktop.py").read_text(encoding="utf-8")  # run_u1doctor.py only calls desktop.main()
    assert 'host="127.0.0.1"' in exe and "U1DOCTOR_HOST" not in exe and "0.0.0.0" not in exe
    assert "desktop" in (app_dir / "run_u1doctor.py").read_text(encoding="utf-8")
    docker = (app_dir.parent / "Dockerfile").read_text(encoding="utf-8")
    assert "U1DOCTOR_HOST=0.0.0.0" in docker and "-p 127.0.0.1:8765:8765" in docker


def test_bundle_export_then_import_roundtrip_via_api(client):
    for src in ("synthetic:known_code_feeder3", "real:h02_normal_print"):
        r = client.post("/api/v1/bundles/export", json={"source": src})
        assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
        res = client.post("/api/v1/bundles/import", content=r.content)
        assert res.status_code == 200
        body = res.json()
        assert body["source_status"] == "IMPORTED" and body["replay"]["matches_bundle"] is True


def test_bundle_api_refuses_bad_input(client):
    assert client.post("/api/v1/bundles/export", json={"source": "synthetic:../x"}).status_code == 404
    assert client.post("/api/v1/bundles/export", json={"source": "real:nope"}).status_code == 404
    bad = client.post("/api/v1/bundles/import", content=b"not a zip")
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "NOT_A_ZIP"


def test_bundle_preview_lists_real_hashes_and_privacy(client):
    r = client.post("/api/v1/bundles/preview", json={"source": "synthetic:known_code_feeder3"})
    assert r.status_code == 200
    j = r.json()
    assert j["manifest"]["format"] == "U1-DEB" and {f["name"] for f in j["manifest"]["files"]} >= {"observations.jsonl", "findings.json"}
    assert j["privacy"]["automatic_redaction_is_best_effort"] is True
    assert client.post("/api/v1/bundles/preview", json={"source": "x:y"}).status_code == 404


def test_timeline_endpoint_real_and_synthetic(client):
    r = client.get("/api/v1/timeline", params={"source": "real:h02_normal_print"})
    assert r.status_code == 200
    j = r.json()
    assert j["source_status"] == "REAL" and j["incident"] is None and j["integrity"] == "NO_GAP_RECORDED"
    s = client.get("/api/v1/timeline", params={"source": "synthetic:offline_gap"}).json()
    assert s["source_status"] == "SYNTHETIC" and s["gaps"]
    assert client.get("/api/v1/timeline", params={"source": "x:y"}).status_code == 404


def test_known_issues_endpoint(client):
    j = client.get("/api/v1/knowledge/known-issues").json()
    assert j["checked_at"] and {i["id"] for i in j["issues"]} >= {"KI-ORCA-DECIMAL-COMMA", "KI-NOZZLE-CLOG-LOAD"}
