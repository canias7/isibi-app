// ONE MORE ENTRY IN A LIST THE SITE ALREADY STORES, through the add-on step
// (Test 11's capability, 2026-10-01).
//
// THE OWNER'S RULE IS "Add will always go in addon", and until this change no
// add-on kind could add a row to a table the site already has: the trace found
// a refusal or a hand-drawn card on the page while the list, the order form's
// choices and the Data panel stayed as they were. The `row` kind writes the
// entry to the table the pages already read, with the data step's own
// parameterised INSERT, and changes no page.
//
// EVERYTHING HERE GOES THROUGH THE REAL ROUTE, against a database that already
// HAS entries (`fixtures/rows-db.mjs`): the router's answer, the browser's own
// add-on request, the add-on route (inline and through the queue, with the job
// RPCs the live ledger runs), and the customer's screen from the browser's own
// composer. Every model answer is supplied; no model, container, credit or
// network is used. Whether a real router and a real picker answer this way is
// NOT shown here — that is the live test's to show.
//
// RED BEFORE THE FIX: on the code before `row` existed, the picker's answer is
// refused down to no kinds, the route answers `no-add`, and nothing is written —
// so every success case below fails there (the red check is recorded in
// `docs/history/2026-10-01-add-row.md`).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { browserReply } from "../scripts/addon-sweep.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { addon } from "./fixtures/addon-route.mjs";
import { readDataChanges } from "../builder/site-apply.mjs";
import { resolveAccess, ACCESS_PRESETS } from "../site-access.mjs";
// THE NEW PIECES ARE IMPORTED WHERE THEY ARE USED, so this file loads on the
// code before them too: the red check runs every route case against the old
// route, and only the cases about the new pieces fail to find them.
const add = () => import("../builder/site-add.mjs");
const rowsModule = () => import("../builder/site-rows.mjs");

const USER = { id: "u-addon-row-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const CONN = "postgres://u:p@ep-rows.neon.tech/neondb";
const hex = (n) => randomBytes(n).toString("hex");
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: the bakery's stored pages and schema, and a database with entries
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx", "gallery.tsx"].map((path) => ({
  path, source: readFileSync(new URL("./fixtures/run47/" + path.replace(/\.tsx$/, ".before.tsx"), import.meta.url), "utf8"),
}));
const ROUTES = ["/", "/order", "/starter", "/visit", "/gallery"];
// `loaves` the owner's display list, `orders` the visitors' submissions.
const SPEC = { tables: [
  { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" },
  { name: "orders", columns: [{ name: "customer_name", type: "text" }, { name: "loaf", type: "int" }], read: "none", write: "anyone" },
] };
const ORDER_COLUMNS = [{ name: "id", type: "integer" }, { name: "customer_name", type: "text" }, { name: "loaf", type: "integer" }, { name: "created_at", type: "timestamp with time zone" }];
const ORDERS = [{ id: 1, customer_name: "A. Visitor", loaf: 2, created_at: "2026-09-02 10:00:00" }];

/**
 * THE DATABASE, as the bakery holds it. `next` is the sequence's own position:
 * 12, not 7, as on a table that has lost entries — so a test that reads 7 back
 * would be reading a guess, not the database's answer.
 */
function bakeryDb(opts = {}) {
  return rowsDb({
    tables: {
      loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12, unique: opts.unique || [] },
      orders: { columns: ORDER_COLUMNS, rows: ORDERS },
    },
    meta: { schema: JSON.stringify(SPEC) },
    failWrite: opts.failWrite || null,
    hideMarker: opts.hideMarker || 0,
    noMeta: !!opts.noMeta,
  });
}

const ASK = "Add one loaf to today's loaves: Rye & Caraway at £5.00, described as \"A light rye with toasted caraway.\"";
const ENTRY = { table: "loaves", values: { name: "Rye & Caraway", price: 5, description: "A light rye with toasted caraway." } };
const PICK_ROW = { kinds: ["row"] };

