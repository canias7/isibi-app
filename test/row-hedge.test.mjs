// The Lessons booking that became a row, and the replies that hedged what
// was seen (2026-10-25, row-hedge). Live on driftwood-and-daughters-5 at
// a63451c3a (04:27–04:36 UTC):
//  1. The Lessons part routed `feature-on-page` (/lessons) correctly; the
//     picker chose row + component; the component designer answered an EMPTY
//     design and handed every need to the page step. The "designed nothing"
//     retry read only `undefined`, so it never ran; the cleaner refused the
//     empty list (`nothing`) and the job failed. The lesson list, set aside
//     as a part of its own, then ran alone as rows (dc143ad0): no booking.
//  2. "Your site already had that in place, but I can't confirm…" for needs
//     every carrier of which (pages, tables) was found on the site, and
//     "…couldn't read the built page…" for a page the render check opened on
//     phone, because text was read on desktop only and the check was cut.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { designedNothing, featureBrief } from "../builder/addon-existing.mjs";
import { requirementReport, toldNote, presentOnly } from "../builder/site-requirements.mjs";
import { existingFacts } from "../builder/site-add.mjs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const at = (src, s, from = 0) => { const i = src.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };

test("an empty design is nothing, as an absent one is", () => {
  for (const v of [undefined, null, [], [null], ["x"], [[]]]) assert.equal(designedNothing(v), true, JSON.stringify(v));
  for (const v of [[{ page: "/lessons" }], { page: "/lessons" }, [null, { a: 1 }]]) assert.equal(designedNothing(v), false, JSON.stringify(v));
});

test("the component designer is told a feature on an existing page is its own to build", () => {
  const hand = { from: "route", reason: "feature-on-page", field: "component", page: "/lessons" };
  const b = featureBrief(hand, "component");
  assert.match(b, /\/lessons/);
  assert.match(b, /do not hand it to the page step/);
  assert.equal(featureBrief(hand, "table"), "");
  assert.equal(featureBrief({ ...hand, reason: "page-asked" }, "component"), "");
  assert.equal(featureBrief({ ...hand, page: "" }, "component"), "");
  assert.equal(featureBrief(null, "component"), "");
});

test("the worker retries an empty design and tells the designer the hand-over", () => {
  const empty = at(W, 'const aEmptyFeature = aFeature && k === "component" && designedNothing(ran && ran.value);');
  const retry = at(W, "if (!aPrior && ran && !ran.failed && !ran.ask && (ran.value === undefined || aEmptyFeature)) {", empty);
  at(W, "aDeclineFeedback", retry);
  assert.ok(at(W, 'const aFeature = !!(aHand && aHand.reason === "feature-on-page" && aOnPage);') < empty, "aFeature is read before it is set");
  at(W, "const aBrief = aBriefHanded + aHeldShown(k) + featureBrief(aHand, k);");
  at(W, "const brief = requirementBrief(aReq.filter((r) => r.judged), j) + aHeldShown(j) + featureBrief(aHand, j);");
  at(W, "designedNothing, featureBrief } from \"./builder/addon-existing.mjs\"");
});

const there = (need, by) => ({ need, status: "elsewhere", step: "page", basis: "asked", from: "component", id: need,
  judged: { follows: "asked", carried: "yes", by, reason: "r" } });

