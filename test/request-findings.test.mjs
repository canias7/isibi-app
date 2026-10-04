// THE TWO FINDINGS OF RUN 95's R1, REPRODUCED AND FIXED (found 2026-10-04 on
// the owner's word: *"yes look into both problems"*; fixed the same day on
// their word: *"Proceed with fixing both findings on the current branch"*).
// Free: the product's own functions, run on what run 95 recorded
// (test/fixtures/run95-r1.json — the bakery's six stored pages after R1, and
// the three job results the page read for R1's parts), with supplied model
// answers. Until the fix these cases asserted the behaviour as it was (FOUND);
// each now asserts what replaced it.
//
// F1. A menu link handed from the add-on step to the menu step was refused
//     `no-menu`. Two layers: the add-on's page step linked a new page from ONE
//     page ("Link it from the header menu: return that page too"), while every
//     page in this kit carries its own menu; and the menu step, shown one menu
//     (the union of every page's), read an item any page carried as present
//     everywhere, so an addition found nothing new. NOW: an addition names its
//     items and their scope (`add`), and code puts each into every list in that
//     scope that lacks it — each page keeping its own items, order and
//     differences; a new page's placement is carried explicitly (`link.in`),
//     a menu placement added to the menus by code; and an addition already
//     true everywhere it was asked for ends as already done.
//
//     Run 95's site has SIX pages and FIVE menus: /starter has none, and
//     nothing here gives it one.
//
// F2. R1's parts got no model-written reply. The reply was written while the
//     page waited, inside the poll, under a 12 s ceiling per call that a cut
//     call could not retry — and every read with a reply to write took about
//     12 s longer than one without. The cause stays STRONGLY INFERRED from those
//     timings (the Worker's own log lines were not read). NOW: the reply is
//     written on the queue after the job's outcome and money are final, with
//     its own budgets and bounded retries, and no read ever calls the model.
//     What that path does is in `test/reply-background.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runNavEdit, navSlots, chromeListSlots, frameNow, actionSlots, contactSlots, NAV_ADD_TOOL, applyAdditions, additionOutcome, additionReply } from "../builder/site-nav.mjs";
import { addDirective, placementOf, menuLinkAdds } from "../builder/site-add.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import {
  editReplyFacts, addonReplyFacts, writeReply, withReplyText, REPLY_TOOL, REPLY_CALL_MS, REPLY_DEADLINE_MS,
  REPLY_BG_CALL_MS, REPLY_BG_DEADLINE_MS, REPLY_BG_ATTEMPTS, REPLY_BG_RETRY_S,
} from "../builder/site-reply.mjs";
import { callBuilderModel } from "../builder/build-call.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const F = JSON.parse(fs.readFileSync(ROOT + "test/fixtures/run95-r1.json", "utf8"));
const PAGES = F.pages.map((p) => ({ path: "src/routes/" + p.path, source: p.source }));
const ROUTES = [...new Set(PAGES.map((p) => routeOf(p.path)).filter(Boolean))];
const menuIn = (pages, file) => { const s = navSlots(pages).find((x) => x.page === "src/routes/" + file); return s ? s.items.map((i) => i.href) : null; };
const menuOf = (file) => menuIn(PAGES, file);
const sourceOf = (pages, file) => pages.find((p) => p.path === "src/routes/" + file).source;
/** The menu step's answer to an addition, as its model gives it (`add`). */
const addAnswer = (input) => async () => ({ content: [{ type: "tool_use", name: NAV_ADD_TOOL.name, input }], usage: { input_tokens: 100, output_tokens: 20 }, stop_reason: "tool_use" });
const CLASSES = { to: "menu", label: "Classes", href: "/classes" };
const addClasses = (pages, add = [CLASSES]) => runNavEdit({ send: addAnswer({ add }) }, { instruction: "put a link to the new Classes page in the menu", pages, routes: ROUTES, addition: true });

