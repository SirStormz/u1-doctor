# Compatibility matrix

Values: SUPPORTED · PARTIAL · NOT_AVAILABLE · UNTESTED · FAILED. Last update 2026-11-08. H-01 (3 GET) and H-02 (WS subscribe, 27 min) ran on the owner's U1 (firmware 2.1.0) on 2026-11-05; everything else is untested. The 2026-11-08 additions (BACKLOG #57/#59) were written defensively (owner decision "defensive code + UNTESTED") and then checked by one supervised read-only capture on the owner's U1 (firmware 2.1.0, printing, 4 GET + 1 subscription, nothing written): the new reads work and S22, S23, S24 fired on real data; S17 to S21 stayed quiet on a healthy print and remain UNTESTED for their positive case. The later 2026-11-08 addition (BACKLOG #65: `/server/history/totals` and the local maintenance reminders, budget now 5 GET + 1 subscription, 11 GET at most) has run on mocks only: UNTESTED.

| Firmware | Windows | REST read-only | WS subscribe | Errors live | Toolhead mapping | Bundle replay |
|---|---|---|---|---|---|---|
| V2.1.0 (2026-11-04, target) | 11 | TESTED_REAL | TESTED_REAL | UNTESTED | UNTESTED | TESTED_REAL (normal-print capture only) |
| V2.0.0 (2026-09-15) | 11 | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

## Capability matrix (doc-based expectations; none verified on hardware)
| Capability | Source of expectation | Status |
|---|---|---|
| Moonraker on :7125 | `lava/moonraker.conf` (repo) | UNVERIFIED_ON_HARDWARE |
| Open HTTP for LAN clients (no login) | `trusted_clients` incl. private ranges (repo) | UNVERIFIED_ON_HARDWARE |
| `GET /server/info`, `/printer/info`, `/printer/objects/list` | Moonraker docs | UNVERIFIED_ON_HARDWARE |
| `POST /printer/objects/query` | Moonraker docs | NOT USED: removed from the allowlist (never run on the machine) |
| WS `printer.objects.subscribe` | Moonraker docs | UNVERIFIED_ON_HARDWARE |
| Object `exception_manager` (`exceptions[]`) | u1-klipper source; real Moonraker log (2026-11-09: `{'exceptions': []}` and 11 raised exceptions with `id`, `index`, `code`, `level`, `message`) | Shape seen in real logs; live capture with an active exception UNTESTED |
| Log import: Moonraker, Klipper, unisrv, system logs (S25, S26, S28-S30) | the owner's U1 logs, firmware 2.1.0 and older, read 2026-11-09 | TESTED_REAL (S27: no shutdown line in the logs, UNTESTED) |
| Log import: Snapmaker Orca logs and the encrypted export (S28, S31, S32) | one real Orca log (30 files, June to October 2026) and one real encrypted export | TESTED_REAL |
| Live error codes via WS notification | inferred from source | UNVERIFIED_ON_HARDWARE (mechanism of rebroadcast unread) |
| T1–T4 mapping from Klipper objects | none | UNKNOWN — keep `unmapped` |
| Official firmware version via API | none | UNKNOWN (keep Klipper/Moonraker version separate) |
| Offline code decoder (S01) | Wiki | VERIFIED_DOCUMENT (no hardware needed) |
| `GET /server/files/directory?path=logs` (disk usage of the log partition, S22) | Moonraker docs; forum topic 41445 (100 MB partition) | TESTED_REAL (2026-11-08, firmware 2.1.0, printing: HTTP 200, 73 ms; the log partition reported 1065 MB in total, not the 100 MB of the forum report) |
| Subscribe `temperature_sensor cavity` (temperature) and `bed_mesh` (probed_matrix), S18/S24 | names in the H-01 object list of the real U1 | TESTED_REAL (2026-11-08: cavity temperature and a 11x11 bed mesh arrived in the subscription) |
| `extruder*.extruder_offset`, `nozzle_diameter`, `state`, `switch_count`, `retry_count`, `error_count` (S17, S20, S23) | field names seen in the H-02 frames | TESTED_REAL for the fields (read on 2026-11-08); S23 fired; S17 and S20 stayed quiet on a healthy print, so their positive case is UNTESTED |
| `toolhead.estimated_print_time` vs frame `eventtime` (S21 clock reset) | Klipper source; forum topic 41112 (firmware 1.1.0) | UNTESTED (proxy: shows an MCU restart, not a Klipper service restart) |
| Heater target without rise (S19) | Klipper `target` field | window read on 2026-11-08 (quiet on a normal print); positive case UNTESTED |
| `GET /server/history/totals` (job totals for the maintenance reminders: only `total_print_time`, `total_jobs`, `total_filament_used`, `total_time` kept) | Moonraker docs (history component; absent component = 404) | TESTED_REAL (2026-11-08, firmware 2.1.0, printing: HTTP 200 in about 6 ms; the history component is on; the job count arrives as a float, `21.0`, which the app now accepts; 21 jobs, about 71 print hours) |
| `GET /server/history/list?limit=20&order=desc` (status and numbers of the last 20 jobs: `job_history`; file names, user, uuid, thumbnails dropped) | Moonraker docs (history component) | TESTED_REAL (2026-11-10, firmware 2.1.0, idle: HTTP 200; 20 jobs, 14 completed and 6 cancelled; no rule reads it yet) |
| `GET /server/gcode_store?count=100` (error-like console lines: `console_errors`, scrubbed) | Moonraker docs | TESTED_REAL for the read (2026-11-10: HTTP 200, 2 ordinary lines, none error-like); the error-line case was not met on a real fault: UNTESTED |
| Support pack (`POST /api/v1/support/pack`): `/machine/system_info`, `/machine/proc_stats`, `/machine/peripherals/usb`, `/server/temperature_store`, `/server/files/list`, `/printer/objects/query` (named objects), named log and config downloads | Moonraker docs; probed read-only on the owner's U1 | TESTED_REAL (2026-11-10, firmware 2.1.0: 39 files, 7.3 MB, about 45 s, 0 IP/MAC left in logs; plain logs readable through the `logs` root) |
| Maintenance reminders (local tasks, due when current total minus baseline reaches the interval; tool changes = sum of `extruder*.switch_count`) | U1 Doctor's own computation; presets from the official wiki (PEI sheet cleaning, FAQ pogo pins) | UNTESTED (the counter meaning is not documented officially; the printer's own swap count may differ) |
| Connectivity self-check (latency per GET, stream drops, 0 reconnects by design, address changed via keyed fingerprint) | U1 Doctor's own transport | TESTED_REAL for latency, frame count and stream state (2026-11-08: 4 requests, median 73 ms, 0 drops); the address-changed fingerprint was not exercised (first capture) |

Fallback if Moonraker is unreachable/limited: offline decoder + manual code entry + U1-DEB import/replay of SYNTHETIC/shared bundles (cahier §22).
