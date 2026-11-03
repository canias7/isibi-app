// ONE REPLY PER MESSAGE (2026-11-01, plan docs/plans/2026-11-01-one-reply.md).
// Each message gets ONE reply, written after every part has ended (or paused
// for credits), by the customer's chosen builder model, from the whole
// request's facts; a reply that names what the facts do not hold, or a writer
// that fails, gives the facts' own fallback. Supplied model answers only: no
// model is called, nothing is charged, no database is written.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

delete process.env.GF_OLD_LANES;
const { planParts, newRequest, nextStep, noteJobId, requestView, resumeCredits } = await import("../builder/request.mjs");
const O = await import("../builder/one-reply.mjs");

const NOW = 1_800_000_000_000;
const row = (body, { state = "done", cost = 0 } = {}) => ({ ok: true, state, billing: "finalized", cost, needs_review: false, result: { status: body.ok === false && body.error === "unbilled" ? 402 : 200, body: JSON.stringify(body) } });
const ROUTE = { ok: true, intent: "edit", layer: "look" };

/** Runs a request to where it stops, each part's run job answered by `answers[n]` (its routing job by `ROUTE`). */
function drive(message, routed, answers, { rec = null, rows = {}, key = "rqonereply0000001" } = {}) {
  if (!rec) {
    const planned = planParts(message, routed);
    assert.equal(planned.ok, true, JSON.stringify(planned));
    rec = newRequest({ key, uid: "u1", slug: "fretwork-1", message, picker: "sonnet", accepted: routed, parts: planned.parts, at: NOW });
  }
  let seq = Object.keys(rows).length;
  for (let i = 0; i < 16; i++) {
    const st = nextStep(rec, rows, NOW + i);
    rec = st.record;
    const files = st.files || [];
    if (!files.length && i > 0) break;
    for (const f of files) {
      const id = (++seq).toString(16).padStart(32, "0");
      rec = noteJobId(rec, f.key, id);
      const a = f.kind === "route" ? ROUTE : answers[f.n];
      rows[id] = row(a, { cost: f.kind === "route" ? 1 : Number(a.cost) || 0 });
    }
  }
  return { rec, rows };
}

// THE CASE THE OWNER SAW: part 0's own words say the header link "was not
// done", while part 1 (its sibling) linked it in the header.
const SIBLING_MSG = "Add an events page, and link it in the header";
const SIBLING_ROUTED = { intent: "edit", layer: "look", alsoAsked: ["link it in the header"] };
const SIBLING = {
  0: { ok: true, layer: "agent", cost: 3, msg: "Added the events page. Linking it in the header was not done.", facts: ["Linking it in the header was not done."], agent: { changed: ["src/routes/events.tsx"], removed: [] }, added: ["src/routes/events.tsx"] },
  1: { ok: true, layer: "agent", cost: 2, msg: "Linked the events page in the header.", agent: { changed: ["src/components/site-header.tsx"], removed: [] } },
};

