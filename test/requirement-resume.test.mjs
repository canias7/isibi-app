// REQUIREMENTS ACROSS A CLARIFICATION AND ITS RESUME (2026-10-11, round 12,
// after Codex's review of 6c2d3887).
//
// The reproduction: an About-page FAQ with collapsible and searchable answers.
// The first component answer names /does-not-exist and records both
// requirements; its correction asks "Above or below the story?"; the customer
// answers "Below"; the resumed designer returns a valid /about design and the
// writer builds static cards.
//   control  — the resumed designer repeats both: both reach the judge, the
//              stored answer and the reply, and the request is partial;
//   failure 1 — it repeats only collapsible: searchable vanished everywhere;
//   failure 2 — it repeats neither: the judge never ran and the request
//              finished done with nothing missing.
// RI 5 passed only because its resumed answer repeated both.
//
// Now the paused job holds every requirement it had, with its id, under its
// own job id; the part's next job is handed them and reconciles them with the
// designer of their step, which is shown them by id. A model leaving one out
// never cancels it; only the judge, shown the customer's answers, can set one
// aside. Each case reads the judge's real input, the durable records, the final
// status and the reply writer's facts, through the real driver, queue
// consumer, routes and job runner.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, pump, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "rr-" + k + "-" + Math.random().toString(16).slice(2, 8);
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

const Q = { question: { text: "Above or below the story?", options: ["Above", "Below"] } };
const Q2 = { question: { text: "Should the questions be grouped?", options: ["Grouped", "One list"] } };
/** The designer's calls, in order, as the model was asked them. */
const designerCalls = (P) => P.modelLog.filter((m) => m.tool === "add:component" || /add_component/.test(m.tool || ""));
/** Answer the request's open question with `text`, then settle. */
async function answer(P, key, text) {
  const q = P.question();
  assert.ok(q, "no question was put to the customer");
  await sendMessage(P, { message: text, ask: { id: q.id, chosen: true } });
  return settle(P, key);
}
/** The requirements the paused job held, from its own durable record. */
const heldOf = (P) => [...P.objects.entries()].filter(([k]) => /^jobs\/prepared\/[^/]+\.held\.json$/.test(k)).map(([k, o]) => ({ key: k, ...JSON.parse(o.body) }));

/** Text of a model call's user messages. */
const textOf = (args) => (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
/** The id a designer was shown for `need` in its held list ("- <id>: <need>"), or null. */
const shownId = (args, need) => { const m = new RegExp("^- ([a-z]+#s?\\d+): " + need.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "m").exec(textOf(args)); return m ? m[1] : null; };

/** The reproduction's designer: first answer refused (both requirements), correction asks, then `resumed(args, n)`. */
function reproAnswers(resumed, counter) {
  return async (args) => {
    counter.n++;
    counter.args.push(args);
    if (counter.n === 1) return FAQ("/does-not-exist", [R(COLL), R(SEARCH)]);
    if (counter.n === 2) return Q;
    return typeof resumed === "function" ? resumed(args, counter.n) : resumed;
  };
}

async function reproCase(slugKey, resumed, extra = {}) {
  const j = extra.judge || judgeLog();
  const c = { n: 0, args: [] };
  let out = null;
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 400, answers: answers(reproAnswers(resumed, c), j.fn, extra.answers || {}) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    const held = heldOf(P)[0] || null;
    await answer(P, r.key, extra.reply || "Below");
    const o = await outcome(P, r.key);
    out = { o, j, c, P, held, key: r.key };
    if (extra.check) await extra.check(out);
    once(P);
  });
  return out;
}

test("RR 0 control — THE RESUMED DESIGNER REPEATS BOTH: both reach the judge, the stored answer and the reply writer; the request is partial; nothing is told twice", { timeout: 30000 }, async () => {
  const { o, j, c } = await reproCase("0", FAQ("/about", [R(COLL), R(SEARCH)]));
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
  assert.equal(o.notDone.length, 2, "a requirement was told twice: " + JSON.stringify(o.notDone));
  assert.equal(c.n, 3);
});

test("RR 1 — CODEX'S FAILURE 1: the resumed designer repeats only collapsible — searchable is restored from what the paused job held: judged, stored, told; partial", { timeout: 30000 }, async () => {
  const { o, j, c } = await reproCase("1", FAQ("/about", [R(COLL)]));
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
  assert.equal(c.n, 3);
});

test("RR 2 — CODEX'S FAILURE 2: the resumed designer repeats neither — the judge runs on both held requirements, and the request is partial, never done with nothing missing", { timeout: 30000 }, async () => {
  const { o, j, c } = await reproCase("2", FAQ("/about", []));
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
  assert.notEqual(o.status, "done");
  assert.equal(c.n, 3);
});

