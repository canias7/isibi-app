// A FINISHED JOB'S REPLY, WRITTEN IN THE BACKGROUND (2026-10-04, run 95's F2,
// on the owner's word: *"implement option B using the existing server job and
// recovery machinery: generate and persist the model-written reply after the
// job's outcome and billing are final, independently of browser polling,
// without delaying later request parts or rerunning completed work."*)
//
// EVERY CASE RUNS THE REAL WORKER on the stateful platform
// (`test/fixtures/request-flow.mjs`): the routing route, the queue consumer
// that runs each part's job and each reply task, the job poll, the request
// read, the two-minute cron and the job gateway — against an `edit_jobs`
// table, a ledger, a bucket with etags and a queue that keep state as the real
// ones do. The reply writer's pace and faults are the case's (`replyWith`):
// held for real time, refused as a provider refuses, or answered.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer — the router's, each lane's,
// the add-on's, the reply writer's — is supplied. Nothing here shows how long
// a real model takes, or what it writes; that is the live verification's.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { platform, sendMessage, pump, tick, call, settle, readWritten, deliver, pumpBeside, heldFor, T, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { gatewayHandler, gatewayKey, signJobToken, verifyJobToken, preScopeSlug } from "../builder/job-gateway.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { REPLY_LEASE_MS, REPLY_BG_ATTEMPTS, REPLY_BG_RETRY_S, REPLY_CALL_MS, REPLY_RETRY_GRACE_MS, REPLY_RETRY_SKEW_MS, REPLY_HORIZON_MS, replyClaim } from "../builder/site-reply.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const TWO = { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY };
const MESSAGE = DESC + ", and " + ADD + ".";
const slugOf = (k) => "rb-" + k + "-" + Math.random().toString(16).slice(2, 8);

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
/** A job's reply record as the bucket holds it. */
const replyRec = (P, id) => { const o = P.objects.get("edit-replies/" + id + ".json"); return o ? JSON.parse(o.body) : null; };
/** How many calls the reply writer has taken. */
const writes = (P) => P.modelLog.filter((m) => m.tool === "write_reply").length;
const isReplyTask = (m, id) => !!(m && m.body && m.body.kind === "edit-reply" && (id === undefined || m.body.id === id));
const poll = (P, id) => call(P, "GET", "/api/site/edit/" + id);
/** Part 0's facts: its step changed the description (the add-on part's never say so). */
const part0 = (facts) => facts.some((f) => f.text.startsWith("Changed the description"));
/**
 * Everything the work left behind — the site, the jobs, the money — for
 * comparing two runs: each job's id, which is random, read as its op and place.
 */
const workOf = (P, key) => {
  const jobs = P.jobsOf(key);
  const named = (ref) => jobs.reduce((t, j, i) => t.split(j.id).join(j.op + "@" + i), String(ref));
  return JSON.stringify({ look: P.look(), pages: P.pages(), jobs: jobs.map((j) => [j.op, j.state, j.billing, j.cost, j.result && j.result.body]), ledger: P.ledger.map((e) => [named(e.ref), e.reason, e.delta]) });
};

// ─────────────────────────────────────────────────────────────────────────────

