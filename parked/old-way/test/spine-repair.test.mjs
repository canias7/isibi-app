// PARKED (2026-11-03, park-old-way): the old-way half of test/spine-repair.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SEAM ON THE PUBLISH SPINE, AND THE ADD STEP'S OWN REPAIR THROUGH IT
// (owner, 2026-09-04: "try to fix it, if not fix, send as it is" — then, when
// the first cut ran the BUILD's repair pass inside the shared spine, "each
// path has a repair path").
//
// The spine offers ONE seam between the compile and the first write and knows
// nothing about what happens there; the ADD step's own round (`addRepairRound`
// in site-add.mjs, driven in test/site-add.test.mjs) is handed in by the addon
// route and by nobody else. THIS file reads the wiring — the hop the wiring
// trap has cut twelve times — from landmark to landmark, never by byte — and
// COMPILES the Worker as a module once, because the round's variable landed
// beside a name the addon route already had and every text read stayed green.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

/**
 * Parse a source as an ES MODULE, flag-free, without evaluating it.
 *
 * `node --check worker.js` exits 0 on this file with a duplicate `let` in it
 * (measured 2026-09-04, Node 22.22): the package declares no `"type"`, so the
 * `.js` is not parsed as a module and the check says nothing. `--input-type`
 * on stdin is the module parse with no file and no flag that may be renamed.
 */
function moduleParse(src) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: src, encoding: "utf8" });
  return { ok: r.status === 0, err: String(r.stderr || "") };
}

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

const spine = between(worker, "async function recompileAndPublish(", "async function siteOgImage(", "the spine");

