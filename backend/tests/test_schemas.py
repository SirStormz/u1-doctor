"""Schemas are valid; fixtures and engine output conform; bad documents rejected."""
import copy
import hashlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
S = ROOT / "schemas"
F = ROOT / "fixtures" / "synthetic"


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


def validator(name):
    schema = load(S / name)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def obs_of(name):
    return [json.loads(l) for l in (F / f"synthetic_{name}.observations.jsonl").read_text(encoding="utf-8").splitlines()]


def findings_of(name):
    return load(F / f"synthetic_{name}.findings.json")


NAMES = sorted(p.name.removeprefix("synthetic_").removesuffix(".observations.jsonl") for p in F.glob("*.observations.jsonl"))
OBS = obs_of("known_code_feeder3")
FINDING = findings_of("known_code_feeder3")[0]
MANIFEST = load(F / "synthetic_bundle_manifest.json")


def test_eight_plus_scenarios_present():
    assert len(NAMES) >= 8


@pytest.mark.parametrize("name", NAMES)
def test_all_fixtures_valid_and_synthetic(name):
    vo, vf = validator("observation.schema.json"), validator("finding.schema.json")
    for o in obs_of(name):
        vo.validate(o)
        assert o["source_status"] == "SYNTHETIC" and "synthetic" in o["observation_id"]
    for f in findings_of(name):
        vf.validate(f)
        assert f["human_title"].startswith("SYNTHETIC: ")
        assert f["source_mix"] == ["SYNTHETIC"]


def test_bundle_manifest_valid_and_hashes_match():
    validator("evidence-bundle.schema.json").validate(MANIFEST)
    by = {f["name"]: f for f in MANIFEST["files"]}
    for name, path in (("observations.jsonl", "synthetic_known_code_feeder3.observations.jsonl"), ("findings.json", "synthetic_known_code_feeder3.findings.json")):
        data = (F / path).read_bytes()
        assert hashlib.sha256(data).hexdigest() == by[name]["sha256"] and len(data) == by[name]["bytes"]


def test_ruleset_hash_in_manifest_matches_ruleset():
    from app.engine import ruleset_hash

    rs = load(ROOT / "rulesets" / "u1-starter" / "ruleset.json")
    assert MANIFEST["ruleset"]["hash"] == ruleset_hash(rs) == FINDING["ruleset_hash"]


def mutate(doc, **kw):
    d = copy.deepcopy(doc)
    d.update(kw)
    return d


@pytest.mark.parametrize(
    "bad",
    [
        {"entity_id": "toolhead_5"},
        {"entity_id": "toolhead_3", "mapping_quality": "UNKNOWN"},
        {"source_kind": "DEMO", "source_status": "REAL"},
        {"source_status": "SYNTHETIC", "observation_id": "obs_001"},
        {"capture_utc": "2026-01-01T10:00:00+01:00"},
        {"source_ref": "http://evil.example/x"},
        {"source_ref": "a/../b"},
        {"extra": 1},
    ],
)
def test_bad_observations_rejected(bad):
    assert list(validator("observation.schema.json").iter_errors(mutate(OBS[2], **bad)))


def test_confirmed_requires_protocol_ref_and_no_probability_field():
    v = validator("finding.schema.json")
    assert list(v.iter_errors(mutate(FINDING, classification="CONFIRMED_BY_PROTOCOL")))
    assert list(v.iter_errors(mutate(FINDING, confidence=0.92)))
    assert list(v.iter_errors(mutate(FINDING, limits=[])))
    assert list(v.iter_errors(mutate(FINDING, classification="SUSPECTED", evidence_for=[])))


def test_bundle_manifest_rejects_unexpected_files_and_notice_tamper():
    v = validator("evidence-bundle.schema.json")
    m = copy.deepcopy(MANIFEST)
    m["files"].append({"name": "../evil.py", "sha256": "0" * 64, "bytes": 1})
    assert list(v.iter_errors(m))
    assert list(v.iter_errors(mutate(MANIFEST, integrity_notice="authentic")))
