// One submission, once — however many times the button was pressed.
//
// THE GAP. A visitor double-clicks "Book", or their phone loses signal after
// the POST left and they press it again, and the site's `collect` table holds
// two bookings; a "Pay" pressed twice opens two Stripe sessions. Nothing on
// the platform could tell the second press from a second customer, because the
// two requests are byte-identical.
//
// THE MECHANISM, and it is the one every payment API uses: the PAGE mints a
// random key per submission and sends it in a header; the Worker remembers the
// answer it gave under that key for ten minutes and hands the SAME answer back
// to a repeat, without touching the database again. The page renews the key
// only after a success, so "fix the field and press again" after a refusal is
// a new attempt with the SAME key — which is exactly right, because the refusal
// was never stored (only a 2xx is) and the corrected request must reach
// Postgres.
//
// TWO LAYERS OF MEMORY, and the honest limits of each. The in-isolate map
// catches the case that actually happens — a double-click lands both requests
// on the same edge within a second, before KV could have been read back — and
// it can only do that because a miss CLAIMS the key (audit A30-4): the answer
// is stored only once the upstream has answered, so without the claim the
// second press, arriving while the first is still in flight, read nothing and
// wrote too. Now it waits for the first press's answer and is handed it; a
// first press that is refused or fails releases the claim, and the second goes
// through on its own. KV (`SITE_API_CACHE`, the same namespace the API cache uses)
// carries the answer across isolates and across the ten minutes; it is
// eventually consistent, so two presses a few seconds apart routed to
// DIFFERENT isolates can both reach Postgres. That window is small and named
// rather than papered over: a table that declares `unique` still refuses the
// second copy by name, and a `noOverlap` booking still refuses the second slot.
//
// DEPENDENCY-FREE: the decisions are tested without KV or a Worker. The Worker
// passes `get`/`put` over its namespace; a site with no KV bound keeps the
// in-isolate layer alone, which is still the layer that catches the click.
//
// THE KEY IS TIED TO WHAT WAS SENT (audit A30-5). The page keeps its key until
// it sees a success, so after an answer lost on the way back the NEXT press —
// perhaps another time slot, a fixed phone number — carries the same key. A
// stored answer is handed back only to a request with the same contents
// (`fp`, `idemFingerprint`); a changed one is a new submission and reaches the
// database.
//
// WHY NOT A DATABASE UNIQUE ON THE KEY: the key is not a column any site
// declared, and the page's rows must not carry one — the same reasoning that
// strips the Turnstile field before PostgREST sees it.

import { TOKEN_FIELD } from "./site-turnstile.mjs";

/** The request header, as every payment API spells it. Read case-insensitively. */
export const IDEM_HEADER = "idempotency-key";
/** How long an answer is remembered. Long enough for a stalled phone; short
 *  enough that the same key can never be confused with a next-day submission. */
export const IDEM_TTL_S = 600;
/** An answer bigger than this is not remembered — a list read has no business
 *  here, and KV values cost by size. A created row is a few hundred bytes. */
export const IDEM_MAX_BODY = 64 * 1024;
/** What a key may look like. Long enough to be unguessable when the page
 *  mints it from `crypto.randomUUID()`; bounded so a header cannot be a KV key
 *  of arbitrary length. */
export const IDEM_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
/** The mark on a replayed answer, so a page or a test can tell it apart. */
export const IDEM_REPLAY_HEADER = "x-idempotent-replay";

/**
 * The key a request carries, or null. Anything that is not exactly a key is
 * treated as no key at all — a malformed header must not become a shared
 * bucket every request falls into.
 */
export function takeIdemKey(headers) {
  const raw = headers && typeof headers.get === "function" ? headers.get(IDEM_HEADER) : null;
  return typeof raw === "string" && IDEM_KEY_RE.test(raw) ? raw : null;
}

/**
 * The stored id. Scoped by SITE and by what was submitted to (the table, or
 * `checkout`), so a key reused across two forms on one site — a page that
 * forgot to renew — cannot hand the second form the first form's answer.
 */
export function idemId(slug, scope, key) {
  return `idem:${String(slug).toLowerCase()}:${String(scope).toLowerCase()}:${key}`;
}

/**
 * Is this an answer worth remembering? Only a success: a refusal replayed
 * would refuse the CORRECTED retry, which arrives under the same key.
 */
export function idemStorable(status, body) {
  const n = Number(status);
  if (!(n >= 200 && n < 300)) return false;
  return String(body == null ? "" : body).length <= IDEM_MAX_BODY;
}

