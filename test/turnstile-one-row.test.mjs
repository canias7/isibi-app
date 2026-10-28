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

// The platform gate that called oneRow was deleted on 2026-10-28 (spam
// protection off; visitor writes go to the site's own Worker).
