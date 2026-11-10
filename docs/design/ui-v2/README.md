# UI V2 — quatre thèmes retenus : Pupitre 2, Notice, Obsidienne, Visière

Maquettes validées le 2026-11-10 par le propriétaire (Visière ajoutée et validée le même jour). Ces quatre directions **remplacent les thèmes actuels** de l'app (`light`, `graphite`, `night` dans `frontend/src/lib/prefs.tsx` et `frontend/src/design/tokens.css`). Rien n'est encore codé dans `frontend/src`.

Canevas de maquette (privé, claude.ai) : https://claude.ai/artifact/9WfUYAyLC6KUM9Ca6Nb8k6 — 4 rangées de 4 planches cliquables (Accueil Simple, Accueil Expert, Verdict, Diagnostiquer).

## Les quatre thèmes

| | **Pupitre 2** (`P-*`) | **Notice** (`E-*`) | **Obsidienne** (`F-*`) | **Visière** (`V-*`) |
|---|---|---|---|---|
| Idée | L'app est un instrument matériel de la U1 | Un vrai mode d'emploi illustré | Liquid Glass sombre sur la vraie U1 | HUD de casque néon posé sur la vraie U1 |
| Fond | Plastique gris chaud microbillé (texture photo) | Blanc `#FFFFFF` | Graphite `#0B0D10` | Quasi noir `#08070A` |
| Accent | Écran LCD ambre `#FFB547`, texte `#2A1B03` | Ambre `#FFB547` sur la seule pièce à toucher | Ambre pour les états, verre blanc translucide | Or `#FFB547` / `#FFD99A`, rouge `#FF3B2F` pour les alertes |
| Polices | Doto (LCD), Barlow, Barlow Semi Condensed (sérigraphie), Permanent Marker (ruban), Courier Prime (ticket) | Schibsted Grotesk, Atkinson Hyperlegible Next, IBM Plex Mono | Albert Sans, IBM Plex Mono | Oxanium, Saira, JetBrains Mono |
| Signature | Galvanomètre à aiguille, imprimante à tickets, clavier qui tape dans l'écran, molette de lecture, capot de sécurité, leviers | Illustrations au trait des 3 gestes, vue d'ensemble à renvois numérotés, boutons à ombre dure qui s'enfoncent | Verre réel posé sur la photo, loupe liquide sur la tête 3, curseurs de verre qui glissent, fond qui zoome d'étape en étape, étiquettes de verre sur les pièces | Réticule qui verrouille la tête 3, scan qui révèle l'hologramme, radar de session, appui long pour autoriser |
| Navigation | Rangée de touches (dock) | Dock à contour | Dock et barre en verre (filtre SVG de déplacement, Chromium) | Dock et barre en verre sombre à équerres d'angle |

