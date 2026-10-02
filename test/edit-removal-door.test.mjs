// ── RUN 47, REPRODUCED AND FIXED THROUGH THE REAL EDIT ROUTE (2026-09-28) ─────
//
// Test 5's paid press sent "Take Gallery out of the menu." to fold-lane-bakery.
// The router answered `nav` WITH `remove` — its own instructions say to set the
// flag for "take Pricing out of the menu" — and that flag opens the lane
// picker's door. The picker named `behavior`, the one lane whose hint mentions a
// menu and not one that edits a menu's items; a look step ran it INSTEAD of the
// menu rung, it answered nothing, and the route said `look/no-change`. The free
// rehearsal had supplied `nav` WITHOUT the flag, so it took a path the live run
// never used.
//
// THE RULE THESE CASES HOLD THE ROUTE TO (the owner's second hold, 2026-09-28:
// *"Replace the lane-count assumption with an explicit distinction between the
// already-routed operation and additional requested work. Give the selector
// that context and preserve the association through planning."*):
//   * the router's own step always runs on its removal door, exactly once, with
//     the router's verbs and nobody else's;
//   * the picker is TOLD what the router routed, in the router's own words, and
//     answers two lists of its own: `routed` (which part that change is about —
//     recorded, never run) and `additional` (work asked BESIDE it — each lane
//     its own step, with its own verb);
//   * nothing is read from how many lanes either list holds.
// Two corrections guessed and the owner held both. The first kept only lanes
// leading back to the router's rung, and "take the photo off … and move the
// opening hours up" lost the layout. The second read one lane as the removal
// and two as extra work, and lost it again when the picker named `shape` alone
// (the owner's reproduction: sync and queued alike, and with the photo refused
// the layout went too). Both of the owner's shapes are here — `["images",
// "shape"]`, and an answer whose additional work is `shape` alone — and both
// ship both changes.
//
// So every case posts THE ROUTER'S REAL SHAPE: `{layer: "nav", remove: true}`
// for the menu message and `{layer: "page", page: "/gallery", remove: true}` for
// the removal, on run 47's own stored pages (`fixtures/run47/`, checked against
// the hashes the run recorded).
//
// EVERY MODEL ANSWER IS SUPPLIED — the picker's, the menu rung's, the picture
// rung's, the page writer's. What this proves is what the route does with those
// answers: which rung runs, what is published, what is charged and what the
// customer reads — and, from the request the stub receives, exactly what the
// picker was ASKED. It never proves which lists a real picker fills.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool, pickRequest, pickLanes, doorLane, doorDispatch, LANE_FIELDS, laneLayer } from "../builder/site-lanes.mjs";
import { DOOR_LAYERS, layerLine } from "../builder/site-ask.mjs";
import { PICTURE_TOOL } from "../builder/site-picture.mjs";
import { navSlots, actionSlots, chromeListSlots, chromeObjectSlots, contactSlots, linkSlots } from "../builder/site-nav.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const SLUG = "fold-lane-bakery";
const USER = { id: "u-door-1", email: "owner@example.com" };
const PICK = pickTool().name;
const ROUTED = { cost: 2 };
const ASK_MENU = "Take Gallery out of the menu.";
const ASK_PAGE = "Remove the gallery page.";

// ── THE FIXTURE IS RUN 47'S OWN STORED PAGES ─────────────────────────────────
// Read out of the run's `before/source.json` (the same bodies run 42's read and
// every read since, the site unchanged at `01790468089054-8btpep`). The hashes
// are the ones Test 5 recorded before it spent, so a fixture that drifted from
// the evidence fails here rather than testing something else.
const RECORDED = {
  "index.tsx": "51b5af6af6ee25ca286ede451c0c7a847c5b9b0e1cea282c4ac96497a6a03ef7",
  "order.tsx": "4ead778eea41faafea0e54936fbf0f45fe2914f008947f6128e8ee860a31c1ae",
  "starter.tsx": "37fb0e176f22a44be663a9df9f9851095f9e472b229b62e146390d5e3dc1cd44",
  "visit.tsx": "bdb02abecad96c5665618fa29d98deabea7f2020289e2f91d38f22d2d7843c0b",
  "gallery.tsx": "4e8b82aa901741e0f5dbf0511f6f2331b5354f50bd5ee7bc9438d7bccb11ba1c",
};
const sha = (s) => createHash("sha256").update(s).digest("hex");
const PAGES = Object.keys(RECORDED).map((path) => ({
  path,
  source: readFileSync(new URL("./fixtures/run47/" + path.replace(/\.tsx$/, ".before.tsx"), import.meta.url), "utf8"),
}));
const ORIG = Object.fromEntries(PAGES.map((p) => [p.path, p.source]));
const LOOK = { brand: "Harbour Loaf", theme: "broadsheet" };
const BOULE = "A sourdough boule cooling after the morning bake";
const FRONT = "Harbour Loaf on a Bristol side street in the early morning";

