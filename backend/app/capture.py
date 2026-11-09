"""Convert a raw H-02 capture (frames.jsonl) into schema-valid REAL observations.

Pure and deterministic: same frames in, same bytes out. Only an allowlist of derived
facts is kept (print state changes, machine action-code changes, temperatures every
60 s). File names, hostnames and any other field are dropped. Temperatures cannot be
attributed to a toolhead (mapping unknown, H-04), so they are tagged `unmapped`.
"""
from __future__ import annotations

import json
import re
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path
from typing import Any

SESSION = "real_session_h02"
SAMPLE_EVERY_S = 60.0
HEATERS = {"heater_bed": "bed_temperature_sample", "extruder": "temperature_sample", "extruder1": "temperature_sample",
           "extruder2": "temperature_sample", "extruder3": "temperature_sample"}
# Nozzle fans pair with the heater of the same index (names seen on the real U1, H-05/H-06). Mapping to a toolhead stays unknown.
FANS = {"extruder": "heater_fan e0_nozzle_fan", "extruder1": "heater_fan e1_nozzle_fan",
        "extruder2": "heater_fan e2_nozzle_fan", "extruder3": "heater_fan e3_nozzle_fan"}


def _obs(i: int, t: str, etype: str, value: dict[str, Any], *, entity: str, mq: str, ref: str) -> dict[str, Any]:
    return {
        "schema_version": "1.0", "observation_id": f"real_h02_{i:04d}", "session_id": SESSION,
        "source_kind": "MOONRAKER", "source_status": "REAL", "capture_utc": t, "source_timestamp": None,
        "timestamp_quality": "RECEIPT_ONLY", "source_ref": ref, "entity_id": entity, "mapping_quality": mq,
        "event_type": etype, "value": value, "validity": "FRESH", "sensitive": False,
    }


def _status(doc: dict[str, Any]) -> dict[str, Any] | None:
    if doc.get("method") == "notify_status_update":
        p = doc.get("params")
        return p[0] if isinstance(p, list) and p and isinstance(p[0], dict) else None
    r = doc.get("result")
    return r["status"] if isinstance(r, dict) and isinstance(r.get("status"), dict) else None


def _epoch(t: str) -> float:
    return datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp()


def _exception_value(ex: Any) -> dict[str, Any] | None:
    """One entry of `exception_manager.exceptions` as the same value the log importer produces (on-screen code rebuilt as level-id-index-code)."""
    if not isinstance(ex, dict):
        return None
    nums = [ex.get(k) for k in ("level", "id", "index", "code")]
    if not all(isinstance(n, int) and not isinstance(n, bool) and 0 <= n <= 9999 for n in nums):
        return None
    lvl, mid, idx, code = nums
    msg = ex.get("message")
    ts = ex.get("timestamp")
    return {"id": mid, "index": idx, "code": f"{lvl:04d}-{mid:04d}-{idx:04d}-{code:04d}", "raw_code": code, "level": lvl,
            "message": re.sub(r"\s+", " ", msg)[:200] if isinstance(msg, str) else "", "timestamp": ts if isinstance(ts, (int, float)) else None}


