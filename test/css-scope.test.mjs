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
import { SPELLINGS, RULE, STORED_SEL, WRITTEN_SEL } from "./fixtures/comment-boundary.mjs";

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

// ── A QUOTED VALUE, AN ESCAPE AND A SELECTOR'S OWN WHITESPACE (2026-09-26) ──
//
// Owner: *"Preserve meaningful whitespace and escapes inside quoted selectors,
// declarations and at-rule conditions. Normalize only where equivalence is
// established; uncertain differences should remain changed."*
//
// REPRODUCED on 933168ea: the rule key collapsed whitespace everywhere, the
// inside of a quoted value included, and every pair below answered `[]` — two
// rules that differ read as one, so the one a request changed was never judged.
// The route case (the queued edit, the compiler sent `cssVerify: []`) is in
// test/edit-failure-paths.test.mjs.

test("a rule whose quoted value, escape or selector whitespace changed is named — each pair read as one rule before", () => {
  const c = changedSelectors;
  // THE OWNER'S REPRODUCTION: two attribute values, two elements.
  assert.deepEqual(c("[data-label=\"a  b\"]{color:red}", "[data-label=\"a b\"]{color:red}"), ["[data-label=\"a b\"]"]);
  assert.deepEqual(c("[data-label=\"a\tb\"]{color:red}", "[data-label=\"a b\"]{color:red}"), ["[data-label=\"a b\"]"], "a tab inside the quotes");
  // A QUOTED DECLARATION: the string is the value, every character of it.
  assert.deepEqual(c(".x{content:\"a  b\"}", ".x{content:\"a b\"}"), [".x"], "whitespace inside a quoted value");
  assert.deepEqual(c(".x{content:\"a : b\"}", ".x{content:\"a:b\"}"), [".x"], "a colon's spacing inside a quoted value");
  assert.deepEqual(c(".x{content:\"/* a */\"}", ".x{content:\"/* b */\"}"), [".x"], "comment-shaped text inside a quoted value");
  assert.deepEqual(c(".price{--currency:\"£  \"}", ".price{--currency:\"£ \"}"), [".price"], "a quoted custom property");
  // A QUOTED AT-RULE CONDITION: the rules inside it are its rules.
  assert.deepEqual(c("@supports selector([data-label=\"a  b\"]){.x{color:red}}", "@supports selector([data-label=\"a b\"]){.x{color:red}}"), [".x"], "a quoted @supports condition");
  assert.deepEqual(c("@container style(--l: \"a  b\"){.x{color:red}}", "@container style(--l: \"a b\"){.x{color:red}}"), [".x"], "a quoted container style query");
  assert.deepEqual(c("@scope ([data-label=\"a  b\"]){p{color:red}}", "@scope ([data-label=\"a b\"]){p{color:red}}"), ["p"], "a quoted @scope root");
  // AN ESCAPE, with the whitespace it owns: `\31 0` is the class "10", `\31  0`
  // a class "1" and a descendant `0`.
  assert.deepEqual(c(".a\\  b{color:red}", ".a\\ b{color:red}"), [".a\\ b"], "an escaped space and the whitespace after it");
  assert.deepEqual(c(".\\31  0{color:red}", ".\\31 0{color:red}"), [".\\31 0"], "a hex escape's own whitespace");
  // A SELECTOR'S COLON: whitespace before it is a descendant combinator.
  assert.deepEqual(c("@supports selector(a :hover){.x{color:red}}", "@supports selector(a:hover){.x{color:red}}"), [".x"], "a colon inside selector()");
  assert.deepEqual(c("@scope (.card :hover){p{color:red}}", "@scope (.card:hover){p{color:red}}"), ["p"], "a colon in @scope's root");
  assert.deepEqual(c(".card{& :hover{color:red}}", ".card{&:hover{color:red}}"), [".card"], "a colon in a nested rule's selector");
});

