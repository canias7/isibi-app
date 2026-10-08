// THE EIGHTH BUILD BATCH (2026-10-08, Codex's review of `ff1fd469`), the
// three gaps it found, each through the real lifecycle where one exists:
//
//   1  NO REPEATED NARRATION WHILE A REFUND IS SHORT. Codex kept the pages
//      refund unavailable across two real recovery passes with storage
//      working; both recorded the same return of 4 and `short`, and the second
//      pass dropped the saved narration and paid the reply model again for an
//      identical request. The explanation is now kept across every rewrite of
//      the settlement record, tied to the facts it explains, reused while they
//      are unchanged, written anew when they change, claimed before any paid
//      call, and never paid for again when an earlier attempt is uncertain.
//   2  PICTURE PUBLICATION FROM WHAT THE ROUTES RENDER. Codex published a page
//      that never imports or renders a component holding a bought photograph,
//      and it was told as on the site. Visibility now comes from the published
//      routes and the components they actually render; without that evidence
//      the narrower fact (in the published files, unconfirmed) is told.
//   3  THE ORDINARY INLINE FAILURES, MODEL-WRITTEN. The designer's answer
//      unusable, past its room or past the time ceiling, a held part that
//      could not be separated, and the page writer or compiler failing are told
//      from a `failure` fact; outages keep their fixed messages.
//
// Every model answer is a stand-in; the ledger is a stand-in; R2 is a Map with
// R2's conditions. Nothing runs against production.

import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, BUILD_USER, GOOD_DESIGN } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { ledger, fireInterim, replyAnswer } from "./fixtures/build-lifecycle.mjs";
import { resultKey, readResult, resultKind, narrationKey, narrationPlan, newerNarration } from "../builder/build-job.mjs";
import { withPictureFacts, shotKey } from "../builder/site-images.mjs";
import { picturesShown } from "../builder/rendered-pictures.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { publishPages } from "../builder/publish-pages.mjs";
import { normalizePlan } from "../builder/site-plan.mjs";
import { tweakParser } from "../builder/site-tweak.mjs";

const SLUG = GOOD_DESIGN.slug;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "e8c3d4e5f60718293a4b5c6d7e8f9";
const REPLY_ENV = { MODEL_REPLIES: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };

/**
 * One recovery pass over the lost row. `pagesDown` makes the pages refund's
 * reversal fail (the ledger answers 500 for that ref), which is Codex's
 * setup: deposit and settle come back (2 + 2), pages does not, `short`.
 */
async function tick(b, id, led, { env = {}, onFetch = null, pagesDown = false } = {}) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const row = { id, uid: BUILD_USER.id, slug: SLUG, op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z" };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (onFetch) { const r = await onFetch(u, init); if (r) return r; }
    if (/\/rest\/v1\/rpc\/credit_reverse/.test(u)) {
      const a = JSON.parse(String((init && init.body) || "{}"));
      if (pagesDown && String(a.p_ref || "").endsWith(":pages")) return new Response("ledger down", { status: 500 });
      return json(led.answer(a));
    }
    if (u.includes("/rest/v1/edit_jobs")) return json([row]);
    return json([]);
  };
  try { return await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", SITES_BUCKET: b, ...env }, { now: Date.parse("2026-10-08T12:00:00Z") }); }
  finally { globalThis.fetch = real; }
}

const answerOf = (b, id) => { const raw = b.store.get(resultKey(id)); if (!raw) return null; const v = JSON.parse(raw); const r = readResult(v); return { status: r.status, body: JSON.parse(r.body), kind: resultKind(v) }; };
const settlement = (b, id) => JSON.parse(b.store.get("jobs/" + id + ".lost.json") || "null");

/** The reply writer stood in, counting calls; `replies` answered in turn, `gate` held before answering. */
function writer(replies, { gate = null } = {}) {
  const seen = [];
  let i = 0;
  let reachedR; const reached = new Promise((r) => { reachedR = r; });
  const onFetch = async (u, init) => {
    if (!(u.includes("/v1/messages") || u.includes("/chat/completions"))) return null;
    const bd = JSON.parse(String((init && init.body) || "{}"));
    if (!(bd.tool_choice && bd.tool_choice.name === "write_reply")) return null;
    reachedR();
    if (gate) await gate;
    const reply = Array.isArray(replies) ? replies[Math.min(i, replies.length - 1)] : replies;
    i++;
    return replyAnswer(reply, seen, init);
  };
  return { seen, onFetch, reached };
}

