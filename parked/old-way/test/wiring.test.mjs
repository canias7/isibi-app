// PARKED (2026-11-03, park-old-way): the old-way half of test/wiring.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// IS IT REACHABLE? — the check this repo keeps needing and keeps not having.
//
// The pattern, five times over: something is written, tested, on disk, and
// reachable by NOTHING. The 27 blocks, the 196 examples, the 1,140 charts, and
// eleven schema-engine features all shipped that way. Every one of them
// compiled, every unit test passed, and none of it could be used.
//
// site-theme.mjs and site-layouts.mjs were the sixth and seventh: both were
// imported only by their own tests when this file was written, so no generated
// site could carry a theme or a layout family. These assertions are the chain
// from a module on disk to a value in a built site, checked link by link,
// because every previous instance had four of five links working.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { budgetFor } from "../../../builder/site-images.mjs";
import { mergeLook, movedFields, hasValue, EDIT_RULE, currentStateNote, EDIT_FIELDS } from "../../../builder/site-edit.mjs";
import { briefWithLayout } from "../../../builder/page-gen.mjs";
import { UI_COMPONENTS, PAGE_RULES, CHART_CATALOGUE, schemaDigest, lintPages } from "../../../builder/page-gen.mjs";
import { PLAN_FIELDS, PLAN_KEYS, planFieldFor, PLAN_REQUIRED, KIT_PALETTE, COMPONENT_MENU, directiveFromPlan } from "../../../builder/site-plan.mjs";
import { normalizeSeeds } from "../../../builder/site-seeds.mjs";

const ROOT = path.join(import.meta.dirname, "../../..");
const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const buildServer = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");

/* ------------------------------------------------------------ photographs */

// THE CHAIN, link by link. This feature has the exact shape of the seven that
// were on disk and reachable by nothing: a module, a rule in the prompt, a
// budget, a dep. Four of the five links working is the state every one of those
// shipped in, so each link is asserted separately rather than end-to-end.

const clientJs = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8");

// The generate -> sniff -> hash -> put chain, wherever it lives. It was inline in
// `buySitePhotos` AND in `makeSitePhoto`, which claims in its own header to be the
// one copy — false from the day it was written. There is one now, and these guards
// read it rather than a window that happened to contain it.
// (2026-10-09, round 4) the chain is three stages — `askSitePhoto`,
// `storeSitePhoto`, `makeSitePhoto` — read together, from the first to the
// last.
const photoChain = () => {
  const at = worker.indexOf("async function askSitePhoto");
  assert.ok(at > 0 && worker.indexOf("async function makeSitePhoto") > at, "the photo stages moved — rescope these guards");
  const fn = worker.slice(at, worker.indexOf("async function buySitePhotos", at));
  assert.ok(fn.length > 400, "makeSitePhoto moved — rescope these guards");
  return fn;
};

