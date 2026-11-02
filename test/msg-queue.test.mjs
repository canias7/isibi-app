// THE MESSAGE QUEUE (2026-11-02, owner: "lets bring back the message queue").
//
// A message sent on a site while the agent still works on an earlier one waits
// in line ("Queued" under its bubble) and runs right after, never at the same
// time, first in first out, as its own request with its own reply.
//
// The REAL Worker against `test/fixtures/request-flow.mjs`, supplied model
// answers only.
//
//   MQ1  "add a gallery" (its job not yet run), then "hey" 10 s later: hey is
//        filed queued with no job; a reload (GET) and a tick keep it queued;
//        once the gallery's job ends, hey's job is filed and runs; two
//        requests, two replies, in order; the agent never ran them together.
//   MQ2  a first request paused for credits does not hold the line: hey
//        starts at once.
//   MQ3  a split message queued behind another still runs its parts side by
//        side once it starts.
//   MQ4  the rule, pure: what holds the line, FIFO, release.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, tick } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { PAGES } from "./fixtures/live-ask.mjs";

delete process.env.GF_OLD_LANES;
const RQ = await import("../builder/request.mjs");

const isAgent = (args) => (args.tools || []).some((t) => t.name === "finish");
const said = (args) => JSON.stringify(args.messages && args.messages[0] && args.messages[0].content);
const use = (name, input) => ({ type: "tool_use", id: "t" + Math.random().toString(16).slice(2, 10), name, input });
const GALLERY = "Added a gallery section to the home page.";
const HEY = "Hey! The gallery is in. What next?";

function model(pick, log) {
  return (args) => {
    if (!isAgent(args)) { log.other++; return { __raw: { stop_reason: "end_turn", content: [{ type: "text", text: "NOT THE AGENT" }] } }; }
    log.calls.push(said(args));
    const r = pick(args, (args.messages || []).filter((m) => m.role === "assistant").length);
    return { __raw: { stop_reason: r.stop || "tool_use", content: r.content } };
  };
}
const plainAnswer = (args) => ({ stop: "end_turn", content: [{ type: "text", text: /REQUEST\\n(hey)/.test(said(args)) ? HEY : GALLERY }] });

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform({ slug: "mq-" + Math.random().toString(16).slice(2, 8), beside: true, balance: 400, ...opts });
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const replyOf = async (P, key) => {
  await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
  const g = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
  return (g.body.request && g.body.request.reply) || g.body.reply;
};

test("MQ1 \"add a gallery\" then \"hey\" 10 s later: hey waits queued (reload and tick too), starts only after the gallery ends, two replies in order", async () => {
  const log = { calls: [], other: 0 };
  await withPlatform({ answers: { "": model(plainAnswer, log) } }, async (P) => {
    const a = await sendMessage(P, { message: "add a gallery" });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.ok(!a.body.request.queued, "the first message was queued behind nothing");
    assert.equal(P.jobsOf(a.key).length, 1, "the gallery's job was not filed");
    P.advance(10000);
    await new Promise((ok) => setTimeout(ok, 5));
    const b = await sendMessage(P, { message: "hey" });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.request.key, b.key, "hey is not its own request");
    assert.equal(b.body.request.queued, true, "hey was not queued: " + JSON.stringify(b.body.request));
    assert.equal(P.record(b.key).queued, true);
    assert.equal(P.jobsOf(b.key).length, 0, "hey's job was filed while the gallery ran");
    assert.equal(P.ledger.filter((l) => String(l.ref || "").startsWith(b.key)).length, 0, "hey was charged while queued");
    // A RELOAD (the page's read) AND THE SWEEP KEEP IT IN LINE.
    const g = await call(P, "GET", "/api/site/request/" + P.slug + "/" + b.key);
    assert.equal(g.body.request.queued, true, "a reload lost the queued state");
    await tick(P);
    assert.equal(P.record(b.key).queued, true, "the sweep started hey while the gallery ran");
    assert.equal(P.jobsOf(b.key).length, 0);
    assert.equal(log.calls.length, 0, "an agent ran before the queue was delivered");
    // THE GALLERY'S JOB RUNS AND ENDS: hey is started by that ending.
    const ra = (await settle(P, a.key, { rounds: 20 })).rec;
    assert.equal(ra.ended, true, JSON.stringify(ra.parts));
    const hj = P.jobsOf(b.key);
    assert.equal(hj.length, 1, "hey was not started when the gallery ended");
    const gj = P.jobsOf(a.key)[0];
    assert.ok(hj[0].created_at >= gj.updated_at, "hey's job was filed before the gallery's ended");
    const rb = (await settle(P, b.key, { rounds: 20 })).rec;
    assert.equal(rb.ended, true);
    assert.equal(rb.queued, false);
    assert.equal(rb.parts.length, 1);
    // THE AGENT RAN THEM ONE AFTER THE OTHER, gallery first.
    assert.equal(log.calls.length, 2, JSON.stringify(log.calls));
    assert.match(log.calls[0], /add a gallery/);
    assert.match(log.calls[1], /hey/);
    // TWO REPLIES, EACH ITS OWN.
    assert.ok((await replyOf(P, a.key)).text.startsWith(GALLERY));
    assert.ok((await replyOf(P, b.key)).text.startsWith(HEY));
  });
});

