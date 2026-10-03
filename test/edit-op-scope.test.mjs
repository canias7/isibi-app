// EACH OPERATION IN A MESSAGE RUNS WITH ITS OWN SCOPE, AND A PART THE ROUTER
// PUT OFF IS NEVER RUN (2026-09-29).
//
// Owner, after Test 6's paid run (run 52): *"The router's alsoAsked
// instructions impose 'one change per turn,' but the edit executor supports
// multiple steps. Meanwhile, the full original request reaches the picker even
// when the router says part is deferred. In run 52 that produced description +
// shape, with the shape step attempting the homepage instead of Visit. …
// Make supported multi-change edits execute each requested operation with its
// own scope. A site-wide description and a change to one named page must
// retain their separate scopes. … If some work genuinely must be deferred, it
// must not also execute during the current turn, and the customer reply must
// agree with the operation results."*
//
// THE PATH, AND WHERE EACH HOP LOST THE SCOPE (read before this file was written):
//
//   route_message ─► /api/site/route ─► siteEdit ─► edit route: pick_lanes ─► steps ─► rungs
//   (one layer,      (alsoAsked is a    (posts the  (shown the WHOLE message) (every page lane   (every step
//    one page,        note; nothing      whole       ─ so a part the router    went to ONE page:  read the WHOLE
//    alsoAsked)       branched on it)    message)    put off was still picked) the router's or /)  sentence)
//
// Run 52: the router answered `look`, no page, and put the Visit move in
// `alsoAsked`; the picker, shown the whole message, named `description` and
// `shape`; the `shape` step went to `/` with the whole sentence, found nothing
// to change, and the reply said both "⚠️ I read the / page and couldn't find a
// change…" and "I only did one thing this time. Say “…” and I'll do that next."
//
// EVERY HOP BELOW IS DRIVEN: the real `/api/site/route`, the real `siteEdit`
// and `siteAddon` cut out of `public/chat.js`, the real edit and add-on routes
// with exactly the body the browser composed — on the synchronous path and
// through the queue — and the browser's own composer on the answer.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer here is supplied: the
// router's, the picker's, the lanes' and the writers'. What this establishes is
// what the route DOES with those answers — which page and which words each
// writer is handed, what is stored and published, and what the customer reads.
// Whether a real router leaves the Visit move in the turn, and whether a real
// picker names each change's page and words, is a live measurement this file
// cannot make.
//
// THE WRITERS ACT ON THE WORDS THEY ARE GIVEN, to the file they are shown: the
// page writer moves a band only when its instruction names a heading that file
// carries, and otherwise changes nothing. So a step aimed at the wrong page, or
// handed another operation's words, shows up as an unchanged page rather than
// being papered over by a stub that edits whatever it sees.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import { createRequire } from "node:module";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { ASK_TOOL, wordsIn, heldBack } from "../builder/site-ask.mjs";
import { pickTool, editTool, pickLanes, readScopes, mergePageSteps, samePageOperation, LANE_FIELDS } from "../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { failureMsg, EDIT_FAILURES } from "../builder/edit-failure.mjs";
import { addonFailure } from "../builder/site-addon.mjs";
import { editBrowserReply, browserReply } from "../scripts/addon-sweep.mjs";
import { addon, writtenPage } from "./fixtures/addon-route.mjs";
// THE PAGE'S OWN POLLER UNDER THE STAND-IN (2026-10-02): the held-part helpers
// the posts and the last sentence use (`heldWire`, `heldList`) are its real ones,
// and only the key and the outcome wording are made deterministic here.
const realEditPoll = createRequire(import.meta.url)("../public/edit-poll.js");

const T = {
  route: ASK_TOOL.name, pick: pickTool().name, lane: editTool("description").name,
  tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name, adds: "pick_adds",
};

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: three pages, each with two bands a writer could reorder.
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: "u-op-scope-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";

const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";

const HOME = page("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>"
  + "<section className=\"order\"><h2>Order a loaf for collection</h2><p>Pick a loaf and a time.</p></section>");
const VISIT = page("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>"
  + "<section className=\"band\"><h2>Order a collection so we hold a loaf</h2><p>We keep one back for you.</p></section>");
const GALLERY = page("/gallery", "<section className=\"grid\"><h2>From the ovens</h2><p>Loaves, buns and the odd pie.</p></section>"
  + "<section className=\"market\"><h2>When to find us</h2><p>Saturday market, eight till noon.</p></section>");
const PAGES = [
  { path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "gallery.tsx", source: GALLERY },
];
const ROUTES = ["/", "/visit", "/gallery"];
const OLD_DESC = "Neighbourhood sourdough in Bristol. Browse today's bake and order a loaf for collection.";
const NEW_DESC = "Overnight sourdough from a Bristol side street, baked every morning and ready to collect at the counter.";

/** The second band moved above the first, verbatim — a pure block move. */
function bandsSwapped(src) {
  const m = /(<section[\s\S]*?<\/section>)(<section[\s\S]*?<\/section>)/.exec(src);
  assert.ok(m, "the fixture page lost its two bands");
  return src.replace(m[0], m[2] + m[1]);
}

/** The headings a file carries, read off its own source. */
const headingsOf = (src) => [...String(src).matchAll(/<h[12]>([^<]*)<\/h[12]>/g)].map((m) => m[1]);

// ─────────────────────────────────────────────────────────────────────────────
// RUN 52'S MESSAGE, AND ITS TWO OPERATIONS IN THE CUSTOMER'S OWN WORDS
// ─────────────────────────────────────────────────────────────────────────────

const DESC_WORDS = "Change the site's default search description, the one Google shows, to \"" + NEW_DESC + "\" "
  + "Where a page has its own description, leave that description as it is.";
const VISIT_WORDS = "on the Visit page only, put the \"Order a collection so we hold a loaf\" band above \"Come to the bakery\"";
// The frozen Test 6 sentence, byte for byte (358 characters).
const RUN52 = DESC_WORDS + " Then, " + VISIT_WORDS + ".";

// ─────────────────────────────────────────────────────────────────────────────
// THE STORE AND THE WIRE
// ─────────────────────────────────────────────────────────────────────────────

function bucket(slug) {
  const store = new Map();
  store.set(SOURCE_KEY(slug), JSON.stringify(PAGES));
  store.set(PARTS_KEY(slug), JSON.stringify([]));
  store.set(CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet", description: OLD_DESC }, css: "" }));
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
const storedPage = (b, slug, path) => (JSON.parse(b.store.get(SOURCE_KEY(slug))).find((p) => p.path === path) || {}).source;
const storedLook = (b, slug) => (JSON.parse(b.store.get(CONFIG_KEY(slug)) || "{}").look || {});
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const hex32 = () => randomBytes(16).toString("hex");

/** The text a request carried after one of its own headings, from its user message. */
function after(body, marker, until) {
  const content = String(body && body.messages && body.messages[0] && body.messages[0].content || "");
  const at = content.indexOf(marker);
  if (at < 0) return null;
  const rest = content.slice(at + marker.length);
  const end = until ? rest.indexOf(until) : -1;
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * THE MODEL, per tool. A tool with no stub is refused, so a case passes only on
 * the calls it names. Every request is recorded with the words it carried.
 *
 * The page writer ACTS ON ITS WORDS: it moves the two bands of the file it is
 * shown only when its instruction names a heading that file carries, and
 * otherwise sends the file back unchanged.
 */
function withWire(answers, run, slug = "") {
  const real = globalThis.fetch;
  const seen = { calls: [], picks: [], lanes: [], writers: [], adds: [], debits: [], rpc: [] };
  let reserved = 0;
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = url.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost) || 0; return json({ ok: true, charged: Number(args.p_cost) || 0, cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/get_credits")) return json(50);
    if (url.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (url.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (url.includes("/rest/v1/site_project") || url.includes("/rest/v1/site_aliases")) return json([]);
    if (url.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      const usage = { input_tokens: 10, output_tokens: 5 };
      if (tool === T.pick) seen.picks.push(after(args, "Their message:\n"));
      if (tool === T.adds) seen.adds.push(String(args.messages && args.messages[0] && args.messages[0].content || ""));
      if (tool === T.lane) {
        const field = Object.keys((args.tools && args.tools[0] && args.tools[0].input_schema && args.tools[0].input_schema.properties) || {})[0] || "";
        seen.lanes.push({ field, asked: after(args, "What they asked for:\n") });
        if (!Object.hasOwn(answers, "lane:" + field)) return new Response("no stub for lane " + field, { status: 503 });
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { [field]: answers["lane:" + field] } }], usage });
      }
      if (tool === T.tweak) {
        const instruction = after(args, "THE CHANGE THEY ASKED FOR\n", "\n\nTHE FILE (");
        const path = after(args, "\n\nTHE FILE (", ")\n");
        const source = after(args, ")\n") === null ? "" : String(args.messages[0].content).slice(String(args.messages[0].content).indexOf(")\n", String(args.messages[0].content).indexOf("\n\nTHE FILE (")) + 2);
        seen.writers.push({ path, instruction, source });
        const named = headingsOf(source).some((h) => String(instruction).includes(h));
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { source: named ? bandsSwapped(source) : source } }], usage });
      }
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answers[tool] }], usage });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => { try { return await run(seen); } finally { globalThis.fetch = real; } })();
}

// ─────────────────────────────────────────────────────────────────────────────
// THE BROWSER HOPS, DRIVEN: `siteEdit` and `siteAddon` cut out of chat.js.
// ─────────────────────────────────────────────────────────────────────────────

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const cut = (head) => {
  const open = CHAT.indexOf("\nfunction " + head + "(");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(open > 0 && shut > open, head + "'s landmarks are gone from chat.js");
  return CHAT.slice(open, shut + 2);
};

