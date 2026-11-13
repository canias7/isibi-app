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
export const LOGINS_MAX = 1000, HINT_MAX = 200, NICKNAME_MAX = 60, PASSWORD_MAX = 1000, USERNAME_MAX = 500;
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
/** A login's nickname (2026-11-12, Grok Bot's "an entry's nickname"), as a hint is kept: at most NICKNAME_MAX characters. */
export const cleanNickname = (t) => cleanHint(t).slice(0, NICKNAME_MAX);

/** The saved logins, unsealed: [{ id, site, username, password, nickname?, hint?, made?, at }]. */
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
export const loginList = (list) => list.map((x) => ({ id: x.id, site: x.site, username: x.username, ...(x.nickname ? { nickname: x.nickname } : {}), ...(x.hint ? { hint: x.hint } : {}), ...(x.made ? { made: true } : {}), at: x.at }));

/**
 * A login kept for a site (one per site and username: saving again replaces it, keeping its id and, unless a new one is
 * given, its hint); the oldest goes past LOGINS_MAX. `made`: a password Gloopy's computer made for a new account.
 */
export async function saveLogin(env, bucket, uid, { site, username = "", password, hint, nickname, made = false }, now = Date.now()) {
  const s = loginSite(site);
  if (!s || typeof password !== "string" || !password || password.length > PASSWORD_MAX) return null;
  const u = String(username == null ? "" : username).trim().slice(0, USERNAME_MAX);
  const all = await readLogins(env, bucket, uid);
  const old = all.find((x) => loginSite(x.site) === s && x.username === u);
  const h = typeof hint === "string" ? cleanHint(hint) : old && old.hint ? old.hint : "";
  const nick = typeof nickname === "string" ? cleanNickname(nickname) : old && old.nickname ? old.nickname : "";
  const item = { id: old ? old.id : newId(), site: s, username: u, password, ...(nick ? { nickname: nick } : {}), ...(h ? { hint: h } : {}), ...(made ? { made: true } : {}), at: now };
  await writeLogins(env, bucket, uid, [...all.filter((x) => x !== old), item].slice(-LOGINS_MAX));
  return item;
}

/**
 * A SAVED LOGIN CHANGED IN SETTINGS (Grok Bot's Vault: "select it in Settings → Vault and edit it"): its website,
 * username, nickname, hint, and its password when a new one is typed (an empty one keeps it). Another login for the same
 * site and username gives way to it. { item } or { error } in the owner's words. (Gloopy changes only a nickname and
 * hints, when the owner asks: Grok Bot's "A Bot can change ... an entry's nickname and hints, when you ask".)
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
  const nick = c.nickname !== undefined ? cleanNickname(c.nickname) : it.nickname || "";
  const next = { id: it.id, site: s, username: u, password: typed ? c.password : it.password, ...(nick ? { nickname: nick } : {}), ...(h ? { hint: h } : {}), ...(it.made && !typed ? { made: true } : {}), at: now };
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
// (coder/<uid>/gloopy/cards.json). The page and Gloopy only ever see a card's brand, last 4 digits, expiry, name, nickname
// and hints, never its number or its security code.
//
// AS GROK BOT'S (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's Vault: "Cards: the number, expiry,
// security code, name on card, and billing address", "A card saved in Vault fills in at checkout without asking you each
// time", "Default payment method, which Grok Bot pays with first", "Under Hints, tell your Bots when to use an entry"):
// a card is also added in Settings (New item → Card), and keeps its security code when one was typed for it (before,
// it never did, so the owner typed it each time). A card with its code fills in at checkout without the card form; one
// without it asks only for the code. Paying itself is still the owner's "Buy or pay" setting (the order card).

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

/**
 * What the page and Gloopy may know of them: never the number (its last 4 digits) nor the security code (only whether
 * one is kept: `code`, so the card fills in without the form).
 */
export const cardList = (list) => list.map((x) => ({ id: x.id, brand: x.brand, last4: x.last4, month: x.month, year: x.year, name: x.name || "", ...(x.nickname ? { nickname: x.nickname } : {}), ...(x.hint ? { hint: x.hint } : {}), ...(x.default ? { default: true } : {}), code: !!x.cvc, at: x.at }));

/** A card's security code as kept: 3 or 4 digits, or none. */
const cleanCvc = (c) => (/^\d{3,4}$/.test(String(c == null ? "" : c).trim()) ? String(c).trim() : "");

/**
 * A card kept (saving the same number again replaces it, keeping its id, nickname, hints and default unless new ones are
 * given), with its security code when one is given; the oldest goes past CARDS_MAX. `default`: the one Gloopy pays with
 * first (only one is).
 */
