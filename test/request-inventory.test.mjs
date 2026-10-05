// THE SITE'S TABLES, THREE ANSWERS KEPT APART, FROM THE ROUTE TO THE PAGE AND BACK (2026-10-05).
//
// The owner, reviewing the reconcile round: *"routeTableNames returns [] both
// when the authoritative inventory is successfully empty and when it cannot be
// read, and routeDigest only replaces browser names when names.length is
// nonzero. I reproduced readStoredSpec returning {ok:true,tables:[]} while the
// browser sends ["appointments"]; the router still receives appointments,
// exactly as it does on a read failure. Preserve successful nonempty,
// successful empty, and unavailable results distinctly through the reader,
// routing digest and response. A successful empty inventory must tell the
// model there are no tables; browser hints should be fallback only when the
// authoritative read is unavailable. Check the browser's tablesFilled handling
// too, since it currently ignores empty results and only unions names:
// preserve the success distinction without letting an older response erase a
// newer addition. Test empty sites with stale hints, removal of the last
// table, nonempty inventories, genuine read failures and out-of-order
// responses using varied names. Assert the actual model input and subsequent
// browser routing behavior."*
//
// THE PAGE: its own functions, cut out of public/chat.js and run in a VM
// (`test/fixtures/browser-page.mjs`). Every routing call it makes goes to THE
// REAL WORKER's `POST /api/site/route`, the very request the page built, with
// the site's database and the router stubbed at the network; the database can
// change between calls. What each case reads is what the router was sent (its
// site section) and what the page sends next.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";

const OWNER = { id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" };
const META = ["_meta", "k", "text"];
const EMPTY = { catalog: [META], spec: null };
const DATA_EDIT = { ok: true, layer: "data", applied: [{ table: "classes", id: 2, column: "title" }], cost: 1, reply: "✅ The Tuesday class is renamed.", replySource: "model" };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** A database holding these tables, each with a column, declared in its stored schema. */
function db(...names) {
  return {
    catalog: [...names.flatMap((n) => [[n, "id", "integer"], [n, "label", "text"]]), META],
    spec: { tables: names.map((name) => ({ name, access: "display", columns: [{ name: "label" }] })) },
  };
}

/**
 * THE REQUEST THE PAGE SENT, POSTED TO THE REAL WORKER. `wire` is the site's
 * database for this call (`catalog`, `spec`, and `sqlFail`: statements that
 * fail). Returns the route's answer, the router's site section, and the
 * statements the database was asked.
 */
async function realRoute(slug, body, wire) {
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
      if (u.includes("/rest/v1/site_backends")) return json([{ uid: OWNER.id, brief: "", neon_db: "site_" + slug.replace(/-/g, "_") }]);
      if (u.includes("/rest/v1/site_project")) return json([{ uid: OWNER.id, neon_conn: "postgres://owner_role:npg_InvSecret@ep-inv.eu-west-2.aws.neon.tech/neondb" }]);
      return json([]);
    }
    if (/neon\.tech|\/sql$/.test(u)) {
      let q = "";
      try { q = String(JSON.parse(String((init && init.body) || "{}")).query || ""); } catch { q = ""; }
      seen.sql.push(q);
      const sql = (rows, fields) => json({ command: "SELECT", rowCount: rows.length, rows,
        fields: fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })) });
      if (wire.sqlFail && wire.sqlFail.test(q)) return new Response("could not connect", { status: 500 });
      if (/information_schema\.columns/i.test(q)) return sql(wire.catalog, ["t", "c", "ty"]);
      if (/_meta/i.test(q) && /schema/i.test(q)) return sql(wire.spec === null ? [] : [[JSON.stringify(wire.spec)]], ["v"]);
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
/** What the router was told of the site's tables: names, "none", or "unknown" (nothing said). */
function inventoryTold(route) {
  assert.equal(route.seen.router.length, 1, "the router was not asked exactly once");
  const content = String(route.seen.router[0].messages[0].content);
  const at = content.indexOf("THEIR SITE\n");
  const end = content.indexOf("\n\nWHICH CASE", at);
  assert.ok(at >= 0 && end > at, "the site section's landmarks moved");
  const site = content.slice(at, end);
  const m = /Its database tables are: ([^.]*)\./.exec(site);
  const none = site.includes("It has no database tables.");
  assert.ok(!(m && none), "the router was told both names and none");
  return m ? m[1].split(", ").sort() : none ? "none" : "unknown";
}
const catalogReads = (route) => route.seen.sql.filter((q) => /information_schema\.columns/i.test(q)).length;

