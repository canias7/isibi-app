// A MODEL PROVIDER THAT IS DOWN IS WAITED FOR, NOT FAILED ON (owner, 2026-10-24).
//
// The owner's design (docs/plans/2026-10-24-model-failures.md): the provider-
// side kinds only (503, 502, 504, 500, 429 at least as long as it asks, a
// connection dropped mid-answer, an error sent inside the stream mapped to its
// standard code); only the call that failed is asked again, every 5 minutes,
// with no attempt count; past the job's deadline the job is parked and the
// tick resumes it from its saved steps; a fixed notice, never model-written;
// the recovery line; Stop while waiting. Every wire here is a stub and every
// clock fake: no model is called and nothing is spent.
import test from "node:test";
import assert from "node:assert/strict";
import {
  providerFailure, withProviderRetry, waitNotice, noticeTitle, recoveredLine, STOPPED_LINE, panelRow, clock,
  PROVIDER_RETRY_MS, retryAfterMs, wakeDecision, parkRecord, readPark, keptLine, errorFacts,
} from "../builder/provider-retry.mjs";
import { callBuilderModel, patientCall } from "../builder/build-call.mjs";
import { designFailure } from "../builder/design-repair.mjs";
import { readRoute } from "../builder/request.mjs";

const KEYS = { anthropic: "A-KEY", xai: "X-KEY" };
const XAI_REQ = { model: "grok-4.6", max_tokens: 10, messages: [{ role: "user", content: "hi" }] };
const XAI_OK = JSON.stringify({ id: "x", model: "grok-4.6", choices: [{ index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 1 } });
const sse = (o) => "data: " + JSON.stringify(o) + "\n\n";
const UNAVAILABLE_STREAM = sse({ choices: [{ delta: { content: "st" }, finish_reason: null }] }) + sse({ error: { code: "unavailable", message: "Service temporarily unavailable. The model is overloaded." } });

/** A fake clock: `sleep` moves it, never waits. */
function fakeClock(start = 1_000_000) {
  let t = start;
  const slept = [];
  return { now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; }, slept, advance: (ms) => { t += ms; } };
}
/** A stub wire answering each call in turn: a status (with headers/body), a stream text, a thrown error, or OK. */
function wire(script) {
  const calls = [];
  const send = async (url, init) => {
    const step = script[Math.min(calls.length, script.length - 1)];
    calls.push({ url, body: init && init.body });
    if (step.throw) throw step.throw;
    if (step.status) return { ok: false, status: step.status, headers: new Headers(step.headers || {}), text: async () => step.body || "", json: async () => JSON.parse(step.body || "{}") };
    const text = step.text || XAI_OK;
    return { ok: true, status: 200, headers: new Headers(), text: async () => text, json: async () => JSON.parse(text) };
  };
  return { send, calls };
}
const drop = () => Object.assign(new Error("model stream ended early — the connection closed mid-generation"), {});

// ─── WHICH FAILURES ──────────────────────────────────────────────────────────

test("PR1 the provider-side kinds are waited for, each with its standard code and name; the words are the provider's", () => {
  const cases = [[503, "Service Unavailable"], [502, "Bad Gateway"], [504, "Gateway Timeout"], [500, "Internal Server Error"], [429, "Too Many Requests"]];
  for (const [status, name] of cases) {
    const f = providerFailure({ status, detail: JSON.stringify({ error: { type: null, message: "busy right now" } }) }, "grok-4.6");
    assert.ok(f, status + " was not waited for");
    assert.equal(f.code, status); assert.equal(f.name, name); assert.equal(f.model, "Grok");
    assert.equal(f.words, "busy right now"); assert.equal(f.link, "https://status.x.ai");
  }
  // AN ERROR INSIDE THE STREAM, NO STATUS: the provider's word mapped (xAI `unavailable` → 503).
  const s = providerFailure({ name: "StreamError", detail: JSON.stringify({ error: { type: "unavailable", message: "Service temporarily unavailable." } }) }, "grok-4.6");
  assert.equal(s.code, 503); assert.equal(s.name, "Service Unavailable"); assert.equal(s.words, "Service temporarily unavailable.");
  // Anthropic's own envelope, overloaded → 529; its status page.
  const a = providerFailure({ name: "StreamError", detail: JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }) }, "claude-sonnet-4-5");
  assert.equal(a.code, 529); assert.equal(a.model, "Claude"); assert.equal(a.link, "https://status.claude.com");
  // A CONNECTION DROPPED: no code, no words.
  for (const e of [drop(), Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }), Object.assign(new Error("idle"), { name: "IdleTimeoutError" })]) {
    const d = providerFailure(e, "grok-4.6");
    assert.ok(d, e.message + " was not read as a dropped connection");
    assert.equal(d.code, null); assert.equal(d.name, "No response");
  }
});

