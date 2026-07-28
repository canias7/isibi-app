// The visitor-account endpoints.
//
// Most of what is tested here is what these routes must NOT say. A login that
// answers differently for "no such account" than for "wrong password" tells a
// stranger who banks, drinks or gets their hair cut at a given business — and on
// a platform where anyone can publish a site about anything, that is the leak
// that matters more than the password itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleSiteAuth } from "../site-auth-routes.mjs";
import { hashPassword, sessionKey, signToken, signReset, verifySession } from "../site-auth.mjs";

const SECRET = "server-only";
const NOW = 1_780_000_000_000;
const PW = "correct horse battery";
const FAST = { iterations: 1000 };

async function harness(over = {}) {
  const users = new Map(); // "slug|email" -> row
  const byId = new Map();
  const calls = { sent: [], throttled: [], setPassword: [], touched: [] };
  let nextId = 1;

  if (over.withUser !== false) {
    const row = { id: "u1", email: "member@example.com", password_hash: await hashPassword(PW, FAST) };
    users.set("cafe|member@example.com", row);
    byId.set("u1", row);
  }
  const deps = {
    findUser: async (slug, email) => users.get(`${slug}|${email}`) || null,
    findUserById: async (slug, id) => byId.get(String(id)) || null,
    createUser: async (slug, email, hash) => {
      if (users.has(`${slug}|${email}`)) return { conflict: true };
      const row = { id: "u" + ++nextId, email, password_hash: hash };
      users.set(`${slug}|${email}`, row); byId.set(row.id, row);
      return { id: row.id };
    },
    setPassword: async (id, hash) => { calls.setPassword.push(id); byId.get(String(id)).password_hash = hash; },
    touchLogin: async (id) => { calls.touched.push(id); },
    secret: async () => SECRET,
    sendReset: async (email, token) => { calls.sent.push({ email, token }); },
    throttle: async (k) => { calls.throttled.push(k); return over.throttled ? { ok: false, retryAfter: 30 } : { ok: true }; },
    ...(over.deps || {}),
  };
  return { deps, calls, users, byId };
}

const call = (deps, action, opts = {}) => handleSiteAuth(deps, { slug: "cafe", action, nowMs: NOW, ...opts });

// ------------------------------------------------------------- signup

test("signup creates an account and returns a usable session", async () => {
  const { deps } = await harness();
  const r = await call(deps, "signup", { body: { email: "New@Example.com ", password: "a-long-password" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, "new@example.com", "the address is normalised before it is stored");
  const key = await sessionKey(SECRET, "cafe");
  const claims = await verifySession(key, r.body.token, { nowMs: NOW });
  assert.equal(claims.sub, r.body.user.id);
});

test("signup refuses a bad address or a weak password before hashing anything", async () => {
  const { deps, calls } = await harness();
  assert.equal((await call(deps, "signup", { body: { email: "nope", password: "a-long-password" } })).status, 400);
  assert.equal((await call(deps, "signup", { body: { email: "a@b.com", password: "short" } })).status, 400);
  assert.equal((await call(deps, "signup", { body: { email: "a@b.com", password: { } } })).status, 400);
  assert.deepEqual(calls.throttled, [], "validation comes first, so junk cannot consume the throttle budget");
});

test("signup on an existing address is a 409 — a documented tradeoff", async () => {
  // This DOES confirm the address has an account here. The privacy-preserving
  // alternative needs a working mailer, and a site without one would silently
  // never sign anyone up. Chosen deliberately, not overlooked.
  const { deps } = await harness();
  const r = await call(deps, "signup", { body: { email: "member@example.com", password: "a-long-password" } });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "exists");
});

// ------------------------------------------------------------- login

test("login returns a session for the right password", async () => {
  const { deps, calls } = await harness();
  const r = await call(deps, "login", { body: { email: "member@example.com", password: PW } });
  assert.equal(r.status, 200);
  assert.deepEqual(calls.touched, ["u1"], "last_login_at is updated");
  const key = await sessionKey(SECRET, "cafe");
  assert.ok(await verifySession(key, r.body.token, { nowMs: NOW }));
});

test("a wrong password and an unknown address are indistinguishable", async () => {
  // Same status, same message, no `code` to tell them apart. Otherwise the login
  // form is an address-lookup service for this business's customer list.
  const { deps } = await harness();
  const wrong = await call(deps, "login", { body: { email: "member@example.com", password: "not-the-password" } });
  const absent = await call(deps, "login", { body: { email: "nobody@example.com", password: "not-the-password" } });
  assert.equal(wrong.status, 401);
  assert.equal(absent.status, 401);
  assert.deepEqual(wrong.body, absent.body, "the responses must be byte-identical");
});

test("an unknown address still pays for a verification", async () => {
  // Answering "no such account" instantly while a wrong password takes the full
  // PBKDF2 cost is a timing oracle. The dummy hash is what removes it — so a
  // lookup that never runs verifyPassword is the bug.
  const seen = [];
  const { deps } = await harness({ deps: { findUser: async () => { seen.push("looked"); return null; } } });
  const t0 = Date.now();
  const r = await call(deps, "login", { body: { email: "nobody@example.com", password: "whatever-long" } });
  const spent = Date.now() - t0;
  assert.equal(r.status, 401);
  assert.ok(spent > 5, `a miss must not return instantly (took ${spent}ms)`);
});

test("login is throttled per site AND per address", async () => {
  // Per-address, because a brute force targets one account. Per-site alone would
  // let one attacker lock out every visitor of that site.
  const { deps, calls } = await harness();
  await call(deps, "login", { body: { email: "member@example.com", password: "x" } });
  assert.deepEqual(calls.throttled, ["login:cafe:member@example.com"]);
});

test("a throttled login is refused before the password is checked", async () => {
  const { deps, calls } = await harness({ throttled: true });
  const r = await call(deps, "login", { body: { email: "member@example.com", password: PW } });
  assert.equal(r.status, 429);
  assert.deepEqual(calls.touched, [], "no work is done for a throttled caller");
});

// ------------------------------------------------------------- me

test("me resolves a session to the current account", async () => {
  const key = await sessionKey(SECRET, "cafe");
  const { deps } = await harness();
  const token = await signToken(key, { sub: "u1", email: "member@example.com" }, { nowMs: NOW });
  const r = await call(deps, "me", { token });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, "member@example.com");
});

