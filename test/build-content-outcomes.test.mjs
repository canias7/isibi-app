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
import { driveBuild, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { normalizePlan, MAX_PAGES, MAX_COMPONENTS } from "../builder/site-plan.mjs";
import { imageDirective, imagesNotOffered, notOfferedWhy, notOfferedNote, imageNote, planImages, shotKey, imagePrompt, budgetFor, IMAGE_CAP } from "../builder/site-images.mjs";
import { readLinkedPages, contextSummary, contextSentence, MAX_LINKED_CHARS, MAX_URLS } from "../builder/site-context.mjs";
import { MAX_INPUT_CHARS } from "../builder/input-budget.mjs";
import { generateSiteBands, splitPlan, bandName } from "../builder/page-bands.mjs";
import { publishPages, unwrittenNote } from "../builder/publish-pages.mjs";
import { pageNotes, NOTE_FIELDS } from "../builder/build-answer.mjs";
import { buildBucket } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { resultKey, readResult } from "../builder/build-job.mjs";

const words = (n, tail = ".") => ("Harbour Loaf bakes overnight sourdough by the harbour in Leeds. ".repeat(Math.ceil(n / 60))).slice(0, n - tail.length) + tail;

// ── plan fields ────────────────────────────────────────────────────────────

test("plan fields past every old cut — purpose 400, describe 240, and sections and actions past the 16,000 input budget (Codex's finding) — are kept whole; 1 page and 15 components stand", () => {
  const purpose = words(1200, " — and the last clause matters.");
  const section = words(MAX_INPUT_CHARS + 900, " — the band's own ending.");
  const action = words(MAX_INPUT_CHARS + 400, " — paid at the door.");
  const describe = words(1000, " with flour in the air.");
  const p = normalizePlan({
    ...GOOD_DESIGN, purpose,
    shape: [{ path: "/", sections: [section, "the footer"] }],
    action: [action],
    images: [{ page: "/", describe }],
    components: Array.from({ length: 30 }, (_, i) => "c" + i),
    pages: [{ path: "/", name: "Home" }, { path: "/more", name: "More" }],
  });
  assert.equal(p.purpose, purpose, "the purpose lost its tail");
  assert.equal(p.shape[0].sections[0], section, "a section past 16,000 lost its tail");
  assert.equal(p.action[0], action, "an action past 16,000 lost its tail");
  assert.equal(p.images[0].describe, describe, "a picture description was cut");
  assert.equal(p.pages.length, MAX_PAGES);
  assert.equal(p.components.length, MAX_COMPONENTS);
  assert.equal(MAX_PAGES, 1);
  assert.equal(MAX_COMPONENTS, 15);
});

test("a long picture description reaches the stored plan through the real build route, and stays whole in the token, the alt, the key and the prompt", async () => {
  const describe = words(900, " and a chalkboard of the day's loaves.");
  const r = await driveBuild({ design: { input: { ...GOOD_DESIGN, images: [{ page: "/", describe }] } }, body: { brief: BRIEF, images: [], qa: [], chat: "c" } });
  assert.ok(r.config, "no config was stored: " + JSON.stringify(r.reply).slice(0, 200));
  assert.equal(r.config.look.images[0].describe, describe, "the stored plan's description was cut");
  const dir = imageDirective({ buy: [{ page: "/", describe }], count: 1 });
  assert.ok(dir.includes("@@IMG:" + describe + "@@"), "the token the writer is handed was cut");
  const shot = planImages([{ path: "index.tsx", source: '<SafeImage src="@@IMG:' + describe + '@@" />' }], 1).shots[0];
  assert.equal(shot.prompt, describe);
  assert.equal(shotKey(shot.prompt), shotKey(describe));
  assert.ok(imagePrompt(describe).startsWith(describe));
});

// ── research facts ─────────────────────────────────────────────────────────

test("research facts past the old 2,500 are kept whole", async () => {
  const { siteWebResearch } = await loadWorkerModule();
  const facts = words(6000, " — open Sundays from nine.");
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 10, server_tool_use: { web_search_requests: 1 } },
    content: [{ type: "text", text: facts }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const out = await siteWebResearch({ ANTHROPIC_API_KEY: "k" }, "a bakery", ["harbour loaf opening hours"]);
    assert.equal(out.facts, facts, "the researched facts were cut");
  } finally { globalThis.fetch = real; }
});