/** The POST the browser makes for a routing reply — URL and body exactly as it would send them. */
function browserPost(site, d, instruction) {
  const sent = [];
  const ended = [];
  const ctx = vm.createContext({
    editBlocked: new Set(), editInFlight: new Map(), editIdem: new Map(),
    EditPoll: { ...realEditPoll, newIdemKey: () => "idem-op-scope-" + hex32().slice(0, 12), outcomeMessage: (s) => "outcome:" + s },
    buildPicker: "sonnet", browserTimeZone: () => "Europe/London",
    apiFetch: (url, init) => { sent.push({ url, init }); return new Promise(() => {}); },
  });
  vm.runInContext([cut("editAsk"), cut("editAskDone"), cut("siteEdit"), cut("siteAddon")].join("\n"), ctx);
  const finish = (t) => ended.push("finish:" + t);
  const fallback = () => ended.push("fallback");
  if (d.intent === "addon") ctx.siteAddon(site, instruction, "origin-1", finish, fallback, d);
  else ctx.siteEdit(site, d, instruction, "origin-1", finish, fallback, [], false);
  assert.deepEqual(ended, [], "the browser ended the message instead of posting it: " + JSON.stringify(ended));
  assert.equal(sent.length, 1, "the browser made " + sent.length + " requests, not one");
  return { url: sent[0].url, body: JSON.parse(sent[0].init.body) };
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE MESSAGE THROUGH THE WHOLE CHAIN — synchronously, or through the queue
// ─────────────────────────────────────────────────────────────────────────────

async function throughTheChain({ message, routed, answers = {}, mode = "sync" }) {
  const slug = "op-scope-" + mode + "-" + hex32().slice(0, 8);
  const store = bucket(slug);
  const compiler = installCompiler();
  try {
    const worker = await loadWorker();
    const env = {
      SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key",
      SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv(),
    };
    return await withWire({ [T.route]: routed, ...answers }, async (seen) => {
      // HOP 1 — the routing route.
      const rres = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: TOKEN },
        body: JSON.stringify({ message, site: { name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app", pages: ROUTES, tables: [] },
          picker: "sonnet", firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug, hasSite: true }),
      }), env, makeCtx());
      const d = await rres.json();
      const routingCalls = seen.calls.length;
      // HOP 2 — the browser.
      const site = { slug, name: "Harbour Loaf", react: true, pages: ROUTES.map((p) => ({ path: p })), msgs: [] };
      const post = browserPost(site, d, message);
      // HOP 3 — the route the browser posted to, with the body it composed.
      let status = 0;
      let body = null;
      const url = "https://gofarther.dev" + post.url;
      if (mode === "job") {
        const id = hex32();
        store.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body: JSON.stringify(post.body), uid: USER.id, slug, secret: hex32(), at: Date.now() })));
        const ctx = makeCtx();
        await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
        await Promise.allSettled(ctx.pending || []);
        const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
        assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
        status = fin.args.p_result.status;
        body = JSON.parse(fin.args.p_result.body);
      } else {
        const res = await worker.fetch(new Request(url, {
          method: "POST", headers: { "content-type": "application/json", Authorization: TOKEN }, body: JSON.stringify(post.body),
        }), env, makeCtx());
        status = res.status;
        body = await res.json().catch(() => null);
      }
      // HOP 4 — the customer's screen, from the browser's own composer.
      const said = editBrowserReply(body, status >= 200 && status < 300, d);
      assert.ok(said.ok, "the browser's own handler could not run on this reply: " + said.why);
      const builds = compiler.calls.filter((k) => /\/build/.test(String(k.url || "")) || (k.body && k.body.files));
      const sentFiles = builds.length ? (builds[builds.length - 1].body || {}).files || {} : {};
      const sentPage = (path) => {
        const key = Object.keys(sentFiles).find((k) => k === path || k.endsWith("/" + path));
        return key === undefined ? undefined : sentFiles[key];
      };
      const trace = {
        routed: { layer: d.layer, page: d.page, alsoAsked: d.alsoAsked }, posted: { layer: post.body.layer, page: post.body.page, alsoAsked: post.body.alsoAsked },
        calls: seen.calls, picks: seen.picks, lanes: seen.lanes, writers: seen.writers.map((w) => ({ path: w.path, instruction: w.instruction })),
        status, ok: body && body.ok, layers: body && body.layers, partial: body && body.partial, deferred: body && body.deferred, screen: said.text,
      };
      return { slug, store, d, post, status, body, said, seen, routingCalls, compiles: builds.length, sentPage, trace };
    }, slug);
  } finally { compiler.uninstall(); }
}

const why = (r) => "\n" + JSON.stringify(r.trace, null, 1);
const tail = (words) => "\nI only did one thing this time. Say “" + words + "” and I’ll do that next.";

// ─────────────────────────────────────────────────────────────────────────────
// 1. RUN 52'S MESSAGE: A SITE-WIDE DESCRIPTION AND A MOVE ON THE VISIT PAGE
// ─────────────────────────────────────────────────────────────────────────────

const RUN52_PICK = {
  fields: ["description", "shape"],
  scopes: [
    { part: "description", words: DESC_WORDS },
    { part: "shape", page: "/visit", words: VISIT_WORDS },
  ],
};

for (const mode of ["sync", "job"]) {
  test("run 52's message: the description is set site-wide and the band moves on /visit, each writer handed only its own words (" + mode + ")", async () => {
    const r = await throughTheChain({
      mode, message: RUN52,
      // The router the owner asked for: `look`, no page, nothing put off.
      routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: RUN52_PICK, "lane:description": NEW_DESC },
    });
    assert.equal(RUN52.length, 358, "the fixture is no longer Test 6's frozen sentence");
    // (a) Nothing was put off, so the browser posts nothing to hold back.
    assert.equal(r.d.alsoAsked, undefined, why(r));
    assert.equal(r.post.body.alsoAsked, undefined, why(r));
    // (b) The picker read the whole message.
    assert.deepEqual(r.seen.picks, [RUN52], why(r));
    // (c) The description lane was handed the description's words, and nothing of the Visit move.
    assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_WORDS }], "the description lane was not handed its own words" + why(r));
    // (d) ONE page writer, shown the Visit page and handed the Visit move alone.
    assert.equal(r.seen.writers.length, 1, "not exactly one page writer" + why(r));
    assert.equal(r.seen.writers[0].path, "visit.tsx", "the page writer was shown the wrong page" + why(r));
    assert.equal(r.seen.writers[0].source, VISIT, why(r));
    assert.equal(r.seen.writers[0].instruction, VISIT_WORDS, "the page writer was not handed the Visit move's own words" + why(r));
    assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane, T.tweak], why(r));
    // (e) What was stored: the description, and the Visit page swapped; the other pages byte for byte.
    assert.equal(r.status, 200, why(r));
    assert.equal(r.body.ok, true, why(r));
    assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, "the site's description was not stored" + why(r));
    assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), "the Visit page's band did not move" + why(r));
    assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, "the home page moved" + why(r));
    assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), GALLERY, "the gallery page moved" + why(r));
    // (f) One publication, carrying the same.
    assert.equal(r.compiles, 1, "not exactly one compile" + why(r));
    assert.equal(r.sentPage("visit.tsx"), bandsSwapped(VISIT), why(r));
    assert.equal(r.sentPage("index.tsx"), HOME, why(r));
    assert.equal(r.sentPage("gallery.tsx"), GALLERY, why(r));
    // (g) The reply: no refusal, and no sentence about work put off. It names
    // the description; the page change beside it is the known multi-step reply
    // omission (review #9), which the owner keeps separate.
    assert.equal(r.body.partial, undefined, "a step refused" + why(r));
    assert.equal(r.body.deferred, undefined, why(r));
    assert.ok(!/⚠️/.test(r.said.text), "the screen carries a warning" + why(r));
    assert.ok(!/I only did one thing/.test(r.said.text), "the screen says work was put off" + why(r));
    assert.match(r.said.text, /^✅ Updated the look — the description\./, why(r));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHANGES TO TWO DIFFERENT PAGES
// ─────────────────────────────────────────────────────────────────────────────

const VISIT_MOVE = "On the Visit page, put the \"Order a collection so we hold a loaf\" band above \"Come to the bakery\"";
const GALLERY_MOVE = "on the gallery page, put \"When to find us\" above \"From the ovens\"";
const TWO_PAGES = VISIT_MOVE + ", and " + GALLERY_MOVE + ".";

test("changes to two different pages: each page's writer is shown its own page and handed its own words", async () => {
  const r = await throughTheChain({
    message: TWO_PAGES,
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["shape"], scopes: [
      { part: "shape", page: "/visit", words: VISIT_MOVE },
      { part: "shape", page: "/gallery", words: GALLERY_MOVE },
    ] } },
  });
  assert.deepEqual(r.seen.picks, [TWO_PAGES], why(r));
  assert.equal(r.seen.writers.length, 2, "not one writer per page" + why(r));
  assert.deepEqual(r.seen.writers.map((w) => [w.path, w.instruction]), [["visit.tsx", VISIT_MOVE], ["gallery.tsx", GALLERY_MOVE]],
    "a page writer was shown the wrong page or handed another page's words" + why(r));
  assert.equal(r.body.ok, true, why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), why(r));
  assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), bandsSwapped(GALLERY), why(r));
  assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, "the home page moved" + why(r));
  assert.equal(storedLook(r.store, r.slug).description, OLD_DESC, why(r));
  assert.equal(r.compiles, 1, why(r));
  assert.equal(r.sentPage("index.tsx"), HOME, why(r));
  assert.equal(r.body.partial, undefined, why(r));
  assert.deepEqual(r.body.pageOps, [{ page: "/visit" }, { page: "/gallery" }], "the reply's record of the page operations is wrong" + why(r));
  // THE SCREEN, EXACTLY. It claims nothing that did not happen — no warning, no
  // work held back — and SINCE 2026-10-03 it names the two pages it changed
  // (the mixed-work fixes, MW8), where it read "✅ Updated the look."
  assert.equal(r.said.text, "✅ Updated /visit and /gallery.", why(r));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. WORK THE ROUTER PUT OFF IS NOT RUN, AND THE REPLY SAYS WHAT WAS PUT OFF
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("run 52 as the router really answered: the Visit move it put off reaches no picker and no writer, and the reply agrees (" + mode + ")", async () => {
    const r = await throughTheChain({
      mode, message: RUN52,
      // Run 52's recorded routing answer.
      routed: { intent: "edit", layer: "look", alsoAsked: VISIT_WORDS },
      // A picker shown only what is left can only name the description.
      answers: { [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC },
    });
    // The browser posts the part the router put off, and the route holds it back.
    assert.equal(r.d.alsoAsked, VISIT_WORDS, why(r));
    assert.equal(r.post.body.alsoAsked, VISIT_WORDS, "the browser did not post what the router put off" + why(r));
    assert.equal(r.seen.picks.length, 1, why(r));
    assert.ok(!r.seen.picks[0].includes("Order a collection"), "the put-off move reached the picker" + why(r));
    assert.ok(r.seen.picks[0].includes(DESC_WORDS), "the picker was not shown the part being done" + why(r));
    for (const l of r.seen.lanes) assert.ok(!l.asked.includes("Order a collection"), "the put-off move reached a lane" + why(r));
    assert.deepEqual(r.seen.writers, [], "a page writer ran for work that was put off" + why(r));
    assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], why(r));
    // Stored: the description only.
    assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
    for (const [path, src] of [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]]) {
      assert.equal(storedPage(r.store, r.slug, path), src, path + " moved on work that was put off" + why(r));
    }
    // The reply names what was held back, from the route's own record.
    assert.equal(r.body.ok, true, why(r));
    assert.equal(r.body.deferred, VISIT_WORDS, "the route did not say what it held back" + why(r));
    assert.equal(r.body.partial, undefined, "a step refused" + why(r));
    assert.ok(!/⚠️/.test(r.said.text), "the screen carries a warning about work that never ran" + why(r));
    assert.ok(r.said.text.endsWith(tail(VISIT_WORDS)), "the screen does not say what was put off" + why(r));
  });
}

