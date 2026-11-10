# U1 Doctor · audit et perfectionnement des 4 thèmes UI V2

Mission autonome du 2026-11-10, branche `design/ui-v2-audit` (partie de `design/ui-v2-themes`, commit 3e62abd). Rien n'est intégré dans l'application (`frontend/src` intact, 184 tests sur 184 au vert) ; rien n'est publié ni commité.

Périmètre : les maquettes des quatre thèmes retenus, Pupitre 2 (`P-*`), Notice (`E-*`), Obsidienne (`F-*`), Visière (`V-*`), soit 16 planches dans `docs/design/ui-v2/` (sources `sources/page*-*.html`, `head*.html`, `build*.py`), et leurs images.

## 0. Point de restauration et outils

- Tag `ui-v2-pre-audit` sur 3e62abd, bundle `backups/u1-doctor-pre-ui-v2-audit.bundle`, images d'origine `backups/ui-v2-private-pre-audit-2026-11-10.zip` (31 Mo, 26 fichiers). Rien n'a été supprimé : les anciennes images restent dans `private/ui-v2/`.
- Banc local : `py -3 docs/design/ui-v2/sources/bench.py` (port 8790, le 8765 étant celui du backend de l'app) (configuration « ui-v2-bench » dans `.claude/launch.json`). Il sert les planches comme le canevas Design, avec le runtime du canevas copié dans `private/ui-v2/bench/support.js` (non versionné) et les images déclarées dans `sources/assets.json`.
- Outils réellement utilisés : Blender 5.2 (EEVEE, RTX 3070) pour les images de la U1, Three.js 0.187 (celui de l'app) pour la 3D, Vite (assemblage du module 3D), Playwright (captures, interactions, axe-core 4.14, mesures), skill `/design-taste-frontend` (lecture de design et contrôle anti-clichés).
- `/codex-imagegen` n'a pas servi, volontairement : les retouches Codex sont précisément ce qui avait effacé l'inscription. Voir § 2.

## 1. Lecture de design (`/design-taste-frontend`)

Le skill vise les pages vitrines ; il est appliqué ici en mode « refonte, préserver » sur une interface de produit (ses règles de mise en page de landing page ne s'appliquent pas, ses règles anti-clichés, contraste, mouvement motivé et réduction des mouvements s'appliquent).

| Thème | Lecture | Variance / Mouvement / Densité |
|---|---|---|
| Pupitre 2 | Instrument matériel de la U1 pour des makers, langage skeuomorphe (sérigraphie, LCD, touches à course) | 6 / 6 / 5 |
| Notice | Mode d'emploi illustré, priorité confiance et lisibilité | 4 / 4 / 4 |
| Obsidienne | Produit grand public haut de gamme, verre liquide sombre (approximation web du Liquid Glass, assumée comme telle) | 7 / 6 / 3 |
| Visière | HUD technique sombre, or serré, rouge réservé aux alertes | 8 / 7 / 4 |

Constats du skill retenus : boutons dont le texte ne se lit pas, contrastes de gris secondaires, mouvement non motivé ou absent (Notice et Obsidienne quasi immobiles), verre sans repli `prefers-reduced-transparency`, tirets longs dans des titres, police dont les chiffres se confondent avec des lettres. Écarts assumés : petites étiquettes en capitales sur chaque module de Pupitre 2 (c'est la sérigraphie de l'instrument, pas un « eyebrow » décoratif), points de couleur d'état (ils portent un état réel : OK, à vérifier, alerte).

## 2. Fidélité de la Snapmaker U1 (priorité absolue)

### Constat initial (vérifié en comparant à `U1_Jay_Pack_Complet/U1_Jay/U1_Jay_Apercu.png`)

| Image | Thèmes | Défauts |
|---|---|---|
| `obs-hero`, `vis-hero` (retouches Codex) | Obsidienne, Pupitre 2, Visière | Inscription « snapmaker » absente de la façade et de la tête blanche ; écran noir (le modèle affiche une interface) ; cercle de la tête orange saturé au lieu du pêche du modèle ; perspective différente de la référence |
| `obs-tetes`, `vis-tetes`, `obs-ecran`, `vis-ecran` | idem | Inscription de la tête absente ; l'écran montre un triangle « lecture » inventé |
| `vis-holo-d` | Visière | Calculé par contours sur `vis-hero`, donc sans inscription lui non plus |
| `notice-1` à `notice-4b` (dessins Codex) | Notice | Inscription absente ; écran remplacé par deux pictogrammes ; deux tubes en ambre au lieu d'un ; `notice-3` = engrenage générique inventé (déjà signalé dans le README) ; proportions approximatives |

Le modèle 3D du propriétaire porte l'inscription en **géométrie** (pas en texture) et l'écran en texture : tout rendu fait depuis le modèle les contient d'office.

### Correction : rendus depuis la scène du propriétaire, plus aucune retouche IA

- `docs/design/ui-v2/sources/render_u1.py` ouvre `U1_Jay_Master.blend` et ne change que la lumière, le fond, le sol et le cadrage. Caméra « héros » = la caméra orthographique exacte de `U1_Jay_Apercu.png` (élargie de 12 % pour la marge).
- 12 images (`private/ui-v2/renders/u1-{obs,vis,line,holo}-{hero,tetes,ecran}.png`, copies web dans `docs/design/ui-v2/lab/r/` via `export_web.py`, `render_all.sh` refait tout en ~2 min) :
  - `obs` : studio graphite, sol réfléchissant (Obsidienne, Pupitre 2) ;
  - `vis` : nuit, lumière or, liseré rouge discret (Visière) ;
  - `line` : aplats + traits Freestyle calculés sur la géométrie, la tête 3 en ambre en recolorant **uniquement** les faces de son bloc (îlot de géométrie isolé dans `FRAME__Graphite_Polymer`) (Notice) ;
  - `holo` : contours or sur fond transparent, même caméra que `vis`, donc aligné au pixel (Visière). Remplace l'ancien hologramme par contours d'image.
- Chaque rendu écrit un `.json` des repères projetés (têtes 2-4, tête montée, écran, plateau, buse, entrée du filament de la tête 3) : réticules, loupes, points et renvois sont recalés par calcul, pas à l'œil.
- Vérifié visuellement : inscription façade + tête, écran « snapmaker PRÊTE U1 », proportions, tubes, bobines, porte en verre fumé sombre, identiques à la référence, dans les 4 thèmes (captures `private/ui-v2/audit/rendus-blender_*.jpg` et `avant-apres_*.jpg`).
- La 3D temps réel (§ 4) charge le même modèle (`frontend/public/models/u1-jay.glb`) : la superposition affiche / 3D a été contrôlée en mode « différence » (aucun double contour).

### Points de fidélité à arbitrer (non corrigés, volontairement)

1. L'écran du modèle affiche « PRÊTE · Modèle de présentation · HORS LIGNE » alors que la démo raconte une impression en pause. Je n'ai pas inventé d'écran « pause » (interface réelle non documentée). Décision au propriétaire : garder la texture du modèle, ou fournir une capture réelle de l'écran en pause à poser comme texture.
2. Les dessins de Notice n'ont plus de main : un geste de main ne se calcule pas sur le modèle. Ils sont remplacés par un cercle ambre en pointillé + une flèche au même trait. À valider.
3. « Tête 3 = troisième bloc garé en partant de la gauche » reste une convention de maquette (README) ; dans le modèle, la tête 1 est sur le chariot et le bloc du milieu des trois garés est le n° 3 (`PTFE_CHANNEL_3`, mesuré).

## 3. Audit initial : défauts constatés (captures `private/ui-v2/audit/avant/`)

Mesures faites à 1440 × 1000 (Chromium, banc local) puis 1280 et 1920.

### Communs

| # | Défaut | Preuve | Correction |
|---|---|---|---|
| C1 | Inscription absente de toutes les images de la U1 | § 2 | Rendus Blender |
| C2 | 3 requêtes 404 `{{s.img}}`, `{{cur.img}}`, `{{t.img}}` : une `<img src="{{…}}">` est préchargée avant que le runtime ne remplisse le trou | journal réseau P-Accueil, E-Accueil, E-Verdict | Images de modèle passées en `background-image` |
| C3 | Infobulles fermées qui élargissent la page (11 px de défilement horizontal sur P-Accueil et P-Verdict) | `scrollWidth` 1436 > 1425 ; disparaît en masquant `.tip::after` | Infobulles hors du flux tant qu'elles sont fermées (`display:none` + fondu à l'ouverture), ancrage à droite (`.tl`) près du bord |
| C4 | Sur écran large, le héros (positions absolues depuis le bord gauche) se désaligne du contenu centré | lecture du code, 1920 px | Sections héros centrées (`max-width:1440px; margin:0 auto`) |
| C5 | Tirets longs dans les `<title>` (P, E, F) et « 214 – 221 °C » | `grep` | Remplacés ; contrôle ajouté à tous les scripts de build (`common.check`) |

### Pupitre 2

| # | Défaut | Correction |
|---|---|---|
| P1 | Titre LCD qui déborde : le point final est coupé (`scrollWidth` 1260 > 1172) | 58 → 52 px |
| P2 | « Voir les 11 autres » illisible (texte #1D1C1A sur touche noire) : `.app a{color:inherit}` l'emporte sur `.key-k` | `.app a.key-k` |
| P3 | « Glissez pour tourner · molette pour zoomer » sous une simple photo : promesse fausse | La fenêtre monte la U1 en 3D (glisser, molette, flèches, + / −, 0 ou double-clic pour revenir) |
| P4 | Couture visible autour de la photo dans la fenêtre noire | Affiche fondue (masque radial) puis 3D sur fond transparent |
| P5 | Imprimante à tickets vide au repos : grand blanc dans la colonne de droite | Talon de ticket déjà sorti (en-tête lisible), l'impression déroule la suite |

### Notice

| # | Défaut | Correction |
|---|---|---|
| E1 | Dessins Codex infidèles (§ 2), fond de l'illustration du héros légèrement gris (rectangle visible) | Rendus au trait sur blanc pur |
| E2 | Gris secondaires `--ink3` #85827B à 3,83:1, pastille verte 4,25:1, texte sur carte ambre 4,37:1 (axe : 30 nœuds sur 4 planches) | #6B6861 (5,56:1), #276B3C (5,42:1), #47453F (> 5,6:1) |
| E3 | À 1280 px, l'illustration déborde de 55 px | Groupe illustration + renvoi ancré à droite |
| E4 | Quasi aucune animation (2 keyframes) | Signature de mouvement § 5 |

### Obsidienne

| # | Défaut | Correction |
|---|---|---|
| F1 | Cercles parasites dans la barre (Simple/Expert, FR/EN) et dans les onglets d'étapes du Verdict : `.seg>span` écrase la position absolue du curseur `.thumb` (bug signalé dans le README) | `.seg>.thumb` |
| F2 | Albert Sans : le « 1 » se lit « l » (« Ul Doctor », « Votre Ul ») | Geist + Geist Mono (OFL, Google Fonts) |
| F3 | Frise « Ce qui s'est passé » : le trait 14:09 → 14:12 est invisible (dégradé `objectBoundingBox` sur une ligne horizontale) | `gradientUnits="userSpaceOnUse"` |
| F4 | Pastille « 3 » invisible sur l'image claire de l'écran | Fond sombre translucide |
| F5 | Couture du rectangle photo sur le graphite | Affiche fondue + 3D transparente |
| F6 | Panneau de verre du Verdict marbré (filtre de déplacement sur une grande surface) | Verre simple sur ce panneau, déplacement gardé sur barre et dock |
| F7 | Gris `--ink3` à 4,09:1 / 3,95:1 | Opacité .44 → .56 (≈ 5,5:1) |
| F8 | Pas de repli `prefers-reduced-transparency` | Plaque opaque #1C2027 |

### Visière

| # | Défaut | Correction |
|---|---|---|
| V1 | Inscription absente du rendu et de l'hologramme | Rendus `vis` + hologramme calculé sur la géométrie |
| V2 | Réticule, loupe et repères calés sur l'ancien cadrage | Recalés depuis les repères projetés |
| V3 | Aucun autre défaut bloquant : thème le plus abouti au départ (9 keyframes, repli transparence réduite déjà présent, curseur `.seg>.thumb` déjà juste, 0 violation axe) | — |

## 4. Three.js : une scène partagée, quatre rendus

`docs/design/ui-v2/lab/u1stage.js` (assemblé en `lab/dist/u1stage.bundle.js`, 760 Ko avec three) : la U1 du propriétaire, une caméra orthographique identique au rendu Blender (l'affiche sert de remplaçant au pixel près pendant le chargement et sans WebGL), mise en valeur de la tête 3 par une boîte injectée dans le shader (aucune géométrie ajoutée), vues nommées (héros, têtes, écran, tête 3, engrenage) avec vol de caméra (direction interpolée, zoom en logarithme), orbite bornée, repères projetés pour accrocher le HTML, plan de coupe, qualité adaptative, pause hors écran, plafond 60 images/s, `dispose()` complet.

| Planche | Usage | Pourquoi |
|---|---|---|
| P-Accueil | Fenêtre : la U1 se tourne et se zoome ; le viseur « T3 » suit la tête | Tenir la promesse affichée |
| E-Expert | Vue d'ensemble au trait calculée en direct (aplats + arêtes + silhouette à coque inversée) ; les renvois 1-2-3 suivent les pièces quand on tourne | Le dessin technique devient manipulable sans changer de langage graphique |
| F-Accueil | Photo au repos ; au survol, la même machine en 3D (parallaxe, glisser) ; au départ du pointeur, retour en douceur puis la photo revient | Garder la qualité d'image au repos, donner la machine « en main » |
| F-Verdict | La caméra vole de la tête 3 (étape 1) au sommet de la tête (2) puis à la façade (3) ; le point ambre suit | Remplace le zoom d'image par un vrai mouvement de caméra |
| V-Expert | Moitié hologramme (Fresnel or + arêtes, passe de profondeur pour ne pas additionner l'intérieur) / moitié rendu, séparées par un plan de coupe piloté par le curseur ; les étiquettes suivent la machine qui respire | Hologramme de la vraie géométrie, exigé par le README |

Choix assumé : V-Accueil garde le balayage 2D (avec l'hologramme Blender) : identique au pixel, plus léger, et le réticule ne doit pas glisser.

## 5. Motion design : une signature par thème

Toutes les animations sont coupées sous `prefers-reduced-motion` (contrôlé : 0 animation en cours, 0 élément resté invisible sur 6 planches).

| Thème | Signature | Ajouts |
|---|---|---|
| Pupitre 2 | Mise sous tension, mécanique, crantée | Les modules se posent avec un petit rebond « vissé », les écrans LCD chauffent par crans (`steps`), en plus de l'aiguille, du clavier et du ticket existants |
| Notice | Le trait se dessine, la page se tourne | Renvois et cercles ambre qui se tracent, illustration du Verdict qui glisse à chaque étape |
| Obsidienne | Le verre se pose, un reflet le traverse | Arrivée des panneaux en ressort, reflet unique, mise au point lente des images au survol, texte d'étape qui glisse, vol de caméra 3D |
| Visière | Verrouillage et balayage | Existant conservé ; étiquettes et réticule qui suivent la machine en 3D (V-Expert) |

## 6. Typographie

| Thème | Polices | Licence | Décision |
|---|---|---|---|
| Pupitre 2 | Doto, Barlow, Barlow Semi Condensed, Permanent Marker, Courier Prime | OFL / Apache 2.0 (Google Fonts) | Gardées ; titre LCD ramené à 52 px |
| Notice | Schibsted Grotesk, Atkinson Hyperlegible Next, IBM Plex Mono | OFL | Gardées |
| Obsidienne | **Geist, Geist Mono** (au lieu d'Albert Sans, IBM Plex Mono) | OFL | Changé : chiffres non ambigus, paire cohérente |
| Visière | Oxanium, Saira (axe `wdth`), JetBrains Mono | OFL | Gardées |

Chiffres en chasse fixe (`tabular-nums`) dans les 4 thèmes. Caractères français (œ, É, ê, «  ») contrôlés à l'écran dans chaque police.

## 7. Nombre d'or

Déjà présent et conservé : grilles `1.618fr / 1fr` (colonnes principales des 4 thèmes), espacements 21 / 34 px. Ajout raisonné : aucun forçage supplémentaire. Le cadrage du héros (machine dans un cadre 724 × 860) et les vues 3D ne l'imposent pas : la lisibilité de la tête 3 prime.

## 8. Tests et mesures (réels)

| Contrôle | Résultat |
|---|---|
| Erreurs console / 404 sur les 16 planches | 0 erreur, 0 requête en échec (hors `/favicon.ico` du banc) |
| Défilement horizontal 1440 / 1280 / 1920 | 0 px partout après correction ; héros F et V réduits par paliers sous 1440 px, entiers à 1280 |
| axe-core 4.14 (WCAG 2 A et AA, gravité sérieuse ou critique) | 0 violation sur les 16 planches (avant : 30 nœuds sur Notice, 17 sur Obsidienne). Limite : axe classe « à vérifier » les textes posés sur dégradé ou photo (jusqu'à 88 nœuds par planche en Pupitre et Visière) ; ils ont été contrôlés à la main par le second audit |
| Contraste des boutons d'accent (texte contre les deux extrémités du dégradé, calculé) | 8,8:1 au minimum sur les 16 planches |
| Réduction des mouvements | 0 animation active, 0 élément invisible |
| Coût d'une image 3D (RTX 3070, Direct3D 11, rendu synchrone attendu jusqu'au GPU) | P-Accueil 0,69 ms · E-Expert 0,31 ms · F-Accueil 0,83 ms · F-Verdict 0,86 ms (2,64 ms à densité ×2 plein écran) · V-Expert 1,14 ms. Marge × 15 à × 50 sur 60 images/s |
| Charge 3D | 271 k triangles (modèle), 45 à 283 appels de dessin selon le thème ; V-Expert 1,36 M triangles traités (modèle + profondeur + hologramme) |
| Arrivée de la 3D (modèle déjà en cache) | 0,2 à 1,3 s selon le thème |
| Mémoire | 8 montages / démontages de suite : tas JS sans dérive (145 → 92 Mo après ramassage), pas d'avertissement « trop de contextes WebGL » |
| Tests de l'application (`vitest`) | 24 fichiers, 184 tests au vert (app non modifiée) |

Limite de mesure, dite franchement : le navigateur de test qui a le GPU tourne masqué, donc `requestAnimationFrame` y est bridé à 1 image/s ; le navigateur lancé depuis ce poste n'obtient que le rendu logiciel (WARP / SwiftShader). Les images/s réelles en fenêtre visible n'ont donc **pas** été mesurées ; le coût par image, lui, l'a été. Sur GPU intégré, prévoir 10 à 20 fois plus lent : V-Expert est le seul cas à surveiller (voir plan).

Défaut de performance trouvé par la mesure et corrigé : la 3D d'Obsidienne tournait en continu à 240 images/s alors qu'elle était cachée derrière la photo, jusqu'à bloquer la navigation suivante. Désormais : plafond 60 images/s, aucune boucle quand la 3D n'est pas affichée.

## 9. Second audit (indépendant)

Fait par un agent de revue séparé, sans mon plan ni mes intentions : seulement les 16 planches, 133 contrôles, 123 captures (`private/ui-v2/audit/second-audit/`). Il a trouvé des défauts que mes contrôles automatiques laissaient passer (axe ne mesure pas un contraste sur dégradé ou sur photo). Chaque constat a été revérifié avant correction.

| Prio | Constat | Suite |
|---|---|---|
| P1 | Boutons ambre d'Obsidienne et Visière en texte quasi blanc (1,4 à 1,7:1) : `.app a{color:inherit}` l'emportait sur `.btn-a` (même cause que la touche de Pupitre) | Corrigé : 9,5 à 9,8:1 mesurés |
| P1 | Dock d'Obsidienne et Visière invisible au premier écran (y = 1731 à 2094) : `overflow:hidden` sur `.app` casse `position:sticky` | Corrigé (`overflow-x:clip`) : dock à y = 902 |
| P1 | Pupitre : le dock masquait le bouton principal au premier écran | Corrigé : « Ce qu'il faut faire » passe au-dessus du galvanomètre (bouton à y = 477) |
| P1 | Visière Verdict : fond qui ne couvre pas l'écran (coutures à x = 1350, x = 203, y = 77) | Corrigé : fonds recalculés pour couvrir 1440 × 900 (même correction sur le repli d'Obsidienne) |
| P2 | Repère tête 3 sur la tête montée après rotation (P, E) ; décalage de 4 / 9 px au repos | Corrigé : repère au haut de la face avant de la tête 3, rotation bornée à ±24° |
| P2 | Inscription cachée par des cartes ou des renvois (F/V-Expert, F-Verdict étape 3, E-Accueil) | Corrigé : cartes et renvois déplacés, caméra de l'étape 3 recadrée |
| P2 | Coutures bas / droite des héros F et V | Corrigé : fondu sur les bords |
| P2 | Vignette 3 d'Obsidienne et Visière : bande vide de 40 px ; vignette 1 d'Obsidienne sans repère | Corrigé : recadrage (inscription + écran), point ambre sur les 3 vignettes |
| P2 | Gris secondaires de Pupitre à 2,72:1 ; légende illisible sur le rendu du Verdict | Corrigé : `--ink3` #58544C ; légende sur pastille sombre |
| P2 | Bas de colonnes non alignés (P, E) | Corrigé pour les rangées à deux cartes ; E-Verdict (image de hauteur fixe) laissé |
| P2 | Dock « Historique » allumé sur les pages Expert ; « Rejouer la session » renvoyait à l'Accueil (E, F) | Corrigé : « Accueil » actif ; lien vers la carte de rejeu |
| P2 | Écran du modèle « PRÊTE / HORS LIGNE » contre « en pause » | Non corrigé : décision au propriétaire (je n'invente pas l'interface réelle) |
| P2 | Héros décalé de 7 px (1440) à 42 px (1280) par rapport au contenu centré | Résiduel : conséquence des héros composés à 1440 px ; réglé par la mise en page fluide du plan |
| P3 | Étape 2 « Vérifiez » / « Nettoyez » ; titres d'onglets « E · / F · / V · » ; « VERROUILLÉ » lu comme « indisponible » ; légende du radar à 1,65:1 ; infobulle figée ; titre de F-Expert coupé avant « · » ; ticket vide sur P-Verdict ; bouton désactivé de P-Diagnostiquer sans explication ; légende « Plateau » sur la charnière | Corrigés |
| P3 | Réglages et FR/EN sans effet, Exporter vers l'accueil, « HEURE DE RÉCEPTION » sans valeur, compteur 4/5 ambigu, rouge pour « en pause » en Visière (conforme au README : la pause est une alerte) | Laissés : limites de maquette ou choix documentés ; à traiter à l'intégration |

Points forts relevés par l'agent : Pupitre (métaphore matérielle la plus aboutie), Notice (le plus lisible, tête 3 ambre cohérente), Obsidienne (caméra par étape convaincante), Visière (HUD cohérent, colonnes alignées, rejeu synchronisé).

## 10. Fichiers modifiés ou créés

- Sources : `docs/design/ui-v2/sources/head{P,E,F,V}.html`, `page{P,E,F,V}-*.html` (16), `build{P,E,F,V}.py`, nouveaux `common.py`, `assets.json`, `bench.py`, `render_u1.py`, `render_all.sh`, `export_web.py`.
- 3D : `docs/design/ui-v2/lab/u1stage.js`, `vite.lab.config.mjs`, `test.html` (labo), `perf.mjs` (mesures), `.gitignore` (`dist/`, `r/`).
- Planches régénérées : `docs/design/ui-v2/maquettes/*.dc.html` (16).
- Configuration : `.claude/launch.json` (banc « ui-v2-bench »).
- Images (non versionnées) : `private/ui-v2/renders/` (rendus + repères), `docs/design/ui-v2/lab/r/` (copies web), `private/ui-v2/audit/` (captures `avant/`, `apres/`, `second-audit/`, planches `avant-apres_*.jpg`, rendus `rendus-blender_*.jpg`).

## 11. Ce qui reste et décisions au propriétaire

Voir la restitution finale et `U1_DOCTOR_PLAN_IMPLEMENTATION_THEMES.md` § 9.
