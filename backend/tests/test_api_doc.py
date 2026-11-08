"""docs/API.md must list every route of the local API, and only routes that exist."""

import re
from pathlib import Path

from app.api import create_app

DOC = (Path(__file__).resolve().parents[2] / "docs" / "API.md").read_text(encoding="utf-8")


def _routes() -> set[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for r in create_app(":memory:").routes:
        path = getattr(r, "path", "")
        for m in getattr(r, "methods", None) or ():
            if m in ("HEAD", "OPTIONS"):
                continue
            if path.startswith("/api/v1/"):
                out.add((m, path))
    return out


def _documented() -> set[tuple[str, str]]:
    # table rows: | GET | `/api/v1/...` | and the "| POST | `/api/v1/x` `{body}` |" form
    return {(m, p) for m, p in re.findall(r"^\| (GET|POST|DELETE|PUT|PATCH) \| `(/api/v1/[^`?]+)", DOC, re.M)}


def test_every_route_is_documented():
    missing = sorted(_routes() - _documented())
    assert not missing, f"routes missing from docs/API.md: {missing}"


def test_documented_routes_exist():
    extra = sorted(_documented() - _routes())
    assert not extra, f"docs/API.md lists routes that do not exist: {extra}"


def test_only_the_live_route_is_described_as_reaching_a_printer():
    assert DOC.count("Only **`POST /api/v1/live/capture`** can open a connection to a printer") == 1
    assert "5 GET and 1 WebSocket message (11 GET if the live stream drops)" in DOC
