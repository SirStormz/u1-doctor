"""REQ-008/009/002/003: determinism, replay and decoder semantics (all SYNTHETIC)."""
import json
import random
from pathlib import Path

import pytest

from app.engine import canon, evaluate, replay_hash
from app.knowledge import interpret, load_catalog

ROOT = Path(__file__).resolve().parents[2]
F = ROOT / "fixtures" / "synthetic"
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))


def obs_of(n):
    return [json.loads(l) for l in (F / f"synthetic_{n}.observations.jsonl").read_text(encoding="utf-8").splitlines()]


def gold(n):
    return json.loads((F / f"synthetic_{n}.findings.json").read_text(encoding="utf-8"))


def pairs(fs):
    return sorted((f["rule_id"], f["classification"]) for f in fs)


EXPECT = {
    "known_code_feeder3": [("U1-S01-CODE-DECODE", "OBSERVED"), ("U1-S03-STATE-TRANSITION", "OBSERVED")],
    "known_code_level3": [("U1-S01-CODE-DECODE", "OBSERVED")],
    "timeout": [("U1-S10-OBSERVATION-GAPS", "INCONCLUSIVE")],
    "offline_gap": [("U1-S09-MAPPING-UNKNOWN", "INCONCLUSIVE"), ("U1-S10-OBSERVATION-GAPS", "INCONCLUSIVE")],
    "mapping_unknown": [("U1-S09-MAPPING-UNKNOWN", "INCONCLUSIVE")],
    "out_of_order": [("U1-S01-CODE-DECODE", "OBSERVED"), ("U1-S03-STATE-TRANSITION", "OBSERVED")],
    "unknown_and_malformed_code": [("U1-S01-CODE-DECODE", "INCONCLUSIVE")] * 3 + [("U1-S09-MAPPING-UNKNOWN", "INCONCLUSIVE")],
    "state_changed_no_code": [("U1-S03-STATE-TRANSITION", "OBSERVED")],
    "security_denied_call": [("U1-SEC-BLOCKED-CALL", "OBSERVED")],
    # BACKLOG #57 live rules (SYNTHETIC window summaries): positive, normal values, sources not observable
    "live_rules_positive": [("U1-S17-OFFSET-Y-SPREAD", "OBSERVED"), ("U1-S18-SENSOR-IMPLAUSIBLE", "OBSERVED"), ("U1-S19-HEATER-NO-RISE", "OBSERVED"),
                            ("U1-S20-NOZZLE-DIAMETER", "OBSERVED"), ("U1-S20-NOZZLE-DIAMETER", "OBSERVED"), ("U1-S21-CLOCK-RESET", "OBSERVED"),
                            ("U1-S22-LOG-PARTITION", "OBSERVED"), ("U1-S23-TOOLHEAD-ACTIVITY", "OBSERVED"), ("U1-S24-BED-MESH-STATS", "OBSERVED")],
    "live_rules_normal": [("U1-S22-LOG-PARTITION", "OBSERVED"), ("U1-S24-BED-MESH-STATS", "INCONCLUSIVE")],
    "live_rules_absent": [
        ("U1-S17-OFFSET-Y-SPREAD", "INCONCLUSIVE"), ("U1-S18-SENSOR-IMPLAUSIBLE", "INCONCLUSIVE"), ("U1-S19-HEATER-NO-RISE", "INCONCLUSIVE"),
        ("U1-S20-NOZZLE-DIAMETER", "INCONCLUSIVE"), ("U1-S21-CLOCK-RESET", "INCONCLUSIVE"), ("U1-S22-LOG-PARTITION", "INCONCLUSIVE"),
        ("U1-S23-TOOLHEAD-ACTIVITY", "INCONCLUSIVE"), ("U1-S24-BED-MESH-STATS", "INCONCLUSIVE")],
    "demo_extrusion_blockage": [("U1-S01-CODE-DECODE", "OBSERVED"), ("U1-S03-STATE-TRANSITION", "OBSERVED"), ("U1-S09-MAPPING-UNKNOWN", "INCONCLUSIVE"), ("U1-S10-OBSERVATION-GAPS", "INCONCLUSIVE")],
}


@pytest.mark.parametrize("name,expected", EXPECT.items())
def test_expected_classifications(name, expected):
    assert pairs(evaluate(obs_of(name), RS)) == sorted(expected)


@pytest.mark.parametrize("name", EXPECT)
def test_matches_golden_byte_for_byte(name):
    assert canon(evaluate(obs_of(name), RS)) + b"\n" == (F / f"synthetic_{name}.findings.json").read_bytes()


