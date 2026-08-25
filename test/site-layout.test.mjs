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
} from "../builder/site-nav.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";

const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
const header = fs.readFileSync(path.join(UI, "site-header.tsx"), "utf8");
const chrome = fs.readFileSync(path.join(UI, "site-chrome.tsx"), "utf8");
const workerSrc = fs.readFileSync(path.join(import.meta.dirname, "../worker.js"), "utf8");

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

// ── THE TYPE ────────────────────────────────────────────────────────────────

test("every enum axis accepts a widened string, or a const CHROME cannot compile", () => {
  // DERIVED FROM THE SPEC, so a third enum axis added later is covered without
  // anybody remembering this file. What is asserted is the PROPERTY — the union
  // is open — rather than one spelling of it.
  const decl = /export type SiteLayout = \{([\s\S]*?)\n\};/.exec(header);
  assert.ok(decl, "SiteLayout is no longer declared the way this scan expects");
  for (const [f, s] of Object.entries(CHROME_OBJECTS.layout)) {
    if (s.kind !== "enum") continue;
    const line = decl[1].split("\n").find((l) => new RegExp(`^\\s*${f}\\?:`).test(l));
    assert.ok(line, `SiteLayout does not declare \`${f}\``);
    for (const v of s.values) {
      assert.ok(line.includes(`"${v}"`), `SiteLayout's \`${f}\` does not offer "${v}", so the tool and the type disagree`);
    }
    assert.ok(
      /\(string & \{\}\)/.test(line),
      `SiteLayout's \`${f}\` is a CLOSED union — a page writing it into a \`const CHROME\` widens to string and the build fails`
    );
  }
});

test("the header takes layout, and the chrome forwards it to BOTH halves", () => {
  // The wiring death, thirteen recorded instances: a prop the chrome accepts and
  // never forwards is a slot that exists, typechecks, and renders nothing.
  assert.ok(propsOf(header, "SiteHeader").includes("layout"), "SiteHeader does not take `layout`");
  assert.ok(propsOf(chrome, "SiteChrome").includes("layout"), "SiteChrome does not accept `layout`");
  for (const half of ["SiteHeader", "SiteFooter"]) {
    const call = new RegExp(`<${half}\\b([^/>]*)`).exec(chrome);
    assert.ok(call, `site-chrome.tsx no longer renders <${half}> the way this scan expects`);
    assert.match(call[1], /\blayout=/, `SiteChrome does not pass \`layout\` to ${half}`);
  }
});

test("EVERY axis the writer can write, the header actually reads", () => {
  // FOUND BY MUTATION. Making `brand` and `sticky` unconditional survived the
  // whole unit suite: the writer wrote them, the response reported them, the
  // customer was told it worked, and the header rendered exactly as before. The
  // behavioural half is asserted against a real compiled bundle in
  // test/integration/site-build.mjs; this is the cheap half, and DERIVED from
  // the spec so a fourth axis is covered without anybody remembering the file.
  for (const f of LAYOUT_FIELDS) {
    assert.match(header, new RegExp(`layout\\?\\.${f}\\b`),
      `SiteHeader never reads \`${f}\`, so asking for it is a change reported as applied that moves nothing`);
  }
});

