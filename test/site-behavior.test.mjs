// WHAT EVERY INTERACTIVE THING ON THE PAGE DOES — the design step's last field,
// and the lane that changes it (owner, 2026-08-29: "update only the frontend
// design step to plan behavior… for edit, try and make it more universal,
// whatever the user asks, like we been doing it").
//
// THE FEATURE IS TWO HALVES IN TWO PATHS THAT MAY NOT SEE EACH OTHER, so the
// assertions worth having are the ones that span them: that the SHAPE is one
// object rather than two copies, and that an answer to it survives to storage.
// The rest of this file is the ordinary per-half checking.
//
// WHAT THIS FILE DELIBERATELY DOES NOT ASSERT: that a page generates from these
// entries. Nothing does yet, by the owner's explicit call ("do not implement the
// behavior yet"), and a guard written for a hop that does not exist would go
// green on a stub and then be quoted as proof the feature works.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { BEHAVIOR_FIELD, BEHAVIOR_ITEM, MAX_BEHAVIOR } from "../builder/site-plan.mjs";
import { EDIT_FIELDS, mergeLook, currentStateNote, movedFields } from "../builder/site-edit.mjs";
import { OWN_LANES, LANE_FIELDS, editTool, laneRule } from "../builder/site-lanes.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";

// Prose in this repo contains the things it forbids — a comment arguing about a
// field name contains that field name — so any scan blanks whole-line comments
// length-preservingly first.
const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

/* ── the design half ────────────────────────────────────────────────────── */

test("the design step asks what each interactive thing DOES, and compels an answer", async () => {
  const { tool } = await readSchemaTool();
  const p = tool.input_schema.properties;
  assert.ok(p.behavior, "the design step no longer asks what anything on the page does");
  assert.equal(p.behavior.type, "array", "behaviour is no longer a list of controls");

  // COMPELLED. A field the description merely asks for is one the model answers
  // when it feels like it, and an unanswered behaviour list is not "this page has
  // no controls" — it is a page whose controls nobody decided, which is the state
  // `northgroup-17` shipped in.
  assert.ok(tool.input_schema.required.includes("behavior"),
    "behaviour is no longer compelled on a build, so a model may simply not answer it");
});

test("ONE SHAPE, NOT TWO COPIES — the build field and the edit lane share the same object", async () => {
  // THE ASSERTION THIS FILE EXISTS FOR. `builder/site-lanes.mjs` is forbidden to
  // import from worker.js, so the items could very easily have been written out
  // twice — and two copies of one shape is this repo's "two lists of the same
  // thing", which drift in silence and are only ever found from a live site.
  //
  // Identity, not deepEqual: two literals that happen to match today satisfy
  // deepEqual and then diverge on the next edit to either one.
  const { tool } = await readSchemaTool();
  assert.equal(tool.input_schema.properties.behavior.items, BEHAVIOR_ITEM,
    "the build tool has its own copy of the behaviour item shape");
  assert.equal(editTool("behavior").input_schema.properties.behavior.items, BEHAVIOR_ITEM,
    "the edit lane has its own copy of the behaviour item shape");
});

test("the owner's five questions are properties, and every one is required", () => {
  // THE FIVE ARE THE OWNER'S OWN ("what triggers it, what it does, what it
  // affects or opens, what result the user should see, whether the behavior is
  // built into the selected TSX component or requires custom behavior"), and
  // `control` is the sixth — without it an entry names no element and nothing
  // downstream could ever find the control it describes.
  //
  // PROPERTIES RATHER THAN PROSE for the reason `kind` is an enum: a model asked
  // in one sentence to cover five things answers two, and the other three are
  // silence indistinguishable from "none".
  const props = Object.keys(BEHAVIOR_ITEM.properties);
  assert.deepEqual(props.sort(), ["affects", "control", "does", "on", "result", "source"],
    "the behaviour entry no longer answers the five questions plus the control it is about");
  assert.deepEqual([...BEHAVIOR_ITEM.required].sort(), props.sort(),
    "a behaviour entry may now be answered in part — five of six reads exactly like six");

  // Each one says something. A property that arrived with no description is one
  // the model answers from imagination.
  for (const [k, v] of Object.entries(BEHAVIOR_ITEM.properties)) {
    assert.ok(String(v.description || "").length > 60, "`" + k + "` is a compelled property with no instruction");
  }
});

test("`source` is an enum, because code will read it and prose cannot be read", () => {
  // The whole point of asking is that "the kit component already does this" and
  // "this needs behaviour written" are different amounts of work. A free-text
  // answer to that is a sentence somebody has to parse later.
  assert.deepEqual(BEHAVIOR_ITEM.properties.source.enum, ["component", "custom"],
    "the built-in/custom answer is no longer a closed set");
});

