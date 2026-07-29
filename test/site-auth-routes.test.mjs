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

// ------------------------------------------- the signup gate (site-invite.mjs)
//
// The policy itself is driven in test/site-invite.test.mjs. What is tested here
// is the WIRING, which is where the two mistakes worth making live: refusing
// after the password has already been hashed (free CPU for an attacker), and
// spending somebody's invite on a signup that never produced an account.

test("a refused signup never creates the account", async () => {
  const { deps, users } = await harness({
    deps: { signupGate: async () => ({ error: "This site isn't accepting new accounts.", status: 403, reason: "closed" }) },
  });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "closed");
  assert.equal(users.has("cafe|new@example.com"), false);
});

test("the gate runs AFTER the throttle", async () => {
  // Otherwise guessing invite codes is unthrottled, and the code is the only
  // thing standing between a stranger and an account.
  let gated = false;
  const { deps, calls } = await harness({
    throttled: true,
    deps: { signupGate: async () => { gated = true; return { ok: true }; } },
  });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(r.status, 429);
  assert.equal(gated, false, "a throttled signup must not get a free code attempt");
  assert.ok(calls.throttled.length);
});

test("the gate runs BEFORE the password is hashed", async () => {
  // PBKDF2 is paid by the Worker. A refusal that happens after it has run is a
  // way to burn CPU on a public endpoint for free.
  let hashed = false;
  const { deps } = await harness({
    deps: {
      signupGate: async () => ({ error: "no", status: 403, reason: "invite" }),
      createUser: async () => { hashed = true; return { id: "nope" }; },
    },
  });
  await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(hashed, false);
});

test("a duplicate email gives the invite back", async () => {
  // Without this, anybody holding a code can spend every use on it by signing up
  // over and over with an address that already exists.
  const refunded = [];
  const { deps } = await harness({
    deps: {
      signupGate: async () => ({ ok: true, burned: "ABCDEFGHJKLM" }),
      refundInvite: async (c) => { refunded.push(c); },
    },
  });
  const r = await call(deps, "signup", { body: { email: "member@example.com", password: "a-long-password" } });
  assert.equal(r.status, 409);
  assert.deepEqual(refunded, ["ABCDEFGHJKLM"]);
});

test("a failed create gives the invite back too", async () => {
  const refunded = [];
  const { deps } = await harness({
    deps: {
      signupGate: async () => ({ ok: true, burned: "ABCDEFGHJKLM" }),
      createUser: async () => ({}),
      refundInvite: async (c) => { refunded.push(c); },
    },
  });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(r.status, 500);
  assert.deepEqual(refunded, ["ABCDEFGHJKLM"]);
});

test("a SUCCESSFUL signup does not give the invite back", async () => {
  const refunded = [];
  const { deps } = await harness({
    deps: {
      signupGate: async () => ({ ok: true, burned: "ABCDEFGHJKLM" }),
      refundInvite: async (c) => { refunded.push(c); },
    },
  });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(r.status, 200);
  assert.deepEqual(refunded, [], "a spent invite must stay spent");
});

test("a site with no gate wired behaves exactly as before", async () => {
  // Every published site is in this state until its owner changes the setting.
  const { deps, users } = await harness();
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(r.status, 200);
  assert.ok(users.has("cafe|new@example.com"));
});

// ------------------------------------------- changing a password, and epochs
//
// No route offered this, so the only way a member could change their password
// was the reset flow — which needs an email nobody can currently send. The
// second half matters more: session tokens are stateless and valid for thirty
// days, so before the epoch a stolen one survived both a password change AND a
// reset. Somebody resetting a password is usually saying they lost control of
// the account.

async function epochHarness(over = {}) {
  const h = await harness(over);
  let epoch = over.epoch || 0;
  h.deps.findUserById = async (_s, id) => {
    const row = h.byId.get(String(id));
    return row ? { ...row, token_epoch: epoch } : null;
  };
  h.deps.findUser = async (slug, email) => {
    const row = h.users.get(`${slug}|${email}`);
    return row ? { ...row, token_epoch: epoch } : null;
  };
  h.deps.setPassword = async (id, hash) => {
    h.byId.get(String(id)).password_hash = hash;
    return ++epoch;
  };
  h.getEpoch = () => epoch;
  return h;
}

