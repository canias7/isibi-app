// THE SITE'S SIGNALS (2026-10-26): what the explore tools could only answer
// "unavailable" for, made real for two of them.
//
// 1. CONNECTED SERVICES AND LOGINS, read on demand from what we already store,
//    nothing new recorded. Yes or no, and counts: a secret is judged by the
//    PRESENCE of its name in the site's `_secrets` (the reader selects `name`
//    only, never the cipher, a value or a hint); logins are whether the site's
//    sign-in is set up, how many accounts, how many roles. No user list.
// 2. THE ERROR LOG: `site_errors` in Supabase (`supabase/proposed/site_errors.sql`),
//    one row per (site, fingerprint), counted. Written by the Worker where it
//    sees a site's form send or data write fail, and by the browser reporter
//    through `POST /api/site-errors/<slug>`. Every message is scrubbed before it
//    is stored (emails, phone numbers, tokens, keys), every write is
//    best-effort, bounded and off the visitor's path.
import { redact } from "./explore-site-tools.mjs";

export const SITE_ERRORS_CAP = 500;          // fingerprints kept per site (the RPC evicts the stalest)
export const SITE_ERRORS_DAYS = 30;          // retention (the cron prune)
export const SITE_ERRORS_BODY_MAX = 4096;    // bytes a browser report may carry
export const SITE_ERRORS_PER_IP_MIN = 10;    // browser reports per site + IP a minute
export const SITE_ERRORS_PER_SITE_MIN = 60;  // writes per site a minute, every source, per isolate
export const SITE_ERRORS_IN_FLIGHT = 8;      // writes in flight per isolate
const MESSAGE_CHARS = 300;
const ROUTE_CHARS = 200;
const KIND_CHARS = 40;

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
export const validSlug = (s) => typeof s === "string" && SLUG.test(s);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A phone number: 7+ digits with the usual separators, optionally +country.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,5}\d{2,5}/g;
// Long opaque runs: hex ids, base64, anything token-shaped.
const OPAQUE = /\b[A-Za-z0-9_-]{32,}\b/g;
const QUERY = /([?&][^=\s&#]{1,40})=[^\s&#]*/g;

/** A message with what identifies a person or opens an account taken out. */
export function scrub(s, max = MESSAGE_CHARS) {
  let out = redact(String(s == null ? "" : s));
  out = out.replace(EMAIL, "[email]").replace(QUERY, "$1=[value]").replace(OPAQUE, "[token]");
  out = out.replace(PHONE, (m) => ((m.match(/\d/g) || []).length >= 7 ? "[phone]" : m));
  out = out.replace(/\s+/g, " ").trim();
  return out.length > max ? out.slice(0, max) + "…" : out;
}

/** A route as stored: the path only (no query, no fragment value), scrubbed. */
export function scrubRoute(r) {
  const s = String(r == null ? "" : r).split(/[?#]/)[0] || "/";
  return scrub(s.startsWith("/") ? s : "/" + s, ROUTE_CHARS);
}

const kindOf = (k) => (typeof k === "string" && /^[a-z][a-z0-9_-]{0,39}$/i.test(k) ? k.toLowerCase().slice(0, KIND_CHARS) : "error");

/** The same fault, whatever its numbers: digits fold, so "row 12" and "row 13" are one row. */
export async function fingerprint({ source, kind, route, message }) {
  const norm = [source, kind, route, String(message || "").replace(/\d+/g, "#").toLowerCase()].join("\u0000");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One error, ready to store: every field bounded and scrubbed, or null. */
export async function errorEntry({ source, kind, route, message }) {
  if (source !== "browser" && source !== "server") return null;
  const m = scrub(message);
  if (!m) return null;
  const e = { source, kind: kindOf(kind), route: scrubRoute(route), message: m };
  e.fingerprint = await fingerprint(e);
  return e;
}

/** A browser's report, read as untrusted: only these three fields, each a string. */
export function browserReport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const str = (v) => (typeof v === "string" ? v : "");
  const message = str(body.message);
  if (!message) return null;
  return { source: "browser", kind: str(body.kind) || str(body.source) || "error", route: str(body.route), message };
}

/**
 * THE WRITER, one per isolate. `rpc(entry)` performs the one upsert. Never
 * throws, never awaited on a visitor's path (callers hand the promise to
 * `waitUntil`), and bounded: a site past its minute's budget, or the isolate
 * past its writes in flight, is dropped, not queued.
 */
export function makeErrorRecorder({ rpc, now = () => Date.now(), perSiteMin = SITE_ERRORS_PER_SITE_MIN, inFlight = SITE_ERRORS_IN_FLIGHT } = {}) {
  const windows = new Map();
  let busy = 0;
  return async function record(slug, raw) {
    try {
      if (!validSlug(slug) || typeof rpc !== "function") return "dropped";
      const t = now();
      let w = windows.get(slug);
      if (!w || t - w.at >= 60_000) { w = { at: t, n: 0 }; windows.set(slug, w); }
      if (windows.size > 2000) windows.clear();
      if (w.n >= perSiteMin || busy >= inFlight) return "dropped";
      const e = await errorEntry(raw || {});
      if (!e) return "dropped";
      w.n++;
      busy++;
      try { await rpc(slug, e); return "recorded"; }
      finally { busy--; }
    } catch { return "failed"; }
  };
}

/** The explore tool's answer: the site's errors, newest first, counted. */
export function errorLines(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return "no errors recorded in the last " + SITE_ERRORS_DAYS + " days";
  return list.map((r) => {
    const x = r && typeof r === "object" ? r : {};
    return [String(x.last_seen || "").slice(0, 19), x.source, x.kind, "×" + (Number(x.count) || 1), "first " + String(x.first_seen || "").slice(0, 19), x.route, scrub(x.message)].join(" | ");
  }).join("\n");
}

const has = (names, n) => names.has(n);
/**
 * CONNECTED SERVICES, yes or no, from the names of the site's secrets (never
 * their values) and whether a custom domain is live. `names` is the list the
 * reader got from `select name from _secrets`; anything else on it is ignored.
 */
export function servicesSignal({ secretNames, domainLive } = {}) {
  const known = Array.isArray(secretNames);
  const names = new Set((known ? secretNames : []).filter((n) => typeof n === "string"));
  const yn = (b) => (known ? (b ? "yes" : "no") : "not known");
  return {
    stripe_connected: yn(has(names, "STRIPE_SECRET_KEY")),
    email_key_set: yn(["RESEND_KEY", "SENDGRID_KEY", "POSTMARK_KEY"].some((n) => has(names, n))),
    email_from_set: yn(has(names, "EMAIL_FROM")),
    spam_protection_own_keys: yn(has(names, "TURNSTILE_SECRET") && has(names, "TURNSTILE_SITE_KEY")),
    spam_protection_platform_requested: yn(has(names, "TURNSTILE_PLATFORM")),
    custom_domain_live: domainLive === true ? "yes" : domainLive === false ? "no" : "not known",
  };
}

/** LOGINS: counts only. Sign-in set up, how many accounts, how many roles. */
export function loginsSignal({ authSetUp, accounts, roles } = {}) {
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : "not known");
  return {
    customer_sign_in: authSetUp === true ? "on" : authSetUp === false ? "off" : "not known",
    accounts: n(accounts),
    roles_defined: n(roles),
  };
}
