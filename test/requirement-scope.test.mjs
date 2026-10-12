// EVERY ACCEPTED REQUIREMENT IS KEPT, HOWEVER MANY ONE STEP WRITES (2026-10-12,
// round 15, after Codex's pass on 703faade).
//
// Codex's reproduction, through the checkpoint fixture: one component designer
// asks a question while recording 13 distinct requirements, every one of them
// in the customer's own message; the customer answers; the resumed designer
// returns a valid design repeating none. The 12-requirement control passed;
// the 13th disappeared — the checkpoint held 12, the judge saw 12,
// `requirementsTold` had 12 and the reply facts left the 13th out.
//
// The cause was one step's ceiling of twelve (`MAX_REQUIREMENTS`), applied at
// intake: past it an entry was set aside as `over-cap`, never judged, and told
// only as "not checked" in the job that read it. A question ended that job, so
// the set-aside entry was neither held nor told, and was simply gone. Now
// nothing accepted is set aside at intake: the step keeps all it wrote, the
// checkpoint holds all of it, and the judgment processes it in bounded
// batches.
//
// Every case reads the judge's real input, the durable records, the final
// status and the reply writer's facts, for every kind of question that holds
// requirements: a designer's, a correction's, the picker's, the judge's and
// the page writer's.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, pump, tick, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "rs-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why, (p.notDone || []).length]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const ABOUT_CARDS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
const FAQ = (page, requirements = []) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }], requirements });

