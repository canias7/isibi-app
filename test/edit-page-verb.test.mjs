// A PAGE VERB BELONGS TO ITS OWN STEP (2026-09-23).
//
// Owner, after reproducing it through the route: *"On the home page put the
// opening hours above the welcome, and remove the gallery page." With shape +
// pages/remove, no page writer runs. The gallery is removed, the homepage stays
// unchanged, and the reply warns that the homepage cannot be removed. Scope
// remove and move/rename instructions to their individual operation and
// target, not shared request-wide flags. An ordinary layout step must not
// inherit another step's destructive action.*
//
// THE DEFECT, MEASURED THROUGH THIS ROUTE BEFORE THE FIX (supplied answers, both
// money paths, identical on each):
//
//   `eRemove` and `eRename` were MESSAGE-WIDE, and the `pages` verb step SET
//   them while the steps were being built — so every page step read them,
//   including the layout step the `shape` lane dispatched. The page rung's
//   removal and move branches run before any writer, so:
//
//     home layout + remove /gallery
//       no page writer · /gallery removed · the home page unchanged · the
//       reply: "✅ Took /gallery off the site. … ⚠️ I left / — that is the
//       home page, and removing it would leave the site with no front door."
//     /prices layout + remove /gallery
//       no page writer · /prices DELETED as well as /gallery · no partial ·
//       the reply: "✅ Updated the look." — the accidental deletion the home
//       page's own protection hides in the first case
//     home layout + move /gallery → /photos
//       no page writer · /gallery moved · the reply: "✅ Updated /gallery. ⚠️
//       I couldn't move that page — the home page has no address to move."
//     /prices layout + move /gallery → /photos
//       no page writer · /prices MOVED to /photos · the gallery's own move then
//       refused ("there is already a page at /photos") · the reply: "✅
//       Updated /prices. ⚠️ I couldn't move that page — there is already a page
//       at /photos."
//
//   AND A SECOND SOURCE OF THE SAME FLAG: the router's own `remove`, read off
//   the request body, opens the lane door for `picture` and `nav` — and a
//   layout lane the picker named beside the picture lane read it too. "Take the
//   photo off the prices page and put the price list above the introduction"
//   DELETED /prices.
//
// THE FIX: a verb rides on the step it was given to. The `pages` step carries
// the picker's verb and target, the router's own step carries the router's, and
// `runLayer` reads the step's — so no other step can see it.
//
// WHAT EVERY CASE ASSERTS, per the owner's acceptance: the real
// `POST /api/site/<slug>/edit` driven with every model answer SUPPLIED; the
// page writer's calls and the file it was shown; the compiler payload and the
// store, page by page; the intended removal or move; the unrelated pages
// byte-identical; the money on the synchronous path (`use_credits`) and the job
// path (`edit_reserve`); and the customer's screen composed by the browser's
// own handler (`editBrowserReply`).
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. The page writer is a stub that applies the
// requested layout to the file it is SHOWN, so what is established is the
// route's scoping of each operation — never that a real model makes the layout
// change, or that a real picker names these lanes and this verb.
//
// THE REPLY NAMES WHAT SHIPPED (2026-09-23, the second correction here). Owner:
// *"Layout + removal must identify the edited page and the removed page.
// Layout + move must identify the edited page and the move's old and new
// addresses. A standalone move must report the move, not "Updated" at the old
// address. Use successful operation results, not the request's wording, as
// evidence. Preserve partial-failure warnings and do not describe a refused
// removal or move as completed."*
//
//   BEFORE, measured through this route: every combined case said "✅ Updated
//   the look." and a move on its own said "✅ Updated /gallery." — the address
//   the page had just LEFT. The combined reply could not have said more: its
//   `page` was the layout step's, and the move's starting address was on no
//   field at all.
//
//   NOW the route carries `pageOps`, one entry per page step that SUCCEEDED,
//   read off that step's own reply, and the browser composes from it. So the
//   cases assert the entries as well as the sentence; the partial cases assert
//   that a refused removal or move is on `partial`, warned about in its own
//   words, and absent from both; and one case moves the gallery to "/Photos/",
//   which the renamer publishes as "/photos" — the reply names the published
//   address, which the request never spelled.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM — a hand-typed name is
// a stub that never matches.
import { pickTool, editTool, laneLayer } from "../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { PICTURE_TOOL } from "../builder/site-picture.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible "✅ Done." for an edit body rather than throwing.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = { pick: pickTool().name, tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name, picture: PICTURE_TOOL.name, lane: editTool("css").name };
const USER = { id: "u-verb-1", email: "owner@example.com" };

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: four pages, none linking to another, so a removal nothing refuses
// and a move nothing blocks — which is what lets a WRONG removal or move land
// and be seen, rather than being stopped by the merge's own link check.
// ─────────────────────────────────────────────────────────────────────────────

