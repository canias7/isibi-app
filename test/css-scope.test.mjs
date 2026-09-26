// WHICH RULES A PUBLISH MAY BE HELD FOR (2026-09-26).
//
// Owner: *"An unchanged stylesheet containing an old dead selector must not
// trigger an unsolicited stylesheet rewrite during an unrelated edit. Preserve
// detection of newly introduced broken selectors and legitimate corrections."*
//
// The edit route names the selectors of the rules a request WROTE
// (`changedSelectors` over the sheet its css lane was shown and the one it
// stored), the build service judges those alone (`selectorsToJudge`), and the
// publish gate holds the edit only for a named selector the page does not have.
// The gate matches the two lists BY EQUALITY, so the property everything rests
// on is that `changedSelectors` names a rule with exactly the string
// `plainSelectors` — what the service judges — produces. One walker serves
// both (`styleRules` in builder/site-freecss.mjs); this file drives the
// readers and that property, and checks the service's one line of wiring.
//
// The route cases — a menu edit beside an old dead rule, a new dead rule held
// and corrected, a container still on the previous image — are in
// test/edit-failure-paths.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { plainSelectors, changedSelectors, selectorsToJudge } from "../builder/site-freecss.mjs";

const STALE = ".newsletter-band{background:#f4e9d8}";
const NEW_DEAD = "header button{background-color:#014421}";

test("plainSelectors reads what it always read: rules inside @media, not @keyframes or pseudo-classes, each once, in order", () => {
  const css = "header button{a:1}\n@media (max-width:600px){.y{b:2} header button{c:3}}\n@keyframes k{from{d:1}to{d:2}}\na:hover{e:1}\n.dark .card{f:1}\n.x, .z {g:1}";
  assert.deepEqual(plainSelectors(css), ["header button", ".y", ".x", ".z"]);
  assert.deepEqual(plainSelectors(""), []);
  assert.deepEqual(plainSelectors(null), []);
  // A RULE THE SHEET NEVER CLOSED still names its selector.
  assert.deepEqual(plainSelectors(".open{a:1"), [".open"]);
  // A COMMENT CANNOT OPEN A RULE, nor a brace inside a string.
  assert.deepEqual(plainSelectors("/* .ghost{} */ .real{content:\"{\"}"), [".real"]);
});

test("changedSelectors names the rules a request wrote, and none it left as they were", () => {
  const c = changedSelectors;
  assert.deepEqual(c(STALE, STALE), [], "an unchanged sheet named a rule");
  assert.deepEqual(c(STALE, ".newsletter-band {\n  background: #f4e9d8;\n}\n"), [], "a sheet answered back reformatted named a rule");
  assert.deepEqual(c(STALE, "/* kept */ " + STALE), [], "a comment named a rule");
  assert.deepEqual(c(STALE, STALE + "\n" + NEW_DEAD), ["header button"], "a new rule beside an old one was not named alone");
  assert.deepEqual(c(STALE, ".newsletter-band{background:blue}"), [".newsletter-band"], "a rule whose declarations the request changed was not named");
  assert.deepEqual(c(STALE + "a{x:1}", STALE), [], "a rule the request removed was named");
  assert.deepEqual(c(STALE, "@media (max-width:600px){" + STALE + "}"), [".newsletter-band"], "a rule moved into @media was not named");
  assert.deepEqual(c("@media (max-width:600px){.a{x:1}}", "@media (max-width: 600px) { .a { x: 1 } }"), [], "a media query respaced named a rule");
  assert.deepEqual(c(".a,.b{x:1}", ".a, .b{x:1}"), [], "a selector list respaced named a rule");
  assert.deepEqual(c(STALE, STALE + "a:hover{x:1}"), [], "a rule no check can judge was named");
  // A BEFORE THAT CANNOT BE READ JUDGES EVERYTHING — the direction that cannot
  // hide a broken rule.
  assert.deepEqual(c(null, STALE + NEW_DEAD), [".newsletter-band", "header button"]);
});