function bucket(slug) {
  const store = new Map();
  store.set("source/" + slug + "/pages.json", JSON.stringify(PAGES));
  store.set("source/" + slug + "/parts.json", JSON.stringify([]));
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Fold Lane Bakery", theme: "broadsheet" }, css: "" }));
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

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRE: the model per tool, the job RPCs as the live ledger answers them,
// the database, and one timeline of what happened in what order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `edit_create` IS IDEMPOTENT ON (uid, slug, op, idem) and `edit_reserve` ON
 * (job, seq), as the live functions are (`supabase/applied/…live_snapshot…`):
 * a second create with the same key answers the first job as a duplicate, a
 * second reserve of the same sequence answers `repeat` and charges nothing.
 */
function wire({ db, answers, slug, reserveRefuses = false, usage = {} }) {
  const real = globalThis.fetch;
  const seen = { timeline: [], models: [], debits: [], rpc: [], uploads: 0, jobs: new Map(), ledger: new Map(), done: new Set() };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = url.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      seen.timeline.push("rpc:" + fn);
      switch (fn) {
        case "edit_create": {
          if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(args.p_idem || ""))) return json({ ok: false, error: "bad-idem" });
          const key = [args.p_uid, args.p_slug, args.p_op, args.p_idem].join("|");
          if (seen.jobs.has(key)) return json({ ok: true, job: seen.jobs.get(key), state: "queued", duplicate: true });
          seen.jobs.set(key, args.p_id);
          return json({ ok: true, job: args.p_id, state: "queued", duplicate: false });
        }
        // A JOB THAT HAS FINISHED IS NOT CLAIMED AGAIN — the live function's
        // `terminal` answer — so a second delivery of its message runs nothing.
        case "edit_claim":
          if (seen.done.has(args.p_id)) return json({ ok: true, claimed: false, state: "done", reason: "terminal" });
          return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": {
          if (reserveRefuses) return json({ ok: false, error: "insufficient", cost: 0 });
          const ref = args.p_id + "#" + args.p_seq;
          if (seen.ledger.has(ref)) return json({ ok: true, charged: 0, repeat: true, billing: "reserved" });
          seen.ledger.set(ref, Number(args.p_cost) || 0);
          return json({ ok: true, charged: Number(args.p_cost) || 0, billing: "reserved" });
        }
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize":
          if (args.p_ok) seen.done.add(args.p_id);
          return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund":
          seen.done.add(args.p_id);
          return json({ ok: true, refunded: [...seen.ledger.entries()].filter(([k]) => k.startsWith(args.p_id + "#")).reduce((n, [, v]) => n + v, 0) });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); seen.timeline.push("debit"); return json(Number(args.cost) || 0); }
    if (url.includes("/rest/v1/edit_traces")) return json([], 201);
    // A BLANK REFERENCE AND A REAL DATABASE — the demo sites' own state.
    if (url.includes("/rest/v1/site_backends")) {
      const m = String((init && init.method) || "GET").toUpperCase();
      if (m === "PATCH") return json([{ slug: "x", neon_db: "sitedb" }]);
      if (m === "POST") return json([], 201);
      return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    }
    if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_project: "proj-1", neon_branch: "br-1", neon_role: "owner", neon_conn: CONN }]);
    if (url.includes("/rest/v1/")) return json([]);
    if (url.includes("neon.tech/sql")) {
      const q = String(args.query || "");
      seen.timeline.push("sql:" + q.slice(0, 40));
      const own = db.answer(q, Array.isArray(args.params) ? args.params : []);
      if (own) return own;
      return json({ command: "SELECT", rowCount: 0, rows: [], fields: [] });
    }
    if (url.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push({ tool, args });
      seen.timeline.push("model:" + tool);
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = typeof answers[tool] === "function" ? answers[tool](args) : answers[tool];
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: a }], usage: Object.hasOwn(usage, tool) ? usage[tool] : { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) { seen.uploads++; return dispatchOk(); }
    return new Response("unavailable", { status: 503 });
  };
  return { seen, restore: () => { globalThis.fetch = real; } };
}

const baseEnv = (store, extra = {}) => ({
  SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key",
  SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...extra,
});

/** The add-on POST, as `siteAddon` sends it (picked model pinned, so the Anthropic shape answers). */
const post = (slug, body) => new Request("https://gofarther.dev/api/site/" + slug + "/addon", {
  method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN }, body: JSON.stringify(body),
});

/** Run one stored job through the real queue consumer, as many times as asked. */
async function runJob(worker, env, id) {
  const ctx = makeCtx();
  await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
  await Promise.allSettled(ctx.pending || []);
}

