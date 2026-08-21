// Can `schema-gen-eval` still build the tool it evaluates?
//
// THE FAILURE THIS EXISTS FOR, and it is a whole class rather than one name.
// `test/integration/schema-gen-eval.mjs` does not import `design_schema` — it
// cannot, because the tool is a literal inside `worker.js`, which the eval reads
// as text and `eval`s against a hand-written `scope` of the identifiers that
// literal references. That scope is a list somebody maintains by remembering.
//
// On 2026-08-13 the 17 style axes landed in the tool and nobody added them here,
// so every run since died at startup on `SITE_STYLE_AXES is not defined`. The
// eval failed loudly and in CI — and it is one job among six on a push, so it
// went unread for a day while the designer's own quality measurement recorded
// nothing at all.
//
// THIS RUNS IN THE UNIT SUITE, deliberately, which is the whole point: the check
// belongs where it is seen and where it costs nothing, not in the paid job it is
// about. It needs no API key and makes no model call.
//
// HOW IT IS DERIVED, at both ends. The scope's key names are read out of the
// eval; the tool block is read out of `worker.js`; the block is evaluated with
// every scope name bound to a permissive stub. Only a `ReferenceError` matters —
// a name the tool uses that the scope does not define. Nothing here restates
// what the tool contains or what the scope holds, so a constant added to either
// side tomorrow is covered without anybody remembering this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// THE SCOPE MOVED TO `schema-tool.mjs` ON 2026-08-21, extracted so the Grok
// probe could read the same tool without importing the eval (a top-level
// script: importing it RUNS it and spends model credits). The invariant is
// unchanged — a hand-maintained scope drifts the moment the tool grows — and
// this guard now watches the file that holds it. It went red on the move,
// which is the guard working.
const EVAL_PATH = path.join(ROOT, "test", "integration", "schema-tool.mjs");
const evalSrc = fs.readFileSync(EVAL_PATH, "utf8");
const workerSrc = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");

/** Walk from the first `{` after `from` to its matching close. */
function balanced(src, from) {
  let depth = 0;
  const i = src.indexOf("{", from);
  if (i < 0) return null;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (!depth) return src.slice(i, j + 1); }
  }
  return null;
}

/** The identifiers the eval binds into scope, read from the eval itself. */
function scopeNames() {
  return scopeNamesIn(evalSrc);
}

/** The same reading, over any source — so the scanner itself can be driven. */
function scopeNamesIn(src) {
  const at = src.indexOf("const scope = {");
  if (at < 0) return null;
  const block = balanced(src, at);
  if (!block) return null;
  // Top-level entries only. Comments are stripped first — this file explains
  // itself at length, and prose containing a colon reads as a key otherwise.
  //
  // BOTH `key: value` AND ES6 SHORTHAND (`SEEDS_FIELD,`). Matching only the
  // colon form is a scanner that cannot see a perfectly valid entry, so it
  // reports a name MISSING that is right there — a false alarm on correct code,
  // which this repo rates strictly worse than a miss, and which happened the
  // first time a shorthand entry was added here. The `[,}]` anchor is what keeps
  // it from matching a bare identifier inside a nested expression.
  const bare = block.replace(/\/\/.*$/gm, "");
  const out = [];
  let depth = 0;
  for (const line of bare.split("\n")) {
    if (depth === 1) {
      const m = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/) || line.match(/^\s*([A-Za-z_$][\w$]*)\s*[,}]\s*$/);
      if (m) out.push(m[1]);
    }
    for (const c of line) { if (c === "{") depth++; else if (c === "}") depth--; }
  }
  return out;
}

/** The `design_schema` literal, read the same way the eval reads it. */
function toolBlock() {
  const at = workerSrc.indexOf("const SITE_SCHEMA_TOOL");
  if (at < 0) return null;
  return balanced(workerSrc, workerSrc.indexOf("=", at));
}

/**
 * Callable, chainable, iterable and stringifiable — so the ONLY thing that can
 * throw while evaluating the tool is a name nothing defined.
 *
 * It has to survive whatever the tool does to a scope value, and the evaluation
 * must run to the END: a `TypeError` thrown early short-circuits, and a
 * `ReferenceError` further down would never surface. That is not hypothetical —
 * the first draft yielded a bare string and died on
 * `Object.fromEntries(SITE_STYLE_AXES.map(…))` with "Iterator value x is not an
 * entry object", which then made the negative test below pass for the wrong
 * reason. Hence entry PAIRS: they satisfy `fromEntries` and array destructuring
 * alike.
 */
