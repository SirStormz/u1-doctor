import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FilePlus2, FileText, ShieldCheck, X, Check } from "lucide-react";
import { Button, Chip, Panel, StateBlock } from "../components/ui";
import { PageTitle, useToast } from "../components/shell";
import { bundles } from "../api";
import { canon } from "../lib/canon";
import { DEMO_SCENARIO, tms, useIncident } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { tok, tx } from "../lib/dyn";
import { ImportPanel } from "./deb";

interface FileRow { name: string; sha?: string; bytes?: number }

const SCANS: [string, RegExp][] = [
  ["ip", /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
  ["serial", /\b(?:serial|sn)[":= ]+\w{6,}/i],
  ["ssid", /ssid/i],
  ["file", /\.(?:gcode|3mf|stl)\b/i],
  ["token", /(?:api[_-]?key|token|bearer|password)["']?\s*[:=]/i],
  ["path", /[A-Za-z]:\\|\/home\/|\/Users\//],
];

export function Report() {
  const { t, lang } = usePrefs();
  const inc = useIncident();
  const toast = useToast();
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [privacyJson, setPrivacyJson] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const source = `synthetic:${DEMO_SCENARIO}`;

  const built = useMemo(() => {
    if (inc.status !== "ready") return null;
    const obsSorted = [...inc.obs].sort((a, b) => tms(a) - tms(b) || a.observation_id.localeCompare(b.observation_id));
    const haystack = obsSorted.map((o) => canon(o)).join(String.fromCharCode(10)) + canon(inc.findings);
    const scan = SCANS.map(([k, re]) => [k, (haystack.match(new RegExp(re, re.flags + "g")) ?? []).length] as const);
    return { scan };
  }, [inc.status, inc.obs, inc.findings]);

  useEffect(() => {
    let live = true;
    bundles.preview(source).then((p) => {
      if (!live) return;
      setFiles([{ name: "manifest.json" }, ...p.manifest.files.map((f) => ({ name: f.name, sha: f.sha256, bytes: f.bytes }))]);
      setPrivacyJson(JSON.stringify(p.privacy, null, 2));
    }).catch(() => { if (live) setFiles([]); });
    return () => { live = false; };
  }, [source]);

  if (inc.status !== "ready") return <StateBlock kind={inc.status === "error" ? "error" : "loading"} title={inc.status === "error" ? t.error : t.loading} body={inc.error} />;
  const clean = built ? built.scan.every(([, n]) => n === 0) : false;
  const title = inc.decoding?.decoding.entry?.title ? tx(lang, inc.decoding.decoding.entry.title) : t.nav.report;

  const doExport = async () => {
    try {
      const url = URL.createObjectURL(await bundles.export(source));
      const a = document.createElement("a");
      a.href = url; a.download = `u1-deb-synthetic-${DEMO_SCENARIO}.zip`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t.exported);
    } catch { toast(t.error); }
  };

  const redacted: [string, string][] = [["IP", t.fIp], [lang === "fr" ? "SÉRIE" : "SERIAL", t.fSerial], ["SSID", t.fSsid], [lang === "fr" ? "FICHIER" : "FILE NAME", t.fFile]];
  return (
    <>
      <PageTitle title={t.nav.report} sub={t.reportSub} icon={<FileText size={26} />} />
      <div className="grid gap-d xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_340px]">
        <Panel title={t.docPreview} icon={<Eye size={17} />} i={0} className="blueprint" actions={<Chip tone="demo">{tok(lang, "provenance", "SYNTHETIC")}</Chip>}>
          <article className="paper p-5" aria-label={t.docPreview}>
            <p className="micro">{t.reportKicker}</p>
            <h3 className="mt-1 text-lg font-bold">{title}</h3>
            <p className="mono mt-1 text-xs text-ink3">{inc.code} · {t.userDeclared}</p>
            <ul className="mt-4 grid gap-2 text-sm">
              {inc.findings.map((f) => <li key={f.finding_id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2"><span className="mono shrink-0 text-xs text-accent sm:w-52">{f.rule_id}</span><span>{tx(lang, f.human_title.replace(/^SYNTHETIC: /, ""))} <span className="text-ink3">— {tok(lang, "classification", f.classification)}</span></span></li>)}
            </ul>
            <h4 className="micro mt-5">{t.redactedPreview}</h4>
            <dl className="mt-2 grid gap-2 text-sm">
              {redacted.map(([tag, label]) => (<div key={tag} className="flex items-center gap-3"><dt className="mono w-24 text-xs text-ink3">{tag}</dt><dd className="flex items-center gap-2"><span className="redact" role="img" aria-label={t.redactedAria.replace("{f}", label)} /><span className="text-xs text-ink3">{label}</span></dd></div>))}
            </dl>
            <p className="mt-3 text-xs text-ink3">{t.redactNote}</p>
          </article>
        </Panel>

        <Panel title={t.bundle} icon={<FilePlus2 size={17} />} i={1} active>
          {!files ? <StateBlock kind="loading" title={t.hashing} /> : (
            <ul className="grid gap-2">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-3 rounded-lg border border-line bg-surface2 px-3 py-2">
                  <Check size={16} className="shrink-0 text-ok" aria-hidden />
                  <span className="font-medium">{f.name}</span>
                  <span className="ml-auto text-right"><span className="mono block text-xs text-ink2" title={f.sha}>{f.sha ? `${f.sha.slice(0, 12)}…` : "—"}</span><span className="text-xs text-ink3">{f.bytes !== undefined ? `${f.bytes} B` : ""}</span></span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink3">{t.bundleNote}</p>
        </Panel>

        <div className="col-fill">
          <Panel title={t.privacy} icon={<ShieldCheck size={17} />} i={2}>
            <ul className="grid gap-2" aria-label={t.privacy}>
              {built?.scan.map(([k, n]) => (
                <li key={k} className="flex items-center gap-2">
                  {n === 0 ? <Check size={16} className="text-ok" aria-hidden /> : <X size={16} className="text-danger" aria-hidden />}
                  <span>{t.scan[k as keyof typeof t.scan]}</span><span className="mono ml-auto text-xs text-ink3">{n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink3">{t.scanNote}</p>
            <div className="mt-4 grid gap-2">
              <Button variant="primary" disabled={!files?.length || !clean} onClick={doExport} icon={<Download size={16} />}>{t.exportBundle}</Button>
              <Button onClick={() => setPreviewOpen((x) => !x)} icon={<Eye size={16} />} aria-expanded={previewOpen}>{t.preview}</Button>
            </div>
            <p className="mt-3 text-xs text-ink3">{t.sealNote}</p>
          </Panel>
          {previewOpen && privacyJson && <Panel title="privacy-report.json" i={0}><pre className="mono max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-ink2">{privacyJson}</pre></Panel>}
        </div>
      </div>
      <div className="mt-4"><ImportPanel /></div>
    </>
  );
}
