import { useState } from "react";
import { ExternalLink, Wrench } from "lucide-react";
import { Button, Chip, Panel } from "./ui";
import { usePrefs } from "../lib/prefs";
import {
  MAX_TASKS, PRESETS, UNITS, loadCurrent, loadTasks, markDone, newId, saveTasks, taskStatus,
  type Amounts, type Current, type Task, type Unit, type UnitState,
} from "../lib/maintenance";

/** Maintenance reminders (BACKLOG #65, UNTESTED on a real U1): local tasks, numbers only, nothing sent. */
const TONE: Record<UnitState, "warn" | "ok" | "neutral"> = { due: "warn", not_due: "ok", not_observable: "neutral", no_baseline: "neutral", below_baseline: "neutral" };

function useFmt() {
  const { lang } = usePrefs();
  return (x: number) => x.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB", { maximumFractionDigits: 1 });
}

/** The totals of the last live capture, each with its provenance; "not observable" when the capture could not read it. */
function Totals({ cur }: { cur: Current | null }) {
  const { t } = usePrefs();
  const m = t.mt;
  const fmt = useFmt();
  if (!cur) return <p className="text-ink3" data-testid="mt-none">{m.none}</p>;
  const v = (x: number | null, unit = "") => (x === null ? <span className="text-ink3">{m.notObs}</span> : <span className="mono">{fmt(x)}{unit}</span>);
  return (
    <div data-testid="mt-totals">
      <div className="flex flex-wrap items-center gap-2"><span className="micro">{m.latest}</span><Chip tone="ok">REAL</Chip><span className="mono text-xs text-ink3">{m.readAt.replace("{t}", cur.captured_utc.replace("T", " ").replace("Z", "").slice(0, 16))}</span></div>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-ink3">{m.hours}</dt><dd>{v(cur.print_hours, " h")}</dd>
        <dt className="text-ink3">{m.jobs}</dt><dd>{v(cur.jobs)}</dd>
        <dt className="text-ink3">{m.changes}</dt><dd>{v(cur.tool_changes)}</dd>
        <dt className="text-ink3">{m.filament}</dt><dd>{v(cur.filament_m, " m")}</dd>
      </dl>
      <p className="mt-2 max-w-prose text-xs text-ink3">{m.historyNote}</p>
      <p className="mt-1 max-w-prose text-xs text-ink3">{m.changesNote}</p>
    </div>
  );
}

