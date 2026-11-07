"""S16: nozzle fan at 0 while the nozzle is hot. Empirical threshold, so the finding is WEAK and says so."""
import json
from pathlib import Path

from test_signals import ob, rule

from app.capture import frames_to_observations
from app.engine import evaluate

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
RID = "U1-S16-FAN-OFF-HOT"


def fan(i, c, sp, ref="extruder/fan", **k):
    return ob(i, f"2026-01-01T10:{i:02d}:00Z", "nozzle_fan_sample", {"celsius": c, "fan_speed": sp}, ref=ref, entity="unmapped", mq="UNKNOWN", **k)


def test_three_in_a_row_fires_with_weak_quality_and_threshold_caveat():
    f = rule(evaluate([fan(1, 200, 0), fan(2, 210, 0), fan(3, 220, 0)], RS), RID)
    assert len(f) == 1 and f[0]["evidence_quality"] == "WEAK" and f[0]["classification"] == "OBSERVED"
    assert any("not official" in x for x in f[0]["limits"]) and len(f[0]["evidence_for"]) == 3


def test_real_provenance_stays_weak():
    f = rule(evaluate([fan(i, 200, 0, status="REAL") for i in (1, 2, 3)], RS), RID)
    assert f[0]["evidence_quality"] == "WEAK"


def test_no_finding_when_short_cold_running_or_stale():
    assert rule(evaluate([fan(1, 200, 0), fan(2, 200, 0)], RS), RID) == []  # only 2
    assert rule(evaluate([fan(1, 59.9, 0), fan(2, 30, 0), fan(3, 59.9, 0)], RS), RID) == []  # below 60
    assert rule(evaluate([fan(1, 200, 0), fan(2, 200, 0.75), fan(3, 200, 0), fan(4, 200, 0)], RS), RID) == []  # run broken
    assert rule(evaluate([fan(i, 200, 0, validity="STALE") for i in (1, 2, 3)], RS), RID) == []


def test_boundary_is_inclusive_and_nozzles_are_separate():
    f = rule(evaluate([fan(1, 60, 0), fan(2, 60, 0), fan(3, 60, 0), fan(4, 200, 0, ref="extruder1/fan"), fan(5, 200, 0, ref="extruder1/fan")], RS), RID)
    assert len(f) == 1  # extruder: 3 samples at exactly 60; extruder1: only 2
    assert "extruder1" not in json.dumps(f[0]["evidence_for"])


def test_ignores_non_numbers():
    bad = [ob(i, f"2026-01-01T10:{i:02d}:00Z", "nozzle_fan_sample", {"celsius": "hot", "fan_speed": True}, ref="extruder/fan", entity="unmapped", mq="UNKNOWN") for i in (1, 2, 3)]
    assert rule(evaluate(bad, RS), RID) == []


def frame(t, **status):
    return json.dumps({"t": t, "frame": {"jsonrpc": "2.0", "method": "notify_status_update", "params": [status, 1.0]}})


def test_capture_pairs_temperature_with_fan_and_skips_when_no_fan_data():
    lines = [frame("2026-01-01T10:00:00Z", extruder={"temperature": 221.04}, **{"heater_fan e0_nozzle_fan": {"speed": 0.75}}),
             frame("2026-01-01T10:00:30Z", extruder={"temperature": 222.0}),
             frame("2026-01-01T10:01:05Z", extruder={"temperature": 223.0})]
    samples = [o for o in frames_to_observations(lines) if o["event_type"] == "nozzle_fan_sample"]
    assert [o["value"] for o in samples] == [{"celsius": 221.0, "fan_speed": 0.75}, {"celsius": 223.0, "fan_speed": 0.75}]
    assert all(o["entity_id"] == "unmapped" and o["mapping_quality"] == "UNKNOWN" and o["source_ref"] == "extruder/fan" for o in samples)
    nofan = frames_to_observations([frame("2026-01-01T10:00:00Z", extruder={"temperature": 221.0})])
    assert not [o for o in nofan if o["event_type"] == "nozzle_fan_sample"]
