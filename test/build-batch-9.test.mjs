// THE NINTH BUILD BATCH (2026-10-08): a first Build whose design comes back
// wrong is RECOVERED, not abandoned.
//
// Codex reviewed `8180a7cf` and reproduced a first Build receiving an unusable
// design: exactly one `design_schema` call, then `design-unusable`, and no
// corrective attempt. These cases drive the real route (inline and queued),
// the real recovery and the real designer request with every model answer
// supplied — never a paid call:
//   - the model's own mistake (no tool call, required parts missing) and an
//     answer cut off at its room are corrected once, told the validation
//     failures and shown what it already wrote, and the SAME build goes on;
//   - a busy provider or a dropped connection is asked once more;
//   - an account refusal, a request the provider rejects and our own time
//     ceiling are never retried;
//   - a decision only the customer can make comes back as the designer's own
//     question through the first build's existing question round;
//   - attempts are recorded beside the job BEFORE they are made, so a
//     redelivered job never repeats one, and an attempt that cannot be
//     recorded is not made;
//   - every design call's usage is the one the ledger settles.

import test from "node:test";
import assert from "node:assert/strict";
import { GOOD_DESIGN, BRIEF, buildBucket } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { ledger, fireInterim } from "./fixtures/build-lifecycle.mjs";
import { designFailure, mayRetry, repairNote, repairOutcome, addUsage, DESIGN_RETRY_FLOOR_MS, REPAIR_SHOWN_CHARS } from "../builder/design-repair.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { designInWaves } from "../builder/design-waves.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const BODY = { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" };
const told = (bd) => JSON.stringify(bd.messages || "");
const isRepair = (s) => /COULD NOT BE USED/.test(s);
const factText = (bf) => buildReplyFacts(bf).facts.map((f) => f.text || f).join("\n");
const { purpose: _p, ...NO_PURPOSE } = GOOD_DESIGN;

// ── the decisions, pure ──────────────────────────────────────────────────

test("pure: what went wrong decides what happens — malformed and cut-off are repaired, busy is asked again, account, rejected and our ceiling never retried", () => {
  assert.deepEqual(designFailure({ answer: { input: GOOD_DESIGN } }), { kind: "ok", retry: null });
  const noTool = designFailure({ answer: { input: null, shape: { tool: false } } });
  assert.equal(noTool.kind, "malformed"); assert.equal(noTool.retry, "repair"); assert.equal(noTool.why, "no-tool-call");
  const short = designFailure({ answer: { input: NO_PURPOSE, shape: { tool: true } } });
  assert.equal(short.why, "fields-missing"); assert.ok(short.missing.includes("purpose"), JSON.stringify(short));
  const waves = designFailure({ answer: { input: null, shape: { missing: ["theme"] } } });
  assert.ok(waves.missing.includes("theme"), "a split design's own missing list is kept");
  const cut = Object.assign(new Error("cut"), { truncated: true });
  assert.equal(designFailure({ error: cut }).retry, "repair");
  assert.equal(designFailure({ error: new Error("t"), timeout: true }).retry, null);
  assert.equal(designFailure({ error: new Error("b"), upstream: { billing: true }, status: 400 }).kind, "account");
  assert.equal(designFailure({ error: new Error("k"), status: 401 }).kind, "account");
  assert.equal(designFailure({ error: new Error("r"), status: 400 }).kind, "rejected");
  for (const s of [429, 500, 502, 503, 529]) assert.equal(designFailure({ error: new Error("x"), status: s }).retry, "again", String(s));
  assert.equal(designFailure({ error: new Error("o"), upstream: { type: "overloaded_error" }, status: 0 }).retry, "again");
  assert.equal(designFailure({ error: new TypeError("fetch failed") }).why, "no-response");
});

test("pure: the bounds — one repair and one retry per design, counted from the durable list, and none started without the time a design needs", () => {
  const rep = { retry: "repair" };
  assert.equal(mayRetry(rep, []).ok, true);
  assert.equal(mayRetry(rep, [{ retry: "repair" }]).why, "attempts-used");
  assert.equal(mayRetry({ retry: "again" }, [{ retry: "repair" }]).ok, true, "a repair does not use up the provider retry");
  assert.equal(mayRetry(rep, [], { remainingMs: DESIGN_RETRY_FLOOR_MS - 1 }).why, "no-time");
  assert.equal(mayRetry(rep, [], { remainingMs: DESIGN_RETRY_FLOOR_MS }).ok, true);
  assert.equal(mayRetry({ retry: null }, []).why, "not-retryable");
});

test("pure: the corrective note names the failures, shows the earlier answer (cut AND said to be cut past the bound), keeps every requirement, and asks only a decision that is theirs", () => {
  const n = repairNote({ kind: "malformed", why: "fields-missing", missing: ["purpose", "pages"] }, { brand: "Harbour Loaf" });
  assert.match(n, /purpose, pages/);
  assert.match(n, /"brand":"Harbour Loaf"/);
  assert.match(n, /every page, feature, table and requirement/);
  assert.match(n, /ONLY if a decision that is theirs alone/);
  assert.match(repairNote({ kind: "malformed", why: "no-tool-call", missing: [] }), /did not use the design tool/);
  const t = repairNote({ kind: "truncated" }, null);
  assert.match(t, /ran out of room/); assert.match(t, /never drop one to fit/);
  const big = repairNote({ kind: "truncated" }, { brief: "x".repeat(REPAIR_SHOWN_CHARS + 50) });
  assert.match(big, /cut here: the rest of your earlier answer is not shown/);
  assert.doesNotMatch(repairNote({ kind: "truncated" }, { a: 1 }), /cut here/, "CONTROL: a short answer is shown whole and not marked");
});

test("pure: a usable design wins over a question beside it; a question is read by the shared reader; anything else is still unusable", () => {
  assert.equal(repairOutcome({ input: { ...GOOD_DESIGN, question: { text: "Which?", options: ["a", "b"] } } }).kind, "repaired");
  const q = repairOutcome({ input: { question: { text: "Do you take orders for delivery, or collection only?", options: ["Delivery", "Collection only"] } } });
  assert.equal(q.kind, "question"); assert.equal(q.question.options.length, 2);
  assert.equal(repairOutcome({ input: { question: { text: "" } } }).kind, "still-unusable");
  assert.equal(repairOutcome(null).kind, "still-unusable");
  assert.deepEqual(addUsage({ in: 1, out: 2, cacheRead: 3, cacheWrite: 4, model: "m" }, { in: 10, out: 20, cacheRead: 0, cacheWrite: 1 }), { in: 11, out: 22, cacheRead: 3, cacheWrite: 5, model: "m" });
});

test("pure: the facts — only real attempt readings pass; a repaired design is told as done with nothing dropped, an exhausted one without asking them to shorten a valid request", () => {
  assert.equal(buildFacts({ design: { outcome: "repaired", attempts: ["made:up"] } }), null);
  const ok = buildFacts({ design: { outcome: "repaired", attempts: ["malformed:repair"] } });
  assert.match(factText(ok), /incomplete, and it was asked to correct it\. That worked: the build went on with everything they asked for, and nothing was dropped/);
  const ex = factText(buildFacts({ design: { outcome: "exhausted", attempts: ["truncated:repair"] }, failure: { kind: "design-truncated", cost: 0 } }));
  assert.match(ex, /did not produce a usable plan either/);
  assert.doesNotMatch(ex, /fewer things|shorter description/);
});

// ── through the real inline route ───────────────────────────────────────

test("Codex's reproduction: the first design is UNUSABLE (no tool call) — one corrective call told the failure, the design validates, and the SAME build goes on", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, design: (n) => (n === 0 ? { text: "Here is a design." } : { input: GOOD_DESIGN, usage: { input_tokens: 300, output_tokens: 70 } }) });
  assert.equal(r.seen.designer.length, 2, "exactly one corrective call");
  assert.ok(!isRepair(r.seen.designer[0]) && isRepair(r.seen.designer[1]));
  assert.match(r.seen.designer[1], /did not use the design tool/);
  assert.notEqual(r.reply.stage, "design", "the build stopped at the design: " + JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.slug, "harbour-loaf");
  assert.deepEqual(r.reply.designRecovery, { attempts: ["malformed:repair"], outcome: "repaired" });
  assert.equal(r.reply.buildFacts.design.outcome, "repaired");
  // EVERY CALL IS THE ONE THE LEDGER SETTLES: the first answer and the repair.
  assert.equal(r.reply.schemaUsage.in, 100 + 300);
  assert.equal(r.reply.schemaUsage.out, 50 + 70);
});

