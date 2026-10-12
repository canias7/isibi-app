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

// ── 1. THE CODEX CASE: AN OUTAGE BEYOND THE OLD WINDOW, THEN A RESTART ──────

test("RC 1 — STORAGE STAYS DOWN BEYOND THE OLD RETRY WINDOW, THEN RECOVERS AFTER A RESTART: the part waits `recovering` (never failed, never done, nothing applied or charged), the server tries again with a growing wait, and after the restart the same request resumes by itself — no second customer message, no designer asked again, both requirements judged, stored and told", { timeout: 120000 }, async () => {
  const j = judgeLog();
  const c = { n: 0 };
  await withPlatform({ slug: slugOf("1"), pages: PAGES, replies: true, balance: 400, answers: answers(repro(c), j.fn) }, async (P) => {
    const down = { on: false };
    storeDown(P, down);
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    const q = P.question();
    assert.ok(q, "no question");
    down.on = true;
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    await settle(P, r.key);
    // PAST THE OLD WINDOW (three jobs): still recovering, each try a job that did nothing.
    await wait(P, 60000, 12);
    let rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "recovering", why(rec));
    assert.equal(rec.ended, false);
    assert.equal(rec.state, "running");
    const tries = runEnds(P, r.key).filter((x) => x === "held-retry").length;
    assert.ok(tries > 3, "it did not go past the old window of three jobs: " + tries);
    assert.ok(tries < 12, "it tried on every tick, not after a growing wait: " + tries);
    assert.equal(rec.parts[0].recover.tries, tries);
    assert.equal(j.sent.length, 0, "the judge ran under an empty list");
    assert.ok(!P.page("about.tsx").includes("Do you deliver?"), "something was applied while it could not read its checkpoint");
    assert.equal(reserves(P), 0, "something was charged while recovering");
    assert.equal(P.replyLog.length, 0, "a reply was written as if it had ended");
    const view = await viewOf(P, r.key);
    assert.equal(view.parts[0].status, "recovering");
    assert.equal(view.parts[0].recover.tries, tries);
    // A RESTART: every message in flight is lost; the store comes back.
    P.queue.length = 0;
    down.on = false;
    await wait(P, HELD_RECOVER_MAX_MS, 2);
    await settle(P, r.key);
    rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.equal(rec.ended, true);
    assert.equal(c.n, 3, "a designer was asked again: " + c.n);
    assert.equal(runEnds(P, r.key).filter((x) => x === "clarify").length, 1, "the customer was asked again");
    assertJudged(j.sent, [COLL, SEARCH]);
    await told(P, r.key, [COLL, SEARCH]);
    once(P);
  });
});

test("RC 2 — THE WAIT GROWS AND IS BOUNDED: none before the first retry, then 30 s doubling to 30 min; a checkpoint unreadable for a whole day ends the part as failed, saying why — never done, nothing applied or charged — with its checkpoint still stored", { timeout: 240000 }, async () => {
  assert.deepEqual([1, 2, 3, 4, 7, 8, 9, 40].map(heldRecoverDelay), [0, 30000, 60000, 120000, 960000, 1800000, 1800000, 1800000]);
  const j = judgeLog();
  const c = { n: 0 };
  await withPlatform({ slug: slugOf("2"), pages: PAGES, replies: true, balance: 400, answers: answers(repro(c), j.fn) }, async (P) => {
    const down = { on: false };
    storeDown(P, down);
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    const q = P.question();
    down.on = true;
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    await settle(P, r.key);
    await wait(P, 20 * 60000, Math.ceil(WAIT_MS / (20 * 60000)) + 2);
    const rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "failed", why(rec));
    assert.equal(rec.parts[0].why, "checkpoint-unread");
    assert.equal(rec.ended, true);
    const tries = runEnds(P, r.key).filter((x) => x === "held-retry").length;
    // AT MOST ONE TRY PER FULL WAIT: the first few, then one per 30 minutes at the most.
    assert.ok(tries > 3 && tries <= Math.ceil(WAIT_MS / HELD_RECOVER_MAX_MS) + 8, "the tries over a day were not bounded by the growing wait: " + tries);
    assert.equal(j.sent.length, 0);
    assert.ok(!P.page("about.tsx").includes("Do you deliver?"));
    assert.equal(reserves(P), 0);
    assert.equal([...P.objects.keys()].filter((k) => HELD.test(k)).length, 1, "the saved checkpoint was let go");
    await pump(P);
    const reply = P.replyLog.map((facts) => facts.map((f) => f.text).join(" ")).join("\n");
    assert.match(reply, /Not done/, "the reply writer was not told the part is not done");
    void c;
  });
});

