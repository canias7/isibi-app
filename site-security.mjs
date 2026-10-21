// THE QUICK SECURITY CHECK (2026-10-21, phase A of
// docs/plans/2026-10-21-site-security-scan.md; owner: "Ok go").
//
// Questions a program can answer outright about a customer's site, with no
// model and no cost: what its tables let anyone read or write, whether its forms
// are protected from bots, and whether a secret key is sitting in its published
// code. Pure: the Worker gathers the facts (`tables` from the owner's own table
// list, `spamProtected` from the site's secrets, `files` from the build it
// serves) and this decides what they mean.
//
// Every finding names what is wrong in the owner's words, why it matters, and
// what to do. A check that ran and found nothing is reported as PASSED, so the
// report says what was looked at, never "secure".

import { ACCESS_PRESETS } from "./site-access.mjs";

/** Columns whose values are a person's private details. */
const PRIVATE = /(^|_)(e?mail|phone|mobile|tel|address|postcode|zip|dob|birth|password|passcode|ssn|passport|licen[cs]e|iban|card_number|account_number|sort_code|salary|medical|health)(_|$)/i;

/** Keys that must never reach a page. Each with the service it belongs to, for the sentence. */
const SECRETS = [
  [/\bsk_live_[0-9A-Za-z]{10,}/, "a live Stripe secret key"],
  [/\bsk_test_[0-9A-Za-z]{10,}/, "a Stripe test secret key"],
  [/\brk_live_[0-9A-Za-z]{10,}/, "a Stripe restricted key"],
  [/\bwhsec_[0-9A-Za-z]{16,}/, "a Stripe webhook secret"],
  [/\bre_[0-9A-Za-z]{8,}_[0-9A-Za-z]{8,}/, "a Resend email key"],
  [/\bSG\.[0-9A-Za-z_-]{16,}\.[0-9A-Za-z_-]{16,}/, "a SendGrid email key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an Amazon (AWS) access key"],
  [/\bsk-ant-[0-9A-Za-z_-]{20,}/, "an Anthropic API key"],
  [/\bxai-[0-9A-Za-z]{20,}/, "an xAI API key"],
  [/\bsk-(?:proj-)?[0-9A-Za-z_-]{32,}/, "an OpenAI API key"],
  [/\bpostgres(?:ql)?:\/\/[^\s"'`:@/]+:[^\s"'`@]+@[^\s"'`]+/, "a database connection with its password"],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, "a private key"],
];

/** A table's read and write levels from the owner list's label (a preset name or "read X / write Y"). */
export function accessPair(label) {
  const s = typeof label === "string" ? label.trim().toLowerCase() : "";
  if (Object.hasOwn(ACCESS_PRESETS, s)) return { ...ACCESS_PRESETS[s] };
  const m = s.match(/^read (none|own|members|public) \/ write (none|own|members|anyone)$/);
  return m ? { read: m[1], write: m[2] } : null;
}

/**
 * The checks. `tables`: [{ name, access, columns }] (the owner table list; empty
 * for a site with no database). `spamProtected`: true, false, or null when it
 * could not be told. `files`: [{ path, text }] of the published code.
 * Answers `{ findings, passed }`: findings carry `id`, `severity` (high | medium
 * | low), `title`, `why`, `fix`, and `where`; passed is the plain list of what was
 * checked and found fine.
 */
export function quickChecks({ tables = [], spamProtected = null, files = [] } = {}) {
  const findings = [];
  const passed = [];
  const list = (Array.isArray(tables) ? tables : []).filter((t) => t && typeof t.name === "string");

  // 1. PRIVATE DETAILS ANYONE CAN READ.
  let open = 0;
  for (const t of list) {
    const p = accessPair(t.access);
    if (!p || p.read !== "public") continue;
    const cols = (Array.isArray(t.columns) ? t.columns : []).filter((c) => typeof c === "string" && PRIVATE.test(c));
    if (!cols.length) continue;
    open++;
    findings.push({
      id: "open-private:" + t.name, severity: "high",
      title: "Anyone on the internet can read the " + t.name + " list",
      why: "It holds " + cols.slice(0, 4).join(", ") + (cols.length > 4 ? " and more" : "") + ", which are people's private details.",
      fix: "Make " + t.name + " readable only by you (or only by each signed-in person for their own rows).",
      where: t.name,
    });
  }
  if (list.length && !open) passed.push("No list with people's private details is open to everyone.");

  // 2. A PUBLIC LIST ANYONE CAN WRITE INTO.
  let vandal = 0;
  for (const t of list) {
    const p = accessPair(t.access);
    if (!p || p.read !== "public" || p.write !== "anyone") continue;
    vandal++;
    findings.push({
      id: "open-write:" + t.name, severity: "medium",
      title: "Anyone can add to the " + t.name + " list, and it shows on your site",
      why: "A stranger could put anything there, and every visitor would see it.",
      fix: "Let visitors send entries that only you can see, or require people to sign in before adding.",
      where: t.name,
    });
  }
  if (list.length && !vandal) passed.push("Nothing visitors write shows publicly without a sign-in.");

  // 3. FORMS WITH NO BOT PROTECTION.
  const forms = list.filter((t) => { const p = accessPair(t.access); return p && p.write === "anyone"; });
  if (forms.length && spamProtected === false) {
    findings.push({
      id: "no-spam-protection", severity: "low",
      title: "Your forms have no protection from bots",
      why: forms.map((t) => t.name).slice(0, 4).join(", ") + (forms.length === 1 ? " takes" : " take") + " entries from anyone; bots are usually the first to find a form.",
      fix: "Turn on spam protection (Cloudflare Turnstile) under More → Secrets.",
      where: forms.map((t) => t.name).join(", "),
    });
  } else if (forms.length && spamProtected === true) passed.push("Your forms are protected from bots.");

  // 4. SECRET KEYS IN THE PUBLISHED CODE.
  let leaked = 0;
  const seen = new Set();
  for (const f of (Array.isArray(files) ? files : [])) {
    if (!f || typeof f.text !== "string") continue;
    for (const [re, what] of SECRETS) {
      if (seen.has(what) || !re.test(f.text)) continue;
      seen.add(what);
      leaked++;
      findings.push({
        id: "secret-in-code:" + what, severity: "high",
        title: "Your published site contains " + what,
        why: "Anything in a page can be read by any visitor, who could then use the key as you.",
        fix: "Replace that key with a new one at the service that issued it, and keep it in More → Secrets instead of the page.",
        where: String(f.path || ""),
      });
    }
  }
  if (files.length && !leaked) passed.push("No secret keys were found in your published code.");

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { findings, passed };
}