test("a design CUT OFF at its room is written again, shown what it had written and told to keep everything — repaired, same build", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const partial = { brand: "Harbour Loaf", slug: "harbour-loaf", pages: [{ path: "/", name: "Home" }] };
  const r = await driveBuild({ body: BODY, design: (n) => (n === 0 ? { input: partial, stop: "max_tokens" } : { input: GOOD_DESIGN }) });
  assert.equal(r.seen.designer.length, 2);
  assert.match(r.seen.designer[1], /ran out of room/);
  assert.match(r.seen.designer[1], /Harbour Loaf/, "the earlier answer was not shown back");
  assert.deepEqual(r.reply.designRecovery.attempts, ["truncated:repair"]);
  assert.equal(r.reply.slug, "harbour-loaf");
});

test("the provider BUSY (529) is asked once more with the same request — the build goes on", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, design: (n) => (n === 0 ? json({ type: "error", error: { type: "overloaded_error", message: "busy" } }, 529) : { input: GOOD_DESIGN }) });
  assert.equal(r.seen.designer.length, 2);
  assert.ok(!isRepair(r.seen.designer[1]), "a busy provider is asked again, not told it made a mistake");
  assert.deepEqual(r.reply.designRecovery, { attempts: ["transient:again"], outcome: "repaired" });
  assert.equal(r.reply.slug, "harbour-loaf");
});

