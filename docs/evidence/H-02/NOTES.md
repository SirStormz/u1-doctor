# H-02 — passive monitoring of a normal print (2026-11-05)

Owner started a cube print, owner gave the go in chat. U1 Doctor sent **one** frame (`printer.objects.subscribe`) and only listened. No incident was provoked, no command sent (`manifest.json`: `outbound_non_subscribe = 0`).

| Fact (TESTED_REAL) | Value |
|---|---|
| Window | 20:29:22Z → 20:56:47Z, 1675 s of listening |
| Inbound frames | 9 333, largest silence between two frames 0.74 s (no drop) |
| `print_stats.state` | `printing` → `complete`, no error |
| `exception_manager` | exists as a subscribable object; field `exceptions` is a **list, empty** during a clean print |
| `machine_state_manager` | fields `main_state`, `action_code`; `action_code` changes during the print (values seen: 0, 2, 134, 136, 321, …), meaning **not decoded** |
| `print_task_config` | 26 fields (filament/extruder config) — head mapping not yet established |

What this does **not** prove: that `exception_manager.exceptions` carries error codes when a fault happens (needs a real incident; never provoke one), the meaning of `action_code`, the T1–T4 mapping (H-04).

Raw frames (contain the print file name) stay in `private/H-02-raw/` (git-ignored). The manifest holds no file name and no IP.

## Real replay fixture
`fixtures/real/real_h02_normal_print.*` (50 REAL observations: 2 state changes, 13 `machine_action_code` changes, temperatures every 60 s) built by `python -m app.capture` from the private raw frames; replayed through the ruleset: identical findings, order-independent (`backend/tests/test_real_h02.py`). A clean print yields exactly one finding, `U1-S09-MAPPING-UNKNOWN` (inconclusive): the engine makes no fault claim. The `machine_action_code` event type has no rule yet.

## Action codes: what the machine data suggests (INFERRED, not verified)

Source: the same capture, no new access. State carried forward per frame at each `machine_state_manager.action_code` change. The job requested `auto_bed_leveling = true` and `flow_calibrate = true` at 20:29:22 (both back to `false` only at 20:56:47, end of print: they do not show when a step finished). Only `extruder1` (the second head, index 1) was used (`extruders_used = [F, T, F, F]`).

| UTC | Code | What the data shows | Reading (INFERRED) |
|---|---|---|---|
| 20:29:36 | 136 | bed 42→65 °C, `extruder1` held at 140 °C, Z axis becomes homed (`xy`→`xyz`) | start-up: preheat and homing |
| 20:30:39 | 321 | bed stable at 65 °C, Z no longer homed, `extruder1` climbs 140→168 °C, XY moves to the rear | a preparation step; candidate: calibration requested by the job. Not identified |
| 20:34:11 | 134 | `extruder1` target 220 °C reached, then target lowered to 130 °C, XY at the rear edge | nozzle heat then cool-down before contact moves; candidate: nozzle clean/purge |
| 20:35:39 | 2 | nozzle at 130 °C, Z lowered to 3 mm | contact/probe approach. Not identified |
| 20:36:54 → 20:43:17 | 257, 258, 256 | nozzle at 130 °C, positions (135,135) Z 10, (15,15) Z 5, (3,3) Z 2 mm | probing across the bed; candidate: bed leveling (the job asked for it). Ends with `extruder1` target back to 220 °C: printing temperature |

Not proven: the official name of any code, which step is calibration vs leveling, why Z homing is lost during 321. A code seen once cannot be named from one run; confirm with a second capture (a print with calibration disabled would isolate 321/257-258-256) or with official documentation. The UI keeps these codes **undecoded** on purpose.
