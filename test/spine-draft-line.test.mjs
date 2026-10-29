// The progress line after the checks says where the change is going
// (2026-10-29: kiln-lane-3's edit said "Publishing the site now" though it was
// saved to the draft).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spineCheckFacts } from "../builder/site-progress.mjs";

test("SD1 draft, live or not yet known: each its own line", () => {
  assert.match(spineCheckFacts({ draft: true }).at(-1).text, /^Saving it to the site's draft now; the live site stays as it is until the owner presses Publish\.$/);
  assert.equal(spineCheckFacts({ draft: false }).at(-1).text, "Publishing the site now.");
  assert.equal(spineCheckFacts({}).at(-1).text, "Publishing the site now.");
  assert.equal(spineCheckFacts({ draft: null }).at(-1).text, "Saving the change now.");
});
test("SD2 the Worker says draft under draft-first, not-yet-known for a rebuild that may go live", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(W, /spineCheckFacts\(\{ render: built\.render, cssChecked: verifyOnly \? verifyOnly\.size : 0, draft: !draftFirst\(env\) \? false : liveWhenClean === true \? null : true \}\)/);
});
