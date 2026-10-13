// A SECTION AND A HEADING ASKED FOR ON THE SAME PAGE (2026-10-13, run 144).
//
// Run 144 (acc-isolation-page) asked for a questions section on the Bake List
// and " — sent every Friday" appended to that page's heading. Every isolation
// check passed, but "/bake-list still says everything it said" failed with
// lost: ["join the weekly bake list"]: the section check compared every text
// run on the page and never excused the heading the edit was asked to change,
// and the page-by-page check that does excuse a heading skips any page that
// gained a section. A false failure of the instrument, not of the product.
//
// Now one run that is exactly the heading's old words, replaced by one run
// that is exactly its new words, is the edit's change (`headingSwapped`).
// Anything else lost still fails; a heading changed to other words, or a
// heading asked for on another page, excuses nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { outcomeChecks, routeOfPage, headingSwapped } from "../scripts/canary-requests.mjs";
import { plain } from "../scripts/canary-additions.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SLUG = "fold-lane-bakery";
const PAGES = ["index", "visit", "order", "gallery", "starter"].map((n) => ({ path: n + ".tsx", source: fs.readFileSync(ROOT + "test/fixtures/run47/" + n + ".before.tsx", "utf8") }));
const TABLES = { ok: true, names: [], tables: {} };
const FROM = "Come to the bakery";
const TO = "Come to the bakery — open every Friday";
const SECTION = '<section className="faq"><h2>Questions</h2><p>Can I bring my dog? Dogs are welcome inside.</p></section>';
const SPEC = { expect: { headings: [{ route: "/visit", from: FROM, to: TO }], sections: [{ route: "/visit", says: ["dogs", "welcome"] }] } };

function read(pages, { headingOf = {}, mainOf = {} } = {}) {
  const served = {}, render = {};
  for (const p of pages) {
    const r = routeOfPage(p.source);
    const h = headingOf[r] || "page";
    served[r] = `<!doctype html><html><body><header><a href="/"><img src="/u/${SLUG}/logo.png" alt="logo"/></a></header><main><h1>${h}</h1>${mainOf[r] || ""}</main></body></html>`;
    render[r] = { status: 200, headings: [h] };
  }
  return { inv: { complete: true, source: { pages, parts: [] }, render, stored: { ok: true, description: "" } }, served };
}
const edit = (pages, fn) => pages.map((p) => (p.path === "visit.tsx" ? { ...p, source: fn(p.source) } : p));
const withSection = (src) => src.replace("</SiteChrome>", SECTION + "\n    </SiteChrome>");
const judge = (b, a, spec = SPEC) => outcomeChecks({ spec, before: b.inv, after: a.inv, served: a.served, beforeServed: b.served, tables: { before: TABLES, after: TABLES }, slug: SLUG }).checks;
const bad = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name} -> ${c.why || ""}`);
const KEPT = "/visit still says everything it said";

test("SH 1 — RUN 144'S SHAPE: the section added and the heading changed exactly as asked on the same page — every check passes, the preservation check included", () => {
  assert.ok(PAGES.find((p) => p.path === "visit.tsx").source.includes(`>${FROM}</h1>`), "the fixture's heading is gone");
  const b = read(PAGES, { headingOf: { "/visit": FROM } });
  const a = read(edit(PAGES, (s) => withSection(s.replace(`>${FROM}</h1>`, `>${TO}</h1>`))), { headingOf: { "/visit": TO }, mainOf: { "/visit": SECTION } });
  const c = judge(b, a);
  assert.ok(c.some((x) => x.name === KEPT), "the observer is alive: the preservation check ran");
  assert.ok(c.some((x) => x.name === `/visit's heading "${FROM}" now reads "${TO}" on the served page` && x.ok));
  assert.deepEqual(bad(c), []);
});

test("SH 2 — CONTROLS: other words lost beside the swap still fail; the heading changed to words other than asked is still lost; a heading asked for on another page excuses nothing", () => {
  const b = read(PAGES, { headingOf: { "/visit": FROM } });
  // OTHER WORDS LOST, the heading swapped as asked.
  const lostToo = edit(PAGES, (s) => withSection(s.replace(`>${FROM}</h1>`, `>${TO}</h1>`).replace("The shutters and the street", "The street")));
  const c1 = judge(b, read(lostToo, { headingOf: { "/visit": TO }, mainOf: { "/visit": SECTION } }));
  assert.ok(bad(c1).some((n) => n.startsWith(KEPT) && !n.includes(plain(FROM))), JSON.stringify(bad(c1)));
  // THE HEADING CHANGED TO OTHER WORDS.
  const other = edit(PAGES, (s) => withSection(s.replace(`>${FROM}</h1>`, ">Come to the bakery today</h1>")));
  const c2 = judge(b, read(other, { headingOf: { "/visit": "Come to the bakery today" }, mainOf: { "/visit": SECTION } }));
  assert.ok(bad(c2).some((n) => n.startsWith(KEPT) && n.includes(plain(FROM))), JSON.stringify(bad(c2)));
  // THE HEADING ASKED FOR ON ANOTHER PAGE: the Visit heading's change is not excused.
  const elsewhere = { expect: { headings: [{ route: "/order", from: FROM, to: TO }], sections: SPEC.expect.sections } };
  const c3 = judge(b, read(edit(PAGES, (s) => withSection(s.replace(`>${FROM}</h1>`, `>${TO}</h1>`))), { headingOf: { "/visit": TO }, mainOf: { "/visit": SECTION } }), elsewhere);
  assert.ok(bad(c3).some((n) => n.startsWith(KEPT) && n.includes(plain(FROM))), JSON.stringify(bad(c3)));
});

test("SH 3 — headingSwapped itself: only an exact old run with an exact new run is excused, one for one; malformed headings excuse nothing; the inputs are not mutated", () => {
  const H = [{ route: "/x", from: "Join the weekly bake list", to: "Join the weekly bake list — sent every Friday" }];
  const lost = ["join the weekly bake list"], gained = ["join the weekly bake list — sent every friday", "questions"];
  assert.deepEqual(headingSwapped(lost, gained, H), { lost: [], gained: ["questions"] });
  assert.deepEqual(lost, ["join the weekly bake list"]);
  // NO NEW RUN: nothing excused.
  assert.deepEqual(headingSwapped(lost, ["questions"], H), { lost, gained: ["questions"] });
  // TWO OLD RUNS, ONE NEW: one excused.
  assert.deepEqual(headingSwapped([...lost, ...lost], gained, H).lost, lost);
  // A PREFIX IS NOT THE HEADING.
  assert.deepEqual(headingSwapped(["join the weekly"], gained, H).lost, ["join the weekly"]);
  for (const h of [null, {}, { from: 1, to: "x" }, { from: "Join the weekly bake list" }]) assert.deepEqual(headingSwapped(lost, gained, [h]), { lost, gained });
  assert.deepEqual(headingSwapped(lost, gained, null), { lost, gained });
});
