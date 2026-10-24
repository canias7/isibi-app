// NO ADD-ON LIMITS (owner, 2026-10-24: "No addon limits"; earlier, 2026-09-02:
// "no limit on things that can be added").
//
// Found live on driftwood-and-daughters (2026-10-24): the add-on step's caps,
// applied per kind and independently, kept the Hire and Events pages and
// dropped the tables behind their forms, and the header/footer item asked for
// beside them was set aside twice and then lost. These guards hold:
//   1. an addition of nine pages, twelve tables and several functions keeps
//      every one, through the cleaner and through the real route, with the
//      pages written by parallel page writers (`ADD_PAGE_BATCH` a writer);
//   2. the frame asked for beside a table is handed on to the menu editor as an
//      addition in the same request (`frameHop`, `frameFollowOn`), even when its
//      words are the whole part's;
//   3. the reply promises a held entry as "its own part" only when the request
//      can carve it (`heldFacts`).
// No model is called: every answer is a stub wire.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cleanAdd, foldAdds, mergePageBatches, pageBatchDirectives, ADD_PAGE_BATCH, UNCAPPED,
  MAX_ADDS, MAX_ADD_PAGES, MAX_ADD_COMPONENTS, MAX_ADD_TABLES, MAX_ADD_ROWS, MAX_ADD_FUNCTIONS, MAX_ADD_APIS,
  MAX_ADD_JOBS, MAX_SECTIONS, MAX_OWN_PHOTOS, MAX_ADD_WORDS, MAX_ADD_MANIFEST, addRefusal, addTool,
} from "../builder/site-add.mjs";
import { frameFollowOn } from "../builder/request.mjs";
import { COMPONENT_MENU } from "../builder/site-plan.mjs";
import { MAX_PAGES as WRITER_KEEPS } from "../builder/page-gen.mjs";
import { addonReplyFacts } from "../builder/site-reply.mjs";
import { addon, writtenPage, storedPage } from "./fixtures/addon-route.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const at = (src, s, what) => { const i = src.indexOf(s); assert.ok(i >= 0, what + ": landmark " + JSON.stringify(s) + " is gone"); return i; };

const SITE = { pages: ["/"], tables: [], hasDatabase: true, kind: "site" };
const PAGES = Array.from({ length: 9 }, (_, i) => ({ path: "/p" + i, name: "Page " + i, purpose: "page " + i, sections: ["a band"], components: ["card"] }));
const TABLES = Array.from({ length: 12 }, (_, i) => ({ table: { name: "list_" + i, access: "collect", columns: [{ name: "name", type: "text" }] } }));
const FUNCTIONS = Array.from({ length: 8 }, (_, i) => ({ name: "count_" + i, returns: "void", internal: true, body: "BEGIN PERFORM 1; END;" }));

test("every add-on cap is gone: the constants are unbounded and nothing is named over-cap", () => {
  for (const [n, c] of Object.entries({ MAX_ADDS, MAX_ADD_PAGES, MAX_ADD_COMPONENTS, MAX_ADD_TABLES, MAX_ADD_ROWS, MAX_ADD_FUNCTIONS, MAX_ADD_APIS, MAX_ADD_JOBS, MAX_SECTIONS, MAX_OWN_PHOTOS, MAX_ADD_WORDS, MAX_ADD_MANIFEST })) {
    assert.equal(c, UNCAPPED, n + " is still a cap");
  }
  assert.equal(UNCAPPED, Infinity);
  // THE 15-COMPONENT MANIFEST BOUND (site-plan's MAX_COMPONENTS, borrowed) is gone from the tools too.
  for (const k of ["page", "component"]) assert.equal(addTool(k).input_schema.properties[k].items.properties.components.maxItems, undefined, k);
  // THE ONE COUNT LEFT IS THE PHOTOGRAPHS BOUGHT, and its sentence never asks them to send it again.
  assert.doesNotMatch(addRefusal("over-cap"), /another message|send|again/i);
});

test("nine pages, twelve tables and eight functions are all kept by the cleaner — nothing dropped", () => {
  const p = cleanAdd("page", PAGES, SITE);
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual(p.value.map((v) => v.path), PAGES.map((v) => v.path));
  assert.deepEqual(p.skipped, []);
  // TWENTY KIT COMPONENTS ON ONE PAGE (the manifest bound was 15).
  const twenty = COMPONENT_MENU.slice(0, 20);
  const big = cleanAdd("page", [{ ...PAGES[0], components: twenty }], SITE);
  assert.equal(big.ok, true, JSON.stringify(big));
  assert.equal(big.value[0].components.length, 20, "a component past the old fifteen was cut");
  const t = cleanAdd("table", TABLES, SITE);
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.equal(t.value.length, 12);
  assert.deepEqual(t.skipped, []);
  const f = cleanAdd("function", FUNCTIONS, SITE);
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.equal(f.value.length, 8);
  assert.deepEqual(f.skipped, []);
});

