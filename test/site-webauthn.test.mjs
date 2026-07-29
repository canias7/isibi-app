// Passkeys.
//
// Hand-written binary parsing of attacker-supplied bytes, so the tests build
// REAL structures with REAL keys and drive the real verifier — a fake that just
// returns {ok:true} would prove nothing about the part that can be wrong.
//
// The two checks that are the entire security model get their own tests: a
// signature is only accepted for the challenge we issued and the origin we
// expect. Without either, a signature produced on any website would work here.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeCbor, parseAuthData, importCoseKey, derToRaw, parseClientData,
  verifyRegistration, verifyAssertion, newChallenge, b64u, unb64u,
} from "../site-webauthn.mjs";

const enc = new TextEncoder();
const ORIGIN = "https://isibi.ai";
const RPID = "isibi.ai";

// ---------------------------------------------------------------- CBOR encoder
// Only what the tests need, so the decoder is driven by something written
// independently of it rather than by its own inverse.
function cborBytes(v) {
  if (typeof v === "number" && v >= 0) return head(0, v);
  if (typeof v === "number") return head(1, -1 - v);
  if (v instanceof Uint8Array) return concat(head(2, v.length), v);
  if (typeof v === "string") { const b = enc.encode(v); return concat(head(3, b.length), b); }
  if (Array.isArray(v)) return concat(head(4, v.length), ...v.map(cborBytes));
  if (v instanceof Map) {
    const parts = [];
    for (const [k, val] of v) { parts.push(cborBytes(k), cborBytes(val)); }
    return concat(head(5, v.size), ...parts);
  }
  throw new Error("unsupported in test encoder");
}
function head(major, len) {
  if (len < 24) return Uint8Array.from([(major << 5) | len]);
  if (len < 256) return Uint8Array.from([(major << 5) | 24, len]);
  if (len < 65536) return Uint8Array.from([(major << 5) | 25, len >> 8, len & 255]);
  return Uint8Array.from([(major << 5) | 26, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255]);
}
function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

// ---------------------------------------------------------------- a real authenticator
async function makeAuthenticator({ credentialId = "cred-one" } = {}) {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const cose = new Map([
    [1, 2], [3, -7], [-1, 1],
    [-2, unb64u(jwk.x)], [-3, unb64u(jwk.y)],
  ]);
  const credId = enc.encode(credentialId);

  const authData = async (signCount, { flags = 0x45, rpId = RPID, attested = true } = {}) => {
    const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(rpId)));
    const counter = Uint8Array.from([(signCount >>> 24) & 255, (signCount >>> 16) & 255, (signCount >>> 8) & 255, signCount & 255]);
    const head32 = concat(rpIdHash, Uint8Array.from([flags]), counter);
    if (!attested) return head32;
    const aaguid = new Uint8Array(16);
    const lens = Uint8Array.from([(credId.length >> 8) & 255, credId.length & 255]);
    return concat(head32, aaguid, lens, credId, cborBytes(cose));
  };

  return {
    pair, credId,
    async register({ challenge, origin = ORIGIN, rpId = RPID, signCount = 0, flags = 0x45, type = "webauthn.create" }) {
      const clientDataJSON = b64u(enc.encode(JSON.stringify({ type, challenge, origin })));
      const ad = await authData(signCount, { flags, rpId });
      return { clientDataJSON, attestationObject: b64u(cborBytes(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", ad]]))) };
    },
    async assert({ challenge, origin = ORIGIN, rpId = RPID, signCount = 1, flags = 0x05, type = "webauthn.get", tamper = false }) {
      const clientDataJSON = b64u(enc.encode(JSON.stringify({ type, challenge, origin })));
      const ad = await authData(signCount, { flags, rpId, attested: false });
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", unb64u(clientDataJSON)));
      const signed = concat(ad, hash);
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, signed));
      // WebCrypto emits raw r‖s; a real authenticator emits DER. Re-encode, so
      // the DER path under test is the one exercised.
      const der = rawToDer(raw);
      if (tamper) der[der.length - 1] ^= 0xff;
      return { clientDataJSON, authenticatorData: b64u(ad), signature: b64u(der) };
    },
  };
}

