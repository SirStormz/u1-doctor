// Builds the animated SVGs of the README into ../docs/media/readme/ : 4 diagrams x dark/light x EN/FR.
// Dark = site theme A (Visière x Obsidienne), light = theme B (Notice x Pupitre). The README picks one with <picture>.
// The banner embeds the owner's own Blender render (never an AI image). Animations are CSS only, and only run when the
// visitor has not asked for reduced motion. Run from site/: node scripts/build-readme-svgs.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const OUT = p("../../docs/media/readme/");
mkdirSync(OUT, { recursive: true });

const D = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";
const M = "ui-monospace,'Cascadia Mono',Consolas,'SF Mono',Menlo,monospace";

const THEMES = {
  dark: { bg: "#08070a", panel: "#0d0b0e", line: "#2a2420", strong: "#6b5a44", ink: "#f6f1ea", ink2: "#b9afa3", acc: "#ffb547", accText: "#ffb547", accInk: "#2a1b03", danger: "#ff5a4d", shadow: null, sw: 1.5, img: "hud-hero", glow: true },
  light: { bg: "#ffffff", panel: "#eceae5", line: "#141414", strong: "#141414", ink: "#141414", ink2: "#383838", acc: "#ffb547", accText: "#8a5200", accInk: "#2a1b03", danger: "#c8261b", shadow: "#141414", sw: 2, img: "line-hero", glow: false },
};