test("MQ2 a first request paused for credits (or waiting on the owner) does not hold the line: hey starts at once", async () => {
  const log = { calls: [], other: 0 };
  await withPlatform({ answers: { "": model(plainAnswer, log) } }, async (P) => {
    const a = await sendMessage(P, { message: "add a gallery" });
    assert.equal(a.status, 200);
    // ITS PART PAUSED FOR CREDITS, as `nextStep` records it, and its job gone.
    const k = RQ.recordKey(P.slug, a.key);
    const rec = P.record(a.key);
    rec.parts[0].status = "credits";
    await P.env.SITES_BUCKET.put(k, JSON.stringify(RQ.settleState(rec)));
    assert.equal(P.record(a.key).state, "credits");
    P.queue.length = 0;
    const b = await sendMessage(P, { message: "hey" });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.ok(!b.body.request.queued, "hey waited behind a paused request");
    assert.equal(P.jobsOf(b.key).length, 1, "hey's job was not filed");
  });
});

test("MQ3 a split message queued behind another runs its parts side by side once it starts", async () => {
  const log = { calls: [], other: 0 };
  const SPLIT = [
    { instruction: "On the home page, change the main heading to: Fresh Bread Daily", pages: ["/"] },
    { instruction: "On the visit page, add our opening hours: Mon-Sat 7am-3pm", pages: ["/visit"] },
  ];
  const pick = (args) => {
    const t = said(args);
    if (/add a gallery/.test(t)) return plainAnswer(args);
    const k = SPLIT.findIndex((s) => t.includes(s.instruction));
    if (k < 0) return { content: [use("split_work", { parts: SPLIT })] };
    return { stop: "end_turn", content: [{ type: "text", text: "Done: " + SPLIT[k].pages[0] }] };
  };
  await withPlatform({ pages: PAGES, answers: { "": model(pick, log) } }, async (P) => {
    const a = await sendMessage(P, { message: "add a gallery" });
    const b = await sendMessage(P, { message: "Change the home heading and put opening hours on the visit page" });
    assert.equal(b.body.request.queued, true, JSON.stringify(b.body.request));
    await settle(P, a.key, { rounds: 20 });
    const done = (await settle(P, b.key, { rounds: 20 })).rec;
    assert.equal(done.ended, true);
    assert.equal(done.queued, false);
    // THE SPLITTER'S OWN JOB, THEN ITS TWO PARTS FILED TOGETHER, before either ended.
    const kids = P.jobsOf(b.key).slice(1);
    assert.equal(kids.length, 2, JSON.stringify(done.parts.map((p) => [p.n, p.status])));
    assert.ok(Math.max(...kids.map((j) => j.created_at)) <= Math.min(...kids.map((j) => j.updated_at)), "a part was filed only after the other ended");
    assert.ok(P.jobsOf(b.key)[0].created_at >= P.jobsOf(a.key)[0].updated_at, "the split message started before the gallery ended");
  });
});

