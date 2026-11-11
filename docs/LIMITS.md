# Limits and uncovered cases

What U1 Doctor cannot know or has not yet proven. Each item cites the document it comes from. If a limit is not listed here, do not assume it is covered.

## Hardware evidence

| Limit | Source |
|---|---|
| Real captures are normal prints only: a 27-minute print (firmware 2.1.0, 9,333 frames, shipped as a fixture) and a 55-minute multi-colour print (18,339 frames, derived evidence in `docs/evidence/H-06`). **No real failure has been captured**, so every incident in the app is `SYNTHETIC`. | `README.md`, `IMPLEMENTATION_STATUS.md` (REQ-017), `docs/ORIGINALITY_AUDIT.md` |
| Machine calls made so far: read-only GET requests (including the objects list; `POST /printer/objects/query` never ran and is no longer allowed) and one WebSocket subscribe, in supervised sessions (H-01, H-02, H-05, H-06) and one capture from the UI; 0 non-read operations in every audit log. Nothing else was ever tested on hardware, and no real connection drop with a Klipper stop was seen. | `IMPLEMENTATION_STATUS.md`, `docs/evidence/H-01/manifest.json` |
| **No proof of the T1-T4 to PTFE-path mapping (H-04).** The 3D view's four markers are labelled UNMAPPED; mapping from Klipper objects stays `unmapped`. | `docs/design/3D_MODEL.md`, `docs/compatibility.md` |
| The print-quality assistant compares only numbers you type, or the highest temperature of a saved session, with windows the wiki states. It reads no slicer profile, no G-code retraction, no chamber temperature, and the wiki's Build Plate Guide (full plate and filament matrix) was not read. Most causes stay "needs your eyes". | `knowledge/u1_symptoms.json`, `docs/wiki-findings.md` §6 |
| In-app live capture (Diagnose screen) has been run once, on an idle U1. It has not been run during a fault, and no real connection drop with a Klipper stop was seen. | `BACKLOG.md` #3, `IMPLEMENTATION_STATUS.md` (REQ-014) |
| Compatibility with other firmware versions (for example 2.0.0) is untested. Hardware capabilities beyond H-01/H-02 remain `UNVERIFIED_ON_HARDWARE`. | `docs/compatibility.md` |
| Whether HTTP authentication is enforced on a real U1 is not verified. | `docs/source-audit.md` section 6 |

## Live detection of error codes

| Limit | Source |
|---|---|
| Codes flagged `oneshot` in the firmware may be absent from the `exception_manager` object, so a live poll can miss transient codes. Live detection is uncertain; plan B is manual code entry plus replay. | `docs/source-audit.md`, `docs/G0_GO_NOGO.md`, `BACKLOG.md` |
| How the firmware rebroadcasts errors over WebSocket was read in source but never observed. | `docs/compatibility.md` |
| The official wiki warns that the displayed code may not be the real fault. The decoder reports what the code says, not a diagnosis. | `docs/wiki-findings.md` section 1 |

## Catalogue

| Limit | Source |
|---|---|
| The 413-code catalogue is derived from the public wiki table (read 2026-11-06), paraphrased with links. It follows the wiki's accuracy and age. | `docs/wiki-findings.md` |
| The wiki is inconsistent in places: the toolhead/axis index is not uniform across codes (the row text wins), and some pages cite codes the table does not define. | `docs/wiki-findings.md` section 1 |
| The "inspect these toolheads" hints come from wiki wording; the named heads are not always the failing one. | `docs/wiki-findings.md` section 1 |
| Twelve wiki pages answered 403 and were not read; the page-content API was refused to anonymous visitors and was not worked around. | `docs/wiki-findings.md` |
| Firmware-dependent facts need the firmware version; a finding about MCU timeouts should state it when known. | `docs/wiki-findings.md` section 4 |
| "Reported by the community" causes come from public forum topics (read 2026-11-08): one or a few owners each, often on an older firmware, rewritten in our words. They are not official, not observed by U1 Doctor, never ranked, and can be outdated. Three of their codes are not in the official table (`0001-0531-0000-0015`, `0003-0531-0000-0014`, `0003-0528-0000-0027`). | `knowledge/u1_community_causes.json` |
| "Did you mean" suggestions rank spellings only (edit distance on the digits); they say nothing about the fault, and nothing is decoded until the owner picks one. Messages without a code are matched by plain substrings on a curated list of 8; anything else stays unmatched. | `backend/app/knowledge/__init__.py`, `knowledge/u1_messages.json` |

