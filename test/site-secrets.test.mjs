// The vault holds live payment credentials, so the interesting assertions are
// the refusals and the things that must NEVER come back out.
import test from "node:test";
import assert from "node:assert/strict";
import {
  KEY_VERSIONS, keyMaterial, writeVersion, encryptSecret, decryptSecret,
  normalizeSecretName, checkSecretValue, secretHint, listSecrets, addSecret, writeMaterial,
  deleteSecret, readSecret, MAX_SECRETS_PER_SITE, MAX_SECRET_BYTES,
} from "../site-secrets.mjs";

const ENV2 = { SITE_SECRETS_KEY: "a".repeat(64), SUPABASE_SERVICE_KEY: "svc" };
const ENV1 = { SUPABASE_SERVICE_KEY: "svc" };

// ── keys ─────────────────────────────────────────────────────────────────────

test("writes under v2 when the dedicated key exists, v1 when only the service key does", () => {
  assert.equal(writeVersion(ENV2), 2);
  assert.equal(writeVersion(ENV1), 1);
  assert.equal(writeVersion({ FAL_KEY: "fal" }), 1);
});

test("WRITING REFUSES the 'isibi' fallback that READING must keep", () => {
  // The v1 derivation ends in a literal string that is in this file and in the
  // git history. A row written under it has to stay openable, so the read path
  // keeps it — but encrypting a live payment key under a public constant looks
  // encrypted in the database and is not.
  assert.equal(keyMaterial({}, 1), "isibi|site-secrets-v1");   // readable
  assert.equal(writeMaterial({}), null);                        // not writable
  assert.equal(writeVersion({}), null);
  assert.notEqual(writeMaterial(ENV1), null);
});

test("v1 derivation is byte-identical to the one worker.js already uses", () => {
  // Anything else strands every secret written before this module existed.
  assert.equal(keyMaterial({ SUPABASE_SERVICE_KEY: "svc" }, 1), "svc|site-secrets-v1");
  assert.equal(keyMaterial({ FAL_KEY: "fal" }, 1), "fal|site-secrets-v1");
  assert.equal(keyMaterial({}, 1), "isibi|site-secrets-v1");
});

test("v2 has NO fallback — an absent dedicated key is null, not a weaker key", () => {
  assert.equal(keyMaterial({ SUPABASE_SERVICE_KEY: "svc" }, 2), null);
  assert.equal(keyMaterial({}, 2), null);
});

test("an unknown version has no material rather than defaulting", () => {
  assert.equal(keyMaterial(ENV2, 9), null);
  assert.equal(keyMaterial(ENV2, 0), null);
});

// ── round trip ───────────────────────────────────────────────────────────────

test("encrypt then decrypt returns the original, under both versions", async () => {
  for (const env of [ENV1, ENV2]) {
    const packed = await encryptSecret(env, "sk_live_51abcXYZ");
    assert.equal(await decryptSecret(env, packed), "sk_live_51abcXYZ");
  }
});

test("the ciphertext carries its version, so adding the dedicated key later does not strand v1 rows", async () => {
  const old = await encryptSecret(ENV1, "sk_live_written_before");
  assert.match(old, /^v1\./);
  // The same environment now ALSO has the dedicated key: new writes go to v2,
  // and the old row must still open.
  assert.equal(writeVersion(ENV2), 2);
  assert.equal(await decryptSecret(ENV2, old), "sk_live_written_before");
  const fresh = await encryptSecret(ENV2, "sk_live_written_after");
  assert.match(fresh, /^v2\./);
  assert.equal(await decryptSecret(ENV2, fresh), "sk_live_written_after");
});

test("an UNVERSIONED blob is read as v1 — that is what D1-era rows look like", async () => {
  const packed = await encryptSecret(ENV1, "legacy_value");
  const bare = packed.replace(/^v1\./, "");
  assert.equal(await decryptSecret(ENV1, bare), "legacy_value");
});

test("the IV is fresh per call — the same plaintext never encrypts to the same blob", async () => {
  // AES-GCM loses confidentiality outright on IV reuse, and every secret on the
  // platform shares one key.
  const seen = new Set();
  for (let i = 0; i < 8; i++) seen.add(await encryptSecret(ENV2, "same"));
  assert.equal(seen.size, 8);
});

test("decrypting with the wrong key throws rather than returning junk", async () => {
  const packed = await encryptSecret(ENV2, "sk_live_x");
  await assert.rejects(() => decryptSecret({ SITE_SECRETS_KEY: "b".repeat(64) }, packed));
});

test("a v2 blob in an environment with no dedicated key names what is missing", async () => {
  const packed = await encryptSecret(ENV2, "sk_live_x");
  await assert.rejects(() => decryptSecret(ENV1, packed), (e) => {
    assert.equal(e.code, "no_key");
    assert.equal(e.version, 2);
    assert.match(e.message, /SITE_SECRETS_KEY/);
    return true;
  });
  assert.equal(KEY_VERSIONS[2], "SITE_SECRETS_KEY");
});

