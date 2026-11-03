// PARKED (2026-11-03, park-old-way): the old-way half of test/request-reconcile.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SITE THE PAGE SHOWS, RECONCILED WITH WHAT IS PUBLISHED NOW (2026-10-05).
//
// The owner, reviewing the watched-refresh correction: *"a fresh browser's first
// refresh leaves the actual preview URL unchanged at ?v=1; fix the shared
// refresh behavior and test the rendered iframe URL, not merely previewV
// increasing. Also, siteReqSeen treats everything completed by the first
// successful request read as already reflected in the loaded site.
// Reproduction: the browser loads the old site, its first request read is
// delayed or fails, the job completes, and the next read finds it done; the
// reply appears and the request closes, but previewV stays unchanged and tables
// remain empty. Reconcile the currently published state without assuming the
// first request read and the loaded preview represent the same moment, while
// preserving history deduplication and avoiding old undo offers or questions.
// Finally, stop treating an addition's table names as a complete site
// inventory: with existing loaves and newly added bookings, routeDigest
// currently receives only bookings and makes zero authoritative table reads.
// Ensure subsequent routing retains access to the complete current inventory
// for both local and cross-browser additions. Cover these cases together with
// repeated polls and out-of-order responses, using the actual refresh and
// routing paths."*
//
// THE PAGE: its own functions, cut out of public/chat.js and run in a VM
// (`test/fixtures/browser-page.mjs`), opened with `frame: true` so every drawing
// runs the render's own frame step and the address it gives the preview frame
// is what these cases read. Its server is SCRIPTED, every answer supplied.
// THE ROUTE: the real Worker's `POST /api/site/route`, handed the very request
// the page sent, with the site's database and the router stubbed at the
// network (`test/fixtures/worker-harness.mjs`), as `route-table-names` drives it.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "../../../test/fixtures/browser-page.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { ASK_TOOL } from "../../../builder/route-shared.mjs";

const SLUG = "fold-lane-bakery";
const URL0 = "https://" + SLUG + ".gofarther.app/";
const KEY = (n) => "reconrequest" + String(n).padStart(10, "0");
const JOB = (n) => "reconjob" + String(n).padStart(24, "0");
// AN HOUR AGO BY THE REAL CLOCK (2026-10-07): the page keeps a request's
// record two days (`SITE_REQ_KEEP_MS`) by the real clock, and the fixed date
// this was expired the records under the cases — a request this browser sent
// read back as one it picked up from the server.
const T0 = Date.now() - 60 * 60 * 1000;
const siteFor = (paths = ["/"], extra = {}) => ({
  id: "origin-1", slug: SLUG, react: true, name: "Fold Lane Bakery", url: URL0,
  pages: paths.map((path) => ({ path })), msgs: [], ...extra,
});
const part = (n, words, status, jobs = [], route = "addon") => ({ n, words, status, ids: jobs.slice(), jobs: jobs.slice(), charged: 0, route });
const view = (key, at, parts, ended = false) => ({ key, state: ended ? "done" : "running", ended, stop: false, at, updatedAt: at, routedUnsaid: 0, parts });
// THE OWNER'S REPRODUCTION: an addition that made a page and a table.
const ADDED = {
  ok: true, kinds: ["page", "table"], added: ["src/routes/gallery.tsx"], tables: ["bookings"], cost: 9,
  reply: "Your Gallery page is up, and bookings now have a table of their own.", replySource: "model",
};
const ORDERS = { ok: true, kinds: ["table"], tables: ["orders"], cost: 3, reply: "Orders now have a table of their own.", replySource: "model" };
// A PAGE TAKEN AWAY, and a row with it — the kind of change that offers an undo.
const REMOVED = {
  ok: true, layer: "page", removed: ["src/routes/visit.tsx"], applied: [{ table: "loaves", id: 3, removed: true, was: { name: "Rye" } }], cost: 0,
  reply: "The Visit page is gone, and so is the Rye loaf.", replySource: "model",
};
const DATA_EDIT = { ok: true, layer: "data", applied: [{ table: "loaves", id: 3, column: "price" }], cost: 1, reply: "The Rye loaf is now £5.", replySource: "model" };

/**
 * THE SERVER, SCRIPTED. `views`/`answers` are its requests and its jobs' stored
 * answers, `routes` the pages the site keeps. `fail(match, n)`: the next `n`
 * matching calls answer 503. `hold(name, match, {stale})`: the call waits for
 * `release(name)`, answering with the state at release — or, `stale`, with the
 * state it was asked in, as a read delivered late does. `onRoute(body)` answers
 * the routing call (a promise is fine); `edit` answers an edit's POST.
 */
