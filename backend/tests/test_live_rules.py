"""BACKLOG #57 (live rules S17-S24) and #59 (connectivity self-check). Network always mocked; no printer is contacted.

Owner decision 2026-11-08: defensive code, UNTESTED on a real U1. These tests pin the read budget, the policy,
the "not observable" behaviour and the consent text; they prove nothing about real printers.
"""
import copy
import json
import re
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

import app.live as live
from app.api import create_app
from app.capture import COVERAGE_KEYS, live_facts
from app.deb import validate_observation
from app.engine import canon, evaluate
from app.transport import (
    ALLOWED_HTTP_QUERY,
    ALLOWED_SUBSCRIBE_OBJECTS,
    Consent,
    PolicyViolation,
    ReadOnlyMoonrakerTransport,
    check_http_request,
    check_ws_message,
)

ROOT = Path(__file__).resolve().parents[2]
RS = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
OBS_SCHEMA = Draft202012Validator(json.loads((ROOT / "schemas" / "observation.schema.json").read_text(encoding="utf-8")))
HOST, HOST2 = "192.168.50.20", "192.168.50.21"
APP = {"X-U1D": "1"}
NEW_RULES = ["U1-S17-OFFSET-Y-SPREAD", "U1-S18-SENSOR-IMPLAUSIBLE", "U1-S19-HEATER-NO-RISE", "U1-S20-NOZZLE-DIAMETER",
             "U1-S21-CLOCK-RESET", "U1-S22-LOG-PARTITION", "U1-S23-TOOLHEAD-ACTIVITY", "U1-S24-BED-MESH-STATS"]


# ---- policy: the one new GET and the subscribe object allowlist -----------------------------------------------
def test_logs_disk_usage_get_is_allowed_only_with_the_exact_query():
    assert check_http_request("GET", "/server/files/directory", None, {"path": "logs"}) == "server.files.directory"
    assert dict(ALLOWED_HTTP_QUERY[("GET", "/server/files/directory")]) == {"path": frozenset({"logs"})}


@pytest.mark.parametrize("method,path,query", [
    ("GET", "/server/files/directory", None),
    ("GET", "/server/files/directory", {}),
    ("GET", "/server/files/directory", {"path": "config"}),
    ("GET", "/server/files/directory", {"path": "gcodes"}),
    ("GET", "/server/files/directory", {"path": "logs/sub"}),
    ("GET", "/server/files/directory", {"path": "LOGS"}),
    ("GET", "/server/files/directory", {"path": "logs", "extended": "true"}),
    ("GET", "/server/files/directory", {"root": "logs"}),
    ("GET", "/server/files/directory?path=logs", None),
    ("POST", "/server/files/directory", {"path": "logs"}),
    ("DELETE", "/server/files/directory", {"path": "logs"}),
    ("GET", "/server/files/list", {"path": "logs"}),
    ("GET", "/server/info", {"path": "logs"}),
    ("GET", "/machine/proc_stats", None),
    ("GET", "/machine/system_info", None),
    ("GET", "/printer/objects/query", None),
    # job history (BACKLOG #65): only the totals path, with no query
    ("GET", "/server/history/totals", {"path": "logs"}),
    ("GET", "/server/history/list", None),
    ("GET", "/server/history/list", {"limit": "21", "order": "desc"}),
    ("GET", "/server/history/list", {"limit": "20"}),
    ("GET", "/server/gcode_store", None),
    ("GET", "/server/gcode_store", {"count": "1000"}),
    ("POST", "/server/gcode_store", {"count": "100"}),
    ("DELETE", "/server/history/list", {"limit": "20", "order": "desc"}),
    ("GET", "/server/history/job", None),
    ("POST", "/server/history/totals", None),
    ("POST", "/server/history/reset_totals", None),
    ("DELETE", "/server/history/job", None),
    ("GET", "/server/history/totals/", None),
    ("GET", "/server/history", None),
])
def test_other_directory_variants_and_new_reads_are_denied(method, path, query):
    with pytest.raises(PolicyViolation):
        check_http_request(method, path, None, query)


def test_history_totals_get_is_allowed_with_no_query():
    assert check_http_request("GET", "/server/history/totals") == "server.history.totals"
    assert ("GET", "/server/history/totals") not in ALLOWED_HTTP_QUERY


class Spy:
    def __init__(self, body=None, status=200):
        self.calls, self.body, self.status = [], body or {"result": {"disk_usage": {"total": 10, "used": 4, "free": 6}}}, status

    def __call__(self, req):
        self.calls.append(req)
        return httpx.Response(self.status, json=self.body)


