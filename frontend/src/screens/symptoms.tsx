import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, Play } from "lucide-react";
import { historyApi, symptomsApi, SymptomRefused, type HistoryList, type SymptomCatalog, type SymptomCause, type SymptomEvidence, type SymptomResult } from "../api";
import { Button, Chip, Panel, TechDetails } from "../components/ui";
import { PageTitle } from "../components/shell";
import { usePrefs } from "../lib/prefs";
import { errText } from "../lib/errors";

const TEMP_FIELDS = ["bed_temp", "nozzle_temp"];
const DIR_TONE = { for: "warn", against: "neutral", unclear: "neutral", info: "replay" } as const;

/** "Needs your eyes": print-quality causes from the official wiki, in its order. Evidence only where a number can be compared. */
export function Symptoms() {
  const { t, lang } = usePrefs();
  const [cat, setCat] = useState<SymptomCatalog | null>(null);
  const [fail, setFail] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [session, setSession] = useState("");
  const [hist, setHist] = useState<HistoryList | null>(null);
  const [res, setRes] = useState<SymptomResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { let live = true; symptomsApi.catalog().then((c) => { if (live && Array.isArray(c?.symptoms)) setCat(c); else if (live) setFail(true); }).catch(() => { if (live) setFail(true); }); return () => { live = false; }; }, []);
  useEffect(() => { historyApi.list().then(setHist).catch(() => setHist(null)); }, []);

  const sym = useMemo(() => cat?.symptoms.find((s) => s.id === sel) ?? null, [cat, sel]);

  async function run(id: string, v: Record<string, string>, s: string) {
    setErr(null);
    const answers: Record<string, string | number> = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === "") continue;
      answers[k] = cat && k in cat.fields.numeric ? Number(x) : x;
    }
    try { setRes(await symptomsApi.evaluate(id, answers, s || undefined)); }
    catch (e) { setRes(null); setErr(e instanceof SymptomRefused ? refusal(e) : errText(t, e, t.sy.failLoad)); }
  }
  // the backend reason is English: only the field it names and the accepted range are reused, the sentence is ours
  function refusal(e: SymptomRefused) {
    const label = (t.sy.f as Record<string, string>)[/^(\w+) /.exec(e.detail)?.[1] ?? ""];
    const r = /is outside (-?[\d.]+) to (-?[\d.]+)$/.exec(e.detail);
    const why = r ? t.sy.range.replace("{lo}", r[1]!).replace("{hi}", r[2]!) : errText(t, e);
    return `${t.sy.failRun} ${label ? `${label} — ${why}` : why}`;
  }
  function choose(id: string) { setSel(id); setVals({}); setSession(""); setRes(null); void run(id, {}, ""); }

  const field = (k: string) => {
    const label = (t.sy.f as Record<string, string>)[k] ?? k;
    const id = `sy-${k}`;
    const opts = (t.sy.opt as Record<string, string>);
    let input;
    if (k === "material") input = (
      <select id={id} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="rounded-lg border border-control bg-surface2 px-2 py-1.5 text-ink">
        <option value="">{opts[""]}</option>{cat && Object.keys(cat.materials).map((m) => <option key={m} value={m}>{m}</option>)}
      </select>);
    else if (cat && k in cat.fields.choices) input = (
      <select id={id} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="rounded-lg border border-control bg-surface2 px-2 py-1.5 text-ink">
        <option value="">{opts[""]}</option>{cat.fields.choices[k]!.map((o) => <option key={o} value={o}>{opts[o] ?? o}</option>)}
      </select>);
    else input = <input id={id} inputMode={k === "firmware" ? "text" : "decimal"} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} maxLength={12} autoComplete="off" placeholder={k === "firmware" ? "1.5.2" : ""} className="mono rounded-lg border border-control bg-surface2 px-2 py-1.5 text-ink" />;
    return <div key={k} className="grid gap-1"><label htmlFor={id} className="micro">{label}</label>{input}</div>;
  };

  const needsSession = !!sym && sym.ask.some((k) => TEMP_FIELDS.includes(k));
  return (
    <>
      <PageTitle title={t.sy.title} sub={t.sy.note} icon={<Eye size={22} />} />
      {fail && <Panel demo={false} i={1}><p className="text-ink2" role="alert">{t.sy.failLoad}</p></Panel>}
      {cat && (
        <Panel title={t.sy.pick} icon={<Eye size={17} />} i={1} demo={false}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="symptom-list">
            {cat.symptoms.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => choose(s.id)} aria-pressed={sel === s.id} data-testid={`symptom-${s.id}`}
                  className="w-full rounded-lg border-2 p-3 text-left font-semibold transition-colors" style={{ borderColor: sel === s.id ? "var(--accent)" : "var(--control-line)" }}>
                  {s.title[lang]}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink3">{t.sy.checked.replace("{d}", cat.checked_at)}</p>
        </Panel>
      )}
      {sym && (
        <div className="mt-4">
          <Panel title={sym.title[lang]} icon={<Eye size={17} />} i={2} demo={false}>
            <p className="micro">{t.sy.look}</p>
            <p className="mt-1 text-ink2" data-testid="symptom-eyes">{sym.eyes[lang]}</p>
            <h3 className="micro mt-4">{t.sy.ask}</h3>
            {sym.ask.length === 0 ? <p className="mt-1 text-ink2">{t.sy.askNone}</p> : (
              <form className="mt-1" onSubmit={(e) => { e.preventDefault(); void run(sym.id, vals, session); }}>
                <p className="text-sm text-ink2">{t.sy.askNote}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sym.ask.map(field)}</div>
                {needsSession && (
                  <div className="mt-3 grid max-w-md gap-1">
                    <label htmlFor="sy-session" className="micro">{t.sy.session}</label>
                    <select id="sy-session" value={session} onChange={(e) => setSession(e.target.value)} className="rounded-lg border border-control bg-surface2 px-2 py-1.5 text-ink">
                      <option value="">{t.sy.sessionNone}</option>
                      {hist?.sessions.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.status_mix.join("/")}</option>)}
                    </select>
                    <p className="text-xs text-ink3">{t.sy.sessionNote}</p>
                  </div>
                )}
                <Button variant="primary" type="submit" icon={<Play size={15} aria-hidden />} className="mt-3">{t.sy.run}</Button>
              </form>
            )}
            {err && <p className="mt-3 text-danger" role="alert">{err}</p>}
          </Panel>
          {res && (
            <div className="mt-4"><Panel title={t.sy.causes} i={3} demo={false}>
              <ol className="grid gap-3" data-testid="symptom-causes">
                {res.causes.map((c, i) => <CauseCard key={c.id} c={c} n={i + 1} />)}
              </ol>
              <a href={res.symptom.url} target="_blank" rel="noreferrer noopener" className="btn btn-secondary mt-4 w-fit">{t.sy.open}<ExternalLink size={15} aria-hidden /></a>
              {/* method notes fold in Simple; the causes, their evidence and its provenance chip stay visible */}
              <TechDetails className="mt-4"><ul className="grid gap-1 text-xs text-ink3" data-testid="symptom-notes">{(t.sy.notes as readonly string[]).map((n) => <li key={n}>{n}</li>)}</ul></TechDetails>
            </Panel></div>
          )}
        </div>
      )}
    </>
  );
}

