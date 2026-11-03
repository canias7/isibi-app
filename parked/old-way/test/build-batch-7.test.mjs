// PARKED (2026-11-03, park-old-way): the old-way half of test/build-batch-7.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SEVENTH BUILD BATCH (2026-10-08, Codex's review of `1a294654`), the
// three gaps it found, each through the real lifecycle where one exists:
//
//   1  SETTLEMENT DELIVERY SURVIVES READ FAILURES. Codex held the real resume
//      before its final write, let recovery finish with a refund of 6, then
//      failed the settlement record's read during the resume's conditional
//      retry: the final answer erased the refund, the record stayed
//      delivered, nothing was pending, and later ticks never repaired it.
//      Unreadable is not absent: the facts the slot already carries are kept,
//      the build is listed pending, and recovery's next tick repairs a
//      terminal answer that lacks them — never rerunning, never refunding.
//   2  PICTURE REPORTING IS GROUNDED IN THE FINAL PUBLICATION. A bought
//      picture is stored; only a completed publish of a source that holds it
//      puts it on the site. Compile failure, salvage, a refused publish and
//      success each say where the picture got to; a shot still running when
//      the wait ends is unknown, never a provider failure.
//   3  THE MODEL-WRITTEN EXPLANATION ON EVERY PATH. Recovery's answer and a
//      failed resume's are narrated from their facts; recovery's one attempt
//      is kept on its record so a retried delivery never pays twice; a switch
//      that is off says "not attempted", never "failed".
//
// Every model answer is a stand-in, the ledger is a stand-in, R2 is a Map
// with R2's conditions. Nothing runs against production.

import * as fanout from "../../../builder/model-fanout.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBucket, BUILD_USER, GOOD_DESIGN } from "../../../test/fixtures/build-route.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { ledger, fireInterim, finishResume, replyAnswer } from "../../../test/fixtures/build-lifecycle.mjs";
import { resultKey, readResult, resultKind, nextResult, knownSettlement, packResult } from "../../../builder/build-job.mjs";
import * as images from "../../../builder/site-images.mjs";
import { pictureOutcomes, withPictureFacts, pictureStages, shotKey } from "../../../builder/site-images.mjs";
import { buildReplyFacts } from "../../../builder/site-reply.mjs";
import { buildFacts } from "../../../builder/build-answer.mjs";
import { publishPages } from "../../../builder/publish-pages.mjs";
import { normalizePlan } from "../../../builder/site-plan.mjs";
import { PUBLISH_RESERVE_MS } from "../../../builder/build-budget.mjs";
import { tweakParser } from "../../../builder/site-tweak.mjs";

const SLUG = GOOD_DESIGN.slug;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "e7c3d4e5f60718293a4b5c6d7e8f9";

/** One recovery pass over the lost row; `env` adds to the Worker's, `onFetch` answers first. */
async function tick(b, id, led, { env = {}, onFetch = null, state = "lost" } = {}) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state, created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (onFetch) { const r = await onFetch(u, init); if (r) return r; }
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) return json(led.answer(JSON.parse(String((init && init.body) || "{}"))));
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b, ...env }, { now: Date.parse("2026-10-08T12:00:00Z") }); }
  finally { globalThis.fetch = real; }
}

const answerOf = (b, id) => { const raw = b.store.get(resultKey(id)); if (!raw) return null; const v = JSON.parse(raw); const r = readResult(v); return { status: r.status, body: JSON.parse(r.body), kind: resultKind(v) }; };
const settlement = (b, id) => JSON.parse(b.store.get("jobs/" + id + ".lost.json") || "null");
const pending = (b, id) => b.store.has("recovery/pending/" + id);
const refunds = (led) => led.calls.filter((c) => c.endsWith("|lost")).length;
const settled6 = (a) => !!(a && a.body && a.body.settlement && a.body.settlement.refunded === 6 && a.body.refunded === 6);

