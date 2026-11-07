/** Minimal ZIP writer (stored, no compression, fixed timestamps => deterministic). Prototype only. */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLE[(c ^ d[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function createZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 255, (v >> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = new TextEncoder().encode(f.name);
    const crc = crc32(f.data);
    const local = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(DATE), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...name]);
    chunks.push(local, f.data);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(DATE), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}
