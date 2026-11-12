// GLOOPY'S SAVED LOGINS (owner, 2026-11-09: "5"; Grok Bot's Vault, "saved logins ... fill into the page without your
// Bot seeing them", and dots' "Save to Passwords"). The owner ticks "Save this login" on the private sign-in card; once
// the sign-in worked, Coder's Worker keeps it, sealed (coder/<uid>/gloopy/vault.json). Next time Gloopy needs that site,
// its machine's service (never the AI) asks the Worker for that one login, with the running job's own pass, and types it
// into the page. Gloopy only learns that it is signed in.
//
// THE VAULT (owner, 2026-11-12: "do all 5 make sure you do similar frontend compare to grok bot"; Grok Bot's Settings →
// Vault): the owner also adds and changes logins in Settings (the website, the username or email, the password, and a
// hint for when Gloopy should use it, Grok Bot's "Hints"), brings them over from a password manager's export (Grok Bot's
// "Import from CSV…"), and Gloopy's computer makes one for a new account (`made`: Grok Bot's "Vault generates the
// password and saves the login, and the Bot never sees it"). Several accounts on one site: Gloopy picks one by the
// hints (it knows each site, username and hint, never a password), or the card offers each.
//
// The page may list them (site, username and hint, never the password), change and remove them; nothing reads a password
// back but the machine's service, for the site it is on, during a Gloopy job that is running.

import { seal, unseal } from "./coder-github.mjs";

/** At most this many saved logins per person (a password manager's whole export fits); a hint's and a password's most. */
export const LOGINS_MAX = 1000, HINT_MAX = 200, PASSWORD_MAX = 1000, USERNAME_MAX = 500;
const key = (uid) => ["coder", uid, "gloopy", "vault.json"].join("/");
const SITE = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/;
const newId = () => "l" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);

/**
 * A WEBSITE AS A LOGIN IS KEPT AND MATCHED: its host, in lower case, without "www." (a login for amazon.com is the one
 * for www.amazon.com, as password managers match them). Typed as a name ("github.com") or an address
 * ("https://github.com/login"); "" when it is neither (or not a web address).
 */