// ── F1 ────────────────────────────────────────────────────────────────────

test("run 95 after R1: six pages, five menus — /starter has none — and the Classes link only in the home page's and the new page's", () => {
  assert.deepEqual(ROUTES, ["/", "/order", "/starter", "/visit", "/gallery", "/classes"]);
  assert.equal(navSlots(PAGES).length, 5, "the fixture's menus are not five");
  assert.equal(menuOf("starter.tsx"), null, "the starter page carries a menu after all");
  assert.ok(menuOf("index.tsx").includes("/classes"));
  assert.ok(menuOf("classes.tsx").includes("/classes"));
  for (const f of ["order.tsx", "visit.tsx", "gallery.tsx"]) assert.ok(!menuOf(f).includes("/classes"), `${f} has the link`);
  // The menus differ by design too: Order and Visit carry no Gallery.
  for (const f of ["order.tsx", "visit.tsx"]) assert.ok(!menuOf(f).includes("/gallery"));
  assert.ok(menuOf("gallery.tsx").includes("/gallery"));
});

test("FIXED (F1): a new page's link placement is carried explicitly — a menu placement is the builder's to add to every menu, and a placement on one page names that page and that place", () => {
  const d = { file: "classes.tsx", path: "/classes", name: "Classes", purpose: "a page about the classes", sections: [] };
  // THE MENU (the default): the page writer returns no other page for it.
  for (const link of [{ in: "menu" }, undefined, {}]) {
    const m = addDirective("page", { ...d, link }, {});
    assert.match(m, /- Its link in the site's menu is added to every page's menu by the builder: do not return any other page for it\./, JSON.stringify(link));
    assert.doesNotMatch(m, /Link it from the header menu: return that page too/);
  }
  // A PLACE ON ONE PAGE, as asked: that page, and that place, and nothing else.
  const on = addDirective("page", { ...d, link: { in: "page", page: "/", where: "a button in the hero band" } }, { "/": "index.tsx" });
  assert.match(on, /- Link it from a button in the hero band on the home page \(index\.tsx\): return that page too, with the link added and nothing else changed\./);
  // THE OLD STRING FORM is read as the place it named, never as the menu.
  assert.deepEqual(placementOf("the footer"), { in: "page", where: "the footer" });
  assert.equal(placementOf({ in: "menu" }).in, "menu");
  // WHAT THE BUILDER ADDS FOR A MENU PLACEMENT: the page, by its path, to every menu — nothing for a page placed elsewhere or not made.
  assert.deepEqual(menuLinkAdds([{ path: "/classes", name: "Classes", link: { in: "menu" } }, { path: "/x", name: "X", link: { in: "page", page: "/", where: "a band" } }, { path: "/gone", name: "Gone", link: { in: "menu" } }], ["/gone"]),
    [{ to: "menu", item: { label: "Classes", href: "/classes" }, pages: null, after: null }]);
});

test("FIXED (F1): asked to add the Classes link, the menu step adds it to the three menus that lack it, beside each page's own items; the two that have it and the page with no menu are left as they were, and no page gains Gallery", async () => {
  const out = await addClasses(PAGES);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.changed.sort(), ["src/routes/gallery.tsx", "src/routes/order.tsx", "src/routes/visit.tsx"]);
  for (const f of ["order.tsx", "visit.tsx", "gallery.tsx"]) assert.deepEqual(menuIn(out.pages, f), [...menuOf(f), "/classes"], f + ": not its own menu with Classes added at the end");
  for (const f of ["index.tsx", "classes.tsx", "starter.tsx"]) assert.equal(sourceOf(out.pages, f), sourceOf(PAGES, f), f + " changed");
  for (const f of ["order.tsx", "visit.tsx"]) assert.ok(!menuIn(out.pages, f).includes("/gallery"), f + " was given Gallery");
  assert.equal(navSlots(out.pages).length, 5, "a menu was made where there was none");
  assert.match(out.msg, /Added “Classes” to the menu on 3 pages \(the other 2 already had it\)/);
});

