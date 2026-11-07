"""Real capture H-02 (owner's U1, normal print): schema, determinism, replay, honesty."""
import json
import random
from pathlib import Path

import jsonschema

from app.capture import frames_to_observations
from app.engine import canon, evaluate, replay_hash

ROOT = Path(__file__).resolve().parents[2]
F = ROOT / "fixtures" / "real"
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
SCHEMA = json.loads((ROOT / "schemas" / "observation.schema.json").read_text(encoding="utf-8"))
OBS = [json.loads(x) for x in (F / "real_h02_normal_print.observations.jsonl").read_text(encoding="utf-8").splitlines()]
GOLD = json.loads((F / "real_h02_normal_print.findings.json").read_text(encoding="utf-8"))


def test_observations_are_schema_valid_and_real():
    for o in OBS:
        jsonschema.validate(o, SCHEMA)
        assert o["source_status"] == "REAL" and o["source_kind"] == "MOONRAKER"
    assert [o["value"]["state"] for o in OBS if o["event_type"] == "state_transition"] == ["printing", "complete"]


def test_no_private_data_in_committed_fixtures():
    text = "".join(p.read_text(encoding="utf-8") for p in F.glob("*")).lower()
    for bad in ("192.168", "gcode", "lava", "hostname", "filename"):
        assert bad not in text


def test_replay_is_identical_and_order_independent():
    out = evaluate(OBS, RS)
    assert canon(out) == canon(GOLD)
    shuffled = OBS[:]
    random.Random(7).shuffle(shuffled)
    assert [replay_hash(f) for f in evaluate(shuffled, RS)] == [replay_hash(f) for f in GOLD]


def test_clean_print_makes_no_claim_about_a_fault():
    # a normal print must not produce a state-change or error finding; toolhead mapping stays unknown
    assert [(f["rule_id"], f["classification"]) for f in GOLD] == [("U1-S09-MAPPING-UNKNOWN", "INCONCLUSIVE")]
    assert all(not f["human_title"].startswith("SYNTHETIC") for f in GOLD)


def test_converter_is_deterministic_and_drops_unknown_fields():
    frames = [
        json.dumps({"t": "2026-11-05T20:00:00.000000Z", "frame": {"method": "notify_status_update", "params": [
            {"print_stats": {"state": "printing", "filename": "secret.gcode"}, "extruder": {"temperature": 200.04}}, 1.0]}}),
        json.dumps({"t": "2026-11-05T20:00:30.000000Z", "frame": {"method": "notify_status_update", "params": [{"extruder": {"temperature": 201.0}}, 2.0]}}),
    ]
    a, b = frames_to_observations(frames), frames_to_observations(frames)
    assert a == b and "secret" not in json.dumps(a)
    assert [o["event_type"] for o in a] == ["state_transition", "temperature_sample"]  # 30 s later: below the 60 s sampling step
    assert a[1]["value"]["celsius"] == 200.0 and a[1]["entity_id"] == "unmapped" and a[1]["mapping_quality"] == "UNKNOWN"
