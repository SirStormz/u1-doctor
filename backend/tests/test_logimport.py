"""Log import (Moonraker, Klipper, unisrv, syslog, Snapmaker Orca, encrypted export) and rules S25-S32. Fixtures are invented text in the real formats."""
from __future__ import annotations

import gzip
import io
import json
import sqlite3
import tarfile
import zipfile

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app import db, logimport
from app.api import create_app
from app.engine import evaluate
from app.knowledge import interpret, load_log_signals
from app.logimport import LogImportError, analyse, official_code
from app.paths import ROOT

RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
NOW = "2026-11-09T12:00:00Z"
H = {"X-U1D": "1"}

MOON = "\n".join([
    "-------------------- Log Start | Wed Jul  8 12:40:07 2026 --------------------",
    "2026-10-22 19:25:22,278 [exception_manager.py:_on_klippy_raise_exception()] - klippy raise exception: {'id': 523, 'index': 0, 'code': 48, 'level': 1, 'message': 'Detected pogopin disconnection during print\\nPlease clean and retry    [2, 0, 0, 0]', 'timestamp': 1792697122.27}",
    "2026-10-27 19:03:03,986 [exception_manager.py:_on_klippy_raise_exception()] - klippy raise exception: {'id': 523, 'index': 0, 'code': 48, 'level': 1, 'message': 'Detected pogopin disconnection during print', 'timestamp': 1.0}",
    "2026-10-30 09:55:40,493 [exception_manager.py:_on_klippy_raise_exception()] - klippy raise exception: {'id': 523, 'index': 0, 'code': 48, 'level': 1, 'message': 'Detected pogopin disconnection during print', 'timestamp': 2.0}",
    "2026-10-27 14:20:54,871 [exception_manager.py:_on_klippy_raise_exception()] - klippy raise exception: {'id': 523, 'index': 3, 'code': 38, 'level': 2, 'message': 'detect filament tangled!', 'timestamp': 3.0}",
    "2026-11-08 14:33:27,911 [exception_manager.py:_on_klippy_raise_exception()] - klippy raise exception: {'id': 532, 'index': 0, 'code': 2, 'level': 2, 'message': 'detected noodle', 'timestamp': 4.0}",
    "2026-10-19 09:51:34,086 [mqtt.py:_handle_timed_status_update()] - MQTT Client Offline!",
    "2026-10-19 09:55:26,237 [mqtt.py:_handle_timed_status_update()] - MQTT Client Offline!",
    "2026-10-19 10:00:00,000 [announcements.py:_fetch_moonlight()] - Failed to update subscription 'klipper': [Errno -3] Temporary failure in name resolution",
    "2026-10-22 19:25:22,338 [snapmakercloud.py:_send_job_event()] - state: complete, job notification: {'filename': 'secret_name.gcode'}",
    "2026-10-22 19:30:00,000 [snapmakercloud.py:_send_job_event()] - state: started, exception: {}",
    "",
])

KLIPPY = "\n".join([
    "10-12 23:07:30.000:===== Config file =====",
    "[printer]", "shutdown_speed = 0", "path = /home/lava/printer_data/gcodes", "=======================",
    "Loaded MCU 'e0' 138 commands (lava_1.4.0_20260522-4-g101c7dfd / gcc: x)",
    "Git version: '1.4.1.6_20260608141446'",
    "=============== Log rollover at Mon Oct 12 23:07:31 2026 ===============",
    "23:07:31.671:Stats 10067.5: gcodein=0  mcu: mcu_awake=0.013 mcu_task_avg=0.000009 mcu_task_stddev=0.000005 err_len=2 err_dest=0 err_sync=0 err_crc=0 bytes_write=31508723 bytes_read=32714580 bytes_retransmit=9 bytes_invalid=0 send_seq=1 e0: mcu_awake=0.01 mcu_task_avg=0.000009 mcu_task_stddev=0.000005 err_len=3 err_dest=1 err_sync=0 err_crc=0 bytes_write=1 bytes_read=2 bytes_retransmit=9 bytes_invalid=0 send_seq=1",
    "23:07:33.400:pick extruder3 !!!",
    "23:07:35.887:Activating extruder extruder3",
    "00:07:37.000:Failed to switch extruder, retrying... (Attempt: 1)",
    "00:07:38.000:Transition to shutdown state: Timer too close",
    "Mesh Average: 0.07", "Mesh Range: min=-0.0472 max=0.4041",
    "",
])