def test_transport_sends_exactly_the_allowlisted_query_and_records_latency():
    spy = Spy()
    t = ReadOnlyMoonrakerTransport(HOST, consent=Consent(False, HOST, "T"), http_transport=httpx.MockTransport(spy))
    t.get_logs_disk_usage()
    (req,) = spy.calls
    assert req.method == "GET" and req.url.path == "/server/files/directory" and req.url.query == b"path=logs" and req.content == b""
    a = t.audit[0]
    assert a.tag == "server.files.directory" and a.query == {"path": "logs"} and isinstance(a.ms, float) and a.ms >= 0


def test_transport_reads_history_totals_with_a_bare_get():
    spy = Spy({"result": {"job_totals": {"total_jobs": 1}}})
    t = ReadOnlyMoonrakerTransport(HOST, consent=Consent(False, HOST, "T"), http_transport=httpx.MockTransport(spy))
    t.get_history_totals()
    (req,) = spy.calls
    assert req.method == "GET" and req.url.path == "/server/history/totals" and req.url.query == b"" and req.content == b""
    assert t.audit[0].tag == "server.history.totals" and t.audit[0].query is None


def test_refused_query_makes_no_io():
    spy = Spy()
    t = ReadOnlyMoonrakerTransport(HOST, consent=Consent(False, HOST, "T"), http_transport=httpx.MockTransport(spy))
    with pytest.raises(PolicyViolation):
        t._send("GET", "/server/files/directory", query={"path": "gcodes"})
    with pytest.raises(PolicyViolation):
        t._send("GET", "/server/info", query={"path": "logs"})
    assert spy.calls == [] and [a.allowed for a in t.audit] == [False, False]


def _sub(objs):
    return json.dumps({"jsonrpc": "2.0", "method": "printer.objects.subscribe", "params": {"objects": objs}, "id": 1})


def test_subscribe_allows_the_two_new_objects_and_the_full_live_set():
    assert check_ws_message(_sub({"temperature_sensor cavity": ["temperature"], "bed_mesh": ["probed_matrix"]})) == "printer.objects.subscribe"
    from app.h02 import OBJECTS
    assert set(OBJECTS) | set(live.EXTRA_OBJECTS) == set(ALLOWED_SUBSCRIBE_OBJECTS)
    check_ws_message(_sub(OBJECTS | live.EXTRA_OBJECTS))


@pytest.mark.parametrize("name", ["configfile", "gcode_macro PRINT_START", "temperature_sensor chamber", "system_stats", "mcu", "bed_mesh "])
def test_subscribe_refuses_objects_outside_the_allowlist(name):
    with pytest.raises(PolicyViolation):
        check_ws_message(_sub({name: None}))


# ---- consent text: must state the code's real maximum --------------------------------------------------------------
def _i18n(key):
    src = (ROOT / "frontend" / "src" / "lib" / "i18n.ts").read_text(encoding="utf-8")
    return re.findall(rf'{key}: "((?:[^"\\]|\\.)*)"', src)


def test_consent_text_counts_match_the_code_budget_in_en_and_fr():
    assert live.MAX_GET == live.BASE_GET + live.PROBES * 2 == 13 and live.MAX_WS_SENT == 1
    en, fr = _i18n("liveConsent")
    m = re.search(r"(\d+) GET .*?(\d+) live subscription.*?up to (\d+) more read-only status GET: (\d+) GET at most", en)
    assert m, en
    assert [int(x) for x in m.groups()] == [live.BASE_GET, live.MAX_WS_SENT, live.PROBES * 2, live.MAX_GET]
    m = re.search(r"(\d+) GET .*?(\d+) abonnement en direct.*?jusqu'à (\d+) GET d'état en lecture seule de plus : (\d+) GET au maximum", fr)
    assert m, fr
    assert [int(x) for x in m.groups()] == [live.BASE_GET, live.MAX_WS_SENT, live.PROBES * 2, live.MAX_GET]
    assert "job totals of the print history" in en and "totaux de l'historique des impressions" in fr


@pytest.mark.parametrize("doc", ["SECURITY.md", "docs/INSTALL.md", "README.md", "docs/adr/0002-moonraker-readonly.md", "docs/threat-model.md"])
def test_docs_state_the_same_maximum(doc):
    text = (ROOT / doc).read_text(encoding="utf-8")
    assert f"{live.MAX_GET} GET" in text and "/server/files/directory?path=logs" in text and "/server/history/totals" in text


