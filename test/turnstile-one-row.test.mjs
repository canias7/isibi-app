// Audit A30-2: where the spam check is on, a visitor submission is exactly one
// JSON object. An array (bulk insert), a non-JSON body or a non-object body is
// refused before the token is judged; an unprotected table is unaffected.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as tt from "../site-turnstile.mjs";

const JSON_T = "application/json";
const oneRow = (...a) => {
  assert.equal(typeof tt.oneRow, "function", "site-turnstile.mjs exports oneRow");
  return tt.oneRow(...a);
};

test("a single JSON object is one row (control)", () => {
  const r = oneRow(JSON.stringify({ name: "a", "cf-turnstile-response": "t" }), JSON_T);
  assert.deepEqual(r, { row: { name: "a", "cf-turnstile-response": "t" } });
  assert.deepEqual(oneRow("{\"a\":1}", "application/json; charset=utf-8"), { row: { a: 1 } });
});

test("an array is refused, one element or many (bulk insert)", () => {
  assert.equal(oneRow("[{\"a\":1}]", JSON_T).bad, "array");
  const many = JSON.stringify(Array.from({ length: 500 }, () => ({ name: "x", message: "spam" })));
  assert.equal(oneRow(many, JSON_T).bad, "array");
  assert.equal(oneRow(many, JSON_T).row, undefined);
});

test("a non-JSON body is refused (CSV, form-encoded, empty)", () => {
  assert.equal(oneRow("name,message\nx,spam\ny,spam", JSON_T).bad, "not-json");
  assert.equal(oneRow("name=x&message=spam", JSON_T).bad, "not-json");
  assert.equal(oneRow("", JSON_T).bad, "not-json");
  assert.equal(oneRow(undefined, JSON_T).bad, "not-json");
});

test("a JSON body that is not an object is refused", () => {
  for (const b of ["null", "1", "\"x\"", "true"]) assert.equal(oneRow(b, JSON_T).bad, "not-object", b);
});

test("a body not sent as application/json is refused, even if it parses", () => {
  assert.equal(oneRow("{\"a\":1}", "text/csv").bad, "content-type");
  assert.equal(oneRow("{\"a\":1}", "application/x-www-form-urlencoded").bad, "content-type");
  assert.equal(oneRow("{\"a\":1}", null).bad, "content-type");
});

// ----- wiring in worker.js (read raw; patterns carry `(` so prose cannot match)
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const gateAt = worker.indexOf("async function turnstileGate(");
const gateEnd = worker.indexOf("\n}\n", gateAt);
const fn = worker.slice(gateAt, gateEnd);

test("the gate reads the shape first and refuses a bad one on a protected collect table before verifying", () => {
  assert.ok(gateAt > 0 && gateEnd > gateAt, "the gate exists");
  const shape = fn.indexOf("turnstileOneRow(sent, request.headers.get(\"content-type\"))");
  const refuse = fn.indexOf("return { refused: \"Please send one submission at a time.\" }");
  const verify = fn.indexOf("turnstileVerify({");
  assert.ok(shape > 0 && refuse > 0 && verify > 0, "all three landmarks exist");
  assert.ok(shape < refuse && refuse < verify, "shape, then refusal, then the token");
  const branch = fn.slice(shape, refuse);
  assert.ok(/const body = shape\.row \|\| null;\s*\n\s*if \(!body\) \{/.test(fn), "the refusal branch is taken exactly when the body is not one row");
  assert.ok(/if \(!secret\) return \{\};/.test(branch), "a site without the secret is unaffected");
  // RE-ANCHORED 2026-10-23 (r1-combine): audit A30-6 asks the table's
  // resolved pair (`canWriteAccess`), never the stored preset name `collect`.
  assert.ok(/!canWriteAccess\(d\)\) return \{\};/.test(branch), "a table visitors cannot write is unaffected");
  assert.ok(!/JSON\.parse\(sent \|\| "null"\)/.test(fn), "the old silent pass on a bad body is gone");
});
