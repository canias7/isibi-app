// NOTIFICATIONS ON YOUR PHONE AND COMPUTER, LIKE CLAUDE CODE'S (owner, 2026-11-07, item 8: "no phone
// notifications"). Claude Code's docs (mobile, remote-control; read 2026-11-07): a push "when a long-running
// task finishes or when it needs a decision from you", or one asked for in the prompt ("notify me when the
// tests finish"); two switches, "Push when Claude decides" and "Push when actions required" (its questions
// and permission prompts); none while you are focused on the session. Here: Web Push (RFC 8030) from
// Coder's Worker, signed with Coder's own key (VAPID, RFC 8292), each message encrypted for its device
// (RFC 8291); the page's service worker (public/sw.js) shows it, and a tap opens the chat.

import { seal, unseal } from "./coder-github.mjs";

/** Where a device's subscription may point: the browsers' own push services only (never any other address). */
export const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
/** The owner looking at a chat this recently (its page visible and focused) gets no push about it. */
export const PRESENCE_MS = 45_000;
/** A job this long or longer that finishes is worth a push ("a long-running task finishes"). */
export const LONG_JOB_MS = 3 * 60_000;
export const MAX_DEVICES = 10;
/** Pushes one job may ask for itself (the notify tool). */
export const NOTIFY_MAX = 3;
const VAPID_KEY = "coder/push/vapid.json";
export const pushKey = (uid) => "coder/" + uid + "/push.json";
export const seenKey = (uid) => "coder/" + uid + "/seen.json";

const te = new TextEncoder();
export const b64u = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/**
 * ONE MESSAGE FOR ONE DEVICE (RFC 8291, "aes128gcm"): `uaPublic` (65 bytes) and `authSecret` (16) come from
 * its subscription. The sender's ECDH key pair (`as`) and the `salt` are made fresh unless given (the RFC's
 * own example, in the tests). Answers the body to send.
 */
export async function encryptPush(uaPublic, authSecret, plaintext, { as = null, salt = null, rs = 4096 } = {}) {
  const pair = as || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, pair.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode("WebPush: info\u0000"), uaPublic, asPublic), 32);
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, te.encode("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdf(s, ikm, te.encode("Content-Encoding: nonce\u0000"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const head = new Uint8Array(21 + asPublic.length);
  head.set(s, 0);
  new DataView(head.buffer).setUint32(16, rs);
  head[20] = asPublic.length;
  head.set(asPublic, 21);
  return concat(head, ct);
}

/** CODER'S OWN PUSH KEY (VAPID): made the first time, kept sealed. { jwk (private), publicKey (base64url) }. */
export async function vapidKeys(env, bucket) {
  const read = async () => { const o = await bucket.get(VAPID_KEY); if (!o) return null; try { const k = await unseal(env, JSON.parse(await o.text()).box); return k && k.jwk && k.publicKey ? k : null; } catch { return null; } };
  const had = await read();
  if (had) return had;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const made = { jwk: await crypto.subtle.exportKey("jwk", pair.privateKey), publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))) };
  await bucket.put(VAPID_KEY, JSON.stringify({ box: await seal(env, made) }), { httpMetadata: { contentType: "application/json" } });
  // Two first sends at once: whichever key was kept is the one used.
  return (await read()) || made;
}
/** The signed note that says a push comes from Coder (RFC 8292; ES256), for one push service. */
export async function vapidJwt(vapid, endpoint, now = Date.now()) {
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: "https://gofarther.dev" })));
  const key = await crypto.subtle.importKey("jwk", { ...vapid.jwk, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + body)));
  return head + "." + body + "." + b64u(sig);
}
/** One push to one device. */
export async function sendPush(sub, data, vapid, { fetchFn = fetch, urgency = "normal", ttl = 86400, now = Date.now() } = {}) {
  const body = await encryptPush(unb64u(sub.p256dh), unb64u(sub.auth), te.encode(JSON.stringify(data)));
  return fetchFn(sub.endpoint, { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: String(ttl), urgency, authorization: "vapid t=" + (await vapidJwt(vapid, sub.endpoint, now)) + ", k=" + vapid.publicKey }, body });
}

// ── THE OWNER'S DEVICES AND SWITCHES ─────────────────────────────────────────
/** { decides, actions, subs: [{ endpoint, p256dh, auth, at }] } (the devices kept sealed). */
export async function readPush(env, bucket, uid) {
  const o = await bucket.get(pushKey(uid));
  let rec = null;
  try { rec = o ? JSON.parse(await o.text()) : null; } catch { rec = null; }
  let subs = [];
  if (rec && rec.box) { try { const s = await unseal(env, rec.box); subs = Array.isArray(s) ? s : []; } catch { subs = []; } }
  return { decides: !(rec && rec.decides === false), actions: !(rec && rec.actions === false), subs };
}
export async function writePush(env, bucket, uid, { decides, actions, subs }) {
  await bucket.put(pushKey(uid), JSON.stringify({ decides: decides !== false, actions: actions !== false, box: await seal(env, subs.slice(-MAX_DEVICES)) }), { httpMetadata: { contentType: "application/json" } });
}
/** A device's subscription, checked: a browser push service's https address and its two keys. */
export function cleanSub(s) {
  if (!s || typeof s !== "object" || typeof s.endpoint !== "string" || s.endpoint.length > 1000) return null;
  let u;
  try { u = new URL(s.endpoint); } catch { return null; }
  if (u.protocol !== "https:" || u.port || u.username || !PUSH_HOSTS.test(u.hostname)) return null;
  const k = s.keys || {};
  const p256dh = String(k.p256dh || ""), auth = String(k.auth || "");
  if (!/^[\w-]{80,100}$/.test(p256dh) || !/^[\w-]{16,30}$/.test(auth)) return null;
  try { if (unb64u(p256dh).length !== 65 || unb64u(auth).length !== 16) return null; } catch { return null; }
  return { endpoint: u.href, p256dh, auth };
}

