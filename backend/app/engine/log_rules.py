"""Evaluators for facts read from imported log files (rules S25-S32). Pure; same contract as the evaluators in engine.py.

Everything here describes what a log says, never a diagnosis: findings are OBSERVED (the log records it), SUSPECTED
(counters show errors) or INCONCLUSIVE (link problems), always with the IMPORTED limits line.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from ..knowledge import interpret, log_signal
from . import engine as E

Obs = dict[str, Any]
Rule = dict[str, Any]

LOGS_LIMIT = ("Read from log files provided by the user (IMPORTED): the files may be old, partial or edited, and each time is the clock "
              "written in the log (its time zone is not recorded).")
LIVE_LIMIT = "Reported by the printer's exception manager during this live capture (read-only)."
EXC_CAP = 10


def _val(o: Obs, key: str) -> Any:
    return o["value"].get(key) if isinstance(o["value"], dict) else None


def _num(o: Obs, key: str) -> int:
    v = _val(o, key)
    return v if isinstance(v, int) and not isinstance(v, bool) else 0


def _sum(obs: list[Obs], etype: str, key: str) -> int:
    return sum(_num(o, key) for o in obs if o["event_type"] == etype)


def _s(n: int) -> str:
    return "s" if n != 1 else ""


def ev_machine_exceptions(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Exceptions the firmware raised, read from a Moonraker log: one finding per distinct on-screen code."""
    by: dict[str, list[Obs]] = {}
    for o in obs:
        if o["event_type"] == "machine_exception" and isinstance(_val(o, "code"), str):
            by.setdefault(o["value"]["code"], []).append(o)
    out: list[dict[str, Any]] = []
    for code in sorted(by):
        grp = by[code]
        dec = interpret(code)
        sig = log_signal(code)
        hyp: list[dict[str, str]] = []
        refs = E.WIKI_REF
        name = None
        if dec["status"] == "KNOWN":
            name = dec["entry"]["title"]
            hyp = [{"id": "h1", "text": dec["entry"]["summary"], "label": "OFFICIAL_REFERENCE"}]
            art = dec["entry"].get("article")
            if isinstance(art, dict) and isinstance(art.get("url"), str):
                refs = [{"kind": "OFFICIAL_WIKI", "url": art["url"], "checked_at": E.CHECKED}]
        elif sig is not None:
            name = sig["title"]["en"]
            hyp = [{"id": "h1", "text": sig["text"]["en"], "label": "OFFICIAL_REFERENCE" if "article" in sig else "ENGINE_INFERENCE"}]
            if "article" in sig:
                refs = [{"kind": "OFFICIAL_WIKI", "url": sig["article"]["url"], "checked_at": E.CHECKED}]
        title = f"Machine exception {code} raised {len(grp)} time{_s(len(grp))} in the logs" + (f": {name}" if name else "")
        safe = (["Follow the linked official procedure; do not bypass safety interlocks."] if name
                else ["Search the exact code on the official wiki or contact Snapmaker support."])
        if len(grp) >= 3:
            safe.append("It came back several times: if the procedure does not stop it, contact Snapmaker support with these dates.")
        live = all(o["source_status"] == "REAL" for o in grp)
        limits = [LIVE_LIMIT if live else LOGS_LIMIT, "The on-screen code is rebuilt from the exception fields (level, id, index, code); the official wiki warns the displayed code may not be the real fault source.",
                  "The exception index is not proven to be the toolhead number."]
        if len(grp) > EXC_CAP:
            limits.append(f"Only the first {EXC_CAP} of {len(grp)} events are listed as evidence.")
        out.append(E._make(
            rule, rs_hash, rs_id, [(o, f"Raised by the firmware (level {_val(o, 'level')}): {_val(o, 'message')}") for o in grp[:EXC_CAP]],
            classification="OBSERVED", title=title, hypotheses=hyp,
            missing=["What was printing and what the printer screen showed at that moment."], safe=safe, refs=refs, limits=limits,
            quality="MODERATE" if live else "WEAK"))
    return out


