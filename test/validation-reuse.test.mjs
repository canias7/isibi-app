// AN ANSWER ITS STEP REFUSED IS NEVER GIVEN AGAIN (2026-10-11, the validation
// round, after Codex's review of fb50298e).
//
// Codex's reproduction: an independent table designer asks a question while
// the component designer answers with a COMPLETE tool response placing the
// requested About-page FAQ on /does-not-exist. That reply passes the provider
// check (`unusableReply`), but the component's cleaner refuses its page. The
// job pauses on the table's question; after the answer, the component's
// identical request was answered from the record, refused again, and the
// request failed — the paused-job filter cannot help, because a paused job can
// hold another task's refused answer. With only that cached reply removed, the
// next call answered the About page and the request completed.
//
// The rule now: the step that validates a reply marks it when it refuses it
// (`rejectReply`), and that verdict travels with the record exactly as a
// cut-off does — kept for diagnosis, never replayed. At the step's own turn a
// refused answer is corrected ONCE, the model shown the step's structured
// reason; a second refusal is the answer (never a loop). A refusal by the
// model, a question and a no-op are its answers and are never retried.
//
// Through the real request driver, queue consumer, routes and job runner, with
// supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { rejectReply, recorder, readPrepared } from "../builder/prepared.mjs";

blockNetwork();

const slugOf = (k) => "va-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

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
const FAQ_ON = (page) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }] });
const EMAIL_Q = { question: { text: "Should signups also keep an email address?", options: ["Yes", "No"] } };
const creates = (db) => db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length;
const scopes2 = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_FAQ, uses: [] }];
const keptVerdicts = (P) => P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".kept.json")).flatMap((k) => JSON.parse(P.readObj(k)).calls.map((c) => c.unusable).filter(Boolean));

test("VA 0 — THE MARK TRAVELS WITH THE RECORD: a reply its step refused after it was recorded is written with its verdict and never read back as replayable; an unrefused reply beside it is", async () => {
  const tool = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "t", input }] });
  const rec = recorder();
  const send = rec.wrap(async (req) => tool({ n: req.n }));
  const a = await send({ model: "m", messages: [{ role: "user", content: "a" }], n: 1 });
  await send({ model: "m", messages: [{ role: "user", content: "b" }], n: 2 });
  rejectReply(a, "add:no-page");
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls }));
  assert.equal(stored.calls[0].unusable, "rejected:add:no-page");
  assert.equal(stored.calls[1].unusable, undefined);
  const read = readPrepared(stored);
  assert.equal(read.calls.length, 1);
  assert.deepEqual(read.discarded.map((d) => d.why), ["rejected:add:no-page"]);
});

test("VA 1 — CODEX'S REPRODUCTION: the table asks while the component's complete answer puts the FAQ on /does-not-exist (refused by its cleaner); after \"No\" the component is asked again — never answered from the refused reply — and both land: table 2 calls, component 2, picker 1, the table made once, nothing charged twice", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { pick: 0, table: 0, component: 0 };
  await withPlatform({
    slug: slugOf("1"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: async () => { n.pick++; return { kinds: ["table", "component"], scopes: scopes2 }; },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return n.component === 1 ? FAQ_ON("/does-not-exist") : FAQ_ON("/about"); },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + W_FAQ + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    const q = P.question();
    assert.ok(q && q.by === "add:table");
    assert.ok(keptVerdicts(P).some((v) => /^rejected:add:/.test(v)), "the refused reply was not kept with its verdict: " + JSON.stringify(keptVerdicts(P)));
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    assert.deepEqual(n, { pick: 1, table: 2, component: 2 });
    assert.equal(creates(db), 1);
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    once(P);
  });
});

