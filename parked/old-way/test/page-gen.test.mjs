// PARKED (2026-11-03, park-old-way): the old-way half of test/page-gen.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The page generator's deterministic half. Everything here runs without a model
// and without a container: the rules the generator is given, and the checks its
// output has to survive before anything is published.
//
// The checks matter more than they look. A page that lists a `collect` table
// typechecks, bundles, and passes every screenshot — then 403s the first time a
// visitor loads it. Catching that here is the difference between a repair pass
// and a broken published site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { READ_LEVELS, WRITE_LEVELS } from "../../../site-access.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  UI_COMPONENTS, componentApiFor, siteComponentApi, PAGE_RULES, SITE_PAGES_TOOL, MAX_PAGES, MAX_PAGE_CHARS, MANAGED_COLUMNS,
  schemaDigest, pagesPrompt, repairPrompt, validatePages, lintPages, briefForPages, READ_NOTE, WRITE_NOTE, accessNote, propsOf, UI_EXPORTS,
  repairImports, dedupeImports, kitPathExists, oneKitModuleFor, KIT_DIRS } from "../../../builder/page-gen.mjs";
import { MAX_TWEAK_CHARS } from "../../../builder/site-tweak.mjs";
import { accessNameFor } from "../../../site-access.mjs";
import { COMPONENT_API, COMPONENT_TYPES } from "../../../builder/component-api.mjs";
import { normalizePlan } from "../../../builder/site-plan.mjs";
import { build as buildApi, render as renderApi, extract as extractApi, buildTypes as buildTypesApi, extractTypes as extractTypesApi } from "../../../builder/gen-component-api.mjs";
import * as api from "../../../builder/page-gen.mjs";
import { modelsFor } from "../../../builder/build-models.mjs";
import { CORPUS_DIR, CORPUS_URL } from "../../../test/fixtures/corpus.mjs";
import { generatedPages } from "../../../test/fixtures/generated.mjs";
// The function the ROUTE gates on, asked directly rather than restated — a
// second copy of "does this table take a file" is a digest promising an upload
// the route refuses.
import { acceptsVisitorUploads } from "../../../site-uploads.mjs";
import { pageMeta } from "../../../site-meta.mjs";
import { buildPathFn, providerSend } from "../../../test/fixtures/build-path.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");

// The schema the reference page was written against.
const SPEC = {
  tables: [
    {
      name: "services", access: "display", fts: true,
      columns: [
        { name: "name", type: "text", notnull: true },
        { name: "description", type: "text" },
        { name: "price", type: "real" },
        { name: "duration_minutes", type: "integer" },
      ],
    },
    {
      name: "appointments", access: "collect",
      columns: [
        { name: "service", type: "text", notnull: true, ref: "services" },
        { name: "customer_name", type: "text", notnull: true },
        { name: "date", type: "text", notnull: true },
      ],
    },
    { name: "profiles", access: "user", columns: [{ name: "nickname", type: "text" }] },
  ],
};

// The schema the four reference pages were written against — a superset of SPEC
// above, because they demonstrate the publicView and the claim token that the
// smaller fixture deliberately lacks.
const REFERENCE_SPEC = {
  tables: [
    {
      name: "services", access: "display", fts: true,
      columns: [
        { name: "name", type: "text", notnull: true },
        { name: "description", type: "text" },
        { name: "price", type: "real" },
        { name: "duration_minutes", type: "integer" },
        { name: "image_url", type: "text" },
      ],
    },
    {
      name: "appointments", access: "collect",
      publicView: { columns: ["date", "time"] },
      columns: [
        { name: "service", type: "text", notnull: true, ref: "services" },
        { name: "customer_name", type: "text", notnull: true },
        { name: "customer_phone", type: "text" },
        { name: "date", type: "text", notnull: true },
        { name: "time", type: "text" },
        { name: "notes", type: "text" },
        { name: "claim_token", type: "text" },
      ],
    },
    { name: "profiles", access: "user", columns: [{ name: "nickname", type: "text" }] },
  ],
  // THE TWO FUNCTIONS manage.tsx CALLS. Until 2026-08-04 no schema could declare
  // one, so that reference page demonstrated a flow no generated site could have
  // — and the moment the lint learned to check function names it correctly
  // refused the reference page itself, which is the guard doing exactly its job.
  // Declared here, this is what a barber shop with a "manage your booking" link
  // actually has.
  functions: [
    { name: "booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "setof appointments",
      body: "SELECT * FROM appointments WHERE claim_token = tok" },
    { name: "cancel_booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "void",
      body: "DELETE FROM appointments WHERE claim_token = tok" },
  ],
};