const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
const WELCOME = "<section className=\"welcome\"><h2>Welcome in</h2><p>Bread from the harbour, every morning.</p></section>";
const HOURS = "<section className=\"hours\"><h2>Opening hours</h2><p>Open from 7am on weekdays.</p></section>";
const INTRO = "<section className=\"intro\"><h2>How we price</h2><p>Every loaf is priced by weight.</p></section>";
const LIST = "<section className=\"list\"><h2>Price list</h2><p>Sourdough three pounds, rye four.</p></section>";
const HOME = page("/", WELCOME + HOURS);
const PRICES = page("/prices", INTRO + LIST);
const GALLERY = page("/gallery", "<section className=\"grid\"><h2>From the ovens</h2><p>Loaves, buns and the odd pie.</p></section>");
const VISIT = page("/visit", "<section className=\"map\"><h2>Find us</h2><p>Quay Street, by the lifeboat station.</p></section>");
const STORED = [
  { path: "index.tsx", source: HOME },
  { path: "prices.tsx", source: PRICES },
  { path: "gallery.tsx", source: GALLERY },
  { path: "visit.tsx", source: VISIT },
];

// THE TWO LAYOUT CHANGES, each computed from the file the writer is SHOWN and
// each touching only its own page's sections — so a writer shown the wrong page
// changes nothing, and the case fails on the page it should have changed.
const block = (src, cls) => {
  const m = src.match(new RegExp("<section className=\"" + cls + "\"[^>]*>.*?</section>"));
  return m ? m[0] : null;
};
const swapBlocks = (src, a, b) => {
  const x = block(src, a), y = block(src, b);
  return x && y ? src.replace(x, "\u0000").replace(y, x).replace("\u0000", y) : src;
};
const homeLayout = (src) => swapBlocks(src, "welcome", "hours");
const pricesLayout = (src) => swapBlocks(src, "intro", "list");
// THE GALLERY AT ITS NEW ADDRESS, spelled by the renamer's own rule: the route
// declaration and every quoted reference move with it.
const MOVED = GALLERY.split("'/gallery'").join("'/photos'");

const HOME_ASK = "On the home page put the opening hours above the welcome, and remove the gallery page.";
const PRICES_ASK = "On the prices page put the price list above the introduction, and remove the gallery page.";
const HOME_MOVE_ASK = "On the home page put the opening hours above the welcome, and move the gallery page to /photos.";
const PRICES_MOVE_ASK = "On the prices page put the price list above the introduction, and move the gallery page to /photos.";
const REMOVE_GALLERY = { pageVerb: "remove", pageName: "/gallery" };
const MOVE_GALLERY = { pageVerb: "move", pageName: "/gallery", pageTo: "/photos" };

/** The file a cheap-writer (`write_tweak`) call was shown: its prompt carries it after "THE FILE (". */
function shownFile(body) {
  const content = String((body && body.messages && body.messages[0] && body.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2) };
}

function bucket(slug, css = "") {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(STORED)],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css })],
  ]);
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

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/**
 * ONE MESSAGE THROUGH THE REAL ROUTE, on either money path.
 *
 * `body` is what the browser posts — the router's answer, forwarded — so a
 * case says which layer, page and verb the ROUTER decided. `pick` is the lane
 * picker's answer when the look door opens. A model tool with no answer is
 * recorded and then refused (503), so a case can only pass on the calls it
 * names.
 */
async function drive({ mode = "sync", body: routed, ask, pick = null, apply = (s) => s, picture = null, lane = null, css = "" }) {
  const slug = "verb-" + mode + "-" + hex32().slice(0, 8);
  const b = bucket(slug, css);
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({
    layer: "look", page: "", remove: false, rename: "", tab: false,
    ...routed,
    instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20),
  });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { calls: [], shown: [], rpc: [], debits: [] };
  let reserved = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost); return json({ ok: true, charged: Number(args.p_cost), cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) { seen.rpc.push({ fn: "credit_back", args }); return new Response(null, { status: 204 }); }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      const usage = { input_tokens: 1000, output_tokens: 500 };
      if (tool === T.pick && pick) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: pick }], usage });
      if (tool === T.tweak) {
        const f = shownFile(args);
        seen.shown.push(f);
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { source: apply(f.source) } }], usage });
      }
      if (tool === T.picture && picture) {
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: picture }], usage: { input_tokens: 400, output_tokens: 100 } });
      }
      // THE LOOK LANES' OWN EDITOR (`css` here), for the one case that changes
      // the look beside a removal.
      if (tool === T.lane && lane) {
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: lane }], usage: { input_tokens: 300, output_tokens: 60 } });
      }
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let reply = null, status = 0, ok = false;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
      assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
      reply = JSON.parse(fin.args.p_result.body);
      status = fin.args.p_result.status;
      ok = status >= 200 && status < 300;
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      status = res.status; ok = res.ok;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    // THE COMPILER'S PAGES, by route file name — every page file the payload
    // carries, so a page the payload LOST is as visible as one it changed. The
    // spine keys its map by the page's own stored path (`filesFor`: `f[p.path]
    // = p.source`), so the key IS the file name; a `src/routes/` prefix is
    // folded in case that ever changes, and a component is not a page.
    const payloads = c.calls.map((k) => {
      const files = (k.body && k.body.files) || {};
      const out = {};
      for (const [p, src] of Object.entries(files)) {
        const name = p.replace(/^src\/routes\//, "");
        if (name.endsWith(".tsx") && !name.includes("-parts/") && name !== "__root.tsx") out[name] = src;
      }
      return out;
    });
    const stored = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    return {
      slug, status, reply, calls: seen.calls, shown: seen.shown, compiles: c.calls.length, payloads,
      stored: Object.fromEntries(stored.map((p) => [p.path, p.source])),
      storedPaths: stored.map((p) => p.path),
      debits: seen.debits,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => ({ seq: r.args.p_seq, cost: Number(r.args.p_cost) })),
      refunds: seen.rpc.filter((r) => r.fn === "edit_refund" || r.fn === "credit_back").length,
      // THE CUSTOMER'S SCREEN, from the browser's own handler — with the routing
      // reply's cost handed in, as `siteEdit` hands it.
      said: editBrowserReply(reply, ok, { cost: 2 }),
    };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const pageWriterCalls = (r) => r.calls.filter((t) => t === T.tweak || t === T.pages);

