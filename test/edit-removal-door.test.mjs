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
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool, pickRequest, pickLanes, doorLane, doorDispatch, LANE_FIELDS, laneLayer } from "../builder/site-lanes.mjs";
import { DOOR_LAYERS, layerLine } from "../builder/route-shared.mjs";
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
        const raw = typeof answers[tool] === "function" ? answers[tool](args) : answers[tool];
        const input = tool === "write_tweak" ? tweakInput(raw, args) : raw;
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input }], usage: { input_tokens: 2000, output_tokens: 400 } });
      }
      return new Response("no stub for tool " + tool, { status: 400 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("no stub (test fixture)", { status: 400 });
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
  assert.deepEqual(Object.keys(tool.input_schema.properties), ["routed", "additional", "removes", "scopes", "elsewhere", "pageVerb", "pageName", "pageTo", "question"], label + ": the door's tool");
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
const MENU_SAID = "Updated the menu on 2 pages: Today's bake · The starter · Visit.";

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
    assert.deepEqual(Object.keys(tool.input_schema.properties), ["routed", "additional", "removes", "scopes", "elsewhere", "pageVerb", "pageName", "pageTo", "question"], layer);
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
  assert.deepEqual(Object.keys(look.tools[0].input_schema.properties), ["fields", "removes", "scopes", "elsewhere", "pageVerb", "pageName", "pageTo", "question"]);
  // `scopes` IS REQUIRED SINCE 2026-09-29: each change's own page and words
  // (run 52). The door's `required` above is unchanged — its scopes cover only
  // the work asked beside the routed change, and that list is usually empty.
  assert.deepEqual(look.tools[0].input_schema.required, ["fields", "scopes"]);
  // RE-ANCHORED 2026-10-02 (the owner's review: *"Reconcile contradictory
  // prompts"*): no `minItems` — it obliged a picker that could not tell which
  // part is meant to name one anyway, beside a question field that says to ask.
  assert.equal(look.tools[0].input_schema.properties.fields.minItems, undefined);
  assert.match(look.tools[0].input_schema.properties.fields.description, /name none and ask them \(`question`\) instead of guessing/);
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
  // THE SAME DE-DUPLICATION AND ORDER AS EVERY LANE LIST, AND NO CAP
  // (2026-10-03, the mixed-work fixes): every distinct name, in the caller's
  // order. This kept the first four the model listed and dropped the rest with
  // no word (the audit's MW2).
  assert.deepEqual((await pick("nav", { additional: ["tsx", "css", "css", "shape", "brand", "favicon", "lang"] })).fields, ["css", "brand", "favicon", "lang", "shape", "tsx"]);
  // And every one of those calls was the door's question.
  assert.equal(sent.length, 17);
  for (const req of sent) assert.deepEqual(req.tools[0].input_schema.required, ["additional"]);
  // A message with nothing in it asks nothing and runs nothing.
  const empty = await pickLanes({ send: async () => { throw new Error("called"); } }, { message: "  ", routed: { layer: "nav", remove: true } });
  // RE-ANCHORED 2026-09-29: an answer now says whether it carried scope
  // metadata (`scoped`), and an empty message carries none.
  assert.deepEqual(empty, { fields: [], routed: [], scopes: [], scoped: false, usage: null, failed: false });
});

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
  const said = (counts) => editBrowserReply({ ok: true, layer: "look", msg: "Updated the look.", cost: 1, ...counts }, true, ROUTED).text;
  const LOST = "Updated the look. One photograph is no longer on the site. ";
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

   SINCE 2026-10-04 (run 95's F1) AN ADDITION NAMES ITS ITEMS (`add`) and code
   puts each into every list that lacks it; a whole menu in an addition's
   answer is not read.
   ═════════════════════════════════════════════════════════════════════════ */
const ADD_ORDER = "Add Order to the menu.";
const ADD_CALL = "Add a Call us button at the top that rings 0117 496 0000.";
const ADD_INSTA = "Add our Instagram to the footer: @harbourloaf.";
const CHROME_PAGES = ["index.tsx", "order.tsx", "visit.tsx", "gallery.tsx"];
const ORDER_LINK = { label: "Order", href: "/order" };
/** The addition's own answer for the Order link (`add`, 2026-10-04). */
const ADD_ORDER_LINK = { to: "menu", ...ORDER_LINK };
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

// ── THE REVIEW OF BATCH 2: A REMOVAL AND AN ADDITION PUT OFF BESIDE IT ───────
//
// (2026-10-02, the owner's review of batch 2.) *"ensure newly deferred
// instructions are excluded from every executing step's model input, including
// … removal-door steps that fall back to eRun."*
//
// On this door the router's own step is the removal, and it carries no scope
// words of its own: it runs on what the turn does (`eRun`). When the picker
// names an addition beside it, the look step puts the addition off by its own
// words — and REPRODUCED FIRST on 03189a0d, the picture rung's model was then
// handed the whole message, the code promised for later included, because
// `eRun` was cut before anything was put off. Now every part the look step puts
// off is taken out of `eRun` and of every step's own words before any step
// runs. The picker decided which words are the addition; nothing here reads
// the customer's words to decide it.
const SCENE_DOOR = "add a 3D scene of a loaf turning on the Visit page";
const PHOTO_SCENE_ASK = "Take the photo of the cooling loaf off the home page, and " + SCENE_DOOR + ".";
const DOOR_SCENE_PICK = { routed: ["images"], additional: ["three"], scopes: [{ part: "three", page: "/visit", words: SCENE_DOOR }] };
/** Everything one request carried, as the model stub received it: its system text and its messages. */
const sentText = (q) => JSON.stringify((q && q.args && q.args.system) || "") + JSON.stringify((q && q.args && q.args.messages) || []);

// ── ROUND 2 OF THE RETRY RULE (owner, 2026-10-24): "a task must never fail
//    completely without at least one retry" ─────────────────────────────────
//
// Through the real edit route, sync and job, with supplied answers that are a
// function of the request: the first answer fails the route's own check, the
// retry is the SAME request (same model, same effort, same tools) with the
// model's answer and the reason appended, and the retry's answer is what runs.
// The fail-twice paths are the cases above, whose expected calls now carry
// the retry (look/no-change, page/no-change, picker/scope-unread).
const isAgain = (args) => Array.isArray(args && args.messages) && args.messages.some((m) => m && m.role === "assistant");
const sentOf = (r, tool) => r.sent.filter((q) => q.tool === tool).map((q) => q.args);
/** The retry is the first request with exactly two turns appended; answers the appended turns' text. */
function retriedSame(first, again, label) {
  const { messages: m1, ...rest1 } = first;
  const { messages: m2, ...rest2 } = again;
  assert.deepEqual(rest2, rest1, label + ": the retry changed something besides its messages (model, effort, tools)");
  assert.equal(m2.length, m1.length + 2, label + ": not the answer and the reason appended");
  assert.deepEqual(m2.slice(0, m1.length), m1, label + ": the first request's turns were not kept");
  assert.equal(m2[m1.length].role, "assistant");
  return JSON.stringify(m2.slice(m1.length + 1));
}