function stub() {
  const f = function () { return f; };
  return new Proxy(f, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => "x";
      if (prop === "then") return undefined;                 // not a thenable
      if (prop === Symbol.iterator) return function* () { yield ["x", "x"]; };
      if (prop === "length") return 1;
      return stub();
    },
    apply() { return stub(); },
  });
}

test("the eval's scope and the tool it evaluates are both still findable", () => {
  const names = scopeNames();
  const block = toolBlock();
  // Asserted before anything is concluded from them. A regex that silently
  // stopped matching would report a clean sweep — the shape this repo has
  // recorded more than once, most recently in the kit-wide bg-background scan.
  assert.ok(names && names.length >= 5, `the eval's scope literal moved — found ${names ? names.length : "none"}`);
  assert.ok(block && block.length > 2000, `SITE_SCHEMA_TOOL moved in worker.js — found ${block ? block.length : 0} chars`);
  // AND IT SEES BOTH ENTRY FORMS. A scanner blind to shorthand accuses correct
  // code of a missing binding; one blind to `key: value` would miss most of the
  // scope. Driven rather than asserted about the regex, so a rewrite that keeps
  // the patterns and breaks the loop still fails.
  const both = scopeNamesIn("const scope = {\n  alpha: 1,\n  beta,\n  gamma: { nested: 2 },\n};");
  assert.deepEqual(both, ["alpha", "beta", "gamma"], "the scope scanner cannot read both entry forms");
});

/**
 * `instanceof ReferenceError` DOES NOT WORK HERE, and getting that wrong is how
 * both tests below almost shipped broken. `vm.createContext` builds a new realm
 * with its own intrinsics, so an error thrown inside it is constructed from the
 * VM's `ReferenceError`, not this one — `instanceof` is false across the
 * boundary. Found by the negative test at the bottom, which is the entire reason
 * it exists: the positive test was green and would have rethrown a raw error
 * instead of naming the missing identifier.
 */
const isReferenceError = (e) => !!e && e.name === "ReferenceError";

test("every identifier design_schema references is in the eval's scope", () => {
  const names = scopeNames();
  const block = toolBlock();
  const ctx = vm.createContext(Object.fromEntries(names.map((n) => [n, stub()])));
  try {
    vm.runInContext("(" + block + ")", ctx, { timeout: 5000 });
  } catch (e) {
    if (isReferenceError(e)) {
      // The message is always "<name> is not defined", which is exactly the
      // instruction: add that name to `scope` in schema-tool.mjs.
      assert.fail(
        `schema-tool cannot build design_schema: ${e.message}. ` +
        `Add it to \`scope\` in test/integration/schema-tool.mjs — do not stub it, ` +
        `a stubbed enum measures a prompt nobody sends.`);
    }
    throw e;
  }
});

/**
 * `strict: true` IS THE OBVIOUS FIX FOR THE SEEDING MISS AND IT CANNOT BE USED.
 *
 * MEASURED 2026-08-15, three eval runs: the designer omits `seed` — a field its
 * own tool marks REQUIRED — on a growing share of samples (14/15 → 12/15 →
 * 10/14 clean), and the shape is "no `seed` key at all" in every failure. Tool
 * `required` is advisory unless strict validation is on, so `strict: true` is
 * exactly the mechanism that would enforce it. That is the reasoning anybody
 * looking at this will reach, and it is why this guard exists rather than a
 * comment nobody reads.
 *
 * THE API FORBIDS IT FOR THIS SCHEMA. Structured outputs require
 * `additionalProperties: false` on every object and reject it set to anything
 * else — and `seed` is `additionalProperties: {type: "array", …}`, a map keyed
 * by TABLE NAME, which cannot be enumerated in advance because the tables are
 * what this very call is inventing. Shipping `strict: true` would 400 every
 * build on the platform.
 *
 * AND RESHAPING IT INTO SOMETHING STRICT CAN EXPRESS COSTS MORE THAN THE MISS.
 * Seed rows are column→value objects, so a strict encoding needs a fixed
 * envelope (`{column, value}` pairs) — roughly 3-4× the tokens on a field that
 * is already ~41% of the designer's output, on EVERY build. Against a miss that
 * `topUpSeed` already catches with one Haiku call on a minority of builds, that
 * is an order of magnitude the wrong way.
 *
 * SO THE GUARD FORBIDS THE COMBINATION, NOT THE IMPROVEMENT. The day `seed`
 * becomes strict-expressible, this goes green with `strict` on.
 */
