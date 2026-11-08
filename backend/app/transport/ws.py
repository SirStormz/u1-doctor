"""ReadOnlyMoonrakerWebSocket: one allowlisted outbound frame type, inbound capped.

The only public way to send is `subscribe()`, which runs `check_ws_message` before any
I/O. There is no generic `send`. Inbound frames are parsed and size-capped, never
answered. Real network needs an owner Consent for the exact host (ADR-0002).
"""
from __future__ import annotations

import json
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from .policy import DEFAULT_PORT, MAX_WS_MESSAGE_BYTES, PolicyViolation, check_ws_message, validate_target_host
from .readonly import Consent, TransportError

MAX_INBOUND_BYTES = 256 * 1024


class _Conn(Protocol):
    def send(self, message: str) -> None: ...
    def recv(self, timeout: float | None = None) -> str | bytes: ...
    def close(self) -> None: ...


@dataclass(frozen=True)
class Frame:
    received_utc: str
    payload: dict[str, Any]


def _real_connect(host: str, timeout_s: float) -> _Conn:
    from websockets.sync.client import connect  # imported lazily: only real runs need it

    return connect(  # type: ignore[return-value]
        f"ws://{host}:{DEFAULT_PORT}/websocket",
        proxy=None,  # ignore HTTP(S)_PROXY from the environment
        compression=None,
        ping_interval=None,  # no keepalive pings: after the subscribe message the client only answers the peer (pong, close)
        ping_timeout=None,
        max_size=MAX_INBOUND_BYTES,
        open_timeout=timeout_s,
        additional_headers={"User-Agent": "U1-Doctor/0 (read-only)"},
    )


class ReadOnlyMoonrakerWebSocket:
    def __init__(self, host: str, *, consent: Consent, connect: Callable[[], _Conn] | None = None, timeout_s: float = 5.0) -> None:
        self._host = validate_target_host(host, DEFAULT_PORT)
        if connect is None and not (consent.approved_by_owner and consent.target_host == self._host):
            raise PolicyViolation("real network access requires owner Consent for this host")
        self.audit: list[dict[str, Any]] = []
        self._next_id = 1
        self._conn: _Conn = connect() if connect is not None else _real_connect(self._host, timeout_s)

    def subscribe(self, objects: dict[str, list[str] | None]) -> int:
        """Send the single allowed frame. Returns the JSON-RPC id used."""
        rid = self._next_id
        raw = json.dumps({"jsonrpc": "2.0", "method": "printer.objects.subscribe", "params": {"objects": objects}, "id": rid}, separators=(",", ":"))
        try:
            method = check_ws_message(raw)
        except PolicyViolation:
            self.audit.append({"method": None, "allowed": False})
            raise
        self.audit.append({"method": method, "allowed": True})
        self._next_id += 1
        self._conn.send(raw)
        return rid

    def frames(self, *, max_frames: int, duration_s: float) -> Iterator[Frame]:
        """Yield inbound JSON objects until max_frames or duration_s. Never replies."""
        end, n = time.monotonic() + duration_s, 0
        while n < max_frames and (left := end - time.monotonic()) > 0:
            try:
                raw = self._conn.recv(timeout=min(left, 1.0))
            except TimeoutError:
                continue
            if len(raw) > MAX_INBOUND_BYTES or len(raw) > 16 * MAX_WS_MESSAGE_BYTES:
                raise TransportError("inbound frame too large")
            try:
                doc = json.loads(raw)
            except ValueError as exc:
                raise TransportError("inbound frame is not JSON") from exc
            if not isinstance(doc, dict):
                raise TransportError("inbound frame is not a JSON object")
            n += 1
            yield Frame(datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ"), doc)

    def close(self) -> None:
        self._conn.close()
