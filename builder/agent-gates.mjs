// THE SITE AGENT'S GATES (2026-11-04, carry-over batch 1). The old router and
// lanes enforced these in code; the agent path had them as prompt rules or not
// at all. Plain functions, no I/O; `site-agent.mjs` calls them from its tools.
//
//   M-7  price first: a new page, a new server feature, or a rewrite of many
//        existing files needs the owner's yes, with the price, before a write.
//   M-8  provider: server code that calls a provider the owner never named is
//        refused until the owner is asked which one.
//   M-42 unasked removals: what the agent insists on taking away is asked
//        about (in `site-agent.mjs`, with `unaskedLines` from `agent-guard.mjs`).
//   M-45 dead links: a link to a page the site does not have holds the finish.

/** The exact answers the gates read back from the owner's reply. */
export const PRICE_YES = "Yes, go ahead";
export const REMOVE_YES = "Yes, take them away too";
export const REMOVE_NO = "No, keep them";

/** How many existing files one change may rewrite before it counts as a rewrite. */
export const REWRITE_FILES = 4;

/** Measured ranges (CLAUDE.md "What things cost"), quoted to the owner. */
export const PRICE_RANGE = Object.freeze({ page: "about 6 to 22 credits", feature: "about 2 to 13 credits", rewrite: "about 15 to 45 credits" });

const answered = (request, a) => String(request || "").includes("They answered: " + a);

/** True when the owner has already said yes to the price. */
export function priceApproved(request) { return answered(request, PRICE_YES); }

/**
 * WHAT THIS WRITE WOULD MAKE (M-7): "page" (a new page), "feature" (new
 * server code), "rewrite" (the Nth existing file changed), or "" when it is an
 * ordinary edit. `orig` is the set of files the site had; `written` the files
 * this run changed so far.
 */
export function bigKind(key, { orig, written }) {
  const k = String(key || "");
  if (!orig || typeof orig.has !== "function") return "";
  if (!orig.has(k)) {
    if (k.startsWith("-parts/server-")) return "feature";
    if (!k.startsWith("-parts/") && k.endsWith(".tsx")) return "page";
    return "";
  }
  const changed = new Set([...(written || [])].filter((x) => orig.has(x)));
  changed.add(k);
  return changed.size >= REWRITE_FILES ? "rewrite" : "";
}

/** The refusal that sends the agent to ask the price first. */
export function priceRefusal(kind, key) {
  const what = kind === "page" ? "a new page (" + key + ")" : kind === "feature" ? "new server code (" + key + ")" : "a change to " + REWRITE_FILES + " or more existing files";
  return "NOT WRITTEN: this is " + what + ", and the owner says yes to the price BEFORE a new page, a new feature or a rewrite is made. " +
    "Call ask_owner now: say in one or two plain lines what you will make and that it costs " + PRICE_RANGE[kind] + ", with the options exactly \"" + PRICE_YES + "\" and \"No\" " +
    "(you may add one cheaper choice). Write nothing else first.";
}

/** An ask_owner call made for the price must state it and offer the yes. */
export function priceAskProblem(ask) {
  if (!ask) return "";
  const opts = Array.isArray(ask.options) ? ask.options : [];
  if (!opts.includes(PRICE_YES)) return "the price question must offer the answer exactly \"" + PRICE_YES + "\"";
  if (!/\d/.test(String(ask.text || "")) || !/credit/i.test(String(ask.text || ""))) return "the price question must say what it costs, in credits";
  return "";
}

// ── PROVIDERS (M-8) ──────────────────────────────────────────────────────────
// The services server code may call on the owner's own key, by the hosts that
// give them away. A provider counts as chosen when the owner's words (this
// message, its answers, or the chat so far) name it.
export const PROVIDERS = Object.freeze([
  ["Stripe", ["stripe.com"]], ["PayPal", ["paypal.com"]], ["Square", ["squareup.com", "squareupsandbox.com"]],
  ["Lemon Squeezy", ["lemonsqueezy.com"]], ["Paddle", ["paddle.com"]], ["Mollie", ["mollie.com"]],
  ["Razorpay", ["razorpay.com"]], ["Adyen", ["adyen.com"]], ["Braintree", ["braintreegateway.com"]],
  ["Twilio", ["twilio.com"]], ["Vonage", ["vonage.com", "nexmo.com"]], ["Resend", ["resend.com"]],
  ["SendGrid", ["sendgrid.com"]], ["Mailgun", ["mailgun.net"]], ["Postmark", ["postmarkapp.com"]],
  ["OpenAI", ["openai.com"]], ["Anthropic", ["anthropic.com"]], ["Google Gemini", ["generativelanguage.googleapis.com"]],
].map(([name, hosts]) => Object.freeze({ name, hosts: Object.freeze(hosts) })));

