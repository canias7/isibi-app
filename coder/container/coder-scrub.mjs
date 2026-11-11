// THE SUBPROCESS ENVIRONMENT SCRUB AND THE SCRIPT CAPS (Bash docs pass 6, the owner, 2026-11-10: "yea do all of them"):
// Claude Code's CLAUDE_CODE_SUBPROCESS_ENV_SCRUB and CLAUDE_CODE_SCRIPT_CAPS, here the environment's
// CODER_SUBPROCESS_ENV_SCRUB and CODER_SCRIPT_CAPS.
//
// The scrub (Claude Code's env-vars docs: "removes credentials from the environments of the subprocesses it starts, such as
// Bash commands, hooks … This reduces what a prompt injection attack can read"; "The scrub recognizes a credential by its
// variable name or by the shape of its value"): the names and value shapes below are Claude Code 2.1.322's own; it "leaves
// GITHUB_TOKEN, GH_TOKEN, GH_ENTERPRISE_TOKEN, GITHUB_ENTERPRISE_TOKEN in place", the proxy settings, and git's
// GIT_CONFIG_COUNT/KEY_<n>/VALUE_<n>; a package index URL keeps its address without its user and password. Coder's own
// saved keys never reach the commands anyway (the gate adds them on the way out): this is for keys the owner typed in as
// plain variables, and for a repository's env.
//
// No node: modules here (the tests load it plainly).

/** Claude Code's credential words (its scrub's name check), whole words of a name. */
const WORDS = ["TOKEN", "SECRET", "PASSWORD", "PASSWD", "PASSPHRASE", "KEY", "AUTH", "COOKIE", "PAT", "DSN", "WEBHOOK", "CREDENTIAL", "CREDENTIALS", "CREDS", "APIKEY", "ACCESSKEY", "SECRETKEY", "ACCOUNTKEY", "PRIVATEKEY", "AUTHKEY", "SSHKEY", "SIGNINGKEY", "MASTERKEY", "DEPLOYKEY", "ENCRYPTIONKEY", "PGPASSWORD", "SSHPASS"];
const AFTER_US = ["PWD", "PASS", "JWT"], ANYWHERE = ["TOKEN", "SECRET", "PASSWORD", "PASSWD", "PASSPHRASE"], PLURAL = ["KEY", "SECRET", "PASSWORD", "CREDENTIAL"];
/** A name that looks like a credential's (Claude Code's own pattern). */
export const CREDENTIAL_NAME = new RegExp("((^|_)(" + WORDS.join("|") + "|(" + PLURAL.join("|") + ")S)|_(" + AFTER_US.join("|") + ")|(" + ANYWHERE.join("|") + "))(?=$|[_0-9])", "i");
/** A connection string's name (DATABASE_CONNECTION_STRING, ConnStr…). */
const CONN = /CONN(ECT(ION)?)?_?STR(ING)?S?(?=$|[_0-9])/i;
const camel = (e) => ["OAuth", "NextAuth"].reduce((n, r) => n.split(r).join(r[0] + r.slice(1).toLowerCase()), String(e)).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2");
/** Kept whatever they hold (Claude Code: "so that gh and scripts that call the GitHub API keep working"; the proxy; git's config). */
const GITHUB_KEPT = new Set(["GITHUB_TOKEN", "GH_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"]);
const PROXY_NAME = /^(?:(?:https?|ftp|all|no)_proxy|npm_config_(?:https?_)?proxy|npm_config_noproxy|yarn_proxy|(?:yarn|global_agent|docker|claude_code)_(?:https?|no)_proxy|cloudsdk_proxy_[a-z]+|electron_get_use_proxy)$/i;
const GIT_CONFIG = /^GIT_CONFIG_(?:COUNT|PARAMETERS|(?:KEY|VALUE)_[0-9]+)$/;
/** Package index addresses: kept, without a user and password in them (Claude Code: "Keeps the URL and cuts the username and password from it"). */
const INDEX_URLS = new Set(["PIP_INDEX_URL", "PIP_EXTRA_INDEX_URL", "PIP_FIND_LINKS", "UV_INDEX_URL", "UV_EXTRA_INDEX_URL", "UV_DEFAULT_INDEX", "UV_INDEX", "UV_FIND_LINKS", "UV_PUBLISH_URL", "TWINE_REPOSITORY_URL", "FLIT_INDEX_URL", "HATCH_INDEX_REPO", "NPM_CONFIG_REGISTRY", "YARN_REGISTRY", "YARN_NPM_REGISTRY_SERVER", "YARN_NPM_PUBLISH_REGISTRY", "COREPACK_NPM_REGISTRY", "BUN_CONFIG_REGISTRY", "GOPROXY"]);
const INDEX_URL_RE = /^(?:CARGO_REGISTRIES_[A-Z0-9_]+_INDEX|POETRY_REPOSITORIES_[A-Z0-9_]+_URL|NPM_CONFIG_@[^:]+:REGISTRY)$/i;
const upper = (n) => String(n).toUpperCase().replace(/-/g, "_").replace(/^INPUT_/, "");
export const indexUrlName = (n) => INDEX_URLS.has(upper(n)) || INDEX_URL_RE.test(upper(n));

