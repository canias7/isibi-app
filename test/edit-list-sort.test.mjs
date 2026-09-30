// A LIST RE-SORTED THROUGH THE REAL CHAIN (2026-09-30, decision 2b).
//
// The router's rule (`test/router-list-sort.test.mjs`): a sort by something
// every entry has, not limited to one page, is `data`, and the data step's sort
// lane rewrites the `{ order, dir }` of every `useRows` call for that table; a
// sort limited to ONE named page is `page`, and only that page changes. The
// owner: *"Different pages may intentionally use different orders."*
//
// EVERY HOP IS DRIVEN: the real `POST /api/site/route` (the router's answer
// SUPPLIED), the real `siteEdit` cut out of `public/chat.js` posting its own
// body, the real edit route — synchronously and through the job queue — and the
// real browser composer on what came back. Every model answer is supplied, so
// this shows what the route does with each answer, never that a real model
// gives it.
//
// TWO FIXTURES:
//   1. The bakery as it is live (`8btpep`, whose five stored pages are byte for
//      byte `fixtures/run47/`, and its six `loaves` rows as read whole on
//      2026-09-30 at 22:42 UTC). Test 10's request, site-wide: publication,
//      rows untouched, billing, on both paths.
//   2. A list shown on TWO pages. A site-wide request changes both; a request
//      limited to one page changes only that page, through the quick writer and
//      through the full writer.
//
// THE WRITERS ACT ON WHAT THEY ARE SHOWN: the page writers re-sort the file
// they are handed, so a step aimed at the wrong page shows up as the wrong
// page changed rather than being papered over.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";
import { DATA_TOOL } from "../builder/site-apply.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { KEEP_TOOL } from "../builder/page-keep.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = { route: ASK_TOOL.name, data: DATA_TOOL.name, tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name, keep: KEEP_TOOL.name };

