// Visitor accounts for published sites.
//
// This is the code where a bug is not recoverable by fixing it later — a token
// accepted for the wrong site, an expired session honoured, a reset link
// replayed as a login. Every one of those is silent, and every one of them means
// somebody read somebody else's data.
//
// The crypto is real (WebCrypto, the same primitives the Worker uses); only the
// clock is injected, because expiry has to be testable without waiting a month.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ctEq, hashPassword, verifyPassword, sessionKey, signToken, verifyToken,
  verifySession, signReset, verifyReset, normalizeEmail, checkPassword,
  PBKDF2_ITERATIONS, SESSION_TTL_SEC, MIN_PASSWORD,
} from "../site-auth.mjs";

const SECRET = "service-key-stand-in";
const NOW = 1_780_000_000_000;
// Tests run the real KDF; a low count keeps the suite fast without changing what
// is being tested, because the iteration count is stored in the hash.
const FAST = { iterations: 1000 };

// ------------------------------------------------------------ compare

test("constant-time compare matches only identical strings", () => {
  assert.equal(ctEq("abc", "abc"), true);
  assert.equal(ctEq("abc", "abd"), false);
  assert.equal(ctEq("abcdef", "abc"), false, "a prefix is not a match");
  assert.equal(ctEq("abc", "abcdef"), false);
});

// ------------------------------------------------------------ passwords

test("a password verifies against its own hash", async () => {
  const h = await hashPassword("correct horse battery", FAST);
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("Correct horse battery", h), false, "case matters");
  assert.equal(await verifyPassword("", h), false);
});

test("the same password hashes differently every time", async () => {
  // A per-record salt is what stops one rainbow table covering every account on
  // the platform, and stops two customers with the same password being visibly
  // identical in the table.
  const a = await hashPassword("hunter2hunter2", FAST);
  const b = await hashPassword("hunter2hunter2", FAST);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("hunter2hunter2", a), true);
  assert.equal(await verifyPassword("hunter2hunter2", b), true);
});

test("the hash is self-describing, so the cost can be raised later", async () => {
  // Existing accounts must keep working when PBKDF2_ITERATIONS goes up.
  const old = await hashPassword("longenoughpassword", { iterations: 1000 });
  assert.match(old, /^pbkdf2\$1000\$/);
  assert.equal(await verifyPassword("longenoughpassword", old), true, "an old-cost record still logs in");
  const now = await hashPassword("longenoughpassword");
  assert.match(now, new RegExp("^pbkdf2\\$" + PBKDF2_ITERATIONS + "\\$"));
  // Cloudflare Workers throws above 100k, so a request for more is clamped
  // rather than allowed to fail deep inside WebCrypto as an unexplained 500.
  assert.match(await hashPassword("longenoughpassword", { iterations: 9_000_000 }),
    new RegExp("^pbkdf2\\$" + PBKDF2_ITERATIONS + "\\$"), "an over-limit request is clamped");
});

test("a malformed or hostile stored hash is refused, never thrown on", async () => {
  for (const bad of ["", null, undefined, "notahash", "pbkdf2$x$y$z", "pbkdf2$1000$$abc",
    "md5$1000$aa$bb", "pbkdf2$1000$aa", "pbkdf2$1000$aa$bb$cc", 42, {}]) {
    assert.equal(await verifyPassword("anything", bad), false, JSON.stringify(bad));
  }
});

test("a downgraded iteration count is refused even when the hash is correct", async () => {
  // The attack: anything that can write to site_users rewrites a record to one
  // PBKDF2 iteration. The password still verifies, so nobody notices — and the
  // stored hash is now brute-forceable in seconds. The count comes from the
  // record, so it has to be bounded on the way back IN.
  //
  // A GENUINELY VALID one-iteration hash, not a fixture that fails anyway:
  const downgraded = await hashPassword("longenoughpassword", { iterations: 1 });
  assert.match(downgraded, /^pbkdf2\$1\$/);
  assert.equal(await verifyPassword("longenoughpassword", downgraded), false,
    "the hash is arithmetically correct and must still be refused");

  // And the other end: an unbounded count is a way to hang the isolate from a
  // public endpoint. Refused without ever running the KDF.
  const t0 = Date.now();
  assert.equal(await verifyPassword("x", "pbkdf2$99000000$AAAAAAAAAAAAAAAAAAAAAA$AAAA"), false);
  assert.ok(Date.now() - t0 < 1000, "it must refuse without attempting 99M iterations");
});

// ------------------------------------------------- the multi-tenant boundary

test("a token minted for one site does not work on another", async () => {
  // THE test. Without the slug in the key derivation, signing up to any site on
  // the platform would authenticate you as that visitor on every other site —
  // one account space shared across every published site.
  const kCafe = await sessionKey(SECRET, "cafe");
  const kBarber = await sessionKey(SECRET, "barber");
  const t = await signToken(kCafe, { sub: "v1" }, { nowMs: NOW });
  assert.ok(await verifyToken(kCafe, t, { nowMs: NOW }), "valid on its own site");
  assert.equal(await verifyToken(kBarber, t, { nowMs: NOW }), null, "and worthless on any other");
});

test("the slug is matched case-insensitively", async () => {
  const a = await sessionKey(SECRET, "Cafe");
  const b = await sessionKey(SECRET, "cafe");
  const t = await signToken(a, { sub: "v1" }, { nowMs: NOW });
  assert.ok(await verifyToken(b, t, { nowMs: NOW }), "slugs are lowercased everywhere else too");
});

