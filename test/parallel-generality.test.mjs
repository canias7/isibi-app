// THE GENERALITY GAPS (2026-10-11, the generality round, after Codex's review
// of 648964d5): the documented places where a task waited, or did work, only
// because the code read or planned more than the task's result depends on.
//
//   1. a schema-only addition — a table nothing on the site shows — ran the
//      page writer, compiled and published, for nothing;
//   2. Look, Rules and Page changes, as request parts, were planned as reading
//      the whole site, so they waited for every page-writing part;
//   3. the model work of the dispatched steps inside one multi-step edit ran
//      one after another, though only their writes need to.
//
// Each case reads what was done (the model calls, the stored site, the
// charges), through the real request driver, queue consumer, routes and job
// runner, with supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "gn-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const creates = (db, name) => db.log().filter((q) => new RegExp("create table[^(]*" + name, "i").test(q.query)).length;

// ── 1. A SCHEMA-ONLY ADDITION WRITES NO PAGE ────────────────────────────────

test("GN 1 — A TABLE ASKED FOR AS STORAGE ALONE (no page shows it, and its own access lets nobody on the site read or write it): the table is made, and no page writer is asked, nothing is compiled or published — every page exactly as it was; charged once", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  await withPlatform({
    slug: slugOf("1"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table"], scopes: [{ kind: "table", words: "add a suppliers table with a name column", uses: [] }] },
      "add:table": { table: [{ table: { name: "suppliers", read: "none", write: "none", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
    },
  }, async (P) => {
    const before = { home: P.page("index.tsx"), about: P.page("about.tsx"), list: P.pages() };
    const r = await sendMessage(P, { message: "Please add a suppliers table with a name column, for me to fill in later." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    assert.equal(creates(db, "suppliers"), 1);
    assert.equal(calls(P, T.pages), 0, "a page writer was asked for a table nothing shows");
    assert.deepEqual({ home: P.page("index.tsx"), about: P.page("about.tsx"), list: P.pages() }, before);
    once(P);
  });
});

test("GN 1 control — A TABLE A PAGE SHOWS (`shows: \"/about\"`): the page writer is asked, once, and writes the page that shows it", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const ABOUT_LIST = "import { createFileRoute } from '@tanstack/react-router'\n"
    + "export const Route = createFileRoute('/about')({ component: Page })\n"
    + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section><h2>Our suppliers</h2></section></main> }\n";
  await withPlatform({
    slug: slugOf("1c"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table"], scopes: [{ kind: "table", words: "add a suppliers list to the About page", uses: [] }] },
      "add:table": { table: [{ table: { name: "suppliers", access: "public", columns: [{ name: "name", type: "text" }] }, seed: [{ name: "Mill Farm" }], shows: "/about" }] },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_LIST }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please add a suppliers list to the About page." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    assert.equal(calls(P, T.pages), 1);
    assert.ok(P.page("about.tsx").includes("Our suppliers"));
    once(P);
  });
});

// ── 3. THE STEPS OF ONE MULTI-STEP EDIT PREPARE THEIR MODEL WORK TOGETHER ───

/** Calls that may finish only once all have started; `false` for one that waited out the limit alone. */
function rendezvous(names, ms = 2500) {
  const at = {}, met = {};
  let open;
  const all = new Promise((r) => { open = r; });
  return {
    met,
    async arrive(name) {
      if (Object.hasOwn(at, name)) return true;
      at[name] = Date.now();
      if (names.every((n) => Object.hasOwn(at, n))) open();
      met[name] = await Promise.race([all.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))]);
      return met[name];
    },
  };
}
const shownFile = (args) => {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2) };
};

test("GN 5 — ONE LOOK CHANGE WITH TWO STEPS (the home heading made bigger by the page step, and a photograph for the Visit page by the picture step): the later step's model work is prepared while the earlier step runs — the two calls meet — and its job turn replays it exactly; the steps still write in turn, both land in their own publishes, each model call made once, nothing charged twice", { timeout: 30000 }, async () => {
  const meet = rendezvous(["tweak", "pictures"]);
  const HEADING = "make the home page heading bigger";
  const PHOTO = "put a photograph of the bakery's front on the Visit page";
  const HOME_P = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
  const VISIT_P = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><SafeImage src=\"\" alt=\"The bakery's front\" ratio=\"4/3\" /></section>");
  const BIG = '<h1 className="text-6xl">Harbour Loaf</h1>';
  await withPlatform({
    slug: slugOf("5"), pages: [{ path: "index.tsx", source: HOME_P }, { path: "visit.tsx", source: VISIT_P }], images: true, balance: 400,
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: { fields: ["shape", "images"], scopes: [{ part: "shape", page: "/", words: HEADING }, { part: "images", page: "/visit", words: PHOTO }] },
      [T.tweak]: async (args) => { await meet.arrive("tweak"); const f = shownFile(args); return { source: String(f && f.source).replace("<h1>Harbour Loaf</h1>", BIG) }; },
      choose_pictures: async () => { await meet.arrive("pictures"); return { pictures: [{ page: "visit.tsx", alt: "The bakery's front", describe: "the front of a small bakery at dawn" }] }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + HEADING + ", and " + PHOTO + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    assert.deepEqual(meet.met, { tweak: true, pictures: true }, "the later step's model work waited for the earlier step: " + JSON.stringify(meet.met));
    assert.ok(P.page("index.tsx").includes(BIG), "the page step did not land");
    assert.match(P.page("visit.tsx"), /<SafeImage src="\/u\/[^"]+" alt="The bakery's front"/, "the picture step did not land");
    assert.equal(calls(P, T.tweak), 1, "the page step was asked more than once");
    assert.equal(calls(P, "choose_pictures"), 1, "the picture step's prepared answer was not replayed by its turn");
    assert.equal(P.imageLog.length, 1, "the photograph was bought more than once (or by the preparation)");
    once(P);
  });
});

