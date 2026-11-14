/**
 * CLAUDE CODE'S WEBFETCH: ITS PRE-APPROVED DOCUMENTATION SITES AND ITS RULES' DOMAINS (the owner, 2026-11-14: "start fixing
 * and filling in gaps on those tools"; coder-webfetch.mjs has the rest of the tool). Apart from it because Coder's Worker
 * loads the permission rules (coder-perms.mjs) and has no Node modules: nothing here imports one.
 */
// ── CLAUDE CODE'S PRE-APPROVED DOCUMENTATION SITES ───────────────────────────
// Its set (2.1.323 and 2.1.325, the same 96), a host or a host and the start of a path. Claude Code's tools reference: "In
// Manual and acceptEdits permission modes, WebFetch prompts before fetching, except for domains your permission rules
// already allow or deny and a built-in set of preapproved documentation domains".
export const DOC_SITES = Object.freeze(["platform.claude.com", "code.claude.com", "claude.dev", "www.claude.dev", "claude.com/docs", "modelcontextprotocol.io", "github.com/anthropics", "github.com/anthropic-experimental", "raw.githubusercontent.com/anthropics", "raw.githubusercontent.com/anthropic-experimental", "agentskills.io", "docs.python.org", "en.cppreference.com", "docs.oracle.com", "learn.microsoft.com", "developer.mozilla.org", "go.dev/doc", "go.dev/ref", "www.php.net", "docs.swift.org", "kotlinlang.org", "ruby-doc.org", "doc.rust-lang.org", "www.typescriptlang.org", "react.dev", "angular.io", "vuejs.org", "nextjs.org", "expressjs.com", "nodejs.org", "bun.sh", "jquery.com", "getbootstrap.com", "tailwindcss.com", "d3js.org", "threejs.org", "redux.js.org", "webpack.js.org", "jestjs.io", "reactrouter.com", "docs.djangoproject.com", "flask.palletsprojects.com", "fastapi.tiangolo.com", "pandas.pydata.org", "numpy.org", "www.tensorflow.org", "pytorch.org", "scikit-learn.org", "matplotlib.org", "requests.readthedocs.io", "jupyter.org", "laravel.com", "symfony.com", "wordpress.org/documentation", "docs.spring.io", "hibernate.org", "tomcat.apache.org", "gradle.org", "maven.apache.org", "asp.net", "dotnet.microsoft.com", "blazor.net", "reactnative.dev", "docs.flutter.dev", "developer.apple.com", "developer.android.com", "keras.io", "spark.apache.org", "huggingface.co/docs", "www.kaggle.com/docs", "www.mongodb.com", "redis.io", "www.postgresql.org", "dev.mysql.com", "www.sqlite.org", "graphql.org", "prisma.io", "docs.getdbt.com", "docs.aws.amazon.com", "cloud.google.com", "kubernetes.io", "www.docker.com", "www.terraform.io", "www.ansible.com", "vercel.com/docs", "docs.stripe.com", "docs.netlify.com", "devcenter.heroku.com", "dev.wix.com/docs", "cypress.io", "selenium.dev", "docs.unity.com", "docs.unrealengine.com", "git-scm.com", "nginx.org", "httpd.apache.org"]);
const DOC_HOSTS = new Set(DOC_SITES.filter((x) => !x.includes("/")));
const DOC_PATHS = new Map();
for (const x of DOC_SITES) if (x.includes("/")) { const h = x.slice(0, x.indexOf("/")); DOC_PATHS.set(h, [...(DOC_PATHS.get(h) || []), x.slice(x.indexOf("/"))]); }
/**
 * Whether a host and path are one of the sites, as Claude Code decides it: on GitHub, anything under github.com/anthropics,
 * and on github.com/anthropic-experimental a repository's page or its main branch; on raw.githubusercontent.com a file of a
 * main branch; never a path with an encoded "/", "\" or ".".
 */
