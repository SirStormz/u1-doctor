"""ReadOnlyMoonrakerTransport.

There is NO public generic request method. Each public method maps to exactly
one allowlisted operation. The policy runs before any I/O. A real network
client can only be built with an owner-approved Consent (see ADR-0002).
G0: only tests construct it, with httpx.MockTransport. No U1 contact.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

from .policy import (
    DEFAULT_PORT,
    PolicyViolation,
    check_http_request,
    validate_target_host,
)

MAX_RESPONSE_BYTES = 2 * 1024 * 1024


@dataclass(frozen=True)
class Consent:
    """Explicit, per-target owner approval for live reads."""

    approved_by_owner: bool
    target_host: str
    scope: str  # e.g. "H-01"


@dataclass
class AuditEntry:
    method: str
    path: str
    tag: str | None
    allowed: bool
    status: int | None = None


class TransportError(Exception):
    pass


class ReadOnlyMoonrakerTransport:
    def __init__(
        self,
        host: str,
        *,
        consent: Consent,
        http_transport: httpx.BaseTransport | None = None,
        timeout_s: float = 5.0,
    ) -> None:
        self._host = validate_target_host(host, DEFAULT_PORT)
        if http_transport is None and not (
            consent.approved_by_owner and consent.target_host == self._host
        ):
            raise PolicyViolation("real network access requires owner Consent for this host")
        self.audit: list[AuditEntry] = []
        self._client = httpx.Client(
            base_url=f"http://{self._host}:{DEFAULT_PORT}",
            transport=http_transport,
            trust_env=False,  # ignore HTTP(S)_PROXY / netrc / env certs
            follow_redirects=False,
            timeout=timeout_s,
            limits=httpx.Limits(max_connections=2, max_keepalive_connections=1),
            headers={"User-Agent": "U1-Doctor/0 (read-only)"},
        )

    # --- the only three operations (all GET) --------------------------
    def get_server_info(self) -> dict[str, Any]:
        return self._send("GET", "/server/info")

    def get_printer_info(self) -> dict[str, Any]:
        return self._send("GET", "/printer/info")

    def list_objects(self) -> dict[str, Any]:
        return self._send("GET", "/printer/objects/list")

    # --- internals ----------------------------------------------------
    def _send(self, method: str, path: str, body: bytes | None = None) -> dict[str, Any]:
        try:
            tag = check_http_request(method, path, body)
        except PolicyViolation:
            self.audit.append(AuditEntry(method, path, None, False))
            raise
        entry = AuditEntry(method, path, tag, True)
        self.audit.append(entry)
        headers = {"Content-Type": "application/json"} if body else None
        with self._client.stream(method, path, content=body, headers=headers) as resp:
            entry.status = resp.status_code
            if 300 <= resp.status_code < 400:
                raise TransportError("redirect refused")
            if resp.status_code in (401, 403):
                raise TransportError(f"authentication required ({resp.status_code})")
            if resp.status_code != 200:
                raise TransportError(f"unexpected status {resp.status_code}")
            data = bytearray()
            for chunk in resp.iter_bytes():
                data += chunk
                if len(data) > MAX_RESPONSE_BYTES:
                    raise TransportError("response too large")
        try:
            doc = json.loads(bytes(data))
        except ValueError as exc:
            raise TransportError("response is not JSON") from exc
        if not isinstance(doc, dict):
            raise TransportError("response is not a JSON object")
        return doc

    def close(self) -> None:
        self._client.close()
