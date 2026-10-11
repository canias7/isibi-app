// A REQUIREMENT'S IDENTITY ACROSS A CORRECTION (2026-10-11, round 11, after
// Codex's review of 7f5e753b).
//
// The control: a valid FAQ answer lists two requested requirements —
// collapsible answers and searchable answers — and when the writer builds
// static cards both stay visible as unfinished.
//
// Failure 1: the refused answer lists both under the same quoted phrase,
// "collapsible and searchable answers", and the correction keeps only the
// collapsible one. Matching by quoted words read the searchable one as
// replaced and dropped it. A quote grounds a requirement; it is not its
// identity.
//
// Failure 2: the refused answer lists the collapsible requirement as
// `component#0`, the correction lists the distinct searchable one as
// `component#0`. Carrying the old one made two requirements share an id: both
// reached the judge, and the reconcile after it lost the searchable one.
//
// Now a requirement replaces another only where that is established (the
// correction says which earlier one it restates, `replaces`; the same hand-off
// answered; the same need word for word), every carried one gets a fresh id,
// and an uncertain paraphrase is kept. Each case reads what the judge was
// really sent, the stored answer, the final status and the reply writer's
// facts, through the real driver, queue consumer, routes and job runner.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, pump, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "ri-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.notDone]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const ABOUT_CARDS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
const ASK = "add a questions section to the About page with collapsible and searchable answers";
const QUOTE = "collapsible and searchable answers";
const COLL = "Each answer opens and closes when its question is tapped";
const SEARCH = "A visitor can search the answers";
const NUMBER = "The questions are numbered";
const R = (need, extra = {}) => ({ need, basis: "asked", words: QUOTE, status: "covered", by: "the questions section", item: "/about", kind: "page", ...extra });
const FAQ = (page, requirements = []) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }], requirements });

/** A judge that answers as a model would (static cards carry neither), and keeps what it was sent. */
function judgeLog() {
  const sent = [];
  const fn = (args) => {
    const text = (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
    const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
    const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    sent.push(lines);
    return { verdicts: lines.map((e) => ({ id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
  };
  return { sent, fn };
}
const answers = (component, judge, extra = {}) => ({
  route: { intent: "addon" },
  [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: ASK, uses: [] }] },
  "add:component": component,
  [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_CARDS }] },
  judge_requirements: judge,
  ...extra,
});
/** What the customer is told is unfinished, what the judge saw, what was stored, and what the reply writer was given. */
async function outcome(P, key) {
  const { rec } = await settle(P, key);
  await pump(P);
  const job = P.jobsOf(key).filter((j) => j.op === "addon").pop();
  const ans = job ? P.answerOf(job) : null;
  return {
    rec,
    status: rec.parts[0].status,
    notDone: (rec.parts[0].notDone || []).map((x) => x.what).sort(),
    told: ((ans && ans.requirementsTold) || []).map((t) => t.need).sort(),
    replyText: P.replyLog.map((facts) => facts.map((f) => f.text).join(" ")).join("\n"),
  };
}
function assertJudged(sent, needs) {
  assert.ok(sent.length >= 1, "the judge never ran");
  const last = sent[sent.length - 1];
  const ids = last.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "two requirements reached the judge under one id: " + JSON.stringify(ids));
  for (const n of needs) assert.ok(last.some((e) => e.need === n), "the judge was not sent: " + n + " — " + JSON.stringify(last.map((e) => e.need)));
}
function assertBoth(o, needs) {
  assert.equal(o.status, "partial", why(o.rec));
  assert.deepEqual(o.notDone, [...needs].sort(), "not every requested requirement is told unfinished");
  for (const n of needs) assert.ok(o.told.includes(n), "the stored answer does not tell: " + n);
  for (const n of needs) assert.ok(o.replyText.includes(n), "the reply writer was not given: " + n);
}

test("RI 0 control — THE VALID ANSWER FIRST lists both requirements: both judged under their own ids, both told unfinished, stored and given to the reply writer", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("0"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return FAQ("/about", [R(COLL), R(SEARCH)]); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(n, 1);
    once(P);
  });
});

test("RI 1 — CODEX'S FAILURE 1: the refused answer lists both under one quoted phrase; the correction keeps only the collapsible one — the searchable one is not read as replaced: both judged, both told unfinished", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("1"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL), R(SEARCH)]) : FAQ("/about", [R(COLL)]); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(n, 2);
    once(P);
  });
});

test("RI 2 — CODEX'S FAILURE 2: the refused answer's collapsible requirement is `component#0` and the correction's distinct searchable one is `component#0` too — they never share an id: both judged, both told unfinished", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("2"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL)]) : FAQ("/about", [R(SEARCH)]); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    once(P);
  });
});

