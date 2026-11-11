// Removes the previous build's generated files from ../docs (hashed assets and the two sub-pages) so no stale file stays published.
// Everything else in docs/ (documentation, sample-report, media) is left alone.
import { rmSync } from "node:fs";
for (const p of ["assets", "changelog", "aider"]) rmSync(new URL(`../../docs/${p}`, import.meta.url), { recursive: true, force: true });