UNI = "\n".join([
    "[2026-10-30 01:30:21.693] [unisrv] [error] [TLP:1498] Take photo: capture to file failed, file /userdata/.tmp_timelapse/1/2.jpg not exist.",
    "[2026-10-30 01:30:22.693] [unisrv] [error] [TLP:1498] Take photo: capture to file failed, file /userdata/.tmp_timelapse/1/3.jpg not exist.",
    "[2026-10-30 01:30:23.693] [unisrv] [error] [TLP:1498] Take photo: capture to file failed, file /userdata/.tmp_timelapse/1/4.jpg not exist.",
    "[2026-10-30 01:30:21.700] [unisrv] [warning] [HALMM:278] Execute error, code is 69",
    "[2026-11-04 08:48:19.914] [unisrv] [info] [UPGM:295] Check new version: remote fullversion is 2.1.0.157_20261028045538, local fullversion is 2.0.0.205_20260914173503",
    "[2026-11-04 08:56:39.839] [unisrv] [error] [:39] Execute fatal error: Command '/home/lava/bin/systemUpgrade.sh' failed with code 143:",
    "[2026-11-04 08:56:39.840] [unisrv] [error] [IMSYS:220] Upgrade failed",
    "[2026-11-04 08:56:17.173] [unisrv] [error] [MA_AUTH:357] FetchCCFromAPI: network error: Couldn't resolve host name",
    "",
])

SYS = "\n".join(
    [f"Nov  8 11:27:{i:02d} lava kern.warn kernel: [    7.4] [dhd] [wlan0] wl_ext_iapsta_link : [S] Link down with aa:bb:cc:dd:ee:ff, WLC_E_DEAUTH(5), reason 7" for i in range(6)]
    + ["Nov  4 08:55:18 lava kern.info kernel: [  523.8] usb 1-1.1: USB disconnect, device number 7", ""])

ORCA = "\n".join(
    ["[warning]\t2026-10-14 12:15:56.878796[Thread 0x00006478]:[Version] Snapmaker Orca: 2.4.0, Build: 01.10.01.50",
     "[warning]\t2026-10-14 12:15:56.880780[Thread 0x00006478]:[Version] OS: Windows 11 (build 26300), 64-bit edition (10.0.26300)",
     "[error]\t2026-10-14 12:16:07.495090[Thread 0x000066e0]:Unable to open the fileC:\\Users\\someone\\Desktop\\private.3mf"]
    + [f"[error]\t2026-10-14 12:17:{i:02d}.000000[Thread 0x1]:[WCP] [x][error][LavaDeviceMV][web-main-catch, error: Exception: Application is not activated, please activate it first, stackTrace: " for i in range(6)]
    + [f"[error]\t2026-10-14 12:18:{i:02d}.000000[Thread 0x1]:[WCP] [x][error][deviceControl][[Heartbeat] heartbeat error: [-1] Command timed out after 10 s, commond: {{method: machine.heartbeat}}" for i in range(6)]
    + [""])


def _obs(text: str, name: str = "x.log") -> list[dict]:
    return analyse(text.encode(), name, NOW)["observations"]


def test_exception_code_is_rebuilt_in_the_official_format():
    assert official_code(2, 523, 3, 38) == "0002-0523-0003-0038"
    assert interpret("0002-0523-0003-0038")["status"] == "KNOWN"  # checked against the official table on real events


def test_moonraker_exceptions_and_privacy():
    r = analyse(MOON.encode(), "moonraker.log", NOW)
    ex = [o for o in r["observations"] if o["event_type"] == "machine_exception"]
    assert {o["value"]["code"] for o in ex} == {"0001-0523-0000-0048", "0002-0523-0003-0038", "0002-0532-0000-0002"}
    assert all(o["source_status"] == "IMPORTED" and o["source_kind"] == "IMPORT" and o["sensitive"] is False for o in r["observations"])
    summ = [o for o in r["observations"] if o["event_type"] == "moonraker_summary"][0]["value"]
    assert summ["jobs"] == {"complete": 1, "started": 1} and summ["mqtt_offline_events"] == 2 and summ["name_resolution_failures"] == 1
    assert "secret_name" not in json.dumps(r)  # job file names are never copied


