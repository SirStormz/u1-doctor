"""G0 negative security tests (T-021..T-024, protocol §7). Offline only.

A MockTransport counts calls: every refused request must produce ZERO I/O.
"""
import json

import httpx
import pytest

from app.transport import (
    ALLOWED_HTTP,
    Consent,
    PolicyViolation,
    ReadOnlyMoonrakerTransport,
    check_http_request,
    check_ws_message,
    validate_target_host,
)
from app.transport.readonly import TransportError

HOST = "192.168.50.20"  # RFC1918 documentation-style placeholder, not the owner's IP
NOCONSENT = Consent(approved_by_owner=False, target_host=HOST, scope="TEST")


class Spy:
    def __init__(self, status=200, body=None, headers=None):
        self.calls: list[httpx.Request] = []
        self.status, self.body, self.headers = status, body or {"result": {}}, headers or {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        return httpx.Response(self.status, json=self.body, headers=self.headers)


def make(spy: Spy) -> ReadOnlyMoonrakerTransport:
    return ReadOnlyMoonrakerTransport(HOST, consent=NOCONSENT, http_transport=httpx.MockTransport(spy))


FORBIDDEN_HTTP = [
    ("POST", "/printer/gcode/script"),
    ("GET", "/printer/gcode/script"),
    ("POST", "/printer/print/start"),
    ("POST", "/printer/print/pause"),
    ("POST", "/printer/print/resume"),
    ("POST", "/printer/print/cancel"),
    ("POST", "/printer/restart"),
    ("POST", "/printer/firmware_restart"),
    ("POST", "/printer/emergency_stop"),
    ("POST", "/machine/reboot"),
    ("POST", "/machine/shutdown"),
    ("POST", "/server/files/upload"),
    ("DELETE", "/server/files/gcodes/x.gcode"),
    ("POST", "/server/restart"),
    ("GET", "/printer/gcode/help"),
    ("GET", "/printer/query_endstops/status"),
    ("GET", "/printer/objects/query"),  # never used by the app: not allowed (BACKLOG #52 L3)
    ("POST", "/printer/objects/query"),
    ("GET", "/server/files/list"),
    ("GET", "/access/oneshot_token"),
    # method mismatches on allowed paths
    ("POST", "/server/info"),
    ("POST", "/printer/info"),
    ("POST", "/printer/objects/list"),
    ("PUT", "/printer/objects/query"),
    ("DELETE", "/server/info"),
    # obfuscation
    ("GET", "/Server/Info"),
    ("GET", "/server/info/"),
    ("GET", "//server/info"),
    ("GET", "/server/info?x=1"),
    ("GET", "/server/info#frag"),
    ("GET", "/server/../printer/gcode/script"),
    ("GET", "/server/%69nfo"),
    ("GET", "/server/info\r\nX-A: b"),
    ("GET", "/server/info;x"),
    ("GET", "/server/info‮"),
    ("GET", "http://evil.example/server/info"),
    ("GET", "/server\\info"),
    ("get", "/server/info"),
]


@pytest.mark.parametrize("method,path", FORBIDDEN_HTTP)
def test_forbidden_http_denied_before_io(method, path):
    spy = Spy()
    t = make(spy)
    with pytest.raises(PolicyViolation):
        t._send(method, path, b'{"objects":{"print_stats":null}}' if method == "POST" else None)
    assert spy.calls == []
    assert t.audit[-1].allowed is False


def test_allowed_operations_work_and_are_audited():
    spy = Spy()
    t = make(spy)
    t.get_server_info()
    t.get_printer_info()
    t.list_objects()
    assert [(c.method, c.url.path) for c in spy.calls] == [
        ("GET", "/server/info"),
        ("GET", "/printer/info"),
        ("GET", "/printer/objects/list"),
    ]
    assert all(e.allowed for e in t.audit) and len(t.audit) == 3


@pytest.mark.parametrize(
    "body",
    [
        b"",
        b"not json",
        b"[]",
        b'{"objects":{}}',
        b'{"objects":{"x":null},"script":"G28"}',
        b'{"script":"G28"}',
        b'{"objects":{"print_stats":null,"print_stats":null}}',
        b'{"objects":{"bad/name":null}}',
        b'{"objects":{"gcode_macro X\\nG28":null}}',
        b'{"objects":{"print_stats":"state"}}',
        b'{"objects":{"print_stats":["a b"]}}',
        b'{"objects":{"print_stats":[1]}}',
        b"x" * 9000,
    ],
)
def test_objects_query_denied_whatever_the_body(body):
    # POST /printer/objects/query left the allowlist (unused); a well-formed query body is refused too
    with pytest.raises(PolicyViolation):
        check_http_request("POST", "/printer/objects/query", body)


def test_allowlist_is_get_only():
    assert {m for m, _ in ALLOWED_HTTP} == {"GET"}
    with pytest.raises(PolicyViolation):
        check_http_request("POST", "/printer/objects/query", b'{"objects":{"print_stats":["state"]}}')


def test_get_with_body_denied():
    with pytest.raises(PolicyViolation):
        check_http_request("GET", "/server/info", b"{}")


def ws(method, params=None, **extra):
    msg = {"jsonrpc": "2.0", "method": method, "id": 1}
    if params is not None:
        msg["params"] = params
    msg.update(extra)
    return json.dumps(msg)


@pytest.mark.parametrize(
    "raw",
    [
        ws("printer.gcode.script", {"script": "G28"}),
        ws("printer.print.start", {"filename": "a.gcode"}),
        ws("printer.print.pause"),
        ws("printer.print.cancel"),
        ws("printer.restart"),
        ws("printer.firmware_restart"),
        ws("printer.emergency_stop"),
        ws("machine.reboot"),
        ws("machine.shutdown"),
        ws("server.files.delete_file", {"path": "gcodes/a"}),
        ws("server.connection.identify", {"client_name": "x"}),
        ws("server.info"),  # option-after-audit -> denied in G0
        ws("printer.info"),
        ws("printer.objects.query", {"objects": {"x": None}}),
        ws("printer.objects.subscribe"),  # no params
        ws("printer.objects.subscribe", {"objects": {"x": None}, "script": "G28"}),
        ws("printer.objects.subscribe", {"objects": {"x": None}}, jsonrpc="1.0"),
        ws("printer.objects.subscribe", {"objects": {"x": None}}, id="1"),
        ws("printer.objects.subscribe", {"objects": {"x": None}}, extra="y"),
        "[" + ws("printer.gcode.script", {"script": "G28"}) + "]",
        "not json",
        ws("PRINTER.objects.subscribe", {"objects": {"x": None}}),
        ws("printer.objects.subscribe ", {"objects": {"x": None}}),
    ],
)
def test_ws_denied(raw):
    with pytest.raises(PolicyViolation):
        check_ws_message(raw)


def test_ws_subscribe_allowed():
    assert check_ws_message(ws("printer.objects.subscribe", {"objects": {"print_stats": None}})) == "printer.objects.subscribe"


@pytest.mark.parametrize(
    "host",
    [
        "127.0.0.1", "localhost", "0.0.0.0", "169.254.169.254", "8.8.8.8", "1.1.1.1",
        "::1", "fe80::1", "fd00::1", "192.168.1.1/24", "http://192.168.1.5",
        "user@192.168.1.5", "192.168.1.5:7125", "192.168.01.5", "0xC0.168.1.5",
        "3232235777", " 192.168.1.5", "printer.local", "", "192.168.1.5\n",
        "224.0.0.1", "100.64.0.1", "172.32.0.1", "11.0.0.1",
    ],
)
def test_bad_targets(host):
    with pytest.raises(PolicyViolation):
        validate_target_host(host)


@pytest.mark.parametrize("host", ["10.0.0.5", "172.16.3.4", "172.31.255.254", "192.168.50.20"])
def test_good_targets(host):
    assert validate_target_host(host) == host


def test_port_must_be_audited_port():
    with pytest.raises(PolicyViolation):
        validate_target_host("192.168.1.5", 80)


def test_real_network_requires_owner_consent():
    with pytest.raises(PolicyViolation):
        ReadOnlyMoonrakerTransport(HOST, consent=NOCONSENT)  # no mock => would hit LAN
    with pytest.raises(PolicyViolation):  # consent for another host
        ReadOnlyMoonrakerTransport(HOST, consent=Consent(True, "10.0.0.9", "H-01"))


def test_redirect_not_followed():
    spy = Spy(status=302, headers={"location": "http://8.8.8.8/server/info"})
    t = make(spy)
    with pytest.raises(TransportError):
        t.get_server_info()
    assert len(spy.calls) == 1  # no second hop


@pytest.mark.parametrize("status", [401, 403])
def test_auth_status_reported_no_bypass(status):
    t = make(Spy(status=status))
    with pytest.raises(TransportError, match="authentication"):
        t.get_server_info()


def test_oversize_response_refused():
    t = make(Spy(body={"x": "a" * (2 * 1024 * 1024 + 10)}))
    with pytest.raises(TransportError, match="too large"):
        t.get_server_info()


def test_non_json_response_refused():
    def h(req):
        return httpx.Response(200, content=b"<html>")

    t = ReadOnlyMoonrakerTransport(HOST, consent=NOCONSENT, http_transport=httpx.MockTransport(h))
    with pytest.raises(TransportError):
        t.get_server_info()


def test_env_proxy_ignored(monkeypatch):
    monkeypatch.setenv("HTTP_PROXY", "http://evil.example:3128")
    monkeypatch.setenv("ALL_PROXY", "http://evil.example:3128")
    t = ReadOnlyMoonrakerTransport(HOST, consent=NOCONSENT, http_transport=httpx.MockTransport(Spy()))
    assert t._client.trust_env is False
    assert t._client.follow_redirects is False


def test_no_public_generic_request_surface():
    public = {n for n in dir(ReadOnlyMoonrakerTransport) if not n.startswith("_")}
    assert public == {"get_server_info", "get_printer_info", "list_objects", "get_logs_disk_usage", "get_history_totals", "close"}
