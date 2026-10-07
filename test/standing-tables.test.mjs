// TABLES AN ADDITION LEFT STANDING WITHOUT GOING THROUGH, KNOWN WHEN ITS FAILURE IS READ (2026-10-07).
//
// Codex's review of the cleanup batch: *"refresh the authoritative table
// inventory when a failed or cancelled addition leaves tables standing."* The
// page kept table names only from a job that went through, so a table that a
// refused, stopped or dead addition left in the database joined the page's
// list only at the next routing answer (the routing route reads the site's own
// inventory, `routeDigest`), and a routing call whose own read failed was told
// the older list.
//
// NOW: whenever an answer's failure outcome or a job's database record says
// tables stand — or may — the page keeps the ones it names at once and reads
// the site's own inventory again (`siteTablesAfter`), through the routing
// route's reader (`routeTableNames`, by `GET /api/site/routes?tables=1`), on
// the clock a routing call keeps (`siteTablesRead`): an answer to a routing
// call sent after it still wins, and a table an addition put there after it
// went out is kept.
//
// THE ROUTE is the real Worker, its database and store answered at the
// network. THE PAGE is its own functions cut out of public/chat.js and run in
// a VM (`test/fixtures/browser-page.mjs`); where a case says so, its inventory
// read is answered by the real Worker too. Nothing here is a model's answer.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { failureOutcome } from "../builder/site-add.mjs";

const OWNER = { id: "44444444-4444-4444-4444-444444444444", email: "owner@example.com" };
const META = ["_meta", "k", "text"];
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** A database whose catalog holds `live` and whose stored schema declares `declared`. */
const wire = (live, declared = live, extra = {}) => ({
  catalog: [...live.flatMap((n) => [[n, "id", "integer"], [n, "label", "text"]]), META],
  spec: { tables: declared.map((name) => ({ name, access: "display", columns: [{ name: "label" }] })) },
  ...extra,
});

