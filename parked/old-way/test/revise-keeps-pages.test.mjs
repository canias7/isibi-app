// PARKED (2026-11-03, park-old-way): the old-way half of test/revise-keeps-pages.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A FULL REWRITE KEEPS EVERY PAGE IT DID NOT RETURN (2026-10-02, the
// whole-router audit's W3).
//
// THE CONFLICT: the one page tool every mode shares says "Leaving a page out of
// `pages` does NOT delete it: an unreturned page is KEPT", the rewrite's own
// prompt said "To DELETE a page, simply do not return it", and `publishPages`
// published exactly the pages that came back. REPRODUCED FIRST on 5ce037a0
// through this real module: a rewrite of a three-page site that returned one
// edited page published a one-page site — the other two gone, nothing said —
// and a link from the returned page to a page it did not return was rewritten
// to "/" as dangling.
//
// THE FIX: one contract, the tool's. The returned pages are folded over the
// stored ones (`mergeRevisedPages`); a page comes off only when the writer
// names it in `remove` and `takePagesAway` allows it — never the home page,
// never one a remaining page links to — and a refused removal is said
// (`keptNote`). The kept pages' components go with them (`mergeParts`), and the
// prompt now says what the tool says (`page-gen.test.mjs` holds the sentence).
//
// `publishPages` is the real module; every side effect is injected and
// recorded, the way `publish-pages.test.mjs` drives it. The writer's answers
// are SUPPLIED: this shows what is published from an answer, never how often a
// real writer returns a subset.
import test from "node:test";
import assert from "node:assert/strict";
import { publishPages } from "../../../builder/publish-pages.mjs";
import { mergeRevisedPages, takePagesAway } from "../../../builder/site-addon.mjs";

const page = (route, body, imports = "") => "import { createFileRoute, Link } from \"@tanstack/react-router\";\n" + imports
  + "export const Route = createFileRoute(\"" + route + "\")({ component: Page });\n"
  + "function Page() { return <main>" + body + "</main>; }\n";
const HOME = page("/", "<h1>Harbour Loaf</h1><Link to=\"/menu\">Menu</Link>");
const HOME_EDITED = page("/", "<h1>Harbour Loaf — open from 7</h1><Link to=\"/menu\">Menu</Link>");
const MENU = page("/menu", "<h1>Menu</h1><p>Sourdough, rye, buns.</p>");
const GALLERY = page("/gallery", "<h1>Gallery</h1><Ovens />", "import Ovens from \"./-parts/ovens\";\n");
const VISIT = page("/visit", "<h1>Visit</h1><p>Quay Street.</p>");
const PRIOR = [
  { path: "index.tsx", source: HOME },
  { path: "menu.tsx", source: MENU },
  { path: "gallery.tsx", source: GALLERY },
  { path: "visit.tsx", source: VISIT },
];
const OVENS = { name: "ovens", source: "export default function Ovens() { return <figure>The ovens</figure>; }\n" };
const BAND = { name: "band", source: "export default function Band() { return <section>Band</section>; }\n" };

const USAGE = { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 };

/** One rewrite through the real module; `answer` is the writer's tool input. */
async function revise(answer, { priorPages = PRIOR, priorParts = { ok: true, parts: [OVENS, BAND] } } = {}) {
  const calls = { compiled: [], compiledParts: [], stored: [] };
  const deps = {
    generate: async () => ({ input: { notes: "", ...answer }, usage: { ...USAGE } }),
    compile: async (pages, parts) => { calls.compiled.push(pages); calls.compiledParts.push(parts); return { ok: true, files: { "index.html": { t: "<x>" } } }; },
    publish: async (dist, pages) => { calls.stored.push(pages); },
    readCredits: async () => 500,
    useCredits: async (n) => n,
  };
  const out = await publishPages(deps, { spec: { tables: [] }, slug: "s", livePages: priorPages ? priorPages.map((p) => p.path) : undefined, priorPages, priorParts });
  const byPath = (list) => Object.fromEntries((list || []).map((p) => [p.path, p.source]));
  return {
    out, calls,
    compiled: byPath(calls.compiled.at(-1)),
    stored: byPath(calls.stored.at(-1)),
    parts: (calls.compiledParts.at(-1) || []).map((p) => p.name),
  };
}

// ── AND THROUGH THE REAL ROUTE: THE WIRING, NOT ONLY THE MODULE ────────────
//
// `publishPages` can only keep what it is handed. `POST /api/site/react-revise`
// reads the stored pages AND components and hands both over
// (`buildAndPublishPages` → `publishPages`); a hop cut anywhere on that chain
// would leave the module above correct and the site losing pages. So the real
// route, the model answers supplied: the designer, then a writer that returns
// the home page alone.
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { SITE_PAGES_TOOL } from "../../../builder/page-gen.mjs";

