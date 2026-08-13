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
const EVAL_PATH = path.join(ROOT, "test", "integration", "schema-gen-eval.mjs");
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
  const at = evalSrc.indexOf("const scope = {");
  if (at < 0) return null;
  const block = balanced(evalSrc, at);
  if (!block) return null;
  // Top-level `key:` only. Comments are stripped first — this file explains
  // itself at length, and prose containing a colon reads as a key otherwise.
  const bare = block.replace(/\/\/.*$/gm, "");
  const out = [];
  let depth = 0;
  for (const line of bare.split("\n")) {
    const m = depth === 1 && line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
    if (m) out.push(m[1]);
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
      // instruction: add that name to `scope` in schema-gen-eval.mjs.
      assert.fail(
        `schema-gen-eval cannot build design_schema: ${e.message}. ` +
        `Add it to \`scope\` in test/integration/schema-gen-eval.mjs — do not stub it, ` +
        `a stubbed enum measures a prompt nobody sends.`);
    }
    throw e;
  }
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