test("BG1 — a reply that takes 13 s, longer than the 12 s that cut run 95's, is written in the background: the request's next part runs and finishes meanwhile, every read while it is written says so without calling the model, and the reply is there afterwards", async () => {
  const HOLD = 13000;
  assert.ok(HOLD > 12000, "the case no longer holds the reply past run 95's ceiling");
  let heldMs = null;
  await withPlatform({
    slug: slugOf("bg1"), replies: true, answers: TWO,
    replyWith: async ({ facts, signal }) => {
      if (!part0(facts) || heldMs !== null) return;
      const t0 = Date.now();
      heldMs = -1;
      await heldFor(HOLD, signal);
      heldMs = Date.now() - t0;
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    // THE QUEUE RUNS PART 0'S JOB, THEN ITS REPLY TASK BESIDE EVERYTHING AFTER IT.
    const running = await pumpBeside(P, (m) => isReplyTask(m, job0));
    assert.equal(running.length, 1, "part 0's reply task was not sent");
    // WHILE IT IS BEING WRITTEN: the request has finished every part.
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], "a later part waited on part 0's reply");
    assert.equal(rec.ended, true);
    assert.equal(heldMs, -1, "the held reply call never started");
    assert.equal(replyRec(P, job0).state, "writing");
    // AND A READ, HOWEVER OFTEN, SAYS SO — no model call, nothing asked again.
    const calls = writes(P);
    const queued = P.queue.length;
    for (let i = 0; i < 3; i++) {
      const p = await poll(P, job0);
      assert.equal(p.status, 200);
      assert.equal(p.body.replyState, "pending");
      assert.equal(p.body.reply, undefined);
      assert.equal(p.headers.get(EditPoll.FINAL_HEADER), EditPoll.FINAL_VALUE, "the job's outcome was not said to be final");
      assert.deepEqual(EditPoll.readPoll(p.status, p.headers.get(EditPoll.FINAL_HEADER), p.body), { act: "wait", kind: "reply" });
      // WHAT THE JOB DID, IN ONE WORD, from the reply's own facts: the page
      // holds the reply's place with the line for it (2026-10-04).
      assert.equal(p.body.replyOutcome, "done");
      assert.equal(EditPoll.pendingReplyLine(p.body), "Done — writing up what changed…");
      assert.equal(EditPoll.waitingMessage(p.body), "", "a finished job's held reply was painted as a job still waiting");
    }
    assert.equal(writes(P), calls, "a read called the model");
    assert.equal(P.queue.length, queued, "a read asked for another reply while one was being written");
    // AFTER 13 s: written, once, and handed back to every read.
    await Promise.all(running);
    assert.ok(heldMs >= HOLD - 50, "the reply did not take as long as it was held: " + heldMs);
    assert.ok(heldMs > REPLY_CALL_MS / 3 && heldMs > 12000, "the case does not exceed run 95's 12 s ceiling");
    const done = replyRec(P, job0);
    assert.deepEqual([done.state, done.attempts], ["written", 1], JSON.stringify(done));
    const p = await poll(P, job0);
    assert.equal(p.body.replySource, "model");
    assert.equal(p.body.reply, done.text);
    assert.deepEqual(EditPoll.readPoll(p.status, p.headers.get(EditPoll.FINAL_HEADER), p.body), { act: "reply" });
  });
});

test("BG2 — the provider refuses every try: three tries, 30 s and 120 s apart, then the reply is failed and the page says what it always said; no fourth call, and the work, the money and the site are exactly as when the reply was written", async () => {
  // THE SAME REQUEST WITH THE WRITER WORKING, for the comparison.
  let fine = null;
  await withPlatform({ slug: "rb-bg2-same", replies: true, answers: TWO }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE, key: "rqbg2samekey00000000" });
    await settle(P, r.key);
    fine = workOf(P, r.key);
  });
  await withPlatform({ slug: "rb-bg2-same", replies: true, answers: TWO, replyWith: () => ({ status: 500 }) }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE, key: "rqbg2samekey00000000" });
    // EACH RETRY IS DELIVERED AT ITS TIME (`due`), as the queue holds it: the
    // first tries now, the second 30 s on, the third 120 s after that.
    const { rec } = await settle(P, r.key, { due: true });
    assert.deepEqual(statuses(rec), ["done", "done"], "a reply that could not be written stopped the request");
    for (const wait of REPLY_BG_RETRY_S) { P.advance(wait * 1000); await pump(P, { due: true }); }
    const jobs = P.jobsOf(r.key).filter((j) => j.op !== "route").map((j) => j.id);
    let tries = 0;
    for (const id of jobs) {
      const rr = replyRec(P, id);
      assert.deepEqual([rr.state, rr.attempts], ["failed", REPLY_BG_ATTEMPTS], id + ": " + JSON.stringify(rr));
      tries += rr.attempts;
      // EACH TRY'S MESSAGE WAS SENT WITH ITS WAIT: at once, then 30 s, then 120 s.
      assert.deepEqual(P.sent.filter((m) => isReplyTask(m, id)).map((m) => m.delaySeconds), [0, ...REPLY_BG_RETRY_S], id);
    }
    assert.equal(writes(P), tries, "a try made more than its one call, or a call was made past the tries");
    // THE PAGE: the reply failed, so the browser says it the old way — never a bare failure.
    const p = await poll(P, jobs[0]);
    assert.equal(p.body.replyState, "failed");
    assert.equal(p.body.reply, undefined);
    assert.deepEqual(EditPoll.readPoll(p.status, p.headers.get(EditPoll.FINAL_HEADER), p.body), { act: "reply" });
    assert.match(editBrowserReply(p.body, true, {}).text, /^✅ /);
    // ASKED AGAIN, NOTHING MORE: a failed reply is not tried a fourth time by a read or the cron.
    await poll(P, jobs[0]);
    await tick(P);
    await pump(P);
    assert.equal(writes(P), tries, "a failed reply was tried again");
    // THE WORK, THE MONEY AND THE SITE: as when the reply was written.
    assert.equal(workOf(P, r.key), fine);
  });
});