## G-code pre-flight

20 static checks, never a simulation (U1 Dry Run simulates the firmware). Checks 1-10 rest on the official wiki and release notes. Checks 11-20 (#58) rest on public forum topics re-read on 2026-11-08 (one or a few owners each; labelled "reported by the community", never official) and only report what the file text shows. Macros hide commands; the installed nozzle, plate, toolhead offsets and firmware version are unknown here.

| Check | Detection rule | Limit | Source |
|---|---|---|---|
| `m191_chamber_wait` | any `M191` command → WARN | Owners reported (April 2026, before the Top Cover) that the U1 does not wait on M191; the 2.0.0 release note mentions chamber waiting with the Top Cover, so behaviour may differ | forum 41689, 41736 |
| `start_line_y_edge` | any absolute `G0`/`G1` whose Y is ≤ 1 mm → WARN, code `0003-0522-0001-0013` | The offsets are not in the file: it only fails on a head whose Y offset is below about -1 mm (one reported printer) | forum 44046 |
| `probe_temperature` | nozzle targets > 0 before the first extrusion; a lower one than the last is reported (INFO), never judged | A start macro (e.g. `START_PRINT`) may set its own temperature | forum 42422 |
| `tool_mapping` | `Tn` used beyond the slicer's filament list → WARN; several tools → INFO with the file's order | Filament Auto Mapping happens on the printer and cannot be predicted from the file | release note 1.0.0, forum 42496 |
| `foreign_profile` | `G4` ≥ 5 s within 30 lines of a `Tn`, Bambu-only `M620`-`M623`/`M1002`, a `printer_model` without "U1", or a Bambu Studio header → WARN | Heuristic: a deliberate dwell or a renamed profile is not distinguished | forum 43690 |
| `prime_tower_bounds` | extreme X/Y reached in prime-tower sections (`;TYPE:`/`; FEATURE:` prime/wipe tower, `; CP TOOLCHANGE` blocks), or `wipe_tower_x/y` + `prime_tower_width`, outside `printable_area` → WARN, code `0003-0522-0000-0013`; **skipped when `printable_area` is absent** | The tower depth is not in the settings, so the settings fallback checks only the tower origin in Y | staff post, forum 40862 |
| `colour_block` | several tools used and neither `extruder_colour` nor `filament_colour` → WARN | The link between these lines and auto-mapping comes from one owner's report | forum 42496 |
| `tpu_profile` | `filament_type` contains TPU → INFO with retraction length/speed and max volumetric speed found; no verdict | Values shown as written; `nil` falls back to the printer-wide value | forum 40952, 43560 |
| `purge_summary` | tool changes = consecutive `Tn` that differ; purge = filament extruded between `; CP TOOLCHANGE START` and `END` (mm, and mm³ only if `filament_diameter` is present); otherwise "not derivable" | Sparse tower layers and purges into infill or objects are not counted; nothing is estimated | U1 Doctor's own count |
| `last_move_scar` | after the last extrusion on the part, a tool-change marker, then the first XY travel > 1 mm at Z ≤ that layer + 0.1 mm → INFO with a check | Text only: it does not know whether the travel crosses the part (U1 Dry Run tracks that) | forum 43865 |

**3MF input.** A `.3mf` is accepted only to read the sliced G-code inside it (`Metadata/<name>.gcode`; **every** sliced plate is checked, at most 64, in the order plate_1, plate_2, …, then other names; the result has one entry per plate and the counts added up over all plates; a plate that is empty or not text is listed as not readable, the file is refused only when no plate is readable) and `Metadata/project_settings.config` (used only for keys the G-code lacks; per-plate lists use their first value). Nothing is sliced: a 3MF without G-code is refused with `NO_GCODE`. Zip safety: archive ≤ 50 MiB, each read entry ≤ 50 MiB, read entries ≤ 100 MiB in total **shared by all plates and the settings** (the declared sizes are summed and refused before anything is read, then the real sizes are checked again), more than 64 sliced plates refused with `UNSAFE_ENTRY`, compression ratio ≤ 200 (the U1-DEB import limits), at most 4096 entries, every entry name must be a safe relative path (no `..`, no absolute path), no encrypted entry, regular files only; other entries are never opened. Refusals: `NOT_A_3MF`, `UNSAFE_ENTRY`, `ENCRYPTED`, `ARCHIVE_TOO_LARGE`, `NO_GCODE`.

## Known issues per firmware version

| Limit | Source |
|---|---|
| 13 curated entries (1.0.0 to 2.1.0), re-read on 2026-11-08 and **possibly out of date**. Official entries come from the wiki release notes; the others come from the public forum or the u1-klipper repository and are labelled community reports, with "staff answered" only where a Snapmaker staff reply was seen. "Fixed in" is shown only when a source states it. Affected ranges list only versions where a source places the issue; two lower bounds are ours and say so (nozzle rules since 1.3.0, Top Cover since 1.5.0). The version filter uses the version you pick; it is never read from the printer. | `knowledge/u1_firmware_issues.json` |
| Not kept: a cold bed in one 2.1.0 report (cause unclear), the claim that the part-fan delay exists in every version (not reproduced), a 1.5.1 second-layer report (single), a 1.5.1 nozzle-mismatch error on an old file (not tied to the 1.5.2 fix), and the 1.0.0 Orca language issue (slicer, not firmware). | `knowledge/u1_firmware_issues.json` |

## Good-to-know notes

| Limit | Source |
|---|---|
| 3 static notes (camera not shown in Fluidd on stock firmware, Fluidd configuration files read-only until Advanced Mode is turned on under Maintenance, encrypted system log), each from public forum topics re-read on 2026-11-08 (40853, 43564, 42072; 41385; 40865) and labelled **community-reported, not official**. The log note also links the official export article. They may be out of date and are never read from your printer. The read-only answer came from an owner, on firmware 1.1.1; the Fluidd camera behaviour on 2.x (frozen picture, updates only while the Snapmaker app shows the camera) comes from a few owners. | `knowledge/u1_good_to_know.json` |
| Nothing was dropped: all three topics' claims were confirmed on re-reading. Not kept as advice: the custom firmware and third-party camera bridges named in those topics (U1 Doctor neither installs nor recommends them). | `knowledge/u1_good_to_know.json` |

## Replay and determinism

| Limit | Source |
|---|---|
| Replay hashes are identical on Linux, Windows and macOS in CI (every committed scenario: 1 real capture and 20 synthetic scenarios on 2026-11-08). They have not been checked on a user's own second machine. | `BACKLOG.md` #12, #17 |
| U1-DEB has been replayed by CI on three OS, not yet by an independent user. | `docs/OVERVIEW.md` |
| A SHA-256 on a bundle proves integrity only, never authorship or that data came from a real machine. | `docs/U1-DEB.md` |
| Imported bundles are replayed with the local ruleset; with a different ruleset hash no replay is done. Findings are always recomputed locally. | `docs/U1-DEB.md` |
| Export redaction is best effort and not a guarantee of anonymity. | `docs/U1-DEB.md` |

## Timeline and time

| Limit | Source |
|---|---|
| The timeline describes the observed window only. "No gap recorded" does not prove the data is complete. | `docs/OVERVIEW.md`, `IMPLEMENTATION_STATUS.md` |
| Timestamps are the PC's receipt time unless proven otherwise. The machine's `eventtime` is not UTC and is never read as such. | `docs/OVERVIEW.md`, `docs/G0_GO_NOGO.md` |
| A lost connection never means the printer stopped. | `docs/OVERVIEW.md` |

## Evaluators

| Limit | Source |
|---|---|
| **Thermal drift is deliberately not an evaluator**: without a target temperature, a rise cannot be told from pre-heating. | `BACKLOG.md` #6 |
| Evaluators are tested on synthetic scenarios and one real normal-print capture, not on real faults. | `IMPLEMENTATION_STATUS.md` (REQ-008) |
| Findings carry no score or percentage; they list evidence for, against, what is missing and limits. | `IMPLEMENTATION_STATUS.md` (REQ-009) |

## Imports, 3D view, packaging

| Limit | Source |
|---|---|
| A U1 Dry Run `report.json` import is a **prediction made before printing, not an observation**. It is labelled `IMPORTED`. Its findings (rule S15) are SUSPECTED and WEAK, and sessions are never merged, so a Dry Run report is never correlated with another session. | `BACKLOG.md` #1, `docs/source-audit.md` |
| Log files you import are **IMPORTED**, not observations: they may be old, partial or edited and each time is the clock written in the log (no time zone). Reading them proves nothing about the printer today. Only the owner's own U1 logs (firmware 2.1.0 and older, 11 machine exceptions) and one real Snapmaker Orca log were read: no Klipper shutdown line and no active live exception has been met, so rule S27 and live exceptions are UNTESTED. The on-screen code rebuilt from an exception was checked on 6 distinct codes of one printer. The printer's encrypted system log is recognized, never opened. | `docs/LOGS.md`, `docs/compatibility.md` |
| The 3D view is **illustrative**: slider moves are not machine coordinates, and it shows one visible toolhead only. | `docs/design/3D_MODEL.md` |
| The 3D model is the owner's own work, committed in the repository (`frontend/public/models/u1-jay.glb`) and bundled in the exe and the Docker image; it is a visual illustration, not official CAD, and shows the "snapmaker" wordmark. Since 2026-11-08 it is stored with lossless meshopt compression (4.3 MB instead of 7.5 MB; vertices, triangles, normals, UVs, nodes and materials checked identical after decoding); the decoder ships with three.js, so nothing is fetched from the internet. | `docs/design/3D_MODEL.md`, `scripts/build_windows.ps1` |
| The Windows executable is **unsigned**, so SmartScreen may warn; the SmartScreen prompt itself has not been tested. It was checked on a clean PC and scanned on VirusTotal (0/66 for v0.1.8-g1, 0/52 for v0.1.7-g1 and 0/67 for v0.1.6-g1). | `README.md`, `INSTALL.md`, `BACKLOG.md` #14 |
| Only a Windows executable is released (plus a Docker image and source); no macOS or Linux executable. Not audited: screen reader, 200 % zoom, widths under 1024 px. | `IMPLEMENTATION_STATUS.md` |
| Release build provenance: the release workflow pins its Python packages (`backend/constraints-release.txt`), pins every GitHub Action by commit SHA and attests the zip (`gh attestation verify`). These workflow changes were made on 2026-11-08 and ran successfully for `v0.1.8-g1` (zip rebuilt, SHA-256 checked, `gh attestation verify` passed, the exe answered on 127.0.0.1 only); `v0.1.7-g1` and older releases have no attestation. | `.github/workflows/release.yml`, `docs/INSTALL.md` |
| The GitHub Action that validates a bundle runs in this repository's CI (job `deb-action`); it has not been used by third-party repositories. | `BACKLOG.md` (#12), `docs/U1-DEB.md` |
| Network: HTTP to the printer is unencrypted on the LAN. A changed printer address is reported only between two captures made in the app (keyed local fingerprint, mock-tested, UNTESTED on a real U1); it is not watched over time. | `docs/threat-model.md`, `BACKLOG.md` #42 |
| The ticket-ready summary only contains what the owner typed and the facts of the loaded source; firmware, slicer and filaments are never detected. It does not replace the printer's encrypted system log. The "save the bundle now" reminder is static text; the log partition usage is read only during a live capture (rule S22, UNTESTED on a real U1) and is not judged. | `frontend/src/lib/ticket-text.ts` |
| The **on-screen alert** is in-page only: a banner above the result and a `(!)` prefix on the window title, no Notification API, no sound, nothing sent. A capture is one-shot (the backend returns once the listening time ends), so the alert comes when the result arrives, not during the capture. "New" means not already alerted on that screen since it was opened; leaving the screen clears it. It reacts only to OBSERVED findings and to error/shutdown states the result carries. Toggle in Settings (on by default, stored in browser storage, which may be lost). | `frontend/src/components/capture-alert.tsx` |
| The **sample report** on Pages (`docs/sample-report/index.html`) is built from the SYNTHETIC demo incident only, with the app's Report-composer code (`npm run sample-report` in `frontend/`); it shows no real fault and is not an official Snapmaker document. | `frontend/src/lib/sample-report.ts` |

## What U1 Doctor will never claim

- That a printer stopped because the connection dropped.
- That a record is complete because no gap was recorded.
- That a displayed error code is the true root cause.
- A probability, score or percentage of cause.
- That a SYNTHETIC or DEMO scenario is real, or that a bundle's hash proves who made it.
- That an export is anonymous.
- That it is official, endorsed by Snapmaker, "first" or "only" of its kind.
- That it can read or decrypt the vendor's encrypted logs.
