"""Planches V « Visière » : head + nav + dock + filtres SVG + réticule (@@RET:x|y|taille@@)."""
import math, pathlib, re
from common import assets, check

B = pathlib.Path(__file__).parent
OUT = B.parent / "maquettes"
HEAD = (B / "headV.html").read_text(encoding="utf-8")

LOGO = ('<svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true" class="glow">'
        '<path d="M5 5v13a8 8 0 0 0 16 0v-3h2.5l2-5 3 10 2-5" stroke="#FFB547" stroke-width="2.8" '
        'stroke-linecap="round" stroke-linejoin="round"></path><circle cx="30" cy="20" r="1.6" fill="#FFB547"></circle></svg>')
GEAR = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'aria-hidden="true"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"></path><circle cx="15" cy="6" r="2"></circle>'
        '<circle cx="9" cy="12" r="2"></circle><circle cx="17" cy="18" r="2"></circle></svg>')
ICONS = {
    "Accueil": '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M10 21v-6h4v6"></path>',
    "Diagnostiquer": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    "J'ai un problème": '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>',
    "Historique": '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    "Partager": '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M16 6l-4-4-4 4"></path><path d="M12 2v13"></path>',
}
T = {"Accueil": "V-Accueil.dc.html", "Diagnostiquer": "V-Diagnostiquer.dc.html", "J'ai un problème": "V-Diagnostiquer.dc.html",
     "Historique": "V-Expert.dc.html", "Partager": "V-Expert.dc.html"}

DEFS = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
        '<filter id="lq" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.007 0.011" numOctaves="1" seed="4" result="t"></feTurbulence>'
        '<feGaussianBlur in="t" stdDeviation="2.5" result="tb"></feGaussianBlur>'
        '<feDisplacementMap in="SourceGraphic" in2="tb" scale="30" xChannelSelector="R" yChannelSelector="B"></feDisplacementMap></filter>'
        '</defs></svg>')


def nav(expert: bool, back: bool) -> str:
    if expert:
        seg = ('<a href="V-Accueil.dc.html" class="tip dn" data-tip="Revient à l’essentiel : ce qui se passe et quoi faire.">Simple</a>'
               '<span class="on" aria-current="true">Expert</span><span class="thumb" style="left:50%;width:calc(50% - 3px)"></span>')
    else:
        seg = ('<span class="on" aria-current="true">Simple</span><a href="V-Expert.dc.html" class="tip dn" data-tip="Affiche le détail '
               'technique : codes bruts, horaires précis, sources et preuves. Chaque terme a son explication au survol.">Expert</a>'
               '<span class="thumb" style="left:3px;width:calc(50% - 3px)"></span>')
    back_html = '<a href="V-Accueil.dc.html" class="chip hide-sm" style="text-decoration:none">← Accueil</a>' if back else ''
    return f'''<header class="nav gl lq br" role="banner">
<a class="brand" href="V-Accueil.dc.html">{LOGO}U1 Doctor</a>
{back_html}
<span class="chip tip dn hide-sm" tabindex="0" data-tip="U1 Doctor lit l’état de l’imprimante, il n’envoie jamais de commande."><span class="dia" style="background:var(--ink)"></span>Lecture seule</span>
<span class="chip dash tip dn hide-sm" tabindex="0" data-tip="Ces données sont un exemple fictif pour découvrir l’application. Rien ne vient de votre imprimante.">Exemple de démo</span>
<div class="seg" role="group" aria-label="Niveau de détail">{seg}</div>
<div class="seg hide-sm" role="group" aria-label="Langue"><span class="on">FR</span><a href="V-Accueil.dc.html">EN</a><span class="thumb" style="left:3px;width:calc(50% - 3px)"></span></div>
<button type="button" class="ibtn" aria-label="Réglages">{GEAR}</button>
</header>'''


