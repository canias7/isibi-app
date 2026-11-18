// THE FILES CODER SENDS THE OWNER (send_user_file, Claude Code's SendUserFile; the owner, 2026-11-18: "Ok you can start"):
// kept by Coder's Worker with the chat they were sent in, as Claude Code's are kept by its service for the session.
//
// IN: Coder's machine sends each file with the running job's own pass (POST /api/coder/sent-put, its name in x-file-name), at
// most SEND_FILE_MAX (Claude Code's server sets its own, "never under 30 MiB"). OUT: the owner, signed in, downloads one
// (GET /api/coder/projects/<chat>/sent/<id>), or the chat shows it in place from a signed address for VIEW_PASS_MS (pictures,
// drawings, PDFs, web pages sealed off from the app, plain text). Kept per chat (coder/<uid>/<chat>/sent/<id>, listed in
// sent.json), the oldest going first past SENT_MAX or SENT_TOTAL_MAX, and gone with the chat (dropSent).
// (Gloopy keeps its own files apart: src/gloopy-files.mjs.)
import { modelPass } from "./coder-model-gate.mjs";
import { SEND_FILE_MAX, sendTypeOf, tooBigToSend } from "../container/coder-sendfile.mjs";

export const SENT_ID = /^s[a-z0-9]{12}$/;
/** At most this many files kept with one chat, and this many bytes in all; past either the oldest go. */
export const SENT_MAX = 500, SENT_TOTAL_MAX = 2 * 1024 * 1024 * 1024;
export const VIEW_PASS_MS = 10 * 60 * 1000;
const listKey = (uid, id) => ["coder", uid, id, "sent.json"].join("/");
const fileKey = (uid, id, fid) => ["coder", uid, id, "sent", fid].join("/");

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });

