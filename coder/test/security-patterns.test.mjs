// L-machine-42 (2026-11-19): a repository's own security rules skip patterns that could run away, as Claude Code's do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRulesFile, checkEdit, riskyRegex } from "../container/coder-security.mjs";

const file = (...rx) => JSON.stringify({ patterns: rx.map((r, i) => ({ rule_name: "r" + i, regex: r, reminder: "look" })) });

test("L-machine-42 runaway patterns are skipped, ordinary ones load, and the check answers at once", () => {
  const rules = parseRulesFile(file("^(\\w+\\s?)+$", "(a+)+$", "eval\\(", "yaml\\.load\\(", "(\\w|\\d)+x", "(a)\\1"), "json");
  assert.deepEqual(rules.map((r) => r.rule_name), ["repo:r2", "repo:r3"]);
  assert.deepEqual(rules.skipped, ["repo:r0", "repo:r1", "repo:r4", "repo:r5"]);
  for (const ok of ["eval\\(", "(foo|bar)\\(", "\\b(md5|sha1)\\b", "password\\s*=\\s*['\"][^'\"]+", "x{2,}"]) assert.equal(riskyRegex(ok), false, ok);
  const t0 = Date.now();
  const all = parseRulesFile(file("^(\\w+\\s?)+$", "eval\\("), "json");
  assert.equal(checkEdit("a.js", "a".repeat(40) + "!", all, new Set()), "");
  assert.match(checkEdit("b.js", "eval(x)", all, new Set()), /repo:r1/);
  assert.ok(Date.now() - t0 < 500);
});
