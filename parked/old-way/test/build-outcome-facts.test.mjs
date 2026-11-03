// PARKED (2026-11-03, park-old-way): the old-way half of test/build-outcome-facts.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A BUILD'S OUTCOME FACTS, THROUGH ITS REAL LIFECYCLE (2026-10-08, Codex's
// review of `366dc581`).
//
//   context   a queued build with three links finished through the real
//             resume with neither `context` nor `contextNote`: the unread and
//             unopened links were never explained. The first invocation now
//             keeps the structured facts (`jobs/<id>.context.json`) for the
//             resume, a refire and recovery — used, partial, unread and
//             unopened kept apart.
//   pictures  a purchase that threw erased which pictures were planned and
//             why the rest were never offered. `withPictureFacts` keeps them
//             either way, and reads the pictures it was buying as `unknown`.
//   replies   the build's explanations were fixed sentences. The outcome is
//             carried as `buildFacts` and told by the reply writer; when that
//             cannot be done the answer says `replyState: "unavailable"` and
//             keeps the facts — nothing invented, nothing lost.
//
// Every model answer here is supplied by a stand-in; nothing is paid. The
// ledger is a stand-in, not a database.

import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, BUILD_USER, GOOD_DESIGN, BRIEF } from "../../../test/fixtures/build-route.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { ledger, fireInterim, finishResume } from "../../../test/fixtures/build-lifecycle.mjs";
import { resultKey, readResult, contextKey } from "../../../builder/build-job.mjs";
import { pictureOutcomes, withPictureFacts } from "../../../builder/site-images.mjs";
import { buildReplyFacts } from "../../../builder/site-reply.mjs";
import { buildFacts } from "../../../builder/build-answer.mjs";
import { publishPages } from "../../../builder/publish-pages.mjs";
import { normalizePlan } from "../../../builder/site-plan.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "f2c3d4e5f60718293a4b5c6d7e8f9";
const words = (n) => ("Harbour Loaf bakes sourdough by the harbour in Leeds. ".repeat(Math.ceil(n / 54))).slice(0, n);
const THREE = { brief: BRIEF + " Like https://a.example and https://b.example and https://c.example.", links: { "a.example": words(5000), "b.example": words(14000) } };
const answerOf = (b, id) => { const raw = b.store.get(resultKey(id)); return raw ? JSON.parse(readResult(JSON.parse(raw)).body) : null; };
const statuses = (srcs) => (srcs || []).map((x) => x.url.replace(/^https:\/\//, "").replace(/\/$/, "") + ":" + x.status);

async function tick(b, id, led) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: GOOD_DESIGN.slug, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) return json(led.answer(JSON.parse(String((init && init.body) || "{}"))));
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b }, { now: Date.parse("2026-10-08T12:00:00Z") }); }
  finally { globalThis.fetch = real; }
}

// ── context across the handoff ─────────────────────────────────────────────

test("context: a queued build with three links, finished by the REAL RESUME — its answer carries used, partial and unopened, each kept apart, and the browser is closed throughout", async () => {
  const id = newId();
  const b = buildBucket();
  await fireInterim(b, id, ledger(), THREE);
  assert.ok(b.store.has(contextKey(id)), "the first invocation kept no context facts for whoever finishes it");
  await finishResume(b, id, ledger());
  const a = answerOf(b, id);
  assert.deepEqual(statuses(a.context && a.context.sources), ["a.example:used", "b.example:partial", "c.example:unopened"], "the resume's answer lost the context: " + JSON.stringify(a.context || null));
  assert.deepEqual(statuses(a.buildFacts && a.buildFacts.sources), ["a.example:used", "b.example:partial", "c.example:unopened"]);
  const partial = a.buildFacts.sources[1];
  const used = a.buildFacts.sources[0];
  assert.equal(partial.chars, 14000);
  assert.ok(partial.kept > 10000 && partial.kept < 14000, "the partial page's kept count is not what the allowance left: " + partial.kept);
  assert.equal(partial.allowance, 16000);
  assert.equal(used.kept, undefined);
  assert.equal(a.replyState, "not-attempted", "with the reply writer off, the answer must say no writer was asked (never that one failed) and keep the facts");
  assert.equal(a.replyWhy, "off");
});

