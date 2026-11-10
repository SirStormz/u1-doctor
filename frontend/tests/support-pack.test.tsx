import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PrefsProvider } from "../src/lib/prefs";
import { SupportPackPanel } from "../src/components/support-pack";
import { messages } from "../src/lib/i18n";

/** BACKLOG #70: the support pack panel. Network mocked; no printer is contacted. */
let calls: { url: string; body?: Record<string, unknown> }[] = [];
let status = 200;
const OUT = { name: "u1-support-pack-x.zip", password: "ABCD-EFGH-JKMN-PQRS-TUVW", bytes: 2_097_152, sha256: "a".repeat(64), created_utc: "2026-11-10T20:00:00Z",
  files: [{ name: "manifest.json", bytes: 10, sha256: "b" }, { name: "printer/system_info.json", bytes: 20, sha256: "c" }], not_collected: [{ op: "machine.proc_stats" }],
  options: { include_serial: true, redact_network: true, include_job_names: false }, mcu_versions: { mcu: "v1", "mcu e0": "v2" } };
beforeEach(() => {
  calls = []; status = 200;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return status === 200 ? ({ ok: true, status, json: async () => OUT } as Response) : ({ ok: false, status, json: async () => ({ detail: { code: "UNREACHABLE" } }) } as Response);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
const draw = () => render(<PrefsProvider><SupportPackPanel initialCode="0003-0001" /></PrefsProvider>);

test("the button stays off until a private address is typed and the approval box is ticked", () => {
  draw();
  const btn = screen.getByRole("button", { name: messages.en.pack.build });
  expect(btn).toBeDisabled();
  fireEvent.change(screen.getByLabelText(messages.en.pack.address), { target: { value: "192.168.50.20" } });
  expect(btn).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer/ }));
  expect(btn).toBeEnabled();
});

test("it sends the consent and the options, then shows the password once with the warnings", async () => {
  draw();
  fireEvent.change(screen.getByLabelText(messages.en.pack.address), { target: { value: "192.168.50.20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer/ }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: messages.en.pack.build })); });
  await waitFor(() => expect(screen.getByTestId("pack-password")).toHaveTextContent("ABCD-EFGH-JKMN-PQRS-TUVW"));
  expect(calls[0]!.url).toBe("/api/v1/support/pack");
  expect(calls[0]!.body).toMatchObject({ host: "192.168.50.20", consent: true, code: "0003-0001", include_serial: true, redact_network: true, include_job_names: false });
  expect(screen.getByText(messages.en.pack.mcuDiff)).toBeInTheDocument();
  expect(screen.getByText(/machine\.proc_stats/)).toBeInTheDocument();
  expect(screen.getByText(messages.en.pack.warn)).toBeInTheDocument();
});

test("a refused pack shows a stable message and no password", async () => {
  status = 502;
  draw();
  fireEvent.change(screen.getByLabelText(messages.en.pack.address), { target: { value: "192.168.50.20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer/ }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: messages.en.pack.build })); });
  await waitFor(() => expect(screen.getAllByRole("alert").some((e) => e.textContent?.includes(messages.en.pack.err.UNREACHABLE!))).toBe(true));
  expect(screen.queryByTestId("pack-password")).toBeNull();
});

test("French and English texts have the same shape", () => {
  expect(Object.keys(messages.fr.pack).sort()).toEqual(Object.keys(messages.en.pack).sort());
  expect(messages.fr.pack.steps).toHaveLength(messages.en.pack.steps.length);
  expect(Object.keys(messages.fr.pack.err).sort()).toEqual(Object.keys(messages.en.pack.err).sort());
});
