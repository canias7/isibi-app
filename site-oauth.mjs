// "Continue with Google" — and Microsoft, GitHub, Discord, Slack, Apple, and any
// OpenID Connect provider a company points at us.
//
// These are not seven features. They are one flow with seven rows of
// configuration, and the differences between them are small and specific enough
// to keep as data: which URL to send the person to, which one to swap the code
// at, where the profile lives, and what that provider calls its stable id.
//
// Two things here are load bearing and neither is the happy path:
//
//   STATE. The redirect back from the provider is an unauthenticated GET that
//   anybody can forge. Without a signed, single-purpose, site-bound state
//   parameter, an attacker can hand a victim a link that completes THEIR
//   sign-in inside the victim's browser — login CSRF — and now the victim is
//   quietly acting as the attacker on the site. The state here is an HMAC token
//   of the same family as the session and reset tokens, with its own `use`, so
//   it can be neither made into a session nor made from one.
//
//   PKCE. The authorization code travels through a redirect. If it leaks — a
//   referrer header, a shared device, a mis-registered redirect URI — a code
//   verifier the attacker never saw is what stops it being redeemed. Required
//   on every provider that supports it rather than only the ones that insist.
//
// Credentials are the SITE OWNER'S, not isibi's: the consent screen should say
// the barber shop's name, and a shared client would mean one review, one quota
// and one revocation for every site on the platform.

const enc = new TextEncoder();

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * The providers, as data.
 *
 * `subject` names the field holding the provider's own stable id — never the
 * email. `emailVerified` names the field asserting the address is real, or is
 * null when the provider makes no such claim, in which case we treat it as
 * unverified and refuse to auto-link. GitHub is the reason that column exists.
 */
export const PROVIDERS = {
  google: {
    label: "Google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    subject: "sub",
    email: "email",
    emailVerified: "email_verified",
    name: "name",
    pkce: true,
  },
  microsoft: {
    label: "Microsoft",
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfo: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile",
    subject: "sub",
    email: "email",
    emailVerified: null, // Entra does not return the claim; treated as unverified.
    name: "name",
    pkce: true,
  },
  github: {
    label: "GitHub",
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    userinfo: "https://api.github.com/user",
    scope: "read:user user:email",
    subject: "id",
    email: "email",
    // GitHub will happily hand back an address the user never confirmed, which
    // is the textbook takeover vector. Never auto-linked.
    emailVerified: null,
    name: "name",
    pkce: false,
  },
  discord: {
    label: "Discord",
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    userinfo: "https://discord.com/api/users/@me",
    scope: "identify email",
    subject: "id",
    email: "email",
    emailVerified: "verified",
    name: "global_name",
    pkce: true,
  },
  slack: {
    label: "Slack",
    authorize: "https://slack.com/openid/connect/authorize",
    token: "https://slack.com/api/openid.connect.token",
    userinfo: "https://slack.com/api/openid.connect.userInfo",
    scope: "openid email profile",
    subject: "sub",
    email: "email",
    emailVerified: "email_verified",
    name: "name",
    pkce: true,
  },
  apple: {
    label: "Apple",
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    // Apple returns no userinfo endpoint — the profile is inside the id_token,
    // and the name is sent ONCE, in the first callback's form body, never again.
    userinfo: null,
    scope: "name email",
    subject: "sub",
    email: "email",
    emailVerified: "email_verified",
    name: null,
    pkce: true,
    formPost: true,
  },
  oidc: {
    // Anything else: Okta, Auth0, Keycloak, Entra with a tenant, Google
    // Workspace as an IdP. URLs come from the site's own configuration.
    label: "Single sign-on",
    authorize: null,
    token: null,
    userinfo: null,
    scope: "openid email profile",
    subject: "sub",
    email: "email",
    emailVerified: "email_verified",
    name: "name",
    pkce: true,
  },
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

export function providerConfig(name, siteConfig = {}) {
  const key = String(name == null ? "" : name).trim().toLowerCase();
  const base = PROVIDERS[key];
  if (!base) return null;
  const site = siteConfig[key] || {};
  if (!site.client_id || !site.client_secret) return null;
  const merged = {
    ...base,
    key,
    clientId: String(site.client_id),
    clientSecret: String(site.client_secret),
    // A generic OIDC provider supplies its own endpoints; a named one may still
    // override them (Entra with a tenant id rather than /common).
    authorize: site.authorize || base.authorize,
    token: site.token || base.token,
    userinfo: site.userinfo === undefined ? base.userinfo : site.userinfo,
    scope: site.scope || base.scope,
  };
  if (!merged.authorize || !merged.token) return null;
  return merged;
}

/** Which providers this site has actually configured, for rendering the buttons. */
export function enabledProviders(siteConfig = {}) {
  return PROVIDER_NAMES
    .filter((n) => providerConfig(n, siteConfig))
    .map((n) => ({ key: n, label: (siteConfig[n] && siteConfig[n].label) || PROVIDERS[n].label }));
}

/** Where the provider sends them back. One shape, so it can be registered once. */
export const redirectUri = (origin, slug, provider) =>
  `${String(origin).replace(/\/+$/, "")}/api/db/${encodeURIComponent(slug)}/auth/oauth/${encodeURIComponent(provider)}/callback`;

// ------------------------------------------------------------- PKCE

export function makeVerifier(random) {
  const bytes = random ? random(32) : crypto.getRandomValues(new Uint8Array(32));
  return b64u(bytes);
}

export async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(String(verifier)));
  return b64u(digest);
}

