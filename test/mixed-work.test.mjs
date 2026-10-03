// MANY DIFFERENT CHANGES FROM ONE MESSAGE, ACROSS EDIT AND ADD-ON — WHAT THE
// BUILDER REALLY DOES TODAY (2026-10-03, the mixed-work audit).
//
// Owner: *"Audit and test the existing implementation end to end, covering
// every supported edit operation and add-on kind, using the actual registered
// capabilities … For every scenario, compare requested operations and targets
// against actual changes, publication, pending work, failures and the final
// customer-visible reply; receiving a successful HTTP response or selecting a
// lane is not sufficient."*
//
// ⚠ WRITTEN TO RECORD BEHAVIOUR, AND CHANGED ON PURPOSE BY THE FIXES. A case
// named "WORKS" holds a capability the code has. Each case named "FINDING MWn"
// held a defect reproduced through the real routes, asserted AS IT HAPPENED;
// the mixed-work fixes (2026-10-03, the owner: *"convert existing tests that
// assert a defect into tests requiring the corrected behavior"*) turned each
// into "FIXED MWn", asserting what the code does now through the same routes.
// The findings, the fixes and the matrix are in
// docs/investigations/mixed-work-audit.md.
//
// EVERY HOP IS THE REAL ONE: the routing route where the case starts there, the
// browser's own `siteEdit`/`siteAddon` body, the real edit and add-on routes —
// synchronously and as a queued job — the one publish, the ledger, and the
// page's own reply reader (`editBrowserReply`, `browserReply`: what main shows
// today, model replies being unmerged) beside the facts a model-written reply
// would be given (`editReplyFacts`, `addonReplyFacts`). The edit cases run on
// the bakery's own five stored pages (`fixtures/run47`: menus on every page, the
// photographs, the Visit and home bands), so a menu, a photo and a section are
// the real ones.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. The router's, the pickers' and every step's
// answers are supplied — each the answer its instructions call for. Whether a
// real model gives it is the real-model batch's to measure (the report's §8).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { T, bucket, withWire, envFor, routeCall, browserPost, postRoute, SITE, SOURCE_KEY, storedLook, freshSlug, userText, question, page as pageSource } from "./fixtures/live-ask.mjs";
import { addon, promptFor, writtenPage, addedTo, compiledPages } from "./fixtures/addon-route.mjs";
import { editBrowserReply, browserReply } from "../scripts/addon-sweep.mjs";
import { editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";
import { navSlots, NAV_TOOL, chromeListSlots, applyChromeList, contactSlots, actionSlots } from "../builder/site-nav.mjs";
import * as PICTURE from "../builder/site-picture.mjs";
import * as LANES from "../builder/site-lanes.mjs";
const { PICTURE_TOOL, imageSlots } = PICTURE;
const { LANE_FIELDS, laneLayer, laneEscalate, laneVerbs, OWN_LANES } = LANES;
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
import { ADD_KINDS, DISPATCHED_ADDS, MAKES_PAGES, BACKEND_ADDS, MAX_ADD_TABLES, MAX_ADD_APIS, MIN_JOB_MINUTES } from "../builder/site-add.mjs";
import { CONFIG_KEY } from "../site-config.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// THE BAKERY, AS IT IS STORED, AND THE CHANGES THE CASES ASK FOR
// ─────────────────────────────────────────────────────────────────────────────

const RUN47 = ["index", "order", "starter", "visit", "gallery"].map((n) => ({
  path: n + ".tsx", source: readFileSync(new URL("./fixtures/run47/" + n + ".before.tsx", import.meta.url), "utf8"),
}));
const ORIG = Object.fromEntries(RUN47.map((p) => [p.path, p.source]));
/** The `<section>` holding a phrase: its first and last character. */
function sectionAt(src, phrase) {
  const i = src.indexOf(phrase);
  assert.ok(i > 0, "the fixture has no “" + phrase + "”");
  return [src.lastIndexOf("<section", i), src.indexOf("</section>", i) + "</section>".length];
}
/** The page with the two sections holding these phrases swapped — the move a page writer makes. */
function swap(src, a, b) {
  const [a0, a1] = sectionAt(src, a);
  const [b0, b1] = sectionAt(src, b);
  const [f0, f1, s0, s1] = a0 < b0 ? [a0, a1, b0, b1] : [b0, b1, a0, a1];
  return src.slice(0, f0) + src.slice(s0, s1) + src.slice(f1, s0) + src.slice(f0, f1) + src.slice(s1);
}
const before = (src, first, second) => src.indexOf(first) >= 0 && src.indexOf(first) < src.indexOf(second);
const HOME_MOVED = swap(ORIG["index.tsx"], "Fed every morning since we opened", "Order a loaf for collection");
const VISIT_MOVED = swap(ORIG["visit.tsx"], "Come to the bakery", "Order a collection so we hold a loaf");
const BOULE = "A sourdough boule cooling after the morning bake";
const NEW_DESC = "Overnight sourdough from a Bristol side street, ready to collect at the counter.";
const NO_GALLERY = { links: [{ label: "Today's bake", href: "/" }, { label: "The starter", href: "/starter" }, { label: "Visit", href: "/visit" }] };
const W = {
  desc: "Change the site's search description to \"" + NEW_DESC + "\"",
  homeMove: "on the home page put the order band above the starter story",
  visitMove: "on the Visit page put the order band above Come to the bakery",
  menu: "take Gallery out of the menu",
  photo: "take the photo of the cooling boule off the home page",
  css: "make the headings a deep green",
};
const CSS = "h1, h2 { color: #14532d; }";
// THE PAGE'S OWN SCREENS FOR THE FIXED CASES, measured off the real composer.
const ROLL_BACK = " If that was not what you wanted, roll back to the previous build in Cloud → Versions.";
const MENU_SAID = "Updated the menu on 2 pages: Today's bake · The starter · Visit.";
const BOULE_SAID = "Took “" + BOULE + "” off the page.";
const MW1_THREE = "✅ Updated /. " + BOULE_SAID + " " + MENU_SAID + ROLL_BACK;
const MW1_FOUR = "✅ Updated the look — the description. Updated /visit. " + BOULE_SAID + " " + MENU_SAID + ROLL_BACK;
/** Every part put off this turn, in order: the router's (`deferred`) and the steps' (`putOff`). */
const MW3_HELD = (b) => [b.deferred, b.putOff].flatMap((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []));
// THE ADD-ON'S PLACEMENT, DECLINE AND SCHEDULE SENTENCES, as the page composes them.
const MW5_QR_UNSHOWN = /I saved the QR code “Wholesale”, but no page shows it yet \(you asked for it on \/\)/;
const MW5_SCENE_UNSHOWN = /I saved the 3D scene, but no page draws it yet \(you asked for it on \/wholesale\)/;
const MW5_QR_SHOWN = /added a QR code captioned “Wholesale” on \//;
const MW5_SCENE_SHOWN = /added a 3D scene on \/wholesale/;
const MW6_DECLINED = /I couldn’t design a connection to an outside service from what you asked, so nothing was made for it/;
const MW7_ADJUSTED = /You asked for often to run every minute, which the platform doesn’t do, so it runs every 15 minutes/;
// …AND THE SAME FACTS, AS A MODEL-WRITTEN REPLY IS GIVEN THEM.
const MW5_QR_FACT = /QR code[^]*“Wholesale”[^]*no page shows it/;
const MW5_SCENE_FACT = /scene[^]*no page (shows|draws) it/i;
const MW6_FACT = /Nothing was made for a connection to an outside service: the builder could not design it/;
const MW7_FACT = /asked to run every minute[^]*runs every 15 minutes/;
const MW2_FIVE = "✅ Updated the look — the description, the design. The stylesheet sets none of the kit's own colour variables, so the site renders on the default palette. Updated /visit. "
  + BOULE_SAID + " " + MENU_SAID + ROLL_BACK;
const PHOTO_OFF = { pictures: [{ page: "index.tsx", alt: BOULE, remove: true }] };

/**
 * ONE MESSAGE THROUGH THE REAL EDIT ROUTE on the bakery's pages — from the
 * routing route when `viaRouter`, otherwise with the router's answer as
 * `routed` — and everything it really did: the stored pages, the look, the
 * menus, the photographs, the publishes, the charges, and both readings of the
 * reply.
 */
async function editRun({ message, routed = { layer: "look" }, answers, mode = "sync", viaRouter = false, pages = RUN47 }) {
  const slug = freshSlug("mixed");
  const store = bucket(slug);
  store.poke(SOURCE_KEY(slug), JSON.stringify(pages));
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
    return await withWire(answers, async (seen) => {
      let d = { intent: "edit", ...routed };
      let route = null;
      if (viaRouter) { route = (await routeCall(worker, envFor(store), { slug, message })).body; d = route; }
      const post = browserPost(SITE(slug), d, message);
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
      const after = JSON.parse(store.raw(SOURCE_KEY(slug)));
      const src = (path) => (after.find((p) => p.path === path) || {}).source;
      const menus = (path) => navSlots([{ path, source: src(path) || "" }]).map((s) => s.items.map((i) => i.label));
      const said = editBrowserReply(r.body, r.status >= 200 && r.status < 300, route || { cost: 2 });
      const facts = editReplyFacts(r.body);
      return {
        route, post, status: r.status, body: r.body, seen, src, menus,
        changed: after.filter((p) => ORIG[p.path] !== undefined ? ORIG[p.path] !== p.source : true).map((p) => p.path).sort(),
        look: storedLook(store, slug), css: JSON.parse(store.raw(CONFIG_KEY(slug)) || "{}").css || "",
        photos: imageSlots(after).map((s) => s.page + ": " + s.alt),
        builds: compiler.calls.filter((c) => String(c.url).includes("/build")).length,
        question: question(store, slug),
        charges: mode === "job" ? seen.rpc.filter((x) => x.fn === "edit_reserve").map((x) => x.args.p_cost) : seen.debits.slice(),
        reply: said.ok ? said.text : assert.fail("the page could not read the answer: " + said.why),
        facts: Array.isArray(facts.facts) ? facts.facts.map((f) => f.text) : assert.fail("no reply facts: " + JSON.stringify(facts)),
      };
    }, { slug });
  } finally { compiler.uninstall(); }
}
/** Nothing in the reply, or in the facts a model reply would be given, names this. */
function unsaid(r, re, what) {
  assert.ok(!re.test(r.reply), what + " is in the page's reply: " + r.reply);
  assert.ok(!r.facts.some((f) => re.test(f)), what + " is in the reply's facts: " + JSON.stringify(r.facts));
}
/** The reply, AND the facts a model reply would be given, both name this. */
function said(r, re, what) {
  assert.ok(re.test(r.reply), what + " is not in the page's reply: " + r.reply);
  assert.ok(r.facts.some((f) => re.test(f)), what + " is not in the reply's facts: " + JSON.stringify(r.facts));
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. WHAT IS REGISTERED, READ FROM THE CODE THE MATRIX IS ABOUT
// ─────────────────────────────────────────────────────────────────────────────

test("THE REGISTERED CAPABILITIES: nine edit layers, twenty-one look lanes — every one picked runs — twelve add-on kinds, and where each lane's work really runs", () => {
  assert.deepEqual(EDIT_LAYERS, ["data", "text", "look", "page", "rules", "picture", "logo", "nav", "rename"]);
  assert.equal(LANE_FIELDS.length, 21);
  // FIXED MW2 (2026-10-03): the four-lane cap is gone, and so is the per-step
  // cap on photographs (MW4); nothing named them silently any more.
  assert.equal(LANES.MAX_LANES, undefined, "the lane cap is back");
  assert.equal(PICTURE.MAX_PICTURE_OPS, undefined, "the photograph cap is back");
  const rung = Object.fromEntries(LANE_FIELDS.map((f) => [f, OWN_LANES.includes(f) ? "look" : laneLayer(f) || (laneEscalate(f) ? "escalate:" + laneEscalate(f) : laneVerbs(f) ? "verbs" : "?")]));
  assert.deepEqual(rung, {
    css: "look", theme: "look", brand: "look", description: "look", wordmark: "look", favicon: "look", lang: "look", langs: "look", behavior: "look", qr: "look",
    purpose: "page", components: "page", shape: "page", three: "page", tsx: "page", images: "picture", action: "nav", backend: "rules", slug: "rename",
    kind: "escalate:build", pages: "verbs",
  });
  assert.deepEqual(ADD_KINDS, ["table", "row", "function", "api", "job", "page", "component", "words", "frame", "qr", "three", "photo"]);
  assert.deepEqual(DISPATCHED_ADDS, ["frame"], "the add-on kind handed to an edit rung moved");
  assert.deepEqual(MAKES_PAGES, ["page", "component"]);
  assert.deepEqual(BACKEND_ADDS, ["table", "function", "api", "job"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. EDIT: ONE KIND OF CHANGE ON SEVERAL PAGES
// ─────────────────────────────────────────────────────────────────────────────

test("WORKS, AND FIXED MW8 — THE SAME KIND OF CHANGE ON TWO PAGES (two layout moves): one page step per page, run in turn, each handed only its own words and its own page, both published together, each billed — and the page's own reply names both pages", async () => {
  const r = await editRun({
    message: "Two layout changes: " + W.homeMove + ", and " + W.visitMove + ".",
    answers: {
      [T.pick]: { fields: ["shape"], scopes: [{ part: "shape", page: "/", words: W.homeMove }, { part: "shape", page: "/visit", words: W.visitMove }] },
      [T.tweak]: (args) => ({ source: userText(args).includes("createFileRoute(\"/visit\")") ? VISIT_MOVED : HOME_MOVED }),
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.seen.calls, [T.pick, T.tweak, T.tweak], "not one picker call and one writer per page, in turn");
  assert.deepEqual(r.seen.writers.map((w) => w.instruction), [W.homeMove, W.visitMove], "a writer was handed the other page's words");
  assert.equal(r.src("index.tsx"), HOME_MOVED);
  assert.equal(r.src("visit.tsx"), VISIT_MOVED);
  assert.deepEqual(r.changed, ["index.tsx", "visit.tsx"], "a page nobody named changed");
  assert.equal(r.builds, 1, "the two moves were not published together");
  assert.deepEqual(r.charges, [1, 1], "each page operation is not billed once");
  assert.deepEqual(r.facts, ["Updated /.", "Updated /visit."], "a model reply would not be told both pages");
  // FIXED MW8: the page's own reply (no model replies) names both pages, where
  // it read "✅ Updated the look."
  assert.equal(r.reply, "✅ Updated / and /visit.");
});

test("WORKS — WORDING ON TWO PAGES IS ONE TEXT STEP: one model call changes both, one publish, one charge, and the reply quotes both", async () => {
  const r = await editRun({
    message: "Change the Visit heading to Find the bakery, and on the home page make the starter headline Fed every single morning since we opened.",
    routed: { layer: "text" },
    answers: {
      [T.text]: (args) => {
        const lines = userText(args).split("\n");
        const id = (path, txt) => Number((lines.find((l) => l.includes("[" + path + "] " + txt)) || "-1.").split(".")[0]);
        return { edits: [{ id: id("visit.tsx", "Come to the bakery"), to: "Find the bakery" }, { id: id("index.tsx", "Fed every morning since we opened"), to: "Fed every single morning since we opened" }] };
      },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.seen.calls, [T.text]);
  assert.ok(r.src("visit.tsx").includes(">Find the bakery<") && r.src("index.tsx").includes("Fed every single morning since we opened"));
  assert.deepEqual(r.changed, ["index.tsx", "visit.tsx"]);
  assert.equal(r.builds, 1);
  assert.deepEqual(r.charges, [1]);
  assert.equal(r.reply, "✅ Updated the wording in 2 places — now “Find the bakery”, “Fed every single morning since we opened”.");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EDIT: DIFFERENT CHANGES ON ONE PAGE, AND ACROSS PAGES
// ─────────────────────────────────────────────────────────────────────────────

test("WORKS, AND FIXED MW1 — THREE DIFFERENT CHANGES ON ONE PAGE (a move, a photograph off, the menu): all three land, in turn, the photo taken off the page the move had already rewritten, in one publish — and the reply names the page, the photo and the menu", async () => {
  const r = await editRun({
    message: W.homeMove + ", " + W.photo + ", and " + W.menu + ".",
    routed: { layer: "look", page: "/" },
    answers: {
      [T.pick]: { fields: ["shape", "images", "action"], scopes: [{ part: "shape", page: "/", words: W.homeMove }, { part: "images", page: "/", words: W.photo }, { part: "action", words: W.menu }] },
      [T.tweak]: { source: HOME_MOVED },
      [PICTURE_TOOL.name]: PHOTO_OFF,
      [NAV_TOOL.name]: NO_GALLERY,
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.seen.calls, [T.pick, T.tweak, PICTURE_TOOL.name, NAV_TOOL.name], "the steps did not run one after another, in the lanes' order");
  const home = r.src("index.tsx");
  // LATER STEPS KEEP EARLIER RESULTS: the photo came off the MOVED page.
  assert.ok(before(home, "Order a loaf for collection", "Fed every morning since we opened"), "the move did not survive the later steps");
  assert.ok(!home.includes(BOULE), "the photograph is still on the home page");
  assert.ok(home.includes("Harbour Loaf on a Bristol side street"), "the other photograph went too");
  assert.deepEqual(r.menus("index.tsx"), [["Today's bake", "The starter", "Visit"]]);
  assert.deepEqual(r.menus("gallery.tsx"), [["Today's bake", "The starter", "Visit"]], "the gallery page's own menu kept the link");
  assert.equal(r.builds, 1, "three steps were not published together");
  assert.deepEqual(r.charges, [1, 1, 1], "each step is not billed once");
  // FIXED MW1: every step that ran is told, each in its own words — where the
  // reply named only "/" and the facts only "Updated /.".
  assert.equal(r.reply, MW1_THREE);
  assert.ok(r.facts.includes("Updated /."), JSON.stringify(r.facts));
  said(r, /boule/i, "the photograph taken off");
  said(r, /menu/i, "the menu change");
  // EACH WITH ITS OWN TARGET: the page rung's page, and the picture and menu
  // steps' own words (they work across the site, so no page is theirs).
  assert.deepEqual((r.body.steps || []).map((st) => [st.layer, st.status, st.page || "", st.words || []]),
    [["page", "done", "/", [W.homeMove]], ["picture", "done", "", [W.photo]], ["nav", "done", "", [W.menu]]],
    "the reply does not carry each step's own result and target");
});

for (const mode of ["sync", "job"]) {
  test("WORKS, AND FIXED MW1 (" + mode + ") — FOUR DIFFERENT CHANGES ACROSS PAGES (the description, a Visit move, a home photo off, the menu): all four land, in turn, in one publish, each step billed — and the reply tells all four, stored and queued alike", async () => {
    const r = await editRun({
      mode,
      message: W.desc + ". Then " + W.menu + ", " + W.visitMove + ", and " + W.photo + ".",
      answers: {
        [T.pick]: { fields: ["description", "shape", "images", "action"], scopes: [
          { part: "description", words: W.desc }, { part: "action", words: W.menu }, { part: "shape", page: "/visit", words: W.visitMove }, { part: "images", page: "/", words: W.photo }] },
        "lane:description": NEW_DESC,
        [T.tweak]: { source: VISIT_MOVED },
        [PICTURE_TOOL.name]: PHOTO_OFF,
        [NAV_TOOL.name]: NO_GALLERY,
      },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    assert.deepEqual(r.seen.calls, [T.pick, T.lane, T.tweak, PICTURE_TOOL.name, NAV_TOOL.name]);
    assert.equal(r.look.description, NEW_DESC);
    assert.equal(r.src("visit.tsx").replace(/\{ label: "Gallery", href: "\/gallery" \},?\s*/g, ""), VISIT_MOVED.replace(/\{ label: "Gallery", href: "\/gallery" \},?\s*/g, ""), "the Visit move did not land");
    assert.ok(!r.src("index.tsx").includes(BOULE), "the home photograph is still there");
    assert.deepEqual(r.menus("index.tsx"), [["Today's bake", "The starter", "Visit"]]);
    assert.equal(r.builds, 1);
    assert.deepEqual(r.charges, [1, 1, 1, 1], "each of the four steps is not billed once");
    // FIXED MW1, AND THROUGH THE QUEUE: the stored reply carries every step's
    // own account (`steps`), so the job's answer says what the sync one says.
    assert.equal(r.reply, MW1_FOUR);
    for (const f of ["Changed the description.", "Updated /visit."]) assert.ok(r.facts.includes(f), JSON.stringify(r.facts));
    said(r, /boule/i, "the photograph taken off");
    said(r, /menu/i, "the menu change");
    assert.deepEqual((r.body.steps || []).map((st) => [st.layer, st.status]), [["look", "done"], ["page", "done"], ["picture", "done"], ["nav", "done"]]);
  });
}

for (const mode of ["sync", "job"]) {
test("FIXED MW2 (" + mode + ") — FIVE DIFFERENT CHANGES, ALL FIVE RUN: the picker names five lanes and every one runs in turn — the menu too — in one publish, each billed, and the reply tells each", async () => {
  const r = await editRun({
    mode,
    message: W.css + ". " + W.desc + ". Then " + W.menu + ", " + W.visitMove + ", and " + W.photo + ".",
    answers: {
      [T.pick]: { fields: ["css", "description", "shape", "images", "action"], scopes: [
        { part: "css", words: W.css }, { part: "description", words: W.desc }, { part: "action", words: W.menu },
        { part: "shape", page: "/visit", words: W.visitMove }, { part: "images", page: "/", words: W.photo }] },
      "lane:css": CSS,
      "lane:description": NEW_DESC,
      [T.tweak]: { source: VISIT_MOVED },
      [PICTURE_TOOL.name]: PHOTO_OFF,
      [NAV_TOOL.name]: NO_GALLERY,
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.body.lanes, ["css", "description", "shape", "images", "action"], "a lane past the fourth was dropped");
  assert.deepEqual(r.seen.calls, [T.pick, T.lane, T.lane, T.tweak, PICTURE_TOOL.name, NAV_TOOL.name], "the five steps did not run one after another");
  assert.equal(r.css, CSS);
  assert.equal(r.look.description, NEW_DESC);
  assert.ok(!r.src("index.tsx").includes(BOULE));
  assert.deepEqual(r.menus("index.tsx"), [["Today's bake", "The starter", "Visit"]], "the menu did not change");
  assert.equal(r.builds, 1, "the five steps were not published together");
  // FOUR STEPS FOR FIVE LANES: the stylesheet and the description are two lanes
  // of one look step, billed once; the page, picture and menu steps once each.
  assert.deepEqual(r.charges, [1, 1, 1, 1], "each step is not billed once");
  assert.equal(r.body.partial, undefined, "a change that ran is listed as not done");
  assert.equal(r.reply, MW2_FIVE);
  said(r, /menu/i, "the menu change");
  said(r, /boule/i, "the photograph taken off");
});
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EDIT: ONE PART FAILS, OR THE ROUTER HOLDS ONE BACK, WHILE THE REST RUNS
// ─────────────────────────────────────────────────────────────────────────────

test("WORKS — ONE STEP FAILS BESIDE TWO THAT WORK: the other two ship in one publish, the failure is named in the reply, and the failed step's model call is billed, said", async () => {
  const r = await editRun({
    message: W.css + ", " + W.visitMove + ", and " + W.menu + ".",
    answers: {
      [T.pick]: { fields: ["css", "shape", "action"], scopes: [{ part: "css", words: W.css }, { part: "shape", page: "/visit", words: W.visitMove }, { part: "action", words: W.menu }] },
      "lane:css": CSS,
      [T.tweak]: { source: VISIT_MOVED },
      [NAV_TOOL.name]: { links: "not a list" },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.css, CSS);
  assert.equal(r.src("visit.tsx"), VISIT_MOVED);
  assert.deepEqual(r.menus("index.tsx"), [["Today's bake", "The starter", "Visit", "Gallery"]], "the failed menu step changed the menu");
  assert.equal(r.builds, 1);
  assert.deepEqual((r.body.partial || []).map((p) => [p.layer, p.error, p.cost]), [["nav", "no-menu", 1]]);
  assert.deepEqual(r.charges, [1, 1, 1]);
  assert.match(r.reply, /I couldn't work out what the menu should be\. Tell me what to add, take out or move\. That part still cost 1 credit\./);
});

for (const mode of ["sync", "job"]) {
  test("WORKS (" + mode + ") — ONE STEP ASKS BESIDE TWO THAT WORK: the other two ship in one publish and are billed, the asking step changes and costs nothing, every step's result is kept with its target, and its question is kept to resume only its own part", async () => {
    const Q = "Which band is the order band — the one about holding a loaf?";
    const r = await editRun({
      mode,
      message: W.css + ", " + W.visitMove + ", and " + W.menu + ".",
      answers: {
        [T.pick]: { fields: ["css", "shape", "action"], scopes: [{ part: "css", words: W.css }, { part: "shape", page: "/visit", words: W.visitMove }, { part: "action", words: W.menu }] },
        "lane:css": CSS,
        // THE QUESTION FIELD IS AN OBJECT (`QUESTION_FIELD`), as a model answers it.
        [T.tweak]: { source: "", question: { text: Q } },
        [NAV_TOOL.name]: NO_GALLERY,
      },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.css, CSS, "the styling did not ship");
    assert.deepEqual(r.menus("index.tsx"), [["Today's bake", "The starter", "Visit"]], "the menu did not change");
    assert.equal(r.src("visit.tsx").replace(/\{ label: "Gallery", href: "\/gallery" \},?\s*/g, ""), ORIG["visit.tsx"].replace(/\{ label: "Gallery", href: "\/gallery" \},?\s*/g, ""), "the page whose step asked was changed");
    assert.equal(r.builds, 1, "the two that worked were not published together");
    assert.deepEqual(r.charges, [1, 1], "not exactly the two steps that worked were billed");
    assert.deepEqual((r.body.steps || []).map((st) => [st.layer, st.status, st.page || ""]), [["look", "done", ""], ["page", "asked", "/visit"], ["nav", "done", ""]],
      "every step's result and target is not kept");
    assert.ok(r.body.clarify && typeof r.body.clarify.id === "string", "the question was not kept: " + JSON.stringify(r.body.clarify));
    assert.equal(r.body.clarify.text, Q);
    said(r, /menu/i, "the menu change");
    assert.ok(r.facts.some((f) => f.includes(Q)), "the question is not in the facts: " + JSON.stringify(r.facts));
  });
}

test("A QUESTION BESIDE A CHANGE WITHHELD FOR A PAGE THE SITE DOES NOT HAVE: the question is kept, and the request its answer resumes holds neither the withheld change's words nor the work that ran", async () => {
  // THE WITHHELD CHANGE CARRIES ITS OWN WORDS SINCE 2026-10-03 (the mixed-work
  // fixes), so the question's remainder can take them out. Before, a withheld
  // step had no words, read as "a step that ran on the whole turn", and the
  // question was not kept at all — said as left alone.
  const Q = "Which band is the order band — the one about holding a loaf?";
  const MENU_PAGE_MOVE = "on the menu page put the prices above the photos";
  const r = await editRun({
    message: W.css + ", " + W.visitMove + ", and " + MENU_PAGE_MOVE + ".",
    answers: {
      [T.pick]: { fields: ["css", "shape"], scopes: [{ part: "css", words: W.css }, { part: "shape", page: "/visit", words: W.visitMove }, { part: "shape", page: "/menu", words: MENU_PAGE_MOVE }] },
      "lane:css": CSS,
      [T.tweak]: { source: "", question: { text: Q } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.css, CSS, "the styling did not ship");
  assert.deepEqual((r.body.partial || []).filter((p) => p.error === "no-page").map((p) => [p.page, p.words]), [["/menu", [MENU_PAGE_MOVE]]], "the withheld change lost its target");
  assert.ok(r.question, "the question was not kept");
  assert.equal(r.question.question.text, Q);
  assert.ok(r.question.request.includes("order band"), "the question's request is not the asking part: " + r.question.request);
  assert.ok(!r.question.request.includes("prices above the photos"), "the withheld change would run again on the answer: " + r.question.request);
  assert.ok(!r.question.request.includes("deep green"), "the work that ran would run again on the answer: " + r.question.request);
});

test("WORKS (BY DESIGN, ACROSS TWO MESSAGES) — A CHANGE AND AN ADDITION IN ONE MESSAGE: the router answers the change and holds the addition back; the change runs, nothing is added, and the reply names the addition to send next", async () => {
  const ADD = "add a page for our wholesale customers";
  const r = await editRun({
    viaRouter: true,
    message: W.desc + " and " + ADD,
    answers: {
      route: { intent: "edit", layer: "look", alsoAsked: ADD },
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: W.desc }] },
      "lane:description": NEW_DESC,
    },
  });
  assert.equal(r.route.alsoAsked, ADD);
  assert.equal(r.post.body.alsoAsked, ADD, "the browser did not carry the held part");
  assert.equal(r.body.ok, true);
  assert.equal(r.look.description, NEW_DESC);
  assert.deepEqual(r.changed, [], "a page was added or changed");
  assert.ok(!r.seen.calls.some((c) => c === T.adds || c === T.design), "the add-on step ran in the same message");
  assert.equal(r.body.deferred, ADD);
  assert.match(r.reply, /I only did one thing this time\. Say “add a page for our wholesale customers” and I’ll do that next\./);
});

test("WORKS — A RULES CHANGE BESIDE A STYLING CHANGE, ON A SITE WITH NO DATABASE: the styling ships, and the rules step's refusal is said beside it, at no cost for that step", async () => {
  const { RULES_TOOL } = await import("../builder/site-rules.mjs");
  const r = await editRun({
    message: "Make the headings a deep green and close the order form.",
    answers: {
      [T.pick]: { fields: ["css", "backend"], scopes: [{ part: "css", words: "Make the headings a deep green" }, { part: "backend", words: "close the order form" }] },
      "lane:css": CSS,
      [RULES_TOOL.name]: { tables: [{ table: "orders", write: "none" }] },
    },
  });
  assert.equal(r.body.ok, true);
  assert.equal(r.css, CSS);
  assert.ok(!r.seen.calls.includes(RULES_TOOL.name), "the rules model was asked with no table to apply to");
  assert.deepEqual((r.body.partial || []).map((p) => p.layer), ["rules"]);
  assert.deepEqual(r.charges, [1], "the refused rules step was billed");
  assert.match(r.reply, /That rule needs a table on your site to apply to — ask me to add one first\./);
});

test("WORKS (BY DESIGN, ACROSS TWO MESSAGES) — AN ADDITION AND A STYLING CHANGE, ANSWERED AS AN ADDITION: the page is added and the styling change is named at the end of the reply, to send next", async () => {
  const HELD = "make the headings darker";
  const r = await addon("mixed-held-" + rnd(), "Add a page for our wholesale customers and " + HELD, {
    kinds: ["page"], publishes: true, sitePages: ["/"], alsoAsked: HELD,
    written: [writtenPage("/wholesale"), addedTo("/", "<p>x</p>")],
    answers: { page: { page: [{ path: "/wholesale", name: "Wholesale", purpose: "sell to cafes", sections: ["intro"], components: ["card"] }] } },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.added, ["wholesale.tsx"]);
  assert.equal(r.body.deferred, HELD);
  const said = addSaid(r);
  assert.match(said.reply, /I only did one thing this time\. Say “make the headings darker” and I’ll do that next\.$/);
  assert.ok(said.facts.some((f) => f.includes("“" + HELD + "”")), JSON.stringify(said.facts));
});

for (const mode of ["sync", "job"]) {
test("FIXED MW3 (" + mode + ") — SEVERAL PARTS THE ANSWER CANNOT MAKE: the router holds one back (`alsoAsked`, a list on a site) and the picker names another no lane here can make (`elsewhere`); neither runs, each is taken out of the steps' words, and the reply names both as left for later", async () => {
  const ADD = "add a page for our wholesale customers";
  const WORDING = "change the Visit heading to Find the bakery";
  const r = await editRun({
    mode,
    viaRouter: true,
    message: W.desc + ", " + WORDING + ", and " + ADD,
    answers: {
      route: { intent: "edit", layer: "look", alsoAsked: ADD },
      // THE PICKER NAMES A LANE FOR THE DESCRIPTION, AND THE WORDING AS A PART NO
      // LANE HERE CAN MAKE — look has no wording lane. That a real picker answers
      // so is the real-model batch's to measure (row MX5); a picker that names
      // it nowhere leaves the code nothing to read, and no keyword rule here
      // guesses at it.
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: W.desc }], elsewhere: [WORDING] },
      "lane:description": NEW_DESC,
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.look.description, NEW_DESC);
  assert.ok(r.src("visit.tsx").includes("Come to the bakery"), "the wording change was made this turn");
  assert.deepEqual(r.seen.lanes.map((l) => [l.field, l.asked]), [["description", W.desc]], "a step was handed a part put off");
  assert.deepEqual(MW3_HELD(r.body), [ADD, WORDING], "the parts put off are not both named: " + JSON.stringify([r.body.deferred, r.body.putOff]));
  assert.equal(r.body.partial, undefined);
  said(r, /Find the bakery/, "the wording change put off");
  said(r, /wholesale/, "the addition put off");
});
}

for (const mode of ["sync", "job"]) {
test("FIXED MW3 (" + mode + ") — TWO PARTS HELD BACK BY THE ROUTER, AS A LIST: both are taken out before anything runs, and both are named", async () => {
  const ADD = "add a page for our wholesale customers";
  const MAP = "add a map to the Visit page";
  const r = await editRun({
    mode,
    viaRouter: true,
    message: W.desc + ", " + ADD + ", and " + MAP,
    answers: {
      route: { intent: "edit", layer: "look", alsoAsked: [ADD, MAP] },
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: W.desc }] },
      "lane:description": NEW_DESC,
    },
  });
  assert.deepEqual(r.route.alsoAsked, [ADD, MAP], "the routing route did not forward both parts");
  assert.deepEqual(r.post.body.alsoAsked, [ADD, MAP], "the browser did not carry both parts");
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.look.description, NEW_DESC);
  assert.deepEqual(r.changed, [], "a page was added or changed");
  assert.equal(r.seen.picks.length, 1, "the picker was not called once");
  assert.ok(!r.seen.picks[0].includes("wholesale") && !r.seen.picks[0].includes("map"), "the picker was shown a part held back: " + r.seen.picks[0]);
  assert.deepEqual(MW3_HELD(r.body), [ADD, MAP]);
  said(r, /wholesale/, "the first part held back");
  said(r, /a map/, "the second part held back");
});
}

for (const mode of ["sync", "job"]) {
  test("FIXED MW4 (" + mode + ") — MORE CHANGES OF ONE KIND THAN A STEP TOOK: nine photographs asked off one page, all nine come off, in one publish and one charge, and the reply names every one", async () => {
    const gallery = pageSource("/gallery", Array.from({ length: 10 }, (_, i) => "<section><img src=\"/u/x/p" + i + ".jpg\" alt=\"Photo number " + i + "\" /></section>").join(""));
    const r = await editRun({
      mode,
      pages: [{ path: "index.tsx", source: ORIG["index.tsx"] }, { path: "gallery.tsx", source: gallery }],
      message: "On the gallery page take off photos 1 to 9.",
      routed: { layer: "picture", page: "/gallery" },
      answers: { [PICTURE_TOOL.name]: { pictures: Array.from({ length: 9 }, (_, i) => ({ page: "gallery.tsx", alt: "Photo number " + (i + 1), remove: true })) } },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    const left = r.photos.filter((p) => p.startsWith("gallery.tsx")).map((p) => p.split(": ")[1]);
    assert.deepEqual(left, ["Photo number 0"], "not exactly the nine asked for came off");
    assert.ok(r.src("index.tsx") === ORIG["index.tsx"], "the home page changed");
    assert.equal(r.builds, 1, "not one publish");
    assert.equal(r.charges.length, 1, "not one charge for the one step");
    for (let i = 1; i <= 9; i++) assert.ok(r.reply.includes("Photo number " + i + "”"), "the reply does not name photo " + i + ": " + r.reply);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. THE FIXES' OWN EDGES: AN ANSWER CUT OFF, PARTS NO STEP HERE CAN MAKE
// ─────────────────────────────────────────────────────────────────────────────
//
// With no count of changes per step, the one bound left on a step's list is
// its answer: one cut off at its ceiling is refused whole and said, never
// applied in part. And a part the picker names as no lane's here (`elsewhere`)
// is put off and said — but only when it is the customer's own words.

for (const mode of ["sync", "job"]) {
  test("THE BOUND LEFT (" + mode + ") — A STEP'S ANSWER CUT OFF AT ITS CEILING IS REFUSED WHOLE: the photographs' list stopped part way changes no photograph, the styling beside it ships, only the styling is billed, and the reply says the cut part changed nothing", async () => {
    const r = await editRun({
      mode,
      message: W.css + ", and " + W.photo + ".",
      answers: {
        [T.pick]: { fields: ["css", "images"], scopes: [{ part: "css", words: W.css }, { part: "images", page: "/", words: W.photo }] },
        "lane:css": CSS,
        [PICTURE_TOOL.name]: { ...PHOTO_OFF, __stop_reason: "max_tokens" },
      },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.css, CSS, "the styling did not ship");
    assert.ok(r.src("index.tsx").includes(BOULE), "a photograph came off from an answer that was cut off");
    assert.deepEqual(r.charges, [1], "not only the styling was billed");
    assert.deepEqual((r.body.partial || []).map((p) => [p.layer, p.truncated === true]), [["picture", true]], "the cut answer is not reported as cut");
    assert.match(r.reply, /cut off before it finished, so none of it was used and nothing there changed/, "the reply does not say the cut part changed nothing: " + r.reply);
    assert.ok(r.facts.some((f) => /cut off before it finished/.test(f)), JSON.stringify(r.facts));
  });

  test("ELSEWHERE ALONE (" + mode + ") — EVERY PART NAMED AS ANOTHER STEP'S: nothing runs, nothing is published or billed, and each part is named as left for later", async () => {
    const ROW = "put the Dark Rye up to £5.60";
    const WORDS = "change the Visit heading to Find the bakery";
    const r = await editRun({
      mode,
      message: ROW + " and " + WORDS + ".",
      answers: { [T.pick]: { fields: [], elsewhere: [ROW, WORDS] } },
    });
    assert.equal(r.body.ok, false, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.error, "elsewhere");
    assert.equal(r.body.cost, 0, "the edit was billed");
    assert.deepEqual(r.seen.calls, [T.pick], "something ran besides the picker");
    assert.deepEqual(r.changed, [], "a page changed");
    assert.equal(r.builds, 0, "something was published");
    assert.deepEqual(r.charges, [], "something was billed");
    assert.deepEqual(MW3_HELD(r.body), [ROW, WORDS], "the parts are not both named as left for later");
    said(r, /Dark Rye/, "the entry left for later");
    said(r, /Find the bakery/, "the wording left for later");
  });

  test("ELSEWHERE, CUT (" + mode + ") — A PART PUT OFF IS TAKEN OUT OF EVERY STEP'S WORDS BEFORE ANYTHING RUNS: a lane whose words held it, and an unscoped lane run on the whole turn, are each asked the rest only", async () => {
    const WORDS = "change the Visit heading to Find the bakery";
    const message = W.css + " and " + WORDS + ".";
    // A SCOPE THAT COPIED TOO MUCH: the lane's own words hold the part put off.
    const scoped = await editRun({
      mode, message,
      answers: { [T.pick]: { fields: ["css"], scopes: [{ part: "css", words: W.css + " and " + WORDS }], elsewhere: [WORDS] }, "lane:css": CSS },
    });
    assert.equal(scoped.body.ok, true, JSON.stringify(scoped.body).slice(0, 300));
    assert.equal(scoped.seen.lanes.length, 1);
    assert.ok(scoped.seen.lanes[0].asked.includes(W.css) && !scoped.seen.lanes[0].asked.includes("Find the bakery"),
      "the lane was handed the part put off: " + JSON.stringify(scoped.seen.lanes[0].asked));
    assert.deepEqual(MW3_HELD(scoped.body), [WORDS]);
    // NO SCOPES AT ALL (the older shape): the lane runs on this turn's sentence, less the part.
    const whole = await editRun({
      mode, message,
      answers: { [T.pick]: { fields: ["css"], elsewhere: [WORDS] }, "lane:css": CSS },
    });
    assert.equal(whole.body.ok, true, JSON.stringify(whole.body).slice(0, 300));
    assert.ok(whole.seen.lanes[0].asked.includes(W.css) && !whole.seen.lanes[0].asked.includes("Find the bakery"),
      "the unscoped lane was handed the part put off: " + JSON.stringify(whole.seen.lanes[0].asked));
    assert.deepEqual(MW3_HELD(whole.body), [WORDS]);
  });

  test("ELSEWHERE, UNREAD (" + mode + ") — A PART THE MESSAGE DOES NOT HOLD WORD FOR WORD IS NOT PUT OFF ON A GUESS: the rest runs, and only the customer's own words are named", async () => {
    const WORDS = "change the Visit heading to Find the bakery";
    const r = await editRun({
      mode,
      message: W.css + ", and " + WORDS + ".",
      answers: {
        [T.pick]: { fields: ["css"], scopes: [{ part: "css", words: W.css }], elsewhere: [WORDS, "rename the bakery to Fold Lane"] },
        "lane:css": CSS,
      },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.css, CSS);
    assert.deepEqual(MW3_HELD(r.body), [WORDS], "a part not in the message was put off: " + JSON.stringify([r.body.deferred, r.body.putOff]));
    unsaid(r, /Fold Lane/, "the part the message does not hold");
    said(r, /Find the bakery/, "the wording left for later");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3c. THE FOOTER AND THE MENU: EVERY ENTRY APPLIED, OR NAMED WITH ITS REASON
// ─────────────────────────────────────────────────────────────────────────────
//
// The owner reproduced it on the mixed-work fixes' review: `readNav` handed
// nine valid small-print links kept eight and returned `dropped: []` — the
// footer's count (8) cut the list before any entry was read. Neither that
// count nor the menu's ten was a technical constraint (the kit renders every
// item), so both are gone (2026-10-03). Each case reads the stored pages and
// both readings of the reply, on the ordinary edit and on the add-on's frame
// hand-off (`fromAddon`, posted as `addition: true`), synchronously and queued.

const CHROME = ["index.tsx", "order.tsx", "visit.tsx", "gallery.tsx"];
const NINE_LEGAL = ["Privacy", "Terms", "Cookies", "Accessibility", "Allergens", "Delivery", "Returns", "Complaints", "Modern slavery"]
  .map((label) => ({ label, href: "https://harbourloaf.example/" + label.toLowerCase().replace(/ /g, "-") }));
const NINE_SOCIAL = ["instagram", "facebook", "tiktok", "x", "youtube", "linkedin", "pinterest", "threads", "mastodon"]
  .map((network) => ({ network, href: "https://" + network + ".example/harbourloaf" }));
const listOn = (r, path, prop) => ((chromeListSlots([{ path, source: r.src(path) }], prop)[0] || {}).items) || null;
const chromeOf = (src, path) => {
  const one = [{ path, source: src }];
  return { menu: (navSlots(one)[0] || {}).items || null, button: (actionSlots(one)[0] || {}).action || null, contact: (contactSlots(one)[0] || {}).contact || null };
};
/** The bakery with three small-print links already in every footer, written by the real list writer. */
const WITH_THREE = applyChromeList(RUN47, "legal", NINE_LEGAL.slice(0, 3)).pages;

for (const mode of ["sync", "job"]) {
  test("FOOTER (" + mode + ") — NINE SMALL-PRINT LINKS AND NINE SOCIAL LINKS IN ONE EDIT: every one is on every footer, nothing else in the frame moves, and the reply names all eighteen", async () => {
    const r = await editRun({
      mode, routed: { layer: "nav" },
      message: "Our footer's small print should be Privacy, Terms, Cookies, Accessibility, Allergens, Delivery, Returns, Complaints and Modern slavery, and our social links Instagram, Facebook, TikTok, X, YouTube, LinkedIn, Pinterest, Threads and Mastodon.",
      answers: { [NAV_TOOL.name]: { legal: NINE_LEGAL, social: NINE_SOCIAL } },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    for (const f of CHROME) {
      assert.deepEqual(listOn(r, f, "legal"), NINE_LEGAL, f + ": the small print is not all nine");
      assert.deepEqual(listOn(r, f, "social"), NINE_SOCIAL, f + ": the social links are not all nine");
      assert.deepEqual(chromeOf(r.src(f), f), chromeOf(ORIG[f], f), f + ": the menu, the button or the contact details moved");
    }
    assert.equal(r.src("starter.tsx"), ORIG["starter.tsx"], "a page with no frame changed");
    assert.equal(r.builds, 1, "not one publish");
    assert.deepEqual(r.body.lists, { legal: 9, social: 9 });
    assert.equal(r.body.dropped, undefined, "an entry was left out of a list with nothing wrong in it");
    for (const it of [...NINE_LEGAL.map((x) => x.label), ...NINE_SOCIAL.map((x) => x.network)]) {
      assert.ok(r.reply.includes(it), "the reply does not name “" + it + "”: " + r.reply);
      assert.ok(r.facts.some((f) => f.includes(it)), "the facts do not name “" + it + "”: " + JSON.stringify(r.facts));
    }
  });

  test("FOOTER (" + mode + ") — AN INVALID ENTRY AMONG VALID ONES: the nine valid links are on every footer, and each refused entry is named with its own reason, never counted", async () => {
    const legal = [...NINE_LEGAL.slice(0, 4), { label: "Opening times", href: "/opening-times" }, { label: "Old terms", href: "http://old.example/terms" },
      ...NINE_LEGAL.slice(4), { label: "", href: "https://harbourloaf.example/blank" }];
    const r = await editRun({
      mode, routed: { layer: "nav" },
      message: "Put these in the small print: Privacy, Terms, Cookies, Accessibility, Opening times, the old terms, Allergens, Delivery, Returns, Complaints and Modern slavery.",
      answers: { [NAV_TOOL.name]: { legal } },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    for (const f of CHROME) assert.deepEqual(listOn(r, f, "legal"), NINE_LEGAL, f + ": the valid nine are not the footer's small print");
    assert.deepEqual((r.body.dropped || []).map((d) => [d.label || "", d.why, d.list]), [
      ["Opening times", "no-such-page", "legal"], ["Old terms", "not-a-path", "legal"], ["", "incomplete", "legal"],
    ], "each refused entry is not kept on the answer with its reason");
    for (const said of [r.reply, r.facts.join(" ")]) {
      assert.match(said, /I left out “Opening times” — there's no \/opening-times page on the site yet\./);
      assert.match(said, /“Old terms” \(a link here goes to a page of this site or a full https:\/\/ address\)/);
      assert.match(said, /“https:\/\/harbourloaf\.example\/blank” \(it had no name or no destination\)/);
      assert.doesNotMatch(said, /\d+ (items|entries) (were|was) not/, "a refused entry was counted rather than named");
    }
  });

  test("FOOTER, THE FRAME HAND-OFF (" + mode + ") — SIX NEW LINKS ADDED BESIDE THREE A FOOTER HAS: all nine on every footer, the three in their place, and the reply names the six it added", async () => {
    const r = await editRun({
      mode, pages: WITH_THREE, routed: { layer: "nav", fromAddon: true },
      message: "Add Accessibility, Allergens, Delivery, Returns, Complaints and Modern slavery to the small print.",
      // THE MODEL RESTATES THE LIST IT WAS SHOWN, as a whole-list field invites:
      // the three the footer has, then the six new ones.
      answers: { [NAV_TOOL.name]: { legal: NINE_LEGAL } },
    });
    assert.equal(r.post.body.addition, true, "the browser did not post the hand-off as an addition");
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    const before = Object.fromEntries(WITH_THREE.map((p) => [p.path, p.source]));
    for (const f of CHROME) {
      assert.deepEqual(listOn(r, f, "legal"), NINE_LEGAL, f + ": the footer does not hold its three and the six added after them");
      assert.deepEqual(chromeOf(r.src(f), f), chromeOf(before[f], f), f + ": the menu, the button or the contact details moved");
    }
    assert.match(r.reply, /Added 6 small-print links \(Accessibility · Allergens · Delivery · Returns · Complaints · Modern slavery\) to the footer, beside what it had/);
    assert.equal(r.body.dropped, undefined, "an entry was left out of an addition with room for all");
  });

  test("LINKS IN THE COPY (" + mode + ") — ONE REPOINTED BESIDE TWO REFUSED: the one changes, and each refused link is named with its own reason, where only the first was said", async () => {
    // A SECOND LINK IN THE STARTER PAGE'S COPY, written as the first is, so one
    // refusal can be for a page the site does not have.
    const back = '      <Link\n        to="/"\n        className="mt-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium"\n      >\n        Back to the home page\n      </Link>\n';
    assert.ok(ORIG["starter.tsx"].includes(back), "the fixture's link is not where this case expects it");
    const pages = RUN47.map((p) => (p.path !== "starter.tsx" ? p : { ...p, source: p.source.replace(back, back + back.replace("Back to the home page", "Shop the bake")) }));
    const r = await editRun({
      mode, pages, routed: { layer: "nav" },
      message: "Point the starter page's back link at the Visit page, and point any Order now link at /order, and the Shop link at /shop.",
      answers: { [NAV_TOOL.name]: { pageLinks: [
        { label: "Back to the home page", from: "/", to: "/visit" },
        { label: "Order now", to: "/order" },
        { label: "Shop the bake", from: "/", to: "/shop" },
      ] } },
    });
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    assert.ok(r.src("starter.tsx").includes('href="/visit"') || r.src("starter.tsx").includes("to=\"/visit\""), "the back link was not repointed");
    assert.deepEqual((r.body.refusedLinks || []).map((x) => [x.label, x.why]), [["Order now", "no-such-link"], ["Shop the bake", "no-such-page"]],
      "each refused link is not kept on the answer with its reason");
    for (const said of [r.reply, r.facts.join(" ")]) {
      assert.match(said, /I couldn't find a link saying “Order now” anywhere on the site\./);
      assert.match(said, /There's no \/shop page on the site yet, so I left “Shop the bake” where it was\./);
    }
  });

  test("MENU (" + mode + ") — TWELVE ITEMS IN ONE EDIT, AND EIGHT ADDED BY THE FRAME HAND-OFF: every item is in the menu, past the old count of ten, and the reply names each", async () => {
    const twelve = [
      { label: "Today's bake", href: "/" }, { label: "The starter", href: "/starter" }, { label: "Visit", href: "/visit" }, { label: "Gallery", href: "/gallery" },
      ...["Bread", "Pastry", "Cakes", "Coffee", "Hampers", "Classes", "Wholesale", "Jobs"].map((label) => ({ label, href: "/#" + label.toLowerCase() })),
    ];
    const edit = await editRun({ mode, routed: { layer: "nav" }, message: "Make the menu: Today's bake, The starter, Visit, Gallery, Bread, Pastry, Cakes, Coffee, Hampers, Classes, Wholesale, Jobs.",
      answers: { [NAV_TOOL.name]: { links: twelve } } });
    assert.equal(edit.body.ok, true, JSON.stringify(edit.body).slice(0, 300));
    assert.deepEqual(edit.menus("index.tsx"), [twelve.map((l) => l.label)], "the home menu is not all twelve");
    assert.equal(edit.body.dropped, undefined, "a menu item past the old ten was left out");
    for (const l of twelve) assert.ok(edit.reply.includes(l.label), "the reply does not name “" + l.label + "”: " + edit.reply);
    const add = await editRun({ mode, routed: { layer: "nav", fromAddon: true }, message: "Add Bread, Pastry, Cakes, Coffee, Hampers, Classes, Wholesale and Jobs to the menu.",
      answers: { [NAV_TOOL.name]: { links: twelve.slice(4) } } });
    assert.equal(add.body.ok, true, JSON.stringify(add.body).slice(0, 300));
    for (const f of CHROME) {
      const own = navSlots([{ path: f, source: ORIG[f] }])[0].items.map((i) => i.label);
      assert.deepEqual(add.menus(f), [[...own, ...twelve.slice(4).map((l) => l.label)]], f + ": the menu is not its own items with all eight added");
    }
    assert.match(add.reply, /Added “Bread”, “Pastry”, “Cakes”, “Coffee”, “Hampers”, “Classes”, “Wholesale”, “Jobs” to the menu on 4 pages, beside the items it had/);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ADD-ON: SEVERAL ADDITIONS, AND ADDITIONS THAT DEPEND ON EACH OTHER
// ─────────────────────────────────────────────────────────────────────────────

const rnd = () => Math.random().toString(16).slice(2, 8);
const TABLE = (name, cols) => ({ table: { name, access: "collect", columns: cols.map(([n, t]) => ({ name: n, type: t })) } });
const ddl = (r) => r.sql.filter((q) => /\b(create|alter)\b/i.test(q) && !/app_user_id|app_team_id|pg_session|_meta|_secrets|_errors|"bookings"/.test(q));
function addSaid(r) {
  const said = browserReply(r.body, r.status >= 200 && r.status < 300);
  assert.ok(said.ok, said.why);
  const f = addonReplyFacts(r.body);
  return { reply: said.text, facts: Array.isArray(f.facts) ? f.facts.map((x) => x.text) : [] };
}

test("WORKS — A TABLE, A FUNCTION THAT READS IT, AN API AND A JOB THAT RUNS THE FUNCTION, FROM ONE MESSAGE: each designer is shown what the ones before it proposed, the database is changed in that order, the job is registered, one publish and one charge, and the reply names all four", async () => {
  const r = await addon("mixed-chain-" + rnd(), "keep a list of orders, count them every morning, and fetch the weather", {
    kinds: ["table", "function", "api", "job"], publishes: true,
    answers: {
      table: { table: [TABLE("orders", [["who", "text"], ["loaves", "integer"]])] },
      function: { function: [{ name: "count_orders", returns: "void", internal: true, body: "BEGIN PERFORM count(*) FROM orders; END;" }] },
      api: { api: [{ name: "weather", url: "https://api.open-meteo.com/v1/forecast?latitude=51.45&longitude=-2.58&current=temperature_2m", method: "GET" }] },
      job: { job: [{ name: "morning_count", fn: "count_orders", everyMinutes: 1440, at: "07:00" }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.prompts.map((p) => (p.tool === "add_to_site" ? p.kind : p.tool)), ["pick_adds", "table", "function", "api", "job", "write_pages"], "the designers did not run one after another, in dependency order");
  // A NEW OBJECT IS THERE FOR THE STEPS AFTER IT, IN THE SAME MESSAGE.
  assert.match(promptFor(r, "function").text, /orders \([^)]*who[^)]*\)[^\\]*being added by this same change/, "the function designer was not shown the new table");
  assert.match(promptFor(r, "job").text, /count_orders/, "the job designer was not shown the new function");
  const order = ddl(r).map((q) => (/CREATE TABLE IF NOT EXISTS "orders"/.test(q) ? "table" : /FUNCTION "count_orders"/.test(q) ? "function" : null)).filter(Boolean);
  assert.deepEqual([...new Set(order)], ["table", "function"], "the function was created before the table it reads");
  assert.deepEqual(r.registered.map((j) => j.name), ["morning_count"]);
  assert.equal(r.compiles.length, 1, "not one publish");
  assert.equal(r.body.cost, 1, "not one charge for the whole addition");
  const { reply } = addSaid(r);
  for (const said of ["now storing orders", "added the function count_orders", "connected weather", "scheduled morning_count (every day at 07:00)"]) assert.ok(reply.includes(said), "the reply does not say “" + said + "”: " + reply);
});

test("WORKS, AND FIXED MW5 — A NEW PAGE AND WHAT GOES ON IT, FROM ONE MESSAGE (a price-table component, a QR code to it, a 3D scene, a line of words): each designer is told the page is being added, one publish and one charge — and the QR code and the scene, saved but on no page the writer wrote, are said as saved and NOT shown", async () => {
  const slug = "mixed-page-" + rnd();
  const r = await addon(slug, "add a wholesale page with a price table, a QR code on the home page that opens it, a 3D oven on it, and a line on the home page saying we deliver", {
    kinds: ["page", "component", "qr", "three", "words"], publishes: true, sitePages: ["/"],
    written: [writtenPage("/wholesale"), addedTo("/", "<p>We deliver to cafes.</p>")],
    answers: {
      page: { page: [{ path: "/wholesale", name: "Wholesale", purpose: "sell to cafes", sections: ["intro"], components: ["card"] }] },
      component: { component: [{ page: "/wholesale", does: "a wholesale price table", components: ["card"] }] },
      qr: { qr: { name: "wholesale", points: "/wholesale", label: "Wholesale", page: "/" } },
      three: { three: { scene: "a wood-fired bread oven, slowly turning", page: "/wholesale" } },
      words: { words: [{ page: "/", words: "We deliver to cafes." }] },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  for (const kind of ["component", "words", "qr", "three"]) {
    assert.match(promptFor(r, kind).text, /ALSO adding a page[^.]*\/wholesale/, "the " + kind + " designer was not told the page is being added");
  }
  assert.deepEqual(r.body.added, ["wholesale.tsx"]);
  const look = JSON.parse(r.store.store.get(CONFIG_KEY(slug))).look;
  assert.deepEqual((look.qr || []).map((q) => q.name), ["wholesale"], "the QR code was not stored");
  assert.ok(look.three, "the 3D scene was not stored");
  assert.equal(r.compiles.length, 1);
  assert.equal(r.body.cost, 1);
  const said = addSaid(r);
  assert.match(said.reply, /added \/wholesale/);
  assert.match(said.reply, /added “We deliver to cafes\.” to \//);
  // FIXED MW5: the configuration was saved, and the page writer drew neither —
  // so neither is said as delivered. The reply names each as saved and not yet
  // shown, where it named neither.
  assert.deepEqual((r.body.qrs || []).map((q) => [q.name, q.page, q.on]), [["wholesale", "/", []]], "the code's placement is not reported as read");
  assert.deepEqual(r.body.scene && [r.body.scene.page, r.body.scene.on], ["/wholesale", []], "the scene's placement is not reported as read");
  assert.match(said.reply, MW5_QR_UNSHOWN, "the code is not said as saved and not shown");
  assert.match(said.reply, MW5_SCENE_UNSHOWN, "the scene is not said as saved and not shown");
  assert.ok(!/Added a QR code|added a QR code/.test(said.reply), "the code is said as added to a page: " + said.reply);
  assert.ok(said.facts.some((f) => MW5_QR_FACT.test(f)), JSON.stringify(said.facts));
  assert.ok(said.facts.some((f) => MW5_SCENE_FACT.test(f)), JSON.stringify(said.facts));
});

test("FIXED MW5 — THE SAME ADDITION WHEN THE WRITER DOES DRAW THEM: the code on the home page and the scene on the new page are said as shown, each on its page", async () => {
  const slug = "mixed-page-shown-" + rnd();
  const SCENE = "import { Canvas } from \"@react-three/fiber\";\n";
  const r = await addon(slug, "add a wholesale page with a 3D oven on it, and a QR code on the home page that opens it", {
    kinds: ["page", "qr", "three"], publishes: true, sitePages: ["/"],
    written: [
      { ...writtenPage("/wholesale"), source: SCENE + writtenPage("/wholesale").source.replace("</main>", "<Canvas><mesh /></Canvas></main>") },
      addedTo("/", "<img src={SITE_QRS.wholesale} alt=\"Wholesale\" />"),
    ],
    answers: {
      page: { page: [{ path: "/wholesale", name: "Wholesale", purpose: "sell to cafes", sections: ["intro"], components: ["card"] }] },
      qr: { qr: { name: "wholesale", points: "/wholesale", label: "Wholesale", page: "/" } },
      three: { three: { scene: "a wood-fired bread oven, slowly turning", page: "/wholesale" } },
    },
  });
  assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual((r.body.qrs || []).map((q) => [q.name, q.on]), [["wholesale", ["/"]]]);
  assert.deepEqual(r.body.scene && r.body.scene.on, ["/wholesale"]);
  const said = addSaid(r);
  assert.match(said.reply, MW5_QR_SHOWN, "the code is not said as shown on the home page");
  assert.match(said.reply, MW5_SCENE_SHOWN, "the scene is not said as shown on the new page");
  assert.ok(!MW5_QR_UNSHOWN.test(said.reply) && !MW5_SCENE_UNSHOWN.test(said.reply), "a placed addition is said as not shown: " + said.reply);
});

test("WORKS (BY DESIGN, ACROSS TWO MESSAGES) — A NEW ENTRY OR A NEW MENU LINK BESIDE A NEW PAGE IS SET ASIDE AND NAMED: the page is added, and the reply says the entry and the link are separate steps", async () => {
  const common = { publishes: true, sitePages: ["/"], written: [writtenPage("/gallery"), addedTo("/", "<p>See our gallery.</p>")],
    answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid"], components: ["card"] }] } } };
  const row = await addon("mixed-row-" + rnd(), "add a gallery page and add Rye to the loaves list", { ...common, kinds: ["row", "page"] });
  assert.equal(row.body.ok, true);
  assert.deepEqual(row.body.added, ["gallery.tsx"]);
  assert.deepEqual(row.body.notAdded.map((n) => n.kind + ":" + n.why), ["row:row-alone"]);
  // SET ASIDE MEANS NOT DESIGNED: the page's designer ran, and no row designer
  // was asked (a named row that was also designed would be paid work unsaid).
  const designers = row.prompts.filter((p) => p.tool === "add_to_site").map((p) => p.kind);
  assert.ok(designers.includes("page"), "the page designer ran: " + designers);
  assert.ok(!designers.includes("row"), "a row designer ran beside the page: " + designers);
  assert.match(addSaid(row).reply, /I left out one row: A new entry for one of the site's lists is a step of its own/);
  const frame = await addon("mixed-frame-" + rnd(), "add a gallery page and put it in the menu", { ...common, kinds: ["page", "frame"] });
  assert.equal(frame.body.ok, true);
  assert.deepEqual(frame.body.skipped, ["frame"]);
  assert.match(addSaid(frame).reply, /The new link, button or footer item is a separate step/);
});

test("FIXED MW6 — ONE ADDITION'S DESIGNER DECLINES BESIDE ONE THAT DESIGNS: the function is added, and the declined connection is kept on the reply and said as not made", async () => {
  const r = await addon("mixed-decline-" + rnd(), "count the orders and fetch the weather", {
    kinds: ["function", "api"],
    answers: { function: { function: [{ name: "count_orders", returns: "int", internal: true, body: "SELECT 1", language: "sql" }] }, api: {} },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["count_orders"]);
  assert.deepEqual(r.body.declined, ["api"], "the declined kind is not kept beside the one added");
  const said = addSaid(r);
  assert.match(said.reply, /^✅ Done — added the function count_orders\./);
  assert.match(said.reply, MW6_DECLINED, "the declined connection is not said: " + said.reply);
  assert.ok(said.facts.some((f) => MW6_FACT.test(f)), JSON.stringify(said.facts));
});

test("WORKS (ALL OR NOTHING) — ONE ADDITION REFUSED BY THE CHECKS REFUSES THE WHOLE MESSAGE: a job dated in the past stops the function beside it too; nothing is applied, nothing charged, and the reason is said", async () => {
  const r = await addon("mixed-refused-" + rnd(), "count the orders, and run it once on the first of January 2020", {
    kinds: ["function", "job"], tz: "Europe/London",
    answers: {
      function: { function: [{ name: "count_orders", returns: "void", internal: true, body: "BEGIN PERFORM 1; END;" }] },
      job: { job: [{ name: "once_then", fn: "count_orders", everyMinutes: 0, on: "2020-01-01", at: "09:00" }] },
    },
  });
  assert.equal(r.status, 422);
  assert.deepEqual([r.body.error, r.body.kind, r.body.reason, r.body.cost], ["add", "job", "past-date", 0]);
  assert.deepEqual(ddl(r), [], "the function beside the refused job was applied");
  assert.deepEqual(r.registered, []);
  assert.match(addSaid(r).reply, /That date has already gone.*Nothing was changed\./);
});

test("WORKS — MORE ADDITIONS OF ONE KIND THAN ONE MESSAGE TAKES ARE NAMED: a seventh table and a fifth API are left out by name, and the rest are added", async () => {
  assert.deepEqual([MAX_ADD_TABLES, MAX_ADD_APIS], [6, 4]);
  const t = await addon("mixed-tables-" + rnd(), "add seven lists", {
    kinds: ["table"], publishes: true,
    answers: { table: { table: ["a", "b", "c", "d", "e", "f", "g"].map((n) => TABLE("list_" + n, [["name", "text"]])) } },
  });
  assert.equal(t.body.ok, true);
  assert.equal(t.body.tables.length, 6);
  assert.deepEqual(t.body.notAdded.map((n) => n.name + ":" + n.why), ["list_g:over-cap"]);
  assert.match(addSaid(t).reply, /I left out “list_g”/);
  const a = await addon("mixed-apis-" + rnd(), "fetch five feeds", {
    kinds: ["api"], publishes: true,
    answers: { api: { api: [1, 2, 3, 4, 5].map((n) => ({ name: "feed_" + n, url: "https://example.com/feed" + n + ".json", method: "GET" })) } },
  });
  assert.deepEqual(a.body.apis, ["feed_1", "feed_2", "feed_3", "feed_4"]);
  assert.match(addSaid(a).reply, /I left out “feed_5”/);
});

test("FIXED MW7 — A SCHEDULE FASTER THAN THE PLATFORM RUNS: “every minute” runs every fifteen minutes, and the reply says what was asked, what runs, and why", async () => {
  assert.equal(MIN_JOB_MINUTES, 15);
  const r = await addon("mixed-clamp-" + rnd(), "count the orders every minute", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [{ name: "count_orders", returns: "void", internal: true, body: "BEGIN PERFORM 1; END;" }] },
      job: { job: [{ name: "often", fn: "count_orders", everyMinutes: 1 }] },
    },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.jobs.map((j) => [j.everyMinutes, j.askedEveryMinutes]), [[15, 1]], "the requested and applied intervals are not both kept");
  const said = addSaid(r);
  assert.match(said.reply, /scheduled often \(every 15 minutes\)/);
  assert.match(said.reply, MW7_ADJUSTED, "the adjustment is not explained: " + said.reply);
  assert.ok(said.facts.some((f) => MW7_FACT.test(f)), JSON.stringify(said.facts));
});

test("FIXED MW7 — A SCHEDULE THE PLATFORM RUNS AS ASKED IS SAID AS ASKED, WITH NO ADJUSTMENT NOTE", async () => {
  const r = await addon("mixed-noclamp-" + rnd(), "count the orders every hour", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [{ name: "count_orders", returns: "void", internal: true, body: "BEGIN PERFORM 1; END;" }] },
      job: { job: [{ name: "hourly", fn: "count_orders", everyMinutes: 60 }] },
    },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.jobs.map((j) => [j.everyMinutes, j.askedEveryMinutes]), [[60, undefined]]);
  const said = addSaid(r);
  assert.ok(!MW7_ADJUSTED.test(said.reply), "an interval run as asked is said as adjusted: " + said.reply);
});