test("RC 3 — DUPLICATE DELIVERY WHILE RECOVERING: every queued message and every sweep delivered twice at once — one retry job per wait, nothing charged twice, and the part resumes once the store is back", { timeout: 120000 }, async () => {
  const j = judgeLog();
  const c = { n: 0 };
  await withPlatform({ slug: slugOf("3"), pages: PAGES, replies: true, balance: 400, answers: answers(repro(c), j.fn) }, async (P) => {
    const down = { on: false };
    storeDown(P, down);
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    const q = P.question();
    down.on = true;
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    const twice = async () => {
      for (let round = 0; round < 16 && P.queue.length; round++) {
        const msgs = P.queue.splice(0);
        await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
      }
    };
    await twice();
    for (let i = 0; i < 6; i++) { P.advance(60000); await Promise.all([tick(P), tick(P)]); await twice(); }
    const rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "recovering", why(rec));
    const keys = rec.parts[0].jobs.map((x) => x.key);
    assert.equal(new Set(keys).size, keys.length, "one try was filed twice");
    assert.equal(rec.parts[0].recover.tries, runEnds(P, r.key).filter((x) => x === "held-retry").length);
    down.on = false;
    P.advance(HELD_RECOVER_MAX_MS);
    await Promise.all([tick(P), tick(P)]);
    await twice();
    await settle(P, r.key);
    assert.equal(P.record(r.key).parts[0].status, "partial", why(P.record(r.key)));
    assert.equal(c.n, 3);
    assertJudged(j.sent, [COLL, SEARCH]);
    await told(P, r.key, [COLL, SEARCH]);
    once(P);
  });
});

test("RC 4 — A STOP WHILE RECOVERING: the part is stopped, the request ends stopped, no further try is filed by any sweep, and nothing was applied or charged", { timeout: 60000 }, async () => {
  const j = judgeLog();
  const c = { n: 0 };
  await withPlatform({ slug: slugOf("4"), pages: PAGES, replies: true, balance: 400, answers: answers(repro(c), j.fn) }, async (P) => {
    const down = { on: false };
    storeDown(P, down);
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    await settle(P, r.key);
    const q = P.question();
    down.on = true;
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    await settle(P, r.key);
    await wait(P, 60000, 3);
    assert.equal(P.record(r.key).parts[0].status, "recovering");
    const stop = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + r.key);
    assert.ok(stop.status < 300, JSON.stringify(stop.body));
    await settle(P, r.key);
    const jobs = P.record(r.key).parts[0].jobs.length;
    down.on = false;
    await wait(P, HELD_RECOVER_MAX_MS, 3);
    const rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "cancelled", why(rec));
    assert.equal(rec.ended, true);
    assert.equal(rec.state, "stopped");
    assert.equal(rec.parts[0].jobs.length, jobs, "a try was filed after the stop");
    assert.equal(j.sent.length, 0);
    assert.ok(!P.page("about.tsx").includes("Do you deliver?"));
    assert.equal(reserves(P), 0);
  });
});

test("RC 5 — A GENUINELY EMPTY CHECKPOINT UNREADABLE FOR A WHILE: recovering, never mistaken for missing; once the store is back, it resumes with its verified empty set and the request is done", { timeout: 60000 }, async () => {
  const j = judgeLog();
  let n = 0;
  await withPlatform({ slug: slugOf("5"), pages: PAGES, replies: true, balance: 400, answers: answers(async () => { n++; return n === 1 ? Q : FAQ("/about", []); }, j.fn) }, async (P) => {
    const down = { on: false };
    storeDown(P, down);
    const r = await sendMessage(P, { message: "Please add a questions section to the About page." });
    await settle(P, r.key);
    const q = P.question();
    down.on = true;
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    await settle(P, r.key);
    await wait(P, 60000, 6);
    assert.equal(P.record(r.key).parts[0].status, "recovering", why(P.record(r.key)));
    down.on = false;
    await wait(P, HELD_RECOVER_MAX_MS, 2);
    await settle(P, r.key);
    const rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    const last = P.jobsOf(r.key).filter((x) => x.op === "addon").pop();
    const staged = P.objects.get("jobs/prepared/" + last.id + ".held-in.json");
    assert.ok(staged && JSON.parse(staged.body).count === 0, "the verified empty set was not staged as such");
    assert.equal(n, 2, "a designer was asked again");
    assert.equal(j.sent.length, 0);
    once(P);
  });
});

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