test("THE RULES ARE OFF UNLESS SOMEBODY ASKS, in all three places", () => {
  // Owner's call, 2026-08-19: "if user wants to add it cool, but don't put it as
  // default for build". These three rules were hardcoded and unreachable, and
  // under a theme that paints a background they slice one continuous page into
  // slabs — the same judgement `bandClearCss` already acts on for the bands.
  //
  // Asserted as an ABSENCE, which is the half that can rot silently: a later
  // edit restoring an unconditional "border-b" puts them back on every site on
  // the platform with the axis still present and every other test green.
  const footer = fs.readFileSync(path.join(UI, "site-footer.tsx"), "utf8");
  const blank = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
                        .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));
  // Comments blanked first: both files EXPLAIN this in prose, and prose about a
  // class name contains that class name. Recorded trap, seven instances now.
  for (const [name, src] of [["header", blank(header)], ["footer", blank(footer)]]) {
    for (const m of src.matchAll(/"border-[tb]\b[^"]*"/g)) {
      // Every rule that survives must be gated on the flag — the gate sits
      // immediately before it in the same `cn(...)`.
      const before = src.slice(Math.max(0, m.index - 40), m.index);
      assert.match(before, /divider\s*&&\s*$/,
        `${name} draws ${m[0]} unconditionally — the rules are back on by default`);
    }
    assert.match(src, /layout\?\.divider === true/,
      `${name} does not read \`divider\`, so asking for the rules back moves nothing`);
  }
  // AND IT IS THE ONE AXIS THAT DEFAULTS OFF. `sticky` defaults ON because it
  // was the existing behaviour; this one defaults OFF because it is a change.
  assert.equal(CHROME_OBJECTS.layout.divider.default, false,
    "divider no longer defaults off, so every build gets the rules again");
  // AND `sticky` DEFAULTS OFF WITH IT, because the two are coupled: a stuck
  // header needs a pale band to stay readable while content slides under it
  // (measured — without one the wordmark prints through the page's headings),
  // and that band ENDS in a step which reads as a line. There is no
  // sticky-and-no-line arrangement, so neither may default on alone.
  assert.equal(CHROME_OBJECTS.layout.sticky.default, false,
    "sticky defaults on again, so every build gets the band's edge back");
  // The band must be gated on `sticky` and on nothing else — carried
  // unconditionally it is the pale strip whose bottom edge was the line.
  const band = /sticky && "sticky top-0 z-40 bg-background\/85 backdrop-blur"/;
  assert.match(header, band, "the header's band is not gated on `sticky`");
  // AND THE COMPONENT'S OWN DEFAULT, not just the spec's. FOUND BY MUTATION:
  // reverting the header to `layout?.sticky !== false` — every build sticky and
  // banded again — survived the whole suite, because only CHROME_OBJECTS was
  // asserted. The spec drives the tool; the component is what renders, and the
  // two can disagree silently.
  const blankHdr = blank(header);
  for (const f of ["sticky", "divider"]) {
    assert.match(blankHdr, new RegExp(`const ${f} = layout\\?\\.${f} === true;`),
      `the header's \`${f}\` no longer defaults OFF — the spec says off and the render says on`);
  }
});

test("width moves the header and the footer together", () => {
  // A full-width header over a contained footer reads as a mistake, so the
  // shared axis is the point. Both files must read it, or one moves alone.
  const footer = fs.readFileSync(path.join(UI, "site-footer.tsx"), "utf8");
  for (const [name, src] of [["header", header], ["footer", footer]]) {
    assert.match(src, /layout\?\.width === "full"/, `the ${name} does not honour \`width\``);
  }
});

// ── READING WHAT IS THERE ───────────────────────────────────────────────────

test("a bool reads as a bool and an enum reads only its own values", () => {
  const got = readChromeObject('brand: "centre", width: "full", sticky: false', "layout");
  assert.deepEqual(got, { brand: "centre", width: "full", sticky: false });

  // AN UNRECOGNISED ENUM VALUE IS NOT READ BACK. The component falls back to the
  // default arrangement for one, so carrying it forward preserves a value that
  // renders as nothing and looks like the edit having failed.
  assert.deepEqual(readChromeObject('brand: "middle"', "layout"), {});
  // A quoted "false" is not a boolean: read loosely it would un-stick a header
  // on the answer that asked for the opposite.
  assert.deepEqual(readChromeObject('sticky: "false"', "layout"), {});
});

test("contact and layout share ONE slot finder", () => {
  // Locating the literal is the hard, comment-hazard-prone half and is identical
  // for the two. Two copies drift, and the direction they drift in is a scanner
  // that silently stops finding one of them.
  const p = CHROME_PAGE(`  contact: { phone: "0114 270 0000" },\n  layout: { brand: "centre" },\n`);
  const con = chromeObjectSlots([p], "contact");
  const lay = chromeObjectSlots([p], "layout");
  assert.equal(con.length, 1);
  assert.equal(lay.length, 1);
  assert.deepEqual(con[0].fields, { phone: "0114 270 0000" });
  assert.deepEqual(lay[0].fields, { brand: "centre" });
});

