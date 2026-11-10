# How U1 Doctor works (one page)

U1 Doctor is a local, read-only tool for the Snapmaker U1. It turns facts into **findings** with a pure function: the same observations and the same rule set always give the same findings and the same hash, on Windows, Linux and macOS (checked in CI). It never sends a command that changes the printer. Unofficial: not affiliated with Snapmaker.

```
observations (REAL / SYNTHETIC / USER_REPORTED / IMPORTED)
  -> timeline + rules engine (pinned rule set u1-starter 0.5.0, 28 rules)
  -> findings (evidence for / against / missing / limits / references)
  -> U1-DEB bundle (export, safe import, replay with your local rules)
```

## Provenance model

- **Every fact carries its source**: `REAL` (read from your printer with your consent), `SYNTHETIC` (demo scenarios, always badged), `USER_REPORTED` (a code you typed), `IMPORTED` (a bundle or a U1 Dry Run report). Sources are never merged into one another.
- **Every fact carries a time quality**: by default the PC's receipt time (`RECEIPT_ONLY`). The printer's `eventtime` is a monotonic clock, never read as UTC.
- **Every finding has a class**: `OBSERVED` (a fact was seen), `SUSPECTED` (a prediction or correlation, never a cause), `INCONCLUSIVE` (data missing, unknown or malformed). Plus an evidence strength (`STRONG`, `MODERATE`, `WEAK`, `UNKNOWN`). No score, no percentage.
- **Imported bundles** are labelled `IMPORTED` and their findings are always recomputed with your local rule set; with another rule-set hash, no replay is done. A SHA-256 proves integrity, never authorship.

## Live-read budget

A live capture runs only after you type a private (RFC1918) IPv4 address and tick the approval box. Every request is checked against a frozen allowlist **before** any network I/O.

- Normal capture: **7 GET + 1 WebSocket message** (`GET /server/info`, `/printer/info`, `/printer/objects/list`, `/server/files/directory?path=logs`, `/server/history/totals`, `/server/history/list?limit=20&order=desc`, `/server/gcode_store?count=100`, then one `printer.objects.subscribe` with a fixed object list).
- If the stream drops early: up to 6 more status GET, so **13 GET and 1 WebSocket message at most**. The stream is never reopened; no keepalive pings are sent.
- Refused by design: `POST /printer/objects/query`, pause, resume, cancel, restart, emergency stop, `printer.gcode.script`, any other method. The printer address is never stored (only a keyed local fingerprint, to say "the address changed").

## The 28 rules (ruleset `u1-starter` 0.5.0, all status PROPOSED)

"Wiki" = the official Snapmaker U1 wiki. "Forum" = one or a few public owner reports, labelled as community reports. "U1 Doctor" = a threshold chosen by this project, stated as such in the finding.

