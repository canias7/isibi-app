// THE REQUIREMENTS CHECKPOINT IS REQUIRED STATE, AND IT KEEPS EVERY ONE
// (2026-10-12, round 13, after Codex's review of f5c12482).
//
// Reproduction 1, storage: the FAQ clarification case — both requirements
// recorded before the question, neither repeated by the resumed designer.
// The normal control finishes partial. One failed bucket write of the paused
// job's `.held.json` was logged, the question still accepted, and after
// "Below" the request finished done with no judge call and nothing missing.
// Separately, one failed read of the resumed job's `.held-in.json` did the
// same, the saved requirements still sitting in the store.
//
// Reproduction 2, size: twelve distinct, grounded requirements beside each of
// six successive questions, all present in the original request, the final
// designer listing none. Five rounds kept all 60; six rounds kept 60 of 72
// (`MAX_HELD`), and the first twelve never reached judgment or reporting.
//
// Now the pause is acknowledged only once its checkpoint is written and read
// back the same (an empty one included); the resumed job is told which
// checkpoint and how many requirements it resumes from, reads it strictly,
// and never runs under an empty list or an older checkpoint; a failure either
// way runs the part again with its answers replayed. Since round 14 a failure
// that can recover leaves the part `recovering`, run again by the server with
// a growing wait (`test/requirement-recovery.test.mjs`); one known lost —
// missing with no copy, or malformed — fails at once, honestly. Nothing accepted is dropped; the judgment runs in
// bounded batches. Every case reads the judge's real input, the durable
// records, the final status, the stored outcomes and the reply writer's facts.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, pump, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { readHeld, heldCheckpoint } from "../builder/site-requirements.mjs";

blockNetwork();

const slugOf = (k) => "ck-" + k + "-" + Math.random().toString(16).slice(2, 8);
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


const HELD = /^jobs\/prepared\/[^/]+\.held\.json$/;
const HELD_IN = /^jobs\/prepared\/[^/]+\.held-in\.json$/;
/** The FAQ reproduction's designer: refused (both requirements), correction asks, then `resumed`. */
function repro(resumed, counter) {
  return async () => {
    counter.n++;
    if (counter.n === 1) return FAQ("/does-not-exist", [R(COLL), R(SEARCH)]);
    if (counter.n === 2) return Q;
    return typeof resumed === "function" ? resumed(counter.n) : resumed;
  };
}
const runEnds = (P, key) => P.record(key).parts[0].jobs.filter((x) => x.kind === "run").map((x) => (x.end ? x.end.act : null));
const aboutUnchanged = (P) => assert.ok(!P.page("about.tsx").includes("Do you deliver?"), "something was applied");

/**
 * THE FAQ CASE, with `faults(P, phase)` injected at "pause" (before the first
 * message is settled) and "resume" (before "Below" is sent). Returns what the
 * request did.
 */
async function faqCase(slugKey, { faults = () => {}, resumed = FAQ("/about", []), between = null } = {}) {
  const j = judgeLog();
  const c = { n: 0 };
  let out = null;
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 400, answers: answers(repro(resumed, c), j.fn) }, async (P) => {
    faults(P, "pause");
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const s1 = await settle(P, r.key);
    const waiting = s1.rec.parts[0].status === "waiting";
    const asked = waiting ? P.question() : null;
    if (between) await between(P, r.key);
    if (waiting) {
      faults(P, "resume", r.key);
      await sendMessage(P, { message: "Below", ask: { id: asked.id, chosen: true } });
    }
    const o = await outcome(P, r.key);
    out = { o, j, c, P, key: r.key, waiting, ends: runEnds(P, r.key), held: heldOf(P) };
    once(P);
  });
  return out;
}

test("CK 0 control — THE FAQ CASE, NEITHER REQUIREMENT REPEATED, NO FAULT: both are judged, stored and told, and the request is partial", { timeout: 30000 }, async () => {
  const { o, j } = await faqCase("0");
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
});

test("CK 0r — THE DURABLE RECORD OF THAT PAUSE: the checkpoint says it is complete and how many it holds, and the part records the count its pause verified", { timeout: 30000 }, async () => {
  const { held, P, key } = await faqCase("0r");
  assert.equal(held.length, 1);
  assert.equal(held[0].complete, true);
  assert.equal(held[0].count, 2);
  const paused = P.record(key).parts[0].jobs.find((x) => x.end && x.end.act === "clarify");
  assert.equal(paused.end.held, 2, "the part does not record the checkpoint its pause verified");
});

