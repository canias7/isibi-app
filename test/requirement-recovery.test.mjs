// A CHECKPOINT THAT CANNOT BE READ JUST NOW IS RECOVERED BY THE SERVER, AND AN
// OVERSIZED ONE IS KEPT WHOLE (2026-10-12, round 14, after Codex's pass on
// 29fc95af).
//
// Round 13 made the requirements checkpoint required state, but a part whose
// checkpoint could not be read ran again only twice and then failed, leaving
// the customer to send the request again. Now a checkpoint that cannot be
// saved or read yet leaves the part `recovering` on its request — nothing
// applied or charged, its checkpoint and kept answers kept — and the server's
// own driver runs it again with a growing wait, through a restart, for up to
// a day. Only a checkpoint known lost (missing with no copy, or malformed)
// fails at once.
//
// And a checkpoint the store will not take, too large to ride whole in the
// job's answer (`HELD_INLINE_MAX`), used to become a refusal that ran model
// work again: it now rides as what changed since the checkpoint the job
// resumed from, so the request part keeps every requirement however many
// came before.
//
// Every case reads the judge's real input, the durable records, the final
// status, the stored outcomes and the reply writer's facts.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, pump, tick, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { heldRecoverDelay, HELD_RECOVER_MAX_MS, WAIT_MS } from "../builder/request.mjs";
import { heldCheckpoint, heldDelta, readHeld } from "../builder/site-requirements.mjs";

blockNetwork();

const slugOf = (k) => "rc-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.notDone]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

const TAG = "Bread from the harbour, every morning.";
const TAG_TO = "Bread from the harbour, every single morning.";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>" + TAG + "</p></section>");
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
const R = (need, extra = {}) => ({ need, basis: "asked", words: QUOTE, status: "covered", by: "the questions section", item: "/about", kind: "page", ...extra });
const FAQ = (page, requirements = []) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }], requirements });
const Q = { question: { text: "Above or below the story?", options: ["Above", "Below"] } };
const HELD = /^jobs\/prepared\/[^/]+\.held\.json$/;
const HELD_IN = /^jobs\/prepared\/[^/]+\.held-in\.json$/;

const textOf = (args) => (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
/** A judge that answers as a model would (static cards carry neither), and keeps what it was sent. */
function judgeLog() {
  const sent = [];
  const fn = (args) => {
    const text = textOf(args);
    const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
    const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    sent.push(lines);
    return { verdicts: lines.map((e) => ({ id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
  };
  return { sent, fn };
}
/** The FAQ reproduction's designer: refused (both requirements), correction asks, then `resumed` (by default one listing neither). */
function repro(counter, resumed = FAQ("/about", [])) {
  return async () => {
    counter.n++;
    if (counter.n === 1) return FAQ("/does-not-exist", [R(COLL), R(SEARCH)]);
    if (counter.n === 2) return Q;
    return resumed;
  };
}
const answers = (component, judge, extra = {}) => ({
  route: { intent: "addon" },
  [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: ASK, uses: [] }] },
  "add:component": component,
  [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_CARDS }] },
  judge_requirements: judge,
  ...extra,
});
const runEnds = (P, key, n = 0) => P.record(key).parts[n].jobs.filter((x) => x.kind === "run").map((x) => (x.end ? x.end.act : null));
const reserves = (P) => P.ledger.filter((e) => e.reason === "reserve").length;
const viewOf = async (P, key) => { const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key); assert.equal(v.status, 200, JSON.stringify(v.body)); return v.body.request; };
function assertJudged(sent, needs) {
  assert.ok(sent.length >= 1, "the judge never ran");
  const seen = new Set(sent.flat().map((e) => e.need));
  for (const n of needs) assert.ok(seen.has(n), "the judge was not sent: " + n);
}
/** What the customer is told for the FAQ part: unfinished, stored and given to the reply writer. */
async function told(P, key, needs, n = 0) {
  const rec = P.record(key);
  const job = P.jobsOf(key).filter((j) => j.op === "addon").pop();
  const ans = job ? P.answerOf(job) : null;
  const stored = ((ans && ans.requirementsTold) || []).map((t) => t.need);
  const notDone = (rec.parts[n].notDone || []).map((x) => x.what);
  const reply = P.replyLog.map((facts) => facts.map((f) => f.text).join(" ")).join("\n");
  for (const x of needs) {
    assert.ok(notDone.includes(x), "not told unfinished: " + x + " — " + why(rec));
    assert.ok(stored.includes(x), "the stored answer does not tell: " + x);
    assert.ok(reply.includes(x), "the reply writer was not given: " + x);
  }
}
/** The store down for every checkpoint read while `down.on`: persistent faults, never consumed while it is up. */
function storeDown(P, down, match = (k) => HELD.test(k) || HELD_IN.test(k)) {
  for (let i = 0; i < 4000; i++) P.failGet((k) => down.on && match(k));
}
/** The clock moved on, the two-minute sweep fired, and whatever it queued delivered — `times` over. */
async function wait(P, ms, times = 1) {
  for (let i = 0; i < times; i++) { P.advance(ms); await tick(P); await pump(P); }
}

