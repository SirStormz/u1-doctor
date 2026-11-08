import { afterEach, expect, test, vi } from "vitest";
import { api, bundles, historyApi, liveApi, preflight, supportChecklist, symptomsApi } from "../src/api";

// The backend refuses every non-GET request without the app header (CSRF guard): each one must send it.
afterEach(() => vi.unstubAllGlobals());

test("every non-GET request carries the x-u1d header", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }));
  const file = new File(["x"], "a.zip");
  await api.replay("s");
  await api.interpret("0002-0525-0002-0002");
  await liveApi.capture("192.168.1.2", 3, false);
  await bundles.preview("synthetic:s");
  await bundles.import(file);
  await supportChecklist("0002-0525-0002-0002");
  await preflight(file);
  await historyApi.saveSource("synthetic:s");
  await historyApi.saveBundle(file);
  await historyApi.saveDryrun(file);
  await historyApi.remove("h000000000000");
  await symptomsApi.evaluate("s", {});
  expect(calls).toHaveLength(12);
  for (const c of calls) {
    expect(c.method === "POST" || c.method === "DELETE").toBe(true);
    expect((c.headers as Record<string, string>)["x-u1d"]).toBe("1");
  }
});
