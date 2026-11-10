# U1 Doctor · plan d'implémentation des 4 thèmes UI V2

Proposition à valider avant tout code dans `frontend/src`. Base : les 16 planches auditées et corrigées (`docs/design/ui-v2/`, rapport `U1_DOCTOR_AUDIT_4_THEMES.md`), la scène 3D partagée `docs/design/ui-v2/lab/u1stage.js` et l'app actuelle (React 19, Vite 8, Tailwind 4, motion 12, three 0.187, préférences dans `lib/prefs.tsx`, jetons dans `design/tokens.css`).

## 1. Principes

1. **Une seule app, quatre peaux.** Données, parcours, textes et règles sont communs ; un thème ne calcule rien et n'invente rien (session de démo toujours étiquetée).
2. **Le thème change la matière, pas le sens.** Les quatre verdicts (Constaté, À vérifier, Pas assez d'infos, Exemple de démo), les mots, l'ordre des gestes et les infobulles sont identiques partout.
3. **Ouvert.** Ajouter un 5e thème = un dossier + une entrée de registre, sans toucher aux écrans.
4. **Hors ligne et privé.** Aucune ressource externe : polices auto-hébergées (les maquettes utilisent Google Fonts, l'app non), images et modèle dans le paquet.
5. **La 3D est un plus, jamais une condition.** Chaque vue 3D a son affiche (rendu Blender du même cadrage) ; sans WebGL, sur machine lente ou sous `prefers-reduced-motion`, l'affiche reste et tout fonctionne.

## 2. Architecture

```
frontend/src/
  themes/
    registry.ts            ThemeId = "pupitre" | "notice" | "obsidienne" | "visiere" ; métadonnées, chargeurs paresseux
    types.ts               ThemeMeta, ThemeParts (composants signature), StagePreset, MotionPreset
    shared/                composants « sans peau » : Nav, Dock, ModeSwitch, LangSwitch, VerdictCard, StepList,
                           Timeline, EvidenceList, CodeDecoder, SymptomPicker, HeadsStrip, Tooltip
    pupitre/  theme.css  parts.tsx  (Galvanometer, Lcd, TicketPrinter, Keypad, RotaryKnob, SafetyCover, Lever)
    notice/   theme.css  parts.tsx  (LineIllustration, CalloutLayer, HardShadowButton, Checkbox)
    obsidienne/ theme.css parts.tsx (GlassPanel, LiquidLens, LiquidSwitch, GlassDock)
    visiere/  theme.css  parts.tsx  (Reticle, ScanReveal, Radar, HoldToConfirm, DecodeText, CutCornerSwitch)
  design/tokens.css        jetons sémantiques communs (noms) + valeurs par [data-theme]
  viz/stage/               portage TypeScript de u1stage.js (vues, repères, presets, bench, dispose)
  lib/useDiagnosis.ts      modèle de vue unique (verdict, gestes, preuves, frise, têtes, codes, drapeau démo)
public/themes/<id>/        affiches et rendus web (WebP), un dossier par thème
```

### 2.1 Jetons (design tokens)

Un seul vocabulaire, des valeurs par thème, pour que les écrans partagés ne connaissent aucune couleur :

| Famille | Jetons |
|---|---|
| Surfaces | `--surface`, `--surface-2`, `--surface-raised`, `--scrim` |
| Encre | `--ink`, `--ink-2`, `--ink-3` (≥ 4,5:1 vérifié), `--ink-on-accent` |
| Accent et états | `--accent`, `--state-ok`, `--state-check`, `--state-unknown`, `--state-alert`, `--state-demo` |
| Lignes et formes | `--line`, `--line-strong`, `--radius-s/m/l`, `--focus-ring` |
| Typographie | `--font-display`, `--font-text`, `--font-mono`, `--font-hand` (Pupitre), échelle 13/16/21/26/42/68 (nombre d'or) |
| Mouvement | `--dur-fast/base/slow`, `--ease-enter`, `--ease-exit`, `--ease-spring` (ressort Obsidienne, crans Pupitre, tracé Notice, verrouillage Visière) |
| Profondeur | `--shadow-1/2/3` (ombre dure décalée pour Notice, aucune lueur sauf Visière ≤ 3-7 px) |

Un test lit `tokens.css` et échoue si un thème oublie un jeton (§ 6).

### 2.2 Isolation des styles

- `data-theme` sur `<html>` (déjà en place) ; chaque `themes/<id>/theme.css` est écrit sous `[data-theme="<id>"]` et chargé à la demande (import dynamique) : un seul thème en mémoire.
- Tailwind 4 reste pour la mise en page (grilles, espacements) ; les couleurs passent toujours par les jetons (`bg-[var(--surface)]`).
- Corrections de l'audit reprises d'emblée : curseurs `.seg>.thumb`, infobulles hors du flux tant qu'elles sont fermées, pas de `<img src="{{…}}">` (sans objet en React), dégradés SVG en `userSpaceOnUse`.

### 2.3 Données centralisées

`useDiagnosis()` agrège ce que l'app sait déjà (`lib/dyn*`, `data.tsx`) en un objet stable et typé. Les quatre thèmes reçoivent exactement les mêmes champs ; un test compare le texte visible des quatre thèmes sur un même verdict (mêmes faits, même ordre).

### 2.4 Composants : partagés + signature

Chaque composant partagé expose des « emplacements » remplis par le thème actif : par exemple `StepList` rend chaque geste ; l'interrupteur est `parts.Toggle` (levier Pupitre, case Notice, interrupteur liquide Obsidienne, interrupteur à coins coupés Visière). Les signatures lourdes (galvanomètre, radar, ticket) sont chargées avec leur thème uniquement.

### 2.5 Three.js

- `viz/stage/` = `u1stage.js` en TypeScript : vues nommées, repères (`ANCHORS`), presets par thème, `focus`, `reset`, `setSplit`, `setActive`, `bench`, `dispose`. Les mesures de la maquette restent la référence (0,3 à 1,1 ms par image sur RTX 3070).
- Un seul contexte WebGL actif à la fois (la vue montée libère le précédent) ; modèle mis en cache entre vues ; `three` reste dans son morceau paresseux (règle déjà dans `vite.config.ts`).
- Fusion progressive avec `U1Viewer.tsx` et `LandingScene.tsx` (curseurs porte / plateau / tête conservés comme options de la scène commune).
- Décision de qualité au premier montage : pas de WebGL, ou `bench()` > 8 ms à densité 1, ou réduction des mouvements → affiche fixe ; 4 à 8 ms → densité 1, pas de dérive ; sinon densité jusqu'à 1,75, plafond 60 images/s.

## 3. Fonctionnement

| Sujet | Proposition |
|---|---|
| Choix du thème | Réglages : 4 vignettes (capture réelle de l'Accueil de chaque thème), nom et une phrase ; aperçu au survol |
| Changement | Instantané via `data-theme` + chargement du CSS du thème ; fondu de 250 ms par View Transitions (Chromium / WebView2), coupé sous réduction des mouvements ; l'écran, le mode Simple/Expert et la position de lecture sont conservés |
| Préférence | `u1d.theme` ; migration une fois des anciennes valeurs (`light`, `graphite`, `night`) vers les nouvelles selon la table décidée par le propriétaire (§ 9) ; valeur inconnue → thème par défaut |
| Continuité des données | Le thème ne touche ni la session, ni l'historique, ni l'API ; changer de thème pendant une capture ne la coupe pas (test e2e) |
| États | Chargement (squelettes à la forme finale de chaque thème), vide, erreur, hors ligne, démo : chaque thème les dessine, les textes viennent d'`i18n.ts` |
| Performances | § 2.5 ; animations CSS limitées à `transform` / `opacity` / `filter` court ; filtres SVG de déplacement seulement sur barre et dock |
| Responsive | Les planches sont des compositions fixes à 1440 px ; dans l'app, grilles fluides + requêtes de conteneur ; la machine vit dans une boîte à ratio fixe et tous les repères sont exprimés en % de cette boîte (les `.json` de repères Blender le permettent) ; cibles 1024 (fenêtre minimale), 1280, 1440, 1920 |
| Accessibilité | Contraste ≥ 4,5:1 vérifié par axe, focus visible propre à chaque thème, cibles ≥ 44 px, canvas 3D avec `role="img"` + clavier (flèches, + / −, 0), aucune information portée par la couleur seule, `prefers-reduced-transparency` (verre → plaque opaque) |

## 4. Maintenance

- **Ajouter un thème** : dossier `themes/<id>/`, jetons complets, `parts.tsx`, preset de scène, affiches ; entrée dans `registry.ts`. Le test de complétude des jetons et la batterie e2e par thème s'appliquent d'office.
- **Images** : un seul pipeline, `docs/design/ui-v2/sources/render_u1.py` (Blender, scène du propriétaire). Interdit : toute image de la U1 générée ou retouchée par IA. Les repères sont relus dans les `.json`.
- **Dépendances** : aucune bibliothèque lourde nouvelle. Polices via Fontsource (paquets à vérifier sur npm avant installation : Doto, Barlow, Barlow Semi Condensed, Permanent Marker, Courier Prime, Schibsted Grotesk, Atkinson Hyperlegible Next, IBM Plex Mono, Geist, Geist Mono, Oxanium, Saira avec axe `wdth`, JetBrains Mono déjà présent) ; versions épinglées comme le reste du `package.json`.
- **Poids** : affiches en WebP (cible ≤ 250 Ko chacune), polices en sous-ensemble latin, un thème chargé à la fois ; budget de démarrage inchangé hors thème actif.
- **Régressions** : captures de référence par thème et par écran, revues à chaque changement visuel.

## 5. Livraison : étapes et ordre

| # | Étape | Dépend de | Livrable | Critère d'acceptation |
|---|---|---|---|---|
| 1 | Socle : `registry.ts`, type `ThemeId`, migration `u1d.theme`, jetons sémantiques des 4 thèmes, chargement paresseux du CSS | — | App identique à aujourd'hui mais thème choisi parmi 4 jeux de jetons | Tests registre + migration + complétude des jetons au vert |
| 2 | Polices auto-hébergées + `useDiagnosis()` | 1 | Typo des 4 thèmes hors ligne, modèle de vue unique | Aucune requête externe (test réseau e2e), même texte visible dans les 4 thèmes |
| 3 | Composants partagés (Nav, Dock, ModeSwitch, VerdictCard, StepList, Timeline, EvidenceList, CodeDecoder, SymptomPicker, Tooltip) | 1-2 | Écrans Accueil / Verdict / Expert / Diagnostiquer branchés sur les jetons | i18n FR/EN complet, axe 0 violation grave, 0 débordement 1024-1920 |
| 4 | Thème **Notice** complet (le plus simple, sert de référence d'accessibilité) | 3 | Notice au niveau des planches | Captures conformes aux planches à ±4 px, réduction des mouvements OK |
| 5 | `viz/stage` (portage TS + fusion U1Viewer) | 1 | Scène commune, affiches, repères | `bench` ≤ 1,5 ms (RTX 3070) par vue, repli affiche sans WebGL, 0 fuite sur 10 montages |
| 6 | Thème **Obsidienne** (verre, 3D au survol, vol de caméra du Verdict) | 4-5 | Obsidienne | idem 4 + repli transparence réduite |
| 7 | Thème **Visière** (réticule, balayage, radar, appui long, hologramme 3D) | 4-5 | Visière | idem 4 ; rouge réservé aux alertes (test sur les jetons) |
| 8 | Thème **Pupitre 2** (galvanomètre, LCD, ticket, clavier, bouton rotatif, capot, fenêtre 3D) | 4-5 | Pupitre 2 | idem 4 |
| 9 | Réglages : choix du thème, vignettes, fondu de bascule | 4-8 | Écran Réglages | Changement sans perte d'état (e2e) |
| 10 | Mise à jour README, Pages, captures, guide ; release | 1-9 | Version publiée | Processus de release habituel (exe, VirusTotal) |

Ordre recommandé : 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Les étapes 6, 7 et 8 sont indépendantes entre elles une fois 4 et 5 faites (sessions parallèles possibles, une par thème, fichiers disjoints).

## 6. Stratégie de tests

| Niveau | Contenu |
|---|---|
| Unitaires (vitest) | Registre, migration des préférences, complétude des jetons par thème, contraste calculé des paires encre / surface déclarées, i18n des nouvelles chaînes |
| Rendu (Testing Library) | Chaque écran × chaque thème rend les mêmes faits ; interrupteurs et onglets au clavier |
| E2E (Playwright) | Capture de référence par thème × écran à 1440 et 1280 ; axe 0 violation grave ; 0 débordement à 1024 / 1280 / 1440 / 1920 ; réduction des mouvements (0 animation en cours) ; WebGL désactivé → affiche ; changement de thème pendant une capture ; aucune requête externe |
| Performance | `bench()` des vues 3D sur la machine de dev (seuils § 5) ; en CI sans GPU, seulement « pas d'erreur » (SwiftShader fausse les durées) ; mesure manuelle des images/s en fenêtre visible avant release (non faite pendant l'audit, voir rapport § 8) |

Outils déjà présents : vitest, Testing Library, Playwright, axe-core. Le banc des maquettes (`bench.py`, `lab/perf.mjs`) reste pour comparer app et planches.

## 7. Risques techniques

| Risque | Effet | Parade |
|---|---|---|
| GPU intégré faible | V-Expert (1,36 M triangles traités) et vols de caméra saccadés | Décision de qualité au premier montage (§ 2.5), affiche fixe en dernier recours, hologramme sans les bobines (déjà fait) |
| WebView2 ancien chez l'utilisateur | `backdrop-filter: url(#lq)`, View Transitions ou `:has()` absents | Replis déjà écrits (flou simple, bascule sans fondu) ; version minimale testée |
| Poids des polices (13 familles) | Démarrage plus lent | Un thème chargé à la fois, sous-ensembles latins, `font-display: swap` |
| Dérive entre planches et app | Défauts revenus (curseurs, infobulles, contrastes) | Corrections de l'audit écrites dans les composants partagés + tests e2e qui les verrouillent |
| Fidélité de la U1 | Une image IA se glisse à nouveau | Règle « images seulement via `render_u1.py` » dans le README et revue |
| Licences | Polices | Toutes OFL / Apache 2.0, notices ajoutées à `third-party` |

## 8. Conditions de mise en production

- Les 4 thèmes passent toute la batterie § 6 sur Windows (WebView2) à 1280 et 1440.
- Images/s mesurées en fenêtre visible : ≥ 55 en moyenne sur la machine de dev pendant les vols de caméra et la rotation, et repli correct forcé (affiche) sur un profil « GPU faible ».
- Aucune requête externe, aucune donnée inventée, démo étiquetée partout.
- Validation visuelle du propriétaire thème par thème (captures + essai en main).
- README, Pages, captures et changelog à jour ; release selon le processus habituel.

## 9. Décisions qui restent au propriétaire

1. **Thème par défaut** au premier lancement. Ma recommandation : Obsidienne (meilleure première impression, contraste vérifié) ; Notice comme choix « lisibilité maximale » mis en avant dans les Réglages.
2. **Migration des anciennes préférences** : je propose `light → notice`, `graphite → pupitre`, `night → obsidienne` (luminosité la plus proche).
3. **Écran du modèle** : garder la texture « PRÊTE · HORS LIGNE » du modèle, ou fournir une vraie capture de l'écran en pause à poser en texture (je n'invente pas l'interface réelle).
4. **Mains dans Notice** : les dessins n'ont plus de main (cercle ambre + flèche à la place). Garder, ou ajouter une main dessinée séparée, posée au-dessus du rendu sans toucher la machine.
5. **Police d'Obsidienne** : Geist remplace Albert Sans (chiffre « 1 » ambigu). À confirmer.
6. **Images dans le dépôt** : les rendus Blender sont dérivés du modèle déjà commité ; les versionner dans `frontend/public/themes/` (nécessaire pour l'app) ou garder la règle « images dans `private/` ».
7. **Canevas Design** : envoyer les planches corrigées et leurs nouvelles images au canevas (nouvelle version, ou nouveau canevas pour comparer avant / après). Rien n'a été publié pendant la mission.
8. **Feu vert d'intégration** : rien de ce plan n'est commencé dans `frontend/src`.

### Décisions du propriétaire (2026-11-10)

| # | Décision |
|---|---|
| 1 | Obsidienne par défaut au premier lancement |
| 2 | Migration une fois au démarrage, sans message : `light → notice`, `graphite → pupitre`, `night → obsidienne` |
| 3 | Le propriétaire fournit une photo de sa U1 en pause, posée en texture sur l'écran ; « PRÊTE · HORS LIGNE » reste en attendant |
| 4 | Notice garde le cercle ambre et la flèche, sans main dessinée |
| 5 | Geist pour Obsidienne |
| 6 | Rendus Blender versionnés (décision du 2026-11-10) : les 12 images en WebP dans `frontend/src/assets/renders/` (680 Ko au total, servies par `/assets` sans changer le backend) avec leurs repères (`anchors.json`) ; les PNG en pleine taille et la scène Blender restent dans `private/` |
| 7 | Planches envoyées au canevas en un seul envoi, après les points 3 et 4 |
| 8 | Feu vert, étape par étape, arrêt après chaque étape pour essai |

### Avancement

- **Étape 1 faite** (branche `feat/ui-v2-themes`) : `frontend/src/themes/registry.ts` (`ThemeId`, `THEMES`, `DEFAULT_THEME`, `resolveTheme`), migration dans `lib/prefs.tsx`, 4 jeux de jetons dans `design/tokens.css` (vocabulaire actuel conservé, les écrans ne changent pas), sélecteur et Réglages à 4 thèmes, libellés FR/EN, tests `tests/themes.test.tsx` + `tests/contrast.test.ts` sur les 4 thèmes. Écart au plan : pas de CSS de thème chargé à la demande, car il n'y a encore rien à charger (que des jetons, 2 Ko) ; il arrive avec les signatures, étape 4.
- **Étape 2 faite, polices** : 9 familles Fontsource 5.3.0 épinglées (OFL), Inter retirée ; jetons `--font-display` / `--font-ui` / `--font-mono` par thème, titres sur `--font-display`. Toutes les `@font-face` sont déclarées d'emblée : le navigateur ne télécharge que les fichiers du thème affiché, donc un seul thème en mémoire sans chargement à la demande. Tests : `tests/theme-parity.test.tsx` (même texte visible dans les 4 thèmes, FR et EN), e2e « polices locales et zéro requête externe » par thème (20/20 sous Edge), `THIRD_PARTY_NOTICES.md`. Écarts : Doto, Permanent Marker et Courier Prime arrivent avec les signatures de Pupitre (étape 8) ; `useDiagnosis()` est reporté à l'étape 3, où ses consommateurs (VerdictCard, StepList…) fixent sa forme, plutôt que d'inventer l'objet à vide ; le texte intégral de l'OFL doit être joint à l'exe à la release (étape 10).
- **Étapes 3 à 9 faites, sous une forme différente du plan** : au lieu de nouveaux écrans calqués sur les planches, les écrans existants reçoivent la peau de chaque thème (`themes/<id>/theme.css` : barre, onglets, panneaux, boutons, puces, champs, titres, mouvement d'entrée), la barre du haut n'a plus de couleurs codées en dur, la 3D suit le thème (`viz/looks.ts` : Notice au trait, Visière chaude avec liseré rouge), les Réglages montrent de vraies captures et la bascule se fait en fondu (View Transitions, coupé sous réduction des mouvements). Signatures portées sur les écrans existants : titres et chiffres LCD (Pupitre), titre qui se décode (Visière), repères des têtes par thème. Tests e2e par thème : axe sans violation grave ni critique et aucun défilement horizontal à 1024 et 1440 px sur 7 écrans. Deux défauts d'accessibilité anciens corrigés (nom de l'onglet actif, blocs `<pre>` non focalisables).
- **Pas fait** : la structure d'écrans des planches (dock à 5 entrées, Accueil en tuiles, Verdict guidé, Diagnostiquer) et leurs pièces interactives (galvanomètre, ticket, clavier, bouton rotatif, capot, radar, appui long, loupe liquide, vols de caméra) ; critère « captures conformes aux planches à ±4 px » sans objet tant que ces écrans n'existent pas ; images/s en fenêtre visible non mesurées.
- **Étape 10 (docs)** : README (captures régénérées en Obsidienne par `frontend/scripts/capture-screens.mjs`, planche des 4 thèmes `docs/media/themes.jpg`), état d'implémentation, fiche UI V2. Release non faite : attend l'accord du propriétaire.

## 10. Refonte des écrans des planches (feu vert du propriétaire, 2026-11-10)

Les 4 thèmes habillent aujourd'hui les 11 écrans historiques. Cette phase donne à l'app la structure des planches, dans les 4 thèmes, sans rien inventer : chaque texte affiché vient des données (démo étiquetée, capture réelle, import) ou du dictionnaire, jamais des maquettes.

Navigation (décision du 2026-11-09) : un dock en bas à 5 entrées remplace la bande 01-11, dans les deux modes.

| Dock | Écran d'arrivée | Actif aussi sur |
|---|---|---|
| Accueil | `overview` | `findings`, `evidence`, `replay` |
| Diagnostiquer | `connect` | `welcome` |
| J'ai un problème | `symptoms` | `explorer` |
| Historique | `timeline` | |
| Partager | `report` | |

Réglages, Simple/Expert, démo, langue et thème restent en haut. Toutes les routes existantes restent valides (liens, palette Ctrl K, URL directes).

| Phase | Contenu | Critère |
|---|---|---|
| R1 | Dock (composant partagé, une peau par thème), bouton Réglages en haut, bande 01-11 retirée | e2e : chaque écran joignable, axe et débordement verts par thème |
| R2 | Accueil Simple des planches : verdict en mots courants, « ce qu'il faut faire » (gestes tirés des conclusions), frise « ce qui s'est passé », « comment on le sait », raccourcis code / pièce | même texte dans les 4 thèmes, aucune donnée inventée |
| R3 | Verdict guidé pas à pas, la caméra 3D va de pièce en pièce (port de `focus` de `lab/u1stage.js`) | repli sans WebGL, réduction des mouvements |
| R4 | Accueil Expert : couches dépliées (courbe, preuves, rejeu, partage) | |
| R5 | Diagnostiquer : choix du mode (capture, import, journaux, démo) avec la commande propre au thème | |
| R6 | Pièces de signature restantes (galvanomètre, ticket, clavier, bouton rotatif, capot, radar, appui long, loupe liquide) | |
| R7 | Tests, captures, docs, release | |