// ------------------------------------------------------------- the flow

/**
 * Step one: where to send the person.
 *
 * deps:
 *   signState(payload) → token      an HMAC token with use:"oauth", short-lived
 */
export async function startOAuth(deps, { provider, siteConfig, origin, slug, next, random } = {}) {
  const cfg = providerConfig(provider, siteConfig);
  if (!cfg) return { error: "That sign-in option isn't set up on this site.", status: 404, reason: "provider" };

  const verifier = cfg.pkce ? makeVerifier(random) : null;
  // The verifier rides inside the SIGNED state rather than a cookie: a published
  // site is served from a path on a shared origin, so a cookie would be visible
  // to every other site on it. Signed, so it cannot be swapped for one the
  // attacker chose.
  const state = await deps.signState({
    p: cfg.key,
    v: verifier || undefined,
    // Where to land afterwards, kept as a PATH only — an absolute URL here is an
    // open redirect, which turns our domain into a phishing launcher.
    n: safeNext(next),
  });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(origin, slug, cfg.key),
    response_type: "code",
    scope: cfg.scope,
    state,
  });
  if (cfg.pkce) {
    params.set("code_challenge", await challengeFor(verifier));
    params.set("code_challenge_method", "S256");
  }
  // Apple only sends the name on a form_post response, and Microsoft needs it
  // spelled out to return an id_token alongside the code.
  if (cfg.formPost) params.set("response_mode", "form_post");

  return { url: cfg.authorize + "?" + params.toString(), state };
}

/**
 * Only ever a path on this site. `//evil.com` is a protocol-relative URL that
 * browsers treat as absolute, which is why the second character is checked too.
 */
export function safeNext(next) {
  const s = String(next == null ? "" : next);
  if (!s.startsWith("/") || s.startsWith("//")) return "/";
  if (s.length > 300) return "/";
  return s;
}

/**
 * Step two: the redirect came back. Turn it into a profile.
 *
 * deps:
 *   verifyState(token) → payload | null
 *   exchange(cfg, {code, verifier, redirectUri}) → {access_token, id_token}
 *   fetchProfile(cfg, tokens) → raw profile object
 */
export async function completeOAuth(deps, { provider, code, state, siteConfig, origin, slug } = {}) {
  const cfg = providerConfig(provider, siteConfig);
  if (!cfg) return { error: "That sign-in option isn't set up on this site.", status: 404, reason: "provider" };

  const claims = await deps.verifyState(state);
  if (!claims) return { error: "That sign-in link expired — try again.", status: 400, reason: "state" };
  // The state names the provider it was minted for. Without this check a state
  // issued for a provider the attacker controls could be replayed against one
  // they do not, which is the point of pinning it.
  if (claims.p !== cfg.key) return { error: "That sign-in link expired — try again.", status: 400, reason: "state" };
  if (!code || typeof code !== "string") return { error: "That sign-in didn't complete.", status: 400, reason: "code" };

  let tokens;
  try {
    tokens = await deps.exchange(cfg, { code, verifier: claims.v || null, redirectUri: redirectUri(origin, slug, cfg.key) });
  } catch (e) {
    return { error: "That sign-in didn't complete.", status: 502, reason: "exchange", detail: String((e && e.message) || e).slice(0, 200) };
  }
  if (!tokens || (!tokens.access_token && !tokens.id_token)) {
    return { error: "That sign-in didn't complete.", status: 502, reason: "exchange" };
  }

  let raw;
  try { raw = await deps.fetchProfile(cfg, tokens); }
  catch (e) {
    return { error: "That sign-in didn't complete.", status: 502, reason: "profile", detail: String((e && e.message) || e).slice(0, 200) };
  }

  return { profile: profileFrom(cfg, raw), next: safeNext(claims.n) };
}

/** The provider's answer, reduced to the four things the identity layer acts on. */
export function profileFrom(cfg, raw = {}) {
  const get = (field) => (field && raw && raw[field] !== undefined ? raw[field] : null);
  const verifiedField = cfg.emailVerified ? get(cfg.emailVerified) : null;
  return {
    subject: get(cfg.subject) == null ? null : String(get(cfg.subject)),
    email: typeof get(cfg.email) === "string" ? get(cfg.email) : null,
    // `true` only. Some providers send the string "true", which is not the same
    // as having asserted it — and coercing it is how an unverified address gets
    // auto-linked to somebody else's account.
    emailVerified: verifiedField === true,
    name: typeof get(cfg.name) === "string" ? get(cfg.name) : null,
  };
}

/** Decoded, NOT verified — only ever used for a profile we already trust the transport of. */
export function decodeIdToken(jwt) {
  const parts = String(jwt || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
