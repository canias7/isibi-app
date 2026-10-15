// THE VERIFICATION HARNESS JUDGES WHAT IT IS FOR (2026-10-15, after Codex's
// review of `1b52561f`). Four gaps Codex reproduced, each pinned here so the
// harness cannot drift back:
//
//   1. Every conversation case passed on one identical irrelevant answer —
//      "Your bakery opens at 3:17am on Sundays. Does that help?" — because the
//      checks read the reply's metadata. Each case is now judged against known
//      evidence (the stored pages, what they lack, what the cut hid, the file
//      attached), never against required wording, and what the automation
//      cannot establish is UNVERIFIED with the whole answer kept.
//   2. A post-send balance that answered 503 was counted as 0 and the run kept
//      sending: six sends, 22 credits spent, 10 recorded, against a ceiling of
//      16. An unknown or unreconciled charge now stops every later paid send,
//      and stays unknown (null), never zero.
//   3. B1 counted metadata plus a seek as playback. It now requires play() to
//      start, the clock to advance, the seek to land and the clock to advance
//      again, with no media error (`judgePlayback`).
//   4. A browser run with no browsers passed on its upload check alone.
//
// Each case below fails on `1b52561f`'s script (the red check in the round's
// records) and passes on this one. Nothing here calls a model or the network.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { run, CONVERSE_CASES, judgeCase, judgePlayback, hoursAbsent, specificsIn, pageEvidence } from "../scripts/media-verify.mjs";
import { extractText } from "../builder/site-text.mjs";

const FIX = new URL("./fixtures/media/", import.meta.url).pathname;
const CODEX = "Your bakery opens at 3:17am on Sundays. Does that help?";

// A HOME PAGE AND A VISIT PAGE AS STORED (`source/<slug>/pages.json`): words
// about the bakery, its loaves and its classes, and no opening hours at all.
const HOME = `export default function Home() {
  return (<main>
    <h1>Harbour Loaf</h1>
    <p>Sourdough loaves baked overnight beside the harbour in Leeds.</p>
    <p>Join our weekend bread-making classes and take your own starter home.</p>
    <a href="/visit">Find the bakery</a>
  </main>);
}`;
const VISIT = `export default function Visit() {
  return (<main><h1>Visit</h1><p>We are on Canal Street, next to the old ferry steps.</p></main>);
}`;
const PAGES = [{ path: "/", source: HOME }, { path: "/visit", source: VISIT }];

/**
 * THE APP, AS THE HARNESS SEES IT: the runtime switches, the balance, the
 * stored pages and the routing route. `answer(body)` writes the route's reply;
 * the ledger moves by `charge(n)` per send (default: the reply's cost);
 * `balanceAfter(n)` may answer a status instead of the balance after send n.
 */
function fakeApp({ answer, pages = PAGES, pagesRead = true, charge, balanceAfter, throwOn, outside } = {}) {
  let balance = 100;
  let sends = 0;
  let readAfter = false;
  const sent = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const p = u.pathname;
    const j = (v, s = 200) => Response.json(v, { status: s });
    if (p === "/api/site/runtime") return j({ ok: true, deploy: "d", imagePurchases: false });
    if (p === "/api/site/build-health") return j({ ok: false }, 501);
    if (p === "/api/credits") {
      if (readAfter && balanceAfter) { readAfter = false; const s = balanceAfter(sends); if (typeof s === "number") return j({ error: "unavailable" }, s); }
      const was = readAfter;
      readAfter = false;
      const now = balance;
      // A CHARGE FROM ELSEWHERE, landing after this send's own reading.
      if (was && outside) balance -= outside(sends);
      return j({ balance: now });
    }
    if (p === "/api/site/source") return j({ ok: true, slug: "verify-talk", pages, parts: [], reads: { pages: pagesRead, parts: true, assets: true } });
    if (p === "/api/site/route") {
      sends++;
      const body = JSON.parse(init.body);
      sent.push(body);
      if (throwOn && throwOn(sends)) throw new TypeError("fetch failed: socket hang up");
      const reply = { intent: "ask", replyFrom: "conversation", cost: 2, ...answer(body) };
      balance -= charge ? charge(sends, reply) : Number(reply.cost) || 0;
      readAfter = true;
      return j(reply);
    }
    return j({ error: "unexpected " + p }, 599);
  };
  return { fetch, sent, get balance() { return balance; } };
}