export function docSitePath(host, path) {
  const h = String(host || ""), p = String(path || "");
  if (DOC_HOSTS.has(h)) return true;
  const starts = DOC_PATHS.get(h);
  if (!starts) return false;
  if (/%(25)*(2f|5c|2e)/i.test(p)) return false;
  for (const s of starts) {
    if (p !== s && !p.startsWith(s + "/")) continue;
    if (h !== "github.com" && h !== "raw.githubusercontent.com") return true;
    if (h + s === "github.com/anthropics") return true;
    return h === "raw.githubusercontent.com" ? /^\/[^/]+\/[^/]+\/refs\/heads\/main\/./.test(p) : /^\/[^/]+\/[^/]+(\/?|\/(tree|blob)\/main(\/.*)?)$/.test(p);
  }
  return false;
}
/** Whether a URL is on one of Claude Code's pre-approved documentation sites. */
export function docSite(url) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  return docSitePath(u.hostname, u.pathname);
}

// ── A RULE'S DOMAIN ──────────────────────────────────────────────────────────
// Claude Code's own matching (its permissions docs: "Matching is case-insensitive, supports `*` wildcards, and strips a
// trailing `.`"; "`WebFetch(domain:*.example.com)` matches any subdomain at any depth … but not `example.com` itself"; "In
// any position other than a leading `*.` or a bare `*`, the wildcard matches only the text between two dots"), as its
// program does it: an exact rule is chosen before a wildcard one.
const normDomain = (t) => (!t.startsWith("domain:") ? t : "domain:" + t.slice(7).toLowerCase().replace(/(?<=[^*.])\.+(?=(:\d+)?$)/, ""));
const DOMAIN_SEPS = ".:";
const foldWide = (t) => t.replace(/[^\0-\x7f]/g, (e) => { const n = e.toUpperCase(); return n.length === 1 && n.charCodeAt(0) > 127 ? n : e; });
function globWithin(pattern, text) {
  // `*` is any run of characters that holds no "." or ":"; anything else stands for itself.
  const parts = pattern.split("*").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp("^" + parts.join("[^.:]*") + "$").test(text);
}
function wildDomain(rule, target) {
  if (!rule.startsWith("domain:") || !target.startsWith("domain:")) return false;
  if (rule === "domain:*") return true;
  const n = foldWide(rule.slice(7)), i = foldWide(target.slice(7));
  if (!n.startsWith("*.")) return globWithin(n, i);
  const o = n.slice(2);
  let c = 1;
  for (const d of o) if (DOMAIN_SEPS.includes(d)) c++;
  let s = i.length;
  while (c > 0 && s > 0) { s--; if (DOMAIN_SEPS.includes(i.charAt(s))) c--; }
  const r = i.slice(0, s + 1);
  return c === 0 && !r.startsWith(".") && !r.includes("..") && !r.includes(":") && globWithin(o, i.slice(s + 1));
}
/** Whether a WebFetch rule's spec (`domain:…`, or null for the whole tool) covers a host. */
export function domainRuleMatches(spec, host) {
  if (spec === null || spec === undefined) return true;
  const rule = normDomain(String(spec)), target = normDomain("domain:" + String(host || ""));
  return rule.includes("*") ? wildDomain(rule, target) : rule === target;
}
/** The rule that covers a host, from `{ text, spec }` rules: an exact one first, else the first wildcard one. */
export function pickDomainRule(rules, host) {
  const list = Array.isArray(rules) ? rules : [];
  const target = "domain:" + String(host || "");
  const raw = list.find((r) => r && r.spec === target);
  if (raw) return raw;
  const t = normDomain(target);
  let wild;
  for (const r of list) {
    if (!r || typeof r.spec !== "string") continue;
    const n = normDomain(r.spec);
    if (!n.includes("*")) { if (n === t) return r; } else if (wild === undefined && wildDomain(n, t)) wild = r;
  }
  return wild;
}
/**
 * CLAUDE CODE'S CHECK OF A WebFetch RULE'S SHAPE (its rule check: "WebFetch permissions use domain format, not URLs",
 * 'WebFetch permissions must use "domain:" prefix', each with 'Use "domain:hostname" format' and examples), or null.
 */
export function webFetchRuleProblem(content) {
  const e = String(content);
  if (e.includes("://") || e.startsWith("http")) return { error: "WebFetch permissions use domain format, not URLs", suggestion: 'Use "domain:hostname" format', examples: ["WebFetch(domain:example.com)", "WebFetch(domain:github.com)"] };
  if (!e.startsWith("domain:")) return { error: 'WebFetch permissions must use "domain:" prefix', suggestion: 'Use "domain:hostname" format', examples: ["WebFetch(domain:example.com)", "WebFetch(domain:*.google.com)"] };
  return null;
}