test("a comment with an apostrophe does not blind the scanner", () => {
  // The hazard that disabled the whole nav lane for a page: an unbalanced quote
  // inside a comment used to run the brace scan to the end of the file.
  const p = CHROME_PAGE(`  // The frame's own arrangement.\n  layout: { brand: "centre" },\n`);
  const slots = chromeObjectSlots([p], "layout");
  assert.equal(slots.length, 1, "a comment with an apostrophe hid the layout slot");
  assert.deepEqual(slots[0].fields, { brand: "centre" });
});

// ── WRITING IT ──────────────────────────────────────────────────────────────

test("absent means unchanged — centring the name does not un-stick the header", () => {
  // `sticky: true` is the NON-default value now, which is what makes this
  // assertion mean anything: a field equal to its default is dropped by design,
  // so storing the default and finding it gone would prove nothing.
  const p = CHROME_PAGE(`  layout: { sticky: true },\n`);
  const { pages, changed } = applyLayout([p], { brand: "centre" });
  assert.deepEqual(changed, ["index.tsx"]);
  assert.match(pages[0].source, /brand: "centre"/);
  assert.match(pages[0].source, /sticky: true/, "an unnamed axis was wiped");
});

test("the ordinary value is the removal verb, and an all-default frame leaves nothing behind", () => {
  const p = CHROME_PAGE(`  layout: { brand: "centre" },\n`);
  const { pages, changed } = applyLayout([p], { brand: "left" });
  assert.deepEqual(changed, ["index.tsx"]);
  // Not `layout: {},` — the source is stored and re-read on every later edit, so
  // a site put back to the default frame must be byte-identical to one that
  // never had a `layout` at all.
  assert.ok(!/layout/.test(pages[0].source), "putting the frame back left a layout behind: " + pages[0].source);
});

test("a no-op does not republish", () => {
  // The writer re-serialises the whole object, so without this an answer
  // restating what is already there rewrites every page, runs the container and
  // cuts a version — and the customer is told it worked when nothing moved.
  const p = CHROME_PAGE(`  layout: { brand: "centre" },\n`);
  assert.deepEqual(applyLayout([p], { brand: "centre" }).changed, []);
  // Nothing stored, and the ask IS the default: still nothing to do.
  assert.deepEqual(applyLayout([CHROME_PAGE()], { sticky: false }).changed, []);
});

test("it is inserted where there is none, on every page", () => {
  const pages = [CHROME_PAGE(), page("book.tsx",
    `export default function B() { return <SiteChrome name="x" links={[]}>y</SiteChrome>; }`)];
  const out = applyLayout(pages, { width: "full" });
  assert.deepEqual(out.changed.sort(), ["book.tsx", "index.tsx"]);
  assert.match(out.pages[0].source, /layout: \{ width: "full" \},/);
  assert.match(out.pages[1].source, /layout=\{\{ width: "full" \}\}/);
});

test("a junk value is never written", () => {
  // The enum is enforced in CODE and not merely declared in the schema: a value
  // the component does not recognise is a change reported as applied that moves
  // nothing.
  for (const bad of [{ brand: "middle" }, { sticky: "false" }, { width: 3 }, { brand: ["centre"] }]) {
    assert.deepEqual(applyLayout([CHROME_PAGE()], bad).changed, [], `wrote ${JSON.stringify(bad)}`);
  }
});

test("a round trip through the real applier and reader agrees", () => {
  const written = applyLayout([CHROME_PAGE()], { brand: "centre", sticky: true }).pages;
  assert.deepEqual(chromeObjectSlots(written, "layout")[0].fields, { brand: "centre", sticky: true });
});

test("layout and contact do not disturb each other on one page", () => {
  const p = CHROME_PAGE(`  contact: { phone: "0114 270 0000" },\n`);
  const withLayout = applyLayout([p], { brand: "centre" }).pages;
  const both = applyContact(withLayout, { email: "hi@example.com" }).pages;
  assert.deepEqual(chromeObjectSlots(both, "layout")[0].fields, { brand: "centre" });
  assert.deepEqual(chromeObjectSlots(both, "contact")[0].fields,
    { phone: "0114 270 0000", email: "hi@example.com" });
});

// ── WHAT THE MODEL IS SHOWN AND WHAT IT MAY ANSWER ──────────────────────────

