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
/**
 * A COMMAND'S OWN HOST LIST (Bash docs pass 6, the owner, 2026-11-10: "yea do all of them"; Claude Code's allowed_domains,
 * "Hosts this sandboxed command needs to reach that the sandbox's network allowlist does not already cover"), each entry
 * checked in Claude Code's words: "" when the list is right, else what is wrong with it.
 */
export const LIST_FORMAT = 'Entries must be a domain ("example.com"), a wildcard ("*.example.com"), an IPv4 address, or a bracketed IPv6 address in canonical form ("[::1]", "[2001:db8::1]", not "[2001:0db8::0001]"), any with an optional ":port" suffix (1-65535) \u2014 ASCII letters, digits, "-", "_" and "." only (punycode for international names), nothing else.';
export const LIST_LOOPBACK = "this address names loopback or an IPv4 host under another spelling (an IPv4-mapped or NAT64 IPv6 literal, or the unspecified address); allow the dotted-quad IPv4 address or the real host instead.";
export const LIST_SPELLING = "this entry does not spell the host the sandbox would dial (its canonical form differs); use that form, as the sandbox reports it.";
/** One entry split: { host, port } (port 0: any), or null when its shape is wrong. */
export function listEntry(e) {
  const t = String(e ?? "");
  let host = t, port = 0;
  const v6 = /^\[([0-9a-fA-F:.]+)\](?::(\d{1,5}))?$/.exec(t);
  if (v6) { host = "[" + v6[1] + "]"; port = v6[2] ? Number(v6[2]) : 0; }
  else { const m = /^([A-Za-z0-9_.*-]+)(?::(\d{1,5}))?$/.exec(t); if (!m) return null; host = m[1]; port = m[2] ? Number(m[2]) : 0; }
  if (port && !(port >= 1 && port <= 65535)) return null;
  if (!v6) {
    const name = host.startsWith("*.") ? host.slice(2) : host;
    if (!name || name.includes("*") || name.split(".").some((x) => !x) || !/^[A-Za-z0-9_.-]+$/.test(name)) return null;
  }
  return { host, port };
}
export function listProblem(list) {
  if (!Array.isArray(list)) return "allowed_domains is a list of hosts";
  if (list.length > 100) return "allowed_domains has at most 100 entries";
  for (const e of list) {
    if (typeof e !== "string" || e.length > 260 || !listEntry(e)) return JSON.stringify(String(e)) + ": " + LIST_FORMAT;
    const { host } = listEntry(e);
    const bare = host.startsWith("[") ? host.slice(1, -1).toLowerCase() : host.toLowerCase();
    if (/^0\./.test(bare) && /^\d+\.\d+\.\d+\.\d+$/.test(bare)) return JSON.stringify(e) + ": " + LIST_LOOPBACK;
    if (host.startsWith("[") && (bare === "::" || /^::ffff:/.test(bare) || /^64:ff9b::/.test(bare))) return JSON.stringify(e) + ": " + LIST_LOOPBACK;
    if (e !== e.toLowerCase() || e.endsWith(".") || (host.startsWith("[") && /(^|:)0+[0-9a-f]/.test(bare))) return JSON.stringify(e) + ": " + LIST_SPELLING;
  }
  return "";
}
/** Whether a command's list names a host (and its port), a wildcard covering its subdomains. */
export function listCovers(list, host, port) {
  const h = String(host || "").toLowerCase();
  return (Array.isArray(list) ? list : []).some((e) => { const x = listEntry(e); return !!x && (!x.port || x.port === Number(port)) && hostMatches(h, x.host.toLowerCase()); });
}
/** Whether a network setting needs the gate in the way: anything but Full, or Full with blocked sites. */
export const netWalled = (network) => { const n = normNetwork(network); return n.mode !== "full" || !!(n.denied && n.denied.length); };
/** Is `host` reachable under this setting? Sites with a saved key always are (Claude Code's docs: "even when the network level would not otherwise allow them"). */
export function hostAllowed(host, network, keyed = []) {
  const n = normNetwork(network);
  const h = String(host || "").toLowerCase();
  if (hostDenied(h, n)) return false;
  // (Never a host that gets no key, by a wildcard either: Bash docs pass 9, a key saved for *.github.com had opened
  // github.com, and *.pypi.org pypi.org, on None.)
  if (keyed.some((p) => hostMatches(h, p)) && !NEVER_KEY.includes(h)) return true;
  if (n.mode === "full") return true;
  if (n.mode === "none") return false;
  const inDefaults = DEFAULT_HOSTS.some((p) => hostMatches(h, p));
  if (n.mode === "trusted") return inDefaults;
  return (n.defaults && inDefaults) || n.hosts.some((p) => hostMatches(h, p));
}
/** May a key ever be added for this host? */
export const keyAllowed = (host) => !NEVER_KEY.includes(String(host || "").toLowerCase());
/**
 * A SAVED KEY THAT IS NEVER SENT, AND WHY (Bash docs pass 9, part F; Claude Code's cloud docs: "If the list marks a secret
 * Not sent instead, the note under it says why and what to do. Two secrets whose hosts overlap without matching exactly get
 * no marker, and the agent proxy sends only one of them."): every site the key lists is one that never gets a key (GitHub,
 * the Anthropic API, the public package registries), or one a key saved before it lists exactly (Coder's proxy and server
 * send the first saved key that names a site). "" for a key that is sent. `secrets`: the saved keys, in their saved order.
 */
