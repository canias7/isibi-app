// PARKED (2026-11-03, park-old-way): the old-way half of test/edit-page-target.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A NAMED PAGE REACHES THE PAGE IT NAMES (2026-09-23).
//
// Owner: *"Reproduce a request explicitly targeting /gallery on a two-page
// site that passes through look → page. Trace where the requested page is
// lost and why the dispatcher falls back to /. Preserve the explicit target
// through routing and dispatch. A named page must resolve to that page or
// produce a clear missing/ambiguous-target response; it must not silently
// become the homepage."*
//
// THE CHAIN IS FOUR HOPS AND THE PAGE WAS LOST AT THE FIRST ONE:
//
//   route_message ─► readEdit ─► /api/site/route ─► siteEdit ─► edit route ─► fallbackPage
//   (the model)     (site-ask)   (worker)            (chat.js)   (look door)   (page rung)
//
// The router's `page` field was documented "Only when layer is page", and
// `readEdit` returned before reading it for every other layer — so a `look`
// answer arrived with no page whatever the model said, the browser posted
// `page: ''`, and the look door's `fallbackPage` chose "/" on any site with
// more than one page. The routing reply, the browser and the dispatcher all
// forwarded a page already; they were starved.
//
// EVERY HOP BELOW IS DRIVEN, NONE IS READ: the real `/api/site/route`, the
// real `siteEdit` cut out of `public/chat.js` and run with a recording
// `apiFetch`, the real edit route with the exact body that `siteEdit` posted,
// and the real browser composer on the answer.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer is SUPPLIED — the
// router's, the picker's and the page writer's — so what is established is
// that a page the router names is carried to the writer and published there,
// never that a real model names it. The writer stub OBEYS WHATEVER FILE IT IS
// SHOWN, which is what makes a wrong target visible: shown the home page, it
// changes the home page, exactly as a real model would.

import test from "node:test";
import { tweakInput, asEdits } from "../../../test/fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { ASK_TOOL, EDIT_LAYERS, readEdit } from "../builder/site-ask.mjs";
import { pickTool, laneLayer } from "../../../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../../../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../../../builder/page-gen.mjs";
import { failureMsg } from "../../../builder/edit-failure.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible "✅ Done." for an edit body rather than throwing.
import { editBrowserReply } from "../../../scripts/addon-sweep.mjs";
// THE PAGE'S OWN POLLER UNDER THE STAND-IN (2026-10-02): the held-part helpers
// the posts and the last sentence use (`heldWire`, `heldList`) are its real ones,
// and only the key and the outcome wording are made deterministic here.
const realEditPoll = createRequire(import.meta.url)("../../../public/edit-poll.js");

const T = { route: ASK_TOOL.name, pick: pickTool().name, tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name };

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: two pages, each with two bands a writer could reorder.
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: "u-page-target-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";

const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";

const HOME = page("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>"
  + "<section className=\"hours\"><h2>Opening hours</h2><p>Open from 7am on weekdays.</p></section>");
const GALLERY = page("/gallery", "<section className=\"grid\"><h2>From the ovens</h2><p>Loaves, buns and the odd pie.</p></section>"
  + "<section className=\"market\"><h2>When to find us</h2><p>Saturday market, eight till noon.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "gallery.tsx", source: GALLERY }];
const ROUTES = ["/", "/gallery"];

/**
 * THE WRITER'S CHANGE — the second band moved above the first, verbatim. A
 * pure block move, so `sameProse` keeps it on the cheap rung (run 9's shape).
 */
function bandsSwapped(src) {
  const m = /(<section[\s\S]*?<\/section>)(<section[\s\S]*?<\/section>)/.exec(src);
  assert.ok(m, "the fixture page lost its two bands");
  return src.replace(m[0], m[2] + m[1]);
}

/** Which file the tweak writer was shown — out of the request it was sent. */
function shownFile(body) {
  const content = String(body && body.messages && body.messages[0] && body.messages[0].content || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2), content };
}

