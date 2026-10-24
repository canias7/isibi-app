// THE FIRST BUILD ASKS AS EDITS DO (2026-10-24, build questions).
//
// The owner: give the first build the same question and suggestion behaviour
// edits have. The parity audit found three gaps, each driven here through the
// real code with every model answer supplied — never a paid call:
//   1. the first build's page writers (the one call, the bands, the header and
//      footer) are offered the shared question field (`QUESTION_FIELD`); a
//      writer that asks stops the build before anything is compiled, published
//      or charged, the deposit goes back as the design question's does, and the
//      route answers `intent: "clarify"`, `stage: "pages"`; one question per
//      build — a build that already carries an answer is not offered it;
//   2. the question is kept on the server (`packAsk`, the brief as the request,
//      `by: "build:pages"`) and the router's answer path resumes it: this
//      owner's, pending, within the day, closed once;
//   3. a build's reply is shown the suggestions already made in its chat.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: whether a real writer asks a good question, and
// only when it should, is a live measurement this file cannot make.
import test from "node:test";
import assert from "node:assert/strict";
import { GOOD_DESIGN, BUILD_USER } from "./fixtures/build-route.mjs";
import { QUESTION_KEY, QUESTION_FIELD, packAsk, newAskId, ASK_TTL_MS, readAskRecord } from "../builder/clarify.mjs";
import { generateSiteBands, BAND_TOOL, BAND_TOOL_ASK } from "../builder/page-bands.mjs";
import { pagesRequest, SITE_PAGES_TOOL, SITE_PAGES_TOOL_ASK } from "../builder/page-gen.mjs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { USER, freshSlug, bucket, question, withWire, envFor, routeCall } from "./fixtures/live-ask.mjs";

const BRIEF = "Harbour Loaf, a bakery in Leeds.";
const BODY = { brief: BRIEF, images: [], qa: [], chat: "chat-build-1" };
const ASK = { text: "Do people collect their loaves, or do you deliver?", options: ["Collection only", "We deliver"] };

/** A ledger whose reversals remember what each ref already gave back, as `credit_reverse` does. */
function stateLedger() {
  const debited = new Map();
  const back = new Map();
  return {
    debited, back,
    credit_debit: (a) => { const n = Number(a.p_amount) || 2; debited.set(a.p_ref, (debited.get(a.p_ref) || 0) + n); return { ok: true, exempt: false, taken: n, balance: 500, repeat: false }; },
    credit_reverse: (a) => {
      const had = debited.get(a.p_ref) || 0;
      const already = back.get(a.p_ref) || 0;
      const refunded = Math.max(0, Math.min(Number(a.p_amount) || 0, had - already));
      back.set(a.p_ref, already + refunded);
      return { ok: true, refunded, already, debited: had, repeat: false };
    },
  };
}
const owedOf = (l) => [...l.debited].reduce((n, [ref, d]) => n + d - (l.back.get(ref) || 0), 0);

// ── 1. THE ONE-CALL WRITER, THROUGH THE REAL BUILD ROUTE ───────────────────