test("VA 2 — A REFUSED ANSWER AT ITS OWN TURN IS CORRECTED ONCE, SHOWN WHY: the component's first answer names a page the site does not have; it is asked again with the cleaner's reason, answers the About page, and lands — 2 calls, the second shown the reason; both billed, nothing charged twice", { timeout: 30000 }, async () => {
  const shown = [];
  let n = 0;
  await withPlatform({
    slug: slugOf("2"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": async (args) => { n++; shown.push(JSON.stringify(args.messages || [])); return n === 1 ? FAQ_ON("/does-not-exist") : FAQ_ON("/about"); },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_FAQ + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    assert.equal(n, 2);
    assert.ok(!shown[0].includes("YOUR LAST ANSWER COULD NOT BE USED"), "the first request carried a correction");
    assert.match(shown[1], /YOUR LAST ANSWER COULD NOT BE USED/, "the correction was not shown the reason");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    once(P);
  });
});

test("VA 3 — A SECOND REFUSAL IS THE ANSWER, NEVER A LOOP: both answers name pages the site does not have; the addition is refused as before, after exactly 2 calls, nothing applied", { timeout: 30000 }, async () => {
  let n = 0;
  await withPlatform({
    slug: slugOf("3"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": async () => { n++; return FAQ_ON("/nowhere-" + n); },
    },
  }, async (P) => {
    const before = P.page("about.tsx");
    const r = await sendMessage(P, { message: "Please " + W_FAQ + "." });
    const { rec } = await settle(P, r.key);
    assert.notEqual(rec.parts[0].status, "done", why(rec));
    assert.equal(n, 2, "the refused answer was retried more than once");
    assert.equal(P.page("about.tsx"), before);
  });
});

test("VA 4 — THE MODEL'S OWN REFUSAL AND ITS QUESTION ARE NEVER RETRIED: a designer that designs nothing is declined after one call; one that asks is asked once and the question kept", { timeout: 30000 }, async () => {
  let n = 0;
  await withPlatform({
    slug: slugOf("4a"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": async () => { n++; return { component: [] }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_FAQ + "." });
    await settle(P, r.key);
    assert.equal(n, 1, "a design of nothing was retried");
  });
  let q = 0;
  await withPlatform({
    slug: slugOf("4b"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": async () => { q++; return { question: { text: "Above or below the story?", options: ["Above", "Below"] } }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_FAQ + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "waiting", why(rec));
    assert.equal(q, 1, "a question was retried");
  });
});

test("VA 5 — DUPLICATE DELIVERY AND RESTART OVER A REFUSED ANSWER: Codex's reproduction with every message after the answer delivered twice at once, then every message the request sent delivered again — still component 2, table 2, the table made once, nothing charged twice", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { table: 0, component: 0 };
  await withPlatform({
    slug: slugOf("5"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table", "component"], scopes: scopes2 },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return n.component === 1 ? FAQ_ON("/does-not-exist") : FAQ_ON("/about"); },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + W_FAQ + "." });
    await settle(P, r.key);
    const q = P.question();
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    await settle(P, r.key);
    assert.deepEqual(n, { table: 2, component: 2 });
    assert.equal(creates(db), 1);
    once(P);
  });
});

test("VA 6 — A NO-OP ANSWERED EARLY IS STILL THE ANSWER: the component designs nothing while the table asks; after \"No\" that answer is given again from the record (component 1 call) — never marked refused, never asked again", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const n = { table: 0, component: 0 };
  await withPlatform({
    slug: slugOf("6"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table", "component"], scopes: scopes2 },
      "add:table": async () => { n.table++; return n.table === 1 ? EMAIL_Q : SIGNUPS; },
      "add:component": async () => { n.component++; return { component: [] }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + W_FAQ + "." });
    await settle(P, r.key);
    const q = P.question();
    assert.ok(q && q.by === "add:table");
    assert.ok(!keptVerdicts(P).some((v) => /^rejected:/.test(v)), "a design of nothing was marked refused");
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    await settle(P, r.key);
    assert.deepEqual(n, { table: 2, component: 1 }, "the early design of nothing was asked again");
    once(P);
  });
});