| Rule | What it looks at | Sources | What it cannot conclude |
|---|---|---|---|
| U1-S01-CODE-DECODE | An error code you typed, decoded offline (413 official codes) | Wiki error-code table | The displayed code may not be the true fault source (wiki note); the code is declared, not read from the machine |
| U1-S03-STATE-TRANSITION | Print state `printing` -> `paused`/`error`; codes within 120 s are listed as nearby | Wiki error-code table | A state change is a fact, not a diagnosis; nearness in time is correlation only |
| U1-S04-DROP-PROBE | A dropped stream followed by read-only status probes (within 120 s) | U1 Doctor | Probes show whether Klipper answers, not whether the print continued |
| U1-S09-MAPPING-UNKNOWN | Values that cannot be tied to a toolhead | U1 Doctor (H-04 not done) | No per-toolhead statement until the T1-T4 mapping is proven on hardware |
| U1-S10-OBSERVATION-GAPS | Capture gaps, timeouts, lost connections | U1 Doctor | A lost connection does not mean the printer stopped; no gap recorded does not mean the record is complete |
| U1-SEC-BLOCKED-CALL | A request U1 Doctor itself refused (not in the allowlist) | U1 Doctor policy | Describes U1 Doctor's own behaviour, not the printer |
| U1-S11-BED-WINDOW | Bed temperature outside -10 to 110 °C | Wiki (bed temperature page, code 0003-0526) | A reading is a fact about the sensor value, not proof of its cause; wiki pages do not always agree |
| U1-S12-NOZZLE-WINDOW | Nozzle temperature outside -10 to 310 °C | Wiki (nozzle temperature anomaly page) | Same as S11 |
| U1-S13-CODE-RECURRENCE | The same typed code 3 times or more within 15 min | Wiki error-code table | Counts declarations, not machine events |
| U1-S14-CONNECTION-FLAPS | 3 or more drops or timeouts within 10 min | Wiki (static IP page) | Other causes than an address change are possible |
| U1-S15-DRYRUN-PREDICTION | An imported U1 Dry Run report (refused moves, tool-change travel) | U1 Dry Run (community tool) | A simulation before printing, not an observation; always SUSPECTED and WEAK, never merged with a capture |
| U1-S16-FAN-OFF-HOT | Nozzle fan at 0 while the nozzle is above 60 °C (3 samples or more) | U1 Doctor, from one real multi-colour print | Thresholds come from one print on one U1, not from Snapmaker |
| U1-S17-OFFSET-Y-SPREAD | Spread and low values of the toolhead Y offsets | Forum 44046 | Figures from one report; UNTESTED on a real fault |
| U1-S18-SENSOR-IMPLAUSIBLE | Bed and cavity readings below -100 °C together | Forum 44067 (resolved report) | The -100 °C bound is U1 Doctor's; does not locate the faulty connector; UNTESTED |
| U1-S19-HEATER-NO-RISE | A heater target set but the temperature not rising (30 s window, 10 °C gap, 2 °C rise) | U1 Doctor display thresholds | Not a heater diagnosis; thresholds are not official; UNTESTED |
| U1-S20-NOZZLE-DIAMETER | Nozzle diameters reported by the printer vs a G-code you analysed | Forum 43566 | Different diameters can be intentional; the G-code value is a slicer setting, not a machine reading; UNTESTED |
| U1-S21-CLOCK-RESET | Controller clock far behind the host clock while printing (600 s or more) | Forum 41112 | A Klipper service restart without an MCU reset is not visible; UNTESTED |
| U1-S22-LOG-PARTITION | Total, used and free bytes of the partition holding the logs | Forum 41445 | No fill level is judged normal or not; UNTESTED |
| U1-S23-TOOLHEAD-ACTIVITY | Changes of the firmware's toolhead counters during the capture | U1 Doctor | Counters are firmware totals; only their change in this window is an event; UNTESTED |
| U1-S24-BED-MESH-STATS | Number, min and max of the probed bed-mesh points | U1 Doctor | Statistics only, not judged normal or abnormal; no mesh says nothing about the bed; UNTESTED |
| U1-S25-MACHINE-EXCEPTIONS | Each machine exception raised by the firmware, decoded to the on-screen code (`level-id-index-code`); from a Moonraker log or, live, from the exception manager | Official wiki; real logs | IMPORTED unless live; the index is not proven to be the toolhead number; tested on 11 real events |
| U1-S26-LINK-HEALTH | Klipper-controller link counters (sync, CRC, invalid, retransmitted bytes) from `Stats` lines | U1 Doctor | No official threshold: a non-zero count is shown as a fact; clean is only a baseline |
| U1-S27-KLIPPY-SHUTDOWN | Shutdown-type lines in a Klipper log | U1 Doctor | A phrase match, not a diagnosis; UNTESTED (no real fault in the logs read) |
| U1-S28-NETWORK-HEALTH | Wi-Fi disconnections, name-resolution failures, cloud drops, sign-in failures, slicer heartbeat time-outs | Official static-IP page | Describes the link, not the printer's health |
| U1-S29-FIRMWARE-UPGRADE | A firmware update attempt that failed (script exit code) | U1 Doctor | The cause is not in the log |
| U1-S30-TIMELAPSE-FAILURES | Timelapse frames the printer could not write | U1 Doctor | Camera service only; its code is undocumented |
| U1-S31-ORCA-LINK | Snapmaker Orca "Application is not activated", heartbeat time-outs and time-sync failures | A real Snapmaker Orca log | The meaning of Orca's message is inferred from its text |
| U1-S32-ENCRYPTED-LOG | The printer's encrypted system log was provided (recognized, never opened) | Official wiki | Only the file name and size are read |

Rules S25-S32 read [log files](LOGS.md) you provide (IMPORTED) and never contact a printer. Rules S17-S24 say "not observable in this capture" when the printer does not report the data. Real captures so far are normal prints only (the 2026-11-08 one read every source and fired S22 to S24; S17 to S21 stayed quiet): **no real fault has been captured**. Full list of limits: [`LIMITS.md`](LIMITS.md).

## Around the rules

- **G-code pre-flight**: 20 static checks on a sliced `.gcode`, or on the G-code inside a sliced `.3mf` (checks 1-10 from the wiki and release notes, 11-20 from labelled forum reports). Text only, never a simulation. Rules: [`LIMITS.md`](LIMITS.md#g-code-pre-flight).
- **Community-reported causes**, a **ticket-ready summary** (copied to the clipboard, nothing sent) and a **known issues per firmware** table (13 dated entries, may be out of date).

## Compared with community tools

U1 Doctor does not simulate before printing, drive the printer or watch it live. It reads, with consent, and explains **after the fact** with evidence you can replay.

| Tool | What it is for | Talks to the printer | After-the-fact evidence and replay |
|---|---|---|---|
| [U1 Dry Run](https://forum.snapmaker.com/t/43986) | Pre-print simulation: runs a sliced file through the real U1 firmware code, no printer | No | No (its report can be imported into U1 Doctor as a prediction) |
| [U1 Fix Pack](https://forum.snapmaker.com/t/44036) | Firmware fixes for specific bugs | Changes the firmware | No |
| [Snapmaker Studio](https://forum.snapmaker.com/t/43460) | Pre-print checks of 3MF/STL files against the machine profile | Reads the profile | No |
| [U1 Print Hub](https://forum.snapmaker.com/t/42516) | Dashboard and control: queue, scheduling, monitoring, logbook | Sends commands | Logbook of pauses and errors, no replayable evidence format |
| [Snap Studio](https://forum.snapmaker.com/t/43847) | Desktop workshop: slicing, queue, camera, printing | Sends commands | No |
| **U1 Doctor** | Read-only diagnosis after an incident: decoder, timeline, findings, U1-DEB bundle | Reads only (7 GET + 1 WS message per capture, 13 GET at most) | Yes: provenance per fact, deterministic replay, same hash on three OS |

These tools are complementary; no code is copied from them ([`ORIGINALITY_AUDIT.md`](ORIGINALITY_AUDIT.md)).
