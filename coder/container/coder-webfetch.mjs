/**
 * CLAUDE CODE'S WEBFETCH (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; Claude Code's tools
 * reference, "WebFetch tool behavior", and its 2.1.323 program where the docs say nothing; 2.1.325, read again the same
 * day, does the same): the tool's input, its description, its fetch (in the tools script, coder-tools.mjs), the page as
 * Markdown, its page cache and its texts (in Coder's loop, coder-agent.mjs); its pre-approved documentation sites and its
 * rules' domain matching are in coder-webfetch-sites.mjs (for coder-perms.mjs, which Coder's Worker loads too).
 *
 * Only Node's own modules here: the tools script loads this file for a fetch, and the machine installs no package for
 * Coder's own files (CD78).
 *
 * Kept from Coder where Claude Code differs (the owner's choice): a private-network address is never fetched; the page
 * reader is told to ignore instructions inside pages (a system line next to Claude Code's own prompt), and it runs on the
 * chat's own model at low effort.
 */
import http, { STATUS_CODES } from "node:http";
import https from "node:https";
import tls from "node:tls";
import zlib from "node:zlib";
import { isIP } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { docSitePath } from "./coder-webfetch-sites.mjs";

// ── LIMITS ───────────────────────────────────────────────────────────────────
// Claude Code 2.1.323's own: a URL of at most 2,000 characters; a download of at most 10,485,760 bytes; 60 seconds for each
// request; the whole download, its redirects included, within 300 seconds ("A page that hasn't finished downloading within
// five minutes, including any redirects WebFetch follows, fails with a deadline error"); at most 10 redirects to the same
// host; HTML cut at 1,048,576 characters before it becomes Markdown; 100,000 characters of the page read per call ("WebFetch
// reads up to 100,000 characters of a page's content per call"); a result past 50,000 characters saved to a file; each page
// kept 15 minutes ("WebFetch caches each response for 15 minutes by default"), at most 50 MB of pages.
export const WEBFETCH_MAX_URL = 2000;
export const WEBFETCH_MAX_BYTES = 10_485_760;
export const WEBFETCH_REQUEST_MS = 60_000;
export const WEBFETCH_DEADLINE_MS = 300_000;
export const WEBFETCH_MAX_REDIRECTS = 10;
export const WEBFETCH_HTML_MAX = 1_048_576;
export const WEBFETCH_READ_CHARS = 100_000;
export const WEBFETCH_RESULT_MAX = 50_000;
export const WEBFETCH_CACHE_TTL_MS = 900_000;
export const WEBFETCH_CACHE_BYTES = 52_428_800;
/** How much of a page's text Coder's tools script hands back (its answers travel up to 8 MB). */
export const WEBFETCH_CARRY_CHARS = 7_000_000;
/** Claude Code's headers: "an `Accept` header that prefers Markdown over HTML"; Coder keeps its own User-Agent. */
export const WEBFETCH_ACCEPT = "text/markdown, text/html, */*";
export const WEBFETCH_USER_AGENT = "Coder (gofarther.dev)";

// ── CLAUDE CODE'S TEXTS (word for word; where one tells the model to use a tool, Coder's tool's name) ──────────────────
export const CONTENT_TRUNCATED = "\n\n[Content truncated due to length...]";
export const DOTLESS_HOST = "WebFetch cannot fetch localhost or other hostnames without a dot. To reach a local server, use bash with curl instead.";
export const INVALID_URL = "Invalid URL";
export const TOO_MANY_REDIRECTS = (n) => "Too many redirects (exceeded " + n + ")";
export const DEADLINE_HIT = (ms) => "Fetch did not complete within the " + ms / 1000 + "s deadline";
export const TOO_BIG = (n) => "maxContentLength size of " + n + " exceeded";
export const REQUEST_TIMEOUT = (ms) => "timeout of " + ms + "ms exceeded";
// (Its cloud sessions' words for a host that does not resolve, Claude Code 2.1.312: "a host that does not resolve is now
// explained as possibly outside the allowed network domains, so Claude names the host to allow".)
export const NOT_RESOLVED = (message, host) => message + ". In this cloud session a host fails to resolve like this when it is outside the session's allowed network domains, or does not exist. If another host has failed the same way, stop trying more sites: carry on without them, and say in your answer that " + host + " has to be allowed in the session's network settings. Fetch it again only once the user says it is allowed.";
export const EGRESS_BLOCKED = (host) => JSON.stringify({ error_type: "EGRESS_BLOCKED", domain: host, message: "Access to " + host + " is blocked by the network egress proxy." });
/** Coder's own refusal, kept (Claude Code refuses only a host without a dot). */
export const PRIVATE_ADDRESS = "that address is on a private network";
// (Claude Code's "The small, fast model that reads the content gave no answer. Trying again may work.": Coder's reader is
// the chat's own model at low effort, so its kind is left out.)
export const NO_ANSWER = "The model that reads the content gave no answer. Trying again may work.";

/** The minutes in "Responses are cached for 15 minutes per URL", from the cache's time (Claude Code: at least 1). */
export function cacheWords(ttlMs = WEBFETCH_CACHE_TTL_MS) {
  const m = Math.max(1, Math.round((Number(ttlMs) || WEBFETCH_CACHE_TTL_MS) / 60000));
  return m + " " + (m === 1 ? "minute" : "minutes");
}
/**
 * THE TOOL'S DESCRIPTION, Claude Code's short one (the one it gives every model outside its list of older Claude models,
 * read from the tool as delivered, 2026-11-13), without its sentence on claude.ai artifact links (Coder has none), with
 * Coder's tool names, and "a separate model" for its "a small fast model" (Coder's reader is the chat's own model).
 */
export function webFetchDescription(ttlMs = WEBFETCH_CACHE_TTL_MS) {
  return "Fetches a URL, converts the page to markdown, and answers `prompt` against it using a separate model.\n\n" +
    "- Fails on authenticated/private URLs — use an authenticated MCP tool or `gh` for those instead.\n" +
    "- Fails on localhost and other hostnames without a dot; for a local server, use curl via bash.\n" +
    "- HTTP is upgraded to HTTPS. Cross-host redirects are returned to you rather than followed; call again with the redirect URL.\n" +
    "- Responses are cached for " + cacheWords(ttlMs) + " per URL.";
}
/** Its parameters, Claude Code's (url "format": "uri"; offset an integer from 0), with Claude Code's descriptions. */
export const WEBFETCH_PARAMS = Object.freeze({
  url: { type: "string", format: "uri", description: "The URL to fetch content from" },
  prompt: { type: "string", description: "The prompt to run on the fetched content" },
  offset: { type: "integer", minimum: 0, description: "Character position in the page text to start reading from. Use it to read on through a page too long for one call, with the value the previous result gave." },
});

// ── THE INPUT ────────────────────────────────────────────────────────────────
// Claude Code's own input check (coder-inputs.mjs runs it before any hook): three stray fields left out without a word
// (2.1.292: "WebFetch … ignore a few stray parameters instead of failing the call"); `offset` given as a number in a string
// taken as that number; its schema's words for anything else ("WebFetch failed due to the following issue: …", the URL
// trimmed and checked as zod's url() checks it); and, the tool turned off, "WebFetch is turned off by
// CLAUDE_CODE_DISABLE_WEB_FETCH." (2.1.323 rechecks it at each call). An `offset` of null is taken as none (Grok's function
// calls can send null for a field they leave out).
const STRAY_FIELDS = ["text_content_token_limit", "html_extraction_method", "web_fetch_pdf_extract_text"];
const INPUT_FIELDS = ["url", "prompt", "offset"];
const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" && Number.isNaN(v) ? "NaN" : typeof v);
export function checkInput(args, ctx = {}) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? { ...args } : {};
  for (const k of STRAY_FIELDS) delete a[k];
  if (a.offset === null) delete a.offset;
  if (typeof a.offset === "string") { const t = a.offset.trim(); if (/^[-+]?\d+(\.\d+)?$/.test(t) && Number.isFinite(Number(t))) a.offset = Number(t); }
  const missing = [], unexpected = [], types = [], other = [];
  let url = a.url;
  if (url === undefined) missing.push("url");
  else if (typeof url !== "string") types.push(["url", "string", kindOf(url)]);
  else { url = url.trim(); if (!URL.canParse(url)) other.push("The parameter `url` is invalid: Invalid URL"); }
  if (a.prompt === undefined) missing.push("prompt");
  else if (typeof a.prompt !== "string") types.push(["prompt", "string", kindOf(a.prompt)]);
  if (a.offset !== undefined) {
    if (typeof a.offset !== "number" || Number.isNaN(a.offset)) types.push(["offset", "number", kindOf(a.offset)]);
    else if (!Number.isSafeInteger(a.offset)) types.push(["offset", "int", "number"]);
    else if (a.offset < 0) other.push("The parameter `offset` is invalid: Too small: expected number to be >=0");
  }
  for (const k of Object.keys(a)) if (!INPUT_FIELDS.includes(k)) unexpected.push(k);
  const lines = [
    ...missing.map((p) => "The required parameter `" + p + "` is missing"),
    ...unexpected.map((p) => "An unexpected parameter `" + p + "` was provided"),
    ...types.map(([p, e, r]) => "The parameter `" + p + "` type is expected as `" + e + "` but provided as `" + r + "`"),
    ...other,
  ];
  if (lines.length) return { error: "error: InputValidationError: web_fetch failed due to the following " + (lines.length > 1 ? "issues" : "issue") + ":\n" + lines.join("\n") };
  if (ctx && typeof ctx.webFetchOff === "string" && ctx.webFetchOff) return { error: "error: WebFetch is turned off by " + ctx.webFetchOff + "." };
  return { args: { url, prompt: a.prompt, ...(a.offset !== undefined ? { offset: a.offset } : {}) } };
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
// Claude Code's three, under Coder's names (server.mjs maps a repository's CLAUDE_CODE_… ones to them):
// CODER_DISABLE_WEB_FETCH ("Set to `1` to turn off the WebFetch tool"); CODER_WEBFETCH_CACHE_TTL_MS ("The default is
// `900000` … Takes plain digits only; `0`, a decimal, or any other spelling keeps the default"); CODER_WEBFETCH_DEADLINE_MS
// ("The default is `300000` … Set to `0` to remove the limit. Takes plain digits only"). `nameOf`: the name the owner set,
// for the refusal's words.
export function webFetchSettings(vars, nameOf = (n) => n) {
  const v = vars && typeof vars === "object" ? vars : {};
  const off = /^(1|true|yes|on)$/i.test(String(v.CODER_DISABLE_WEB_FETCH ?? "").trim());
  const ttl = typeof v.CODER_WEBFETCH_CACHE_TTL_MS === "string" && /^\d+$/.test(v.CODER_WEBFETCH_CACHE_TTL_MS) && Number(v.CODER_WEBFETCH_CACHE_TTL_MS) > 0 ? Number(v.CODER_WEBFETCH_CACHE_TTL_MS) : WEBFETCH_CACHE_TTL_MS;
  const dl = typeof v.CODER_WEBFETCH_DEADLINE_MS === "string" && /^\d+$/.test(v.CODER_WEBFETCH_DEADLINE_MS) ? Math.min(Number(v.CODER_WEBFETCH_DEADLINE_MS), 2147483647) : WEBFETCH_DEADLINE_MS;
  return { off: off ? String(nameOf("CODER_DISABLE_WEB_FETCH") || "CODER_DISABLE_WEB_FETCH") : "", cacheTtlMs: ttl, deadlineMs: dl };
}