// ── linked pages ───────────────────────────────────────────────────────────

const html = (text) => "<html><head><title>T</title></head><body><p>" + text + "</p></body></html>";

test("linked pages share one message's worth: the first whole, the second cut with exact facts, a link past the opening bound NAMED — and the customer is told all three", async () => {
  const a = words(5000, " — end of a.");
  const b = words(14000, " — end of b.");
  const pages = await readLinkedPages("copy https://a.example and https://b.example, and also https://c.example", {
    readUrl: async (u) => ({ ok: true, contentType: "text/html", body: html(u.includes("a.example") ? a : u.includes("b.example") ? b : "c") }),
  });
  assert.equal(MAX_LINKED_CHARS, MAX_INPUT_CHARS);
  const [pa, pb, pc] = pages;
  assert.equal(pa.ok, true);
  assert.equal(pa.text, a, "the first page was cut although the allowance had room");
  assert.equal(pa.kept, undefined);
  assert.equal(pb.ok, true);
  assert.equal(pb.text.length, MAX_LINKED_CHARS - a.length);
  assert.equal(pb.kept, MAX_LINKED_CHARS - a.length);
  assert.equal(pb.chars, b.length);
  assert.equal(pc.ok, false);
  assert.equal(pc.unopened, true);
  assert.match(pc.reason, new RegExp("at most " + MAX_URLS + " links"));
  const s = contextSummary({ pages });
  assert.deepEqual(s.read.map((x) => x.kept), [undefined, MAX_LINKED_CHARS - a.length]);
  const said = contextSentence(s);
  assert.match(said, /Used only the first 11,000 of 14,000 characters of b\.example/);
  assert.match(said, /Couldn't read c\.example — one build opens at most 2 links/);
});

test("a link the quota refuses is named with that reason — never read, never silent", async () => {
  const pages = await readLinkedPages("see https://a.example", { readUrl: async () => ({ ok: false, quota: true }) });
  assert.equal(pages[0].ok, false);
  assert.match(contextSentence(contextSummary({ pages })), /Couldn't read a\.example — you've had a lot of links read today/);
});

test("the real build route spends one of the link quota PER LINK OPENED", async () => {
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: { brief: BRIEF + " Like https://a.example and https://b.example.", images: [], qa: [], chat: "c" } });
  const quota = r.seen.rpc.filter((x) => x.fn === "use_quota" && x.args.p_kind === "sitelinks");
  assert.equal(quota.length, 2, "links were opened on one quota unit: " + quota.length);
  // CONTROL: no link, no quota spent on links.
  const none = await driveBuild({ design: { input: GOOD_DESIGN }, body: { brief: BRIEF, images: [], qa: [], chat: "c" } });
  assert.equal(none.seen.rpc.filter((x) => x.fn === "use_quota" && x.args.p_kind === "sitelinks").length, 0);
});

// ── pictures no writer was offered ─────────────────────────────────────────

test("pictures past what one build buys are named with their rule — the cap, a tool, a site that keeps its photographs — and the customer's own are never among them", () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ page: "/", describe: "picture " + (i + 1) }));
  const own = { page: "/", describe: "their shop", src: "/u/harbour-loaf/a.jpg", attached: "attachment-1" };
  const plan = normalizePlan({ ...GOOD_DESIGN, images: [own, ...nine] });
  const budget = budgetFor({ revise: false, priorPages: null, slug: "harbour-loaf", plan });
  assert.equal(budget, IMAGE_CAP);
  const left = imagesNotOffered(plan, budget, notOfferedWhy({ revise: false, priorPages: null, slug: "harbour-loaf", plan }));
  assert.deepEqual(left.map((x) => x.describe), ["picture 7", "picture 8", "picture 9"]);
  assert.ok(left.every((x) => x.why === "cap"));
  const said = imageNote({ made: 6, planned: 6, budget: 6, overflow: 0, notOffered: left });
  assert.match(said, /^Made 6 photographs for the site\./);
  assert.match(said, /3 more pictures were asked for than one build makes \(at most 6\): “picture 7”, “picture 8”, “picture 9”/);
  assert.equal(notOfferedWhy({ plan: { kind: "tool" } }), "tool");
  assert.match(notOfferedNote([{ describe: "a mug", why: "tool" }]), /A working tool gets no photographs, so “a mug” wasn't made/);
  assert.match(notOfferedNote([{ describe: "a loaf", why: "kept" }]), /already has its photographs, so I kept them rather than buying new ones for “a loaf”/);
  // CONTROL: within the budget, nothing is named and the sentence is unchanged.
  assert.deepEqual(imagesNotOffered(normalizePlan({ ...GOOD_DESIGN, images: nine.slice(0, 3) }), 3), []);
  assert.equal(imageNote({ made: 3, planned: 3, budget: 3, overflow: 0 }), "Made 3 photographs for the site.");
});

