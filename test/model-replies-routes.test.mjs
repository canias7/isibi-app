// THE CUSTOMER'S REPLY, WRITTEN BY A MODEL — THROUGH THE REAL ROUTES AND THE
// REAL PAGE (2026-10-03).
//
// Owner: *"Make normal customer-facing messages throughout edit and add-on
// model-written, including router clarification, success, partial completion,
// pending work, ordinary refusals, repeated-question explanations, and
// cancellation acknowledgments. Audit both Worker responses and
// browser-generated messages so canned paragraphs are not added after the model
// replies. … Keep fixed messages only for genuine technical failures … an HTTP
// status alone must not turn a normal product outcome into that exception. …
// A reply-generation failure must never rerun completed work. Preserve
// clarification state, answer retention, and protections against duplicate
// changes and charges; leave first-build behavior unchanged. Test complete and
// partial success, clarification and follow-ups, ordinary refusals,
// cancellation, and technical fallbacks, checking the final browser-visible
// text against actual outcomes."*
//
// EVERY HOP IS DRIVEN, with `MODEL_REPLIES` on: the real routing route, the
// real edit and add-on routes (synchronously and as a queued job), the real
// poll route that hands a finished job's answer back, the real question route
// that cancels — and, where the case is about what the customer reads, the
// real page (test/fixtures/browser-page.mjs: the handlers of public/chat.js in
// a VM) sending its own requests to the real Worker and drawing the answer.
// What a case checks is what happened — the stored pages and design, every
// publish, every charge, the stored question, each model call — and that the
// page shows the reply the Worker wrote, whole, with nothing after it.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. The reply model here explains every fact it is
// shown in that fact's own words and lists them all; whether a real model
// writes a good, faithful reply — and how long it takes — is a live
// measurement this file cannot make.
import { checkFacts } from "../builder/check-evidence.mjs";
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page, settle } from "./fixtures/browser-page.mjs";
import { REPLY_TOOL } from "../builder/site-reply.mjs";
import { QUESTION_KEY, ASK_TTL_MS, MAX_ANSWER_CHARS, MAX_HISTORY, againNote } from "../builder/clarify.mjs";
import { JOB_ENV_NAMES, jobSecrets } from "../builder/edit-job.mjs";
import { editBrowserReply, browserReply } from "../scripts/addon-sweep.mjs";
import {
  T, TOKEN, VISIT, VISIT_MOVED, NEW_DESC, OLD_DESC, Q, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedLook, storedPage, userText, json, USER,
} from "./fixtures/live-ask.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const FINAL_HEADER = EditPoll.FINAL_HEADER;
const USER_ID = USER.id;
const W = REPLY_TOOL.name;
const ON = (store) => ({ ...envFor(store), MODEL_REPLIES: "on" });
const DESC_WORDS = "Change the site's search description to \"" + NEW_DESC + "\"";
const MOVE_WORDS = "put the order band above the other one";
const Q2 = { text: "Which band is the order band — the one about holding a loaf?", options: ["Yes", "No"] };

/** The facts one reply call was shown, by id, read off its own request. */
function factsShown(args) {
  const t = userText(args);
  const at = t.indexOf("WHAT REALLY HAPPENED");
  assert.ok(at >= 0, "a reply call carried no facts: " + t.slice(0, 200));
  return [...t.slice(at).matchAll(/^\[([a-z]\d+)\] (.+)$/gm)].map((m) => ({ id: m[1], text: m[2] }));
}

/**
 * THE REPLY MODEL, SUPPLIED. It explains every fact it is shown, in that
 * fact's own words — so a case reads off the reply that the facts reached it —
 * and lists them all. A note (a question asked again) is one short line.
 * `log` keeps every call's facts and whether it was a note.
 */
