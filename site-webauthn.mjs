// Passkeys.
//
// The only new sign-in method here that needs no mailer, no third party and no
// account registered with anybody: WebAuthn is in the browser already. Face ID,
// Touch ID, Windows Hello, a YubiKey. Nothing shared is ever sent, so there is
// no password to reuse, to phish, or to find in a breach — the private key never
// leaves the device and the signature is bound to the origin by the browser
// itself, which is why a convincing lookalike domain cannot collect one.
//
// Implemented directly rather than pulled from a library: the parts that matter
// are a few hundred bytes of well-specified binary, and a dependency in the
// Worker's hot path is a bigger liability than this much code. The pieces:
//
//   attestationObject  CBOR  → authData → the COSE public key we store
//   authenticatorData  binary, fixed offsets → rpIdHash, flags, signCount
//   clientDataJSON     JSON  → type, challenge, origin
//
// Everything is verified against a challenge WE issued and an origin WE expect.
// Both checks are the whole security model; without either, a signature from any
// site would be accepted here.

const enc = new TextEncoder();

export const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function unb64u(s) {
  const p = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ------------------------------------------------------------- CBOR
//
// Only what a COSE key and an attestation object actually contain: unsigned and
// negative integers, byte strings, text strings, arrays and maps. Anything else
// is refused rather than guessed at — this parses attacker-supplied bytes.

export function decodeCbor(bytes, start = 0) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = start;

  const need = (n) => { if (i + n > bytes.length) throw new Error("cbor: truncated"); };

  function read() {
    if (i >= bytes.length) throw new Error("cbor: truncated");
    const b = bytes[i++];
    const major = b >> 5, info = b & 31;
    const len = readLength(info);
    switch (major) {
      case 0: return len;                       // unsigned
      case 1: return -1 - len;                  // negative
      // `slice` past the end returns a SHORT array rather than failing, so the
      // bound has to be checked or a truncated body silently decodes to
      // something shorter than it claimed — which for a public key means
      // verifying signatures against the wrong bytes.
      case 2: { need(len); const v = bytes.slice(i, i + len); i += len; return v; }
      case 3: { need(len); const v = new TextDecoder().decode(bytes.slice(i, i + len)); i += len; return v; }
      case 4: { const a = []; for (let n = 0; n < len; n++) a.push(read()); return a; }
      case 5: { const m = new Map(); for (let n = 0; n < len; n++) { const k = read(); m.set(k, read()); } return m; }
      case 7:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        throw new Error("cbor: unsupported simple value");
      default: throw new Error("cbor: unsupported major type " + major);
    }
  }

  // The DataView is built over this array's own window, so an index into
  // `bytes` is already an index into the view.
  function readLength(info) {
    if (info < 24) return info;
    if (info === 24) { if (i >= bytes.length) throw new Error("cbor: truncated"); return bytes[i++]; }
    if (info === 25) { const v = view.getUint16(i, false); i += 2; return v; }
    if (info === 26) { const v = view.getUint32(i, false); i += 4; return v; }
    // 27 is a 64-bit length. Nothing in an attestation object is four gigabytes,
    // so refusing is safer than silently losing precision in a double.
    throw new Error("cbor: length too large");
  }

  const value = read();
  return { value, end: i };
}

// ------------------------------------------------------------- authenticator data

/**
 * Fixed layout, per the spec:
 *   32  rpIdHash
 *    1  flags   bit0 UP (user present) · bit2 UV (user verified) · bit6 AT (attested credential included)
 *    4  signCount (big-endian)
 *   [ if AT: 16 aaguid · 2 credIdLen · credId · COSE public key ]
 */
export function parseAuthData(bytes) {
  if (!bytes || bytes.length < 37) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = bytes[32];
  const out = {
    rpIdHash: bytes.slice(0, 32),
    flags,
    userPresent: !!(flags & 0x01),
    userVerified: !!(flags & 0x04),
    attested: !!(flags & 0x40),
    signCount: view.getUint32(33, false),
    credentialId: null,
    publicKey: null,
  };
  if (!out.attested) return out;
  if (bytes.length < 55) return null;
  const credLen = view.getUint16(53, false);
  const credEnd = 55 + credLen;
  if (credLen === 0 || credLen > 1023 || bytes.length < credEnd) return null;
  out.credentialId = bytes.slice(55, credEnd);
  try { out.publicKey = decodeCbor(bytes, credEnd).value; }
  catch { return null; }
  return out;
}

// ------------------------------------------------------------- COSE → CryptoKey

/** ES256 and RS256 only — what every real authenticator offers. */
export async function importCoseKey(cose) {
  if (!(cose instanceof Map)) return null;
  const kty = cose.get(1), alg = cose.get(3);
  if (kty === 2 && alg === -7) {
    const crv = cose.get(-1), x = cose.get(-2), y = cose.get(-3);
    if (crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array)) return null;
    if (x.length !== 32 || y.length !== 32) return null;
    const jwk = { kty: "EC", crv: "P-256", x: b64u(x), y: b64u(y) };
    // The JWK is BUILT, not exported back out of the CryptoKey: a key imported
    // for verification is non-extractable, so exporting it always fails — and
    // failing into a null public key means a credential that can never be used
    // again, which looks like a broken passkey rather than a bug here.
    return { alg: "ES256", jwk, key: await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]) };
  }
  if (kty === 3 && alg === -257) {
    const n = cose.get(-1), e = cose.get(-2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array)) return null;
    const jwk = { kty: "RSA", n: b64u(n), e: b64u(e) };
    return { alg: "RS256", jwk, key: await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]) };
  }
  return null;
}

