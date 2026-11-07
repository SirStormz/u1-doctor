"""Owner-triggered live capture from the UI (BACKLOG #3 and #8). Read-only, bounded, on explicit consent.

Sends at most 3 GET requests and one WebSocket `printer.objects.subscribe` frame to one RFC1918 address on
port 7125, then listens for a few seconds. Nothing else can be sent: the only senders are the allowlisted
methods of `app.transport`. The result keeps derived facts only; the address, host names and file names are
never returned, stored or logged. Raw frames stay in memory and are dropped when the call ends.
"""
from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import httpx

from .capture import _obs, frames_to_observations
from .transport import Consent, PolicyViolation, ReadOnlyMoonrakerTransport, ReadOnlyMoonrakerWebSocket
from .transport.readonly import TransportError

MIN_SECONDS = 3
MAX_SECONDS = 60
MAX_FRAMES = 5000
PROBES = 3
PROBE_GAP_S = 3.0


class LiveError(Exception):
    """A failure that is safe to show: `code` is stable, `message` never holds the address."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _result(doc: dict[str, Any]) -> dict[str, Any]:
    r = doc.get("result")
    return r if isinstance(r, dict) else {}


def run_live_capture(host: str, *, seconds: int, http_transport: httpx.BaseTransport | None = None,
                     connect: Callable[[], Any] | None = None) -> dict[str, Any]:
    """Run the capture. Raises LiveError. `http_transport` and `connect` are test hooks only."""
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
        http_audit = [{"method": a.method, "path": a.path, "allowed": a.allowed, "status": a.status} for a in tr.audit]
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
        ws.subscribe(OBJECTS)
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
            http_audit += [{"method": a.method, "path": a.path, "allowed": a.allowed, "status": a.status} for a in probe_tr.audit]
        finally:
            probe_tr.close()
        for i, o in enumerate(observations[-(PROBES + 1):], start=1):
            o["session_id"] = f"live_{tag}"
            o["observation_id"] = f"live_{tag}_drop{i:02d}"

    reads = len(http_audit) + sum(1 for a in audit_ws if a.get("method") == "printer.objects.subscribe")
    non_read = sum(1 for a in http_audit if a["method"] != "GET") + sum(1 for a in audit_ws if a.get("method") != "printer.objects.subscribe")
    if non_read:  # pragma: no cover - cannot happen with the fixed senders, kept as a tripwire
        raise RuntimeError("non-read operation recorded: STOP")
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
        "observations": observations,
    }
