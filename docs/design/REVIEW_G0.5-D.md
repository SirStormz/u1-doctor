# G0.5-D — Revue critique (2026-11-05)

Méthode : tests automatiques (38 vitest + 16 contrastes, 204 pytest), mesures navigateur (Playwright, 1920×1080 et 1366×768), lecture des captures `docs/design/captures/`. Aucune vérification par un lecteur d'écran ni par un utilisateur tiers.

## Défauts trouvés et corrigés pendant la revue
| # | Défaut | Détecté par | Correction |
|---|---|---|---|
| 1 | Bordures de champs à 2,1:1 (WCAG 1.4.11) | test de contraste | jeton `--control-line` ≥ 3:1 |
| 2 | Vert du thème clair à 4,2:1 sur puce | test de contraste | `#166534` |
| 3 | Écran Preuves : débordement horizontal 218 px à 1366 | mesure navigateur | grilles `minmax(0,1fr)` globales + `min-w-0` |
| 4 | Cadre cyan parasite autour de `<main>` après changement d'écran | capture 1920 | pas d'anneau sur la cible de focus programmatique |
| 5 | Intro 3D figée si l'onglet est masqué | capture | temps réel au lieu de l'accumulation de `dt` |
| 6 | Vue éclatée : le corps de la machine « fonçait » vers la caméra | capture | pondération par distance + recul automatique |
| 7 | Étiquettes « Toolhead N · UNMAPPED » superposées | capture 1920 | pins numérotés, libellé au survol |
| 8 | Barre de contrôles 3D masquait la machine | capture | barre sous le canevas |
| 9 | Voie d'état « printing » semblait connue à travers le trou | revue | bande de trou dessinée **par-dessus** les voies |
| 10 | Libellés d'axe dupliqués (« 60 60 »), « PAUSED » tronqué, texte du nœud « trou » dupliqué, ruban d'heure chevauchant le curseur | capture 1366 | axe unique si série plate, initiale si segment étroit, texte dédié, ruban relevé |
| 11 | Mapping CSS `#/evidence` : texte `Détail des preuves` en double (test) | vitest | requête corrigée |

## Évaluation
| Axe | Constat | Note |
|---|---|---|
| Cohérence visuelle | Un seul jeu de tokens/composants, 3 thèmes, mêmes motifs partout | bon |
| Ergonomie | Parcours P-01/P-03 réalisables ; palette efficace ; Overview chargé mais hiérarchisé | bon, à tester avec des utilisateurs |
| Lisibilité | Textes ≥ 12 px, contrastes mesurés ; micro-libellés 11 px majuscules (limite) | correct |
| Accessibilité | axe 0 violation structure ; clavier testé ; **pas de lecteur d'écran, pas de zoom 200 %** | partiel |
| Responsive | 1920 et 1366 : 0 débordement ; rail d'icônes < 1440 ; < 1024 px non traité | partiel |
| Performance | page ≈ 104 kB gzip + chunk 3D 188 kB à la demande ; 155 k triangles, ombres 2048² ; **FPS non mesuré** | à mesurer |
| Adéquation diagnostic | provenance, trous, limites, absence de scores/causes ; mais **données = 1 scénario synthétique** | bon sur le principe, non prouvé sur du réel |

## Limites restantes (honnêtes)
1. Le key art est un rendu IA stylisé d'après des photos publiques ; il montre le logo Snapmaker sur la machine ; usage public à décider (marque).
2. Contraste **mesuré sur les tokens**, pas sur les pixels rendus (halo, grain, transparences).
3. Écrans Connexion et Réglages : fidélité réduite ; export ZIP = **aperçu de format**, pas le writer U1-DOCTOR final.
4. Mode clair et Graphite vérifiés par contraste, **pas visuellement relus écran par écran**.
5. Texte officiel du catalogue (anglais) mélangé à l'interface française.
7. Pas de test E2E automatisé navigateur (captures manuelles via Playwright).
8. Tailwind v4 + Vite 8 + TypeScript 7 sont très récents : risque de régression d'outillage, versions épinglées.
