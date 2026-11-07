# COMPONENT_INVENTORY (G0.5-B) — état au 2026-11-05

| Composant | Fichier | Rôle | Réutilisable | Testé |
|---|---|---|---|---|
| `Chip` (7 tons) | `components/ui.tsx` | puce d'état/provenance | ✅ | axe + app |
| `ProvenanceChip` · `TimeChip` · `SeverityChip` · `ClassChip` | `ui.tsx` | provenance, qualité d'heure, gravité officielle, statut | ✅ | app |
| `Button` (primary/secondary/ghost, icône) | `ui.tsx` + `components.css` | actions | ✅ | clavier/app |
| `Panel` (titre, actions, actif, DEMO, repères) | `ui.tsx` | conteneur sémantique `<section aria-labelledby>` | ✅ | axe ×10 |
| `Stat` | `ui.tsx` | chiffre héros + micro-libellé | ✅ | — |
| `LedgerBars` | `ui.tsx` | registre pour/contre/manquant (comptes) | ✅ | app (pas de %) |
| `Seal` | `ui.tsx` | sceau de rejeu | ✅ | app |
| `StateBlock` (loading/empty/error/unavailable) · `Skeleton` | `ui.tsx` | états | ✅ | app |
| `Kbd`, `Logo` | `ui.tsx` | clavier, marque | ✅ | — |
| `Shell` (barre haute, bandeau de mode, nav, bandeau de sécurité) | `components/shell.tsx` | cadre d'application | spécifique | app |
| `Palette` (Ctrl K) | `shell.tsx` | navigation + décodage de code | spécifique | clavier ×2 |
| `ToastCtx`/`useToast` · `PageTitle` | `shell.tsx` | notifications, titre de page | ✅ | app |
| `SignalChart` + `deriveSeries`/`segments` | `viz/SignalChart.tsx` | graphique multi-voies, trous, curseur | ✅ | clavier, table |
| `HypothesisMap` · `MiniStrip` | `viz/HypothesisMap.tsx` | faits/hypothèses, fil mini | ✅ | axe |
| `U1Viewer` (three.js, chargé à la demande) | `viz/U1Viewer.tsx` | modèle 3D, intro, éclaté, survol, pins, repli sans WebGL | ✅ | repli (jsdom) ; rendu vérifié au navigateur |
| `canon`, `sha256Hex`, `createZip` | `lib/` | hash et ZIP déterministes (prototype) | ✅ | rapport |
| `PrefsProvider`, `usePrefs`, i18n FR/EN | `lib/prefs.tsx`, `lib/i18n.ts` | thème, densité, langue (parité testée) | ✅ | app |
| Tokens | `design/tokens.css` | 3 thèmes, mouvement | ✅ | contraste ×16 |

**À améliorer / manquants** : `Select`/`Field` génériques (les champs sont stylés en ligne), composant `Table` factorisé (3 tables similaires), `Dialog` générique (la palette est spécifique), tooltip accessible générique, `Tabs`. Aucune bibliothèque de composants externe n'est utilisée ; nouvelles dépendances d'exécution : `lucide-react`, 2 paquets de polices, `three` (lazy).