const USER = { id: "u-list-sort-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const hex = (n) => randomBytes(n).toString("hex");

// ─────────────────────────────────────────────────────────────────────────────
// THE FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

// 1. THE BAKERY AT `8btpep`. Its stored pages are `fixtures/run47/` byte for
//    byte (checked 2026-09-30 against the canary's source read of `8btpep`).
const BAKERY = ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx", "gallery.tsx"].map((path) => ({
  path, source: readFileSync(new URL("./fixtures/run47/" + path.replace(/\.tsx$/, ".before.tsx"), import.meta.url), "utf8"),
}));
const BAKERY_ROUTES = ["/", "/order", "/starter", "/visit", "/gallery"];
// `loaves`, read whole as a visitor (`0-5/6`, 1,045 bytes, sha256 `ef870ebc…`).
const LOAVES = [
  { id: 1, name: "Country White", description: "Our everyday loaf. Open crumb, thin crisp crust, a little wheat sweetness.", price: 4.8, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 2, name: "Dark Rye", description: "Dense and malty. Good with smoked fish or a sharp cheddar.", price: 5.2, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 3, name: "Seeded Wholemeal", description: "Toasted sunflower, flax and sesame through a wholemeal dough.", price: 5.4, photo: null, created_at: "2026-08-21 23:06:22" },
  { id: 4, name: "Olive & Rosemary", description: "Green olives and a handful of rosemary from the morning bunches.", price: 5.8, photo: null, created_at: "2026-08-21 23:06:23" },
  { id: 5, name: "Walnut Levain", description: "Butter walnuts folded through a long-fermented white dough.", price: 6, photo: null, created_at: "2026-08-21 23:06:23" },
  { id: 6, name: "Sea Salt Focaccia", description: "A tray bake, heavy on the oil, finished with flaky salt.", price: 4.5, photo: null, created_at: "2026-08-21 23:06:23" },
];
// The stored schema, in its own shape: `loaves` the owner's display list,
// `orders` the visitors' submissions (which the data step never offers).
const SPEC = { tables: [
  { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" },
  { name: "orders", columns: [{ name: "customer_name", type: "text" }, { name: "loaf", type: "int" }], read: "none", write: "anyone" },
] };
const FIELDS = ["id", "name", "description", "price", "photo", "created_at"];

// 2. A LIST ON TWO PAGES: `loaves` read on the home page and on /menu, in the
//    same order; /visit reads nothing.
const listPage = (route, fn, heading) => "import { createFileRoute } from \"@tanstack/react-router\";\n"
  + "import { useRows, type Row } from \"@/lib/rows\";\n\n"
  + "export const Route = createFileRoute(\"" + route + "\")({\n"
  + "  head: () => ({ meta: [{ title: \"" + heading + " — Harbour Loaf\" }, { name: \"description\", content: \"" + heading + ", and today's loaves.\" }] }),\n"
  + "  component: " + fn + ",\n"
  + "});\n\n"
  + "type Loaf = Row & { name: string; price: number };\n\n"
  + "function " + fn + "() {\n"
  + "  const loaves = useRows<Loaf>(\"loaves\", { order: \"name\", dir: \"asc\" });\n"
  + "  return (\n"
  + "    <main>\n"
  + "      <h1>" + heading + "</h1>\n"
  + "      <ul>\n"
  + "        {(loaves.data ?? []).map((l) => (\n"
  + "          <li key={l.id}>{l.name} £{l.price.toFixed(2)}</li>\n"
  + "        ))}\n"
  + "      </ul>\n"
  + "    </main>\n"
  + "  );\n"
  + "}\n";
const TWO = [
  { path: "index.tsx", source: listPage("/", "Home", "Harbour Loaf") },
  { path: "menu.tsx", source: listPage("/menu", "Menu", "The menu") },
  { path: "visit.tsx", source: "import { createFileRoute } from \"@tanstack/react-router\";\n\n"
    + "export const Route = createFileRoute(\"/visit\")({\n"
    + "  head: () => ({ meta: [{ title: \"Visit — Harbour Loaf\" }, { name: \"description\", content: \"Where to find the bakery.\" }] }),\n"
    + "  component: Visit,\n"
    + "});\n\n"
    + "function Visit() {\n  return (\n    <main>\n      <h1>Come to the bakery</h1>\n      <p>Wednesday to Saturday, eight till two.</p>\n    </main>\n  );\n}\n" },
];
const TWO_ROUTES = ["/", "/menu", "/visit"];

const BY_NAME = '{ order: "name", dir: "asc" }';
const BY_PRICE = '{ order: "price", dir: "asc" }';
/** The page with its `loaves` read re-sorted cheapest first — what a writer is asked for. */
const cheapestFirst = (src) => {
  assert.equal(src.split(BY_NAME).length, 2, "the page does not read loaves by name exactly once");
  return src.replace(BY_NAME, BY_PRICE);
};
/** The lines that differ between two sources, as [line, before, after]. */
const changedLines = (a, b) => {
  const x = a.split("\n"), y = b.split("\n");
  assert.equal(x.length, y.length, "a line was added or removed");
  return x.map((l, i) => (l === y[i] ? null : [i + 1, l, y[i]])).filter(Boolean);
};

// ─────────────────────────────────────────────────────────────────────────────
// THE STORE AND THE WIRE
// ─────────────────────────────────────────────────────────────────────────────

function bucket(slug, pages) {
  const store = new Map();
  store.set(SOURCE_KEY(slug), JSON.stringify(pages));
  store.set(PARTS_KEY(slug), JSON.stringify([]));
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css: "" }));
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
const storedPages = (b, slug) => JSON.parse(b.store.get(SOURCE_KEY(slug)));

