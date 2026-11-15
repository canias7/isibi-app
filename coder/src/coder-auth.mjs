// WHO IS ASKING (2026-11-05): Go Farther's Supabase sign-in,
// checked by Coder's own Worker.
//
// SIGN-IN IS A CODE WE EMAIL, NO PASSWORD (the owner, 2026-11-15: "no
// passwords, just email codes pls"; until then the password, then the code,
// since the audit of 2026-11-06). Both steps go through this Worker
// (coder-signin.mjs). But Supabase's address and its public key are in
// wrangler.jsonc, and this repository is public, so anyone could ask Supabase
// for a session straight away: with an account's old password, or with a code
// asked from Supabase directly. Supabase accepts those sessions as genuine. So a
// Supabase session is not enough here: the Worker also wants its own proof,
// which it hands out only at the end of its own code step.
//
//   the ticket  when a code is sent (15 minutes): "a code was sent to this
//               email here", needed to send the code to /api/auth/verify
//   the proof   after the code step: "this Supabase session was made through
//               the code step here", sent with every call in the x-coder-proof
//               header. Supabase keeps a session's id when it is refreshed, so
//               the proof lasts as long as the session.
//
// Both are signed with a key made from CODER_TOKEN_KEY. Without that key no
// ticket or proof can be made or accepted, so nobody can sign in (fail closed).
// Two counts kept in the bucket close the rest (below): codes sent (5 per email
// per 15 minutes) and code checks (5 per email per 15 minutes).

const enc = new TextEncoder();
const dec = new TextDecoder();
/** How long the ticket of a sent code lasts. */
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

// WRONG CODES ARE COUNTED (the audit, 2026-11-06, after review). The emailed
// code is all that stands between anyone and an account, and a ticket can be
// used for 15 minutes. So each email gets 5 code checks per 15 minutes, counted
// before Supabase is asked, whatever the ticket; a right code clears the count
// and a new code sent does not.
// The count is changed only if nobody changed it in between (R2 checks the
// etag, If-Match, or that there is none yet, If-None-Match), so guesses sent all
// at once cannot all slip through.
/** Code checks allowed per email in CODE_WINDOW_MS. */
export const CODE_TRIES = 5;
export const CODE_WINDOW_MS = 15 * 60 * 1000;
/** Where one email's count is kept (the email itself is not in the name). */
export async function codeCountKeyOf(env, email) {
  const key = await proofKey(env);
  return key ? "coder/signin-codes/" + (await mac(key, "codes:" + email)) + ".json" : "";
}
const JSON_TYPE = { httpMetadata: { contentType: "application/json" } };
/**
 * One more of a count kept under `key` (`tries` per `windowMs`): `{ ok: true }`;
 * `{ wait }` (ms) when that many were taken in the window; `{ busy: true }`
 * when too many came at once; `{ off: true }` without a bucket or key.
 */