test("GN 5b — THE EARLIER STEP WRITES WHAT THE LATER ONE READS (the page step puts the old shop photograph into the Visit frame, and the picture step works on that page): the later step is not prepared beside it — a genuine dependency waits — so its one call is made after the frame changed and is shown the frame as it now is; each step lands once", { timeout: 30000 }, async () => {
  const FILL = "on the Visit page, use the old shop photo in the empty frame";
  const PHOTO = "and then put a new photograph of the bakery's front there";
  const HOME_P = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
  const VISIT_P = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><SafeImage src=\"\" alt=\"The bakery's front\" ratio=\"4/3\" /></section>");
  const seen = [];
  await withPlatform({
    slug: slugOf("5b"), pages: [{ path: "index.tsx", source: HOME_P }, { path: "visit.tsx", source: VISIT_P }], images: true, balance: 400,
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: { fields: ["shape", "images"], scopes: [{ part: "shape", page: "/visit", words: FILL }, { part: "images", page: "/visit", words: PHOTO }] },
      [T.tweak]: async (args) => { const f = shownFile(args); return { source: String(f && f.source).replace("src=\"\"", "src=\"/u/shop/front.jpg\"") }; },
      choose_pictures: async (args) => {
        seen.push(String(args.messages[0].content));
        return { pictures: [{ page: "visit.tsx", alt: "The bakery's front", describe: "the front of a small bakery at dawn" }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + FILL + ", " + PHOTO + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec) + JSON.stringify(rec.parts[0].notDone));
    assert.equal(calls(P, "choose_pictures"), 1, "the picture step was prepared beside a step that writes the page it reads");
    assert.ok(!seen[0].includes("(empty"), "the picture step was not shown the frame as the earlier step left it");
    assert.match(P.page("visit.tsx"), /<SafeImage src="\/u\/[^"]+" alt="The bakery's front"/);
    once(P);
  });
});

// ── 4. THE LAST WRITER STAGE THAT COULD NOT ASK ─────────────────────────────

test("GN 6 — THE ADDITION'S PAGE WRITER ASKS (where on the About page the questions go): nothing is applied and the question names the page writer; after the answer only the writer is asked again, shown the answer — the picker's and the designer's finished answers are replayed, never asked again; the section lands once, nothing charged twice", { timeout: 30000 }, async () => {
  const W_FAQ = "add a questions section to the About page";
  const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { Card } from '@/components/ui/card'\n"
    + "export const Route = createFileRoute('/about')({ component: Page })\n"
    + "function Page(){ return <main><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section></main> }\n";
  const n = { pick: 0, comp: 0, pages: 0 };
  const writerSaw = [];
  await withPlatform({
    slug: slugOf("6"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] }; },
      "add:component": async () => { n.comp++; return { component: [{ page: "/about", where: "on the About page", does: "answers common questions", components: ["card"] }] }; },
      [T.pages]: async (args) => {
        n.pages++;
        writerSaw.push(JSON.stringify(args.messages || []));
        return n.pages === 1 ? { question: { text: "Should the questions go above or below the story?", options: ["Above", "Below"] } } : { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] };
      },
    },
  }, async (P) => {
    const before = P.page("about.tsx");
    const r = await sendMessage(P, { message: "Please " + W_FAQ + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    assert.equal(P.page("about.tsx"), before, "the addition was applied beside the page writer's question");
    const q = P.question();
    assert.ok(q && q.by === "add:pages", "the question does not name the page writer: " + JSON.stringify(q && q.by));
    await sendMessage(P, { message: "Above", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.deepEqual(n, { pick: 1, comp: 1, pages: 2 });
    assert.match(writerSaw[1], /Above/, "the page writer was not shown the answer");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    once(P);
  });
});
