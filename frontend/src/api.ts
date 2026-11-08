import type { PfCheck } from "./lib/preflight-text";
import type { SupportOut } from "./lib/support-text";
export interface Observation {
  observation_id: string;
  capture_utc: string;
  source_status: string;
  timestamp_quality: string;
  entity_id: string;
  mapping_quality: string;
  event_type: string;
  validity: string;
  value: unknown;
}
export interface EvidenceRef { observation_id: string; note: string }
export interface Finding {
  finding_id: string;
  rule_id: string;
  rule_version: string;
  classification: string;
  human_title: string;
  evidence_for: EvidenceRef[];
  evidence_against: EvidenceRef[];
  missing_data: string[];
  safe_actions: string[];
  limits: string[];
  references: { kind: string; url: string; checked_at: string }[];
  evidence_quality: string;
  source_mix: string[];
  not_a_root_cause?: boolean;
  hypotheses: { id: string; text: string; label: string }[];
  ruleset_id: string;
  ruleset_hash: string;
  replay_hash: string;
}
export interface Decoding {
  status: "KNOWN" | "STRUCTURE_ONLY" | "MALFORMED";
  classification: string;
  severity?: string | null;
  module?: string | null;
  reason?: string;
  entry?: { title: string; summary: string } | null;
  firmware?: FirmwareView;
}
export interface FwNote { component: string; version: string; kind: string; text: string; source: string; applies: "BEFORE" | "INCLUDED" | null }
export interface FirmwareView {
  given: string | null; valid: boolean | null; latest: { version: string; date: string; source: string } | null; behind_latest: boolean | null; notes: FwNote[];
}
export interface InterpretOut {
  decoding: Decoding;
  official_reference: string;
  catalog_verified_at: string;
  limits: string[];
}
export interface ReplayOut {
  matches_golden: boolean;
  ruleset_hash: string;
  findings_sha256: string;
  findings: Finding[];
}

// Every non-GET request carries this header: the backend refuses a POST/DELETE without it, so a web page open in the
// browser cannot drive the local API with a no-cors form or fetch (CSRF guard, see SECURITY.md).
const hdr = (contentType?: string): Record<string, string> => (contentType ? { "content-type": contentType, "x-u1d": "1" } : { "x-u1d": "1" });

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  scenarios: () => fetch("/api/v1/demo/scenarios").then(j<{ banner: string; scenarios: string[] }>),
  scenario: (n: string) => fetch(`/api/v1/demo/scenarios/${encodeURIComponent(n)}`).then(j<{ observations: Observation[] }>),
  replay: (scenario: string) =>
    fetch("/api/v1/replays", { method: "POST", headers: hdr("application/json"), body: JSON.stringify({ scenario }) }).then(j<ReplayOut>),
  interpret: (code: string, firmware?: string) =>
    fetch("/api/v1/errors/interpret", { method: "POST", headers: hdr("application/json"), body: JSON.stringify(firmware ? { code, firmware } : { code }) }).then(j<InterpretOut>),
};

export interface Capability { name: string; status: "UNTESTED" | "TESTED_SYNTHETIC" | "UNAVAILABLE" | string }
export interface L10n { en: string; fr: string }
export interface KnownIssue {
  id: string; component: string; applies: { code?: string; software?: string; version_lt?: string };
  title: L10n; symptom: L10n; cause: L10n; fix: L10n;
}
export interface KnownIssues { version: string; source_url: string; checked_at: string; issues: KnownIssue[] }
export interface Compat { verified_on_hardware: boolean; firmware_target: string; capabilities: Capability[]; rows: Record<string, string>[] }
export interface Health { status: string; api_version: string; app_version: string; mode: string; machine_access: string; db_schema: number }
export interface RealCapture {
  source_status: string; matches_golden: boolean; findings_sha256: string; input_sha256: string; observations: Observation[]; findings: Finding[];
  provenance: { date_utc: string; duration_s: number; inbound_frames: number; max_gap_between_frames_s: number; outbound_frames: number; outbound_non_subscribe: number };
}
export const api2 = {
  realCapture: (id: string) => fetch(`/api/v1/real/captures/${encodeURIComponent(id)}`).then(j<RealCapture>),
  compatibility: () => fetch("/api/v1/compatibility").then(j<Compat>),
  health: () => fetch("/api/v1/health").then(j<Health>),
};

