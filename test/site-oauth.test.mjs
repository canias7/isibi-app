// "Continue with Google", and its six siblings.
//
// One flow, seven rows of configuration. The tests concentrate on the three
// places a mistake is not visible: the signed state (login CSRF), PKCE, and how
// a provider's answer becomes a profile the identity layer will act on — because
// `emailVerified` deciding wrongly is an account takeover in the next module.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDERS, PROVIDER_NAMES, providerConfig, enabledProviders, redirectUri,
  makeVerifier, challengeFor, startOAuth, completeOAuth, profileFrom, safeNext, decodeIdToken,
} from "../site-oauth.mjs";

const ORIGIN = "https://isibi.ai";
const SLUG = "barber";
const CONFIG = { google: { client_id: "cid", client_secret: "secret" } };

const deps = (over = {}) => ({
  signState: async (p) => "STATE:" + JSON.stringify(p),
  verifyState: async (t) => { try { return JSON.parse(String(t).replace(/^STATE:/, "")); } catch { return null; } },
  exchange: async () => ({ access_token: "at" }),
  fetchProfile: async () => ({ sub: "g-1", email: "ada@example.com", email_verified: true, name: "Ada" }),
  ...over,
});

// --------------------------------------------------------------- configuration

test("every provider names a subject field that is not the email", () => {
  // Keying on the address means an account is inherited by whoever gets that
  // address next.
  for (const [name, p] of Object.entries(PROVIDERS)) {
    assert.ok(p.subject, name);
    assert.notEqual(p.subject, "email", name + " must not identify people by address");
  }
});

test("providers that cannot assert a verified email say so with null", () => {
  // GitHub hands back addresses the user never confirmed. Microsoft omits the
  // claim. Both must be null here, or the identity layer will auto-link them.
  assert.equal(PROVIDERS.github.emailVerified, null);
  assert.equal(PROVIDERS.microsoft.emailVerified, null);
  assert.equal(PROVIDERS.google.emailVerified, "email_verified");
});

test("a provider with no credentials is not configured", () => {
  assert.equal(providerConfig("google", {}), null);
  assert.equal(providerConfig("google", { google: { client_id: "x" } }), null, "secret required too");
  assert.ok(providerConfig("google", CONFIG));
});

test("an unknown provider name is null, not a crash", () => {
  assert.equal(providerConfig("myspace", { myspace: { client_id: "a", client_secret: "b" } }), null);
  assert.equal(providerConfig("", CONFIG), null);
  assert.equal(providerConfig(null, CONFIG), null);
});

test("generic OIDC needs its endpoints supplied", () => {
  assert.equal(providerConfig("oidc", { oidc: { client_id: "a", client_secret: "b" } }), null);
  const ok = providerConfig("oidc", { oidc: { client_id: "a", client_secret: "b", authorize: "https://idp/a", token: "https://idp/t" } });
  assert.equal(ok.authorize, "https://idp/a");
});

test("only configured providers are offered", () => {
  assert.deepEqual(enabledProviders({}), []);
  const list = enabledProviders({ ...CONFIG, github: { client_id: "a", client_secret: "b", label: "Our GitHub" } });
  assert.deepEqual(list.map((p) => p.key).sort(), ["github", "google"]);
  assert.equal(list.find((p) => p.key === "github").label, "Our GitHub");
});

test("the redirect uri has one shape, so it can be registered once", () => {
  assert.equal(redirectUri(ORIGIN, SLUG, "google"), "https://isibi.ai/api/db/barber/auth/oauth/google/callback");
  assert.equal(redirectUri(ORIGIN + "/", SLUG, "google"), "https://isibi.ai/api/db/barber/auth/oauth/google/callback");
});

// --------------------------------------------------------------- PKCE

test("PKCE challenge is the SHA-256 of the verifier, base64url", async () => {
  const v = makeVerifier();
  const c = await challengeFor(v);
  assert.notEqual(c, v);
  assert.match(c, /^[A-Za-z0-9_-]+$/, "no padding, no + or /");
  assert.equal(c, await challengeFor(v), "deterministic");
});

test("verifiers do not repeat", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(makeVerifier());
  assert.equal(seen.size, 200);
});

test("the authorize URL carries PKCE where the provider supports it", async () => {
  const r = await startOAuth(deps(), { provider: "google", siteConfig: CONFIG, origin: ORIGIN, slug: SLUG });
  const u = new URL(r.url);
  assert.equal(u.origin + u.pathname, PROVIDERS.google.authorize);
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.ok(u.searchParams.get("code_challenge"));
  assert.equal(u.searchParams.get("client_id"), "cid");
  assert.equal(u.searchParams.get("redirect_uri"), redirectUri(ORIGIN, SLUG, "google"));
});

