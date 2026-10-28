// DRIVE THE SITE'S OWN WORKER'S FOLLOW-UPS FOR REAL (2026-10-28): what follows a
// visitor's write moved out of worker.js into the site template
// (`lib/site-effects.ts`, `lib/site-webhook-retry.ts`, `lib/site-connect.ts`,
// `lib/site-telemetry.ts`). This loads them with `loadTemplate` and gives them
// an in-memory bucket and a recording `fetch`: a POST to Neon's `/sql` endpoint
// answers from `sql(query, params)`, anything else from `answer(url, init)`.
import { loadTemplate } from "./template-ts.mjs";

/** An R2-shaped bucket in memory: get/put (with `onlyIf` etags)/delete/list. */
export function memBucket(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, { v: String(v), etag: "e0", at: new Date() }]));
  let n = 0;
  return {
    map: m,
    async get(k) { const o = m.get(k); return o ? { text: async () => o.v, etag: o.etag } : null; },
    async head(k) { return m.has(k) ? {} : null; },
    async put(k, v, opts) {
      const cur = m.get(k);
      const only = opts && opts.onlyIf;
      if (only && only.etagDoesNotMatch === "*" && cur) return null;
      if (only && only.etagMatches && (!cur || cur.etag !== only.etagMatches)) return null;
      const o = { v: String(v), etag: "e" + ++n, at: new Date() };
      m.set(k, o);
      return { etag: o.etag };
    },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) {
      return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, uploaded: m.get(key).at })), truncated: false };
    },
  };
}

/** Swap `globalThis.fetch` for a recorder while `fn` runs. */
export async function withFetch({ sql = () => [], answer = () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }) } = {}, fn) {
  const real = globalThis.fetch;
  const calls = [];
  const queries = [];
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u && u.url ? u.url : u);
    if (/\/sql$/.test(url) && init.headers && init.headers["Neon-Connection-String"]) {
      const b = JSON.parse(init.body);
      queries.push({ url, conn: init.headers["Neon-Connection-String"], query: b.query, params: b.params });
      const rows = await sql(b.query, b.params);
      if (rows instanceof Error) return new Response(String(rows.message), { status: 400 });
      return Response.json({ rows: rows || [] });
    }
    calls.push({ url, init });
    return answer(url, init);
  };
  try { return { out: await fn(), calls, queries }; }
  finally { globalThis.fetch = real; }
}

/** A `ctx` whose held promises can be awaited. */
export function heldCtx() {
  const held = [];
  const seen = { n: 0 };
  return { held, seen, ctx: { waitUntil: (p) => { seen.n++; held.push(p); } }, settle: async () => { while (held.length) await held.shift(); } };
}

export const APP_CONN = "postgresql://site_app:pw@ep-1.neon.tech/db";

/**
 * Run `runSiteEffects` (a visitor's write as the site's own Worker saw it) and
 * wait for everything it handed to `waitUntil`.
 */
export async function driveWrite({ tables, env = {}, method = "POST", path, sent = "", body = "", search = "", sql, answer, slug = "barber" }) {
  const { runSiteEffects } = await loadTemplate("lib/site-effects.ts");
  const bucket = env.SITES || memBucket();
  // A site on its own bucket (the only place it keeps its cooldowns).
  const e = { APP_CONN, SITE_TABLES: JSON.stringify(tables), SITES: bucket, OWN_BUCKET: "1", ...env };
  const c = heldCtx();
  const r = await withFetch({ sql, answer }, async () => {
    const fired = await runSiteEffects(e, c.ctx, { slug, method, path: path || tables[0].name, search, sent, body });
    await c.settle();
    return fired;
  });
  return { fired: r.out, calls: r.calls, queries: r.queries, bucket, waited: c.seen.n };
}
