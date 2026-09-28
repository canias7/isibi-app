// TEST 5's ACCEPTANCE: a page removal is judged by what its operations did.
//
// Run 47 (2026-09-27) printed "UI MODE PASSED: 2 messages sent": both messages
// got a reply and the composer came back, while the menu edit had answered
// `look/no-change`, the removal had been refused `kept`, and nothing on the
// site had moved. These cases drive `removalVerdict` over run 47's own record
// (it must fail), over a real removal built by the menu rung's own writer (it
// must pass), and over each way a removal can fall short.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { removalVerdict, addressVerdict, menusOf, outsideMenus } from "../scripts/canary-remove.mjs";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";
import { applyNav } from "../builder/site-nav.mjs";

const SPEC = UI_SCENARIOS["5-page-remove"].removal;
const ORIGIN = "https://fold-lane-bakery.gofarther.app";
const PATHS = ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx", "gallery.tsx"];
const PAGES = PATHS.map((path) => ({
  path, source: fs.readFileSync(new URL("./fixtures/run47/" + path.replace(/\.tsx$/, ".before.tsx"), import.meta.url), "utf8"),
}));
const BEFORE = { pages: PAGES, parts: [], complete: true };
const MENU = [
  { label: "Today's bake", href: "/" },
  { label: "The starter", href: "/starter" },
  { label: "Visit", href: "/visit" },
];
// THE REAL REMOVAL, BUILT BY THE MENU RUNG'S OWN WRITER: the menu without
// Gallery on every page, then the gallery page gone.
const AFTER_MENU = applyNav(PAGES, MENU).pages;
const AFTER = { pages: AFTER_MENU.filter((p) => p.path !== "gallery.tsx"), parts: [], complete: true };

// Run 47's two stored replies, verbatim from its evidence.
const RUN47 = [
  { ok: false, error: "no-change", cost: 0, unchanged: true, msg: "I couldn't work out how to change the site's look that way. Say which part — a colour, the fonts, a section — and what it should look like." },
  { ok: false, error: "kept", cost: 0, unchanged: true, msg: "I left /gallery — / still links to it. Ask me to take the link out first." },
];
const GOOD = [
  { ok: true, layer: "nav", msg: "✅ Updated the menu on 4 pages: Today's bake · The starter · Visit.", links: MENU },
  { ok: true, layer: "page", removed: ["gallery.tsx"], msg: "✅ Took /gallery off the site." },
];
const CHAIN2 = { verified: true, why: "verified", target: "v2", links: 2 };
const MOVED = { status: 301, location: ORIGIN + "/" };
const failing = (v) => v.checks.filter((c) => !c.ok).map((c) => c.name);

test("the scenario names what a removal is: the page file, its address and the one menu link", () => {
  assert.deepEqual({ ...SPEC, link: { ...SPEC.link } }, { page: "gallery.tsx", route: "/gallery", link: { label: "Gallery", href: "/gallery" } });
  assert.ok(Object.isFrozen(SPEC) && Object.isFrozen(SPEC.link));
});

test("RUN 47'S OWN RECORD IS NOT A REMOVAL — two replies, a usable composer and a VERIFIED chain of nothing", () => {
  // What run 47 had: both replies, the chain VERIFIED with no publish, the
  // site byte for byte as it was, and /gallery still a page.
  const v = removalVerdict({
    spec: SPEC, replies: RUN47, chain: { verified: true, why: "verified", target: "8btpep", links: 0 },
    before: BEFORE, after: { ...BEFORE }, address: { status: 200, location: "" }, origin: ORIGIN,
  });
  assert.equal(v.ok, false);
  assert.deepEqual(failing(v), [
    "message 1's job stored a menu success whose menu has no link to /gallery",
    "message 2's job stored a success that removed exactly gallery.tsx",
    "both messages published, in order, and the after-read saw the last version",
    "the stored source lost gallery.tsx and no other page",
    "every other page changed only in its menu, which lost exactly the Gallery link",
    "no other page links to /gallery any more",
    "/gallery sends a visitor to the home page",
  ]);
  assert.match(v.checks[0].why, /no-change/);
  assert.match(v.checks[1].why, /kept/);
});

test("a real removal passes every check: both stored successes, two publishes, the source and the old address", () => {
  const v = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: BEFORE, after: AFTER, address: MOVED, origin: ORIGIN });
  assert.deepEqual(failing(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
  assert.equal(v.ok, true);
  assert.equal(v.checks.length, 9);
  // The observer is alive: the writer really did move the menus it compares.
  assert.notEqual(AFTER.pages.find((p) => p.path === "index.tsx").source, PAGES[0].source);
  assert.equal(outsideMenus(AFTER.pages.find((p) => p.path === "index.tsx").source), outsideMenus(PAGES[0].source));
  assert.deepEqual(menusOf(AFTER.pages.find((p) => p.path === "index.tsx").source), [MENU]);
});

test("the menu edit shipped and the removal was refused: still not a removal", () => {
  const menuOnly = { pages: AFTER_MENU, parts: [], complete: true };
  const v = removalVerdict({
    spec: SPEC, replies: [GOOD[0], RUN47[1]], chain: { verified: true, why: "verified", target: "v1", links: 1 },
    before: BEFORE, after: menuOnly, address: { status: 200, location: "" }, origin: ORIGIN,
  });
  assert.equal(v.ok, false);
  assert.deepEqual(failing(v), [
    "message 2's job stored a success that removed exactly gallery.tsx",
    "both messages published, in order, and the after-read saw the last version",
    "the stored source lost gallery.tsx and no other page",
    "/gallery sends a visitor to the home page",
  ]);
});