test("MQ5 ✕ on a queued message: the request's stop ends it with no job and no charge, and the next in line still runs after the first", async () => {
  const log = { calls: [], other: 0 };
  await withPlatform({ answers: { "": model(plainAnswer, log) } }, async (P) => {
    const a = await sendMessage(P, { message: "add a gallery" });
    const b = await sendMessage(P, { message: "change the footer" });
    const c = await sendMessage(P, { message: "hey" });
    assert.equal(b.body.request.queued, true);
    assert.equal(c.body.request.queued, true);
    const del = await call(P, "DELETE", "/api/site/request/" + P.slug + "/" + b.key);
    assert.equal(del.status, 200, JSON.stringify(del.body));
    const rb = P.record(b.key);
    assert.equal(rb.ended, true, JSON.stringify(rb.parts));
    assert.equal(del.body.request.dropped, true, "the cancelled queued message is not marked dropped");
    assert.equal(P.jobsOf(b.key).length, 0, "a cancelled queued message filed a job");
    assert.equal(P.ledger.filter((l) => String(l.ref || "").startsWith(b.key)).length, 0);
    assert.equal(P.record(c.key).queued, true, "hey jumped the running gallery");
    await settle(P, a.key, { rounds: 20 });
    const rc = (await settle(P, c.key, { rounds: 20 })).rec;
    assert.equal(rc.ended, true);
    assert.equal(log.calls.length, 2, "the cancelled message ran: " + JSON.stringify(log.calls));
  });
});

test("MQ4 the rule: running and earlier-queued requests hold the line; credits, questions, ended and old ones do not; FIFO", () => {
  const now = Date.now();
  const R = (key, at, status, extra = {}) => RQ.settleState({ key, slug: "s", uid: "u", at, parts: [{ n: 0, status, jobs: [] }], ...extra }, now);
  const late = { ...R("rqz", now, "ready"), queued: true };
  assert.deepEqual(RQ.queueBlockers(late, [R("rqa", now - 5, "started")]), ["rqa"]);
  assert.deepEqual(RQ.queueBlockers(late, [R("rqa", now - 5, "credits")]), []);
  assert.deepEqual(RQ.queueBlockers(late, [R("rqa", now - 5, "waiting")]), []);
  assert.deepEqual(RQ.queueBlockers(late, [R("rqa", now - 5, "done")]), []);
  assert.deepEqual(RQ.queueBlockers(late, [R("rqa", now - RQ.QUEUE_HOLD_MS - 1, "started")]), [], "a request stuck past the hold keeps the line for ever");
  assert.deepEqual(RQ.queueBlockers(late, [{ ...R("rqa", now - 5, "ready"), queued: true }]), ["rqa"], "an earlier queued one keeps its place");
  assert.deepEqual(RQ.queueBlockers(late, [R("rqb", now + 5, "started")]), [], "a later request held an earlier one");
  assert.deepEqual(RQ.queueBlockers(late, [{ ...R("rqa", now - 5, "started"), uid: "other" }]), []);
  assert.deepEqual(RQ.queueBlockers({ ...late, queued: false }, [R("rqa", now - 5, "started")]), [], "a request already started never waits");
  const out = RQ.releaseQueue(late, now);
  assert.equal(out.queued, false); assert.equal(out.startedAt, now);
  assert.equal(RQ.releaseQueue(out), null);
  assert.equal(RQ.requestView({ ...late, parts: [{ n: 0, words: "hey", status: "ready", jobs: [] }] }).queued, true);
});
