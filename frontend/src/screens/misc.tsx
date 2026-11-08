import { useEffect, useState } from "react";
import { Ban, Cpu, ExternalLink, FlaskConical, History, Info, MessageSquareText, Play, Plug, Search, ShieldCheck, Settings as SettingsIcon, TriangleAlert, Users } from "lucide-react";
import { api, firmwareIssues, goodToKnow, knownIssues, liveApi, LiveRefused, preflight, supportChecklist, PreflightRefused, type CommunityCause, type InterpretOut, type LiveOut, type FirmwareIssues, type GoodToKnow, type KnownIssues, type MessageMatch, type PfPlate, type PreflightOut } from "../api";
import { Button, Chip, Kbd, Panel, ProvenanceChip, SeverityChip, Seal, StateBlock } from "../components/ui";
import { PageTitle } from "../components/shell";
import { useIncident } from "../lib/data";
import { usePrefs, type Density, type Mode, type Theme } from "../lib/prefs";
import { errText } from "../lib/errors";
import { moduleLabel, scenarioLabel, tok, tx } from "../lib/dyn";
import { pfLimit, pfView, type PfCheck } from "../lib/preflight-text";
import { buildRequest, supNote, supText, type SupportOut } from "../lib/support-text";
import type { RouteName } from "../lib/router";
import { EvidenceNotice } from "../components/evidence-notice";
import { LiveNet } from "../components/live-net";
import { CaptureAlert, useCaptureAlert } from "../components/capture-alert";
import { loadGcodeNozzle, nozzleFromPreflight, saveGcodeNozzle } from "../lib/gcode-nozzle";
import { MaintenanceDue, MaintenancePanel } from "../components/maintenance";
import { currentFrom, dueTasks, loadTasks, saveCurrent, type Current } from "../lib/maintenance";

type Go = (n: RouteName, p?: string) => void;

/* ---------------- Welcome ---------------- */
export function Welcome({ go }: { go: Go }) {
  const { t } = usePrefs();
  const pillars = [{ h: t.pillar1h, b: t.pillar1b }, { h: t.pillar2h, b: t.pillar2b }, { h: t.pillar3h, b: t.pillar3b }];
  return (
    <>
      <section className="reveal grid gap-[34px] border-b-2 border-ink pb-[34px] lg:grid-cols-[1.618fr_1fr]" aria-labelledby="welcome-h">
        <div className="grid content-start gap-[21px]">
          <Chip tone="demo" icon={<FlaskConical size={12} aria-hidden />}>{t.modeDemo} · SYNTHETIC</Chip>
          <h1 id="welcome-h" className="text-[clamp(40px,5.4vw,var(--t-7))] font-extrabold leading-[0.95] tracking-[-0.055em]">{t.welcomeTitle}</h1>
          <p className="max-w-[52ch] text-[length:var(--t-1)] font-medium leading-[1.4] text-ink2">{t.welcomeBody}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<Play size={16} />} onClick={() => go("overview")}>{t.startDemo}</Button>
            <Button icon={<Search size={16} />} onClick={() => go("explorer")}>{t.decodeCode}</Button>
            <a href="#/" className="btn btn-ghost no-underline">{t.landing.back}</a>
          </div>
          <p className="text-xs text-ink3">{t.tip} <Kbd>Ctrl K</Kbd></p>
        </div>
        <div className="grid content-start gap-3" aria-label={t.privacyTitle}>
          <p className="manual-label w-fit">{t.privacyTitle}</p>
          <ul className="grid gap-0 border-y-2 border-ink">{t.privacyPoints.map((p, k) => <li key={p} className="flex gap-3 border-b border-line py-2.5 last:border-b-0"><span className="mono text-ink3" aria-hidden>{String(k + 1).padStart(2, "0")}</span><span className="font-semibold">{p}</span></li>)}</ul>
        </div>
      </section>
      <div className="mt-[34px] grid gap-[34px] md:grid-cols-3">
        {pillars.map((p, k) => (
          <section key={p.h} className="reveal" style={{ "--i": k + 1 } as React.CSSProperties} aria-label={p.h}>
            <p className="num-hero" aria-hidden>0{k + 1}</p>
            <h2 className="mt-[13px] border-t-2 border-ink pt-2 text-[length:var(--t-1)] font-extrabold tracking-[-0.02em]">{p.h}</h2>
            <p className="mt-1 text-ink2">{p.b}</p>
          </section>
        ))}
      </div>
    </>
  );
}

