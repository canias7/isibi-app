// WHAT A PART'S TRIES LEFT STANDING, KEPT END TO END (2026-10-07).
//
// Codex's review of the cleanup batch: `request.mjs` stored a part's `left`,
// but `requestView` never serialized it, and both the request's reply
// (`requestReply`) and its queued writer (`writeRequestReply`) build their
// facts from `requestView(rec)` — so a part stopped after its table went in
// was told "Stopped at their request before it changed anything". The tests
// that passed read `requestReplyFacts` off the richer internal record. And
// `settle`'s stop branch ignored the job's database record (`row.migration`)
// when its answer said nothing of what stands.
//
// These read what every reader reads: the serialized view, the facts the
// real Worker hands its reply writer from the queue, the card the page draws,
// and the job's own outcome. Earlier tries' standing work is carried across a
// retry, a refusal, a question and a stop, under one status rule.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every model answer is the case's; the reply
// writer answers with the facts it was given, so a case reads what the
// customer would be told about — the wording would be a model's.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, pump, T, call } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { page } from "./fixtures/browser-page.mjs";
import { planParts, newRequest, nextStep, noteJobId, requestView, editJobOutcome, leftOfRow, wantsEvidence } from "../builder/request.mjs";
import { requestReplyFacts } from "../builder/site-reply.mjs";

const SIGNUP = "add a sign-up form that keeps the names of people who sign up";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const SIGNUPS = {
  route: [{ intent: "addon" }],
  [T.adds]: { kinds: ["table", "page"] },
  "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
  "add:page": { page: [PAGE("/sign-up", "Sign up")] },
  [T.pages]: { pages: [writtenPage("/sign-up")] },
};
const slugOf = (k) => "pe-" + k + "-" + Math.random().toString(16).slice(2, 8);
/** The request as its readers see it: `requestView`, through JSON as the wire carries it. */
const seen = (rec) => JSON.parse(JSON.stringify(requestView(rec)));
const texts = (facts) => facts.map((x) => x.text);
const BEFORE = /before it changed anything/;
const AFTER = /^Stopped at their request, after part of it had gone in and is live:/;

/**
 * One add-on request on the real Worker, its queue and its request driver,
 * with a Stop that lands WHILE ITS TABLE IS BEING MADE: the job's cancel is
 * raised by the database statement that creates the table, so its publish
 * gate refuses with the table already standing.
 */
async function stoppedAfterTable(k, { loseAnswer = false, stripOutcome = false } = {}) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: {} });
  const P = platform({ slug: slugOf(k), replies: true, db, answers: SIGNUPS });
  const answer = db.answer.bind(db);
  let key = "";
  db.answer = (query, params) => {
    if (/create table[^(]*signups/i.test(query) && key) {
      const job = P.jobsOf(key).find((j) => j.op === "addon");
      if (job && !job.cancel_requested_at) job.cancel_requested_at = Date.now();
    }
    return answer(query, params);
  };
  // THE STOP'S ANSWER LOST: what the job said is gone, and its row reads cancelled — only its database record speaks.
  // (After the refund, the job's last call: the refund itself writes the row's state.)
  if (loseAnswer) {
    P.after("edit_refund", (args) => {
      const j = P.jobs.get(args.p_id);
      j.result = null; j.state = "cancelled";
    }, (args) => (P.jobs.get(args.p_id) || {}).op === "addon");
  }
  // AN ANSWER STORED BEFORE ANSWERS CARRIED WHAT STANDS: the stop kept, its outcome and database record gone from it.
  if (stripOutcome) {
    P.after("edit_refund", (args) => {
      const j = P.jobs.get(args.p_id);
      const b = JSON.parse(j.result.body);
      j.result = { ...j.result, body: JSON.stringify({ ok: false, detail: b.detail, error: b.error, msg: b.msg }) };
      j.state = "cancelled";
    }, (args) => (P.jobs.get(args.p_id) || {}).op === "addon");
  }
  try {
    const r = await sendMessage(P, { message: SIGNUP });
    key = r.key;
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    await settle(P, r.key);
    await pump(P);
    return { P, key: r.key, close: () => { P.close(); compiler.uninstall(); } };
  } catch (e) { P.close(); compiler.uninstall(); throw e; }
}