export interface LiveOut {
  captured_utc: string; duration_s: number; inbound_frames: number; stream_dropped?: boolean; source_status: string;
  printer: { moonraker_version: string; api_version: string; klippy_state: string; klipper_software_version: string; printer_state: string; object_count: number };
  audit: { http: { method: string; path: string; allowed: boolean; status: number | null }[]; websocket_frames_sent: number; read_operations: number; non_read_operations: number };
  observations: Observation[]; findings: Finding[];
  session: { id: string; label: string } | null; already_saved?: boolean;
}
export class LiveRefused extends Error { constructor(public code: string) { super(code); } }
export const liveApi = {
  capture: async (host: string, seconds: number, save: boolean): Promise<LiveOut> => {
    const r = await fetch("/api/v1/live/capture", { method: "POST", headers: hdr("application/json"), body: JSON.stringify({ host, consent: true, seconds, save }) });
    if (r.status >= 400 && r.status < 600 && r.status !== 500) {
      const b = (await r.json().catch(() => ({}))) as { detail?: { code?: string } };
      throw new LiveRefused(b.detail?.code ?? "UNKNOWN");
    }
    return j<LiveOut>(r);
  },
};

export interface BundleFile { name: string; sha256: string; bytes: number }
export interface BundlePreview { manifest: { files: BundleFile[]; source_mix: string[] }; privacy: Record<string, unknown> }
export interface BundleImport {
  source_status: string; origin_source_mix: string[]; observation_count: number; findings: Finding[]; findings_are_recomputed: boolean; limits: string[];
  ruleset: { id: string; version: string; same_as_local: boolean }; replay: { performed: boolean; matches_bundle: boolean | null };
  support_checklist?: { present: boolean; codes: string[]; matches_local: boolean | null };
}
export class BundleRefused extends Error { constructor(public code: string) { super(code); } }
const post = (url: string, source: string) => fetch(url, { method: "POST", headers: hdr("application/json"), body: JSON.stringify({ source }) });
export const bundles = {
  preview: (source: string) => post("/api/v1/bundles/preview", source).then(j<BundlePreview>),
  export: async (source: string) => { const r = await post("/api/v1/bundles/export", source); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); },
  import: async (data: Blob): Promise<BundleImport> => {
    const r = await fetch("/api/v1/bundles/import", { method: "POST", headers: hdr("application/zip"), body: data });
    if (r.status === 422) { const b = (await r.json()) as { detail?: { code?: string } }; throw new BundleRefused(b.detail?.code ?? "UNKNOWN"); }
    return j<BundleImport>(r);
  },
};

export const knownIssues = () => fetch("/api/v1/knowledge/known-issues").then(j<KnownIssues>);
export const supportChecklist = (code: string, firmware?: string) =>
  fetch("/api/v1/support/checklist", { method: "POST", headers: hdr("application/json"), body: JSON.stringify(firmware ? { code, firmware } : { code }) }).then(j<SupportOut>);

export interface PreflightOut {
  file: { bytes: number; lines: number; name_provided: boolean }; slicer: { name: string | null; version: string | null };
  checks: PfCheck[]; summary: Record<"FAIL" | "WARN" | "PASS" | "INFO" | "UNKNOWN", number>; limits: string[];
}
export class PreflightRefused extends Error { constructor(public code: string) { super(code); } }
export const preflight = async (file: File): Promise<PreflightOut> => {
  const r = await fetch(`/api/v1/preflight/gcode?name=${encodeURIComponent(file.name.slice(0, 255))}`, { method: "POST", headers: hdr("text/plain"), body: file });
  if (r.status === 422) { const b = (await r.json()) as { detail?: { code?: string } }; throw new PreflightRefused(b.detail?.code ?? "UNKNOWN"); }
  return j<PreflightOut>(r);
};