// The menu model's answer: the site's menu without Gallery. The rung writes it
// into every page's copy of the menu.
const NAV_ANSWER = { links: [
  { label: "Today's bake", href: "/" },
  { label: "The starter", href: "/starter" },
  { label: "Visit", href: "/visit" },
] };
const GALLERY = { label: "Gallery", href: "/gallery" };

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function bucket() {
  const store = new Map([
    ["source/" + SLUG + "/pages.json", JSON.stringify(PAGES)],
    ["source/" + SLUG + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(SLUG), JSON.stringify({ look: LOOK, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, typeof v === "string" ? v : String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * One message through `POST /api/site/<slug>/edit`, on the synchronous path or
 * through the real queue consumer. The job's row moves the way the live RPCs
 * move it, gate included: `edit_may_publish` grants only `reserved` or
 * `exempt`, and `edit_exempt` turns only a `none` row exempt.
 */
async function drive({ routed, ask, answers = {}, site = null, mode = "sync" }) {
  const b = site ? site.b : bucket();
  const url = "https://gofarther.dev/api/site/" + SLUG + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, ...routed, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20) });
  const seen = { models: [], sent: [], debits: [], rpc: [], traces: [] };
  const id = hex32(), secret = hex32();
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug: SLUG, secret, at: Date.now() })));
  const row = { state: "routing", billing: "none", cost: 0, result: null };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push(fn);
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: row.billing, uid: USER.id, slug: SLUG, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": row.cost += Number(args.p_cost); row.billing = "reserved"; return json({ ok: true, charged: Number(args.p_cost), cost: row.cost, billing: "reserved" });
        case "edit_exempt": if (row.billing === "none") { row.billing = "exempt"; return json({ ok: true, billing: "exempt", state: row.state }); } return json({ ok: false, error: "billed", billing: row.billing });
        case "edit_may_publish": return json(["reserved", "exempt"].includes(row.billing) ? { ok: true, granted: true } : { ok: true, granted: false, error: row.billing === "none" ? "unbilled" : "terminal" });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize":
          if (args.p_result) row.result = args.p_result;
          if (args.p_ok) { row.state = "done"; if (row.billing === "reserved") row.billing = "finalized"; return json({ ok: true, billing: row.billing, cost: row.cost }); }
          return json({ ok: false, error: "not-published", state: row.state });
        case "edit_refund": { const was = row.billing; row.state = args.p_state || "failed"; if (was === "reserved") { row.billing = "refunded"; return json({ ok: true, refunded: row.cost }); } return json({ ok: true, refunded: 0, billing: was }); }
        case "edit_get": return json({ ok: true, job: id, slug: SLUG, state: row.state, phase: null, cost: row.cost, billing: row.billing, result: row.result, needs_review: false, ms: 1000 });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { const n = Number(args.cost) || 0; seen.debits.push(n); return json(n > 0 ? n : -1); }
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/edit_traces")) { seen.traces.push(args); return new Response(null, { status: 201 }); }
    if (u.includes("/rest/v1/site_backends")) return json(u.includes("slug=eq." + SLUG) ? [{ uid: USER.id, brief: "", neon_db: "" }] : []);
    if (u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push(tool);
      // WHAT EACH CALL WAS ASKED, so a case can read the picker's real input —
      // its tool, its system text and its message — and not only its answer.
      seen.sent.push({ tool, args });
      // AN ANSWER MAY BE A FUNCTION OF THE REQUEST, for a writer that must act
      // only on the file and the words it was really handed.
      if (Object.hasOwn(answers, tool)) {
        const input = typeof answers[tool] === "function" ? answers[tool](args) : answers[tool];
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input }], usage: { input_tokens: 2000, output_tokens: 400 } });
      }
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({});
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let res, reply;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      res = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
      reply = await res.json().catch(() => null);
    } else {
      res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const pages = JSON.parse(b.store.get("source/" + SLUG + "/pages.json") || "[]");
    return {
      site: { b }, status: res.status, reply, said: editBrowserReply(reply, res.ok, ROUTED), pages,
      builds: c.calls.map((k) => k.body), models: seen.models, sent: seen.sent, debits: seen.debits, rpc: seen.rpc,
      events: seen.traces.flatMap((t) => (Array.isArray(t.events) ? t.events : [])),
      row: { state: row.state, billing: row.billing, cost: row.cost },
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

const page = (r, p) => (r.pages.find((x) => x.path === p) || {}).source;
const paths = (r) => r.pages.map((p) => p.path).sort();
const built = (r, i = 0) => Object.keys((r.builds[i] && r.builds[i].files) || {}).filter((k) => k.endsWith(".tsx")).sort();
/** The menu items each page's copy of the menu carries, read by the rung's own reader. */
const menuOf = (src) => navSlots([{ path: "x.tsx", source: src }]).map((s) => s.items);
/** The page with every menu array's interior blanked: what must not move at all. */
function outsideMenus(src) {
  let out = src;
  for (const s of navSlots([{ path: "x.tsx", source: src }]).sort((a, b) => b.at - a.at)) out = out.slice(0, s.at) + "<menu>" + out.slice(s.to);
  return out;
}
/** Both lists the picker answered on the door, as the route recorded them. */
const doorMarks = (r) => r.events.filter((e) => e && e.p === "door:answer");
/** The request the route sent the picker, as the model stub received it. */
function pickSent(r) {
  const calls = r.sent.filter((q) => q.tool === PICK);
  assert.equal(calls.length, 1, "the picker was called " + calls.length + " times");
  return calls[0].args;
}
/**
 * THE DOOR'S CONTRACT, READ OFF THE REQUEST THE PICKER REALLY RECEIVED: the
 * door's tool (two lists, `additional` required, no `fields`), the door's system
 * text, and the routed change named above the message in the router's own words
 * for that layer — and the customer's message after it, untouched.
 */
function assertDoorAsked(r, layer, ask, label) {
  const q = pickSent(r);
  const tool = q.tools.find((t) => t.name === PICK);
  assert.ok(tool, label + ": the picker was not given its tool");
  assert.deepEqual(Object.keys(tool.input_schema.properties), ["routed", "additional", "removes", "scopes", "pageVerb", "pageName", "pageTo"], label + ": the door's tool");
  assert.deepEqual(tool.input_schema.required, ["additional"], label + ": what the door's tool requires");
  const text = q.system.map((b) => b.text).join("\n");
  assert.match(text, /ALREADY been routed to one change/, label + ": the door's system text");
  const said = q.messages[0].content;
  const words = layerLine(layer);
  assert.ok(words.length > 20, label + ": the router's own words for " + layer + " could not be read");
  assert.ok(said.includes("THE CHANGE THIS MESSAGE HAS ALREADY BEEN ROUTED TO"), label + ": the routed change is not named");
  assert.ok(said.includes("taking something OFF the site, in its \"" + layer + "\" part — " + words), label + ": not in the router's own words");
  assert.ok(said.endsWith("Their message:\n" + ask), label + ": the customer's message is not what was sent");
}
// TWO PAGES, NOT FOUR (2026-10-02, the whole-router audit's W4). Only the home
// and gallery pages list Gallery; the order and visit pages' menus never had it.
// Every menu used to be rewritten, so those two came out reformatted, item for
// item the same, and were counted as updated. A menu the change leaves as it
// was is now left as written, and the reply counts the menus that changed.
const MENU_SAID = "✅ Updated the menu on 2 pages: Today's bake · The starter · Visit.";

/**
 * THE ACCEPTANCE FOR THE MENU MESSAGE, shared by every shape that must reach the
 * menu rung: exactly the Gallery link leaves every copy of the menu, the page
 * itself stays, and nothing outside a menu array moves by a byte.
 */
function assertOnlyGalleryLeft(r, label) {
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.equal(r.reply && r.reply.ok, true, label + ": the menu change did not ship");
  assert.equal(r.reply.layer, "nav", label + ": answered by another rung");
  assert.equal(r.builds.length, 1, label + ": one compile carries the change");
  assert.deepEqual(built(r), Object.keys(ORIG).sort(), label + ": the compile payload lost or gained a page");
  assert.deepEqual(paths(r), Object.keys(ORIG).sort(), label + ": a page was removed with the link");
  for (const p of PAGES) {
    const after = page(r, p.path);
    assert.equal(outsideMenus(after), outsideMenus(p.source), label + ": " + p.path + " changed outside its menu");
    const want = menuOf(p.source).map((items) => items.filter((it) => it.href !== GALLERY.href));
    assert.deepEqual(menuOf(after), want, label + ": " + p.path + "'s menu is not its old menu less Gallery");
    // A PAGE WHOSE MENU NEVER LISTED GALLERY IS NOT TOUCHED AT ALL, to the
    // byte, its menu's own line breaks included (W4).
    if (!menuOf(p.source).flat().some((it) => it.href === GALLERY.href)) assert.equal(after, p.source, label + ": " + p.path + " was rewritten, and its menu had no Gallery to take out");
  }
  // THE OBSERVER IS ALIVE: two pages carry a menu without Gallery.
  assert.equal(PAGES.filter((p) => menuOf(p.source).length && !menuOf(p.source).flat().some((it) => it.href === GALLERY.href)).length, 2, label + ": the fixture no longer has a menu without Gallery");
  // Nothing but the gallery page itself still names its address.
  const naming = r.pages.filter((p) => p.path !== "gallery.tsx" && p.source.includes('"/gallery"')).map((p) => p.path);
  assert.deepEqual(naming, [], label + ": a page still links to /gallery");
  assert.equal(r.said.text, MENU_SAID, label + ": the screen");
}

/**
 * The layout change the page writer is supplied: the order band moved above the
 * starter story on the home page. A pure move — every character of both
 * sections kept — so the quick writer's own guard passes it and the photographs
 * in the story section go with it.
 */
function bandFirst(src) {
  const a = src.indexOf('      <section className="mx-auto max-w-3xl px-6 py-20 motion-reveal">');
  const b = src.indexOf('      <section className="mx-auto max-w-5xl px-6 pb-20 motion-reveal">');
  const end = "      </section>\n";
  const c = src.indexOf(end, b) + end.length;
  assert.ok(a > 0 && b > a && c > b, "the two home-page sections were not found");
  return src.slice(0, a) + src.slice(b, c) + "\n" + src.slice(a, b - 1) + src.slice(c);
}
const MOVED = bandFirst(ORIG["index.tsx"]);
const BOULE_SRC = 'src="/u/fold-lane-bakery/8e6bd4818b036cfcd639d1bb5ec6156c.jpg"';
const BAND_ASK = "Take Gallery out of the menu and put the order band above the starter story.";
const PHOTO_ASK = "Take the photo of the cooling loaf off the home page.";
const PHOTO_BAND_ASK = "Take the photo of the cooling loaf off the home page and put the order band above the starter story.";
// "TAKE THE PHOTO … OFF" IS `remove` (2026-09-29): the answer the picture tool
// now tells its model to give for these sentences, so the supplied answer is
// that one — a fixture from its real producer. `clear` keeps the space and is
// asked for by name; the keep-the-space controls further down supply it.
const REMOVE_BOULE = { pictures: [{ page: "index.tsx", alt: BOULE, remove: true }] };
/**
 * A PHOTOGRAPH'S OWN LINES, read landmark to landmark from the stored page:
 * the line its element opens on, to the `/>` that closes it. Taking it off
 * removes exactly these — worked out here from the fixture, never by asking
 * the product's own reader for its answer.
 */
function ownLinesOf(src, open) {
  const i = src.indexOf(open);
  assert.ok(i >= 0 && src.indexOf(open, i + 1) < 0, "the photograph's opening landmark is not on the page exactly once: " + open);
  const close = src.indexOf("/>\n", i);
  assert.ok(close > i, "the photograph's closing landmark is missing: " + open);
  return src.slice(src.lastIndexOf("\n", i) + 1, close + 3);
}
const BOULE_LINES = ownLinesOf(ORIG["index.tsx"], '<SafeImage focus="top"');

/** The money, read the way each path keeps it, and always equal to the reply's own cost. */
function assertCharged(r, mode, debits, label) {
  if (mode === "sync") {
    assert.deepEqual(r.debits, debits, label + ": debits");
    assert.equal(r.reply.cost, debits.reduce((a, b) => a + b, 0), label + ": the reply's cost is not what was debited");
  } else {
    assert.deepEqual(r.debits, [], label + ": the job path debited directly");
    const total = debits.reduce((a, b) => a + b, 0);
    assert.deepEqual(r.row, { state: "done", billing: "finalized", cost: total }, label + ": the job's row");
    assert.equal(r.reply.cost, total, label + ": the reply's cost is not the row's");
  }
}

/** Every page but the home page byte for byte, and no page gone: no step deleted or moved one. */
function assertOthersKept(r, label) {
  assert.deepEqual(paths(r), Object.keys(ORIG).sort(), label + ": a page was removed or added");
  assert.deepEqual(built(r), Object.keys(ORIG).sort(), label + ": the compile payload lost or gained a page");
  assert.equal(r.reply.removed, undefined, label + ": a page was reported removed");
  assert.equal(r.reply.renamedTo, undefined, label + ": a page was reported moved");
}

test("the fixture is run 47's stored pages, and /gallery is named by the home page's menu alone", () => {
  for (const p of PAGES) assert.equal(sha(p.source), RECORDED[p.path], p.path + " is not the recorded body");
  assert.deepEqual(menuOf(ORIG["index.tsx"]), [[
    { label: "Today's bake", href: "/" }, { label: "The starter", href: "/starter" },
    { label: "Visit", href: "/visit" }, GALLERY,
  ]], "the home page's menu is not the one run 47 saw");
  const naming = PAGES.filter((p) => p.path !== "gallery.tsx" && p.source.includes('"/gallery"')).map((p) => p.path);
  assert.deepEqual(naming, ["index.tsx"]);
  // The comparison helper is alive: the one menu change there is shows up.
  assert.notEqual(outsideMenus(ORIG["index.tsx"]), ORIG["index.tsx"]);
  assert.equal(outsideMenus(ORIG["starter.tsx"]), ORIG["starter.tsx"], "the stub has no menu");
  // And the supplied layout really is a move: the page changed, and not one
  // character was lost or gained.
  assert.notEqual(MOVED, ORIG["index.tsx"]);
  assert.equal([...MOVED].sort().join(""), [...ORIG["index.tsx"]].sort().join(""), "the supplied layout is not a pure move");
  assert.equal(ORIG["index.tsx"].split(BOULE_SRC).length, 2, "the boule's photograph is not on the home page exactly once");
});

test("the door's own lane, and where the router's step runs — once", () => {
  // EVERY LAYER THE ROUTER CAN OPEN THE DOOR FROM HAS EXACTLY ONE LANE, so its
  // own step and "that lane, as if picked" are one step.
  assert.ok(DOOR_LAYERS.length >= 2, "the door layers could not be read");
  for (const layer of DOOR_LAYERS) {
    const lanes = LANE_FIELDS.filter((f) => laneLayer(f) === layer);
    assert.equal(lanes.length, 1, layer + " has " + lanes.length + " lanes leading to it");
    assert.equal(doorLane(layer), lanes[0]);
  }
  assert.equal(doorLane("nav"), "action");
  assert.equal(doorLane("picture"), "images");
  // Not one lane, or not a layer: `null`, never a match — `laneLayer` answers
  // `null` for every lane that acts in the look step.
  for (const layer of ["page", "look", "", null, undefined, 7]) assert.equal(doorLane(layer), null, String(layer));

  // THE ROUTER'S LANE GOES WHERE IT WOULD HAVE RUN, in the picker's own order,
  // and it is never there twice.
  assert.deepEqual(doorDispatch([], "action"), ["action"]);
  assert.deepEqual(doorDispatch(["shape"], "images"), ["shape", "images"]);
  assert.deepEqual(doorDispatch(["behavior", "shape", "tsx"], "action"), ["behavior", "shape", "action", "tsx"]);
  assert.deepEqual(doorDispatch(["shape", "images"], "images"), ["shape", "images"]);
  // No lane of its own: the picker's list, untouched.
  assert.deepEqual(doorDispatch(["shape"], null), ["shape"]);
});

test("THE SELECTOR'S CONTRACT: on the door it is told what was routed and asked for the rest; everywhere else it is asked what it always was", () => {
  const ask = "Take the photo of the cooling loaf off the home page and put the order band above the starter story.";
  const current = "Its pages are: /, /order, /starter, /visit, /gallery.";
  const look = pickRequest({ message: ask, current });
  for (const layer of DOOR_LAYERS) {
    const q = pickRequest({ message: ask, current, routed: { layer, remove: true, page: "/" } });
    const tool = q.tools[0];
    // THE DOOR'S TOOL: two lists, `additional` the only one required, and no
    // `fields` at all — so an answer in the ordinary tool's shape names no work.
    assert.equal(tool.name, PICK);
    assert.deepEqual(Object.keys(tool.input_schema.properties), ["routed", "additional", "removes", "scopes", "pageVerb", "pageName", "pageTo"], layer);
    assert.deepEqual(tool.input_schema.required, ["additional"], layer);
    for (const k of ["routed", "additional"]) {
      const list = tool.input_schema.properties[k];
      assert.equal(list.type, "array", k);
      assert.equal(list.minItems, undefined, k + " must allow an empty answer");
      assert.deepEqual(list.items.enum, LANE_FIELDS, k + " must offer every lane");
    }
    const additional = tool.input_schema.properties.additional.description;
    assert.match(additional, /ANYTHING ELSE THIS MESSAGE ASKS TO CHANGE/);
    assert.match(additional, /EMPTY IS THE ORDINARY ANSWER/);
    for (const f of LANE_FIELDS) assert.ok(additional.includes("\"" + f + "\" — "), "the parts list lost " + f);
    assert.match(tool.input_schema.properties.routed.description, /This changes nothing/);
    // A REMOVAL AND A PAGE VERB NAME WORK FROM THE DOOR'S OWN LIST.
    assert.ok(tool.input_schema.properties.removes.description.startsWith("The parts named in `additional`"));
    assert.ok(tool.input_schema.properties.pageVerb.description.startsWith("ONLY when `additional` includes \"pages\"."));
    // THE ROUTED CHANGE IS NAMED ABOVE THE MESSAGE, in the router's own words
    // for that layer and never a second description of it, with the page.
    const words = layerLine(layer);
    assert.ok(words.length > 20, layer + ": the router's own words could not be read");
    assert.equal(q.messages[0].content,
      current + "\n\nTHE CHANGE THIS MESSAGE HAS ALREADY BEEN ROUTED TO, which is made whatever you answer:\n" +
      "taking something OFF the site, in its \"" + layer + "\" part — " + words + "\nOn the page /.\n\nTheir message:\n" + ask);
    assert.match(q.system[0].text, /ALREADY been routed to one change/);
    assert.match(q.system[0].text, /Say so by naming nothing in `additional`\./);
    // THE DOOR'S PREFIX IS ONE PREFIX: the tool and the system text do not
    // move with the layer or the page, only the message does.
    const other = pickRequest({ message: "x", routed: { layer: DOOR_LAYERS.find((l) => l !== layer), remove: true } });
    assert.equal(JSON.stringify(other.tools), JSON.stringify(q.tools));
    assert.equal(JSON.stringify(other.system), JSON.stringify(q.system));
    // A page named nowhere is not said.
    assert.ok(!pickRequest({ message: ask, routed: { layer, remove: true } }).messages[0].content.includes("On the page"));
  }
  // EVERYWHERE ELSE THE QUESTION IS THE ORDINARY ONE, BYTE FOR BYTE: the look
  // door, a door layer the router did NOT mark as a removal, a layer that is
  // not a door, and anything unreadable.
  assert.deepEqual(Object.keys(look.tools[0].input_schema.properties), ["fields", "removes", "scopes", "pageVerb", "pageName", "pageTo"]);
  // `scopes` IS REQUIRED SINCE 2026-09-29: each change's own page and words
  // (run 52). The door's `required` above is unchanged — its scopes cover only
  // the work asked beside the routed change, and that list is usually empty.
  assert.deepEqual(look.tools[0].input_schema.required, ["fields", "scopes"]);
  assert.equal(look.tools[0].input_schema.properties.fields.minItems, 1);
  assert.equal(look.messages[0].content, current + "\n\nTheir message:\n" + ask);
  assert.doesNotMatch(look.system[0].text, /ALREADY been routed/);
  for (const routed of [null, { layer: "nav" }, { layer: "nav", remove: "true" }, { layer: "look", remove: true }, { layer: "page", remove: true },
    { layer: "logo", remove: true }, { layer: ["nav"], remove: true }, "nav"]) {
    assert.equal(JSON.stringify(pickRequest({ message: ask, current, routed })), JSON.stringify(look), JSON.stringify(routed));
  }
});

test("THE DOOR'S ANSWER, READ BY ITS NAMES: only `additional` makes work, the routed change's own lane is that change, and nothing is counted", async () => {
  const sent = [];
  const pick = async (layer, input) => {
    const out = await pickLanes({
      send: async (req) => { sent.push(req); return { content: [{ type: "tool_use", name: PICK, input }], usage: { input_tokens: 10, output_tokens: 5 } }; },
    }, { message: "a message", routed: { layer, remove: true } });
    return { fields: out.fields, routed: out.routed, removes: out.removes.remove, pages: out.removes.pages, refused: out.removes.refused.map((x) => x.field), verb: out.page ? out.page.verb : undefined };
  };
  const want = (fields, routed, removes = [], extra = {}) => ({ fields, routed, removes, pages: false, refused: [], verb: undefined, ...extra });
  // THE OWNER'S TWO SHAPES FOR ONE REQUEST: the layout asked beside the photo,
  // named with the photo's own lane or without it — the same work either way.
  assert.deepEqual(await pick("picture", { additional: ["shape"] }), want(["shape"], []));
  assert.deepEqual(await pick("picture", { routed: ["images"], additional: ["shape"] }), want(["shape"], ["images"]));
  // THE ROUTED CHANGE'S OWN LANE UNDER `additional` IS THAT CHANGE, kept once —
  // its removal too, which is the router's own verb.
  assert.deepEqual(await pick("picture", { additional: ["images", "shape"], removes: ["images"] }), want(["shape"], ["images"]));
  assert.deepEqual(await pick("picture", { additional: ["images"] }), want([], ["images"]));
  // ONE LANE TIED TO THE ROUTED CHANGE IS NOT WORK (run 47's `behavior`), and
  // TWO LANES ARE NOT TWO REQUESTS: the one tied to it stays out.
  assert.deepEqual(await pick("nav", { routed: ["behavior"], additional: [] }), want([], ["behavior"]));
  assert.deepEqual(await pick("nav", { routed: ["behavior"], additional: ["shape"] }), want(["shape"], ["behavior"]));
  // RUN 47'S RECORDED ANSWER, in the ordinary tool's shape: no `additional`, so
  // no work. So is anything that is not a list of lane names.
  assert.deepEqual(await pick("nav", { fields: ["behavior"] }), want([], []));
  for (const bad of [{ additional: "shape" }, { additional: [["shape"]] }, { additional: [7, null] }, { additional: ["nope"] }, {}]) {
    assert.deepEqual(await pick("picture", bad), want([], []), JSON.stringify(bad));
  }
  // A REMOVAL OR A PAGE VERB CAN NAME ONLY WORK FROM `additional`: tied to the
  // routed change they are nothing — no refusal, no page deleted.
  assert.deepEqual(await pick("nav", { routed: ["backend"], removes: ["backend"] }), want([], ["backend"]));
  assert.deepEqual(await pick("nav", { routed: ["pages"], removes: ["pages"], pageVerb: "remove", pageName: "/gallery" }),
    want([], ["pages"], [], { verb: "remove" }));
  assert.deepEqual(await pick("nav", { additional: ["three", "backend"], removes: ["three", "backend"] }),
    want(["backend", "three"], [], ["three"], { refused: ["backend"] }));
  assert.deepEqual(await pick("nav", { additional: ["pages"], removes: ["pages"] }), want(["pages"], [], [], { pages: true }));
  // THE SAME CAP, DE-DUPLICATION AND ORDER AS EVERY LANE LIST.
  // The first four distinct names in the model's order, then the caller's order.
  assert.deepEqual((await pick("nav", { additional: ["tsx", "css", "css", "shape", "brand", "favicon", "lang"] })).fields, ["css", "brand", "shape", "tsx"]);
  // And every one of those calls was the door's question.
  assert.equal(sent.length, 17);
  for (const req of sent) assert.deepEqual(req.tools[0].input_schema.required, ["additional"]);
  // A message with nothing in it asks nothing and runs nothing.
  const empty = await pickLanes({ send: async () => { throw new Error("called"); } }, { message: "  ", routed: { layer: "nav", remove: true } });
  // RE-ANCHORED 2026-09-29: an answer now says whether it carried scope
  // metadata (`scoped`), and an empty message carries none.
  assert.deepEqual(empty, { fields: [], routed: [], scopes: [], scoped: false, usage: null, failed: false });
});

for (const mode of ["sync", "job"]) {
  // ── 1. RUN 47: GALLERY LEAVES THE MENU, AND ITS PAGE STAYS UNTIL ASKED ─────
  test(`RUN 47 (${mode}): the picker, told the menu removal is routed, ties behavior to it — only the menu rung runs, and only Gallery leaves`, async () => {
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: ASK_MENU,
      answers: { [PICK]: { routed: ["behavior"], additional: [] }, edit_site: {}, write_nav: NAV_ANSWER } });
    // THE LIVE FAILURE, NAMED: the look step's lane call (`edit_site`) never
    // runs, and the menu rung does.
    assert.deepEqual(r.models, [PICK, "write_nav"], "the rungs called");
    assertOnlyGalleryLeft(r, "run 47 " + mode);
    // The home page keeps its own "Today's bake" link — the menu rung's home
    // rule stops a home page GAINING a link to itself, never forces a loss.
    assert.deepEqual(menuOf(page(r, "index.tsx")), [NAV_ANSWER.links]);
    // WHAT THE PICKER WAS ASKED, off the request it received, and both of its
    // lists as the route recorded them.
    assertDoorAsked(r, "nav", ASK_MENU, "run 47 " + mode);
    assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "nav", routed: ["behavior"], additional: [] }]);
    assert.deepEqual(r.reply.lanes, [], "the reply names a lane that did not run");
    // Charged once, for the picker and the menu rung together.
    assertCharged(r, mode, [3], "run 47 " + mode);
    if (mode === "job") assert.equal(r.rpc.filter((f) => f === "edit_reserve").length, 1);
  });

  test(`RUN 47'S RECORDED ANSWER (${mode}): behavior in the ordinary tool's shape names no work on the door, and the menu rung runs alone`, async () => {
    // What the real picker answered on run 47, before it was asked the door's
    // question. The door's tool has no `fields`, so this names no work at all.
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: ASK_MENU,
      answers: { [PICK]: { fields: ["behavior"] }, edit_site: {}, write_nav: NAV_ANSWER } });
    assert.deepEqual(r.models, [PICK, "write_nav"], "the rungs called");
    assertOnlyGalleryLeft(r, "run 47 recorded " + mode);
    assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "nav", routed: [], additional: [] }]);
    assertCharged(r, mode, [3], "run 47 recorded " + mode);
  });

  test(`THEN (${mode}): with its only incoming link gone, "Remove the gallery page." removes that page and nothing else`, async () => {
    const r1 = await drive({ mode, routed: { layer: "nav", remove: true }, ask: ASK_MENU,
      answers: { [PICK]: { routed: ["behavior"], additional: [] }, edit_site: {}, write_nav: NAV_ANSWER } });
    assertOnlyGalleryLeft(r1, "the menu first (" + mode + ")");
    const r2 = await drive({ mode, site: r1.site, routed: { layer: "page", page: "/gallery", remove: true }, ask: ASK_PAGE });
    assert.equal(r2.status, 200, JSON.stringify(r2.reply));
    assert.equal(r2.reply && r2.reply.ok, true);
    assert.deepEqual(r2.reply.removed, ["gallery.tsx"]);
    assert.deepEqual(r2.models, [], "a page removal makes no model call");
    assert.equal(r2.builds.length, 1);
    assert.deepEqual(built(r2), ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx"]);
    assert.deepEqual(paths(r2), ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx"]);
    for (const p of paths(r2)) assert.equal(page(r2, p), page(r1, p), p + " changed in the removal");
    assert.equal(r2.said.text, "✅ Took /gallery off the site. Every publish is kept, so say the word if you want it back.");
    if (mode === "sync") assert.deepEqual(r2.debits, [], "the removal was charged");
    else {
      assert.deepEqual(r2.row, { state: "done", billing: "exempt", cost: 0 });
      assert.ok(!r2.rpc.includes("edit_reserve"), "the removal reserved credits");
    }
  });

  test(`CONTROL (${mode}): a page another page still links to is refused, and nothing is compiled or charged`, async () => {
    const r = await drive({ mode, routed: { layer: "page", page: "/gallery", remove: true }, ask: ASK_PAGE });
    assert.equal(r.reply && r.reply.ok, false);
    assert.equal(r.reply.error, "kept");
    assert.deepEqual(r.models, []);
    assert.equal(r.builds.length, 0);
    assert.deepEqual(r.debits, []);
    for (const p of PAGES) assert.equal(page(r, p.path), p.source, p.path + " changed");
    assert.equal(r.said.text, "⚠️ I left /gallery — / still links to it. Ask me to take the link out first. Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.");
    if (mode === "job") assert.equal(r.row.billing, "none");
  });

  // ── 2. A PHOTO REMOVAL AND A LAYOUT CHANGE: BOTH SHIP, WHICHEVER WAY THE ───
  //       PICKER NAMES THE LAYOUT
  //
  // The owner's reproduction was the third of these: the layout named alone as
  // the work asked beside the photo, which the count rule read as the photo
  // itself and never ran. The page writer runs first, in the picker's own
  // order, shown the home page with both photographs; the picture rung — the
  // router's step, run exactly once — then takes the one photograph off the
  // page it left.
  for (const [shapeName, answer, lanes] of [
    ['["images", "shape"], the photo tied to the routed change', { routed: ["images"], additional: ["shape"] }, ["shape", "images"]],
    ['["images", "shape"], both named as work', { additional: ["images", "shape"], removes: ["images"] }, ["shape", "images"]],
    ['the additional work alone: ["shape"]', { additional: ["shape"] }, ["shape"]],
  ]) {
    test(`BOTH (${mode}), ${shapeName}: the photo comes off and the layout changes, and the layout step deletes nothing`, async () => {
      const r = await drive({ mode, routed: { layer: "picture", remove: true }, ask: PHOTO_BAND_ASK,
        answers: { [PICK]: answer, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: REMOVE_BOULE } });
      const label = "photo + layout " + mode + " " + JSON.stringify(answer);
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
      // ONE PAGE WRITER, ONE PICTURE RUNG — the router's operation once.
      assert.deepEqual(r.models, [PICK, "write_tweak", PICTURE_TOOL.name], label + ": the rungs called");
      assert.deepEqual(r.reply.layers, ["page", "picture"], label + ": layers");
      assert.deepEqual(r.reply.lanes, lanes, label + ": lanes");
      assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
      assert.equal(r.builds.length, 1, label + ": one compile carries both");
      // EXACTLY BOTH CHANGES: the moved layout, with that one photograph's own
      // lines gone and every other character where the layout put it.
      assert.equal(MOVED.split(BOULE_LINES).length, 2, label + ": the moved layout does not carry the photograph once");
      assert.equal(page(r, "index.tsx"), MOVED.replace(BOULE_LINES, ""), label + ": the home page is not the layout plus the removal");
      assert.ok(page(r, "index.tsx").includes('alt="' + FRONT + '"') && page(r, "index.tsx").includes("64eee06cebae214308ea0142e5163286.jpg"), label + ": the other photograph went too");
      // A PHOTO'S REMOVAL NEVER MAKES THE LAYOUT STEP DELETE ITS PAGE: every page
      // is still there, and every other page is byte for byte what it was.
      assertOthersKept(r, label);
      for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, label + ": " + p.path + " changed");
      assertDoorAsked(r, "picture", PHOTO_BAND_ASK, label);
      assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "picture", routed: lanes.includes("images") ? ["images"] : [], additional: ["shape"] }], label + ": the lists recorded");
      assert.equal(r.said.text, "✅ Updated the look. One photograph is no longer on the site. If that was not what you wanted, roll back to the previous build in Cloud → Versions.", label + ": the screen");
      assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
      assertCharged(r, mode, [3, 2], label);
    });
  }

  // ── 3. A PHOTO REFUSAL AND A VALID LAYOUT CHANGE: THE LAYOUT SHIPS ────────
  for (const [shapeName, answer] of [
    ['the additional work alone: ["shape"]', { additional: ["shape"] }],
    ['["images", "shape"]', { routed: ["images"], additional: ["shape"] }],
  ]) {
    test(`PARTIAL (${mode}), ${shapeName}: the picture rung finds no such photograph, the layout ships, and the reply says both`, async () => {
      // The picture model answers nothing it can match — the site has no photo
      // of croissants — so the picture step refuses in its own words. The layout
      // is independent work and ships beside that refusal, with the refused
      // step's own charge said. (`edit-page-verb.test.mjs` holds the same shape
      // on a site with no photograph at all, where the picture step makes no
      // model call.)
      const ask = "Take the photo of the croissants off the home page and put the order band above the starter story.";
      const r = await drive({ mode, routed: { layer: "picture", remove: true }, ask,
        answers: { [PICK]: answer, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: { pictures: [] } } });
      const label = "photo refused + layout " + mode + " " + JSON.stringify(answer);
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
      assert.deepEqual(r.models, [PICK, "write_tweak", PICTURE_TOOL.name], label + ": the rungs called");
      assert.deepEqual(r.reply.layers, ["page"], label + ": layers");
      assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error, p.cost]), [["picture", "no-match", 2]], label + ": partial");
      assert.equal(r.builds.length, 1);
      assert.equal(page(r, "index.tsx"), MOVED, label + ": the home page is not exactly the layout");
      assertOthersKept(r, label);
      for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, label + ": " + p.path + " changed");
      assertDoorAsked(r, "picture", ask, label);
      assert.equal(r.said.text, "✅ Updated /. ⚠️ I couldn't match that to any of the pictures on your site. That part still cost 2 credits.", label + ": the screen");
      assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
      assertCharged(r, mode, [3, 2], label);
    });
  }

  // ── AND THE SAME ON THE MENU'S DOOR ────────────────────────────────────────
  for (const [shapeName, answer, lanes] of [
    ["the menu's own lane tied to the routed change", { routed: ["action"], additional: ["shape"] }, ["shape", "action"]],
    // TWO LANES, ONE REQUEST BESIDE THE ROUTED CHANGE: by run 47's own evidence
    // the picker reads the menu part as `behavior`. Tied to the routed change,
    // it does not run — the count rule ran it here and put a warning on the
    // screen beside the two changes that shipped.
    ["behavior tied to the routed change, the layout as work", { routed: ["behavior"], additional: ["shape"] }, ["shape"]],
    ["the additional work alone", { additional: ["shape"] }, ["shape"]],
  ]) {
    test(`MENU + LAYOUT (${mode}), ${shapeName}: Gallery leaves the menu, the layout ships, and nothing else runs`, async () => {
      const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: BAND_ASK,
        answers: { [PICK]: answer, edit_site: {}, write_tweak: { source: MOVED }, write_nav: NAV_ANSWER } });
      const label = "menu + layout " + mode + " " + JSON.stringify(answer);
      assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
      assert.deepEqual(r.models, [PICK, "write_tweak", "write_nav"], label + ": the rungs called");
      assert.deepEqual(r.reply.layers, ["page", "nav"], label + ": layers");
      assert.deepEqual(r.reply.lanes, lanes, label + ": lanes");
      assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
      assert.equal(r.builds.length, 1);
      assert.equal(outsideMenus(page(r, "index.tsx")), outsideMenus(MOVED), label + ": the home page is not the layout outside its menu");
      for (const p of PAGES) {
        const want = menuOf(p.source).map((items) => items.filter((it) => it.href !== GALLERY.href));
        assert.deepEqual(menuOf(page(r, p.path)), want, label + ": " + p.path + "'s menu is not its old menu less Gallery");
        if (p.path !== "index.tsx") assert.equal(outsideMenus(page(r, p.path)), outsideMenus(p.source), label + ": " + p.path + " changed outside its menu");
      }
      assertOthersKept(r, label);
      assertDoorAsked(r, "nav", BAND_ASK, label);
      assert.equal(r.said.text, "✅ Updated the look.", label + ": the screen");
      assertCharged(r, mode, [3, 2], label);
    });
  }

  test(`THE LIMIT (${mode}): a lane the picker names as WORK runs beside the routed change — the route honours the list, and says what it could not do`, async () => {
    // ⚠ STATED, NOT PAPERED OVER: `behavior` under `additional` is the picker
    // saying the message ASKED for a behaviour change, and nothing here reads
    // English to overrule it. So it runs; its supplied answer is nothing, and
    // the look step says it could not make that change beside the two changes
    // that shipped. A real behaviour lane that answered would change the site's
    // stored behaviour list. Which list a real picker fills is not measured.
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: BAND_ASK,
      answers: { [PICK]: { additional: ["behavior", "shape"] }, edit_site: {}, write_tweak: { source: MOVED }, write_nav: NAV_ANSWER } });
    const label = "work named " + mode;
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "edit_site", "write_tweak", "write_nav"], label + ": the rungs called");
    assert.deepEqual(r.reply.layers, ["page", "nav"], label + ": the menu rung did not run");
    assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error, p.lanes]), [["look", "no-change", ["behavior"]]], label + ": partial");
    for (const p of PAGES) {
      const want = menuOf(p.source).map((items) => items.filter((it) => it.href !== GALLERY.href));
      assert.deepEqual(menuOf(page(r, p.path)), want, label + ": " + p.path + "'s menu is not its old menu less Gallery");
    }
    assert.equal(outsideMenus(page(r, "index.tsx")), outsideMenus(MOVED), label + ": the home page is not the layout outside its menu");
    assertOthersKept(r, label);
    assert.equal(r.said.text, "✅ Updated the look. ⚠️ I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like.", label + ": the screen");
    assertCharged(r, mode, [3, 2], label);
  });
}

