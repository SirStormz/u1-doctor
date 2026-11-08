# U1-DEB v1 (current: 1.1.0) — U1 Diagnostic Evidence Bundle

Open, versioned format to share a reproducible diagnostic case. Implementation: `backend/app/deb.py`. Manifest schema: `schemas/evidence-bundle.schema.json`; observation schema: `schemas/observation.schema.json`.

**SHA-256 proves integrity only.** It does not prove who made a bundle or that the data came from a real machine. Never present it as authenticity.

## Layout (`U1-DEB-v1.zip`, exactly these names, flat)

Version history: **1.0.0** the original layout; **1.1.0** adds the optional `support-checklist.json`.

| File | Required | Content |
|---|---|---|
| `manifest.json` | yes | format, `format_version` (1.x.y), app version, ruleset id/version/hash, `source_mix`, capture windows + gaps, per-file SHA-256 and size, limits, fixed integrity notice |
| `observations.jsonl` | yes | canonical observations, one per line, stable order (capture time, then id) |
| `findings.json` | yes | findings produced by the ruleset over those observations |
| `compatibility.json` | no | observed event types, mapping-quality counts; absent = "not observed", not "unsupported" |
| `knowledge-refs.json` | no | ruleset and error-catalog versions, source URL; no copied wiki text |
| `privacy-report.json` | no | redaction rules applied and counts |
| `README.txt` | no | origin, limits, warnings |
| `support-checklist.json` | no (1.1.0) | for each error code declared in the observations: the *ids* of what Snapmaker support asks for (`{id, source}` with source `wiki` or `suggested`), the catalog version used. Ids only, no wiki text; the texts live in the app. Written only when a valid code was declared |

Canonical JSON everywhere (sorted keys, no spaces, UTF-8). `generated_at` is metadata only and is not part of the logical replay hash. The zip is written deterministically (fixed timestamps, sorted entries): same inputs ⇒ same bytes.

## Export

1. Every observation is validated against the observation schema.
2. Redaction (best-effort, reported in `privacy-report.json`): IPv4 and IPv6 addresses, MAC, e-mail, URLs, local network host names (`.local`, `.lan`, `.home`, `.internal`), local and home paths (`C:\`, `\\server`, `/home/`, `/Users/`, `~/`, `%USERPROFILE%`), print-file names (`.gcode`, `.3mf`, …), serial-like tokens (12+ upper-case letters and digits, `serial=`/`sn=` pairs) and credential `key=value` pairs (`password=`, `token:`, `api_key=`, …) are replaced by `[REDACTED]`; observations flagged `sensitive` lose their value; matching keys are renamed `[REDACTED_KEY_1]`, `[REDACTED_KEY_2]`, … so two keys never merge. Findings are computed **after** redaction, so replay of the bundle is consistent.
3. The capture does not collect host names, serial numbers, credentials or print file names in the first place; the patterns above are a second net, not a guarantee. Redaction cannot guarantee anonymity: review before sharing.

## Import (untrusted input, nothing is executed)

Refused with a stable error code:

| Code | Cause |
|---|---|
| `NOT_A_ZIP` | not a zip |
| `TOO_LARGE` | zip > 50 MiB, entry > 50 MiB, total > 100 MiB, ratio > 200:1, lying size header, too many observations |
| `BAD_ENTRY` | name not in the allowlist (covers `../`, absolute paths, sub-directories, extra files), duplicates, symlinks, encrypted entries |
| `BAD_MANIFEST` | unknown/missing fields, altered integrity notice, files not matching the manifest |
| `UNSUPPORTED_VERSION` | `format_version` major ≠ 1 (minor/patch bumps are accepted) |
| `HASH_MISMATCH` | file size or SHA-256 differs from the manifest |
| `BAD_JSON` / `BAD_OBSERVATION` / `EMPTY` | invalid JSON (NaN refused), invalid or duplicate observation, nothing to replay |

After validation the observations are **replayed with the local ruleset**. If the manifest's ruleset hash equals the local one, findings are recomputed and compared with the bundle's (`replay.matches_bundle`); the displayed findings are always our recomputation, never the bundle's claims. If the ruleset differs, no replay is done and the result says so. Imported data is labelled `IMPORTED` and keeps its original `origin_source_mix` (REAL / SYNTHETIC / …); it is never passed off as a live capture.

### support-checklist.json (1.1.0)

```
{"catalog_version": "0.3.0", "format": "u1-support-checklist/1",
 "items": [{"asks": [{"id": "error_code", "source": "wiki"}, ...], "code": "0003-0522-0001-0016", "status": "KNOWN", "title": "..."}],
 "note": "..."}
```
Strict on import: exactly these keys; `code` is `dddd-dddd-dddd-dddd`; `status` is `KNOWN` or `STRUCTURE_ONLY`; every ask id must be in the fixed allowlist of the reader and `source` is `wiki` or `suggested`; at most 200 items. Anything else is refused with `BAD_JSON`. The file is never trusted: the importer recomputes it from the observations with its own catalog and reports `support_checklist.matches_local` (`true`, `false`, or `null` when the bundle used another catalog version). It is a convenience for a person preparing a support request, not an official Snapmaker form.

## API

- `POST /api/v1/bundles/export` `{"source": "synthetic:<scenario>" | "real:h02_normal_print"}` → `application/zip`
- `POST /api/v1/bundles/import` raw zip body → validation + replay result (422 with `{code, message}` when refused)

## Validate a bundle (offline, stdlib only)

```
cd backend
python -m app.deb_cli validate ../examples/u1-deb/example-synthetic-known-code-feeder3.u1deb.zip [--json]
```
Exit code 0 = valid, 1 = refused (stable code from the table above), 2 = file unreadable. After `pip install -e backend` the same command is `u1deb-validate validate BUNDLE.zip`. It checks structure, size limits, SHA-256 and replays with the local ruleset; it proves integrity only.

GitHub Action (composite, in this repo): `uses: <owner>/<repo>/.github/actions/validate-u1-deb@main` with `bundle: path/to/bundle.zip`. Its path in this repo's own CI runs on the shipped example (first run on GitHub pending).

Example: `examples/u1-deb/example-synthetic-known-code-feeder3.u1deb.zip` is **SYNTHETIC** (3 observations), deterministic, covered by a regression test.

## Compatibility policy

`format_version` follows semver: readers accept any 1.x.y and ignore nothing silently (unknown manifest fields are refused until a minor version defines them). A reader that only knows 1.0.0 therefore refuses a bundle that contains `support-checklist.json` (`BAD_ENTRY`): the file name is not in its allowlist. Bundles without declared codes carry no such file and stay readable by a 1.0.0 reader apart from the version string they announce.
