/**
 * WHAT A KNOWLEDGE SEARCH ANSWERED — the one reading, and the four nothings it keeps apart.
 *
 * ⚠ **THE DEFECT THIS FILE EXISTS FOR WAS A SENTENCE, SAID ABOUT THREE DIFFERENT FACTS.**
 * `agent.search_knowledge` answered `setof jsonb`, so "there was nothing searchable in the
 * ask", "this agent has no reference material at all" and "it has some and none of it
 * matched" arrived as one empty list — and MEASURED through the real step, a stopword-only
 * query and a genuine miss produced BYTE-IDENTICAL outcomes, both saying *searched for X and
 * found nothing*. Only the last of the three is a claim about somebody's documents.
 *
 * So the subject here is the READING, and it has two halves that fail differently: what an
 * answer's fields mean (`readSearch`, where cannot-tell must never read as a value) and which
 * of the four nothings a read is (`searchOutcome`, where the ORDER is the meaning). Three
 * modules ask them — the agent's tools, a workflow's `retrieve` seam, and the step that turns
 * the answer into a sentence a person reads — so a second reading anywhere is two accounts of
 * one fact that agree until one is edited.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readSearch, searchOutcome, SEARCH_OUTCOMES } from "../src/knowledge-search.mjs";

test("⚠ `readSearch` REFUSES rather than coercing, and folds the shape that predates it", () => {
  // THE ORDINARY ANSWER, whole.
  const read = readSearch({ ok: true, searched: true, sources: 2, excerpts: [{ title: "t" }] });
  assert.deepEqual(read, { excerpts: [{ title: "t" }], searched: true, sources: 2 });

  /**
   * ⚠ **A BARE ARRAY IS THE OLD SHAPE AND ITS PASSAGES ARE KEPT.** `agent.search_knowledge`
   * answered a set until the migration this reader ships with, so a call to a database that
   * has not had it yet comes back as a list. Dropping those would make a working search
   * answer nothing found, in silence, for as long as the two halves were apart — and the two
   * new facts are then honestly `null`, which reads `unknown` rather than as a miss.
   */
  assert.deepEqual(readSearch([{ title: "old" }]),
    { excerpts: [{ title: "old" }], searched: null, sources: null });
  assert.equal(searchOutcome(readSearch([{ title: "old" }])), "matched");

  /**
   * ⚠ **CANNOT-TELL MUST NEVER READ AS A VALUE, and the value it would be read as here is
   * "your documents do not match".** `Boolean("false")` is `true` and `Number("0")` is `0`, so
   * a string in either field is refused rather than believed — and every one of these shapes
   * is one a wire can really carry: an outage's error body, a fake, an older deployment.
   */
  for (const junk of [null, undefined, "nope", 7, true, {}, { excerpts: "no" },
                      { searched: "false", sources: 2, excerpts: [] },
                      { searched: true, sources: "0", excerpts: [] },
                      { searched: true, sources: -1, excerpts: [] },
                      { searched: true, sources: 1.5, excerpts: [] }]) {
    const r = readSearch(junk);
    assert.deepEqual(r.excerpts, [], `${JSON.stringify(junk)} produced passages`);
    assert.ok(r.searched === null || typeof r.searched === "boolean",
      `${JSON.stringify(junk)} answered a searched that is neither a boolean nor unread`);
    assert.ok(r.sources === null || Number.isInteger(r.sources),
      `${JSON.stringify(junk)} answered a count that is not one`);
  }
  // AND THE ONE THAT SEPARATES "refused" FROM "absent": a string flag is UNREAD, not false.
  assert.equal(readSearch({ searched: "false", sources: 2, excerpts: [] }).searched, null);
  assert.equal(readSearch({ searched: true, sources: "0", excerpts: [] }).sources, null);

  // IT IS IDEMPOTENT, which is what lets a tool read an INJECTED surface's answer through it
  // without that being a second reading: one function applied twice cannot disagree with
  // itself.
  const once = readSearch({ ok: true, searched: false, sources: 4, excerpts: [] });
  assert.deepEqual(readSearch(once), once);
});

