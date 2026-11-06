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

// THE REPO'S NETWORK LIST (owner, 2026-11-06, like Claude Code's "Limited"
// access): package sites are always allowed, like Claude Code's default list.
export const PACKAGE_HOSTS = ["registry.npmjs.org", "registry.yarnpkg.com", "nodejs.org", "pypi.org", "files.pythonhosted.org", "github.com", "codeload.github.com", "objects.githubusercontent.com", "raw.githubusercontent.com", "api.github.com", "crates.io", "static.crates.io", "index.crates.io", "proxy.golang.org", "sum.golang.org", "rubygems.org", "repo.maven.apache.org", "repo1.maven.org", "deb.debian.org", "security.debian.org"];
/** A site pattern: an exact host, or "*.example.com" (that site and every subdomain), like Claude Code's. */
export function okPattern(p) {
  const s = String(p || "").trim().toLowerCase();
  if (s.startsWith("*.")) { const h = okHost(s.slice(2)); return h && h.includes(".") ? "*." + h : null; }
  return okHost(s);
}
export function hostMatches(host, pattern) {
  const h = String(host || "").toLowerCase();
  if (pattern.startsWith("*.")) { const base = pattern.slice(2); return h === base || h.endsWith("." + base); }
  return h === pattern;
}
/** The network setting, old or new: { mode: full | limited | none, hosts }. */
export function normNetwork(n) {
  const mode = n && ["full", "limited", "none"].includes(n.mode) ? n.mode : n && n.limited ? "limited" : "full";
  return { mode, hosts: (n && Array.isArray(n.hosts) ? n.hosts : []).map(okPattern).filter(Boolean).slice(0, 100) };
}
/** Is `host` reachable under this network setting? (`extra`: site patterns of saved secrets) */
export function hostAllowed(host, network, extra = []) {
  const n = normNetwork(network);
  if (n.mode === "full") return true;
  if (n.mode === "none") return false;
  const h = String(host || "").toLowerCase();
  return PACKAGE_HOSTS.includes(h) || [...n.hosts, ...extra].some((p) => hostMatches(h, p));
}

// A SECRET (owner, 2026-11-06, like Claude Code's "Add secret"): a name, the
// sites it applies to, optional path prefixes, and one or more headers.
export const PATH_RE = /^\/[\x21-\x7e]{0,200}$/;
/** Any saved secret, old ({ host, value, header, prefix }) or new, as { id, name, hosts, paths, headers }. */
export function normSecret(s) {
  if (!s || typeof s !== "object") return null;
  const hosts = (Array.isArray(s.hosts) ? s.hosts : s.host ? [s.host] : []).map(okPattern).filter(Boolean).slice(0, 20);
  const headers = (Array.isArray(s.headers) ? s.headers : s.value ? [{ name: s.header || "Authorization", prefix: s.prefix === undefined ? "Bearer" : s.prefix, value: s.value }] : [])
    .filter((h) => h && HEADER_RE.test(String(h.name || "")) && PREFIXES.includes(h.prefix || "") && KEY_RE.test(String(h.value || "")))
    .map((h) => ({ name: String(h.name), prefix: h.prefix || "", value: String(h.value) })).slice(0, 5);
  if (!hosts.length || !headers.length) return null;
  const paths = (Array.isArray(s.paths) ? s.paths : []).map((x) => String(x).trim()).filter((x) => PATH_RE.test(x)).slice(0, 10);
  return { id: String(s.id || hosts[0]).slice(0, 80), name: String(s.name || "").slice(0, 60), hosts, paths, headers, at: s.at || 0 };
}

// ENVIRONMENT VARIABLES IN .env FORM (owner, 2026-11-06, like Claude Code's box).
export function parseEnv(text) {
  const out = {}; const src = String(text || "").replace(/\r/g, "");
  const re = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^\n#]*?)\s*(?:#.*)?$/gm;
  let m, n = 0;
  while ((m = re.exec(src)) && n < 50) {
    let v = m[2];
    if (v.startsWith('"')) v = v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    else if (v.startsWith("'")) v = v.slice(1, -1);
    out[m[1]] = v.slice(0, 4000); n++;
  }
  return out;
}
export function toEnv(vars) {
  return Object.entries(vars || {}).map(([k, v]) => k + "=" + (/[\s#"'\\]/.test(String(v)) || String(v) === "" ? '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"' : String(v))).join("\n");
}