test("EVID 1 — A STOP THAT LANDS AFTER THE TABLE WENT IN, THROUGH THE REAL WORKER: the part is stopped and keeps what stands; the serialized view carries it; the facts the queued request reply was given say so — never \"before it changed anything\"", async () => {
  const { P, key, close } = await stoppedAfterTable("e1");
  try {
    const rec = P.record(key);
    const add = P.jobsOf(key).find((j) => j.op === "addon");
    const ans = P.answerOf(add);
    assert.equal(ans && ans.detail, "cancelled", "the publish gate did not see the stop — this case tests nothing: " + JSON.stringify(ans).slice(0, 300));
    assert.equal(ans.outcome.database, "applied", "the table had not gone in when the stop landed — this case tests nothing");
    assert.deepEqual([rec.parts[0].status, rec.parts[0].left], ["cancelled", "partial"]);
    const v = seen(rec);
    assert.equal(v.parts[0].left, "partial", "the view dropped what the part left standing");
    // THE QUEUED REQUEST REPLY: the facts the real writer was handed from the queue.
    const given = P.replyLog.find((fs) => fs.some((x) => x.id === "part:" + rec.parts[0].n || /^Stopped at their request/.test(x.text)));
    assert.ok(given, "the request's reply was never written: " + JSON.stringify(P.replyLog.map(texts)));
    assert.ok(texts(given).some((t) => AFTER.test(t)), JSON.stringify(texts(given)));
    assert.ok(!texts(given).some((t) => BEFORE.test(t)), "the queued reply was told the stop changed nothing: " + JSON.stringify(texts(given)));
    // THE PAGE'S OWN READ of the request carries it too.
    const got = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
    assert.equal(got.status, 200);
    const body = typeof got.body === "string" ? JSON.parse(got.body) : got.body;
    const part = ((body.request || body).parts || [])[0];
    assert.equal(part && part.left, "partial", "the page's read of the request dropped it: " + JSON.stringify(body).slice(0, 400));
  } finally { close(); }
});

test("EVID 2 — THE SAME STOP WITH ITS ANSWER LOST: the driver reads the job's database record, and the part is still told as stopped after part of it went in, in the view and in the queued reply's facts", async () => {
  const { P, key, close } = await stoppedAfterTable("e2", { loseAnswer: true });
  try {
    const add = P.jobsOf(key).find((j) => j.op === "addon");
    assert.equal(add.result, null, "this case tests nothing: the answer was not lost");
    const rec = P.record(key);
    assert.deepEqual([rec.parts[0].status, rec.parts[0].left], ["cancelled", "partial"], JSON.stringify(rec.parts[0]));
    assert.equal(seen(rec).parts[0].left, "partial");
    const given = P.replyLog.find((fs) => fs.some((x) => /^Stopped at their request/.test(x.text)));
    assert.ok(given, "the request's reply was never written: " + JSON.stringify(P.replyLog.map(texts)));
    assert.ok(texts(given).some((t) => AFTER.test(t)), JSON.stringify(texts(given)));
    assert.ok(!texts(given).some((t) => BEFORE.test(t)), JSON.stringify(texts(given)));
  } finally { close(); }
});

// ── CONTROLLED SEQUENCES OF TRIES, READ THROUGH THE VIEW ───────────────────

const KEY = "rq-" + "e".repeat(29);
const A = "a".repeat(32), B = "b".repeat(32), C = "c".repeat(32);
const APPLIED = { status: "applied_without_page", tables: { added: ["signups"], applied: ["signups"] } };
function rqOf() {
  const planned = planParts(SIGNUP, { intent: "addon" });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: KEY, uid: "u1", slug: "fold-lane", message: SIGNUP, picker: "sonnet", tz: "Europe/London", accepted: { intent: "addon" }, parts: planned.parts });
  const first = nextStep(rec, {}, Date.now());
  return noteJobId(first.record, first.file.key, A);
}
const row = (body, state = "failed", more = {}) => ({ ok: true, state, billing: "refunded", needs_review: false, result: body === null ? null : { status: body.ok === true ? 200 : 422, body: JSON.stringify(body) }, ...more });
/** One step: the job `id` ended as `r`; answers `{ record, file }`, the next job noted under `next`. */
function step(rec, id, r, next = "") {
  const out = nextStep(rec, { [id]: r }, Date.now());
  return { record: out.file && next ? noteJobId(out.record, out.file.key, next) : out.record, file: out.file };
}
const REFUSED = { ok: false, error: "compile", msg: "That didn't compile." };
const ASKS = { ok: false, error: "clarify", clarify: { text: "Which page should the form go on?", options: ["Home", "Contact"] }, msg: "Which page?" };

