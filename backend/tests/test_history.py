"""Persistent local history: provenance untouched, content-addressed ids, limits, migration from v1, routes."""
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db, deb, history
from app.api import create_app

APP = {"X-U1D": "1"}  # sent by the app's own front end on every non-GET request (CSRF guard)

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))


def load(p: str) -> list[dict]:
    return [json.loads(x) for x in (ROOT / p).read_text(encoding="utf-8").splitlines()]


SYN = load("fixtures/synthetic/synthetic_demo_extrusion_blockage.observations.jsonl")
REAL = load("fixtures/real/real_h02_normal_print.observations.jsonl")


@pytest.fixture
def conn():
    c = db.connect(":memory:")
    yield c
    c.close()


def test_save_roundtrip_keeps_every_observation_untouched(conn):
    s, already = history.save(conn, REAL, "real_capture", "H-02", "x")
    assert not already and s["observation_count"] == len(REAL) and s["status_mix"] == ["REAL"]
    back = history.observations(conn, s["id"])
    assert back == sorted(REAL, key=lambda o: (o["capture_utc"], o["observation_id"]))


def test_provenance_is_never_upgraded(conn):
    s, _ = history.save(conn, SYN, "synthetic", None, "demo")
    assert s["status_mix"] == ["SYNTHETIC"] and all(o["source_status"] == "SYNTHETIC" for o in history.observations(conn, s["id"]))


def test_same_content_same_id_and_not_duplicated(conn):
    a, first = history.save(conn, REAL, "real_capture", "one", "x")
    b, again = history.save(conn, list(reversed(REAL)), "real_capture", "other label", "x")
    assert a["id"] == b["id"] and not first and again
    assert history.list_sessions(conn)["totals"] == {"sessions": 1, "observations": len(REAL)}


def test_label_is_cleaned_and_defaulted(conn):
    s, _ = history.save(conn, SYN, "synthetic", "  a\x00b\x1fc  " + "z" * 200, "default")
    assert "\x00" not in s["label"] and len(s["label"]) <= 80 and s["label"].startswith("a b c")
    s2, _ = history.save(conn, REAL, "real_capture", "   ", "fallback")
    assert s2["label"] == "fallback"


@pytest.mark.parametrize("mut,code", [(lambda o: [], "EMPTY"), (lambda o: [{**o[0], "schema_version": "9"}], "BAD_OBSERVATION"), (lambda o: [o[0], o[0]], "BAD_OBSERVATION")])
def test_refuses_bad_input(conn, mut, code):
    with pytest.raises(history.HistoryError) as e:
        history.save(conn, mut(list(SYN)), "synthetic", None, "x")
    assert e.value.code == code


def test_unknown_origin_refused(conn):
    with pytest.raises(history.HistoryError):
        history.save(conn, SYN, "live", None, "x")


def test_limits(conn, monkeypatch):
    monkeypatch.setattr(history, "MAX_SESSIONS", 1)
    history.save(conn, SYN, "synthetic", None, "a")
    with pytest.raises(history.HistoryError) as e:
        history.save(conn, REAL, "real_capture", None, "b")
    assert e.value.code == "HISTORY_FULL"


def test_delete_cascades_observations(conn):
    s, _ = history.save(conn, SYN, "synthetic", None, "x")
    assert history.delete(conn, s["id"]) and not history.delete(conn, s["id"])
    assert conn.execute("SELECT COUNT(*) FROM history_observations").fetchone()[0] == 0


def test_migration_from_v1_keeps_existing_data(tmp_path):
    p = str(tmp_path / "old.sqlite3")
    raw = sqlite3.connect(p)
    raw.executescript("BEGIN;" + db.MIGRATIONS[0] + "PRAGMA user_version=1;COMMIT;")
    raw.execute("INSERT INTO replays(created_at,scenario,source_mix,ruleset_hash,input_sha256,findings_sha256,matches_golden) VALUES ('t','s','SYNTHETIC','h','i','f',1)")
    raw.commit()
    raw.close()
    c = db.connect(p)
    assert db.schema_version(c) == len(db.MIGRATIONS) and c.execute("SELECT COUNT(*) FROM replays").fetchone()[0] == 1
    c.execute("SELECT COUNT(*) FROM history_sessions").fetchone()


def test_history_survives_a_restart(tmp_path):
    p = str(tmp_path / "h.sqlite3")
    c = db.connect(p)
    sid = history.save(c, REAL, "real_capture", "kept", "x")[0]["id"]
    c.close()
    c2 = db.connect(p)
    assert history.get(c2, sid)["label"] == "kept" and len(history.observations(c2, sid)) == len(REAL)


# ---- routes ---------------------------------------------------------------
@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(str(tmp_path / "t.sqlite3")), base_url="http://127.0.0.1", headers=APP)


def test_routes_save_list_timeline_delete(client):
    r = client.post("/api/v1/history/source", json={"source": "real:h02_normal_print", "label": "my capture"})
    assert r.status_code == 200 and not r.json()["already_saved"]
    sid = r.json()["session"]["id"]
    assert client.post("/api/v1/history/source", json={"source": "real:h02_normal_print"}).json()["already_saved"] is True
    lst = client.get("/api/v1/history").json()
    assert lst["totals"]["sessions"] == 1 and lst["sessions"][0]["label"] == "my capture"
    tl = client.get(f"/api/v1/timeline?source=history:{sid}").json()
    assert tl["source_status"] == "REAL" and tl["history"]["id"] == sid and tl["observation_count"] == len(REAL)
    assert client.delete(f"/api/v1/history/{sid}").json() == {"deleted": sid}
    assert client.get(f"/api/v1/history/{sid}").status_code == 404


