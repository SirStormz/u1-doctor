"""Community-reported causes, near-match for mistyped codes, matcher for messages without a code (#55)."""
import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.api import create_app
from app.knowledge import community_for, load_catalog, load_community_causes, load_messages, match_messages, normalize_code, suggest_codes

ROOT = Path(__file__).resolve().parents[2]
CC = load_community_causes()
MSG = load_messages()
BY = load_catalog()["_by_code"]
# words that would turn a forum report into a claim: never in a community entry
OVERCLAIM = re.compile(r"\b((?<!not an )official fix|confirmed by snapmaker|guaranteed|probability|likelihood|score|rank(ed|ing)?|most likely)\b", re.I)
COMMANDS = re.compile(r"\b(G28|M\d{2,3}|SET_[A-Z_]+|SAVE_CONFIG|RESTART)\b")  # a "check" never asks to send anything to the machine


def _validator(name):
    schema = json.loads((ROOT / "schemas" / name).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


@pytest.fixture()
def client():
    return TestClient(create_app(":memory:"), headers={"X-U1D": "1"})  # the front end's CSRF header


def test_files_match_their_schema():
    _validator("community-causes.schema.json").validate(json.loads((ROOT / "knowledge" / "u1_community_causes.json").read_text(encoding="utf-8")))
    _validator("messages.schema.json").validate(json.loads((ROOT / "knowledge" / "u1_messages.json").read_text(encoding="utf-8")))


def test_schema_rejects_a_score_and_a_non_forum_source():
    v = _validator("community-causes.schema.json")
    bad = json.loads(json.dumps(CC))
    bad["causes"][0]["score"] = 0.9
    assert list(v.iter_errors(bad))
    bad = json.loads(json.dumps(CC))
    bad["causes"][0]["sources"][0]["url"] = "https://example.com/t/1"
    assert list(v.iter_errors(bad))
    bad = json.loads(json.dumps(CC))
    bad["kind"] = "OFFICIAL"
    assert list(v.iter_errors(bad))


def test_every_code_is_in_the_catalog_or_listed_as_outside():
    outside = set(CC["codes_not_in_catalog"])
    used = {c for e in CC["causes"] for c in e["codes"]}
    assert outside <= used, "listed as outside but unused"
    for code in used:
        assert (code in BY) != (code in outside), code


@pytest.mark.parametrize("e", CC["causes"], ids=[e["id"] for e in CC["causes"]])
def test_entries_are_sourced_and_never_claim_more(e):
    assert CC["kind"] == "COMMUNITY_REPORT" and CC["checked_at"] == "2026-11-08"
    assert all(s["url"].startswith("https://forum.snapmaker.com/t/") for s in e["sources"])
    for part in (e["cause"], e["scope"], *e["check"]):
        assert not OVERCLAIM.search(part["en"]), part["en"]
    for c in e["check"]:
        assert not COMMANDS.search(c["en"]), c["en"]


def test_initial_codes_are_covered():
    for code in ("0003-0526-0000-0000", "0003-0522-0001-0013", "0003-0522-0100-0006", "0002-0523-0001-0038", "0002-0523-0003-0039",
                 "0003-0522-0000-0000", "0001-0531-0000-0015", "0003-0531-0000-0014", "0003-0522-0000-0002", "0003-0522-0005-0006",
                 "0003-0522-0002-0008", "0003-0528-0000-0027", "0002-0528-0000-0011"):
        assert community_for(code), code
    assert community_for("0002-0525-0002-0002") == []
    # the X-axis row shares the official article with the Y row but the forum topic only concerns Y
    assert community_for("0003-0522-0000-0013") == []


@pytest.mark.parametrize("raw, norm", [
    ("0003-0522-002-0012", "0003-0522-0002-0012"),
    ("003-0522-0000-0000", "0003-0522-0000-0000"),
    ("0003 0522 0002 0008", "0003-0522-0002-0008"),
    ("0003.0522.0002.0OO8", "0003-0522-0002-0008"),
    ("０００２-0525-0002-0002", "0002-0525-0002-0002"),
    ("0002052500020002", "0002-0525-0002-0002"),
    ("Error 401: Unauthorized", None),
    ("0003-0522-00002-0008", None),
    ("", None),
])
def test_normalize_code(raw, norm):
    assert normalize_code(raw) == norm


def test_suggestions_exact_after_normalisation_and_near_otherwise():
    assert suggest_codes("0003 0522 0002 0008") == ["0003-0522-0002-0008"]
    near = suggest_codes("0002 0524 0001 0038")  # as quoted in forum topic 42400
    assert near[0] == "0002-0523-0001-0038" and len(near) <= 3 and all(c in BY for c in near)
    missing_digit = suggest_codes("000305220002008")
    assert "0003-0522-0002-0008" in missing_digit and len(missing_digit) <= 3
    assert suggest_codes("401") == [] and suggest_codes("x" * 100) == []


@pytest.mark.parametrize("text, mid", [
    ("No network connection, please check whether the network environment of the software is normal", "MSG-NO-NETWORK"),
    ("Error 401: Unauthorized", "MSG-HTTP-401"),
    ("Foreign Object Detection", "MSG-FOREIGN-OBJECT"),
    ("Firmware Restart", "MSG-FIRMWARE-RESTART"),
    ("Toolhead Anomaly", "MSG-TOOLHEAD-ANOMALY"),
    ("Please Select Filament Type", "MSG-SELECT-FILAMENT-TYPE"),
    ("spaghetti detected", "MSG-SPAGHETTI"),
    ("Tangled filament detected", "MSG-TANGLE"),
])
def test_message_matcher(text, mid):
    assert mid in [m["id"] for m in match_messages(text)]


def test_message_links_are_wiki_or_forum_only_and_codes_exist():
    assert match_messages("hello") == [] and match_messages("") == []
    for m in MSG["messages"]:
        assert all(a["url"].startswith("https://wiki.snapmaker.com/en/snapmaker_u1/") for a in m["articles"])
        assert all(s["url"].startswith("https://forum.snapmaker.com/t/") for s in m["sources"])
        assert all(c in BY for c in m["related_codes"])
        if not m["articles"]:
            assert "No official article" in m["explanation"]["en"], m["id"]


def test_api_returns_community_block_for_exact_code(client):
    r = client.post("/api/v1/errors/interpret", json={"code": "0003-0526-0000-0000"}).json()
    assert r["community"]["kind"] == "COMMUNITY_REPORT" and r["community"]["causes"][0]["id"] == "CC-BED-ADC-FEEDER-FFC"
    assert r["decoding"]["status"] == "KNOWN" and r["input"] == {"normalized": None, "suggestions": []} and r["messages"] == []
    # a well-formed code outside the official table still gets its community report, and stays INCONCLUSIVE
    o = client.post("/api/v1/errors/interpret", json={"code": "0001-0531-0000-0015"}).json()
    assert o["decoding"]["status"] == "STRUCTURE_ONLY" and o["community"]["causes"][0]["id"] == "CC-EXTRUDER-MAP-ON-SEND"


def test_api_suggests_for_mistyped_code_and_matches_messages(client):
    r = client.post("/api/v1/errors/interpret", json={"code": "003-0522-0000-0000"}).json()
    assert r["decoding"]["status"] == "MALFORMED" and r["community"]["causes"] == []
    assert r["input"]["normalized"] == "0003-0522-0000-0000"
    assert r["input"]["suggestions"] == [{"code": "0003-0522-0000-0000", "title": BY["0003-0522-0000-0000"]["title"]}]
    m = client.post("/api/v1/errors/interpret", json={"code": "No network connection, please check whether the network environment of the software is normal"}).json()
    assert m["decoding"]["status"] == "MALFORMED" and [x["id"] for x in m["messages"]] == ["MSG-NO-NETWORK"]
    assert client.post("/api/v1/errors/interpret", json={"code": "A" * 201}).status_code == 422