/** The file a page writer was shown, from its own request. */
function shownFile(args) {
  const content = String((args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  assert.ok(at >= 0, "the quick writer's request carries no file");
  return content.slice(content.indexOf(")\n", at) + 2);
}

/**
 * THE MODEL, per tool, and everything else the chain touches. A tool with no
 * supplied answer is refused, so a case passes only on the calls it names.
 * Every SQL statement, debit, job RPC and publish upload is recorded.
 */
function withWire(answers, slug, run) {
  const real = globalThis.fetch;
  const seen = { calls: [], requests: {}, sql: [], debits: [], credited: [], rpc: [], uploads: 0 };
  let reserved = 0;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = url.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost) || 0; return json({ ok: true, charged: Number(args.p_cost) || 0, cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (url.includes("/rpc/credit_back")) { seen.credited.push(args); return new Response(null, { status: 204 }); }
    // A BLANK REFERENCE AND A REAL DATABASE — the demo sites' state — so the
    // data step and the page writer both read it through the four-state reader.
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (url.includes("/rest/v1/site_project")) return json([{ uid: USER.id, neon_conn: PROJECT_CONN }]);
    if (url.includes("/rest/v1/site_aliases")) return json([]);
    if (/neon\.tech|\/sql$/.test(url)) {
      const asked = String(args.query || "");
      seen.sql.push(asked);
      let a = { rows: [], fields: ["x"] };
      if (/_meta/i.test(asked) && /schema/i.test(asked)) a = { rows: [[JSON.stringify(SPEC)]], fields: ["v"] };
      else if (/FROM "loaves"/i.test(asked)) a = { rows: LOAVES.map((r) => FIELDS.map((f) => r[f])), fields: FIELDS };
      const fields = a.fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" }));
      return json({ command: "SELECT", rowCount: a.rows.length, rows: a.rows, fields });
    }
    if (url.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      (seen.requests[tool] = seen.requests[tool] || []).push(args);
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = answers[tool];
      const input2 = typeof a === "function" ? a(args) : a;
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: input2 }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) { seen.uploads++; return dispatchOk(); }
    return new Response("unavailable", { status: 503 });
  };
  return (async () => { try { return await run(seen); } finally { globalThis.fetch = real; } })();
}

// ─────────────────────────────────────────────────────────────────────────────
// THE BROWSER HOP, DRIVEN: `siteEdit` cut out of chat.js.
// ─────────────────────────────────────────────────────────────────────────────

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (head) => {
  const open = CHAT.indexOf("\nfunction " + head + "(");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
  return CHAT.slice(open, shut + 2);
};

/** The POST the browser makes for a routing reply — URL and body exactly as it would send them. */
function browserPost(site, d, instruction) {
  const sent = [];
  const ended = [];
  const ctx = vm.createContext({
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { newIdemKey: () => "idem-list-sort-" + hex(6), outcomeMessage: (s) => "outcome:" + s },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    apiFetch: (url, init) => { sent.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext([cut("editAsk"), cut("editAskDone"), cut("siteEdit")].join("\n"), ctx);
  ctx.siteEdit(site, d, instruction, "origin-1", (t) => ended.push("finish:" + t), () => ended.push("fallback"), [], false);
  assert.deepEqual(ended, [], "the browser ended the message instead of posting it: " + JSON.stringify(ended));
  assert.equal(sent.length, 1, "the browser made " + sent.length + " requests, not one");
  return { url: sent[0].url, body: JSON.parse(sent[0].init.body) };
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE MESSAGE THROUGH THE WHOLE CHAIN — synchronously, or through the queue
// ─────────────────────────────────────────────────────────────────────────────

async function chain({ pages, routes, message, routed, answers = {}, mode = "sync" }) {
  const slug = "list-sort-" + mode + "-" + hex(4);
  const store = bucket(slug, pages);
  const compiler = installCompiler();
  try {
    const worker = await loadWorker();
    const env = {
      SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key",
      SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv(),
    };
    return await withWire({ [T.route]: routed, ...answers }, slug, async (seen) => {
      // HOP 1 — the routing route, told the site's pages and tables.
      const rres = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: TOKEN },
        body: JSON.stringify({ message, site: { name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app", pages: routes, tables: ["loaves", "orders"] },
          picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug, hasSite: true }),
      }), env, makeCtx());
      const d = await rres.json();
      const routingDebits = seen.debits.slice();
      // HOP 2 — the browser.
      const site = { slug, name: "Harbour Loaf", react: true, pages: routes.map((p) => ({ path: p })), msgs: [] };
      const post = browserPost(site, d, message);
      // HOP 3 — the route the browser posted to, with the body it composed.
      let status = 0;
      let body = null;
      const url = "https://gofarther.dev" + post.url;
      if (mode === "job") {
        const id = hex(16);
        store.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body: JSON.stringify(post.body), uid: USER.id, slug, secret: hex(16), at: Date.now() })));
        const ctx = makeCtx();
        await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
        await Promise.allSettled(ctx.pending || []);
        const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
        assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
        status = fin.args.p_result.status;
        body = JSON.parse(fin.args.p_result.body);
      } else {
        const res = await worker.fetch(new Request(url, {
          method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN }, body: JSON.stringify(post.body),
        }), env, makeCtx());
        status = res.status;
        body = await res.json().catch(() => null);
      }
      // HOP 4 — the customer's screen, from the browser's own composer.
      const said = editBrowserReply(body, status >= 200 && status < 300, d);
      assert.ok(said.ok, "the browser's own handler could not run on this reply: " + said.why);
      const builds = compiler.calls.filter((k) => /\/build/.test(String(k.url || "")));
      const compiledFiles = builds.length ? (builds[builds.length - 1].body || {}).files || {} : {};
      const compiled = (path) => {
        const key = Object.keys(compiledFiles).find((k) => k === path || k.endsWith("/" + path));
        return key === undefined ? undefined : compiledFiles[key];
      };
      return {
        d, post, status, body, said, seen, routingDebits,
        editDebits: seen.debits.slice(routingDebits.length),
        stored: storedPages(store, slug), compiles: builds.length, compiled,
        reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => ({ seq: r.args.p_seq, cost: Number(r.args.p_cost) })),
        finalized: seen.rpc.filter((r) => r.fn === "edit_finalize").map((r) => r.args.p_ok),
        refunds: seen.rpc.filter((r) => r.fn === "edit_refund").length,
      };
    });
  } finally { compiler.uninstall(); }
}