def test_the_api_docstring_and_module_docstring_agree():
    import app.api as api
    assert "13 GET" in (api.create_app.__doc__ or "") or "13 GET" in (live.__doc__ or "")
    assert "MAX_GET = 13" in (live.__doc__ or "")


# ---- live_facts: what is kept from frames --------------------------------------------------------------------------
def _frames(cavity=-1035.8, bed=-1035.8, state="printing", et0=5000.0, mcu=900.0, mesh=None, extra=None):
    st = {
        "print_stats": {"state": state, "filename": "secret_cube.gcode"},
        "toolhead": {"estimated_print_time": mcu, "homed_axes": "xyz"},
        "heater_bed": {"temperature": bed, "target": 60.0},
        "temperature_sensor cavity": {"temperature": cavity},
        "extruder": {"extruder_offset": [0.1, 1.12, 0.0], "nozzle_diameter": 0.4, "state": "PARKED", "switch_count": 10, "retry_count": 1, "error_count": 0,
                     "temperature": 25.0, "target": 220.0},
        "extruder1": {"extruder_offset": [-0.1, -1.14, -0.05], "nozzle_diameter": 0.4, "state": "PARKED", "switch_count": 5, "retry_count": 0, "error_count": 0},
        "bed_mesh": {"probed_matrix": mesh if mesh is not None else [[0.0, 0.1], [-0.1, 0.2]]},
    }
    if extra:
        st.update(extra)
    lines = [json.dumps({"t": "2026-01-20T10:00:00.000000Z", "frame": {"id": 1, "result": {"eventtime": et0, "status": st}}})]
    for k in range(1, 5):
        upd = {"heater_bed": {"temperature": bed}, "temperature_sensor cavity": {"temperature": cavity}, "extruder": {"temperature": 25.2}}
        if k == 2:
            upd["extruder1"] = {"state": "ACTIVATE", "switch_count": 6}
        lines.append(json.dumps({"t": f"2026-01-20T10:00:{k * 10:02d}.000000Z", "frame": {"method": "notify_status_update", "params": [upd, et0 + k * 10]}}))
    return lines


def test_live_facts_builds_one_summary_per_source_and_keeps_no_names():
    facts = live_facts(_frames(), start=1, disk={"root": "logs", "total_bytes": 100, "used_bytes": 95, "free_bytes": 5, "t": "2026-01-20T10:00:00Z"})
    types = [o["event_type"] for o in facts]
    assert types == ["extruder_offsets", "nozzle_diameters", "heater_window", "clock_check", "extruder_activity", "bed_mesh_points", "disk_usage", "live_coverage"]
    by = {o["event_type"]: o["value"] for o in facts}
    assert by["live_coverage"] == {"absent": []}
    assert by["heater_window"]["bed_cavity"] == {"pairs": 5, "identical": 5}
    assert by["heater_window"]["sensors"]["extruder"]["seconds"] == 40.0
    assert by["clock_check"] == {"host_s": 5040.0, "mcu_s": 900.0, "print_state": "printing"}
    assert by["extruder_activity"]["extruders"]["extruder1"] == {"state_changes": 1, "switch_count": [5, 6], "retry_count": [0, 0], "error_count": [0, 0]}
    assert by["bed_mesh_points"]["points"] == 4 and by["bed_mesh_points"]["range_mm"] == 0.3
    assert "secret" not in json.dumps(facts)
    for o in facts:
        OBS_SCHEMA.validate(o)
        validate_observation(o)
        assert o["entity_id"] == "printer" and o["source_status"] == "REAL"


def test_live_facts_is_deterministic():
    a = live_facts(_frames(), start=7)
    assert canon(a) == canon(live_facts(_frames(), start=7))
    assert [o["observation_id"] for o in a] == [f"real_h02_{i:04d}" for i in range(7, 7 + len(a))]


def test_live_facts_lists_what_is_absent():
    lines = [json.dumps({"t": "2026-01-20T10:00:00Z", "frame": {"id": 1, "result": {"status": {"print_stats": {"state": "standby"}}}}})]
    facts = live_facts(lines, start=1)
    assert [o["event_type"] for o in facts] == ["live_coverage"]
    assert facts[0]["value"]["absent"] == sorted(COVERAGE_KEYS)
    assert live_facts([], start=1) == []


def test_malformed_values_are_not_summarised():
    lines = _frames(extra={"extruder": {"extruder_offset": ["a", None], "nozzle_diameter": True}, "extruder1": {"extruder_offset": "x"}, "bed_mesh": {"probed_matrix": [[1, "x"]]}})
    by = {o["event_type"]: o["value"] for o in live_facts(lines, start=1)}
    assert "extruder_offsets" not in by and "bed_mesh_points" not in by
    assert "extruder_offset" in by["live_coverage"]["absent"] and "bed_mesh" in by["live_coverage"]["absent"]


