import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { api2, type RealCapture } from "../api";
import { Chip, Panel, ProvenanceChip, StateBlock } from "../components/ui";
import { hhmmss, tms, val } from "../lib/data";
import { tok, tx } from "../lib/dyn";
import { usePrefs } from "../lib/prefs";

/** Real capture from field test H-02: facts only, nothing invented. Never mixed with the synthetic demo. */
export function RealCapturePanel() {
  const { t, lang } = usePrefs();
  const R = t.real;
  const [cap, setCap] = useState<RealCapture | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api2.realCapture("h02_normal_print").then(setCap).catch(() => setErr(true)); }, []);

  if (err) return <Panel title={R.title} icon={<Radio size={17} />} demo={false} i={5}><StateBlock kind="unavailable" title={R.unavailable} /></Panel>;
  if (!cap) return <Panel title={R.title} icon={<Radio size={17} />} demo={false} i={5}><StateBlock kind="loading" title={R.loading} /></Panel>;

  const p = cap.provenance;
  const states = cap.observations.filter((o) => o.event_type === "state_transition");
  const codes = cap.observations.filter((o) => o.event_type === "machine_action_code");
  const st = (s: unknown) => (s === "printing" ? R.printing : s === "complete" ? R.complete : String(s));
  const mins = Math.floor(p.duration_s / 60);
  const secs = Math.round(p.duration_s % 60);
  const facts: [string, string][] = [
    [R.when, p.date_utc.replace("T", " ").replace("Z", "")],
    [R.dur, `${mins} ${R.min} ${secs} ${R.s}`],
    [R.frames, p.inbound_frames.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB")],
    [R.gap, `${p.max_gap_between_frames_s.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB")} ${R.s}`],
    [R.sent, p.outbound_non_subscribe === 0 && p.outbound_frames === 1 ? R.sentVal : String(p.outbound_frames)],
  ];
  return (
    <Panel title={R.title} icon={<Radio size={17} />} demo={false} i={5} actions={<ProvenanceChip status="REAL" />}>
      <p className="text-ink2">{R.note}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-y-2 border-ink py-3 sm:grid-cols-3 min-[1500px]:grid-cols-5">
        {facts.map(([k, v]) => (<div key={k}><dt className="micro">{k}</dt><dd className="m-0 text-[15px] font-extrabold">{v}</dd></div>))}
      </dl>
      <div className="mt-4 grid gap-d lg:grid-cols-2">
        <div>
          <h3 className="micro mb-2">{R.states}</h3>
          <ol className="grid gap-2">
            {states.map((o) => (<li key={o.observation_id} className="flex items-center gap-3 border border-line bg-surface2 px-3 py-2"><span className="mono text-xs text-ink3">{hhmmss(tms(o))} UTC</span><Chip tone={String(val(o).state) === "complete" ? "ok" : "accent"}>{st(val(o).state)}</Chip></li>))}
          </ol>
          <div className="mt-4"><h3 className="micro mb-2">{R.codes}</h3></div>
          <p className="flex flex-wrap gap-2">{codes.map((o) => (<span key={o.observation_id} className="chip mono" title={`${hhmmss(tms(o))} UTC`}>{String(val(o).action_code)}</span>))}</p>
          <p className="mt-2 text-xs text-ink3">{R.codesNote}</p>
        </div>
        <div>
          <h3 className="micro mb-2">{R.findings}</h3>
          <ul className="grid gap-2">
            {cap.findings.map((f) => (<li key={f.finding_id} className="border border-line bg-surface2 px-3 py-2"><div className="mb-1 flex flex-wrap gap-2"><Chip tone="warn">{tok(lang, "classification", f.classification)}</Chip><span className="mono text-xs text-ink3">{f.rule_id}</span></div><p className="font-bold">{tx(lang, f.human_title)}</p></li>))}
          </ul>
          <p className="mt-2 text-sm text-ink2">{R.noFault}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2"><Chip tone={cap.matches_golden ? "ok" : "danger"}>{cap.matches_golden ? R.replaySame : R.replayDiff}</Chip><span className="mono text-xs text-ink3">{cap.findings_sha256.slice(0, 16)}…</span></p>
        </div>
      </div>
    </Panel>
  );
}
