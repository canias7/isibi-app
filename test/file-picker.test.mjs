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
      const tool = body.tool_choice?.name || (body.tool_choice?.type === "any" && body.tools?.[0]?.name) || "";
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

test("below the threshold nothing changes: no picker call, every part shown", async () => {
  const sent = [];
  assert.equal(await pickFiles({ send: async (r) => { sent.push(r); return {}; } }, { request: "x", pages: [{ path: "index.tsx", source: HOME }], parts: SMALL_PARTS, targets: ["index.tsx"] }), null);
  assert.equal(sent.length, 0);
  const r = await run("fp-small", SMALL_PARTS, { [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: WRITER, [PICK_FILES_TOOL.name]: { input: { files: [] } } });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.calls.filter((c) => c.tool === PICK_FILES_TOOL.name).length, 0, "a small site called the picker");
  for (const p of SMALL_PARTS) assert.ok(r.prompt.includes(JSON.stringify(p.source).slice(1, -1).slice(0, 60)), p.name + " not shown");
});

test("above the threshold the writer sees only the picked and the required files, and the picker is billed", async () => {
  const r = await run("fp-big", BIG_PARTS, {
    [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: WRITER,
    // The picker leaves out the router's page and its imports, names one
    // extra and one file that does not exist; its usage is large on purpose.
    [PICK_FILES_TOOL.name]: { input: { files: ["-parts/extra-3", "-parts/nope"] }, usage: { input_tokens: 1000000, output_tokens: 10 } },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  const pick = r.calls.find((c) => c.tool === PICK_FILES_TOOL.name);
  assert.ok(pick, "the picker was not called on a big site");
  const asked = JSON.stringify(pick.body.messages);
  assert.ok(asked.includes("-parts/extra-7") && !asked.includes("MARK-7-xx"), "the index must list files without their code");
  assert.ok(r.prompt.includes("MARK-3-"), "the picked part was not shown");
  for (const i of [0, 5, 15]) assert.ok(!r.prompt.includes("MARK-" + i + "-"), "unpicked extra-" + i + " was shown");
  assert.ok(r.prompt.includes("Ravenscroft"), "the router-named page was not shown");
  for (const s of [A, C]) assert.ok(r.prompt.includes(JSON.stringify(s).slice(1, -1)), "a part the page imports (directly or through card-b) was dropped");
  // 1,000,000 input tokens at sonnet's rate is far above one credit.
  assert.ok(Number(r.body.cost) > 100, "the picker's usage was not on the edit's bill: cost " + r.body.cost);
});

test("a part the writer was not shown may not be replaced (the wall reads the same pick)", async () => {
  const NEW5 = "export default function Extra0(){return <p>REWRITTEN</p>}";
  const r = await run("fp-wall", BIG_PARTS, {
    [TWEAK_TOOL.name]: TWEAK,
    [SITE_PAGES_TOOL.name]: { input: { pages: [{ path: "src/routes/index.tsx", source: HOME_EDITED }], parts: [{ name: "extra-0", source: NEW5 }] } },
    [PICK_FILES_TOOL.name]: { input: { files: ["-parts/extra-3"] } },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  const stored = JSON.parse(r.store.store.get(PARTS_KEY("fp-wall")));
  const five = stored.find((p) => p.name === "extra-0");
  assert.ok(five && five.source.includes("MARK-0-"), "an unshown part was replaced: " + (five && five.source.slice(0, 60)));
});

test("a failed picker sends the full context (fail open)", async () => {
  const r = await run("fp-fail", BIG_PARTS, { [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: WRITER, [PICK_FILES_TOOL.name]: "fail" });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.ok(r.calls.some((c) => c.tool === PICK_FILES_TOOL.name), "the picker was not tried");
  const full = await run("fp-none", BIG_PARTS, { [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: WRITER, [PICK_FILES_TOOL.name]: { input: { files: ["-parts/nope"] } } });
  // Exactly what the window shows with no picker at all.
  const want = partsSent(BIG_PARTS, { first: ["card-a", "card-b"] }).shown.map((p) => p.name);
  assert.ok(want.length > 3, "the window shows too few extras to tell");
  for (const n of want) {
    const i = n.startsWith("extra-") ? n.slice(6) : null;
    if (i === null) continue;
    assert.ok(r.prompt.includes("MARK-" + i + "-"), "after a failed pick " + n + " was not shown");
    assert.ok(full.prompt.includes("MARK-" + i + "-"), "after an unusable pick " + n + " was not shown");
  }
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