const page = (r, path) => (r.stored.find((p) => p.path === path) || {}).source;
const writes = (r) => r.seen.sql.filter((q) => /^\s*(UPDATE|INSERT|DELETE|ALTER|DROP|CREATE)\b/i.test(q));

/** The money, on the path the edit ran: one charge for the edit, nothing given back. */
function billedOnce(r, mode, cost) {
  assert.equal(r.body.cost, cost, "the reply's cost");
  assert.deepEqual(r.seen.credited, [], "something was credited back");
  if (mode === "job") {
    // THROUGH POSTGRES: one sequenced reserve, finalized, never refunded; and
    // no direct debit beside it.
    assert.deepEqual(r.reserves, [{ seq: 1, cost }], "the job's reserves");
    assert.deepEqual(r.finalized, [true], "the job was not finalized once as published");
    assert.equal(r.refunds, 0, "the job was refunded");
    assert.deepEqual(r.editDebits, [], "the job also debited directly");
  } else {
    assert.deepEqual(r.editDebits, [cost], "the edit's debits");
    assert.deepEqual(r.reserves, [], "a synchronous edit reserved through the job ledger");
  }
  // The routing call is its own charge, taken once at the routing route.
  assert.equal(r.routingDebits.length, 1, "the routing call was not charged exactly once");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE BAKERY AT `8btpep`: TEST 10'S REQUEST, SITE-WIDE
// ─────────────────────────────────────────────────────────────────────────────

const TEST10 = "Across the site, list the loaves from cheapest to most expensive.";
const SORT = { changes: [], order: { table: "loaves", column: "price", dir: "asc" } };

for (const mode of ["sync", "job"]) {
  test("the bakery, Test 10's request: one line of order.tsx, one publication, no row written, one charge (" + mode + ")", async () => {
    const r = await chain({ pages: BAKERY, routes: BAKERY_ROUTES, message: TEST10, routed: { intent: "edit", layer: "data" }, answers: { [T.data]: SORT }, mode });
    // THE ROUTE AND THE POST: data, site-wide, with no page.
    assert.equal(r.d.layer, "data");
    assert.equal(r.post.body.layer, "data");
    assert.equal(r.post.body.instruction, TEST10);
    // THE PICKER WAS SHOWN THE LIST AND ITS ORDER, and answered once.
    assert.deepEqual(r.seen.calls, [T.route, T.data], "the model calls");
    const asked = String(r.seen.requests[T.data][0].messages[0].content);
    assert.match(asked, /loaves — ordered by name asc/);
    assert.match(asked, /loaves: name, description, price, photo/);
    // THE ANSWER.
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true);
    assert.equal(r.body.layer, "data");
    assert.deepEqual(r.body.sort, { table: "loaves", column: "price", dir: "asc" });
    assert.deepEqual(r.body.sortChanged, ["order.tsx"]);
    assert.deepEqual(r.body.applied, [], "a row is reported as changed");
    assert.equal(r.body.failed, 0);
    // THE STORED SITE: exactly one line of order.tsx, and nothing else.
    const was = BAKERY.find((p) => p.path === "order.tsx").source;
    assert.deepEqual(changedLines(was, page(r, "order.tsx")), [[97,
      '  const loaves = useRows<Loaf>("loaves", { order: "name", dir: "asc" });',
      '  const loaves = useRows<Loaf>("loaves", { order: "price", dir: "asc" });']]);
    for (const p of BAKERY.filter((x) => x.path !== "order.tsx")) assert.equal(page(r, p.path), p.source, p.path + " changed");
    assert.equal(r.stored.length, BAKERY.length, "a page was added or taken away");
    // PUBLICATION: one compile, carrying the stored pages, and one upload.
    assert.equal(r.compiles, 1, "not exactly one compile");
    assert.equal(r.compiled("order.tsx"), page(r, "order.tsx"), "the compile did not carry the re-sorted page");
    assert.equal(r.compiled("visit.tsx"), BAKERY.find((p) => p.path === "visit.tsx").source);
    assert.equal(r.seen.uploads, 1, "not exactly one publish upload");
    // THE ROWS: read, never written.
    assert.ok(r.seen.sql.some((q) => /FROM "loaves"/.test(q)), "the rows were never read, so this proves nothing about them");
    assert.deepEqual(writes(r), [], "a statement that writes reached the database");
    // THE MONEY: the picker's one charge; the publication is not charged.
    billedOnce(r, mode, 1);
    // THE SCREEN.
    assert.equal(r.said.text, "✅ loaves now comes out in order of price, lowest first — on 1 page.");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. A LIST ON TWO PAGES
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("a list on two pages, a site-wide request: both pages re-sorted, the third untouched (" + mode + ")", async () => {
    const r = await chain({ pages: TWO, routes: TWO_ROUTES, message: TEST10, routed: { intent: "edit", layer: "data" }, answers: { [T.data]: SORT }, mode });
    assert.match(String(r.seen.requests[T.data][0].messages[0].content), /loaves — ordered by name asc {2}\(read on 2 pages\)/);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.sortChanged, ["index.tsx", "menu.tsx"]);
    for (const path of ["index.tsx", "menu.tsx"]) {
      const was = TWO.find((p) => p.path === path).source;
      assert.equal(page(r, path), cheapestFirst(was), path + " is not the same page re-sorted");
      assert.equal(changedLines(was, page(r, path)).length, 1, path + " changed in more than its read");
    }
    assert.equal(page(r, "visit.tsx"), TWO.find((p) => p.path === "visit.tsx").source, "the page with no list changed");
    assert.equal(r.compiles, 1);
    assert.equal(r.seen.uploads, 1);
    assert.deepEqual(writes(r), []);
    assert.deepEqual(r.seen.calls, [T.route, T.data], "a page writer ran for a site-wide sort");
    billedOnce(r, mode, 1);
    assert.equal(r.said.text, "✅ loaves now comes out in order of price, lowest first — on 2 pages.");
  });
}

const ON_MENU = "On the menu page, list the loaves from cheapest to most expensive.";

for (const mode of ["sync", "job"]) {
  test("a list on two pages, a request limited to /menu: only /menu re-sorted, through the quick writer (" + mode + ")", async () => {
    const r = await chain({
      pages: TWO, routes: TWO_ROUTES, message: ON_MENU, routed: { intent: "edit", layer: "page", page: "/menu" }, mode,
      // The quick writer re-sorts WHATEVER file it is shown, so a wrong target
      // would show up as the wrong page changed.
      answers: { [T.tweak]: (args) => ({ source: cheapestFirst(shownFile(args)) }) },
    });
    assert.equal(r.post.body.layer, "page");
    assert.equal(r.post.body.page, "/menu");
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.tweak, true, "the quick writer's answer did not publish");
    assert.equal(page(r, "menu.tsx"), cheapestFirst(TWO.find((p) => p.path === "menu.tsx").source));
    // THE OTHER PAGE KEEPS ITS OWN ORDER.
    assert.equal(page(r, "index.tsx"), TWO.find((p) => p.path === "index.tsx").source, "the home page's order changed");
    assert.match(page(r, "index.tsx"), /order: "name", dir: "asc"/);
    assert.equal(page(r, "visit.tsx"), TWO.find((p) => p.path === "visit.tsx").source);
    assert.equal(r.compiles, 1);
    assert.equal(r.seen.uploads, 1);
    // NO DATA STEP, AND NOTHING WRITTEN: the sorter was never asked.
    assert.deepEqual(r.seen.calls, [T.route, T.tweak], "the model calls");
    assert.deepEqual(writes(r), []);
    billedOnce(r, mode, r.body.cost);
    assert.ok(r.body.cost >= 1, "the quick writer's call was not charged");
    assert.equal(r.said.text, "✅ Updated /menu.");
  });
}