/**
 * THE SITE AFTER THE MESSAGE, page by page, in the compiler payload AND the
 * store: `expected` maps every file that must exist to its exact source, so a
 * page removed, moved, added or rewritten that should not have been fails
 * here by name.
 */
function assertSite(r, expected, label) {
  assert.equal(r.compiles, 1, label + ": compiles");
  assert.deepEqual(Object.keys(r.payloads[0]).sort(), Object.keys(expected).sort(), label + ": the compiler was handed a different set of pages");
  for (const [file, src] of Object.entries(expected)) {
    assert.equal(r.payloads[0][file], src, label + ": the compiler got the wrong " + file);
  }
  assert.deepEqual([...r.storedPaths].sort(), Object.keys(expected).sort(), label + ": the store holds a different set of pages");
  for (const [file, src] of Object.entries(expected)) {
    assert.equal(r.stored[file], src, label + ": the store holds the wrong " + file);
  }
}

/** The money for one layout operation and a free verb: 3 on either path, and nothing given back. */
function assertOneCharge(r, mode, label) {
  if (mode === "sync") {
    assert.deepEqual(r.debits, [3], label + ": debits");
    assert.deepEqual(r.reserves, [], label + ": the synchronous path reserved");
  } else {
    assert.deepEqual(r.reserves, [{ seq: 1, cost: 3 }], label + ": reserves");
    assert.deepEqual(r.debits, [], label + ": the job path debited directly");
  }
  assert.equal(r.refunds, 0, label + ": something was refunded");
  assert.equal(r.reply.cost, 3, label + ": the reply's cost");
}

/**
 * THE PAGE OPERATIONS THE REPLY SAYS SUCCEEDED, in the order they ran — the
 * facts the sentence is composed from. An operation that refused must not be
 * here, and one that shipped must be here with what it really did.
 */
function assertOps(r, expected, label) {
  assert.deepEqual(r.reply.pageOps, expected, label + ": the reply's page operations");
}
const LAYOUT = (page) => ({ page });
const GONE = { page: "/gallery", removed: ["gallery.tsx"] };
const MOVE = { page: "/gallery", renamedTo: "/photos" };

