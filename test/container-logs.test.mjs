// The Workers-logs reader (scripts/container-logs.mjs) runs its query at
// import time and holds CI's Cloudflare token, so it cannot be imported here;
// these read its source, comments blanked, for the properties that matter.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../scripts/container-logs.mjs", import.meta.url), "utf8");
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

test("the logs reader prints a killed invocation's outcome, and stays a dry read that never prints the token", () => {
  const w = bare(SRC);
  // RUN 17 (2026-09-02): a queue consumer died mid-call and logged nothing.
  // The message stream cannot say why; Cloudflare's outcome for the
  // invocation can, and it lives on the $workers envelope.
  assert.match(w, /\$workers/, "the reader never looks at the $workers envelope, where the outcome lives");
  assert.match(w, /w\.outcome/, "the outcome is not read off the event");
  assert.match(w, /outcomes other than ok/, "the tally of non-ok outcomes is gone");
  // Free and read-only, as the workflow that presses it promises.
  assert.match(w, /dry: true/, "the query is no longer a dry read");
  assert.ok(!/console\.(?:log|error)\([^\n]*\bTOKEN\b/.test(w), "the token is printed");
});
