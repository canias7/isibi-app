import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeVerifier, bearerOf, TENANT_CLAIM, TENANT_CLAIMS, HS, REFUSALS, STRATEGIES,
  ASYMMETRIC, JWKS_TTL_MS, JWKS_MIN_REFETCH_MS, AUTH_CACHE_MAX,
} from "../src/auth.mjs";

// ── a real signer, so a "forged" token is genuinely wrongly signed ───────────
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function sign(payload, { secret = "s3cret", header = { alg: HS, typ: "JWT" } } = {}) {
  const body = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

const NOW = 1_800_000_000_000;                       // a fixed clock
const at = (ms) => () => ms;
const good = (over = {}) => ({ [TENANT_CLAIM]: "t1", exp: Math.floor(NOW / 1000) + 3600, ...over });
const verifier = (over = {}) => makeVerifier({ secret: "s3cret", now: at(NOW), ...over });

test("a well-formed, correctly signed, unexpired token yields its tenant", async () => {
  const v = verifier();
  const r = await v(await sign(good()));
  assert.equal(r.ok, true, `refused: ${r.reason}`);
  assert.equal(r.tenant, "t1");
  assert.equal(r.claims[TENANT_CLAIM], "t1");
  assert.ok(Object.isFrozen(r), "the verdict can be mutated after the fact");
});

test("A VERIFIER THAT COULD CHECK NOTHING REFUSES TO EXIST", () => {
  // Not a runtime 401. With no way to reach the project and no opt-in secret,
  // every request would be refused for a reason that has nothing to do with the
  // request — which reads, from outside, exactly like every customer's token
  // being forged at once.
  for (const bad of [undefined, null, "", "   ", 4, ["s"]]) {
    assert.throws(() => makeVerifier({ secret: bad }), { name: "TypeError" });
  }
  // Either half of the project route alone is not enough.
  assert.throws(() => makeVerifier({ url: "https://p.supabase.co" }), { name: "TypeError" });
  assert.throws(() => makeVerifier({ fetch: async () => ({ ok: true }) }), { name: "TypeError" });
  // ...and either complete route IS enough, with no secret anywhere.
  assert.doesNotThrow(() => makeVerifier({ url: "https://p.supabase.co", fetch: async () => ({ ok: true }) }));
  assert.doesNotThrow(() => makeVerifier({ secret: "s3cret" }));
});

// ── the forgeries ────────────────────────────────────────────────────────────
test("A MISSING TOKEN IS REFUSED", async () => {
  const v = verifier();
  for (const bad of [undefined, null, "", "   ", 4, ["t"]]) {
    assert.equal((await v(bad)).ok, false, `${String(bad)} was accepted`);
    assert.equal((await v(bad)).reason, "no-token");
  }
});

test("A TOKEN SIGNED WITH THE WRONG SECRET IS REFUSED", async () => {
  const v = verifier();
  const forged = await sign(good(), { secret: "not-the-secret" });
  const r = await v(forged);
  assert.equal(r.ok, false, "a forged signature was accepted");
  assert.equal(r.reason, "bad-signature");
  // THE CONTROL: the same claims signed correctly DO pass, so the refusal is
  // about the signature and not about the token's contents.
  assert.equal((await v(await sign(good()))).ok, true);
});

test("A TAMPERED PAYLOAD IS REFUSED — the tenant cannot be edited in flight", async () => {
  const v = verifier();
  const real = await sign(good());
  const [h, , s] = real.split(".");
  const swapped = `${h}.${enc(good({ [TENANT_CLAIM]: "t2" }))}.${s}`;
  const r = await v(swapped);
  assert.equal(r.ok, false, "a rewritten tenant claim was accepted");
  assert.equal(r.reason, "bad-signature");
});

test("`alg: none` IS REFUSED — the oldest hole in JWT", async () => {
  const v = verifier();
  const payload = enc(good());
  const header = enc({ alg: "none", typ: "JWT" });
  // Both shapes it is written in, and each is refused for its OWN reason — which
  // is the point of naming reasons at all:
  //   `h.p.`  is three segments, so the ALGORITHM check fires first;
  //   `h.p`   is two, so it never reaches the algorithm at all.
  assert.equal((await v(`${header}.${payload}.`)).reason, "bad-alg");
  assert.equal((await v(`${header}.${payload}`)).reason, "malformed");
  const withSig = await sign(good(), { header: { alg: "none", typ: "JWT" } });
  assert.equal((await v(withSig)).reason, "bad-alg", "a token declaring alg:none got past the header check");
  // What matters either way: none of the three is ok.
  for (const t of [`${header}.${payload}.`, `${header}.${payload}`, withSig]) {
    assert.equal((await v(t)).ok, false, "an alg:none token was accepted");
  }
});

test("AN ASYMMETRIC `alg` IS REFUSED — algorithm confusion", async () => {
  // Naming RS256 while we hold an HMAC secret is the attack where a PUBLIC key
  // becomes a usable signing secret. The algorithm is ours, not the token's.
  const v = verifier();
  for (const alg of ["RS256", "ES256", "HS384", "HS512", "hs256", "", null, 0, ["HS256"]]) {
    const t = await sign(good(), { header: { alg, typ: "JWT" } });
    const r = await v(t);
    assert.equal(r.ok, false, `alg ${JSON.stringify(alg)} was accepted`);
    assert.equal(r.reason, "bad-alg", `alg ${JSON.stringify(alg)} refused for the wrong reason: ${r.reason}`);
  }
  assert.equal(HS, "HS256");
});

test("a malformed token is refused rather than repaired", async () => {
  const v = verifier();
  for (const bad of ["a.b", "a.b.c.d", "....", "a.b.c", "!!!.???.***",
                     `${enc({ alg: HS })}.${enc(good())}.not-base64url!`]) {
    const r = await v(bad);
    assert.equal(r.ok, false, `"${bad}" was accepted`);
    assert.ok(["malformed", "bad-alg", "bad-signature"].includes(r.reason), `${bad} → ${r.reason}`);
  }
  // A header that decodes to something that is not an object.
  assert.equal((await v(`${enc([1, 2])}.${enc(good())}.AAAA`)).reason, "malformed");
});

test("A SEGMENT IN STANDARD BASE64 IS REFUSED, not quietly repaired", async () => {
  // base64url uses `-` and `_`; standard base64 uses `+`, `/` and `=`. A decoder
  // that accepts both takes tokens a real one rejects, and "lenient about the
  // encoding" is how a parser ends up disagreeing with the thing that signed it.
  // A sweep found this: removing the charset check changed nothing any other case
  // could see.
  const v = verifier();
  const payload = enc(good());
  // THE LENGTHS ARE A MULTIPLE OF FOUR ON PURPOSE. A shorter segment gets padding
  // added, and the padding is what makes `atob` throw — so a 5-character `ab+cd`
  // is refused whether or not the charset is checked, and asserting on one proves
  // nothing about the check. Measured: every segment below DECODES cleanly as
  // standard base64, so the charset check is the only thing refusing it.
  const standardB64 = ["ab+c", "ab/c", "abc=", "abcd+fgh", "a+b/"];
  for (const seg of standardB64) {
    assert.equal((await v(`${seg}.${payload}.AAAA`)).reason, "malformed", `header "${seg}" was accepted`);
    assert.equal((await v(`${enc({ alg: HS })}.${payload}.${seg}`)).reason, "malformed",
      `signature "${seg}" was not refused as malformed`);
  }
  // THE CONTROL: the same shapes in real base64url are not refused for their
  // charset — they get as far as the signature, which is where they fail.
  assert.equal((await v(`${enc({ alg: HS })}.${payload}.ab-c`)).reason, "bad-signature");
});

// ── time ─────────────────────────────────────────────────────────────────────
test("AN EXPIRED TOKEN IS REFUSED, and `exp` IS REQUIRED", async () => {
  const v = verifier();
  const expired = await sign(good({ exp: Math.floor(NOW / 1000) - 1 }));
  assert.equal((await v(expired)).reason, "expired");
  // Exactly at expiry is expired: a token valid at its own deadline is valid for
  // one more instant than it says.
  assert.equal((await v(await sign(good({ exp: Math.floor(NOW / 1000) })))).reason, "expired");
  // A SIGNED TOKEN WITH NO EXPIRY NEVER STOPS WORKING, so it is refused.
  const forever = await sign({ [TENANT_CLAIM]: "t1" });
  assert.equal((await v(forever)).reason, "expired", "a token with no expiry was accepted");
  for (const bad of ["9999999999", null, NaN, {}]) {
    assert.equal((await v(await sign(good({ exp: bad })))).reason, "expired", `exp ${String(bad)} accepted`);
  }
});

test("a not-yet-valid token is refused, and skew is honoured when asked for", async () => {
  const v = verifier();
  const future = await sign(good({ nbf: Math.floor(NOW / 1000) + 60 }));
  assert.equal((await v(future)).reason, "not-yet-valid");
  // With skew, a token that just expired is still taken — and only then.
  const justExpired = await sign(good({ exp: Math.floor(NOW / 1000) - 5 }));
  assert.equal((await verifier({ skewMs: 10_000 })(justExpired)).ok, true);
  assert.equal((await verifier({ skewMs: 1_000 })(justExpired)).ok, false);
});

// ── the tenant claim ─────────────────────────────────────────────────────────
test("A TOKEN WITH NEITHER A TENANT NOR A SUBJECT IS NOT AN IDENTITY", async () => {
  const v = verifier();
  assert.equal((await v(await sign({ exp: Math.floor(NOW / 1000) + 60 }))).reason, "no-tenant");
  assert.equal((await v(await sign({ exp: Math.floor(NOW / 1000) + 60, email: "a@b.c" }))).reason, "no-tenant");
  // REFUSED, NOT COERCED: `String(["t1"])` is `"t1"`.
  for (const bad of [["t1"], 4, true, {}, "", "   ", null]) {
    const r = await v(await sign({ exp: Math.floor(NOW / 1000) + 60, [TENANT_CLAIM]: bad }));
    assert.equal(r.ok, false, `tenant ${JSON.stringify(bad)} was accepted`);
    assert.equal(r.reason, "no-tenant");
  }
});

test("A REAL SUPABASE TOKEN WORKS: `sub` IS THE TENANT WHEN THERE IS NO `tenant_id`", async () => {
  // THIS IS THE CASE THE TESTS USED TO MISS ENTIRELY. Supabase does not put a
  // `tenant_id` claim in a JWT, so keying only on it refused every genuinely
  // signed-in customer — and every token minted in this file carries one, which
  // made the fixture more capable than reality. Found by driving the real handler
  // against the real project.
  const v = verifier();
  const supabaseShaped = await sign({
    iss: "https://p.supabase.co/auth/v1", sub: "a50b8c69-4385-459c-a92e-16a6975ce0a2",
    aud: "authenticated", role: "authenticated", email: "someone@example.com",
    exp: Math.floor(NOW / 1000) + 3600,
  });
  const r = await v(supabaseShaped);
  assert.equal(r.ok, true, `a real-shaped Supabase token was refused: ${r.reason}`);
  assert.equal(r.tenant, "a50b8c69-4385-459c-a92e-16a6975ce0a2", "the subject did not become the tenant");
});

test("AN EXPLICIT TENANT WINS, and a MALFORMED one does not fall through to the subject", async () => {
  // Falling through would turn a broken explicit claim into a DIFFERENT tenant,
  // which is the worst possible reading of a malformed value.
  const v = verifier();
  const both = await v(await sign({ [TENANT_CLAIM]: "team-9", sub: "user-1", exp: Math.floor(NOW / 1000) + 60 }));
  assert.equal(both.tenant, "team-9", "the explicit tenant lost to the subject");
  for (const bad of [["team-9"], 4, "", "   ", null, {}]) {
    const r = await v(await sign({ [TENANT_CLAIM]: bad, sub: "user-1", exp: Math.floor(NOW / 1000) + 60 }));
    assert.equal(r.ok, false, `a malformed tenant_id fell through to sub and became "${r.tenant}"`);
    assert.equal(r.reason, "no-tenant");
  }
  assert.deepEqual([...TENANT_CLAIMS], ["tenant_id", "sub"]);
});

test("issuer and audience are checked when asked for", async () => {
  const withIss = verifier({ issuer: "https://p.supabase.co/auth/v1" });
  assert.equal((await withIss(await sign(good()))).ok, false, "a token with no issuer passed an issuer check");
  assert.equal((await withIss(await sign(good({ iss: "https://p.supabase.co/auth/v1" })))).ok, true);
  const withAud = verifier({ audience: "authenticated" });
  assert.equal((await withAud(await sign(good({ aud: "wrong" })))).ok, false);
  assert.equal((await withAud(await sign(good({ aud: "authenticated" })))).ok, true);
  assert.equal((await withAud(await sign(good({ aud: ["x", "authenticated"] })))).ok, true);
});

test("every refusal this module can answer is a NAMED one", async () => {
  // A reason that is not on the list is one nothing downstream can log or count.
  const v = verifier();
  const seen = new Set();
  const cases = [undefined, "a.b", await sign(good(), { secret: "x" }),
    await sign(good({ exp: 1 })), await sign(good({ nbf: Math.floor(NOW / 1000) + 9 })),
    await sign({ exp: Math.floor(NOW / 1000) + 60 }), await sign(good(), { header: { alg: "RS256" } })];
  for (const c of cases) { const r = await v(c); if (!r.ok) seen.add(r.reason); }
  for (const s of seen) assert.ok(REFUSALS.includes(s), `"${s}" is not a declared refusal`);
  assert.ok(seen.size >= 6, `only ${seen.size} distinct refusals were reached`);
});

// ── bearerOf ─────────────────────────────────────────────────────────────────
test("bearerOf reads one bearer token and nothing else", () => {
  const req = (h) => new Request("https://x/", { headers: h ? { authorization: h } : {} });
  assert.equal(bearerOf(req("Bearer abc")), "abc");
  // RFC 7235 says the scheme is case-insensitive, and a client sending `bearer`
  // is not forging anything.
  assert.equal(bearerOf(req("bearer abc")), "abc");
  assert.equal(bearerOf(req("  Bearer abc  ")), "abc");
  for (const h of [undefined, "", "abc", "Basic abc", "Bearer", "Bearer ", "Bearer a b", "BearerX abc"]) {
    assert.equal(bearerOf(req(h)), null, `"${h}" produced a token`);
  }
  assert.equal(bearerOf(undefined), null);
  assert.equal(bearerOf({}), null);
});

// ── the drift guard across the language boundary ─────────────────────────────
test("THE CLAIM NAME MATCHES WHAT THE MIGRATION READS", () => {
  // The same fact in two languages with no type system between them. The database
  // policies key on this claim; if the names ever diverge, every request would
  // authenticate here and see nothing there — and it would look like an empty
  // database rather than a mismatch.
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
  assert.ok(files.length >= 1, "no migrations found — the observer is dead");
  const sql = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  // EVERY claim this module reads, and IN ORDER. The first version of this guard
  // checked only that the migration mentioned `tenant_id`, and it stayed green
  // while the two sides disagreed about the FALLBACK — the database had learned to
  // accept `sub` and the verifier had not, so every real customer was refused. A
  // guard that checks one of two names checks neither decision.
  for (const c of TENANT_CLAIMS) {
    assert.match(sql, new RegExp(`->>\\s*'${c}'`), `the migration never reads '${c}' out of the JWT claims`);
  }
  const at = TENANT_CLAIMS.map((c) => sql.search(new RegExp(`->>\\s*'${c}'`)));
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i - 1] < at[i],
      `the migration prefers '${TENANT_CLAIMS[i]}' over '${TENANT_CLAIMS[i - 1]}', and this module does the opposite`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC-KEY VERIFICATION — the preferred path, and the reason the signing
// secret is no longer a required setting.
// ═══════════════════════════════════════════════════════════════════════════

/** A real ES256 keypair. Nothing is faked but the transport. */
async function es256() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, jwk };
}