test("THROUGH THE WORKER: a real queued build that asked for nine pictures, published by the real resume, answers with the three past the cap named", async () => {
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
  assert.deepEqual(body.images.notOffered.map((x) => x.describe), ["picture 7", "picture 8", "picture 9"]);
  assert.match(body.imagesNote, /3 more pictures were asked for than one build makes \(at most 6\): “picture 7”, “picture 8”, “picture 9”/);
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

test("publishPages carries the not-offered pictures through to the answer's sentence", async () => {
  const notOffered = [{ page: "/", describe: "picture 7", why: "cap" }];
  const out = await publishPages(deps({
    generate: async () => ({ input: { pages: [PAGE], notes: "" }, usage: { in: 1, out: 1, cacheRead: 0, cacheWrite: 0 } }),
    images: async (pages) => ({ pages, made: 0, planned: 0, budget: 6, overflow: 0, notOffered }),
  }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.deepEqual(out.images.notOffered, notOffered);
  assert.match(pageNotes(out).imagesNote || "", /“picture 7”/);
});

// ── a section no writer could write (P2) ───────────────────────────────────

const band = (src) => ({ content: [{ type: "tool_use", input: { source: src } }], usage: {} });

test("P2: a band whose writer failed is published as an empty part AND named — in the plan's own words — as a fact and in the answer", async () => {
  const sections = ["a hero with the shop photograph", "the price list for every loaf, with Saturday collection times", "the footer"];
  const lines = splitPlan({ shape: [{ path: "/", sections }], route: "/", mode: "build" });
  const fan = await generateSiteBands({ brief: "b", spec: {}, brand: "Harbour Loaf", model: "grok-4.6", route: "/", chrome: { name: "Harbour Loaf" }, lines },
    {}, async () => [
      { i: 0, state: "done", answer: band("function " + bandName(lines[0], 0) + "() { return <h1>Harbour Loaf</h1>; }") },
      { i: 1, state: "failed", message: "the writer timed out" },
      { i: 2, state: "done", answer: band("function " + bandName(lines[2], 2) + "() { return <footer>Leeds</footer>; }") },
    ], null);
  assert.equal(fan.wrote, 2);
  const out = await publishPages(deps({ generate: async () => fan }), { spec: { tables: [] }, slug: "harbour-loaf" });
  assert.equal(out.page, "app", "the page with two written bands did not publish: " + JSON.stringify(out.problems));
  assert.deepEqual(out.unwritten.map((u) => u.section), [sections[1]]);
  const notes = pageNotes(out);
  assert.ok(NOTE_FIELDS.includes("unwrittenNote"));
  assert.match(notes.unwrittenNote || "", /One part of the page couldn't be written, so it's left out for now: “the price list for every loaf, with Saturday collection times”/);
  assert.equal(unwrittenNote([]), "");
});

test("P2 CONTROL: every band written — no fact, no sentence", async () => {
  const lines = splitPlan({ shape: [{ path: "/", sections: ["a hero", "the footer"] }], route: "/", mode: "build" });
  const fan = await generateSiteBands({ brief: "b", spec: {}, brand: "B", model: "grok-4.6", route: "/", chrome: { name: "B" }, lines },
    {}, async () => lines.map((l, i) => ({ i, state: "done", answer: band("function " + bandName(l, i) + "() { return <p>ok</p>; }") })), null);
  const out = await publishPages(deps({ generate: async () => fan }), { spec: { tables: [] }, slug: "b" });
  assert.equal(out.unwritten, undefined);
  assert.equal(pageNotes(out).unwrittenNote, undefined);
});
