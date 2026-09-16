/**
 * WHO IS ASKING — verified against the PROJECT'S OWN SIGNING CONFIGURATION.
 *
 * A bearer token in, a tenant out, or a refusal. This is the only thing in the
 * codebase allowed to decide a tenant's identity, and everything downstream takes
 * that answer as authority.
 *
 * **THE SIGNING SECRET IS NO LONGER REQUIRED, AND THAT IS THE POINT OF THIS
 * FILE.** Asking an operator for a project's HS256 secret means asking for the
 * credential that can MINT a token for any user — to do a job that only needs the
 * ability to CHECK one. Two ways to check without it, and the token itself says
 * which applies:
 *
 *   `jwks`   — the project publishes a public key (ES256/RS256) at
 *              `/auth/v1/.well-known/jwks.json`. Verified here, in this process,
 *              with WebCrypto. No secret, no network per request, no trust in
 *              anything but arithmetic. THIS IS THE PREFERRED PATH.
 *   `auth`   — an HS256 token cannot be verified without the shared secret, so
 *              the question is asked of the one party that already holds it:
 *              `GET /auth/v1/user`. Supabase checks the signature and we read
 *              its answer. Costs a round trip; needs only the PUBLISHABLE key.
 *   `secret` — local HS256, and OPT-IN ONLY. Kept because an operator who has
 *              already accepted the secret's blast radius should not be forced
 *              into a network call on every request. Never a default.
 *
 * MEASURED against this project (2026-09-15), which is why the `auth` path is
 * known to work rather than assumed to: a genuine legacy HS256 token is answered
 * `missing sub claim` (the signature PASSED and it got as far as the claims), and
 * the same token with one character changed is answered `token signature is
 * invalid`. Two different refusals for two different causes is exactly what makes
 * it usable as an oracle.
 *
 * **NOTHING HERE CHANGES THE PROJECT'S CONFIGURATION.** It reads a public
 * endpoint and calls a public API. The shared project's signing keys are not
 * touched, rotated, or read.
 *
 * DEPENDENCY-FREE: WebCrypto, `atob` and an injected `fetch`, all of which a
 * Cloudflare Worker has. The clock is injected too, so every branch below —
 * including expiry and the JWKS cache — is drivable without waiting.
 *
 * **THE CLAIM NAME MUST MATCH THE DATABASE.** `agent.tenant_id()` in the
 * migration reads `tenant_id` and falls back to `sub`, and so does this. They are
 * the same fact in two languages, which is a drift this repository has no type
 * system to catch — so a test reads the migration and compares.
 */

/**
 * WHICH CLAIM CARRIES THE TENANT, IN ORDER OF PRECEDENCE — and this list must
 * match `agent.tenant_id()` in the migration exactly, because the two are the same
 * decision made twice in two languages.
 *
 * `tenant_id` is explicit and wins. `sub` is the fallback, and it is what makes
 * this work with real Supabase tokens at all: **SUPABASE DOES NOT PUT A
 * `tenant_id` CLAIM IN A JWT**, so keying only on it meant every genuinely
 * signed-in customer was refused. Found by driving the real handler against the
 * real project, NOT by the tests — every token they mint carries a `tenant_id`,
 * which made the fixture more capable than reality.
 */
export const TENANT_CLAIMS = Object.freeze(["tenant_id", "sub"]);

/** The explicit claim, kept as its own name because the migration is read for it. */
export const TENANT_CLAIM = TENANT_CLAIMS[0];

/**
 * The asymmetric algorithms verified against a PUBLISHED key, and the WebCrypto
 * parameters each one means.
 *
 * **THE ALGORITHM IS TAKEN FROM THE KEY, NOT FROM THE TOKEN** — see `verify`.
 * This table exists so that a token naming `ES256` and a key declaring `ES256`
 * can be compared as equals; it is never used to look up "whatever the token
 * asked for".
 */
