# Snapmaker wiki findings for U1 Doctor — read 2026-11-06

Method: public wiki pages only, fetched like a browser (173 of 185 English U1 pages; 12 answer 403 and were left alone). The page-content GraphQL call is refused to anonymous visitors and was **not** worked around. Raw text stays in `private/` (git-ignored); this file and `knowledge/u1_codes.json` hold our own wording plus links. Statements below are facts read on the pages unless marked *(inferred)*.

## 1. Error codes (page `snapmaker_u1/troubleshooting/u1_error_codes`)
- 413 distinct codes in the reference table (not 429: that figure counted the level and module tables). 324 rows link to an article (184 wiki pages, 140 to one official video).
- Levels: 0001 notice, 0002 warning (print paused, resumable), 0003 error (print stopped). Severity does not predict whether the dialog blocks: some 0003 codes are dismissible, a 0001 pogo-pin code shows up after the print.
- The wiki itself warns: the displayed code may not be the real fault source, and some states are still being refined (keep firmware current).
- **The third group is not uniform** (checked on every row text):
  - 0523, 0525: 0..3 = toolhead / feeder 1..4.
  - 0522: 0 host MCU, 1 mainboard MCU, 2..5 toolheads 1..4, 100 = no toolhead; **but the `-0017` series is shifted by one** (0 mainboard, 1..4 toolheads).
  - 0528 (homing) and some 0530 rows: the index is an **axis** (0/1/2 = X/Y/Z), not a toolhead.
  - Rule used in the catalog: the row text wins; the module-index convention is used only when the text names no unit (`mapping` = `MODULE_INDEX_RULE` instead of `ROW_TEXT`).
- Pick / park / swap rows name which toolheads to check (e.g. "head 4 picking failed: check heads 1 and 2") or say "check all one by one": kept as `inspect_toolheads` + `inspect_scope` on 148 codes; the named heads are not always the failing one.
- Same issue code for two meanings is possible: `0003-0522-xxxx-0016` covers "MCU control timed out" and the "timer too close" article (a communication timeout, not a scheduling bug *(wiki wording)*).
- Doc inconsistencies to keep in mind: the hub-board page cites codes the table does not define (e.g. `0003-0528-0000-0027`); `0003-0523-0000-0006` is called a temperature fault on one page while the table says the G-code names an unknown toolhead; a few neighbour lists are copy-pasted.

## 2. Logs and support
- **Official logs are encrypted**: the exported archive cannot be read locally; only Snapmaker support can open it. U1 Doctor therefore offers what the owner cannot get otherwise: owner-readable, shareable evidence.
- Export paths (official article `snapmaker_u1/troubleshooting/U1_export_log`, linked from the ticket-ready summary): touchscreen Settings > About > System Log > to USB (FAT32/EXT2/EXT4, ≤ 64 GB) or, from firmware 1.1.1, to the Fluidd `logs` folder. AI-monitoring photos can be included.
- Support asks for: the code, photos/video, the G-code used, and logs for axis/calibration/MCU-timeout cases; for pick/park it sends a test G-code (100 cycles) to be filmed. First-layer issues: photo, firmware version, print file, whether bed leveling was on.
- Support ticket form lives on the official site (not copied here).