/** `GET <path>` to THE REAL WORKER, as `who`, over the database `w`. Returns the status, the body and the statements asked. */
async function realGet(slug, path, w, who = OWNER.id) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const sql = [];
  const quiet = {};
  for (const k of ["error", "warn", "log", "info"]) { quiet[k] = console[k]; console[k] = () => {}; }
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (u.includes("/auth/v1/user")) return json(OWNER);
    if (u.includes("/rest/v1/")) {
      if (method !== "GET") return json([]);
      if (u.includes("/rest/v1/site_backends")) return json([{ uid: who, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
      if (u.includes("/rest/v1/site_project")) return json([{ uid: who, neon_conn: "postgres://owner_role:npg_StandSecret@ep-stand.eu-west-2.aws.neon.tech/neondb" }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(u)) {
      let q = "";
      try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { q = ""; }
      sql.push(q);
      const rows = (r, fields) => json({ command: "SELECT", rowCount: r.length, rows: r,
        fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })) });
      if (w.sqlFail && w.sqlFail.test(q)) return new Response("could not connect", { status: 500 });
      if (/information_schema\.columns/i.test(q)) return rows(w.catalog, ["t", "c", "ty"]);
      if (/_meta/i.test(q) && /schema/i.test(q)) return rows(w.spec === null ? [] : [[JSON.stringify(w.spec)]], ["v"]);
      return rows([[1]], ["x"]);
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev" + path, { method: "GET", headers: { Authorization: "Bearer t" } }),
      { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json(), sql };
  } finally {
    globalThis.fetch = real;
    Object.assign(console, quiet);
  }
}
const catalogReads = (r) => r.sql.filter((q) => /information_schema\.columns/i.test(q)).length;

test("STAND 1 — THE ROUTE ANSWERS THE SITE'S OWN INVENTORY WHEN ASKED: a table standing undeclared is named, a site with none is an empty list, a read that fails is null — never none — and unasked the answer is what it was", async () => {
  const slug = "stand-route";
  const at = "/api/site/routes?slug=" + slug + "&tables=1";
  // A TABLE AN APPLY LEFT STANDING, NOT IN THE STORED SCHEMA: the catalog is what names it.
  const standing = await realGet(slug, at, wire(["menu", "bookings"], ["menu"]));
  assert.equal(standing.status, 200, JSON.stringify(standing.body));
  assert.deepEqual([...standing.body.tables].sort(), ["bookings", "menu"], "a table standing undeclared was not named");
  assert.ok(catalogReads(standing) >= 1, "the inventory was not read from the database's own catalog");
  const none = await realGet(slug, at, { catalog: [META], spec: null });
  assert.deepEqual(none.body.tables, [], "a site read to have no tables was not told as an empty list");
  for (const fail of [/information_schema/, /_meta/, /./]) {
    const down = await realGet(slug, at, { ...wire(["menu"]), sqlFail: fail });
    assert.equal(down.status, 200);
    assert.equal(down.body.tables, null, "a read that failed (" + fail + ") was told as a list: " + JSON.stringify(down.body.tables));
  }
  // UNASKED: no inventory, and no database read at all.
  const plain = await realGet(slug, "/api/site/routes?slug=" + slug, wire(["menu", "bookings"]));
  assert.equal(plain.status, 200);
  assert.equal(Object.hasOwn(plain.body, "tables"), false, "the page picker's answer changed");
  assert.equal(plain.sql.length, 0, "the page picker's answer read the database");
  // NOT THE CALLER'S SITE: nothing of it, the source route's 404.
  // (Its own slug: the Worker keeps an owner it has read for a while.)
  const theirs = await realGet("stand-route-theirs", "/api/site/routes?slug=stand-route-theirs&tables=1", wire(["menu"]), "55555555-5555-5555-5555-555555555555");
  assert.equal(theirs.status, 404);
  assert.equal(theirs.body.tables, undefined);
  assert.equal(theirs.sql.length, 0, "another owner's database was read");
});

// ── THE PAGE ────────────────────────────────────────────────────────────────
const SLUG = "fold-lane-bakery";
const URL0 = "https://" + SLUG + ".gofarther.app/";
const KEY = (n) => "standrequest" + String(n).padStart(10, "0");
const JOB = (n) => "57a0" + String(n).padStart(28, "0");
const T0 = Date.now() - 60 * 60 * 1000;
const siteFor = (tables, extra = {}) => ({ id: "origin-1", slug: SLUG, react: true, name: "Fold Lane Bakery", url: URL0, pages: [{ path: "/" }], msgs: [], tables, ...extra });
const part = (n, words, status, jobs = [], route = "addon") => ({ n, words, status, ids: jobs.slice(), jobs: jobs.slice(), charged: 0, route });
const view = (key, at, parts, ended = false) => ({ key, state: ended ? "done" : "running", ended, stop: false, at, updatedAt: at, routedUnsaid: 0, parts });
/** A failed addition's stored answer, its outcome from the real `failureOutcome`. */
const failed = (database, tables = []) => ({ ok: false, error: "compile", msg: "That didn't compile, so nothing was published.", cost: 2, outcome: failureOutcome({ database, made: { tables } }) });

/**
 * THE SERVER, SCRIPTED: requests, jobs' stored answers or poll bodies, and the
 * site's inventory as its routes route would answer it — or, with `real`, as
 * the real Worker answers it over that database.
 */
function server() {
  const S = { views: new Map(), answers: new Map(), polls: new Map(), listed: [], inventory: null, real: null, calls: [], holds: [] };
  S.answer = (url, method) => {
    S.calls.push({ url, method });
    if (url.startsWith("/api/site/routes?")) {
      if (!url.includes("tables=1")) return { status: 200, body: { ok: true, slug: SLUG, routes: ["/"] } };
      if (S.real) return realGet(SLUG, url, S.real).then((r) => ({ status: r.status, body: r.body }));
      const out = { status: 200, body: { ok: true, slug: SLUG, routes: ["/"], tables: S.inventory === null ? null : S.inventory.slice() } };
      const hold = S.holds.shift();
      return hold ? hold.then(() => out) : out;
    }
    if (url === "/api/site/requests/" + SLUG) return { status: 200, body: { ok: true, requests: [...S.views.values()].map(copy), jobs: S.listed.map(copy) } };
    if (url.startsWith("/api/site/request/" + SLUG + "/")) {
      const v = S.views.get(url.split("/").pop());
      return v ? { status: 200, body: { ok: true, request: copy(v) } } : { status: 404, body: { error: "not found" } };
    }
    if (url.startsWith("/api/site/edit/")) {
      const id = url.split("/").pop();
      if (S.answers.has(id)) return { status: 200, headers: { "x-gf-edit": "final" }, body: copy(S.answers.get(id)) };
      if (S.polls.has(id)) return { status: 202, body: copy(S.polls.get(id)) };
      return { status: 202, body: { ok: true, status: "building" } };
    }
    return { status: 200, body: { ok: true } };
  };
  /** The next inventory read's answer waits for the function handed back. */
  S.holdNext = () => { let open; S.holds.push(new Promise((ok) => { open = ok; })); return () => open(); };
  return S;
}
const open = (S, site) => page({ site, answer: S.answer, timers: true });
const idle = async () => { await drain(); await drain(); };
const looks = async (p, n = 3) => { for (let i = 0; i < n; i++) { p.flush(); await idle(); } };
const inventoryReads = (S) => S.calls.filter((c) => c.url.startsWith("/api/site/routes?") && c.url.includes("tables=1")).length;
const tablesOf = (p) => copy(p.s.tables || []);
/** Another browser's request (`own` unset), found ended by this page's reading. */
async function readRequest(S, p, key) {
  p.ctx.siteRequestsCheck(p.s);
  await idle();
  await looks(p);
}

test("STAND 2 — A REFUSED ADDITION WHOSE TABLE WENT IN, READ FROM THE SERVER: the table it names joins the page's list at once, and the site's own list is read again and taken — with a table nobody named", async () => {
  const S = server();
  S.views.set(KEY(1), view(KEY(1), T0, [part(0, "Add a booking form", "failed", [JOB(1)])], true));
  S.answers.set(JOB(1), failed("applied", ["bookings"]));
  S.inventory = ["menu", "bookings", "waitlist"];
  const p = open(S, siteFor(["menu"]));
  const hold = S.holdNext();
  await readRequest(S, p, KEY(1));
  // THE NAMED TABLE AT ONCE, BEFORE THE READ ANSWERS.
  assert.deepEqual(tablesOf(p), ["menu", "bookings"], "the table the failure named did not join the list when it was read");
  assert.equal(inventoryReads(S), 1, "the site's own list was not read again");
  hold();
  await looks(p);
  assert.deepEqual(tablesOf(p), ["menu", "bookings", "waitlist"], "the site's own list was not taken");
  assert.equal(inventoryReads(S), 1, "the inventory was read more than once for one failure");
  await looks(p, 3);
  assert.equal(inventoryReads(S), 1, "a later look read the inventory again for the same failure");
});

test("STAND 3 — AN APPLY THAT STOPPED PART-WAY (unknown) AND A JOB STOPPED OR DEAD AFTER ITS TABLES WENT IN: nothing named, so the site's own list is what the page learns them from; the database record's tables are kept at once", async () => {
  // UNKNOWN: the failure cannot name what stands.
  const S = server();
  S.views.set(KEY(2), view(KEY(2), T0, [part(0, "Add a booking form", "failed", [JOB(2)])], true));
  S.answers.set(JOB(2), failed("unknown"));
  S.inventory = ["menu", "bookings"];
  const p = open(S, siteFor(["menu"]));
  await readRequest(S, p, KEY(2));
  assert.equal(inventoryReads(S), 1);
  assert.deepEqual(tablesOf(p), ["menu", "bookings"], "an apply that stopped part-way left the page's list as it was");
  // STOPPED, NO ANSWER: its database record says what went in (`applied_without_page`), or that it cannot tell (`failed`).
  for (const [status, recorded, live] of [["applied_without_page", ["menu", "bookings"], ["menu", "bookings"]], ["failed", [], ["menu", "signups"]], ["pending", [], ["menu", "signups"]]]) {
    const T = server();
    T.views.set(KEY(3), view(KEY(3), T0, [part(0, "Add a booking form", "cancelled", [JOB(3)])], true));
    T.polls.set(JOB(3), { ok: true, job: JOB(3), status: "cancelled", migration: { job: JOB(3), status, version: null, tables: recorded, refused: [], functions: [], functionErrors: [], apis: [], jobs: [] } });
    T.inventory = live;
    const q = open(T, siteFor(["menu"]));
    const hold = T.holdNext();
    await readRequest(T, q, KEY(3));
    assert.deepEqual(tablesOf(q), [...new Set(["menu", ...recorded])], status + ": the record's tables did not join at once");
    assert.equal(inventoryReads(T), 1, status + ": the site's own list was not read again");
    hold();
    await looks(q);
    assert.deepEqual(tablesOf(q), live, status + ": the site's own list was not taken");
  }
});

test("STAND 4 — THIS PAGE'S OWN ADDITION, REFUSED AFTER ITS TABLE WENT IN, THROUGH ITS SYNCHRONOUS POST, WITH THE INVENTORY READ BY THE REAL WORKER: the page's list becomes the database's own, the undeclared table included", async () => {
  const S = server();
  S.real = wire(["menu", "bookings", "rooms"], ["menu"]);
  const posted = S.answer;
  S.answer = (url, method, body) => (url === "/api/site/" + SLUG + "/addon" && method === "POST"
    ? (S.calls.push({ url, method }), { status: 422, body: failed("applied", ["bookings"]) })
    : posted(url, method, body));
  const p = open(S, siteFor(["menu"]));
  const said = [];
  // THE PAGE'S OWN POST, read by the reader it hands its answer to.
  p.ctx.siteAddon(p.s, "Add a booking form", p.s.id, (t) => said.push(t), () => said.push("REWRITE"), { intent: "addon" }, []);
  for (let i = 0; i < 60 && tablesOf(p).length < 3; i++) await idle();
  assert.deepEqual([...tablesOf(p)].sort(), ["bookings", "menu", "rooms"], "the page did not take the database's own list");
  assert.equal(inventoryReads(S), 1);
  assert.equal(said.length, 1, "the failure was not said, or said twice: " + JSON.stringify(said));
  assert.ok(!said.includes("REWRITE"), "a refused addition started the rewrite");
  // THE READER ALONE — as the paid runs' harness executes it — reads nothing.
  const T = server();
  const q = open(T, siteFor(["menu"]));
  q.ctx.addonAnswer(false, failed("applied", ["bookings"]), { site: null, d: { intent: "addon" }, instruction: "x", origin: "", finish: () => {}, fallback: null, imgs: [], handedOff: false, slug: "" });
  await looks(q);
  assert.equal(inventoryReads(T), 0, "the reader itself reached for the network");
});

test("STAND 5 — ORDER AND CANNOT-TELL: a routing answer sent after the read still wins; a table added after it went out is kept; a read that cannot tell changes nothing; a failure that left nothing standing reads nothing", async () => {
  // A ROUTING CALL SENT AFTER THE READ, ANSWERED BEFORE IT: its list stands.
  const S = server();
  S.inventory = ["menu", "bookings"];
  const p = open(S, siteFor(["menu"]));
  const hold = S.holdNext();
  assert.equal(p.ctx.siteTablesAfter(p.s.id, failed("unknown")), true);
  // (A call's place on the page's clock is a count; one sent later than the read holds a larger one.)
  assert.equal(p.ctx.siteTablesRead(p.s, ["menu", "bookings", "orders"], 1e9), true);
  hold();
  await looks(p);
  assert.deepEqual(tablesOf(p), ["menu", "bookings", "orders"], "an older read took away what a later routing answer said");
  // A TABLE ADDED AFTER THE READ WENT OUT: kept over the read's answer.
  const T = server();
  T.inventory = ["menu", "bookings"];
  const q = open(T, siteFor(["menu"]));
  const hold2 = T.holdNext();
  q.ctx.siteTablesAfter(q.s.id, failed("applied", ["bookings"]));
  q.ctx.siteTablesAdd(q.s, ["gallery_items"]);
  hold2();
  await looks(q);
  assert.deepEqual(tablesOf(q), ["menu", "bookings", "gallery_items"], "the read's answer took away a table added after it went out");
  // CANNOT TELL: null, a list that is not names, an error — the page's list stands.
  for (const inventory of [null, ["menu", 3], ["menu", ""]]) {
    const U = server();
    U.inventory = inventory;
    const u = open(U, siteFor(["menu", "bookings"]));
    u.ctx.siteTablesAfter(u.s.id, failed("unknown"));
    await looks(u);
    assert.equal(inventoryReads(U), 1);
    assert.deepEqual(tablesOf(u), ["menu", "bookings"], "a read that could not tell (" + JSON.stringify(inventory) + ") changed the list");
  }
  // NOTHING STANDING: a refusal before any database change, an answer with no outcome, a success — no read.
  const V = server();
  const v = open(V, siteFor(["menu"]));
  for (const body of [failed("none"), { ok: false, error: "add", msg: "No." }, { ok: true, tables: ["bookings"] }, null, "junk", { ok: false, migration: { status: "applied", tables: [] } }]) {
    assert.equal(v.ctx.siteTablesAfter(v.s.id, body), false, JSON.stringify(body));
  }
  await looks(v);
  assert.equal(inventoryReads(V), 0, "a failure that left nothing standing read the inventory");
  assert.deepEqual(tablesOf(v), ["menu"]);
});

test("STAND 6 — EVERY OTHER WAY A PAGE LEARNS AN ADDITION ENDED: a job found from another device, stopped after its tables went in or refused after one did, and this page's own watched job stopped part-way — each reads the site's own list again", async () => {
  const record = (status, tables) => ({ job: "", status, version: null, tables, refused: [], functions: [], functionErrors: [], apis: [], jobs: [] });
  // FOUND, STOPPED, NO ANSWER: its database record cannot tell what stands.
  const S = server();
  S.listed = [{ job: JOB(5), op: "addon", state: "cancelled", ended: true, words: "Add a booking form", at: T0 }];
  S.polls.set(JOB(5), { ok: true, job: JOB(5), status: "cancelled", migration: record("failed", []) });
  S.inventory = ["menu", "bookings"];
  const p = open(S, siteFor(["menu"]));
  await readRequest(S, p);
  assert.equal(inventoryReads(S), 1, "a found job stopped part-way did not read the site's list again");
  assert.deepEqual(tablesOf(p), ["menu", "bookings"]);
  // FOUND, ITS STORED ANSWER A REFUSAL AFTER ITS TABLE WENT IN.
  const T = server();
  T.listed = [{ job: JOB(6), op: "addon", state: "done", ended: true, words: "Add a booking form", at: T0 }];
  T.answers.set(JOB(6), failed("applied", ["bookings"]));
  T.inventory = ["menu", "bookings", "rooms"];
  const q = open(T, siteFor(["menu"]));
  await readRequest(T, q);
  assert.equal(inventoryReads(T), 1, "a found job's refusal after its table went in did not read the site's list again");
  assert.deepEqual(tablesOf(q), ["menu", "bookings", "rooms"]);
  // THIS PAGE'S OWN WATCHED JOB, STOPPED WITH NO ANSWER, its record naming what went in.
  const U = server();
  U.polls.set(JOB(7), { ok: true, job: JOB(7), status: "cancelled", migration: record("applied_without_page", ["menu", "bookings"]) });
  U.inventory = ["menu", "bookings"];
  const u = open(U, siteFor(["menu"]));
  const said = [];
  u.ctx.watchEditJob(u.s, { intent: "addon" }, JOB(7), u.s.id, (t) => said.push(t), null, "Add a booking form", [], undefined, false);
  for (let i = 0; i < 40 && !said.length; i++) { u.flush(); await idle(); }
  await looks(u);
  assert.equal(said.length, 1, "the watched job's ending was not said");
  assert.equal(inventoryReads(U), 1, "this page's own job stopped after its tables went in did not read the site's list again");
  assert.deepEqual(tablesOf(u), ["menu", "bookings"]);
  // THIS PAGE'S OWN QUEUED ADDITION, ITS STORED ANSWER A REFUSAL AFTER ITS TABLE WENT IN.
  const V = server();
  V.answers.set(JOB(8), failed("applied", ["bookings"]));
  V.inventory = ["menu", "bookings", "rooms"];
  const v = open(V, siteFor(["menu"]));
  const told = [];
  v.ctx.watchEditJob(v.s, { intent: "addon" }, JOB(8), v.s.id, (t) => told.push(t), null, "Add a booking form", [], v.ctx.addonAnswer, false);
  for (let i = 0; i < 40 && !told.length; i++) { v.flush(); await idle(); }
  await looks(v);
  assert.equal(told.length, 1, "the watched job's refusal was not said");
  assert.equal(inventoryReads(V), 1, "this page's own queued refusal after its table went in did not read the site's list again");
  assert.deepEqual(tablesOf(v), ["menu", "bookings", "rooms"]);
});