// ─────────────────────────────────────────────────────────────────────────────
// 1. LAYOUT + REMOVAL — the owner's reproduction, and a non-home layout target
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("the owner's reproduction: a home layout change beside removing the gallery makes the change and removes only the gallery (" + mode + ")", async () => {
    assert.equal(laneLayer("shape"), "page");
    assert.equal(laneLayer("pages"), null, "the pages lane is a verb, not a page lane");
    const r = await drive({
      mode, body: { layer: "look", page: "/" }, ask: HOME_ASK,
      pick: { fields: ["shape", "pages"], ...REMOVE_GALLERY }, apply: homeLayout,
    });
    const label = "home + remove (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    // THE PAGE WRITER RAN, ONCE, ON THE HOME PAGE AS STORED — before the fix it
    // never ran: the layout step took the removal branch.
    assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
    assert.deepEqual(r.shown.map((f) => f && f.path), ["index.tsx"], label + ": the writer was shown the wrong file");
    assert.equal(r.shown[0].source, HOME, label + ": the writer was not shown the stored home page");
    // THE HOME PAGE CHANGED, THE GALLERY IS GONE, AND NOTHING ELSE MOVED.
    assertSite(r, { "index.tsx": homeLayout(HOME), "prices.tsx": PRICES, "visit.tsx": VISIT }, label);
    // TWO PAGE STEPS, BOTH DONE, AND NO REFUSAL — the home page's own
    // protection sentence was the defect's tell, and it is gone.
    assert.deepEqual(r.reply.layers, ["page", "page"], label + ": layers");
    assert.equal(r.reply.partial, undefined, label + ": a step was reported as not done: " + JSON.stringify(r.reply.partial));
    assert.deepEqual(r.reply.removed, ["gallery.tsx"], label + ": the reply's removal");
    assertOps(r, [LAYOUT("/"), GONE], label);
    assertOneCharge(r, mode, label);
    assert.equal(r.said.ok, true, label + ": " + r.said.why);
    // THE EDITED PAGE AND THE REMOVED ONE, BOTH NAMED — this said "✅ Updated
    // the look." until the reply correction.
    assert.equal(r.said.text, "✅ Updated / and took /gallery off the site. Every publish is kept, so say the word if you want it back.", label + ": the customer's sentence");
    assert.ok(!/home page/.test(r.said.text), label + ": the home-page refusal is still on the screen");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
  });

  test("a NON-HOME layout target beside removing the gallery keeps the target page and changes it (" + mode + ")", async () => {
    const r = await drive({
      mode, body: { layer: "look", page: "/prices" }, ask: PRICES_ASK,
      pick: { fields: ["shape", "pages"], ...REMOVE_GALLERY }, apply: pricesLayout,
    });
    const label = "prices + remove (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
    assert.deepEqual(r.shown.map((f) => f && f.path), ["prices.tsx"], label + ": the writer was shown the wrong file");
    assert.equal(r.shown[0].source, PRICES, label + ": the writer was not shown the stored prices page");
    // /prices IS KEPT AND CHANGED. Before the fix it was DELETED beside the
    // gallery, with no refusal and "✅ Updated the look." on the screen — the
    // home page's protection is what hid this in the owner's reproduction.
    assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "visit.tsx": VISIT }, label);
    assert.deepEqual(r.reply.layers, ["page", "page"], label + ": layers");
    assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
    assert.deepEqual(r.reply.removed, ["gallery.tsx"], label + ": the reply's removal");
    assertOps(r, [LAYOUT("/prices"), GONE], label);
    assertOneCharge(r, mode, label);
    assert.equal(r.said.text, "✅ Updated /prices and took /gallery off the site. Every publish is kept, so say the word if you want it back.", label + ": the customer's sentence");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LAYOUT + MOVE — the home page and a non-home layout target
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("a home layout change beside moving the gallery makes the change and moves only the gallery (" + mode + ")", async () => {
    const r = await drive({
      mode, body: { layer: "look", page: "/" }, ask: HOME_MOVE_ASK,
      pick: { fields: ["shape", "pages"], ...MOVE_GALLERY }, apply: homeLayout,
    });
    const label = "home + move (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
    assert.deepEqual(r.shown.map((f) => f && f.path), ["index.tsx"], label + ": the writer was shown the wrong file");
    assert.equal(r.shown[0].source, HOME, label + ": the writer was not shown the stored home page");
    // THE GALLERY IS AT /photos, THE HOME PAGE CHANGED, NOTHING ELSE MOVED.
    // Before the fix the layout step tried to MOVE the home page and was
    // refused, so the layout change was never made.
    assertSite(r, { "index.tsx": homeLayout(HOME), "prices.tsx": PRICES, "photos.tsx": MOVED, "visit.tsx": VISIT }, label);
    assert.deepEqual(r.reply.layers, ["page", "page"], label + ": layers");
    assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
    assert.equal(r.reply.renamedTo, "/photos", label + ": the reply's move");
    assertOps(r, [LAYOUT("/"), MOVE], label);
    assertOneCharge(r, mode, label);
    // THE EDITED PAGE, AND THE MOVE'S OLD AND NEW ADDRESSES.
    assert.equal(r.said.text, "✅ Updated / and moved /gallery to /photos.", label + ": the customer's sentence");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
  });

  test("a NON-HOME layout target beside moving the gallery keeps the target at its address (" + mode + ")", async () => {
    const r = await drive({
      mode, body: { layer: "look", page: "/prices" }, ask: PRICES_MOVE_ASK,
      pick: { fields: ["shape", "pages"], ...MOVE_GALLERY }, apply: pricesLayout,
    });
    const label = "prices + move (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
    assert.deepEqual(r.shown.map((f) => f && f.path), ["prices.tsx"], label + ": the writer was shown the wrong file");
    // /prices STAYS AT /prices AND CHANGES; THE GALLERY MOVES. Before the fix
    // /prices was MOVED to /photos and the gallery's own move was refused.
    assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "photos.tsx": MOVED, "visit.tsx": VISIT }, label);
    assert.deepEqual(r.reply.layers, ["page", "page"], label + ": layers");
    assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
    assert.equal(r.reply.renamedTo, "/photos", label + ": the reply's move");
    assertOps(r, [LAYOUT("/prices"), MOVE], label);
    assertOneCharge(r, mode, label);
    assert.equal(r.said.text, "✅ Updated /prices and moved /gallery to /photos.", label + ": the customer's sentence");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE ROUTER'S OWN FLAG IS THE ROUTER'S STEP'S, TOO
// ─────────────────────────────────────────────────────────────────────────────

test("the router's remove flag opens the picture door and deletes nothing a layout lane beside it was aimed at", async () => {
  const r = await drive({
    body: { layer: "picture", page: "/prices", remove: true },
    ask: "Take the photo off the prices page and put the price list above the introduction.",
    pick: { fields: ["images", "shape"], removes: ["images"] }, apply: pricesLayout,
  });
  const label = "picture door + prices layout";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
  assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
  assert.deepEqual(r.shown.map((f) => f && f.path), ["prices.tsx"], label + ": the writer was shown the wrong file");
  // BEFORE THE FIX /prices WAS DELETED — the router's request-wide `remove`
  // reached the layout step. The site has no photograph, so the picture step
  // says so, and the layout is the only change.
  assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "gallery.tsx": GALLERY, "visit.tsx": VISIT }, label);
  assert.deepEqual(r.reply.layers, ["page"], label + ": layers");
  assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error]), [["picture", "no-slots"]], label + ": partial");
  assert.equal(r.reply.removed, undefined, label + ": a page was reported removed");
  assertOneCharge(r, "sync", label);
  assert.equal(r.said.text, "✅ Updated /prices. ⚠️ I couldn't find a photograph on your site that I can change. If you'd like one added, say which page it should go on and where.", label + ": the customer's sentence");
  assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONTROLS — each verb alone, and the layout alone. Each passes on the code
