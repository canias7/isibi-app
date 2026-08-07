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

/** What distinguishes one cached answer from another. */
export function cacheKey(slug, api, params) {
  const parts = (api.params || []).map((p) => p + "=" + (params[p] == null ? "" : params[p]));
  return slug + "|" + api.name + "|" + parts.join("&");
}

/**
 * Perform the read.
 *
 * `{status, body, contentType}` back, and NOTHING ELSE from upstream. Passing
 * their headers through would forward `set-cookie` onto our origin and can echo
 * the key back in a rate-limit or debug header — the credential leaving by the
 * door it came in through.
 */
export async function callApi(deps, { slug, api, params, now }) {
  const key = cacheKey(slug, api, params);
  if (api.ttl > 0 && deps.cacheGet) {
    const hit = await deps.cacheGet(key);
    // A cached answer is served whole, including a cached 4xx: a page asking
    // the same wrong question sixty times a second should not become sixty
    // calls on the owner's quota.
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
    res = await deps.fetch(url.text, { method: api.method, headers, body, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    // THE NAME, NEVER THE MESSAGE, and here it is not a style choice: the URL
    // may carry the key in a query string, and an exception message quotes the
    // request. Same rule as the Turnstile verifier.
    return { status: 504, body: { error: "that service didn't answer in time" }, reason: String((e && e.name) || "error").slice(0, 40) };
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
  if (api.ttl > 0 && deps.cacheSet && res.status >= 200 && res.status < 300) {
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
