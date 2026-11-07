/** Canonical JSON (sorted keys, compact) + SHA-256 helpers. Mirrors backend `canon()`. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

export const enc = (s: string) => new TextEncoder().encode(s);

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "unavailable";
  const buf = await subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
