// ── RUN 47, REPRODUCED AND FIXED THROUGH THE REAL EDIT ROUTE (2026-09-28) ─────
//
// Test 5's paid press sent "Take Gallery out of the menu." to fold-lane-bakery.
// The router answered `nav` WITH `remove` — its own instructions say to set the
// flag for "take Pricing out of the menu" — and that flag opens the lane
// picker's door. The picker named `behavior`, the one lane whose hint mentions a
// menu and not one that edits a menu's items; a look step ran it, it answered
// nothing, the route said `look/no-change`, and the menu rung the router chose
// never ran. The free rehearsal had supplied `nav` WITHOUT the flag, so it took
// a path the live run never used.
//
// So every case here posts THE ROUTER'S REAL SHAPE: `{layer: "nav", remove:
// true}` for the menu message and `{layer: "page", page: "/gallery", remove:
// true}` for the removal, on run 47's own stored pages (`fixtures/run47/`,
// checked against the hashes the run recorded).
//
// EVERY MODEL ANSWER IS SUPPLIED — the picker's, the menu rung's, the picture
// rung's. What this proves is what the route does with those answers: which
// rung runs, what is published, what is charged and what the customer reads.
// It never proves what a real picker or a real menu model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool, doorLanes } from "../builder/site-lanes.mjs";
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
const doorMarks = (r) => r.events.filter((e) => e && e.p === "door:dropped");
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

test("doorLanes keeps only a lane that leads to the router's rung, and scopes the removals with it", () => {
  const picked = (fields, removes = { remove: [], refused: [], pages: false }) => ({ fields, removes });
  assert.deepEqual(doorLanes(picked(["behavior"]), "nav"), { fields: [], removes: { remove: [], refused: [], pages: false }, dropped: ["behavior"] });
  assert.deepEqual(doorLanes(picked(["action", "behavior"]), "nav").fields, ["action"]);
  assert.deepEqual(doorLanes(picked(["images", "css"], { remove: ["images"], refused: [], pages: false }), "picture"),
    { fields: ["images"], removes: { remove: ["images"], refused: [], pages: false }, dropped: ["css"] });
  // A refusal and a page removal on a lane that does not lead back are dropped
  // with it: neither may speak for, or act on, a message the router placed.
  const odd = doorLanes(picked(["backend", "pages"], { remove: [], refused: [{ field: "backend", why: "x" }], pages: true }), "nav");
  assert.deepEqual(odd, { fields: [], removes: { remove: [], refused: [], pages: false }, dropped: ["backend", "pages"] });
  // A layer it cannot read keeps NOTHING — compared against `null`, every lane
  // this module acts on itself would match.
  for (const layer of [null, undefined, "", 7]) assert.deepEqual(doorLanes(picked(["css", "behavior"]), layer).fields, []);
  assert.deepEqual(doorLanes(null, "nav").fields, []);
});

for (const mode of ["sync", "job"]) {
  test(`RUN 47 (${mode}): nav + remove with the picker naming behavior now reaches the menu rung, and only Gallery leaves`, async () => {
    const r = await drive({ mode, routed: { layer: "nav", remove: true }, ask: ASK_MENU,
      answers: { [PICK]: { fields: ["behavior"] }, edit_site: {}, write_nav: NAV_ANSWER } });
    // THE LIVE FAILURE, NAMED: the look step's lane call (`edit_site`) never
    // runs, and the menu rung does.
    assert.deepEqual(r.models, [PICK, "write_nav"], "the rungs called");
    assertOnlyGalleryLeft(r, "run 47 " + mode);
    // The home page keeps its own "Today's bake" link — the menu rung's home
    // rule stops a home page GAINING a link to itself, never forces a loss.
    assert.deepEqual(menuOf(page(r, "index.tsx")), [NAV_ANSWER.links]);
    // What the picker named is dropped and RECORDED, so a trace says why the
    // rung it chose did not run.
    assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["behavior"], layer: "nav" }]);
    // Charged once, for the picker and the menu rung together.
    if (mode === "sync") assert.deepEqual(r.debits, [3]);
    else {
      assert.deepEqual(r.debits, []);
      assert.deepEqual(r.row, { state: "done", billing: "finalized", cost: 3 });
      assert.equal(r.rpc.filter((f) => f === "edit_reserve").length, 1);
    }
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
}

// ── COMPATIBLE AND EMPTY SELECTIONS: WHAT ALREADY WORKED STILL DOES ──────────

test("CONTROL: the picker naming nothing falls through to the router's own menu rung, as it always did", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU, answers: { [PICK]: { fields: [] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "empty");
  assert.deepEqual(doorMarks(r), [], "nothing was dropped");
  assert.deepEqual(r.debits, [3]);
});

test("CONTROL: a compatible selection (action on nav) is kept exactly as picked", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU, answers: { [PICK]: { fields: ["action"] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assert.deepEqual(r.reply.lanes, ["action"], "the compatible lane is not on the reply");
  assertOnlyGalleryLeft(r, "action");
  assert.deepEqual(doorMarks(r), []);
});

test("A compatible lane beside an unrelated one: the compatible one runs and the other is dropped, never run", async () => {
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { fields: ["action", "behavior"] }, edit_site: {}, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"], "the unrelated lane still ran");
  assert.deepEqual(r.reply.lanes, ["action"]);
  assertOnlyGalleryLeft(r, "action+behavior");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["behavior"], layer: "nav" }]);
});