/** A variable Claude Code leaves in place whatever it holds: a GitHub token, a proxy setting, git's config. */
export const keptName = (name) => { const n = String(name || ""); return GITHUB_KEPT.has(upper(n)) || PROXY_NAME.test(n) || GIT_CONFIG.test(upper(n)); };
/** Whether a variable's name says it holds a credential (and isn't one Claude Code keeps). */
export function credentialName(name) {
  const n = String(name || "");
  if (keptName(n)) return false;
  return CREDENTIAL_NAME.test(upper(n)) || CONN.test(n) || CONN.test(camel(n));
}
/** A token's shape (Claude Code's: a known prefix, or 20+ characters with letters and digits). */
const TOKEN_PREFIX = /^(?:gh[opusr]_|github_pat_|glpat-|xox[abpr]-|sk-|pk-|AKIA|eyJ|ya29\.|npm_)/;
const tokenish = (s) => TOKEN_PREFIX.test(s) || (s.length >= 20 && /[0-9]/.test(s) && /[a-z]/i.test(s));
/**
 * WHETHER A VALUE LOOKS LIKE A CREDENTIAL (Claude Code: "DATABASE_URL that contains a password: Removes it, because the value
 * looks like a credential"): an address with a user and password in it, or a token as its user; `user:password@host`; a
 * private key; an Authorization header, or a Bearer or Basic one with its token; a token with a known prefix on its own.
 */
export function credentialValue(value) {
  const s = String(value ?? "").slice(0, 8192);
  for (const m of s.matchAll(/[a-z][a-z0-9+.-]*:\/\/([^\s/?#@]+)@[^\s/@]/gi)) { const u = m[1]; if (u.includes(":") || tokenish(u)) return true; }
  // (Not an image pinned by its digest, node:20@sha256:…, nor an npm alias, npm:pkg@1.)
  if (/^[^\s/@:]+:(?!\/\/)(?![\\/])[^\s@]*@[^\s/@]+/.test(s) && !/^[a-z]:[\\/]/i.test(s) && !/^(?:mailto|sips?|xmpp|im|acct|npm):/i.test(s) && !/@sha(?:256|384|512):[0-9a-f]{32,}/i.test(s)) return true;
  if (/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(s)) return true;
  if (/\bauthorization\s*[:=]\s*["']?[a-z][a-z0-9_-]*\s+[A-Za-z0-9._~+/=-]{8,}/i.test(s)) return true;
  if (/\b(?:Bearer|Basic)\s+(?=[A-Za-z._~+/=-]*[0-9]|[A-Za-z0-9.-]*[_~+/=])[A-Za-z0-9._~+/=-]{8,}/.test(s)) return true;
  const t = s.trim();
  return !/\s/.test(t) && t.length >= 16 && TOKEN_PREFIX.test(t);
}
/** An index address without its user and password; null when it has none. */
export function withoutUser(value) {
  const s = String(value ?? "");
  try { const u = new URL(s); if (!u.username && !u.password) return null; u.username = ""; u.password = ""; return u.toString(); } catch { return null; }
}
/**
 * THE SCRUB OF ONE SET OF VARIABLES, in place: a credential's name or value removes the variable; an index address loses
 * its user and password. Answers the names removed (never their values).
 */
export function scrubVars(vars) {
  const gone = [];
  if (!vars || typeof vars !== "object") return gone;
  for (const k of Object.keys(vars)) {
    const v = vars[k];
    if (keptName(k)) continue;
    if (indexUrlName(k)) { const w = withoutUser(v); if (w !== null) vars[k] = w; continue; }
    if (credentialName(k) || credentialValue(v)) { delete vars[k]; gone.push(k); }
  }
  return gone;
}

/**
 * THE SCRIPT CAPS (Claude Code's CLAUDE_CODE_SCRIPT_CAPS: "JSON object limiting how many times specific scripts may be invoked
 * per session when CLAUDE_CODE_SUBPROCESS_ENV_SCRUB is set. Keys are substrings matched against the command text; values are
 * integer call limits"), as Claude Code reads them: a JSON object whose values are numbers and whose keys aren't blank; null
 * for anything else.
 */
export function scriptCapsIn(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const e = JSON.parse(text);
    if (!e || typeof e !== "object" || Array.isArray(e)) return null;
    const out = {};
    for (const [k, v] of Object.entries(e)) if (typeof v === "number" && Number.isFinite(v) && k.trim().length > 0) out[k] = v;
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}
/**
 * ONE COMMAND AGAINST THE CAPS, as Claude Code counts it ("Matching is substring-based so shell-expansion tricks like
 * ./scripts/deploy.sh $(evil) still count against the cap"): each time a key appears in the command counts, and the counts
 * go up even for a command refused; the first key over its cap refuses it, in Claude Code's words. "" when it may run.
 */
export function capHit(command, caps, counts) {
  if (!caps || typeof caps !== "object" || !counts || typeof counts !== "object") return "";
  for (const [s, cap] of Object.entries(caps)) {
    const e = String(command ?? "").split(s).length - 1;
    if (e <= 0) continue;
    const c = (Number(counts[s]) || 0) + e;
    counts[s] = c;
    if (c > cap) return "Script call limit exceeded: " + s + " has been called " + c + " times (cap: " + cap + "). This limit prevents data exfiltration via repeated write operations in untrusted-input workflows.";
  }
  return "";
}
