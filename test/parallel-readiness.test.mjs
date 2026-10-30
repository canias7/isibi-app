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

// ── 3. GENUINE DEPENDENCIES STILL WAIT, AND ARE SHOWN WHAT THEY USE ─────────

test("SCH 3 — A GENUINE CHAIN: a function that reads the new table (`uses: [\"table\"]`) waits for what it uses and is shown it; each designer asked once", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const order = [];
  const seen = {};
  const W_COUNT = "a function counting the signups";
  const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "function", words: W_COUNT, uses: ["table"] }];
  await withPlatform({
    slug: slugOf("s3"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table", "function"], scopes },
      "add:table": async () => { order.push("table:start"); await new Promise((r) => setTimeout(r, 150)); order.push("table:end"); return SIGNUPS; },
      "add:function": async (args) => { order.push("function:start"); seen.fn = shownSite(args); await new Promise((r) => setTimeout(r, 100)); order.push("function:end"); return { function: [{ name: "count_signups", internal: true, returns: "bigint", body: "SELECT count(*) FROM signups" }] }; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + W_COUNT + "." });
    const { rec } = await settle(P, r.key);
    assert.ok(["done", "partial"].includes(statuses(rec)[0]), JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(order.indexOf("function:start") > order.indexOf("table:end"), "the function started before the table it reads: " + order.join(", "));
    assert.match(seen.fn, /signups/, "the function was not shown the table it reads");
    for (const k of ["table", "function"]) assert.equal(designs(P, k), 1, k + " was designed more than once");
    assert.equal(creates(db, "signups"), 1);
    assert.equal(fnCreates(db, "count_signups"), 1, "the function was not created exactly once");
  });
});

test("NET — no request in this file left the machine", () => {});

// ── 4. A QUESTION RESUMES ITS ASKER AND WHAT DEPENDS ON IT, NOTHING ELSE ────

test("SCH 4 — THE NEW PAGE'S DESIGNER ASKS A QUESTION; A COMPONENT USES THE PAGE; A TABLE IS UNRELATED: after the answer, the page designer and the component that uses it are asked again (both shown the answer), the table's finished design is replayed — never asked again; all three land once", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { table: 0, page: 0, component: 0 };
  const shown = { page: [], component: [] };
  const scopes = [
    { kind: "table", words: W_TABLE, uses: [] },
    { kind: "page", words: "add a gallery page", uses: [] },
    { kind: "component", words: "put a questions section on the gallery page", uses: ["page"] },
  ];
  const GALLERY_PAGE = { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] }] };
  await withPlatform({
    slug: slugOf("s4"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick = (n.pick || 0) + 1; return { kinds: ["table", "page", "component"], scopes }; },
      "add:table": async () => { n.table++; return SIGNUPS; },
      "add:page": async (args) => { n.page++; shown.page.push(JSON.stringify(args.messages || [])); return n.page === 1 ? { question: { text: "Should the gallery show every photograph, or only this season's?", options: ["Every photograph", "This season's"] } } : GALLERY_PAGE; },
      "add:component": async (args) => { n.component++; shown.component.push(JSON.stringify(args.messages || [])); return { component: [{ page: "/gallery", where: "at the bottom", does: "answers common questions", components: ["card"] }] }; },
      [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", add a gallery page, and put a questions section on the gallery page." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    const q = P.question();
    assert.ok(q && q.by === "add:page", "the question does not name the page designer: " + JSON.stringify(q && q.by));
    await sendMessage(P, { message: "Every photograph", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(n.table, 1, "the unrelated table's finished design was asked again");
    assert.equal(n.pick, 1, "the picker, which the answer does not reach, was asked again");
    assert.equal(n.page, 2);
    assert.ok(n.component >= 1);
    assert.match(shown.page[1], /Every photograph/, "the page designer was not shown its answer");
    assert.match(shown.component[shown.component.length - 1], /Every photograph/, "the component that uses the page was not shown the answer");
    assert.match(shown.component[shown.component.length - 1], /\/gallery/);
    assert.equal(creates(db, "signups"), 1);
    assert.ok(P.pages().includes("gallery.tsx"));
    const refs = P.ledger.map((e) => e.ref);
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

// ── 5. WORK STILL OUT WHEN A QUESTION ENDS THE STEP ─────────────────────────

test("SCH 5 — THE TABLE'S DESIGNER ASKS AT ONCE WHILE A SLOW PAGE DESIGNER IS STILL OUT, AND A COMPONENT USES THE PAGE: work the question does not reach keeps going — the page's answer is waited for and kept, and the component that uses it is started and finished before the step asks; after the answer only the table is asked again — the page's and the component's designs are replayed, the picker never asked again", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, page: 0, component: 0 };
  let tableAsked;
  const asked = new Promise((r) => { tableAsked = r; });
  const shown = { table: [] };
  const scopes = [
    { kind: "table", words: W_TABLE, uses: [] },
    { kind: "page", words: "add a gallery page", uses: [] },
    { kind: "component", words: "put a questions section on the gallery page", uses: ["page"] },
  ];
  const GALLERY_PAGE = { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] }] };
  await withPlatform({
    slug: slugOf("s5"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "page", "component"], scopes }; },
      "add:table": async (args) => {
        n.table++;
        shown.table.push(JSON.stringify(args.messages || []));
        if (n.table === 1) { tableAsked(); return { question: { text: "Should signups also keep an email address?", options: ["Yes", "No"] } }; }
        return SIGNUPS;
      },
      // STILL BEING DESIGNED WHEN THE TABLE ASKS: it answers only after.
      "add:page": async () => { n.page++; await asked; await new Promise((r) => setTimeout(r, 400)); return GALLERY_PAGE; },
      "add:component": async () => { n.component++; return { component: [{ page: "/gallery", where: "at the bottom", does: "answers common questions", components: ["card"] }] }; },
      [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", add a gallery page, and put a questions section on the gallery page." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    const q = P.question();
    assert.ok(q && q.by === "add:table", "the question does not name the table's designer: " + JSON.stringify(q && q.by));
    assert.equal(n.page, 1);
    assert.equal(n.component, 1, "ready work the question does not reach stopped when the question came");
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(n.page, 1, "the page's finished design (still out when the question came) was asked of a model again");
    assert.equal(n.pick, 1, "the picker, which the answer does not reach, was asked again");
    assert.equal(n.table, 2);
    assert.match(shown.table[1], /keep an email address/, "the table's designer was not shown its question again");
    assert.equal(n.component, 1, "the component's finished design (made while the question waited) was asked of a model again");
    assert.equal(creates(db, "signups"), 1);
    assert.ok(P.pages().includes("gallery.tsx"));
    const refs = P.ledger.map((e) => e.ref);
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

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
