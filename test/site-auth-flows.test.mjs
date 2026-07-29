// The sign-in flows, end to end against fakes.
//
// The single most important assertion in this file: a primary method that
// succeeds on an account with 2FA enabled returns a PENDING token, never a
// session. Everything else is a variation on "the secret we issued can be used
// exactly once, for exactly the thing it was issued for".
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAuthFlow, finishSignIn, PENDING_TTL_SEC } from "../site-auth-flows.mjs";
import { sessionKey, signToken, verifySession, hashPassword } from "../site-auth.mjs";
import { newTotpSecret, totpCode, normalizeRecovery, newRecoveryCodes } from "../site-otp.mjs";
import { availableMethods, routeFor, methodRoutes, SHARED_ROUTES } from "../site-auth-methods.mjs";

const SECRET = "server-only";
const NOW = 1_780_000_000_000;
const ORIGIN = "https://isibi.ai";
const PW = "correct horse battery";

async function harness(over = {}) {
  const key = await sessionKey(SECRET, "cafe");
  const users = new Map();
  const codes = [];
  const creds = [];
  const identities = [];
  let nextCode = 1, nextCred = 1;

  const base = {
    id: 1, email: "member@example.com", token_epoch: 0, blocked: 0,
    totp_secret: null, totp_enabled: 0, totp_last_step: null, recovery_hashes: null,
    password_hash: await hashPassword(PW, { iterations: 1000 }),
    ...over.user,
  };
  users.set("1", base);

  const deps = {
    rpId: "isibi.ai",
    siteConfig: async () => ({ mailer: true, passkeys: true, oauth: {}, ...over.site }),
    findUserById: async (id) => users.get(String(id)) || null,
    findUserByEmail: async (e) => [...users.values()].find((u) => u.email === e) || null,
    createUser: async (email) => { const u = { id: 99, email, token_epoch: 0 }; users.set("99", u); return u; },
    findIdentity: async (p, s) => identities.find((i) => i.provider === p && i.subject === s) || null,
    linkIdentity: async (p, s, uid, email) => { identities.push({ provider: p, subject: s, user_id: uid, email }); },
    identitiesFor: async (uid) => identities.filter((i) => i.user_id === uid),
    putCode: async (kind, subject, code, expires_at) => { codes.push({ id: nextCode++, kind, subject, code, attempts: 0, expires_at }); },
    takeCode: async (kind, subject) => [...codes].reverse().find((c) => c.kind === kind && c.subject === subject) || null,
    spendCode: async (id) => { const i = codes.findIndex((c) => c.id === id); if (i >= 0) codes.splice(i, 1); },
    bumpAttempt: async (id) => { const c = codes.find((x) => x.id === id); if (c) c.attempts++; },
    addCredential: async (uid, c) => { creds.push({ id: nextCred++, user_id: uid, ...c }); },
    credentialById: async (cid) => creds.find((c) => c.cred_id === cid) || null,
    credentialsFor: async (uid) => creds.filter((c) => c.user_id === uid),
    touchCredential: async (id, sc) => { const c = creds.find((x) => x.id === id); if (c) c.sign_count = sc; },
    setTotp: async (uid, v) => {
      const u = users.get(String(uid));
      u.totp_secret = v.secret; u.totp_enabled = v.enabled;
      if (v.lastStep !== undefined) u.totp_last_step = v.lastStep;
      if (v.recovery !== undefined) u.recovery_hashes = v.recovery;
    },
    touchLogin: async () => {},
    signupAllowed: async () => over.signupAllowed !== false,
    sendCode: async (email, code) => { sent.push({ email, code }); },
    throttle: async () => ({ ok: over.throttled !== true }),
    exchange: async () => ({ access_token: "at" }),
    fetchProfile: async () => over.profile || { sub: "g-1", email: "member@example.com", email_verified: true },
    ...over.deps,
  };
  const sent = [];
  deps.sendCode = async (email, code) => { sent.push({ email, code }); };

  const session = await signToken(key, { sub: "1", email: base.email, ep: 0 }, { nowMs: NOW });
  const call = (route, opts = {}) => handleAuthFlow(deps, { slug: "cafe", route, key, nowMs: NOW, origin: ORIGIN, ...opts });
  return { deps, key, users, codes, creds, identities, sent, session, call, user: base };
}

