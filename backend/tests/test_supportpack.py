"""Support pack (BACKLOG #70): policy scope, zip content, password, redaction. Network always mocked; no printer is contacted."""
import io
import json
import re

import httpx
import pytest
import pyzipper
from fastapi.testclient import TestClient

from app.api import create_app
from app.supportpack import PackError, _pick_logs, build_support_pack, new_password, scrub_network
from app.transport import Consent, PolicyViolation, ReadOnlyMoonrakerTransport, check_http_request
from app.transport.readonly import TransportError

HOST = "192.168.50.20"
APP = {"X-U1D": "1"}
SECRET = "secret-sn-123"


@pytest.mark.parametrize("path", [
    "/server/files/logs/klippylogs/klippy.log", "/server/files/logs/klippylogs/klippy.log.7", "/server/files/logs/moonraker.log",
    "/server/files/logs/syslog.0", "/server/files/config/printer.cfg", "/server/files/config/snapmaker/input_shaper.json",
    "/server/files/config/persistent/extruder2_nozzle_config.json"])
def test_support_scope_allows_named_downloads(path):
    assert check_http_request("GET", path, support=True) == "server.files.download"
    with pytest.raises(PolicyViolation):
        check_http_request("GET", path)  # the live-capture scope never downloads


@pytest.mark.parametrize("path", [
    "/server/files/config/moonraker.conf", "/server/files/config/gui_config.json", "/server/files/config/snapmaker/print_task.json",
    "/server/files/config/../logs/moonraker.log", "/server/files/logs/", "/server/files/gcodes/model.gcode", "/server/files/camera/x.jpg",
    "/server/files/logs/klippylogs/klippy.log.100", "/server/files/logs/moonraker.log.bak", "/server/files/logs/%2e%2e/x",
    "/server/files/config//printer.cfg"])
def test_support_scope_refuses_everything_else(path):
    with pytest.raises(PolicyViolation):
        check_http_request("GET", path, support=True)


def test_support_scope_is_get_only_and_queries_are_exact():
    for m in ("POST", "DELETE", "PUT"):
        for p in ("/machine/system_info", "/server/files/config/printer.cfg", "/printer/objects/query", "/printer/gcode/script"):
            with pytest.raises(PolicyViolation):
                check_http_request(m, p, support=True)
    assert check_http_request("GET", "/server/files/list", None, {"root": "logs"}, support=True) == "server.files.list"
    for q in (None, {"root": "gcodes"}, {"root": "logs", "x": "1"}):
        with pytest.raises(PolicyViolation):
            check_http_request("GET", "/server/files/list", None, q, support=True)
    assert check_http_request("GET", "/printer/objects/query", None, {"mcu": "", "mcu e0": ""}, support=True) == "printer.objects.query"
    for q in (None, {}, {"configfile": ""}, {"mcu": "settings"}, {"gcode_macro PRINT_START": ""}):
        with pytest.raises(PolicyViolation):
            check_http_request("GET", "/printer/objects/query", None, q, support=True)
    with pytest.raises(PolicyViolation):
        check_http_request("GET", "/server/files/config/printer.cfg", None, {"x": "1"}, support=True)


def test_live_scope_transport_refuses_support_calls():
    t = ReadOnlyMoonrakerTransport(HOST, consent=Consent(False, HOST, "T"), http_transport=httpx.MockTransport(lambda r: httpx.Response(200, json={})))
    for call in (t.get_system_info, t.get_proc_stats, lambda: t.download_file("config", "printer.cfg", 100), lambda: t.list_files("logs")):
        with pytest.raises(PolicyViolation):
            call()
    assert all(not a.allowed for a in t.audit)


def test_download_is_capped():
    t = ReadOnlyMoonrakerTransport(HOST, consent=Consent(False, HOST, "T"), support=True,
                                   http_transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 1000)))
    assert t.download_file("config", "printer.cfg", 1000) == b"x" * 1000
    with pytest.raises(TransportError):
        t.download_file("config", "printer.cfg", 999)