// ── CLAUDE CODE'S PRE-APPROVED DOCUMENTATION SITES AND ITS RULES' DOMAINS ─────
// (coder-webfetch-sites.mjs: Coder's Worker loads them with the permission rules, and it has no Node modules.)
export { DOC_SITES, docSitePath, docSite, domainRuleMatches, pickDomainRule, webFetchRuleProblem } from "./coder-webfetch-sites.mjs";

// ── THE URL ──────────────────────────────────────────────────────────────────
/**
 * What Claude Code refuses before it fetches: a URL over 2,000 characters, one with a user name or password, or one whose
 * host has no dot ("WebFetch cannot fetch localhost or other hostnames without a dot"); else "Invalid URL". "" when fine.
 */
export function urlProblem(url) {
  const s = String(url ?? "");
  let u = null;
  const ok = (() => { if (s.length > WEBFETCH_MAX_URL) return false; try { u = new URL(s); } catch { return false; } if (u.username || u.password) return false; return u.hostname.split(".").length >= 2; })();
  if (ok) return "";
  let host = "";
  try { host = new URL(s).hostname; } catch { host = ""; }
  return host && !host.includes(".") ? DOTLESS_HOST : INVALID_URL;
}
/** "HTTP URLs are automatically upgraded to HTTPS." */
export function upgradeUrl(url) {
  const u = new URL(String(url));
  if (u.protocol !== "http:") return String(url);
  u.protocol = "https:";
  return u.toString();
}
/**
 * A REDIRECT FOLLOWED, Claude Code's rule: the same protocol, port and host (a leading "www." left aside), no user name or
 * password, and not off its pre-approved documentation paths when it started on one. Any other comes back as a result.
 */
export function sameHostRedirect(from, to) {
  try {
    const r = new URL(from), s = new URL(to);
    if (s.protocol !== r.protocol) return false;
    const h = r.hostname.replace(/^www\./, "");
    const names = [...new Set([r.hostname, h, "www." + h])];
    if (names.some((k) => docSitePath(k, r.pathname)) && !names.some((k) => docSitePath(k, s.pathname))) return false;
    if (s.port !== r.port) return false;
    if (s.username || s.password) return false;
    return s.hostname.replace(/^www\./, "") === h;
  } catch { return false; }
}

// ── THE PAGE AS MARKDOWN ─────────────────────────────────────────────────────
/*
 * Claude Code turns a page's HTML into Markdown with Turndown (Dom Christie's, MIT license) on its defaults, with style,
 * script, noscript and iframe removed and three rules of its own (a table's rows as "| a | b |" lines when its table has a
 * header cell and no merged cells; and past a nesting limit, items, quotes, headings and code as plain blocks). The machine
 * can't install Turndown for Coder's files, so this is Turndown's own conversion (its rules, its whitespace handling, its
 * escaping) written again here, on a small HTML parser that builds the page as a browser's parser does for the usual cases
 * (implied tbody, p and li closed by what follows, raw script and style text, a page's head read in place as Claude Code's
 * wrapper does, quirks mode). Parsing differs from a full HTML5 parser only on badly broken markup.
 */
class DomNode {
  constructor(type, name) { this.nodeType = type; this.nodeName = name; this.parentNode = null; this.previousSibling = null; this.nextSibling = null; this.firstChild = null; this.lastChild = null; }
  get childNodes() { const out = []; for (let n = this.firstChild; n; n = n.nextSibling) out.push(n); return out; }
  get children() { const out = []; for (let n = this.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n); return out; }
  get lastElementChild() { for (let n = this.lastChild; n; n = n.previousSibling) if (n.nodeType === 1) return n; return null; }
  appendChild(c) { c.parentNode = this; c.previousSibling = this.lastChild; c.nextSibling = null; if (this.lastChild) this.lastChild.nextSibling = c; else this.firstChild = c; this.lastChild = c; return c; }
  insertBefore(c, ref) {
    if (!ref) return this.appendChild(c);
    c.parentNode = this; c.nextSibling = ref; c.previousSibling = ref.previousSibling;
    if (ref.previousSibling) ref.previousSibling.nextSibling = c; else this.firstChild = c;
    ref.previousSibling = c;
    return c;
  }
  removeChild(c) {
    if (c.previousSibling) c.previousSibling.nextSibling = c.nextSibling; else this.firstChild = c.nextSibling;
    if (c.nextSibling) c.nextSibling.previousSibling = c.previousSibling; else this.lastChild = c.previousSibling;
    c.parentNode = c.previousSibling = c.nextSibling = null;
    return c;
  }
  get textContent() {
    if (this.nodeType === 3) return this.data;
    let out = "";
    const walk = [];
    for (let n = this.lastChild; n; n = n.previousSibling) walk.push(n);
    while (walk.length) { const n = walk.pop(); if (n.nodeType === 3) out += n.data; else if (n.nodeType === 1) for (let k = n.lastChild; k; k = k.previousSibling) walk.push(k); }
    return out;
  }
}
class DomElement extends DomNode {
  constructor(name, attrs = null, ns = "html") { super(1, name); this.attrs = attrs; this.ns = ns; }
  getAttribute(name) { const v = this.attrs ? this.attrs.get(String(name).toLowerCase()) : undefined; return v === undefined ? null : v; }
  getElementsByTagName(name) {
    const want = String(name).toUpperCase(), out = [], walk = [];
    for (let n = this.lastChild; n; n = n.previousSibling) walk.push(n);
    while (walk.length) { const n = walk.pop(); if (n.nodeType !== 1) continue; if (n.nodeName.toUpperCase() === want) out.push(n); for (let k = n.lastChild; k; k = k.previousSibling) walk.push(k); }
    return out;
  }
}
class DomText extends DomNode {
  constructor(data) { super(3, "#text"); this.data = data; }
  get nodeValue() { return this.data; }
  set nodeValue(v) { this.data = v; }
}
class DomComment extends DomNode { constructor(data) { super(8, "#comment"); this.data = data; } }

// HTML's named character references: HTML 4's, and the HTML5 ones pages use most.
const ENTITY_LIST = "quot:34,amp:38,lt:60,gt:62,apos:39,nbsp:160,iexcl:161,cent:162,pound:163,curren:164,yen:165,brvbar:166,sect:167,uml:168,copy:169,ordf:170,laquo:171,not:172,shy:173,reg:174,macr:175,deg:176,plusmn:177,sup2:178,sup3:179,acute:180,micro:181,para:182,middot:183,cedil:184,sup1:185,ordm:186,raquo:187,frac14:188,frac12:189,frac34:190,iquest:191,Agrave:192,Aacute:193,Acirc:194,Atilde:195,Auml:196,Aring:197,AElig:198,Ccedil:199,Egrave:200,Eacute:201,Ecirc:202,Euml:203,Igrave:204,Iacute:205,Icirc:206,Iuml:207,ETH:208,Ntilde:209,Ograve:210,Oacute:211,Ocirc:212,Otilde:213,Ouml:214,times:215,Oslash:216,Ugrave:217,Uacute:218,Ucirc:219,Uuml:220,Yacute:221,THORN:222,szlig:223,agrave:224,aacute:225,acirc:226,atilde:227,auml:228,aring:229,aelig:230,ccedil:231,egrave:232,eacute:233,ecirc:234,euml:235,igrave:236,iacute:237,icirc:238,iuml:239,eth:240,ntilde:241,ograve:242,oacute:243,ocirc:244,otilde:245,ouml:246,divide:247,oslash:248,ugrave:249,uacute:250,ucirc:251,uuml:252,yacute:253,thorn:254,yuml:255,OElig:338,oelig:339,Scaron:352,scaron:353,Yuml:376,fnof:402,circ:710,tilde:732,Alpha:913,Beta:914,Gamma:915,Delta:916,Epsilon:917,Zeta:918,Eta:919,Theta:920,Iota:921,Kappa:922,Lambda:923,Mu:924,Nu:925,Xi:926,Omicron:927,Pi:928,Rho:929,Sigma:931,Tau:932,Upsilon:933,Phi:934,Chi:935,Psi:936,Omega:937,alpha:945,beta:946,gamma:947,delta:948,epsilon:949,zeta:950,eta:951,theta:952,iota:953,kappa:954,lambda:955,mu:956,nu:957,xi:958,omicron:959,pi:960,rho:961,sigmaf:962,sigma:963,tau:964,upsilon:965,phi:966,chi:967,psi:968,omega:969,thetasym:977,upsih:978,piv:982,ensp:8194,emsp:8195,thinsp:8201,zwnj:8204,zwj:8205,lrm:8206,rlm:8207,ndash:8211,mdash:8212,lsquo:8216,rsquo:8217,sbquo:8218,ldquo:8220,rdquo:8221,bdquo:8222,dagger:8224,Dagger:8225,bull:8226,hellip:8230,permil:8240,prime:8242,Prime:8243,lsaquo:8249,rsaquo:8250,oline:8254,frasl:8260,euro:8364,image:8465,weierp:8472,real:8476,trade:8482,alefsym:8501,larr:8592,uarr:8593,rarr:8594,darr:8595,harr:8596,crarr:8629,lArr:8656,uArr:8657,rArr:8658,dArr:8659,hArr:8660,forall:8704,part:8706,exist:8707,empty:8709,nabla:8711,isin:8712,notin:8713,ni:8715,prod:8719,sum:8721,minus:8722,lowast:8727,radic:8730,prop:8733,infin:8734,ang:8736,and:8743,or:8744,cap:8745,cup:8746,int:8747,there4:8756,sim:8764,cong:8773,asymp:8776,ne:8800,equiv:8801,le:8804,ge:8805,sub:8834,sup:8835,nsub:8836,sube:8838,supe:8839,oplus:8853,otimes:8855,perp:8869,sdot:8901,lceil:8968,rceil:8969,lfloor:8970,rfloor:8971,lang:10216,rang:10217,loz:9674,spades:9824,clubs:9827,hearts:9829,diams:9830,Tab:9,NewLine:10,excl:33,num:35,dollar:36,percnt:37,lpar:40,rpar:41,ast:42,plus:43,comma:44,period:46,sol:47,colon:58,semi:59,equals:61,quest:63,commat:64,lsqb:91,lbrack:91,bsol:92,rsqb:93,rbrack:93,Hat:94,lowbar:95,grave:96,lcub:123,lbrace:123,verbar:124,vert:124,rcub:125,rbrace:125,AMP:38,LT:60,GT:62,QUOT:34,COPY:169,REG:174,TRADE:8482,ZeroWidthSpace:8203,NonBreakingSpace:160,centerdot:183,half:189,hyphen:8208,dash:8208,check:10003,cross:10007,star:9734,starf:9733,phone:9742,female:9792,male:9794,flat:9837,natural:9838,sharp:9839,laquo:171";
const ENTITIES = new Map(ENTITY_LIST.split(",").map((x) => { const i = x.indexOf(":"); return [x.slice(0, i), String.fromCodePoint(Number(x.slice(i + 1)))]; }));
// (The ones HTML reads without their ";": HTML 4's Latin-1 set and the four basic ones.)
const LEGACY = new Set(ENTITY_LIST.split(",").map((x) => x.split(":")).filter(([n, c]) => (Number(c) >= 160 && Number(c) <= 255) || ["amp", "lt", "gt", "quot", "AMP", "LT", "GT", "QUOT", "COPY", "REG"].includes(n)).map(([n]) => n));
const WIN1252 = { 128: 8364, 130: 8218, 131: 402, 132: 8222, 133: 8230, 134: 8224, 135: 8225, 136: 710, 137: 8240, 138: 352, 139: 8249, 140: 338, 142: 381, 145: 8216, 146: 8217, 147: 8220, 148: 8221, 149: 8226, 150: 8211, 151: 8212, 152: 732, 153: 8482, 154: 353, 155: 8250, 156: 339, 158: 382, 159: 376 };
function numericRef(n) {
  if (!Number.isFinite(n) || n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return "�";
  if (WIN1252[n]) return String.fromCodePoint(WIN1252[n]);
  return String.fromCodePoint(n);
}
/** A text's character references read as HTML reads them (`attr`: in an attribute's value). */
function decodeRefs(s, attr = false) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+;?|#[0-9]+;?|[A-Za-z][A-Za-z0-9]*;?)/g, (m, body, at, all) => {
    if (body[0] === "#") { const hex = body[1] === "x" || body[1] === "X"; return numericRef(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)); }
    const semi = body.endsWith(";"), name = semi ? body.slice(0, -1) : body;
    if (semi && ENTITIES.has(name)) return ENTITIES.get(name);
    // (Without its ";", the longest legacy name it starts with; not in an attribute when a letter, digit or "=" follows.)
    for (let k = name.length; k > 1; k--) {
      const part = name.slice(0, k);
      if (!LEGACY.has(part)) continue;
      const after = k < name.length ? name[k] : semi && k === name.length ? ";" : all[at + m.length] || "";
      if (attr && /[A-Za-z0-9=]/.test(after)) return m;
      return ENTITIES.get(part) + name.slice(k) + (semi && k < name.length ? ";" : "");
    }
    return m;
  });
}