/**
 * What a submission says, as a short digest: the body with the spam check's
 * single-use token taken out, because a retry carries a fresh token and the
 * same contents. A body that is not one JSON object is digested as sent.
 */
export async function idemFingerprint(sent) {
  let text = String(sent == null ? "" : sent);
  try {
    const o = JSON.parse(text);
    if (o && typeof o === "object" && !Array.isArray(o) && Object.hasOwn(o, TOKEN_FIELD)) { delete o[TOKEN_FIELD]; text = JSON.stringify(o); }
  } catch { /* not JSON: as sent */ }
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(d.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The headers a replayed answer carries. */
export function replayHeaders(stored) {
  return {
    "content-type": (stored && stored.ct) || "application/json",
    [IDEM_REPLAY_HEADER]: "1",
  };
}

/**
 * The store. One per Worker isolate, holding the in-memory layer; `get`/`put`
 * reach the shared layer and are optional.
 *
 *   get(id)           → stored value | null   (may throw; a throw is a miss)
 *   put(id, v, ttlS)  → void                  (may throw; a throw is silent)
 *
 * `for(slug, scope, key, io)` answers `{ id, read(), write(v), release() }`;
 * `io` may override `get`/`put` per call, which is how the Worker binds a
 * per-request `env` to a store that outlives the request, and may carry `fp`,
 * the submission's digest: an answer stored for other contents is a miss.
 * A miss claims the key in this isolate until `write` or `release`, and a
 * second `read` meanwhile waits for it; the caller releases in a `finally`.
 */
export function makeIdem({ get = null, put = null, now = Date.now, ttl = IDEM_TTL_S, maxMemory = 2000 } = {}) {
  const memory = new Map();
  /** id → { fp, done: Promise, settle() }: a press still waiting on the upstream. */
  const pending = new Map();
  const sweep = () => {
    if (memory.size <= maxMemory) return;
    const t = now();
    for (const [k, e] of memory) if (e.until <= t) memory.delete(k);
    // Still over after dropping the expired: forget the oldest. A forgotten
    // entry costs one possible duplicate, never a lost submission.
    while (memory.size > maxMemory) memory.delete(memory.keys().next().value);
  };
  const shaped = (v) => !!(v && typeof v === "object" && Number.isInteger(v.status) && typeof v.body === "string");
  return {
    for(slug, scope, key, io = {}) {
      const id = idemId(slug, scope, key);
      const g = io.get !== undefined ? io.get : get;
      const p = io.put !== undefined ? io.put : put;
      const fp = typeof io.fp === "string" && io.fp ? io.fp : null;
      // The same contents, or a caller that sent none to compare.
      const same = (v) => !fp || v.fp === fp;
      let mine = null;
      const release = () => { if (mine && pending.get(id) === mine) pending.delete(id); if (mine) mine.settle(); mine = null; };
      return {
        id,
        async read() {
          // ANOTHER PRESS OF THE SAME SUBMISSION IS STILL UPSTREAM: wait for it.
          for (let w = pending.get(id); w && w !== mine; w = pending.get(id)) {
            if (w.fp !== fp) break;
            await w.done;
          }
          const e = memory.get(id);
          if (e && e.until > now() && same(e.v)) return e.v;
          if (e && e.until <= now()) memory.delete(id);
          // A MISS CLAIMS THE KEY, before the shared layer is asked.
          if (!mine) {
            let settle;
            const done = new Promise((r) => { settle = r; });
            mine = { fp, done, settle };
            pending.set(id, mine);
          }
          if (!g) return null;
          let v = null;
          try { v = await g(id); } catch { v = null; }
          if (!shaped(v) || !same(v)) return null;
          // Warm the isolate for the next press. The remaining shared window
          // is unknown here, so the local copy takes the full one; being
          // remembered a little longer costs nothing a duplicate would not.
          memory.set(id, { v, until: now() + ttl * 1000 });
          release();
          return v;
        },
        async write(v) {
          if (!shaped(v) || !idemStorable(v.status, v.body)) return false;
          if (fp) v = { ...v, fp };
          memory.set(id, { v, until: now() + ttl * 1000 });
          release();
          sweep();
          if (p) { try { await p(id, v, ttl); } catch { /* the in-isolate layer still holds it */ } }
          return true;
        },
        release,
      };
    },
    size: () => memory.size,
  };
}