const GITHUB_KEY_HOSTS = ["github.com", "api.github.com"];
export function notSentWhy(secrets, i) {
  const list = Array.isArray(secrets) ? secrets : [];
  const low = (s) => (s && Array.isArray(s.hosts) ? s.hosts.map((h) => String(h).toLowerCase()) : []);
  const hosts = low(list[i]);
  if (!hosts.length) return "";
  const before = new Set(list.slice(0, Math.max(0, i)).flatMap(low));
  const gh = hosts.filter((h) => GITHUB_KEY_HOSTS.includes(h));
  const reg = hosts.filter((h) => NEVER_KEY.includes(h) && !GITHUB_KEY_HOSTS.includes(h));
  const dup = hosts.filter((h) => !NEVER_KEY.includes(h) && before.has(h));
  if (gh.length + reg.length + dup.length < hosts.length) return "";
  const why = [];
  if (gh.length) why.push("GitHub never gets a saved key: Coder reaches GitHub with your GitHub sign-in, so this key isn't needed there.");
  const anthropic = reg.includes("api.anthropic.com"), registry = reg.some((h) => h !== "api.anthropic.com");
  if (reg.length) why.push((anthropic && registry ? "The Anthropic API and the public package registries never get" : anthropic ? "The Anthropic API never gets" : "Public package registries never get") + " a saved key (" + reg.join(", ") + ")." + (registry ? " For a private registry, save the key for that registry's own site." : ""));
  if (dup.length) why.push("A key saved before this one names the same site" + (dup.length > 1 ? "s" : "") + " (" + dup.join(", ") + "), and only the first key for a site is sent. Delete one of the two, or give this one other sites.");
  return why.join(" ");
}

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
/**
 * THE VARIABLE NAMES COMMANDS NEVER GET FROM THE OWNER'S LIST (safeVars and withoutOtel on Coder's machine; the owner chose
 * to keep them dropped): PATH, HOME, SHELL and USER by their whole names, LD_…, NODE_OPTIONS, BASH_ENV, ENV, SHELLOPTS,
 * BASHOPTS and CDPATH, which steer the machine or where `cd` lands, and OpenTelemetry's (Claude Code deletes every OTEL_*
 * variable from its commands). The page names them under the variables (Bash docs pass 9, part F). CODER_… names are not
 * dropped: they are Coder's own settings.
 */
export const VAR_DROPPED_RE = /^(PATH$|HOME$|SHELL$|USER$|LD_|NODE_OPTIONS$|BASH_ENV$|ENV$|SHELLOPTS$|BASHOPTS$|CDPATH$|OTEL_|CLAUDE_CODE_OTEL_DIAG_STDERR$)/i;
export const varsDropped = (vars) => Object.keys(vars && typeof vars === "object" ? vars : {}).filter((k) => VAR_DROPPED_RE.test(k));
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
