import json

import pytest

from app.transport import Consent, PolicyViolation, ReadOnlyMoonrakerWebSocket
from app.transport.readonly import TransportError

HOST = "192.168.50.20"
NOCONSENT = Consent(approved_by_owner=False, target_host=HOST, scope="TEST")


class FakeConn:
    def __init__(self, inbound=()):
        self.sent: list[str] = []
        self.inbound = list(inbound)
        self.closed = False

    def send(self, message):
        self.sent.append(message)

    def recv(self, timeout=None):
        if not self.inbound:
            raise TimeoutError
        return self.inbound.pop(0)

    def close(self):
        self.closed = True


def make(conn):
    return ReadOnlyMoonrakerWebSocket(HOST, consent=NOCONSENT, connect=lambda: conn)


def test_no_generic_send():
    assert not hasattr(ReadOnlyMoonrakerWebSocket, "send") and not hasattr(ReadOnlyMoonrakerWebSocket, "request")


def test_real_network_needs_consent():
    with pytest.raises(PolicyViolation):
        ReadOnlyMoonrakerWebSocket(HOST, consent=NOCONSENT)
    with pytest.raises(PolicyViolation):  # consent for another host
        ReadOnlyMoonrakerWebSocket(HOST, consent=Consent(True, "192.168.50.21", "H-02"))


def test_subscribe_sends_one_validated_frame():
    c = FakeConn()
    ws = make(c)
    assert ws.subscribe({"print_stats": ["state"], "toolhead": None}) == 1
    assert ws.subscribe({"webhooks": None}) == 2
    f = json.loads(c.sent[0])
    assert f["method"] == "printer.objects.subscribe" and f["id"] == 1 and len(c.sent) == 2


@pytest.mark.parametrize("bad", [{}, {"bad name!": None}, {"x": ["a b"]}, {"a": "str"}])
def test_invalid_subscribe_is_refused_without_io(bad):
    c = FakeConn()
    ws = make(c)
    with pytest.raises(PolicyViolation):
        ws.subscribe(bad)
    assert c.sent == [] and ws.audit[-1]["allowed"] is False


def test_frames_parse_and_cap():
    c = FakeConn([json.dumps({"method": "notify_status_update", "params": [{}, 1.0]})])
    ws = make(c)
    out = list(ws.frames(max_frames=5, duration_s=0.3))
    assert len(out) == 1 and out[0].payload["method"] == "notify_status_update"
    assert c.sent == []  # never replies
    with pytest.raises(TransportError):
        list(make(FakeConn(["not json"])).frames(max_frames=1, duration_s=1))
    with pytest.raises(TransportError):
        list(make(FakeConn(["[1]"])).frames(max_frames=1, duration_s=1))
    with pytest.raises(TransportError):
        list(make(FakeConn(["x" * (300 * 1024)])).frames(max_frames=1, duration_s=1))


def test_public_host_refused():
    with pytest.raises(PolicyViolation):
        ReadOnlyMoonrakerWebSocket("8.8.8.8", consent=NOCONSENT, connect=lambda: FakeConn())


def test_real_connect_against_local_server_caps_inbound():
    """Exercises _real_connect on loopback:7125 (test-only; the public class refuses loopback)."""
    import threading

    from websockets.sync.server import serve

    from app.transport.ws import MAX_INBOUND_BYTES, _real_connect

    def handler(conn):
        got = conn.recv(timeout=2)
        conn.send(json.dumps({"echo": json.loads(got)["method"]}))
        conn.send("x" * (MAX_INBOUND_BYTES + 10))

    try:
        srv = serve(handler, "127.0.0.1", 7125)
    except OSError:
        pytest.skip("port 7125 busy")
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        conn = _real_connect("127.0.0.1", 2.0)
        conn.send(json.dumps({"method": "printer.objects.subscribe"}))
        assert json.loads(conn.recv(timeout=2)) == {"echo": "printer.objects.subscribe"}
        with pytest.raises(Exception):  # frame above max_size closes the connection
            conn.recv(timeout=2)
    finally:
        srv.shutdown()
