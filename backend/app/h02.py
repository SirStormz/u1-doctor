"""H-02 passive monitoring of a print the owner starts (cahier §16.4). Subscribe only.

Sends exactly one allowlisted frame (printer.objects.subscribe) and then only listens.
Raw frames go to a git-ignored private directory (they hold file names). The committed
manifest keeps state transitions, timing and field names, never file names or the IP.
"""
from __future__ import annotations

import json
import platform
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .api import APP_VERSION
from .h01 import _git_sha
from .transport import Consent, ReadOnlyMoonrakerWebSocket

OBJECTS: dict[str, list[str] | None] = {
    "print_stats": None, "machine_state_manager": None, "exception_manager": None, "webhooks": None,
    "pause_resume": None, "idle_timeout": None, "virtual_sdcard": None, "print_task_config": None,
    "toolhead": None, "heater_bed": None, "extruder": None, "extruder1": None, "extruder2": None, "extruder3": None,
    "heater_fan e0_nozzle_fan": ["speed"], "heater_fan e1_nozzle_fan": ["speed"], "heater_fan e2_nozzle_fan": ["speed"], "heater_fan e3_nozzle_fan": ["speed"],
}
END_STATES = {"complete", "cancelled", "error", "standby"}


def _walk_status(doc: dict[str, Any]) -> list[dict[str, Any]]:
    """Status dicts carried by a notify_status_update or by the subscribe reply."""
    if doc.get("method") == "notify_status_update":
        p = doc.get("params")
        return [p[0]] if isinstance(p, list) and p and isinstance(p[0], dict) else []
    r = doc.get("result")
    if isinstance(r, dict) and isinstance(r.get("status"), dict):
        return [r["status"]]
    return []


def run_h02(host: str, evidence_dir: Path, raw_dir: Path, *, print_started_by_owner: bool, max_seconds: float, linger_s: float = 30.0,
            connect: Callable[[], Any] | None = None, on_line: Callable[[str], None] = lambda _s: None) -> dict[str, Any]:
    if not print_started_by_owner:
        raise PermissionError("owner must confirm the print was started by them and is already planned")
    ws = ReadOnlyMoonrakerWebSocket(host, consent=Consent(True, host, "H-02"), connect=connect)
    raw_dir.mkdir(parents=True, exist_ok=True)
    transitions: list[dict[str, Any]] = []
    keys: dict[str, set[str]] = {}
    state: str | None = None
    exc_seen: list[dict[str, Any]] = []
    frames = 0
    gaps_max = 0.0
    last_t: float | None = None
    started = datetime.now(UTC)
    end_seen_at: float | None = None
    t0 = time.monotonic()
    try:
        ws.subscribe(OBJECTS)
        with (raw_dir / "frames.jsonl").open("a", encoding="utf-8") as raw:
            while time.monotonic() - t0 < max_seconds:
                for fr in ws.frames(max_frames=50, duration_s=1.0):
                    frames += 1
                    now = time.monotonic()
                    if last_t is not None:
                        gaps_max = max(gaps_max, now - last_t)
                    last_t = now
                    raw.write(json.dumps({"t": fr.received_utc, "frame": fr.payload}, ensure_ascii=False) + "\n")
                    for st in _walk_status(fr.payload):
                        for obj, fields in st.items():
                            if isinstance(fields, dict):
                                keys.setdefault(obj, set()).update(fields)
                        ps = st.get("print_stats")
                        if isinstance(ps, dict) and isinstance(ps.get("state"), str) and ps["state"] != state:
                            state = ps["state"]
                            transitions.append({"t_utc": fr.received_utc, "print_state": state})
                            on_line(f"{fr.received_utc} print_state={state}")
                            end_seen_at = now if state in END_STATES and len(transitions) > 1 else None
                        em = st.get("exception_manager")
                        if isinstance(em, dict) and em:
                            exc_seen.append({"t_utc": fr.received_utc, "fields": sorted(em)})
                if end_seen_at is not None and time.monotonic() - end_seen_at > linger_s:
                    break
    except KeyboardInterrupt:
        on_line("interrupted by owner")
    finally:
        ws.close()
    manifest = {
        "test_id": "H-02", "date_utc": started.strftime("%Y-%m-%dT%H:%M:%SZ"), "duration_s": round(time.monotonic() - t0, 1),
        "app_version": APP_VERSION, "git_sha": _git_sha(), "os": f"{platform.system()} {platform.release()}",
        "target": "RFC1918 IPv4 literal :7125 (redacted)",
        "outbound_frames": ws.audit, "outbound_non_subscribe": sum(1 for a in ws.audit if a.get("method") != "printer.objects.subscribe"),
        "inbound_frames": frames, "max_gap_between_frames_s": round(gaps_max, 2),
        "print_state_transitions": transitions, "exception_manager_updates": exc_seen,
        "observed_fields": {k: sorted(v) for k, v in sorted(keys.items())},
        "human_approval": "owner started the print and gave the go in chat",
    }
    evidence_dir.mkdir(parents=True, exist_ok=True)
    (evidence_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest


if __name__ == "__main__":  # pragma: no cover - manual field run
    import argparse

    ap = argparse.ArgumentParser(description="H-02 passive monitoring (subscribe only)")
    ap.add_argument("host")
    ap.add_argument("--print-started-by-me", action="store_true")
    ap.add_argument("--max-minutes", type=float, default=90)
    a = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    m = run_h02(a.host, root / "docs" / "evidence" / "H-02", root / "private" / "H-02-raw", print_started_by_owner=a.print_started_by_me,
                max_seconds=a.max_minutes * 60, on_line=lambda s: print(s, flush=True))
    print(json.dumps({k: m[k] for k in ("duration_s", "inbound_frames", "max_gap_between_frames_s", "print_state_transitions")}, indent=2))
