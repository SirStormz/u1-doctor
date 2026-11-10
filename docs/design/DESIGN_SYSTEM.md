# DESIGN_SYSTEM (G0.5-B) — source de vérité : `frontend/src/design/`

Fichiers : `tokens.css` (variables + utilitaires + mouvement), `components.css` (puces, boutons, navigation, redaction), `src/index.css` (mapping Tailwind v4 `@theme inline`). Polices **embarquées localement** (paquets Fontsource, une famille titres / texte / codes par thème UI V2, liste dans `THIRD_PARTY_NOTICES.md`) : aucune requête externe.

## 1. Tokens de couleur sémantiques (3 thèmes, `data-theme`)
| Token | Night (défaut) | Graphite | Light | Usage |
|---|---|---|---|---|
| `--bg-0 / --bg-1` | #070d18 / #0a1220 | #0c0d0f / #121316 | #e9edf4 / #f4f6fa | page / app |
| `--surface-1/2/3` | #111b2b / #162236 / #1b2a42 | #181a1e / #1f2227 / #272a30 | #fff / #f0f3f8 / #e6ebf3 | cartes, cartes élevées, survol |
| `--line` / `--line-strong` | #243249 / #3a5074 | #2f333a / #4a4f59 | #d3dbe8 / #9aa8bf | séparateurs décoratifs |
| **`--control-line`** | #5f7799 | #6f7480 | #6f7d95 | bordures de **contrôles** (≥ 3:1, WCAG 1.4.11) |
| `--ink / -2 / -3` | #e6edf7 / #a9b7cc / #8497b2 | #ececee / #b6b8bf / #9094a0 | #0f172a / #334155 / #566176 | texte / secondaire / discret |
| `--accent` / `--accent-ink` | #00c7ff / #04121c | #3fd0ee / #06161b | #006e9a / #fff | identité, focus / texte sur accent |
| `--ok --warn --danger` | #22c55e #f59e0b #f87171 | #4ade80 #fbbf24 #fb7185 | #166534 #9a5b00 #b91c1c | observé / attention / gravité officielle |
| `--demo --replay` | #a78bfa #60a5fa | #b4a0ff #7db4ff | #6d28d9 #1d4ed8 | modes DEMO (réservé) et REPLAY |
Utilitaires Tailwind : `bg-surface`, `text-ink2`, `border-control`, `text-accent`… (voir `index.css`).
**Contrastes mesurés** (`tests/contrast.test.ts`, 16 tests, 3 thèmes) : texte principal ≥ 7:1 (AAA) sur toutes les surfaces ; secondaire/discret ≥ 4,5:1 ; chaque ton de statut en texte sur sa puce teintée ≥ 4,5:1 ; `--control-line` ≥ 3:1. *(Le test a fait corriger 2 défauts réels : bordures de champs à 2,1:1 et vert du thème clair à 4,2:1.)*

## 2. Typographie
Polices par thème (jetons `--font-display`, `--font-ui`, `--font-mono` dans `tokens.css`) : Pupitre = Barlow Semi Condensed / Barlow / JetBrains Mono ; Notice = Schibsted Grotesk / Atkinson Hyperlegible Next / IBM Plex Mono ; Obsidienne = Geist / Geist / Geist Mono ; Visière = Oxanium / Saira / JetBrains Mono. Échelle : Display 40/44 (accueil) · Chiffre héros 72/72 tabulaire · H1 28/36 · H2 panneau 15/20 semi-gras · Corps 14/22 · Légende 12/18 · Micro 11/16 majuscules +14 % d'interlettrage. Largeur de ligne ≤ 70 caractères pour les paragraphes (`max-w-3xl`).

## 3. Grille, espacement, rayons, ombres
Base 4 px ; gouttière `--gap` 16 px (10 px en densité compacte) ; padding de carte `--pad` 16/10. Rayons 6/10/14 px. Élévation par **surface + bordure + ombre interne 1 px** (`--shadow-1/2`), halo cyan `--glow` réservé au panneau actif. Texture : grille « blueprint » 32 px à 5 % et grain 4 % (désactivé en clair).

## 4. Composants (voir COMPONENT_INVENTORY.md)
Boutons `primary / secondary / ghost` (+ icône, désactivé, focus) · `Chip` à 7 tons · `ProvenanceChip`, `TimeChip`, `SeverityChip`, `ClassChip` · `Panel` (titre, icône, actions, actif, DEMO, repères d'angle) · `Stat` (chiffre héros) · `LedgerBars` · `Seal` · `Kbd` · `Logo`.

## 5. Navigation et structure
Barre haute (logo, mode, lecture seule, palette `Ctrl K`, thème, langue) → bandeau de mode → [barre latérale 232 px, **rail d'icônes 64 px sous 1440 px**] + contenu (`max-w 1520`) → bandeau de sécurité. Lien d'évitement « Aller au contenu », focus déplacé sur `<main>` à chaque changement d'écran, `aria-current="page"`.

## 6. Tableaux, filtres, graphiques techniques, timelines
Tableaux natifs `<table>` avec `<caption class="sr-only">`, en-têtes `micro`, lignes cliquables **et** bouton clavier. Filtre = `<select>` étiqueté. `SignalChart` (SVG) : voies ligne/état, **aucune ligne tracée à travers un trou**, bandes de trou *par-dessus* les voies, curseur `role="slider"` (flèches, Home/End, PgUp/PgDn) + **vue tableau** équivalente. `HypothesisMap` : cadre plein = fait, tirets = hypothèse/donnée manquante, lien pointillé = proximité temporelle.

## 7. Formulaires, dialogues, notifications
Champs : bordure `--control-line`, libellé visible, aide associée (`aria-describedby`). Palette de commandes : `role="dialog" aria-modal`, focus piégé, Échap, flèches/Entrée. Toasts : région `aria-live="polite"`, 3,2 s, icône + texte.

## 8. États
`StateBlock` : **loading** (squelettes), **empty** (consigne), **error** (`role="alert"` + « Réessayer »), **unavailable** (« NON DISPONIBLE DANS CETTE VERSION »). Donnée périmée (STALE) : valeur atténuée + puce, jamais supprimée. Série interrompue : « PAS DE DONNÉE » plutôt qu'une valeur plausible.

## 9. Mouvement
Jetons : `--ease: cubic-bezier(.2,.8,.2,1)`, 120/200/320 ms. `rise`, `fade`, `shimmer`, `toast-in` n'animent que `transform`/`opacity` (**vérifié par test**). `prefers-reduced-motion` : durées ≈ 0, plus de cascade, plus de shimmer, intro 3D et rotation auto coupées.

## 10. Responsive et résolutions Windows
Cibles **1920×1080** et **1366×768** (testées au navigateur : 0 débordement horizontal sur les 10 écrans). Points de rupture : `xl` 1280 (mises en page 2–3 colonnes), 1440 (rail d'icônes), 1500 (libellé de la palette). Taille minimale de fenêtre visée : 1024×640 (non audité). Règle CSS globale : toute grille sans colonnes explicites est `minmax(0,1fr)` (corrige les débordements « max-content »).

## 11. Accessibilité (WCAG 2.2 AA visé)
Contrastes mesurés (§1) · focus visible 2 px cyan · cibles ≥ 32 px · libellés/`aria-*` sur tous les contrôles · axe-core : 0 violation structure/ARIA sur les 10 écrans · parcours clavier testés (palette, curseur de chronologie, filtre, navigation) · FR/EN au même niveau de certitude. **Non couvert** : lecteur d'écran réel, zoom 200 %, contraste mesuré dans le navigateur (jsdom ne le calcule pas — remplacé par le test de tokens).