export function loginSite(raw) {
  let s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) {
    try { const u = new URL(s); if (!/^https?:$/.test(u.protocol)) return ""; s = u.host; } catch { return ""; }
  } else s = s.replace(/[/?#].*$/, "");
  s = s.replace(/^www\./, "").replace(/\.$/, "");
  return SITE.test(s) && /[a-z0-9]/.test(s) ? s : "";
}
/** A hint as kept: plain words on one line, at most HINT_MAX characters. */
export const cleanHint = (t) => String(t == null ? "" : t).replace(/[\p{Cf}\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, HINT_MAX);

/** The saved logins, unsealed: [{ id, site, username, password, hint?, made?, at }]. */
export async function readLogins(env, bucket, uid) {
  const o = await bucket.get(key(uid));
  if (!o) return [];
  try {
    const v = await unseal(env, JSON.parse(await o.text()).box);
    return (Array.isArray(v) ? v : []).filter((x) => x && typeof x.id === "string" && SITE.test(x.site) && typeof x.password === "string" && x.password).slice(-LOGINS_MAX);
  } catch { return []; }
}
async function writeLogins(env, bucket, uid, list) {
  await bucket.put(key(uid), JSON.stringify({ at: Date.now(), box: await seal(env, list) }), { httpMetadata: { contentType: "application/json" } });
}

/** What the page and Gloopy may know of them: never a password. */
export const loginList = (list) => list.map((x) => ({ id: x.id, site: x.site, username: x.username, ...(x.hint ? { hint: x.hint } : {}), ...(x.made ? { made: true } : {}), at: x.at }));

/**
 * A login kept for a site (one per site and username: saving again replaces it, keeping its id and, unless a new one is
 * given, its hint); the oldest goes past LOGINS_MAX. `made`: a password Gloopy's computer made for a new account.
 */
export async function saveLogin(env, bucket, uid, { site, username = "", password, hint, made = false }, now = Date.now()) {
  const s = loginSite(site);
  if (!s || typeof password !== "string" || !password || password.length > PASSWORD_MAX) return null;
  const u = String(username == null ? "" : username).trim().slice(0, USERNAME_MAX);
  const all = await readLogins(env, bucket, uid);
  const old = all.find((x) => loginSite(x.site) === s && x.username === u);
  const h = typeof hint === "string" ? cleanHint(hint) : old && old.hint ? old.hint : "";
  const item = { id: old ? old.id : newId(), site: s, username: u, password, ...(h ? { hint: h } : {}), ...(made ? { made: true } : {}), at: now };
  await writeLogins(env, bucket, uid, [...all.filter((x) => x !== old), item].slice(-LOGINS_MAX));
  return item;
}

/**
 * A SAVED LOGIN CHANGED IN SETTINGS (Grok Bot's Vault: "select it in Settings → Vault and edit it"): its website,
 * username, hint, and its password when a new one is typed (an empty one keeps it). Another login for the same site and
 * username gives way to it. { item } or { error } in the owner's words.
 */
export async function editLogin(env, bucket, uid, id, change = {}, now = Date.now()) {
  const all = await readLogins(env, bucket, uid);
  const it = all.find((x) => x.id === id);
  if (!it) return { error: "No saved login has that id." };
  const c = change && typeof change === "object" ? change : {};
  const s = c.site !== undefined ? loginSite(c.site) : loginSite(it.site);
  if (!s) return { error: "Type the website, such as github.com." };
  const u = c.username !== undefined ? String(c.username == null ? "" : c.username).trim().slice(0, USERNAME_MAX) : it.username;
  const typed = typeof c.password === "string" && c.password !== "";
  if (typed && c.password.length > PASSWORD_MAX) return { error: "That password is too long (at most " + PASSWORD_MAX + " characters)." };
  const h = c.hint !== undefined ? cleanHint(c.hint) : it.hint || "";
  const next = { id: it.id, site: s, username: u, password: typed ? c.password : it.password, ...(h ? { hint: h } : {}), ...(it.made && !typed ? { made: true } : {}), at: now };
  await writeLogins(env, bucket, uid, [...all.filter((x) => x.id !== id && !(loginSite(x.site) === s && x.username === u)), next]);
  return { item: next };
}

/**
 * LOGINS BROUGHT OVER FROM A PASSWORD MANAGER (Grok Bot's "Import from CSV…"): [{ site, username, password }], read from
 * the export on the owner's own device (the file never leaves it). Already saved (the same site and username): skipped;
 * no website or no password: left out; the same site and username twice in the file: the later row. As many as fit
 * under LOGINS_MAX. Answers { added, skipped, bad, over }.
 */
export async function importLogins(env, bucket, uid, rows, now = Date.now()) {
  const all = await readLogins(env, bucket, uid);
  const have = new Set(all.map((x) => loginSite(x.site) + "\n" + x.username));
  const fresh = new Map();
  let skipped = 0, bad = 0;
  for (const r of Array.isArray(rows) ? rows.slice(0, LOGINS_MAX) : []) {
    const s = loginSite(r && r.site), u = String((r && r.username) == null ? "" : r.username).trim().slice(0, USERNAME_MAX);
    const pw = r && typeof r.password === "string" ? r.password : "";
    if (!s || !pw || pw.length > PASSWORD_MAX) { bad++; continue; }
    const k = s + "\n" + u;
    if (have.has(k)) { skipped++; continue; }
    fresh.delete(k);
    fresh.set(k, { id: newId(), site: s, username: u, password: pw, at: now });
  }
  const add = [...fresh.values()].slice(0, Math.max(0, LOGINS_MAX - all.length));
  if (add.length) await writeLogins(env, bucket, uid, [...all, ...add]);
  return { added: add.length, skipped, bad, over: fresh.size - add.length };
}

/** A saved login taken away. */
export async function removeLogin(env, bucket, uid, id) {
  const list = await readLogins(env, bucket, uid);
  if (!list.some((x) => x.id === id)) return false;
  await writeLogins(env, bucket, uid, list.filter((x) => x.id !== id));
  return true;
}

/** The sites with a saved login. */
export const loginSites = (list) => [...new Set(list.map((x) => loginSite(x.site) || x.site))];

/**
 * The login to use for a site ("www." or not): the one asked for (`id`, or its `username`), or else the one saved most
 * recently. null when there is none (or not the one asked for).
 */
export const loginFor = (list, site, pick = {}) => {
  const s = loginSite(site);
  const mine = s ? list.filter((x) => loginSite(x.site) === s) : [];
  if (pick && pick.id) return mine.find((x) => x.id === pick.id) || null;
  if (pick && typeof pick.username === "string" && pick.username) return mine.find((x) => x.username === pick.username) || null;
  return mine.at(-1) || null;
};

// GLOOPY'S SAVED CARDS (owner, 2026-11-09: "can we try both"; Grok Bot's Vault cards, kept from its card form's
// "Securely save" box). Ticked on the private card form, a card that went into the page is kept here, sealed
// (coder/<uid>/gloopy/cards.json): its number, expiry, name and postal code, NEVER its security code (the card industry's
// rules do not allow keeping it once a payment is made), so the owner types those 3 or 4 digits each time they use it,
// which is also their OK to pay. The page and Gloopy only ever see a card's brand, last 4 digits, expiry and name.

/** At most this many saved cards per person. */
export const CARDS_MAX = 10;
const cardsKey = (uid) => ["coder", uid, "gloopy", "cards.json"].join("/");

/** A card number's brand, from its first digits. */
export function cardBrand(digits) {
  const d = String(digits || "");
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "American Express";
  if (/^(6011|65|64[4-9])/.test(d)) return "Discover";
  if (/^35(2[89]|[3-8]\d)/.test(d)) return "JCB";
  if (/^3(0[0-5]|[689])/.test(d)) return "Diners Club";
  return "Card";
}
/** Whether a card number's digits add up (the Luhn check every card number passes). */
export function luhn(digits) {
  const d = String(digits || "");
  let sum = 0;
  for (let i = 0; i < d.length; i++) { let x = Number(d[d.length - 1 - i]); if (i % 2) { x *= 2; if (x > 9) x -= 9; } sum += x; }
  return d.length > 0 && sum % 10 === 0;
}
/** How a card is named to the owner and to Gloopy: "Visa ending 4242". */
export const cardLabel = (x) => (x.brand || cardBrand(x.number)) + " ending " + (x.last4 || String(x.number || "").slice(-4));

/**
 * A CARD AS TYPED ON THE FORM, checked: { card: { number, month, year, cvc, name, postal } } or { error } in the owner's
 * words. The number passes the Luhn check; the expiry (MM/YY or MM/YYYY) is this month or later; the security code is 3
 * or 4 digits when the page asks for one.
 */
export function checkCard(body, { needCvc = true, now = Date.now() } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const number = String(b.number || "").replace(/[\s-]/g, "");
  if (!/^\d{12,19}$/.test(number) || !luhn(number)) return { error: "That card number doesn't look right. Check it and try again." };
  const m = /^\s*(\d{1,2})\s*\/?\s*(\d{2}|\d{4})\s*$/.exec(String(b.expiry || ""));
  const month = m ? Number(m[1]) : 0, year = m ? (m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])) : 0;
  const today = new Date(now), thisMonth = today.getUTCFullYear() * 12 + today.getUTCMonth();
  if (!m || month < 1 || month > 12 || year * 12 + month - 1 < thisMonth || year > today.getUTCFullYear() + 25) return { error: "Type the card's expiry date as MM / YY (it can't be in the past)." };
  const cvc = String(b.cvc || "").trim();
  if (needCvc && !/^\d{3,4}$/.test(cvc)) return { error: "Type the card's security code (3 or 4 digits, on its back)." };
  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 100), postal = String(b.postal || "").trim().slice(0, 12);
  return { card: { number, month, year, cvc: needCvc ? cvc : "", name, postal } };
}

