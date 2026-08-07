// Somebody else's system pushing data INTO a published site.
//
// WHY THE PLATFORM OWNS THIS. Outbound webhooks were the site telling the world
// something happened; this is the world telling the site. It needs an HTTP
// endpoint (Postgres has no server to listen on) and it needs a SHARED SECRET to
// tell a real sender from a stranger — and a secret cannot live in a published
// page, which is public files on R2. Same two walls as payments, mail and spam.
//
// WHAT THE MODEL OWNS, WHICH IS EVERYTHING ELSE. The payload is handed to a
// function the model wrote at build time — `hook_<name>(payload jsonb)` — which
// decides what it means: insert a row, update stock, mark an order shipped,
// ignore it. There is no menu of verbs here and no field mapping in the
// platform. That is the direction this codebase settled on: make the substrate
// expressive rather than add another verb.
//
// FAILS CLOSED, WHICH IS THE OPPOSITE CALL FROM SPAM PROTECTION, and the
// asymmetry is deliberate. Turnstile refusing costs a real customer's booking,
// so an outage lets them through. This endpoint WRITES to the owner's database
// on behalf of a stranger, so anything unproven is refused: no secret stored
// means the route does not exist.

/** A body larger than this is not a webhook payload; it is somebody probing. */
export const MAX_BODY = 128 * 1024;
/** Per source, per site, per minute. Generous — a real sender bursts. */
export const MAX_PER_MINUTE = 120;

/**
 * The `hook_` prefix is a SECURITY BOUNDARY, not a naming convention.
 *
 * Without it this route calls any internal function the site declared — and
 * `confirm_booking(id)` is internal, takes a row id and returns a customer's
 * name, message and address. Then the only thing between a stranger and every
 * customer's details is the shared secret, when it should be the shared secret
 * AND the function having been written to be reachable this way.
 */
export const PREFIX = "hook_";

/** Where a sender may put a plain shared secret. */
const SECRET_HEADERS = ["authorization", "x-webhook-secret", "x-api-key", "x-webhook-token"];
/** Where a sender may put an HMAC of the raw body. */
const SIGNATURE_HEADERS = [
  "x-signature", "x-signature-256", "x-hub-signature-256",
  "x-shopify-hmac-sha256", "x-webhook-signature", "signature",
];

/**
 * Compare two secrets without leaking the answer in the time it takes.
 *
 * `a === b` returns on the first differing byte, so an attacker who can measure
 * the response learns the secret one character at a time. Length is compared
 * separately and up front because it cannot be hidden anyway — the loop runs
 * over a fixed count either way so a wrong length is not measurably faster.
 */
