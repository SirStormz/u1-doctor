"""Banc local des planches UI V2 : sert maquettes/ en http comme le canevas Design.

    py -3 docs/design/ui-v2/sources/bench.py [port]   (8790 par défaut ; 8765 est pris par le backend de l'app)

- /support.js  -> private/ui-v2/bench/support.js (runtime du canevas, copie locale non versionnée :
  Artifact read <canevas> path "artifact-type/dc-runtime.js")
- /_blob/<id>  -> fichier local déclaré dans assets.json
- /lab/...     -> docs/design/ui-v2/lab/ (scène 3D partagée)
- /models/...  -> frontend/public/models/
- le reste     -> docs/design/ui-v2/maquettes/
N'écoute que sur 127.0.0.1.
"""
import http.server, json, mimetypes, pathlib, sys

SRC = pathlib.Path(__file__).resolve().parent
UI = SRC.parent
ROOT = UI.parents[2]
ASSETS = json.loads((SRC / "assets.json").read_text(encoding="utf-8"))
BLOBS = {v["blob"]: ROOT / v["file"] for k, v in ASSETS.items() if not k.startswith("_")}
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")


class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p == "/support.js":
            return str(ROOT / "private/ui-v2/bench/support.js")
        if p.startswith("/_blob/"):
            f = BLOBS.get(p)
            return str(f) if f else str(UI / "__missing__")
        if p.startswith("/lab/"):
            return str(UI / "lab" / p[5:])
        if p.startswith("/models/"):
            return str(ROOT / "frontend/public/models" / p[8:])
        return str(UI / "maquettes" / p.lstrip("/"))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790  # 8765 est le port de l'app (backend)
    print(f"http://127.0.0.1:{port}/V-Accueil.dc.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