/** Hold the first put matching `match` until released. */
function hold(b, match) {
  const put = b.put.bind(b);
  let release, reachedR;
  const gate = new Promise((r) => { release = r; });
  const reached = new Promise((r) => { reachedR = r; });
  let armed = true;
  b.put = async (k, v, o) => {
    if (armed && match(k, v)) { armed = false; reachedR(); await gate; }
    return put(k, v, o);
  };
  return { reached, release: () => release() };
}
/** Fail the next `n` reads of `key` (R2 down for that object), counting them. */
function failGet(b, key, n = 1) {
  const get = b.get.bind(b);
  const seen = { failed: 0 };
  b.get = async (k, ...rest) => {
    if (k === key && seen.failed < n) { seen.failed++; throw new Error("r2 read down"); }
    return get(k, ...rest);
  };
  return seen;
}
function failPut(b, match, n = 1) {
  const put = b.put.bind(b);
  let left = n;
  b.put = async (k, v, o) => { if (left > 0 && match(k, v)) { left--; throw new Error("r2 down"); } return put(k, v, o); };
}
const lostKey = (id) => "jobs/" + id + ".lost.json";

// ── 1. settlement delivery survives read failures ─────────────────────────

test("1 (Codex's reproduction): recovery refunds 6 while the resume is held; the settlement read FAILS on the resume's conditional retry — the final answer keeps the refund, the build is listed pending, and the next tick checks it and moves no money", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  await tick(b, id, led);
  assert.equal(answerOf(b, id).kind, "recovery");
  assert.equal(settlement(b, id).delivered, true);
  assert.equal(refunds(led) > 0, true);
  const refundCalls = led.calls.length;
  // The held put will be refused (the slot moved), and its retry reads the record: fail that read.
  const reads = failGet(b, lostKey(id), 1);
  resumeWrite.release();
  await resumeRun;
  assert.equal(reads.failed, 1, "the record was never read on the retry — the case did not happen");
  const a = answerOf(b, id);
  assert.equal(a.kind, "terminal", "the build's own answer did not land");
  assert.equal(a.body.resumed, "finish");
  assert.ok(settled6(a), "the final answer erased the recorded refund: " + JSON.stringify(a.body.settlement || null));
  assert.equal(pending(b, id), true, "an unreadable settlement left nothing pending to reconcile");
  await tick(b, id, led);
  assert.equal(pending(b, id), false, "the repair pass did not finish the reconciliation");
  assert.ok(settled6(answerOf(b, id)));
  assert.equal(led.calls.length, refundCalls, "the repair asked for money again");
  const after = b.store.get(resultKey(id));
  await tick(b, id, led);
  assert.equal(b.store.get(resultKey(id)), after, "a later tick changed a consistent answer");
});

test("1: the browser had COLLECTED recovery's answer, and the record cannot be read when the final lands — the final is written without facts, listed pending, and the next tick ADDS the refund to it, once", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  await tick(b, id, led);
  b.store.delete(resultKey(id)); // collected by an open browser
  const refundCalls = led.calls.length;
  failGet(b, lostKey(id), 1);
  resumeWrite.release();
  await resumeRun;
  const a = answerOf(b, id);
  assert.equal(a.kind, "terminal");
  assert.equal(a.body.settlement, undefined, "facts were invented from nothing");
  assert.equal(pending(b, id), true, "nothing kept the reconciliation");
  await tick(b, id, led);
  const fixed = answerOf(b, id);
  assert.ok(settled6(fixed), "the repair did not add the refund: " + JSON.stringify(fixed.body.settlement || null));
  assert.equal(fixed.body.resumed, "finish", "the repair replaced the build's answer");
  assert.equal(pending(b, id), false);
  assert.equal(led.calls.length, refundCalls, "the repair refunded again");
});

