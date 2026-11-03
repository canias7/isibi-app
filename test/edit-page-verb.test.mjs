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
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
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
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: asEdits({ source: apply(f.source) }, f.source) }], usage });
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
const REMOVED_SAID = "Took /gallery off the site. Every publish is kept, so say the word if you want it back.";
// A MOVE ON ITS OWN NAMES BOTH ADDRESSES. It said "✅ Updated /gallery." until
// the reply correction — the address the page had just left.
const MOVED_SAID = "Moved /gallery to /photos.";

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
  assert.equal(said.text, "Updated / and took /gallery off the site. Every publish is kept, so say the word if you want it back.");
});
