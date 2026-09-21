// ENFORCEMENT AGAINST DISPLAY, IN THE ROUTER'S OWN WORDS.
//
// ⚠ WHAT THIS FILE CAN AND CANNOT ESTABLISH, first, because the distinction is
// the whole reason it is written this way.
//
// It asserts a property of the INSTRUCTIONS THIS REPOSITORY SHIPS: that the
// router's tool description draws the line, draws it from both sides, and no
// longer carries the broad preference that sent run 12 to the wrong rung.
//
// It does NOT establish how a real model routes any sentence. Nothing here
// calls a model, and a stubbed answer would be a fixture agreeing with itself —
// this repo's own recorded trap, and the most tempting one available in a file
// about routing. Which layer `grok-4.6` picks for a given message is settled by
// a live run and by nothing else.
//
// ── WHAT WENT WRONG (run 12, 2026-09-21, `fretwork-1`) ─────────────────────
//
// The `rules` description ended: *"so prefer it whenever the change is honestly
// about behaviour rather than appearance"*. That is false in a way that is easy
// to read past — a component on a page has BEHAVIOUR too. It counts, it
// subtracts, it decides what to say when a number is zero, and every one of
// those is a change to a file a page writer edits rather than to anything
// Postgres enforces.
//
// So a request to change what a stored component DISPLAYS from a count it
// already receives went to the database rung, met a site whose backend
// reference was missing, and stopped the whole message for 2 credits with
// nothing published.
//
// ── AND THE LINE IS NOT A WORD LIST ────────────────────────────────────────
//
// "Bookings", "capacity", "places", "slots" and "limit" occur on BOTH sides of
// it. A router that matched on them would route a display change into the
// database exactly as run 12 did, which is why the wording says to ignore them
// and the census below asserts that both example sets really do share them.

import test from "node:test";
import assert from "node:assert/strict";
import { ASK_TOOL, EDIT_LAYERS } from "../builder/site-ask.mjs";

/**
 * The `layer` property's description, as the model really receives it.
 *
 * READ OFF THE EVALUATED TOOL, never off the source file. The description is
 * assembled from a dozen concatenated strings, so a source scan is a claim
 * about how those strings are spelled and this is a claim about what arrives.
 */
function layerText() {
  const schema = ASK_TOOL && (ASK_TOOL.input_schema || ASK_TOOL.parameters);
  assert.ok(schema && schema.properties && schema.properties.layer,
    "the router tool has no `layer` property — this file's subject is gone");
  const d = schema.properties.layer.description;
  assert.equal(typeof d, "string", "the layer description is not a string");
  assert.ok(d.length > 2000, "the layer description came out too small to assert over: " + d.length);
  return d;
}

/**
 * ONE LAYER'S OWN PARAGRAPHS, landmark to landmark.
 *
 * The descriptions run one after another inside a single string, so a claim
 * about what the `rules` paragraph says has to be scoped to it — otherwise a
 * sentence added under `page` satisfies an assertion about `rules` and the two
 * become indistinguishable. Both landmarks are asserted: `indexOf` answering
 * -1 gives `slice(-1, -1)` = `""`, which passes everything inside it.
 */
function layerBlock(name) {
  const d = layerText();
  const open = '"' + name + '" —';
  const at = d.indexOf(open);
  assert.ok(at >= 0, "the layer `" + name + "` has no description at all");
  // CLOSED ON THE NEXT LAYER THAT REALLY FOLLOWS, derived from the enum rather
  // than from a neighbour typed here — a reordering would otherwise silently
  // widen or empty the window.
  let end = d.length;
  for (const other of EDIT_LAYERS) {
    if (other === name) continue;
    const o = d.indexOf('"' + other + '" —', at + open.length);
    if (o > at && o < end) end = o;
  }
  const block = d.slice(at, end);
  assert.ok(block.length > 200, "the `" + name + "` block came out too small: " + block.length);
  return block;
}

test("the broad behaviour-over-appearance preference is gone", () => {
  // ⚠ THE DEFECT ITSELF, asserted as an ABSENCE — so the observer is proved
  // alive first, or this passes for a description that came out empty.
  const rules = layerBlock("rules");
  assert.match(rules, /WHAT THE SITE DOES WITH WHAT PEOPLE SUBMIT/,
    "the `rules` block is not the one this case means to read");
  assert.doesNotMatch(rules, /prefer it whenever the change is honestly about behaviour rather than appearance/i,
    "the broad preference that sent run 12 to the database rung is back");
  // AND THE WEAKER FORM OF THE SAME CLAIM. A rewording that keeps the
  // preference is the same defect wearing different words, so the property is
  // that this block does not tell the router to PREFER it on those grounds.
  assert.doesNotMatch(rules, /prefer it whenever[\s\S]{0,80}behaviour rather than appearance/i,
    "the preference survives in a reworded form");
});

