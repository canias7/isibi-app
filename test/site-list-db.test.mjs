// A BLANK `neon_db` IS NOT "NO DATABASE" — THE SITE LIST, THE CARD, AND A
// FRESH BROWSER OPENING THE DATA PANEL (Lane 1c, 2026-09-30).
//
// `/api/site/list` answered `db: !!r.neon_db`, so the four sites whose
// database is real and whose reference was never written (`incomplete`:
// ashgrove-1, fretwork-1, northgroup-5, washhouse-1) were listed as having
// none, and the owner's Data button stayed dark on every browser that had not
// built them. Two more hops sat behind it: the card's click adopted a local
// record WITHOUT `backend`, so even a lit button opened a workspace with no
// Data view, and the owner rows route answered "no such site" for a blank
// reference unless some earlier build had left the connection in KV.
//
// THE FOUR STATES, EACH DRIVEN: `ready` and `incomplete` have a database,
// `none` has not, and `unreadable` — a lookup that failed — is neither, all
// the way to the screen: the wire says `null`, the card says it could not
// check, and the Data panel says it could not load, never "none".
//
// Every server answer below comes from the REAL Worker with Supabase and Neon
// answered on the wire; the browser halves are the real functions cut out of
// `public/chat.js` and `public/site-list.js`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const SiteList = (await import("../public/site-list.js")).default || (await import("../public/site-list.js"));
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

const USER = { id: "22222222-2222-2222-2222-222222222222", email: "owner@example.com" };
const PROJECT_CONN = "postgres://owner_role:npg_Pr0jectSecret@ep-list-db.eu-west-2.aws.neon.tech/neondb";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const T = "2026-09-01T00:00:00Z";

// The four sites: a ready one, the blank-link one, one with no database, and
// the blank-link one again when its project row cannot be read.
const READY = { slug: "ready-site", created_at: T, brief: "", neon_db: "site_ready_site" };
const INCOMPLETE = { slug: "fretwork-1", created_at: T, brief: "", neon_db: "" };
const NONE = { slug: "plain-site", created_at: T, brief: "", neon_db: null };

/** `/api/site/list` through the real Worker. `projects` answers the project read. */
async function list({ backends, projects = [] } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const asked = [];
  const writes = [];
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/")) {
      if (method !== "GET") { writes.push(method + " " + u); return json([]); }
      asked.push(u);
      if (u.includes("/rest/v1/site_backends")) return json(backends);
      if (u.includes("/rest/v1/site_project")) return typeof projects === "function" ? projects(u) : json(projects);
      return json([]);
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/list", { headers: { Authorization: "Bearer t" } }),
      { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text), asked, writes };
  } finally { globalThis.fetch = real; }
}
const dbBySlug = (r) => Object.fromEntries(r.body.sites.map((s) => [s.slug, s.db]));

// ── THE WIRE ────────────────────────────────────────────────────────────────

test("the list says ready and incomplete have a database, none has not, through backendState", async () => {
  const r = await list({ backends: [READY, INCOMPLETE, NONE], projects: [{ slug: "fretwork-1" }] });
  assert.equal(r.status, 200);
  assert.deepEqual(dbBySlug(r), { "ready-site": true, "fretwork-1": true, "plain-site": false });
  // THE ONE EXTRA READ: the caller's own uid, the caller's own blank slugs, and
  // the one column that answers "is there a project row" — never its credential.
  const pr = r.asked.filter((u) => u.includes("/rest/v1/site_project"));
  assert.equal(pr.length, 1, "the project rows were not read exactly once");
  const q = new URL(pr[0]).searchParams;
  assert.equal(q.get("uid"), "eq." + USER.id, "the project read is not scoped to the caller");
  assert.equal(q.get("select"), "slug", "the project read selects more than its name");
  assert.equal(q.get("slug"), "in.(fretwork-1,plain-site)", "the project read is not bounded to the blank rows");
  assert.ok(!pr[0].includes("neon_conn"), "the project read asks for the credential");
  // Nothing written, nothing of the reference or the credential on the wire.
  assert.deepEqual(r.writes, []);
  for (const s of ["site_ready_site", "neon_db", "npg_", PROJECT_CONN]) assert.ok(!r.text.includes(s), s + " reached the browser");
});

