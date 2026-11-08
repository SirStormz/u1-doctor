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
        ("GET", "/server/files/directory"): "server.files.directory",
    }
)

# (method, exact path) -> {query key: frozen set of exact allowed values}. A path listed here REQUIRES exactly these
# keys with one of these values; every other allowed path takes no query at all. Only the disk usage of the `logs`
# root is read (BACKLOG #57, ADR-0002 amendment 2026-11-08): the file names in the reply are dropped unread.
ALLOWED_HTTP_QUERY = MappingProxyType(
    {
        ("GET", "/server/files/directory"): MappingProxyType({"path": frozenset({"logs"})}),
    }
)

# Objects the single subscribe frame may name (exact match). Klipper simply leaves out an object a printer does not
# have. `temperature_sensor cavity` and `bed_mesh` were added for BACKLOG #57: listed by the real U1 (H-01 object
# list) but never subscribed to on one, so every rule using them is UNTESTED.
ALLOWED_SUBSCRIBE_OBJECTS = frozenset({
    "print_stats", "machine_state_manager", "exception_manager", "webhooks", "pause_resume", "idle_timeout",
    "virtual_sdcard", "print_task_config", "toolhead", "heater_bed", "extruder", "extruder1", "extruder2", "extruder3",
    "heater_fan e0_nozzle_fan", "heater_fan e1_nozzle_fan", "heater_fan e2_nozzle_fan", "heater_fan e3_nozzle_fan",
    "temperature_sensor cavity", "bed_mesh",
})
_QUERY_TEXT = re.compile(r"^[a-z_]{1,32}$")

# JSON-RPC methods allowed on /websocket. server.info / printer.info over WS
# are "option after audit" -> NOT allowed in G0.
ALLOWED_WS_METHODS = frozenset({"printer.objects.subscribe"})

_OBJECT_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_ .:\-]{0,63}$")
_FIELD_NAME = re.compile(r"^[A-Za-z0-9_]{1,64}$")


class PolicyViolation(Exception):
    """Raised BEFORE any I/O when a request is outside the allowlist."""


def check_http_request(method: str, target: str, body: bytes | None = None, query: dict[str, str] | None = None) -> str:
    """Return the audit tag if (method, target, body, query) is allowed, else raise.

    `target` must be the bare path: no scheme, host, query, fragment, dot
    segments, percent-escapes, backslashes or non-ASCII. A query is passed apart in `query` and must
    match ALLOWED_HTTP_QUERY exactly (same keys, allowed values); paths not listed there take none.
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
    _check_query(method, target, query)
    return tag


def _check_query(method: str, target: str, query: dict[str, str] | None) -> None:
    spec = ALLOWED_HTTP_QUERY.get((method, target))
    if spec is None:
        if query:
            raise PolicyViolation(f"{method} {target!r} takes no query")
        return
    if not isinstance(query, dict) or set(query) != set(spec):
        raise PolicyViolation("query keys must match the allowlist exactly")
    for k, v in query.items():
        if not isinstance(v, str) or not _QUERY_TEXT.match(v) or v not in spec[k]:
            raise PolicyViolation(f"query value for {k!r} not in allowlist")


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
        if name not in ALLOWED_SUBSCRIBE_OBJECTS:
            raise PolicyViolation(f"object {name!r} not in the subscribe allowlist")
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
