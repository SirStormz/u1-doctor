import { flushSync } from "react-dom";

/** Applies a theme change behind a 250 ms cross-fade (View Transitions, WebView2/Chromium), or at once without it. */
export function withThemeFade(change: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof doc.startViewTransition !== "function" || reduce) { change(); return; }
  doc.startViewTransition(() => flushSync(change));
}
