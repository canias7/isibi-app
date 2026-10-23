// A BUILD STOPPED WHILE IT RUNS (S3-4, #231; 2026-10-23, the owner's choice 1).
//
// The queue consumer runs a build under its row's lease. A Stop pressed after
// the build began (`edit_cancel` on the row) is answered by the row's own
// `edit_beat` as `cancel: true`. Before this fix only a request's rewrite read
// it, once, before the build began; after that the build ran to its end and
// charged in full. Now each stage boundary asks: a stop refuses the next stage
// (design, provisioning, generation, publish), every debit of the build is
// reversed by ref, nothing is published or saved, the row closes cancelled and
// the answer says nothing was charged. A stop read after the activation is too
// late and changes nothing.
//
// Driven through the real `worker.queue` consumer with a supplied design
// answer; only the network is faked (GoTrue, the ledger and edit RPCs,
// Anthropic) and R2 is a Map. No paid call, no container, no live data.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockedFetch, noteUnexpected } from "./fixtures/no-network.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./fixtures/cf-containers.mjs";
import { buildBucket, GOOD_DESIGN, BRIEF, BUILD_USER } from "./fixtures/build-route.mjs";
import { resultKey, jobKey, packJob, JOB_KIND } from "../builder/build-job.mjs";
import { STOPPED_FREE_MSG, STOPPED_SHORT_MSG } from "../builder/build-lease.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const ID = "c1b2c3d4e5f60718293a4b5c6d7e8f91";
const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });

/**
 * One queued build. `cancelFrom` is the number of the `edit_beat` call (1 =
 * the first) from which the row answers `cancel: true`; Infinity never.
 */
async function driveQueued({ cancelFrom = Infinity, reverse = null } = {}) {
  const seen = { tools: [], rpc: [], beats: 0 };
  let claimed = false;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(BUILD_USER);
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
      delete args.p_mint;
      seen.rpc.push({ fn: m[1], args });
      if (m[1] === "edit_claim") return json({ ok: true, claimed: true, state: "claimed", billing: "external", uid: BUILD_USER.id });
      if (m[1] === "edit_beat") { seen.beats++; return json({ ok: true, alive: true, state: "claimed", cancel: seen.beats >= cancelFrom }); }
      if (m[1].startsWith("edit_") || m[1] === "deploy_gate_read") return json({ ok: true });
      if (m[1] === "build_debit") return new Response("{}", { status: 404 });
      if (m[1] === "credit_debit") return json({ ok: true, exempt: false, taken: Number(args.p_amount) || 2, balance: 500, repeat: false });
      if (m[1] === "credit_reverse") {
        if (reverse) { const r = reverse(args); if (r) return r; }
        return json({ ok: true, refunded: String(args.p_ref).endsWith(":deposit") || String(args.p_ref).endsWith(":settle") ? 2 : 0, already: 0, debited: 2, repeat: false });
      }
      if (m[1] === "use_quota") return json(true);
      if (m[1] === "get_credits") return json(500);
      return json({ ok: false, error: "no stub for " + m[1] }, 500);
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "POST") { claimed = true; return json([{ slug: "x", uid: BUILD_USER.id }], 201); }
      return json(claimed ? [{ uid: BUILD_USER.id, neon_db: "", brief: BRIEF }] : []);
    }
    if (url.includes("/rest/v1/edit_jobs")) return json([{ id: ID, uid: BUILD_USER.id, op: "build", state: "claimed" }]);
    if (url.includes("neon.tech")) return new Response("no neon here", { status: 503 });
    if (url.includes("/v1/messages")) {
      const b = JSON.parse(String((init && init.body) || "{}"));
      const tool = (b.tool_choice && b.tool_choice.name) || "";
      seen.tools.push(tool);
      if (tool === "design_schema") return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } });
      return new Response("stop here", { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    if (url.includes("/rest/v1/")) return json([]);
    noteUnexpected(method, url, "build-stop-midway");
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  const body = JSON.stringify({ picker: "sonnet", brief: BRIEF, images: [], qa: [], chat: "c" });
  const bucket = buildBucket({ [jobKey(ID)]: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body, uid: BUILD_USER.id, at: 1 })) });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: bucket, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id: ID }, ack() {}, retry() {} }] }, env, ctx);
    for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
    const raw = bucket.store.get(resultKey(ID));
    const out = raw ? JSON.parse(raw) : null;
    let reply = null;
    try { reply = out ? JSON.parse(out.body) : null; } catch { reply = null; }
    return { out, reply, seen, store: bucket.store };
  } finally { globalThis.fetch = blockedFetch; c.uninstall(); }
}

const step = (x) => String(x.args.p_ref || "").split(":").pop();
const debits = (seen) => seen.rpc.filter((x) => x.fn === "credit_debit").map(step);
const reversals = (seen, reason) => seen.rpc.filter((x) => x.fn === "credit_reverse" && (!reason || x.args.p_reason === reason)).map(step);
const refunds = (seen) => seen.rpc.filter((x) => x.fn === "edit_refund").map((x) => x.args.p_state);
const published = (store) => [...store.keys()].filter((k) => k.startsWith("current/") || k.startsWith("drafts/") || /^sites\/[^/]+\/live/.test(k));