function server() {
  const S = { views: new Map(), answers: new Map(), routes: ["/"], calls: [], onRoute: null, edit: null };
  const holds = [];
  const fails = [];
  S.hold = (name, match, opts = {}) => { let open; const p = new Promise((ok) => { open = ok; }); holds.push({ name, match, p, open, used: false, stale: opts.stale === true }); };
  S.release = (name) => { for (const h of holds) if (h.name === name) h.open(); };
  S.fail = (match, n = 1) => fails.push({ match, n });
  const reply = (url, method, body) => {
    if (url === "/api/site/requests/" + SLUG) return { status: 200, body: { ok: true, requests: [...S.views.values()].sort((a, b) => a.at - b.at).map(copy) } };
    if (url.startsWith("/api/site/request/" + SLUG + "/")) {
      // WHETHER ANYTHING WAS ASKED OF THE SITE SINCE A REQUEST (2026-10-07): nothing.
      if (url.endsWith("?newer=1")) return { status: 200, body: { ok: true, newer: false } };
      const v = S.views.get(url.split("/").pop());
      return v ? { status: 200, body: { ok: true, request: copy(v) } } : { status: 404, body: { error: "not found" } };
    }
    if (url === "/api/site/edit" && method === "POST") return S.edit ? { status: 200, body: copy(S.edit) } : null;
    if (url.startsWith("/api/site/edit/")) {
      const a = S.answers.get(url.split("/").pop());
      return a ? { status: 200, headers: { "x-gf-edit": "final" }, body: copy(a) } : { status: 200, body: { ok: true, status: "building" } };
    }
    if (url.startsWith("/api/site/routes?")) return { status: 200, body: { ok: true, slug: SLUG, routes: S.routes.slice() } };
    if (url === "/api/site/" + SLUG + "/question") return { status: 200, body: { ok: true, question: null } };
    if (url === "/api/site/route" && S.onRoute) return S.onRoute(body);
    return { status: 200, body: { ok: true } };
  };
  S.answer = (url, method, body) => {
    S.calls.push({ url, method, body });
    const f = fails.find((x) => x.n > 0 && x.match(url, method));
    if (f) { f.n--; return Promise.resolve({ status: 503, body: { error: "unavailable" } }); }
    // A ROUTES READ, and a STALE hold, answer with the state as it was when asked.
    const now = url.startsWith("/api/site/routes?") ? reply(url, method, body) : null;
    const h = holds.find((x) => !x.used && x.match(url, method));
    if (h) {
      h.used = true;
      const asked = h.stale ? reply(url, method, body) : null;
      return h.p.then(() => now || asked || reply(url, method, body));
    }
    return Promise.resolve(now || reply(url, method, body));
  };
  return S;
}
/** One page load, drawing its frame: a fresh browser's record of the site, or `site` as a reload finds it. */
function openPage(S, site, tag = "pagekey") {
  const p = page({ site: site || siteFor(), answer: S.answer, timers: true, frame: true });
  let n = 0;
  p.ctx.EditPoll.newIdemKey = () => tag + String(++n).padStart(20 - tag.length, "0");
  return p;
}
/** Opened as the real page is: the workspace drawn, its held replies followed, its question and its requests read. */
function opened(p) {
  p.ctx.renderSites();
  p.ctx.siteHeldRepliesCheck(p.s);
  p.ctx.siteAskCheck(p.s);
  p.ctx.siteRequestsCheck(p.s);
  return p;
}
const idle = async () => { await drain(); await drain(); };
const looks = async (p, n = 3) => { for (let i = 0; i < n; i++) { p.flush(); await idle(); } };
const paths = (p) => copy((p.s.pages || []).map((x) => x.path));
const said = (p, key) => copy(p.s.msgs.filter((m) => m.r === "a" && m.req === key && m.job).map((m) => m.job));
const reads = (S, prefix) => S.calls.filter((c) => c.url.startsWith(prefix)).length;
/** The address the preview frame was last given by a drawing — what the panel shows. */
const shown = (p) => { const f = p.frames(); assert.ok(f.length, "the page never drew its frame"); return f[f.length - 1]; };
const kept = (p) => ({ pages: paths(p), tables: copy(p.s.tables || []), undo: copy(p.s.undoRows || null), ask: p.ask(), unsent: (p.s.unsent || []).length });
/** A request another browser is running, its part not finished yet. */
function running(S, key, at, words = "Add a gallery page with bookings", n = 1, route = "addon") {
  S.views.set(key, view(key, at, [part(0, words, "started", [], route)]));
  return {
    finish: (answer, routes) => {
      S.answers.set(JOB(n), answer);
      S.views.set(key, view(key, at, [part(0, words, "done", [JOB(n)], route)], true));
      if (routes) S.routes = routes;
    },
  };
}

