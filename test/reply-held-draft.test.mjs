// Audit finding 30 (A14-1): a change held in the draft (data, rules, add-row,
// pageless addition) is told as saved to the draft, never as live, and a held
// rule never "took effect at once". The answers are shaped as worker.js's
// routes give them: `draft: heldDraft(rev)` and no `checks`.
import test from "node:test";
import assert from "node:assert/strict";
import { editReplyFacts, addonReplyFacts, REPLY_SYSTEM } from "../builder/site-reply.mjs";
import { DRAFT_SAID } from "../builder/check-evidence.mjs";

const held = (revision) => ({ published: false, held: true, revision, said: DRAFT_SAID });
const texts = (r) => { assert.equal(r.skip, null); assert.ok(r.facts.length > 0); return r.facts.map((f) => f.text); };
const draftFact = (t, n) => t.some((x) => x.includes("revision " + n) && /live site is unchanged until the owner presses Publish/.test(x));
const atOnce = (t) => t.some((x) => /took effect at once/.test(x));

test("a held rules change: saved to the draft, never 'took effect at once'", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "rules", msg: "**bookings** — changed whether double bookings are allowed", cost: 1, draft: held(4) }));
  assert.ok(draftFact(t, 4), t.join("\n"));
  assert.ok(!atOnce(t), t.join("\n"));
});

test("a live rules change still says it took effect at once (control)", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "rules", msg: "**bookings** — changed", cost: 1 }));
  assert.ok(atOnce(t));
  assert.ok(!t.some((x) => /draft/i.test(x)));
});

test("a held data edit carries the draft fact", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "data", applied: [{ table: "lessons", id: 4, column: "price" }], cost: 1, draft: held(7) }));
  assert.ok(draftFact(t, 7), t.join("\n"));
});

test("a rules step beside a look change, held: no 'took effect at once'", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "look", lookNote: "Moved the band.", draft: held(5),
    steps: [{ layer: "rules", status: "done", msg: "bookings — changed" }] }));
  assert.ok(!atOnce(t), t.join("\n"));
  assert.ok(draftFact(t, 5));
});

test("a held add-row and a held pageless addition carry the draft fact", () => {
  const row = texts(addonReplyFacts({ ok: true, kinds: ["row"], rows: [{ table: "events", id: null, label: "Open day", held: true }],
    added: [], changed: [], removed: [], moved: [], cost: 1, draft: held(3) }));
  assert.ok(draftFact(row, 3), row.join("\n"));
  const pageless = texts(addonReplyFacts({ ok: true, tables: ["reminders"], added: [], changed: [], removed: [], cost: 2, draft: held(9) }));
  assert.ok(draftFact(pageless, 9), pageless.join("\n"));
});

test("a malformed draft is not read as held", () => {
  for (const d of [{ published: false, held: true, revision: 0 }, { published: true, held: true, revision: 2 }, { published: false, revision: 2 }, "draft"]) {
    const t = texts(editReplyFacts({ ok: true, layer: "rules", msg: "changed", draft: d }));
    assert.ok(atOnce(t) && !t.some((x) => /draft/i.test(x)), JSON.stringify(d));
  }
});

test("the reply instructions do not assume every change is live", () => {
  assert.ok(!/change their live website/.test(REPLY_SYSTEM));
});
