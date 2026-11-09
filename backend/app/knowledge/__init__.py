"""Offline U1 error-code decoder (S01). Pure; no network."""
from __future__ import annotations

import json
import re
import unicodedata
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


COMMUNITY_PATH = ROOT / "knowledge" / "u1_community_causes.json"
MESSAGES_PATH = ROOT / "knowledge" / "u1_messages.json"


@lru_cache(maxsize=1)
def load_community_causes(path: Path = COMMUNITY_PATH) -> dict[str, Any]:
    """Forum-reported causes (own wording + topic link). Always a COMMUNITY_REPORT: never official, never observed."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    ids = [c["id"] for c in data["causes"]]
    assert len(set(ids)) == len(ids), "duplicate community-cause id"
    return data


@lru_cache(maxsize=1)
def load_messages(path: Path = MESSAGES_PATH) -> dict[str, Any]:
    """Curated messages that carry no code (own wording; official link only when one exists)."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    ids = [m["id"] for m in data["messages"]]
    assert len(set(ids)) == len(ids), "duplicate message id"
    return data


FIRMWARE_ISSUES_PATH = ROOT / "knowledge" / "u1_firmware_issues.json"


@lru_cache(maxsize=1)
def load_firmware_issues(path: Path = FIRMWARE_ISSUES_PATH) -> dict[str, Any]:
    """Known issues per firmware version (own wording + source links, dated). May be out of date; never ranked."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    ids = [i["id"] for i in data["issues"]]
    assert len(set(ids)) == len(ids), "duplicate firmware-issue id"
    return data


GOOD_TO_KNOW_PATH = ROOT / "knowledge" / "u1_good_to_know.json"


@lru_cache(maxsize=1)
def load_good_to_know(path: Path = GOOD_TO_KNOW_PATH) -> dict[str, Any]:
    """Static good-to-know notes from the forum (own wording + topic links, dated). Always a COMMUNITY_REPORT, never official."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    ids = [n["id"] for n in data["notes"]]
    assert len(set(ids)) == len(ids), "duplicate good-to-know id"
    return data


LOG_SIGNALS_PATH = ROOT / "knowledge" / "u1_log_signals.json"


@lru_cache(maxsize=1)
def load_log_signals(path: Path = LOG_SIGNALS_PATH) -> dict[str, Any]:
    """Machine exceptions seen in real logs whose code is not in the official table (own wording, EN/FR). Not official."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    codes = [x["code"] for x in data["signals"]]
    assert len(set(codes)) == len(codes), "duplicate log-signal code"
    return data


def log_signal(code: str) -> dict[str, Any] | None:
    return next((x for x in load_log_signals()["signals"] if x["code"] == code), None)


def firmware_issues_for(version: str) -> list[dict[str, Any]]:
    """Issues whose affected range [min, max] contains the stated version (open bounds allowed), in file order."""
    v = parse_firmware(version)
    if v is None:
        return []
    out = []
    for i in load_firmware_issues()["issues"]:
        lo, hi = (parse_firmware(i["affected"][k]) if i["affected"][k] else None for k in ("min", "max"))
        if (lo is None or v >= lo) and (hi is None or v <= hi):
            out.append(i)
    return out


def community_for(code: str) -> list[dict[str, Any]]:
    """Community reports attached to an exact code, in file order (never ranked)."""
    return [c for c in load_community_causes()["causes"] if code in c["codes"]]


_TYPO = str.maketrans({"o": "0", "O": "0", "l": "1", "I": "1", "i": "1"})
_GROUPS = re.compile(r"[0-9]+")


def normalize_code(raw: object) -> str | None:
    """Best-effort canonical form of a typed code: NFKC digits, any separator, o->0 / l,I->1, short groups zero-padded.
    Returns None when the text does not look like four digit groups. A suggestion only: never decoded silently."""
    if not isinstance(raw, str) or len(raw) > 64:
        return None
    s = unicodedata.normalize("NFKC", raw).strip().translate(_TYPO)
    if re.search(r"[A-Za-z]", s):
        return None
    groups = _GROUPS.findall(s)
    if len(groups) == 1 and len(groups[0]) == 16:
        g = groups[0]
        groups = [g[0:4], g[4:8], g[8:12], g[12:16]]
    if len(groups) != 4 or any(len(g) > 4 for g in groups):
        return None
    return "-".join(g.zfill(4) for g in groups)


_EXC_KEYS = ("level", "id", "index", "code")


def exception_code(raw: object) -> str | None:
    """The on-screen code rebuilt from a pasted exception (`{'id': 523, 'index': 3, 'code': 38, 'level': 2, ...}` from Moonraker or Fluidd).

    The code is level-id-index-code, four digits each (checked on 11 real events against the official table). None when the four fields are not all there.
    """
    if not isinstance(raw, str) or len(raw) > 400:
        return None
    vals = []
    for k in _EXC_KEYS:
        m = re.search(rf"[\"']?\b{k}[\"']?\s*[:=]\s*(\d{{1,4}})\b", raw)
        if not m:
            return None
        vals.append(m[1].zfill(4))
    return "-".join(vals)


def _lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def suggest_codes(raw: object, limit: int = 3, max_distance: int = 3) -> list[str]:
    """Up to `limit` catalog codes closest to a mistyped one (edit distance on the digits, then code order).
    Distance only orders the list of spellings; it says nothing about the fault."""
    if not isinstance(raw, str) or len(raw) > 64:
        return []
    by = load_catalog()["_by_code"]
    norm = normalize_code(raw)
    if norm is not None and norm in by:
        return [norm]
    digits = "".join(_GROUPS.findall(unicodedata.normalize("NFKC", raw).translate(_TYPO)))
    if len(digits) < 8:
        return []
    keys = [norm.replace("-", "")] if norm else []
    keys.append(digits)
    scored = []
    for code in by:
        flat = code.replace("-", "")
        d = min(_lev(k, flat) for k in keys)
        if d <= max_distance:
            scored.append((d, code))
    scored.sort()
    return [c for _, c in scored[:limit]]


def match_messages(text: object) -> list[dict[str, Any]]:
    """Curated messages whose pattern appears in the text (case-insensitive substring), in file order."""
    if not isinstance(text, str) or not text.strip():
        return []
    low = " ".join(text.lower().split())
    return [m for m in load_messages()["messages"] if any(p in low for p in m["patterns"])]


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
