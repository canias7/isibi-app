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

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBucket, BUILD_USER, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { ledger, fireInterim, finishResume, replyAnswer } from "./fixtures/build-lifecycle.mjs";
import { resultKey, readResult, resultKind, nextResult, knownSettlement, packResult } from "../builder/build-job.mjs";
import * as images from "../builder/site-images.mjs";
import { pictureOutcomes, withPictureFacts, pictureStages, shotKey } from "../builder/site-images.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { publishPages } from "../builder/publish-pages.mjs";
import { normalizePlan } from "../builder/site-plan.mjs";
import { PUBLISH_RESERVE_MS } from "../builder/build-budget.mjs";
import { tweakParser } from "../builder/site-tweak.mjs";

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

test("1: the rule itself — knownSettlement reads only what an answer says; repair touches only a terminal answer lacking the facts", () => {
  const facts = { recovered: true, outcome: "not-published", why: "staged", refunded: 6, short: false };
  const term = packResult({ status: 200, type: "application/json", body: JSON.stringify({ ok: true, page: "app" }) });
  const termWith = packResult({ status: 200, type: "application/json", body: JSON.stringify({ ok: true, page: "app", settlement: facts }) });
  const rec = packResult({ status: 200, type: "application/json", body: JSON.stringify({ ok: false, lost: true, refunded: 6, buildFacts: { settlement: facts } }) });
  const oldRec = packResult({ status: 410, type: "application/json", body: JSON.stringify({ ok: false, lost: true, refunded: 4, refundShort: true }) });
  assert.equal(knownSettlement(term), null, "an answer that says nothing about money yields nothing");
  assert.deepEqual(knownSettlement(termWith), facts);
  assert.deepEqual(knownSettlement(rec), facts);
  assert.deepEqual(knownSettlement(oldRec), { recovered: true, outcome: "not-published", why: "", refunded: 4, short: true });
  assert.ok(JSON.parse(readResult(nextResult(term, null, "repair", facts).next).body).settlement);
  assert.equal(nextResult(termWith, null, "repair", facts).next, null);
  assert.equal(nextResult(rec, null, "repair", facts).next, null, "repair replaced recovery's own answer");
  assert.equal(nextResult(null, null, "repair", facts).next, null, "repair wrote into an empty slot");
  assert.equal(nextResult(term, null, "repair", null).next, null);
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

test("2 (Codex's reproduction): a successful purchase, then compilation FAILS — the pictures are in the pages but not published, nothing claims they are on the site, and nothing was published", async () => {
  let published = 0;
  const out = await publishPages(base({
    generate: gen([HOME]),
    images: boughtBoth,
    compile: async () => ({ ok: false, stage: "typecheck", error: "index.tsx(9,1): error TS1005: ';' expected." }),
    publish: async () => { published++; },
  }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.equal(out.page, "placeholder");
  assert.equal(published, 0);
  assert.equal(stageOf(out)["a loaf on the counter"], "made/in-source");
  const said = told(out);
  assert.doesNotMatch(said, /put on the site|published on the site|shown on a published page/, "a picture that never went live was told as on the site:\n" + said);
  assert.match(said, /did not go live with them[^\n]*a loaf on the counter/);
});

test("2: SALVAGE stubs the page holding one picture and publishes the rest — that picture is stored and not on the site, the other is published", async () => {
  let calls = 0;
  const out = await publishPages(base({
    generate: gen([HOME, MENU]),
    images: boughtBoth,
    compile: async () => (++calls === 1 ? { ok: false, stage: "typecheck", error: "src/routes/menu.tsx(3,5): error TS2322: Type 'x' is not assignable." } : { ok: true, files: { "index.html": { t: "<built>" } } }),
  }), { spec: { tables: [] }, slug: "harbour-loaf", livePages: [] });
  assert.equal(out.page, "app", "the salvage did not publish: " + JSON.stringify(out.salvage));
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.deepEqual(stageOf(out), { "a loaf on the counter": "made/published", "the menu board": "made/stored" });
  const said = told(out);
  assert.match(said, /shown on a published page: “a loaf on the counter”/);
  assert.match(said, /not on any page that was published[^\n]*the menu board/);
});

test("2: the PUBLISH is refused after a clean compile — the error carries the pictures, in the pages and not published", async () => {
  let thrown = null;
  try {
    await publishPages(base({ generate: gen([HOME]), images: boughtBoth, publish: async () => { throw new Error("publish refused"); } }), { spec: { tables: [] }, slug: "harbour-loaf" });
  } catch (e) { thrown = e; }
  assert.ok(thrown, "the refused publish did not throw");
  assert.ok(thrown.images, "the refused publish dropped the picture facts");
  assert.equal(thrown.images.pictures.find((x) => x.describe === "a loaf on the counter").stage, "in-source");
  assert.doesNotMatch(buildReplyFacts(buildFacts({ images: thrown.images })).facts.map((f) => f.text || f).join("\n"), /published on the site|shown on a published page/);
});

test("2 CONTROL: a clean compile and publish — the picture is published and told as on the site", async () => {
  const out = await publishPages(base({ generate: gen([HOME]), images: boughtBoth }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.equal(out.page, "app");
  assert.equal(stageOf(out)["a loaf on the counter"], "made/published");
  assert.match(told(out), /shown on a published page: “a loaf on the counter”/);
});

test("2: pictureStages is exact — a made picture with no address, or one in no final source, is stored; other entries are untouched", () => {
  const pics = [{ describe: "a", status: "made", url: "/u/a.jpg" }, { describe: "b", status: "made" }, { describe: "c", status: "failed" }];
  const yes = new Map([["/u/a.jpg", "yes"]]);
  assert.deepEqual(pictureStages(pics, { sources: ['<img src="/u/a.jpg">'], published: true, shown: yes }).map((x) => x.stage), ["published", "stored", undefined]);
  // The eighth batch: no render reading, or "unknown", is unconfirmed; "no" is not shown.
  assert.deepEqual(pictureStages(pics, { sources: ['<img src="/u/a.jpg">'], published: true }).map((x) => x.stage), ["unconfirmed", "stored", undefined]);
  assert.deepEqual(pictureStages(pics, { sources: ['<img src="/u/a.jpg">'], published: true, shown: new Map([["/u/a.jpg", "no"]]) }).map((x) => x.stage), ["not-shown", "stored", undefined]);
  assert.deepEqual(pictureStages(pics, { sources: ['<img src="/u/a.jpg">'], published: false }).map((x) => x.stage), ["in-source", "stored", undefined]);
  assert.deepEqual(pictureStages(pics, { sources: [], published: true }).map((x) => x.stage), ["stored", "stored", undefined]);
});

// ── 2b. a shot still running when the wait ends ────────────────────────────

/** The Worker's own `buySitePhotos`, evaluated with the real picture helpers and a stand-in provider. */
function realBuy(makeSitePhoto) {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const src = W.slice(W.indexOf("async function buySitePhotos("), W.indexOf("// Resolve @@SPRITE"));
  assert.ok(src.length > 1000 && src.includes("const unresolved ="), "buySitePhotos moved — rescope this");
  const names = ["imagesAffordable", "SITE_PHOTO_USD", "siteUploadList", "MAX_FILES_PER_SITE", "photoWait", "planImages", "imageSources", "applyImages", "shotKey", "makeSitePhoto"];
  const vals = [images.imagesAffordable, 0.15, async () => [], 200, images.photoWait, images.planImages, images.imageSources, images.applyImages, images.shotKey, makeSitePhoto];
  return new Function(...names, src + "\nreturn buySitePhotos;")(...vals);
}
const TOKEN_PAGE = (d1, d2) => [{ path: "index.tsx", source: '<img src="@@IMG:' + d1 + '@@" /><img src="@@IMG:' + d2 + '@@" />' }];

test("2b: one picture bought, one REFUSED by the provider, one still RUNNING when the wait ends — made, failed and unknown/still-pending, and the running one is never told as a provider failure", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const plan = normalizePlan({ ...GOOD_DESIGN, images: [{ page: "/", describe: "a loaf on the counter" }, { page: "/", describe: "the ovens at dawn" }, { page: "/", describe: "the Saturday queue" }] });
  const buy = realBuy(async (env, slug, prompt) => {
    if (/loaf/.test(prompt)) return { url: URL_A };
    if (/ovens/.test(prompt)) return { url: null, error: "photo 422 refused" };
    return new Promise(() => {}); // never answers
  });
  const pages = [{ path: "index.tsx", source: '<img src="@@IMG:a loaf on the counter@@" /><img src="@@IMG:the ovens at dawn@@" /><img src="@@IMG:the Saturday queue@@" />' }];
  const clock = { remainingMs: () => PUBLISH_RESERVE_MS + 120000 };
  const p = withPictureFacts(buy({}, { slug: "harbour-loaf", pages, parts: [], budget: 3, balance: 500, reserve: 0, clock }), { plan, budget: 6 });
  // The wait's timer is the real code's; the clock is moved only once it is set.
  let r = null;
  p.then((v) => { r = v; });
  for (let i = 0; i < 200 && !r; i++) { await new Promise((res) => setImmediate(res)); t.mock.timers.tick(1000); }
  assert.ok(r, "the purchase never ended at its wait");
  assert.deepEqual(r.refused, [shotKey("the ovens at dawn")]);
  assert.deepEqual(r.unresolved, [shotKey("the Saturday queue")]);
  const st = Object.fromEntries(r.pictures.map((x) => [x.describe, x.status + (x.why ? "/" + x.why : "")]));
  assert.deepEqual(st, { "a loaf on the counter": "made", "the ovens at dawn": "failed", "the Saturday queue": "unknown/still-pending" });
  const said = buildReplyFacts(buildFacts({ images: r })).facts.map((f) => f.text || f).join("\n");
  assert.doesNotMatch(said, /tried and not made[^\n]*Saturday queue/, "a shot still running was told as refused");
  assert.match(said, /still being made when the build stopped waiting[^\n]*Saturday queue/);
});

test("2b CONTROL: every shot answers before the wait ends — no unresolved list, and a refusal is still a failure", async () => {
  const plan = normalizePlan({ ...GOOD_DESIGN, images: [{ page: "/", describe: "a loaf on the counter" }, { page: "/", describe: "the ovens at dawn" }] });
  const buy = realBuy(async (env, slug, prompt) => (/loaf/.test(prompt) ? { url: URL_A } : { url: null, error: "photo 422" }));
  const r = await withPictureFacts(buy({}, { slug: "harbour-loaf", pages: TOKEN_PAGE("a loaf on the counter", "the ovens at dawn"), parts: [], budget: 2, balance: 500, reserve: 0, clock: null }), { plan, budget: 6 });
  assert.deepEqual(r.unresolved, []);
  assert.deepEqual(r.pictures.map((x) => x.status), ["made", "failed"]);
});

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

test("3 CONTROL: recovery with the switch OFF — never attempted, said so, and no call", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer("unused");
  await tick(b, id, led, { onFetch: w.onFetch });
  const a = answerOf(b, id);
  assert.equal(w.seen.length, 0);
  assert.equal(a.body.replyState, "not-attempted");
  assert.equal(a.body.replyWhy, "off");
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