const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The providers a piece of server code calls, by the hosts in its text. */
export function providersIn(source) {
  const s = String(source || "").toLowerCase();
  return PROVIDERS.filter((p) => p.hosts.some((h) => s.includes(h))).map((p) => p.name);
}

/** The providers this code calls that the owner's words never named. */
export function unchosenProviders(source, words) {
  const w = squash(words);
  return providersIn(source).filter((n) => !w.includes(squash(n)) && !(n === "Google Gemini" && w.includes("gemini")));
}

export function providerRefusal(names) {
  return "NOT WRITTEN: this code calls " + names.join(" and ") + ", and the owner never named " + (names.length > 1 ? "those providers" : "that provider") +
    ". Never choose a provider yourself: call ask_owner now and ask which one they use, with the common choices as options, then write the code for the one they pick.";
}

// ── DEAD LINKS (M-45) ────────────────────────────────────────────────────────
const routeOf = (k) => (k === "index.tsx" ? "/" : "/" + k.replace(/\.tsx$/, "").replace(/\/index$/, ""));
const LINK = /\b(?:href|to)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`$]*)["'`]\s*\})/g;

/** A page's address as a matcher: "$id" and "[id]" segments match any one segment. */
function matcher(route) {
  const segs = route.split("/").filter(Boolean);
  return (path) => {
    const p = path.split("/").filter(Boolean);
    if (segs.length && segs[segs.length - 1] === "$") return p.length >= segs.length - 1 && segs.slice(0, -1).every((s, i) => /^[$[]/.test(s) || s === p[i]);
    return p.length === segs.length && segs.every((s, i) => /^[$[]/.test(s) || s === p[i]);
  };
}

/**
 * LINKS TO PAGES THE SITE DOES NOT HAVE: `[{file, to}]`, read in pages and
 * the site's own components (the header's menu lives in one). Only the site's own
 * addresses are read (they start with "/"); the API, uploads, files with an
 * extension and the parts after ? or # are not pages.
 */
export function deadLinks(files) {
  const entries = files instanceof Map ? [...files] : Object.entries(files || {});
  const routes = entries.filter(([k]) => !k.startsWith("-parts/") && k.endsWith(".tsx")).map(([k]) => matcher(routeOf(k)));
  if (!routes.length) return [];
  const out = [], seen = new Set();
  for (const [k, src] of entries) {
    if (!k.endsWith(".tsx") && !k.startsWith("-parts/")) continue;
    for (const m of String(src || "").matchAll(LINK)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? "";
      if (!raw.startsWith("/") || raw.startsWith("//")) continue;
      const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
      if (/^\/(api|u|fn|_)\b/.test(path) || /\.[a-z0-9]{2,5}$/i.test(path)) continue;
      if (routes.some((r) => r(path))) continue;
      const id = k + " " + path;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ file: k, to: path });
    }
  }
  return out;
}

export function deadLinkNote(list, max = 12) {
  return "LINKS TO PAGES THE SITE DOES NOT HAVE:\n" + list.slice(0, max).map((d) => "- " + d.file + " links to " + d.to).join("\n") +
    "\nPoint each at a page that exists, or take the link out (or make the page, if the owner asked for it). Then build and finish.";
}

