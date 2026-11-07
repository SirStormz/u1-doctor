# A finding, end to end (SYNTHETIC example)

> **SYNTHETIC / DEMO.** Every observation below is fabricated by `scripts/make_scenarios.py` for the demo scenario `demo_extrusion_blockage`. Nothing here was captured from a real U1, and no real failure has been captured yet (see [LIMITS.md](LIMITS.md)).

This page shows what U1 Doctor produces for one incident, and why each finding says what it says and no more. Each finding lists evidence **for**, evidence **against**, what is **missing**, its **limits**, and the official reference. It carries no score and no percentage.

Reproduce it: in the app open the demo scenario `demo_extrusion_blockage` (Findings screen), or run the engine over `fixtures/synthetic/synthetic_demo_extrusion_blockage.observations.jsonl` with `rulesets/u1-starter/ruleset.json`. The result is byte-identical to `synthetic_demo_extrusion_blockage.findings.json`; the `replay_hash` of each finding below is checked by a test.

## The observations (16)

- `synthetic_demo_extrusion_blockage_001` · 14:09:12 UTC · `state_transition` · {"state": "printing"} · entity `printer` (mapping VERIFIED)
- `synthetic_demo_extrusion_blockage_002` · 14:09:30 UTC · `temperature_sample` · {"celsius": 219.6} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_010` · 14:09:30 UTC · `bed_temperature_sample` · {"celsius": 60.1} · entity `printer` (mapping VERIFIED)
- `synthetic_demo_extrusion_blockage_013` · 14:09:40 UTC · `temperature_sample` · {"celsius": 220.3} · entity `unmapped` (mapping UNKNOWN)
- `synthetic_demo_extrusion_blockage_003` · 14:10:00 UTC · `temperature_sample` · {"celsius": 220.1} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_004` · 14:10:30 UTC · `temperature_sample` · {"celsius": 219.8} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_005` · 14:11:00 UTC · `temperature_sample` · {"celsius": 220.0} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_011` · 14:11:00 UTC · `bed_temperature_sample` · {"celsius": 60.0} · entity `printer` (mapping VERIFIED)
- `synthetic_demo_extrusion_blockage_006` · 14:11:30 UTC · `temperature_sample` · {"celsius": 219.9} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_007` · 14:12:00 UTC · `temperature_sample` · {"celsius": 220.2} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_014` · 14:12:30 UTC · `capture_gap` · {"end": "2026-01-13T14:13:30Z", "start": "2026-01-13T14:12:00Z"} · entity `printer` (mapping VERIFIED)
- `synthetic_demo_extrusion_blockage_008` · 14:13:30 UTC · `temperature_sample` · {"celsius": 218.4} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_009` · 14:14:00 UTC · `temperature_sample` · {"celsius": 214.7} · entity `toolhead_3` (mapping INFERRED)
- `synthetic_demo_extrusion_blockage_012` · 14:14:00 UTC · `bed_temperature_sample` · {"celsius": 59.9} · entity `printer` (mapping VERIFIED)
- `synthetic_demo_extrusion_blockage_015` · 14:14:12 UTC · `state_transition` · {"state": "paused"} · entity `printer` (mapping VERIFIED)
- `synthetic_demo_extrusion_blockage_016` · 14:14:20 UTC · `user_reported_error_code` · {"code": "0002-0525-0002-0004"} · entity `toolhead_3` (mapping INFERRED)

## The findings (4)

### Code reported: Extrusion blockage at toolhead 3 drive gear (warning, filament feeder)

- **Rule:** `U1-S01-CODE-DECODE` v1.0.0 · **Classification:** OBSERVED · **Evidence quality:** WEAK · **Not a root cause:** yes
- **Source mix:** SYNTHETIC · **Firmware scope:** UNKNOWN

**Evidence for**

- Code declared by the user. → `synthetic_demo_extrusion_blockage_016` · 14:14:20 UTC · `user_reported_error_code` · {"code": "0002-0525-0002-0004"} · entity `toolhead_3` (mapping INFERRED)

**Evidence against**

- none recorded

**Hypotheses** (labelled by origin, never presented as a diagnosis)

- `OFFICIAL_REFERENCE`: Filament extrusion blocked at the drive gear of toolhead 3. Official guidance: check and clean, then retry.

**Missing data**

- No live machine state verified.

**Limits**

- The displayed code may not represent the actual fault source (official wiki note).
- Code declared by the user; not verified from the machine.

**Safe actions** (advice only; U1 Doctor never commands the printer)

- Follow the linked official procedure; do not bypass safety interlocks.

**References**

- OFFICIAL_WIKI: https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/u1_error_codes (checked 2026-11-05)

`replay_hash` sha256:41a111a0fb76a3f83318c81c6753de04f81b94b78e7718688743f3efe3421950

### Print state changed: printing -> paused

- **Rule:** `U1-S03-STATE-TRANSITION` v1.0.0 · **Classification:** OBSERVED · **Evidence quality:** WEAK · **Not a root cause:** yes
- **Source mix:** SYNTHETIC · **Firmware scope:** UNKNOWN

**Evidence for**

- Observed state 'printing'. → `synthetic_demo_extrusion_blockage_001` · 14:09:12 UTC · `state_transition` · {"state": "printing"} · entity `printer` (mapping VERIFIED)
- Observed state 'paused'. → `synthetic_demo_extrusion_blockage_015` · 14:14:12 UTC · `state_transition` · {"state": "paused"} · entity `printer` (mapping VERIFIED)
- Close in time to the transition: correlation only, not causation. → `synthetic_demo_extrusion_blockage_016` · 14:14:20 UTC · `user_reported_error_code` · {"code": "0002-0525-0002-0004"} · entity `toolhead_3` (mapping INFERRED)

**Evidence against**

- none recorded

**Missing data**

- Cause of the transition is not determined by this fact.

**Limits**

- A state change is a fact, not a diagnosis.
- Timestamps are receipt time only; ordering within the capture window is trusted, exact delay is not.

**Safe actions** (advice only; U1 Doctor never commands the printer)

- Check the printer screen and follow the official procedure for any displayed code.

**References**

- OFFICIAL_WIKI: https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/u1_error_codes (checked 2026-11-05)

`replay_hash` sha256:0d8548ad64a369f6758d4db30c02fde61559d853837f14879e66e176edaa8a35

### Per-toolhead attribution unavailable (mapping unknown)

- **Rule:** `U1-S09-MAPPING-UNKNOWN` v1.0.0 · **Classification:** INCONCLUSIVE · **Evidence quality:** UNKNOWN · **Not a root cause:** yes
- **Source mix:** SYNTHETIC · **Firmware scope:** UNKNOWN

**Evidence for**

- Value cannot be attributed to a toolhead. → `synthetic_demo_extrusion_blockage_013` · 14:09:40 UTC · `temperature_sample` · {"celsius": 220.3} · entity `unmapped` (mapping UNKNOWN)

**Evidence against**

- none recorded

**Missing data**

- Verified mapping from the observed object to toolhead 1-4.

**Limits**

- Toolhead mapping must be proven (H-04) before per-toolhead statements.

**Safe actions** (advice only; U1 Doctor never commands the printer)

- No action: do not read these values as belonging to a specific toolhead.

`replay_hash` sha256:ca06598c5512ed21b610d3d61440fb73ecbfea74df44ab0c5203d44924c41480

### Observation incomplete: absence of data is not evidence of absence

- **Rule:** `U1-S10-OBSERVATION-GAPS` v1.0.0 · **Classification:** INCONCLUSIVE · **Evidence quality:** UNKNOWN · **Not a root cause:** yes
- **Source mix:** SYNTHETIC · **Firmware scope:** UNKNOWN

**Evidence for**

- capture_gap / validity FRESH → `synthetic_demo_extrusion_blockage_014` · 14:12:30 UTC · `capture_gap` · {"end": "2026-01-13T14:13:30Z", "start": "2026-01-13T14:12:00Z"} · entity `printer` (mapping VERIFIED)

**Evidence against**

- none recorded

**Missing data**

- Data for the affected window.

**Limits**

- A lost or timed-out connection does not mean the printer stopped or failed.

**Safe actions** (advice only; U1 Doctor never commands the printer)

- Do not infer the machine state from the loss of connection; check the printer itself.

`replay_hash` sha256:32288173355f066296b5ba24e6d49f60b45e3dd4ce7595ae20c99cb09d4e2fae

## What to take from it

- The code finding repeats what the official table says about the code, labelled `OFFICIAL_REFERENCE`, and states that the displayed code may not be the real fault source.
- The state-change finding is a fact (the print went from printing to paused), not a diagnosis; a declared code close in time is listed as correlation only.
- Where the tool cannot attribute a value to a toolhead (mapping H-04 is unproven) or the data has holes, it says INCONCLUSIVE instead of guessing.