test("encrypting with no key configured throws no_key rather than storing under a public constant", async () => {
  await assert.rejects(() => encryptSecret({}, "sk_live_x"), (e) => {
    assert.equal(e.code, "no_key");
    return true;
  });
});

// ── names ────────────────────────────────────────────────────────────────────

test("names normalise to one identifier, so a rotation cannot miss", () => {
  for (const n of ["stripe_secret_key", "Stripe Secret Key", "STRIPE-SECRET-KEY", "  stripe_secret_key  "]) {
    assert.equal(normalizeSecretName(n), "STRIPE_SECRET_KEY", n);
  }
});

test("a name must start with a letter and stay in the identifier alphabet", () => {
  for (const bad of ["", "1KEY", "_KEY", "KEY!", "KEY.NAME", "KE Y!", null, undefined, {}, "A".repeat(65)]) {
    assert.equal(normalizeSecretName(bad), null, JSON.stringify(bad));
  }
  assert.equal(normalizeSecretName("A".repeat(64)), "A".repeat(64));
});

// ── values ───────────────────────────────────────────────────────────────────

test("an empty value is refused — the panel replaces on re-add, so it would erase a working key", () => {
  for (const bad of ["", "   ", "\t\n "]) assert.equal(checkSecretValue(bad).ok, false, JSON.stringify(bad));
});

test("a non-string value is refused rather than stringified", () => {
  // String(7) is "7", which passes every shape test and would store a number as
  // a key — the same class as the role bug in site-access.
  for (const bad of [7, true, null, undefined, {}, ["sk_live_x"]]) assert.equal(checkSecretValue(bad).ok, false, JSON.stringify(bad));
});

test("surrounding whitespace is trimmed, an interior line break is refused", () => {
  assert.equal(checkSecretValue("  sk_live_x  ").value, "sk_live_x");
  assert.equal(checkSecretValue("sk_live_x\nsk_live_y").ok, false);
  assert.equal(checkSecretValue("sk_live_x\r").value, "sk_live_x");
});

test("an oversized value is refused", () => {
  assert.equal(checkSecretValue("x".repeat(MAX_SECRET_BYTES)).ok, true);
  assert.equal(checkSecretValue("x".repeat(MAX_SECRET_BYTES + 1)).ok, false);
});

// ── the hint ─────────────────────────────────────────────────────────────────

test("the hint shows a known public prefix and the last four, never more", () => {
  const h = secretHint("sk_live_51QeXamPleAbCdEf9999");
  assert.equal(h.prefix, "sk_live");
  assert.equal(h.last4, "9999");
  assert.equal(h.mode, "live");
});

test("test and live are distinguishable — the difference between taking money and not", () => {
  assert.equal(secretHint("sk_test_abcdefgh").mode, "test");
  assert.equal(secretHint("sk_live_abcdefgh").mode, "live");
  assert.equal(secretHint("whsec_abcdefgh").mode, null);
  assert.equal(secretHint("whsec_abcdefgh").prefix, "whsec");
});

test("an OPAQUE token gets no prefix — leading characters there are entropy", () => {
  const h = secretHint("9f3a1c7e5b2d8a4600ff");
  assert.equal(h.prefix, null);
  assert.equal(h.mode, null);
  assert.equal(h.last4, "00ff");
});

test("a short value gets no last4 at all", () => {
  assert.equal(secretHint("abc").last4, null);
  assert.equal(secretHint("").last4, null);
  assert.equal(secretHint("abcdefgh").last4, "efgh");
});

// ── the vault ────────────────────────────────────────────────────────────────

function fakeVault(seed = []) {
  const rows = seed.slice();
  return {
    rows,
    list: async () => rows.map((r) => ({ ...r })),
    get: async (_s, name) => (rows.find((r) => r.name === name) || {}).cipher || null,
    put: async (_s, name, cipher, hint) => {
      const i = rows.findIndex((r) => r.name === name);
      const row = { name, cipher, hint, created_at: "2026-08-06 00:00:00" };
      if (i >= 0) rows[i] = row; else rows.push(row);
    },
    remove: async (_s, name) => {
      const i = rows.findIndex((r) => r.name === name);
      if (i < 0) return { removed: false };
      rows.splice(i, 1);
      return { removed: true };
    },
  };
}

