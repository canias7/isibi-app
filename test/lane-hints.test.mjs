// The two hints that share a button.
//
// The lane sweep (2026-09-01) sent "when someone presses the header button,
// open the phone dialler" to the picker, which read "open the dialler" as WHERE
// THE BUTTON POINTS and named `action`; the nav rung, which changes a label
// and an href, answered `no-menu`, and the behaviour lane never ran. The two
// hints described the same control from two sides and neither said where the
// other side's ask goes.
//
// Every hint is a placeholder the owner will reword (owner: "i will tell you
// the prompt later"), so this pins no sentence. It pins the MECHANISM the fix
// relies on: each of the two hints names the other lane, so the picker is told
// where the neighbouring ask belongs instead of guessing from the field name.
// A rewording keeps the property or the sweep's failure comes back.
import test from "node:test";
import assert from "node:assert/strict";
import { pickTool } from "../builder/site-lanes.mjs";

/** The hint line the picker is shown for one lane, read off the real tool. */
function hintFor(field) {
  const text = pickTool([field]).input_schema.properties.fields.description;
  const line = text.split("\n").find((l) => l.startsWith('"' + field + '" — '));
  assert.ok(line, "the picker no longer lists " + field + " as a line of its own");
  return line;
}

test("the action hint sends what a control DOES to behavior, and the behavior hint claims it", () => {
  const action = hintFor("action");
  const behavior = hintFor("behavior");
  assert.match(action, /`behavior`/, "the action hint does not say where an ask about what the button DOES belongs");
  assert.match(behavior, /`action`/, "the behavior hint does not say where an ask about the button's words and link belongs");
  // AND THE TWO SIDES ARE STATED, not only cross-referenced: action is the
  // label and the link, behavior is the "when X, then Y".
  assert.match(action, /\bwords?\b/i, "the action hint does not claim the button's words");
  assert.match(action, /\blinks?\b/i, "the action hint does not claim the button's link");
  assert.match(behavior, /\bDOES\b/, "the behavior hint does not claim what a control does");
});

test("every lane a hint quotes exists, and the button's two hints quote each other", () => {
  // A hint naming another lane is a claim about the border between them
  // (`theme` has pointed at `css` since the two split), and a border drawn to
  // a lane that was renamed or retired sends the picker to a name it cannot
  // answer. The first draft here pinned the crossing pairs to today's two and
  // flagged `theme` -> `css`, which is correct code: a list of today's hops is
  // the trap this repo names, so this reads the property instead.
  const tool = pickTool();
  const lines = tool.input_schema.properties.fields.description.split("\n").filter((l) => /^"[a-z]+" — /.test(l));
  assert.ok(lines.length >= 20, "the picker lists fewer lanes than the platform has: " + lines.length);
  const names = new Set(tool.input_schema.properties.fields.items.enum);
  let quoted = 0;
  for (const l of lines) {
    for (const m of l.matchAll(/`([a-z]+)`/g)) {
      quoted++;
      assert.ok(names.has(m[1]), l.slice(0, 20) + " quotes `" + m[1] + "`, which is not a lane");
    }
  }
  assert.ok(quoted >= 3, "the observer is dead: no hint quotes any lane");
  // MUTUAL. One side alone re-creates the sweep's failure from the other
  // direction: a behavior hint that claims the button and an action hint that
  // says nothing sends "change the button to say Book" to behavior.
  const line = (f) => lines.find((l) => l.startsWith('"' + f + '" — '));
  assert.ok(line("action").includes("`behavior`") && line("behavior").includes("`action`"), "the two hints that share the header button do not both name the other");
});
