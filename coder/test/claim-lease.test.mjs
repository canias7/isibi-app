// A TURN'S END IS CLAIMED FOR A WHILE, NOT FOR GOOD (2026-11-16, the all-tools live test: the web-search turn was answered,
// then the chat stayed busy for 6 minutes because the save that claimed it never finished).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");

test("CL1 /claim hands a turn's end out again once the lease is over, never twice within it", async () => {
  const { CLAIM_LEASE_MS } = await import("../container/server.mjs");
  assert.ok(CLAIM_LEASE_MS >= 35_000 && CLAIM_LEASE_MS <= 120_000, "longer than a background save may run (30 s), short enough to matter");
  const i = src.indexOf('url.pathname === "/claim"');
  const body = src.slice(i, i + 900);
  assert.match(body, /t\.claimed && Date\.now\(\) - Number\(t\.claimed\) < CLAIM_LEASE_MS\)\) return send\(200, \{ ok: false \}\)/);
  assert.match(body, /t\.claimed = Date\.now\(\);/);
  // The rule itself, as the handler applies it.
  const may = (t, now) => !(!t || !t.result || (t.claimed && now - Number(t.claimed) < CLAIM_LEASE_MS));
  const t = { result: { status: "done" }, claimed: false };
  assert.equal(may(t, 1_000_000), true, "first claim");
  t.claimed = 1_000_000;
  assert.equal(may(t, 1_000_000 + 5_000), false, "a second look while the save runs waits");
  assert.equal(may(t, 1_000_000 + CLAIM_LEASE_MS + 1), true, "a save that never finished: claimed again");
});