test("a picture that could not be made says WHY, and the caller carries it", () => {
  // "A site quietly missing its pictures looks exactly like a site that was never
  // meant to have any" — `buySitePhotos`' own words for why the reason exists. It
  // reaches `out.images.error` and rides the build response, and TWO mutations
  // proved nothing held it: dropping the reason from a refusal, and destructuring
  // only `url` at the call site, both passed the whole suite.
  // (2026-10-09, round 4) staged: every exit of the two stages that is not a
  // success names its stage and carries a reason, and `makeSitePhoto` has one
  // silent ending, the empty prompt.
  const fn = photoChain();
  const exits = [...fn.matchAll(/return \{ stage: "([a-z]+)"[^}]*\}/g)];
  assert.ok(exits.length >= 8, `only ${exits.length} stage exits found — the scan stopped matching`);
  const silent = exits.filter((e) => !["generated", "stored"].includes(e[1]) && !/error:/.test(e[0]));
  assert.deepEqual(silent.map((e) => e[0]), [], "a failure exit reports no reason");
  const mk = fn.slice(fn.indexOf("async function makeSitePhoto"));
  // (2026-10-11) `asked: false` beside it says the service never saw it; it
  // is not a reason, so the ending stays the one silent one.
  const quiet = [...mk.matchAll(/told\(\{ stage: "([a-z]+)"(?:, asked: false)? \}\)/g)];
  assert.deepEqual(quiet.map((m) => m[1]), ["empty"], "a silent ending other than the empty prompt");
  assert.match(mk.slice(0, mk.indexOf('told({ stage: "empty", asked: false })')), /imagePrompt\(prompt\)/,
    "the one silent exit is not the empty-prompt case any more");
  assert.match(mk, /error: scrubProvider\(/, "the reason is handed back unscrubbed");

  // …AND THE CALLER READS IT. Computed and dropped is the shape of a dead field.
  const buy = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  // THROUGH A LOGICAL PURCHASE OR STRAIGHT TO THE IMAGE SERVICE (2026-10-09,
  // round 3): either way the reason is destructured, and the purchase buyer
  // hands `makeSitePhoto`'s own reason through.
  // ROUND 5: \`recovered\` rides beside it, for the build's live lines.
  // ROUND 6: the buyer is also handed the shot's identity callback.
  assert.match(buy, /const \{ url, error, unknown, id, d, k, why, recovered \} = buy \? await buy\(prompt(?:, \(x\) => inflight\.set\(token, x\))?\) : await makeSitePhoto\(/, "the per-shot reason is destructured away");
  const buyer = worker.slice(worker.indexOf("function purchaseBuyer("), worker.indexOf("\n}\n", worker.indexOf("function purchaseBuyer(")));
  assert.match(buyer, /made = await makeSitePhoto\(env, slug, dd, meta\)/, "the purchase buyer does not make the photograph through makeSitePhoto");
  assert.match(buyer, /made\.error \? \{ error: made\.error \}/, "the purchase buyer drops makeSitePhoto's reason");
  // (2026-10-09, round 4) EVERY PURCHASE HANDS ITS HOOKS TO THE PHOTOGRAPH: the
  // picture step's generator passes the purchase's `meta` through too, so a
  // made picture's source is recorded and its ending reported wherever the
  // purchase mechanism is used (picture step, add-on, build).
  assert.match(worker, /await makeSitePhoto\(env, ownerSlug, describe, meta\)/, "the picture step drops the purchase's hooks");
  const once = worker.slice(worker.indexOf("async function purchaseOnce("), worker.indexOf("function heldPurchase("));
  assert.match(once, /generated: async \(source\) =>/, "purchaseOnce no longer records the made picture's source");
  assert.match(once, /report: \(o\) =>/, "purchaseOnce no longer hears how the attempt ended");
  // (2026-10-08, the seventh batch) the refusal is also recorded as that
  // shot's own ending, beside the reason.
  assert.match(buy, /else \{ refusedTokens\.add\(token\); if \(error\) failed = error; \}/, "the reason is read and then not kept");
});

test("the translation calls are billed, and a refused language is reported", () => {
  // `langUsage` WAS ACCUMULATED AND READ BY NOTHING — real Haiku spend on every
  // bilingual publish that the ledger never saw, against the standing rule that
  // every model call is charged on measured usage. And the BUILD path's copy of
  // the same loop did not even accumulate; its own comment called that "a
  // pre-existing gap".
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /langUsage: langUsage\.length \? langUsage : undefined,/,
    "the spine still swallows what its translation calls cost");

  // BILLED THROUGH `eCharge`, NOT INSIDE THE SPINE, and that is the property
  // rather than a preference: `pageCredits` is variadic precisely so several
  // calls land on ONE bill with ONE rounding, and billing separately down there
  // would round twice — the exact bug the addon lane had.
  // WINDOWED FROM `billParts`, NOT FROM `eCharge` (2026-08-29). The unwrapping
  // moved into `billParts` when the edit route needed to REPORT the same list it
  // bills — the look lane was assembling its `usage` separately and the router's
  // call was counted twice. `eCharge` now calls `billParts` and prices it, so a
  // window starting at `eCharge` sees two lines and none of the logic. The
  // property is unchanged: one list, unwrapped once, priced once.
  // BOTH LANDMARKS, PROVEN TO EXIST AND TO BE IN ORDER. `indexOf` answering -1
  // gives `slice(-1, -1)` = "", which passes every assertion inside it — the
  // vacuous-window trap this repo has recorded ten times over.
  const ecFrom = w.indexOf("const billParts = (");
  const ecTo = w.indexOf("const modelDown = (");
  assert.ok(ecFrom > 0, "`billParts` is gone or was renamed — this window reads nothing");
  assert.ok(ecTo > ecFrom, "`modelDown` no longer follows `billParts` — this window is inverted or empty");
  const ec = w.slice(ecFrom, ecTo);
  // NO BYTE CEILING. This read `ec.length < 2500` and went red when the billing
  // code grew a comment explaining why the routing call is charged once per
  // MESSAGE rather than once per rung — reporting that the code had "moved"
  // when nothing had. Sizing a source window in bytes is this repo's single
  // most-repeated own-goal: the reasoning lives in comments here, so any byte
  // bound is outrun by the next one worth writing. Landmarks above, properties
  // below, and nothing in between that measures length.
  assert.match(ec, /Array\.isArray\(p\.langUsage\)/, "eCharge no longer unwraps a publish result");
  assert.match(ec, /parts\.push\(\.\.\.p\.langUsage\.filter\(Boolean\)\)/, "the language usage is detected and dropped");
  assert.match(ec, /pageCredits\(\.\.\.parts\)/, "the parts are no longer priced together, so the rounding is charged twice");

  // AND A LANE THAT PUBLISHES HANDS ITS RESULT OVER. Derived from the publish
  // variables themselves rather than a list of the lanes there are today: a
  // ninth lane written tomorrow is covered without anybody remembering this
  // file. A REFUSAL is deliberately excluded — it returns before the publish,
  // so naming the variable there is a temporal-dead-zone ReferenceError AND
  // semantically wrong, since nothing was published to translate. (Four of
  // those were written and caught here before they shipped.)
  const pubVars = [...w.matchAll(/(?:const|let) (\w*[Pp]ub) = (?:await |null;\n)?/g)]
    .map((m) => m[1]).filter((v) => /Pub$|^pub$/.test(v));
  assert.ok(pubVars.length >= 4, "the publish-variable scan found only " + pubVars.length + " — it has stopped scanning");
  for (const v of new Set(pubVars)) {
    const decl = w.search(new RegExp("(?:const|let) " + v + "\\b"));
    // Every eCharge AFTER this variable's declaration and inside its lane.
    const uses = [...w.matchAll(new RegExp("await eCharge\\([^)]*\\b" + v + "\\b[^)]*\\)", "g"))];
    for (const u of uses) {
      assert.ok(u.index > decl,
        v + " is named by an eCharge at " + u.index + " but declared at " + decl + " — a temporal-dead-zone ReferenceError");
    }
  }

  // THE REFUSED LANGUAGE IS RETURNED (and since audit A32-4 told: `langNote`
  // reads it into `renderNote`, held in translate-unsafe.test.mjs and
  // site-render.test.mjs). `resolveLangs` returns a per-language
  // reason and every reader kept only `langs` — while `mergeLook` had already
  // STORED the refused tag and `movedFields` reported the look as changed. So
  // the customer is told it landed, no switcher appears, no prefixed routes
  // exist, and the dead value sits in `site_look` being re-refused for ever.
  assert.match(w, /const \{ langs: siteLangs, refused: langsRefused \} = resolveLangs\(/,
    "the spine destructures away the refusal reasons again");
  assert.match(w, /langsRefused: \(langsRefused && langsRefused\.length\) \? langsRefused : undefined,/,
    "a refused language is computed and never returned");
});

test("each language's translation is marked and its outcome carried, so a second language that is behind names its reason (2026-09-04)", () => {
  // fretwork-1 served /es and /fr in the primary's English for three days: the
  // spine's loop falls back to the primary wording by design (a failed
  // translation must not fail the edit), and the only record was a console
  // line in the Worker's log. The recorded "a failure that cannot name
  // itself", on the one step of the spine with no trace mark.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const from = w.indexOf("// ── THE SITE'S OTHER LANGUAGES");
  const to = w.indexOf("// WRITTEN BACK ONLY WHEN IT MOVED", from);
  assert.ok(from > 0 && to > from, "the spine's language loop is not where this window looks");
  const loop = w.slice(from, to);
  assert.match(loop, /tm\("translate:" \+ l\.tag, "start", \{ missing: missing\.length/, "a translation call starts without a mark");
  // (2026-10-22, audit A32-1: the mark reads the outcome, which is a failure
  // for an answer with nothing usable in it, not only for a failed call.)
  assert.match(loop, /tm\("translate:" \+ l\.tag, outcome\.ok \? "ok" : "fail", outcome\)/, "a translation's outcome is not marked");
  // (2026-10-23, audit #195: the reason is the last refused batch's, or
  // "stuck" when every batch was remembered as failing and none was asked.)
  assert.match(loop, /why: got\.asked \? String\(got\.why \|\| "call"\) : "stuck", error: got\.asked \? String\(got\.error \|\| ""\)\.slice\(0, 300\) : "[^"]+"/, "a failed translation's reason is not kept");
  // RE-ANCHORED FOR TASK #88: the languages run through `Promise.all` now and
  // the loop is a call phase plus an ordered fold, so a fully cached language
  // is an early RETURN carrying its outcome rather than a push. The property is
  // that it is accounted for at all — a language nothing asked about must still
  // reach the wire, or "cached" and "never tried" read the same to a customer.
  assert.match(loop, /outcome: \{ tag: l\.tag, missing: 0, ok: true, cached: true \}/, "a fully cached language is not accounted for");
  assert.match(loop, /langOutcomes\.push\(r\.outcome\)/, "the fold does not carry each language's outcome");
  // Carried on the result and THROUGH THE MERGE, never only logged. Run 38
  // read "the spine's account: none" off a reply that had carried it from the
  // look branch's deferred stub — the field was on the spine's result and the
  // reply is assembled from the ONE publish below the branches.
  assert.match(w, /langs: langOutcomes\.length \? langOutcomes : undefined,/, "the spine's result drops the per-language outcome");
  assert.match(w, /langs: finalPub \? finalPub\.langs : \(last && last\.body\.langs\),/, "the merged reply does not carry the spine's account of each language");
  assert.match(w, /langsRefused: finalPub \? finalPub\.langsRefused : \(last && last\.body\.langsRefused\),/, "the merged reply drops the refused languages");
  assert.doesNotMatch(w, /langs: pub\.langs,/, "the look branch reads the account off the deferred stub, which never has one");
  // The rule that started this is unchanged: a failed translation falls back
  // to the primary wording and never fails the publish — and it no longer
  // poisons the cache: a failed round hands `nextCache` null, and a cache
  // that was never translated is read as none.
  // (2026-10-23, audit #195: failed when no batch answered usably; each
  // refused batch's strings are handed to `nextCache` as lost.)
  assert.match(loop, /const failed = got\.failed\.size === missing\.length;\n\s*if \(got\.refused\) console\.error\("translate failed", slug, l\.tag, got\.why \|\| got\.error/, "a failed translation no longer falls back, or is not remembered as failed");
  // The fold reads its round off `r` since task #88, so `have`/`failed`/`fresh`
  // are `r.have`/`r.failed`/`r.fresh`; the properties are unchanged and each is
  // written to accept either spelling rather than to pin this one.
  assert.match(loop, /nextCache\((?:r\.)?have, strings, (?:r\.)?failed \? null : (?:r\.)?fresh(?:, (?:r\.)?lost)?\)/, "a failed round still writes the primary's words into the cache");
  assert.match(loop, /const healed = untranslated\(had\);\n\s*const have = healed \? \{\} : had;/, "a cache that was never translated is not read as none");
  assert.match(loop, /langsChanged = langsChanged \|\| JSON\.stringify\(merged\) !== JSON\.stringify\((?:r\.)?had\);/, "the write-back compares against the healed cache, so a healed language is never written");
  // THE BUILD PATH'S COPY holds the same two rules and hands the same models.
  const bFrom = w.indexOf("// THE SPINE'S TWO RULES, MIRRORED");
  assert.ok(bFrom > 0, "the build path's loop no longer mirrors the spine's cache rules");
  const bClose = w.indexOf("langCache[r.l.tag] = mergedStrings;", bFrom);
  assert.ok(bClose > bFrom, "the build path's cache write moved — this window would swallow the file");
  const bLoop = w.slice(bFrom, bClose);
  assert.match(bLoop, /const have = untranslated\(had\) \? \{\} : had;/);
  // (2026-10-23, audit #195: batch by batch, through the build's own sender.)
  assert.match(bLoop, /translateMissing\(env, l\.tag, missing, models, stuckFor\(langCache, l\.tag\), translateStrings\)/, "the build path translates on no model of the picker's");
  assert.match(bLoop, /nextCache\((?:r\.)?have, strings, (?:r\.)?failed \? null : (?:r\.)?fresh(?:, (?:r\.)?lost)?\)/);
  // AND THE WRITE-BACK, which the spine's half has asserted since run 38 and
  // this one had not: against the cache AS READ (`had`), never the healed
  // `have`. A sweep found it — the build path's twin of a killed mutant
  // survived for want of this line. It matters on the one shape that is not
  // cosmetic: a language whose poisoned cache was healed and whose call then
  // FAILED merges to `{}`, which equals the healed `have` and so would be read
  // as unchanged and never written — leaving the poison on disk for every
  // later publish to re-detect.
  assert.match(bLoop, /langsChanged = langsChanged \|\| JSON\.stringify\(mergedStrings\) !== JSON\.stringify\(r\.had\);/,
    "the build path's write-back compares against the healed cache, so a healed language is never written back");
});

test("the translation runs on the picked model like every other small call (owner, 2026-09-04), and the routes hand the picker in", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const from = w.indexOf("async function translateStrings(");
  const to = w.indexOf("\n}\n", from);
  assert.ok(from > 0 && to > from, "translateStrings is gone or was renamed");
  const fn = w.slice(from, to);
  // NOT PINNED, NOT ANTHROPIC BY ADDRESS: the one small call left behind on
  // 2026-08-31 went through `anthropicMessages` with Haiku's name, and run 38
  // read `anthropic 400` off the trace for it.
  assert.doesNotMatch(fn, /claude-haiku|anthropicMessages\(/, "the translation is still pinned to Haiku on Anthropic");
  assert.match(fn, /const model = \(models && typeof models\.quick === "string" && models\.quick\) \|\| modelsFor\(\)\.quick;/, "the model is not the picker's quick slot");
  assert.match(fn, /quickSend\(env, "translate:" \+ tag\)\(\{\n\s*model,/, "the call does not go through the sender that routes on the model's provider");
  assert.match(fn, /if \(modelKeyMissing\(env, model\)\) return \{ ok: false, why: "unconfigured"/, "a missing key is not refused before the call");
  assert.doesNotMatch(fn, /thinking:/, "Haiku's thinking field is still sent to whichever provider the model belongs to");
  // The API's own words ride with the status.
  assert.match(fn, /error: String\(\(e && e\.message\) \|\| e\) \+ detail, usage: null/, "a failed call keeps the status and drops the reason");
  // THE ROUTES HAND THE PICKER IN: the edit route through the one deferred
  // publish, the addon route directly, the build route into its page builder.
  // (The object grew a `charge` after `models` on run 39 — the funnel the spine
  // charges those translations through; the property here is the models.)
  assert.match(w, /pendingPublish = \{ \.\.\.args, pages: eSrc, renamed: Object\.keys\(renamed\)\.length \? renamed : null, parts, models: modelsFor\(eb && eb\.picker\)(?:, [^\n]*?)? \};\n/, "the edit route's deferred publish carries no models");
  // (The parameter list grew `charge = null` after `models` on run 39; the
  // property is that the spine takes and defaults `models`, wherever it sits.)
  assert.match(w, /async function recompileAndPublish\(env, \{[^}]*\bmodels = null\b[^}]*\}\)/, "the spine takes no models");
  assert.match(w, /const tModels = models && typeof models\.quick === "string" \? models : modelsFor\(\);/, "the spine does not resolve the picker's models");
  // (2026-10-23, audit #195: through the batch runner, on the same models.)
  assert.match(w, /translateMissing\(env, l\.tag, missing, tModels, /, "the spine translates on no model of the picker's");
  // THE ADDON'S CALL, WHOLE — walked by brace depth from the options object's
  // own `{`. A 900-byte window from the call's first line was outrun on
  // 2026-09-05 by the `charges` line and its comment (the recorded trap: never
  // size a source-read window in bytes).
  const aHead = "const aPub = await recompileAndPublish(env, {";
  const aCall = w.indexOf(aHead);
  assert.ok(aCall > 0, "the addon route's publish call is gone");
  const addon = (() => {
    const open = aCall + aHead.length - 1;
    assert.equal(w[open], "{", "the addon call's options object does not open where the head says");
    let d = 0;
    for (let i = open; i < w.length; i++) {
      if (w[i] === "{") d++;
      else if (w[i] === "}") { d--; if (d === 0) return w.slice(aCall, i + 1); }
    }
    assert.fail("the addon route's publish call has no closing brace");
  })();
  assert.match(addon, /models: aModels,/, "the addon route's publish carries no models");
  // (The parameter list grew `billRef = null` after `models` in stage 1c, the
  // build's ledger ref for the pages debit; the property is that the page
  // builder takes and defaults `picker` and `models`, wherever they sit — the
  // same shape as the spine's check above.)
  assert.match(w, /async function buildAndPublishPages\(env, \{[^}]*\bpicker = null\b[^}]*\bmodels = null\b[^}]*\}\)/, "the build's page builder takes no picker and no models");
  // THE BUILDER RESOLVES ITS OWN when a caller hands none — from the `picker`
  // the build route stores beside `model` in the design, which is what the
  // consumer that finishes a build has in hand. `test/build-params.test.mjs`
  // is what found the picker arriving undestructured.
  assert.match(w, /\n  models = models && typeof models\.quick === "string" \? models : modelsFor\(picker\);\n/, "the builder does not resolve the picker's models when a caller hands none");
  assert.match(w, /model: models\.pages,\n(?:\s*\/\/[^\n]*\n)*\s*picker: models\.picker,/, "the build route does not store the picker beside the pages model in the design");
  // WALKED BY BRACE DEPTH, like the addon's call above it. A 1,400-byte window
  // from the call's head was outrun on 2026-09-10 by a comment on the
  // collector's `mark:` hook, so `models:` fell outside it and the guard
  // reported a call site that carries models as carrying none — the THIRD time
  // a byte window in this file has been outrun by this repository's own
  // comments, and the recorded trap says never to size one in bytes.
  const head = "buildAndPublishPages(env, {";
  const sites = [];
  for (let at = w.indexOf(head); at >= 0; at = w.indexOf(head, at + head.length)) {
    const open = at + head.length - 1;
    let d = 0;
    for (let i = open; i < w.length; i++) {
      if (w[i] === "{") d++;
      else if (w[i] === "}") { d--; if (d === 0) { sites.push(w.slice(at, i + 1)); break; } }
    }
  }
  // A FLOOR ON WHAT WAS SCANNED, because `[].every` is true and a walk that
  // finds nothing passes silently.
  //
  // AND WHAT IT SCANS IS NOT WHAT THIS COMMENT FIRST CLAIMED — corrected
  // 2026-09-10 by driving it. It said "two call sites, the route's and the
  // collector's". Driven, the walk finds the function DECLARATION (the
  // parameter list, whose `models = null` satisfies the match trivially) and
  // the COLLECTOR's call. The route's call is `buildAndPublishPages(env,
  // buildArgs)` — an identifier, not an object literal — so this head never
  // matches it and never did, including under the byte window this replaced.
  // The re-anchor fixed the truncation and changed the subjects not at all;
  // only the sentence describing them was wrong, which is worse than a weak
  // guard because it reads as coverage nobody has.
  //
  // THE ROUTE'S CALL IS COVERED ELSEWHERE, by the assertions on `buildArgs`
  // itself — so the floor here is a floor on THESE two subjects, not a claim
  // about every call site.
  assert.ok(sites.length >= 2, "expected the declaration and the collector's call; found " + sites.length);
  for (const site of sites) {
    assert.match(site, /\bmodels\b/, "a build call site hands the page builder no models: " + site.slice(0, 80));
  }
});

test("the translation calls are CHARGED — by the spine, before the commit point, through the caller's own funnel (run 39, 2026-09-04)", () => {
  // RUN 39: fretwork-1's Spanish and French were translated for the first
  // time — two Grok calls, 88 strings each — and charged to nobody. The spine
  // carried their usage on its result "so somebody can bill them"; the edit
  // route read it nowhere, because every rung's publish is deferred and the
  // one spine runs after every rung has billed, and the publish result the
  // rungs hand `eCharge` is the deferred stub. So the route that bills hands
  // the spine its own funnel and the spine charges through it ONCE, the moment
  // the translations are in hand — before the compile and the gate, the addon
  // repair round's rule — and says what it charged.
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const pp = fs.readFileSync(new URL("../../../builder/publish-pages.mjs", import.meta.url), "utf8");
  const pos = (s, needle, what) => { const i = s.indexOf(needle); assert.ok(i >= 0, (what || needle) + " is not there"); return i; };
  // The spine's body by brace depth — a request init is full of braces and a
  // flat window has been written wrong here four times.
  const bodyOf = (name) => {
    const at = pos(w, "async function " + name + "(");
    // THE BODY'S BRACE, NOT THE PARAMETER LIST'S: the spine destructures its
    // options, so the first `{` after the name opens `{ slug, pages, … }` and a
    // walk from there returns the parameters and calls them the body.
    const open = w.indexOf(") {", at) + 2;
    let d = 0;
    for (let i = open; i < w.length; i++) {
      if (w[i] === "{") d++;
      else if (w[i] === "}") { d--; if (d === 0) return w.slice(at, i + 1); }
    }
    assert.fail(name + " has no closing brace");
  };
  const spine = bodyOf("recompileAndPublish");

  // ── THE SPINE ──
  // (The list grew `charges = null` — the route's reader of its own refusals —
  // after `charge` on 2026-09-05; the property is that the spine takes and
  // defaults `charge`, wherever it sits. `\bcharge\b` does not match
  // `charges`.)
  assert.match(w, /async function recompileAndPublish\(env, \{[^}]*\bcharge = null\b[^}]*\}\)/, "the spine takes no charge funnel");
  const loopWrite = pos(spine, "patchSiteConfig(env, slug, db, { langStrings: nextStrings }, jobFence(env, job))", "the cache write");
  const charged = pos(spine, "let langCharged = 0;", "the charge");
  const compileDef = pos(spine, "const compile = async () => {", "the compile");
  const gate = pos(spine, 'editRpc(env, "edit_may_publish"', "the gate");
  assert.ok(loopWrite < charged && charged < compileDef && compileDef < gate,
    "the charge is not between the language loop and the compile — before the gate is the whole point");
  const block = spine.slice(charged, compileDef);
  assert.match(block, /if \(langUsage\.length && typeof charge === "function"\) \{/,
    "the charge is not gated on both something translated AND a funnel handed in");
  assert.match(block, /langCharged = Number\(await charge\(langUsage\)\) \|\| 0;/, "the funnel is not handed the whole publish's translation usage");
  assert.match(block, /try \{[\s\S]*?\} catch \(e\) \{[\s\S]*?console\.error\("translation charge failed"/, "a funnel that throws fails the publish");
  assert.match(block, /tm\("translate:charge", "ok", \{ calls: langUsage\.length, credits: langCharged \}\)/, "the charge leaves no mark on the trace");
  assert.match(spine, /langCharged: langUsage\.length \? langCharged : undefined,/, "the result does not say what was charged");
  assert.doesNotMatch(spine, /langCost/, "the dead per-language counter is back");
  // RE-ANCHORED FOR TASK #88: each round now hands its usage back off `r` and
  // the fold pushes it, because the calls run through `Promise.all`. The
  // property is that EVERY call's usage still reaches `langUsage` — the list
  // the funnel above is handed — since a translation whose usage is dropped is
  // one nobody is charged for, which is the defect run 39 found.
  // (2026-10-23, audit #195: a round hands back each usable batch's usage.)
  assert.match(spine, /for \(const u of r\.usages \|\| \[\]\) if \(u\) langUsage\.push\(u\);/, "the spine no longer keeps each call's usage");
  // (2026-10-22, audit A32-1: only a round that translated something hands
  // its usage back; a refused or unusable answer is not billed.)
  // (2026-10-23, audit #195: each usable batch's, from `translateMissing`,
  // which pushes a batch's usage only when it answered usably.)
  assert.match(spine, /usages: got\.usages, stuck: got\.stuck, outcome \}/, "a round no longer hands its usage back, so the fold has nothing to push");
  // AND THE USAGE IS IN THE SHAPE `pageCredits` PRICES, tagged with the model
  // sent — the lanes' own reader. The raw API usage went out of
  // `translateStrings` until the driven case in test/edit-path.test.mjs priced
  // it: `input_tokens` read as no tokens and no model.
  assert.match(w, /const read = readTranslation\(use && use\.input, strings\.length\);[\s\S]{0,700}?const usage = laneUsage\(r, model\);/,
    "the translation's usage is not read the way the lanes read theirs");
  assert.doesNotMatch(w, /usage: r\.usage \|\| null/, "the raw API usage still goes out of translateStrings");

  // ── THE EDIT ROUTE: `eCharge` itself, so the receipt and the bill stay one list ──
  // (The object grew `charges: eCharges` after `charge` on 2026-09-05 — the
  // route's reader of its own refusals; the property here is the funnel.)
  assert.match(w, /pendingPublish = \{ [^\n]*charge: \(usage\) => eCharge\(\{ langUsage: usage \}\)(?:, [^\n]*?)? \};/,
    "the deferred publish hands the spine no funnel, or one that is not eCharge");
  assert.match(w, /cost: done\.reduce\(\(n, d\) => n \+ \(Number\(d\.body && d\.body\.cost\) \|\| 0\), 0\) \+ \(finalPub \? Number\(finalPub\.langCharged\) \|\| 0 : 0\)(?:\s*\/\/[^\n]*\n\s*\+ \(finalPub && finalPub\.compileRepaired \? Number\(finalPub\.compileRepaired\.charged\) \|\| 0 : 0\))?(?:\s*\/\/[^\n]*\n\s*\+ \(finalPub && finalPub\.visualReview \? Number\(finalPub\.visualReview\.charged\) \|\| 0 : 0\))?,/,
    "the merged reply's cost does not add what the spine charged — every step's own bill was placed before the spine ran");

  // ── THE ADDON ROUTE: reserve #3 under a job, the one collect otherwise ──
  const fnAt = pos(w, "const aChargeLangs = async (usage) => {", "the addon's funnel");
  const fn = w.slice(fnAt, pos(w.slice(fnAt), "\n            };") + fnAt);
  assert.match(fn, /aLangUsage\.push\(\.\.\.usage\);/, "the addon's funnel does not keep the usage for the synchronous collect");
  assert.match(fn, /if \(!aJob\) return 0;/, "the addon's funnel reserves without a job");
  assert.match(fn, /await aCharge\(pageCredits\(\.\.\.usage\), 3\)/, "the addon's reserve is not its own sequence (#3: the bill is #1, the repair round #2)");
  assert.match(fn, /aLangCharged \+= got;/, "what the ledger charged is not kept for the reply");
  const callAt = pos(w, "const aPub = await recompileAndPublish(env, {", "the addon's publish");
  assert.ok(fnAt < callAt, "the addon's funnel is declared after the publish it is handed to");
  assert.match(w.slice(callAt, w.indexOf("});", callAt)), /charge: aChargeLangs,/, "the addon's publish is handed no funnel");
  // RE-ANCHORED 2026-09-17: the photographs joined the same collect, and they
  // are not a spread — `pageCredits` is variadic and a picture is one
  // `{images: n}` term, priced at the flat `IMAGE_USD`. The property is ONE
  // `pageCredits` and ONE rounding over everything this route spent, so the
  // tail is left open rather than spelled; the translations are still required
  // BY NAME, which is what this case is about.
  assert.match(w, /if \(!aJob\) aCost = await aCharge\(pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, \.\.\.aRepairUsage, \.\.\.aLangUsage[^)]*\)\);/,
    "synchronously the translations do not join the one collect");
  // …AND UNDER A JOB IT IS THE SUM OF WHAT EACH SEQUENCE REALLY RESERVED. The
  // photographs' own reserve (#5) joined it 2026-09-17; the tail is open for
  // the reason above and the translations' term is still required by name.
  assert.match(w, /else aCost \+= \(Number\(aRepairRound && aRepairRound\.charged\) \|\| 0\) \+ aLangCharged[^;]*;/,
    "under a job the reply's cost does not carry the translations' reserve");

  // ── THE OWNER'S WORDING EDIT: the words are free, their translation is not ──
  const tx = w.slice(pos(w, 'label: "Edited the wording",', "the wording edit"), pos(w, "applied: ed.applied, files: out.files", "the wording reply"));
  assert.match(tx, /charge: \(usage\) => collectCredits\(request\.headers\.get\("Authorization"\) \|\| "", pageCredits\(\.\.\.usage\)\),/,
    "the owner's wording edit translates for nothing");
  assert.match(w, /applied: ed\.applied, files: out\.files, render: out\.render, renderNote: out\.renderNote, checks: out\.checks, (?:draft: out\.draft, )?cost: Number\(out\.langCharged\) \|\| 0 \}/,
    "the wording edit's reply does not say what the translation cost");

  // ── THE PLATFORM REBUILD hands none: it spends no credits, and translates for nothing as it always did ──
  // THE WHOLE CALL, from its opening to its close — a window that stopped at
  // the label let a mutant hand the funnel in one line below it and survive.
  for (const needle of ['label: "platform rebuild",', 'label: "Back online" }']) {
    const i = pos(w, needle, "the rebuild's publish");
    const callStart = w.lastIndexOf("recompileAndPublish(env, {", i);
    const callEnd = w.indexOf("})", i);
    assert.ok(callStart > 0 && i - callStart < 600 && callEnd > i && callEnd - i < 300, "the rebuild's publish call is not where its label is");
    assert.doesNotMatch(w.slice(callStart, callEnd + 2), /charge:/, "a platform rebuild hands the spine a funnel: " + needle);
  }

  // ── THE BUILD PATH: the usage rides the compile result onto the build's ONE bill ──
  const dep = w.slice(pos(w, "compile: async (pages, builtParts, cOpts = null) => {", "the build's compile dep"), pos(w, "repair: mappedSend(env, slug, \"page\", quickSend(env)),", "the repair dep"));
  assert.match(dep, /const langUsage = \[\];/, "the build's compile dep keeps no translation usage");
  // RE-ANCHORED FOR TASK #88: the call and the push were adjacent lines until
  // the build loop split into `Promise.all` plus an ordered fold, so the round
  // hands its usage back and the fold pushes it. The property is that every
  // call's cost still reaches `langUsage`, which is what `publishPages` prices
  // this build from — a dropped one is a translation nobody pays for.
  // (2026-10-23, audit #195: batch by batch; each usable batch's usage is
  // handed back and pushed.)
  assert.match(dep, /const got = await translateMissing\(env, l\.tag, missing, models, /, "the build loop no longer translates on the picked model");
  assert.match(dep, /usages: got\.usages, stuck: got\.stuck \}/, "a build round hands its usage back nowhere");
  assert.match(dep, /for \(const u of r\.usages \|\| \[\]\) if \(u\) langUsage\.push\(u\);/, "the build loop drops what each translation cost");
  assert.match(dep, /if \(langUsage\.length && built && typeof built === "object"\) built\.langUsage = langUsage;/, "the usage does not ride the compile result");
  assert.match(pp, /const langUsage = \[\];/, "publishPages keeps no translation usage");
  assert.match(pp, /if \(bd && Array\.isArray\(bd\.langUsage\)\) for \(const u of bd\.langUsage\) if \(u\) langUsage\.push\(u\);/,
    "publishPages does not read the compile result's translation usage");
  assert.match(pp, /const c = pageCredits\(gen\.usage, priorUsage, out\.images \? \{ images: out\.images\.made \} : null, \.\.\.repairUsage, \.\.\.langUsage, \.\.\.\(pickUsage \? \[pickUsage\] : \[\]\)\);/,
    "the build's one bill does not price the translations");
});
