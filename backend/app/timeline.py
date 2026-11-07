"""Incident timeline reconstruction (G3, REQ-006/007). Pure and deterministic; invents nothing.

Rules: only the observed period is described (no past before the first observation, no future after the last);
gaps come only from explicit `capture_gap` observations; every row keeps provenance and time quality;
state phases are read from `state_transition` observations, never guessed from other signals.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from .engine import sort_observations

Obs = dict[str, Any]
# Streams where an identical consecutive value is a repeat of the same fact. Telemetry (temperatures) is never
# collapsed: with unmapped toolheads, equal values from different heads are not "the same thing repeating".
COLLAPSIBLE = frozenset({"state_transition", "machine_action_code", "user_reported_error_code"})
INCIDENT_STATES = ("paused", "error")


def _ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(UTC)


def _secs(a: str, b: str) -> float:
    return round((_ts(b) - _ts(a)).total_seconds(), 3)


def _gap_bounds(o: Obs) -> tuple[str, str] | None:
    v = o["value"]
    if isinstance(v, dict) and isinstance(v.get("start"), str) and isinstance(v.get("end"), str):
        return v["start"], v["end"]
    return None


def _entries(obs: list[Obs]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    last_in_stream: dict[tuple[str, str, str], dict[str, Any]] = {}
    for o in obs:
        key = (o["session_id"], o["event_type"], o["entity_id"])
        prev = last_in_stream.get(key)
        same = (o["event_type"] in COLLAPSIBLE and prev is not None and prev["summary"] == o["value"]
                and prev["validity"] == o["validity"] and prev["source_status"] == o["source_status"])
        if same and prev is not None:
            prev["repeat"] += 1
            prev["last_utc"] = o["capture_utc"]
            prev["ids"].append(o["observation_id"])
            continue
        row = {"t_utc": o["capture_utc"], "last_utc": o["capture_utc"], "ids": [o["observation_id"]], "session_id": o["session_id"],
               "event_type": o["event_type"], "entity_id": o["entity_id"], "mapping_quality": o["mapping_quality"],
               "timestamp_quality": o["timestamp_quality"], "source_status": o["source_status"], "validity": o["validity"],
               "summary": o["value"], "repeat": 1}
        out.append(row)
        last_in_stream[key] = row
    return out


def _phases(obs: list[Obs]) -> list[dict[str, Any]]:
    phases: list[dict[str, Any]] = []
    for sid in sorted({o["session_id"] for o in obs}):
        sess = [o for o in obs if o["session_id"] == sid]
        end_of_data = sess[-1]["capture_utc"]
        states = [o for o in sess if o["event_type"] == "state_transition" and isinstance(o["value"], dict) and "state" in o["value"]]
        for i, o in enumerate(states):
            nxt = states[i + 1] if i + 1 < len(states) else None
            end = nxt["capture_utc"] if nxt else end_of_data
            phases.append({
                "session_id": sid, "state": str(o["value"]["state"]), "start_utc": o["capture_utc"], "end_utc": end,
                "duration_s": _secs(o["capture_utc"], end), "ended_by_transition": nxt is not None,
                "observation_ids": [o["observation_id"]] + ([nxt["observation_id"]] if nxt else []), "source_status": o["source_status"]})
    return phases


def _incident(obs: list[Obs], entries: list[dict[str, Any]]) -> dict[str, Any] | None:
    for o in obs:
        if o["event_type"] == "state_transition" and isinstance(o["value"], dict) and o["value"].get("state") in INCIDENT_STATES:
            t = o["capture_utc"]
            return {
                "trigger_observation_id": o["observation_id"], "state": o["value"]["state"], "t_utc": t,
                "entries_before": sum(1 for e in entries if e["t_utc"] < t), "entries_after": sum(1 for e in entries if e["t_utc"] > t),
                "note": "Only the observed period is shown. Nothing before the first observation or after the last is known."}
    return None


def build_timeline(observations: list[Obs]) -> dict[str, Any]:
    if not observations:
        raise ValueError("no observations")
    obs = sort_observations(observations)
    start, end = obs[0]["capture_utc"], obs[-1]["capture_utc"]
    sessions = []
    for sid in sorted({o["session_id"] for o in obs}):
        sess = [o for o in obs if o["session_id"] == sid]
        sessions.append({"session_id": sid, "start_utc": sess[0]["capture_utc"], "end_utc": sess[-1]["capture_utc"], "observations": len(sess),
                         "source_status": sorted({o["source_status"] for o in sess})})
    gaps = []
    for o in obs:
        if o["event_type"] == "capture_gap":
            b = _gap_bounds(o)
            if b:
                gaps.append({"session_id": o["session_id"], "start_utc": b[0], "end_utc": b[1], "duration_s": _secs(*b), "observation_id": o["observation_id"]})
    gaps.sort(key=lambda g: (g["start_utc"], g["end_utc"]))
    quality = {k: sum(1 for o in obs if o["validity"] == k) for k in ("STALE", "UNAVAILABLE", "MALFORMED")}
    tq: dict[str, int] = {}
    for o in obs:
        tq[o["timestamp_quality"]] = tq.get(o["timestamp_quality"], 0) + 1
    entries = _entries(obs)
    integrity = "GAPS_RECORDED" if gaps else ("DEGRADED_DATA" if any(quality.values()) else "NO_GAP_RECORDED")
    return {
        "observed_window": {"start_utc": start, "end_utc": end, "duration_s": _secs(start, end)},
        "sessions": sessions, "gaps": gaps, "data_quality": quality, "integrity": integrity,
        "time_basis": {"timestamp_quality_counts": dict(sorted(tq.items())),
                       "note": "RECEIPT_ONLY = PC receipt time. Machine clocks are never interpreted as UTC without a proof."},
        "phases": _phases(obs), "incident": _incident(obs, entries), "entries": entries, "observation_count": len(obs),
        "limits": ["Describes the observed window only; absence of a gap record does not prove the data is complete.",
                   "A lost connection never means the printer stopped.",
                   "Unmapped toolheads: values are not attributed to a head."],
    }
