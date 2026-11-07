import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

const SESSION = { id: "h0123456789ab", label: "H-02 capture", origin: "real_capture", saved_at: "2026-11-06T12:00:00Z", observation_count: 9333, first_utc: "2026-11-05T20:00:00Z", last_utc: "2026-11-05T20:27:25Z", status_mix: ["REAL"], content_sha256: "a".repeat(64) };
let sessions: typeof SESSION[] = [];
const calls: string[] = [];

beforeEach(() => {
  sessions = [];
  calls.length = 0;
  location.hash = "#/timeline";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (url === "/api/v1/history" && method === "GET") return ok({ sessions, totals: { sessions: sessions.length, observations: sessions.reduce((n, s) => n + s.observation_count, 0) }, limits: { max_sessions: 200, max_observations: 1000000 } });
    if (url === "/api/v1/history/source") { sessions = [SESSION]; return ok({ session: SESSION, already_saved: false }); }
    if (method === "DELETE") { sessions = []; return ok({ deleted: SESSION.id }); }
    if (url.includes("/history/bundle")) return { ok: false, status: 422, json: async () => ({ detail: { code: "NOT_A_ZIP", message: "x" } }) };
    return { ok: false, status: 500, json: async () => ({}) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("history lists saved sessions, saves, and deletes only after a second click", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "History" }));
  await waitFor(() => expect(screen.getByTestId("hist-empty")).toBeTruthy());
  fireEvent.click(screen.getByText("Save the real capture (H-02)"));
  await waitFor(() => expect(screen.getByText("H-02 capture")).toBeTruthy());
  expect(screen.getByText("Saved")).toBeTruthy();
  expect(calls).toContain("POST /api/v1/history/source");
  expect(screen.getByText(/never merged/)).toBeTruthy();
  fireEvent.click(screen.getByText("Delete"));
  expect(calls.some((c) => c.startsWith("DELETE"))).toBe(false);
  fireEvent.click(screen.getByText("Confirm deletion"));
  await waitFor(() => expect(screen.getByTestId("hist-empty")).toBeTruthy());
  expect(calls.some((c) => c.startsWith("DELETE /api/v1/history/h0123456789ab"))).toBe(true);
});

test("a refused file shows a plain reason, not a raw error", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "History" }));
  await screen.findByTestId("hist-empty");
  const input = screen.getByText("Import a U1-DEB bundle").querySelector("input") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "bad.zip", { type: "application/zip" })] } });
  await waitFor(() => expect(screen.getByText("This is not a zip file.")).toBeTruthy());
});

test("a selected session shows its recomputed findings, a Dry Run one as a prediction", async () => {
  const FINDING = { finding_id: "f_1", rule_id: "U1-S15-DRYRUN-PREDICTION", rule_version: "1.0.0", classification: "SUSPECTED", human_title: "Dry Run predicts 1 firmware errors and 0 scars in the sliced file", evidence_for: [], evidence_against: [], missing_data: [], evidence_quality: "WEAK", source_mix: ["IMPORTED"], limits: ["Prediction made by simulating the sliced file, not an observation of a machine."] };
  const fetchMock = vi.mocked(fetch);
  const base = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/findings")) return { ok: true, status: 200, json: async () => ({ findings: [FINDING], ruleset: { id: "u1-starter", version: "0.3.0", hash: "x" } }) } as Response;
    if (String(url).startsWith("/api/v1/timeline")) return { ok: false, status: 500, json: async () => ({}) } as Response;
    return base(url, init);
  }) as typeof fetch);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "History" }));
  await waitFor(() => expect(screen.getByTestId("hist-empty")).toBeTruthy());
  fireEvent.click(screen.getByText("Save the real capture (H-02)"));
  await waitFor(() => expect(screen.getByTestId("hist-findings")).toBeTruthy());
  expect(screen.getByText(/Dry Run predicts 1 firmware errors/)).toBeTruthy();
  expect(screen.getByText(/not an observation of a machine/)).toBeTruthy();
});