// ------------------------------------------------------- the registry

test("adding a method is one entry — every route it claims is routable", () => {
  for (const r of methodRoutes()) {
    assert.ok(routeFor(r), r + " is claimed by the registry but does not route");
  }
  for (const r of SHARED_ROUTES) assert.equal(routeFor(r).method, null, r + " belongs to no single method");
  assert.equal(routeFor("totp/steal"), null);
  assert.equal(routeFor(""), null);
});

test("a site only offers the methods it has set up", async () => {
  assert.deepEqual(availableMethods({}).map((m) => m.name), ["password", "passkey"]);
  assert.ok(availableMethods({ mailer: true }).some((m) => m.name === "email-code"));
  assert.ok(availableMethods({ oauth: { google: { client_id: "a", client_secret: "b" } } }).some((m) => m.name === "google"));
});

test("second factors are never offered as a way IN", () => {
  const names = availableMethods({ mailer: true }).map((m) => m.name);
  assert.ok(!names.includes("totp"));
  assert.ok(!names.includes("recovery"));
});

// ------------------------------------------------------- the 2FA gate

test("a primary success on a 2FA account returns PENDING, not a session", async () => {
  // The assertion this whole design exists for.
  const h = await harness({ user: { totp_enabled: 1, totp_secret: newTotpSecret() } });
  const r = await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW });
  assert.equal(r.body.token, undefined, "no session before the second factor");
  assert.ok(r.body.pending);
  assert.equal(r.body.need, "totp");
});

test("the pending token is NOT usable as a session", async () => {
  const h = await harness({ user: { totp_enabled: 1, totp_secret: newTotpSecret() } });
  const r = await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW });
  assert.equal(await verifySession(h.key, r.body.pending, { nowMs: NOW }), null);
});

test("a session token is NOT usable as a pending 2FA token", async () => {
  const h = await harness({ user: { totp_enabled: 1, totp_secret: newTotpSecret() } });
  const r = await h.call("totp/verify", { token: h.session, body: { code: "000000" } });
  assert.equal(r.status, 401);
});

test("an account without 2FA gets a session straight away", async () => {
  const h = await harness();
  const r = await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW });
  assert.ok(r.body.token);
  assert.equal(r.body.pending, undefined);
});

// ------------------------------------------------------- TOTP

test("TOTP is not enabled until a code proves the app works", async () => {
  const h = await harness();
  const start = await h.call("totp/start", { token: h.session });
  assert.ok(start.body.secret);
  assert.match(start.body.uri, /^otpauth:/);
  // Stored but off — enabling on the strength of a QR nobody scanned locks the
  // account on the next sign-in.
  assert.equal(h.users.get("1").totp_enabled, 0);

  const code = await totpCode(start.body.secret, { nowMs: NOW });
  const on = await h.call("totp/enable", { token: h.session, body: { code } });
  assert.equal(on.status, 200);
  assert.equal(h.users.get("1").totp_enabled, 1);
  assert.equal(on.body.recovery.length, 10);
});

test("a wrong code does not enable TOTP", async () => {
  const h = await harness();
  await h.call("totp/start", { token: h.session });
  const r = await h.call("totp/enable", { token: h.session, body: { code: "000000" } });
  assert.equal(r.status, 401);
  assert.equal(h.users.get("1").totp_enabled, 0);
});

test("the second factor completes the sign-in and mints a real session", async () => {
  const secret = newTotpSecret();
  const h = await harness({ user: { totp_enabled: 1, totp_secret: secret } });
  const pending = (await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW })).body.pending;
  const r = await h.call("totp/verify", { token: pending, body: { code: await totpCode(secret, { nowMs: NOW }) } });
  assert.equal(r.status, 200);
  assert.ok(await verifySession(h.key, r.body.token, { nowMs: NOW }));
});

