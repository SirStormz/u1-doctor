"""Build the self-contained presentation page.

Reads  scripts/presentation/index.src.html  (the readable source)
Writes docs/presentation/index.html          (one file: images and the 3D scene are inlined)

The page then opens from disk, from GitHub Pages or from any host, with no other file next to it.
Usage (from the repo root): py -3 scripts/build_presentation.py
"""
from __future__ import annotations

import base64
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "presentation" / "index.src.html"
OUT = ROOT / "docs" / "presentation" / "index.html"
MEDIA = ROOT / "docs" / "media"
BUNDLE = ROOT / "build" / "presentation-scene" / "scene.iife.js"


def bundle_scene() -> str:
    vite = ROOT / "frontend" / "node_modules" / ".bin" / ("vite.cmd" if sys.platform == "win32" else "vite")
    cfg = ROOT / "scripts" / "presentation" / "vite.config.mjs"
    subprocess.run([str(vite), "build", "--config", str(cfg)], cwd=ROOT / "frontend", check=True)
    return BUNDLE.read_text(encoding="utf-8")


MAX_W = {"hero.jpg": 1600}  # every other photo is displayed at <= 560 CSS px, 1100 px covers 2x screens


def data_uri(name: str) -> str:
    path = MEDIA / name
    raw = path.read_bytes()
    mime = "image/jpeg" if name.endswith(".jpg") else ("image/webp" if name.endswith(".webp") else "image/png")
    if name.endswith(".jpg"):
        try:  # shrink for the page only; the file in docs/media is untouched
            import io

            from PIL import Image

            im = Image.open(path).convert("RGB")
            limit = MAX_W.get(name, 1100)
            if im.width > limit:
                im = im.resize((limit, round(im.height * limit / im.width)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
            raw = buf.getvalue()
        except ImportError:
            pass
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def main() -> int:
    html = SRC.read_text(encoding="utf-8")
    html = re.sub(r"\{\{IMG:([\w.-]+)\}\}", lambda m: data_uri(m.group(1)), html)
    scene = bundle_scene().replace("</script", "<\\/script")
    html = html.replace("{{SCENE_JS}}", scene)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
