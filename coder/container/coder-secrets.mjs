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

// THE DEFAULT LIST ("Trusted"), from Claude Code's cloud-environment docs
// (code.claude.com/docs/en/cloud-environments, read 2026-11-06): package
// registries, GitHub and other code hosts, container registries, cloud SDKs.
export const DEFAULT_HOSTS = [
  // version control
  "github.com", "api.github.com", "npm.pkg.github.com", "raw.githubusercontent.com", "pkg-npm.githubusercontent.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "codeload.github.com", "avatars.githubusercontent.com", "camo.githubusercontent.com", "gist.github.com", "gitlab.com", "registry.gitlab.com", "bitbucket.org", "api.bitbucket.org",
  // container registries
  "registry-1.docker.io", "auth.docker.io", "index.docker.io", "hub.docker.com", "download.docker.com", "www.docker.com", "production.cloudflare.docker.com", "production.cloudfront.docker.com", "gcr.io", "*.gcr.io", "ghcr.io", "mcr.microsoft.com", "*.data.mcr.microsoft.com", "public.ecr.aws",
  // cloud platforms
  "cloud.google.com", "gcloud.google.com", "accounts.google.com", "*.googleapis.com", "azure.com", "portal.azure.com", "microsoft.com", "www.microsoft.com", "*.microsoftonline.com", "packages.microsoft.com", "dotnet.microsoft.com", "dot.net", "visualstudio.com", "dev.azure.com", "*.amazonaws.com", "*.api.aws", "oracle.com", "www.oracle.com", "java.com", "java.net", "download.oracle.com", "yum.oracle.com", "*.r2.cloudflarestorage.com",
  // JavaScript
  "registry.npmjs.org", "npmjs.com", "www.npmjs.com", "npmjs.org", "yarnpkg.com", "registry.yarnpkg.com", "jsr.io", "npm.jsr.io",
  // Python
  "pypi.org", "files.pythonhosted.org", "pythonhosted.org", "test.pypi.org", "pypi.python.org", "pypa.io",
  // Ruby
  "rubygems.org", "api.rubygems.org", "index.rubygems.org", "ruby-lang.org", "www.ruby-lang.org", "rubyforge.org", "rubyonrails.org", "rvm.io", "get.rvm.io",
  // Rust
  "crates.io", "index.crates.io", "static.crates.io", "rustup.rs", "static.rust-lang.org", "sh.rustup.rs",
  // Go
  "proxy.golang.org", "sum.golang.org", "index.golang.org", "golang.org", "go.dev", "goproxy.io", "pkg.go.dev",
  // JVM
  "maven.org", "repo.maven.org", "central.maven.org", "repo1.maven.org", "repo.maven.apache.org", "maven.google.com", "jcenter.bintray.com", "gradle.org", "services.gradle.org", "plugins.gradle.org", "plugins-artifacts.gradle.org", "kotlinlang.org", "spring.io", "repo.spring.io",
  // other package managers
  "packagist.org", "repo.packagist.org", "nuget.org", "api.nuget.org", "pub.dev", "api.pub.dev", "hex.pm", "cpan.org", "metacpan.org", "api.metacpan.org", "cocoapods.org", "cdn.cocoapods.org", "haskell.org", "hackage.haskell.org", "swift.org",
  // Linux
  "archive.ubuntu.com", "security.ubuntu.com", "ubuntu.com", "*.ubuntu.com", "ppa.launchpad.net", "launchpad.net", "*.nixos.org", "deb.debian.org", "security.debian.org",
  // dev tools
  "dl.k8s.io", "pkgs.k8s.io", "k8s.io", "releases.hashicorp.com", "apt.releases.hashicorp.com", "rpm.releases.hashicorp.com", "archive.releases.hashicorp.com", "hashicorp.com", "repo.anaconda.com", "conda.anaconda.org", "anaconda.org", "anaconda.com", "continuum.io", "apache.org", "archive.apache.org", "downloads.apache.org", "eclipse.org", "download.eclipse.org", "nodejs.org", "developer.apple.com", "developer.android.com", "pkg.stainless.com", "binaries.prisma.sh",
  // monitoring, mirrors, schemas
  "http-intake.logs.datadoghq.com", "*.datadoghq.com", "*.datadoghq.eu", "api.honeycomb.io", "sourceforge.net", "*.sourceforge.net", "packagecloud.io", "*.packagecloud.io", "fonts.googleapis.com", "fonts.gstatic.com", "json-schema.org", "www.json-schema.org", "json.schemastore.org", "www.schemastore.org", "*.modelcontextprotocol.io",
  // THE REST OF CLAUDE CODE'S LIST (owner, 2026-11-07, item 7: the "www." versions, Anthropic's own sites,
  // and Google Cloud's named hosts): checked whole against its docs, test/fixtures/claude-code-trusted.txt (CD156).
  "anthropic.com", "api.anthropic.com", "claude.ai", "claude.com", "code.claude.com", "compute.googleapis.com", "container.googleapis.com", "docs.claude.com", "platform.claude.com", "storage.googleapis.com", "support.claude.com", "www.anaconda.com", "www.anthropic.com", "www.apache.org", "www.bitbucket.org", "www.cocoapods.org", "www.cpan.org", "www.crates.io", "www.eclipse.org", "www.github.com", "www.gitlab.com", "www.golang.org", "www.gradle.org", "www.hashicorp.com", "www.haskell.org", "www.hex.pm", "www.java.com", "www.java.net", "www.k8s.io", "www.kotlinlang.org", "www.launchpad.net", "www.metacpan.org", "www.nodejs.org", "www.npmjs.org", "www.nuget.org", "www.packagist.org", "www.pypa.io", "www.pypi.org", "www.rubyforge.org", "www.rubygems.org", "www.rubyonrails.org", "www.rust-lang.org", "www.swift.org", "www.ubuntu.com",
];
export const PACKAGE_HOSTS = DEFAULT_HOSTS; // the older name
// NEVER GIVEN A KEY (Claude Code's docs): package registries and GitHub, even if a secret lists them.
export const NEVER_KEY = ["github.com", "api.github.com", "registry.npmjs.org", "jsr.io", "npm.jsr.io", "pypi.org", "files.pythonhosted.org", "index.crates.io", "proxy.golang.org", "api.anthropic.com"];

