"""Regenerate everything that embeds the ruleset hash after a ruleset or evaluator change (a deliberate, reviewed act).

Run from the repository root: backend/.venv/Scripts/python.exe scripts/regen_hash_artifacts.py, then `npm run sample-report` in frontend/.
Updates: the synthetic goldens, the real-capture golden, the replay hashes quoted in docs/FINDING_EXAMPLE.md and the example U1-DEB bundle.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
PY = sys.executable
g = ROOT / "fixtures/synthetic/synthetic_demo_extrusion_blockage.findings.json"
old = json.loads(g.read_text(encoding="utf-8"))  # goldens as they are now (the hashes the doc and bundle carry)

subprocess.run([PY, str(ROOT / "scripts/make_scenarios.py")], check=True, cwd=ROOT, capture_output=True)
new = json.loads(g.read_text(encoding="utf-8"))

doc_p = ROOT / "docs/FINDING_EXAMPLE.md"
doc = doc_p.read_text(encoding="utf-8")
assert [f["rule_id"] for f in old] == [f["rule_id"] for f in new]
for a, b in zip(old, new):
    doc = doc.replace(a["replay_hash"], b["replay_hash"])
    doc = doc.replace(a["ruleset_hash"], b["ruleset_hash"])
doc_p.write_text(doc, encoding="utf-8", newline="\n")

from app.deb import export_bundle  # noqa: E402
from app.engine import canon, evaluate  # noqa: E402

rs = json.loads((ROOT / "rulesets/u1-starter/ruleset.json").read_text(encoding="utf-8"))
base = ROOT / "fixtures/real/real_h02_normal_print"
obs = [json.loads(x) for x in Path(str(base) + ".observations.jsonl").read_text(encoding="utf-8").splitlines()]
Path(str(base) + ".findings.json").write_bytes(canon(evaluate(obs, rs)) + b"\n")

import zipfile  # noqa: E402

zp = ROOT / "examples/u1-deb/example-synthetic-known-code-feeder3.u1deb.zip"
man = json.loads(zipfile.ZipFile(zp).read("manifest.json"))
o2 = [json.loads(x) for x in (ROOT / "fixtures/synthetic/synthetic_known_code_feeder3.observations.jsonl").read_text(encoding="utf-8").splitlines()]
zp.write_bytes(export_bundle(o2, rs, app_version=man["app_version"], firmware_claim=man["firmware_claim"], generated_at=man["generated_at"]))
print("regenerated; ruleset", rs["version"])