def ev_link_health(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Klipper <-> controller link counters from `Stats` lines: errors are shown, a clean record is stated as a baseline."""
    rows = [o for o in obs if o["event_type"] == "klippy_link_stats" and isinstance(_val(o, "mcus"), dict) and _num(o, "stats_lines") > 0]
    if not rows:
        return []
    worst: dict[str, dict[str, int]] = {}
    samples = 0
    for o in rows:
        samples += _num(o, "stats_lines")
        for mcu, d in o["value"]["mcus"].items():
            w = worst.setdefault(mcu, {"err_sync": 0, "err_crc": 0, "invalid": 0, "retransmit": 0})
            for k in w:
                v = d.get(k, 0)
                w[k] = max(w[k], v if isinstance(v, int) and not isinstance(v, bool) else 0)
    bad = {m: w for m, w in worst.items() if w["err_sync"] or w["err_crc"] or w["invalid"]}
    ev = [(o, "Link counters in this log.") for o in rows[:EXC_CAP]]
    if bad:
        detail = "; ".join(f"{m}: sync {w['err_sync']}, crc {w['err_crc']}, invalid {w['invalid']}" for m, w in sorted(bad.items()))
        return [E._make(
            rule, rs_hash, rs_id, ev, classification="SUSPECTED",
            title=f"Klipper link errors recorded on {len(bad)} of {len(worst)} controllers ({detail})", hypotheses=[],
            missing=["Whether a print failed at the same time, and the cable or power state of the affected controller."],
            safe=["Power the printer off fully, check that the toolhead and swapper connectors are seated and clean, then watch whether the counters grow again."],
            refs=[], limits=[LOGS_LIMIT, "Counters are cumulative since the Klipper start; U1 Doctor has no official threshold, so any non-zero sync, crc or invalid count is shown as a fact, not as proof of a fault."],
            quality="WEAK")]
    retx = max(w["retransmit"] for w in worst.values())
    return [E._make(
        rule, rs_hash, rs_id, ev, classification="OBSERVED",
        title=f"Klipper link counters stayed clean over {samples} samples on {len(worst)} controllers ({', '.join(sorted(worst))}); retransmitted bytes at most {retx}",
        hypotheses=[], missing=["A log taken around a real fault, to compare with."],
        safe=["No action: this is a healthy baseline."], refs=[],
        limits=[LOGS_LIMIT, "A clean link record does not rule out a fault elsewhere (heater, sensor, mechanics)."], quality="WEAK")]


def ev_klippy_shutdowns(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Shutdown-type lines in a Klipper log, one finding per distinct reason (digits ignored)."""
    by: dict[str, list[Obs]] = {}
    for o in obs:
        if o["event_type"] == "klippy_shutdown" and isinstance(_val(o, "reason"), str):
            by.setdefault(re.sub(r"\d+(\.\d+)?", "#", o["value"]["reason"]), []).append(o)
    out: list[dict[str, Any]] = []
    for key in sorted(by)[:5]:
        grp = by[key]
        out.append(E._make(
            rule, rs_hash, rs_id, [(o, f"Klipper wrote: {_val(o, 'reason')}") for o in grp[:EXC_CAP]], classification="OBSERVED",
            title=f"Klipper wrote a shutdown-type line {len(grp)} time{_s(len(grp))}: {_val(grp[0], 'reason')}", hypotheses=[],
            missing=["What was printing and what the printer screen showed at that moment."],
            safe=["Power the printer off fully, read the code on the screen and follow its official procedure.", "Export the system log from the touchscreen for Snapmaker support."],
            refs=E.WIKI_REF, limits=[LOGS_LIMIT, "A line that matches a shutdown phrase is a fact about the log, not a diagnosis."], quality="WEAK"))
    return out


def ev_network_health(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Wi-Fi, name-resolution and cloud-link trouble counted across the logs. Describes the link, never the printer's health."""
    p = rule["params"]
    counts = {
        "Wi-Fi disconnections": _sum(obs, "syslog_summary", "wifi_deauth_total"),
        "name-resolution failures": _sum(obs, "moonraker_summary", "name_resolution_failures") + _sum(obs, "unisrv_summary", "name_resolution_failures"),
        "cloud connection drops": _sum(obs, "moonraker_summary", "mqtt_offline_events"),
        "cloud sign-in failures": _sum(obs, "unisrv_summary", "cloud_auth_failures"),
        "slicer heartbeat time-outs": _sum(obs, "orca_summary", "heartbeat_timeouts"),
    }
    shown = {k: v for k, v in counts.items() if v >= p["min_count"]}
    if not shown:
        return []
    srcs = [o for o in obs if o["event_type"] in ("syslog_summary", "moonraker_summary", "unisrv_summary", "orca_summary")]
    return [E._make(
        rule, rs_hash, rs_id, [(o, "Counts of link problems in this log.") for o in srcs[:EXC_CAP]], classification="INCONCLUSIVE",
        title="Network trouble recorded in the logs: " + ", ".join(f"{v} {k}" for k, v in sorted(shown.items())),
        hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "OFFICIAL_REFERENCE"}],
        missing=["Wi-Fi signal strength over time, the router's own log, and whether prints were affected."],
        safe=["Give the printer a fixed address (static lease) in the router, and move it or the access point closer if Wi-Fi disconnections are frequent.",
              "Check the printer itself before concluding anything: a lost link does not mean it stopped."],
        refs=E._wiki_ref(p["reference_url"]),
        limits=[LOGS_LIMIT, "These records describe the network and the cloud link, not the health of the printer.",
                "Cloud and name-resolution failures are common on home networks and do not by themselves stop local printing (not verified here)."], quality="WEAK")]


