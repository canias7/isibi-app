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
// THE RULE THESE CASES HOLD THE ROUTE TO (corrected 2026-09-28, owner: *"the
// original nav/picture operation cannot be displaced, while independently
// requested work remains executable"*):
//   * the router's own step always runs on its removal door;
//   * a SINGLE lane the picker names on another rung is its reading of the one
//     thing asked, which the router already placed — set aside, and traced;
//   * TWO OR MORE lanes are separate things asked, and each runs as its own
//     step with its own verb, beside the router's.
// The first correction kept only lanes leading back to the router's rung, and
// the owner held it: "take the photo off … and move the opening hours up" lost
// the layout. That case is here now the other way round — both ship.
//
// So every case posts THE ROUTER'S REAL SHAPE: `{layer: "nav", remove: true}`
// for the menu message and `{layer: "page", page: "/gallery", remove: true}` for
// the removal, on run 47's own stored pages (`fixtures/run47/`, checked against
// the hashes the run recorded).
//
// EVERY MODEL ANSWER IS SUPPLIED — the picker's, the menu rung's, the picture
// rung's, the page writer's. What this proves is what the route does with those
// answers: which rung runs, what is published, what is charged and what the
// customer reads. It never proves what a real picker or a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool, doorLane, doorAnswer, doorDispatch, LANE_FIELDS, laneLayer } from "../builder/site-lanes.mjs";
import { DOOR_LAYERS } from "../builder/site-ask.mjs";
import { PICTURE_TOOL } from "../builder/site-picture.mjs";
import { navSlots } from "../builder/site-nav.mjs";
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
  const seen = { models: [], debits: [], rpc: [], traces: [] };
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
      if (Object.hasOwn(answers, tool)) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answers[tool] }], usage: { input_tokens: 2000, output_tokens: 400 } });
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
      builds: c.calls.map((k) => k.body), models: seen.models, debits: seen.debits, rpc: seen.rpc,
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
const doorMarks = (r) => r.events.filter((e) => e && e.p === "door:set-aside");
const MENU_SAID = "✅ Updated the menu on 4 pages: Today's bake · The starter · Visit.";

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
  }
  // Nothing but the gallery page itself still names its address.
  const naming = r.pages.filter((p) => p.path !== "gallery.tsx" && p.source.includes('"/gallery"')).map((p) => p.path);
  assert.deepEqual(naming, [], label + ": a page still links to /gallery");
  assert.equal(r.said.text, MENU_SAID, label + ": the screen");
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
});


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
const CLEAR_BOULE = { pictures: [{ page: "index.tsx", alt: BOULE, clear: true }] };

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

