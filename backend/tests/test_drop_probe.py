"""S04: a dropped stream followed by HTTP probes. Separates a lost link from a Klipper stop; claims nothing about the print."""
import json
from pathlib import Path

from test_signals import ob, rule

from app.engine import evaluate

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
RID = "U1-S04-DROP-PROBE"


def lost(i=1, t="2026-01-01T10:00:00Z", **k):
    return ob(i, t, "connection_lost", {"after_s": 5}, validity="UNAVAILABLE", **k)


def probe(i, t, ok, ks, **k):
    return ob(i, t, "link_probe", {"http_ok": ok, "klippy_state": ks}, **k)


def test_link_problem_when_klipper_still_ready():
    f = rule(evaluate([lost(), probe(2, "2026-01-01T10:00:03Z", True, "ready")], RS), RID)
    assert len(f) == 1 and f[0]["classification"] == "OBSERVED" and "link problem" in f[0]["human_title"]
    assert any("do not show whether the print continues" in x for x in f[0]["limits"])


def test_klipper_state_reported_when_not_ready():
    f = rule(evaluate([lost(), probe(2, "2026-01-01T10:00:03Z", True, "shutdown")], RS), RID)
    assert len(f) == 1 and "shutdown" in f[0]["human_title"] and "link problem" not in f[0]["human_title"]


def test_unreachable_is_inconclusive():
    f = rule(evaluate([lost(), probe(2, "2026-01-01T10:00:03Z", False, "UNKNOWN")], RS), RID)
    assert len(f) == 1 and f[0]["classification"] == "INCONCLUSIVE"


def test_no_finding_without_a_drop_or_without_probes_in_window():
    assert rule(evaluate([probe(1, "2026-01-01T10:00:03Z", True, "ready")], RS), RID) == []
    assert rule(evaluate([lost()], RS), RID) == []
    assert rule(evaluate([lost(), probe(2, "2026-01-01T10:05:00Z", True, "ready")], RS), RID) == []  # outside 120 s
    assert rule(evaluate([probe(1, "2026-01-01T09:59:00Z", True, "ready"), lost(2)], RS), RID) == []  # probe before the drop


def test_real_provenance_raises_quality():
    f = rule(evaluate([lost(status="REAL"), probe(2, "2026-01-01T10:00:03Z", True, "ready", status="REAL")], RS), RID)[0]
    assert f["evidence_quality"] == "MODERATE"