// ── 3b. A REMOVAL BESIDE A CHANGE ON ANOTHER PAGE: EACH IN ITS OWN SCOPE ─────
//
// Run 52's shape on this door (2026-09-29). The router's `picture` answer
// carries no page, so an unscoped layout lane went to the home page — the page
// the photo is on — and its writer was handed the whole message. The picker now
// scopes the work beside the routed change: the layout step runs on the Visit
// page with only the Visit words, and the picture rung — the router's step, run
// once, on the router's verbs — takes the one photograph off the home page.
// Supplied model answers throughout: this proves what the route does with a
// scoped answer, not that a real picker gives one.
const VISIT_SRC = ORIG["visit.tsx"];
/** The Visit page with its order band moved above "Come to the bakery" — a pure move. */
function visitBandFirst(src) {
  const a = src.indexOf('      <section className="mx-auto max-w-5xl px-6 py-14">');
  const b = src.indexOf('      <section className="mx-auto max-w-5xl px-6 pb-20 motion-reveal">');
  const end = "      </section>\n";
  const c = src.indexOf(end, b) + end.length;
  assert.ok(a > 0 && b > a && c > b, "the two Visit sections were not found");
  return src.slice(0, a) + src.slice(b, c) + "\n" + src.slice(a, b - 1) + src.slice(c);
}
const VISIT_MOVED = visitBandFirst(VISIT_SRC);
const VISIT_BAND_WORDS = 'on the Visit page only, put the "Order a collection so we hold a loaf" band above "Come to the bakery"';
const PHOTO_VISIT_ASK = PHOTO_ASK + " Then, " + VISIT_BAND_WORDS + ".";
/** What the page writer was handed: the file's name and the words, read off its real request. */
function writerAsked(args) {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const i = content.indexOf("THE CHANGE THEY ASKED FOR\n");
  const f = content.indexOf("\n\nTHE FILE (", i);
  const close = content.indexOf(")\n", f);
  assert.ok(i >= 0 && f > i && close > f, "the page writer's request lost its landmarks");
  return { instruction: content.slice(i + "THE CHANGE THEY ASKED FOR\n".length, f), path: content.slice(f + "\n\nTHE FILE (".length, close) };
}
/** A writer that moves the Visit band only when it is shown the Visit page and told to. */
const visitWriter = (args) => {
  const { instruction, path } = writerAsked(args);
  return { source: path === "visit.tsx" && instruction.includes("Come to the bakery") ? VISIT_MOVED : ORIG[path] };
};