test("CONTROL: an ACCOUNT refusal (billing) and a REJECTED request (400) are never retried — one call each, the deposit returned", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const bill = await driveBuild({ body: BODY, design: () => json({ type: "error", error: { type: "billing_error", message: "credit balance is too low" } }, 400) });
  assert.equal(bill.seen.designer.length, 1);
  assert.equal(bill.reply.stage, "design");
  assert.equal(bill.reply.designRecovery, undefined);
  const rej = await driveBuild({ body: BODY, design: () => json({ type: "error", error: { type: "invalid_request_error", message: "bad" } }, 400) });
  assert.equal(rej.seen.designer.length, 1);
  assert.ok(rej.seen.rpc.some((c) => c.fn === "credit_reverse" && /deposit/.test(String(c.args.p_ref))), "the deposit was not returned");
});

test("CONTROL: a usable first design makes ONE call and carries no recovery", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, design: () => ({ input: GOOD_DESIGN }) });
  assert.equal(r.seen.designer.length, 1);
  assert.equal(r.reply.designRecovery, undefined);
  assert.equal(r.reply.buildFacts && r.reply.buildFacts.design, undefined);
});

test("a decision only they can make: the corrective attempt asks it in its own words — a question answer, nothing built, the deposit returned, no database", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const ask = { text: "Should people pay when they order, or when they collect?", options: ["When they order", "When they collect"] };
  const r = await driveBuild({ body: BODY, design: (n, b) => {
    if (n === 0) return { input: NO_PURPOSE };
    assert.ok(b.tools[0].input_schema.properties.question, "the corrective attempt was not offered the question field");
    return { input: { question: ask } };
  } });
  assert.equal(r.status, 200);
  assert.equal(r.reply.intent, "clarify");
  assert.equal(r.reply.stage, "design");
  assert.deepEqual(r.reply.question, ask);
  assert.equal(r.reply.cost, 0);
  assert.equal(r.seen.neon, 0, "a database was made for a build that asked a question");
  assert.ok(!r.seen.tools.includes("write_pages"), "pages were written");
  assert.ok(r.seen.rpc.some((c) => c.fn === "credit_reverse" && /deposit/.test(String(c.args.p_ref))));
});

test("STILL unusable after the corrective attempt: a terminal stop, told with what was tried and that the request is fine — the deposit returned, never a third call", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, design: () => ({ text: "Here is a design." }) });
  assert.equal(r.seen.designer.length, 2);
  assert.equal(r.reply.stage, "design");
  assert.equal(r.reply.buildFacts.failure.kind, "design-unusable");
  assert.deepEqual(r.reply.buildFacts.design, { outcome: "exhausted", attempts: ["malformed:repair"] });
  assert.equal(r.reply.cost, 0);
  assert.match(factText(r.reply.buildFacts), /asked to correct it; that did not produce a usable plan either/);
});

