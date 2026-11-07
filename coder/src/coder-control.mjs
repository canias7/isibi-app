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

/**
 * EACH CHAT'S MACHINE ITS OWN LOCK KEY (owner, 2026-11-07, step 2 of: the Grok
 * key out, each machine its own lock key, a sealed network room, the master
 * key inside it). On Fly.io a machine can be reached through Fly's front door,
 * so one key for all of them meant a chat that read its own (with the master
 * key, later) could work another chat's machine. This key is an HMAC of the
 * machine's Fly name under CODER_TOKEN_KEY: knowing one machine's key gives
 * nothing for another's. Cloudflare's backup machines cannot be reached from
 * outside, and keep controlKeySync.
 */
export async function controlKeyFor(tokenKey, machine) {
  const raw = String(tokenKey || "");
  if (!raw) return "";
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-control-v2|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("machine:" + String(machine))));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}
