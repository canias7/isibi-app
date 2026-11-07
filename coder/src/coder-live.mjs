// THE CHAT SAVED AS IT GOES (like Claude Code, whose chats live on its servers:
// after a cloud machine is reclaimed, "Restored: your conversation history";
// the owner, 2026-11-06: "Do this").
//
// Before, a job's steps lived only in its machine's memory until the job ended
// and was saved, so a machine that crashed mid-job lost them. Now the machine
// sends its new steps every few seconds, and this job's part of its
// conversation every 15 seconds (the rest is the chat's saved history),
// to this address of Coder's Worker, with the job's own pass (made here, for
// one chat and one turn). They are kept sealed (encrypted with CODER_TOKEN_KEY,
// as the owner's values may be in them) until the job ends:
//   - saved as usual: they are deleted (the whole job comes from the machine);
//   - lost (the machine restarted, slept or stopped answering): they are put
//     back in the chat, the owner's values hidden, and Coder is told
//     (coder-routes.mjs, endLostJob).
//
// The steps are kept in parts of 200 (one stored object each), so a job never
// needs more than a few dozen objects, read or deleted at once.

import { seal, unseal } from "./coder-github.mjs";

export const LIVE_PATH = "/api/coder/live";
/** One sending at most (the machine sends fewer steps when it is refused as too large). */
export const LIVE_BODY_MAX = 4 * 1024 * 1024;
/** The chat keeps 4000 steps (coder-routes.mjs, MAX_EVENTS): no more are kept here. */
export const LIVE_MAX_EVENTS = 4000;
/** Steps per stored part. */
export const LIVE_PART = 200;

const enc = new TextEncoder();
const b64url = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const text = (s, status = 400) => new Response(s, { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
const CHAT = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/;

/** This job's pass for saving its steps: only the Worker can make it (CODER_TOKEN_KEY), for one chat and one turn, and for nothing else. */
export async function livePass(env, chat, turn) {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return "";
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-live-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode("live:" + chat + ":" + turn)));
}

const liveDir = (uid, id) => "coder/" + uid + "/" + id + "/live/";
/** Where one turn's saved steps live. */
export const livePrefix = (uid, id, turn) => liveDir(uid, id) + Number(turn) + "/";
const partKey = (uid, id, turn, part) => livePrefix(uid, id, turn) + "part-" + String(part).padStart(3, "0") + ".json";
const convoKey = (uid, id, turn) => livePrefix(uid, id, turn) + "conversation.json";

async function readBox(env, bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { return await unseal(env, JSON.parse(await o.text()).box); } catch { return null; }
}
const putBox = async (env, bucket, key, value) => bucket.put(key, JSON.stringify({ box: await seal(env, value) }), { httpMetadata: { contentType: "application/json" } });

/**
 * `POST /api/coder/live` from Coder's machine: `{ from, events, messages? }`,
 * with the headers x-coder-chat ("uid/id"), x-coder-turn and x-coder-live (the
 * pass). Steps from `from` on are kept, up to the end of their part; the
 * answer's `have` says where the next sending starts. 403: not this job's
 * pass; 409: that job is not running (the machine stops sending after a few).
 */
export async function handleLive(request, env) {
  if (request.method !== "POST") return text("method", 405);
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return text("storage is not available", 503);
  const h = request.headers;
  const chat = String(h.get("x-coder-chat") || ""), turn = String(h.get("x-coder-turn") || "");
  const m = CHAT.exec(chat);
  if (!m || !/^\d{1,9}$/.test(turn)) return text("not a job", 403);
  const want = await livePass(env, chat, turn);
  if (!want || !same(want, h.get("x-coder-live") || "")) return text("not this job's pass", 403);
  const [, uid, id] = m;
  let meta = null;
  try { const o = await bucket.get("coder/" + uid + "/" + id + "/meta.json"); meta = o ? JSON.parse(await o.text()) : null; } catch { meta = null; }
  if (!meta || meta.status !== "running" || String(meta.turn) !== turn) return text("that job is not running", 409);
  if (Number(h.get("content-length")) > LIVE_BODY_MAX) return text("too large", 413);
  const raw = await request.text();
  if (raw.length > LIVE_BODY_MAX) return text("too large", 413);
  let body;
  try { body = JSON.parse(raw); } catch { return text("bad body"); }
  const from = body && body.from, events = body && body.events;
  if (!Number.isInteger(from) || from < 0 || from > LIVE_MAX_EVENTS || !Array.isArray(events) || events.some((e) => !e || typeof e !== "object" || Array.isArray(e))) return text("bad body");
  // Only up to the end of this part (and of what the chat keeps): the rest comes in the next sending.
  const part = Math.floor(from / LIVE_PART), start = part * LIVE_PART;
  const take = events.slice(0, Math.max(0, Math.min(start + LIVE_PART, LIVE_MAX_EVENTS) - from));
  if (take.length) {
    const key = partKey(uid, id, turn, part);
    const had = (await readBox(env, bucket, key)) || { start, events: [] };
    const known = Array.isArray(had.events) ? had.events : [];
    // A gap (a part sent before the one it follows): the machine is told where to start again.
    if (from - start > known.length) return Response.json({ ok: true, have: start + known.length });
    await putBox(env, bucket, key, { start, events: known.slice(0, from - start).concat(take) });
  }
  if (Array.isArray(body.messages)) await putBox(env, bucket, convoKey(uid, id, turn), body.messages.filter((x) => x && typeof x === "object"));
  return Response.json({ ok: true, have: from + take.length });
}

async function keysUnder(bucket, prefix) {
  const keys = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor });
    for (const o of page.objects || []) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

/** What a job saved as it went: its steps, in order up to the first gap, and its latest conversation (null when none came). */
export async function readLive(env, bucket, uid, id, turn) {
  const keys = (await keysUnder(bucket, livePrefix(uid, id, turn))).filter((k) => /\/part-\d{3}\.json$/.test(k)).sort();
  let events = [];
  for (const key of keys) {
    const p = await readBox(env, bucket, key);
    if (!p || !Array.isArray(p.events) || !Number.isInteger(p.start) || p.start > events.length) break;
    events = events.slice(0, p.start).concat(p.events);
  }
  const messages = await readBox(env, bucket, convoKey(uid, id, turn));
  return { events: events.slice(0, LIVE_MAX_EVENTS), messages: Array.isArray(messages) ? messages : null };
}

/** Forget every turn's saved steps for a chat (its job is saved, or the chat is removed). */
export async function dropLive(bucket, uid, id) {
  if (typeof bucket.delete !== "function") return;
  for (const key of await keysUnder(bucket, liveDir(uid, id))) await bucket.delete(key);
}

/**
 * A conversation cut off in the middle of a step ends at its last whole step:
 * the AI's API refuses a tool call that has no reply.
 */
export function wholeSteps(messages) {
  const out = Array.isArray(messages) ? messages.filter((x) => x && typeof x === "object" && typeof x.role === "string") : [];
  for (let i = out.length - 1; i >= 0; i--) {
    const x = out[i];
    if (x.role !== "assistant" || !Array.isArray(x.tool_calls) || !x.tool_calls.length) continue;
    const replied = new Set(out.slice(i + 1).filter((y) => y.role === "tool").map((y) => y.tool_call_id));
    return x.tool_calls.every((c) => c && replied.has(c.id)) ? out : out.slice(0, i);
  }
  return out;
}
