from __future__ import annotations

import hashlib
import json
from typing import Any


def canon(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replay_hash(finding: dict[str, Any]) -> str:
    """Hash of the logical finding: excludes generated_at and replay_hash."""
    body = {k: v for k, v in finding.items() if k not in ("generated_at", "replay_hash")}
    return "sha256:" + sha256_hex(canon(body))


def ruleset_hash(ruleset: dict[str, Any]) -> str:
    return "sha256:" + sha256_hex(canon(ruleset))