async function signAsym(payload, { priv, kid, alg = "ES256", hash = "SHA-256" } = {}) {
  const body = `${enc({ alg, kid, typ: "JWT" })}.${enc(payload)}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash }, priv, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

/**
 * A transport that serves a key set and COUNTS what it was asked for. The count
 * is the observable half of every caching claim below — without it, "the key set
 * is cached" is a sentence nothing can falsify.
 */
function jwksServer(keys, { fail = false } = {}) {
  const calls = [];
  const fetchImpl = async (u) => {
    calls.push(String(u));
    if (fail) return { ok: false, status: 503, text: async () => "" };
    return { ok: true, status: 200, text: async () => JSON.stringify({ keys: keys() }) };
  };
  return { fetchImpl, calls };
}

test("AN ES256 TOKEN VERIFIES AGAINST THE PROJECT'S PUBLISHED KEY, with no secret held", async () => {
  const { pair, jwk } = await es256();
  const kid = "key-1";
  const srv = jwksServer(() => [{ ...jwk, kid, alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const r = await v(await signAsym(good(), { priv: pair.privateKey, kid }));
  assert.equal(r.ok, true, `refused: ${r.reason}`);
  assert.equal(r.tenant, "t1");
  assert.equal(r.strategy, "jwks", "verified by the wrong strategy");
  assert.ok(STRATEGIES.includes(r.strategy));
  // It went to the right place, and it is the PUBLIC endpoint — no credential.
  assert.match(srv.calls[0], /\/auth\/v1\/\.well-known\/jwks\.json$/);
});

test("A TOKEN SIGNED BY A DIFFERENT KEY IS REFUSED, even with the right kid", async () => {
  const mine = await es256();
  const theirs = await es256();
  const kid = "key-1";
  const srv = jwksServer(() => [{ ...mine.jwk, kid, alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const forged = await signAsym(good(), { priv: theirs.pair.privateKey, kid });
  assert.equal((await v(forged)).reason, "bad-signature");
  // THE CONTROL: the same claims signed by the published key do pass, so the
  // refusal is about the signature and not about the token.
  assert.equal((await v(await signAsym(good(), { priv: mine.pair.privateKey, kid }))).ok, true);
});

test("AN HS256 TOKEN CAN NEVER REACH A PUBLISHED KEY — algorithm confusion", async () => {
  // The attack: take the PUBLIC key, use its bytes as an HMAC secret, sign a
  // token with it, and declare HS256. A verifier that looks up "the key" and then
  // applies "the algorithm the token asked for" accepts it. Here the two families
  // are routed apart before any key is fetched, so there is nothing to confuse.
  const { pair, jwk } = await es256();
  const kid = "key-1";
  const srv = jwksServer(() => [{ ...jwk, kid, alg: "ES256", use: "sig" }]);
  // No secret and no apikey: an HS256 token has nowhere legitimate to go.
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const hsToken = await sign(good(), { secret: JSON.stringify(jwk), header: { alg: "HS256", kid, typ: "JWT" } });
  const r = await v(hsToken);
  assert.equal(r.ok, false, "an HS256 token was verified against a published public key");
  assert.equal(r.reason, "unavailable", `refused for the wrong reason: ${r.reason}`);
  // And the JWKS was never even asked for on that token's behalf.
  assert.equal(srv.calls.length, 0, "an HS256 token provoked a key fetch");
  // THE CONTROL: the same key set does verify a properly signed ES256 token.
  assert.equal((await v(await signAsym(good(), { priv: pair.privateKey, kid }))).ok, true);
});

test("THE KEY'S OWN ALGORITHM DECIDES, not the token's", async () => {
  const { pair, jwk } = await es256();
  const kid = "key-1";
  // The project publishes this key as ES256. A token naming RS256 with the same
  // kid must not be checked against it.
  const srv = jwksServer(() => [{ ...jwk, kid, alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const body = `${enc({ alg: "RS256", kid, typ: "JWT" })}.${enc(good())}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(body)));
  const r = await v(`${body}.${b64url(sig)}`);
  assert.equal(r.ok, false, "a token's own alg selected the key's use");
  assert.equal(r.reason, "bad-alg");
});