test("it is answered LAST of the design fields — a tool's property order is its generation order", async () => {
  // Behaviour can only be decided once every element that could exist HAS been.
  // Answered any earlier the model describes controls it intends to invent.
  //
  // DERIVED FROM THE FIELDS IT MUST FOLLOW, not from a position number: a
  // hard-coded index is a second copy of the order and goes stale the first time
  // anything is inserted.
  const { tool } = await readSchemaTool();
  const order = Object.keys(tool.input_schema.properties);
  const at = order.indexOf("behavior");
  assert.ok(at > 0, "behaviour is not on the tool at all, so this ordering check is measuring nothing");

  // Everything that puts an element on the page comes first.
  for (const before of ["pages", "components", "shape", "images", "action", "three"]) {
    const i = order.indexOf(before);
    assert.ok(i >= 0, "`" + before + "` is gone from the tool, so asserting behaviour follows it proves nothing");
    assert.ok(i < at, "behaviour is decided before `" + before + "`, so it describes controls that do not exist yet");
  }
  // And the web pair is not a design field — it is the search gate riding on
  // this call — so behaviour is the last thing the designer actually designs.
  for (const after of ["needsWeb", "webQueries"]) {
    const i = order.indexOf(after);
    assert.ok(i >= 0, "`" + after + "` is gone, so this half of the ordering proves nothing");
    assert.ok(i > at, "the search gate is now answered before behaviour");
  }
});

test("a ceiling with no floor, and an empty list is a real answer", () => {
  const d = BEHAVIOR_FIELD.description;
  assert.ok(d.includes(String(MAX_BEHAVIOR)), "the cap is no longer stated to the model");
  assert.match(d, /At most/, "the cap no longer reads as a ceiling");
  // A FLOOR IS A QUOTA AND A MODEL FILLS A QUOTA — this file's standing law.
  assert.doesNotMatch(d, /\bat least\b|\bminimum\b|\bno fewer than\b/i,
    "the behaviour field states a floor, which is a quota a model will fill with controls the page has not got");
  // And a static page has to be able to say so, or "no entries" becomes
  // indistinguishable from the model declining to answer.
  assert.match(d, /empty list/, "a page with nothing interactive on it cannot say so");
});

test("it names the dead-control failure it exists to stop", () => {
  // `northgroup-17`: the stage filters, "New deal" and every deal row were
  // `<a href="#pipeline">` sitting inside the pipeline section, and 15 of 24
  // in-page links pointed at the band they were already in. Naming WHERE a link
  // goes is what makes that answerable at all.
  assert.match(BEHAVIOR_FIELD.description, /still an entry/i,
    "a link that only navigates is no longer required to have an entry, which is where the dead controls hid");
});

/* ── the edit half ──────────────────────────────────────────────────────── */

test("the behaviour lane ACTS in this module — it is not dispatched to a page rewrite", () => {
  // Owner: "for edit, try and make it more universal, whatever the user asks,
  // like we been doing it". Dispatching would price a wording change at a page
  // rewrite, and right now there is no generated source to rewrite.
  assert.ok(LANE_FIELDS.includes("behavior"), "there is no behaviour lane, so a customer can never change one");
  assert.ok(OWN_LANES.includes("behavior"), "the behaviour lane no longer acts here");

  // THE WALL, NOT THE RULE: one property and nothing required, so the lane
  // physically cannot answer another field.
  const t = editTool("behavior");
  assert.deepEqual(Object.keys(t.input_schema.properties), ["behavior"],
    "the behaviour lane can answer more than behaviour");
  assert.deepEqual(t.input_schema.required, [], "the behaviour lane compels an answer on an edit");
});

test("both halves of the contract arrive together — unlimited in WHAT, strict in HOW MUCH", () => {
  // Either half alone misleads (owner, 2026-08-28): permission with no ceiling
  // buys a page where every control was "improved"; a ceiling with no permission
  // reads as "do not touch anything".
  const r = laneRule("behavior");
  assert.ok(r.length > 400, "the behaviour lane's rule is a stub — there is nothing here to check");

  // UNLIMITED IN WHAT, and stated as the mechanism rather than as a list: a list
  // covers tonight's behaviour and the next request is always a different one.
  assert.match(r, /no list of behaviours to pick from/i,
    "the lane no longer says that any behaviour is expressible, so it reads as a menu");
  // STRICT IN HOW MUCH.
  assert.match(r, /ONE CONTROL ASKED ABOUT IS ONE CONTROL CHANGED/,
    "the lane no longer holds the change to what was asked");
  assert.match(r, /EXACTLY AS IT WAS GIVEN/,
    "the lane no longer promises the untouched entries come back unchanged");

  // AND NONE OF THE BUILD'S FRAMING. The build's `css` clause ("OMIT this field
  // entirely unless") is the sentence `EDIT_RULE` used to have to argue with; a
  // separate path means it is never sent at all.
  assert.doesNotMatch(r, /OMIT this field|ONLY WHEN ASKED/,
    "the behaviour lane is carrying the build path's omit-unless-asked framing");
});

