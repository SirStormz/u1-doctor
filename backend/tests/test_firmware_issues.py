"""Known issues per firmware version (#60): schema, sourcing rules, version filter, API."""
import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.api import create_app
from app.knowledge import firmware_issues_for, load_catalog, load_firmware_issues, parse_firmware

ROOT = Path(__file__).resolve().parents[2]
FI = load_firmware_issues()
BY = load_catalog()["_by_code"]
OVERCLAIM = re.compile(r"\b(guaranteed|probability|likelihood|score|rank(ed|ing)?|most likely)\b", re.I)
WIKI_NOTE = re.compile(r"^https://wiki\.snapmaker\.com/en/snapmaker_u1/firmware/release_notes/v\d{3}$")


def _validator():
    schema = json.loads((ROOT / "schemas" / "firmware-issues.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


@pytest.fixture()
def client():
    return TestClient(create_app(":memory:"), headers={"X-U1D": "1"})


def test_file_matches_schema():
    _validator().validate(json.loads((ROOT / "knowledge" / "u1_firmware_issues.json").read_text(encoding="utf-8")))


def test_schema_rejects_score_foreign_source_and_bad_origin():
    v = _validator()
    for mutate in (lambda d: d["issues"][0].__setitem__("score", 0.5),
                   lambda d: d["issues"][0]["sources"][0].__setitem__("url", "https://example.com/t/1"),
                   lambda d: d["issues"][0].__setitem__("origin", "OFFICIAL"),
                   lambda d: d["issues"][0]["affected"].__setitem__("min", "latest")):
        bad = json.loads(json.dumps(FI))
        mutate(bad)
        assert list(v.iter_errors(bad))


@pytest.mark.parametrize("e", FI["issues"], ids=[e["id"] for e in FI["issues"]])
def test_entries_are_sourced_dated_and_honest(e):
    urls = [s["url"] for s in e["sources"]]
    # official only when a wiki release note is cited
    assert (e["origin"] == "OFFICIAL_RELEASE_NOTE") == any(WIKI_NOTE.match(u) for u in urls)
    for s in e["sources"]:
        assert s["posted"] <= FI["checked_at"]
    lo, hi, fx = (parse_firmware(x) if x else None for x in (e["affected"]["min"], e["affected"]["max"], e["fixed_in"]))
    assert lo is not None or hi is not None, "an entry must name at least one bound"
    if lo and hi:
        assert lo <= hi
    if fx:
        assert hi is not None and fx > hi, "fixed-in must be after the last affected version"
    for c in e["codes"]:
        assert c in BY, c
    for part in [e["symptom"], e["scope"], e.get("workaround", {"en": "", "fr": ""})]:
        assert not OVERCLAIM.search(part["en"]) and not OVERCLAIM.search(part["fr"])


def test_versions_list_is_ordered_and_bounds_are_known_versions():
    vs = [parse_firmware(v["version"]) for v in FI["versions"]]
    assert vs == sorted(vs) and len(set(vs)) == len(vs)
    known = {v["version"] for v in FI["versions"]}
    for e in FI["issues"]:
        for x in (e["affected"]["min"], e["affected"]["max"], e["fixed_in"]):
            assert x is None or x in known, x


def test_filter_by_version():
    ids = lambda v: {i["id"] for i in firmware_issues_for(v)}  # noqa: E731
    assert "FW-150-FIRST-LAYER-SQUISHED" in ids("1.5.1") and "FW-150-FIRST-LAYER-SQUISHED" not in ids("1.5.2")
    assert "FW-PRE200-HASH-FILENAME" in ids("1.0.0") and "FW-PRE200-HASH-FILENAME" not in ids("2.0.0")
    assert "FW-130-NOZZLE-RULES" in ids("2.1.0") and "FW-130-NOZZLE-RULES" not in ids("1.2.0")
    assert {"FW-2X-PART-FAN-EARLY", "FW-2X-SKIP-OBJECT-RESUME", "FW-210-BLACK-SCREEN"} <= ids("V2.1.0")
    assert firmware_issues_for("nonsense") == []


def test_api(client):
    full = client.get("/api/v1/knowledge/firmware-issues").json()
    assert full["checked_at"] == FI["checked_at"] and len(full["issues"]) == len(FI["issues"])
    one = client.get("/api/v1/knowledge/firmware-issues?version=1.1.0").json()
    assert one["filter"] == "1.1.0" and {i["id"] for i in one["issues"]} == {i["id"] for i in firmware_issues_for("1.1.0")}
    bad = client.get("/api/v1/knowledge/firmware-issues?version=abc")
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "BAD_FIRMWARE"
