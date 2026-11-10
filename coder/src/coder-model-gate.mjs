// YOUR GROK KEY NEVER ENTERS CODER'S MACHINE (owner, 2026-11-07, "ok" to the
// plan: 1. the Grok key out of the machine, 2. each machine its own lock key,
// 3. a sealed network room, 4. the master key inside it). Like Claude Code,
// whose credentials stay outside the session's VM: the machine is given only a
// short pass for its chat's job, and sends each AI call here; the Worker checks
// the pass, adds the key and passes the call on to xAI. A command on the
// machine, even one with the master key, could at most make AI calls for its
// own chat's job until the pass ends, never take the key itself.
import { CODER_ENDPOINT, CODER_MODELS, coderModel } from "../container/coder-model.mjs";

export const MODEL_PATH = "/api/coder/model";
/**
 * THE PROMPT CACHE'S KEY FOR A CHAT (owner, 2026-11-10: "I want to do something kind of cache [for] the model"). xAI caches
 * the start of a request it has seen; its docs: "For the Responses API, use the `prompt_cache_key` field" (it sends every
 * request with the same key to the same server, where the cache is), "a UUID or your application's session ID works well";
 * without one "requests can land on a cold server" and pay the full input price. Cached input costs a quarter of it
 * ($0.50 for $2.00 a million tokens on grok-4.7). One key per chat, made here from the chat the pass is for, so every call
 * of the chat (Coder's, its checker's, its summaries) carries it, from any machine, and no machine can choose another
 * chat's: a hash, so xAI is never shown the account or the chat's name.
 */
export async function cacheKeyFor(chat) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("coder-cache-v1|" + chat)));
  return "coder-" + [...d.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** A pass lasts 3 hours: a job works 45 minutes at most, after a setup of up to 5. */
export const MODEL_PASS_MS = 3 * 60 * 60 * 1000;
/** The largest AI call taken (a conversation with pictures). */
export const MODEL_BODY_MAX = 30 * 1024 * 1024;

const enc = new TextEncoder();
const b64url = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const answer = (error, status) => new Response(JSON.stringify({ error: { message: error } }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** The pass for one chat's AI calls, for one turn, until a time: only the Worker can make it (CODER_TOKEN_KEY). */
export async function modelPass(env, chat, turn, until) {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return "";
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-model-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode("model:" + chat + ":" + turn + ":" + until)));
}

/** WHAT THE MACHINE IS GIVEN for a job's AI calls: this address and the pass. Never the key. */
export async function modelAccess(env, uid, id, turn, now = Date.now()) {
  const until = now + MODEL_PASS_MS, chat = uid + "/" + id;
  const pass = await modelPass(env, chat, turn, until);
  if (!pass) return null;
  const base = String(env.CODER_PUBLIC_URL || "https://coder.gofarther.dev").replace(/\/+$/, "");
  return { url: base + MODEL_PATH, chat, turn, until, pass };
}

/**
 * `POST /api/coder/model` from Coder's machine: one AI call (xAI's Responses
 * shape), with the pass in X-Coder-Chat, -Turn, -Until and -Model. Only the
 * chat's current job, only Coder's own models.
 */
export async function handleModel(request, env, { fetchFn = fetch, now = Date.now() } = {}) {
  if (request.method !== "POST") return answer("method", 405);
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return answer("storage is not available", 503);
  const key = String((env && env.XAI_API_KEY) || "");
  if (!key) return answer("no AI key on Coder's server", 503);
  const h = (k) => String(request.headers.get(k) || "");
  const chat = h("x-coder-chat"), turn = h("x-coder-turn"), until = h("x-coder-until");
  const c = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/.exec(chat);
  if (!c || !/^\d{1,9}$/.test(turn) || !/^\d{13}$/.test(until)) return answer("not a job's AI call", 403);
  const want = await modelPass(env, chat, turn, until);
  if (!want || !same(want, h("x-coder-model"))) return answer("not this job's pass", 403);
  if (Number(until) <= now) return answer("this pass has ended", 403);
  const [, uid, id] = c;
  let meta = null;
  try { const o = await bucket.get("coder/" + uid + "/" + id + "/meta.json"); meta = o ? JSON.parse(await o.text()) : null; } catch { meta = null; }
  if (!meta || String(meta.turn) !== turn) return answer("that chat has moved on", 403);
  if (Number(request.headers.get("content-length")) > MODEL_BODY_MAX) return answer("that AI call is too large", 413);
  const body = await request.text();
  if (body.length > MODEL_BODY_MAX) return answer("that AI call is too large", 413);
  let model = "", req = null;
  try { req = JSON.parse(body); model = String((req && req.model) || ""); } catch { return answer("that AI call could not be read", 400); }
  if (!req || typeof req !== "object" || Array.isArray(req)) return answer("that AI call could not be read", 400);
  const models = new Set([...CODER_MODELS.map((m) => m.id), coderModel(env)]);
  if (!models.has(model)) return answer("not one of Coder's models", 403);
  // The chat's own cache key, in place of any the machine sent.
  req.prompt_cache_key = await cacheKeyFor(chat);
  let r;
  try { r = await fetchFn(CODER_ENDPOINT, { method: "POST", body: JSON.stringify(req), headers: { authorization: "Bearer " + key, "content-type": "application/json" } }); }
  catch { return answer("xAI could not be reached", 502); }
  // Only xAI's answer and its type come back (nothing of the key).
  return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
}