// ── M-66: THE REPLY NEVER CLAIMS WHAT FAILED ─────────────────────────────────
/** The agent's own words, with what really failed added (carry-over M-66, M-45); "" when there are none. */
export function agentSaidTruth(summary, { failed = [], dead = [], strays = [], draft = false, missing = [], facts = [], stale = [], unlinked = [], putBack = [], logoUnshown = false, values = [], oldName = [], emptyLists = [], removedRows = 0, seeded = [], stylesChecked = false } = {}) {
  const own = typeof summary === "string" ? scrubSaid(summary) : "";
  if (!own) return "";
  const add = [];
  if (failed.length) add.push("What did not work: " + failed.join(" "));
  if (dead.length) add.push("Links that point at pages your site does not have: " + dead.slice(0, 6).map((d) => d.to).join(", ") + ".");
  // M-41: a picture whose address held no file was left as an empty frame.
  if (strays.length) add.push(strays.length + (strays.length === 1 ? " picture was" : " pictures were") + " left empty: the address held no file. Send the photo and I'll put it in.");
  // M-67: words they asked for that are not on the site.
  if (missing.length) add.push("Not on the site yet: " + missing.map((w) => "\u201c" + w + "\u201d").join(", ") + ".");
  // M-69: details that came from nowhere the owner gave; they check them.
  if (facts.length) add.push("Please check these details, which you didn't give me: " + facts.join(", ") + ".");
  // M-71: files the build had to put back were not changed.
  if (putBack.length) add.push("These couldn't be changed (they didn't build) and were left as they were: " + scrubSaid(putBack.slice(0, 6).join(", ")) + ".");
  // M-47, M-54: links still pointing at the old number or email.
  if (stale.length) add.push("These links still go to the old details: " + stale.join(", ") + ".");
  // M-48: a new page nothing links to.
  if (unlinked.length) add.push("Nothing links to " + unlinked.join(", ") + " yet; visitors reach it only by its address.");
  // M-80: the values that changed, when the agent's words do not already give them.
  const newVals = values.filter((v) => { const m = String(v).match(/\u2192 ([^,.]+)/); return m && !own.includes(m[1].trim()); });
  if (newVals.length) add.push(newVals.join(" "));
  // M-55: the old business name still on the site.
  if (oldName.length) add.push("Your old name is still on " + scrubSaid(oldName.slice(0, 5).join(", ")) + ".");
  // M-35, M-52: a new list that starts with nothing in it.
  if (emptyLists.length) add.push("The " + emptyLists.join(", ") + " list" + (emptyLists.length > 1 ? "s start" : " starts") + " empty: add entries in your Data panel, or tell me what to put in.");
  // M-27: removed entries can be brought back.
  if (removedRows > 0) add.push((removedRows === 1 ? "The removed entry is" : "The " + removedRows + " removed entries are") + " kept: ask and I'll bring " + (removedRows === 1 ? "it" : "them") + " back.");
  // M-86: the small notes the old replies gave, only when the agent's words did not.
  for (const x of seeded) if (x && x.table && x.n && !own.includes(x.table)) add.push("Added " + x.n + " starter " + (x.n === 1 ? "entry" : "entries") + " to the new " + x.table + " list.");
  if (stylesChecked && !/\bstyle/i.test(own)) add.push("Your new styles were checked on the pages.");
  // M-53: the logo is stored but the header does not show it.
  if (logoUnshown) add.push("Your logo is saved, but the site's header doesn't show it yet.");
  // M-70: the change is in the draft until they press Publish (said once, unless the agent said it).
  if (draft && !/\bpublish/i.test(own)) add.push("These changes are in your draft: press Publish to put them on your live site.");
  return (own + (add.length ? "\n\n" + add.join("\n") : "")).slice(0, 4000);
}


// ══ CARRY-OVER BATCH 2 (2026-11-04) ══════════════════════════════════════════

// ── M-87 / M-89: A QUESTION IS NOT AN ANSWER, AND NEVER CHANGES THE SITE ─────
const ASKS_FOR_WORK = /\b(can|could|would|will) you\b|\bplease\b|\bi want\b|\bi.d like\b/i;
const QUESTION_START = /^\s*(what|how|why|when|where|which|who|whose|is|are|does|do|did|was|were|has|have|should|shall|am)\b/i;

/**
 * ONLY A QUESTION (M-89): the message asks about the site and asks for no
 * work. True only when every sentence that ends with "?" is a question, the
 * message has nothing else asking for work, and nothing in it is a request
 * ("can you…", "please", "add…"). When in doubt, false: the agent decides.
 */
export function questionOnly(message) {
  const m = String(message || "").trim();
  if (!m || !m.endsWith("?") || m.length > 400) return false;
  if (ASKS_FOR_WORK.test(m)) return false;
  const parts = m.split(/(?<=[?.!])\s+/).filter(Boolean);
  return parts.every((p) => p.endsWith("?") && QUESTION_START.test(p));
}

export const QUESTION_ONLY = "NOT DONE: the owner's message is only a question, so nothing on the site changes. Answer it in plain words in finish (read what you need first); if they might want a change, offer it with ask_owner.";

/**
 * A SIDE QUESTION WHILE A QUESTION WAITS (M-87): a typed message that is
 * itself a question, and not one of the waiting question's answers, leaves
 * the question waiting. A tapped answer is always the answer.
 */
export function sideQuestion(message, { chosen = false, options = [] } = {}) {
  if (chosen === true) return false;
  const m = String(message || "").trim();
  const low = m.toLowerCase().replace(/[?.!\s]+$/, "");
  if ((Array.isArray(options) ? options : []).some((o) => typeof o === "string" && o.trim().toLowerCase().replace(/[?.!\s]+$/, "") === low)) return false;
  return questionOnly(m);
}

// ── M-22: THE SAME ENTRY IS NOT ADDED TWICE ──────────────────────────────────
export const DUP_YES = "Add it again";
const norm = (v) => (v == null ? "" : typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : String(v));