test("BG3 — two deliveries of one reply task and three reads at once while it is written: one model call, one reply, and every read after hands back the same text", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  await withPlatform({
    slug: slugOf("bg3"), replies: true, answers: TWO,
    replyWith: async ({ facts }) => { if (part0(facts)) await gate; },
  }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    await pump(P, { max: 1 });
    const at = P.queue.findIndex((m) => isReplyTask(m, job0));
    assert.ok(at >= 0, "part 0's reply task was not sent");
    const [task] = P.queue.splice(at, 1);
    // THE QUEUE DELIVERS IT TWICE (at least once is its promise), AND THREE READS LAND.
    const both = [deliver(P, task), deliver(P, task)];
    // AND A THIRD DELIVERY ARRIVES ONCE THE CLAIM HAS LANDED — past the
    // conditional write that settles two at once, so only the claim's own
    // lease keeps it from writing again.
    for (let i = 0; i < 400 && (replyRec(P, job0) || {}).state !== "writing"; i++) await new Promise((ok) => setTimeout(ok, 5));
    assert.equal(replyRec(P, job0).state, "writing", "the first writer's claim never landed");
    both.push(deliver(P, task));
    const reads = await Promise.all([poll(P, job0), poll(P, job0), poll(P, job0)]);
    for (const p of reads) assert.equal(p.body.replyState, "pending");
    release();
    await Promise.all(both);
    const part0Calls = P.replyLog.filter(part0).length;
    assert.equal(part0Calls, 1, "two writers both called the model");
    const rr = replyRec(P, job0);
    assert.deepEqual([rr.state, rr.attempts], ["written", 1], JSON.stringify(rr));
    assert.equal(P.queue.filter((m) => isReplyTask(m, job0)).length, 0, "a read or the second delivery asked for it again");
    const after = await Promise.all([poll(P, job0), poll(P, job0)]);
    for (const p of after) assert.equal(p.body.reply, rr.text);
    assert.equal(P.replyLog.filter(part0).length, 1);
  });
});

