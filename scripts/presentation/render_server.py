"""Tiny local server for scripts/presentation/render_u1.html (repo root as web root).

GET  anything  -> static file from the repo root
POST /save?name=x.png -> writes the body to docs/media/x.png
Loopback only. Usage: py -3 scripts/presentation/render_server.py [port]
"""
from __future__ import annotations

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "media"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def do_POST(self):
        u = urlparse(self.path)
        name = Path(parse_qs(u.query).get("name", ["render.png"])[0]).name
        if u.path != "/save" or not name.lower().endswith(".png"):
            self.send_error(400)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / name).write_bytes(body)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f"{name} {len(body)}".encode())


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8801
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
