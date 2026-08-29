// TWO SEPARATE PATHS, AND THIS IS WHAT HOLDS THEM APART.
//
// Owner, 2026-08-29: "it should be 2 separated path tho, idk why you are mixing
// the build with the edit path" — and, on what the edit path is: "customer says
// edit this, and booom you go edit it".
//
// The `look` lane called `designSiteSchema` with `SITE_SCHEMA_TOOL` and
// `SITE_SCHEMA_SYSTEM`: the build's function, the build's tool, the build's
// system text. So a colour change on a live site ran the site DESIGNER — 84.8k
// of instructions for inventing a business from nothing — and the two framings
// then fought, which is why `EDIT_RULE` had to NAME the build's `css` wording
// and overrule it in prose.
//
// WHAT IS ASSERTED HERE IS THE SEPARATION, and it needs two opposite halves:
//   * the edit path borrows NOTHING from the build path's tool or wording, and
//   * the two paths still cover the same seventeen fields.
// The first alone lets a field quietly lose its lane; the second alone is
// satisfied by the coupling that was just removed.
//
// DRIVEN, NOT READ. `readSchemaTool` evaluates the real design tool out of
// worker.js with every dependency resolved, and `site-lanes.mjs` is imported and
// called — so these measure what ships rather than a source pattern.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import { PLAN_KEYS } from "../builder/site-plan.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
import {
  LANE_FIELDS, ACTING_LANES, DISPATCHED_LANES, UNBUILT_LANES, MAX_LANES,
  laneLayer, laneUnbuilt, editTool, pickTool, readLanes, readLaneAnswer, editRequest, pickRequest,
} from "../builder/site-lanes.mjs";

const LANES_SRC = fs.readFileSync(new URL("../builder/site-lanes.mjs", import.meta.url), "utf8");

/** Comments quote the build's names and the wording they forbid — blank them, length-preserving. */
const bare = (src) => src.replace(/^\s*(?:\/\/|\*|\/\*)[^\n]*$/gm, (m) => " ".repeat(m.length));

// THE WEB PAIR IS THE ONLY EXCLUSION, and it is the owner's: `needsWeb` and
// `webQueries` decide whether writing a site's COPY needs a search, which is a
// property of a build and nothing a customer asks to change afterwards.
const WEB = ["needsWeb", "webQueries"];

test("the two paths cover the same seventeen fields — asserted both ways", async () => {
  const { tool } = await readSchemaTool();
  const all = Object.keys(tool.input_schema.properties);
  const designed = all.filter((k) => !WEB.includes(k));

  for (const k of WEB) {
    assert.ok(all.includes(k), "`" + k + "` is gone from the design tool, so excluding it here excludes nothing");
  }
  // AN OBSERVER THAT IS ALIVE. Seventeen is the owner's number and it is also
  // what falls out — but the count is the WEAKER half: a field added to the
  // build with no lane is a part of a site the customer can never change again,
  // and a lane for a field the build stopped producing edits nothing. Neither
  // announces itself, so both directions are named.
  assert.equal(designed.length, 17, "the design tool no longer yields seventeen editable fields: " + designed.join(","));
  assert.equal(LANE_FIELDS.length, 17, "the edit path no longer has seventeen lanes: " + LANE_FIELDS.join(","));
  for (const k of designed) {
    assert.ok(LANE_FIELDS.includes(k), "the build can produce `" + k + "` and the edit path has no lane for it");
  }
  for (const k of LANE_FIELDS) {
    assert.ok(designed.includes(k), "the edit path has a `" + k + "` lane and the build tool has no such field");
  }
});

test("the edit path borrows nothing from the build path", () => {
  const src = bare(LANES_SRC);

  // NO IMPORT FROM worker.js AT ALL. The build tool lives there; a lane that
  // reached for it would be the coupling this whole change removes, and it
  // would be invisible from the shapes, which would all still be right.
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.ok(imports.length >= 2, "no imports found — this scan is looking at the wrong file or a stale window");
  for (const i of imports) {
    assert.ok(!/worker/.test(i), "the edit path imports from the worker: " + i);
  }
  // The two it MAY import are facts about the product rather than build wording:
  // which axes are the plan (so a non-acting lane cannot drift from it) and
  // which themes exist (so a theme edit cannot name one the container has not
  // got). Both are asserted so that "imports nothing" cannot quietly become
  // "imports nothing, including the tripwire".
  assert.ok(imports.some((i) => /site-plan/.test(i)), "the plan axes are no longer imported, so the plan lanes cannot be checked against them");
  assert.ok(imports.some((i) => /site-theme-registry/.test(i)), "the theme list is no longer imported, so a theme edit can name one that does not exist");

  // AND NO BUILD-PATH NAME ANYWHERE IN THE BODY, import or not.
  for (const name of ["SITE_SCHEMA_TOOL", "FRONTEND_SCHEMA_TOOL", "SITE_SCHEMA_SYSTEM", "designSiteSchema", "design_schema"]) {
    assert.ok(!src.includes(name), "the edit path names the build path's `" + name + "`");
  }
});