test("RR 3 — THE RESUMED DESIGNER IS SHOWN WHAT ITS STEP HELD, BY ID: a requirement it restates in new words and marks `replaces` is told once; the other keeps its held id at the judge", { timeout: 30000 }, async () => {
  const reworded = "Tapping a question shows or hides its answer";
  let shown = null;
  const { o, j, c, held } = await reproCase("3", (args) => {
    shown = { coll: shownId(args, COLL), search: shownId(args, SEARCH) };
    return FAQ("/about", [R(reworded, { replaces: shown.coll })]);
  });
  assert.ok(shown && shown.coll && shown.search, "the resumed designer was not shown the held requirements by id: " + textOf(c.args[2]).slice(-600));
  assert.ok(held, "the paused job held nothing");
  assert.deepEqual([shown.coll, shown.search].sort(), held.requirements.map((x) => x.id).sort(), "the ids shown are not the held ones");
  assertJudged(j.sent, [reworded, SEARCH]);
  const last = j.sent[j.sent.length - 1];
  assert.ok(!last.some((e) => e.need === COLL), "a requirement marked as restated was told again");
  assert.equal(last.find((e) => e.need === SEARCH).id, shown.search, "the held requirement lost its id across the pause");
  assert.deepEqual(o.notDone, [reworded, SEARCH].sort());
  assert.equal(o.status, "partial");
});

test("RR 4 — AN ORDINARY DESIGNER QUESTION: the first answer asks and writes both requirements beside it; the resumed design lists none — both held, judged and told", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("4"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? { ...Q, requirements: [R(COLL), R(SEARCH)] } : FAQ("/about", []); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    await answer(P, r.key, "Below");
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(n, 2);
    once(P);
  });
});

test("RR 5 — THE PAGE WRITER ASKS after a valid design with both requirements: the designer's answer is replayed (asked once), the held requirements reconcile with it, and both are judged and told once", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0, w = 0;
  await withPlatform({
    slug: slugOf("5"), pages: PAGES, replies: true, balance: 400,
    answers: answers(async () => { n++; return FAQ("/about", [R(COLL), R(SEARCH)]); }, j.fn, {
      [T.pages]: async () => { w++; return w === 1 ? { pages: [], question: { text: "Should the answers start open?", options: ["Open", "Closed"] } } : { pages: [{ path: "src/routes/about.tsx", source: ABOUT_CARDS }] }; },
    }),
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    await answer(P, r.key, "Closed");
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(o.notDone.length, 2, "told twice: " + JSON.stringify(o.notDone));
    assert.equal(n, 1, "the designer was asked again although the question did not reach it");
    assert.equal(w, 2);
    once(P);
  });
});

test("RR 6 — THE JUDGE ASKS: its question pauses the part with every requirement held; after the answer both are judged again and told once", { timeout: 30000 }, async () => {
  const sent = [];
  let k = 0;
  const judge = (args) => {
    k++;
    const text = textOf(args);
    const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
    const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    sent.push(lines);
    if (k === 1) return { verdicts: [], question: { text: "Do you mean a search box on the page?", options: ["Yes", "No"] } };
    return { verdicts: lines.map((e) => ({ id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
  };
  let n = 0;
  await withPlatform({ slug: slugOf("6"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return FAQ("/about", n === 1 ? [R(COLL), R(SEARCH)] : [R(COLL)]); }, judge) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    await answer(P, r.key, "Yes");
    const o = await outcome(P, r.key);
    assertJudged(sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    once(P);
  });
});

test("RR 7 — REPEATED QUESTIONS: the correction asks, the resumed designer asks again with no requirements, then designs listing none — both requirements survive both pauses, judged and told", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("7"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL), R(SEARCH)]) : n === 2 ? Q : n === 3 ? Q2 : FAQ("/about", []); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    await answer(P, r.key, "Below");
    await answer(P, r.key, "One list");
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    assert.equal(n, 4);
    once(P);
  });
});

test("RR 8 — A DEPENDENCY RE-ASK AFTER THE RESUME: beside a table, the resumed designer needs the table, is asked again with it, and lists only collapsible — searchable is restored; the table is made once and its designer asked once", { timeout: 30000 }, async () => {
  const j = judgeLog();
  const db = rowsDb({ tables: {} });
  let n = 0, t = 0;
  const W_TABLE = "add a signups table with a name column";
  await withPlatform({
    slug: slugOf("8"), pages: PAGES, replies: true, balance: 400, db,
    answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL), R(SEARCH)]) : n === 2 ? Q : n === 3 ? { needs: ["table"] } : FAQ("/about", [R(COLL)]); }, j.fn, {
      [T.adds]: { kinds: ["table", "component"], scopes: [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: ASK, uses: [] }] },
      "add:table": async () => { t++; return { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] }; },
    }),
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + ASK + "." });
    await settle(P, r.key);
    await answer(P, r.key, "Below");
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assert.equal(o.status, "partial", why(o.rec));
    assert.deepEqual(o.notDone, [COLL, SEARCH].sort());
    assert.equal(t, 1, "the table's designer, which the answer does not reach, was asked again");
    assert.equal(db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length, 1, "the table was made more than once");
    once(P);
  });
});