const page = (source, p = "index.tsx") => [{ path: p, source }];

// ------------------------------------------------- publicView, stated not guessed
//
// Rule 9 tells the model not to call `usePublicRows` on a table with no public
// view — a rule it could not follow, because nothing in the digest said which
// tables have one. Measured live 2026-07-29: the generator worked out that
// `bookings` had none, could not build the taken-slots hint, and the whole site
// came out as the PLACEHOLDER over one optional enhancement.

const PV_SPEC = {
  tables: [
    {
      name: "bookings", access: "collect",
      columns: [{ name: "slot_date", type: "text" }, { name: "customer_name", type: "text" }],
      publicView: { columns: ["slot_date"], where: [], limit: 500 },
    },
    { name: "enquiries", access: "collect", columns: [{ name: "message", type: "text" }] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// A RETIRED TABLE IS CLOSED, AND EVERY DATA-API HOOK HAS TO SAY SO
//
// `schemaDigest` has filtered retired tables out since retiring existed;
// `lintPages` built its map from every declared table with no such filter. So a
// form against a closed table resolved, passed `canWriteAccess` (the stored spec
// keeps the write side it was built with) and reported NOTHING — while
// `grantsFor` emits only the two REVOKEs and `publicViewSql` drops the
// projection, so every read and write on it is 403.
//
// Reachable by the ordinary path: retire a table, then make any later
// page-generating change. The revise contract hands the model its own prior
// pages back and asks for them byte-identical except where the change was
// asked, so the existing form returns unchanged, lints silently, republishes,
// and the owner's enquiries simply stop arriving.
// ─────────────────────────────────────────────────────────────────────────────
const RETIRED_SPEC = {
  tables: [
    { name: "enquiries", access: "collect", retired: true, columns: [{ name: "name" }] },
    { name: "menu", access: "display", retired: true, columns: [{ name: "dish" }] },
    { name: "open", access: "collect", columns: [{ name: "name" }] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// WHETHER A FORM MAY TAKE A FILE — a rule conditioned on a fact nobody supplied
//
// Rule 8 said a form may accept an attachment "only when its table declares an
// image column", and whether it does is decided by `acceptsVisitorUploads` →
// `isImageColumn`, a NAMING regex the generator has never been shown. The digest
// printed every column and stated nothing about uploads, so the model was asked
// to evaluate a condition it could not see. Third instance of this shape, after
// `publicView` twice — and that one cost a whole site.
// ─────────────────────────────────────────────────────────────────────────────
const UPLOAD_NO = { tables: [{ name: "bookings", access: "collect",
  columns: [{ name: "name" }, { name: "email" }, { name: "attachment" }, { name: "notes" }] }] };
const UPLOAD_YES = { tables: [{ name: "bookings", access: "collect",
  columns: [{ name: "name" }, { name: "photo" }, { name: "notes" }] }] };

// ── The attach button ──────────────────────────────────────────────────────
//
// It shipped dead. The composer collected up to three images and posted them on
// every build and revise, and the route read them zero times — so a control with
// a tooltip promising "a logo or reference image" did nothing at all, and the
// obvious way to say "make it look like this" was equally dead.

const IMG = (n) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" + n } });
const PDF = { type: "document", source: { type: "base64", media_type: "application/pdf", data: "PDF" } };

/**
 * Every element in the kit that FLOATS over page content and paints itself with
 * `token`. Both tests below ask through this one function: two copies of the
 * predicate is how the scan and the proof-it-fires drift apart, and then the
 * proof passes against a scan that has stopped matching anything.
 *
 * WHAT IT DELIBERATELY DOES NOT SEE: an unpositioned element that floats only
 * because its PARENT is positioned — `loading-overlay`'s chip sits inside an
 * `absolute inset-0` wrapper and was fixed by hand. Catching those needs to
 * follow the JSX tree, and every cheap approximation of it flags each of the
 * many correct children of an absolute container. A narrow check with a stated
 * hole beats a broad one nobody trusts.
 */
function floatingPanelsPaintedWithThePageToken(token) {
  const kit = path.join(import.meta.dirname, "../../..", "builder", "lovable", "template", "src", "components", "ui");
  const out = [];
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    // Blank comments rather than delete them, so the line numbers reported here
    // are the real ones — and so the paragraph explaining this rule is not a hit.
    const code = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "");
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(token)) continue;
      // `sticky` is IN the page flow — headers and pinned table columns are
      // painted with the page token on purpose, and always were.
      if (/\bsticky\b/.test(lines[i])) continue;
      // An explicit alpha is a deliberate scrim over an image (`/60`, `/85`),
      // not a panel that was meant to be opaque.
      if (new RegExp(token.replace(/[-/]/g, "\\$&") + "\\/\\d").test(lines[i])) continue;
      // Only this element's own class list: a wrapped `cn(...)` string counts,
      // a sibling element's does not.
      const win = [lines[i]];
      for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        if (lines[j].includes("<")) break;          // a new element begins
        win.push(lines[j]);
        if (lines[j].includes(">")) break;          // this one closed
      }
      const cls = win.join(" ");
      // Positioned, with or without a responsive prefix (`md:absolute`) — OR
      // `pointer-events-auto`, which is only ever written on the surface INSIDE
      // a `pointer-events-none` floating layer: that is how a toast or a nudge
      // floats without swallowing clicks on the page beneath. Both instances in
      // the kit (`toast-stack`, `nudge-bubble`) are positioned by a parent, so
      // nothing about their own class list says they float.
      const positioned = /(?:^|[\s"'`])(?:[a-z]+:)?(?:fixed|absolute)\b/.test(cls)
        || /\bpointer-events-auto\b/.test(cls);
      if (!positioned) continue;
      // Casting a shadow is what separates a panel from the things CORRECTLY
      // painted with the page token: a 1px divider drawn to look like a seam, a
      // full-bleed veil over a photo, and the page root itself. `shadow-none`
      // is not a shadow, and matching it flags an ordinary sidebar input.
      if (!/\bshadow(-|\b)/.test(cls) || /\bshadow-none\b/.test(cls)) continue;
      out.push(f + ":" + (i + 1) + "  " + lines[i].trim().slice(0, 90));
    }
  }
  return out;
}

/**
 * Every MODAL SURFACE painted with `token`.
 *
 * A second rule rather than a widening of the first, because the property is
 * different and so is the evidence for it. The first asks whether an element
 * POSITIONS itself over the page; three real dialogs do not — the full-bleed
 * wrapper is positioned and the surface is a plain `relative` child of it, so
 * a same-element check cannot see any of them. `role="dialog"` says what the
 * element IS, which is the thing that actually decides this: whatever a modal
 * is layered over, you must not be able to read the page through it.
 *
 * An indentation-based ancestor walk was tried first and is not what this is.
 * It misses `modal-stack`, whose wrapper `className` sits at the SAME
 * indentation as the child it wraps, and it flagged a hairline divider and a
 * tab chip that are both correct.
 */
function dialogSurfacesPaintedWithThePageToken(token) {
  const kit = path.join(import.meta.dirname, "../../..", "builder", "lovable", "template", "src", "components", "ui");
  const out = new Set();
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const lines = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "")
      .split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/role="dialog"|aria-modal/.test(lines[i])) continue;
      // The dialog's own tag AND the panel just inside it.
      for (let j = i; j < Math.min(lines.length, i + 16); j++) {
        if (!lines[j].includes(token)) continue;
        if (new RegExp(token.replace(/[-/]/g, "\\$&") + "\\/\\d").test(lines[j])) continue;
        out.add(f + ":" + (j + 1) + "  " + lines[j].trim().slice(0, 90));
        break;
      }
    }
  }
  return [...out];
}

