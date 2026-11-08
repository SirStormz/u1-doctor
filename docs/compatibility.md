# Compatibility matrix

Values: SUPPORTED · PARTIAL · NOT_AVAILABLE · UNTESTED · FAILED. Last update 2026-11-08. H-01 (3 GET) and H-02 (WS subscribe, 27 min) ran on the owner's U1 (firmware 2.1.0) on 2026-11-05; everything else is untested. The 2026-11-08 additions (BACKLOG #57/#59) are UNTESTED: owner decision "defensive code + UNTESTED", nothing of it is claimed as validated on hardware.

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
| Object `exception_manager` (`exceptions[]`) | u1-klipper source | UNVERIFIED_ON_HARDWARE; oneshot codes likely absent from it |
| Live error codes via WS notification | inferred from source | UNVERIFIED_ON_HARDWARE (mechanism of rebroadcast unread) |
| T1–T4 mapping from Klipper objects | none | UNKNOWN — keep `unmapped` |
| Official firmware version via API | none | UNKNOWN (keep Klipper/Moonraker version separate) |
| Offline code decoder (S01) | Wiki | VERIFIED_DOCUMENT (no hardware needed) |
| `GET /server/files/directory?path=logs` (disk usage of the log partition, S22) | Moonraker docs; forum topic 41445 (100 MB partition) | UNTESTED (never sent to a U1) |
| Subscribe `temperature_sensor cavity` (temperature) and `bed_mesh` (probed_matrix), S18/S24 | names in the H-01 object list of the real U1 | UNTESTED (never subscribed to on a U1) |
| `extruder*.extruder_offset`, `nozzle_diameter`, `state`, `switch_count`, `retry_count`, `error_count` (S17, S20, S23) | field names seen in the H-02 frames | UNTESTED (rules never checked against a real fault) |
| `toolhead.estimated_print_time` vs frame `eventtime` (S21 clock reset) | Klipper source; forum topic 41112 (firmware 1.1.0) | UNTESTED (proxy: shows an MCU restart, not a Klipper service restart) |
| Heater target without rise (S19) | Klipper `target` field | UNTESTED |
| Connectivity self-check (latency per GET, stream drops, 0 reconnects by design, address changed via keyed fingerprint) | U1 Doctor's own transport | UNTESTED (mock only) |

Fallback if Moonraker is unreachable/limited: offline decoder + manual code entry + U1-DEB import/replay of SYNTHETIC/shared bundles (cahier §22).