const VOID_TAGS = new Set(["AREA", "BASE", "BASEFONT", "BGSOUND", "BR", "COL", "EMBED", "FRAME", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"]);
const RAW_TAGS = new Set(["SCRIPT", "STYLE", "XMP", "IFRAME", "NOEMBED", "NOFRAMES", "NOSCRIPT"]);
const RCDATA_TAGS = new Set(["TITLE", "TEXTAREA"]);
const CLOSES_P = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "CENTER", "DETAILS", "DIALOG", "DIR", "DIV", "DL", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "HEADER", "HGROUP", "MAIN", "MENU", "NAV", "OL", "P", "SEARCH", "SECTION", "SUMMARY", "UL", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "LISTING", "FORM", "LI", "DD", "DT", "PLAINTEXT", "HR", "XMP"]);
// (End tags that close their element when it is in scope, whatever is open inside it.)
const BLOCK_ENDS = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BUTTON", "CENTER", "DETAILS", "DIALOG", "DIR", "DIV", "DL", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "HEADER", "HGROUP", "LISTING", "MAIN", "MENU", "NAV", "OL", "PRE", "SEARCH", "SECTION", "SUMMARY", "UL", "FORM", "APPLET", "MARQUEE", "OBJECT"]);
const HEADINGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const FORMATTING = new Set(["A", "B", "BIG", "CODE", "EM", "FONT", "I", "NOBR", "S", "SMALL", "STRIKE", "STRONG", "TT", "U"]);
const MARKER_TAGS = new Set(["TD", "TH", "CAPTION", "APPLET", "MARQUEE", "OBJECT", "TEMPLATE"]);
// (Start tags that don't bring back the formatting left open, a browser's "reconstruct the active formatting elements".)
const NO_RECONSTRUCT = new Set([...CLOSES_P, "TABLE", "TEXTAREA", "IFRAME", "NOEMBED", "NOSCRIPT", "TITLE", "STYLE", "SCRIPT", "LINK", "META", "BASE", "BASEFONT", "BGSOUND", "NOFRAMES", "TEMPLATE", "PARAM", "SOURCE", "TRACK", "FRAME"]);
const SPECIAL = new Set(["ADDRESS", "APPLET", "AREA", "ARTICLE", "ASIDE", "BASE", "BASEFONT", "BGSOUND", "BLOCKQUOTE", "BODY", "BR", "BUTTON", "CAPTION", "CENTER", "COL", "COLGROUP", "DD", "DETAILS", "DIR", "DIV", "DL", "DT", "EMBED", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAME", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEAD", "HEADER", "HGROUP", "HR", "HTML", "IFRAME", "IMG", "INPUT", "KEYGEN", "LI", "LINK", "LISTING", "MAIN", "MARQUEE", "MENU", "META", "NAV", "NOEMBED", "NOFRAMES", "NOSCRIPT", "OBJECT", "OL", "P", "PARAM", "PLAINTEXT", "PRE", "SCRIPT", "SEARCH", "SECTION", "SELECT", "SOURCE", "STYLE", "SUMMARY", "TABLE", "TBODY", "TD", "TEMPLATE", "TEXTAREA", "TFOOT", "TH", "THEAD", "TITLE", "TR", "TRACK", "UL", "WBR", "XMP", "X-TURNDOWN"]);
const SCOPE_STOP = new Set(["APPLET", "CAPTION", "HTML", "TABLE", "TD", "TH", "MARQUEE", "OBJECT", "TEMPLATE", "X-TURNDOWN"]);
const TABLE_ROWS = new Set(["TABLE", "TBODY", "THEAD", "TFOOT", "TR"]);
const TABLE_PARTS = new Set(["CAPTION", "COL", "COLGROUP", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR"]);
const FOREIGN_BREAKOUT = new Set(["B", "BIG", "BLOCKQUOTE", "BODY", "BR", "CENTER", "CODE", "DD", "DIV", "DL", "DT", "EM", "EMBED", "H1", "H2", "H3", "H4", "H5", "H6", "HEAD", "HR", "I", "IMG", "LI", "LISTING", "MENU", "META", "NOBR", "OL", "P", "PRE", "RUBY", "S", "SMALL", "SPAN", "STRONG", "STRIKE", "SUB", "SUP", "TABLE", "TT", "U", "UL", "VAR"]);
const INTEGRATION = new Set(["foreignobject", "desc", "title", "mi", "mo", "mn", "ms", "mtext", "annotation-xml"]);
const MARKER = Symbol("marker");

/** A page's HTML as the element Claude Code wraps it in (<x-turndown id="turndown-root">), its tree as a browser builds it. */
export function parseHtml(source) {
  const src = String(source).replace(/\r\n?/g, "\n");
  const root = new DomElement("X-TURNDOWN", new Map([["id", "turndown-root"]]));
  const stack = [root];
  // The formatting left open (b, i, a, code …), brought back into the next block as a browser does; MARKER at each cell.
  const afl = [];
  // (Which elements are open, for the formatting brought back: a set, as a long page can leave thousands open.)
  const open = new Set([root]);
  const cur = () => stack[stack.length - 1];
  let skipNewline = false;
  const isForeign = (n) => n.ns !== "html";
  const clone = (el) => new DomElement(el.nodeName, new Map(el.attrs || []), el.ns);
  const clearToMarker = () => { while (afl.length) { if (afl.pop() === MARKER) return; } };
  // (Elements leave the stack here only: a cell or caption that closes takes its formatting with it.)
  const popTo = (len) => { while (stack.length > Math.max(1, len)) { const n = stack.pop(); open.delete(n); if (MARKER_TAGS.has(n.nodeName) && !isForeign(n)) clearToMarker(); } };
  const popUntil = (pred) => { for (let k = stack.length - 1; k > 0; k--) if (pred(stack[k])) { popTo(k); return; } };
  const inScope = (name, extra = null) => {
    for (let k = stack.length - 1; k >= 0; k--) {
      const n = stack[k];
      if (n.nodeName === name && !isForeign(n)) return true;
      if (SCOPE_STOP.has(n.nodeName) || (extra && extra.has(n.nodeName)) || (isForeign(n) && k > 0)) return false;
    }
    return false;
  };
  const elementInScope = (el) => {
    for (let k = stack.length - 1; k >= 0; k--) { const n = stack[k]; if (n === el) return true; if (SCOPE_STOP.has(n.nodeName) || (isForeign(n) && k > 0)) return false; }
    return false;
  };
  const closeP = () => { if (inScope("P", new Set(["BUTTON"]))) popUntil((n) => n.nodeName === "P"); };
  const lastTable = () => { for (let k = stack.length - 1; k > 0; k--) if (stack[k].nodeName === "TABLE") return k; return -1; };
  const fosterInsert = (node) => {
    const k = lastTable();
    const table = k > 0 ? stack[k] : null;
    if (table && table.parentNode) table.parentNode.insertBefore(node, table);
    else (k > 0 ? stack[k - 1] : cur()).appendChild(node);
  };
  const fosters = () => TABLE_ROWS.has(cur().nodeName) && !isForeign(cur());
  const addText = (text, foster = false) => {
    if (!text) return;
    if (foster) {
      const k = lastTable(), table = k > 0 ? stack[k] : null;
      const parent = table && table.parentNode ? table.parentNode : cur();
      const before = table && table.parentNode ? table.previousSibling : parent.lastChild;
      if (before && before.nodeType === 3) before.data += text; else fosterInsert(new DomText(text));
      return;
    }
    const p = cur();
    if (p.lastChild && p.lastChild.nodeType === 3) p.lastChild.data += text; else p.appendChild(new DomText(text));
  };
  const insert = (node, push = true) => {
    const p = cur();
    if (fosters() && !TABLE_PARTS.has(node.nodeName) && !["SCRIPT", "STYLE", "TEMPLATE"].includes(node.nodeName) && !(node.nodeName === "INPUT" && String(node.getAttribute("type") || "").toLowerCase() === "hidden")) fosterInsert(node);
    else p.appendChild(node);
    if (push) { stack.push(node); open.add(node); }
    return node;
  };
  const reconstruct = () => {
    if (!afl.length) return;
    let k = afl.length - 1;
    if (afl[k] === MARKER || open.has(afl[k])) return;
    while (k > 0 && afl[k - 1] !== MARKER && !open.has(afl[k - 1])) k--;
    for (; k < afl.length; k++) { const c = clone(afl[k]); insert(c); afl[k] = c; }
  };
  const pushFormatting = (el) => {
    // (At most three of the same element and attributes after the last cell, as a browser keeps them.)
    let same = 0, first = -1;
    for (let k = afl.length - 1; k >= 0 && afl[k] !== MARKER; k--) {
      const e = afl[k];
      if (e.nodeName === el.nodeName && e.attrs.size === el.attrs.size && [...el.attrs].every(([a, v]) => e.attrs.get(a) === v)) { same++; first = k; }
    }
    if (same >= 3) afl.splice(first, 1);
    afl.push(el);
  };
  const characters = (text) => {
    if (skipNewline) { skipNewline = false; if (text.startsWith("\n")) text = text.slice(1); }
    text = text.replace(/\u0000/g, "");
    if (!text) return;
    if (fosters()) {
      if (/^[ \t\n\f\r]*$/.test(text)) { addText(text); return; }
      reconstruct();
      if (fosters()) { addText(text, true); return; }
    } else reconstruct();
    addText(text);
  };
  const element = (name, attrs, ns = "html") => new DomElement(name, attrs, ns);
  // ANY OTHER END TAG: the open element of that name, unless a special one is in the way.
  const otherEnd = (N) => {
    for (let k = stack.length - 1; k > 0; k--) {
      const n = stack[k];
      if (n.nodeName === N && !isForeign(n)) { popTo(k); return; }
      if (SPECIAL.has(n.nodeName) || SCOPE_STOP.has(n.nodeName)) return;
    }
  };
  // A FORMATTING ELEMENT'S END TAG: a browser's "adoption agency" for misnested formatting (<b>1<i>2</b>3</i>).
  const adoption = (N) => {
    const c = cur();
    if (c.nodeName === N && !isForeign(c) && !afl.includes(c)) { popTo(stack.length - 1); return; }
    for (let outer = 0; outer < 8; outer++) {
      let fi = -1;
      for (let k = afl.length - 1; k >= 0 && afl[k] !== MARKER; k--) if (afl[k].nodeName === N) { fi = k; break; }
      if (fi < 0) { otherEnd(N); return; }
      const fe = afl[fi];
      const si = stack.indexOf(fe);
      if (si < 0) { afl.splice(fi, 1); return; }
      if (!elementInScope(fe)) return;
      let fbi = -1;
      for (let k = si + 1; k < stack.length; k++) if (SPECIAL.has(stack[k].nodeName) && !isForeign(stack[k])) { fbi = k; break; }
      if (fbi < 0) { popTo(si); afl.splice(afl.indexOf(fe), 1); return; }
      const fb = stack[fbi], common = stack[si - 1];
      let bookmark = afl.indexOf(fe), node = fb, lastNode = fb, ni = fbi;
      for (let inner = 1; ; inner++) {
        ni--;
        node = stack[ni];
        if (node === fe) break;
        let ai = afl.indexOf(node);
        if (inner > 3 && ai >= 0) { afl.splice(ai, 1); if (ai < bookmark) bookmark--; ai = -1; }
        if (ai < 0) { open.delete(stack.splice(ni, 1)[0]); continue; }
        const cl = clone(node);
        afl[ai] = cl; open.delete(stack[ni]); stack[ni] = cl; open.add(cl); node = cl;
        if (lastNode === fb) bookmark = ai + 1;
        if (lastNode.parentNode) lastNode.parentNode.removeChild(lastNode);
        node.appendChild(lastNode);
        lastNode = node;
      }
      if (lastNode.parentNode) lastNode.parentNode.removeChild(lastNode);
      if (TABLE_ROWS.has(common.nodeName) && !isForeign(common)) fosterInsert(lastNode); else common.appendChild(lastNode);
      const fcl = clone(fe);
      while (fb.firstChild) { const ch = fb.firstChild; fb.removeChild(ch); fcl.appendChild(ch); }
      fb.appendChild(fcl);
      const fai = afl.indexOf(fe);
      afl.splice(fai, 1);
      if (fai < bookmark) bookmark--;
      afl.splice(Math.max(0, Math.min(bookmark, afl.length)), 0, fcl);
      stack.splice(stack.indexOf(fe), 1);
      open.delete(fe);
      stack.splice(stack.indexOf(fb) + 1, 0, fcl);
      open.add(fcl);
    }
  };
  let rawUntil = "";
  // A START TAG, in body, in a table or in a cell; foreign content kept as its own elements.
  const startTag = (rawName, attrs, selfClosing) => {
    const N = rawName.toUpperCase();
    const c = cur();
    if (isForeign(c) && !INTEGRATION.has(c.nodeName)) {
      if (FOREIGN_BREAKOUT.has(N) || (N === "FONT" && (attrs.has("color") || attrs.has("face") || attrs.has("size")))) {
        while (stack.length > 1 && isForeign(cur()) && !INTEGRATION.has(cur().nodeName)) popTo(stack.length - 1);
        return startTag(rawName, attrs, selfClosing);
      }
      insert(element(rawName.toLowerCase(), attrs, c.ns), !selfClosing);
      return;
    }
    if (N === "HTML" || N === "BODY" || N === "HEAD" || N === "FRAMESET") return;
    if (N === "TEMPLATE") { const t = element(N, attrs); stack.push(t); open.add(t); afl.push(MARKER); return; }
    // In a table's rows: implied tbody and tr, a new table closing the open one, a row part closing the open one.
    if (TABLE_ROWS.has(c.nodeName) || c.nodeName === "COLGROUP") {
      if (c.nodeName === "COLGROUP" && N !== "COL") { popTo(stack.length - 1); return startTag(rawName, attrs, selfClosing); }
      if (c.nodeName === "TABLE") {
        if (N === "CAPTION") { insert(element(N, attrs)); afl.push(MARKER); return; }
        if (N === "COLGROUP" || N === "TBODY" || N === "THEAD" || N === "TFOOT") { insert(element(N, attrs)); return; }
        if (N === "COL") { insert(element("COLGROUP", new Map())); insert(element(N, attrs), false); return; }
        if (N === "TR" || N === "TD" || N === "TH") { insert(element("TBODY", new Map())); return startTag(rawName, attrs, selfClosing); }
        if (N === "TABLE") { popUntil((n) => n.nodeName === "TABLE"); return startTag(rawName, attrs, selfClosing); }
      } else if (c.nodeName === "TBODY" || c.nodeName === "THEAD" || c.nodeName === "TFOOT") {
        if (N === "TR") { insert(element(N, attrs)); return; }
        if (N === "TD" || N === "TH") { insert(element("TR", new Map())); return startTag(rawName, attrs, selfClosing); }
        if (["CAPTION", "COL", "COLGROUP", "TBODY", "THEAD", "TFOOT", "TABLE"].includes(N)) { popTo(stack.length - 1); return startTag(rawName, attrs, selfClosing); }
      } else if (c.nodeName === "TR") {
        if (N === "TD" || N === "TH") { insert(element(N, attrs)); afl.push(MARKER); return; }
        if (["CAPTION", "COL", "COLGROUP", "TBODY", "THEAD", "TFOOT", "TR", "TABLE"].includes(N)) { popTo(stack.length - 1); return startTag(rawName, attrs, selfClosing); }
      }
    } else if (TABLE_PARTS.has(N) || N === "TABLE") {
      // In a cell or a caption, a row part closes it; outside any table, a row part is ignored.
      let k = stack.length - 1;
      while (k > 0 && !["TD", "TH", "CAPTION", "TABLE"].includes(stack[k].nodeName)) k--;
      const at = k > 0 ? stack[k].nodeName : "";
      if ((at === "TD" || at === "TH") && N !== "TABLE") { popUntil((n) => n.nodeName === "TD" || n.nodeName === "TH"); return startTag(rawName, attrs, selfClosing); }
      if (at === "CAPTION" && N !== "TABLE") { popUntil((n) => n.nodeName === "CAPTION"); return startTag(rawName, attrs, selfClosing); }
      if (N !== "TABLE") return;
    }
    if (CLOSES_P.has(N)) closeP();
    if (HEADINGS.has(N) && HEADINGS.has(cur().nodeName)) popTo(stack.length - 1);
    if (N === "LI" || N === "DD" || N === "DT") {
      for (let k = stack.length - 1; k > 0; k--) {
        const n = stack[k];
        if (N === "LI" ? n.nodeName === "LI" : n.nodeName === "DD" || n.nodeName === "DT") { popTo(k); break; }
        if (SPECIAL.has(n.nodeName) && !["ADDRESS", "DIV", "P"].includes(n.nodeName)) break;
      }
    }
    if (N === "BUTTON" && inScope("BUTTON")) popUntil((n) => n.nodeName === "BUTTON");
    if (N === "A") {
      let openA = null;
      for (let k = afl.length - 1; k >= 0 && afl[k] !== MARKER; k--) if (afl[k].nodeName === "A") { openA = afl[k]; break; }
      if (openA) { adoption("A"); const ai = afl.indexOf(openA); if (ai >= 0) afl.splice(ai, 1); const si = stack.indexOf(openA); if (si > 0) { stack.splice(si, 1); open.delete(openA); } }
    }
    if ((N === "OPTION" || N === "OPTGROUP") && cur().nodeName === "OPTION") popTo(stack.length - 1);
    const name = N === "IMAGE" ? "IMG" : N;
    if (!NO_RECONSTRUCT.has(name)) reconstruct();
    if (name === "NOBR" && inScope("NOBR")) { adoption("NOBR"); reconstruct(); }
    if (N === "SVG" || N === "MATH") { insert(element(rawName.toLowerCase(), attrs, N === "SVG" ? "svg" : "math"), !selfClosing); return; }
    if (VOID_TAGS.has(name)) { insert(element(name, attrs), false); return; }
    const el = insert(element(name, attrs));
    if (FORMATTING.has(name)) pushFormatting(el);
    if (MARKER_TAGS.has(name)) afl.push(MARKER);
    if (name === "PRE" || name === "LISTING" || name === "TEXTAREA") skipNewline = true;
    if (RAW_TAGS.has(name) || RCDATA_TAGS.has(name)) rawUntil = name;
    if (name === "PLAINTEXT") rawUntil = "PLAINTEXT";
  };
  const endTag = (rawName) => {
    const N = rawName.toUpperCase();
    // (In foreign content, the element of that name, whatever its case.)
    if (isForeign(cur())) {
      for (let k = stack.length - 1; k > 0; k--) {
        const n = stack[k];
        if (!isForeign(n)) break;
        if (n.nodeName.toUpperCase() === N) { popTo(k); return; }
      }
    }
    if (N === "HTML" || N === "BODY" || N === "HEAD" || N === "X-TURNDOWN") return;
    if (N === "TEMPLATE") { popUntil((n) => n.nodeName === "TEMPLATE"); return; }
    if (N === "P") { if (!inScope("P", new Set(["BUTTON"]))) { insert(element("P", new Map()), false); return; } popUntil((n) => n.nodeName === "P"); return; }
    if (N === "LI") { if (inScope("LI", new Set(["OL", "UL"]))) popUntil((n) => n.nodeName === "LI"); return; }
    if (N === "DD" || N === "DT") { if (inScope(N)) popUntil((n) => n.nodeName === N); return; }
    if (HEADINGS.has(N)) { if ([...HEADINGS].some((h) => inScope(h))) popUntil((n) => HEADINGS.has(n.nodeName)); return; }
    if (N === "BR") { reconstruct(); insert(element("BR", new Map()), false); return; }
    if (N === "COLGROUP") { if (cur().nodeName === "COLGROUP") popTo(stack.length - 1); return; }
    if (TABLE_PARTS.has(N) || N === "TABLE") {
      for (let k = stack.length - 1; k > 0; k--) { const n = stack[k]; if (n.nodeName === N) { popTo(k); return; } if (n.nodeName === "TABLE" || n.nodeName === "HTML" || n.nodeName === "TEMPLATE") return; }
      return;
    }
    if (BLOCK_ENDS.has(N)) { if (inScope(N)) popUntil((n) => n.nodeName === N && !isForeign(n)); return; }
    if (FORMATTING.has(N)) { adoption(N); return; }
    otherEnd(N);
  };
  // THE TOKENS.
  let i = 0;
  const n = src.length;
  const readAttrs = (from) => {
    const attrs = new Map();
    let j = from, selfClosing = false;
    for (;;) {
      while (j < n && /[\t\n\f /]/.test(src[j])) { if (src[j] === "/" && src[j + 1] === ">") { selfClosing = true; j++; break; } j++; }
      if (j >= n) return null;
      if (src[j] === ">") return { attrs, end: j + 1, selfClosing };
      let k = j + 1;
      while (k < n && !/[\t\n\f />=]/.test(src[k])) k++;
      const name = src.slice(j, k).toLowerCase();
      j = k;
      while (j < n && /[\t\n\f ]/.test(src[j])) j++;
      let value = "";
      if (src[j] === "=") {
        j++;
        while (j < n && /[\t\n\f ]/.test(src[j])) j++;
        if (src[j] === '"' || src[j] === "'") { const q = src[j]; const e = src.indexOf(q, j + 1); if (e < 0) return null; value = src.slice(j + 1, e); j = e + 1; }
        else { let e = j; while (e < n && !/[\t\n\f >]/.test(src[e])) e++; value = src.slice(j, e); j = e; }
        value = decodeRefs(value, true);
      }
      if (name && !attrs.has(name)) attrs.set(name, value);
    }
  };
  while (i < n) {
    if (rawUntil) {
      const want = rawUntil;
      rawUntil = "";
      if (want === "PLAINTEXT") { characters(src.slice(i)); break; }
      const re = new RegExp("</" + want + "(?=[\\t\\n\\f />])", "ig");
      re.lastIndex = i;
      const m = re.exec(src);
      const end = m ? m.index : n;
      const body = src.slice(i, end);
      if (body) {
        const text = RCDATA_TAGS.has(want) ? decodeRefs(body) : body;
        if (skipNewline && want === "TEXTAREA") characters(text); else addText(text);
      }
      skipNewline = false;
      i = end;
      if (m) { const close = src.indexOf(">", end); if (stack.length > 1 && cur().nodeName === want) popTo(stack.length - 1); i = close < 0 ? n : close + 1; }
      continue;
    }
    const lt = src.indexOf("<", i);
    if (lt < 0) { characters(decodeRefs(src.slice(i))); break; }
    if (lt > i) characters(decodeRefs(src.slice(i, lt)));
    i = lt;
    // (A newline right after <pre>, <listing> or <textarea> is dropped only when it comes first.)
    skipNewline = false;
    const c = src[i + 1];
    if (c === "!") {
      if (src.startsWith("<!--", i)) {
        let e = src.indexOf("-->", i + 4);
        if (src.startsWith("<!-->", i)) e = i + 2; else if (src.startsWith("<!--->", i)) e = i + 3;
        cur().appendChild(new DomComment(e < 0 ? src.slice(i + 4) : src.slice(i + 4, Math.max(i + 4, e))));
        i = e < 0 ? n : e + 3;
      } else if (src.startsWith("<![CDATA[", i) && isForeign(cur())) {
        const e = src.indexOf("]]>", i + 9);
        characters(e < 0 ? src.slice(i + 9) : src.slice(i + 9, e));
        i = e < 0 ? n : e + 3;
      } else {
        const e = src.indexOf(">", i + 2);
        if (!/^<!doctype/i.test(src.slice(i, i + 9))) cur().appendChild(new DomComment(e < 0 ? src.slice(i + 2) : src.slice(i + 2, e)));
        i = e < 0 ? n : e + 1;
      }
      continue;
    }
    if (c === "?") { const e = src.indexOf(">", i + 2); cur().appendChild(new DomComment(e < 0 ? src.slice(i + 1) : src.slice(i + 1, e))); i = e < 0 ? n : e + 1; continue; }
    if (c === "/") {
      if (/[A-Za-z]/.test(src[i + 2] || "")) {
        let k = i + 3;
        while (k < n && !/[\t\n\f />]/.test(src[k])) k++;
        const name = src.slice(i + 2, k);
        const a = readAttrs(k);
        if (!a) break;
        endTag(name);
        i = a.end;
      } else if (src[i + 2] === ">") i += 3;
      else { const e = src.indexOf(">", i + 2); cur().appendChild(new DomComment(e < 0 ? src.slice(i + 2) : src.slice(i + 2, e))); i = e < 0 ? n : e + 1; }
      continue;
    }
    if (/[A-Za-z]/.test(c || "")) {
      let k = i + 2;
      while (k < n && !/[\t\n\f />]/.test(src[k])) k++;
      const name = src.slice(i + 1, k);
      const a = readAttrs(k);
      if (!a) break;
      startTag(name, a.attrs, a.selfClosing);
      i = a.end;
      continue;
    }
    characters("<");
    i++;
  }
  return root;
}

// TURNDOWN: its lists, its whitespace collapsing, its escaping, its rules, on its defaults (setext headings for h1 and h2,
// "*" bullets, indented code blocks, "_" and "**", inline links, "  " before a line break).
const TD_BLOCK = new Set(["ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY", "CANVAS", "CENTER", "DD", "DIR", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR", "HTML", "ISINDEX", "LI", "MAIN", "MENU", "NAV", "NOFRAMES", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"]);
const TD_VOID = new Set(["AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"]);
const TD_MEANINGFUL = new Set(["A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", "SCRIPT", "AUDIO", "VIDEO"]);
const isBlockNode = (n) => TD_BLOCK.has(n.nodeName);
const hasAny = (n, set) => typeof n.getElementsByTagName === "function" && [...set].some((t) => n.getElementsByTagName(t).length > 0);
function onlyWhitespace(node) {
  if (node.nodeType === 3) return /^\s*$/.test(node.data);
  const walk = [];
  for (let k = node.lastChild; k; k = k.previousSibling) walk.push(k);
  while (walk.length) { const k = walk.pop(); if (k.nodeType === 3) { if (!/^\s*$/.test(k.data)) return false; } else if (k.nodeType === 1) for (let j = k.lastChild; j; j = j.previousSibling) walk.push(j); }
  return true;
}
function collapseWhitespace(root) {
  const isPre = (n) => n.nodeName === "PRE";
  if (!root.firstChild || isPre(root)) return;
  const remove = (node) => { const next = node.nextSibling || node.parentNode; node.parentNode.removeChild(node); return next; };
  const next = (prev, current) => ((prev && prev.parentNode === current) || isPre(current) ? current.nextSibling || current.parentNode : current.firstChild || current.nextSibling || current.parentNode);
  let prevText = null, keepLeadingWs = false, prev = null, node = next(prev, root);
  while (node !== root) {
    if (node.nodeType === 3 || node.nodeType === 4) {
      let text = node.data.replace(/[ \r\n\t]+/g, " ");
      if ((!prevText || / $/.test(prevText.data)) && !keepLeadingWs && text[0] === " ") text = text.slice(1);
      if (!text) { node = remove(node); continue; }
      node.data = text;
      prevText = node;
    } else if (node.nodeType === 1) {
      if (isBlockNode(node) || node.nodeName === "BR") { if (prevText) prevText.data = prevText.data.replace(/ $/, ""); prevText = null; keepLeadingWs = false; }
      else if (TD_VOID.has(node.nodeName) || isPre(node)) { prevText = null; keepLeadingWs = true; }
      else if (prevText) keepLeadingWs = false;
    } else { node = remove(node); continue; }
    const nextNode = next(prev, node);
    prev = node;
    node = nextNode;
  }
  if (prevText) { prevText.data = prevText.data.replace(/ $/, ""); if (!prevText.data) remove(prevText); }
}
const MD_ESCAPES = [[/\\/g, "\\\\"], [/\*/g, "\\*"], [/^-/g, "\\-"], [/^\+ /g, "\\+ "], [/^(=+)/g, "\\$1"], [/^(#{1,6}) /g, "\\$1 "], [/`/g, "\\`"], [/^~~~/g, "\\~~~"], [/\[/g, "\\["], [/\]/g, "\\]"], [/^>/g, "\\>"], [/_/g, "\\_"], [/^(\d+)\. /g, "$1\\. "]];
const escapeMd = (s) => MD_ESCAPES.reduce((t, [re, to]) => t.replace(re, to), s);
const repeat = (ch, k) => Array(k + 1).join(ch);
const cleanAttr = (v) => (v ? v.replace(/(\n+\s*)+/g, "\n") : "");
// (A node's text read from its ends only, so a long inline element is not copied whole for its white space: Turndown reads
// the leading and trailing white space of an element's text, and the space at a neighbour's end.)
function* textsForward(node) {
  if (node.nodeType === 3) { yield node.data; return; }
  const walk = [];
  for (let k = node.lastChild; k; k = k.previousSibling) walk.push(k);
  while (walk.length) { const n = walk.pop(); if (n.nodeType === 3) yield n.data; else if (n.nodeType === 1) for (let k = n.lastChild; k; k = k.previousSibling) walk.push(k); }
}
function* textsBackward(node) {
  if (node.nodeType === 3) { yield node.data; return; }
  const walk = [];
  for (let k = node.firstChild; k; k = k.nextSibling) walk.push(k);
  while (walk.length) { const n = walk.pop(); if (n.nodeType === 3) yield n.data; else if (n.nodeType === 1) for (let k = n.firstChild; k; k = k.nextSibling) walk.push(k); }
}
// (The first and last character of each element's text, worked out once for the whole page: markEnds.)
const firstChar = (node) => (node.nodeType === 3 ? node.data.charAt(0) : node.firstText || "");
const lastChar = (node) => (node.nodeType === 3 ? node.data.charAt(node.data.length - 1) : node.lastText || "");
function markEnds(root) {
  const order = [], walk = [root];
  while (walk.length) { const n = walk.pop(); order.push(n); for (let k = n.firstChild; k; k = k.nextSibling) if (k.nodeType === 1) walk.push(k); }
  for (let j = order.length - 1; j >= 0; j--) {
    const n = order[j];
    let f = "", l = "";
    for (let k = n.firstChild; k && !f; k = k.nextSibling) f = k.nodeType === 3 ? k.data.charAt(0) : k.nodeType === 1 ? k.firstText || "" : "";
    for (let k = n.lastChild; k && !l; k = k.previousSibling) l = k.nodeType === 3 ? k.data.charAt(k.data.length - 1) : k.nodeType === 1 ? k.lastText || "" : "";
    n.firstText = f; n.lastText = l;
  }
}
/** Turndown's edges of a text (its /^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/), from the node's ends. */
function edgeSpaces(node) {
  let lead = "", allWs = true;
  const f = firstChar(node), l = lastChar(node);
  if (f && !/\s/.test(f) && l && !/\s/.test(l)) return { leading: "", leadingAscii: "", leadingNonAscii: "", trailing: "", trailingNonAscii: "", trailingAscii: "" };
  for (const t of textsForward(node)) { const m = /\S/.exec(t); if (m) { lead += t.slice(0, m.index); allWs = false; break; } lead += t; }
  const la = /^[ \t\r\n]*/.exec(lead)[0];
  if (allWs) return { leading: lead, leadingAscii: la, leadingNonAscii: lead.slice(la.length), trailing: "", trailingNonAscii: "", trailingAscii: "" };
  let trail = "";
  for (const t of textsBackward(node)) { const m = /\s*$/.exec(t); if (m.index > 0) { trail = m[0] + trail; break; } trail = t + trail; }
  const ta = /[ \t\r\n]*$/.exec(trail)[0];
  return { leading: lead, leadingAscii: la, leadingNonAscii: lead.slice(la.length), trailing: trail, trailingNonAscii: trail.slice(0, trail.length - ta.length), trailingAscii: ta };
}
function flankedBySpace(side, node) {
  const sib = side === "left" ? node.previousSibling : node.nextSibling;
  if (!sib) return undefined;
  if (sib.nodeType === 3) return side === "left" ? sib.data.endsWith(" ") : sib.data.startsWith(" ");
  if (sib.nodeType === 1 && !isBlockNode(sib)) return side === "left" ? lastChar(sib) === " " : firstChar(sib) === " ";
  return undefined;
}
function flankingWhitespace(node) {
  if (node.isBlock) return { leading: "", trailing: "" };
  const e = edgeSpaces(node);
  if (e.leadingAscii && flankedBySpace("left", node)) e.leading = e.leadingNonAscii;
  if (e.trailingAscii && flankedBySpace("right", node)) e.trailing = e.trailingNonAscii;
  return { leading: e.leading, trailing: e.trailing };
}
const trimLeadingNewlines = (s) => s.replace(/^\n*/, "");
const trimTrailingNewlines = (s) => { let k = s.length; while (k > 0 && s[k - 1] === "\n") k--; return s.substring(0, k); };
function joinMd(output, replacement) {
  const s1 = trimTrailingNewlines(output), s2 = trimLeadingNewlines(replacement);
  const nls = Math.max(output.length - s1.length, replacement.length - s2.length);
  return s1 + "\n\n".substring(0, nls) + s2;
}
function markdownOf(root) {
  // CLAUDE CODE'S OWN RULES on top of Turndown's (its 2.1.323 program).
  const cellText = new WeakMap(), tableSimple = new WeakMap(), holdsTable = new WeakSet();
  const isCell = (n) => n.nodeName === "TD" || n.nodeName === "TH";
  const closest = (n, pred) => { let r = n.parentNode; while (r && !pred(r)) r = r.parentNode; return r; };
  const simpleTable = (cell) => {
    const table = closest(cell, (s) => s.nodeName === "TABLE");
    if (!table) return false;
    let ok = tableSimple.get(table);
    if (ok === undefined) {
      const cells = table.children.flatMap((y) => y.children.flatMap((k) => k.children));
      ok = cells.some((y) => y.nodeName === "TH") && cells.every((y) => (y.getAttribute("rowspan") ?? "1") === "1" && (y.getAttribute("colspan") ?? "1") === "1");
      tableSimple.set(table, ok);
      const outer = closest(table, isCell);
      if (outer) holdsTable.add(outer);
    }
    return ok;
  };
  const LIMITS = { indented: 12, underlined: 1, code: 1 }, KINDS = new Map([["LI", "indented"], ["BLOCKQUOTE", "indented"], ["H1", "underlined"], ["H2", "underlined"], ["CODE", "code"]]), ZERO = { indented: 0, underlined: 0, code: 0 };
  const rules = [
    { filter: (e) => { const n = (e.parentNode && e.parentNode.nesting) || ZERO, k = KINDS.get(e.nodeName); if (!k) { e.nesting = n; return false; } e.nesting = { ...n, [k]: n[k] + 1 }; return n[k] >= LIMITS[k]; }, replacement: (content, node) => (node.nodeName === "CODE" ? content : "\n\n" + content + "\n\n") },
    { filter: (e) => e.nodeName === "TR", replacement: (content, node) => {
      const block = "\n\n" + content + "\n\n";
      const cells = node.children.filter(isCell), texts = cells.map((k) => cellText.get(k));
      cells.forEach((k) => cellText.delete(k));
      if (cells.length === 0 || !texts.every((k) => k !== undefined)) return block;
      const row = texts.map((k) => k.trim().replace(/ {2}\n/g, "<br>").replace(/\\[\s\S]|\|/g, (v) => (v === "|" ? "\\|" : v)));
      if (row.some((k) => /[\r\n]/.test(k))) return block;
      return row.every((k) => !k) ? "" : "\n| " + row.join(" | ") + " |\n";
    } },
    { filter: isCell, replacement: (content, node) => { if (simpleTable(node) && !holdsTable.has(node)) cellText.set(node, content); return "\n\n" + content + "\n\n"; } },
    // Turndown's own.
    { filter: "p", replacement: (content) => "\n\n" + content + "\n\n" },
    { filter: "br", replacement: () => "  \n" },
    { filter: ["h1", "h2", "h3", "h4", "h5", "h6"], replacement: (content, node) => { const level = Number(node.nodeName.charAt(1)); return level < 3 ? "\n\n" + content + "\n" + repeat(level === 1 ? "=" : "-", content.length) + "\n\n" : "\n\n" + repeat("#", level) + " " + content + "\n\n"; } },
    { filter: "blockquote", replacement: (content) => "\n\n" + content.replace(/^\n+|\n+$/g, "").replace(/^/gm, "> ") + "\n\n" },
    { filter: ["ul", "ol"], replacement: (content, node) => { const parent = node.parentNode; return parent.nodeName === "LI" && parent.lastElementChild === node ? "\n" + content : "\n\n" + content + "\n\n"; } },
    { filter: "li", replacement: (content, node) => {
      content = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, "\n    ");
      let prefix = "*   ";
      const parent = node.parentNode;
      if (parent.nodeName === "OL") { const start = parent.getAttribute("start"), index = parent.children.indexOf(node); prefix = (start ? Number(start) + index : index + 1) + ".  "; }
      return prefix + content + (node.nextSibling && !/\n$/.test(content) ? "\n" : "");
    } },
    { filter: (e) => e.nodeName === "PRE" && e.firstChild && e.firstChild.nodeName === "CODE", replacement: (content, node) => "\n\n    " + node.firstChild.textContent.replace(/\n/g, "\n    ") + "\n\n" },
    { filter: "hr", replacement: () => "\n\n* * *\n\n" },
    { filter: (e) => e.nodeName === "A" && e.getAttribute("href"), replacement: (content, node) => {
      let href = node.getAttribute("href");
      if (href) href = href.replace(/([()])/g, "\\$1");
      let title = cleanAttr(node.getAttribute("title"));
      if (title) title = ' "' + title.replace(/"/g, '\\"') + '"';
      return "[" + content + "](" + href + title + ")";
    } },
    { filter: ["em", "i"], replacement: (content) => (content.trim() ? "_" + content + "_" : "") },
    { filter: ["strong", "b"], replacement: (content) => (content.trim() ? "**" + content + "**" : "") },
    { filter: (e) => { const sib = e.previousSibling || e.nextSibling, onlyInPre = e.parentNode.nodeName === "PRE" && !sib; return e.nodeName === "CODE" && !onlyInPre; }, replacement: (content) => {
      if (!content) return "";
      content = content.replace(/\r?\n|\r/g, " ");
      const extra = /^`|^ .*?[^ ].* $|`$/.test(content) ? " " : "";
      let delimiter = "`";
      const ticks = content.match(/`+/gm) || [];
      while (ticks.indexOf(delimiter) !== -1) delimiter += "`";
      return delimiter + extra + content + extra + delimiter;
    } },
    { filter: "img", replacement: (content, node) => { const alt = cleanAttr(node.getAttribute("alt")), src = node.getAttribute("src") || "", title = cleanAttr(node.getAttribute("title")); return src ? "![" + alt + "](" + src + (title ? ' "' + title + '"' : "") + ")" : ""; } },
  ];
  const removed = ["style", "script", "noscript", "iframe"];
  const matches = (rule, node) => (typeof rule.filter === "string" ? rule.filter === node.nodeName.toLowerCase() : Array.isArray(rule.filter) ? rule.filter.includes(node.nodeName.toLowerCase()) : !!rule.filter(node));
  const forNode = (node) => {
    if (node.isBlank) return { replacement: (content, n) => (n.isBlock ? "\n\n" : "") };
    for (const rule of rules) if (matches(rule, node)) return rule;
    if (removed.includes(node.nodeName.toLowerCase())) return { replacement: () => "" };
    return { replacement: (content, n) => (n.isBlock ? "\n\n" + content + "\n\n" : content) };
  };
  const annotate = (node) => {
    node.isBlock = isBlockNode(node);
    node.isCode = node.nodeName === "CODE" || !!(node.parentNode && node.parentNode.isCode);
    node.isBlank = !TD_VOID.has(node.nodeName) && !TD_MEANINGFUL.has(node.nodeName) && onlyWhitespace(node) && !hasAny(node, TD_VOID) && !hasAny(node, TD_MEANINGFUL);
    if (node.nodeType === 1) node.flankingWhitespace = flankingWhitespace(node);
  };
  const process = (parent) => {
    let output = "";
    for (const child of parent.childNodes) {
      annotate(child);
      let s = "";
      if (child.nodeType === 3) s = child.isCode ? child.data : escapeMd(child.data);
      else if (child.nodeType === 1) s = replace(child);
      output = joinMd(output, s);
    }
    return output;
  };
  const replace = (node) => {
    const rule = forNode(node);
    let content = process(node);
    const fw = node.flankingWhitespace;
    if (fw.leading || fw.trailing) content = content.trim();
    return fw.leading + rule.replacement(content, node) + fw.trailing;
  };
  return process(root).replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
}
/** Turndown's turndown(): "" for "", else the page's Markdown. */
export function turndown(html) {
  const s = String(html);
  if (s === "") return "";
  const root = parseHtml(s);
  collapseWhitespace(root);
  markEnds(root);
  return markdownOf(root);
}
/**
 * THE PAGE AS MARKDOWN, as Claude Code makes it: its first 1,048,576 characters converted, "[Content truncated due to
 * length...]" after a longer one; the HTML itself if the conversion fails ("Turndown failed, falling back to raw HTML").
 */
export function htmlToMarkdown(html) {
  const src = String(html);
  try {
    let md = turndown(src.slice(0, WEBFETCH_HTML_MAX));
    if (src.length > WEBFETCH_HTML_MAX) md += CONTENT_TRUNCATED;
    return md;
  } catch { return src; }
}

// ── THE FETCH (run in the tools script) ──────────────────────────────────────
/** Claude Code's binary kinds: any but text/*, JSON, XML, JavaScript and form data. */
export function binaryType(contentType) {
  if (!contentType) return false;
  const n = String(contentType).split(";")[0].trim().toLowerCase();
  if (n.startsWith("text/")) return false;
  if (n.endsWith("+json") || n === "application/json") return false;
  if (n.endsWith("+xml") || n === "application/xml") return false;
  if (n.startsWith("application/javascript")) return false;
  if (n === "application/x-www-form-urlencoded") return false;
  return true;
}
/** A content type as Claude Code names it in its note ("unknown content type" when it has none). */
export function typeShown(contentType) { return (/^[\w!#$&^.+-]{1,64}\/[\w!#$&^.+-]{1,64}/.exec(String(contentType || "")) || [])[0] || "unknown content type"; }
const EXTENSIONS = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp", "image/tiff": "tiff", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "application/zip": "zip", "application/gzip": "gz", "application/x-gzip": "gz", "application/x-tar": "tar", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "video/mp4": "mp4", "video/webm": "webm", "font/woff2": "woff2", "font/woff": "woff", "application/wasm": "wasm" };
/** A size as Claude Code writes one ("512 bytes", "1.5KB", "2MB"). */
export function sizeShown(bytes) {
  const n = Math.max(0, Number(bytes) || 0), kb = n / 1024, one = (x) => x.toFixed(1).replace(/\.0$/, "");
  if (kb < 1) return n + " bytes";
  if (kb < 1024) return one(kb) + "KB";
  const mb = kb / 1024;
  return mb < 1024 ? one(mb) + "MB" : one(mb / 1024) + "GB";
}
const requestError = (message, code) => Object.assign(new Error(message), code ? { code } : {});
/**
 * ONE GET, as Claude Code makes it (no redirect followed by itself; 60 seconds with nothing from the server ends it, in
 * axios's words; a body past 10,485,760 bytes ends it, in axios's words; never left waiting): through Coder's network gate
 * when the chat's network list is on (`proxy`), else straight, a name's addresses checked as it connects (`lookup`).
 * → { status, statusText, headers, body } (`body` only for a 2xx).
 */
export function requestOnce(url, { signal = null, proxy = "", lookup = undefined, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false, req = null;
    const done = (fn, v) => { if (settled) return; settled = true; if (signal) signal.removeEventListener("abort", onAbort); fn(v); };
    const fail = (e) => { done(reject, e); try { if (req) req.destroy(); } catch { /* gone */ } };
    const onAbort = () => fail(Object.assign(new Error("aborted"), { name: "AbortError", aborted: true }));
    if (signal) { if (signal.aborted) return onAbort(); signal.addEventListener("abort", onAbort, { once: true }); }
    let u;
    try { u = new URL(url); } catch { return done(reject, requestError(INVALID_URL)); }
    const mod = u.protocol === "https:" ? https : u.protocol === "http:" ? http : null;
    if (!mod) return done(reject, requestError("Unsupported protocol " + u.protocol));
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const port = Number(u.port) || (u.protocol === "https:" ? 443 : 80);
    const viaGate = proxy ? (() => { try { return new URL(proxy); } catch { return null; } })() : null;
    const opts = { method: "GET", headers: { accept: WEBFETCH_ACCEPT, "accept-encoding": "gzip, deflate, br", "user-agent": WEBFETCH_USER_AGENT, ...headers } };
    // (A plain http address through the gate goes to it whole; Claude Code's own fetches are all https by now.)
    const plainViaGate = !!viaGate && u.protocol === "http:";
    if (viaGate && u.protocol === "https:") {
      opts.createConnection = (_o, cb) => {
        const c = http.request({ host: viaGate.hostname, port: viaGate.port || 80, method: "CONNECT", path: (u.hostname) + ":" + port, headers: { host: u.hostname + ":" + port } });
        c.setTimeout(WEBFETCH_REQUEST_MS, () => { c.destroy(); cb(requestError(REQUEST_TIMEOUT(WEBFETCH_REQUEST_MS), "ECONNABORTED")); });
        c.on("connect", (res, sock) => {
          c.setTimeout(0);
          if (res.statusCode !== 200) {
            sock.destroy();
            const reason = String(res.headers["x-deny-reason"] || ""), perr = String(res.headers["x-proxy-error"] || "");
            if (res.statusCode === 403 && (reason === "host_not_allowed" || perr === "blocked-by-allowlist")) return cb(requestError(EGRESS_BLOCKED(u.hostname), "EGRESS_BLOCKED"));
            if (res.statusCode === 403 && reason === "private_dest_ip") return cb(requestError(PRIVATE_ADDRESS, "EPRIVATE"));
            return cb(requestError("the proxy refused " + u.hostname));
          }
          cb(null, tls.connect({ socket: sock, servername: isIP(host) ? undefined : u.hostname }));
        });
        c.on("error", (e) => cb(e));
        c.end();
      };
    } else if (plainViaGate) {
      opts.host = viaGate.hostname; opts.port = viaGate.port || 80; opts.path = u.href; opts.headers.host = u.host;
    } else if (lookup) opts.lookup = lookup;
    const onRes = (res) => {
      const status = res.statusCode || 0;
      const base = { status, statusText: res.statusMessage || "", headers: res.headers };
      if (status < 200 || status >= 300) { res.resume(); done(resolve, { ...base, body: null }); try { req.destroy(); } catch { /* gone */ } return; }
      const enc = String(res.headers["content-encoding"] || "").trim().toLowerCase();
      let stream = res;
      try {
        if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
      } catch { stream = res; }
      const chunks = [];
      let size = 0;
      stream.on("data", (chunk) => {
        size += chunk.length;
        if (size > WEBFETCH_MAX_BYTES) { fail(requestError(TOO_BIG(WEBFETCH_MAX_BYTES), "ERR_BAD_RESPONSE")); try { res.destroy(); stream.destroy(); } catch { /* gone */ } return; }
        chunks.push(chunk);
      });
      stream.on("end", () => done(resolve, { ...base, body: Buffer.concat(chunks) }));
      stream.on("error", (e) => fail(e));
      res.on("error", (e) => fail(e));
      res.on("close", () => { if (!res.complete) fail(requestError("aborted", "ECONNRESET")); });
    };
    try { req = plainViaGate ? http.request(opts, onRes) : mod.request(u, opts, onRes); }
    catch (e) { return done(reject, e); }
    req.setTimeout(WEBFETCH_REQUEST_MS, () => fail(requestError(REQUEST_TIMEOUT(WEBFETCH_REQUEST_MS), "ECONNABORTED")));
    req.on("error", (e) => fail(e && e.code === "EPRIVATE" ? requestError(PRIVATE_ADDRESS, "EPRIVATE") : e));
    req.end();
  });
}
/**
 * THE FETCH, as Claude Code's: its URL checks, http upgraded to https, Coder's private-network refusal, its redirects (the
 * same host followed, at most 10; another host given back), a status other than 2xx given back with its Retry-After, a
 * blocked host in Claude Code's words, its 300-second deadline (`deadlineMs`, 0 for none), and the page: HTML as Markdown,
 * a binary kind also saved to Coder's scratch folder (`scratch`), any other text as it came. → { text, facts }:
 * facts.kind "page" ({ bytes, code, codeText, contentType, cacheBytes, persistedPath?, persistedSize?, binary }),
 * "redirect" ({ originalUrl, redirectUrl, statusCode }) or "http_error" ({ statusCode, retryAfter? }); a failure throws.
 */
export async function fetchPage({ url, deadline_ms: deadlineMs = WEBFETCH_DEADLINE_MS } = {}, { request = requestOnce, isPrivate = () => false, lookup = undefined, proxy = "", scratch = "/tmp/coder-scratch", now = Date.now } = {}) {
  const asked = String(url ?? "");
  const problem = urlProblem(asked);
  if (problem) throw requestError(problem);
  let current = upgradeUrl(asked);
  const dl = Number.isFinite(Number(deadlineMs)) && Number(deadlineMs) >= 0 ? Math.min(Number(deadlineMs), 2147483647) : WEBFETCH_DEADLINE_MS;
  const ac = new AbortController();
  const timer = dl > 0 ? setTimeout(() => ac.abort(), dl) : null;
  if (timer && typeof timer.unref === "function") timer.unref();
  try {
    for (let hops = 0; ; hops++) {
      if (hops > WEBFETCH_MAX_REDIRECTS) throw requestError(TOO_MANY_REDIRECTS(WEBFETCH_MAX_REDIRECTS));
      const host = new URL(current).hostname.replace(/^\[|\]$/g, "");
      if (isIP(host) && isPrivate(host)) throw requestError(PRIVATE_ADDRESS, "EPRIVATE");
      let res;
      try { res = await request(current, { signal: ac.signal, proxy, lookup }); }
      catch (e) {
        if (ac.signal.aborted) throw requestError(DEADLINE_HIT(dl), "EDEADLINE");
        if (e && e.code === "ENOTFOUND") throw requestError(NOT_RESOLVED(String(e.message || "getaddrinfo ENOTFOUND " + host), new URL(current).hostname), "ENOTFOUND");
        throw e;
      }
      const status = res.status, h = res.headers || {};
      if (status >= 200 && status < 300) {
        const body = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body || "");
        const contentType = String(h["content-type"] ?? "");
        let persistedPath, persistedSize;
        const binary = binaryType(contentType);
        if (binary) {
          const ext = EXTENSIONS[String(contentType).split(";")[0].trim().toLowerCase()] || "bin";
          const file = join(scratch, "webfetch-" + now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext);
          try { await mkdir(scratch, { recursive: true, mode: 0o700 }); await writeFile(file, body, { flag: "wx", mode: 0o600 }); persistedPath = file; persistedSize = body.length; } catch { /* not saved */ }
        }
        const raw = body.toString("utf-8");
        let text = contentType.includes("text/html") ? htmlToMarkdown(raw) : raw;
        const cacheBytes = contentType.includes("text/html") ? Buffer.byteLength(text) : body.length;
        // (Coder's tools script hands back at most WEBFETCH_CARRY_CHARS of it.)
        let cut = false;
        if (text.length > WEBFETCH_CARRY_CHARS) { text = text.slice(0, WEBFETCH_CARRY_CHARS) + CONTENT_TRUNCATED; cut = true; }
        return { text, facts: { kind: "page", bytes: body.length, code: status, codeText: res.statusText || "", contentType, cacheBytes, binary, ...(persistedPath ? { persistedPath, persistedSize } : {}), ...(cut ? { cut: true } : {}) } };
      }
      if ([301, 302, 303, 307, 308].includes(status)) {
        const loc = h.location;
        if (typeof loc !== "string" || loc.trim() === "") return { text: "", facts: { kind: "http_error", statusCode: status } };
        let next;
        try { next = new URL(loc, current).toString(); } catch { return { text: "", facts: { kind: "http_error", statusCode: status } }; }
        if (sameHostRedirect(current, next)) { current = next; continue; }
        return { text: "", facts: { kind: "redirect", originalUrl: current, redirectUrl: next, statusCode: status } };
      }
      if (status === 403 && (String(h["x-deny-reason"] || "") === "host_not_allowed" || String(h["x-proxy-error"] || "") === "blocked-by-allowlist")) throw requestError(EGRESS_BLOCKED(new URL(current).hostname), "EGRESS_BLOCKED");
      const ra = h["retry-after"];
      return { text: "", facts: { kind: "http_error", statusCode: status, ...(typeof ra === "string" && /^[0-9]{1,6}$/.test(ra) ? { retryAfter: ra } : {}) } };
    }
  } finally { if (timer) clearTimeout(timer); }
}

// ── WHAT CODER IS TOLD (in Coder's loop) ─────────────────────────────────────
/** An HTTP status's text, as Claude Code names it (Node's own list; "Unknown Status" for one it doesn't know). */
export const statusText = (code) => STATUS_CODES[code] ?? "Unknown Status";
/** A redirect to another host, in Claude Code's words; its target relayed up to 1,000 characters. */
export function redirectText({ originalUrl, redirectUrl, statusCode }, { prompt = "", offset = 0 } = {}) {
  const status = statusText(statusCode);
  let shown = "", ok = false, hostTooLong = false;
  try { const t = new URL(redirectUrl); ok = t.protocol === "https:" || t.protocol === "http:"; if (ok) { shown = t.origin + t.pathname + t.search + t.hash; hostTooLong = t.hostname.length > 255; } } catch { ok = false; }
  const relayed = ok ? firstChars(shown, 1000) : undefined;
  const withheld = shown.length - (relayed ? relayed.length : 0);
  const line = relayed === undefined
    ? "Redirect URL: (withheld — the server sent a redirect target that is not a valid http(s) URL)"
    : "Redirect URL (from the server's Location header — server-supplied, not verified): " + relayed + (withheld > 0 ? " […" + withheld + " more characters withheld: too long to relay]" : "") + (hostTooLong ? " [hostname longer than any DNS name (255 characters): not a fetchable address]" : "");
  const whole = relayed !== undefined && withheld === 0 && !hostTooLong;
  const tail = whole
    ? "To complete your request, I need to fetch content from the redirected URL. Please use web_fetch again with these parameters:\n    - url: \"" + relayed + "\"\n    - prompt: \"" + prompt + "\"" + (offset > 0 ? "\n    - offset: " + offset : "")
    : "The redirect target could not be relayed in full or is not a fetchable address, so it cannot be fetched from here; report the redirect instead.";
  return "REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.\n\n    Original URL: " + originalUrl + "\n    " + line + "\n    Status: " + statusCode + " " + status + "\n\n    " + tail;
}
/** A status other than 2xx, in Claude Code's words: the body not read, its Retry-After said. */
export function httpErrorText({ statusCode, retryAfter }) {
  return "The server returned HTTP " + statusCode + " " + statusText(statusCode) + "." + (retryAfter ? "\nRetry-After: " + retryAfter : "") + "\n\nThe response body was not retrieved. If this URL requires authentication, use an authenticated tool (e.g. `gh` for GitHub, or an MCP-provided fetch tool) instead of web_fetch.";
}
export const pastEndText = (offset, length) => "Nothing left to read from offset " + offset + ": this page's text is " + length + " characters long.";
export const leadText = (offset, length) => "The content below is one part of a longer page: it starts " + offset + " characters into the page's " + length + ".\n";
export const readOnNote = (from, to, length) => "\n\n[WebFetch note: this page's text is " + length + " characters long and the answer above covers only characters " + from + " to " + to + "; the final " + (length - to) + " were not read — to read on, call web_fetch again with the same url and offset: " + to + ".]";
export const binaryNote = (contentType, size, path) => "\n\n[Binary content (" + typeShown(contentType) + ", " + sizeShown(size) + ") also saved to " + path + "]";
/** A page's text from `offset` (a pair of surrogates never split), as Claude Code takes it. */
export function fromOffset(text, offset) {
  const s = String(text), k = Math.max(0, Number(offset) || 0);
  if (k === 0) return s;
  if (k >= s.length) return "";
  const rest = s.slice(k), c = rest.charCodeAt(0);
  return c >= 0xdc00 && c <= 0xdfff ? rest.slice(1) : rest;
}
/** At most `n` characters of a text (a pair of surrogates never split). */
export function firstChars(text, n) {
  const s = String(text);
  if (s.length <= n) return s;
  const c = s.charCodeAt(n - 1);
  return s.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n);
}
/**
 * THE PAGE READER'S MESSAGE, Claude Code's own prompt: the page's first 100,000 characters ("[Content truncated due to
 * length...]" after them), Coder's prompt, then its instructions: for a pre-approved documentation site, "Provide a concise
 * response based on the content above. Include relevant details, code examples, and documentation excerpts as needed.";
 * for any other, its rules on quotes.
 */
export function readerMessage(content, prompt, preapproved = false) {
  const s = String(content);
  const page = s.length > WEBFETCH_READ_CHARS ? firstChars(s, WEBFETCH_READ_CHARS) + CONTENT_TRUNCATED : s;
  const rules = preapproved
    ? "Provide a concise response based on the content above. Include relevant details, code examples, and documentation excerpts as needed."
    : "Provide a concise response based only on the content above. In your response:\n - Enforce a strict 125-character maximum for quotes from any source document. Open Source Software is ok as long as we respect the license.\n - Use quotation marks for exact language from articles; any language outside of the quotation should never be word-for-word the same.\n - You are not a lawyer and never comment on the legality of your own prompts and responses.\n - Never produce or reproduce exact song lyrics.";
  return "\nWeb page content:\n---\n" + page + "\n---\n\n" + String(prompt) + "\n\n" + rules + "\n";
}
/** A result too long for one answer (Claude Code's limit for this tool: 50,000 characters), as Claude Code gives it. */
export function persistedText(text, file) {
  const s = String(text);
  const lastBreak = s.slice(0, 2000).lastIndexOf("\n");
  const preview = s.slice(0, lastBreak > 1000 ? lastBreak : 2000);
  return "<persisted-output>\nOutput too large (" + sizeShown(s.length) + "). Full output saved to: " + file + "\n\nPreview (first 2KB):\n" + preview + "\n...\n</persisted-output>";
}

// ── THE PAGE CACHE ───────────────────────────────────────────────────────────
/**
 * CLAUDE CODE'S CACHE OF FETCHED PAGES (its tools reference: "WebFetch caches each response for 15 minutes by default, so
 * repeated fetches of the same URL return quickly"): each page as fetched and converted, by its URL, for its time
 * (CODER_WEBFETCH_CACHE_TTL_MS), at most 50 MB of pages, the least recently used left out first. The page reader runs on
 * every call. Coder keeps one per chat (the key starts with the chat's id), as Claude Code keeps one per session.
 */
export class PageCache {
  constructor(maxBytes = WEBFETCH_CACHE_BYTES) { this.max = maxBytes; this.bytes = 0; this.map = new Map(); }
  get(key, now = Date.now()) {
    const e = this.map.get(key);
    if (!e) return null;
    if (now - e.at >= e.ttl) { this.delete(key); return null; }
    this.map.delete(key); this.map.set(key, e);
    return e.value;
  }
  set(key, value, size, ttl = WEBFETCH_CACHE_TTL_MS, now = Date.now()) {
    const sz = Math.max(1, Number(size) || 1);
    if (sz > this.max) return;
    this.delete(key);
    while (this.bytes + sz > this.max && this.map.size) this.delete(this.map.keys().next().value);
    this.map.set(key, { value, size: sz, ttl, at: now });
    this.bytes += sz;
  }
  delete(key) { const e = this.map.get(key); if (e) { this.bytes -= e.size; this.map.delete(key); } }
  clear() { this.map.clear(); this.bytes = 0; }
}
export const pageCache = new PageCache();