def test_klippy_dated_and_undated_formats_link_counters_and_shutdown():
    r = analyse(KLIPPY.encode(), "k.log", NOW)
    stats = [o for o in r["observations"] if o["event_type"] == "klippy_link_stats"][0]["value"]
    assert stats["stats_lines"] == 1 and stats["mcus"]["e0"]["err_dest"] == 1 and stats["mcus"]["mcu"]["retransmit"] == 9
    sh = [o for o in r["observations"] if o["event_type"] == "klippy_shutdown"]
    assert len(sh) == 1 and "Timer too close" in sh[0]["value"]["reason"]
    assert sh[0]["capture_utc"].startswith("2026-10-13T00:07")  # the clock wrapped past midnight: next day
    summ = [o for o in r["observations"] if o["event_type"] == "klippy_summary"][0]["value"]
    assert summ["switch_retries"] == 1 and summ["extruder_activations"] == {"extruder3": 1} and summ["bed_mesh_last"]["average"] == 0.07
    assert "/home/lava" not in json.dumps(r)  # the config dump is skipped


def test_rolled_klippy_log_with_date_prefix():
    text = "11-08 18:17:22.085:===== Config file =====\n[x]\n=======================\n11-08 18:17:24.684:Stats 1.0: gcodein=0  mcu: mcu_awake=0.013 mcu_task_avg=0.000009 mcu_task_stddev=0.000005 err_len=2 err_dest=0 err_sync=0 err_crc=0 bytes_write=3 bytes_read=3 bytes_retransmit=9 bytes_invalid=0 send_seq=1\n"
    o = [x for x in _obs(text) if x["event_type"] == "klippy_summary"][0]
    assert o["value"]["first_utc"] == "2026-11-08T18:17:24Z"


def test_unisrv_syslog_and_orca_counts():
    u = [o for o in _obs(UNI) if o["event_type"] == "unisrv_summary"][0]["value"]
    assert u["timelapse_capture_failed"] == 3 and u["hal_execute_error_codes"] == {"69": 1} and u["name_resolution_failures"] == 1
    up = [o["value"] for o in _obs(UNI) if o["event_type"] == "firmware_upgrade"]
    assert {"event": "upgrade_script_failed", "exit_code": 143} in up
    s = [o for o in _obs(SYS) if o["event_type"] == "syslog_summary"][0]["value"]
    assert s["wifi_deauth_total"] == 6 and s["wifi_deauth_reasons"] == {"7": 6} and s["usb_disconnects"] == 1
    assert "aa:bb:cc" not in json.dumps(_obs(SYS))
    o = [x for x in _obs(ORCA) if x["event_type"] == "orca_summary"][0]["value"]
    assert o["days_not_activated"] == ["2026-10-14"] and o["not_activated"] == 6 and o["heartbeat_timeouts"] == 6 and o["orca_versions"] == ["2.4.0"] and o["os"] == ["Windows build 26300"]
    blob = json.dumps(_obs(ORCA))
    assert "someone" not in blob and "private.3mf" not in blob and "Desktop" not in blob


def test_rules_turn_the_logs_into_findings():
    obs = _obs(MOON) + _obs(KLIPPY) + _obs(UNI) + _obs(SYS) + _obs(ORCA)
    for i, o in enumerate(obs, 1):
        o["observation_id"] = f"logs_{i:05d}"
    f = evaluate(obs, RS)
    ids = {x["rule_id"] for x in f}
    assert {"U1-S25-MACHINE-EXCEPTIONS", "U1-S26-LINK-HEALTH", "U1-S27-KLIPPY-SHUTDOWN", "U1-S28-NETWORK-HEALTH", "U1-S29-FIRMWARE-UPGRADE",
            "U1-S30-TIMELAPSE-FAILURES", "U1-S31-ORCA-LINK"} <= ids
    s25 = {x["human_title"] for x in f if x["rule_id"] == "U1-S25-MACHINE-EXCEPTIONS"}
    assert any("0001-0523-0000-0048 raised 3 times" in t and "Pogopin" in t for t in s25)
    assert any("0002-0523-0003-0038" in t and "Toolhead 4" in t for t in s25)
    assert all(x["source_mix"] == ["IMPORTED"] and x["not_a_root_cause"] for x in f if x["rule_id"].startswith(("U1-S25", "U1-S26", "U1-S27")))
    blob = json.dumps(f)
    assert "score" not in blob.lower() and "probab" not in blob.lower()


def test_link_counters_with_errors_are_suspected_not_clean():
    bad = KLIPPY.replace("err_crc=0 bytes_write=31508723", "err_crc=4 bytes_write=31508723")
    obs = _obs(bad)
    for i, o in enumerate(obs, 1):
        o["observation_id"] = f"logs_{i:05d}"
    s26 = [x for x in evaluate(obs, RS) if x["rule_id"] == "U1-S26-LINK-HEALTH"]
    assert len(s26) == 1 and s26[0]["classification"] == "SUSPECTED" and "crc 4" in s26[0]["human_title"]