// ── THE ROUTE, REAL ────────────────────────────────────────────────────────
const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const CATALOG = [["loaves", "id", "integer"], ["loaves", "name", "text"], ["loaves", "price", "integer"], ["bookings", "id", "integer"], ["bookings", "email", "text"], ["_meta", "k", "text"]];
const SPEC = { tables: [{ name: "loaves", access: "display", columns: [{ name: "name" }, { name: "price" }] }, { name: "bookings", access: "collect", columns: [{ name: "email" }] }] };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/**
 * THE REQUEST THE PAGE SENT, POSTED TO THE REAL WORKER. The site's database
 * answers as `wire` says (`sqlFail` a pattern of statements that fail), the
 * router answers `data`. Returns the route's answer, what the router was told,
 * and the statements the database was asked.
 */
async function realRoute(body, wire = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const seen = { sql: [], router: [] };
  const quiet = {};
  for (const k of ["error", "warn", "log", "info"]) { quiet[k] = console[k]; console[k] = () => {}; }
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (u.includes("/auth/v1/user")) return json(OWNER);
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/")) {
      if (method !== "GET") return json([]);
      if (u.includes("/rest/v1/site_backends")) return json([{ uid: OWNER.id, brief: "", neon_db: "site_" + SLUG.replace(/-/g, "_") }]);
      if (u.includes("/rest/v1/site_project")) return json([{ uid: OWNER.id, neon_conn: "postgres://owner_role:npg_ReconSecret@ep-recon.eu-west-2.aws.neon.tech/neondb" }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(u)) {
      let q = "";
      try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { q = ""; }
      seen.sql.push(q);
      const sql = (rows, fields) => json({ command: "SELECT", rowCount: rows.length, rows,
        fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })) });
      if (wire.sqlFail && wire.sqlFail.test(q)) return new Response("could not connect", { status: 500 });
      if (/information_schema\.columns/i.test(q)) return sql(CATALOG, ["t", "c", "ty"]);
      if (/_meta/i.test(q) && /schema/i.test(q)) return sql([[JSON.stringify(SPEC)]], ["v"]);
      return sql([[1]], ["x"]);
    }
    if (u.startsWith("https://api.anthropic.com/")) {
      let b = {};
      try { b = JSON.parse(String(init && init.body) || "{}"); } catch { b = {}; }
      seen.router.push(b);
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input: { intent: "edit", layer: "data" } }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify(body),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json(), seen };
  } finally {
    globalThis.fetch = real;
    Object.assign(console, quiet);
  }
}
/** The table names the router was told, from the site section of what it was sent. */
function tablesTold(r) {
  assert.equal(r.seen.router.length, 1, "the router was not asked exactly once");
  const content = String(r.seen.router[0].messages[0].content);
  const at = content.indexOf("THEIR SITE\n");
  const end = content.indexOf("\n\nWHICH CASE", at);
  assert.ok(at >= 0 && end > at, "the site section's landmarks moved");
  const m = /Its database tables are: ([^.]*)\./.exec(content.slice(at, end));
  return m ? m[1].split(", ").sort() : [];
}
const catalogReads = (r) => r.seen.sql.filter((q) => /information_schema\.columns/i.test(q)).length;
/**
 * THE PAGE'S NEXT MESSAGE, ROUTED FOR REAL: its routing call goes to the real
 * Worker (`realRoute`), the answer comes back to the page as the route gave it,
 * and the edit it starts is answered `DATA_EDIT`. Returns what the page sent
 * and what the route did with it.
 */
async function sendRouted(S, p, words, wire) {
  const out = {};
  S.edit = DATA_EDIT;
  S.onRoute = (body) => { out.sent = copy(body); return realRoute(body, wire).then((r) => { out.route = r; return { status: r.status, body: r.body }; }); };
  p.ctx.buildPicker = "sonnet";
  p.ctx.siteSend(words);
  // TIME-BOUND, not tick-bound: the real Worker loads on the first call.
  for (const until = Date.now() + 30000; Date.now() < until && !(out.route && p.busy() === false);) await idle();
  assert.ok(out.route, "the page never routed the message");
  assert.equal(p.busy(), false, "the message's edit never finished on the page");
  return out;
}

