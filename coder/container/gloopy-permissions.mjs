// WHAT GLOOPY MAY DO ON ITS OWN (owner, 2026-11-09: "on the settings for Gloopy ... a list of things, and then have ask,
// deny, and always allow"; like Grok Bot's Custom Rules, "Ask first" or "Allow automatically", and dots' custom rules).
// One setting for each kind of action that matters: Ask (a card each time: Allow once, Always allow or Deny), Always
// allow, or Deny (Gloopy doesn't do it, not even another way).
//
// FOR TESTING, EVERYTHING IS "ALWAYS ALLOW" (owner, 2026-11-09: "the default for testing and all what we're doing is
// going to be like always allow, so we can test it"): no cards. The check before a browser step still runs (owner,
// 2026-11-10: "do all of that"; Grok Bot's and dots' run always): a step only the owner may do is still theirs. When
// testing is over, TESTING becomes false and each kind starts at AFTER_TESTING (the audit, 2026-11-10: the risky ones
// "Ask first", as both apps do; dots always asks before reusing a saved login).
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
  { key: "login", label: "Sign in with saved logins", hint: "Using a login you saved, without asking" },
  { key: "schedule", label: "Repeating schedules", hint: "Tasks that run every day or week (each run uses Grok)" },
  { key: "wake", label: "Wake-ups", hint: "Coming back to a job later on its own (each one uses Grok)" },
  { key: "events", label: "Start on events", hint: "Web addresses (webhooks) that start a task when a service calls them (each run uses Grok)" },
].map((p) => Object.freeze(p)));
export const PERMISSION_KEYS = Object.freeze(PERMISSIONS.map((p) => p.key));
/** Ask: a card each time. Allow: always, without asking. Deny: never. */
export const MODES = Object.freeze(["ask", "allow", "deny"]);
/** While the owner tests Gloopy (owner, 2026-11-09): everything is allowed. Set to false when testing is over. */
export const TESTING = true;
/** Each kind's setting once testing is over, until the owner picks their own: what could cost money, reach other people, delete or change things, or share their details asks first. */
export const AFTER_TESTING = Object.freeze({ buy: "ask", book: "ask", send: "ask", post: "ask", signup: "ask", delete: "ask", account: "ask", share: "ask", login: "ask", schedule: "ask", wake: "allow", events: "ask" });
/** The setting of a kind the owner has not picked. */
export const defaultFor = (k) => (TESTING ? "allow" : AFTER_TESTING[k] || "ask");
/** The default as one word, for the settings screen ("allow" while testing; "mixed" after it: see `defaults`). */
export const DEFAULT_MODE = TESTING ? "allow" : "mixed";
/** Every kind's default, for the settings screen. */
export const DEFAULTS = Object.freeze(Object.fromEntries(PERMISSION_KEYS.map((k) => [k, defaultFor(k)])));

/** The owner's choices, checked: one mode for every kind, the default for any not chosen. */
export function cleanPermissions(raw) {
  const x = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const k of PERMISSION_KEYS) out[k] = MODES.includes(x[k]) ? x[k] : defaultFor(k);
  return out;
}

/** Whether everything is allowed. */
export const allAllowed = (perms) => PERMISSION_KEYS.every((k) => cleanPermissions(perms)[k] === "allow");

/** The label of a kind, for the cards and Gloopy ("Buy or pay"), or "" for none. */
export const permissionLabel = (k) => (PERMISSIONS.find((p) => p.key === k) || {}).label || "";

/** The owner's settings in Gloopy's context, one line each. */
export function permissionLines(perms) {
  const p = cleanPermissions(perms);
  const word = { allow: "always allowed: go ahead, then say what you did", ask: "ask first", deny: "never: don't do it, not even another way" };
  return PERMISSIONS.map((x) => "- " + x.label + " (" + x.hint.toLowerCase() + "): " + word[p[x.key]]).join("\n");
}