/** A sent file's name as kept and shown: no folders, nothing that can't be seen, at most 200 characters; "file" when none is left. */
export function sentName(name) {
  const n = String(name == null ? "" : name).split(/[/\\]/).pop().replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
  return (n.length > 200 ? n.slice(0, 200) : n) || "file";
}
/** A chat's sent files: [{ id, name, size, type, at }], newest first. */
export async function readSent(bucket, uid, id) {
  const l = await getJson(bucket, listKey(uid, id), []);
  return (Array.isArray(l) ? l : []).filter((x) => x && SENT_ID.test(x.id)).map((x) => ({ id: x.id, name: sentName(x.name), size: Number(x.size) || 0, type: typeof x.type === "string" ? x.type : "", at: Number(x.at) || 0 }));
}
/** A FILE KEPT for the chat: at most SEND_FILE_MAX; the oldest go past SENT_MAX or SENT_TOTAL_MAX. → the item, or { error }. */
export async function keepSent(bucket, uid, id, { name, bytes }, now = Date.now()) {
  const size = bytes ? bytes.byteLength : 0;
  if (size > SEND_FILE_MAX) return { error: tooBigToSend(size), status: 413 };
  const n = sentName(name);
  const item = { id: "s" + crypto.randomUUID().replace(/-/g, "").slice(0, 12), name: n, size, type: sendTypeOf(n) || "", at: now };
  await bucket.put(fileKey(uid, id, item.id), bytes, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { name: n } });
  let list = [item, ...(await readSent(bucket, uid, id))];
  const drop = [];
  while (list.length > SENT_MAX || list.reduce((a, x) => a + x.size, 0) > SENT_TOTAL_MAX) drop.push(list.pop());
  for (const x of drop) if (x.id !== item.id && typeof bucket.delete === "function") await bucket.delete(fileKey(uid, id, x.id));
  await putJson(bucket, listKey(uid, id), list);
  return list.some((x) => x.id === item.id) ? item : { error: "the chat's files are full", status: 507 };
}
/** One file's bytes and record, or null. */
export async function sentOf(bucket, uid, id, fid) {
  if (!SENT_ID.test(String(fid || ""))) return null;
  const item = (await readSent(bucket, uid, id)).find((x) => x.id === fid);
  if (!item) return null;
  const o = await bucket.get(fileKey(uid, id, fid));
  return o ? { item, body: o.body !== undefined ? o.body : await o.arrayBuffer() } : null;
}
/** A chat's sent files, all gone (with the chat). */
export async function dropSent(bucket, uid, id) {
  if (typeof bucket.delete !== "function") return;
  for (const x of await readSent(bucket, uid, id)) await bucket.delete(fileKey(uid, id, x.id));
  await bucket.delete(listKey(uid, id));
}
const ascii = (n) => n.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
/** A FILE, DOWNLOADED (by the owner, signed in): always saved, never opened in the page, as its own name. */
export function sentDownload(item, body) {
  return new Response(body, { status: 200, headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=\"" + ascii(item.name) + "\"; filename*=UTF-8''" + encodeURIComponent(item.name), "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}

// ── SHOWN IN THE CHAT ────────────────────────────────────────────────────────
// (Claude Code's `display`: "render" opens a file in place, "attach" gives a card to download it; left out, by its kind.) A file
// is shown from a signed address, a plain visit with no sign-in header, for VIEW_PASS_MS, as its own kind and never sniffed:
// a picture or a drawing loading nothing else; a PDF in the browser's viewer; a web page in a sandbox of its own (no sign-in,
// nothing kept for the site, nothing sent anywhere: as Gloopy's pages are); text as plain text.
export const VIEW_TYPES = Object.freeze({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", txt: "text/plain; charset=utf-8", log: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8", json: "text/plain; charset=utf-8", xml: "text/plain; charset=utf-8" });
const endingOf = (name) => { const m = /\.([A-Za-z0-9]{1,6})$/.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };
export const viewTypeOf = (name) => VIEW_TYPES[endingOf(name)] || "";
export const SENT_PAGE_CSP = [
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src https: data:",
  "media-src https: data:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");
const enc = new TextEncoder();
const b64url = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
async function viewPass(env, uid, id, fid, until) {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return "";
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-sent-view-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode("view:" + uid + ":" + id + ":" + fid + ":" + until)));
}
/** The address that shows one of the chat's sent files for the next VIEW_PASS_MS (asked for with the owner's sign-in); "" when it can't be shown. */
export async function sentViewAddress(env, uid, id, item, now = Date.now()) {
  if (!item || !viewTypeOf(item.name)) return "";
  const until = now + VIEW_PASS_MS;
  const t = await viewPass(env, uid, id, item.id, until);
  return t ? "/api/coder/sent-view/" + encodeURIComponent(uid) + "/" + encodeURIComponent(id) + "/" + item.id + "?e=" + until + "&t=" + t : "";
}
/** A SENT FILE, SHOWN (a plain visit with its signed address): as its own kind, in place; anything wrong is "not found". */
export async function serveSentView(env, bucket, uid, id, fid, url, now = Date.now()) {
  const nope = () => new Response("This file could not be shown. Open it again from Coder's chat.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  const until = Number(url.searchParams.get("e")), given = String(url.searchParams.get("t") || "");
  if (!SENT_ID.test(String(fid || "")) || !/^[\w-]{1,100}$/.test(String(uid || "")) || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(String(id || "")) || !Number.isFinite(until) || until < now || until > now + VIEW_PASS_MS + 60_000 || !given) return nope();
  const want = await viewPass(env, uid, id, fid, until);
  if (!want || want.length !== given.length) return nope();
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  if (diff) return nope();
  const f = await sentOf(bucket, uid, id, fid);
  const type = f ? viewTypeOf(f.item.name) : "";
  if (!f || !type) return nope();
  const rules = type.startsWith("text/html") ? { "content-security-policy": SENT_PAGE_CSP } : type === "application/pdf" ? {} : { "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" };
  return new Response(f.body, { status: 200, headers: { "content-type": type, "content-disposition": "inline; filename=\"" + ascii(f.item.name) + "\"", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "private, no-store", ...rules } });
}

// ── FROM CODER'S MACHINE ─────────────────────────────────────────────────────
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
/**
 * `POST /api/coder/sent-put` from Coder's machine: one file's bytes, its name in x-file-name, with the job's AI pass (the same
 * headers as its AI calls); only the chat's current job. → { ok, id, name, size, type }, or { error } (413 past the limit).
 */
export async function handleSentPut(request, env, { now = Date.now() } = {}) {
  if (request.method !== "POST") return answer({ error: "method" }, 405);
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return answer({ error: "storage is not available" }, 503);
  const h = (k) => String(request.headers.get(k) || "");
  const chat = h("x-coder-chat"), turn = h("x-coder-turn"), until = h("x-coder-until");
  const m = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/.exec(chat);
  if (!m || !/^\d{1,9}$/.test(turn) || !/^\d{13}$/.test(until)) return answer({ error: "not a job's file" }, 403);
  const want = await modelPass(env, chat, turn, until);
  if (!want || !same(want, h("x-coder-model"))) return answer({ error: "not this job's pass" }, 403);
  if (Number(until) <= now) return answer({ error: "this pass has ended" }, 403);
  const [, uid, id] = m;
  const meta = await getJson(bucket, "coder/" + uid + "/" + id + "/meta.json", null);
  if (!meta || String(meta.turn) !== turn) return answer({ error: "that chat has moved on" }, 403);
  const len = Number(h("content-length") || 0);
  if (len > SEND_FILE_MAX) return answer({ error: tooBigToSend(len) }, 413);
  let name = "";
  try { name = decodeURIComponent(h("x-file-name")); } catch { name = ""; }
  const bytes = new Uint8Array(await request.arrayBuffer());
  const r = await keepSent(bucket, uid, id, { name, bytes }, now);
  return r.error ? answer({ error: r.error }, r.status || 400) : answer({ ok: true, id: r.id, name: r.name, size: r.size, type: r.type });
}
