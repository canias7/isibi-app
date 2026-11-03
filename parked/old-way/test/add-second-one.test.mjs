// PARKED (2026-11-03, park-old-way): the old-way half of test/add-second-one.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A SECOND ONE (owner, 2026-09-04: "add a second one").
//
// Run 35 asked the ADD step for a testimonials section fretwork-1 already
// carried, and the page came back with the section kept and its three quotes
// rewritten shorter under the same names — `changed`, `ok`, the customer's
// own words gone. The owner's answer: an ask for a section the site has adds a
// SECOND one, and the first is left exactly as it is.
//
// Three places carry it, and this file reads all three: the rule on BOTH hops
// (the designers' system, the page writer's directive) with the component
// kind's own hint, `keep` and directive; the wall in the addon route — every
// page the addition CHANGED still says every word it said, by the tweak rung's
// reading, refused before the gate and the bill when it does not; and the
// harness's check, which now reads what was lost, not only what was added.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { keptProse, sameProse } from "../../../builder/site-tweak.mjs";
import { ADD_DESIGN_RULE, addDirective, foldAdds, rewroteMsg } from "../../../builder/site-add.mjs";
// The browser's own add-on reader, executed — never a second copy of its sentence.
import { browserReply } from "../../../scripts/addon-sweep.mjs";

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const addSrc = fs.readFileSync(new URL("../../../builder/site-add.mjs", import.meta.url), "utf8");

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

// Run 22's section and run 35's rewrite of it, as the pages carried them.
const quote = (text, initials, name) =>
  `<figure><blockquote>“${text}”</blockquote><figcaption><span>${initials}</span> ${name} <span>Beginner</span></figcaption></figure>`;
const RUN22 = [
  quote("First lesson I walked out able to change between E and A without looking down.", "SH", "Sam H."),
  quote("We spent the hour on the open chords. I could hear when I was muting a string.", "PN", "Priya N."),
  quote("Saturday morning slot. I was nervous and still left having played G major.", "JP", "Jordan P."),
];
const RUN35 = [
  quote("Couldn’t hold a pick last month — now I play three chords.", "SH", "Sam H."),
  quote("First lesson and the fretboard stopped looking like a puzzle.", "PN", "Priya N."),
  quote("Two weeks from zero and I played a song for my mum.", "JP", "Jordan P."),
];
const page = (bands) =>
  `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: P });\n` +
  `function P() { return <main><h1>Book a guitar lesson</h1><p>Ring us on 0114 496 0123 to book.</p><section>${bands.join("")}</section></main>; }\n`;

