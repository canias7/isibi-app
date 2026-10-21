// WORD BY WORD (2026-10-21, owner: "instead of just putting the sentence there,
// lets have it word by word"). The reveal is driven by time, so a redraw never
// restarts it; what was on screen when a site opened is never typed; reduced
// motion types nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const a = src.indexOf("const TypeIn = (() => {");
const b = src.indexOf("\n})();", a);
const block = src.slice(a, b);

test("the reveal keeps each text's first moment, so a redraw resumes it rather than restarting", () => {
  assert.ok(a > 0 && b > a, "TypeIn is gone from chat.js");
  assert.match(block, /const started = new Map\(\);/);
  assert.match(block, /if \(!started\.has\(key\)\) started\.set\(key, first \|\| reduce\(\) \? 0 : now\);/, "a text already on screen, or reduced motion, is typed");
  assert.match(block, /Math\.floor\(\(\(now - t0\) \/ 1000\) \* rate\) \+ 1/, "the words shown are not read from the time elapsed");
  assert.match(block, /const rate = Math\.max\(WPS, words \/ \(MAX_MS \/ 1000\)\);/, "a long reply never finishes in a bounded time");
});

test("it types the progress lines and the replies, never buttons, options, the working line or folded detail", () => {
  assert.match(block, /ul\.st-req-prog > li/);
  assert.match(block, /\.st-msg\.a/);
  for (const skip of ["ul.st-req-prog", ".st-opts", ".st-think", "details", "button"]) assert.ok(block.includes(skip), "typed inside " + skip);
  assert.match(block, /new MutationObserver\(schedule\)\.observe\(document\.body, \{ childList: true, subtree: true \}\)/, "nothing starts it");
});
