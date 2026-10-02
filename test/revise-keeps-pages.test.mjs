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
import { publishPages } from "../builder/publish-pages.mjs";
import { mergeRevisedPages, takePagesAway } from "../builder/site-addon.mjs";

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

// ── THE MERGE ITSELF ────────────────────────────────────────────────────────

test("mergeRevisedPages keeps what was not returned, replaces what was, and takes off only what passes", () => {
  const m = mergeRevisedPages(PRIOR, [{ path: "index.tsx", source: HOME_EDITED }, { path: "faq.tsx", source: page("/faq", "<h1>FAQ</h1>") }],
    ["gallery.tsx", "menu.tsx", "index.tsx", "nope.tsx", 7]);
  assert.deepEqual(m.pages.map((p) => p.path), ["index.tsx", "menu.tsx", "visit.tsx", "faq.tsx"]);
  assert.equal(m.pages[0].source, HOME_EDITED);
  assert.equal(m.pages[1].source, MENU, "a kept page changed");
  assert.deepEqual(m.removed, ["gallery.tsx"]);
  // THE HOME PAGE IS NEVER TAKEN OFF; NOR IS A PAGE THE (EDITED) HOME STILL LINKS TO.
  assert.deepEqual(m.kept, [{ path: "menu.tsx", why: "linked", from: ["index.tsx"] }],
    "menu is linked from the home page; the home page itself was written in this answer, so it is never removed");
  assert.deepEqual(m.untouched, ["menu.tsx", "visit.tsx"]);
});

test("takePagesAway is the add-on's own rule: the home page and a linked page stay, an unlinked one goes", () => {
  const byPath = new Map(PRIOR.map((p) => [p.path, { ...p }]));
  const r = takePagesAway(byPath, ["index.tsx", "menu.tsx", "visit.tsx"], []);
  assert.deepEqual(r.gone, ["visit.tsx"]);
  assert.deepEqual(r.kept, [{ path: "index.tsx", why: "home" }, { path: "menu.tsx", why: "linked", from: ["index.tsx"] }]);
  assert.equal(byPath.has("visit.tsx"), false);
});

// ── THROUGH THE REAL PUBLISH ───────────────────────────────────────────────

test("W3 — a rewrite that returns ONE page keeps every other page byte for byte, and its links to them", async () => {
  const r = await revise({ pages: [{ path: "index.tsx", source: HOME_EDITED }] });
  assert.equal(r.out.page, "app", JSON.stringify(r.out.problems));
  const want = { "index.tsx": HOME_EDITED, "menu.tsx": MENU, "gallery.tsx": GALLERY, "visit.tsx": VISIT };
  assert.deepEqual(r.compiled, want, "the compiler was not handed the whole site");
  assert.deepEqual(r.stored, want, "the stored source is not the whole site");
  // BEFORE THE FIX the link to /menu was rewritten to "/" as dangling.
  assert.match(r.compiled["index.tsx"], /<Link to="\/menu">/, "the returned page's link to a kept page was rewritten away");
  assert.equal(r.out.removedPages, undefined);
  assert.equal(r.out.keptNote, undefined);
});

test("W3 — the kept page's component goes with it, and a component the writer rewrote replaces the stored one", async () => {
  const newBand = { name: "band", source: "export default function Band() { return <section>New band</section>; }\n" };
  const r = await revise({ pages: [{ path: "index.tsx", source: HOME_EDITED }], parts: [newBand] });
  assert.equal(r.out.page, "app", JSON.stringify(r.out.problems));
  assert.deepEqual(r.parts, ["ovens", "band"], "the stored components were not handed to the compile");
  assert.equal(r.calls.compiledParts.at(-1).find((p) => p.name === "band").source, newBand.source, "the rewritten component lost to the stored one");
  assert.equal(r.calls.compiledParts.at(-1).find((p) => p.name === "ovens").source, OVENS.source, "the kept component changed");
});

test("W3 — a page named in `remove` and linked from nowhere is taken off; nothing else moves", async () => {
  const r = await revise({ pages: [{ path: "index.tsx", source: HOME_EDITED }], remove: ["visit.tsx"] });
  assert.equal(r.out.page, "app");
  assert.deepEqual(r.compiled, { "index.tsx": HOME_EDITED, "menu.tsx": MENU, "gallery.tsx": GALLERY });
  assert.deepEqual(r.stored, r.compiled);
  assert.deepEqual(r.out.removedPages, ["visit.tsx"]);
});