test("PR2 never waited for: our account, our key, a bad request, a missing model, our own clock, our own sentence, a cut-off answer", () => {
  const no = [
    { status: 401 }, { status: 403 }, { status: 400 }, { status: 404 }, { status: 402 },
    { status: 429, detail: JSON.stringify({ error: { type: "insufficient_quota", message: "You exceeded your quota" } }) },
    { status: 429, detail: JSON.stringify({ error: { type: null, message: "Your credit balance is too low" } }) },
    { name: "StreamError", detail: JSON.stringify({ error: { type: "insufficient_quota", message: "Your credit balance is too low" } }) },
    { name: "StreamError", detail: JSON.stringify({ error: { type: "invalid_request_error", message: "bad" } }) },
    Object.assign(new Error("timed out"), { name: "TimeoutError" }), Object.assign(new Error("aborted"), { name: "AbortError" }),
    new Error("XAI_API_KEY is not set"), Object.assign(new Error("cut"), { truncated: true }), new Error("something of ours"),
  ];
  for (const e of no) assert.equal(providerFailure(e, "grok-4.6"), null, JSON.stringify(e) + " " + e.message + " was waited for");
});

test("PR3 the fixed notice, exactly as the owner spelled it; the 'said' part left out without words; the panel row; the recovery and Stop lines", () => {
  const f = providerFailure({ status: 503, detail: JSON.stringify({ error: { message: "The service is unavailable." } }) }, "grok-4.6");
  const n = waitNotice(f, { now: 0 });
  assert.equal(n.title, "⚠ Grok error 503 · Service Unavailable");
  assert.equal(n.said, "Grok said: The service is unavailable.");
  assert.equal(n.link, "https://status.x.ai");
  assert.equal(n.kept, "Your work so far is kept. Retrying in 5:00 · no charge while waiting");
  assert.equal(keptLine(299000), "Your work so far is kept. Retrying in 4:59 · no charge while waiting");
  assert.equal(n.until, PROVIDER_RETRY_MS);
  const d = providerFailure(drop(), "grok-4.6");
  assert.equal(noticeTitle(d), "⚠ Grok connection dropped · No response");
  assert.equal(waitNotice(d, { now: 0 }).said, null);
  assert.equal(panelRow("Events page", f, 299000), "⚠ Events page · Grok 503 · retrying in 4:59");
  assert.equal(recoveredLine("Grok"), "✓ Grok is answering again · picking up where it stopped");
  assert.equal(STOPPED_LINE, "Stopped. Nothing was built or charged for this part.");
  assert.equal(clock(61000), "1:01");
  // Cloudflare is never named.
  assert.ok(!/cloudflare/i.test(JSON.stringify(n) + noticeTitle(d)));
});

test("PR4 a 429 waits the longer of 5 minutes and what the provider asks (seconds or a date)", () => {
  assert.equal(retryAfterMs("600"), 600000);
  assert.equal(retryAfterMs(new Date(1_000_000 + 420000).toUTCString(), 1_000_000), 420000);
  const f = providerFailure({ status: 429, retryAfter: "900" }, "grok-4.6");
  assert.equal(waitNotice(f, { now: 0 }).waitMs, 900000);
  const short = providerFailure({ status: 429, retryAfter: "20" }, "grok-4.6");
  assert.equal(waitNotice(short, { now: 0 }).waitMs, PROVIDER_RETRY_MS);
});

test("PR5 the provider's real error is kept: its type and capped words, never more", () => {
  const long = "x".repeat(900);
  const k = errorFacts({ detail: JSON.stringify({ error: { type: "unavailable", message: long + "\u0000" } }) });
  assert.equal(k.type, "unavailable");
  assert.equal(k.message.length, 300);
});

// ─── ONLY THE CALL THAT FAILED, EVERY 5 MINUTES, NO COUNT ───────────────────