function writer(log, tag = "Here is what happened") {
  return (args, n) => {
    const facts = factsShown(args);
    const note = /WRITE A NOTE/.test(userText(args));
    log.push({ facts, note });
    return {
      reply: note ? "You answered this one before, so here it is again, more exactly (" + n + ")." : tag + " (" + n + "): " + facts.map((f) => f.text).join(" "),
      covers: facts.map((f) => f.id),
    };
  };
}
const replyCalls = (seen) => seen.calls.filter((c) => c === W).length;
const builds = (compiler) => compiler.calls.filter((c) => String(c.url).includes("/build")).length;
const withoutReply = (body) => { const { reply, replySource, ...rest } = body; return rest; };
// THE STEPS' OWN FACTS, the publish's checks (`k`, 2026-10-14) set apart: every published change carries those.
const own = (facts) => facts.filter((f) => !/^k\d+$/.test(f.id));
// A RUN'S VERSION is random (its check evidence names it), so two runs are compared without it.
const sameVersion = (body) => JSON.parse(JSON.stringify(body).replace(/"version":"[^"]*"/g, '"version":"V"'));

/** A finished job's answer, as the poll route hands it back, from the row `edit_get` would read. */
async function poll(worker, env, id, row) {
  const wire = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/edit_get\b/.test(url)) return json({ ok: true, job: id, phase: null, needs_review: false, cancel: false, ms: 1000, error: null, ...row });
    return wire(input, init);
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: TOKEN } }), env, makeCtx());
    return { status: res.status, final: res.headers.get(FINAL_HEADER), body: await res.json().catch(() => null) };
  } finally { globalThis.fetch = wire; }
}

/** The row of a job `postRoute` ran: what it stored, and its money as the ledger left it. */
const doneRow = (slug, r, over = {}) => ({ slug, state: "done", billing: "finalized", cost: Number(r.body.cost) || 0, result: r.finalized.p_result, ...over });

/**
 * A QUEUED JOB'S REPLY IS WRITTEN IN THE BACKGROUND (2026-10-04, run 95's F2):
 * the job's end asks for it, one message goes to the queue, and the queue's
 * writer — never a poll — writes and keeps it. `Q` is the env with a queue
 * that keeps what is sent; `deliver` hands each kept message to the real
 * consumer, the job's own row answering the writer's read (`edit_get`).
 */
