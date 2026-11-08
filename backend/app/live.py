"""Owner-triggered live capture from the UI (BACKLOG #3, #8, #57, #59, #65). Read-only, bounded, on explicit consent.

Sends 5 GET requests (/server/info, /printer/info, /printer/objects/list, /server/files/directory?path=logs,
/server/history/totals) and one WebSocket `printer.objects.subscribe` message to one RFC1918 address on port 7125,
then listens for a few seconds. If the stream drops early, it probes with up to PROBES x 2 = 6 more read-only status
GET (/server/info, /printer/info): MAX_GET = 11 GET and MAX_WS_SENT = 1 WebSocket message at most, never more (the consent text in the
UI states these numbers and a test keeps them equal). Nothing else can be sent: the only senders are the allowlisted
methods of `app.transport`. The stream is never reopened (0 reconnects by design). The WebSocket client sends no
keepalive pings; it only answers the peer at protocol level (pong to a ping, the closing handshake). The result keeps
derived facts only; the address, host names and file names are never returned, stored or logged (the API keeps a
keyed fingerprint of the address to tell "same address as last time", never the address). Raw frames stay in memory
and are dropped when the call ends.
"""
from __future__ import annotations

import json
import math
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import httpx

from .capture import _obs, frames_to_observations, live_facts
from .transport import Consent, PolicyViolation, ReadOnlyMoonrakerTransport, ReadOnlyMoonrakerWebSocket
from .transport.readonly import TransportError

MIN_SECONDS = 3
MAX_SECONDS = 60
MAX_FRAMES = 5000
PROBES = 3
PROBE_GAP_S = 3.0
BASE_GET = 5  # server.info, printer.info, printer.objects.list, server.files.directory (logs disk usage), server.history.totals
MAX_GET = BASE_GET + PROBES * 2  # 11: the consent text must state this maximum (tests/test_live_rules.py)
# The only job-history fields kept (BACKLOG #65); everything else in the reply (longest_job, auxiliary_totals...) is dropped unread.
TOTALS_FIELDS = ("total_jobs", "total_print_time", "total_filament_used", "total_time")
MAX_WS_SENT = 1
# Added to the H-02 subscribe set for BACKLOG #57 (both listed by the real U1, never subscribed to: UNTESTED).
EXTRA_OBJECTS: dict[str, list[str] | None] = {"temperature_sensor cavity": ["temperature"], "bed_mesh": ["probed_matrix"]}


class LiveError(Exception):
    """A failure that is safe to show: `code` is stable, `message` never holds the address."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _result(doc: dict[str, Any]) -> dict[str, Any]:
    r = doc.get("result")
    return r if isinstance(r, dict) else {}


def _disk(doc: dict[str, Any], t: str) -> dict[str, Any] | None:
    """Keep the three disk numbers of the reply, drop everything else (file names) unread."""
    du = _result(doc).get("disk_usage")
    if not isinstance(du, dict):
        return None
    vals = {k: du.get(k) for k in ("total", "used", "free")}
    if not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in vals.values()):
        return None
    return {"root": "logs", "total_bytes": vals["total"], "used_bytes": vals["used"], "free_bytes": vals["free"], "t": t}


def _totals(doc: dict[str, Any], t: str) -> dict[str, Any] | None:
    """Keep the four job totals of `result.job_totals`, drop everything else unread. None unless all four are valid:
    `total_jobs` a non-negative integer, the three others non-negative finite numbers (seconds, seconds, mm)."""
    jt = _result(doc).get("job_totals")
    if not isinstance(jt, dict):
        return None
    vals = {k: jt.get(k) for k in TOTALS_FIELDS}
    if not (isinstance(vals["total_jobs"], int) and not isinstance(vals["total_jobs"], bool) and vals["total_jobs"] >= 0):
        return None
    for k in TOTALS_FIELDS[1:]:
        v = vals[k]
        if not isinstance(v, int | float) or isinstance(v, bool) or not math.isfinite(v) or v < 0:
            return None
        vals[k] = round(float(v), 1)
    return {**vals, "t": t}


def _switch_counts(observations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Last `switch_count` per extruder object, as the firmware reports it (read by the same subscribe as rule S23).
    What the firmware counts there is not documented officially; the numbers are passed on as they are, with their sum."""
    act = next((o["value"] for o in observations if o["event_type"] == "extruder_activity"), None)
    per = {n: v["switch_count"][1] for n, v in ((act or {}).get("extruders") or {}).items()
           if isinstance(v, dict) and isinstance(v.get("switch_count"), list) and len(v["switch_count"]) == 2}
    return {"per_object": dict(sorted(per.items())), "total": sum(per.values())} if per else None


