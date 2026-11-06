// NETWORK SECRETS: the plain checks shared by the Worker and the container
// (owner, 2026-11-06). No Node modules here, so the Worker can use it too.
export const HOST_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
export const HEADER_RE = /^[A-Za-z0-9-]{1,40}$/;
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
  const p = PREFIXES.includes(prefix) ? prefix : "";
  if (p === "Basic") return "Basic " + btoa(String(value));
  return (p ? p + " " : "") + String(value);
}
