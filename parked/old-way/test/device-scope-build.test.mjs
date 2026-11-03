// PARKED (2026-11-03, park-old-way): the old-way half of test/device-scope-build.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// PER-DEVICE BEHAVIOUR IN THE FIRST BUILD (owner, 2026-10-24, device-scope-build).
//
// The per-device edits (`device-scope.test.mjs`) had one known limit: a
// site's first per-size change was refused until one ordinary edit had stored
// its layout, because a build never publishes through `recompileAndPublish`.
// Now every successful build and revise stores the layout at the three widths
// from its own render check, so the first scoped edit is compared at once. A
// first-build description may also carry screen-size wishes: the designer
// reads them (its tool's optional `devices`), the page writers are told, and
// the reply says which were applied. An addition the router scoped tells its
// writer and its publish is guarded.
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. A whole queued build is driven
// through the real consumer (`worker.queue`, the real `react-build` route)
// with a SUPPLIED design answer and a SUPPLIED page writer answer; only the
// network and the build service are stood in. None of it shows what a real
// designer reads as a screen-size wish, or how a real writer honours one:
// that is a paid press after a merge and a deploy.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockedFetch } from "../../../test/fixtures/no-network.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { buildBucket, GOOD_DESIGN, BRIEF, BUILD_USER } from "../../../test/fixtures/build-route.mjs";
import { resultKey, jobKey, packJob, JOB_KIND } from "../../../builder/build-job.mjs";
import { briefWithLayout } from "../../../builder/page-gen.mjs";
import { buildFacts } from "../../../builder/build-answer.mjs";
import { buildReplyFacts, addonReplyFacts } from "../../../builder/site-reply.mjs";
import { readRouting } from "../builder/site-ask.mjs";
import { jobBody } from "../../../builder/request.mjs";
import {
  DEVICES, compareLayouts, readDeviceWishes, deviceWishesNote, deviceWishesFact, DEVICE_WISHES_FIELD,
} from "../../../builder/device-scope.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });

const FIRST_PAGE = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Harbour Loaf</h1><p>Loaves from 7.</p></main>); }\n";
const LAYOUT = DEVICES.map((d, i) => ({ route: "/", device: d, n: 4 + i, digest: "d" + d }));
const WISHES = [{ devices: ["phone"], wish: "Show a short menu with only Order and Visit" }, { devices: ["tablet"], wish: "Lay the loaves out in two columns" }];
const PHONE_WISH = /FOR PHONE ONLY \(phone is below 768px .*?\): Show a short menu with only Order and Visit/;