@pytest.mark.parametrize("name", EXPECT)
def test_order_independence_and_replay_hash(name):
    base = evaluate(obs_of(name), RS)
    rnd = random.Random(1234)
    for _ in range(25):
        o = obs_of(name)
        rnd.shuffle(o)
        assert evaluate(o, RS) == base
    for f in base:
        assert f["replay_hash"] == replay_hash(f)


def test_out_of_order_equals_ordered():
    assert evaluate(obs_of("out_of_order"), RS) == evaluate(obs_of("known_code_feeder3"), RS)


def test_every_conclusion_links_existing_evidence_and_has_limits():
    for name in EXPECT:
        ids = {o["observation_id"] for o in obs_of(name)}
        for f in evaluate(obs_of(name), RS):
            assert f["evidence_for"] and f["limits"]
            assert {e["observation_id"] for e in f["evidence_for"] + f["evidence_against"]} <= ids
            assert f["classification"] != "CONFIRMED_BY_PROTOCOL"
            assert "confidence" not in f and "probability" not in f


def test_correlation_not_causation_wording():
    f = next(x for x in evaluate(obs_of("known_code_feeder3"), RS) if x["rule_id"] == "U1-S03-STATE-TRANSITION")
    assert any("correlation only" in e["note"] for e in f["evidence_for"])
    assert f["not_a_root_cause"] is True and "not determined" in f["missing_data"][0]


def test_level3_never_encourages_printing():
    f = evaluate(obs_of("known_code_level3"), RS)[0]
    assert "Do not continue printing" in f["safe_actions"][0]


def test_offline_not_machine_failure():
    f = evaluate(obs_of("timeout"), RS)[0]
    assert "does not mean the printer stopped" in " ".join(f["limits"])


def test_same_input_different_ruleset_changes_hash_not_silently():
    other = json.loads(json.dumps(RS))
    other["version"] = "9.9.9"
    a, b = evaluate(obs_of("known_code_feeder3"), RS), evaluate(obs_of("known_code_feeder3"), other)
    assert a[0]["ruleset_hash"] != b[0]["ruleset_hash"] and a[0]["replay_hash"] != b[0]["replay_hash"]


def test_unknown_evaluator_and_status_refused():
    bad = json.loads(json.dumps(RS))
    bad["rules"][0]["evaluator"] = "__import__('os').system"
    with pytest.raises(ValueError):
        evaluate([], bad)
    bad = json.loads(json.dumps(RS))
    bad["rules"][0]["status"] = "CONFIRMED"
    with pytest.raises(ValueError):
        evaluate([], bad)


# --- decoder (S01) -----------------------------------------------------
def test_official_example_decodes():
    d = interpret("0002-0525-0002-0002")
    assert d["status"] == "KNOWN" and d["severity"] == "warning" and d["module"] == "filament feeder"
    assert d["entry"]["toolhead"] == 3


def test_unknown_valid_code_is_inconclusive_with_structure_only():
    d = interpret("0003-0529-0001-0009")
    assert d["status"] == "STRUCTURE_ONLY" and d["classification"] == "INCONCLUSIVE" and d["entry"] is None


@pytest.mark.parametrize("raw", [None, 5, "", " 0002-0525-0002-0002", "0002-0525-0002-0002\n", "0002-0525-0002", "0002_0525_0002_0002",
                                   "０００２-0525-0002-0002", "٠٠٠٢-0525-0002-0002", "0002-0525-0002-0002;G28", "A" * 5000,
                                   "0002-0525-0002-0002‮"])
def test_malformed_rejected_without_crash(raw):
    assert interpret(raw)["status"] == "MALFORMED"


def test_invalid_level_group_not_invented():
    d = interpret("0009-0525-0002-0002")
    assert d["severity"] is None and d["classification"] == "INCONCLUSIVE"


def test_catalog_integrity():
    cat = load_catalog()
    for e in cat["entries"]:
        lvl, mod, _, _ = e["code"].split("-")
        assert lvl in cat["levels"] and mod in cat["modules"]
        assert e["summary"] and e["title"]
    assert cat["last_verified_at"] == "2026-11-06"


def test_finding_example_doc_matches_the_current_findings():
    """docs/FINDING_EXAMPLE.md quotes the replay hashes of the demo scenario: regenerate it when the ruleset changes."""
    doc = (ROOT / "docs" / "FINDING_EXAMPLE.md").read_text(encoding="utf-8")
    assert "SYNTHETIC / DEMO" in doc
    for f in json.loads((F / "synthetic_demo_extrusion_blockage.findings.json").read_text(encoding="utf-8")):
        assert f["replay_hash"] in doc
        assert f["human_title"].removeprefix("SYNTHETIC: ") in doc