test("an addition the router put off beside a look change is not run: no picker, lane or add-on sees it", async () => {
  const LATER = "add a booking form";
  const message = "Make the headings dark green, and " + LATER + ".";
  const r = await throughTheChain({
    message,
    routed: { intent: "edit", layer: "look", alsoAsked: LATER },
    answers: { [T.pick]: { fields: ["css"] }, "lane:css": "h1, h2 { color: #1f4d2b; }\n" },
  });
  assert.equal(r.post.body.alsoAsked, LATER, why(r));
  assert.ok(!r.seen.picks[0].includes("booking"), "the put-off addition reached the picker" + why(r));
  assert.deepEqual(r.seen.lanes.map((l) => l.field), ["css"], why(r));
  assert.ok(!r.seen.lanes[0].asked.includes("booking"), "the put-off addition reached the stylesheet lane" + why(r));
  assert.ok(!r.seen.calls.includes(T.adds), "the add-on ran" + why(r));
  assert.equal(r.body.ok, true, why(r));
  assert.equal(r.body.deferred, LATER, why(r));
  assert.ok(r.said.text.endsWith(tail(LATER)), why(r));
  assert.ok(!r.said.actions.some((a) => /addon|SECOND/.test(a)), "the browser followed up with paid work" + why(r));
});

test("a look change the router put off beside an addition is not run by the add-on: the add-on picker never sees it", async () => {
  const LATER = "make the headings dark green";
  const message = "Add a booking form, and " + LATER + ".";
  const r = await throughTheChain({
    message,
    routed: { intent: "addon", alsoAsked: LATER },
    answers: { [T.adds]: { adds: [] } },
  });
  assert.equal(r.post.url, "/api/site/" + r.slug + "/addon", why(r));
  assert.equal(r.post.body.alsoAsked, LATER, "the browser did not post what the router put off" + why(r));
  assert.equal(r.seen.adds.length, 1, why(r));
  assert.ok(!r.seen.adds[0].includes("dark green"), "the put-off look change reached the add-on picker" + why(r));
  assert.ok(r.seen.adds[0].includes("Add a booking form"), why(r));
});

test("a put-off part the route cannot find in the message is not guessed at: nothing runs, nothing is charged, and it says so", async () => {
  const r = await throughTheChain({
    message: RUN52,
    // Not the customer's words: the router paraphrased.
    routed: { intent: "edit", layer: "look", alsoAsked: "move the ordering band to the top of the Visit page" },
    answers: {},
  });
  assert.deepEqual(r.seen.calls, [T.route], "something ran on a message the route could not split" + why(r));
  assert.equal(r.body.ok, false, why(r));
  assert.equal(r.body.error, "held-unread", why(r));
  assert.equal(r.body.cost, 0, why(r));
  assert.equal(r.body.escalate, undefined, "it climbed, which the browser reads as a rewrite" + why(r));
  assert.equal(r.body.msg, failureMsg("route/held-unread"), why(r));
  for (const [path, src] of [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]]) {
    assert.equal(storedPage(r.store, r.slug, path), src, why(r));
  }
  assert.equal(storedLook(r.store, r.slug).description, OLD_DESC, why(r));
  assert.equal(r.compiles, 0, why(r));
  assert.deepEqual(r.said.actions, [], "the browser followed up on a refusal" + why(r));
  assert.match(r.said.text, /^⚠️ /, why(r));
});

// ── THE ADD-ON ROUTE, THROUGH TO ITS DESIGNERS AND ITS REPLY ─────────────────
//
// The add-on fixture posts exactly what the browser posts for an addition —
// the message, and the routing reply's `alsoAsked` beside it — to the real
// route, with every designer's answer supplied. The pageless pair (a function
// and a job over it) runs without a container; the page kind publishes.
const FN = { name: "send_reminder", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const JOB = { name: "daily_reminder", fn: "send_reminder", everyMinutes: 1440, at: "09:00" };
const LOOK_LATER = "make the headings dark green";
const saw = (r, words) => r.prompts.filter((p) => JSON.stringify(p).includes(words)).map((p) => p.kind || p.tool);

test("an addition beside a held-back look change: the designers never see it, and the reply says what was held back", async () => {
  const message = "Remind people the day before, and " + LOOK_LATER + ".";
  const r = await addon("op-scope-addon-" + hex32().slice(0, 8), message,
    { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } }, alsoAsked: LOOK_LATER });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.kinds, ["function", "job"]);
  assert.deepEqual(r.prompts.map((p) => p.kind), ["kinds", "function", "job"], "the designers asked");
  assert.deepEqual(saw(r, "dark green"), [], "the held-back change reached a designer");
  assert.deepEqual(saw(r, "Remind people the day before"), ["kinds", "function", "job"], "the addition did not reach every designer");
  assert.equal(r.body.deferred, LOOK_LATER, "the reply does not say what was held back");
  const screen = browserReply(r.body, true);
  assert.ok(screen.ok, screen.why);
  assert.ok(screen.text.endsWith("\nI only did one thing this time. Say “" + LOOK_LATER + "” and I’ll do that next."), screen.text);
});

test("a page addition beside a held-back look change: the page writer never sees it, and the published reply says so", async () => {
  const message = "Add a gallery page, and " + LOOK_LATER + ".";
  const r = await addon("op-scope-page-" + hex32().slice(0, 8), message, {
    kinds: ["page"], publishes: true, alsoAsked: LOOK_LATER,
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "what Gallery is for", sections: ["a band"], components: ["section-header"] }] } },
    written: [writtenPage("/gallery")],
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.deepEqual(r.body.added, ["gallery.tsx"]);
  assert.ok(r.prompts.some((p) => p.tool === "write_pages"), "the page writer was not asked");
  assert.deepEqual(saw(r, "dark green"), [], "the held-back change reached a designer or the page writer");
  assert.equal(r.body.deferred, LOOK_LATER, "the published reply does not say what was held back");
  const screen = browserReply(r.body, true);
  assert.ok(screen.ok, screen.why);
  assert.ok(screen.text.endsWith("\nI only did one thing this time. Say “" + LOOK_LATER + "” and I’ll do that next."), screen.text);
});

test("an add-on whose held-back part cannot be found runs nothing, costs nothing, and says so", async () => {
  const r = await addon("op-scope-unread-" + hex32().slice(0, 8), "Remind people the day before, and " + LOOK_LATER + ".",
    { kinds: ["function", "job"], answers: { function: { function: [FN] }, job: { job: [JOB] } }, alsoAsked: "turn the headings green" });
  assert.equal(r.body && r.body.ok, false, JSON.stringify(r.body));
  assert.equal(r.body.error, "held-unread");
  assert.equal(r.body.cost, 0);
  assert.equal(r.body.msg, addonFailure("held-unread").msg);
  assert.deepEqual(r.prompts, [], "a designer was asked");
  assert.deepEqual(r.sql, [], "the database was touched");
  const screen = browserReply(r.body, true);
  assert.ok(screen.ok, screen.why);
  assert.match(screen.text, /^⚠️ /);
  assert.deepEqual(screen.actions, [], "the browser followed up on a refusal");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONTROLS: A SINGLE CHANGE, AND A PICKER THAT NAMES NO SCOPES, ARE UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

test("control: a single change on a named page, with no scopes from the picker, still lands on the router's page", async () => {
  const r = await throughTheChain({
    message: GALLERY_MOVE.replace(/^on/, "On") + ".",
    routed: { intent: "edit", layer: "look", page: "/gallery" },
    answers: { [T.pick]: { fields: ["shape"] } },
  });
  assert.equal(r.seen.writers.length, 1, why(r));
  assert.equal(r.seen.writers[0].path, "gallery.tsx", why(r));
  assert.equal(r.seen.writers[0].instruction, GALLERY_MOVE.replace(/^on/, "On") + ".", "a single change was not handed the customer's whole sentence" + why(r));
  assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), bandsSwapped(GALLERY), why(r));
  assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), VISIT, why(r));
  assert.equal(r.said.text, "✅ Updated /gallery.", why(r));
});

test("control: a single site-wide change reads the whole sentence and touches no page", async () => {
  const message = "Change the site's description to \"" + NEW_DESC + "\"";
  const r = await throughTheChain({
    message,
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC },
  });
  assert.deepEqual(r.seen.lanes, [{ field: "description", asked: message }], why(r));
  assert.deepEqual(r.seen.writers, [], why(r));
  assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
  for (const [path, src] of [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]]) {
    assert.equal(storedPage(r.store, r.slug, path), src, why(r));
  }
  assert.equal(r.said.text.startsWith("✅ Updated the look — the description."), true, why(r));
});

