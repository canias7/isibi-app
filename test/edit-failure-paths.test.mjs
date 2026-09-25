// THE EDIT'S FAILURE PATHS: WHAT A STOPPED EDIT LEAVES BEHIND, AND WHAT THE
// CUSTOMER IS TOLD IT COST (2026-09-25, the edit-path milestone).
//
// Owner: *"Review and fix the remaining failure and billing paths … Reproduce
// each suspected defect before changing it. Keep known completed work intact,
// and never turn an unreadable outcome into an automatic paid retry. Base
// billing statements on recorded ledger outcomes; don't invent refunds."*
//
// EVERY CASE IS ONE MESSAGE THROUGH THE REAL `POST /api/site/<slug>/edit`, on
// the synchronous path or on the JOB path — the real queue consumer, the real
// ledger RPC calls (faked at the wire, with a row that moves the way the real
// RPCs move it), and then the real poll route, which is what the browser reads.
// The screen is the browser's own composer (`editBrowserReply` runs
// `public/chat.js`'s `editAnswer`), handed the routing reply the page holds.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer is SUPPLIED, so what is
// established is the route's and the browser's handling of each answer — never
// that a real model answers that way.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM — a hand-typed name is
// a stub that never matches.
import { pickTool, editTool } from "../builder/site-lanes.mjs";
import { NAV_TOOL } from "../builder/site-nav.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = { pick: pickTool().name, lane: editTool("css").name, nav: NAV_TOOL.name };
const USER = { id: "u-failpaths-1", email: "owner@example.com" };
// WHAT THE ROUTING CALL COST, as the routing reply the page holds records it.
const ROUTED = { cost: 2 };

const page = (route, body) => "import { createFileRoute, Link } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
// A LINK IN THE COPY, so the menu rung has something to read and reaches its
// model call rather than answering "no menu" for free.
const STORED = [
  { path: "index.tsx", source: page("/", "<section><h2>Welcome</h2><p>Bread every morning.</p><Link to=\"/visit\">Find us</Link></section>") },
  { path: "visit.tsx", source: page("/visit", "<section><h2>Find us</h2><p>Quay Street.</p></section>") },
];
const LOOK = { brand: "Harbour Loaf", theme: "broadsheet" };

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(STORED)],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: LOOK, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * ONE MESSAGE, on either money path. `site` carries a store from an earlier
 * message, so a case can send a second one to the same site. `lanes` answers
 * the look lanes' editor in order (the correction round is its second call).
 * `render` is the build's render report, per build. `cancel` makes every
 * heartbeat answer that the customer asked to stop, and the heartbeat fire at
 * once. `skew` moves the clock forward by that much after the first build.
 */
