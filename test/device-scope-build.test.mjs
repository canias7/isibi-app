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
import { blockedFetch } from "./fixtures/no-network.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./fixtures/cf-containers.mjs";
import { buildBucket, GOOD_DESIGN, BRIEF, BUILD_USER } from "./fixtures/build-route.mjs";
import { resultKey, jobKey, packJob, JOB_KIND } from "../builder/build-job.mjs";
import { briefWithLayout } from "../builder/page-gen.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { buildReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";

import { jobBody } from "../builder/request.mjs";
import {
  DEVICES, compareLayouts, readDeviceWishes, deviceWishesNote, deviceWishesFact, DEVICE_WISHES_FIELD,
} from "../builder/device-scope.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
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

test("a build whose render check measured nothing stores no layout (never an empty 'unchanged')", async () => {
  const r = await driveBuild({ layout: null });
  assert.ok(r.reply && r.reply.ok === true, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.saved, null);
});

test("the build path stores the layout only after a real publish, from `out.layout`, beside the landmark map", () => {
  const a = W.indexOf("if (out && out.page === \"app\" && out.render) await saveLandmarks(env, slug, out.render.landmarks");
  assert.ok(a > 0, "the build path's landmark save moved");
  const tail = W.slice(a, a + 600);
  assert.match(tail, /if \(out && out\.page === "app" && Array\.isArray\(out\.layout\)\) await saveLayout\(env, slug, out\.layout\);/);
  const p = W.indexOf("const bPayload = JSON.stringify({");
  assert.ok(p > 0);
  assert.match(W.slice(p, p + 900), /\n\s*layout: true,/, "the build's compile payload does not ask for the layout");
});

test("the wishes reader: proper subsets only, canonical order, junk and all-three dropped, capped", () => {
  assert.equal(readDeviceWishes(undefined), null);
  assert.equal(readDeviceWishes("phone"), null);
  assert.equal(readDeviceWishes([{ devices: ["phone", "tablet", "desktop"], wish: "x" }]), null);
  assert.equal(readDeviceWishes([{ devices: ["watch"], wish: "x" }]), null);
  assert.equal(readDeviceWishes([{ devices: ["phone"], wish: "  " }]), null);
  assert.deepEqual(readDeviceWishes([{ devices: ["desktop", "phone"], wish: " Wide hero " }, null, 3]), [{ devices: ["phone", "desktop"], wish: "Wide hero" }]);
  assert.equal(readDeviceWishes(Array.from({ length: 9 }, () => ({ devices: ["phone"], wish: "w" }))).length, 6);
  assert.equal(deviceWishesNote(null), "");
  assert.equal(deviceWishesFact([]), "");
  assert.deepEqual(buildFacts({ devices: WISHES }).devices, WISHES);
  assert.equal(Object.hasOwn(buildFacts({ devices: null, notBuilt: ["x"] }) || {}, "devices"), false);
});

test("the wishes reach the build only through the design answer, and only a live build's facts carry them", () => {
  assert.match(W, /deviceWishes: readDeviceWishes\(designed && designed\.devices\) \|\| undefined,/);
  assert.equal((W.match(/briefWithLayout\(\{ brief, plan, tsx, gif, qr, three, images: imgBrief, media, devices: deviceWishes \}\)/g) || []).length, 3, "the band writers, the single call and the site agent are not all told");
  assert.match(W, /devices: pages && pages\.page === "app" \? design\.deviceWishes : null/);
  assert.match(W, /devices: pages && pages\.page === "app" && buildArgs \? buildArgs\.deviceWishes : null/);
});

test("a request the server takes on files its addition with the router's devices", () => {
  const src = readFileSync(new URL("../builder/request.mjs", import.meta.url), "utf8");
  const a = src.indexOf('url: "/api/site/" + encodeURIComponent(rec.slug) + "/addon",');
  assert.ok(a > 0);
  assert.match(src.slice(a, a + 1200), /devices: Array\.isArray\(d\.devices\) && d\.devices\.length \? d\.devices : undefined,/);
  assert.equal(typeof jobBody, "function");
});
