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


def test_unblock_bundle_does_nothing_outside_the_frozen_exe():
    assert desktop.unblock_bundle() == 0


def test_unblock_bundle_only_touches_dlls_inside_internal(monkeypatch, tmp_path):
    # BACKLOG #53 M7: never the user's other files next to the exe, only PyInstaller's bundled _internal folder
    for rel in ("_internal/a.dll", "_internal/sub/b.DLL", "_internal/c.txt", "mine.dll", "other/d.dll"):
        (tmp_path / rel).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / rel).write_bytes(b"")
    removed: list[str] = []
    monkeypatch.setattr(desktop.sys, "platform", "win32")
    monkeypatch.setattr(desktop.sys, "frozen", True, raising=False)
    monkeypatch.setattr(desktop.sys, "executable", str(tmp_path / "u1-doctor.exe"))
    monkeypatch.setattr(desktop.os, "remove", removed.append)
    assert desktop.unblock_bundle() == 2
    internal = str(tmp_path / "_internal")
    assert len(removed) == 2 and all(p.startswith(internal) and p.endswith(":Zone.Identifier") for p in removed)


def test_unblock_bundle_without_internal_folder_does_nothing(monkeypatch, tmp_path):
    (tmp_path / "mine.dll").write_bytes(b"")
    monkeypatch.setattr(desktop.sys, "platform", "win32")
    monkeypatch.setattr(desktop.sys, "frozen", True, raising=False)
    monkeypatch.setattr(desktop.sys, "executable", str(tmp_path / "u1-doctor.exe"))
    monkeypatch.setattr(desktop.os, "remove", lambda p: pytest.fail("nothing may be touched"))
    assert desktop.unblock_bundle() == 0


def test_error_log_hides_the_user_profile_path(monkeypatch, tmp_path):
    # BACKLOG #52 L5: error.log is meant to be attached to an issue; the Windows account name must not be in it
    monkeypatch.setenv("USERPROFILE", r"C:\Users\Jane Doe")
    monkeypatch.setattr(desktop, "user_data_dir", lambda: str(tmp_path / "webview"))
    try:
        raise RuntimeError(r"cannot load c:\users\jane doe\Downloads\u1\_internal\x.dll and C:/Users/Jane Doe/y")
    except RuntimeError:
        path = desktop.write_error_log()
    text = open(path, encoding="utf-8").read()
    assert "jane" not in text.lower() and text.count("%USERPROFILE%") >= 2