def test_password_shape_and_randomness():
    pw = {new_password() for _ in range(50)}
    assert len(pw) == 50 and all(re.fullmatch(r"(?:[A-HJKMNP-Z2-9]{4}-){4}[A-HJKMNP-Z2-9]{4}", p) for p in pw)


def test_scrub_network_removes_addresses_only():
    raw = b"ip 192.168.1.152 mac 40:fd:f3:d9:3f:d6 v6 2001:1708:906:ad00:4efa:6d3c:9221:7b57 time 12:30:45 ver 2.1.0"
    out = scrub_network(raw)
    assert b"192.168" not in out and b"40:fd" not in out and b"2001:1708" not in out and b"12:30:45" in out and b"2.1.0" in out


LOGS = [{"path": p, "size": 100} for p in ("klippylogs/klippy.log", "klippylogs/klippy.log.1", "klippylogs/klippy.log.2", "klippylogs/klippy.log.3",
                                          "klippylogs/klippy.log.15", "moonraker.log", "gui.log", "sysinfo_0.csv", ".logrotate.status", "syslog")]


def test_log_selection_keeps_three_klippy_runs_and_skips_unlisted_files():
    names = [n for n, _ in _pick_logs({"result": LOGS})]
    assert names[:3] == ["klippylogs/klippy.log", "klippylogs/klippy.log.1", "klippylogs/klippy.log.2"]
    assert "klippylogs/klippy.log.3" not in names and "sysinfo_0.csv" not in names and ".logrotate.status" not in names
    assert names[-1] == "gui.log"


def _handler(log_body=b"line 192.168.50.20 mac 40:fd:f3:d9:3f:d6\n", fail=()):
    def h(req):
        assert req.method == "GET"
        path = req.url.path
        if path in fail:
            return httpx.Response(404, json={})
        if path == "/server/info":
            return httpx.Response(200, json={"result": {"klippy_state": "ready"}})
        if path == "/printer/info":
            return httpx.Response(200, json={"result": {"state": "ready"}})
        if path == "/machine/system_info":
            return httpx.Response(200, json={"result": {"system_info": {
                "product_info": {"firmware_version": "2.1.0", "software_version": "2.1.0", "serial_number": SECRET, "machine_type": "Snapmaker U1"},
                "sd_info": {"serial_number": SECRET}, "cpu_info": {"serial_number": "cpu-secret"}, "distribution": {"name": "Buildroot"},
                "network": {"wlan0": {"mac_address": "40:fd:f3:d9:3f:d6", "ip_addresses": [{"address": HOST}]}}}}})
        if path == "/server/history/list":
            return httpx.Response(200, json={"result": {"jobs": [{"user": "bob", "filename": "my_model.gcode", "status": "cancelled",
                                                                  "metadata": {"uuid": "u", "thumbnails": [1]}}]}})
        if path == "/printer/objects/query":
            return httpx.Response(200, json={"result": {"status": {"mcu": {"mcu_version": "v1"}, "mcu e0": {"mcu_version": "v2"}}}})
        if path == "/server/files/list":
            root = req.url.params["root"]
            return httpx.Response(200, json={"result": [{"path": "printer.cfg", "size": 10}, {"path": "moonraker.conf", "size": 5}] if root == "config"
                                             else [{"path": "moonraker.log", "size": len(log_body)}, {"path": "secret.txt", "size": 1}]})
        if path.startswith("/server/files/"):
            return httpx.Response(200, content=log_body)
        return httpx.Response(200, json={"result": {}})
    return h


def _open(r):
    z = pyzipper.AESZipFile(io.BytesIO(r["zip"]))
    z.setpassword(r["password"].encode())
    return z