// ── 2. THE REST OF THE REQUEST WHILE ONE PART RECOVERS ──────────────────────

const W_TAG = "change the home page tagline to say every single morning";
const TAG_Q = { text: "Keep the full stop at the end?", options: ["Yes", "No"] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
/** The part's own words in a routing call ("THEIR MESSAGE"), never the whole request shown beside them. */
const ownWords = (args) => { const m = /THEIR MESSAGE\\n([^\\]*)/.exec(JSON.stringify(args.messages || [])); return m ? m[1] : ""; };

/**
 * Two parts: the FAQ addition (0) and the home tagline (1). `needs`: the
 * tagline waits for the addition. `asks`: the tagline's routing first asks
 * its own question, answered while the addition is recovering.
 */
async function twoParts(slugKey, { needs = false, asks = false, check }) {
  const j = judgeLog();
  const c = { n: 0 };
  let tagRoutes = 0;
  const route = (args, n) => {
    if (n === 0) return { intent: "addon", alsoAsked: [W_TAG], targets: [{ change: 0, writes: ["page:/about", "new-component:faq"] }, { change: 1, writes: ["page:/"] }], ...(needs ? { dependsOn: [{ change: 1, after: [0] }] } : {}) };
    // THE TAGLINE'S OWN ROUTING, or its routing again shown the answer to its question ("Yes").
    if (/tagline/.test(ownWords(args)) || /^Yes/.test(ownWords(args))) { tagRoutes++; return asks && tagRoutes === 1 ? { intent: "clarify", question: TAG_Q } : { intent: "edit", layer: "text", page: "/" }; }
    return { intent: "addon" };
  };
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 400, answers: answers(repro(c), j.fn, { route, [T.text]: (args) => ({ edits: [{ id: lineId(args, "index.tsx", TAG), to: TAG_TO }] }) }) }, async (P) => {
    const down = { on: false };
    storeDown(P, down);
    const r = await sendMessage(P, { message: "Please " + ASK + ", and " + W_TAG + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await settle(P, r.key);
    await check({ P, key: r.key, down, j, c });
  });
}
/** Answer the site's open question (the one for part `n`). */
async function answerPart(P, key, n, text) {
  const rec = P.record(key);
  const qid = rec.parts[n].question && rec.parts[n].question.id;
  const q = P.question();
  assert.ok(q && q.id === qid, "the question on the site is not part " + n + "'s: " + JSON.stringify([q && q.id, qid]));
  await sendMessage(P, { message: text, ask: { id: q.id, chosen: true } });
}

// ── 3. AN OVERSIZED CHECKPOINT THE STORE WILL NOT TAKE ──────────────────────

// Each requirement as long as one is kept (its need and its quoted words, 200
// characters each), twelve beside each of 32 questions — written when one step
// kept at most twelve; since round 15 none is set aside, and the shape is kept
// as it was — so the 384 together are well above what
// one answer may carry (`HELD_INLINE_MAX`). Every checkpoint write is refused
// by the store, and the final designer lists none of them.
const LONG = "the answers can be filtered by season, by loaf, by allergen and by the day of the week on which that loaf is baked, and each filter remembers what the visitor chose the last time they came back to the questions section of the About page, so that a regular who only ever wants to know about the rye and the spelt on Saturdays sees those answers first without choosing them again";
const OPT = (i) => "option " + String(i).padStart(3, "0");
const BIG_NEED = (i) => (OPT(i) + ": a visitor can use " + OPT(i) + " so that " + LONG).slice(0, 200);
const ROUNDS = 32, PER = 12;
async function oversized(slugKey, { rounds = ROUNDS, per = PER, faults = (P) => { for (let i = 0; i < 2000; i++) P.failPut((k) => HELD.test(k)); } } = {}) {
  const total = rounds * per;
  const message = "Please add a questions section to the About page where " + LONG + ", with " + Array.from({ length: total }, (_, i) => OPT(i + 1)).join(", ") + ".";
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
    if (n <= rounds) return { question: { text: "Question " + n + "?", options: ["Yes", "No"] }, requirements: Array.from({ length: per }, (_, k) => { const i = (n - 1) * per + k + 1; return { need: BIG_NEED(i), basis: "asked", words: LONG.slice(0, 200), status: "covered", by: "the questions section", item: "/about", kind: "page" }; }) };
    return FAQ("/about", []);
  };
  await withPlatform({ slug: slugOf(slugKey), pages: PAGES, replies: true, balance: 900, answers: answers(designer, judge, { [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: message.slice(7), uses: [] }] } }) }, async (P) => {
    faults(P);
    const r = await sendMessage(P, { message });
    await settle(P, r.key);
    for (let q = 0; q < rounds; q++) {
      const open = P.question();
      assert.ok(open, "question " + (q + 1) + " was never put to the customer: " + why(P.record(r.key)) + " " + JSON.stringify(runEnds(P, r.key)));
      await sendMessage(P, { message: "Yes", ask: { id: open.id, chosen: true } });
      await settle(P, r.key);
    }
    await pump(P);
    const rec = P.record(r.key);
    const job = P.jobsOf(r.key).filter((x) => x.op === "addon").pop();
    const ans = job ? P.answerOf(job) : null;
    out = {
      P, key: r.key, rec, n, sent,
      needs: Array.from({ length: total }, (_, i) => BIG_NEED(i + 1)),
      notDone: (rec.parts[0].notDone || []).map((x) => x.what),
      told: ((ans && ans.requirementsTold) || []).map((t) => t.need),
      reply: P.replyLog.map((facts) => facts.map((f) => f.text).join(" ")).join("\n"),
      ends: runEnds(P, r.key),
    };
    once(P);
  });
  return out;
}