// ── 1. no repeated narration while a refund is short ───────────────────────

test("1 (Codex's reproduction): the pages refund unavailable across two real passes, storage working — both record 4 and short, and the reply model is asked ONCE; the second pass reuses the explanation", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer("Your build stopped before it went live; I've returned 4 credits so far and the rest is on its way.");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  const s1 = settlement(b, id);
  assert.equal(s1.returned, 4);
  assert.equal(s1.short, true);
  assert.equal(s1.settled, false);
  assert.equal(w.seen.length, 1);
  assert.equal(s1.narration.state, "written");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  const s2 = settlement(b, id);
  assert.equal(s2.returned, 4);
  assert.equal(s2.short, true);
  assert.equal(w.seen.length, 1, "the second pass paid the reply model again for the same facts");
  assert.equal(s2.narration && s2.narration.state, "written", "the settlement rewrite dropped the narration");
  assert.equal(s2.narration.key, s1.narration.key);
  const a = answerOf(b, id);
  assert.equal(a.body.replySource, "model");
  assert.match(a.body.reply, /returned 4 credits so far/);
  assert.equal(a.body.buildFacts.settlement.short, true);
});

test("1 CONTROL (facts changed): the third pass returns the rest — the amount and outcome change, so the explanation is written again, not the stale one reused", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer(["Returned 4 credits so far; the rest is on its way.", "Your build stopped before it went live, so I returned all 6 credits it took."]);
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(w.seen.length, 1);
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  const s = settlement(b, id);
  assert.equal(s.returned, 6);
  assert.equal(s.short, false);
  assert.equal(w.seen.length, 2, "changed facts were told with the stale explanation");
  const a = answerOf(b, id);
  assert.match(a.body.reply, /returned all 6 credits/);
  assert.doesNotMatch(a.body.reply, /so far/);
  assert.equal(s.narration.key, narrationKey(a.body.buildFacts), "the kept explanation is not tied to the facts it explains");
  // Settled and delivered: later passes reuse it, never asking again.
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch });
  assert.equal(w.seen.length, 2);
});

test("1: OVERLAPPING passes — the second finds the first's claim and never calls the writer; the final answer carries the first's explanation", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  let release; const gate = new Promise((r) => { release = r; });
  const w = writer("Returned 4 credits so far; the rest is on its way.", { gate });
  const first = tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  await w.reached;
  const free = writer("SHOULD NEVER BE ASKED");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: free.onFetch, pagesDown: true });
  assert.equal(free.seen.length, 0, "an overlapping pass paid for the same explanation");
  const held = answerOf(b, id);
  assert.equal(held.body.replyState, "unavailable");
  assert.equal(held.body.replyWhy, "attempt-uncertain");
  release();
  await first;
  assert.equal(w.seen.length, 1);
  const a = answerOf(b, id);
  assert.equal(a.body.replySource, "model");
  assert.match(a.body.reply, /4 credits so far/);
  assert.equal(settlement(b, id).narration.state, "written");
});

test("1: the narration's SAVE fails — the answer still carries it, the claim stands, and the next pass neither pays again nor replaces the delivered text", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const put = b.put.bind(b);
  let failed = 0;
  b.put = async (k, v, o) => {
    if (failed === 0 && k === "jobs/" + id + ".lost.json" && String(v).includes('"state":"written"')) { failed++; throw new Error("r2 down"); }
    return put(k, v, o);
  };
  const w = writer("Returned 4 credits so far; the rest is on its way.");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(failed, 1, "the save was never attempted — the case did not happen");
  assert.equal(w.seen.length, 1);
  assert.equal(answerOf(b, id).body.replySource, "model");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(w.seen.length, 1, "uncertainty about the earlier attempt triggered another paid call");
  const a = answerOf(b, id);
  assert.equal(a.body.replySource, "model", "the hold replaced the delivered explanation with the facts alone");
  assert.match(a.body.reply, /4 credits so far/);
});