const ROUTE_USER = { id: "u-revise-keep-1", email: "owner@example.com" };
const rjson = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

async function reviseRoute({ answer }) {
  const slug = "revise-keep-" + Math.random().toString(36).slice(2, 8);
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(PRIOR)],
    ["source/" + slug + "/parts.json", JSON.stringify([OVENS, BAND])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  const bucket = {
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/auth/v1/user")) return rjson(ROUTE_USER);
    if (url.includes("/rpc/credit_debit")) return rjson({ ok: true, exempt: false, taken: 2, balance: 500, repeat: false });
    if (url.includes("/rpc/credit_reverse")) return rjson({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false });
    if (url.includes("/rpc/use_quota")) return rjson(true);
    if (url.includes("/rpc/get_credits")) return rjson(500);
    if (url.includes("/rpc/use_credits")) return rjson(Number(JSON.parse(String(init.body || "{}")).cost) || 0);
    if (url.includes("/rest/v1/site_backends")) return method === "GET" ? rjson([{ uid: ROUTE_USER.id, neon_db: "", brief: "a bakery" }]) : rjson([]);
    if (url.includes("/rest/v1/site_project")) return rjson([]);
    if (url.includes("/v1/messages")) {
      const body = JSON.parse(String(init.body || "{}"));
      const tool = (body.tool_choice && body.tool_choice.name) || "";
      const usage = { input_tokens: 100, output_tokens: 50 };
      if (tool === "design_schema") {
        return rjson({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }], components: [], css: "" } }], usage });
      }
      if (tool === SITE_PAGES_TOOL.name) return rjson({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answer }], usage });
      return new Response("no stub for " + tool, { status: 503 });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("not stubbed", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/react-revise", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ slug, instruction: "Say we open from 7 on the home page", picker: "sonnet" }),
    });
    const env = { SITES_BUCKET: bucket, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITE_BUILD_CONTAINER: {} };
    const ctx = makeCtx();
    const res = await worker.fetch(req, env, ctx);
    const reply = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    // THE COMPILE, NOT THE MODEL HOP: both go to the build service, and only
    // the compile ends in `/build`.
    const build = c.calls.find((k) => /\/build$/.test(k.url));
    const files = (build && build.body && build.body.files) || {};
    const pageFiles = Object.fromEntries(Object.entries(files).filter(([p]) => /\.tsx$/.test(p) && !p.includes("-parts/") && !/__root/.test(p)).map(([p, src]) => [p.replace(/^src\/routes\//, ""), src]));
    const partNames = ((build && build.body && build.body.parts) || []).map((p) => p.name);
    return { status: res.status, reply, pageFiles, partNames, stored: JSON.parse(store.get("source/" + slug + "/pages.json") || "[]") };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

test("W3 — through the real rewrite route: a writer that returns the home page alone keeps the other three pages and their components", async () => {
  const r = await reviseRoute({ answer: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], notes: "Updated the home page." } });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.equal(r.reply.page, "app", JSON.stringify(r.reply));
  assert.deepEqual(r.pageFiles, { "index.tsx": HOME_EDITED, "menu.tsx": MENU, "gallery.tsx": GALLERY, "visit.tsx": VISIT },
    "the container was not handed the whole site");
  assert.deepEqual(r.partNames, ["ovens", "band"], "the kept gallery's component was not handed to the container");
  assert.deepEqual(r.stored.map((p) => p.path).sort(), ["gallery.tsx", "index.tsx", "menu.tsx", "visit.tsx"], "the stored source lost a page");
});

// ── A SITE TOO LARGE TO SHOW (audit A21-3) ──────────────────────────────────
//
// Over `MAX_PRIOR_CHARS` the rewrite was told page NAMES and "write them again
// in full … the same wording", and each returned page replaced its stored one.
// Now the prompt shows what fits (`priorPagesSent`) and names the rest, and a
// returned page that was not shown is dropped: the stored page stands.
import { priorPagesBlock, priorPagesSent, MAX_PRIOR_CHARS } from "../../../builder/page-gen.mjs";

const pad = (route, title, n) => page(route, "<h1>" + title + "</h1><p>" + "Our own words. ".repeat(n) + "</p>");
const BIG = [
  { path: "index.tsx", source: pad("/", "Home", 2800) },
  { path: "menu.tsx", source: pad("/menu", "Menu", 2800) },
  { path: "visit.tsx", source: pad("/visit", "Visit", 2800) },
];
