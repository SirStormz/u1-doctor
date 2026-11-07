"""U1-DEB v1: U1 Diagnostic Evidence Bundle export / safe import / replay.

Pure: no network, no machine access, no code execution on import. SHA-256 proves integrity only,
never authenticity or machine origin. Runtime has no jsonschema dependency: validation is manual and
cross-checked against schemas/*.json in tests.
"""
from __future__ import annotations

import io
import json
import re
import stat
import zipfile
from datetime import UTC, datetime
from typing import Any

from .engine import canon, evaluate, ruleset_hash, sort_observations
from .engine.canonical import sha256_hex
from .knowledge import load_catalog
from .support import TEXT
from .support import checklist as support_checklist

FORMAT = "U1-DEB"
FORMAT_VERSION = "1.1.0"
INTEGRITY_NOTICE = ("SHA-256 proves integrity of these files only; it does not prove authenticity of the author "
                    "or that the data came from a specific machine.")
SUPPORT_FILE = "support-checklist.json"  # optional, added in 1.1.0
SUPPORT_FORMAT = "u1-support-checklist/1"
MAX_SUPPORT_ITEMS = 200
PAYLOAD_FILES = ("observations.jsonl", "findings.json", "compatibility.json", "knowledge-refs.json", "privacy-report.json", "README.txt", SUPPORT_FILE)
REQUIRED_FILES = ("observations.jsonl", "findings.json")
ALLOWED_NAMES = frozenset(PAYLOAD_FILES) | {"manifest.json"}

MAX_ZIP_BYTES = 50 * 1024 * 1024
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
MAX_RATIO = 200
MAX_OBSERVATIONS = 200_000
MAX_LINE_BYTES = 64 * 1024

SOURCE_STATUS = ("REAL", "SYNTHETIC", "USER_REPORTED", "IMPORTED")
_ID = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
_REF = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./ \-]{0,127}$")
_TYPE = re.compile(r"^[a-z0-9_]{1,64}$")
_ENUMS = {
    "source_kind": ("MOONRAKER", "USER", "IMPORT", "DEMO"),
    "source_status": SOURCE_STATUS,
    "timestamp_quality": ("RECEIPT_ONLY", "SOURCE_WALLCLOCK", "MONOTONIC_MAPPED", "UNKNOWN"),
    "entity_id": ("printer", "toolhead_1", "toolhead_2", "toolhead_3", "toolhead_4", "unmapped"),
    "mapping_quality": ("VERIFIED", "INFERRED", "UNKNOWN"),
    "validity": ("FRESH", "STALE", "UNAVAILABLE", "MALFORMED"),
}
_OBS_KEYS = frozenset(("schema_version", "observation_id", "session_id", "source_kind", "source_status", "capture_utc", "source_timestamp",
                       "timestamp_quality", "source_ref", "entity_id", "mapping_quality", "event_type", "value", "validity", "sensitive"))
_OBS_REQUIRED = _OBS_KEYS - {"source_timestamp"}
_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
_VERSION = re.compile(r"^1\.\d+\.\d+$")
_SHA = re.compile(r"^[0-9a-f]{64}$")
_RS_HASH = re.compile(r"^sha256:[0-9a-f]{64}$")

