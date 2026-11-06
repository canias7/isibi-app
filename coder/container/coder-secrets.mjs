// NETWORK SECRETS: the plain checks shared by the Worker and the container
// (owner, 2026-11-06). No Node modules here, so the Worker can use it too.
export const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
// THE HEADER A KEY GOES IN (the audit, 2026-11-06): Authorization, or a name that
// ends in key/token/auth/secret (X-Api-Key, Xi-Api-Key, X-Auth-Token…), like
// Claude Code. Never a header a website copies back (Origin, Host, Referer…).
export const HEADER_RE = /^(authorization|([a-z0-9]{1,16}-){0,4}(key|apikey|token|auth|secret|credential|credentials))$/i;
/** A key the owner may save: printable characters only (no spaces inside, nothing a header cannot carry). */
export const KEY_RE = /^[\x21-\x7e]{1,4000}$/;
export const PREFIXES = ["", "Bearer", "Token", "Key", "Basic"];

/** A host name the owner may save a secret for: an exact public DNS name (no IP, no wildcard, no internal name). */
export function okHost(h) {
  const s = String(h || "").trim().toLowerCase();
  if (!HOST_RE.test(s)) return null;
  if (/^[0-9.]+$/.test(s)) return null; // an IPv4 address
  if (/(^|\.)(localhost|local|internal|lan|home|corp|arpa)$/.test(s)) return null;
  return s;
}

/** The header value from what the owner saved: the key, with its prefix word if any. */
export function headerValue({ value, prefix }) {
  const v = String(value || "").replace(/[^\x21-\x7e]/g, "");
  const p = PREFIXES.includes(prefix) ? prefix : "";
  // Basic: most APIs (Stripe…) take the key as the user name with no password.
  if (p === "Basic") return "Basic " + btoa(v.includes(":") ? v : v + ":");
  return (p ? p + " " : "") + v;
}