test("FIXED (F1): asked again, the addition is already done — nothing changed, nothing to publish — and the step says so", async () => {
  const once = await addClasses(PAGES);
  const again = await addClasses(once.pages);
  assert.deepEqual([again.ok, again.satisfied, again.changed], [true, true, []], JSON.stringify(again));
  assert.match(again.msg, /Nothing needed changing: “Classes” is already in the menu on every page that has one/);
  // AND ON RUN 95's OWN SITE, a link two of five menus carry is NOT done: the union of the menus is never read as every page's.
  const first = await addClasses(PAGES);
  assert.notEqual(first.satisfied, true);
});

test("FIXED (F1): a scope asked for is the scope used — the Visit page alone — and a page named with no menu is refused by name, never given one", async () => {
  const visit = await addClasses(PAGES, [{ ...CLASSES, pages: ["/visit"] }]);
  assert.equal(visit.ok, true, JSON.stringify(visit));
  assert.deepEqual(visit.changed, ["src/routes/visit.tsx"]);
  assert.deepEqual(menuIn(visit.pages, "visit.tsx"), [...menuOf("visit.tsx"), "/classes"]);
  const starter = await addClasses(PAGES, [{ ...CLASSES, pages: ["/starter"] }]);
  assert.equal(starter.ok, false);
  assert.match(starter.msg, /\/starter has no menu to put “Classes” in, so it isn't there\./);
  const both = await addClasses(PAGES, [{ ...CLASSES, pages: ["/starter", "/visit"] }]);
  assert.equal(both.ok, true);
  assert.deepEqual(both.changed, ["src/routes/visit.tsx"]);
  assert.match(both.msg, /Added “Classes” to the menu on \/visit[^.]*\. \/starter has no menu to put “Classes” in, so it isn't there\./);
  assert.equal(sourceOf(both.pages, "starter.tsx"), sourceOf(PAGES, "starter.tsx"));
  // A PAGE THE SITE DOES NOT HAVE is said as that, never as a page with no menu.
  const nowhere = await addClasses(PAGES, [{ ...CLASSES, pages: ["/nowhere", "/visit"] }]);
  assert.deepEqual(nowhere.changed, ["src/routes/visit.tsx"]);
  assert.match(nowhere.msg, /There's no \/nowhere page on the site, so I didn't add “Classes” there\./);
  assert.doesNotMatch(nowhere.msg, /\/nowhere has no menu/);
});

test("FIXED (F1): the footer's lists follow the same rule — a link goes into each page's list that lacks it, and a list is made only where no page in scope has one", async () => {
  // RUN 95's SITE CARRIES INSTAGRAM IN EVERY FOOTER: asked again, already done.
  for (const f of ["index.tsx", "order.tsx", "visit.tsx", "gallery.tsx", "classes.tsx"]) {
    assert.deepEqual(chromeListSlots([{ path: f, source: sourceOf(PAGES, f) }], "social")[0].items.map((i) => i.network), ["instagram"], f);
  }
  const insta = await runNavEdit({ send: addAnswer({ add: [{ to: "social", network: "instagram", href: "https://instagram.com/harbourloaf" }] }) }, { instruction: "add our Instagram to the footer", pages: PAGES, routes: ROUTES, addition: true });
  assert.deepEqual([insta.ok, insta.satisfied], [true, true], JSON.stringify(insta));
  // NO PAGE HAS A LEGAL LIST: one is made on each page with a footer — five, not the page with no frame.
  const terms = { to: "legal", label: "Terms", href: "https://harbourloaf.example/terms" };
  const made = await runNavEdit({ send: addAnswer({ add: [terms] }) }, { instruction: "add our terms to the footer", pages: PAGES, routes: ROUTES, addition: true });
  assert.equal(made.ok, true, JSON.stringify(made));
  assert.equal(made.changed.length, 5);
  assert.ok(!made.changed.includes("src/routes/starter.tsx"));
});

// ── THE OWNER'S REVIEW OF THE FIX: EVERY NAMED PAGE IS ACCOUNTED FOR ─────
//
// (2026-10-04.) A footer addition naming its pages excluded, silently, a
// named page whose frame had no such list whenever another named page had
// one — and, when that other page already had the entry, answered satisfied
// with nothing changed. The owner's reproduction is the first case. Now a
// named page with a frame is given the list; a named page with no footer is
// told, by name, and nothing is satisfied while it stands; an addition nobody
// scoped keeps its default (the list goes where the site has one).
const footer = (pages, file, prop) => { const sl = chromeListSlots([{ path: "src/routes/" + file, source: sourceOf(pages, file) }], prop)[0]; return sl ? sl.items : undefined; };
const LEGAL_CLASSES = { to: "legal", label: "Classes", href: "/classes" };
const addFooter = (pages, add) => runNavEdit({ send: addAnswer({ add }) }, { instruction: "add it to the footer", pages, routes: ROUTES, addition: true });
/** The run-95 site with the Classes link in the home page's small print only. */
async function legalOnHome() {
  const out = await addFooter(PAGES, [{ ...LEGAL_CLASSES, pages: ["/"] }]);
  assert.deepEqual(out.changed, ["src/routes/index.tsx"], JSON.stringify(out));
  assert.deepEqual(footer(out.pages, "index.tsx", "legal"), [{ label: "Classes", href: "/classes" }]);
  for (const f of ["order.tsx", "visit.tsx", "gallery.tsx", "classes.tsx"]) assert.equal(footer(out.pages, f, "legal"), null, f + " already has small print");
  assert.equal(footer(out.pages, "starter.tsx", "legal"), undefined, "the starter page has a footer after all");
  return out.pages;
}

test("REVIEW (F1): the owner's reproduction — a legal link on / only, asked for on / and /visit — puts it on /visit, whose footer had no small print, and is not satisfied", async () => {
  const pages = await legalOnHome();
  const out = await addFooter(pages, [{ ...LEGAL_CLASSES, pages: ["/", "/visit"] }]);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.notEqual(out.satisfied, true, "an addition with a named page still to do was satisfied");
  assert.deepEqual(out.changed, ["src/routes/visit.tsx"]);
  assert.deepEqual(footer(out.pages, "visit.tsx", "legal"), [{ label: "Classes", href: "/classes" }]);
  assert.deepEqual(footer(out.pages, "index.tsx", "legal"), [{ label: "Classes", href: "/classes" }], "the home page's small print changed");
  for (const f of ["order.tsx", "gallery.tsx", "classes.tsx"]) assert.equal(footer(out.pages, f, "legal"), null, f + " was given small print nobody asked for");
  assert.deepEqual(out.dropped, []);
  assert.match(out.msg, /Added “Classes” to the footer's small print on \/visit \(\/ already had it\)/);
  // ASKED AGAIN: now it is on both named pages.
  const again = await addFooter(out.pages, [{ ...LEGAL_CLASSES, pages: ["/", "/visit"] }]);
  assert.deepEqual([again.ok, again.satisfied, again.changed], [true, true, []], JSON.stringify(again));
});

test("REVIEW (F1): named pages with lists that exist and lists that do not — the entry joins the list that lacks it, a list is made where the frame has none, the page that had it is left, and an unscoped addition keeps its default", async () => {
  const pages = await legalOnHome();
  // /order GAINS SMALL PRINT OF ITS OWN FIRST (Terms), so the three named pages are: had it, a list without it, no list.
  const terms = await addFooter(pages, [{ to: "legal", label: "Terms", href: "https://harbourloaf.example/terms", pages: ["/order"] }]);
  assert.deepEqual(footer(terms.pages, "order.tsx", "legal"), [{ label: "Terms", href: "https://harbourloaf.example/terms" }]);
  const out = await addFooter(terms.pages, [{ ...LEGAL_CLASSES, pages: ["/", "/order", "/visit"] }]);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.changed.sort(), ["src/routes/order.tsx", "src/routes/visit.tsx"]);
  assert.deepEqual(footer(out.pages, "order.tsx", "legal"), [{ label: "Terms", href: "https://harbourloaf.example/terms" }, { label: "Classes", href: "/classes" }], "the list that lacked it did not gain it beside its own entry");
  assert.deepEqual(footer(out.pages, "visit.tsx", "legal"), [{ label: "Classes", href: "/classes" }]);
  assert.match(out.msg, /\(\/ already had it\)/);
  // NOBODY SCOPED IT: the entry goes where the site has small print, and none is made elsewhere — the default.
  const unscoped = await addFooter(pages, [LEGAL_CLASSES]);
  assert.deepEqual([unscoped.ok, unscoped.satisfied, unscoped.changed], [true, true, []], JSON.stringify(unscoped));
  for (const f of ["order.tsx", "visit.tsx", "gallery.tsx"]) assert.equal(footer(unscoped.pages, f, "legal"), null, f + " was given small print by an unscoped addition");
});

test("REVIEW (F1): social links the same way — a network on / only, asked for on / and /visit, joins /visit's own list beside what it has", async () => {
  const FB = { to: "social", network: "facebook", href: "https://facebook.com/harbourloafbristol" };
  const first = await addFooter(PAGES, [{ ...FB, pages: ["/"] }]);
  assert.deepEqual(first.changed, ["src/routes/index.tsx"], JSON.stringify(first));
  const out = await addFooter(first.pages, [{ ...FB, pages: ["/", "/visit"] }]);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.notEqual(out.satisfied, true);
  assert.deepEqual(out.changed, ["src/routes/visit.tsx"]);
  assert.deepEqual(footer(out.pages, "visit.tsx", "social").map((i) => i.network), ["instagram", "facebook"]);
  assert.match(out.msg, /\(\/ already had it\)/);
});

test("REVIEW (F1): a named page with no footer at all is told by name, and the addition is never satisfied while it stands — refused when nothing else changed, done in part when something did", async () => {
  const pages = await legalOnHome();
  const refused = await addFooter(pages, [{ ...LEGAL_CLASSES, pages: ["/", "/starter"] }]);
  assert.equal(refused.ok, false, JSON.stringify(refused));
  assert.notEqual(refused.satisfied, true);
  assert.match(refused.msg, /\/starter has no footer to put “Classes” in, so it isn't there\./);
  assert.match(refused.msg, /“Classes” is already in the footer's small print on \/\./);
  const partly = await addFooter(pages, [{ ...LEGAL_CLASSES, pages: ["/visit", "/starter"] }]);
  assert.equal(partly.ok, true, JSON.stringify(partly));
  assert.deepEqual(partly.changed, ["src/routes/visit.tsx"]);
  assert.deepEqual(partly.dropped.map((d) => [d.why, d.page]), [["no-footer-there", "/starter"]], "the unmet page was not kept as left out — a request part would read this as done");
  assert.match(partly.msg, /\/starter has no footer to put “Classes” in/);
});

test("REVIEW (F1): every target is accounted for — one the writer left without the entry is named, never left out, and the addition is not done; \"already there\" then names only the pages that had it", async () => {
  const pages = await legalOnHome();
  // THE WRITER'S OWN REPORT, NAMED AND UNNAMED, with /visit read as it would
  // be had its write not landed: the real writer always writes, so the case
  // is made from its report.
  for (const scope of [{ pages: ["/", "/visit"] }, {}]) {
    const asked = { to: "legal", item: { label: "Classes", href: "/classes" }, after: null, pages: null, ...scope };
    const base = scope.pages ? pages : (await addFooter(pages, [{ to: "legal", label: "Terms", href: "https://harbourloaf.example/terms", pages: ["/visit"] }])).pages;
    const { report } = applyAdditions(base, [asked]);
    assert.deepEqual([report[0].had, report[0].added], [["src/routes/index.tsx"], ["src/routes/visit.tsx"]], JSON.stringify(report));
    const unwritten = [{ ...report[0], added: [] }];
    const came = additionOutcome(unwritten);
    assert.equal(came.allThere, false, "a target without the entry counted as already there");
    assert.deepEqual(came.notThere.map((d) => [d.why, d.page, d.list, d.label]), [["not-written", "/visit", "legal", "Classes"]]);
    const said = additionReply({ report: unwritten, dropped: came.notThere });
    assert.match(said, /“Classes” is already in the footer's small print on \/\./, said);
    assert.doesNotMatch(said, /on every page that has one/, "pages that did not have it were said to have it: " + said);
    assert.match(said, /I couldn't write “Classes” into \/visit's small-print links, so it isn't there\./, said);
  }
});

test("REVIEW (F1): a home page they name for a link to itself is told, with the reason — the menu writer never gives the home page a link to itself — and never counted as done; nobody naming it, it is left out as ever", async () => {
  // THE HOME PAGE'S MENU WITHOUT ITS OWN LINK, every other menu keeping theirs.
  const noHome = PAGES.map((p) => (p.path === "src/routes/index.tsx" ? { ...p, source: p.source.replace('{ label: "Today\'s bake", href: "/" }, ', "") } : p));
  assert.ok(!menuIn(noHome, "index.tsx").includes("/"), "the home page's menu still links to itself");
  const TODAY = { to: "menu", label: "Today's bake", href: "/" };
  // NAMED ALONE: refused, by name and reason, nothing written.
  const named = await addClasses(noHome, [{ ...TODAY, pages: ["/"] }]);
  assert.equal(named.ok, false, JSON.stringify(named));
  assert.notEqual(named.satisfied, true);
  assert.match(named.msg, /“Today's bake” goes to the home page itself, and the home page's menu doesn't link to itself, so it isn't there\./);
  assert.doesNotMatch(named.msg, /couldn't write/, "the home page's own rule was said as a failed write");
  // NAMED BESIDE A PAGE THAT TAKES IT: that page gains it, the home page is
  // kept as left out with its reason — so a request part is not done.
  const noVisit = noHome.map((p) => (p.path === "src/routes/visit.tsx" ? { ...p, source: p.source.replace('{ label: "Today\'s bake", href: "/" }, ', "") } : p));
  assert.ok(!menuIn(noVisit, "visit.tsx").includes("/"));
  const both = await addClasses(noVisit, [{ ...TODAY, pages: ["/", "/visit"] }]);
  assert.equal(both.ok, true, JSON.stringify(both));
  assert.deepEqual(both.changed, ["src/routes/visit.tsx"]);
  assert.deepEqual(both.dropped.map((d) => [d.why, d.page]), [["home-self", "/"]]);
  assert.ok(!menuIn(both.pages, "index.tsx").includes("/"), "the home page was given a link to itself");
  // AND NEVER "ALREADY THERE" WHILE IT STANDS: /visit has the link, the home
  // page they named does not take it — not all there, nothing counted as done.
  const { report } = applyAdditions(noHome, [{ to: "menu", item: { label: TODAY.label, href: "/" }, pages: ["/", "/visit"], after: null }]);
  assert.deepEqual([report[0].targets, report[0].had, report[0].home], [["src/routes/visit.tsx"], ["src/routes/visit.tsx"], "/"]);
  const came = additionOutcome(report);
  assert.equal(came.allThere, false, "a named home page left out counted as all there");
  assert.deepEqual(came.already.menu, []);
  assert.deepEqual(came.notThere.map((d) => [d.why, d.page]), [["home-self", "/"]]);
  // NOBODY NAMED IT: every other menu has the link, and the home page is left out, as ever.
  const unnamed = await addClasses(noHome, [TODAY]);
  assert.deepEqual([unnamed.ok, unnamed.satisfied, unnamed.changed], [true, true, []], JSON.stringify(unnamed));
  assert.ok(!menuIn(unnamed.pages, "index.tsx").includes("/"));
});

// ── F2 ────────────────────────────────────────────────────────────────────

const factsOf = (r) => (Array.isArray(r.body.kinds) ? addonReplyFacts(r.body, { routedCost: 3, inRequest: true }) : editReplyFacts(r.body, { routedCost: 3, inRequest: true }));

test("run 95's evidence (F2): R1's three part results reached the page with no model reply, though each gives the writer facts — nothing was skipped", () => {
  assert.deepEqual(F.partResults.map((r) => [r.job.slice(0, 8), r.status]), [["4ad20b96", 200], ["073e0a57", 200], ["ac0a5b9f", 422]]);
  for (const r of F.partResults) {
    assert.equal(r.body.reply, undefined, `${r.job} carried a reply`);
    assert.equal(r.body.replySource, undefined);
    assert.equal(r.body.replyFor, undefined, "the private reply context was served");
    const f = factsOf(r);
    assert.equal(f.skip, null, `${r.job}'s facts skipped (${f.skip})`);
    assert.ok(f.facts.length >= 2, `${r.job} gave ${f.facts.length} fact(s)`);
  }
  // Part 0's are the description and the two parts it put off, each told as its own part of the same request.
  assert.deepEqual(factsOf(F.partResults[0]).facts.map((x) => x.kind), ["changed", "pending", "pending"]);
});

test("each way the reply call can fall back is named, and an answer that covers every fact attaches one", async () => {
  const facts = factsOf(F.partResults[0]).facts;
  const ids = facts.map((x) => x.id);
  const tool = (input) => async () => ({ content: [{ type: "tool_use", name: REPLY_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 10 } });
  const covers = await writeReply({ send: tool({ reply: "The description now mentions the classes; the menu link and the page come next.", covers: ids }) }, { facts, model: "m" });
  assert.equal(covers.ok, true);
  assert.equal(withReplyText(F.partResults[0].body, covers.text).replySource, "model");
  // A fact left out twice: `uncovered`.
  const short = await writeReply({ send: tool({ reply: "The description is changed.", covers: [ids[0]] }) }, { facts, model: "m" });
  assert.deepEqual([short.ok, short.why, short.attempts], [false, "uncovered", 2]);
  // An answer that is not the tool's: `unreadable`, after one call.
  const bad = await writeReply({ send: async () => ({ content: [{ type: "text", text: "Done." }] }) }, { facts, model: "m" });
  assert.deepEqual([bad.ok, bad.why, bad.attempts], [false, "unreadable", 1]);
  // A call that throws: `send`.
  const down = await writeReply({ send: async () => { throw new Error("upstream 500"); } }, { facts, model: "m" });
  assert.deepEqual([down.ok, down.why], [false, "send"]);
  // A call slower than the deadline: `deadline`.
  const slow = await writeReply({ send: () => new Promise((r) => setTimeout(() => r(null), 200)) }, { facts, model: "m", deadlineMs: 20 });
  assert.deepEqual([slow.ok, slow.why], [false, "deadline"]);
});

test("FIXED (F2): the reply's budgets — written in the background, 90 s per call and 150 s per try, three tries 30 s and 120 s apart; inline (where a page still waits on it), 30 s per call and 45 s in all — and the Worker hands each its own", () => {
  assert.equal(REPLY_BG_CALL_MS, 90000);
  assert.equal(REPLY_BG_DEADLINE_MS, 150000);
  assert.equal(REPLY_BG_ATTEMPTS, 3);
  assert.deepEqual(REPLY_BG_RETRY_S, [30, 120]);
  assert.equal(REPLY_CALL_MS, 30000);
  assert.equal(REPLY_DEADLINE_MS, 45000);
  assert.ok(REPLY_BG_CALL_MS < REPLY_BG_DEADLINE_MS && REPLY_CALL_MS < REPLY_DEADLINE_MS, "a call's own ceiling is not inside its try's");
  const W = fs.readFileSync(ROOT + "worker.js", "utf8");
  const bg = W.indexOf("const replyBgBudget = ");
  const inl = W.indexOf("const replyBudget = ");
  const m = W.indexOf("async function composeModelReply(");
  assert.ok(bg >= 0 && inl >= 0 && m >= 0, "a landmark in worker.js moved");
  assert.match(W.slice(bg, W.indexOf("\n", bg)), /\{ capMs: \(\) => REPLY_BG_CALL_MS \}/);
  assert.match(W.slice(inl, W.indexOf("\n", inl)), /\{ capMs: \(\) => REPLY_CALL_MS \}/);
  const body = W.slice(m, W.indexOf("\n}\n", m));
  assert.match(body, /quickSend\(env, "reply", background \? replyBgBudget : replyBudget\)/);
  assert.match(body, /background \? \{ deadlineMs: REPLY_BG_DEADLINE_MS \} : \{\}/);
});

test("FIXED (F2): a read never calls the model — the job poll and the request read hand back what the background writer stored, or say it is still being written", () => {
  const W = fs.readFileSync(ROOT + "worker.js", "utf8");
  for (const name of ["async function servedModelReply(", "async function requestReply("]) {
    const at = W.indexOf(name);
    assert.ok(at >= 0, name + " moved");
    const body = W.slice(at, W.indexOf("\n}\n", at));
    assert.ok(body.length > 200, name + ": its body was not found");
    for (const call of ["writeReply(", "composeModelReply(", "writeModelReply(", "quickSend("]) assert.ok(!body.includes(call), name + " calls " + call);
  }
});

test("a call is still cut by its own timer when the provider says nothing — the timer is the budget it was handed — and the same path answered in time is written", async () => {
  // THE BUDGET BECOMES A TIMER ON THE CALL ITSELF (the real model call, here
  // given 40 ms): a transport that has not answered by then is cut, read as
  // `send`, and not asked again inside that try. The background writer's next
  // try is the queue's (test/reply-background.test.mjs), never this call's.
  const facts = factsOf(F.partResults[0]).facts;
  let sent = 0;
  const silent = (url, init) => { sent++; return new Promise((_, no) => init.signal.addEventListener("abort", () => no(init.signal.reason), { once: true })); };
  const cut = await writeReply({ send: (req) => callBuilderModel({ xai: "k" }, req, { capMs: () => 40 }, silent) }, { facts, model: "grok-4.6" });
  assert.deepEqual([cut.ok, cut.why, cut.attempts, sent], [false, "send", 1, 1]);
  const ids = facts.map((x) => x.id);
  const quick = async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: { name: REPLY_TOOL.name, arguments: JSON.stringify({ reply: "The description now names the classes; the menu link and the page come next.", covers: ids }) } }] } }],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const written = await writeReply({ send: (req) => callBuilderModel({ xai: "k" }, req, { capMs: () => 40 }, quick) }, { facts, model: "grok-4.6" });
  assert.deepEqual([written.ok, written.attempts], [true, 1]);
});

test("the frame the menu step reads is each page's own: no union of menus or footer lists is read as every page's", () => {
  const now = frameNow({ actions: actionSlots(PAGES), seconds: actionSlots(PAGES, "secondAction"), contacts: contactSlots(PAGES) });
  assert.equal(Object.hasOwn(now, "menu"), false, "a union of the menus is still read");
  assert.equal(Object.hasOwn(now, "lists"), false, "a union of the footer lists is still read");
});
