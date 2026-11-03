// A TASK STARTS WHEN WHAT IT NEEDS IS READY — NOT WHEN THE TASKS LISTED BEFORE
// IT ARE (2026-10-11, the scheduler round, after Codex's review of 44344896).
//
// Two mocked reproductions Codex ran, each of which finished correctly but
// waited for something it did not need:
//   1. an empty signups table, a pure SQL function returning 42 that reads no
//      table, and a static FAQ — both scopes saying `uses: []` — yet the
//      function waited for the table, because every schema kind was made to
//      wait for every schema kind before it;
//   2. a slow table beside a new gallery page's designer, and a component that
//      rightly uses the gallery page — the page designer answered at once, yet
//      the component could not start until the unrelated table finished,
//      because a designer was marked decided only when the loop reached it in
//      kind order.
//
// The evidence is a rendezvous (two calls that may only finish once both have
// started), or a gate held open until the task that should not have to wait
// has started. Then the final site, the model calls and the charges are read.
//
// Through the real request driver, queue consumer, routes and job runner, with
// supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "rd-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
/** Calls that may finish only once all have started; `false` for one that waited out the limit alone. */
function rendezvous(names, ms = 2500) {
  const at = {}, met = {};
  let open;
  const all = new Promise((r) => { open = r; });
  return {
    met, at,
    async arrive(name) {
      if (Object.hasOwn(at, name)) return true;
      at[name] = Date.now();
      if (names.every((n) => Object.hasOwn(at, n))) open();
      met[name] = await Promise.race([all.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))]);
      return met[name];
    },
  };
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const designs = (P, kind) => P.modelLog.filter((m) => m.tool === T.design && m.props[0] === kind).length;
const shownSite = (args) => { const t = JSON.stringify((args && args.messages) || []); const at = t.indexOf("What they asked to add"); return at < 0 ? t : t.slice(0, at); };

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";

const W_TABLE = "add a signups table with a name column";
const W_FN = "add a database function that returns 42";
const W_FAQ = "add a questions section to the About page";
const SIGNUPS = { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] };
const FORTY_TWO = { function: [{ name: "the_answer", returns: "integer", body: "SELECT 42" }] };
const FAQ = { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["card"] }] };
const creates = (db, name) => db.log().filter((q) => new RegExp("create table[^(]*" + name, "i").test(q.query)).length;
const fnCreates = (db, name) => db.log().filter((q) => new RegExp("create (or replace )?function[^(]*" + name, "i").test(q.query)).length;

// ── 1. A FUNCTION THAT READS NO TABLE, BESIDE A TABLE AND A FAQ ─────────────

for (const [label, message, kinds] of [
  ["table first", "Please " + W_TABLE + ", " + W_FN + ", and " + W_FAQ + ".", ["table", "function", "component"]],
  ["reversed", "Please " + W_FAQ + ", " + W_FN + ", and " + W_TABLE + ".", ["component", "function", "table"]],
]) {
  test("SCH 1 (" + label + ") — A TABLE, A FUNCTION THAT READS NO TABLE, AND A STATIC FAQ, EVERY SCOPE `uses: []`: all three designers run at the same time; the function is not shown the new table; the table and the function are each made once, the FAQ placed, each designer asked once", { timeout: 30000 }, async () => {
    const met = rendezvous(["add:table", "add:function", "add:component"]);
    const seen = {};
    const db = rowsDb({ tables: {} });
    const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "function", words: W_FN, uses: [] }, { kind: "component", words: W_FAQ, uses: [] }];
    await withPlatform({
      slug: slugOf("s1" + label[0]), pages: PAGES, replies: true, balance: 400, db,
      answers: {
        route: { intent: "addon" },
        [T.adds]: { kinds, scopes },
        "add:table": async () => { await met.arrive("add:table"); return SIGNUPS; },
        "add:function": async (args) => { seen.fn = shownSite(args); await met.arrive("add:function"); return FORTY_TWO; },
        "add:component": async () => { await met.arrive("add:component"); return FAQ; },
        [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
      },
    }, async (P) => {
      const r = await sendMessage(P, { message });
      const { rec } = await settle(P, r.key);
      assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.deepEqual(met.met, { "add:table": true, "add:function": true, "add:component": true }, "a designer waited for another it does not use: " + JSON.stringify(met));
      assert.doesNotMatch(seen.fn.replace(/This same change is ALSO designing[^.]*\./, ""), /signups/, "the function was shown the table it does not read");
      assert.equal(creates(db, "signups"), 1);
      assert.equal(fnCreates(db, "the_answer"), 1, "the function was not created exactly once");
      assert.ok(P.page("about.tsx").includes("Do you deliver?"));
      for (const k of ["table", "function", "component"]) assert.equal(designs(P, k), 1, k + " was designed more than once");
    });
  });
}

