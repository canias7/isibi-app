// A MENU LINK'S WORDS, JUDGED ONLY WHERE THE REQUEST ASKED FOR SOME
// (2026-10-07, after run 105).
//
// The owner: *"The customer requested an FAQ page and a menu link without
// explicitly specifying the link's wording, so correct the verifier
// generically: when no label is specified, check a nonempty label linking to
// the verified new page in stored and served menus, with existing items
// preserved; retain wording checks when the request explicitly requires them.
// Do not add an FAQ/Common questions synonym exception or force the builder's
// wording. Verify this offline using saved evidence where available and
// focused controls for missing links, wrong destinations, empty labels,
// changed existing items and an explicitly requested label being ignored."*
//
// THE SAVED EVIDENCE is run 105's own (`test/fixtures/run105-evidence.json.gz`,
// built unchanged from its canary-evidence.zip, whose digest matches the one
// the run printed): the before and after inventories, the stored sources, the
// served pages, the UI run's steps, and the verdict the press printed. Each
// control changes that evidence in one place, the way a real defect would.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";
import { requestBatchVerdict, labelFits, labelWords } from "../scripts/canary-requests.mjs";
import { plain } from "../scripts/canary-additions.mjs";

const FX = JSON.parse(gunzipSync(fs.readFileSync(new URL("./fixtures/run105-evidence.json.gz", import.meta.url))).toString("utf8"));
const LP = UI_SCENARIOS["lv-progress"];
const NEW_LINK = '{ label: "Common questions", href: "/faq" }';
const MENU = /^every page's menu gained /;
const SERVED = /^every served header links /;

/** The evidence, deep-copied, with `change` applied to the after side (stored sources by file, served pages by route). */
function evidence(change = {}) {
  const fx = JSON.parse(JSON.stringify(FX));
  for (const [path, edit] of Object.entries(change.sources || {})) {
    const page = fx.after.source.pages.find((p) => p.path === path);
    const was = page.source;
    page.source = edit(was);
    assert.notEqual(page.source, was, `the case did not change ${path}`);
  }
  for (const [route, edit] of Object.entries(change.headers || {})) {
    const html = fx.after.served[route];
    const head = (html.match(/<header\b[\s\S]*?<\/header>/) || [""])[0];
    assert.ok(head, `${route} has no header to change`);
    const now = edit(head);
    assert.notEqual(now, head, `the case did not change ${route}'s header`);
    fx.after.served[route] = html.replace(head, now);
  }
  return fx;
}

/** Run 105's verdict, judged again by this tree's verifier with `spec`. */
function judge(spec = LP, fx = FX) {
  const side = (s) => ({ ...s.inventory, source: s.source, complete: s.inventory.readsComplete === true });
  return requestBatchVerdict({
    spec, steps: fx.ui.steps, before: side(fx.before), after: side(fx.after),
    served: fx.after.served, beforeServed: fx.before.served, logo: null, row: null,
    tables: fx.verdict.tables, slug: "fold-lane-bakery", frameLoads: fx.ui.frameLoads,
  });
}
const menuChecks = (v) => v.checks.filter((c) => MENU.test(c.name) || SERVED.test(c.name));
const failedNames = (v) => v.checks.filter((c) => !c.ok).map((c) => c.name);
const line = (c) => `${c.ok ? "ok" : "FAIL"} ${c.name}`;

// THE EIGHT PAGES WITH A MENU, by stored file and served route (the starter
// page has none).
const FRAMED = [["index.tsx", "/"], ["order.tsx", "/order"], ["visit.tsx", "/visit"], ["gallery.tsx", "/gallery"], ["classes.tsx", "/classes"], ["wholesale.tsx", "/wholesale"], ["bake-list.tsx", "/bake-list"], ["tasting-evenings.tsx", "/tasting-evenings"]];
const FAQ_ANCHOR = /<a href="\/faq"([^>]*)>Common questions<\/a>/;

// A REQUEST THAT DOES NAME THE LINK'S WORDS: the same press, its message
// asking for the words, quoted in `asked` as the specs require.
const ASKED = "with a link in the menu that says 'FAQ'";
const ASKING = Object.freeze({
  ...LP,
  steps: Object.freeze([Object.freeze({ ...LP.steps[0], say: LP.steps[0].say.replace("with a link in the menu", ASKED) })]),
  expect: Object.freeze({ ...LP.expect, menu: Object.freeze({ page: 0, label: "FAQ", asked: ASKED }) }),
});