test("⚠ THE FOUR NOTHINGS ARE FOUR, and the ORDER of the tests is the meaning", () => {
  const of = (a) => searchOutcome(readSearch(a));
  assert.equal(of({ searched: true, sources: 2, excerpts: [{ title: "t" }] }), "matched");
  assert.equal(of({ searched: true, sources: 3, excerpts: [] }), "no-match");
  assert.equal(of({ searched: true, sources: 0, excerpts: [] }), "no-sources");
  assert.equal(of({ searched: false, sources: 3, excerpts: [] }), "not-searched");
  assert.equal(of({ excerpts: [] }), "unknown");

  /**
   * ⚠ **PASSAGES FIRST, WHATEVER THE FLAGS SAY.** An answer carrying excerpts and
   * `searched: false` is self-contradictory, and the passages are the part a caller can use;
   * reading the flag there would throw away material the database really found.
   */
  assert.equal(of({ searched: false, sources: 0, excerpts: [{ title: "t" }] }), "matched");

  /**
   * ⚠ **AND `not-searched` BEFORE THE SOURCE COUNT**, because it is true however big the
   * library is. Reversed, somebody with no documents is told to fix their query and somebody
   * with a bad query is told to upload something — each sent to the wrong thing.
   */
  assert.equal(of({ searched: false, sources: 0, excerpts: [] }), "not-searched");

  // `unknown` IS REACHED BY FALLING THROUGH, so a half-read answer cannot become one of the
  // other four by accident. Driven over every shape where one of the two facts is missing.
  assert.equal(of({ searched: true, excerpts: [] }), "unknown");
  assert.equal(of({ sources: 5, excerpts: [] }), "unknown");
  assert.equal(searchOutcome(null), "unknown");
  assert.equal(searchOutcome({}), "unknown");
  assert.equal(searchOutcome("matched"), "unknown");

  // AND EVERY ANSWER IS ONE OF THE DECLARED FIVE, with the list a frozen census rather than a
  // set of strings somebody remembered to keep in step.
  assert.equal(Object.isFrozen(SEARCH_OUTCOMES), true);
  for (const a of [{ searched: true, sources: 1, excerpts: [] }, [], null, "x", { excerpts: [1] }]) {
    assert.ok(SEARCH_OUTCOMES.includes(searchOutcome(readSearch(a))),
      `${JSON.stringify(a)} answered an outcome nobody declared`);
  }
  assert.equal(new Set(SEARCH_OUTCOMES).size, SEARCH_OUTCOMES.length, "a name is listed twice");
});

/**
 * ⚠ **THE TWO DOORS AGREE ABOUT WHICH NOTHING IT WAS, AND WORD IT DIFFERENTLY ON PURPOSE.**
 *
 * The workflow's `knowledge` step and the agent's `search_reference` tool both turn a search
 * into a sentence, and the DECISION has to be one — two readings agree until one is edited, and
 * an agent telling a customer their documents do not mention something while their own
 * execution history says they have no documents is two accounts of one fact.
 *
 * **WHAT IS DELIBERATELY NOT SHARED IS THE WORDS.** One is read by a person looking at an
 * execution's history and the other by a model deciding what to do next, which is the same
 * division the engine's `description` and the site's `label` already take. So the census is the
 * PARTITION: both must split the same five shapes the same way, and neither may collapse two.
 */
test("⚠ THE STEP AND THE TOOL PARTITION THE SAME FIVE SHAPES THE SAME WAY", async () => {
  const { readWorkflow, runWorkflow } = await import("../src/automations.mjs");
  const { CAPABILITY_TOOLS } = await import("../src/capability-tools.mjs");
  const tool = CAPABILITY_TOOLS.find((t) => t.name === "search_reference");

  const SHAPES = [
    ["matched", { ok: true, searched: true, sources: 2, excerpts: [{ title: "Prices", version: 1, text: "£95" }] }],
    ["no-match", { ok: true, searched: true, sources: 3, excerpts: [] }],
    ["no-sources", { ok: true, searched: true, sources: 0, excerpts: [] }],
    ["not-searched", { ok: true, searched: false, sources: 3, excerpts: [] }],
    ["unknown", { excerpts: [] }],
  ];

  const steps = readWorkflow([{ type: "knowledge", query: "boiler", out: "facts" }], {}).steps;
  const fromStep = [];
  const fromTool = [];
  for (const [, answer] of SHAPES) {
    const r = await runWorkflow({
      steps, occurrence: "2026-09-16", retrieve: async () => answer,
    });
    fromStep.push(r.outcomes[0].why);
    // THE TOOL'S SURFACE IS THE ONE `makeCapabilities` HANDS OVER, so the tool is driven with
    // exactly what the store would have given it.
    const out = await tool.run({ query: "boiler" }, {
      capabilities: { searchKnowledge: async () => readSearch(answer) },
    });
    fromTool.push(out.say);
  }

  // NEITHER COLLAPSES TWO: five shapes, five sentences, on both doors.
  assert.equal(new Set(fromStep).size, SHAPES.length, "the step words two shapes the same");
  assert.equal(new Set(fromTool).size, SHAPES.length, "the tool words two shapes the same");

  /**
   * AND THE PARTITION IS THE SAME. Compared as the index of each sentence's first appearance,
   * so what is asserted is which shapes are grouped together — not the wording, which is each
   * door's own. The OBSERVER is alive because the shapes really do differ: a step that answered
   * one sentence for everything would fail the line above.
   */
  const shapeOf = (list) => list.map((w) => list.indexOf(w));
  assert.deepEqual(shapeOf(fromStep), shapeOf(fromTool),
    "the step and the tool disagree about which nothing a shape is");

  // AND THE WORDS REALLY ARE EACH THEIR OWN, which is what says the sharing is the DECISION
  // rather than the sentence — a tool answering the step's prose would satisfy the partition.
  assert.equal(fromStep.some((w, i) => w === fromTool[i]), false,
    "a door borrowed the other's sentence instead of writing for its own reader");
});
