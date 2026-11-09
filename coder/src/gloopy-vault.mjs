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
