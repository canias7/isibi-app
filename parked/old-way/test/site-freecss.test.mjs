// PARKED (2026-11-03, park-old-way): the old-way half of test/site-freecss.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SITE'S WHOLE STYLESHEET, WRITTEN BY THE MODEL (2026-08-23, owner's call).
//
// `seeds`, `fonts`, `style`, `tokens` and `tokensPage` came off `design_schema`
// and one `css` field replaced them. This file holds three things:
//
//   1. `readCss` and `fontsIn` themselves — the reader, which is deliberately
//      NOT a validator (see the module header) and therefore has exactly one
//      job that can go wrong: reporting a failure the page cannot report.
//   2. THE ABSENCE, at every layer the five fields were live at. That is the
//      half that rots silently — a field quietly restored beside `css` gives the
//      model two ways to decide one look with nothing choosing between them.
//   3. THE CHAIN, link by link, because this repo has recorded a dozen features
//      correct at every layer and dead at one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCss, fontsIn, cssNote, MAX_CSS, LABEL_GUARD, SHELL_GUARD, ON_FILL_PAIRS } from "../../../builder/site-freecss.mjs";
import { CONFIG_FIELDS } from "../../../site-config.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const worker = read("worker.js");
const container = read("builder/build-server.mjs");
const chat = read("public/chat.js");
/** Comments blanked WHOLE-LINE and length-preserving — every absence below is
 *  judged on code, because prose explaining a deletion spells the deleted thing
 *  and this repo has been caught by that in a lint, a router guard, an absence
 *  check and a scope scan. */
const code = worker.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
/** The design tool's own text. THE ANCHOR IS PROVED before anything is judged
 *  absent from it: `indexOf` answers -1 for a literal that moved, `slice(-1)` is
 *  one character, and every absence below would then pass over nothing. A
 *  negative assertion has to show its observer is alive first. */
const toolAt = code.indexOf('name: "design_schema"');
assert.ok(toolAt > 0, "the design_schema literal moved — every absence in this file is reading nothing");
const tool = code.slice(toolAt);

