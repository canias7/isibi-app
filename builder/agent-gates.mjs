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
export function agentSaidTruth(summary, { failed = [], dead = [], strays = [], draft = false } = {}) {
  const own = typeof summary === "string" ? summary.trim() : "";
  if (!own) return "";
  const add = [];
  if (failed.length) add.push("What did not work: " + failed.join(" "));
  if (dead.length) add.push("Links that point at pages your site does not have: " + dead.slice(0, 6).map((d) => d.to).join(", ") + ".");
  // M-41: a picture whose address held no file was left as an empty frame.
  if (strays.length) add.push(strays.length + (strays.length === 1 ? " picture was" : " pictures were") + " left empty: the address held no file. Send the photo and I'll put it in.");
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