test("the saved evidence is run 105's, and its printed verdict is kept as it was: two failures, both the menu link's words", () => {
  assert.equal(FX.provenance.run, 37556753281);
  assert.equal(FX.provenance.zipSha256, "8ca5fdf5b86a698a5247cc7f8971423fa3f9f3d6326f6d0db37d9426788e795d");
  const saved = FX.verdict;
  assert.equal(saved.ok, false);
  assert.equal(saved.checks.length, 30);
  assert.deepEqual(saved.checks.filter((c) => !c.ok).map((c) => c.name), [
    "every page's menu gained \"FAQ\" → /faq and kept every item it had",
    "every served header links \"FAQ\" to /faq",
  ]);
  // WHAT IT FAILED ON: every one of the eight menus gained exactly the new
  // page's link, in words of the builder's own.
  const why = saved.checks.find((c) => MENU.test(c.name)).why;
  assert.equal(why.split("; ").length, 8);
  assert.ok(why.split("; ").every((w) => w.endsWith(`menu gained [{"label":"Common questions","href":"/faq"}]`)), why);
  // THE REST PASSED: the eight progress checks, the request, the pages and the money.
  assert.equal(saved.checks.filter((c) => c.ok).length, 28);
  assert.ok(saved.replies.every((r) => r.ok) && saved.replies.length === 2);
});

test("replayed through this tree as it was pressed (its spec asking for \"FAQ\"), run 105 fails exactly as it printed", () => {
  const asPressed = { ...LP, expect: { ...LP.expect, menu: { page: 0, label: "FAQ" } } };
  const v = judge(asPressed);
  assert.equal(v.ok, false);
  assert.deepEqual(v.checks.map((c) => c.ok), FX.verdict.checks.map((c) => c.ok), "a check other than the menu's moved");
  assert.deepEqual(failedNames(v), ["every page's menu gained \"FAQ\" → /faq (the words asked for) and kept every item it had", "every served header links \"FAQ\" to /faq (the words asked for)"]);
});

test("run 105 under the corrected rule: the request names no words for the link, so a labelled link to the verified new page on every menu, items kept, passes — and nothing else moves", () => {
  assert.deepEqual({ ...LP.expect.menu }, { page: 0 }, "lv-progress's spec still asks for words its message never names");
  const v = judge();
  assert.equal(v.ok, true, JSON.stringify(failedNames(v)));
  assert.deepEqual(menuChecks(v).map(line), [
    "ok every page's menu gained one labelled link → /faq (no words were asked for) and kept every item it had",
    "ok every served header links /faq with a label (no words were asked for)",
  ]);
  // EVERY OTHER CHECK, NAME FOR NAME AND RESULT FOR RESULT, AS THE PRESS PRINTED IT.
  const others = (checks) => checks.filter((c) => !(MENU.test(c.name) || SERVED.test(c.name))).map(line);
  assert.deepEqual(others(v.checks), others(FX.verdict.checks));
  assert.equal(others(v.checks).length, 28);
  // THE PAGE IT LINKS TO IS THE ONE FOUND NEW, STORED AND SERVED 200.
  assert.equal(v.newPages.found[0].route, "/faq");
  assert.equal(v.newPages.found[0].path, "faq.tsx");
  assert.equal(v.newPages.found[0].status, 200);
});

test("any words of the builder's pass, not one listed synonym: the same evidence with every link reading 'Ask us' passes too", () => {
  const sources = Object.fromEntries(FRAMED.map(([f]) => [f, (s) => s.replace(NEW_LINK, '{ label: "Ask us", href: "/faq" }')]));
  const headers = Object.fromEntries(FRAMED.map(([, r]) => [r, (h) => h.replace(FAQ_ANCHOR, '<a href="/faq"$1>Ask us</a>')]));
  sources["faq.tsx"] = (s) => s.replace(NEW_LINK, '{ label: "Ask us", href: "/faq" }');
  const v = judge(LP, evidence({ sources, headers }));
  assert.deepEqual(menuChecks(v).filter((c) => !c.ok).map(line), []);
});

