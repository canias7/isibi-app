// A published site reading somebody else's API at request time.
//
// WHY THE PLATFORM OWNS THIS. Live delivery slots from a courier, today's
// exchange rate, a supplier's stock level, the weather for an outdoor venue — a
// page needs data that is not in its own database and is not fixed at build
// time. The model cannot do it: almost every such API needs a KEY, and the
// model's output runs either in a public page (where a key is a key given away)
// or in Postgres, which has no HTTP client. The same two walls as payments,
// mail, spam and inbound webhooks.
//
// WHAT MAKES THIS ONE PRIMITIVE RATHER THAN A LIST OF INTEGRATIONS. The site
// declares the WHOLE REQUEST — url, method, headers, body — with `{{SECRET}}`
// placeholders wherever a credential belongs. The platform substitutes them out
// of the site's own vault and never returns them. So a courier, a currency
// feed, a spreadsheet and a stock system are one feature, and adding the next
// one is a line in a schema rather than a line in this file.
//
// THE PAGE MAY ONLY FILL DECLARED BLANKS. `{{param.postcode}}` is substituted
// from the query string, URL-encoded, and a parameter the declaration never
// named is dropped. That is what stops a public endpoint on our domain becoming
// an open proxy: a caller can change the postcode, never the host.

import { blockedReason } from "./site-ssrf.mjs";

/** Bigger than any answer a page should be rendering. */
export const MAX_RESPONSE = 256 * 1024;
/** Per source, per site, per minute. This spends the OWNER'S third-party quota. */
export const MAX_PER_MINUTE = 60;
/** Longest a visitor waits on somebody else's server. */
export const TIMEOUT_MS = 8000;
/** A declared cache window is clamped into this. */
export const MIN_TTL = 0, MAX_TTL = 3600;

/**
 * Cloudflare KV refuses an `expirationTtl` under 60 seconds.
 *
 * That is not a rounding problem, it is a correctness one: a stock level
 * declared good for 30 seconds held in KV for 60 is a page showing a quantity
 * that has already changed, and the declaration is the only thing that knows
 * which of those matters. Anything under the floor stays on the per-isolate
 * cache alone, where the exact window CAN be honoured.
 */
export const KV_MIN_TTL = 60;

/** Whether this declaration's window can be expressed in KV at all. */
export const kvEligible = (ttl) => Number(ttl) >= KV_MIN_TTL;

/**
 * The KV key for a cached answer.
 *
 * HASHED, and not to be tidy. `cacheKey` carries the slug, the name and up to 8
 * parameters of 200 characters each — comfortably past KV's 512-byte key limit,
 * where a write simply fails and the cache silently never works. And it is
 * SHA-256 rather than something cheap: a collision here does not lose a cache
 * entry, it serves ONE SITE'S third-party data to ANOTHER, so the hash has to be
 * one where collisions are not merely unlikely but unconstructable.
 *
 * The `api:` prefix keeps this namespace apart from `route:` in the same store.
 */