# ---- rules: positive / negative / absent ----------------------------------------------------------------------------
def _ev(rows, cov_absent=()):
    out = []
    for i, (etype, value) in enumerate([*rows, ("live_coverage", {"absent": list(cov_absent)})], start=1):
        out.append({"schema_version": "1.0", "observation_id": f"live_t_{i:04d}", "session_id": "live_t", "source_kind": "MOONRAKER", "source_status": "REAL",
                    "capture_utc": f"2026-01-20T10:00:{i:02d}Z", "source_timestamp": None, "timestamp_quality": "RECEIPT_ONLY", "source_ref": "transport/test",
                    "entity_id": "printer", "mapping_quality": "VERIFIED", "event_type": etype, "value": value, "validity": "FRESH", "sensitive": False})
    return [f for f in evaluate(out, RS) if f["rule_id"] in NEW_RULES]


def _ids(fs):
    return sorted((f["rule_id"], f["classification"]) for f in fs)


def test_offset_spread_threshold_is_strictly_above_2_mm():
    def off(y0, y1):
        return [("extruder_offsets", {"extruder": {"x": 0, "y": y0, "z": 0}, "extruder1": {"x": 0, "y": y1, "z": 0}})]
    assert _ev(off(1.0, -1.0)) == []
    (f,) = _ev(off(1.2, -1.0))
    assert f["classification"] == "OBSERVED" and "2.20 mm" in f["human_title"] and f["references"][0]["url"].endswith("/44046")
    assert f["hypotheses"][0]["label"] == "COMMUNITY_HYPOTHESIS" and any("UNTESTED" in x for x in f["limits"])
    assert _ev([("extruder_offsets", {"extruder": {"x": 0, "y": 5.0, "z": 0}})]) == []  # one head: nothing to compare


def test_sensor_implausible_needs_a_value_below_minus_100_or_identical_pairs():
    def hw(b, c, pairs=5, same=0):
        return [("heater_window", {"sensors": {"heater_bed": {"min_c": b}, "temperature_sensor cavity": {"min_c": c}}, "bed_cavity": {"pairs": pairs, "identical": same}})]
    assert _ids(_ev(hw(-99.0, 20.0))) == []
    assert _ids(_ev(hw(-1035.8, 20.0))) == [("U1-S18-SENSOR-IMPLAUSIBLE", "OBSERVED")]
    assert _ids(_ev(hw(24.6, 24.6, 5, 5))) == [("U1-S18-SENSOR-IMPLAUSIBLE", "OBSERVED")]
    assert _ids(_ev(hw(24.6, 24.6, 2, 2))) == []  # too few pairs
    assert _ids(_ev(hw(24.6, 24.6, 5, 4))) == []


def test_heater_no_rise():
    def hw(first, last, target, secs):
        return [("heater_window", {"sensors": {"extruder": {"first_c": first, "last_c": last, "target_c": target, "seconds": secs}}, "bed_cavity": {"pairs": 0, "identical": 0}})]
    assert _ids(_ev(hw(25.0, 25.5, 220.0, 45.0))) == [("U1-S19-HEATER-NO-RISE", "OBSERVED")]
    assert _ev(hw(25.0, 40.0, 220.0, 45.0)) == []  # it rose
    assert _ev(hw(25.0, 25.0, 220.0, 10.0)) == []  # window too short
    assert _ev(hw(215.0, 215.0, 220.0, 45.0)) == []  # already near target
    assert _ev(hw(25.0, 25.0, 0.0, 45.0)) == []  # heater off
    assert _ev(hw(25.0, 25.0, None, 45.0)) == []


def test_nozzle_compare_mixed_and_gcode():
    same = [("nozzle_diameters", {"extruder": 0.4, "extruder1": 0.4})]
    assert _ev(same) == []
    assert _ev([*same, ("gcode_nozzle_diameter", {"mm": [0.4]})]) == []
    (f,) = _ev([*same, ("gcode_nozzle_diameter", {"mm": [0.4, 0.6]})])
    assert "0.6 mm is not reported" in f["human_title"] and f["evidence_quality"] == "WEAK"
    assert any("printer.cfg" in m for m in f["missing_data"])
    assert _ids(_ev([("nozzle_diameters", {"extruder": 0.4, "extruder1": 0.2})])) == [("U1-S20-NOZZLE-DIAMETER", "OBSERVED")]


