"""Good-to-know notes (static, community-reported): schema, sourcing rules, API."""
import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.api import create_app
from app.knowledge import load_good_to_know

ROOT = Path(__file__).resolve().parents[2]
GK = load_good_to_know()
OVERCLAIM = re.compile(r"\b(official fix|confirmed by snapmaker|guaranteed|probability|likelihood|score|rank(ed|ing)?|most likely)\b", re.I)
COMMANDS = re.compile(r"\b(G28|M\d{2,3}|SET_[A-Z_]+|SAVE_CONFIG|RESTART)\b")  # a note never asks to send anything to the machine


def _validator():
    schema = json.loads((ROOT / "schemas" / "good-to-know.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


@pytest.fixture()
def client():
    return TestClient(create_app(":memory:"), headers={"X-U1D": "1"})


def test_file_matches_schema():
    _validator().validate(json.loads((ROOT / "knowledge" / "u1_good_to_know.json").read_text(encoding="utf-8")))


def test_schema_rejects_score_foreign_source_official_kind_and_missing_source():
    v = _validator()
    for mutate in (lambda d: d["notes"][0].__setitem__("score", 0.5),
                   lambda d: d["notes"][0]["sources"][0].__setitem__("url", "https://example.com/t/1"),
                   lambda d: d.__setitem__("kind", "OFFICIAL"),
                   lambda d: d["notes"][0].__setitem__("sources", []),
                   lambda d: d["notes"][0]["sources"][0].__setitem__("posted", "yesterday")):
        bad = json.loads(json.dumps(GK))
        mutate(bad)
        assert list(v.iter_errors(bad))


@pytest.mark.parametrize("n", GK["notes"], ids=[n["id"] for n in GK["notes"]])
def test_notes_are_sourced_dated_and_never_claim_more(n):
    assert GK["checked_at"] == "2026-11-08"
    for s in n["sources"]:
        assert s["posted"] <= GK["checked_at"]
    for part in (n["title"], n["text"], n["scope"]):
        for lang in ("en", "fr"):
            assert not OVERCLAIM.search(part[lang]), part[lang]
            assert not COMMANDS.search(part[lang]), part[lang]


def test_the_three_confirmed_topics_are_cited():
    by = {n["id"]: {s["url"].rsplit("/", 1)[-1] for s in n["sources"]} for n in GK["notes"]}
    assert by == {"GK-FLUIDD-CAMERA": {"40853", "43564", "42072"}, "GK-FLUIDD-CONFIG-READ-ONLY": {"41385"}, "GK-LOGS-ENCRYPTED": {"40865"}}
    logs = next(n for n in GK["notes"] if n["id"] == "GK-LOGS-ENCRYPTED")
    assert [a["url"] for a in logs["articles"]] == ["https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/U1_export_log"]


def test_api(client):
    j = client.get("/api/v1/knowledge/good-to-know").json()
    assert j["kind"] == "COMMUNITY_REPORT" and j["checked_at"] == GK["checked_at"]
    assert [n["id"] for n in j["notes"]] == [n["id"] for n in GK["notes"]]
