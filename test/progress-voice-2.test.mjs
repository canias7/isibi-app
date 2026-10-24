// PROGRESS VOICE, ROUND 2 (2026-10-24, after the live build of
// driftwood-and-daughters, Grok, effort Low). Its lines echoed the facts'
// impersonal tails ("Nothing is on the pages yet", "Visitors cannot see it
// yet") instead of THE VOICE, which came after the states. Guards:
//   VB1 through the real writer, every system prompt puts THE VOICE before
//       THE STATES (progress, talk, tasks, and the scan's line rule);
//   VB2 no build, edit or add-on fact text carries the old per-fact tails;
//   VB3 the check accepts a first-person line that declares the right states
//       without any tail words, and still refuses one declaring a fact
//       published (or anything but its own state) early;
//   VB4 a repeated identical tail across supplied lines is flagged, and the
//       writer asks once more when its line repeats an earlier line's tail,
//       keeping the second answer either way.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROGRESS_VOICE, writeProgress, readProgress, taskRequest,
  startFacts, buildStepFacts, talkBuildStepFacts, designPartFacts, designStartFacts, sectionStartFacts,
  stillFacts, addonPickedFacts, addonDesignedFacts, addonSchemaFacts, addonPublishFacts, editStepFacts, editPublishFacts,
  addressFacts, repeatedTails, repeatsTail, lastClause,
} from "../builder/site-progress.mjs";
import { SCAN_LINE_RULE } from "../builder/security-say.mjs";

const reply = (tool, input) => ({ content: [{ type: "tool_use", name: tool, input }], usage: {} });
const FACTS = [
  { id: "f1", state: "decided", text: "Chose the address driftwood-and-daughters for the site." },
  { id: "f2", state: "designed", text: "Planned 3 pages: Home, Menu, Visit." },
  { id: "f3", state: "prepared", text: "Placed 4 photographs on the pages." },
];
const GOOD = "Starting with the structure: Home, Menu and Visit at driftwood-and-daughters, and four photographs are already placed.";
const SAYS = FACTS.map((f) => ({ id: f.id, as: f.state }));

function voiceFirst(sys, name) {
  const v = sys.indexOf("THE VOICE\n");
  assert.ok(v >= 0, name + ": THE VOICE is missing");
  assert.ok(sys.includes(PROGRESS_VOICE), name + ": the whole voice block is missing");
  const s = sys.indexOf("THE STATES");
  if (s >= 0) assert.ok(v < s, name + ": THE VOICE comes after THE STATES");
  assert.match(sys.slice(0, v), /VOICE COMES FIRST: it decides the wording; the states decide only what may be said/, name + ": the voice is not said to govern the wording");
}

test("VB1 — through the real writer, THE VOICE comes before THE STATES in every request", async () => {
  for (const talk of [false, true]) {
    const sent = [];
    const out = await writeProgress({ send: (req) => { sent.push(req); return reply(talk ? "write_update" : "write_progress", { text: GOOD, says: SAYS }); } }, { facts: FACTS, model: "m", talk });
    assert.equal(out.ok, true);
    assert.equal(sent.length, 1);
    voiceFirst(sent[0].system[0].text, talk ? "talk" : "progress");
  }
  voiceFirst(taskRequest({ tasks: [{ n: 1, words: "a" }], model: "m", split: 2 }).system[0].text, "tasks");
  assert.ok(SCAN_LINE_RULE.indexOf("THE VOICE\n") === 0, "the scan's line rule does not start with the voice");
});

