// A site owner's own API keys, held for them.
//
// This is the module that makes "put your Stripe key in Secrets and it works"
// true. The published site is static files on R2 talking straight to Neon's
// Data API, so there is no per-site server — a live payment credential can
// therefore never travel with the bundle, and the only place it can be used is
// inside the Worker. That is the whole shape of this file: values go IN from
// the owner's browser, come OUT only into a server-side call, and are never
// returned to anybody.
//
// The Secrets panel in public/chat.js has existed since the D1 era and calls
// three routes that were deleted with that runtime, so it has been 404ing ever
// since. Its contract is what this serves, unchanged.
//
// Everything here is pure or takes its dependencies as arguments, so the
// encryption, the key versioning and every refusal can be driven directly —
// the same reason stripe-webhook.mjs was lifted out of worker.js.

// The one import: the gateway's marker, a constant from a dependency-free
// module, so this file can refuse to treat it as key material (below).
import { SB_MARKER } from "./builder/job-gateway.mjs";

// ── Key versioning ───────────────────────────────────────────────────────────
//
// v1 derived the AES key from SUPABASE_SERVICE_KEY. That is a real hazard for
// THIS content:
// rotating the Supabase service key would silently make every stored payment
// credential undecryptable, and the failure would show up as checkouts breaking
// on every site at once, long after the rotation.
//
// So v2 derives from a dedicated SITE_SECRETS_KEY. The version travels WITH the
// ciphertext rather than being inferred from which env vars happen to be set —
// otherwise adding SITE_SECRETS_KEY later would make every v1 secret unreadable
// at the moment it was added, which is the same outage one step removed.
export const KEY_VERSIONS = { 1: "SUPABASE_SERVICE_KEY", 2: "SITE_SECRETS_KEY" };
const CURRENT_VERSION = 2;

/**
 * THE GATEWAY MARKER IS NOT KEY MATERIAL (stage 4b, 2026-09-06). Inside the
 * site's container the job's env carries `SUPABASE_SERVICE_KEY` as a marker
 * the fetch shim recognises, never the key — so v1's derivation, which reads
 * that name, would quietly derive a key from a constant that is in this
 * repository. A v1 row cannot be opened there, and "cannot decrypt" is the
 * honest answer; the fallbacks below are for a Worker with the real name
 * unset, not for a process that was deliberately handed a stand-in.
 */
const gatewayStandIn = (e) => e.SUPABASE_SERVICE_KEY === SB_MARKER;

/**
 * Material for a version's key. Returns null when that version's source is
 * absent, which the callers treat as "cannot encrypt" / "cannot decrypt" rather
 * than falling back to a weaker key — a fallback here would mean a secret
 * silently encrypted under something an operator did not choose.
 */
export function keyMaterial(env, version) {
  const e = env || {};
  if (version === 2) return e.SITE_SECRETS_KEY ? String(e.SITE_SECRETS_KEY) + "|site-secrets-v2" : null;
  if (version === 1 && gatewayStandIn(e)) return null;
  // v1 keeps the derivation the D1-era vault used, INCLUDING its "isibi"
  // fallback, or previously stored secrets stop opening. See writeMaterial for
  // why that fallback is readable and not writable.
  //
  // THIS IS THE ONLY DERIVATION IN THE TREE, and that is now asserted rather
  // than assumed. worker.js carried a second copy from 2026-08-27 to
  // 2026-08-30 with a DIFFERENT fallback, and nothing noticed: it had no
  // callers and no encrypt path, so it could never have written or opened a
  // row. The test that should have caught it was called "byte-identical to the
  // one worker.js already uses" and never opened worker.js — it compared this
  // module against hardcoded strings. A second copy of a key derivation is the
  // one kind of duplicate that cannot be caught by reading either copy.
  if (version === 1) return (e.SUPABASE_SERVICE_KEY || e.FAL_KEY || "isibi") + "|site-secrets-v1";
  return null;
}

/**
 * What a NEW secret is encrypted under — deliberately stricter than the read
 * path, and this asymmetry is the point.
 *
 * v1's derivation ends in the literal string "isibi". That is fine for READING,
 * because a row written under it has to stay openable. It is not fine for
 * WRITING a live payment credential: on a Worker with neither key configured,
 * every secret on the platform would be encrypted under a constant that is in
 * this file, in the git history, and therefore public — which is indistinguishable
 * from storing them in the clear, while looking encrypted in the database.
 *
 * So writing refuses unless real key material exists, which is also what makes
 * addSecret's 503 reachable. Written as its own function rather than a flag on
 * keyMaterial, because "which key opens this blob" and "may I write at all" are
 * different questions and a shared answer is how the weak one leaks into both.
 */