/* ---------------- Connect (read-only live capture, owner-approved) ---------------- */
const ALLOW = [["GET", "/server/info"], ["GET", "/printer/info"], ["GET", "/printer/objects/list"], ["GET", "/server/files/directory?path=logs"], ["GET", "/server/history/totals"], ["WS", "printer.objects.subscribe"]];
const DENY = ["printer.gcode.script", "printer.print.*", "printer.restart", "machine.*", "server.files.upload", "server.files.delete", "/printer/objects/query"];
export function Connect() {
  const { t, lang } = usePrefs();
  const [host, setHost] = useState("");
  const [consent, setConsent] = useState(false);
  const [secs, setSecs] = useState(15);
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<LiveOut | null>(null);
  const [gcodeMm] = useState<number[] | null>(() => loadGcodeNozzle());
  const alert = useCaptureAlert("live-result");
  const [maint, setMaint] = useState<Current | null>(null);

  async function run() {
    setBusy(true); setErr(null); setOut(null); setMaint(null); alert.clear();
    try {
      const r = await liveApi.capture(host.trim(), secs, save, gcodeMm ?? undefined);
      setOut(r);
      // maintenance reminders (local, BACKLOG #65): keep this capture's totals, count the tasks due with them
      const cur = r.maintenance_inputs ? currentFrom(r.maintenance_inputs, r.captured_utc) : null;
      if (cur) { saveCurrent(cur); setMaint(cur); }
      alert.raise(r.findings, r.observations, [r.printer.klippy_state, r.printer.printer_state], cur ? dueTasks(loadTasks(), cur).length : 0);
    }
    catch (e) { setErr((e instanceof LiveRefused ? t.liveErr[e.code] ?? t.apiErr[e.code] : undefined) ?? t.liveErr["UNKNOWN"] ?? ""); }
    finally { setBusy(false); }
  }
  const ready = consent && /^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim()) && !busy;
  return (
    <>
      <PageTitle title={t.nav.connect} sub={t.connectSub} icon={<Plug size={26} />} actions={<Chip tone="ok" icon={<ShieldCheck size={12} aria-hidden />}>{t.notInBuild}</Chip>} />
      <CaptureAlert cause={alert.cause} kind="capture" onView={alert.view} onDismiss={alert.clear} />
      <div className="grid gap-d xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={t.connSteps} icon={<Cpu size={17} />} i={0} active demo={false}>
          <ol className="grid gap-3">
            {[t.step1, t.step2, t.step3].map((s, k) => (<li key={s} className="flex items-start gap-3 rounded-lg border border-line bg-surface2 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center border border-control text-sm font-bold text-ink2">{k + 1}</span><span>{s}</span></li>))}
          </ol>
          <label className="mt-4 grid gap-1 text-sm">{t.address}
            <input value={host} onChange={(e) => setHost(e.target.value)} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="192.168.x.x" className="mono rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" aria-describedby="addr-help" />
          </label>
          <p id="addr-help" className="mt-1 text-xs text-ink3">{t.addrHelp}</p>
          <label className="mt-3 grid gap-1 text-sm">{t.liveSeconds}
            <input type="number" min={3} max={60} value={secs} onChange={(e) => setSecs(Math.max(3, Math.min(60, Number(e.target.value) || 15)))} className="mono w-28 rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /><span>{t.liveConsent}</span></label>
          <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="mt-1" /><span>{t.liveSave}</span></label>
          {gcodeMm && <p className="mt-2 text-xs text-ink3">{t.net.gcode.replace("{mm}", gcodeMm.map((x) => (lang === "fr" ? String(x).replace(".", ",") : String(x))).join(", "))}</p>}
          <div className="mt-4"><Button variant="primary" disabled={!ready} onClick={() => void run()} icon={<Plug size={16} />}>{busy ? t.liveRunning : t.connectBtn}</Button></div>
          {!out && !err && !busy && <StateBlock kind="empty" title={t.notInBuild} body={t.notInBuildBody} />}
          {busy && <StateBlock kind="loading" title={t.liveRunning} />}
          {err && <div role="alert"><StateBlock kind="error" title={t.error} body={err} /></div>}
        </Panel>
        <div className="col-fill">
          {out && (
            <div id="live-result" tabIndex={-1} className="outline-none">
            <Panel title={t.liveDone} icon={<Cpu size={17} />} i={1} demo={false}>
              <div className="mb-3 flex flex-wrap gap-2"><Chip tone="ok">{t.liveReal}</Chip><Chip tone={out.audit.non_read_operations === 0 ? "ok" : "danger"}>{t.liveWrites}: {out.audit.non_read_operations}</Chip><Chip tone="neutral">{t.liveReads}: {out.audit.read_operations}</Chip></div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink3">{t.livePrinter}</dt><dd className="mono">{out.printer.printer_state}</dd>
                <dt className="text-ink3">{t.liveKlippy}</dt><dd className="mono">{out.printer.klippy_state}</dd>
                <dt className="text-ink3">{t.liveMoon}</dt><dd className="mono">{out.printer.moonraker_version}</dd>
                <dt className="text-ink3">{t.liveKlipper}</dt><dd className="mono break-all">{out.printer.klipper_software_version}</dd>
                <dt className="text-ink3">{t.liveObjects}</dt><dd className="mono">{out.printer.object_count}</dd>
                <dt className="text-ink3">{t.liveFrames}</dt><dd className="mono">{out.inbound_frames}</dd>
                <dt className="text-ink3">{t.liveObs}</dt><dd className="mono">{out.observations.length}</dd>
                <dt className="text-ink3">{t.liveFind}</dt><dd className="mono">{out.findings.length}</dd>
              </dl>
              {out.findings.length === 0 && <p className="mt-3 text-sm text-ink2">{t.liveNoFind}</p>}
              <p className="mt-3 text-xs text-ink3">{out.session ? t.liveSaved : t.liveNotSaved}</p>
              <EvidenceNotice />
            </Panel>
            </div>
          )}
          {out?.connectivity && <LiveNet net={out.connectivity} />}
          {out && maint && <MaintenanceDue cur={maint} tasks={loadTasks()} />}
          <Panel title={t.allowlist} icon={<ShieldCheck size={17} />} i={2} demo={false}>
            <table className="w-full text-left text-sm"><caption className="sr-only">{t.allowlist}</caption><tbody>{ALLOW.map(([m, p]) => (<tr key={p} className="border-t border-line first:border-0"><td className="py-1.5 pr-3"><Chip tone="ok">{m}</Chip></td><td className="mono text-xs">{p}</td></tr>))}</tbody></table>
          </Panel>
          <Panel title={t.denied} icon={<Ban size={17} />} i={3} demo={false}>
            <div className="flex flex-wrap gap-2">{DENY.map((d) => <Chip key={d} tone="danger">{d}</Chip>)}</div>
            <p className="mt-3 text-xs text-ink3">{t.deniedNote}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ---------------- Error code explorer ---------------- */
const SAMPLES = ["0002-0525-0002-0002", "0002-0525-0002-0004", "0003-0522-0002-0008", "0003-0529-0001-0009"];
export function Explorer({ param }: { param?: string }) {
  const { t, lang } = usePrefs();
  const [code, setCode] = useState(param ?? "");
  const [res, setRes] = useState<InterpretOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fw, setFw] = useState("");

  async function run(c: string) {
    setBusy(true); setErr(null);
    try { setRes(await api.interpret(c, fw.trim() || undefined)); } catch (e) { setRes(null); setErr(errText(t, e)); } finally { setBusy(false); }
  }
  useEffect(() => { if (param) { setCode(param); void run(param); } }, [param]);
  const d = res?.decoding;
  const entry = d?.entry as ({ title: string; summary: string; toolhead?: number | null; inspect_toolheads?: number[]; inspect_scope?: "listed" | "all" | "this_head" }) | null | undefined;
  const crit = d?.severity === "error";
  const pick = (c: string) => { setCode(c); void run(c); };
  const msgs = d?.status === "MALFORMED" ? res?.messages ?? [] : [];
  return (
    <>
      <PageTitle title={t.nav.explorer} sub={t.explorerSub} icon={<Search size={26} />} />
      <div className="grid gap-d xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel title={t.codeLabel} i={0} active>
          <form onSubmit={(e) => { e.preventDefault(); void run(code); }} className="grid gap-3">
            <input value={code} maxLength={200} onChange={(e) => setCode(e.target.value)} placeholder="0002-0525-0002-0002" aria-label={t.codeLabel} className="mono rounded-lg border border-control bg-surface2 px-3 py-2.5 text-base text-ink" />
            <label className="grid gap-1.5"><span className="micro">{t.fwLabel}</span>
              <input value={fw} maxLength={32} onChange={(e) => setFw(e.target.value)} placeholder="2.1.0" aria-label={t.fwLabel} className="mono rounded-lg border border-control bg-surface2 px-3 py-2.5 text-base text-ink" />
              <span className="text-xs text-ink3">{t.fwHint}</span></label>
            <Button variant="primary" type="submit" disabled={busy} icon={<Search size={16} />}>{t.decode}</Button>
          </form>
          <p className="micro mt-4 mb-2">{t.samples}</p>
          <div className="flex flex-wrap gap-2">{SAMPLES.map((s) => (<button key={s} type="button" className="chip" data-tone="accent" onClick={() => { setCode(s); void run(s); }}>{s}</button>))}</div>
        </Panel>
        <div aria-live="polite">
          {err && <StateBlock kind="error" title={t.error} body={err} />}
          {!res && !err && <StateBlock kind="empty" title={t.empty} body={t.explorerEmpty} />}
          {res && d && msgs.length > 0 && <MessagesPanel items={msgs} onPick={pick} />}
          {res && d && msgs.length === 0 && (
            <Panel i={1} active={!crit} title={<span className="flex items-center gap-2">{d.status === "MALFORMED" ? t.statusMalformed : entry?.title ? tx(lang, entry.title) : t.statusStructure}</span>} actions={<SeverityChip level={d.severity} />}>
              {crit && <div role="alert" className="mb-4 flex gap-3 rounded-lg border p-3" style={{ borderColor: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, var(--surface-1))" }}><TriangleAlert className="shrink-0 text-danger" aria-hidden /><p>{t.criticalNote}</p></div>}
              <div className="flex flex-wrap items-center gap-2"><ProvenanceChip status="USER_REPORTED" /><span className="mono text-xs text-ink2">{res.decoding.status === "MALFORMED" ? code : (d as unknown as { code?: string }).code}</span>
                {d.module && <Chip>{moduleLabel(lang, d.module)}</Chip>}{entry?.toolhead != null && <Chip tone="accent">{t.toolhead} {entry.toolhead} · {t.fromTable}</Chip>}<Chip tone={d.status === "KNOWN" ? "ok" : "neutral"}>{tok(lang, "classification", d.classification)}</Chip></div>
              {entry && <p className="mt-3 text-[15px]">{tx(lang, entry.summary)}</p>}
              {d.status !== "MALFORMED" && <SupportList code={(d as unknown as { code?: string }).code ?? code} firmware={fw.trim() || undefined} title={entry?.title ?? null} />}
              {entry?.inspect_toolheads && entry.inspect_scope && <DockHint reported={entry.toolhead ?? null} inspect={entry.inspect_toolheads} scope={entry.inspect_scope} />}
              {d.firmware && (d.firmware.notes.length > 0 || d.firmware.valid === false) && (
                <div className="mt-4" data-testid="fw-notes">
                  <h3 className="micro mb-2">{t.fwNotes}</h3>
                  {d.firmware.valid === false && <p className="mb-2 text-warn">{t.fwInvalid}</p>}
                  <ul className="grid gap-2">
                    {d.firmware.notes.map((n) => (
                      <li key={n.text} className="rounded-lg border border-control p-2.5 text-[15px]">
                        <div className="flex flex-wrap items-center gap-2">
                          {n.applies === "BEFORE" && <Chip tone="warn">{t.fwBefore}</Chip>}
                          {n.applies === "INCLUDED" && <Chip tone="ok">{t.fwIncluded}</Chip>}
                          <span className="mono text-xs text-ink3">{n.component} {n.version}</span>
                        </div>
                        <p className="mt-1.5">{tx(lang, n.text)}</p>
                        <a href={n.source} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-xs underline">{t.fwSource}<ExternalLink size={12} aria-hidden /></a>
                      </li>
                    ))}
                  </ul>
                  {d.firmware.latest && <p className="mt-2 text-xs text-ink3">{t.fwLatest.replace("{v}", d.firmware.latest.version).replace("{d}", d.firmware.latest.date)}{d.firmware.behind_latest ? ` ${t.fwBehind}` : ""}</p>}
                </div>
              )}
              {d.reason && <p className="mt-3 text-danger">{tx(lang, d.reason)}</p>}
              {res.input && res.input.suggestions.length > 0 && <Suggestions items={res.input.suggestions} normalized={res.input.normalized} onPick={pick} />}
              <h3 className="micro mt-5 mb-2">{t.limits}</h3>
              <ul className="grid gap-1.5">{res.limits.map((l) => <li key={l} className="flex gap-2"><span className="text-warn" aria-hidden>▲</span>{tx(lang, l)}</li>)}</ul>
              <a href={res.official_reference} target="_blank" rel="noreferrer noopener" className="btn btn-secondary mt-4 w-fit">{t.openOfficial}<ExternalLink size={15} aria-hidden /></a>
              <p className="mt-2 text-xs text-ink3">{t.catalogNote.replace("{d}", res.catalog_verified_at)}</p>
            </Panel>
          )}
          {res?.community && res.community.causes.length > 0 && <CommunityPanel causes={res.community.causes} checkedAt={res.community.checked_at} />}
        </div>
      </div>
      <KnownIssuesPanel code={res && d && d.status !== "MALFORMED" ? ((d as unknown as { code?: string }).code ?? code) : null} />
      <FirmwareIssuesPanel />
      <GoodToKnowPanel />
      <Preflight onCode={(c) => { setCode(c); void run(c); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
    </>
  );
}

/** "Did you mean": closest catalog codes to a mistyped one, by spelling only. Decoded only when the owner picks one. */
function Suggestions({ items, normalized, onPick }: { items: { code: string; title: string }[]; normalized: string | null; onPick: (c: string) => void }) {
  const { t, lang } = usePrefs();
  return (
    <div className="mt-4" data-testid="code-suggestions">
      <h3 className="micro mb-1">{t.nm.title}</h3>
      {normalized && <p className="mono mb-1 text-xs text-ink3">{t.nm.normalized.replace("{c}", normalized)}</p>}
      <ul className="flex flex-wrap gap-2">{items.map((s) => <li key={s.code}><button type="button" className="chip" data-tone="accent" onClick={() => onPick(s.code)}><span className="mono">{s.code}</span> · {tx(lang, s.title)}</button></li>)}</ul>
      <p className="mt-2 text-xs text-ink3">{t.nm.note}</p>
    </div>
  );
}

/** Forum reports for this exact code: a separate block, always labelled as a community report with its source and date. */
function CommunityPanel({ causes, checkedAt }: { causes: CommunityCause[]; checkedAt: string }) {
  const { t, lang } = usePrefs();
  return (
    <div className="mt-4">
      <Panel title={t.cc.title} icon={<Users size={17} />} i={2} demo={false}>
        <p className="text-ink2">{t.cc.note}</p>
        <ul className="mt-3 grid gap-3" data-testid="community-causes">
          {causes.map((c) => (
            <li key={c.id} data-cause={c.id} className="rounded-lg border-2 border-dashed p-3" style={{ borderColor: "var(--control-line)" }}>
              <div className="flex flex-wrap items-center gap-2"><Chip tone="neutral" icon={<Users size={12} aria-hidden />}>{t.cc.kind}</Chip>{c.reported_as.some((r) => !c.codes.includes(r)) && <span className="mono text-xs text-ink3">{t.cc.reportedAs} · {c.reported_as.join(", ")}</span>}</div>
              <dl className="mt-2 grid gap-1.5 text-[15px]">
                <div><dt className="micro">{t.cc.cause}</dt><dd className="m-0">{c.cause[lang]}</dd></div>
                <div><dt className="micro">{t.cc.check}</dt><dd className="m-0"><ul className="grid gap-1">{c.check.map((k) => <li key={k.en} className="flex gap-2"><span className="text-ink3" aria-hidden>·</span>{k[lang]}</li>)}</ul></dd></div>
                <div><dt className="micro">{t.cc.scope}</dt><dd className="m-0 text-ink2">{c.scope[lang]}</dd></div>
              </dl>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {c.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{t.cc.source} {s.url.split("/").pop()} · {t.cc.posted.replace("{d}", s.posted)}<ExternalLink size={12} aria-hidden /></a>)}
                {(c.articles ?? []).map((a) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{t.cc.article}{lang === "en" ? ` · ${a.title}` : ""}<ExternalLink size={12} aria-hidden /></a>)}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink3">{t.cc.checked.replace("{d}", checkedAt)}</p>
      </Panel>
    </div>
  );
}

/** A text without a dddd-dddd-dddd-dddd code that matches a curated message. */
function MessagesPanel({ items, onPick }: { items: MessageMatch[]; onPick: (c: string) => void }) {
  const { t, lang } = usePrefs();
  return (
    <Panel i={1} active title={t.msg.title} icon={<MessageSquareText size={17} />} actions={<ProvenanceChip status="USER_REPORTED" />}>
      <p className="text-ink2">{t.msg.note}</p>
      <ul className="mt-3 grid gap-3" data-testid="message-matches">
        {items.map((m) => (
          <li key={m.id} data-message={m.id} className="rounded-lg border border-control p-3">
            <strong>{m.title[lang]}</strong>
            <p className="mt-1.5 text-[15px]">{m.explanation[lang]}</p>
            {m.related_codes.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="micro">{t.msg.relatedCodes}</span>{m.related_codes.map((c) => <button key={c} type="button" className="chip mono" data-tone="accent" onClick={() => onPick(c)}>{c}</button>)}</div>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {m.articles.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{a.relation === "about" ? t.msg.about : t.msg.related}{lang === "en" ? ` · ${a.title}` : ""}<ExternalLink size={12} aria-hidden /></a>)}
              {m.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{t.msg.community} · {t.cc.source} {s.url.split("/").pop()} · {t.cc.posted.replace("{d}", s.posted)}<ExternalLink size={12} aria-hidden /></a>)}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Documented quick fixes (official wiki, own wording). The one matching the decoded code is highlighted and listed first. */
function KnownIssuesPanel({ code }: { code: string | null }) {
  const { t, lang } = usePrefs();
  const [data, setData] = useState<KnownIssues | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => { let live = true; knownIssues().then((x) => { if (!live) return; if (Array.isArray(x?.issues)) setData(x); else setFail(true); }).catch(() => { if (live) setFail(true); }); return () => { live = false; }; }, []);
  const rows = data ? [...data.issues].sort((a, b) => Number(b.applies.code === code && !!code) - Number(a.applies.code === code && !!code)) : [];
  return (
    <div className="mt-4">
      <Panel title={t.kiTitle} icon={<TriangleAlert size={17} />} i={3} demo={false}>
        <p className="text-ink2">{t.kiNote}</p>
        {fail && <p className="mt-3 text-ink3">{t.kiLoadFail}</p>}
        {data && (
          <ul className="mt-3 grid gap-2" data-testid="known-issues">
            {rows.map((k) => {
              const hit = !!code && k.applies.code === code;
              return (
                <li key={k.id} data-match={hit} className="rounded-lg border-2 p-3" style={{ borderColor: hit ? "var(--warn)" : "var(--control-line)" }}>
                  <div className="flex flex-wrap items-center gap-2"><strong>{k.title[lang]}</strong><Chip>{k.component}</Chip>{hit && <Chip tone="warn">{t.kiMatch}</Chip>}{k.applies.code && <span className="mono text-xs text-ink3">{k.applies.code}</span>}</div>
                  <dl className="mt-2 grid gap-1 text-[15px]">
                    <div><dt className="micro">{t.kiSymptom}</dt><dd className="m-0">{k.symptom[lang]}</dd></div>
                    <div><dt className="micro">{t.kiCause}</dt><dd className="m-0">{k.cause[lang]}</dd></div>
                    <div><dt className="micro">{t.kiFix}</dt><dd className="m-0">{k.fix[lang]}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
        {data && <a href={data.source_url} target="_blank" rel="noreferrer noopener" className="btn btn-secondary mt-3 w-fit">{t.kiSource}<ExternalLink size={15} aria-hidden /></a>}
        {data && <p className="mt-2 text-xs text-ink3">{t.catalogNote.replace("{d}", data.checked_at)}</p>}
      </Panel>
    </div>
  );
}

/** Known issues per firmware version (#60): dated, sourced, filterable by the version the user picks. Never read from a printer. */
function FirmwareIssuesPanel() {
  const { t, lang } = usePrefs();
  const [ver, setVer] = useState("");
  const [data, setData] = useState<FirmwareIssues | null>(null);
  const [all, setAll] = useState<FirmwareIssues | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    let live = true;
    firmwareIssues(ver || undefined).then((x) => { if (!live) return; if (Array.isArray(x?.issues)) { setData(x); if (!ver) setAll(x); } else setFail(true); }).catch(() => { if (live) setFail(true); });
    return () => { live = false; };
  }, [ver]);
  const range = (a: { min: string | null; max: string | null }) =>
    a.min && a.max ? (a.min === a.max ? a.min : `${a.min} – ${a.max}`) : a.min ? t.fwiFrom.replace("{v}", a.min) : t.fwiUpTo.replace("{v}", a.max ?? "?");
  return (
    <div className="mt-4">
      <Panel title={t.fwiTitle} icon={<TriangleAlert size={17} />} i={4} demo={false}>
        <p className="text-ink2">{t.fwiNote}</p>
        {all && <p className="mt-2 text-sm text-warn" data-testid="fwi-stale">{t.fwiStale.replace("{d}", all.checked_at)}</p>}
        {all && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="micro">{t.fwiFilter}</span>
            <select className="w-fit rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" value={ver} onChange={(e) => setVer(e.target.value)} data-testid="fwi-filter">
              <option value="">{t.fwiAll}</option>
              {all.versions.map((v) => <option key={v.version} value={v.version}>{v.version} ({v.date})</option>)}
            </select>
          </label>
        )}
        {fail && <p className="mt-3 text-ink3">{t.fwiLoadFail}</p>}
        {data && data.issues.length === 0 && <p className="mt-3 text-ink3">{t.fwiNone}</p>}
        {data && data.issues.length > 0 && (
          <ul className="mt-3 grid gap-2" data-testid="fw-issues">
            {data.issues.map((k) => (
              <li key={k.id} data-origin={k.origin} className="rounded-lg border-2 p-3" style={{ borderColor: "var(--control-line)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>{t.fwiAffected} {range(k.affected)}</Chip>
                  <Chip tone={k.fixed_in ? "ok" : "neutral"}>{k.fixed_in ? t.fwiFixed.replace("{v}", k.fixed_in) : t.fwiNotFixed}</Chip>
                  <Chip tone={k.origin === "OFFICIAL_RELEASE_NOTE" ? "accent" : "warn"}>{k.origin === "OFFICIAL_RELEASE_NOTE" ? t.fwiOfficial : t.fwiCommunity}</Chip>
                  {k.staff_confirmed && <Chip>{t.fwiStaff}</Chip>}
                  {k.type === "behaviour" && <Chip>{t.fwiBehaviour}</Chip>}
                  {k.codes.map((c) => <span key={c} className="mono text-xs text-ink3">{c}</span>)}
                </div>
                <p className="mt-2 text-[15px]">{k.symptom[lang]}</p>
                <dl className="mt-2 grid gap-1 text-sm">
                  {k.workaround && <div><dt className="micro">{t.fwiWorkaround}</dt><dd className="m-0">{k.workaround[lang]}</dd></div>}
                  <div><dt className="micro">{t.fwiScope}</dt><dd className="m-0 text-ink2">{k.scope[lang]}</dd></div>
                </dl>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink3">
                  {k.sources.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{x.title} ({x.posted})<ExternalLink size={12} aria-hidden /></a>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Good-to-know notes: static, community-reported, each with its forum topics, date and (when one exists) the official article. */
function GoodToKnowPanel() {
  const { t, lang } = usePrefs();
  const [data, setData] = useState<GoodToKnow | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => { let live = true; goodToKnow().then((x) => { if (!live) return; if (Array.isArray(x?.notes)) setData(x); else setFail(true); }).catch(() => { if (live) setFail(true); }); return () => { live = false; }; }, []);
  return (
    <div className="mt-4">
      <Panel title={t.gk.title} icon={<Info size={17} />} i={4} demo={false}>
        <p className="text-ink2">{t.gk.note}</p>
        {fail && <p className="mt-3 text-ink3">{t.gk.loadFail}</p>}
        {data && (
          <ul className="mt-3 grid gap-2" data-testid="good-to-know">
            {data.notes.map((n) => (
              <li key={n.id} data-note={n.id} className="rounded-lg border-2 border-dashed p-3" style={{ borderColor: "var(--control-line)" }}>
                <div className="flex flex-wrap items-center gap-2"><strong>{n.title[lang]}</strong><Chip tone="warn" icon={<Users size={12} aria-hidden />}>{t.gk.kind}</Chip></div>
                <p className="mt-2 text-[15px]">{n.text[lang]}</p>
                <p className="mt-1.5 text-sm text-ink2"><span className="micro">{t.gk.scope}</span> {n.scope[lang]}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {n.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{t.cc.source} {s.url.split("/").pop()} · {t.cc.posted.replace("{d}", s.posted)}<ExternalLink size={12} aria-hidden /></a>)}
                  {(n.articles ?? []).map((a) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{t.cc.article}{lang === "en" ? ` · ${a.title}` : ""}<ExternalLink size={12} aria-hidden /></a>)}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && <p className="mt-2 text-xs text-ink3" data-testid="gk-checked">{t.cc.checked.replace("{d}", data.checked_at)}</p>}
      </Panel>
    </div>
  );
}

/** Schematic of the four dock slots: which toolheads the official table row tells you to inspect. Slot numbers only, no geometry. */
function DockHint({ reported, inspect, scope }: { reported: number | null; inspect: number[]; scope: "listed" | "all" | "this_head" }) {
  const { t } = usePrefs();
  const why = scope === "listed" ? t.dockListed : scope === "all" ? t.dockAll : t.dockThis;
  return (
    <div className="mt-4" data-testid="dock-hint">
      <h3 className="micro mb-2">{t.dockTitle}</h3>
      <ul className="grid grid-cols-4 gap-2" aria-label={t.dockTitle}>
        {[1, 2, 3, 4].map((n) => {
          const look = inspect.includes(n);
          const rep = reported === n;
          return (
            <li key={n} data-slot={n} data-inspect={look} data-reported={rep} className="rounded-lg border-2 p-2 text-center" style={{ borderColor: look ? "var(--warn)" : "var(--control-line)", background: look ? "color-mix(in srgb, var(--warn) 12%, var(--surface-1))" : "transparent" }}>
              <div className="mono text-base font-bold">T{n}</div>
              <div className="text-xs">{look ? t.dockInspect : "·"}{rep ? ` · ${t.dockReported}` : ""}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink3">{why} {t.dockNote}</p>
    </div>
  );
}

/* ---------------- What support will ask ---------------- */
function SupportList({ code, firmware, title }: { code: string; firmware?: string; title: string | null }) {
  const { t, lang } = usePrefs();
  const [data, setData] = useState<SupportOut | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  useEffect(() => { let live = true; setData(null); setChecked(new Set()); supportChecklist(code, firmware).then((x) => { if (live) setData(x); }).catch(() => {}); return () => { live = false; }; }, [code, firmware]);
  if (!data || !Array.isArray(data.items)) return null;
  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function copy() {
    try { await navigator.clipboard.writeText(buildRequest(lang, data!, checked, title ? tx(lang, title) : null)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable: nothing to do */ }
  }
  return (
    <div className="mt-4" data-testid="support-list">
      <h3 className="micro mb-1">{t.supTitle}</h3>
      <p className="mb-2 text-xs text-ink3">{t.supSub}</p>
      <ul className="grid gap-1.5">
        {data.items.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-start gap-2 text-[15px]">
              <input type="checkbox" checked={checked.has(i.id)} onChange={() => toggle(i.id)} className="mt-1" />
              <span>{supText(lang, i)} <Chip tone={i.source === "wiki" ? "accent" : "neutral"}>{i.source === "wiki" ? t.supWiki : t.supSuggested}</Chip></span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void copy()}>{copied ? t.supCopied : t.supCopy}</Button>
        <a href={data.ticket.url} target="_blank" rel="noreferrer noopener" className="btn btn-secondary">{t.supForm}<ExternalLink size={15} aria-hidden /></a>
      </div>
      <ul className="mt-2 grid gap-1">{data.notes.map((n) => <li key={n} className="flex gap-2 text-xs text-ink3"><span className="text-warn" aria-hidden>▲</span>{supNote(lang, n)}</li>)}</ul>
    </div>
  );
}

const PF_TONE = { FAIL: "danger", WARN: "warn", PASS: "ok", INFO: "neutral", UNKNOWN: "neutral" } as const;

/* ---------------- G-code pre-flight ---------------- */
const PF_ORDER = { FAIL: 0, WARN: 1, UNKNOWN: 2, INFO: 3, PASS: 4 } as const;
const PF_KEYS = ["FAIL", "WARN", "UNKNOWN", "INFO", "PASS"] as const;

function PfSummary({ summary }: { summary: PreflightOut["summary"] }) {
  const { t } = usePrefs();
  return <>{PF_KEYS.map((k) => <Chip key={k} tone={PF_TONE[k]}>{t[`pf${k}` as "pfFAIL"]} · {summary[k]}</Chip>)}</>;
}

function PfChecks({ checks, onCode }: { checks: PfCheck[]; onCode: (code: string) => void }) {
  const { t, lang } = usePrefs();
  return (
    <ul className="mt-4 grid gap-3">
      {[...checks].sort((a, b) => PF_ORDER[a.status] - PF_ORDER[b.status]).map((c) => {
        const v = pfView(lang, c);
        return (
          <li key={c.id} className="rounded-lg border border-control p-3" data-status={c.status}>
            <div className="flex flex-wrap items-center gap-2"><Chip tone={PF_TONE[c.status]}>{t[`pf${c.status}` as "pfFAIL"]}</Chip><strong>{v.title}</strong></div>
            <p className="mt-1.5 text-[15px]">{v.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink3">
              {c.evidence.count > 0 && <span className="mono">{c.evidence.count} {t.pfMatches} · {t.pfLines} {c.evidence.lines.join(", ")}{c.evidence.count > c.evidence.lines.length ? "…" : ""}</span>}
              {c.code && <button type="button" className="chip" data-tone="accent" onClick={() => onCode(c.code!)}>{c.code} · {t.pfOpenCode}</button>}
              <a href={c.reference.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{c.reference.title}<ExternalLink size={12} aria-hidden /></a>
            </div>
            {c.community && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink3" data-testid="pf-community">
                <Chip tone="warn">{t.pfCommunity.replace("{d}", c.community.checked)}</Chip>
                {c.community.sources.filter((x) => x.url !== c.reference.url).map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{x.title}<ExternalLink size={12} aria-hidden /></a>)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Several sliced plates of one 3MF: one tab per plate (WAI-ARIA tabs; arrow keys, Home and End move between plates). */
function PfPlates({ plates, onCode }: { plates: PfPlate[]; onCode: (code: string) => void }) {
  const { t, lang } = usePrefs();
  const [sel, setSel] = useState(0);
  const name = (p: PfPlate) => (p.plate != null ? t.pfPlate.replace("{n}", String(p.plate)) : p.entry.replace(/^Metadata\//, ""));
  const cur = plates[Math.min(sel, plates.length - 1)]!;
  function key(e: React.KeyboardEvent, k: number) {
    const n = plates.length;
    const next = e.key === "ArrowRight" ? (k + 1) % n : e.key === "ArrowLeft" ? (k - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); setSel(next);
    document.getElementById(`pf-tab-${next}`)?.focus();
  }
  return (
    <div className="mt-4" data-testid="pf-plates">
      <div role="tablist" aria-label={t.pfPlates} className="flex flex-wrap gap-2">
        {plates.map((p, k) => (
          <button key={p.entry} id={`pf-tab-${k}`} type="button" role="tab" aria-selected={k === sel} aria-controls="pf-plate-panel" tabIndex={k === sel ? 0 : -1}
            onClick={() => setSel(k)} onKeyDown={(e) => key(e, k)} className="chip" data-tone={k === sel ? "accent" : "neutral"}>
            {name(p)}{p.refused ? ` · ${t.pfPlateRefused}` : p.summary && p.summary.FAIL > 0 ? ` · ${t.pfFAIL} ${p.summary.FAIL}` : ""}
          </button>
        ))}
      </div>
      <div id="pf-plate-panel" role="tabpanel" aria-labelledby={`pf-tab-${sel}`} tabIndex={0} className="mt-3 outline-none" data-plate={cur.plate ?? ""}>
        <p className="mono text-xs text-ink3">{cur.entry}{cur.file ? ` · ${cur.file.lines.toLocaleString(lang)} ${t.pfLines}` : ""}</p>
        {cur.refused ? <p className="mt-2 text-ink2">{(t.pfRefusal as Record<string, string>)[cur.refused] ?? t.pfRefusal.UNKNOWN}</p> : (
          <>
            {cur.summary && <div className="mt-2 flex flex-wrap items-center gap-2"><PfSummary summary={cur.summary} /></div>}
            {cur.checks && <PfChecks checks={cur.checks} onCode={onCode} />}
          </>
        )}
      </div>
    </div>
  );
}

/** distinct nozzle diameters declared by every checked plate (or by the single G-code), handed to the live capture (S20) */
function nozzleOf(r: PreflightOut): number[] | null {
  const all = (r.plates?.length ? r.plates.map((p) => p.checks ?? []) : [r.checks]).flatMap((c) => nozzleFromPreflight(c) ?? []);
  return all.length ? [...new Set(all)].sort((a, b) => a - b) : null;
}

function Preflight({ onCode }: { onCode: (code: string) => void }) {
  const { t, lang } = usePrefs();
  const [res, setRes] = useState<PreflightOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr(null); setRes(null);
    try { const r = await preflight(f); setRes(r); saveGcodeNozzle(nozzleOf(r)); }
    catch (e) { setErr(e instanceof PreflightRefused ? (t.pfRefusal as Record<string, string>)[e.code] ?? t.pfRefusal.UNKNOWN : errText(t, e)); }
    finally { setBusy(false); }
  }
  const multi = res?.plates && res.plates.length > 1 ? res.plates : null;
  return (
    <div className="mt-4">
      <Panel title={t.pfTitle} i={2} active={!!res}>
        <p className="text-ink2">{t.pfSub}</p>
        <label className="btn btn-primary mt-4 w-fit cursor-pointer">
          <FlaskConical size={16} aria-hidden />{busy ? t.pfBusy : t.pfPick}
          <input type="file" accept=".gcode,.gco,.nc,.txt,.3mf,text/plain" className="sr-only" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div aria-live="polite" className="mt-4">
          {err && <StateBlock kind="error" title={t.pfRefused} body={err} />}
          {!res && !err && !busy && <p className="text-ink3">{t.pfEmpty}</p>}
          {res && (
            <>
              <div className="flex flex-wrap items-center gap-2" data-testid="pf-summary">
                {multi && res.combined && <span className="micro">{t.pfCombined}</span>}
                <PfSummary summary={multi && res.combined ? res.combined.summary : res.summary} />
                {!multi && <span className="mono text-xs text-ink3">{res.file.lines.toLocaleString(lang)} {t.pfLines}</span>}
              </div>
              {res.source?.kind === "3mf" && (
                <p className="mt-2 text-sm text-ink2" data-testid="pf-3mf">{(multi ? t.pfFrom3mfAll : t.pfFrom3mf).replace("{entry}", res.source.entry).replace("{n}", String(res.source.plates))}{res.source.settings ? ` ${t.pfSettings3mf}` : ""}</p>
              )}
              {multi ? <PfPlates plates={multi} onCode={onCode} /> : <PfChecks checks={res.checks} onCode={onCode} />}
              <ul className="mt-4 grid gap-1.5">{res.limits.map((l) => <li key={l} className="flex gap-2 text-sm"><span className="text-warn" aria-hidden>▲</span>{pfLimit(lang, l)}</li>)}</ul>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Replay lab ---------------- */
interface Run { n: number; scenario: string; hash: string; ok: boolean; count: number }
export function Replay({ onMode }: { onMode: (r: boolean) => void }) {
  const { t, lang } = usePrefs();
  const [names, setNames] = useState<string[]>([]);
  const [sel, setSel] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const alert = useCaptureAlert("replay-result");
  useEffect(() => { api.scenarios().then((s) => { setNames(s.scenarios); setSel(s.scenarios.includes("demo_extrusion_blockage") ? "demo_extrusion_blockage" : s.scenarios[0] ?? ""); }).catch((e) => setErr(errText(t, e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onMode(false); }, [sel, onMode]);
  async function run() {
    setErr(null);
    try { const r = await api.replay(sel); alert.raise(r.findings, []); setRuns((x) => [{ n: x.length + 1, scenario: sel, hash: r.findings_sha256, ok: r.matches_golden, count: r.findings.length }, ...x].slice(0, 6)); onMode(true); } catch (e) { setErr(errText(t, e)); }
  }
  const last = runs[0];
  const prev = runs.find((r, i) => i > 0 && r.scenario === last?.scenario);
  return (
    <>
      <PageTitle title={t.nav.replay} sub={t.replaySub} icon={<History size={26} />} />
      <CaptureAlert cause={alert.cause} kind="replay" onView={alert.view} onDismiss={alert.clear} />
      <div className="grid gap-d xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel title={t.scenario} i={0} active>
          <label className="grid gap-1 text-sm">{t.scenario}
            <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded-lg border border-control bg-surface2 px-3 py-2 text-ink">{names.map((n) => <option key={n} value={n}>{scenarioLabel(lang, n)}</option>)}</select>
          </label>
          <div className="mt-3"><Button variant="primary" icon={<Play size={16} />} onClick={run} disabled={!sel}>{t.runReplay}</Button></div>
          <p className="mt-3 text-xs text-ink3">{t.replayHelp}</p>
          {err && <StateBlock kind="error" title={t.error} body={err} />}
        </Panel>
        <div id="replay-result" tabIndex={-1} className="col-fill outline-none">
          {!last ? <StateBlock kind="empty" title={t.empty} body={t.replayEmpty} /> : (
            <>
              <Seal ok={last.ok} label={last.ok ? t.sameResult : t.differs} sub={`${t.replaySeal} · ${last.count} ${t.findings.toLowerCase()}`} hash={last.hash} />
              {prev && <p className="flex items-center gap-2 text-sm"><Chip tone={prev.hash === last.hash ? "ok" : "danger"}>{prev.hash === last.hash ? t.identicalPrev : t.differsPrev}</Chip></p>}
            </>
          )}
          {runs.length > 0 && (
            <Panel title={t.runs} i={1} bodyClass="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{t.runs}</caption>
              <thead className="micro"><tr><th className="px-4 py-2">#</th><th>{t.scenario}</th><th>SHA-256</th><th>{t.matches}</th></tr></thead>
              <tbody>{runs.map((r) => (<tr key={r.n} className="border-t border-line"><td className="px-4 py-2">{r.n}</td><td>{scenarioLabel(lang, r.scenario)}</td><td className="mono text-xs">{r.hash.slice(0, 16)}…</td><td><Chip tone={r.ok ? "ok" : "danger"}>{r.ok ? t.match : t.mismatch}</Chip></td></tr>))}</tbody></table></div></Panel>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- Settings / compatibility ---------------- */
const SW: Record<Theme, string[]> = { night: ["#10100e", "#161614", "#ffc400"], graphite: ["#191a1d", "#1f2023", "#ffc400"], light: ["#f4f4f0", "#fafaf7", "#ffc400"] };
/** A plain link the owner clicks: no update check, no network call from the app. */
const RELEASES_URL = "https://github.com/SirStormz/u1-doctor/releases";

export function SettingsScreen() {
  const { t, theme, setTheme, density, setDensity, lang, setLang, mode, setMode, alerts, setAlerts, restartOnboarding } = usePrefs();
  const inc = useIncident();
  return (
    <>
      <PageTitle title={t.nav.settings} sub={t.settingsSub} icon={<SettingsIcon size={26} />} />
      <div className="grid gap-d xl:grid-cols-2">
        <Panel title={t.appearance} i={0} active>
          <fieldset><legend className="micro mb-2">{t.theme}</legend>
            <div className="grid grid-cols-3 gap-3">{(Object.keys(SW) as Theme[]).map((k) => (
              <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)} className="rounded-xl border p-3 text-left" style={{ borderColor: theme === k ? "var(--accent)" : "var(--line)", boxShadow: theme === k ? "var(--glow)" : "none", background: "var(--surface-2)" }}>
                <span className="mb-2 flex h-8 overflow-hidden rounded-md border border-control" aria-hidden>{SW[k].map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</span>{t.themes[k]}
              </button>))}</div>
          </fieldset>
          <fieldset className="mt-5"><legend className="micro mb-2">{t.density}</legend>
            <div className="flex gap-2">{(["comfortable", "compact"] as Density[]).map((d) => <Button key={d} aria-pressed={density === d} variant={density === d ? "primary" : "secondary"} onClick={() => setDensity(d)}>{t.densities[d]}</Button>)}</div>
          </fieldset>
          <fieldset className="mt-5"><legend className="micro mb-2">{t.mode}</legend>
            <div className="flex gap-2">{(["simple", "expert"] as Mode[]).map((m) => <Button key={m} aria-pressed={mode === m} variant={mode === m ? "primary" : "secondary"} onClick={() => setMode(m)}>{t.modes[m]}</Button>)}</div>
            <p className="mt-2 max-w-prose text-xs text-ink3">{t.modeHelp}</p>
          </fieldset>
          <fieldset className="mt-5"><legend className="micro mb-2">{t.al.setting}</legend>
            <div className="flex gap-2">{([true, false] as const).map((on) => <Button key={String(on)} aria-pressed={alerts === on} variant={alerts === on ? "primary" : "secondary"} onClick={() => setAlerts(on)}>{on ? t.al.on : t.al.off}</Button>)}</div>
            <p className="mt-2 max-w-prose text-xs text-ink3">{t.al.help}</p>
          </fieldset>
          <fieldset className="mt-5"><legend className="micro mb-2">{t.onb.restart}</legend>
            <Button onClick={restartOnboarding}>{t.onb.restart}</Button>
            <p className="mt-2 max-w-prose text-xs text-ink3">{t.onb.restartHelp}</p>
          </fieldset>
          <fieldset className="mt-5"><legend className="micro mb-2">{t.language}</legend>
            <div className="flex gap-2">{(["en", "fr"] as const).map((l) => <Button key={l} aria-pressed={lang === l} variant={lang === l ? "primary" : "secondary"} onClick={() => setLang(l)}>{l === "en" ? "English" : "Français"}</Button>)}</div>
          </fieldset>
        </Panel>
        <Panel title={t.versions} i={1}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
            <dt className="text-ink3">{t.th.app}</dt><dd className="mono">{inc.health?.app_version ?? "…"}</dd>
            <dt className="text-ink3">{t.releases}</dt><dd><a href={RELEASES_URL} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline">{t.releasesLink}<ExternalLink size={12} aria-hidden /></a> <span className="text-xs text-ink3">{t.releasesNote}</span></dd>
            <dt className="text-ink3">{t.th.api}</dt><dd className="mono">v{inc.health?.api_version ?? "…"}</dd>
            <dt className="text-ink3">{t.th.db}</dt><dd className="mono">{inc.health?.db_schema ?? "…"}</dd>
            <dt className="text-ink3">{t.machineAccess}</dt><dd className="mono">{inc.health ? tok(lang, "access", inc.health.machine_access) : "…"}</dd>
            <dt className="text-ink3">{t.firmware}</dt><dd><Chip>{t.unknown}</Chip> <span className="text-xs text-ink3">{t.fwNote}</span></dd>
            <dt className="text-ink3">{t.retention}</dt><dd className="text-ink2">{t.retentionNote}</dd>
          </dl>
        </Panel>
        <div className="xl:col-span-2"><MaintenancePanel i={2} /></div>
        <div className="xl:col-span-2"><Panel title={t.compat} i={3} bodyClass="p-0">
          <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">{t.compat}</caption>
            <thead className="micro"><tr><th className="px-4 py-3">{t.capability}</th><th>{t.status}</th></tr></thead>
            <tbody>{inc.compat?.capabilities.map((c) => (<tr key={c.name} className="border-t border-line"><td className="px-4 py-2.5">{tx(lang, c.name)}</td><td><Chip tone={c.status === "TESTED_REAL" ? "ok" : c.status === "TESTED_SYNTHETIC" ? "demo" : "neutral"}>{tok(lang, "status", c.status)}</Chip></td></tr>))}</tbody></table></div>
          <p className="border-t border-line px-4 py-3 text-xs text-ink3">{t.compatNote}</p>
        </Panel></div>
      </div>
    </>
  );
}