test("RC 6 — AN INDEPENDENT SIBLING FINISHES WHILE THE ADDITION RECOVERS: the tagline's own question is answered after the addition starts recovering; the tagline is applied and done while the addition still waits, and the addition then resumes by itself — the request partial, both requirements told, each charge once", { timeout: 120000 }, async () => {
  await twoParts("6", {
    asks: true,
    check: async ({ P, key, down, j, c }) => {
      let rec = P.record(key);
      assert.deepEqual(rec.parts.map((p) => p.status), ["waiting", "waiting"], why(rec));
      down.on = true;
      await answerPart(P, key, 0, "Below");
      await settle(P, key);
      assert.equal(P.record(key).parts[0].status, "recovering", why(P.record(key)));
      await answerPart(P, key, 1, "Yes");
      await settle(P, key);
      rec = P.record(key);
      assert.equal(rec.parts[1].status, "done", why(rec));
      assert.equal(rec.parts[0].status, "recovering", "the addition stopped recovering while the store was down: " + why(rec));
      assert.ok(P.page("index.tsx").includes(TAG_TO), "the independent tagline was not applied");
      assert.ok(!P.page("about.tsx").includes("Do you deliver?"));
      assert.equal(rec.ended, false);
      down.on = false;
      await wait(P, HELD_RECOVER_MAX_MS, 2);
      await settle(P, key);
      rec = P.record(key);
      assert.deepEqual(rec.parts.map((p) => p.status), ["partial", "done"], why(rec));
      assert.equal(rec.state, "partial");
      assert.ok(P.page("index.tsx").includes(TAG_TO));
      assert.equal(c.n, 3);
      assertJudged(j.sent, [COLL, SEARCH]);
      await told(P, key, [COLL, SEARCH]);
      once(P);
    },
  });
});

test("RC 7 — A PART THAT NEEDS THE RECOVERING ONE WAITS: it is not run, not failed, while the addition recovers; once the addition resumes and finishes in part, it is not run, saying which part it needed — never applied on top of an addition that never happened", { timeout: 120000 }, async () => {
  await twoParts("7", {
    needs: true,
    check: async ({ P, key, down }) => {
      let rec = P.record(key);
      assert.deepEqual(rec.parts.map((p) => p.status), ["waiting", "blocked"], why(rec));
      down.on = true;
      await answerPart(P, key, 0, "Below");
      await settle(P, key);
      await wait(P, 60000, 4);
      rec = P.record(key);
      assert.deepEqual(rec.parts.map((p) => p.status), ["recovering", "blocked"], why(rec));
      assert.ok(!P.page("index.tsx").includes(TAG_TO), "the dependent part ran while what it needs was recovering");
      down.on = false;
      await wait(P, HELD_RECOVER_MAX_MS, 2);
      await settle(P, key);
      rec = P.record(key);
      assert.equal(rec.parts[0].status, "partial", why(rec));
      assert.equal(rec.parts[1].status, "not-run", why(rec));
      assert.equal(rec.parts[1].why, "needs:0");
      once(P);
    },
  });
});

// ── 3. AN OVERSIZED CHECKPOINT THE STORE WILL NOT TAKE ──────────────────────

// Each requirement as long as one is kept (its need and its quoted words, 200
// characters each), twelve beside each of 32 questions — one step keeps at
// most twelve (`MAX_REQUIREMENTS`) — so the 384 together are well above what
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