export function sameSecret(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (!x || !y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/**
 * Normalise whatever a provider calls a signature down to comparable hex.
 *
 * Providers disagree on all three axes and none of them is negotiable from our
 * end: GitHub sends `sha256=<hex>`, Shopify sends bare base64, others send bare
 * hex. Accepting all three costs nothing — the comparison is still against an
 * HMAC we computed ourselves over the exact bytes received.
 */
export function normalizeSignature(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  // `sha256=…`, `sha1=…`, `v1=…` — the scheme prefix some providers add.
  const eq = s.indexOf("=");
  if (eq > 0 && eq < 12 && !/^[0-9a-f]+$/i.test(s.slice(0, eq))) s = s.slice(eq + 1);
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
  // base64 of 32 bytes → 44 characters with padding.
  if (/^[A-Za-z0-9+/]{43}=$/.test(s)) {
    try {
      const bin = atob(s);
      let hex = "";
      for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
      return hex;
    } catch { return ""; }
  }
  return "";
}

/** HMAC-SHA256 of `body` under `secret`, as lowercase hex. */
export async function hmacHex(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Which vault name holds this hook's secret.
 *
 * Per hook FIRST, with a shared fallback. A site taking a stock feed and a
 * booking sync should be able to give each sender its own secret, so one
 * supplier's leak does not hand the other the keys — and a site with a single
 * sender should not have to think about naming.
 */
export function secretNames(name) {
  const suffix = String(name || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return suffix ? ["HOOK_SECRET_" + suffix, "HOOK_SECRET"] : ["HOOK_SECRET"];
}

/**
 * Is this caller allowed to deliver?
 *
 * Two proofs accepted, because senders differ and neither is under our control:
 * a plain shared secret in a header, or an HMAC of the raw body. The HMAC is
 * strictly better — it proves the BODY was not altered, where a shared secret
 * only proves the sender knew it — but plenty of systems (Zapier, Make, a
 * supplier's own script) only offer the header.
 *
 * The raw body is what is signed. Re-serialising the parsed JSON first would
 * change the bytes — key order, whitespace, number formatting — and every real
 * signature would fail while every test with a hand-built payload passed.
 */
export async function authorize({ secret, headers, body, hmac = hmacHex }) {
  if (!secret) return { ok: false, reason: "not configured" };

  for (const h of SECRET_HEADERS) {
    let v = headers.get(h);
    if (!v) continue;
    // `Authorization: Bearer <secret>` is how most systems offer to send one.
    if (h === "authorization") v = v.replace(/^Bearer\s+/i, "");
    if (sameSecret(v, secret)) return { ok: true, how: "secret" };
  }

  for (const h of SIGNATURE_HEADERS) {
    const got = normalizeSignature(headers.get(h));
    if (!got) continue;
    const want = await hmac(secret, body);
    // Constant-time even here: both sides are hex we produced, but a leaked
    // comparison time is a leaked comparison time.
    if (sameSecret(got, want)) return { ok: true, how: "signature" };
  }

  return { ok: false, reason: "not authorized" };
}

/**
 * Which declared function may serve this hook name, if any.
 *
 * Checked against the SCHEMA rather than trusted from the URL, because the name
 * reaches SQL. Four things have to hold, and each closes something:
 *
 *   - it is declared            → the name is ours, not the caller's
 *   - it is named `hook_…`      → a confirmation builder is not reachable here
 *   - it is `internal`          → nothing that is already public gains a second,
 *                                 differently-gated door
 *   - one `jsonb` argument      → the payload has somewhere to go, and the call
 *                                 shape is known without inspecting the body
 */
export function functionFor(spec, name) {
  const want = PREFIX + String(name || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(want)) return null;
  const fns = (spec && Array.isArray(spec.functions) ? spec.functions : []);
  const f = fns.find((x) => x && String(x.name).toLowerCase() === want);
  if (!f || !f.internal) return null;
  const args = Array.isArray(f.args) ? f.args : [];
  if (args.length !== 1 || String(args[0].type).toLowerCase() !== "jsonb") return null;
  return f;
}

/**
 * The whole decision, with every side effect injected.
 *
 * Returns `{status, body}` and performs nothing itself, so the ordering — size,
 * then rate limit, then existence, then authorization, then the call — is
 * testable without a database, a clock or a network.
 */
export async function handleInbound(deps, { slug, name, headers, body, ip }) {
  if (typeof body !== "string" || body.length > MAX_BODY) {
    return { status: 413, body: { error: "payload too large" } };
  }

  // BEFORE anything that costs a query. This endpoint is public and its whole
  // job is to do database work on request.
  const hit = deps.throttle ? await deps.throttle(slug + "|" + (ip || "")) : { ok: true };
  if (!hit.ok) return { status: 429, body: { error: "too many requests" }, retryAfter: hit.retryAfter };

  const spec = await deps.loadSchema();
  const fn = functionFor(spec, name);
  // 404 FOR AN UNDECLARED HOOK, and 404 again below for one with no secret. A
  // distinct "that hook exists but you are not authorized" tells a stranger
  // which integrations a business runs, which is the same enumeration argument
  // that makes another member's row a 404 rather than a 403.
  if (!fn) return { status: 404, body: { error: "no such hook" } };

  const secrets = await deps.loadSecrets(secretNames(name));
  const secret = secretNames(name).map((n) => secrets && secrets[n]).find((v) => typeof v === "string" && v);
  if (!secret) return { status: 404, body: { error: "no such hook" } };

  const auth = await authorize({ secret, headers, body, hmac: deps.hmac });
  if (!auth.ok) return { status: 401, body: { error: "not authorized" } };

  let payload;
  try { payload = JSON.parse(body || "null"); } catch { return { status: 400, body: { error: "expected json" } }; }
  // A top-level array or scalar is valid JSON and valid jsonb, so it is passed
  // through rather than refused: the model's function decides what it accepts,
  // and rejecting shapes here would be the platform guessing at somebody else's
  // payload format.

  let out;
  try {
    out = await deps.callFn(fn.name, payload);
  } catch (e) {
    // 500 SO THE SENDER RETRIES. Almost every webhook sender treats a 5xx as
    // "deliver again later" and a 4xx as "never again" — so a transient
    // database failure answered 4xx silently loses the delivery forever.
    //
    // The reason is logged and NEVER returned: a Postgres error quotes the
    // statement, and the statement is a model-written function body.
    if (deps.log) deps.log("inbound hook:", slug, name, (e && e.message) || e);
    return { status: 500, body: { error: "could not process that" } };
  }

  // Whatever the function returned, which is how a sender that expects an
  // acknowledgement gets one. `void` gives null, and `{ok:true}` is the answer
  // then — an empty body reads as a failure to some senders.
  return { status: 200, body: out === null || out === undefined ? { ok: true } : out };
}
