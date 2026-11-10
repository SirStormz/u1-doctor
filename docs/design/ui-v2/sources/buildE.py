"""Planches E « Notice » (préfixe E-) : head + barre + dock."""

import pathlib, re

B = pathlib.Path(__file__).parent
OUT = B.parent / "maquettes"

LOGO = ('<svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">'
        '<path d="M5 5v13a8 8 0 0 0 16 0v-3h2.5l2-5 3 10 2-5" stroke="#FFB547" stroke-width="2.6" '
        'stroke-linecap="round" stroke-linejoin="round"></path><circle cx="30" cy="20" r="1.5" fill="#FFB547"></circle></svg>')
LOCK = ('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"></rect>'
        '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>')
GEAR = ('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'aria-hidden="true"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"></path><circle cx="15" cy="6" r="2"></circle>'
        '<circle cx="9" cy="12" r="2"></circle><circle cx="17" cy="18" r="2"></circle></svg>')



ICONS = {
    "Accueil": '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M10 21v-6h4v6"></path>',
    "Diagnostiquer": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    "J'ai un problème": '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>',
    "Historique": '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    "Partager": '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M16 6l-4-4-4 4"></path><path d="M12 2v13"></path>',
}

# ---------- Direction E « Notice » ----------
HEADE = (B / "headE.html").read_text(encoding="utf-8")
ET = {"Accueil": "E-Accueil.dc.html", "Diagnostiquer": "E-Diagnostiquer.dc.html", "J'ai un problème": "E-Diagnostiquer.dc.html",
      "Historique": "E-Expert.dc.html", "Partager": "E-Expert.dc.html"}
ELOGO = LOGO.replace('stroke="#FFB547" stroke-width="2.6"', 'stroke="#1D1C1A" stroke-width="2.8"').replace('fill="#FFB547"></circle>', 'fill="#FFB547" stroke="#1D1C1A" stroke-width="1.2"></circle>')


def topE(expert: bool, back: bool) -> str:
    seg = ('<a href="E-Accueil.dc.html" class="tip dn" data-tip="Revient à l’essentiel : ce qui se passe et quoi faire.">Simple</a>'
           '<span class="on" aria-current="true">Expert</span>') if expert else (
           '<span class="on" aria-current="true">Simple</span><a href="E-Expert.dc.html" class="tip dn" data-tip="Affiche le détail technique : '
           'codes bruts, horaires précis, sources et preuves. Chaque terme a son explication au survol.">Expert</a>')
    back_html = '<a href="E-Accueil.dc.html" class="pill hide-sm" style="text-decoration:none">← Accueil</a>' if back else ''
    ro = ("5 lectures et 1 abonnement pendant la capture, 0 commande envoyée." if expert else
          "U1 Doctor lit l'état de l'imprimante, il n'envoie jamais de commande. Rien ne peut être modifié sur votre U1.")
    return f'''<header class="top">
<a class="brand" href="E-Accueil.dc.html">{ELOGO}<b>U1 Doctor</b></a>
{back_html}
<span class="pill tip dn hide-sm" tabindex="0" data-tip="{ro}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>Lecture seule</span>
<span class="pill dash tip dn hide-sm" tabindex="0" data-tip="Ces données sont un exemple fictif pour découvrir l’application. Rien ne vient de votre imprimante.">Exemple de démo</span>
<div style="flex-grow:1"></div>
<div class="seg" role="group" aria-label="Niveau de détail">{seg}</div>
<div class="seg hide-sm" role="group" aria-label="Langue"><span class="on">FR</span><a href="E-Accueil.dc.html">EN</a></div>
<button type="button" class="btn" aria-label="Réglages" style="width:44px;min-height:40px;padding:0">{GEAR}</button>
</header>'''


def dockE(active: str) -> str:
    items = []
    for name, paths in ICONS.items():
        on = ' class="on" aria-current="page"' if name == active else ''
        items.append(f'<a href="{ET[name]}"{on}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                     f'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>{name}</a>')
    return '<nav class="dock" aria-label="Navigation principale">\n' + "\n".join(items) + '\n</nav>'


for src in sorted(B.glob("pageE-*.html")):
    name = "E-" + src.stem[len("pageE-"):] + ".dc.html"
    t = src.read_text(encoding="utf-8").replace("@@HEAD@@", HEADE)
    t = re.sub(r"@@TOP:(simple|expert)(:back)?@@", lambda m: topE(m.group(1) == "expert", bool(m.group(2))), t)
    t = re.sub(r"@@DOCK:([^@]+)@@", lambda m: dockE(m.group(1)), t)
    assert "@@" not in t, name
    (OUT / name).write_text(t, encoding="utf-8")
    print("ok", name, len(t))