def test_clock_gap_only_while_printing():
    assert _ids(_ev([("clock_check", {"host_s": 5000.0, "mcu_s": 100.0, "print_state": "printing"})])) == [("U1-S21-CLOCK-RESET", "OBSERVED")]
    assert _ev([("clock_check", {"host_s": 5000.0, "mcu_s": 100.0, "print_state": "standby"})]) == []
    assert _ev([("clock_check", {"host_s": 5000.0, "mcu_s": 4500.0, "print_state": "printing"})]) == []
    assert _ev([("clock_check", {"host_s": None, "mcu_s": 4500.0, "print_state": "printing"})]) == []


def test_disk_usage_is_reported_with_the_save_pointer():
    (f,) = _ev([("disk_usage", {"root": "logs", "total_bytes": 100_000_000, "used_bytes": 75_000_000, "free_bytes": 25_000_000})])
    assert f["human_title"] == "Log partition: 25.0 MB free of 100.0 MB (75 % used)"
    assert any(s.startswith("Save the bundle now") for s in f["safe_actions"]) and f["references"][0]["url"].endswith("/41445")
    assert _ev([("disk_usage", {"root": "logs", "total_bytes": 0, "used_bytes": 0, "free_bytes": 0})]) == []


def test_activity_counts_are_not_ranked_and_need_a_change():
    still = {"extruders": {"extruder": {"state_changes": 0, "retry_count": [3, 3]}}, "homing_changes": 0}
    assert _ev([("extruder_activity", still)]) == []
    moved = {"extruders": {"extruder3": {"state_changes": 0, "retry_count": [3, 5]}, "extruder": {"state_changes": 2}}, "homing_changes": 1}
    (f,) = _ev([("extruder_activity", moved)])
    note = f["evidence_for"][0]["note"]
    assert note.index("extruder:") < note.index("extruder3:") and "retry_count 5 (+2)" in note and "Homed-axes changes: 1" in note


def test_bed_mesh_numbers_only():
    (f,) = _ev([("bed_mesh_points", {"rows": 2, "cols": 2, "points": 4, "min_mm": -0.1, "max_mm": 0.2, "range_mm": 0.3, "mean_mm": 0.05, "stdev_mm": 0.11})])
    assert f["classification"] == "OBSERVED" and "normal" not in f["human_title"].lower()
    (g,) = _ev([("bed_mesh_points", {"points": 0})])
    assert g["classification"] == "INCONCLUSIVE"


@pytest.mark.parametrize("key,rules", [
    ("extruder_offset", ["U1-S17-OFFSET-Y-SPREAD"]), ("nozzle_diameter", ["U1-S20-NOZZLE-DIAMETER"]),
    ("heater_bed", ["U1-S18-SENSOR-IMPLAUSIBLE", "U1-S19-HEATER-NO-RISE"]), ("temperature_sensor cavity", ["U1-S18-SENSOR-IMPLAUSIBLE"]),
    ("estimated_print_time", ["U1-S21-CLOCK-RESET"]), ("disk_usage", ["U1-S22-LOG-PARTITION"]),
    ("extruder_state", ["U1-S23-TOOLHEAD-ACTIVITY"]), ("bed_mesh", ["U1-S24-BED-MESH-STATS"]),
])
def test_absent_source_gives_one_inconclusive_not_observable(key, rules):
    fs = _ev([], cov_absent=[key])
    assert _ids(fs) == sorted((r, "INCONCLUSIVE") for r in rules)
    for f in fs:
        assert "not observable" in f["human_title"] and f["missing_data"] and f["hypotheses"] == [] and f["evidence_quality"] == "UNKNOWN"


def test_rules_stay_silent_without_a_live_coverage_record():
    """Offline data (old captures, bundles) has no coverage record: no 'not observable' noise."""
    assert [f for f in evaluate([], RS)] == []
    gold = json.loads((ROOT / "fixtures" / "real" / "real_h02_normal_print.findings.json").read_text(encoding="utf-8"))
    assert not [f for f in gold if f["rule_id"] in NEW_RULES]


def test_every_new_finding_has_provenance_and_no_score():
    obs = [json.loads(x) for x in (ROOT / "fixtures/synthetic/synthetic_live_rules_positive.observations.jsonl").read_text(encoding="utf-8").splitlines()]
    fs = [f for f in evaluate(obs, RS) if f["rule_id"] in NEW_RULES]
    assert {f["rule_id"] for f in fs} == set(NEW_RULES)
    for f in fs:
        assert f["evidence_for"] and f["source_mix"] == ["SYNTHETIC"] and f["human_title"].startswith("SYNTHETIC: ")
        assert f["rule_version"] == "1.0.0" and f["limits"] and f["safe_actions"]
        assert not re.search(r"score|probab|confidence|\d+ ?%(?! used)", json.dumps(f), re.I)
        assert f["classification"] in ("OBSERVED", "INCONCLUSIVE")


