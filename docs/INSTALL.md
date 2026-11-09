# Install U1 Doctor

U1 Doctor is an unofficial, local, read-only diagnostic tool for the Snapmaker U1. It runs on your PC and listens on `127.0.0.1` only.

Screenshots of the real UI, taken with the built-in **synthetic demo data** (not from a printer; the DEMO banner is visible on every screen):

| Overview | Incident timeline | Error codes |
|---|---|---|
| ![Overview](media/screens/03-overview.png) | ![Incident timeline](media/screens/06-timeline.png) | ![Error codes](media/screens/04-error-codes.png) |

All 11 screens are in [`docs/media/screens/`](media/screens/).

## Before you start: what is and is not verified

- **Release `v0.1.9-g1` exists** (the current build). Older releases are superseded: `v0.1.8-g1` lacks the import of log files and the 8 log rules, `v0.1.7-g1` lacks the cross-site request refusal, the exact request count in the approval text, the 8 new live rules, the community causes and the maintenance reminders, `v0.1.0-g1` lacks the export of your own saved captures, `v0.1.1-g1` scored worse on VirusTotal, `v0.1.2-g1` opens in the browser, and `v0.1.4-g1` cannot start its window when the zip is downloaded with a browser, `v0.1.5-g1` starts with the demo data already shown, and `v0.1.6-g1` lacks the Simple/Expert mode and the first-start assistant. `v0.1.3-g1` was removed. [releases page](https://github.com/SirStormz/u1-doctor/releases/latest). It is built by GitHub Actions and smoke-tested there.
- The test kit (kept in the repository under `scripts/second-pc-test/`, no longer shipped in the zip) was run on the developer PC with the 0.1.5-g1 zip (Windows 11, zip downloaded with a browser): the exe started in about a second, listened on `127.0.0.1` only, created no firewall rule and raised no SmartScreen or antivirus alert. That PC had Defender real-time protection off and has development tools, so the result is weaker than a test on a clean second PC, which has **not** been done yet.
- VirusTotal: this 0.1.9-g1 zip has **not been scanned yet** (SHA-256 above, so you can look it up yourself). The previous builds scored 0 engines out of 66 for 0.1.8-g1 ([report](https://www.virustotal.com/gui/file/265d992ec37d537d861d03183b765148a48f3c5f0671bd67fc64339f554a5e07)), 0 engines out of 52 for 0.1.7-g1 ([report](https://www.virustotal.com/gui/file/137d74a73cd12687844c781186b1bcd21002bcf53f3735b1e0b0b0aa2442d4e7)) and 0 engines out of 67 for 0.1.6-g1 ([report](https://www.virustotal.com/gui/file/b744d8c9cf7b3a275aa474fc8a44fd7c3e9cbc3c1a00ce73002df798add2fb92)). Earlier builds: 0.1.0-g1 was flagged by 1 engine out of 66, 0.1.1-g1 by 2 out of 65, 0.1.2-g1 by 1 out of 66 (Zillya, `Trojan.Stealer.Win64.2764`) and 0.1.5-g1 by 0 out of 65 ([report](https://www.virustotal.com/gui/file/594599bf711db552a6e8b01c27c25f642b6c816a162cfdf7d57410ae6b8812b9)); we believe the earlier detections were false positives typical of unsigned PyInstaller executables. A clean scan is not a guarantee and detections can change: the source is public, the build is made by GitHub Actions, and the app reads no browser data, cookies, passwords or clipboard. It reads one Windows registry value (the installed WebView2 version, to know whether its window can open) and removes the "downloaded from the Internet" mark from the `.dll` files inside its own bundled `_internal` folder (and no other file, not even other files you put next to the exe) so that window can start.
- The executable is unsigned, so Windows SmartScreen may warn: choose "More info", then "Run anyway".
- Source: `IMPLEMENTATION_STATUS.md` (REQ-015), `BACKLOG.md`.

## A. Windows executable (from the release)

1. Download `u1-doctor-0.1.9-g1-win64.zip` and its `.sha256.txt` from the [release page](https://github.com/SirStormz/u1-doctor/releases/latest).
2. Verify the hash in PowerShell before unpacking:

   ```powershell
   Get-FileHash .\u1-doctor-0.1.9-g1-win64.zip -Algorithm SHA256
   ```

   Compare the output with the published value: `0DC8F40B8C7B351A12992F040F796AE287227D4304D4BAD1341605787D5D1BD4`. If they differ, do not run the file.
   (A SHA-256 proves the file was not altered or corrupted. It does not prove who made it.)

   Optional, for builds **from 0.1.8-g1 on** (the release workflow gained this step on 2026-11-08 and `0.1.8-g1` is the first build that carries it, verified after its first run; `0.1.7-g1` and older have none): check that the zip was built by this repository's GitHub Actions release workflow, with the [GitHub CLI](https://cli.github.com/):

   ```powershell
   gh attestation verify .\u1-doctor-<version>-win64.zip --repo SirStormz/u1-doctor
   ```

   It prints the workflow, commit and run that produced the file, or fails. This is GitHub's build provenance (Sigstore-signed): it says where and from which commit the zip was built, not that the code is safe.
3. Unpack the zip with Windows Explorer (**Extract all**; WinRAR or 7-Zip would drop the download mark Windows uses for SmartScreen). It is one folder, no Python needed. Double-click `u1-doctor.exe`: a window opens with the app (no console, no browser). If the Microsoft WebView2 component is missing (some Windows 10 PCs), the app offers to install it once with Microsoft's own installer shipped in the zip (internet and a Windows permission prompt needed). The zip holds only the app: `u1-doctor.exe`, its runtime files, the WebView2 installer and the licence.
4. The app serves itself on `127.0.0.1:8765` only (set `U1DOCTOR_PORT` to change the port); closing the window stops it. Your language and theme choices are kept between runs.
5. If the window cannot start, the app opens in your browser instead and writes the reason to `%APPDATA%\U1 Doctor\error.log`. Your user folder path is replaced by `%USERPROFILE%` in that file, but read it before attaching it to an issue: it may still hold other folder or file names.

The build is produced by `scripts\build_windows.ps1`; the release workflow installs the Python dependencies at the exact versions of `backend/constraints-release.txt` and pins every GitHub Action by commit SHA. It bundles the owner's 3D model (`frontend/public/models/u1-jay.glb`).

## B. From source (Windows PowerShell)

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

Open <http://127.0.0.1:8765> (`python -m app` serves on `127.0.0.1:8765`; `U1DOCTOR_PORT` changes the port).

For frontend development, run the backend as above and, in another terminal:

```powershell
cd frontend
npm run dev
```

Vite serves on port 5173. A bare URL shows the landing page; `#/overview` opens the app.

## B2. With Docker (any OS with Docker)

```
docker build -t u1-doctor .
docker run --rm -p 127.0.0.1:8765:8765 -v u1doctor-data:/data u1-doctor
```
Then open `http://127.0.0.1:8765`. Publish the port on `127.0.0.1` only, as above: the app has no login and must not be exposed on a network. Inside the container it listens on all interfaces (`U1DOCTOR_HOST=0.0.0.0`, set by the image) so the published port works; it still refuses requests whose `Host` header is not `127.0.0.1` or `localhost`. The image runs as a non-root user and keeps its database in the `/data` volume. It does not contain the 3D model (the app shows a still image instead). Built and run on the developer PC only; the image is not published anywhere.

## C. Where your data lives

| Run mode | Database file |
|---|---|
| Executable | `~/.u1-doctor.sqlite3` (your user folder) |
| From source (`python -m app`) | `u1doctor.sqlite3` in the current folder |
| Either | set `U1DOCTOR_DB` to choose another path |

It is a local SQLite file holding saved replays and the history of observation sessions. Nothing is sent anywhere.

## D. First steps with demo mode (no printer needed)

Everything works offline. The **Connect** screen is the only part that can reach a printer, and only after you type its private address and tick the approval box. It then takes a short read-only capture (5 GET requests and 1 live subscription message, 3 to 60 seconds; one of the GET is `/server/files/directory?path=logs`, which only reads the free space of the log partition, another is `/server/history/totals`, which only reads the job totals of the print history for the maintenance reminders) and, if the stream closes early, up to 6 more read-only status GET requests (3 probes of `/server/info` and `/printer/info`): 11 GET at most. If the printer's history component is off, the reminders simply say "not observable" and the capture goes on. The result also shows a connectivity self-check (time taken by each request, stream drops, whether the address changed since your last capture); router settings and cloud or account problems are not checked. The live connection sends no keepalive pings; it only answers the printer at protocol level (pong, closing handshake). One capture runs at a time.

1. Open the app: a short **first-start assistant** appears (language, Simple or Expert, demo or your own printer; `Esc` skips it). Then it **starts empty**, and a grey strip says so. Turn on **Demo mode** (switch in the header) to fill the screens with synthetic data; a banner and a badge show **DEMO** for as long as it is on, and it is off again at every start.
2. Look up an error code in the offline decoder. An unknown or malformed code gives `INCONCLUSIVE`, never a guess.
3. Open a scenario and read its timeline and findings (evidence for, evidence against, what is missing, limits, official references).
4. Every synthetic scenario is labelled `SYNTHETIC`. The only real data is recorded captures of normal prints (labelled as real, with no fault in them).
5. Export an evidence bundle (U1-DEB) and re-import it to replay it locally. See [`U1-DEB.md`](U1-DEB.md).
6. Also in the app: the offline G-code pre-flight (a `.gcode` file, or a sliced `.3mf` from which only the embedded G-code is read) and the "what support will ask" checklist (Error codes screen), the print-quality assistant, the History of saved sessions and the U1 Dry Run import (Incident timeline screen), and `Ctrl K` to jump anywhere. The full list of screens is in the [README](../README.md#what-is-inside-the-11-screens).

## E. The read-only guarantee

1. U1 Doctor never controls the printer: no pause, resume, cancel, restart, emergency stop or G-code.
2. Only one transport module may open a network connection to a printer.
3. Requests are checked against a frozen allowlist before any network I/O: 3 HTTP GET requests and 1 WebSocket method.
4. The target must be a literal private (RFC1918) IPv4 address on port 7125, and a real connection needs explicit owner consent.
5. The app listens on `127.0.0.1` only; forbidden requests are covered by tests that must stay refused.
6. Every POST or DELETE to the local API must come from the app's own page (no foreign `Origin`, plus a custom `X-U1D` header), so another web page open in your browser cannot drive it.

Details: [`threat-model.md`](threat-model.md). Known limits: [`LIMITS.md`](LIMITS.md).
