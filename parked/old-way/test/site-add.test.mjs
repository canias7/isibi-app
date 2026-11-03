// PARKED (2026-11-03, park-old-way): the old-way half of test/site-add.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE ADD STEP IS ITS OWN PATH — asserted, and driven.
//
// Owner, 2026-09-02: "lets start building the addon part". The addon route
// called the BUILD's designer (`designSiteSchema`, the 97,142-character tool)
// anchored on the stored look to add one page or one code, and read four
// fields off the answer. `builder/site-add.mjs` is the split the edit path got
// on 2026-08-29: its own picker, one small tool per kind of thing a site can
// lack, its own wording, nothing from worker.js.
//
// WHAT IS ASSERTED HERE, in two opposite halves, as `edit-lanes.test.mjs`
// does for the edit path:
//   * the step borrows NOTHING from the build's tool or wording, and
//   * the shapes it must share (a table, a hand-written part) are the build's
//     own objects, by identity — one shape, two framings, never two copies.
// And the wiring: the route runs this step where it ran the designer, the
// fields the edit path refuses to create all have a kind here, and the
// browser hops sideways when the step names a cheaper rung.
//
// DRIVEN, NOT READ, wherever the module can be called: the picker and the
// add runner take a fake `send`, the cleaner and the fold take real answers.
import test from "node:test";
import { tweakInput, asEdits } from "../../../test/fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import { EDIT_LAYERS } from "../../../builder/route-shared.mjs";
import { TABLE_ITEM, FUNCTION_ITEM } from "../../../builder/site-table.mjs";
import { TSX_ITEM, MAX_TSX, TOOL_DIRECTIVE } from "../../../builder/site-plan.mjs";
import { MAX_ADD_MANIFEST as MAX_COMPONENTS } from "../../../builder/site-add.mjs";
import { MAX_PAGES } from "../../../builder/page-gen.mjs";
import { QUESTION_FIELD } from "../../../builder/clarify.mjs";
import { routeOf } from "../../../builder/site-addon.mjs";
import { modelsFor } from "../../../builder/build-models.mjs";
import { MAX_QRS } from "../../../builder/site-qr-list.mjs";
import { IMAGE_CAP, MAX_PROMPT_CHARS } from "../../../builder/site-images.mjs";
import { REQUIREMENT_ITEM } from "../../../builder/site-requirements.mjs";
import { wordsParts as WP, wordsLanded as WL, renderedLinks as RL } from "../../../builder/site-add.mjs";
import {
  ADD_PAGE_BATCH, ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, PLACING_ADDS, MAKES_PAGES, addLayerIn, LIST_ADDS, MAX_ADDS, MAX_ADD_PAGES, MAX_ADD_COMPONENTS, MAX_ADD_TABLES, MAX_ADD_ROWS, MAX_ADD_WORDS, MAX_SECTIONS, MAX_ADD_SEED_ROWS, MAX_MESSAGE, ADD_MODEL, ADD_DESIGN_RULE,
  BACKEND_ADDS, BACKEND_KEYS, MAX_ADD_FUNCTIONS, backendDesigned, pageless,
  addLayer, pickTool, pickRequest, readAdds, pickAdds, addUsage,
  addTool, addRule, composeRule, RULE_PARTS, addRequest, siteNote, readAddAnswer, runAdd,
  cleanAdd, fileOfRoute, addDirective, foldAdds, addRefusal, alreadyReply, pageLabels,
  REQUIREMENT_ADDS, tableFacts, deadQrs, deadQrNote, routedSources, qrSiteRoute, droppedNote,
} from "../../../builder/site-add.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const SRC = read("../../../builder/site-add.mjs");

/** Length-preserving comment blanking, string-aware — worker.js has `//` inside strings. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };

const SITE = { name: "Sheffield Beginner Guitar", kind: "shopfront", pages: ["/"], tables: [], hasDatabase: false, qr: null, three: null, tsx: [] };
const MULTI = { ...SITE, pages: ["/", "/about"] };
const DB = { ...SITE, hasDatabase: true, tables: ["bookings"] };

/** A reply the way the API answers a forced tool call. */
const toolReply = (name, input, extra = {}) => ({
  content: [{ type: "tool_use", name, input }],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 },
  ...extra,
});

