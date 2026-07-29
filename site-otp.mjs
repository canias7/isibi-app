// Codes: the authenticator-app kind, and the emailed kind.
//
// Two things that look alike and defend different doors.
//
//   TOTP is a SECOND factor. The password already proved who they are; this
//   proves they still hold the phone. RFC 6238, so it works with Google
//   Authenticator, Authy, 1Password and every other app without us shipping
//   anything. `totp_secret` and `totp_enabled` have been columns on every site's
//   `_users` since the D1 era, read by nothing.
//
//   A magic link / emailed code is a FIRST factor — it replaces the password
//   entirely. Which makes it exactly as strong as the mailbox, and means it must
//   be short-lived, single-use, and rate-limited harder than a password, because
//   a six-digit code has a millionth the entropy of one.
//
// Pure. The clock is a parameter and the crypto is real, so the parts that are
// catastrophic when wrong — a code accepted a day late, a code accepted twice,
// a window wide enough to brute force — are all driven directly.

const enc = new TextEncoder();

// ------------------------------------------------------------- TOTP

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648, what every authenticator app expects
export const TOTP_STEP_SEC = 30;
export const TOTP_DIGITS = 6;
/** One step either side. Wider is a bigger brute-force surface; narrower breaks on clock drift. */
export const TOTP_WINDOW = 1;

export function newTotpSecret(random) {
  const bytes = random ? random(20) : crypto.getRandomValues(new Uint8Array(20)); // 160 bits, the RFC's recommendation
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(secret) {
  const clean = String(secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (!clean) return null;
  const out = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) return null;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function hotp(keyBytes, counter) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  // Eight bytes, big-endian. JavaScript bitwise ops are 32-bit, so the high half
  // is written with division rather than shifts — `counter >>> 32` is 0.
  const buf = new Uint8Array(8);
  let hi = Math.floor(counter / 0x100000000), lo = counter >>> 0;
  for (let i = 3; i >= 0; i--) { buf[i] = hi & 255; hi >>>= 8; }
  for (let i = 7; i >= 4; i--) { buf[i] = lo & 255; lo >>>= 8; }
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export async function totpCode(secret, { nowMs = Date.now(), step = 0 } = {}) {
  const key = base32Decode(secret);
  if (!key || !key.length) return null;
  return hotp(key, Math.floor(nowMs / 1000 / TOTP_STEP_SEC) + step);
}

/**
 * Verify a code, allowing for clock drift.
 *
 * Returns the step it matched (…-1, 0, 1) or null. The step is returned rather
 * than a boolean so the caller can store it and refuse a REPLAY: a six-digit
 * code stays valid for up to ninety seconds, and somebody watching the network
 * can use it again inside that window unless the last accepted step is kept.
 */
export async function verifyTotp(secret, code, { nowMs = Date.now(), lastStep = null } = {}) {
  const given = String(code == null ? "" : code).replace(/\D/g, "");
  if (given.length !== TOTP_DIGITS) return null;
  const key = base32Decode(secret);
  if (!key || !key.length) return null;
  const base = Math.floor(nowMs / 1000 / TOTP_STEP_SEC);
  for (let d = -TOTP_WINDOW; d <= TOTP_WINDOW; d++) {
    const step = base + d;
    if (lastStep != null && step <= lastStep) continue; // already used, or older than one that was
    const want = await hotp(key, step);
    // Length is fixed, so a plain compare leaks nothing a timing attack can use
    // to shorten a search of a million possibilities meaningfully — but it costs
    // nothing to be constant-time, and this file is copied from more than it is read.
    let diff = 0;
    for (let i = 0; i < TOTP_DIGITS; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
    if (diff === 0) return step;
  }
  return null;
}

/** The string an authenticator app scans. The label is what the person will see. */
export function totpUri({ secret, account, issuer }) {
  const iss = encodeURIComponent(String(issuer || "site").slice(0, 60));
  const acct = encodeURIComponent(String(account || "member").slice(0, 120));
  return `otpauth://totp/${iss}:${acct}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SEC}`;
}

// ------------------------------------------------------------- recovery codes

/**
 * What somebody uses when the phone is gone.
 *
 * Stored HASHED, exactly like a password — a recovery code IS a password, and a
 * list of them in plain text is a list of ways into every account that has them.
 * Shown once, at generation.
 */
export const RECOVERY_COUNT = 10;
export function newRecoveryCodes(random) {
  const A = "abcdefghjkmnpqrstuvwxyz23456789"; // no i/l/o/0/1
  const bytes = random ? random(RECOVERY_COUNT * 10) : crypto.getRandomValues(new Uint8Array(RECOVERY_COUNT * 10));
  const codes = [];
  for (let c = 0; c < RECOVERY_COUNT; c++) {
    let s = "";
    for (let i = 0; i < 10; i++) {
      s += A[bytes[c * 10 + i] % A.length];
      if (i === 4) s += "-";
    }
    codes.push(s);
  }
  return codes;
}

export function normalizeRecovery(code) {
  const s = String(code == null ? "" : code).toLowerCase().replace(/[^a-z0-9]/g, "");
  return s.length === 10 ? s : null;
}

// ------------------------------------------------------------- emailed codes

/**
 * A short numeric code for signing in from an email.
 *
 * Six digits is a million possibilities, which is fine against five attempts and
 * hopeless against five thousand — so the ATTEMPT LIMIT, not the length, is what
 * makes this safe, and it is the caller's job to enforce it. Ten minutes,
 * because a login code is used immediately or not at all.
 */
export const EMAIL_CODE_TTL_SEC = 10 * 60;
export const EMAIL_CODE_ATTEMPTS = 5;

export function newEmailCode(random) {
  const bytes = random ? random(4) : crypto.getRandomValues(new Uint8Array(4));
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export function codeMatches(given, expected) {
  const a = String(given == null ? "" : given).replace(/\D/g, "");
  const b = String(expected == null ? "" : expected).replace(/\D/g, "");
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
