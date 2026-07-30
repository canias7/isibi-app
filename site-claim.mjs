// The person who filled in the form, coming back.
//
// `collect` is write-only by design: anyone may submit, nobody may read, because
// the rows are other visitors' submissions and listing them would hand a
// stranger every booking the shop has taken. That refusal is right, and it is
// also why — measured across every site the builder has made — a customer who
// booked a haircut could never see the appointment again, move it, or cancel it.
// The only person who could was the shop owner, inside isibi.
//
// This is the narrow exception, and it is narrow in a specific way: a claim
// token names ONE row. Holding it proves you are the person who wrote that row,
// because it was handed back only in the response to that insert. It buys the
// right to read that row and to cancel it, and it buys nothing else — no list,
// no filter, no ordering, no neighbouring id. There is deliberately no way to
// widen it, which is what keeps `collect` write-only for everyone else.
//
// Decisions only. Every side effect is injected, so all of this is driven
// against fakes in test/site-claim.test.mjs — no database, no Worker, no clock.
//
// The token layer below used to live in `site-auth.mjs`, which was deleted on
// 2026-07-30 when identity moved to Neon Auth. Claim tokens do NOT depend on
// identity — the whole point of one is that the holder has no account anywhere —
// so they outlived it, and they are the last remaining kind. That is worth
// noting rather than glossing: `verifySession` was once a DENY-list (`use !==
// "reset"`) and broke the moment a third kind existed. With one kind left there
// is nothing to confuse a claim WITH, so `verifyClaim`'s exact `use === "claim"`
// is the whole check, and the class of bug goes away with the kinds.

const enc = new TextEncoder();

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

/**
 * The per-site signing key.
 *
 * Per-site is the whole point: without the slug in the derivation, a token
 * minted against any site on the platform would verify on every other one.
 * Mixing the slug in makes a claim for `cafe` meaningless against `barber`.
 *
 * The derivation string is UNCHANGED from site-auth.mjs on purpose — claim links
 * live in confirmation emails for 90 days, and altering it would silently
 * invalidate every one already sent.
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
  const body = { ...payload, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + (opts.ttlSec || CLAIM_TTL_SEC) };
  const encoded = b64u(enc.encode(JSON.stringify(body)));
  return encoded + "." + (await sign(key, encoded));
}

/**
 * The payload, or null. Never throws — a malformed token is an ordinary event on
 * a public endpoint, not an error.
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

/**
 * Long-lived deliberately: an appointment can be months out and this link lives
 * in a confirmation email, not in a session. Bounded all the same — a token that
 * never expires is a credential nobody can ever take back.
 */
export const CLAIM_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

/**
 * Three bindings, and each one is load bearing:
 *
 *   - the SITE comes free, because `sessionKey` already mixes the slug in;
 *   - the TABLE is in the payload, or a claim on `bookings` 4 would open
 *     `enquiries` 4 — different table, same integer, same site;
 *   - the ROW is in the payload, or a claim on row 1 would open row 2, and ids
 *     here are sequential integers.
 */
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

const json = (body, status = 200) => ({ body, status });

/**
 * Which tables a claim applies to.
 *
 * `collect` only, and the exclusions are each for a different reason:
 *   - `display` rows are the owner's own content, not anybody's submission;
 *   - `user` / `feed` / `admin` rows already HAVE an owner, so their author
 *     signs in and the ordinary owner-scoping applies. Minting a second,
 *     weaker credential for a row that already has a real one would be a way
 *     around the account, not a way in.
 */
export function claimable(def) {
  return String((def && def.access) || "collect").toLowerCase() === "collect";
}

/**
 * What the holder is shown.
 *
 * Their own submission, minus the two columns that are ours rather than theirs:
 * `_fts` is a generated search vector (meaningless to a client and often bigger
 * than the text it was built from) and `owner_id` is an internal id that is
 * always null on a `collect` row anyway. Everything else declared on the table
 * is returned, including anything the owner has since changed — a `status` that
 * now reads "confirmed" is precisely what the person wants to see.
 */
export function claimView(row) {
  if (!row || typeof row !== "object") return null;
  const out = {};
  for (const k of Object.keys(row)) {
    if (k === "_fts" || k === "owner_id") continue;
    out[k] = row[k];
  }
  return out;
}

/**
 * deps:
 *   verify(token, table, id) → payload | null    the HMAC check, key already bound to the site
 *   selectRow(table, id)     → row | null
 *   cancelRow(table, id)     → { changes }       soft-delete if the table declares trash
 */
export async function handleClaim(deps, { def, id, token, method } = {}) {
  // Not a claimable table. 404 rather than 403: a claim on a table that never
  // mints them is indistinguishable from a claim on a table that does not
  // exist, and saying which is which describes the site's schema to a stranger.
  if (!claimable(def)) return json({ error: "no such row" }, 404);

  // A positive integer, because it reaches SQL and because the id column is
  // `INTEGER GENERATED BY DEFAULT AS IDENTITY`. Refused here rather than
  // surfacing as a Postgres type error dressed up as a 500.
  if (!/^\d+$/.test(String(id == null ? "" : id))) return json({ error: "no such row" }, 404);

  const ok = await deps.verify(token, def.name, id);
  // The same answer as a row that is not there. A distinct "bad token" would
  // confirm the row exists to anyone guessing ids, which is exactly the oracle
  // the 404-not-403 rule closes everywhere else in this codebase.
  if (!ok) return json({ error: "no such row" }, 404);

  if (method === "GET") {
    const row = await deps.selectRow(def.name, id);
    if (!row) return json({ error: "no such row" }, 404);
    return json({ row: claimView(row) });
  }

  if (method === "DELETE") {
    const r = await deps.cancelRow(def.name, id);
    // Idempotent, and answering `ok` even when nothing changed is the point. A
    // cancel link gets clicked twice, gets prefetched, gets opened again to
    // check it worked. The holder proved with a valid token that this row was
    // theirs, so "it is not booked any more" tells them nothing they did not
    // already know — and a 404 on the second click reads as a broken link.
    return json({ ok: true, cancelled: true, changed: !!(r && r.changes) });
  }

  // Amending is not here yet, and 405 says so honestly rather than pretending
  // the row is missing. It is a real follow-up: the writable-column filter and
  // the constraint-error mapping both already exist, but a changed booking has
  // to re-run the uniqueness and overlap checks and deserves its own tests.
  return json({ error: "method not allowed" }, 405);
}

/** The one place that knows the query-string name, so nothing spells it twice. */
export const CLAIM_PARAM = "claim";