test("the truncated stop's fixed sentence no longer tells them to describe fewer things", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, design: () => ({ input: { brand: "x" }, stop: "max_tokens" }) });
  assert.equal(r.seen.designer.length, 2);
  assert.equal(r.reply.buildFacts.failure.kind, "design-truncated");
  assert.doesNotMatch(r.reply.msg, /fewer things/);
  assert.match(r.reply.msg, /Your request is fine as it is/);
});

test("THE SPLIT DESIGNER (waves): agents that leave a required part out end incomplete — the corrective single call is shown what the agents wrote, and the build goes on", async () => {
  const { driveBuild } = await import("./fixtures/build-route.mjs");
  const r = await driveBuild({ body: BODY, env: { DESIGN_SPLIT_EVERYONE: "1" }, design: (n, b) => (isRepair(told(b)) ? { input: GOOD_DESIGN } : { input: NO_PURPOSE }) });
  const repairs = r.seen.designer.filter(isRepair);
  assert.ok(r.seen.designer.length > 2, "the waves did not run: " + r.seen.designer.length);
  assert.equal(repairs.length, 1);
  assert.match(repairs[0], /purpose/);
  assert.match(repairs[0], /Harbour Loaf/, "what the agents wrote was not carried into the repair");
  assert.equal(r.reply.slug, "harbour-loaf");
  assert.deepEqual(r.reply.designRecovery.attempts, ["malformed:repair"]);
});

test("pure: the waves designer's unusable ending carries what it already knows, for the repair to keep", async () => {
  const call = async (req) => {
    const props = Object.keys(req.tools[0].input_schema.properties || {});
    const input = Object.fromEntries(props.filter((k) => k !== "purpose" && Object.hasOwn(GOOD_DESIGN, k)).map((k) => [k, GOOD_DESIGN[k]]));
    return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "design_schema", input }], usage: { input_tokens: 1, output_tokens: 1 } };
  };
  const props = Object.fromEntries(Object.keys(GOOD_DESIGN).map((k) => [k, { type: "string" }]));
  const tool = { name: "design_schema", input_schema: { type: "object", properties: props, required: Object.keys(GOOD_DESIGN) } };
  const out = await designInWaves({ tool, system: "s", brief: "b", model: "m", maxTokens: 10, waves: [[{ name: "a", fields: Object.keys(GOOD_DESIGN) }]] }, call);
  assert.equal(out.input, null);
  assert.ok(out.partial && out.partial.brand === "Harbour Loaf", JSON.stringify(out).slice(0, 300));
});

// ── the job: durable attempts, redelivery, time ─────────────────────────