test("LISTING NEVER RETURNS A VALUE — the panel promises this and this is the half that must be true", async () => {
  const v = fakeVault();
  await addSecret(v, ENV2, { slug: "s", name: "STRIPE_SECRET_KEY", value: "sk_live_51SuperSecret9999" });
  const out = await listSecrets(v, { slug: "s" });
  const blob = JSON.stringify(out);
  assert.equal(blob.includes("sk_live_51SuperSecret9999"), false);
  assert.equal(blob.includes("SuperSecret"), false);
  // Not even the ciphertext, which is a decryption away from the value.
  assert.equal(blob.includes(v.rows[0].cipher), false);
  assert.deepEqual(Object.keys(out.secrets[0]).sort(), ["created_at", "last4", "mode", "name", "prefix"]);
});

test("adding refuses a bad name and a bad value before touching storage", async () => {
  const v = fakeVault();
  assert.equal((await addSecret(v, ENV2, { slug: "s", name: "1BAD", value: "x" })).status, 400);
  assert.equal((await addSecret(v, ENV2, { slug: "s", name: "OK", value: "" })).status, 400);
  assert.equal(v.rows.length, 0);
});

test("re-adding a name REPLACES it, and is allowed even at the cap", async () => {
  const seed = Array.from({ length: MAX_SECRETS_PER_SITE }, (_, i) => ({ name: `K${i}`, cipher: "v2.x", hint: {} }));
  const v = fakeVault(seed);
  // At the cap, a NEW name is refused...
  assert.equal((await addSecret(v, ENV2, { slug: "s", name: "EXTRA", value: "x" })).status, 400);
  // ...but rotating one that exists must never be, or a leaked key cannot be replaced.
  const r = await addSecret(v, ENV2, { slug: "s", name: "K0", value: "sk_live_rotated_1234" });
  assert.equal(r.ok, true);
  assert.equal(r.replaced, true);
  assert.equal(v.rows.length, MAX_SECRETS_PER_SITE);
  assert.equal(await readSecret(v, ENV2, { slug: "s", name: "K0" }), "sk_live_rotated_1234");
});

test("with no encryption key the add FAILS CLOSED at 503 and stores nothing", async () => {
  const v = fakeVault();
  const r = await addSecret({ ...v, put: async () => { throw new Error("must not be reached"); } }, {}, { slug: "s", name: "STRIPE_SECRET_KEY", value: "sk_live_x1234567" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  assert.match(r.error, /not configured/);
  assert.equal(v.rows.length, 0);
});

test("the 503 says storage is unconfigured and never echoes the value or the reason's internals", async () => {
  const r = await addSecret(fakeVault(), {}, { slug: "s", name: "K", value: "sk_live_SuperSecret9999" });
  assert.equal(JSON.stringify(r).includes("SuperSecret"), false);
});

test("a name is normalised on the way IN, so a rotation by a differently-cased name hits the same secret", async () => {
  const v = fakeVault();
  await addSecret(v, ENV2, { slug: "s", name: "stripe_secret_key", value: "sk_live_first_0001" });
  await addSecret(v, ENV2, { slug: "s", name: "Stripe-Secret-Key", value: "sk_live_second_0002" });
  assert.equal(v.rows.length, 1);
  assert.equal(v.rows[0].name, "STRIPE_SECRET_KEY");
  assert.equal(await readSecret(v, ENV2, { slug: "s", name: "STRIPE_SECRET_KEY" }), "sk_live_second_0002");
});

test("delete is idempotent — the panel's button can be double-clicked", async () => {
  const v = fakeVault();
  await addSecret(v, ENV2, { slug: "s", name: "K", value: "x1234567" });
  assert.deepEqual(await deleteSecret(v, { slug: "s", name: "K" }), { ok: true, removed: true });
  assert.deepEqual(await deleteSecret(v, { slug: "s", name: "K" }), { ok: true, removed: false });
});

test("delete normalises too, or a secret added lowercase could never be removed", async () => {
  const v = fakeVault();
  await addSecret(v, ENV2, { slug: "s", name: "STRIPE_SECRET_KEY", value: "sk_live_x1234567" });
  assert.equal((await deleteSecret(v, { slug: "s", name: "stripe secret key" })).removed, true);
  assert.equal(v.rows.length, 0);
});

test("reading an absent secret is null, not a throw — 'payments not configured' is a real answer", async () => {
  const v = fakeVault();
  assert.equal(await readSecret(v, ENV2, { slug: "s", name: "NOPE" }), null);
  assert.equal(await readSecret(v, ENV2, { slug: "s", name: "!!" }), null);
});

test("reading a secret that will not decrypt THROWS rather than yielding an empty key", async () => {
  // An empty key would call Stripe unauthenticated and tell a customer with a
  // good card that their payment failed.
  const v = fakeVault([{ name: "K", cipher: await encryptSecret(ENV2, "sk_live_x") }]);
  await assert.rejects(() => readSecret(v, { SITE_SECRETS_KEY: "wrong".repeat(13) }, { slug: "s", name: "K" }));
});
