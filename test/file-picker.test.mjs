// THE FILE PICKER (2026-10-23, idea #21): on a big site one quick call picks
// which files the writer sees. Driven through the real page-rung route with a
// stubbed wire (no model is reached), plus the module and the add-on writer's
// request.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL, pagesRequest, partsSent } from "../builder/page-gen.mjs";
import { pickFiles, PICK_FILES_TOOL, PICK_MIN_CHARS, PICK_MIN_PAGES, PICK_MAX, overThreshold, requiredFiles, fileIndex } from "../builder/file-picker.mjs";

const USER = { id: "u-filepick-1", email: "owner@example.com" };
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
const HEAD = "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: Home })\n";
const HOME = HEAD + 'import CardA from "./-parts/card-a"\nimport CardB from "./-parts/card-b"\n'
  + "function Home(){return <main><h1>Ravenscroft</h1><CardA /><CardB /></main>}\n";
const HOME_EDITED = HOME.replace("<h1>", '<h1 className="text-5xl">');
// card-b imports card-c: the required set follows components into components.
const A = "export default function CardA(){return <section><h2>Opening hours</h2><p>Nine until five.</p></section>}";
const B = 'import CardC from "./card-c"\nexport default function CardB(){return <section><h2>Where to find us</h2><CardC /></section>}';
const C = "export default function CardC(){return <p>Eleven Bridge Street, by the weir.</p>}";
// Each extra carries a unique marker the prompt is searched for.
const extra = (i, size) => ({ name: "extra-" + i, source: "export default function Extra" + i + "(){return <section><h2>Band " + i + "</h2><p>MARK-" + i + "-" + "x".repeat(size) + "</p></section>}" });
const SMALL_PARTS = [{ name: "card-a", source: A }, { name: "card-b", source: B }, { name: "card-c", source: C }];
const BIG_PARTS = [...SMALL_PARTS, ...Array.from({ length: 16 }, (_, i) => extra(i, 4200))];

function bucket(slug, parts) {
  const store = new Map([
    [SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    [PARTS_KEY(slug), JSON.stringify(parts)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet", tsx: [] }, css: "" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

/** `answers[tool]` is `{ input, usage }`, or the string "fail" for a 503. */
async function run(slug, parts, answers) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const json = (v) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) { let w = 0; try { w = Number(JSON.parse(String(init.body)).cost) || 0; } catch { w = 0; } return json(w); }
    if (url.includes("/rest/v1/site_project")) return json([]);
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "" }]);
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      const a = answers[tool];
      if (!a || a === "fail") return new Response("no stub " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: a.input }], usage: a.usage || { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const store = bucket(slug, parts);
  installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: "make the heading bigger", picker: "sonnet" }),
    });
    const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", ...dispatchEnv() }, makeCtx());
    const body = await res.json().catch(() => null);
    const w = calls.find((c) => c.tool === SITE_PAGES_TOOL.name);
    return { body, calls, store, prompt: w ? JSON.stringify(w.body.messages) : "" };
  } finally { globalThis.fetch = real; }
}

const WRITER = { input: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }] } };
const TWEAK = { input: { cannot: "needs the page rewritten" } };

test("the threshold sits above every stored corpus site", () => {
  assert.ok(PICK_MIN_CHARS > 50780, "the largest corpus site (50,780 chars) would be picked");
  assert.ok(PICK_MIN_PAGES >= 6, "a six-page corpus site would be picked");
  assert.equal(overThreshold([{ path: "index.tsx", source: HOME }], SMALL_PARTS), false);
  assert.equal(overThreshold([{ path: "index.tsx", source: HOME }], BIG_PARTS), true);
});

test("the module: required files, bounds, and unusable answers", async () => {
  const pages = [{ path: "index.tsx", source: HOME }, ...Array.from({ length: 9 }, (_, i) => ({ path: "p" + i + ".tsx", source: "<h1>Page " + i + "</h1>" }))];
  const req = requiredFiles(pages, SMALL_PARTS, ["index.tsx"]);
  assert.deepEqual([...req].sort(), ["-parts/card-a", "-parts/card-b", "-parts/card-c", "index.tsx"]);
  assert.ok(!fileIndex(pages, SMALL_PARTS).includes("Nine until five"), "the index carries code");
  const many = Array.from({ length: 9 }, (_, i) => "p" + i + ".tsx");
  const ans = (files) => async () => ({ content: [{ type: "tool_use", name: "pick_files", input: { files } }], usage: { input_tokens: 3, output_tokens: 1 } });
  const ok = await pickFiles({ send: ans(many) }, { request: "x", pages, parts: SMALL_PARTS, targets: ["index.tsx"], model: "m" });
  assert.equal(ok.mark.status, "ok");
  assert.ok(ok.only.pages.includes("index.tsx"));
  assert.ok(ok.mark.chosen <= PICK_MAX + req.size);
  assert.equal(ok.usage.in, 3);
  const bad = await pickFiles({ send: ans(["ghost.tsx"]) }, { request: "x", pages, parts: SMALL_PARTS, targets: ["index.tsx"], model: "m" });
  assert.equal(bad.only, null);
  assert.equal(bad.usage.in, 3, "an unusable answer is still billed");
  const thrown = await pickFiles({ send: async () => { throw new Error("down"); } }, { request: "x", pages, parts: SMALL_PARTS, targets: [], model: "m" });
  assert.equal(thrown.only, null);
});

test("the add-on writer's request withholds unpicked pages by name", () => {
  const pages = [{ path: "index.tsx", source: "HOME-SRC" }, { path: "about.tsx", source: "ABOUT-SRC" }, { path: "menu.tsx", source: "MENU-SRC" }];
  const req = pagesRequest({ brief: "add a gallery", spec: {}, brand: "B", priorPages: pages, mode: "addon", keep: ["index.tsx"], only: ["index.tsx", "menu.tsx"] });
  const text = JSON.stringify(req.messages);
  assert.ok(text.includes("HOME-SRC") && text.includes("MENU-SRC"));
  assert.ok(!text.includes("ABOUT-SRC"), "an unpicked page's source was sent");
  assert.ok(text.includes("about.tsx"), "an unpicked page was not named as still there");
  const all = JSON.stringify(pagesRequest({ brief: "add a gallery", spec: {}, brand: "B", priorPages: pages, mode: "addon", keep: ["index.tsx"] }).messages);
  assert.ok(all.includes("ABOUT-SRC"), "without a pick every page is shown");
});