## 3. Network and software stack
- Fluidd is opened with the printer IP (Settings > Wi-Fi). Firmware is a custom Klipper + Moonraker + Fluidd stack, open-sourced 2026-03-30 (u1-klipper, u1-moonraker, u1-fluidd).
- The wiki documents **no** Moonraker API, ports, hostnames or mDNS; all of that comes from the source repositories.
- "Static IP" page = router-side DHCP reservation; printers look offline when the IP changes. Root/SSH access exists since firmware 1.2.0 (opt-in).
- Pick-and-park coordinates are stored in `extruder_config.json`; editing needs Advanced Mode. Toolheads 1–4 map to Klipper sections `extruder`, `extruder1..3` *(from one page's commands)*.

## 4. Firmware timeline that changes diagnosis
| Version (date) | Relevant change |
|---|---|
| 0.9.0 (2025-11-06) / 0.9.4 | cloud/QR fixes; tangle-detection sensitivity; fewer Klipper shutdowns on abnormal moves; min active nozzle 170 °C |
| 1.0.0 (2025-12-31) | AI monitoring (spaghetti, foreign objects); homing calibration |
| 1.1.0 | QR codes on error pages; Z motor current raised (0.7 → 0.85 A); shutdown if start G-code lacks a layer count fixed |
| 1.1.1 | log export to Fluidd folder; bed flatness detection |
| 1.2.0 | Skip Objects; Ethernet; root access; bed-0 °C G-code reminder |
| 1.3.0 | nozzle diameters 0.2/0.4/0.6/0.8; mixed-diameter rules |
| 1.4.0 | fewer "MCU control timeout" errors; up to 64 skippable objects |
| 1.5.0 – 1.5.2 | Top Cover; fewer "timer too close"; first-layer squish regression fixed in 1.5.2; false nozzle-mismatch warnings fixed |
| 2.0.0 (2026-09-15) | high-flow nozzle support; G-code names starting with `#` could shut the system down (fixed) |
| 2.1.0 (2026-11-04) | speed levels 50/75/100/125/150; "Firmware incompatible" prompt for bad USB firmware |
Consequence: a finding about MCU timeouts or "timer too close" should state the firmware version when known.

## 5. Numbers worth citing (wiki values)
- Nozzle max 300 °C; extrusion needs > 170 °C; parked heads idle ≈ 70 °C; hotend fan on at ≈ 140 °C *(one page says 60 °C: pages disagree)*; bed limit 105 °C (smooth PEI) / 80 °C (textured) in one guide, max 100 °C in another.
- Pogo pins rated 250,000 swaps per toolhead, swapper 1,000,000; cleaning reminder every 100,000 swaps (code `0001-0523-0000-0037`).
- Copper-plate-to-sensor gap 0.1–0.4 mm; hotend height 48 ± 0.2 mm; Z-offset default −0.05 in cfg, firmware applies −0.07 on both plates *(pages differ)*.
- Hub board test points 24 V; ceramic heater 10.5–13 Ω; bed NTC 80–120 kΩ at 25 °C.
- Maintenance: belts/rods monthly, lead screw quarterly, pogo pins every 4–6 months, PEI wash every 5–10 prints.
- Homing order Y, then X, then Z. Bed mesh RANGE < 0.5 mm normal, > 0.8 mm needs manual leveling.

## 6. Print-quality guides (symptom → causes)
Most pages are "Cause 1..N" lists with no error codes or telemetry names. What a **passive** tool could support or contradict: bed mesh range, bed/nozzle temperature versus the material table, nozzle diameter versus G-code, auto-refill readiness (firmware ≥ 1.5.2), TPU/ABS/PETG plate pre-flight, G-code header sanity (retraction, layer height, flow ratio, pressure advance). Moisture, residue, pits, gloss, wrinkles need the owner's eyes: show a "needs your eyes" badge, never a guess.

## 7. Surprises
- Bypassing a faulty thermistor (documented workaround) disables protection on that toolhead; a tool must warn, never advise it silently.
- Several documented fixes are command sends (e.g. `FILAMENT_DT_UPDATE`, `QUERY_POWER_LOSS_CHECK_INFO`): U1 Doctor must only **advise** them (read-only guarantee).
- Over-tightened toolhead USB screws cause two separate failures (damaged housing, broken sensor cable).
- Whether the U1 has a chamber sensor is unclear; the ABS ≥ 60 °C ambient advice needs a user-declared enclosure.

## 8. What this feeds
Catalog 0.2.0 (413 codes, article links, axis and toolhead mapping with provenance) · positioning: encrypted vendor logs vs owner-readable bundles.
