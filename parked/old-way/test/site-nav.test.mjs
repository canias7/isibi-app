// PARKED (2026-11-03, park-old-way): the old-way half of test/site-nav.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  navSlots, parseNavItems, renderNav, applyNav, readNav, navDigest,
  navRequest, navUsage, navReply, runNavEdit, NAV_TOOL, NAV_MODEL,
  MAX_LABEL,
  actionSlots, applyAction,
  linkSlots, matchLinks, applyPageLinks, linkRefusal,
  MAX_LINK_LINES, MAX_LINK_SLOTS,
} from "../../../builder/site-nav.mjs";
import { EDIT_LAYERS } from "../../../builder/route-shared.mjs";
import { CORPUS_DIR } from "../../../test/fixtures/corpus.mjs";
import { GENERATED_DIR } from "../../../test/fixtures/generated.mjs";

const page = (p, links) => ({
  path: p,
  source: `import { SiteChrome } from "@/components/ui/site-chrome";\nexport default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${links}]}>\n      <h1>Hello</h1>\n    </SiteChrome>\n  );\n}\n`,
});
const NAV = `{ label: "Prices", href: "/prices" }, { label: "Book", href: "/book" }`;

// ── READING THE MODEL ───────────────────────────────────────────────────────

const reply = (links, usage) => ({ content: [{ type: "tool_use", input: { links } }], usage });
const ROUTES = ["/", "/prices", "/book"];

// ── THE LANE ────────────────────────────────────────────────────────────────

const okReply = reply(
  [{ label: "Book", href: "/book" }, { label: "Prices", href: "/prices" }],
  { input_tokens: 100, output_tokens: 20 },
);

test("the router's layer description names the menu and points a new page at addon", () => {
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = src.indexOf('"\\"nav\\" —');
  assert.ok(at > 0, "the nav layer has a description");
  const window = src.slice(at, src.indexOf('"\\"page\\" —', at));
  assert.ok(window.length > 100, "the window reaches the next layer");
  // THE PROPERTY, NOT THE SPELLING. This was pinned to the exact phrase "THE TOP
  // OF EVERY PAGE" and went red on a correct change — the lane grew the footer's
  // contact details, which are at the BOTTOM, so the headline had to stop
  // claiming the top. What it must say is that this lane is the same on every
  // page, since that is the fact separating it from `page`.
  assert.match(window, /every[- ]page/i);
  assert.match(window, /THE MENU — which items are in it/);
  // An item can only point at a page that exists, so "add a gallery to the
  // menu" with no gallery page is an addon and must say so here.
  assert.match(window, /ONLY EVER POINTS AT PAGES THE SITE ALREADY HAS/);
});

test("THE `page` LAYER NO LONGER SENDS A MENU CHANGE TO THE ADDON LANE", () => {
  // It used to, by name: "add the gallery to the menu everywhere" was its own
  // worked example of something to answer "addon" for. Correct while nothing
  // could edit a menu; with this layer it is a ~27-credit page-generation call
  // to move one word, and the example has to point at the cheap lane or the
  // layer is reachable by nothing.
  // COMMENTS ARE BLANKED BEFORE THE ABSENCE IS JUDGED, and this test failed
  // against a correct fix without it: the comment recording why the clause
  // changed quotes the clause, so prose explaining a bug contains the bug's
  // spelling. WHOLE LINES ONLY — blanking from any `//` would eat a line
  // holding an `https://` URL, and this file is mostly prompt text.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8")
    .replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length));
  const at = src.indexOf('"ONE PAGE, AND ONLY ONE.');
  assert.ok(at > 0);
  const window = src.slice(at, at + 1400);
  assert.doesNotMatch(window, /add the gallery to the menu/);
  // RE-ANCHORED 2026-10-02: a change to the menu the site HAS goes to `nav`;
  // a NEW item in it is an addition, which the add-on step hands back here.
  assert.match(window, /A CHANGE TO THE MENU IT HAS IS \\"nav\\"/);
});

