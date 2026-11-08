"""Support checklist: items come from the linked article, suggestions are labelled, malformed input is refused."""
import pytest

from app.support import TEXT, checklist


def ids(r, source=None):
    return [i["id"] for i in r["items"] if source is None or i["source"] == source]


def test_general_items_always_present():
    r = checklist("0003-0522-0002-0006")  # no profile
    assert ids(r, "wiki") == ["error_code", "troubleshooting_results"]
    assert ids(r, "suggested") == ["firmware_version", "u1_deb"]


@pytest.mark.parametrize("code,extra", [
    ("0002-0528-0000-0000", ["video_error", "logs"]),
    ("0003-0522-0001-0016", ["logs", "gcode_file"]),
    ("0003-0523-0000-0006", ["gcode_file"]),
    ("0002-0523-0000-0045", ["order_number", "photos_per_toolhead", "error_count"]),
])
def test_specific_asks_follow_the_linked_article(code, extra):
    assert ids(checklist(code), "wiki") == ["error_code", *extra, "troubleshooting_results"]


def test_suggested_items_never_claim_to_be_official():
    for i in checklist("0003-0522-0001-0016")["items"]:
        assert (i["source"] == "suggested") == (i["id"] in ("firmware_version", "u1_deb"))


def test_unlisted_code_gets_general_items_only():
    r = checklist("0003-0522-0009-0099")
    assert r["status"] == "STRUCTURE_ONLY" and r["title"] is None and ids(r, "wiki") == ["error_code", "troubleshooting_results"]


def test_firmware_is_echoed_only_when_valid():
    assert checklist("0003-0522-0001-0016", "1.5.2")["firmware"] == "1.5.2"
    assert checklist("0003-0522-0001-0016", "banana")["firmware"] is None


def test_malformed_code_refused():
    with pytest.raises(ValueError):
        checklist("nope")


def test_every_catalog_ask_has_a_text():
    from app.knowledge import load_catalog
    for e in load_catalog()["entries"]:
        for a in e.get("support_asks", []):
            assert a in TEXT


def test_api(tmp_path):
    from fastapi.testclient import TestClient

    from app.api import create_app

    c = TestClient(create_app(str(tmp_path / "t.sqlite3")), base_url="http://127.0.0.1", headers={"X-U1D": "1"})
    ok = c.post("/api/v1/support/checklist", json={"code": "0003-0522-0001-0016"})
    assert ok.status_code == 200 and ok.json()["ticket"]["url"].startswith("https://")
    assert c.post("/api/v1/support/checklist", json={"code": "x"}).status_code == 422
