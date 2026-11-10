# Local API reference

U1 Doctor's window and browser tab talk to a small local HTTP API. It is **not** a public service: it listens on `127.0.0.1` only (default port `8765`, `U1DOCTOR_PORT` changes it), has no accounts, and sends nothing anywhere. This page lists every route so you can check what the app can do. The list is kept in step with the code by a test (`backend/tests/test_api_doc.py`): a route added without a line here fails the test.

Version of this page: 0.3.0-g1. Interactive docs (`/docs`, `/redoc`, `/openapi.json`) are switched off on purpose.

## The two routes that can reach a printer

**`POST /api/v1/support/pack`** builds the support pack (see below). Only **`POST /api/v1/live/capture`** and that route can open a connection to a printer. It needs `consent: true` in the body, takes one private IPv4 address, and sends at most **7 GET and 1 WebSocket message (13 GET if the live stream drops)**, all read-only and on a fixed allowlist (see [`SECURITY.md`](../SECURITY.md) and [`adr/0002-moonraker-readonly.md`](adr/0002-moonraker-readonly.md)). Every other route works on files, data you send it, the bundled knowledge files or the local history database.

## Rules every request must follow

- **Host:** only `127.0.0.1`, `localhost` (and `testserver` in tests) are accepted; other `Host` headers are refused (this blocks DNS rebinding).
- **Reading (GET):** open to any local client.
- **Writing (POST, DELETE):** refused with `403` unless the request comes from the app itself: an `Origin` header, when present, must be this app, **and** the header `X-U1D: 1` must be present. A web page in your browser cannot add that header across sites, so another site cannot write into your local history. Error codes: `FOREIGN_ORIGIN`, `MISSING_APP_HEADER`.
- **Errors:** JSON `{"detail": {"code": "...", "message": "..."}}` (some older routes return a plain string in `detail`). Frontend messages are translated from the code, never shown raw.
- **Size caps:** bundle zip 50 MiB, Dry Run report 5 MiB, G-code 64 MiB, 3MF 50 MiB (`413` when exceeded). History holds at most 200 saved sessions (`409 HISTORY_FULL`).
- There is no login: anything on this PC that can reach `127.0.0.1` can call the read routes. Nothing is sent to any other host.

## Routes

"Writes" means the local SQLite database (history and replay log) in your user folder. No route writes to a printer.

### Status and knowledge

| Method | Path | What it does | Touches |
|---|---|---|---|
| GET | `/api/v1/health` | App and API version, mode, machine access level. | nothing |
| GET | `/api/v1/compatibility` | What was tested on real hardware, per capability and firmware (TESTED_REAL / TESTED_SYNTHETIC / UNTESTED). | nothing |
| GET | `/api/v1/rulesets` | The loaded ruleset: id, version, hash and the list of rules. | nothing |
| GET | `/api/v1/knowledge/known-issues` | The documented known issues with their official quick fixes. | bundled file |
| GET | `/api/v1/knowledge/symptoms` | The print-quality catalog (symptoms, causes, official order). | bundled file |
| GET | `/api/v1/knowledge/firmware-issues` | Known issues per firmware version (dated, sourced, may be out of date). `?version=` keeps the entries whose range contains the version you type. | bundled file |
| GET | `/api/v1/knowledge/good-to-know` | Static community-reported notes (camera in Fluidd, read-only config, encrypted logs). | bundled file |

### Decoding and checks (no printer, no database)