function TaskRow({ task, cur, onDone, onRemove }: { task: Task; cur: Current | null; onDone: () => void; onRemove: () => void }) {
  const { t, lang } = usePrefs();
  const m = t.mt;
  const fmt = useFmt();
  const st = taskStatus(task, cur);
  const preset = PRESETS.find((p) => p.id === task.preset);
  const label: Record<UnitState, string> = { due: m.due, not_due: m.notDue, not_observable: m.notObs, no_baseline: m.noBaseline, below_baseline: m.below };
  return (
    <li className="rounded-lg border-2 p-3" data-task={task.id} data-due={st.due} style={{ borderColor: st.due ? "var(--warn)" : "var(--control-line)" }}>
      <div className="flex flex-wrap items-center gap-2"><strong>{preset ? preset.name[lang] : task.name}</strong>{st.due && <Chip tone="warn">{m.due}</Chip>}</div>
      <ul className="mt-2 grid gap-1 text-sm">
        {st.units.map((u) => (
          <li key={u.unit} className="flex flex-wrap items-center gap-2" data-unit={u.unit} data-state={u.state}>
            <Chip tone={TONE[u.state]}>{label[u.state]}</Chip>
            <span>{m.units[u.unit]} · {m.every} <span className="mono">{fmt(u.every)}</span></span>
            {u.done !== null && u.left !== null && <span className="mono text-xs text-ink2">{(u.state === "due" ? m.lineDue : m.line).replace("{done}", fmt(u.done)).replace("{every}", fmt(u.every)).replace("{left}", fmt(u.left))}</span>}
          </li>
        ))}
      </ul>
      {preset && (
        <p className="mt-2 text-xs text-ink3">{preset.note[lang]} <a href={preset.source.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{m.source}{lang === "en" ? ` · ${preset.source.title}` : ""} · {m.checked.replace("{d}", preset.source.checked)}<ExternalLink size={12} aria-hidden /></a></p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!cur} onClick={onDone} title={m.markDoneHelp}>{m.markDone}</Button>
        <Button variant="ghost" onClick={onRemove}>{m.remove}</Button>
      </div>
    </li>
  );
}

const amount = (s: string): number | undefined => { const x = Number(s.replace(",", ".")); return s.trim() !== "" && Number.isFinite(x) && x >= 0 && x <= 1e9 ? x : undefined; };

/** The Settings panel: presets, the owner's own tasks, the totals of the last capture. */
export function MaintenancePanel({ i }: { i: number }) {
  const { t, lang } = usePrefs();
  const m = t.mt;
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [cur] = useState<Current | null>(() => loadCurrent());
  const [name, setName] = useState("");
  const [every, setEvery] = useState<Record<Unit, string>>({ print_hours: "", jobs: "", tool_changes: "" });
  const [base, setBase] = useState<Record<Unit, string>>({ print_hours: "", jobs: "", tool_changes: "" });
  const [bad, setBad] = useState(false);
  const update = (next: Task[]) => { setTasks(next); saveTasks(next); };
  const full = tasks.length >= MAX_TASKS;

  function addPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    if (full || tasks.some((x) => x.preset === id)) return;
    update([...tasks, { id: newId(tasks, p.id), name: p.name.en, preset: p.id, every: { ...p.every }, baseline: {} }]);
  }
  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const ev: Amounts = {}, bl: Amounts = {};
    for (const u of UNITS) { const a = amount(every[u]); if (a) ev[u] = a; const b = amount(base[u]); if (b !== undefined) bl[u] = b; }
    const n = name.trim().slice(0, 80);
    if (!n || !Object.keys(ev).length || full) { setBad(true); return; }
    setBad(false);
    update([...tasks, { id: newId(tasks, n), name: n, preset: null, every: ev, baseline: bl }]);
    setName(""); setEvery({ print_hours: "", jobs: "", tool_changes: "" }); setBase({ print_hours: "", jobs: "", tool_changes: "" });
  }

  return (
    <Panel title={m.title} icon={<Wrench size={17} />} i={i} demo={false} actions={<Chip tone="neutral">{m.untested}</Chip>}>
      <div data-testid="maintenance">
        <p className="max-w-prose text-ink2">{m.sub}</p>
        <div className="mt-4"><Totals cur={cur} /></div>

        <h3 className="micro mt-5 mb-2">{m.list}</h3>
        {tasks.length === 0 ? <p className="text-ink3">{m.empty}</p> : (
          <ul className="grid gap-2" aria-label={m.list}>
            {tasks.map((x) => <TaskRow key={x.id} task={x} cur={cur} onDone={() => cur && update(tasks.map((y) => (y.id === x.id ? markDone(y, cur) : y)))} onRemove={() => update(tasks.filter((y) => y.id !== x.id))} />)}
          </ul>
        )}
        {full && <p className="mt-2 text-sm text-warn">{m.full}</p>}

        <h3 className="micro mt-5 mb-2">{m.presets}</h3>
        <ul className="grid gap-2">
          {PRESETS.map((p) => {
            const has = tasks.some((x) => x.preset === p.id);
            return (
              <li key={p.id} data-preset={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{p.name[lang]}</strong>
                <span className="text-ink3">{UNITS.filter((u) => p.every[u]).map((u) => `${m.every} ${p.every[u]!.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB")} ${m.units[u]}`).join(" · ")}</span>
                <a href={p.source.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs underline">{m.source} · {m.checked.replace("{d}", p.source.checked)}<ExternalLink size={12} aria-hidden /></a>
                <Button variant="secondary" disabled={has || full} onClick={() => addPreset(p.id)}>{has ? m.added : m.addPreset}</Button>
              </li>
            );
          })}
        </ul>

        <h3 className="micro mt-5 mb-2">{m.custom}</h3>
        <form onSubmit={addCustom} className="grid gap-3" aria-label={m.custom}>
          <label className="grid gap-1 text-sm">{m.name}<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" /></label>
          <fieldset><legend className="text-sm">{m.every}</legend>
            <div className="mt-1 flex flex-wrap gap-3">{UNITS.map((u) => (
              <label key={u} className="grid gap-1 text-xs">{m.units[u]}<input inputMode="decimal" value={every[u]} onChange={(e) => setEvery({ ...every, [u]: e.target.value })} className="mono w-32 rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" data-every={u} /></label>
            ))}</div>
          </fieldset>
          <fieldset><legend className="text-sm">{m.baseline}</legend>
            <div className="mt-1 flex flex-wrap gap-3">{UNITS.map((u) => (
              <label key={u} className="grid gap-1 text-xs">{m.units[u]}<input inputMode="decimal" value={base[u]} onChange={(e) => setBase({ ...base, [u]: e.target.value })} className="mono w-32 rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" data-baseline={u} /></label>
            ))}</div>
          </fieldset>
          {bad && <p role="alert" className="text-sm text-danger">{m.invalid}</p>}
          <div><Button variant="primary" type="submit" disabled={full}>{m.add}</Button></div>
        </form>
      </div>
    </Panel>
  );
}

/** Connect screen, after a capture: the reminders that are due with this capture's totals (in-page list only). */
export function MaintenanceDue({ cur, tasks }: { cur: Current; tasks: Task[] }) {
  const { t, lang } = usePrefs();
  const m = t.mt;
  const due = tasks.filter((x) => taskStatus(x, cur).due);
  return (
    <Panel title={m.dueTitle} icon={<Wrench size={17} />} i={2} demo={false} actions={<Chip tone="neutral">{m.untested}</Chip>}>
      <div data-testid="maintenance-due">
        <Totals cur={cur} />
        {tasks.length > 0 && (due.length === 0 ? <p className="mt-3 text-sm text-ink2">{m.dueNone}</p> : (
          <ul className="mt-3 grid gap-2">{due.map((x) => { const p = PRESETS.find((q) => q.id === x.preset); return <li key={x.id} className="flex items-center gap-2"><Chip tone="warn">{m.due}</Chip><strong>{p ? p.name[lang] : x.name}</strong></li>; })}</ul>
        ))}
        <a href="#/settings" className="mt-3 inline-block text-sm underline">{m.dueGo}</a>
      </div>
    </Panel>
  );
}
