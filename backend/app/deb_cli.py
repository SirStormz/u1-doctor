"""u1deb-validate: check a U1-DEB bundle offline. Stdlib only, no network, nothing executed.

Usage:  python -m app.deb_cli validate BUNDLE.zip [--json]
Exit codes: 0 valid, 1 refused (stable error code printed), 2 usage or unreadable file.
SHA-256 proves integrity only, never authenticity.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .deb import INTEGRITY_NOTICE, BundleError, import_bundle
from .paths import ROOT

RULESET_PATH = ROOT / "rulesets" / "u1-starter" / "ruleset.json"
MAX_READ = 50 * 1024 * 1024 + 1


def validate_file(path: Path) -> dict[str, Any]:
    """Return a result dict; raises BundleError when refused, OSError when unreadable."""
    with path.open("rb") as fh:
        data = fh.read(MAX_READ)
    ruleset = json.loads(RULESET_PATH.read_text(encoding="utf-8"))
    r = import_bundle(data, ruleset)
    return {
        "valid": True,
        "format_version": r["format_version"],
        "origin_source_mix": r["origin_source_mix"],
        "observation_count": r["observation_count"],
        "bundle_sha256": r["bundle_sha256"],
        "ruleset_same_as_local": r["ruleset"]["same_as_local"],
        "replay_performed": r["replay"]["performed"],
        "replay_matches_bundle": r["replay"]["matches_bundle"],
        "integrity_notice": INTEGRITY_NOTICE,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="u1deb-validate", description="Validate a U1-DEB v1 bundle (offline).")
    sub = p.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate", help="validate a bundle zip")
    v.add_argument("bundle", type=Path)
    v.add_argument("--json", action="store_true", help="machine-readable output")
    args = p.parse_args(argv)

    try:
        res = validate_file(args.bundle)
    except BundleError as e:
        out = {"valid": False, "code": e.code, "message": str(e)}
        print(json.dumps(out, sort_keys=True) if args.json else f"REFUSED [{e.code}] {e}")
        return 1
    except OSError as e:
        print(f"cannot read {args.bundle}: {e.strerror or e}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(res, sort_keys=True))
    else:
        rep = res["replay_matches_bundle"]
        replay = "not performed (different ruleset)" if not res["replay_performed"] else ("matches the bundle" if rep else "DIFFERS from the bundle")
        origin = ",".join(res["origin_source_mix"])
        print(f"VALID U1-DEB {res['format_version']} | {res['observation_count']} observations | origin {origin}")
        print(f"sha256 {res['bundle_sha256']}")
        print(f"replay: {replay}")
        print(res["integrity_notice"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