def test_quiet_logs_make_no_noise():
    quiet = "-------------------- Log Start | Wed Jul  8 12:40:07 2026 --------------------\n2026-10-19 09:51:34,086 [mqtt.py:x()] - MQTT Client Offline!\n"
    obs = _obs(quiet)
    for i, o in enumerate(obs, 1):
        o["observation_id"] = f"logs_{i:05d}"
    assert [f for f in evaluate(obs, RS) if f["rule_id"].startswith("U1-S2") and f["rule_id"] != "U1-S09-MAPPING-UNKNOWN"] == []


def _enc_tar() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t:
        for n, b in (("content.enc", b"Salted__" + b"\x00" * 40), ("key.enc", b"\x01" * 256)):
            i = tarfile.TarInfo(n)
            i.size = len(b)
            t.addfile(i, io.BytesIO(b))
    return buf.getvalue()


def test_encrypted_export_is_recognized_and_never_opened():
    r = analyse(_enc_tar(), "LOGS_X000_2.0.0_20260101000000.tar.gz", NOW)
    assert r["files"][0]["kind"] == "encrypted"
    o = r["observations"][0]
    assert o["event_type"] == "encrypted_system_log" and o["value"]["firmware_in_name"] == "2.0.0"
    assert "X000" not in json.dumps(r)  # the serial-looking part of the name is dropped
    obs = r["observations"]
    f = [x for x in evaluate(obs, RS) if x["rule_id"] == "U1-S32-ENCRYPTED-LOG"]
    assert len(f) == 1 and "Send this file unchanged" in f[0]["safe_actions"][0]


def test_containers_gz_zip_and_errors():
    assert analyse(gzip.compress(SYS.encode()), "s.gz", NOW)["files"][0]["kind"] == "syslog"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("a.log", MOON)
        z.writestr("b.log", UNI)
    r = analyse(buf.getvalue(), "x.zip", NOW)
    assert [f["kind"] for f in r["files"]] == ["moonraker", "unisrv"]
    with pytest.raises(LogImportError) as e:
        analyse(b"just some random text\nnothing here\n", "x", NOW)
    assert e.value.code == "NOTHING_RECOGNIZED"
    with pytest.raises(LogImportError) as e:
        analyse(b"PK\x03\x04garbage", "x.zip", NOW)
    assert e.value.code == "BAD_ARCHIVE"


def test_unpacked_size_and_file_count_are_capped(monkeypatch):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("a.log", "A" * 3_000_000)
    with pytest.raises(LogImportError) as e:  # ratio guard (zip bomb)
        analyse(buf.getvalue(), "x.zip", NOW)
    assert e.value.code == "TOO_LARGE"
    monkeypatch.setattr(logimport, "MAX_MEMBERS", 1)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("a.log", MOON)
        z.writestr("b.log", UNI)
    with pytest.raises(LogImportError) as e:
        analyse(buf.getvalue(), "x.zip", NOW)
    assert e.value.code == "TOO_MANY_FILES"


def test_observations_validate_against_the_schema():
    schema = json.loads((ROOT / "schemas" / "observation.schema.json").read_text(encoding="utf-8"))
    v = Draft202012Validator(schema)
    for text in (MOON, KLIPPY, UNI, SYS, ORCA):
        for o in _obs(text):
            v.validate(o)