test("a project read that fails is 'could not tell' for the blank rows only — never a no, and the list stands", async () => {
  const shapes = [
    ["a 503", () => new Response("down", { status: 503 })],
    ["a network failure", () => { throw new TypeError("fetch failed"); }],
    ["an answer that is not a list", () => json({ rows: "nope" })],
  ];
  for (const [what, projects] of shapes) {
    const r = await list({ backends: [READY, INCOMPLETE, NONE], projects });
    assert.equal(r.status, 200, what + ": a failed enrichment refused the whole screen");
    assert.deepEqual(dbBySlug(r), { "ready-site": true, "fretwork-1": null, "plain-site": null }, what);
    // `null` on the wire, not an absent key: the browser is told it could not.
    assert.ok(/"db":null/.test(r.text), what + ": cannot-tell did not go out as null");
  }
});

test("no blank row, no extra read", async () => {
  const r = await list({ backends: [READY], projects: () => { throw new Error("the project rows were read for a ready site"); } });
  assert.deepEqual(dbBySlug(r), { "ready-site": true });
  assert.equal(r.asked.filter((u) => u.includes("site_project")).length, 0);
});

// ── THE BROWSER'S READER ────────────────────────────────────────────────────

test("the browser keeps the three answers apart, and a failed lookup never becomes a no", () => {
  assert.equal(SiteList.fromRow({ slug: "a", db: true }).backend, true);
  assert.equal(SiteList.fromRow({ slug: "a", db: false }).backend, false);
  assert.equal(SiteList.fromRow({ slug: "a", db: null }).backend, null);
  const merged = (srv, loc) => SiteList.merge([{ id: "x", slug: "s", backend: loc, updatedAt: 1 }], [{ slug: "s", db: srv }], true)[0].backend;
  assert.equal(merged(null, undefined), null, "a server that could not tell became an answer");
  assert.equal(merged(null, true), true, "a database this browser knows of was forgotten");
  assert.equal(merged(true, undefined), true);
  assert.equal(merged(false, undefined), false);
});

// ── THE CARD ────────────────────────────────────────────────────────────────

function cut(name) {
  const at = CHAT.indexOf("function " + name + "(");
  assert.ok(at > 0, name + " is gone from chat.js");
  const end = CHAT.indexOf("\n}", at);
  assert.ok(end > at, name + " has no end");
  return CHAT.slice(at, end + 2);
}
function line(decl) {
  const at = CHAT.indexOf(decl);
  assert.ok(at > 0, decl + " is gone from chat.js");
  return CHAT.slice(at, CHAT.indexOf("\n", at));
}
function dbIcon() {
  const iAt = CHAT.indexOf("const ST_ICONS = {");
  const iEnd = CHAT.indexOf("\n};", iAt);
  assert.ok(iAt > 0 && iEnd > iAt, "the icon table moved");
  return new Function(CHAT.slice(iAt, iEnd + 3) + "\n" + cut("esc") + "\n" + cut("ic") + "\n" + line("const SITE_X =") + "\n"
    + line("const DB_X =") + "\n" + cut("wireLive") + "\n" + cut("siteWires") + "\n" + cut("siteDbIcon") + "\nreturn siteDbIcon;")();
}

test("the card's Data button: live for a database, 'no database yet' only for a real no, 'couldn't check' for a failed lookup", async () => {
  const r = await list({ backends: [READY, INCOMPLETE, NONE], projects: [{ slug: "fretwork-1" }] });
  const failed = await list({ backends: [INCOMPLETE], projects: () => new Response("down", { status: 503 }) });
  // The grid's own entries: the server's rows through the browser's own merge,
  // on a browser that holds nothing (a fresh one).
  const grid = SiteList.merge([], r.body.sites, true).concat(SiteList.merge([], failed.body.sites, true).map((s) => ({ ...s, slug: "fretwork-1-down" })));
  const icon = dbIcon();
  const say = Object.fromEntries(grid.map((s) => [s.slug, icon(s)]));
  for (const slug of ["ready-site", "fretwork-1"]) {
    assert.doesNotMatch(say[slug], / disabled/, slug + ": the Data button is dark on a site with a database");
    assert.match(say[slug], /title="Data"/);
  }
  assert.match(say["plain-site"], / disabled/);
  assert.match(say["plain-site"], /No database yet/);
  const down = say["fretwork-1-down"];
  assert.match(down, / disabled/, "a button was offered on a lookup that could not tell");
  assert.doesNotMatch(down, /No database yet|has no database/, "a failed lookup became a claim that there is no database");
  assert.match(down, /Couldn’t check/);
});