// before the page-verb fix too, which is what makes it a control: a fix that
// broke a standalone removal or move, or a layout with no verb beside it, fails
// here. The removal's sentence and the layout's are byte-identical to what they
// were before the reply correction; only the move's changed, on purpose.
// The duplicate-execution controls are `edit-page-once.test.mjs`, unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const GALLERY_GONE = { "index.tsx": HOME, "prices.tsx": PRICES, "visit.tsx": VISIT };
const GALLERY_MOVED = { "index.tsx": HOME, "prices.tsx": PRICES, "photos.tsx": MOVED, "visit.tsx": VISIT };
const AS_STORED = Object.fromEntries(STORED.map((p) => [p.path, p.source]));
const REMOVED_SAID = "✅ Took /gallery off the site. Every publish is kept, so say the word if you want it back.";
// A MOVE ON ITS OWN NAMES BOTH ADDRESSES. It said "✅ Updated /gallery." until
// the reply correction — the address the page had just left.
const MOVED_SAID = "✅ Moved /gallery to /photos.";

for (const mode of ["sync", "job"]) {
  test("control: the router's own removal still removes the page it names, free (" + mode + ")", async () => {
    const r = await drive({ mode, body: { layer: "page", page: "/gallery", remove: true }, ask: "Remove the gallery page." });
    const label = "router removal (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assertSite(r, GALLERY_GONE, label);
    assert.deepEqual(r.reply.removed, ["gallery.tsx"], label + ": the reply's removal");
    assert.deepEqual(r.debits, [], label + ": debits");
    assert.deepEqual(r.reserves, [], label + ": reserves");
    assert.equal(r.reply.cost, 0, label + ": cost");
    assert.equal(r.said.text, REMOVED_SAID, label + ": the customer's sentence");
  });

  test("a move on its own reports the move, old address and new, free (" + mode + ")", async () => {
    const r = await drive({ mode, body: { layer: "page", page: "/gallery", rename: "/photos" }, ask: "Move the gallery page to /photos." });
    const label = "router move (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assertSite(r, GALLERY_MOVED, label);
    assert.equal(r.reply.renamedTo, "/photos", label + ": the reply's move");
    assertOps(r, [MOVE], label);
    assert.deepEqual(r.debits, [], label + ": debits");
    assert.deepEqual(r.reserves, [], label + ": reserves");
    assert.equal(r.reply.cost, 0, label + ": cost");
    assert.equal(r.said.text, MOVED_SAID, label + ": the customer's sentence");
    assert.ok(!/Updated/.test(r.said.text), label + ": the move was reported as an update at its old address");
  });
}

test("control: the pages lane alone still removes the page it names", async () => {
  const r = await drive({ ask: "Remove the gallery page.", pick: { fields: ["pages"], ...REMOVE_GALLERY } });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.deepEqual(r.calls, [T.pick], "only the picker was called");
  assertSite(r, GALLERY_GONE, "pages lane removal");
  assert.deepEqual(r.debits, [], "debits");
  assert.equal(r.said.text, REMOVED_SAID, "the customer's sentence");
});

test("the pages lane alone moves the page it names and reports the move", async () => {
  const r = await drive({ ask: "Move the gallery page to /photos.", pick: { fields: ["pages"], ...MOVE_GALLERY } });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.deepEqual(r.calls, [T.pick], "only the picker was called");
  assertSite(r, GALLERY_MOVED, "pages lane move");
  assertOps(r, [MOVE], "pages lane move");
  assert.deepEqual(r.debits, [], "debits");
  assert.equal(r.said.text, MOVED_SAID, "the customer's sentence");
});

test("control: the layout alone on a non-home page is one page operation", async () => {
  const r = await drive({ body: { layer: "look", page: "/prices" }, ask: "On the prices page put the price list above the introduction.", pick: { fields: ["shape"] }, apply: pricesLayout });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.deepEqual(pageWriterCalls(r), [T.tweak]);
  assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "gallery.tsx": GALLERY, "visit.tsx": VISIT }, "layout alone");
  assertOneCharge(r, "sync", "layout alone");
  assert.equal(r.said.text, "✅ Updated /prices.", "the customer's sentence");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE DUPLICATE-EXECUTION FIX AND THE VERB TOGETHER. NOT a control: before
// the page-verb fix the joined layout step inherited the removal, deleted
// /prices and ran no writer — so it failed on the code before that fix, as the
// four layout cases above do.
// ─────────────────────────────────────────────────────────────────────────────