def test_routes_bundle_and_dryrun(client):
    blob = deb.export_bundle(SYN, RS, app_version="t", generated_at="2026-11-06T00:00:00Z")
    b = client.post("/api/v1/history/bundle?label=bundle%20one", content=blob)
    assert b.status_code == 200 and b.json()["session"]["origin"] == "bundle"
    tl = client.get(f"/api/v1/timeline?source=history:{b.json()['session']['id']}").json()
    assert tl["source_status"] == "IMPORTED"
    rep = {"file": "x.gcode", "moves": 3, "tool_changes": 0, "errors": [], "scars": []}
    d = client.post("/api/v1/history/dryrun", content=json.dumps(rep).encode())
    assert d.status_code == 200 and d.json()["session"]["origin"] == "dryrun"
    assert client.post("/api/v1/history/bundle", content=b"nope").status_code == 422
    assert client.post("/api/v1/history/dryrun", content=b"[]").status_code == 422


def test_routes_refuse_bad_ids_and_sources(client):
    for bad in ("history:../x", "history:h000000000000", "history:"):
        assert client.get(f"/api/v1/timeline?source={bad}").status_code == 404
    assert client.delete("/api/v1/history/not-an-id").status_code == 404
    assert client.post("/api/v1/history/source", json={"source": "synthetic:../x"}).status_code == 404


def test_route_history_findings_recomputed_per_session(client):
    rep = {"file": "x.gcode", "moves": 3, "tool_changes": 0, "errors": [{"line": 5, "message": "Move out of range"}], "scars": []}
    sid = client.post("/api/v1/history/dryrun", content=json.dumps(rep).encode()).json()["session"]["id"]
    r = client.get(f"/api/v1/history/{sid}/findings").json()
    assert r["session"]["id"] == sid and r["ruleset"]["id"] == "u1-starter"
    assert [f["rule_id"] for f in r["findings"] if f["rule_id"] == "U1-S15-DRYRUN-PREDICTION"] == ["U1-S15-DRYRUN-PREDICTION"]
    assert client.get("/api/v1/history/h000000000000/findings").status_code == 404
    assert client.get("/api/v1/history/not-an-id/findings").status_code == 404


def test_fractional_and_whole_second_timestamps_sort_by_instant(conn):
    # BACKLOG #53 M1: as text "10:00:00.5Z" < "10:00:00Z" ("." < "Z"); the instant order must win
    from app.engine import sort_observations

    base = dict(REAL[0])
    late = {**base, "observation_id": "real_t_a", "capture_utc": "2026-11-05T10:00:00.5Z"}
    early = {**base, "observation_id": "real_t_b", "capture_utc": "2026-11-05T10:00:00Z"}
    assert [o["observation_id"] for o in sort_observations([late, early])] == ["real_t_b", "real_t_a"]
    s, _ = history.save(conn, [late, early], "real_capture", None, "x")
    assert s["first_utc"] == "2026-11-05T10:00:00Z" and s["last_utc"] == "2026-11-05T10:00:00.5Z"
    assert [o["observation_id"] for o in history.observations(conn, s["id"])] == ["real_t_b", "real_t_a"]


def test_concurrent_saves_of_the_same_content_make_one_session(tmp_path):
    # BACKLOG #52 L2: one connection shared by the server threads; check + insert must be atomic
    import threading

    c = db.connect(str(tmp_path / "t.sqlite3"))
    results: list = []
    start = threading.Barrier(8)

    def worker():
        start.wait()
        results.append(history.save(c, SYN, "synthetic", None, "x"))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(30)
    assert len(results) == 8 and len({s["id"] for s, _ in results}) == 1
    assert sorted(already for _, already in results) == [False] + [True] * 7
    assert history.list_sessions(c)["totals"]["sessions"] == 1
    c.close()


def test_unique_violation_from_another_connection_is_the_duplicate_path(tmp_path):
    # Another process saved the same content between our check and our insert: answer "already saved", not a 500
    path = str(tmp_path / "t.sqlite3")
    other, mine = db.connect(path), db.connect(path)

    class Racy:
        """Hides the row on the first duplicate check, as if the other save landed just after it."""

        def __init__(self, inner):
            self.inner, self.hidden = inner, True

        def execute(self, sql, *a):
            if self.hidden and sql.startswith("SELECT * FROM history_sessions WHERE id=?"):
                self.hidden = False
                history.save(other, SYN, "synthetic", None, "x")
                return self.inner.execute("SELECT * FROM history_sessions WHERE 0")
            return self.inner.execute(sql, *a)

        def __getattr__(self, name):
            return getattr(self.inner, name)

        def __enter__(self):
            return self.inner.__enter__()

        def __exit__(self, *exc):
            return self.inner.__exit__(*exc)

    session, already = history.save(Racy(mine), SYN, "synthetic", None, "x")
    assert already is True and history.list_sessions(mine)["totals"]["sessions"] == 1
    assert history.observations(mine, session["id"]) == history.observations(other, session["id"])
    other.close()
    mine.close()