def test_log_signals_file_matches_its_schema():
    schema = json.loads((ROOT / "schemas" / "log-signals.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(json.loads((ROOT / "knowledge" / "u1_log_signals.json").read_text(encoding="utf-8")))
    for s in load_log_signals()["signals"]:
        assert interpret(s["code"])["status"] == "STRUCTURE_ONLY"  # only codes the official table lacks belong here


@pytest.fixture()
def client():
    return TestClient(create_app(":memory:"))


def test_api_import_and_save_logs(client):
    r = client.post("/api/v1/imports/logs?name=moonraker.log", content=MOON.encode(), headers=H)
    assert r.status_code == 200
    j = r.json()
    assert j["summary"]["observations"] >= 5 and j["findings"] and j["ruleset"]["version"] == "0.5.0"
    s = client.post("/api/v1/history/logs?label=My%20logs", content=MOON.encode(), headers=H)
    assert s.status_code == 200 and s.json()["session"]["origin"] == "logs"
    sid = s.json()["session"]["id"]
    f = client.get(f"/api/v1/history/{sid}/findings").json()
    assert any(x["rule_id"] == "U1-S25-MACHINE-EXCEPTIONS" for x in f["findings"])
    assert client.post("/api/v1/imports/logs", content=b"nothing useful", headers=H).status_code == 422
    assert client.post("/api/v1/imports/logs", content=MOON.encode()).status_code == 403  # write guard (no X-U1D header)


def test_migration_to_logs_origin_keeps_existing_history():
    conn = sqlite3.connect(":memory:", factory=db._Connection)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    for i in range(2):  # apply migrations 1 and 2 only, as an older install would have
        conn.executescript("BEGIN;" + db.MIGRATIONS[i] + f"PRAGMA user_version={i + 1};COMMIT;")
    conn.execute("INSERT INTO history_sessions VALUES ('s1','old','bundle','2026-01-01T00:00:00Z',1,'a','b','IMPORTED','sha1')")
    conn.execute("INSERT INTO history_observations VALUES ('s1',1,'{}')")
    conn.commit()
    assert db.migrate(conn) == len(db.MIGRATIONS)
    assert conn.execute("SELECT count(*) FROM history_observations").fetchone()[0] == 1  # child rows survived the rebuild
    conn.execute("INSERT INTO history_sessions VALUES ('s2','new','logs','2026-01-02T00:00:00Z',1,'a','b','IMPORTED','sha2')")
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == [] and conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_live_exception_manager_frames_become_machine_exceptions():
    from app.capture import frames_to_observations
    ex = {"id": 523, "index": 3, "code": 38, "level": 2, "message": "detect filament tangled!", "timestamp": 1.5}
    frame = {"jsonrpc": "2.0", "method": "notify_status_update", "params": [{"exception_manager": {"exceptions": [ex, ex, {"id": "x"}]}}, 100.0]}
    lines = [json.dumps({"t": "2026-11-09T10:00:00.000000Z", "frame": frame}), json.dumps({"t": "2026-11-09T10:00:01.000000Z", "frame": frame})]
    obs = [o for o in frames_to_observations(lines) if o["event_type"] == "machine_exception"]
    assert len(obs) == 1  # repeated updates and malformed entries add nothing
    assert obs[0]["value"]["code"] == "0002-0523-0003-0038" and obs[0]["source_status"] == "REAL" and obs[0]["entity_id"] == "unmapped"
    f = [x for x in evaluate(obs, RS) if x["rule_id"] == "U1-S25-MACHINE-EXCEPTIONS"]
    assert len(f) == 1 and f[0]["evidence_quality"] == "MODERATE" and "live capture" in " ".join(f[0]["limits"])


def test_decoder_accepts_a_pasted_exception_and_explains_codes_seen_only_in_logs(client):
    r = client.post("/api/v1/errors/interpret", headers=H, json={"code": "{'id': 523, 'index': 3, 'code': 38, 'level': 2, 'message': 'x'}"}).json()
    assert r["from_exception"] == "0002-0523-0003-0038" and r["decoding"]["status"] == "KNOWN" and r["log_signal"] is None
    r = client.post("/api/v1/errors/interpret", headers=H, json={"code": '{"level": 1, "id": 523, "index": 0, "code": 48}'}).json()
    assert r["from_exception"] == "0001-0523-0000-0048" and r["decoding"]["status"] == "STRUCTURE_ONLY"
    assert r["log_signal"]["title"]["en"] == "Pogopin disconnection during a print" and r["log_signal"]["seen"]
    r = client.post("/api/v1/errors/interpret", headers=H, json={"code": "id 523 code 48"}).json()
    assert r["from_exception"] is None  # all four fields are needed


def test_imported_logs_export_to_a_valid_bundle_and_replay_identically():
    from app.deb import export_bundle, import_bundle
    obs = _obs(MOON) + _obs(KLIPPY) + _obs(UNI) + _obs(SYS) + _obs(ORCA)
    for i, o in enumerate(obs, 1):
        o["observation_id"] = f"logs_{i:05d}"
    data = export_bundle(obs, RS, app_version="0.1.9-g1", generated_at="2026-11-09T12:00:00Z")
    out = import_bundle(data, RS)
    assert out["replay"]["matches_bundle"] is True and out["origin_source_mix"] == ["IMPORTED"]
    blob = zipfile.ZipFile(io.BytesIO(data)).read("observations.jsonl").decode()
    assert "secret_name" not in blob and "aa:bb:cc" not in blob and "someone" not in blob