test("me reads storage, so a deleted account stops working at once", async () => {
  // The token is good for thirty days. Trusting its copy of the identity would
  // keep a deleted member signed in for a month.
  const key = await sessionKey(SECRET, "cafe");
  const { deps, byId } = await harness();
  const token = await signToken(key, { sub: "u1", email: "member@example.com" }, { nowMs: NOW });
  byId.delete("u1");
  assert.equal((await call(deps, "me", { token })).status, 401);
});

test("me refuses a missing, junk, expired or foreign token", async () => {
  const { deps } = await harness();
  const key = await sessionKey(SECRET, "cafe");
  const other = await sessionKey(SECRET, "barber");
  assert.equal((await call(deps, "me", { token: undefined })).status, 401);
  assert.equal((await call(deps, "me", { token: "garbage" })).status, 401);
  assert.equal((await call(deps, "me", { token: await signToken(key, { sub: "u1" }, { nowMs: NOW, ttlSec: 1 }) , nowMs: NOW + 5000 })).status, 401);
  assert.equal((await call(deps, "me", { token: await signToken(other, { sub: "u1" }, { nowMs: NOW }) })).status, 401,
    "a token from another site on the same platform");
});

test("a reset link is not a session", async () => {
  const key = await sessionKey(SECRET, "cafe");
  const { deps } = await harness();
  const r = await call(deps, "me", { token: await signReset(key, "u1", { nowMs: NOW }) });
  assert.equal(r.status, 401, "a link out of an inbox must not be a login");
});

// ------------------------------------------------------------- reset

test("requesting a reset for a real address sends a link", async () => {
  const { deps, calls } = await harness();
  const r = await call(deps, "reset", { body: { email: "member@example.com" } });
  assert.equal(r.status, 200);
  assert.equal(calls.sent.length, 1);
  assert.equal(calls.sent[0].email, "member@example.com");
});

test("requesting a reset for an unknown address answers identically", async () => {
  // The classic enumeration leak, and unlike signup this one costs nothing to
  // close: the user is told "check your inbox" either way.
  const { deps, calls } = await harness();
  const real = await call(deps, "reset", { body: { email: "member@example.com" } });
  const fake = await call(deps, "reset", { body: { email: "nobody@example.com" } });
  assert.deepEqual(real, fake, "byte-identical responses");
  assert.equal(calls.sent.length, 1, "and only the real one is mailed");
});

test("a mailer failure is not an existence oracle either", async () => {
  const { deps } = await harness({ deps: { sendReset: async () => { throw new Error("smtp down"); } } });
  const real = await call(deps, "reset", { body: { email: "member@example.com" } });
  const fake = await call(deps, "reset", { body: { email: "nobody@example.com" } });
  assert.equal(real.status, 200);
  assert.deepEqual(real, fake);
});

test("even a throttled reset request answers 200", async () => {
  // A 429 for known addresses and a 200 for unknown ones would rebuild exactly
  // the oracle the rest of this is closing.
  const { deps, calls } = await harness({ throttled: true });
  const r = await call(deps, "reset", { body: { email: "member@example.com" } });
  assert.equal(r.status, 200);
  assert.equal(calls.sent.length, 0);
});

test("a reset link sets a new password", async () => {
  const key = await sessionKey(SECRET, "cafe");
  const { deps, calls, byId } = await harness();
  const token = await signReset(key, "u1", { nowMs: NOW });
  const r = await call(deps, "reset", { body: { token, password: "a-brand-new-password" } });
  assert.equal(r.status, 200);
  assert.deepEqual(calls.setPassword, ["u1"]);
  assert.match(byId.get("u1").password_hash, /^pbkdf2\$/);
});

test("an expired, forged or foreign reset link is refused", async () => {
  const key = await sessionKey(SECRET, "cafe");
  const other = await sessionKey(SECRET, "barber");
  const { deps, calls } = await harness();
  const cases = [
    ["expired", await signReset(key, "u1", { nowMs: NOW - 7_200_000 })],
    ["forged", "not.a.token"],
    ["another site", await signReset(other, "u1", { nowMs: NOW })],
    ["a session, not a reset", await signToken(key, { sub: "u1" }, { nowMs: NOW })],
  ];
  for (const [label, token] of cases) {
    const r = await call(deps, "reset", { body: { token, password: "a-brand-new-password" } });
    assert.equal(r.status, 400, label);
  }
  assert.deepEqual(calls.setPassword, [], "no password was changed by any of them");
});

test("a reset link cannot set a password that is too weak", async () => {
  const key = await sessionKey(SECRET, "cafe");
  const { deps, calls } = await harness();
  const r = await call(deps, "reset", { body: { token: await signReset(key, "u1", { nowMs: NOW }), password: "abc" } });
  assert.equal(r.status, 400);
  assert.deepEqual(calls.setPassword, []);
});

test("an unknown action is a 404, not a crash", async () => {
  const { deps } = await harness();
  for (const action of ["", "delete", "admin", undefined, "../login"]) {
    assert.equal((await call(deps, action, { body: {} })).status, 404, String(action));
  }
});