/**
 * Every place a file turns one of its OWN `React.ReactNode` props into a string
 * with `String()`, ignoring the sites that narrow with `typeof x === "string"`
 * first — those are the correct form and flagging them teaches the fix away.
 *
 * Returns `file:line  [field]  source` so a failure names the prop, not just
 * the file. Takes the source map so a fixture can be driven through it.
 */
function reactNodesStringified(sources) {
  const out = [];
  for (const [f, src] of sources) {
    const fields = new Set();
    for (const m of src.matchAll(/([A-Za-z_]\w*)\s*\??\s*:\s*React\.ReactNode/g)) fields.add(m[1]);
    if (!fields.size) continue;
    // ONE HOP THROUGH A LOCAL, because a mutation walked straight past the scan
    // without it: `const a = f.before ?? ""` and then `String(a)` is the same
    // bug wearing a different name, and it is how the code reads once somebody
    // pulls a repeated expression out. A local built by `labelText` or already
    // narrowed to a string is NOT added — those are the correct forms, and
    // flagging them teaches the fix away.
    for (const m of src.matchAll(/\b(?:const|let)\s+([A-Za-z_]\w*)\s*=\s*([^;\n]+)/g)) {
      const [, name, rhs] = m;
      if (/labelText\s*\(|typeof\s|String\s*\(/.test(rhs)) continue;
      if ([...fields].some((f) => new RegExp("\\b" + f + "\\b").test(rhs))) fields.add(name);
    }
    // A TYPE PREDICATE IS THE LANGUAGE'S OWN WAY OF SAYING "NARROWED", and a
    // scan that ignores one reports correct code. `isText(a) && isText(b) ? …`
    // is not a stringified node — after that guard TypeScript knows `a` is
    // `string | number`. There are four of these in the whole kit, so honouring
    // them is narrow rather than a licence.
    const predicates = [];
    for (const m of src.matchAll(/(?:const\s+([A-Za-z_]\w*)\s*=\s*(?:<[^>]*>)?\([^)]*\)|function\s+([A-Za-z_]\w*)\s*\([^)]*\))\s*:\s*\w+ is /g)) {
      predicates.push(m[1] || m[2]);
    }
    src.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const fld of fields) {
        // One level of nested parens inside the call, or `String(at.get(x)?.label)`
        // — a real offender — walks straight past a `[^()]*` body.
        if (!new RegExp("String\\((?:[^()]|\\([^()]*\\))*\\b" + fld + "\\b").test(ln)) continue;
        if (new RegExp("typeof\\s+[^;]*\\b" + fld + "\\b[^;]*===\\s*\"string\"").test(ln)) continue;
        if (predicates.some((p) => new RegExp("\\b" + p + "\\(\\s*" + fld + "\\s*\\)").test(ln))) continue;
        out.push(`${f}:${i + 1}  [${fld}]  ${ln.trim().slice(0, 110)}`);
      }
    });
  }
  return out;
}