async function drive({ mode = "sync", routed, ask, pick = null, lanes = null, nav, navThrows = null, render = null, cancel = false, skew = 0, site = null }) {
  const slug = site ? site.slug : "fail-" + mode + "-" + hex32().slice(0, 8);
  const b = site ? site.b : bucket(slug);
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, ...routed, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { rpc: [], debits: [], models: [] };
  // THE JOB'S ROW, moved the way the real RPCs move it: a reserve holds
  // credits, a finalize with `p_ok` settles them, a refund gives them back.
  const row = { state: "routing", billing: "none", cost: 0, result: null };
  let laneN = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel });
        case "edit_reserve": row.cost += Number(args.p_cost); row.billing = "reserved"; return json({ ok: true, charged: Number(args.p_cost), cost: row.cost, billing: "reserved" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize":
          if (args.p_result) row.result = args.p_result;
          if (args.p_ok) { row.state = "done"; if (row.billing === "reserved") row.billing = "finalized"; return json({ ok: true, billing: row.billing, cost: row.cost }); }
          return json({ ok: false, error: "not-published", state: row.state });
        case "edit_refund": {
          const was = row.billing;
          row.state = args.p_state || "failed";
          if (was === "reserved") { row.billing = "refunded"; return json({ ok: true, refunded: row.cost }); }
          return json({ ok: true, refunded: 0, billing: was });
        }
        case "edit_get": return json({ ok: true, job: id, slug, state: row.state, phase: null, cost: row.cost, billing: row.billing, result: row.result, needs_review: false, ms: 1000 });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push(tool);
      if (tool === T.pick && pick) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: pick }], usage: { input_tokens: 1000, output_tokens: 500 } });
      if (tool === T.lane && lanes) {
        const a = lanes[Math.min(laneN++, lanes.length - 1)];
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: a }], usage: { input_tokens: 300, output_tokens: 60 } });
      }
      if (tool === T.nav) {
        if (navThrows) throw navThrows;
        if (nav !== undefined) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: nav }], usage: { input_tokens: 800, output_tokens: 90 } });
      }
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  // THE CLOCK, moved forward after the first build when a case asks: the job's
  // budget reads `Date.now`, so this is how "not enough time left" is reached.
  const realNow = Date.now;
  let skewed = 0;
  Date.now = () => realNow() + skewed;
  const report = typeof render === "function" ? (n) => { const r = render(n); if (n === 1 && skew) skewed = skew; return r; } : render;
  const c = installCompiler(report ? { render: report } : {});
  const realInterval = globalThis.setInterval;
  // A CANCEL IS PICKED UP BY A HEARTBEAT, which runs on a thirty-second timer;
  // here it runs at once, so the cancel is in hand before the publish gate.
  if (cancel) globalThis.setInterval = (fn) => { fn(); return 0; };
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let status = 0, reply = null;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      // WHAT THE BROWSER READS: the poll route's answer for the finished job.
      const poll = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
      status = poll.status;
      reply = await poll.json().catch(() => null);
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      status = res.status;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const said = editBrowserReply(reply, status >= 200 && status < 300, ROUTED);
    const config = JSON.parse(b.store.get(CONFIG_KEY(slug)) || "{}");
    return {
      site: { slug, b }, status, reply, said, config,
      builds: c.calls.map((k) => JSON.stringify(k.body)),
      models: seen.models,
      debits: seen.debits,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
      committed: seen.rpc.some((r) => r.fn === "edit_committed"),
      row: { ...row, result: undefined },
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
    globalThis.setInterval = realInterval;
    Date.now = realNow;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A STOPPED EDIT PUTS BACK THE DESIGN IT WROTE
// ─────────────────────────────────────────────────────────────────────────────
//
// A rung writes its look or stylesheet into the stored config BEFORE the one
// publish. REPRODUCED on the parent: a job cancelled after the css lane wrote
// its rule answered "your site is untouched" — and the NEXT message, a name
// change, compiled with that rule in it. The live site was untouched; the
// stored design was not, and the next edit shipped it.

const CSS_ASK = "Make the header button forest green.";
const PICK_CSS = { fields: ["css"] };
const GREEN = "#014421";
const CLEAN_CSS = { css: "[data-slot=\"site-link\"]{background-color:" + GREEN + "}" };
const DEAD_CSS = { css: "header button{background-color:" + GREEN + "}" };
const STILL_DEAD = { css: "header .btn{background-color:" + GREEN + "}" };
const DEAD = { ok: true, checked: 2, pages: 1, findings: [], deadSelectors: ["header button"], selectorsLooked: 2, landmarks: [] };
const NAME_ASK = "Call the bakery Harbour Loaf Co.";

// WHAT A STOP OWES THE STORE: the design as it was before the message, and the
// next, unrelated message compiling without the stopped change in it.
async function assertPutBack(r, label) {
  assert.equal(r.config.css, "", label + ": the stopped change is still in the stored stylesheet");
  assert.deepEqual(r.config.look, LOOK, label + ": the stored look moved");
  assert.equal(r.committed, false, label + ": the stopped edit was published");
  const next = await drive({ mode: "sync", routed: { layer: "look" }, ask: NAME_ASK, pick: { fields: ["brand"] }, lanes: [{ brand: "Harbour Loaf Co" }], site: r.site });
  assert.equal(next.reply && next.reply.ok, true, label + ": the next message did not go through: " + JSON.stringify(next.reply));
  assert.equal(next.builds.length, 1, label + ": the next message did not build once");
  assert.ok(!next.builds[0].includes(GREEN), label + ": the next, unrelated edit shipped the stopped change");
}

test("a job cancelled at the publish gate puts back the stylesheet it wrote, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], cancel: true });
  assert.equal(r.builds.length, 0, "the cancelled edit built");
  assert.equal(r.reply && r.reply.error, "cancelled", "not the cancel: " + JSON.stringify(r.reply));
  await assertPutBack(r, "cancelled");
});

test("a job whose correction still missed puts back the stylesheet it wrote, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, STILL_DEAD], render: () => DEAD });
  assert.equal(r.builds.length, 2, "not the build and the one correction");
  assert.equal(r.reply && r.reply.error, "unverified", "not the refused correction: " + JSON.stringify(r.reply));
  await assertPutBack(r, "unverified");
});

test("a job with no time left for the correction puts back the stylesheet it wrote, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, STILL_DEAD], render: () => DEAD, skew: 14 * 60e3 });
  assert.equal(r.builds.length, 1, "the correction ran with no time for it");
  assert.equal(r.reply && r.reply.error, "budget", "not the time refusal: " + JSON.stringify(r.reply));
  await assertPutBack(r, "budget");
});

test("control: a correction that lands keeps the corrected stylesheet it published", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, CLEAN_CSS], render: (n) => (n === 1 ? DEAD : { ok: true, checked: 2, pages: 1, findings: [] }) });
  assert.equal(r.reply && r.reply.ok, true, "the corrected edit did not publish: " + JSON.stringify(r.reply));
  assert.equal(r.committed, true, "the corrected edit was not committed");
  assert.equal(r.config.css, CLEAN_CSS.css, "the published stylesheet was wound back under the live site");
});
