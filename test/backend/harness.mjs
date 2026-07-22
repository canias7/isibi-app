// Offline test harness for the per-site backend (/api/db/<slug>/…) route code.
// Backs Cloudflare D1 with in-memory node:sqlite and stubs the Supabase REST bits
// the routes touch, so we exercise the REAL worker.fetch handler unmodified.
import { DatabaseSync } from "node:sqlite";

const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
function makeBucket() {
  const m = new Map();
  return {
    async get(k) { const v = m.get(k); return v == null ? null : { async text() { return v; }, async arrayBuffer() { return new TextEncoder().encode(v).buffer; }, async json() { return JSON.parse(v); } }; },
    async put(k, v) { m.set(k, typeof v === "string" ? v : Buffer.from(v).toString()); },
    async head(k) { return m.has(k) ? { key: k } : null; },
    async delete(k) { m.delete(k); },
    async list({ prefix } = {}) { return { objects: [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) }; },
    _map: m,
  };
}

export function installHarness() {
  const dbs = new Map();       // uuid -> DatabaseSync
  const backends = [];         // {slug, d1_uuid, uid, d1_name}
  const OWNER = { id: "owner-1", email: "owner@test.dev" };
  const OWNER_TOKEN = "owner-token-1";
  let dbSeq = 0;

  const getDb = (uuid) => { let d = dbs.get(uuid); if (!d) { d = new DatabaseSync(":memory:"); dbs.set(uuid, d); } return d; };

  function runSql(uuid, sql, params) {
    const db = getDb(uuid);
    const p = (params || []).map((v) => (v === undefined ? null : v));
    const returning = /\breturning\b/i.test(sql);
    const isRead = /^\s*(select|pragma|with|explain)\b/i.test(sql) || returning;
    try {
      const stmt = db.prepare(sql);
      if (isRead) {
        const rows = stmt.all(...p);
        return { results: rows, meta: { changes: returning ? rows.length : 0, last_row_id: 0, rows_read: rows.length } };
      }
      const info = stmt.run(...p);
      return { results: [], meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) } };
    } catch (e) {
      return { __error: e.message };
    }
  }

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = (init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    let body = null;
    try { if (init.body) body = JSON.parse(init.body); } catch {}
    const hdr = init.headers || {};
    const authH = hdr.Authorization || hdr.authorization || "";

    // Cloudflare D1: create
    if (/\/d1\/database$/.test(url) && method === "POST") {
      const uuid = "db_" + (++dbSeq) + "_" + ((body && body.name) || "x");
      getDb(uuid);
      return jsonResp({ result: { uuid }, success: true });
    }
    // Cloudflare D1: query
    let qm = url.match(/\/d1\/database\/([^/]+)\/query$/);
    if (qm && method === "POST") {
      const out = runSql(qm[1], body.sql, body.params);
      if (out.__error) return jsonResp({ success: false, errors: [{ message: out.__error }] }, 200);
      return jsonResp({ success: true, result: [out] });
    }
    // Cloudflare D1: delete database
    let dm = url.match(/\/d1\/database\/([^/?]+)(?:\?|$)/);
    if (dm && method === "DELETE") { dbs.delete(dm[1]); return jsonResp({ success: true }, 200); }

    // Supabase: site_backends ledger
    if (url.includes("/rest/v1/site_backends")) {
      const slug = decodeURIComponent((url.match(/slug=eq\.([^&]+)/) || [])[1] || "");
      if (method === "GET") { const row = backends.find((b) => b.slug === slug); return jsonResp(row ? [{ d1_uuid: row.d1_uuid, uid: row.uid }] : []); }
      if (method === "POST") { if (!backends.find((b) => b.slug === body.slug)) backends.push({ slug: body.slug, d1_uuid: body.d1_uuid, uid: body.uid, d1_name: body.d1_name }); return jsonResp({}, 201); }
      if (method === "DELETE") { const i = backends.findIndex((b) => b.slug === slug); if (i >= 0) backends.splice(i, 1); return jsonResp({}, 200); }
    }
    // Supabase: owner auth
    if (url.endsWith("/auth/v1/user")) {
      if (authH.includes(OWNER_TOKEN)) return jsonResp(OWNER);
      return jsonResp({ message: "bad token" }, 401);
    }
    // Other Supabase REST tables the routes may touch → benign empty
    if (url.includes("/rest/v1/")) return jsonResp([]);
    // Platform mailer / edge functions → benign
    if (url.includes("/functions/v1/")) return jsonResp({ ok: true });

    return jsonResp({}, 200);
  };

  const env = {
    CF_ACCOUNT_ID: "test-acct",
    CF_D1_API_TOKEN: "test-d1-token",
    SUPABASE_SERVICE_KEY: "test-service-key",
    SITES_BUCKET: makeBucket(),
    ANTHROPIC_API_KEY: "",
  };
  const pending = [];
  const ctx = { waitUntil: (p) => { if (p && p.then) { pending.push(p); p.catch(() => {}); } } };
  // Await any fire-and-forget work scheduled via ctx.waitUntil (webhook auto-fire, triggers…).
  const drain = async () => { while (pending.length) { const batch = pending.splice(0); await Promise.allSettled(batch); } };

  return { env, ctx, OWNER, OWNER_TOKEN, backends, dbs, getDb, drain, restore() { globalThis.fetch = realFetch; } };
}

// Convenience client bound to a worker handler + harness env.
export function makeClient(worker, h) {
  const base = "https://isibi.ai";
  async function call(method, path, { token, body, headers } = {}) {
    const hs = { "content-type": "application/json", ...(headers || {}) };
    if (token) hs.Authorization = "Bearer " + token;
    const req = new Request(base + path, { method, headers: hs, body: body !== undefined ? JSON.stringify(body) : undefined });
    const res = await worker.fetch(req, h.env, h.ctx);
    let json = null; const text = await res.text();
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, location: res.headers.get("location") };
  }
  return {
    call,
    get: (p, o) => call("GET", p, o),
    post: (p, body, o) => call("POST", p, { body, ...(o || {}) }),
    patch: (p, body, o) => call("PATCH", p, { body, ...(o || {}) }),
    del: (p, o) => call("DELETE", p, o),
    // Owner helpers
    ensure: (slug) => call("POST", "/api/site/backend/ensure", { token: h.OWNER_TOKEN, body: { slug } }),
    schema: (slug, schema) => call("POST", "/api/site/backend/schema", { token: h.OWNER_TOKEN, body: { slug, schema } }),
    // Site-visitor auth
    signup: (slug, email, password, extra) => call("POST", `/api/db/${slug}/auth/signup`, { body: { email, password, ...(extra || {}) } }),
    login: (slug, email, password) => call("POST", `/api/db/${slug}/auth/login`, { body: { email, password } }),
  };
}

// Tiny assertion helpers with a running tally.
export function makeTally(name) {
  let pass = 0, fail = 0; const fails = [];
  const ok = (cond, label) => { if (cond) { pass++; } else { fail++; fails.push(label); console.log("  ✗ " + label); } };
  const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label + ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const done = () => {
    console.log(`\n${name}: ${pass}/${pass + fail} passed` + (fail ? ` — ${fail} FAILED` : " ✅"));
    if (fail) process.exitCode = 1;
    return { pass, fail, fails };
  };
  return { ok, eq, done, get pass() { return pass; }, get fail() { return fail; } };
}
