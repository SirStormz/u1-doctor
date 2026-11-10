import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Footprints } from "lucide-react";
import { Button, Chip, Panel } from "../components/ui";
import { useIncident } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { tx } from "../lib/dyn";
import { officialSteps } from "../lib/steps";
import { renderFor } from "../themes/renders";
import { MODEL_URL } from "../viz/u1model";
import { U1Viewer } from "../viz/U1Viewer";

/**
 * UI V2 guided Verdict (Simple mode, top of Findings): the official table's actions for the decoded code, one at a time; the 3D
 * camera goes to the part each step is about (the toolhead named by the code, or the touchscreen). Shows nothing without them.
 */
export function VerdictGuide() {
  const { t, lang, theme } = usePrefs();
  const inc = useIncident();
  const [i, setI] = useState(0);
  const entry = inc.demo ? inc.decoding?.decoding.entry : null;
  const head = entry?.toolhead && entry.toolhead >= 1 && entry.toolhead <= 4 ? entry.toolhead : null;
  const steps = officialSteps(entry?.actions, head);
  if (!entry || !steps.length) return null;
  const k = Math.min(i, steps.length - 1);
  const step = steps[k]!;
  const V = t.verdict, H = t.home;
  const label = (key: string) => t.actions[key as keyof typeof t.actions] ?? key;

  return (
    <Panel title={tx(lang, entry.title)} icon={<Footprints size={17} />} active className="mb-d" bodyClass="p-0"
      actions={head ? <Chip tone="accent">{H.head.replace("{n}", String(head))} · {H.headNote}</Chip> : undefined}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="pad grid content-start gap-3">
          <p className="micro" aria-live="polite">{V.stepOf.replace("{i}", String(k + 1)).replace("{n}", String(steps.length))} · {H.todoSub}</p>
          <ol className="home-steps grid gap-2" aria-label={V.steps}>
            {steps.map((x, n) => (
              <li key={x.key}>
                <button type="button" className="home-step w-full text-left" aria-current={n === k ? "step" : undefined} onClick={() => setI(n)}>
                  <span className="home-step-n" aria-hidden>{n + 1}</span><span className="min-w-0 flex-1">{label(x.key)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button icon={<ChevronLeft size={16} />} disabled={k === 0} onClick={() => setI(k - 1)}>{V.prev}</Button>
            <Button variant="primary" disabled={k === steps.length - 1} onClick={() => setI(k + 1)}>{V.next}<ChevronRight size={16} aria-hidden /></Button>
            {entry.article && <a className="btn btn-secondary ml-auto" href={entry.article.url} target="_blank" rel="noreferrer"><BookOpen size={15} aria-hidden />{H.official}</a>}
          </div>
          {entry.summary && <p className="text-sm text-ink2">{tx(lang, entry.summary)}</p>}
        </div>
        <div className="verdict-stage relative h-[460px] border-line max-lg:border-t lg:border-l">
          <U1Viewer className="h-full" look={theme} focus={step.focus} src={MODEL_URL} fallbackSrc={renderFor(theme, step.shot ?? "hero").src}
            hotspotLabel={(n) => `${t.toolhead} ${n} · ${t.unmapped}`}
            text={{ autoRotate: t.viewer.autoRotate, explode: t.viewer.explode, reset: t.viewer.reset, loading: t.viewer.loading, unavailable: t.viewer.unavailable, hint: t.viewer.hint, partNote: t.viewer.partNote, illustrative: t.viewer.illustrative }} />
        </div>
      </div>
    </Panel>
  );
}
