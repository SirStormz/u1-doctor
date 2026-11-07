"""u1deb-validate CLI: valid bundle, refused bundles, unreadable file."""
import io
import json
import zipfile
from pathlib import Path

from app import deb
from app.deb_cli import main

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
OBS = [json.loads(x) for x in (ROOT / "fixtures" / "real" / "real_h02_normal_print.observations.jsonl").read_text(encoding="utf-8").splitlines()]


def _bundle(tmp_path: Path) -> Path:
    p = tmp_path / "ok.zip"
    p.write_bytes(deb.export_bundle(OBS, RS, app_version="test", generated_at="2026-11-06T00:00:00Z"))
    return p


def test_valid_bundle_text_and_json(tmp_path, capsys):
    p = _bundle(tmp_path)
    assert main(["validate", str(p)]) == 0
    assert "VALID U1-DEB 1." in capsys.readouterr().out
    assert main(["validate", str(p), "--json"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["valid"] is True and out["replay_matches_bundle"] is True and out["observation_count"] == len(OBS)


def test_shipped_example_bundle_is_valid(capsys):
    ex = ROOT / "examples" / "u1-deb" / "example-synthetic-known-code-feeder3.u1deb.zip"
    assert main(["validate", str(ex), "--json"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["origin_source_mix"] == ["SYNTHETIC"] and out["replay_matches_bundle"] is True


def test_not_a_zip_is_refused_with_stable_code(tmp_path, capsys):
    p = tmp_path / "bad.zip"
    p.write_bytes(b"not a zip")
    assert main(["validate", str(p), "--json"]) == 1
    out = json.loads(capsys.readouterr().out)
    assert out["valid"] is False and out["code"] == "NOT_A_ZIP" and out["message"]


def test_extra_entry_is_refused(tmp_path, capsys):
    src = zipfile.ZipFile(io.BytesIO(_bundle(tmp_path).read_bytes()))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for i in src.infolist():
            z.writestr(i.filename, src.read(i))
        z.writestr("evil.exe", b"x")
    p = tmp_path / "extra.zip"
    p.write_bytes(buf.getvalue())
    assert main(["validate", str(p), "--json"]) == 1
    assert json.loads(capsys.readouterr().out)["code"] == "BAD_ENTRY"


def test_missing_file_exit_2(tmp_path, capsys):
    assert main(["validate", str(tmp_path / "nope.zip")]) == 2
    assert "cannot read" in capsys.readouterr().err
