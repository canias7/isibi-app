// A FULL REVISE KNOWS THE DATABASE THE SITE HAS (2026-09-25, the edit-path
// milestone, item 4).
//
// Owner: *"Review database context on full rewrites. Verify how an incomplete
// backend reference affects the writer. Reuse trustworthy read-only resolution
// where possible. Distinguish no database from an unreadable database. No live
// database repairs or provisioning as part of this milestone."*
//
// REPRODUCED on the parent through the real `POST /api/site/react-revise`,
// every model answer supplied, on a home page that calls the site's own
// function (`useRpc("bookings_on_day")`):
//
//   incomplete  (database real, `site_backends.neon_db` blank) — the writer was
//               handed the FRONTEND rules, "THIS SITE HAS NO DATABASE", for a
//               rewrite of every page;
//   unreachable (the same, with the database down) — the same frontend rules;
//   ready       — the database rules, but a digest WITHOUT the site's function,
//               because the merge took the stored tables and nothing else.
//
// Every case asserts the writer's own request (its rules and its digest), the
// database queries (read-only: a proof, the catalog, `_meta`), and that nothing
// repairs the reference or provisions anything.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer is SUPPLIED, so this
// establishes what the writer is TOLD — never that a real writer uses it well.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

const USER = { id: "u-revise-db-1", email: "owner@example.com" };
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const HOME = "import { createFileRoute } from '@tanstack/react-router'\nimport { useRpc } from \"@/lib/rows\"\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + 'function Home(){ const q = useRpc("bookings_on_day", { day: "2026-09-22" }); return <main><h1>Fretwork</h1><p>{String(q.data)}</p></main> }\n';
// WHAT THE SITE STORES: a table and the function its home page calls.
const SPEC = {
  tables: [{ name: "bookings", columns: [{ name: "day", type: "date" }, { name: "name", type: "text" }], read: "none", write: "anyone" }],
  functions: [{ name: "bookings_on_day", args: [{ name: "day", type: "date" }], returns: "integer" }],
};
const CATALOG = { bookings: ["id", "day", "name", "created_at"] };
const asksCatalog = (q) => /information_schema\.columns/i.test(String(q));
const asksMeta = (q) => /_meta/i.test(String(q)) && /k\s*=\s*'schema'/i.test(String(q));
const FRONTEND = "THIS SITE HAS NO DATABASE";
const DIGEST_FN = /bookings_on_day\(day: date\) -> integer/;
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }])],
    ["source/" + slug + "/parts.json", "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fretwork", theme: "broadsheet" }, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * ONE REVISE OF A COLOUR, on a site in the named state. `db` decides what the
 * database answers: "up" answers the catalog and `_meta`, "down" refuses every
 * query, "catalog-down" answers the proof and refuses the catalog.
 */
async function revise({ state, db = "up", backend = null }) {
  const slug = "revise-db-" + state + "-" + db;
  const seen = { tools: [], writer: null, sql: [], writes: [], debits: [], reverses: [], neonApi: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/credit_debit")) { seen.debits.push(JSON.parse(String(init.body))); return json({ ok: true, exempt: false, taken: 2, balance: 500, repeat: false }); }
    if (url.includes("/rpc/credit_reverse")) { seen.reverses.push(JSON.parse(String(init.body))); return json({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }); }
    if (url.includes("/rpc/use_quota")) return json(true);
    if (url.includes("/rpc/get_credits")) return json(500);
    if (url.includes("/rest/v1/site_backends")) {
      if (method !== "GET") { seen.writes.push(method + " " + url); return json([]); }
      return json([{ uid: USER.id, neon_db: state === "ready" ? "db_ready" : "", brief: "a guitar school" }]);
    }
    if (url.includes("/rest/v1/site_project")) return json(state === "none" ? [] : [{ uid: USER.id, neon_conn: PROJECT_CONN }]);
    if (url.includes("console.neon.tech") || url.includes("/api/v2/projects")) { seen.neonApi.push(method + " " + url); return new Response("no", { status: 503 }); }
    if (/neon\.tech|\/sql$/.test(url)) {
      let asked = "";
      try { asked = String(JSON.parse(String(init.body || "{}")).query || ""); } catch { asked = String(init.body || ""); }
      seen.sql.push(asked);
      if (db === "down") return new Response("could not connect", { status: 500 });
      if (db === "catalog-down" && asksCatalog(asked)) return new Response("permission denied", { status: 500 });
      let rows = [], fields = ["x"];
      if (asksCatalog(asked)) { for (const [t, cols] of Object.entries(CATALOG)) for (const c of cols) rows.push([t, c, "text"]); fields = ["t", "c", "ty"]; }
      else if (asksMeta(asked)) { rows = [[JSON.stringify(SPEC)]]; fields = ["v"]; }
      else if (/^\s*SELECT 1\s*$/i.test(asked)) { rows = [[1]]; fields = ["?column?"]; }
      return json({ command: "SELECT", rowCount: rows.length, rows, fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })) });
    }
    if (url.includes("/v1/messages")) {
      const body = JSON.parse(String(init.body || "{}"));
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === SITE_PAGES_TOOL.name) seen.writer = { system: JSON.stringify(body.system || ""), user: JSON.stringify(body.messages || "") };
      if (tool === "design_schema") {
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { brand: "Fretwork", slug, description: "guitar lessons", kind: "shopfront", purpose: "book a lesson", pages: [{ path: "/", name: "Home" }], components: [], css: ".site-footer{background:navy}", ...(backend ? { backend } : {}) } }], usage: { input_tokens: 100, output_tokens: 50 } });
      }
      // THE WRITER'S REQUEST IS THE READING; its answer is not.
      return new Response("stop here", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/react-revise", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ slug, instruction: "Make the footer navy", picker: "sonnet" }),
    });
    const env = { SITES_BUCKET: bucket(slug), ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const res = await worker.fetch(req, env, makeCtx());
    const reply = await res.json().catch(() => null);
    return { status: res.status, reply, ...seen };
  } finally {
    globalThis.fetch = real;
    c.uninstall();
  }
}

