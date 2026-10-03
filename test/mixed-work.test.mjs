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
// ⚠ THIS FILE RECORDS BEHAVIOUR; IT FIXES NOTHING. A case named "WORKS" holds a
// capability the code has today. A case named "FINDING MWn" holds a defect
// reproduced through the real routes, asserted AS IT HAPPENS, so the record
// is exact and the fix that removes it has to change the case on purpose. The
// findings and the matrix are in docs/investigations/mixed-work-audit.md.
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
import { T, bucket, withWire, envFor, routeCall, browserPost, postRoute, SITE, SOURCE_KEY, storedLook, freshSlug, userText, page as pageSource } from "./fixtures/live-ask.mjs";
import { addon, promptFor, writtenPage, addedTo, compiledPages } from "./fixtures/addon-route.mjs";
import { editBrowserReply, browserReply } from "../scripts/addon-sweep.mjs";
import { editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";
import { navSlots, NAV_TOOL } from "../builder/site-nav.mjs";
import { PICTURE_TOOL, imageSlots, MAX_PICTURE_OPS } from "../builder/site-picture.mjs";
import { MAX_LANES, LANE_FIELDS, laneLayer, laneEscalate, laneVerbs, OWN_LANES } from "../builder/site-lanes.mjs";
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

// ─────────────────────────────────────────────────────────────────────────────
// 0. WHAT IS REGISTERED, READ FROM THE CODE THE MATRIX IS ABOUT
// ─────────────────────────────────────────────────────────────────────────────

test("THE REGISTERED CAPABILITIES: nine edit layers, twenty-one look lanes of which four run per message, twelve add-on kinds — and where each lane's work really runs", () => {
  assert.deepEqual(EDIT_LAYERS, ["data", "text", "look", "page", "rules", "picture", "logo", "nav", "rename"]);
  assert.equal(LANE_FIELDS.length, 21);
  assert.equal(MAX_LANES, 4, "the lane cap the matrix is about moved");
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

test("WORKS — THE SAME KIND OF CHANGE ON TWO PAGES (two layout moves): one page step per page, run in turn, each handed only its own words and its own page, both published together, each billed — though the page's own reply names neither page (FINDING MW8)", async () => {
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
  // FINDING MW8: WHAT MAIN SHOWS TODAY (no model replies) NAMES NO PAGE.
  assert.equal(r.reply, "✅ Updated the look.");
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

test("WORKS, AND FINDING MW1 — THREE DIFFERENT CHANGES ON ONE PAGE (a move, a photograph off, the menu): all three land, in turn, the photo taken off the page the move had already rewritten, in one publish — but the reply names only “/”: the photo and the menu are told nowhere", async () => {
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
  // FINDING MW1: what the customer is told.
  assert.equal(r.reply, "✅ Updated the look. If that was not what you wanted, roll back to the previous build in Cloud → Versions.");
  assert.deepEqual(r.facts.filter((f) => !/roll back/.test(f)), ["Updated /."]);
  unsaid(r, /photo|picture|boule/i, "the photograph taken off");
  unsaid(r, /menu|Gallery/i, "the menu change");
});

for (const mode of ["sync", "job"]) {
  test("WORKS, AND FINDING MW1 (" + mode + ") — FOUR DIFFERENT CHANGES ACROSS PAGES (the description, a Visit move, a home photo off, the menu): all four land, in turn, in one publish, each step billed — but the reply tells only the description and /visit", async () => {
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
    assert.equal(r.reply, "✅ Updated the look — the description. If that was not what you wanted, roll back to the previous build in Cloud → Versions.");
    assert.deepEqual(r.facts.filter((f) => !/roll back/.test(f)), ["Changed the description.", "Updated /visit."]);
    unsaid(r, /photo|picture|boule/i, "the photograph taken off");
    unsaid(r, /menu|Gallery/i, "the menu change");
  });
}

test("FINDING MW2 — A FIFTH DIFFERENT CHANGE IS DROPPED WITHOUT A WORD: the picker names five lanes, four run, and the fifth (the menu) is not run, not put off, not in the partial list and not in the reply", async () => {
  const r = await editRun({
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
  assert.deepEqual(r.body.lanes, ["css", "description", "shape", "images"], "the four kept are not the first four in the lanes' order");
  assert.ok(!r.seen.calls.includes(NAV_TOOL.name), "the menu step ran");
  assert.equal(r.css, CSS);
  assert.equal(r.look.description, NEW_DESC);
  assert.ok(!r.src("index.tsx").includes(BOULE));
  assert.deepEqual(r.menus("index.tsx"), [["Today's bake", "The starter", "Visit", "Gallery"]], "the menu changed");
  assert.equal(r.body.partial, undefined, "the dropped change is listed as not done");
  assert.equal(r.body.deferred, undefined, "the dropped change is put off for later");
  unsaid(r, /menu|Gallery/i, "the dropped menu change");
});

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

test("FINDING MW3 — A SECOND PART THE ANSWER CANNOT MAKE, BESIDE ONE IT HELD BACK, VANISHES: only one part can be held (`alsoAsked` is one passage); a wording change no lane was given is not run, not held and not said", async () => {
  const ADD = "add a page for our wholesale customers";
  const WORDING = "change the Visit heading to Find the bakery";
  const r = await editRun({
    viaRouter: true,
    message: W.desc + ", " + WORDING + ", and " + ADD,
    answers: {
      route: { intent: "edit", layer: "look", alsoAsked: ADD },
      // THE PICKER NAMES A LANE FOR THE DESCRIPTION AND NONE FOR THE WORDING —
      // look has no wording lane. Whether a real picker would hand it to a page
      // lane instead is untested (the real-model batch, row MX5).
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: W.desc }] },
      "lane:description": NEW_DESC,
    },
  });
  assert.equal(r.body.ok, true);
  assert.equal(r.look.description, NEW_DESC);
  assert.ok(r.src("visit.tsx").includes("Come to the bakery"), "the wording change was made");
  assert.equal(r.body.deferred, ADD, "the held part changed");
  assert.equal(r.body.partial, undefined);
  unsaid(r, /Find the bakery|heading/i, "the wording change");
});

test("FINDING MW4 — MORE CHANGES OF ONE KIND THAN A STEP TAKES: nine photographs asked off one page, eight come off, and the ninth stays without a word", async () => {
  assert.equal(MAX_PICTURE_OPS, 8);
  const gallery = pageSource("/gallery", Array.from({ length: 10 }, (_, i) => "<section><img src=\"/u/x/p" + i + ".jpg\" alt=\"Photo number " + i + "\" /></section>").join(""));
  const r = await editRun({
    pages: [{ path: "index.tsx", source: ORIG["index.tsx"] }, { path: "gallery.tsx", source: gallery }],
    message: "On the gallery page take off photos 1 to 9.",
    routed: { layer: "picture", page: "/gallery" },
    answers: { [PICTURE_TOOL.name]: { pictures: Array.from({ length: 9 }, (_, i) => ({ page: "gallery.tsx", alt: "Photo number " + (i + 1), remove: true })) } },
  });
  assert.equal(r.body.ok, true);
  const left = r.photos.filter((p) => p.startsWith("gallery.tsx")).map((p) => p.split(": ")[1]);
  assert.deepEqual(left, ["Photo number 0", "Photo number 9"], "not exactly the first eight came off");
  assert.match(r.reply, /Photo number 8” off/);
  unsaid(r, /Photo number 9/, "the ninth photograph");
});

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

test("WORKS, AND FINDING MW5 — A NEW PAGE AND WHAT GOES ON IT, FROM ONE MESSAGE (a price-table component, a QR code to it, a 3D scene, a line of words): each designer is told the page is being added, one publish and one charge — but the QR code and the 3D scene are told nowhere", async () => {
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
  // FINDING MW5.
  for (const re of [/QR|code/i, /3D|scene|oven/i]) {
    assert.ok(!re.test(said.reply), "named after all: " + said.reply);
    assert.ok(!said.facts.some((f) => re.test(f)), "named in the facts after all");
  }
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

test("FINDING MW6 — ONE ADDITION'S DESIGNER DECLINES BESIDE ONE THAT DESIGNS: the function is added and the reply says only that; the declined API is in no field and no sentence", async () => {
  const r = await addon("mixed-decline-" + rnd(), "count the orders and fetch the weather", {
    kinds: ["function", "api"],
    answers: { function: { function: [{ name: "count_orders", returns: "int", internal: true, body: "SELECT 1", language: "sql" }] }, api: {} },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.functions, ["count_orders"]);
  assert.equal(r.body.declined, undefined);
  const said = addSaid(r);
  assert.equal(said.reply, "✅ Done — added the function count_orders.");
  assert.ok(!said.facts.some((f) => /weather|api|connect/i.test(f)), JSON.stringify(said.facts));
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

test("FINDING MW7 — A SCHEDULE FASTER THAN THE PLATFORM RUNS IS RAISED WITHOUT SAYING SO: “every minute” becomes every fifteen minutes, and the reply states fifteen as if asked", async () => {
  assert.equal(MIN_JOB_MINUTES, 15);
  const r = await addon("mixed-clamp-" + rnd(), "count the orders every minute", {
    kinds: ["function", "job"],
    answers: {
      function: { function: [{ name: "count_orders", returns: "void", internal: true, body: "BEGIN PERFORM 1; END;" }] },
      job: { job: [{ name: "often", fn: "count_orders", everyMinutes: 1 }] },
    },
  });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.jobs.map((j) => j.everyMinutes), [15]);
  const said = addSaid(r);
  assert.match(said.reply, /scheduled often \(every 15 minutes\)/);
  assert.ok(!/minute you asked|instead of|at most|raised|every minute/i.test(said.reply), said.reply);
});
