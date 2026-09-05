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
import { keptProse, sameProse } from "../builder/site-tweak.mjs";
import { ADD_DESIGN_RULE, addDirective, foldAdds, rewroteMsg } from "../builder/site-add.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const addSrc = fs.readFileSync(new URL("../builder/site-add.mjs", import.meta.url), "utf8");

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

test("keptProse is the subset of sameProse: an addition passes, run 35's rewrite is refused by the words it lost, counts count", () => {
  const before = page(RUN22);
  // The real thing: a second band after the first, the first byte-identical.
  const second = page([...RUN22, "<h2>More from our students</h2>", ...RUN35]);
  assert.deepEqual(keptProse(before, second), { ok: true, lost: [] }, "a second band beside the first reads as a loss");
  assert.ok(!sameProse(before, second), "the fixture added nothing — sameProse would pass it too");
  // Run 35: the section kept, the quotes rewritten shorter under the same names.
  const rewrote = keptProse(before, page(RUN35));
  assert.equal(rewrote.ok, false, "run 35's rewrite passes as an addition");
  // The segments carry their quote marks — the extractor's reading, kept as is.
  assert.deepEqual(rewrote.lost.sort(), [
    "“First lesson I walked out able to change between E and A without looking down.”",
    "“Saturday morning slot. I was nervous and still left having played G major.”",
    "“We spent the hour on the open chords. I could hear when I was muting a string.”",
  ], "the lost quotes are not the ones named");
  // Reordered is kept; a segment the page had twice and now has once is lost once.
  assert.equal(keptProse(before, page([RUN22[2], RUN22[0], RUN22[1]])).ok, true, "a reordered page reads as a loss");
  const twice = page([RUN22[0], RUN22[0]]);
  assert.equal(keptProse(twice, page([RUN22[0]])).ok, false, "a quote carried twice and returned once is not a loss");
  assert.equal(keptProse(page([RUN22[0]]), twice).ok, true);
  assert.deepEqual(keptProse(before, before), { ok: true, lost: [] });
});

test("the rule rides both hops, and the component kind's hint, keep and directive all say a second one", () => {
  assert.match(ADD_DESIGN_RULE, /AN ADDITION IS ALWAYS A NEW THING/, "the design rule does not say an addition adds");
  assert.match(ADD_DESIGN_RULE, /in ADDITION to it, after it, as a second one/, "the rule does not say where the second one goes");
  assert.match(ADD_DESIGN_RULE, /left exactly as it is: not reworded, not restyled, not merged into the new one, not replaced/, "the rule does not say the first stays");
  // The first hop: the designers' system (a module-level constant, every kind's cached block) carries the rule.
  const system = between(addSrc, "const ADD_SYSTEM =", ";\n\n", "ADD_SYSTEM");
  assert.match(system, /ADD_DESIGN_RULE \+ "\\n\\n" \+/, "the designers' system does not carry the rule");
  const fold = foldAdds([{ kind: "component", value: [{ page: "/", where: "after the quotes", does: "More quotes", components: ["Testimonials"] }] }], {}, {});
  assert.ok(fold.directive.includes(ADD_DESIGN_RULE), "the page writer's directive does not carry the rule");
  const d = addDirective("component", { page: "/", where: "after the quotes", does: "More quotes", components: ["Testimonials"] }, {});
  assert.match(d, /If the page already has a component like this one, this is a SECOND one: put it after the existing one, and the existing one comes back byte-identical/, "the component directive does not place a second one");
  // The kind's hint (what the picker reads) and its `keep` (what the designer holds).
  assert.match(addSrc, /a section LIKE it already being on the page does not either: that is a SECOND one, added after the first, which stays exactly as it is/, "the component hint still lets a like section read as an edit");
  assert.match(addSrc, /answer the new one, placed after the one that is there, as a second one/, "the component keep does not say a second one");
});

test("rewroteMsg names the page and the words it would have lost, and says nothing was published", () => {
  const m = rewroteMsg([{ path: "index.tsx", lost: ["First lesson I walked out able to change between E and A without looking down.", "Saturday morning slot. I was nervous and still left having played G major.", "third"] }]);
  assert.match(m, /^I couldn't add that without changing what's already on the home page — it would have lost “First lesson I walked out able to change between E and A…” and “Saturday morning slot/);
  assert.match(m, /Nothing was published\. Ask again and I'll add it as a new section and leave the rest exactly as it is\.$/);
  assert.doesNotMatch(m, /third/, "more than two fragments are named");
  assert.match(rewroteMsg([{ path: "prices.tsx", lost: ["Lesson Prices"] }]), /already on \/prices — it would have lost “Lesson Prices”\./);
  assert.match(rewroteMsg([{ path: "index.tsx", lost: [] }]), /already on the home page\. Nothing was published/);
  assert.match(rewroteMsg([]), /already on the page\. Nothing was published/);
});

test("THE WALL: the addon route refuses a changed page that lost words — after the merge, before the gate and the bill, for nothing", () => {
  assert.match(worker, /import \{ runTweak, keptProse \} from "\.\/builder\/site-tweak\.mjs";/, "keptProse is not the tweak rung's own reading");
  assert.match(worker, /import \{[^}]*\brewroteMsg\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "the sentence is not the add step's own");
  const route = between(worker, "const aMerge = mergeAddonPages(aSrc, aValid.pages, aRemove);", 'const aGatePub = aJob ? aJob.gate("build") : null;', "the addon's merge-to-gate stretch");
  const wall = between(route, "const aWas = new Map(", "// ── MAY THIS STILL PUBLISH?", "the wall");
  // After every merge refusal and escalate, before the gate and the bill.
  assert.ok(route.indexOf("if (!aMerge.ok) return aEscalate(aMerge.reason") < route.indexOf("const aWas = new Map("), "the wall runs before the merge is judged");
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
  assert.match(wall, /if \(aLost\.length\) \{\s*\n\s*return Response\.json\(\{ ok: false, error: "rewrote", cost: 0, lost: aLost, msg: rewroteMsg\(aLost\) \}, \{ status: 422 \}\);/, "a lost page is not refused as `rewrote`, free, with the sentence");
  // The browser prints a refusal's `msg` as the answer (the `declined`/`already` path).
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /if \(a\.msg\) \{ o\.finish\('⚠️ ' \+ a\.msg\); return; \}/, "a refusal's sentence does not reach the customer");
});
