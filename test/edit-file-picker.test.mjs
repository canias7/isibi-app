// THE FILE PICKER ON EDITS (2026-10-24, the owner's parity ask). Driven through
// the real routes with a stubbed wire (no model is reached):
//   - the page rung's rewrite fallback (a target too large to show alone) sends
//     the picked pages and names the rest, withheld; below the threshold no
//     picker call; a failed pick sends what was sent before; usage is billed;
//   - the add-on's scoped writer, widened after its answer reached past its
//     scope, is picked for too (it was never picked: the scoped pass skips it).
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL, MAX_PRIOR_CHARS, pagesRequest } from "../builder/page-gen.mjs";
import { PICK_FILES_TOOL } from "../builder/file-picker.mjs";
import { addon, pagePrompt } from "./fixtures/addon-route.mjs";

const USER = { id: "u-editpick-1", email: "owner@example.com" };
const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const route = (r, name) => "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('" + r + "')({ component: " + name + " })\n";
// A HOME PAGE TOO LARGE TO SHOW ALONE, so the page rung takes its rewrite fallback.
const HOME = route("/", "Home") + "function Home(){return <main><h1>Ravenscroft</h1>" +
  Array.from({ length: 40 }, (_, i) => "<p>Para " + i + " " + "w".repeat(2400) + "</p>").join("") + "</main>}\n";
const HOME_EDITED = HOME.replace("<h1>", '<h1 className="text-5xl">');
const other = (i) => ({ path: "p" + i + ".tsx", source: route("/p" + i, "P" + i) + "function P" + i + "(){return <main><h1>Page " + i + "</h1><p>PMARK-" + i + "-zz</p></main>}\n" });
const OTHERS = Array.from({ length: 9 }, (_, i) => other(i));

