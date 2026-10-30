// THE PROJECTS' SERVER, IN MEMORY (2026-10-30): the real Worker answering the
// projects routes, with Supabase's `site_backends` rows and the R2 bucket kept
// here. Used by test/projects-server-side.test.mjs, both for the Worker cases
// and as the server two browser "devices" talk to.
import { loadWorker, makeCtx } from "./worker-harness.mjs";

/** An R2 bucket in memory: get, head, put (with `onlyIf` and custom metadata), delete, list. */
export function memBucket() {
  const store = new Map();
  let n = 0;
  const obj = (key, e) => ({ key, etag: e.etag, httpEtag: '"' + e.etag + '"', customMetadata: e.meta, size: e.body.length, text: async () => e.body, json: async () => JSON.parse(e.body) });
  const b = {
    store,
    failList: false,
    async get(key) { const e = store.get(key); return e ? obj(key, e) : null; },
    async head(key) { const e = store.get(key); return e ? obj(key, e) : null; },
    async put(key, body, opts = {}) {
      const cur = store.get(key);
      const c = opts.onlyIf;
      if (c && c.etagMatches && (!cur || cur.etag !== c.etagMatches)) return null;
      if (c && c.etagDoesNotMatch === "*" && cur) return null;
      const e = { body: typeof body === "string" ? body : String(body), etag: "e" + (++n), meta: opts.customMetadata || undefined };
      store.set(key, e);
      return obj(key, e);
    },
    async delete(key) { store.delete(key); },
    async list({ prefix = "", include = [] } = {}) {
      if (b.failList) throw new Error("list down");
      const objects = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((k) => {
        const e = store.get(k);
        return { key: k, etag: e.etag, ...(include.includes("customMetadata") ? { customMetadata: e.meta } : {}) };
      });
      return { objects, truncated: false };
    },
  };
  return b;
}

/**
 * A server: `rows` are `site_backends` rows ({ slug, uid, chat, created_at, neon_db }),
 * `bucket` the R2 store. `call(path, init)` drives the real Worker as `uid`.
 */
export function projectsServer({ uid }) {
  const rows = [];
  const bucket = memBucket();
  const env = { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: bucket };
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const supa = async (input, init = {}) => {
    const url = String(input && input.url ? input.url : input);
    const method = String(init.method || (input && input.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json({ id: uid, email: "owner@example.com" });
    if (url.includes("/rest/v1/site_backends") && method === "GET") {
      return json(rows.filter((r) => r.uid === uid).map((r) => ({ slug: r.slug, created_at: r.created_at || "2026-10-01T00:00:00Z", brief: r.brief || "", neon_db: r.neon_db || "", chat_id: r.chat || null, offline_at: null, display_name: null, uid: r.uid })));
    }
    if (url.includes("/rest/v1/")) return method === "GET" ? json([]) : new Response(null, { status: 204 });
    return json({}, 404);
  };
  async function call(path, init = {}) {
    const worker = await loadWorker();
    const real = globalThis.fetch;
    globalThis.fetch = supa;
    try {
      const ctx = makeCtx();
      const res = await worker.fetch(new Request("https://gofarther.dev" + path, { ...init, headers: { Authorization: "Bearer t", ...(init.headers || {}) } }), env, ctx);
      const text = await res.text();
      await Promise.allSettled(ctx.pending);
      return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })(), headers: res.headers };
    } finally { globalThis.fetch = real; }
  }
  return { rows, bucket, env, call };
}
