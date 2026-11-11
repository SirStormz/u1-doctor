// Offline decoder demo: the catalog is the app's own (413 official codes, paraphrased, each with its wiki link).
// It loads on first use and runs entirely in the page. An unknown code is INCONCLUSIVE, never a guess.
import { t } from "./i18n.js";

const SAMPLES = ["0001-0523-0000-0037", "0002-0525-0002-0051", "0003-0530-0000-0002"];
let rows = null;
let byCode = null;

async function load() {
  if (rows) return;
  const mod = await import("./data/codes.json");
  rows = mod.default.rows;
  byCode = new Map(rows.map((r) => [r[0], r]));
}

const fmt = (digits) => digits.replace(/(\d{4})(?=\d)/g, "$1-");

export function initDecoder() {
  const input = document.getElementById("code"), out = document.getElementById("dec-out"), tryEl = document.getElementById("dec-try");
  if (!input || !out) return;

  const p = (cls, text) => { const el = document.createElement("p"); if (cls) el.className = cls; el.textContent = text; return el; };

  const show = (row) => {
    const [code, title, summary, head, url] = row;
    const nodes = [p("t", title), p("s", summary)];
    if (head) nodes.push(p("s", `${t("dec.head", "Toolhead")} ${head}`));
    const link = document.createElement("a");
    link.href = url; link.rel = "noopener"; link.textContent = t("dec.src", "Official wiki page");
    const l = document.createElement("p"); l.append(link);
    nodes.push(l, p("s mono", code), p("s", t("dec.en", "Catalog texts are in English.")));
    out.replaceChildren(...nodes);
  };

  const run = async () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 16);
    if (digits.length < 8) { out.replaceChildren(p("none", t("dec.idle", "Enter a code such as 0001-0523-0000-0037, or try one of these."))); return; }
    await load();
    if (digits.length === 16) {
      const hit = byCode.get(fmt(digits));
      if (hit) show(hit); else out.replaceChildren(p("none", t("dec.none", "This code is not in the catalog. U1 Doctor does not guess: result INCONCLUSIVE.")));
      return;
    }
    const prefix = fmt(digits);
    const near = rows.filter((r) => r[0].startsWith(prefix)).slice(0, 4);
    if (!near.length) { out.replaceChildren(p("none", t("dec.none", "This code is not in the catalog. U1 Doctor does not guess: result INCONCLUSIVE."))); return; }
    const box = document.createElement("div"); box.className = "tryit";
    for (const r of near) { const b = document.createElement("button"); b.type = "button"; b.textContent = r[0]; b.addEventListener("click", () => { input.value = r[0]; run(); }); box.append(b); }
    out.replaceChildren(box);
  };

  input.addEventListener("input", run);
  input.addEventListener("focus", () => { load(); }, { once: true });
  for (const c of SAMPLES) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = c;
    b.addEventListener("click", () => { input.value = c; run(); });
    tryEl?.append(b);
  }
}