test("many pages are split into batches: each writer gets its own pages, the shared tables, and its pages' sections only", () => {
  const pages = cleanAdd("page", PAGES, SITE).value;
  const tables = cleanAdd("table", TABLES.slice(0, 2), SITE).value;
  const comps = [{ page: "/p4", does: "a quote band", components: ["testimonial"] }, { page: "/", does: "a home band", components: ["card"] }];
  const fold = foldAdds([{ kind: "page", value: pages }, { kind: "table", value: tables }, { kind: "component", value: comps }], {}, { ...SITE, pages: ["/"] });
  assert.ok(Array.isArray(fold.batchDirectives), "nine pages are handed to one writer");
  assert.equal(fold.batchDirectives.length, Math.ceil(9 / ADD_PAGE_BATCH));
  fold.batchDirectives.forEach((d, n) => {
    const mine = pages.slice(n * ADD_PAGE_BATCH, (n + 1) * ADD_PAGE_BATCH);
    for (const pg of pages) {
      const block = "answering at " + pg.path + " ";
      assert.equal(d.includes(block), mine.includes(pg), "batch " + n + " and " + pg.path);
    }
    // THE TABLES THE FORMS SAVE INTO ride every batch: a page is never written without them.
    for (const tb of tables) assert.ok(d.includes(tb.table.name), "batch " + n + " lost table " + tb.table.name);
    assert.match(d, /YOU write only:/);
  });
  // A section on a new page goes with that page's batch; one on an existing page to the first batch only.
  const home = fold.batchDirectives.map((d) => d.includes("a home band")), quote = fold.batchDirectives.map((d) => d.includes("a quote band"));
  assert.deepEqual(home, [true, false, false]);
  assert.deepEqual(quote, [false, true, false]);
  // At or under the batch, one writer as before.
  assert.deepEqual(pageBatchDirectives(["x"], [{ at: 0, kind: "page", path: "/a" }]), []);
  assert.equal(foldAdds([{ kind: "page", value: pages.slice(0, ADD_PAGE_BATCH) }], {}, SITE).batchDirectives, undefined);
});

test("the batches' replies merge into one: every page, parts once, usage summed; an ask or a blank batch stops all", () => {
  const u = (n) => ({ in: n, out: n, cacheRead: 0, cacheWrite: 0, model: "m" });
  const got = [
    { input: { pages: [{ path: "a.tsx", source: "a" }], parts: [{ name: "x", source: "1" }], notes: "one" }, usage: u(1) },
    { input: { pages: [{ path: "b.tsx", source: "b" }], parts: [{ name: "x", source: "2" }], remove: ["old.tsx"] }, usage: u(2) },
  ];
  const m = mergePageBatches(got);
  assert.deepEqual(m.input.pages.map((p) => p.path), ["a.tsx", "b.tsx"]);
  assert.equal(m.input.parts.length, 1);
  assert.deepEqual(m.input.remove, ["old.tsx"]);
  assert.equal(m.usage.in, 3);
  assert.equal(m.batches, 2);
  assert.equal(mergePageBatches([got[0]]), got[0], "one writer's reply is changed");
  assert.deepEqual(mergePageBatches([got[0], { input: null, ask: { text: "?" }, usage: u(1) }]).ask, { text: "?" });
  const cut = mergePageBatches([got[0], { input: null, truncated: true, usage: u(1) }]);
  assert.equal(cut.input, null); assert.equal(cut.truncated, true);
});

test("the route runs the page writers in parallel, one per batch, and merges them before anything reads the pages", () => {
  const g = at(W, "const aBatchGot = await Promise.all(aBatchDirs.map(", "parallel writers");
  const call = at(W, "aGen = await generateSitePages(env, briefWithLayout({", "page call");
  const merge = at(W, "aGen = mergePageBatches(aBatchGot);", "merge");
  const read = at(W, "aPagesWrote = aGen && aGen.input", "pages read");
  assert.ok(g < call && call < merge && merge < read, "the writers, their merge and the read are out of order");
});