test("a scope naming a page the site does not have withholds that change alone, names the site's pages, and the description beside it ships", async () => {
  // CHANGED 2026-09-29 (owner: *"Reject or withhold the affected operation
  // with an accurate outcome. Preserve independently valid work where the
  // existing partial-success contract allows it."*). This refused the whole
  // message before anything ran, taking the valid description change down
  // with the one aimed at a page the site does not have.
  const r = await throughTheChain({
    message: RUN52,
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["description", "shape"], scopes: [
      { part: "description", words: DESC_WORDS },
      { part: "shape", page: "/menu", words: VISIT_WORDS },
    ] }, "lane:description": NEW_DESC },
  });
  const said = failureMsg("page/no-page", { page: "/menu", verb: "", routes: ROUTES });
  assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], "a writer ran against a page the site does not have" + why(r));
  assert.deepEqual(r.seen.writers, [], why(r));
  assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_WORDS }], why(r));
  assert.equal(r.body.ok, true, why(r));
  // THE WITHHELD CHANGE KEEPS ITS TARGET SINCE 2026-10-03 (the mixed-work
  // fixes): the page it named and its own words, which passed every check.
  assert.deepEqual(r.body.partial, [{ layer: "page", lanes: ["shape"], error: "no-page", page: "/menu", words: [VISIT_WORDS], msg: said, unchanged: true }], why(r));
  assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
  for (const [path, src] of [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]]) assert.equal(storedPage(r.store, r.slug, path), src, why(r));
  // Led by its own words; the page is in the builder's sentence already.
  assert.equal(r.said.text, "✅ Updated the look — the description. ⚠️ “" + VISIT_WORDS + "”: " + said, why(r));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. A SCOPE THAT FAILS ITS CHECK NEVER WIDENS AND NEVER GOES HOME
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner, 2026-09-29, after reproducing both through the route: *"Distinguish
// absent legacy scope from explicitly invalid scope. Once an operation supplies
// scope metadata, failed validation must not widen its instruction to the
// whole request or redirect it to the homepage. Reject or withhold the affected
// operation with an accurate outcome. Preserve independently valid work where
// the existing partial-success contract allows it."*
//
// Before the correction: a page of `["/visit"]` was read as "no page", and the
// home page's writer was handed the Visit move; words the message does not
// hold were read as "no words", and the Visit writer was handed the whole
// request, the description change included.

/**
 * THE WITHHELD SHAPE CHANGE, beside the description that ships: no writer at
 * all, the description lane handed only its own words, the description stored,
 * every page byte for byte, one publish, and a screen that says both.
 */
// `target` SINCE 2026-10-03 (the mixed-work fixes): what the withheld change
// still names — the page, when it was a page the site has — and what the
// screen leads it with. Words that failed their check are never carried.
function assertShapeWithheld(r, msg, label, target = { lead: "A page’s layout: " }) {
  assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], label + ": the calls" + why(r));
  assert.deepEqual(r.seen.writers, [], label + ": a page writer was called" + why(r));
  assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_WORDS }], label + ": the description lane was handed more than its own words" + why(r));
  assert.equal(r.status, 200, label + why(r));
  assert.equal(r.body.ok, true, label + why(r));
  assert.deepEqual(r.body.partial, [{ layer: "page", lanes: ["shape"], error: "scope-unread", ...(target.page ? { page: target.page } : {}), msg, unchanged: true }], label + ": partial" + why(r));
  assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, label + ": the description was not stored" + why(r));
  for (const [path, src] of [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]]) {
    assert.equal(storedPage(r.store, r.slug, path), src, label + ": " + path + " changed" + why(r));
  }
  assert.equal(r.compiles, 1, label + ": not exactly one publish" + why(r));
  assert.equal(r.said.text, "✅ Updated the look — the description. ⚠️ " + target.lead + msg, label + ": the screen" + why(r));
}

for (const mode of ["sync", "job"]) {
  test("a shape scope whose page is not a path (`[\"/visit\"]`) is withheld: the home page's writer is never called, and the description still ships (" + mode + ")", async () => {
    const r = await throughTheChain({
      mode, message: RUN52,
      routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: { fields: ["description", "shape"], scopes: [
        { part: "description", words: DESC_WORDS },
        { part: "shape", page: ["/visit"], words: VISIT_WORDS },
      ] }, "lane:description": NEW_DESC },
    });
    assertShapeWithheld(r, failureMsg("picker/scope-unread", { why: "page" }), "page [\"/visit\"] " + mode);
  });

  test("a shape scope on /visit whose words are not in the request is withheld: the Visit writer is never handed the request, and the description still ships (" + mode + ")", async () => {
    const r = await throughTheChain({
      mode, message: RUN52,
      routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: { fields: ["description", "shape"], scopes: [
        { part: "description", words: DESC_WORDS },
        { part: "shape", page: "/visit", words: "Move that section up" },
      ] }, "lane:description": NEW_DESC },
    });
    assert.ok(!RUN52.toLowerCase().includes("move that section up"), "the fixture's words must not be in the request");
    // The page passed its check, so the withheld change names it — and the
    // builder's sentence names it already, so the screen does not again.
    assertShapeWithheld(r, failureMsg("picker/scope-unread", { why: "words", page: "/visit" }), "words not in the request " + mode, { page: "/visit", lead: "A page’s layout: " });
  });
}

test("a scoped answer that leaves a picked lane without a scope withholds that lane rather than running it on the whole request", async () => {
  const r = await throughTheChain({
    message: RUN52,
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_WORDS }] }, "lane:description": NEW_DESC },
  });
  assertShapeWithheld(r, failureMsg("picker/scope-unread", { why: "unscoped" }), "unscoped shape");
});

test("a description scope whose words are not in the request is withheld: its lane is never handed the whole request, and the Visit move still runs", async () => {
  const r = await throughTheChain({
    message: RUN52,
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["description", "shape"], scopes: [
      { part: "description", words: "update the meta description" },
      { part: "shape", page: "/visit", words: VISIT_WORDS },
    ] } },
  });
  const msg = failureMsg("picker/scope-unread", { why: "words" });
  assert.deepEqual(r.seen.calls, [T.route, T.pick, T.tweak], "the calls" + why(r));
  assert.deepEqual(r.seen.lanes, [], "the description lane was called" + why(r));
  assert.deepEqual(r.seen.writers.map((w) => [w.path, w.instruction]), [["visit.tsx", VISIT_WORDS]], "the Visit writer" + why(r));
  assert.equal(r.body.ok, true, why(r));
  assert.deepEqual(r.body.partial, [{ layer: "look", lanes: ["description"], error: "scope-unread", msg, unchanged: true }], why(r));
  assert.equal(storedLook(r.store, r.slug).description, OLD_DESC, "the description changed" + why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), "the Visit move did not ship" + why(r));
  assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, why(r));
  assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), GALLERY, why(r));
  // LED BY WHAT IT WAS ABOUT SINCE 2026-10-03 (the mixed-work fixes).
  assert.equal(r.said.text, "✅ Updated /visit. ⚠️ The description: " + msg, "the screen" + why(r));
});

test("an own lane a scoped answer left without a scope is withheld too: the description lane is never handed the whole request", async () => {
  const r = await throughTheChain({
    message: RUN52,
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["description", "shape"], scopes: [{ part: "shape", page: "/visit", words: VISIT_WORDS }] } },
  });
  const msg = failureMsg("picker/scope-unread", { why: "unscoped" });
  assert.deepEqual(r.seen.calls, [T.route, T.pick, T.tweak], "the calls" + why(r));
  assert.deepEqual(r.seen.lanes, [], "the description lane was called" + why(r));
  assert.deepEqual(r.seen.writers.map((w) => [w.path, w.instruction]), [["visit.tsx", VISIT_WORDS]], why(r));
  assert.deepEqual(r.body.partial, [{ layer: "look", lanes: ["description"], error: "scope-unread", msg, unchanged: true }], why(r));
  assert.equal(storedLook(r.store, r.slug).description, OLD_DESC, why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), why(r));
  // LED BY WHAT IT WAS ABOUT SINCE 2026-10-03 (the mixed-work fixes).
  assert.equal(r.said.text, "✅ Updated /visit. ⚠️ The description: " + msg, why(r));
});

test("a message whose only change is withheld changes nothing, costs nothing for the edit, and says why", async () => {
  const r = await throughTheChain({
    message: VISIT_WORDS + ".",
    routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: ["/visit"], words: VISIT_WORDS }] } },
  });
  const msg = failureMsg("picker/scope-unread", { why: "page" });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], "something ran" + why(r));
  assert.equal(r.body.ok, false, why(r));
  assert.equal(r.body.error, "scope-unread", why(r));
  assert.equal(r.body.cost, 0, why(r));
  assert.equal(r.body.msg, msg, why(r));
  assert.equal(r.body.escalate, undefined, "it climbed, which the browser reads as a rewrite" + why(r));
  for (const [path, src] of [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]]) assert.equal(storedPage(r.store, r.slug, path), src, why(r));
  assert.equal(storedLook(r.store, r.slug).description, OLD_DESC, why(r));
  assert.equal(r.compiles, 0, why(r));
  assert.ok(r.said.text.startsWith("⚠️ " + msg), "the screen" + why(r));
  assert.match(r.said.text, /Nothing on your site changed/, why(r));
  assert.deepEqual(r.said.actions, [], "the browser followed up on a refusal" + why(r));
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PIECES, ONE AT A TIME
// ─────────────────────────────────────────────────────────────────────────────

test("wordsIn: the customer's own text for a copy, forgiving only what copying changes", () => {
  const msg = 'Change the description.  Then, on the Visit page ONLY, put the “Order a collection” band above\n"Come to the bakery".';
  // CASE, SPACES, LINE BREAKS AND CURLY QUOTES are forgiven; the answer is the
  // message's own spelling of that stretch, to the character.
  assert.equal(wordsIn(msg, 'on the visit page only, put the "Order a collection" band above "Come to the bakery"'),
    'on the Visit page ONLY, put the “Order a collection” band above\n"Come to the bakery"');
  // A FULL STOP THE COPY ENDED WITH is not needed to find it, and is kept only
  // when the message has it right there.
  assert.equal(wordsIn(msg, "Change the description."), "Change the description.");
  assert.equal(wordsIn("Change the description, then stop", "change the description."), "Change the description");
  // ANYTHING ELSE IS NOT FOUND: a paraphrase, a copy cut inside a word, a word
  // found inside a longer one.
  assert.equal(wordsIn(msg, "move the collection band up on Visit"), "");
  assert.equal(wordsIn(msg, "hange the descr"), "");
  assert.equal(wordsIn("Take the menus off", "menu"), "");
  // A COPY THAT OPENS WITH A QUOTE may sit right against a word.
  assert.equal(wordsIn('put it above"Come to the bakery"', '"Come to the bakery"'), '"Come to the bakery"');
  // NOTHING IS COERCED: `String(["Change"])` is "Change".
  assert.equal(wordsIn(msg, ["Change"]), "");
  assert.equal(wordsIn(["Change"], "Change"), "");
  assert.equal(wordsIn(msg, ""), "");
  assert.equal(wordsIn(msg, " . "), "");
});

