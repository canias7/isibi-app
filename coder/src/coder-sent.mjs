// THE FILES CODER SENDS THE OWNER (send_user_file, Claude Code's SendUserFile; the owner, 2026-11-18: "Ok you can start"):
// kept by Coder's Worker with the chat they were sent in, as Claude Code's are kept by its service for the session.
//
// IN: Coder's machine sends each file with the running job's own pass (POST /api/coder/sent-put, its name in x-file-name), at
// most SEND_FILE_MAX, Claude Code's 500 MiB: up to SEND_INLINE_MAX in one request, a bigger one in parts (?part=start, 1, 2,
// …, done), kept in R2 in parts as it comes. OUT: the owner, signed in, downloads one (GET /api/coder/projects/<chat>/sent/<id>),
// or the chat shows it from a signed address for VIEW_PASS_MS (pictures, drawings, PDFs, web pages sealed off from the app,
// plain text, Mermaid diagrams, videos). Kept per chat (coder/<uid>/<chat>/sent/<id>, listed in sent.json) as long as the chat
// is, and gone with it (dropSent); none is dropped to make room. Past SENT_DAY_MAX files in a day for the account, refused in
// Claude Code's words for its own allowance ("a count of files, not a size"). (The owner, 2026-11-18: "Match Claude Code".)
// (Gloopy keeps its own files apart: src/gloopy-files.mjs.)
import { modelPass } from "./coder-model-gate.mjs";
import { SEND_FILE_MAX, SEND_INLINE_MAX, SEND_PART_SIZE, sendTypeOf } from "../container/coder-sendfile.mjs";

export const SENT_ID = /^s[a-z0-9]{12}$/;
/**
 * The account's allowance: at most this many files sent in a day, as Claude Code's service counts files, not their size ("this
 * account has uploaded as many files as it is allowed for now (a count of files, not a size)"); its number is not public.
 */
