// 2026-10-23 review of r1-combine: `fill` substituted the visitor's parameters
// first and then scanned the result for {{SECRET}} placeholders. Since A30-8
// the json and header escapes leave braces intact, so a visitor who typed
// `{{API_KEY}}` had the owner's secret substituted into the outgoing request.
// A substituted value must never be rescanned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fill } from "../site-apis.mjs";

const secrets = { API_KEY: "sk-owner-real-secret" };
for (const escape of ["json", "header", "url"]) {
  test(`a visitor's {{API_KEY}} is never filled with the secret (${escape})`, () => {
    for (const q of ["{{API_KEY}}", "{{ API_KEY }}", "{{param.q}}"]) {
      const r = fill("q={{param.q}}", { secrets, params: { q }, escape });
      assert.equal(typeof r.text, "string");
      assert.ok(!r.text.includes("sk-owner-real-secret"), `${escape}: secret leaked for ${q}: ${r.text}`);
      assert.equal(r.missing, null);
    }
  });
}
test("the template's own secret and parameter are still both filled", () => {
  const r = fill('{"k":"{{API_KEY}}","q":"{{param.q}}"}', { secrets, params: { q: "a\"b" }, escape: "json" });
  assert.equal(r.text, '{"k":"sk-owner-real-secret","q":"a\\"b"}');
  assert.equal(fill("{{MISSING}} {{param.q}}", { secrets, params: { q: "x" } }).missing, "MISSING");
});
test("a value that looks like a secret placeholder arrives as typed in a header", () => {
  assert.equal(fill("X {{param.q}}", { secrets, params: { q: "{{API_KEY}}" }, escape: "header" }).text, "X {{API_KEY}}");
});