const QE = (store, sent) => ({ ...ON(store), BUILD_QUEUE: { async send(body, opts) { sent.push({ body, delaySeconds: (opts && opts.delaySeconds) || 0 }); } } });
const replyTasks = (sent) => sent.filter((m) => m.body && m.body.kind === "edit-reply");
async function deliver(worker, env, sent, row, { lateMs = 0 } = {}) {
  // A MESSAGE SENT WITH A WAIT IS DELIVERED AT ITS TIME (`lateMs`, 2026-10-04):
  // the clock is moved on by that much while the queue delivers it, as the
  // queue holds a delayed message until then. A retry delivered early is not
  // taken (`replyClaim`).
  const realNow = Date.now;
  if (lateMs > 0) Date.now = () => realNow() + lateMs;
  const wire = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/edit_get\b/.test(url)) return json({ ok: true, phase: null, needs_review: false, cancel: false, ms: 1000, error: null, ...row });
    return wire(input, init);
  };
  try {
    // THE MESSAGES QUEUED WHEN IT IS CALLED, and no others: one a delivery
    // sends — a retry with its wait — stays queued for a later call.
    for (const m of sent.splice(0, sent.length)) {
      const ctx = makeCtx();
      await worker.queue({ messages: [{ body: m.body, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending || []);
    }
  } finally { globalThis.fetch = wire; Date.now = realNow; }
}
/** A reply's record as kept. */
const recordOf = (store, id) => { const o = store.store.get("edit-replies/" + id + ".json"); return o ? JSON.parse(o.body) : null; };

/**
 * THE PAGE'S REQUESTS, ANSWERED BY THE REAL WORKER: each goes to its route with
 * the body the page composed, and every answer is kept (`log`) so a case can
 * hold what the page shows to what the Worker said.
 */
function toWorker(worker, env, log) {
  return (url, method, body) => worker.fetch(new Request("https://gofarther.dev" + url, {
    method, headers: { "content-type": "application/json", Authorization: TOKEN }, body: body === undefined ? undefined : JSON.stringify(body),
  }), env, makeCtx()).then(async (res) => {
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    log.push({ url, method, status: res.status, body: parsed });
    return { status: res.status, body: text };
  });
}
/** The page on a site that exists, its picker the one the supplied models answer for. */
function livePage(slug, worker, env, log, over = {}) {
  const p = page({ site: { id: "origin-" + slug, slug, react: true, name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [], ...over }, answer: toWorker(worker, env, log) });
  p.ctx.buildPicker = "sonnet";
  return p;
}
/** Until the page has finished with the message (or a bound): the Worker's own awaits run between. */
async function until(p, done, max = 400) {
  for (let i = 0; i < max && !done(); i++) await settle(5);
  assert.ok(done(), "the page never finished with the message: " + JSON.stringify(p.said()).slice(0, 400));
}
const answered = (p, n) => () => p.said().length >= n && p.busy() === false;

test("TWO POLLS AND TWO WRITERS AT ONCE KEEP ONE REPLY: no poll writes one; the same task delivered twice at once is claimed once — one model call — and every later read hands back that one", async () => {
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    const slug = freshSlug("race");
    const store = bucket(slug);
    const replies = [];
    const sent = [];
    await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC, [W]: writer(replies) }, async (seen) => {
      const r = await postRoute(worker, QE(store, sent), store, seen, slug, browserPost(SITE(slug), { intent: "edit", layer: "look" }, DESC_WORDS), "job");
      const id = r.finalized.p_id;
      const [a, b] = await Promise.all([poll(worker, QE(store, sent), id, doneRow(slug, r)), poll(worker, QE(store, sent), id, doneRow(slug, r))]);
      assert.deepEqual([a.body.replyState, b.body.replyState], ["pending", "pending"]);
      assert.equal(replyCalls(seen), 0, "a poll wrote a reply");
      assert.equal(replyTasks(sent).length, 1, "two polls asked for the reply again");
      // THE SAME TASK, TWICE AT ONCE: one claim, one call.
      const task = replyTasks(sent)[0];
      sent.length = 0;
      sent.push(task, { ...task });
      await Promise.all([deliver(worker, QE(store, sent), [sent[0]], doneRow(slug, r)), deliver(worker, QE(store, sent), [sent[1]], doneRow(slug, r))]);
      assert.equal(replyCalls(seen), 1, "two deliveries of one task both wrote a reply");
      const c = await poll(worker, QE(store, sent), id, doneRow(slug, r));
      const d = await poll(worker, QE(store, sent), id, doneRow(slug, r));
      assert.equal(c.body.replySource, "model");
      assert.equal(c.body.reply, d.body.reply);
      assert.equal(replyCalls(seen), 1);
    }, { slug });
  } finally { compiler.uninstall(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CANCELLATION
// ─────────────────────────────────────────────────────────────────────────────

test("CANCEL, ON THE PAGE: the question closes once on the server; the acknowledgement is written from what the cancel did and what the request had put off, and the page shows it alone; a cancel with nothing to close says why", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("cancel");
  const store = bucket(slug);
  const q = seedQuestion(store, slug, { held: ["add a gallery page"] });
  const log = [];
  const replies = [];
  await withWire({ [W]: writer(replies) }, async (seen) => {
    const p = livePage(slug, worker, ON(store), log, { ask: { id: q.id, text: Q.text, options: Q.options, attached: false }, msgs: [{ r: "u", t: "Move the order band up" }, { r: "a", t: Q.text, q: Q.text, opts: Q.options, ask: q.id }] });
    p.click("data-ask-cancel", "1");
    await until(p, () => log.length === 1 && p.busy() === false && p.said().length >= 4);
    const [c] = log;
    assert.equal(c.url, "/api/site/" + slug + "/question");
    assert.equal(c.body.cancelled, true);
    assert.deepEqual(c.body.putOff, ["add a gallery page"]);
    assert.equal(question(store, slug).status, "cancelled");
    assert.deepEqual(replies[0].facts.map((f) => f.id), ["c1", "x1", "p1"]);
    assert.equal(replies[0].facts[2].text, "Left for later and never tried, so it is not done either: “add a gallery page”");
    assert.equal(p.last().t, c.body.reply, "the page added to the acknowledgement, or did not show it");
    assert.equal(p.ask(), null, "the cancelled question kept its card");
    assert.deepEqual(seen.debits, [], "a cancel was charged");
    // AGAIN: nothing left to cancel, said as that.
    const again = await questionCall(worker, ON(store), slug, "POST", { id: q.id, cancel: true, picker: "sonnet" });
    assert.equal(again.body.cancelled, false);
    assert.equal(again.body.why, "closed");
    assert.match(replies[1].facts[0].text, /^There was nothing to cancel/);
    assert.equal(again.body.replySource, "model");
  }, { slug });
});

test("A QUEUED CHANGE STOPPED AT THE CUSTOMER'S CANCEL: its stored answer is an ordinary outcome at its 503, so its acknowledgement is written — asked for by the first read that finds none, written by the queue — nothing published, nothing charged — and a stop that is ours keeps its fixed sentence", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("job-cancel");
  const store = bucket(slug);
  const replies = [];
  const sent = [];
  await withWire({ [W]: writer(replies) }, async (seen) => {
    const replyFor = { kind: "edit", request: "Make the header button forest green.", answers: [], picker: "sonnet", routedCost: 2, slug, pages: ["/", "/visit"] };
    const stopped = { ok: false, error: "cancelled", phase: "build", cost: 0, refunded: 1, msg: "I stopped that edit before anything was published.", replyFor };
    const id = "c".repeat(32);
    const row = { slug, state: "cancelled", billing: "refunded", cost: 1, result: { status: 503, body: JSON.stringify(stopped), type: "application/json" } };
    // ITS END CANNOT BE TOLD HERE — this wire does not serve the job table —
    // so a read that finds no record asks for the reply once, as for a job
    // that just ended (BG8 in test/reply-background.test.mjs: one read hours
    // after its end asks nothing).
    const p0 = await poll(worker, QE(store, sent), id, row);
    assert.equal(p0.body.replyState, "pending", "a read that found no reply did not ask for one");
    assert.equal(replies.length, 0, "a read wrote the reply");
    assert.equal(replyTasks(sent).length, 1);
    await deliver(worker, QE(store, sent), sent, row);
    const p = await poll(worker, QE(store, sent), id, row);
    assert.equal(p.status, 503, "the stored status moved");
    assert.equal(p.body.replySource, "model", "a cancel at its 503 was read as a failure of ours");
    assert.equal(p.body.cost, 0);
    assert.equal(p.body.refunded, 1);
    assert.deepEqual(replies[0].facts.map((f) => f.text), [
      "The change was not made. The builder's own reason: “I stopped that edit before anything was published.”",
      "This change cost them nothing.",
      // THE LEDGER'S REFUND, SAID (2026-10-25, run 6): the reserve was given back.
      "Given back: one credit held for this change.",
      "Reading their message cost 2 credits.",
    ]);
    assert.equal(editBrowserReply(p.body, false, {}).text, p.body.reply);
    // A STOP THAT IS OURS — the service shut down under the job — keeps its sentence: nothing to say, kept so, nothing asked.
    const ours = { ...stopped, error: "stopped", msg: "That change was stopped before it could publish — the service running it was shut down or ran past its time limit. Send it again in a few minutes." };
    const p2 = await poll(worker, QE(store, sent), "d".repeat(32), { slug, state: "failed", billing: "refunded", cost: 1, result: { status: 503, body: JSON.stringify(ours), type: "application/json" } });
    assert.equal(p2.body.reply, undefined, "a failure of ours was given a model's reply");
    assert.equal(p2.body.replyState, undefined, "a failure of ours was said to be waiting for a reply");
    assert.equal(replyTasks(sent).length, 0, "a reply was asked for a failure of ours");
    assert.equal(recordOf(store, "d".repeat(32)).state, "none");
    assert.equal(replies.length, 1);
    assert.match(editBrowserReply(p2.body, false, {}).text, /^That change was stopped before it could publish/);
    assert.equal(Object.hasOwn(p2.body, "replyFor"), false);
  }, { slug });
});