export function writeMaterial(env) {
  const e = env || {};
  if (e.SITE_SECRETS_KEY) return { version: 2, material: keyMaterial(e, 2) };
  if (gatewayStandIn(e)) return null;
  if (e.SUPABASE_SERVICE_KEY || e.FAL_KEY) return { version: 1, material: keyMaterial(e, 1) };
  return null;
}

// Which version a new secret is written under, or null when none may be.
export function writeVersion(env) {
  const w = writeMaterial(env);
  return w ? w.version : null;
}

const b64urlFromBytes = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const bytesFromB64url = (str) => {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function aesKey(material) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Pack: "v<N>.<b64url(iv || ciphertext)>".
 *
 * A fresh 12-byte IV per call, from the CSPRNG, because AES-GCM catastrophically
 * loses confidentiality when an IV repeats under one key — and every secret on
 * the platform shares a key. Prefixing the version rather than storing it in a
 * column keeps the ciphertext self-describing, so a row copied or restored out
 * of order still opens.
 */
export async function encryptSecret(env, plaintext) {
  const w = writeMaterial(env);
  if (!w) throw Object.assign(new Error("no encryption key configured"), { code: "no_key" });
  const { version, material } = w;
  const key = await aesKey(material);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(String(plaintext))));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return `v${version}.${b64urlFromBytes(packed)}`;
}

/**
 * Unpack. An unversioned blob is v1 — that is what the D1-era rows look like,
 * and refusing them would strand anything written before this file existed.
 *
 * Throws rather than returning null on a failure, and the callers do NOT catch
 * it into a default: a checkout that proceeds with an empty key would call
 * Stripe unauthenticated and report a payment failure to a customer whose card
 * is fine. The honest answer is that this site's payments are not configured.
 */
export async function decryptSecret(env, packed) {
  const raw = String(packed || "");
  const m = raw.match(/^v(\d+)\.(.*)$/s);
  const version = m ? Number(m[1]) : 1;
  const body = m ? m[2] : raw;
  const material = keyMaterial(env, version);
  if (!material) throw Object.assign(new Error(`secret needs ${KEY_VERSIONS[version] || "an unknown key"}`), { code: "no_key", version });
  const key = await aesKey(material);
  const bytes = bytesFromB64url(body);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(pt);
}

// ── What may be stored ───────────────────────────────────────────────────────

export const MAX_SECRETS_PER_SITE = 25;
export const MAX_SECRET_BYTES = 4096;

/**
 * A name becomes an environment-variable-shaped identifier the checkout path
 * looks up by exact string, so it is normalised ON THE WAY IN rather than at
 * every read: `stripe_secret_key`, `Stripe_Secret_Key` and `STRIPE_SECRET_KEY`
 * must be one secret, not three, or an owner rotates the one they can see and
 * the site keeps using the one they cannot.
 */
export function normalizeSecretName(name) {
  const n = String(name == null ? "" : name).trim().toUpperCase().replace(/[\s-]+/g, "_");
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(n) ? n : null;
}

/**
 * Refuse a value that is not a plausible secret. Two of these are about the
 * owner, not the attacker:
 *
 * - EMPTY is refused because the panel's "rotate by re-adding" flow means an
 *   accidental empty submit would REPLACE a working key with nothing, and the
 *   first sign would be a customer failing to pay.
 * - A value with a newline or a leading/trailing space is almost always a paste
 *   accident. It is trimmed rather than refused, because telling somebody their
 *   correct key is invalid is worse than quietly fixing the whitespace — but an
 *   INTERIOR newline means they pasted more than the key and is refused.
 */
export function checkSecretValue(value) {
  if (typeof value !== "string") return { ok: false, error: "value must be text" };
  const v = value.trim();
  if (!v) return { ok: false, error: "value is empty" };
  if (new TextEncoder().encode(v).length > MAX_SECRET_BYTES) return { ok: false, error: "value is too long" };
  if (/[\r\n]/.test(v)) return { ok: false, error: "value contains a line break — paste the key only" };
  return { ok: true, value: v };
}