const TXT = {
  en: {
    alt: "U1 Doctor",
    tag1: "When a print stops, know what happened.",
    tag2: "Local | Read-only | No cloud, no telemetry, no AI",
    q1: "What does this code mean?", q2: "What happened, and when?", q3: "What can I show someone?",
    code: "Error code", official: "official wiki page", observed: "observed facts only", gap: "gap",
    bundle: "evidence bundle", scan: "privacy scan checked", replay: "replays on any PC",
    pc: "Your PC", pcSub: "runs on 127.0.0.1 only", printer: "Your U1", printerSub: "answers read-only requests",
    reads: "reads: at most 13 GET requests", noCmd: "no command, no G-code, no pause", noCloud: "No cloud. No telemetry. Nothing leaves this PC.",
    gapsTitle: "Gaps stay gaps", gapNote: "no data here does not mean nothing happened", observedLbl: "observed", gapLbl: "gap",
    sameTitle: "Same input, same result", inputs: "same observations + same rules", run1: "Run 1", run2: "Run 2", same: "same hash", example: "example",
    h1: "We are missing", h2: "one real failure.", sub1: "Only normal prints have been captured so far.", sub2: "Every incident in the app is synthetic.",
    count: "real failures received", n1: "Your U1 stops", n2: "You send a report", n3: "The rules get tested",
    bReport: "Send an incident report", bForum: "Snapmaker forum", bDiscord: "Snapmaker Discord",
  },
  fr: {
    alt: "U1 Doctor",
    tag1: "Quand une impression s'arrête, sache ce qui s'est passé.",
    tag2: "Local | Lecture seule | Ni cloud, ni télémétrie, ni IA",
    q1: "Que signifie ce code ?", q2: "Que s'est-il passé, et quand ?", q3: "Que puis-je montrer ?",
    code: "Code d'erreur", official: "page officielle du wiki", observed: "faits observés seulement", gap: "trou",
    bundle: "paquet de preuves", scan: "contrôle de confidentialité fait", replay: "se rejoue sur tout PC",
    pc: "Ton PC", pcSub: "tourne sur 127.0.0.1 seulement", printer: "Ta U1", printerSub: "répond à des requêtes en lecture seule",
    reads: "lit : 13 requêtes GET au maximum", noCmd: "aucune commande, aucun G-code, aucune pause", noCloud: "Aucun cloud. Aucune télémétrie. Rien ne quitte ce PC.",
    gapsTitle: "Un trou reste un trou", gapNote: "pas de donnée ici ne veut pas dire que rien ne s'est passé", observedLbl: "observé", gapLbl: "trou",
    sameTitle: "Même entrée, même résultat", inputs: "mêmes observations + mêmes règles", run1: "Rejeu 1", run2: "Rejeu 2", same: "même empreinte", example: "exemple",
    h1: "Il nous manque", h2: "une vraie panne.", sub1: "Seules des impressions normales ont été capturées.", sub2: "Tout incident de l'app est synthétique.",
    count: "pannes réelles reçues", n1: "Ta U1 s'arrête", n2: "Tu envoies un rapport", n3: "Les règles sont testées",
    bReport: "Envoyer un rapport", bForum: "Forum Snapmaker", bDiscord: "Discord Snapmaker",
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const doc = (w, h, t, css, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
text{font-family:${D}}
.m{font-family:${M}}
.hl,.scan,.type,.trav{opacity:0}
${css}
@media (prefers-reduced-motion:no-preference){
${ANIM}
}
</style>
<rect width="${w}" height="${h}" fill="${t.bg}"/>
${body}
</svg>
`;

// all animations live here, so a visitor who asked for reduced motion sees a still, complete picture
const ANIM = `
.scan{animation:scan 4.2s linear infinite}
@keyframes scan{0%{transform:translateY(0);opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translateY(var(--h));opacity:0}}
.pop{transform-box:fill-box;transform-origin:center;animation:pop 3.6s ease-in-out infinite}
@keyframes pop{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
.hl{animation:hl 9s ease-in-out infinite both}
@keyframes hl{0%,36%,100%{opacity:0}6%,28%{opacity:1}}
.type{opacity:1;transform-box:fill-box;transform-origin:right center;animation:type 9s steps(19,end) infinite}
@keyframes type{0%{transform:scaleX(1)}16%,30%{transform:scaleX(0)}34%,100%{transform:scaleX(1)}}
.cur{animation:cur 7s linear infinite}
@keyframes cur{0%{transform:translateX(0)}100%{transform:translateX(var(--w))}}
.flow{stroke-dasharray:12 10;animation:flow 1.1s linear infinite}
@keyframes flow{to{stroke-dashoffset:-22}}
.beat{animation:beat 2.4s ease-in-out infinite}
@keyframes beat{0%,100%{opacity:.45}50%{opacity:1}}
.chk{animation:chk 9s ease-in-out infinite;opacity:1}
@keyframes chk{0%,60%{opacity:0}66%,92%{opacity:1}100%{opacity:0}}
.eq{transform-box:fill-box;transform-origin:center;animation:eq 2.4s ease-in-out infinite}
@keyframes eq{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2.6s ease-out infinite}
@keyframes ping{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.trav{animation:trav 5s ease-in-out infinite}
@keyframes trav{0%{transform:translateX(0);opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translateX(420px);opacity:0}}
.fade{animation:fade 1.2s ease-out}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;

const box = (t, x, y, w, h, fill = t.panel, extra = "") =>
  (t.shadow ? `<rect x="${x + 6}" y="${y + 6}" width="${w}" height="${h}" fill="${t.shadow}"/>` : "") +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${t.line}" stroke-width="${t.sw}" ${extra}/>`;

const brackets = (t, x, y, w, h, s = 26) => {
  const c = t.acc, k = `stroke="${c}" stroke-width="3" fill="none"`;
  return `<path d="M${x} ${y + s}V${y}H${x + s}M${x + w - s} ${y}H${x + w}V${y + s}M${x} ${y + h - s}V${y + h}H${x + s}M${x + w - s} ${y + h}H${x + w}V${y + h - s}" ${k}/>`;
};

const badge = (t, cx, cy, n) =>
  `<circle cx="${cx}" cy="${cy}" r="19" fill="${t.acc}" stroke="${t.line}" stroke-width="${t.sw}"/><text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="21" font-weight="800" fill="${t.accInk}">${n}</text>`;

const check = (t, x, y) => `<path d="M${x} ${y + 7}L${x + 6} ${y + 13}L${x + 17} ${y}" stroke="${t.accText}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

let render;
async function image(t) {
  const buf = await sharp(p(`../src/img/${t.img}.webp`)).resize({ width: 520 }).webp({ quality: 74, effort: 6 }).toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

/* ---------- 1. banner ---------- */
async function banner(t, x) {
  const W = 1280, H = 440, iw = 320, ih = 380, ix = 850, iy = 30;
  const src = await image(t);
  const body = `
${t.glow ? `<defs><radialGradient id="g" cx="70%" cy="50%" r="55%"><stop offset="0" stop-color="#2a1d0e"/><stop offset="1" stop-color="${t.bg}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>` : ""}
${t.glow ? `<rect width="${W}" height="${H}" fill="#fff" opacity=".035" style="mix-blend-mode:overlay"/>` : ""}
<g class="fade">
<text x="72" y="196" font-size="124" font-weight="800" fill="${t.ink}" letter-spacing="-2">U1 <tspan fill="${t.accText}">Doctor</tspan></text>
<text x="76" y="262" font-size="34" font-weight="600" fill="${t.ink}">${esc(x.tag1)}</text>
<text x="76" y="312" font-size="22" class="m" fill="${t.ink2}">${esc(x.tag2)}</text>
</g>
${t.shadow ? `<rect x="${ix + 7}" y="${iy + 7}" width="${iw}" height="${ih}" fill="${t.shadow}"/>` : ""}
<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="${t.bg}" stroke="${t.dark === false ? t.line : t.line}" stroke-width="${t.sw}"/>
<image href="${src}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice"/>
${t.glow ? `<g style="--h:${ih - 40}px" class="scan"><rect x="${ix}" y="${iy}" width="${iw}" height="40" fill="${t.acc}" opacity=".16"/><rect x="${ix}" y="${iy + 38}" width="${iw}" height="3" fill="${t.acc}"/></g>${brackets(t, ix, iy, iw, ih)}` : ""}
${!t.glow ? `<g class="pop"><circle cx="${ix + 70}" cy="${iy + 78}" r="19" fill="${t.acc}" stroke="${t.line}" stroke-width="2"/><text x="${ix + 70}" y="${iy + 85}" text-anchor="middle" font-size="21" font-weight="800" fill="${t.accInk}">1</text></g>
<g class="pop" style="animation-delay:.8s"><circle cx="${ix + 170}" cy="${iy + 190}" r="19" fill="${t.acc}" stroke="${t.line}" stroke-width="2"/><text x="${ix + 170}" y="${iy + 197}" text-anchor="middle" font-size="21" font-weight="800" fill="${t.accInk}">2</text></g>
<g class="pop" style="animation-delay:1.6s"><circle cx="${ix + 250}" cy="${iy + 96}" r="19" fill="${t.acc}" stroke="${t.line}" stroke-width="2"/><text x="${ix + 250}" y="${iy + 103}" text-anchor="middle" font-size="21" font-weight="800" fill="${t.accInk}">3</text></g>` : ""}
`;
  return doc(W, H, t, "", body, x.alt);
}

/* ---------- 2. the three questions ---------- */
function questions(t, x) {
  const W = 1280, H = 470, cw = 366, ch = 290, cy = 120, xs = [40, 457, 874];
  const titles = [x.q1, x.q2, x.q3];
  let body = "";
  xs.forEach((cx, i) => {
    body += badge(t, cx + 19, 66, i + 1) + `<text x="${cx + 50}" y="75" font-size="25" font-weight="700" fill="${t.ink}">${esc(titles[i])}</text>`;
    body += box(t, cx, cy, cw, ch);
    body += `<rect class="hl" style="animation-delay:${i * 3}s" x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="${t.acc}" stroke-width="4"/>`;
  });
  // arrows
  [xs[0] + cw + 6, xs[1] + cw + 6].forEach((ax) => (body += `<path d="M${ax} 265h30m-9 -9 9 9 -9 9" stroke="${t.ink2}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`));
  // card 1: the code and its answer
  const a = xs[0];
  body += `<text x="${a + 24}" y="${cy + 40}" font-size="15" class="m" fill="${t.ink2}">${esc(x.code)}</text>`;
  body += `<rect x="${a + 24}" y="${cy + 54}" width="318" height="54" fill="${t.dark === false ? t.bg : t.bg}" stroke="${t.strong}" stroke-width="${t.sw}"/>`;
  body += `<text x="${a + 38}" y="${cy + 89}" font-size="22" class="m" fill="${t.accText}">0003-0530-0000-0002</text>`;
  body += `<rect class="type" x="${a + 28}" y="${cy + 58}" width="310" height="46" fill="${t.bg}"/>`;
  body += `<path d="M${a + 183} ${cy + 122}v26m-8 -8 8 8 8 -8" stroke="${t.ink2}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  body += `<text x="${a + 24}" y="${cy + 188}" font-size="25" font-weight="800" fill="${t.ink}">Calibration Anomaly</text>`;
  body += `<text x="${a + 24}" y="${cy + 226}" font-size="17" class="m" fill="${t.accText}" text-decoration="underline">${esc(x.official)}</text>`;
  // card 2: observed timeline with a gap
  const b = xs[1], x0 = b + 26, x1 = b + cw - 26;
  let ticks = "";
  for (let i = 0, px = x0; px < x1; i++, px += 9) {
    if (px > b + 190 && px < b + 240) continue;
    const hgt = 14 + ((i * 7) % 5) * 5;
    ticks += `<rect x="${px}" y="${cy + 150 - hgt}" width="3" height="${hgt}" fill="${t.acc}"/>`;
  }
  body += ticks + `<rect x="${b + 190}" y="${cy + 100}" width="50" height="56" fill="none" stroke="${t.ink2}" stroke-width="2" stroke-dasharray="5 4"/>`;
  body += `<text x="${b + 215}" y="${cy + 134}" text-anchor="middle" font-size="15" class="m" fill="${t.ink2}">${esc(x.gap)}</text>`;
  body += `<rect x="${x0}" y="${cy + 156}" width="${x1 - x0}" height="3" fill="${t.line}"/>`;
  body += `<g class="cur" style="--w:${x1 - x0 - 4}px"><rect x="${x0}" y="${cy + 84}" width="3" height="82" fill="${t.ink}"/></g>`;
  body += `<text x="${b + 24}" y="${cy + 226}" font-size="17" class="m" fill="${t.ink2}">${esc(x.observed)}</text>`;
  // card 3: the bundle
  const c = xs[2];
  body += `<path d="M${c + 40} ${cy + 46}h62l24 24v86h-86z" fill="${t.bg}" stroke="${t.line}" stroke-width="${t.sw}"/><path d="M${c + 102} ${cy + 46}v24h24" fill="none" stroke="${t.line}" stroke-width="${t.sw}"/>`;
  body += `<rect x="${c + 76}" y="${cy + 84}" width="12" height="46" fill="${t.acc}" stroke="${t.line}" stroke-width="1.5"/>`;
  body += `<text x="${c + 150}" y="${cy + 92}" font-size="26" font-weight="800" class="m" fill="${t.ink}">U1-DEB</text>`;
  body += `<text x="${c + 150}" y="${cy + 122}" font-size="16" class="m" fill="${t.ink2}">${esc(x.bundle)}</text>`;
  body += `<g class="chk">${check(t, c + 28, cy + 178)}</g><text x="${c + 62}" y="${cy + 192}" font-size="18" fill="${t.ink}">${esc(x.scan)}</text>`;
  body += `<g class="chk" style="animation-delay:.6s">${check(t, c + 28, cy + 218)}</g><text x="${c + 62}" y="${cy + 232}" font-size="18" fill="${t.ink}">${esc(x.replay)}</text>`;
  return doc(W, H, t, "", body, `${x.q1} ${x.q2} ${x.q3}`);
}

/* ---------- 3. read-only ---------- */
function readonly(t, x) {
  const W = 1280, H = 450, by = 80, bh = 220, bw = 360;
  let body = "";
  body += box(t, 60, by, bw, bh) + box(t, 860, by, bw, bh);
  body += `<text x="${60 + bw / 2}" y="${by + 100}" text-anchor="middle" font-size="40" font-weight="800" fill="${t.ink}">${esc(x.pc)}</text>`;
  body += `<text x="${60 + bw / 2}" y="${by + 146}" text-anchor="middle" font-size="20" class="m" fill="${t.accText}">U1 Doctor</text>`;
  body += `<text x="${60 + bw / 2}" y="${by + 182}" text-anchor="middle" font-size="16" class="m" fill="${t.ink2}">${esc(x.pcSub)}</text>`;
  body += `<text x="${860 + bw / 2}" y="${by + 100}" text-anchor="middle" font-size="40" font-weight="800" fill="${t.ink}">${esc(x.printer)}</text>`;
  body += `<text x="${860 + bw / 2}" y="${by + 146}" text-anchor="middle" font-size="20" class="m" fill="${t.accText}">Moonraker</text>`;
  body += `<text x="${860 + bw / 2}" y="${by + 182}" text-anchor="middle" font-size="16" class="m" fill="${t.ink2}">${esc(x.printerSub)}</text>`;
  // top lane: printer -> PC, allowed
  body += `<text x="640" y="${by + 70}" text-anchor="middle" font-size="19" class="m" fill="${t.ink}">${esc(x.reads)}</text>`;
  body += `<path d="M850 ${by + 96}H440" stroke="${t.acc}" stroke-width="5" fill="none" class="flow"/><path d="M450 ${by + 82}l-22 14 22 14z" fill="${t.acc}"/>`;
  // bottom lane: PC -> printer, refused
  body += `<path d="M430 ${by + 166}H850" stroke="${t.ink2}" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round" fill="none" opacity=".7"/>`;
  body += `<g class="beat"><circle cx="640" cy="${by + 166}" r="22" fill="${t.bg}" stroke="${t.danger}" stroke-width="4"/><path d="M628 ${by + 154}l24 24m0 -24l-24 24" stroke="${t.danger}" stroke-width="4.5" stroke-linecap="round"/></g>`;
  body += `<text x="640" y="${by + 218}" text-anchor="middle" font-size="19" class="m" fill="${t.ink2}">${esc(x.noCmd)}</text>`;
  // cloud, crossed out
  body += `<g transform="translate(70 ${by + 276})"><path d="M20 62a18 18 0 0 1 2-36a28 28 0 0 1 54-6a22 22 0 0 1 8 42z" fill="none" stroke="${t.ink2}" stroke-width="3.5" stroke-linejoin="round"/><path d="M6 76L96 2" stroke="${t.danger}" stroke-width="5" stroke-linecap="round"/></g>`;
  body += `<text x="190" y="${by + 330}" font-size="24" font-weight="600" fill="${t.ink}">${esc(x.noCloud)}</text>`;
  return doc(W, H, t, "", body, `${x.pc} ${x.reads}; ${x.noCmd}; ${x.noCloud}`);
}

/* ---------- 4. gaps stay gaps, same input same result ---------- */
function replay(t, x) {
  const W = 1280, H = 470, x0 = 60, x1 = 1220, ty = 150;
  let body = `<text x="60" y="56" font-size="30" font-weight="800" fill="${t.ink}">${esc(x.gapsTitle)}</text>`;
  let ticks = "";
  for (let i = 0, px = x0; px < x1; i++, px += 10) {
    if (px > 610 && px < 830) continue;
    const hgt = 20 + ((i * 11) % 7) * 6;
    ticks += `<rect x="${px}" y="${ty - hgt}" width="4" height="${hgt}" fill="${t.acc}"/>`;
  }
  body += ticks;
  body += `<rect x="${x0}" y="${ty + 4}" width="${x1 - x0}" height="3" fill="${t.line}"/>`;
  body += `<rect x="618" y="${ty - 66}" width="206" height="76" fill="none" stroke="${t.ink2}" stroke-width="2" stroke-dasharray="6 5"/>`;
  body += `<text x="721" y="${ty - 20}" text-anchor="middle" font-size="22" class="m" fill="${t.ink2}">${esc(x.gapLbl)}</text>`;
  body += `<text x="721" y="${ty + 44}" text-anchor="middle" font-size="19" fill="${t.ink}">${esc(x.gapNote)}</text>`;
  body += `<g class="cur" style="--w:${x1 - x0 - 6}px"><rect x="${x0}" y="${ty - 96}" width="3" height="114" fill="${t.ink}" opacity=".85"/></g>`;
  body += `<rect x="${x0}" y="${ty + 70}" width="16" height="16" fill="${t.acc}"/><text x="${x0 + 26}" y="${ty + 84}" font-size="17" class="m" fill="${t.ink2}">${esc(x.observedLbl)}</text>`;
  // replay
  body += `<text x="60" y="290" font-size="30" font-weight="800" fill="${t.ink}">${esc(x.sameTitle)}</text>`;
  body += box(t, 60, 325, 330, 100);
  body += `<text x="225" y="383" text-anchor="middle" font-size="20" fill="${t.ink}">${esc(x.inputs)}</text>`;
  const row = (yy, label) =>
    `<path d="M392 375L470 ${yy + 24}" stroke="${t.ink2}" stroke-width="3" fill="none"/>` +
    box(t, 470, yy, 250, 48, t.bg) + `<text x="595" y="${yy + 32}" text-anchor="middle" font-size="20" class="m" fill="${t.ink}">${esc(label)}</text>` +
    `<path d="M722 ${yy + 24}H800" stroke="${t.ink2}" stroke-width="3" fill="none"/><path d="M790 ${yy + 15}l12 9 -12 9" stroke="${t.ink2}" stroke-width="3" fill="none"/>` +
    box(t, 810, yy, 300, 48, t.acc) + `<text x="960" y="${yy + 32}" text-anchor="middle" font-size="20" class="m" font-weight="700" fill="${t.accInk}">9c1e07…b7a2</text>`;
  body += row(322, x.run1) + row(382, x.run2);
  body += `<path d="M1126 346v60" stroke="${t.ink2}" stroke-width="3" fill="none"/><g class="eq"><text x="1160" y="388" font-size="44" font-weight="800" fill="${t.accText}">=</text></g>`;
  body += `<text x="1176" y="426" font-size="15" class="m" fill="${t.ink2}" text-anchor="start">${esc(x.same)}</text>`;
  body += `<text x="960" y="450" text-anchor="middle" font-size="14" class="m" fill="${t.ink2}">(${esc(x.example)})</text>`;
  return doc(W, H, t, "", body, `${x.gapsTitle}. ${x.sameTitle}`);
}


/* ---------- 5. call for help ---------- */
function help(t, x) {
  const W = 1280, H = 430, ny = 190, xs = [740, 940, 1140];
  let body = "";
  body += `<g class="fade"><text x="60" y="130" font-size="60" font-weight="800" fill="${t.ink}" letter-spacing="-1">${esc(x.h1)}</text><text x="60" y="200" font-size="60" font-weight="800" fill="${t.accText}" letter-spacing="-1">${esc(x.h2)}</text></g>`;
  body += `<text x="62" y="252" font-size="23" fill="${t.ink}">${esc(x.sub1)}</text><text x="62" y="284" font-size="23" fill="${t.ink2}">${esc(x.sub2)}</text>`;
  body += `<text x="56" y="396" font-size="112" font-weight="700" class="m" fill="${t.accText}">0</text><text x="150" y="388" font-size="24" fill="${t.ink}">${esc(x.count)}</text>`;
  // path between the three nodes
  body += `<path d="M${xs[0] + 52} ${ny}H${xs[1] - 52}M${xs[1] + 52} ${ny}H${xs[2] - 52}" stroke="${t.ink2}" stroke-width="4" stroke-dasharray="3 10" stroke-linecap="round" fill="none"/>`;
  body += `<g class="trav"><circle cx="${xs[0] + 20}" cy="${ny}" r="9" fill="${t.acc}" stroke="${t.line}" stroke-width="2"/></g>`;
  // node 1: the failure
  body += `<circle class="ping" cx="${xs[0]}" cy="${ny}" r="46" fill="none" stroke="${t.danger}" stroke-width="4"/>`;
  body += `<circle class="ping" style="animation-delay:1.3s" cx="${xs[0]}" cy="${ny}" r="46" fill="none" stroke="${t.danger}" stroke-width="4"/>`;
  const node = (cx, fill) => (t.shadow ? `<circle cx="${cx + 5}" cy="${ny + 5}" r="46" fill="${t.shadow}"/>` : "") + `<circle cx="${cx}" cy="${ny}" r="46" fill="${fill}" stroke="${t.line}" stroke-width="${t.sw + 1}"/>`;
  body += node(xs[0], t.panel) + `<path d="M${xs[0]} ${ny - 22}v26" stroke="${t.danger}" stroke-width="7" stroke-linecap="round"/><circle cx="${xs[0]}" cy="${ny + 22}" r="4.5" fill="${t.danger}"/>`;
  // node 2: the report (an envelope)
  body += node(xs[1], t.acc) + `<rect x="${xs[1] - 24}" y="${ny - 16}" width="48" height="34" fill="none" stroke="${t.accInk}" stroke-width="4" stroke-linejoin="round"/><path d="M${xs[1] - 24} ${ny - 14}l24 18 24 -18" fill="none" stroke="${t.accInk}" stroke-width="4" stroke-linejoin="round"/>`;
  // node 3: the rules, tested
  body += node(xs[2], t.panel) + `<path d="M${xs[2] - 20} ${ny + 2}l14 14 28 -32" fill="none" stroke="${t.accText}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  [[xs[0], x.n1], [xs[1], x.n2], [xs[2], x.n3]].forEach(([cx, l]) => (body += `<text x="${cx}" y="${ny + 106}" text-anchor="middle" font-size="19" font-weight="600" fill="${t.ink}">${esc(l)}</text>`));
  return doc(W, H, t, "", body, `${x.h1} ${x.h2} ${x.sub1} ${x.sub2}`);
}

function button(t, label, kind) {
  const W = 330, H = 76, primary = kind === "report";
  const fill = primary ? t.acc : t.bg, ink = primary ? t.accInk : t.ink;
  const cut = !t.shadow;
  const shape = cut
    ? `<path d="M16 3H${W - 3}V${H - 19}L${W - 19} ${H - 3}H3V19z" fill="${fill}" stroke="${primary ? t.acc : t.acc}" stroke-width="2"/>`
    : (t.shadow ? `<rect x="9" y="9" width="${W - 12}" height="${H - 12}" fill="${t.shadow}"/>` : "") + `<rect x="3" y="3" width="${W - 12}" height="${H - 12}" fill="${fill}" stroke="${t.line}" stroke-width="2.5"/>`;
  const tx = cut ? 34 : 30, ax = cut ? W - 54 : W - 62, k = primary || t.shadow ? ink : t.accText;
  const body = `${shape}<text x="${tx}" y="${H / 2 + 8}" font-size="23" font-weight="800" fill="${k}">${esc(label)}</text><path d="M${ax} ${H / 2}h26m-9 -9 9 9 -9 9" stroke="${k}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><style>text{font-family:${D}}</style>${body}</svg>
`;
}

for (const lang of ["en", "fr"]) {
  const suffix = lang === "fr" ? ".fr" : "";
  for (const [name, t] of Object.entries(THEMES)) {
    const x = TXT[lang];
    writeFileSync(`${OUT}banner-${name}${suffix}.svg`, await banner(t, x));
    writeFileSync(`${OUT}questions-${name}${suffix}.svg`, questions(t, x));
    writeFileSync(`${OUT}readonly-${name}${suffix}.svg`, readonly(t, x));
    writeFileSync(`${OUT}replay-${name}${suffix}.svg`, replay(t, x));
    writeFileSync(`${OUT}help-${name}${suffix}.svg`, help(t, x));
    writeFileSync(`${OUT}button-report-${name}${suffix}.svg`, button(t, x.bReport, "report"));
    writeFileSync(`${OUT}button-forum-${name}${suffix}.svg`, button(t, x.bForum, "forum"));
    writeFileSync(`${OUT}button-discord-${name}${suffix}.svg`, button(t, x.bDiscord, "discord"));
  }
}
console.log("README SVGs written to docs/media/readme/");