test("BG4 — the consumer dies just after the job's money is final and before its reply is asked: the job is not run again, and the two-minute cron asks for the reply, which the queue writes", async () => {
  await withPlatform({ slug: slugOf("bg4"), replies: true, answers: TWO }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    P.hang("edit_finalize", (args) => args.p_id === job0);
    const died = await pump(P, { max: 1 });
    assert.equal(died.hung, "edit_finalize");
    P.recover();
    const row = P.jobs.get(job0);
    assert.equal(row.state, "done", "the finalize did not land before the crash");
    assert.equal(replyRec(P, job0), null, "a reply was asked before the crash");
    assert.equal(P.queue.filter((m) => isReplyTask(m, job0)).length, 0);
    const lanes = P.modelLog.filter((m) => m.tool === T.lane).length;
    const ledger = P.ledger.length;
    // THE CRON: it finds the ended job with no reply, and asks.
    await tick(P);
    const asked = replyRec(P, job0);
    assert.ok(asked && asked.state === "pending", JSON.stringify(asked));
    await settle(P, r.key);
    const rr = replyRec(P, job0);
    assert.equal(rr.state, "written", JSON.stringify(rr));
    const p = await poll(P, job0);
    assert.equal(p.body.replySource, "model");
    // NOTHING RUN OR CHARGED AGAIN FOR PART 0.
    assert.equal(P.modelLog.filter((m) => m.tool === T.lane).length, lanes, "part 0's step ran again");
    assert.ok(!P.ledger.slice(ledger).some((e) => e.ref.startsWith(job0)), "part 0 was charged again");
  });
});

test("BG5 — a writer evicted after its claim landed: no read takes the reply from it while its claim holds; once the claim has run out, the cron asks again and the next delivery writes it, on its second try", async () => {
  await withPlatform({ slug: slugOf("bg5"), replies: true, answers: TWO }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    await pump(P, { max: 1 });
    const at = P.queue.findIndex((m) => isReplyTask(m, job0));
    const [task] = P.queue.splice(at, 1);
    // THE CLAIM LANDS, AND ITS WRITER IS GONE (the state a writer evicted mid-call leaves).
    P.hangPut((k, body) => k === "edit-replies/" + job0 + ".json" && String(body).includes('"writing"'));
    assert.equal(await deliver(P, task), "hung");
    P.recover();
    const held = replyRec(P, job0);
    assert.deepEqual([held.state, held.attempts], ["writing", 1]);
    assert.ok(held.lease && held.lease.until > P.now());
    assert.equal(P.replyLog.filter(part0).length, 0, "the evicted writer called the model");
    // A READ WHILE THE CLAIM HOLDS: pending, and nothing asked.
    const queued = P.queue.filter((m) => isReplyTask(m, job0)).length;
    assert.equal((await poll(P, job0)).body.replyState, "pending");
    assert.equal(P.queue.filter((m) => isReplyTask(m, job0)).length, queued, "a read took the reply from a writer whose claim holds");
    // THE CLAIM RUNS OUT; THE CRON ASKS AGAIN.
    P.advance(REPLY_LEASE_MS + 1000);
    await tick(P);
    assert.ok(P.queue.some((m) => isReplyTask(m, job0)), "the cron did not ask again for a reply whose writer was gone");
    await settle(P, r.key);
    const rr = replyRec(P, job0);
    assert.deepEqual([rr.state, rr.attempts], ["written", 2], JSON.stringify(rr));
    assert.equal((await poll(P, job0)).body.replySource, "model");
  });
});

