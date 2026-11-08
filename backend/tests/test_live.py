"""Live capture route: consent, read-only audit, no address in output. Network is always mocked."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient

import app.live as live
from app.api import create_app

APP = {"X-U1D": "1"}  # sent by the app's own front end on every non-GET request (CSRF guard)

HOST = "192.168.50.20"


def handler(req: httpx.Request) -> httpx.Response:
    assert req.method == "GET"
    return {
        "/server/info": httpx.Response(200, json={"result": {"moonraker_version": "v0.9", "klippy_state": "ready", "hostname": "secret-host"}}),
        "/printer/info": httpx.Response(200, json={"result": {"state": "ready", "software_version": "v1", "hostname": "secret-host"}}),
        "/printer/objects/list": httpx.Response(200, json={"result": {"objects": ["toolhead", "extruder"]}}),
        "/server/files/directory": httpx.Response(200, json={"result": {"files": [{"filename": "secret_klippy.log"}], "dirs": [],
                                                                         "disk_usage": {"total": 104857600, "used": 52428800, "free": 52428800}}}),
        "/server/history/totals": httpx.Response(200, json={"result": {"job_totals": {"total_jobs": 3, "total_time": 11748.08, "total_print_time": 11348.79,
                                                                                "total_filament_used": 11615.72, "longest_job": 11665.19},
                                                                 "auxiliary_totals": [{"provider": "secret_sensor", "field": "x", "maximum": 1, "total": 1}]}}),
    }[req.url.path]


class Conn:
    def __init__(self, frames):
        self.sent, self.frames = [], list(frames)

    def send(self, m):
        self.sent.append(m)

    def recv(self, timeout=None):
        if not self.frames:
            raise TimeoutError
        return json.dumps(self.frames.pop(0))

    def close(self):
        pass


def frames():
    st = {"print_stats": {"state": "standby", "filename": "secret_cube.gcode"}, "heater_bed": {"temperature": 24.6}}
    return [{"id": 1, "result": {"status": st}}]


@pytest.fixture
def client():
    app = create_app(":memory:")
    conn = Conn(frames())
    app.state.live_hooks = {"http_transport": httpx.MockTransport(handler), "connect": lambda: conn}
    c = TestClient(app, headers=APP)
    c.conn = conn
    return c


def post(c, **over):
    body = {"host": HOST, "consent": True, "seconds": 3, **over}
    return c.post("/api/v1/live/capture", json=body)


def test_consent_is_required(client):
    assert post(client, consent=False).status_code == 403
    assert client.conn.sent == []


def test_foreign_origin_is_refused(client):
    r = client.post("/api/v1/live/capture", json={"host": HOST, "consent": True}, headers={"Origin": "http://evil.example"})
    assert r.status_code == 403 and client.conn.sent == []


def test_capture_is_read_only_and_hides_address_and_names(client):
    r = post(client)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["audit"]["non_read_operations"] == 0 and j["audit"]["read_operations"] == 6
    assert [a["method"] for a in j["audit"]["http"]] == ["GET"] * 5
    assert len(client.conn.sent) == 1 and json.loads(client.conn.sent[0])["method"] == "printer.objects.subscribe"
    assert j["printer"]["klippy_state"] == "ready" and j["printer"]["object_count"] == 2
    assert j["source_status"] == "REAL" and {o["source_status"] for o in j["observations"]} == {"REAL"}
    text = r.text
    assert HOST not in text and "secret" not in text
    assert j["session"] is not None and j["session"]["origin"] == "real_capture"


def test_save_false_keeps_nothing(client):
    j = post(client, save=False).json()
    assert j["session"] is None
    assert client.get("/api/v1/history").json()["totals"]["sessions"] == 0


@pytest.mark.parametrize("host", ["8.8.8.8", "127.0.0.1", "printer.local", "192.168.050.20", "http://192.168.1.2"])
def test_non_private_or_odd_targets_are_refused(client, host):
    r = post(client, host=host)
    assert r.status_code == 422 and client.conn.sent == []


def test_unreachable_printer_gives_a_safe_error():
    app = create_app(":memory:")

    def down(req):
        raise httpx.ConnectError("boom 192.168.50.20")

    app.state.live_hooks = {"http_transport": httpx.MockTransport(down), "connect": lambda: Conn([])}
    r = TestClient(app, headers=APP).post("/api/v1/live/capture", json={"host": HOST, "consent": True})
    assert r.status_code == 502 and r.json()["detail"]["code"] == "UNREACHABLE" and HOST not in r.text


def test_seconds_are_bounded(client):
    assert post(client, seconds=999).status_code == 422
    assert post(client, seconds=0).status_code == 422


class DropConn(Conn):
    """Delivers its frames, then the peer closes the connection."""

    def recv(self, timeout=None):
        if not self.frames:
            raise ConnectionResetError("peer closed")
        return json.dumps(self.frames.pop(0))


def _drop_client(monkeypatch, handler_fn):
    import app.live as live

    monkeypatch.setattr(live, "PROBE_GAP_S", 0.0)
    app = create_app(":memory:")
    conn = DropConn(frames())
    app.state.live_hooks = {"http_transport": httpx.MockTransport(handler_fn), "connect": lambda: conn}
    return TestClient(app, headers=APP)


def test_dropped_stream_is_probed_read_only_and_feeds_s04(monkeypatch):
    j = _drop_client(monkeypatch, handler).post("/api/v1/live/capture", json={"host": HOST, "consent": True, "seconds": 3}).json()
    assert j["stream_dropped"] is True and j["audit"]["non_read_operations"] == 0
    assert all(a["method"] == "GET" for a in j["audit"]["http"]) and len(j["audit"]["http"]) == 5 + 3 * 2 == live.MAX_GET
    types = [o["event_type"] for o in j["observations"]]
    assert "connection_lost" in types and types.count("link_probe") == 3
    assert [f["rule_id"] for f in j["findings"] if f["rule_id"] == "U1-S04-DROP-PROBE"] == ["U1-S04-DROP-PROBE"]
    assert "link problem" in next(f for f in j["findings"] if f["rule_id"] == "U1-S04-DROP-PROBE")["human_title"]
    assert HOST not in json.dumps(j) and "secret" not in json.dumps(j)


def test_dropped_stream_with_unreachable_printer_is_inconclusive(monkeypatch):
    calls = {"n": 0}

    def flaky(req):
        calls["n"] += 1
        if calls["n"] <= 4:
            return handler(req)
        raise httpx.ConnectError("down")

    j = _drop_client(monkeypatch, flaky).post("/api/v1/live/capture", json={"host": HOST, "consent": True, "seconds": 3}).json()
    f = next(f for f in j["findings"] if f["rule_id"] == "U1-S04-DROP-PROBE")
    assert f["classification"] == "INCONCLUSIVE"


def test_normal_end_has_no_probe():
    app = create_app(":memory:")
    app.state.live_hooks = {"http_transport": httpx.MockTransport(handler), "connect": lambda: Conn(frames())}
    j = TestClient(app, headers=APP).post("/api/v1/live/capture", json={"host": HOST, "consent": True, "seconds": 3}).json()
    assert j["stream_dropped"] is False and "link_probe" not in [o["event_type"] for o in j["observations"]]


# ---- export of the owner's own saved capture --------------------------------
def test_saved_live_capture_can_be_exported_as_a_bundle_and_replayed(client):
    import io
    import zipfile

    sid = post(client).json()["session"]["id"]
    r = client.post("/api/v1/bundles/export", json={"source": f"history:{sid}"})
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert {"manifest.json", "observations.jsonl", "findings.json"} <= set(names)
    text = b"".join(zipfile.ZipFile(io.BytesIO(r.content)).read(n) for n in names).decode("utf-8")
    assert HOST not in text and "secret" not in text
    back = client.post("/api/v1/bundles/import", content=r.content, headers={"content-type": "application/zip"})
    assert back.status_code == 200 and back.json()["source_status"] == "IMPORTED"
    assert client.post("/api/v1/bundles/preview", json={"source": f"history:{sid}"}).status_code == 200


def test_history_export_refuses_unknown_or_malformed_ids(client):
    for src in ("history:h000000000000", "history:../etc", "history:", "history:H0123456789ab"):
        assert client.post("/api/v1/bundles/export", json={"source": src}).status_code == 404


def test_observations_endpoint_and_no_resave_of_a_history_source(client):
    sid = post(client).json()["session"]["id"]
    o = client.get(f"/api/v1/history/{sid}/observations").json()
    assert o["session"]["id"] == sid and o["observations"] and HOST not in json.dumps(o)
    assert client.get("/api/v1/history/h000000000000/observations").status_code == 404
    again = client.post("/api/v1/history/source", json={"source": f"history:{sid}"})
    assert again.status_code == 422


def test_a_second_concurrent_capture_is_refused_not_queued():
    import threading

    app = create_app(":memory:")
    entered, release = threading.Event(), threading.Event()

    def slow_connect():
        entered.set()
        release.wait(10)
        return Conn(frames())

    app.state.live_hooks = {"http_transport": httpx.MockTransport(handler), "connect": slow_connect}
    c = TestClient(app, headers=APP)
    first: dict = {}
    t = threading.Thread(target=lambda: first.setdefault("r", post(c)))
    t.start()
    try:
        assert entered.wait(10)
        r = post(c)
        assert r.status_code == 409 and r.json()["detail"]["code"] == "LIVE_BUSY"
    finally:
        release.set()
        t.join(30)
    assert first["r"].status_code == 200
    assert post(c, save=False).status_code == 200  # the slot is free again