test("a provider without PKCE support gets no challenge", async () => {
  const cfg = { github: { client_id: "a", client_secret: "b" } };
  const r = await startOAuth(deps(), { provider: "github", siteConfig: cfg, origin: ORIGIN, slug: SLUG });
  assert.equal(new URL(r.url).searchParams.get("code_challenge"), null);
});

// --------------------------------------------------------------- state

test("the state is signed and carries the provider and the verifier", async () => {
  const r = await startOAuth(deps(), { provider: "google", siteConfig: CONFIG, origin: ORIGIN, slug: SLUG });
  const claims = JSON.parse(r.state.replace(/^STATE:/, ""));
  assert.equal(claims.p, "google");
  assert.ok(claims.v, "the PKCE verifier travels inside the signed state, not a cookie");
});

test("a forged or missing state is refused", async () => {
  for (const state of ["", "nonsense", null]) {
    const r = await completeOAuth(deps({ verifyState: async () => null }), {
      provider: "google", code: "abc", state, siteConfig: CONFIG, origin: ORIGIN, slug: SLUG,
    });
    assert.equal(r.status, 400);
    assert.equal(r.reason, "state");
  }
});

test("a state minted for another provider does not work here", async () => {
  // Otherwise a state from a provider the attacker controls is replayed against
  // one they do not.
  const r = await completeOAuth(deps({ verifyState: async () => ({ p: "github" }) }), {
    provider: "google", code: "abc", state: "x", siteConfig: CONFIG, origin: ORIGIN, slug: SLUG,
  });
  assert.equal(r.reason, "state");
});

test("no code is refused before anything is exchanged", async () => {
  let exchanged = false;
  const r = await completeOAuth(deps({ exchange: async () => { exchanged = true; return {}; } }), {
    provider: "google", code: "", state: "STATE:" + JSON.stringify({ p: "google" }), siteConfig: CONFIG, origin: ORIGIN, slug: SLUG,
  });
  assert.equal(r.reason, "code");
  assert.equal(exchanged, false);
});

test("the verifier from the state is what is sent to the token endpoint", async () => {
  let sent = null;
  const start = await startOAuth(deps(), { provider: "google", siteConfig: CONFIG, origin: ORIGIN, slug: SLUG });
  await completeOAuth(deps({ exchange: async (_c, o) => { sent = o; return { access_token: "at" }; } }), {
    provider: "google", code: "abc", state: start.state, siteConfig: CONFIG, origin: ORIGIN, slug: SLUG,
  });
  const claims = JSON.parse(start.state.replace(/^STATE:/, ""));
  assert.equal(sent.verifier, claims.v);
  assert.equal(sent.redirectUri, redirectUri(ORIGIN, SLUG, "google"));
});

// --------------------------------------------------------------- open redirect

test("the post-login destination can only ever be a path here", () => {
  assert.equal(safeNext("/account"), "/account");
  assert.equal(safeNext("https://evil.example"), "/");
  // Protocol-relative: browsers treat it as absolute, which is the one people miss.
  assert.equal(safeNext("//evil.example"), "/");
  assert.equal(safeNext("/" + "x".repeat(400)), "/");
  assert.equal(safeNext(undefined), "/");
});

// --------------------------------------------------------------- the profile

test("a provider answer becomes the four fields the identity layer acts on", () => {
  const p = profileFrom(PROVIDERS.google, { sub: "g-1", email: "ada@example.com", email_verified: true, name: "Ada" });
  assert.deepEqual(p, { subject: "g-1", email: "ada@example.com", emailVerified: true, name: "Ada" });
});

test("a provider that cannot assert verification never reports verified", () => {
  // Even when it helpfully sends a field called email_verified.
  const p = profileFrom(PROVIDERS.github, { id: 42, email: "ada@example.com", email_verified: true });
  assert.equal(p.emailVerified, false);
  assert.equal(p.subject, "42", "numeric ids become strings");
});

test("a string \"true\" is not an assertion of verification", () => {
  const p = profileFrom(PROVIDERS.google, { sub: "g-1", email: "a@b.co", email_verified: "true" });
  assert.equal(p.emailVerified, false);
});

test("a missing subject comes through as null rather than undefined", () => {
  assert.equal(profileFrom(PROVIDERS.google, {}).subject, null);
  assert.equal(profileFrom(PROVIDERS.google, undefined).subject, null);
});

test("an id token decodes without being trusted to verify itself", () => {
  const payload = { sub: "a-1", email: "ada@example.com" };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  assert.deepEqual(decodeIdToken(`${b64({ alg: "RS256" })}.${b64(payload)}.sig`), payload);
  assert.equal(decodeIdToken("nope"), null);
  assert.equal(decodeIdToken(""), null);
});

test("every provider name resolves to a config entry", () => {
  for (const n of PROVIDER_NAMES) assert.ok(PROVIDERS[n], n);
});
