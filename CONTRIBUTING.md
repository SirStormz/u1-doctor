# Contributing to U1 Doctor

U1 Doctor is a local, read-only forensics tool for the Snapmaker U1, released under the MIT licence. Read [`README.md`](README.md) and [`docs/threat-model.md`](docs/threat-model.md) first.

## Run the checks

Windows PowerShell, from the repo root. These are the same checks CI runs (`.github/workflows/ci.yml`).

Backend (Python 3.12+; see [`docs/INSTALL.md`](docs/INSTALL.md) for the venv):

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check app tests
.venv\Scripts\python.exe -m mypy app --ignore-missing-imports
```

Frontend:

```powershell
cd frontend
npm ci
npx tsc --noEmit
npm test            # vitest run
npm run build       # tsc --noEmit && vite build
```

Ruff is configured in `backend/pyproject.toml` (line length 140). Please do not hardcode test counts in docs; they change.

## Branches and commits

Seen in `git log`:

- Work happens on a short-lived topic branch (for example `signal-evaluators`, `history-sqlite`) merged into `main` with a merge commit named `Merge <branch>: <summary>`.
- Commit subjects are `type(scope): Imperative summary` or `type: summary`, with types such as `feat`, `fix`, `docs`, `ci`. Scopes seen: `backend`, `frontend`, `engine`, `knowledge`, `deb`, `history`, `import`, `preflight`, `support`, `viewer`.
- Add a body when the reason is not obvious.

## Honesty rules (non-negotiable)

1. **Nothing invented.** A fact needs a source: a recorded observation, an official page, or a repository file. Cite it.
2. **Unknown means `INCONCLUSIVE`.** Never fill a gap with a guess, a score or a percentage.
3. **DEMO and SYNTHETIC stay visible.** Never label synthetic data as real; provenance (REAL, SYNTHETIC, USER_REPORTED, IMPORTED) travels with every observation.
4. **Read-only.** Do not add any request outside the allowlist. Do not widen the allowlist without updating the threat model and the tests that must stay refused.
5. **No contact with a U1 from contributions or CI.** Tests use mocks and recorded fixtures. A new real-printer session needs the owner's explicit agreement.
6. A SHA-256 proves integrity only, never authorship.

## Wiki and third-party text

- **Raw wiki text is never committed.** Store your own short wording plus a link to the official page. Local snapshots belong in `private/` (git-ignored).
- No code, text or data set is copied from other projects.

## Licence

Contributions are accepted under the MIT licence ([`LICENSE`](LICENSE)). The official Snapmaker repositories (`u1-klipper`, `u1-moonraker`, `u1-fluidd`) are GPL-3.0: nothing is copied from them, and nothing from them may be pasted into a contribution. Reading them to understand behaviour and citing them with a link is fine.

Security issues: see [`SECURITY.md`](SECURITY.md).
