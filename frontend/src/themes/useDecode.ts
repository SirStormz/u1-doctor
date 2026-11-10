import { useEffect, useState } from "react";

const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#/<>";
const DURATION = 600;
const calm = () => typeof matchMedia !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const scramble = (text: string, done: number, tick: number) =>
  text.split("").map((c, i) => (i < done || c === " " ? c : GLYPHS[(i * 7 + tick * 3) % GLYPHS.length])).join("");

/**
 * Visière signature: a title that deciphers itself in 0.6 s of wall-clock time (a busy page only drops steps).
 * Only the visible copy changes; the heading keeps its real text as its accessible name.
 * Off without matchMedia, under reduced motion, or when `on` is false.
 */
export function useDecode(text: string, on: boolean): string {
  const [shown, setShown] = useState(() => (on && !calm() ? scramble(text, 0, 0) : text));
  useEffect(() => {
    if (!on || calm()) { setShown(text); return; }
    const start = performance.now();
    let tick = 0;
    const id = window.setInterval(() => {
      const k = (performance.now() - start) / DURATION;
      if (k >= 1) { window.clearInterval(id); setShown(text); return; }
      setShown(scramble(text, Math.floor(k * text.length), ++tick));
    }, 34);
    return () => window.clearInterval(id);
  }, [text, on]);
  return shown;
}
