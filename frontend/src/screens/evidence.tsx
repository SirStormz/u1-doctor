import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, ExternalLink, FileSearch, Fingerprint, ListChecks, ShieldAlert } from "lucide-react";
import type { Finding } from "../api";
import { Button, Chip, ClassChip, Hint, Panel, ProvenanceChip, StateBlock, TechDetails, TimeChip } from "../components/ui";
import { PageTitle, useToast } from "../components/shell";
import { NoData } from "../components/nodata";
import { hhmmss, tms, useIncident } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { errText } from "../lib/errors";
import { eventLabel, tok, tx } from "../lib/dyn";
import type { RouteName } from "../lib/router";

const ORDER: Record<string, number> = { OBSERVED: 0, SUSPECTED: 1, INCONCLUSIVE: 2 };
const QUAL: Record<string, number> = { STRONG: 0, MODERATE: 1, WEAK: 2, UNKNOWN: 3 };
const clean = (s: string) => s.replace(/^SYNTHETIC: /, "");
const useTx = () => { const { lang } = usePrefs(); return (s: string) => tx(lang, clean(s)); };

export function Findings({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, lang } = usePrefs();
  const L = useTx();
  const inc = useIncident();
  const [filter, setFilter] = useState("ALL");
  const rows = useMemo(() => inc.findings.filter((f) => filter === "ALL" || f.classification === filter).sort((a, b) => (ORDER[a.classification] ?? 9) - (ORDER[b.classification] ?? 9) || (QUAL[a.evidence_quality] ?? 9) - (QUAL[b.evidence_quality] ?? 9)), [inc.findings, filter]);
  if (inc.status !== "ready") return <StateBlock kind={inc.status === "error" ? "error" : "loading"} title={inc.status === "error" ? t.error : t.loading} body={inc.status === "error" ? errText(t, inc.error) : undefined} />;
  if (!inc.demo) return <><PageTitle title={t.nav.findings} sub={t.findingsSub} icon={<ListChecks size={26} />} /><NoData /></>;
  return (
    <>
      <PageTitle title={t.nav.findings} sub={t.findingsSub} icon={<ListChecks size={26} />}
        actions={<label className="flex items-center gap-2 text-sm text-ink2">{t.filter}
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-control bg-surface2 px-2 py-1.5 text-ink">
            <option value="ALL">{t.all}</option><option value="OBSERVED">{tok(lang, "classification", "OBSERVED")}</option><option value="INCONCLUSIVE">{tok(lang, "classification", "INCONCLUSIVE")}</option>
          </select></label>} />
      {rows.length > 0 && <Hint id="marks" className="mb-d" />}
      <Panel bodyClass="p-0" label={t.nav.findings} active>
        {rows.length === 0 ? <div className="p-4"><StateBlock kind="empty" title={t.empty} body={t.emptyFilter} action={<Button onClick={() => setFilter("ALL")}>{t.reset}</Button>} /></div> : (
          <div className="overflow-x-auto"><table className="w-full text-left">
            <caption className="sr-only">{t.nav.findings}</caption>
            <thead className="micro"><tr><th className="px-4 py-3">{t.classification}</th><th>{t.finding}</th><th>{t.evFor}/{t.evAgainst}/{t.evMissing}</th><th>{t.quality}</th><th className="px-4"><span className="sr-only">{t.open}</span></th></tr></thead>
            <tbody>
              {rows.map((f, k) => (
                <tr key={f.finding_id} style={{ "--i": k } as React.CSSProperties} className="rowin rowhover cursor-pointer border-t border-line hover:bg-surface2" onClick={() => go("evidence", f.finding_id)}>
                  <td className="px-4 py-3"><ClassChip c={f.classification} /></td>
                  <td className="py-3 pr-4"><p className="font-medium">{L(f.human_title)}</p><div onClick={(e) => e.stopPropagation()}><TechDetails className="mt-1"><p className="mono text-xs text-ink3">{f.rule_id} v{f.rule_version}</p></TechDetails></div></td>
                  <td className="mono py-3 pr-4">{f.evidence_for.length} / {f.evidence_against.length} / {f.missing_data.length}</td>
                  <td className="py-3 pr-4"><Chip>{tok(lang, "quality", f.evidence_quality)}</Chip></td>
                  <td className="px-4 py-3 text-right"><button type="button" className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); go("evidence", f.finding_id); }}>{t.open} <ChevronRight size={15} aria-hidden /></button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </>
  );
}

function List({ items, empty }: { items: { id: string; note: string }[]; empty: string }) {
  const { lang } = usePrefs();
  if (!items.length) return <p className="text-ink3">{empty}</p>;
  return <ul className="grid gap-2">{items.map((e) => (<li key={e.id + e.note} className="rounded-lg border border-line bg-surface2 px-3 py-2"><code className="mono break-all text-xs text-accent">{e.id}</code><p className="mt-0.5">{tx(lang, e.note)}</p></li>))}</ul>;
}

export function Evidence({ param, go }: { param?: string; go: (n: RouteName, p?: string) => void }) {
  const { t, lang } = usePrefs();
  const L = useTx();
  const inc = useIncident();
  const toast = useToast();
  if (inc.status !== "ready") return <StateBlock kind={inc.status === "error" ? "error" : "loading"} title={inc.status === "error" ? t.error : t.loading} body={inc.status === "error" ? errText(t, inc.error) : undefined} />;
  if (!inc.demo) return <><PageTitle title={t.nav.evidence} icon={<FileSearch size={26} />} /><NoData /></>;
  if (!inc.findings.length) return <StateBlock kind="empty" title={t.empty} />;
  const sorted = [...inc.findings].sort((a, b) => (ORDER[a.classification] ?? 9) - (ORDER[b.classification] ?? 9));
  const f: Finding = sorted.find((x) => x.finding_id === param) ?? sorted[0]!;
  const i = sorted.indexOf(f);
  const linked = inc.obs.filter((o) => [...f.evidence_for, ...f.evidence_against].some((e) => e.observation_id === o.observation_id)).sort((a, b) => tms(a) - tms(b));
  const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); toast(t.copied); } catch { toast(t.copyFail); } };

  return (
    <>
      <PageTitle title={t.nav.evidence} icon={<FileSearch size={26} />} sub={L(f.human_title)}
        actions={<><Button variant="ghost" disabled={i <= 0} onClick={() => go("evidence", sorted[i - 1]!.finding_id)} icon={<ChevronLeft size={16} />}>{t.prev}</Button>
          <span className="mono text-xs text-ink3">{i + 1}/{sorted.length}</span>
          <Button variant="ghost" disabled={i >= sorted.length - 1} onClick={() => go("evidence", sorted[i + 1]!.finding_id)}>{t.next} <ChevronRight size={16} aria-hidden /></Button></>} />
      <div className="grid gap-d xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-d">
          <Panel active brackets i={0} title={t.finding} icon={<ShieldAlert size={17} />} actions={<ClassChip c={f.classification} />}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{f.rule_id} v{f.rule_version}</Chip><Chip>{t.quality}: {tok(lang, "quality", f.evidence_quality)}</Chip>
              {f.source_mix.map((s) => <ProvenanceChip key={s} status={s} />)}
              {f.not_a_root_cause !== false && <Chip tone="accent">{t.notRootCause}</Chip>}
            </div>
            {f.hypotheses.map((h) => (<p key={h.id} className="mt-3 text-[15px]"><Chip tone="demo">{tok(lang, "label", h.label)}</Chip> {tx(lang, h.text)}</p>))}
            <Hint id="marks" className="mt-3" />
          </Panel>
          <div className="grid min-w-0 gap-d md:grid-cols-3">
            <Panel title={<span className="text-ok">{t.evFor} · {f.evidence_for.length}</span>} i={1}><List items={f.evidence_for.map((e) => ({ id: e.observation_id, note: e.note }))} empty={t.none} /></Panel>
            <Panel title={<span className="text-danger">{t.evAgainst} · {f.evidence_against.length}</span>} i={2}><List items={f.evidence_against.map((e) => ({ id: e.observation_id, note: e.note }))} empty={t.none} /></Panel>
            <Panel title={<span className="text-warn">{t.evMissing} · {f.missing_data.length}</span>} i={3}><List items={f.missing_data.map((m, k) => ({ id: `#${k + 1}`, note: m }))} empty={t.none} /></Panel>
          </div>
          <Panel title={t.linkedObs} i={4} bodyClass="p-0">
            <div className="overflow-auto"><table className="w-full text-left text-sm">
              <caption className="sr-only">{t.linkedObs}</caption>
              <thead className="micro"><tr><th className="px-4 py-2">{t.th.id}</th><th>{t.th.utc}</th><th>{t.th.event}</th><th>{t.provenance}</th><th>{t.th.validity}</th></tr></thead>
              <tbody>{linked.map((o) => (<tr key={o.observation_id} className="border-t border-line"><td className="mono px-4 py-2 text-xs">{o.observation_id}</td><td className="mono text-xs">{hhmmss(tms(o))}</td><td>{eventLabel(lang, o.event_type)}</td><td className="flex flex-wrap gap-1 py-2"><ProvenanceChip status={o.source_status} /><TimeChip q={o.timestamp_quality} /></td><td>{tok(lang, "validity", o.validity)}</td></tr>))}</tbody>
            </table></div>
          </Panel>
        </div>
        <div className="col-fill">
          <Panel title={t.limits} i={1}><ul className="grid gap-2">{f.limits.map((l) => <li key={l} className="flex gap-2"><span className="text-warn" aria-hidden>▲</span><span>{tx(lang, l)}</span></li>)}</ul></Panel>
          <Panel title={t.safeActions} i={2}><ul className="grid gap-2">{f.safe_actions.map((l) => <li key={l}>{tx(lang, l)}</li>)}</ul></Panel>
          <Panel title={t.references} i={3}>
            {f.references.length ? f.references.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noreferrer noopener" className="btn btn-secondary w-full justify-between"><span>{t.openOfficial}</span><ExternalLink size={15} aria-hidden /></a>
            )) : <p className="text-ink3">{t.none}</p>}
            {f.references[0] && <p className="mt-2 text-xs text-ink3">{tok(lang, "refkind", f.references[0].kind)} · {f.references[0].checked_at}</p>}
          </Panel>
          <Panel title={t.integrity} icon={<Fingerprint size={17} />} i={4}>
            {([[t.ruleset, f.ruleset_hash], [t.replayHash, f.replay_hash]] as const).map(([k, v]) => (
              <div key={k} className="mb-2 flex items-center gap-2">
                <div className="min-w-0 flex-1"><p className="micro">{k}</p><p className="mono truncate text-xs" title={v}>{v}</p></div>
                <Button variant="ghost" aria-label={`${t.copy} ${k}`} onClick={() => copy(v)} icon={<Copy size={15} />} />
              </div>
            ))}
            <p className="text-xs text-ink3">{t.integrityNote}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
