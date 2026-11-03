// PARKED (2026-11-03, park-old-way): the old-way half of test/site-addon.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The addon lane's merge.
//
// The two failures this file is written around are both silent. A merge that
// drops pages publishes a site consisting of the new page alone; a merge that
// reports pages as "changed" when they came back byte-identical sends the owner
// looking for damage that is not there.
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  MAX_RETURNED, mergeAddonPages, mergeAddonSchema, ADDON_TABLE_FIELDS, ADDON_SPEC_FIELDS,
  unlinkedPages, routeOf, addonReply, keptReply, rowLists, orderingMoved } from "../../../builder/site-addon.mjs";
import { priorPagesBlock, pagesRequest, pagesPrompt, validatePages, SITE_PAGES_TOOL, MAX_PAGE_CHARS, MAX_PRIOR_CHARS } from "../../../builder/page-gen.mjs";
import { EDIT_RULE } from "../../../builder/site-edit.mjs";
// THE ADD STEP'S OWN RULE (2026-09-02) — the addon no longer reads EDIT_RULE.
import { addRule } from "../../../builder/site-add.mjs";
// THE PICTURE SENTENCE'S OWN COMPOSER (2026-09-17) — the browser prints what
// the server said, so the fixture below is that composer's output rather than
// a second copy of it typed here.
import { imageNote } from "../../../builder/site-images.mjs";
// THE ONE DEFINITION of what the browser's reply composer needs in scope. See
// the re-anchor note in the driven-reply case below.
import { BROWSER_FNS } from "../../../scripts/addon-sweep.mjs";

const page = (path, source) => ({ path: "src/routes/" + path, source });
const SITE = [
  page("index.tsx", 'const CHROME = { links: [{ label: "Book", href: "/book" }] };\nexport default function Home(){return <p>Sharp Fade</p>;}'),
  page("book.tsx", 'export default function Book(){return <p>Book a chair</p>;}'),
  page("prices.tsx", 'export default function Prices(){return <p>From 20</p>;}'),
];

// ── the wiring, at both ends ─────────────────────────────────────────────────

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function addonBlock() {
  const from = WORKER.indexOf("\n          if (ad) {");
  assert.ok(from > 0, "the addon handler is gone — every assertion below would pass vacuously");
  const to = WORKER.indexOf("\n          if (tx) {", from);
  assert.ok(to > from, "could not find the end of the addon handler");
  return WORKER.slice(from, to);
}

