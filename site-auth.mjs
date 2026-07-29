// Visitor accounts for the sites the builder makes.
//
// These are the SITE's members — a barber shop's customers — and they are wholly
// separate from isibi's own `auth.users`, who are the people building sites. The
// design is the one that survived the D1 deletion in worker.js: PBKDF2 password
// hashing plus HMAC-signed stateless session tokens, with the signing key
// derived from a server-only secret so no new secret has to be provisioned.
//
// Everything here is pure or takes its clock as an argument, so the parts that
// are catastrophic when wrong — a token accepted for the wrong site, an expired
// session honoured, a password compared non-constant-time — are all driven
// directly in test/site-auth.test.mjs.

const enc = new TextEncoder();

// **Cloudflare Workers caps PBKDF2 at 100,000 iterations** and throws above it —
// which is how this was found: `me` returned a clean 401 while signup and login
// died with a bare Worker exception, and those two are the only ones that hash.
// OWASP would ask for more; the runtime will not give it. A per-record random
// salt and a 100k count is still a real cost per guess, and the format carries
// its own iteration count, so this rises the day the platform allows it.
export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_MAX_ITERATIONS = 100_000;
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => {
  const p = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// Length-independent comparison. The length XOR is what stops a short candidate
// matching a prefix: charCodeAt past the end is NaN, and NaN ^ x coerces to 0.
export function ctEq(a, b) {
  a = String(a); b = String(b);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// ------------------------------------------------------------- passwords

/**
 * `pbkdf2$<iterations>$<salt>$<hash>` — self-describing, so the cost can be
 * raised later without locking anyone out of an account made under the old one.
 */
export async function hashPassword(password, opts = {}) {
  // Clamped, not trusted: a caller asking for more than the runtime allows would
  // throw deep inside WebCrypto and surface as an unexplained 500.
  const iterations = Math.min(opts.iterations || PBKDF2_ITERATIONS, PBKDF2_MAX_ITERATIONS);
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${b64u(salt)}$${b64u(bits)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  // A record claiming one iteration would make itself trivially crackable, and a
  // record claiming ten million would hang the isolate. Both are refused rather
  // than honoured.
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 1_000_000) return false;
  let salt;
  try { salt = unb64u(parts[2]); } catch { return false; }
  if (!salt.length) return false;
  const again = await hashPassword(password, { iterations, salt });
  return ctEq(again, stored);
}

// ------------------------------------------------------------- sessions

/**
 * The signing key, derived per SITE.
 *
 * Per-site is the whole point: without the slug in the derivation, a token
 * minted by signing up to any site on the platform would authenticate as that
 * same visitor id on every other site — every published site sharing one
 * account space. Mixing the slug in makes a token for `cafe` meaningless
 * against `barber`.
 */
export async function sessionKey(secret, slug) {
  const material = enc.encode(String(secret || "isibi") + "|site-visitor-auth-v1|" + String(slug || "").toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

const sign = async (key, msg) => b64u(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));

/** `<payload>.<signature>` — stateless, so nothing has to be stored or revoked. */
export async function signToken(key, payload, opts = {}) {
  const now = opts.nowMs == null ? Date.now() : opts.nowMs;
  const body = { ...payload, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + (opts.ttlSec || SESSION_TTL_SEC) };
  const encoded = b64u(enc.encode(JSON.stringify(body)));
  return encoded + "." + (await sign(key, encoded));
}

/**
 * The payload, or null. Never throws — this runs on every request a logged-in
 * visitor makes, and a malformed token is an ordinary event, not an error.
 */
export async function verifyToken(key, token, opts = {}) {
  const s = String(token || "");
  const dot = s.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = s.slice(0, dot), sig = s.slice(dot + 1);
  if (!encoded || !sig) return null;
  let want;
  try { want = await sign(key, encoded); } catch { return null; }
  if (!ctEq(want, sig)) return null;
  let body;
  try { body = JSON.parse(new TextDecoder().decode(unb64u(encoded))); } catch { return null; }
  if (!body || typeof body !== "object") return null;
  const now = Math.floor((opts.nowMs == null ? Date.now() : opts.nowMs) / 1000);
  // Expiry is checked AFTER the signature, so an expired token cannot be used to
  // probe whether a given payload signs correctly.
  if (!Number.isFinite(body.exp) || body.exp <= now) return null;
  if (!body.sub) return null;
  return body;
}

// ------------------------------------------------------------- input

// Deliberately permissive: this validates shape, not deliverability. Rejecting
// a real address is a worse failure than accepting one that bounces.
export function normalizeEmail(email) {
  const e = String(email == null ? "" : email).trim().toLowerCase();
  if (e.length < 3 || e.length > 254) return null;
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) return null;
  return e;
}

/**
 * A minimum only, and a low one. Length is what actually matters, and a rule
 * that forces a symbol mostly produces `Password1!` — the cost is borne by the
 * site's customers, who did not choose this platform.
 */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;
export function checkPassword(password) {
  // A string, not "anything stringifiable". `String({})` is "[object Object]" —
  // fifteen characters, which sailed past the length floor — so a client sending
  // an object as its password would create an account whose password is a
  // constant every other such account shares. A number would work consistently
  // but is still a caller bug worth surfacing rather than coercing.
  if (typeof password !== "string") return { ok: false, error: "Enter a password." };
  const p = password;
  if (p.length < MIN_PASSWORD) return { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` };
  // Bounded because PBKDF2 cost is paid by the Worker, not the sender: an
  // unbounded password is a free way to burn CPU on a public endpoint.
  if (p.length > MAX_PASSWORD) return { ok: false, error: "That password is too long." };
  return { ok: true };
}

// A reset token is a session token with a short life and a marked purpose, so a
// link that leaks from an inbox cannot be replayed as a login.
export const RESET_TTL_SEC = 60 * 60;
export const signReset = (key, sub, opts = {}) => signToken(key, { sub, use: "reset" }, { ...opts, ttlSec: opts.ttlSec || RESET_TTL_SEC });
export async function verifyReset(key, token, opts = {}) {
  const body = await verifyToken(key, token, opts);
  return body && body.use === "reset" ? body : null;
}

// ------------------------------------------------------------- claims

/**
 * The third kind of token, and the one that belongs to nobody.
 *
 * A `collect` row — a booking, an enquiry — is written by a stranger with no
 * account who will never have one. That is the whole design of `collect`, and
 * the cost of it is that the person who made the booking could never see it
 * again, change it, or cancel it: the row has no `owner_id`, so there is no
 * principal for authorization to attach to. Only the site owner could, from
 * inside isibi. The row was never missing and the page was never missing — the
 * SUBJECT was.
 *
 * A claim token IS the subject. It carries the right to act on exactly one row,
 * of exactly one table, of exactly one site, and on nothing else — the shape
 * everybody already knows as a magic link. Three bindings, and each one is load
 * bearing:
 *
 *   - the SITE comes free, because `sessionKey` already mixes the slug in;
 *   - the TABLE is in the payload, or a claim on `bookings` 4 would open
 *     `enquiries` 4 — different table, same integer, same site;
 *   - the ROW is in the payload, or a claim on row 1 would open row 2, and ids
 *     here are sequential integers.
 *
 * Long-lived deliberately: an appointment can be months out and this link lives
 * in a confirmation email, not in a session. Bounded all the same — a token that
 * never expires is a credential nobody can ever take back.
 */
export const CLAIM_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

export const signClaim = (key, table, id, opts = {}) =>
  signToken(
    key,
    { sub: String(id), use: "claim", tbl: String(table == null ? "" : table).toLowerCase() },
    { ...opts, ttlSec: opts.ttlSec || CLAIM_TTL_SEC },
  );

/** The payload, or null. Table and row are checked, not just the signature. */
export async function verifyClaim(key, token, table, id, opts = {}) {
  const body = await verifyToken(key, token, opts);
  if (!body || body.use !== "claim") return null;
  if (body.tbl !== String(table == null ? "" : table).toLowerCase()) return null;
  // String-compared because the id arrives off a URL and the payload holds
  // whatever it was minted with. `4` and `"4"` are the same row; `"4x"` is not.
  if (String(body.sub) !== String(id == null ? "" : id)) return null;
  return body;
}

// ------------------------------------------------------------- verification

/**
 * Proving the address is theirs.
 *
 * There WAS a verification flow: `verified`, `verify_token` and `verify_exp` are
 * columns on every site's `_users`, and a `/verify` page still exists. It ran on
 * the pre-deletion D1 token scheme, whose signing key is derived differently
 * from this one — so it could not have validated a token minted by the live
 * system even if anything had minted one, and nothing did. This replaces it on
 * the family every other kind uses.
 *
 * STATELESS, so `verify_token` and `verify_exp` stay unused: a signed token
 * carries its own subject and expiry, and storing a copy only creates a second
 * thing that can disagree with the first.
 *
 * Two days, because a confirmation email is often opened on another device or
 * the next morning, and a link that died overnight sends somebody to support
 * instead of into the site. Replay is harmless — the only thing it can do is set
 * a flag that is already set.
 */
export const VERIFY_TTL_SEC = 60 * 60 * 48;
export const signVerify = (key, sub, opts = {}) =>
  signToken(key, { sub, use: "verify" }, { ...opts, ttlSec: opts.ttlSec || VERIFY_TTL_SEC });

export async function verifyVerification(key, token, opts = {}) {
  const body = await verifyToken(key, token, opts);
  return body && body.use === "verify" ? body : null;
}

// The mirror: each kind of token is good for exactly one thing.
//
// This is an ALLOW-list, and it has to be. It read `use !== "reset"` — a
// deny-list, which was correct for exactly as long as `reset` was the only other
// kind, and became wrong the moment a third one existed. A claim token is handed
// to anyone who submits a booking form; under the old rule that token would have
// authenticated as a MEMBER, because it simply wasn't a reset.
//
// `undefined` stays valid because that is what a session minted before any of
// this looks like, and signing every live member out is not an acceptable price
// for tightening a check.
export async function verifySession(key, token, opts = {}) {
  const body = await verifyToken(key, token, opts);
  return body && (body.use === undefined || body.use === "session") ? body : null;
}