test("the removal was never sent (the gate stopped it): unsuccessful, and says why", () => {
  const v = removalVerdict({
    spec: SPEC, replies: [RUN47[0], null], chain: { verified: true, why: "verified", target: "8btpep", links: 0 },
    before: BEFORE, after: { ...BEFORE }, address: { status: 200, location: "" }, origin: ORIGIN,
  });
  assert.equal(v.ok, false);
  assert.match(v.checks[1].why, /not sent, or no stored reply was read/);
});

test("a stored success that removed more, or less, than the one page is not this removal", () => {
  for (const removed of [["gallery.tsx", "visit.tsx"], [], ["visit.tsx"], "gallery.tsx"]) {
    const v = removalVerdict({ spec: SPEC, replies: [GOOD[0], { ...GOOD[1], removed }], chain: CHAIN2, before: BEFORE, after: AFTER, address: MOVED, origin: ORIGIN });
    assert.deepEqual(failing(v), ["message 2's job stored a success that removed exactly gallery.tsx"], JSON.stringify(removed));
  }
  // A menu success that still links to the page, or at another layer, is not the menu step.
  for (const menu of [{ ...GOOD[0], links: [...MENU, SPEC.link] }, { ...GOOD[0], layer: "look" }, { ...GOOD[0], ok: "true" }, { ...GOOD[0], links: undefined }]) {
    const v = removalVerdict({ spec: SPEC, replies: [menu, GOOD[1]], chain: CHAIN2, before: BEFORE, after: AFTER, address: MOVED, origin: ORIGIN });
    assert.deepEqual(failing(v), ["message 1's job stored a menu success whose menu has no link to /gallery"], JSON.stringify(menu));
  }
});

test("a change outside a menu, a menu that lost more than the link, or another page gone, fails the source checks", () => {
  const bump = (fn) => ({ ...AFTER, pages: AFTER.pages.map((p) => (p.path === "visit.tsx" ? { ...p, source: fn(p.source) } : p)) });
  const prose = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: BEFORE, after: bump((s) => s.replace("Come to the bakery", "Come to the shop")), address: MOVED, origin: ORIGIN });
  assert.deepEqual(failing(prose), ["every other page changed only in its menu, which lost exactly the Gallery link"]);
  assert.match(prose.checks.find((c) => !c.ok).why, /visit\.tsx changed outside its menu/);
  const lost = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: BEFORE,
    after: { ...AFTER, pages: applyNav(AFTER.pages, MENU.slice(1)).pages }, address: MOVED, origin: ORIGIN });
  assert.deepEqual(failing(lost), ["every other page changed only in its menu, which lost exactly the Gallery link"]);
  const gone = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: BEFORE,
    after: { ...AFTER, pages: AFTER.pages.filter((p) => p.path !== "starter.tsx") }, address: MOVED, origin: ORIGIN });
  assert.ok(failing(gone).includes("the stored source lost gallery.tsx and no other page"));
  const part = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: BEFORE, after: { ...AFTER, parts: [{ path: "-parts/x.tsx", source: "x" }] }, address: MOVED, origin: ORIGIN });
  assert.deepEqual(failing(part), ["the stored components are byte for byte what they were"]);
  // A page that still names the old address.
  const linked = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: BEFORE,
    after: { ...AFTER, pages: AFTER_MENU.filter((p) => p.path !== "gallery.tsx").map((p) => (p.path === "order.tsx" ? { ...p, source: p.source + '\n// see "/gallery"' } : p)) }, address: MOVED, origin: ORIGIN });
  assert.ok(failing(linked).includes("no other page links to /gallery any more"));
});

test("a source read that did not answer proves no absence — every source check fails", () => {
  for (const [b, a] of [[{ ...BEFORE, complete: false }, AFTER], [BEFORE, { ...AFTER, complete: null }], [BEFORE, null]]) {
    const v = removalVerdict({ spec: SPEC, replies: GOOD, chain: CHAIN2, before: b, after: a, address: MOVED, origin: ORIGIN });
    assert.equal(v.ok, false);
    for (const name of ["both source reads are complete", "the stored source lost gallery.tsx and no other page",
      "every other page changed only in its menu, which lost exactly the Gallery link", "no other page links to /gallery any more"]) {
      assert.ok(failing(v).includes(name), name + " passed on an incomplete read");
    }
  }
});

test("the old address must be a 301 to this site's home page, read without following it", () => {
  assert.equal(addressVerdict({ status: 301, location: ORIGIN + "/" }, ORIGIN).ok, true);
  assert.equal(addressVerdict({ status: 301, location: "/" }, ORIGIN).ok, true, "a relative location resolves against the site");
  for (const [res, why] of [
    [{ status: 200, location: "" }, /200/], [{ status: 404, location: "" }, /404/], [{ status: 302, location: ORIGIN + "/" }, /302/],
    [{ status: 301, location: ORIGIN + "/order" }, /not https/], [{ status: 301, location: "https://evil.example/" }, /not https/],
    [{ status: 301, location: "" }, /no location|not https/], [null, /not read/], [{ status: "301" }, /not read/],
  ]) {
    const v = addressVerdict(res, ORIGIN);
    assert.equal(v.ok, false, JSON.stringify(res));
    assert.match(v.why, why, JSON.stringify(res));
  }
});
