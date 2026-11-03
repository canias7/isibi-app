// PARKED (2026-11-03, park-old-way): the old-way half of test/decide-all-writers.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// DECIDE-ALL (2026-10-23), the owner's rule: no fixed customer message. The
// four paths left in docs/history/2026-10-23-decide-all.md's table now reach an
// existing writer with structured facts, and the code's sentence is only the
// fallback when no line is written. Also: a revise lays the owner's own
// translated wording over its pages, and the draft media move is per project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as R from "../../../builder/site-reply.mjs";
const { refusalFacts, editReplyFacts } = R;
const wideningFacts = (...a) => { assert.equal(typeof R.wideningFacts, "function", "wideningFacts does not exist"); return R.wideningFacts(...a); };
import { wideningAsk } from "../../../builder/site-rules.mjs";
import { actionFacts } from "../../../builder/site-progress.mjs";
const SiteMedia = createRequire(import.meta.url)("../../../public/site-media.js");

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
const RULES = readFileSync(new URL("../../../builder/site-rules.mjs", import.meta.url), "utf8");
const texts = (facts) => facts.map((f) => f.text).join("\n");
/** The source between two landmarks, both asserted to exist first. */
function between(src, a, b) {
  const i = src.indexOf(a);
  assert.ok(i >= 0, "landmark missing: " + a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, "landmark missing: " + b);
  return src.slice(i, j);
}

test("the rules step's widening question is worded by the writer, its options kept structured", () => {
  const fn = between(W, "async function wideningQuestion(", "// ── THE SITE'S LIVE QUESTION");
  assert.match(fn, /wideningFacts\(widening, ask\.options\)/);
  assert.match(fn, /writeReply\(/);
  assert.match(fn, /\{ \.\.\.ask, text: out\.text\.trim\(\) \}/, "the options are not kept as the step's own");
  assert.match(fn, /: ask;/, "no fallback to the code's question");
  assert.match(W, /stepAsk\("rules", Array\.isArray\(rOut\.widening\)[^\n]*await wideningQuestion\(env, \{ ask: rOut\.ask, widening: rOut\.widening/, "the rules step does not reach the writer");
});