test("the same TOTP code cannot be presented twice", async () => {
  const secret = newTotpSecret();
  const h = await harness({ user: { totp_enabled: 1, totp_secret: secret } });
  const code = await totpCode(secret, { nowMs: NOW });
  const mk = async () => (await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW })).body.pending;
  assert.equal((await h.call("totp/verify", { token: await mk(), body: { code } })).status, 200);
  assert.equal((await h.call("totp/verify", { token: await mk(), body: { code } })).status, 401);
});

test("a recovery code works once, and is then gone", async () => {
  const secret = newTotpSecret();
  const codes = newRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => hashPassword(normalizeRecovery(c), { iterations: 1000 })));
  const h = await harness({ user: { totp_enabled: 1, totp_secret: secret, recovery_hashes: JSON.stringify(hashes) } });
  const mk = async () => (await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW })).body.pending;

  const first = await h.call("totp/verify", { token: await mk(), body: { code: codes[0] } });
  assert.equal(first.status, 200);
  assert.equal(first.body.recoveryUsed, true);
  assert.equal(first.body.recoveryLeft, 9);

  const again = await h.call("totp/verify", { token: await mk(), body: { code: codes[0] } });
  assert.equal(again.status, 401, "a recovery code is single use");
});

test("turning TOTP off needs the password", async () => {
  const h = await harness({ user: { totp_enabled: 1, totp_secret: newTotpSecret() } });
  const bad = await h.call("totp/disable", { token: h.session, body: { current: "nope" } });
  assert.equal(bad.status, 401);
  assert.equal(h.users.get("1").totp_enabled, 1);
  const ok = await h.call("totp/disable", { token: h.session, body: { current: PW } });
  assert.equal(ok.status, 200);
  assert.equal(h.users.get("1").totp_enabled, 0);
});

// ------------------------------------------------------- emailed codes

test("requesting a code always answers ok, account or not", async () => {
  const h = await harness();
  assert.equal((await h.call("code/request", { body: { email: "member@example.com" } })).status, 200);
  assert.equal((await h.call("code/request", { body: { email: "nobody@example.com" } })).status, 200);
  assert.equal((await h.call("code/request", { body: { email: "junk" } })).status, 200);
  assert.equal(h.sent.length, 1, "only the real account is mailed");
});

test("a code signs the person in, and cannot be reused", async () => {
  const h = await harness();
  await h.call("code/request", { body: { email: "member@example.com" } });
  const code = h.sent[0].code;
  const first = await h.call("code/verify", { body: { email: "member@example.com", code } });
  assert.equal(first.status, 200);
  assert.ok(first.body.token);
  const again = await h.call("code/verify", { body: { email: "member@example.com", code } });
  assert.equal(again.status, 401);
});

test("wrong codes are counted and run out", async () => {
  const h = await harness();
  await h.call("code/request", { body: { email: "member@example.com" } });
  for (let i = 0; i < 5; i++) await h.call("code/verify", { body: { email: "member@example.com", code: "000000" } });
  // Even the right code is refused once the attempts are spent.
  const r = await h.call("code/verify", { body: { email: "member@example.com", code: h.sent[0].code } });
  assert.equal(r.status, 401);
});

// ------------------------------------------------------- OAuth