function bucket(slug) {
  const store = new Map();
  store.set(SOURCE_KEY(slug), JSON.stringify(PAGES));
  store.set(PARTS_KEY(slug), JSON.stringify([]));
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css: "" }));
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
const snapshot = (b) => JSON.stringify([...b.store.entries()].sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0)));
const storedPage = (b, slug, path) => (JSON.parse(b.store.get(SOURCE_KEY(slug))).find((p) => p.path === path) || {}).source;

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

/**
 * THE WIRE. The model is answered per TOOL and a tool with no stub is refused,
 * so a case can only pass on the calls it names. The tweak writer's answer is
 * computed FROM THE FILE IT WAS SHOWN and every file shown is recorded.
 */
function withWire(answers, run) {
  const real = globalThis.fetch;
  const seen = { calls: [], shown: [], debits: [] };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      seen.debits.push(want);
      return json(want);
    }
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (url.includes("/rest/v1/site_project")) return json([]);
    if (url.includes("/rest/v1/site_aliases")) return json([]);
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice && body.tool_choice.name || "";
      seen.calls.push(tool);
      if (tool === T.tweak) {
        const f = shownFile(body);
        seen.shown.push(f);
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: asEdits({ source: bandsSwapped(f.source) }, f.source) }], usage: { input_tokens: 10, output_tokens: 5 } });
      }
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: tool === "write_tweak" ? tweakInput(answers[tool], body) : answers[tool] }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => { try { return await run(seen); } finally { globalThis.fetch = real; } })();
}

// ─────────────────────────────────────────────────────────────────────────────
// THE BROWSER HOP, DRIVEN: `siteEdit` cut out of chat.js and run for real.
// ─────────────────────────────────────────────────────────────────────────────

const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/**
 * THE POST `siteEdit` MAKES for a routing reply — the real function, with its
 * free names supplied (the two that take and release the site's edit latch are
 * cut out of chat.js beside it) and `apiFetch` a recorder whose promise never
 * settles, so nothing past the POST runs. What comes back is the URL and the
 * body exactly as the browser would send them.
 */
function browserEditPost(site, d, instruction) {
  const fn = (head) => {
    const open = CHAT.indexOf("\nfunction " + head + "(");
    const shut = CHAT.indexOf("\n}\n", open);
    assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
    return CHAT.slice(open, shut + 2);
  };
  const sent = [];
  const ended = [];
  const ctx = vm.createContext({
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-page-target", outcomeMessage: (s) => "outcome:" + s },
    buildPicker: "sonnet",
    apiFetch: (url, init) => { sent.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext([fn("editAsk"), fn("editAskDone"), fn("siteEdit")].join("\n"), ctx);
  ctx.siteEdit(site, d, instruction, "origin-1", (t) => ended.push("finish:" + t), () => ended.push("fallback"), [], false);
  assert.deepEqual(ended, [], "siteEdit ended the message instead of posting it: " + JSON.stringify(ended));
  assert.equal(sent.length, 1, "siteEdit made " + sent.length + " requests, not one");
  return { url: sent[0].url, body: JSON.parse(sent[0].init.body) };
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE MESSAGE THROUGH THE WHOLE CHAIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The router's answer, the routing reply the worker sends, the browser's POST,
 * the edit route's answer and the customer's screen — every hop's own output,
 * collected BEFORE anything is asserted, so a red run shows the whole path.
 */
async function throughTheChain(slug, store, { routed, pick, message }) {
  const compiler = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() };
    return await withWire({ [T.route]: routed, ...(pick ? { [T.pick]: pick } : {}) }, async (seen) => {
      // HOP 1 — the routing route, with the digest `siteRoute` sends.
      const rres = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: TOKEN },
        body: JSON.stringify({ message, site: { name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app", pages: ROUTES, tables: [] },
          picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug, hasSite: true }),
      }), env, makeCtx());
      const d = await rres.json();
      // THE ROUTING CALL'S OWN CHARGE, so the edit's can be read apart from it.
      const routingDebits = seen.debits.slice();
      // HOP 2 — the browser, handed that reply exactly as `siteRoute` hands it.
      const site = { slug, name: "Harbour Loaf", react: true, pages: ROUTES.map((p) => ({ path: p })), msgs: [] };
      const post = browserEditPost(site, d, message);
      // HOP 3 — the edit route, with the body the browser composed.
      const eres = await worker.fetch(new Request("https://gofarther.dev" + post.url, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: TOKEN },
        body: JSON.stringify(post.body),
      }), env, makeCtx());
      const text = await eres.text();
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      // HOP 4 — the customer's screen, from the browser's own composer.
      const said = editBrowserReply(body, eres.ok, d);
      assert.ok(said.ok, "the browser's own handler could not run on this reply: " + said.why);
      // THE COMPILER PAYLOAD is a path → source MAP under `files`, keyed by the
      // file's place in the project; a page is found by its own file name.
      const sentFiles = compiler.calls.length ? (compiler.calls[compiler.calls.length - 1].body || {}).files || {} : {};
      const sentPage = (path) => {
        const key = Object.keys(sentFiles).find((k) => k === path || k.endsWith("/" + path));
        return key === undefined ? undefined : sentFiles[key];
      };
      const trace = {
        routedPage: d.page === undefined ? "(absent)" : d.page, routedLayer: d.layer, postedPage: post.body.page, postedLayer: post.body.layer,
        calls: seen.calls, shown: seen.shown.map((f) => f.path), status: eres.status, ok: body && body.ok,
        homeChanged: storedPage(store, slug, "index.tsx") !== HOME, galleryChanged: storedPage(store, slug, "gallery.tsx") !== GALLERY,
        screen: said.text,
      };
      const editDebits = seen.debits.slice(routingDebits.length);
      return { d, post, status: eres.status, body, said, seen, routingDebits, editDebits, compiles: compiler.calls.length, sentPage, trace };
    });
  } finally { compiler.uninstall(); }
}