export async function saveCard(env, bucket, uid, { number, month, year, name = "", postal = "", cvc = "", nickname, hint, default: dflt }, now = Date.now()) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!/^\d{12,19}$/.test(digits) || !luhn(digits) || !(month >= 1 && month <= 12) || !(year >= 2000)) return null;
  const all = await readCards(env, bucket, uid), old = all.find((x) => x.number === digits);
  const nick = typeof nickname === "string" ? cleanNickname(nickname) : old && old.nickname ? old.nickname : "";
  const h = typeof hint === "string" ? cleanHint(hint) : old && old.hint ? old.hint : "";
  const code = cleanCvc(cvc) || (old && old.cvc) || "";
  const isDefault = typeof dflt === "boolean" ? dflt : !!(old && old.default);
  const item = { id: old ? old.id : "c" + crypto.randomUUID().replace(/-/g, "").slice(0, 10), brand: cardBrand(digits), last4: digits.slice(-4), number: digits, month: Number(month), year: Number(year), name: String(name || "").replace(/\s+/g, " ").trim().slice(0, 100), postal: String(postal || "").trim().slice(0, 12), ...(code ? { cvc: code } : {}), ...(nick ? { nickname: nick } : {}), ...(h ? { hint: h } : {}), ...(isDefault ? { default: true } : {}), at: now };
  const rest = all.filter((x) => x !== old).map((x) => (isDefault && x.default ? (({ default: _d, ...y }) => y)(x) : x));
  await writeCards(env, bucket, uid, [...rest, item].slice(-CARDS_MAX));
  return item;
}

/**
 * A SAVED CARD CHANGED IN SETTINGS (Grok Bot's Vault: "To change a card's number, remove the card and add it again"): its
 * nickname, hints, whether it is the default card, its name, billing postal code, expiry, and a new security code (an
 * empty one keeps it; `forgetCode` drops it, so the card form asks for it each time). Gloopy changes only a nickname and
 * hints, when the owner asks. { item } or { error } in the owner's words.
 */
export async function editCard(env, bucket, uid, id, change = {}, now = Date.now()) {
  const all = await readCards(env, bucket, uid);
  const it = all.find((x) => x.id === id);
  if (!it) return { error: "No saved card has that id." };
  const c = change && typeof change === "object" ? change : {};
  let month = it.month, year = it.year;
  if (c.expiry !== undefined && String(c.expiry).trim()) {
    const ok = checkCard({ number: it.number, expiry: c.expiry }, { needCvc: false, now });
    if (ok.error) return { error: ok.error };
    month = ok.card.month; year = ok.card.year;
  }
  if (c.cvc !== undefined && String(c.cvc).trim() && !cleanCvc(c.cvc)) return { error: "Type the card's security code (3 or 4 digits, on its back)." };
  const code = c.forgetCode === true ? "" : cleanCvc(c.cvc) || it.cvc || "";
  const nick = c.nickname !== undefined ? cleanNickname(c.nickname) : it.nickname || "";
  const h = c.hint !== undefined ? cleanHint(c.hint) : it.hint || "";
  const isDefault = typeof c.default === "boolean" ? c.default : !!it.default;
  const name = c.name !== undefined ? String(c.name || "").replace(/\s+/g, " ").trim().slice(0, 100) : it.name || "";
  const postal = c.postal !== undefined ? String(c.postal || "").trim().slice(0, 12) : it.postal || "";
  const next = { id: it.id, brand: it.brand, last4: it.last4, number: it.number, month, year, name, postal, ...(code ? { cvc: code } : {}), ...(nick ? { nickname: nick } : {}), ...(h ? { hint: h } : {}), ...(isDefault ? { default: true } : {}), at: now };
  await writeCards(env, bucket, uid, all.map((x) => (x.id === id ? next : isDefault && x.default ? (({ default: _d, ...y }) => y)(x) : x)));
  return { item: next };
}

/**
 * THE CARD TO PAY WITH (Grok Bot's "Default payment method, which Grok Bot pays with first"; its hints pick between
 * cards): the one named (`id`), else the default card, else the only one; none when there are several and none is named.
 */
export function cardFor(list, id = "") {
  const all = Array.isArray(list) ? list : [];
  if (id) return all.find((x) => x.id === id) || null;
  return all.find((x) => x.default) || (all.length === 1 ? all[0] : null);
}

/**
 * What Gloopy is told of the saved cards with each message: never a number, a code or an expiry date (only whether the
 * card has expired).
 */
export const cardsForTurn = (list, now = Date.now()) => cardList(list).map(({ at, month, year, name, ...x }) => {
  const d = new Date(now), gone = Number(year) * 12 + Number(month) - 1 < d.getUTCFullYear() * 12 + d.getUTCMonth();
  return { ...x, label: cardLabel(x), ...(gone ? { expired: true } : {}) };
});
/** A saved card taken away. */
export async function removeCard(env, bucket, uid, id) {
  const list = await readCards(env, bucket, uid);
  if (!list.some((x) => x.id === id)) return false;
  await writeCards(env, bucket, uid, list.filter((x) => x.id !== id));
  return true;
}

