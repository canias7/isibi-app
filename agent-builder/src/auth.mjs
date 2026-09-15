/**
 * WHO IS ASKING — verified, not claimed.
 *
 * A bearer token in, a tenant out, or a refusal. This is the only thing in the
 * codebase allowed to decide a tenant's identity, and everything downstream takes
 * that answer as authority.
 *
 * DEPENDENCY-FREE: WebCrypto and `atob` only, both of which a Cloudflare Worker
 * has. The secret and the clock are injected, so every branch below — including
 * expiry — is drivable without waiting and without a deployment.
 *
 * **THE CLAIM NAME MUST MATCH THE DATABASE.** `agent.tenant_id()` in the
 * migration reads `tenant_id` out of the request JWT, and so does this. They are
 * the same fact in two languages, which is a drift this repository has no type
 * system to catch — so a test reads the migration and compares.
 */

/** The claim carrying the tenant. Must equal what the migration's policies read. */
export const TENANT_CLAIM = "tenant_id";

/** The one algorithm accepted. See `verify` for why this is not negotiable. */
export const ALG = "HS256";

/** Why a token was refused. For LOGS, never for a response body — see `api.mjs`. */
export const REFUSALS = Object.freeze([
  "no-token", "malformed", "bad-alg", "bad-signature", "expired", "not-yet-valid", "no-tenant",
]);

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

/**
 * `makeVerifier({ secret, now, issuer, audience })` → `verify(token)`
 *
 * `verify` answers `{ ok: true, tenant, claims }` or `{ ok: false, reason }`.
 */
export function makeVerifier(opts = {}) {
  if (!isText(opts.secret)) throw new TypeError("makeVerifier: secret must be a non-empty string");
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const skewMs = Number.isFinite(opts.skewMs) && opts.skewMs >= 0 ? opts.skewMs : 0;
  const issuer = isText(opts.issuer) ? opts.issuer : null;
  const audience = isText(opts.audience) ? opts.audience : null;

  let keyPromise = null;
  const key = () => (keyPromise ??= crypto.subtle.importKey(
    "raw", new TextEncoder().encode(opts.secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  ));

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
    if (header === null || typeof header !== "object" || Array.isArray(header)) return no("malformed");

    // **THE ALGORITHM IS OURS, NOT THE TOKEN'S.** Trusting the header's `alg` is
    // the oldest hole in JWT: `none` makes every token valid, and naming an
    // asymmetric algorithm makes a PUBLIC key usable as the HMAC secret. The
    // header is checked against one hard-coded value and nothing is looked up
    // from it.
    if (header.alg !== ALG) return no("bad-alg");

    // VERIFIED BEFORE THE PAYLOAD IS EVEN PARSED. Reading claims first is how
    // unsigned data gets trusted by accident — a log line, an early return, a
    // metric keyed on an unverified tenant.
    let okSig = false;
    try {
      okSig = await crypto.subtle.verify(
        "HMAC", await key(), b64urlToBytes(sig),
        new TextEncoder().encode(`${h}.${p}`),
      );
    } catch { return no("malformed"); }
    if (!okSig) return no("bad-signature");

    let claims;
    try { claims = decodeJson(p); } catch { return no("malformed"); }
    if (claims === null || typeof claims !== "object" || Array.isArray(claims)) return no("malformed");

    // **`exp` IS REQUIRED, not merely honoured when present.** A signed token with
    // no expiry never stops working, and a leaked one is then permanent.
    if (typeof claims.exp !== "number" || Number.isNaN(claims.exp)) return no("expired");
    const t = now();
    if (claims.exp * 1000 + skewMs <= t) return no("expired");
    if (typeof claims.nbf === "number" && claims.nbf * 1000 - skewMs > t) return no("not-yet-valid");

    if (issuer !== null && claims.iss !== issuer) return no("bad-signature");
    if (audience !== null) {
      const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!aud.includes(audience)) return no("bad-signature");
    }

    // The tenant is REFUSED rather than coerced: `String(["t1"])` is `"t1"`, so a
    // coercing reader would take an array claim as a tenant name.
    const tenant = claims[TENANT_CLAIM];
    if (!isText(tenant)) return no("no-tenant");

    return Object.freeze({ ok: true, tenant, claims: Object.freeze(claims) });
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
