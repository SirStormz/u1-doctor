"""Immutable allowlist policy for the read-only Moonraker transport.

Pure functions, no I/O. Every check is exact-match (method AND path AND
JSON-RPC method). Anything not listed is denied. See docs/adr/0002.
"""
from __future__ import annotations

import ipaddress
import json
import re
from types import MappingProxyType
from typing import Any

DEFAULT_PORT = 7125
MAX_WS_MESSAGE_BYTES = 16 * 1024
MAX_OBJECTS_PER_QUERY = 64

# (method, exact path) -> audit tag. Frozen. Only GET. /printer/objects/query (GET or POST) is
# deliberately absent: the app never uses it (BACKLOG #52 L3, ADR-0002 amendment).
ALLOWED_HTTP = MappingProxyType(
    {
        ("GET", "/server/info"): "server.info",
        ("GET", "/printer/info"): "printer.info",
        ("GET", "/printer/objects/list"): "printer.objects.list",
    }
)

# JSON-RPC methods allowed on /websocket. server.info / printer.info over WS
# are "option after audit" -> NOT allowed in G0.
ALLOWED_WS_METHODS = frozenset({"printer.objects.subscribe"})

_OBJECT_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_ .:\-]{0,63}$")
_FIELD_NAME = re.compile(r"^[A-Za-z0-9_]{1,64}$")


class PolicyViolation(Exception):
    """Raised BEFORE any I/O when a request is outside the allowlist."""


def check_http_request(method: str, target: str, body: bytes | None = None) -> str:
    """Return the audit tag if (method, target, body) is allowed, else raise.

    `target` must be the bare path: no scheme, host, query, fragment, dot
    segments, percent-escapes, backslashes or non-ASCII.
    """
    if not isinstance(method, str) or not isinstance(target, str):
        raise PolicyViolation("method/path must be str")
    if not target.isascii() or any(ord(c) < 0x21 or ord(c) == 0x7F for c in target):
        raise PolicyViolation("path contains control/space/non-ASCII characters")
    if any(c in target for c in ("?", "#", "%", "\\", ";", "@")) or "//" in target:
        raise PolicyViolation("path contains forbidden delimiter")
    tag = ALLOWED_HTTP.get((method, target))
    if tag is None:
        raise PolicyViolation(f"{method} {target!r} not in allowlist")
    if body:  # every allowed request is a GET
        raise PolicyViolation("GET must not carry a body")
    return tag


def _no_dup_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in pairs:
        if k in out:
            raise ValueError("duplicate key")
        out[k] = v
    return out


def _validate_objects_param(doc: Any) -> None:
    if not isinstance(doc, dict) or set(doc) != {"objects"}:
        raise PolicyViolation("body must be exactly {'objects': {...}}")
    objs = doc["objects"]
    if not isinstance(objs, dict) or not 0 < len(objs) <= MAX_OBJECTS_PER_QUERY:
        raise PolicyViolation("'objects' must be a non-empty bounded mapping")
    for name, fields in objs.items():
        if not _OBJECT_NAME.match(name):
            raise PolicyViolation(f"invalid object name {name!r}")
        if fields is None:
            continue
        if not isinstance(fields, list) or len(fields) > 128:
            raise PolicyViolation("fields must be null or a bounded list")
        if not all(isinstance(f, str) and _FIELD_NAME.match(f) for f in fields):
            raise PolicyViolation("invalid field name")


def check_ws_message(raw: str | bytes) -> str:
    """Validate an outbound WebSocket JSON-RPC frame. Returns the method."""
    if len(raw) > MAX_WS_MESSAGE_BYTES:
        raise PolicyViolation("WS frame too large")
    try:
        msg = json.loads(raw, object_pairs_hook=_no_dup_keys)
    except (ValueError, UnicodeDecodeError) as exc:
        raise PolicyViolation("WS frame is not valid JSON") from exc
    if not isinstance(msg, dict):  # rejects JSON-RPC batch arrays
        raise PolicyViolation("WS frame must be a single JSON object")
    if msg.get("jsonrpc") != "2.0":
        raise PolicyViolation("jsonrpc must be '2.0'")
    method = msg.get("method")
    if not isinstance(method, str) or method not in ALLOWED_WS_METHODS:
        raise PolicyViolation(f"WS method {method!r} not in allowlist")
    if set(msg) - {"jsonrpc", "method", "params", "id"}:
        raise PolicyViolation("unexpected WS keys")
    params = msg.get("params")
    if not isinstance(params, dict) or set(params) != {"objects"}:
        raise PolicyViolation("params must be exactly {'objects': {...}}")
    _validate_objects_param(params)
    mid = msg.get("id")
    if not isinstance(mid, int) or isinstance(mid, bool):
        raise PolicyViolation("id must be an integer")
    return method


def validate_target_host(host: str, port: int = DEFAULT_PORT) -> str:
    """Accept only a literal private IPv4 address (RFC1918) on the audited port.

    Hostnames, IPv6, loopback, link-local, public, multicast, userinfo, URLs
    are refused. A literal IP means no DNS resolution -> no rebinding window.
    """
    if port != DEFAULT_PORT:
        raise PolicyViolation("port not audited (only 7125 in G0)")
    if not isinstance(host, str) or not host.isascii() or host != host.strip():
        raise PolicyViolation("host must be a bare ASCII IP literal")
    try:
        ip = ipaddress.IPv4Address(host)
    except ValueError as exc:
        raise PolicyViolation("host must be a literal IPv4 address") from exc
    if str(ip) != host:  # rejects leading zeros / alternate notations
        raise PolicyViolation("non-canonical IPv4 notation")
    rfc1918 = (
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
    )
    if not any(ip in net for net in rfc1918):
        raise PolicyViolation("host is not in an RFC1918 private range")
    return host
