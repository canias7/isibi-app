// Codes — the authenticator kind and the emailed kind.
//
// TOTP is checked against the RFC 6238 test vectors, because "my implementation
// agrees with itself" proves nothing about whether Google Authenticator will
// agree with it. The rest is about the two ways a code layer fails quietly: a
// window wide enough to brute force, and a code that can be used twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newTotpSecret, base32Decode, totpCode, verifyTotp, totpUri,
  TOTP_STEP_SEC, TOTP_DIGITS, TOTP_WINDOW,
  newRecoveryCodes, normalizeRecovery, RECOVERY_COUNT,
  newEmailCode, codeMatches, EMAIL_CODE_TTL_SEC, EMAIL_CODE_ATTEMPTS,
} from "../site-otp.mjs";

// The RFC's shared secret is the ASCII "12345678901234567890".
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("TOTP matches the RFC 6238 test vectors", async () => {
  // If these pass, every authenticator app in the world agrees with us.
  const vectors = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(await totpCode(RFC_SECRET, { nowMs: seconds * 1000 }), expected, "t=" + seconds);
  }
});

test("a code verifies inside the drift window and not outside it", async () => {
  const now = 1_780_000_000_000;
  const secret = newTotpSecret();
  const code = await totpCode(secret, { nowMs: now });

  assert.notEqual(await verifyTotp(secret, code, { nowMs: now }), null);
  // One step either side — a phone whose clock is thirty seconds out still works.
  assert.notEqual(await verifyTotp(secret, code, { nowMs: now + TOTP_STEP_SEC * 1000 }), null);
  assert.notEqual(await verifyTotp(secret, code, { nowMs: now - TOTP_STEP_SEC * 1000 }), null);
  // Five steps out is refused, stated as a fixed number rather than derived from
  // TOTP_WINDOW — deriving it means widening the window silently widens the test
  // too, and a window of ten steps would sail through.
  assert.ok(TOTP_WINDOW <= 2, "a wider window is more codes an attacker may guess");
  assert.equal(await verifyTotp(secret, code, { nowMs: now + 5 * TOTP_STEP_SEC * 1000 }), null);
  assert.equal(await verifyTotp(secret, code, { nowMs: now - 5 * TOTP_STEP_SEC * 1000 }), null);
});

test("a code cannot be used twice", async () => {
  // It stays valid for up to ninety seconds, so somebody watching the network
  // gets a free login unless the accepted step is remembered.
  const now = 1_780_000_000_000;
  const secret = newTotpSecret();
  const code = await totpCode(secret, { nowMs: now });
  const step = await verifyTotp(secret, code, { nowMs: now });
  assert.notEqual(step, null);
  assert.equal(await verifyTotp(secret, code, { nowMs: now, lastStep: step }), null);
});

test("an older code is refused once a newer one has been used", async () => {
  const now = 1_780_000_000_000;
  const secret = newTotpSecret();
  const older = await totpCode(secret, { nowMs: now, step: -1 });
  const current = await totpCode(secret, { nowMs: now });
  const step = await verifyTotp(secret, current, { nowMs: now });
  assert.equal(await verifyTotp(secret, older, { nowMs: now, lastStep: step }), null);
});

test("a wrong code, a short code and rubbish are all refused", async () => {
  const secret = newTotpSecret();
  const now = 1_780_000_000_000;
  for (const c of ["000000", "12345", "1234567", "abcdef", "", null, undefined]) {
    assert.equal(await verifyTotp(secret, c, { nowMs: now }), null, JSON.stringify(c));
  }
});

test("a VALID code with extra digits on the end is still refused", async () => {
  // The case the length check exists for: a fixed-length compare loop reads only
  // the first six characters, so `<correct code>9` would otherwise match.
  const secret = newTotpSecret();
  const now = 1_780_000_000_000;
  const code = await totpCode(secret, { nowMs: now });
  assert.notEqual(await verifyTotp(secret, code, { nowMs: now }), null, "sanity");
  assert.equal(await verifyTotp(secret, code + "9", { nowMs: now }), null);
  assert.equal(await verifyTotp(secret, "9" + code, { nowMs: now }), null);
});

test("another account's secret does not verify this code", async () => {
  const now = 1_780_000_000_000;
  const a = newTotpSecret(), b = newTotpSecret();
  const code = await totpCode(a, { nowMs: now });
  assert.equal(await verifyTotp(b, code, { nowMs: now }), null);
});

test("a secret is base32 an authenticator can read, and does not repeat", () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const s = newTotpSecret();
    assert.match(s, /^[A-Z2-7]+$/);
    assert.ok(base32Decode(s).length >= 20, "160 bits, per the RFC");
    seen.add(s);
  }
  assert.equal(seen.size, 100);
});

test("base32 decoding tolerates spaces and case, and refuses non-base32", () => {
  assert.deepEqual([...base32Decode("gezd gnbv")], [...base32Decode("GEZDGNBV")]);
  assert.equal(base32Decode(""), null);
  assert.equal(base32Decode("!!!!"), null, "nothing decodable left");
});

test("a missing or unreadable secret verifies nothing", async () => {
  assert.equal(await totpCode("", {}), null);
  assert.equal(await verifyTotp("", "123456", {}), null);
  assert.equal(await verifyTotp(null, "123456", {}), null);
});

test("the otpauth uri carries what an app needs to scan", () => {
  const uri = totpUri({ secret: RFC_SECRET, account: "ada@example.com", issuer: "Sharp Fade" });
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
  assert.ok(uri.includes(encodeURIComponent("ada@example.com")));
});

// --------------------------------------------------------------- recovery

test("recovery codes are unique, readable and the right count", () => {
  const codes = newRecoveryCodes();
  assert.equal(codes.length, RECOVERY_COUNT);
  assert.equal(new Set(codes).size, RECOVERY_COUNT);
  for (const c of codes) {
    assert.match(c, /^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/, c);
    assert.ok(!/[ilo01]/.test(c), "no characters that get misread: " + c);
  }
});

test("a recovery code normalizes past case and dashes", () => {
  const [c] = newRecoveryCodes();
  assert.equal(normalizeRecovery(c.toUpperCase()), c.replace("-", ""));
  assert.equal(normalizeRecovery(c.replace("-", " ")), c.replace("-", ""));
  assert.equal(normalizeRecovery("short"), null);
  assert.equal(normalizeRecovery(null), null);
});

// --------------------------------------------------------------- emailed codes

test("an emailed code is six digits and does not repeat", () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const c = newEmailCode();
    assert.match(c, /^\d{6}$/);
    seen.add(c);
  }
  assert.ok(seen.size > 250, "a generator collapsing to a few values would show here");
});

test("emailed codes compare only when they match exactly", () => {
  assert.equal(codeMatches("123456", "123456"), true);
  assert.equal(codeMatches("12 34 56", "123456"), true, "people paste with spaces");
  assert.equal(codeMatches("123457", "123456"), false);
  assert.equal(codeMatches("12345", "123456"), false);
  assert.equal(codeMatches("", "123456"), false);
  assert.equal(codeMatches("123456", ""), false);
  assert.equal(codeMatches(null, null), false, "two blanks are not a match");
});

test("the limits are the ones that make a six-digit code safe", () => {
  // A million possibilities is nothing against unlimited attempts; the attempt
  // cap is the control, not the length.
  assert.ok(EMAIL_CODE_ATTEMPTS <= 10);
  assert.ok(EMAIL_CODE_TTL_SEC <= 15 * 60);
  assert.equal(TOTP_DIGITS, 6);
});