test("the door's own lane, the picker's answer read against the router's, and where the router's step runs", () => {
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

  const EMPTY = { remove: [], refused: [], pages: false };
  // ONE LANE ON ANOTHER RUNG IS SET ASIDE, and what the picker said about it
  // goes with it: a refusal it would have answered, a page removal it would
  // have folded into a verb.
  assert.deepEqual(doorAnswer({ fields: ["behavior"], removes: EMPTY }, "nav"), { fields: [], removes: EMPTY, setAside: ["behavior"] });
  assert.deepEqual(doorAnswer({ fields: ["backend"], removes: { remove: [], refused: [{ field: "backend", why: "x" }], pages: false } }, "nav"),
    { fields: [], removes: EMPTY, setAside: ["backend"] });
  assert.deepEqual(doorAnswer({ fields: ["pages"], removes: { remove: [], refused: [], pages: true } }, "nav"),
    { fields: [], removes: EMPTY, setAside: ["pages"] });
  assert.deepEqual(doorAnswer({ fields: ["shape"], removes: EMPTY }, "picture"), { fields: [], removes: EMPTY, setAside: ["shape"] });
  // ONE LANE LEADING BACK IS THE SAME OPERATION, kept exactly as picked.
  const own = { fields: ["images"], removes: { remove: ["images"], refused: [], pages: false } };
  assert.deepEqual(doorAnswer(own, "picture"), { ...own, setAside: [] });
  // TWO OR MORE ARE SEPARATE THINGS ASKED, kept exactly as picked — whether or
  // not one of them is the router's lane, removals and refusals included.
  const both = { fields: ["shape", "images"], removes: { remove: ["images"], refused: [], pages: false } };
  assert.deepEqual(doorAnswer(both, "picture"), { ...both, setAside: [] });
  const elsewhere = { fields: ["behavior", "shape"], removes: EMPTY };
  assert.deepEqual(doorAnswer(elsewhere, "nav"), { ...elsewhere, setAside: [] });
  // Nothing picked, or nothing readable: nothing to set aside.
  assert.deepEqual(doorAnswer({ fields: [], removes: EMPTY }, "nav"), { fields: [], removes: EMPTY, setAside: [] });
  assert.deepEqual(doorAnswer(null, "nav"), { fields: [], removes: EMPTY, setAside: [] });

  // THE ROUTER'S LANE GOES WHERE IT WOULD HAVE RUN, in the picker's own order.
  assert.deepEqual(doorDispatch([], "action"), ["action"]);
  assert.deepEqual(doorDispatch(["shape"], "images"), ["shape", "images"]);
  assert.deepEqual(doorDispatch(["behavior", "shape", "tsx"], "action"), ["behavior", "shape", "action", "tsx"]);
  // Already picked: the picker's list, untouched. No lane of its own: the same.
  assert.deepEqual(doorDispatch(["shape", "images"], "images"), ["shape", "images"]);
  assert.deepEqual(doorDispatch(["shape"], null), ["shape"]);
});