test("a list on two pages, a request limited to /menu: only /menu re-sorted, through the full writer, and the reply says the list is shown elsewhere", async () => {
  const r = await chain({
    pages: TWO, routes: TWO_ROUTES, message: ON_MENU, routed: { intent: "edit", layer: "page", page: "/menu" },
    answers: {
      // The quick writer declines (its rules send a change to what a page lists
      // to the page writer), so the full writer answers.
      [T.tweak]: { cannot: "that changes what the page lists, so it needs the page writer" },
      [T.pages]: { pages: [{ path: "src/routes/menu.tsx", source: cheapestFirst(TWO.find((p) => p.path === "menu.tsx").source) }] },
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(page(r, "menu.tsx"), cheapestFirst(TWO.find((p) => p.path === "menu.tsx").source));
  assert.equal(page(r, "index.tsx"), TWO.find((p) => p.path === "index.tsx").source, "the home page's order changed");
  assert.equal(page(r, "visit.tsx"), TWO.find((p) => p.path === "visit.tsx").source);
  assert.equal(r.compiles, 1);
  assert.deepEqual(r.seen.calls, [T.route, T.tweak, T.pages], "the model calls");
  assert.deepEqual(writes(r), []);
  // THE OTHER PAGE IS NAMED, NEVER REWRITTEN.
  assert.deepEqual(r.body.reordered, ["loaves"]);
  billedOnce(r, "sync", r.body.cost);
  assert.equal(r.said.text, "✅ Updated /menu. Heads up: loaves is listed on other pages too, and I only changed this one — say “do the same everywhere” if you want them to match.");
});