test("RR 9 — RESTART AND DUPLICATE DELIVERY OVER FAILURE 2: every queued message delivered twice at once, then every message again — both requirements still held, judged and told; nothing charged twice", { timeout: 30000 }, async () => {
  const j = judgeLog();
  const c = { n: 0, args: [] };
  await withPlatform({ slug: slugOf("9"), pages: PAGES, replies: true, balance: 400, answers: answers(reproAnswers(FAQ("/about", []), c), j.fn) }, async (P) => {
    const twice = async () => {
      for (let round = 0; round < 12 && P.queue.length; round++) {
        const msgs = P.queue.splice(0);
        await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
      }
    };
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await twice();
    await settle(P, r.key);
    const q = P.question();
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    await twice();
    await settle(P, r.key);
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
    once(P);
  });
});

test("RR 10 — AN EXPLICIT CHANGE OF SCOPE IS THE CUSTOMER'S, NOT THE MODEL'S: their answer says they no longer want search; the held searchable requirement still reaches the judge, which is shown that answer and sets it aside — only collapsible is told unfinished", { timeout: 30000 }, async () => {
  const sent = [];
  const judge = (args) => {
    const text = textOf(args);
    const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
    const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    sent.push({ lines, sawAnswer: /no search after all/.test(text) });
    return { verdicts: lines.map((e) => (e.need === SEARCH && /no search after all/.test(text)
      ? { id: e.id, follows: "unrelated", carried: "no", reason: "their answer says they no longer want search" }
      : { id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
  };
  const { o } = await reproCase("10", FAQ("/about", [R(COLL)]), { judge: { sent, fn: judge }, reply: "Below — and no search after all" });
  const last = sent[sent.length - 1];
  assert.ok(last.sawAnswer, "the judge was not shown the customer's answer");
  assert.ok(last.lines.some((e) => e.need === SEARCH), "the held requirement never reached the judge: only the model's omission decided");
  assert.deepEqual(o.notDone, [COLL]);
  assert.equal(o.status, "partial");
});

test("RR 10 control — THE MODEL'S OMISSION IS NOT A CANCELLATION: the same answer without that sentence keeps searchable unfinished", { timeout: 30000 }, async () => {
  const { o } = await reproCase("10c", FAQ("/about", [R(COLL)]));
  assert.deepEqual(o.notDone, [COLL, SEARCH].sort());
});

test("RR 11 — THE DURABLE RECORD: the paused job holds both requirements under its own job id, with ids, its asker, and no claim of a design that was never built; the part's next job is staged exactly those, never read from the site's latest answer", { timeout: 30000 }, async () => {
  const j = judgeLog();
  const c = { n: 0, args: [] };
  await withPlatform({ slug: slugOf("11"), pages: PAGES, replies: true, balance: 400, answers: answers(reproAnswers(FAQ("/about", []), c), j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    const held = heldOf(P);
    assert.equal(held.length, 1, "the paused job did not hold its requirements durably");
    const job = P.jobsOf(r.key).filter((x) => x.op === "addon").pop();
    assert.equal(held[0].key, "jobs/prepared/" + job.id + ".held.json", "the record is not under the paused job's own id");
    assert.deepEqual(held[0].requirements.map((x) => x.need).sort(), [COLL, SEARCH].sort(), "the held record does not carry both requirements");
    assert.equal(held[0].asked, "component");
    assert.ok(held[0].requirements.every((x) => typeof x.id === "string" && x.id && x.status !== "covered"), "a held requirement has no id, or still claims a design that was never built");
    assert.ok(held[0].requirements.every((x) => !("by" in x) && !("item" in x)), "a held requirement still points at the refused design");
    // THE SITE'S LATEST ANSWER IS NOT THE SOURCE: blank it before the resume.
    for (const k of [...P.objects.keys()].filter((k) => /answer/.test(k) && !/^(jobs|requests)\//.test(k))) P.objects.delete(k);
    await answer(P, r.key, "Below");
    const next = P.jobsOf(r.key).filter((x) => x.op === "addon").pop();
    assert.notEqual(next.id, job.id);
    const staged = P.objects.get("jobs/prepared/" + next.id + ".held-in.json");
    assert.ok(staged, "the part's next job was not staged the held requirements");
    const s = JSON.parse(staged.body);
    assert.equal(s.from, job.id);
    assert.deepEqual(s.requirements.map((x) => x.id).sort(), held[0].requirements.map((x) => x.id).sort());
    const o = await outcome(P, r.key);
    assertBoth(o, [COLL, SEARCH]);
  });
});
