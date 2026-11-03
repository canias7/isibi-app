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
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
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
 * comparing two runs: each job's id, which is random, read as its op and place,
 * and each version a publish made (its check evidence, 2026-10-14), random too.
 */
const workOf = (P, key) => {
  const jobs = P.jobsOf(key);
  const named = (ref) => jobs.reduce((t, j, i) => t.split(j.id).join(j.op + "@" + i), String(ref));
  return JSON.stringify({ look: P.look(), pages: P.pages(), jobs: jobs.map((j) => [j.op, j.state, j.billing, j.cost, j.result && j.result.body]), ledger: P.ledger.map((e) => [named(e.ref), e.reason, e.delta]) })
    .replace(/\\"version\\":\\"[^\\"]*\\"/g, '\\"version\\":\\"V\\"');
};

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