test("CK 1 — CODEX'S REPRODUCTION: ONE FAILED WRITE OF THE PAUSED JOB'S CHECKPOINT is retried and read back before the question is acknowledged; after \"Below\" both are judged, stored and told — partial, never done with nothing missing", { timeout: 30000 }, async () => {
  const { o, j, waiting, held, c } = await faqCase("1", { faults: (P, at) => { if (at === "pause") P.failPut((k) => HELD.test(k)); } });
  assert.ok(waiting, "the question was not asked");
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
  assert.equal(c.n, 3);
  assert.equal(held.length, 1);
  assert.equal(held[0].count, 2);
});

test("CK 2 — THE STORE WILL NOT TAKE THE CHECKPOINT AT ALL (every try of the first job fails): the whole checkpoint rides in the job's answer and is kept on the request part's own job; only then is the question acknowledged; the resumed job is staged that copy and both are told — no designer asked again", { timeout: 30000 }, async () => {
  const { o, j, waiting, ends, c, P, key, held } = await faqCase("2", { faults: (P, at) => { if (at === "pause") for (let i = 0; i < 3; i++) P.failPut((k) => HELD.test(k)); } });
  assert.ok(waiting, "the question was never asked: " + JSON.stringify(ends));
  assert.equal(ends[0], "clarify");
  assert.equal(held.length, 0, "the store took a write it was set to refuse");
  const paused = P.record(key).parts[0].jobs.find((x) => x.end && x.end.act === "clarify");
  assert.equal(paused.end.held, 2);
  assert.deepEqual(paused.end.heldList.map((x) => x.need).sort(), [COLL, SEARCH].sort(), "the request part does not keep the checkpoint");
  assert.equal(c.n, 3, "a designer was asked again: " + c.n);
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
});

test("CK 3 — NEITHER THE STORE NOR THE REQUEST'S COPY EXISTS: known lost, so the part fails at once, saying why (round 14: no wait for a record that cannot come back) — never done, nothing applied, nothing charged, no judge under an empty list", { timeout: 30000 }, async () => {
  const { o, j, ends, P } = await faqCase("3", {
    faults: (P, at) => { if (at === "pause") for (let i = 0; i < 3; i++) P.failPut((k) => HELD.test(k)); },
    between: (P, key) => {
      // THE REQUEST'S COPY IS LOST TOO: what the store never took and the record no longer has.
      const rec = P.record(key);
      const paused = rec.parts[0].jobs.find((x) => x.end && x.end.act === "clarify");
      delete paused.end.heldList;
      const k = "requests/" + P.slug + "/" + key + ".json";
      const ob = P.objects.get(k);
      P.objects.set(k, { ...ob, body: JSON.stringify(rec), etag: ob.etag + "x" });
    },
  });
  assert.deepEqual(ends.slice(1), ["held-retry"], JSON.stringify(ends));
  assert.equal(o.status, "failed", JSON.stringify(o.rec.parts[0]));
  assert.equal(o.rec.parts[0].why, "checkpoint-unread");
  assert.equal(j.sent.length, 0, "the judge ran");
  aboutUnchanged(P);
  assert.equal(P.ledger.filter((e) => e.reason === "reserve").length, 0, "something was charged");
});

test("CK 4 — CODEX'S REPRODUCTION: ONE FAILED READ OF THE RESUMED JOB'S STAGED CHECKPOINT is retried; both requirements resume, are judged and told — partial", { timeout: 30000 }, async () => {
  const { o, j } = await faqCase("4", { faults: (P, at) => { if (at === "resume") P.failGet((k) => HELD_IN.test(k)); } });
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
});

test("CK 5 — THE STAGED COPY AND THE PAUSED JOB'S OWN RECORD ARE BOTH UNREADABLE FOR ONE JOB: it designs and applies nothing (`checkpoint-unread`), the part runs again, reads the saved requirements, and both are told; no designer asked again", { timeout: 30000 }, async () => {
  const { o, j, ends, c, P } = await faqCase("5", { faults: (P, at, key) => { if (at === "resume") { const stopped = () => runEnds(P, key).includes("held-retry"); for (let i = 0; i < 200; i++) P.failGet((k) => !stopped() && (HELD_IN.test(k) || HELD.test(k))); } } });
  assert.ok(ends.includes("held-retry"), "no job stopped on the unreadable checkpoint: " + JSON.stringify(ends));
  assert.equal(c.n, 3, "a designer was asked again");
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
  void P;
});