# Redaction: values that must never leave the owner's machine in the default format.
_PRIVATE = (
    ("ipv4", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    ("mac", re.compile(r"\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b")),
    ("email", re.compile(r"[^\s@]+@[^\s@]+\.[A-Za-z]{2,}")),
    ("url", re.compile(r"\b[a-z][a-z0-9+.-]*://", re.IGNORECASE)),
    ("path", re.compile(r"(?:[A-Za-z]:\\|\\\\|/(?:home|Users|root|mnt|media|var|tmp|etc)/)")),
    ("print_file", re.compile(r"\.(?:gcode|gco|3mf|ufp|bgcode)\b", re.IGNORECASE)),
)


class BundleError(ValueError):
    """Bundle refused. `code` is a stable machine-readable reason."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------- validation
def validate_observation(o: Any) -> None:
    if not isinstance(o, dict):
        raise BundleError("BAD_OBSERVATION", "observation is not an object")
    keys = set(o)
    if not _OBS_REQUIRED <= keys or not keys <= _OBS_KEYS:
        raise BundleError("BAD_OBSERVATION", "observation has missing or unexpected fields")
    if o["schema_version"] != "1.0":
        raise BundleError("UNSUPPORTED_SCHEMA", "observation schema_version must be 1.0")
    for k in ("observation_id", "session_id"):
        if not isinstance(o[k], str) or not _ID.fullmatch(o[k]):
            raise BundleError("BAD_OBSERVATION", f"invalid {k}")
    for k, allowed in _ENUMS.items():
        if o[k] not in allowed:
            raise BundleError("BAD_OBSERVATION", f"invalid {k}")
    if not isinstance(o["capture_utc"], str) or not _UTC.fullmatch(o["capture_utc"]):
        raise BundleError("BAD_OBSERVATION", "capture_utc must be an UTC ISO timestamp ending in Z")
    ts = o.get("source_timestamp")
    if ts is not None and (isinstance(ts, bool) or not isinstance(ts, int | float)):
        raise BundleError("BAD_OBSERVATION", "source_timestamp must be a number or null")
    ref = o["source_ref"]
    if not isinstance(ref, str) or not _REF.fullmatch(ref) or "//" in ref or ".." in ref:
        raise BundleError("BAD_OBSERVATION", "invalid source_ref")
    if not isinstance(o["event_type"], str) or not _TYPE.fullmatch(o["event_type"]):
        raise BundleError("BAD_OBSERVATION", "invalid event_type")
    if not isinstance(o["sensitive"], bool):
        raise BundleError("BAD_OBSERVATION", "sensitive must be boolean")
    if o["entity_id"].startswith("toolhead_") and o["mapping_quality"] == "UNKNOWN":
        raise BundleError("BAD_OBSERVATION", "toolhead entity requires VERIFIED or INFERRED mapping")
    if o["source_kind"] == "DEMO" and o["source_status"] != "SYNTHETIC":
        raise BundleError("BAD_OBSERVATION", "DEMO source must be SYNTHETIC")
    if o["source_status"] == "SYNTHETIC" and "synthetic" not in o["observation_id"]:
        raise BundleError("BAD_OBSERVATION", "SYNTHETIC observation id must contain 'synthetic'")


def _strict_json(raw: bytes, what: str) -> Any:
    def refuse(c: str) -> Any:
        raise ValueError(c)

    try:
        return json.loads(raw.decode("utf-8"), parse_constant=refuse)
    except (UnicodeDecodeError, ValueError, RecursionError) as e:
        raise BundleError("BAD_JSON", f"{what} is not valid UTF-8 JSON") from e


def _parse_jsonl(raw: bytes) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line in raw.split(b"\n"):
        if not line:
            continue
        if len(line) > MAX_LINE_BYTES:
            raise BundleError("BAD_OBSERVATION", "observation line too long")
        if len(out) >= MAX_OBSERVATIONS:
            raise BundleError("TOO_LARGE", "too many observations")
        o = _strict_json(line, "observation line")
        validate_observation(o)
        out.append(o)
    ids = [o["observation_id"] for o in out]
    if len(set(ids)) != len(ids):
        raise BundleError("BAD_OBSERVATION", "duplicate observation_id")
    return out


def validate_manifest(m: Any) -> None:
    if not isinstance(m, dict):
        raise BundleError("BAD_MANIFEST", "manifest is not an object")
    allowed = {"format", "format_version", "app_version", "generated_at", "ruleset", "source_mix", "firmware_claim", "capture_windows",
               "files", "limits", "integrity_notice"}
    required = allowed - {"generated_at", "firmware_claim"}
    if not required <= set(m) or not set(m) <= allowed:
        raise BundleError("BAD_MANIFEST", "manifest has missing or unexpected fields")
    if m["format"] != FORMAT:
        raise BundleError("BAD_MANIFEST", "not a U1-DEB bundle")
    if not isinstance(m["format_version"], str):
        raise BundleError("BAD_MANIFEST", "invalid format_version")
    if not _VERSION.fullmatch(m["format_version"]):
        raise BundleError("UNSUPPORTED_VERSION", f"format_version {m['format_version'][:16]!r} is not supported (need 1.x.y)")
    if m["integrity_notice"] != INTEGRITY_NOTICE:
        raise BundleError("BAD_MANIFEST", "integrity_notice altered")
    rs = m["ruleset"]
    if (not isinstance(rs, dict) or set(rs) != {"id", "version", "hash"} or not all(isinstance(rs[k], str) for k in rs)
            or not _RS_HASH.fullmatch(rs["hash"])):
        raise BundleError("BAD_MANIFEST", "invalid ruleset")
    mix = m["source_mix"]
    if not isinstance(mix, list) or not mix or any(x not in SOURCE_STATUS for x in mix):
        raise BundleError("BAD_MANIFEST", "invalid source_mix")
    if not isinstance(m["limits"], list) or not m["limits"] or not all(isinstance(x, str) for x in m["limits"]):
        raise BundleError("BAD_MANIFEST", "invalid limits")
    if not isinstance(m["app_version"], str) or not isinstance(m["capture_windows"], list):
        raise BundleError("BAD_MANIFEST", "invalid app_version or capture_windows")
    files = m["files"]
    if not isinstance(files, list) or not 1 <= len(files) <= 16:
        raise BundleError("BAD_MANIFEST", "invalid files list")
    seen: set[str] = set()
    for f in files:
        if (not isinstance(f, dict) or set(f) != {"name", "sha256", "bytes"} or f["name"] not in PAYLOAD_FILES
                or not isinstance(f["sha256"], str) or not _SHA.fullmatch(f["sha256"])
                or isinstance(f["bytes"], bool) or not isinstance(f["bytes"], int) or not 0 <= f["bytes"] <= MAX_FILE_BYTES):
            raise BundleError("BAD_MANIFEST", "invalid file entry")
        if f["name"] in seen:
            raise BundleError("BAD_MANIFEST", "duplicate file entry")
        seen.add(f["name"])
    if not set(REQUIRED_FILES) <= seen:
        raise BundleError("BAD_MANIFEST", "observations.jsonl and findings.json are required")


# ---------------------------------------------------------------- redaction
def _scrub(value: Any, counts: dict[str, int]) -> Any:
    if isinstance(value, str):
        for name, rx in _PRIVATE:
            if rx.search(value):
                counts[name] = counts.get(name, 0) + 1
                return "[REDACTED]"
        return value
    if isinstance(value, list):
        return [_scrub(v, counts) for v in value]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            if any(rx.search(k) for _, rx in _PRIVATE):
                counts["key"] = counts.get("key", 0) + 1
                k = "[REDACTED_KEY]"
            out[k] = _scrub(v, counts)
        return out
    return value


def redact(observations: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    counts: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    for o in observations:
        validate_observation(o)
        c = dict(o)
        if o["sensitive"]:
            counts["sensitive_value"] = counts.get("sensitive_value", 0) + 1
            c["value"] = {"redacted": True}
        else:
            c["value"] = _scrub(o["value"], counts)
        out.append(c)
    return out, counts


# ---------------------------------------------------------------- support checklist (1.1.0)
_CODE = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{4}$")


def _support_doc(obs: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Support asks for the error codes declared in the observations: ids only, no wiki text. None when no code was declared."""
    codes = sorted({o["value"]["code"] for o in obs if o["event_type"] == "user_reported_error_code"
                    and isinstance(o["value"], dict) and isinstance(o["value"].get("code"), str)})
    items: list[dict[str, Any]] = []
    for code in codes[:MAX_SUPPORT_ITEMS]:
        try:
            c = support_checklist(code)
        except ValueError:
            continue  # malformed declarations are already reported by the code rule
        items.append({"code": code, "status": c["status"], "title": c["title"],
                      "asks": [{"id": i["id"], "source": i["source"]} for i in c["items"]]})
    if not items:
        return None
    return {"format": SUPPORT_FORMAT, "catalog_version": load_catalog()["catalog_version"], "items": items,
            "note": "Ask ids only; the texts live in U1 Doctor. Derived from declared codes with the local catalog. Not an official support request."}


def _check_support(doc: Any) -> dict[str, Any]:
    ok = (isinstance(doc, dict) and set(doc) == {"format", "catalog_version", "items", "note"} and doc["format"] == SUPPORT_FORMAT
          and isinstance(doc["catalog_version"], str) and len(doc["catalog_version"]) <= 32 and isinstance(doc["note"], str) and len(doc["note"]) <= 300
          and isinstance(doc["items"], list) and 1 <= len(doc["items"]) <= MAX_SUPPORT_ITEMS)
    if ok:
        for it in doc["items"]:
            if not (isinstance(it, dict) and set(it) == {"code", "status", "title", "asks"} and isinstance(it["code"], str) and _CODE.fullmatch(it["code"])
                    and it["status"] in ("KNOWN", "STRUCTURE_ONLY") and (it["title"] is None or (isinstance(it["title"], str) and len(it["title"]) <= 200))
                    and isinstance(it["asks"], list) and 1 <= len(it["asks"]) <= len(TEXT)
                    and all(isinstance(a, dict) and set(a) == {"id", "source"} and a["id"] in TEXT and a["source"] in ("wiki", "suggested") for a in it["asks"])):
                ok = False
                break
    if not ok:
        raise BundleError("BAD_JSON", f"{SUPPORT_FILE} is not a valid support checklist")
    return doc  # type: ignore[no-any-return]


# ---------------------------------------------------------------- export
def _jsonl(obs: list[dict[str, Any]]) -> bytes:
    return b"".join(canon(o) + b"\n" for o in obs)


def _windows(obs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by: dict[str, list[dict[str, Any]]] = {}
    for o in obs:
        by.setdefault(o["session_id"], []).append(o)
    out = []
    for sid in sorted(by):
        group = by[sid]
        times = sorted(o["capture_utc"] for o in group)
        gaps = sorted(
            ({"start_utc": o["value"]["start"], "end_utc": o["value"]["end"]} for o in group
             if o["event_type"] == "capture_gap" and isinstance(o["value"], dict)
             and isinstance(o["value"].get("start"), str) and isinstance(o["value"].get("end"), str)),
            key=lambda g: (g["start_utc"], g["end_utc"]))
        out.append({"session_id": sid, "start_utc": times[0], "end_utc": times[-1], "gaps": gaps})
    return out


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in ["manifest.json", *sorted(n for n in files if n != "manifest.json")]:
            zi = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o100644 << 16
            z.writestr(zi, files[name])
    return buf.getvalue()


def export_bundle(observations: list[dict[str, Any]], ruleset: dict[str, Any], *, app_version: str, firmware_claim: str = "UNKNOWN",
                  extra_limits: list[str] | None = None, generated_at: str | None = None) -> bytes:
    """Deterministic bundle: same inputs (and generated_at) give byte-identical zips."""
    if not observations:
        raise BundleError("EMPTY", "nothing to export")
    red, counts = redact(observations)
    obs = sort_observations(red)
    findings = evaluate(obs, ruleset)
    rs_hash = ruleset_hash(ruleset)
    mix = sorted({o["source_status"] for o in obs})
    cat = load_catalog()
    types: dict[str, int] = {}
    for o in obs:
        types[o["event_type"]] = types.get(o["event_type"], 0) + 1
    mapping: dict[str, int] = {}
    for o in obs:
        mapping[o["mapping_quality"]] = mapping.get(o["mapping_quality"], 0) + 1
    payload = {
        "observations.jsonl": _jsonl(obs),
        "findings.json": canon(findings) + b"\n",
        "compatibility.json": canon({
            "firmware_claim": firmware_claim,
            "observed_event_types": types,
            "mapping_quality_counts": mapping,
            "notes": ["Absent event types mean 'not observed', not 'not supported'.",
                      "Toolhead mapping is only as good as mapping_quality says."]}) + b"\n",
        "knowledge-refs.json": canon({
            "ruleset": {"id": ruleset["ruleset_id"], "version": ruleset["version"], "hash": rs_hash},
            "rules": [{"id": r["id"], "version": r["version"], "status": r["status"]} for r in ruleset["rules"]],
            "error_catalog": {"version": cat["catalog_version"], "verified_at": cat["last_verified_at"], "source_url": cat["source_url"]},
            "note": "References only; no copied wiki text."}) + b"\n",
        "privacy-report.json": canon({
            "rules": [n for n, _ in _PRIVATE] + ["sensitive_value", "key"],
            "redactions": dict(sorted(counts.items())),
            "default_exclusions": ["IP addresses", "hostnames", "file names", "local paths", "serial numbers", "credentials"],
            "remaining_fields": "Allowlisted derived observation fields only; review before sharing publicly.",
            "automatic_redaction_is_best_effort": True}) + b"\n",
        "README.txt": (
            "U1 Diagnostic Evidence Bundle (U1-DEB) v1\n"
            "Produced by U1 Doctor (unofficial, not affiliated with Snapmaker). Read-only forensics: it never commands the printer.\n"
            "Replay: re-run the deterministic rules in findings.json's ruleset over observations.jsonl; results must match byte for byte.\n"
            f"Source mix: {', '.join(mix)}. SYNTHETIC means fabricated demo data, not a real machine.\n"
            "Integrity: SHA-256 proves these files are unchanged. It does NOT prove who made them or that they came from a real U1.\n"
            "Privacy: redaction is best-effort; review the content and obtain consent before sharing.\n"
            "Spec: docs/U1-DEB.md in the U1 Doctor repository.\n").encode(),
    }
    support = _support_doc(obs)
    if support is not None:
        payload[SUPPORT_FILE] = canon(support) + b"\n"
    manifest = {
        "format": FORMAT, "format_version": FORMAT_VERSION, "app_version": app_version,
        "generated_at": generated_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ruleset": {"id": ruleset["ruleset_id"], "version": ruleset["version"], "hash": rs_hash},
        "source_mix": mix, "firmware_claim": firmware_claim, "capture_windows": _windows(obs),
        "files": [{"name": n, "sha256": sha256_hex(payload[n]), "bytes": len(payload[n])} for n in PAYLOAD_FILES if n in payload],
        "limits": ["Best-effort redaction.", "Integrity only: not proof of authorship or machine origin.",
                   "Findings are inferences from the listed observations, not verified diagnoses.", *(extra_limits or [])],
        "integrity_notice": INTEGRITY_NOTICE,
    }
    validate_manifest(manifest)
    return _zip({**payload, "manifest.json": canon(manifest) + b"\n"})


# ---------------------------------------------------------------- safe import
def _read_entries(data: bytes) -> dict[str, bytes]:
    if len(data) > MAX_ZIP_BYTES:
        raise BundleError("TOO_LARGE", "bundle larger than 50 MiB")
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        raise BundleError("NOT_A_ZIP", "not a valid zip file") from e
    with z:
        infos = z.infolist()
        if len(infos) > len(ALLOWED_NAMES):
            raise BundleError("BAD_ENTRY", "too many entries")
        names = [i.filename for i in infos]
        if len(set(names)) != len(names):
            raise BundleError("BAD_ENTRY", "duplicate entry names")
        total = 0
        out: dict[str, bytes] = {}
        for i in infos:
            if i.filename not in ALLOWED_NAMES:  # also rejects "../x", absolute paths, subdirectories, unexpected files
                raise BundleError("BAD_ENTRY", "unexpected entry name")
            if i.flag_bits & 0x1:
                raise BundleError("BAD_ENTRY", "encrypted entries are not allowed")
            if stat.S_IFMT(i.external_attr >> 16) not in (0, stat.S_IFREG):
                raise BundleError("BAD_ENTRY", "only regular files are allowed")
            if i.file_size > MAX_FILE_BYTES or i.compress_size and i.file_size / i.compress_size > MAX_RATIO:
                raise BundleError("TOO_LARGE", "entry too large or suspicious compression ratio")
            total += i.file_size
            if total > MAX_TOTAL_BYTES:
                raise BundleError("TOO_LARGE", "uncompressed size too large")
            with z.open(i) as fh:
                blob = fh.read(MAX_FILE_BYTES + 1)  # bounded: do not trust the declared size
            if len(blob) > MAX_FILE_BYTES or len(blob) != i.file_size:
                raise BundleError("TOO_LARGE", "entry size mismatch")
            out[i.filename] = blob
    if "manifest.json" not in out:
        raise BundleError("BAD_MANIFEST", "manifest.json missing")
    return out


def import_bundle(data: bytes, ruleset: dict[str, Any]) -> dict[str, Any]:
    """Validate a third-party bundle without executing anything, then replay it with the local ruleset."""
    return import_bundle_with_observations(data, ruleset)[0]


def import_bundle_with_observations(data: bytes, ruleset: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Same validation as import_bundle; also returns the validated observations (for saving to the local history)."""
    entries = _read_entries(data)
    manifest = _strict_json(entries["manifest.json"], "manifest.json")
    validate_manifest(manifest)
    listed = {f["name"]: f for f in manifest["files"]}
    if set(listed) != set(entries) - {"manifest.json"}:
        raise BundleError("BAD_MANIFEST", "files in the zip do not match the manifest")
    for name, f in listed.items():
        if len(entries[name]) != f["bytes"] or sha256_hex(entries[name]) != f["sha256"]:
            raise BundleError("HASH_MISMATCH", f"{name}: size or SHA-256 does not match the manifest")
    obs = _parse_jsonl(entries["observations.jsonl"])
    if not obs:
        raise BundleError("EMPTY", "bundle has no observations")
    claimed = _strict_json(entries["findings.json"], "findings.json")
    if not isinstance(claimed, list):
        raise BundleError("BAD_JSON", "findings.json must be a list")
    support_view: dict[str, Any] = {"present": SUPPORT_FILE in entries, "codes": [], "matches_local": None}
    if SUPPORT_FILE in entries:
        doc = _check_support(_strict_json(entries[SUPPORT_FILE], SUPPORT_FILE))
        mine = _support_doc(obs)
        support_view["codes"] = [it["code"] for it in doc["items"]]
        if doc["catalog_version"] == load_catalog()["catalog_version"]:
            support_view["matches_local"] = mine is not None and canon(doc) == canon(mine)
    local_hash = ruleset_hash(ruleset)
    same = manifest["ruleset"]["hash"] == local_hash
    findings = evaluate(obs, ruleset) if same else None
    return {
        "mode": "IMPORTED",
        "source_status": "IMPORTED",
        "origin_source_mix": manifest["source_mix"],
        "bundle_sha256": sha256_hex(data),
        "format_version": manifest["format_version"],
        "app_version": manifest["app_version"],
        "firmware_claim": manifest.get("firmware_claim", "UNKNOWN"),
        "observation_count": len(obs),
        "capture_windows": manifest["capture_windows"],
        "files": manifest["files"],
        "ruleset": {**manifest["ruleset"], "local_hash": local_hash, "same_as_local": same},
        "replay": {"performed": same, "matches_bundle": (canon(findings) == canon(claimed)) if same else None,
                   "findings_sha256": sha256_hex(canon(findings) + b"\n") if findings is not None else None},
        "findings": findings if findings is not None else claimed,
        "findings_are_recomputed": same,
        "support_checklist": support_view,
        "limits": manifest["limits"],
        "integrity_notice": INTEGRITY_NOTICE,
    }, obs


def summarize_bundle(blob: bytes) -> dict[str, Any]:
    """Manifest + privacy report of a bundle we just produced (for UI preview)."""
    entries = _read_entries(blob)
    return {"manifest": json.loads(entries["manifest.json"]), "privacy": json.loads(entries["privacy-report.json"])}