/** The adds that repeat an existing row (every value given equal) or each other: `[{i, why}]`. */
export function duplicateAdds(adds, rows = [], pk = "id") {
  const out = [];
  const same = (a, r) => { const ks = Object.keys(a).filter((k) => k !== pk && a[k] != null && a[k] !== ""); return ks.length > 0 && ks.every((k) => norm(a[k]) === norm(r[k])); };
  (Array.isArray(adds) ? adds : []).forEach((a, i) => {
    if (!a || typeof a !== "object") return;
    if ((Array.isArray(rows) ? rows : []).some((r) => r && same(a, r))) out.push({ i, why: "already in the table" });
    else if (adds.slice(0, i).some((b) => b && same(a, b) && same(b, a))) out.push({ i, why: "twice in this change" });
  });
  return out;
}

export function duplicateRefusal(table, dups, adds) {
  const name = (a) => { const v = Object.values(a || {}).find((x) => typeof x === "string" && x.trim()); return v ? "“" + v.slice(0, 60) + "”" : "an entry"; };
  return "NOT QUEUED: " + dups.slice(0, 6).map((d) => name(adds[d.i]) + " is " + d.why).join("; ") + " (" + table + "). Leave the repeats out, or, if the owner may really want it twice, ask with ask_owner, offering exactly \"" + DUP_YES + "\".";
}

// ── M-20: A LIST IS SHOWN WHOLE OR SAID TO BE CUT ────────────────────────────
/** Whole rows that fit in `max` characters, and a line saying how many were left out. */
export function fitRows(rows, max) {
  const list = Array.isArray(rows) ? rows : [];
  const kept = [];
  let size = 2;
  for (const r of list) {
    const s = JSON.stringify(r);
    if (size + s.length + 1 > max) break;
    kept.push(r); size += s.length + 1;
  }
  const text = JSON.stringify(kept);
  return kept.length === list.length ? text : text + "\n[" + kept.length + " of the " + list.length + " rows read are shown; the rest did not fit. Read fewer columns' worth, or change rows only by the ids you have seen.]";
}

// ── M-38: A QR CODE POINTS AT A PAGE THE SITE HAS ────────────────────────────
/** True when `path` is one of the workspace's pages (params match any one segment). */
export function pageExists(files, path) {
  const entries = files instanceof Map ? [...files.keys()] : Object.keys(files || {});
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return entries.filter((k) => !k.startsWith("-parts/") && k.endsWith(".tsx")).some((k) => matcher(routeOf(k))(p));
}

// ── M-41: PICTURE ADDRESSES THAT HOLD NO FILE ────────────────────────────────
export function strayNote(urls) {
  return "THESE PICTURE ADDRESSES HOLD NO FILE (they would show as broken images):\n" + urls.slice(0, 10).map((u) => "- " + u).join("\n") +
    "\nUse only addresses read_attachment or attach_media gave you, or the site already uses. Fix them, build, and finish.";
}

// ══ CARRY-OVER BATCH 3 (2026-11-04) ══════════════════════════════════════════

// ── M-68: WHAT THE DATABASE REFUSED IS NEVER REPORTED AS ADDED ───────────────
/** The refusals in `applySiteSchema`'s answer, as short plain lines (names only). */
export function schemaRefusals(made) {
  const out = [];
  if (!made || typeof made !== "object") return out;
  for (const r of Array.isArray(made.refusedRules) ? made.refusedRules : []) {
    if (r && typeof r.table === "string") out.push("the " + String(r.feature || "rule") + " rule on " + r.table + (r.rule ? " (" + String(r.rule).slice(0, 60) + ")" : ""));
  }
  for (const f of Array.isArray(made.functionErrors) ? made.functionErrors : []) {
    const name = f && typeof f === "object" ? f.name || f.fn || f.table : typeof f === "string" ? f : "";
    out.push("the database function " + String(name || "(unnamed)").slice(0, 60));
  }
  return out.slice(0, 12);
}