function rawToDer(raw) {
  const int = (b) => {
    let v = b;
    let n = 0; while (n < v.length - 1 && v[n] === 0) n++;
    v = v.slice(n);
    if (v[0] & 0x80) v = concat(Uint8Array.from([0]), v);
    return concat(Uint8Array.from([0x02, v.length]), v);
  };
  const r = int(raw.slice(0, 32)), s = int(raw.slice(32));
  const body = concat(r, s);
  return concat(Uint8Array.from([0x30, body.length]), body);
}

// ---------------------------------------------------------------- CBOR

test("the decoder handles the shapes an attestation object contains", () => {
  assert.equal(decodeCbor(cborBytes(7)).value, 7);
  assert.equal(decodeCbor(cborBytes(300)).value, 300);
  assert.equal(decodeCbor(cborBytes(70000)).value, 70000);
  assert.equal(decodeCbor(cborBytes(-7)).value, -7);
  assert.equal(decodeCbor(cborBytes("fmt")).value, "fmt");
  assert.deepEqual([...decodeCbor(cborBytes(Uint8Array.from([1, 2, 3]))).value], [1, 2, 3]);
  const m = decodeCbor(cborBytes(new Map([[1, 2], [-1, "x"]]))).value;
  assert.equal(m.get(1), 2);
  assert.equal(m.get(-1), "x");
});

test("a truncated or oversized CBOR body throws rather than guessing", () => {
  assert.throws(() => decodeCbor(Uint8Array.from([0x42, 0x01])));          // 2-byte string, 1 byte present
  assert.throws(() => decodeCbor(Uint8Array.from([0x1b, 0, 0, 0, 0, 0, 0, 0, 1]))); // 64-bit length
  assert.throws(() => decodeCbor(Uint8Array.from([0xe0])));                 // unsupported simple value
});

// ---------------------------------------------------------------- registration