/* ── the hop that makes it a RECORD rather than an answer into nothing ──── */

test("an answer is STORED — the hop `three` shipped without", () => {
  // THE WIRING TRAP, NAMED. `mergeLook` rebuilds its output from `EDIT_FIELDS`
  // ALONE, so a design field absent from that list is answered by the model on
  // every build and thrown away before anything can store or read it. Nothing
  // fails and nothing logs: from outside, "the model declined" and "we dropped
  // it" are one indistinguishable `undefined`. That is exactly what happened to
  // `three` on 2026-08-29 and is why both names are checked here.
  for (const k of ["behavior", "three"]) {
    assert.ok(EDIT_FIELDS.includes(k), "`" + k + "` is decided by the design step and dropped by the merge");
  }

  const answered = [{
    control: "Filter by stage", on: "choosing a stage", does: "filters the deal table",
    affects: "the deal table below it", result: "the rows drop to that stage only", source: "component",
  }];
  const out = mergeLook(null, { behavior: answered, three: "a turning chair" }, null, { instructed: false });
  assert.deepEqual(out.behavior, answered, "a behaviour list the model answered does not survive the merge");
  assert.equal(out.three, "a turning chair", "a scene the model designed does not survive the merge");
});

test("absent means unchanged, so an edit about a colour cannot wipe the controls", () => {
  const stored = {
    behavior: [{
      control: "Book now", on: "pressing it", does: "opens the booking form",
      affects: "the slot picker", result: "the form slides in", source: "component",
    }],
  };
  const out = mergeLook(stored, { css: "body{color:red}" }, null, { instructed: true });
  assert.deepEqual(out.behavior, stored.behavior, "a colour edit re-answered what every control does");
  assert.deepEqual(movedFields(stored, out), [], "a colour edit reports having changed the behaviour");
});

test("the designer is shown what the controls already do, and it is the SENTENCES", () => {
  // Same argument as the photographs, and the same teeth: `behavior` is a
  // REPLACED list, not a merged one, so a designer that cannot see the entries
  // cannot hand them back — and a re-answer is the old list gone. A count would
  // not do: "6 controls" is nothing a model can return unchanged.
  const note = currentStateNote({
    behavior: [{
      control: "Filter by stage", on: "choosing a stage", does: "filters the deal table",
      affects: "the table", result: "rows drop to that stage", source: "component",
    }],
  });
  assert.ok(note, "a site with stored behaviour gets no current-state note at all");
  assert.match(note, /Filter by stage/, "the designer is never told which controls the site has");
  assert.match(note, /filters the deal table/, "the designer is shown control names with no behaviour to return unchanged");
  // `source` rides along because it is the field a re-answer gets wrong in a way
  // nobody sees until the site is live: a control silently re-labelled
  // "component" is one that ships doing nothing.
  assert.match(note, /component/, "the designer is not told which controls already work and which need writing");
});

/* ── and the honest limit, asserted so nobody rediscovers it as a bug ───── */

test("NOTHING GENERATES FROM IT YET, and the tree says so where the next session will look", () => {
  // The owner deferred implementation ("do not implement the behavior yet"), so
  // the absence is correct today. What makes it survivable rather than the usual
  // own-goal is that it is WRITTEN DOWN: a field with no consumer and no note is
  // indistinguishable from a feature that shipped dead.
  //
  // Anchored on the note existing, not on the absence of a consumer — the day
  // behaviour IS generated, this test should be updated by the person adding the
  // hop, and a guard asserting "no consumer exists" would instead have to be
  // deleted by them, which is the same thing said in a way that reads as failure.
  const lanes = blank(readFileSync("builder/site-lanes.mjs", "utf8"));
  assert.match(lanes, /behavior: \{/, "the behaviour lane is gone from the lanes table");
  const plan = readFileSync("builder/site-plan.mjs", "utf8");
  assert.match(plan, /IT DECIDES AND RECORDS; IT DOES NOT GENERATE/,
    "the note saying nothing reads these entries yet is gone — the next session will read the empty hop as a bug");
});