for (const mode of ["sync", "job"]) {
  // ── 1. RUN 47: GALLERY LEAVES THE MENU, AND ITS PAGE STAYS UNTIL ASKED ─────
  test(`RUN 47 (${mode}): nav + remove with the picker naming behavior alone reaches the menu rung, and only Gallery leaves`, async () => {
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: ASK_MENU,
      answers: { [PICK]: { fields: ["behavior"] }, edit_site: {}, write_nav: NAV_ANSWER } });
    // THE LIVE FAILURE, NAMED: the look step's lane call (`edit_site`) never
    // runs, and the menu rung does.
    assert.deepEqual(r.models, [PICK, "write_nav"], "the rungs called");
    assertOnlyGalleryLeft(r, "run 47 " + mode);
    // The home page keeps its own "Today's bake" link — the menu rung's home
    // rule stops a home page GAINING a link to itself, never forces a loss.
    assert.deepEqual(menuOf(page(r, "index.tsx")), [NAV_ANSWER.links]);
    // What the picker named is set aside and RECORDED, so a trace says why the
    // lane it chose did not run.
    assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["behavior"], layer: "nav" }]);
    assert.deepEqual(r.reply.lanes, [], "the reply names a lane that did not run");
    // Charged once, for the picker and the menu rung together.
    assertCharged(r, mode, [3], "run 47 " + mode);
    if (mode === "job") assert.equal(r.rpc.filter((f) => f === "edit_reserve").length, 1);
  });

  test(`THEN (${mode}): with its only incoming link gone, "Remove the gallery page." removes that page and nothing else`, async () => {
    const r1 = await drive({ mode, routed: { layer: "nav", remove: true }, ask: ASK_MENU,
      answers: { [PICK]: { fields: ["behavior"] }, edit_site: {}, write_nav: NAV_ANSWER } });
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

  // ── 2. A PHOTO REMOVAL AND A LAYOUT CHANGE: BOTH SHIP ─────────────────────
  test(`BOTH (${mode}): the photo comes off and the layout changes, and the layout step deletes nothing`, async () => {
    // The shape the first correction dropped (`shape` beside `images` on the
    // router's picture door). The page writer runs first, in the picker's own
    // order, and is shown the home page with both photographs; the picture rung
    // then takes the one photograph off the page it left.
    const r = await drive({ mode, routed: { layer: "picture", remove: true }, ask: PHOTO_BAND_ASK,
      answers: { [PICK]: { fields: ["images", "shape"], removes: ["images"] }, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: CLEAR_BOULE } });
    const label = "photo + layout " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "write_tweak", PICTURE_TOOL.name], label + ": the rungs called");
    assert.deepEqual(r.reply.layers, ["page", "picture"], label + ": layers");
    assert.deepEqual(r.reply.lanes, ["shape", "images"], label + ": lanes");
    assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
    assert.equal(r.builds.length, 1, label + ": one compile carries both");
    // EXACTLY BOTH CHANGES: the moved layout, with that one photograph's `src`
    // emptied and every other character where the layout put it.
    assert.equal(page(r, "index.tsx"), MOVED.replace(BOULE_SRC, 'src=""'), label + ": the home page is not the layout plus the removal");
    assert.ok(page(r, "index.tsx").includes('alt="' + FRONT + '"') && page(r, "index.tsx").includes("64eee06cebae214308ea0142e5163286.jpg"), label + ": the other photograph went too");
    // A PHOTO'S REMOVAL NEVER MAKES THE LAYOUT STEP DELETE ITS PAGE: every page
    // is still there, and every other page is byte for byte what it was.
    assertOthersKept(r, label);
    for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, label + ": " + p.path + " changed");
    assert.deepEqual(doorMarks(r), [], label + ": something was set aside");
    assert.equal(r.said.text, "✅ Updated the look. One photograph is no longer on the site. If that was not what you wanted, say “put the photo back”. There is a space for a photo — upload yours in the Data panel and it’ll fill in.", label + ": the screen");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
    assertCharged(r, mode, [3, 2], label);
  });

  // ── 3. A PHOTO REFUSAL AND A VALID LAYOUT CHANGE: THE LAYOUT SHIPS ────────
  test(`PARTIAL (${mode}): the picture rung finds no such photograph, the layout ships, and the reply says both`, async () => {
    // The picture model answers nothing it can match — the site has no photo of
    // croissants — so the picture step refuses in its own words. The layout is
    // independent work and ships beside that refusal, with the refused step's
    // own charge said. (`edit-page-verb.test.mjs` holds the same shape on a site
    // with no photograph at all, where the picture step makes no model call.)
    const r = await drive({ mode, routed: { layer: "picture", remove: true },
      ask: "Take the photo of the croissants off the home page and put the order band above the starter story.",
      answers: { [PICK]: { fields: ["images", "shape"], removes: ["images"] }, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: { pictures: [] } } });
    const label = "photo refused + layout " + mode;
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "write_tweak", PICTURE_TOOL.name], label + ": the rungs called");
    assert.deepEqual(r.reply.layers, ["page"], label + ": layers");
    assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error, p.cost]), [["picture", "no-match", 2]], label + ": partial");
    assert.equal(r.builds.length, 1);
    assert.equal(page(r, "index.tsx"), MOVED, label + ": the home page is not exactly the layout");
    assertOthersKept(r, label);
    for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, label + ": " + p.path + " changed");
    assert.equal(r.said.text, "✅ Updated /. ⚠️ I couldn't match that to any of the pictures on your site. That part still cost 2 credits.", label + ": the screen");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
    assertCharged(r, mode, [3, 2], label);
  });

  // ── AND THE SAME ON THE MENU'S DOOR ────────────────────────────────────────
  test(`MENU + LAYOUT (${mode}): with the router's lane picked, Gallery leaves the menu and the layout ships`, async () => {
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: BAND_ASK,
      answers: { [PICK]: { fields: ["action", "shape"] }, write_tweak: { source: MOVED }, write_nav: NAV_ANSWER } });
    const label = "menu + layout " + mode;
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "write_tweak", "write_nav"], label + ": the rungs called");
    assert.deepEqual(r.reply.layers, ["page", "nav"], label + ": layers");
    assert.deepEqual(r.reply.lanes, ["shape", "action"], label + ": lanes");
    assert.equal(r.reply.partial, undefined, label + ": " + JSON.stringify(r.reply.partial));
    assert.equal(r.builds.length, 1);
    assert.equal(outsideMenus(page(r, "index.tsx")), outsideMenus(MOVED), label + ": the home page is not the layout outside its menu");
    for (const p of PAGES) {
      const want = menuOf(p.source).map((items) => items.filter((it) => it.href !== GALLERY.href));
      assert.deepEqual(menuOf(page(r, p.path)), want, label + ": " + p.path + "'s menu is not its old menu less Gallery");
      if (p.path !== "index.tsx") assert.equal(outsideMenus(page(r, p.path)), outsideMenus(p.source), label + ": " + p.path + " changed outside its menu");
    }
    assertOthersKept(r, label);
    assert.equal(r.said.text, "✅ Updated the look.", label + ": the screen");
    assertCharged(r, mode, [3, 2], label);
  });

  test(`MENU + LAYOUT, PLACED ELSEWHERE (${mode}): the router's menu step is put among the picker's, and both requested changes ship`, async () => {
    // The likeliest real answer to this two-part message, by run 47's own
    // evidence: the picker placed the menu part on `behavior` and the band on
    // `shape`, and named no lane leading to the menu rung. Two lanes are two
    // things asked, so both run — and the router's menu step runs too, where
    // `action` would have. Without the correction the menu part is lost: the
    // router's step came back only for an empty answer.
    //
    // ⚠ THE LIMIT, STATED AND NOT PAPERED OVER: the misplaced `behavior` lane
    // RUNS here. Its supplied answer is nothing, so the look step says it
    // could not make that change and the screen carries that sentence beside
    // the two changes that shipped. Nothing in the answer tells this lane from
    // one the customer asked for; a real behaviour lane that answered would
    // change the site's stored behaviour list.
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: BAND_ASK,
      answers: { [PICK]: { fields: ["behavior", "shape"] }, edit_site: {}, write_tweak: { source: MOVED }, write_nav: NAV_ANSWER } });
    const label = "menu + layout elsewhere " + mode;
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [PICK, "edit_site", "write_tweak", "write_nav"], label + ": the rungs called");
    assert.deepEqual(r.reply.layers, ["page", "nav"], label + ": the menu rung did not run");
    assert.deepEqual((r.reply.partial || []).map((p) => [p.layer, p.error, p.lanes]), [["look", "no-change", ["behavior"]]], label + ": partial");
    assert.equal(r.builds.length, 1);
    assert.equal(outsideMenus(page(r, "index.tsx")), outsideMenus(MOVED), label + ": the home page is not the layout outside its menu");
    for (const p of PAGES) {
      const want = menuOf(p.source).map((items) => items.filter((it) => it.href !== GALLERY.href));
      assert.deepEqual(menuOf(page(r, p.path)), want, label + ": " + p.path + "'s menu is not its old menu less Gallery");
      if (p.path !== "index.tsx") assert.equal(outsideMenus(page(r, p.path)), outsideMenus(p.source), label + ": " + p.path + " changed outside its menu");
    }
    assertOthersKept(r, label);
    assert.deepEqual(doorMarks(r), [], label + ": two lanes are never set aside");
    assert.equal(r.said.text, "✅ Updated the look. ⚠️ I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like.", label + ": the screen");
    assertCharged(r, mode, [3, 2], label);
  });
}

