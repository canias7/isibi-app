// THE REPAIR PASS ON THE PUBLISH SPINE (owner, 2026-09-04: "try to fix it,
// if not fix, send as it is").
//
// Run 34's gear addon published a page the render check had just watched
// crash. The BUILD repairs on that report (`publishPages`, `deps.repair`); the
// addon publishes through `recompileAndPublish`, which had no such hop — its
// reason for the EDIT lanes ("re-checking pages the customer just changed by
// hand") was written before an addon existed. The decision is `repairRound`,
// driven in test/site-repair.test.mjs; THIS file reads the wiring — the hop the
// wiring trap has cut twelve times — from landmark to landmark, never by byte.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

const spine = between(worker, "async function recompileAndPublish(", "async function siteOgImage(", "the spine");

test("the spine takes a `repair` and asks the round between the compile's verdict and the first write", () => {
  assert.match(worker, /import \{ repairRound, repairRoundNote \} from "\.\/builder\/site-repair\.mjs";/, "the round is not imported");
  assert.match(spine.slice(0, 400), /repair = null \}\) \{/, "the spine does not take a repair, defaulting to none");
  const hop = between(spine, "let repairOut = null;", "// THE SAME META A BUILD PUBLISHES", "the repair hop");
  // AFTER the compile verdict and the dead-css refusal — a build that did not
  // compile has nothing to repair and a refused stylesheet publishes nothing.
  const verdict = spine.indexOf("if (!built || built.ok !== true || !built.files)");
  const deadCss = spine.indexOf('error: "dead-css"');
  const hopAt = spine.indexOf("let repairOut = null;");
  assert.ok(verdict > 0 && deadCss > verdict && hopAt > deadCss, "the hop runs before the compile is judged, or before a dead stylesheet is refused");
  // BEFORE the gate and the first write, so the second build is what is
  // written, archived, stored and uploaded.
  const gate = spine.indexOf('editRpc(env, "edit_may_publish"');
  const write = spine.indexOf("await writeSiteDistToR2(");
  assert.ok(gate > hopAt && write > gate, "the hop runs after the publish gate or after the dist write — the repaired build would not be the one shipped");
  // Gated on a repair being handed in, with a function to send.
  assert.match(hop, /if \(repair && typeof repair\.send === "function"\) \{/, "the hop is not gated on a repair with a send");
  // The clock is asked of the budget BEFORE anything is spent — and true with no job.
  assert.match(hop, /const room = !\(job && job\.budget && typeof job\.budget\.canRepair === "function"\) \|\| job\.budget\.canRepair\(\);/,
    "the room is not the budget's canRepair, or is not true without a job");
  // The round gets the report, the pages, the send, the model, the room, the
  // site's language prefixes, and a compile of the corrected list.
  const call = between(hop, "repairOut = await repairRound({", "});", "the round call");
  for (const needle of ["report: built.render", "pages,", "send: repair.send", "model: repair.model", "room,",
    "prefixes: siteLangs.filter((l) => !l.primary).map((l) => l.prefix)",
    "compile: async (list) => { files = filesFor(list); return compile(); }"]) {
    assert.ok(call.includes(needle), `the round is not handed: ${needle}`);
  }
  // A fix that held replaces BOTH what ships and what is stored.
  assert.match(hop, /if \(repairOut\.ran && repairOut\.built\) \{ built = repairOut\.built; pages = repairOut\.pages; \}/,
    "a repaired build does not replace both `built` and `pages`");
  // Its spend is charged when the caller can, only when there was any.
  assert.match(hop, /if \(typeof repair\.charge === "function" && repairOut\.usage\.length\) \{/, "the round's usage is not charged, or a round that spent nothing is");
  assert.match(hop, /repairOut\.charged = Number\(await repair\.charge\(repairOut\.usage\)\) \|\| 0;/);
  // And the answer rides out.
  assert.match(spine, /repair: repairOut \? \{/, "the spine's answer does not carry the round");
  assert.match(between(spine, "repair: repairOut ? {", "} : undefined,", "the repair field"), /usage: repairOut\.usage\.length \? repairOut\.usage : undefined, charged: repairOut\.charged/);
});

test("the files are ONE assembly, used by the first compile and by the round's second", () => {
  const assemble = between(spine, "const filesFor = (list) => {", "files = filesFor(pages);", "filesFor");
  assert.match(assemble, /for \(const p of list \|\| \[\]\) f\[p\.path\] = p\.source;/, "the primary pages are not in the assembly");
  assert.match(assemble, /translatePages\(list \|\| \[\], l\.prefix, strings,/, "the variants are not in the assembly");
  // The loop above fills the cache and no longer assembles — one list, not two.
  const loop = between(spine, "for (const l of siteLangs) {", "const filesFor = (list) => {", "the translation loop");
  assert.doesNotMatch(loop, /files\[/, "the loop still writes files — two assemblies of the same thing");
  assert.match(spine, /\n  let files = \{\};/, "`files` must be reassignable for the second compile");
  assert.ok(spine.indexOf("files = filesFor(pages);") < spine.indexOf("let built = await compile();"), "the first compile runs before the files are assembled");
});

test("ONLY the addon route hands the spine a repair; the edit lanes and the rebuild drain are what they were", () => {
  const sites = [...worker.matchAll(/(?:recompileAndPublish|publishSpine)\(env, \{/g)].map((m) => m.index);
  assert.ok(sites.length >= 5, `expected the spine's call sites, found ${sites.length}`);
  const withRepair = [];
  for (const at of sites) {
    // Each call's arguments run to its own `});` — the repair object inside
    // the addon's call closes with `},` and never `});`.
    const args = worker.slice(at, worker.indexOf("});", at) + 3);
    if (/\brepair: \{/.test(args)) withRepair.push(at);
  }
  assert.equal(withRepair.length, 1, `${withRepair.length} call sites hand the spine a repair — the edit lanes re-check pages the customer changed by hand`);
  const addon = worker.slice(withRepair[0], worker.indexOf("});", withRepair[0]));
  assert.match(addon, /slug: ownerSlug, pages: aMerge\.pages,/, "the one call site with a repair is not the addon's publish");
  assert.match(addon, /send: aQuick\("repair"\), model: aModels\.quick,/, "the repair does not ride the job's clock on the picked model");
  assert.match(addon, /charge: aJob \? async \(usage\) => aCharge\(pageCredits\(\.\.\.usage\), 2\) : null,/, "under a job the round's spend is not reserve #2; synchronously it must be null");
});

test("the addon bills the round and tells the customer what it did", () => {
  const route = between(worker, "const aCharge = async (bill", "if (tx) {", "the addon's publish tail");
  assert.match(route, /const aCharge = async \(bill, seq = 1\) => \{/, "the charge closure does not take the ledger sequence");
  assert.match(route, /p_seq: seq,/, "the sequence is not what reaches the ledger");
  // Synchronously the round's usage joins the ONE collect; under a job what
  // the ledger charged for #2 is added.
  assert.match(route, /const aRepairUsage = \(aPub\.repair && Array\.isArray\(aPub\.repair\.usage\)\) \? aPub\.repair\.usage : \[\];/);
  assert.match(route, /if \(!aJob\) aCost = await aCharge\(pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, \.\.\.aRepairUsage\)\);/);
  assert.match(route, /else aCost \+= Number\(aPub\.repair && aPub\.repair\.charged\) \|\| 0;/);
  // The reply's render sentence is the final build's plus the round's own,
  // and the round rides beside it for the harness.
  assert.match(route, /renderNote: \[aPub\.renderNote, repairRoundNote\(aPub\.repair\)\]\.filter\(Boolean\)\.join\(" "\) \|\| undefined,/,
    "the customer is not told about a fix that was tried and did not hold, or one there was no time for");
  assert.match(route, /repair: aPub\.repair \? \{/, "the reply does not carry the round");
});