// ── THE PROPERTY THE GATE RESTS ON ─────────────────────────────────────────
//
// Every name `changedSelectors` gives is one `plainSelectors` gives for the same
// sheet; against an empty sheet it names exactly what `plainSelectors` does; and
// a sheet compared with itself names nothing. Driven over the constructs the
// walker has to get right, deterministically — a gap here is a new broken rule
// the gate lets through unjudged.
test("every selector changedSelectors names is one the build service would judge, in the same spelling", () => {
  // RULE-SHAPED SHEETS, and `after` made from `before` the ways a lane answers
  // one: kept, respaced, a declaration changed, a rule added, a rule dropped,
  // moved into @media — beside the constructs the walker must step over.
  const sels = ["a", ".x", "#y", "header button", "[data-slot=\"cta-band\"]", "div > p", "*", ".a, .b", "p::before", ".dark .card", "a:hover", "& .n"];
  const decls = ["color:red", "background:#fff;", "--t: 1px", "content:\"{\"", "margin:0 auto"];
  const junk = ["/* { } ; */", "@layer a, b;", "@keyframes spin{from{opacity:0}to{opacity:1}}", "@font-face{font-family:x}", ";"];
  let seed = 20260926;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const rule = () => sels[rnd(sels.length)] + "{" + decls[rnd(decls.length)] + "}";
  const sheet = () => {
    const out = [];
    const len = 1 + rnd(8);
    for (let j = 0; j < len; j++) {
      const k = rnd(10);
      out.push(k < 6 ? rule() : k < 8 ? "@media (max-width:" + (300 + rnd(5) * 100) + "px){" + rule() + "}" : junk[rnd(junk.length)]);
    }
    return out;
  };
  const mutate = (units) => {
    const u = units.slice();
    const k = rnd(6);
    if (k === 0) return u.join("\n");
    if (k === 1) return u.join("\n").replace(/\{/g, " {\n  ").replace(/\}/g, "\n}\n");
    if (k === 2) { const i = rnd(u.length); u[i] = u[i].replace(/\{[^{}]*\}/, "{color:blue}"); return u.join("\n"); }
    if (k === 3) { u.splice(rnd(u.length + 1), 0, rule()); return u.join("\n"); }
    if (k === 4) { u.splice(rnd(u.length), 1); return u.join("\n"); }
    const i = rnd(u.length); u[i] = "@media (min-width:900px){" + u[i] + "}"; return u.join("\n");
  };
  let named = 0, judgedAll = 0, quiet = 0;
  for (let k = 0; k < 3000; k++) {
    const units = sheet();
    const before = units.join("\n"), after = mutate(units);
    const judged = new Set(plainSelectors(after));
    const changed = changedSelectors(before, after);
    for (const s of changed) assert.ok(judged.has(s), "named a selector the service would not judge: " + JSON.stringify(s) + " in " + JSON.stringify(after));
    assert.deepEqual(changedSelectors("", after), plainSelectors(after), "against an empty sheet the two disagree: " + JSON.stringify(after));
    assert.deepEqual(changedSelectors(after, after), [], "a sheet compared with itself named a rule: " + JSON.stringify(after));
    named += changed.length;
    judgedAll += judged.size;
    if (!changed.length) quiet++;
  }
  // THE OBSERVER IS ALIVE, both ways: the battery produced selectors to compare
  // and pairs that name some and pairs that name none. MEASURED on this seed —
  // 511 named of 1,062 judged, 2,489 of the 3,000 pairs naming nothing — and the
  // floors sit well under that, so a walker that stopped reading rules fails
  // here rather than passing over nothing.
  assert.ok(judgedAll > 800, "the battery judged almost nothing: " + judgedAll);
  assert.ok(named > 300 && named < judgedAll, "the battery named " + named + " of " + judgedAll);
  assert.ok(quiet > 1000 && quiet < 3000, "the battery did not exercise both an unchanged and a changed sheet: " + quiet);
});

test("selectorsToJudge judges every rule when asked nothing, and only the named rules the sheet has when asked", () => {
  const css = STALE + "\n" + NEW_DEAD + "\na{x:1}";
  assert.deepEqual(selectorsToJudge(css), [".newsletter-band", "header button", "a"], "absent did not mean every rule");
  assert.deepEqual(selectorsToJudge(css, undefined), [".newsletter-band", "header button", "a"]);
  assert.deepEqual(selectorsToJudge(css, ["header button", "not-in-the-sheet"]), ["header button"], "a named rule the sheet lacks was judged, or the named one was not");
  assert.deepEqual(selectorsToJudge(css, []), [], "an empty list judged something");
  assert.deepEqual(selectorsToJudge(css, [7, null, "a"]), ["a"], "a non-string name was read as a selector");
  // IN THE SHEET'S ORDER, which is the order the service always reported in.
  assert.deepEqual(selectorsToJudge(css, ["a", ".newsletter-band"]), [".newsletter-band", "a"]);
});

// ── THE BUILD SERVICE'S ONE LINE ───────────────────────────────────────────
//
// No unit test runs the container, so its half is checked where it lives: the
// selectors the render check judges come from `selectorsToJudge` over the sheet
// it wrote AND the payload's `cssVerify`, and nothing in the service judges the
// whole sheet by another road.
test("the build service judges the selectors the publish names, through selectorsToJudge and nothing else", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const code = src.replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length));
  assert.ok(code.includes("checkRender(CLIENT_DIST"), "the render check call is gone, so this scan reads nothing");
  assert.match(code, /const cssSelectors = cssUsed && cssUsed\.applied \? selectorsToJudge\(readCss\(payload\.css\)\.css, payload\.cssVerify\) : \[\];/,
    "the service no longer judges the named selectors of the sheet it wrote");
  assert.match(code, /\{ selectors: cssSelectors \}/, "the judged selectors do not reach the render check");
  assert.doesNotMatch(code, /plainSelectors\(/, "the service judges the whole sheet by another road");
});