// NOTHING THAT CHANGES THE DATABASE OR THE REFERENCE, in any state.
function assertReadOnly(r, label) {
  assert.deepEqual(r.writes, [], label + ": the site's backend reference was written");
  assert.deepEqual(r.neonApi, [], label + ": something was provisioned");
  for (const q of r.sql) assert.match(q, /^\s*(SELECT|WITH)\b/i, label + ": a query that is not a read reached the database: " + q.slice(0, 120));
}

test("an incomplete site's revise tells the writer about its database and its function, reading and never repairing", async () => {
  const r = await revise({ state: "incomplete" });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.ok(r.writer, "the writer was never called");
  assert.ok(!r.writer.system.includes(FRONTEND), "the writer was told the site has no database");
  assert.ok(r.writer.user.includes("THE SCHEMA THAT EXISTS"), "the writer was not shown the site's schema");
  assert.match(r.writer.user, DIGEST_FN, "the writer was not told the function its page calls");
  // THE CONNECTION WAS PROVED BEFORE IT WAS READ, and only read.
  assert.ok(r.sql.some((q) => /^\s*SELECT 1\s*$/i.test(q)), "the derived database was used without being proved");
  assert.ok(r.sql.some(asksCatalog), "the catalog was not asked");
  assertReadOnly(r, "incomplete");
});

test("a ready site's revise tells the writer the functions it stores, not its tables alone", async () => {
  // THIS REQUEST ADDS A COLUMN TO THE STORED TABLE, and its own declaration —
  // the full column objects — wins over the stored one by name, as it did for
  // tables before the functions joined the merge.
  const r = await revise({ state: "ready", backend: { tables: [{ name: "bookings", columns: [{ name: "day", type: "date" }, { name: "name", type: "text" }, { name: "lesson_note", type: "text" }], read: "none", write: "anyone" }] } });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.ok(r.writer, "the writer was never called");
  assert.ok(!r.writer.system.includes(FRONTEND), "the writer was told the site has no database");
  assert.match(r.writer.user, DIGEST_FN, "the writer was not told the function its page calls");
  assert.match(r.writer.user, /lesson_note/, "the request's own declaration of the table lost to the stored one");
});

test("control: a site with no database at all is still revised as one", async () => {
  const r = await revise({ state: "none" });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.ok(r.writer, "the writer was never called");
  assert.ok(r.writer.system.includes(FRONTEND), "a site with no database was given the database rules");
  assert.deepEqual(r.sql, [], "a site with no database was queried");
  assertReadOnly(r, "none");
});