test("BG6 — a job that ended in the site's container asks for its reply through the gateway's /reply, under its own token: the Worker makes the record once and the queue writes it; a pre-scoped build, a missing token or replies off ask for nothing", async () => {
  const JOB = "1".repeat(8) + "-2222-3333-4444-" + "5".repeat(12);
  // ── THE CONTAINER'S SIDE: its own gateway, its own token, nothing it names.
  const posts = [];
  const jobEnv = makeContainerEnv({
    gateway: { url: "https://gofarther.dev/api/job/" + JOB, token: "the-job-token" },
    fetch: async (url, init) => { posts.push({ url: String(url), init }); return new Response("{}", { status: 200 }); },
  });
  assert.equal(typeof jobEnv.JOB_REPLY, "function", "a site job in the container has no way to ask for its reply");
  assert.equal(await jobEnv.JOB_REPLY(), true);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://gofarther.dev/api/job/" + JOB + "/reply");
  assert.equal(posts[0].init.method, "POST");
  assert.equal(new Headers(posts[0].init.headers).get("authorization"), "Bearer the-job-token");
  assert.equal(makeContainerEnv({ gateway: { url: "https://gofarther.dev/api/job/" + JOB, token: "t" }, pre: true, fetch: async () => new Response("{}") }).JOB_REPLY, undefined);
  // ── THE GATEWAY: the token's own id and owner; nothing else.
  const gk = await gatewayKey("platform-secret");
  const asked = [];
  const handle = gatewayHandler({ bucket: { async get() { return null; } }, verify: (t) => verifyJobToken(t, gk, Date.now()), reply: async (a) => { asked.push(a); return true; } });
  const exp = Math.floor(Date.now() / 1000) + 600;
  const tok = await signJobToken({ id: JOB, slug: "fold-lane", uid: USER.id, exp }, gk);
  const post = (token, h = handle, id = JOB) => h(new Request("https://gofarther.dev/api/job/" + id + "/reply", {
    method: "POST", headers: { ...(token ? { authorization: "Bearer " + token } : {}), "content-type": "application/json" }, body: "{}",
  }), id);
  assert.equal((await post(tok)).status, 200);
  assert.deepEqual(asked, [{ id: JOB, uid: USER.id }]);
  assert.equal((await post(null)).status, 401);
  assert.equal((await post(await signJobToken({ id: JOB, slug: preScopeSlug(JOB), uid: USER.id, exp, pre: true }, gk))).status, 403, "a pre-scoped build asked for a reply");
  assert.equal((await post(tok, gatewayHandler({ bucket: { async get() { return null; } }, verify: (t) => verifyJobToken(t, gk, Date.now()) }))).status, 503);
  assert.equal((await post(tok, gatewayHandler({ bucket: { async get() { return null; } }, verify: (t) => verifyJobToken(t, gk, Date.now()), reply: async () => false }))).status, 409);
  assert.equal(asked.length, 1, "a refused call reached the Worker's step");
  // ── THE WORKER'S OWN MOUNT AND THE CONSUMER: a job run with the container's
  // way of asking (`JOB_REPLY`) asks through it and not the queue; the mount
  // then makes the record, once, and the queue writes it.
  await withPlatform({ slug: slugOf("bg6"), replies: true, answers: TWO }, async (P) => {
    P.env.SITE_SECRETS_KEY = "platform-secret";
    let viaGateway = 0;
    P.env.JOB_REPLY = async () => { viaGateway++; return true; };
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    await pump(P, { max: 1 });
    assert.equal(viaGateway, 1, "the consumer did not ask through the container's way");
    assert.equal(replyRec(P, job0), null, "the consumer asked the queue directly as well");
    delete P.env.JOB_REPLY;
    const sign = (p) => signJobToken({ exp, ...p }, gk);
    const ask = async () => call(P, "POST", "/api/job/" + job0 + "/reply", {}, "Bearer " + await sign({ id: job0, slug: P.slug, uid: USER.id }));
    const a1 = await ask();
    assert.equal(a1.status, 200, JSON.stringify(a1.body));
    assert.equal((await ask()).status, 200);
    assert.equal(replyRec(P, job0).state, "pending");
    assert.equal(P.queue.filter((m) => isReplyTask(m, job0)).length, 1, "asked twice, two tasks were sent");
    await settle(P, r.key);
    assert.equal(replyRec(P, job0).state, "written");
    assert.equal((await poll(P, job0)).body.replySource, "model");
    // REPLIES OFF: the mount asks for nothing.
    delete P.env.MODEL_REPLIES;
    assert.equal((await ask()).status, 409);
  });
});