test("a missing link fails, in the stored menu and the served header, naming the page", () => {
  const v = judge(LP, evidence({ sources: { "order.tsx": (s) => s.replace(", " + NEW_LINK, "") }, headers: { "/order": (h) => h.replace(FAQ_ANCHOR, "") } }));
  const [stored, served] = menuChecks(v);
  assert.equal(stored.ok, false);
  assert.match(stored.why, /order\.tsx's menu gained \[\]/);
  assert.equal(served.ok, false);
  assert.match(served.why, /not on \/order$/);
});

test("a link to the wrong page fails, though its words are fine", () => {
  const v = judge(LP, evidence({ sources: { "order.tsx": (s) => s.replace(NEW_LINK, '{ label: "Common questions", href: "/questions" }') }, headers: { "/order": (h) => h.replace(FAQ_ANCHOR, '<a href="/questions"$1>Common questions</a>') } }));
  const [stored, served] = menuChecks(v);
  assert.equal(stored.ok, false);
  assert.match(stored.why, /order\.tsx's menu gained \[\{"label":"Common questions","href":"\/questions"\}\]/);
  assert.equal(served.ok, false);
  assert.match(served.why, /not on \/order$/);
});

test("an empty label fails, and so does one of only spaces: a link that says nothing is no label", () => {
  for (const empty of ["", "   "]) {
    const v = judge(LP, evidence({ sources: { "order.tsx": (s) => s.replace(NEW_LINK, `{ label: "${empty}", href: "/faq" }`) }, headers: { "/order": (h) => h.replace(FAQ_ANCHOR, `<a href="/faq"$1>${empty}</a>`) } }));
    const [stored, served] = menuChecks(v);
    assert.equal(stored.ok, false, JSON.stringify(empty));
    assert.match(stored.why, /order\.tsx's menu gained \[\{"label":" *","href":"\/faq"\}\]/);
    assert.equal(served.ok, false, JSON.stringify(empty));
    assert.match(served.why, /not on \/order$/);
  }
});

test("a changed, dropped or moved existing item fails, though the new link is right", () => {
  const cases = {
    changed: (s) => s.replace('{ label: "Visit", href: "/visit" }', '{ label: "Visit us", href: "/visit" }'),
    dropped: (s) => s.replace('{ label: "Bake List", href: "/bake-list" }, ', ""),
    moved: (s) => s.replace('{ label: "Visit", href: "/visit" }, { label: "Order", href: "/order" }', '{ label: "Order", href: "/order" }, { label: "Visit", href: "/visit" }'),
  };
  for (const [kind, edit] of Object.entries(cases)) {
    const [stored] = menuChecks(judge(LP, evidence({ sources: { "order.tsx": edit } })));
    assert.equal(stored.ok, false, kind);
    assert.match(stored.why, /order\.tsx's menu did not keep its own items in their order/, kind);
  }
  // A SECOND NEW LINK BESIDE IT: exactly one is the new page's.
  const [stored] = menuChecks(judge(LP, evidence({ sources: { "order.tsx": (s) => s.replace(NEW_LINK, NEW_LINK + ', { label: "Recipes", href: "/recipes" }') } })));
  assert.equal(stored.ok, false);
  assert.match(stored.why, /order\.tsx's menu gained \[\{"label":"Common questions","href":"\/faq"\},\{"label":"Recipes","href":"\/recipes"\}\]/);
});

test("the stored menus right but one served header without the link fails the served check alone", () => {
  const v = judge(LP, evidence({ headers: { "/visit": (h) => h.replace(FAQ_ANCHOR, "") } }));
  const [stored, served] = menuChecks(v);
  assert.equal(stored.ok, true, stored.why);
  assert.equal(served.ok, false);
  assert.match(served.why, /not on \/visit$/);
});

test("words the request does ask for are still required: run 105's 'Common questions' fails a request for 'FAQ', and links reading 'FAQ' pass it", () => {
  assert.ok(ASKING.steps[0].say.includes(ASKED), "the variant's message does not ask for the words");
  const ignored = judge(ASKING);
  assert.deepEqual(menuChecks(ignored).map(line), [
    "FAIL every page's menu gained \"FAQ\" → /faq (the words asked for) and kept every item it had",
    "FAIL every served header links \"FAQ\" to /faq (the words asked for)",
  ]);
  const sources = Object.fromEntries(FRAMED.map(([f]) => [f, (s) => s.replace(NEW_LINK, '{ label: "FAQ", href: "/faq" }')]));
  sources["faq.tsx"] = (s) => s.replace(NEW_LINK, '{ label: "FAQ", href: "/faq" }');
  const headers = Object.fromEntries(FRAMED.map(([, r]) => [r, (h) => h.replace(FAQ_ANCHOR, '<a href="/faq"$1>FAQ</a>')]));
  const honoured = judge(ASKING, evidence({ sources, headers }));
  assert.deepEqual(menuChecks(honoured).filter((c) => !c.ok).map(line), []);
});

test("labelFits: no words asked, any label that says something; words asked, the label must hold them; nothing else", () => {
  assert.equal(labelFits("Common questions", { page: 0 }), true);
  assert.equal(labelFits("Ask us", {}), true);
  assert.equal(labelFits("", { page: 0 }), false);
  assert.equal(labelFits("   ", { page: 0 }), false);
  assert.equal(labelFits(undefined, { page: 0 }), false);
  assert.equal(labelFits("Common questions", { label: "FAQ" }), false);
  assert.equal(labelFits("FAQ", { label: "FAQ" }), true);
  assert.equal(labelFits("Our FAQ", { label: "faq" }), true, "the words are compared as everywhere else in the verifier, case and spacing aside");
  assert.equal(labelFits("our  faq", { label: " FAQ " }), true, "the asked words are compared the same way");
  assert.equal(labelFits("", { label: "FAQ" }), false);
  assert.equal(labelWords({ label: "  FAQ " }), "FAQ");
  assert.equal(labelWords({ page: 0 }), "");
  assert.equal(labelWords({ label: 7 }), "", "a label that is not words asks for none");
});

// THE SPECS: a menu check carries words only where its own message asks for
// them, quoted from it in `asked`.
function askedProblems(name, scenario) {
  const out = [];
  const says = (scenario.steps || []).map((s) => plain(s && s.say));
  for (const key of ["menu", "menuFinish"]) {
    const m = scenario.expect && scenario.expect[key];
    if (!m || m.label === undefined) continue;
    const asked = typeof m.asked === "string" ? plain(m.asked).trim() : "";
    if (!asked) out.push(`${name}.${key} asks for "${m.label}" and cites no words of its message`);
    else if (!says.some((s) => s.includes(asked))) out.push(`${name}.${key} cites words its message does not hold: ${m.asked}`);
    else if (!asked.includes(plain(m.label).trim())) out.push(`${name}.${key} cites words that do not hold "${m.label}"`);
  }
  return out;
}

test("every scenario's menu words, where it has any, are words its own message asks for", () => {
  const withMenu = Object.entries(UI_SCENARIOS).filter(([, s]) => s.expect && (s.expect.menu || s.expect.menuFinish));
  assert.deepEqual(withMenu.map(([n]) => n), ["rq-1-classes", "rq-2-wholesale", "rq-menu-link", "lv-reopen", "lv-release", "lv-progress", "lv-combined"]);
  assert.deepEqual(withMenu.flatMap(([n, s]) => askedProblems(n, s)), []);
  // NONE OF THEIR MESSAGES NAMES THE LINK'S WORDS, so none asks for any.
  assert.deepEqual(withMenu.filter(([, s]) => labelWords(s.expect.menu || s.expect.menuFinish)).map(([n]) => n), []);
  // THE GUARD IS ALIVE: it passes a cited request and catches each way of not citing one.
  assert.deepEqual(askedProblems("asking", ASKING), []);
  const bare = { ...ASKING, expect: { menu: { page: 0, label: "FAQ" } } };
  assert.match(askedProblems("bare", bare)[0], /cites no words/);
  const elsewhere = { ...ASKING, expect: { menu: { page: 0, label: "FAQ", asked: "a link called 'FAQ'" } } };
  assert.match(askedProblems("elsewhere", elsewhere)[0], /does not hold/);
  const other = { ...ASKING, expect: { menu: { page: 0, label: "Questions", asked: ASKED } } };
  assert.match(askedProblems("other", other)[0], /do not hold "Questions"/);
});