const W = async () => loadWorkerModule();
const stubFetch = (answer) => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const bd = JSON.parse(String((init && init.body) || "{}"));
    calls.push(bd);
    return answer(calls.length - 1, bd);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
};
const ok = (input) => json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "design_schema", input }], usage: { input_tokens: 5, output_tokens: 5 } });
const ENV = (b) => ({ SITES_BUCKET: b, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" });
const unusable = { input: null, shape: { tool: false }, usage: { in: 100, out: 50, cacheRead: 0, cacheWrite: 0 } };

test("durable: the attempt is RECORDED BEFORE it is made, beside the job", async () => {
  const { recoverDesign } = await W();
  const b = buildBucket();
  let seenAtCall = null;
  const f = stubFetch(() => { seenAtCall = b.store.get("jobs/j1.design.json") || null; return ok(GOOD_DESIGN); });
  try {
    const rec = await recoverDesign(ENV(b), { dz: unusable, jobId: "j1", brief: "a bakery", model: "claude-sonnet-4-5" });
    assert.equal(rec.ok, true);
    assert.ok(seenAtCall && JSON.parse(seenAtCall).attempts.length === 1, "the call was made before its attempt was recorded");
    assert.equal(rec.usage.in, 105);
  } finally { f.restore(); }
});

test("durable: a REDELIVERED job finds the repair already used and does not make it again", async () => {
  const { recoverDesign } = await W();
  const b = buildBucket();
  b.store.set("jobs/j2.design.json", JSON.stringify({ v: 1, attempts: [{ retry: "repair", kind: "malformed", at: "x" }] }));
  const f = stubFetch(() => ok(GOOD_DESIGN));
  try {
    const rec = await recoverDesign(ENV(b), { dz: unusable, jobId: "j2", brief: "a bakery", model: "claude-sonnet-4-5" });
    assert.equal(f.calls.length, 0, "a second corrective call on redelivery");
    assert.equal(rec.ok, false); assert.equal(rec.why, "attempts-used");
  } finally { f.restore(); }
});

test("durable: an UNREADABLE record, or one that cannot be WRITTEN, makes no attempt (never a duplicate risked)", async () => {
  const { recoverDesign } = await W();
  const b1 = buildBucket();
  b1.store.set("jobs/j3.design.json", "{not json");
  const f = stubFetch(() => ok(GOOD_DESIGN));
  try {
    const r1 = await recoverDesign(ENV(b1), { dz: unusable, jobId: "j3", brief: "b", model: "m" });
    assert.equal(r1.why, "attempts-unreadable");
    const b2 = buildBucket();
    const put = b2.put.bind(b2);
    b2.put = async (k, v, o) => { if (String(k).endsWith(".design.json")) throw new Error("R2 down"); return put(k, v, o); };
    const r2 = await recoverDesign(ENV(b2), { dz: unusable, jobId: "j4", brief: "b", model: "m" });
    assert.equal(r2.why, "attempt-unrecorded");
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("time: with less left than a design needs, no further call is started", async () => {
  const { recoverDesign } = await W();
  const f = stubFetch(() => ok(GOOD_DESIGN));
  try {
    const rec = await recoverDesign(ENV(buildBucket()), { dz: unusable, jobId: "j5", brief: "b", model: "m", budget: { remainingMs: () => DESIGN_RETRY_FLOOR_MS - 1, take: () => 0 } });
    assert.equal(rec.why, "no-time"); assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("bounds: a repair that is still unusable, then busy, gets the one provider retry — never more than the two kinds' bounds", async () => {
  const { recoverDesign } = await W();
  const f = stubFetch((n) => (n === 0 ? json({ type: "error", error: { type: "overloaded_error" } }, 529) : json({ stop_reason: "end_turn", content: [{ type: "text", text: "no" }], usage: { input_tokens: 1, output_tokens: 1 } })));
  try {
    const rec = await recoverDesign(ENV(buildBucket()), { dz: unusable, jobId: "j6", brief: "b", model: "m" });
    assert.equal(rec.ok, false);
    assert.ok(f.calls.length <= 2, "more calls than the bounds allow: " + f.calls.length);
    assert.deepEqual(rec.attempts.map((a) => a.retry), ["repair", "again"]);
  } finally { f.restore(); }
});

const Q9 = "9e9c3d4e5f60718293a4b5c6d7e8f9ab";
test("THE QUEUED JOB (browser closed): the consumer repairs the design and fires the same build; a REDELIVERY of that job makes no second corrective call", async () => {
  const b = buildBucket();
  const led = ledger();
  const designs = [];
  const onDesign = (n, bd) => (isRepair(told(bd)) ? ok(GOOD_DESIGN) : json({ stop_reason: "end_turn", content: [{ type: "text", text: "no" }], usage: { input_tokens: 100, output_tokens: 50 } }));
  await fireInterim(b, Q9, led, { onDesign, designs });
  assert.equal(designs.length, 2);
  assert.equal(designs.filter((d) => isRepair(told(d))).length, 1);
  const kept = JSON.parse(b.store.get("jobs/" + Q9 + ".design.json"));
  assert.deepEqual(kept.attempts.map((a) => a.retry), ["repair"]);
  const resume = [...b.store.keys()].find((k) => /resume/.test(k));
  assert.ok(resume, "the build did not fire its generation: " + [...b.store.keys()].join(", "));
  // The same job delivered again: its first design is again unusable, and the
  // repair the record holds is not made a second time.
  const again = [];
  await fireInterim(b, Q9, led, { onDesign, designs: again });
  assert.ok(again.length >= 1, "OBSERVER: the redelivery never reached the design, so it proves nothing");
  assert.equal(again.filter((d) => isRepair(told(d))).length, 0, "the redelivery made a second corrective call");
});