def frames_to_observations(lines: Iterable[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    state: str | None = None
    code: int | None = None
    last_sample: dict[str, float] = {}
    last_temp: dict[str, float] = {}
    last_fan: dict[str, float] = {}
    last_fan_sample: dict[str, float] = {}
    seen_exc: set[tuple[Any, ...]] = set()
    for line in lines:
        if not line.strip():
            continue
        rec = json.loads(line)
        t, st = rec["t"], _status(rec["frame"])
        if not st:
            continue
        ps = st.get("print_stats")
        if isinstance(ps, dict) and isinstance(ps.get("state"), str) and ps["state"] != state:
            state = ps["state"]
            out.append(_obs(len(out) + 1, t, "state_transition", {"state": state}, entity="printer", mq="VERIFIED", ref="print_stats/state"))
        ms = st.get("machine_state_manager")
        if isinstance(ms, dict) and isinstance(ms.get("action_code"), int) and ms["action_code"] != code:
            code = ms["action_code"]
            out.append(_obs(len(out) + 1, t, "machine_action_code", {"action_code": code}, entity="printer", mq="VERIFIED", ref="machine_state_manager/action_code"))
        em = st.get("exception_manager")
        if isinstance(em, dict) and isinstance(em.get("exceptions"), list):
            for ex in em["exceptions"]:
                v = _exception_value(ex)
                key: tuple[Any, ...] = (v["id"], v["index"], v["raw_code"], v.get("timestamp")) if v else ()
                if v and key not in seen_exc:
                    seen_exc.add(key)
                    v.pop("timestamp", None)
                    out.append(_obs(len(out) + 1, t, "machine_exception", v, entity="unmapped", mq="UNKNOWN", ref="exception_manager/exceptions"))
        for name, etype in HEATERS.items():
            h = st.get(name)
            if isinstance(h, dict) and isinstance(h.get("temperature"), (int, float)):
                last_temp[name] = float(h["temperature"])
            if name in last_temp and (name not in last_sample or _epoch(t) - last_sample[name] >= SAMPLE_EVERY_S) and isinstance(h, dict) and "temperature" in h:
                last_sample[name] = _epoch(t)
                ent, mq = ("printer", "VERIFIED") if name == "heater_bed" else ("unmapped", "UNKNOWN")
                out.append(_obs(len(out) + 1, t, etype, {"celsius": round(last_temp[name], 1)}, entity=ent, mq=mq, ref=f"{name}/temperature"))
        for name, fan in FANS.items():
            f = st.get(fan)
            if isinstance(f, dict) and isinstance(f.get("speed"), (int, float)) and not isinstance(f["speed"], bool):
                last_fan[name] = float(f["speed"])
            h = st.get(name)
            if name in last_fan and name in last_temp and isinstance(h, dict) and "temperature" in h                     and (name not in last_fan_sample or _epoch(t) - last_fan_sample[name] >= SAMPLE_EVERY_S):
                last_fan_sample[name] = _epoch(t)
                out.append(_obs(len(out) + 1, t, "nozzle_fan_sample", {"celsius": round(last_temp[name], 1), "fan_speed": round(last_fan[name], 2)},
                                entity="unmapped", mq="UNKNOWN", ref=f"{name}/fan"))
    return out


# --- Live-capture facts (BACKLOG #57/#59). Used by app.live only; the H-02 conversion above is unchanged. -----------
EXTRUDERS = ("extruder", "extruder1", "extruder2", "extruder3")
CAVITY = "temperature_sensor cavity"
SENSORS = ("heater_bed", CAVITY, *EXTRUDERS)
# Every source a live rule needs. A source missing from the capture is listed in `live_coverage.absent`, so the rule
# says "not observable" instead of staying silent or guessing.
COVERAGE_KEYS = ("extruder_offset", "nozzle_diameter", "heater_bed", CAVITY, "estimated_print_time", "extruder_state",
                 "bed_mesh", "disk_usage")


def _eventtime(doc: dict[str, Any]) -> float | None:
    if doc.get("method") == "notify_status_update":
        p = doc.get("params")
        v = p[1] if isinstance(p, list) and len(p) > 1 else None
    else:
        r = doc.get("result")
        v = r.get("eventtime") if isinstance(r, dict) else None
    return _num(v)


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, int | float) and not isinstance(v, bool) and v == v else None


def _mesh_stats(m: Any) -> dict[str, Any] | None:
    """Numbers only (no 'normal' judgement: the repo holds no official bed-mesh threshold)."""
    if not isinstance(m, list) or not all(isinstance(r, list) for r in m):
        return None
    vals = [_num(x) for r in m for x in r]
    if any(x is None for x in vals):
        return None
    pts = [x for x in vals if x is not None]
    if not pts:
        return {"points": 0}
    mean = sum(pts) / len(pts)
    sd = (sum((x - mean) ** 2 for x in pts) / len(pts)) ** 0.5
    return {"rows": len(m), "cols": max(len(r) for r in m), "points": len(pts), "min_mm": round(min(pts), 4), "max_mm": round(max(pts), 4),
            "range_mm": round(max(pts) - min(pts), 4), "mean_mm": round(mean, 4), "stdev_mm": round(sd, 4)}


def _secs(a: str, b: str) -> float:
    return round(_epoch(b) - _epoch(a), 1)


def live_facts(lines: Iterable[str], *, start: int, disk: dict[str, Any] | None = None,
               totals: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Window summaries for the live rules S17-S24. Pure and deterministic: same frames in, same facts out.

    One observation per fact, entity `printer`, values keyed by the Klipper object name (never a toolhead number: the
    mapping is unproven, H-04). Nothing that names a file or a host is kept. `start` is the first free index after
    the observations already built from the same frames, so ids stay unique. `disk` is the parsed disk usage of the
    `logs` root, or None when it was not read. `totals` is the parsed job-history totals (four fields, BACKLOG #65), or
    None when not observable; it is not a coverage key (no rule reads it: the maintenance reminders are local to the app).
    """
    last: dict[str, dict[str, Any]] = {}
    temps: dict[str, dict[str, Any]] = {}
    pairs = identical = 0
    states: dict[str, list[str]] = {}
    counters: dict[str, dict[str, list[int]]] = {}
    homed: list[str] = []
    host_s: float | None = None
    t_last: str | None = None
    for line in lines:
        if not line.strip():
            continue
        rec = json.loads(line)
        t, st = rec["t"], _status(rec["frame"])
        if not st:
            continue
        t_last = t
        et = _eventtime(rec["frame"])
        host_s = et if et is not None else host_s
        for name, upd in st.items():
            if isinstance(upd, dict):
                last.setdefault(name, {}).update(upd)
        for name in SENSORS:
            u = st.get(name)
            if not isinstance(u, dict):
                continue
            c, tg = _num(u.get("temperature")), _num(u.get("target"))
            r = temps.setdefault(name, {"first_c": None, "last_c": None, "min_c": None, "max_c": None, "target_c": None, "t0": t, "t1": t})
            if c is not None:
                if r["first_c"] is None:
                    r["first_c"], r["t0"] = c, t
                r["last_c"], r["t1"] = c, t
                r["min_c"] = c if r["min_c"] is None else min(r["min_c"], c)
                r["max_c"] = c if r["max_c"] is None else max(r["max_c"], c)
            if tg is not None and (r["target_c"] is None or tg > r["target_c"]):
                r["target_c"] = tg
        if any(isinstance(st.get(n), dict) and "temperature" in st[n] for n in ("heater_bed", CAVITY)):
            b, cv = _num(last.get("heater_bed", {}).get("temperature")), _num(last.get(CAVITY, {}).get("temperature"))
            if b is not None and cv is not None:
                pairs += 1
                identical += b == cv
        for name in EXTRUDERS:
            u = st.get(name)
            if not isinstance(u, dict):
                continue
            if isinstance(u.get("state"), str) and (not states.get(name) or states[name][-1] != u["state"]):
                states.setdefault(name, []).append(u["state"])
            for k in ("switch_count", "retry_count", "error_count"):
                v = u.get(k)
                if isinstance(v, int) and not isinstance(v, bool):
                    counters.setdefault(name, {}).setdefault(k, [v, v])[1] = v
        th = st.get("toolhead")
        if isinstance(th, dict) and isinstance(th.get("homed_axes"), str) and (not homed or homed[-1] != th["homed_axes"]):
            homed.append(th["homed_axes"])

    out: list[dict[str, Any]] = []
    present: set[str] = set()

    def emit(t: str, etype: str, value: dict[str, Any], ref: str) -> None:
        out.append(_obs(start + len(out), t, etype, value, entity="printer", mq="VERIFIED", ref=ref))

    if t_last is not None:
        offs = {}
        for n in EXTRUDERS:
            v = last.get(n, {}).get("extruder_offset")
            if isinstance(v, list) and len(v) >= 2 and all(_num(x) is not None for x in v[:3]):
                offs[n] = {ax: round(float(x), 4) for ax, x in zip(("x", "y", "z"), v[:3], strict=False)}
        if offs:
            present.add("extruder_offset")
            emit(t_last, "extruder_offsets", offs, "extruder/extruder_offset")
        noz = {n: d for n in EXTRUDERS if (d := _num(last.get(n, {}).get("nozzle_diameter"))) is not None}
        if noz:
            present.add("nozzle_diameter")
            emit(t_last, "nozzle_diameters", noz, "extruder/nozzle_diameter")
        sens = {}
        for n in SENSORS:
            w = temps.get(n)
            if w and w["first_c"] is not None:
                present.add(n)
                sens[n] = {"first_c": round(w["first_c"], 2), "last_c": round(w["last_c"], 2), "min_c": round(w["min_c"], 2), "max_c": round(w["max_c"], 2),
                           "target_c": None if w["target_c"] is None else round(w["target_c"], 2), "seconds": _secs(w["t0"], w["t1"])}
        if sens:
            emit(t_last, "heater_window", {"sensors": sens, "bed_cavity": {"pairs": pairs, "identical": identical}}, "heater_bed/temperature")
        mcu = _num(last.get("toolhead", {}).get("estimated_print_time"))
        if mcu is not None and host_s is not None:
            present.add("estimated_print_time")
            ps = last.get("print_stats", {}).get("state")
            emit(t_last, "clock_check", {"host_s": round(host_s, 1), "mcu_s": round(mcu, 1), "print_state": ps if isinstance(ps, str) else None},
                 "toolhead/estimated_print_time")
        if states or counters:
            present.add("extruder_state")
            act = {n: {"state_changes": max(0, len(states.get(n, [])) - 1), **counters.get(n, {})} for n in EXTRUDERS if n in states or n in counters}
            emit(t_last, "extruder_activity", {"extruders": act, "homing_changes": max(0, len(homed) - 1)}, "extruder/state")
        mesh = _mesh_stats(last["bed_mesh"].get("probed_matrix")) if "bed_mesh" in last else None
        if mesh is not None:
            present.add("bed_mesh")
            emit(t_last, "bed_mesh_points", mesh, "bed_mesh/probed_matrix")
    t_end = t_last or (disk or {}).get("t")
    if disk:
        present.add("disk_usage")
        emit(t_end or disk["t"], "disk_usage", {k: disk[k] for k in ("root", "total_bytes", "used_bytes", "free_bytes")}, "server.files.directory/logs")
    if totals:
        emit(t_end or totals["t"], "history_totals", {k: totals[k] for k in ("total_jobs", "total_print_time", "total_filament_used", "total_time")},
             "server.history.totals")
    if t_end is not None:
        emit(t_end, "live_coverage", {"absent": sorted(k for k in COVERAGE_KEYS if k not in present)}, "transport/coverage")
    return out


if __name__ == "__main__":  # pragma: no cover - local tool
    import sys

    from .engine import canon, evaluate

    raw, outdir, rules = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    obs = frames_to_observations(raw.read_text(encoding="utf-8").splitlines())
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "real_h02_normal_print.observations.jsonl").write_bytes(b"".join(canon(o) + b"\n" for o in obs))
    findings = evaluate(obs, json.loads(rules.read_text(encoding="utf-8")))
    (outdir / "real_h02_normal_print.findings.json").write_bytes(canon(findings) + b"\n")
    print(len(obs), "observations,", len(findings), "findings")
