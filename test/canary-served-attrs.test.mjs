// A QUOTED ATTRIBUTE HOLDING ">" IS NOT VISIBLE TEXT (2026-10-12, run 141).
// The opened Bake List page carried Tailwind's `[&[data-state=open]>svg]:rotate-180`
// in a button's class. `servedLines` stripped tags with `<[^>]+>`, which ends a
// tag at the first ">" even inside quotes, so `svg]:rotate-180 text-start"
// data-radix-collection-item="">` leaked into the question's line and the one
// added section read as two: a right page failed "exactly one section".
// Judged here on the run's own saved evidence
// (`docs/history/evidence/2026-10-12-run141/`), with controls: visible text
// keeps its ">" and "<", comments go, a wrong or missing answer still fails.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { servedLines, sectionChecks, openedSections, addedRuns, runText } from "../scripts/canary-requests.mjs";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";

const DIR = new URL("../docs/history/evidence/2026-10-12-run141/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8"));
const BEFORE = read("before.route_bake_list.open.json");
const AFTER = read("after.route_bake_list.open.json");
const WANT = UI_SCENARIOS["acc-isolation"].expect.sections.find((x) => x.route === "/bake-list");
const fails = (cs) => cs.filter((c) => !c.ok).map((c) => c.name + ": " + c.why);

test("ATTR 1 — run 141's saved evidence: the opened Bake List holds one added section, the question with its answer, and it passes every check", () => {
  assert.ok(WANT, "acc-isolation's /bake-list expectation is missing");
  assert.ok(/\[&amp;\[data-state=open\]>svg\]/.test(AFTER.html), "the evidence no longer carries the attribute that broke the reader");
  const o = openedSections(BEFORE, AFTER);
  assert.equal(o.ok, true, o.why);
  assert.deepEqual(o.sections, ["When is the list updated? Every Monday morning."]);
  assert.deepEqual(fails(sectionChecks("served", o.sections, WANT)), []);
});

test("ATTR 2 — no attribute text in any line of either saved page", () => {
  for (const [side, r] of [["before", BEFORE], ["after", AFTER]]) {
    const lines = servedLines(r.html);
    assert.ok(lines.length > 5, side + ": the reader read nothing");
    const leak = lines.filter((l) => /data-[a-z-]+=|class=|rotate-180|aria-[a-z]+=|="/.test(l));
    assert.deepEqual(leak, [], side + " leaked attribute text");
  }
});

test("ATTR 3 — quoted \">\" in double- and single-quoted attributes, on block and inline tags, ends no tag; visible \">\" and \"<\" stay; comments go", () => {
  const html = `<main>
    <div data-x="a>b" class="[&>svg]:x"><span title='5 > 3'>One</span></div>
    <p>Two &gt; one, and 1 &lt; 2</p><!-- a comment > with a bracket --><p>Three > two</p>
    <button class="[&[data-state=open]>svg]:rotate-180" aria-expanded="false">Ask<svg class="a>b"><path d="M1 1"/></svg></button>
  </main>`;
  assert.deepEqual(servedLines(html), ["One", "Two > one, and 1 < 2", "Three > two", "Ask"]);
});

test("ATTR 4 — controls on the same evidence: a wrong answer, a missing answer, and a second stating section still fail", () => {
  const swap = (from, to) => ({ ...AFTER, items: AFTER.items.map((x) => ({ ...x, answer: x.answer.replace(from, to) })) });
  const wrong = openedSections(BEFORE, swap("Monday", "Friday"));
  assert.ok(fails(sectionChecks("served", wrong.sections, WANT)).length > 0, "Friday passed for Monday");
  const missing = openedSections(BEFORE, { ...AFTER, items: AFTER.items.map((x) => ({ ...x, answer: "" })) });
  assert.ok(fails(sectionChecks("served", missing.sections, WANT)).length > 0, "a missing answer passed");
  const twice = AFTER.html.replace("</main>", "<section><p>The list is updated every Monday morning.</p></section></main>");
  const runs = addedRuns(servedLines(BEFORE.html), servedLines(twice)).map(runText);
  assert.ok(fails(sectionChecks("served", [...runs, "When is the list updated? Every Monday morning."], WANT)).length > 0, "two stating sections passed");
});
