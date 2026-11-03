// Audit group g3 (2026-10-22): A06-5 (page writers see the draft's held
// tables); A04-3 went with the scheduled jobs. S6-2 and A01-5 were already fixed (reply-held-draft, site-placeholder).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
/** The source between two landmarks, both asserted present first. */
function between(a, b, from = 0) {
  const i = src.indexOf(a, from);
  assert.ok(i >= 0, "landmark missing: " + a);
  const k = src.indexOf(b, i + a.length);
  assert.ok(k > i, "landmark missing: " + b);
  return src.slice(i, k);
}

test("A06-5: a held revise writes its pages against the draft's schema", () => {
  const rev = between("let pageSpec = spec;", "pageSpec = withStoredSpec(spec, read.spec);");
  assert.match(rev, /bWriter\.holding/);
  assert.match(rev, /await draftView\(env, slug\)/);
  assert.match(rev, /specOverlay\(read\.spec, view\.ops\)/);
  assert.match(rev, /read = \{ ok: false, why: "draft-unreadable" \}/);
});