test("EVID 2b — THE SAME STOP WITH AN ANSWER THAT SAYS NOTHING OF WHAT STANDS (one stored before answers carried it): the driver reads the job's database record because the answer does not settle it, and the queued reply is told the stop came after part of it went in", async () => {
  const { P, key, close } = await stoppedAfterTable("e2b", { stripOutcome: true });
  try {
    const add = P.jobsOf(key).find((j) => j.op === "addon");
    const body = P.answerOf(add);
    assert.ok(body && body.ok === false && !Object.hasOwn(body, "outcome"), "this case tests nothing: the answer still says what stands");
    const rec = P.record(key);
    assert.deepEqual([rec.parts[0].status, rec.parts[0].left], ["cancelled", "partial"], JSON.stringify(rec.parts[0]));
    const given = P.replyLog.find((fs) => fs.some((x) => /^Stopped at their request/.test(x.text)));
    assert.ok(given && texts(given).some((t) => AFTER.test(t)), JSON.stringify(P.replyLog.map(texts)));
    assert.ok(!texts(given).some((t) => BEFORE.test(t)), JSON.stringify(texts(given)));
  } finally { close(); }
});

test("EVID 3 — AN EARLIER TRY'S TABLE STANDS ACROSS A RETRY THAT IS REFUSED: the part is done in part (never wholly failed), the view says what stands, the facts say done in part", () => {
  const first = step(rqOf(), A, row(null, "lost", { migration: APPLIED }), B);
  assert.equal(first.record.parts[0].left, "partial");
  const last = step(first.record, B, row(REFUSED)).record;
  assert.deepEqual([last.parts[0].status, last.parts[0].why, last.parts[0].left], ["partial", "partly-done", "partial"]);
  const v = seen(last);
  assert.equal(v.parts[0].left, "partial");
  const f = texts(requestReplyFacts(v).facts);
  assert.ok(f.some((t) => /^Done only in part:/.test(t)), JSON.stringify(f));
  assert.ok(!f.some((t) => /^Not done:/.test(t) || BEFORE.test(t)), JSON.stringify(f));
});

test("EVID 4 — A QUESTION AFTER AN EARLIER TRY'S TABLE WENT IN: the part waits with what stands on it, and the facts say both — waiting for the answer, and that part of it is already live", () => {
  const first = step(rqOf(), A, row(null, "lost", { migration: APPLIED }), B);
  const waiting = step(first.record, B, row(ASKS)).record;
  assert.deepEqual([waiting.parts[0].status, waiting.parts[0].left], ["waiting", "partial"], JSON.stringify(waiting.parts[0]));
  const v = seen(waiting);
  assert.equal(v.parts[0].left, "partial");
  const f = texts(requestReplyFacts(v).facts);
  assert.ok(f.some((t) => /^Waiting for their answer/.test(t)), JSON.stringify(f));
  assert.ok(f.some((t) => /part of it already went in and is live/.test(t)), JSON.stringify(f));
  // A QUESTION WHOSE OWN ANSWER SAYS ITS TABLES WENT IN, on a first try: kept while it waits.
  const own = step(rqOf(), A, row({ ...ASKS, outcome: { state: "partial", published: false, database: "applied", tables: ["signups"] } })).record;
  assert.deepEqual([own.parts[0].status, own.parts[0].left], ["waiting", "partial"], JSON.stringify(own.parts[0]));
  assert.equal(seen(own).parts[0].left, "partial");
});

