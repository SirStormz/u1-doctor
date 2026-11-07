"""'Needs your eyes' wizard: sourced causes in wiki order, evidence only from numbers, strict answers, no ranking."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import symptoms
from app.api import create_app

ROOT = Path(__file__).resolve().parents[2]
REAL = [json.loads(x) for x in (ROOT / "fixtures/real/real_h02_normal_print.observations.jsonl").read_text(encoding="utf-8").splitlines()]
DATA = symptoms.load_symptoms()


def causes(symptom: str, answers: dict, obs=None) -> dict:
    return {c["id"]: c for c in symptoms.evaluate(symptom, answers, obs)["causes"]}


# ---- catalogue ------------------------------------------------------------
def test_catalogue_is_complete_and_bilingual():
    assert len(DATA["symptoms"]) >= 16
    for s in DATA["symptoms"]:
        assert s["page"].startswith("snapmaker_u1/") and s["title"]["en"] and s["title"]["fr"] and s["eyes"]["en"] and s["eyes"]["fr"]
        for c in s["causes"]:
            assert c["text"]["en"] and c["text"]["fr"], c["id"]
            assert c.get("eyes") or c.get("check"), c["id"]  # nothing is left without an owner or a number


def test_every_wiki_page_is_a_real_snapshot_page():
    pages = {s["page"] for s in DATA["symptoms"]}
    assert "snapmaker_u1/troubleshooting/stringing_or_oozing" in pages and len(pages) == len(DATA["symptoms"])


def test_materials_match_wiki_table():
    m = DATA["materials"]
    assert m["PLA"]["nozzle"] == [190, 230] and m["PLA"]["bed"] == [55, 65]
    assert m["PETG"]["bed"] == [60, 80] and m["ABS/ASA"]["nozzle"] == [240, 280] and m["TPU"]["bed"] == [30, 35]


def test_catalog_route_lists_what_to_ask_per_symptom():
    cat = symptoms.catalog()
    s = {x["id"]: x for x in cat["symptoms"]}
    assert "mesh_range" in s["first-layer-gaps"]["ask"] and "firmware" in s["first-layer-gaps"]["ask"]
    assert s["gloss"]["ask"] == []  # only eyes: nothing to type
    assert "causes" not in s["gloss"]


# ---- strict answers ---------------------------------------------------------
@pytest.mark.parametrize("bad", [{"nope": 1}, {"mesh_range": True}, {"mesh_range": -1}, {"mesh_range": "x"}, {"material": "unobtainium"},
                                 {"plate": "glass"}, {"firmware": "abc"}, {"nozzle_temp": 9999}, "text", [1]])
def test_bad_answers_are_refused(bad):
    with pytest.raises(ValueError):
        symptoms.clean_answers(bad)


def test_empty_answers_give_no_evidence_and_no_guess():
    out = symptoms.evaluate("first-layer-gaps", {})
    assert all(c["evidence"] == [] and c["lean"] == "NONE" for c in out["causes"])
    assert [c["id"] for c in out["causes"]] == [c["id"] for c in next(s for s in DATA["symptoms"] if s["id"] == "first-layer-gaps")["causes"]]


def test_unknown_symptom():
    with pytest.raises(KeyError):
        symptoms.evaluate("nope", {})


# ---- evaluators ---------------------------------------------------------------
def test_mesh_range_thresholds():
    assert causes("first-layer-gaps", {"mesh_range": 0.9})["fl-mesh"]["lean"] == "FOR"
    assert causes("first-layer-gaps", {"mesh_range": 0.3})["fl-mesh"]["lean"] == "AGAINST"
    mid = causes("first-layer-gaps", {"mesh_range": 0.6})["fl-mesh"]
    assert mid["lean"] == "NONE" and mid["evidence"][0]["direction"] == "unclear"


def test_bed_temperature_against_material_window():
    low = causes("first-layer-adhesion", {"material": "PETG", "bed_temp": 40})["pa-bed"]
    ok = causes("first-layer-adhesion", {"material": "PETG", "bed_temp": 70})["pa-bed"]
    assert low["lean"] == "FOR" and ok["lean"] == "AGAINST" and low["evidence"][0]["source"] == "USER_REPORTED"
    assert causes("first-layer-adhesion", {"bed_temp": 40})["pa-bed"]["evidence"] == []  # no material: no verdict


def test_nozzle_high_and_low():
    assert causes("stringing", {"material": "PLA", "nozzle_temp": 245})["st-temp"]["lean"] == "FOR"
    assert causes("stringing", {"material": "PLA", "nozzle_temp": 215})["st-temp"]["lean"] == "AGAINST"
    assert causes("interlayer-cracking", {"material": "PLA", "nozzle_temp": 180})["ic-temp"]["lean"] == "FOR"
    assert causes("interlayer-cracking", {"material": "PLA", "nozzle_temp": 200})["ic-temp"]["lean"] == "AGAINST"


def test_retraction_ranges():
    assert causes("pitting", {"retraction_length": 3})["pt-retract"]["lean"] == "FOR"
    assert causes("pitting", {"retraction_speed": 70})["pt-retract"]["lean"] == "FOR"
    assert causes("pitting", {"retraction_length": 1, "retraction_speed": 30})["pt-retract"]["lean"] == "AGAINST"
    mid = causes("pitting", {"retraction_length": 1.8})["pt-retract"]
    assert mid["lean"] == "NONE" and mid["evidence"][0]["direction"] == "unclear"


def test_layer_height_ratio():
    assert causes("interlayer-cracking", {"layer_height": 0.4, "nozzle_diameter": 0.4})["ic-layer"]["lean"] == "FOR"
    assert causes("interlayer-cracking", {"layer_height": 0.2, "nozzle_diameter": 0.4})["ic-layer"]["lean"] == "AGAINST"
    assert causes("interlayer-cracking", {"layer_height": 0.2})["ic-layer"]["evidence"] == []


def test_flow_ratio_modes():
    assert causes("under-extrusion", {"flow_ratio": 0.9})["ue-flow"]["lean"] == "FOR"
    assert causes("under-extrusion", {"flow_ratio": 1.0})["ue-flow"]["lean"] == "AGAINST"
    assert causes("nozzle-adhesion", {"flow_ratio": 1.1})["na-flow"]["lean"] == "FOR"
    assert causes("nozzle-adhesion", {"flow_ratio": 0.9})["na-flow"]["lean"] == "AGAINST"  # low flow is not "too high"


def test_bridge_speed():
    assert causes("bridging", {"bridge_speed": 60})["br-speed"]["lean"] == "FOR"
    assert causes("bridging", {"bridge_speed": 20})["br-speed"]["lean"] == "AGAINST"


def test_plate_and_material_rules_never_invent_a_matrix():
    assert causes("smooth-pei", {"plate": "smooth_pei", "material": "PETG"})["sp-release"]["lean"] == "FOR"
    assert causes("warps", {"plate": "textured_pei", "material": "ABS/ASA"})["wp-plate"]["lean"] == "FOR"
    other = causes("warps", {"plate": "smooth_pei", "material": "PLA"})["wp-plate"]
    assert other["lean"] == "NONE" and other["evidence"][0]["source"] == "WIKI"


def test_enclosure_only_for_abs_type_materials():
    assert causes("warps", {"material": "ABS/ASA", "enclosure": "no"})["wp-ambient"]["lean"] == "FOR"
    assert causes("warps", {"material": "ABS/ASA", "enclosure": "yes"})["wp-ambient"]["evidence"][0]["direction"] == "unclear"
    assert causes("warps", {"material": "PLA", "enclosure": "no"})["wp-ambient"]["evidence"] == []


def test_firmware_regression_window():
    assert causes("first-layer-gaps", {"firmware": "1.5.1"})["fl-fw"]["lean"] == "FOR"
    assert causes("first-layer-gaps", {"firmware": "V1.5.0"})["fl-fw"]["lean"] == "FOR"
    assert causes("first-layer-gaps", {"firmware": "1.5.2"})["fl-fw"]["lean"] == "AGAINST"
    assert causes("first-layer-gaps", {"firmware": "2.1.0"})["fl-fw"]["lean"] == "AGAINST"


def test_toolhead_scope():
    assert causes("first-layer-gaps", {"toolheads": "one"})["fl-scope"]["lean"] == "FOR"
    assert causes("first-layer-gaps", {"toolheads": "all"})["fl-scope"]["lean"] == "AGAINST"


def test_moisture_gives_wiki_figures_not_a_verdict():
    c = causes("stringing", {"material": "PETG"})["st-wet"]
    assert c["lean"] == "NONE" and c["eyes"] and "60–65" in c["evidence"][0]["text"]["en"] and c["evidence"][0]["direction"] == "info"
    assert "no drying" in causes("stringing", {"material": "PCTG"})["st-wet"]["evidence"][0]["text"]["en"]


def test_mixed_evidence_is_reported_as_mixed_not_scored():
    out = causes("stringing", {"material": "PLA", "nozzle_temp": 250, "retraction_length": 1})
    assert out["st-temp"]["lean"] == "FOR" and out["st-retract"]["lean"] == "AGAINST"
    assert all("score" not in c and "probability" not in c for c in out.values())


# ---- observed telemetry ----------------------------------------------------------
def test_observed_temperatures_come_from_the_session_with_their_status():
    obs = symptoms.observed_from(REAL)
    hot = max(o["value"]["celsius"] for o in REAL if o["event_type"] in symptoms.NOZZLE_TYPES and o["validity"] == "FRESH")
    assert obs["nozzle"]["max"] == hot and obs["nozzle"]["statuses"] == ["REAL"]
    c = causes("stringing", {"material": "PLA"}, REAL)["st-temp"]
    assert c["evidence"][0]["source"] == "OBSERVED REAL" and c["lean"] == ("FOR" if hot > 230 else "AGAINST")


def test_typed_value_beats_observed_and_is_labelled_so():
    c = causes("stringing", {"material": "PLA", "nozzle_temp": 260}, REAL)["st-temp"]
    assert c["lean"] == "FOR" and c["evidence"][0]["source"] == "USER_REPORTED"


def test_non_fresh_or_bad_samples_are_ignored():
    bad = [{"event_type": "temperature_sample", "validity": "STALE", "value": {"celsius": 999}, "source_status": "REAL"},
           {"event_type": "temperature_sample", "validity": "FRESH", "value": {"celsius": True}, "source_status": "REAL"},
           {"event_type": "temperature_sample", "validity": "FRESH", "value": {"celsius": "hot"}, "source_status": "REAL"}]
    assert symptoms.observed_from(bad) == {"bed": None, "nozzle": None}


# ---- routes -------------------------------------------------------------------
@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(str(tmp_path / "t.sqlite3")), base_url="http://127.0.0.1")


def test_routes(client):
    cat = client.get("/api/v1/knowledge/symptoms").json()
    assert cat["checked_at"] and len(cat["symptoms"]) >= 16 and cat["fields"]["numeric"]["mesh_range"] == [0, 10]
    ok = client.post("/api/v1/symptoms/evaluate", json={"symptom": "first-layer-gaps", "answers": {"mesh_range": 1.0}}).json()
    assert ok["symptom"]["url"].startswith("https://wiki.snapmaker.com/en/snapmaker_u1/") and ok["causes"][2]["lean"] == "FOR"
    assert client.post("/api/v1/symptoms/evaluate", json={"symptom": "nope"}).status_code == 404
    bad = client.post("/api/v1/symptoms/evaluate", json={"symptom": "stringing", "answers": {"material": "x"}})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "BAD_ANSWER"
    assert client.post("/api/v1/symptoms/evaluate", json={"symptom": "stringing", "session": "../etc"}).status_code == 404
    assert client.post("/api/v1/symptoms/evaluate", json={"symptom": "stringing", "session": "h000000000000"}).status_code == 404


def test_route_with_a_saved_session(client):
    sid = client.post("/api/v1/history/source", json={"source": "real:h02_normal_print"}).json()["session"]["id"]
    j = client.post("/api/v1/symptoms/evaluate", json={"symptom": "stringing", "answers": {"material": "PLA"}, "session": sid}).json()
    assert j["observed"]["nozzle"]["statuses"] == ["REAL"] and j["causes"][2]["evidence"][0]["source"] == "OBSERVED REAL"