// ── 4. ORDINARY MENU AND PHOTO REQUESTS TRIGGER NOTHING UNRELATED ────────────

test("CONTROL: the picker naming nothing falls through to the router's own menu rung, as it always did", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU, answers: { [PICK]: { fields: [] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "empty");
  assert.deepEqual(doorMarks(r), [], "nothing was set aside");
  assert.deepEqual(r.debits, [3]);
});

test("CONTROL: the router's own lane alone (action on nav) is kept exactly as picked", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU, answers: { [PICK]: { fields: ["action"] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assert.deepEqual(r.reply.lanes, ["action"], "the compatible lane is not on the reply");
  assertOnlyGalleryLeft(r, "action");
  assert.deepEqual(doorMarks(r), []);
  assert.deepEqual(r.debits, [3]);
});

test("CONTROL: `nav` with no removal never opens the door — straight to the menu rung, no picker", async () => {
  const r = await drive({ routed: { layer: "nav" }, ask: ASK_MENU, answers: { write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, ["write_nav"]);
  assertOnlyGalleryLeft(r, "no remove");
  assert.deepEqual(r.debits, [2]);
});

test("a page removal the picker names alone on the menu's door is set aside: taking a link out never deletes the page", async () => {
  // Folded into the `pages` verb before the fix, this sent "Take Gallery out
  // of the menu." to the page rung's REMOVAL of /gallery.
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { fields: ["pages"], removes: ["pages"], pageVerb: "remove", pageName: "/gallery" }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "pages");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["pages"], layer: "nav" }]);
});