test("1: the claim CANNOT be written — nothing is paid for this pass, the facts go out alone; a later pass that can claim narrates once", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const put = b.put.bind(b);
  let blocked = 0;
  b.put = async (k, v, o) => {
    if (blocked === 0 && k === "jobs/" + id + ".lost.json" && String(v).includes('"state":"attempting"')) { blocked++; throw new Error("r2 down"); }
    return put(k, v, o);
  };
  const w = writer("Returned 4 credits so far.");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(blocked, 1);
  assert.equal(w.seen.length, 0, "a call was made without a durable claim");
  assert.equal(answerOf(b, id).body.replyWhy, "attempt-unrecorded");
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(w.seen.length, 1);
  assert.equal(answerOf(b, id).body.replySource, "model");
});

test("1: the rule itself — reuse for the same facts, call for changed ones, hold on an uncertain claim or unreadable facts; the newer record wins a merge", () => {
  const k1 = narrationKey({ settlement: { refunded: 4, short: true } });
  const k2 = narrationKey({ settlement: { refunded: 6, short: false } });
  assert.notEqual(k1, k2);
  assert.equal(narrationKey({ a: 1, b: 2 }), narrationKey({ b: 2, a: 1 }), "the fingerprint depends on key order");
  const written = { state: "written", text: "x", key: k1, settlementKey: "s1", at: "2026-10-08T12:00:00Z" };
  assert.equal(narrationPlan(written, k1).act, "reuse");
  assert.equal(narrationPlan(written, k2).act, "call");
  assert.equal(narrationPlan({ state: "attempting", key: k1 }, k1).act, "hold");
  assert.equal(narrationPlan({ state: "attempting", key: k1 }, k2).act, "call");
  assert.equal(narrationPlan({ state: "not-attempted", key: k1 }, k1).act, "call", "a switch that was off never blocks a later attempt");
  assert.equal(narrationPlan(written, k1, { factsUnread: true, settlementKey: "s1" }).act, "reuse");
  assert.equal(narrationPlan(written, k1, { factsUnread: true, settlementKey: "s2" }).act, "hold");
  assert.equal(narrationPlan(null, k1).act, "call");
  const later = { state: "attempting", key: k2, at: "2026-10-08T12:05:00Z" };
  assert.equal(newerNarration(written, later), later);
  assert.equal(newerNarration(written, null), written);
  assert.equal(newerNarration({ state: "attempting", key: k1, at: written.at }, written), written);
});

// ── 2. picture publication from what the routes render ─────────────────────

