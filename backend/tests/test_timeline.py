"""G3 timeline reconstruction: determinism, honesty (no invented past/gaps), real capture facts."""
import json
import random
from pathlib import Path

import pytest

from app.timeline import build_timeline

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "fixtures"


def load(path: Path) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()]


REAL = load(FIX / "real" / "real_h02_normal_print.observations.jsonl")
SYN = {p.name.removeprefix("synthetic_").removesuffix(".observations.jsonl"): load(p) for p in (FIX / "synthetic").glob("*.observations.jsonl")}


def test_real_capture_phases_are_exactly_what_was_observed():
    tl = build_timeline(REAL)
    assert [(p["state"], p["ended_by_transition"]) for p in tl["phases"]] == [("printing", True), ("complete", False)]
    printing, complete = tl["phases"]
    assert printing["start_utc"] == "2026-11-05T20:29:22.496860Z" and printing["duration_s"] > 1600  # ~27 min, from the observations themselves
    assert printing["end_utc"] == complete["start_utc"]
    assert complete["end_utc"] == tl["observed_window"]["end_utc"]  # no future invented: ends where observation ends
    assert tl["observed_window"]["start_utc"] == REAL[0]["capture_utc"]


def test_real_capture_has_no_incident_no_gap_and_says_so_carefully():
    tl = build_timeline(REAL)
    assert tl["incident"] is None and tl["gaps"] == []
    assert tl["integrity"] == "NO_GAP_RECORDED"  # never "COMPLETE": absence of a gap record is not proof
    assert tl["time_basis"]["timestamp_quality_counts"] == {"RECEIPT_ONLY": 50}
    assert any("lost connection never means" in x for x in tl["limits"])


def test_telemetry_is_never_collapsed_but_each_fact_keeps_provenance():
    tl = build_timeline(REAL)
    assert sum(e["repeat"] for e in tl["entries"]) == len(REAL) == tl["observation_count"]
    temps = [e for e in tl["entries"] if e["event_type"] == "temperature_sample"]
    assert len(temps) == 30 and all(e["repeat"] == 1 and e["entity_id"] == "unmapped" and e["mapping_quality"] == "UNKNOWN" for e in temps)
    assert all(e["source_status"] == "REAL" and e["ids"] for e in tl["entries"])


def test_identical_state_like_facts_are_collapsed_with_count_and_all_ids():
    base = dict(REAL[1])  # machine_action_code 0
    rows = [{**base, "observation_id": f"r_{i}", "capture_utc": f"2026-11-05T20:00:0{i}.000000Z", "value": {"action_code": 7}} for i in range(3)]
    rows.append({**base, "observation_id": "r_9", "capture_utc": "2026-11-05T20:00:09.000000Z", "value": {"action_code": 8}})
    tl = build_timeline(rows)
    assert [(e["summary"]["action_code"], e["repeat"], e["ids"]) for e in tl["entries"]] == [(7, 3, ["r_0", "r_1", "r_2"]), (8, 1, ["r_9"])]
    assert tl["entries"][0]["last_utc"] == "2026-11-05T20:00:02.000000Z"


@pytest.mark.parametrize("name", sorted(SYN))
def test_every_synthetic_scenario_builds_and_is_order_independent(name):
    obs = SYN[name]
    a = build_timeline(obs)
    shuffled = obs[:]
    random.Random(11).shuffle(shuffled)
    assert json.dumps(a, sort_keys=True) == json.dumps(build_timeline(shuffled), sort_keys=True)
    assert a["observation_count"] == len(obs) and a["observed_window"]["duration_s"] >= 0


def test_gap_is_materialised_only_from_an_explicit_capture_gap_observation():
    tl = build_timeline(SYN["offline_gap"])
    assert tl["integrity"] == "GAPS_RECORDED"
    assert [(g["start_utc"], g["end_utc"], g["duration_s"]) for g in tl["gaps"]] == [("2026-01-01T13:02:00Z", "2026-01-01T13:09:00Z", 420.0)]
    # the same observations without the gap record show no gap: the timeline never infers one
    no_gap = [o for o in SYN["offline_gap"] if o["event_type"] != "capture_gap"]
    assert build_timeline(no_gap)["gaps"] == []


def test_incident_marks_before_after_inside_observed_window_only():
    tl = build_timeline(SYN["demo_extrusion_blockage"])
    inc = tl["incident"]
    assert inc is not None and inc["state"] == "paused"
    assert inc["entries_before"] >= 1 and inc["t_utc"] >= tl["observed_window"]["start_utc"]
    assert "Nothing before the first observation" in inc["note"]


def test_degraded_data_is_reported_not_hidden():
    rows = [{**REAL[3], "observation_id": "r_1", "validity": "STALE"}, {**REAL[4], "observation_id": "r_2"}]
    tl = build_timeline(rows)
    assert tl["data_quality"]["STALE"] == 1 and tl["integrity"] == "DEGRADED_DATA"


def test_empty_input_refused():
    with pytest.raises(ValueError):
        build_timeline([])
