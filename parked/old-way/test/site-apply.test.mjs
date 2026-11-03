// PARKED (2026-11-03, park-old-way): the old-way half of test/site-apply.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The edit lane's text layer.
//
// The failure this file is written around is NOT a crash. It is an edit that
// reports success and either changed nothing, or changed something nobody asked
// about — both of which are invisible to the customer until they notice a
// heading they liked has gone. So most of what is asserted here is about what
// must NOT move.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  TEXT_TOOL, TEXT_MODEL, TEXT_MAX_TOKENS, MAX_TEXT_ITEMS, MAX_TEXT_CHARS,
  textRequest, textItems, readTextEdits, textUsage, runTextEdit,
} from "../../../builder/site-apply.mjs";
import { EDIT_LAYERS, ASK_TOOL } from "../../../builder/route-shared.mjs";
import { CORPUS_URL } from "../../../test/fixtures/corpus.mjs";
import { PLAN_KEYS } from "../../../builder/site-plan.mjs";
import { readCss } from "../../../builder/site-freecss.mjs";
import { modelsFor } from "../../../builder/build-models.mjs";
// THE HARNESS'S OWN CUT LIST, so this file and `scripts/addon-sweep.mjs` cannot
// hold two ideas of which chat.js functions `editReply` needs in scope.
import { EDIT_BROWSER_FNS } from "../../../scripts/addon-sweep.mjs";

const HOME = {
  path: "src/routes/index.tsx",
  source: [
    'import { Button } from "@/components/ui/button";',
    'export default function Home() {',
    '  return (',
    '    <div className="p-8">',
    '      <h1>Sharp Fade Barbers</h1>',
    '      <p>Call us on 0113 496 0000</p>',
    '      <Button>Book a chair</Button>',
    '    </div>',
    '  );',
    '}',
  ].join("\n"),
};
const BOOK = {
  path: "src/routes/book.tsx",
  source: [
    'export default function Book() {',
    '  return (',
    '    <footer>',
    '      <span>Call us on 0113 496 0000</span>',
    '    </footer>',
    '  );',
    '}',
  ].join("\n"),
};
const PAGES = [HOME, BOOK];

const toolReply = (edits, usage) => ({
  content: [{ type: "tool_use", name: "write_text_edits", input: { edits } }],
  usage: usage || { input_tokens: 1200, output_tokens: 40 },
});

const idOf = (items, text, path) =>
  items.findIndex((it) => it.text === text && (!path || it.path === path));

// ── the wiring layer, which is where this repo keeps losing features ──────────
//
// worker.js cannot be imported, so every assertion here reads it. Eight times
// now a feature has been correct at every layer and dead at one silent one.

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

