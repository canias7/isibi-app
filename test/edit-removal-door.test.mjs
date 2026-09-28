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
  assert.deepEqual(Object.keys(tool.input_schema.properties), ["routed", "additional", "removes", "pageVerb", "pageName", "pageTo"], label + ": the door's tool");
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
    assert.deepEqual(Object.keys(tool.input_schema.properties), ["routed", "additional", "removes", "pageVerb", "pageName", "pageTo"], layer);
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
  assert.deepEqual(Object.keys(look.tools[0].input_schema.properties), ["fields", "removes", "pageVerb", "pageName", "pageTo"]);
  assert.deepEqual(look.tools[0].input_schema.required, ["fields"]);
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
  assert.deepEqual(empty, { fields: [], routed: [], usage: null, failed: false });
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
        answers: { [PICK]: answer, write_tweak: { source: MOVED }, [PICTURE_TOOL.name]: CLEAR_BOULE } });
      const label = "photo + layout " + mode + " " + JSON.stringify(answer);
      assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
      assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
      // ONE PAGE WRITER, ONE PICTURE RUNG — the router's operation once.
      assert.deepEqual(r.models, [PICK, "write_tweak", PICTURE_TOOL.name], label + ": the rungs called");
      assert.deepEqual(r.reply.layers, ["page", "picture"], label + ": layers");
      assert.deepEqual(r.reply.lanes, lanes, label + ": lanes");
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
      assertDoorAsked(r, "picture", PHOTO_BAND_ASK, label);
      assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "picture", routed: lanes.includes("images") ? ["images"] : [], additional: ["shape"] }], label + ": the lists recorded");
      assert.equal(r.said.text, "✅ Updated the look. One photograph is no longer on the site. If that was not what you wanted, say “put the photo back”. There is a space for a photo — upload yours in the Data panel and it’ll fill in.", label + ": the screen");
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
  assert.deepEqual(Object.keys(q.tools[0].input_schema.properties), ["fields", "removes", "pageVerb", "pageName", "pageTo"]);
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
    assertDoorAsked(r, "picture", PHOTO_ASK, name);
    assert.deepEqual(doorMarks(r).map((e) => e.d), [{ layer: "picture", routed: picker.routed || [], additional: [] }]);
    assert.deepEqual(r.debits, [3]);
  });
}
