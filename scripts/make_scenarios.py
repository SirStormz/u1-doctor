"""Generate SYNTHETIC scenario fixtures + golden findings (deterministic).

Run: backend/.venv/Scripts/python.exe scripts/make_scenarios.py
Goldens are reviewed by humans via tests/test_scenarios.py semantic assertions;
regenerating them must be a deliberate, reviewed act (0 silent changes).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.engine import canon, evaluate, ruleset_hash
from app.engine.canonical import sha256_hex

OUT = ROOT / "fixtures" / "synthetic"
RULESET = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))


def o(i, t, etype, value, *, entity="printer", mq="VERIFIED", validity="FRESH", ref="print_stats/state", scen="x"):
    return {
        "schema_version": "1.0", "observation_id": f"synthetic_{scen}_{i:03d}", "session_id": f"synthetic_session_{scen}",
        "source_kind": "DEMO", "source_status": "SYNTHETIC", "capture_utc": t, "source_timestamp": None,
        "timestamp_quality": "RECEIPT_ONLY", "source_ref": ref, "entity_id": entity, "mapping_quality": mq,
        "event_type": etype, "value": value, "validity": validity, "sensitive": False,
    }


def code_obs(i, t, code, scen, entity="toolhead_3", mq="INFERRED"):
    return o(i, t, "user_reported_error_code", {"code": code}, entity=entity, mq=mq, ref="user_input/error_code", scen=scen)


def state(i, t, s, scen):
    return o(i, t, "state_transition", {"state": s}, scen=scen)


S = {}
S["known_code_feeder3"] = [
    state(1, "2026-01-01T10:00:00Z", "printing", "known_code_feeder3"),
    state(2, "2026-01-01T10:12:30Z", "paused", "known_code_feeder3"),
    code_obs(3, "2026-01-01T10:12:45Z", "0002-0525-0002-0002", "known_code_feeder3"),
]
S["known_code_level3"] = [code_obs(1, "2026-01-01T11:00:00Z", "0003-0522-0002-0008", "known_code_level3", entity="toolhead_1")]
S["timeout"] = [
    state(1, "2026-01-01T12:00:00Z", "printing", "timeout"),
    o(2, "2026-01-01T12:05:00Z", "connection_timeout", {"after_s": 5}, ref="transport/timeout", scen="timeout", validity="UNAVAILABLE"),
]
S["offline_gap"] = [
    state(1, "2026-01-01T13:00:00Z", "printing", "offline_gap"),
    o(2, "2026-01-01T13:10:00Z", "capture_gap", {"start": "2026-01-01T13:02:00Z", "end": "2026-01-01T13:09:00Z"}, ref="transport/gap", scen="offline_gap"),
    o(3, "2026-01-01T13:10:05Z", "extruder_temperature", {"celsius": 210.0}, entity="unmapped", mq="UNKNOWN", ref="extruder/temperature", scen="offline_gap", validity="STALE"),
]
S["mapping_unknown"] = [o(1, "2026-01-01T14:00:00Z", "extruder_temperature", {"celsius": 205.0}, entity="unmapped", mq="UNKNOWN", ref="extruder/temperature", scen="mapping_unknown")]
S["out_of_order"] = list(reversed(S["known_code_feeder3"]))
S["unknown_and_malformed_code"] = [
    code_obs(1, "2026-01-01T15:00:00Z", "0003-0529-0001-0009", "unknown_and_malformed_code", entity="unmapped", mq="UNKNOWN"),
    code_obs(2, "2026-01-01T15:01:00Z", "０００２-0525-0002-0002", "unknown_and_malformed_code", entity="unmapped", mq="UNKNOWN"),
    code_obs(3, "2026-01-01T15:02:00Z", "0002-0525-0002-0002 ; G28", "unknown_and_malformed_code", entity="unmapped", mq="UNKNOWN"),
]
S["state_changed_no_code"] = [
    state(1, "2026-01-01T16:00:00Z", "printing", "state_changed_no_code"),
    state(2, "2026-01-01T16:20:00Z", "error", "state_changed_no_code"),
]
S["security_denied_call"] = [o(1, "2026-01-01T17:00:00Z", "transport_denied", {"method": "POST", "path": "/printer/gcode/script"}, ref="transport/denied", scen="security_denied_call")]

# Signal scenarios (rules S11-S14): readings outside documented windows, recurring declared code, repeated connection drops.
S["signal_out_of_window"] = [
    state(1, "2026-01-02T09:00:00Z", "printing", "signal_out_of_window"),
    o(2, "2026-01-02T09:00:30Z", "bed_temperature_sample", {"celsius": 60.1}, ref="heater_bed/temperature", scen="signal_out_of_window"),
    o(3, "2026-01-02T09:01:00Z", "bed_temperature_sample", {"celsius": -12.3}, ref="heater_bed/temperature", scen="signal_out_of_window"),
    o(4, "2026-01-02T09:01:30Z", "temperature_sample", {"celsius": 312.0}, entity="unmapped", mq="UNKNOWN", ref="extruder/temperature", scen="signal_out_of_window"),
    o(5, "2026-01-02T09:02:00Z", "temperature_sample", {"celsius": 219.8}, entity="unmapped", mq="UNKNOWN", ref="extruder/temperature", scen="signal_out_of_window"),
]
S["signal_code_recurrence"] = [
    code_obs(1, "2026-01-03T10:00:00Z", "0003-0522-0001-0016", "signal_code_recurrence", entity="printer", mq="VERIFIED"),
    code_obs(2, "2026-01-03T10:04:00Z", "0003-0522-0001-0016", "signal_code_recurrence", entity="printer", mq="VERIFIED"),
    code_obs(3, "2026-01-03T10:09:00Z", "0003-0522-0001-0016", "signal_code_recurrence", entity="printer", mq="VERIFIED"),
    code_obs(4, "2026-01-03T10:30:00Z", "0002-0525-0002-0002", "signal_code_recurrence"),
]
S["signal_connection_flaps"] = [
    state(1, "2026-01-04T08:00:00Z", "printing", "signal_connection_flaps"),
    o(2, "2026-01-04T08:02:00Z", "connection_lost", {"after_s": 5}, ref="transport/lost", scen="signal_connection_flaps", validity="UNAVAILABLE"),
    o(3, "2026-01-04T08:05:00Z", "connection_timeout", {"after_s": 5}, ref="transport/timeout", scen="signal_connection_flaps", validity="UNAVAILABLE"),
    o(4, "2026-01-04T08:08:00Z", "connection_lost", {"after_s": 5}, ref="transport/lost", scen="signal_connection_flaps", validity="UNAVAILABLE"),
]

# S04: stream dropped, then HTTP probes (link problem vs Klipper stop vs unreachable).
def _probe(i, t, ok, ks, scen):
    return o(i, t, "link_probe", {"http_ok": ok, "klippy_state": ks}, ref="transport/probe", scen=scen)


for _n, _ok, _ks in (("signal_drop_link_only", True, "ready"), ("signal_drop_klipper_stopped", True, "shutdown"), ("signal_drop_unreachable", False, "UNKNOWN")):
    S[_n] = [state(1, "2026-01-05T08:00:00Z", "printing", _n),
             o(2, "2026-01-05T08:02:00Z", "connection_lost", {"after_s": 5}, ref="transport/lost", scen=_n, validity="UNAVAILABLE"),
             _probe(3, "2026-01-05T08:02:03Z", _ok, _ks, _n), _probe(4, "2026-01-05T08:02:06Z", _ok, _ks, _n)]

# S16: a nozzle fan at 0 while the nozzle is hot, several samples in a row (one nozzle faulty, one normal, one short dip).
def _fan(i, t, c, sp, ref, scen):
    return o(i, t, "nozzle_fan_sample", {"celsius": c, "fan_speed": sp}, entity="unmapped", mq="UNKNOWN", ref=ref, scen=scen)


_n = "signal_fan_off_hot"
S[_n] = [state(1, "2026-01-06T09:00:00Z", "printing", _n)]
for _k, _t in enumerate(("09:01:00", "09:02:00", "09:03:00", "09:04:00")):
    S[_n].append(_fan(2 + 3 * _k, f"2026-01-06T{_t}Z", 221.0, 0.0, "extruder2/fan", _n))
    S[_n].append(_fan(3 + 3 * _k, f"2026-01-06T{_t}Z", 220.5, 0.75, "extruder/fan", _n))
    S[_n].append(_fan(4 + 3 * _k, f"2026-01-06T{_t}Z", 221.0, 0.0 if _k == 1 else 0.75, "extruder3/fan", _n))

_n = "demo_extrusion_blockage"
_d = [state(1, "2026-01-13T14:09:12Z", "printing", _n)]
_i = 2
for _t, _c in (("14:09:30", 219.6), ("14:10:00", 220.1), ("14:10:30", 219.8), ("14:11:00", 220.0), ("14:11:30", 219.9), ("14:12:00", 220.2), ("14:13:30", 218.4), ("14:14:00", 214.7)):
    _d.append(o(_i, f"2026-01-13T{_t}Z", "temperature_sample", {"celsius": _c}, entity="toolhead_3", mq="INFERRED", ref="extruder2/temperature", scen=_n))
    _i += 1
for _t, _c in (("14:09:30", 60.1), ("14:11:00", 60.0), ("14:14:00", 59.9)):
    _d.append(o(_i, f"2026-01-13T{_t}Z", "bed_temperature_sample", {"celsius": _c}, ref="heater_bed/temperature", scen=_n))
    _i += 1
_d.append(o(_i, "2026-01-13T14:09:40Z", "temperature_sample", {"celsius": 220.3}, entity="unmapped", mq="UNKNOWN", ref="extruder/temperature", scen=_n))
_i += 1
_d.append(o(_i, "2026-01-13T14:12:30Z", "capture_gap", {"start": "2026-01-13T14:12:00Z", "end": "2026-01-13T14:13:30Z"}, ref="transport/gap", scen=_n))
_i += 1
_d.append(state(_i, "2026-01-13T14:14:12Z", "paused", _n))
_i += 1
_d.append(code_obs(_i, "2026-01-13T14:14:20Z", "0002-0525-0002-0004", _n))
S[_n] = _d


def jsonl(obs):
    return b"".join(canon(x) + b"\n" for x in obs)


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*"):
    old.unlink()
for name, obs in S.items():
    (OUT / f"synthetic_{name}.observations.jsonl").write_bytes(jsonl(obs))
    findings = evaluate(obs, RULESET)
    (OUT / f"synthetic_{name}.findings.json").write_bytes(canon(findings) + b"\n")

# Example bundle manifest (not zipped yet) for the main scenario.
name = "known_code_feeder3"
ob = (OUT / f"synthetic_{name}.observations.jsonl").read_bytes()
fb = (OUT / f"synthetic_{name}.findings.json").read_bytes()
rd = b"SYNTHETIC example bundle (G1). Not a real incident. Not captured from a U1.\n"
manifest = {
    "format": "U1-DEB", "format_version": "1.0.0", "app_version": "0.1.0-g1", "generated_at": "2026-11-05T00:00:00Z",
    "ruleset": {"id": RULESET["ruleset_id"], "version": RULESET["version"], "hash": ruleset_hash(RULESET)},
    "source_mix": ["SYNTHETIC"], "firmware_claim": "UNKNOWN",
    "capture_windows": [{"session_id": "synthetic_session_known_code_feeder3", "start_utc": "2026-01-01T10:00:00Z", "end_utc": "2026-01-01T10:13:00Z", "gaps": []}],
    "files": [
        {"name": "observations.jsonl", "sha256": sha256_hex(ob), "bytes": len(ob)},
        {"name": "findings.json", "sha256": sha256_hex(fb), "bytes": len(fb)},
        {"name": "README.txt", "sha256": sha256_hex(rd), "bytes": len(rd)},
    ],
    "limits": ["SYNTHETIC example; draft format."],
    "integrity_notice": "SHA-256 proves integrity of these files only; it does not prove authenticity of the author or that the data came from a specific machine.",
}
(OUT / "synthetic_bundle_manifest.json").write_bytes(canon(manifest) + b"\n")
print("wrote", len(list(OUT.glob("*"))), "files")