/** The reply the consumer stored for a job, as the browser's poll reads it. */
function storedReply(seen, nth = -1) {
  const fins = seen.rpc.filter((r) => r.fn === "edit_finalize");
  assert.ok(fins.length, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
  const fin = fins.at(nth);
  return { status: fin.args.p_result.status, body: JSON.parse(fin.args.p_result.body), ok: fin.args.p_ok };
}

/** The customer's screen, from the browser's own add-on composer. */
function screen(status, body) {
  const said = browserReply(body, status >= 200 && status < 300);
  assert.ok(said.ok, "the browser's own composer could not run: " + said.why);
  return said;
}

const writesOf = (db) => db.writes().map((w) => w.query);
const unchangedSix = (db) => assert.deepEqual(db.rows("loaves").slice(0, 6), BAKERY_LOAVES, "an existing entry moved");

// ─────────────────────────────────────────────────────────────────────────────
// THE BROWSER HOP, DRIVEN: `siteAddon` cut out of chat.js
// ─────────────────────────────────────────────────────────────────────────────

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (head) => {
  const open = CHAT.indexOf("\nfunction " + head + "(");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
  return CHAT.slice(open, shut + 2);
};

/** What the browser POSTs for an `addon` routing answer — URL and body exactly as sent. */
function browserAddonPost(site, d, instruction) {
  const sent = [];
  const ctx = vm.createContext({
    EditPoll: { newIdemKey: () => "idem-addon-row-" + hex(8) },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    apiFetch: (url, init) => { sent.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext(cut("siteAddon"), ctx);
  ctx.siteAddon(site, instruction, "origin-1", () => {}, () => {}, d);
  assert.equal(sent.length, 1, "the browser made " + sent.length + " requests, not one");
  return { url: sent[0].url, body: JSON.parse(sent[0].init.body) };
}

/**
 * ONE MESSAGE THROUGH THE WHOLE CHAIN: the routing route answers `addon`, the
 * browser composes its add-on POST, the add-on route runs it — inline, or
 * filed and run by the queue consumer — and the browser's composer reads it.
 */
async function chain({ mode, db, answers, message = ASK, usage }) {
  const slug = "addon-row-" + mode + "-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers: { [ASK_TOOL.name]: { intent: "addon" }, ...answers }, usage });
  try {
    const worker = await loadWorker();
    const env = baseEnv(store, mode === "job" ? { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: slug, BUILD_QUEUE: { send: async (m) => { w.seen.sent = (w.seen.sent || []).concat([m]); } } } : {});
    const rres = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ message, site: { name: "Fold Lane Bakery", url: "https://" + slug + ".gofarther.app", pages: ROUTES, tables: ["loaves", "orders"] },
        picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug, hasSite: true }),
    }), env, makeCtx());
    const d = await rres.json();
    assert.equal(d.intent, "addon", "the routing route did not hand the browser an addon answer: " + JSON.stringify(d));
    const site = { slug, name: "Fold Lane Bakery", react: true, pages: ROUTES.map((p) => ({ path: p })), msgs: [] };
    const sent = browserAddonPost(site, d, message);
    assert.equal(sent.url, "/api/site/" + slug + "/addon", "the browser did not post to the add-on route");
    const res = await worker.fetch(post(slug, sent.body), env, makeCtx());
    let status = res.status;
    let body = await res.json().catch(() => null);
    if (mode === "job") {
      assert.equal(status, 202, "the add-on route did not file a job: " + JSON.stringify(body));
      await runJob(worker, env, body.job);
      ({ status, body } = storedReply(w.seen));
    }
    return { slug, store, d, sent, status, body, seen: w.seen, said: screen(status, body), env, worker };
  } finally { w.restore(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE ENTRY IS SAVED, WITH THE DATABASE'S OWN ID, AND NOTHING ELSE MOVES
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test(`an entry is added to a list that already has entries, with the database's id and no page work (${mode})`, async () => {
    const db = bakeryDb();
    const before = { pages: null, schema: db.meta("schema"), orders: db.rows("orders") };
    const r = await chain({ mode, db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
    before.pages = JSON.stringify(PAGES);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true);
    // THE DATABASE: exactly one new entry, after the six, with ITS id.
    const loaves = db.rows("loaves");
    assert.equal(loaves.length, 7, "not exactly one entry was added");
    unchangedSix(db);
    const added = loaves[6];
    assert.equal(added.id, 12, "the entry's id is not the one the database assigned");
    assert.deepEqual(added, { id: 12, name: "Rye & Caraway", description: "A light rye with toasted caraway.", price: 5, photo: null, created_at: "2026-10-01T03:00:00.000000+00:00" });
    // THE ANSWER IS WHAT WAS SAVED: the database's row, id and all.
    assert.deepEqual(r.body.kinds, ["row"]);
    assert.equal(r.body.rows.length, 1);
    assert.deepEqual(r.body.rows[0], { table: "loaves", id: 12, label: "Rye & Caraway", row: added });
    // WHAT THE CUSTOMER READS, from the browser's own composer.
    assert.equal(r.said.text, "✅ Done — added “Rye & Caraway” to loaves (entry 12).");
    // NOTHING ELSE MOVED: the other list, the schema, the pages; no page call,
    // no compile, no publish.
    assert.deepEqual(db.rows("orders"), before.orders, "the visitors' list moved");
    assert.equal(db.meta("schema"), before.schema, "the stored schema was rewritten");
    assert.equal(r.store.store.get("source/" + r.slug + "/pages.json"), before.pages, "the stored pages changed");
    assert.ok(!r.seen.models.some((m) => m.tool === "write_pages"), "a page call was made");
    assert.equal(r.seen.uploads, 0, "something was published");
    assert.deepEqual(r.body.added, []); assert.deepEqual(r.body.changed, []);
    // ONE WRITE, AND IT IS THE ROW STEP'S: every value a bound parameter.
    const writes = writesOf(db);
    assert.equal(writes.length, 1, "more than one write: " + JSON.stringify(writes));
    assert.match(writes[0], /^WITH r0 AS \(INSERT INTO "loaves" \("name", "price", "description"\) VALUES \(\$1, \$2, \$3\) RETURNING \*\)/);
    assert.doesNotMatch(writes[0], /Rye|Caraway|toasted/, "a value was written into the SQL text instead of bound");
    // THE MODEL CALLS: the picker and the one row designer, nothing more.
    assert.deepEqual(r.seen.models.map((m) => m.tool).filter((t) => t !== ASK_TOOL.name), ["pick_adds", "add_to_site"]);
  });
}

test("the money: inline, one collection after the write; queued, one reserve before it and no refund", async () => {
  const sync = await chain({ mode: "sync", db: bakeryDb(), answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  // ROUTING IS BILLED ON ITS OWN ROUTE (its own debit); the add-on's is the last.
  const syncTimeline = sync.seen.timeline;
  const write = syncTimeline.findIndex((e) => e.startsWith("sql:WITH r0"));
  const lastDebit = syncTimeline.lastIndexOf("debit");
  assert.ok(write > 0 && lastDebit > write, "the inline charge does not follow the write: " + JSON.stringify(syncTimeline));
  assert.equal(sync.seen.debits.at(-1), sync.body.cost, "the reply's cost is not what was collected");
  assert.ok(sync.body.cost >= 1);

  const job = await chain({ mode: "job", db: bakeryDb(), answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  const t = job.seen.timeline;
  const reserve = t.indexOf("rpc:edit_reserve");
  const jobWrite = t.findIndex((e) => e.startsWith("sql:WITH r0"));
  assert.ok(reserve > 0 && jobWrite > reserve, "the reserve does not come before the write: " + JSON.stringify(t));
  const reserves = job.seen.rpc.filter((r) => r.fn === "edit_reserve");
  assert.equal(reserves.length, 1);
  assert.equal(reserves[0].args.p_seq, 1);
  assert.equal(job.body.cost, Number(reserves[0].args.p_cost), "the reply's cost is not the reserve");
  assert.equal(job.seen.rpc.filter((r) => r.fn === "edit_refund").length, 0, "a successful entry was refunded");
  assert.equal(storedReply(job.seen).ok, true, "the job was not finalized as shipped");
  // THE ADD-ON ITSELF NEVER COLLECTS UNDER A JOB — the reserve is its charge.
  const routingDebits = 1;
  assert.equal(job.seen.debits.length, routingDebits, "the queued add-on collected beside its reserve");
});

test("the one charge counts the row designer's own work, not the picker's alone", async () => {
  // PRICED ON A USAGE LARGE ENOUGH TO MOVE THE WHOLE-CREDIT TOTAL, the same
  // request costs more: the designer's usage is on the bill. With the tiny
  // usage every other case supplies, both come to the 1-credit minimum, which
  // is why the sweep's W-15 survived them.
  const answers = { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } };
  const small = await chain({ mode: "sync", db: bakeryDb(), answers });
  const large = await chain({ mode: "sync", db: bakeryDb(), answers, usage: { add_to_site: { input_tokens: 40000, output_tokens: 4000 } } });
  assert.equal(small.body.ok && large.body.ok, true, JSON.stringify([small.body, large.body]));
  assert.ok(large.body.cost > small.body.cost, "the designer's usage did not reach the bill: " + small.body.cost + " → " + large.body.cost);
  assert.equal(large.seen.debits.at(-1), large.body.cost, "the reply's cost is not what was collected");
});

test("the model's `id` and `created_at` are never written: the database's are", async () => {
  const db = bakeryDb();
  const r = await chain({ mode: "sync", db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [{ table: "loaves", values: { ...ENTRY.values, id: 7, created_at: "1999-01-01" } }] } } });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(db.rows("loaves")[6].id, 12);
  assert.equal(db.rows("loaves")[6].created_at, "2026-10-01T03:00:00.000000+00:00");
  assert.doesNotMatch(writesOf(db)[0], /"id"|"created_at"/, "the model's id or time reached the INSERT");
});

test("two entries asked in one message are saved in one statement, in the order asked, each with its own id", async () => {
  const db = bakeryDb();
  const SPELT = { table: "loaves", values: { name: "Spelt", price: 5.5 } };
  const r = await chain({ mode: "sync", db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY, SPELT] } } });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  unchangedSix(db);
  assert.deepEqual(db.rows("loaves").slice(6).map((x) => [x.id, x.name]), [[12, "Rye & Caraway"], [13, "Spelt"]]);
  // THE ANSWER IN THE ORDER ASKED, each entry with the id the database gave it.
  assert.deepEqual(r.body.rows.map((x) => [x.table, x.id, x.label]), [["loaves", 12, "Rye & Caraway"], ["loaves", 13, "Spelt"]]);
  assert.equal(writesOf(db).length, 1, "the entries were not written in one statement");
  assert.equal(r.said.text, "✅ Done — added “Rye & Caraway” to loaves (entry 12), added “Spelt” to loaves (entry 13).");
});