const signIn = async (deps) => {
  const r = await call(deps, "login", { body: { email: "member@example.com", password: PW } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.token;
};

test("a signed-in member can change their own password", async () => {
  const h = await epochHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "password", { token, body: { current: PW, next: "a-brand-new-password" } });
  assert.equal(r.status, 200);
  assert.ok(r.body.token, "a fresh token, or they are signed out by their own change");
});

test("changing a password requires the CURRENT one", async () => {
  // Without this a stolen session token is a permanent takeover: the thief sets
  // a new password and the real owner is locked out of their own account.
  const h = await epochHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "password", { token, body: { current: "not-it", next: "a-brand-new-password" } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "current");
  assert.equal(h.getEpoch(), 0, "a refused change must not bump the epoch");
});

test("a password change signs out every OTHER session", async () => {
  const h = await epochHarness();
  const stolen = await signIn(h.deps);
  const mine = await signIn(h.deps);
  const r = await call(h.deps, "password", { token: mine, body: { current: PW, next: "a-brand-new-password" } });
  assert.equal(r.status, 200);
  // The thief's token was minted under the old epoch.
  assert.equal((await call(h.deps, "me", { token: stolen })).status, 401);
  // ...and the token handed back by the change still works.
  assert.equal((await call(h.deps, "me", { token: r.body.token })).status, 200);
});

test("a reset signs out every session too", async () => {
  const h = await epochHarness();
  const stolen = await signIn(h.deps);
  const key = await sessionKey(SECRET, "cafe");
  const link = await signReset(key, "u1", { nowMs: NOW });
  const r = await call(h.deps, "reset", { body: { token: link, password: "a-brand-new-password" } });
  assert.equal(r.status, 200);
  assert.equal((await call(h.deps, "me", { token: stolen })).status, 401);
});

test("a token from before epochs existed still works on an untouched account", async () => {
  // Every member currently holding a session is in exactly this state.
  const h = await epochHarness();
  const key = await sessionKey(SECRET, "cafe");
  const old = await signToken(key, { sub: "u1", email: "member@example.com" }, { nowMs: NOW });
  assert.equal((await call(h.deps, "me", { token: old })).status, 200);
});

test("changing a password is refused without a session", async () => {
  const h = await epochHarness();
  const r = await call(h.deps, "password", { body: { current: PW, next: "a-brand-new-password" } });
  assert.equal(r.status, 401);
});

test("a weak new password is refused before anything changes", async () => {
  const h = await epochHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "password", { token, body: { current: PW, next: "short" } });
  assert.equal(r.status, 400);
  assert.equal(h.getEpoch(), 0);
});

test("the password change is throttled per account", async () => {
  const h = await epochHarness({ throttled: true });
  const key = await sessionKey(SECRET, "cafe");
  const token = await signToken(key, { sub: "u1", email: "member@example.com", ep: 0 }, { nowMs: NOW });
  const r = await call(h.deps, "password", { token, body: { current: PW, next: "a-brand-new-password" } });
  assert.equal(r.status, 429);
});

// ------------------------------------------- suspension and self-service
//
// `blocked` was stamped onto every site's _users by ensureAuthExtras and read by
// nothing, so an owner's only option for a member behaving badly was DELETE —
// irreversible, and it leaves their rows behind pointing at nobody.

async function selfHarness(over = {}) {
  const h = await epochHarness(over);
  const state = { blocked: over.blocked ? 1 : 0, deleted: false, emails: [] };
  const base = h.deps.findUserById;
  h.deps.findUserById = async (s, id) => {
    if (state.deleted) return null;
    const u = await base(s, id);
    return u ? { ...u, blocked: state.blocked } : null;
  };
  const baseFind = h.deps.findUser;
  h.deps.findUser = async (s, e) => {
    const u = await baseFind(s, e);
    return u ? { ...u, blocked: state.blocked } : null;
  };
  h.deps.bumpEpoch = async (id) => h.deps.setPassword(id, "unchanged");
  h.deps.setEmail = async (id, email) => { if (over.emailTaken) return { conflict: true }; state.emails.push(email); return { ok: true }; };
  h.deps.deleteUser = async () => { state.deleted = true; };
  h.state = state;
  return h;
}

