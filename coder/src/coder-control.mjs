// THE KEY THAT LOCKS CODER'S MACHINE'S CONTROL PANEL, made from CODER_TOKEN_KEY
// (never the key itself). Used by the Worker (worker.js) and by the deploy,
// which gives it to the Fly.io machines (2026-11-07). Pure: no Cloudflare parts.
export function controlKeySync(tokenKey) {
  // A plain, fixed mixing (no secret leaves): FNV-1a over a label and the key, 4 rounds, hex.
  let out = "";
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5 ^ round;
    for (const ch of "coder-control:" + round + ":" + tokenKey) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}
