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

/** The body of the object literal starting at `at`, or null if that is not a `{`. */
function objectBody(src, at) {
  if (src[at] !== "{") return null;
  let d = 0;
  for (let j = at; j < src.length; j++) {
    if (src[j] === "{" || src[j] === "[" || src[j] === "(") d++;
    else if (src[j] === "}" || src[j] === "]" || src[j] === ")") { d--; if (d === 0) return src.slice(at + 1, j); }
  }
  return null;
}

/** An object literal's own keys, at one nesting level. */
function topKeys(body) {
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

/**
 * The keys EVERY `await fn(env, …)` call site passes.
 *
 * ALL OF THEM, not the first: the two-phase build added a SECOND caller (the
 * resume, which replays the same function in a later invocation), and reading
 * only the first meant the scan silently moved to whichever call the file
 * happened to declare earlier — it found the resume's three keys and reported
 * the build path's fifteen as gone.
 *
 * A NAMED ARGUMENT OBJECT IS FOLLOWED TO ITS ASSIGNMENT. The build path's
 * arguments are a variable now (they are stored, so the resume can replay them),
 * and a scan that only reads an inline literal describes a call site that no
 * longer exists.
 */
function passed(src, fn) {
  const keys = new Set();
  let sites = 0;
  for (const m of src.matchAll(new RegExp(`await ${fn}\\(env,\\s*`, "g"))) {
    const at = m.index + m[0].length;
    let body = objectBody(src, at);
    if (body === null) {
      const name = /^([A-Za-z_$][\w$]*)/.exec(src.slice(at, at + 60));
      assert.ok(name, `a ${fn} call passes an argument this scan cannot read`);
      const decl = src.indexOf(`${name[1]} = {`);
      assert.ok(decl >= 0, `${name[1]} is passed to ${fn} and is assigned no object literal`);
      body = objectBody(src, src.indexOf("{", decl));
    }
    assert.ok(body !== null, `could not read the arguments of a ${fn} call`);
    sites++;
    for (const k of topKeys(body)) keys.add(k);
  }
  // EVERY CALL IS READ, derived rather than counted. A call written in a shape
  // this scan cannot see is one whose keys are checked by nothing, and it would
  // pass quietly on the strength of the other call site's floor.
  const all = [...src.matchAll(new RegExp(`\\b${fn}\\(env,`, "g"))]
    .filter((c) => !/async function\s*$/.test(src.slice(Math.max(0, c.index - 20), c.index)));
  assert.equal(sites, all.length,
    `${all.length} call sites, ${sites} read — one is written in a shape this scan cannot see`);
  assert.ok(sites >= 1, `nothing calls ${fn} the way this scan expects`);
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

// AND NO `prior*` NAME MAY BE READ INSIDE THE FUNCTION UNLESS IT IS A PARAMETER.
//
// THE SECOND HALF OF THE SAME BUG, found the run after `icon`. Line 7749 read
// `verify: priorVerify` — and `priorVerify` is declared inside the ROUTE, ~4,100
// lines away, so it was a free variable and a ReferenceError on every build.
// Measured live 2026-08-19 at `stage: generate`.
//
// THE CHECK ABOVE COULD NOT SEE IT. That one compares the CALLER's keys against
// the signature; this is a bare read of something the caller never passed. It is
// the `du.id` shape CLAUDE.md records — a name that can only ever mean the
// router, left behind by an extraction — and the fix recorded there is exactly
// this: do not attempt general free-variable analysis (measured at 1,113 false
// positives), narrow it to the prefix that can only mean the outer scope.
test("no `prior*` name is read inside buildAndPublishPages unless it is a parameter", () => {
  const i = worker.indexOf("async function buildAndPublishPages(env, {");
  const end = worker.indexOf("\nasync function ", i + 10);
  assert.ok(end > i, "could not find the end of buildAndPublishPages");
  const body = worker.slice(i, end);
  const params = destructured(worker, "buildAndPublishPages");
  // Comments blanked first: this file explains `priorLogo` and `priorPages` in
  // prose, and prose about a name contains that name.
  const code = body.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  const reads = new Set([...code.matchAll(/\bprior[A-Z][\w$]*/g)].map((m) => m[0]));
  // THE FLOOR: the real parameters must still be seen, or a broken scan reports
  // a clean function.
  assert.ok(reads.has("priorPages") && reads.has("priorUsage"),
    "the scan no longer sees the known prior* parameters — it is broken");
  const free = [...reads].filter((n) => !params.has(n));
  assert.deepEqual(free, [],
    `${free.join(", ")} is read inside buildAndPublishPages and is not a parameter — a ReferenceError on every build`);
});
