// One person, several ways to prove it.
//
// Almost every test here is a version of the same attack: somebody arriving with
// a NEW credential that carries an email belonging to somebody who already has
// an account. Get the rule wrong and signing in with Google takes over the
// password account of whoever owns that address.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveIdentity, normalizeProvider, normalizeSubject, normalizeProfile, canUnlink,
} from "../site-identity.mjs";

function store({ users = [], identities = [], nextId = 100 } = {}) {
  const u = new Map(users.map((x) => [String(x.id), x]));
  const ids = new Map(identities.map((x) => [`${x.provider}|${x.subject}`, x]));
  const linked = [];
  let n = nextId;
  return {
    users: u, identities: ids, linked,
    findIdentity: async (p, s) => ids.get(`${p}|${s}`) || null,
    findUserById: async (id) => u.get(String(id)) || null,
    findUserByEmail: async (e) => [...u.values()].find((x) => x.email === e) || null,
    createUser: async (email, name) => { const row = { id: String(n++), email, name }; u.set(row.id, row); return row; },
    linkIdentity: async (p, s, userId, email) => { const row = { provider: p, subject: s, user_id: userId, email }; ids.set(`${p}|${s}`, row); linked.push(row); },
  };
}

const google = (over = {}) => ({ subject: "g-1", email: "ada@example.com", emailVerified: true, ...over });

// --------------------------------------------------------------- the takeover

test("an UNVERIFIED provider email never links to an existing account", async () => {
  // The whole reason this module exists. Attacker makes a GitHub account with
  // the victim's address, does not confirm it, clicks "Continue with GitHub".
  const s = store({ users: [{ id: "1", email: "ada@example.com" }] });
  const r = await resolveIdentity(s, { provider: "github", profile: google({ emailVerified: false }) });
  assert.equal(r.user, undefined);
  assert.equal(r.status, 409);
  assert.equal(r.reason, "unverified_link");
  assert.equal(s.linked.length, 0, "nothing may be linked");
});

test("a VERIFIED provider email links to the existing account", async () => {
  const s = store({ users: [{ id: "1", email: "ada@example.com" }] });
  const r = await resolveIdentity(s, { provider: "google", profile: google() });
  assert.equal(r.action, "linked");
  assert.equal(r.user.id, "1");
  assert.equal(s.linked[0].provider, "google");
});

test("emailVerified must be exactly true, not merely truthy", async () => {
  // Providers send strings, 1, "1". Coercing any of them is the takeover again.
  for (const v of ["true", 1, "1", "yes", {}]) {
    const s = store({ users: [{ id: "1", email: "ada@example.com" }] });
    const r = await resolveIdentity(s, { provider: "google", profile: { subject: "g-1", email: "ada@example.com", emailVerified: v } });
    assert.equal(r.status, 409, JSON.stringify(v));
  }
});

test("a known identity signs in without the email being consulted at all", async () => {
  // A returning user is immune to whatever the provider now says about
  // addresses — including the address having been reassigned to someone else.
  const s = store({
    users: [{ id: "1", email: "ada@example.com" }],
    identities: [{ provider: "google", subject: "g-1", user_id: "1" }],
  });
  const r = await resolveIdentity(s, { provider: "google", profile: google({ email: "someone-else@example.com", emailVerified: false }) });
  assert.equal(r.action, "signed-in");
  assert.equal(r.user.id, "1");
});

test("the subject is what identifies them, not the address", async () => {
  // Same person, provider changed their email. Still their account.
  const s = store({
    users: [{ id: "1", email: "old@example.com" }],
    identities: [{ provider: "google", subject: "g-1", user_id: "1" }],
  });
  const r = await resolveIdentity(s, { provider: "google", profile: google({ email: "new@example.com" }) });
  assert.equal(r.action, "signed-in");
  assert.equal(r.user.id, "1");
});

test("two different subjects with one address are two different people", async () => {
  const s = store({
    users: [{ id: "1", email: "ada@example.com" }],
    identities: [{ provider: "google", subject: "g-1", user_id: "1" }],
  });
  const r = await resolveIdentity(s, { provider: "google", profile: google({ subject: "g-2" }) });
  // Verified, so linking is allowed — but to the account that owns the address,
  // not to the one that owns the other subject.
  assert.equal(r.action, "linked");
  assert.equal(r.user.id, "1");
});