const OPT = (i) => "option " + String(i).padStart(2, "0");
const NEED = (i) => "The answers offer " + OPT(i);
/** Requirements `from`…`to`, each quoting its own words from the message. */
const reqs = (from, to) => Array.from({ length: to - from + 1 }, (_, k) => { const i = from + k; return { need: NEED(i), basis: "asked", words: OPT(i), status: "covered", by: "the questions section", item: "/about", kind: "page" }; });
const msgFor = (n) => "Please add a questions section to the About page whose answers offer " + Array.from({ length: n }, (_, i) => OPT(i + 1)).join(", ") + ".";
const textOf = (args) => (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");

/**
 * A judge as a model would answer: static cards carry nothing (`carried: no`),
 * unless `pass(need)` says this one is carried by the first thing listed; one
 * the customer's own answer cancelled (`cancelled(text, need)`) is unrelated.
 * `askFirst`: its first call asks the customer instead.
 */
function judgeLog({ pass = () => false, cancelled = () => false, askFirst = false } = {}) {
  const sent = [];
  let calls = 0;
  const fn = (args) => {
    calls++;
    const text = textOf(args);
    const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
    const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    sent.push(lines);
    if (askFirst && calls === 1) return { verdicts: [], question: { text: "Do you mean every option on one page?", options: ["Yes", "No"] } };
    const item = (/^- ([a-z]+:[^ ]+) — /m.exec(text) || [])[1] || null;
    return { verdicts: lines.map((e) => (cancelled(text, e.need)
      ? { id: e.id, follows: "unrelated", carried: "no", reason: "their answer says they no longer want it" }
      : pass(e.need) && item
        ? { id: e.id, follows: "asked", carried: "yes", by: [item], reason: "the questions section does it" }
        : { id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
  };
  return { sent, fn, calls: () => calls };
}

const Q = (k) => ({ question: { text: "Question " + k + "?", options: ["Yes", "No"] } });

/**
 * ONE ADDITION, `n` REQUIREMENTS, PAUSED BY `asker`:
 *   designer    the designer writes them beside its question (`rounds` times, `n` each);
 *   correction  the designer's first answer is refused with them, and its correction asks;
 *   picker      the designer's design carries them, the judge asks, and the answer reaches
 *               the picker, which asks before any designer runs again (the resumed one lists none);
 *   judge       the designer's design carries them, and the judge asks;
 *   pages       the designer's design carries them, and the page writer asks.
 * The resumed designer, where there is one, designs repeating none of them —
 * or, for a designer's question, exactly `resumed`.
 */
async function scope(slugKey, { n, asker = "designer", rounds = 1, judge = judgeLog(), reply = () => "Yes", between = null, deliverAll = null, resumed = [] } = {}) {
  const total = asker === "designer" ? n * rounds : n;
  const message = msgFor(total);
  let d = 0, picks = 0, writes = 0, out = null;
  const designer = async () => {
    d++;
    if (asker === "designer") return d <= rounds ? { ...Q(d), requirements: reqs((d - 1) * n + 1, d * n) } : FAQ("/about", resumed);
    if (asker === "correction") return d === 1 ? FAQ("/does-not-exist", reqs(1, n)) : d === 2 ? Q(1) : FAQ("/about", []);
    if (asker === "picker") return d === 1 ? FAQ("/about", reqs(1, n)) : FAQ("/about", []);
    return FAQ("/about", reqs(1, n));
  };
  let pickerAsked = false;
  const picker = async (args) => {
    picks++;
    // THE PICKER ASKS ONCE IT IS SHOWN THE CUSTOMER'S FIRST ANSWER (its first call after the resume).
    if (asker === "picker" && !pickerAsked && /WHAT THEY ALREADY TOLD YOU/.test(textOf(args))) { pickerAsked = true; return { kinds: [], ...Q(2) }; }
    return { kinds: ["component"], scopes: [{ kind: "component", words: message.slice(7), uses: [] }] };
  };
  const pages = async () => {
    writes++;
    if (asker === "pages" && writes === 1) return Q(1);
    return { pages: [{ path: "src/routes/about.tsx", source: ABOUT_CARDS }] };
  };
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 900, answers: {
    route: { intent: "addon" }, [T.adds]: picker, "add:component": designer, [T.pages]: pages, judge_requirements: judge.fn,
  } }, async (P) => {
    const run = deliverAll ? (key) => deliverAll(P, key) : (key) => settle(P, key);
    const r = await sendMessage(P, { message });
    await run(r.key);
    let asked = 0;
    for (let k = 0; k < 8; k++) {
      const q = P.question();
      if (!q || P.record(r.key).ended) break;
      asked++;
      if (between) await between(P, r.key, asked);
      await sendMessage(P, { message: reply(asked), ask: { id: q.id, chosen: true } });
      await run(r.key);
    }
    await pump(P);
    const rec = P.record(r.key);
    const job = P.jobsOf(r.key).filter((j) => j.op === "addon").pop();
    const ans = job ? P.answerOf(job) : null;
    const held = [...P.objects.entries()].filter(([k]) => /^jobs\/prepared\/[^/]+\.held\.json$/.test(k)).map(([, o]) => JSON.parse(o.body));
    out = {
      P, key: r.key, rec, asked, d, judge,
      status: rec.parts[0].status,
      notDone: (rec.parts[0].notDone || []).map((x) => x.what),
      told: ((ans && ans.requirementsTold) || []).map((t) => [t.need, t.told || t.state]),
      reply: P.replyLog.map((facts) => facts.map((f) => f.text).join(" ")).join("\n"),
      replyFacts: P.replyLog.flat(),
      pauses: rec.parts[0].jobs.filter((x) => x.end && x.end.act === "clarify").map((x) => x.end.held),
      held: held.map((h) => h.count).sort((a, b) => a - b),
      heldBy: held.map((h) => [h.asked, h.count]),
      needs: Array.from({ length: total }, (_, i) => NEED(i + 1)),
    };
    once(P);
  });
  return out;
}

/** Every requirement reached the judge (each judged once in its last judgment), is stored, unfinished, and given to the reply writer. */
function assertAll(o, { unfinished = o.needs } = {}) {
  const judged = new Set(o.judge.sent.flat().map((e) => e.need));
  const missing = o.needs.filter((x) => !judged.has(x));
  assert.deepEqual(missing, [], missing.length + " never reached the judge: " + missing.join(" | "));
  assert.ok(o.judge.sent.every((b) => b.length <= 24), "a judgment call was given more than one batch: " + o.judge.sent.map((b) => b.length));
  const told = new Set(o.told.map(([need]) => need));
  assert.deepEqual(o.needs.filter((x) => !told.has(x)), [], "the stored answer does not tell every one");
  assert.deepEqual([...o.notDone].sort(), [...unfinished].sort(), why(o.rec));
  for (const x of unfinished) assert.ok(o.reply.includes(x), "the reply writer was not given: " + x);
}

// ── CODEX'S REPRODUCTION, AND THE BOUNDARY ──────────────────────────────────

test("RS 1 control — ELEVEN BESIDE THE DESIGNER'S QUESTION (below the old ceiling): all eleven held, judged, stored, unfinished and told", { timeout: 60000 }, async () => {
  const o = await scope("1", { n: 11 });
  assert.deepEqual(o.pauses, [11]);
  assertAll(o);
  assert.equal(o.status, "partial");
});

test("RS 2 control — TWELVE (at the old ceiling): all twelve held and told", { timeout: 60000 }, async () => {
  const o = await scope("2", { n: 12 });
  assert.deepEqual(o.pauses, [12]);
  assertAll(o);
});

test("RS 3 — CODEX'S REPRODUCTION: THIRTEEN beside the designer's question, the resumed designer repeating none — the checkpoint holds 13, the judge sees 13, the stored answer tells 13, and the reply facts carry the 13th", { timeout: 60000 }, async () => {
  const o = await scope("3", { n: 13 });
  assert.deepEqual(o.held, [13], "the checkpoint does not hold every one");
  assert.deepEqual(o.pauses, [13]);
  assertAll(o);
  assert.ok(o.reply.includes(NEED(13)), "the reply facts omit the 13th");
  assert.equal(o.status, "partial");
  assert.equal(o.d, 2, "the designer was asked again beyond its question and its resume: " + o.d);
});

test("RS 4 — FORTY beside one question, well past one judgment batch: every one held, judged in batches of at most 24, stored and told", { timeout: 60000 }, async () => {
  const o = await scope("4", { n: 40 });
  assert.deepEqual(o.pauses, [40]);
  assertAll(o);
  assert.ok(o.judge.sent.length >= 2, "forty were not judged in more than one batch");
});

// ── EVERY KIND OF QUESTION THAT HOLDS REQUIREMENTS ──────────────────────────

test("RS 5 — A CORRECTION'S QUESTION over a refused design with thirteen: all thirteen held, judged and told", { timeout: 60000 }, async () => {
  const o = await scope("5", { n: 13, asker: "correction" });
  assert.deepEqual(o.pauses, [13]);
  assert.equal(o.d, 3, "a designer call was made again: " + o.d);
  assertAll(o);
});

test("RS 6 — THE PICKER'S QUESTION: a design with thirteen, the judge asks, and its answer reaches the picker, which asks before any designer runs — the picker's pause holds the thirteen it was handed; after both answers all are judged and told", { timeout: 60000 }, async () => {
  const o = await scope("6", { n: 13, asker: "picker", judge: judgeLog({ askFirst: true }) });
  assert.equal(o.asked, 2, "the picker did not ask");
  assert.deepEqual(o.pauses, [13, 13]);
  assert.ok(o.heldBy.some(([asked, count]) => asked === "pick" && count === 13), "the picker's pause did not hold the thirteen: " + JSON.stringify(o.heldBy));
  assertAll(o);
});

test("RS 7 — THE JUDGE'S QUESTION over a design with thirteen: the judge's pause holds all thirteen; after the answer all are judged and told", { timeout: 60000 }, async () => {
  const o = await scope("7", { n: 13, asker: "judge", judge: judgeLog({ askFirst: true }) });
  assert.equal(o.asked, 1);
  assert.deepEqual(o.pauses, [13]);
  assert.equal(o.judge.sent[0].length, 13, "the judge was asked about fewer than all of them");
  assertAll(o);
});

test("RS 8 — THE PAGE WRITER'S QUESTION over a design with thirteen: all thirteen held, judged and told", { timeout: 60000 }, async () => {
  const o = await scope("8", { n: 13, asker: "pages" });
  assert.equal(o.asked, 1);
  assert.deepEqual(o.pauses, [13]);
  assertAll(o);
});

// ── REPEATS, RESTARTS, CANCELLATION, DUPLICATES ─────────────────────────────

test("RS 9 — REPEATED QUESTIONS: thirteen beside each of three questions — every checkpoint holds all so far (13, 26, 39), and all 39 are judged and told", { timeout: 60000 }, async () => {
  const o = await scope("9", { n: 13, rounds: 3 });
  assert.deepEqual(o.pauses, [13, 26, 39]);
  assert.equal(o.d, 4, "a designer call was made again: " + o.d);
  assertAll(o);
});

test("RS 10 — A RESTART AT EVERY STEP: after each message one queued delivery runs, every other message in flight is lost, the clock moves on and the sweep fires; the request still finishes with all thirteen judged and told", { timeout: 60000 }, async () => {
  const o = await scope("10", {
    n: 13,
    deliverAll: async (P, key) => {
      const m = P.queue.shift();
      if (m) await deliver(P, m);
      P.queue.length = 0;
      P.advance(5 * 60000);
      await tick(P);
      return settle(P, key);
    },
  });
  assertAll(o);
});

test("RS 11 — THE CUSTOMER CANCELS ONE IN THEIR ANSWER: \"Yes — and no option 13 after all\": the held 13th still reaches the judge, shown the answer, which sets it aside; the other twelve are told unfinished; the 13th is not", { timeout: 60000 }, async () => {
  const judge = judgeLog({ cancelled: (text, need) => need === NEED(13) && /no option 13 after all/.test(text) });
  const o = await scope("11", { n: 13, judge, reply: () => "Yes — and no option 13 after all" });
  const last = judge.sent[judge.sent.length - 1];
  assert.ok(last.some((e) => e.need === NEED(13)), "the cancelled requirement never reached the judge: the cancellation was decided without it");
  assert.deepEqual([...o.notDone].sort(), o.needs.slice(0, 12).sort(), why(o.rec));
  assert.equal(o.status, "partial");
});

test("RS 12 — DUPLICATE DELIVERY: every queued message delivered twice at once, thirteen beside the question — all thirteen held, judged and told, nothing charged twice", { timeout: 60000 }, async () => {
  const o = await scope("12", {
    n: 13,
    deliverAll: async (P, key) => {
      for (let round = 0; round < 16 && P.queue.length; round++) {
        const msgs = P.queue.splice(0);
        await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
      }
      return settle(P, key);
    },
  });
  assertAll(o);
});

// ── NEVER DONE WITH ONE LEFT OVER ───────────────────────────────────────────

test("RS 13 — EVERY RETAINED REQUIREMENT IS MET, THE OMITTED 13TH IS NOT: the resumed designer restates the first twelve as covered and leaves the 13th out; the judge finds the twelve carried by what was built — the request is partial with the 13th unfinished, never done", { timeout: 60000 }, async () => {
  const judge = judgeLog({ pass: (need) => need !== NEED(13) });
  const o = await scope("13", { n: 13, judge, resumed: reqs(1, 12) });
  assert.notEqual(o.status, "done", "the request finished done with a requirement unmet");
  assert.notEqual(o.rec.state, "done");
  assert.deepEqual(o.notDone, [NEED(13)], why(o.rec));
  assert.ok(o.reply.includes(NEED(13)), "the reply writer was not told the 13th is unfinished");
});

test("RS 13 control — ALL THIRTEEN RESTATED AND MET: done, nothing unfinished", { timeout: 60000 }, async () => {
  const o = await scope("13c", { n: 13, judge: judgeLog({ pass: () => true }), resumed: reqs(1, 13) });
  assert.equal(o.status, "done", why(o.rec));
  assert.deepEqual(o.notDone, []);
});