test("ONLY the addon route hands the spine a hook; the edit lanes and the rebuild drain are what they were", () => {
  const sites = [...worker.matchAll(/(?:recompileAndPublish|publishSpine)\(env, \{/g)].map((m) => m.index);
  assert.ok(sites.length >= 5, `expected the spine's call sites, found ${sites.length}`);
  const withHook = sites.filter((at) => /\bafterCompile: /.test(worker.slice(at, worker.indexOf("});", at) + 3)));
  assert.equal(withHook.length, 1, `${withHook.length} call sites hand the spine a hook — an edit re-checking pages the customer changed by hand`);
  const addon = worker.slice(withHook[0], worker.indexOf("});", withHook[0]));
  assert.match(addon, /slug: ownerSlug, pages: aMerge\.pages,/, "the one call site with a hook is not the addon's publish");
  assert.match(addon, /afterCompile: aAfterCompile,/);
});

test("the addon's hook IS the add step's own round: its module, its scope, the picked model, the job's clock, reserve #2 before the gate", () => {
  assert.match(worker, /import \{[^}]*\baddRepairRound\b[^}]*\baddRepairNote\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "the add step's round is not imported from its own module");
  const route = between(worker, "const aCharge = async (bill", "if (tx) {", "the addon's publish tail");
  // THE SPELLING MOVED ON 2026-09-05 (stage 8): the hook takes `version` beside
  // the five it took — the version this publish will activate, which the
  // migration record names — so the landmark is the signature WITH it. The
  // property is unchanged: one hook, these arguments, the round inside it.
  const hook = between(route, "const aAfterCompile = async ({ built, pages, langs, recompile, job, version }) => {", "aMark(\"publish:1\", \"start\"", "the hook");
  assert.match(route, /const aTouched = \[\.\.\.\(aMerge\.added \|\| \[\]\), \.\.\.\(aMerge\.changed \|\| \[\]\)\];/, "the round is not scoped to the pages this addition wrote");
  // THE SPELLING MOVED ON 2026-09-04 (run 36): the room is the job's own
  // `canRepair` still, and true without a job still, but it is asked with the
  // MEASURED need — what the page call took per page it wrote — rather than
  // bare, and the clock is read into `aClock` once so the mark can say the room
  // beside the need.
  assert.match(hook, /const aClock = job && job\.budget && typeof job\.budget\.canRepair === "function" \? job\.budget : null;/,
    "the room no longer comes from the job's own clock");
  assert.match(hook, /const room = !aClock \|\| aClock\.canRepair\(aRepairNeedMs\);/,
    "the room is not the job's own canRepair asked with the measured need, or is not true without a job");
  assert.match(route, /const aRepairNeedMs = aPagesWrote > 0 \? Math\.round\(aPagesMs \/ aPagesWrote\) : 0;/,
    "the need is not the page call's own time per page written, or is not zero when nothing was measured");
  assert.match(route, /aPagesMs = Date\.now\(\) - aPagesT0;/, "the page call is not timed");
  assert.ok(route.indexOf("const aPagesT0 = Date.now();") < route.indexOf("aGen = await generateSitePages(") &&
    route.indexOf("aGen = await generateSitePages(") < route.indexOf("aPagesMs = Date.now() - aPagesT0;"),
    "the page call is not what is timed");
  const call = between(hook, "aRepairRound = await addRepairRound({", "});", "the round call");
  // AND THE CALL RIDES THE REPAIR CLOCK, not `aQuick`: `aQuick`'s budget holds
  // back the two reserves alone, right for every call before the first
  // compile, and it is what let run 36's fix run four minutes into the room
  // its own recompile needed. `repairClock` holds back the compile too.
  for (const needle of ["report: built.render, pages, touched: aTouched, langs,", 'send: mappedSend(env, ownerSlug, "page", quickSend(env, "repair", repairClock(aClock))), model: aModels.quick, compile: recompile, room,']) {
    assert.ok(call.includes(needle), `the round is not handed: ${needle}`);
  }
  assert.ok(!call.includes('aQuick("repair")'), "the repair call is back on the plain clock");
  assert.match(worker, /import \{[^}]*\brepairClock\b[^}]*\} from "\.\/builder\/edit-job\.mjs"/, "repairClock is not imported from the clock's own module");
  // Reserve #2 inside the hook — before the spine's gate — only under a job and only when something was spent.
  assert.match(hook, /if \(aJob && aRepairRound\.usage\.length\) \{/, "the round's spend is not reserved, or is reserved when nothing was spent");
  assert.match(hook, /aRepairRound\.charged = Number\(await aCharge\(pageCredits\(\.\.\.aRepairRound\.usage\), 2\)\) \|\| 0;/, "the round's reserve is not sequence #2");
  // The hook answers a build only when the round produced one.
  // RE-ANCHORED 2026-09-05 (stage 8): the answer is held in `aSwap` and
  // returned LAST, because the schema apply now sits between the round and
  // the return and may answer a refusal instead — the property is that the
  // build the hook hands back is the round's, and only when the round built.
  // RE-ANCHORED 2026-10-25 (feature-verify): the requirement retry round's build first, else the repair round's.
  assert.match(hook, /const aSwap = aReqRetry && aReqRetry\.built \? \{ built: aReqRetry\.built, pages: aReqRetry\.pages \}\n\s+: aRepairRound\.ran && aRepairRound\.built \? \{ built: aRepairRound\.built, pages: aRepairRound\.pages \} : null;/);
  assert.ok(hook.includes("\n              return aSwap;\n            };"), "the hook's last answer is not the round's build");
  // The bill and the reply read the round.
  assert.match(route, /const aCharge = async \(bill, seq = 1\) => \{/, "the charge closure does not take the ledger sequence");
  assert.match(route, /p_seq: seq,/);
  assert.match(route, /const aRepairUsage = \(aRepairRound && Array\.isArray\(aRepairRound\.usage\)\) \? aRepairRound\.usage : \[\];/);
  // RE-ANCHORED 2026-09-04 (run 39): the translations' usage joined the one
  // synchronous collect (`...aLangUsage`) and their reserve joined the job
  // path's sum (`+ aLangCharged`). The property is that the round's usage is
  // on the collect and the round's charge is on the job's sum — whatever else
  // rides beside them.
  assert.match(route, // RE-ANCHORED 2026-09-17: the photographs joined this collect as a single
  // `{images: n}` term rather than a spread, so the tail is open. The property
  // is ONE `pageCredits` and ONE rounding, with the repair round's usage in it
  // — which is what this case is about — over everything the route spent.
  /if \(!aJob\) aCost = await aCharge\(pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, \.\.\.aRepairUsage(?:, (?:\.\.\.)?\w+)*\)\);/);
  assert.match(route, /else aCost \+= \(?Number\(aRepairRound && aRepairRound\.charged\) \|\| 0\)?(?: \+ \w+)*;/);
  assert.match(route, /renderNote: \[aPub\.renderNote, addRepairNote\(aRepairRound\)\]\.filter\(Boolean\)\.join\(" "\) \|\| undefined,/,
    "the customer is not told about a fix that was tried and did not hold, or one there was no time for");
  assert.match(route, /repair: aRepairRound \? \{/, "the reply does not carry the round");
});
