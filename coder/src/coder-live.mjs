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
import { pushesFor, notifyOwner } from "./coder-push.mjs";
import { hiddenValues, changeRules, ruleStepsOf } from "./coder-routes.mjs";

export const LIVE_PATH = "/api/coder/live";
/**
 * One sending at most (the machine sends fewer steps when it is refused as too large; and, refused with the conversation, it
 * goes on without it: the job's own save at its end has it). 4 MB: the conversation sent has no pictures, and Claude Code's
 * auto-compact keeps it near 2 MB of text; more than 4 MB, sealed here and read back for a lost job, would take a Worker past
 * its 128 MB (test/worker-memory.test.mjs).
 */
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
 * THE JOB'S OWN PASS, CHECKED (handleLive and handleLivePic): the chat ("uid/id"), the turn and the pass in the headers, and
 * that job still running. → { bucket, uid, id, turn, meta }, or the answer that refuses it.
 */
async function liveJob(request, env) {
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
  return { bucket, uid, id, turn, meta };
}

// ── THE PICTURES OF A CODER CHAT'S SAVED CONVERSATION, KEPT APART (2026-11-14, the Worker's memory) ──
// Since the saved chat keeps its pictures (the owner: "yes copy claude code"), a chat could carry some 18 MB of them, and every
// one of the Worker's routes that reads the saved chat (a message's start, a job's end, Undo, Rewind, a lost job) holds several
// copies of it at once: measured with 24 pictures, 200 to 275 MB, past a Worker's 128 MB. So each picture is kept as an object
// of its own, named by its SHA-256 (`coder-pic:<sha>` in the saved chat, where the picture was), sent here by the chat's
// machine at the job's end and fetched by it at the next job's start, with the job's own pass; the Worker never parses one.
// What Grok is sent is unchanged: the machine puts each picture back, the same bytes.
export const LIVE_PIC_PATH = LIVE_PATH + "/pic";
export const PIC_REF = "coder-pic:";
/** One picture at most (a data URL's characters; the owner's are under 2 MB, a read's fitted ones under a few). */
export const PIC_MAX = 12 * 1024 * 1024;
export const picKey = (uid, id, sha) => "coder/" + uid + "/" + id + "/pics/" + sha;
const PIC_HEAD = /^data:image\/(?:png|jpeg|webp|gif);base64,$/;
const B64 = new Uint8Array(256);
for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=") B64[c.charCodeAt(0)] = 1;
/** Is this a picture as Grok takes one (a data URL of a PNG, JPEG, WebP or GIF), read as bytes so it is never a string here? */
function picBytesOk(b) {
  const comma = b.indexOf(44);
  if (comma < 0 || comma > 40 || !PIC_HEAD.test(new TextDecoder().decode(b.subarray(0, comma + 1)))) return false;
  for (let i = comma + 1; i < b.length; i++) if (!B64[b[i]]) return false;
  return b.length > comma + 1;
}
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
/** The picture's name: the SHA-256 of its data URL. */
export async function picSha(data) { return hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data)); }
/** The pictures a saved conversation names (`coder-pic:<sha>`). */
export function picRefsIn(messages) {
  const out = new Set();
  for (const m of Array.isArray(messages) ? messages : []) for (const u of m && Array.isArray(m.images) ? m.images : []) if (typeof u === "string" && u.startsWith(PIC_REF)) out.add(u.slice(PIC_REF.length));
  return out;
}
/**
 * `POST /api/coder/live/pic` (a picture's data URL, as the body) keeps one and answers `{ ok, ref }`; `GET ?sha=` gives it back.
 * Only with the job's own pass while it runs (liveJob).
 */
