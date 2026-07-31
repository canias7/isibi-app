// A bounded, expiring map — for the lookups a published site repeats on every
// single request.
//
// Measured 2026-07-28 against the live site: one row read costs FOUR sequential
// round trips (site_backends by slug → user_site_project by uid → the site's
// _meta schema → the actual query), ~0.9s median for six rows. Three of those
// four answer the same thing every time.
//
// Deliberately per-isolate rather than a shared store. Cloudflare gives each PoP
// its own short-lived isolate, so this is a best-effort hit, never a source of
// truth: everything cached here is re-derivable, and every entry expires. That
// is also why the TTLs below are short — an isolate that missed an invalidation
// must heal on its own, without anyone noticing.
export function makeCache({ ttlMs, max = 500, now = () => Date.now() } = {}) {
  // Number, not just truthy-and-positive: `"100"` passes `> 0`, and then
  // `now() + "100"` CONCATENATES — 1000 + "100" is "1000100", an expiry roughly
  // a thousand years out. The entry would never expire and the bug would look
  // like a caching win.
  if (typeof ttlMs !== "number" || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("ttlMs must be a positive number of milliseconds");
  }
  const m = new Map();

  const cache = {
    get(key) {
      const e = m.get(key);
      if (!e) return undefined;
      if (now() >= e.exp) { m.delete(key); return undefined; }
      // Re-insert so Map iteration order tracks recency — that is what makes the
      // eviction below drop the least recently USED rather than the oldest set.
      m.delete(key); m.set(key, e);
      return e.v;
    },
    set(key, value) {
      // Never cache absence. A slug that does not resolve yet is usually one
      // whose build is still finishing; remembering the 404 would keep a
      // brand-new site broken for the whole TTL.
      if (value == null) return value;
      m.delete(key);
      m.set(key, { v: value, exp: now() + ttlMs });
      // Bounded so a scan across many slugs cannot grow this without limit.
      while (m.size > max) m.delete(m.keys().next().value);
      return value;
    },
    delete(key) { return m.delete(key); },
    clear() { m.clear(); },
    get size() { return m.size; },
  };
  return cache;
}

/**
 * Wrap an async lookup so concurrent callers share one in-flight request.
 *
 * Without this a cold isolate serving a page with three lists fires three
 * identical resolutions at once — the cache is empty until the first returns, so
 * it saves nothing exactly when it is needed most.
 */
export function memoize(cache, fn) {
  const inflight = new Map();
  return async (key, ...rest) => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = (async () => {
      try { return cache.set(key, await fn(key, ...rest)); }
      finally { inflight.delete(key); }
    })();
    inflight.set(key, p);
    return p;
  };
}
