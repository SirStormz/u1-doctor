# ADR-0004 — Minimal dependencies at G1
Status: Accepted (G1) · Date: 2026-11-05

**Decision.** SQLite schema managed by numbered forward-only SQL migrations using `PRAGMA user_version` (stdlib), refusing databases newer than the app. Frontend uses `fetch` and a typed FR/EN dictionary; Tailwind v4; no TanStack Query / i18n library yet. Rulesets are JSON with a fixed built-in evaluator enum (no YAML, no expressions).
**Why.** Fewer dependencies = smaller attack surface and installer, faster G1. The cahier allows stack changes via ADR.
**Cost / revisit.** Switch to Alembic if tables/relations grow (G3+). Add TanStack Query only when caching/polling is needed (live capture). The generic operator DSL (`eq, exists, within, count, all, any, not`) of cahier §8.3 is **not** implemented: evaluators are Python functions selected by name; community rule packs (REQ-020) need the DSL later.