/** A site pattern: an exact host, or "*.example.com" (that site and every subdomain), like Claude Code's. */
export function okPattern(p) {
  const s = String(p || "").trim().toLowerCase();
  if (s.startsWith("*.")) { const h = okHost(s.slice(2)); return h && h.includes(".") ? "*." + h : null; }
  return okHost(s);
}
export function hostMatches(host, pattern) {
  const h = String(host || "").toLowerCase();
  // ONLY A REAL HOST NAME MATCHES (the audit, 2026-11-06): "../../x.example.com"
  // also ends with ".example.com", so it counted as a subdomain of "*.example.com"
  // and the proxy gave it the key and built file names from it.
  if (!HOST_RE.test(h)) return false;
  if (pattern.startsWith("*.")) { const base = pattern.slice(2); return h === base || h.endsWith("." + base); }
  return h === pattern;
}
/**
 * The network setting (like Claude Code's four levels): { mode: none | trusted
 * | full | custom, hosts, defaults }. "custom" is your own list, plus the
 * default list when `defaults` is on. Older settings: limited → custom + defaults.
 */
export const NET_MODES = ["none", "trusted", "full", "custom"];
export function normNetwork(n) {
  let mode = n && NET_MODES.includes(n.mode) ? n.mode : n && (n.mode === "limited" || n.limited) ? "custom" : n && n.limited === false && !n.mode ? "full" : "trusted";
  const defaults = n && typeof n.defaults === "boolean" ? n.defaults : true;
  // (Its blocked sites, only when it has some: an environment without them is as it was, its setup copy too.)
  const denied = [...new Set((n && Array.isArray(n.denied) ? n.denied : []).map(okPattern).filter(Boolean))].slice(0, 100);
  return { mode, hosts: (n && Array.isArray(n.hosts) ? n.hosts : []).map(okPattern).filter(Boolean).slice(0, 100), defaults, ...(denied.length ? { denied } : {}) };
}
/**
 * A SITE ON THE ENVIRONMENT'S BLOCKED LIST (Bash docs pass 6, the owner, 2026-11-10: "yea do all of them"; Claude Code's
 * sandbox.network.deniedDomains: "Domains that are always blocked, even if matched by allowedDomains"; "A connection to a
 * host in deniedDomains is refused in every permission mode"): refused in every network setting, Full included, and for a
 * site with a saved key too.
 */
export function hostDenied(host, network) {
  const n = normNetwork(network);
  const h = String(host || "").toLowerCase();
  return !!n.denied && n.denied.some((p) => hostMatches(h, p));
}
/** Whether a network setting needs the gate in the way: anything but Full, or Full with blocked sites. */
export const netWalled = (network) => { const n = normNetwork(network); return n.mode !== "full" || !!(n.denied && n.denied.length); };
/** Is `host` reachable under this setting? Sites with a saved key always are (Claude Code's docs: "even when the network level would not otherwise allow them"). */
export function hostAllowed(host, network, keyed = []) {
  const n = normNetwork(network);
  const h = String(host || "").toLowerCase();
  if (hostDenied(h, n)) return false;
  if (keyed.some((p) => hostMatches(h, p))) return true;
  if (n.mode === "full") return true;
  if (n.mode === "none") return false;
  const inDefaults = DEFAULT_HOSTS.some((p) => hostMatches(h, p));
  if (n.mode === "trusted") return inDefaults;
  return (n.defaults && inDefaults) || n.hosts.some((p) => hostMatches(h, p));
}
/** May a key ever be added for this host? */
export const keyAllowed = (host) => !NEVER_KEY.includes(String(host || "").toLowerCase());

