<p align="center"><img src="docs/media/hero.jpg" alt="U1 Doctor: a Snapmaker U1 with a magnifier over its screen" width="100%"></p>

<h1 align="center">U1 Doctor</h1>

<p align="center"><b>When a print stops, know what happened, and why you can trust the answer.</b><br>
A local, read-only evidence tool for the Snapmaker U1. No cloud, no telemetry, no AI.</p>

<p align="center">
<a href="https://github.com/stormz85ia/u1-doctor/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/stormz85ia/u1-doctor/actions/workflows/ci.yml/badge.svg"></a>
<a href="https://github.com/stormz85ia/u1-doctor/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/stormz85ia/u1-doctor?include_prereleases&style=flat-square&labelColor=131416&color=ffc400"></a>
<a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/licence-MIT-ffc400?style=flat-square&labelColor=131416"></a>
<img alt="read-only" src="https://img.shields.io/badge/printer-read--only-ffc400?style=flat-square&labelColor=131416">
<img alt="local" src="https://img.shields.io/badge/runs-100%25%20local-ffc400?style=flat-square&labelColor=131416">
<img alt="no cloud" src="https://img.shields.io/badge/cloud%20%C2%B7%20telemetry%20%C2%B7%20AI-none-b4a0ff?style=flat-square&labelColor=131416">
</p>

<p align="center">
<a href="https://github.com/stormz85ia/u1-doctor/releases/latest"><b>Download for Windows</b></a> &nbsp;·&nbsp;
<a href="https://stormz85ia.github.io/u1-doctor/presentation/"><b>Illustrated presentation</b></a> (EN/FR) &nbsp;·&nbsp;
<a href="docs/INSTALL.md"><b>Install guide</b></a> &nbsp;·&nbsp;
<a href="docs/LIMITS.md"><b>What it does not do</b></a>
</p>

> Unofficial. Not affiliated with, endorsed by, or approved by Snapmaker.

---

## What is it, in plain words?

Your U1 pauses or shows an error code. You want to know what the code means, what the printer was doing just before, and what you can show a friend or Snapmaker support, without guessing.

U1 Doctor runs **on your own PC**. It gives you three things:

<table>
<tr>
<td width="33%" valign="top"><img src="docs/media/q1-code.jpg" alt=""><br><b>1. What does this code mean?</b><br>An offline decoder for 413 official U1 error codes, with a link to the official page. A code it does not know gives "inconclusive", never a guess.</td>
<td width="33%" valign="top"><img src="docs/media/q2-timeline.jpg" alt=""><br><b>2. What happened, and when?</b><br>A timeline built only from facts that were really observed, with the gaps shown instead of hidden.</td>
<td width="33%" valign="top"><img src="docs/media/q3-bundle.jpg" alt=""><br><b>3. What can I show someone else?</b><br>A portable evidence bundle (<code>U1-DEB</code>) that anyone can open and replay on their own PC, to get the same result.</td>
</tr>
</table>

**It only looks. It never touches your printer.** It cannot pause, cancel, restart or send G-code. It can read from a printer only if you type its address and tick an approval box, and even then through a short, fixed list of read-only requests.

## A quick look

| Overview | Incident timeline | Error codes |
|---|---|---|
| ![Overview](docs/media/screens/03-overview.png) | ![Timeline](docs/media/screens/06-timeline.png) | ![Error codes](docs/media/screens/04-error-codes.png) |

Screenshots use the built-in **synthetic demo data** (the `DEMO` banner is always visible). All 11 screens are in [`docs/media/screens/`](docs/media/screens/).

## Get started in two minutes (Windows)