test("the scoped door's fixture: a pure move of the Visit page's two sections, and the words are in the message once", () => {
  assert.notEqual(VISIT_MOVED, VISIT_SRC);
  assert.equal([...VISIT_MOVED].sort().join(""), [...VISIT_SRC].sort().join(""), "the move added or lost a character");
  assert.ok(VISIT_MOVED.indexOf("Order a collection so we hold a loaf") < VISIT_MOVED.indexOf("Come to the bakery"));
  assert.equal(PHOTO_VISIT_ASK.split(VISIT_BAND_WORDS).length, 2);
  assert.ok(ORIG["index.tsx"].includes(BOULE_SRC) && !VISIT_SRC.includes(BOULE_SRC), "the boule is not on the home page alone");
});

for (const mode of ["sync", "job"]) {
  test(`SCOPED (${mode}): the photo comes off the home page, the band moves on the Visit page, and each step was handed only its own page`, async () => {
    const answer = { additional: ["shape"], scopes: [{ part: "shape", page: "/visit", words: VISIT_BAND_WORDS }] };
    const r = await drive({ mode, routed: { layer: "picture", remove: true }, ask: PHOTO_VISIT_ASK,
      answers: { [PICK]: answer, write_tweak: visitWriter, [PICTURE_TOOL.name]: REMOVE_BOULE } });
    const label = "scoped photo + visit " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "write_tweak", PICTURE_TOOL.name], label + ": the rungs called");
    // THE WRITER'S REAL INPUT: the Visit page, and the Visit words alone — not
    // the photo's sentence, and not the home page.
    const writes = r.sent.filter((q) => q.tool === "write_tweak").map((q) => writerAsked(q.args));
    assert.deepEqual(writes, [{ path: "visit.tsx", instruction: VISIT_BAND_WORDS }], label + ": what the writer was handed");
    // THE ROUTER'S STEP READS THE ROUTER'S MESSAGE, as it always has: once.
    const pics = r.sent.filter((q) => q.tool === PICTURE_TOOL.name);
    assert.equal(pics.length, 1, label + ": the picture rung ran " + pics.length + " times");
    assert.deepEqual(r.reply.layers, ["page", "picture"], label + ": layers");
    assert.deepEqual(r.reply.pageOps, [{ page: "/visit" }], label + ": the page operation");
    assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
    assert.equal(r.builds.length, 1, label + ": one compile carries both");
    // THE STORED CHANGES: the Visit band moved, the boule taken off the home
    // page and nothing else there, and every other page byte for byte.
    assert.equal(page(r, "visit.tsx"), VISIT_MOVED, label + ": the Visit page is not exactly the move");
    assert.equal(page(r, "index.tsx"), ORIG["index.tsx"].replace(BOULE_LINES, ""), label + ": the home page is not exactly the removal");
    for (const p of ["order.tsx", "starter.tsx", "gallery.tsx"]) assert.equal(page(r, p), ORIG[p], label + ": " + p + " changed");
    assertOthersKept(r, label);
    assertDoorAsked(r, "picture", PHOTO_VISIT_ASK, label);
    // THE SCREEN IS THE UNSCOPED CASE'S, word for word: two rungs read "the
    // look", which names neither page — the parked review #9 wording, kept
    // because no reply is redesigned here. Nothing in it is untrue.
    assert.equal(r.said.text, "✅ Updated the look. One photograph is no longer on the site. If that was not what you wanted, roll back to the previous build in Cloud → Versions.", label + ": the screen");
    assertCharged(r, mode, [3, 2], label);
  });
}