test("a suspended member cannot log in, and is told nothing extra", async () => {
  const h = await selfHarness({ blocked: true });
  const r = await call(h.deps, "login", { body: { email: "member@example.com", password: PW } });
  assert.equal(r.status, 401);
  // Byte-identical to a wrong password: "your account is suspended" would tell a
  // stranger guessing addresses that this one is a member here.
  const wrong = await call((await selfHarness()).deps, "login", { body: { email: "member@example.com", password: "nope" } });
  assert.deepEqual(r.body, wrong.body);
});

test("suspension kills the token they are already holding", async () => {
  // Otherwise a suspended member keeps full access for up to thirty days.
  const h = await selfHarness();
  const token = await signIn(h.deps);
  assert.equal((await call(h.deps, "me", { token })).status, 200);
  h.state.blocked = 1;
  assert.equal((await call(h.deps, "me", { token })).status, 401);
});

test("logout-all signs out other devices and keeps this one", async () => {
  const h = await selfHarness();
  const other = await signIn(h.deps);
  const mine = await signIn(h.deps);
  const r = await call(h.deps, "logout-all", { token: mine });
  assert.equal(r.status, 200);
  assert.equal((await call(h.deps, "me", { token: other })).status, 401);
  assert.equal((await call(h.deps, "me", { token: r.body.token })).status, 200);
});

test("logout-all needs a session", async () => {
  const h = await selfHarness();
  assert.equal((await call(h.deps, "logout-all", {})).status, 401);
});

test("changing an email needs the current password", async () => {
  // The address IS the account — whoever holds it can reset their way back in.
  const h = await selfHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "email", { token, body: { current: "wrong", next: "new@example.com" } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "current");
  assert.deepEqual(h.state.emails, []);
});

test("changing an email works and hands back a fresh token", async () => {
  const h = await selfHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "email", { token, body: { current: PW, next: "New@Example.com " } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, "new@example.com", "normalized on the way in");
  assert.ok(r.body.token);
});

test("an email already in use is a 409", async () => {
  const h = await selfHarness({ emailTaken: true });
  const token = await signIn(h.deps);
  const r = await call(h.deps, "email", { token, body: { current: PW, next: "taken@example.com" } });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "exists");
});

test("an invalid email is refused before the password is checked", async () => {
  const h = await selfHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "email", { token, body: { current: PW, next: "not-an-email" } });
  assert.equal(r.status, 400);
});

test("a member can close their own account, with their password", async () => {
  const h = await selfHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "close", { token, body: { current: PW } });
  assert.equal(r.status, 200);
  assert.equal(h.state.deleted, true);
  // And the token stops working at once — `me` reads through to storage.
  assert.equal((await call(h.deps, "me", { token })).status, 401);
});

test("closing an account needs the current password", async () => {
  const h = await selfHarness();
  const token = await signIn(h.deps);
  const r = await call(h.deps, "close", { token, body: { current: "nope" } });
  assert.equal(r.status, 401);
  assert.equal(h.state.deleted, false);
});

test("a suspended member cannot use the self-service routes either", async () => {
  const h = await selfHarness();
  const token = await signIn(h.deps);
  h.state.blocked = 1;
  for (const action of ["logout-all", "email", "close", "password"]) {
    const r = await call(h.deps, action, { token, body: { current: PW, next: "a-long-new-password" } });
    assert.equal(r.status, 401, action);
  }
});

// --------------------------------------------------- durable brute-force delay
//
// The throttle above this is per-isolate, so an attacker spreading attempts gets
// a fresh allowance each time. These assert the row-level counter that does not.

import { LOCKOUT_THRESHOLD, lockState } from "../site-lockout.mjs";

async function lockHarness(over = {}) {
  const h = await harness(over);
  const writes = [];
  const row = h.users.get("cafe|member@example.com");
  Object.assign(row, { failed: 0, locked_until: 0, last_failed_at: 0 }, over.lock || {});
  h.deps.recordLoginAttempt = async (id, v) => { writes.push({ id, ...v }); Object.assign(row, v); };
  h.writes = writes; h.row = row;
  return h;
}