test("BQ 1 — the first build's page writer is offered the question and asks: nothing compiled or published, every credit back, `clarify` at `pages`, the question kept on the server for this owner", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const led = stateLedger();
  const offered = [];
  const r = await driveBuild({
    body: BODY, ledger: led, design: () => ({ input: GOOD_DESIGN }),
    pages: (b) => { offered.push(b.tools[0]); return { input: { question: ASK } }; },
  });
  assert.equal(offered.length, 1, "the page writer was not asked exactly once");
  assert.deepEqual(offered[0].input_schema.properties.question, QUESTION_FIELD, "the first build's writer was not offered the shared question field");
  assert.equal(r.status, 200);
  assert.equal(r.reply.intent, "clarify");
  assert.equal(r.reply.stage, "pages");
  assert.equal(r.reply.question.text, ASK.text);
  assert.deepEqual(r.reply.question.options, ASK.options);
  assert.match(r.reply.question.id, /^[0-9a-f]{32}$/);
  assert.equal(r.reply.askSlug, "harbour-loaf");
  // NOTHING CHARGED: the deposit (and any settle) came back in full.
  assert.equal(r.reply.cost, 0);
  assert.equal(r.reply.refundShort, undefined, JSON.stringify(r.reply));
  assert.ok(led.debited.size > 0, "OBSERVER: no debit was made, so a refund proves nothing");
  assert.equal(owedOf(led), 0, "credits stayed on the ledger for a build that asked");
  assert.ok(r.seen.rpc.some((c) => c.fn === "credit_reverse" && /deposit/.test(String(c.args.p_ref))), "the deposit was not returned");
  // NOTHING BUILT AFTER THE QUESTION: no frame repair, no publish, no source kept.
  assert.deepEqual(r.seen.tools, ["design_schema", "write_pages"], "something ran after the writer asked");
  assert.ok(![...r.store.keys()].some((k) => k.startsWith("current/harbour-loaf")), "a live pointer was written");
  assert.ok(!r.store.has("source/harbour-loaf/answer.json"), "the question was kept as the build's answer");
  // KEPT ON THE SERVER, as an edit's question is.
  const rec = readAskRecord(r.store.get(QUESTION_KEY("harbour-loaf")));
  assert.ok(rec, "no question was stored");
  assert.equal(rec.id, r.reply.question.id);
  assert.equal(rec.uid, BUILD_USER.id);
  assert.equal(rec.status, "pending");
  assert.equal(rec.stage, "route");
  assert.equal(rec.by, "build:pages");
  assert.equal(rec.request, BRIEF, "the request the answer resumes is not the brief");
  assert.deepEqual(rec.question, { text: ASK.text, options: ASK.options });
});

test("BQ 2 — ONE QUESTION PER BUILD: a build already carrying an answer is sent the writer's tool without the field, and a question-shaped answer is not read as one", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const offered = [];
  const r = await driveBuild({
    body: { ...BODY, qa: [{ q: ASK.text, a: "Collection only" }] }, design: () => ({ input: GOOD_DESIGN }),
    pages: (b) => { offered.push(b.tools[0]); return { input: { question: ASK } }; },
  });
  assert.ok(offered.length >= 1, "OBSERVER: the page writer was never called");
  assert.equal(offered[0].input_schema.properties.question, undefined, "a build that already asked was offered a second question");
  assert.notEqual(r.reply.intent, "clarify");
  assert.ok(!r.store.has(QUESTION_KEY("harbour-loaf")), "a second question was stored");
});

test("BQ 2b — \"JUST BUILD IT\": a build sent with `noAsk` (the round skipped) is not offered the question either", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const offered = [];
  await driveBuild({ body: { ...BODY, noAsk: true }, design: () => ({ input: GOOD_DESIGN }), pages: (b) => { offered.push(b.tools[0]); return { input: { pages: [] } }; } });
  assert.ok(offered.length >= 1, "OBSERVER: the page writer was never called");
  assert.equal(offered[0].input_schema.properties.question, undefined, "a skipped round was offered a question");
});

test("BQ 3 — CONTROL: a writer that writes, with the field offered, builds as before; no question is kept", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, design: () => ({ input: GOOD_DESIGN }), pages: () => ({ input: { pages: [] } }) });
  assert.notEqual(r.reply.intent, "clarify");
  assert.notEqual(r.reply.stage, "pages");
  assert.ok(!r.store.has(QUESTION_KEY("harbour-loaf")));
});

test("BQ 4 — the request: `ask` alone puts the question on a build's writer; a revise is unchanged, byte for byte", () => {
  const base = { brief: "b", spec: { tables: [] }, brand: "B" };
  assert.equal(pagesRequest({ ...base, ask: true }).tools[0], SITE_PAGES_TOOL_ASK);
  assert.equal(pagesRequest({ ...base }).tools[0], SITE_PAGES_TOOL);
  assert.equal(JSON.stringify(pagesRequest({ ...base })), JSON.stringify(pagesRequest({ ...base, ask: false })));
});

// ── 1b. THE BAND AND FRAME WRITERS ─────────────────────────────────────────