// ── A FRESH BROWSER OPENS THE DATA PANEL ────────────────────────────────────

/** `siteAdopt` out of chat.js, over a store that starts empty (a fresh browser). */
function adopter(start = []) {
  const store = JSON.parse(JSON.stringify(start));
  let saves = 0;
  const ctx = vm.createContext({ Date, Math, sitesLoad: () => store, sitesSave: () => { saves++; }, siteById: () => null });
  vm.runInContext(cut("siteAdopt"), ctx);
  return { adopt: (e) => ctx.siteAdopt(e), store, saves: () => saves };
}
/** The workspace's own gate for the Data view (`stStageView` and the tab). */
function stageOf(rec) {
  const at = CHAT.indexOf("const stStageView =");
  const end = CHAT.indexOf("'preview';", at);
  assert.ok(at > 0 && end > at, "the stage chain moved");
  const ctx = vm.createContext({});
  vm.runInContext(CHAT.slice(at, end + "'preview';".length) + "\nthis.f = stStageView;", ctx);
  // THE WORKSPACE'S OWN EXPRESSION for whether the site has data to show.
  const gate = CHAT.slice(CHAT.indexOf("const stageView = stStageView("), CHAT.indexOf(";", CHAT.indexOf("const stageView = stStageView(")));
  assert.match(gate, /stStageView\(siteView, !!\(isReact && site\.backend\)\)/, "the workspace no longer gates the Data view on the record's backend");
  return ctx.f("data", !!(rec.react && rec.backend));
}

/** The owner rows route through the real Worker, for a site whose KV holds nothing. */
async function rows(slug, { site = { uid: USER.id, neon_db: "" }, project = [{ uid: USER.id, neon_conn: PROJECT_CONN }], projectDown = false, probeFails = false } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const seen = { sql: [], writes: [], rest: [] };
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/")) {
      if (method !== "GET") { seen.writes.push(method + " " + u); return json([]); }
      seen.rest.push(u);
      if (u.includes("/rest/v1/site_backends")) return json(site ? [{ ...site, brief: "" }] : []);
      if (u.includes("/rest/v1/site_project")) return projectDown ? new Response("down", { status: 503 }) : json(project);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(u)) {
      let q = "";
      try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { q = ""; }
      seen.sql.push(q);
      const sql = (rowsOut, fields) => json({ command: /^\s*select/i.test(q) ? "SELECT" : "OTHER", rowCount: rowsOut.length, rows: rowsOut,
        fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })) });
      if (probeFails) return new Response("could not connect", { status: 500 });
      if (/_meta/i.test(q) && /schema/i.test(q)) return sql([[JSON.stringify({ tables: [{ name: "lessons", access: "display", columns: [{ name: "name", type: "text" }, { name: "price", type: "integer" }] }] })]], ["v"]);
      if (/count\(\*\)/i.test(q)) return sql([[4]], ["n"]);
      return sql([[1]], ["x"]);
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    // NO `SITE_ROUTES`: the cache holds nothing, as it does not in the container.
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/rows", { headers: { Authorization: "Bearer t" } }),
      { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text), seen };
  } finally { globalThis.fetch = real; }
}

test("a fresh browser opens the Data panel of a blank-link site: adopted with its database, and the tables read through the four-state reader", async () => {
  // 1. The list, as a fresh browser gets it.
  const r = await list({ backends: [INCOMPLETE], projects: [{ slug: "fretwork-1" }] });
  const entry = SiteList.merge([], r.body.sites, true)[0];
  assert.equal(entry.backend, true);
  // 2. The card's click adopts the entry into a store that holds nothing.
  const a = adopter([]);
  const rec = a.adopt(entry);
  assert.equal(rec.backend, true, "the adopted record lost the server's yes, so the workspace offers no Data view");
  assert.equal(a.store.length, 1);
  // 3. The workspace shows the Data view for it.
  assert.equal(stageOf(rec), "data", "the workspace falls back to the preview");
  // 4. The panel's first read, through the real owner route with an empty cache.
  const t = await rows("list-db-incomplete");
  assert.equal(t.status, 200, "the owner's own panel could not open the database: " + t.text.slice(0, 200));
  assert.deepEqual(t.body.tables.map((x) => x.name), ["lessons"]);
  assert.ok(t.seen.sql.some((q) => /^SELECT 1$/.test(q.trim())), "the derived connection was used without being proved");
  // READ ONLY: no reference written back, nothing provisioned.
  assert.deepEqual(t.seen.writes, [], "opening the panel wrote to Supabase");
  assert.ok(!t.seen.sql.some((q) => /^\s*(create|alter|insert|update|delete|drop)\b/i.test(q)), "opening the panel changed the database");
});

