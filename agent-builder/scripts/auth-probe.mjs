/**
 * DRIVE THE VERIFIER AGAINST THE REAL PROJECT.
 *
 * Not a test — an instrument. It asks the live project what it actually does, and
 * it exists because the last round of this work shipped 161 green tests over a
 * policy no real customer could satisfy: every fixture was more capable than
 * reality. A unit test proves the code; this proves the PROJECT.
 *
 *   SUPABASE_URL              the project's API URL
 *   SUPABASE_PUBLISHABLE_KEY  the publishable (or legacy anon) key — NOT a secret
 *   SUPABASE_USER_TOKEN       optional: a real signed-in customer's access token
 *
 * Nothing here writes anything, changes any setting, or needs a privileged
 * credential.
 */

import { makeVerifier, ASYMMETRIC } from "../src/auth.mjs";

const url = process.env.SUPABASE_URL;
const apikey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !apikey) {
  console.error("need SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}
const base = url.replace(/\/+$/, "");
let failed = 0;
const say = (ok, what, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${detail ? ` — ${detail}` : ""}`);
};

// ── 1. what does this project publish? ───────────────────────────────────────
console.log("\n1. the published key set");
const res = await fetch(`${base}/auth/v1/.well-known/jwks.json`, { headers: { accept: "application/json" } });
say(res.ok, `GET /auth/v1/.well-known/jwks.json`, `HTTP ${res.status}`);
const jwks = await res.json();
const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
say(keys.length > 0, `the project publishes ${keys.length} key(s)`);
for (const k of keys) {
  const known = Object.hasOwn(ASYMMETRIC, k.alg ?? "");
  say(known, `key ${k.kid} is ${k.alg}`, known ? "this verifier can use it" : "UNKNOWN to this verifier");
  if (!known) continue;
  // IMPORTING IT IS THE REAL CHECK. A key that parses as JSON and will not import
  // is a key this Worker would refuse every token against, at runtime, in prod.
  try {
    await crypto.subtle.importKey("jwk", { ...k, ext: true }, ASYMMETRIC[k.alg].import, false, ["verify"]);
    say(true, `key ${k.kid} imports into WebCrypto`);
  } catch (e) { say(false, `key ${k.kid} imports into WebCrypto`, String(e?.message ?? e)); }
}

// ── 2. the HS256 path, against Supabase Auth, with no secret at all ──────────
console.log("\n2. Supabase Auth as the oracle for HS256 (no signing secret held)");
const legacyLooksJwt = apikey.split(".").length === 3;
if (!legacyLooksJwt) {
  console.log("      (the configured key is a publishable key, not a legacy JWT —");
  console.log("       skipping the genuine-token leg, which needs a real JWT to send)");
} else {
  const r1 = await fetch(`${base}/auth/v1/user`, { headers: { apikey, authorization: `Bearer ${apikey}` } });
  const b1 = await r1.text();
  // A GENUINE token that names no user. The point is the REASON: Supabase got
  // past the signature, which is only possible if it verified it.
  say(/sub claim|missing sub/i.test(b1), "a genuinely-signed token is refused for its CLAIMS, not its signature", b1.slice(0, 90));

  const r2 = await fetch(`${base}/auth/v1/user`, { headers: { apikey, authorization: `Bearer ${apikey.slice(0, -1)}X` } });
  const b2 = await r2.text();
  say(/signature is invalid/i.test(b2), "the same token with one character changed is refused for its SIGNATURE", b2.slice(0, 90));
}

// ── 3. the verifier itself, end to end, against the live project ─────────────
console.log("\n3. the verifier, built the way the Worker builds it");
const refusals = [];
const verify = makeVerifier({
  url: base, apikey, fetch: globalThis.fetch.bind(globalThis),
  onRefusal: (r) => refusals.push(r),
});

say((await verify(null)).reason === "no-token", "no token");
say((await verify("not.a.token")).reason === "malformed", "junk");
say((await verify("abc.def")).reason === "malformed", "two segments (the alg:none shape)");

// A well-formed ES256 token naming a kid this project has never published. It
// must read as "no such key" and must NOT provoke an outage-shaped answer.
const fakeKid = (h, p) => `${btoa(JSON.stringify(h)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}.${btoa(JSON.stringify(p)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}.AAAA`;
const r = await verify(fakeKid({ alg: "ES256", kid: "nope-not-a-real-key", typ: "JWT" }, { sub: "x", exp: Math.floor(Date.now() / 1000) + 600 }));
say(r.reason === "no-key", "an ES256 token naming an unpublished kid", `reason: ${r.reason}`);

if (legacyLooksJwt) {
  const r3 = await verify(apikey);
  // Refused, and for a real reason: this token carries no `sub`.
  say(r3.ok === false, "the project's own anon token is refused (it names no user)", `reason: ${r3.reason}`);
}

const user = process.env.SUPABASE_USER_TOKEN;
if (user) {
  const r4 = await verify(user);
  say(r4.ok === true, "a real signed-in customer's token verifies", r4.ok ? `tenant ${r4.tenant} via ${r4.strategy}` : `reason: ${r4.reason}`);
  const tampered = user.slice(0, -1) + (user.endsWith("A") ? "B" : "A");
  const r5 = await verify(tampered);
  say(r5.ok === false, "the same token, one character changed, is refused", `reason: ${r5.reason}`);
} else {
  console.log("      (set SUPABASE_USER_TOKEN to add the signed-in-customer leg)");
}

console.log(`\n${failed === 0 ? "all checks passed" : `${failed} CHECK(S) FAILED`}`);
if (refusals.length) console.log("refusals logged:", JSON.stringify(refusals).slice(0, 400));
process.exit(failed === 0 ? 0 : 1);
