// The spam check is off (2026-10-28), so a page never asks for its key: on a
// draft preview the question was refused (403) and reported as a page error.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("SO1 while the spam check is off, the page never fetches its key", () => {
  const src = readFileSync(new URL("../builder/lovable/template/src/lib/spam-guard.tsx", import.meta.url), "utf8");
  assert.match(src, /export const SPAM_CHECK_ON = false;/);
  const a = src.indexOf("export function SpamGuard()"), f = src.indexOf("fetch(`/api/db/", a);
  assert.ok(a > 0 && f > a, "landmarks");
  assert.match(src.slice(a, f), /if \(!SPAM_CHECK_ON\) return;/, "the fetch is behind the switch");
});
