// When the site agent looked at its pages (2026-10-29), the reply's check
// sentences say so, in place of "it is not a look at any page" and "nobody
// looked at the design"; without it they are unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { checksOf, checkFacts, readChecks, COMPILED_SAID } from "../builder/check-evidence.mjs";

const render = { ok: true, pages: 4, findings: [] };
test("CL1 looked pages replace the two caveats with what the builder did", () => {
  const t = checkFacts(checksOf({ render, published: true, looked: ["/", "/shop", "/", "bad route"] })).map((f) => f.text).join("\n");
  assert.doesNotMatch(t, /not a look at any page/);
  assert.doesNotMatch(t, /nobody looked at the design/);
  assert.match(t, /The builder also looked at screenshots of 2 pages \(\/, \/shop\) itself before finishing\./);
});
test("CL2 without looked pages the sentences are exactly as before", () => {
  const t = checkFacts(checksOf({ render, published: true })).map((f) => f.text);
  assert.equal(t[0], COMPILED_SAID);
  assert.match(t[1], /It is automated: nobody looked at the design\.$/);
  assert.equal(checksOf({ render, published: true, looked: [] }).looked, undefined);
});
test("CL3 evidence carrying a malformed looked list is not read", () => {
  const c = checksOf({ render, published: true, looked: ["/"] });
  assert.ok(readChecks(c));
  assert.equal(readChecks({ ...c, looked: ["no slash"] }), null);
  assert.equal(readChecks({ ...c, looked: [] }), null);
});

test("CL4 the wiring: a build carries the agent's looked pages to its checks, and an edit adds them to its own", async () => {
  const { readFileSync } = await import("node:fs");
  const P = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(P, /if \(gen && gen\.agent && Array\.isArray\(gen\.agent\.looked\) && gen\.agent\.looked\.length\) out\.looked = gen\.agent\.looked\.slice\(0, 12\);/);
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = W.indexOf("export function buildChecks("), b = W.indexOf("\n}\n", a);
  assert.ok(a > 0 && b > a);
  assert.equal((W.slice(a, b).match(/looked: pages\.looked/g) || []).length, 2, "both the draft and the published checks");
  const c = W.indexOf("async function runAgentChange("), d = W.indexOf("async function recompileAndPublish(", c);
  assert.match(W.slice(c, d), /checks: out\.checks && ag\.looked\.length \? \{ \.\.\.out\.checks, looked: ag\.looked\.slice\(0, 12\) \} : out\.checks,/);
});