test("RC 10 — THE DELTA, READ BACK: unchanged requirements are not carried again; a changed one is dropped and added; a removed one is dropped; read back over its base it is exactly the same set, and a base of another size is refused", () => {
  const base = heldCheckpoint([{ need: "a", status: "unsupported", id: "c#1" }, { need: "b", status: "unsupported", id: "c#2" }, { need: "c", status: "unsupported", id: "c#3" }]);
  const now = heldCheckpoint([{ need: "a", status: "unsupported", id: "c#1" }, { need: "b, restated", status: "unsupported", id: "c#2" }, { need: "d", status: "elsewhere", id: "p#1", step: "page" }]);
  const d = heldDelta(now, { job: "j1", count: 3, list: base.requirements });
  assert.deepEqual([d.count, d.base, d.drop, d.add.map((r) => r.id)], [3, { job: "j1", count: 3 }, ["c#2", "c#3"], ["c#2", "p#1"]]);
  const back = readHeld({ complete: true, count: d.count, requirements: [...base.requirements.filter((r) => !d.drop.includes(r.id)), ...d.add] }, 3);
  assert.equal(back.state, "held");
  assert.deepEqual(back.list.map((r) => [r.id, r.need]).sort(), now.requirements.map((r) => [r.id, r.need]).sort());
  assert.equal(heldDelta(now, { job: "j1", count: 4, list: base.requirements }), null, "a base of another size was used");
  assert.equal(heldDelta(now, null), null);
});
