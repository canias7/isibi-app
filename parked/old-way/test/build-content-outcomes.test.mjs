// PARKED (2026-11-03, park-old-way): the old-way half of test/build-content-outcomes.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// BUILD CONTENT, THE REST OF IT (2026-10-08, after Codex's review of
// `deb1fee5`): what the content-preservation batch's handoff named as still
// cut or still silent, each driven through the real code it passes through.
//
//   plan fields        purpose, sections, actions and picture descriptions
//                      were still sliced in `normalizePlan` — sections and
//                      actions at the 16,000 input budget (Codex's finding),
//                      purpose at 400, descriptions at 240. Now whole: they
//                      are the designer's own output, bounded by its ceiling.
//   descriptions       the build path cut a description again in the token,
//                      the alt text and the prompt; now whole end to end.
//   research facts     cut at 2,500 with nothing said; now whole (bounded by
//                      the research model's own rounds).
//   linked pages       4,000 characters a page, cut silently; now whole until
//                      one message's worth in all is used, with exact `kept`
//                      / `chars` facts and a sentence. Links past the opening
//                      bound (2, an abuse bound) are NAMED, not ignored; each
//                      link opened spends one of the quota.
//   pictures           the designer's pictures past what one build buys were
//                      never offered to a writer and never mentioned; now
//                      named with the rule that stopped them.
//   failed sections    a band whose writer failed was published as an empty
//                      part with nothing said (P2); now named, in the plan's
//                      own words, as a fact and a sentence.
//
// The two maximums the owner set stand: 1 page, 15 components.

import test from "node:test";
import assert from "node:assert/strict";
import { driveBuild, GOOD_DESIGN, BRIEF } from "../../../test/fixtures/build-route.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
import { normalizePlan, MAX_PAGES, MAX_COMPONENTS } from "../../../builder/site-plan.mjs";
import { imageDirective, imagesNotOffered, notOfferedWhy, pictureOutcomes, imageNote, planImages, shotKey, imagePrompt, budgetFor, IMAGE_CAP } from "../../../builder/site-images.mjs";
import { readLinkedPages, contextSummary, contextFacts, MAX_LINKED_CHARS, MAX_URLS } from "../../../builder/site-context.mjs";
import { buildReplyFacts } from "../../../builder/site-reply.mjs";
import { MAX_INPUT_CHARS } from "../../../builder/input-budget.mjs";
import { generateSiteBands, splitPlan, bandName } from "../../../builder/page-bands.mjs";
import { publishPages } from "../../../builder/publish-pages.mjs";
import { pageNotes, NOTE_FIELDS, buildFacts } from "../../../builder/build-answer.mjs";
import { buildBucket } from "../../../test/fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "../../../test/fixtures/build-lifecycle.mjs";
import { resultKey, readResult } from "../../../builder/build-job.mjs";

const words = (n, tail = ".") => ("Harbour Loaf bakes overnight sourdough by the harbour in Leeds. ".repeat(Math.ceil(n / 60))).slice(0, n - tail.length) + tail;

// ── linked pages ───────────────────────────────────────────────────────────

const html = (text) => "<html><head><title>T</title></head><body><p>" + text + "</p></body></html>";

test("THROUGH THE WORKER: a real queued build that asked for nine pictures, published by the real resume, offers all nine (no cap, 2026-10-24)", async () => {
  const b = buildBucket();
  const id = "c0ab2c3d4e5f60718293a4b5c6d7e8f9";
  const design = { ...GOOD_DESIGN, images: Array.from({ length: 9 }, (_, i) => ({ page: "/", describe: "picture " + (i + 1) })) };
  await fireInterim(b, id, ledger(), { design });
  await finishResume(b, id, ledger(), {
    credits: 400,
    source: 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: Page });\nfunction Page() { return <div>Harbour Loaf</div>; }',
  });
  const r = readResult(JSON.parse(b.store.get(resultKey(id))));
  const body = JSON.parse(r.body);
  assert.equal(body.page, "app", "the resumed build did not publish: " + r.body.slice(0, 300));
  assert.deepEqual((body.images.notOffered || []).map((x) => x.describe), []);
  // EVERY PICTURE ACCOUNTED FOR, AS FACTS: all nine offered, none placed by
  // the writer (the page has no picture), none cut by a cap.
  const st = body.buildFacts.pictures.map((x) => x.describe + ":" + x.status + (x.why ? "/" + x.why : ""));
  assert.deepEqual(st, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => "picture " + n + ":not-placed"));
  assert.doesNotMatch(String(body.imagesNote || ""), /picture 7/, "the fixed sentence still tells what the facts carry");
});

/** A minimal `publishPages` harness: everything succeeds, nothing is paid. */
function deps(over = {}) {
  return {
    generate: async () => null,
    compile: async () => ({ ok: true, files: { "index.html": { t: "<built>" } } }),
    publish: async () => {},
    readCredits: async () => 500,
    useCredits: async (n) => n,
    ...over,
  };
}
const PAGE = { path: "index.tsx", source: 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: Page });\nfunction Page() { return <div>Harbour Loaf</div>; }' };

// ── a section no writer could write (P2) ───────────────────────────────────

const band = (src) => ({ content: [{ type: "tool_use", input: { source: src } }], usage: {} });
