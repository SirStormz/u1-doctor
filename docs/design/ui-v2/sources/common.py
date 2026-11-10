"""Outils communs aux scripts build{E,F,P,V}.py."""
import json, pathlib, re

B = pathlib.Path(__file__).parent
ASSETS = {k: v for k, v in json.loads((B / "assets.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}


def assets(t: str) -> str:
    """@@A:nom@@ -> adresse d'asset (blob du canevas, ou /_blob/local-… servi par bench.py)."""
    return re.sub(r"@@A:([\w-]+)@@", lambda m: ASSETS[m.group(1)]["blob"], t)


def check(t: str, name: str) -> None:
    assert "@@" not in t, name
    assert "—" not in t and "–" not in t, name + " : tiret long interdit"
