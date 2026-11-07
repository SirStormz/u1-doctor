import json

import httpx
import pytest

from app.h01 import run_h01

HOST = "192.168.50.20"


def handler(req: httpx.Request) -> httpx.Response:
    assert req.method == "GET"
    return {
        "/server/info": httpx.Response(200, json={"result": {"moonraker_version": "v0.9", "klippy_state": "ready", "components": ["b", "a"], "hostname": "secret"}}),
        "/printer/info": httpx.Response(200, json={"result": {"state": "ready", "software_version": "v1", "hostname": "secret"}}),
        "/printer/objects/list": httpx.Response(200, json={"result": {"objects": ["toolhead", "extruder"]}}),
    }[req.url.path]


def test_requires_idle_confirmation(tmp_path):
    with pytest.raises(PermissionError):
        run_h01(HOST, tmp_path / "e", tmp_path / "r", machine_idle_confirmed=False, http_transport=httpx.MockTransport(handler))


def test_three_gets_manifest_without_ip_or_hostname(tmp_path):
    m = run_h01(HOST, tmp_path / "e", tmp_path / "r", machine_idle_confirmed=True, http_transport=httpx.MockTransport(handler))
    assert m["operation_count"] == 3 and m["non_read_operations"] == 0
    assert m["observed"]["object_names"] == ["extruder", "toolhead"]
    text = (tmp_path / "e" / "manifest.json").read_text(encoding="utf-8")
    assert HOST not in text and "secret" not in text
    assert json.loads(text)["observed"]["klippy_state"] == "ready"


def test_refuses_public_host(tmp_path):
    from app.transport import PolicyViolation

    with pytest.raises(PolicyViolation):
        run_h01("8.8.8.8", tmp_path / "e", tmp_path / "r", machine_idle_confirmed=True, http_transport=httpx.MockTransport(handler))
