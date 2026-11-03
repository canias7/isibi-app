// PARKED (2026-11-03, park-old-way): the old-way half of test/visual-review-frontend.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE VISUAL REVIEW, FRONT-END CHANGES ONLY (2026-10-24, owner: "only when
// you're changing the front end … if you're changing … the back end, like the
// database … you don't need it").
//
// On by default. It runs on first builds and revises (`publishPages`) and on
// every publish through the shared seam (`recompileAndPublish`) whose FILES
// change what a visitor sees: pages, parts, the stylesheet, the theme, the
// logo. A data row, a rule, a table, a setting or a restore republishes the
// same files and is never looked at. Driven through the real
// `POST /api/site/<slug>/edit` and through the real seam
// (`draftFirstApi.recompileAndPublish`), every model answer supplied in the
// shape its tool asks for, the compiler stubbed — no model is called.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tweakInput } from "../../../test/fixtures/tweak-edits.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { TWEAK_TOOL } from "../../../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../../../builder/page-gen.mjs";
import { REVIEW_TOOL, visibleChanges, shotPreference, runVisualReview, visualReviewOn } from "../../../builder/visual-review.mjs";
import { visualReviewFacts } from "../../../builder/site-progress.mjs";
import { editReplyFacts, addonReplyFacts } from "../../../builder/site-reply.mjs";

const USER = { id: "u-vrfe-1", email: "owner@example.com" };
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";
const HOME = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><h1>Ravenscroft</h1><section className=\"mt-96\"><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
const BIGGER = HOME.replace("<h1>", '<h1 className="text-6xl">');
const LOOKED = BIGGER.replace("mt-96", "mt-8");
const GALLERY = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/gallery')({ component: G })\n"
  + "function G(){return <main><h1>Gallery</h1><div className=\"mt-96\">Pictures</div></main>}\n";
const FIX = (route, old, nw) => ({ problems: [{ route, problem: "a huge gap at phone width", edits: [{ old, new: nw }] }] });
const SHOTS = (body) => {
  const routes = ["/", ...(Array.isArray(body.shots) ? body.shots : [])].filter((r, i, a) => a.indexOf(r) === i).slice(0, 3);
  return routes.flatMap((route) => [{ route, viewport: "phone", height: 900, png: "AAAA" }, { route, viewport: "desktop", height: 900, png: "BBBB" }]);
};

function bucket(slug, pages = [{ path: "index.tsx", source: HOME }]) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify(pages)],
    ["source/" + slug + "/parts.json", "[]"],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function stubFetch(seen, answers) {
  const queue = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.slice() : v]));
  return async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.tools.push(tool);
      seen.requests.push(args);
      const q = queue[tool];
      const a = Array.isArray(q) ? (q.length > 1 ? q.shift() : q[0]) : q;
      if (a === undefined) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: tool === "write_tweak" ? tweakInput(a, args) : a }], usage: { input_tokens: 3000, output_tokens: 300 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
}

const ENV = (b, extra = {}) => ({ SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", ...dispatchEnv(), ...extra });

/** A page-rung message through the real route. */
async function driveEdit({ answers, env = {} }) {
  const slug = "vrfe-" + Math.random().toString(16).slice(2, 10);
  const b = bucket(slug);
  const seen = { tools: [], debits: [], requests: [] };
  const real = globalThis.fetch;
  globalThis.fetch = stubFetch(seen, answers);
  const c = installCompiler({ shots: SHOTS });
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: "make the heading bigger", picker: "sonnet" }),
    }), ENV(b, env), ctx);
    const body = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    const builds = c.calls.filter((k) => new URL(k.url).pathname === "/build");
    const stored = JSON.parse(b.store.get(SRC_KEY(slug))).find((p) => p.path === "index.tsx").source;
    return { status: res.status, body, seen, builds, stored };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

/** The seam itself, with the pages and parts a caller hands it. */
async function driveSeam({ pages, parts, answers = {}, env = {}, charge = true, storedPages, failWhen = null }) {
  const slug = "vrfs-" + Math.random().toString(16).slice(2, 10);
  const b = bucket(slug, storedPages);
  const seen = { tools: [], debits: [], requests: [] };
  const charged = [];
  const real = globalThis.fetch;
  globalThis.fetch = stubFetch(seen, answers);
  const c = installCompiler({ shots: SHOTS, failWhen });
  try {
    const { draftFirstApi } = await loadWorkerModule();
    const r = await draftFirstApi.recompileAndPublish(ENV(b, env), {
      slug, pages, parts, label: "test",
      models: { quick: "claude-haiku-4-5", pages: "claude-sonnet-4-5" },
      ...(charge ? { charge: async (usage) => { charged.push(usage); return 2; } } : {}),
    });
    const builds = c.calls.filter((k) => new URL(k.url).pathname === "/build");
    return { r, seen, builds, charged, store: b.store, slug };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const TWEAK_PAGE = (source) => ({ [TWEAK_TOOL.name]: { cannot: "too large" }, [SITE_PAGES_TOOL.name]: { pages: [{ path: "src/routes/index.tsx", source }], parts: [] } });
const reviews = (seen) => seen.tools.filter((t) => t === REVIEW_TOOL.name).length;
const taken = (seen) => seen.debits.reduce((a, n) => a + n, 0);

// ── THROUGH THE ROUTE ────────────────────────────────────────────────────────

test("PAGE EDIT: the review runs on the render check's shots, its fix is recompiled, saved and charged", async () => {
  const r = await driveEdit({ answers: { ...TWEAK_PAGE(BIGGER), [REVIEW_TOOL.name]: FIX("/", "mt-96", "mt-8") } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(reviews(r.seen), 1, "one review call");
  assert.ok(Array.isArray(r.builds[0].body.shots) && r.builds[0].body.shots.includes("/"), "the compile did not ask for the changed page's screenshots");
  const req = r.seen.requests.find((q) => q.tool_choice && q.tool_choice.name === REVIEW_TOOL.name);
  const images = req.messages[0].content.filter((x) => x.type === "image");
  assert.equal(images.length, 2, "both widths of the shot reached the model");
  assert.equal(r.builds.length, 2, "the edit's compile and the review's recompile");
  assert.equal(r.builds[1].body.files["index.tsx"], LOOKED, "the recompile did not carry the fix");
  assert.equal(r.stored, LOOKED, "the store does not hold the reviewed page");
  assert.equal(r.body.visualReview.fixed, 1);
  assert.ok(r.body.visualReview.charged > 0, "the review was not charged");
  const off = await driveEdit({ answers: TWEAK_PAGE(BIGGER), env: { VISUAL_REVIEW: "off" } });
  assert.equal(off.body.ok, true);
  assert.ok(taken(r.seen) > taken(off.seen), "the review's tokens did not reach the bill");
  assert.equal(r.body.cost, taken(r.seen), "the reply's cost is not what was taken");
  assert.ok(editReplyFacts(r.body).facts.some((f) => /looked at in a browser/.test(f.text)), "no reply fact for the fix");
});

test("OFF SWITCH: no screenshots asked, no review call, one compile", async () => {
  const r = await driveEdit({ answers: { ...TWEAK_PAGE(BIGGER), [REVIEW_TOOL.name]: FIX("/", "mt-96", "mt-8") }, env: { VISUAL_REVIEW: "off" } });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(reviews(r.seen), 0);
  assert.equal(r.builds.length, 1);
  assert.equal(r.builds[0].body.shots, undefined);
  assert.equal(r.body.visualReview, undefined);
  assert.equal(r.stored, BIGGER);
});