test("1: the record is STILL unreadable on the repair tick — the row stays pending and nothing is written; the tick after repairs it", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  await tick(b, id, led);
  b.store.delete(resultKey(id));
  const reads = failGet(b, lostKey(id), 1); // the retry's read
  resumeWrite.release();
  await resumeRun;
  assert.equal(reads.failed, 1);
  const before = b.store.get(resultKey(id));
  // EVERY read of the record on the next tick fails (the fresh-row filter's and the row's own).
  const tickReads = failGet(b, lostKey(id), 99);
  await tick(b, id, led);
  assert.ok(tickReads.failed >= 1, "the tick never read the record");
  tickReads.failed = 99;
  assert.equal(pending(b, id), true, "an unreadable record dropped the pending row");
  assert.equal(b.store.get(resultKey(id)), before);
  await tick(b, id, led);
  assert.ok(settled6(answerOf(b, id)));
  assert.equal(pending(b, id), false);
});

test("1 CONTROL: the same race with every read working — the final keeps the refund and nothing is listed pending", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const resumeWrite = hold(b, (k, v) => k === resultKey(id) && String(v).includes("resumed"));
  const resumeRun = finishResume(b, id, led);
  await resumeWrite.reached;
  await tick(b, id, led);
  resumeWrite.release();
  await resumeRun;
  assert.ok(settled6(answerOf(b, id)));
  assert.equal(pending(b, id), false);
});

// ── 2. pictures, grounded in the final publication ─────────────────────────

const PLAN = normalizePlan({ ...GOOD_DESIGN, images: [{ page: "/", describe: "a loaf on the counter" }, { page: "/", describe: "the menu board" }] });
const URL_A = "/uploads/harbour-loaf/a.jpg";
const URL_B = "/uploads/harbour-loaf/b.jpg";
const route = (p, body) => 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("' + p + '")({ component: Page });\nfunction Page() { return ' + body + "; }";
const HOME = { path: "index.tsx", source: route("/", '<div><img src="PIC_A" alt="a loaf" />Harbour Loaf</div>') };
const MENU = { path: "menu.tsx", source: route("/menu", '<div><img src="PIC_B" alt="the menu board" />Menu</div>') };
/** The purchase as the real hook ends: both bought, put into the pages, facts attached. */
const boughtBoth = (pages) => withPictureFacts(Promise.resolve({
  pages: pages.map((p) => ({ ...p, source: p.source.replace("PIC_A", URL_A).replace("PIC_B", URL_B) })),
  made: 2, planned: 2, budget: 6, overflow: 0,
  bought: [{ key: shotKey("a loaf on the counter"), url: URL_A }, { key: shotKey("the menu board"), url: URL_B }],
  attempted: [shotKey("a loaf on the counter"), shotKey("the menu board")], notTried: [], refused: [], unresolved: [],
}), { plan: PLAN, budget: 6 });
const gen = (pages) => async () => ({ input: { pages, notes: "" }, usage: { in: 1, out: 1, cacheRead: 0, cacheWrite: 0 } });
const base = (over) => ({ parser: tweakParser, compile: async () => ({ ok: true, files: { "index.html": { t: "<built>" } } }), publish: async () => {}, readCredits: async () => 500, useCredits: async (n) => n, ...over });
const stageOf = (out) => Object.fromEntries(out.images.pictures.map((x) => [x.describe, x.status + "/" + (x.stage || "-")]));
const told = (out) => buildReplyFacts(buildFacts({ images: out.images })).facts.map((f) => f.text || f).join("\n");

// ── 2b. a shot still running when the wait ends ────────────────────────────

/** The Worker's own `buySitePhotos`, evaluated with the real picture helpers and a stand-in provider. */
function realBuy(makeSitePhoto) {
  const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const src = W.slice(W.indexOf("async function buySitePhotos("), W.indexOf("// Resolve @@SPRITE"));
  assert.ok(src.length > 1000 && src.includes("const unresolved ="), "buySitePhotos moved — rescope this");
  const names = ["imagesAffordable", "SITE_PHOTO_USD", "siteUploadList", "MAX_FILES_PER_SITE", "photoWait", "planImages", "imageSources", "applyImages", "shotKey", "makeSitePhoto", "imagePurchasesOn", "permits", "MAX_MODEL_FANOUT"];
  const vals = [images.imagesAffordable, 0.15, async () => [], 200, images.photoWait, images.planImages, images.imageSources, images.applyImages, images.shotKey, makeSitePhoto, images.imagePurchasesOn, fanout.permits, fanout.MAX_MODEL_FANOUT];
  return new Function(...names, src + "\nreturn buySitePhotos;")(...vals);
}
const TOKEN_PAGE = (d1, d2) => [{ path: "index.tsx", source: '<img src="@@IMG:' + d1 + '@@" /><img src="@@IMG:' + d2 + '@@" />' }];

// ── 3. the model-written explanation on every path ─────────────────────────

const REPLY_ENV = { MODEL_REPLIES: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };
/** Stands in for the reply writer on any provider route, counting calls. */
function writer(reply) {
  const seen = [];
  const onFetch = async (u, init) => {
    if (!(u.includes("/v1/messages") || u.includes("/chat/completions"))) return null;
    const r = replyAnswer(reply, seen, init);
    return r || null;
  };
  return { seen, onFetch };
}

test("3: RECOVERY's answer is narrated from its facts, and the one attempt is kept on the record — a delivery retried after a failed write reuses it and never calls the writer again", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer("Your build stopped before it went live, so I returned the 6 credits it took.");
  failPut(b, (k, v) => k === resultKey(id) && String(v).includes('\\"lost\\":true'), 1);
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  assert.equal(w.seen.length, 1, "the writer was not asked once");
  assert.equal(pending(b, id), true);
  assert.equal(settlement(b, id).narration.state, "written", "the attempt was not kept for the retry");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  assert.equal(w.seen.length, 1, "the retried delivery paid for the same explanation again");
  const a = answerOf(b, id);
  assert.equal(a.kind, "recovery");
  assert.equal(a.body.replySource, "model");
  assert.match(a.body.reply, /returned the 6 credits/);
  assert.ok(a.body.msg, "the fixed state message was dropped");
  assert.equal(a.body.buildFacts.settlement.refunded, 6, "the accounting was dropped");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  assert.equal(w.seen.length, 1);
});