test("a different server secret invalidates every token", async () => {
  const k1 = await sessionKey("secret-one", "cafe");
  const k2 = await sessionKey("secret-two", "cafe");
  const t = await signToken(k1, { sub: "v1" }, { nowMs: NOW });
  assert.equal(await verifyToken(k2, t, { nowMs: NOW }), null);
});

// ------------------------------------------------------------ sessions

test("a signed token round-trips its subject", async () => {
  const k = await sessionKey(SECRET, "cafe");
  const t = await signToken(k, { sub: "v1", email: "a@b.com" }, { nowMs: NOW });
  const body = await verifyToken(k, t, { nowMs: NOW });
  assert.equal(body.sub, "v1");
  assert.equal(body.email, "a@b.com");
  assert.equal(body.exp - body.iat, SESSION_TTL_SEC);
});

test("a tampered payload is refused", async () => {
  // The attack: swap your own visitor id for someone else's and keep the
  // signature. Base64url is trivially editable, so only the HMAC stops this.
  const k = await sessionKey(SECRET, "cafe");
  const t = await signToken(k, { sub: "v1" }, { nowMs: NOW });
  const [payload, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "v2", exp: 9e9 })).toString("base64url");
  assert.equal(await verifyToken(k, forged + "." + sig, { nowMs: NOW }), null);
});

test("an expired session is refused", async () => {
  const k = await sessionKey(SECRET, "cafe");
  const t = await signToken(k, { sub: "v1" }, { nowMs: NOW, ttlSec: 60 });
  assert.ok(await verifyToken(k, t, { nowMs: NOW + 59_000 }));
  assert.equal(await verifyToken(k, t, { nowMs: NOW + 60_000 }), null, "exactly at expiry it is gone");
  assert.equal(await verifyToken(k, t, { nowMs: NOW + 999_000 }), null);
});

test("a token with no subject is refused", async () => {
  // An identity-less session would resolve to `undefined` and then scope rows to
  // `owner_id = undefined`, which is not a safe thing to guess at.
  const k = await sessionKey(SECRET, "cafe");
  const t = await signToken(k, {}, { nowMs: NOW });
  assert.equal(await verifyToken(k, t, { nowMs: NOW }), null);
});

test("junk is refused without throwing", async () => {
  // This runs on every request a logged-in visitor makes. A throw here is a 500
  // on an ordinary event.
  const k = await sessionKey(SECRET, "cafe");
  for (const bad of ["", null, undefined, ".", "a.", ".b", "abc", "a.b.c",
    "!!!.???", "e30.", 42, {}, "a".repeat(5000)]) {
    assert.equal(await verifyToken(k, bad, { nowMs: NOW }), null, String(JSON.stringify(bad)).slice(0, 40));
  }
});

// ------------------------------------------------- reset vs login separation

test("a reset link cannot be used as a login", async () => {
  // A password-reset link sits in an inbox, gets forwarded, ends up in logs. If
  // it doubled as a session it would be a permanent credential.
  const k = await sessionKey(SECRET, "cafe");
  const r = await signReset(k, "v1", { nowMs: NOW });
  assert.ok(await verifyReset(k, r, { nowMs: NOW }));
  assert.equal(await verifySession(k, r, { nowMs: NOW }), null, "a reset token is not a session");
});

test("a login token cannot be used to reset a password", async () => {
  // The mirror. Otherwise stealing any session lets you take the account
  // permanently rather than until it expires.
  const k = await sessionKey(SECRET, "cafe");
  const s = await signToken(k, { sub: "v1" }, { nowMs: NOW });
  assert.ok(await verifySession(k, s, { nowMs: NOW }));
  assert.equal(await verifyReset(k, s, { nowMs: NOW }), null);
});

test("a reset link expires in an hour, not a month", async () => {
  const k = await sessionKey(SECRET, "cafe");
  const r = await signReset(k, "v1", { nowMs: NOW });
  assert.ok(await verifyReset(k, r, { nowMs: NOW + 3_599_000 }));
  assert.equal(await verifyReset(k, r, { nowMs: NOW + 3_601_000 }), null);
});

// ------------------------------------------------------------ input

test("emails are normalised, and nonsense is refused", async () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
  for (const bad of ["", "  ", "nope", "a@b", "a@@b.com", "a b@c.com", "@b.com",
    "a@.com", null, undefined, "x".repeat(250) + "@example.com"]) {
    assert.equal(normalizeEmail(bad), null, String(JSON.stringify(bad)).slice(0, 30));
  }
});

test("passwords have a floor and a ceiling", () => {
  assert.equal(checkPassword("a".repeat(MIN_PASSWORD)).ok, true);
  assert.equal(checkPassword("a".repeat(MIN_PASSWORD - 1)).ok, false);
  // Bounded because the Worker pays the PBKDF2 cost, not the sender: an
  // unbounded password is a free way to burn CPU on a public endpoint.
  assert.equal(checkPassword("a".repeat(5000)).ok, false);
  // Not "anything stringifiable": String({}) is "[object Object]", fifteen
  // characters, which passed the length floor — so a client sending an object
  // would create an account whose password every such account shares.
  for (const bad of [null, undefined, 12345678, {}, [], true, { toString: () => "longenough" }]) {
    assert.equal(checkPassword(bad).ok, false, String(JSON.stringify(bad)));
  }
});