test("BG7 — a page that reloads, or opens on another device, while the reply is being written reads it pending; once written, every page reads the same text — none of them calls the model, and nothing in the page holds the reply but the server's record", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  await withPlatform({ slug: slugOf("bg7"), replies: true, answers: TWO, replyWith: async ({ facts }) => { if (part0(facts)) await gate; } }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    const running = await pumpBeside(P, (m) => isReplyTask(m, job0));
    // A RELOAD, AND ANOTHER DEVICE: each a fresh read with nothing of its own.
    // (Part 0's held call is already counted: the writer took it before the hold.)
    const before = writes(P);
    assert.equal(P.replyLog.filter(part0).length, 0, "part 0's reply was written before the hold");
    for (let i = 0; i < 2; i++) assert.equal((await poll(P, job0)).body.replyState, "pending");
    release();
    await Promise.all(running);
    const texts = new Set();
    for (let i = 0; i < 2; i++) {
      const p = await readWritten(P, "/api/site/edit/" + job0);
      assert.equal(p.body.replySource, "model");
      texts.add(p.body.reply);
    }
    assert.equal(texts.size, 1, "two pages read two replies");
    assert.equal(writes(P), before, "a page's read called the model");
    assert.equal(P.replyLog.filter(part0).length, 1);
    assert.equal(replyRec(P, job0).text, [...texts][0]);
  });
});

test("BG8 — a job whose reply was never asked is asked for by the first read inside two hours of its end; read after that, it gets its plain answer and nothing is asked — its end read off its row, never from how long it ran", async () => {
  for (const late of [false, true]) {
    await withPlatform({ slug: slugOf(late ? "bg8-late" : "bg8-soon"), replies: true, answers: TWO }, async (P) => {
      const r = await sendMessage(P, { message: MESSAGE });
      const job0 = P.jobsOf(r.key)[0].id;
      // THE ASK IS LOST: the consumer dies just after the money is final.
      P.hang("edit_finalize", (args) => args.p_id === job0);
      assert.equal((await pump(P, { max: 1 })).hung, "edit_finalize");
      P.recover();
      assert.equal(replyRec(P, job0), null);
      const queued = () => P.queue.filter((m) => isReplyTask(m, job0)).length;
      if (late) P.advance(3 * 3600 * 1000);
      const p = await poll(P, job0);
      assert.equal(p.status, 200);
      if (late) {
        assert.equal(p.body.replyState, undefined, "a reply was promised for a job that ended hours ago");
        assert.equal(p.body.reply, undefined);
        assert.equal(queued(), 0, "a read asked for the reply of a job that ended hours ago");
        assert.equal(replyRec(P, job0), null, "a read made a record for a job that ended hours ago");
        assert.match(editBrowserReply(p.body, true, {}).text, /^✅ /, "the page did not say what it always said");
      } else {
        assert.equal(p.body.replyState, "pending");
        assert.equal(queued(), 1, "the read did not ask for the reply");
        await settle(P, r.key);
        assert.equal((await poll(P, job0)).body.replySource, "model");
      }
    });
  }
});

// ── THE OWNER'S REVIEW (2026-10-04): A RETRY IS TAKEN AT ITS TIME ────────────
//
// The claim took a waiting record whatever its next try's time: an attempt-1
// record due at 32 000 was claimed at 2 500 as attempt 2, so an early or
// duplicate delivery spent a try and skipped the wait. The rule at the claim
// is `replyClaim`; the cases below drive it through the queue's consumer.

test("BG9 — the rule at the claim (`replyClaim`): the owner's reproduction is skipped, a retry is taken at its time, a holding claim is never taken, a lapsed one is, and spent tries or the horizon fail it", () => {
  const waiting = { state: "pending", attempts: 1, asked: 0, at: 2000, retryAt: 32000 };
  assert.equal(replyClaim(waiting, 2500), "skip", "the owner's reproduction: attempt 1, due at 32 000, taken at 2 500");
  assert.equal(replyClaim(waiting, 32000 - REPLY_RETRY_SKEW_MS - 1), "skip");
  assert.equal(replyClaim(waiting, 32000 - REPLY_RETRY_SKEW_MS), "claim", "the clocks' allowance");
  assert.equal(replyClaim(waiting, 32000), "claim");
  assert.equal(replyClaim(null, 0), "claim", "a reply nobody asked for yet");
  assert.equal(replyClaim({ state: "pending", attempts: 0, asked: 0, at: 0 }, 10), "claim", "a first try has no wait");
  const writing = { state: "writing", attempts: 1, asked: 0, at: 0, lease: { owner: "a", until: 5000 } };
  assert.equal(replyClaim(writing, 4999), "skip", "a claim that holds was taken");
  assert.equal(replyClaim(writing, 5001), "claim", "a lapsed claim was not taken");
  assert.equal(replyClaim({ ...waiting, attempts: REPLY_BG_ATTEMPTS }, 40000), "fail", "spent tries were tried again");
  assert.equal(replyClaim({ ...writing, attempts: REPLY_BG_ATTEMPTS }, 5001), "fail");
  assert.equal(replyClaim({ ...waiting, retryAt: undefined }, REPLY_HORIZON_MS + 1), "fail", "past the horizon");
  for (const state of ["written", "failed", "none"]) assert.equal(replyClaim({ state, attempts: 1, asked: 0, at: 0, ...(state === "written" ? { text: "x" } : {}) }, 1), "skip", state);
});