test("two layout lanes beside a removal are ONE page operation, and the removal stays its own step", async () => {
  const r = await drive({
    body: { layer: "look", page: "/prices" },
    ask: "On the prices page put the price list above the introduction and show it as a card, and remove the gallery page.",
    pick: { fields: ["shape", "components", "pages"], ...REMOVE_GALLERY }, apply: pricesLayout,
  });
  const label = "shape + components + remove";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  // THE DUPLICATE-EXECUTION FIX STILL HOLDS: the two layout lanes are one page
  // step, so the writer runs ONCE, and the removal is a step of its own.
  assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
  assert.deepEqual(r.shown.map((f) => f && f.path), ["prices.tsx"], label + ": the writer was shown the wrong file");
  assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "visit.tsx": VISIT }, label);
  assert.deepEqual(r.reply.layers, ["page", "page"], label + ": layers");
  assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
  assert.deepEqual([...r.reply.lanes].sort(), ["components", "pages", "shape"], label + ": lanes");
  // ONE ENTRY FOR THE JOINED LAYOUT STEP, NOT ONE PER LANE.
  assertOps(r, [LAYOUT("/prices"), GONE], label);
  assertOneCharge(r, "sync", label);
  assert.equal(r.said.text, "✅ Updated /prices and took /gallery off the site. Every publish is kept, so say the word if you want it back.", label + ": the customer's sentence");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PARTIAL SUCCESS — the layout ships and the verb is REFUSED. The reply names
// the edit, warns about the refusal in the rung's own words, and never
// describes the refused removal or move as done: it is on `partial`, and on no
// field the sentence is composed from.
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("a refused removal beside a layout change is warned about and never reported as done (" + mode + ")", async () => {
    const r = await drive({
      mode, body: { layer: "look", page: "/prices" },
      ask: "On the prices page put the price list above the introduction, and remove the home page.",
      pick: { fields: ["shape", "pages"], pageVerb: "remove", pageName: "/" }, apply: pricesLayout,
    });
    const label = "prices + refused removal (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
    // THE LAYOUT SHIPPED AND NOTHING WAS REMOVED — the home page is still there.
    assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "gallery.tsx": GALLERY, "visit.tsx": VISIT }, label);
    assert.deepEqual(r.reply.layers, ["page"], label + ": layers");
    assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error]), [["page", "kept"]], label + ": partial");
    assert.equal(r.reply.removed, undefined, label + ": a removal was reported");
    assertOps(r, [LAYOUT("/prices")], label);
    assertOneCharge(r, mode, label);
    assert.equal(r.said.text, "✅ Updated /prices. ⚠️ I left / — that is the home page, and removing it would leave the site with no front door.", label + ": the customer's sentence");
    assert.ok(!/took|off the site/i.test(r.said.text), label + ": the refused removal was described as done");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
  });

  test("a refused move beside a layout change is warned about and never reported as done (" + mode + ")", async () => {
    const r = await drive({
      mode, body: { layer: "look", page: "/prices" },
      ask: "On the prices page put the price list above the introduction, and move the gallery page to /visit.",
      pick: { fields: ["shape", "pages"], pageVerb: "move", pageName: "/gallery", pageTo: "/visit" }, apply: pricesLayout,
    });
    const label = "prices + refused move (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": page-writer calls " + JSON.stringify(r.calls));
    // THE LAYOUT SHIPPED, THE GALLERY IS STILL AT /gallery, /visit UNTOUCHED.
    assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "gallery.tsx": GALLERY, "visit.tsx": VISIT }, label);
    assert.deepEqual(r.reply.layers, ["page"], label + ": layers");
    assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error]), [["page", "rename"]], label + ": partial");
    assert.equal(r.reply.renamedTo, undefined, label + ": a move was reported");
    assertOps(r, [LAYOUT("/prices")], label);
    assertOneCharge(r, mode, label);
    assert.equal(r.said.text, "✅ Updated /prices. ⚠️ I couldn't move that page — there is already a page at /visit.", label + ": the customer's sentence");
    assert.ok(!/moved/i.test(r.said.text), label + ": the refused move was described as done");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. STANDALONE REFUSALS — a removal or a move refused on its own. Controls:
