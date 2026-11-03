// PARKED (2026-11-03, park-old-way): the old-way half of test/mixed-work.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { loadWorker } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { T, bucket, withWire, envFor, routeCall, browserPost, postRoute, SITE, SOURCE_KEY, storedLook, freshSlug, userText, question, page as pageSource } from "../../../test/fixtures/live-ask.mjs";
import { addon, promptFor, writtenPage, addedTo, compiledPages } from "../../../test/fixtures/addon-route.mjs";
import { editBrowserReply, browserReply } from "../../../scripts/addon-sweep.mjs";
import { editReplyFacts, addonReplyFacts } from "../../../builder/site-reply.mjs";
import { navSlots, NAV_TOOL, chromeListSlots, applyChromeList, contactSlots, actionSlots } from "../../../builder/site-nav.mjs";
import * as PICTURE from "../../../builder/site-picture.mjs";
import * as LANES from "../../../builder/site-lanes.mjs";
const { PICTURE_TOOL, imageSlots } = PICTURE;
const { LANE_FIELDS, laneLayer, laneEscalate, laneVerbs, OWN_LANES } = LANES;
import { EDIT_LAYERS } from "../../../builder/route-shared.mjs";
import { ADD_KINDS, DISPATCHED_ADDS, MAKES_PAGES, BACKEND_ADDS, MAX_ADD_TABLES } from "../../../builder/site-add.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// THE BAKERY, AS IT IS STORED, AND THE CHANGES THE CASES ASK FOR
// ─────────────────────────────────────────────────────────────────────────────

const RUN47 = ["index", "order", "starter", "visit", "gallery"].map((n) => ({
  path: n + ".tsx", source: readFileSync(new URL("../../../test/fixtures/run47/" + n + ".before.tsx", import.meta.url), "utf8"),
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
const MW1_THREE = "Updated /. " + BOULE_SAID + " " + MENU_SAID + ROLL_BACK;
const MW1_FOUR = "Updated the look — the description. Updated /visit. " + BOULE_SAID + " " + MENU_SAID + ROLL_BACK;
/** Every part put off this turn, in order: the router's (`deferred`) and the steps' (`putOff`). */
const MW3_HELD = (b) => [b.deferred, b.putOff].flatMap((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []));
// THE ADD-ON'S PLACEMENT AND DECLINE SENTENCES, as the page composes them.
const MW5_QR_UNSHOWN = /I saved the QR code “Wholesale”, but no page shows it yet \(you asked for it on \/\)/;
const MW5_SCENE_UNSHOWN = /I saved the 3D scene, but no page draws it yet \(you asked for it on \/wholesale\)/;
const MW5_QR_SHOWN = /added a QR code captioned “Wholesale” on \//;
const MW5_SCENE_SHOWN = /added a 3D scene on \/wholesale/;
const MW6_DECLINED = /I couldn’t design a list for the site to store from what you asked, so nothing was made for it/;
// …AND THE SAME FACTS, AS A MODEL-WRITTEN REPLY IS GIVEN THEM.
const MW5_QR_FACT = /QR code[^]*“Wholesale”[^]*no page shows it/;
const MW5_SCENE_FACT = /scene[^]*no page (shows|draws) it/i;
const MW6_FACT = /Nothing was made for a list for the site to store: the builder could not design it/;
const MW2_FIVE = "Updated the look — the description, the design. Updated /visit. "
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
        // THE STEPS' OWN FACTS, and apart from them the publish's checks (`k`,
        // 2026-10-14), which every published change now carries.
        facts: Array.isArray(facts.facts) ? facts.facts.filter((f) => f.kind !== "check").map((f) => f.text) : assert.fail("no reply facts: " + JSON.stringify(facts)),
        checks: Array.isArray(facts.facts) ? facts.facts.filter((f) => f.kind === "check").map((f) => f.text) : [],
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
  assert.equal(r.checks.length, 3, "the one publish's checks were not each a fact: " + JSON.stringify(r.checks));
  // FIXED MW8: the page's own reply (no model replies) names both pages, where
  // it read "✅ Updated the look."
  assert.equal(r.reply, "Updated / and /visit.");
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
      // AN ADDITION NAMES ITS NEW ENTRIES (`add`, 2026-10-04, run 95's F1). A
      // whole list restated beside them — the three the footer has, then the
      // six — is not read, so nothing is decided from it.
      answers: { [NAV_TOOL.name]: { legal: NINE_LEGAL, add: NINE_LEGAL.slice(3).map((l) => ({ to: "legal", ...l })) } },
    });
    assert.equal(r.post.body.addition, true, "the browser did not post the hand-off as an addition");
    assert.equal(r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
    const before = Object.fromEntries(WITH_THREE.map((p) => [p.path, p.source]));
    for (const f of CHROME) {
      assert.deepEqual(listOn(r, f, "legal"), NINE_LEGAL, f + ": the footer does not hold its three and the six added after them");
      assert.deepEqual(chromeOf(r.src(f), f), chromeOf(before[f], f), f + ": the menu, the button or the contact details moved");
    }
    assert.match(r.reply, /Added “Accessibility”, “Allergens”, “Delivery”, “Returns”, “Complaints”, “Modern slavery” to the footer's small print on 4 pages/);
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
      answers: { [NAV_TOOL.name]: { add: twelve.slice(4).map((l) => ({ to: "menu", ...l })) } } });
    assert.equal(add.body.ok, true, JSON.stringify(add.body).slice(0, 300));
    for (const f of CHROME) {
      const own = navSlots([{ path: f, source: ORIG[f] }])[0].items.map((i) => i.label);
      assert.deepEqual(add.menus(f), [[...own, ...twelve.slice(4).map((l) => l.label)]], f + ": the menu is not its own items with all eight added");
    }
    assert.match(add.reply, /Added “Bread”, “Pastry”, “Cakes”, “Coffee”, “Hampers”, “Classes”, “Wholesale”, “Jobs” to the menu on 4 pages, beside the items each had/);
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

