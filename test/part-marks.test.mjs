// WHAT A PART'S MODEL CALL WAS SHOWN OF THE OTHER PARTS (2026-10-13, after
// run 141). `partMarks` reads a request exactly as it is sent and keeps
// numbers and a name, never text: how many other-part spans it carried
// marked, whether the rule sentence was there, how many times another part's
// words appear unmarked (outside the done list), and how many earlier parts
// the done list reports. Built on the real `partBlock`, so the reader and the
// writer of the section cannot drift.
import test from "node:test";
import assert from "node:assert/strict";
import { partMarks, readMarks, recorder, replayer, PART_SECTION, PART_RULE, MARKS_KEPT } from "../builder/prepared.mjs";
import { partBlock, PART_HEADING } from "../builder/site-ask.mjs";

const MSG = "Add a short questions section to the Bake List page. And add ' — sent every Friday' to the end of the heading 'Join the weekly bake list'.";
const OTHER = "And add ' — sent every Friday' to the end of the heading 'Join the weekly bake list'.";
const span = [MSG.indexOf(OTHER), MSG.indexOf(OTHER) + OTHER.length];
const req = (block, extra = "") => ({ model: "m", tool_choice: { type: "tool", name: "add_to_site" }, system: "You design additions.", messages: [{ role: "user", content: [{ type: "text", text: "What they asked to add: a short questions section." + extra }, { type: "text", text: block }] }] });

test("MARKS 1 — the real part section, one other part marked: one span, the rule present, nothing unmarked, no done list; the call is named by its tool; no text is kept", () => {
  const m = partMarks(req(partBlock({ original: MSG, done: [], others: [span] })));
  assert.deepEqual(m, { what: "add_to_site", others: 1, rule: true, unmarked: 0, done: 0 });
  assert.ok(!JSON.stringify(m).includes("Friday"), "the record carries request text");
  assert.equal(PART_SECTION, PART_HEADING, "the reader's section heading drifted from the writer's");
  assert.ok(partBlock({ original: MSG, done: [], others: [span] }).includes(PART_RULE), "the reader's rule sentence drifted from the writer's");
});

test("MARKS 2 — ANOTHER PART'S WORDS LEAKED ELSEWHERE IN THE REQUEST, unmarked, are counted; the same words in the done list are not (an earlier part is reported done on purpose) and the done list is counted apart", () => {
  const leaked = partMarks(req(partBlock({ original: MSG, done: [], others: [span] }), "\n" + OTHER.trim()));
  assert.equal(leaked.unmarked, 1);
  const done = partMarks(req(partBlock({ original: MSG, done: [{ words: OTHER.trim(), said: "changed the heading" }], others: [span] })));
  assert.equal(done.unmarked, 0, JSON.stringify(done));
  assert.equal(done.done, 1);
});

test("MARKS 3 — a part with no other parts: no spans, no rule; a call with no part section is not a part's call (null); a malformed request is null", () => {
  assert.deepEqual(partMarks(req(partBlock({ original: MSG, done: [] }))), { what: "add_to_site", others: 0, rule: false, unmarked: 0, done: 0 });
  assert.equal(partMarks(req("")), null);
  assert.equal(partMarks(null), null);
  assert.equal(partMarks({ messages: "x" }), null);
});

test("MARKS 4 — RECORDED BY A PREPARATION AND BY A JOB: the recorder keeps each part call's marks in order; the replayer keeps them for calls replayed and made now alike, saying which", async () => {
  const send = async () => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "add_to_site", input: {} }] });
  const r = recorder();
  const a = req(partBlock({ original: MSG, done: [], others: [span] }));
  const b = { ...a, tool_choice: { type: "tool", name: "write_pages" } };
  await r.wrap(send)(a);
  await r.wrap(send)({ model: "m", messages: [{ role: "user", content: "no part here" }] });
  await r.wrap(send)(b);
  assert.deepEqual(r.marks.map((m) => m.what), ["add_to_site", "write_pages"]);
  assert.ok(!Object.keys(JSON.parse(JSON.stringify(r.calls[0]))).includes("marks"), "marks rode into an entry");
  const rp = replayer({ calls: JSON.parse(JSON.stringify(r.calls.slice(0, 1))) });
  await rp.wrap(send)(a);
  await rp.wrap(send)(b);
  assert.deepEqual(rp.marks().map((m) => [m.what, m.replayed]), [["add_to_site", true], ["write_pages", false]]);
});

test("MARKS 5 — READ BACK STRICTLY: a list that does not read is null (unknown), never 'no markings'; an over-long list is null", () => {
  const ok = { what: "pick_adds", others: 1, rule: true, unmarked: 0, done: 0, replayed: true };
  assert.deepEqual(readMarks([ok]), [ok]);
  assert.deepEqual(readMarks([]), []);
  for (const bad of [null, "x", [{ ...ok, others: -1 }], [{ ...ok, rule: "yes" }], [{ ...ok, what: 3 }], [{ ...ok, replayed: 1 }], [{ ...ok, unmarked: 1.5 }]]) assert.equal(readMarks(bad), null, JSON.stringify(bad));
  assert.equal(readMarks(Array.from({ length: MARKS_KEPT + 1 }, () => ok)), null);
});
