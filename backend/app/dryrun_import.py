"""Import a U1 Dry Run `report.json` (github.com/DesignMaster-Solutions/u1-dryrun, GPL-3.0) as IMPORTED evidence.

We read its JSON output only; no code from that project is used. The data is a *prediction* made by simulating a
sliced file on the firmware code, never an observation of a machine. It is labelled IMPORTED, entity `unmapped`,
timestamp quality UNKNOWN, and the print file name is dropped (privacy). Pure: no network, nothing executed.
"""
from __future__ import annotations

import json
import math
from typing import Any

MAX_BYTES = 5 * 1024 * 1024
MAX_ITEMS = 1000       # per list; the excess is counted, not stored
MAX_TEXT = 300
SESSION = "dryrun_import"
SOURCE_REF = "dryrun/report.json"
NOTICE = ("Predicted by simulating the sliced file on the U1 firmware code (U1 Dry Run). Not an observation of a machine: "
          "the tool states its predicted scars are not checked on a physical print and it models no heating, flow or sensors.")


class DryRunError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _reject_constant(name: str) -> Any:
    raise DryRunError("BAD_JSON", f"{name} is not allowed")


def _num(v: Any, what: str, *, integer: bool = False) -> float | int:
    if isinstance(v, bool) or not isinstance(v, int | float) or (isinstance(v, float) and not math.isfinite(v)):
        raise DryRunError("BAD_REPORT", f"{what} must be a finite number")
    if integer and not isinstance(v, int):
        raise DryRunError("BAD_REPORT", f"{what} must be an integer")
    return v


def _opt_num(d: dict[str, Any], key: str) -> float | int | None:
    v = d.get(key)
    return None if v is None else _num(v, key)


def _text(v: Any, what: str) -> str:
    if not isinstance(v, str):
        raise DryRunError("BAD_REPORT", f"{what} must be a string")
    return v[:MAX_TEXT]


def _list(r: dict[str, Any], key: str) -> list[dict[str, Any]]:
    v = r.get(key)
    if not isinstance(v, list) or not all(isinstance(x, dict) for x in v):
        raise DryRunError("BAD_REPORT", f"{key} must be a list of objects")
    return v


def normalize(raw: bytes, imported_at_utc: str) -> dict[str, Any]:
    """Validate a Dry Run report and return observations + summary. `imported_at_utc` is `YYYY-MM-DDTHH:MM:SSZ`."""
    if len(raw) > MAX_BYTES:
        raise DryRunError("TOO_LARGE", "report larger than 5 MiB")
    try:
        r = json.loads(raw.decode("utf-8"), parse_constant=_reject_constant)
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise DryRunError("BAD_JSON", "report is not valid UTF-8 JSON") from e
    if not isinstance(r, dict) or not {"file", "moves", "tool_changes", "errors", "scars"} <= set(r):
        raise DryRunError("BAD_REPORT", "not a U1 Dry Run report (missing file/moves/tool_changes/errors/scars)")

    errors, scars = _list(r, "errors"), _list(r, "scars")
    summary = {
        "moves": _num(r["moves"], "moves", integer=True),
        "tool_changes": _num(r["tool_changes"], "tool_changes", integer=True),
        "motion_time_s": _opt_num(r, "motion_time_s"),
        "firmware_motion_s": _opt_num(r, "firmware_motion_s"),
        "error_count": len(errors),
        "scar_count": len(scars),
        "clean": not errors and not scars,
        "truncated": len(errors) > MAX_ITEMS or len(scars) > MAX_ITEMS,
    }
    values: list[tuple[str, dict[str, Any]]] = [("dryrun_summary", summary)]
    for err in errors[:MAX_ITEMS]:
        values.append(("dryrun_firmware_error", {"line": _num(err.get("line"), "error.line", integer=True), "message": _text(err.get("message"), "error.message")}))
    for s in scars[:MAX_ITEMS]:
        values.append(("dryrun_scar", {
            "line": _num(s.get("line"), "scar.line", integer=True), "source": _text(s.get("source"), "scar.source"),
            "tool": _text(s.get("tool"), "scar.tool"), "z": _num(s.get("z"), "scar.z"),
            "length_mm": _num(s.get("length_mm"), "scar.length_mm"), "clearance_mm": _num(s.get("clearance_mm"), "scar.clearance_mm")}))
    m = r.get("start_margin")
    if m is not None:
        if not isinstance(m, dict):
            raise DryRunError("BAD_REPORT", "start_margin must be an object")
        values.append(("dryrun_start_margin", {
            "line": _num(m.get("line"), "start_margin.line", integer=True), "code": _text(m.get("code"), "start_margin.code"),
            "room_mm": _num(m.get("room_mm"), "start_margin.room_mm"), "axis": _text(m.get("axis"), "start_margin.axis"),
            "side": _text(m.get("side"), "start_margin.side")}))

    obs = [{
        "schema_version": "1.0", "observation_id": f"dryrun_{i:04d}", "session_id": SESSION, "source_kind": "IMPORT",
        "source_status": "IMPORTED", "capture_utc": imported_at_utc, "source_timestamp": None, "timestamp_quality": "UNKNOWN",
        "source_ref": SOURCE_REF, "entity_id": "unmapped", "mapping_quality": "UNKNOWN", "event_type": et, "value": v,
        "validity": "FRESH", "sensitive": False} for i, (et, v) in enumerate(values, 1)]
    return {"observations": obs, "summary": summary, "notice": NOTICE}
