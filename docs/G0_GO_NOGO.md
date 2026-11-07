# G0 — Bilan GO / NO-GO (2026-11-05)

## Verdict
- **GO pour G1 (offline, 0 appel machine)** — sources solides, sécurité transport démontrée en synthétique.
- **NO-GO (pas encore décidé / bloqué) pour G2 / H-01** — nécessite ton accord explicite, l'IP et le périmètre. Aucune connexion à la U1 n'a eu lieu.
- **NO-GO pour toute affirmation** « cause confirmée », « testé sur U1 », « original » : zéro preuve matérielle, audit de recouvrement incomplet.

## Preuves (réelles, exécutées)
- Hashes du pack : 5/5 OK.
- `pytest` : **128 passed** (transport 113 : 37 chemins HTTP interdits avant I/O, 23 frames WS interdites, 24 cibles refusées, corps de requête, redirection, proxy env, taille, consentement ; schémas 15). Log : `docs/evidence/G0-G1/pytest-g0.txt`. Niveau : TESTED_SYNTHETIC.
- Wiki lu dans le navigateur : format de code, sévérités, modules, ligne exacte `0002-0525-0002-0002`, V2.1.0 (2026-11-04) = dernière.
- Source u1-klipper : format `level-id-index-code` confirmé ; objet `exception_manager` avec `exceptions[]` (non-oneshot seulement).

## Solide / à vérifier sur U1
| Solide (VERIFIED_DOCUMENT) | Exige la vraie U1 (UNVERIFIED_ON_HARDWARE) |
|---|---|
| décodeur de codes offline, gravités, modules | port 7125 joignable, auth réelle |
| API Moonraker (list/query/subscribe, endpoints mutants) | présence de `exception_manager` dans `objects/list` |
| règlement : 20 % vote / 80 % comité, validation physique requise | diffusion des codes oneshot (WS ?) |
| `eventtime` ≠ UTC | mapping T1–T4, version firmware via API |

## Risques majeurs
1. Codes oneshot possiblement non visibles par interrogation → S02/S06 live incertains. Plan B : saisie manuelle + capture passive d'états + replay.
2. **Originalité non établie** : « U1 Monitor IC » et « Snapmaker Studio » (pre-print intelligence) non lus ; recherche forum « forensic/diagnostic » non faite.
3. Licence : upstreams GPL-3.0 ; rien copié, choix MIT/GPL à décider.
4. Packaging Windows sans Python non prouvé.
5. Incohérences du pack (BACKLOG.md §1), dont la date limite (23 déc 23:59 UTC retenue).

## Si Moonraker est inaccessible
Code Explorer + saisie manuelle + import/replay U1-DEB (SYNTHETIC ou partagé) ; annoncer la limite.

## Décisions demandées
- D1 : feu vert pour G1 ?
- D2 : licence du projet (MIT vs GPL-3.0) ?
- D3 : accord pour que je lise les fils concurrents restants (lecture web seulement) ?
- D4 : H-01 plus tard — tu me donneras IP + périmètre au moment voulu ; je ne les demande pas maintenant.
- D5 : stratégie de packaging à prototyper en G1 (exe portable Python embarqué vs Tauri).

## Non fait / limites
Pas de git init, ni ruff/mypy, ni test cross-OS, ni client WebSocket, ni parseur d'import, ni SHA des dépôts upstream. Les captures d'écran du wiki ne sont pas stockées.