test("the edit path does not send the build's framing — the sentence EDIT_RULE had to argue with", async () => {
  const { tool } = await readSchemaTool();
  const built = String(tool.input_schema.properties.css.description || "");
  // The scan is only worth anything if the build really does still say this.
  // Asserted first, or a build that reworded it turns this into a check that
  // passes by looking at nothing — this repo's own vacuous-assertion trap.
  assert.match(built, /OMIT this field entirely unless/,
    "the build's css wording no longer carries the clause this guard exists to keep off the edit path");

  const edit = String(editTool("css").input_schema.properties.css.description || "");
  assert.ok(edit.length > 200, "the css lane's own wording is missing or a stub — nothing to check");
  // THE DEFECT, NAMED. Shared, the build's "ONLY WHEN ASKED … OMIT this field
  // entirely unless" reads to a customer's edit as "do not touch the
  // stylesheet", and `EDIT_RULE` had to overrule it in prose because both
  // arrived in one call. Separate paths mean it is never sent.
  assert.ok(!/OMIT this field/.test(edit), "the edit path is sending the build's omit-the-stylesheet clause");
  assert.ok(!/ONLY WHEN ASKED/.test(edit), "the edit path is sending the build's only-when-asked framing");
  // And it says the opposite, which is the half that has to arrive WITH the
  // ceiling: permission without a ceiling invites a redesign, a ceiling without
  // permission reads as "don't touch anything" (owner, 2026-08-28).
  assert.match(edit, /yours to edit/i, "the css lane no longer grants the sheet to the model");
  assert.match(edit, /never more/i, "the css lane no longer caps how much may change");
});

test("a lane's tool is one property and nothing required — the wall, not the rule", () => {
  assert.ok(ACTING_LANES.length >= 8, "fewer acting lanes than there were — this loop may be scanning almost nothing");
  for (const field of ACTING_LANES) {
    const t = editTool(field);
    const props = Object.keys(t.input_schema.properties);
    assert.deepEqual(props, [field], "the " + field + " lane can reach fields that are not its own: " + props.join(","));
    // NOTHING REQUIRED, for the reason the whole edit path empties it: a
    // required field is one the model MUST answer, and answering it is what
    // moves a value nobody asked to move.
    assert.deepEqual(t.input_schema.required, [], "the " + field + " lane requires an answer, so a lane that cannot help must invent one");
    // The tool name is what `tool_choice` names; a lane that renamed it would
    // 400 at the provider on every edit.
    assert.equal(editRequest({ field, message: "x", value: "y", model: "m" }).tool_choice.name, t.name,
      "the " + field + " lane's tool_choice names something its request does not carry");
    assert.ok(String(t.input_schema.properties[field].description || "").length > 100,
      "the " + field + " lane has no wording of its own");
  }
});