def dock(active: str) -> str:
    items = []
    for name, paths in ICONS.items():
        on = ' class="on" aria-current="page"' if name == active else ''
        items.append(f'<a href="{T[name]}"{on}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                     f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>{name}</a>')
    return '<nav class="dock gl lq br" aria-label="Navigation principale">\n' + "\n".join(items) + '\n</nav>'


def ret(x: float, y: float, s: float, extra: str = "") -> str:
    """Réticule centré sur (x, y) : anneau pointillé, anneau à 4 arcs, équerres de verrouillage."""
    c = s / 2
    r1, r2 = s * .46, s * .36
    circ = 2 * math.pi * r2
    a, g = circ * .18, circ * .07
    k, L = s * .25, s * .1
    d =" ".join(f'M{c + sx * k + (-sx) * L:.1f} {c + sy * k:.1f}H{c + sx * k:.1f}V{c + sy * k + (-sy) * L:.1f}'
                 for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)))
    ticks = " ".join(f'M{c + r1 * math.cos(t):.1f} {c + r1 * math.sin(t):.1f}L{c + (r1 + 7) * math.cos(t):.1f} {c + (r1 + 7) * math.sin(t):.1f}'
                     for t in (0, math.pi / 2, math.pi, 3 * math.pi / 2))
    return (f'<svg class="ret" width="{s:.0f}" height="{s:.0f}" viewBox="0 0 {s:.0f} {s:.0f}" aria-hidden="true" '
            f'style="left:{x - c:.0f}px;top:{y - c:.0f}px{extra}"><g class="glow" fill="none" stroke="#FFB547">'
            f'<circle class="ra" cx="{c}" cy="{c}" r="{r1:.1f}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 7"></circle>'
            f'<path d="{ticks}" stroke-width="1.5" stroke-opacity=".8"></path>'
            f'<circle class="rb" cx="{c}" cy="{c}" r="{r2:.1f}" stroke-width="1.5" stroke-dasharray="{a:.1f} {g:.1f}"></circle>'
            f'<path class="lk" d="{d}" stroke-width="2.2" stroke-linecap="square"></path>'
            f'<path d="M{c - 7} {c}H{c - 2.5}M{c + 2.5} {c}H{c + 7}M{c} {c - 7}V{c - 2.5}M{c} {c + 2.5}V{c + 7}" stroke-width="1.5"></path>'
            f'</g></svg>')


def rticks() -> str:
    """Graduations du radar : une toutes les 10 s, longue à chaque minute (1 degré = 1 seconde)."""
    d = []
    for i in range(36):
        a = math.radians(i * 10)
        r0 = 136 if i % 6 == 0 else 144
        d.append(f'M{200 + r0 * math.sin(a):.1f} {200 - r0 * math.cos(a):.1f}L{200 + 150 * math.sin(a):.1f} {200 - 150 * math.cos(a):.1f}')
    return f'<path d="{" ".join(d)}" stroke="rgba(255,214,154,.4)" stroke-width="1.2"></path>'


for src in sorted(B.glob("pageV-*.html")):
    name = "V-" + src.stem[len("pageV-"):] + ".dc.html"
    t = src.read_text(encoding="utf-8").replace("@@HEAD@@", HEAD).replace("@@DEFS@@", DEFS)
    t = re.sub(r"@@NAV:(simple|expert)(:back)?@@", lambda m: nav(m.group(1) == "expert", bool(m.group(2))), t)
    t = re.sub(r"@@DOCK:([^@]+)@@", lambda m: dock(m.group(1)), t)
    t = t.replace("@@RTICKS@@", rticks())
    t = re.sub(r"@@RET:([\d.]+)\|([\d.]+)\|([\d.]+)@@", lambda m: ret(float(m.group(1)), float(m.group(2)), float(m.group(3))), t)
    t = assets(t)
    check(t, name)
    (OUT / name).write_text(t, encoding="utf-8", newline="\n")
    print("ok", name, len(t))