test("BG10 — through the queue: a retry's message delivered early, twice, spends no try and calls no model; delivered at its time — twice at once — it is the next try, once; a copy spent early and the timed one lost is asked again by the cron; a reply whose tries are spent takes nothing", async () => {
  // THE FIRST TRY FAILS, AND EVERY LATER ONE IS WRITTEN.
  await withPlatform({ slug: slugOf("bg10"), replies: true, answers: TWO, replyWith: ({ n, facts }) => (part0(facts) && n === 0 ? { status: 500 } : undefined) }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    await pump(P, { max: 1 });
    const first = P.queue.splice(P.queue.findIndex((m) => isReplyTask(m, job0)), 1)[0];
    await deliver(P, first);
    const failed = replyRec(P, job0);
    assert.deepEqual([failed.state, failed.attempts, failed.retryAt - P.now() > 25_000], ["pending", 1, true], JSON.stringify(failed));
    const retry = P.queue.splice(P.queue.findIndex((m) => isReplyTask(m, job0)), 1)[0];
    assert.equal(retry.delaySeconds, REPLY_BG_RETRY_S[0]);
    const calls = writes(P);
    const before = P.objects.get("edit-replies/" + job0 + ".json").etag;
    // EARLY, TWICE: nothing taken, nothing written, nothing called, nothing sent.
    await deliver(P, retry);
    await deliver(P, retry);
    P.advance(20_000);
    await deliver(P, retry);
    assert.equal(P.objects.get("edit-replies/" + job0 + ".json").etag, before, "an early delivery touched the record");
    assert.equal(writes(P), calls, "an early delivery called the model");
    assert.equal(P.queue.filter((m) => isReplyTask(m, job0)).length, 0, "an early delivery sent another task");
    // AT ITS TIME, TWICE AT ONCE: the second try, once.
    P.advance(REPLY_BG_RETRY_S[0] * 1000 - 20_000);
    await Promise.all([deliver(P, retry), deliver(P, retry)]);
    const done = replyRec(P, job0);
    assert.deepEqual([done.state, done.attempts], ["written", 2], JSON.stringify(done));
    assert.equal(writes(P), calls + 1, "two deliveries at its time made two calls");
  });
  // A COPY SPENT EARLY AND THE TIMED ONE LOST: the cron asks again once its time and the grace are past.
  await withPlatform({ slug: slugOf("bg10-lost"), replies: true, answers: TWO, replyWith: ({ n, facts }) => (part0(facts) && n === 0 ? { status: 500 } : undefined) }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    await pump(P, { max: 1 });
    await deliver(P, P.queue.splice(P.queue.findIndex((m) => isReplyTask(m, job0)), 1)[0]);
    const retry = P.queue.splice(P.queue.findIndex((m) => isReplyTask(m, job0)), 1)[0];
    await deliver(P, retry);
    assert.deepEqual([replyRec(P, job0).state, replyRec(P, job0).attempts], ["pending", 1]);
    P.advance(REPLY_BG_RETRY_S[0] * 1000 + REPLY_RETRY_GRACE_MS + 1000);
    await tick(P);
    assert.ok(P.queue.some((m) => isReplyTask(m, job0)), "the cron did not ask again for a retry whose message was lost");
    await pump(P, { due: true });
    const rr = replyRec(P, job0);
    assert.deepEqual([rr.state, rr.attempts], ["written", 2], JSON.stringify(rr));
  });
  // TRIES SPENT: a late copy of the last retry takes nothing.
  await withPlatform({ slug: slugOf("bg10-spent"), replies: true, answers: TWO, replyWith: ({ facts }) => (part0(facts) ? { status: 500 } : undefined) }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    const job0 = P.jobsOf(r.key)[0].id;
    await settle(P, r.key, { due: true });
    let last = null;
    for (const wait of REPLY_BG_RETRY_S) {
      P.advance(wait * 1000);
      last = P.queue.find((m) => isReplyTask(m, job0)) || last;
      await pump(P, { due: true });
    }
    const rr = replyRec(P, job0);
    assert.deepEqual([rr.state, rr.attempts], ["failed", REPLY_BG_ATTEMPTS], JSON.stringify(rr));
    const calls = writes(P);
    assert.ok(last, "the last retry's message was not seen");
    await deliver(P, last);
    assert.equal(writes(P), calls, "a reply whose tries were spent was tried again");
    assert.deepEqual([replyRec(P, job0).state, replyRec(P, job0).attempts], ["failed", REPLY_BG_ATTEMPTS]);
  });
});