/** The saved cards, unsealed: [{ id, brand, last4, number, month, year, name, postal, at }]. */
export async function readCards(env, bucket, uid) {
  const o = await bucket.get(cardsKey(uid));
  if (!o) return [];
  try {
    const v = await unseal(env, JSON.parse(await o.text()).box);
    return (Array.isArray(v) ? v : []).filter((x) => x && typeof x.id === "string" && /^\d{12,19}$/.test(String(x.number || ""))).slice(0, CARDS_MAX);
  } catch { return []; }
}
async function writeCards(env, bucket, uid, list) {
  await bucket.put(cardsKey(uid), JSON.stringify({ at: Date.now(), box: await seal(env, list) }), { httpMetadata: { contentType: "application/json" } });
}

/** What the page and Gloopy may know of them: never the number (its last 4 digits) or a security code (none is kept). */
export const cardList = (list) => list.map((x) => ({ id: x.id, brand: x.brand, last4: x.last4, month: x.month, year: x.year, name: x.name || "", at: x.at }));

/** A card kept (saving the same number again replaces it), WITHOUT its security code; the oldest goes past CARDS_MAX. */
export async function saveCard(env, bucket, uid, { number, month, year, name = "", postal = "" }, now = Date.now()) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!/^\d{12,19}$/.test(digits) || !luhn(digits) || !(month >= 1 && month <= 12) || !(year >= 2000)) return null;
  const list = (await readCards(env, bucket, uid)).filter((x) => x.number !== digits);
  const item = { id: "c" + crypto.randomUUID().replace(/-/g, "").slice(0, 10), brand: cardBrand(digits), last4: digits.slice(-4), number: digits, month: Number(month), year: Number(year), name: String(name || "").slice(0, 100), postal: String(postal || "").slice(0, 12), at: now };
  await writeCards(env, bucket, uid, [...list, item].slice(-CARDS_MAX));
  return item;
}

/** A saved card taken away. */
export async function removeCard(env, bucket, uid, id) {
  const list = await readCards(env, bucket, uid);
  if (!list.some((x) => x.id === id)) return false;
  await writeCards(env, bucket, uid, list.filter((x) => x.id !== id));
  return true;
}