def test_pack_is_aes_encrypted_and_redacted_by_default():
    r = build_support_pack(HOST, code="0003-0001", notes="stops at layer 3", http_transport=httpx.MockTransport(_handler()))
    z = pyzipper.AESZipFile(io.BytesIO(r["zip"]))
    with pytest.raises(RuntimeError):
        z.read("manifest.json")  # no password: refused
    z.setpassword(b"WRONG-PASS-WORD-WRONG-XXXX")
    with pytest.raises(RuntimeError):
        z.read("manifest.json")
    z = _open(r)
    names = set(z.namelist())
    assert {"manifest.json", "LISEZ-MOI-README.txt", "printer/system_info.json", "printer/history_jobs.json", "logs/moonraker.log", "config/printer.cfg"} <= names
    assert "config/moonraker.conf" not in names and not any("secret.txt" in n for n in names)
    everything = b"".join(z.read(n) for n in names)
    assert b"192.168.50.20" not in everything and b"40:fd" not in everything and b"cpu-secret" not in everything
    assert b"my_model" not in everything and b"bob" not in everything and SECRET.encode() in z.read("printer/system_info.json")
    readme = z.read("LISEZ-MOI-README.txt").decode()
    assert "0003-0001" in readme and "stops at layer 3" in readme and SECRET in readme and "NOT all the same" in readme and "ENCRYPTED" in readme
    man = json.loads(z.read("manifest.json"))
    assert man["options"] == {"include_serial": True, "redact_network": True, "include_job_names": False} and man["read_only_requests"] >= 10
    assert len(r["password"]) == 24 and r["sha256"] and r["zip"][:2] == b"PK"


def test_pack_options_serial_off_and_names_on():
    r = build_support_pack(HOST, include_serial=False, include_job_names=True, redact_network=False, http_transport=httpx.MockTransport(_handler()))
    z = _open(r)
    everything = b"".join(z.read(n) for n in z.namelist())
    assert SECRET.encode() not in everything and b"my_model.gcode" in everything and b"192.168.50.20" in z.read("logs/moonraker.log")
    assert "removed by owner" in z.read("LISEZ-MOI-README.txt").decode()


def test_pack_survives_partial_failures_and_says_so():
    r = build_support_pack(HOST, http_transport=httpx.MockTransport(_handler(fail=("/machine/proc_stats", "/server/temperature_store"))))
    ops = {e["op"] for e in r["not_collected"]}
    assert {"machine.proc_stats", "server.temperature_store"} <= ops
    assert "printer/proc_stats.json" not in _open(r).namelist()


def test_pack_refuses_unreachable_and_public_addresses():
    with pytest.raises(PackError) as e:
        build_support_pack(HOST, http_transport=httpx.MockTransport(_handler(fail=("/server/info",))))
    assert e.value.code == "UNREACHABLE"
    with pytest.raises(PackError) as e:
        build_support_pack("8.8.8.8")
    assert e.value.code == "REFUSED_TARGET"


def _client():
    app = create_app(":memory:")
    app.state.pack_hooks = {"http_transport": httpx.MockTransport(_handler())}
    return TestClient(app, headers=APP)


def test_api_needs_consent_returns_password_once_and_serves_the_zip():
    c = _client()
    assert c.post("/api/v1/support/pack", json={"host": HOST}).status_code == 403
    r = c.post("/api/v1/support/pack", json={"host": HOST, "consent": True, "code": "0003-0001"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "zip" not in j and re.fullmatch(r"(?:[A-Z2-9]{4}-){4}[A-Z2-9]{4}", j["password"]) and HOST not in r.text
    d = c.get(f"/api/v1/support/pack/{j['name']}")
    assert d.status_code == 200 and d.headers["content-type"] == "application/zip" and d.content[:2] == b"PK"
    assert c.get("/api/v1/support/pack/other.zip").status_code == 404
    z = pyzipper.AESZipFile(io.BytesIO(d.content))
    z.setpassword(j["password"].encode())
    assert "manifest.json" in z.namelist()


def test_api_refuses_foreign_origin_and_public_host():
    c = _client()
    assert TestClient(c.app).post("/api/v1/support/pack", json={"host": HOST, "consent": True}).status_code == 403  # no app header
    assert c.post("/api/v1/support/pack", json={"host": "8.8.8.8", "consent": True}).status_code == 422