// unchanged by the reply correction, and neither ever reads as done.
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("control: a refused move on its own is said, and nothing moves (" + mode + ")", async () => {
    const r = await drive({ mode, body: { layer: "page", page: "/gallery", rename: "/visit" }, ask: "Move the gallery page to /visit." });
    const label = "router move refused (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, false, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assert.equal(r.compiles, 0, label + ": something compiled");
    assert.deepEqual(r.stored, AS_STORED, label + ": the store changed");
    assert.equal(r.reply.pageOps, undefined, label + ": a refused move was listed as an operation");
    assert.deepEqual(r.debits, [], label + ": debits");
    assert.deepEqual(r.reserves, [], label + ": reserves");
    // (2026-09-25) The refusal now says it wrote nothing, as a refused removal
    // always did, so the screen states that and what the edit and the routing
    // call cost. It had no whole-request note at all.
    assert.equal(r.reply.unchanged, true, label + ": a refused move no longer says it wrote nothing");
    assert.equal(r.said.text, "⚠️ I couldn't move that page — there is already a page at /visit. Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.", label + ": the customer's sentence");
  });

  test("control: a refused removal on its own is said, and nothing is removed (" + mode + ")", async () => {
    const r = await drive({ mode, body: { layer: "page", page: "/", remove: true }, ask: "Remove the home page." });
    const label = "router removal refused (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, false, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assert.equal(r.compiles, 0, label + ": something compiled");
    assert.deepEqual(r.stored, AS_STORED, label + ": the store changed");
    assert.equal(r.reply.pageOps, undefined, label + ": a refused removal was listed as an operation");
    assert.deepEqual(r.debits, [], label + ": debits");
    assert.deepEqual(r.reserves, [], label + ": reserves");
    assert.equal(r.said.text, "⚠️ I left / — that is the home page, and removing it would leave the site with no front door. Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.", label + ": the customer's sentence");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. THE REPORTED ADDRESS IS THE ONE PUBLISHED, NOT THE ONE ASKED FOR
// ─────────────────────────────────────────────────────────────────────────────

test("a move's reported address is the one the renamer published, not the one the request spelled", async () => {
  const r = await drive({
    body: { layer: "look", page: "/prices" },
    ask: "On the prices page put the price list above the introduction, and move the gallery page to /Photos/.",
    pick: { fields: ["shape", "pages"], pageVerb: "move", pageName: "/gallery", pageTo: "/Photos/" }, apply: pricesLayout,
  });
  const label = "move to /Photos/";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  // "/Photos/" WAS ASKED FOR, AND THE STEP CARRIES "/photos/" (the picker's
  // reader lowercases); `renameRoute` PUBLISHED "/photos". A reply composed from
  // the request would say "/photos/".
  assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "photos.tsx": MOVED, "visit.tsx": VISIT }, label);
  assert.equal(r.reply.renamedTo, "/photos", label + ": the reply's move");
  assertOps(r, [LAYOUT("/prices"), MOVE], label);
  assertOneCharge(r, "sync", label);
  assert.equal(r.said.text, "✅ Updated /prices and moved /gallery to /photos.", label + ": the customer's sentence");
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. A LOOK STEP BESIDE A PAGE OPERATION — where the look's own sentence has
// something to say, the removal follows it. Where the look changed NOTHING, its
// "nothing to change" speaks for the styling alone once another operation
// SHIPPED (2026-09-24, owner: *"Do not describe the whole request as having
// nothing to change when another operation shipped"*), and the page operations
// that shipped follow it. Decided from the steps' own results: a REFUSED
// operation shipped nothing, so beside one the look's own sentence stands and
// the refusal is warned about.
// ─────────────────────────────────────────────────────────────────────────────

const FOOTER = "footer{background-color:#0b3d2e}";
const LOOK_SAME = "Your site already looks like that — nothing to change.";
const STYLING_SAME = "The requested styling was already in place.";

test("a stylesheet change beside a removal names both: the look's own sentence, then the removal", async () => {
  const r = await drive({
    body: { layer: "look", page: "/prices" }, ask: "Make the footer dark green, and remove the gallery page.",
    pick: { fields: ["css", "pages"], ...REMOVE_GALLERY }, lane: { css: FOOTER },
  });
  const label = "css + remove";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.deepEqual(r.calls, [T.pick, T.lane], label + ": model calls");
  assertSite(r, GALLERY_GONE, label);
  assert.deepEqual(r.reply.layers, ["look", "page"], label + ": layers");
  assert.equal(r.reply.css, true, label + ": the stylesheet was not reported as changed");
  assertOps(r, [GONE], label);
  assert.equal(r.said.text, "✅ Updated the look — the design. The stylesheet sets none of the kit's own colour variables, so the site renders on the default palette. Took /gallery off the site. Every publish is kept, so say the word if you want it back.", label + ": the customer's sentence");
});

for (const mode of ["sync", "job"]) {
  test("unchanged styling beside a removal says the styling was already in place, then the removal (" + mode + ")", async () => {
    // THE STORED SHEET IS ALREADY THE ONE ASKED FOR, so the look step answers
    // "nothing to change" — which opened the reply, as a claim about the whole
    // message, over a removal that shipped.
    const r = await drive({
      mode, body: { layer: "look", page: "/prices" }, ask: "Make the footer dark green, and remove the gallery page.",
      pick: { fields: ["css", "pages"], ...REMOVE_GALLERY }, lane: { css: FOOTER }, css: FOOTER,
    });
    const label = "unchanged look + remove (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assertSite(r, GALLERY_GONE, label);
    assert.deepEqual(r.reply.layers, ["look", "page"], label + ": layers");
    assertOps(r, [GONE], label);
    assert.equal(r.reply.lookNote, STYLING_SAME, label + ": the look's note on the wire");
    assert.equal(r.said.text, "✅ " + STYLING_SAME + " Took /gallery off the site. Every publish is kept, so say the word if you want it back.", label + ": the customer's sentence");
    assert.ok(!/nothing to change/.test(r.said.text), label + ": the whole request was described as having nothing to change");
  });
}

test("unchanged styling beside a move says the styling was already in place, then the move", async () => {
  const r = await drive({
    body: { layer: "look", page: "/prices" }, ask: "Make the footer dark green, and move the gallery page to /photos.",
    pick: { fields: ["css", "pages"], ...MOVE_GALLERY }, lane: { css: FOOTER }, css: FOOTER,
  });
  const label = "unchanged look + move";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assertSite(r, GALLERY_MOVED, label);
  assert.deepEqual(r.reply.layers, ["look", "page"], label + ": layers");
  assertOps(r, [MOVE], label);
  assert.equal(r.reply.lookNote, STYLING_SAME, label + ": the look's note on the wire");
  assert.equal(r.said.text, "✅ " + STYLING_SAME + " Moved /gallery to /photos.", label + ": the customer's sentence");
});

test("unchanged styling beside an ordinary page edit names the page it changed", async () => {
  // NOT A VERB: the rule is that another operation SHIPPED, read off its
  // result, so a layout change scopes the note exactly as a removal does — and
  // with the look having changed nothing, the edited page is what is named.
  const r = await drive({
    body: { layer: "look", page: "/prices" }, ask: "Make the footer dark green, and on the prices page put the price list above the introduction.",
    pick: { fields: ["css", "shape"] }, lane: { css: FOOTER }, css: FOOTER, apply: pricesLayout,
  });
  const label = "unchanged look + layout";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.deepEqual(r.shown.map((f) => f && f.path), ["prices.tsx"], label + ": the writer was shown the wrong file");
  assertSite(r, { "index.tsx": HOME, "prices.tsx": pricesLayout(PRICES), "gallery.tsx": GALLERY, "visit.tsx": VISIT }, label);
  assert.deepEqual(r.reply.layers, ["look", "page"], label + ": layers");
  assertOps(r, [LAYOUT("/prices")], label);
  assert.equal(r.reply.lookNote, STYLING_SAME, label + ": the look's note on the wire");
  assert.equal(r.said.text, "✅ " + STYLING_SAME + " Updated /prices.", label + ": the customer's sentence");
});

test("control: unchanged styling on its own still says the site already looks like that", async () => {
  const r = await drive({
    body: { layer: "look" }, ask: "Make the footer dark green.",
    pick: { fields: ["css"] }, lane: { css: FOOTER }, css: FOOTER,
  });
  const label = "unchanged look alone";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.deepEqual(r.calls, [T.pick, T.lane], label + ": model calls");
  assert.equal(r.compiles, 0, label + ": something compiled");
  assert.deepEqual(r.stored, AS_STORED, label + ": the store changed");
  assert.deepEqual(r.reply.layers, ["look"], label + ": layers");
  assert.equal(r.reply.pageOps, undefined, label + ": a page operation was listed");
  assert.equal(r.reply.lookNote, LOOK_SAME, label + ": the look's note on the wire");
  assert.equal(r.said.text, "✅ " + LOOK_SAME, label + ": the customer's sentence");
});

test("control: unchanged styling beside a REFUSED removal keeps the look's own sentence and warns about the refusal", async () => {
  const r = await drive({
    body: { layer: "look", page: "/prices" }, ask: "Make the footer dark green, and remove the home page.",
    pick: { fields: ["css", "pages"], pageVerb: "remove", pageName: "/" }, lane: { css: FOOTER }, css: FOOTER,
  });
  const label = "unchanged look + refused removal";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.equal(r.compiles, 0, label + ": something compiled");
  assert.deepEqual(r.stored, AS_STORED, label + ": the store changed");
  assert.deepEqual(r.reply.layers, ["look"], label + ": layers");
  assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error]), [["page", "kept"]], label + ": partial");
  assert.equal(r.reply.pageOps, undefined, label + ": a refused removal was listed as an operation");
  assert.equal(r.reply.lookNote, LOOK_SAME, label + ": the look's note on the wire");
  assert.equal(r.said.text, "✅ " + LOOK_SAME + " ⚠️ I left / — that is the home page, and removing it would leave the site with no front door.", label + ": the customer's sentence");
  assert.ok(!/took|off the site/i.test(r.said.text), label + ": the refused removal was described as done");
});