/** The edit handler's own block, so a claim about it cannot be satisfied by the build path. */
// COMMENTS BLANKED, and this is not tidiness: the assertions below COUNT
// things, and this file's own subject — "a compile failure must tell the
// customer their site survived" — is a sentence the code comments quote while
// explaining why. A rollback comment reading `repeating "your site is
// untouched" is the one answer that makes it undiagnosable` added a sixth match
// against five branches and failed a correct change. Same class as the absence
// guards in `site-meta` and `prerender`: prose explaining a bug contains the
// bug's spelling. Blanked rather than removed, so every offset stays put.
function editBlock() {
  const from = WORKER.indexOf("\n          if (ed) {");
  assert.ok(from > 0, "the edit handler is gone or renamed — every assertion below would pass vacuously");
  const to = WORKER.indexOf("\n          if (ad) {", from);
  assert.ok(to > from, "could not find the end of the edit handler");
  return WORKER.slice(from, to).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * One layer's branch, from its own `if` to whichever branch comes NEXT.
 *
 * DERIVED, because sliced to a named neighbour it swallows anything inserted
 * between them — measured: adding the `picture` branch between `rules` and
 * `text` put a recompiling layer inside the window that asserts the rules layer
 * never recompiles, and inside the one that asserts the data layer never does.
 * Both went red on a correct change, which is the overlapping-window bug this
 * repo already records twice.
 */
function layerBranch(b, layer) {
  const from = b.indexOf('if (eLayer === "' + layer + '") {');
  assert.ok(from >= 0, "the " + layer + " layer is gone or moved");
  const rest = [...b.matchAll(/if \(eLayer === "[a-z]+"\) \{/g)]
    .map((m) => m.index).filter((i) => i > from);
  const to = rest.length ? rest[0] : b.length;
  assert.ok(to > from, "the " + layer + " branch is empty");
  return b.slice(from, to);
}

test("the edit handler CANNOT reach the schema, the seeder or the page generator", () => {
  // The guarantee is a property of the code path, not a rule inside a 700-line
  // handler. Comments blanked, since the block explains what it may not do.
  const raw = editBlock();
  const b = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(b.length, raw.length, "blanking must preserve offsets");
  // THE BAN BECOMES A SCOPE, FOR THE SECOND TIME. This listed
  // `generateSitePages`, which was true while the lane had only `text` and
  // `look` and became a FALSE CLAIM the day the `page` layer landed. It then
  // listed `applySiteSchema`, which was true until the `rules` layer landed —
  // that layer's whole purpose is to change what a table DOES, which is a schema
  // apply and nothing else. A guard that forbids the feature is not protecting
  // anything; what it must hold now is that the reach is BOUNDED to one branch.
  //
  // These three stay absolutely forbidden and are the ones that matter:
  // `seedSiteRows` FABRICATES ROWS — a rule change that invents a customer's
  // booking is the worst thing this lane could do — and the other two are how a
  // build provisions and republishes a whole site.
  for (const forbidden of ["seedSiteRows", "ensureSiteBackend", "buildAndPublishPages"]) {
    assert.ok(!b.includes(forbidden), "the edit lane must not be able to reach " + forbidden);
  }
  assert.equal((b.match(/applySiteSchema\(/g) || []).length, 1,
    "the schema may be applied from exactly one place in the edit lane");
  const rBlock = layerBranch(b, "rules");
  assert.ok(rBlock.includes("applySiteSchema("),
    "…and that place is the rules branch, not some other layer");
  // AND IT PUBLISHES NOTHING, which is what makes it a rung below `look` rather
  // than a variant of `addon`. Asserted as an absence between its own
  // boundaries, exactly as the data layer's is.
  assert.ok(!rBlock.includes("recompileAndPublish(") && !rBlock.includes("publishStep("),
    "a rule is enforced in Postgres and on the request path — no page changes, so nothing is republished");
  // AND THE GENERATION IT DOES DO IS BOUNDED. Without the mode and the target it
  // is an ordinary revise wearing an edit's name — every page re-emitted, at the
  // price the lane exists to avoid.
  // RE-ANCHORED 2026-10-02 (the owner's second review): the call's argument
  // list grew a tail — no clock of its own (`null`) and the transport that
  // shows the step its answers — so the target is no longer the last argument.
  // The property is the mode and the one named file.
  assert.match(b, /generateSitePages\([^;]*"page", target\.path[,)]/s,
    "the page layer must generate in page mode against one named file");
  assert.equal((b.match(/generateSitePages\(/g) || []).length, 1,
    "the edit lane must make at most one generation call");
  // Not passing because the block was blanked away.
  assert.match(b, /runTextEdit/);
});

test("the charge comes AFTER the publish, on every layer", () => {
  // The exemption IS the ordering: a publish that throws leaves the spend
  // un-made. A mutation moving the charge up would bill for a site that was
  // never changed.
  const b = editBlock();
  // ANCHOR ON THE CALL, NOT THE DEFINITION. The first draft of this took
  // `indexOf("collectCredits(")`, which lands inside the `eCharge` helper
  // declared near the top of the block — so it measured where the helper is
  // WRITTEN rather than where it RUNS, and went red on correct code. Same trap
  // as a guard matching `buildEffortHTML()`'s own definition.
  assert.equal((b.match(/collectCredits\(/g) || []).length, 1,
    "there must be exactly one place money leaves the ledger");
  // RE-ANCHORED 2026-09-04 (run 39): the funnel the spine charges its
  // translation calls through — `charge: (usage) => eCharge(...)` on the
  // deferred publish — is an ARROW written near the top of the block and run
  // by the spine once its translations are in hand, after every rung's work.
  // A definition, not a charge, the same distinction the comment above draws
  // for `collectCredits`; excluded by its own `=>`, and required to exist so
  // the exclusion cannot go vacuous.
  assert.match(b, /charge: \(usage\) => eCharge\(\{ langUsage: usage \}\)/, "the deferred publish no longer hands the spine a charge funnel");
  const calls = [...b.matchAll(/(?<!=> )eCharge\(/g)].map((m) => m.index);
  assert.ok(calls.length >= 3, "each layer's success must charge — found " + calls.length);
  // EVERY CHARGE COMES AFTER THE WORK IT BILLS FOR, which is not the same as
  // "after the publish" — this asserted the latter and went red on the DATA
  // layer, whose defining property is that it publishes nothing at all. Rows are
  // read at runtime, so the change is live the moment it commits.
  for (const at of calls) {
    const published = Math.max(b.lastIndexOf("recompileAndPublish(", at), b.lastIndexOf("publishStep(", at));
    const wroteRows = b.lastIndexOf("runDataEdit(", at);
    assert.ok(published > 0 || wroteRows > 0,
      "a charge at offset " + at + " runs before any work was done");
  }
  // AND THE DATA LAYER STILL SKIPS THE CONTAINER ON EVERY ROW CHANGE, which is
  // what makes it the cheap layer it claims to be. It stopped being an absence
  // the day it learned to reorder a list: what order a list comes out in lives
  // in `useRows("dishes", { order })` in the page source, so that one path must
  // recompile and every other one must not.
  //
  // GATED ON THE REORDER, NOT MERELY PRESENT. A recompile the branch reaches
  // unconditionally would put a container run on the cheapest lane there is,
  // for every price change on every site.
  const dBlock = layerBranch(b, "data");
  assert.match(dBlock, /runDataEdit\(/);
  const pubs = [...dBlock.matchAll(/(?:recompileAndPublish|publishStep)\(/g)].map((m) => m.index);
  assert.ok(pubs.length <= 1, "the data layer publishes in at most one place, found " + pubs.length);
  if (pubs.length) {
    // The gate is the nearest `if` above it and it must ask about the reorder.
    const guard = dBlock.lastIndexOf("if (", pubs[0]);
    assert.ok(guard > 0, "the data layer's publish is not guarded at all");
    assert.match(dBlock.slice(guard, pubs[0]), /sortPages/,
      "the data layer's publish is not gated on a reorder — every row change would run a container");
  }
  // And the helper itself is declared once, so the ordering above cannot be
  // satisfied by a second charge site that happens to sit lower.
  assert.equal((b.match(/const eCharge = /g) || []).length, 1);
});

test("a failed edit publishes nothing and says the site is untouched", () => {
  const b = editBlock();
  // DERIVED FROM THE BRANCHES, not a count somebody remembers to bump — this
  // read `=== 2` and went red the day a third layer landed, which is a test
  // about arithmetic rather than about the promise it is protecting.
  // 2026-10-16: a branch may keep an overlap's own code (`lostOr(pub, "compile")`).
  const COMPILE = /error: (?:"compile"|lostOr\(\w+, "compile"\))/g;
  const compiles = (b.match(COMPILE) || []).length;
  assert.ok(compiles >= 2, "expected a compile-failure branch per publishing layer, found " + compiles);
  // THE PROMISE, NOT THE PHRASE. This counted the literal "site is untouched"
  // and went red on a fifth branch that keeps the promise in different words
  // ("so nothing changed") — a test about wording, on a file whose whole subject
  // is that a customer must be told their site survived. The alternation is
  // small and deliberate: these are the ways this codebase says it, and a new
  // branch that says it a sixth way should have to add itself here rather than
  // pass by accident.
  //
  // PER BRANCH, NOT AS TWO TOTALS. Counting both across the whole block passes
  // when one branch says it twice and another says it not at all — which is the
  // vacuous shape this file keeps recording, and it went red honestly the day a
  // branch wrote the promise in a ternary with two arms.
  const SURVIVED = /site is untouched|nothing changed|your site is exactly as it was|pages are exactly as they were/;
  const at = [...b.matchAll(COMPILE)].map((m) => m.index);
  for (const i of at) {
    // To the end of that `Response.json`, which is where its message lives.
    const end = b.indexOf("status: 422", i);
    assert.ok(end > i, "a compile failure at " + i + " does not answer 422");
    assert.match(b.slice(i, end), SURVIVED,
      "the compile failure at " + i + " does not tell the customer their site survived it");
  }
  // A 422 THAT IS NOT A COMPILE FAILURE IS FINE — the data layer refuses with
  // one when it matched nothing, and it never compiles anything. This asserted
  // equality and went red on a legitimate fourth refusal. What must hold is that
  // no compile failure escapes as a success.
  assert.ok((b.match(/status: 422/g) || []).length >= compiles,
    "a failed compile is not reported as success");
});

test("a climb the classification keeps still escalates with a 200", () => {
  // This route sits BELOW addon and build on a ladder, and a change that is
  // possible one rung up must not be shown as a refusal.
  //
  // ⚠ RE-WRITTEN 2026-09-23. This read "everything the lane cannot do
  // escalates" and listed nine reasons — and four of them (`unconfigured`,
  // `no-change`, `layer`, and `no-meta` on the look rung) are exactly what a
  // rewrite of every page cannot fix, so the browser's answer to them bought
  // ~25 credits for nothing. `builder/edit-failure.mjs` classifies every one
  // and `test/edit-failure.test.mjs` holds the route to that table both ways;
  // what is kept here is the half that is still this file's: the reasons that
  // DO climb still reach the helper, and the helper still answers 200.
  const b = editBlock();
  assert.match(b, /escalate = \(reason, extra\) =>\s*\n?\s*Response\.json\(\{ ok: false, escalate: true/,
    "the escalation helper is gone or no longer answers 200");
  for (const reason of ["empty", "no-source", "no-backend", "no-meta", "no-look", "needs-pages", "too-much-text", "build"]) {
    assert.ok(b.includes('escalate("' + reason + '"'), "no escalation path for: " + reason);
  }
  // AND THE FOUR THAT WENT ARE ANSWERED, not dropped.
  for (const key of ["route/unconfigured", "look/no-change", "page/no-change", "route/layer"]) {
    assert.ok(b.includes('explain("' + key + '"'), "no answer at all for: " + key);
  }
});

test("the CSS and logo lanes serve a site with NO database — the default kind", () => {
  // 2026-08-28. Both lanes opened with `if (!xdb) return escalate("no-backend")`
  // and a first build has provisioned no database since the frontend-first
  // change, so MOST sites hit it: every colour change and every logo swap went
  // up the ladder to the full page rewrite. Measured on `shoeroom-1` — "make
  // the footer black" cost 17 credits, and the logo lane is meant to cost NONE.
  //
  // `editBlock()` blanks comments length-preservingly, which this assertion
  // depends on: the fix's own comments quote the refusal they removed, so a
  // scan of the raw source would find the string and pass on the prose.
  const b = editBlock();

  // THE PROPERTY: no lane refuses over the connection it never queries. Derived
  // from the declarations rather than a list of today's variable names, so a
  // renamed connection cannot slip a new refusal past this.
  for (const v of ["edb", "ldb"]) {
    assert.match(b, new RegExp("const " + v + " = await (?:siteBackendBySlug|siteRowConn)"),
      "the " + v + " lane no longer reads the connection at all — this guard has lost its subject");
    assert.ok(!new RegExp("if \\(!" + v + "\\) return escalate").test(b),
      "the " + v + " lane refuses a site with no database again — that is most sites, at ~17 credits each");
  }

  // AND THE SECOND HALF, WHICH IS WHAT MAKES THE FIRST HALF REAL — now in its
  // strongest form. Until 2026-08-29 the look lane read `_meta` for the schema
  // to hand the DESIGNER a `tables:` list, and that read genuinely needed a
  // database: left unguarded, `sqlQuery(null, …)` throws into the catch and
  // escalates as `no-meta` — the same refusal wearing a different name, and the
  // whole fix would have measured as no change at all. So this asserted the
  // `if (edb)` guard around it.
  //
  // THE READ IS GONE ENTIRELY. With the edit path split off the build path
  // (owner: "it should be 2 separated path tho") there is no designer on this
  // lane to hand a table list to, and no lane here has ever had a use for one.
  // So the guard is no longer "the sql is gated" but "there is no sql" — which
  // cannot be got wrong by omission the way a gate can.
  //
  // WINDOWED LANDMARK TO LANDMARK, never by byte count: this repo puts its
  // reasoning in comments and any byte window is outrun by the next one. The
  // closing landmark is the NEXT lane, so anything inserted between them is
  // inside the window rather than swallowed.
  const lookAt = b.indexOf('if (eLayer === "look")');
  const nextAt = b.indexOf('if (eLayer === "page")');
  assert.ok(lookAt > 0, "the look lane is gone or was renamed — this scan has no subject");
  assert.ok(nextAt > lookAt, "the page lane no longer follows the look lane — this window has no end");
  const lookLane = b.slice(lookAt, nextAt);
  assert.ok(!/sqlQuery\(/.test(lookLane),
    "the look lane queries Postgres again — it is meant to be databaseless in fact, not merely by permission");

  // THE LANES THAT REALLY DO NEED ONE STILL ASK. `data` reads rows and `rules`
  // enforces them in Postgres; a fix that relaxed those would be a wrong answer
  // in the other direction, so the negative above is paired with a positive.
  //
  // ⚠ AND THE TWO ARE NO LONGER SPELLED THE SAME WAY (2026-09-21). This read
  // `if (!<v>) return escalate("no-backend")` for both and went RED on the
  // `rules` rung's four-state fix — a guard pinned to a SPELLING reporting an
  // honest change as the feature going away, which is this repository's single
  // most repeated own-goal and is why the property is written out here instead.
  //
  // THE PROPERTY IS THE SAME FOR BOTH: the lane establishes a database before
  // it queries one, and does not proceed without it. What differs is how each
  // says so.
  //
  // ⚠ AND `data` ASKS THE FOUR-STATE RESOLVER TOO, SINCE 2026-09-23. Its
  // `if (!ddb) return escalate("no-backend")` read the fast reader's one null
  // for four facts — and in the container, where the KV cache is absent, an
  // `incomplete` site's real database read as none and the rewrite of every
  // page was bought to change a row. The property is unchanged: the lane
  // establishes a database before it queries one, and does not query without
  // it. What moved is the answer for a site with genuinely none — a hop to the
  // text rung, where the words then live — which is asserted beside it.
  const dataAt = b.indexOf('if (eLayer === "data")');
  assert.ok(dataAt > 0, "the data lane is gone or was renamed — this scan has no subject");
  const dataEnd = b.indexOf("runDataEdit({", dataAt);
  assert.ok(dataEnd > dataAt, "the data lane's closing landmark moved above its opening one");
  const dataLane = b.slice(dataAt, dataEnd);
  assert.match(dataLane, /siteBackendDetail\(env, ownerSlug\)/,
    "the data lane no longer resolves a database before querying one");
  assert.match(dataLane, /state === "unreadable"/,
    "the data lane no longer stops when the database cannot be reached");
  assert.match(dataLane, /if \(!dBack\.conn\) return escalate\("no-backend", \{ layer: "text" \}\)/,
    "the data lane no longer has an answer for a site that genuinely has no database");

  // `rules` ASKS THE FOUR-STATE RESOLVER. A truthiness test on one connection
  // could not tell an absent database from a REFERENCE that was missing, so it
  // refused sites whose database is real — run 12, 2 credits, nothing
  // published. The three properties, each of which the old one-liner held by
  // accident and this must hold on purpose:
  const rulesAt = b.indexOf('if (eLayer === "rules")');
  assert.ok(rulesAt > 0, "the rules lane is gone or was renamed — this scan has no subject");
  const rulesEnd = b.indexOf("runRulesEdit({", rulesAt);
  assert.ok(rulesEnd > rulesAt, "the rules lane's closing landmark moved above its opening one");
  const rulesLane = b.slice(rulesAt, rulesEnd);
  assert.match(rulesLane, /siteBackendDetail\(env, ownerSlug\)/,
    "the rules lane no longer resolves a database before querying one");
  assert.match(rulesLane, /state === "unreadable"/,
    "the rules lane no longer stops when the database cannot be reached");
  assert.match(rulesLane, /state === "none"/,
    "the rules lane no longer has an answer for a site that genuinely has no database");
});

test("a LAYOUT change is escalated, never silently stored", () => {
  // The container is handed theme, tokens and fonts — those really do change a
  // recompiled site. The AUTHORED PLAN is what the PAGES were written against
  // and the container never sees any of its six fields, so storing one here
  // would report success, change nothing a visitor can see, and leave the
  // stored look disagreeing with the pages it describes.
  const b = editBlock();
  const needs = b.indexOf("const needsPages");
  const write = b.indexOf("patchSiteConfig(env, ownerSlug, edb,");
  assert.ok(needs > 0 && write > 0, "the guard or the write is gone — this assertion cannot hold vacuously");
  assert.ok(needs < write, "the needs-pages check must run BEFORE the look is stored");
  assert.match(b, /needsPages\.length\) return escalate\("needs-pages"/);

  // EVERY PLAN KEY, NOT THE TWO THIS USED TO NAME — and this half was held by
  // NOTHING until a mutation said so. The filter read `k === "family" || k ===
  // "structure"`, correct while those were the only layout fields there were;
  // the plan replaced the family on 2026-08-20 and brought five more
  // (`purpose`, `shape`, `pages`, `action`, `components`), every one a
  // page-generation input and every one on `EDIT_FIELDS`. So a look edit moving
  // one would have been stored, reported as done, and never drawn. Reverting to
  // the two-name form passed the entire 3511-test suite.
  //
  // DRIVEN THROUGH THE REAL EXPRESSION rather than matched as text: a filter
  // that names the right things and compares them the wrong way round reads
  // identically in a source-read. The line is lifted out and run.
  const line = b.match(/const needsPages = moved\.filter\((\([\s\S]*?)\);/);
  assert.ok(line, "the needs-pages filter is gone or no longer a one-line filter");
  // eslint-disable-next-line no-eval
  const pred = eval("(" + line[1] + ")");
  for (const k of PLAN_KEYS) {
    assert.ok(pred(k), "a look edit moving `" + k + "` is stored and silently never drawn");
  }
  assert.ok(pred("family"), "a legacy family change stopped escalating");
  // …AND NOT EVERYTHING, or the filter would escalate every colour change to a
  // ~27-credit page rewrite and the cheap lane would be dead. These four are
  // exactly what the container DOES see.
  for (const k of ["theme", "fonts", "brand", "mode"]) {
    assert.ok(!pred(k), "`" + k + "` now buys a page rewrite, which the recompile could have done");
  }
});

// ── the client half, which is the other layer that goes silently dead ─────────

const CHAT = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

test("the server reads hasSite off the body, strictly", () => {
  // `=== true`, like firstBuild and attached beside it: nothing merely truthy
  // off a public body may open a write path over a published site.
  assert.match(WORKER, /hasSite: rb\.hasSite === true/,
    "the route ignores hasSite, so edit and addon are unreachable for everyone");
});

// ── the page layer: one page's source, one model call ────────────────────────

const { priorPagesBlock: pageBlock, pagesRequest: pageReq } = await import("../../../builder/page-gen.mjs");

const P_SITE = [
  { path: "src/routes/index.tsx", source: 'export default function Home(){return <p>Sharp Fade</p>;}' },
  { path: "src/routes/book.tsx", source: 'export default function Book(){return <p>Book a chair</p>;}' },
  { path: "src/routes/prices.tsx", source: 'export default function Prices(){return <p>From 20</p>;}' },
];

test("the page layer takes ONLY the page that was asked for", () => {
  // A page edit that returns a different file is not a page edit, and taking it
  // would let one instruction rewrite a page the customer never named. The
  // prompt says so; this is the half that cannot be talked out of it.
  const b = editBlock();
  // ⚠ `let`, NOT `const`, SINCE 2026-09-20 — and the declaration keyword is
  // not the property. The photograph guard rewrites `wrote` when it puts a
  // `src` back, so pinning the spelling reported this feature as gone on a
  // change that only made the binding assignable.
  assert.match(b, /\b(?:const|let) wrote = \(pValid\.pages \|\| \[\]\)\.find\(\(p\) => p\.path === target\.path\)/,
    "the handler does not pin the returned file to the target");
  assert.match(b, /ignored:/, "files the model returned uninvited must be reported, not silently dropped");
  // An unchanged page is not a publish: it would bill a recompile for a
  // byte-identical site.
  assert.match(b, /wrote\.source === target\.source/);
});

test("the page layer finds its file through routeOf, not a second mapping", () => {
  // Two path-to-route readers are two things that can disagree about what
  // src/routes/shop/index.tsx is called.
  const b = editBlock();
  assert.match(b, /eSrc\.find\(\(p\) => p && routeOf\(p\.path\) === wantRoute\)/);
  assert.ok(!/\.replace\(\/\^src\\\/routes\\\//.test(b), "the handler is rolling its own path mapping");
});

test("a page the site does not have is said, never climbed", () => {
  // ⚠ RE-WRITTEN 2026-09-23. This asserted `if (!target) return
  // escalate("no-page"` under the message "asking to change a page that does
  // not exist IS an addon" — and the escalate named NO layer, so the browser
  // answered it with the rewrite of every page, not the add-on step. A removal
  // of a page the site lacks is already true, a move has nothing to move, and
  // an edit aimed at one cannot say which real page was meant; each is a
  // sentence now, naming the page and listing the real ones. Driven through
  // the route in `test/edit-failure.test.mjs`.
  const b = editBlock();
  assert.ok(!/if \(!target\) return escalate\(/.test(b), "a missing page still climbs to the rewrite");
  assert.match(b, /if \(!target\) \{\s*return explain\("page\/no-page"/,
    "a missing page is no longer answered with a sentence");
});

// ── the data layer: the content the site STORES ──────────────────────────────
//
// The gap the audit found. A generated site keeps its menu and prices in a
// `display` table and renders them with useRows, so those words are NOT in the
// page source — "change the price of a haircut to £25" fell through edit, addon
// and build and came back ~25 credits later with the price unchanged.

const {
  DATA_TOOL, DATA_MODEL, MAX_DATA_ROWS: DROWS,
  dataDigest, dataRequest, readDataChanges, runDataEdit,
} = await import("../../../builder/site-apply.mjs");

const MENU = [{
  name: "services",
  columns: ["name", "price", "minutes"],
  rows: [
    { id: 1, name: "Haircut", price: "£22", minutes: 30 },
    { id: 2, name: "Beard trim", price: "£12", minutes: 15 },
  ],
}];
const dataReply = (changes, usage) => ({
  content: [{ type: "tool_use", name: "write_row_changes", input: { changes } }],
  usage: usage || { input_tokens: 400, output_tokens: 30 },
});

// ⚠ THESE TWO PINNED THE DEFECT until 2026-10-03 (the mixed-work fixes; the
// audit's MW4): they required the list to stop at `MAX_DATA_OPS` (20), which
// changed the first twenty rows of a longer list and dropped the rest without
// a word. Every change that names a row offered (or adds one) is read now;
// the one bound left is the answer itself, refused whole when it is cut off.
const LONG = [{
  name: "services",
  columns: ["name", "price"],
  rows: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: "Service " + (i + 1), price: "£" + (10 + i) })),
}];

test("the route reads only tables the PUBLIC can read and NOBODY can write", () => {
  // `display` only, and it is a boundary rather than a shortcut: a `collect`
  // table holds customers' bookings, and "cancel John's booking" is not a
  // sentence to hand a model.
  //
  // THIS GUARD PINNED THE BROKEN SPELLING and was green for the whole time the
  // layer was dead: it required `pair.read === "anyone"`, which is the bug —
  // "anyone" is a WRITE level, so the condition was false for every table on
  // every site and every data edit answered `no-data`. It asserts the PROPERTY
  // now, through the preset, which is the only form that cannot restate a
  // mistake as a requirement.
  const b = editBlock();
  assert.match(b, /pair\.read !== DISPLAY_PAIR\.read \|\| pair\.write !== DISPLAY_PAIR\.write/,
    "the data layer does not restrict itself to display tables");
  assert.match(b, /LIMIT " \+ MAX_DATA_ROWS/, "the row read is unbounded");
});

test("EVERY LAYER THE WORKER IMPLEMENTS IS ONE THE ROUTER CAN ASK FOR", () => {
  // THE OTHER DIRECTION, and it is the one that was missing. Every guard about
  // layers loops over `EDIT_LAYERS`, so DELETING a name from that list shrinks
  // what they check and the whole layer goes unreachable with the suite green —
  // measured: removing "rules" survived all 2153 tests. A derived check cannot
  // be derived from the thing being mutated.
  //
  // So this reads the branches the Worker really has and requires the router to
  // offer each one. A layer with a handler nobody can route to is dead code that
  // looks live from every angle, which this repo has now recorded ten times.
  const b = editBlock();
  const implemented = [...b.matchAll(/eLayer === "([a-z]+)"/g)].map((m) => m[1]);
  const uniq = [...new Set(implemented)];
  assert.ok(uniq.length >= 4, "the branch scan found almost nothing, so it is not scanning: " + JSON.stringify(uniq));
  for (const layer of uniq) {
    assert.ok(EDIT_LAYERS.includes(layer),
      "the worker implements the " + layer + " layer and the router cannot ask for it — it is unreachable");
  }
  // AND NO LAYER IS OFFERED WITH NOTHING BEHIND IT. `look` is the one handled by
  // falling through rather than by a named branch, so it is excused explicitly
  // rather than by loosening the rule for everything.
  for (const layer of EDIT_LAYERS) {
    if (layer === "look") continue;
    assert.ok(uniq.includes(layer),
      "the router can ask for the " + layer + " layer and the worker has no branch for it");
  }
});

test("the route deletes by bound parameter, and hands `was` back", () => {
  // The wiring layer. worker.js cannot be imported, so the SQL and the response
  // shape are read. The id is already checked against the offered rows, and the
  // statement still binds it — the table name is the only thing interpolated,
  // and it is scrubbed, exactly as the update and insert beside it.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /if \(c\.remove\) \{[\s\S]{0,200}?DELETE FROM \\"" \+ name \+ "\\" WHERE id = \?/,
    "the delete branch is missing or does not bind the id");
  assert.match(w, /removed: true, was: c\.was \|\| null/, "the deleted row's contents never reach the client");
});

test("the refusal no longer sends them somewhere else to delete", () => {
  // It used to read "I can change and add, but not delete", which stopped being
  // true. A message that describes a limit the code no longer has teaches the
  // customer not to ask again.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.equal(/I can change and add, but not delete/.test(w), false,
    "the refusal still claims the lane cannot delete");
  assert.match(w, /say which list it's in and I'll have another go/);
});

test("the text reply names what it now says", () => {
  // "Updated the wording in 3 places" is a number the customer cannot check —
  // the same silent-partial class as the two this lane already fixed, one notch
  // milder. The server has always returned the new strings; nothing read them.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /changed: out\.edits\.map\(\(e\) => e\.to\)/, "the server stopped returning the new wording");
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  const branch = chat.slice(chat.indexOf("function editReply("), chat.indexOf("if (e.layer === 'data')"));
  assert.ok(branch.length > 200, "the text branch of editReply moved");
  assert.match(branch, /e\.changed/, "the text reply never reads what the wording now says");
  assert.match(branch, /problemNote\(e\.problems\)/, "a lint problem on a text edit is shown to nobody");
});

test("the undo is wired end to end, not just built", () => {
  // Three layers, none importable, and this repo has recorded a feature dead at
  // exactly one of these seams nine times over.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // READ OFF THE BODY, CHECKED AGAINST THE ROWS AS THEY ARE NOW, AND ONLY WHAT
  // IS STILL GONE HANDED ON (2026-10-07, `freshRecent`).
  assert.match(w, /const dRecentIn = Array\.isArray\(eb && eb\.recent\) \? eb\.recent : null;/, "the route never reads it off the body");
  assert.match(w, /const dRecent = freshRecent\(dRecentIn, dTables, dWider\);/, "what the page offers is handed on unchecked");
  assert.match(w, /recent: dRecent\.kept\.length \? dRecent\.kept : null/, "the model is not handed the rows that are still gone");
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  const at = chat.indexOf("function siteEdit(");
  assert.ok(at > 0, "siteEdit is gone — the assertions below would pass vacuously");
  const body = chat.slice(at, chat.indexOf("\n}", at));
  assert.match(body, /recent:/, "the client never sends it");
  assert.match(body, /d\.layer === 'data'/, "it is sent on layers that could not act on it");
  // REMEMBERED ON A REMOVAL AND FORGOTTEN ON AN ADD. Carried forever, it is a
  // standing offer to re-add a row on an unrelated change.
  //
  // READ WHERE IT NOW LIVES. This was inside `siteEdit`, and on 2026-09-01 it
  // moved into `applyEditResult` — because the QUEUED path had its own success
  // tail that never carried it at all, so a queued `data` edit remembered no
  // undo and, worse, never CLEARED a stale one. Two copies of one decision,
  // which is why there is one now. The window follows it rather than requiring
  // it to stay where a passing test happened to find it.
  const aAt = chat.indexOf("function applyEditResult(");
  assert.ok(aAt > 0, "the shared applier is gone");
  const applier = chat.slice(aAt, chat.indexOf("\n}", aAt));
  // ONE KEEPER SINCE 2026-10-07 (`siteUndoKeep`), asked by the applier and by
  // a late first read of this page's own request — read where it lives.
  assert.match(applier, /siteUndoKeep\(s, e\);/, "the applier does not keep the undo offer");
  const kAt = chat.indexOf("function siteUndoKeep(");
  assert.ok(kAt > 0, "the undo keeper is gone");
  const keeper = chat.slice(kAt, chat.indexOf("\n}", kAt));
  assert.match(keeper, /s\.undoRows = gone/, "nothing remembers what went");
  assert.match(keeper, /s\.undoRows = null/, "the undo is never cleared, so it can fire twice");
  // AND BOTH PATHS REACH IT. A shared applier that only one caller uses is the
  // same drift wearing a better name.
  const users = (chat.match(/applyEditResult\(/g) || []).length;
  assert.equal(users, 2, `applyEditResult has ${users} mentions — one definition and one shared caller is the whole point`);
  // That the offer NAMES the row is asserted on the rendered output in "the
  // replies are DRIVEN, not grepped" — a source-read of the same fact would be a
  // second, weaker copy of it.
});

test("the look layer applies the rename and says how far it got", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*renamePages[^}]*\} from "\.\/builder\/site-apply\.mjs"/,
    "renamePages is called and never imported — a ReferenceError on the live path");
  // `eSrcOut` SINCE 2026-10-02 (the whole-router audit's W2): the pages as the
  // look step leaves them — with a removed QR code's figure already off — so a
  // rename beside that removal renames the pages that will be published.
  // AND THE COMPONENTS SINCE 2026-10-22 (A03-6): pages and parts as one list,
  // driven through the route in test/look-rename-parts.test.mjs.
  assert.match(w, /renamePages\(editableFiles\(eSrcOut, qrCut \? qrCut\.parts : eRenameParts\), priorLook\.brand, merged\.brand\)/, "the look layer never renames the pages");
  assert.match(w, /moved\.includes\("brand"\)/, "every look change would rewrite the pages");
  assert.match(w, /pages: eSrcOut/, "the renamed pages are computed and then not published");
  assert.match(w, /renamed, files: pub\.files/, "the client cannot tell a rename that landed from one that did not");
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /couldn’t find the old name written on any page/,
    "a rename that reached nothing reads as complete success");
});

// ── the picture slot ─────────────────────────────────────────────────────────

test("a photo slot nobody can fill is said out loud", async () => {
  const { countImageSlots } = await import("../../../builder/site-images.mjs");
  assert.equal(countImageSlots([{ path: "a", source: '<SafeImage src="@@IMG:a chair@@" />' }]), 1);
  assert.equal(countImageSlots([
    { path: "a", source: "@@IMG:one@@ @@IMG:two@@" },
    { path: "b", source: "no pictures here" },
  ]), 2);
  assert.equal(countImageSlots([]), 0);
  assert.equal(countImageSlots(null), 0);

  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // A TOKEN COUNT IS TAKEN BEFORE THE SWEEP, or there is nothing left to count
  // — `applyImages` removes every token, which is the whole point of it.
  //
  // ANCHORED ON THE ASSIGNMENT, NEVER ON ITS ARGUMENT LIST (re-anchored
  // 2026-09-12). This spelled `countImageSlots(pValid.pages)` and went red when
  // the count started reading the site's PARTS as well — reporting the count as
  // gone from a route that still makes it. The property here is the ORDER; what
  // the count is made over is a different property, and `test/image-parts` owns
  // it. Both anchors are asserted, because `indexOf` answering -1 is less than
  // anything and would pass this silently.
  //
  // ⚠ AND NOW NEITHER PATH COUNTS TOKENS — RE-ANCHORED TWICE, 2026-09-17 and
  // 2026-09-20, both times because the property MOVED rather than broke.
  //
  // The addon went first: it counted tokens on a step whose own directive
  // FORBIDS one, so it answered zero on every obedient run and `photoNote`
  // never fired there. The edit path's page rung followed today, for the same
  // reason and one more — its count also had to become MESSAGE-WIDE, because
  // two page rungs run for one sentence and a per-rung answer describes a
  // version a later rung may replace.
  //
  // SO `countImageSlots` HAS NO CALLER IN `worker.js` AT ALL, and asserting
  // that is what stops this guard rotting into a claim about a reader nobody
  // asks. The function itself is still exercised above — the build path is
  // where a token really is written — and the two comments that name it are
  // the record of the move, not consumers.
  //
  // ⚠ THE SCAN MUST NOT READ THOSE COMMENTS AS CALLS: *prose contains the
  // thing it forbids* is this repository's most repeated own-goal, and the
  // note above the import says `countImageSlots` in as many words.
  const code = w.replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));
  assert.ok(code.includes("newEmptySlots("), "the blanking ate the file — re-derive this scan");
  assert.equal((code.match(/\bcountImageSlots\s*\(/g) || []).length, 0,
    "worker.js counts `@@IMG:` tokens again, on a rung whose directive forbids them");
  // AND THE EDIT PATH'S REPLACEMENT IS THE MESSAGE-WIDE FRAME READER, asked
  // below the loop over the two ends that are really comparable: what the
  // message arrived to, and what the ONE publish ships.
  const at0 = code.indexOf("const was = imageSources(eSrcAt0, at0);");
  assert.ok(at0 > 0, "the edit path's message-wide picture BEFORE is gone");
  const win = code.slice(at0, code.indexOf("const merged = {", at0));
  // A SANITY BOUND ON A LANDMARK-TO-LANDMARK WINDOW, not a byte-sized window:
  // both ends are asserted above and below, and this only catches a closing
  // landmark that has moved somewhere unrelated. Raised 2026-09-20 when the
  // third reader joined the block.
  assert.ok(win.length > 0 && win.length < 1600, "re-derive this window: " + win.length + " bytes");
  assert.match(win, /picsFrames = newEmptySlots\(was, now\)/, "the edit path no longer counts the frames it left");
  assert.match(win, /keptImages\(was, now, ownerSlug\)/, "the edit path no longer reads what it lost");
  assert.match(win, /pendingPublish\.pages/, "the AFTER is not the one publication, so it can describe a version nobody ships");
  // AND THE THIRD READER (2026-09-20): what the protection HELD is read here
  // too, intersected with what really ships. A sum of the rungs' own counts
  // printed *"the 2 photographs are still there"* beside *"one photograph is
  // no longer on the site"* — two sentences about one publication, from two
  // different versions of it.
  assert.match(win, /ePhotosHeld/, "the protection's receipt is no longer read against the publication");
  assert.match(win, /picsKept = \[\.\.\.ePhotosHeld\]\.filter\(/,
    "the kept count is not an intersection, so a restoration a later rung undid still counts");
  assert.match(win, /photoUrls\(f && f\.source, ownerSlug\)/,
    "what the publication shows is no longer read with the site's own url reader");

  // ── AND THE ADDON'S HALF, WHICH IS THE OPPOSITE ORDER FOR THE OPPOSITE
  // REASON (2026-09-17) ──
  //
  // It counts EMPTY FRAMES, from what survives the merge, so it must run AFTER
  // the sweep: a token written against the ban becomes `src=""` there, and the
  // same reader then sees it. Three properties, each its own assertion, and
  // each one the shape of a real defect this round fixed:
  //
  //   · it runs after the sweep, or a swept token is invisible to it;
  //   · it reads `aMerge.pages` — what will be PUBLISHED — and never
  //     `aValid.pages`, the answer, which still holds pages the QR dependency
  //     withheld and the merge boundary refused;
  //   · both sides are `imageSources`, so a component the site already has has
  //     a BEFORE and an unchanged one reads as no new frame at all.
  const aAt = w.indexOf("const aSlots = newEmptySlots(");
  assert.ok(aAt > 0, "the addon's empty-frame count is gone");
  const sweepAt = w.indexOf("aValid.pages = applyImages");
  assert.ok(sweepAt > 0, "the addon sweep is gone — rescope this guard");
  assert.ok(sweepAt < aAt, "the addon counts frames before the sweep, where a token is not yet one");
  const mergeAt = w.indexOf("aMerge = mergeAddonPages(");
  assert.ok(mergeAt > 0 && mergeAt < aAt, "the addon counts frames before the merge decides what publishes");
  // ⚠ RE-ANCHORED 2026-09-19, NOT APPEASED: the pair was hoisted into two
  // named values when a SECOND counter started reading it, so pinning the
  // argument list was pinning a spelling. The property is what the two sides
  // ARE, so they are read where they are defined — and the property is now
  // strictly stronger, because BOTH counters have to take that same pair. Two
  // ideas of before-and-after is how a component reads as new to one reader
  // and not to the other.
  const wasAt = w.indexOf("const aPicsWas = ");
  const nowAt = w.indexOf("const aPicsNow = ");
  assert.ok(wasAt > 0 && nowAt > wasAt, "the addon's before/after pair is gone — rescope this guard");
  assert.ok(wasAt > sweepAt && wasAt > mergeAt, "the pair is taken before the sweep or before the merge");
  const pair = w.slice(wasAt, w.indexOf("\n", nowAt));
  assert.match(pair, /imageSources\(aSrc,/, "the BEFORE is pages only, so a component's own frames read as new");
  assert.match(pair, /imageSources\(aMerge\.pages,/, "the AFTER is the model's answer, not what really publishes");
  assert.doesNotMatch(pair, /aValid\.pages/, "the addon counts frames on pages the publish may never carry");
  assert.match(w, /const aSlots = newEmptySlots\(aPicsWas, aPicsNow\)/, "the slot count took its own reading of the site");
  // ⚠ RE-ANCHORED 2026-09-19 TWICE, AND THE SECOND TIME THE PROPERTY MOVED.
  // The reader answered `{n, atLeast}` — the number was a FLOOR, a runtime list
  // counting as at least one frame — and it answers `{n, more}`: `n` is the
  // frames really written out, `more` says a runtime list may draw some and how
  // many is not knowable from source. An empty mapped array draws NONE, so
  // "at least 1" was a claim about data nobody here can read. The anchor stays
  // the arguments and the destructure, because a second view of the site is how
  // the two counters come apart.
  assert.match(w, /newListFrames\(aPicsWas, aPicsNow\)/,
    "the list-frame count took its own reading of the site");
  assert.match(w, /\{ n: aListSlots, more: aListMore \} = newListFrames\(/,
    "the runtime flag never leaves the reader, so an exact count is claimed over a runtime list");
  assert.doesNotMatch(w, /atLeast/,
    "the floor reading is back: a runtime list counts as a frame nobody has seen");

  assert.match(w, /photos: aSlots/, "the addon answer never carries it");
  // …AND THE SECOND COUNT REACHES THE CUSTOMER TOO (2026-09-19). Run 51 said
  // "one photo space" over a page a browser measured at seven; the six it could
  // not see are a separate field with a separate sentence, because `photoNote`
  // offers to FILL a space and nothing can fill one of these.
  assert.match(w, /listPhotos: aListSlots/, "the addon answer never carries the list frames");
  assert.match(w, /listPhotosMore: aListMore/, "the addon answer never says a runtime list draws more");
  // ⚠ THE PAGE EDIT'S COUNT IS TWO READERS NOW — 2026-09-20, and the change
  // is the same correction the addon made in 2026-09-17, on the rung that was
  // left behind. `pSlots` counts `@@IMG:` TOKENS, and this rung's directive
  // FORBIDS a token, so on every obedient answer it was zero and `photoNote`
  // never fired: a customer left looking at a new empty frame had no way to
  // know it was theirs to fill. `newEmptySlots` is the frame counter.
  //
  // SUMMED RATHER THAN REPLACED, and the `||` is deliberate: the two count
  // different things, and a token that really WAS written survives into the
  // after side as `src=""` — `applyImages` sweeps it — so the frame counter
  // sees it and the token counter is the fallback for nothing else.
  // ⚠ RE-ANCHORED 2026-09-20. This pinned `photos: pNewSlots || pSlots` — a
  // SPELLING, and of an expression that has gone: the rung no longer answers
  // its own picture count at all, because two page rungs run for one sentence
  // and each one's comparison describes a version the next may replace. The
  // property is asserted above, on the message-wide pair; what belongs here is
  // that the rung does NOT answer it, so a per-rung reader cannot come back
  // and quietly win the merge's `Object.hasOwn` race.
  // ⚠ AND THE OPENING LANDMARK IS THE UNIQUE ONE. A first draft of this
  // anchored on `ok: true, layer: "page", page: wantRoute`, which occurs FOUR
  // times — the removal, the move, the tweak and the page write all answer at
  // that layer — so the window opened at the first and swallowed 39,919 bytes
  // of four other branches. Measured, not guessed: `orderingMoved` is called
  // once in the file and sits immediately above the reply this is about.
  const open = code.indexOf("const alsoOn = orderingMoved(");
  // CLOSING LANDMARK RE-ANCHORED 2026-09-23: the dispatch fall-through
  // explains now instead of escalating — same place, same job as an end.
  const close = code.indexOf('return explain("route/layer")', open);
  assert.ok(open > 0 && close > open, "the page rung's own reply is gone — re-derive these landmarks");
  const rung = code.slice(open, close);
  // RAISED 2026-10-22 (4,000 → 4,500): the reply gained `tweakFallback` (A03-5);
  // measured 4,185, same landmarks.
  assert.ok(rung.length > 500 && rung.length < 4500, "re-derive this window: " + rung.length + " bytes");
  // ⚠ AND `photosKept` JOINED THEM 2026-09-20, one sentence later than the
  // other two. What this rung DID is a fact about the rung; what the customer
  // is told — *"it is still there"* — is a claim about the PUBLICATION, and
  // an AUTHORISED picture rung further down the same message can take the
  // same photograph off. A sum of the rungs' own counts printed *"the 2
  // photographs are still there"* beside *"one photograph is no longer on the
  // site"*. So all three are the merge's, and what belongs here is that the
  // rung answers NONE of them — a per-rung reader would otherwise come back
  // and quietly win the merge's `Object.hasOwn` race.
  assert.ok(!/\bphotos:/.test(rung), "the page rung answers its own frame count again: " + rung.slice(0, 300));
  assert.ok(!/\bphotosRemoved:/.test(rung), "the page rung answers its own loss count again");
  assert.ok(!/\bphotosKept:/.test(rung), "the page rung answers its own kept count again");
  // AND IT STILL RECORDS WHAT IT HELD, into the message-wide set the merge
  // intersects — a protection that acted and told nobody is invisible to the
  // customer, which is the half this must not lose while dropping the field.
  assert.match(code, /for \(const u of pRestored\) ePhotosHeld\.add\(u\);/,
    "the page rung stopped recording what it put back, so the protection is invisible to the customer");
  // ⚠ AND THE PAIR IT IS MADE OVER IS NOW THE MESSAGE'S, asserted above on
  // `was`/`now` rather than on this rung's own `pPicsBefore`/`pPicsAfter`,
  // which are gone. Two readers over ONE pair is the property; where the pair
  // is computed moved, and pinning the old names would report the property as
  // gone on the change that made it true for the whole message.
  assert.ok(!/\bpPicsBefore\b/.test(code), "a per-rung picture BEFORE is back, so the two rungs disagree again");
  // AND BOTH SIDES ARE `imageSources`, so a component the site already has has
  // a BEFORE — two ideas of before-and-after is how an unchanged component
  // reads as a new frame to one reader and not the other. Asserted on the
  // message-wide pair, which is where this question is asked from today.
  assert.match(win, /imageSources\(eSrcAt0, at0\)/, "the page edit's BEFORE is not read through imageSources");
  assert.match(win, /imageSources\(pendingPublish\.pages, pendingPublish\.parts \|\| at0\)/,
    "the page edit's AFTER is not read through imageSources, so the components have no side");
  // ⚠ AND ITS TWIN IS GONE WITH IT. A third assertion here read
  // `const pPicsAfter = imageSources(pPages, …)` and carried the SAME message
  // string as the one above, so when it fired the failure named the wrong
  // line — *a failure that cannot name itself*, in a guard file. One
  // assertion per property, and one message per assertion.
  assert.ok(!/\bpPicsAfter\b/.test(code), "a per-rung picture AFTER is back, so the two rungs disagree again");
  // ⚠ AND THE AFTER IS THE **PUBLICATION**, never the writer's answer: a
  // component the parts wall refused is not part of what ships, so counting
  // its frames would report a change nobody made.
  //
  // RE-ANCHORED 2026-09-20, AND THE OLD FORM WAS VACUOUS THE MOMENT IT BROKE.
  // It read `indexOf("const pFreshParts") < indexOf("const pPicsAfter")` —
  // and `indexOf` answers **-1** for a name that is gone, so the comparison
  // became `<  -1`, false, which is the LUCKY direction this once: the same
  // shape with the operands the other way round passes silently for ever.
  // Prove both anchors exist, then compare.
  const loop = code.indexOf("for (const step of steps) {");
  assert.ok(loop > 0 && at0 > 0, "one of these landmarks is gone — re-derive them before comparing");
  assert.ok(loop < at0,
    "the picture outcomes are computed before the rungs have run, so they describe a site nobody published");

  // ── AND A PHOTOGRAPH THE EDIT LOST IS REPORTED, NEVER REFUSED ───────────
  //
  // ⚠ THE LINE BETWEEN THIS RUNG AND THE ADDON'S. There a lost photograph is
  // a 422 `lost-photos` at cost 0 — right for a step whose contract is *"an
  // addition is always a new thing"* — and applying that here would refuse
  // *"take the window photo off the front page"*, which is an ordinary edit.
  // So the change SHIPS and the customer is told: the `orderingMoved` /
  // `reordered` precedent, one field over in the same response.
  //
  // BOTH HALVES, because either alone is the failure: without the reader
  // nobody detects it, and without the reply nobody hears it.
  // RE-ANCHORED 2026-09-20 ONTO THE MESSAGE-WIDE PAIR. Both halves are the
  // same properties over the same readers; what moved is WHERE they are asked
  // from, and the reason is in the comment at the top of `win`.
  assert.match(win, /keptImages\(was, now, ownerSlug\)/, "the page edit does not detect a photograph it lost");
  assert.match(win, /picsRemoved = kept\.ok \? undefined : kept\.lost\.length/,
    "the loss is not reduced to a count, or it never leaves the comparison");
  assert.match(code, /photosRemoved: picsRemoved/,
    "the page edit's loss never reaches the reply, or it carries the urls rather than the count");
  // ⚠ AND IT IS **NOT** `lostPhotos`. That name is the addon's and carries a
  // LIST of urls on a 422 that published nothing — `scripts/addon-sweep.mjs`
  // reads it with `Array.isArray`. `Number([…])` is NaN, so one name over two
  // shapes would make the browser's clause silently never fire.
  assert.ok(!/lostPhotos: picsRemoved/.test(code), "the edit rung reuses the addon's field name for a different shape");
  // AND IT DOES NOT BORROW THE ADDON'S REFUSAL. ⚠ RE-WORDED 2026-09-20: this
  // rung DOES refuse now, under its own name (`withheld`, 409, cost 0) and
  // for a narrower reason — a loss the protection could not put back safely.
  // What must never appear here is `lost-photos`, the ADDON's 422, whose
  // contract is *"an addition is always a new thing"* and which would refuse
  // an authorised removal. Asserted against that error name, so a copy-paste
  // of the addon's refusal into this branch fails here rather than in front
  // of a customer. The `withheld` branch's own behaviour is driven end to end
  // in `test/edit-page-protect.test.mjs`, including that it does NOT fire on
  // a removal the picture rung made.
  //
  // ⚠ SCANNED OVER BLANKED COMMENTS. The rung's own note EXPLAINS why it does
  // not refuse and names the refusal while doing so — "prose contains the
  // thing it forbids", caught by this assertion on the day both were written.
  // ⚠ AND THE CLOSING LANDMARK IS CODE AND IS **AFTER** THE OPENING ONE. The
  // first draft closed on `if (eLayer === "look")`, which sits ABOVE the page
  // rung in this file — so `indexOf(…, from)` answered -1 and `slice(a, -1)`
  // swallowed the rest of the file, including the addon's real refusal. Both
  // halves of this repository's own recorded window trap, in one line.
  const blank = w.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const pFrom = blank.indexOf('if (eLayer === "page") {');
  assert.ok(pFrom > 0, "the page rung is gone");
  // RE-ANCHORED 2026-09-23: the fall-through below the page rung explains now.
  const pTo = blank.indexOf('return explain("route/layer");', pFrom);
  assert.ok(pTo > pFrom, "the page rung's next sibling moved — re-derive the closing landmark");
  const pRung = blank.slice(pFrom, pTo);
  assert.ok(pRung.length > 2000 && pRung.length < 40000, "re-derive the page rung window: " + pRung.length);
  assert.ok(!/lost-photos/.test(pRung),
    "the page edit rung refuses a lost photograph, so an authorised removal cannot publish");
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /function photoNote\(/);
  assert.equal((chat.match(/function photoNote\(/g) || []).length, 1, "two copies drift into one lane saying it");
  assert.match(chat, /photoNote\(a\.photos\)/, "the addon reply is silent about an empty frame");
  assert.match(chat, /listPhotoNote\(a\.listPhotos, a\.listPhotosMore\)/,
    "the addon reply is silent about a frame nothing can fill, or claims an exact count over a runtime list");
  assert.equal((chat.match(/function listPhotoNote\(/g) || []).length, 1, "two copies drift into one lane saying it");
  assert.match(chat, /photoNote\(e\.photos\)/, "the page edit is silent about an empty frame");
});

test("the data layer's gate is the display PRESET, not a spelling of it", async () => {
  // MEASURED LIVE: every data edit answered `no-data`. The gate read
  // `pair.read === "anyone"` — and "anyone" is a WRITE level; the read levels are
  // ["none","own","members","public"]. So it was false for every table on every
  // site, and the cheapest lane on the platform could never find a row.
  const { resolveAccess, ACCESS_PRESETS, READ_LEVELS, WRITE_LEVELS } = await import("../../../site-access.mjs");
  // The fact that broke it, pinned: the two vocabularies are DIFFERENT, and a
  // word from one is not a word from the other.
  assert.equal(READ_LEVELS.includes("anyone"), false, "`anyone` is not a read level");
  assert.equal(WRITE_LEVELS.includes("anyone"), true);
  assert.deepEqual(resolveAccess({ name: "s", access: "display" }), ACCESS_PRESETS.display,
    "a display table no longer resolves to the display preset");

  // The gate itself is asserted where it lives, one test above. What is added
  // here is the fact that made it wrong: the two vocabularies are different, and
  // the comparison must name the preset rather than spell a level.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /const DISPLAY_PAIR = ACCESS_PRESETS\.display;/,
    "the gate is not derived from the preset, so it can drift from the vocabulary again");
  assert.equal(/pair\.read === "(?:anyone|public)"/.test(w), false,
    "the gate spells a level out again instead of naming the preset");
});

test("A FAILED LOOK COMPILE PUTS THE STORED LOOK BACK", () => {
  // "Your site is untouched" was true of the PUBLISHED site and false of the
  // stored state. The look is written to `_meta` before the recompile because
  // `recompileAndPublish` reads it from there — and so does every other publish
  // path, so a failed compile left the change waiting for the customer's next
  // unrelated edit to apply it silently, under a version label naming only the
  // typo they were fixing.
  //
  // The worst shape is a rename: the rewritten pages are discarded with the
  // failed build while the stored brand is new, so the next publish gives the
  // tab and the link preview one name and every heading another — the exact
  // disagreement `renamePages` exists to prevent, arriving through the failure
  // path.
  // SCOPED TO THE LOOK LANE. The first `error: "compile"` in the edit block
  // belongs to the TEXT layer, so an unscoped window asserts about the wrong
  // branch and passes or fails for reasons unrelated to the look.
  const b = editBlock();
  const from = b.indexOf('if (eLayer === "look") {');
  assert.ok(from > 0, "the look lane moved — rescope this");
  // 2026-10-16: the look lane's answer keeps an overlap's own code (`lostOr`).
  const firsts = [b.indexOf('error: lostOr(', from), b.indexOf('error: "compile"', from)].filter((i) => i > from);
  const at = firsts.length ? Math.min(...firsts) : -1;
  assert.ok(at > from, "the look lane has no compile-failure branch");
  const before = b.slice(from, at);
  assert.match(before, /patchSiteConfig\(env, ownerSlug, edb,\s*\n\s*cssMoved \? \{ look: priorLook, css: priorCss \} : \{ look: priorLook \}, jobFence\(env, eJob\)\)/,
    "a failed look compile no longer restores the stored look");
  // AND EVERY FIELD IT MOVED WITH IT. They are separate config fields precisely
  // so a colour change cannot lose a logo, which means a rollback that puts only
  // the look back leaves the stylesheet moved.
  //
  // ASSERTED AS A PROPERTY, NOT A SPELLING. This pinned the exact key list and
  // went red the moment a THIRD one was rolled back with them — a test about
  // word order, which is this repo's most repeated own-goal. What has to hold is
  // that every field the look lane WRITES is also one it puts back, derived from
  // the lane itself so a fourth is covered without anybody remembering this file.
  //
  // DERIVED OFF `patchSiteConfig` SINCE THE MOVE TO R2. The lane's writes were
  // one `INSERT` per key and are now one call per outcome, so the scan reads the
  // PATCH OBJECTS: whatever the write names, the restore has to name too.
  const patches = [...b.slice(from).matchAll(/patchSiteConfig\(env, ownerSlug, edb,\s*\n?\s*([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(patches.length >= 2, "the look lane's writes are no longer visible to this scan — expected a write and a restore");
  const written = new Set();
  for (const p of patches) for (const m of p.matchAll(/\b(look|css|logo|icon|verify|langStrings):/g)) written.add(m[1]);
  // A FLOOR OF TWO, AND IT WAS FOUR KEYS. `site_tokens`, `site_page_tokens`,
  // `site_page_fonts` and `site_style` were written by this lane until
  // 2026-08-24; the look is the stylesheet now, so the look and the sheet are
  // all that is left. The floor stays because a scan that stops matching reports
  // a lane with nothing to roll back and passes vacuously.
  assert.ok(written.size >= 2, "only " + written.size + " look-lane fields found — the scan stopped matching");
  const rollFrom = before.indexOf("restored = true");
  assert.ok(rollFrom > 0, "the look lane's rollback moved — rescope this");
  const rolled = before.slice(rollFrom);
  for (const k of written) {
    assert.ok(rolled.includes(k + ":"),
      "the look lane writes `" + k + "` and a failed compile does not put it back");
  }
  // ABSENT MUST NOT READ AS PRESENT, and the MECHANISM changed while the
  // property did not. The four JSON patch keys were DELETED on rollback rather
  // than written as `{}`, or a site that had no tokens gained a row that later
  // read as "a patch exists". The stylesheet needs no delete because an empty
  // sheet is not a look: `readCss("")` answers unusable, so a rollback that puts
  // `priorCss` back as `""` leaves a value nothing acts on. Driven through the
  // real function rather than asserted about the store, because that is where
  // the property now lives.
  assert.equal(readCss("").usable, false, "an empty stored stylesheet reads as a look");
  assert.equal(readCss(null).usable, false, "an absent stored stylesheet reads as a look");
});

test("…and says so honestly when the rollback ITSELF fails", () => {
  // A restore that failed leaves the state exactly where the bug used to leave
  // it, and repeating "your site is untouched" is the one answer that makes it
  // undiagnosable when it lands on the customer's next edit.
  const b = editBlock();
  assert.match(b, /restored = false/, "a failed rollback is not recorded");
  assert.match(b, /msg: compileMsg\(pub, restored/,
    "the message does not depend on whether the rollback worked");
  assert.match(b, /the new look is saved/,
    "a failed rollback still tells the customer their stored look is untouched");
});