const REFRESH = "refresh the credit balance";
const routingCost = (d) => " Reading your message cost " + d.cost + " credit" + (d.cost === 1 ? "" : "s") + ".";

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE ROUTER'S OWN READING
// ─────────────────────────────────────────────────────────────────────────────

test("the router keeps a page on a look answer, in the one spelling, and on no layer that cannot use it", () => {
  const call = (input) => readEdit(input, ROUTES);
  assert.deepEqual(call({ layer: "look", page: "/gallery" }), { intent: "edit", answer: "", layer: "look", page: "/gallery" });
  // THE ONE SPELLING, as the page layer reads it.
  assert.equal(call({ layer: "look", page: "Gallery/" }).page, "/gallery");
  // ABSENT STAYS ABSENT — no key, so a whole-site change is byte-identical to before.
  assert.deepEqual(call({ layer: "look" }), { intent: "edit", answer: "", layer: "look" });
  assert.deepEqual(call({ layer: "look", page: "  " }), { intent: "edit", answer: "", layer: "look" });
  // A PAGE THE SITE DOES NOT HAVE IS KEPT, NOT TURNED INTO AN ADD-ON: the edit
  // route says so and lists the real pages. (The `page` layer's own rule —
  // a page not in the list is an add-on — is unchanged.)
  assert.equal(call({ layer: "look", page: "/menu" }).page, "/menu");
  assert.equal(call({ layer: "page", page: "/menu" }).intent, "addon");
  // A LAYER THAT HAS NO USE FOR A PAGE STILL CARRIES NONE.
  for (const layer of EDIT_LAYERS.filter((l) => l !== "look" && l !== "page")) {
    assert.equal(call({ layer, page: "/gallery" }).page, undefined, layer + " now carries a page it cannot act on");
  }
  // AND THE MODEL IS TOLD IT MAY ANSWER ONE: the field's own description names
  // the look layer, or the router is instructed to leave it empty exactly here.
  assert.match(ASK_TOOL.input_schema.properties.page.description, /"look"/, "the router is still told the page is for the page layer only");
});
