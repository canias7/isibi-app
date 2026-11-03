// PARKED (2026-11-03, park-old-way): the old-way half of test/site-layout.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE FRAME'S OWN ARRANGEMENT — where the name sits, how wide the bar runs,
// whether it follows the reader down the page.
//
// WHAT WAS WRONG. `SiteHeader` took brand/links/action and hardcoded `h-14`,
// `max-w-6xl`, `ml-auto` and `sticky`, and `className` could not reach it —
// `SiteChrome` puts that on the outer div, and 0 of 329 corpus pages pass one.
// So "centre our logo" had no path at ANY price: not by typing, and not by
// paying for a full rebuild either, because there was no slot to fill.
//
// THE GUARD THAT MATTERS MOST IS THE WIDENING ONE. A page writes its frame as
// `const CHROME = { ..., layout: { brand: "centre" } }` and spreads it — 261 of
// the 318 exemplars use exactly that shape — and a `const` object's property
// widens to `string`, which a bare literal union REFUSES. Measured: the plain
// union fails TS2322 against the real reference pages, so a customer asking to
// centre their logo would lose the whole site to a failed typecheck. The
// behavioural half of that is asserted by COMPILING the shape in
// test/integration/site-build.mjs, because only a build can show it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CHROME_OBJECTS, LAYOUT_FIELDS, applyLayout, applyContact, chromeObjectSlots,
  readChromeObject, readNav, navDigest, navReply, runNavEdit, NAV_TOOL,
} from "../../../builder/site-nav.mjs";
import { ASK_TOOL } from "../../../builder/route-shared.mjs";

const UI = path.join(import.meta.dirname, "../../../builder/lovable/template/src/components/ui");
const header = fs.readFileSync(path.join(UI, "site-header.tsx"), "utf8");
const chrome = fs.readFileSync(path.join(UI, "site-chrome.tsx"), "utf8");
const workerSrc = fs.readFileSync(path.join(import.meta.dirname, "../../../worker.js"), "utf8");

/** The destructured parameter names of a component, in source order. */
function propsOf(src, name) {
  const i = src.indexOf(`export function ${name}({`);
  assert.ok(i >= 0, `${name} is not declared the way this scan expects`);
  const open = src.indexOf("{", i);
  const close = src.indexOf("}", open);
  return src.slice(open + 1, close).split(",").map((s) => s.split("=")[0].trim()).filter(Boolean);
}

const page = (path_, source) => ({ path: path_, source });
const CHROME_PAGE = (extra = "") => page("index.tsx",
  `const CHROME = {\n  name: "Cutler Row",\n${extra}};\nexport default function Home() { return <SiteChrome {...CHROME}>x</SiteChrome>; }`);

test("the Worker carries the arrangement back, and the router knows the lane owns it", () => {
  // Either end alone passes while the wire is cut — the thirteen recorded
  // wiring deaths. Values rather than names here, unlike `contact`: these are
  // OUR enum, never anything the customer typed.
  assert.match(workerSrc, /layout: nOut\.layout \|\| undefined,/,
    "the nav branch computes a layout and the response never carries it");
  // WINDOWED TO THE nav CLAUSE, and bounded by the NEXT layer's own heading —
  // a window running to a fixed byte count stops covering what it was written
  // for the moment a comment or a sentence lands above it, which is this repo's
  // most repeated own-goal.
  const nav = ASK_TOOL.input_schema.properties.layer.description;
  const from = nav.indexOf('"nav" \u2014');
  assert.ok(from > 0, "the layer description no longer opens the nav clause the way this scan expects");
  const nextHeading = /\n"[a-z]+" \u2014/.exec(nav.slice(from + 8));
  const seg = nav.slice(from, nextHeading ? from + 8 + nextHeading.index : undefined);
  assert.ok(seg.length > 200, "the nav clause window collapsed to nothing");
  assert.match(seg, /centre our logo/i,
    "the router never points a frame change at the nav lane, so every layer below it is unreachable");
  assert.match(seg, /"look"/,
    "the router does not say colours are a different lane, which is the confusion this axis invites");
});

/* ── the page body's own width ───────────────────────────────────────────── */

// `<main>` HAS NO WIDTH, SO THE PAGE HAS TO SET ITS OWN — and for a while
// nothing said so. Measured live on run 37 (`northgroup-3`): the header ran at
// `max-w-6xl` with a 24px gutter, the hero's inner div at `max-w-4xl`, and
// every band below it edge to edge with no gutter at all. Three widths on one
// page, and the two that looked deliberate were the two the model did not
// write. `PAGE_RULES` carried 0 `max-w`, 0 `mx-auto` and 0 `px-6` — the four
// reference pages that were the only thing teaching it became DATA rather than
// prompt on 2026-08-24, and nothing replaced them.
//
// DERIVED AT BOTH ENDS, because the rule is only true while the frame is what
// it is: a container added to `<main>` later would make rule 16 a second,
// disagreeing opinion about one width, and this says so rather than letting the
// two drift quietly.
//
// NO CONDITIONAL FOR `width: "full"`, and that was checked rather than assumed.
// `contained` is the default and `full` only ever arrives on request — and a
// full-bleed bar over a contained column is an ordinary, deliberate look. The
// bug is the INVERSE, a contained bar over a body that escapes past it, so
// `max-w-6xl` on the body is right under both arrangements. Do not "fix" this
// by making the rule conditional; a rule whose condition the model can get
// wrong reproduces the bug it replaced.

/**
 * Comments blanked, LENGTH-PRESERVING, so an index into the result is an index
 * into the file.
 *
 * BOTH ASSERTIONS BELOW WERE VACUOUS WITHOUT IT AND A SWEEP IS WHAT SHOWED IT.
 * `site-chrome.tsx`'s own docstring says "the page's single `<main>`", so
 * `indexOf("<main")` landed on the PROSE at offset 1088 and sliced `<main>` —
 * a tag with no className, which passes a "no width here" check whatever the
 * real one carries. And `site-header.tsx` line 89 argues about `max-w-6xl` in
 * a comment, so a bare match found the argument rather than the code and the
 * width could move underneath it. Prose containing the thing it asserts, twice
 * in one file, in the guard written for exactly that.
 */
function noComments(src) {
  const out = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length));
  assert.equal(out.length, src.length, "the blanker moved the offsets it exists to preserve");
  return out;
}