const UI_SOURCES = fs.readdirSync(path.join(TEMPLATE, "src/components/ui"))
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => [f, fs.readFileSync(path.join(TEMPLATE, "src/components/ui", f), "utf8")]);

/** Every JSX tag in a file, in order, with its full attribute text. Walks brace
 *  depth so a nested `onKeyDown={(e) => { … }}` does not end the tag early — the
 *  first version of this scan stopped at the first `>` and reported two
 *  components for a handler that is written on the very element it was reading. */
function jsxTags(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
               .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "<") continue;
    const m = /^<(\/?)([A-Za-z][\w.]*)/.exec(s.slice(i, i + 40));
    if (!m) continue;
    let j = i + m[0].length, d = 0, q = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === q && s[j - 1] !== "\\") q = null; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "{") d++; else if (c === "}") d--;
      else if (c === ">" && d === 0) break;
    }
    const attrs = s.slice(i + m[0].length, j);
    out.push({ close: m[1] === "/", name: m[2], attrs, self: attrs.trimEnd().endsWith("/"),
               line: s.slice(0, i).split("\n").length });
    i = j;
  }
  return out;
}

const IS_BUTTON = (t) => t.name === "button" || (t.name === "Button" && !/\basChild\b/.test(t.attrs));
const IS_OPTION = (t) => /role="option"/.test(t.attrs);
const INTERACTIVE = (t) =>
  /^(button|a|input|select|textarea)$/.test(t.name) || IS_BUTTON(t) ||
  /role="(button|link|checkbox|switch|tab|option|menuitem|radio)"/.test(t.attrs);

