// PARKED (2026-11-03, park-old-way): the old-way half of test/site-files.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ONE EDITABLE VIEW: THE PAGES AND THE SITE'S OWN COMPONENTS (2026-09-11).
//
// The band split gives every section its own file under `-parts/`, so the prose
// a customer asks to change no longer lives in the page. `site-tweak.mjs` and
// `site-apply.mjs` contain ZERO references to `parts` — read them — so the two
// cheapest rungs were handed page source only, and after the split a `text` lane
// reading `pages` alone would look at a shell of imports, match none of the
// words and escalate a one-credit wording change to the full page rewrite. Every
// time.
//
// `editableFiles` presents a part with a path, which is all `textItems` and
// `applyEdits` ever look at — neither interprets one — so the rungs are
// unchanged and the mapping lives in one file. What these guards hold:
//
//   • the round trip is an IDENTITY, because a component that came back as a
//     page would be counted against the page cap and published in sitemap.xml;
//   • a page that merely looks like a part is not one;
//   • and the whole point, DRIVEN through the real rung: an edit reaches a
//     separated section and changes it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { editableFiles, splitEditable, partPath, partNameOf, PART_DIR, codeOnly, importSpecs, importsPart, partUse, partUses } from "../../../builder/site-files.mjs";
import { codeOnly as pictureCodeOnly } from "../../../builder/site-picture.mjs";
import { runTextEdit, textItems } from "../../../builder/site-apply.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = fs.readFileSync(path.join(here, "../../../worker.js"), "utf8");

test("the text lane reads BOTH stores, and both halves are published", () => {
  // A CHAIN ASSERTED AT THE LAYER BELOW THE BREAK is this repository's most
  // expensive recorded shape, so the two hops that carry the parts into and out
  // of the rung are read where they happen.
  const at = WORKER.indexOf('if (eLayer === "text") {');
  assert.ok(at > 0, "the text lane is gone");
  // LANDMARK TO LANDMARK, never a byte window, and the closing one is the NEXT
  // lane rather than a name that happens to sit below: `picture` is not the next
  // branch, `look` is, and windowing to an absent landmark gives `slice(a, -1)`
  // — the whole rest of the file, which passes on anything.
  const end = WORKER.indexOf('if (eLayer === "look"', at);
  assert.ok(end > at, "the lane after `text` moved — re-derive the closing landmark");
  const lane = WORKER.slice(at, end);
  // RE-DERIVED 2026-10-02, 8,000 to 9,000: the lane grew one line, the check
  // that its model asked a question back (`stepAsk`), and measures 8,095. The
  // ceiling is what proves the slice is the lane and not the rest of the file.
  // RE-DERIVED 2026-10-23, 9,000 to 15,000: the lane carries the translated-page
  // edit (#196, `eLangEdit`), and measures about 13,600.
  // RE-DERIVED 2026-10-26, 15,000 to 17,000: the email change carried to its
  // links and copies (run 6, `carryEmailChange`); measures about 15,000.
  assert.ok(lane.length > 200 && lane.length < 17000, "re-derive this window");
  assert.match(lane, /editableFiles\(eSrc, eParts\)/, "the lane no longer shows the rung the site's components");
  // RE-ANCHORED 2026-09-20, and the move is the fix rather than a rename.
  // `loadSiteParts` COLLAPSES "this site has no components" and "the read
  // threw" into one `null`, and on this lane the second was the expensive
  // one: `editableFiles(eSrc, null)` presents the pages alone, `splitEditable`
  // answers `parts: []`, and both the spine's preference and its save take an
  // empty array at face value — so a one-word wording change REWROTE
  // `source/<slug>/parts.json` to `[]`. Measured through the real route
  // before the fix. `editParts()` is the message-wide three-state snapshot.
  assert.match(lane, /const eTextParts = await editParts\(\);/, "the lane never reads the components");
  assert.match(lane, /if \(!eTextParts\.ok\)/, "an unreadable components store is not refused, so the publish empties the inventory");
  assert.match(lane, /"parts-unreadable"/, "the refusal does not name itself");
  // AND IT REFUSES ABOVE THE MODEL CALL, so a retry a minute later has paid
  // for neither attempt. Driven for cost and call count in
  // `test/edit-page-context.test.mjs`; the property here is the ORDER.
  assert.ok(lane.indexOf("const eTextParts") < lane.indexOf("runTextEdit("),
    "the components store is read after the model call it should refuse before");
  // 2026-10-26: what came back passes through the email carry (run 6) first.
  assert.match(lane, /const eMail = carryEmailChange\(out\.pages, out\.edits, \{ keepLinks: out\.keepLinks === true \}\);/, "the step's pages no longer reach the email carry");
  assert.match(lane, /splitEditable\(eMail\.pages\)/, "what came back is published without being split — a component would be stored as a page");
  // BOTH HALVES TO THE PUBLISH, and the parts EVERY time rather than only when
  // one changed: `recompileAndPublish` stores the list it is handed, so handing
  // it the changed ones alone would take every untouched component off the site.
  assert.match(lane, /pages: eSplit\.pages, parts: eSplit\.parts/, "the publish is handed one half of the source");
});

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT EVIDENCE, AND THE PLACEMENT QUESTION UNDER IT (2026-09-20)

   Owner: *"importsPart matches commented-out imports… Exclude comments and
   quoted examples from import evidence. An unused import must not establish
   placement. Where placement cannot be established, preserve uncertainty."*

   DRIVEN AT THE MODULE BECAUSE THE ROUTE CANNOT REACH EVERY SHAPE. A namespace
   import, a dynamic one, a `require`, a clause spread over four lines and an
   identifier holding a regex metacharacter are all things these functions are
   exported and handed; `validatePages` stops most of them ever arriving through
   the product, which is exactly why they need a guard where they live.
   ═════════════════════════════════════════════════════════════════════════ */

const SPEC = "@/routes/-parts/photo-wall";
