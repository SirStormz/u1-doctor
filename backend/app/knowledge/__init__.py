"""Offline U1 error-code decoder (S01). Pure; no network."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..paths import ROOT

CATALOG_PATH = ROOT / "knowledge" / "u1_codes.json"
KNOWN_ISSUES_PATH = ROOT / "knowledge" / "u1_known_issues.json"
_CODE_RE = re.compile(r"[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}", re.ASCII)
MAX_INPUT_LEN = 32


class MalformedCode(ValueError):
    pass


@lru_cache(maxsize=1)
def load_catalog(path: Path = CATALOG_PATH) -> dict[str, Any]:
    cat = json.loads(path.read_text(encoding="utf-8"))
    cat["_by_code"] = {e["code"]: e for e in cat["entries"]}
    assert len(cat["_by_code"]) == len(cat["entries"]), "duplicate code in catalog"
    return cat


@lru_cache(maxsize=1)
def load_known_issues(path: Path = KNOWN_ISSUES_PATH) -> dict[str, Any]:
    """Documented quick fixes from the official wiki (own wording). Advice only: nothing here is ever executed."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    ids = [i["id"] for i in data["issues"]]
    assert len(set(ids)) == len(ids), "duplicate known-issue id"
    return data


def parse_code(raw: object) -> tuple[str, str, str, str]:
    if not isinstance(raw, str) or len(raw) > MAX_INPUT_LEN or not raw.isascii():
        raise MalformedCode("code must be ASCII text like dddd-dddd-dddd-dddd")
    if _CODE_RE.fullmatch(raw) is None:
        raise MalformedCode("code must match dddd-dddd-dddd-dddd (digits only, no spaces)")
    a, b, c, d = raw.split("-")
    return a, b, c, d


_FW_RE = re.compile(r"^[vV]?(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:[ -]?(?:beta|rc\d*))?$", re.ASCII)


def parse_firmware(raw: object) -> tuple[int, int, int] | None:
    """'2.1.0', 'V2.1.0' or '1.5.2 beta' -> (2, 1, 0); anything else -> None (never guessed)."""
    if not isinstance(raw, str) or len(raw) > 32:
        return None
    m = _FW_RE.fullmatch(raw.strip())
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def firmware_view(entry: dict[str, Any] | None, firmware: str | None) -> dict[str, Any]:
    """Release-note facts for a code, compared with the firmware the user states (never read from the machine here)."""
    latest = load_catalog().get("firmware_latest")
    given = parse_firmware(firmware) if firmware else None
    lv = parse_firmware(latest["version"]) if latest else None
    notes = []
    for n in (entry or {}).get("fw_notes", []):
        item = {k: n[k] for k in ("component", "version", "kind", "text", "source")}
        nv = parse_firmware(n["version"]) if n["component"] == "firmware" else None
        item["applies"] = None if given is None or nv is None else ("INCLUDED" if given >= nv else "BEFORE")
        notes.append(item)
    return {"given": firmware or None, "valid": None if not firmware else given is not None, "latest": latest,
            "behind_latest": None if given is None or lv is None else given < lv, "notes": notes}


def interpret(raw: object, firmware: str | None = None) -> dict[str, Any]:
    """Return a decoding. Never invents: unknown stays INCONCLUSIVE."""
    cat = load_catalog()
    try:
        lvl, mod, idx, num = parse_code(raw)
    except MalformedCode as exc:
        return {"status": "MALFORMED", "classification": "INCONCLUSIVE", "reason": str(exc)}
    level = cat["levels"].get(lvl)
    module = cat["modules"].get(mod)
    entry = cat["_by_code"].get(raw)
    out: dict[str, Any] = {
        "code": raw,
        "level": lvl,
        "severity": level["name"] if level else None,
        "module_code": mod,
        "module": module,
        "index": idx,
        "number": num,
    }
    if entry:
        out.update(status="KNOWN", classification="OBSERVED", entry=entry)
    else:
        out.update(status="STRUCTURE_ONLY", classification="INCONCLUSIVE", entry=None)
    if firmware is not None or (entry and entry.get("fw_notes")):
        out["firmware"] = firmware_view(entry, firmware)
    return out
