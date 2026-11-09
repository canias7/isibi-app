// GLOOPY'S SAVED LOGINS (owner, 2026-11-09: "5"; Grok Bot's Vault, "saved logins ... fill into the page without your
// Bot seeing them", and dots' "Save to Passwords"). The owner ticks "Save this login" on the private sign-in card; once
// the sign-in worked, Coder's Worker keeps it, sealed (coder/<uid>/gloopy/vault.json). Next time Gloopy needs that site,
// its machine's service (never the AI) asks the Worker for that one login, with the running job's own pass, and types it
// into the page. Gloopy only learns that it is signed in.
//
// The page may list them (site and username, never the password) and remove them; nothing reads a password back but the
// machine's service, for the site it is on, during a Gloopy job that is running.

import { seal, unseal } from "./coder-github.mjs";

/** At most this many saved logins per person. */
export const LOGINS_MAX = 50;
const key = (uid) => ["coder", uid, "gloopy", "vault.json"].join("/");
const SITE = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/;

/** The saved logins, unsealed: [{ id, site, username, password, at }]. */
export async function readLogins(env, bucket, uid) {
  const o = await bucket.get(key(uid));
  if (!o) return [];
  try {
    const v = await unseal(env, JSON.parse(await o.text()).box);
    return (Array.isArray(v) ? v : []).filter((x) => x && typeof x.id === "string" && SITE.test(x.site) && typeof x.password === "string" && x.password).slice(0, LOGINS_MAX);
  } catch { return []; }
}
async function writeLogins(env, bucket, uid, list) {
  await bucket.put(key(uid), JSON.stringify({ at: Date.now(), box: await seal(env, list) }), { httpMetadata: { contentType: "application/json" } });
}

/** What the page and Gloopy may know of them: never a password. */
export const loginList = (list) => list.map((x) => ({ id: x.id, site: x.site, username: x.username, at: x.at }));

/** A login kept for a site (one per site and username: saving again replaces it); the oldest goes past LOGINS_MAX. */
export async function saveLogin(env, bucket, uid, { site, username = "", password }, now = Date.now()) {
  const s = String(site || "").toLowerCase();
  if (!SITE.test(s) || typeof password !== "string" || !password || password.length > 1000) return null;
  const u = String(username || "").slice(0, 500);
  const list = (await readLogins(env, bucket, uid)).filter((x) => !(x.site === s && x.username === u));
  const item = { id: "l" + crypto.randomUUID().replace(/-/g, "").slice(0, 10), site: s, username: u, password, at: now };
  await writeLogins(env, bucket, uid, [...list, item].slice(-LOGINS_MAX));
  return item;
}

/** A saved login taken away. */
export async function removeLogin(env, bucket, uid, id) {
  const list = await readLogins(env, bucket, uid);
  if (!list.some((x) => x.id === id)) return false;
  await writeLogins(env, bucket, uid, list.filter((x) => x.id !== id));
  return true;
}

/** The sites with a saved login (all Gloopy is told). */
export const loginSites = (list) => [...new Set(list.map((x) => x.site))];

/** The login to use for a site: the one saved most recently. */
export const loginFor = (list, site) => list.filter((x) => x.site === String(site || "").toLowerCase()).at(-1) || null;

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
