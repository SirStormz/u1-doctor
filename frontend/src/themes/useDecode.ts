import { useEffect, useState } from "react";

const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#/<>";

/**
 * Visière signature: a title that deciphers itself (about 0.6 s). Only the visible copy changes; the heading keeps its
 * real text as its accessible name. Off without matchMedia, under reduced motion, or when `on` is false.
 */
export function useDecode(text: string, on: boolean): string {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const calm = typeof matchMedia !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!on || calm) { setShown(text); return; }
    let frame = 0;
    const steps = 18;
    const id = window.setInterval(() => {
      frame++;
      const fixed = Math.floor((frame / steps) * text.length);
      setShown(text.split("").map((c, i) => (i < fixed || c === " " ? c : GLYPHS[(i * 7 + frame * 3) % GLYPHS.length])).join(""));
      if (frame >= steps) { window.clearInterval(id); setShown(text); }
    }, 34);
    return () => window.clearInterval(id);
  }, [text, on]);
  return shown;
}