const badLogin = (deps) => call(deps, "login", { body: { email: "member@example.com", password: "wrong" } });
const goodLogin = (deps) => call(deps, "login", { body: { email: "member@example.com", password: PW } });

test("a wrong password is counted on the row", async () => {
  const h = await lockHarness();
  await badLogin(h.deps);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].failed, 1);
});

test("enough wrong passwords earn a delay", async () => {
  const h = await lockHarness();
  for (let i = 0; i < LOCKOUT_THRESHOLD + 1; i++) await badLogin(h.deps);
  assert.ok(lockState(h.row, NOW).locked, "should be delayed after " + (LOCKOUT_THRESHOLD + 1));
});

test("a delayed account refuses the CORRECT password", async () => {
  // The delay is worth nothing if the right guess still gets through it.
  const h = await lockHarness({ lock: { failed: 9, locked_until: Math.floor(NOW / 1000) + 600 } });
  const r = await goodLogin(h.deps);
  assert.equal(r.status, 401);
});

test("a delayed account says exactly what a wrong password says", async () => {
  // "Try again in 10 minutes" would confirm the address is a member here.
  const locked = await lockHarness({ lock: { failed: 9, locked_until: Math.floor(NOW / 1000) + 600 } });
  const normal = await lockHarness();
  const a = await goodLogin(locked.deps);
  const b = await badLogin(normal.deps);
  assert.equal(a.status, b.status);
  assert.deepEqual(a.body, b.body);
});

test("failing while delayed does not extend the delay", async () => {
  const until = Math.floor(NOW / 1000) + 600;
  const h = await lockHarness({ lock: { failed: 9, locked_until: until } });
  await badLogin(h.deps);
  await badLogin(h.deps);
  assert.equal(h.writes.length, 0, "no write at all while a delay is running");
  assert.equal(h.row.locked_until, until);
});

test("the delay heals with no intervention", async () => {
  const h = await lockHarness({ lock: { failed: 9, locked_until: Math.floor(NOW / 1000) - 1 } });
  const r = await goodLogin(h.deps);
  assert.equal(r.status, 200, "an expired delay must let the real person back in");
});

test("a successful login clears the counter", async () => {
  const h = await lockHarness({ lock: { failed: 4, locked_until: 0, last_failed_at: Math.floor(NOW / 1000) } });
  const r = await goodLogin(h.deps);
  assert.equal(r.status, 200);
  assert.equal(h.row.failed, 0);
});

test("a clean login writes nothing — no counter update per sign-in", async () => {
  const h = await lockHarness();
  await goodLogin(h.deps);
  assert.equal(h.writes.length, 0, "an untouched account must not be written on every login");
});

test("the counter is read AFTER the password is verified", async () => {
  // Answering early would make a delayed account measurably faster to refuse
  // than a wrong password, which is a timing oracle for membership.
  const order = [];
  const h = await lockHarness({ lock: { failed: 9, locked_until: Math.floor(NOW / 1000) + 600 } });
  const realFind = h.deps.findUser;
  h.deps.findUser = async (...a) => { order.push("find"); return realFind(...a); };
  h.deps.recordLoginAttempt = async () => { order.push("write"); };
  await goodLogin(h.deps);
  // The hash always runs; nothing short-circuits before it.
  assert.deepEqual(order, ["find"], "a locked account still pays the hash and writes nothing");
});

test("an unknown address is not tripped up by the lockout path", async () => {
  const h = await lockHarness();
  const r = await call(h.deps, "login", { body: { email: "nobody@example.com", password: "x" } });
  assert.equal(r.status, 401);
  assert.equal(h.writes.length, 0, "there is no row to count against");
});

test("a site with no lockout wiring behaves exactly as before", async () => {
  const h = await harness();
  const r = await goodLogin(h.deps);
  assert.equal(r.status, 200);
});

// --------------------------------------------------- breached passwords
//
// The policy is in test/site-pwned.test.mjs. What matters here is that a
// service outage never stops somebody creating an account, and that a refused
// password costs neither an invite nor a PBKDF2 run.

