import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeVerifier, bearerOf, TENANT_CLAIM, TENANT_CLAIMS, ALG, REFUSALS } from "../src/auth.mjs";

// ── a real signer, so a "forged" token is genuinely wrongly signed ───────────
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function sign(payload, { secret = "s3cret", header = { alg: ALG, typ: "JWT" } } = {}) {
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

test("makeVerifier refuses to exist without a secret", () => {
  for (const bad of [undefined, null, "", "   ", 4, ["s"]]) {
    assert.throws(() => makeVerifier({ secret: bad }), { name: "TypeError" });
  }
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
  assert.equal(ALG, "HS256");
});

test("a malformed token is refused rather than repaired", async () => {
  const v = verifier();
  for (const bad of ["a.b", "a.b.c.d", "....", "a.b.c", "!!!.???.***",
                     `${enc({ alg: ALG })}.${enc(good())}.not-base64url!`]) {
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
    assert.equal((await v(`${enc({ alg: ALG })}.${payload}.${seg}`)).reason, "malformed",
      `signature "${seg}" was not refused as malformed`);
  }
  // THE CONTROL: the same shapes in real base64url are not refused for their
  // charset — they get as far as the signature, which is where they fail.
  assert.equal((await v(`${enc({ alg: ALG })}.${payload}.ab-c`)).reason, "bad-signature");
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