test("the row designer is told the lists it may add to — the display list, never the visitors' one", async () => {
  const { MAX_ADD_ROWS } = await add();
  const r = await chain({ mode: "sync", db: bakeryDb(), answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  const designer = r.seen.models.find((m) => m.tool === "add_to_site");
  const text = String(designer.args.messages[0].content);
  const at = text.indexOf("THE LISTS A NEW ENTRY CAN GO IN");
  assert.ok(at > 0, "the designer was not told which lists take an entry");
  const block = text.slice(at);
  assert.match(block, /- loaves \(name, description, price, photo\)/);
  assert.doesNotMatch(block, /- orders/, "the visitors' list was offered as one to add to");
  // AND ITS TOOL IS THE `row` KIND'S: a list of { table, values }.
  const props = designer.args.tools[0].input_schema.properties;
  assert.deepEqual(Object.keys(props), ["row"]);
  assert.deepEqual(props.row.items.required, ["table", "values"]);
  assert.equal(props.row.maxItems, MAX_ADD_ROWS);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DUPLICATE SUBMISSION AND REPLAY: one entry, one charge
// ─────────────────────────────────────────────────────────────────────────────

test("the same request sent twice files one job, and that job saves one entry with one reserve", async () => {
  const db = bakeryDb();
  const slug = "addon-row-dup-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    const worker = await loadWorker();
    const sent = [];
    const env = baseEnv(store, { EDIT_ASYNC: "1", EDIT_ASYNC_CANARY: slug, BUILD_QUEUE: { send: async (m) => { sent.push(m); } } });
    const body = { instruction: ASK, picker: "sonnet", idem: "idem-dup-" + hex(8), tz: "Europe/London" };
    const first = await worker.fetch(post(slug, body), env, makeCtx());
    const firstBody = await first.json();
    const again = await worker.fetch(post(slug, body), env, makeCtx());
    const againBody = await again.json();
    assert.equal(first.status, 202);
    assert.equal(again.status, 200, "a duplicate was answered as something created");
    assert.equal(againBody.duplicate, true);
    assert.equal(againBody.job, firstBody.job, "the second POST filed a second job");
    assert.equal(sent.length, 1, "the queue was rung twice");
    await runJob(worker, env, firstBody.job);
    assert.equal(db.rows("loaves").length, 7);
    assert.equal(w.seen.rpc.filter((r) => r.fn === "edit_reserve").length, 1);
    assert.equal(w.seen.debits.length, 0, "the queued add-on collected");
  } finally { w.restore(); }
});

/**
 * A FINISHED QUEUED JOB, and the two ways its request could meet the route again.
 *
 * THE MACHINERY'S OWN GUARDS COME FIRST. `edit_claim` takes only a job that has
 * not finished and holds no live lease, and the consumer deletes the stored
 * request the moment it has read it (`runQueuedSiteEdit`; the container runner
 * does the same through the gateway) — so a second delivery of a finished
 * job's message runs nothing, and a run that dies after its write leaves no
 * request to run again. `again()` is for the case those guards do not reach:
 * the same job's request run a second time with the job left open, as a run
 * that died before finishing would leave it. The `_meta` key is the last guard.
 */
async function finishedJob({ db, answers }) {
  const slug = "addon-row-replay-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers });
  const worker = await loadWorker();
  const env = baseEnv(store);
  const id = hex(16);
  const request = () => JSON.stringify(packEditJob({
    url: "https://gofarther.dev/api/site/" + slug + "/addon",
    body: JSON.stringify({ instruction: ASK, picker: "sonnet", idem: "idem-replay-" + id, tz: "Europe/London" }),
    uid: USER.id, slug, secret: hex(16), at: Date.now(),
  }));
  store.store.set(EDIT_JOB_PREFIX + id, request());
  await runJob(worker, env, id);
  const again = async () => {
    w.seen.done.delete(id);
    store.store.set(EDIT_JOB_PREFIX + id, request());
    await runJob(worker, env, id);
  };
  return { slug, store, w, worker, env, id, again };
}

test("a second delivery of a finished job's message runs nothing: no claim, no model call, no reserve, no row", async () => {
  const db = bakeryDb();
  const j = await finishedJob({ db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    assert.equal(storedReply(j.w.seen).body.ok, true);
    const models = j.w.seen.models.length;
    const fins = j.w.seen.rpc.filter((r) => r.fn === "edit_finalize").length;
    await runJob(j.worker, j.env, j.id);
    assert.equal(db.rows("loaves").length, 7, "the second delivery wrote an entry");
    assert.equal(j.w.seen.models.length, models, "the second delivery called a model");
    assert.equal(j.w.seen.rpc.filter((r) => r.fn === "edit_reserve").length, 1, "the second delivery reserved");
    assert.equal(j.w.seen.rpc.filter((r) => r.fn === "edit_finalize").length, fins, "the second delivery stored a reply");
  } finally { j.w.restore(); }
});

test("should the same job's request run again after its write, it answers the saved entry: no model call, no second reserve, no second row", async () => {
  const db = bakeryDb();
  const j = await finishedJob({ db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    const first = storedReply(j.w.seen);
    assert.equal(first.body.ok, true, JSON.stringify(first.body));
    const modelsBefore = j.w.seen.models.length;
    const reservesBefore = j.w.seen.rpc.filter((r) => r.fn === "edit_reserve").length;
    await j.again();
    const replay = storedReply(j.w.seen);
    assert.equal(db.rows("loaves").length, 7, "the second run wrote a second entry");
    unchangedSix(db);
    assert.equal(j.w.seen.models.length, modelsBefore, "the second run called a model");
    assert.equal(j.w.seen.rpc.filter((r) => r.fn === "edit_reserve").length, reservesBefore, "the second run reserved again");
    assert.equal(replay.body.ok, true);
    assert.equal(replay.body.repeat, true);
    assert.deepEqual(replay.body.rows, first.body.rows, "the second run did not answer the entry the first saved");
    assert.equal(replay.body.cost, first.body.cost, "the second run's cost is not the first run's reserve");
    assert.equal(replay.ok, true);
    assert.equal(j.w.seen.rpc.filter((r) => r.fn === "edit_refund").length, 0);
    assert.equal(screen(replay.status, replay.body).text, "✅ Done — added “Rye & Caraway” to loaves (entry 12).");
  } finally { j.w.restore(); }
});

test("two runs of one job racing past the check save the entry once: the second's write is refused on the key and answers the first's", async () => {
  // THE SECOND RUN'S CHECK LOSES THE RACE (its read misses the key the first
  // just saved), so it designs, reserves and writes — and the statement's key
  // refuses that write whole.
  const db = bakeryDb({ hideMarker: 1 });
  const j = await finishedJob({ db, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    const first = storedReply(j.w.seen);
    await j.again();
    const second = storedReply(j.w.seen);
    assert.equal(writesOf(db).length, 2, "the second run never attempted its write — this case tests nothing");
    assert.equal(db.rows("loaves").length, 7, "the race wrote two entries");
    unchangedSix(db);
    assert.equal(second.body.ok, true, JSON.stringify(second.body));
    assert.equal(second.body.repeat, true);
    assert.deepEqual(second.body.rows, first.body.rows);
    // ONE CHARGE: the same sequence reserved twice is one ledger row.
    assert.equal(j.w.seen.rpc.filter((r) => r.fn === "edit_reserve").length, 2, "the second run did not reach its reserve");
    assert.equal(j.w.seen.ledger.size, 1, "the race charged twice");
    assert.equal(second.body.cost, first.body.cost);
  } finally { j.w.restore(); }
});

test("inline, two sends of one request racing past the check save once and charge once", async () => {
  const db = bakeryDb({ hideMarker: 1 });
  const slug = "addon-row-race-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    const worker = await loadWorker();
    const env = baseEnv(store);
    const body = { instruction: ASK, picker: "sonnet", idem: "idem-race-" + hex(8), tz: "Europe/London" };
    const a = await (await worker.fetch(post(slug, body), env, makeCtx())).json();
    const b = await (await worker.fetch(post(slug, body), env, makeCtx())).json();
    assert.equal(writesOf(db).length, 2, "the second send never attempted its write — this case tests nothing");
    assert.equal(db.rows("loaves").length, 7, "two sends of one request wrote two entries");
    assert.equal(b.repeat, true);
    assert.deepEqual(b.rows, a.rows);
    assert.equal(b.cost, 0);
    assert.deepEqual(w.seen.debits, [a.cost], "the race was charged twice");
  } finally { w.restore(); }
});

test("inline, the same POST resent answers what it saved, charges nothing more and writes nothing more", async () => {
  const db = bakeryDb();
  const slug = "addon-row-resend-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    const worker = await loadWorker();
    const env = baseEnv(store);
    const body = { instruction: ASK, picker: "sonnet", idem: "idem-resend-" + hex(8), tz: "Europe/London" };
    const a = await (await worker.fetch(post(slug, body), env, makeCtx())).json();
    const debits = w.seen.debits.length;
    const models = w.seen.models.length;
    const b = await (await worker.fetch(post(slug, body), env, makeCtx())).json();
    assert.equal(db.rows("loaves").length, 7);
    assert.equal(w.seen.debits.length, debits, "the resend was charged");
    assert.equal(w.seen.models.length, models, "the resend called a model");
    assert.equal(b.repeat, true);
    assert.equal(b.cost, 0);
    assert.deepEqual(b.rows, a.rows);
  } finally { w.restore(); }
});

test("a second message asking again adds a second entry — the guard is per request, not per wording", async () => {
  const db = bakeryDb();
  const slug = "addon-row-twice-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } } });
  try {
    const worker = await loadWorker();
    const env = baseEnv(store);
    const a = await (await worker.fetch(post(slug, { instruction: ASK, picker: "sonnet", idem: "idem-one-" + hex(8) }), env, makeCtx())).json();
    const b = await (await worker.fetch(post(slug, { instruction: ASK, picker: "sonnet", idem: "idem-two-" + hex(8) }), env, makeCtx())).json();
    assert.equal(a.ok && b.ok, true);
    assert.deepEqual(db.rows("loaves").slice(6).map((r) => r.id), [12, 13]);
    assert.notEqual(a.rows[0].id, b.rows[0].id);
    assert.equal(b.repeat, undefined);
  } finally { w.restore(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. WHAT IS REFUSED: nothing written, nothing charged, said by name
// ─────────────────────────────────────────────────────────────────────────────

async function refused(answer, opts = {}) {
  const db = opts.db || bakeryDb();
  const r = await chain({ mode: opts.mode || "sync", db, answers: { pick_adds: PICK_ROW, add_to_site: answer } });
  return { r, db };
}

const INVALID = [
  ["a list the site does not store", { row: [{ table: "cakes", values: { name: "Lemon drizzle" } }] }, "row-no-table", /doesn't store a list by that name/],
  ["the visitors' own list", { row: [{ table: "orders", values: { customer_name: "Somebody" } }] }, "row-not-list", /what visitors send in/],
  ["no column the list declares", { row: [{ table: "loaves", values: { flavour: "caraway", id: 4 } }] }, "row-no-values", /what that entry should say/],
  ["no values at all", { row: [{ table: "loaves", values: {} }] }, "row-no-values", /what that entry should say/],
  ["no list named", { row: [{ values: { name: "Rye" } }] }, "no-row-table", /which list that goes in/],
];
for (const [name, answer, reason, said] of INVALID) {
  test(`refused, at no cost and with nothing written: ${name}`, async () => {
    const { r, db } = await refused(answer);
    assert.equal(r.status, 422, JSON.stringify(r.body));
    assert.equal(r.body.ok, false);
    assert.equal(r.body.reason, reason);
    assert.equal(r.body.cost, 0);
    assert.match(r.body.msg, said);
    assert.match(r.body.msg, /Nothing was added\.$/);
    assert.deepEqual(writesOf(db), [], "a refused entry was written");
    assert.equal(db.rows("loaves").length, 6);
    assert.equal(r.seen.debits.length, 1, "the refusal was charged beside the routing");
    assert.match(r.said.text, /^⚠️ /);
  });
}

test("the designer answering nothing is a decline, at no cost", async () => {
  const { r, db } = await refused({});
  assert.equal(r.status, 422);
  assert.equal(r.body.error, "declined");
  assert.equal(r.body.cost, 0);
  assert.deepEqual(writesOf(db), []);
});

test("one good entry beside a refused one: the good one is saved and the other is named", async () => {
  const { r, db } = await refused({ row: [ENTRY, { table: "orders", values: { customer_name: "Somebody" } }] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(db.rows("loaves").length, 7);
  assert.equal(db.rows("orders").length, 1, "an entry reached the visitors' list");
  assert.equal(r.body.notAdded.length, 1);
  assert.equal(r.body.notAdded[0].why, "row-not-list");
  assert.match(r.said.text, /^✅ Done — added “Rye & Caraway” to loaves \(entry 12\)\. I left out “orders”: That list holds what visitors send in/);
});

for (const mode of ["sync", "job"]) {
  test(`a write the database refuses saves nothing and charges nothing (${mode})`, async () => {
    // THE DATABASE'S OWN REFUSAL: "£5.00" is not a number Postgres reads.
    const { r, db } = await refused({ row: [{ table: "loaves", values: { ...ENTRY.values, price: "£5.00" } }] }, { mode });
    assert.equal(r.status, 502, JSON.stringify(r.body));
    assert.equal(r.body.error, "row-write");
    assert.equal(r.body.detail, "22P02");
    assert.equal(r.body.cost, 0);
    assert.equal(db.rows("loaves").length, 6, "a refused write left an entry");
    assert.deepEqual(db.metaKeys().filter((k) => k.startsWith("addon-row:")), [], "a refused write left its key");
    assert.match(r.said.text, /couldn't save that entry/);
    if (mode === "sync") assert.equal(r.seen.debits.length, 1, "a failed write was charged beside the routing");
    else {
      // RESERVED BEFORE THE WRITE, AND GIVEN BACK BECAUSE THE REPLY DID NOT SHIP.
      assert.equal(r.seen.rpc.filter((x) => x.fn === "edit_reserve").length, 1);
      assert.equal(r.seen.rpc.filter((x) => x.fn === "edit_refund").length, 1, "the failed write's reserve was not refunded");
      assert.equal(storedReply(r.seen).ok, false);
    }
  });
}

test("a list that does not allow two entries the same refuses a duplicate by name", async () => {
  const db = bakeryDb({ unique: ["name"] });
  const { r } = await refused({ row: [{ table: "loaves", values: { name: "Dark Rye", price: 5.2 } }] }, { db });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error, "row-duplicate");
  assert.equal(r.body.cost, 0);
  assert.equal(db.rows("loaves").length, 6);
});

test("a database with no `_meta` table: the check reads nothing saved, and the write is refused whole — nothing saved, nothing charged", async () => {
  // THE KEY'S TABLE IS MISSING, a state a recovery can meet. The check before
  // the picker reads that as "nothing saved yet" and lets the request run, so
  // every other kind of addition — whose schema apply makes `_meta` — is not
  // stopped by it. The entry's own statement names `_meta`, so Postgres refuses
  // it whole: the honest outcome is a failed write, never an entry saved
  // without its key.
  const db = bakeryDb({ noMeta: true });
  const { r } = await refused({ row: [ENTRY] }, { db });
  assert.ok(r.seen.models.some((m) => m.tool === "pick_adds"), "the missing table stopped the request before the picker");
  assert.equal(r.status, 502, JSON.stringify(r.body));
  assert.equal(r.body.error, "row-write");
  assert.equal(r.body.detail, "42P01");
  assert.equal(r.body.cost, 0);
  assert.equal(db.rows("loaves").length, 6, "an entry was saved without its key");
  assert.equal(r.seen.debits.length, 1, "the failed write was charged beside the routing");
});

test("a ledger that refuses the reserve stops the job before anything is written", async () => {
  const db = bakeryDb();
  const slug = "addon-row-broke-" + hex(4);
  const store = bucket(slug);
  const w = wire({ db, slug, answers: { pick_adds: PICK_ROW, add_to_site: { row: [ENTRY] } }, reserveRefuses: true });
  try {
    const worker = await loadWorker();
    const env = baseEnv(store);
    const id = hex(16);
    store.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({
      url: "https://gofarther.dev/api/site/" + slug + "/addon",
      body: JSON.stringify({ instruction: ASK, picker: "sonnet", idem: "idem-broke-" + hex(8) }),
      uid: USER.id, slug, secret: hex(16), at: Date.now(),
    })));
    await runJob(worker, env, id);
    const reply = storedReply(w.seen);
    assert.equal(reply.status, 402);
    assert.equal(reply.body.error, "unbilled");
    assert.deepEqual(writesOf(db), [], "an entry was written on a refused reserve");
    assert.equal(db.rows("loaves").length, 6);
  } finally { w.restore(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. A ROW BESIDE OTHER KINDS: set aside and said, the rest as before
// ─────────────────────────────────────────────────────────────────────────────

test("a row asked beside a scheduled job: the job is added as before, the entry is left out by name", async () => {
  const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
  const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };
  const db = bakeryDb();
  const r = await addon("rows-mixed-" + hex(3), "add a rye loaf and remind me every morning", {
    kinds: ["row", "function", "job"], stored: SPEC, db,
    answers: { function: { function: [FN] }, job: { job: [JOB] }, row: { row: [ENTRY] } },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.kinds, ["function", "job"]);
  assert.equal(db.rows("loaves").length, 6, "a row asked beside other kinds was written");
  assert.ok(!r.prompts.some((p) => p.kind === "row"), "the row designer ran beside other kinds");
  const aside = (r.body.notAdded || []).find((n) => n.kind === "row");
  assert.ok(aside && aside.why === "row-alone", "the entry was not said to be left out: " + JSON.stringify(r.body.notAdded));
});

test("a row asked beside a photograph is refused whole, rather than lost on the picture step's hop", async () => {
  const { r, db } = await (async () => {
    const d = bakeryDb();
    const x = await chain({ mode: "sync", db: d, answers: { pick_adds: { kinds: ["row", "photo"] } } });
    return { r: x, db: d };
  })();
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.reason, "row-alone");
  assert.equal(r.body.escalate, undefined, "the photograph's hop went ahead and the entry vanished");
  assert.deepEqual(writesOf(db), []);
  assert.equal(r.body.cost, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE PIECES: the picker offers the kind; the shared rules are the data
//    step's; the statement is all or nothing
// ─────────────────────────────────────────────────────────────────────────────

test("the picker offers `row`, described as an entry in a list the site already stores", async () => {
  const { ADD_KINDS, LIST_ADDS, pickTool, addTool } = await add();
  assert.ok(ADD_KINDS.includes("row") && LIST_ADDS.includes("row"));
  const kinds = pickTool().input_schema.properties.kinds;
  assert.ok(kinds.items.enum.includes("row"));
  assert.match(kinds.description, /"row" — One or more new ENTRIES in a list the site ALREADY stores/);
  assert.equal(addTool("row").input_schema.properties.row.type, "array");
  // AND ITS INSTRUCTIONS SAY WHICH NEARBY KINDS IT IS NOT: one more entry is a
  // `row`, never a second table and never a card drawn on a page.
  const { pickRequest } = await add();
  const system = pickRequest({ message: ASK }).system.map((b) => b.text).join("\n");
  assert.match(system, /One more ENTRY in a list it already stores[^]*is a `row`: never a second `table`, and never a `component` or `page`/);
});

test("the row kind's lists are exactly the data step's: the display preset, by `resolveAccess`", async () => {
  const { rowTables } = await add();
  const spec = { tables: [
    { name: "menu", columns: ["dish"], access: "display" },
    { name: "prices", columns: [{ name: "item" }], read: "public", write: "none" },
    { name: "bookings", columns: ["who"], access: "collect" },
    { name: "members_only", columns: ["note"], read: "members", write: "none" },
    { name: "mine", columns: ["note"], access: "user" },
    { name: "constructor", columns: ["x"], access: "display" },
    // READ BY EVERYONE AND WRITTEN BY VISITORS: a guestbook is public, and it is
    // still theirs — the write half of the rule, not only the read half.
    { name: "guestbook", columns: ["note"], read: "public", write: "anyone" },
  ] };
  // THE DATA STEP'S OWN CONDITION, as `worker.js` spells it (its spelling is
  // pinned by `site-apply.test.mjs`).
  const DISPLAY_PAIR = ACCESS_PRESETS.display;
  const dataStep = spec.tables.filter((t) => { const p = resolveAccess(t); return p.read === DISPLAY_PAIR.read && p.write === DISPLAY_PAIR.write; }).map((t) => t.name);
  assert.deepEqual([...rowTables(spec).keys()], dataStep);
  assert.ok(dataStep.length >= 3 && !dataStep.includes("bookings"), "the observer is alive");
  assert.ok(!rowTables(spec).has("guestbook"), "a list visitors write to was offered because everyone may read it");
  assert.deepEqual(rowTables(spec).get("prices"), ["item"]);
});

test("one entry's values are admitted by the data step's own rule, now shared", async () => {
  const { rowValues } = await rowsModule();
  const cols = ["name", "price", "photo"];
  const long = "x".repeat(2500);
  assert.deepEqual(rowValues({ name: long, price: 5, photo: null, junk: 1, nested: { a: 1 }, list: [1] }, cols),
    { name: "x".repeat(2000), price: 5, photo: null });
  assert.deepEqual(rowValues({ name: "a" }, new Set(cols)), { name: "a" });
  // A SHAPE IN A DECLARED COLUMN IS NOT A VALUE: dropped on its own, the scalar
  // beside it kept. (The cases above drop shapes by their undeclared NAMES, so
  // they never reach this rule — the sweep's R-2 survived on exactly that.)
  assert.deepEqual(rowValues({ name: ["Rye"], photo: { url: "x" }, price: 5 }, cols), { price: 5 });
  assert.equal(rowValues(null, cols), null);
  assert.equal(rowValues(["a"], cols), null);
  // AND THE DATA STEP STILL READS AN ADDITION EXACTLY AS IT DID.
  const reply = { content: [{ type: "tool_use", input: { changes: [{ table: "loaves", values: { name: long, price: 5, nested: { a: 1 }, junk: 2 } }] } }] };
  assert.deepEqual(readDataChanges(reply, [{ name: "loaves", columns: cols, rows: [] }]), [{ table: "loaves", values: { name: "x".repeat(2000), price: 5 } }]);
});

test("the shared INSERT is the statement the data step always wrote, byte for byte", async () => {
  const { insertStatement } = await rowsModule();
  // THE DATA STEP'S EXPRESSION BEFORE IT WAS SHARED (`worker.js` at c91d1c3e),
  // kept here as the reference the shared builder must reproduce.
  const before = (name, values) => {
    const cols = Object.keys(values);
    const marks = cols.map(() => "?").join(", ");
    return { sql: "INSERT INTO \"" + name + "\" (" + cols.map((k) => '"' + k.replace(/"/g, "") + '"').join(", ") + ") VALUES (" + marks + ")", params: cols.map((k) => values[k]) };
  };
  for (const [name, values] of [["loaves", { name: "Rye", price: 5 }], ["menu", { dish: "Soup", "we\"ird": "x", n: null }], ["t", { a: true }]]) {
    assert.deepEqual(insertStatement(name, values), before(name, values));
  }
  assert.throws(() => insertStatement("loaves", {}), /no values/);
  // THE ONE PLACE THE SHARED BUILDER IS STRICTER than the expression it
  // replaced: a double quote in the TABLE name is dropped as it already was in
  // a column name. Unreachable through a stored schema (`SAFE_IDENT` in
  // `site-schema.mjs` refuses the name), and pinned so the second wall stays.
  assert.equal(insertStatement('lo"aves', { name: "x" }).sql, 'INSERT INTO "loaves" ("name") VALUES (?)');
});

test("the statement: entries and the request's key together, the key read back as what was saved", async () => {
  const { rowMarkerKey, rowTables, rowsInsert, readRowMarker, readSavedRows } = await add();
  const key = rowMarkerKey({ job: "0123456789abcdef0123456789abcdef" });
  assert.equal(key, "addon-row:job:0123456789abcdef0123456789abcdef");
  assert.equal(rowMarkerKey({ idem: "short" }), "", "a malformed retry key became a guard");
  assert.equal(rowMarkerKey({ idem: "abcdefghijklmnopq" }), "addon-row:idem:abcdefghijklmnopq");
  const lists = rowTables(SPEC);
  const db = bakeryDb();
  const st = rowsInsert([ENTRY, { table: "loaves", values: { name: "Spelt" } }], { key, cost: 2 });
  const toPg = (sql) => { let n = 0; return sql.replace(/\?/g, () => "$" + ++n); };
  const params = st.params.map((v) => (v === null ? null : String(v)));
  const first = db.answer(toPg(st.sql), params);
  assert.equal(first.status, 200);
  assert.equal(db.rows("loaves").length, 8);
  const marker = readRowMarker(db.meta(key), lists);
  assert.deepEqual(marker.rows.map((r) => [r.id, r.label]), [[12, "Rye & Caraway"], [13, "Spelt"]]);
  assert.equal(marker.cost, 2);
  // THE SAME STATEMENT AGAIN: refused on the key, and nothing of it kept.
  const again = db.answer(toPg(st.sql), params);
  assert.equal(again.status, 400);
  assert.equal(db.rows("loaves").length, 8, "the refused statement left an entry behind");
  assert.equal(readSavedRows([], lists), null);
  assert.equal(readRowMarker("{not json", lists), null);
  assert.equal(readRowMarker(JSON.stringify({ rows: [{ n: 0, table: "loaves", row: "x" }] }), lists), null, "a row that is not an object was reported as saved");
});

test("the customer's reply names six entries and counts the rest", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ table: "loaves", id: 12 + i, label: "L" + i, row: {} }));
  const said = screen(200, { ok: true, kinds: ["row"], rows, added: [], changed: [], removed: [], moved: [], cost: 2 });
  assert.equal(said.text, "✅ Done — " + rows.slice(0, 6).map((r) => "added “" + r.label + "” to loaves (entry " + r.id + ")").join(", ") + ", and 2 more.");
});

test("the cleaner: a display list's declared columns only, capped, each refusal named", async () => {
  const { rowTables, cleanAdd, MAX_ADD_ROWS } = await add();
  const site = { tables: ["loaves", "orders"], rowTables: rowTables(SPEC) };
  const many = Array.from({ length: MAX_ADD_ROWS + 2 }, (_, i) => ({ table: "loaves", values: { name: "L" + i } }));
  const c = cleanAdd("row", many, site);
  assert.equal(c.value.length, MAX_ADD_ROWS);
  assert.deepEqual(c.skipped.map((s) => s.why), ["over-cap", "over-cap"]);
  assert.deepEqual(cleanAdd("row", [{ table: "toString", values: { name: "x" } }], site).why, "row-no-table",
    "a prototype key read as a list");
  assert.equal(cleanAdd("row", [ENTRY], { tables: ["loaves"] }).why, "row-not-list", "a list was offered with no list map");
});
