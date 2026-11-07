# Limits and uncovered cases

What U1 Doctor cannot know or has not yet proven. Each item cites the document it comes from. If a limit is not listed here, do not assume it is covered.

## Hardware evidence

| Limit | Source |
|---|---|
| Real captures are normal prints only: a 27-minute print (firmware 2.1.0, 9,333 frames, shipped as a fixture) and a 55-minute multi-colour print (18,339 frames, derived evidence in `docs/evidence/H-06`). **No real failure has been captured**, so every incident in the app is `SYNTHETIC`. | `README.md`, `IMPLEMENTATION_STATUS.md` (REQ-017), `docs/ORIGINALITY_AUDIT.md` |
| Machine calls made so far: read-only GET requests, object queries and one WebSocket subscribe, in supervised sessions (H-01, H-02, H-05, H-06) and one capture from the UI; 0 non-read operations in every audit log. Nothing else was ever tested on hardware, and no real connection drop with a Klipper stop was seen. | `IMPLEMENTATION_STATUS.md`, `docs/evidence/H-01/manifest.json` |
| **No proof of the T1-T4 to PTFE-path mapping (H-04).** The 3D view's four markers are labelled UNMAPPED; mapping from Klipper objects stays `unmapped`. | `docs/design/3D_MODEL.md`, `docs/compatibility.md` |
| The print-quality assistant compares only numbers you type, or the highest temperature of a saved session, with windows the wiki states. It reads no slicer profile, no G-code retraction, no chamber temperature, and the wiki's Build Plate Guide (full plate and filament matrix) was not read. Most causes stay "needs your eyes". | `knowledge/u1_symptoms.json`, `docs/wiki-findings.md` §6 |
| In-app live capture (Connect screen) has been run once, on an idle U1. It has not been run during a fault, and no real connection drop with a Klipper stop was seen. | `BACKLOG.md` #3, `IMPLEMENTATION_STATUS.md` (REQ-014) |
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

## Replay and determinism

| Limit | Source |
|---|---|
| Replay hashes are identical on Linux, Windows and macOS in CI (15 scenarios). They have not been checked on a user's own second machine. | `BACKLOG.md` #12, #17 |
| U1-DEB has been replayed by CI on three OS, not yet by an independent user. | `README.md` |
| A SHA-256 on a bundle proves integrity only, never authorship or that data came from a real machine. | `docs/U1-DEB.md` |
| Imported bundles are replayed with the local ruleset; with a different ruleset hash no replay is done. Findings are always recomputed locally. | `docs/U1-DEB.md` |
| Export redaction is best effort and not a guarantee of anonymity. | `docs/U1-DEB.md` |

## Timeline and time

| Limit | Source |
|---|---|
| The timeline describes the observed window only. "No gap recorded" does not prove the data is complete. | `README.md`, `IMPLEMENTATION_STATUS.md` |
| Timestamps are the PC's receipt time unless proven otherwise. The machine's `eventtime` is not UTC and is never read as such. | `README.md`, `docs/G0_GO_NOGO.md` |
| A lost connection never means the printer stopped. | `README.md` |

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
| The 3D view is **illustrative**: slider moves are not machine coordinates, and it shows one visible toolhead only. | `docs/design/3D_MODEL.md` |
| The 3D model is the owner's own work, committed in the repository (`frontend/public/models/u1-jay.glb`) and bundled in the exe and the Docker image; it is a visual illustration, not official CAD, and shows the "snapmaker" wordmark. | `docs/design/3D_MODEL.md`, `scripts/build_windows.ps1` |
| The Windows executable is **unsigned**, so SmartScreen may warn; the SmartScreen prompt itself has not been tested. It was checked on a clean PC and scanned on VirusTotal (0/67 for v0.1.6-g1 at publication). | `README.md`, `INSTALL.md`, `BACKLOG.md` #14 |
| Only a Windows executable is released (plus a Docker image and source); no macOS or Linux executable. Not audited: screen reader, 200 % zoom, widths under 1024 px. | `IMPLEMENTATION_STATUS.md` |
| The GitHub Action that validates a bundle runs in this repository's CI (job `deb-action`); it has not been used by third-party repositories. | `BACKLOG.md` (#12), `docs/U1-DEB.md` |
| Network: HTTP to the printer is unencrypted on the LAN. A changed printer IP is not detected yet. | `docs/threat-model.md`, `BACKLOG.md` #42 |

## What U1 Doctor will never claim

- That a printer stopped because the connection dropped.
- That a record is complete because no gap was recorded.
- That a displayed error code is the true root cause.
- A probability, score or percentage of cause.
- That a SYNTHETIC or DEMO scenario is real, or that a bundle's hash proves who made it.
- That an export is anonymous.
- That it is official, endorsed by Snapmaker, "first" or "only" of its kind.
- That it can read or decrypt the vendor's encrypted logs.