test("the digest states EVERY axis, including the ones at their ordinary value", () => {
  // An absent line reads as an omission rather than an answer — the `publicView`
  // failure, which cost a whole build twice. Without it "put the logo back on
  // the left" cannot be told from a no-op.
  const d = navDigest([], ["/"], [], [], [], [], chromeObjectSlots([CHROME_PAGE(`  layout: { brand: "centre" },\n`)], "layout"));
  assert.match(d, /HOW THE FRAME SITS TODAY:/,
    "the axes are printed with no heading, so nothing says what they are");
  for (const f of LAYOUT_FIELDS) assert.match(d, new RegExp("\\n  " + f + ": "), `the digest never states \`${f}\``);
  assert.match(d, /brand: centre/);
  assert.match(d, /sticky: false {2}\(the ordinary one\)/);
});

test("the tool offers exactly the axes the writer can write", () => {
  const lay = NAV_TOOL.input_schema.properties.layout;
  assert.ok(lay, "write_nav does not offer `layout`, so nothing can ever ask for it");
  assert.deepEqual(Object.keys(lay.properties).sort(), [...LAYOUT_FIELDS].sort());
  for (const [f, s] of Object.entries(CHROME_OBJECTS.layout)) {
    if (s.kind !== "enum") continue;
    assert.deepEqual(lay.properties[f].enum, s.values, `the tool's \`${f}\` and the writer's disagree about the values`);
  }
});

test("readNav picks up a layout-only answer, and the enum is enforced here too", () => {
  const reply = (input) => ({ content: [{ type: "tool_use", input }] });
  const got = readNav(reply({ layout: { brand: "centre", width: "middling", sticky: "no" } }), ["/"]);
  assert.deepEqual(got.layout, { brand: "centre" }, "a junk value survived readNav");
  // A LAYOUT-ONLY ANSWER MUST NOT FALL OUT AS null. That early return is what
  // killed the contact feature before it shipped: the commonest shape the field
  // produces came back as nothing at all.
  assert.ok(got, "a layout-only answer read as no answer");
  assert.equal(readNav(reply({ layout: { brand: "middle" } }), ["/"]), null,
    "an all-junk layout read as an answer");
});

test("the reply says what moved in the customer's words, not ours", () => {
  const msg = navReply({ layout: { brand: "centre" }, changed: ["index.tsx", "book.tsx"] });
  assert.match(msg, /middle/, "the reply does not say what actually changed");
  assert.ok(!/brand/.test(msg), "the reply reads our field name back at the customer");
  assert.match(msg, /2 pages/, "the reply does not say how many pages it reached");
  assert.match(navReply({ layout: { sticky: false }, changed: ["index.tsx"] }), /follow/);
  // A layout answer must not fall through to the menu sentence, which would
  // report a menu that did not change.
  assert.ok(!/menu/i.test(msg), "a layout change was reported as a menu change");
});

// ── THE LANE, END TO END ────────────────────────────────────────────────────

test("the runner applies it and hands back THE PAGES", () => {
  // Checking `changed` and the reply while returning the pre-apply pages passes
  // everything and publishes nothing — the gap the list sweep found one prop
  // over. What gets published is the pages.
  const deps = { send: async () => ({ content: [{ type: "tool_use", input: { layout: { brand: "centre" } } }] }) };
  return runNavEdit(deps, {
    instruction: "centre our logo",
    pages: [CHROME_PAGE(`  links: [{ label: "Book", href: "/book" }],\n`)],
    routes: ["/", "/book"],
  }).then((out) => {
    assert.equal(out.ok, true, "the lane refused: " + JSON.stringify(out.reason || out.msg));
    assert.deepEqual(out.changed, ["index.tsx"]);
    assert.deepEqual(out.layout, { brand: "centre" });
    assert.match(out.pages[0].source, /brand: "centre"/, "the runner handed back the pages it did NOT edit");
  });
});

test("an already-centred site is refused rather than republished", () => {
  const deps = { send: async () => ({ content: [{ type: "tool_use", input: { layout: { brand: "centre" } } }] }) };
  return runNavEdit(deps, {
    instruction: "centre our logo",
    pages: [CHROME_PAGE(`  links: [{ label: "Book", href: "/book" }],\n  layout: { brand: "centre" },\n`)],
    routes: ["/", "/book"],
  }).then((out) => {
    assert.equal(out.ok, false);
    assert.equal(out.reason, "no-change");
    assert.ok(!out.escalate, "a no-op escalated — that buys a ~27-credit rebuild to do nothing");
    assert.match(out.msg, /already/);
  });
});

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