test("the worker dispatches the nav layer and imports the module", () => {
  // The wiring layer, where this repo has recorded twelve dead features. A call
  // to a name that was never imported is a ReferenceError on the edit path.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*\brunNavEdit\b[^}]*\} from "\.\/builder\/site-nav\.mjs"/);
  const at = w.indexOf('if (eLayer === "nav")');
  assert.ok(at > 0, "the nav branch exists");
  const window = w.slice(at, w.indexOf('if (eLayer === "picture")', at));
  assert.ok(window.length > 500, "the window reaches the next branch");
  assert.match(window, /await runNavEdit\(/);
  // THE ROUTES ARE THE ALLOW-LIST and they have to come from the real pages —
  // an empty list drops every internal item in the menu.
  assert.match(window, /routes: navRoutes/);
  assert.match(window, /eSrc\.map\(\(p\) => routeOf\(p\.path\)\)/);
  // It republishes through the one spine, so a nav edit gets the render check,
  // the version archive and the redirect map like every other cheap edit.
  // `publishStep` since 2026-08-29 — the edit route's branches hand their pages
  // to a deferring wrapper so the spine runs ONCE per message (owner: "if the
  // act was 2 things then 1 publish"). The property is unchanged: this branch
  // still hands its pages to the publish path.
  assert.match(window, /await publishStep\(env, \{/);
});

// ── THE HEADER'S CALL-TO-ACTION BUTTON ──────────────────────────────────────

const withBtn = (p, extra = "") => ({
  path: p,
  source: `export default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${NAV}]} action={{ label: "Book a chair", href: "/book" }}${extra}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});
const noBtn = (p) => ({
  path: p,
  source: `export default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${NAV}]}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});

test("the router's nav layer names the BUTTON as well as the menu", () => {
  // A capability the router cannot describe is one nothing can reach — the
  // shape twelve dead features in this repo have had.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = src.indexOf('"\\"nav\\" —');
  const window = src.slice(at, src.indexOf('"\\"page\\" —', at));
  // THE FRAME'S BUTTON (2026-10-23, fix-edit-flow): a page section's own button label is "text".
  assert.match(window, /THE FRAME'S BUTTON — the one beside the menu in the header, on every page — what it says AND where it goes/);
  // The phone case is named explicitly: it is 46 of the 288 buttons in the
  // corpus, and for a trade it is the entire conversion path.
  assert.match(window, /phone number belongs here/);
});

test("the worker carries the button's outcome back", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('ok: true, layer: "nav"');
  assert.ok(at > 0);
  // WIDER SINCE 2026-10-03: every entry left out is carried by name before it.
  const window = w.slice(at, at + 1600);
  assert.match(window, /action: nOut\.action \|\| undefined/);
  assert.match(window, /removedAction: nOut\.removedAction \|\| undefined/);
});

// ── EVERY LINK WRITTEN INTO THE PAGES ───────────────────────────────────────
//
// Measured over the 337 pages the generator learns from and writes: 600 links
// live in the chrome — the menu and the button, both already site-wide editable
// — and 469 live in the page bodies, where the only lane that could touch one
// was `page`: one page, one model call, for a destination.

const body = (p, inner) => ({
  path: p,
  source: `export default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${NAV}]}>\n${inner}\n    </SiteChrome>\n  );\n}\n`,
});

// ── WHICH LINKS A CHANGE NAMES ──────────────────────────────────────────────

const MANY = [
  { page: "index.tsx", label: "Book now", href: "/book", typed: false },
  { page: "about.tsx", label: "Book now", href: "/classes", typed: false },
  { page: "about.tsx", label: "Prices", href: "/prices", typed: true },
];

// ── READING THE ANSWER ──────────────────────────────────────────────────────

const linkReply = (pageLinks) => ({ content: [{ type: "tool_use", input: { pageLinks } }] });

// ── THE WIRING, WHICH IS WHERE TWELVE FEATURES HAVE DIED ─────────────────────

test("the router's nav layer names the links in the copy", () => {
  // A capability the router cannot describe is one nothing can reach.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = src.indexOf('"\\"nav\\" —');
  const window = src.slice(at, src.indexOf('"\\"page\\" —', at));
  assert.match(window, /LINKS WRITTEN INTO THE PAGES/);
});

test("the worker carries the links' outcome back", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('ok: true, layer: "nav"');
  assert.ok(at > 0);
  const window = w.slice(at, w.indexOf("cost: await eCharge", at));
  assert.match(window, /movedLinks: nOut\.movedLinks/);
  assert.match(window, /refusedLinks: nOut\.refusedLinks/);
});

// ── A COMPUTED BUTTON IS REPLACED, NEVER DOUBLED ──────────────────────────
//
// Found 2026-09-02 by driving `applyAction` over the 332-page corpus and parsing
// every result with TypeScript: one page, `marketplace/index.tsx`, whose button
// is `label: buying ? "Browse everything" : "Start selling"`. `readAction`
// answers null for a computed label, the writer read that null as "no button
// yet", and the insertion branch sliced at an `insertAt` the slot does not have
// — `src.slice(0, undefined)` is the whole file, so the page came back as
// itself, then the attribute, then itself again. fretwork-1's header has the
// same shape, and its `action` lane died twice with "Unexpected token (181:9)":
// line 181 being the first line after the page's last.
const computedBtn = (p) => ({
  path: p,
  source: `const buying = true;\nexport default function P() {\n  return (\n    <SiteChrome name="Made Round Here" links={[${NAV}]}\n      action={{ label: buying ? "Browse everything" : "Start selling", href: buying ? "/browse" : "/sell" }}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});

// ── A COMPUTED BUTTON IS DESCRIBED BY ITS HALVES, NEVER AS ABSENT ──────────
//
// Live, 2026-09-02, the seventh sweep: fretwork-1's header button has computed
// words and a literal `tel:+441144960123`. `readAction` answers null for the
// whole button, the digest said "(there is no button)", and the model asked to
// change the WORDS wrote a new button and had to invent its link — "/". The
// page's one working control became a link to itself on a request about
// wording. The slot now carries each half as it stands (`known`), and the
// digest states them, so the half they did not ask about is there to copy.
const halfBtn = (p) => ({
  path: p,
  source: `const open = true;\nexport default function P() {\n  return (\n    <SiteChrome name="Crookes" links={[${NAV}]}\n      action={{ label: open ? "Your first lesson is free" : "Lessons", href: "tel:+441144960123" }}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});