test("a record this browser already holds learns the server's yes, and never loses one", () => {
  const a = adopter([{ id: "site_1", slug: "fretwork-1", react: true, name: "fretwork-1" }]);
  assert.equal(a.adopt({ id: "srv_fretwork-1", slug: "fretwork-1", backend: true }).backend, true);
  assert.equal(a.saves(), 1);
  const b = adopter([{ id: "site_1", slug: "fretwork-1", react: true, backend: true }]);
  for (const said of [false, null, undefined]) assert.equal(b.adopt({ slug: "fretwork-1", backend: said }).backend, true, "a database was taken away by " + said);
  // And a server that could not tell writes nothing onto a new record.
  const c = adopter([]);
  assert.equal(Object.hasOwn(c.adopt({ slug: "fretwork-1", backend: null }), "backend"), false);
});

test("the rows route: none is still 'no such site', and a lookup that failed is ours, never 'no such site'", async () => {
  const none = await rows("list-db-none", { project: [] });
  assert.equal(none.status, 404);
  assert.equal(none.body.error, "no such site");
  const down = await rows("list-db-down", { projectDown: true });
  assert.equal(down.status, 500, "an unreadable reference read as a site with no database: " + down.text.slice(0, 200));
  assert.notEqual(down.body.error, "no such site");
  assert.equal(down.body.kind, "BackendUnreadable");
  const probe = await rows("list-db-probe", { probeFails: true });
  assert.equal(probe.status, 500, "a derived database that will not answer read as none");
  for (const x of [none, down, probe]) {
    assert.deepEqual(x.seen.writes, []);
    assert.ok(!x.text.includes("npg_") && !x.text.includes(PROJECT_CONN), "a credential reached the reply");
  }
});

/** `loadSiteData` out of chat.js, over a panel element and a supplied `/rows` answer. */
async function panel(answer) {
  const host = { innerHTML: "", querySelectorAll: () => [] };
  const ctx = vm.createContext({
    document: { getElementById: (id) => (id === "stData" ? host : null), createElement: () => ({}) },
    apiFetch: async () => answer(),
    siteDataTable: "", siteDataForm: null,
    isImageCol: () => false, sbToast: () => {}, importWords: () => "", confirm: () => false,
    encodeURIComponent, JSON, Object, Array, String, Promise,
  });
  const iAt = CHAT.indexOf("const ST_ICONS = {");
  const iEnd = CHAT.indexOf("\n};", iAt);
  // AN ASYNC FUNCTION IS CUT FROM ITS `async`, or the body's `await` is a
  // syntax error in a function that never was.
  const at = CHAT.indexOf("\nasync function loadSiteData(");
  const end = CHAT.indexOf("\n}", at + 1);
  assert.ok(at > 0 && end > at, "loadSiteData moved");
  vm.runInContext(CHAT.slice(iAt, iEnd + 3) + "\n" + cut("esc") + "\n" + cut("ic") + "\n" + CHAT.slice(at, end + 2), ctx);
  await ctx.loadSiteData({ slug: "fretwork-1" });
  return host.innerHTML;
}

test("the Data panel: 'no data tables yet' only when the list was read and is empty", async () => {
  const empty = await panel(() => json({ tables: [] }));
  assert.match(empty, /No data tables yet\./);
  for (const [what, answer] of [
    ["a 500", () => json({ error: "Something went wrong reaching your site's data.", kind: "BackendUnreadable" }, 500)],
    ["a 404", () => json({ error: "no such site" }, 404)],
    ["a network failure", () => { throw new TypeError("Failed to fetch"); }],
    ["an answer with no list", () => json({ ok: true })],
  ]) {
    const html = await panel(answer);
    assert.doesNotMatch(html, /No data tables yet/, what + ": a failed read became a claim that there are no tables");
    assert.match(html, /Couldn’t load this site’s tables just now\./, what);
  }
});