test("CK 6 — A MALFORMED CHECKPOINT (its count does not match what it lists): never read as fewer requirements — the part fails, saying the checkpoint could not be read; no judge under an empty list, nothing applied, never done", { timeout: 30000 }, async () => {
  const { o, j, P } = await faqCase("6", {
    between: (P) => { for (const [k, ob] of [...P.objects.entries()].filter(([k]) => HELD.test(k))) { const v = JSON.parse(ob.body); v.requirements.pop(); P.objects.set(k, { ...ob, body: JSON.stringify(v), etag: ob.etag + "x" }); } },
  });
  assert.equal(o.status, "failed", JSON.stringify(o.rec.parts[0]));
  assert.equal(o.rec.parts[0].why, "checkpoint-unread");
  assert.equal(j.sent.length, 0, "the judge ran on what was left");
  aboutUnchanged(P);
});

test("CK 7 — A MISSING CHECKPOINT (deleted after the pause): not an empty set — the part fails honestly, nothing applied, never done", { timeout: 30000 }, async () => {
  const { o, j, P } = await faqCase("7", { between: (P) => { for (const k of [...P.objects.keys()].filter((k) => HELD.test(k))) P.objects.delete(k); } });
  assert.equal(o.status, "failed", JSON.stringify(o.rec.parts[0]));
  assert.equal(o.rec.parts[0].why, "checkpoint-unread");
  assert.equal(j.sent.length, 0);
  aboutUnchanged(P);
});

test("CK 8 — A GENUINELY EMPTY CHECKPOINT: a designer asks having written no requirement; its checkpoint is complete with count 0, the resumed job is staged exactly that, and the request finishes done — an empty set verified, not assumed", { timeout: 30000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("8"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? Q : FAQ("/about", []); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please add a questions section to the About page." });
    await settle(P, r.key);
    const held = heldOf(P);
    assert.equal(held.length, 1, "an empty pause wrote no checkpoint");
    assert.deepEqual([held[0].complete, held[0].count, held[0].requirements.length], [true, 0, 0]);
    await answer(P, r.key, "Below");
    const next = P.jobsOf(r.key).filter((x) => x.op === "addon").pop();
    const staged = P.objects.get("jobs/prepared/" + next.id + ".held-in.json");
    assert.ok(staged && JSON.parse(staged.body).count === 0, "the verified empty set was not staged as such");
    const o = await outcome(P, r.key);
    assert.equal(o.status, "done", JSON.stringify(o.rec.parts[0]));
    assert.equal(j.sent.length, 0);
    once(P);
  });
});

/** Two pauses (the correction's, then the resumed designer's with NUMBER beside it). */
async function twoPauses(slugKey, { between2 = null } = {}) {
  const j = judgeLog();
  let n = 0, out = null;
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [R(COLL), R(SEARCH)]) : n === 2 ? Q : n === 3 ? { question: { text: "Should the questions be grouped?", options: ["Grouped", "One list"] }, requirements: [R(NUMBER)] } : FAQ("/about", []); }, j.fn) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    await answer(P, r.key, "Below");
    if (between2) await between2(P, r.key);
    await answer(P, r.key, "One list");
    out = { o: await outcome(P, r.key), j, P, key: r.key };
    once(P);
  });
  return out;
}

test("CK 9 control — TWO PAUSES: the second checkpoint (three requirements) is the one the last job resumes from, by name and count", { timeout: 30000 }, async () => {
  const { o, j, P, key } = await twoPauses("9c");
  const pauses = P.record(key).parts[0].jobs.filter((x) => x.end && x.end.act === "clarify");
  assert.deepEqual(pauses.map((x) => x.end.held), [2, 3]);
  assertJudged(j.sent, [COLL, SEARCH, NUMBER]);
  assertBoth(o, [COLL, SEARCH, NUMBER]);
});

test("CK 7c — A24-2 (2026-10-23): THE PAUSED JOB'S CHECKPOINT MISSING AND ITS FALLBACK READ REFUSED BY THE CONTAINER'S WALL (403, as the job gateway answers another job's `jobs/` key): the part fails at once as the Worker's read would — never recovering for a day on a refusal no retry can change", { timeout: 30000 }, async () => {
  let refused = 0;
  const refusal = () => { refused++; return Object.assign(new Error("gateway refused the key"), { name: "GatewayError", status: 403, code: "forbidden" }); };
  let sawIn = false;
  // THE WORKER STAGES FIRST (and finds nothing to stage); only the job's own
  // reads, after its staged copy, meet the wall.
  const fromJob = (k) => { if (HELD_IN.test(k)) sawIn = true; return sawIn && HELD.test(k); };
  const { o, j, P } = await faqCase("7c", {
    between: (P) => { for (const k of [...P.objects.keys()].filter((k) => HELD.test(k))) P.objects.delete(k); },
    faults: (P, at) => { if (at === "resume") for (let i = 0; i < 20; i++) P.failGet(fromJob, refusal); },
  });
  assert.ok(sawIn && refused > 0, "the job never met the wall — the case tests nothing");
  assert.equal(o.status, "failed", JSON.stringify(o.rec.parts[0]));
  assert.equal(o.rec.parts[0].why, "checkpoint-refused");
  assert.equal(j.sent.length, 0);
  aboutUnchanged(P);
});

