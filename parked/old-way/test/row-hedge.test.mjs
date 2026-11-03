// PARKED (2026-11-03, park-old-way): the old-way half of test/row-hedge.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { designedNothing, featureBrief } from "../../../builder/addon-existing.mjs";
import { requirementReport, toldNote, presentOnly } from "../../../builder/site-requirements.mjs";
import { existingFacts } from "../../../builder/site-add.mjs";
import { platform, sendMessage, settle, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";

blockNetwork();

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const at = (src, s, from = 0) => { const i = src.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };

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