test("CONTROL: the same door with no scope sends the layout where it always went — the home page, handed the whole message", async () => {
  // THE UNSCOPED ANSWER IS UNCHANGED, which is what keeps every earlier door
  // case honest: a lane with no scope runs where the router's page or the home
  // page sends it, on the whole message.
  const r = await drive({ routed: { layer: "picture", remove: true }, ask: PHOTO_VISIT_ASK,
    answers: { [PICK]: { additional: ["shape"] }, write_tweak: visitWriter, [PICTURE_TOOL.name]: REMOVE_BOULE } });
  const writes = r.sent.filter((q) => q.tool === "write_tweak").map((q) => writerAsked(q.args));
  assert.deepEqual(writes, [{ path: "index.tsx", instruction: PHOTO_VISIT_ASK }], "unscoped: what the writer was handed");
  assert.equal(page(r, "visit.tsx"), VISIT_SRC, "unscoped: the Visit page moved");
});

// ── 4. ORDINARY MENU AND PHOTO REQUESTS TRIGGER NOTHING UNRELATED ────────────

test("CONTROL: nothing asked beside the menu removal — the router's own menu rung runs alone", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU, answers: { [PICK]: { additional: [] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "nothing else");
  assertDoorAsked(r, "nav", ASK_MENU, "nothing else");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "nav", routed: [], additional: [] }]);
  assert.deepEqual(r.reply.lanes, []);
  assert.deepEqual(r.debits, [3]);
});

test("CONTROL: the router's own lane tied to the routed change (action on nav) — that change once, and named on the reply", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU, answers: { [PICK]: { routed: ["action"], additional: [] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assert.deepEqual(r.reply.lanes, ["action"], "the lane the picker named for the routed change is not on the reply");
  assertOnlyGalleryLeft(r, "action");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "nav", routed: ["action"], additional: [] }]);
  assert.deepEqual(r.debits, [3]);
});

test("CONTROL: `nav` with no removal never opens the door — straight to the menu rung, no picker", async () => {
  const r = await drive({ routed: { layer: "nav" }, ask: ASK_MENU, answers: { write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, ["write_nav"]);
  assertOnlyGalleryLeft(r, "no remove");
  assert.deepEqual(r.debits, [2]);
});

test("a page deletion the picker ties to the routed change is not work: taking a link out never deletes the page", async () => {
  // Folded into the `pages` verb before the first fix, this sent "Take Gallery
  // out of the menu." to the page rung's REMOVAL of /gallery. A page verb names
  // only work asked beside the routed change.
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { routed: ["pages"], additional: [], removes: ["pages"], pageVerb: "remove", pageName: "/gallery" }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "pages");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "nav", routed: ["pages"], additional: [] }]);
});

test("a lane this route will not remove, tied to the routed change, cannot refuse the router's message", async () => {
  // The LOOK door's refusal is unchanged (below); here the removal the picker
  // named belongs to the router's own step, which has its own verb.
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { routed: ["backend"], additional: [], removes: ["backend"] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "backend");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "nav", routed: ["backend"], additional: [] }]);
});

// ── THE LOOK DOOR IS UNTOUCHED ────────────────────────────────────────────────

test("CONTROL: an ordinary look request still runs the lane the picker chose, and is asked the ordinary question", async () => {
  const ask = "Make the menu open when you hover over it.";
  const r = await drive({ routed: { layer: "look" }, ask, answers: { [PICK]: { fields: ["behavior"] }, edit_site: {} } });
  assert.deepEqual(r.models, [PICK, "edit_site"], "the look door's pick was overruled");
  assert.equal(r.reply.error, "no-change");
  assert.equal(r.builds.length, 0);
  assert.deepEqual(doorMarks(r), []);
  const q = pickSent(r);
  assert.deepEqual(Object.keys(q.tools[0].input_schema.properties), ["fields", "removes", "scopes", "pageVerb", "pageName", "pageTo"]);
  assert.ok(!q.messages[0].content.includes("ALREADY BEEN ROUTED"), "the look door was told something was routed");
  assert.ok(q.messages[0].content.endsWith("Their message:\n" + ask));
});

test("CONTROL: a genuine removal refusal on the look door is unchanged", async () => {
  const r = await drive({ routed: { layer: "look", remove: true }, ask: "Delete the orders database.",
    answers: { [PICK]: { fields: ["backend"], removes: ["backend"] } } });
  assert.equal(r.status, 422);
  assert.equal(r.reply.error, "not-removable");
  assert.deepEqual(r.models, [PICK]);
  assert.equal(r.builds.length, 0);
  assert.deepEqual(r.debits, []);
  for (const p of PAGES) assert.equal(page(r, p.path), p.source);
  assert.deepEqual(doorMarks(r), []);
});

// ── THE PICTURE DOOR, THE OTHER HALF OF THE SAME CONDITION ───────────────────

for (const [name, picker] of [
  ["nothing else", { additional: [] }],
  ["images tied to the routed change", { routed: ["images"], additional: [] }],
  ["behavior tied to the routed change", { routed: ["behavior"], additional: [] }],
  ["shape tied to the routed change", { routed: ["shape"], additional: [] }],
]) {
  test(`picture + remove, ${name}: the picture rung takes that photograph off and nothing else`, async () => {
    // `shape` tied to the routed change is the picker reading a layout into the
    // photo removal — it says so itself, so the supplied layout never runs.
    const r = await drive({ routed: { layer: "picture", remove: true }, ask: PHOTO_ASK,
      answers: { [PICK]: picker, edit_site: {}, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: REMOVE_BOULE } });
    assert.deepEqual(r.models, [PICK, PICTURE_TOOL.name], "the rungs called");
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    assert.equal(r.reply.layer, "picture");
    assert.equal(r.builds.length, 1);
    const home = page(r, "index.tsx");
    assert.ok(!home.includes(BOULE_SRC) && !home.includes('alt="' + BOULE + '"'), "the boule photograph is still on the page");
    assert.ok(home.includes('alt="' + FRONT + '"') && home.includes("64eee06cebae214308ea0142e5163286.jpg"), "the other photograph went too");
    assert.equal(home, ORIG["index.tsx"].replace(BOULE_LINES, ""), "more than the one photograph changed");
    for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, p.path + " changed");
    assert.ok(r.said.text.startsWith("✅ Took “" + BOULE + "” off the page."), r.said.text);
    assertDoorAsked(r, "picture", PHOTO_ASK, name);
    assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "picture", routed: picker.routed || [], additional: [] }]);
    assert.deepEqual(r.debits, [3]);
  });
}

// ── TAKING A PHOTOGRAPH OFF VERSUS KEEPING ITS SPACE, THROUGH THE ROUTE (2026-09-29) ─
//
// The picture tool's only removal used to EMPTY the photograph's `src`, so "take
// the photo off" published the kit's grey placeholder, captioned with the
// photo's description, in the photo's space — reproduced on this fixture and
// compiled with the real build before the correction. Now `remove` takes the
// photograph's element off (found in the page's syntax tree at its slot's own
// offset), `clear` keeps the space and is asked for by name, a contradiction is
// refused by name while the rest proceeds, and the reply's undo hint reads the
// picture step's own count of photographs taken off. Every model answer below
// is supplied; the route, the parser and the browser's composer are real.

const COUNTER = "The counter and morning board at Harbour Loaf";
const COUNTER_LINES = ownLinesOf(ORIG["visit.tsx"], "<SafeImage");
const REMOVE_COUNTER = { pictures: [{ page: "visit.tsx", alt: COUNTER, remove: true }] };
const COUNTER_ASK = "Take the photograph of the counter and the morning board off the Visit page.";
const TAKEN_OFF = "If that was not what you wanted, roll back to the previous build in Cloud → Versions.";
// TEST 7'S SENTENCE, word for word, and the two pages it must leave.
const T7_PHOTO_WORDS = "Take the photograph of the counter and the morning board off the Visit page";
const T7_HOME_WORDS = 'on the home page only, put the "Order a loaf for collection" band above "Fed every morning since we opened"';
const T7_ASK = T7_PHOTO_WORDS + ". Then, " + T7_HOME_WORDS + ".";
const T7_VISIT = ORIG["visit.tsx"].replace(COUNTER_LINES, "");
/** A writer that moves the home band only when shown the home page and told to. */
const homeWriter = (args) => {
  const { instruction, path } = writerAsked(args);
  return { source: path === "index.tsx" && instruction.includes("Fed every morning since we opened") ? MOVED : ORIG[path] };
};

test("THE UNDO HINT READS THE PICTURE STEP'S OWN COUNT — never `photosRemoved` against `photos`, in either direction", () => {
  // Found by the mutation sweep: every case above has the two counts agree
  // with the explicit one, so inferring it from them went unseen.
  const said = (counts) => editBrowserReply({ ok: true, layer: "look", msg: "✅ Updated the look.", cost: 1, ...counts }, true, ROUTED).text;
  const LOST = "✅ Updated the look. One photograph is no longer on the site. ";
  // A PHOTOGRAPH GONE WITHOUT THE PICTURE STEP TAKING IT OFF (a rewrite dropped
  // it, no frame left): the counts say "more gone than framed", and the hint is
  // still the one that fits a photograph the picture step did not remove.
  assert.equal(said({ photosRemoved: 1, photos: 0 }), LOST + "If that was not what you wanted, say “put the photo back”.");
  // TAKEN OFF, WITH AN EMPTY FRAME ADDED ELSEWHERE IN THE SAME MESSAGE: the
  // counts are equal, and the removal is still the picture step's.
  assert.equal(said({ photosRemoved: 1, photos: 1, photosTakenOff: 1 }),
    LOST + TAKEN_OFF + " There is a space for a photo — upload yours in the Data panel and it’ll fill in.");
  // CANNOT-TELL IS NOT A COUNT.
  assert.equal(said({ photosRemoved: 1, photos: 0, photosTakenOff: "1" }), said({ photosRemoved: 1, photos: 0 }));
});

test("the fixture: the counter is the Visit page's one photograph, on lines of its own, and Test 7's two pages are the recorded ones", () => {
  assert.ok(COUNTER_LINES.includes('alt="' + COUNTER + '"') && COUNTER_LINES.includes("d5d591527a2bed3836f73b5e74e75565.jpg"));
  assert.ok(!T7_VISIT.includes("d5d591527a2bed3836f73b5e74e75565.jpg") && T7_VISIT.includes("<LocationCard"));
  assert.equal(T7_ASK.length, 191);
  assert.equal(sha(T7_ASK), "9e4dcb228ce8c147d571598df88ce192f0af1a044eee25528ac50091ce5e595f", "Test 7's sentence changed");
  // THE PAGES TEST 7 NOW EXPECTS: the counter's element gone, the home band moved.
  assert.deepEqual([T7_VISIT.length, sha(T7_VISIT)], [3801, "263dd01eaaa4345c543038d8df75ab065d612a5ecd965cb1c8d1c8672958f5c6"]);
  assert.deepEqual([MOVED.length, sha(MOVED)], [2439, "0b64985c87e0ab1f402660fe830481b79ea5c976ac5a970130a5d41b3669e5ec"]);
});

