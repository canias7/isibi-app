// THE SITE AGENT'S ROUTE DRIVER FOR FIX-ALL (2026-10-30), from
// test/fixtures/agent-route.mjs, with what the fix-all cases need around the
// real Worker routes: a Stop pressed after a chosen round (`edit_beat`
// answers cancel), a balance (`credits` row / `get_credits`), compiles that
// fail from a chosen one, a site database (`db`: a small Postgres stand-in on
// the Neon HTTP door, with a stored schema and its rows), the owner's media
// listing, and the alias store (`site_aliases`).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { CONFIG_KEY } from "../../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../../builder/edit-job.mjs";
import { modelsFor } from "../../builder/build-models.mjs";

export const USER = { id: "u-fixall-1", email: "owner@example.com" };
const hex = (n) => randomBytes(n).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
export const page = (route, inner) => "import { createFileRoute } from '@tanstack/react-router'\n" +
  "export const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main>" + inner + "</main>}\n";
export const HOME = page("/", "<h1>Harbour Loaf</h1><p>Open 7am to 4pm.</p>");
export const MENU = page("/menu", "<h1>Menu</h1>");
export const HOME_NEW = page("/", "<h1>Harbour Loaf</h1><p>Open 8am to 5pm.</p>");
export const ROUND = { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 9000 };
export const MODEL = modelsFor("sonnet").pages;
export const use = (name, input) => ({ type: "tool_use", id: "t" + hex(3), name, input });
const CONN = "postgres://u:p@ep-fixall.neon.tech/neondb";