test("heldBack: the held part taken out wherever it stands, or refused — never guessed", () => {
  // RUN 52 AS THE ROUTER REALLY ANSWERED IT: the Visit move comes out, and what
  // runs is the description's words and the joint between them.
  const r = heldBack(RUN52, VISIT_WORDS);
  assert.equal(r.ok, true);
  assert.equal(r.held, VISIT_WORDS);
  assert.equal(r.run, DESC_WORDS + " Then, .");
  assert.ok(!r.run.includes("Order a collection"), "the held part is still in what runs");
  // NOTHING HELD BACK: the message itself, untouched — whitespace and all.
  assert.deepEqual(heldBack("  Make it blue.  ", undefined), { ok: true, run: "  Make it blue.  ", held: "" });
  assert.deepEqual(heldBack("Make it blue.", ""), { ok: true, run: "Make it blue.", held: "" });
  assert.deepEqual(heldBack("Make it blue.", "   "), { ok: true, run: "Make it blue.", held: "" });
  // A NON-STRING IS NOTHING HELD BACK, not a string: the browser and the
  // routing reply only ever carry a string, so this is a crafted body asking
  // for the whole message — which is what it gets.
  assert.deepEqual(heldBack("Make it blue.", ["blue"]), { ok: true, run: "Make it blue.", held: "" });
  // SAID TWICE, TAKEN OUT TWICE: a clause cannot survive once and run.
  const twice = heldBack("Add a booking form. Make it blue. Add a booking form.", "add a booking form");
  assert.equal(twice.ok, true);
  assert.equal(twice.run, ". Make it blue. .");
  assert.equal(twice.held, "Add a booking form");
  // NOT FOUND, OR THE WHOLE MESSAGE: refused, and the message comes back whole
  // so no caller can mistake it for a run.
  assert.deepEqual(heldBack(RUN52, "move the Visit band up"), { ok: false, run: RUN52, held: "" });
  assert.deepEqual(heldBack("Add a booking form.", "add a booking form"), { ok: false, run: "Add a booking form.", held: "" });
});

test("readScopes: a valid scope names a picked part, a page in one spelling and words in the message; an invalid one is marked, never blanked", () => {
  const reply = (scopes) => ({ content: [{ type: "tool_use", name: T.pick, input: { fields: ["description", "shape"], ...(scopes === undefined ? {} : { scopes }) } }] });
  const got = readScopes(reply([
    { part: "description", words: DESC_WORDS.toUpperCase() },
    { part: "shape", page: "visit", words: VISIT_WORDS },
    { part: "shape", page: "/gallery/", words: "words nobody said" },   // words not in the message
    { part: "colors", page: "/", words: DESC_WORDS },                   // a part this answer did not pick
    { part: ["shape"], words: VISIT_WORDS },                            // a non-string part
    { part: "shape", page: ["/visit"], words: VISIT_WORDS },             // a non-string page
    { part: "shape", page: "#", words: VISIT_WORDS },                   // a string that names no path
    { part: "shape", page: "/", words: 7 },                             // non-string words
    { part: "shape", page: "   ", words: VISIT_WORDS },                 // a blank page is no page
    null, "shape", [],
  ]), ["description", "shape"], RUN52);
  // RE-ANCHORED 2026-09-29. This blessed the fallback the owner reproduced:
  // `["/visit"]` came back as page "" (so the route sent it to the home page)
  // and words nobody said came back as "" (so the route handed the writer the
  // whole request). Now each is its own op, marked with what failed.
  assert.equal(got.scoped, true);
  assert.deepEqual(got.ops, [
    { part: "description", page: "", words: DESC_WORDS },
    { part: "shape", page: "/visit", words: VISIT_WORDS },
    { part: "shape", page: "/gallery", words: "", invalid: "words" },
    { part: "shape", page: "", words: "", invalid: "page" },
    { part: "shape", page: "", words: "", invalid: "page" },
    { part: "shape", page: "/", words: "", invalid: "words" },
    { part: "shape", page: "", words: VISIT_WORDS },
  ]);
  // LEGACY IS NO SCOPE METADATA AT ALL: absent, null or an empty list.
  for (const legacy of [undefined, null, []]) assert.deepEqual(readScopes(reply(legacy), ["shape"], RUN52), { scoped: false, ops: [] }, JSON.stringify(legacy));
  assert.deepEqual(readScopes(null, ["shape"], RUN52), { scoped: false, ops: [] });
  // METADATA THAT CANNOT BE READ IS STILL METADATA: scoped, with nothing valid.
  for (const bad of ["shape on /visit", { part: "shape" }, 7]) assert.deepEqual(readScopes(reply(bad), ["shape"], RUN52), { scoped: true, ops: [] }, JSON.stringify(bad));
  // A SCOPED ANSWER NAMING NO PICKED LANE places nothing — the route then
  // withholds every lane it left without a scope.
  assert.deepEqual(readScopes(reply([{ part: "shape", words: VISIT_WORDS }]), [], RUN52), { scoped: true, ops: [] });
  // NOTHING IS DROPPED IN SILENCE: every entry naming a picked lane is an op.
  // (Past the old four-lane cap, which went on 2026-10-03.)
  const many = Array.from({ length: 7 }, () => ({ part: "shape", words: VISIT_WORDS }));
  assert.equal(readScopes(reply(many), ["shape"], RUN52).ops.length, 7);
});

test("pickLanes reads the scopes off the answer it was given, against the message it sent", async () => {
  const answer = { fields: ["description", "shape"], scopes: [
    { part: "description", words: DESC_WORDS }, { part: "shape", page: "/visit", words: VISIT_WORDS },
  ] };
  const sent = [];
  const deps = { send: async (req) => { sent.push(req); return { content: [{ type: "tool_use", name: T.pick, input: answer }], usage: { input_tokens: 1, output_tokens: 1 } }; } };
  const r = await pickLanes(deps, { message: RUN52, fields: LANE_FIELDS });
  assert.deepEqual(r.fields, ["description", "shape"]);
  assert.deepEqual(r.scopes, [
    { part: "description", page: "", words: DESC_WORDS },
    { part: "shape", page: "/visit", words: VISIT_WORDS },
  ]);
  assert.equal(r.scoped, true);
  assert.equal(sent.length, 1);
  // A FAILED OR EMPTY CALL CARRIES NO SCOPES, never undefined, and is not scoped.
  const empty = await pickLanes(deps, { message: "   " });
  assert.deepEqual([empty.scopes, empty.scoped], [[], false]);
  const down = await pickLanes({ send: async () => { throw new Error("down"); } }, { message: RUN52 });
  assert.deepEqual([down.scopes, down.scoped], [[], false]);
  // AN ANSWER WITH NO SCOPES IS THE LEGACY SHAPE.
  const legacy = await pickLanes({ send: async () => ({ content: [{ type: "tool_use", name: T.pick, input: { fields: ["shape"] } }], usage: { input_tokens: 1, output_tokens: 1 } }) }, { message: RUN52, fields: LANE_FIELDS });
  assert.deepEqual([legacy.fields, legacy.scopes, legacy.scoped], [["shape"], [], false]);
});

test("the picker's tools ask for each change's scope — required on the ordinary tool, offered on the door", () => {
  const plain = pickTool().input_schema;
  assert.ok(Object.hasOwn(plain.properties, "scopes"), "the ordinary tool has no scopes");
  assert.deepEqual(plain.required, ["fields", "scopes"]);
  const item = plain.properties.scopes.items;
  assert.deepEqual(item.required, ["part", "words"]);
  // RE-ANCHORED 2026-10-02 (the owner's second review): a scope may also name
  // the numbered answers its change needs (`answers`) — optional, so a picker
  // shown no answers answers exactly as before, and never a source of `words`.
  assert.deepEqual(Object.keys(item.properties).sort(), ["answers", "page", "part", "words"]);
  assert.deepEqual(item.properties.answers.items, { type: "integer" });
  assert.match(item.properties.answers.description, /WHAT THEY ALREADY TOLD YOU/);
  assert.match(item.properties.answers.description, /`words` still comes from the request/);
  // NO COUNT SINCE 2026-10-03 (the mixed-work fixes, MW2): the tool asked for
  // at most four changes, so a model answering more was answering outside it.
  assert.equal(plain.properties.scopes.maxItems, undefined, "the scopes list is capped again");
  assert.match(plain.properties.scopes.description, /ONE ENTRY PER SEPARATE CHANGE/);
  assert.match(item.properties.words.description, /copied EXACTLY from the message/);
  const door = pickTool(LANE_FIELDS, { routed: true }).input_schema;
  assert.ok(Object.hasOwn(door.properties, "scopes"), "the door's tool has no scopes");
  assert.deepEqual(door.required, ["additional"], "the door's answer may still name nothing");
  assert.match(door.properties.scopes.description, /already-routed change is being made already; it never goes here/);
});

test("ONE PAGE OPERATION IS SHOWN WHAT EITHER JOINED CHANGE NEEDS (2026-10-02, the owner's second review): the answers each was given are joined, each once and in order; one to be shown every answer keeps every answer; neither given any keeps none", () => {
  const a = { layer: "page", page: "/visit", fields: ["shape"], ask: "move the band up", told: [2, 0] };
  const b = { layer: "page", page: "/visit", fields: ["components"], ask: "swap the photo for a map", told: [1, 0] };
  assert.deepEqual(mergePageSteps([a, b])[0].told, [0, 1, 2], "the joined writer was not shown what both changes needed");
  assert.equal(mergePageSteps([a, { ...b, told: null }])[0].told, null, "a change to be shown every answer was narrowed by joining");
  const { told: _a, ...plainA } = a;
  const { told: _b, ...plainB } = b;
  assert.equal(mergePageSteps([plainA, b])[0].told, null, "a change the picker gave no reading for was narrowed by joining");
  assert.equal(Object.hasOwn(mergePageSteps([plainA, plainB])[0], "told"), false, "steps given no answers gained some");
  // ANOTHER PAGE IS ANOTHER OPERATION, each with its own.
  assert.deepEqual(mergePageSteps([a, { ...b, page: "/" }]).map((x) => x.told), [[2, 0], [1, 0]]);
});