/** Interactive content nested inside some container it may not be in. */
function interactiveInside(sources, isContainer) {
  const out = [];
  for (const [f, src] of sources) {
    const stack = [];
    for (const t of jsxTags(src)) {
      if (t.close) { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === t.name) { stack.length = k; break; } continue; }
      const outer = stack.find(isContainer);
      if (outer && INTERACTIVE(t)) out.push(`${f}:${t.line}  <${t.name}> inside the <${outer.name}> on line ${outer.line}`);
      if (!t.self) stack.push(t);
    }
  }
  return out;
}
const interactiveInsideAButton = (sources) => interactiveInside(sources, IS_BUTTON);

/**
 * A listbox that handles its OWN arrow keys, and how its options can be reached.
 *
 * Two correct answers and no third: roving tabindex, where one option is
 * `tabIndex={0}` and arrows move the zero; or `aria-activedescendant`, where
 * focus stays on an input and the active option is named by id. A listbox with
 * neither is operable by mouse only.
 *
 * Scoped to files that own their keys, because most of these listboxes are
 * driven by a caller's input and correctly have no keyboard model of their own.
 */
function listboxesWithNoWayIn(sources) {
  const out = [];
  for (const [f, src] of sources) {
    if (!/role="listbox"/.test(src)) continue;
    if (!/onKeyDown/.test(src) || !/ArrowDown/.test(src)) continue;
    if (/aria-activedescendant/.test(src)) continue;
    // A roving tab stop: some option's tabIndex expression can produce 0.
    const roving = jsxTags(src).some((t) => /role="option"/.test(t.attrs) && /tabIndex=\{[^}]*\b0\b/.test(t.attrs));
    if (!roving) out.push(f);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIAL VALIDATE AND THE SITE IT CANNOT SEE. Found by the 2026-08-13 audit and
// reproduced with this module: the dangling-link rewrite judged links against
// only the pages POSTED, and the edit/addon lanes post only what the model
// returned — so a one-page edit with a correct <Link to="/book"> published with
// the link pointed at "/", and problems[] told the customer their live booking
// page did not exist. A false report AND a silently broken CTA, on the cheap
// lanes specifically built to touch one page.

const EDIT_PAGE = {
  pages: [{ path: "manage.tsx", source: 'import { createFileRoute, Link } from "@tanstack/react-router";\nexport const Route = createFileRoute("/manage")({ component: M });\nfunction M() { return <div><Link to="/book">Back to booking</Link><Link to="/nowhere">gone</Link></div>; }\n' }],
};

test("both partial lanes hand validate the stored site's routes", () => {
  // The module fix is nothing if the lanes do not pass what they know — the
  // wiring layer, this repo's most-recorded failure. Both call sites must carry
  // knownRoutes derived from their stored-page list.
  // Windowed, not regex-matched to the closing paren: a first draft used
  // `[^;]*?\)` and the match ended at the `)` inside `(eSrc || [])`, cutting the
  // window short of the very line it asserts — a guard that could only fail.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const wins = [];
  for (let i = worker.indexOf("validatePages("); i >= 0; i = worker.indexOf("validatePages(", i + 1)) {
    const win = worker.slice(i, i + 400);
    if (/partial:\s*true/.test(win)) wins.push(win);
  }
  // RE-ANCHORED 2026-09-17, and the count is kept rather than loosened to a
  // floor: it is a CENSUS — a partial lane added without `knownRoutes` must
  // fail by existing, and `>= 2` would let a deleted call site pass. The third
  // is the addon's REPAIR pass, which re-asks validate over what survives when
  // a page is withheld with a dead QR code, so a link into a withheld route is
  // rewritten rather than published dangling. It carries the same two things
  // for the same reason, which is why it belongs in this census rather than
  // beside it as an exemption.
  // THE FOURTH (2026-10-24, round 2 of the retry rule): the add-on writer's
  // answer read ahead of the merge (`aWriterCheck`), so an answer that would end
  // `rewrote` or `not-landed` is asked once more — same two things, same reason.
  assert.equal(wins.length, 4, "expected the two partial lanes, the addon's withholding repair and its retry check, found " + wins.length);
  for (const c of wins) {
    assert.match(c, /knownRoutes:/, "a partial lane calls validate without the site's own routes:\n" + c.slice(0, 200));
    assert.match(c, /routeOf\(/, "knownRoutes is not derived from the stored pages:\n" + c.slice(0, 200));
  }
});

// EVERY RUNG THAT GENERATES SOURCE REPAIRS ITS PARTS, NOT ONLY ITS PAGES.
// Three call sites: the build path (driven end to end in
// `test/publish-pages.test.mjs`) and the page and addon rungs in `worker.js`,
// which have no driven harness — so these two are read, and the reading is
// honest about being weaker than a drive. What makes it worth having is that
// cutting either leaves `repairImports` perfect and one whole rung's components
// unrepaired, which is the recorded wiring shape: a hop nobody lists is a hop
// nobody guards.
test("the page and addon rungs repair their parts, not only their pages", () => {
  const w = fs.readFileSync(fileURLToPath(new URL("../../../worker.js", import.meta.url)), "utf8");
  const code = w.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(code.length, w.length, "the blanker moved a byte");

  for (const v of ["pValid", "aValid"]) {
    assert.ok(code.includes("repairImports(" + v + ".pages, { parts: "),
      v + " stopped repairing its pages — this guard is measuring the wrong thing");
    assert.ok(code.includes(v + ".parts = repairImports(" + v + ".parts, { parts: "),
      v + " repairs its pages and leaves its hand-written components alone");
  }
});

/* ------------------------------------------ the same import written twice */

// RUN 90 IS WHAT THIS SECTION IS FOR (`coalhole-1`, 2026-08-30):
//
//     Error transforming route file /app/src/routes/index.tsx:
//     SyntaxError: Identifier 'createFileRoute' has already been declared. (3:9)
//
// The model wrote its first import line, then wrote it again. JavaScript will
// not take one name introduced twice at the top level, the bundler stopped at
// line 3, and the customer was charged for a placeholder. It is the one failure
// the ship-it-anyway change cannot reach — Vite strips types without checking
// them, but it still has to PARSE — and salvage cannot help either, because the
// page is `index.tsx` and the home page is never stubbed.

// THE PAGE, DERIVED. `dupPage` prepends `onePage`'s OWN first line, so the two
// copies cannot drift apart the way a hand-typed pair would — this repo's
// "derive a fixture from its real producer".
const onePage = `import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Page });
function Page() { const { data } = useRows("services"); return <div>{data?.length}</div>; }`;
const dupPage = () => onePage.split("\n")[0] + "\n" + onePage;
