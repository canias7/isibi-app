// PER-VISITOR LIMITS FOR THIS SITE'S OWN ROUTES (2026-10-28), per isolate:
// the limits the platform used to apply in front of every `/api/db` call,
// kept by the site now that the platform only passes calls on.
const buckets = new Map<string, { n: number; until: number }>();

/** 0 when allowed; otherwise the seconds to wait. */
export function tooMany(key: string, max: number): number {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.until) { buckets.set(key, { n: 1, until: now + 60_000 }); if (buckets.size > 5000) buckets.clear(); return 0; }
  return ++b.n > max ? Math.ceil((b.until - now) / 1000) : 0;
}

export const visitorIp = (request: Request) => request.headers.get("CF-Connecting-IP") || "unknown";

export const limited = (wait: number) =>
  Response.json({ error: "too many tries — wait a moment" }, { status: 429, headers: { "x-site-data": "own", "retry-after": String(wait) } });