test("EVERY lane acts — eight here, six on another layer, three named unbuilt", () => {
  // Owner, 2026-08-29: "i need all the 17 lanes acting". Nine lanes were
  // refused at the door — named, priced at zero, sent up the ladder — which was
  // honest about this module and wrong about the customer, who asked for a
  // change and got a fall-through. Six of the nine already had cheap, shipping
  // implementations one lane over; nothing was missing but the wire.
  //
  // THE PARTITION IS TOTAL AND DISJOINT, and both halves matter. A lane in no
  // group is a request that reaches the front door and falls out of it; a lane
  // in two is one whose behaviour depends on which check runs first.
  const groups = [ACTING_LANES, DISPATCHED_LANES, UNBUILT_LANES];
  assert.equal(groups.reduce((n, g) => n + g.length, 0), LANE_FIELDS.length,
    "the three groups do not add up to the seventeen lanes");
  for (const f of LANE_FIELDS) {
    assert.equal(groups.filter((g) => g.includes(f)).length, 1, "`" + f + "` is in more than one group, or none");
  }
  assert.ok(DISPATCHED_LANES.length >= 6, "fewer dispatched lanes than there were — this loop may be scanning almost nothing");

  for (const f of DISPATCHED_LANES) {
    // ASKING FOR A TOOL IS REFUSED, not answered with an empty schema the model
    // would fill with something. From outside, a lane that stores a value
    // nothing reads is indistinguishable from a lane that worked.
    assert.throws(() => editTool(f), /does not act here/, "the " + f + " lane dispatches and still built a tool");
    // AND IT POINTS AT A LAYER THAT REALLY EXISTS. A lane naming a layer no
    // dispatch matches is a customer's request that vanishes: the front door
    // repoints `eLayer` at it, every branch declines, and the route falls out
    // the bottom having charged for the routing call. Asserted against
    // `EDIT_LAYERS` — the list the dispatch is built from — rather than a copy.
    const layer = laneLayer(f);
    assert.ok(EDIT_LAYERS.includes(layer),
      "the " + f + " lane dispatches to `" + layer + "`, which is not an edit layer: " + EDIT_LAYERS.join(","));
    // AND NEVER TO `look`, WHICH IS THE FRONT DOOR ITSELF — found by a surviving
    // mutant, 2026-08-29. `look` passes the check above, because it really is an
    // edit layer; what it is not is somewhere a lane can be SENT. The door runs
    // under `eLayer === "look"`, so repointing there is a loop: the message
    // lands back in the acting lane, whose stray check escalates it. A lane
    // dispatching to `look` therefore stops working while every name in it
    // still reads correctly.
    assert.notEqual(layer, "look",
      "the " + f + " lane dispatches to `look`, which is the door it came through — the ask lands back where it started");
  }

  // THE UNBUILT ONES EACH NAME THEIR OWN JOB. Three different pieces of work —
  // a rebuild, a page-set change, an address move — and a single word for all
  // three is the failure-that-cannot-name-itself shape this repo has recorded
  // seven times over; the last one cost two live runs.
  assert.equal(new Set(UNBUILT_LANES.map(laneUnbuilt)).size, UNBUILT_LANES.length,
    "two unbuilt lanes share one reason, so nobody can tell which job is missing");
  for (const f of UNBUILT_LANES) {
    assert.ok(laneUnbuilt(f), "`" + f + "` is unbuilt with no reason of its own");
    assert.equal(laneLayer(f), null, "`" + f + "` is both unbuilt and dispatched");
    // AND IT NEVER GETS A TOOL EITHER — found by a surviving mutant, 2026-08-29.
    // `LANES.kind` has no `shape` and no `edit`, so building one anyway yields a
    // property with no type and no description: a tool the model fills with
    // something, stored under a field nothing downstream reads, reported as
    // done. The dispatched lanes were checked for this and the unbuilt ones
    // were not, which is the half of a partition that gets forgotten.
    assert.throws(() => editTool(f), /does not act here/, "the " + f + " lane is unbuilt and still built a tool");
  }

  // THE PLAN AXES MUST NEVER ACT HERE, both directions. The module throws at
  // load if they drift; this proves that throw is live rather than a comment
  // about one. Nothing downstream of this module reads a stored plan, so a plan
  // axis edited here stores a value the container never sees and reports
  // success — `needsPages` is the same rule one layer down, arriving only after
  // a model call has been bought.
  for (const k of PLAN_KEYS) {
    assert.ok(!ACTING_LANES.includes(k), "`" + k + "` is a plan axis and is edited here — nothing reads a stored plan");
    assert.ok(LANE_FIELDS.includes(k), "`" + k + "` is a plan axis with no lane at all");
  }
});

