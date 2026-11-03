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