// ── 3. THE WHOLE TABLE INVENTORY, THROUGH THE REAL ROUTE ──────────────────

test("RECON 6 — this page's own addition: the page holds only bookings, and the next message's routing tells the router loaves and bookings, read from the site; the page keeps them, so a later routing call whose read fails still sends both", async () => {
  const S = server();
  S.views.set(KEY(10), view(KEY(10), T0, [part(0, "Add a gallery page with bookings", "started")]));
  const a = openPage(S, siteFor(["/"]));
  a.ctx.siteRequestStart(a.s.id, { intent: "edit", request: copy(S.views.get(KEY(10))) }, [], "");
  await idle();
  S.answers.set(JOB(1), ADDED);
  S.views.set(KEY(10), view(KEY(10), T0, [part(0, "Add a gallery page with bookings", "done", [JOB(1)])], true));
  S.routes = ["/", "/gallery"];
  await looks(a);
  assert.deepEqual(copy(a.s.tables), ["bookings"], "the case is about a page that holds an addition's tables alone");
  // THE NEXT MESSAGE: the page's own routing request, to the real route.
  const one = await sendRouted(S, a, "Put the Rye loaf's price up to £5");
  assert.deepEqual(one.sent.site.tables, ["bookings"], "the page did not send what it holds");
  assert.ok(catalogReads(one.route) >= 1, "the route made no read of the site's tables");
  assert.deepEqual(tablesTold(one.route), ["bookings", "loaves"], "the router was told an addition's tables alone");
  assert.deepEqual([...copy(a.s.tables)].sort(), ["bookings", "loaves"], "the page did not keep the site's names the route read");
  // A LATER CALL WHOSE OWN READ CANNOT ANSWER: the page's list, now whole, is what stands.
  const two = await sendRouted(S, a, "And the Seeded loaf to £4.50", { sqlFail: /information_schema/ });
  assert.deepEqual([...two.sent.site.tables].sort(), ["bookings", "loaves"]);
  assert.deepEqual(tablesTold(two.route), ["bookings", "loaves"], "a failed read left the router with part of the site");
  assert.equal(two.route.body.tablesFilled, undefined);
});

test("RECON 7 — another browser's addition, finished while this page watched: the same — the router told the whole inventory, read from the site", async () => {
  const S = server();
  const r = running(S, KEY(11), T0);
  const b = opened(openPage(S, siteFor(["/"])));
  await idle();
  await looks(b);
  r.finish(ADDED, ["/", "/gallery"]);
  await looks(b);
  assert.deepEqual(copy(b.s.tables), ["bookings"]);
  const one = await sendRouted(S, b, "Put the Rye loaf's price up to £5");
  assert.deepEqual(one.sent.site.tables, ["bookings"]);
  assert.ok(catalogReads(one.route) >= 1);
  assert.deepEqual(tablesTold(one.route), ["bookings", "loaves"]);
  assert.deepEqual([...copy(b.s.tables)].sort(), ["bookings", "loaves"]);
});

test("RECON 8 — out of order across the two paths: a routing answer read before another browser's addition finished arrives after it — the page keeps every name, losing none", async () => {
  const S = server();
  const r = running(S, KEY(12), T0, "Keep track of orders", 1);
  const b = opened(openPage(S, siteFor(["/"], { tables: ["loaves"] })));
  await idle();
  await looks(b);
  // THE ROUTING CALL GOES OUT; ITS ANSWER IS HELD WHILE THE ADDITION FINISHES.
  let answered = null;
  const late = new Promise((ok) => { answered = ok; });
  const out = {};
  S.edit = DATA_EDIT;
  S.onRoute = (body) => realRoute(body).then((res) => { out.route = res; return late.then(() => ({ status: res.status, body: res.body })); });
  b.ctx.buildPicker = "sonnet";
  b.ctx.siteSend("Put the Rye loaf's price up to £5");
  for (const until = Date.now() + 30000; Date.now() < until && !out.route;) await idle();
  assert.deepEqual(tablesTold(out.route), ["bookings", "loaves"]);
  r.finish(ORDERS);
  await looks(b);
  assert.ok(b.s.tables.includes("orders"), "the watched addition's table was not kept");
  answered();
  for (const until = Date.now() + 30000; Date.now() < until && b.busy();) await idle();
  assert.deepEqual([...copy(b.s.tables)].sort(), ["bookings", "loaves", "orders"], "the late routing answer lost a name, or did not add the site's");
});