test("EVID 5 — A STOP AFTER AN EARLIER TRY'S TABLE WENT IN, ITS OWN JOB'S ANSWER SAYING NOTHING OF IT: still stopped after part of it went in; a stop with nothing standing anywhere is told as before", () => {
  const first = step(rqOf(), A, row(null, "lost", { migration: APPLIED }), B);
  const stopped = step(first.record, B, row({ ok: false, error: "cancelled", msg: "I stopped that." }, "cancelled")).record;
  assert.deepEqual([stopped.parts[0].status, stopped.parts[0].left], ["cancelled", "partial"]);
  const f = texts(requestReplyFacts(seen(stopped)).facts);
  assert.ok(f.some((t) => AFTER.test(t)), JSON.stringify(f));
  assert.ok(!f.some((t) => BEFORE.test(t)), JSON.stringify(f));
  // NOTHING STANDING: the old sentence, which is true there — and no `left` on the view.
  const clean = step(rqOf(), A, row({ ok: false, error: "cancelled", msg: "I stopped that." }, "cancelled")).record;
  assert.equal(Object.hasOwn(seen(clean).parts[0], "left"), false);
  assert.ok(texts(requestReplyFacts(seen(clean)).facts).some((t) => BEFORE.test(t)));
});

test("EVID 6 — A STOPPED JOB WITH NO USABLE ANSWER IS READ FROM ITS DATABASE RECORD: `wantsEvidence` asks for it, `settle`'s stop branch reads it, and the job's own outcome is done in part — while a stop whose answer already says what stands, or a finished job, asks for nothing", () => {
  const bare = row(null, "cancelled");
  assert.equal(wantsEvidence(bare), true);
  assert.equal(wantsEvidence(row({ ok: false, error: "cancelled", msg: "x" }, "cancelled")), true);
  assert.equal(wantsEvidence(row({ ok: false, detail: "cancelled", outcome: { state: "partial", published: false, database: "applied", tables: ["signups"] }, msg: "x" }, "cancelled")), false);
  assert.equal(wantsEvidence(row({ ok: true }, "done")), false);
  assert.equal(wantsEvidence({ ...bare, needs_review: true }), false);
  const withRecord = { ...bare, migration: APPLIED };
  assert.equal(leftOfRow(withRecord), "partial");
  const rec = step(rqOf(), A, withRecord).record;
  assert.deepEqual([rec.parts[0].status, rec.parts[0].left], ["cancelled", "partial"]);
  assert.equal(editJobOutcome(withRecord, "addon"), "partial");
  assert.equal(editJobOutcome(bare, "addon"), "cancelled");
  assert.equal(editJobOutcome({ ...row(null, "lost"), migration: APPLIED }, "addon"), "partial");
  assert.equal(editJobOutcome(row(null, "lost"), "addon"), "failed");
});

test("EVID 7 — A RETRY THAT FINISHES SPEAKS FOR THE WHOLE PART; a weaker reading never replaces a stronger one; a value from storage that is not one of the three is never carried", () => {
  const first = step(rqOf(), A, row(null, "lost", { migration: APPLIED }), B);
  const done = step(first.record, B, row({ ok: true, outcome: { state: "done", published: true } }, "done")).record;
  assert.equal(Object.hasOwn(done.parts[0], "left"), false, "a finished retry kept an earlier try's partial reading");
  assert.equal(Object.hasOwn(seen(done).parts[0], "left"), false);
  const unheard = step(first.record, B, row(null, "lost", { migration: { status: "failed" } })).record;
  assert.equal(unheard.parts[0].left, "partial");
  const junk = { ...first.record, parts: first.record.parts.map((p) => ({ ...p, status: "failed", left: "everything" })) };
  assert.equal(Object.hasOwn(seen(junk).parts[0], "left"), false, "an unknown reading reached the view");
});

// ── THE CARD THE PAGE DRAWS ────────────────────────────────────────────────