test("RC 8 — AN OVERSIZED CHECKPOINT THE STORE REFUSES, AND A RESUMED DESIGNER THAT LISTS NONE: 32 questions × 12 long requirements (well above what one answer may carry), every checkpoint write refused — each pause is acknowledged, no designer asked again, and all 384 reach the judge, the stored answer, the part's unfinished list and the reply writer", { timeout: 300000 }, async () => {
  const o = await oversized("8");
  const full = JSON.stringify(heldCheckpoint(o.needs.map((need, i) => ({ need, words: LONG.slice(0, 200), basis: "asked", status: "unsupported", id: "component#" + i, from: "component" })))).length;
  assert.ok(full > 190000, "the case is not above what one answer may carry: " + full);
  assert.deepEqual(o.ends.filter((x) => x !== "clarify" && x !== "success"), [], "a pause was not acknowledged as asked: " + JSON.stringify(o.ends));
  assert.equal(o.n, ROUNDS + 1, "a designer was asked again: " + o.n);
  assert.equal([...o.P.objects.keys()].filter((k) => HELD.test(k)).length, 0, "the store took a write it was set to refuse");
  // EACH REQUIREMENT BY ITS OWN NAME ("option 001" …), wherever it is told.
  const names = (list) => new Set(list.map((x) => (/option \d{3}/.exec(x) || [""])[0]).filter(Boolean));
  const all = [...names(o.needs)];
  assert.equal(all.length, ROUNDS * PER);
  const judged = names(o.sent.flat().map((e) => e.need));
  const missing = all.filter((x) => !judged.has(x));
  assert.deepEqual(missing, [], missing.length + " never reached the judge: " + missing.slice(0, 4).join(", "));
  assert.ok(o.sent.every((b) => b.length <= 24));
  assert.equal(o.rec.parts[0].status, "partial", why(o.rec));
  assert.equal(o.notDone.length, all.length, "the part does not report every requirement unfinished (" + o.notDone.length + ")");
  assert.deepEqual([...names(o.notDone)].sort(), all.sort());
  const told = names(o.told);
  assert.deepEqual(all.filter((x) => !told.has(x)), [], "the stored answer does not tell every one");
  const replied = new Set((o.reply.match(/option \d{3}/g) || []));
  assert.deepEqual(all.filter((x) => !replied.has(x)), [], "the reply writer was not given every one");
  // THE FINISHED ANSWER ITSELF WAS TOO LARGE FOR ITS ROW: kept whole beside the job, never cut.
  const last = o.P.jobsOf(o.key).filter((x) => x.op === "addon").pop();
  const stub = JSON.parse(last.result.body);
  assert.ok(stub.spilled && stub.spilled.bytes > 200000, "the finished answer was not kept beside its job: " + last.result.body.slice(0, 120));
  assert.equal(String(o.P.objects.get(stub.spilled.key).body).length, stub.spilled.bytes);
});

test("RC 11 — THE WHOLE ANSWER UNREADABLE FOR A WHILE: the request does not settle the job as done with nothing recorded — it waits, reads it once the store answers, and tells all 384", { timeout: 300000 }, async () => {
  const o = await oversized("11", { faults: (P) => { for (let i = 0; i < 2000; i++) P.failPut((k) => HELD.test(k)); P.failGetFrom((k) => /^jobs\/answers\//.test(k), { skip: 1, count: 24 }); } });
  assert.deepEqual(o.ends.filter((x) => x !== "clarify" && x !== "success"), [], JSON.stringify(o.ends));
  assert.equal(o.rec.parts[0].status, "partial", why(o.rec));
  assert.equal(o.notDone.length, ROUNDS * PER);
});

test("RC 12 — THE WHOLE ANSWER NEVER KEPT (every write of it refused): the part is told its outcome was not recorded — partial, never done — and nothing claims the 384 were met", { timeout: 300000 }, async () => {
  const o = await oversized("12", { faults: (P) => { for (let i = 0; i < 2000; i++) P.failPut((k) => HELD.test(k)); for (let i = 0; i < 12; i++) P.failPut((k) => /^jobs\/answers\//.test(k)); } });
  assert.equal(o.ends[o.ends.length - 1], "unrecorded", JSON.stringify(o.ends.slice(-2)));
  assert.equal(o.rec.parts[0].status, "partial", why(o.rec));
  assert.equal(o.rec.parts[0].why, "outcome-unrecorded");
  assert.notEqual(o.rec.state, "done");
});

test("RC 9 — HOW THE REQUEST KEEPS IT: each pause after the first is kept on its own job as what changed since the one before (its twelve added, nothing dropped, earlier ones only renamed where their id moved), each counted 12 … 384, every one far smaller than the whole", { timeout: 300000 }, async () => {
  const o = await oversized("9");
  const pauses = o.rec.parts[0].jobs.filter((x) => x.end && x.end.act === "clarify");
  assert.deepEqual(pauses.map((x) => x.end.held), Array.from({ length: ROUNDS }, (_, i) => (i + 1) * PER));
  assert.equal(pauses[0].end.heldList.length, PER, "the first pause had nothing to build on and is kept whole");
  for (let i = 1; i < pauses.length; i++) {
    const d = pauses[i].end.heldDelta;
    assert.ok(d, "pause " + (i + 1) + " is not kept as what changed: " + JSON.stringify(Object.keys(pauses[i].end)));
    assert.deepEqual([d.base.job, d.base.count, d.drop.length, d.add.length], [pauses[i - 1].id, PER * i, 0, PER], "pause " + (i + 1));
    assert.ok(d.add.every((r) => r.need.startsWith(OPT(i * PER + 1).slice(0, 7))), "an earlier requirement was carried again in full");
    assert.equal(pauses[i].end.heldList, undefined, "a pause carried everything before it again");
  }
  const last = JSON.stringify(pauses[pauses.length - 1].end.heldDelta).length;
  assert.ok(last < 40000, "the last pause's delta is not far smaller than the whole: " + last);
});

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
