// AN ANSWER THAT ARRIVED IS NOT AN ANSWER THAT CAN BE GIVEN AGAIN (2026-10-11,
// the unusable-answer round, after Codex's review of 648964d5).
//
// Codex's reproduction: one Add-on with an independent table and a FAQ
// component, both `uses: []`. The table's designer asks whether to keep an
// email address; beside it the component's designer answers with a provider
// reply cut off at `max_tokens`. The first job rightly waits for the table's
// answer — but it kept the cut-off reply with the rest, and after "No" the
// component's identical request was answered from that record: the request
// failed, and the component's designer was never asked again. Removing only
// that cached reply (Codex's control) let both changes complete.
//
// The rule now, at the one boundary every recorded answer passes (record,
// stage, read, replay — `builder/prepared.mjs`): a reply that is cut off,
// paused, an error, or not a reply at all is kept for the record but never
// given again, and a record stored before this rule is read under it too. A
// complete answer — a design, a question, a refusal, a reply that changes
// nothing — keeps its meaning and is replayed as before.
//
// Through the real request driver, queue consumer, routes and job runner, with
// supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, T, SOURCE_KEY } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { unusableReply, readPrepared, recorder, replayer } from "../builder/prepared.mjs";

blockNetwork();

const slugOf = (k) => "ua-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
const W_TABLE = "add a signups table with a name column";
const W_FAQ = "add a questions section to the About page";
const SIGNUPS = { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] };
const FAQ = { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["card"] }] };
const EMAIL_Q = { question: { text: "Should signups also keep an email address?", options: ["Yes", "No"] } };
// A PROVIDER REPLY CUT OFF AT ITS TOKEN LIMIT: half a tool call, delivered successfully.
const CUT = { __raw: { stop_reason: "max_tokens", content: [{ type: "tool_use", name: "design", input: { component: [{ page: "/about", where: "after" }] } }] } };
const creates = (db, name) => db.log().filter((q) => new RegExp("create table[^(]*" + name, "i").test(q.query)).length;
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };
const scopes2 = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_FAQ, uses: [] }];
const MSG2 = "Please " + W_TABLE + ", and " + W_FAQ + ".";

// ── 1. THE BOUNDARY ITSELF ──────────────────────────────────────────────────

test("UA 0 — WHICH REPLIES CAN BE GIVEN AGAIN: a design, a question, a refusal, prose that changes nothing are kept with their meaning; a reply cut off at its limit, paused, out of context, an error, or not a reply is never replayed — kept for the record, read under the same rule when stored before it", async () => {
  const tool = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "t", input }] });
  for (const ok of [tool({ a: 1 }), tool({ question: { text: "?" } }), { stop_reason: "refusal", content: [{ type: "text", text: "I can't help with that." }] }, { stop_reason: "end_turn", content: [{ type: "text", text: "Nothing to change." }] }, { stop_reason: "end_turn", content: [] }]) {
    assert.equal(unusableReply(ok), "", JSON.stringify(ok));
  }
  const bad = {
    "max_tokens": { stop_reason: "max_tokens", content: [{ type: "tool_use", name: "t", input: {} }] },
    "pause_turn": { stop_reason: "pause_turn", content: [] },
    "context": { stop_reason: "model_context_window_exceeded", content: [] },
    "error": { type: "error", error: { type: "overloaded_error" } },
    "content not a list": { stop_reason: "tool_use", content: "x" },
    "tool input not an object": { stop_reason: "tool_use", content: [{ type: "tool_use", name: "t", input: "{\"a\":" }] },
    "not an object": "a string",
  };
  for (const [name, r] of Object.entries(bad)) assert.notEqual(unusableReply(r), "", name);
  // RECORDED: kept with its verdict; a record stored without one is read under the rule.
  const rec = recorder();
  const send = rec.wrap(async (req) => (req.n === 1 ? bad.max_tokens : tool({ ok: req.n })));
  await send({ model: "m", messages: [{ role: "user", content: "1" }], n: 1 });
  await send({ model: "m", messages: [{ role: "user", content: "2" }], n: 2 });
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls }));
  assert.equal(stored.calls.length, 2, "the cut-off reply was not kept for the record");
  assert.match(stored.calls[0].unusable, /max_tokens/);
  const read = readPrepared(stored);
  assert.equal(read.calls.length, 1);
  assert.equal(read.discarded.length, 1);
  const old = { calls: stored.calls.map(({ h, reply }) => ({ h, reply })) };
  assert.equal(readPrepared(old).calls.length, 1, "a record stored before the rule replayed a cut-off reply");
  // REPLAYED: the usable one answered from the record, the cut-off one asked again.
  let made = 0;
  const rp = replayer(old);
  const again = rp.wrap(async () => { made++; return tool({ fresh: true }); });
  await again({ model: "m", messages: [{ role: "user", content: "1" }] });
  await again({ model: "m", messages: [{ role: "user", content: "2" }] });
  assert.equal(made, 1);
  assert.deepEqual(rp.used(), { calls: 1, rebased: 0, images: 0, missed: 1 });
});