export async function kvKeyFor(key, subtle) {
  const c = subtle || (globalThis.crypto && globalThis.crypto.subtle);
  if (!c) return null;
  const buf = await c.digest("SHA-256", new TextEncoder().encode(String(key)));
  return "api:" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SECRET_RE = /\{\{\s*([A-Z][A-Z0-9_]{0,60})\s*\}\}/g;
const PARAM_RE = /\{\{\s*param\.([a-z][a-z0-9_]{0,40})\s*\}\}/gi;

/**
 * Normalise one declaration. Everything the model can get wrong is decided here
 * rather than at request time, so a broken declaration is a missing feature
 * instead of a 500 on a live page.
 */
export function normalizeApi(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(name)) return null;
  const url = String(raw.url || "").slice(0, 1000).trim();
  if (!url) return null;
  // GET and POST only. A site reading somebody else's API does not need to
  // DELETE from it, and the narrower the verb list the smaller the damage a
  // wrong declaration can do to a third party.
  const method = String(raw.method || "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const headers = {};
  const hsrc = (raw.headers && typeof raw.headers === "object" && !Array.isArray(raw.headers)) ? raw.headers : {};
  for (const [k, v] of Object.entries(hsrc).slice(0, 12)) {
    if (!/^[A-Za-z][A-Za-z0-9-]{0,40}$/.test(k)) continue;
    // Never `host` and never `cookie`: one redirects the request somewhere
    // else at the network layer, the other is not ours to send.
    if (/^(host|cookie|content-length)$/i.test(k)) continue;
    if (typeof v !== "string" || v.length > 500) continue;
    headers[k] = v;
  }
  const params = [...new Set((Array.isArray(raw.params) ? raw.params : [])
    .map((p) => String(p).toLowerCase())
    .filter((p) => /^[a-z][a-z0-9_]{0,40}$/.test(p)))].slice(0, 8);
  const body = method === "POST" && typeof raw.body === "string" ? raw.body.slice(0, 4000) : "";
  let ttl = parseInt(raw.cacheSeconds != null ? raw.cacheSeconds : raw.ttl, 10);
  ttl = Number.isFinite(ttl) ? Math.max(MIN_TTL, Math.min(MAX_TTL, ttl)) : 60;
  return { name, url, method, headers, params, body, ttl };
}

/** Every `{{SECRET}}` this declaration needs, so they can be fetched in one go. */
export function secretsNeeded(api) {
  const found = new Set();
  const scan = (s) => {
    // `param.` matches neither pattern's alphabet, so the two cannot collide —
    // secrets are upper-case and parameters are lower-case with a prefix.
    for (const m of String(s || "").matchAll(SECRET_RE)) found.add(m[1]);
  };
  scan(api.url); scan(api.body);
  for (const v of Object.values(api.headers || {})) scan(v);
  return [...found];
}

/**
 * Fill in the blanks.
 *
 * A MISSING SECRET REFUSES rather than substituting an empty string. Sent
 * empty, `Authorization: Bearer ` is a request some APIs answer 200 to with
 * public or degraded data — so the page would render something plausible and
 * wrong, which is worse than an error the owner can see and fix.
 *
 * Parameters are URL-ENCODED on the way in. Unencoded, a `&` in a postcode
 * field appends a query parameter of the caller's choosing to the owner's
 * request — the injection this substitution exists to make impossible.
 */
export function fill(text, { secrets, params }) {
  let missing = null;
  let out = String(text || "").replace(PARAM_RE, (_, p) => {
    const v = params && Object.prototype.hasOwnProperty.call(params, p.toLowerCase()) ? params[p.toLowerCase()] : "";
    return encodeURIComponent(String(v == null ? "" : v));
  });
  out = out.replace(SECRET_RE, (whole, name) => {
    const v = secrets && secrets[name];
    if (typeof v !== "string" || !v) { missing = missing || name; return whole; }
    return v;
  });
  return { text: out, missing };
}

/** Only the parameters the declaration named, capped and stringified. */
export function takeParams(api, search) {
  const out = {};
  for (const p of api.params || []) {
    const v = search && typeof search.get === "function" ? search.get(p) : (search && search[p]);
    if (v == null) continue;
    out[p] = String(v).slice(0, 200);
  }
  return out;
}

/**
 * Everything about a declaration that decides WHAT REQUEST IS MADE.
 *
 * This is the half of the cache key nothing had before, and its absence was a
 * live bug rather than an omission: the key was `slug|name|params`, so changing
 * a declaration's URL, method, headers or body left the key untouched and the
 * site kept serving answers from the OLD endpoint for as long as the window
 * lasted — up to an hour. Change a courier's endpoint or rotate onto a different
 * pricing feed and the page shows the previous service's data, with nothing to
 * explain it and nothing the owner can do but wait.
 *
 * `ttl` IS IN IT, and that is a decision rather than an oversight. Shortening
 * `cacheSeconds` is what an owner does when they discover the data moves faster
 * than they thought, and honouring the old window for the rest of it is exactly
 * the thing they were trying to stop. The cost is that a cache-window tweak
 * drops the entries, which is one extra upstream call.
 *
 * CANONICAL, so a cosmetic edit is not a cache flush: header names are compared
 * case-insensitively (`Authorization` and `authorization` are one header on the
 * wire) and both headers and parameters are sorted, so reordering them in the
 * declaration changes nothing. And it is JSON rather than a joined string —
 * escaping makes it injective, so no body containing a separator can be made to
 * look like a different declaration.
 */
export function declFingerprint(api) {
  const h = Object.keys(api.headers || {})
    .map((k) => [String(k).toLowerCase(), api.headers[k]])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : 1)));
  return JSON.stringify([api.method, api.url, h, api.body || "", [...(api.params || [])].sort(), api.ttl]);
}