// A SECRET (owner, 2026-11-06, like Claude Code's "Add secret"): a name, the
// sites it applies to, optional path prefixes, and one or more headers.
export const PATH_RE = /^\/[\x21-\x7e]{0,200}$/;
// SECRET TYPES (owner, 2026-11-06, "7": like Claude Code's): headers (Bearer,
// API key, Basic, your own), a body parameter, OAuth 2.0 client credentials, a
// Google Cloud service account, AWS SigV4.
export const SECRET_KINDS = ["headers", "body", "oauth", "gcp", "aws"];
const str = (v, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** The type-specific settings, checked; null when something needed is missing. */
export function normConfig(kind, c) {
  c = c && typeof c === "object" ? c : {};
  if (kind === "body") { const param = str(c.param, 100), value = str(c.value); return /^[A-Za-z0-9_.-]{1,100}$/.test(param) && KEY_RE.test(value) ? { param, value } : null; }
  if (kind === "oauth") {
    const tokenUrl = str(c.tokenUrl, 500), clientId = str(c.clientId, 500), clientSecret = str(c.clientSecret), scope = str(c.scope, 500);
    let u; try { u = new URL(tokenUrl); } catch { return null; }
    return u.protocol === "https:" && okHost(u.hostname) && clientId && KEY_RE.test(clientSecret) ? { tokenUrl, clientId, clientSecret, scope } : null;
  }
  if (kind === "gcp") {
    let k; try { k = JSON.parse(str(c.keyJson, 20000)); } catch { return null; }
    if (!k || k.type !== "service_account" || typeof k.client_email !== "string" || typeof k.private_key !== "string" || !/BEGIN (RSA )?PRIVATE KEY/.test(k.private_key)) return null;
    return { keyJson: JSON.stringify({ type: k.type, client_email: k.client_email, private_key: k.private_key, private_key_id: k.private_key_id || "", token_uri: "https://oauth2.googleapis.com/token" }), scope: str(c.scope, 500) || "https://www.googleapis.com/auth/cloud-platform" };
  }
  if (kind === "aws") {
    const accessKeyId = str(c.accessKeyId, 200), secretAccessKey = str(c.secretAccessKey), sessionToken = str(c.sessionToken, 4000), region = str(c.region, 50), service = str(c.service, 50);
    return /^[A-Z0-9]{12,128}$/.test(accessKeyId) && KEY_RE.test(secretAccessKey) && /^[a-z0-9-]{2,50}$/.test(region) && /^[a-z0-9-]{1,50}$/.test(service) && (!sessionToken || KEY_RE.test(sessionToken)) ? { accessKeyId, secretAccessKey, sessionToken, region, service } : null;
  }
  return null;
}
/** The secret values of a config (to hide them in the chat). */
export const configSecrets = (kind, c) => !c ? [] : kind === "body" ? [c.value] : kind === "oauth" ? [c.clientSecret] : kind === "gcp" ? [JSON.parse(c.keyJson).private_key] : kind === "aws" ? [c.secretAccessKey, c.sessionToken].filter(Boolean) : [];
/** Any saved secret, old ({ host, value, header, prefix }) or new, as { id, name, kind, hosts, paths, headers, config }. */
export function normSecret(s) {
  if (!s || typeof s !== "object") return null;
  const hosts = (Array.isArray(s.hosts) ? s.hosts : s.host ? [s.host] : []).map(okPattern).filter(Boolean).slice(0, 20);
  const kind = SECRET_KINDS.includes(s.kind) ? s.kind : "headers";
  const headers = kind !== "headers" ? [] : (Array.isArray(s.headers) ? s.headers : s.value ? [{ name: s.header || "Authorization", prefix: s.prefix === undefined ? "Bearer" : s.prefix, value: s.value }] : [])
    .filter((h) => h && HEADER_RE.test(String(h.name || "")) && PREFIXES.includes(h.prefix || "") && KEY_RE.test(String(h.value || "")))
    .map((h) => ({ name: String(h.name), prefix: h.prefix || "", value: String(h.value) })).slice(0, 5);
  const config = kind === "headers" ? null : normConfig(kind, s.config);
  if (!hosts.length || (kind === "headers" ? !headers.length : !config)) return null;
  const paths = (Array.isArray(s.paths) ? s.paths : []).map((x) => String(x).trim()).filter((x) => PATH_RE.test(x)).slice(0, 10);
  return { id: String(s.id || hosts[0]).slice(0, 80), name: String(s.name || "").slice(0, 60), kind, hosts, paths, headers, config, at: s.at || 0 };
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
