// WHO IS ASKING (2026-11-05): Go Farther's Supabase sign-in,
// checked by Coder's own Worker.
//
// THE EMAILED CODE, REALLY REQUIRED (the audit, 2026-11-06). Sign-in is the
// password, then a code emailed to the user, both through this Worker
// (coder-signin.mjs). But Supabase's address and its public key are in
// wrangler.jsonc, and this repository is public, so anyone could ask Supabase
// for a session straight away: with the password alone (no code), or with the
// inbox alone (an emailed code, no password). Supabase accepts those sessions
// as genuine. So a Supabase session is no longer enough here: the Worker also
// wants its own proof, which it hands out only at the end of its own two steps.
//
//   the ticket  after the password step (15 minutes): "this email gave its
//               password here", needed to send the code to /api/auth/verify
//   the proof   after the code step: "this Supabase session was made through
//               both steps here", sent with every call in the x-coder-proof
//               header. Supabase keeps a session's id when it is refreshed, so
//               the proof lasts as long as the session.
//
// Both are signed with a key made from CODER_TOKEN_KEY. Without that key no
// ticket or proof can be made or accepted, so nobody can sign in (fail closed).

const enc = new TextEncoder();
const dec = new TextDecoder();
/** How long the password step's ticket lasts. */
export const TICKET_MS = 15 * 60 * 1000;
/** The header the page sends the proof in. */
export const PROOF_HEADER = "x-coder-proof";

const b64url = (bytes) => { let s = ""; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
function unb64url(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
}

/** Two texts compared in constant time (the audit, 2026-11-06): how long the check takes never tells how much of a guess was right. */
export function sameText(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a.length || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// THE PROOF KEY: HMAC-SHA256 of a fixed label with CODER_TOKEN_KEY, so it is
// never the key itself (that one also locks the GitHub tokens). A key that is
// missing, or too short to be the real one, counts as no key.
async function proofKey(env) {
  const secret = String((env && env.CODER_TOKEN_KEY) || "");
  if (secret.length < 32) return null;
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", base, enc.encode("coder-auth-proof-v1"));
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
const mac = async (key, text) => b64url(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
/** Whether proofs can be made and checked at all (CODER_TOKEN_KEY is set). */
export async function proofReady(env) { return !!(await proofKey(env)); }

/**
 * The `session_id` claim of a Supabase access token (its middle part, base64url
 * JSON), or "". Read without checking the signature: Supabase itself checks the
 * token (authUser), or it has just handed it to the Worker (verify, refresh).
 */
export function sessionIdOf(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return "";
  try {
    const claims = JSON.parse(dec.decode(unb64url(parts[1])));
    const sid = claims && claims.session_id;
    return typeof sid === "string" && sid.length > 0 && sid.length <= 200 ? sid : "";
  } catch { return ""; }
}

/** The proof for one Supabase session, or "" when it cannot be made (no key, no session id). */
export async function proofFor(env, sessionId) {
  const key = await proofKey(env);
  if (!key || typeof sessionId !== "string" || !sessionId) return "";
  return mac(key, "session:" + sessionId);
}
/** Whether `proof` is the Worker's proof for this session. */
export async function proofOk(env, sessionId, proof) {
  if (typeof proof !== "string" || !proof) return false;
  const want = await proofFor(env, sessionId);
  return !!want && sameText(want, proof);
}

/** The password step's ticket: who gave their password here, for which code, until when. */
export async function makeTicket(env, email, type, now = Date.now()) {
  const key = await proofKey(env);
  if (!key) return "";
  const payload = b64url(enc.encode(JSON.stringify({ e: String(email), t: String(type), x: now + TICKET_MS })));
  return payload + "." + (await mac(key, "ticket:" + payload));
}
/** `{ email, type, expires }` for a genuine ticket that has not run out; null when it is forged, changed, old or malformed. */
export async function readTicket(env, ticket, now = Date.now()) {
  const m = /^([A-Za-z0-9_-]{1,2000})\.([A-Za-z0-9_-]{43})$/.exec(typeof ticket === "string" ? ticket : "");
  const key = m ? await proofKey(env) : null;
  if (!key || !sameText(await mac(key, "ticket:" + m[1]), m[2])) return null;
  let p;
  try { p = JSON.parse(dec.decode(unb64url(m[1]))); } catch { return null; }
  if (!p || typeof p.e !== "string" || (p.t !== "email" && p.t !== "signup") || !Number.isFinite(p.x) || !(now < p.x)) return null;
  return { email: p.e, type: p.t, expires: p.x };
}

/**
 * `{ id, email }` for a user signed in through both steps here. Otherwise:
 * `null` (no token, or Supabase says it is not a valid session),
 * `{ signin: true }` (a genuine Supabase session without the Worker's proof:
 * made straight with Supabase, or from before 2026-11-06), or
 * `{ down: true }` (Supabase could not be asked, so nobody is signed out for it).
 * Only `id` means signed in.
 */
export async function authUser(request, env, { fetchFn = fetch } = {}) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  let u;
  try {
    // Supabase checks the token: its signature, that it has not run out, and
    // that its session has not been ended. Only then is its session id trusted.
    const r = await fetchFn(env.SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (r.status >= 500 || r.status === 429) return { down: true };
    if (!r.ok) return null;
    u = await r.json();
  } catch { return { down: true }; }
  if (!u || typeof u.id !== "string") return null;
  // THE WORKER'S PROOF for this very session (the audit, 2026-11-06).
  if (!(await proofOk(env, sessionIdOf(token), request.headers.get(PROOF_HEADER) || ""))) return { signin: true };
  return { id: u.id, email: typeof u.email === "string" ? u.email : "" };
}