def test_new_rules_are_proposed_and_numbered_in_sequence():
    ids = [r["id"] for r in RS["rules"]]
    assert ids[12:20] == NEW_RULES and len(ids) == 28  # S25-S32 (log import) follow; see test_logimport.py
    assert all(r["status"] == "PROPOSED" for r in RS["rules"])


# ---- end to end through the API (#57 + #59) ---------------------------------------------------------------------
class Conn:
    def __init__(self, frames, drop=False):
        self.sent, self.frames, self.drop = [], [json.loads(x)["frame"] for x in frames], drop

    def send(self, m):
        self.sent.append(m)

    def recv(self, timeout=None):
        if not self.frames:
            if self.drop:
                raise ConnectionResetError("peer closed")
            raise TimeoutError
        return json.dumps(self.frames.pop(0))

    def close(self):
        pass


TOTALS = {"result": {"job_totals": {"total_jobs": 42, "total_time": 360000.04, "total_print_time": 324000.0, "total_filament_used": 987654.3,
                                     "longest_job": 9000.0, "longest_print": 8000.0},
                      "auxiliary_totals": [{"provider": "sensor secret_power", "field": "energy", "maximum": 1.0, "total": 2.0}]}}


def handler(disk_status=200, totals_status=200, totals=None):
    def h(req):
        assert req.method == "GET"
        if req.url.path == "/server/history/totals":
            assert req.url.query == b""
            return httpx.Response(totals_status, json=totals or TOTALS)
        if req.url.path == "/server/files/directory":
            assert req.url.query == b"path=logs"
            return httpx.Response(disk_status, json={"result": {"files": [{"filename": "secret.log"}], "disk_usage": {"total": 104857600, "used": 99614720, "free": 5242880}}})
        if req.url.path == "/server/history/list":
            assert req.url.query == b"limit=20&order=desc"
            return httpx.Response(200, json={"result": {"jobs": [{"filename": "secret.gcode", "user": "secret_user", "status": "interrupted",
                                                                  "print_duration": 120.0, "metadata": {"uuid": "secret-uuid"}}]}})
        if req.url.path == "/server/gcode_store":
            assert req.url.query == b"count=100"
            return httpx.Response(200, json={"result": {"gcode_store": [{"message": "!! Lost communication with MCU 'e0'"}, {"message": "// secret ok"}]}})
        return {"/server/info": httpx.Response(200, json={"result": {"klippy_state": "ready", "hostname": "secret-host"}}),
                "/printer/info": httpx.Response(200, json={"result": {"state": "ready"}}),
                "/printer/objects/list": httpx.Response(200, json={"result": {"objects": ["toolhead"]}})}[req.url.path]
    return h


def _client(disk_status=200, drop=False, monkeypatch=None, **hk):
    if monkeypatch:
        monkeypatch.setattr(live, "PROBE_GAP_S", 0.0)
    app = create_app(":memory:")
    conns = []

    def connect():
        conns.append(Conn(_frames(), drop=drop))
        return conns[-1]

    app.state.live_hooks = {"http_transport": httpx.MockTransport(handler(disk_status, **hk)), "connect": connect}
    c = TestClient(app, headers=APP)
    c.conns, c.app_ = conns, app
    return c


def _post(c, host=HOST, **over):
    return c.post("/api/v1/live/capture", json={"host": host, "consent": True, "seconds": 3, **over})