test("CONTROL: `nav` with no removal never opens the door — straight to the menu rung, no picker", async () => {
  const r = await drive({ routed: { layer: "nav" }, ask: ASK_MENU, answers: { write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, ["write_nav"]);
  assertOnlyGalleryLeft(r, "no remove");
  assert.deepEqual(r.debits, [2]);
});

// ── WHAT ELSE THE PICKER COULD HAVE SAID ON THE ROUTER'S DOOR ────────────────

test("a page removal the picker names on the menu's door is dropped: taking a link out never deletes the page", async () => {
  // Folded into the `pages` verb before the fix, this sent "Take Gallery out
  // of the menu." to the page rung's REMOVAL of /gallery.
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { fields: ["pages"], removes: ["pages"], pageVerb: "remove", pageName: "/gallery" }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "pages");
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["pages"], layer: "nav" }]);
});

test("a lane this route will not remove, named on the menu's door, is dropped too — it cannot refuse the router's message", async () => {
  // THE CONSEQUENCE, STATED: on the router's own door an unrelated
  // not-removable lane no longer answers `not-removable`; the menu rung runs.
  // The LOOK door's refusal is unchanged (the next control).
  const r = await drive({ routed: { layer: "nav", remove: true }, ask: ASK_MENU,
    answers: { [PICK]: { fields: ["backend"], removes: ["backend"] }, write_nav: NAV_ANSWER } });
  assert.deepEqual(r.models, [PICK, "write_nav"]);
  assertOnlyGalleryLeft(r, "backend");
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

for (const [name, picker] of [["nothing", { fields: [] }], ["images", { fields: ["images"] }], ["behavior", { fields: ["behavior"] }]]) {
  test(`picture + remove with the picker naming ${name}: the picture rung takes that photograph off and nothing else`, async () => {
    const r = await drive({ routed: { layer: "picture", remove: true }, ask: "Take the photo of the cooling loaf off the home page.",
      answers: { [PICK]: picker, edit_site: {}, [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: BOULE, clear: true }] } } });
    assert.deepEqual(r.models, [PICK, PICTURE_TOOL.name], "the rungs called");
    assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
    assert.equal(r.reply.layer, "picture");
    assert.equal(r.builds.length, 1);
    const home = page(r, "index.tsx");
    assert.ok(home.includes('src=""\n          alt="' + BOULE + '"'), "the boule photograph is still on the page");
    assert.ok(home.includes('alt="' + FRONT + '"') && home.includes("64eee06cebae214308ea0142e5163286.jpg"), "the other photograph went too");
    assert.equal(home.replace('src=""', 'src="/u/fold-lane-bakery/8e6bd4818b036cfcd639d1bb5ec6156c.jpg"'), ORIG["index.tsx"], "more than the one photograph changed");
    for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, p.path + " changed");
    assert.ok(r.said.text.startsWith("✅ Took the picture off “" + BOULE + "”."), r.said.text);
    assert.deepEqual(doorMarks(r).map((e) => e.d), name === "behavior" ? [{ fields: ["behavior"], layer: "picture" }] : []);
    assert.deepEqual(r.debits, [3]);
  });
}

test("THE CONSEQUENCE, STATED: a layout lane beside the picture lane on the router's door is dropped — the picture change alone ships", async () => {
  // A message routed `picture` with `remove` that ALSO asks for a layout
  // change: the picker names `images` and `shape`. Until this change the
  // `shape` lane ran the page writer beside the picture step and the layout
  // shipped too (`edit-page-verb.test.mjs`'s picture-door case recorded it).
  // Under the approved rule the picker may only choose lanes that lead back to
  // the router's rung, so the message is handled the way a `picture` route
  // without `remove` always has been: by the picture rung alone. The page
  // writer's answer is supplied and would move the page, so a run of that lane
  // would show here as a model call and a changed page.
  const r = await drive({ routed: { layer: "picture", remove: true },
    ask: "Take the photo of the cooling loaf off the home page and move the opening hours up.",
    answers: {
      [PICK]: { fields: ["images", "shape"], removes: ["images"] },
      write_tweak: { source: ORIG["index.tsx"] + "\n// the opening hours moved up\n" },
      [PICTURE_TOOL.name]: { pictures: [{ page: "index.tsx", alt: BOULE, clear: true }] },
    } });
  assert.deepEqual(r.models, [PICK, PICTURE_TOOL.name], "the page writer ran on the router's removal door");
  assert.equal(r.reply && r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(r.reply.layer, "picture");
  assert.deepEqual(r.reply.lanes, ["images"], "the reply names a lane that did not run");
  assert.equal(r.builds.length, 1);
  const home = page(r, "index.tsx");
  assert.equal(home.replace('src=""', 'src="/u/fold-lane-bakery/8e6bd4818b036cfcd639d1bb5ec6156c.jpg"'), ORIG["index.tsx"], "more than the one photograph changed");
  for (const p of PAGES) if (p.path !== "index.tsx") assert.equal(page(r, p.path), p.source, p.path + " changed");
  assert.ok(r.said.text.startsWith("✅ Took the picture off “" + BOULE + "”."), r.said.text);
  assert.deepEqual(doorMarks(r).map((e) => e.d), [{ fields: ["shape"], layer: "picture" }]);
  assert.deepEqual(r.debits, [3]);
});
