import { Wifi } from "lucide-react";
import type { LiveConnectivity } from "../api";
import { usePrefs } from "../lib/prefs";
import { Chip, Panel } from "./ui";

/** Above this, an answer counts as slow for the advice line. U1 Doctor display threshold, not an official value. */
export const SLOW_MS = 1000;

const ms = (v: number | null, lang: string) => (v == null ? "—" : `${lang === "fr" ? String(v).replace(".", ",") : v} ms`);

/** Connectivity self-check of one live capture (BACKLOG #59). Advice lines appear only for what was observed. */
export function LiveNet({ net }: { net: LiveConnectivity }) {
  const { t, lang } = usePrefs();
  const n = t.net;
  const slow = (net.max_ms ?? 0) > SLOW_MS;
  const advice = [net.ip_changed === true && n.adviceIp, slow && n.adviceSlow, net.ws_drops > 0 && n.adviceDrop].filter((x): x is string => !!x);
  const ip = net.ip_changed === true ? n.ipChanged : net.ip_changed === false ? n.ipSame : n.ipFirst;
  return (
    <Panel title={n.title} icon={<Wifi size={17} />} i={1} demo={false} label="live-net">
      <div className="mb-2 flex flex-wrap gap-2"><Chip tone="neutral">{n.untested}</Chip></div>
      <p className="text-sm text-ink2">{n.sub}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink3">{n.median}</dt><dd className="mono">{ms(net.median_ms, lang)}</dd>
        <dt className="text-ink3">{n.max}</dt><dd className="mono">{ms(net.max_ms, lang)}</dd>
        <dt className="text-ink3">{n.drops}</dt><dd className="mono">{net.ws_drops}</dd>
        <dt className="text-ink3">{n.reconnects}</dt><dd className="mono">{net.ws_reconnects}</dd>
        <dt className="text-ink3">{n.frames}</dt><dd className="mono">{net.ws_frames_received}</dd>
        <dt className="text-ink3">{n.ip}</dt><dd><Chip tone={net.ip_changed === true ? "warn" : "neutral"}>{ip}</Chip></dd>
      </dl>
      <p className="mt-1 text-xs text-ink3">{n.reconnectsNote} {n.ipNote}</p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer text-ink2">{n.requests}</summary>
        <table className="mt-1 w-full text-left text-xs"><caption className="sr-only">{n.requests}</caption><tbody>
          {net.requests.map((r, k) => (<tr key={k} className="border-t border-line first:border-0"><td className="mono py-1 pr-3">{r.op ?? "—"}</td><td className="mono">{ms(r.ms, lang)}</td><td className="mono">{r.status ?? "—"}</td></tr>))}
        </tbody></table>
      </details>
      <h3 className="mt-3 text-sm font-bold">{n.adviceTitle}</h3>
      <ul className="mt-1 grid gap-1 text-sm">{(advice.length ? advice : [n.adviceNone]).map((a) => <li key={a}>{a}</li>)}</ul>
      <p className="mt-2 text-xs text-ink3">{n.scope}</p>
    </Panel>
  );
}