test("a callback links a verified identity and signs in", async () => {
  const h = await harness({ site: { oauth: { google: { client_id: "a", client_secret: "b" } } } });
  const start = await h.call("oauth/google/start", { query: {} });
  assert.equal(start.status, 302);
  const state = new URL(start.body.redirect).searchParams.get("state");
  const r = await h.call("oauth/google/callback", { query: { code: "abc", state } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.token);
  assert.equal(r.body.action, "linked");
});

test("an oauth state cannot be a session, and a session cannot be a state", async () => {
  const h = await harness({ site: { oauth: { google: { client_id: "a", client_secret: "b" } } } });
  const start = await h.call("oauth/google/start", { query: {} });
  const state = new URL(start.body.redirect).searchParams.get("state");
  assert.equal(await verifySession(h.key, state, { nowMs: NOW }), null);
  // ...and the session token is refused as state.
  const r = await h.call("oauth/google/callback", { query: { code: "abc", state: h.session } });
  assert.equal(r.status, 400);
});

test("an unverified provider email does not take over the account", async () => {
  const h = await harness({
    site: { oauth: { github: { client_id: "a", client_secret: "b" } } },
    profile: { id: 7, email: "member@example.com" },
  });
  const start = await h.call("oauth/github/start", { query: {} });
  const state = new URL(start.body.redirect).searchParams.get("state");
  const r = await h.call("oauth/github/callback", { query: { code: "abc", state } });
  assert.equal(r.status, 409);
  assert.equal(h.identities.length, 0);
});

test("a closed site does not sign new people up through a provider", async () => {
  const h = await harness({
    site: { oauth: { google: { client_id: "a", client_secret: "b" } } },
    signupAllowed: false,
    profile: { sub: "g-9", email: "stranger@example.com", email_verified: true },
  });
  const start = await h.call("oauth/google/start", { query: {} });
  const state = new URL(start.body.redirect).searchParams.get("state");
  const r = await h.call("oauth/google/callback", { query: { code: "abc", state } });
  assert.equal(r.status, 403);
});

test("a provider that is not configured is a 404, not a broken redirect", async () => {
  const h = await harness();
  assert.equal((await h.call("oauth/google/start", { query: {} })).status, 404);
});

// ------------------------------------------------------- account surface

test("identities lists what is connected, and needs a session", async () => {
  const h = await harness();
  assert.equal((await h.call("identities", {})).status, 401);
  const r = await h.call("identities", { token: h.session });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.identities, []);
  assert.deepEqual(r.body.passkeys, []);
});

test("a suspended member cannot use any of these routes", async () => {
  const h = await harness({ user: { blocked: 1 } });
  for (const route of ["totp/start", "identities", "passkey/register/start"]) {
    assert.equal((await h.call(route, { token: h.session })).status, 401, route);
  }
});

test("an unknown route is a 404", async () => {
  const h = await harness();
  assert.equal((await h.call("totp/steal", { token: h.session })).status, 404);
});

// ------------------------------------------------------- token kinds, exactly

test("a PENDING token cannot be used on a route that needs a session", async () => {
  // The other direction from the test above, and the one that matters more: a
  // half-finished sign-in must not reach account settings.
  const h = await harness({ user: { totp_enabled: 1, totp_secret: newTotpSecret() } });
  const pending = (await finishSignIn(h.deps, h.users.get("1"), { key: h.key, nowMs: NOW })).body.pending;
  for (const route of ["identities", "totp/start", "passkey/register/start"]) {
    assert.equal((await h.call(route, { token: pending })).status, 401, route);
  }
});

test("a session token is refused by totp/verify even with a CORRECT code", async () => {
  // Refusing it for a wrong code proves nothing about the kind check.
  const secret = newTotpSecret();
  const h = await harness({ user: { totp_enabled: 1, totp_secret: secret } });
  const code = await totpCode(secret, { nowMs: NOW });
  const r = await h.call("totp/verify", { token: h.session, body: { code } });
  assert.equal(r.status, 401, "a session is not a licence to present a second factor");
});

