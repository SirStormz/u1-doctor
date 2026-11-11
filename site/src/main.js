// Fonts ship with the site (no request to any font host). The browser only downloads the ones a theme actually draws.
import "@fontsource-variable/oxanium";
import "@fontsource-variable/saira";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/doto";
import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "@fontsource/barlow-semi-condensed/800.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "./css/base.css";
import "./css/theme-a.css";
import "./css/theme-b.css";
import changelog from "./data/changelog.json";
import { applyLang, getLang } from "./i18n.js";

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } },
};

/* ---------- theme: A by default, one button for B ---------- */
const themeBtn = document.getElementById("theme");
// the visible word "Theme" is the accessible name; aria-pressed says whether the light theme B is on
const syncThemeBtn = () => themeBtn?.setAttribute("aria-pressed", String(root.dataset.theme === "b"));
syncThemeBtn();
themeBtn?.addEventListener("click", () => {
  const next = root.dataset.theme === "a" ? "b" : "a";
  const swap = () => {
    root.dataset.theme = next;
    store.set("u1d-theme", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "a" ? "#08070a" : "#ffffff");
    syncThemeBtn();
    document.dispatchEvent(new CustomEvent("u1d:theme", { detail: next }));
  };
  if (document.startViewTransition && !reduce) document.startViewTransition(swap); else swap();
});

/* ---------- language ---------- */
applyLang(root.lang === "fr" ? "fr" : "en");
document.getElementById("lang")?.addEventListener("click", () => applyLang(getLang() === "fr" ? "en" : "fr"));

/* ---------- mobile menu, current page ---------- */
const menu = document.getElementById("menu"), links = document.getElementById("links");
menu?.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  menu.setAttribute("aria-expanded", String(open));
});
links?.addEventListener("click", (e) => { if (e.target.closest("a")) { links.classList.remove("open"); menu?.setAttribute("aria-expanded", "false"); } });
for (const a of links?.querySelectorAll("a") ?? []) {
  const p = new URL(a.href).pathname;
  if (p !== "/u1-doctor/" && location.pathname.startsWith(p)) a.setAttribute("aria-current", "page");
}

/* ---------- scroll reveal (hierarchy: content arrives as you reach it) ---------- */
if (!reduce && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  document.querySelectorAll(".rv").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll(".rv").forEach((el) => el.classList.add("in"));
}

/* ---------- changelog (home teaser and full page) ---------- */
const renderTimeline = (ol, items, level = "h3") => {
  const fmt = new Intl.DateTimeFormat(getLang() === "fr" ? "fr-CH" : "en-GB", { year: "numeric", month: "short", day: "numeric" });
  ol.replaceChildren(...items.map((r) => {
    const li = document.createElement("li"), loc = r[getLang()] ?? r.en;
    const v = document.createElement("div"), s = document.createElement("small"), h = document.createElement(level), p = document.createElement("p");
    v.className = "ver"; v.textContent = r.v; s.textContent = fmt.format(new Date(r.date)); v.append(s);
    h.textContent = loc.title; p.textContent = loc.body;
    li.append(v, h, p);
    return li;
  }));
};
const tlHome = document.getElementById("tl-home"), tlFull = document.getElementById("tl-full");
const drawTimelines = () => { if (tlHome) renderTimeline(tlHome, changelog.slice(0, 3)); if (tlFull) renderTimeline(tlFull, changelog, "h2"); };
drawTimelines();
document.addEventListener("u1d:lang", drawTimelines);

/* ---------- heavy parts load only when they are close to view ---------- */
const lazy = (el, load) => {
  if (!el) return;
  if (!("IntersectionObserver" in window)) { load(); return; }
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: "400px 0px" });
  io.observe(el);
};
lazy(document.getElementById("decoder"), () => import("./decoder.js").then((m) => m.initDecoder()));
lazy(document.getElementById("story"), () => import("./stage.js").then((m) => m.initStage({ reduce })));