def _audit_rows(tr: ReadOnlyMoonrakerTransport) -> list[dict[str, Any]]:
    return [{"method": a.method, "path": a.path, "query": a.query, "tag": a.tag, "allowed": a.allowed, "status": a.status, "ms": a.ms} for a in tr.audit]


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def run_live_capture(host: str, *, seconds: int, http_transport: httpx.BaseTransport | None = None,
                     connect: Callable[[], Any] | None = None, ip_changed: bool | None = None,
                     gcode_nozzle_mm: list[float] | None = None) -> dict[str, Any]:
    """Run the capture. Raises LiveError. `http_transport` and `connect` are test hooks only.

    `ip_changed` (computed by the API from a keyed fingerprint, never from a stored address) and `gcode_nozzle_mm`
    (distinct diameters of a G-code analysed in the app, IMPORTED) are carried into the observations as given.
    """
    from .h02 import OBJECTS  # lazy: h02 imports app.api for APP_VERSION

    seconds = max(MIN_SECONDS, min(MAX_SECONDS, int(seconds)))
    consent = Consent(approved_by_owner=True, target_host=host, scope="LIVE")
    try:
        tr = ReadOnlyMoonrakerTransport(host, consent=consent, http_transport=http_transport)
    except PolicyViolation as e:
        raise LiveError("REFUSED_TARGET", "only a private IPv4 address (10.x, 172.16-31.x, 192.168.x) is accepted") from e
    try:
        try:
            server, printer, objects = tr.get_server_info(), tr.get_printer_info(), tr.list_objects()
        except (TransportError, httpx.HTTPError, OSError) as e:
            raise LiveError("UNREACHABLE", "the printer did not answer on port 7125 (check power, network and address)") from e
        except PolicyViolation as e:  # pragma: no cover - the three requests are fixed and allowlisted
            raise LiveError("REFUSED_REQUEST", "request refused by the read-only policy") from e
        disk_t = _now()
        try:  # optional: a printer without a `logs` root (or an error) only makes rule S22 say "not observable"
            disk = _disk(tr.get_logs_disk_usage(), disk_t)
        except (TransportError, httpx.HTTPError, OSError):
            disk = None
        try:  # optional: history component off (404) or an error only makes the reminders say "not observable"
            totals = _totals(tr.get_history_totals(), _now())
        except (TransportError, httpx.HTTPError, OSError):
            totals = None
        http_audit = _audit_rows(tr)
    finally:
        tr.close()

    s, p = _result(server), _result(printer)
    names = _result(objects).get("objects")
    object_count = len(names) if isinstance(names, list) else 0

    try:
        ws = ReadOnlyMoonrakerWebSocket(host, consent=consent, connect=connect)
    except PolicyViolation as e:  # pragma: no cover - same host already validated above
        raise LiveError("REFUSED_TARGET", "target refused by the read-only policy") from e
    except Exception as e:  # noqa: BLE001 - websockets raises its own exception family; the message below hides details
        raise LiveError("WS_UNREACHABLE", "the live stream could not be opened") from e
    lines: list[str] = []
    dropped_at: str | None = None
    started = datetime.now(UTC)
    t0 = time.monotonic()
    try:
        ws.subscribe(OBJECTS | EXTRA_OBJECTS)
        while time.monotonic() - t0 < seconds and len(lines) < MAX_FRAMES:
            for fr in ws.frames(max_frames=50, duration_s=min(1.0, seconds - (time.monotonic() - t0))):
                lines.append(json.dumps({"t": fr.received_utc, "frame": fr.payload}))
    except TransportError as e:  # bad frame or size cap: unreadable data, not a dropped link
        raise LiveError("STREAM_FAILED", "the live stream sent something unreadable") from e
    except Exception:  # noqa: BLE001 - connection closed or reset by the peer: a dropped link, probed below
        dropped_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    finally:
        audit_ws = list(ws.audit)
        ws.close()

    observations = frames_to_observations(lines)
    observations += live_facts(lines, start=len(observations) + 1, disk=disk, totals=totals)
    if gcode_nozzle_mm:
        at = observations[-1]["capture_utc"] if observations else disk_t
        observations.append(_obs(len(observations) + 1, at, "gcode_nozzle_diameter", {"mm": sorted({round(float(x), 3) for x in gcode_nozzle_mm})},
                                 entity="printer", mq="VERIFIED", ref="gcode/nozzle_diameter") | {"source_kind": "IMPORT", "source_status": "IMPORTED"})
    tag = started.strftime("%Y%m%dT%H%M%SZ")
    for o in observations:  # unique ids per capture; never labelled as the old H-02 run
        o["session_id"] = f"live_{tag}"
        o["observation_id"] = o["observation_id"].replace("real_h02_", f"live_{tag}_", 1)

    if dropped_at:  # S04: the stream closed early; ask Klipper over HTTP (same two allowlisted GETs) whether it still answers
        observations.append(_obs(len(observations) + 1, dropped_at, "connection_lost", {"after_s": round(time.monotonic() - t0, 1)},
                                 entity="printer", mq="VERIFIED", ref="transport/lost") | {"validity": "UNAVAILABLE"})
        probe_tr = ReadOnlyMoonrakerTransport(host, consent=consent, http_transport=http_transport)
        try:
            for i in range(PROBES):
                if i:
                    time.sleep(PROBE_GAP_S)
                at, ok, ks = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ"), False, "UNKNOWN"
                try:
                    ks, ok = str(_result(probe_tr.get_server_info()).get("klippy_state", "UNKNOWN")), True
                    probe_tr.get_printer_info()
                except (TransportError, httpx.HTTPError, OSError):
                    ok = False
                observations.append(_obs(len(observations) + 1, at, "link_probe", {"http_ok": ok, "klippy_state": ks},
                                         entity="printer", mq="VERIFIED", ref="transport/probe"))
            http_audit += _audit_rows(probe_tr)
        finally:
            probe_tr.close()
        for i, o in enumerate(observations[-(PROBES + 1):], start=1):
            o["session_id"] = f"live_{tag}"
            o["observation_id"] = f"live_{tag}_drop{i:02d}"

    reads = len(http_audit) + sum(1 for a in audit_ws if a.get("method") == "printer.objects.subscribe")
    non_read = sum(1 for a in http_audit if a["method"] != "GET") + sum(1 for a in audit_ws if a.get("method") != "printer.objects.subscribe")
    if non_read or len(http_audit) > MAX_GET or len(audit_ws) > MAX_WS_SENT:  # pragma: no cover - fixed senders; tripwire
        raise RuntimeError("operation outside the documented budget recorded: STOP")
    timed = sorted(a["ms"] for a in http_audit if isinstance(a["ms"], int | float))
    conn = {
        "requests": [{"op": a["tag"], "ms": a["ms"], "status": a["status"]} for a in http_audit],
        "ws_drops": 1 if dropped_at else 0, "ws_reconnects": 0, "ws_frames_received": len(lines), "ip_changed": ip_changed,
        "max_ms": timed[-1] if timed else None, "median_ms": timed[len(timed) // 2] if timed else None,
    }
    observations.append(_obs(len(observations) + 1, _now(), "connectivity_check", conn, entity="printer", mq="VERIFIED", ref="transport/selfcheck")
                        | {"session_id": f"live_{tag}", "observation_id": f"live_{tag}_net01"})
    return {
        "captured_utc": started.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "duration_s": round(time.monotonic() - t0, 1),
        "printer": {
            "moonraker_version": s.get("moonraker_version", "UNKNOWN"),
            "api_version": s.get("api_version_string", "UNKNOWN"),
            "klippy_state": s.get("klippy_state", "UNKNOWN"),
            "klipper_software_version": p.get("software_version", "UNKNOWN"),
            "printer_state": p.get("state", "UNKNOWN"),
            "object_count": object_count,
        },
        "audit": {"http": http_audit, "websocket_frames_sent": len(audit_ws), "read_operations": reads, "non_read_operations": non_read},
        "inbound_frames": len(lines),
        "stream_dropped": dropped_at is not None,
        "connectivity": conn,
        "budget": {"max_get": MAX_GET, "max_ws_sent": MAX_WS_SENT},
        # Inputs of the local maintenance reminders (BACKLOG #65); None = not observable in this capture. No judgement here:
        # the reminders are computed in the app from these numbers and the owner's own intervals.
        "maintenance_inputs": {
            "history_totals": {k: totals[k] for k in TOTALS_FIELDS} if totals else None,
            "history_status": next((a["status"] for a in http_audit if a["tag"] == "server.history.totals"), None),
            "switch_count": _switch_counts(observations),
        },
        "observations": observations,
    }