test("control: the formatting CSS ignores names nothing, with quoted values, escapes and conditions present", () => {
  const c = changedSelectors;
  assert.deepEqual(c(
    "[data-label=\"a  b\"]{content:\"x  y\";margin:0 auto}@media (max-width:600px){.p{--c:\"£  \"}}",
    "[data-label=\"a  b\"] {\n  content: \"x  y\";\n  margin: 0  auto;\n}\n@media (max-width: 600px) {\n  .p { --c: \"£  \"; }\n}\n"), [], "a quoted sheet pretty-printed");
  assert.deepEqual(c(".a{x:1;;y:2;}", ".a{ x:1; y:2 }"), [], "empty declarations");
  assert.deepEqual(c(".a{;x:1}", ".a{x:1}"), [], "a leading empty declaration");
  assert.deepEqual(c("/* head */.a{/* c */x:1}", ".a{x:1}"), [], "comments");
  assert.deepEqual(c(".a{x:1 ! important}", ".a{x:1!important}"), [], "the spacing of !important");
  assert.deepEqual(c(".md\\:flex{display:flex}", ".md\\:flex { display: flex; }"), [], "an escaped colon, kept, beside formatting");
  assert.deepEqual(c(".\\31 0{x:1}", ".\\31 0 { x: 1 }"), [], "a hex escape, kept, beside formatting");
  assert.deepEqual(c(".a{background:url(a.png)}", ".a { background: url(a.png); }"), [], "an unquoted url, kept, beside formatting");
  assert.deepEqual(c(".card{&:hover{color:red}}", ".card { &:hover { color : red; } }"), [], "a nested rule's declarations");
  assert.deepEqual(c("@supports (display:grid){.a{x:1}}", "@supports (display : grid) { .a { x: 1 } }"), [], "a feature's colon in @supports");
  assert.deepEqual(c("@container style(--t:\"a  b\"){.a{x:1}}", "@container style(--t : \"a  b\") {.a{x:1}}"), [], "a style query's colon, the quoted value kept");
  assert.deepEqual(c("@scope ([data-label=\"a  b\"]){p{x:1}}", "@scope ([data-label=\"a  b\"]) {\n p { x: 1 }\n}"), [], "@scope, its quoted root kept");
});

test("an equivalence CSS does not establish reads as changed and is judged — never the other way", () => {
  const c = changedSelectors;
  // Two spellings of one value: the key does not unquote, so it cannot know.
  assert.deepEqual(c("[data-label=\"a  b\"]{x:1}", "[data-label='a  b']{x:1}"), ["[data-label='a  b']"], "quote style");
  // An empty item makes the whole selector list invalid.
  assert.deepEqual(c(".a,,.b{x:1}", ".a,.b{x:1}"), [".a", ".b"], "an empty list item");
  // U+00A0 is not CSS whitespace: it is part of the class name.
  assert.deepEqual(c(".a\u00a0.b{x:1}", ".a .b{x:1}"), [".a .b"], "a no-break space");
  // Whitespace inside an unquoted url() makes it a different token.
  assert.deepEqual(c(".a{background:url(a,b)}", ".a{background:url(a, b)}"), [".a"], "the inside of an unquoted url");
  // Only a declaration's own colon sheds its whitespace.
  assert.deepEqual(c(".a{--x:a:b}", ".a{--x:a : b}"), [".a"], "a second colon in a value");
});

// ── A COMMENT IS A TOKEN BOUNDARY, NOT WHITESPACE (2026-09-26) ─────────────
//
// Owner: *"Preserve selector meaning across both readers. Do not simply delete
// every comment and concatenate tokens; that can change token boundaries. Keep
// uncertain differences classified as changed."*
//
// REPRODUCED on e49a370c: `changedSelectors(".a/**/.b{…}", ".a .b{…}")`
// answered `[]` — the key read the comment as whitespace — and `plainSelectors`
// handed the judge `.a    .b` for the first rule, a descendant, where CSS reads
// the compound `.a.b`. Which of the fixture's spellings reach `<p class="a b">`
// is established in a real Chromium by test/integration/site-build.mjs; the
// route cases are in test/edit-failure-paths.test.mjs.