test("context: a link that could not be read stays UNREAD through the resume — never merged with unopened", async () => {
  const id = newId();
  const b = buildBucket();
  await fireInterim(b, id, ledger(), { brief: BRIEF + " Like https://a.example and https://down.example and https://c.example.", links: { "a.example": words(300) } });
  await finishResume(b, id, ledger());
  const a = answerOf(b, id);
  assert.deepEqual(statuses(a.buildFacts.sources), ["a.example:used", "down.example:unread", "c.example:unopened"]);
  assert.match(a.buildFacts.sources[1].reason, /answered 503/);
});

test("context: a lost queued build's RECOVERY answer carries the kept context facts and its settlement", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led, THREE);
  await tick(b, id, led);
  const a = answerOf(b, id);
  assert.equal(a.lost, true);
  assert.deepEqual(statuses(a.buildFacts.sources), ["a.example:used", "b.example:partial", "c.example:unopened"]);
  assert.equal(a.buildFacts.settlement.refunded, 6);
});

test("context CONTROL: a queued build with no links keeps no context object and its answer carries no sources", async () => {
  const id = newId();
  const b = buildBucket();
  await fireInterim(b, id, ledger());
  assert.equal(b.store.has(contextKey(id)), false);
  await finishResume(b, id, ledger());
  const a = answerOf(b, id);
  assert.equal(a.context, undefined);
  assert.equal(a.buildFacts && a.buildFacts.sources, undefined);
});

// ── told by the reply writer ───────────────────────────────────────────────

test("reply: with the reply writer on, the resume's answer is told by the model from the recorded facts — the partial and unopened links among them", async () => {
  const id = newId();
  const b = buildBucket();
  await fireInterim(b, id, ledger(), THREE);
  const seen = [];
  await finishResume(b, id, ledger(), { env: { MODEL_REPLIES: "on", ANTHROPIC_API_KEY: "k" }, reply: "I read a.example in full and the first part of b.example; I didn't open c.example.", seen });
  const a = answerOf(b, id);
  assert.equal(a.replySource, "model");
  assert.equal(a.reply, "I read a.example in full and the first part of b.example; I didn't open c.example.");
  assert.equal(seen.length, 1, "the reply writer was not asked exactly once");
  assert.match(seen[0], /b\.example was read, but only the first \d+ of its 14000 characters were used/);
  assert.doesNotMatch(seen[0], /LINKED PAGES THE USER POINTED AT/, "the writer was handed the linked pages' text as the customer's request");
  assert.match(seen[0], /The link c\.example was not opened/);
  assert.ok(a.buildFacts, "the facts were dropped once the reply was written");
});

test("reply: the reply writer is DOWN — no reply is invented, the answer says unavailable, and every fact is kept", async () => {
  const id = newId();
  const b = buildBucket();
  await fireInterim(b, id, ledger(), THREE);
  await finishResume(b, id, ledger(), { env: { MODEL_REPLIES: "on", ANTHROPIC_API_KEY: "k" } });
  const a = answerOf(b, id);
  assert.equal(a.reply, undefined);
  assert.equal(a.replySource, undefined);
  assert.equal(a.replyState, "unavailable");
  assert.ok(a.replyWhy);
  assert.deepEqual(statuses(a.buildFacts.sources), ["a.example:used", "b.example:partial", "c.example:unopened"]);
});

// ── pictures, independent of the purchase's return ─────────────────────────

const PLAN = normalizePlan({ ...GOOD_DESIGN, images: [
  { page: "/", describe: "their shop", attached: "attachment-1", src: "/u/harbour-loaf/a.jpg" },
  ...Array.from({ length: 8 }, (_, i) => ({ page: "/", describe: "picture " + (i + 1) })),
] });
const NOT_OFFERED = [7, 8].map((n) => ({ page: "/", describe: "picture " + n, why: "cap" }));