const pwnedReply = (body) => async () => ({ ok: true, text: async () => body });
// "password" and its real SHA-1 suffix.
const BREACHED_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

test("a breached password is refused at signup", async () => {
  const { deps, users } = await harness({ deps: { checkPwned: pwnedReply(`${BREACHED_SUFFIX}:24230577`) } });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "password" } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "pwned");
  assert.equal(users.has("cafe|new@example.com"), false);
});

test("a clean password sails through", async () => {
  const { deps } = await harness({ deps: { checkPwned: pwnedReply("AAAA:1") } });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "a-long-password" } });
  assert.equal(r.status, 200);
});

test("an outage does NOT stop a signup", async () => {
  // Somebody else's downtime must not become ours.
  const { deps } = await harness({ deps: { checkPwned: async () => { throw new Error("down"); } } });
  const r = await call(deps, "signup", { body: { email: "new@example.com", password: "password" } });
  assert.equal(r.status, 200);
});

test("a refused password costs no invite and no hash", async () => {
  let hashed = false, burned = false;
  const { deps } = await harness({
    deps: {
      checkPwned: pwnedReply(`${BREACHED_SUFFIX}:9`),
      signupGate: async () => { burned = true; return { ok: true, burned: "ABCDEFGHJKLM" }; },
      createUser: async () => { hashed = true; return { id: "x" }; },
    },
  });
  await call(deps, "signup", { body: { email: "new@example.com", password: "password" } });
  assert.equal(burned, false, "an invite must not be spent on a password we refuse");
  assert.equal(hashed, false, "and no PBKDF2 run either");
});

test("changing to a breached password is refused", async () => {
  const h = await epochHarness({ deps: { checkPwned: pwnedReply(`${BREACHED_SUFFIX}:9`) } });
  const token = await signIn(h.deps);
  const r = await call(h.deps, "password", { token, body: { current: PW, next: "password" } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "pwned");
});

test("resetting to a breached password is refused", async () => {
  const h = await epochHarness({ deps: { checkPwned: pwnedReply(`${BREACHED_SUFFIX}:9`) } });
  const key = await sessionKey(SECRET, "cafe");
  const link = await signReset(key, "u1", { nowMs: NOW });
  const r = await call(h.deps, "reset", { body: { token: link, password: "password" } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "pwned");
});

test("a site with no breach check wired behaves exactly as before", async () => {
  const { deps } = await harness();
  assert.equal((await call(deps, "signup", { body: { email: "new@example.com", password: "password" } })).status, 200);
});

// The other half of the ordering: on the two routes that need a credential, the
// outbound request happens only once the caller has produced it. `checkPwned`
// reaches a service we do not run, so anywhere earlier turns each of these into
// a way for a stranger to make us call it.

test("a wrong current password never reaches the breach service", async () => {
  // A stolen session token is all `signedIn()` proves. The current password is
  // what proves the account is theirs, and the check waits for it.
  let asked = 0;
  const h = await epochHarness({
    deps: { checkPwned: async () => { asked++; return { ok: true, text: async () => `${BREACHED_SUFFIX}:9` }; } },
  });
  const token = await signIn(h.deps);
  const r = await call(h.deps, "password", { token, body: { current: "not-the-password", next: "password" } });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "current");
  assert.equal(asked, 0, "the wrong-password path must not cost an outbound request");
  // And the same call with the right one does ask.
  await call(h.deps, "password", { token, body: { current: PW, next: "password" } });
  assert.equal(asked, 1);
});

test("an unusable reset link never reaches the breach service", async () => {
  // A correctly signed token for an account that no longer exists.
  let asked = 0;
  const h = await epochHarness({
    deps: { checkPwned: async () => { asked++; return { ok: true, text: async () => `${BREACHED_SUFFIX}:9` }; } },
  });
  const key = await sessionKey(SECRET, "cafe");
  const link = await signReset(key, "nobody", { nowMs: NOW });
  const r = await call(h.deps, "reset", { body: { token: link, password: "password" } });
  assert.equal(r.status, 400);
  assert.equal(asked, 0);
});