// ── M-24: AN ADDRESS ONLY ON THE OWNER'S OWN WORDS ───────────────────────────
/** True when the owner's words name this exact address (as a word, or as name.gofarther.app). */
export function addressNamed(words, name) {
  const w = String(words || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  if (!n) return false;
  const esc = n.replace(/[-]/g, "\\-");
  return new RegExp("(^|[^a-z0-9-])" + esc + "($|[^a-z0-9-])").test(w);
}

export const ADDRESS_UNNAMED = (name, rename) => "NOT DONE: the owner never named the address “" + name + "”. " +
  (rename ? "A site's address moves only to one they choose: ask with ask_owner which address they want (you may suggest two or three as options)." : "An old address is let go only when they name it: ask with ask_owner first.") +
  " Their exact words must name it.";

// ── M-23: NO THIRD-PARTY SCRIPTS OR RAW HTML IN A PAGE ───────────────────────
// The builder never offered "paste anything into your head". A page may carry
// structured data (`__html: JSON.stringify(...)`); it may not carry raw HTML or
// a script from another site. Only what this write brings in is judged.
const RAW_HTML = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:(?!\s*JSON\.stringify\()/g;
const OUTSIDE_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*\{?\s*["'`](?:https?:)?\/\//gi;
const HEAD_SCRIPT = /\bscripts\s*:\s*\[[^\]]*\bsrc\s*:\s*["'`](?:https?:)?\/\//g;
const INLINE_SCRIPT = /<script\b(?![^>]*type\s*=\s*["'`]application\/ld\+json)[^>]*>\s*[^<\s]/gi;
const count = (re, s) => (String(s || "").match(re) || []).length;

/** Why this write may not go in ("" when it may): raw HTML or an outside script it adds. */
export function scriptProblem(before, after) {
  const grew = (re) => count(re, after) > count(re, before);
  if (grew(RAW_HTML)) return "raw HTML (dangerouslySetInnerHTML with anything but JSON.stringify)";
  if (grew(OUTSIDE_SCRIPT) || grew(HEAD_SCRIPT)) return "a script loaded from another site";
  if (grew(INLINE_SCRIPT)) return "a <script> written into the page";
  return "";
}

export const SCRIPT_REFUSAL = (what) => "NOT WRITTEN: the page would carry " + what + ". The builder never puts pasted HTML or a third-party script into a site (it can read visitors' data and break the page). Build what it does as a component, or as server code with the owner's key, and say in finish if a provider's embed was asked for.";

// ── M-39: A QR CODE IS NEVER COPIED BY THE MODEL ─────────────────────────────
// make_qr hands the agent a short placeholder address; the picture itself (a
// long base64 address, where one wrong character scans wrong) is put in by
// code when the files leave the agent (to a build, a look, or the save).
// Each run's placeholders carry its own id, so a helper's never collide with its caller's.
export const qrToken = (n, run = "a") => "/__gf_qr/" + run + "-" + n + ".svg";
const QR_TOKEN = /\/__gf_qr\/([a-z0-9]{1,12}-\d{1,3})\.svg/g;

/** Files with every known placeholder replaced by its picture. */
export function expandQr(list, map) {
  if (!map || !map.size) return list;
  return (Array.isArray(list) ? list : []).map((f) => (f && typeof f.source === "string" && f.source.includes("/__gf_qr/") ? { ...f, source: f.source.replace(QR_TOKEN, (t) => map.get(t) || t) } : f));
}

/** Placeholders in the files that make_qr never gave (an invented one would be a broken image). */
export function unknownQr(files, map) {
  const out = new Set();
  for (const src of files instanceof Map ? files.values() : Object.values(files || {})) {
    for (const m of String(src || "").matchAll(QR_TOKEN)) if (!map || !map.has(m[0])) out.add(m[0]);
  }
  return [...out];
}

// ══ CARRY-OVER BATCH 4 (2026-11-04) ══════════════════════════════════════════

// ── M-43: AN EDIT OF ONE PAGE STAYS ON THAT PAGE ─────────────────────────────
const SITE_WIDE = /\b(every|all|each|other) pages?\b|\bsite[- ]?wide\b|\beverywhere\b|\b(whole|entire|full) (site|website)\b|\bheader\b|\bfooter\b|\bmenu bar\b|\bnav(igation|bar)?\b|\blogo\b|\bcolou?rs?\b|\bfonts?\b|\btheme\b|\bstyles?\b|\bbrand(ing)?\b|\bsite name\b|\bacross\b/i;
const routeName = (k) => (k === "index.tsx" ? "/" : "/" + k.replace(/\.tsx$/, "").replace(/\/index$/, ""));

/**
 * THE ONE PAGE A MESSAGE NAMES: `["/about"]` when the owner's words name
 * exactly one of the site's pages ("/about", "the about page", "home page")
 * and nothing site-wide; `null` otherwise (the agent writes anywhere, as before).
 */
export function namedScope(message, pages) {
  const m = " " + String(message || "").toLowerCase() + " ";
  if (SITE_WIDE.test(m)) return null;
  // A MOVE OR A LINK REACHES ANOTHER ADDRESS by its nature: never scoped.
  if (/\brenam|\bmove|\bcall (it|the|this)\b|\baddress\b|\burl\b|\blinks?\b|\bredirect/.test(m)) return null;
  const hit = new Set();
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || p.path.includes("$") || p.path.includes("[")) continue;
    const r = routeName(p.path);
    if (r === "/") { if (/\bhome ?page\b|\bhome page\b|\blanding page\b|\bfront page\b/.test(m)) hit.add("/"); continue; }
    const name = r.slice(1).replace(/[-_/]/g, " ");
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (m.includes(" " + r + " ") || m.includes(" " + r + "/") || m.includes(r + "?") || m.includes(r + ".") || m.includes(r + ",") || new RegExp("\\b(the |my |our )?" + esc + " page\\b").test(m) || new RegExp("\\bon (the |my )?" + esc + "\\b").test(m)) hit.add(r);
  }
  return hit.size === 1 ? [...hit] : null;
}

// ── M-46: A ONE-TIME REMINDER FIRES ONCE ─────────────────────────────────────
// A schedule has no "once": "remind me on the 3rd of March" written as
// cron:0 9 3 3 * comes round every year. Unless the owner's words ask for a
// repeat, a schedule fixed to a day of the month must be guarded with its year
// in the code, so it runs once.
const REPEAT_WORDS = /\b(every|each|monthly|yearly|annually|weekly|daily|recurring|repeat(ing)?|always)\b/i;

/** The fixed-date schedules in a server part that would repeat although no repeat was asked. */
export function repeatingDates(source, words) {
  if (REPEAT_WORDS.test(String(words || ""))) return [];
  const out = [];
  for (const m of String(source || "").matchAll(/["']cron:(?:TZ=\S+\s+)?([0-9*,/-]+)\s+([0-9*,/-]+)\s+([0-9*,/-]+)\s+([0-9*,/-]+)\s+([0-9*,/-]+)["']/g)) {
    const [, , , day] = m;
    if (/^\d{1,2}$/.test(day)) out.push(m[0].slice(1, -1));
  }
  if (!out.length) return [];
  return /\b20\d\d\b/.test(String(source || "")) ? [] : out;
}

export const REPEAT_REFUSAL = (crons) => "NOT WRITTEN: " + crons.join(", ") + " comes round again every month or year, but the owner asked for it once. " +
  "Keep the schedule and, at the top of the function, do nothing unless the current date (in the schedule's zone) is in the year it is for (write the year in the code), so it runs once; or, if they want it to repeat, ask them.";

// ── M-67: WORDS THE OWNER ASKED FOR ARE ON THE SITE ──────────────────────────
// Quoted words the owner asked to be put on the site ("make the heading say
// 'Fresh daily'") must be found in a file after the change. Only quotes that
// follow a word asking for them are read; a quote of what is there now is not.
const ASKED_QUOTE = /\b(?:to|say|says|saying|read|reads|reading|with|add|adding|called|named|titled|as|text|heading|button|label|tagline|slogan)\s*:?\s*["“‘']([^"”’']{3,160})["”’']/gi;
const flat = (s) => String(s || "").toLowerCase().replace(/&amp;/g, "&").replace(/&apos;|&#39;|’/g, "'").replace(/\{["'`]\s*["'`]\}/g, "").replace(/\s+/g, " ");

/** Quoted words the owner asked for that no file holds after the change. */
export function missingWords(message, files) {
  const all = flat([...(files instanceof Map ? files.values() : Object.values(files || {}))].join("\n"));
  const out = [];
  for (const m of String(message || "").matchAll(ASKED_QUOTE)) {
    const want = flat(m[1]).trim();
    if (want && !all.includes(want) && !out.includes(m[1].trim())) out.push(m[1].trim());
  }
  return out.slice(0, 8);
}

export const MISSING_NOTE = (list) => "THE OWNER ASKED FOR THESE WORDS AND NO FILE HOLDS THEM:\n" + list.map((w) => "- “" + w + "”").join("\n") +
  "\nPut each in, exactly as written, where they asked; or, if you cannot, say so in finish.";

// ── M-69: NO FACTS OF THE AGENT'S OWN ────────────────────────────────────────
// Phone numbers, email addresses and prices are facts only the owner can give.
// Any that a change brings onto the site must come from the owner's words, the
// site as it was, or what the agent read (attachments, an imported site, tables).
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d{2,5}[\s.-]\d{3,4}[\s.-]?\d{3,4}\b/g;
const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PRICE = /[£$€]\s?\d{1,6}(?:[.,]\d{2})?\b|\b\d{1,6}(?:[.,]\d{2})?\s?(?:€|eur|usd|gbp)\b/gi;
const digits = (s) => s.replace(/\D/g, "");

/** Phone numbers, emails and prices in `after` that are in neither `before` nor `known`. */
export function newFacts(before, after, known) {
  const had = String(before || "") + "\n" + String(known || "");
  const hadDigits = digits(had), hadLow = had.toLowerCase();
  const out = new Set();
  const text = String(after || "").replace(/className=\{?["'`][^"'`]*["'`]\}?/g, "");
  for (const m of text.matchAll(PHONE)) { const d = digits(m[0]); if (d.length >= 7 && !hadDigits.includes(d)) out.add(m[0].trim()); }
  for (const m of text.matchAll(EMAIL)) if (!hadLow.includes(m[0].toLowerCase()) && !/example\.(com|org)$/i.test(m[0])) out.add(m[0]);
  for (const m of text.matchAll(PRICE)) { const n = m[0].replace(/[^\d.,]/g, ""); if (!had.includes(n) && !had.includes(n.replace(/[.,]00$/, ""))) out.add(m[0].trim()); }
  return [...out].slice(0, 10);
}

export const FACTS_NOTE = (list) => "THESE DETAILS ARE NOT IN THE OWNER'S WORDS, THE SITE, OR ANYTHING YOU READ:\n" + list.map((f) => "- " + f).join("\n") +
  "\nNever supply a phone number, email or price yourself. Replace each with a clearly marked placeholder (for example \"[Phone number]\") and say in finish what is missing, unless the owner gave it.";

// ══ CARRY-OVER BATCH 5 (2026-11-04) ══════════════════════════════════════════

// ── M-30, M-79, M-81, M-85: WHAT REACHES THE CUSTOMER ────────────────────────
// The agent's own words are shown as written, so they are cleaned the way the
// old reply writer's were: no key-shaped strings or provider names we never
// show, no emoji or checkmarks, no version ids, and no file names (the page or
// section they are).
export function scrubSaid(text) {
  let t = String(text || "");
  t = t.replace(/\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{6,}\b/g, "[hidden]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/g, "[hidden]")
    .replace(/\b(?:xai|sk-ant|sk-proj|sk)-[A-Za-z0-9_-]{16,}\b/g, "[hidden]")
    .replace(/\bfal(?:\.ai)?\b/gi, "the picture service");
  t = t.replace(/\b\d{13,14}-[a-z0-9]{6}\b/g, "a saved version");
  t = t.replace(/`?-parts\/server-([a-z0-9-]+)`?/g, (_, n) => "the " + n.replace(/-/g, " ") + " server function")
    .replace(/`?-parts\/([a-z0-9-]+)`?/g, (_, n) => "the " + n.replace(/-/g, " ") + " section")
    .replace(/`?\bindex\.tsx`?/g, "the home page")
    .replace(/`?\b([a-z0-9][a-z0-9_-]*(?:\/[a-z0-9_$-]+)*)\.tsx`?/g, (_, p) => "the /" + p.replace(/\/index$/, "") + " page")
    .replace(/`?\bstyles\.css`?/g, "the site's styles");
  t = t.replace(/\p{Extended_Pictographic}\p{Variation_Selector}?\s?/gu, "");
  return t.replace(/[ \t]{2,}/g, " ").trim();
}

// ── M-5: AN ENTRY THE DATABASE WILL REFUSE IS NOT QUEUED ─────────────────────
/** Why each add or update would be refused by the table's own rules (required, allowed values, length). */
export function rowProblems(tableSpec, add = [], update = [], pk = "id") {
  const cols = tableSpec && Array.isArray(tableSpec.columns) ? tableSpec.columns.filter((c) => c && typeof c === "object" && c.name) : [];
  const out = [];
  const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());
  const check = (o, where, isAdd) => {
    for (const c of cols) {
      if (c.name === pk || c.pk || c.primary) continue;
      const v = o ? o[c.name] : undefined;
      const req = !!(c.notnull || c.required || c.notNull) && c.default === undefined && c.defaultValue === undefined;
      if (isAdd && req && isEmpty(v)) out.push(where + ": " + c.name + " is required");
      if (v === undefined || v === null) continue;
      const allowed = c.enum || c.oneOf || c.values;
      if (Array.isArray(allowed) && allowed.length && !allowed.map(String).includes(String(v))) out.push(where + ": " + c.name + " must be one of " + allowed.slice(0, 8).join(", "));
      const max = c.max !== undefined ? c.max : c.maxLength;
      if (typeof v === "string" && Number.isInteger(max) && v.length > max) out.push(where + ": " + c.name + " is over " + max + " characters");
    }
  };
  (Array.isArray(add) ? add : []).forEach((o, i) => check(o, "add " + (i + 1), true));
  (Array.isArray(update) ? update : []).forEach((u, i) => check(u && u.set, "update " + (i + 1), false));
  return out.slice(0, 10);
}

// ── M-28: NO BLIND OVERWRITE ─────────────────────────────────────────────────
/** True when `after` keeps at least half of `before`'s non-blank lines (or `before` is tiny). */
export function keepsMost(before, after) {
  const lines = (s) => String(s || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const b = lines(before);
  if (b.length < 3) return String(after || "").includes(String(before || "").trim().slice(0, 40));
  const a = new Set(lines(after));
  return b.filter((l) => a.has(l)).length * 2 >= b.length;
}

// ══ CARRY-OVER BATCH 6 (2026-11-04) ══════════════════════════════════════════

// ── M-47, M-54: A CHANGED NUMBER OR EMAIL TAKES ITS LINKS WITH IT ────────────
const TEL = /tel:\+?([\d\s().-]{7,})/gi;
const MAILTO = /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;
const textOnly = (s) => String(s || "").replace(/(?:tel|mailto):[^"'`\s}>]+/gi, " ");

/** tel: and mailto: links in `after` whose number or address the visible text no longer shows, though `before` did. */
export function staleContactLinks(before, after) {
  const out = new Set();
  const bText = textOnly(before), aText = textOnly(after);
  const bDigits = (bText.match(/\d[\d\s().-]{6,}\d/g) || []).map((x) => x.replace(/\D/g, ""));
  const aDigits = (aText.match(/\d[\d\s().-]{6,}\d/g) || []).map((x) => x.replace(/\D/g, ""));
  for (const m of String(after || "").matchAll(TEL)) {
    const d = m[1].replace(/\D/g, "");
    const shown = (list) => list.some((x) => x.endsWith(d.slice(-9)) || d.endsWith(x.slice(-9)));
    if (shown(bDigits) && !shown(aDigits)) out.add("tel:" + m[1].trim());
  }
  const bLow = bText.toLowerCase(), aLow = aText.toLowerCase();
  for (const m of String(after || "").matchAll(MAILTO)) {
    const e = m[1].toLowerCase();
    if (bLow.includes(e) && !aLow.includes(e)) out.add("mailto:" + m[1]);
  }
  return [...out];
}

// ── M-48: A NEW PAGE IS REACHABLE ────────────────────────────────────────────
/** New pages (no route parameters) that no file links to. */
export function unlinkedNewPages(files, orig) {
  const entries = files instanceof Map ? [...files] : Object.entries(files || {});
  const all = entries.map(([, s]) => String(s || "")).join("\n");
  const out = [];
  for (const [k] of entries) {
    if (k.startsWith("-parts/") || !k.endsWith(".tsx") || k.includes("$") || k.includes("[") || (orig && orig.has(k)) || k === "index.tsx") continue;
    const r = routeName(k);
    const re = new RegExp("(?:href|to)\\s*=\\s*\\{?\\s*[\"'`]" + r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:[\"'`/?#])");
    if (!re.test(all)) out.push(r);
  }
  return out;
}

// ── M-64: A PAGE THE SITE DOES NOT HAVE ──────────────────────────────────────
const MAKING = /\b(add|create|make|build|new|start|set up|put up)\b/i;
/** "the X page" in the owner's words where the site has no X page, and nothing asks to make one. */
export function pageNotThere(message, pages) {
  const m = String(message || "").toLowerCase();
  if (MAKING.test(m)) return "";
  const have = new Set((Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.path === "string").map((p) => routeName(p.path).slice(1).replace(/[-_/]/g, " ")).filter(Boolean));
  for (const x of m.matchAll(/\b(?:the|my|our) ((?:[a-z-]+ )?[a-z-]+) page\b/g)) {
    const name = x[1].trim();
    if (["home", "landing", "front", "main", "whole", "same", "this", "that", "next", "last", "first", "new"].includes(name)) continue;
    if (!have.has(name) && ![...have].some((h) => h.includes(name) || name.includes(h))) return name;
  }
  return "";
}

// ── M-56: ONE LANGUAGE OFF IS ONE LANGUAGE OFF ───────────────────────────────
const langName = (tag) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) || tag; } catch { return tag; } };
/** Languages the new whole list drops that the owner's words never name (`unnamed`). */
export function droppedLanguages(current, next, words) {
  const w = String(words || "").toLowerCase();
  const keep = new Set((next || []).map((t) => String(t).toLowerCase()));
  const named = (t) => w.includes(String(t).toLowerCase()) || w.includes(langName(t).toLowerCase().split(" (")[0]);
  const dropped = (current || []).filter((t) => !keep.has(String(t).toLowerCase()));
  return { unnamed: dropped.filter((t) => !named(t)).map((t) => langName(t) + " (" + t + ")"), missing: [] };
}