test("every field the edit path refuses to create has a kind here, and the route refuses a second one by name", () => {
  const W = blankComments(read("../../../worker.js"));
  const decl = W.slice(at(W, "const ADD_ONLY_FIELDS = [", "list"), W.indexOf("];", at(W, "const ADD_ONLY_FIELDS = [", "list")));
  const fields = [...decl.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(fields.length >= 2, "the edit path's add-only list is empty — this test scans nothing");
  for (const f of fields) assert.ok(OWN_ADDS.includes(f), `the edit path sends "${f}" to the addon and the add step cannot make one`);
  // THE MIRROR OF THE WALL, NARROWED (2026-09-03): the addon block refuses a
  // second of what a site carries ONE of — `SINGLE_FIELDS`, which is `three`
  // alone now that a site carries several QR codes — and names the door that
  // changes the first. `qr` stays on `ADD_ONLY_FIELDS` (the edit path may not
  // CREATE one) and comes off the single list (the addon may add another);
  // both facts are asserted, because either list drifting is a customer
  // bounced between the two doors.
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  const loop = b.indexOf("for (const f of SINGLE_FIELDS) {\n              if (aKinds.includes(f) && aHas[f]) {");
  assert.ok(loop > 0, "the addon does not refuse a kind the site carries one of, off the single-field list");
  assert.match(b.slice(loop, b.indexOf("}", b.indexOf("}", loop) + 1) + 1), /alreadyReply\(f\)/, "the refusal does not name the door that changes it");
  const single = W.slice(at(W, "const SINGLE_FIELDS = [", "single"), W.indexOf("];", at(W, "const SINGLE_FIELDS = [", "single")));
  const singles = [...single.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(singles, ["three"], "the fields a site carries one of");
  assert.ok(fields.includes("qr") && !singles.includes("qr"), "a QR code must be add-only for the edit path AND addable again for the addon");
  for (const f of singles) assert.ok(fields.includes(f), "a single field the edit path may create: " + f);
  // …and the addon's picker is shown the site's codes as the LIST, so the
  // designer names a new one against every name and destination it has.
  assert.match(b, /qr: qrList\(aLook\.qr\),/, "the addon's site note is not handed the stored codes as a list");
  // …AND THE SITE'S OWN ADDRESS (run 26, 2026-09-03), read by the one reader
  // of the public address, so a code that opens one of the site's pages has
  // a real destination — the designer answered nothing without it. A read
  // that fails leaves it blank rather than refusing every other kind.
  assert.match(b, /let aUrl = "";\s*try \{ aUrl = await publicUrlFor\(env, ownerSlug\); \} catch \{ aUrl = ""; \}/, "the addon does not read the site's public address, or a failed read is not blank");
  // RE-ANCHORED 2026-09-14: `const aSite = {` became `const siteFacts = (spec)
  // => ({` — the facts are REBUILT after each kind, so a designer sees what the
  // ones before it proposed rather than the stored site alone.
  const factsAt = b.indexOf("const siteFacts = (spec, names = aNewNames, pages = aNewPages) => ({");
  assert.ok(factsAt > 0, "the site facts are no longer built from a spec");
  const siteLit = b.slice(factsAt, b.indexOf("});", factsAt));
  assert.match(siteLit, /\burl: aUrl,/, "the site note is not handed the address");
  // …AND WHAT EACH PAGE CALLS ITSELF (run 28), out of the stored source and
  // the stored plan, so "the booking page" is findable among routes.
  // RE-ANCHORED 2026-10-11: `aView`, the pages or a prepared part's scope of them.
  // RE-ANCHORED 2026-10-11 (round 11): the request's labels, as the message was
  // understood, over the stored ones for the pages this part is shown.
  assert.match(siteLit, /\blabels: \{ \.\.\.pageLabels\(aView, aLook\.pages\), \.\.\.aLabelsAt \},/, "the site note is not handed the pages' own headlines");
  assert.match(W, /import \{[^}]*\bpageLabels\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "pageLabels is called and never imported");
  // …AND EVERY DESIGNER'S RAW REPLY IS KEPT, on the site's own store, the
  // moment the loop ends and before a decline can return — then read back by
  // the owner through the answer route with `kind=addon`.
  // RE-ANCHORED 2026-10-11: the call is the early answer or a call made now.
  const runAt = at(b, "let ranFirst = aEarlyOne ? await aEarlyOne : await runAdd(", "run");
  // ANCHORED ON THE CALL, NOT ON ITS ARGUMENT LIST. This read the whole literal
  // and went red on 2026-09-13 for an honest extra argument — the coverage
  // record — reporting the keep as gone when it had only grown. The property is
  // the ORDER: kept, then the decline may return.
  // RE-ANCHORED 2026-10-09: the keep goes through `aKeepAnswer`, which saves
  // exactly as before except under a preparation, which keeps nothing.
  const keep = b.indexOf("await aKeepAnswer(env, ownerSlug, {", runAt);
  const decline = b.indexOf('error: "declined"', runAt);
  assert.ok(keep > runAt && decline > keep, "the designers' replies are not kept before the decline returns");
  // AND THE DEVELOPER RECORD GOES WITH THEM (owner, 2026-09-13): the counts,
  // the unreadable entries and the invalid property names, none of which the
  // customer is told. Read inside the call's own span, so a record written
  // somewhere else entirely cannot satisfy it.
  //
  // RE-ANCHORED 2026-09-14. This pinned the whole `requirementRecord({ list:
  // aReq, skipped: … , ran:` argument list, which is the recorded "assert the
  // property, not the spelling" trap: the record is written TWICE now (once
  // here and once after the apply, so the stored coverage says what really
  // became of each requirement), so the literal moved into `aRecord` and the
  // call became `aSaveAnswer`. The property is that the save carries the
  // coverage and happens before the decline returns.
  assert.match(b.slice(keep, decline), /coverage: aRecord\(\)/,
    "the coverage record is not stored beside the replies");
  // RE-ANCHORED 2026-10-07: the composer takes the failure it is written for
  // (`aRecord(failed)`, B2), so its parameter list is not pinned — the
  // property is that it exists above its use.
  const rec = b.search(/const aRecord = \([^)]*\) => requirementRecord\(\{/);
  assert.ok(rec > 0 && rec < keep, "the record composer is gone, or is written below its own use");
  assert.match(b.slice(rec, b.indexOf("});", rec)), /list: aReq, skipped: aReqSkipped, invalid: \[\.\.\.aBadProps\]/,
    "the record no longer carries the coverage list, the unreadable entries and the invalid properties");
  assert.match(b.slice(runAt, keep), /aKept\.push\(\{ kind: k, answered: ran\.value !== undefined, stop_reason: [^}]*content: \(ran\.raw && ran\.raw\.content\) \|\| null \}\);/, "a reply is kept without its content");
  // POSITION, NOT PRESENCE (the sweep's survivor): the push must sit BEFORE
  // the decline's `continue`, or an unanswered designer — the one reply
  // worth reading — is exactly the one never kept.
  const pushAt = b.indexOf("aKept.push({ kind: k,", runAt);
  const skipAt = b.indexOf("if (ran.value === undefined) { aDeclined.push(k); continue; }", runAt);
  assert.ok(pushAt > runAt && skipAt > pushAt, "an unanswered designer's reply is not kept — the decline skips past the keep");
  assert.match(W, /url\.searchParams\.get\("kind"\) === "addon" \? await loadAddonAnswer\(env, aslug\) : await loadGenAnswer\(env, aslug\)/, "the answer route cannot read the addon's kept replies");
  const keyFn = W.slice(at(W, 'const ADDON_ANSWER_KEY = (slug) => "source/"', "key"), W.indexOf("\n", at(W, 'const ADDON_ANSWER_KEY = (slug) => "source/"', "key")));
  assert.match(keyFn, /addon-answer\.json/, "the addon's replies share the build answer's key — one would overwrite the other");
  // …and "has" is read the way the wall reads it: the stored look OR the page.
  assert.match(b, /aHas\[f\] = hasLookField\(aLook, f\) \|\| \(aSrc \|\| \[\]\)\.some\(\(p\) => ADD_EVIDENCE\[f\]\.test/, "the addon reads 'already has' off the stored look alone — run 12's misfire");
});

// ── THE WIRING ───────────────────────────────────────────────────────────────

test("THE BACKEND HOPS: the site is described with its columns and tiers, designed functions reach the job designer, the database is made on first touch, the jobs are registered, and a pageless addition answers without a compile", () => {
  const W = blankComments(read("../../../worker.js"));
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  assert.match(W, /import \{[^}]*\bbackendDesigned\b[^}]*\bpageless\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "the two decisions are not imported");
  // The prebuilt jobs and connections went on 2026-10-29: their reader is not imported.
  assert.doesNotMatch(W, /from "\.\/site-jobs\.mjs"/, "the engine's job reader is imported again");
  // THE SITE, as the designers see it: the tables with their columns, the
  // three tiers by name, and the internal functions apart.
  // RE-ANCHORED 2026-09-14, and the rename is the change: the facts are a
  // FUNCTION of a spec now, called once on the frozen baseline and again after
  // every kind on the accumulated proposal. `aSpec` became the parameter for
  // the same reason — reading the baseline here would show the fifth designer
  // the site as it was before the first one ran.
  const site = b.slice(at(b, "const siteFacts = (spec, names = aNewNames, pages = aNewPages) => ({", "site"), at(b, "hasDatabase: !!adb,", "site end"));
  for (const key of ["columns:", "functions:", "jobFns:", "apis:", "jobs:"]) assert.ok(site.includes(key), "the site note is not handed " + key);
  assert.match(site, /jobFns: \(\(spec && spec\.functions\) \|\| \[\]\)\.filter\(\(f\) => f && f\.name && f\.internal\)/, "`jobFns` is not the INTERNAL functions");
  // …AND WHICH OF THEM THIS MESSAGE IS STILL BUILDING, so a designer can rely
  // on a name AND know it is not there yet. Asserted on the addon block rather
  // than on `site`: that window closes at `hasDatabase`, which sits ABOVE this
  // line — the recorded "a window running to a named neighbour" trap, met
  // writing the assertion rather than reading one.
  // `names` IS `aNewNames` unless a designer is shown its own view (2026-10-11).
  assert.match(b, /proposed: \{ \.\.\.names \}/, "the note cannot tell a stored name from one being added right now");
  assert.match(site, /c\.name \+ \(c\.type \? " " \+ c\.type : ""\)/, "a column is not printed with its type");
  // THE FUNCTION DESIGNER'S ANSWERS REACH THE JOB DESIGNER: appended to the
  // site's lists as they are cleaned, the internal ones to `jobFns`, under
  // the kind's own name.
  // THE ANSWER CARRIES ITS COVERAGE LIST WITH IT (owner, 2026-09-13) — hop 4's
  // input. Anchored on the call's head rather than its whole argument list, the
  // lesson of the `saveAddonAnswer` landmark two hundred lines up.
  const push = at(b, "aAnswers.push({ kind: k, value: clean.value,", "answer kept");
  assert.match(b.slice(push, push + 200), /aAnswers\.push\(\{ kind: k, value: clean\.value, requirements: ran\.requirements \}\);/,
    "the kept answer drops the coverage list the designer answered");
  // THE SAVE THAT FOLLOWS THE PUSH (re-anchored 2026-10-07): a failure exit
  // above the loop now saves the developer record too (B2), so the first save
  // in the route is no longer the one after the designers.
  const feed = b.slice(push, b.indexOf("await saveAddonAnswer(", push));
  assert.ok(feed.length > 0, "the save after the designers is gone");
  // RE-ANCHORED 2026-09-14, AND THE PROPERTY WIDENED RATHER THAN MOVED. This
  // pinned two hand-written pushes gated on `k === "function"` — the only two
  // facts that ever crossed between the kinds' separate model calls, so the
  // `api` designer could not see the table just designed and the `page`
  // designer was handed the STORED site. One accumulation replaces them: the
  // cleaned items fold into the proposal and the facts are rebuilt from it, so
  // EVERY later designer sees everything decided so far — the function reaching
  // the job designer included, which is what these three lines were for.
  // ONE FOLD SINCE 2026-10-11 (`aFoldInto`), shared with a designer's own view
  // of the site (`aSiteFor`): the loop folds into the whole site with it.
  const fold = b.slice(at(b, "const aFoldInto = (st, k, value) => {", "fold"), at(b, "const aFoldInto = (st, k, value) => {", "fold") + 2500);
  assert.match(feed, /aFoldInto\(st, k, clean\.value\);\s*aProposed = st\.spec;/, "a designed item never joins the proposal");
  assert.match(fold, /st\.spec = proposedSpec\(st\.spec, k, value\)/, "a designed item never joins the proposal");
  assert.match(feed, /aSite = siteFacts\(aProposed\)/, "the next designer is not shown what this one designed");
  assert.match(fold, /if \(k === "function" && one\.internal === true && !st\.names\.jobFns\.includes\(one\.name\)\) st\.names\.jobFns\.push\(one\.name\)/,
    "an internal function does not join `jobFns`, or a public one does");
  // …AND `jobFns` REMAINS THE INTERNAL ONES ONLY, which is the half a job's
  // cleaner reads: the engine drops a job naming any other function, silently.
  assert.match(site, /jobFns: \(\(spec && spec\.functions\) \|\| \[\]\)\.filter\(\(f\) => f && f\.name && f\.internal\)/,
    "`jobFns` stopped being the internal functions");
  // THE DATABASE ON FIRST TOUCH: any tier designed, no connection → make
  // one, before the schema work, gated under a job, and a failure is ours
  // — named, scrubbed, nothing charged.
  const tiers = at(b, "const aBackend = backendDesigned(aDesigned);", "tiers");
  // RE-ANCHORED 2026-10-16: the provision STARTS here and runs beside the
  // page writer (`aProvWait`); its failure is said by `aProvFailed`, moved
  // unchanged, and it is settled after the page call (`aProvCheck`).
  const prov = at(b, "const aProvRun = () => ensureSiteBackend(env, ownerSlug, ou.id, aInstruction,", "provision"); // RE-ANCHORED 2026-10-23: built here, run at the seam on the page path
  const schema = at(b, "const folded = mergeAddonSchema(", "schema");
  assert.ok(tiers < prov && prov < schema, "the provision is not between the fold and the schema work");
  const gate = b.slice(tiers, prov);
  assert.match(gate, /if \(aBackend\.length\) \{/, "the schema block is not gated on a tier being designed");
  assert.match(gate, /if \(!adb\) \{/, "the provision is not gated on there being no database");
  assert.match(gate, /aJob\.gate\("editing"\)/, "a queued provision is not asked cancel and budget first");
  const fail = b.slice(at(b, "const aProvFailed = (e) => {", "provision failure"), at(b, "const aProvCheck = async () =>", "provision check"));
  assert.ok(b.indexOf("{ const pf = await aProvCheck(); if (pf) return pf; }", prov) > prov, "the provision is never settled after it starts");
  assert.match(fail, /error: "provision", cost: 0, ours: true,/, "a failed provision is not named as ours at no charge");
  assert.match(fail, /stage: \(e && e\.stage\) \|\| null,/, "a failed provision does not say which call failed");
  assert.match(fail, /detail: scrubSecrets\(/, "the detail is not scrubbed");
  // THROUGH THE FAILURE DOOR since 2026-10-06 (`aFail(body, 502)`), so its
  // requirements are told beside it; the status is the door's second argument.
  // Its third argument (since 2026-10-07) carries a project the provisioner kept.
  assert.match(fail, /return aFail\(\{\s*ok: false, error: "provision"[\s\S]*?\}, 502(?:, \{[^{}]*\})?\);/, "a failed provision is not answered 502 through the failure door");
  assert.match(b.slice(prov, schema), /aSpec = \{ tables: \[\] \};/, "a database just made is not described as empty");
  // RE-ANCHORED, NOT APPEASED (2026-09-15). This was pinned to
  // `let adb = await siteBackendBySlug(env, ownerSlug);` — the SPELLING of a
  // reader that has been replaced. `siteBackendBySlug` collapses four facts
  // into one `null` (run 47's defect) and the route now asks
  // `siteBackendDetail`, which tells them apart and resolves an incomplete
  // reference instead of reporting an empty site.
  //
  // THE PROPERTY IS UNCHANGED AND IS WHAT IS ASSERTED: the connection is a
  // `let`, so the provision below has somewhere to put its answer. Pinned to
  // the declaration itself rather than to which function fills it, which is
  // the "assert the property, not the spelling" rule the old line broke.
  assert.match(b, /\blet adb = aBack\.conn;/, "the connection is not reassignable — the provision's answer has nowhere to go");
  assert.match(b, /const aBack = await siteBackendDetail\(env, ownerSlug\)/,
    "the route no longer asks which of the four backend states this site is in");
  assert.match(b, /if \(aBack\.state === "none"\) aSpec = \{ tables: \[\] \};/,
    "`{tables: []}` is no longer keyed on the ONE state in which it is true");
  // NO JOB IS RE-ATTACHED (2026-10-29): the prebuilt jobs went.
  const norm = at(b, "const merged = normalizeSchema(folded.spec);", "normalize");
  const reattach = b.slice(norm, at(b, "let aSeed = aDesigned.seed;", "seed"));
  assert.doesNotMatch(reattach, /normalizeJob\(|aJobFns/, "a job is re-attached again");
  // THE SEED NET ONLY FOR AN ADDED TABLE; the engine's report read for what
  // it made; the jobs registered by the build route's own call.
  const apply = at(b, "aMade = await applySiteSchema(adb, merged);", "apply");
  assert.match(b.slice(norm, apply), /if \(folded\.added\.length\) \{\s*const aTop = await topUpSeed\(/, "the seed net buys rows for a change that added no table");
  const made = b.slice(apply, at(b, "aSeeded = await seedSiteRows(adb, merged, aSeed)", "seeding"));
  assert.match(made, /aFunctions = aNamed\("functions"\)\.filter\(\(n\) => aMadeFns\.includes\(n\)\);/, "the reply names functions the engine did not make");
  assert.match(made, /aFnErrors = Array\.isArray\(aMade && aMade\.functionErrors\)/, "a function the database refused is not carried");
  assert.doesNotMatch(made, /persistSiteJobs|secretsNeeded/, "prebuilt jobs are registered, or a connection's secrets read, again");
  // PAGELESS: before the page call, billed through the one charge, answered
  // in the page path's shape. RE-ANCHORED 2026-09-05 (stage 8): the schema
  // work above is a CLOSURE the pageless path runs itself before it answers
  // (`await aApplyBackend(null)`), and the page path runs at the seam — so
  // "after the schema work" is the call inside the pageless block, not the
  // block's position below the closure's text.
  const pl0 = at(b, "if (pageless(aAnswers)) {", "pageless");
  const gen = at(b, "aGen = await generateSitePages(", "page call");
  assert.ok(pl0 > at(b, "aApplyBackend = async (version) => {", "the apply closure") && pl0 < gen, "the pageless answer is not between the apply closure and the page call");
  const pl = b.slice(pl0, gen);
  assert.ok(at(pl, "await aApplyBackend(null)", "the pageless path's own apply") < at(pl, "const aCostNow = ", "the pageless charge"), "the pageless path does not run the schema work before it answers");
  assert.match(pl, /added: \[\], changed: \[\], removed: \[\], moved: \[\],/, "the pageless answer is not in the page path's shape");
  assert.match(pl, /functions: aFunctions,\n/);
  assert.match(pl, /provisioned: aProvisioned \|\| undefined,/);
  // THE REPLY ON THE PAGE PATH carries the tiers, the errors, the secrets and
  // the provision — absent when none, so an ordinary addon's reply is unchanged.
  const reply = b.slice(at(b, "tables: aTables, altered: aAltered,", "reply"), at(b, "unlinked: unlinkedPages(", "reply end"));
  for (const line of ["functions: aFunctions.length ? aFunctions : undefined,",
    "functionErrors: aFnErrors.length ? aFnErrors : undefined,", "provisioned: aProvisioned || undefined,"]) {
    assert.ok(reply.includes(line), "the reply drops: " + line);
  }
});

test("THE ROUTE RUNS THE ADD STEP WHERE IT RAN THE BUILD'S DESIGNER, and folds what the step designed", () => {
  const W = blankComments(read("../../../worker.js"));
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  assert.ok(!/designSiteSchema\(/.test(b), "the addon still calls the build's designer");
  // ── RE-ANCHORED 2026-09-17: `addLayer(` BECAME `addLayerIn(` ─────────────
  //
  // The route asks WHERE THIS KIND'S WORK HAPPENS FOR THIS MESSAGE, which for
  // a `PLACING_ADDS` kind depends on the company it keeps — so the reader took
  // a second argument and the old literal stopped occurring. The property is
  // that the route reaches the module's decision rather than re-deciding, and
  // the stronger form of it is below: all THREE asks go through the one
  // reader, since two of them disagreeing is a kind designed and then reported
  // as skipped, or set aside and never designed.
  for (const fn of ["pickAdds(", "runAdd(", "cleanAdd(", "foldAdds(", "addLayerIn(", "addRefusal(", "alreadyReply("]) assert.ok(b.includes(fn), "the addon does not call " + fn);
  assert.ok(!/\baddLayer\(/.test(b), "the addon asks the kind's own layer somewhere the message decides it");
  // FIVE SINCE 2026-10-24: the frame handed on (`aFrameHop`) names its layer through the one reader too.
  assert.equal((b.match(/addLayerIn\(/g) || []).length, 5, "the addon does not ask the one reader at the escalate, the set-aside list, the frame hand-on and the loop gate");
  assert.match(W, /import \{[^}]*\bpickAdds\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "a call to a name never imported is a ReferenceError on the addon path");
  // The order: picked, hopped, refused-by-name, designed, cleaned, folded, merged.
  const pick = at(b, "const aPicked = await pickAdds(", "pick");
  const hop = at(b, "if (aHop && aKinds.length === 1) return aFailure(\"layer\", { layer: addLayerIn(aHop, aKinds), kind: aHop });", "hop");
  // RE-ANCHORED 2026-09-03: the named refusal of a table on a site with no
  // database sat between the hop and the design. The backend is the addon's
  // now and the first tier designed MAKES the database, so what follows the
  // fold is the provision, then the schema work, then the look merge.
  // RE-ANCHORED 2026-10-11: the call is the early answer or a call made now.
  const run = at(b, "let ranFirst = aEarlyOne ? await aEarlyOne : await runAdd(", "run");
  // ⚠ RE-ANCHORED 2026-09-19, and the expectation MOVED rather than broke: the
  // site handed to the cleaner is `aSite` PLUS `today`, the site's own local
  // date, for the one-time job's past-date refusal. `aSite` is rebuilt from the
  // proposal after every kind, so a field stamped inside `siteFacts` would
  // vanish between the first designer and the last — which for that wall means
  // it stands down for every kind but the first. The spread at the call is the
  // fix, and the assertion is that the cleaner still gets the site facts AND
  // gets the date.
  // RE-ANCHORED 2026-10-11 (round 10): the cleaner reads each answer first
  // (`aCleanOf`, still handed `aSite` plus `today`), so a corrected answer
  // takes the one processing path; the landmark is where its verdict is acted
  // on, after that path has billed and recorded the final answer.
  assert.ok(b.includes("cleanAdd(k, r.value, { ...aSite, today: aToday })"), "the cleaner is not handed the site facts and the date");
  // RE-ANCHORED 2026-10-22: a refused kind is set aside by name and the loop
  // goes on (`aNotAdded`); the verdict is still acted on before the fold.
  const clean = at(b, "aNotAdded.push({ kind: k, why: clean.why, msg: addRefusal(clean.why, k) });", "clean");
  const fold = at(b, "const aFold = foldAdds(aAnswers, aLook, aSite);", "fold");
  const designed = at(b, "const aDesigned = aFold.designed;", "designed");
  const prov = at(b, "const aProvRun = () => ensureSiteBackend(env, ownerSlug, ou.id, aInstruction, (n) => aMark(\"prov:\" + n, \"ok\")).then((db) => {", "provision");
  const schema = at(b, "const folded = mergeAddonSchema(aDraftView ? aSpec : (aSpec.tables || []), aDesigned);", "schema");
  const merged = at(b, "const aMerged = mergeLook(aLook, aDesigned, {}, { instructed: true });", "merge");
  assert.ok(pick < hop && hop < run && run < clean && clean < fold && fold < designed && designed < prov && prov < schema && schema < merged, "the addon's steps are out of order");
  assert.ok(!b.includes('error: "no-database"'), "a table is still refused for want of a database — the first backend tier makes one now");
  // Every small call is the picker's model, and every usage rides one bill.
  assert.match(b.slice(pick, hop), /model: aModels\.quick/, "the picker is not on the picked model");
  assert.match(b.slice(run, clean), /model: aModels\.quick/, "an add is not on the picked model");
  assert.match(b.slice(run, clean), /if \(ran\.usage\) aDesignUsage\.push\(ran\.usage\);/, "an add's usage is not billed");
  assert.match(b, /pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage(?:, aPick && aPick\.usage)?\)/, "the picker's and the adds' usages are not on the one bill");
  // A cleaner's refusal and a declined step are sentences, never climbs.
  assert.match(b.slice(clean, fold), /addRefusal\(clean\.why, k\)/, "a refused answer is not told to the customer");
  assert.match(b.slice(clean, fold), /if \(!aAnswers\.length\) \{/, "every kind declining is not a named answer");
  // An empty picker stops, or (2026-10-24, addon-existing) hands a known page to the page step.
  // A feature on a known page (2026-10-25, feature-existing) is never handed back.
  assert.match(b, /if \(!aPicked\.kinds\.length\) return \(aOnPage && !aFeature\) \? aToPage\("no-add"\) : aFailure\("no-add"\)/, "an empty picker must stop");
  // The page call is told the addition and shown the kit parts' props.
  const gen = at(b, "aGen = await generateSitePages(env, briefWithLayout({", "page call");
  const call = b.slice(gen, b.indexOf("}), aSpec", gen));
  // RE-ANCHORED 2026-10-24 (no add-on limits): each parallel page writer's
  // brief carries its batch's directive, and one batch is the whole directive.
  assert.match(call, /brief: aInstruction \+ \(aDirective \? "\\n\\n" \+ aDirective : ""\)/, "the directive does not ride the brief");
  assert.match(b.slice(gen - 400, gen), /aFold\.batchDirectives\.length > 1 \? aFold\.batchDirectives : \[aFold\.directive\]/, "one writer is not handed the whole directive");
  // RE-ANCHORED 2026-09-17, and the expectation is WIDER rather than moved
  // (owner: *"required kit signatures"*). This was pinned to `aFold.components`
  // — the union of what THIS change declares — so a writer editing a page
  // built from `<Accordion>` got that component's props only when the addition
  // happened to name it too. `aPlanComponents` is that union PLUS the kit
  // components the site's existing pages import, and the property is that both
  // sources reach the plan; the spelling of the variable is not the property.
  const plan = call.match(/plan: ([A-Za-z]+)\.length \? \{ components: \1 \} : null/);
  assert.ok(plan, "the kit parts are not handed to the page call: " + call);
  // RE-ANCHORED 2026-10-11 (Codex on d7a00395): the plan is built in one place,
  // `aWriterFor`, so a scoped writer asked again with the whole site is shown
  // everything with it — read from that function to the page call.
  const planAt = b.indexOf(plan[1] + " = [...aFold.components]");
  assert.ok(planAt > 0 && planAt < gen, "the plan's construction could not be found before the page call");
  const planBuild = b.slice(planAt, gen);
  assert.match(planBuild, /aFold\.components/, "the addition's own components do not reach the page call's plan");
  // RE-ANCHORED 2026-10-11: the pages the writer is shown (`aWriterSrc`, the
  // site or a prepared part's scope of it).
  assert.match(planBuild, /pageComponents\(aWriterSrc\)/, "the kit components the site's pages already import do not reach the page call's plan");
  // The reply says what kinds were added and what was set aside — and which
  // entries of a list were left out, with the server's own sentence.
  // RE-ANCHORED 2026-10-03 (the combined request flow): a kind set aside and
  // carried on in its own words is left for later (`deferred`, `setAside`)
  // instead of named as set aside, so the reply's list is the ones that were
  // not carried — `aSkippedSaid`, the set-aside list less a carried `frame`.
  assert.match(b, /kinds: aAnswers\.map\(\(a\) => a\.kind\), skipped: aSkippedSaid,/, "the reply does not say what was added");
  assert.match(b, /const aSkippedSaid = aSkipped\.filter\(\(k\) => !\(k === "frame" && aFrameCarried\)\);/, "the set-aside list drops more than the kind carried on");
  assert.match(b.slice(clean, fold), /for \(const sk of Array\.isArray\(clean\.skipped\) \? clean\.skipped : \[\]\) aNotAdded\.push\(\{ kind: k, \.\.\.sk, msg: addRefusal\(sk\.why, k\) \}\);/, "an entry left out of a list is not carried to the reply");
  // EVERY ENTRY SINCE 2026-10-03 (the mixed-work fixes: *"report every
  // completed, failed, declined and pending operation with its target"*): the
  // first six were kept and the rest dropped without a word.
  assert.match(b, /notAdded: aNotAdded\.length \? aNotAdded : undefined,/, "the reply does not say which entries were left out");
  assert.doesNotMatch(b, /aNotAdded\.slice\(/, "the entries left out are cut again");
  // The model-down answer is the edit route's: billing is ours, a timeout is ours.
  const down = b.slice(at(b, "const aDown = (e, what) => {", "down"), pick);
  assert.match(down, /isCallTimeout\(e\)/); assert.match(down, /k\.billing/); assert.match(down, /status: 503/);
});

// ── A CLOCK TIME ON A JOB (owner, 2026-09-03) ───────────────────────────────
//
// "Every day at nine" was "every 1440 minutes from whenever it was added".
// The designer answers `at`; the zone is the owner's browser's, read by the
// route and stamped on the cleaned job; the fold carries both to the engine.
// ── THE ADD STEP'S OWN REPAIR (owner, 2026-09-04: "each path has a repair path") ──
//
// "Try to fix it, if not fix, send as it is." Run 34's gear addon published a
// page the render check had just watched crash. The round is the ADD step's
// own — its wording, scoped to the pages the addition wrote — and shares only
// the tweak rung's mechanism with the build's pass. Driven here with fakes.

const REPAIR = await import("../../../builder/site-add.mjs");
const { readPage } = await import("../../../builder/site-render.mjs");
const { REPAIR_RULES } = await import("../../../builder/site-repair.mjs");
const { TWEAK_RULES, MAX_TWEAK_CHARS } = await import("../../../builder/site-tweak.mjs");
const rPage = (path, extra = "") => ({
  path,
  source: `import { createFileRoute } from "@tanstack/react-router";\n` +
    `export const Route = createFileRoute("${path === "index.tsx" ? "/" : "/" + path.replace(/\.tsx$/, "")}")({ component: P });\n` +
    `function P() { return <div><h1>Crookes Guitar School</h1><p>Second-hand guitars.</p>${extra}</div>; }\n`,
});
const rCrash = (route = "/gear", viewport = "desktop") => readPage({
  route, viewport, text: 109, images: 0, crashed: true,
  consoleErrors: ["Error: useFormField should be used within <FormItem>"],
});
const rReply = (req, source) => ({ content: [{ type: "tool_use", input: tweakInput({ source }, req) }], usage: { input_tokens: 10, output_tokens: 20 } });
const rFixed = (p) => p.source.replace("<p>Second-hand guitars.</p>", "<div><p>Second-hand guitars.</p></div>");
const LANGS = [{ tag: "en", prefix: "", primary: true }, { tag: "es", prefix: "es" }, { tag: "fr", prefix: "fr" }];

// ── WORDS THAT CARRY A LINK (2026-10-15, after run 38744698638) ──────────────
// The designer writes a link inside its words as `[linked words](/route)`. What
// a visitor reads is the linked words; what must arrive is a real link to the
// address. Read the markup apart, and require both.
const WL_BASE = "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ return <main><h1>Fretwork</h1>\n</main> }\n";
const wlWith = (html) => WL_BASE.replace("</main>", html + "\n</main>");
const wlCheck = (html, words, before = WL_BASE) => WL([{ path: "index.tsx", source: before }], [{ path: "index.tsx", source: wlWith(html) }], [{ page: "/", words }]).ok;

// ── EACH LINKED PHRASE AGAINST ITS OWN RENDERED LINK (2026-10-15, review) ─────
// The page-wide count of an address passed a phrase linked elsewhere, an
// address only in a comment, and two asked links to one place with one drawn.
const FOOTER = WL_BASE.replace("</main>", '<footer><Link to="/classes">Classes</Link></footer>\n</main>');
const withFooter = (html) => FOOTER.replace("<footer>", html + "\n<footer>");
const wlF = (html, words) => WL([{ path: "index.tsx", source: FOOTER }], [{ path: "index.tsx", source: withFooter(html) }], [{ page: "/", words }]).ok;

// ── WHAT THE PAGE MOUNTS, AND WHERE A LINK REALLY GOES (2026-10-15, Codex's
// second review): an unused component holding the line, while the page only
// renders Home, passed; so did `<a href="/classes" {...{href:"/wrong"}}>`,
// whose spread wins. Read now: the route's own component and what it
// renders, and each attribute as it takes effect.
const LINE_C = "Book a [workshop place](/classes) by Friday.";
const P_LINE = '<p>Book a <a href="/classes">workshop place</a> by Friday.</p>';
const landed = (after, words = LINE_C, before = WL_BASE) => WL([{ path: "index.tsx", source: before }], [{ path: "index.tsx", source: after }], [{ page: "/", words }]).ok;

// ── WHAT ACTUALLY RUNS, AND COMPONENTS THIS CANNOT READ (2026-10-15, Codex's
// third review): `if(false) return <line>`, a second return after an
// unconditional first, and children handed to an imported component whose
// rendering is unknown all passed through the exported function. A line now
// counts only where every reachable output renders it, and an imported
// component renders what it is given only when its own source — the site's
// stored components and kit — shows that it does.
const HOME = (body) => "export const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ " + body + " }\n";
const WLx = (after, opts) => WL([{ path: "index.tsx", source: WL_BASE }], [{ path: "index.tsx", source: after }], [{ page: "/", words: LINE_C }], opts).ok;

const PAGE_IMP = (imp, el) => imp + "\nexport const Route = createFileRoute('/')({ component: Home })\nfunction Home(){ return <main><h1>Fretwork</h1>" + el + "</main> }\n";