test("the line is stated from BOTH sides, in both descriptions", () => {
  // ONE SENTENCE IN ONE PLACE IS HALF A FIX. A model reading downwards meets
  // whichever description its candidate answer is, and run 12's candidate was
  // `rules` — so the `page` block saying the right thing would not have helped
  // unless `rules` said it too.
  const rules = layerBlock("rules"), page = layerBlock("page");
  // ⚠ CASE-INSENSITIVE, because the PROPERTY is that each block names the
  // enforcement test — not how that phrase is capitalised. The first draft
  // demanded `ACCEPTING OR REFUSING` and went red on `ACCEPTING or REFUSING`,
  // which is this repo's most repeated own-goal met inside the guard for a
  // wording fix. Twice in one file, in fact: `CALCULATE OR SHOW` against
  // `CALCULATES OR SHOWS` was the other.
  assert.match(rules, /ACCEPTING OR REFUSING/i,
    "the `rules` block no longer says what makes something a rule");
  assert.match(rules, /IT IS "page" WHEN/,
    "the `rules` block no longer names the other side of the line");
  assert.match(page, /CALCULATES? OR SHOWS?/i,
    "the `page` block no longer claims a section's own arithmetic");
  assert.match(page, /ACCEPTING OR REFUSING/i,
    "the `page` block no longer names the other side of the line");
});

test("both worked examples are there, and they are the contrasting pair", () => {
  // THE OWNER'S OWN TWO SENTENCES. They differ in what must change and NOT in
  // the nouns they use, which is what makes them a pair rather than two
  // examples that happen to sit together.
  const d = layerText();
  assert.match(d, /show six minus the booking count/i,
    "the display example is gone, so the line has no worked case on the page side");
  assert.match(d, /reject bookings after six places are taken/i,
    "the enforcement example is gone, so the line has no worked case on the rules side");
});

test("the shared vocabulary is real, which is why a word list cannot decide it", () => {
  // ⚠ MEASURED RATHER THAN ASSERTED. The claim "these words appear on both
  // sides" is only worth making if it is true of the text as shipped — and if
  // it ever stops being true, the instruction to ignore them is describing a
  // problem the examples no longer show.
  const rules = layerBlock("rules"), page = layerBlock("page");
  const shared = ["booking", "places"];
  for (const w of shared) {
    const re = new RegExp(w, "i");
    assert.match(rules, re, "`" + w + "` no longer appears in the rules block, so the pair is not contrasting");
    assert.match(page, re, "`" + w + "` no longer appears in the page block, so the pair is not contrasting");
  }
  // AND THE ROUTER IS TOLD SO IN AS MANY WORDS.
  assert.match(rules, /THE WORDS IN THE MESSAGE DO NOT DECIDE IT/,
    "the router is no longer told to ignore the vocabulary");
});

test("run 12's own wording is kept as a case, and it is the display side", () => {
  // THE REGRESSION CASE, in the owner's framing: the sentence that really went
  // wrong is retained beside the rule so a later edit cannot quietly drop the
  // example that motivated it.
  //
  // ⚠ AND THIS ASSERTS THE WORDING, NOT A ROUTE. Whether a model sends this
  // sentence to `page` is a live measurement; what is checked here is that the
  // instructions place it on the display side of the line.
  const page = layerBlock("page");
  assert.match(page, /how many (are |places are )?left/i,
    "the counted-display example run 12 turned on is gone from the page side");
  // The page block must claim it EVEN THOUGH the sentence sounds like a rule —
  // that concession is the part that does the work.
  assert.match(page, /even when the sentence is all about bookings, places or\s+capacity/i,
    "the page block no longer concedes that such a sentence SOUNDS like a rule");
});

test("this file asserts the instructions and never a routing outcome", () => {
  // THE CENSUS THAT KEEPS THIS FILE HONEST ABOUT ITS OWN SCOPE. It imports a
  // tool definition and reads strings; a case that stubbed a model answer
  // would be a fixture agreeing with itself, and the opening paragraph says
  // this file does not do that. If somebody adds one, this goes red and the
  // paragraph has to be rewritten with it.
  const src = readFileSync(new URL(import.meta.url), "utf8");
  // ⚠ OVER THE CODE, NOT THE PROSE. The comments above deliberately discuss
  // stubbing a model, so a scan of the raw text finds the very thing it
  // forbids — this repo's single most repeated own-goal.
  const code = src.split("\n")
    .filter((l) => { const t = l.trimStart(); return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")); })
    .join("\n");
  assert.ok(code.includes("ASK_TOOL"), "the observer is dead — the blanked copy does not even import the tool");
  // ⚠ ASSEMBLED FROM HALVES so this line is not itself an occurrence of what
  // it forbids. A literal list here made the census fail on its own text —
  // "prose contains the thing it forbids", in the CODE half this time.
  for (const [a, b] of [["global" + "This", ".fetch"], ["/v1/", "messages"], ["route" + "Mes", "sage"], ["new ", "Response"]]) {
    assert.ok(!code.includes(a + b), "this file now reaches or fakes a model: " + a + b);
  }
});

import { readFileSync } from "node:fs";