test("S3-4: a stop read before the design refuses the design call and reverses the deposit", async () => {
  const r = await driveQueued({ cancelFrom: 1 });
  assert.ok(r.reply, "no answer was stored");
  assert.equal(r.out.status, 410, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.cancelled, true);
  assert.equal(r.reply.stage, "design");
  assert.equal(r.reply.cost, 0);
  assert.equal(r.reply.msg, STOPPED_FREE_MSG);
  assert.ok(!r.seen.tools.includes("design_schema"), "the design call ran after the stop");
  assert.deepEqual(debits(r.seen), ["deposit"]);
  assert.deepEqual(reversals(r.seen, "cancelled"), ["deposit", "settle", "pages"], "not every ref of the build was reversed");
  assert.deepEqual(refunds(r.seen), ["cancelled"], "the row was not closed cancelled");
  assert.deepEqual(published(r.store), []);
});

test("S3-4: a stop read after the design refuses the next stage and reverses the deposit and the settlement", async () => {
  const r = await driveQueued({ cancelFrom: 2 });
  assert.equal(r.out.status, 410, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.cancelled, true);
  assert.equal(r.reply.stage, "provision");
  assert.equal(r.reply.cost, 0);
  assert.ok(r.seen.tools.includes("design_schema"), "the design never ran — this case is not past it");
  assert.ok(!r.seen.tools.some((t) => t && t !== "design_schema"), "a later model call ran after the stop");
  assert.ok(debits(r.seen).includes("deposit"));
  assert.deepEqual(reversals(r.seen, "cancelled"), ["deposit", "settle", "pages"]);
  assert.deepEqual(refunds(r.seen), ["cancelled"]);
  assert.deepEqual(published(r.store), []);
});

test("S3-4: a stop read after provisioning refuses the page generation — no page writer, no stand-in", async () => {
  const r = await driveQueued({ cancelFrom: 3 });
  assert.equal(r.out.status, 410, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.stage, "generate");
  assert.equal(r.reply.cost, 0);
  assert.ok(!r.seen.tools.some((t) => t !== "design_schema"), "the page writer ran after the stop");
  assert.deepEqual(reversals(r.seen, "cancelled"), ["deposit", "settle", "pages"]);
  assert.deepEqual(refunds(r.seen), ["cancelled"]);
  assert.deepEqual(published(r.store), []);
});

test("S3-4: a reversal that cannot be confirmed is said, never claimed as nothing charged", async () => {
  const r = await driveQueued({ cancelFrom: 2, reverse: (a) => (a.p_reason === "cancelled" && String(a.p_ref).endsWith(":settle") ? new Response("down", { status: 503 }) : null) });
  assert.equal(r.reply.cancelled, true);
  assert.equal(r.reply.refundShort, true);
  assert.equal(Object.hasOwn(r.reply, "cost"), false, "a cost was claimed for an unconfirmed reversal");
  assert.equal(r.reply.msg, STOPPED_SHORT_MSG);
});

test("S3-4 control: no stop — the build runs past every gate exactly as before and is not cancelled", async () => {
  const r = await driveQueued();
  assert.ok(r.reply, "no answer was stored");
  assert.notEqual(r.reply.cancelled, true);
  assert.ok(r.seen.tools.includes("design_schema"));
  assert.deepEqual(reversals(r.seen, "cancelled"), [], "a build nobody stopped was reversed as stopped");
  assert.ok(!refunds(r.seen).includes("cancelled"));
  assert.ok(r.seen.beats >= 3, "the stages were not asked (" + r.seen.beats + " beats)");
});

test("S3-4: the last check sits right before the activation, and nothing after the activation reads a stop", () => {
  const a = W.indexOf("async function buildAndPublishPages(");
  const gate = W.indexOf("const fenced = await buildPublishGate(env, jobId);", a);
  const act = W.indexOf("const act = await activateBuild(buildDeps(env), {", gate);
  const end = W.indexOf("\nasync function deleteSiteFor(", act);
  assert.ok(a > 0 && gate > a && act > gate && end > act, "a landmark moved");
  const before = W.slice(W.lastIndexOf("\n", gate - 200), gate);
  assert.match(before, /stopCheck\(\)\)\s*===\s*true\)\s*throw/, "no stop check right before the publish gate");
  assert.equal(W.slice(act, end).includes("stopCheck"), false, "a stop is read after the activation");
});

test("S3-4: a stop that arrives after every gate (the build already done) changes nothing", async () => {
  // Every stage boundary is passed with no stop; the beat says cancel only
  // afterwards. The answer and the money are the control's.
  const base = await driveQueued();
  const late = await driveQueued({ cancelFrom: base.seen.beats + 1 });
  assert.equal(late.out.status, base.out.status);
  assert.notEqual(late.reply.cancelled, true);
  assert.deepEqual(debits(late.seen), debits(base.seen));
  assert.deepEqual(reversals(late.seen), reversals(base.seen));
  assert.deepEqual(refunds(late.seen), refunds(base.seen));
});
