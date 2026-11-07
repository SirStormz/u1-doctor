"""Signal evaluators (S11-S14): boundaries, validity, determinism, and what they refuse to claim."""
import json
import random
from pathlib import Path

from app.engine import evaluate

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))


def ob(i, t, etype, value, *, ref="x/y", validity="FRESH", status="SYNTHETIC", entity="printer", mq="VERIFIED"):
    sid = "synthetic_" if status == "SYNTHETIC" else ""
    return {"schema_version": "1.0", "observation_id": f"{sid}s_{i:03d}", "session_id": f"{sid}sess", "source_kind": "DEMO" if status == "SYNTHETIC" else "MOONRAKER",
            "source_status": status, "capture_utc": t, "source_timestamp": None, "timestamp_quality": "RECEIPT_ONLY", "source_ref": ref, "entity_id": entity,
            "mapping_quality": mq, "event_type": etype, "value": value, "validity": validity, "sensitive": False}


def rule(findings, rid):
    return [f for f in findings if f["rule_id"] == rid]


def bed(i, c, **k):
    return ob(i, f"2026-01-01T10:00:{i:02d}Z", "bed_temperature_sample", {"celsius": c}, **k)


# ---- value window -----------------------------------------------------------
def test_window_boundaries_are_inclusive():
    f = evaluate([bed(1, -10.0), bed(2, 110.0), bed(3, 60.0)], RS)
    assert rule(f, "U1-S11-BED-WINDOW") == []


def test_bed_outside_window_fires_once_with_all_hits():
    f = rule(evaluate([bed(1, 110.1), bed(2, 60.0), bed(3, -10.5)], RS), "U1-S11-BED-WINDOW")
    assert len(f) == 1 and [e["observation_id"] for e in f[0]["evidence_for"]] == ["synthetic_s_001", "synthetic_s_003"]
    assert f[0]["classification"] == "OBSERVED" and "0003-0526-0000-0000" in f[0]["hypotheses"][0]["text"]


def test_nozzle_window_uses_310_and_minus_10():
    ok = [ob(1, "2026-01-01T10:00:01Z", "temperature_sample", {"celsius": 310.0}, entity="unmapped", mq="UNKNOWN"),
          ob(2, "2026-01-01T10:00:02Z", "extruder_temperature", {"celsius": -10.0}, entity="unmapped", mq="UNKNOWN")]
    assert rule(evaluate(ok, RS), "U1-S12-NOZZLE-WINDOW") == []
    hot = ok + [ob(3, "2026-01-01T10:00:03Z", "temperature_sample", {"celsius": 310.5}, entity="unmapped", mq="UNKNOWN")]
    assert len(rule(evaluate(hot, RS), "U1-S12-NOZZLE-WINDOW")) == 1


def test_window_ignores_stale_unavailable_and_non_numbers():
    obs = [bed(1, 500.0, validity="STALE"), bed(2, 500.0, validity="UNAVAILABLE"), bed(3, 500.0, validity="MALFORMED"),
           ob(4, "2026-01-01T10:00:04Z", "bed_temperature_sample", {"celsius": True}), ob(5, "2026-01-01T10:00:05Z", "bed_temperature_sample", {"celsius": "hot"}),
           ob(6, "2026-01-01T10:00:06Z", "bed_temperature_sample", {"celsius": float("nan")}), ob(7, "2026-01-01T10:00:07Z", "bed_temperature_sample", "str")]
    assert rule(evaluate(obs, RS), "U1-S11-BED-WINDOW") == []


def test_window_quality_depends_on_provenance():
    syn = rule(evaluate([bed(1, 150.0)], RS), "U1-S11-BED-WINDOW")[0]
    real = rule(evaluate([bed(1, 150.0, status="REAL")], RS), "U1-S11-BED-WINDOW")[0]
    assert syn["evidence_quality"] == "MODERATE" and real["evidence_quality"] == "STRONG"
    assert any("not proof of its cause" in x for x in real["limits"])


# ---- code recurrence --------------------------------------------------------
def code(i, t, c):
    return ob(i, t, "user_reported_error_code", {"code": c}, ref="user_input/error_code")


def test_recurrence_needs_three_inside_the_window():
    two = [code(1, "2026-01-01T10:00:00Z", "0003-0522-0001-0016"), code(2, "2026-01-01T10:05:00Z", "0003-0522-0001-0016")]
    assert rule(evaluate(two, RS), "U1-S13-CODE-RECURRENCE") == []
    spread = two + [code(3, "2026-01-01T10:30:00Z", "0003-0522-0001-0016")]  # 3 declarations but never 3 within 900 s
    assert rule(evaluate(spread, RS), "U1-S13-CODE-RECURRENCE") == []
    three = two + [code(3, "2026-01-01T10:12:00Z", "0003-0522-0001-0016")]
    f = rule(evaluate(three, RS), "U1-S13-CODE-RECURRENCE")
    assert len(f) == 1 and f[0]["human_title"].endswith("Code 0003-0522-0001-0016 declared 3 times within 900 s")


def test_recurrence_is_per_code_and_counts_declarations_only():
    obs = [code(1, "2026-01-01T10:00:00Z", "0003-0522-0001-0016"), code(2, "2026-01-01T10:01:00Z", "0002-0525-0002-0002"), code(3, "2026-01-01T10:02:00Z", "0003-0522-0001-0016"),
           code(4, "2026-01-01T10:03:00Z", "0002-0525-0002-0002"), code(5, "2026-01-01T10:04:00Z", "0003-0522-0001-0016")]
    f = rule(evaluate(obs, RS), "U1-S13-CODE-RECURRENCE")
    assert len(f) == 1 and f[0]["evidence_quality"] == "WEAK"
    assert any("declarations, not machine events" in x for x in f[0]["limits"])


