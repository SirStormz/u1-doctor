import { useCallback, useEffect, useState } from "react";

export const ROUTES = ["welcome", "connect", "overview", "explorer", "symptoms", "timeline", "findings", "evidence", "replay", "report", "settings"] as const;
export type RouteName = (typeof ROUTES)[number];
/** Simple mode hides the two expert screens from the menu; they stay reachable by link ("Open", "See the evidence") and by direct URL. */
export const EXPERT_ONLY: readonly RouteName[] = ["evidence", "replay"];
export const visibleRoutes = (mode: "simple" | "expert"): readonly RouteName[] => (mode === "expert" ? ROUTES : ROUTES.filter((r) => !EXPERT_ONLY.includes(r)));
export interface Route { name: RouteName; param?: string }

export function parseHash(h: string): Route {
  const [, name, param] = h.replace(/^#/, "").split("/");
  return { name: (ROUTES as readonly string[]).includes(name ?? "") ? (name as RouteName) : "welcome", param: param ? decodeURIComponent(param) : undefined };
}

export function useRoute(): [Route, (name: RouteName, param?: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((name: RouteName, param?: string) => { location.hash = `#/${name}${param ? "/" + encodeURIComponent(param) : ""}`; }, []);
  return [route, go];
}

/** The cinematic landing lives at the bare URL (no hash, "#" or "#/"); every app screen has an explicit "#/name". */
export const isLandingHash = (h: string) => /^#?\/?(landing)?$/.test(h);
export function useLanding(): boolean {
  const [l, setL] = useState(() => isLandingHash(location.hash));
  useEffect(() => {
    const on = () => setL(isLandingHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return l;
}
