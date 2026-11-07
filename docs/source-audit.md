# Source audit — G0 (2026-11-05)

Status legend: **VERIFIED_DOCUMENT** (read in a primary source today) · **UNVERIFIED_ON_HARDWARE** (documented or inferred, never observed on the owner's U1) · **TESTED_REAL** (none yet). Nothing here was observed on a U1. No connection to any printer was made.

Method: public pages read via a page fetcher and the built-in browser (the Snapmaker Wiki is JS-rendered; read in-browser). GitHub commit hashes were **not visible** in fetched pages → "commit: NOT RECORDED" (to pin at G1 with `git ls-remote`).

## 1. Snapmaker repositories
| Item | Finding | Status |
|---|---|---|
| `Snapmaker/u1-moonraker` | default branch `main`, ~2,139 commits, sidebar license **GPL-3.0**; README: Moonraker fork for U1 | VERIFIED_DOCUMENT (license file itself not opened) |
| `lava/moonraker.conf` (raw, main) | `[server] host: all, port: 7125`; `klippy_uds_address`; `[authorization]` has `trusted_clients` (172.18.0.0/16, 10/8, 127/8, 169.254/16, 172.16/12, **192.0.0.0/8**, FE80::/10, ::1) and `cors_domains`; **no `force_logins`**; `[mqtt]` 127.0.0.1:1883, `enable_moonraker_api: False`; components incl. `exception_manager.py`, `snapmakercloud.py` | VERIFIED_DOCUMENT of the *repo config*; UNVERIFIED_ON_HARDWARE for a real U1 |
| `Snapmaker/u1-klipper` | `main`, ~5,379 commits, **GPL-3.0** | VERIFIED_DOCUMENT |
| `Snapmaker/u1-fluidd` | `main`, ~2,735 commits, **GPL-3.0**; which objects it subscribes to: **not read** | partial |

### Key source finding (error codes) — `klippy/coded_exception.py`, `klippy/exception_manager.py` (u1-klipper, main)
- `CodedException.structured_code()` = `{level:04d}-{id:04d}-{index:04d}-{code:04d}` → confirms the wiki format (level, module id, index, code). VERIFIED_DOCUMENT.
- Klipper registers a printer object **`exception_manager`** whose `get_status()` returns `{'exceptions': [...]}` with entries `{id,index,code,level,message}`. VERIFIED_DOCUMENT (code reading) → **candidate for `printer.objects.query`; presence on a real U1 UNVERIFIED_ON_HARDWARE.**
- Only **non-oneshot** exceptions are appended to that list; oneshot ones (`oneshot=1` default) are only pushed to Moonraker via the remote method `raise_exception`. ⇒ a poll of `exception_manager` may **miss** transient codes; live capture may need the WS notification path (unverified how Moonraker re-broadcasts). Persistent ones are also stored in `exception_persistent.json` on the printer (not accessible read-only; do not attempt).
- G-code commands `RAISE_EXCEPTION`, `CLEAR_EXCEPTION`, `QUERY_EXCEPTION`, `RM_EXCEPTION_PERSISTENT_FILE` exist → **must never be sent** (covered by the denied `printer.gcode.script`).
- **Index convention is NOT uniform across modules** (wiki): in `0522` toolhead MCU codes use index 2–5 for toolheads 1–4 (index 0=host, 1=mainboard, 100=none); in `0523` index 0–3 = toolheads 1–4; in `0525` the example index 2 = toolhead/feeder 3. ⇒ never derive a toolhead from `index` without a per-code table row. Wiki row text is the mapping authority.

## 2. Snapmaker Wiki
- Error-code page (429 table rows read in-browser): format four groups of four digits; severity `0000 Invalid / 0001 Notice / 0002 Warning (print paused) / 0003 Error (print stopped)`; main modules `0522` motion, `0523` toolhead, `0525` feeder, `0526` heated bed, `0527` chamber temp, `0528` homing, `0529` G-code, `0530` detection/calibration, `0531` slicing file. Notes: displayed code **may not be the real fault**; some states "still under refinement". VERIFIED_DOCUMENT.
- Exact rows (fixtures, summarized not copied): `0002-0525-0002-0002` = Warning, "Filament Feeder 3 Loading Anomaly" (check tangles/loose connector; resume via play if printing) ✅ matches the cahier example. Neighbours `…-0000/0001` feeder anomaly (contact support), `…-0003` not loaded, `…-0004` extrusion blockage at drive gear, `…-0005/0006` loading timeout. `0003-0522-0002-0008` = toolhead 1 MCU connection interrupted. `0002-0523-0000-0000` = toolhead 1 filament runout.
- Release notes: **V2.1.0 (2026-11-04) is the current latest** ✅; previous V2.0.0 (2026-09-15), V1.6.0 (2026-08-25). Per-version change text was collapsed/not read. VERIFIED_DOCUMENT.
- The wiki states nothing about Moonraker/API/log access on the pages read. UNKNOWN.
- Licensing of wiki text unverified → store **paraphrased** summaries + link only (cahier §14.2).

## 3. Moonraker docs (readthedocs, latest)
- `printer.objects.list` GET `/printer/objects/list`; `printer.objects.query` **GET and POST** `/printer/objects/query` (body `{"objects":{...}}`); `printer.objects.subscribe` is **JSON-RPC over WebSocket only** (no HTTP). VERIFIED_DOCUMENT.
- Mutating endpoints (all POST): `/printer/gcode/script`, `/printer/print/{start,pause,resume,cancel}`, `/printer/restart`, `/printer/firmware_restart`, `/printer/emergency_stop` + JSON-RPC equivalents. All in the deny test list.
- WS: `ws://host:port/websocket`, JSON-RPC 2.0; `server.connection.identify` exists (client_name, version, type, url) — **the docs read do not say it is mandatory**; calling it is not on the allowlist (decision for G2 audit). Auth: `X-Api-Key` / Bearer JWT / oneshot token; untrusted clients need it. `eventtime` = Klipper monotonic time, **not UTC** ✅ (as in cahier §7.3).
- Notification names (`notify_status_update`, etc.) page not fetched; `notify_klippy_disconnected` mentioned. To audit in G2.

## 4. Innovation Fund Phase 2 rules (forum post by Zoe_M, 2026-10-22)
- **Deadline inconsistency inside the official post**: table says submissions close "2026.12.24"; posting section says close after **2026.12.23 11:59 PM UTC**; community vote deadline **2026.12.31 23:59 UTC**; vote + tech review 2026.12.25 → 2027.01.13; provisional winners 2027.01.14; final 2027.01.21. ⇒ keep cahier plan: publish **before 2026-12-23 23:59 UTC**, target 15–18 Dec.
- Score = community vote **20%** + tech committee **80%**; four unweighted dimensions (Innovation, Technical Depth & Explainability, Completeness, U1 Ecosystem). Completeness requires **validation on physical U1 hardware**; Technical Depth wants empirical data/logs/regression results. Top 60 Cash Fund → in-depth review. Cash Fund and U1 Sponsorship can't be awarded for the same project. Unlisted topics skip vote/review. Misrepresentation of originality → disqualification risk. VERIFIED_DOCUMENT.

## 5. Competitor mini-benchmark (dates as read, forum)
| Project | Date | What it is | Overlap with U1 Doctor |
|---|---|---|---|
| U1 Dry Run (alandebortolo) | 2026-11-02 | Docker: runs sliced G-code through u1-klipper batch mode; GPL-3.0 | none (pre-print simulation) |
| Snap Studio (kameka22) | 2026-10-28 | Desktop: slicing, queue, camera, print over Moonraker WS; GPL-3.0+ | monitoring only; no evidence/replay |
| U1 Fix Pack (alandebortolo) | 2026-11-03 | Firmware bug repros/patches (#22, #18) | none (patches) |
| U1 Print Rescue (bgrubbs) | 2026-11-05 | Camera overlay proposal (sponsorship) | none |
| **U1 Monitor IC** | 2026-11-04 | "monitor your U1 from local network" — **not read** | possible monitoring overlap; **TO AUDIT** |
| **Snapmaker Studio** (pre-print intelligence) | 2026-10-20 | **not read**; listed in related topics | possible diagnostic overlap; **TO AUDIT** |
| SliceGate, u1hub | — | not read | TO AUDIT |
Forum keyword search for "forensic/diagnostic" was **not run** (fetcher restriction) → originality claim **not yet substantiated**. Do it manually or with the browser pane before any "Original New Idea" declaration.

## 6. Not verified / to do
Commit SHAs; LICENSE files; `klippy/extras/` (feeder/RFID modules, `print_task_config`, `filament_detect`); Fluidd subscribed objects; Moonraker `exception_manager` component's broadcast behavior; whether HTTP auth is enforced on a real U1; everything on real hardware.

## 7. Originalité — audit des chevauchements (lecture forum/GitHub, 2026-11-05)
Aucun projet lu ne couvre ensemble (a) diagnostic passif lecture seule, (b) explication de codes, (c) reconstruction d'incident, (d) bundle de preuves rejouable.
| Projet | Auteur / date | Licence | Chevauchement |
|---|---|---|---|
| U1 Monitor IC | Beckskey, 2026-11-03 | non indiquée | (a) LOW — app Android d'automatisation écran; (b)(c)(d) NONE |
| Snapmaker Studio | DeadlyVirusIn, 2026-09-23 | MIT | pré-impression fichiers; (a)(b)(d) LOW, (c) NONE |
| U1Hub (dlgambill) | MIT, Tier 3 Phase 1 | MIT | (a)(c) MEDIUM — logbook + « diagnostics download », mais pilote l'imprimante; (b)(d) LOW |
| hanye Print-Farm Console | hanye1993, 2026-10-28 | fermé | (a)(c) MEDIUM — IA + logs d'opérations; U1 non livré; (b)(d) LOW |
| U1 Print Rescue | bgrubbs, 2026-11-05 | — | caméra; NONE/LOW |
Non lus (titres seulement) : SliceGate, PaxxMaker, AMS Hub, Slicer Cleaner, Print Cost & Profit. Repos GitHub de Monitor IC / Studio / Print Rescue non ouverts.
Signal de demande : les logs officiels U1 seraient chiffrés (fil « Logs for Troubleshooting? ») → un outil de lecture/rejeu fondé sur observations autorisées a un besoin déclaré.
Conclusion prudente : « Original New Idea » plausible pour le cœur (provenance + règles explicables + U1-DEB), à **reconfirmer juste avant la soumission** ; U1Hub est le voisin à citer et à comparer honnêtement.