function CauseCard({ c, n }: { c: SymptomCause; n: number }) {
  const { t, lang } = usePrefs();
  const lean = c.lean === "NONE" ? null : c.lean;
  return (
    <li className="rounded-lg border-2 p-3" data-lean={c.lean} data-eyes={c.eyes} style={{ borderColor: lean === "FOR" || lean === "MIXED" ? "var(--warn)" : "var(--control-line)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-xs text-ink3">{String(n).padStart(2, "0")}</span>
        {c.eyes && <Chip tone="demo" icon={<Eye size={12} aria-hidden />}>{t.sy.eyes}</Chip>}
        {lean ? <Chip tone={lean === "FOR" ? "warn" : lean === "MIXED" ? "warn" : "neutral"}>{(t.sy.lean as Record<string, string>)[lean]}</Chip> : <Chip>{(t.sy.lean as Record<string, string>).NONE}</Chip>}
      </div>
      <p className="mt-2">{c.text[lang]}</p>
      {c.evidence.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {c.evidence.map((e: SymptomEvidence, k) => (
            <li key={k} className="flex flex-wrap items-center gap-2 text-sm text-ink2" data-dir={e.direction}>
              <Chip tone={DIR_TONE[e.direction]}>{(t.sy.dir as Record<string, string>)[e.direction]}</Chip>
              <span>{e.text[lang]}</span>
              <span className="mono text-xs text-ink3">{e.source}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