test("3: recovery with the writer DOWN keeps the facts, says unavailable, and does not retry the paid call on the next tick", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer(undefined);
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  const a = answerOf(b, id);
  assert.equal(a.body.replyState, "unavailable");
  assert.equal(a.body.reply, undefined);
  assert.equal(a.body.buildFacts.settlement.refunded, 6);
  const calls = w.seen.length;
  assert.ok(calls >= 1);
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  assert.equal(w.seen.length, calls);
});

test("3: a FAILED resume (its publish refused) is narrated from its facts — the fixed failure and the accounting stay", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led, { links: { "a.example": "Harbour Loaf bakes sourdough." }, brief: "Harbour Loaf. Like https://a.example" });
  const w = writer("The site didn't publish, so nothing went live; I read a.example.");
  await finishResume(b, id, led, {
    credits: 400, source: route("/", "<div>Harbour Loaf</div>"), env: REPLY_ENV,
    over: async (u, init) => (u.includes("/v1/messages") || u.includes("/chat/completions") ? w.onFetch(u, init) : (u.includes("/client/v4/") || u.includes("dispatch") ? new Response("refused", { status: 500 }) : null)),
  });
  const a = answerOf(b, id);
  assert.equal(a.body.ok, false, "the resume did not fail: " + JSON.stringify(a.body).slice(0, 300));
  assert.equal(a.body.stage, "resume");
  assert.equal(a.body.error, "the build failed");
  assert.ok(a.body.buildFacts, "the failed answer carries no facts to narrate");
  assert.equal(a.body.replySource, "model", "the failed resume was not narrated: " + JSON.stringify({ replyState: a.body.replyState, replyWhy: a.body.replyWhy }));
  assert.ok(w.seen.length >= 1);
});