export interface HistorySession {
  id: string; label: string; origin: "synthetic" | "real_capture" | "bundle" | "dryrun"; saved_at: string; observation_count: number;
  first_utc: string; last_utc: string; status_mix: string[]; content_sha256: string;
}
export interface HistoryList { sessions: HistorySession[]; totals: { sessions: number; observations: number }; limits: { max_sessions: number; max_observations: number } }
export class HistoryRefused extends Error { constructor(public code: string) { super(code); } }
type Saved = { session: HistorySession; already_saved: boolean };
async function saved(r: Response): Promise<Saved> {
  if (r.status === 422 || r.status === 409) { const b = (await r.json()) as { detail?: { code?: string } }; throw new HistoryRefused(b.detail?.code ?? "UNKNOWN"); }
  return j<Saved>(r);
}
export const historyApi = {
  list: () => fetch("/api/v1/history").then(j<HistoryList>),
  saveSource: (source: string, label?: string) => fetch("/api/v1/history/source", { method: "POST", headers: hdr("application/json"), body: JSON.stringify(label ? { source, label } : { source }) }).then(saved),
  saveBundle: (f: File) => fetch(`/api/v1/history/bundle?label=${encodeURIComponent(f.name.slice(0, 80))}`, { method: "POST", headers: hdr("application/zip"), body: f }).then(saved),
  saveDryrun: (f: File) => fetch(`/api/v1/history/dryrun?label=${encodeURIComponent(f.name.slice(0, 80))}`, { method: "POST", headers: hdr("application/json"), body: f }).then(saved),
  observations: (id: string) => fetch(`/api/v1/history/${encodeURIComponent(id)}/observations`).then(j<{ observations: Observation[] }>),
  findings: (id: string) => fetch(`/api/v1/history/${encodeURIComponent(id)}/findings`).then(j<{ findings: Finding[]; ruleset: { id: string; version: string; hash: string } }>),
  remove: (id: string) => fetch(`/api/v1/history/${encodeURIComponent(id)}`, { method: "DELETE", headers: hdr() }).then(j<{ deleted: string }>),
};

export interface TimelineEntry {
  t_utc: string; last_utc: string; ids: string[]; event_type: string; entity_id: string; mapping_quality: string; timestamp_quality: string;
  source_status: string; validity: string; summary: unknown; repeat: number;
}
export interface Timeline {
  source_status: string; observation_count: number; integrity: "NO_GAP_RECORDED" | "GAPS_RECORDED" | "DEGRADED_DATA";
  observed_window: { start_utc: string; end_utc: string; duration_s: number };
  sessions: { session_id: string; observations: number }[];
  gaps: { start_utc: string; end_utc: string; duration_s: number }[];
  phases: { state: string; start_utc: string; end_utc: string; duration_s: number; ended_by_transition: boolean }[];
  incident: { state: string; t_utc: string; entries_before: number; entries_after: number } | null;
  entries: TimelineEntry[];
}
export const timelineApi = { get: (source: string) => fetch(`/api/v1/timeline?source=${encodeURIComponent(source)}`).then(j<Timeline>) };

export interface SymptomEntry { id: string; page: string; title: L10n; eyes: L10n; ask: string[]; cause_count: number }
export interface SymptomCatalog {
  version: string; checked_at: string; wiki_base: string; note: string;
  materials: Record<string, { nozzle: number[]; bed: number[]; dry?: string; saturate?: L10n }>;
  fields: { numeric: Record<string, number[]>; choices: Record<string, string[]> };
  symptoms: SymptomEntry[];
}
export interface SymptomEvidence { direction: "for" | "against" | "unclear" | "info"; text: L10n; source: string }
export interface SymptomCause { id: string; text: L10n; eyes: boolean; evidence: SymptomEvidence[]; lean: "FOR" | "AGAINST" | "MIXED" | "NONE" }
export interface SymptomResult {
  symptom: { id: string; title: L10n; eyes: L10n; page: string; url: string };
  answers: Record<string, string | number>; observed: { bed: { n: number; max: number; statuses: string[] } | null; nozzle: { n: number; max: number; statuses: string[] } | null };
  causes: SymptomCause[]; notes: string[]; catalog_checked_at: string;
}
export class SymptomRefused extends Error { constructor(public code: string, public detail: string) { super(code); } }
export const symptomsApi = {
  catalog: () => fetch("/api/v1/knowledge/symptoms").then(j<SymptomCatalog>),
  evaluate: async (symptom: string, answers: Record<string, string | number>, session?: string): Promise<SymptomResult> => {
    const r = await fetch("/api/v1/symptoms/evaluate", { method: "POST", headers: hdr("application/json"), body: JSON.stringify(session ? { symptom, answers, session } : { symptom, answers }) });
    if (r.status === 422) { const b = (await r.json()) as { detail?: { code?: string; message?: string } }; throw new SymptomRefused(b.detail?.code ?? "UNKNOWN", b.detail?.message ?? ""); }
    return j<SymptomResult>(r);
  },
};
