// A site's own Worker telling the platform "a row changed on my site"
// (2026-10-27, the site Worker split, phase A).
//
// The site's Worker now saves its visitors' submissions itself. What follows a
// submission (the owner's "new submission" email, the confirmation, the text,
// the webhook) still needs keys only the platform holds, so the site's Worker
// sends a short note, signed with a key that belongs to that site alone, and
// the platform runs the follow-ups for that site and no other.
//
// THE KEY: HMAC(platform root, "site-effect:v1:" + slug). The root never leaves
// the platform; each site's script is given only its own derived key, so a
// site can sign notes about itself and nothing else.

export const EFFECT_PATH = "/api/site-effect";
export const EFFECT_SIG_HEADER = "x-gf-effect-sig";
export const EFFECT_MAX_AGE_MS = 5 * 60 * 1000;
export const EFFECT_MAX_BYTES = 64 * 1024;

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(keyBytes, text) {
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(text)));
}

/** The site's own key, as hex. "" for a missing root or slug: never a shared key. */
export async function effectKeyFor(root, slug) {
  const s = String(slug || "").toLowerCase();
  if (!root || !s) return "";
  return hmac(enc.encode(String(root)), "site-effect:v1:" + s);
}

export async function signEffect(keyHex, bodyText) {
  if (!keyHex) return "";
  return hmac(enc.encode(keyHex), String(bodyText));
}

/** Constant-time compare of two hex strings. */
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const ACTIONS = { POST: "created", PATCH: "updated", PUT: "updated", DELETE: "deleted" };

/**
 * Read and check a note. { ok: true, note } or { ok: false, status, why }.
 * The slug comes from the note and is proven by the signature: a site cannot
 * sign for another site, because it does not hold that site's key.
 */
export async function readEffect(root, bodyText, sig, now = Date.now()) {
  if (typeof bodyText !== "string" || bodyText.length > EFFECT_MAX_BYTES) return { ok: false, status: 413, why: "too large" };
  let note;
  try { note = JSON.parse(bodyText); } catch { return { ok: false, status: 400, why: "not json" }; }
  if (!note || typeof note !== "object" || Array.isArray(note)) return { ok: false, status: 400, why: "not an object" };
  const slug = typeof note.slug === "string" ? note.slug.toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) return { ok: false, status: 400, why: "slug" };
  const key = await effectKeyFor(root, slug);
  if (!key || !same(await signEffect(key, bodyText), String(sig || ""))) return { ok: false, status: 401, why: "signature" };
  const at = Number(note.at);
  if (!Number.isFinite(at) || Math.abs(now - at) > EFFECT_MAX_AGE_MS) return { ok: false, status: 401, why: "stale" };
  const action = ACTIONS[String(note.method || "").toUpperCase()];
  const path = typeof note.path === "string" ? note.path : "";
  if (!action || !/^[a-z0-9_][a-z0-9/._-]{0,79}$/i.test(path)) return { ok: false, status: 400, why: "shape" };
  return {
    ok: true,
    note: {
      slug, action, path, method: String(note.method).toUpperCase(),
      table: path.split("/")[0].toLowerCase(),
      search: typeof note.search === "string" ? note.search.slice(0, 2000) : "",
      sent: typeof note.sent === "string" ? note.sent : "",
      body: typeof note.body === "string" ? note.body : "",
    },
  };
}
