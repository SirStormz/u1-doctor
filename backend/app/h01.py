"""H-01 passive read-only field protocol (cahier §16.4). Three GET requests only.

Raw responses go to a git-ignored private directory (they may hold hostnames or
paths). The committed manifest keeps an allowlist of derived fields and never the IP.
"""
from __future__ import annotations

import hashlib
import json
import platform
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from .api import APP_VERSION
from .transport import Consent, ReadOnlyMoonrakerTransport


def _sha(doc: Any) -> str:
    return hashlib.sha256(json.dumps(doc, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _git_sha() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=5, check=False).stdout.strip() or "UNKNOWN"
    except (OSError, subprocess.SubprocessError):
        return "UNKNOWN"


def run_h01(host: str, evidence_dir: Path, raw_dir: Path, *, machine_idle_confirmed: bool, http_transport: httpx.BaseTransport | None = None) -> dict[str, Any]:
    if not machine_idle_confirmed:
        raise PermissionError("owner must confirm the machine is idle before H-01")
    consent = Consent(approved_by_owner=True, target_host=host, scope="H-01")
    tr = ReadOnlyMoonrakerTransport(host, consent=consent, http_transport=http_transport)
    try:
        server = tr.get_server_info()
        printer = tr.get_printer_info()
        objects = tr.list_objects()
        audit = [{"method": a.method, "path": a.path, "tag": a.tag, "allowed": a.allowed, "status": a.status} for a in tr.audit]
    finally:
        tr.close()
    if not all(a["allowed"] for a in audit) or any(a["method"] != "GET" for a in audit):
        raise RuntimeError("non-read operation recorded: STOP")
    s = server.get("result", {}) if isinstance(server.get("result"), dict) else {}
    p = printer.get("result", {}) if isinstance(printer.get("result"), dict) else {}
    names = sorted(objects.get("result", {}).get("objects", [])) if isinstance(objects.get("result"), dict) else []
    raw_dir.mkdir(parents=True, exist_ok=True)
    for n, d in (("server_info", server), ("printer_info", printer), ("objects_list", objects)):
        (raw_dir / f"{n}.json").write_text(json.dumps(d, indent=2, sort_keys=True), encoding="utf-8")
    manifest = {
        "test_id": "H-01",
        "date_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "app_version": APP_VERSION,
        "git_sha": _git_sha(),
        "os": f"{platform.system()} {platform.release()}",
        "target": "RFC1918 IPv4 literal :7125 (redacted)",
        "operations": audit,
        "operation_count": len(audit),
        "non_read_operations": 0,
        "observed": {
            "moonraker_version": s.get("moonraker_version", "UNKNOWN"),
            "api_version": s.get("api_version_string", "UNKNOWN"),
            "klippy_state": s.get("klippy_state", "UNKNOWN"),
            "klippy_connected": s.get("klippy_connected", "UNKNOWN"),
            "components": sorted(s.get("components", [])) if isinstance(s.get("components"), list) else "UNKNOWN",
            "klipper_software_version": p.get("software_version", "UNKNOWN"),
            "printer_state": p.get("state", "UNKNOWN"),
            "object_count": len(names),
            "object_names": names,
        },
        "raw_sha256": {"server_info": _sha(server), "printer_info": _sha(printer), "objects_list": _sha(objects)},
        "human_approval": "owner go + machine idle confirmed in chat",
    }
    evidence_dir.mkdir(parents=True, exist_ok=True)
    (evidence_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest


if __name__ == "__main__":  # pragma: no cover - manual field run
    import argparse

    ap = argparse.ArgumentParser(description="H-01 passive read-only run (3 GET requests)")
    ap.add_argument("host")
    ap.add_argument("--machine-idle", action="store_true", help="I confirm the printer is idle")
    a = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    m = run_h01(a.host, root / "docs" / "evidence" / "H-01", root / "private" / "H-01-raw", machine_idle_confirmed=a.machine_idle)
    print(json.dumps(m["observed"], indent=2))
