import json

import pytest

from app.h02 import run_h02

HOST = "192.168.50.20"


class Conn:
    def __init__(self, frames):
        self.sent, self.frames = [], list(frames)

    def send(self, m):
        self.sent.append(m)

    def recv(self, timeout=None):
        if not self.frames:
            raise TimeoutError
        return json.dumps(self.frames.pop(0))

    def close(self):
        pass


def upd(state, **extra):
    return {"jsonrpc": "2.0", "method": "notify_status_update", "params": [{"print_stats": {"state": state, "filename": "secret_cube.gcode"}, **extra}, 1.0]}


def test_requires_owner_confirmation(tmp_path):
    with pytest.raises(PermissionError):
        run_h02(HOST, tmp_path / "e", tmp_path / "r", print_started_by_owner=False, max_seconds=1, connect=lambda: Conn([]))


def test_manifest_has_transitions_but_no_filename_or_ip(tmp_path):
    c = Conn([{"id": 1, "result": {"status": {"print_stats": {"state": "standby"}}}}, upd("printing"), upd("printing"), upd("complete", exception_manager={"x": 1})])
    m = run_h02(HOST, tmp_path / "e", tmp_path / "r", print_started_by_owner=True, max_seconds=5, linger_s=0.1, connect=lambda: c)
    assert [t["print_state"] for t in m["print_state_transitions"]] == ["standby", "printing", "complete"]
    assert m["outbound_non_subscribe"] == 0 and len(c.sent) == 1 and m["inbound_frames"] == 4
    assert m["exception_manager_updates"][0]["fields"] == ["x"]
    text = (tmp_path / "e" / "manifest.json").read_text(encoding="utf-8")
    assert "secret_cube" not in text and HOST not in text
    assert "secret_cube" in (tmp_path / "r" / "frames.jsonl").read_text(encoding="utf-8")
