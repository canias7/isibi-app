// THE KEY CARD'S SERVER HALF (2026-10-30, owner: "when the model says add key,
// in the chat I want a server thing that pulls up and collects the key,
// WITHOUT THE MODEL TOUCHING IT").
//
// A reply names the keys the site still needs as `needKeys`: NAMES only, each
// with the service it belongs to and why, never a value. Two sources:
//   • the finished server code's own evidence (`serverEvidence(...).keys`),
//     every key it reads that `list_keys` did not answer as set;
//   • the agent's `request_key` tool, which can only ADD A NAME here.
// The chat turns the list into a card whose inputs POST straight to
// `/api/site/<slug>/secrets` (the owner's existing keys route). The value goes
// from the owner's browser to the site's secret store and nowhere else; the
// next agent run learns only that the name is set, through `list_keys`.

import { normalizeSecretName } from "../site-secrets.mjs";

export const NEED_KEYS_MAX = 8;
const TEXT_MAX = 160;

// The service a key belongs to, read from its name's prefix. A name nobody
// recognises goes without one: a guess shown to an owner is worse than none.
const SERVICES = [
  ["STRIPE_", "Stripe"], ["RESEND_", "Resend"], ["TWILIO_", "Twilio"], ["SENDGRID_", "SendGrid"],
  ["MAILGUN_", "Mailgun"], ["POSTMARK_", "Postmark"], ["OPENAI_", "OpenAI"], ["ANTHROPIC_", "Anthropic"],
  ["TURNSTILE_", "Cloudflare Turnstile"], ["PAYPAL_", "PayPal"], ["SQUARE_", "Square"], ["SHOPIFY_", "Shopify"],
  ["GOOGLE_", "Google"], ["MAPBOX_", "Mapbox"], ["SLACK_", "Slack"], ["DISCORD_", "Discord"], ["AIRTABLE_", "Airtable"],
  ["MAILCHIMP_", "Mailchimp"], ["CALENDLY_", "Calendly"], ["NOTION_", "Notion"], ["GITHUB_", "GitHub"],
];
export function serviceOf(name) {
  const n = String(name || "");
  const hit = SERVICES.find(([p]) => n.startsWith(p));
  return hit ? hit[1] : "";
}

const plain = (v) => typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, TEXT_MAX) : "";

/**
 * One `request_key` call, judged. Answers `{ ok:true, key }` or `{ ok:false, why }`.
 * A `value` (or anything like one) in the input is refused, never kept: the
 * tool takes a name, and a model that tries to hand a key over is told so.
 */
export function keyAsk(input) {
  const i = input && typeof input === "object" ? input : {};
  for (const k of ["value", "key", "secret", "token"]) if (Object.hasOwn(i, k)) return { ok: false, why: "request_key takes a NAME only; the owner types the value into a secure box you never see" };
  if (typeof i.name !== "string") return { ok: false, why: "name the key, e.g. STRIPE_SECRET_KEY" };
  const name = normalizeSecretName(i.name);
  if (!name) return { ok: false, why: "a key name starts with a letter and uses A-Z, 0-9 and _ (at most 64)" };
  return { ok: true, key: { name, service: plain(i.service) || serviceOf(name), why: plain(i.why) } };
}

/**
 * The reply's `needKeys`: the names the server code needs and the owner has
 * not set, then the names the agent asked for, deduplicated and capped. A key
 * known to be set is never asked for; a name that fails the site-secrets rule
 * never reaches the card. Unknown (`set: null`) is asked: the card reads the
 * keys list itself and shows a set one as set.
 */
export function needKeysOf({ evidence = null, asked = [], keysSet = null } = {}) {
  const set = new Set(Array.isArray(keysSet) ? keysSet.filter((n) => typeof n === "string") : []);
  const out = [];
  const add = (k) => {
    const name = k && typeof k.name === "string" ? normalizeSecretName(k.name) : null;
    if (!name || set.has(name) || out.some((o) => o.name === name) || out.length >= NEED_KEYS_MAX) return;
    const service = plain(k.service) || serviceOf(name);
    const why = plain(k.why);
    out.push({ name, ...(service ? { service } : {}), ...(why ? { why } : {}) });
  };
  for (const k of evidence && Array.isArray(evidence.keys) ? evidence.keys : []) if (k && k.set !== true) add({ name: k.name, why: "the site's server code uses it" });
  for (const k of Array.isArray(asked) ? asked : []) add(k);
  return out;
}