function bucket(slug, pages) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(pages || [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }])],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf" }, css: ":root{--brand:#123}" })],
  ]);
  const obj = (k, v) => ({ key: k, text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store, media: [],
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(k, v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list({ prefix = "" } = {}) {
      const objects = this.media.filter((m) => m.key.startsWith(prefix)).map((m) => ({ key: m.key, size: m.size, customMetadata: {} }));
      return { objects, truncated: false };
    },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * A SITE DATABASE: a stored schema (`spec`) and its rows, by table, keyed by
 * each table's own key column. Answers the statements the routes send: the
 * schema reads, `_meta`, and the agent's row statements (one operation each,
 * with its journal key) and their undo. `failAll` makes every query fail (a
 * database that cannot be read).
 */
export function fakeDb({ spec = null, rows = {}, failAll = false } = {}) {
  const tables = new Map(Object.entries(rows).map(([t, rs]) => [t, rs.map((r) => ({ ...r }))]));
  const meta = new Map();
  const log = [];
  const pkOf = (t) => { const tt = spec && spec.tables.find((x) => x.name === t); const c = tt && tt.columns.find((x) => x.pk); return c ? c.name : "id"; };
  const wire = (rs, command = "SELECT") => {
    const names = [...new Set(rs.flatMap((r) => Object.keys(r)))];
    return json({ command, rowCount: rs.length, rows: rs.map((r) => names.map((n) => (r[n] === undefined ? null : r[n]))), fields: names.map((n) => ({ name: n, dataTypeID: 25 })) });
  };
  const err = (code, message) => json({ message, code, severity: "ERROR" }, 400);
  const answer = (q, p) => {
    log.push(q.slice(0, 60));
    if (failAll) return err("57P01", "terminating connection");
    if (/^SELECT 1\b/.test(q)) return wire([{ one: 1 }]);
    if (/information_schema\.columns/.test(q)) return wire(spec ? spec.tables.flatMap((t) => t.columns.map((c) => ({ t: t.name, c: c.name, ty: "text" }))) : []);
    if (/SELECT v FROM _meta WHERE k = 'schema'/.test(q)) return wire(spec ? [{ v: JSON.stringify(spec) }] : []);
    if (/^SELECT v FROM _meta WHERE k = \$1/.test(q)) { const v = meta.get(p[0]); return wire(v === undefined ? [] : [{ v }]); }
    if (/^DELETE FROM _meta WHERE k = \$1/.test(q)) { meta.delete(p[0]); return wire([], "DELETE"); }
    const journal = (key, kind, table, old, row) => {
      if (!key) return null;
      if (meta.has(key)) return err("23505", "duplicate key value violates unique constraint \"_meta_pkey\"");
      meta.set(key, JSON.stringify({ kind, table, old, row }));
      return null;
    };
    let m;
    if ((m = /^WITH o AS \(SELECT NULL::json AS o WHERE false\), w0 AS \(INSERT INTO "(\w+)" \(([^)]*)\) VALUES/.exec(q))) {
      const t = m[1], cols = m[2].split(", ").map((c) => c.replace(/"/g, ""));
      const row = {}; cols.forEach((c, i) => { row[c] = p[i]; });
      const pk = pkOf(t), list = tables.get(t);
      if (!list) return err("42P01", "relation does not exist");
      if (!Object.hasOwn(row, pk)) row[pk] = list.reduce((n, r) => Math.max(n, Number(r[pk]) || 0), 0) + 1;
      const k = q.includes("INSERT INTO _meta") ? p[cols.length] : "";
      const e = journal(k, "add", t, null, row); if (e) return e;
      list.push(row);
      return wire([{ old: null, row: JSON.stringify(row) }]);
    }
    if ((m = /^WITH o AS \(SELECT row_to_json\(t\) AS o FROM "(\w+)" t WHERE "(\w+)" = \$1\), w0 AS \(UPDATE "\w+" SET ([^W]*) WHERE/.exec(q))) {
      const t = m[1], pk = m[2], sets = m[3].split(", ").map((x) => x.split(" = ")[0].replace(/"/g, ""));
      const list = tables.get(t) || [];
      const r = list.find((x) => String(x[pk]) === String(p[0]));
      const k = q.includes("INSERT INTO _meta") ? p[2 + sets.length] : "";
      if (!r) return wire([{ old: null, row: null }]);
      const old = { ...r };
      const e = journal(k, "update", t, old, null); if (e) return e;
      sets.forEach((c, i) => { r[c] = p[1 + i]; });
      if (k) meta.set(k, JSON.stringify({ kind: "update", table: t, old, row: { ...r } }));
      return wire([{ old: JSON.stringify(old), row: JSON.stringify(r) }]);
    }
    if ((m = /^WITH w0 AS \(DELETE FROM "(\w+)" WHERE "(\w+)" = \$1 RETURNING \*\)/.exec(q))) {
      const t = m[1], pk = m[2], list = tables.get(t) || [];
      const i = list.findIndex((x) => String(x[pk]) === String(p[0]));
      if (i < 0) return wire([{ old: null, row: null }]);
      const k = q.includes("INSERT INTO _meta") ? p[1] : "";
      const e = journal(k, "remove", t, list[i], null); if (e) return e;
      const [old] = list.splice(i, 1);
      return wire([{ old: JSON.stringify(old), row: null }]);
    }
    // THE UNDO STATEMENTS.
    if ((m = /^DELETE FROM "(\w+)" WHERE "(\w+)" = \$1$/.exec(q))) { const list = tables.get(m[1]) || []; const i = list.findIndex((x) => String(x[m[2]]) === String(p[0])); if (i >= 0) list.splice(i, 1); return wire([], "DELETE"); }
    if ((m = /^UPDATE "(\w+)" SET (.*) WHERE "(\w+)" = \$(\d+)$/.exec(q))) {
      const list = tables.get(m[1]) || []; const cols = m[2].split(", ").map((x) => x.split(" = ")[0].replace(/"/g, ""));
      const r = list.find((x) => String(x[m[3]]) === String(p[cols.length])); if (r) cols.forEach((c, i) => { r[c] = p[i]; });
      return wire([], "UPDATE");
    }
    if ((m = /^INSERT INTO "(\w+)" \(([^)]*)\) OVERRIDING SYSTEM VALUE VALUES/.exec(q))) {
      const row = {}; m[2].split(", ").map((c) => c.replace(/"/g, "")).forEach((c, i) => { row[c] = p[i]; });
      (tables.get(m[1]) || []).push(row);
      return wire([], "INSERT");
    }
    if (/^select \* from "(\w+)" limit/.test(q)) { const t = /^select \* from "(\w+)"/.exec(q)[1]; return wire(tables.get(t) || []); }
    return wire([]);
  };
  return { tables, meta, log, answer, failAll };
}

/** One message through a route; `rounds` are the agent's answers, in order. */
export async function drive({ mode = "sync", route = "edit", ask, rounds, cancelAfter = 0, balance = 500, failCompileFrom = 0, db = null, media = [], aliases = null, pages = null, idem = null }) {
  const slug = "fixall-" + mode + "-" + hex(4);
  const b = bucket(slug, pages);
  b.media = media.map((name) => ({ key: "uploads/" + slug + "/" + name, size: 1000 }));
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/" + route;
  const reqBody = JSON.stringify({ layer: "page", page: "/", instruction: ask, picker: "sonnet", idem: idem || "idem" + hex(10) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body: reqBody, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { agent: [], rpc: [], debits: [], credits: [], aliases: [], beats: 0 };
  let reserved = 0, n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": seen.beats++; return json({ ok: true, alive: true, state: "routing", cancel: cancelAfter > 0 && n >= cancelAfter });
        case "edit_reserve": reserved += Number(args.p_cost); return json({ ok: true, charged: Number(args.p_cost), cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(balance);
    if (u.includes("/rpc/credit_back")) { seen.credits.push(Number(args.amount) || 0); return new Response(null, { status: 204 }); }
    if (u.includes("/rest/v1/credits?")) return json([{ balance }]);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_aliases")) {
      const m = String((init && init.method) || "GET").toUpperCase();
      seen.aliases.push({ method: m, url: u, body: args });
      if (m === "GET") {
        const want = (new URL(u).searchParams.get("alias") || "").replace(/^eq\./, "");
        const row = aliases && aliases[want];
        return json(row ? [{ alias: want, ...row }] : []);
      }
      return json([], m === "POST" ? 201 : 200);
    }
    // ONLY THIS SITE HAS A ROW: another name asked for is free.
    if (u.includes("/rest/v1/site_backends")) return json(u.includes("slug=eq." + slug) || !u.includes("slug=eq.") ? [{ uid: USER.id, brief: "", neon_db: "" }] : []);
    if (u.includes("/rest/v1/site_project")) return json(db ? [{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: CONN }] : []);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.includes("neon.tech/sql")) {
      if (!db) return new Response("no database", { status: 503 });
      return db.answer(String(args.query || ""), Array.isArray(args.params) ? args.params : []);
    }
    if (u.includes("/v1/messages")) {
      const tools = Array.isArray(args.tools) ? args.tools.map((t) => t.name) : [];
      if (tools.includes("finish")) {
        seen.agent.push(args);
        const r = rounds[Math.min(n++, rounds.length - 1)];
        return json({ stop_reason: "tool_use", content: r, usage: ROUND });
      }
      return new Response("no stub", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  let compiles = 0;
  const c = installCompiler({ failWhen: () => failCompileFrom > 0 && ++compiles >= failCompileFrom });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let reply = null, status = 0;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
      assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
      reply = JSON.parse(fin.args.p_result.body);
      status = fin.args.p_result.status;
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: reqBody }), env, ctx);
      status = res.status;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const stored = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    return {
      slug, status, reply, seen, store: b.store, rounds: n,
      compiles: c.calls.length,
      pages: stored, home: stored.find((p) => p.path === "index.tsx").source,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
      refunds: seen.rpc.filter((r) => r.fn === "edit_refund").length,
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}