// ── 2. A COMPONENT THAT USES A NEW PAGE STARTS WHEN THE PAGE IS READY ───────

for (const [label, message, kinds] of [
  ["table first", "Please " + W_TABLE + ", add a gallery page, and put a questions section on the gallery page.", ["table", "page", "component"]],
  ["reversed", "Please put a questions section on the gallery page, add a gallery page, and " + W_TABLE + ".", ["component", "page", "table"]],
]) {
  test("SCH 2 (" + label + ") — A SLOW TABLE BESIDE A NEW GALLERY PAGE, AND A COMPONENT THAT USES THE PAGE: the component starts as soon as the page is designed, while the table is still being designed; it is shown the new page; each designer asked once, the table made once, the gallery published with the component on it", { timeout: 30000 }, async () => {
    const db = rowsDb({ tables: {} });
    let componentAt = 0, tableDoneAt = 0, pageDoneAt = 0, releasedBy = "";
    let started;
    const componentStarted = new Promise((r) => { started = r; });
    const seen = {};
    const scopes = [
      { kind: "table", words: W_TABLE, uses: [] },
      { kind: "page", words: "add a gallery page", uses: [] },
      { kind: "component", words: "put a questions section on the gallery page", uses: ["page"] },
    ];
    await withPlatform({
      slug: slugOf("s2" + label[0]), pages: PAGES, replies: true, balance: 400, db,
      answers: {
        route: { intent: "addon" },
        [T.adds]: { kinds, scopes },
        // THE SLOW ONE: held until the component has started, or 2.5 s.
        "add:table": async () => { releasedBy = await Promise.race([componentStarted.then(() => "component"), new Promise((r) => setTimeout(() => r("timeout"), 2500))]); tableDoneAt = Date.now(); return SIGNUPS; },
        "add:page": async () => { pageDoneAt = Date.now(); return { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] }] }; },
        "add:component": async (args) => { componentAt = Date.now(); seen.comp = shownSite(args); started(); return { component: [{ page: "/gallery", where: "at the bottom", does: "answers common questions", components: ["card"] }] }; },
        [T.pages]: { pages: [writtenPage("/gallery")] },
      },
    }, async (P) => {
      const r = await sendMessage(P, { message });
      const { rec } = await settle(P, r.key);
      assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(componentAt > 0 && pageDoneAt > 0 && tableDoneAt > 0);
      // THE TABLE WAS STILL BEING DESIGNED WHEN THE COMPONENT STARTED: it was
      // held until then, and released by the component, not by its time limit.
      assert.equal(releasedBy, "component", "the component waited for the unrelated table (the table ran out its 2.5 s alone)");
      assert.ok(componentAt <= tableDoneAt);
      assert.ok(componentAt >= pageDoneAt, "the component started before the page it uses was designed");
      assert.match(seen.comp, /\/gallery/, "the component was not shown the page it uses");
      assert.doesNotMatch(seen.comp.replace(/This same change is ALSO designing[^.]*\./, ""), /signups/, "the component was shown the table it does not use");
      for (const k of ["table", "page", "component"]) assert.equal(designs(P, k), 1, k + " was designed more than once");
      assert.equal(creates(db, "signups"), 1);
      assert.ok(P.pages().includes("gallery.tsx"));
      const refs = P.ledger.map((e) => e.ref);
      assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
    });
  });
}

test("NET — no request in this file left the machine", () => {});

test("SCH 6 — A STEP THAT ENDS ANY OTHER WAY STARTS NOTHING MORE: the table's designer fails at once while a slow page designer is still out and a component uses the page — the addition fails, and the component is never asked (no call nobody would use)", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { table: 0, page: 0, component: 0 };
  let failed;
  const tableFailed = new Promise((r) => { failed = r; });
  const scopes = [
    { kind: "table", words: W_TABLE, uses: [] },
    { kind: "page", words: "add a gallery page", uses: [] },
    { kind: "component", words: "put a questions section on the gallery page", uses: ["page"] },
  ];
  await withPlatform({
    slug: slugOf("s6"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table", "page", "component"], scopes },
      "add:table": async () => { n.table++; failed(); return { __raw: { stop_reason: "max_tokens", content: [] } }; },
      "add:page": async () => { n.page++; await tableFailed; await new Promise((r) => setTimeout(r, 400)); return { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] }; },
      "add:component": async () => { n.component++; return { component: [{ page: "/gallery", where: "at the bottom", does: "answers questions", components: ["card"] }] }; },
      [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", add a gallery page, and put a questions section on the gallery page." });
    const { rec } = await settle(P, r.key);
    assert.notEqual(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    await new Promise((r) => setTimeout(r, 700));
    await P.settle();
    assert.equal(n.component, 0, "a designer was started after the step had failed");
    assert.equal(creates(db, "signups"), 0);
  });
});
