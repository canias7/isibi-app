// ── A BAND-BUILT HOME PAGE: ITS BUTTON READ, ITS MENU REACHABLE (audit A27-2) ─
//
// A first build split into bands writes the home page through `pageShell`,
// which serialised the button with JSON.stringify (`action={{"label":…}}`,
// quoted keys). The menu step's reader only matched unquoted keys, so the
// button read as "(no words) -> (no link)" and a wording change made up its
// link. And a one-page plan writes no `links`, so when a page was added later
// every menu gained it except the home page's, which the menu step never saw.
//
// Now the reader takes quoted keys, the shell writes unquoted ones, the shell's
// menu items carry `href` (the kit's `NavLink`), and an added menu item gives
// a site-chrome header with no menu one, copied from the site's other menus.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageShell } from "../builder/page-bands.mjs";
import { actionSlots, navSlots, applyAdditions, applyAction } from "../builder/site-nav.mjs";

const home = () => ({
  path: "index.tsx",
  source: pageShell({ route: "/", chrome: { name: "Fold Lane", action: { label: "Order a loaf", href: "/#order" } }, names: ["Hero", "Order"] }),
});
const gifts = {
  path: "gifts.tsx",
  source: pageShell({ route: "/gifts", chrome: { name: "Fold Lane", links: [{ label: "Home", href: "/" }, { label: "Gifts", href: "/gifts" }], action: { label: "Order a loaf", href: "/#order" } }, names: ["Gifts"] }),
};

test("the shell's button is read with its words and its link", () => {
  const [s] = actionSlots([home()]);
  assert.deepEqual(s.action, { label: "Order a loaf", href: "/#order" });
  assert.deepEqual(s.known, { label: "Order a loaf", href: "/#order" });
});

test("a button written with quoted keys is read too", () => {
  const p = { path: "index.tsx", source: '<SiteChrome name="X" action={{"label":"Call","href":"tel:+441140000000"}}>\n</SiteChrome>' };
  assert.deepEqual(actionSlots([p])[0].action, { label: "Call", href: "tel:+441140000000" });
  const n = { path: "index.tsx", source: '<SiteChrome name="X" links={[{"label":"Visit","href":"/visit"}]}>\n</SiteChrome>' };
  assert.deepEqual(navSlots([n])[0].items, [{ label: "Visit", href: "/visit" }]);
});

test("changing the button's words keeps its link", () => {
  const out = applyAction([home()], { label: "Order bread", href: "/#order" }, false);
  assert.deepEqual(actionSlots(out.pages)[0].action, { label: "Order bread", href: "/#order" });
});

test("a page added to the menu reaches the home page's header, which had no menu", () => {
  const r = applyAdditions([home(), gifts], [{ to: "menu", item: { label: "Gifts", href: "/gifts" } }]);
  const homeSlots = navSlots(r.pages).filter((s) => s.page === "index.tsx");
  assert.equal(homeSlots.length, 1);
  assert.deepEqual(homeSlots[0].items, [{ label: "Gifts", href: "/gifts" }]);
  assert.ok(r.changed.includes("index.tsx"));
  assert.ok(r.report[0].targets.includes("index.tsx"));
  assert.ok(r.report[0].added.includes("index.tsx"));
  // The home page gains no link to itself (the kit's convention).
  assert.ok(!homeSlots[0].items.some((it) => it.href === "/"));
});

test("a site with no menu anywhere is not given one", () => {
  const r = applyAdditions([home()], [{ to: "menu", item: { label: "Gifts", href: "/gifts" } }]);
  assert.equal(navSlots(r.pages).length, 0);
});

test("the shell writes menu items with href, as the kit's NavLink reads", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("function chromeFor(");
  assert.ok(at > 0);
  const body = w.slice(at, w.indexOf("\n}\n", at));
  assert.match(body, /href:\s*path/);
  assert.doesNotMatch(body, /\bto:\s*path/);
});