test("an oauth state must be an OAUTH token, not merely a valid one", async () => {
  // Forged with the right provider pin but the wrong kind, so the pin cannot
  // mask a missing kind check.
  const h = await harness({ site: { oauth: { google: { client_id: "a", client_secret: "b" } } } });
  const wrongKind = await signToken(h.key, { sub: "1", p: "google", use: "session" }, { nowMs: NOW });
  const r = await h.call("oauth/google/callback", { query: { code: "abc", state: wrongKind } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "state");
});

// ------------------------------------------------------- passkey login, for real

import { verifyRegistration, newChallenge as wanChallenge, b64u as wanB64 } from "../site-webauthn.mjs";

function cat(...arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
function cborHead(major, len) {
  if (len < 24) return Uint8Array.from([(major << 5) | len]);
  if (len < 256) return Uint8Array.from([(major << 5) | 24, len]);
  return Uint8Array.from([(major << 5) | 25, len >> 8, len & 255]);
}
function cbor(v) {
  if (typeof v === "number" && v >= 0) return cborHead(0, v);
  if (typeof v === "number") return cborHead(1, -1 - v);
  if (v instanceof Uint8Array) return cat(cborHead(2, v.length), v);
  if (typeof v === "string") { const b = new TextEncoder().encode(v); return cat(cborHead(3, b.length), b); }
  if (v instanceof Map) { const p = []; for (const [k, x] of v) p.push(cbor(k), cbor(x)); return cat(cborHead(5, v.size), ...p); }
  throw new Error("no");
}
function rawToDer(raw) {
  const int = (b) => {
    let v = b, n = 0; while (n < v.length - 1 && v[n] === 0) n++;
    v = v.slice(n);
    if (v[0] & 0x80) v = cat(Uint8Array.from([0]), v);
    return cat(Uint8Array.from([0x02, v.length]), v);
  };
  const body = cat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return cat(Uint8Array.from([0x30, body.length]), body);
}
function unb64(s) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
}

async function authenticator(credentialId = "cred-a") {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, unb64(jwk.x)], [-3, unb64(jwk.y)]]);
  const credId = new TextEncoder().encode(credentialId);
  const ad = async (count, attested) => {
    const rp = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("isibi.ai")));
    const head = cat(rp, Uint8Array.from([attested ? 0x45 : 0x05]), Uint8Array.from([0, 0, 0, count]));
    return attested ? cat(head, new Uint8Array(16), Uint8Array.from([0, credId.length]), credId, cbor(cose)) : head;
  };
  return {
    credId: wanB64(credId),
    register: async (challenge) => ({
      clientDataJSON: wanB64(new TextEncoder().encode(JSON.stringify({ type: "webauthn.create", challenge, origin: ORIGIN }))),
      attestationObject: wanB64(cbor(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", await ad(0, true)]]))),
    }),
    assert: async (challenge, count = 1) => {
      const clientDataJSON = wanB64(new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge, origin: ORIGIN })));
      const data = await ad(count, false);
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", unb64(clientDataJSON)));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, cat(data, hash)));
      return { clientDataJSON, authenticatorData: wanB64(data), signature: wanB64(rawToDer(raw)) };
    },
  };
}

async function withPasskey(over = {}) {
  const h = await harness(over);
  const auth = await authenticator();
  const start = await h.call("passkey/register/start", { token: h.session });
  const fin = await h.call("passkey/register/finish", { token: h.session, body: { response: await auth.register(start.body.challenge) } });
  assert.equal(fin.status, 200, JSON.stringify(fin.body));
  return { h, auth };
}