test("control: unchanged styling beside a REFUSED move keeps the look's own sentence and warns about the refusal", async () => {
  const r = await drive({
    body: { layer: "look", page: "/prices" }, ask: "Make the footer dark green, and move the gallery page to /visit.",
    pick: { fields: ["css", "pages"], pageVerb: "move", pageName: "/gallery", pageTo: "/visit" }, lane: { css: FOOTER }, css: FOOTER,
  });
  const label = "unchanged look + refused move";
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.equal(r.compiles, 0, label + ": something compiled");
  assert.deepEqual(r.stored, AS_STORED, label + ": the store changed");
  assert.deepEqual(r.reply.layers, ["look"], label + ": layers");
  assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error]), [["page", "rename"]], label + ": partial");
  assert.equal(r.reply.pageOps, undefined, label + ": a refused move was listed as an operation");
  assert.equal(r.reply.lookNote, LOOK_SAME, label + ": the look's note on the wire");
  assert.equal(r.said.text, "✅ " + LOOK_SAME + " ⚠️ I couldn't move that page — there is already a page at /visit.", label + ": the customer's sentence");
  assert.ok(!/moved/i.test(r.said.text), label + ": the refused move was described as done");
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. ONE PAGE, ONE CLAUSE
// ─────────────────────────────────────────────────────────────────────────────

test("two successful page steps on one page are named once", () => {
  // READ, NOT DRIVEN: the QR placement step carries an ask of its own, so it is
  // never joined to a layout step or skipped after one (`samePageOperation`
  // answers false for it), and both land on the page the layout targets — so a
  // message with a QR, a layout change and a removal writes two entries for
  // that page. The entries here are in the merge's own shape; the look step's
  // own fields are left off, so this asserts the page operations alone.
  const reply = { ok: true, layer: "look", layers: ["page", "page", "page"], pageOps: [LAYOUT("/"), LAYOUT("/"), GONE], cost: 6 };
  const said = editBrowserReply(reply, true, { cost: 2 });
  assert.equal(said.ok, true, said.why);
  assert.equal(said.text, "✅ Updated / and took /gallery off the site. Every publish is kept, so say the word if you want it back.");
});
