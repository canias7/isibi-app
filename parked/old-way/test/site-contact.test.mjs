// PARKED (2026-11-03, park-old-way): the old-way half of test/site-contact.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE FOOTER'S CONTACT DETAILS, on the nav lane — and the comment-blind bracket
// scanner that fixing it exposed.
//
// The slots shipped on 2026-08-18 and only a fresh build could fill them: every
// site published before that could never get a phone number in its footer short
// of a ~27-credit rewrite. That is the on-disk-and-reachable-by-nothing shape
// this repo has deleted 289 files over, so the wiring is what most of this file
// asserts.
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CONTACT_FIELDS, MAX_CONTACT_CHARS, contactSlots, readContact, applyContact,
  navSlots, actionSlots, navDigest, readNav, navReply, runNavEdit, NAV_TOOL,
  chromeListSlots, applyChromeList,
} from "../../../builder/site-nav.mjs";
import { ASK_TOOL } from "../../../builder/route-shared.mjs";
import { COMPONENT_TYPES } from "../../../builder/component-api.mjs";

const ROUTES = path.join(import.meta.dirname, "../../../builder/lovable/template/src/routes");
const page = (f) => ({ path: f, source: fs.readFileSync(path.join(ROUTES, f), "utf8") });
const REF = () => ["index.tsx", "book.tsx", "manage.tsx", "account.tsx"].map(page);

test("the Worker forwards which fields moved, and not the values", () => {
  const worker = fs.readFileSync(path.join(import.meta.dirname, "../../../worker.js"), "utf8");
  const nav = worker.slice(worker.indexOf('if (eLayer === "nav")'), worker.indexOf('if (eLayer === "picture")'));
  assert.ok(nav.length > 500, "the nav branch could not be sliced out");
  assert.match(nav, /contact:\s*nOut\.contact\s*\?\s*Object\.keys\(nOut\.contact\)/,
    "the nav branch does not forward `contact`, or forwards the customer's own values");
});

// THE `nav` CLAUSE, WINDOWED FROM ITS OWN NAME TO THE NEXT LAYER'S — and the
// closing landmark is searched FROM the opening one, which is what this helper
// exists for.
//
// It was `layer.indexOf('"page"')` from the start of the whole description, and
// on 2026-09-08 the `look` clause gained a sentence naming layer "page" (the
// exception that a whole-page deletion is `page` + `remove`, not a removal
// worked out in the lane system). That occurrence sits BEFORE `"nav"`, so the
// window became `slice(bigger, smaller)` — the empty string, which matches
// nothing and reported the socials and the footer as missing from a clause that
// still says both. The recorded landmark trap, in the ordinary direction: a
// window is only as good as its landmarks are unique, and prose one section
// over can make one that was.
//
// The property both callers assert is unchanged — `nav` is where a footer, a
// social icon and a small-print link are routed — so this re-anchors rather
// than relaxes: both ends are asserted, and the clause must still be a real
// one, or a rename of either layer name would pass on an empty window.
function navClause() {
  const layer = ASK_TOOL.input_schema.properties.layer.description;
  const at = layer.indexOf('"nav"');
  assert.ok(at > 0, "the router description no longer names a `nav` layer at all");
  const end = layer.indexOf('"page"', at);
  assert.ok(end > at, "the router description has no `page` layer after `nav` to window against");
  const nav = layer.slice(at, end);
  assert.ok(nav.length > 200, "the nav clause could not be sliced out of the router description");
  return nav;
}

test("the Worker forwards the list counts, and not the addresses", () => {
  const worker = fs.readFileSync(path.join(import.meta.dirname, "../../../worker.js"), "utf8");
  const nav = worker.slice(worker.indexOf('if (eLayer === "nav")'), worker.indexOf('if (eLayer === "picture")'));
  assert.match(nav, /lists: nOut\.lists/, "the nav branch does not forward `lists`");
  assert.match(nav, /\[k, v\.length\]/, "the nav branch forwards the entries rather than their counts");
});
