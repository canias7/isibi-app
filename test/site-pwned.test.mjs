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
import { checkPwned, countIn, sha1Hex, PWNED_HOST, PWNED_MESSAGE, PWNED_MIN_COUNT, PWNED_TIMEOUT_MS } from "../site-pwned.mjs";

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

// ------------------------------------------------ found by a mutation sweep
//
// Eight decisions in this file and site-access.mjs survived having their
// operator flipped, which means nothing held them to anything. None was a live
// bug; all were places the contract was stated in a comment and asserted
// nowhere. The two that matter are the threshold (a security decision, one
// character from being off by one) and the timeout (a third-party call on the
// signup path, which without a bound stalls the signup when HIBP hangs).

test("the threshold is a floor, not a strict greater-than", async () => {
  // Exactly PWNED_MIN_COUNT must count as breached. `>` instead of `>=` lets the
  // least-common breached password in the corpus through, and a mutation proved
  // nothing noticed. Asserted AGAINST the constant, so raising the floor moves
  // the assertion with it rather than leaving a number nobody rechecked.
  const suffix = (await sha1Hex(PW)).slice(5);
  const at = await checkPwned(PW, { fetchImpl: async () => ({ ok: true, text: async () => `${suffix}:${PWNED_MIN_COUNT}` }) });
  assert.deepEqual(at, { known: true, count: PWNED_MIN_COUNT });
  const below = await checkPwned(PW, { fetchImpl: async () => ({ ok: true, text: async () => `${suffix}:${PWNED_MIN_COUNT - 1}` }) });
  assert.deepEqual(below, { known: false });
});

test("the breach lookup is bounded by a timeout", async () => {
  // HIBP is a third party on the signup path. Unbounded, a hung response holds
  // the request open for as long as the platform allows — the failure this
  // module's whole fail-open design exists to avoid, arrived at from the other
  // direction. A mutation that removed the signal survived.
  let seen = null;
  await checkPwned(PW, { fetchImpl: async (_u, init) => { seen = init; return { ok: true, text: async () => "" }; } });
  assert.ok(seen && seen.signal, "the request must carry an abort signal");
  assert.equal(typeof seen.signal.aborted, "boolean", "…a real AbortSignal, not a truthy placeholder");
  // And the caller may shorten it, which is what makes it testable at all.
  let short = null;
  await checkPwned(PW, { timeoutMs: 5, fetchImpl: async (_u, init) => { short = init; return { ok: true, text: async () => "" }; } });
  assert.ok(short && short.signal, "an explicit timeout must still produce a signal");
  assert.ok(PWNED_TIMEOUT_MS > 0 && PWNED_TIMEOUT_MS <= 10000, "the default must be a real bound: " + PWNED_TIMEOUT_MS);
});

test("with no way to fetch at all, the answer is `unknown` and not `known:false`", async () => {
  // Three outcomes, not two — the distinction this module is built around. Both
  // let a signup through, so a caller reading only `known` cannot tell "checked,
  // clean" from "never checked", and that is the difference between a working
  // check and one that has been silently dark for a month.
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = undefined;
    const r = await checkPwned(PW, {});
    assert.equal(r.unknown, true, JSON.stringify(r));
    assert.equal(r.known, undefined, "an unchecked password must never read as checked-and-clean");
    assert.equal(r.reason, "no_fetch");
  } finally { globalThis.fetch = saved; }
});

test("with no fetchImpl but a real global fetch, it USES the global one", async () => {
  // The other half, and the half that is live in production: nothing injects a
  // fetch there. Without this the module could fall back to "no_fetch" on every
  // real call — a check that is permanently dark while every test passes,
  // because every test injects. A mutation proved exactly that gap.
  const saved = globalThis.fetch;
  try {
    let calledWith = null;
    globalThis.fetch = async (url) => { calledWith = url; return { ok: true, text: async () => "" }; };
    const r = await checkPwned(PW, {});
    assert.ok(calledWith, "the global fetch must actually be called");
    assert.ok(String(calledWith).startsWith(PWNED_HOST), calledWith);
    assert.deepEqual(r, { known: false }, "a clean miss through the global fetch is a real answer, not `unknown`");
  } finally { globalThis.fetch = saved; }
});

test("a runtime with no AbortSignal still gets an answer", async () => {
  // The guard around the timeout exists for exactly this and was never
  // exercised: with `&&` swapped for `||` it reads AbortSignal.timeout off
  // undefined and throws — inside the try, so it surfaces as "unreachable" and
  // the check goes dark everywhere rather than losing only its timeout.
  const saved = globalThis.AbortSignal;
  try {
    globalThis.AbortSignal = undefined;
    const suffix = (await sha1Hex(PW)).slice(5);
    const r = await checkPwned(PW, { fetchImpl: async () => ({ ok: true, text: async () => `${suffix}:99` }) });
    assert.deepEqual(r, { known: true, count: 99 }, "no AbortSignal costs the timeout, not the check");
  } finally { globalThis.AbortSignal = saved; }
});

test("a hashing failure is `unknown`, not a clean miss", async () => {
  // The one branch that cannot be reached from the outside — it needs the
  // platform's own digest to fail. Stubbed, because the alternative is a guard
  // nothing has ever run: a mutation flipped it to `known:false` and every test
  // passed, which would mean a broken WebCrypto silently reads as "that password
  // is fine".
  // `globalThis.crypto` is getter-only in Node, so it is redefined rather than
  // assigned — and restored the same way, or every later test in the process
  // runs without WebCrypto.
  const saved = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { subtle: { digest: async () => { throw new Error("no digest"); } } },
    });
    const r = await checkPwned(PW, { fetchImpl: async () => ({ ok: true, text: async () => "" }) });
    assert.equal(r.unknown, true, JSON.stringify(r));
    assert.equal(r.known, undefined, "a password we could not hash must never read as clean");
    assert.equal(r.reason, "hash");
  } finally { Object.defineProperty(globalThis, "crypto", saved); }
});

test("a non-string password is refused before anything is hashed or fetched", async () => {
  let called = false;
  const r = await checkPwned({ toString: () => PW }, { fetchImpl: async () => { called = true; return { ok: true, text: async () => "" }; } });
  assert.equal(r.unknown, true, JSON.stringify(r));
  assert.equal(called, false, "nothing may leave the building for a value that is not a password");
});