test("a real registration round-trips into a storable credential", async () => {
  const auth = await makeAuthenticator();
  const challenge = newChallenge();
  const r = await verifyRegistration({
    response: await auth.register({ challenge }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.alg, "ES256");
  assert.equal(r.credentialId, b64u(auth.credId));
  assert.ok(r.publicKeyJwk && r.publicKeyJwk.x);
});

test("registration is refused for a challenge we did not issue", async () => {
  const auth = await makeAuthenticator();
  const r = await verifyRegistration({
    response: await auth.register({ challenge: newChallenge() }),
    expectedChallenge: newChallenge(), expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  assert.equal(r.ok, undefined);
  assert.equal(r.reason, "challenge");
});

test("registration is refused for another origin", async () => {
  const auth = await makeAuthenticator();
  const challenge = newChallenge();
  const r = await verifyRegistration({
    response: await auth.register({ challenge, origin: "https://evil.example" }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  assert.equal(r.reason, "origin");
});

test("registration is refused when the rpId hash is for another site", async () => {
  const auth = await makeAuthenticator();
  const challenge = newChallenge();
  const r = await verifyRegistration({
    response: await auth.register({ challenge, rpId: "evil.example" }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  assert.equal(r.reason, "rpid");
});

test("registration is refused without user presence", async () => {
  const auth = await makeAuthenticator();
  const challenge = newChallenge();
  const r = await verifyRegistration({
    response: await auth.register({ challenge, flags: 0x40 }), // attested, but UP clear
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  assert.equal(r.reason, "presence");
});

test("a get response cannot be replayed as a create", async () => {
  const auth = await makeAuthenticator();
  const challenge = newChallenge();
  const r = await verifyRegistration({
    response: await auth.register({ challenge, type: "webauthn.get" }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  assert.equal(r.reason, "type");
});

// ---------------------------------------------------------------- assertion

async function registered() {
  const auth = await makeAuthenticator();
  const challenge = newChallenge();
  const reg = await verifyRegistration({
    response: await auth.register({ challenge }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
  });
  return { auth, credential: { publicKeyJwk: reg.publicKeyJwk, alg: reg.alg, signCount: reg.signCount } };
}

test("a real signature verifies against the stored key", async () => {
  const { auth, credential } = await registered();
  const challenge = newChallenge();
  const r = await verifyAssertion({
    response: await auth.assert({ challenge, signCount: 5 }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID, credential,
  });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.signCount, 5);
  assert.equal(r.cloned, false);
});

test("a tampered signature is refused", async () => {
  const { auth, credential } = await registered();
  const challenge = newChallenge();
  const r = await verifyAssertion({
    response: await auth.assert({ challenge, tamper: true }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID, credential,
  });
  assert.equal(r.ok, undefined);
  assert.equal(r.reason, "signature");
});

test("a signature for a DIFFERENT challenge is refused", async () => {
  // The replay defence. Without it, one captured assertion signs in forever.
  const { auth, credential } = await registered();
  const r = await verifyAssertion({
    response: await auth.assert({ challenge: newChallenge() }),
    expectedChallenge: newChallenge(), expectedOrigin: ORIGIN, expectedRpId: RPID, credential,
  });
  assert.equal(r.reason, "challenge");
});

test("a signature produced on another origin is refused", async () => {
  // The phishing defence, and the reason passkeys beat passwords: a lookalike
  // domain cannot collect anything usable here.
  const { auth, credential } = await registered();
  const challenge = newChallenge();
  const r = await verifyAssertion({
    response: await auth.assert({ challenge, origin: "https://isibi.ai.evil.example" }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID, credential,
  });
  assert.equal(r.reason, "origin");
});

test("another passkey's signature does not authenticate this credential", async () => {
  const { credential } = await registered();
  const other = await makeAuthenticator({ credentialId: "cred-two" });
  const challenge = newChallenge();
  const r = await verifyAssertion({
    response: await other.assert({ challenge }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID, credential,
  });
  assert.equal(r.reason, "signature");
});

test("a counter that goes backwards is reported as a clone", async () => {
  const { auth, credential } = await registered();
  const challenge = newChallenge();
  const r = await verifyAssertion({
    response: await auth.assert({ challenge, signCount: 3 }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
    credential: { ...credential, signCount: 9 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.cloned, true, "two authenticators answering for one credential");
});

test("an authenticator that never counts is not called a clone", async () => {
  // Plenty send 0 forever. Treating that as a clone would break them all.
  const { auth, credential } = await registered();
  const challenge = newChallenge();
  const r = await verifyAssertion({
    response: await auth.assert({ challenge, signCount: 0 }),
    expectedChallenge: challenge, expectedOrigin: ORIGIN, expectedRpId: RPID,
    credential: { ...credential, signCount: 0 },
  });
  assert.equal(r.cloned, false);
});

// ---------------------------------------------------------------- pieces

test("DER signatures convert to raw r‖s, including short and padded ones", () => {
  for (const [r, s] of [[1, 1], [0x80, 0x80], [255, 1]]) {
    const raw = new Uint8Array(64);
    raw[31] = r; raw[63] = s;
    const back = derToRaw(rawToDer(raw));
    assert.deepEqual([...back], [...raw]);
  }
});

test("a malformed DER signature is null, not a throw", () => {
  assert.equal(derToRaw(Uint8Array.from([0x02, 1, 1])), null);
  assert.equal(derToRaw(null), null);
});

test("an unsupported COSE algorithm is refused rather than assumed", async () => {
  assert.equal(await importCoseKey(new Map([[1, 1], [3, -8]])), null); // Ed25519
  assert.equal(await importCoseKey(new Map([[1, 2], [3, -7], [-1, 2]])), null); // P-384 curve id
  assert.equal(await importCoseKey(null), null);
});

test("clientData that is not JSON is null, not a crash", () => {
  assert.equal(parseClientData("!!!!"), null);
  assert.equal(parseClientData(b64u(enc.encode("[1,2]"))), null);
});

test("authData shorter than the fixed header is refused", () => {
  assert.equal(parseAuthData(new Uint8Array(10)), null);
  assert.equal(parseAuthData(null), null);
});

test("a credential id length that overruns the buffer is refused", () => {
  // 55 bytes of header claiming a 1000-byte credential id.
  const bytes = new Uint8Array(60);
  bytes[32] = 0x45;
  bytes[53] = 0x03; bytes[54] = 0xe8;
  assert.equal(parseAuthData(bytes), null);
});

test("challenges are unique and long", () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const c = newChallenge();
    assert.ok(unb64u(c).length >= 32);
    seen.add(c);
  }
  assert.equal(seen.size, 100);
});