export const SENT_DAY_MAX = 1000, SENT_DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (uid) => ["coder", uid, "sent-day.json"].join("/");
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
const newId = () => "s" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
/** The account's sends in the last day, and whether one more fits its allowance. */
async function dayUsed(bucket, uid, now) {
  const l = await getJson(bucket, dayKey(uid), []);
  return (Array.isArray(l) ? l : []).map(Number).filter((t) => Number.isFinite(t) && now - t < SENT_DAY_MS);
}
async function countSend(bucket, uid, now) { const l = await dayUsed(bucket, uid, now); l.push(now); await putJson(bucket, dayKey(uid), l.slice(-SENT_DAY_MAX)); }
const TOO_BIG = (max = SEND_FILE_MAX) => ({ error: { code: "file_too_large", max_bytes: max }, status: 413 });
const ALLOWANCE = { error: { code: "file_limit_exceeded" }, status: 429 };
/** A FILE'S RECORD added to the chat's list (newest first) and counted for the day. */
async function listSent(bucket, uid, id, item, now) {
  await putJson(bucket, listKey(uid, id), [item, ...(await readSent(bucket, uid, id))]);
  await countSend(bucket, uid, now);
  return item;
}
/** A FILE KEPT for the chat, whole: at most SEND_FILE_MAX, within the day's allowance. → the item, or { error, status }. */
export async function keepSent(bucket, uid, id, { name, bytes }, now = Date.now()) {
  const size = bytes ? bytes.byteLength : 0;
  if (size > SEND_FILE_MAX) return TOO_BIG();
  if ((await dayUsed(bucket, uid, now)).length >= SENT_DAY_MAX) return ALLOWANCE;
  const n = sentName(name);
  const item = { id: newId(), name: n, size, type: sendTypeOf(n) || "", at: now };
  await bucket.put(fileKey(uid, id, item.id), bytes, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { name: n } });
  return listSent(bucket, uid, id, item, now);
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
  return new Response(body, { status: 200, headers: { "content-type": "application/octet-stream", "content-length": String(item.size), "content-disposition": "attachment; filename=\"" + ascii(item.name) + "\"; filename*=UTF-8''" + encodeURIComponent(item.name), "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}

// ── SHOWN IN THE CHAT ────────────────────────────────────────────────────────
/** A Mermaid diagram (Claude Code's display list: "HTML, SVG, Mermaid, images, PDFs"): drawn by Mermaid itself in a sealed page. */
export const MERMAID = "text/vnd.mermaid";
export const MERMAID_JS = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";
const htmlText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The page that draws one: the diagram's text as text (never markup), Mermaid in strict mode. */
export const mermaidPage = (text) => "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}pre.mermaid{margin:0}</style></head><body><pre class=\"mermaid\">" + htmlText(text) + "</pre><script src=\"" + MERMAID_JS + "\"></script><script>mermaid.initialize({ startOnLoad: true, securityLevel: \"strict\" });</script></body></html>";
// (Claude Code's `display`: "render" opens a file in place, "attach" gives a card to download it; left out, by its kind.) A file
// is shown from a signed address, a plain visit with no sign-in header, for VIEW_PASS_MS, as its own kind and never sniffed:
// a picture or a drawing loading nothing else; a PDF in the browser's viewer; a web page in a sandbox of its own (no sign-in,
// nothing kept for the site, nothing sent anywhere: as Gloopy's pages are); text as plain text.
export const VIEW_TYPES = Object.freeze({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", txt: "text/plain; charset=utf-8", log: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8", json: "text/plain; charset=utf-8", xml: "text/plain; charset=utf-8", mmd: MERMAID, mermaid: MERMAID, mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mov: "video/quicktime" });
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
async function viewPass(env, uid, id, fid, until, what = "view") {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return "";
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-sent-view-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(what + ":" + uid + ":" + id + ":" + fid + ":" + until)));
}
/**
 * THE ADDRESS THAT SAVES ONE OF THE CHAT'S SENT FILES for the next VIEW_PASS_MS (asked for with the owner's sign-in): a plain
 * visit the browser saves as it comes, so a file of up to 500 MiB is never held whole in the page. "" when it can't be made.
 */
export async function sentGetAddress(env, uid, id, item, now = Date.now()) {
  if (!item) return "";
  const until = now + VIEW_PASS_MS;
  const t = await viewPass(env, uid, id, item.id, until, "get");
  return t ? "/api/coder/sent-get/" + encodeURIComponent(uid) + "/" + encodeURIComponent(id) + "/" + item.id + "?e=" + until + "&t=" + t : "";
}
/** A SENT FILE, SAVED (a plain visit with its signed address): always as a download, as its own name; anything wrong is "not found". */
export async function serveSentGet(env, bucket, uid, id, fid, url, now = Date.now()) {
  const nope = () => new Response("This file could not be downloaded. Download it again from Coder's chat.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  const until = Number(url.searchParams.get("e")), given = String(url.searchParams.get("t") || "");
  if (!SENT_ID.test(String(fid || "")) || !/^[\w-]{1,100}$/.test(String(uid || "")) || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(String(id || "")) || !Number.isFinite(until) || until < now || until > now + VIEW_PASS_MS + 60_000 || !given) return nope();
  const want = await viewPass(env, uid, id, fid, until, "get");
  if (!want || !same(want, given)) return nope();
  const f = await sentOf(bucket, uid, id, fid);
  return f ? sentDownload(f.item, f.body) : nope();
}
/** The address that shows one of the chat's sent files for the next VIEW_PASS_MS (asked for with the owner's sign-in); "" when it can't be shown. */
export async function sentViewAddress(env, uid, id, item, now = Date.now()) {
  if (!item || !viewTypeOf(item.name)) return "";
  const until = now + VIEW_PASS_MS;
  const t = await viewPass(env, uid, id, item.id, until);
  return t ? "/api/coder/sent-view/" + encodeURIComponent(uid) + "/" + encodeURIComponent(id) + "/" + item.id + "?e=" + until + "&t=" + t : "";
}
/** A SENT FILE, SHOWN (a plain visit with its signed address): as its own kind, in place; anything wrong is "not found". */
export async function serveSentView(env, bucket, uid, id, fid, url, now = Date.now(), rangeHeader = null) {
  const nope = () => new Response("This file could not be shown. Open it again from Coder's chat.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  const until = Number(url.searchParams.get("e")), given = String(url.searchParams.get("t") || "");
  if (!SENT_ID.test(String(fid || "")) || !/^[\w-]{1,100}$/.test(String(uid || "")) || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(String(id || "")) || !Number.isFinite(until) || until < now || until > now + VIEW_PASS_MS + 60_000 || !given) return nope();
  const want = await viewPass(env, uid, id, fid, until);
  if (!want || want.length !== given.length) return nope();
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  if (diff) return nope();
  const item = SENT_ID.test(String(fid || "")) ? (await readSent(bucket, uid, id)).find((x) => x.id === fid) : null;
  const type = item ? viewTypeOf(item.name) : "";
  if (!item || !type) return nope();
  const head = { "content-disposition": "inline; filename=\"" + ascii(item.name) + "\"", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "private, no-store" };
  // (A video in the ranges the browser asks for, so it plays and can be sought: R2 reads only that part.)
  if (type.startsWith("video/")) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String((rangeHeader && rangeHeader()) || ""));
    const size = item.size;
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (!(start <= end && end < size)) return new Response(null, { status: 416, headers: { "content-range": "bytes */" + size } });
      const o = await bucket.get(fileKey(uid, id, fid), { range: { offset: start, length: end - start + 1 } });
      if (!o) return nope();
      return new Response(o.body !== undefined ? o.body : await o.arrayBuffer(), { status: 206, headers: { "content-type": type, "content-range": "bytes " + start + "-" + end + "/" + size, "accept-ranges": "bytes", "content-length": String(end - start + 1), ...head } });
    }
    const o = await bucket.get(fileKey(uid, id, fid));
    if (!o) return nope();
    return new Response(o.body !== undefined ? o.body : await o.arrayBuffer(), { status: 200, headers: { "content-type": type, "accept-ranges": "bytes", ...head } });
  }
  const f = await sentOf(bucket, uid, id, fid);
  if (!f) return nope();
  if (type === MERMAID) {
    const text = new TextDecoder().decode(f.body instanceof ArrayBuffer ? f.body : await new Response(f.body).arrayBuffer());
    return new Response(mermaidPage(text), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": SENT_PAGE_CSP, ...head } });
  }
  const rules = type.startsWith("text/html") ? { "content-security-policy": SENT_PAGE_CSP } : type === "application/pdf" ? {} : { "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" };
  return new Response(f.body, { status: 200, headers: { "content-type": type, ...head, ...rules } });
}

// ── FROM CODER'S MACHINE ─────────────────────────────────────────────────────
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
/**
 * `POST /api/coder/sent-put` from Coder's machine: a file it sends, with the job's AI pass (the same headers as its AI calls);
 * only the chat's current job. Up to SEND_INLINE_MAX in one request (its name in x-file-name) → { ok, id, name, size, type }.
 * A bigger one in parts, kept by R2 as they come (Claude Code streams such a file from disk): `?part=start` (x-file-name,
 * x-file-size) → { ok, id, upload }; `?part=<n>&id=&upload=` (at most SEND_PART_SIZE) → { ok, etag }; `?part=done&id=&upload=`
 * ({ parts: [{ partNumber, etag }], name }) → as one request's answer; `?part=abort&id=&upload=`. Refused past SEND_FILE_MAX
 * (413, its "file_too_large", with the limit) or past the day's allowance (429, its "file_limit_exceeded").
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
  let name = "";
  try { name = decodeURIComponent(h("x-file-name")); } catch { name = ""; }
  const url = new URL(request.url);
  const part = url.searchParams.get("part");
  const fail = (r) => answer({ error: r.error }, r.status);
  if (part === null) {
    const len = Number(h("content-length") || 0);
    if (len > SEND_FILE_MAX) return fail(TOO_BIG());
    if (len > SEND_INLINE_MAX + 1024) return answer({ error: "send a file this big in parts" }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > SEND_INLINE_MAX + 1024) return answer({ error: "send a file this big in parts" }, 400);
    const r = await keepSent(bucket, uid, id, { name, bytes }, now);
    return r.error ? fail(r) : answer({ ok: true, id: r.id, name: r.name, size: r.size, type: r.type });
  }
  // IN PARTS.
  if (typeof bucket.createMultipartUpload !== "function") return answer({ error: "storage takes no parts here" }, 503);
  if (part === "start") {
    const size = Number(h("x-file-size"));
    if (!Number.isSafeInteger(size) || size < 0) return answer({ error: "give the file's size" }, 400);
    if (size > SEND_FILE_MAX) return fail(TOO_BIG());
    if ((await dayUsed(bucket, uid, now)).length >= SENT_DAY_MAX) return fail(ALLOWANCE);
    const fid = newId(), n = sentName(name);
    const up = await bucket.createMultipartUpload(fileKey(uid, id, fid), { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { name: n, size: String(size) } });
    return answer({ ok: true, id: fid, upload: up.uploadId });
  }
  const fid = String(url.searchParams.get("id") || ""), upId = String(url.searchParams.get("upload") || "");
  if (!SENT_ID.test(fid) || !upId || upId.length > 1024) return answer({ error: "not a file being sent" }, 400);
  const up = bucket.resumeMultipartUpload(fileKey(uid, id, fid), upId);
  if (part === "abort") { try { await up.abort(); } catch { /* gone already */ } return answer({ ok: true }); }
  if (part === "done") {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const parts = body && Array.isArray(body.parts) ? body.parts.filter((x) => x && Number.isSafeInteger(x.partNumber) && typeof x.etag === "string").map((x) => ({ partNumber: x.partNumber, etag: x.etag })) : [];
    if (!parts.length) return answer({ error: "no parts" }, 400);
    let obj = null;
    try { obj = await up.complete(parts); } catch (e) { return answer({ error: "the parts could not be joined" }, 400); }
    const size = Number(obj && obj.size);
    if (!Number.isSafeInteger(size) || size > SEND_FILE_MAX) { await bucket.delete(fileKey(uid, id, fid)).catch(() => {}); return fail(TOO_BIG()); }
    const n = sentName(name || (body && body.name) || (obj && obj.customMetadata && obj.customMetadata.name) || "");
    const item = await listSent(bucket, uid, id, { id: fid, name: n, size, type: sendTypeOf(n) || "", at: now }, now);
    return answer({ ok: true, id: item.id, name: item.name, size: item.size, type: item.type });
  }
  const no = Number(part);
  if (!Number.isSafeInteger(no) || no < 1 || no > 10000) return answer({ error: "not a part" }, 400);
  const len = Number(h("content-length") || 0);
  if (len > SEND_PART_SIZE) return answer({ error: "a part is at most " + SEND_PART_SIZE + " bytes" }, 400);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > SEND_PART_SIZE) return answer({ error: "a part is at most " + SEND_PART_SIZE + " bytes" }, 400);
  try { const r = await up.uploadPart(no, bytes); return answer({ ok: true, etag: r.etag }); }
  catch { return answer({ error: "the part could not be kept" }, 503); }
}
