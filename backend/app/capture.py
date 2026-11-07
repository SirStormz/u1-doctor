"""Convert a raw H-02 capture (frames.jsonl) into schema-valid REAL observations.

Pure and deterministic: same frames in, same bytes out. Only an allowlist of derived
facts is kept (print state changes, machine action-code changes, temperatures every
60 s). File names, hostnames and any other field are dropped. Temperatures cannot be
attributed to a toolhead (mapping unknown, H-04), so they are tagged `unmapped`.
"""
from __future__ import annotations

import json
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


def frames_to_observations(lines: Iterable[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    state: str | None = None
    code: int | None = None
    last_sample: dict[str, float] = {}
    last_temp: dict[str, float] = {}
    last_fan: dict[str, float] = {}
    last_fan_sample: dict[str, float] = {}
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