export async function handleLivePic(request, env) {
  if (request.method !== "POST" && request.method !== "GET") return text("method", 405);
  const job = await liveJob(request, env);
  if (job instanceof Response) return job;
  if (request.method === "GET") {
    const sha = new URL(request.url).searchParams.get("sha") || "";
    if (!/^[0-9a-f]{64}$/.test(sha)) return text("not a picture's name");
    const o = await job.bucket.get(picKey(job.uid, job.id, sha));
    if (!o) return text("no such picture", 404);
    return new Response(o.body || (await o.text()), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  if (Number(request.headers.get("content-length")) > PIC_MAX) return text("too large", 413);
  const b = new Uint8Array(await request.arrayBuffer());
  if (b.length > PIC_MAX) return text("too large", 413);
  if (!picBytesOk(b)) return text("not a picture");
  const sha = await picSha(b);
  await job.bucket.put(picKey(job.uid, job.id, sha), b, { httpMetadata: { contentType: "text/plain" } });
  return Response.json({ ok: true, ref: PIC_REF + sha });
}
/** A chat's pictures no longer in its saved conversation go (at a job's end: what it saved names all it needs). */
export async function prunePics(bucket, uid, id, messages) {
  if (typeof bucket.delete !== "function") return 0;
  const keep = picRefsIn(messages);
  let gone = 0;
  for (const key of await keysUnder(bucket, "coder/" + uid + "/" + id + "/pics/")) if (!keep.has(key.split("/").pop())) { await bucket.delete(key); gone++; }
  return gone;
}
/** All of a chat's pictures go (the chat is removed). */
export async function dropPics(bucket, uid, id) {
  if (typeof bucket.delete !== "function") return;
  for (const key of await keysUnder(bucket, "coder/" + uid + "/" + id + "/pics/")) await bucket.delete(key);
}

/**
 * `POST /api/coder/live` from Coder's machine: `{ from, events, messages? }`,
 * with the headers x-coder-chat ("uid/id"), x-coder-turn and x-coder-live (the
 * pass). Steps from `from` on are kept, up to the end of their part; the
 * answer's `have` says where the next sending starts. 403: not this job's
 * pass; 409: that job is not running (the machine stops sending after a few).
 */
export async function handleLive(request, env, { fetchFn = fetch, waitUntil = null, now = Date.now() } = {}) {
  if (request.method !== "POST") return text("method", 405);
  const job = await liveJob(request, env);
  if (job instanceof Response) return job;
  const { bucket, uid, id, turn, meta } = job, h = request.headers;
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
  let ruleFailed = null;
  if (take.length) {
    const key = partKey(uid, id, turn, part);
    const had = (await readBox(env, bucket, key)) || { start, events: [] };
    const known = Array.isArray(had.events) ? had.events : [];
    // A gap (a part sent before the one it follows): the machine is told where to start again.
    if (from - start > known.length) return Response.json({ ok: true, have: start + known.length });
    await putBox(env, bucket, key, { start, events: known.slice(0, from - start).concat(take) });
    // NOTIFICATIONS (owner item 8, like Claude Code's): what is new in this sending (never a step sent again)
    // may be pushed to the owner's devices: Coder's own notify, its question, a key or an approval it needs,
    // the end of a long job.
    const fresh = take.slice(Math.max(0, start + known.length - from));
    // RULES TAKEN ON A CARD ("Yes, and don't ask again"), STORED NOW, not only at the job's end (audit M-g-12): one that cannot
    // be stored is told back to the machine, which says so in the chat.
    const rules = ruleStepsOf(fresh);
    if (rules.length && meta.repo) {
      const ok = await changeRules(bucket, uid, meta.repo, "allow", rules, { add: true }).then(() => true, () => false);
      if (!ok) ruleFailed = rules;
    }
    const list = fresh.length ? pushesFor(fresh, meta, now) : [];
    if (list.length) {
      // HIDDEN AS IN THE SAVED CHAT (Claude Code: "Improved how secrets are masked in push notifications"): the owner's
      // secret-looking variables, saved keys and the job's own keys never reach a lock screen.
      const values = await hiddenValues(env, bucket, uid, { ...meta, id }, { keep: true }).catch(() => []);
      const hide = (x) => { let t = String(x == null ? "" : x); for (const v of values) t = t.split(v).join("[hidden]"); return t; };
      if (values.length) for (const p of list) { p.title = hide(p.title); p.body = hide(p.body); }
      const work = (async () => { for (const p of list) await notifyOwner(env, uid, { ...p, chat: id }, { fetchFn, now }).catch(() => null); })();
      if (typeof waitUntil === "function") waitUntil(work); else await work;
    }
  }
  // (`whole`: the job's auto-compact summarized the conversation, so this is all of it, the summary first, not the job's part
  // after the saved chat: kept so, 2026-11-14.)
  if (Array.isArray(body.messages)) { const list = body.messages.filter((x) => x && typeof x === "object"); await putBox(env, bucket, convoKey(uid, id, turn), body.whole === true ? { whole: true, messages: list } : list); }
  return Response.json({ ok: true, have: from + take.length, ...(ruleFailed ? { ruleFailed } : {}) });
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

/**
 * What a job saved as it went: its steps, in order up to the first gap, and its latest conversation (null when none came):
 * the job's part after the saved chat, or, `whole`, all of it (Claude Code's auto-compact summarized it in the job).
 */
export async function readLive(env, bucket, uid, id, turn) {
  const keys = (await keysUnder(bucket, livePrefix(uid, id, turn))).filter((k) => /\/part-\d{3}\.json$/.test(k)).sort();
  let events = [];
  for (const key of keys) {
    const p = await readBox(env, bucket, key);
    if (!p || !Array.isArray(p.events) || !Number.isInteger(p.start) || p.start > events.length) break;
    events = events.slice(0, p.start).concat(p.events);
  }
  const c = await readBox(env, bucket, convoKey(uid, id, turn));
  const whole = !!c && !Array.isArray(c) && c.whole === true && Array.isArray(c.messages);
  return { events: events.slice(0, LIVE_MAX_EVENTS), messages: Array.isArray(c) ? c : whole ? c.messages : null, ...(whole ? { whole: true } : {}) };
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

/**
 * A CONVERSATION WHOSE MACHINE STOPPED MID-STEP keeps its last round (like Claude Code, whose moved sessions show "the tool call
 * that was interrupted, marked as outcome unknown"): each call of that round with no reply gets one saying so, and the steps
 * of that round that finished keep their real results. → { messages, cut: [the interrupted steps' names] }.
 */
export const INTERRUPTED = "Interrupted: Coder's machine stopped while this was running. Outcome unknown: check what it did before running it again.";
export function interruptedSteps(messages) {
  const out = Array.isArray(messages) ? messages.filter((x) => x && typeof x === "object" && typeof x.role === "string") : [];
  for (let i = out.length - 1; i >= 0; i--) {
    const x = out[i];
    if (x.role !== "assistant" || !Array.isArray(x.tool_calls) || !x.tool_calls.length) continue;
    let j = i + 1;
    while (j < out.length && out[j].role === "tool") j++;
    const replied = new Set(out.slice(i + 1, j).map((y) => y.tool_call_id));
    const lost = x.tool_calls.filter((c) => c && c.id && !replied.has(c.id));
    if (!lost.length) return { messages: out, cut: [] };
    const fill = lost.map((c) => ({ role: "tool", tool_call_id: c.id, content: INTERRUPTED }));
    return { messages: [...out.slice(0, j), ...fill, ...out.slice(j)], cut: lost.map((c) => String((c.function && c.function.name) || c.name || "a step")) };
  }
  return { messages: out, cut: [] };
}