for (const mode of ["sync", "job"]) {
  test(`TAKE IT OFF (${mode}): the counter's element comes off the Visit page, nothing else moves, and the reply carries the removal`, async () => {
    const r = await drive({ mode, routed: { layer: "picture", remove: true, page: "/visit" }, ask: COUNTER_ASK,
      answers: { [PICK]: { routed: ["images"], additional: [] }, [PICTURE_TOOL.name]: REMOVE_COUNTER } });
    const label = "take it off " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(page(r, "visit.tsx"), T7_VISIT, label + ": the Visit page is not the fixture less the counter's element");
    for (const p of ["index.tsx", "order.tsx", "starter.tsx", "gallery.tsx"]) assert.equal(page(r, p), ORIG[p], label + ": " + p + " changed");
    assert.equal(r.builds.length, 1, label + ": one compile");
    // THE EXPLICIT RESULT, and the two comparisons beside it: the photograph is
    // no longer shown, and it left no empty frame behind.
    assert.equal(r.reply.photosTakenOff, 1, label + ": the removal is not carried on the reply");
    assert.equal(r.reply.photosRemoved, 1, label);
    assert.equal(r.reply.photos, 0, label + ": an empty frame was reported");
    assert.equal(r.said.text, "✅ Took “" + COUNTER + "” off the page. One photograph is no longer on the site. " + TAKEN_OFF, label + ": the screen");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label);
  });

  test(`TAKE IT OFF, ROUTED WITHOUT THE ROUTER'S \`remove\` (${mode}): the picture rung called directly carries the same removal and the same result`, async () => {
    // No door, no picker: the router answered `picture` alone and the picture
    // model answered `remove`. The explicit count must not depend on which way in.
    const r = await drive({ mode, routed: { layer: "picture", page: "/visit" }, ask: COUNTER_ASK,
      answers: { [PICTURE_TOOL.name]: REMOVE_COUNTER } });
    const label = "direct " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICTURE_TOOL.name], label + ": the rungs called");
    assert.equal(page(r, "visit.tsx"), T7_VISIT, label + ": the Visit page is not the fixture less the counter's element");
    for (const p of ["index.tsx", "order.tsx", "starter.tsx", "gallery.tsx"]) assert.equal(page(r, p), ORIG[p], label + ": " + p + " changed");
    assert.equal(r.reply.photosTakenOff, 1, label + ": the removal is not carried on the reply");
    assert.equal(r.said.text, "✅ Took “" + COUNTER + "” off the page. One photograph is no longer on the site. " + TAKEN_OFF, label + ": the screen");
  });

  test(`KEEP THE SPACE (${mode}): asked for by name, the photograph goes and its frame stays — exactly as before`, async () => {
    const ask = "Empty the frame of the photo of the counter and the morning board on the Visit page, and keep the space for a new photo.";
    const r = await drive({ mode, routed: { layer: "picture", page: "/visit" }, ask,
      answers: { [PICTURE_TOOL.name]: { pictures: [{ page: "visit.tsx", alt: COUNTER, clear: true }] } } });
    const label = "keep the space " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(page(r, "visit.tsx"), ORIG["visit.tsx"].replace('src="/u/fold-lane-bakery/d5d591527a2bed3836f73b5e74e75565.jpg"', 'src=""'), label + ": not exactly the emptied frame");
    for (const p of ["index.tsx", "order.tsx", "starter.tsx", "gallery.tsx"]) assert.equal(page(r, p), ORIG[p], label + ": " + p + " changed");
    assert.equal(r.reply.photosTakenOff, undefined, label + ": a kept space was reported as taken off");
    assert.equal(r.reply.photos, 1, label + ": the frame it left is not reported");
    assert.equal(r.said.text, "✅ Took the picture off “" + COUNTER + "”. One photograph is no longer on the site. If that was not what you wanted, say “put the photo back”. There is a space for a photo — upload yours in the Data panel and it’ll fill in.", label + ": the screen");
  });

  test(`A CONTRADICTION IS REFUSED BY NAME (${mode}), and the valid change beside it still ships`, async () => {
    const r = await drive({ mode, routed: { layer: "picture" }, ask: "Take the boule photo off and keep its space, and show the bottom of the front photo.",
      answers: { [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: BOULE, remove: true, clear: true }, { page: "index.tsx", alt: FRONT, focus: "bottom" }] } } });
    const label = "conflict " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    // THE BOULE UNTOUCHED, THE FRONT REFRAMED — and nothing else.
    assert.equal(page(r, "index.tsx"), ORIG["index.tsx"].replace('<SafeImage\n          src="/u/fold-lane-bakery/64eee06cebae214308ea0142e5163286.jpg"', '<SafeImage focus="bottom"\n          src="/u/fold-lane-bakery/64eee06cebae214308ea0142e5163286.jpg"'), label + ": the home page");
    assert.equal(r.reply.photosTakenOff, undefined, label);
    assert.equal(r.said.text, "✅ Moved “" + FRONT + "” to show the bottom. I got conflicting instructions for “" + BOULE + "” and left it as it was — say whether to take it off, keep its space empty, or put another photo there.", label + ": the screen");
  });

  test(`A PHOTOGRAPH WRITTEN INSIDE CODE IS REFUSED (${mode}): nothing is cut, cleared or widened, and nothing is published`, async () => {
    // A HAND-MADE VARIANT OF THE STORED VISIT PAGE for this boundary alone: the
    // counter rendered under a condition. Taking it off would mean rewriting
    // that code, which the picture step does not do.
    const inCode = ORIG["visit.tsx"].replace(COUNTER_LINES, "            {true && (\n" + COUNTER_LINES + "            )}\n");
    const b = bucket();
    b.store.set("source/" + SLUG + "/pages.json", JSON.stringify(PAGES.map((p) => (p.path === "visit.tsx" ? { ...p, source: inCode } : p))));
    const r = await drive({ mode, site: { b }, routed: { layer: "picture", remove: true, page: "/visit" }, ask: COUNTER_ASK,
      answers: { [PICK]: { routed: ["images"], additional: [] }, [PICTURE_TOOL.name]: REMOVE_COUNTER } });
    const label = "in code " + mode;
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.builds.length, 0, label + ": something was compiled");
    assert.equal(page(r, "visit.tsx"), inCode, label + ": the Visit page changed");
    assert.ok(r.said.text.startsWith("⚠️ I couldn't take “" + COUNTER + "” off on its own — it's part of a bigger block on the page — so I left it as it was. Say “empty that photo” to keep its space, or ask for the block to be taken off."), label + ": " + r.said.text);
  });

  // ── TEST 7'S MIXED TWO-PAGE MESSAGE: the photograph off one page, the band moved on another ──
  for (const [door, routed, pick] of [
    ["look door", { layer: "look", page: "" }, { fields: ["images", "shape"], removes: ["images"], scopes: [{ part: "images", words: T7_PHOTO_WORDS, page: "/visit" }, { part: "shape", page: "/", words: T7_HOME_WORDS }] }],
    ["removal door", { layer: "picture", remove: true, page: "/visit" }, { additional: ["shape"], scopes: [{ part: "shape", page: "/", words: T7_HOME_WORDS }] }],
  ]) {
    test(`MIXED (${mode}, ${door}): the counter comes off the Visit page and the band moves on the home page, each on its own page, in one publish`, async () => {
      const r = await drive({ mode, routed, ask: T7_ASK, answers: { [PICK]: pick, write_tweak: homeWriter, [PICTURE_TOOL.name]: REMOVE_COUNTER } });
      const label = "mixed " + mode + " " + door;
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply.ok, true, label);
      // THE WRITER WAS HANDED THE HOME PAGE AND THE HOME WORDS; THE PICTURE STEP RAN ONCE.
      const writes = r.sent.filter((q) => q.tool === "write_tweak").map((q) => writerAsked(q.args));
      assert.deepEqual(writes, [{ path: "index.tsx", instruction: T7_HOME_WORDS }], label + ": what the writer was handed");
      assert.equal(r.sent.filter((q) => q.tool === PICTURE_TOOL.name).length, 1, label + ": the picture step ran more than once");
      // THE STORED RESULT, EXACTLY: Test 7's two pages, the other three byte for byte.
      assert.equal(page(r, "visit.tsx"), T7_VISIT, label + ": the Visit page is not the counter's removal");
      assert.equal(page(r, "index.tsx"), MOVED, label + ": the home page is not the move");
      for (const p of ["order.tsx", "starter.tsx", "gallery.tsx"]) assert.equal(page(r, p), ORIG[p], label + ": " + p + " changed");
      assert.equal(r.builds.length, 1, label + ": one compile carries both");
      assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
      assert.equal(r.reply.photosTakenOff, 1, label + ": the removal is not carried on the reply");
      assert.equal(r.said.text, "✅ Updated the look. One photograph is no longer on the site. " + TAKEN_OFF, label + ": the screen");
    });
  }
}

// ── 5. A MENU CHANGE BESIDE OTHER WORK, ON THE LOOK DOOR (2026-09-29) ─────────
//
// Owner, 2026-09-29: *"Next, address the known gap where a menu change combined
// with other work routes to look, but its picker has no menu capability. First
// reproduce the gap with supplied model answers through the existing route.
// Then make the smallest general correction, reusing the existing menu editor
// and per-operation scoping where appropriate. Do not hardcode wording, sites,
// or pages, and do not route the entire mixed request into the menu editor."*
//
// THE GAP (Test 7's routing review). The router's instructions make several
// changes in one message one `look` answer, and name "the menu and the button"
// among what `look` works out. On the look door the picker chooses lanes by
// their descriptions, and none described the menu's items: the one lane whose
// rung is the menu editor (`doorLane("nav")`) said it was the header's button
// and "only that button", and `behavior` names a menu only as a control that
// DOES something. By run 47's evidence a real picker reads "Take Gallery out of
// the menu." as `behavior`, whose look step answers nothing, so the menu editor
// never runs (the LIMIT case below reproduces exactly that).
//
// THE CORRECTION IS WHAT THE PICKER IS TOLD, and nothing in the route moved.
// That lane already dispatches to the menu editor, and a scoped answer already
// hands each change's rung only that change's words (`ask`). So the lane that
// runs the menu editor now describes the menu's items as well as the button,
// `behavior` says where a menu's items go, and a message with both changes
// reaches both executors, each with its own words. NO NEW LANE: every lane is
// a field of the design tool (`edit-lanes.test.mjs`), and the removal door needs
// exactly one lane per rung (`doorLane`, pinned above).
//
// SUPPLIED ANSWERS THROUGHOUT. The executors below act only on the words they
// are really handed, so a step given another change's words shows up as a page
// or a menu left as it was. What this proves is what the route does with the
// answer the picker is now told to give — not that a real picker gives it.
const MENU_LANE = doorLane("nav");
const MENU_WORDS = "Take Gallery out of the menu";
const BAND_WORDS = "put the order band above the starter story";
const NAV_ASKED = "\n\nWHAT THEY ASKED FOR:\n";
/** What the menu editor was handed: the words under its own heading, read off its real request. */
function navAsked(args) {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const i = content.indexOf(NAV_ASKED);
  assert.ok(i >= 0 && content.indexOf(NAV_ASKED, i + 1) < 0, "the menu editor's request lost its landmark");
  return content.slice(i + NAV_ASKED.length);
}
/** A menu editor that takes Gallery out only when it is handed the menu words and nothing of the layout. */
const menuEditor = (args) => {
  const said = navAsked(args);
  return said.includes("Gallery") && !said.includes("band") ? NAV_ANSWER : {};
};
/** A page writer that moves the band only when shown the home page and handed the layout words and nothing of the menu. */
const bandWriter = (args) => {
  const { instruction, path } = writerAsked(args);
  return { source: path === "index.tsx" && instruction.includes("order band") && !instruction.includes("Gallery") ? MOVED : ORIG[path] };
};
const MENU_AND_BAND = {
  fields: ["shape", MENU_LANE],
  scopes: [{ part: MENU_LANE, words: MENU_WORDS }, { part: "shape", page: "/", words: BAND_WORDS }],
};
/** Every page's menu is its old menu less Gallery, and nothing outside a menu moved but what `outside` names. */
function assertMenuLessGallery(r, outside, label) {
  for (const p of PAGES) {
    const want = menuOf(p.source).map((items) => items.filter((it) => it.href !== GALLERY.href));
    assert.deepEqual(menuOf(page(r, p.path)), want, label + ": " + p.path + "'s menu is not its old menu less Gallery");
    assert.equal(outsideMenus(page(r, p.path)), outsideMenus(outside[p.path] || p.source), label + ": " + p.path + " changed outside its menu");
  }
}
/** Every page's menu is exactly what it was. */
function assertMenusKept(r, label) {
  for (const p of PAGES) assert.deepEqual(menuOf(page(r, p.path)), menuOf(p.source), label + ": " + p.path + "'s menu changed");
}

