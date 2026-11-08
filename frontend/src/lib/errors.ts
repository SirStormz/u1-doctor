import type { Messages } from "./i18n";

/** Turns a failed request into a translated sentence: the backend's own (English) text is never shown. */
export function errText(t: Messages, e: unknown, fallback?: string): string {
  if (e instanceof TypeError || (e instanceof Error && /^HTTP (0|5\d\d)$/.test(e.message))) return t.backendDown; // fetch failed or server error: the local service is down
  const code = e && typeof e === "object" && "code" in e && typeof e.code === "string" ? e.code : undefined;
  if (code && code !== "UNKNOWN" && t.apiErr[code]) return t.apiErr[code];
  return fallback ?? t.apiErr.UNKNOWN!;
}