async function takeOne(env, key, tries, windowMs, now) {
  const bucket = env && env.CODER_BUCKET;
  if (!bucket || !key) return { off: true };
  for (let i = 0; i < 4; i++) {
    const o = await bucket.get(key);
    let c = null;
    if (o) { try { c = JSON.parse(await o.text()); } catch { c = null; } }
    const live = !!c && Number.isFinite(c.n) && Number.isFinite(c.since) && c.since > 0 && now - c.since < windowMs;
    const n = live ? c.n : 0;
    const since = live ? c.since : now;
    if (n >= tries) return { wait: Math.max(1, since + windowMs - now) };
    const onlyIf = new Headers(o ? { "if-match": o.httpEtag || '"' + o.etag + '"' } : { "if-none-match": "*" });
    let wrote;
    try { wrote = await bucket.put(key, JSON.stringify({ n: n + 1, since }), { ...JSON_TYPE, onlyIf }); }
    catch {
      // R2 refused the condition itself (2026-11-06: never tried against the live
      // bucket before shipping): count without it. The count must never be what
      // stops the owner signing in.
      await bucket.put(key, JSON.stringify({ n: n + 1, since }), JSON_TYPE).catch(() => {});
      return { ok: true };
    }
    if (wrote !== null) return { ok: true };
  }
  return { busy: true };
}
/** One code check taken for this email (CODE_TRIES per CODE_WINDOW_MS): takeOne's answer. */
export async function takeCodeTry(env, email, now = Date.now()) {
  return takeOne(env, await codeCountKeyOf(env, email), CODE_TRIES, CODE_WINDOW_MS, now);
}
// CODES SENT ARE COUNTED TOO (2026-11-15, with sign-in by code alone): each
// email gets 5 codes per 15 minutes, counted before Supabase is asked to send
// one, so nobody can flood an inbox (or Coder's emails) from the sign-in card.
// Supabase also waits a minute between two codes for the same email.
/** Codes sent per email in SEND_WINDOW_MS. */
export const SEND_TRIES = 5;
export const SEND_WINDOW_MS = 15 * 60 * 1000;
/** Where one email's count of codes sent is kept (the email itself is not in the name). */
export async function sendCountKeyOf(env, email) {
  const key = await proofKey(env);
  return key ? "coder/signin-sends/" + (await mac(key, "sends:" + email)) + ".json" : "";
}
/** One code sent to this email (SEND_TRIES per SEND_WINDOW_MS): takeOne's answer. */
export async function takeSendTry(env, email, now = Date.now()) {
  return takeOne(env, await sendCountKeyOf(env, email), SEND_TRIES, SEND_WINDOW_MS, now);
}
/** A right code: the count starts again. */
export async function clearCodeCount(env, email) {
  const key = await codeCountKeyOf(env, email);
  if (key && env.CODER_BUCKET) await env.CODER_BUCKET.put(key, JSON.stringify({ n: 0, since: 0 }), JSON_TYPE);
}

/** The ticket of a sent code: which email it was sent to here, which kind of code, until when. */
export async function makeTicket(env, email, type, now = Date.now()) {
  const key = await proofKey(env);
  if (!key) return "";
  const payload = b64url(enc.encode(JSON.stringify({ e: String(email), t: String(type), x: now + TICKET_MS })));
  return payload + "." + (await mac(key, "ticket:" + payload));
}
/** How long a ticket for the desktop app's link lasts (the page gives the app a new one while it is open). */
export const ROUTE_TICKET_MS = 12 * 60 * 60 * 1000;
/**
 * A TICKET FOR THE DESKTOP APP'S LINK TO GLOOPY'S COMPUTER (2026-11-11: routing Gloopy's browser through the owner's
 * computer): whose Gloopy, which time the switch was turned on (`ver`: turning it off makes every earlier ticket
 * worthless), until when. Signed with the proof key, like the sign-in's ticket.
 */
export async function makeRouteTicket(env, uid, ver, now = Date.now()) {
  const key = await proofKey(env);
  if (!key || typeof uid !== "string" || !uid) return "";
  const payload = b64url(enc.encode(JSON.stringify({ u: uid, v: Number.isInteger(ver) ? ver : 0, x: now + ROUTE_TICKET_MS })));
  return payload + "." + (await mac(key, "route:" + payload));
}
/** `{ uid, ver, expires }` for a genuine link ticket that has not run out; null otherwise. */
export async function readRouteTicket(env, ticket, now = Date.now()) {
  const m = /^([A-Za-z0-9_-]{1,2000})\.([A-Za-z0-9_-]{43})$/.exec(typeof ticket === "string" ? ticket : "");
  const key = m ? await proofKey(env) : null;
  if (!key || !sameText(await mac(key, "route:" + m[1]), m[2])) return null;
  let p;
  try { p = JSON.parse(dec.decode(unb64url(m[1]))); } catch { return null; }
  if (!p || typeof p.u !== "string" || !p.u || !Number.isInteger(p.v) || !Number.isFinite(p.x) || !(now < p.x)) return null;
  return { uid: p.u, ver: p.v, expires: p.x };
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
