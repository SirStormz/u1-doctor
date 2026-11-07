"""Native-window launcher used by the Windows exe: double-click, one window, no console, no browser.

The same FastAPI app as `python -m app` runs on 127.0.0.1 in a background thread and a native window (pywebview, WebView2 on
Windows) shows it. Closing the window stops the server. Nothing here changes what the app does or reads.
"""
from __future__ import annotations

import base64
import binascii
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from collections.abc import Callable
from typing import Any

PREFERRED_PORT = 8765
TITLE = "U1 Doctor"
WEBVIEW2_URL = "https://developer.microsoft.com/microsoft-edge/webview2/"
_ZIP_NAME = re.compile(r"^[A-Za-z0-9._-]{1,80}\.zip$")


def notify(message: str, *, ask: bool = False) -> bool:
    """Native message box (the exe has no console). Returns True for OK/Yes. Falls back to stderr off Windows."""
    if sys.platform == "win32":
        import ctypes

        flags = 0x00000024 if ask else 0x00000040  # MB_YESNO | MB_ICONQUESTION  /  MB_OK | MB_ICONINFORMATION
        return bool(ctypes.windll.user32.MessageBoxW(None, message, TITLE, flags) in (1, 6))
    print(message, file=sys.stderr)
    return False


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def is_u1_doctor(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=2) as r:
            return bool(json.load(r).get("status") == "ok")
    except Exception:
        return False


def pick_port() -> int | None:
    """The usual port keeps the browser-side settings (language, theme) between runs. None means the app is already running."""
    want = int(os.environ.get("U1DOCTOR_PORT", PREFERRED_PORT))
    if port_is_free(want):
        return want
    if is_u1_doctor(want):
        return None
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def save_bytes(name: str, data: bytes, choose_path: Callable[[str], str | None]) -> bool:
    """Write an exported bundle where the user chose in a native Save dialog. Only `.zip` names are accepted."""
    if not _ZIP_NAME.match(name):
        raise ValueError("unsupported file name")
    path = choose_path(name)
    if not path:
        return False
    with open(path, "wb") as f:
        f.write(data)
    return True


def start_server(port: int, db_path: str) -> tuple[Any, threading.Thread]:
    import uvicorn

    from .api import create_app

    server = uvicorn.Server(uvicorn.Config(create_app(db_path), host="127.0.0.1", port=port, log_config=None, access_log=False))
    thread = threading.Thread(target=server.run, name="u1-doctor-server", daemon=True)
    thread.start()
    deadline = time.monotonic() + 20
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("the local server did not start")
        time.sleep(0.05)
    return server, thread


def user_data_dir() -> str:
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    path = os.path.join(base, "U1 Doctor", "webview")
    os.makedirs(path, exist_ok=True)
    return path


_WEBVIEW2_CLIENT = r"Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
_WEBVIEW2_SETUP = "MicrosoftEdgeWebview2Setup.exe"


def webview2_installed() -> bool:
    """True when the Microsoft WebView2 runtime is installed (system-wide or for the current user)."""
    if sys.platform != "win32":
        return False
    import winreg

    for hive, prefix in ((winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node"), (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE"),
                         (winreg.HKEY_CURRENT_USER, r"Software")):
        try:
            with winreg.OpenKey(hive, rf"{prefix}\{_WEBVIEW2_CLIENT}") as key:
                version = str(winreg.QueryValueEx(key, "pv")[0])
        except OSError:
            continue
        if version and version != "0.0.0.0":
            return True
    return False


def webview2_setup_path() -> str | None:
    """The Microsoft installer shipped next to the exe (see scripts/build_windows.ps1)."""
    path = os.path.join(os.path.dirname(os.path.abspath(sys.executable)), "webview2", _WEBVIEW2_SETUP)
    return path if os.path.isfile(path) else None


def ensure_webview2() -> bool:
    """Offer to install the WebView2 runtime with the Microsoft installer shipped in the zip, then re-check."""
    setup = webview2_setup_path()
    if setup is None:
        return False
    if not notify("U1 Doctor needs a free Microsoft component (WebView2) to show its window, and it is not on this PC.\n\n"
                  "Install it now? Windows will ask for your permission, and an internet connection is needed once.", ask=True):
        return False
    import subprocess

    quoted = setup.replace("'", "''")
    subprocess.run(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command",
                    f"Start-Process -FilePath '{quoted}' -ArgumentList '/silent','/install' -Verb RunAs -Wait"],
                   check=False, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return webview2_installed()


def write_error_log() -> str:
    """Save the current exception's traceback next to the app data so a failure can be diagnosed without a console."""
    import traceback

    path = os.path.join(os.path.dirname(user_data_dir()), "error.log")
    with open(path, "w", encoding="utf-8") as f:
        f.write(traceback.format_exc())
    return path


def icon_path() -> str | None:
    """The window icon: bundled next to the exe by the build, or taken from scripts/icon when run from a checkout."""
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (getattr(sys, "_MEIPASS", None), os.path.join(here, "..", "..", "scripts", "icon")):
        if base and os.path.isfile(os.path.join(base, "u1-doctor.ico")):
            return os.path.join(base, "u1-doctor.ico")
    return None


def run_window(url: str) -> None:
    import webview

    window = webview.create_window(TITLE, url, width=1440, height=900, min_size=(1100, 700), background_color="#0e1116", text_select=True)
    assert window is not None

    def save_file(name: str, b64: str) -> bool:
        try:
            data = base64.b64decode(b64, validate=True)
        except (binascii.Error, ValueError) as e:
            raise ValueError("bad data") from e

        def choose(default: str) -> str | None:
            picked = window.create_file_dialog(webview.FileDialog.SAVE, save_filename=default, file_types=("Zip archive (*.zip)",))
            if not picked:
                return None
            return str(picked if isinstance(picked, str) else picked[0])

        return save_bytes(name, data, choose)

    window.expose(save_file)
    # gui="edgechromium": never fall back to the old Internet Explorer engine, which cannot show this app.
    webview.start(gui="edgechromium", private_mode=False, storage_path=user_data_dir(), icon=icon_path())


def main() -> int:
    for stream in ("stdout", "stderr"):  # a windowed exe has no console: libraries that print must not crash
        if getattr(sys, stream) is None:
            setattr(sys, stream, open(os.devnull, "w"))
    port = pick_port()
    if port is None:
        notify("U1 Doctor is already running. Look for its window in the taskbar.")
        return 0
    db = os.environ.get("U1DOCTOR_DB", os.path.join(os.path.expanduser("~"), ".u1-doctor.sqlite3"))
    try:
        server, thread = start_server(port, db)
    except Exception as e:
        notify(f"U1 Doctor could not start its local server: {e}")
        return 1
    if os.environ.get("U1DOCTOR_HEADLESS"):  # server only, no window: used by the automated smoke tests (CI, test kit)
        thread.join()
        return 0
    url = f"http://127.0.0.1:{port}"
    try:
        if sys.platform == "win32" and not webview2_installed() and not ensure_webview2():
            raise RuntimeError("the Microsoft WebView2 runtime is not installed")
        run_window(url)
    except Exception as e:
        # The window could not start (often the Microsoft WebView2 runtime is missing). Keep the reason and use the browser instead.
        log = write_error_log()
        webbrowser.open(url)
        notify(f"U1 Doctor opened in your web browser because its own window could not start ({type(e).__name__}: {e}).\n"
               f"If the Microsoft WebView2 runtime is missing, install it from {WEBVIEW2_URL}\n"
               f"Details: {log}\n\nClick OK to quit U1 Doctor.")
    finally:
        server.should_exit = True
        thread.join(5)
    return 0