test("a need carried only by pages and tables seen on the site is said plainly", () => {
  assert.deepEqual(presentOnly({ implementation: "found", judged: { by: ["page:/cafe", "table:menu_items"] } }), ["page:/cafe", "table:menu_items"]);
  assert.equal(presentOnly({ implementation: "found", judged: { by: ["function:notify_owner"] } }), null);
  assert.equal(presentOnly({ implementation: "found", judged: { by: ["page:/cafe", "job:x"] } }), null);
  assert.equal(presentOnly({ implementation: "unknown", judged: { by: ["page:/cafe"] } }), null);
  assert.equal(presentOnly({ implementation: "found", judged: { by: [] } }), null);
  // A table alone is not a thing seen: "each enquiry is emailed" stays hedged.
  assert.equal(presentOnly({ implementation: "found", judged: { by: ["table:enquiries"] } }), null);
  // The real producers: the site's stored facts, and judged entries.
  const existing = existingFacts({ spec: { tables: [{ name: "menu_items", access: "display", columns: [{ name: "name" }, { name: "price" }] }, { name: "enquiries", access: "collect", columns: [{ name: "message" }] }] }, pages: ["/cafe", "/gallery"] });
  const list = [there("A Gallery page of its own", ["page:/gallery"]), there("A Cafe menu the owner can edit", ["page:/cafe", "table:menu_items"]),
    there("Each enquiry is emailed to the owner", ["table:enquiries"])];
  const r = requirementReport(list, { existing, judged: true });
  const by = Object.fromEntries(r.told.map((o) => [o.need, o]));
  const note = toldNote(r.told);
  for (const n of ["A Gallery page of its own", "A Cafe menu the owner can edit"]) {
    assert.ok(by[n], "not told: " + n + " in " + JSON.stringify(r.told));
    assert.equal(by[n].told, "already-there");
    assert.equal(by[n].present, true, n);
    assert.ok(!note.includes("confirm from here that " + n), note);
  }
  assert.match(note, /Your site already had that in place: A Gallery page of its own; A Cafe menu the owner can edit\./);
  const fn = by["Each enquiry is emailed to the owner"];
  assert.ok(fn, "behaviour not told");
  assert.notEqual(fn.present, true);
  assert.match(note, /can't confirm from here that Each enquiry is emailed/);
});

test("toldNote says present needs plainly and keeps the hedge for the rest", () => {
  const note = toldNote([{ need: "A Gallery page", told: "already-there", state: "unverified", present: true, carriers: ["page:/gallery"] },
    { need: "Owner emailed", told: "already-there", state: "unverified" }]);
  assert.match(note, /^Your site already had that in place: A Gallery page\./);
  assert.match(note, /but I can't confirm from here that Owner emailed/);
  assert.ok(!/confirm from here that A Gallery page/.test(note));
});

test("the render check reads each page's text on every viewport, phone as incomplete", () => {
  const R = readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  const desk = at(R, 'if (vp.name === "desktop") {');
  const marks = at(R, "landmarkProbe, { route, cap: MAX_LANDMARKS }", desk);
  const close = at(R, "}", at(R, "catch (e) { /* a map is a bonus", marks));
  const probe = at(R, "page.evaluate(textProbe", close);
  assert.ok(probe > close, "the text read is still inside the desktop-only block");
  const tail = R.slice(probe, at(R, "catch (e) { /* text is evidence", probe));
  assert.match(tail, /complete: vp\.name === "desktop" && t\.complete === true/);
  assert.match(tail, /else if \(vp\.name === "desktop"\) texts\[at\] = entry;/);
});

// ── THE ROUTE, END TO END, WITH SUPPLIED ANSWERS ─────────────────────────────
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
const W_FAQ = "add a questions section to the About page";
const FAQ_ON = (page) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }] });
async function run(route, first) {
  const compiler = installCompiler();
  const seen = [];
  const P = platform({
    slug: "rh-" + Math.random().toString(16).slice(2, 8), pages: PAGES, replies: true, balance: 400,
    answers: {
      route,
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": async (req) => { seen.push(JSON.stringify(req || "")); return seen.length === 1 ? first : FAQ_ON("/about"); },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + W_FAQ + "." });
    const { rec } = await settle(P, r.key);
    await P.settle();
    return { rec, seen };
  } finally { P.close(); compiler.uninstall(); }
}

test("a feature on an existing page whose component designer answers an empty design is asked once more, told the hand-over, and built", { timeout: 60000 }, async () => {
  const feature = { intent: "addon", targets: [{ change: 0, writes: ["page:/about", "new-component:faq"], reads: [] }] };
  const { rec, seen } = await run(feature, { component: [] });
  const parts = JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
  assert.equal(seen.length, 2, "the empty design was not asked again: " + parts);
  assert.ok(seen[0].includes("do not hand it to the page step"), "the designer was not told the hand-over");
  assert.equal(rec.parts[0].status, "done", parts);
});

test("without that hand-over an empty design stays the model's own decline (one call)", { timeout: 60000 }, async () => {
  const { seen } = await run({ intent: "addon" }, { component: [] });
  assert.equal(seen.length, 1);
});