test("THE WALL: the addon route refuses a changed page that lost words — after the merge, before the gate and the bill, for nothing", () => {
  // RE-ANCHORED 2026-09-29: the same import gained `tweakParser`, the page
  // reader the picture step takes a photograph off with. The claim is WHERE
  // `keptProse` comes from, never how the import list is spelled.
  assert.match(worker, /import \{[^}]*\bkeptProse\b[^}]*\} from "\.\/builder\/site-tweak\.mjs";/, "keptProse is not the tweak rung's own reading");
  assert.match(worker, /import \{[^}]*\brewroteMsg\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "the sentence is not the add step's own");
  // RE-ANCHORED 2026-09-17, TWICE. First `const` became `let` (a dead QR code
  // withholds a page and the route RE-MERGES what survives); then the merge
  // gained an honest fourth argument and this went red again on a change it is
  // not about. THE LANDMARK IS THE ASSIGNMENT — this is a window OPENER and an
  // argument list was never part of its claim. The stretch it names is unchanged
  // by both. Recorded: "assert the property, not the spelling".
  const route = between(worker, "aMerge = mergeAddonPages(", 'const aGatePub = aJob ? aJob.gate("build") : null;', "the addon's merge-to-gate stretch");
  const wall = between(route, "const aWas = new Map(", "// ── MAY THIS STILL PUBLISH?", "the wall");
  // After every merge refusal, before the gate and the bill.
  // RE-ANCHORED 2026-10-06: through the route's failure door (`aFail`).
  assert.ok(route.indexOf("if (!aMerge.ok) return aFail(addonFailure(aMerge.reason") > 0, "the merge decision is missing");
  assert.ok(route.indexOf("if (!aMerge.ok) return aFail(addonFailure(aMerge.reason") < route.indexOf("const aWas = new Map("), "the wall runs before the merge is judged");
  assert.ok(worker.indexOf("const aWas = new Map(") < worker.indexOf('const aGatePub = aJob ? aJob.gate("build") : null;'), "the wall runs after the gate");
  // RE-ANCHORED 2026-09-05 (stage 1a-ii): the page bill's line reads
  // `aCost = aFirstPlaced ? aFirst + await aCharge(aBill, 4) : await aCharge(aBill)`
  // now. Under a job a BACKEND addon reserves its design and seed usage as
  // sequence #1 BEFORE the DDL — which is before the page call, and so before
  // this wall — and the consumer's refund returns #1 on any refusal, so a
  // refused page is still charged nothing. What this line keeps is that the
  // PAGE bill (#4 under a job; the collect on the synchronous path, later
  // still) sits after the wall.
  const pageBill = worker.indexOf("if (aJob) aCost = aFirstPlaced ? aFirst + await aCharge(aBill, 4) : await aCharge(aBill);");
  assert.ok(pageBill > 0, "the page bill's line moved again — re-anchor, and say why");
  assert.ok(worker.indexOf("const aWas = new Map(") < pageBill, "the wall runs after the bill — a refused page would be charged");
  // The pages it reads: the ones the addition CHANGED, against what the site stored — never the ones it added.
  assert.match(wall, /\(aSrc \|\| \[\]\)\.filter\(\(p\) => p && typeof p\.path === "string"\)\.map\(\(p\) => \[p\.path, String\(p\.source \|\| ""\)\]\)/, "the before is not the stored source");
  assert.match(wall, /for \(const p of aMerge\.pages \|\| \[\]\) \{\s*\n\s*if \(!p \|\| !aMerge\.changed\.includes\(p\.path\) \|\| !aWas\.has\(p\.path\)\) continue;/, "the wall does not read exactly the changed pages");
  assert.doesNotMatch(wall, /aMerge\.added/, "a page the addition ADDED has no before to keep");
  assert.match(wall, /const kept = keptProse\(aWas\.get\(p\.path\), p\.source\);\s*\n\s*if \(!kept\.ok\) aLost\.push\(\{ path: p\.path, lost: kept\.lost\.slice\(0, 3\) \}\);/);
  // Said in the trace, refused by name, for nothing, with the sentence.
  assert.match(wall, /aMark\("kept", aLost\.length \? "fail" : "ok",/, "the wall leaves no trace");
  // RE-ANCHORED 2026-10-06: the same refusal through the route's failure door
  // (`aFail`), which adds what it left behind — nothing, here.
  assert.match(wall, /if \(aLost\.length\) \{\s*\n\s*return aFail\(\{ ok: false, error: "rewrote", cost: 0, lost: aLost, msg: rewroteMsg\(aLost\) \}, 422\);/, "a lost page is not refused as `rewrote`, free, with the sentence");
  // The browser prints a refusal's `msg` as the answer (the `declined`/`already`
  // path). RE-ANCHORED 2026-09-24 from the spelling `if (a.msg) { … }` — which
  // went red when the check learned to refuse a sentence that is not a string —
  // to the property, DRIVEN: this refusal's own reply, through the browser's own
  // reader, is its sentence behind a warning, and it buys nothing.
  const msg = rewroteMsg([{ path: "index.tsx", lost: ["Open daily"] }]);
  const seen = browserReply({ ok: false, error: "rewrote", cost: 0, msg }, false);
  assert.equal(seen.ok, true, "the browser's own reader could not run: " + seen.why);
  assert.equal(seen.text, msg, "a refusal's sentence does not reach the customer");
  assert.deepEqual(seen.actions, [], "a refusal with its sentence bought something");
});
