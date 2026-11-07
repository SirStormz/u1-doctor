"""Print the SHA-256 of the canonical findings of every shipped fixture, one line each (sorted).

CI runs this on Linux, Windows and macOS and diffs the outputs: the replay must give the same bytes everywhere (T-025).
Usage (from the repo root): python scripts/replay_hashes.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.engine import canon, evaluate  # noqa: E402
from app.engine.canonical import ruleset_hash, sha256_hex  # noqa: E402


def main() -> int:
    sys.stdout.reconfigure(newline=chr(10))  # Windows would print CRLF and the cross-OS diff would flag every line
    rs = json.loads((ROOT / "rulesets" / "u1-starter" / "ruleset.json").read_text(encoding="utf-8"))
    print(f"ruleset {ruleset_hash(rs)}")
    for path in sorted((ROOT / "fixtures").glob("*/*.observations.jsonl")):
        obs = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        out = canon(evaluate(obs, rs)) + b"\n"
        print(f"{path.parent.name}/{path.name.removesuffix('.observations.jsonl')} {sha256_hex(out)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
