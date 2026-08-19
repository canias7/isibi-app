// EVERY KEY THE CALLER PASSES MUST BE ONE THE FUNCTION DESTRUCTURES.
//
// WHAT WENT WRONG. `buildAndPublishPages` was called with `icon: priorIcon` and
// its body reads `icon: icon || ""` — and the signature never destructured it.
// A plain `ReferenceError` on EVERY first build that reached the container:
// the pages generated fine (~82s, 10,097 output tokens), the container call
// threw, and the customer got the data-model placeholder with
// `the build service is unreachable: icon is not defined`.
//
// NOTHING COULD SEE IT. `node --check` passes, esbuild bundles it, no unit test
// can import a Worker entrypoint, and the one check that WOULD have caught it —
// `build smoke` — had been skipped on every commit since the favicon work
// landed, because those commits carried `[skip smoke]`. Measured live
// 2026-08-19 and traced back to 05605c9.
//
// The existing block-scope scanner in `worker-imports.test.mjs` cannot see this
// shape: that one walks forward from a DECLARATION, and here there is none. The
// check that discriminates is the one below — compare the call site's own keys
// against the signature's own names, both read from the source, so neither side
// is restated and a key added to either is covered without anybody remembering.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const worker = fs.readFileSync(path.join(import.meta.dirname, "../worker.js"), "utf8");

/** The names a function destructures out of its single options object. */
function destructured(src, fn) {
  const i = src.indexOf(`async function ${fn}(env, {`);
  assert.ok(i >= 0, `${fn} is not declared the way this scan expects`);
  const open = src.indexOf("{", i + `async function ${fn}(env,`.length);
  const close = src.indexOf("}", open);
  assert.ok(close > open, `${fn}'s parameter object is not closed on one line`);
  return new Set(src.slice(open + 1, close).split(",").map((s) => s.split("=")[0].trim()).filter(Boolean));
}

/** The keys an `await fn(env, { ... })` call site passes, at one nesting level. */
function passed(src, fn) {
  const call = src.indexOf(`await ${fn}(env, {`);
  assert.ok(call >= 0, `nothing calls ${fn} the way this scan expects`);
  const open = src.indexOf("{", call + `await ${fn}(env,`.length);
  let d = 0, end = -1;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{" || src[j] === "[" || src[j] === "(") d++;
    else if (src[j] === "}" || src[j] === "]" || src[j] === ")") { d--; if (d === 0) { end = j; break; } }
  }
  assert.ok(end > open, `could not find the end of the ${fn} call`);
  const body = src.slice(open + 1, end);
  // Top-level keys only: a nested object's own keys are not this call's.
  const keys = new Set();
  let depth = 0, line = "";
  for (const ch of body) {
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) { const m = /(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*:/.exec(line); if (m) keys.add(m[1]); line = ""; continue; }
    line += ch;
  }
  const m = /(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*:/.exec(line);
  if (m) keys.add(m[1]);
  return keys;
}

test("buildAndPublishPages destructures every key its caller passes", () => {
  const params = destructured(worker, "buildAndPublishPages");
  const keys = passed(worker, "buildAndPublishPages");
  // THE SCAN'S OWN FLOOR, asserted first. A regex that silently stopped
  // matching would report a clean file, which is the reassuring way to say
  // nothing was checked.
  assert.ok(params.size >= 15, `only found ${params.size} parameters — the scan is broken`);
  assert.ok(keys.size >= 15, `only found ${keys.size} passed keys — the scan is broken`);
  // And the two names this was written for, so the check cannot pass vacuously
  // on a build path that stopped carrying either.
  for (const n of ["icon", "logo"]) {
    assert.ok(keys.has(n), `the caller no longer passes \`${n}\``);
  }
  const missing = [...keys].filter((k) => !params.has(k));
  assert.deepEqual(missing, [],
    `buildAndPublishPages is passed ${missing.join(", ")} and destructures neither — a ReferenceError on every build`);
});
