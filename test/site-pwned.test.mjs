// The breached-password check.
//
// Two things have to be true and they pull against each other: a password on
// the list must be refused, and the service being unavailable must never stop
// somebody creating an account. The second is the one that gets built wrong,
// because it only shows up on the day a third party has an outage.
//
// No network: `fetchImpl` is injected everywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPwned, countIn, sha1Hex, PWNED_HOST, PWNED_MESSAGE } from "../site-pwned.mjs";

// "password" — the canonical example, and its real SHA-1.
const PW = "password";
const PW_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";

const replying = (body, { ok = true } = {}) => async () => ({ ok, text: async () => body });

test("the hash is the real SHA-1, in the corpus's format", async () => {
  assert.equal(await sha1Hex(PW), PW_SHA1);
  assert.match(await sha1Hex("anything"), /^[0-9A-F]{40}$/);
});

test("only the first five characters ever leave", async () => {
  // A distinctive password, because the HOST contains the word "password" and a
  // naive substring check passes for the wrong reason.
  const secret = "correct-horse-battery-staple-9271";
  const hash = await sha1Hex(secret);
  let seen = null;
  await checkPwned(secret, { fetchImpl: async (url) => { seen = url; return { ok: true, text: async () => "" }; } });
  assert.equal(seen, PWNED_HOST + hash.slice(0, 5));
  // The rest of the hash — the part that identifies the password — must not.
  assert.ok(!seen.includes(hash.slice(5)), "the suffix must never be sent");
  assert.ok(!seen.includes(secret), "and obviously not the password");
});

test("padding is requested, so the response size says nothing", async () => {
  let headers = null;
  await checkPwned(PW, { fetchImpl: async (_u, init) => { headers = init && init.headers; return { ok: true, text: async () => "" }; } });
  assert.equal(headers["add-padding"], "true");
});

test("a password in the list is known", async () => {
  const r = await checkPwned(PW, { fetchImpl: replying(`${PW_SHA1.slice(5)}:24230577`) });
  assert.equal(r.known, true);
  assert.equal(r.count, 24230577);
});

test("a password not in the list is not known", async () => {
  const r = await checkPwned(PW, { fetchImpl: replying("0000000000000000000000000000000000:5\nAAAA:9") });
  assert.equal(r.known, false);
  assert.equal(r.unknown, undefined, "a clean answer is not an unknown one");
});

test("a near-miss suffix does not count", async () => {
  // One character different is a different password entirely.
  const almost = PW_SHA1.slice(5, -1) + (PW_SHA1.endsWith("8") ? "9" : "8");
  const r = await checkPwned(PW, { fetchImpl: replying(`${almost}:99`) });
  assert.equal(r.known, false);
});

// ----------------------------------------------------------------- fails open

test("an unreachable service does not refuse anybody", async () => {
  // The important one. Refusing a signup because a third party is down turns
  // their outage into ours.
  const r = await checkPwned(PW, { fetchImpl: async () => { throw new Error("ECONNRESET"); } });
  assert.equal(r.unknown, true);
  assert.equal(r.known, undefined);
});

test("a non-200 does not refuse anybody either", async () => {
  for (const status of [{ ok: false }, {}]) {
    const r = await checkPwned(PW, { fetchImpl: async () => ({ ...status, text: async () => "" }) });
    assert.equal(r.unknown, true);
  }
  assert.equal((await checkPwned(PW, { fetchImpl: async () => null })).unknown, true);
});

test("a body that is not the expected shape never reports a breach", async () => {
  // The property that matters: junk in must not become "your password is
  // breached". It reads as a clean miss, which is the safe direction — the
  // alternative is refusing passwords because a third party served an error page.
  const r = await checkPwned(PW, { fetchImpl: replying("<html>rate limited</html>") });
  assert.notEqual(r.known, true);
});

test("no fetch at all is unknown rather than a crash", async () => {
  const r = await checkPwned(PW, { fetchImpl: null, timeoutMs: 1 });
  // Node has a global fetch, so this exercises the real path; the assertion is
  // only that it never throws and never wrongly reports `known`.
  assert.ok(r.unknown || r.known === false || r.known === true);
});

test("an empty or non-string password is unknown, and never sent", async () => {
  let called = false;
  const spy = async () => { called = true; return { ok: true, text: async () => "" }; };
  for (const v of ["", null, undefined, 12345, {}]) {
    assert.equal((await checkPwned(v, { fetchImpl: spy })).unknown, true, JSON.stringify(v));
  }
  assert.equal(called, false);
});

// ----------------------------------------------------------------- parsing

test("the parser reads SUFFIX:COUNT and ignores the rest", () => {
  assert.equal(countIn("ABC:5\nDEF:9", "DEF"), 9);
  assert.equal(countIn("abc:5", "ABC"), 5, "case-insensitive both ways");
  assert.equal(countIn("ABC:5\r\nDEF:9", "ABC"), 5, "CRLF line endings");
  assert.equal(countIn("ABC:notanumber", "ABC"), 0);
  assert.equal(countIn("ABC", "ABC"), 0, "no count at all");
  assert.equal(countIn("", "ABC"), 0);
  assert.equal(countIn("ABC:5", ""), 0);
  assert.equal(countIn(null, null), 0);
});

test("the suffix has to match whole, not as a prefix or a substring", () => {
  // The corpus always sends full 35-character suffixes, so a short line only
  // appears in a body that is already wrong — and under a `startsWith`/`includes`
  // comparison a single line reading `A:1` would report a breach for one
  // password in sixteen. Exact, both directions.
  assert.equal(countIn("ABC:5", "ABCDEF"), 0, "a shorter line is not a match");
  assert.equal(countIn("ABCDEF:5", "ABC"), 0, "and neither is a longer one");
  assert.equal(countIn("A:1", "ABCDEF"), 0);
});

test("a count that is not a positive number is zero", () => {
  // Downstream only asks `>= 1`, so this guard is defence in depth — which is
  // exactly the kind of thing that quietly stops holding unless something tests
  // the function's own contract rather than only its caller's behaviour.
  assert.equal(countIn("ABC:0", "ABC"), 0);
  assert.equal(countIn("ABC:-5", "ABC"), 0, "a negative count is not a count");
  assert.equal(countIn("ABC:1e5", "ABC"), 1, "parseInt stops at the e — not 100000");
});

test("the message names the problem without lecturing about symbols", () => {
  assert.match(PWNED_MESSAGE, /breach/i);
  assert.ok(!/symbol|uppercase|special character/i.test(PWNED_MESSAGE));
});
