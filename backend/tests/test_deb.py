"""U1-DEB v1: round-trip, determinism, redaction, hostile-zip corpus."""
import io
import json
import random
import struct
import zipfile
from pathlib import Path

import jsonschema
import pytest

from app import deb
from app.engine import canon, evaluate
from app.engine.canonical import sha256_hex

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
OBS_SCHEMA = json.loads((ROOT / "schemas" / "observation.schema.json").read_text(encoding="utf-8"))
MAN_SCHEMA = json.loads((ROOT / "schemas" / "evidence-bundle.schema.json").read_text(encoding="utf-8"))
FIX = ROOT / "fixtures"
GEN = "2026-11-06T00:00:00Z"


def load(path: Path) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()]


SYN = sorted(p.name.removesuffix(".observations.jsonl") for p in (FIX / "synthetic").glob("*.observations.jsonl"))
REAL = load(FIX / "real" / "real_h02_normal_print.observations.jsonl")


def export(obs, **kw):
    return deb.export_bundle(obs, RS, app_version="test", generated_at=GEN, **kw)


def entries(blob: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        return {i.filename: z.read(i) for i in z.infolist()}


def rezip(files: dict[str, bytes], **info) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            zi = zipfile.ZipInfo(n, date_time=(1980, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = info.get("attr", 0o100644 << 16)
            z.writestr(zi, b)
    return buf.getvalue()


def refused(blob: bytes, code: str):
    with pytest.raises(deb.BundleError) as e:
        deb.import_bundle(blob, RS)
    assert e.value.code == code


# ---------------------------------------------------------------- round trip
@pytest.mark.parametrize("name", SYN)
def test_synthetic_roundtrip_replays_identically(name):
    obs = load(FIX / "synthetic" / f"{name}.observations.jsonl")
    res = deb.import_bundle(export(obs), RS)
    assert res["replay"] == {"performed": True, "matches_bundle": True, "findings_sha256": res["replay"]["findings_sha256"]}
    assert res["mode"] == "IMPORTED" and res["origin_source_mix"] == ["SYNTHETIC"] and res["findings_are_recomputed"]
    assert canon(res["findings"]) == canon(evaluate(obs, RS))  # same findings as the direct run, even with sorted/redacted obs


def test_real_capture_roundtrip_keeps_real_label_and_matches_golden():
    res = deb.import_bundle(export(REAL), RS)
    gold = json.loads((FIX / "real" / "real_h02_normal_print.findings.json").read_text(encoding="utf-8"))
    assert res["origin_source_mix"] == ["REAL"] and res["replay"]["matches_bundle"] is True
    assert canon(res["findings"]) == canon(gold)  # nothing in the real capture needed redaction


def test_export_is_byte_deterministic_and_order_independent():
    shuffled = REAL[:]
    random.Random(3).shuffle(shuffled)
    a, b = export(REAL), export(shuffled)
    assert a == b and a == export(REAL)


def test_manifest_matches_published_schema_and_hashes():
    blob = export(REAL)
    e = entries(blob)
    assert list(e)[0] == "manifest.json" and set(e) == deb.ALLOWED_NAMES - {deb.SUPPORT_FILE}  # no code declared: no support file
    m = json.loads(e["manifest.json"])
    jsonschema.validate(m, MAN_SCHEMA)
    for f in m["files"]:
        assert sha256_hex(e[f["name"]]) == f["sha256"] and len(e[f["name"]]) == f["bytes"]
    for line in e["observations.jsonl"].splitlines():
        jsonschema.validate(json.loads(line), OBS_SCHEMA)
    assert m["integrity_notice"] == deb.INTEGRITY_NOTICE


def test_gaps_are_reported_in_manifest():
    m = json.loads(entries(export(load(FIX / "synthetic" / "synthetic_offline_gap.observations.jsonl")))["manifest.json"])
    assert m["capture_windows"][0]["gaps"] == [{"start_utc": "2026-01-01T13:02:00Z", "end_utc": "2026-01-01T13:09:00Z"}]


# ---------------------------------------------------------------- redaction
def test_redaction_removes_private_values_and_is_reported():
    base = dict(REAL[0])
    leaky = [
        {**base, "observation_id": "x_1", "event_type": "note", "value": {"text": "printer at 192.168.50.20"}},
        {**base, "observation_id": "x_2", "event_type": "note", "value": {"file": "my_cube.gcode"}},
        {**base, "observation_id": "x_3", "event_type": "note", "value": {"p": "C:\\Users\\bob\\x"}},
        {**base, "observation_id": "x_4", "event_type": "note", "value": {"mail": "bob@example.com"}},
        {**base, "observation_id": "x_5", "event_type": "note", "value": {"u": "http://10.0.0.1:7125/x"}},
        {**base, "observation_id": "x_6", "event_type": "note", "sensitive": True, "value": {"serial": "SN12345"}},
        {**base, "observation_id": "x_7", "event_type": "note", "value": {"192.168.1.9": "k"}},
    ]
    blob = export(leaky)
    text = b"".join(entries(blob).values()).decode("utf-8").lower()
    for bad in ("192.168", "gcode", "bob", "example.com", "10.0.0.1", "sn12345", "c:\\"):
        assert bad not in text
    rep = json.loads(entries(blob)["privacy-report.json"])
    # x_5's URL embeds an IP, so the ipv4 rule (checked first) takes it
    assert rep["redactions"] == {"email": 1, "ipv4": 2, "key": 1, "path": 1, "print_file": 1, "sensitive_value": 1}
    assert rep["automatic_redaction_is_best_effort"] is True
    assert deb.import_bundle(blob, RS)["replay"]["matches_bundle"] is True  # replay stays valid after redaction


def test_export_refuses_invalid_or_empty_input():
    with pytest.raises(deb.BundleError):
        export([])
    with pytest.raises(deb.BundleError):
        export([{**REAL[0], "unexpected": 1}])


# ---------------------------------------------------------------- manual validator agrees with the JSON Schema
def test_manual_observation_validator_agrees_with_schema():
    v = jsonschema.Draft202012Validator(OBS_SCHEMA)
    base = REAL[0]
    cases = [base, {**base, "sensitive": "no"}, {**base, "entity_id": "toolhead_9"}, {**base, "source_ref": "http://x"},
             {**base, "source_ref": "a//b"}, {**base, "event_type": "Bad Type"}, {**base, "entity_id": "toolhead_1", "mapping_quality": "UNKNOWN"},
             {**base, "source_kind": "DEMO"}, {**base, "capture_utc": "2026-11-05T20:29:22+01:00"}, {**base, "extra": 1},
             {**base, "observation_id": "a b"}, {**base, "source_status": "SYNTHETIC"}, {**base, "schema_version": "2.0"}]
    for c in cases:
        schema_ok = v.is_valid(c)
        try:
            deb.validate_observation(c)
            manual_ok = True
        except deb.BundleError:
            manual_ok = False
        assert schema_ok == manual_ok, c


# ---------------------------------------------------------------- hostile bundles
GOOD = export(REAL)


def test_good_bundle_imports():
    assert deb.import_bundle(GOOD, RS)["observation_count"] == len(REAL)


def test_not_a_zip_and_oversize():
    refused(b"hello", "NOT_A_ZIP")
    refused(b"PK" + b"\0" * (deb.MAX_ZIP_BYTES + 1), "TOO_LARGE")


@pytest.mark.parametrize("name", ["../evil.txt", "/abs.txt", "sub/observations.jsonl", "extra.bin", "..\\x", "observations.jsonl/"])
def test_unexpected_entry_names_refused(name):
    e = entries(GOOD)
    e[name] = b"x"
    refused(rezip(e), "BAD_ENTRY")


def test_symlink_entry_refused():
    e = entries(GOOD)
    refused(rezip(e, attr=0o120777 << 16), "BAD_ENTRY")


def test_duplicate_entries_refused():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("manifest.json", b"{}")
        with pytest.warns(UserWarning):
            z.writestr("manifest.json", b"{}")
    refused(buf.getvalue(), "BAD_ENTRY")


def test_compression_bomb_refused():
    e = entries(GOOD)
    e["README.txt"] = b"A" * (20 * 1024 * 1024)  # ratio ~ 1000:1
    refused(rezip(e), "TOO_LARGE")


def test_lying_header_size_refused():
    e = entries(GOOD)
    blob = bytearray(rezip(e))
    # shrink declared uncompressed size of the first central-directory entry
    i = blob.index(b"PK\x01\x02")
    struct.pack_into("<I", blob, i + 24, 1)
    with pytest.raises((deb.BundleError, zipfile.BadZipFile)):
        deb.import_bundle(bytes(blob), RS)


def test_encrypted_flag_refused():
    blob = bytearray(GOOD)
    i = blob.index(b"PK\x01\x02")
    flags = struct.unpack_from("<H", blob, i + 8)[0] | 1
    struct.pack_into("<H", blob, i + 8, flags)
    refused(bytes(blob), "BAD_ENTRY")


def mutate_manifest(**kw):
    e = entries(GOOD)
    m = json.loads(e["manifest.json"])
    m.update(kw)
    e["manifest.json"] = canon(m)
    return rezip(e)


def test_tampered_payload_detected_by_hash():
    e = entries(GOOD)
    e["observations.jsonl"] = e["observations.jsonl"].replace(b"printing", b"pausing_", 1)
    refused(rezip(e), "HASH_MISMATCH")


def test_manifest_tampering_refused():
    refused(mutate_manifest(integrity_notice="SHA-256 proves authenticity."), "BAD_MANIFEST")
    refused(mutate_manifest(format="OTHER"), "BAD_MANIFEST")
    refused(mutate_manifest(source_mix=["MAGIC"]), "BAD_MANIFEST")
    refused(mutate_manifest(surprise=1), "BAD_MANIFEST")
    refused(mutate_manifest(ruleset={"id": "x", "version": "1", "hash": "nope"}), "BAD_MANIFEST")


def test_incompatible_format_version_flagged():
    refused(mutate_manifest(format_version="2.0.0"), "UNSUPPORTED_VERSION")
    refused(mutate_manifest(format_version="0.9.0"), "UNSUPPORTED_VERSION")


def test_forward_compatible_minor_version_accepted():
    assert deb.import_bundle(mutate_manifest(format_version="1.7.2"), RS)["format_version"] == "1.7.2"


def test_missing_or_unlisted_files_refused():
    e = entries(GOOD)
    del e["findings.json"]
    refused(rezip(e), "BAD_MANIFEST")
    e = entries(GOOD)
    m = json.loads(e["manifest.json"])
    m["files"] = [f for f in m["files"] if f["name"] != "README.txt"]
    e["manifest.json"] = canon(m)
    refused(rezip(e), "BAD_MANIFEST")
    e = entries(GOOD)
    del e["manifest.json"]
    refused(rezip(e), "BAD_MANIFEST")


def rebuilt(**over):
    """Re-hash a modified payload so only the content check (not the hash) can refuse it."""
    e = entries(GOOD)
    e.update(over)
    m = json.loads(e["manifest.json"])
    for f in m["files"]:
        f["sha256"], f["bytes"] = sha256_hex(e[f["name"]]), len(e[f["name"]])
    e["manifest.json"] = canon(m)
    return rezip(e)


def test_invalid_observations_refused_even_with_valid_hashes():
    good_line = entries(GOOD)["observations.jsonl"].splitlines()[0]
    bad = json.loads(good_line)
    bad["source_ref"] = "http://evil.example/x"
    refused(rebuilt(**{"observations.jsonl": canon(bad) + b"\n"}), "BAD_OBSERVATION")
    refused(rebuilt(**{"observations.jsonl": b"not json\n"}), "BAD_JSON")
    refused(rebuilt(**{"observations.jsonl": good_line + b"\n" + good_line + b"\n"}), "BAD_OBSERVATION")
    refused(rebuilt(**{"observations.jsonl": b'{"a": NaN}\n'}), "BAD_JSON")
    refused(rebuilt(**{"observations.jsonl": b""}), "EMPTY")
    refused(rebuilt(**{"findings.json": b'{"not":"a list"}'}), "BAD_JSON")


def test_forged_findings_detected_by_replay_not_trusted():
    forged = json.dumps([{"classification": "CONFIRMED"}]).encode()
    res = deb.import_bundle(rebuilt(**{"findings.json": forged}), RS)
    assert res["replay"]["matches_bundle"] is False
    assert all(f["classification"] != "CONFIRMED" for f in res["findings"])  # we show our own recomputation


def test_different_ruleset_is_reported_not_silently_replayed():
    other = {**RS, "version": "9.9.9"}
    res = deb.import_bundle(GOOD, other)
    assert res["ruleset"]["same_as_local"] is False and res["replay"]["performed"] is False and res["replay"]["matches_bundle"] is None
    assert res["findings_are_recomputed"] is False


def test_integrity_notice_never_claims_authenticity():
    res = deb.import_bundle(GOOD, RS)
    assert "does not prove authenticity" in res["integrity_notice"]
    assert res["source_status"] == "IMPORTED"


# ---------------------------------------------------------------- 1.1.0 support-checklist.json
CODE_OBS = load(FIX / "synthetic" / "synthetic_known_code_feeder3.observations.jsonl")


def with_support(doc: dict | bytes) -> bytes:
    """A valid bundle whose support-checklist.json is replaced (re-hashed and listed in the manifest)."""
    e = entries(export(CODE_OBS))
    e[deb.SUPPORT_FILE] = doc if isinstance(doc, bytes) else canon(doc) + b"\n"
    m = json.loads(e["manifest.json"])
    for f in m["files"]:
        if f["name"] == deb.SUPPORT_FILE:
            f["sha256"], f["bytes"] = sha256_hex(e[deb.SUPPORT_FILE]), len(e[deb.SUPPORT_FILE])
    e["manifest.json"] = canon(m)
    return rezip(e)


def test_support_checklist_is_exported_for_declared_codes_with_ids_only():
    e = entries(export(CODE_OBS))
    m = json.loads(e["manifest.json"])
    assert m["format_version"] == "1.1.0" and deb.SUPPORT_FILE in [f["name"] for f in m["files"]]
    jsonschema.validate(m, MAN_SCHEMA)
    doc = json.loads(e[deb.SUPPORT_FILE])
    assert doc["format"] == "u1-support-checklist/1" and doc["items"] and "wiki" not in json.dumps(doc["note"]).lower().replace("ask ids only", "")
    for it in doc["items"]:
        assert set(it) == {"code", "status", "title", "asks"} and all(set(a) == {"id", "source"} for a in it["asks"])
        assert it["asks"][0] == {"id": "error_code", "source": "wiki"}


def test_no_declared_code_means_no_support_file():
    e = entries(export(REAL))
    assert deb.SUPPORT_FILE not in e
    assert deb.import_bundle(export(REAL), RS)["support_checklist"] == {"present": False, "codes": [], "matches_local": None}


def test_support_checklist_roundtrip_matches_local_recomputation():
    res = deb.import_bundle(export(CODE_OBS), RS)
    sc = res["support_checklist"]
    assert sc["present"] is True and sc["matches_local"] is True and sc["codes"]


def test_support_checklist_export_is_deterministic():
    assert export(CODE_OBS) == export(list(reversed(CODE_OBS)))


@pytest.mark.parametrize("mutate", [
    lambda d: d.update(format="u1-support-checklist/2"),
    lambda d: d.update(extra=1),
    lambda d: d["items"][0].update(code="not-a-code"),
    lambda d: d["items"][0]["asks"].append({"id": "../../etc/passwd", "source": "wiki"}),
    lambda d: d["items"][0]["asks"].append({"id": "logs", "source": "official"}),
    lambda d: d.update(items=[]),
    lambda d: d["items"][0].update(title=5),
])
def test_invalid_support_checklist_is_refused_even_with_valid_hashes(mutate):
    doc = json.loads(entries(export(CODE_OBS))[deb.SUPPORT_FILE])
    mutate(doc)
    refused(with_support(doc), "BAD_JSON")


def test_support_checklist_not_json_or_nan_is_refused():
    refused(with_support(b"not json"), "BAD_JSON")
    refused(with_support(b'{"format": NaN}'), "BAD_JSON")


def test_forged_but_valid_support_checklist_is_flagged_not_trusted():
    doc = json.loads(entries(export(CODE_OBS))[deb.SUPPORT_FILE])
    doc["items"][0]["asks"] = [{"id": "serial_number", "source": "wiki"}]
    res = deb.import_bundle(with_support(doc), RS)
    assert res["support_checklist"]["present"] is True and res["support_checklist"]["matches_local"] is False


def test_support_checklist_from_another_catalog_version_is_not_compared():
    doc = json.loads(entries(export(CODE_OBS))[deb.SUPPORT_FILE])
    doc["catalog_version"] = "9.9.9"
    assert deb.import_bundle(with_support(doc), RS)["support_checklist"]["matches_local"] is None
