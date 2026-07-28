// Throttling the one API anyone on the internet can call.
//
// `/api/db/*` is public by design — a visitor filling in a booking form has no
// account — and as of today it also carries signup and login. The schema engine
// has parsed a per-table `rateLimit` and a per-app `rateLimits {read, write}`
// since it was written, and NOTHING has ever read either of them.
//
// Honest about what this is: a fixed window counted PER ISOLATE. Cloudflare runs
// many isolates per colo, so the real ceiling is higher than the number here and
// a distributed flood walks straight through. It stops the single-source case,
// which is the one that actually happens, and it costs one map lookup. A real
// limiter needs Durable Objects; this is the version that can ship today without
// putting a round trip in front of every read.

// Reads are cheap and a page can legitimately make several; writes cost a row.
export const DEFAULT_READ_PER_MIN = 300;
export const DEFAULT_WRITE_PER_MIN = 60;
export const WINDOW_MS = 60_000;

/**
 * Which limit applies. A table's own `rateLimit` is a WRITE limit and wins over
 * the app default; the app's `rateLimits` covers both verbs.
 *
 * Most-specific-wins, not most-restrictive-wins: a table that declares 200 gets
 * 200 even under an app default of 60. That is how everyone expects config to
 * read, and both numbers are the site owner's own — neither is a safety floor
 * being raised by a stranger.
 */
export function limitFor({ spec, def, method } = {}) {
  const write = isWrite(method);
  const perTable = def && Number(def.rateLimit);
  if (write && Number.isFinite(perTable) && perTable > 0) return perTable;
  const app = spec && spec.rateLimits;
  const fromApp = app && Number(write ? app.write : app.read);
  if (Number.isFinite(fromApp) && fromApp > 0) return fromApp;
  return write ? DEFAULT_WRITE_PER_MIN : DEFAULT_READ_PER_MIN;
}

const isWrite = (method) => String(method || "GET").toUpperCase() !== "GET";

/**
 * A fixed window: the counter starts when the first request in a window arrives
 * and expires a window later, whatever happens in between.
 *
 * That "whatever happens in between" is the whole reason this is not built on
 * ttl-cache. `cache.set` re-stamps the expiry, so counting with it produces a
 * window that a caller EXTENDS by being blocked — one bad minute and a shared
 * office IP is locked out for as long as anyone keeps clicking. (worker.js's
 * `authThrottle` was written that way and had exactly that bug.) Here `resetAt`
 * is fixed at the first hit and never moved, so a blocked caller always recovers
 * within the window.
 *
 * Not a sliding window: sliding needs every timestamp kept, and the memory that
 * costs on a public endpoint is exactly what an attacker would aim at.
 */
export function makeLimiter({ windowMs = WINDOW_MS, max = 5000, now = () => Date.now() } = {}) {
  // Number.isFinite does not coerce, so `"60000"` is refused here too — which
  // matters, because `t + "60000"` CONCATENATES and would produce a window
  // roughly a thousand years long. Same trap ttl-cache documents.
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("windowMs must be a positive number of milliseconds");
  }
  const m = new Map();

  return {
    /** Count one request against `key`. Returns {ok, limit, remaining?, retryAfter}. */
    hit(key, limit) {
      const t = now();
      let e = m.get(key);
      if (!e || t >= e.resetAt) {
        e = { n: 0, resetAt: t + windowMs };
        m.set(key, e);
        // Bounded so a scan across slugs — or an attacker rotating source IPs —
        // cannot grow an isolate's memory without limit. Expired entries go
        // first; only if that is not enough does a live counter get dropped, and
        // then the oldest, which is the one closest to resetting anyway.
        if (m.size > max) {
          for (const [k, v] of m) if (t >= v.resetAt) m.delete(k);
          while (m.size > max) m.delete(m.keys().next().value);
        }
      }
      e.n += 1;
      const retryAfter = Math.max(1, Math.ceil((e.resetAt - t) / 1000));
      if (e.n > limit) return { ok: false, limit, retryAfter };
      return { ok: true, limit, remaining: Math.max(0, limit - e.n), retryAfter };
    },
    get size() { return m.size; },
  };
}

/**
 * The bucket a request counts against.
 *
 * Per IP AND per site, always: per-IP alone would let one busy site throttle a
 * visitor on an unrelated one, and per-site alone would let a single attacker
 * lock every visitor out of a site they do not own.
 *
 * Writes additionally count per TABLE, because a declared per-table `rateLimit`
 * is only meaningful with its own counter — sharing one bucket would mean a
 * table limited to 5/min was really sharing 5 with the contact form. Reads share
 * ONE bucket for the whole site, because the thing a read budget protects is
 * Neon compute, and a page with five lists should not therefore get five times
 * the allowance.
 *
 * An unknown IP shares one bucket rather than getting a free pass — that is the
 * safe direction, and it is only reachable when Cloudflare gives us no header.
 */
export function bucketKey({ ip, slug, table, method } = {}) {
  const site = String(slug || "?").toLowerCase();
  const who = ip || "unknown";
  if (!isWrite(method)) return `r:${site}:${who}`;
  return `w:${site}:${String(table || "*").toLowerCase()}:${who}`;
}

/** A 429 body worth showing a visitor, plus the header that says when to retry. */
export function tooMany({ limit, retryAfter }) {
  return {
    status: 429,
    headers: { "Retry-After": String(retryAfter || 60) },
    body: { error: "Too many requests — slow down and try again shortly.", code: "rate_limit", limit, retryAfter },
  };
}