const TAILS = /nothing is (built|changed|decided|on the pages) yet|nothing new is finished yet|none is finished yet|visitors (cannot|can't|keep) see|not built yet|not in effect yet|goes live when|takes effect when/i;

test("VB2 — no build, edit or add-on fact text carries a per-fact tail", () => {
  const all = [];
  for (const op of ["build", "edit", "addon"]) for (const draft of [false, true]) all.push(...startFacts({ op, layer: "look", page: "/visit", slug: "driftwood-and-daughters", draft }));
  for (const s of ["design", "provision", "schema", "seed", "gen", "links", "research", "attachments", "import", "bands", "writing", "compile"]) {
    all.push(...buildStepFacts({ s, tables: 2, ok: 2, n: 3, searches: 2, sent: 1, pages: 3, wrote: 3, bands: 4, files: 2 }));
  }
  all.push(...talkBuildStepFacts({ s: "container", draft: true }), ...talkBuildStepFacts({ s: "container", draft: false }));
  all.push(...designPartFacts({ brand: "Driftwood & Daughters", pages: [{ name: "Home" }, { name: "Menu" }], shape: [{ sections: ["Welcome", "Hours"] }], theme: "coastal", wordmark: {} }));
  all.push(...designStartFacts("plan"), ...designStartFacts("look"), ...sectionStartFacts(["Welcome", "Hours"]), ...stillFacts("Writing the pages now.", 50000));
  all.push(...addonPickedFacts(["page"]), ...addonDesignedFacts("page", { path: "/events", title: "Events" }));
  all.push(...addonSchemaFacts({ tables: [{ name: "events" }] }, { publishing: true, draft: true }), ...addonPublishFacts([], { draft: true }));
  all.push(...editStepFacts({ step: { layer: "data", page: "/" }, body: { draft: { published: false, held: true } } }, 0, 1));
  all.push(...editPublishFacts([], { draft: true }), ...addressFacts("driftwood-and-daughters"));
  assert.ok(all.length > 30, "the observer saw too few facts: " + all.length);
  assert.ok(all.some((f) => /^Held in their draft/.test(f.text)), "the held step was not observed");
  for (const f of all) assert.doesNotMatch(f.text, TAILS, "a fact carries a tail: " + f.text);
});

test("VB3 — the check reads the declared states, not gloss words; it still refuses a fact declared published or finished early", async () => {
  for (const talk of [false, true]) {
    const tool = talk ? "write_update" : "write_progress";
    const ok = readProgress(reply(tool, { text: GOOD, says: SAYS }), FACTS, { talk });
    assert.equal(ok.ok, true, "a first-person line in the right states without tail words was refused");
    assert.doesNotMatch(ok.text, TAILS);
    const early = readProgress(reply(tool, { text: "Your site is live with Home, Menu and Visit.", says: [SAYS[0], SAYS[1], { id: "f3", as: "published" }] }), FACTS, { talk });
    assert.equal(early.ok, false);
    assert.equal(early.why, "misstated");
    assert.deepEqual(early.wrong, [{ id: "f3", as: "published", state: "prepared" }]);
    const done = readProgress(reply(tool, { text: "All done.", says: [SAYS[0], { id: "f2", as: "checked" }, SAYS[2]] }), FACTS, { talk });
    assert.equal(done.ok, false);
    // Through the writer: both answers declare it published, so no line is kept.
    let n = 0;
    const out = await writeProgress({ send: () => { n++; return reply(tool, { text: "Live now.", says: [SAYS[0], SAYS[1], { id: "f3", as: "published" }] }); } }, { facts: FACTS, model: "m", talk });
    assert.equal(out.ok, false);
    assert.equal(out.why, "misstated");
    assert.equal(n, 2);
  }
});

test("VB4 — a repeated identical tail across supplied lines is flagged; the writer asks once more and keeps the second answer", async () => {
  const lines = [
    "A new site is going up from your description; nothing is on the pages yet.",
    "The site is named Driftwood & Daughters. Nothing is on the pages yet.",
    "Home, Menu and Visit are planned. Nothing is on the pages yet.",
    "The look is settled: sea-glass green and sand.",
  ];
  assert.deepEqual(repeatedTails(lines), [1, 2]);
  assert.deepEqual(repeatedTails(["Home is planned.", "Menu is planned."]), [], "a short shared ending is not a tail");
  assert.equal(lastClause("Hi."), "");
  assert.equal(repeatsTail(GOOD, lines), false);
  const earlier = [lines[0]];
  const sent = [];
  const texts = [lines[1], GOOD];
  const out = await writeProgress({ send: (req) => { sent.push(req); return reply("write_update", { text: texts[sent.length - 1], says: SAYS }); } }, { facts: FACTS, model: "m", talk: true, earlier });
  assert.equal(out.ok, true);
  assert.equal(out.text, GOOD);
  assert.equal(sent.length, 2);
  assert.match(sent[1].messages[0].content, /ENDED WITH THE SAME CLAUSE AS AN EARLIER UPDATE/);
  assert.doesNotMatch(sent[0].messages[0].content, /SAME CLAUSE/);
  // The second answer is kept even when it repeats: a line that passed every truth check is never lost to wording.
  let k = 0;
  const kept = await writeProgress({ send: () => { k++; return reply("write_progress", { text: lines[1], says: SAYS }); } }, { facts: FACTS, model: "m", earlier });
  assert.equal(kept.ok, true);
  assert.equal(k, 2);
  // No earlier lines: one call, as before.
  let j = 0;
  await writeProgress({ send: () => { j++; return reply("write_progress", { text: lines[1], says: SAYS }); } }, { facts: FACTS, model: "m" });
  assert.equal(j, 1);
});

test("VB5 — the worker hands every writer its earlier lines", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const calls = src.split("await writeProgress(").slice(1).map((c) => c.slice(0, c.indexOf("\n")));
  assert.equal(calls.length, 3, "the worker's writer calls moved");
  for (const c of calls) assert.match(c, /earlier: rec\.lines\.map\(/, "a writer call is not handed its earlier lines: " + c.slice(0, 80));
});