test("W3 — removing a page the home page still links to, or the home page, is refused and SAID", async () => {
  const r = await revise({ pages: [{ path: "visit.tsx", source: page("/visit", "<h1>Visit us</h1>") }], remove: ["menu.tsx", "index.tsx"] });
  assert.equal(r.out.page, "app");
  assert.deepEqual(Object.keys(r.compiled).sort(), ["gallery.tsx", "index.tsx", "menu.tsx", "visit.tsx"], "a refused removal took a page");
  assert.equal(r.compiled["menu.tsx"], MENU);
  assert.equal(r.compiled["index.tsx"], HOME);
  assert.match(r.out.keptNote, /I left \/menu — \/ still links to it/, "the linked page's refusal was not said");
  assert.match(r.out.keptNote, /I left \/ — that is the home page/, "the home page's refusal was not said");
  assert.equal(r.out.removedPages, undefined);
  // A REWRITE IS READ AS A PARTIAL SET: the writer returned only /visit, and
  // the home page it left out is kept, so nothing may report it missing.
  assert.equal((r.out.problems || []).some((p) => /There is no index\.tsx/.test(p)), false,
    "the kept home page was reported missing: " + JSON.stringify(r.out.problems));
});

test("W3 — a rewrite that only takes a page off publishes the site without it", async () => {
  const r = await revise({ pages: [], remove: ["visit.tsx"] });
  assert.equal(r.out.page, "app", JSON.stringify(r.out));
  assert.deepEqual(Object.keys(r.compiled).sort(), ["gallery.tsx", "index.tsx", "menu.tsx"]);
});

test("a rewrite that wrote nothing and took nothing off is still refused, and nothing is published", async () => {
  const r = await revise({ pages: [] });
  assert.notEqual(r.out.page, "app");
  assert.equal(r.calls.stored.length, 0, "an empty answer published the stored site as a change");
});

test("a store whose components could not be read hands over only what the writer wrote, as before", async () => {
  const r = await revise({ pages: [{ path: "index.tsx", source: HOME_EDITED }] }, { priorParts: { ok: false, parts: [], why: "read" } });
  assert.deepEqual(r.parts, [], "components were invented for an unreadable store");
  assert.deepEqual(Object.keys(r.compiled).sort(), ["gallery.tsx", "index.tsx", "menu.tsx", "visit.tsx"], "the pages were not kept");
});

test("CONTROL: a first build publishes exactly what was written, and still refuses a site with no home page", async () => {
  const r = await revise({ pages: [{ path: "index.tsx", source: HOME }, { path: "menu.tsx", source: MENU }] }, { priorPages: null, priorParts: null });
  assert.equal(r.out.page, "app", JSON.stringify(r.out.problems));
  assert.deepEqual(Object.keys(r.compiled), ["index.tsx", "menu.tsx"], "a first build gained pages it never wrote");
  const bare = await revise({ pages: [{ path: "menu.tsx", source: MENU }] }, { priorPages: null, priorParts: null });
  assert.ok(bare.out.problems.some((p) => /no index\.tsx/.test(p)), "a first build with no home page is no longer reported");
  assert.equal(bare.calls.stored.length, 0, "a first build with no home page was published");
});

// ── AND THE BROWSER SAYS IT ─────────────────────────────────────────────────
//
// The kept note is only worth composing if the chat shows it. Cut from
// `public/chat.js` landmark to landmark and driven, never retyped: a copy here
// would go on passing after the real list stopped reading the field.
test("the browser's own build note list shows a refused removal's sentence, and nothing for an answer without one", async () => {
  const fs = await import("node:fs");
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const start = chat.indexOf("const note = [");
  const endMark = "].filter(Boolean).join('\\n');";
  const end = chat.indexOf(endMark, start);
  assert.ok(start > 0 && end > start, "chat.js's build note list is gone or reworded — re-read it before re-anchoring");
  assert.equal(chat.indexOf("const note = [", start + 1), -1, "chat.js has two build note lists");
  const expr = chat.slice(start + "const note = ".length, end + endMark.length - 1);
  // eslint-disable-next-line no-new-func
  const notes = new Function("d", "return (" + expr + ");");
  const kept = "I left /menu — / still links to it.";
  assert.ok(notes({ keptNote: "  " + kept + " " }).split("\n").includes(kept), "the chat does not show the kept note");
  assert.equal(notes({ salvageNote: "One page is a stub." }), "One page is a stub.", "the control: the list no longer reads its other notes");
  assert.equal(notes({ keptNote: 7 }), "", "a kept note that is not a string was shown");
});

// ── AND THROUGH THE REAL ROUTE: THE WIRING, NOT ONLY THE MODULE ────────────
//
// `publishPages` can only keep what it is handed. `POST /api/site/react-revise`
// reads the stored pages AND components and hands both over
// (`buildAndPublishPages` → `publishPages`); a hop cut anywhere on that chain
// would leave the module above correct and the site losing pages. So the real
// route, the model answers supplied: the designer, then a writer that returns
// the home page alone.
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { dispatchEnv, isDispatchUpload, dispatchOk, installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

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
