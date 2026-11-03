// PARKED (2026-11-03, park-old-way): the old-way half of test/one-reply.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
const { planParts, newRequest, nextStep, noteJobId, requestView, resumeCredits } = await import("../../../builder/request.mjs");
const O = await import("../../../builder/one-reply.mjs");

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

// ── THE WORKER: one writer, idempotent, stored on the record ────────────────
const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
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

test("WORKER WIRING: the request's GET writes the one reply before its view; the older request reply stands down", () => {
  const get = W.indexOf("let qRec = moved || found.rec;");
  assert.ok(get > 0);
  const near = W.slice(get, get + 900);
  assert.match(near, /oneReplyFor\(env, ctx, qRec/);
  assert.ok(near.indexOf("oneReplyFor") < near.indexOf("requestView(qRec") || near.indexOf("requestView(qRec") < 0);
  const rr = W.slice(W.indexOf("async function requestReply(env, rec) {"), W.indexOf("async function requestReply(env, rec) {") + 300);
  assert.match(rr, /if \(oneReplyOn\(\)\) return null;/);
});
