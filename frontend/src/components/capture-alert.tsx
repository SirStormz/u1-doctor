import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import type { Finding, Observation } from "../api";
import { usePrefs } from "../lib/prefs";
import { Button } from "./ui";

/** Prefix of the window title while an alert is waiting. */
export const TITLE_MARK = "(!) ";
const BAD_STATES = new Set(["error", "shutdown"]);

/** `due`: maintenance reminders that are due with the totals of this capture (BACKLOG #65); absent when none. */
export interface AlertCause { observed: number; events: number; due?: number }

const bad = (s: unknown) => typeof s === "string" && BAD_STATES.has(s.toLowerCase());

/** What deserves an alert in one result: OBSERVED findings and error/shutdown states not already alerted on this screen.
 * Pure: reads only the result the app already holds. `seen` collects the ids so the same finding never alerts twice. */
export function alertCause(findings: Finding[], obs: Observation[], states: (string | null | undefined)[], seen: Set<string>): AlertCause | null {
  const newF = findings.filter((f) => f.classification === "OBSERVED" && !seen.has(`f:${f.finding_id}`));
  const newO = obs.filter((o) => {
    const v = o.value as Record<string, unknown> | null;
    return !seen.has(`o:${o.observation_id}`) && !!v && typeof v === "object" && (bad(v.state) || bad(v.klippy_state));
  });
  const st = states.filter(bad).length;
  for (const f of newF) seen.add(`f:${f.finding_id}`);
  for (const o of newO) seen.add(`o:${o.observation_id}`);
  const events = newO.length + st;
  return newF.length || events ? { observed: newF.length, events } : null;
}

/** One-shot results only (a capture or a replay ends, then returns): the alert is raised on the result, not during it.
 * In-page only: a banner and a "(!) " title prefix, no Notification API, nothing sent. Cleared on dismiss, on "view",
 * when the screen is left, or when the Settings toggle is off. */
export function useCaptureAlert(targetId: string) {
  const { alerts } = usePrefs();
  const seen = useRef(new Set<string>());
  const [cause, setCause] = useState<AlertCause | null>(null);
  const active = alerts ? cause : null;
  const raise = useCallback((findings: Finding[], obs: Observation[], states: (string | null | undefined)[] = [], due = 0) => {
    const c = alertCause(findings, obs, states, seen.current);
    if (alerts) setCause(due > 0 ? { ...(c ?? { observed: 0, events: 0 }), due } : c);
  }, [alerts]);
  const clear = useCallback(() => setCause(null), []);
  const view = useCallback(() => {
    const el = document.getElementById(targetId);
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView?.({ block: "start", behavior: reduce ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
    setCause(null);
  }, [targetId]);
  useEffect(() => {
    if (!active) return;
    if (!document.title.startsWith(TITLE_MARK)) document.title = TITLE_MARK + document.title;
    return () => { if (document.title.startsWith(TITLE_MARK)) document.title = document.title.slice(TITLE_MARK.length); };
  }, [active]);
  return { cause: active, raise, clear, view };
}

/** The banner. No animation (reduced-motion safe by construction); role=alert so screen readers announce it once. */
export function CaptureAlert({ cause, kind, onView, onDismiss }: { cause: AlertCause | null; kind: "capture" | "replay"; onView: () => void; onDismiss: () => void }) {
  const { t } = usePrefs();
  if (!cause) return null;
  const a = t.al;
  const parts = [
    cause.observed > 0 && (cause.observed === 1 ? a.observedOne : a.observedMany.replace("{n}", String(cause.observed))),
    cause.events > 0 && (cause.events === 1 ? a.eventOne : a.eventMany.replace("{n}", String(cause.events))),
    !!cause.due && (cause.due === 1 ? a.dueOne : a.dueMany.replace("{n}", String(cause.due))),
  ].filter((x): x is string => !!x);
  return (
    <div role="alert" data-testid="capture-alert" className="mb-d flex gap-3 rounded-lg border-2 p-3" style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, var(--surface-1))" }}>
      <BellRing size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div className="grid gap-1.5">
        <strong>{kind === "capture" ? a.titleCapture : a.titleReplay}</strong>
        <p className="text-[15px]">{parts.join(" · ")}</p>
        <p className="text-xs text-ink3">{a.local}</p>
        <Button variant="primary" className="w-fit" onClick={onView}>{a.view}</Button>
      </div>
      <button type="button" onClick={onDismiss} aria-label={a.dismiss} title={a.dismiss} className="ml-auto h-fit shrink-0 text-ink3 hover:text-ink"><X size={16} aria-hidden /></button>
    </div>
  );
}