test("A REVISE IS SHOWN THE SHEET, and told to hand it back with the change made", () => {
  // `css` is REPLACED rather than merged — a stylesheet is one whole thing, not
  // a set of named slots — so the anti-re-roll guarantee cannot live in a merge
  // the way `mergeTokens`' does. It lives in the prompt instead, and BOTH halves
  // are needed: the model has to SEE the current sheet, and it has to be TOLD
  // that what it returns replaces everything.
  const edit = read("builder/site-edit.mjs");
  assert.match(edit, /const css = str\(c\.css\)/, "currentStateNote never reads the stored stylesheet");
  assert.match(edit, /ITS STYLESHEET/, "the note never labels it, so the model cannot tell what it is looking at");
  assert.match(edit, /A change to the LOOK[^.]*is `css` and nothing else/, "the rule never names the field");
  assert.match(edit, /REPLACES the whole stylesheet/i,
    "the rule never says a fresh sheet loses everything, which is the one thing it has to say");
  // …and NOT capped. A `.slice()` here would have the model return the truncated
  // sheet, that answer would REPLACE the stored one, and the tail of the
  // customer's design would be gone — silently, on a request about a phone
  // number. `MAX_CSS` bounds it once, at the door, where it refuses rather than
  // destroys.
  const at = edit.indexOf("const css = str(c.css)");
  assert.ok(at > 0, "the note no longer reads the stylesheet at all, so this cap check is watching nothing");
  assert.doesNotMatch(edit.slice(at, edit.indexOf("\n  }", at)), /\.slice\(/,
    "the stylesheet is truncated on its way to the model, so a revise silently drops the tail of the design");
  // AND BOTH LANES SUPPLY IT. The build route's `editState` and the look lane's
  // `current` are two separate objects: one carrying it and not the other is a
  // revise that re-rolls the look on whichever path the customer happened to hit.
  assert.match(worker, /const storedCss = cfg\.ok \? cfg\.config\.css : ""/,
    "the build route never reads the sheet for the designer");
  assert.match(worker, /css: storedCss,/, "the build route reads the sheet and does not hand it over");
  // THE LOOK LANE HANDS IT OVER DIFFERENTLY SINCE 2026-08-29, and the property
  // is the same one: the model that edits the stylesheet must SEE the stored
  // stylesheet. It read `css: priorCss,` while the lane called the build's
  // designer with the whole current state; the edit path is separate now
  // (owner: "it should be 2 separated path tho"), so each lane is handed its
  // OWN field's value and `css` is the one that gets the sheet.
  //
  // ANCHORED ON THE EXPRESSION THAT CARRIES IT, and this is the weaker half:
  // `test/edit-path.test.mjs` drives the real route and asserts the STORED
  // BYTES arrive in the request the css lane actually sends, which is the
  // check that cannot be satisfied by a source pattern that stopped being wired
  // to anything.
  assert.match(worker, /value: field === "css" \? priorCss :/,
    "the look lane reads the sheet and does not hand it to the lane that edits it");
});

test("AN UNUSABLE ANSWER KEEPS WHAT IS STORED — on both lanes", () => {
  // `readCss` refuses a non-string and an empty string, and neither is an
  // instruction to strip a customer's site bare. Asserted at the assignment on
  // both lanes, because a lane that took the answer regardless would publish an
  // empty stylesheet over a live design and report success.
  assert.match(worker, /const siteCss = cssAsk\.usable \? cssAsk\.css : priorCss;/,
    "the build path replaces the stored sheet with an unusable answer");
  assert.match(worker, /const nextCss = cssAsk\.usable \? cssAsk\.css : priorCss;/,
    "the look lane replaces the stored sheet with an unusable answer");
});

test("THE CUSTOMER IS TOLD, at both ends of the wire", () => {
  // A css change moves no NAMED thing — `moved`, `tokens` and `style` are all
  // lists of names — so without a word for it the reply is "✅ Updated the look."
  // with nothing after it, on the one lane every colour change is now routed to.
  // That is the works-but-cannot-say-so shape, and it reads to a customer as a
  // change that silently failed.
  assert.match(worker, /css: cssMoved \|\| undefined,/, "the look reply never says the stylesheet moved");
  assert.match(chat, /e\.css \? \['the design'\] : \[\]/, "the client never renders it");
  // AND THE SENTENCE ABOUT WHAT THE SHEET COSTS, on BOTH replies. The build path
  // says it too — unlike `styleNote`, which is silent on a first build because
  // naming axes to somebody seeing their site for the first time describes a
  // design they never asked to change. This one names FAILURES, and those are
  // just as wrong on a first build and just as invisible from the page.
  assert.equal((worker.match(/cssNote: cssNote\(cssAsk\)/g) || []).length, 2,
    "one of the two replies does not say what the stylesheet cost the site");
  assert.match(chat, /e\.cssNote/, "the look reply never renders the sentence");
  assert.match(chat, /d\.cssNote/, "the build reply never renders the sentence");
});

test("THE LOOK LANE COUNTS THE STYLESHEET AS A CHANGE — at both of its gates", () => {
  // ── FOUND BY MUTATION, AND BOTH SURVIVORS ARE THE SAME FAILURE ─────────────
  //
  // Since 2026-08-23 `css` is the ONLY thing a look edit moves — `tokens` and
  // `style` are gone from the tool, so `tokensMoved` and `styleMoved` are false
  // on every build there is. That makes these two conditions the whole lane, and
  // nothing was holding either of them.
  //
  // 1. THE NO-CHANGE GATE. Drop `!cssMoved` and a sheet that really moved reads
  //    as nothing moved; `named` is true (`cssAsk.usable`), so the lane answers
  //    "Your site already looks like that — nothing to change." The customer's
  //    colour change is not applied, not published, and REPORTED AS ALREADY
  //    DONE, which is the one answer they cannot act on.
  const lane = worker.slice(worker.indexOf('if (eLayer === "look") {'));
  assert.ok(lane.length > 1000, "the look lane moved and this guard is reading nothing");
  const gate = lane.match(/if \(!moved\.length &&([^)]*)\) \{/);
  assert.ok(gate, "the look lane's no-change gate moved");
  assert.match(gate[1], /!cssMoved/,
    "a css-only look edit reads as nothing to do, so the change is dropped and reported as already applied");
  // 2. THE ESCALATION GATE. `site_look` can be thin or absent on a site whose
  //    whole design is in `site_css` — that is the ordinary shape of everything
  //    built from today. Gated on the look alone, every such site escalates its
  //    colour change to a ~27-credit page rewrite, which recompiles from the very
  //    same stylesheet and cannot change a colour either.
  const esc = lane.match(/if \(![A-Za-z]+([^)]*)\) return escalate\("no-look"\);/);
  assert.ok(esc, "the look lane's no-look escalation moved");
  assert.match(esc[1], /!priorCss/,
    "a site whose design lives in the stylesheet escalates every colour change to a rebuild");
  // 3. AND THE BUILD ROUTE'S OWN GATE, which is the same failure one lane over
  //    and was the third survivor of the same sweep. `editState` is what tells
  //    the designer the site's name, its stylesheet and `EDIT_RULE`; gated on
  //    `stored` alone, a site whose `site_look` is thin while `site_css` carries
  //    the whole design is handed NONE of it and designs from scratch — the
  //    re-roll the anchoring exists to stop, on the revise path.
  const build = worker.match(/if \(stored([^)]*)\) \{\s*\n\s*editState = \{/);
  assert.ok(build, "the build route's editState gate moved");
  assert.match(build[1], /\|\| storedCss/,
    "a revise of a site whose design lives in the stylesheet is not treated as an edit at all");
});

test("A FAILED COMPILE PUTS THE STORED SHEET BACK", () => {
  // The sheet is stored BEFORE the recompile because `recompileAndPublish` reads
  // it from the store — and so does every other publish path, so a failed
  // compile would leave the change waiting for the customer's next unrelated
  // edit to apply it silently, under a version label naming only the typo they
  // were fixing. At the scale of the whole design.
  const b = worker.slice(worker.indexOf('if (eLayer === "look") {'));
  const roll = b.slice(b.indexOf("restored = true"), b.indexOf('error: "compile"'));
  assert.ok(roll.length > 100, "the look lane's rollback block moved — the absence below would pass over nothing");
  assert.match(roll, /cssMoved \? \{ look: priorLook, css: priorCss \}/,
    "a failed look compile does not put the stylesheet back");
  // GATED ON HAVING MOVED, so a lane that touched no CSS writes nothing back
  // for it. The type discipline that used to need its own assertion here — the
  // sheet is a STRING and `JSON.stringify`ing it stores a quoted, escaped copy
  // the container hands to the browser as one string literal — is now a property
  // of the store: `site-config.mjs` keeps each field in its own type and there
  // is no per-key serialisation left to get wrong.
  assert.match(roll, /if \(!w\.ok\) throw/, "a failed restore is swallowed, so it reads as a clean rollback");
});

// ── A34-4: THE "DEFAULT PALETTE" NOTE IS NOT SAID ON A THEMED SITE ───────────
// Every build since 2026-08-27 carries a theme, and the look lane is told to
// write only the asked-for rules on top of it, so `:root{--primary:…}` is the
// ordinary answer. The theme supplies the palette: the note was false there.
test("A34-4: a narrow sheet on a themed site is not told it renders on the default palette", () => {
  assert.doesNotMatch(cssNote(readCss(":root{--primary:#e67e22}", { themed: true })), /default palette/,
    "a themed site's narrow sheet still carries the default-palette note");
  assert.match(cssNote(readCss(":root{--primary:#e67e22}")), /default palette/,
    "the note is gone for a site with no theme too");
  assert.match(cssNote(readCss(":root{--primary:#e67e22}", { themed: false })), /default palette/);
  // Each of the three places a model sheet is read tells readCss about the theme.
  const w = read("worker.js");
  const calls = [...w.matchAll(/readCss\((a?[dD]esigned) && \1\.css(?:, \{ themed: !!resolveTheme\(([^)]*)\) \})?\)/g)];
  assert.equal(calls.length, 3, "the three model-sheet reads were not found");
  for (const c of calls) assert.ok(c[2], "a model-sheet read does not pass the theme: " + c[0]);
});