test("PR6 503 → 503 → 503 → answer: only the failed call is asked again, every 5 minutes, with no attempt count; recovery said once", async () => {
  const c = fakeClock();
  const seen = { waits: [], recovered: [] };
  let n = 0;
  const out = await withProviderRetry(async () => { n++; if (n < 4) throw Object.assign(new Error("xai 503"), { status: 503 }); return "answer"; },
    { model: "grok-4.6", ...c, deadlineAt: c.now() + 50 * 60000, onWait: (x) => seen.waits.push(x), onRecover: (x) => seen.recovered.push(x) });
  assert.equal(out, "answer");
  assert.equal(n, 4, "the call was not asked exactly once per wait");
  assert.equal(c.slept.reduce((a, b) => a + b, 0), 3 * PROVIDER_RETRY_MS);
  assert.equal(seen.waits.length, 3);
  assert.ok(seen.waits.every((w) => w.title === "⚠ Grok error 503 · Service Unavailable"));
  assert.deepEqual(seen.recovered.map((r) => r.title), ["✓ Grok is answering again · picking up where it stopped"]);
});

test("PR7 THROUGH THE REAL CALL: an in-stream xAI `unavailable` then an answer — two provider calls, one answer, nothing bought twice", async () => {
  const c = fakeClock();
  const w = wire([{ text: UNAVAILABLE_STREAM }, { text: XAI_OK }]);
  const notices = [];
  const out = await patientCall(() => callBuilderModel(KEYS, XAI_REQ, null, w.send, { stream: true }), { wait: { model: XAI_REQ.model, ...c, deadlineAt: c.now() + 50 * 60000, onWait: (x) => notices.push(x), onRecover: (x) => notices.push(x) } });
  assert.equal(out.content[0].text, "hello");
  assert.equal(w.calls.length, 2, "the failed call was not asked exactly once more");
  assert.equal(notices[0].title, "⚠ Grok error 503 · Service Unavailable");
  assert.equal(notices[0].said, "Grok said: Service temporarily unavailable. The model is overloaded.");
  assert.equal(notices[1].kind, "provider-recovered");
});

test("PR8 THROUGH THE REAL CALL: a 429 with retry-after waits what it asks; a dropped connection is waited for after the quick tries", async () => {
  const c = fakeClock();
  const w = wire([{ status: 429, headers: { "retry-after": "720" }, body: JSON.stringify({ error: "Too many requests", code: "rate_limited" }) }, { text: XAI_OK }]);
  await patientCall(() => callBuilderModel(KEYS, XAI_REQ, null, w.send, null), { wait: { model: XAI_REQ.model, ...c, deadlineAt: c.now() + 50 * 60000 } });
  assert.equal(c.slept.reduce((a, b) => a + b, 0), 720000);
  const c2 = fakeClock();
  const w2 = wire([{ throw: drop() }, { throw: drop() }, { throw: drop() }, { text: XAI_OK }]);
  await patientCall(() => callBuilderModel(KEYS, XAI_REQ, null, w2.send, null), { wait: { model: XAI_REQ.model, ...c2, deadlineAt: c2.now() + 50 * 60000 } });
  assert.equal(w2.calls.length, 4, "three quick tries, then one after the wait");
  assert.equal(c2.slept.reduce((a, b) => a + b, 0), PROVIDER_RETRY_MS);
});

test("PR9 non-retryable 401, 400 and billing are thrown at once — one call, no wait, no notice", async () => {
  for (const step of [{ status: 401, body: "{}" }, { status: 400, body: "{}" }, { status: 429, body: JSON.stringify({ error: { message: "Your credit balance is too low", code: "insufficient_quota" } }) }]) {
    const c = fakeClock();
    const w = wire([step, { text: XAI_OK }]);
    let notices = 0;
    await assert.rejects(patientCall(() => callBuilderModel(KEYS, XAI_REQ, null, w.send, null), { wait: { model: XAI_REQ.model, ...c, deadlineAt: c.now() + 50 * 60000, onWait: () => notices++ } }));
    assert.equal(w.calls.length, 1, step.status + " was asked again");
    assert.equal(c.slept.length, 0); assert.equal(notices, 0);
  }
});

// ─── PARKED PAST THE DEADLINE, STOP WHILE WAITING ───────────────────────────

test("PR10 past the job's deadline the call is PARKED: its own error rethrown, marked, with the notice and when to resume; no deadline parks at once", async () => {
  const c = fakeClock();
  let parked = null;
  const e = await withProviderRetry(async () => { throw Object.assign(new Error("xai 503"), { status: 503 }); }, { model: "grok-4.6", ...c, deadlineAt: c.now() + 4 * 60000, onPark: (n) => { parked = n; } }).catch((x) => x);
  assert.equal(e.status, 503, "the caller no longer reads its own status");
  assert.equal(e.parked, true);
  assert.equal(e.providerWait.resumeAt, c.now() + PROVIDER_RETRY_MS);
  assert.equal(parked.title, "⚠ Grok error 503 · Service Unavailable");
  assert.equal(c.slept.length, 0, "it waited past the deadline");
  const e2 = await withProviderRetry(async () => { throw Object.assign(new Error("x"), { status: 502 }); }, { model: "grok-4.6", ...c }).catch((x) => x);
  assert.equal(e2.parked, true); assert.equal(c.slept.length, 0, "a call with no deadline slept");
  // The design fold: a parked design is the job's to resume, never a second try here.
  assert.deepEqual(designFailure({ error: e, status: 503 }), { kind: "waiting", retry: null, why: "parked" });
});