test("THE PICKER IS TOLD WHERE A MENU'S ITEMS GO: the one lane that runs the menu editor claims them, on the look door and on the removal door", () => {
  assert.ok(MENU_LANE, "no single lane runs the menu editor");
  assert.equal(laneLayer(MENU_LANE), "nav");
  const lineOf = (text, f) => text.split("\n").find((l) => l.startsWith('"' + f + '" — ')) || "";
  for (const routed of [null, { layer: "picture", remove: true }]) {
    const q = pickRequest({ message: BAND_ASK, current: "", routed });
    const props = q.tools[0].input_schema.properties;
    const list = (props.fields || props.additional).description;
    const label = routed ? "the removal door" : "the look door";
    const menuLine = lineOf(list, MENU_LANE);
    assert.ok(menuLine.length > 20, label + ": the picker is not shown the menu editor's lane");
    // THE MENU'S ITEMS ARE CLAIMED, and the header's button is still the same lane's.
    assert.match(menuLine, /\bmenu\b/i, label + ": the lane that runs the menu editor does not describe the menu");
    assert.match(menuLine, /\bbutton\b/i, label + ": the lane no longer describes the header's button");
    // AND TAKING ONE OFF MEANS AN ITEM LEAVES THE MENU, with its page left on the site.
    const off = props.removes.description.split("\n").find((l) => l.startsWith("  " + MENU_LANE + " — ")) || "";
    assert.match(off, /\bmenu\b/i, label + ": taking this lane's part off does not say what happens to a menu item");
    // THE NEIGHBOUR STILL SAYS WHERE ITS BORDER IS.
    assert.ok(lineOf(list, "behavior").includes("`" + MENU_LANE + "`"), label + ": `behavior` does not name the lane a menu's items go to");
  }
});

for (const mode of ["sync", "job"]) {
  for (const [name, extra] of [["", {}], [", marked as a removal", { removes: [MENU_LANE] }]]) {
    test(`LOOK DOOR, MENU + LAYOUT (${mode}${name}): the menu editor is handed the menu words and the page writer the layout words; both ship in one publish and nothing else moves`, async () => {
      const r = await drive({ mode, routed: { layer: "look" }, ask: BAND_ASK,
        answers: { [PICK]: { ...MENU_AND_BAND, ...extra }, write_tweak: bandWriter, write_nav: menuEditor } });
      const label = "look menu + layout " + mode + name;
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
      assert.deepEqual(r.models, [PICK, "write_tweak", "write_nav"], label + ": the executors called");
      // EACH EXECUTOR WAS HANDED ITS OWN WORDS AND NOTHING ELSE OF THE MESSAGE.
      assert.deepEqual(r.sent.filter((q) => q.tool === "write_nav").map((q) => navAsked(q.args)), [MENU_WORDS], label + ": what the menu editor was handed");
      assert.deepEqual(r.sent.filter((q) => q.tool === "write_tweak").map((q) => writerAsked(q.args)), [{ instruction: BAND_WORDS, path: "index.tsx" }], label + ": what the page writer was handed");
      assert.deepEqual(r.reply.layers, ["page", "nav"], label + ": layers");
      assert.deepEqual(r.reply.lanes, ["shape", MENU_LANE], label + ": lanes");
      assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
      assert.equal(r.builds.length, 1, label + ": one compile carries both");
      // GALLERY LEAVES EVERY COPY OF THE MENU; OUTSIDE THE MENUS ONLY THE HOME PAGE'S LAYOUT MOVED.
      assertMenuLessGallery(r, { "index.tsx": MOVED }, label);
      assertOthersKept(r, label);
      // THE SCREEN NAMES NEITHER CHANGE: review #9, a multi-step look reply
      // naming only the look, kept separate by the owner.
      assert.equal(r.said.text, "✅ Updated the look.", label + ": the screen");
      assertCharged(r, mode, [3, 2], label);
    });
  }
}

for (const mode of ["sync", "job"]) {
  test(`THE GAP, REPRODUCED, AND THE LIMIT (${mode}): a picker that reads the menu change as \`behavior\` — run 47's reading — sends it to the look step, and the menu editor never runs`, async () => {
    // ⚠ STATED, NOT PAPERED OVER, as on the removal door above: the route
    // honours the lanes the picker names and reads no English to overrule
    // them. Before the correction this was what the picker was left to answer
    // (no lane described a menu's items); after it, the picker is told the
    // menu's items belong to the lane that runs the menu editor. Whether a real
    // picker now names that lane is not measured here.
    const r = await drive({ mode, routed: { layer: "look" }, ask: BAND_ASK,
      answers: { [PICK]: { fields: ["behavior", "shape"], scopes: [{ part: "behavior", words: MENU_WORDS }, { part: "shape", page: "/", words: BAND_WORDS }] },
        edit_site: {}, write_tweak: bandWriter, write_nav: menuEditor } });
    const label = "behavior reading " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "edit_site", "write_tweak"], label + ": the menu editor ran, or the look step did not");
    assertMenusKept(r, label);
    assert.equal(page(r, "index.tsx"), MOVED, label + ": the layout did not ship on its own");
    for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, label + ": " + p.path + " changed");
    assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error, p.lanes]), [["look", "no-change", ["behavior"]]], label + ": partial");
    assert.equal(r.said.text, "✅ Updated /. ⚠️ I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like.", label + ": the screen");
  });
}

// ── EITHER HALF CAN FAIL, AND THE OTHER STILL SHIPS AND THE REPLY SAYS WHICH ──
//
// The existing partial-success contract, on this pair: a step that cannot run
// is reported in its own words on `partial` beside the step that shipped, and
// the screen names the one that shipped (one step left, so its own sentence).
// Every executor below acts only on the words it is handed.
for (const mode of ["sync", "job"]) {
  for (const [name, navAnswer, partial, cost, charged, said] of [
    ["the menu editor answers nothing it can apply", {},
      [["nav", "no-menu", [MENU_LANE], 2]], 5, [3, 2],
      "✅ Updated /. ⚠️ I couldn't work out what the menu should be. Tell me what to add, take out or move. That part still cost 2 credits."],
    ["the menu editor cannot be reached", undefined,
      [["nav", "send", [MENU_LANE], undefined]], 3, [3],
      "✅ Updated /. ⚠️ I couldn't reach the model that sets the menu — try again in a moment."],
  ]) {
    test(`LOOK DOOR, THE MENU HALF FAILS (${mode}): ${name} — the layout ships alone, every menu is as it was, and the reply says the menu was not changed`, async () => {
      const answers = { [PICK]: MENU_AND_BAND, write_tweak: bandWriter };
      if (navAnswer !== undefined) answers.write_nav = navAnswer;
      const r = await drive({ mode, routed: { layer: "look" }, ask: BAND_ASK, answers });
      const label = "menu half fails " + mode + ": " + name;
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply.ok, true, label);
      assert.deepEqual(r.models, [PICK, "write_tweak", "write_nav"], label + ": the executors called");
      assert.deepEqual(r.reply.layers, ["page"], label + ": what shipped");
      assert.deepEqual(r.reply.partial.map((p) => [p.layer, p.error, p.lanes, p.cost]), partial, label + ": partial");
      assert.equal(r.builds.length, 1, label);
      assertMenusKept(r, label);
      assert.equal(page(r, "index.tsx"), MOVED, label + ": the home page is not exactly the layout");
      for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, label + ": " + p.path + " changed");
      assertOthersKept(r, label);
      assert.equal(r.reply.cost, cost, label + ": cost");
      assertCharged(r, mode, charged, label);
      assert.equal(r.said.text, said, label + ": the screen");
    });
  }

  const NO_PAGE = "Your site doesn't have a /menu page. Its pages are /, /order, /starter, /visit and /gallery. Say which one you meant, or ask me to add a /menu page.";
  const NO_CHANGE = "I read the / page and couldn't find a change to make for that. Say what should look different, or which section you mean.";
  for (const [name, pick, writers, calls, partial, said] of [
    ["the layout names a page the site does not have",
      { fields: ["shape", MENU_LANE], scopes: [{ part: MENU_LANE, words: MENU_WORDS }, { part: "shape", page: "/menu", words: BAND_WORDS }] },
      { write_tweak: bandWriter }, [PICK, "write_nav"], [["page", "no-page", ["shape"]]], NO_PAGE],
    ["the page's writers find nothing to change",
      MENU_AND_BAND,
      { write_tweak: { cannot: "That needs the page rewritten." }, write_pages: { pages: [{ path: "index.tsx", source: ORIG["index.tsx"] }] } },
      [PICK, "write_tweak", "write_pages", "write_nav"], [["page", "no-change", ["shape"]]], NO_CHANGE],
  ]) {
    test(`LOOK DOOR, THE LAYOUT HALF FAILS (${mode}): ${name} — Gallery still leaves every menu, nothing else moves, and the reply says the layout was not changed`, async () => {
      const r = await drive({ mode, routed: { layer: "look" }, ask: BAND_ASK, answers: { [PICK]: pick, ...writers, write_nav: menuEditor } });
      const label = "layout half fails " + mode + ": " + name;
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply.ok, true, label);
      assert.deepEqual(r.models, calls, label + ": the executors called");
      assert.deepEqual(r.sent.filter((q) => q.tool === "write_nav").map((q) => navAsked(q.args)), [MENU_WORDS], label + ": what the menu editor was handed");
      assert.equal(r.reply.layer, "nav", label + ": what shipped");
      assert.deepEqual(r.reply.partial.map((p) => [p.layer, p.error, p.lanes]), partial, label + ": partial");
      assert.equal(r.reply.partial[0].unchanged, true, label + ": the failed layout step claims to have written something");
      assert.equal(r.builds.length, 1, label);
      assertMenuLessGallery(r, {}, label);
      assertOthersKept(r, label);
      assertCharged(r, mode, [3], label);
      assert.equal(r.said.text, MENU_SAID + " ⚠️ " + said, label + ": the screen");
    });
  }

  // ── ORDINARY MENU AND BUTTON EDITS ON THE LOOK DOOR STILL WORK ────────────
  test(`LOOK DOOR, THE MENU CHANGE ALONE (${mode}): the menu editor is handed the message's menu words and exactly Gallery leaves every menu`, async () => {
    const r = await drive({ mode, routed: { layer: "look" }, ask: ASK_MENU,
      answers: { [PICK]: { fields: [MENU_LANE], scopes: [{ part: MENU_LANE, words: ASK_MENU }] }, write_nav: menuEditor } });
    const label = "menu alone " + mode;
    assert.deepEqual(r.models, [PICK, "write_nav"], label + ": the executors called");
    assertOnlyGalleryLeft(r, label);
    assertCharged(r, mode, [3], label);
  });

  test(`LOOK DOOR, THE BUTTON CHANGE ALONE (${mode}): the same lane still reaches the button, and every menu and every other link stays`, async () => {
    const ask = "Change the Order a loaf button at the top to say Book a loaf.";
    const BOOK = { label: "Book a loaf", href: "/order" };
    const r = await drive({ mode, routed: { layer: "look" }, ask,
      answers: { [PICK]: { fields: [MENU_LANE], scopes: [{ part: MENU_LANE, words: ask }] },
        write_nav: (args) => (navAsked(args) === ask ? { action: BOOK } : {}) } });
    const label = "button alone " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "write_nav"], label + ": the executors called");
    assert.equal(r.reply.layer, "nav", label);
    assert.deepEqual(r.reply.action, BOOK, label + ": the button");
    assertMenusKept(r, label);
    for (const p of PAGES) {
      const before = p.source;
      const after = page(r, p.path);
      // ONLY THE HEADER'S BUTTON MOVED: the chrome's one `action` entry, on every page that has one.
      assert.equal(after, before.split('action: { label: "Order a loaf", href: "/order" }').join('action: { label: "Book a loaf", href: "/order" }'), label + ": " + p.path + " changed beyond its header button");
    }
    // The band's own "Order a loaf" button is not the header's, and stays.
    assert.ok(page(r, "index.tsx").includes('action={{ label: "Order a loaf", href: "/order" }}'), label + ": the band's button was changed");
    assertOthersKept(r, label);
    assertCharged(r, mode, [3], label);
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   ADDITIONS HANDED TO THE MENU EDITOR (2026-10-02)

   Run 90's A1–A3 asked for a footer link, a menu link and a header button as
   additions. The add-on step hands each to this rung (its `frame` kind), and
   the browser posts that hop with `addition: true`. The rung is then held to
   adding: nothing the frame already has is changed, replaced, reordered or
   taken away (`additionOnly`), and a button asked for beside the one there
   becomes a second button. Driven through the real edit route with the menu
   editor's answer supplied, sync and queued — each beside the SAME answer
   without the flag, which is the edit this rung always made.
   ═════════════════════════════════════════════════════════════════════════ */