def test_capture_runs_the_new_rules_and_stays_within_the_budget():
    c = _client()
    r = _post(c)
    assert r.status_code == 200, r.text
    j = r.json()
    assert [a["tag"] for a in j["audit"]["http"]] == ["server.info", "printer.info", "printer.objects.list", "server.files.directory", "server.history.totals", "server.history.list", "server.gcode_store"]
    assert j["audit"]["read_operations"] == 8 and j["audit"]["non_read_operations"] == 0 and j["budget"] == {"max_get": 13, "max_ws_sent": 1}
    (sent,) = c.conns[0].sent
    assert set(json.loads(sent)["params"]["objects"]) == set(ALLOWED_SUBSCRIBE_OBJECTS)
    rules = {f["rule_id"] for f in j["findings"]}
    assert {"U1-S17-OFFSET-Y-SPREAD", "U1-S18-SENSOR-IMPLAUSIBLE", "U1-S21-CLOCK-RESET", "U1-S22-LOG-PARTITION", "U1-S24-BED-MESH-STATS"} <= rules
    conn = j["connectivity"]
    assert conn["ws_drops"] == 0 and conn["ws_reconnects"] == 0 and conn["ip_changed"] is None and len(conn["requests"]) == live.BASE_GET
    assert all(isinstance(x["ms"], float) for x in conn["requests"]) and conn["max_ms"] >= conn["median_ms"]
    assert "connectivity_check" in [o["event_type"] for o in j["observations"]]
    assert HOST not in r.text and "secret" not in r.text
    ids = [o["observation_id"] for o in j["observations"]]
    assert len(ids) == len(set(ids))


def test_ip_change_is_detected_from_a_fingerprint_never_from_a_stored_address():
    c = _client()
    assert _post(c).json()["connectivity"]["ip_changed"] is None
    assert _post(c).json()["connectivity"]["ip_changed"] is False
    assert _post(c, host=HOST2).json()["connectivity"]["ip_changed"] is True
    rows = c.app_.state.db.execute("SELECT key, value_json FROM app_settings").fetchall()
    dump = json.dumps([tuple(r) for r in rows])
    assert HOST not in dump and HOST2 not in dump and "live_target_fp_last" in dump


def test_refused_target_does_not_overwrite_the_last_fingerprint():
    c = _client()
    _post(c)
    assert _post(c, host="8.8.8.8").status_code == 422
    assert _post(c).json()["connectivity"]["ip_changed"] is False


def test_connectivity_is_exported_in_the_bundle_without_the_address():
    import io
    import zipfile
    c = _client()
    sid = _post(c).json()["session"]["id"]
    blob = c.post("/api/v1/bundles/export", json={"source": f"history:{sid}"}).content
    z = zipfile.ZipFile(io.BytesIO(blob))
    obs = [json.loads(x) for x in z.read("observations.jsonl").decode("utf-8").splitlines()]
    net = [o for o in obs if o["event_type"] == "connectivity_check"]
    assert len(net) == 1 and net[0]["value"]["ws_reconnects"] == 0
    assert HOST not in json.dumps(obs) and HOST not in blob.decode("latin-1")


def test_dropped_stream_counts_one_drop_and_stays_at_most_max_get(monkeypatch):
    j = _post(_client(drop=True, monkeypatch=monkeypatch)).json()
    assert j["connectivity"]["ws_drops"] == 1 and j["connectivity"]["ws_reconnects"] == 0
    assert len(j["audit"]["http"]) == live.MAX_GET and all(a["method"] == "GET" for a in j["audit"]["http"])


def test_disk_read_failure_keeps_the_capture_and_says_not_observable():
    j = _post(_client(disk_status=404)).json()
    s22 = [f for f in j["findings"] if f["rule_id"] == "U1-S22-LOG-PARTITION"]
    assert [f["classification"] for f in s22] == ["INCONCLUSIVE"] and "not observable" in s22[0]["human_title"]
    assert j["audit"]["http"][3]["status"] == 404


def test_gcode_nozzle_is_imported_and_compared():
    j = _post(_client(), gcode_nozzle_mm=[0.6, 0.6]).json()
    g = [o for o in j["observations"] if o["event_type"] == "gcode_nozzle_diameter"]
    assert len(g) == 1 and g[0]["source_status"] == "IMPORTED" and g[0]["source_kind"] == "IMPORT" and g[0]["value"] == {"mm": [0.6]}
    assert any("0.6 mm is not reported" in f["human_title"] for f in j["findings"])


@pytest.mark.parametrize("bad", [[0.0], [5.0], [-0.4], [0.4] * 17])
def test_gcode_nozzle_values_are_bounded(bad):
    assert _post(_client(), gcode_nozzle_mm=bad).status_code == 422


def test_compatibility_marks_what_ran_on_the_real_u1_and_what_did_not():
    caps = {c["name"]: c["status"] for c in _client().get("/api/v1/compatibility").json()["capabilities"]}
    # one supervised read-only capture on the owner's U1 (2026-11-08) proved these
    for n in ("Log partition usage read", "Cavity sensor and bed mesh subscription", "Live rules S22-S24", "Connectivity self-check"):
        assert caps[n] == "TESTED_REAL"
    # quiet on a healthy print, positive case never seen on a real printer
    assert caps["Live rules S17-S21"] == "UNTESTED"
    # BACKLOG #65: the totals read ran on the real U1 (2026-11-08, HTTP 200, 21 jobs); the reminders screen never ran on a real result
    assert caps["Job history totals read"] == "TESTED_REAL" and caps["Maintenance reminders"] == "UNTESTED"