test("the addon route exists, is dispatched, and reaches the module", () => {
  assert.match(WORKER, /const ad = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/[^\n]*\\\/addon\$/,
    "no /api/site/<slug>/addon matcher");
  // RE-ANCHORED 2026-09-03: this pinned `om || mm ||` — the first TWO names of
  // the list — and went red the day the CSV-import matcher (`im`) was put
  // between them. The property is that the one dispatch condition (the `if`
  // whose expression opens with `om ||`) names `ad`; the order of the others
  // is not this guard's business.
  const gate = WORKER.match(/if \(om \|\|[^)]*\) \{/g) || [];
  assert.ok(gate.length && gate.every((g) => g.includes("|| ad")), "the addon matcher is not dispatched");
  const owner = WORKER.match(/const ownerSlug = \(([^)]*)\)\[1\]/);
  assert.ok(owner && owner[1].split("||").map((s) => s.trim()).includes("ad"),
    "the addon matcher is not in the ownerSlug list");
  const b = addonBlock();
  assert.match(b, /mergeAddonPages\(/, "the merge is not wired");
  assert.match(b, /unlinkedPages\(/, "reachability is computed nowhere");
  assert.match(b, /assertOwner\(/, "the addon lane is not ownership-gated");
  // RE-ANCHORED 2026-10-11: `aWriterSrc`, the pages or a prepared part's scope.
  // RE-ANCHORED 2026-09-03: the call was `…, aSrc, "addon")` and now carries
  // the job's clock after the mode (`"addon", undefined, aJob && aJob.budget`),
  // so `"addon")` no longer closes it. The property is the MODE argument:
  // addon mode is what makes the model return only what it touched.
  assert.match(b, /generateSitePages\(env, briefWithLayout\(\{[\s\S]*?\}\), aSpec, [^\n]*?, aWriterSrc, "addon"[,)]/,
    "generateSitePages is not called in addon mode — it would re-emit every page");
});

test("the addon lane provisions ONLY on first touch of the backend, and charges only after the work lands", () => {
  const raw = addonBlock();
  const b = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(b.length, raw.length, "blanking must preserve offsets");
  // RE-ANCHORED 2026-09-03. This held `!b.includes("ensureSiteBackend")` —
  // "the site already has a database; provisioning here would be a second
  // path that can create a Neon project". The owner's call moved the whole
  // backend onto this step ("if customer touches it then neon db is created"),
  // so the lane DOES provision now — through the build route's own call, the
  // one path that claims the slug atomically and drops an orphaned project —
  // and the property that survives is the narrow one: ONLY when a backend
  // tier was designed AND the site has no database. One call, under exactly
  // that guard, and nothing on the page-only path reaches it.
  const provs = [...b.matchAll(/ensureSiteBackend\(/g)];
  assert.equal(provs.length, 1, "the addon lane provisions in " + provs.length + " places — one path that can create a Neon project");
  const prov = provs[0].index;
  const tier = b.lastIndexOf("if (aBackend.length) {", prov);
  const guard = b.lastIndexOf("if (!adb) {", prov);
  assert.ok(tier > 0 && guard > tier, "the provision is not under `no backend tier designed → no database → make one`");
  assert.ok(!/\n\s*\}\s*\n[\s\S]*\bif \(/.test(b.slice(guard, prov).replace(/if \(aGateProv && !aGateProv\.go\)[^\n]*/, "")), "something between the no-database guard and the provision closes it");
  assert.match(b.slice(prov, prov + 200), /ensureSiteBackend\(env, ownerSlug, ou\.id, aInstruction,/, "the provision is not for THIS site by ITS owner");
  // MONEY: one place it leaves the ledger (`aCharge`), the synchronous
  // page-path charge after the publish, the pageless charge after the
  // schema apply — never before the work that earns it.
  assert.equal((b.match(/collectCredits\(/g) || []).length, 1, "one place money leaves the ledger");
  // RE-ANCHORED 2026-09-04: `aCharge` took the ledger sequence as a second
  // parameter (the repair round's spend is reserve #2) and the synchronous
  // collect bills the same usages PLUS that round's, so neither spelling
  // stands; the properties — one closure, the collect after the publish —
  // do.
  const charge = b.indexOf("const aCharge = async (bill");
  assert.ok(charge > 0 && b.indexOf("collectCredits(", charge) < b.indexOf("};", charge), "the ledger call is not inside aCharge");
  const pub = b.indexOf("recompileAndPublish(");
  const sync = b.indexOf("if (!aJob) aCost = await aCharge(");
  assert.ok(pub > 0 && sync > pub, "the synchronous charge does not come after the publish");
  // RE-ANCHORED 2026-09-05 (stage 8): the apply is a closure the pageless path
  // runs itself (`await aApplyBackend(null)`) before it bills — "after the
  // schema apply" is the order INSIDE the pageless block now, not a position
  // of the apply's text, which lives in the closure above it.
  const closure = b.indexOf("aApplyBackend = async (version) => {");
  const pageless = b.indexOf("if (pageless(aAnswers)) {");
  assert.ok(closure > 0 && pageless > closure && pageless < pub, "the pageless answer is not after the apply closure and before the publish");
  const pl = b.slice(pageless, b.indexOf("\n            }\n", pageless));
  const directApply = pl.indexOf("await aApplyBackend(null)");
  const plCharge = pl.search(/await aCharge\(pageCredits\(\.\.\.aDesignUsage, aSeedUsage\)\)/);
  assert.ok(directApply > 0 && plCharge > directApply, "the pageless answer does not apply the schema before it bills the small calls through the one charge");
});

test("a failed compile preserves the live site, and unusable output stops", () => {
  const b = addonBlock();
  assert.match(b, /site is untouched/, "a failed compile must promise the live site survived");
  // RE-ANCHORED 2026-10-06: the stop is the same failure, said through the
  // route's failure door (`aFail`), which adds what it left behind.
  assert.match(b, /if \(!aMerge\.ok\) return aFail\(addonFailure\(aMerge\.reason/,
    "nothing usable back must stop rather than report success");
  // COMMENTS BLANKED FIRST. The first version of this loop listed
  // "no-backend" and kept passing after that refusal was deleted, because the
  // comment explaining the deletion quotes it — prose contains the thing it
  // forbids, the recorded trap, caught here on 2026-09-02.
  const code = b.replace(/^\s*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length));
  for (const reason of ["empty", "unconfigured", "no-meta"]) {
    assert.ok(code.includes('aFailure("' + reason + '"'), "no stop path for: " + reason);
  }
  // A SITE WITHOUT A DATABASE IS ADDED TO, NOT REFUSED (owner, 2026-09-02:
  // "add will always go in addon" — and a first build provisions none, so
  // that refusal sent every "add a QR code" on most of the platform to a
  // rebuild). The connection is read only under a guard, the spec is an
  // honest empty one, and a designed table on such a site is a named 422
  // rather than a climb.
  assert.ok(!code.includes('aFailure("no-backend"'), "the addon still refuses a site with no database");
  // RE-ANCHORED, NOT APPEASED (2026-09-15). The schema read was inline here as
  // `SELECT v FROM _meta WHERE k = 'schema'` and is now `readStoredSpec`, which
  // exists because that one query had THREE outcomes collapsed into a spec or a
  // throw: a stored spec, a read that succeeded and found nothing (a database
  // provisioned and never applied to — honestly empty), and a read that FAILED
  // (the schema is unknown and the step must stop). The property this line has
  // always been about is that the addon reads the site's schema at all, and that
  // it only does so when there is a database to read it from.
  // RE-ANCHORED AGAIN (2026-09-15, the same day): `readStoredSpec` is now
  // wrapped by `specForAddon`, which adds the half that was missing — the
  // catalog is asked, so "nothing stored" can no longer be read as "no tables",
  // and a spec missing a live table is RECOVERED or the step STOPS. The
  // property is unchanged and is what is asserted: the addon reads the site's
  // schema, and only where there is a database to read it from.
  const meta = code.indexOf("const stored = await specForAddon(adb);");
  assert.ok(meta > 0, "the addon no longer reads the site's schema");
  assert.match(code.slice(code.lastIndexOf("if (adb)", meta), meta), /^if \(adb\)/, "the schema read is not gated on there being a database");
  // AND THE EMPTY SPEC IS KEYED ON THE ONE STATE IN WHICH IT IS TRUE.
  //
  // This was `aSpec = adb ? null : { tables: [] }` — the run-47 defect in one
  // expression. A falsy `adb` meant BOTH "frontend-only site" and "the
  // reference is incomplete", and the second is a site with tables. The empty
  // spec now comes from the state, which separates them.
  assert.ok(!/aSpec = adb \? null : \{ tables: \[\] \}/.test(code),
    "the empty spec is keyed on the connection again, which cannot tell a frontend-only site from an incomplete reference");
  assert.match(code, /if \(aBack\.state === "none"\) aSpec = \{ tables: \[\] \};/,
    "a site with no database is not given an honest empty spec");
  // A READ THAT COULD NOT TELL STOPS THE STEP rather than becoming an empty one.
  //
  // RE-ANCHORED 2026-09-15: this was pinned to the whole expression
  // `throw new Error("schema read: " + stored.why);` and went red on an honest
  // addition — the message now names the tables it could not recover. That is
  // the recorded "assert the property, not the spelling", in the guard for the
  // one branch that decides whether a paid step designs against a schema it
  // could not resolve. The PROPERTY is the refusal and the reason on it.
  assert.match(code, /if \(!stored\.ok\) throw new Error\("schema read: " \+ stored\.why/,
    "a schema read that failed no longer stops the step");
  // RE-ANCHORED 2026-09-03: this held that a designed table on a site with
  // no database was refused by name (`no-database`) before any schema work.
  // The owner moved the backend onto this step and a site gets its database
  // on first touch, so the refusal is GONE — both copies — and what sits
  // where it sat is the provision: after the fold, before the schema work,
  // under the same `!adb`.
  assert.ok(!code.includes('error: "no-database"'), "the addon still refuses a table for want of a database — the first backend tier makes one now");
  const tiers = code.indexOf("const aBackend = backendDesigned(aDesigned);");
  // RE-ANCHORED 2026-10-16: started there, beside the page writer, settled after it.
  // RE-ANCHORED 2026-10-23: the provision is built here (`aProvRun`) and, on the page path, run at the seam after a successful compile.
  const prov = code.indexOf("const aProvRun = () => ensureSiteBackend(", tiers);
  const schema = code.indexOf("mergeAddonSchema(", tiers);
  assert.ok(tiers > 0 && prov > tiers && schema > prov, "the database is not made between the fold and the schema work");
  assert.match(code.slice(prov, schema), /aSpec = \{ tables: \[\] \};/, "a database just made is not described as storing nothing");
});

test("neither lane can publish an unbought image token", async () => {
  // FOUND BY AUDIT, and it is a bug this repo has shipped once already. Neither
  // lane buys photographs, and `site-images.mjs`'s own comment says what happens
  // without a stated zero: "a model with no instruction writes image tokens
  // anyway". An unbought token publishes as the literal text `@@IMG:a barber
  // chair@@` — a broken image AND a visible leak of how the site was made.
  //
  // BOTH HALVES, because either alone is the failure. The directive is what
  // should stop one being written; the sweep is what stops one reaching a
  // customer if it is written regardless.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const block = (open, close) => {
    const from = worker.indexOf(open);
    assert.ok(from > 0, "block is gone: " + open.trim());
    const to = worker.indexOf(close, from);
    assert.ok(to > from, "could not find the end of " + open.trim());
    return worker.slice(from, to);
  };
  for (const [name, b] of [
    ["addon", block("\n          if (ad) {", "\n          if (tx) {")],
    ["page edit", block("\n            if (eLayer === \"page\") {", "\n            // A LAYER NOBODY IMPLEMENTS")],
  ]) {
    // THE STATED ZERO SITS IN THE SAME CALL AS THE BRIEF. The page rung's call
    // grew (2026-09-02) to carry the stored tsx/marks/scene beside the brief,
    // and the addon's grew the same day to carry the designed addition and its
    // component manifest — so this is pinned neither to the call's close nor
    // to `images: 0` being the second key: what must be true is that the
    // brief is the first thing said and `images: 0` is said in the same call.
    const callAt = b.indexOf("briefWithLayout({");
    assert.ok(callAt > 0, name + " no longer composes its brief through briefWithLayout");
    const call = b.slice(callAt, b.indexOf("})", callAt));
    assert.match(call, /^briefWithLayout\(\{\s*brief: \w+/, name + " does not lead the call with the brief");
    // A ZERO BUDGET, IN WHATEVER SPELLING — re-anchored 2026-09-17, not
    // appeased. This was `/\bimages: 0\b/`, and the addon's zero is now stated
    // as `{ buy: 0, … }` so that the sentence can say what the SITE has
    // separately from what the CHANGE buys — the bare zero was rendered as
    // *"PHOTOGRAPHS: none on this site"*, false on every site that has any.
    // The budget did not move and must not; the spelling did. This guard's own
    // note already records being re-anchored twice for exactly this reason.
    // ── RE-ANCHORED 2026-09-17: THE ADDON BUYS NOW, AND THE PROPERTY STANDS ──
    //
    // The property was never "neither lane buys"; it is that an UNBOUGHT token
    // never publishes. The page rung still buys nothing and states the bare
    // zero. The addon states the zero on every run that buys nothing and hands
    // over the SHOT LIST when it does — so what has to be true of its call is
    // that it is one or the other and never silence, which is what makes a
    // model write tokens of its own.
    //
    // ── RE-ANCHORED AGAIN 2026-09-17 (the third time, and the last two were
    //    for this same reason) — THE PROPERTY, NOT THE SPELLING ──────────────
    //
    // It pinned `images: <x>.length ? <y> : { … buy: 0 }`, which was the shape
    // of a call that chose between the bare LIST (the build path's door, which
    // carries no inventory) and an object. The addon sends ONE object now, so
    // that ternary is gone and the guard went red on a correction it is not
    // about: the paid form's own tail told the writer *"any other picture stays
    // a <SafeImage> with no src"* on sites that already had photographs, and
    // fixing that meant the inventory had to ride the buying call too.
    //
    // WHAT MUST BE TRUE IS WHAT IT ALWAYS MEANT: the addon says something about
    // photographs on every run — a list to buy or a declared zero — because
    // SILENCE is what makes a model write tokens of its own, and a token
    // nothing bought publishes as its own alt text. Asserted as the two keys
    // that carry it rather than as an expression shape, so the next honest
    // restructuring of this call does not report the property as gone.
    // ⚠ BOTH LANES STATE THE ZERO AS AN OBJECT NOW — re-anchored 2026-09-20,
    // and this is the FOURTH time for the same reason the note above gives
    // twice. The page rung's `images: 0` was the BARE form, which
    // `imageDirective` renders as *"PHOTOGRAPHS: none on this site"* — false
    // on every site that has any, and its last two clauses are an instruction
    // to STRIP them. Reproduced through the real route on a site showing two
    // that asked in as many words to keep them: both came back with an empty
    // `src`. The budget did not move and must not; what moved is that the zero
    // is stated as OURS and the inventory is READ.
    //
    // SO THE PROPERTY IS ONE FOR BOTH: the call says something about
    // photographs, and what it says about the SITE is read rather than assumed.
    const at = call.indexOf("images: {");
    assert.ok(at > 0, name + " no longer states anything about photographs in its page call");
    const images = call.slice(at, call.indexOf("},", at));
    assert.match(images, /\bshown: /, name + "'s page call does not say what the site already shows");
    if (name === "addon") {
      assert.match(images, /\bbuy: /, "the addon's page call does not say what it is buying");
    } else {
      // AND THE PAGE RUNG STILL BUYS NOTHING. `buy` absent is the zero — the
      // object form's own door — so asserting its ABSENCE is asserting the
      // budget, which is the half that must never move.
      assert.ok(!/\bbuy: /.test(images), "the page edit rung has started buying photographs: " + images);
    }
    assert.match(b, /applyImages\(\w+\.pages, \{\}\)/,
      name + " does not sweep an unbought token before publishing");
  }

  // ── AND THE ADDON'S SWEEP IS TWO SWEEPS, NEITHER OF WHICH MAY GO ─────────
  //
  // The belt above runs only when nothing is being bought (`if (!aShots.length)`),
  // because it was stripping the very tokens the purchase is for — measured
  // through the real route, `plan.shots` came back 0 on a run whose writer had
  // written the token exactly as asked. On the buying branch the sweep is
  // `buySitePhotos`, which ALWAYS sweeps including every path where it buys
  // nothing. Both are asserted, because a change that dropped either would
  // publish a literal `@@IMG:…@@` for one half of the cases and pass on the
  // other.
  const ad = block("\n          if (ad) {", "\n          if (tx) {");
  assert.match(ad, /if \(!aShots\.length\) \{\s*\n\s*aValid\.pages = applyImages\(aValid\.pages, \{\}\);/,
    "the addon's belt no longer waits for the branch that buys, or no longer runs on the branch that does not");
  assert.match(ad, /aPhotos = await buySitePhotos\(env, \{/, "the addon's buying branch does not reach the one function that sweeps");
  assert.match(ad, /aMerge = \{ \.\.\.aMerge, pages: aPhotos\.pages \}/,
    "the addon buys and publishes the UNSWEPT pages, so a token it could not buy ships as text");

  // AND THE DIRECTIVE REALLY FORBIDS THE TOKEN IN BOTH SPELLINGS, driven
  // rather than read: a source match on `images: { buy: 0` proves a shape was
  // passed and says nothing about what the model is then told. The whole point
  // of this guard is the sentence, so the sentence is what gets asserted.
  const { imageDirective } = await import("../../../builder/site-images.mjs");
  for (const [label, value] of [
    ["the bare zero", 0],
    ["the addon's own zero", { buy: 0, shown: { known: true, count: 2 }, place: true }],
    ["…and on a site we could not read", { buy: 0, shown: { known: false, count: 0 }, place: false }],
  ]) assert.match(imageDirective(value), /do not write any @@IMG:@@ token/i,
    label + " stopped telling the model not to write one");

  // And the sweep really does clear one, so the assertion above is not just
  // matching a call that does nothing.
  const { applyImages } = await import("../../../builder/site-images.mjs");
  const swept = applyImages([{ path: "a.tsx", source: '<SafeImage src="@@IMG:a chair@@" alt="x" />' }], {});
  assert.ok(!swept[0].source.includes("@@IMG"), "the sweep does not clear an unbought token");
});

test("both generating lanes LINT, and both show what it found", async () => {
  // THE BIGGEST GAP THE AUDIT FOUND. `lintPages` ran only inside the build path,
  // so the addon lane and the page-edit layer published without ANY of it: a
  // table the schema never declared, a `collect` table being listed, a component
  // that does not exist, an invented prop, a `#/` link, a demo chart full of a
  // stranger's invented numbers — and the literal colour that makes the look
  // layer silently do nothing. Measured on one page carrying four of them: the
  // build path reports four problems and both lanes reported none.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(worker, /^import .*\blintPages\b/m, "worker.js does not import the lint");
  const block = (open, close) => {
    const from = worker.indexOf(open);
    assert.ok(from > 0, "block is gone: " + open.trim());
    const to = worker.indexOf(close, from);
    assert.ok(to > from, "could not find the end of " + open.trim());
    return worker.slice(from, to);
  };
  for (const [name, b] of [
    ["addon", block("\n          if (ad) {", "\n          if (tx) {")],
    ["page edit", block("\n            if (eLayer === \"page\") {", "\n            // A LAYER NOBODY IMPLEMENTS")],
  ]) {
    assert.match(b, /lintPages\(\w+\.pages, \w+\)/, name + " publishes a generated page without linting it");
    // Against the SITE'S OWN schema, or the table checks cannot fire at all.
    assert.match(b, /\.problems\.concat\(lintPages\(/, name + " drops the lint's findings on the floor");
  }

  // And the lint really does catch these, so the assertions above are not
  // matching a call that finds nothing.
  const { lintPages } = await import("../../../builder/page-gen.mjs");
  const found = lintPages([{
    path: "src/routes/g.tsx",
    source: 'import { createFileRoute } from "@tanstack/react-router";\n' +
      'export const Route = createFileRoute("/g")({});\n' +
      'export default function G(){ fetch("/x"); return <div className="bg-amber-400"><a href="#/book">B</a></div>; }',
  }], { tables: [] });
  assert.ok(found.length >= 3, "the lint found only " + found.length + " on a page carrying several faults");
});

test("the route reads `remove` and hands it to the merge", () => {
  // The wiring layer: worker.js cannot be imported, and this repo has recorded
  // a feature dead at exactly this seam nine times. A merge that accepts a third
  // argument nobody passes is the whole feature, silently absent.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /Array\.isArray\(aGen\.input\.remove\)/, "the route never reads what the model returned");
  // ⚠ RE-ANCHORED 2026-09-17, NOT APPEASED. This was pinned to the literal
  // `mergeAddonPages(aSrc, aValid.pages, aRemove)` and went red on an honest
  // FOURTH argument — this repository's own "assert the property, not the
  // spelling", in the guard written for the wiring layer it is about.
  //
  // THE PROPERTY IS THE ARGUMENT LIST, read depth-aware so a nested call inside
  // one of them cannot end it early — the recorded flat-scan trap. Every call
  // must carry the removals AND the named destinations, and the count is pinned
  // so a fifth argument added next month is a decision somebody makes rather
  // than one that slips in.
  const calls = [];
  for (let at = w.indexOf("mergeAddonPages(aSrc"); at >= 0; at = w.indexOf("mergeAddonPages(aSrc", at + 1)) {
    let i = w.indexOf("(", at), depth = 0, end = i;
    for (; end < w.length; end++) {
      if (w[end] === "(") depth++;
      else if (w[end] === ")" && --depth === 0) break;
    }
    calls.push(w.slice(i + 1, end).split(",").map((s) => s.trim()));
  }
  // THREE SINCE 2026-10-24 (round 2 of the retry rule): the writer's answer is
  // merged once ahead (`aWriterCheck`) to judge whether it would end `rewrote`
  // or `not-landed` and must be asked again — with the same removals and the
  // same named destinations as the merge that ships.
  assert.equal(calls.length, 3, "the route's merge call sites moved: " + calls.length);
  for (const args of calls) {
    assert.equal(args.length, 4, "a merge call carries " + args.length + " arguments: " + JSON.stringify(args));
    assert.equal(args[2], "aRemove", "the merge is called without the removals: " + JSON.stringify(args));
    // AND THE SAME LIST ON BOTH, because the second call is the RE-MERGE after a
    // QR dependency is withheld: a different permission set there would revert
    // on the second pass exactly what the first pass kept.
    assert.equal(args[3], "aAskedPages", "the merge is called without the named destinations: " + JSON.stringify(args));
  }
  // And the answer carries both halves back, or the client cannot tell the
  // owner what went and what was refused.
  assert.match(w, /removed: aMerge\.removed/);
  assert.match(w, /kept: aMerge\.kept/);
});

test("the route hands a considered refusal to the customer, not to the build lane", () => {
  // Specific refusal text must win over the generic stop explanation.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-17, TWICE, AND THE SECOND TIME IS THE LESSON. First
  // `const` became `let` (a dead QR code withholds a page and the route
  // RE-MERGES what survives); then the merge gained an honest fourth argument
  // and this went red again on a change it is not about. THE LANDMARK IS THE
  // ASSIGNMENT — `aMerge = mergeAddonPages(` — because what this case needs is
  // a place to START A WINDOW, and an argument list is not part of that claim.
  // Pinning one is the recorded "assert the property, not the spelling", and it
  // has now cost this file three red cases across two rounds.
  const at = w.indexOf("aMerge = mergeAddonPages(");
  assert.ok(at > 0, "the addon merge call moved");
  // TO A LANDMARK, NOT A BYTE COUNT. This read `at + 1400` and went red on a
  // correct change the moment a documented branch was added between the two
  // anchors — a test about how much prose sits in the region, on the recurring
  // own-goal this repo records as "a window sized in BYTES stops covering what
  // it was written for the moment comments are added above it".
  const end = w.indexOf("recompileAndPublish(env, {", at);
  assert.ok(end > at, "the publish that bounds this region moved — rescope this");
  const after = w.slice(at, end);
  const refuse = after.indexOf("if (!aMerge.ok && aMerge.msg)");
  const stop = after.indexOf("return aFail(addonFailure(aMerge.reason");
  assert.ok(refuse > 0, "a refusal with a reason still escalates to the build lane");
  assert.ok(stop > 0, "the generic stop is missing");
  assert.ok(refuse < stop, "the generic stop hides the specific refusal");
});

test("a revert is reported all the way to the customer", () => {
  // A SILENT REVERT IS THE SAME PARTIAL THIS LANE HAS HAD TWICE. It is the
  // customer's own page being put back — and if they really did want it edited,
  // this sentence is the only way they find out it did not stick.
  assert.match(addonReply({ added: ["src/routes/g.tsx"], reverted: ["src/routes/book.tsx"] }),
    /I left \/book as it was/);
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /reverted: aMerge\.reverted/, "the route computes the revert and never returns it");
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /a\.reverted/, "the client is never told a page was put back");
});

// ── ALTERING A TABLE THE SITE ALREADY HAS ────────────────────────────────────
//
// The whole reason this exists: the lane concatenated `[...prior, ...designed]`
// into `normalizeSchema`, whose dedup is first-declaration-wins, so `payment`
// and `publicView` on an existing table were dropped SILENTLY — which is why a
// site built without a price could never start taking money.

const priorTables = () => ([
  { name: "bookings", access: "collect", columns: [{ name: "customer", type: "text" }],
    unique: ["slot"], confirm: { to: "email", subject: "s", body: "b" } },
  { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] },
]);

test("THE ROUTE USES THE MERGE, and reports what it CREATED rather than what was named", () => {
  // ANCHORED ON THE PROPERTY, NOT THE ARGUMENT LIST. The first draft pinned the
  // exact call `mergeAddonSchema(aSpec.tables || [], aDesigned.tables)` and went
  // red on a correct change one commit later — a test about word order, which
  // this repo has now recorded four times.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /const folded = mergeAddonSchema\(/,
    "the addon lane no longer folds its designed schema over the stored one");
  assert.ok(!/tables: \[\.\.\.\(aSpec\.tables \|\| \[\]\), \.\.\.aDesigned\.tables\]/.test(w),
    "the old concat is back, so payment on an existing table is dropped again");
  assert.match(w, /aTables = folded\.added/,
    "the response names every table the designer mentioned, so it claims to have created one the site already had");
  assert.match(w, /import \{[^}]*mergeAddonSchema[^}]*\} from "\.\/builder\/site-addon\.mjs"/,
    "a call to a name that was never imported is a ReferenceError on the build path");
});

test("THE ADDON LANE HAS THE SEED NET, keeps the report, and bills the top-up on the one call", () => {
  // The build path grew the net on 2026-08-12 (the designer omits its own
  // required `seed` — measured twice) and this lane was left one step short of
  // the same promise: "add a specials menu" paid ~25 credits for a page over a
  // permanently-empty table, reported as success, with the seeding report
  // discarded so the failure could not name itself (2026-08-14 audit).
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const folded = mergeAddonSchema(");
  assert.ok(at > 0, "the addon schema block moved — rescope this");
  const end = w.indexOf("unlinkedPages(", at);
  assert.ok(end > at, "the addon response moved — rescope this");
  const lane = w.slice(at, end);

  // The net, NARROWED to the tables this addon ADDED — a re-declared existing
  // table is skipped by seedSiteRows when it already has rows, so buying rows
  // for one spends a Haiku call on rows that are immediately discarded.
  assert.match(lane, /const aTop = await topUpSeed\(/, "the seed net is gone from the addon lane");
  assert.match(lane, /folded\.added\.includes\(t\.name\)/, "the net is not narrowed to the added tables");
  // The bought rows must reach the seeding — merged into what is planted, and
  // the report kept rather than thrown away.
  assert.match(lane, /aSeed = mergeSeed\(aSeed, aTop\.rows\)/, "the bought rows never reach the seed");
  assert.match(lane, /aSeeded = await seedSiteRows\(adb, merged, aSeed\)/,
    "the seeding runs on the un-topped seed, or its report is discarded again");
  // ORDER, with both anchors proven first — indexOf(a) < indexOf(b) passes
  // vacuously when either is missing.
  const topAt = lane.indexOf("await topUpSeed(");
  const seedAt = lane.indexOf("seedSiteRows(");
  assert.ok(topAt > 0 && seedAt > 0, "one of the two seed steps is gone");
  assert.ok(topAt < seedAt, "the net runs after the planting — its rows arrive too late to be planted");

  // Billed on the SAME variadic call as the design and pages usages: one bill,
  // one rounding, one floor — a third separately-rounded charge is the exact
  // overbilling that call was rewritten to end.
  // `aDesignUsage` IS A LIST SINCE THE ADD STEP (2026-09-02) — the picker's
  // call and one per kind — and it is SPREAD onto the same variadic call, so
  // the property this holds is unchanged: every model call of the addon on
  // one bill, one rounding, one floor.
  assert.match(w, /pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage(?:, aPick && aPick\.usage)?\)/,
    "the top-up's usage is not billed, or is billed on its own rounding");

  // And the response says what happened — the build response's own three
  // fields, so an empty new table can name its cause without Cloudflare logs.
  // Anchored on the response object's own first field, not on `unlinkedPages`
  // — the seed fields sit above it in the literal.
  const respAt = w.indexOf("added: aMerge.added", at);
  assert.ok(respAt > 0, "the addon response literal moved — rescope this");
  // LANDMARK TO LANDMARK, not a byte count (the recorded trap; this was
  // `respAt + 1400` and went red on 2026-09-03 when six honest fields — the
  // backend tiers — landed above the seed fields in the literal).
  const respEnd = w.indexOf("unlinkedPages(", respAt);
  assert.ok(respEnd > respAt, "the response literal's closing landmark is gone");
  const resp = w.slice(respAt, respEnd);
  assert.match(resp, /seeded: aSeeded \? aSeeded\.seeded : undefined/, "the response drops the row counts");
  assert.match(resp, /seedSkipped:/, "the response drops the skip reasons");
  assert.match(resp, /seedTopUp: aSeedTopUp \|\| undefined/, "the response cannot say the net fired");
});

// ── THE SPEC-LEVEL TIERS ─────────────────────────────────────────────────────
//
// The route passed `{ tables: … }` and nothing else, so `functions`, `apis` and
// `jobs` never reached `normalizeSchema` at all — the entire "the model writes
// the backend" tier unreachable on any site after its first build.

const FN = { name: "hook_stripe", args: [{ name: "payload", type: "jsonb" }], returns: "void", body: "BEGIN END;", internal: true };
const API = { name: "rates", url: "https://example.com/r" };

test("THE ROUTE HANDS OVER THE WHOLE DESIGNED SPEC", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-10-18 (audit A04-1): under a draft the whole overlay is
  // the prior; off one the table list, as before. The designed spec is whole.
  assert.match(w, /mergeAddonSchema\(aDraftView \? aSpec : \(aSpec\.tables \|\| \[\]\), aDesigned\)/,
    "the route still passes aDesigned.tables, so functions and apis are dropped again");
  assert.match(w, /normalizeSchema\(folded\.spec\)/,
    "the route rebuilds a tables-only object, which throws the tiers away after the merge kept them");
});

test("the page layer computes it and BOTH ends of the wire carry it", () => {
  // Computed and rendered by nothing is this repo's most-recorded failure — the
  // build reply's `notes`, `oneClickBlocked`, the four ticked steps.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*orderingMoved[^}]*\} from "\.\/builder\/site-addon\.mjs"/);
  assert.match(w, /const alsoOn = orderingMoved\(target\.source, wrote\.source, eSrc, target\.path\);/);
  // RE-ANCHORED 2026-10-07: every page reordered, not the first four.
  assert.match(w, /reordered: alsoOn\.length \? alsoOn : undefined,/);
  const c = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /Array\.isArray\(e\.reordered\)/);
  assert.match(c, /listed on other pages too/);
});

// ── A CONSIDERED REFUSAL FROM THE MODEL DOES NOT CLIMB THE LADDER ────────────
//
// MEASURED LIVE, TWICE, TWO DAYS APART. `edit smoke` asked for "a gallery page
// showing photographs of our work" against a fixture whose `/work` page IS that
// gallery and is already in the header. The model correctly returned no files —
// and `nothing-returned` escalated, so asking for something the site already has
// rewrote every page of it for ~25 credits. Byte-identical failures on
// 2026-08-16 and 2026-08-18 is what ruled out generator variance.

test("the addon reports the model's own note instead of escalating", () => {
  // The rule is already written one branch up — "'Remove the home page' has an
  // answer, and sending it up rebuilds a customer's site, for ~25 credits" — and
  // it covered our merge's refusals and not the model's, which is the commonest
  // case of it by far.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-17: the landmark is the ASSIGNMENT, not the argument
  // list — this is a window opener and the arguments are not its claim.
  const at = w.indexOf("aMerge = mergeAddonPages(");
  assert.ok(at > 0, "the addon merge moved — rescope this");
  const win = w.slice(at, w.indexOf("recompileAndPublish(env, {", at));

  // THE NOTE IS READ OFF THE GENERATION, not invented here.
  assert.match(win, /aGen\.input\.notes === "string"/,
    "the model's note is not read, so a considered refusal cannot be told from a failure");
  // AND IT ANSWERS RATHER THAN ESCALATING — 422 with the note as the message.
  assert.match(win, /aMerge\.reason === "nothing-returned" && aNote/,
    "the refusal branch is gone or no longer requires a note");
  // The model note must precede the generic stop explanation.
  const refusal = win.indexOf('aMerge.reason === "nothing-returned"');
  const stop = win.indexOf("return aFail(addonFailure(aMerge.reason");
  assert.ok(refusal > 0 && stop > 0 && refusal < stop,
    "the model note must take precedence over the generic stop");
});

test("unexplained unusable output stops instead of escalating", () => {
  // An absent explanation is not permission to rebuild the whole site.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-17: the landmark is the ASSIGNMENT, not the argument
  // list — this is a window opener and the arguments are not its claim.
  const at = w.indexOf("aMerge = mergeAddonPages(");
  assert.ok(at > 0, "the addon merge moved — rescope this");
  const win = w.slice(at, w.indexOf("recompileAndPublish(env, {", at));
  assert.match(win, /if \(!aMerge\.ok\) return aFail\(addonFailure\(aMerge\.reason/,
    "the unexplained-failure path must stop");
});

test("AB2-3 the add-on route hands the merge the overlay when it read a draft, and the table list otherwise", () => {
  const src = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const folded = mergeAddonSchema(");
  assert.ok(at > 0, "the add-on's merge call is gone");
  const call = src.slice(at, src.indexOf(";", at));
  assert.match(call, /aDraftView \? aSpec : \(aSpec\.tables \|\| \[\]\)/, "the add-on does not carry the overlay under a draft");
});
