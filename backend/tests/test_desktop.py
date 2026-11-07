"""The native-window launcher: only its logic is tested here (the window itself is checked by hand on Windows)."""
import socket

import pytest

from app import desktop


def test_save_bytes_writes_where_the_user_chose(tmp_path):
    target = tmp_path / "out.zip"
    assert desktop.save_bytes("u1-deb-demo.zip", b"PK-data", lambda default: str(target)) is True
    assert target.read_bytes() == b"PK-data"


def test_save_bytes_cancelled_writes_nothing(tmp_path):
    assert desktop.save_bytes("u1-deb-demo.zip", b"x", lambda default: None) is False
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("name", ["../evil.zip", "a/b.zip", "report.exe", "x.zip.exe", "", "a b.zip", "é.zip"])
def test_save_bytes_refuses_anything_but_a_plain_zip_name(name):
    with pytest.raises(ValueError):
        desktop.save_bytes(name, b"x", lambda default: "unused")


def test_pick_port_prefers_the_usual_port_then_detects_a_running_app(monkeypatch):
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        free = s.getsockname()[1]
    monkeypatch.setenv("U1DOCTOR_PORT", str(free))
    assert desktop.pick_port() == free

    with socket.socket() as busy:
        busy.bind(("127.0.0.1", 0))
        busy.listen()
        taken = busy.getsockname()[1]
        monkeypatch.setenv("U1DOCTOR_PORT", str(taken))
        monkeypatch.setattr(desktop, "is_u1_doctor", lambda port: True)
        assert desktop.pick_port() is None  # already running: do not start a second server
        monkeypatch.setattr(desktop, "is_u1_doctor", lambda port: False)
        other = desktop.pick_port()
        assert other not in (None, taken)  # something else owns the port: use a free one


def test_headless_mode_serves_without_a_window(monkeypatch, tmp_path):
    class Fake:  # a server thread that is already finished
        def join(self, timeout=None):
            pass

    started = {}
    monkeypatch.setenv("U1DOCTOR_HEADLESS", "1")
    monkeypatch.setenv("U1DOCTOR_DB", str(tmp_path / "h.sqlite3"))
    monkeypatch.setattr(desktop, "pick_port", lambda: 18999)
    monkeypatch.setattr(desktop, "start_server", lambda port, db: (started.update(port=port) or object(), Fake()))
    monkeypatch.setattr(desktop, "run_window", lambda url: pytest.fail("no window in headless mode"))
    assert desktop.main() == 0 and started["port"] == 18999


def test_server_starts_serves_health_and_stops(tmp_path):
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server, thread = desktop.start_server(port, str(tmp_path / "t.sqlite3"))
    try:
        assert desktop.is_u1_doctor(port)
    finally:
        server.should_exit = True
        thread.join(5)
    assert not thread.is_alive()


def test_webview2_missing_and_installer_declined_falls_back(monkeypatch):
    monkeypatch.setattr(desktop, "webview2_setup_path", lambda: "setup.exe")
    monkeypatch.setattr(desktop, "notify", lambda message, ask=False: False)  # the user answers No
    assert desktop.ensure_webview2() is False


def test_webview2_without_a_shipped_installer_cannot_install(monkeypatch):
    monkeypatch.setattr(desktop, "webview2_setup_path", lambda: None)
    monkeypatch.setattr(desktop, "notify", lambda message, ask=False: pytest.fail("nothing to offer"))
    assert desktop.ensure_webview2() is False


def test_webview2_installed_answers_a_bool():
    assert isinstance(desktop.webview2_installed(), bool)