| Method | Path | Body | What it does |
|---|---|---|---|
| POST | `/api/v1/errors/interpret` | `{code, firmware?}` | Decodes an error code (or a message without a code), adds the community-reported causes, near-match suggestions for a mistyped code and firmware notes. |
| POST | `/api/v1/support/checklist` | `{code, firmware?}` | The "what support will ask" checklist for a code (`422 MALFORMED_CODE` if the code is malformed). |
| POST | `/api/v1/support/pack` | `{host, consent: true, code?, notes?, include_serial?, redact_network?, include_job_names?}` | Builds ONE AES-256 encrypted zip for Snapmaker support from read-only GET (state, versions, recent jobs, temperatures, plain logs, calibration files, checklist). Returns the summary and the one-time `password` (never stored); the zip is kept in memory, latest only. Not anonymous: it can hold the serial number and raw logs (IP and MAC addresses are removed unless `redact_network` is false). One capture or pack at a time (`409 LIVE_BUSY`). |
| GET | `/api/v1/support/pack/{name}` | - | Downloads the latest support pack zip (`404` if none or another name). |
| POST | `/api/v1/symptoms/evaluate` | `{symptom, answers, session?}` | Evaluates a print-quality symptom from your answers; `session` optionally compares temperatures of one saved history session. |
| POST | `/api/v1/preflight/gcode` | raw file bytes, `?name=` | Static pre-flight (20 checks) of a sliced file, read as text; the file name is never echoed back. |
| POST | `/api/v1/preflight/3mf` | raw 3MF bytes, `?name=` | The same checks on every plate of the G-code embedded in a 3MF. Only `Metadata/*.gcode` and the project settings are read; strict zip limits. |
| POST | `/api/v1/imports/dryrun` | raw `report.json` | Normalizes a U1 Dry Run report into IMPORTED observations (a prediction, not a machine observation). |
| POST | `/api/v1/imports/logs` | raw log file, `.gz`, `.zip` or `.tar.gz`, `?name=` | Reads log files (Moonraker, Klipper, unisrv, syslog, Snapmaker Orca; the printer's encrypted system log is recognized, never opened) into IMPORTED observations plus findings (rules S25-S32). Caps: 64 MiB received, 2 GiB unpacked, 64 files. File names, paths, addresses and serial numbers are not kept. |

### Demo and replay

| Method | Path | What it does | Touches |
|---|---|---|---|
| GET | `/api/v1/demo/scenarios` | The names of the 20 synthetic scenarios (always labelled SYNTHETIC / DEMO). | bundled files |
| GET | `/api/v1/demo/scenarios/{name}` | One scenario: observations and findings. | bundled files |
| GET | `/api/v1/real/captures/{cid}` | A frozen capture of the owner's real U1 shipped for replay (`real_h02_normal_print`). | bundled file |
| POST | `/api/v1/replays` `{scenario}` | Re-runs the rules on a synthetic scenario and says whether the result matches the stored golden file (same replay hash). | **writes** one row in the replay log |
| GET | `/api/v1/timeline?source=` | The incident timeline of a source: `synthetic:<name>`, `real:<id>` or `history:<id>`. | reads history |

### Live capture (the only route that reaches a printer)

| Method | Path | Body | What it does |
|---|---|---|---|
| POST | `/api/v1/live/capture` | `{host, consent: true, seconds (3-60), save, label?, gcode_nozzle_mm?}` | One owner-triggered, read-only capture from one private IPv4 address (private ranges only, canonical literal; no names, IPv6, redirects or proxies). Returns observations, findings and the connection self-check. `403 CONSENT_REQUIRED` without consent, `409 LIVE_BUSY` if one is already running. The address is compared with the previous capture through a keyed fingerprint only; **the address itself is never stored**. With `save: true` the result is written to history. |

### History (local database)

| Method | Path | What it does | Touches |
|---|---|---|---|
| GET | `/api/v1/history` | The saved sessions (metadata). | reads |
| GET | `/api/v1/history/{sid}` | One saved session's metadata. | reads |
| GET | `/api/v1/history/{sid}/observations` | Its observations (so the report screen can scan what an export would hold). | reads |
| GET | `/api/v1/history/{sid}/findings` | Findings recomputed from that one session with the local ruleset (never merged with another). | reads |
| POST | `/api/v1/history/source` `{source, label?}` | Saves a synthetic scenario, a real capture or an existing session as a history entry. | **writes** |
| POST | `/api/v1/history/bundle` raw zip, `?label=` | Saves an imported U1-DEB bundle (shown as IMPORTED). | **writes** |
| POST | `/api/v1/history/dryrun` raw JSON, `?label=` | Saves an imported Dry Run report (IMPORTED). | **writes** |
| POST | `/api/v1/history/logs` raw file, `?label=&name=` | Saves imported log files as one history entry (IMPORTED). | **writes** |
| DELETE | `/api/v1/history/{sid}` | Deletes one saved session. | **writes** |

### Evidence bundles (U1-DEB)

| Method | Path | Body | What it does |
|---|---|---|---|
| POST | `/api/v1/bundles/preview` | `{source}` | Shows exactly what an export would contain and what is redacted, without producing the file. |
| POST | `/api/v1/bundles/export` | `{source}` | Builds the redacted bundle zip (`application/zip`, downloaded by the browser). Nothing is uploaded anywhere. |
| POST | `/api/v1/bundles/import` | raw zip | Validates and summarizes a bundle (name whitelist, no encryption, size and ratio caps); does not save it. |

### Static files

`GET /assets/*`, `GET /models/*` and a catch-all `GET /{path}` serve the built web interface (`index.html`) when it is present. They are not part of the data API.

## See also

[`SECURITY.md`](../SECURITY.md) (threat model), [`HOW-IT-WORKS.md`](HOW-IT-WORKS.md) (rules and read budget), [`U1-DEB.md`](U1-DEB.md) (bundle format), [`compatibility.md`](compatibility.md) (what ran on a real U1).
