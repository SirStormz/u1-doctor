# G1 — Bilan (2026-11-05)

## Verdict
**GO pour G2 sous réserve de ton accord explicite pour H-01** (pas encore demandé, pas d'IP requise maintenant). G1 est atteint pour le critère « démo robuste, 0 appel machine, règles et tests déterministes ». Il reste des écarts listés ci-dessous.

## Réalisé
- Catalogue vérifié (12 codes, paraphrasés) + décodeur : `knowledge/u1_codes.json`, `backend/app/knowledge/`.
- Moteur de règles pur (5 évaluateurs : S01, S03, S09, S10, blocage transport) : `backend/app/engine/`, `rulesets/u1-starter/ruleset.json`.
- 9 scénarios SYNTHETIC (décodeur, timeout, hors ligne/gap, mapping inconnu, ordre inversé, code inconnu/malformé, changement d'état, niveau 3, appel bloqué) + golden : `fixtures/synthetic/`.
- API FastAPI localhost (health, compatibility, interpret, rulesets, demo, replays), SQLite + migrations, host-header check, docs désactivées.
- SPA React/TS strict : Accueil, Codes d'erreur, Incident exemple (observations + conclusions + preuves + rejeu), FR/EN, badges DEMO/REPLAY, bannière SYNTHETIC.
- Spike packaging : exe PyInstaller 31 Mo, testé sur ce PC (health, decode, replay, SPA OK ; écoute 127.0.0.1 seulement).
- Audit d'originalité (docs/source-audit.md §7), licence MIT, git init.

## Preuves
pytest 200 passed · vitest 5 passed · ruff, mypy, tsc propres · build Vite OK · exe lancé et interrogé en HTTP. Même `ruleset_hash` depuis les sources et depuis l'exe. Logs : `docs/evidence/G0-G1/`.
Bugs réels trouvés par les tests : lecture UTF-8 par défaut cp1252 sous Windows (tests), schéma `source_ref` laissait passer une URL, route SPA masquait les 404 de l'API. Tous corrigés.

## Limites / non fait
- **Rien testé sur une vraie U1** ; aucun TESTED_REAL.
- Exe **non testé sur Win11 propre** ni scanné antivirus/SHA publié (REQ-015 non DONE).
- Pas de CI, pas de Playwright, pas de test multi-OS (T-025), pas de commit git (aucun user git configuré).
- Moteur sans DSL générique (ADR-0004). Écrans Findings/Timeline/Report Composer/Settings absents (prévus G3/G4).
- Accessibilité et zoom 200 % non audités. Traductions FR non relues par un humain.
- Catalogue = 12 codes sur ~429 lignes du wiki ; le reste renvoie INCONCLUSIVE par conception.
- Texte FR/EN mélangé dans les docs du dépôt (EN prioritaire visé au G5).

## Sécurité
Appels réseau émis par le code livré : aucun (test avec garde socket ; API sans import du transport). Seuls accès réseau de la session : lecture de pages publiques (wiki, GitHub, forum) par moi, pas par le produit.

## Décisions à prendre
1. Commit : configurer `git config user.name/email` et je commite G0+G1 ?
2. Accord pour H-01 quand tu es prêt (imprimante inactive, lecture seule, IP + périmètre fournis à ce moment-là).
3. Prochaine priorité avant G2 : (a) CI GitHub + test exe sur Win11 propre, ou (b) client WebSocket + intégration transport.
