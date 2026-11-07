# ADR-0001 — Local-first monolith, no cloud
Status: Accepted (G0) · Date: 2026-11-05

**Decision.** One local process (FastAPI on 127.0.0.1) + SPA + SQLite. No telemetry, no cloud, no LLM call. Offline/demo must work with no printer.
**Why.** Privacy, reproducibility, fast delivery; matches cahier §5.1, §6.3.
**Consequences.** Windows packaging must be proven (Python-free for end user). Alternatives (Tauri) only via a new ADR with measured cost.
**Open.** Python minor version for the installer (local dev has 3.14; cahier says ≥3.12).