/**
 * A hint the owner can recognise their own key by, WITHOUT it being a way to
 * read the key back. Four trailing characters is what every payment dashboard
 * shows, and it is not enough to reconstruct anything; the leading token is
 * shown only when it is one of Stripe's public, self-describing prefixes, which
 * carry no entropy and are the part an owner actually needs to see — `sk_test`
 * versus `sk_live` is the difference between a shop that takes money and one
 * that quietly does not.
 *
 * Deliberately NOT a generic "first four characters": on an opaque token those
 * ARE entropy, and showing them narrows a brute force for free.
 */
export const STRIPE_PREFIXES = ["sk_live", "sk_test", "rk_live", "rk_test", "pk_live", "pk_test", "whsec"];

export function secretHint(value) {
  const v = String(value || "");
  const prefix = STRIPE_PREFIXES.find((p) => v.startsWith(p + "_")) || null;
  const last4 = v.length >= 8 ? v.slice(-4) : null;
  return { prefix, last4, mode: prefix ? (prefix.includes("live") ? "live" : (prefix.includes("test") ? "test" : null)) : null };
}

// ── The vault's decisions ────────────────────────────────────────────────────
//
// deps:
//   list(slug)                 → [{name, created_at, hint}]
//   put(slug, name, cipher, hint) → void
//   remove(slug, name)         → {removed: boolean}

/**
 * List — names and hints only, NEVER values, and that is asserted rather than
 * left to the caller remembering. The panel's own copy promises "values are
 * never shown again"; this is the half that has to be true.
 */
export async function listSecrets(deps, { slug }) {
  const rows = (await deps.list(slug)) || [];
  return {
    ok: true,
    secrets: rows.map((r) => ({
      name: r.name,
      created_at: r.created_at || null,
      // Stored at write time, so listing never needs the key that would decrypt.
      prefix: (r.hint && r.hint.prefix) || null,
      last4: (r.hint && r.hint.last4) || null,
      mode: (r.hint && r.hint.mode) || null,
    })),
  };
}

export async function addSecret(deps, env, { slug, name, value }) {
  const n = normalizeSecretName(name);
  if (!n) return { ok: false, status: 400, error: "name must start with a letter and use A-Z, 0-9 and _" };
  const v = checkSecretValue(value);
  if (!v.ok) return { ok: false, status: 400, error: v.error };
  // Counted BEFORE encrypting, so a site at its cap does not spend a key
  // derivation per rejected call on a route anybody's owner can hammer.
  // Replacing an existing name is always allowed — otherwise an owner at the
  // cap could not rotate the key they already have, which is the one operation
  // they most need when a key leaks.
  const existing = (await deps.list(slug)) || [];
  const replacing = existing.some((r) => r.name === n);
  if (!replacing && existing.length >= MAX_SECRETS_PER_SITE) {
    return { ok: false, status: 400, error: `a site can hold ${MAX_SECRETS_PER_SITE} secrets` };
  }
  let cipher;
  try {
    cipher = await encryptSecret(env, v.value);
  } catch (e) {
    // Fails CLOSED and says so. Storing a payment credential under a key nobody
    // configured, or in the clear, are both worse than refusing.
    return { ok: false, status: 503, error: e && e.code === "no_key" ? "secret storage is not configured" : "could not store that secret" };
  }
  await deps.put(slug, n, cipher, secretHint(v.value));
  return { ok: true, name: n, replaced: replacing };
}

export async function deleteSecret(deps, { slug, name }) {
  const n = normalizeSecretName(name);
  if (!n) return { ok: false, status: 400, error: "unknown secret" };
  const r = await deps.remove(slug, n);
  // Idempotent: deleting something already gone is a success, because the panel
  // fires this from a button somebody can double-click and a 404 on the second
  // click reads as a broken control rather than as "it was already deleted".
  return { ok: true, removed: !!(r && r.removed) };
}

/**
 * Read one, decrypted, for a server-side call. The ONLY function here that
 * returns a value, and it has no route — it is reachable from the checkout path
 * and nowhere else. Returns null for absent so a caller can tell "this site has
 * not configured payments" from a decryption failure, which throws.
 */
export async function readSecret(deps, env, { slug, name }) {
  const n = normalizeSecretName(name);
  if (!n) return null;
  const cipher = await deps.get(slug, n);
  if (!cipher) return null;
  return decryptSecret(env, cipher);
}