test("one page operation per page: scoped words on one page join, and different words are different operations", () => {
  const a = { layer: "page", page: "/visit", fields: ["shape"], ask: "move the band up" };
  const b = { layer: "page", page: "/visit", fields: ["components"], ask: "swap the photo for a map" };
  const c = { layer: "page", page: "/gallery", fields: ["shape"], ask: "move the market times up" };
  // SIDE BY SIDE ON ONE PAGE: one writer, handed both sets of words.
  assert.deepEqual(mergePageSteps([a, b]), [{ layer: "page", page: "/visit", fields: ["shape", "components"], ask: "move the band up\nswap the photo for a map" }]);
  // THE SAME WORDS TWICE are one set.
  assert.deepEqual(mergePageSteps([a, { ...a, fields: ["components"] }]), [{ ...a, fields: ["shape", "components"] }]);
  // RE-ANCHORED 2026-09-29: ONE WITHOUT WORDS OF ITS OWN IS NOT JOINED. This
  // joined them on the whole message, which handed the scoped change every
  // other change's words — the widening a scope exists to prevent.
  const u = { layer: "page", page: "/visit", fields: ["components"] };
  assert.deepEqual(mergePageSteps([a, u]), [a, u]);
  // A WITHHELD STEP RUNS NOTHING: never joined, never the same operation.
  const w = { layer: "page", page: "/visit", fields: ["components"], ask: "move the band up", withheld: { why: "words" } };
  assert.deepEqual(mergePageSteps([a, w]), [a, w]);
  assert.equal(samePageOperation(a, w), false);
  // AND NEITHER: exactly as before this existed — no `ask` key at all.
  assert.deepEqual(mergePageSteps([{ layer: "page", page: "/", fields: ["shape"] }, { layer: "page", page: "/", fields: ["components"] }]),
    [{ layer: "page", page: "/", fields: ["shape", "components"] }]);
  // ANOTHER PAGE IS ANOTHER STEP.
  assert.deepEqual(mergePageSteps([a, c]), [a, c]);
  // THE SAME OPERATION means the same page AND the same words.
  assert.equal(samePageOperation(a, { ...a, fields: ["components"] }), true);
  assert.equal(samePageOperation(a, b), false);
  assert.equal(samePageOperation(a, c), false);
  // NEITHER WITH WORDS OF ITS OWN: both run on the whole message, as always.
  assert.equal(samePageOperation({ layer: "page", page: "/", fields: ["components"] }, { layer: "page", page: "/", fields: ["shape"] }), true);
});

test("a withheld change is ours to explain, at no cost, and its sentence claims nothing about the rest of the message", () => {
  const f = EDIT_FAILURES.find((x) => x.key === "picker/scope-unread");
  assert.ok(f, "the failure is not in the table");
  assert.deepEqual([f.cls, f.ours, f.reason], ["explain", true, "scope-unread"]);
  assert.equal(failureMsg("picker/scope-unread", { why: "page" }),
    "I couldn't tell which page one of your changes was for, so I didn't make that change — this is on us. Send it again on its own, with the page it's on.");
  assert.equal(failureMsg("picker/scope-unread", { why: "words", page: "/visit" }),
    "I couldn't tell which part of your message one of your changes on /visit was, so I didn't make that change — this is on us. Send it again on its own.");
  assert.equal(failureMsg("picker/scope-unread", { why: "unscoped" }),
    "I couldn't tell which part of your message one of your changes was, so I didn't make that change — this is on us. Send it again on its own.");
  // READ BESIDE A CHANGE THAT SHIPPED, NONE OF THEM MAY SAY NOTHING CHANGED.
  for (const why of ["page", "words", "unscoped"]) assert.doesNotMatch(failureMsg("picker/scope-unread", { why }), /nothing|haven't changed/i);
});

test("a held-back part that cannot be found is ours to explain, at no cost, on both routes", () => {
  const f = EDIT_FAILURES.find((x) => x.key === "route/held-unread");
  assert.ok(f, "the failure is not in the table");
  assert.equal(f.cls, "explain");
  assert.equal(f.ours, true);
  assert.equal(f.reason, "held-unread");
  assert.equal(failureMsg("route/held-unread"),
    "I couldn't separate the part of your message I was leaving for later from the part to do now, so I haven't changed anything — this is on us. Send the changes one at a time and I'll make each.");
  const a = addonFailure("held-unread");
  assert.equal(a.ok, false);
  assert.equal(a.error, "held-unread");
  assert.match(a.msg, /so I haven't added anything — this is on us/);
});

// ─────────────────────────────────────────────────────────────────────────────
// BATCH 2. AN ADDITION BESIDE LOOK WORK IS PUT OFF, NEVER SWAPPED FOR IT (W15)
// ─────────────────────────────────────────────────────────────────────────────
//
// (2026-10-02, the whole-router audit's W15.) The look step handed the WHOLE
// message to the add-on step the moment its picker named something the site
// does not have — a QR code, a 3D scene, a page — before any other lane ran,
// so the look change beside it never happened and the add-on step had no lane
// for it. REPRODUCED FIRST on d4e5992a through this chain: the message below
// answered `escalate("addon")` with the description unchanged.
//
// Beside other work the addition is now put off exactly as the router puts a
// part off: its own words, from the picker's scope for it, join the parts every
// ending reports (`deferred`) and every later step takes out; the rest runs.
// Alone it is the whole ask and is handed on, with its page. With no scopes
// there are no words to put off, so nothing runs and the customer is asked to
// send it alone. The PICKER decided it is an addition and which words ask for
// it; the route only checks the site has none and the words are the message's.
const QR_WORDS = "add a QR code for our menu on the Visit page";
const DESC_SAY = "Change the site's search description to \"" + NEW_DESC + "\"";
const QR_MIXED = DESC_SAY + ", and " + QR_WORDS + ".";
const QR_PICK = { fields: ["description", "qr"], scopes: [{ part: "description", words: DESC_SAY }, { part: "qr", page: "/visit", words: QR_WORDS }] };
const PAGES_AS_STORED = [["index.tsx", HOME], ["visit.tsx", VISIT], ["gallery.tsx", GALLERY]];

/** Every stored page byte for byte, and every published page too when the change published. */
function assertPagesKept(r, label) {
  for (const [path, src] of PAGES_AS_STORED) {
    assert.equal(storedPage(r.store, r.slug, path), src, label + ": " + path + " moved" + why(r));
    if (r.compiles) assert.equal(r.sentPage(path), src, label + ": " + path + " was published changed" + why(r));
  }
}

for (const mode of ["sync", "job"]) {
  test("W15 — a QR code the site does not have, beside a description change: the description ships, the code is put off and named (" + mode + ")", async () => {
    const r = await throughTheChain({ mode, message: QR_MIXED, routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: QR_PICK, "lane:description": NEW_DESC } });
    // THE ROUTER PUT NOTHING OFF; the look step did, as its net.
    assert.equal(r.post.body.alsoAsked, undefined, why(r));
    // ONLY THE DESCRIPTION'S LANE RAN, on its own words: no QR lane, no add-on
    // picker, no page writer.
    assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], why(r));
    assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_SAY }], why(r));
    assert.deepEqual(r.seen.writers, [], why(r));
    // STORED: the description, and nothing else — no code in the look, every page as it was.
    assert.equal(r.status, 200, why(r));
    assert.equal(r.body.ok, true, why(r));
    assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, "the look change beside the addition was lost" + why(r));
    // ABSENT IS `== null`: the look's own merge writes an empty field as null.
    assert.ok(storedLook(r.store, r.slug).qr == null, "a code was made on the edit path" + why(r));
    assertPagesKept(r, "W15 mixed (" + mode + ")");
    // THE CODE IS NAMED AS PUT OFF, in the customer's words, and nothing more is started.
    assert.equal(r.body.deferred, QR_WORDS, "the reply does not name the addition it put off" + why(r));
    assert.equal(r.body.partial, undefined, "the put-off addition was reported as a refusal" + why(r));
    assert.ok(r.said.text.endsWith(tail(QR_WORDS)), "the screen does not say what waits" + why(r));
    assert.deepEqual(r.said.actions.filter((a) => /PAID|rewrite/.test(a)), [], "the browser started paid work" + why(r));
  });
}

test("W15 — a QR code alone is the whole ask: handed to the add-on step with its page and its reason, nothing run here", async () => {
  const ask = "Add a QR code for our menu on the Visit page.";
  const r = await throughTheChain({ message: ask, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["qr"], scopes: [{ part: "qr", page: "/visit", words: "Add a QR code for our menu on the Visit page" }] } } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], why(r));
  assert.deepEqual(r.body, { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon", page: "/visit" },
    "the hand-over does not carry its reason, the part of the site and the page" + why(r));
  assertPagesKept(r, "W15 alone");
  assert.equal(r.compiles, 0, why(r));
  assert.deepEqual(r.said.actions, ["post a PAID request to the addon route"], why(r));
});

test("W15 — a QR code beside other work, on an answer with no words for each change: nothing runs, nothing is charged, and it asks for the code alone", async () => {
  const r = await throughTheChain({ message: QR_MIXED, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["description", "qr"] }, "lane:description": NEW_DESC } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], "a lane ran on a message whose addition could not be separated" + why(r));
  assert.equal(r.status, 422, why(r));
  assert.equal(r.body.ok, false, why(r));
  assert.equal(r.body.error, "addition-mixed", why(r));
  assert.equal(r.body.cost, 0, why(r));
  assert.equal(r.body.msg, failureMsg("picker/addition-mixed", { what: "a QR code" }), why(r));
  assert.equal(storedLook(r.store, r.slug).description, OLD_DESC, why(r));
  assertPagesKept(r, "W15 unscoped");
  assert.equal(r.compiles, 0, why(r));
  assert.deepEqual(r.said.actions, [], "the browser followed up on a refusal" + why(r));
  assert.match(r.said.text, /^⚠️ Adding a QR code is a step of its own/, why(r));
});

test("W15 — the router's part and the look step's both put off: the reply names both, and the screen asks for each in turn", async () => {
  const LATER = "add a booking form";
  const message = DESC_SAY + ", " + QR_WORDS + ", and " + LATER + ".";
  const r = await throughTheChain({ message, routed: { intent: "edit", layer: "look", alsoAsked: LATER },
    answers: { [T.pick]: QR_PICK, "lane:description": NEW_DESC } });
  assert.equal(r.post.body.alsoAsked, LATER, why(r));
  assert.ok(!r.seen.picks[0].includes("booking"), "the router's part reached the picker" + why(r));
  assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], why(r));
  assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
  assertPagesKept(r, "W15 two parts");
  assert.deepEqual(r.body.deferred, [LATER, QR_WORDS], "the reply does not name both parts put off" + why(r));
  assert.ok(r.said.text.endsWith("\nI only did part of it this time. Say “" + LATER + "”, then “" + QR_WORDS + "”, and I’ll do those next."),
    "the screen does not ask for each part in turn" + why(r));
});

