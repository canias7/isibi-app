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
import { buildBucket, BUILD_USER, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { resultKey, readResult, contextKey } from "../builder/build-job.mjs";
import { pictureOutcomes, withPictureFacts } from "../builder/site-images.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { publishPages } from "../builder/publish-pages.mjs";
import { normalizePlan } from "../builder/site-plan.mjs";

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

test("reply facts: every recorded state becomes its own fact for the writer — pictures, links, lookup, sections, stand-in pages, money — and nothing is shown as it is", () => {
  const f = buildReplyFacts({
    pictures: [
      { describe: "a", status: "made", stage: "published", url: "/u/a.png" }, { describe: "b", status: "failed" }, { describe: "c", status: "not-attempted", why: "time" },
      { describe: "d", status: "not-placed" }, { describe: "e", status: "not-offered", why: "cap" }, { describe: "g", status: "unknown", why: "purchase-error" },
      { describe: "h", status: "own" },
    ],
    sources: [{ url: "https://u.example/", status: "used" }, { url: "https://p.example/", status: "partial", kept: 10, chars: 20, allowance: 16000 }, { url: "https://r.example/", status: "unread", reason: "it blocked us" }, { url: "https://o.example/", status: "unopened", reason: "one build opens at most 2 links" }],
    research: { found: false, searches: 2 },
    unwritten: [{ section: "the price list" }],
    salvaged: ["menu.tsx"],
    settlement: { outcome: "not-published", refunded: 6, short: false },
  }).facts;
  const text = f.map((x) => x.text).join("\n");
  for (const want of [/made and shown on a published page: “a”/, /tried and not made[^\n]*“b”/, /never tried, because the build ran out of time[^\n]*“c”/, /did not put on the page[^\n]*“d”/, /never offered[^\n]*at most 6[^\n]*“e”/, /whether any of them was made is not known: “g”/, /Their own photographs[^\n]*“h”/,
    /u\.example was read and its text used in full/, /p\.example was read, but only the first 10 of its 20/, /r\.example could not be read \(it blocked us\)/, /o\.example was not opened/, /web lookup was tried and found nothing/, /left out for now[^\n]*“the price list”/, /“menu” did not compile/, /\(6 credits\) has been returned/]) {
    assert.match(text, want);
  }
  assert.equal(new Set(f.map((x) => x.id)).size, f.length, "two facts share an id");
  assert.deepEqual(buildReplyFacts(null).facts, []);
});

// ── pictures, independent of the purchase's return ─────────────────────────

const PLAN = normalizePlan({ ...GOOD_DESIGN, images: [
  { page: "/", describe: "their shop", attached: "attachment-1", src: "/u/harbour-loaf/a.jpg" },
  ...Array.from({ length: 8 }, (_, i) => ({ page: "/", describe: "picture " + (i + 1) })),
] });
const NOT_OFFERED = [7, 8].map((n) => ({ page: "/", describe: "picture " + n, why: "cap" }));

test("pictures: a purchase that THROWS keeps the planned identities and the not-offered reasons; the ones it was buying are unknown — never made, never failed", async () => {
  const boom = Promise.reject(new Error("the picture service threw"));
  let caught = null;
  try { await withPictureFacts(boom, { plan: PLAN, budget: 6, notOffered: NOT_OFFERED }); } catch (e) { caught = e; }
  assert.ok(caught, "the throw was swallowed");
  assert.equal(caught.message, "the picture service threw");
  const by = (st) => caught.pictures.filter((x) => x.status === st).map((x) => x.describe);
  assert.deepEqual(by("own"), ["their shop"]);
  assert.deepEqual(by("unknown"), ["picture 1", "picture 2", "picture 3", "picture 4", "picture 5", "picture 6"]);
  assert.deepEqual(by("not-offered"), ["picture 7", "picture 8"]);
  assert.deepEqual(by("made"), []);
  assert.deepEqual(by("failed"), []);
  assert.deepEqual(caught.notOffered, NOT_OFFERED);
});

test("pictures: a purchase that RETURNS tells made, failed, not attempted and not placed apart from what it recorded", async () => {
  const r = await withPictureFacts(Promise.resolve({
    made: 2, bought: [{ key: "picture 1", url: "/u/x/1.jpg" }, { key: "picture 2", url: "/u/x/2.jpg" }],
    attempted: ["picture 1", "picture 2", "picture 3"], notTried: ["picture 4"], slow: true,
  }), { plan: PLAN, budget: 6, notOffered: NOT_OFFERED });
  const st = Object.fromEntries(r.pictures.map((x) => [x.describe, x.status + (x.why ? "/" + x.why : "")]));
  assert.deepEqual(st, {
    "their shop": "own", "picture 1": "made", "picture 2": "made", "picture 3": "failed", "picture 4": "not-attempted/time",
    "picture 5": "not-placed", "picture 6": "not-placed", "picture 7": "not-offered/cap", "picture 8": "not-offered/cap",
  });
  assert.deepEqual(r.notOffered, NOT_OFFERED);
});

test("pictures: publishPages keeps the facts the hook carried on its throw, beside the error", async () => {
  const PAGE = { path: "index.tsx", source: 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: Page });\nfunction Page() { return <div>Harbour Loaf</div>; }' };
  const out = await publishPages({
    generate: async () => ({ input: { pages: [PAGE], notes: "" }, usage: { in: 1, out: 1, cacheRead: 0, cacheWrite: 0 } }),
    compile: async () => ({ ok: true, files: { "index.html": { t: "<built>" } } }),
    publish: async () => {}, readCredits: async () => 500, useCredits: async (n) => n,
    images: (pages) => withPictureFacts(Promise.reject(new Error("boom")), { plan: PLAN, budget: 6, notOffered: NOT_OFFERED }),
  }, { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.match(out.images.error, /boom/);
  assert.equal(out.images.pictures.filter((x) => x.status === "unknown").length, 6);
  assert.deepEqual(out.images.notOffered, NOT_OFFERED);
  assert.equal(buildFacts({ images: out.images }).pictures.length, 9);
});

test("pictures CONTROL: no planned pictures — no picture facts, and no facts at all", () => {
  assert.deepEqual(pictureOutcomes({ plan: normalizePlan({ ...GOOD_DESIGN, images: [] }), budget: 0 }), []);
  assert.equal(buildFacts({}), null);
});

test("inline: a build answered on the connection carries the same facts — two links unread, one unopened — and, with the writer down, says unavailable rather than inventing a reply", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: { brief: BRIEF + " Like https://a.example and https://b.example and https://c.example.", images: [], qa: [], chat: "c" }, env: { MODEL_REPLIES: "on" } });
  assert.deepEqual(statuses(r.reply.buildFacts.sources), ["a.example:unread", "b.example:unread", "c.example:unopened"]);
  assert.equal(r.reply.replyState, "unavailable");
  assert.equal(r.reply.reply, undefined);
});
