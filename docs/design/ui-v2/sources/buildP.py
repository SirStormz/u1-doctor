"""Planches Pupitre 2 (préfixe P-)."""
import pathlib, re
B = pathlib.Path(__file__).parent
OUT = B.parent / "maquettes"
HEAD = (B / "headP.html").read_text(encoding="utf-8")
LOGO = ('<svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 5v13a8 8 0 0 0 16 0v-3h2.5l2-5 3 10 2-5" '
        'stroke="#2B2A27" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="30" cy="20" r="1.7" fill="#2B2A27"></circle></svg>')
GEAR = ('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
        '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"></path><circle cx="15" cy="6" r="2"></circle><circle cx="9" cy="12" r="2"></circle>'
        '<circle cx="17" cy="18" r="2"></circle></svg>')
ICONS = {
    "Accueil": '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M10 21v-6h4v6"></path>',
    "Diagnostiquer": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    "J'ai un problème": '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>',
    "Historique": '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    "Partager": '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M16 6l-4-4-4 4"></path><path d="M12 2v13"></path>',
}
T = {"Accueil": "P-Accueil.dc.html", "Diagnostiquer": "P-Diagnostiquer.dc.html", "J'ai un problème": "P-Diagnostiquer.dc.html",
     "Historique": "P-Expert.dc.html", "Partager": "P-Expert.dc.html"}

import math
def meter(vmin, vmax, val, label, major, minor, delay="0.6s"):
    cx, cy, r = 595, 605, 400
    def pt(a, rad):
        a = math.radians(a)
        return cx + rad * math.sin(a), cy - rad * math.cos(a)
    out = []
    v = vmin
    while v <= vmax + 1e-9:
        a = -50 + (v - vmin) / (vmax - vmin) * 100
        isM = abs((v - vmin) / major - round((v - vmin) / major)) < 1e-6
        x1, y1 = pt(a, 352 if isM else 376); x2, y2 = pt(a, 400)
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#2B2A27" stroke-width="{5 if isM else 2.5}"></line>')
        if isM:
            lx, ly = pt(a, 312)
            out.append(f'<text x="{lx:.1f}" y="{ly + 14:.1f}" text-anchor="middle" font-family="Barlow Semi Condensed, sans-serif" font-weight="600" font-size="40" fill="#2B2A27">{int(v)}</text>')
        v += minor
    x1, y1 = pt(-50, 400); x2, y2 = pt(50, 400)
    arc = f'<path d="M{x1:.1f} {y1:.1f} A400 400 0 0 1 {x2:.1f} {y2:.1f}" fill="none" stroke="#2B2A27" stroke-width="3"></path>'
    ang = -50 + (val - vmin) / (vmax - vmin) * 100
    needle = (f'<g class="needle" style="--a:{ang:.2f}deg;animation-delay:{delay}"><line x1="595" y1="640" x2="595" y2="175" stroke="#1D1C1A" stroke-width="5" stroke-linecap="round"></line>'
              f'<rect x="580" y="630" width="30" height="34" rx="6" fill="#1D1C1A"></rect></g>')
    lab = f'<text x="595" y="500" text-anchor="middle" font-family="Barlow Semi Condensed, sans-serif" font-weight="600" font-size="30" letter-spacing="5" fill="#5A564F">{label}</text>'
    return (f'<div class="meter"><img src="/_blob/751cd1888ff84641392f3db298853324" alt="">'
            f'<svg viewBox="0 0 1200 800" role="img" aria-label="{label} : {str(val).replace(".", ",")}">{arc}{"".join(out)}{lab}{needle}</svg></div>')


def top(expert, back):
    if expert:
        slide = ('<a href="P-Accueil.dc.html" class="slide r tip dn" data-tip="Revient à l’essentiel : ce qui se passe et quoi faire." '
                 'aria-label="Passer en mode Simple"><span class="silk off">Simple</span><span class="tr"><span class="kn"></span></span><span class="silk on">Expert</span></a>')
    else:
        slide = ('<a href="P-Expert.dc.html" class="slide tip dn" data-tip="Affiche le détail technique : codes bruts, horaires précis, sources et '
                 'preuves. Chaque terme a son explication au survol." aria-label="Passer en mode Expert"><span class="silk on">Simple</span>'
                 '<span class="tr"><span class="kn"></span></span><span class="silk off">Expert</span></a>')
    back_html = '<a href="P-Accueil.dc.html" class="key hide-sm" style="min-height:36px;padding:0 14px">← Accueil</a>' if back else ''
    return f'''<header style="display:flex;align-items:center;gap:20px;height:84px;padding:0 40px">
<a class="plate" href="P-Accueil.dc.html">{LOGO}<b>U1 Doctor</b></a>
{back_html}
<span class="tip dn hide-sm" tabindex="0" data-tip="U1 Doctor lit l’état de l’imprimante, il n’envoie jamais de commande." style="display:inline-flex;align-items:center;gap:9px"><span class="led g"></span><span class="silk">Lecture seule</span></span>
<span class="tape hand tip dn hide-sm" tabindex="0" data-tip="Ces données sont un exemple fictif pour découvrir l’application. Rien ne vient de votre imprimante." style="transform:rotate(-2.5deg);font-size:14px">exemple de démo</span>
<div style="flex-grow:1"></div>
{slide}
<span class="slide hide-sm" aria-label="Langue : français"><span class="silk on">FR</span><span class="tr" style="width:48px"><span class="kn" style="width:21px"></span></span><span class="silk off">EN</span></span>
<button type="button" class="key" aria-label="Réglages" style="min-height:40px;width:44px;padding:0">{GEAR}</button>
</header>'''


def dock(active):
    items = []
    for n, p in ICONS.items():
        on = ' class="on" aria-current="page"' if n == active else ''
        items.append(f'<a href="{T[n]}"{on}><span class="cap"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                     f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p}</svg></span><span class="silk">{n}</span></a>')
    return '<nav class="dock" aria-label="Navigation principale">\n' + "\n".join(items) + '\n</nav>'


for src in sorted(B.glob("pageP-*.html")):
    name = "P-" + src.stem[len("pageP-"):] + ".dc.html"
    t = src.read_text(encoding="utf-8").replace("@@HEAD@@", HEAD)
    t = re.sub(r"@@TOP:(simple|expert)(:back)?@@", lambda m: top(m.group(1) == "expert", bool(m.group(2))), t)
    t = re.sub(r"@@DOCK:([^@]+)@@", lambda m: dock(m.group(1)), t)
    t = re.sub(r"@@METER:([^@]+)@@", lambda m: meter(*[(float(x) if i in (0,1,2,4,5) else x) for i, x in enumerate(m.group(1).split("|"))]), t)
    assert "@@" not in t, name
    (OUT / name).write_text(t, encoding="utf-8")
    print("ok", name, len(t))