test("PR11 Stop while waiting ends it: no further call, the owner's line", async () => {
  const c = fakeClock();
  let stop = false, n = 0, said = null;
  const e = await withProviderRetry(async () => { n++; throw Object.assign(new Error("x"), { status: 503 }); },
    { model: "grok-4.6", ...c, deadlineAt: c.now() + 50 * 60000, sleep: async (ms) => { c.advance(ms); stop = true; }, stopped: () => stop, onStop: (x) => { said = x; } }).catch((x) => x);
  assert.equal(e.name, "ProviderStopped"); assert.equal(e.stopped, true);
  assert.equal(n, 1, "a stopped wait asked again");
  assert.equal(said.title, "Stopped. Nothing was built or charged for this part.");
});

test("PR12 the tick's decision: not yet due waits; due resumes with the next try 5 minutes on; an ended row drops the record", () => {
  const n = waitNotice(providerFailure({ status: 503 }, "grok-4.6"), { now: 1000 });
  const rec = readPark(JSON.parse(JSON.stringify(parkRecord({ id: "j1", kind: "edit", holder: "h", notice: n, now: 1000 }))));
  assert.equal(wakeDecision(rec, { now: 2000 }).act, "wait");
  const d = wakeDecision(rec, { now: rec.resumeAt });
  assert.equal(d.act, "resume"); assert.equal(d.next.resumeAt, rec.resumeAt + PROVIDER_RETRY_MS);
  for (const s of ["cancelled", "done", "failed", "lost"]) assert.equal(wakeDecision(rec, { now: rec.resumeAt, state: s }).act, "drop");
});

test("PR13 a request part's routing whose provider is down is WAITING, never `routing-failed`", () => {
  const wait = waitNotice(providerFailure({ status: 503 }, "grok-4.6"), { now: 0 });
  assert.equal(readRoute({ body: { ok: false, waiting: true, wait, failed: true } }).act, "waiting");
  assert.equal(readRoute({ body: { ok: true, failed: true, wait, intent: "addon" } }).act, "waiting");
  assert.equal(readRoute({ body: { ok: true, failed: true, intent: "addon" } }).act, "failed");
});

// ─── THE PAGE ────────────────────────────────────────────────────────────────

test("PR14 the page's notice: the server's fixed text, a live countdown on the page's clock, the panel row, only the two status links", async () => {
  const { createRequire } = await import("node:module");
  const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
  const f = providerFailure({ status: 503, detail: JSON.stringify({ error: { message: "The service is unavailable." } }) }, "grok-4.6");
  const wait = waitNotice(f, { now: 1000 });
  const w = EditPoll.providerWait({ wait, now: 2000 }, 50_000);
  assert.equal(w.localUntil, 50_000 + PROVIDER_RETRY_MS - 1000);
  const html = EditPoll.noticeHTML(w, 50_000);
  assert.ok(html.includes("⚠ Grok error 503 · Service Unavailable"));
  assert.ok(html.includes("Grok said: The service is unavailable."));
  assert.ok(html.includes("href=\"https://status.x.ai\""));
  assert.ok(html.includes("Your work so far is kept. Retrying in <span data-wait-until=\"" + w.localUntil + "\">4:59</span> · no charge while waiting"));
  assert.equal(EditPoll.waitRowText("Events page", w, 50_000), "⚠ Events page · Grok 503 · retrying in 4:59");
  // A link that is not a status page is dropped; words are escaped.
  const evil = EditPoll.providerWait({ wait: { ...wait, link: "https://evil.example", said: "<b>x</b>" } }, 0);
  assert.equal(evil.link, null);
  assert.ok(!EditPoll.noticeHTML(evil).includes("<b>"));
  const ok = EditPoll.providerWait({ wait: { kind: "provider-recovered", title: recoveredLine("Grok") } });
  assert.ok(EditPoll.noticeHTML(ok).includes("✓ Grok is answering again · picking up where it stopped"));
  assert.equal(EditPoll.providerWait({ wait: { kind: "other", title: "x" } }), null);
});