test("the owner's pair is two rules, and the judge is handed what each one means", () => {
  const c = changedSelectors;
  assert.deepEqual(c(RULE(STORED_SEL), RULE(WRITTEN_SEL)), [WRITTEN_SEL], "a comment and whitespace read as one rule");
  assert.deepEqual(c(RULE(WRITTEN_SEL), RULE(STORED_SEL)), [STORED_SEL], "…the other way round");
  // THE FIXTURE'S TABLE, SPELLED BY THE PRODUCT: every rule hands the judge the
  // string the browser control asked the page about.
  for (const s of SPELLINGS) assert.deepEqual(plainSelectors(RULE(s.written)), [s.judged], "the judge is handed another string for " + s.written);
  assert.ok(SPELLINGS.some((s) => s.live) && SPELLINGS.some((s) => !s.live), "the table no longer holds both a live and a dead spelling");
  // A COMMENT-SHAPED RUN INSIDE A QUOTED VALUE IS THE VALUE'S OWN TEXT.
  assert.deepEqual(plainSelectors("[data-x=\"/* a */\"]{x:1}"), ["[data-x=\"/* a */\"]"], "a comment-shaped value was blanked");
  // DELETING THE COMMENT WOULD MERGE TWO NAMES INTO ONE: `ab` is one name.
  assert.deepEqual(plainSelectors("a/**/b{x:1}"), ["a/**/b"], "two names were merged, or read as a descendant");
  // A COMMENT'S LENGTH NO LONGER DECIDES WHETHER A RULE IS JUDGED: blanked
  // into spaces, this one ran past the 200-character bound and was never asked
  // about.
  assert.deepEqual(plainSelectors(".a/* " + "x".repeat(250) + " */.b{x:1}"), [".a/**/.b"], "a long comment hid the rule from the judge");
  // A SELECTOR NO COMMENT TOUCHES IS THE STRING IT ALWAYS WAS, its whitespace
  // included — the gate matches these by equality.
  assert.deepEqual(plainSelectors("/* head */ .a  >  .b , .c/**/{x:1}"), [".a  >  .b", ".c"]);
});

test("control: a comment CSS reads as nothing, or as the whitespace beside it, names nothing", () => {
  const c = changedSelectors;
  assert.deepEqual(c(".a{x:1}", "/* the band */.a/* the band */{/* first */x:1/* last */}"), [], "at either end, and beside a brace");
  assert.deepEqual(c(".a{color:red}", ".a{color:/**/red}"), [], "after a declaration's colon");
  assert.deepEqual(c(".a,.b{x:1}", ".a/**/,/**/.b{x:1}"), [], "beside a comma");
  assert.deepEqual(c(".a>.b{x:1}", ".a>/**/.b{x:1}"), [], "after a child combinator");
  assert.deepEqual(c(".a[x]{y:1}", ".a/**/[x]{y:1}"), [], "before an attribute");
  assert.deepEqual(c(".a{x:1;y:2}", ".a{x:1/**/;/**/y:2}"), [], "beside a semicolon");
  assert.deepEqual(c(".a .b{x:1}", ".a /* the hours */ .b{x:1}"), [], "with whitespace beside it");
  assert.deepEqual(c(".a .b{x:1}", ".a/* the hours */ .b{x:1}"), [], "with whitespace on one side");
  assert.deepEqual(c(RULE(STORED_SEL), RULE(".a/* the hours */.b")), [], "one boundary, spelled two ways");
  assert.deepEqual(c("@media (max-width:600px){.a{x:1}}", "@media (max-width:/**/600px)/**/{.a{x:1}}"), [], "in a condition");
});

