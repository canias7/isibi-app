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
import { tweakInput } from "./fixtures/tweak-edits.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { REVIEW_TOOL, visibleChanges, shotPreference, runVisualReview, visualReviewOn } from "../builder/visual-review.mjs";
import { visualReviewFacts } from "../builder/site-progress.mjs";
import { editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";

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
      const tool = (args.tool_choice && (args.tool_choice.name || (args.tool_choice.type === "any" && args.tools && args.tools[0] && args.tools[0].name))) || "";
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

// ── THROUGH THE SEAM ─────────────────────────────────────────────────────────

test("BACK-END ONLY (a data row, a rule, a table, a restore: the same files republished): never looked at", async () => {
  const r = await driveSeam({ pages: [{ path: "index.tsx", source: HOME }], parts: [], answers: { [REVIEW_TOOL.name]: FIX("/", "mt-96", "mt-8") } });
  assert.equal(r.r.ok, true, JSON.stringify(r.r));
  assert.equal(reviews(r.seen), 0, "a publish that changed no visible file was reviewed");
  assert.equal(r.builds[0].body.shots, undefined, "screenshots were asked for");
  assert.equal(r.charged.length, 0);
  assert.equal(r.r.visualReview, undefined);
});

test("ADD-ON WITH A PAGE: looked at, the new page's route screenshotted, its fix kept; the unchanged home never edited", async () => {
  const r = await driveSeam({
    pages: [{ path: "index.tsx", source: HOME }, { path: "gallery.tsx", source: GALLERY }], parts: [],
    answers: { [REVIEW_TOOL.name]: FIX("/gallery", "mt-96", "mt-4") },
  });
  assert.equal(r.r.ok, true, JSON.stringify(r.r));
  assert.equal(reviews(r.seen), 1);
  assert.deepEqual(r.builds[0].body.shots, ["/gallery"]);
  const req = r.seen.requests.find((q) => q.tool_choice && q.tool_choice.name === REVIEW_TOOL.name);
  const text = JSON.stringify(req.messages);
  assert.ok(text.includes("THE SOURCE OF /gallery") && !text.includes("THE SOURCE OF / ("), "the review was offered a page this change did not touch");
  assert.equal(r.builds[1].body.files["gallery.tsx"], GALLERY.replace("mt-96", "mt-4"));
  assert.equal(r.builds[1].body.files["index.tsx"], HOME);
  assert.equal(r.r.visualReview.fixed, 1);
  assert.equal(r.charged.length, 1, "billed once, through the caller's own funnel");
  assert.ok(addonReplyFacts({ ok: true, added: ["/gallery"], visualReview: r.r.visualReview }).facts.some((f) => /looked at in a browser/.test(f.text)));
});

test("ADD-ON WITH ONLY A TABLE (pages and parts unchanged): not looked at", async () => {
  const r = await driveSeam({ pages: [{ path: "index.tsx", source: HOME }], parts: [], answers: { [REVIEW_TOOL.name]: FIX("/", "mt-96", "mt-8") } });
  assert.equal(reviews(r.seen), 0);
  assert.equal(r.r.visualReview, undefined);
});

test("A PART CHANGED: looked at, every page offered", async () => {
  const r = await driveSeam({
    pages: [{ path: "index.tsx", source: HOME }], parts: [{ name: "footer.tsx", source: "export function Footer(){return <footer>hi</footer>}\n" }],
    answers: { [REVIEW_TOOL.name]: { problems: [] } },
  });
  assert.equal(r.r.ok, true, JSON.stringify(r.r));
  assert.equal(reviews(r.seen), 1);
  assert.equal(r.r.visualReview.none, true);
  assert.equal(r.builds.length, 1, "nothing to fix, no recompile");
});

test("A FIX THAT DOES NOT BUILD keeps the publish as it was — never worse, and only the review's call is billed", async () => {
  const r = await driveSeam({
    pages: [{ path: "index.tsx", source: HOME }, { path: "gallery.tsx", source: GALLERY }], parts: [],
    answers: { [REVIEW_TOOL.name]: FIX("/gallery", "mt-96", "mt-4 broken"), [TWEAK_TOOL.name]: { cannot: "no" } },
    failWhen: (body) => String((body.files || {})["gallery.tsx"] || "").includes("broken"),
  });
  assert.equal(r.r.ok, true, JSON.stringify(r.r));
  assert.equal(r.r.visualReview.fixed, 0);
  assert.ok(r.r.visualReview.failed, "the failed fix is not said");
  const pub = JSON.parse(r.store.get(SRC_KEY(r.slug))).find((p) => p.path === "gallery.tsx");
  assert.equal(pub.source, GALLERY, "a fix that did not build was saved");
});

test("NOTHING TO BILL IT THROUGH: not run (the existing billing rules)", async () => {
  const r = await driveSeam({ pages: [{ path: "index.tsx", source: BIGGER }], parts: [], charge: false, answers: { [REVIEW_TOOL.name]: FIX("/", "mt-96", "mt-8") } });
  assert.equal(r.r.ok, true);
  assert.equal(reviews(r.seen), 0);
  assert.equal(r.builds[0].body.shots, undefined);
});

test("SEAM OFF SWITCH: never", async () => {
  const r = await driveSeam({ pages: [{ path: "index.tsx", source: BIGGER }], parts: [], env: { VISUAL_REVIEW: "off" }, answers: { [REVIEW_TOOL.name]: FIX("/", "mt-96", "mt-8") } });
  assert.equal(reviews(r.seen), 0);
  assert.equal(r.builds[0].body.shots, undefined);
});

// ── THE DECISION, AS A MODULE ────────────────────────────────────────────────

test("visibleChanges: from the files — pages, parts, stylesheet, theme, logo; never a description; unknown is not visible", () => {
  const P = [{ path: "index.tsx", source: "a" }];
  const C = { look: { theme: "t", description: "d" }, css: "", logo: null };
  assert.equal(visibleChanges({ before: { pages: P, parts: [], config: C }, after: { pages: P, parts: [], config: C } }).visible, false);
  assert.deepEqual(visibleChanges({ before: { pages: P, parts: [] }, after: { pages: [{ path: "index.tsx", source: "b" }], parts: [] } }).pages, ["index.tsx"]);
  assert.deepEqual(visibleChanges({ before: { pages: P, parts: [] }, after: { pages: [], parts: [] } }).pages, ["index.tsx"], "a removed page counts");
  assert.deepEqual(visibleChanges({ before: { pages: P, parts: [] }, after: { pages: P, parts: [{ name: "x.tsx", source: "y" }] } }).parts, ["x.tsx"]);
  const desc = visibleChanges({ before: { pages: P, parts: [], config: C }, after: { pages: P, parts: [], config: { ...C, look: { ...C.look, description: "new" } } } });
  assert.equal(desc.visible, false, "an SEO description is not front end");
  assert.deepEqual(visibleChanges({ before: { pages: P, parts: [], config: C }, after: { pages: P, parts: [], config: { ...C, css: "h1{}" } } }).styles, ["css"]);
  assert.deepEqual(visibleChanges({ before: { pages: P, parts: [], config: C }, after: { pages: P, parts: [], config: { ...C, look: { ...C.look, theme: "u" } } } }).styles, ["theme"]);
  assert.deepEqual(visibleChanges({ before: { pages: P, parts: [], config: C }, after: { pages: P, parts: [], config: { ...C, logo: { url: "x" } } } }).styles, ["logo"]);
  const unk = visibleChanges({ before: { pages: null }, after: { pages: P } });
  assert.equal(unk.known, false); assert.equal(unk.visible, false);
  assert.deepEqual(shotPreference({ pages: ["visit.tsx", "index.tsx"] }), ["/visit", "/"]);
});

test("the switch is on by default and the first build gets the review whenever it is on (revises too)", () => {
  assert.equal(visualReviewOn({}), true);
  assert.equal(visualReviewOn({ VISUAL_REVIEW: "off" }), false);
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const visualOn = visualReviewOn\(env\);/);
  assert.match(w, /visualReview: visualOn \? /);
  const d = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(d, /VISUAL_REVIEW: \$\{\{ secrets\.VISUAL_REVIEW \|\| 'on' \}\}/);
  assert.match(d, /\n\s+REQUEST_FLOW\n\s+VISUAL_REVIEW\n/);
});

test("the device scope's hook: a scoped review sees only that width", async () => {
  const page = { path: "index.tsx", source: HOME };
  let sent = null;
  await runVisualReview({ shots: SHOTS({}), pages: [page], viewport: "phone", send: async (req) => { sent = req; return { content: [{ type: "tool_use", name: REVIEW_TOOL.name, input: { problems: [] } }] }; } });
  const imgs = JSON.stringify(sent.messages).match(/"type":"image"/g) || [];
  assert.equal(imgs.length, 1);
  assert.ok(JSON.stringify(sent.messages).includes("at phone width") && !JSON.stringify(sent.messages).includes("at desktop width"));
});

test("progress: one fact when the review fixed something, none otherwise", () => {
  assert.equal(visualReviewFacts({ fixed: 2 }).length, 1);
  assert.equal(visualReviewFacts({ fixed: 0 }).length, 0);
  assert.equal(visualReviewFacts(null).length, 0);
  assert.ok(!editReplyFacts({ ok: true, layer: "page", page: "/", visualReview: { fixed: 0, none: true } }).facts.some((f) => /looked at in a browser/.test(f.text)));
});
