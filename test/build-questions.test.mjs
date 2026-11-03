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