/** A page for `slug`, its own record holding `tables`; its routing calls go to the real Worker with the database `S.db`. */
function openSite(slug, tables) {
  const S = { db: EMPTY, calls: [], holds: [] };
  const answer = (url, method, body) => {
    S.calls.push({ url, method, body });
    if (url === "/api/site/route") {
      const call = { sent: copy(body), wire: S.db };
      S.calls[S.calls.length - 1].routed = call;
      const hold = S.holds.shift();
      return realRoute(slug, body, call.wire).then((r) => {
        call.route = r;
        const out = { status: r.status, body: r.body };
        return hold ? hold.then(() => out) : out;
      });
    }
    if (url === "/api/site/edit" && method === "POST") return Promise.resolve({ status: 200, body: copy(DATA_EDIT) });
    if (url.startsWith("/api/site/routes?")) return Promise.resolve({ status: 200, body: { ok: true, slug, routes: ["/"] } });
    return Promise.resolve({ status: 200, body: { ok: true, question: null } });
  };
  const p = page({ site: { id: "origin-" + slug, slug, react: true, name: slug, url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }], msgs: [], tables }, answer, timers: true });
  p.ctx.buildPicker = "sonnet";
  let n = 0;
  p.ctx.EditPoll.newIdemKey = () => "invkey" + String(++n).padStart(14, "0");
  /** The next routing call's answer waits for the promise handed here. */
  S.holdNext = () => { let open; S.holds.push(new Promise((ok) => { open = ok; })); return () => open(); };
  /** Every routing call this page made, in order: what it sent, and what the route did. */
  S.routed = () => S.calls.filter((c) => c.routed).map((c) => c.routed);
  return { S, p };
}
const until = async (ok, ms = 30000) => { for (const t = Date.now() + ms; Date.now() < t && !ok();) await drain(); };
/** One message from the page, routed for real and its edit answered; the database `wire` for its routing call. */
async function send(S, p, words, wire) {
  S.db = wire;
  const before = S.routed().length;
  p.ctx.siteSend(words);
  await until(() => S.routed().length > before && S.routed()[before].route && p.busy() === false);
  const call = S.routed()[before];
  assert.ok(call && call.route, "the page never routed the message");
  assert.equal(p.busy(), false, "the message's edit never finished");
  return call;
}
const tablesOf = (p) => copy(p.s.tables || []);

test("INV 1 — an empty site, a stale hint: the page holds appointments, the site has none — the router is told none, the page lets go of its hint, and a later call whose read fails is told nothing rather than appointments", async () => {
  const { S, p } = openSite("inv-page-empty", ["appointments"]);
  const one = await send(S, p, "Rename the Tuesday class", EMPTY);
  assert.deepEqual(one.sent.site.tables, ["appointments"], "the page did not send what it held");
  assert.ok(catalogReads(one.route) >= 1, "the site's tables were not read");
  assert.equal(inventoryTold(one.route), "none", "the router was told the page's stale names");
  assert.deepEqual(one.route.body.tablesFilled, []);
  assert.deepEqual(tablesOf(p), [], "the page kept a name the site does not have");
  // THE NEXT CALL: its read fails, so the page's list is what stands — now empty.
  const two = await send(S, p, "And the Thursday one", { ...EMPTY, sqlFail: /information_schema/ });
  assert.deepEqual(two.sent.site.tables, []);
  assert.equal(inventoryTold(two.route), "unknown", "a read that failed was told as none, or the stale hint came back");
  assert.equal(two.route.body.tablesFilled, undefined);
});