test("the frame is contained and <main> is not — the premise rule 16 rests on", () => {
  const footer = fs.readFileSync(path.join(UI, "site-footer.tsx"), "utf8");
  const headerCode = noComments(header);
  const footerCode = noComments(footer);
  const chromeCode = noComments(chrome);

  // Proved the blanker did not eat the subject as well as the prose — a scan
  // over an over-blanked file reports a clean frame and asserts nothing.
  assert.match(headerCode, /className=/, "the header's code was blanked along with its comments");

  assert.match(headerCode, /max-w-6xl/, "the header no longer runs at the width rule 16 names");
  assert.match(footerCode, /max-w-6xl/, "the footer no longer runs at the width rule 16 names");

  const i = chromeCode.indexOf("<main");
  assert.ok(i > 0, "SiteChrome no longer renders a <main> the way this scan expects");
  const tag = chromeCode.slice(i, chromeCode.indexOf(">", i));
  assert.match(tag, /className=/, "the <main> found carries no className, so this scan is reading the wrong thing");
  assert.doesNotMatch(tag, /max-w-|mx-auto/,
    "<main> now sets a width of its own, so rule 16 is a second opinion about the same thing");
});

test("the generator is told the body has a width, and how to keep a full bleed", async () => {
  const { PAGE_RULES } = await import("../builder/page-gen.mjs");
  const i = PAGE_RULES.indexOf("THE PAGE BODY HAS A WIDTH");
  assert.ok(i > 0, "no rule tells the model the page body has to set its own width");
  // Bounded by the NEXT heading rather than a byte count — a window sized in
  // bytes stops covering what it was written for the moment a sentence lands
  // above it, this repo's most repeated own-goal.
  const next = PAGE_RULES.indexOf("\n## ", i);
  const rule = PAGE_RULES.slice(i, next > 0 ? next : undefined);
  assert.ok(rule.length > 400, "the rule 16 window collapsed to nothing");

  // THE STATEMENT, NOT ANYWHERE IN THE RULE. The classes appear twice — once as
  // the instruction and once inside the full-bleed exception — so a check over
  // the whole rule stays green with the instruction gutted and only the
  // exception's copy left, which is an example with nothing it exemplifies.
  const statement = rule.slice(0, rule.indexOf("\n\n"));
  assert.ok(statement.length > 60, "the rule 16 statement window collapsed to nothing");
  assert.match(statement, /mx-auto max-w-6xl px-6/,
    "the rule never states the three classes, so there is nothing to copy");
  // THE WIDTH IS NAMED, NOT LEFT TO THE MODEL. A number it picks is frozen the
  // way a hardcoded colour is: `--container-6xl` is what the owner's own width
  // axis moves, and `max-w-[1100px]` moves with nothing.
  assert.match(rule, /--container-6xl/,
    "the rule does not say why THIS width, so a hand-picked one reads as equally good");
  // …and the escape hatch, or the rule kills every hero band on the platform.
  assert.match(rule, /WALL TO WALL/,
    "the full-bleed exception is not stated, so a correct hero reads as a rule violation");
  assert.match(rule, /<section>/,
    "the exception never says WHERE the bleed goes, which is the whole technique");
});

test("and the frontend-only prompt keeps it — that is the one every first build reads", async () => {
  // ASSERTING THE FULL PROMPT ALONE WOULD BE THE GUARD WATCHING THE LAYER BELOW
  // THE BREAK. A first build has no database, so it is `frontendRules` output
  // that reaches the model — run 37, where this was measured, was frontend-only.
  // `frontendRules` keeps by default and renumbers, so this holds today; what it
  // catches is somebody naming rule 16 in the drop list, which would leave the
  // width unstated on exactly the builds that showed the bug.
  const { PAGE_RULES, frontendRules } = await import("../builder/page-gen.mjs");
  const fe = frontendRules(PAGE_RULES);
  assert.ok(fe.indexOf("THE PAGE BODY HAS A WIDTH") > 0,
    "a frontend-only build is told nothing about the page's width");
  assert.match(fe, /mx-auto max-w-6xl px-6/,
    "the frontend prompt names the rule and not the classes it turns on");
});