def ev_firmware_upgrade(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """A firmware update attempt that failed, as written by the printer service."""
    ups = [o for o in obs if o["event_type"] == "firmware_upgrade"]
    failed = [o for o in ups if _val(o, "event") in ("upgrade_failed", "upgrade_script_failed")]
    if not failed:
        return []
    code = next((_val(o, "exit_code") for o in failed if _val(o, "exit_code") is not None), None)
    checks = [o for o in ups if _val(o, "event") == "version_check"]
    ev = [(o, "Firmware update failed." + (f" Exit code {_val(o, 'exit_code')}." if _val(o, "exit_code") is not None else "")) for o in failed]
    if checks:
        ev.append((checks[-1], f"Version check: printer {_val(checks[-1], 'local')}, available {_val(checks[-1], 'remote')}."))
    return [E._make(
        rule, rs_hash, rs_id, ev, classification="OBSERVED",
        title="A firmware update attempt failed" + (f" (script exit code {code})" if code is not None else ""), hypotheses=[],
        missing=["Why it failed (power, network, storage), and whether a later attempt worked."],
        safe=["Retry the update with the printer idle on a stable power and network connection.", "If it fails again, keep the current firmware and contact Snapmaker support with the system log."],
        refs=[], limits=[LOGS_LIMIT, "Exit code 143 usually means the script was stopped by a signal (shown as written; the cause is not in the log)."], quality="WEAK")]


def ev_timelapse_failures(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Timelapse frames the printer could not capture. Concerns the camera service only."""
    rows = [o for o in obs if o["event_type"] == "unisrv_summary" and _num(o, "timelapse_capture_failed") >= rule["params"]["min_count"]]
    if not rows:
        return []
    n = sum(_num(o, "timelapse_capture_failed") for o in rows)
    codes = sorted({c for o in rows for c in (_val(o, "hal_execute_error_codes") or {})})
    return [E._make(
        rule, rs_hash, rs_id, [(o, f"{_num(o, 'timelapse_capture_failed')} timelapse frames could not be written.") for o in rows], classification="OBSERVED",
        title=f"Timelapse: {n} frame captures failed" + (f" (camera service code {', '.join(codes)})" if codes else ""), hypotheses=[],
        missing=["Whether the camera works in the Snapmaker app, and which print was running."],
        safe=["If you use timelapse, restart the printer and check the camera cable and the camera view; this record concerns timelapse frames only."],
        refs=[], limits=[LOGS_LIMIT, "The meaning of the camera service code is not documented officially."], quality="WEAK")]


def ev_orca_link(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Snapmaker Orca (slicer) <-> printer link problems read from the slicer's own log."""
    p = rule["params"]
    rows = [o for o in obs if o["event_type"] == "orca_summary"]
    act = sum(_num(o, "not_activated") for o in rows)
    hb = sum(_num(o, "heartbeat_timeouts") for o in rows)
    sync = max([_num(o, "max_consecutive_time_sync_failures") for o in rows] or [0])
    out: list[dict[str, Any]] = []
    if act >= p["min_count"]:
        days = len({d for o in rows for d in (_val(o, "days_not_activated") or []) if isinstance(d, str)})
        out.append(E._make(
            rule, rs_hash, rs_id, [(o, f"{_num(o, 'not_activated')} records of 'Application is not activated'.") for o in rows if _num(o, "not_activated")][:EXC_CAP],
            classification="OBSERVED", title=f"Snapmaker Orca reported 'Application is not activated' {act} times over {days} days", hypotheses=[],
            missing=["Whether the printer shows as connected in Snapmaker Orca's device list, and which account is signed in."],
            safe=["In Snapmaker Orca, sign in again and check that the printer is in the device list and bound to the account; use the printer's IP address as a fallback."],
            refs=[], limits=[LOGS_LIMIT, "Orca's own message; its exact meaning is inferred from the text, not documented."], quality="WEAK"))
    if hb >= p["min_count"] or sync >= p["min_sync"]:
        bits = [f"{hb} heartbeat time-outs"] if hb else []
        if sync:
            bits.append(f"up to {sync} consecutive time-sync failures")
        out.append(E._make(
            rule, rs_hash, rs_id, [(o, "Link problems counted in the slicer log.") for o in rows[:EXC_CAP]], classification="INCONCLUSIVE",
            title="Snapmaker Orca lost contact with the printer: " + ", ".join(bits), hypotheses=[],
            missing=["Wi-Fi quality at those times and whether the printer was off or asleep."],
            safe=["Check that the printer and the PC are on the same network and that the printer's address did not change; a static lease in the router is the documented fix."],
            refs=E._wiki_ref("https://wiki.snapmaker.com/en/snapmaker_u1/set-static-ip-for-u1"),
            limits=[LOGS_LIMIT, "A time-out describes the link, not the printer's health."], quality="WEAK"))
    return out


def ev_encrypted_log(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """The printer's own encrypted system log was provided: recognized, never opened."""
    rows = [o for o in obs if o["event_type"] == "encrypted_system_log"]
    if not rows:
        return []
    fw = _val(rows[0], "firmware_in_name")
    return [E._make(
        rule, rs_hash, rs_id, [(rows[0], "Encrypted system log recognized (not opened).")], classification="OBSERVED",
        title="The printer's encrypted system log was provided" + (f" (firmware {fw} in the file name)" if fw else ""), hypotheses=[],
        missing=["Its content: it is encrypted for Snapmaker support and U1 Doctor does not try to open it."],
        safe=["Send this file unchanged to Snapmaker support; it is the file they ask for."], refs=[],
        limits=["Only the file name and size were read."], quality="UNKNOWN")]


LOG_EVALUATORS: dict[str, Callable[..., list[dict[str, Any]]]] = {
    "machine_exceptions": ev_machine_exceptions,
    "link_health": ev_link_health,
    "klippy_shutdowns": ev_klippy_shutdowns,
    "network_health": ev_network_health,
    "firmware_upgrade": ev_firmware_upgrade,
    "timelapse_failures": ev_timelapse_failures,
    "orca_link": ev_orca_link,
    "encrypted_log": ev_encrypted_log,
}