test("THROUGH THE ROUTE: nine pages, twelve tables and functions in one addition — every page written, every table made", { timeout: 120000 }, async () => {
  const r = await addon("uncap-all-" + Math.random().toString(16).slice(2, 8), "add nine pages, twelve lists and the counters", {
    kinds: ["table", "function", "page"], publishes: true, credits: 4000,
    storedPages: [storedPage("/")],
    written: PAGES.map((p) => writtenPage(p.path)),
    answers: { table: { table: TABLES }, function: { function: FUNCTIONS.slice(0, 3) }, page: { page: PAGES } },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 1500));
  const writers = r.prompts.filter((p) => p.tool === "write_pages");
  assert.equal(writers.length, Math.ceil(9 / ADD_PAGE_BATCH), "the pages were not written by parallel batches");
  assert.equal(r.body.tables.length, 12, "a table was dropped");
  assert.equal(r.body.notAdded, undefined, JSON.stringify(r.body.notAdded));
  // RELIES ON THE BRANCH `first-build-uncapped`, which makes page-gen's
  // `MAX_PAGES` (how many pages `validatePages` keeps of one reply) unlimited.
  // Until it lands, the pages past it are NAMED as missing, never silent; once
  // it lands this asserts all nine, with no edit here.
  const keep = Math.min(PAGES.length, WRITER_KEEPS);
  assert.deepEqual(r.body.missingPages || [], PAGES.slice(keep).map((p) => p.path), "a page was dropped, or dropped unsaid");
  for (const p of PAGES.slice(0, keep)) assert.ok(JSON.stringify(r.body.added || []).includes(p.path.slice(1)), "page " + p.path + " not added");
});

// ── THE FRAME BESIDE ANOTHER KIND ────────────────────────────────────────────

test("the route hands the frame on beside other kinds instead of setting it aside to be lost", () => {
  const def = at(W, "const aFrameHop = aSkipped.includes(\"frame\")", "frame hop");
  assert.match(W.slice(def, def + 300), /layer: addLayerIn\("frame", aKinds\)/);
  assert.equal((W.match(/frameHop: aFrameHop \|\| undefined/g) || []).length, 2, "the pageless and the page answers do not both carry the frame hand-on");
});

const rec = (message) => ({ message, parts: [{ n: 0, words: message, parent: null, needs: [], held: [], source: "message", route: { op: "addon", hops: 0 } }] });

test("the frame beside a table runs: the request makes a part for the menu editor, as an addition, even with the whole words", () => {
  const msg = "Add a hire list and an Instagram link in the footer";
  const r = rec(msg);
  const part = frameFollowOn(r, r.parts[0], { ok: true, frameHop: { layer: "nav", words: msg } });
  assert.ok(part, "no part was made for the frame");
  assert.equal(part.words, msg);
  assert.equal(part.route.op, "edit"); assert.equal(part.route.layer, "nav");
  assert.equal(part.route.fromAddon, true, "the frame is not handed on as an addition");
  assert.equal(part.phase, "run");
  assert.equal(frameFollowOn(r, r.parts[0], { ok: true, frameHop: { layer: "nav", words: msg } }), part, "made twice");
  assert.equal(r.parts.length, 2);
  // NOTHING TO HAND ON, OR A LAYER NO EDIT STEP HAS: no part.
  assert.equal(frameFollowOn(rec(msg), { n: 0, words: msg }, { ok: true }), null);
  assert.equal(frameFollowOn(rec(msg), { n: 0, words: msg }, { ok: true, frameHop: { layer: "nowhere", words: msg } }), null);
});

test("heldFacts promises only parts the request can carve, and says the frame is done next", () => {
  const whole = "add a hire page and a footer link to instagram";
  const body = { ok: true, kinds: ["page"], added: ["hire.tsx"], deferred: [whole, "a footer link to instagram"] };
  const f = addonReplyFacts(body, { inRequest: true, partWords: whole }).facts.map((x) => x.text);
  assert.ok(f.some((t) => /its own part of the same request/.test(t) && t.includes("a footer link to instagram")), JSON.stringify(f));
  assert.ok(!f.some((t) => /its own part of the same request/.test(t) && t.includes("“" + whole + "”")), "the whole part's words were promised as a part of their own: " + JSON.stringify(f));
  assert.ok(f.some((t) => /could not be set apart/.test(t)), JSON.stringify(f));
  // THE REQUEST'S OWN CARVE RESULT WINS when known.
  const g = addonReplyFacts(body, { inRequest: true, partWords: whole, carved: [] }).facts.map((x) => x.text);
  assert.ok(!g.some((t) => /its own part of the same request/.test(t)), JSON.stringify(g));
  // THE FRAME HANDED ON is said as done next, never as a part that may not exist.
  const h = addonReplyFacts({ ...body, deferred: [whole], frameHop: { layer: "nav", words: whole } }, { inRequest: true, partWords: whole }).facts.map((x) => x.text);
  assert.ok(h.some((t) => /handed to the menu editor/.test(t)), JSON.stringify(h));
  assert.ok(!h.some((t) => /could not be set apart/.test(t)), JSON.stringify(h));
});