1. Download `u1-doctor-0.1.0-g1-win64.zip` and its `.sha256.txt` from the [latest release](https://github.com/stormz85ia/u1-doctor/releases/latest).
2. Check the file was not altered (optional, 10 seconds):
   ```powershell
   Get-FileHash .\u1-doctor-0.1.0-g1-win64.zip -Algorithm SHA256
   ```
   Compare with the value in the release notes: `FB7B72530D16B7B08E76AEA0CFE5A130854C7389E4B8C8093FAEE4A05C7E8469`.
3. Right-click the zip, **Extract all** (not WinRAR or 7-Zip, so Windows keeps the download mark), then run `u1-doctor.exe`.
4. Open <http://127.0.0.1:8765> in your browser.

**Good to know**
- The app is **not code-signed**, so Windows SmartScreen may warn: choose "More info", then "Run anyway".
- VirusTotal scan of the release zip: 1 engine out of 66 flagged it (a generic heuristic detection, no malware family named); [report](https://www.virustotal.com/gui/file/fb7b72530d16b7b08e76aea0cfe5a130854c7389e4b8c8093faee4a05c7e8469).
- It opens in **DEMO mode**: everything works offline with clearly labelled synthetic data. Nothing is sent anywhere.
- Linux, macOS and Docker: see the [install guide](docs/INSTALL.md).

## Use it with your own U1

1. Open the **Connect** screen.
2. Type your printer's private address (for example `192.168.x.x`).
3. Read the list of allowed requests, tick **"I own this printer"**, press **Capture (read-only)**.
4. You get what the printer reports (state, versions, temperatures over time) and the findings from the rules, with the capture saved to the History screen if you wish.

![The Connect screen](docs/media/screens/02-connect.png)

The capture never contains your address or file names. If the live stream closes early, the app checks with a few more read-only status requests whether the printer itself still answers, so a lost connection is not mistaken for a stopped printer.

## What works today

| Feature | State |
|---|---|
| Offline decoder for 413 official error codes (paraphrased, with link) | tested on synthetic data |
| Deterministic rules engine: same observations and same rule set always give the same findings and the same hash. 12 rules | tested on synthetic and real-capture data, on Windows, Linux and macOS (identical replay hash in CI) |
| Explainable findings: evidence for, evidence against, what is missing, limits, official references. No score, no percentage | tested |
| Read-only live capture from the Connect screen | tested against a mock and on the owner's U1 (no write ever sent) |
| Print-quality assistant ("needs your eyes"): 16 symptoms, causes in the official order, evidence only from numbers you type or saved temperatures | tested |
| Timeline of the **observed window**: phases, explicit gaps, source and time quality per row | tested on real captures and 17 synthetic scenarios |
| `U1-DEB` export, safe import and replay ([spec](docs/U1-DEB.md)) | tested; a ready-made example and a validator are in the repo |
| Windows build (one folder, no Python needed) | started and checked on the developer PC; **not yet tested on a clean Windows 11** |
| English and French interface | both complete |

**Honest status:** the real captures come from the owner's own U1 (firmware 2.1.0) and are normal prints: a 27-minute print (9,333 frames) and a 55-minute multi-colour print (18,339 frames). **No real fault has been captured yet**, so every incident you can open in the app is labelled `SYNTHETIC`. That is the main thing this project still needs: see [real incidents wanted](#real-incidents-wanted).

## Safety model

U1 Doctor never controls the printer.

- One single module may open a network connection to a printer. The web interface reaches it through one route (`POST /api/v1/live/capture`) that refuses to run without explicit owner consent, accepts one private IPv4 address, and rejects requests that do not come from the app itself.
- Every request is checked against a frozen allowlist **before** any network I/O: `GET /server/info`, `GET /printer/info`, `GET /printer/objects/list`, `POST /printer/objects/query` (read-only query) and one WebSocket method, `printer.objects.subscribe`. Anything else is refused.
- Pause, resume, cancel, restart, emergency stop and `printer.gcode.script` are covered by tests that must stay refused.
- Supervised sessions on the owner's U1 (scripted runs, a capture from the Connect screen and a 55-minute passive watch of a print) recorded **0 non-read operations**. The evidence is in [`docs/evidence/`](docs/evidence/).
- The app listens on `127.0.0.1` only. Nothing leaves your machine.

Details: [`docs/threat-model.md`](docs/threat-model.md), [`docs/capability-matrix.md`](docs/capability-matrix.md), [`SECURITY.md`](SECURITY.md).

## What it does not claim

- A lost connection never means the printer stopped.
- The timeline describes the observed window only. No gap record does **not** prove the data is complete.
- Timestamps are the PC's receipt time unless proven otherwise. Machine clocks are never read as UTC.
- A SHA-256 on a bundle proves **integrity only**, never who made it.
- The official wiki warns that the displayed code may not be the real fault. The decoder reports what the code says, not a diagnosis.
- Two rules rest on thresholds measured on a single print (a hot nozzle with its fan at zero, for one). They say so in their findings and rate themselves weak.
- Export redaction is best effort and is not a guarantee of anonymity. Review a bundle before sharing it.

Full list, each limit with its source: [`docs/LIMITS.md`](docs/LIMITS.md).

## Why owner-readable evidence

According to the official Snapmaker wiki, the U1's exported system logs are encrypted: the archive cannot be read locally, and only Snapmaker support can open it. U1 Doctor does not read or decrypt those logs. It gives the owner something different: readable, hash-verifiable evidence built from read-only observations the owner authorizes, which can be inspected and replayed locally. Source: [`docs/wiki-findings.md`](docs/wiki-findings.md), section 2.

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

## Real incidents wanted

The rules were written from the official documentation and tested on one healthy printer. What would improve them most is a **real incident**: the error code that appeared, the firmware, when it happened and what U1 Doctor said. If you have one, [open an incident report](https://github.com/stormz85ia/u1-doctor/issues/new?template=incident-report.yml): a short form, nothing is sent by the app itself. Read [how to share a report](docs/SHARE_A_REPORT.md) first: issues are public, so never include serial numbers, addresses or file names.

## Run from source

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

At the time of writing: 914 backend tests, 82 frontend tests and 14 browser (Playwright) tests pass, with `ruff`, `mypy` and `tsc` clean. CI runs the same checks on Windows, Linux and macOS.

## More documentation

- [`docs/INSTALL.md`](docs/INSTALL.md): install guide (executable, source, Docker) and where your data lives.
- [`docs/U1-DEB.md`](docs/U1-DEB.md): the evidence bundle format and its validator.
- [`docs/LIMITS.md`](docs/LIMITS.md): what is not covered or not yet proven.
- [`docs/spec/`](docs/spec/): the original requirements and the read-only hardware test protocol (in French).
- [`CONTRIBUTING.md`](CONTRIBUTING.md): tests, conventions, honesty rules.
- [`SECURITY.md`](SECURITY.md): the read-only allowlist and how to report a vulnerability privately.

## Related community projects

U1 Doctor is not a dashboard and does not drive the printer. Nearby projects that do other jobs:

- [U1 Print Hub](https://github.com/dlgambill/u1hub) (MIT): farm dashboard, queue, scheduling and a per-printer logbook. It sends commands to the printers. U1 Doctor only reads.
- [Snapmaker Studio](https://github.com/DVOpenLabs/snapmaker-studio) (MIT): checks a 3MF or STL file before slicing.
- [U1 Dry Run](https://github.com/DesignMaster-Solutions/u1-dryrun) (GPL-3.0): runs sliced G-code through the real U1 firmware without a printer.

No code is copied from these projects. The comparison is in [`docs/ORIGINALITY_AUDIT.md`](docs/ORIGINALITY_AUDIT.md).

<details>
<summary><b>En français</b></summary>

**U1 Doctor** est un outil local et en lecture seule pour la Snapmaker U1. Quand une impression s'arrête, il t'aide à répondre à trois questions sans deviner : que veut dire ce code d'erreur (décodeur hors ligne de 413 codes officiels), que s'est-il passé et quand (frise construite uniquement avec des faits observés), et que montrer à quelqu'un d'autre (un paquet de preuves `U1-DEB` que chacun peut rouvrir et rejouer chez soi).

- **Il ne pilote jamais l'imprimante** : ni pause, ni annulation, ni G-code. Il ne lit une imprimante que si tu saisis son adresse privée et coches la case d'accord, avec une courte liste fixe de requêtes de lecture.
- **Tout reste sur ton PC** : pas de cloud, pas de télémétrie, pas d'IA. L'application n'écoute que sur `127.0.0.1`.
- **Démarrer** : télécharge le zip de la [dernière release](https://github.com/stormz85ia/u1-doctor/releases/latest), extrais-le avec « Extraire tout », lance `u1-doctor.exe`, puis ouvre <http://127.0.0.1:8765>. Windows peut afficher un avertissement SmartScreen, car l'exe n'est pas signé.
- **Bilingue** : l'interface existe en français et en anglais, avec un bouton en haut à droite.
- **Statut honnête** : seules des impressions normales ont été capturées sur une vraie U1 ; aucune panne réelle pour l'instant, donc tous les incidents de démonstration sont marqués `SYNTHETIC`. La [présentation illustrée](https://stormz85ia.github.io/u1-doctor/presentation/) est aussi disponible en français.

</details>

## License

MIT, see [`LICENSE`](LICENSE). The official Snapmaker repositories (`u1-klipper`, `u1-moonraker`, `u1-fluidd`) are GPL-3.0; no code is copied from them. Error-code descriptions are short paraphrases with links to the official wiki.

"Snapmaker" and "U1" are trademarks of their owner. They are used here only to say which printer this tool is for.
