// PARKED (2026-11-03, park-old-way): the old-way half of test/platform-turnstile.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// 2026-10-25 (owner): Go Farther provides spam protection itself — one
// platform-wide Turnstile pair (Worker env TURNSTILE_SITE_KEY / TURNSTILE_SECRET)
// on by default for every visitor form on our own hostnames; a site's own pair
// still wins; unset is off exactly as before; a customer's own domain is not
// covered by the platform pair.
//
// 2026-10-28: the platform's Turnstile wiring (turnstileConfig, platformCovers,
// siteTurnstileKeys, enableSpamCheck) was deleted; spam protection is off by
// the owner's decision and `spamCheckOn` answers false (asserted in
// test/turnstile-half-pair.test.mjs). The pure choice functions stay, below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platformPair, chooseTurnstile } from "../../../site-turnstile.mjs";
import { editReplyFacts } from "../../../builder/site-reply.mjs";

const worker = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(i > 0 && j > i, "landmarks: " + a + " … " + b);
  return src.slice(i, j);
};
const PAIR = { TURNSTILE_SECRET: "sec-x", TURNSTILE_SITE_KEY: "key-x" };

test("the rules answer's spamCheck becomes a state fact; false or absent says nothing", () => {
  const base = { ok: true, satisfied: true, layer: "rules", applied: [], already: [], cost: 0 };
  const on = editReplyFacts({ ...base, spamCheck: true }).facts.map((f) => f.text).join(" ");
  const off = editReplyFacts({ ...base, spamCheck: false }).facts.map((f) => f.text).join(" ");
  const none = editReplyFacts(base).facts.map((f) => f.text).join(" ");
  assert.ok(off.length > 0 && none.length > 0, "observer");
  assert.match(on, /Spam protection is already on/);
  assert.doesNotMatch(off, /Spam protection/);
  assert.doesNotMatch(none, /Spam protection/);
  const miss = editReplyFacts({ ok: false, error: "no-match", cost: 0, msg: "No rule matched.", spamCheck: true }).facts.map((f) => f.text).join(" ");
  assert.match(miss, /Spam protection is already on/);
  // Every rules ending carries it from the Worker.
  const rules = between(worker, "const rSpam = () => spamCheckOn(env, ownerSlug, rdb)", 'if (eLayer === "rename")');
  assert.equal((rules.match(/spamCheck: (rOut\.reason === "no-match" \? )?await rSpam\(\)/g) || []).length, 3);
});

