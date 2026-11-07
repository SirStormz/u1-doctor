import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { bundles, BundleRefused, type BundleImport } from "../api";
import { Button, Chip, Panel, ProvenanceChip, StateBlock } from "../components/ui";
import { tok, tx } from "../lib/dyn";
import { usePrefs } from "../lib/prefs";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; res: BundleImport } | { kind: "refused"; code: string } | { kind: "down" };

/** Import a third-party U1-DEB bundle: validated and replayed by the local service, never executed. */
export function ImportPanel() {
  const { t, lang } = usePrefs();
  const D = t.deb;
  const input = useRef<HTMLInputElement>(null);
  const [st, setSt] = useState<State>({ kind: "idle" });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setSt({ kind: "busy" });
    try { setSt({ kind: "ok", res: await bundles.import(f) }); }
    catch (e) { setSt(e instanceof BundleRefused ? { kind: "refused", code: e.code } : { kind: "down" }); }
    if (input.current) input.current.value = "";
  };

  return (
    <Panel title={D.title} icon={<FileUp size={17} />} i={3} demo={false} actions={<Chip tone="replay">{D.imported}</Chip>}>
      <p className="text-ink2">{D.note}</p>
      <div className="mt-3">
        <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" id="deb-file" aria-label={D.pick} aria-hidden tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="primary" icon={<FileUp size={16} />} onClick={() => input.current?.click()}>{D.pick}</Button>
      </div>
      {st.kind === "busy" && <div className="mt-3"><StateBlock kind="loading" title={D.checking} /></div>}
      {st.kind === "down" && <div className="mt-3"><StateBlock kind="unavailable" title={D.unavailable} /></div>}
      {st.kind === "refused" && (
        <div className="mt-3 border-2 border-danger bg-surface2 px-3 py-2" role="alert">
          <p className="font-bold">{D.refused}</p>
          <p className="text-sm text-ink2">{(D.errors as Record<string, string>)[st.code] ?? D.refused}</p>
          <p className="micro mt-1">{D.code} <span className="mono">{st.code}</span></p>
        </div>
      )}
      {st.kind === "ok" && <Accepted res={st.res} lang={lang} />}
    </Panel>
  );
}

function Accepted({ res, lang }: { res: BundleImport; lang: "fr" | "en" }) {
  const { t } = usePrefs();
  const D = t.deb;
  const r = res.replay;
  const tone = r.matches_bundle === true ? "ok" : r.matches_bundle === false ? "danger" : "warn";
  return (
    <div className="mt-3 grid gap-3" role="status">
      <p className="flex flex-wrap items-center gap-2 font-bold">{D.ok} <Chip tone="replay">{D.imported}</Chip>{res.origin_source_mix.map((m) => <ProvenanceChip key={m} status={m} />)}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-y-2 border-ink py-3 sm:grid-cols-3">
        <div><dt className="micro">{D.origin}</dt><dd className="m-0 font-extrabold">{res.origin_source_mix.map((m) => tok(lang, "provenance", m)).join(", ")}</dd></div>
        <div><dt className="micro">{D.obs}</dt><dd className="m-0 font-extrabold">{res.observation_count}</dd></div>
        <div><dt className="micro">{D.ruleset}</dt><dd className="m-0 font-extrabold">{res.ruleset.id} {res.ruleset.version} · <span className="font-normal">{res.ruleset.same_as_local ? D.sameRules : D.otherRules}</span></dd></div>
      </dl>
      <p className="flex flex-wrap items-center gap-2"><span className="micro">{D.replay}</span><Chip tone={tone}>{r.matches_bundle === null ? D.skipped : r.matches_bundle ? D.match : D.noMatch}</Chip></p>
      {res.support_checklist && (
        <p className="flex flex-wrap items-center gap-2" data-testid="deb-support"><span className="micro">{D.supportFile}</span>
          {!res.support_checklist.present ? <Chip>{D.supportAbsent}</Chip> : (
            <><Chip tone={res.support_checklist.matches_local === true ? "ok" : res.support_checklist.matches_local === false ? "warn" : "neutral"}>{res.support_checklist.matches_local === true ? D.supportSame : res.support_checklist.matches_local === false ? D.supportDiff : D.supportOther}</Chip>
              <span className="mono text-xs text-ink3">{res.support_checklist.codes.join(", ")}</span></>
          )}
        </p>
      )}
      <div>
        <h3 className="micro mb-2">{D.findings}</h3>
        {res.findings.length === 0 ? <p className="text-ink2">{D.noFindings}</p> : (
          <ul className="grid gap-2">
            {res.findings.map((f) => (<li key={f.finding_id} className="border border-line bg-surface2 px-3 py-2"><div className="mb-1 flex flex-wrap gap-2"><Chip tone="warn">{tok(lang, "classification", f.classification)}</Chip><span className="mono text-xs text-ink3">{f.rule_id}</span></div><p className="font-bold">{tx(lang, f.human_title)}</p></li>))}
          </ul>
        )}
      </div>
      <p className="text-xs text-ink3">{t.sealNote}</p>
    </div>
  );
}