def test_recurrence_of_malformed_text_has_no_hypothesis():
    obs = [code(i, f"2026-01-01T10:00:{i:02d}Z", "not a code") for i in range(1, 4)]
    f = rule(evaluate(obs, RS), "U1-S13-CODE-RECURRENCE")
    assert len(f) == 1 and f[0]["hypotheses"] == []


# ---- connection flaps -------------------------------------------------------
def drop(i, t, etype="connection_lost"):
    return ob(i, t, etype, {"after_s": 5}, ref="transport/x", validity="UNAVAILABLE")


def test_flaps_need_three_drops_within_ten_minutes():
    two = [drop(1, "2026-01-01T10:00:00Z"), drop(2, "2026-01-01T10:03:00Z", "connection_timeout")]
    assert rule(evaluate(two, RS), "U1-S14-CONNECTION-FLAPS") == []
    slow = two + [drop(3, "2026-01-01T10:20:00Z")]
    assert rule(evaluate(slow, RS), "U1-S14-CONNECTION-FLAPS") == []
    f = rule(evaluate(two + [drop(3, "2026-01-01T10:08:00Z")], RS), "U1-S14-CONNECTION-FLAPS")
    assert len(f) == 1 and f[0]["classification"] == "INCONCLUSIVE" and f[0]["evidence_quality"] == "WEAK"
    assert any("does not mean the printer stopped" in x for x in f[0]["limits"])


def test_flaps_do_not_claim_the_printer_state():
    f = rule(evaluate([drop(i, f"2026-01-01T10:0{i}:00Z") for i in range(1, 4)], RS), "U1-S14-CONNECTION-FLAPS")[0]
    assert "stopped" not in f["hypotheses"][0]["text"] and f["hypotheses"][0]["label"] == "OFFICIAL_REFERENCE"


# ---- determinism ------------------------------------------------------------
def test_new_rules_are_order_independent():
    obs = [bed(1, 150.0), bed(2, 60.0)] + [code(10 + i, f"2026-01-01T11:00:{i:02d}Z", "0003-0522-0001-0016") for i in range(3)] + [drop(20 + i, f"2026-01-01T12:0{i}:00Z") for i in range(3)]
    base = json.dumps(evaluate(obs, RS), sort_keys=True)
    rnd = random.Random(7)
    for _ in range(20):
        sh = obs[:]
        rnd.shuffle(sh)
        assert json.dumps(evaluate(sh, RS), sort_keys=True) == base


def test_ruleset_declares_the_reference_pages():
    for r in RS["rules"]:
        if r["evaluator"] in ("value_window", "connection_flaps"):
            assert r["params"]["reference_url"].startswith("https://wiki.snapmaker.com/en/snapmaker_u1/")


# ---- Dry Run prediction (S15) -----------------------------------------------
def dr(i, etype, value):
    o = ob(i, f"2026-01-01T10:00:{i:02d}Z", etype, value, status="IMPORTED", entity="unmapped", mq="UNKNOWN")
    o["source_kind"] = "IMPORT"
    return o


ERR = ("dryrun_firmware_error", {"line": 42, "message": "Move out of range"})
SCAR = ("dryrun_scar", {"line": 900, "source": "slicer", "tool": "T1", "z": 0.6, "length_mm": 12.5, "clearance_mm": 0.2})


def test_dryrun_clean_report_gives_no_finding():
    assert rule(evaluate([dr(1, "dryrun_summary", {"clean": True}), dr(2, "dryrun_start_margin", {"room_mm": 0.09})], RS), "U1-S15-DRYRUN-PREDICTION") == []


def test_dryrun_prediction_is_suspected_weak_and_never_observed():
    f = rule(evaluate([dr(1, *ERR), dr(2, *SCAR)], RS), "U1-S15-DRYRUN-PREDICTION")
    assert len(f) == 1
    x = f[0]
    assert x["classification"] == "SUSPECTED" and x["evidence_quality"] == "WEAK" and x["source_mix"] == ["IMPORTED"]
    assert x["human_title"] == "Dry Run predicts 1 firmware errors and 1 scars in the sliced file"
    assert [h["label"] for h in x["hypotheses"]] == ["COMMUNITY_HYPOTHESIS"]
    assert any("not an observation of a machine" in lim for lim in x["limits"])
    assert x["references"][0]["kind"] == "COMMUNITY_THREAD" and x["references"][0]["url"].startswith("https://github.com/")


def test_dryrun_declared_code_in_same_set_is_cooccurrence_only():
    code = ob(3, "2026-01-01T10:00:03Z", "user_reported_error_code", {"code": "0003-0525-0002-0004"})
    x = rule(evaluate([dr(1, *ERR), code], RS), "U1-S15-DRYRUN-PREDICTION")[0]
    notes = [e["note"] for e in x["evidence_for"]]
    assert any("co-occurrence only" in n for n in notes) and set(x["source_mix"]) == {"IMPORTED", "SYNTHETIC"}


def test_dryrun_evidence_is_capped_but_counts_are_exact():
    obs = [dr(i, *SCAR) for i in range(1, 31)]
    x = rule(evaluate(obs, RS), "U1-S15-DRYRUN-PREDICTION")[0]
    assert "30 scars" in x["human_title"] and len(x["evidence_for"]) == 20 and any("first 20" in lim for lim in x["limits"])


def test_dryrun_is_deterministic_and_order_independent():
    obs = [dr(1, *ERR), dr(2, *SCAR), dr(3, *SCAR)]
    a = evaluate(obs, RS)
    random.Random(7).shuffle(obs)
    assert evaluate(obs, RS) == a