test("EVID 8 — THE CARD: a part stopped after part of it went in is labelled so and shows its partial line, never \"Stopped\" with its not-done line; part-way and saved-not-live are labelled too; a plain stop is unchanged", () => {
  const said = { planned: "I'll add the sign-up form.", doing: "Adding the form.", done: "Added the form.", partial: "Part of the sign-up form is in.", notdone: "Nothing of the form went in.", waiting: "Waiting on you.", unconfirmed: "Not sure yet whether the form went in." };
  const view = (parts) => ({ key: KEY, state: "partial", ended: true, stop: true, parts });
  const draw = (parts) => {
    const site = { id: "s1", slug: "fold-lane", react: true, name: "x", msgs: [{ r: "u", t: SIGNUP, request: KEY }], requests: { [KEY]: { own: true, view: view(parts) } } };
    const p = page({ site });
    return p.ctx.siteRequestHTML(site.msgs[0], p.s);
  };
  const html = draw([{ n: 0, words: SIGNUP, status: "cancelled", left: "partial", said }]);
  assert.match(html, />Stopped after part of it went in</);
  assert.doesNotMatch(html, />Stopped</);
  assert.match(html, /Part of the sign-up form is in\./);
  assert.doesNotMatch(html, /Nothing of the form went in\./);
  assert.match(draw([{ n: 0, words: SIGNUP, status: "cancelled", left: "unknown", said }]), />Stopped part-way<[\s\S]*|Not sure yet whether the form went in\./);
  assert.match(draw([{ n: 0, words: SIGNUP, status: "failed", left: "unpublished", said }]), />Saved, not live</);
  const plain = draw([{ n: 0, words: SIGNUP, status: "cancelled", said }]);
  assert.match(plain, />Stopped</);
  assert.match(plain, /Nothing of the form went in\./);
  // A LABEL THE VIEW DID NOT SEND is never invented: an unknown reading draws as the plain status.
  assert.match(draw([{ n: 0, words: SIGNUP, status: "cancelled", left: "everything", said }]), />Stopped</);
});

// ── A PAGE-FILED JOB: ITS OWN POLL AND ANOTHER DEVICE'S LIST ───────────────

test("EVID 9 — A PAGE-FILED ADD-ON STOPPED WHILE ITS TABLE WAS MADE, ITS ANSWER LOST: the job poll hands its database record back and reads its outcome as done in part, and another device's job list reads it the same — never \"Stopped\" over a table that stands", async () => {
  const compiler = installCompiler();
  const db = rowsDb({ tables: {} });
  const { route, ...rest } = SIGNUPS;
  const P = platform({ slug: slugOf("e9"), replies: true, progress: true, db, answers: rest });
  const answer = db.answer.bind(db);
  let id = "";
  db.answer = (query, params) => {
    if (/create table[^(]*signups/i.test(query) && id) { const j = P.jobs.get(id); if (j && !j.cancel_requested_at) j.cancel_requested_at = Date.now(); }
    return answer(query, params);
  };
  P.after("edit_refund", (args) => { const j = P.jobs.get(args.p_id); j.result = null; j.state = "cancelled"; }, (args) => args.p_id === id);
  try {
    const filed = await call(P, "POST", "/api/site/" + P.slug + "/addon", { instruction: SIGNUP, picker: "sonnet", idem: "9".repeat(32) });
    assert.ok([200, 202].includes(filed.status), JSON.stringify(filed.body).slice(0, 300));
    id = filed.body.job;
    await pump(P, { max: 60 });
    const j = P.jobs.get(id);
    assert.deepEqual([j.state, j.result, !!j.cancel_requested_at], ["cancelled", null, true], "this case tests nothing: the job did not stop with its answer lost");
    const poll = await call(P, "GET", "/api/site/edit/" + id);
    assert.equal(poll.status, 202, "the poll answers 202 for every state but done: " + JSON.stringify(poll.body).slice(0, 300));
    assert.equal(poll.body.migration && poll.body.migration.status, "applied_without_page", "the job poll did not hand its database record back: " + JSON.stringify(poll.body).slice(0, 400));
    assert.equal(poll.body.outcome, "partial", "the job poll read a stop over a standing table as plain stopped");
    const list = await call(P, "GET", "/api/site/requests/" + P.slug);
    const listed = (list.body.jobs || []).find((x) => x.job === id);
    assert.ok(listed, "the job was not listed: " + JSON.stringify(list.body).slice(0, 300));
    assert.equal(listed.outcome, "partial", "another device's list read a stop over a standing table as plain stopped");
  } finally { P.close(); compiler.uninstall(); }
});
