// PARKED (2026-11-03, park-old-way): the old-way half of test/addition-schema-guard.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// AUDIT S2-3 (2026-10-23): an addition's schema guard (`othersOpen` in
// worker.js) counted a part blocked on the addition itself as a concurrent
// writer, so the addition lost with `conflict` and re-ran every time.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { othersOpenIn } from "../../../builder/request.mjs";

const part = (n, status, extra = {}) => ({ n, status, needs: [], parent: null, ...extra });

test("S2-3: the Worker's othersOpen asks othersOpenIn", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("async function othersOpen(");
  const b = src.indexOf("async function turnStillMine(", a);
  assert.ok(a > 0 && b > a, "both landmarks");
  assert.match(src.slice(a, b), /return othersOpenIn\(rec, request\.part\);/);
});