test("the router refuses what it did not offer, de-dupes, and caps", () => {
  const reply = (fields) => ({ content: [{ type: "tool_use", input: { fields } }] });
  assert.deepEqual(readLanes(reply(["css"])), ["css"]);
  assert.deepEqual(readLanes(reply(["css", "css"])), ["css"], "a repeated lane runs twice and bills twice");
  assert.deepEqual(readLanes(reply(["nope", "css"])), ["css"], "an unrecognised name reached a lane");
  // `String(["css"])` IS `"css"` — shipped as a real bug three times here, once
  // as a role, once as an access level, once as a language. A one-element array
  // must not pass itself off as a field name.
  assert.deepEqual(readLanes(reply([["css"]])), [], "a one-element array coerced into a lane name");
  assert.deepEqual(readLanes(reply([null, 7, {}])), [], "a non-string coerced into a lane name");
  assert.deepEqual(readLanes({ content: [] }), [], "no tool call still produced lanes");
  // THE CAP IS ARITHMETIC, not an instruction in a description.
  const many = readLanes(reply(LANE_FIELDS.slice(0, MAX_LANES + 3)));
  assert.equal(many.length, MAX_LANES, "more lanes ran than the cap allows");
  // AND JUNK MUST NOT SPEND THE CAP — found by a surviving mutant, 2026-08-29.
  // Dropping the per-name refusal looked harmless because the `offered.filter`
  // on the way out refuses an unknown name a second time, so the ANSWER stayed
  // right. What it changed was the counting: four junk names fill `seen`, the
  // loop breaks, and the one real lane the customer asked for never gets in —
  // a message that silently does nothing. The earlier case here had a single
  // junk name, so the cap never bound and the mutant sailed through.
  assert.deepEqual(readLanes(reply(["x1", "x2", "x3", "x4", "css"])), ["css"],
    "names the router does not offer are spending the lane cap, so the real one is dropped");
  // ORDER IS THE CALLER'S, so which lanes survive the cap is reproducible.
  assert.deepEqual(readLanes(reply(["brand", "css"])), ["css", "brand"].filter((f) => LANE_FIELDS.includes(f)).sort((a, b) => LANE_FIELDS.indexOf(a) - LANE_FIELDS.indexOf(b)));
  // And a lane offered to the model is one that has a hint beside it.
  const desc = String(pickTool().input_schema.properties.fields.description || "");
  for (const f of LANE_FIELDS) assert.ok(desc.includes("\"" + f + "\" —"), "`" + f + "` is offered to the router with nothing beside it");
});

test("declining is not the same as blanking, and truncation is not an answer", () => {
  // A LANE THAT DECLINES IS THE ORDINARY SHAPE: the router named it and the
  // model found the message was not about this part. `null` is the same thing —
  // neither is an instruction to strip a customer's value bare.
  assert.equal(readLaneAnswer({ content: [{ type: "tool_use", input: {} }] }, "css"), undefined);
  assert.equal(readLaneAnswer({ content: [{ type: "tool_use", input: { css: null } }] }, "css"), undefined);
  assert.equal(readLaneAnswer({ content: [] }, "css"), undefined);
  assert.equal(readLaneAnswer({ content: [{ type: "tool_use", input: { css: "a{}" } }] }, "css"), "a{}");
  // AN EMPTY STORED VALUE IS SAID, NEVER LEFT BLANK. A blank line reads as an
  // empty stylesheet where the truth is that the site has never had one, and
  // the two want different answers.
  const cold = editRequest({ field: "css", message: "make it dark", value: "", model: "m" });
  assert.match(String(cold.messages[0].content), /never had one/, "an unset value is shown to the model as a blank");
  const warm = editRequest({ field: "css", message: "make it dark", value: "body{color:red}", model: "m" });
  assert.match(String(warm.messages[0].content), /body\{color:red\}/, "the stored value never reaches the model");
  assert.match(String(warm.messages[0].content), /make it dark/, "the customer's own words never reach the model");
});

test("the edit path is a fraction of the build path — measured, not claimed", async () => {
  const { tool } = await readSchemaTool();
  const whole = JSON.stringify(tool).length;
  const pick = JSON.stringify(pickTool()).length;
  const css = JSON.stringify(editTool("css")).length;
  // The css lane is what customers reach for most, and it was paying for the
  // backend schema, the component manifest and the shape book on every colour
  // change. Both calls of the new path together, against the one old call.
  assert.ok(pick + css < whole / 10,
    "the edit path is no longer materially smaller than the build tool (" + (pick + css) + " vs " + whole + ")");
  // And the router really is the small half — if it grew to carry each field's
  // full instructions it would cost more than the call it exists to shrink.
  assert.ok(pick < whole / 20, "the lane router has grown into a second design tool (" + pick + ")");
  assert.equal(pickRequest({ message: "x" }).model, "claude-haiku-4-5", "the router is no longer on the cheap model");
});