def test_synthetic_live_fixtures_validate_against_the_schema():
    for n in ("positive", "normal", "absent"):
        for line in (ROOT / f"fixtures/synthetic/synthetic_live_rules_{n}.observations.jsonl").read_text(encoding="utf-8").splitlines():
            o = json.loads(line)
            OBS_SCHEMA.validate(o)
            validate_observation(copy.deepcopy(o))
            assert o["source_status"] == "SYNTHETIC" and "synthetic" in o["observation_id"]


# ---- BACKLOG #65: job-history totals for the local maintenance reminders ------------------------------------------
def test_history_totals_keep_only_four_fields_and_become_one_observation():
    j = _post(_client()).json()
    (o,) = [o for o in j["observations"] if o["event_type"] == "history_totals"]
    assert o["value"] == {"total_jobs": 42, "total_print_time": 324000.0, "total_filament_used": 987654.3, "total_time": 360000.0}
    assert o["source_ref"] == "server.history.totals" and o["source_status"] == "REAL" and o["entity_id"] == "printer"
    OBS_SCHEMA.validate(o)
    validate_observation(copy.deepcopy(o))
    mi = j["maintenance_inputs"]
    assert mi["history_totals"] == o["value"] and mi["history_status"] == 200
    assert mi["switch_count"] == {"per_object": {"extruder": 10, "extruder1": 6}, "total": 16}
    text = json.dumps(j)
    assert "longest" not in text and "auxiliary" not in text and "secret" not in text
    assert "history_totals" not in COVERAGE_KEYS  # no rule reads it: no "not observable" finding is added


@pytest.mark.parametrize("status,body", [(404, None), (503, None),
                                         (200, {"result": {"job_totals": {"total_jobs": -1, "total_time": 1, "total_print_time": 1, "total_filament_used": 1}}}),
                                         (200, {"result": {"job_totals": {"total_jobs": 1, "total_time": "x", "total_print_time": 1, "total_filament_used": 1}}}),
                                         (200, {"result": {"job_totals": {"total_jobs": True, "total_time": 1, "total_print_time": 1, "total_filament_used": 1}}}),
                                         (200, {"result": {"no_totals": {}}})])
def test_history_totals_failure_keeps_the_capture_and_says_not_observable(status, body):
    r = _post(_client(totals_status=status, totals=body))
    assert r.status_code == 200
    j = r.json()
    assert j["maintenance_inputs"]["history_totals"] is None and j["maintenance_inputs"]["history_status"] == status
    assert "history_totals" not in [o["event_type"] for o in j["observations"]]
    assert "server.history.totals" in [a["tag"] for a in j["audit"]["http"]] and len(j["audit"]["http"]) == live.BASE_GET


def test_switch_count_is_absent_when_the_firmware_reports_none():
    assert live._switch_counts([]) is None
    assert live._switch_counts([{"event_type": "extruder_activity", "value": {"extruders": {"extruder": {"state_changes": 0}}}}]) is None


def test_live_facts_emits_history_totals_before_the_coverage_record():
    tot = {"total_jobs": 1, "total_print_time": 3600.0, "total_filament_used": 10.0, "total_time": 3700.0, "t": "2026-01-20T10:00:00Z"}
    types = [o["event_type"] for o in live_facts(_frames(), start=1, totals=tot)]
    assert types[-2:] == ["history_totals", "live_coverage"]
    assert [o["event_type"] for o in live_facts([], start=1, totals=tot)] == ["history_totals"]


def test_live_capture_emits_job_history_and_console_errors_without_names():
    j = _post(_client()).json()
    (jh,) = [o for o in j["observations"] if o["event_type"] == "job_history"]
    (ce,) = [o for o in j["observations"] if o["event_type"] == "console_errors"]
    assert jh["value"]["by_status"] == {"interrupted": 1} and jh["source_ref"] == "server.history.list"
    assert ce["value"] == {"read": 2, "lines": ["!! Lost communication with MCU 'e0'"]}
    assert "secret" not in json.dumps(j["observations"])
    assert [a["tag"] for a in j["audit"]["http"]][-2:] == ["server.history.list", "server.gcode_store"] and len(j["audit"]["http"]) == live.BASE_GET
    assert all(not v for v in [validate_observation(o) for o in (jh, ce)])
