"""U1 Dry Run report.json import: mapping, hostile input, compatibility with the engine and U1-DEB."""
import json
from pathlib import Path

import pytest

from app import deb
from app.dryrun_import import MAX_ITEMS, DryRunError, normalize
from app.engine import evaluate

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
AT = "2026-11-06T12:00:00Z"

REPORT = {
    "file": "secret-name.gcode", "moves": 1038009, "tool_changes": 4, "motion_time_s": 12064.5, "firmware_motion_s": 80.0,
    "tools": {"T0": {"extruded_mm": 1234.5}},
    "errors": [{"line": 42, "message": "Move out of range on Y axis: 84.9 -0.09 2.0"}],
    "scars": [{"line": 900, "source": "slicer", "tool": "T1", "from": [1, 2], "to": [3, 4], "z": 0.6, "length_mm": 12.5, "clearance_mm": 0.2}],
    "skipped_commands": ["M104"], "start_margin": {"line": 7, "code": "G0", "room_mm": 0.09, "axis": "Y", "side": "-"},
}


def raw(r) -> bytes:
    return json.dumps(r).encode()


def test_maps_report_to_labelled_imported_observations():
    out = normalize(raw(REPORT), AT)
    kinds = [o["event_type"] for o in out["observations"]]
    assert kinds == ["dryrun_summary", "dryrun_firmware_error", "dryrun_scar", "dryrun_start_margin"]
    for o in out["observations"]:
        assert (o["source_kind"], o["source_status"], o["entity_id"], o["timestamp_quality"]) == ("IMPORT", "IMPORTED", "unmapped", "UNKNOWN")
        deb.validate_observation(o)
    assert out["summary"]["clean"] is False and "Not an observation of a machine" in out["notice"]


def test_file_name_is_dropped():
    assert "secret-name" not in json.dumps(normalize(raw(REPORT), AT))


def test_clean_report():
    out = normalize(raw({**REPORT, "errors": [], "scars": []}), AT)
    assert out["summary"]["clean"] is True and len(out["observations"]) == 2


def test_engine_and_bundle_roundtrip_with_imported_observations():
    obs = normalize(raw(REPORT), AT)["observations"]
    assert isinstance(evaluate(obs, RS), list)  # unknown event types must not crash the engine
    blob = deb.export_bundle(obs, RS, app_version="test", generated_at=AT)
    assert deb.import_bundle(blob, RS)["observation_count"] == len(obs)


@pytest.mark.parametrize("bad", [b"not json", b"[]", b'{"file":"x"}', b'{"moves":NaN}'])
def test_rejects_malformed(bad):
    with pytest.raises(DryRunError):
        normalize(bad, AT)


@pytest.mark.parametrize("patch", [{"moves": "many"}, {"moves": True}, {"errors": "x"}, {"scars": [1]},
                                   {"errors": [{"line": 1.5, "message": "m"}]}, {"start_margin": []}, {"motion_time_s": float("inf")}])
def test_rejects_wrong_types(patch):
    with pytest.raises(DryRunError):
        normalize(json.dumps({**REPORT, **patch}).encode().replace(b"Infinity", b"1e999"), AT)


def test_caps_items_and_text():
    big = {**REPORT, "errors": [{"line": i, "message": "x" * 5000} for i in range(MAX_ITEMS + 5)]}
    out = normalize(raw(big), AT)
    assert out["summary"]["truncated"] is True and out["summary"]["error_count"] == MAX_ITEMS + 5
    assert len(out["observations"]) == 1 + MAX_ITEMS + 1 + 1
    assert len(out["observations"][1]["value"]["message"]) == 300


def test_api_route(tmp_path):
    from fastapi.testclient import TestClient

    from app.api import create_app

    c = TestClient(create_app(str(tmp_path / "t.sqlite3")), base_url="http://127.0.0.1")
    ok = c.post("/api/v1/imports/dryrun", content=raw(REPORT))
    assert ok.status_code == 200 and ok.json()["summary"]["scar_count"] == 1
    bad = c.post("/api/v1/imports/dryrun", content=b"[]")
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "BAD_REPORT"


def test_too_large():
    with pytest.raises(DryRunError) as e:
        normalize(b" " * (5 * 1024 * 1024 + 1), AT)
    assert e.value.code == "TOO_LARGE"
