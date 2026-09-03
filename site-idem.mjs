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
// TWO LAYERS OF MEMORY, and the honest limits of each. The in-isolate map is
// synchronous and catches the case that actually happens — a double-click
// lands both requests on the same edge within a second, before KV could have
// been read back. KV (`SITE_API_CACHE`, the same namespace the API cache uses)
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
// WHY NOT A DATABASE UNIQUE ON THE KEY: the key is not a column any site
// declared, and the page's rows must not carry one — the same reasoning that
// strips the Turnstile field before PostgREST sees it.

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
 * `for(slug, scope, key, io)` answers `{ id, read(), write(v) }`; `io` may
 * override `get`/`put` per call, which is how the Worker binds a per-request
 * `env` to a store that outlives the request.
 */
export function makeIdem({ get = null, put = null, now = Date.now, ttl = IDEM_TTL_S, maxMemory = 2000 } = {}) {
  const memory = new Map();
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
      return {
        id,
        async read() {
          const e = memory.get(id);
          if (e && e.until > now()) return e.v;
          if (e) memory.delete(id);
          if (!g) return null;
          let v = null;
          try { v = await g(id); } catch { v = null; }
          if (!shaped(v)) return null;
          // Warm the isolate for the next press. The remaining shared window
          // is unknown here, so the local copy takes the full one; being
          // remembered a little longer costs nothing a duplicate would not.
          memory.set(id, { v, until: now() + ttl * 1000 });
          return v;
        },
        async write(v) {
          if (!shaped(v) || !idemStorable(v.status, v.body)) return false;
          memory.set(id, { v, until: now() + ttl * 1000 });
          sweep();
          if (p) { try { await p(id, v, ttl); } catch { /* the in-isolate layer still holds it */ } }
          return true;
        },
      };
    },
    size: () => memory.size,
  };
}
