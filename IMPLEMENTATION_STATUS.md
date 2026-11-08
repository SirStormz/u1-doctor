# IMPLEMENTATION_STATUS — updated 2026-11-08 (release v0.1.7-g1 published; G0–G2, G4 U1-DEB and G3 timeline done)

States: PLANNED · IMPLEMENTED_UNTESTED · TESTED_SYNTHETIC · TESTED_REAL · BLOCKED. **H-01 passed 2026-11-05 (TESTED_REAL for: Moonraker HTTP :7125, objects list, official version read; nothing else).** H-02 passed 2026-11-05 (WS subscribe, 27 min normal print, 9 333 frames, no gap > 0.74 s). Machine calls made so far: **3 read-only GET + 1 WS subscribe** (see `docs/evidence/H-01/manifest.json`). Observed: Moonraker 2.1.0, Klipper 2.1.0.157, 197 objects, `exception_manager` component present.

| REQ | P | State | Evidence / note |
|---|---|---|---|
| REQ-001 Onboarding FR/EN | M | TESTED_SYNTHETIC | Welcome + FR/EN, three-step first-start assistant (language, Simple/Expert level, demo or connect, the three marks; Esc skips), self-ticking *Getting started* list, replay from Settings; Simple/Expert display level (vitest + Playwright). No test with real new users; A11y/zoom not audited |
| REQ-002 Offline decoder | M | TESTED_SYNTHETIC | 413 catalog rows from the official table (read 2026-11-06, own wording + article links, mapping provenance), unknown ⇒ INCONCLUSIVE, malformed rejected (`test_scenarios.py`) |
| REQ-003 Critical cases | M | PARTIAL / TESTED_SYNTHETIC | level 0003 ⇒ "do not continue printing" + official ref; support link only generic |
| REQ-004 Manual IP connect | M | TESTED_REAL (once, idle) | Connect screen, RFC1918 literal only; run on the owner's U1 on 2026-11-07 |
| REQ-005 Object discovery | M | TESTED_REAL (count only) | `/printer/objects/list` read from the UI; object names are not displayed yet |
| REQ-006/007 History / timeline | M | TESTED_REAL (observed window) | `timeline.build_timeline`: observed window, sessions, explicit gaps only, phases from state transitions, per-row provenance + time quality, no invented past/future. Tested on the real H-02 capture (printing 27 min 25 s then complete, no incident) and 9 synthetic scenarios; UI: Timeline screen source switch (demo / real). Persistent history: sessions saved in the local SQLite (REAL/SYNTHETIC/bundle/Dry Run), listed one by one, never merged. Not covered: automatic saving of live captures (no in-app live capture yet) |
| REQ-008 Deterministic engine | M | TESTED_SYNTHETIC | 8 evaluators (S01-S14 rules), 12 scenarios, golden byte-equality, 25 shuffles/scenario. Ruleset 0.2.0: old goldens changed only in ruleset_hash/replay_hash (checked). Not cross-OS yet (T-025) |
| REQ-009 Explainable finding | M | TESTED_SYNTHETIC | for/against/missing/limits/refs in UI + API |
| REQ-010 Safe import | M | TESTED_SYNTHETIC | `deb.import_bundle`: allowlist, size/ratio/symlink/encrypted/dup/NaN checks, hash + schema validation; hostile-zip corpus in `test_deb.py` |
| REQ-011 Redacted export | M | TESTED_SYNTHETIC | `deb.export_bundle`: best-effort redaction reported in privacy-report.json; deterministic zip. Not a guarantee of anonymity |
| REQ-012 Replay | M | TESTED_SYNTHETIC (one machine) | in-app replay of SYNTHETIC scenarios and of the real capture; imported bundles replayed with the local ruleset (findings always recomputed); same ruleset hash from source and from frozen exe. 2nd machine / OS not tested (T-025) |
| REQ-013 DEMO is explicit | M | TESTED_SYNTHETIC | the app starts empty; demo mode is a header switch (off at every start) that shows the synthetic data under a permanent DEMO banner and badge; the only machine route is `POST /api/v1/live/capture` (consent required); socket guard test |
| REQ-014 Non-mutation | M | TESTED_SYNTHETIC | 113 transport tests (mock) + 1 supervised real session (H-02: 1 outbound frame = subscribe, 0 write). No in-app live capture yet |
| REQ-015 Windows exe | M | TESTED_REAL (developer PC only) | PyInstaller one-folder exe built by GitHub Actions (`release.yml`), opens in its own window (pywebview/WebView2), v0.1.7-g1 published (VirusTotal 0/52 on the zip; v0.1.6-g1 was 0/67). Run on the owner's Windows 11 PC with a browser-downloaded zip (window opens, no WebView2 message). **Not tested on a PC without WebView2 or on a clean second Windows 11** |
| REQ-016 GitHub / EN docs | M | DONE | public GitHub repo, CI (Windows, Linux, macOS, e2e), GitHub Pages presentation, English README and install guide, security policy, code of conduct, six releases (current v0.1.7-g1); originality audit `docs/ORIGINALITY_AUDIT.md` |
| REQ-017 Physical U1 tests | M | PARTIAL (owner-approved sessions only) | H-01 and H-02 done 2026-11-05 (3 GET + 1 WS subscribe, no write). H-03/H-04 need a new explicit owner accord. No real fault captured |
| REQ-018..026 | S/C | PLANNED | — |

Tests run (Windows, Python 3.14 venv, 2026-11-07): `pytest` **933 passed** · `vitest` **88 passed** · 15 Playwright e2e tests (run in CI) · `ruff` clean · `mypy app` clean · `tsc --noEmit` clean · `vite build` OK. CI (Python 3.12) green on main.
Deviations: stdlib migrations instead of Alembic (ADR-0004); no TanStack Query / i18n lib (plain fetch + dictionary).

## G0.5 — Product design & UX (2026-11-05) — **prototype built, design VALIDATED by owner 2026-11-05 (improvements later)**
- Design docs: `docs/design/{DESIGN_VISION,DESIGN_SYSTEM,UX_ARCHITECTURE,COMPONENT_INVENTORY,REVIEW_G0.5-D,MOCKUP_AUDIT,3D_MODEL}.md`.
- Frontend rewritten on a token-based design system (3 themes), 10 screens (4 priority at full fidelity), command palette, 3D viewer (three.js, lazy).
- Tests: `vitest` **38 passed** (16 contrast over 3 themes, 10 axe route checks, keyboard, no-%/no-score rule, DEMO/no-connection, replay identical, report privacy scan) · `pytest` **204 passed** · ruff/mypy/tsc clean · browser check 1920×1080 and 1366×768: 0 horizontal overflow on 10 screens.
- Not done: screen-reader test, 200 % zoom, < 1024 px, FPS measurement, user testing; the 3D model is the owner's own work and is committed (owner's decision 2026-11-07).