test("W15 — a page the site does not have, beside a move on another page: the move ships, the page is put off and named", async () => {
  const CAKES = "add a page for our cake orders";
  const message = VISIT_MOVE + ", and " + CAKES + ".";
  const r = await throughTheChain({ message, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["shape", "pages"], pageVerb: "add", pageName: "/cakes",
      scopes: [{ part: "shape", page: "/visit", words: VISIT_MOVE }, { part: "pages", words: CAKES }] } } });
  assert.deepEqual(r.seen.writers.map((w) => [w.path, w.instruction]), [["visit.tsx", VISIT_MOVE]], why(r));
  assert.equal(r.body.ok, true, why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), "the move beside the addition was lost" + why(r));
  assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, why(r));
  assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), GALLERY, why(r));
  assert.deepEqual(JSON.parse(r.store.store.get(SOURCE_KEY(r.slug))).map((p) => p.path).sort(), ["gallery.tsx", "index.tsx", "visit.tsx"], "a page was added on the edit path" + why(r));
  assert.equal(r.body.deferred, CAKES, why(r));
  assert.ok(r.said.text.endsWith(tail(CAKES)), why(r));
});

// ── THE REVIEW OF BATCH 2: EVERY ADDITION KEPT, AND NONE REACHES A STEP THAT RUNS ──
//
// (2026-10-02, the owner's review of batch 2.) *"replace additionOp's
// first-match handling so multiple scoped additions in the same lane are all
// preserved; and ensure newly deferred instructions are excluded from every
// executing step's model input, including overlapping scope words …"*
//
// REPRODUCED FIRST on 03189a0d through this chain: with two QR codes scoped to
// two pages, only the first was put off — the second was neither named nor
// made — and a lane whose scope words ran on into an addition's was handed the
// addition's words. The picker still decides every part (which words are an
// addition, and which page each is on); the route only takes out what it put
// off, wherever those words stand, before any step that runs is called.
const QR_HOME = "add a QR code for our opening hours on the home page";
const TWO_QR = DESC_SAY + ", " + QR_WORDS + ", and " + QR_HOME + ".";
const TWO_QR_PICK = { fields: ["description", "qr"], scopes: [
  { part: "description", words: DESC_SAY },
  { part: "qr", page: "/visit", words: QR_WORDS },
  { part: "qr", page: "/", words: QR_HOME },
] };
/** No model call after the picker carried any part put off — read off every request each one received. */
function assertNoneReached(r, parts, label) {
  for (const l of r.seen.lanes) for (const p of parts) assert.ok(!String(l.asked).includes(p), label + ": the " + l.field + " lane was handed “" + p + "”" + why(r));
  for (const w of r.seen.writers) for (const p of parts) assert.ok(!String(w.instruction).includes(p), label + ": the writer of " + w.path + " was handed “" + p + "”" + why(r));
  for (const a of r.seen.adds) for (const p of parts) assert.ok(!String(a).includes(p), label + ": the add-on picker was handed “" + p + "”" + why(r));
}

for (const mode of ["sync", "job"]) {
  test("REVIEW — two QR codes on two different pages beside a description change: the description ships, BOTH codes are put off and named, and no step that runs is handed either (" + mode + ")", async () => {
    const r = await throughTheChain({ mode, message: TWO_QR, routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: TWO_QR_PICK, "lane:description": NEW_DESC } });
    assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], why(r));
    // THE MODEL INPUT: the description's lane was handed its own words, and nothing of either code.
    assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_SAY }], why(r));
    assert.deepEqual(r.seen.writers, [], why(r));
    assertNoneReached(r, [QR_WORDS, QR_HOME], "two codes (" + mode + ")");
    assert.equal(r.status, 200, why(r));
    assert.equal(r.body.ok, true, why(r));
    assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
    assert.ok(storedLook(r.store, r.slug).qr == null, "a code was made on the edit path" + why(r));
    assertPagesKept(r, "two codes (" + mode + ")");
    // BOTH CODES ARE NAMED, in the order the customer asked, and the screen asks for each in turn.
    assert.deepEqual(r.body.deferred, [QR_WORDS, QR_HOME], "a scoped addition was dropped — only the first in its lane was kept" + why(r));
    assert.equal(r.body.partial, undefined, why(r));
    assert.ok(r.said.text.endsWith("\nI only did part of it this time. Say “" + QR_WORDS + "”, then “" + QR_HOME + "”, and I’ll do those next."),
      "the screen does not ask for both codes" + why(r));
    assert.deepEqual(r.said.actions.filter((a) => /PAID|rewrite/.test(a)), [], "the browser started paid work" + why(r));
  });

  test("REVIEW — a look lane whose scope words run on into an addition's: the lane is handed its own words only, and the code is put off (" + mode + ")", async () => {
    const message = DESC_SAY + " and " + QR_WORDS + ".";
    // THE PICKER'S WORDS FOR THE DESCRIPTION SWALLOW THE CODE'S — a sloppy but
    // readable answer: both copies are in the message, so both pass `readScopes`.
    const r = await throughTheChain({ mode, message, routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: { fields: ["description", "qr"], scopes: [
        { part: "description", words: DESC_SAY + " and " + QR_WORDS },
        { part: "qr", page: "/visit", words: QR_WORDS },
      ] }, "lane:description": NEW_DESC } });
    assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], why(r));
    assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_SAY + " and" }], "the lane was handed the code's words with its own" + why(r));
    assertNoneReached(r, [QR_WORDS], "overlap, look lane (" + mode + ")");
    assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
    assert.ok(storedLook(r.store, r.slug).qr == null, why(r));
    assertPagesKept(r, "overlap, look lane (" + mode + ")");
    assert.equal(r.body.deferred, QR_WORDS, why(r));
    assert.ok(r.said.text.endsWith(tail(QR_WORDS)), why(r));
  });
}

test("REVIEW — a move whose scope words reach part-way into a page addition's: the writer is handed the move alone, and the page is put off", async () => {
  const CAKES = "add a page for our cake orders";
  const message = VISIT_MOVE + ", and " + CAKES + ".";
  // THE MOVE'S WORDS END INSIDE THE ADDITION'S ("… and add a page"): the two
  // only partly overlap, so the stretch they share is the addition's and is
  // never the writer's.
  const r = await throughTheChain({ message, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["shape", "pages"], pageVerb: "add", pageName: "/cakes",
      scopes: [{ part: "shape", page: "/visit", words: VISIT_MOVE + ", and add a page" }, { part: "pages", words: CAKES }] } } });
  assert.deepEqual(r.seen.writers.map((w) => [w.path, w.instruction]), [["visit.tsx", VISIT_MOVE + ", and"]], "the writer was handed part of the page addition" + why(r));
  assertNoneReached(r, [CAKES, "add a page"], "partial overlap");
  assert.equal(r.body.ok, true, why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), why(r));
  assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, why(r));
  assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), GALLERY, why(r));
  assert.equal(r.body.deferred, CAKES, why(r));
  assert.ok(r.said.text.endsWith(tail(CAKES)), why(r));
});

test("REVIEW — two QR codes on two pages and nothing else: the whole ask goes to the add-on step, which is told the part of the site and no single page", async () => {
  const ask = "Add a QR code for our menu on the Visit page and a QR code for our opening hours on the home page.";
  const r = await throughTheChain({ message: ask, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["qr"], scopes: [
      { part: "qr", page: "/visit", words: "Add a QR code for our menu on the Visit page" },
      { part: "qr", page: "/", words: "a QR code for our opening hours on the home page" },
    ] } } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], why(r));
  // NOT THE FIRST CODE'S PAGE: the add-on step reads the whole message, and a
  // hand-over naming one page would scope it to half of what was asked.
  assert.deepEqual(r.body, { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon" }, why(r));
  assertPagesKept(r, "two codes alone");
  assert.equal(r.compiles, 0, why(r));
});

test("REVIEW — a change whose every word lies inside an addition's is that addition, not other work: the addition is handed on whole", async () => {
  const ask = "Add a QR code for our menu on the Visit page in the brand colours.";
  // THE PICKER ALSO NAMED `css` FOR "in the brand colours" — words that are
  // part of the code's description. Nothing of the colour change is left once
  // the code's words are out, so there is no other work to run beside it.
  const r = await throughTheChain({ message: ask, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["css", "qr"], scopes: [
      { part: "css", words: "in the brand colours" },
      { part: "qr", page: "/visit", words: "Add a QR code for our menu on the Visit page in the brand colours" },
    ] } } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], "a lane ran on words that were the addition's" + why(r));
  assert.deepEqual(r.body, { ok: false, escalate: true, reason: "addon", cost: 0, field: "qr", layer: "addon", page: "/visit" }, why(r));
  assertPagesKept(r, "inside the addition");
});

test("REVIEW — a QR code and a 3D scene on one page and nothing else: handed on whole, the page named, no one part of the site", async () => {
  const QR_PART = "Add a QR code for our menu on the Visit page";
  const SCENE = "a 3D scene of a loaf turning on the Visit page";
  const r = await throughTheChain({ message: QR_PART + " and " + SCENE + ".", routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["qr", "three"], scopes: [
      { part: "qr", page: "/visit", words: QR_PART }, { part: "three", page: "/visit", words: SCENE },
    ] } } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], why(r));
  // TWO KINDS OF ADDITION: naming either would scope the add-on step to half of
  // what was asked; the one page they share is named.
  assert.deepEqual(r.body, { ok: false, escalate: true, reason: "addon", cost: 0, layer: "addon", page: "/visit" }, why(r));
  assertPagesKept(r, "two kinds alone");
  assert.equal(r.compiles, 0, why(r));
});

test("REVIEW — a change whose every word lies inside a page addition's is that addition: the whole ask goes to the add-on step", async () => {
  const CAKES_TOP = "add a page for our cake orders with the opening hours at the top";
  // THE PICKER ALSO SCOPED A MOVE TO "with the opening hours at the top" —
  // words that describe the new page. Nothing of the move is left once the
  // page's words are out, so there is no other work beside the addition.
  const r = await throughTheChain({ message: CAKES_TOP + ".", routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["shape", "pages"], pageVerb: "add", pageName: "/cakes", scopes: [
      { part: "shape", page: "/", words: "with the opening hours at the top" }, { part: "pages", words: CAKES_TOP },
    ] } } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], "a step ran on words that were the page addition's" + why(r));
  assert.deepEqual(r.seen.writers, [], why(r));
  assert.deepEqual(r.body, { ok: false, escalate: true, reason: "addon", cost: 0, field: "pages", verb: "add", layer: "addon" }, why(r));
  assertPagesKept(r, "inside the page addition");
});

