// Renaming a page's ROUTE — its address, not its heading.
//
// There was no rename verb anywhere in the product: "call that page Services"
// routed to the `page` layer and changed the heading, leaving the address. And
// delete-and-add is worse — the SEO map 301s the old URL to HOME, because
// old→new is a guess it deliberately does not make.
import test from "node:test";
import assert from "node:assert/strict";
import { renameRoute } from "../builder/site-apply.mjs";

// The ONE reading of file↔route, injected rather than reimplemented — this repo
// has written that mapping four times and each copy was wrong at least once.
const routeOf = (p) => "/" + String(p).replace(/^src\/routes\//, "").replace(/\.tsx$/, "")
  .replace(/\/index$/, "").replace(/\./g, "/").replace(/^index$/, "");

const site = () => [
  { path: "index.tsx", source: 'createFileRoute("/")\n<Link to="/what-we-do">What we do</Link>\n<Link to="/book">Book</Link>' },
  { path: "what-we-do.tsx", source: 'createFileRoute("/what-we-do")\n<h1>What we do</h1>' },
  { path: "book.tsx", source: 'createFileRoute("/book")\n<Link to="/what-we-do">See our work</Link>' },
];

test("the page moves AND every page that links to it is rewritten", () => {
  // The half that makes it a rename rather than a break: those links are typed
  // against the route tree, so leaving one behind is a COMPILE ERROR that costs
  // the whole build — not a dead link.
  const r = renameRoute(site(), "/what-we-do", "/services", routeOf);
  assert.equal(r.ok, true, r.reason);
  const by = Object.fromEntries(r.pages.map((p) => [p.path, p.source]));
  assert.ok(by["services.tsx"], "the file did not move: " + Object.keys(by));
  assert.match(by["services.tsx"], /createFileRoute\("\/services"\)/);
  assert.match(by["index.tsx"], /to="\/services"/);
  assert.match(by["book.tsx"], /to="\/services"/);
  assert.equal(r.pages.filter((p) => /what-we-do/.test(p.source)).length, 0, "a stale reference survived");
});

test("it hands back the old→new pair the redirect map needs", () => {
  // Without this the 301 lands on the HOME page, which is what delete-and-add
  // already did and is the reason renaming needed a verb of its own.
  const r = renameRoute(site(), "/what-we-do", "/services", routeOf);
  assert.deepEqual(r.redirect, { from: "/what-we-do", to: "/services" });
});

test("a prefix is not a match", () => {
  // `/about` must not rewrite inside `/about-us`. The prefix bug this repo has
  // already paid for once in the hostname rewrite.
  const pages = [
    { path: "index.tsx", source: '<Link to="/about-us">Us</Link><Link to="/about">About</Link>' },
    { path: "about.tsx", source: 'createFileRoute("/about")' },
    { path: "about-us.tsx", source: 'createFileRoute("/about-us")' },
  ];
  const r = renameRoute(pages, "/about", "/story", routeOf);
  assert.equal(r.ok, true, r.reason);
  const idx = r.pages.find((p) => p.path === "index.tsx").source;
  assert.match(idx, /to="\/about-us"/, "the longer route was rewritten by a prefix match");
  assert.match(idx, /to="\/story"/);
});

test("the three refusals, each because the alternative is a broken site", () => {
  for (const [from, to, why] of [
    ["/", "/home", "the home page has no address to move"],
    ["/book", "/", "a page cannot be renamed to the home page"],
    ["/book", "/what-we-do", "there is already a page at"],
    ["/nope", "/x", "no page at"],
    ["/book", "/Book Me", "not a usable address"],
  ]) {
    const r = renameRoute(site(), from, to, routeOf);
    assert.equal(r.ok, false, from + " -> " + to + " should refuse");
    assert.match(r.reason, new RegExp(why.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), r.reason);
  }
});

test("it refuses rather than throwing when it cannot read routes", () => {
  assert.equal(renameRoute(site(), "/book", "/x", null).ok, false);
});