test("INV 2 — the last table taken away: told waitlist while it is there, told none once it is gone, and told nothing — not waitlist — when the next read fails", async () => {
  const { S, p } = openSite("inv-page-last", []);
  const one = await send(S, p, "How many are on the waitlist?", db("waitlist"));
  assert.deepEqual(inventoryTold(one.route), ["waitlist"]);
  assert.deepEqual(tablesOf(p), ["waitlist"]);
  // THE TABLE GOES (its stored schema kept, emptied): the next read finds none.
  const two = await send(S, p, "Rename the Tuesday class", { catalog: [META], spec: { tables: [] } });
  assert.deepEqual(two.sent.site.tables, ["waitlist"]);
  assert.equal(inventoryTold(two.route), "none", "a site whose last table was taken away was told it still has it");
  assert.deepEqual(tablesOf(p), [], "the page kept the table that was taken away");
  const three = await send(S, p, "And the Thursday one", { catalog: [META], spec: { tables: [] }, sqlFail: /_meta/ });
  assert.deepEqual(three.sent.site.tables, []);
  assert.equal(inventoryTold(three.route), "unknown");
});

test("INV 3 — a nonempty site: its own names replace the page's stale hint, and they are what the page sends when the next read fails", async () => {
  const { S, p } = openSite("inv-page-full", ["appointments"]);
  const one = await send(S, p, "Rename the Tuesday class", db("classes", "members"));
  assert.deepEqual(inventoryTold(one.route), ["classes", "members"]);
  assert.deepEqual([...tablesOf(p)].sort(), ["classes", "members"], "the page did not take the site's names, or kept the stale one");
  const two = await send(S, p, "And the Thursday one", { ...db("classes", "members"), sqlFail: /information_schema/ });
  assert.deepEqual([...two.sent.site.tables].sort(), ["classes", "members"]);
  assert.deepEqual(inventoryTold(two.route), ["classes", "members"]);
});

test("INV 4 — a read that genuinely fails, each way: the page's names are the router's, and the page keeps them", async () => {
  for (const [what, fail] of [["the catalog", /information_schema/], ["the stored schema", /_meta/], ["the database itself", /./]]) {
    const slug = "inv-page-fail-" + what.length;
    const { S, p } = openSite(slug, ["rooms", "guests"]);
    const one = await send(S, p, "Rename the Tuesday class", { ...db("rooms", "guests", "invoices"), sqlFail: fail });
    assert.deepEqual(inventoryTold(one.route), ["guests", "rooms"], what + ": the page's names were not the fallback");
    assert.equal(one.route.body.tablesFilled, undefined, what);
    assert.deepEqual(tablesOf(p), ["rooms", "guests"], what + ": the page changed its list on a read that did not answer");
  }
});

test("INV 5 — out of order between two routing answers: the later read arrives first; the earlier one, arriving after, never takes away what the later one gave — whether it read fewer tables or none", async () => {
  for (const [older, newer] of [[db("studios"), db("studios", "lockers")], [EMPTY, db("lockers")]]) {
    const slug = "inv-page-order-" + older.catalog.length;
    const { S, p } = openSite(slug, []);
    // THE FIRST CALL READS THE OLDER DATABASE; ITS ANSWER IS HELD.
    const release = S.holdNext();
    S.db = older;
    p.ctx.siteRoute(p.s, "Rename the Tuesday class", p.s.id, false, [], () => {}, false, null, "invfirst0000000000");
    await until(() => S.routed().length === 1 && S.routed()[0].route);
    // THE SECOND CALL READS THE NEWER ONE, AND ITS ANSWER ARRIVES FIRST.
    S.db = newer;
    p.ctx.siteRoute(p.s, "And the Thursday one", p.s.id, false, [], () => {}, false, null, "invsecond000000000");
    await until(() => S.routed().length === 2 && S.routed()[1].route && tablesOf(p).includes("lockers"));
    assert.deepEqual([...tablesOf(p)].sort(), newer === EMPTY ? [] : [...newer.spec.tables.map((t) => t.name)].sort());
    release();
    await until(() => false, 300);
    assert.ok(tablesOf(p).includes("lockers"), "the older answer, arriving late, took away a table the newer one gave");
    // AND THE NEXT CALL'S READ SETTLES IT, a whole list again.
    const three = await send(S, p, "And the Friday one", newer);
    assert.deepEqual(inventoryTold(three.route), [...newer.spec.tables.map((t) => t.name)].sort());
    assert.deepEqual([...tablesOf(p)].sort(), [...newer.spec.tables.map((t) => t.name)].sort());
  }
});

