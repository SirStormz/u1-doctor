# Compatibility matrix

Values: SUPPORTED · PARTIAL · NOT_AVAILABLE · UNTESTED · FAILED. Last update 2026-11-06. H-01 (3 GET) and H-02 (WS subscribe, 27 min) ran on the owner's U1 (firmware 2.1.0) on 2026-11-05; everything else is untested.

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
| `POST /printer/objects/query` | Moonraker docs | UNVERIFIED_ON_HARDWARE |
| WS `printer.objects.subscribe` | Moonraker docs | UNVERIFIED_ON_HARDWARE |
| Object `exception_manager` (`exceptions[]`) | u1-klipper source | UNVERIFIED_ON_HARDWARE; oneshot codes likely absent from it |
| Live error codes via WS notification | inferred from source | UNVERIFIED_ON_HARDWARE (mechanism of rebroadcast unread) |
| T1–T4 mapping from Klipper objects | none | UNKNOWN — keep `unmapped` |
| Official firmware version via API | none | UNKNOWN (keep Klipper/Moonraker version separate) |
| Offline code decoder (S01) | Wiki | VERIFIED_DOCUMENT (no hardware needed) |

Fallback if Moonraker is unreachable/limited: offline decoder + manual code entry + U1-DEB import/replay of SYNTHETIC/shared bundles (cahier §22).
