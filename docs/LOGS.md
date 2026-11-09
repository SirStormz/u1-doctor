# Reading log files (since 0.1.9-g1)

U1 Doctor can read log files **you already have** (exported from the printer's web page, or from Snapmaker Orca) and turn them into the same findings and incident timeline as a live capture. It never connects to a printer to do this: **History → Analyse log files**, or `POST /api/v1/imports/logs` (see [`API.md`](API.md)).

Everything read this way is labelled **IMPORTED**: it was not observed by U1 Doctor on a machine. The files may be old, partial or edited, and each time is the clock written in the log (its time zone is not recorded).

## What it reads

| File | What U1 Doctor takes from it | Rule |
|---|---|---|
| `moonraker.log` | every machine exception (`klippy raise exception`: id, index, code, level, message), job events counted, cloud connection drops per day, name-resolution failures, service starts | S25, S28 |
| `klippy.log` (also the rolled `klippy.log.N`) | the `Stats` lines (link counters per controller), shutdown-type lines, toolhead activations and retries, last bed-mesh statistics, firmware versions of the controllers. The configuration dump at the top is skipped | S26, S27 |
| `unisrv.log` | failed timelapse captures, firmware-update checks and failures, cloud sign-in and name-resolution failures | S29, S30, S28 |
| `syslog` | Wi-Fi disconnections (with the reason number), USB disconnections, out-of-memory, undervoltage, thermal and kernel error counts | S28 |
| `gui.log`, `mosquitto.log` | counts only (cloud agent disconnects, protocol errors) | |
| Snapmaker Orca log (a `.zip` of `.log.N` files) | "Application is not activated" records, heartbeat time-outs, time-sync failures, Orca and Windows versions | S31, S28 |
| `LOGS_*.tar.gz` (the touchscreen export) | **recognized, never opened**: it is encrypted for Snapmaker support. Only the firmware number in its name is read | S32 |
| `flow_calculator.log`, `sysinfo_*.csv` | recognized, not analysed (the columns are not documented) | |

A plain file, `.gz`, `.zip` or `.tar.gz` works; so does a folder of logs packed into one archive. Caps: 64 MiB received, 2 GiB unpacked, 64 files per archive (a zip bomb is refused).

## The on-screen code is in the log

A machine exception carries `id`, `index`, `code` and `level`. The code shown on the printer is **`level-id-index-code`, four digits each**: `{'id': 523, 'index': 3, 'code': 38, 'level': 2}` is `0002-0523-0003-0038`, "Toolhead 4: Printing Anomaly" in the official table. This was checked on 11 real events of one printer (6 distinct codes: 4 are in the official table, the 2 others are in `knowledge/u1_log_signals.json`, labelled "seen in a real log, not official"). The code decoder also accepts such an exception pasted as text.

## What is not kept

File names, paths, IP and MAC addresses, serial numbers, user names and job names are never copied into an observation; messages are scrubbed. Only counts, dates, codes and short fixed facts are kept. A saved import goes to the local history like any other session and can be exported as a U1-DEB bundle.

## What it cannot tell

* A log shows what the software wrote, not why. Network and cloud lines describe the link, not the printer's health.
* No official threshold exists for the link counters, so any non-zero synchronisation, CRC or invalid count is shown as a fact, not as proof of a fault.
* Rule S27 (shutdown lines) and live machine exceptions have not met a real fault yet (see [`compatibility.md`](compatibility.md)).