test("a lane this route will not remove, named alone on the menu's door, is set aside — it cannot refuse the router's message", async () => {
  // A single lane is the picker's reading of the one thing asked, which the
  // router placed on the menu. The LOOK door's refusal is unchanged (below).
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { fields: ["backend"], removes: ["backend"] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "backend");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["backend"], layer: "nav" }]);
});

// ── THE LOOK DOOR IS UNTOUCHED ────────────────────────────────────────────────

test("CONTROL: an ordinary look request still runs the lane the picker chose", async () => {
  const r = await drive({ routed: { layer: "look" }, ask: "Make the menu open when you hover over it.",
    answers: { [PICK]: { fields: ["behavior"] }, edit_site: {} } });
  assert.deepEqual(r.models, [PICK, "edit_site"], "the look door's pick was overruled");
  assert.equal(r.reply.error, "no-change");
  assert.equal(r.builds.length, 0);
  assert.deepEqual(doorMarks(r), []);
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
});

// ── THE PICTURE DOOR, THE OTHER HALF OF THE SAME CONDITION ───────────────────

for (const [name, picker] of [["nothing", { fields: [] }], ["images", { fields: ["images"] }], ["behavior", { fields: ["behavior"] }], ["shape", { fields: ["shape"] }]]) {
  test(`picture + remove with the picker naming ${name}: the picture rung takes that photograph off and nothing else`, async () => {
    // `shape` alone is a layout the picker read into a photo removal. A lone
    // lane is set aside, so the supplied layout never runs.
    const r = await drive({ routed: { layer: "picture", remove: true }, ask: PHOTO_ASK,
      answers: { [PICK]: picker, edit_site: {}, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: CLEAR_BOULE } });
    assert.deepEqual(r.models, [PICK, PICTURE_TOOL.name], "the rungs called");
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    assert.equal(r.reply.layer, "picture");
    assert.equal(r.builds.length, 1);
    const home = page(r, "index.tsx");
    assert.ok(home.includes('src=""\n          alt="' + BOULE + '"'), "the boule photograph is still on the page");
    assert.ok(home.includes('alt="' + FRONT + '"') && home.includes("64eee06cebae214308ea0142e5163286.jpg"), "the other photograph went too");
    assert.equal(home.replace('src=""', BOULE_SRC), ORIG["index.tsx"], "more than the one photograph changed");
    for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, p.path + " changed");
    assert.ok(r.said.text.startsWith("✅ Took the picture off “" + BOULE + "”."), r.said.text);
    assert.deepEqual(doorMarks(r).map((e) => e.d), ["behavior", "shape"].includes(name) ? [{ fields: [name], layer: "picture" }] : []);
    assert.deepEqual(r.debits, [3]);
  });
}