async function sha256Hex(c, s) {
  const buf = await c.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * What distinguishes one cached answer from another.
 *
 * SIX THINGS, and every one of them earns its place:
 *
 *   ownerId    A SLUG IS RE-CLAIMABLE. Delete a site and the name is free, so
 *              without this a cached answer fetched with one account's API key
 *              is served to whoever takes the slug next. The same window the
 *              webhook queue's `sameOwner` closes, one feature over.
 *   slug       two sites of one owner are two sites.
 *   name       the declaration being called.
 *   method     REDUNDANT AND KEPT, and it says so rather than looking
 *              load-bearing: the fingerprint already carries the method, so a
 *              mutation removing this field changes no answer — measured, not
 *              assumed. It stays because a GET and a POST answering from one
 *              entry is the most surprising thing this cache could do, and the
 *              only other place that is ruled out is inside an opaque digest.
 *              A key somebody can read beats a byte saved.
 *   decl       the fingerprint above — a changed configuration never answers
 *              from the old one.
 *   params     the caller's own values, which is all a visitor may decide.
 *
 * The declaration is HASHED and nothing else is: it is up to ~11 KB (a 1 KB
 * URL, twelve 500-byte headers, a 4 KB body) and this key is held in memory for
 * up to 2,000 entries. The rest stays legible, which is what makes a key
 * debuggable at all.
 *
 * ANSWERS `null` WHEN IT CANNOT BUILD A SAFE KEY — no owner, or no WebCrypto —
 * and `callApi` then skips the cache entirely. That is the only fail-safe
 * direction: falling back to a shorter key would be a shared key, which is the
 * exact leak the owner is in here to prevent. Uncached is slower; shared is
 * somebody else's data.
 */
export async function cacheKey({ ownerId, slug, api, params }, subtle) {
  const c = subtle || (globalThis.crypto && globalThis.crypto.subtle);
  if (!c || !ownerId) return null;
  const decl = await sha256Hex(c, declFingerprint(api));
  const vals = [...(api.params || [])].sort()
    .map((p) => p + "=" + (params && params[p] != null ? params[p] : ""));
  return [String(ownerId), slug, api.name, api.method, decl, vals.join("&")].join("|");
}

/**
 * Perform the read.
 *
 * `{status, body, contentType}` back, and NOTHING ELSE from upstream. Passing
 * their headers through would forward `set-cookie` onto our origin and can echo
 * the key back in a rate-limit or debug header — the credential leaving by the
 * door it came in through.
 */
export async function callApi(deps, { ownerId, slug, api, params, now }) {
  // `null` when the owner is unknown or WebCrypto is missing, and then nothing
  // is read from the cache and nothing is written to it — see `cacheKey`. The
  // read still works; it just costs the owner an upstream call.
  const key = await cacheKey({ ownerId, slug, api, params }, deps.subtle);
  if (key && api.ttl > 0 && deps.cacheGet) {
    const hit = await deps.cacheGet(key);
    // Whole, and only ever a 2xx — nothing else is written (see below), so an
    // error is never served from here however many times a page asks.
    if (hit) return { ...hit, cached: true };
  }

  const url = fill(api.url, { secrets: deps.secrets, params });
  if (url.missing) return { status: 503, body: { error: "this site's connection to that service isn't set up yet" }, missing: url.missing };

  // CHECKED AT FIRE TIME, against the URL that is actually about to be
  // requested — the same reasoning the outbound webhook guard uses. A
  // declaration validated only at build time is checked against wherever the
  // name resolved that day, which is the whole of DNS rebinding.
  const why = deps.blockedReason ? deps.blockedReason(url.text) : blockedReason(url.text);
  if (why) return { status: 502, body: { error: "that service can't be reached from here" }, refused: why };

  const headers = {};
  for (const [k, v] of Object.entries(api.headers || {})) {
    const f = fill(v, { secrets: deps.secrets, params });
    if (f.missing) return { status: 503, body: { error: "this site's connection to that service isn't set up yet" }, missing: f.missing };
    headers[k] = f.text;
  }
  let body;
  if (api.method === "POST") {
    const f = fill(api.body, { secrets: deps.secrets, params });
    if (f.missing) return { status: 503, body: { error: "this site's connection to that service isn't set up yet" }, missing: f.missing };
    body = f.text;
    if (!headers["Content-Type"] && !headers["content-type"]) headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    // `redirect: "manual"`, NOT "follow" — a followed redirect is an SSRF guard
    // that checks the first hop and none of the others. The host was validated
    // before this call; a 302 to `http://169.254.169.254/` or to any internal
    // address would be fetched WITH the owner's API key attached, and neither
    // the guard nor this function would ever see that URL. The sibling webhook
    // path (`emitWebhook`) already refuses redirects for exactly this reason.
    //
    // Refused rather than re-validated per hop: a third-party read that
    // redirects is a misconfigured endpoint, and telling the owner so beats
    // silently chasing it. Fetching a `Location` we then validate is also the
    // strictly more complicated option for no case anybody has asked for.
    res = await deps.fetch(url.text, { method: api.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    // THE NAME, NEVER THE MESSAGE, and here it is not a style choice: the URL
    // may carry the key in a query string, and an exception message quotes the
    // request. Same rule as the Turnstile verifier.
    return { status: 504, body: { error: "that service didn't answer in time" }, reason: String((e && e.name) || "error").slice(0, 40) };
  }

  // A redirect never becomes a second request. `manual` surfaces the 3xx here
  // rather than following it, and the status is reported so an owner can see
  // their endpoint moved instead of getting an empty body they cannot explain.
  if (res.status >= 300 && res.status < 400) {
    return { status: 502, body: { error: "that service redirected, which this connection does not follow" }, upstream: res.status };
  }
  const text = await res.text().catch(() => "");
  if (text.length > MAX_RESPONSE) {
    return { status: 502, body: { error: "that service sent back more than this page can use" } };
  }
  const ct = String(res.headers && res.headers.get ? (res.headers.get("content-type") || "") : "");
  let parsed = text;
  if (/json/i.test(ct)) { try { parsed = JSON.parse(text); } catch { parsed = text; } }

  const out = { status: res.status, body: parsed, contentType: /json/i.test(ct) ? "application/json" : "text/plain" };
  // ONLY A SUCCESS IS CACHED. A 500 held for an hour turns somebody else's
  // thirty-second blip into an hour of a broken page, and there is nothing the
  // owner can do about it but wait. A 4xx is not cached either — that is
  // usually a key that has just been fixed.
  if (key && api.ttl > 0 && deps.cacheSet && res.status >= 200 && res.status < 300) {
    await deps.cacheSet(key, out, api.ttl * 1000, now);
  }
  return out;
}

/** The declaration for `name`, if the site has one. */
export function apiFor(spec, name) {
  const want = String(name || "").toLowerCase();
  const list = (spec && Array.isArray(spec.apis) ? spec.apis : []);
  const found = list.find((a) => a && String(a.name).toLowerCase() === want);
  return found ? normalizeApi(found) : null;
}