export const ASYMMETRIC = Object.freeze({
  ES256: Object.freeze({ import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" } }),
  ES384: Object.freeze({ import: { name: "ECDSA", namedCurve: "P-384" }, verify: { name: "ECDSA", hash: "SHA-384" } }),
  ES512: Object.freeze({ import: { name: "ECDSA", namedCurve: "P-521" }, verify: { name: "ECDSA", hash: "SHA-512" } }),
  RS256: Object.freeze({ import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } }),
  RS384: Object.freeze({ import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" }, verify: { name: "RSASSA-PKCS1-v1_5" } }),
  RS512: Object.freeze({ import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }, verify: { name: "RSASSA-PKCS1-v1_5" } }),
});

/** The one symmetric algorithm. Never verified against a JWKS key — see `verify`. */
export const HS = "HS256";

/** The three ways a token can be checked. Reported on every success. */
export const STRATEGIES = Object.freeze(["jwks", "auth", "secret"]);

/** Why a token was refused. For LOGS, never for a response body — see `api.mjs`. */
export const REFUSALS = Object.freeze([
  "no-token", "malformed", "bad-alg", "bad-signature", "expired", "not-yet-valid",
  "no-tenant", "no-key", "unavailable",
]);

/** How long a fetched key set is trusted before it is asked for again. */
export const JWKS_TTL_MS = 600_000;

/**
 * The floor between two fetches provoked by an UNKNOWN `kid`.
 *
 * Without it, anyone can make this Worker hammer the auth endpoint by sending
 * tokens with invented `kid`s — a refusal that costs the attacker nothing and us
 * a request each time.
 */
export const JWKS_MIN_REFETCH_MS = 60_000;

/** How long a successful `auth` answer is reused. Bounded by the token's own expiry. */
export const AUTH_CACHE_MS = 60_000;

/** How many `auth` answers are held at once. A cache with no ceiling is a leak. */
export const AUTH_CACHE_MAX = 500;

const no = (reason) => Object.freeze({ ok: false, reason });

function b64urlToBytes(s) {
  if (typeof s !== "string" || s === "") throw new Error("empty segment");
  // A base64url segment has no padding and uses - and _ . Anything else is not
  // one, and is refused rather than repaired: a decoder that fixes up its input
  // accepts tokens a real one would reject.
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("not base64url");
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
const isText = (v) => typeof v === "string" && v.trim() !== "";
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * An ECDSA signature in a JWT is the raw `r||s` pair, which is what WebCrypto
 * wants. An RSA one is the raw modulus-sized block. Neither needs unwrapping —
 * this is here to say so, because the DER-vs-raw confusion is the classic way an
 * ES256 verifier is written that refuses every valid token.
 */
const sigBytes = (s) => b64urlToBytes(s);

export function makeVerifier(opts = {}) {
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const skewMs = Number.isFinite(opts.skewMs) && opts.skewMs >= 0 ? opts.skewMs : 0;
  const issuer = isText(opts.issuer) ? opts.issuer : null;
  const audience = isText(opts.audience) ? opts.audience : null;
  const base = isText(opts.url) ? opts.url.replace(/\/+$/, "") : null;
  const apikey = isText(opts.apikey) ? opts.apikey : null;
  const doFetch = typeof opts.fetch === "function" ? opts.fetch : null;
  const secret = isText(opts.secret) ? opts.secret : null;
  const jwksTtlMs = Number.isFinite(opts.jwksTtlMs) && opts.jwksTtlMs >= 0 ? opts.jwksTtlMs : JWKS_TTL_MS;
  const minRefetchMs = Number.isFinite(opts.jwksMinRefetchMs) && opts.jwksMinRefetchMs >= 0 ? opts.jwksMinRefetchMs : JWKS_MIN_REFETCH_MS;
  const authCacheMs = Number.isFinite(opts.authCacheMs) && opts.authCacheMs >= 0 ? opts.authCacheMs : AUTH_CACHE_MS;
  const onRefusal = typeof opts.onRefusal === "function" ? opts.onRefusal : () => {};

  // **A VERIFIER THAT CAN CHECK NOTHING IS A CONSTRUCTION ERROR, NOT A RUNTIME
  // 401.** Without a way to reach the project and without a secret, every request
  // would be refused for a reason that has nothing to do with the request — which
  // reads, from outside, exactly like every customer's token being forged.
  if (secret === null && (base === null || doFetch === null)) {
    throw new TypeError("makeVerifier: needs { url, fetch } to verify against the project, or an opt-in { secret }");
  }

  // ── the published keys ─────────────────────────────────────────────────────
  let keys = new Map();          // kid -> { alg, key }  (imported CryptoKey)
  let keysAt = -Infinity;        // when the set was last fetched
  let inflight = null;

  async function fetchJwks() {
    const res = await doFetch(`${base}/auth/v1/.well-known/jwks.json`, {
      headers: apikey ? { apikey, accept: "application/json" } : { accept: "application/json" },
    });
    if (!res?.ok) throw new Error(`jwks: HTTP ${res?.status}`);
    const body = JSON.parse(await res.text());
    const list = Array.isArray(body?.keys) ? body.keys : [];
    const next = new Map();
    for (const jwk of list) {
      // A KEY THIS CANNOT USE IS SKIPPED, NOT GUESSED AT. `use: "enc"` is an
      // encryption key and verifying with it is a category error; an unknown
      // `alg` is a key whose parameters we would have to invent.
      if (!isObj(jwk) || !isText(jwk.kid) || !isText(jwk.alg)) continue;
      if (isText(jwk.use) && jwk.use !== "sig") continue;
      const spec = Object.hasOwn(ASYMMETRIC, jwk.alg) ? ASYMMETRIC[jwk.alg] : null;
      if (!spec) continue;
      try {
        const key = await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, spec.import, false, ["verify"]);
        next.set(jwk.kid, { alg: jwk.alg, key, verify: spec.verify });
      } catch { /* a key that will not import is a key we cannot use */ }
    }
    return next;
  }

  /**
   * The key for a `kid`, fetching the set if it is stale or if the `kid` is one
   * we have not seen — a rotation has to work without a deployment.
   *
   * Answers `undefined` for "no such key" and THROWS for "could not ask". The two
   * are different: one is a bad token, the other is our own outage, and collapsing
   * them would report an outage as a forged token to every customer at once.
   */
  async function keyFor(kid) {
    const t = now();
    const stale = t - keysAt >= jwksTtlMs;
    if (!stale && keys.has(kid)) return keys.get(kid);
    const mayRefetch = stale || (t - keysAt >= minRefetchMs);
    if (!mayRefetch) return undefined;
    // One fetch at a time. A burst of first requests on a cold isolate would
    // otherwise be a burst of identical requests at the auth endpoint.
    inflight ??= fetchJwks().then(
      (next) => { keys = next; keysAt = now(); inflight = null; return next; },
      (e) => { inflight = null; throw e; },
    );
    await inflight;
    return keys.get(kid);
  }

  // ── the symmetric key, if an operator opted in ─────────────────────────────
  let hmacPromise = null;
  const hmac = () => (hmacPromise ??= crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  ));

  // ── the `auth` strategy's cache ────────────────────────────────────────────
  const seen = new Map();   // token -> { until }

  function remember(token, until) {
    // Oldest out first. `Map` iterates in insertion order, so the first key is
    // the oldest — and a re-remembered token is deleted before it is re-set, or
    // it would keep its original position and never be the one evicted.
    seen.delete(token);
    seen.set(token, { until });
    while (seen.size > AUTH_CACHE_MAX) {
      const oldest = seen.keys().next();
      if (oldest.done) break;
      seen.delete(oldest.value);
    }
  }

  /**
   * Ask Supabase whether this token is genuine. Answers `true`, `false`, or
   * THROWS when it could not be asked.
   *
   * **A NON-ANSWER IS NOT A NO.** A 500, a timeout or an unreachable host means
   * we do not know, and reading that as "forged" would turn a brief auth outage
   * into every customer being told their credentials are bad.
   */
  async function askAuth(token) {
    const res = await doFetch(`${base}/auth/v1/user`, {
      headers: { apikey, authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (res?.ok) return { good: true };
    // 401 and 403 are the real answers: Supabase looked and said no. Its own
    // words ride along, because "refused" covers a forged signature AND a
    // genuinely signed token that names no user, and those are different bugs to
    // go and look for. The DECISION is the same either way; only the log differs.
    if (res?.status === 401 || res?.status === 403) {
      let said = "";
      try { said = (typeof res.text === "function" ? await res.text() : "").slice(0, 200); } catch { said = ""; }
      return { good: false, status: res.status, said };
    }
    throw new Error(`auth: HTTP ${res?.status}`);
  }

  return async function verify(token) {
    if (!isText(token)) return no("no-token");
    const parts = token.split(".");
    // Exactly three. A two-part token is the `alg: none` shape, and a four-part
    // one is an encrypted token this is not equipped to read — neither is
    // "nearly valid".
    if (parts.length !== 3) return no("malformed");
    const [h, p, sig] = parts;

    let header;
    try { header = decodeJson(h); } catch { return no("malformed"); }
    if (!isObj(header)) return no("malformed");
    if (!isText(header.alg)) return no("bad-alg");

    // **THE HEADER ROUTES; IT NEVER AUTHORISES.** Reading `alg` to choose a
    // STRATEGY is safe. Reading it to choose a KEY is the oldest hole in JWT:
    // `none` makes every token valid, and naming HS256 against a published key
    // turns the PUBLIC key into the shared secret. So the two families are kept
    // strictly apart below — an HS256 token can never reach a JWKS key, and an
    // asymmetric token can never reach the HMAC one.
    const asym = Object.hasOwn(ASYMMETRIC, header.alg) ? ASYMMETRIC[header.alg] : null;
    if (!asym && header.alg !== HS) return no("bad-alg");

    let strategy;
    if (asym) {
      if (base === null || doFetch === null) return no("bad-alg");
      strategy = "jwks";
    } else {
      strategy = secret !== null ? "secret" : "auth";
    }

    // ── the signature, before the payload is even parsed ──────────────────────
    // Reading claims first is how unsigned data gets trusted by accident — a log
    // line, an early return, a metric keyed on an unverified tenant.
    if (strategy === "jwks") {
      if (!isText(header.kid)) return no("no-key");
      let entry;
      try { entry = await keyFor(header.kid); }
      catch (e) { onRefusal({ at: "jwks", error: String(e?.message ?? e) }); return no("unavailable"); }
      if (!entry) return no("no-key");
      // **THE KEY'S OWN `alg` DECIDES.** The token's `alg` had to match a name in
      // the table to get here, and now it has to match the PUBLISHED key's
      // declared algorithm too. A key published as ES256 is never used to check an
      // RS256 token because a token said so.
      if (entry.alg !== header.alg) return no("bad-alg");
      let okSig = false;
      try {
        okSig = await crypto.subtle.verify(
          entry.verify, entry.key, sigBytes(sig), new TextEncoder().encode(`${h}.${p}`),
        );
      } catch { return no("malformed"); }
      if (!okSig) return no("bad-signature");
    } else if (strategy === "secret") {
      let okSig = false;
      try {
        okSig = await crypto.subtle.verify(
          "HMAC", await hmac(), b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`),
        );
      } catch { return no("malformed"); }
      if (!okSig) return no("bad-signature");
    } else {
      if (!isText(apikey)) return no("unavailable");
      // **AN EXPIRED TOKEN IS REFUSED BEFORE IT COSTS A ROUND TRIP.** Expired
      // tokens are the commonest bad token there is — a stale tab retrying — and
      // on this path each one would otherwise buy a request at the auth endpoint.
      //
      // READING A CLAIM BEFORE THE SIGNATURE IS CHECKED IS SAFE ONLY IN THIS
      // DIRECTION, and that is the whole argument for it: this shortcut can
      // REFUSE and can never ADMIT. It fires only on a payload that parses, whose
      // `exp` is a number, and which is already past — anything else falls through
      // to the real check below, which is still the authoritative one. Delete this
      // block and the verdicts are identical; only the bill changes.
      let peek = null;
      try { peek = decodeJson(p); } catch { peek = null; }
      if (isObj(peek) && typeof peek.exp === "number" && !Number.isNaN(peek.exp)
          && peek.exp * 1000 + skewMs <= now()) {
        seen.delete(token);
        return no("expired");
      }
      const cached = seen.get(token);
      if (!cached || cached.until <= now()) {
        let answer;
        try { answer = await askAuth(token); }
        catch (e) { onRefusal({ at: "auth", error: String(e?.message ?? e) }); return no("unavailable"); }
        if (!answer.good) {
          seen.delete(token);
          onRefusal({ at: "auth", refused: answer.status, said: answer.said });
          return no("bad-signature");
        }
      }
    }

    // ── the claims, now that the signature is established ────────────────────
    let claims;
    try { claims = decodeJson(p); } catch { return no("malformed"); }
    if (!isObj(claims)) return no("malformed");

    // **`exp` IS REQUIRED, not merely honoured when present.** A signed token with
    // no expiry never stops working, and a leaked one is then permanent. Checked
    // here even on the `auth` path, where Supabase checks it too: a cached answer
    // must not outlive the token it was about.
    if (typeof claims.exp !== "number" || Number.isNaN(claims.exp)) return no("expired");
    const t = now();
    if (claims.exp * 1000 + skewMs <= t) return no("expired");
    if (typeof claims.nbf === "number" && claims.nbf * 1000 - skewMs > t) return no("not-yet-valid");

    if (issuer !== null && claims.iss !== issuer) return no("bad-signature");
    if (audience !== null) {
      const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!aud.includes(audience)) return no("bad-signature");
    }

    // The first claim that reads as a tenant wins, in the declared order. REFUSED
    // rather than coerced at every step: `String(["t1"])` is `"t1"`, so a coercing
    // reader would take an array claim as a tenant name — and a non-string
    // `tenant_id` must not silently fall through to `sub` either, because that
    // would turn a malformed explicit claim into a DIFFERENT tenant.
    let tenant = null;
    for (const c of TENANT_CLAIMS) {
      if (!Object.hasOwn(claims, c)) continue;
      if (!isText(claims[c])) return no("no-tenant");
      tenant = claims[c];
      break;
    }
    if (tenant === null) return no("no-tenant");

    // The cache is written only once the token has passed EVERYTHING, so a token
    // that verifies but carries no tenant is never remembered as usable. Bounded
    // by the token's own expiry, so a cached answer can never outlive it.
    if (strategy === "auth") remember(token, Math.min(t + authCacheMs, claims.exp * 1000));

    return Object.freeze({ ok: true, tenant, strategy, claims: Object.freeze(claims) });
  };
}

/**
 * The bearer token out of a request, or `null`.
 *
 * Case-insensitive on the scheme because RFC 7235 says it is, and a client that
 * sends `bearer` is not forging anything. Everything else about the header is
 * strict: one scheme, one space, a non-empty token, and nothing after it.
 */
export function bearerOf(request) {
  const raw = request?.headers?.get?.("authorization");
  if (!isText(raw)) return null;
  const m = /^Bearer ([^\s]+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}
