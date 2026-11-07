# G0.5-A — Audit (2026-11-05)

Inputs: `U1-DOCTOR-MOCKUP.png`, cahier V2 §10, current UI (`frontend/src/App.tsx`), project rules (cahier §0, §8.2, §10.3).

## 1. Current UI state (what exists)
| Item | State | Decision |
|---|---|---|
| Shell: 3 tabs, inline Tailwind classes, system font, light/dark by OS | functional, **no design system, no tokens, one 200-line file** | replace the shell + visuals; **keep** `api.ts`, i18n dictionary approach, Vitest setup |
| Error Explorer, Replay Lab behaviour | correct, tested (5 vitest) | keep logic, re-skin with new components |
| Backend/API/engine (204 pytest) | independent | **untouched**; one fixture added (`demo_extrusion_blockage`) so the prototype renders engine output, not hand-drawn data |
| Screens | 3 of 10 | prototype covers 10 (4 priority at full fidelity) |

## 2. Reference image: keep / change / reject
**Keep** (strong ideas): dark engineering theme and palette (`#0A1220` bg, `#111B2B` surface, `#00C7FF` cyan, green/amber/red), left sidebar + top bar with persistent "Read-Only Analysis", incident header with prev/next, vertical event timeline with severity chips, evidence-bundle checklist, report card with Preview/Export, status-language legend, "evidence before conclusions" principle list.

**Reject — conflicts with project rules (the image is not a feature spec):**
| In mockup | Rule broken | Replacement |
|---|---|---|
| "92% Confidence" ring, "7% / 3%" other causes | no invented probabilities (cahier §8.2, §10.3) | **Evidence Ledger**: counts of evidence for / against / missing + quality label (Strong/Moderate/Weak/Unknown) |
| "Healthy (System)" | no health score | none; show only observed facts with freshness |
| Codes `E-EX-102`, signature `PPU-EX-004` | invented codes; only official table codes allowed | real catalog codes, e.g. `0002-0525-0002-0004` |
| "Print aborted", "Suspected: Head 3 Extrusion Anomaly" as headline | conclusion stronger than evidence; mapping unverified | headline = **observed fact** ("Code reported by user: …"), hypotheses below, labelled `COMMUNITY_HYPOTHESIS`/`OFFICIAL_REFERENCE` |
| 4 live heads, temps, PLA weights, RFID spool kg | T1–T4 mapping and feeder/RFID data unverified (cahier §4.2, H-04) | heads shown as **slots**: `UNMAPPED`/`INFERRED`/`VERIFIED` badge; empty state "no data" |
| Serial number, firmware v1.4.2 | privacy (serial) + firmware unverified | firmware "UNKNOWN" until observed; serial never shown |
| "Causal Graph (Inferred)" | causation vs correlation (cahier §8.1) | **Hypothesis map**: solid node = observed fact, dashed = hypothesis, edge = "temporal proximity" (never "caused") |
| "Guided Troubleshooting" steps (re-run extrusion test, replace nozzle) | no automated/physical actions beyond official procedure (§15) | "Official procedure" card: paraphrase + link; no step tracker that implies we verify the action |
| Evidence bundle: `printer.log` 6.2 MB, motion data | logs reported encrypted/unavailable; U1-DEB file set is fixed | bundle card lists the **real U1-DEB files** with sizes and SHA-256 |
| ms-precision timestamps | only receipt time known (T-014) | show seconds + `RECEIPT_ONLY` marker; no false precision |
| "U1 Connected" green pill in a mock | DEMO must not look connected | dedicated DEMO state (see Vision) |
| Window chrome fake | irrelevant | native window frame |

## 3. Creative improvements beyond the reference (each justified)
1. **Provenance chip on every datum** (REAL / SYNTHETIC / USER_REPORTED / IMPORTED + time quality) — the product promise is provenance; makes it visible, not hidden in a tooltip.
2. **Evidence Ledger** (counts, not %) — replaces the confidence ring with something truthful and still glanceable.
3. **Gap bands in the timeline** (hatched) — shows "absence of data ≠ absence of problem", our core differentiator vs. monitors.
4. **Replay seal** — "same input + same ruleset ⇒ same hash" shown as a verifiable stamp (hash prefix + match state).
5. **Command palette (Ctrl+K)** — paste an error code anywhere → decoded in <3 s (cahier P-01 target <30 s); also jump to screens by keyboard.
6. **Permanent Safety Strip** — "Read-only · 0 requests sent to the printer · local only" (counter from backend), turns the security guarantee into a trust signal.
7. **Three themes from the same tokens** (Night default, Graphite, Light) — proves token centralisation; Light for projector/print; also gives you alternatives to choose from at G0.5-E.

## 4. Roadmap integration
G0.5 sits **between G1 and G2 and runs in parallel with backend G2 work** (client WS, CI). It adds no hardware dependency. Gate: your approval (G0.5-E) before design freeze. Before that approval nothing replaces the validated pieces; the prototype lives behind the same API and tests. Effort impact: ~4 days of the 9–15 Nov slot already used; G2 H-01 date unchanged because it waits on your go anyway.

## 5. Risks of this phase
Visual polish can create false confidence → every screen keeps limits/provenance visible; DEMO state must be unmistakable; fonts/icons are bundled locally (no CDN: local-first); lucide-react + 2 self-hosted font packages are the only new runtime dependencies (no chart/animation/router library).