/**
 * WebAuthn hands back an ECDSA signature in DER; WebCrypto wants raw r‖s.
 * Getting this wrong fails closed (every signature is rejected), which is the
 * safe direction but looks exactly like a broken passkey to the person using it.
 */
export function derToRaw(der) {
  if (!(der instanceof Uint8Array) || der[0] !== 0x30) return null;
  let i = 2;
  if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const readInt = () => {
    if (der[i++] !== 0x02) return null;
    let len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);   // strip DER's sign padding
    if (v.length > 32) return null;
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);                            // left-pad to a fixed 32
    return out;
  };
  const r = readInt(); if (!r) return null;
  const s = readInt(); if (!s) return null;
  const raw = new Uint8Array(64);
  raw.set(r, 0); raw.set(s, 32);
  return raw;
}

// ------------------------------------------------------------- the two flows

export function parseClientData(b64) {
  try {
    const data = JSON.parse(new TextDecoder().decode(unb64u(b64)));
    // `typeof [] === "object"`, and an array has no `type`, `challenge` or
    // `origin` — so it would sail past this and fail three checks later for the
    // wrong reason.
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch { return null; }
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Registration. Turns what the browser produced into the row we store.
 *
 * `expectedChallenge` must be the one WE issued and have not issued twice, and
 * `expectedOrigin` must be this site's own origin — those two checks are the
 * entire defence. Attestation is deliberately NOT verified: it proves which
 * make of authenticator was used, which matters to an enterprise with a hardware
 * policy and to nobody else here, and verifying it means shipping and updating
 * a root certificate store.
 */
export async function verifyRegistration({ response, expectedChallenge, expectedOrigin, expectedRpId } = {}) {
  const clientData = parseClientData(response && response.clientDataJSON);
  if (!clientData) return { error: "That passkey didn't register.", reason: "clientdata" };
  if (clientData.type !== "webauthn.create") return { error: "That passkey didn't register.", reason: "type" };
  if (clientData.challenge !== expectedChallenge) return { error: "That passkey didn't register.", reason: "challenge" };
  if (clientData.origin !== expectedOrigin) return { error: "That passkey didn't register.", reason: "origin" };

  let att;
  try { att = decodeCbor(unb64u(response.attestationObject)).value; }
  catch { return { error: "That passkey didn't register.", reason: "cbor" }; }
  if (!(att instanceof Map)) return { error: "That passkey didn't register.", reason: "cbor" };

  const authData = parseAuthData(att.get("authData"));
  if (!authData || !authData.attested) return { error: "That passkey didn't register.", reason: "authdata" };
  if (!authData.userPresent) return { error: "That passkey didn't register.", reason: "presence" };
  if (!sameBytes(authData.rpIdHash, await sha256(enc.encode(String(expectedRpId))))) {
    return { error: "That passkey didn't register.", reason: "rpid" };
  }

  const imported = await importCoseKey(authData.publicKey);
  if (!imported) return { error: "That passkey isn't supported.", reason: "alg" };

  return {
    ok: true,
    credentialId: b64u(authData.credentialId),
    publicKeyJwk: imported.jwk,
    alg: imported.alg,
    signCount: authData.signCount,
    userVerified: authData.userVerified,
  };
}

/**
 * Authentication. The stored key must verify a signature over
 * `authenticatorData ‖ SHA256(clientDataJSON)`.
 */
export async function verifyAssertion({ response, expectedChallenge, expectedOrigin, expectedRpId, credential } = {}) {
  const clientData = parseClientData(response && response.clientDataJSON);
  if (!clientData) return { error: "That passkey didn't work.", reason: "clientdata" };
  if (clientData.type !== "webauthn.get") return { error: "That passkey didn't work.", reason: "type" };
  if (clientData.challenge !== expectedChallenge) return { error: "That passkey didn't work.", reason: "challenge" };
  if (clientData.origin !== expectedOrigin) return { error: "That passkey didn't work.", reason: "origin" };

  const authBytes = unb64u(response.authenticatorData);
  const authData = parseAuthData(authBytes);
  if (!authData) return { error: "That passkey didn't work.", reason: "authdata" };
  if (!authData.userPresent) return { error: "That passkey didn't work.", reason: "presence" };
  if (!sameBytes(authData.rpIdHash, await sha256(enc.encode(String(expectedRpId))))) {
    return { error: "That passkey didn't work.", reason: "rpid" };
  }

  let key;
  try {
    key = credential.alg === "RS256"
      ? await crypto.subtle.importKey("jwk", credential.publicKeyJwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])
      : await crypto.subtle.importKey("jwk", credential.publicKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch { return { error: "That passkey didn't work.", reason: "key" }; }

  const signed = new Uint8Array(authBytes.length + 32);
  signed.set(authBytes, 0);
  signed.set(await sha256(unb64u(response.clientDataJSON)), authBytes.length);

  let sig = unb64u(response.signature);
  if (credential.alg !== "RS256") {
    sig = derToRaw(sig);
    if (!sig) return { error: "That passkey didn't work.", reason: "signature" };
  }

  const ok = credential.alg === "RS256"
    ? await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, sig, signed)
    : await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, signed);
  if (!ok) return { error: "That passkey didn't work.", reason: "signature" };

  // A counter that went backwards means two authenticators are answering for one
  // credential — i.e. the private key was extracted and copied. Authenticators
  // that do not implement a counter send 0 forever, which is not a signal.
  const cloned = authData.signCount > 0 && credential.signCount > 0 && authData.signCount <= credential.signCount;

  return { ok: true, signCount: authData.signCount, userVerified: authData.userVerified, cloned };
}

/** A fresh challenge. 32 bytes, and it must be single-use — the caller enforces that. */
export function newChallenge(random) {
  return b64u(random ? random(32) : crypto.getRandomValues(new Uint8Array(32)));
}