for (const [db, why] of [["down", "derived-database-unreachable"], ["catalog-down", "schema:"]]) {
  test("an unreadable database stops the revise, refunded, rather than rewriting the site as if it had none (" + db + ")", async () => {
    const r = await revise({ state: "incomplete", db });
    assert.equal(r.status, 503, JSON.stringify(r.reply));
    assert.equal(r.reply.ok, false);
    assert.equal(r.reply.error, "backend-unreadable", JSON.stringify(r.reply));
    assert.equal(r.reply.ours, true, "a database we could not read is not said to be ours");
    assert.ok(String(r.reply.backend).startsWith(why), "not the reason it stopped: " + r.reply.backend);
    assert.equal(r.writer, null, "the pages were rewritten without the database");
    assert.equal(r.reverses.length, 1, "the design deposit was not given back, or was given back twice");
    // AND THE REPLY SAYS WHAT IT COST AFTER THAT: the deposit taken and reversed.
    assert.equal(r.reply.cost, 0, "the refusal does not report what the revise cost after its refund");
    assert.equal(r.reply.msg, "I couldn't read your site's database just now, so I stopped rather than rewrite your pages as if it had none — this is on us. Try again in a few minutes.");
    assertReadOnly(r, db);
  });
}

// ⚠ AND A FIRST BUILD IS NOT STOPPED BY A READ OF WHAT IT HAS JUST APPLIED.
//
// The stop above is the REVISE's. A first build with a supplied schema reaches
// the same read with the database it has just made and the schema it has just
// applied from its own spec, so the stored spec can only repeat it. REPRODUCED
// on the first cut of this fix: provisioned, schema applied, the catalog read
// refused, and the build stopped with "rather than rewrite your pages" after its
// database had been made. On the parent it went on to the writer, as it does
// again now.
async function firstBuild({ db = "up" } = {}) {
  const slug = "first-db-" + db;
  const seen = { tools: [], writer: null, sql: [], neonApi: [] };
  let provisioned = false, claimed = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_quota")) return json(true);
    if (url.includes("/rpc/get_credits")) return json(500);
    // A PROVISION, answered in Neon's own shapes (test/fixtures/addon-route.mjs).
    if (url.includes("console.neon.tech/api/v2")) {
      seen.neonApi.push(method + " " + (url.split("/api/v2")[1] || url));
      if (/\/projects$/.test(url) && method === "POST") {
        provisioned = true;
        return json({ project: { id: "pr-new" }, branch: { id: "br-new" }, roles: [{ name: "owner" }], connection_uris: [{ connection_uri: PROJECT_CONN }] }, 201);
      }
      if (/\/operations$/.test(url)) return json({ operations: [] });
      if (/organizations$/.test(url)) return json({ organizations: [] });
      return json({ auth: { jwks_url: "https://x/jwks" }, data_api: { url: "https://x/data" } });
    }
    if (url.includes("/rest/v1/site_project")) {
      if (method === "POST") return json([{ slug }], 201);
      return json(provisioned ? [{ uid: USER.id, neon_project: "pr-new", neon_branch: "br-new", neon_role: "owner", neon_conn: PROJECT_CONN }] : []);
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "POST") { claimed = true; return json([{ slug, uid: USER.id }], 201); }
      if (method === "PATCH") return json([{ slug, neon_db: "db_first" }]);
      return json(claimed ? [{ uid: USER.id, neon_db: "db_first", brief: "a guitar school" }] : []);
    }
    if (/neon\.tech|\/sql$/.test(url)) {
      let asked = "";
      try { asked = String(JSON.parse(String(init.body || "{}")).query || ""); } catch { asked = String(init.body || ""); }
      seen.sql.push(asked);
      if (db === "catalog-down" && asksCatalog(asked)) return new Response("permission denied", { status: 500 });
      return json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    if (url.includes("/v1/messages")) {
      const body = JSON.parse(String(init.body || "{}"));
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === SITE_PAGES_TOOL.name) seen.writer = { system: JSON.stringify(body.system || "") };
      return new Response("stop here", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    if (url.includes("/rest/v1/")) return json([]);
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ slug, brief: "a guitar school", schema: { tables: SPEC.tables }, picker: "sonnet" }),
    });
    const env = { SITES_BUCKET: bucket(slug), ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const res = await worker.fetch(req, env, makeCtx());
    const reply = await res.json().catch(() => null);
    return { status: res.status, reply, provisioned, ...seen };
  } finally {
    globalThis.fetch = real;
    c.uninstall();
  }
}

test("a first build is not stopped by a failed read of the schema it has just applied", async () => {
  const r = await firstBuild({ db: "catalog-down" });
  // THE PREMISE: it provisioned, and the read this is about really failed.
  assert.ok(r.provisioned, "the first build did not provision, so the read was never reached");
  assert.ok(r.sql.some(asksCatalog), "the catalog was never asked, so nothing failed");
  assert.notEqual(r.reply && r.reply.error, "backend-unreadable", "a first build was stopped by a read of what it had just applied: " + JSON.stringify(r.reply));
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.ok(r.writer, "the writer was never called");
  assert.ok(!r.writer.system.includes(FRONTEND), "a first build with a database was given the frontend rules");
});
