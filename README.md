<p align="center"><img src="docs/media/hero.jpg" alt="U1 Doctor" width="100%"></p>

# U1 Doctor

[![MIT](https://img.shields.io/badge/licence-MIT-ffc400?style=flat-square&labelColor=131416)](LICENSE) ![read-only](https://img.shields.io/badge/printer-read--only-ffc400?style=flat-square&labelColor=131416) ![local](https://img.shields.io/badge/runs-100%25%20local-ffc400?style=flat-square&labelColor=131416) ![no cloud](https://img.shields.io/badge/cloud%20%C2%B7%20telemetry%20%C2%B7%20AI-none-b4a0ff?style=flat-square&labelColor=131416)

**[Open the illustrated presentation](docs/presentation/index.html)** (EN/FR, animated, works offline).

**Unofficial, local, read-only diagnostic forensics for the Snapmaker U1.**
Not affiliated with, endorsed by, or approved by Snapmaker. No cloud, no telemetry, no AI.

When a print pauses or stops, U1 Doctor helps you answer three questions without guessing:

<table>
<tr>
<td width="33%"><img src="docs/media/q1-code.jpg" alt=""><br><b>1. What does this error code mean?</b><br>An offline decoder, with a link to the official page.</td>
<td width="33%"><img src="docs/media/q2-timeline.jpg" alt=""><br><b>2. What happened, and when?</b><br>A timeline built only from observed facts.</td>
<td width="33%"><img src="docs/media/q3-bundle.jpg" alt=""><br><b>3. What can I show someone else?</b><br>A portable evidence bundle (U1-DEB) that anyone can open and replay locally.</td>
</tr>
</table>

> **Status: work in progress, prepared for the Snapmaker U1 Innovation Fund (Phase 2).**
> **The app is offline by default.** It shows one **real** recorded capture and several **synthetic** scenarios, each clearly badged. The **Connect** screen can take a short **read-only** capture from your own U1, but only after you type its private address and tick an approval box. No real fault has been captured yet, so every incident you can open in the app is `SYNTHETIC`.

## What works today

| Feature | State |
|---|---|
| Offline decoder for 413 official U1 error codes (paraphrased, with link). Unknown or malformed codes give `INCONCLUSIVE`, never a guess | tested on synthetic data |
| Deterministic rules engine: the same observations and the same rule set always give the same findings and the same hash | tested on synthetic data, one platform |
| Explainable findings: evidence for, evidence against, what is missing, limits, official references. No score, no percentage | tested on synthetic data |
| Print-quality assistant ("needs your eyes"): 16 symptoms, causes from the official pages in the wiki's order, evidence only from numbers you type or temperatures in a saved session. No ranking, no score | tested on synthetic and real-capture data |
| Timeline of the **observed window**: phases, explicit gaps, per-row source and time quality | tested on the real capture and 13 synthetic scenarios |
| U1-DEB export, safe import, replay (see [`docs/U1-DEB.md`](docs/U1-DEB.md)) | tested in one process; not yet tested on a second machine |
| Windows build (PyInstaller, one folder) | runs on the developer PC; **not yet tested on a clean Windows 11** |
| English and French interface | both complete |

The real capture comes from the owner's own U1 (firmware 2.1.0): a 27-minute normal print, 9,333 frames, no fault. It is a recorded file in `fixtures/real/`. The evidence of how it was taken is in `docs/evidence/`.

## Safety model

U1 Doctor never controls the printer.

- The only code allowed to open a network connection to a printer is a single transport module. The web interface reaches it through one route, `POST /api/v1/live/capture`, which refuses to run without explicit owner consent, accepts one private IPv4 address, and rejects requests that do not come from the app itself.
- Requests are checked against a frozen allowlist **before** any network I/O: `GET /server/info`, `GET /printer/info`, `GET /printer/objects/list`, `POST /printer/objects/query` (read-only query), and one WebSocket method, `printer.objects.subscribe`. Anything else is refused.
- Pause, resume, cancel, restart, emergency stop and `printer.gcode.script` are covered by tests that must stay refused.
- Supervised sessions on the owner's U1: two scripted runs (3 read-only GET requests and 1 WebSocket subscribe) and one capture started from the Connect screen on an idle printer (3 GET and 1 subscribe, 15 s). No write was sent.
- The app listens on `127.0.0.1` only. Nothing leaves your machine.

Details: [`docs/threat-model.md`](docs/threat-model.md), [`docs/capability-matrix.md`](docs/capability-matrix.md).

## What it does not claim

- A lost connection never means the printer stopped.
- The timeline describes the observed window only. No gap record does **not** prove the data is complete.
- Timestamps are the PC's receipt time unless proven otherwise. Machine clocks are never read as UTC.
- A SHA-256 on a bundle proves **integrity only**, never who made it.
- The official wiki warns that the displayed code may not be the real fault. The decoder reports what the code says, not a diagnosis.
- Export redaction is best effort and is not a guarantee of anonymity. Review a bundle before sharing it.

## Why owner-readable evidence

According to the official Snapmaker wiki, the U1's exported system logs are encrypted: the archive cannot be read locally, and only Snapmaker support can open it. U1 Doctor does not read or decrypt those logs. It gives the owner something different: readable, hash-verifiable evidence built from read-only observations the owner authorizes, which can be inspected and replayed locally. A SHA-256 proves integrity only, never authorship. Source: [`docs/wiki-findings.md`](docs/wiki-findings.md) section 2.

## How it works

```
observations (REAL / SYNTHETIC / USER_REPORTED / IMPORTED)
        |
        v
timeline + rules engine (pure function, pinned rule set)
        |
        v
findings --> U1-DEB bundle (export / safe import / replay)
```

Every fact carries its source and a time-quality marker. Findings point back to the observations that produced them. Imported bundles are labelled `IMPORTED`, and their findings are always recomputed with your local rule set. Architecture: [`docs/architecture.md`](docs/architecture.md).

## Run from source (Windows PowerShell)

Requirements: Python 3.12 or newer, Node.js with npm.

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\frontend
npm ci
npm run build
cd ..\backend
.venv\Scripts\python.exe -m app
```

Open <http://127.0.0.1:8765>. Set `U1DOCTOR_PORT` to change the port.

Tests:

```powershell
cd backend; .venv\Scripts\python.exe -m pytest
cd frontend; npm test
```

At the time of writing: 877 backend tests and 81 frontend tests pass, with `ruff`, `mypy` and `tsc` clean. CI runs the same checks.

To build the Windows package: `scripts\build_windows.ps1`. A release zip with its SHA-256 will be linked here at publication. The executable is unsigned, so Windows SmartScreen may warn.

## More documentation

- [`docs/INSTALL.md`](docs/INSTALL.md): install guide (no release yet; the exe is not yet tested on a clean Windows 11).
- [`docs/LIMITS.md`](docs/LIMITS.md): what is not covered or not yet proven.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): tests, conventions, honesty rules.
- [`SECURITY.md`](SECURITY.md): read-only allowlist summary and how to report a vulnerability.

## Related community projects

U1 Doctor is not a dashboard and does not drive the printer. Nearby projects that do other jobs:

- [U1 Print Hub](https://github.com/dlgambill/u1hub) (MIT): farm dashboard, queue, scheduling, and a per-printer logbook. It sends commands to the printers. U1 Doctor only reads.
- [Snapmaker Studio](https://github.com/DVOpenLabs/snapmaker-studio) (MIT): checks a 3MF or STL file before slicing.
- [U1 Dry Run](https://github.com/DesignMaster-Solutions/u1-dryrun) (GPL-3.0): runs sliced G-code through the real U1 firmware without a printer.

No code is copied from these projects. The comparison is in [`docs/ORIGINALITY_AUDIT.md`](docs/ORIGINALITY_AUDIT.md).

## License

MIT, see [`LICENSE`](LICENSE). The official Snapmaker repositories (`u1-klipper`, `u1-moonraker`, `u1-fluidd`) are GPL-3.0; no code is copied from them. Error-code descriptions are short paraphrases with links to the official wiki.

"Snapmaker" and "U1" are trademarks of their owner. They are used here only to say which printer this tool is for.