const URL_A = "/uploads/harbour-loaf/a.jpg";
const PLAN = normalizePlan({ ...GOOD_DESIGN, images: [{ page: "/", describe: "a loaf on the counter" }] });
const routeSrc = (body, imports = "") => imports + 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: Page });\nfunction Page() { return ' + body + "; }";
const HERO = { name: "hero", source: 'export default function Hero() { return <section><img src="PIC_A" alt="a loaf on the counter" /></section>; }' };
/** The purchase as the real hook ends, the address put into pages and parts alike. */
const bought = (pages, { parts }) => withPictureFacts(Promise.resolve({
  pages: pages.map((p) => ({ ...p, source: p.source.replace("PIC_A", URL_A) })),
  parts: parts.map((p) => ({ ...p, source: p.source.replace("PIC_A", URL_A) })),
  made: 1, planned: 1, budget: 6, overflow: 0,
  bought: [{ key: shotKey("a loaf on the counter"), url: URL_A }],
  attempted: [shotKey("a loaf on the counter")], notTried: [], refused: [], unresolved: [],
}), { plan: PLAN, budget: 6 });
const gen = (pages, parts = []) => async () => ({ input: { pages, parts, notes: "" }, usage: { in: 1, out: 1, cacheRead: 0, cacheWrite: 0 } });
const base = (over) => ({ parser: tweakParser, compile: async () => ({ ok: true, files: { "index.html": { t: "<built>" } } }), publish: async () => {}, readCredits: async () => 500, useCredits: async (n) => n, images: bought, ...over });
const stage = (out) => (out.images.pictures.find((x) => x.describe === "a loaf on the counter") || {}).stage;
const told = (out) => buildReplyFacts(buildFacts({ images: out.images })).facts.map((f) => f.text || f).join("\n");

test("2 (Codex's reproduction): the page never imports or renders the component holding the bought photograph — not shown, and the reply writer is never told it is on the site", async () => {
  const out = await publishPages(base({ generate: gen([{ path: "index.tsx", source: routeSrc("<div>Harbour Loaf</div>") }], [HERO]) }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.equal(out.page, "app");
  assert.equal(stage(out), "not-shown");
  const said = told(out);
  assert.doesNotMatch(said, /shown on a published page|published on the site|put on the site/, "a photograph no page renders was told as on the site:\n" + said);
  assert.match(said, /no published page shows them[^\n]*a loaf on the counter/);
});

test("2 CONTROL: the page imports AND renders the component — the photograph is shown on a published page", async () => {
  const out = await publishPages(base({ generate: gen([{ path: "index.tsx", source: routeSrc("<div><Hero /></div>", 'import Hero from "@/routes/-parts/hero";\n') }], [HERO]) }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.equal(out.page, "app");
  assert.equal(stage(out), "published");
  assert.match(told(out), /shown on a published page: “a loaf on the counter”/);
});

test("2: imported but never rendered, rendered only behind a condition, in a comment, in an unused string — none is claimed as shown", async () => {
  const cases = {
    "imported, not rendered": [{ path: "index.tsx", source: routeSrc("<div>Hi</div>", 'import Hero from "@/routes/-parts/hero";\n') }],
    "behind a condition": [{ path: "index.tsx", source: routeSrc("<div>{open && <Hero />}</div>", 'import Hero from "@/routes/-parts/hero";\nconst open = Date.now() > 1;\n') }],
  };
  const want = { "imported, not rendered": "not-shown", "behind a condition": "unconfirmed" };
  for (const [name, pages] of Object.entries(cases)) {
    const out = await publishPages(base({ generate: gen(pages, [HERO]) }), { spec: { tables: [] }, slug: "harbour-loaf" });
    assert.equal(stage(out), want[name], name);
    assert.doesNotMatch(told(out), /shown on a published page/, name);
  }
  const P = await tweakParser();
  const pageWith = (pre) => [{ path: "index.tsx", source: pre + routeSrc("<div>Hi</div>") }];
  assert.equal(picturesShown([URL_A], { pages: pageWith("// " + URL_A + "\n"), parts: [], parse: P }).get(URL_A), "no", "a comment counted");
  assert.equal(picturesShown([URL_A], { pages: pageWith('const OLD = "' + URL_A + '";\n'), parts: [], parse: P }).get(URL_A), "no", "an unused string counted");
  assert.equal(picturesShown([URL_A], { pages: [{ path: "index.tsx", source: routeSrc('<img src="' + URL_A + '" />') }], parts: [], parse: P }).get(URL_A), "yes");
});

test("2: a component DISCONNECTED BY SALVAGE — its only page was stubbed, so the published site never renders it", async () => {
  let calls = 0;
  const HOME = { path: "index.tsx", source: routeSrc("<div>Harbour Loaf</div>") };
  const MENU = { path: "menu.tsx", source: 'import Hero from "@/routes/-parts/hero";\nimport { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/menu")({ component: Page });\nfunction Page() { return <div><Hero /></div>; }' };
  const out = await publishPages(base({
    generate: gen([HOME, MENU], [HERO]),
    compile: async () => (++calls === 1 ? { ok: false, stage: "typecheck", error: "src/routes/menu.tsx(4,40): error TS2322: Type 'x' is not assignable." } : { ok: true, files: { "index.html": { t: "<built>" } } }),
  }), { spec: { tables: [] }, slug: "harbour-loaf", livePages: [] });
  assert.equal(out.page, "app");
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(stage(out), "not-shown");
  assert.doesNotMatch(told(out), /shown on a published page/);
});

test("2: NO PARSER (a Worker bundle) — the narrower fact: in the published files, visibility unconfirmed, never 'on the site'", async () => {
  const out = await publishPages(base({ parser: async () => null, generate: gen([{ path: "index.tsx", source: routeSrc("<div><Hero /></div>", 'import Hero from "@/routes/-parts/hero";\n') }], [HERO]) }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.equal(stage(out), "unconfirmed");
  const said = told(out);
  assert.match(said, /could not be confirmed, so do not say they are on the site[^\n]*a loaf on the counter/);
  assert.doesNotMatch(said, /shown on a published page/);
});

// ── 3. the ordinary inline failures, model-written ─────────────────────────

const replyFetch = (reply, seen) => async (u, init) => {
  if (!u.includes("/v1/messages")) return null;
  const bd = JSON.parse(String((init && init.body) || "{}"));
  if (!(bd.tool_choice && bd.tool_choice.name === "write_reply")) return null;
  return replyAnswer(reply, seen, init);
};

test("3: the designer's answer UNUSABLE, inline — the failure fact is told by the reply writer, with what it cost; the canned sentence is not the explanation", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const seen = [];
  const r = await driveBuild({ design: { text: "Here is a design." }, body: { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" }, env: REPLY_ENV, onFetch: replyFetch("The designer didn't give me a plan I could build from, so nothing was built and nothing was charged.", seen) });
  assert.equal(r.reply.stage, "design");
  assert.equal(r.reply.buildFacts.failure.kind, "design-unusable", "the stop carries no failure fact: " + JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.replySource, "model");
  assert.match(r.reply.reply, /nothing was charged/);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /did not send back a usable plan/);
  assert.match(seen[0], /Nothing was charged/);
});

test("3: the designer unusable with the writer DOWN — unavailable, and the failure fact kept for the page to show", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ design: { text: "Here is a design." }, body: { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" }, env: REPLY_ENV });
  assert.equal(r.reply.buildFacts.failure.kind, "design-unusable");
  assert.equal(r.reply.replyState, "unavailable");
  assert.equal(r.reply.reply, undefined);
});

test("3 CONTROL: an OUTAGE keeps its fixed message — the designer's provider out of balance carries no failure fact and no narration", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const seen = [];
  const r = await driveBuild({
    design: { text: "unused" }, body: { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" }, env: REPLY_ENV,
    onFetch: async (u, init) => {
      if (!u.includes("/v1/messages")) return null;
      const bd = JSON.parse(String((init && init.body) || "{}"));
      if (bd.tool_choice && bd.tool_choice.name === "design_schema") return json({ type: "error", error: { type: "billing_error", message: "credit balance is too low" } }, 400);
      return replyFetch("SHOULD NOT BE ASKED", seen)(u, init);
    },
  });
  assert.equal(r.reply.stage, "design");
  assert.equal(r.reply.buildFacts, undefined, "an outage was given an ordinary failure fact");
  assert.equal(seen.length, 0);
  assert.match(r.reply.msg, /temporarily unavailable/);
});

test("3: the facts and the page agree — each failure kind gives one fact for the writer and one label for the page", () => {
  for (const kind of ["design-unusable", "design-truncated", "design-timeout", "held-unread", "generate-failed", "compile-failed"]) {
    const bf = buildFacts({ failure: { kind, cost: kind.startsWith("design") || kind === "held-unread" ? 0 : 12, short: false } });
    assert.equal(bf.failure.kind, kind);
    const facts = buildReplyFacts(bf).facts.map((f) => f.text || f).join("\n");
    assert.match(facts, kind === "generate-failed" || kind === "compile-failed" ? /This build cost 12 credits/ : /Nothing was charged/, kind);
  }
  assert.equal(buildFacts({ failure: { kind: "provider-busy" } }), null, "an outage kind entered the facts");
  assert.match(buildReplyFacts(buildFacts({ failure: { kind: "design-unusable", cost: 0, short: true } })).facts.map((f) => f.text || f).join("\n"), /has not fully gone through yet/);
});

test("3: the PAGE WRITER fails inline after a good design — generate-failed, told by the reply writer from the fact, with the placeholder answer's own cost", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const seen = [];
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" }, env: REPLY_ENV, onFetch: replyFetch("I couldn't write the pages this time; your site shows a simple placeholder for now. Send it again to retry.", seen) });
  assert.equal(r.reply.page, "placeholder", JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.buildFacts && r.reply.buildFacts.failure && r.reply.buildFacts.failure.kind, "generate-failed");
  assert.equal(r.reply.buildFacts.failure.cost, r.reply.cost, "the fact's cost is not the answer's own reading");
  assert.equal(r.reply.replySource, "model");
  assert.equal(seen.length, 1);
  assert.match(seen[0], /writing the pages did not work this time/);
});

// ── the survivors' questions, answered through the real lifecycle ──────────

test("1: a pass whose view of the record is STALE (another pass narrated while this one was refunding) still keeps the stored explanation — no second call", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer("Returned 4 credits so far; the rest is on its way.");
  // Pass B reads the record (none yet), then is held at its first refund call.
  let releaseB, reachedBR; const gateB = new Promise((r) => { releaseB = r; }); const reachedB = new Promise((r) => { reachedBR = r; });
  let armed = true;
  const passB = tick(b, id, led, { env: REPLY_ENV, pagesDown: true, onFetch: async (u, init) => {
    if (armed && /credit_reverse/.test(u)) { armed = false; reachedBR(); await gateB; }
    return w.onFetch(u, init);
  } });
  await reachedB;
  // Pass A runs whole meanwhile: it settles short and narrates.
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(w.seen.length, 1);
  assert.equal(settlement(b, id).narration.state, "written");
  releaseB();
  await passB;
  assert.equal(w.seen.length, 1, "the stale pass dropped the stored explanation and paid again");
  assert.equal(settlement(b, id).narration.state, "written");
  assert.equal(answerOf(b, id).body.replySource, "model");
});

test("1: two passes RACE AT THE CLAIM (both read no claim) — the conditional write lets exactly one claim, and the writer is asked once", async () => {
  const id = newId();
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, id, led);
  const w = writer("Returned 4 credits so far; the rest is on its way.");
  // Hold pass A's claim write until pass B has claimed and narrated.
  const put = b.put.bind(b);
  let release, reachedR; const gate = new Promise((r) => { release = r; }); const reached = new Promise((r) => { reachedR = r; });
  let armed = true;
  b.put = async (k, v, o) => {
    if (armed && k === "jobs/" + id + ".lost.json" && String(v).includes('"state":"attempting"')) { armed = false; reachedR(); await gate; }
    return put(k, v, o);
  };
  const passA = tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  await reached;
  await tick(b, id, led, { env: REPLY_ENV, onFetch: w.onFetch, pagesDown: true });
  assert.equal(w.seen.length, 1);
  release();
  await passA;
  assert.equal(w.seen.length, 1, "both racing passes claimed and paid");
  assert.equal(settlement(b, id).narration.state, "written");
});

test("2: THROUGH THE WORKER — a real queued build buys a picture its page renders; the resume's publish reads the page with the parser it is given and says it is shown", async () => {
  const { finishResume } = await import("./fixtures/build-lifecycle.mjs");
  const { JPEG_DATA } = await import("./fixtures/build-route.mjs");
  const b = buildBucket();
  const id = newId();
  await fireInterim(b, id, ledger());
  const jpeg = Uint8Array.from(Buffer.from(JPEG_DATA.split(",")[1], "base64"));
  await finishResume(b, id, ledger(), {
    credits: 400, env: { FAL_KEY: "k" },
    source: routeSrc('<div><img src="@@IMG:a loaf at dawn@@" alt="a loaf" />Harbour Loaf</div>'),
    over: async (u) => (u.includes("fal.run") ? json({ images: [{ url: "https://img.test/a.jpg" }] })
      : u.includes("img.test") ? new Response(jpeg, { status: 200 }) : null),
  });
  const body = answerOf(b, id).body;
  assert.equal(body.page, "app", JSON.stringify(body).slice(0, 300));
  const pic = body.images.pictures.find((x) => x.describe === "a loaf at dawn");
  assert.equal(pic && pic.status, "made");
  assert.equal(pic.stage, "published", "the Worker's publish did not read what its page renders: " + JSON.stringify(pic));
  assert.match(buildReplyFacts(body.buildFacts).facts.map((f) => f.text || f).join("\n"), /shown on a published page: “a loaf at dawn”/);
});
