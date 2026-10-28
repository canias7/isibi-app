// THE TYPECHECK'S VERDICT REACHES THE REPLY'S FACTS (2026-10-28). Kiln Lane's
// build said "compiled without errors" while its own note said a part did not
// typecheck: `checkFacts` said the compile sentence unconditionally.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checksOf, readChecks, checkFacts, typesOf, COMPILED_SAID } from "../builder/check-evidence.mjs";

const KILN = "src/routes/-parts/band-5-two.tsx(41,5): error TS2322: Type '{ id: number; name: string; }' is not assignable to type 'ClassRow'.\n  Property 'created_at' is missing.";
const texts = (c) => checkFacts(c).map((f) => f.text);

test("TF1 a clean build still says compiled without errors", () => {
  const t = texts(checksOf({ render: null, published: true }));
  assert.ok(t.includes(COMPILED_SAID));
});

test("TF2 a type error names the part and never says without errors", () => {
  const c = checksOf({ render: null, published: true, typeErrors: KILN });
  assert.deepEqual(c.types, { ok: false, files: ["band-5-two"] });
  assert.ok(readChecks(c), "the evidence still reads");
  const t = texts(c);
  assert.ok(t.length > 0);
  assert.ok(t.some((x) => /type check found a mistake/.test(x) && x.includes("band-5-two")), t.join("|"));
  assert.ok(t.every((x) => !/without errors/.test(x)), t.join("|"));
});

test("TF3 several files, capped and deduplicated; unnamed output still counts", () => {
  const many = Array.from({ length: 9 }, (_, i) => `src/routes/p${i}.tsx(1,1): error TS1: x`).join("\n") + "\nsrc/routes/p0.tsx(2,2): error TS1: y";
  assert.equal(typesOf(many).files.length, 6);
  assert.deepEqual(typesOf("tsc exited 2 with no file"), { ok: false, files: [] });
  assert.equal(typesOf(""), null);
  assert.equal(typesOf(undefined), null);
  const t = texts(checksOf({ render: null, published: true, typeErrors: "tsc exited 2" }));
  assert.ok(t.every((x) => !/without errors/.test(x)));
});

test("TF4 a malformed types entry makes the evidence unreadable", () => {
  const c = checksOf({ render: null, published: true, typeErrors: KILN });
  assert.equal(readChecks({ ...c, types: { ok: true, files: [] } }), null);
  assert.equal(readChecks({ ...c, types: { ok: false, files: ["../x"] } }), null);
});

test("TF5 the Worker hands the typecheck's output to both evidence builders", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const start = w.indexOf("export function buildChecks(pages)");
  assert.ok(start > 0);
  const body = w.slice(start, w.indexOf("\n}\n", start));
  assert.equal((body.match(/typeErrors: pages\.typeErrors/g) || []).length, 2);
  const edit = w.indexOf("checks: checksOf({ render: built.render, version");
  assert.ok(edit > 0);
  assert.match(w.slice(edit, w.indexOf("\n", edit)), /typeErrors: built\.typeErrors/);
});