test("AN UNKNOWN KID IS `no-key`, AND AN OUTAGE IS `unavailable` — never the same answer", async () => {
  // COLLAPSING THESE IS THE BUG THIS NAMES. One is a bad token; the other is our
  // own outage. Reported as one thing, a five-minute auth blip reads as every
  // customer's credentials having been forged, and nobody goes and looks at the
  // right layer.
  const { pair, jwk } = await es256();
  const srv = jwksServer(() => [{ ...jwk, kid: "key-1", alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const wrongKid = await signAsym(good(), { priv: pair.privateKey, kid: "key-99" });
  assert.equal((await v(wrongKid)).reason, "no-key");
  // A token with no kid at all cannot select a key either.
  const noKid = await signAsym(good(), { priv: pair.privateKey, kid: undefined });
  assert.equal((await v(noKid)).reason, "no-key");

  const down = jwksServer(() => [], { fail: true });
  const logged = [];
  const v2 = makeVerifier({ url: "https://p.supabase.co", fetch: down.fetchImpl, now: at(NOW), onRefusal: (r) => logged.push(r) });
  const r = await v2(await signAsym(good(), { priv: pair.privateKey, kid: "key-1" }));
  assert.equal(r.reason, "unavailable", "an unreachable key set read as a bad token");
  assert.ok(logged.some((l) => l.at === "jwks"), "the outage was not reported anywhere");
});

test("A ROTATED KEY IS PICKED UP WITHOUT A DEPLOYMENT, and a forged kid cannot make us hammer the endpoint", async () => {
  const one = await es256();
  const two = await es256();
  let published = [{ ...one.jwk, kid: "k1", alg: "ES256", use: "sig" }];
  const srv = jwksServer(() => published);
  let clock = NOW;
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: () => clock });

  assert.equal((await v(await signAsym(good(), { priv: one.pair.privateKey, kid: "k1" }))).ok, true);
  assert.equal(srv.calls.length, 1);
  // Cached: a second token on the same key costs no fetch.
  assert.equal((await v(await signAsym(good(), { priv: one.pair.privateKey, kid: "k1" }))).ok, true);
  assert.equal(srv.calls.length, 1, "a cached key set was re-fetched");

  // The project rotates. A token on the NEW key names a kid we have not seen, and
  // that is allowed to provoke one fetch — otherwise a rotation needs a deploy.
  published = [{ ...two.jwk, kid: "k2", alg: "ES256", use: "sig" }];
  clock = NOW + JWKS_MIN_REFETCH_MS;
  assert.equal((await v(await signAsym(good(), { priv: two.pair.privateKey, kid: "k2" }))).ok, true, "a rotated key was not picked up");
  assert.equal(srv.calls.length, 2);

  // ...BUT NOT EVERY TIME. Invented kids are free to send and would otherwise
  // cost one request each at the auth endpoint.
  const before = srv.calls.length;
  for (let i = 0; i < 20; i++) {
    assert.equal((await v(await signAsym(good(), { priv: two.pair.privateKey, kid: `junk-${i}` }))).reason, "no-key");
  }
  assert.equal(srv.calls.length, before, `${srv.calls.length - before} fetches were provoked by invented kids`);
  // And once the floor has passed, one more is allowed.
  clock += JWKS_MIN_REFETCH_MS;
  assert.equal((await v(await signAsym(good(), { priv: two.pair.privateKey, kid: "junk-x" }))).reason, "no-key");
  assert.equal(srv.calls.length, before + 1, "the refetch floor never lifts");
  assert.ok(JWKS_TTL_MS > JWKS_MIN_REFETCH_MS, "the key set expires sooner than the floor between fetches");
});

test("A KEY THE VERIFIER CANNOT USE IS SKIPPED, not guessed at", async () => {
  // NOTE ON THE `use: "enc"` CASE, because a sweep asked: WebCrypto refuses to
  // import a JWK whose `use` is `enc` for a `verify` key at all (MEASURED: `Invalid
  // JWK "use" Parameter`). So our own filter is a second wall there and cannot be
  // killed on its own. It stays because it says what is meant, and because a key
  // whose `use` we do not recognise should be skipped whatever WebCrypto thinks.
  const { pair, jwk } = await es256();
  const srv = jwksServer(() => [
    { ...jwk, kid: "enc", alg: "ES256", use: "enc" },      // an encryption key
    { kid: "weird", alg: "PS256", kty: "RSA", n: "x", e: "AQAB" },  // an alg we do not implement
    { kid: "nameless", alg: "ES256" },                      // no key material
    { ...jwk, kid: "good", alg: "ES256", use: "sig" },
  ]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  for (const kid of ["enc", "weird", "nameless"]) {
    assert.equal((await v(await signAsym(good(), { priv: pair.privateKey, kid }))).reason, "no-key", `${kid} was used`);
  }
  // THE CONTROL — the usable key in the same set still works, so the skipping is
  // selective rather than the whole set having failed to load.
  assert.equal((await v(await signAsym(good(), { priv: pair.privateKey, kid: "good" }))).ok, true);
});

test("EVERY ALGORITHM IN THE TABLE NAMES REAL WEBCRYPTO PARAMETERS", async () => {
  // A table of algorithm names is only as good as the parameters behind it, and a
  // wrong `namedCurve` or `hash` is invisible until a project rotates onto it.
  assert.ok(Object.keys(ASYMMETRIC).length >= 6);
  for (const [alg, spec] of Object.entries(ASYMMETRIC)) {
    assert.ok(spec.import && spec.verify, `${alg} has no parameters`);
    if (alg.startsWith("ES")) {
      const pair = await crypto.subtle.generateKey(spec.import, true, ["sign", "verify"]);
      const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
      const imported = await crypto.subtle.importKey("jwk", { ...jwk, ext: true }, spec.import, false, ["verify"]);
      const msg = new TextEncoder().encode("x");
      const sig = await crypto.subtle.sign(spec.verify, pair.privateKey, msg);
      assert.equal(await crypto.subtle.verify(spec.verify, imported, sig, msg), true, `${alg} cannot verify its own signature`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE AUTH AS THE ORACLE — for HS256, without holding the secret.
// ═══════════════════════════════════════════════════════════════════════════

/** A transport standing in for `/auth/v1/user`, counting what it was asked. */
function authServer(decide) {
  const calls = [];
  const fetchImpl = async (u, init) => {
    const token = String(init?.headers?.authorization ?? "").replace(/^Bearer /, "");
    calls.push({ url: String(u), token, apikey: init?.headers?.apikey });
    const d = decide(token);
    if (d === true) return { ok: true, status: 200, text: async () => JSON.stringify({ id: "u1" }) };
    if (d === false) return { ok: false, status: 403, text: async () => JSON.stringify({ msg: "bad_jwt" }) };
    return { ok: false, status: d, text: async () => "" };   // an outage
  };
  return { fetchImpl, calls };
}

test("AN HS256 TOKEN IS CHECKED BY SUPABASE WHEN WE HOLD NO SECRET", async () => {
  const real = await sign(good());
  const srv = authServer((t) => t === real);
  const v = makeVerifier({ url: "https://p.supabase.co", apikey: "pub", fetch: srv.fetchImpl, now: at(NOW) });
  const r = await v(real);
  assert.equal(r.ok, true, `refused: ${r.reason}`);
  assert.equal(r.tenant, "t1");
  assert.equal(r.strategy, "auth");
  assert.match(srv.calls[0].url, /\/auth\/v1\/user$/);
  assert.equal(srv.calls[0].apikey, "pub", "the publishable key was not sent");

  // A token Supabase refuses is refused here.
  const forged = await sign(good(), { secret: "not-the-secret" });
  assert.equal((await v(forged)).reason, "bad-signature");
});

test("AN AUTH OUTAGE IS `unavailable`, NEVER `bad-signature`", async () => {
  // The same law as the JWKS outage. A 500 means we do not know; reading it as
  // "forged" tells every customer at once that their credentials are bad.
  const real = await sign(good());
  const logged = [];
  const srv = authServer(() => 500);
  const v = makeVerifier({ url: "https://p.supabase.co", apikey: "pub", fetch: srv.fetchImpl, now: at(NOW), onRefusal: (r) => logged.push(r) });
  assert.equal((await v(real)).reason, "unavailable");
  assert.ok(logged.some((l) => l.at === "auth" && l.error), "the outage was not reported");
});

test("A REFUSAL CARRIES SUPABASE'S OWN WORDS TO THE LOG, and the same verdict either way", async () => {
  // "Refused" covers a forged signature AND a genuinely signed token naming no
  // user. Those are different bugs to go and look for — MEASURED on the live
  // project, which answers `missing sub claim` for one and `signature is invalid`
  // for the other.
  const t = await sign(good());
  const logged = [];
  const srv = authServer(() => false);
  const v = makeVerifier({ url: "https://p.supabase.co", apikey: "pub", fetch: srv.fetchImpl, now: at(NOW), onRefusal: (r) => logged.push(r) });
  assert.equal((await v(t)).reason, "bad-signature");
  const said = logged.find((l) => l.at === "auth" && l.refused);
  assert.ok(said, "nothing was logged about the refusal");
  assert.equal(said.refused, 403);
  assert.match(said.said, /bad_jwt/, "Supabase's own words were dropped");
});

test("AN AUTH ANSWER IS CACHED, BOUNDED BY THE TOKEN'S OWN EXPIRY", async () => {
  const short = await sign(good({ exp: Math.floor(NOW / 1000) + 30 }));
  const srv = authServer(() => true);
  let clock = NOW;
  const v = makeVerifier({ url: "https://p.supabase.co", apikey: "pub", fetch: srv.fetchImpl, now: () => clock, authCacheMs: 60_000 });
  assert.equal((await v(short)).ok, true);
  assert.equal(srv.calls.length, 1);
  clock = NOW + 10_000;
  assert.equal((await v(short)).ok, true);
  assert.equal(srv.calls.length, 1, "a cached answer was re-asked");
  // THE TOKEN EXPIRES BEFORE THE CACHE WOULD, and the token wins: at +31s it is
  // refused outright rather than served from a cache that outlived it.
  clock = NOW + 31_000;
  assert.equal((await v(short)).reason, "expired", "a cached answer outlived its token");
  assert.equal(srv.calls.length, 1, "an expired token still cost a round trip");
});

test("A REFUSED TOKEN IS NEVER CACHED, and the cache has a ceiling", async () => {
  let allow = false;
  const t = await sign(good());
  const srv = authServer(() => allow);
  const v = makeVerifier({ url: "https://p.supabase.co", apikey: "pub", fetch: srv.fetchImpl, now: at(NOW) });
  assert.equal((await v(t)).reason, "bad-signature");
  allow = true;
  // Asked again, because a NO is never remembered — otherwise a token refused
  // during a blip would stay refused for the cache's lifetime.
  assert.equal((await v(t)).ok, true);
  assert.equal(srv.calls.length, 2);

  // A cache with no ceiling is a leak. Fill it past the bound and the earliest
  // entry must have been evicted — observable as a second round trip for it.
  const many = [];
  for (let i = 0; i < AUTH_CACHE_MAX + 5; i++) many.push(await sign(good({ sub: `u${i}`, [TENANT_CLAIM]: `t${i}` })));
  for (const m of many) assert.equal((await v(m)).ok, true);
  const before = srv.calls.length;
  assert.equal((await v(many[0])).ok, true);
  assert.equal(srv.calls.length, before + 1, "the cache grew past its ceiling");
});

test("AN OPT-IN SECRET SKIPS THE ROUND TRIP ENTIRELY", async () => {
  // The secret is not required, but an operator who has already accepted its
  // blast radius should not pay a network call per request.
  const srv = authServer(() => true);
  const v = makeVerifier({ url: "https://p.supabase.co", apikey: "pub", fetch: srv.fetchImpl, secret: "s3cret", now: at(NOW) });
  const r = await v(await sign(good()));
  assert.equal(r.ok, true);
  assert.equal(r.strategy, "secret");
  assert.equal(srv.calls.length, 0, "the opt-in secret still went to the network");
});

test("THE STRATEGY IS REPORTED, and it is one of the declared three", async () => {
  const { pair, jwk } = await es256();
  const srv = jwksServer(() => [{ ...jwk, kid: "k", alg: "ES256", use: "sig" }]);
  const auth = authServer(() => true);
  const cases = [
    [makeVerifier({ secret: "s3cret", now: at(NOW) }), await sign(good()), "secret"],
    [makeVerifier({ url: "https://p", apikey: "pub", fetch: auth.fetchImpl, now: at(NOW) }), await sign(good()), "auth"],
    [makeVerifier({ url: "https://p", fetch: srv.fetchImpl, now: at(NOW) }), await signAsym(good(), { priv: pair.privateKey, kid: "k" }), "jwks"],
  ];
  const seen = new Set();
  for (const [v, token, want] of cases) {
    const r = await v(token);
    assert.equal(r.ok, true, `${want} refused: ${r.reason}`);
    assert.equal(r.strategy, want);
    seen.add(r.strategy);
  }
  assert.deepEqual([...seen].sort(), [...STRATEGIES].sort(), "a declared strategy was never reached");
});

test("A SIGNATURE WEBCRYPTO CANNOT EVEN READ IS REFUSED, never read as a pass", async () => {
  // `crypto.subtle.verify` THROWS for an ECDSA signature of the wrong length rather
  // than answering false, so the catch around it is the only thing between "this is
  // not a signature" and "this token is fine". A sweep found it uncovered.
  const { pair, jwk } = await es256();
  const kid = "key-1";
  const srv = jwksServer(() => [{ ...jwk, kid, alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const real = await signAsym(good(), { priv: pair.privateKey, kid });
  const [h, p] = real.split(".");
  for (const sig of ["AA", "AAAA", b64url(new Uint8Array(3)), b64url(new Uint8Array(200))]) {
    const r = await v(`${h}.${p}.${sig}`);
    assert.equal(r.ok, false, `a ${sig.length}-char signature was accepted`);
    assert.ok(["malformed", "bad-signature"].includes(r.reason), `reason was ${r.reason}`);
  }
  // THE CONTROL: the real signature still passes, so the refusals above are about
  // the signature and not about the key set having failed to load.
  assert.equal((await v(real)).ok, true);
});

test("A TOKEN WITH NO KID COSTS NO KEY FETCH, on a cold verifier", async () => {
  // **THE STATE MATTERS, and getting it wrong is why this went uncovered.** Asked
  // AFTER any other token, the refetch floor already stops a second fetch, so the
  // guard's absence is invisible. On a COLD verifier there is nothing to stop it:
  // without the guard, a kid-less token — which anybody can send, for free — buys a
  // request at the auth endpoint every time the floor has lapsed.
  const { pair, jwk } = await es256();
  const srv = jwksServer(() => [{ ...jwk, kid: "k1", alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const noKid = await signAsym(good(), { priv: pair.privateKey, kid: undefined });
  assert.equal((await v(noKid)).reason, "no-key");
  assert.equal(srv.calls.length, 0, `a kid-less token provoked ${srv.calls.length} key fetch(es)`);
  // THE CONTROL: the same cold verifier DOES fetch for a token that names a kid, so
  // the zero above is the guard and not a broken transport.
  assert.equal((await v(await signAsym(good(), { priv: pair.privateKey, kid: "k1" }))).ok, true);
  assert.equal(srv.calls.length, 1);
});

test("A SIGNATURE SEGMENT THAT IS NOT BASE64URL IS REFUSED ON THE JWKS PATH TOO", async () => {
  // **THIS IS WHAT MAKES THE `catch` AROUND `crypto.subtle.verify` LOAD-BEARING.**
  // A wrong-LENGTH signature makes WebCrypto answer false, not throw — so the earlier
  // test proved the comparison and nothing about the catch. What throws is the
  // DECODE, inside the same try: a segment in standard base64 never becomes bytes at
  // all. Read as a pass, that token would be accepted outright.
  const { pair, jwk } = await es256();
  const kid = "key-1";
  const srv = jwksServer(() => [{ ...jwk, kid, alg: "ES256", use: "sig" }]);
  const v = makeVerifier({ url: "https://p.supabase.co", fetch: srv.fetchImpl, now: at(NOW) });
  const real = await signAsym(good(), { priv: pair.privateKey, kid });
  const [h, p] = real.split(".");
  for (const sig of ["ab+c", "ab/c", "abc=", "a+b/", "!!!!"]) {
    const r = await v(`${h}.${p}.${sig}`);
    assert.equal(r.ok, false, `signature "${sig}" was ACCEPTED`);
    assert.equal(r.reason, "malformed", `signature "${sig}" was refused as ${r.reason}`);
  }
  // THE CONTROL: the real signature still passes, so the key set loaded fine.
  assert.equal((await v(real)).ok, true);
});
