# Install U1 Doctor

U1 Doctor is an unofficial, local, read-only diagnostic tool for the Snapmaker U1. It runs on your PC and listens on `127.0.0.1` only.

Screenshots of the real UI, taken with the built-in **synthetic demo data** (not from a printer; the DEMO banner is visible on every screen):

| Overview | Incident timeline | Error codes |
|---|---|---|
| ![Overview](media/screens/03-overview.png) | ![Incident timeline](media/screens/06-timeline.png) | ![Error codes](media/screens/04-error-codes.png) |

All 11 screens are in [`docs/media/screens/`](media/screens/).

## Before you start: what is and is not verified

- **Release `v0.1.2-g1` exists** (the current build). `v0.1.0-g1` lacks the export of your own saved captures; `v0.1.1-g1` has it but scored worse on VirusTotal; both are marked as superseded: [releases page](https://github.com/stormz85ia/u1-doctor/releases/latest). It is built by GitHub Actions and smoke-tested there.
- The test kit shipped in the zip was run on the developer PC (Windows 11, zip downloaded with a browser): the exe started in about a second, listened on `127.0.0.1` only, created no firewall rule and raised no SmartScreen or antivirus alert. That PC had Defender real-time protection off and has development tools, so the result is weaker than a test on a clean second PC, which has **not** been done yet.
- VirusTotal scan of this zip: 1 engine out of 66 flagged it: Zillya (`Trojan.Stealer.Win64.2764`, the same label it gave the 0.1.1-g1 zip). The other 65 detect nothing, including the generic detection Bkav Pro gave 0.1.1-g1. We believe it is a false positive typical of unsigned PyInstaller executables, but cannot prove it from here: the source is public, the build is made by GitHub Actions, and the app reads no browser data, cookies, passwords, clipboard or registry. [Report](https://www.virustotal.com/gui/file/e48706561a43531f10d8968b9521eabb4590bc4c9f9d8dae507a8fb44e484912). Earlier builds: 0.1.0-g1 was flagged by 1 engine out of 66, 0.1.1-g1 by 2 out of 65.
- The executable is unsigned, so Windows SmartScreen may warn: choose "More info", then "Run anyway".
- Source: `IMPLEMENTATION_STATUS.md` (REQ-015), `BACKLOG.md`.

## A. Windows executable (from the release)

1. Download `u1-doctor-0.1.2-g1-win64.zip` and its `.sha256.txt` from the [release page](https://github.com/stormz85ia/u1-doctor/releases/latest).
2. Verify the hash in PowerShell before unpacking:

   ```powershell
   Get-FileHash .\u1-doctor-0.1.2-g1-win64.zip -Algorithm SHA256
   ```

   Compare the output with the published value: `E48706561A43531F10D8968B9521EABB4590BC4C9F9D8DAE507A8FB44E484912`. If they differ, do not run the file.
   (A SHA-256 proves the file was not altered or corrupted. It does not prove who made it.)
3. Unpack the zip with Windows Explorer (**Extract all**; WinRAR or 7-Zip would drop the download mark Windows uses for SmartScreen). It is one folder, no Python needed. Run `u1-doctor.exe`. A small test kit (`RUN-TEST.cmd`) is included: it checks the exe on your PC and writes a report you can read before sharing it.
4. Open <http://127.0.0.1:8765>. Set `U1DOCTOR_PORT` to change the port.

The build is produced by `scripts\build_windows.ps1`. It bundles the owner's 3D model (`frontend/public/models/u1-jay.glb`).

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

## D. First steps in DEMO mode (no printer needed)

Everything works offline. The **Connect** screen is the only part that can reach a printer, and only after you type its private address and tick the approval box. It then takes a short read-only capture (3 GET requests and 1 live subscription, 3 to 60 seconds) and, if the stream closes early, a few more read-only status requests.

1. Open the app. A banner and a mode badge show **DEMO** at all times.
2. Look up an error code in the offline decoder. An unknown or malformed code gives `INCONCLUSIVE`, never a guess.
3. Open a scenario and read its timeline and findings (evidence for, evidence against, what is missing, limits, official references).
4. Every synthetic scenario is labelled `SYNTHETIC`. The only real data is recorded captures of normal prints (labelled as real, with no fault in them).
5. Export an evidence bundle (U1-DEB) and re-import it to replay it locally. See [`U1-DEB.md`](U1-DEB.md).

## E. The read-only guarantee

1. U1 Doctor never controls the printer: no pause, resume, cancel, restart, emergency stop or G-code.
2. Only one transport module may open a network connection to a printer.
3. Requests are checked against a frozen allowlist before any network I/O: 4 HTTP requests and 1 WebSocket method.
4. The target must be a literal private (RFC1918) IPv4 address on port 7125, and a real connection needs explicit owner consent.
5. The app listens on `127.0.0.1` only; forbidden requests are covered by tests that must stay refused.

Details: [`threat-model.md`](threat-model.md). Known limits: [`LIMITS.md`](LIMITS.md).