const LINES = ["hero — loaves", "menu — the breads", "visit — the shop"];
const done = (i, input) => ({ i, state: "done", ms: 10, waveMs: 20, answer: { stop_reason: "tool_use", content: [{ type: "tool_use", name: "write_band", input }], usage: { input_tokens: 5, output_tokens: 5 } } });
const SRC = (n) => ({ source: "function " + n + "() { return <section>x</section>; }" });

test("BQ 5 — the bands and the header and footer are offered the question on a first build; the first to ask in page order is the one question, and nothing of the fan-out is assembled", async () => {
  let sent = null;
  const call = async (_k, reqs) => {
    sent = reqs;
    return reqs.map((_, i) => (i === 2 ? done(i, { question: ASK }) : i === 4 ? done(i, { question: { text: "A later one?", options: ["a", "b"] } }) : done(i, SRC("B" + i))));
  };
  const out = await generateSiteBands({ brief: "b", spec: { tables: [] }, brand: "B", route: "/", lines: LINES, chrome: {}, ask: true }, {}, call);
  assert.ok(sent && sent.length === LINES.length + 2, "OBSERVER: the bands and the frame were not all sent");
  for (const r of sent) assert.equal(r.tools[0], BAND_TOOL_ASK, "a writer was not offered the question");
  assert.equal(out.input, null, "a page was assembled beside an unanswered question");
  assert.deepEqual(out.ask, { text: ASK.text, options: ASK.options });
  assert.ok(out.usage.in > 0, "the fan-out's usage was dropped");
});

test("BQ 6 — CONTROL: without `ask` the writers get the tool they always did, and a question-shaped answer is never read", async () => {
  let sent = null;
  const call = async (_k, reqs) => { sent = reqs; return reqs.map((_, i) => (i === 0 ? done(i, { question: ASK, source: SRC("B0").source }) : done(i, SRC("B" + i)))); };
  const out = await generateSiteBands({ brief: "b", spec: { tables: [] }, brand: "B", route: "/", lines: LINES, chrome: {} }, {}, call);
  for (const r of sent) assert.equal(r.tools[0], BAND_TOOL);
  assert.equal(out.ask, undefined);
  assert.ok(out.input && out.input.pages.length === 1);
});

// ── 2. THE ANSWER, THROUGH THE ROUTER'S ANSWER PATH ────────────────────────

const seedBuildQ = (store, slug, over = {}) => {
  const rec = packAsk({ id: newAskId(), uid: USER.id, slug, stage: "route", round: 1, question: ASK, request: BRIEF, held: [], at: Date.now(), by: "build:pages", ...over });
  assert.ok(rec, "OBSERVER: the seeded question is not a question");
  store.poke(QUESTION_KEY(slug), JSON.stringify(rec));
  return rec;
};

test("BQ 7 — an answer to the build's kept question is read, closed once and resumed: the brief comes back as the instruction, the answer beside it; the same answer again is refused at no cost", async () => {
  const slug = freshSlug("buildq");
  const store = bucket(slug);
  const rec = seedBuildQ(store, slug);
  const worker = await loadWorker();
  await withWire({ route: { intent: "build" } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Collection only", ask: { id: rec.id }, firstBuild: true, hasSite: false });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "build");
    assert.equal(r.body.ask && r.body.ask.answered, true, JSON.stringify(r.body));
    assert.equal(r.body.instruction, BRIEF, "the answer did not resume the build's own request");
    assert.deepEqual(r.body.ask.context, [{ q: ASK.text, a: "Collection only", by: "build:pages" }]);
    assert.equal(question(store, slug).status, "answered");
    assert.equal(seen.calls.length, 1);
    const again = await routeCall(worker, envFor(store), { slug, message: "Collection only", ask: { id: rec.id }, firstBuild: true, hasSite: false });
    assert.equal(again.status, 409);
    assert.equal(again.body.error, "stale-question");
    assert.equal(again.body.cost, 0);
    assert.equal(seen.calls.length, 1, "a model was asked for a closed question");
  });
});