test("REVIEW — REFUSED: an addition whose words are the whole message beside a lane with no words of its own — nothing runs, nothing is named as put off", async () => {
  const ask = "Add a QR code for our menu on the Visit page in the brand colours.";
  const whole = ask.slice(0, -1);
  // `css` WAS NAMED WITH NO SCOPE: on a scoped answer it is withheld, and once
  // the code's words are out nothing of the message is left to run.
  const r = await throughTheChain({ message: ask, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["css", "qr"], scopes: [{ part: "qr", page: "/visit", words: whole }] } } });
  assert.deepEqual(r.seen.calls, [T.route, T.pick], "a step ran" + why(r));
  assert.equal(r.status, 422, why(r));
  // A REFUSAL OF THE WHOLE MESSAGE PUTS NOTHING OFF: no `deferred` beside its
  // own sentence, which asks for the code on its own.
  assert.deepEqual(r.body, { ok: false, error: "addition-mixed", cost: 0, unchanged: true,
    msg: "Adding a QR code is a step of its own, and I couldn't tell which of your words asked for it, so I haven't changed anything. Ask for a QR code on its own, then for the rest, and I'll make each." },
  "a refusal named the addition as put off for later, or said something else" + why(r));
  assert.ok(r.said.text.includes("Adding a QR code is a step of its own"), why(r));
  assert.ok(!r.said.text.includes("next"), "the screen promises the addition next" + why(r));
  assertPagesKept(r, "refused");
  assert.equal(r.compiles, 0, why(r));
});

test("REVIEW — two changes on one page joined into one step beside an addition put off: the writer is handed both changes' words, and none of the addition's", async () => {
  const TABLE = "On the Visit page, show our opening hours as a table";
  const message = VISIT_MOVE + ". " + TABLE + ", and " + QR_WORDS + ".";
  const r = await throughTheChain({ message, routed: { intent: "edit", layer: "look" },
    answers: { [T.pick]: { fields: ["shape", "components", "qr"], scopes: [
      { part: "shape", page: "/visit", words: VISIT_MOVE },
      // THE SECOND CHANGE'S WORDS RUN ON INTO THE CODE'S.
      { part: "components", page: "/visit", words: TABLE + ", and " + QR_WORDS },
      { part: "qr", page: "/visit", words: QR_WORDS },
    ] } } });
  // ONE WRITER, ONE PAGE, BOTH SETS OF WORDS — the code's taken out of the
  // second — in the order the steps were dispatched, which is not this case's
  // question.
  assert.deepEqual(r.seen.writers.map((w) => w.path), ["visit.tsx"], why(r));
  assert.deepEqual(r.seen.writers[0].instruction.split("\n").sort(), [TABLE + ", and", VISIT_MOVE].sort(),
    "the joined step lost a change's words, or carried the code's" + why(r));
  assertNoneReached(r, [QR_WORDS], "two changes on one page");
  assert.equal(r.body.ok, true, why(r));
  assert.equal(storedPage(r.store, r.slug, "visit.tsx"), bandsSwapped(VISIT), why(r));
  assert.equal(storedPage(r.store, r.slug, "index.tsx"), HOME, why(r));
  assert.equal(storedPage(r.store, r.slug, "gallery.tsx"), GALLERY, why(r));
  assert.equal(r.body.deferred, QR_WORDS, why(r));
  assert.ok(r.said.text.endsWith(tail(QR_WORDS)), why(r));
});

for (const mode of ["sync", "job"]) {
  test("REVIEW — changes whose every word lies inside an addition, beside a change of their own: they never run, the change ships, the addition is put off (" + mode + ")", async () => {
    const QR_LONG = "add a QR code for our menu in the brand colours at the top of the Visit page";
    const message = DESC_SAY + ", and " + QR_LONG + ".";
    // THE PICKER ALSO SCOPED A COLOUR CHANGE AND A MOVE to words that describe
    // the code. Once the code's words are out neither has a word of its own:
    // the look lane is dropped from its step, and the page step does not run —
    // neither on nothing, nor on what is left of the message.
    const r = await throughTheChain({ mode, message, routed: { intent: "edit", layer: "look" },
      answers: { [T.pick]: { fields: ["description", "css", "shape", "qr"], scopes: [
        { part: "description", words: DESC_SAY },
        { part: "css", words: "in the brand colours" },
        { part: "shape", page: "/visit", words: "at the top of the Visit page" },
        { part: "qr", page: "/visit", words: QR_LONG },
      ] }, "lane:description": NEW_DESC } });
    assert.deepEqual(r.seen.calls, [T.route, T.pick, T.lane], "a step whose words were the addition's ran" + why(r));
    assert.deepEqual(r.seen.lanes, [{ field: "description", asked: DESC_SAY }], why(r));
    assert.deepEqual(r.seen.writers, [], "a page writer ran on words that were the addition's" + why(r));
    assertNoneReached(r, [QR_LONG], "inside, beside work (" + mode + ")");
    assert.equal(r.body.ok, true, why(r));
    assert.equal(storedLook(r.store, r.slug).description, NEW_DESC, why(r));
    assert.ok(storedLook(r.store, r.slug).qr == null, why(r));
    assertPagesKept(r, "inside, beside work (" + mode + ")");
    assert.equal(r.body.deferred, QR_LONG, why(r));
    assert.ok(r.said.text.endsWith(tail(QR_LONG)), why(r));
  });
}

// ── AND THE ADD-ON STEP IS TOLD WHY IT WAS HANDED THE REQUEST (W24) ─────────
//
// The look step's hand-over above names its reason, the part of the site and
// the page; the browser posts them (`EditPoll.handOver`), and the add-on route
// shows its picker one line built from the fixed lists only — never words the
// customer typed or a model wrote — after checking the page against the site.
const HAND_LINE = "Handed on by the look step: the edit step was asked to add something the site does not have yet. The part of the site: qr. The page: /visit.";
const pickPrompt = (r) => (r.prompts.find((p) => p.tool === "pick_adds") || {}).text || "";

test("W24 — the add-on picker is shown why the look step handed it the request, and the page; the route records it", async () => {
  const r = await addon("op-scope-hand-" + hex32().slice(0, 8), "Add a QR code for our menu on the Visit page.", {
    kinds: [], sitePages: ["/", "/visit"],
    handOver: { from: "look", reason: "addon", field: "qr", page: "/visit" },
  });
  const text = pickPrompt(r);
  assert.ok(text, "the add-on picker was not asked");
  assert.ok(text.includes("How this reached the add-on step:"), "the picker was not told how the request reached it: " + text.slice(0, 300));
  assert.ok(text.includes(HAND_LINE), "the picker was not shown the hand-over's reason, part and page: " + text.slice(0, 600));
  const mark = r.traces.find((t) => t.phase === "handover");
  assert.ok(mark, "the add-on route did not record the hand-over");
  assert.deepEqual(mark.detail, { from: "look", reason: "addon", field: "qr", page: "/visit" });
});

test("W24 — a hand-over is checked, never trusted: a page the site lacks is dropped, the router's own missing page is kept, junk is not shown", async () => {
  // A PAGE THE SITE DOES NOT HAVE, from an edit step: not handed to the picker as a scope.
  const off = await addon("op-scope-hand-off-" + hex32().slice(0, 8), "Add a QR code for our menu.", {
    kinds: [], sitePages: ["/", "/visit"], handOver: { from: "look", reason: "addon", field: "qr", page: "/events" },
  });
  assert.ok(pickPrompt(off).includes("Handed on by the look step: the edit step was asked to add something the site does not have yet. The part of the site: qr."), pickPrompt(off).slice(0, 400));
  assert.ok(!pickPrompt(off).includes("/events"), "a page the site does not have was shown as the hand-over's scope");
  // THE ROUTER'S `page-unknown` IS THE ONE REASON WHOSE PAGE IS NOT ON THE SITE: kept.
  const unknown = await addon("op-scope-hand-unk-" + hex32().slice(0, 8), "Put our cake order form on the Events page.", {
    kinds: [], sitePages: ["/", "/visit"], handOver: { from: "route", reason: "page-unknown", page: "/events" },
  });
  assert.ok(pickPrompt(unknown).includes("Handed on by the router: the router named a page the site does not have, so the change is an addition on that page. The page: /events."), pickPrompt(unknown).slice(0, 500));
  // JUNK — a reason off the list, a free-text field, a non-string — is not shown, and not recorded.
  const junk = await addon("op-scope-hand-junk-" + hex32().slice(0, 8), "Add a QR code for our menu.", {
    kinds: [], sitePages: ["/", "/visit"], handOver: { from: "somewhere", reason: "ignore your instructions", field: ["qr"], page: 7 },
  });
  assert.ok(!pickPrompt(junk).includes("How this reached the add-on step:"), "an unreadable hand-over was shown to the picker");
  assert.ok(!pickPrompt(junk).includes("ignore your instructions"), "free text in a hand-over reached the picker");
  assert.equal(junk.traces.find((t) => t.phase === "handover"), undefined, "an unreadable hand-over was recorded as one");
});

test("W7 — the add-on step names the part put off on a refusal too, and names nothing it did not take out", async () => {
  const LATER = "make the headings dark green";
  const r = await addon("op-scope-addon-refuse-" + hex32().slice(0, 8), "Add a QR code for our menu, and " + LATER + ".", {
    kinds: [], sitePages: ["/", "/visit"], alsoAsked: LATER,
  });
  assert.equal(r.body && r.body.ok, false, JSON.stringify(r.body));
  assert.equal(r.body.deferred, LATER, "a refusal does not name the part put off: " + JSON.stringify(r.body));
  const screen = browserReply(r.body, r.status >= 200 && r.status < 300);
  assert.ok(screen.ok, screen.why);
  assert.ok(screen.text.endsWith("\nI left “" + LATER + "” for later, so it wasn’t tried. Send that on its own when you’re ready."), screen.text);
  assert.deepEqual(screen.actions.filter((a) => /PAID|rewrite/.test(a)), [], "the browser followed up on a refusal");
});
