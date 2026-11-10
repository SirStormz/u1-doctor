# UI V2 — trois thèmes retenus : Pupitre 2, Notice, Obsidienne

Maquettes validées le 2026-11-10 par le propriétaire. Ces trois directions **remplacent les thèmes actuels** de l'app (`light`, `graphite`, `night` dans `frontend/src/lib/prefs.tsx` et `frontend/src/design/tokens.css`). Rien n'est encore codé dans `frontend/src`.

Canevas de maquette (privé, claude.ai) : https://claude.ai/artifact/9WfUYAyLC6KUM9Ca6Nb8k6 — 3 rangées de 4 planches cliquables (Accueil Simple, Accueil Expert, Verdict, Diagnostiquer).

## Les trois thèmes

| | **Pupitre 2** (`P-*`) | **Notice** (`E-*`) | **Obsidienne** (`F-*`) |
|---|---|---|---|
| Idée | L'app est un instrument matériel de la U1 | Un vrai mode d'emploi illustré | Liquid Glass sombre sur la vraie U1 |
| Fond | Plastique gris chaud microbillé (texture photo) | Blanc `#FFFFFF` | Graphite `#0B0D10` |
| Accent | Écran LCD ambre `#FFB547`, texte `#2A1B03` | Ambre `#FFB547` sur la seule pièce à toucher | Ambre pour les états, verre blanc translucide |
| Polices | Doto (LCD), Barlow, Barlow Semi Condensed (sérigraphie), Permanent Marker (ruban), Courier Prime (ticket) | Schibsted Grotesk, Atkinson Hyperlegible Next, IBM Plex Mono | Albert Sans, IBM Plex Mono |
| Signature | Galvanomètre à aiguille, imprimante à tickets, clavier qui tape dans l'écran, molette de lecture, capot de sécurité, leviers | Illustrations au trait des 3 gestes, vue d'ensemble à renvois numérotés, boutons à ombre dure qui s'enfoncent | Verre réel posé sur la photo, loupe liquide sur la tête 3, curseurs de verre qui glissent, fond qui zoome d'étape en étape, étiquettes de verre sur les pièces |
| Navigation | Rangée de touches (dock) | Dock à contour | Dock et barre en verre (filtre SVG de déplacement, Chromium) |

Décisions communes aux trois : mode Simple par défaut et Expert en couches, verdicts en mots courants (Constaté, À vérifier, Pas assez d'infos, Exemple de démo), infobulles partout, `prefers-reduced-motion` respecté, aucune donnée inventée (seulement la session de démo étiquetée), **aucun halo ni lueur**.

## Fichiers

- `maquettes/` : les 12 planches `.dc.html` publiées sur le canevas + `canvas.json`.
- `sources/` : les sources (`page*-*.html`, `head*.html`) et les scripts `build{E,F,P}.py` qui assemblent les planches dans `maquettes/` (`python sources/buildP.py`).
- Images : dans `private/ui-v2/` (non versionné, dérivé du modèle U1_Jay). Les planches les appellent par leur adresse d'asset du canevas :

| Asset canevas | Fichier local | Thème |
|---|---|---|
| `/_blob/593dda…` `/_blob/239501…` `/_blob/8faf0c…` `/_blob/3cf673…` | `private/ui-v2/notice/notice-1.png`, `-2`, `-3`, `-4b` | Notice |
| `/_blob/5cb5b3…` `/_blob/3cd39a…` `/_blob/bcb369…` | `private/ui-v2/obsidienne/obs-hero.png`, `obs-tetes.png`, `obs-ecran.png` | Obsidienne, Pupitre 2 |
| `/_blob/fb7958…` `/_blob/60fa9b…` `/_blob/751cd1…` | `private/ui-v2/pupitre2/matiere.jpg`, `bouton.jpg`, `cadran.jpg` | Pupitre 2 |

## Règles à garder pour l'implémentation

- **Fidélité U1** : toute image de la U1 part des rendus de `U1_Jay_Pack_Complet/U1_Jay/` (retouche Codex « géométrie identique », jamais de génération libre). Dans l'app, la U1 reste le modèle 3D `U1_Jay_WEB.glb`.
- Notice : l'illustration `notice-3` (engrenage interne) est un schéma générique, à refaire ou à remplacer.
- Obsidienne : `backdrop-filter: url(#lq)` ne marche que sous Chromium ; prévoir le flou simple ailleurs (pywebview sous Windows = WebView2, donc Chromium).
- La numérotation « tête 3 = troisième en partant de la gauche, vue de face » est une convention de maquette ; la correspondance réelle reste à confirmer.

## Prochaines étapes

1. Remplacer le type `Theme` (`light | graphite | night`) par `pupitre | notice | obsidienne`, avec migration de la préférence enregistrée (`u1d.theme`).
2. Écrire un jeu de tokens par thème dans `frontend/src/design/tokens.css`, puis les composants propres à chaque thème (galvanomètre, ticket, loupe, illustrations).
3. Choisir le thème par défaut et la bascule dans Réglages.
4. Mettre à jour README, Pages, captures et release une fois le code livré.