test("BQ 8 — a kept build question past its day is refused as expired; a site's own question is never answered as a build's", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("buildq-old");
    const store = bucket(slug);
    const rec = seedBuildQ(store, slug, { at: Date.now() - ASK_TTL_MS - 1000 });
    await withWire({ route: { intent: "build" } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Collection only", ask: { id: rec.id }, firstBuild: true, hasSite: false });
      assert.equal(r.status, 409);
      assert.equal(r.body.why, "expired");
      assert.equal(seen.calls.length, 0);
    });
  }
  {
    const slug = freshSlug("buildq-site");
    const store = bucket(slug);
    const rec = seedBuildQ(store, slug, { by: undefined });
    await withWire({ route: { intent: "build" } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Collection only", ask: { id: rec.id }, firstBuild: true, hasSite: false });
      assert.equal(r.status, 409);
      assert.equal(r.body.error, "stale-question");
      assert.equal(seen.calls.length, 0);
      assert.equal(question(store, slug).status, "pending", "a site's question was closed by a first build's answer");
    });
  }
});

// ── 3. THE BUILD'S REPLY IS SHOWN WHAT WAS ALREADY SUGGESTED ───────────────

test("BQ 9 — `narrateBuild` reads the suggestions already made in the build's chat and shows them to the reply writer", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const told = [];
  const chat = { v: 1, rev: 3, msgs: [{ r: "u", t: "hi" }, { r: "a", t: "Done.", suggested: "Add a page for your opening hours" }] };
  await driveBuild({
    body: BODY, design: () => ({ input: GOOD_DESIGN }), pages: () => ({ input: { pages: [] } }),
    env: { MODEL_REPLIES: "on" },
    stored: { ["chat/" + BUILD_USER.id + "/chat-build-1.json"]: JSON.stringify(chat) },
    onFetch: (url, init) => {
      const b = String((init && init.body) || "");
      if (/THEIR SITE/.test(b)) told.push(b);
      return null;
    },
  });
  assert.ok(told.length >= 1, "OBSERVER: the reply writer was never asked");
  assert.ok(told.some((b) => /ALREADY SUGGESTED RECENTLY/.test(b) && /opening hours/.test(b)), "the build's reply was not shown what was already suggested");
});

// ── 1c. THE QUEUED BUILD, COLLECTED BY THE RESUME ──────────────────────────

test("BQ 10 — a queued first build whose collected answer asks: the resume answers `clarify` at `pages`, gives back every credit by ref, keeps the question on the server, publishes nothing", async () => {
  const { buildBucket } = await import("./fixtures/build-route.mjs");
  const { ledger, fireInterim, finishResume } = await import("./fixtures/build-lifecycle.mjs");
  const { resultKey, readResult } = await import("../builder/build-job.mjs");
  const { resumeKey } = await import("../builder/build-resume.mjs");
  const ID = "b0c1d2e3f405162738495a6b7c8d9e0f";
  const b = buildBucket();
  const led = ledger();
  await fireInterim(b, ID, led);
  const resume = JSON.parse(b.store.get(resumeKey(ID)) || "null");
  assert.ok(resume, "OBSERVER: the build did not fire its generation");
  assert.equal(resume.design.askPages, true, "the resume record does not say the writer was offered the question");
  const given = { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "w1", name: "write_pages", input: { question: ASK } }] };
  await finishResume(b, ID, led, { credits: 400, given });
  const raw = b.store.get(resultKey(ID));
  assert.ok(raw, "the resume wrote no answer");
  const fin = JSON.parse(readResult(JSON.parse(raw)).body);
  assert.equal(fin.intent, "clarify", JSON.stringify(fin).slice(0, 300));
  assert.equal(fin.stage, "pages");
  assert.equal(fin.question.text, ASK.text);
  assert.match(fin.question.id, /^[0-9a-f]{32}$/);
  assert.equal(fin.cost, 0);
  assert.ok(led.calls.some((c) => /deposit\|refund$/.test(c)), "the deposit was not given back by ref: " + led.calls.join(", "));
  const rec = readAskRecord(b.store.get(QUESTION_KEY(fin.askSlug)));
  assert.ok(rec && rec.id === fin.question.id && rec.by === "build:pages" && rec.status === "pending", "the question was not kept on the server");
  assert.ok(![...b.store.keys()].some((k) => k.startsWith("current/")), "something was published");
});
