import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, api2, type Compat, type Finding, type Health, type InterpretOut, type Observation, type ReplayOut } from "../api";

export const DEMO_SCENARIO = "demo_extrusion_blockage";

export interface IncidentData {
  status: "loading" | "ready" | "error";
  error?: string;
  obs: Observation[];
  findings: Finding[];
  replay: ReplayOut | null;
  decoding: InterpretOut | null;
  code: string | null;
  compat: Compat | null;
  health: Health | null;
  reload: () => void;
}

const empty: IncidentData = { status: "loading", obs: [], findings: [], replay: null, decoding: null, code: null, compat: null, health: null, reload: () => {} };
const Ctx = createContext<IncidentData>(empty);

export function IncidentProvider({ children }: { children: ReactNode }) {
  const [n, setN] = useState(0);
  const [state, setState] = useState<Omit<IncidentData, "reload">>(empty);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: "loading", error: undefined }));
    (async () => {
      try {
        const [sc, rp, compat, health] = await Promise.all([api.scenario(DEMO_SCENARIO), api.replay(DEMO_SCENARIO), api2.compatibility(), api2.health()]);
        const codeObs = sc.observations.find((o) => o.event_type === "user_reported_error_code");
        const code = codeObs && typeof codeObs.value === "object" && codeObs.value && "code" in codeObs.value ? String((codeObs.value as { code: unknown }).code) : null;
        const decoding = code ? await api.interpret(code) : null;
        if (live) setState({ status: "ready", obs: sc.observations, findings: rp.findings, replay: rp, decoding, code, compat, health });
      } catch (e) {
        if (live) setState({ ...empty, status: "error", error: String(e) });
      }
    })();
    return () => { live = false; };
  }, [n]);
  return <Ctx.Provider value={{ ...state, reload: () => setN((x) => x + 1) }}>{children}</Ctx.Provider>;
}

export const useIncident = () => useContext(Ctx);

/** helpers over observations */
export const val = (o: Observation) => (o.value ?? {}) as Record<string, unknown>;
export const tms = (o: Observation) => Date.parse(o.capture_utc);
export const hhmmss = (ms: number) => new Date(ms).toISOString().slice(11, 19);
