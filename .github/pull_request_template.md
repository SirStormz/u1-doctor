## What changes and why

<!-- One or two sentences. Link the issue if there is one. -->

## How it was checked

- [ ] Backend: `pytest`, `ruff check app tests`, `mypy app --ignore-missing-imports`
- [ ] Frontend: `npx tsc --noEmit`, `npm test`, `npm run build`
- [ ] Docs updated if behaviour, numbers or screens changed (README, `docs/`)

## Honesty and safety rules (see [CONTRIBUTING.md](../CONTRIBUTING.md))

- [ ] Nothing invented: every fact has a source (observation, official page or repository file)
- [ ] Unknown stays `INCONCLUSIVE`; no guesses, scores or percentages
- [ ] Synthetic data is never labelled as real; provenance is kept
- [ ] Read-only: no request added outside the allowlist, no contact with a printer from tests or CI
- [ ] No private data in this change (printer addresses, serial numbers, Wi-Fi names, personal files)
