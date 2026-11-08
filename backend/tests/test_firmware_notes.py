"""Release-note facts attached to catalog codes and compared with the firmware the user states."""
import pytest

from app.knowledge import interpret, load_catalog, parse_firmware

MCU = "0003-0522-0001-0016"
TIMER = "0003-0522-0000-0016"


@pytest.mark.parametrize("raw,want", [("2.1.0", (2, 1, 0)), ("V2.1.0", (2, 1, 0)), ("v1.5.2 beta", (1, 5, 2)), (" 1.0.0 ", (1, 0, 0))])
def test_parse_firmware_accepts(raw, want):
    assert parse_firmware(raw) == want


@pytest.mark.parametrize("raw", ["2.1", "abc", "1.2.3.4", "", None, 210, "9" * 40, "2.1.0; rm", "２.1.0"])
def test_parse_firmware_rejects(raw):
    assert parse_firmware(raw) is None


def test_before_and_included_are_relative_to_the_note_version():
    old = interpret(MCU, "1.3.0")["firmware"]
    assert old["notes"][0]["version"] == "1.4.0" and old["notes"][0]["applies"] == "BEFORE" and old["behind_latest"] is True
    new = interpret(MCU, "1.4.0")["firmware"]
    assert new["notes"][0]["applies"] == "INCLUDED"
    latest = interpret(MCU, "2.1.0")["firmware"]
    assert latest["notes"][0]["applies"] == "INCLUDED" and latest["behind_latest"] is False and latest["latest"]["version"] == "2.1.0"


def test_timer_too_close_has_both_notes():
    notes = interpret(TIMER, "1.4.5")["firmware"]["notes"]
    assert [(n["version"], n["applies"]) for n in notes] == [("1.4.0", "INCLUDED"), ("1.5.0", "BEFORE")]


def test_without_firmware_nothing_is_compared():
    f = interpret(MCU)["firmware"]
    assert f["given"] is None and f["valid"] is None and f["behind_latest"] is None and all(n["applies"] is None for n in f["notes"])


def test_invalid_firmware_is_flagged_not_guessed():
    f = interpret(MCU, "banana")["firmware"]
    assert f["valid"] is False and f["behind_latest"] is None and all(n["applies"] is None for n in f["notes"])


def test_app_note_is_never_compared_with_firmware():
    f = interpret("0003-0529-0000-0001", "1.0.0")["firmware"]
    assert f["notes"][0]["component"] == "Snapmaker Orca" and f["notes"][0]["applies"] is None


def test_code_without_notes_has_no_firmware_key_unless_asked():
    code = "0003-0522-0002-0006"
    assert "firmware" not in interpret(code)
    f = interpret(code, "1.5.2")["firmware"]
    assert f["notes"] == [] and f["valid"] is True


def test_unlisted_code_with_firmware_stays_inconclusive():
    d = interpret("0003-0522-0009-0099", "1.5.2")
    assert d["classification"] == "INCONCLUSIVE" and d["firmware"]["notes"] == []


def test_catalog_note_shape():
    cat = load_catalog()
    assert cat["firmware_latest"]["version"] == "2.1.0"
    n_with = 0
    for e in cat["entries"]:
        for n in e.get("fw_notes", []):
            n_with += 1
            assert n["kind"] in ("introduced", "changed", "fixed", "mitigated") and n["text"] and n["source"].startswith("https://wiki.snapmaker.com/")
            assert n["component"] != "firmware" or parse_firmware(n["version"])
    assert n_with >= 40


def test_api_accepts_firmware(tmp_path):
    from fastapi.testclient import TestClient

    from app.api import create_app

    c = TestClient(create_app(str(tmp_path / "t.sqlite3")), base_url="http://127.0.0.1", headers={"X-U1D": "1"})
    r = c.post("/api/v1/errors/interpret", json={"code": MCU, "firmware": "1.3.0"})
    assert r.status_code == 200 and r.json()["decoding"]["firmware"]["notes"][0]["applies"] == "BEFORE"
    assert c.post("/api/v1/errors/interpret", json={"code": MCU, "firmware": "x" * 33}).status_code == 422