// --------------------------------------------------------------- new accounts

test("a brand new identity creates an account", async () => {
  const s = store();
  const r = await resolveIdentity(s, { provider: "google", profile: google() });
  assert.equal(r.action, "created");
  assert.equal(r.user.email, "ada@example.com");
  assert.equal(s.linked.length, 1);
});

test("a closed site does not gain a back door via Google", async () => {
  const s = store();
  const r = await resolveIdentity(s, { provider: "google", profile: google(), allowSignup: false });
  assert.equal(r.status, 403);
  assert.equal(r.reason, "closed");
  assert.equal(s.users.size, 0);
});

test("a provider that releases no email still produces an account", async () => {
  // Slack and Discord may not; Apple's private relay can be withheld.
  const s = store();
  const r = await resolveIdentity(s, { provider: "slack", profile: { subject: "s-9" } });
  assert.equal(r.action, "created");
  assert.equal(r.user.email, null);
});

test("a suspended member cannot come back in through a provider", async () => {
  const s = store({
    users: [{ id: "1", email: "ada@example.com", blocked: 1 }],
    identities: [{ provider: "google", subject: "g-1", user_id: "1" }],
  });
  assert.equal((await resolveIdentity(s, { provider: "google", profile: google() })).status, 401);

  // ...nor by arriving with a fresh identity carrying their verified address.
  const s2 = store({ users: [{ id: "1", email: "ada@example.com", blocked: 1 }] });
  const r2 = await resolveIdentity(s2, { provider: "google", profile: google() });
  assert.equal(r2.status, 401);
  assert.equal(s2.linked.length, 0);
});

test("an identity pointing at a deleted account does not resurrect it", async () => {
  const s = store({ identities: [{ provider: "google", subject: "g-1", user_id: "999" }] });
  const r = await resolveIdentity(s, { provider: "google", profile: google() });
  assert.equal(r.status, 401);
  assert.equal(r.reason, "gone");
});

// --------------------------------------------------------------- shapes

test("password is not an external identity", async () => {
  const s = store();
  const r = await resolveIdentity(s, { provider: "password", profile: google() });
  assert.equal(r.status, 400);
});

test("an unknown provider is refused", async () => {
  assert.equal(normalizeProvider("myspace"), null);
  assert.equal(normalizeProvider(""), null);
  assert.equal(normalizeProvider("GOOGLE"), "google");
  const s = store();
  assert.equal((await resolveIdentity(s, { provider: "myspace", profile: google() })).status, 400);
});

test("a profile with no subject is refused before anything is stored", async () => {
  const s = store();
  const r = await resolveIdentity(s, { provider: "google", profile: { email: "ada@example.com", emailVerified: true } });
  assert.equal(r.status, 400);
  assert.equal(r.reason, "subject");
  assert.equal(s.users.size, 0);
});

test("a subject is bounded, because it reaches a unique index", () => {
  assert.equal(normalizeSubject("x".repeat(256)), null);
  assert.equal(normalizeSubject(""), null);
  assert.equal(normalizeSubject("  "), null);
  assert.equal(normalizeSubject(12345), "12345", "numeric ids are normal — GitHub's is one");
});

test("a malformed email in a profile is dropped, not stored", () => {
  assert.equal(normalizeProfile({ subject: "a", email: "not-an-email" }).email, null);
  assert.equal(normalizeProfile({ subject: "a", email: "Ada@Example.COM " }).email, "ada@example.com");
});

test("email_verified in snake_case is understood too", () => {
  assert.equal(normalizeProfile({ subject: "a", email_verified: true }).emailVerified, true);
  assert.equal(normalizeProfile({ subject: "a" }).emailVerified, false, "silence is not an assertion");
});

// --------------------------------------------------------------- unlinking

test("the last way into an account cannot be removed", () => {
  assert.equal(canUnlink({ identities: [{}], hasPassword: false }), false);
  assert.equal(canUnlink({ identities: [{}], hasPassword: true }), true);
  assert.equal(canUnlink({ identities: [{}, {}], hasPassword: false }), true);
  assert.equal(canUnlink({ identities: [], hasPassword: true }), false, "nothing to unlink");
});