test("a comment beside what may merge reads as changed, and is judged — never the other way", () => {
  const c = changedSelectors;
  // `.a.b` IS THE SAME ELEMENT — the browser control says so — but the key
  // cannot establish that without knowing which tokens merge, so it is judged.
  assert.deepEqual(c(RULE(STORED_SEL), RULE(".a.b")), [".a.b"], "a comment's boundary was read as nothing");
  assert.deepEqual(c("a b{x:1}", "a/**/b{x:1}"), ["a/**/b"], "a boundary was read as whitespace");
  assert.deepEqual(c("ab{x:1}", "a/**/b{x:1}"), ["a/**/b"], "two names were read as one");
  assert.deepEqual(c(".a{margin:1.5em}", ".a{margin:1/**/.5em}"), [".a"], "a number split in two");
  assert.deepEqual(c(".a{--w:1px}", ".a{--w:1/**/px}"), [".a"], "a dimension split in two");
  assert.deepEqual(c(".a{x:a b}", ".a{x:a/**/b}"), [".a"], "a boundary in a value read as whitespace");
  assert.deepEqual(c("@media (x){.a{y:1}}", "@media/**/(x){.a{y:1}}"), [".a"], "before a parenthesis, where a name and `(` make a function");
});

// A PROPERTY OVER RANDOM SHEETS, the formatting control at scale: whitespace and
// comments — with whitespace beside them or none — added only where CSS ignores
// them, next to a `{`, `}`, `;` or `,`, outside every string, escape and url,
// name nothing, in either direction; and the sheets carry the constructs the
// key must not normalise.
test("formatting added only where CSS ignores it names nothing, over random sheets with quoted values and escapes", () => {
  const sels = ["[data-label=\"a  b\"]", "[data-x='p q']", ".md\\:flex", ".\\31 0", ".a\\ b", "header button", ".a, .b", "div > p", "& .n"];
  const decls = ["content:\"a  b\"", "--c:\"£  \"", "font-family:\"Open  Sans\", serif", "background:url(a.png)", "margin:0 auto !important", "color:rgb(1,2,3)", "content:\"{;}\""];
  const wrap = ["@media (max-width:600px)", "@supports selector([data-x=\"p  q\"])", "@scope ([data-label=\"a  b\"])", "@container style(--t:\"x  y\")"];
  let seed = 20260927;
  // EXACT INTEGER ARITHMETIC, READ FROM THE HIGH BITS (2026-09-26). This was
  // `seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n`, and
  // the product runs past 2^53, so it lost its low bits and every seed became a
  // multiple of 512: `rnd(2)` answered 0 in 19,920 of 20,000 calls. MEASURED on
  // the old generator, this property inserted formatting 183 times across its
  // 1,500 sheets, and the battery below respaced a sheet 3 times in 3,000 pairs
  // and used 6 of its 12 selectors. The floors below prove both now run.
  const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return Math.floor((seed / 4294967296) * n); };
  const rule = () => sels[rnd(sels.length)] + "{" + decls[rnd(decls.length)] + ";" + decls[rnd(decls.length)] + "}";
  const sheet = () => {
    const out = [];
    for (let j = 1 + rnd(6); j > 0; j--) out.push(rnd(3) ? rule() : wrap[rnd(wrap.length)] + "{" + rule() + "}");
    return out.join("");
  };
  // A BARE COMMENT beside one of the four is nothing to CSS: nothing merges
  // across a brace, a semicolon or a comma.
  const SPACES = [" ", "\n", "\n  ", "\t", " /* note; } { */ ", "/* note */", "/**/"];
  // Whitespace beside the four delimiters, stepping over strings, escapes and
  // urls — what goes either side of each one is `pick`'s answer.
  const format = (css, pick) => {
    let out = "";
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === "\"" || ch === "'") { const j = css.indexOf(ch, i + 1); out += css.slice(i, j + 1); i = j; continue; }
      if (ch === "\\") { out += css.slice(i, i + 2); i++; continue; }
      if (css.startsWith("url(", i)) { const j = css.indexOf(")", i); out += css.slice(i, j + 1); i = j; continue; }
      if ("{};,".includes(ch)) { out += pick() + ch + pick(); continue; }
      out += ch;
    }
    return out;
  };
  let inserted = 0;
  const random = () => { if (!rnd(2)) return ""; inserted++; return SPACES[rnd(SPACES.length)]; };
  let judged = 0, quoted = 0, bare = 0;
  for (let k = 0; k < 1500; k++) {
    const before = sheet(), after = format(before, random);
    assert.deepEqual(changedSelectors(before, after), [], "formatting named a rule: " + JSON.stringify([before, after]));
    assert.deepEqual(changedSelectors(after, before), [], "formatting named a rule (reversed): " + JSON.stringify([after, before]));
    assert.deepEqual(plainSelectors(after), plainSelectors(before), "formatting moved what the service judges: " + JSON.stringify([before, after]));
    // AND A BARE COMMENT BOTH SIDES OF EVERY ONE OF THE FOUR, which the random
    // picks reach only now and then — no whitespace anywhere beside it.
    const wrapped = format(before, () => "/**/");
    assert.deepEqual(changedSelectors(before, wrapped), [], "a bare comment beside a delimiter named a rule: " + JSON.stringify([before, wrapped]));
    assert.deepEqual(changedSelectors(wrapped, before), [], "a bare comment beside a delimiter named a rule (reversed): " + JSON.stringify([wrapped, before]));
    assert.deepEqual(plainSelectors(wrapped), plainSelectors(before), "a bare comment beside a delimiter moved what the service judges: " + JSON.stringify([before, wrapped]));
    bare += wrapped.split("/**/").length - 1;
    judged += plainSelectors(before).length;
    if (/["']/.test(before)) quoted++;
  }
  // THE OBSERVER IS ALIVE: the sheets had rules the service judges and quoted
  // values in them, the random picks really formatted them, and the wrapped
  // sheets carried bare comments. MEASURED on this seed: 3,810 selectors
  // judged, 1,462 of the 1,500 sheets carrying a quoted value, 24,558 random
  // insertions and 49,134 bare comments — the floors sit well under each.
  assert.ok(judged > 2000, "the property judged almost nothing: " + judged);
  assert.ok(quoted > 1000, "the sheets carried no quoted values: " + quoted);
  assert.ok(inserted > 10000, "the random picks formatted almost nothing: " + inserted);
  assert.ok(bare > 20000, "the wrapped sheets carried almost no comments: " + bare);
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
  // The formatting property above says why this generator is exact.
  const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return Math.floor((seed / 4294967296) * n); };
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
  const kinds = [0, 0, 0, 0, 0, 0];
  const mutate = (units) => {
    const u = units.slice();
    const k = rnd(6);
    kinds[k]++;
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
  // THE OBSERVER IS ALIVE, both ways: the battery produced selectors to
  // compare, pairs that name some and pairs that name none, and reached every
  // one of the six ways a lane answers a sheet. MEASURED on this seed — 1,185
  // named of 7,035 judged, 1,975 of the 3,000 pairs naming nothing, each way
  // reached 475–513 times — and the floors sit well under that, so a walker
  // that stopped reading rules fails here rather than passing over nothing. (On
  // the old generator it read 512 of 1,062 and 2,488, respacing 3 times.)
  assert.ok(judgedAll > 3000, "the battery judged almost nothing: " + judgedAll);
  assert.ok(named > 500 && named < judgedAll, "the battery named " + named + " of " + judgedAll);
  assert.ok(quiet > 1000 && quiet < 3000, "the battery did not exercise both an unchanged and a changed sheet: " + quiet);
  assert.ok(kinds.every((n) => n > 300), "the battery did not reach every way a lane answers a sheet: " + kinds.join(", "));
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