// THE OWNER'S CONTACT INFO (owner, 2026-11-13: "yes if dots and bot have it do it pls"; Grok Bot's Vault: "Contact info:
// names, addresses, phone numbers, and emails for shipping and billing", "It can see your contact info ... and type
// contact details for you", "A Bot can change contact info ... when you ask", "when you give a Bot a name, address, phone
// number, or email, it saves it as contact info once the task is done and tells you what it saved"). Kept sealed
// (coder/<uid>/gloopy/contacts.json) like the rest of the Vault; unlike a password or a card, Gloopy sees it, to fill in
// shipping and billing details.

/** At most this many contact entries per person. */
export const CONTACTS_MAX = 20;
const contactsKey = (uid) => ["coder", uid, "gloopy", "contacts.json"].join("/");
/** A contact entry's parts and their longest. */
export const CONTACT_PARTS = Object.freeze({ name: 100, line1: 200, line2: 200, city: 100, region: 100, postal: 20, country: 60, phone: 40, email: 200 });
const one = (t, n) => String(t == null ? "" : t).replace(/[\p{Cf}\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * A CONTACT ENTRY AS TYPED, checked: { contact } or { error } in the owner's words. Something to keep (a name, an address,
 * a phone number or an email); an email that looks like one; a phone number of digits, spaces and + ( ) - . only.
 */
export function checkContact(body) {
  const b = body && typeof body === "object" ? body : {};
  const c = {};
  for (const [k, n] of Object.entries(CONTACT_PARTS)) { const v = one(b[k], n); if (v) c[k] = v; }
  if (!c.name && !c.line1 && !c.phone && !c.email) return { error: "Type a name, an address, a phone number or an email." };
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return { error: "That email doesn't look right." };
  if (c.phone && !/^[+\d][\d\s().-]{2,38}$/.test(c.phone)) return { error: "That phone number doesn't look right." };
  return { contact: c };
}

/** The contact entries, unsealed: [{ id, name?, line1?, line2?, city?, region?, postal?, country?, phone?, email?, nickname?, hint?, at }]. */
export async function readContacts(env, bucket, uid) {
  const o = await bucket.get(contactsKey(uid));
  if (!o) return [];
  try {
    const v = await unseal(env, JSON.parse(await o.text()).box);
    return (Array.isArray(v) ? v : []).filter((x) => x && typeof x.id === "string").slice(-CONTACTS_MAX);
  } catch { return []; }
}
async function writeContacts(env, bucket, uid, list) {
  await bucket.put(contactsKey(uid), JSON.stringify({ at: Date.now(), box: await seal(env, list) }), { httpMetadata: { contentType: "application/json" } });
}

/** What the page and Gloopy see of them: all of it (contact info is not a secret). */
export const contactList = (list) => list.map((x) => ({ ...x }));

/** A contact entry kept (a new one; the oldest goes past CONTACTS_MAX). { item } or { error }. */
export async function saveContact(env, bucket, uid, body, now = Date.now()) {
  const ok = checkContact(body);
  if (ok.error) return { error: ok.error };
  const nick = cleanNickname(body && body.nickname), h = cleanHint(body && body.hint);
  const item = { id: "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 10), ...ok.contact, ...(nick ? { nickname: nick } : {}), ...(h ? { hint: h } : {}), at: now };
  await writeContacts(env, bucket, uid, [...(await readContacts(env, bucket, uid)), item].slice(-CONTACTS_MAX));
  return { item };
}

/** A contact entry changed: each part given replaces it (an empty one clears it). { item } or { error }. */
export async function editContact(env, bucket, uid, id, change = {}, now = Date.now()) {
  const all = await readContacts(env, bucket, uid);
  const it = all.find((x) => x.id === id);
  if (!it) return { error: "No contact entry has that id." };
  const c = change && typeof change === "object" ? change : {};
  const merged = {};
  for (const k of Object.keys(CONTACT_PARTS)) merged[k] = c[k] !== undefined ? c[k] : it[k];
  const ok = checkContact(merged);
  if (ok.error) return { error: ok.error };
  const nick = c.nickname !== undefined ? cleanNickname(c.nickname) : it.nickname || "";
  const h = c.hint !== undefined ? cleanHint(c.hint) : it.hint || "";
  const next = { id: it.id, ...ok.contact, ...(nick ? { nickname: nick } : {}), ...(h ? { hint: h } : {}), at: now };
  await writeContacts(env, bucket, uid, all.map((x) => (x.id === id ? next : x)));
  return { item: next };
}

/** A contact entry taken away. */
export async function removeContact(env, bucket, uid, id) {
  const all = await readContacts(env, bucket, uid);
  if (!all.some((x) => x.id === id)) return false;
  await writeContacts(env, bucket, uid, all.filter((x) => x.id !== id));
  return true;
}

/** A contact entry in one line, as the page and Gloopy say it: "Home · Ana Example, 1 Main St, Springfield, IL 62701, United States · +1 555 0100 · ana@example.com". */
export function contactLine(x) {
  const place = [x.line1, x.line2, x.city, [x.region, x.postal].filter(Boolean).join(" "), x.country].filter(Boolean).join(", ");
  return [x.nickname, [x.name, place].filter(Boolean).join(", "), x.phone, x.email].filter(Boolean).join(" · ");
}