test("RI 3 — REORDERED AND SEVERAL: the refused answer lists searchable, collapsible and numbered; the correction lists collapsible reworded and marked as restating `component#1`, then searchable word for word — numbered is carried, nothing is told twice, three requirements in all", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  const REWORDED = "A visitor can show or hide each answer";
  const seen = [];
  await withPlatform({
    slug: slugOf("3"), pages: PAGES, replies: true, balance: 400,
    answers: answers(async (args) => { n++; seen.push(JSON.stringify(args.messages || [])); return n === 1 ? FAQ("/does-not-exist", [R(SEARCH), R(COLL), R(NUMBER)]) : FAQ("/about", [R(REWORDED, { replaces: "component#1" }), R(SEARCH)]); }, j.fn),
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const o = await outcome(P, r.key);
    assert.match(seen[1], /component#1: Each answer opens and closes/, "the correction was not shown the earlier requirements by id");
    assertJudged(j.sent, [REWORDED, SEARCH, NUMBER]);
    assertBoth(o, [REWORDED, SEARCH, NUMBER]);
    assert.ok(!o.notDone.includes(COLL), "a requirement the correction marked as restated was told again");
  });
});

test("RI 4 — A HAND-OFF IN THE REFUSED ANSWER: it hands the page writer a requirement (`elsewhere`, step page) the correction no longer lists; it is carried as the hand-off it was, under a fresh id — judged and told — while the correction's own requirement is judged beside it", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  const HAND = "The questions show on the About page";
  await withPlatform({
    slug: slugOf("4"), pages: PAGES, replies: true, balance: 400,
    answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL), { need: HAND, basis: "asked", words: QUOTE, status: "elsewhere", step: "page" }]) : FAQ("/about", [R(COLL)]); }, j.fn),
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const o = await outcome(P, r.key);
    const all = j.sent.flat();
    const hand = all.find((e) => e.need === HAND);
    assert.ok(hand, "the carried hand-off never reached the judge: " + JSON.stringify(all.map((e) => e.need)));
    assert.equal(hand.status, "elsewhere", "the carried hand-off lost its hand-off");
    assert.match(String(hand.id), /^component#s\d+$/, "the carried hand-off kept an id another answer may use: " + hand.id);
    assert.ok(o.told.includes(HAND) && o.told.includes(COLL), JSON.stringify(o.told));
  });
});

test("RI 5 — A CORRECTION THAT ASKS, THEN RESUMES: the refused answer lists both; the correction asks; after the answer the design lists both — both judged once each under distinct ids, both told unfinished", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  const Q = { question: { text: "Above or below the story?", options: ["Above", "Below"] } };
  await withPlatform({ slug: slugOf("5"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL), R(SEARCH)]) : n === 2 ? Q : FAQ("/about", [R(COLL), R(SEARCH)]); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    const q = P.question();
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(o.notDone.length, 2, "a requirement was told twice: " + JSON.stringify(o.notDone));
    assert.equal(n, 3);
    once(P);
  });
});

test("RI 6 — A CORRECTION THAT NEEDS A RESULT IT WAS NOT SHOWN: beside a table, the refused answer lists both; the correction needs the table; re-asked (shown the earlier requirements by id), it lists only collapsible — searchable is carried; both judged, both told", { timeout: 30000 }, async () => {
  const j = judgeLog();
  const db = rowsDb({ tables: {} });
  let n = 0;
  const seen = [];
  const W_TABLE = "add a signups table with a name column";
  await withPlatform({
    slug: slugOf("6"), pages: PAGES, replies: true, balance: 400, db,
    answers: answers(async (args) => { n++; seen.push(JSON.stringify(args.messages || [])); return n === 1 ? FAQ("/does-not-exist", [R(COLL), R(SEARCH)]) : n === 2 ? { needs: ["table"] } : FAQ("/about", [R(COLL)]); }, j.fn, {
      [T.adds]: { kinds: ["table", "component"], scopes: [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: ASK, uses: [] }] },
      "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
    }),
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + ASK + "." });
    const o = await outcome(P, r.key);
    assert.equal(n, 3);
    assert.match(seen[2], /component#1: A visitor can search the answers/, "the re-ask lost the earlier requirements");
    assertJudged(j.sent, [COLL, SEARCH]);
    assert.equal(o.status, "partial", why(o.rec));
    assert.deepEqual(o.notDone, [COLL, SEARCH].sort());
  });
});

test("RI 7 — DUPLICATE DELIVERY AND RESTART OVER FAILURE 2: every queued message delivered twice at once, then every message delivered again — both still told unfinished under distinct ids, nothing charged twice", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("7"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL)]) : FAQ("/about", [R(SEARCH)]); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
    await settle(P, r.key);
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(n, 2);
    once(P);
  });
});