// ── 2. THROUGH THE REAL PATHS ───────────────────────────────────────────────

async function tableAskComponentCut(P, db, { age = false, twice = false, changeAbout = null } = {}) {
  const r = await sendMessage(P, { message: MSG2 });
  const s1 = await settle(P, r.key);
  assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
  assert.equal(creates(db, "signups"), 0);
  const q = P.question();
  assert.ok(q && q.by === "add:table", "the question does not name the table's designer: " + JSON.stringify(q && q.by));
  if (age) {
    // RECORDS STORED BEFORE THE RULE: every kept answer as it was written then.
    const keys = P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".kept.json"));
    assert.ok(keys.length, "nothing was kept");
    for (const k of keys) { const v = JSON.parse(P.readObj(k)); P.writeObj(k, JSON.stringify({ calls: v.calls.map(({ h, reply }) => ({ h, reply })) })); }
  }
  if (changeAbout) P.writeObj(SOURCE_KEY(P.slug), JSON.stringify(JSON.parse(P.readObj(SOURCE_KEY(P.slug))).map((p) => (p.path === "about.tsx" ? { ...p, source: changeAbout } : p))));
  await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
  if (twice) {
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
  }
  return { r, s2: await settle(P, r.key) };
}

test("UA 1 — CODEX'S REPRODUCTION: the table's designer asks while the component's answer is cut off at max_tokens; after \"No\" the table is asked again with the answer and the component's designer is asked again (never answered from the cut-off reply); both land, the table made once, the picker asked once, nothing charged twice", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, component: 0 };
  await withPlatform({
    slug: slugOf("1"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "component"], scopes: scopes2 }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return n.component === 1 ? CUT : FAQ; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const { s2 } = await tableAskComponentCut(P, db);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.deepEqual(n, { pick: 1, table: 2, component: 2 });
    assert.equal(creates(db, "signups"), 1);
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    // THE CUT-OFF REPLY IS STILL IN THE FIRST JOB'S RECORD, MARKED.
    const kept = P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".kept.json")).map((k) => JSON.parse(P.readObj(k)));
    assert.ok(kept.some((v) => v.calls.some((c) => typeof c.unusable === "string" && /max_tokens/.test(c.unusable))), "the cut-off reply's record was not kept for diagnosis");
    once(P);
  });
});

test("UA 2 — THE SAME, WITH THE KEPT RECORDS WRITTEN BEFORE THIS RULE (no verdict on any entry): the cut-off reply is still never replayed; the component is asked again, both land, the table made once", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, component: 0 };
  await withPlatform({
    slug: slugOf("2"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "component"], scopes: scopes2 }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return n.component === 1 ? CUT : FAQ; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const { s2 } = await tableAskComponentCut(P, db, { age: true });
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.deepEqual(n, { pick: 1, table: 2, component: 2 });
    assert.equal(creates(db, "signups"), 1);
    once(P);
  });
});

test("UA 3 — A USABLE ANSWER BESIDE A CUT-OFF ONE: the table asks, a gallery page's design is complete, the FAQ's is cut off; after the answer the page's design is replayed (one call in all), the FAQ asked again, the table asked again — all land once", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, page: 0, component: 0 };
  const scopes = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "page", words: "add a gallery page", uses: [] }, { kind: "component", words: W_FAQ, uses: [] }];
  const GALLERY = { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] }] };
  await withPlatform({
    slug: slugOf("3"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "page", "component"], scopes }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:page": async () => { n.page++; return GALLERY; },
      "add:component": async () => { n.component++; return n.component === 1 ? CUT : FAQ; },
      [T.pages]: { pages: [writtenPage("/gallery"), { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", add a gallery page, and " + W_FAQ + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    const q = P.question();
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.deepEqual(n, { pick: 1, table: 2, page: 1, component: 2 });
    assert.equal(creates(db, "signups"), 1);
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    once(P);
  });
});