test("BG11 — what the job did, in one word, rides every read while its reply is written (2026-10-04): a part that went through reads `done`, a part that did not reads `not-done` — so the page never holds a refusal's place with Done — and the word goes once the reply is written", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  // THE ADDITION FAILS: its designer makes nothing. Both parts' replies are held.
  const answers = { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, [T.adds]: { kinds: [] } };
  await withPlatform({ slug: slugOf("bg11"), replies: true, answers, replyWith: async () => { await gate; } }, async (P) => {
    const r = await sendMessage(P, { message: MESSAGE });
    // EVERY REPLY HELD BESIDE THE WORK: both parts' and the request's own.
    const asked = [];
    const running = await pumpBeside(P, (m) => { if (isReplyTask(m)) asked.push(m.body.id || "request"); return isReplyTask(m); });
    const [edit, addon] = [P.jobsOf(r.key).find((j) => j.op === "edit"), P.jobsOf(r.key).find((j) => j.op === "addon")];
    assert.ok(edit && addon, "both parts did not run");
    assert.deepEqual([asked.includes(edit.id), asked.includes(addon.id)], [true, true], "both parts' replies were not asked for: " + JSON.stringify(asked));
    assert.equal(addon.state, "failed");
    // EACH WRITER AT ITS CALL, held there, before any read is counted.
    for (let i = 0; i < 200 && writes(P) < asked.length; i++) await new Promise((ok) => setImmediate(ok));
    const calls = writes(P);
    assert.equal(calls, asked.length, "a held reply never reached its writer");
    const pe = await poll(P, edit.id);
    const pa = await poll(P, addon.id);
    assert.deepEqual([pe.body.replyState, pe.body.ok, pe.body.replyOutcome], ["pending", true, "done"]);
    assert.deepEqual([pa.body.replyState, pa.body.ok, pa.body.replyOutcome], ["pending", false, "not-done"]);
    assert.equal(EditPoll.pendingReplyLine(pe.body), "Done — writing up what changed…");
    assert.equal(EditPoll.pendingReplyLine(pa.body), "That didn’t go through — writing up why…");
    assert.equal(writes(P), calls, "a read called the model");
    release();
    await Promise.all(running);
    for (const j of [edit, addon]) {
      const p = await poll(P, j.id);
      assert.equal(p.body.replySource, "model");
      assert.equal(p.body.replyState, undefined);
      assert.equal(p.body.replyOutcome, undefined, "the word stayed on a written reply");
    }
  });
});