test("FACTS: the sibling-did-it case — every part done, the header file changed, and nothing anywhere says 'not done'", () => {
  const { rec } = drive(SIBLING_MSG, SIBLING_ROUTED, SIBLING);
  assert.equal(rec.ended, true, JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  const f = O.requestFacts(requestView(rec));
  assert.deepEqual(f.parts.map((p) => p.ending), ["done", "done"]);
  assert.deepEqual(f.files.added, ["/events"]);
  assert.deepEqual(f.files.changed, ["site-header"]);
  assert.equal(f.credits, 6, "part 0 run 3; part 1 routing 1 + run 2, from the rows");
  assert.equal(f.site, "published");
  // NEVER FROM ANY STEP'S PROSE: the part's msg said "was not done".
  assert.ok(!/not done/i.test(JSON.stringify(f)), JSON.stringify(f));
  const fb = O.fallbackReply(f);
  assert.ok(!/not done/i.test(fb), fb);
  assert.match(fb, /Done:/);
  assert.match(fb, /site header/);
  // AND A MODEL REPLY THAT REPEATS THE WRONG CLAIM IS NOT SHOWN.
  assert.equal(O.checkReply("I added the events page, but linking it in the header was not done.", f).ok, false);
  assert.equal(O.checkReply("I added the events page and linked it in the site header.", f).ok, true);
});

test("FACTS: names, never paths; rows, rules, tables, keys missing, draft vs published", () => {
  const view = { ended: true, parts: [
    { n: 0, words: "Add a prices table", status: "done", charged: 4, work: { changed: ["src/routes/prices.tsx", "src/styles.css"], rows: { saved: 3, failed: 1 }, rules: ["lessons"], tables: ["prices"] }, draft: { revision: 2, preview: "ready" }, needKeys: [{ name: "STRIPE_SECRET_KEY" }] },
    { n: 1, words: "Take the gallery off", status: "done", charged: 1, work: { removed: ["src/routes/gallery.tsx"] } },
  ] };
  const f = O.requestFacts(view, { missingKeys: [{ name: "STRIPE_SECRET_KEY" }] });
  assert.deepEqual(f.files, { added: [], changed: ["/prices", "stylesheet"], removed: ["/gallery"] });
  assert.deepEqual(f.data, { rowsSaved: 3, rowsFailed: 1, rules: ["lessons"], tables: ["prices"], settings: [] });
  assert.deepEqual(f.keysMissing, ["STRIPE_SECRET_KEY"]);
  assert.equal(f.site, "some published, some saved as a draft");
  assert.equal(f.credits, 5);
  assert.ok(!/src\/|\.tsx/.test(JSON.stringify(f)));
  // A KEY ALREADY SET is not missing: the site's own list wins over a part's ask.
  assert.deepEqual(O.requestFacts(view, { missingKeys: [] }).keysMissing, []);
  // A PART WHOSE MONEY CANNOT BE TOLD makes the total cannot-tell, never smaller.
  assert.equal(O.requestFacts({ parts: [{ n: 0, words: "x", status: "done", charged: null }] }).credits, null);
});

test("CHECK: a reply naming a page, table or key not in the facts falls back; file paths fall back; keys need the box below", async () => {
  const f = O.requestFacts({ ended: true, parts: [{ n: 0, words: "Make the header green", status: "done", charged: 2, work: { changed: ["src/components/site-header.tsx"] } }] });
  assert.equal(O.checkReply("I made the /pricing page green.", f).ok, false);
  assert.equal(O.checkReply("I updated the pricing page.", f).ok, false);
  assert.equal(O.checkReply("I updated the bookings table.", f).ok, false);
  assert.equal(O.checkReply("Add RESEND_API_KEY to finish.", f).ok, false);
  assert.equal(O.checkReply("I changed src/components/site-header.tsx.", f).ok, false);
  assert.equal(O.checkReply("Your header is green now.", f).ok, true);
  const keyed = { ...f, keysMissing: ["RESEND_API_KEY"] };
  assert.equal(O.checkReply("Your header is green. It needs RESEND_API_KEY.", keyed).ok, false);
  assert.equal(O.checkReply("Your header is green. Paste RESEND_API_KEY in the box below.", keyed).ok, true);
  // THROUGH THE WRITER: the model's reply named a page the facts do not hold.
  const sent = [];
  const out = await O.writeOneReply({ send: async (req) => { sent.push(req); return { content: [{ type: "text", text: "Done! I also refreshed the /pricing page." }], usage: { input_tokens: 900, output_tokens: 40 } }; }, message: "Make the header green", facts: f, model: "claude-sonnet-5" });
  assert.equal(out.source, "fallback");
  assert.equal(out.why, "page:/pricing");
  assert.equal(out.text, O.fallbackReply(f));
  assert.equal(sent.length, 1, "one call, no retry");
  assert.equal(sent[0].model, "claude-sonnet-5", "the customer's chosen model");
  assert.equal(out.usage.length, 1, "its tokens are kept to be charged");
  assert.match(sent[0].messages[0].content, /Make the header green/);
  assert.match(sent[0].messages[0].content, /site-header/);
});

test("WRITER: a reply that passes is shown as written; a writer that throws or answers nothing falls back", async () => {
  const f = O.requestFacts({ ended: true, parts: [{ n: 0, words: "Make the header green", status: "done", work: { changed: ["src/components/site-header.tsx"] } }] });
  const ok = await O.writeOneReply({ send: async () => ({ content: [{ type: "text", text: "Your header is green now." }] }), message: "m", facts: f, model: "grok-4.7" });
  assert.deepEqual([ok.source, ok.text], ["model", "Your header is green now."]);
  const threw = await O.writeOneReply({ send: async () => { throw new Error("provider down"); }, message: "m", facts: f, model: "grok-4.7" });
  assert.deepEqual([threw.source, threw.why, threw.text], ["fallback", "send", O.fallbackReply(f)]);
  const empty = await O.writeOneReply({ send: async () => ({ content: [] }), message: "m", facts: f, model: "grok-4.7" });
  assert.deepEqual([empty.source, empty.why], ["fallback", "empty"]);
});

test("SINGLE-PART MESSAGE: it gets the one reply too — the view owes it at the end, and carries it once stored", () => {
  const { rec } = drive("Make the header green", { intent: "edit", layer: "look" }, { 0: { ok: true, layer: "agent", cost: 2, msg: "Done.", agent: { changed: ["src/components/site-header.tsx"], removed: [] } } }, { key: "rqonereply0000002" });
  assert.equal(rec.ended, true);
  assert.equal(rec.parts.length, 1);
  const v = requestView(rec);
  assert.equal(v.one, true);
  assert.equal(v.replyState, "pending");
  assert.equal(O.oneReplyNext(rec).act, "claim");
  const round = O.replyRound(rec);
  assert.match(round, /^end:/);
  const stored = { ...rec, oneReply: { for: round, state: "written", text: "Your header is green.", source: "model", at: NOW } };
  assert.deepEqual(requestView(stored).reply, { for: round, text: "Your header is green.", source: "model" });
  assert.equal(O.oneReplyNext(stored).act, "serve");
});

test("PAUSED FOR CREDITS: the reply says it is paused and carries on; after the resume finishes, a NEW round owes a new reply", () => {
  const ans = { 0: SIBLING[0], 1: { ok: false, error: "unbilled", detail: "insufficient", layer: "agent", cost: 0, unchanged: true } };
  let { rec, rows } = drive(SIBLING_MSG, SIBLING_ROUTED, ans, { key: "rqonereply0000003" });
  assert.equal(rec.state, "credits", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  const paused = O.replyRound(rec);
  assert.match(paused, /^paused:/);
  const f = O.requestFacts(requestView(rec));
  assert.equal(f.parts[1].ending, "paused for credits");
  assert.match(O.fallbackReply(f), /Paused for credits[\s\S]*carries on by itself once credits are added/);
  const written = { ...rec, oneReply: { for: paused, state: "written", text: "Paused.", source: "fallback", at: NOW } };
  assert.equal(O.oneReplyNext(written).act, "serve");
  // RESUMED AND FINISHED: the stored reply is for the pause, so a new one is owed.
  let after = resumeCredits(written, NOW + 100);
  ({ rec: after } = drive(SIBLING_MSG, SIBLING_ROUTED, { ...ans, 1: SIBLING[1] }, { rec: after, rows }));
  assert.equal(after.ended, true, JSON.stringify(after.parts.map((p) => [p.status, p.why])));
  const end = O.replyRound(after);
  assert.match(end, /^end:/);
  assert.notEqual(end, paused);
  assert.equal(O.oneReplyNext(after).act, "claim");
});

test("A CLAIM: a fresh one is waited on, a stale one is taken over; nothing is owed while parts run", () => {
  const { rec } = drive("Make the header green", { intent: "edit", layer: "look" }, { 0: { ok: true, layer: "agent", cost: 2, agent: { changed: ["a.tsx"] } } }, { key: "rqonereply0000004" });
  const round = O.replyRound(rec);
  const fresh = { ...rec, oneReply: { for: round, state: "writing", by: "x", at: Date.now() } };
  assert.equal(O.oneReplyNext(fresh).act, "wait");
  assert.equal(requestView(fresh).replyState, "pending");
  const stale = { ...rec, oneReply: { for: round, state: "writing", by: "x", at: Date.now() - O.ONE_REPLY_CLAIM_MS - 1 } };
  assert.equal(O.oneReplyNext(stale).act, "claim");
  assert.equal(O.oneReplyNext({ ...rec, ended: false, state: "running" }).act, "none");
});

// ── THE WORKER: one writer, idempotent, stored on the record ────────────────
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
function workerFns() {
  const a = W.indexOf("async function oneReplyFor(");
  const b = W.indexOf("\n}\n", W.indexOf("async function writeOneReplyNow(")) + 3;
  assert.ok(a > 0 && b > a, "oneReplyFor / writeOneReplyNow are gone from worker.js");
  return W.slice(a, b);
}
function harness(rec0, send) {
  let stored = JSON.parse(JSON.stringify(rec0));
  let etag = 1;
  const calls = { send: 0, debit: [] };
  const sandbox = {
    console: { log() {}, error() {} }, crypto: { randomUUID: () => "c" + Math.random().toString(16).slice(2) },
    errorClassForLog: (e) => String(e && e.message), oneReplyOn: O.oneReplyOn, oneReplyNext: O.oneReplyNext, readOneReply: O.readOneReply, agentReplyOf: O.agentReplyOf,
    requestFacts: O.requestFacts, writeOneReply: O.writeOneReply, fallbackOneReply: O.fallbackReply, requestView,
    keysAskedNeed: async () => [], modelsFor: (p) => ({ quick: p === "sonnet" ? "claude-sonnet-5" : "grok-4.7" }),
    quickSend: () => async (req) => { calls.send++; calls.model = req.model; await new Promise((r) => setTimeout(r, 5)); return send(req); },
    pageCredits: () => 1, debitCredits: async (...a) => { calls.debit.push(a); return { ok: true }; },
    loadRequest: async () => { await new Promise((r) => setTimeout(r, 1)); return { rec: JSON.parse(JSON.stringify(stored)), etag: String(etag) }; },
    saveRequestRecord: async (env, rec, e) => { await new Promise((r) => setTimeout(r, 1)); if (e !== String(etag)) return null; stored = JSON.parse(JSON.stringify(rec)); etag++; return String(etag); },
  };
  vm.createContext(sandbox);
  vm.runInContext(workerFns(), sandbox);
  return { calls, run: (auth = "Bearer t") => sandbox.oneReplyFor({ SITES_BUCKET: {} }, null, JSON.parse(JSON.stringify(stored)), { auth }), get rec() { return stored; } };
}

test("WORKER: two polls racing write ONE reply with ONE model call; a re-poll serves it and calls nothing", async () => {
  const { rec } = drive(SIBLING_MSG, SIBLING_ROUTED, SIBLING, { key: "rqonereply0000005" });
  const h = harness(rec, () => ({ content: [{ type: "text", text: "Your events page is up and linked in the site header." }], usage: { input_tokens: 800, output_tokens: 30 } }));
  await Promise.all([h.run(), h.run()]);
  assert.equal(h.calls.send, 1, "two writers");
  assert.equal(h.calls.model, "claude-sonnet-5", "the customer's chosen picker");
  assert.equal(h.rec.oneReply.state, "written");
  assert.equal(h.rec.oneReply.source, "model");
  assert.equal(h.rec.oneReply.text, "Your events page is up and linked in the site header.");
  assert.equal(h.calls.debit.length, 1, "charged once by its tokens");
  assert.match(h.calls.debit[0][2], /^reply:rqonereply0000005:end:/, "under the request's own ref");
  await h.run(); await h.run();
  assert.equal(h.calls.send, 1, "a re-poll wrote it again");
  assert.equal(requestView(h.rec).reply.text, "Your events page is up and linked in the site header.");
});

test("WORKER: a writer that fails stores the facts' fallback, never 'not done' for the sibling case", async () => {
  const { rec } = drive(SIBLING_MSG, SIBLING_ROUTED, SIBLING, { key: "rqonereply0000006" });
  const h = harness(rec, () => { throw new Error("down"); });
  await h.run();
  assert.equal(h.rec.oneReply.source, "fallback");
  assert.ok(!/not done/i.test(h.rec.oneReply.text), h.rec.oneReply.text);
  assert.equal(h.calls.debit.length, 0, "nothing used, nothing charged");
});

// ── THE PARTS' RECORDS: what each step did, from its answer's fields ────────
test("partWork reads files, rows, rules and tables from an answer's fields, never its msg", () => {
  assert.deepEqual(O.partWork({ msg: "changed /secret", agent: { changed: ["src/routes/a.tsx"], removed: ["src/routes/b.tsx"] }, rows: { saved: 2, failed: 0 }, applied: [{ table: "t" }], tables: ["t2"] }),
    { changed: ["src/routes/a.tsx"], removed: ["src/routes/b.tsx"], rows: { saved: 2, failed: 0 }, rules: ["t"], tables: ["t2"] });
  assert.equal(O.partWork({ ok: true, msg: "Done." }), null);
  assert.deepEqual(O.fileName("src/routes/index.tsx"), { kind: "page", name: "/" });
  assert.deepEqual(O.fileName("src/components/site-header.tsx"), { kind: "component", name: "site-header" });
});

// ── REPLY TRUTH (2026-11-02): THE OWNER'S ANSWERS NAME THINGS TOO ───────────
// What the owner named only in an answer to a builder question was asked for:
// a reply naming it is not refused as unasked (the same wiring bug as
// `changeReport` reading the bare message, worker G8).
test("REPLY TRUTH: a name the owner gave only in an answer may be named in the one reply", async () => {
  const { rec } = drive(SIBLING_MSG, SIBLING_ROUTED, SIBLING, { key: "rqonereply0000041" });
  const text = "Your opening times are now on the Workshop page.";
  const bare = O.requestFacts(requestView(rec));
  assert.equal(O.checkReply(text, bare).ok, false, "the observer is alive: the bare message does not name Workshop");
  const withAns = O.requestFacts(requestView(rec), { answers: [{ q: "Which page should the opening times go on?", a: "The Workshop page" }] });
  assert.deepEqual(withAns.answered, ["The Workshop page"]);
  assert.equal(O.checkReply(text, withAns).ok, true, JSON.stringify(O.checkReply(text, withAns)));
  assert.equal(O.checkReply("Your opening times are now on the Bakery page.", withAns).ok, false, "a name nobody gave is still refused");
  const atAddr = O.requestFacts(requestView(rec), { answers: [{ q: "Where should it live?", a: "At /workshop please" }] });
  assert.equal(O.checkReply("See /workshop for the times.", bare).ok, false);
  assert.equal(O.checkReply("See /workshop for the times.", atAddr).ok, true, "an address the answer named");
  // Read strictly: a malformed answers list adds nothing.
  assert.equal(O.requestFacts(requestView(rec), { answers: [{ q: 1, a: "Workshop" }] }).answered, undefined);
  // The worker passes the record's own answers to the facts.
  const h = harness({ ...rec, context: [{ q: "Which page should the opening times go on?", a: "The Workshop page" }] },
    () => ({ content: [{ type: "text", text }], usage: { input_tokens: 800, output_tokens: 20 } }));
  await h.run();
  assert.equal(h.rec.oneReply.source, "model", JSON.stringify(h.rec.oneReply));
  assert.equal(h.rec.oneReply.text, text);
});