Décisions communes aux quatre : mode Simple par défaut et Expert en couches, verdicts en mots courants (Constaté, À vérifier, Pas assez d'infos, Exemple de démo), infobulles partout, `prefers-reduced-motion` respecté, aucune donnée inventée (seulement la session de démo étiquetée), **aucun halo ni lueur** (Visière : lueur serrée seulement, voir ci-dessous).

## Visière (`V-*`) en détail

Ajouté et validé le 2026-11-10 à la demande du propriétaire (HUD cyberpunk sombre, néon, Liquid Glass sombre, couleurs et univers inspirés de l'armure rouge et or d'Iron Man, sans aucun élément de la marque). Rangée du bas du canevas (y 7300).

| | **Visière** (`V-*`) |
|---|---|
| Idée | L'app vue à travers la visière d'un casque : un HUD posé sur la vraie U1 |
| Fond | Quasi noir `#08070A`, verre liquide sombre teinté chaud, fines lignes de balayage |
| Accent | Or `#FFB547` / `#FFD99A` pour le HUD et « À vérifier », rouge `#FF3B2F` réservé aux alertes (code de blocage, pause), blanc `#F6F1EA` pour « Constaté ». Pas de cyan (refusé par le propriétaire) |
| Polices | Oxanium (titres, valeurs), Saira (texte, étiquettes condensées via l'axe `wdth`), JetBrains Mono (codes) |
| Formes | Panneaux à rayon 2-3 px avec équerres d'angle or, boutons et interrupteurs à coins coupés, instruments circulaires |
| Signature | Réticule qui verrouille la tête 3 (anneaux qui tournent, équerres qui se referment), faisceau de scan qui révèle l'hologramme or aligné au pixel, titre qui se décode, parallaxe de visière au pointeur, gros plan circulaire gradué, décodeur de code qui se déchiffre, vue hologramme à glisser (Expert), radar de session 1 tour = 6 min qui rejoue et pilote le curseur de la courbe, réticule qui vole de cible en cible (Verdict), choix du mode par verrouillage, autorisation par appui long d'une seconde (Entrée au clavier) |
| Néon | Lueur serrée seulement (`drop-shadow` ≤ 3 px, `text-shadow` ≤ 7 px à faible opacité), jamais de halo flou ni de tache de couleur : exception assumée à la règle « aucune lueur » des trois autres thèmes |

Images (dans `private/ui-v2/visiere/`, non versionnées) : `vis-hero` (retouche Codex de `obs-hero`, éclairage or et liseré rouge), `vis-tetes` (retouche de `obs-tetes`), `vis-ecran` (retouche de `obs-ecran`), `vis-holo-d` (hologramme **calculé à partir des pixels de `vis-hero`** : contours Sobel + rampe or + lignes de balayage, donc géométrie identique ; l'hologramme généré par Codex a été écarté car il ajoutait des montants internes et n'était pas aligné). Il se refait avec `py -3 sources/holoV.py private/ui-v2/visiere/vis-hero.png private/ui-v2/visiere/vis-holo-d.png apercu.jpg`.

## Fichiers

- `maquettes/` : les 16 planches `.dc.html` publiées sur le canevas + `canvas.json`.
- `sources/` : les sources (`page*-*.html`, `head*.html`) et les scripts `build{E,F,P,V}.py` qui assemblent les planches dans `maquettes/` (`python sources/buildP.py`). `canvasV.py` ajoute la rangée Visière à `maquettes/canvas.json`.
- Images : dans `private/ui-v2/` (non versionné, dérivé du modèle U1_Jay). Les planches les appellent par leur adresse d'asset du canevas :

| Asset canevas | Fichier local | Thème |
|---|---|---|
| `/_blob/593dda…` `/_blob/239501…` `/_blob/8faf0c…` `/_blob/3cf673…` | `private/ui-v2/notice/notice-1.png`, `-2`, `-3`, `-4b` | Notice |
| `/_blob/5cb5b3…` `/_blob/3cd39a…` `/_blob/bcb369…` | `private/ui-v2/obsidienne/obs-hero.png`, `obs-tetes.png`, `obs-ecran.png` | Obsidienne, Pupitre 2 |
| `/_blob/fb7958…` `/_blob/60fa9b…` `/_blob/751cd1…` | `private/ui-v2/pupitre2/matiere.jpg`, `bouton.jpg`, `cadran.jpg` | Pupitre 2 |
| `/_blob/bba1de…` `/_blob/0ebb16…` `/_blob/dba15c…` `/_blob/beed23…` | `private/ui-v2/visiere/vis-hero.jpg`, `vis-holo-d.jpg`, `vis-tetes.jpg`, `vis-ecran.jpg` | Visière |

## Règles à garder pour l'implémentation

- **Fidélité U1** : toute image de la U1 part des rendus de `U1_Jay_Pack_Complet/U1_Jay/` (retouche Codex « géométrie identique », jamais de génération libre). Dans l'app, la U1 reste le modèle 3D `U1_Jay_WEB.glb`.
- Notice : l'illustration `notice-3` (engrenage interne) est un schéma générique, à refaire ou à remplacer.
- Obsidienne : `backdrop-filter: url(#lq)` ne marche que sous Chromium ; prévoir le flou simple ailleurs (pywebview sous Windows = WebView2, donc Chromium).
- La numérotation « tête 3 = troisième en partant de la gauche, vue de face » est une convention de maquette ; la correspondance réelle reste à confirmer.
- Visière : si la U1 de l'app reste le modèle 3D, l'hologramme et le scan se font sur le modèle (contours du GLB) plutôt qu'avec une image ; jamais d'hologramme généré par IA. Le rouge reste réservé aux alertes.
- Maquettes P, E et F : le curseur `.thumb` des sélecteurs Simple/Expert et FR/EN est peut-être mal placé (la règle `.seg>span` écrase `position:absolute`, corrigé dans Visière par `.seg>.thumb`). À ne pas reproduire dans le code.

## Prochaines étapes

1. Remplacer le type `Theme` (`light | graphite | night`) par `pupitre | notice | obsidienne | visiere`, avec migration de la préférence enregistrée (`u1d.theme`). Garder le système de thèmes ouvert à d'autres thèmes.
2. Écrire un jeu de tokens par thème dans `frontend/src/design/tokens.css`, puis les composants propres à chaque thème (galvanomètre, ticket, loupe, illustrations, réticule, radar, hologramme).
3. Choisir le thème par défaut et la bascule dans Réglages.
4. Mettre à jour README, Pages, captures et release une fois le code livré.