/** One queued first build, the page writer answered through the build service's `/model`. */
async function driveBuild({ design = GOOD_DESIGN, layout = LAYOUT } = {}) {
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const seen = { designer: [], writers: [] };
  let claimed = false;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return json(BUILD_USER);
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
      if (m[1] === "edit_claim") return json({ ok: true, claimed: true, state: "claimed", billing: "external", uid: BUILD_USER.id });
      if (m[1] === "edit_beat") return json({ ok: true, alive: true, state: "claimed", cancel: false });
      if (m[1].startsWith("edit_") || m[1] === "deploy_gate_read") return json({ ok: true });
      if (m[1] === "build_debit") return new Response("{}", { status: 404 });
      if (m[1] === "credit_debit") return json({ ok: true, exempt: false, taken: Number(args.p_amount) || 2, balance: 500, repeat: false });
      if (m[1] === "credit_reverse") return json({ ok: true, refunded: 0, already: 0, debited: 2, repeat: false });
      if (m[1] === "use_quota") return json(true);
      if (m[1] === "get_credits") return json(500);
      return json({ ok: true });
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "POST") { claimed = true; return json([{ slug: GOOD_DESIGN.slug, uid: BUILD_USER.id }], 201); }
      return json(claimed ? [{ uid: BUILD_USER.id, neon_db: "", brief: BRIEF }] : []);
    }
    if (url.includes("/rest/v1/edit_jobs")) return json([{ id, uid: BUILD_USER.id, op: "build", state: "claimed" }]);
    if (url.includes("/v1/messages")) {
      const b = JSON.parse(String((init && init.body) || "{}"));
      const tool = (b.tool_choice && b.tool_choice.name) || "";
      if (tool === "design_schema") {
        seen.designer.push(b);
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: design }], usage: { input_tokens: 100, output_tokens: 50 } });
      }
      if (tool === "write_pages") {
        seen.writers.push(JSON.stringify(b.messages || []));
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "w1", name: "write_pages", input: { pages: [{ path: "index.tsx", source: FIRST_PAGE }], notes: "" } }], usage: { input_tokens: 10, output_tokens: 10 } });
      }
      return new Response("stop here", { status: 400 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    if (url.includes("/rest/v1/")) return json([]);
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler({
    layout: layout ? () => layout.map((x) => ({ ...x })) : null,
    model: async (req) => {
      seen.writers.push(JSON.stringify((req && req.messages) || []));
      return { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "w1", name: "write_pages", input: { pages: [{ path: "index.tsx", source: FIRST_PAGE }], notes: "" } }] };
    },
  });
  const body = JSON.stringify({ picker: "sonnet", brief: BRIEF, images: [], qa: [], chat: "c" });
  const bucket = buildBucket({ [jobKey(id)]: JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body, uid: BUILD_USER.id, at: 1 })) });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: bucket, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
    for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
    const raw = bucket.store.get(resultKey(id));
    const out = raw ? JSON.parse(raw) : null;
    let reply = null;
    try { reply = out ? JSON.parse(out.body) : null; } catch { reply = null; }
    const lk = "source/" + GOOD_DESIGN.slug + "/layout.json";
    const saved = bucket.store.has(lk) ? JSON.parse(bucket.store.get(lk)).layout : null;
    return { out, reply, seen, saved, builds: c.calls.filter((x) => new URL(x.url).pathname === "/build").map((x) => x.body), store: bucket.store };
  } finally { globalThis.fetch = blockedFetch; c.uninstall(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADD-ONS.

test("an addition the router scoped keeps its devices end to end: router, request, page, writer, guard, facts", () => {
  const trace = { reasons: [] };
  const a = readRouting({ content: [{ type: "tool_use", input: { intent: "addon", devices: ["tablet", "phone"] } }] }, { live: true, hasSite: true, pages: ["/"], trace });
  assert.equal(a.intent, "addon");
  assert.deepEqual(a.devices, ["phone", "tablet"]);
  assert.equal(trace.reasons.includes("edit-fields-ignored"), false, "an addition's devices were marked as ignored");
  // The observer is alive: a real edit field on an addition is still marked.
  const t2 = { reasons: [] };
  readRouting({ content: [{ type: "tool_use", input: { intent: "addon", layer: "look" } }] }, { live: true, hasSite: true, pages: ["/"], trace: t2 });
  assert.ok(t2.reasons.includes("edit-fields-ignored"), "the trace observer saw nothing");
  assert.equal(readRouting({ content: [{ type: "tool_use", input: { intent: "addon" } }] }, { live: true, hasSite: true, pages: ["/"] }).devices, undefined);
  // The routing response sends it for an addition (both places it answers).
  assert.equal((W.match(/devices: \(routed\.intent === "edit" \|\| routed\.intent === "addon"\) && Array\.isArray\(routed\.devices\)/g) || []).length, 2);
  // The page posts it with the addition.
  const i = CHAT.indexOf("function siteAddon(");
  assert.ok(i > 0);
  assert.match(CHAT.slice(i, i + 4000), /devices: d && Array\.isArray\(d\.devices\) && d\.devices\.length \? d\.devices : undefined,/);
  // The route reads it, tells the writer, and guards the publish.
  assert.match(W, /const aDevices = readDevices\(ab && ab\.devices\);\n\s*const aDeviceNote = deviceNote\(aDevices\);/);
  // RE-ANCHORED 2026-10-24 (combine-d): each parallel page writer's own directive (`aDirective`, addon-uncapped).
  assert.match(W, /brief: aInstruction \+ \(aDirective \? "\\n\\n" \+ aDirective : ""\) \+ \(aDeviceNote \? "\\n\\n" \+ aDeviceNote : ""\),/);
  const p = W.indexOf("const aPub = await recompileAndPublish(env, {");
  assert.ok(p > 0);
  assert.match(W.slice(p, p + 1800), /devices: aDevices,/, "the addition's publish is not guarded");
  // The reply says which devices.
  const f = addonReplyFacts({ ok: true, added: ["/hours"], devices: { asked: ["phone"], changed: ["phone"] } }).facts.map((x) => x.text).join(" ");
  assert.match(f, /for the phone view only/);
});
