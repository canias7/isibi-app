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
import { platformPair, chooseTurnstile } from "../site-turnstile.mjs";
import { editReplyFacts } from "../builder/site-reply.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const deploy = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const between = (src, a, b) => {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(i > 0 && j > i, "landmarks: " + a + " … " + b);
  return src.slice(i, j);
};
const PAIR = { TURNSTILE_SECRET: "sec-x", TURNSTILE_SITE_KEY: "key-x" };

test("platformPair: both set is the pair; unset, empty, the deploy's '-' or half a pair is off", () => {
  assert.deepEqual(platformPair(PAIR), { secret: "sec-x", siteKey: "key-x" });
  assert.equal(platformPair({}), null);
  assert.equal(platformPair(undefined), null);
  assert.equal(platformPair({ TURNSTILE_SECRET: "-", TURNSTILE_SITE_KEY: "-" }), null);
  assert.equal(platformPair({ TURNSTILE_SECRET: "", TURNSTILE_SITE_KEY: "key-x" }), null);
  assert.equal(platformPair({ TURNSTILE_SECRET: "sec-x" }), null);
  assert.equal(platformPair({ TURNSTILE_SECRET: "sec-x", TURNSTILE_SITE_KEY: "-" }), null);
  assert.equal(platformPair({ TURNSTILE_SECRET: ["sec-x"], TURNSTILE_SITE_KEY: "key-x" }), null);
});

test("chooseTurnstile: the site's own pair wins; the platform's only where covered; otherwise as today", () => {
  const own = { secret: "own-s", siteKey: "own-k" };
  assert.deepEqual(chooseTurnstile(own, PAIR, { covered: true }), { ...own, source: "site" });
  assert.deepEqual(chooseTurnstile({ secret: "", siteKey: "" }, PAIR, { covered: true }), { secret: "sec-x", siteKey: "key-x", source: "platform" });
  // A customer's own domain (not covered): off without its own pair.
  assert.equal(chooseTurnstile({ secret: "", siteKey: "" }, PAIR, { covered: false }).secret, "");
  assert.equal(chooseTurnstile({ secret: "", siteKey: "" }, PAIR, { covered: "true" }).secret, "");
  assert.equal(chooseTurnstile({ secret: "", siteKey: "" }, PAIR, {}).secret, "");
  // Platform unset: exactly as before.
  assert.deepEqual(chooseTurnstile({ secret: "", siteKey: "" }, {}, { covered: true }), { secret: "", siteKey: "", source: "off" });
});

test("published sites may load Turnstile's script and frame", () => {
  // (2026-10-28: the site policy lives in site-headers.mjs, shared with the front door.)
  const hdr = readFileSync(new URL("../site-headers.mjs", import.meta.url), "utf8");
  const csp = between(hdr, "export function publishedSiteCsp(", '].join("; ")');
  const script = csp.match(/"script-src [^"]*"/);
  const frame = csp.match(/"frame-src [^"]*"/);
  assert.ok(script && script[0].includes("https://challenges.cloudflare.com"), "the widget script is refused");
  assert.ok(frame && frame[0].includes("https://challenges.cloudflare.com"), "the challenge frame is refused");
});

test("deploy.yml uploads both names as optional secrets with a non-empty fallback", () => {
  const list = between(deploy, "          secrets: |\n", "        env:");
  for (const n of ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET"]) {
    assert.match(list, new RegExp("^\\s+" + n + "$", "m"), n + " is not uploaded");
    assert.ok(deploy.includes(n + ": ${{ secrets." + n + " || '-' }}"), n + " has no '-' fallback");
  }
});

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