test("CK 9 — THE LATEST CHECKPOINT UNREADABLE, AN OLDER ONE READABLE: the older, smaller scope is never used in its place — the part fails, saying the checkpoint could not be read, with nothing applied", { timeout: 30000 }, async () => {
  const { o, j, P } = await twoPauses("9", {
    between2: (P, key) => {
      const pauses = P.record(key).parts[0].jobs.filter((x) => x.end && x.end.act === "clarify");
      const latest = "jobs/prepared/" + pauses[pauses.length - 1].id + ".held.json";
      const ob = P.objects.get(latest);
      P.objects.set(latest, { ...ob, body: "{not json", etag: ob.etag + "x" });
      assert.ok(P.objects.get("jobs/prepared/" + pauses[0].id + ".held.json"), "the older checkpoint should still be there");
    },
  });
  assert.equal(o.status, "failed", JSON.stringify(o.rec.parts[0]));
  assert.equal(o.rec.parts[0].why, "checkpoint-unread");
  assert.equal(j.sent.length, 0, "the judge ran on the older scope");
  aboutUnchanged(P);
});

test("CK 10 — DUPLICATE DELIVERY OVER A CHECKPOINT THAT FIRST CANNOT BE WRITTEN: every queued message delivered twice at once, then all again — both requirements told, nothing charged twice, one question", { timeout: 30000 }, async () => {
  const j = judgeLog();
  const c = { n: 0 };
  await withPlatform({ slug: slugOf("10"), pages: PAGES, replies: true, balance: 400, answers: answers(repro(FAQ("/about", []), c), j.fn) }, async (P) => {
    for (let i = 0; i < 3; i++) P.failPut((k) => HELD.test(k));
    const twice = async () => {
      for (let round = 0; round < 16 && P.queue.length; round++) {
        const msgs = P.queue.splice(0);
        await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
      }
    };
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await twice();
    await settle(P, r.key);
    const q = P.question();
    assert.ok(q, "no question");
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    await twice();
    await settle(P, r.key);
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    const o = await outcome(P, r.key);
    assertJudged(j.sent, [COLL, SEARCH]);
    assertBoth(o, [COLL, SEARCH]);
  });
});

// ── REPRODUCTION 2: RETENTION ACROSS THE OLD 60 BOUNDARY ────────────────────

const OPT = (i) => "option " + String(i).padStart(2, "0");
const NEED = (i) => "The answers offer " + OPT(i);
/** `rounds` questions, twelve distinct requirements beside each; the final designer lists none. */
async function manyRounds(slugKey, rounds) {
  const total = rounds * 12;
  const opts = Array.from({ length: total }, (_, i) => OPT(i + 1));
  const message = "Please add a questions section to the About page whose answers offer " + opts.join(", ") + ".";
  const sent = [];
  const judge = (args) => {
    const text = textOf(args);
    const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
    const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    sent.push(lines);
    return { verdicts: lines.map((e) => ({ id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
  };
  let n = 0, out = null;
  const designer = async () => {
    n++;
    if (n <= rounds) return { question: { text: "Question " + n + "?", options: ["Yes", "No"] }, requirements: Array.from({ length: 12 }, (_, k) => { const i = (n - 1) * 12 + k + 1; return { need: NEED(i), basis: "asked", words: OPT(i), status: "covered", by: "the questions section", item: "/about", kind: "page" }; }) };
    return FAQ("/about", []);
  };
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 400, answers: answers(designer, judge, { [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: message.slice(7), uses: [] }] } }) }, async (P) => {
    const r = await sendMessage(P, { message });
    await settle(P, r.key);
    for (let q = 0; q < rounds; q++) await answer(P, r.key, "Yes");
    const o = await outcome(P, r.key);
    out = { o, sent, P, key: r.key, needs: Array.from({ length: total }, (_, i) => NEED(i + 1)), n };
    once(P);
  });
  return out;
}
/** What the customer's request did with them: judged, stored and given to the reply writer. */
function assertAll(res) {
  const { o, sent, needs } = res;
  const judged = sent.flat();
  const ids = judged.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "a requirement was judged twice or two shared an id");
  const seen = new Set(judged.map((e) => e.need));
  const missing = needs.filter((x) => !seen.has(x));
  assert.deepEqual(missing, [], missing.length + " never reached the judge: " + missing.slice(0, 6).join(" | ") + (missing.length > 6 ? " …" : ""));
  assert.equal(o.status, "partial", why(o.rec));
  for (const x of needs) assert.ok(o.told.includes(x), "the stored answer does not tell: " + x);
  for (const x of needs) assert.ok(o.replyText.includes(x), "the reply writer was not given: " + x);
}
/** …and how it was kept: every checkpoint holds everything so far, the judgment ran in bounded batches, and the part reports every one unfinished. */
function assertKept(res) {
  const { o, sent, P, key, needs } = res;
  assert.ok(sent.every((b) => b.length <= 24), "a judgment call was given more than one batch: " + sent.map((b) => b.length));
  const pauses = P.record(key).parts[0].jobs.filter((x) => x.end && x.end.act === "clarify");
  assert.deepEqual(pauses.map((x) => x.end.held), Array.from({ length: needs.length / 12 }, (_, i) => (i + 1) * 12), "a checkpoint did not keep everything accepted so far");
  assert.deepEqual(o.notDone, [...needs].sort(), "the part does not report every requirement unfinished (" + o.notDone.length + " of " + needs.length + ")");
}