test("UA 4a — A KEPT ANSWER IS CHECKED AGAINST WHAT ITS CALL READ, NOT EVERYTHING: the table asks, the FAQ's design is complete; before the answer another writer changes the About page's text, which the designer is not shown — its request is byte for byte the same, so its design is replayed (one call); the page writer, which reads the page, writes onto the page as it now is", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, component: 0 };
  const writerSaw = [];
  const CHANGED = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019, by the harbour.</p></section>");
  await withPlatform({
    slug: slugOf("4a"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "component"], scopes: scopes2 }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return FAQ; },
      [T.pages]: async (args) => { writerSaw.push(JSON.stringify(args.messages || [])); return { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ.replace("Since 2019.", "Since 2019, by the harbour.") }] }; },
    },
  }, async (P) => {
    const { s2 } = await tableAskComponentCut(P, db, { changeAbout: CHANGED });
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.deepEqual(n, { pick: 1, table: 2, component: 1 });
    assert.match(writerSaw[writerSaw.length - 1], /by the harbour/, "the page writer was not shown the page as it now is");
    assert.ok(P.page("about.tsx").includes("by the harbour") && P.page("about.tsx").includes("Do you deliver?"));
    assert.equal(creates(db, "signups"), 1);
    once(P);
  });
});

test("UA 4b — A KEPT ANSWER WHOSE OWN INPUT CHANGED: the table asks, the FAQ's design is complete; before the answer another writer adds a page, which the designer IS shown (the site's pages) — its kept answer was made for the old list, so it is asked again, and the addition lands", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, component: 0 };
  const shown = [];
  await withPlatform({
    slug: slugOf("4b"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "component"], scopes: scopes2 }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async (args) => { n.component++; shown.push(JSON.stringify(args.messages || [])); return FAQ; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MSG2 });
    await settle(P, r.key);
    const q = P.question();
    assert.ok(q && q.by === "add:table");
    const k = SOURCE_KEY(P.slug);
    P.writeObj(k, JSON.stringify([...JSON.parse(P.readObj(k)), { path: "menu.tsx", source: pageSrc("/menu", "<section><h1>Menu</h1></section>") }]));
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.equal(n.table, 2);
    assert.equal(n.component, 2, "a kept answer made for the old page list was replayed");
    assert.match(shown[1], /\/menu/, "the designer was not shown the page list as it now is");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    once(P);
  });
});

test("UA 5 — DUPLICATE DELIVERY AND RESTART: Codex's reproduction with every message after the answer delivered twice at once, then the finished job's message delivered again — still two calls to each designer in all, the table made once, the page published once, nothing charged twice", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, component: 0 };
  await withPlatform({
    slug: slugOf("5"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "component"], scopes: scopes2 }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return n.component === 1 ? CUT : FAQ; },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const { r, s2 } = await tableAskComponentCut(P, db, { twice: true });
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    // RESTART: every message the request ever sent comes again, after it finished.
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    await settle(P, r.key);
    assert.deepEqual(n, { pick: 1, table: 2, component: 2 });
    assert.equal(creates(db, "signups"), 1);
    once(P);
  });
});

// ── 3. THE SAME RULE ON THE EDIT PATH ───────────────────────────────────────

const DESC = "Make the site description say Sourdough baked at dawn by the harbour";
const BRAND = "rename the business to Harbour Loaf & Co";
const NEW_DESC = "Sourdough baked at dawn by the harbour.";
const NEW_BRAND = "Harbour Loaf & Co";

test("UA 6 — THE LOOK DOOR: the name lane asks while the description lane's reply is cut off at max_tokens; nothing changes; after the answer the name lane is asked again with it and the description lane is asked again (never answered from the cut-off reply) — both land in one publish, nothing charged twice", { timeout: 30000 }, async () => {
  const n = { desc: 0, brand: 0 };
  await withPlatform({
    slug: slugOf("6"),
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: (args, k) => (k === 0
        ? { fields: ["brand", "description"], scopes: [{ part: "brand", words: BRAND }, { part: "description", words: DESC }] }
        : { fields: ["brand", "description"], scopes: [{ part: "brand", words: BRAND, answers: [1] }, { part: "description", words: DESC, answers: [] }] }),
      "lane:brand": async () => { n.brand++; return n.brand === 1 ? { question: { text: "Keep the ampersand?", options: ["Keep &", "Write and"] } } : NEW_BRAND; },
      "lane:description": async () => { n.desc++; return n.desc === 1 ? { __raw: { stop_reason: "max_tokens", content: [{ type: "tool_use", name: "lane", input: { description: "Sourdough baked at da" } }] } } : NEW_DESC; },
    },
  }, async (P) => {
    const before = { ...P.look() };
    const r = await sendMessage(P, { message: BRAND + ", and " + DESC + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    assert.equal(P.look().description, before.description);
    const q = P.question();
    await sendMessage(P, { message: "Keep &", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.equal(P.look().description, NEW_DESC);
    assert.equal(P.look().brand, NEW_BRAND);
    assert.deepEqual(n, { desc: 2, brand: 2 });
    once(P);
  });
});