const ADD_ORDER = "Add Order to the menu.";
const ADD_CALL = "Add a Call us button at the top that rings 0117 496 0000.";
const ADD_INSTA = "Add our Instagram to the footer: @harbourloaf.";
const CHROME_PAGES = ["index.tsx", "order.tsx", "visit.tsx", "gallery.tsx"];
const ORDER_LINK = { label: "Order", href: "/order" };
const CALL = { label: "Call us", href: "tel:01174960000" };
const BEFORE_MENU = navSlots([PAGES[0]])[0].items.map(({ label, href }) => ({ label, href }));
/** Each page's OWN menu before — they differ: the order and visit pages carry no Gallery. */
const OWN_MENU = Object.fromEntries(CHROME_PAGES.map((f) => [f, navSlots([{ path: f, source: ORIG[f] }])[0].items.map(({ label, href }) => ({ label, href }))]));
const menuOn = (r, path) => {
  const sl = navSlots([{ path, source: page(r, path) }])[0];
  return sl ? sl.items.map(({ label, href }) => ({ label, href })) : null;
};
const buttonOn = (r, path, prop = "action") => (actionSlots([{ path, source: page(r, path) }], prop)[0] || {}).action || null;
/** Everything on a page except one span is what it was. */
function onlySpanMoved(was, now, span) {
  const a = span(was), b = span(now);
  assert.ok(a && b, "the span to compare around was not found");
  return now.slice(0, b.at) + was.slice(a.at, a.to) + now.slice(b.to) === was;
}

test("FRAME ADDITION, the control: the observers read the bakery's frame as it is", () => {
  assert.deepEqual(BEFORE_MENU.map((l) => l.label), ["Today's bake", "The starter", "Visit", "Gallery"]);
  // THE MENUS DIFFER FROM PAGE TO PAGE, which is what makes an addition worth
  // driving here: one list written everywhere would give two pages a Gallery
  // link nobody asked for.
  assert.deepEqual(OWN_MENU["order.tsx"].map((l) => l.label), ["Today's bake", "The starter", "Visit"]);
  assert.deepEqual(OWN_MENU["visit.tsx"].map((l) => l.label), ["Today's bake", "The starter", "Visit"]);
  for (const f of CHROME_PAGES) {
    const one = [{ path: f, source: ORIG[f] }];
    assert.deepEqual((actionSlots(one)[0] || {}).action, { label: "Order a loaf", href: "/order" }, f + ": no button read");
    assert.equal((actionSlots(one, "secondAction")[0] || {}).action, null, f + ": a second button already read");
    assert.equal((chromeListSlots(one, "social")[0] || {}).items, null, f + ": a social list already read");
  }
  assert.equal(navSlots([{ path: "starter.tsx", source: ORIG["starter.tsx"] }]).length, 0, "the starter page carries a frame after all");
});

for (const mode of ["sync", "job"]) {
  test(`FRAME ADDITION (${mode}): a new menu link is added after the items the menu has, and nothing else moves`, async () => {
    const r = await drive({ mode, ask: ADD_ORDER, routed: { layer: "nav", addition: true },
      answers: { write_nav: { links: [ORDER_LINK] } } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    for (const f of CHROME_PAGES) {
      assert.deepEqual(menuOn(r, f), [...OWN_MENU[f], ORDER_LINK], f + ": the menu is not this page's own with Order added at the end");
      assert.deepEqual(buttonOn(r, f), { label: "Order a loaf", href: "/order" }, f + ": the button moved");
      assert.ok(onlySpanMoved(ORIG[f], page(r, f), (src) => { const sl = navSlots([{ path: f, source: src }])[0]; return sl && { at: sl.at, to: sl.to }; }),
        f + ": something beside the menu changed");
    }
    assert.equal(page(r, "starter.tsx"), ORIG["starter.tsx"]);
    assert.match(r.reply.msg, /Added “Order” to the menu on 4 pages, beside the items it had/);
  });

  test(`FRAME ADDITION (${mode}): an answer restating the home page's whole menu gives no page an item it did not have`, async () => {
    // THE DEFECT THIS CLOSES, measured on this fixture before it was fixed: the
    // menu editor writes ONE list to every page, so an addition answered as
    // "the menu, plus Order" gave the order and visit pages a Gallery link —
    // something nobody asked for, on two pages that did not carry it.
    const r = await drive({ mode, ask: ADD_ORDER, routed: { layer: "nav", addition: true },
      answers: { write_nav: { links: [...BEFORE_MENU, ORDER_LINK] } } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    for (const f of CHROME_PAGES) assert.deepEqual(menuOn(r, f), [...OWN_MENU[f], ORDER_LINK], f + ": the menu gained more than Order");
    assert.ok(!menuOn(r, "order.tsx").some((l) => l.href === "/gallery"), "the order page was given a Gallery link");
  });

  test(`FRAME ADDITION (${mode}), the control: the same answer WITHOUT the flag is the menu edit it always was`, async () => {
    const r = await drive({ mode, ask: ADD_ORDER, routed: { layer: "nav" },
      answers: { write_nav: { links: [ORDER_LINK] } } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    assert.deepEqual(menuOn(r, "index.tsx"), [ORDER_LINK], "an ordinary menu edit no longer writes the menu it is given");
  });

  test(`FRAME ADDITION (${mode}): a button asked for beside the one there becomes a second button, and the first stays`, async () => {
    const r = await drive({ mode, ask: ADD_CALL, routed: { layer: "nav", addition: true },
      answers: { write_nav: { action: CALL } } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    const inserted = " secondAction: " + '{ label: "Call us", href: "tel:01174960000" }' + ",";
    for (const f of CHROME_PAGES) {
      assert.deepEqual(buttonOn(r, f), { label: "Order a loaf", href: "/order" }, f + ": the button the site had was replaced");
      assert.deepEqual(buttonOn(r, f, "secondAction"), CALL, f + ": no second button");
      assert.equal(page(r, f).replace(inserted, ""), ORIG[f], f + ": more changed than the second button");
    }
    assert.equal(page(r, "starter.tsx"), ORIG["starter.tsx"]);
    assert.match(r.reply.msg, /second button, “Call us”/);
    assert.match(r.reply.msg, /the button you had stays as it is/);
    assert.deepEqual(r.reply.secondAction, CALL);
    assert.equal(r.reply.action, undefined, "the reply says the main button changed");
  });

  test(`FRAME ADDITION (${mode}), the control: the same button answer WITHOUT the flag replaces the button, as an edit does`, async () => {
    const r = await drive({ mode, ask: ADD_CALL, routed: { layer: "nav" }, answers: { write_nav: { action: CALL } } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    assert.deepEqual(buttonOn(r, "index.tsx"), CALL, "an ordinary button edit no longer changes the button");
    assert.equal(buttonOn(r, "index.tsx", "secondAction"), null);
  });

  test(`FRAME ADDITION (${mode}): a social link is added to the footer of every page, and nothing else moves`, async () => {
    const insta = { network: "instagram", href: "https://instagram.com/harbourloaf" };
    const r = await drive({ mode, ask: ADD_INSTA, routed: { layer: "nav", addition: true },
      answers: { write_nav: { social: [insta] } } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    for (const f of CHROME_PAGES) {
      const one = [{ path: f, source: page(r, f) }];
      assert.deepEqual(chromeListSlots(one, "social")[0].items, [insta], f + ": the footer has no Instagram link");
      assert.deepEqual(menuOn(r, f), OWN_MENU[f], f + ": the menu moved");
      assert.deepEqual(buttonOn(r, f), { label: "Order a loaf", href: "/order" }, f + ": the button moved");
      assert.deepEqual((contactSlots(one)[0] || {}).contact, (contactSlots([{ path: f, source: ORIG[f] }])[0] || {}).contact, f + ": the footer's details moved");
    }
    assert.equal(page(r, "starter.tsx"), ORIG["starter.tsx"]);
    assert.match(r.reply.msg, /Added 1 social link to the footer, beside what it had/);
  });

  test(`FRAME ADDITION (${mode}): an addition's answer that would take or change something is held to adding`, async () => {
    // EVERY WAY AN ANSWER CAN TAKE AWAY, at once: a menu missing three items,
    // the button removed, the frame's arrangement changed, a footer detail
    // rewritten and one cleared, and a link written into a page repointed
    // (the sweep's N-2, 2026-10-02). Added: one menu item and one new detail.
    const answer = {
      links: [{ label: "Today's bake", href: "/" }, ORDER_LINK],
      removeAction: true, layout: { brand: "centre" },
      contact: { hours: "Every day 7–7", address: "", phone: "0117 496 0000" },
      pageLinks: [{ label: "Back to the home page", from: "/", to: "/order" }],
    };
    const r = await drive({ mode, ask: ADD_ORDER, routed: { layer: "nav", addition: true }, answers: { write_nav: answer } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    for (const f of CHROME_PAGES) {
      const one = [{ path: f, source: page(r, f) }];
      assert.deepEqual(menuOn(r, f), [OWN_MENU[f][0], ORDER_LINK, ...OWN_MENU[f].slice(1)], f + ": the menu lost an item, or Order is not where the answer put it");
      assert.deepEqual(buttonOn(r, f), { label: "Order a loaf", href: "/order" }, f + ": the button was taken off");
      assert.equal((chromeObjectSlots(one, "layout")[0] || {}).fields || null, (chromeObjectSlots([{ path: f, source: ORIG[f] }], "layout")[0] || {}).fields || null, f + ": the frame's arrangement changed");
      const c = (contactSlots(one)[0] || {}).contact || {};
      assert.equal(c.hours, "Wed–Sat 8–2, Sun 9–1", f + ": a detail the footer had was rewritten");
      assert.equal(c.address, "Bristol", f + ": a detail the footer had was cleared");
      assert.equal(c.phone, "0117 496 0000", f + ": the new detail was not added");
    }
    // THE LINK IN THE PAGE STILL GOES WHERE IT WENT: an addition repoints
    // nothing. The starter page's is the one link in the copy the menu
    // editor's own reader finds on this site.
    const back = (src) => linkSlots([{ path: "starter.tsx", source: src }]).map((l) => [l.label, l.href]);
    assert.deepEqual(back(ORIG["starter.tsx"]), [["Back to the home page", "/"]], "the observer is alive: the starter page links home");
    assert.deepEqual(back(page(r, "starter.tsx")), [["Back to the home page", "/"]], "an addition repointed a link written into a page");
  });

  test(`FRAME ADDITION (${mode}), the control: the same taking answer WITHOUT the flag takes, as an edit may`, async () => {
    const answer = { links: [{ label: "Today's bake", href: "/" }, ORDER_LINK], removeAction: true };
    const r = await drive({ mode, ask: ADD_ORDER, routed: { layer: "nav" }, answers: { write_nav: answer } });
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    assert.deepEqual(menuOn(r, "index.tsx"), [{ label: "Today's bake", href: "/" }, ORDER_LINK]);
    assert.equal(buttonOn(r, "index.tsx"), null, "an ordinary edit can no longer take the button off");
  });
}