function bucket(slug, pages) {
  const store = new Map([
    [SOURCE_KEY(slug), JSON.stringify(pages)],
    [PARTS_KEY(slug), JSON.stringify([])],
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

async function pageRung(slug, pages, answers) {
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
  const store = bucket(slug, pages);
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
const picks = (r) => r.calls.filter((c) => c.tool === PICK_FILES_TOOL.name);

test("the fixture: the home page is too large to show alone, so the rung's fallback sends other pages", () => {
  assert.ok(HOME.length > MAX_PRIOR_CHARS, "the home page fits the window; the fallback is not reached");
  const all = JSON.stringify(pagesRequest({ brief: "x", spec: {}, brand: "B", priorPages: [{ path: "index.tsx", source: HOME }, ...OTHERS], mode: "page", target: "index.tsx" }).messages);
  for (let i = 0; i < 9; i++) assert.ok(all.includes("PMARK-" + i + "-"), "with no pick p" + i + " was not shown");
});

test("page rung, above the threshold: other pages are withheld by name, only the picked one is shown", async () => {
  const r = await pageRung("efp-big", [{ path: "index.tsx", source: HOME }, ...OTHERS], {
    [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: WRITER,
    [PICK_FILES_TOOL.name]: { input: { files: ["p3.tsx"] }, usage: { input_tokens: 1000000, output_tokens: 10 } },
  });
  // THE WRITER'S ANSWER IS REFUSED DOWNSTREAM (a page over 48,000 characters
  // cannot be stored), so this reads what the route SENT, not an outcome.
  assert.equal(picks(r).length, 1, "the picker was not called once");
  assert.ok(r.prompt.includes("Ravenscroft"), "the router-named page was not shown");
  assert.ok(r.prompt.includes("PMARK-3-"), "the picked page was not shown");
  for (const i of [0, 5, 8]) {
    assert.ok(!r.prompt.includes("PMARK-" + i + "-"), "unpicked p" + i + " was shown");
    assert.ok(r.prompt.includes("p" + i + ".tsx"), "unpicked p" + i + " was not named as withheld");
  }
});

test("page rung, a failed pick sends every page (fail open)", async () => {
  const r = await pageRung("efp-fail", [{ path: "index.tsx", source: HOME }, ...OTHERS], { [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: WRITER, [PICK_FILES_TOOL.name]: "fail" });
  assert.equal(picks(r).length, 1, "the picker was not tried");
  for (let i = 0; i < 9; i++) assert.ok(r.prompt.includes("PMARK-" + i + "-"), "after a failed pick p" + i + " was not shown");
});

test("page rung, below the threshold: no picker call", async () => {
  const few = OTHERS.slice(0, 3);
  const SMALL_HOME = route("/", "Home") + "function Home(){return <main><h1>Ravenscroft</h1></main>}\n";
  const r = await pageRung("efp-small", [{ path: "index.tsx", source: SMALL_HOME }, ...few], {
    [TWEAK_TOOL.name]: TWEAK, [SITE_PAGES_TOOL.name]: { input: { pages: [{ path: "src/routes/index.tsx", source: SMALL_HOME.replace("<h1>", '<h1 className="x">') }] } },
    [PICK_FILES_TOOL.name]: { input: { files: ["p1.tsx"] } },
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.equal(picks(r).length, 0, "a small site called the picker");
});

// ── THE ADD-ON'S SCOPED WRITER, WIDENED ──────────────────────────────────────
const tsx = (r, name, body) => route(r, name) + "function " + name + "(){ return <main>" + body + "</main> }\n";
const SITE = [
  { path: "index.tsx", source: tsx("/", "Home", "<h1>Fretwork</h1>") },
  ...Array.from({ length: 9 }, (_, i) => ({ path: "p" + i + ".tsx", source: tsx("/p" + i, "P" + i, "<h1>Page " + i + "</h1><p>AMARK-" + i + "-zz</p>") })),
];
// THE SCOPED WRITER CHANGES p2, outside its scope (/p1): a breach, so it is asked again with the site.
const BREACH = [{ path: "src/routes/p2.tsx", source: SITE[3].source.replace("Page 2", "Page Two") }, { path: "src/routes/p1.tsx", source: SITE[2].source.replace("</main>", "<p>Parking is free.</p></main>") }];
const run = (slug, files) => addon(slug, "add a note about parking to /p1", {
  kinds: ["component"], publishes: true, storedPages: SITE, scope: { pages: ["/p1"] }, written: BREACH,
  answers: { component: { component: [{ page: "/p1", does: "a parking note", components: ["card"] }] }, files },
});
const writers = (r) => r.prompts.filter((p) => p.tool === "write_pages");
const pickCalls = (r) => r.prompts.filter((p) => p.tool === PICK_FILES_TOOL.name);

test("add-on: the scoped writer is not picked for; widened after a breach it is, and sees only the picked and required pages", async () => {
  const r = await run("efp-add", { files: ["p5.tsx"], stubUsage: { input_tokens: 2000000, output_tokens: 10 } });
  const w = writers(r);
  assert.ok(w.length >= 2, "the writer was not asked again after its breach: " + w.length + " " + JSON.stringify(r.body).slice(0, 300));
  // THE SCOPED ASK SAW ONLY ITS PAGE.
  assert.ok(w[0].text.includes("AMARK-1-") && !w[0].text.includes("AMARK-5-"), "the scoped writer saw beyond its scope");
  assert.equal(pickCalls(r).length, 1, "the widened writer was not picked for exactly once");
  const wide = w[w.length - 1].text;
  assert.ok(wide.includes("AMARK-1-") && wide.includes("AMARK-5-"), "the widened writer missed its own or the picked page");
  for (const i of [0, 4, 8]) {
    assert.ok(!wide.includes("AMARK-" + i + "-"), "unpicked p" + i + " was shown to the widened writer");
    assert.ok(wide.includes("p" + i + ".tsx"), "unpicked p" + i + " was not named");
  }
  // THE ADDITION'S OWN PAGES ARE REQUIRED, by stored path (they were not, by route id).
  assert.ok(Array.isArray(r.body.unseenPages) && !r.body.unseenPages.includes("p1.tsx"), JSON.stringify(r.body.unseenPages));
  // THE PICK'S USAGE IS ON THE ADDITION'S BILL.
  const ctl = await run("efp-add-ctl", { files: ["p5.tsx"] });
  const charged = (x) => x.charges.reduce((n, c) => n + (Number(c && (c.cost ?? c)) || 0), 0);
  assert.ok(charged(r) > charged(ctl) + 50, "the widened pick's usage was not billed: " + charged(r) + " vs " + charged(ctl));
});

test("add-on: a failed widened pick sends the whole site (fail open)", async () => {
  const r = await run("efp-add-fail", { files: ["nope.tsx"] });
  const w = writers(r);
  assert.ok(w.length >= 2 && pickCalls(r).length === 1, "the widened pick did not run");
  const wide = w[w.length - 1].text;
  for (let i = 0; i < 9; i++) assert.ok(wide.includes("AMARK-" + i + "-"), "after an unusable pick p" + i + " was not shown");
});

test("the rewrite block under the window: a pick withholds unpicked pages by name; no pick shows every page", () => {
  const pages = [{ path: "index.tsx", source: "HOME-SRC" }, { path: "about.tsx", source: "ABOUT-SRC" }, { path: "menu.tsx", source: "MENU-SRC" }];
  const text = JSON.stringify(pagesRequest({ brief: "x", spec: {}, brand: "B", priorPages: pages, mode: "page", target: "gone.tsx", only: ["index.tsx", "menu.tsx"] }).messages);
  assert.ok(text.includes("HOME-SRC") && text.includes("MENU-SRC"), "a picked page was not shown");
  assert.ok(!text.includes("ABOUT-SRC") && text.includes("about.tsx"), "an unpicked page was shown, or not named");
  const all = JSON.stringify(pagesRequest({ brief: "x", spec: {}, brand: "B", priorPages: pages, mode: "page", target: "gone.tsx" }).messages);
  assert.ok(all.includes("ABOUT-SRC"), "without a pick every page is shown");
});