test("INV 6 — out of order against an addition: a routing answer read before an addition finished — this page's own, or another browser's — arrives after it, saying none, and the addition's table stays", async () => {
  for (const who of ["own", "other"]) {
    const slug = "inv-page-add-" + who;
    const { S, p } = openSite(slug, []);
    const release = S.holdNext();
    S.db = EMPTY;
    p.ctx.siteRoute(p.s, "Rename the Tuesday class", p.s.id, false, [], () => {}, false, null, "invadd00000000000" + who.length);
    await until(() => S.routed().length === 1 && S.routed()[0].route);
    assert.equal(inventoryTold(S.routed()[0].route), "none");
    // THE ADDITION FINISHES WHILE THE ANSWER IS OUT: its table joins the page's list.
    const added = { ok: true, kinds: ["table"], tables: ["rentals"], cost: 3, reply: "✅ Rentals now have a table.", replySource: "model" };
    if (who === "own") p.ctx.addonAnswer(true, added, { site: p.s, d: { intent: "addon", layer: "" }, instruction: "Track rentals", origin: p.s.id, finish: () => {}, fallback: null, imgs: [], handedOff: false, slug });
    else p.ctx.siteReqRefresh(p.s.id, true, added, true);
    assert.deepEqual(tablesOf(p), ["rentals"], who + ": the addition's table did not join the list");
    release();
    await until(() => false, 300);
    assert.deepEqual(tablesOf(p), ["rentals"], who + ": the late answer saying none took away the addition's table");
    // THE NEXT CALL READS THE SITE AS IT IS NOW, AND THE PAGE TAKES IT WHOLE.
    const two = await send(S, p, "And the Thursday one", db("rentals"));
    assert.deepEqual(inventoryTold(two.route), ["rentals"]);
    assert.deepEqual(tablesOf(p), ["rentals"]);
  }
});

test("INV 7 — an answer whose list holds anything but names is no list: the page's own names stand, and are what it sends next", async () => {
  // THE ROUTE'S ANSWERS, SUPPLIED: a list with a number in it, as no route writes.
  const sent = [];
  const answer = (url, method, body) => {
    if (url === "/api/site/route") {
      sent.push(copy(body));
      return Promise.resolve({ status: 200, body: { ok: true, intent: "edit", layer: "data", cost: 1, tablesFilled: ["rooms", 7] } });
    }
    if (url === "/api/site/edit" && method === "POST") return Promise.resolve({ status: 200, body: copy(DATA_EDIT) });
    return Promise.resolve({ status: 200, body: { ok: true, question: null } });
  };
  const slug = "inv-page-bad";
  const q = page({ site: { id: "origin-" + slug, slug, react: true, name: slug, url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }], msgs: [], tables: ["rooms", "guests"] }, answer, timers: true });
  let n = 0;
  q.ctx.EditPoll.newIdemKey = () => "invbad" + String(++n).padStart(14, "0");
  q.ctx.siteSend("Rename the Tuesday class");
  await until(() => sent.length === 1 && q.busy() === false);
  assert.deepEqual(tablesOf(q), ["rooms", "guests"], "a list holding a number was taken, or coerced");
  q.ctx.siteSend("And the Thursday one");
  await until(() => sent.length === 2 && q.busy() === false);
  assert.deepEqual(sent[1].site.tables, ["rooms", "guests"], "the next call did not send the page's own names");
});