test("a passkey registers and then signs the member in", async () => {
  const { h, auth } = await withPasskey();
  const start = await h.call("passkey/login/start", {});
  const r = await h.call("passkey/login/finish", {
    body: { challenge: start.body.challenge, credentialId: auth.credId, response: await auth.assert(start.body.challenge) },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(await verifySession(h.key, r.body.token, { nowMs: NOW }));
});

test("a passkey login challenge is single use", async () => {
  // Without spending it, one captured assertion signs in forever.
  const { h, auth } = await withPasskey();
  const start = await h.call("passkey/login/start", {});
  const body = { challenge: start.body.challenge, credentialId: auth.credId, response: await auth.assert(start.body.challenge) };
  assert.equal((await h.call("passkey/login/finish", { body })).status, 200);
  const again = await h.call("passkey/login/finish", { body });
  assert.equal(again.status, 400);
  assert.equal(again.body.code, "challenge");
});

test("a suspended member cannot sign in with their passkey", async () => {
  const { h, auth } = await withPasskey();
  h.users.get("1").blocked = 1;
  const start = await h.call("passkey/login/start", {});
  const r = await h.call("passkey/login/finish", {
    body: { challenge: start.body.challenge, credentialId: auth.credId, response: await auth.assert(start.body.challenge) },
  });
  assert.equal(r.status, 401);
});

test("an unknown credential id does not sign anyone in", async () => {
  const { h, auth } = await withPasskey();
  const start = await h.call("passkey/login/start", {});
  const r = await h.call("passkey/login/finish", {
    body: { challenge: start.body.challenge, credentialId: "not-registered", response: await auth.assert(start.body.challenge) },
  });
  assert.equal(r.status, 401);
});

test("a passkey on a 2FA account still stops at the second factor", async () => {
  const { h, auth } = await withPasskey({ user: { totp_enabled: 1, totp_secret: newTotpSecret() } });
  const start = await h.call("passkey/login/start", {});
  const r = await h.call("passkey/login/finish", {
    body: { challenge: start.body.challenge, credentialId: auth.credId, response: await auth.assert(start.body.challenge) },
  });
  assert.equal(r.body.token, undefined);
  assert.ok(r.body.pending);
});

test("a tampered passkey assertion does not sign anyone in", async () => {
  const { h, auth } = await withPasskey();
  const start = await h.call("passkey/login/start", {});
  const response = await auth.assert(start.body.challenge);
  // Flip a byte of the signature.
  const sig = unb64(response.signature);
  sig[sig.length - 1] ^= 0xff;
  response.signature = wanB64(sig);
  const r = await h.call("passkey/login/finish", {
    body: { challenge: start.body.challenge, credentialId: auth.credId, response },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "signature");
});

test("a passkey whose counter went backwards is refused as cloned", async () => {
  // Two authenticators answering for one credential means the private key was
  // copied off the device. Signing them in anyway would be the whole point of
  // the counter, wasted.
  const { h, auth } = await withPasskey();
  const first = await h.call("passkey/login/start", {});
  assert.equal((await h.call("passkey/login/finish", {
    body: { challenge: first.body.challenge, credentialId: auth.credId, response: await auth.assert(first.body.challenge, 9) },
  })).status, 200);

  const second = await h.call("passkey/login/start", {});
  const r = await h.call("passkey/login/finish", {
    body: { challenge: second.body.challenge, credentialId: auth.credId, response: await auth.assert(second.body.challenge, 3) },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "cloned");
});

// ------------------------------------------------------- the wiring is real
//
// A registry nothing reads is the trap this whole session has been about, so
// these read worker.js and the template rather than trusting that I wired them.

import fs from "node:fs";
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const ROWS = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");

test("the Worker routes by the registry, not by a list of method names", () => {
  assert.match(WORKER, /routeFor\(action\)/, "the router must consult the registry");
  assert.match(WORKER, /handleAuthFlow\(/);
  // Multi-segment, or every method route 404s. Asserted on the character class
  // itself: a single-segment matcher would send passkey/login/start to a 404.
  // Only the character class is examined — matching the `auth\/` prefix too
  // would always contain a slash and assert nothing.
  const matcher = WORKER.match(/auth\\\/\(\[a-z0-9\]\[([^\]]+)\]/);
  assert.ok(matcher, "the auth path matcher was not found");
  assert.ok(matcher[1].includes("/"), "the matcher must allow slashes, or every method route 404s: " + matcher[1]);
});

test("the Worker creates the tables the registry declares", () => {
  assert.match(WORKER, /for \(const sql of AUTH_DDL\)/, "the DDL must actually be executed");
  assert.match(WORKER, /for \(const sql of AUTH_USER_COLUMNS\)/);
  // And called from the route, not merely defined.
  assert.match(WORKER, /await ensureAuthTables\(db\)/, "a table nobody creates makes every method route a 500");
});

test("every dep handleAuthFlow calls is supplied by the Worker", () => {
  // A missing one is a runtime TypeError on a public endpoint, which is exactly
  // the class of thing a test should catch instead of a visitor.
  const flows = fs.readFileSync(new URL("../site-auth-flows.mjs", import.meta.url), "utf8");
  const used = [...flows.matchAll(/deps\.([a-zA-Z]+)/g)].map((m) => m[1]);
  const wired = WORKER.slice(WORKER.indexOf("function authFlowDeps"));
  for (const name of new Set(used)) {
    assert.ok(wired.includes(name + ":") || wired.includes(name + " ") || wired.includes(name + "("),
      "authFlowDeps is missing " + name);
  }
});

test("the client can reach every method the registry offers", () => {
  for (const hook of [
    "useSignInMethods", "startOAuthSignIn", "usePasskeySignIn", "useAddPasskey",
    "useRequestSignInCode", "useVerifySignInCode", "useVerifySecondFactor",
    "useStartTotp", "useEnableTotp", "useDisableTotp", "useConnectedAccounts",
  ]) {
    assert.ok(new RegExp("export (async )?function " + hook + "|export const " + hook).test(ROWS), hook + " missing from the template");
  }
});

test("the owner's panel never hands a client secret back", () => {
  // A GET that returned them would make every read of that panel a place they
  // can leak — to a browser extension, a screenshot, a support ticket.
  const access = WORKER.slice(WORKER.indexOf("methods: availableMethods(cfg)"), WORKER.indexOf("methods: availableMethods(cfg)") + 600);
  assert.ok(!/client_secret/.test(access), "the access GET must not return client secrets");
});

test("the login path can actually read the lockout columns", () => {
  // They existed only in the dead D1-era CREATE, so on every site the builder
  // has made they were not there at all. A counter the login lookup cannot
  // select is a counter that is always undefined and always zero.
  assert.match(WORKER, /ALTER TABLE _users ADD COLUMN failed INTEGER/);
  assert.match(WORKER, /ALTER TABLE _users ADD COLUMN locked_until BIGINT/);
  const find = WORKER.match(/findUser: \(_s, email\)[^\n]*/)[0];
  for (const col of ["failed", "locked_until", "last_failed_at"]) {
    assert.ok(find.includes(col), "the login lookup must select " + col);
  }
  assert.match(WORKER, /recordLoginAttempt:/, "and something must write them back");
});

test("the lockout columns are added where the LOGIN path runs", () => {
  // ensureAuthExtras is only reachable from the dead /verify page, so adding
  // them only there would leave them missing on every site that never had a
  // verification link clicked.
  const ensure = WORKER.slice(WORKER.indexOf("async function ensureSiteUsers"), WORKER.indexOf("async function ensureSiteUsers") + 1600);
  assert.match(ensure, /ADD COLUMN failed/, "ensureSiteUsers is what login calls");
});

// ------------------------------------------------------- confirming an address
//
// There WAS a verification flow. `verified`, `verify_token` and `verify_exp` are
// columns on every site's _users and a /verify page still existed — but it ran
// on the pre-deletion D1 token scheme, so it could not have validated a token
// the live system minted, and nothing minted one.

import { signVerify, verifyVerification, signReset } from "../site-auth.mjs";

async function verifyHarness(over = {}) {
  const h = await harness(over);
  const marked = [];
  h.deps.setVerified = async (id) => { marked.push(id); h.users.get(String(id)).verified = 1; };
  h.sentVerify = [];
  h.deps.sendVerify = async (email, token) => { h.sentVerify.push({ email, token }); };
  h.marked = marked;
  return h;
}

test("a verification link confirms the address", async () => {
  const h = await verifyHarness();
  const token = await signVerify(h.key, "1", { nowMs: NOW });
  const r = await h.call("verify/confirm", { body: { token } });
  assert.equal(r.status, 200);
  assert.equal(h.marked.length, 1);
  assert.equal(h.users.get("1").verified, 1, "the flag is what matters");
});

test("clicking the link twice is fine", async () => {
  // Mail clients prefetch links, and people click again to check it worked.
  const h = await verifyHarness();
  const token = await signVerify(h.key, "1", { nowMs: NOW });
  assert.equal((await h.call("verify/confirm", { body: { token } })).status, 200);
  const again = await h.call("verify/confirm", { body: { token } });
  assert.equal(again.status, 200);
  assert.equal(h.marked.length, 1, "already verified — nothing more to write");
});

test("no other token kind confirms an address", async () => {
  // The whole reason each kind carries a `use`.
  const h = await verifyHarness();
  const session = h.session;
  const reset = await signReset(h.key, "1", { nowMs: NOW });
  for (const token of [session, reset, "forged", ""]) {
    const r = await h.call("verify/confirm", { body: { token } });
    assert.equal(r.status, 400, JSON.stringify(String(token).slice(0, 12)));
  }
  assert.equal(h.marked.length, 0);
});

test("a verification token is not a session", async () => {
  const h = await verifyHarness();
  const token = await signVerify(h.key, "1", { nowMs: NOW });
  assert.equal(await verifySession(h.key, token, { nowMs: NOW }), null);
  assert.equal((await h.call("identities", { token })).status, 401);
});

test("an expired link is refused", async () => {
  const h = await verifyHarness();
  const token = await signVerify(h.key, "1", { nowMs: NOW, ttlSec: 60 });
  const r = await h.call("verify/confirm", { body: { token }, nowMs: NOW + 120_000 });
  assert.equal(r.status, 400);
});

test("a suspended member's link does nothing", async () => {
  const h = await verifyHarness({ user: { blocked: 1 } });
  const token = await signVerify(h.key, "1", { nowMs: NOW });
  assert.equal((await h.call("verify/confirm", { body: { token } })).status, 400);
  assert.equal(h.marked.length, 0);
});

test("expired, forged and wrong-kind all answer identically", async () => {
  // Telling them apart says which half of a stale link failed.
  const h = await verifyHarness();
  const expired = await signVerify(h.key, "1", { nowMs: NOW - 1_000_000_000 });
  const a = await h.call("verify/confirm", { body: { token: expired } });
  const b = await h.call("verify/confirm", { body: { token: "forged" } });
  assert.deepEqual(a.body, b.body);
});

test("asking for a new link needs a session", async () => {
  const h = await verifyHarness();
  assert.equal((await h.call("verify/request", {})).status, 401);
  const r = await h.call("verify/request", { token: h.session });
  assert.equal(r.status, 200);
  assert.equal(h.sentVerify.length, 1);
});

test("an already-verified member is not sent another link", async () => {
  const h = await verifyHarness({ user: { verified: 1 } });
  const r = await h.call("verify/request", { token: h.session });
  assert.equal(r.body.already, true);
  assert.equal(h.sentVerify.length, 0);
});

test("a mailer that throws does not fail the request", async () => {
  // They are already signed in and can ask again; an error here helps nobody.
  const h = await verifyHarness();
  h.deps.sendVerify = async () => { throw new Error("mailer down"); };
  assert.equal((await h.call("verify/request", { token: h.session })).status, 200);
});

test("resending is throttled", async () => {
  const h = await verifyHarness({ throttled: true });
  assert.equal((await h.call("verify/request", { token: h.session })).status, 429);
});

test("verify-email is not offered as a way to sign IN", () => {
  const names = availableMethods({ mailer: true }).map((m) => m.name);
  assert.ok(!names.includes("verify-email"));
  // ...but its routes are declared in the registry like every other one.
  assert.ok(routeFor("verify/confirm"));
  assert.ok(routeFor("verify/request"));
});

test("the /verify page runs on the LIVE token family", () => {
  // It ran on verifySiteUserToken, the D1-era scheme with a different key
  // derivation, and called initSiteAuth — which creates a SECOND `_users` shape
  // with pass_salt NOT NULL. On a site where this page ran before anyone signed
  // up, that shape won and every later signup failed a NOT NULL constraint.
  const start = WORKER.indexOf('url.pathname === "/verify"');
  // Comments in this block NAME the old functions to explain why they are gone,
  // so the assertion has to look at code rather than at prose.
  // Wide enough to clear the inline HTML template that sits between the route
  // match and the code being asserted on.
  const page = WORKER.slice(start, start + 9000)
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.match(page, /verifyVerification\(/, "the verify page must use the live token family");
  assert.ok(!/verifySiteUserToken\(/.test(page), "the D1-era verifier must be gone from this path");
  assert.ok(!/initSiteAuth\(/.test(page), "initSiteAuth creates a conflicting _users shape");
});