const converse = (app, extra = {}) => run({ fetch: app.fetch, base: "https://gofarther.dev", token: "t", mode: "converse", slug: "verify-talk", spend: "yes", maxCredits: 60, fixtures: FIX, ...extra });
const byCase = (r, id) => r.results.checks.filter((c) => c.name.startsWith(id + ":"));

// ── 1. THE CASES ARE JUDGED ON WHAT THEY ARE FOR ────────────────────────────

test("CODEX'S IRRELEVANT ANSWER, SENT TO ALL SIX CASES, FAILS EVERY ONE: the 3:17am it invents is in no page, and each case's own purpose is unmet", async () => {
  const app = fakeApp({ answer: () => ({ answer: CODEX, decision: { reasons: ["history-cut"] } }) });
  const r = await converse(app);
  assert.equal(app.sent.length, CONVERSE_CASES.length, "every case was sent: the evidence admits them all");
  assert.equal(r.ok, false);
  for (const c of CONVERSE_CASES) {
    const fails = byCase(r, c.id).filter((x) => x.verdict === "fail");
    assert.ok(fails.length >= 1, c.id + " passed an answer that does not do its job: " + JSON.stringify(byCase(r, c.id)));
    assert.ok(fails.some((x) => /evidence lacks/.test(x.name) && /time 3:17/.test(x.detail)), c.id + ": the invented time was not caught");
  }
  // AND EACH CASE'S OWN PURPOSE, apart from the invented time.
  const failed = (id, re) => byCase(r, id).some((x) => x.verdict === "fail" && re.test(x.name));
  assert.ok(failed("C2-compare", /both the booking page and the enquiry form/));
  assert.ok(failed("C3-grounded", /home page's own words/));
  assert.ok(failed("C8-attachment", /talks about the attached clip/));
  // THE ANSWER IS KEPT WHOLE for whoever reads the run.
  assert.ok(r.results.recorded.filter((x) => x.case).every((x) => x.answer === CODEX));
});

test("NATURAL ANSWERS THAT DO EACH JOB PASS WITHOUT ANY REQUIRED WORDING, and what cannot be established is unverified with the whole answer kept", async () => {
  const say = {
    "hi": "Hello! What would you like to work on for your site today?",
    "Should I": "Both can work.\n\n- A booking page lets people choose a class date and pay up front, so places are held.\n- An enquiry form is lighter: people ask first and you confirm by email.\n\nIf classes fill quickly, the booking page saves you the back-and-forth.",
    "What does my": "Your home page introduces Harbour Loaf, a Leeds bakery making sourdough loaves overnight by the harbour. It also invites people to weekend bread-making classes where they take a starter home.",
    "What time": "I wasn't shown any Sunday opening hours anywhere on your site. If you tell me them, I can add them to the Visit page.",
    "ok, use": "The earlier message was cut off before the third version, so I can't see it. Could you paste the third headline again?",
    "What could I": "I can't watch the clip itself, only its name, but a short video like clip.webm often works at the top of the home page or beside your classes.",
  };
  const app = fakeApp({ answer: (b) => ({ answer: Object.entries(say).find(([k]) => b.message.startsWith(k))[1], decision: { reasons: b.message.startsWith("ok, use") ? ["history-cut"] : [] } }) });
  const r = await converse(app);
  assert.deepEqual(r.results.checks.filter((c) => c.verdict === "fail"), []);
  for (const c of CONVERSE_CASES) assert.ok(byCase(r, c.id).some((x) => x.verdict === "pass"), c.id);
  // THE COMPARISON'S QUALITY IS A PERSON'S CALL: unverified, answer kept whole.
  const open = r.results.unverified.find((u) => u.case === "C2-compare");
  assert.ok(open && open.answer === say["Should I"], JSON.stringify(r.results.unverified));
  assert.equal(r.ok, true);
  assert.equal(r.results.outcome, "needs review");
});

test("EACH CASE FAILS ON ITS OWN PURPOSE: an ungrounded summary, the hidden version guessed, the clip described as watched, an invented Sunday time", () => {
  const ev = { pages: pageEvidence(PAGES, extractText), homePath: "/", history: [], hidden: "Version three: Crusts beside the lighthouse." };
  const c = (id) => CONVERSE_CASES.find((x) => x.id === id);
  const verdictOf = (id, answer, extra = {}) => judgeCase(c(id), { intent: "ask", replyFrom: "conversation", answer, ...extra }, ev);
  const failedOn = (list, re) => list.some((x) => x.verdict === "fail" && re.test(x.name));
  assert.ok(failedOn(verdictOf("C3-grounded", "It talks about modern furniture design and mid-century chairs for interior lovers."), /home page's own words/));
  assert.ok(failedOn(verdictOf("C5-cut-history", "Done: your headline is now 'Crusts beside the lighthouse'.", { decision: { reasons: ["history-cut"] } }), /hidden third version/));
  assert.ok(failedOn(verdictOf("C8-attachment", "The clip shows a baker shaping dough at dawn, so use it on the home page."), /what is in the clip/));
  assert.ok(failedOn(verdictOf("C4-missing", "On Sundays you open from 9am until 1pm."), /evidence lacks/));
  assert.ok(failedOn(verdictOf("C1-greeting", "Hi! I've just visited your site and it looks great."), /inspection/));
  // AND A MISSING SIGN IS NOT A FAILURE: unverified, never failed for wording.
  const plain = verdictOf("C4-missing", "Sunday hours would be a good thing to show visitors.");
  assert.ok(!plain.some((x) => x.verdict === "fail"), JSON.stringify(plain));
  assert.ok(plain.some((x) => x.verdict === "unverified"));
});

test("THE MISSING-INFORMATION FIXTURE MUST REALLY LACK IT: a site that lists Sunday hours, or whose pages cannot be read, is not sent the case", async () => {
  assert.equal(hoursAbsent(pageEvidence(PAGES, extractText)).ok, true);
  const withHours = [{ path: "/", source: HOME }, { path: "/visit", source: VISIT.replace("next to the old ferry steps.", "next to the old ferry steps. Open Sunday 9am to 1pm.") }];
  assert.equal(hoursAbsent(pageEvidence(withHours, extractText)).ok, false);
  const app = fakeApp({ answer: () => ({ answer: "Hello!" }), pages: withHours });
  const r = await converse(app);
  assert.equal(app.sent.some((b) => b.message.startsWith("What time")), false, "C4 was sent to a site that has the answer");
  assert.ok(byCase(r, "C4-missing").some((x) => x.verdict === "fail" && /really lacks/.test(x.name)));
  // A SITE THAT SAYS IT IS CLOSED ON SUNDAYS HAS THE ANSWER, with no time in it.
  const closed = [{ path: "/", source: HOME }, { path: "/visit", source: VISIT.replace("next to the old ferry steps.", "next to the old ferry steps. Closed on Sundays.") }];
  assert.equal(hoursAbsent(pageEvidence(closed, extractText)).ok, false);
  const blind = fakeApp({ answer: () => ({ answer: "Hello!" }), pagesRead: false });
  const r2 = await converse(blind);
  assert.equal(blind.sent.some((b) => b.message.startsWith("What does my") || b.message.startsWith("What time")), false, "a case was sent with no evidence to judge it by");
  assert.equal(r2.ok, false);
});

test("SPECIFICS ARE FOUND BY KIND, NOT BY PHRASE", () => {
  assert.deepEqual([...specificsIn(CODEX)], ["time 3:17"]);
  // THE SAME TIME, HOWEVER IT IS WRITTEN.
  assert.deepEqual([...specificsIn("3pm")], [...specificsIn("15:00")]);
  assert.deepEqual([...specificsIn("3:00 p.m.")], ["time 15:00"]);
  assert.deepEqual([...specificsIn("Classes are £45, call 0113 496 0000 or email bake@harbourloaf.co.uk")].sort(), ["email bake@harbourloaf.co.uk", "phone 134960000", "price £45"]);
  assert.equal(specificsIn("We bake three kinds of loaf.").size, 0);
});

// ── 2. AN UNKNOWN OR UNRECONCILED CHARGE STOPS EVERY LATER SEND ─────────────

test("CODEX'S ACCOUNTING CASE: the first balance after a send answers 503 — one send only, its charge kept as unknown (never 0), and nothing more is spent", async () => {
  const app = fakeApp({ answer: () => ({ answer: "Hello! What would you like?" }), charge: () => 4, balanceAfter: (n) => (n === 1 ? 503 : null) });
  const r = await converse(app, { maxCredits: 16 });
  assert.equal(app.sent.length, 1, "it kept sending after a charge it could not read");
  assert.equal(r.results.spends.length, 1);
  assert.equal(r.results.spends[0].spent, null, "an unread charge was recorded as a number");
  assert.equal(r.results.stopped, "charge unknown");
  assert.deepEqual({ known: r.results.spending.known, unknown: r.results.spending.unknown }, { known: 0, unknown: 1 });
  assert.equal(r.ok, false);
  assert.equal(100 - app.balance, 4, "more was spent than the one send");
});

test("A CHARGE THAT DOES NOT RECONCILE STOPS THE RUN: the ledger moved 5, the reply said 2", async () => {
  const app = fakeApp({ answer: () => ({ answer: "Hello! What would you like?" }), charge: () => 5 });
  const r = await converse(app, { maxCredits: 60 });
  assert.equal(app.sent.length, 1);
  assert.equal(r.results.stopped, "charge unreconciled");
  assert.equal(r.results.spends[0].unreconciled, true);
  assert.equal(r.results.spends[0].spent, 5, "the ledger's own movement is what is recorded");
  assert.equal(r.ok, false);
});

test("A REPLY WITH NO COST IS UNRECONCILED, NOT FREE", async () => {
  const app = fakeApp({ answer: () => ({ answer: "Hello! What would you like?", cost: undefined }), charge: () => 3 });
  const r = await converse(app);
  assert.equal(app.sent.length, 1);
  assert.equal(r.results.stopped, "charge unreconciled");
});

test("THE CEILING COUNTS WHAT THE LEDGER MOVED: estimates decide whether to try; the ceiling is the only limit, and the run stops before passing it", async () => {
  const app = fakeApp({ answer: () => ({ answer: "Hello! What would you like?", cost: 6 }), charge: () => 6 });
  const r = await converse(app, { maxCredits: 16 });
  // 6 + upper estimate 6 = 12 ≤ 16 → a second send; 12 + 6 = 18 > 16 → stop.
  assert.equal(app.sent.length, 2);
  assert.equal(r.results.stopped, "ceiling");
  assert.equal(r.results.spending.known, 12);
  assert.equal(r.results.spending.estimatesAreNotLimits, true);
});

test("A CHARGE NOTHING REPORTED STILL COUNTS AGAINST THE CEILING: the ledger's own movement since the start decides the next send", async () => {
  // Send 1 costs 2 and reconciles; then 10 more leave the balance from
  // elsewhere. Before send 2: the ledger moved 12, + upper estimate 6 = 18 > 16.
  const app = fakeApp({ answer: () => ({ answer: "Hello! What would you like?" }), outside: (n) => (n === 1 ? 10 : 0) });
  const r = await converse(app, { maxCredits: 16 });
  assert.equal(app.sent.length, 1, "a send went past the ceiling the ledger had already reached");
  assert.equal(r.results.stopped, "ceiling");
  assert.match(r.results.checks.find((c) => /ceiling/.test(c.name)).detail, /ledger moved 12/);
});

test("A SEND THAT THROWS KEEPS ITS EVIDENCE: the run returns its results, the charge unknown, nothing sent after", async () => {
  const app = fakeApp({ answer: () => ({ answer: "Hello! What would you like?" }), throwOn: (n) => n === 2 });
  const r = await converse(app);
  assert.equal(app.sent.length, 2);
  assert.equal(r.results.spends.length, 2);
  assert.equal(r.results.spends[1].spent, null);
  assert.match(r.results.spends[1].why, /request failed/);
  assert.equal(r.results.stopped, "charge unknown");
  assert.ok(r.results.recorded.some((x) => x.case === "C1-greeting" && x.answer), "the first case's answer was lost");
  assert.equal(r.results.outcome, "failed");
});

test("AN EXCEPTION OUTSIDE A SEND STILL ANSWERS WITH RESULTS, never a throw", async () => {
  const r = await run({ fetch: async () => { throw new TypeError("fetch failed"); }, base: "https://gofarther.dev", token: "t", mode: "converse", slug: "verify-talk", spend: "yes", maxCredits: 10, fixtures: FIX });
  assert.equal(r.ok, false);
  assert.match(r.results.error, /fetch failed/);
  assert.equal(r.results.outcome, "failed");
});

// ── THE BUILD'S CHARGE ──────────────────────────────────────────────────────

const JOB = "0123456789abcdef0123456789abcdef";
function buildApp({ finish = true, window = "whole" } = {}) {
  let balance = 200, polls = 0, n = 0;
  const rows = [];
  const fetch = async (url, init = {}) => {
    const p = new URL(url).pathname;
    const j = (v, s = 200) => Response.json(v, { status: s });
    n++;
    if (p === "/api/site/runtime") return j({ ok: true, deploy: "d", imagePurchases: false });
    if (p === "/api/site/build-health") return j({ ok: false }, 501);
    if (p === "/api/credits") return j({ balance });
    if (p === "/api/media/drafts" && init.method === "POST") return j({ ok: true, session: (n.toString(16) + "0".repeat(32)).slice(0, 32), parts: 1, partBytes: 8388608 }, 201);
    if (/^\/api\/media\/drafts\/[a-f0-9]{32}\/1$/.test(p)) return j({ ok: true, etag: "e" });
    if (/\/complete$/.test(p)) return j({ ok: true, name: "a".repeat(32) + (n % 2 ? ".webm" : ".mp3"), kind: "audio" }, 201);
    if (p === "/api/site/react-build") { balance -= 25; rows.push({ id: rows.length + 1, delta: -25, ref: "build:" + JOB }); return j({ ok: true, pending: true, job: JOB, poll: "/api/site/build/" + JOB }, 202); }
    if (p === "/api/site/build/" + JOB) { polls++; return finish && polls >= 2 ? j({ ok: true, slug: "harbour-loaf", notes: "Your video plays on the home page.", images: { made: 0 }, media: { placed: [], missing: [] } }) : j({ ok: true, pending: true }, 202); }
    return j({ files: [] });
  };
  const ledger = { last: async () => ({ ok: true, id: rows.length }), window: async (a, b) => ({ ok: true, complete: window === "whole", rows: rows.filter((x) => x.id > a && x.id <= b) }) };
  return { fetch, ledger };
}
const build = (app, extra = {}) => run({ fetch: app.fetch, ledger: app.ledger, base: "https://gofarther.dev", token: "t", mode: "build", slug: "verify-build", spend: "yes", maxCredits: 60, fixtures: FIX, sleep: async () => {}, ...extra });

test("THE BUILD'S CHARGE IS RECONCILED BY THE LEDGER WINDOW, or it is unknown and the run fails", async () => {
  const good = await build(buildApp());
  assert.equal(good.results.money.ok, true, JSON.stringify(good.results.money));
  assert.deepEqual(good.results.spends.map((x) => x.spent), [25]);
  const partial = await build(buildApp({ window: "partial" }));
  assert.deepEqual(partial.results.spends.map((x) => x.spent), [null], "a charge the ledger could not explain was recorded as a number");
  assert.equal(partial.results.stopped, "charge unknown");
  assert.equal(partial.ok, false);
  const noLedger = await build(buildApp(), { ledger: null });
  assert.deepEqual(noLedger.results.spends.map((x) => x.spent), [null]);
  assert.equal(noLedger.ok, false);
});

test("A BUILD STILL RUNNING WHEN THE POLL GIVES UP IS AN UNKNOWN CHARGE, not a finished one", async () => {
  let now = 0;
  const realNow = Date.now;
  Date.now = () => (now += 60000);
  try {
    const r = await build(buildApp({ finish: false }));
    assert.equal(r.results.spends.at(-1).spent, null);
    assert.match(r.results.spends.at(-1).why, /still running/);
    assert.equal(r.ok, false);
  } finally { Date.now = realNow; }
});

// ── 3. PLAYBACK, NOT METADATA ───────────────────────────────────────────────

test("B1 COUNTS ONLY REAL PLAYBACK: metadata plus a seek is not playing; a refused play(), a stalled clock and a media error each fail", () => {
  const full = { loaded: true, played: true, advanced: true, sought: true, target: 1.6, landed: 1.6, continued: true, errors: [], error: null };
  assert.equal(judgePlayback(full).ok, true, judgePlayback(full).why);
  // THE OLD OBSERVATION, which B1 used to pass: loaded, seeked, at the target.
  assert.equal(judgePlayback({ loaded: true, sought: true, duration: 4, at: 3 }).ok, false);
  assert.equal(judgePlayback({ ...full, played: false, playError: "NotAllowedError" }).ok, false);
  assert.equal(judgePlayback({ ...full, advanced: false }).ok, false);
  assert.equal(judgePlayback({ ...full, continued: false }).ok, false);
  assert.equal(judgePlayback({ ...full, errors: [3] }).ok, false);
  assert.equal(judgePlayback({ ...full, landed: 0 }).ok, false);
});

// ── 4. A BROWSER RUN WITHOUT ITS BROWSERS IS NOT A SUCCESS ──────────────────

test("A BROWSER RUN MISSING A REQUIRED BROWSER FAILS, and one with no browsers at all cannot pass on its upload check", async () => {
  const worker = await loadWorker();
  const bucket = mediaBucket();
  const env = envFor(bucket);
  await withWire({}, async () => {
    const fetch = async (url, init = {}) => {
      if (new URL(url).pathname === "/api/credits") return Response.json({ balance: 50 });
      return worker.fetch(new Request(url, { method: init.method, headers: init.headers, body: init.body }), env, makeCtx());
    };
    const r = await run({ fetch, base: "https://gofarther.dev", token: "t", fixtures: FIX, mode: "browser", slug: "verify-none", mutate: "yes", browsers: {} });
    assert.equal(r.ok, false, "a browser run with no browsers passed");
    for (const e of ["chromium", "chrome", "firefox", "webkit"]) assert.ok(r.results.checks.some((c) => c.verdict === "fail" && c.name === "B1 " + e + " is available to this run"), e);
    assert.ok(r.results.checks.some((c) => c.verdict === "fail" && /composer and Files panel were checked/.test(c.name)));
    assert.equal([...bucket.store.keys()].filter((k) => k.startsWith("uploads/verify-none/")).length, 0, "the fixtures were left behind");
  });
});
