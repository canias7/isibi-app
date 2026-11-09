// WHAT GLOOPY MAY DO ON ITS OWN (owner, 2026-11-09: "on the settings for Gloopy ... a list of things, and then have ask,
// deny, and always allow"; like Grok Bot's Custom Rules, "Ask first" or "Allow automatically", and dots' custom rules).
// One setting for each kind of action that matters: Ask (a card each time: Allow once, Always allow or Deny), Always
// allow, or Deny (Gloopy doesn't do it, not even another way).
//
// FOR TESTING, EVERYTHING IS "ALWAYS ALLOW" (owner, 2026-11-09: "the default for testing and all what we're doing is
// going to be like always allow, so we can test it"): no cards, and no extra check call before browser steps. The
// settings screen comes at the end; then DEFAULT_MODE becomes "ask".
//
// Shared by Gloopy's machine (its checks and its tools follow them) and Coder's Worker (which keeps the owner's choices
// and checks again what a turn asks to keep). Only what Cloudflare's Workers have: no Node APIs.

/** The list, in the order the settings screen shows it. */
export const PERMISSIONS = Object.freeze([
  { key: "buy", label: "Buy or pay", hint: "Orders, checkouts, payments, donations" },
  { key: "book", label: "Book or reserve", hint: "Tables, tickets, travel, appointments" },
  { key: "send", label: "Send messages or emails", hint: "To anyone but you" },
  { key: "post", label: "Post or publish", hint: "Social media, reviews, comments, public forms" },
  { key: "signup", label: "Sign up or subscribe", hint: "New accounts, newsletters, accepting terms" },
  { key: "delete", label: "Delete or cancel", hint: "Deleting things, cancelling orders or plans, unsubscribing" },
  { key: "account", label: "Change account settings", hint: "Profile, privacy and other settings of your accounts" },
  { key: "share", label: "Share your personal details", hint: "Your address, phone number or other details in a form" },
  { key: "schedule", label: "Repeating schedules", hint: "Tasks that run every day or week (each run uses Grok)" },
  { key: "wake", label: "Wake-ups", hint: "Coming back to a job later on its own (each one uses Grok)" },
].map((p) => Object.freeze(p)));
export const PERMISSION_KEYS = Object.freeze(PERMISSIONS.map((p) => p.key));
/** Ask: a card each time. Allow: always, without asking. Deny: never. */
export const MODES = Object.freeze(["ask", "allow", "deny"]);
/** Until the settings screen (owner, 2026-11-09): everything is allowed, for testing. */
export const DEFAULT_MODE = "allow";

/** The owner's choices, checked: one mode for every kind, the default for any not chosen. */
export function cleanPermissions(raw) {
  const x = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const k of PERMISSION_KEYS) out[k] = MODES.includes(x[k]) ? x[k] : DEFAULT_MODE;
  return out;
}

/** Whether everything is allowed (then the browser's steps need no check at all). */
export const allAllowed = (perms) => PERMISSION_KEYS.every((k) => cleanPermissions(perms)[k] === "allow");

/** The label of a kind, for the cards and Gloopy ("Buy or pay"), or "" for none. */
export const permissionLabel = (k) => (PERMISSIONS.find((p) => p.key === k) || {}).label || "";

/** The owner's settings in Gloopy's context, one line each. */
export function permissionLines(perms) {
  const p = cleanPermissions(perms);
  const word = { allow: "always allowed: go ahead, then say what you did", ask: "ask first", deny: "never: don't do it, not even another way" };
  return PERMISSIONS.map((x) => "- " + x.label + " (" + x.hint.toLowerCase() + "): " + word[p[x.key]]).join("\n");
}