test("CK 11 control — FIVE QUESTIONS, TWELVE EACH: all 60 judged, stored and given to the reply writer", { timeout: 60000 }, async () => {
  assertAll(await manyRounds("11c", 5));
});

test("CK 11 — CODEX'S REPRODUCTION 2: SIX QUESTIONS, TWELVE EACH: all 72 — the first twelve included — judged, stored and given to the reply writer", { timeout: 60000 }, async () => {
  assertAll(await manyRounds("11", 6));
});

test("CK 11r — HOW SIX QUESTIONS' REQUIREMENTS ARE KEPT: each checkpoint holds every one so far (12 … 72), the judgment runs in bounded batches, and the part reports all 72 unfinished", { timeout: 60000 }, async () => {
  assertKept(await manyRounds("11r", 6));
});

test("CK 12 — A CHECKPOINT WRITE THAT ANSWERS AS IF IT LANDED AND NEVER DID is caught by its read-back and written again before the question is acknowledged; both requirements resume and are told", { timeout: 30000 }, async () => {
  const { o, j, held } = await faqCase("12", { faults: (P, at) => { if (at === "pause") P.dropPut((k) => HELD.test(k)); } });
  assert.equal(held.length, 1, "the checkpoint was never really written");
  assertJudged(j.sent, [COLL, SEARCH]);
  assertBoth(o, [COLL, SEARCH]);
});

test("CK 13 — READING A CHECKPOINT: a complete one with its count is held (an empty one included); a count that does not match, a list that cannot be read, or a record from before checkpoints said they were complete where a count is expected, is malformed — never fewer requirements", () => {
  const two = heldCheckpoint([{ need: "a", status: "covered", id: "component#0" }, { need: "b", status: "elsewhere", id: "component#1", step: "page" }], "component");
  assert.deepEqual([two.complete, two.count], [true, 2]);
  assert.equal(readHeld(two).state, "held");
  assert.equal(readHeld(two, 2).state, "held");
  assert.equal(readHeld(two, 3).state, "malformed", "a checkpoint holding another number than expected was accepted");
  const empty = heldCheckpoint([], "component");
  assert.deepEqual([readHeld(empty).state, readHeld(empty, 0).state, readHeld(empty, 0).list.length], ["held", "held", 0], "a verified empty checkpoint is not an empty set");
  assert.equal(readHeld({ ...two, count: 3 }).state, "malformed", "a count that does not match what it lists was accepted");
  assert.equal(readHeld({ ...two, requirements: [two.requirements[0], { status: "covered" }], count: 2 }).state, "malformed", "an entry that cannot be read was dropped silently");
  assert.equal(readHeld({ requirements: two.requirements }).state, "legacy");
  assert.equal(readHeld({ requirements: two.requirements }, 2).state, "malformed", "a record that never said it was complete stood in for an expected checkpoint");
  for (const bad of [null, [], "x", {}, { requirements: "no" }]) assert.equal(readHeld(bad).state, "malformed");
  assert.equal(readHeld(two).list[0].status, "unsupported", "a held claim of coverage survived");
  const many = heldCheckpoint(Array.from({ length: 150 }, (_, i) => ({ need: "n" + i, status: "unsupported", id: "component#s" + i })));
  assert.equal(readHeld(many, 150).list.length, 150, "a large checkpoint was cut");
});