/**
 * A PUSH TO THE OWNER'S DEVICES. `kind`: "decides" (a long job finished, or Coder was asked to tell them) or
 * "actions" (Coder needs their answer), each with its switch. None about a chat they are looking at. A device
 * the push service says is gone is forgotten.
 */
export async function notifyOwner(env, uid, { kind, title, body, chat = "" }, { fetchFn = fetch, now = Date.now(), force = false } = {}) {
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return { sent: 0, why: "no storage" };
  const cfg = await readPush(env, bucket, uid);
  if (!cfg.subs.length) return { sent: 0, why: "no devices" };
  if (!force && (kind === "actions" ? !cfg.actions : !cfg.decides)) return { sent: 0, why: "off" };
  if (chat && !force) {
    const o = await bucket.get(seenKey(uid));
    let seen = null;
    try { seen = o ? JSON.parse(await o.text()) : null; } catch { seen = null; }
    if (seen && seen.id === chat && now - Number(seen.at) < PRESENCE_MS) return { sent: 0, why: "watching" };
  }
  const vapid = await vapidKeys(env, bucket);
  // Gloopy's chat (GLOOPY_ID in coder-routes.mjs) opens in its own tab, /gloopy.
  const data = { title: String(title || "Coder").slice(0, 120), body: String(body || "").replace(/\s+/g, " ").trim().slice(0, 240), tag: chat || "coder", url: chat === "gloopy-main" ? "/gloopy" : chat ? "/?chat=" + encodeURIComponent(chat) : "/" };
  let sent = 0;
  const gone = [];
  for (const s of cfg.subs) {
    const r = await sendPush(s, data, vapid, { fetchFn, urgency: kind === "actions" ? "high" : "normal", now }).catch(() => null);
    if (r && (r.status === 404 || r.status === 410)) gone.push(s.endpoint);
    else if (r && r.ok) sent++;
  }
  if (gone.length) await writePush(env, bucket, uid, { ...cfg, subs: cfg.subs.filter((s) => !gone.includes(s.endpoint)) });
  return { sent, gone: gone.length };
}

/**
 * WHAT A JOB'S NEW STEPS ASK TO BE PUSHED (they reach Coder's Worker every few seconds as the job goes):
 * Coder's own `notify` (asked for, or news worth it), its question, a key it needs or an environment change it
 * proposes (actions required), and the end of a long job. At most a few.
 */
export function pushesFor(events, meta, now = Date.now()) {
  const name = String((meta && (meta.title || meta.repo)) || "a chat").slice(0, 80);
  // GLOOPY'S (owner, 2026-11-09): from Gloopy, with no chat name after it (it has one chat); Coder's are as before.
  const gl = !!meta && meta.kind === "gloopy";
  const who = gl ? "Gloopy" : "Coder", tail = gl ? "" : " · " + name;
  const out = [];
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || typeof e !== "object") continue;
    // A card from a run the owner did not start waits 30 minutes for them (the audit, 2026-11-10): the push says so.
    const until = Number(e.expires) > now ? " · answer within " + Math.max(1, Math.round((Number(e.expires) - now) / 60000)) + " min" : "";
    if (until && ["approval", "signin", "pay", "handoff"].includes(e.type)) { const one = pushesFor([{ ...e, expires: 0 }], meta, now)[0]; if (one) out.push({ ...one, title: one.title + until }); continue; }
    if (e.type === "notify" && e.text) out.push({ kind: "decides", title: who + tail, body: e.text });
    else if (e.type === "question") out.push({ kind: "actions", title: who + " needs your answer" + tail, body: (e.text || "") + (Array.isArray(e.questions) && e.questions.length > 1 ? " (and " + (e.questions.length - 1) + " more)" : "") });
    else if (e.type === "approval") out.push({ kind: "actions", title: who + " needs your OK" + tail, body: String(e.step || "") + (e.site ? " on " + e.site : "") + (e.why ? ": " + e.why : "") });
    else if (e.type === "signin") out.push({ kind: "actions", title: who + " asks you to sign in" + tail, body: "To " + String(e.site || "a site") + (e.reason ? ": " + e.reason : "") });
    else if (e.type === "pay") out.push({ kind: "actions", title: who + " needs your card" + tail, body: "To pay " + String(e.total || "") + " on " + String(e.site || "a site") + (e.reason ? ": " + e.reason : "") });
    else if (e.type === "handoff") out.push({ kind: "actions", title: who + " needs you in its browser" + tail, body: String(e.task || "A step only you can do") + (e.site ? " on " + e.site : "") });
    else if (e.type === "secret") out.push({ kind: "actions", title: who + " needs a key" + tail, body: "For " + String(e.host || "a site") + (e.reason ? ": " + e.reason : "") });
    else if (e.type === "envchange") out.push({ kind: "actions", title: who + " asks to change the environment" + tail, body: e.reason || (e.host ? "Allow " + e.host : "A new setup") });
    else if (e.type === "done" && meta && now - Number(meta.at || now) >= LONG_JOB_MS) out.push({ kind: "decides", title: who + " finished" + tail, body: e.text || "" });
  }
  return out.slice(0, NOTIFY_MAX + 1);
}