test("design_schema is not marked strict while its schema cannot be", () => {
  const names = scopeNames();
  const ctx = vm.createContext(Object.fromEntries(names.map((n) => [n, stub()])));
  const tool = vm.runInContext("(" + toolBlock() + ")", ctx, { timeout: 5000 });

  // Every object node whose `additionalProperties` is present and not `false` —
  // the exact thing structured outputs reject. Walked rather than listed, so a
  // second dynamic map added tomorrow is covered.
  const offenders = [];
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (Object.hasOwn(node, "additionalProperties") && node.additionalProperties !== false) {
      offenders.push(path || "(root)");
    }
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object") walk(v, path ? path + "." + k : k);
    }
  };
  walk(tool.input_schema, "");

  // Asserted BEFORE anything is concluded from it. With the walk broken this
  // finds nothing, reports the schema as strict-ready, and the guard passes on
  // a Worker one edit away from 400-ing every build.
  assert.ok(offenders.length > 0,
    "no non-false additionalProperties found — either the schema became strict-expressible "
    + "(good: enable strict and delete this) or the walk stopped working");
  assert.ok(offenders.some((p) => /\bseed\b/.test(p)),
    `the walk no longer sees \`seed\`, which is the measured case: found ${offenders.join(", ")}`);

  assert.notEqual(tool.strict, true,
    "design_schema is marked strict while " + offenders.join(", ") + " use a non-false "
    + "`additionalProperties`, which structured outputs reject — this would 400 EVERY build. "
    + "Enforcing the required `seed` field is worth wanting, but not this way: see the comment above.");
});

test("a name the scope does not define really is caught", () => {
  // The check above passes vacuously if a ReferenceError cannot reach it — so
  // drop a name the tool genuinely uses and require the failure.
  const names = scopeNames().filter((n) => n !== "SITE_STYLE_AXES");
  const ctx = vm.createContext(Object.fromEntries(names.map((n) => [n, stub()])));
  assert.throws(
    () => vm.runInContext("(" + toolBlock() + ")", ctx, { timeout: 5000 }),
    isReferenceError,
    "removing SITE_STYLE_AXES from scope should make the tool unresolvable — if it does not, the tool stopped using it and this guard is watching nothing");
});

test("the eval never reads a tool property that does not exist", () => {
  // THE BUG THIS EXISTS FOR, and it cost a CI run. `family` left `design_schema`
  // with the families on 2026-08-20 and the eval referenced
  // `input_schema.properties.family.enum` in TWO places, 74 lines apart — a
  // sanity check and a startup `console.log`. Fixing one and not the other made
  // the run die at startup with `Cannot read properties of undefined (reading
  // 'enum')`, before any model call.
  //
  // A grep for the DELETED name would not have found it: the expression names
  // `family` as a property key, not as an imported symbol, so the sweep that
  // caught every `READY_FAMILIES` and `layoutDirective` walked straight past it.
  // Derived at both ends instead — every `properties.<name>` the eval reads must
  // be a property the real tool actually has.
  const src = fs.readFileSync(new URL("./integration/schema-tool.mjs", import.meta.url), "utf8")
    // Comments blanked LENGTH-PRESERVINGLY first: the fix is explained in prose
    // directly above the fixed line, and prose about a bug contains the bug's
    // spelling. Seventh recorded instance of that trap in this repo.
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const read = [...src.matchAll(/input_schema\.properties\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  const names = scopeNames();
  const ctx = vm.createContext(Object.fromEntries(names.map((n) => [n, stub()])));
  const tool = vm.runInContext("(" + toolBlock() + ")", ctx, { timeout: 5000 });
  const have = new Set(Object.keys(tool.input_schema.properties));
  for (const name of read) {
    assert.ok(have.has(name),
      "the eval reads `input_schema.properties." + name + "`, which design_schema does not have — "
      + "it will throw at startup before any model call");
  }
  // THE FLOOR. A scan that silently stopped matching would report a clean file,
  // which is the reassuring way to say nothing was checked — so the tool must
  // really have properties, and the pattern must really be able to find one.
  assert.ok(have.size >= 10, "only " + have.size + " tool properties — the tool did not evaluate");
  const probe = "input_schema.properties.brand.enum";
  assert.deepEqual([...probe.matchAll(/input_schema\.properties\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]), ["brand"],
    "the scan pattern no longer matches a known-good reference");
});
