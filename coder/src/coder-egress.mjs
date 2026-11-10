// KEYS ADDED OUTSIDE CODER'S MACHINE, like Claude Code (its docs, read
// 2026-11-06: "Anthropic's agent proxy adds the key to requests for the hosts
// you list, after each request leaves the session's VM"; owner: "Finish all
// this"). A saved key's value no longer goes to the chat's machine. The
// machine's proxy sends each request for a keyed site here, with this job's
// own pass, and the Worker adds the key and sends the request on. So whatever
// runs on the machine, even as root, can use a key only for its own sites,
// and can never read it.
//
//   POST /api/coder/egress
//     x-coder-chat     <user id>/<chat id>
//     x-coder-turn     the job's turn number
//     x-coder-egress   this job's pass (HMAC of chat and turn, made by the Worker)
//     x-coder-url      the https address the AI's command asked for
//     x-coder-method   its method
//     x-coder-headers  its headers, as base64url JSON
//     body             its body
import { okHost, hostMatches, keyAllowed, headerValue } from "../container/coder-secrets.mjs";
import { readEnvData, envIdOf } from "./coder-environments.mjs";
import { pkcs1ToPkcs8 } from "./coder-mentions.mjs";

const enc = new TextEncoder(), dec = new TextDecoder();
const b64url = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const text = (s, status = 400) => new Response(s, { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
export const EGRESS_PATH = "/api/coder/egress";
export const BODY_MAX = 10 * 1024 * 1024;

/** Claude Code's own refusal, with Coder's name (its docs: "GitHub GraphQL is not available from Claude Code sessions", naming the REST fallback). */
export const GRAPHQL_REFUSED = "GitHub GraphQL is not available from Coder's sessions. Use GitHub's REST API instead: gh api repos/{owner}/{repo}/... (gh pr and gh issue use GraphQL and are refused; gh api works).";

/**
 * GITHUB'S API FOR `gh` (owner, 2026-11-07, item 6: "gh: installed, but not logged in"). Like Claude Code's
 * GitHub proxy (its docs, read 2026-11-07): `gh`'s requests, made with the placeholder "proxy-injected", go
 * out with the owner's GitHub login put in here, never on the machine; only "for the repositories attached
 * to the session" (others: "GitHub access to ... is not enabled for this session"); GraphQL is refused with
 * the REST fallback named. A job started from GitHub (strangers can write there) may only read.
 */
export async function githubApi(request, env, bucket, uid, meta, target, { fetchFn = fetch } = {}) {
  const path = target.pathname;
  if (/^\/graphql(\/|$)/.test(path)) return text(GRAPHQL_REFUSED, 403);
  const repos = [meta.repo, ...(Array.isArray(meta.repos) ? meta.repos.map((r) => r && r.repo) : [])].filter((r) => typeof r === "string" && r).map((r) => r.toLowerCase());
  const m = /^\/repos\/([^/]+)\/([^/]+)(\/|$)/.exec(path);
  let full = "";
  try { full = m ? (decodeURIComponent(m[1]) + "/" + decodeURIComponent(m[2])).toLowerCase() : ""; } catch { full = ""; }
  if (!m || !plainPath(path + target.search) || !repos.includes(full)) return text("GitHub access to " + (full || path.slice(0, 100)) + " is not enabled for this session: only this chat's repositories (" + repos.join(", ") + "), as gh api repos/OWNER/REPO/...", 403);
  const h = request.headers;
  const method = String(h.get("x-coder-method") || "GET").toUpperCase();
  if (!/^[A-Z]{1,20}$/.test(method)) return text("bad method");
  if (meta.jobFromGithub === true && !["GET", "HEAD"].includes(method)) return text("a job started from GitHub may only read through gh", 403);
  // A REPOSITORY THE OWNER CAN ONLY READ (owner item 5): gh only reads it too (nothing is written as them there).
  const ro = full === String(meta.repo).toLowerCase() ? meta.readOnly === true : (Array.isArray(meta.repos) ? meta.repos : []).some((r) => r && typeof r.repo === "string" && r.repo.toLowerCase() === full && r.readOnly === true);
  if (ro && !["GET", "HEAD"].includes(method)) return text("you can read " + full + " but not push to it, so gh may only read it", 403);
  const { userToken } = await import("./coder-github.mjs");
  const t = await userToken(env, bucket, uid, { fetchFn });
  if (!t) return text("connect GitHub again on gofarther.dev: the connection has ended", 403);
  let asked = {};
  try { asked = JSON.parse(dec.decode(Uint8Array.from(atob(String(h.get("x-coder-headers") || "e30").replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)))); } catch { asked = {}; }
  const headers = {};
  for (const [k, v] of Object.entries(asked && typeof asked === "object" ? asked : {})) if (!HOP.test(k) && !/^(authorization|cookie|host)$/i.test(k) && typeof v === "string" && v.length < 8192) headers[k.toLowerCase()] = v;
  headers.authorization = "Bearer " + t.token;
  if (!headers["user-agent"]) headers["user-agent"] = "gofarther-coder";
  let body = null;
  if (!["GET", "HEAD"].includes(method)) {
    const buf = new Uint8Array(await request.arrayBuffer());
    if (buf.length > BODY_MAX) return text("the request body is over 10 MB", 413);
    body = buf;
  }
  let r;
  try { r = await fetchFn("https://api.github.com" + path + target.search, { method, headers, body, redirect: "manual" }); }
  catch (e) { return text("Coder could not reach GitHub: " + String((e && e.message) || e).slice(0, 200), 502); }
  const back = new Headers();
  r.headers.forEach((v, k) => { if (!v.includes(t.token) && !/^(content-encoding|content-length|transfer-encoding|connection|set-cookie)$/i.test(k)) back.append(k, v); });
  return new Response(r.body, { status: r.status, headers: back });
}

/** This job's pass: only the Worker can make it (CODER_TOKEN_KEY), only for one chat and one turn. */
export async function egressPass(env, chat, turn) {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return "";
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-egress-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode("egress:" + chat + ":" + turn)));
}

/** A path with no "." or ".." part, even encoded (the same rule as the machine's proxy). */
export function plainPath(target) {
  let p = String(target || "").split("?")[0];
  for (let i = 0; i < 3; i++) { const d = p.replace(/%([0-9a-f]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))); if (d === p) break; p = d; }
  return !p.split(/[/\\;?#]/).some((part) => part.includes(".") && /^[.\s\0]+$/.test(part));
}

/** A body with one parameter set: JSON objects and form bodies; anything else: null. */
export function withBodyParam(contentType, bytes, param, value) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("application/json")) {
    let o; try { o = bytes.length ? JSON.parse(dec.decode(bytes)) : {}; } catch { return null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    o[param] = value;
    return enc.encode(JSON.stringify(o));
  }
  if (ct.includes("application/x-www-form-urlencoded") || !bytes.length) { const q = new URLSearchParams(dec.decode(bytes)); q.set(param, value); return enc.encode(q.toString()); }
  return null;
}

// TOKENS FOR OAUTH AND GOOGLE CLOUD KEYS, kept in this Worker's memory until a minute before they end.
const tokens = new Map();
export const forgetTokens = () => tokens.clear();
const pemDer = (pem) => { const b = atob(String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
export async function bearerFor(kind, c, { fetchFn = fetch, now = Date.now } = {}) {
  const key = kind + ":" + (kind === "oauth" ? c.tokenUrl + "|" + c.clientId + "|" + c.scope : JSON.parse(c.keyJson).client_email + "|" + c.scope);
  const hit = tokens.get(key);
  if (hit && hit.until > now()) return hit.token;
  const url = kind === "oauth" ? c.tokenUrl : "https://oauth2.googleapis.com/token";
  let body;
  if (kind === "oauth") body = new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret, ...(c.scope ? { scope: c.scope } : {}) });
  else {
    const k = JSON.parse(c.keyJson);
    const iat = Math.floor(now() / 1000);
    const part = (o) => b64url(enc.encode(JSON.stringify(o)));
    const unsigned = part({ alg: "RS256", typ: "JWT", ...(k.private_key_id ? { kid: k.private_key_id } : {}) }) + "." + part({ iss: k.client_email, scope: c.scope, aud: url, iat, exp: iat + 3600 });
    const der = /BEGIN RSA PRIVATE KEY/.test(k.private_key) ? pkcs1ToPkcs8(pemDer(k.private_key)) : pemDer(k.private_key);
    const sk = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", sk, enc.encode(unsigned))) });
  }
  const r = await fetchFn(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: body.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || typeof j.access_token !== "string") throw new Error("the token request failed (" + r.status + ")");
  tokens.set(key, { token: j.access_token, until: now() + Math.max(60, Number(j.expires_in) || 3600) * 1000 - 60000 });
  return j.access_token;
}

// AWS SIGNATURE VERSION 4 (the same steps as the machine's, with the Worker's own crypto).
const sha = async (b) => hex(await crypto.subtle.digest("SHA-256", typeof b === "string" ? enc.encode(b) : b));
const hmac = async (k, s) => crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", typeof k === "string" ? enc.encode(k) : k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(s));
const awsEnc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
export async function sigv4({ method, host, path, headers = {}, body = new Uint8Array(0) }, c, now = new Date(), { contentSha = true } = {}) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const [rawPath, rawQuery = ""] = String(path || "/").split("?");
  const canonPath = c.service === "s3" ? rawPath : rawPath.split("/").map((p) => awsEnc(decodeURIComponent(p))).join("/");
  const query = rawQuery.split("&").filter(Boolean).map((kv) => { const [k, v = ""] = kv.split("="); return [awsEnc(decodeURIComponent(k.replace(/\+/g, " "))), awsEnc(decodeURIComponent(v.replace(/\+/g, " ")))]; })
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + "=" + v).join("&");
  const payloadHash = await sha(body);
  const add = { host, "x-amz-date": amzDate, ...(contentSha ? { "x-amz-content-sha256": payloadHash } : {}), ...(c.sessionToken ? { "x-amz-security-token": c.sessionToken } : {}) };
  const all = { ...Object.fromEntries(Object.entries(headers).filter(([k]) => /^(content-type|content-md5|x-amz-[a-z0-9-]+)$/i.test(k) && !/^x-amz-(date|content-sha256|security-token)$/i.test(k)).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, " ")])), ...add };
  const names = Object.keys(all).sort();
  const canon = [method.toUpperCase(), canonPath || "/", query, names.map((k) => k + ":" + all[k] + "\n").join(""), names.join(";"), payloadHash].join("\n");
  const scope = day + "/" + c.region + "/" + c.service + "/aws4_request";
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha(canon)].join("\n");
  const kSign = await hmac(await hmac(await hmac(await hmac("AWS4" + c.secretAccessKey, day), c.region), c.service), "aws4_request");
  const signature = hex(await hmac(kSign, toSign));
  return { ...add, authorization: "AWS4-HMAC-SHA256 Credential=" + c.accessKeyId + "/" + scope + ", SignedHeaders=" + names.join(";") + ", Signature=" + signature };
}

/** The key values of one secret (to keep them out of what is sent back). */
const valuesOf = (s) => [...s.headers.flatMap((h) => [h.value, headerValue(h)]), ...(s.config ? Object.values(s.config).filter((v) => typeof v === "string") : [])].filter((x) => x && x.length >= 8);
const HOP = /^(host|connection|keep-alive|proxy-.*|te|trailer|transfer-encoding|upgrade|content-length|x-coder-.*|cf-.*|x-forwarded-.*|x-real-ip)$/i;

/** One keyed request from a chat's machine: checked, the key added, sent on. */
export async function handleEgress(request, env, { fetchFn = fetch } = {}) {
  if (request.method !== "POST") return text("method", 405);
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return text("storage is not available", 503);
  const h = request.headers;
  const chat = String(h.get("x-coder-chat") || ""), turn = String(h.get("x-coder-turn") || "");
  const m = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/.exec(chat);
  if (!m || !/^\d{1,9}$/.test(turn)) return text("not a job", 403);
  const want = await egressPass(env, chat, turn);
  if (!want || !same(want, h.get("x-coder-egress") || "")) return text("not this job's pass", 403);
  const [, uid, id] = m;
  let meta = null;
  try { const o = await bucket.get("coder/" + uid + "/" + id + "/meta.json"); meta = o ? JSON.parse(await o.text()) : null; } catch { meta = null; }
  // Only a job that is running now.
  if (!meta || meta.status !== "running" || String(meta.turn) !== turn) return text("that job is not running", 403);
  let target;
  try { target = new URL(String(h.get("x-coder-url") || "")); } catch { return text("bad address"); }
  const host = target.hostname.toLowerCase();
  // GITHUB'S API FOR `gh`, with the owner's GitHub login (owner item 6; githubApi).
  if (host === "api.github.com" && target.protocol === "https:" && !target.username && !target.password && !target.port) return githubApi(request, env, bucket, uid, meta, target, { fetchFn });
  // Never a saved key for a job started from GitHub (strangers can write there).
  if (meta.jobFromGithub === true) return text("that job is not running", 403);
  if (target.protocol !== "https:" || target.username || target.password || target.port || !okHost(host) || !keyAllowed(host)) return text("only https to a named site");
  const path = target.pathname + target.search;
  const envData = await readEnvData(env, bucket, uid, meta.envId || (await envIdOf(bucket, uid, meta)));
  const s = envData.secrets.find((x) => x.hosts.some((p) => hostMatches(host, p)));
  if (!s) return text("no key is saved for " + host, 403);
  if (s.paths.length && !(plainPath(path) && s.paths.some((p) => path.startsWith(p)))) return text("outside the key's paths on " + host, 403);
  const method = String(h.get("x-coder-method") || "GET").toUpperCase();
  if (!/^[A-Z]{1,20}$/.test(method)) return text("bad method");
  let asked = {};
  try { asked = JSON.parse(dec.decode(Uint8Array.from(atob(String(h.get("x-coder-headers") || "e30").replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)))); } catch { asked = {}; }
  const headers = {};
  for (const [k, v] of Object.entries(asked && typeof asked === "object" ? asked : {})) if (!HOP.test(k) && typeof v === "string" && v.length < 8192) headers[k.toLowerCase()] = v;
  let body = null;
  if (!["GET", "HEAD"].includes(method)) {
    const buf = new Uint8Array(await request.arrayBuffer());
    if (buf.length > BODY_MAX) return text("the request body is over 10 MB", 413);
    body = buf;
  }
  // HELD FOR THE OWNER'S OK (Gloopy, the audit, 2026-11-10): its turn's check wants the owner to see this request first.
  // It is kept here as it came (without the key), not sent; the owner's Allow on the card sends it (sendHeld).
  const hold = String(h.get("x-coder-hold") || "");
  if (hold) {
    if (!HOLD_ID.test(hold)) return text("bad hold");
    if (body && body.length > HELD_MAX) return text("the request is over 1 MB, too big to keep for the owner's OK: not sent", 413);
    let step = "";
    try { step = dec.decode(Uint8Array.from(atob(String(h.get("x-coder-step") || "").replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0))).replace(/[\p{Cc}\p{Cf}]/gu, "").slice(0, 300); } catch { step = ""; }
    let b = ""; if (body) { for (let i = 0; i < body.length; i += 0x8000) b += String.fromCharCode(...body.subarray(i, i + 0x8000)); }
    await bucket.put(heldKey(uid, id), JSON.stringify({ id: hold, turn: Number(turn), at: Date.now(), method, url: target.toString(), headers, body: body ? btoa(b) : "", step }), { httpMetadata: { contentType: "application/json" } });
    return new Response("Held for the owner's OK, not sent: " + method + " " + host + target.pathname.slice(0, 150) + ". Gloopy's app shows the owner what it sends on a card; if they allow it, it sends this same request.", { status: 202, headers: { "content-type": "text/plain", "cache-control": "no-store", "x-coder-held": hold } });
  }
  const sent = await sendWithKey(s, { method, host, path, target, headers, body }, { fetchFn });
  if (sent.error) return sent.error;
  // A site that copies the key into its answer's headers does not hand it back.
  const back = new Headers();
  sent.r.headers.forEach((v, k) => { if (!sent.keys.some((x) => v.includes(x)) && !/^(content-encoding|content-length|transfer-encoding|connection)$/i.test(k)) back.append(k, v); });
  return new Response(sent.r.body, { status: sent.r.status, headers: back });
}

/** One request sent with the key of secret `s` added, the way its type says: { r, keys } (the key's values, to keep out of what comes back), or { error: Response }. */
async function sendWithKey(s, { method, host, path, target, headers: given, body: given2 }, { fetchFn = fetch } = {}) {
  const headers = { ...given };
  let body = given2;
  const set = (name, value) => { headers[name.toLowerCase()] = value; };
  let live = "";
  try {
    if (s.kind === "headers") for (const x of s.headers) set(x.name, headerValue(x));
    else if (s.kind === "oauth" || s.kind === "gcp") { live = await bearerFor(s.kind, s.config, { fetchFn }); set("authorization", "Bearer " + live); }
    else if (s.kind === "body") { if (body && body.length || !["GET", "HEAD", "OPTIONS", "DELETE"].includes(method)) { const nb = withBodyParam(headers["content-type"], body || new Uint8Array(0), s.config.param, s.config.value); if (nb) { body = nb; if (!headers["content-type"]) headers["content-type"] = "application/x-www-form-urlencoded"; } } }
    else if (s.kind === "aws") for (const [k, v] of Object.entries(await sigv4({ method, host, path, headers, body: body || new Uint8Array(0) }, s.config))) set(k, v);
  } catch (e) { return { error: text("Coder could not add the key for " + host + ": " + String((e && e.message) || e).slice(0, 200), 502) }; }
  let r;
  try { r = await fetchFn(target.toString(), { method, headers, body, redirect: "manual" }); }
  catch (e) { return { error: text("Coder could not reach " + host + ": " + String((e && e.message) || e).slice(0, 200), 502) }; }
  return { r, keys: [...valuesOf(s), live].filter((x) => x && x.length >= 8) };
}

/** A held request's id, as Gloopy's turn makes it; the most a held request's body may be. */
export const HOLD_ID = /^wr[a-z0-9]{6,12}$/, HELD_MAX = 1024 * 1024;
/** Where a chat's held request is kept (one at a time). */
export const heldKey = (uid, id) => ["coder", uid, id, "held.json"].join("/");

/** A held request let go without sending it (the owner said no, or did not answer in time). */
export async function dropHeld(bucket, uid, id) { if (bucket && typeof bucket.delete === "function") await bucket.delete(heldKey(uid, id)).catch(() => {}); }

/**
 * A HELD REQUEST, SENT ONCE THE OWNER ALLOWS IT (Gloopy, the audit, 2026-11-10): the very request its command sent, with
 * the key added now, here; checked again as when it came (a key still saved for its site, inside the key's paths), then
 * no longer kept (it is sent at most once). Answers { ok, status, text } (the answer's start, without the key) or
 * { ok: false, why }.
 */
export async function sendHeld(env, bucket, uid, meta, hold, { fetchFn = fetch } = {}) {
  let held = null;
  try { const o = await bucket.get(heldKey(uid, meta.id)); held = o ? JSON.parse(await o.text()) : null; } catch { held = null; }
  if (!held || held.id !== hold) return { ok: false, why: "it is no longer kept" };
  await dropHeld(bucket, uid, meta.id);
  let target;
  try { target = new URL(String(held.url)); } catch { return { ok: false, why: "its address is not valid" }; }
  const host = target.hostname.toLowerCase(), path = target.pathname + target.search, method = String(held.method || "").toUpperCase();
  if (target.protocol !== "https:" || target.username || target.password || target.port || !okHost(host) || !keyAllowed(host) || !/^[A-Z]{1,20}$/.test(method)) return { ok: false, why: "only https to a named site" };
  const envData = await readEnvData(env, bucket, uid, await envIdOf(bucket, uid, meta));
  const s = envData.secrets.find((x) => x.hosts.some((p) => hostMatches(host, p)));
  if (!s) return { ok: false, why: "no key is saved for " + host + " any more" };
  if (s.paths.length && !(plainPath(path) && s.paths.some((p) => path.startsWith(p)))) return { ok: false, why: "it is outside the key's paths on " + host };
  const headers = {};
  for (const [k, v] of Object.entries(held.headers && typeof held.headers === "object" ? held.headers : {})) if (!HOP.test(k) && typeof v === "string" && v.length < 8192) headers[k.toLowerCase()] = v;
  let body = null;
  if (held.body) { const b = atob(held.body); body = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) body[i] = b.charCodeAt(i); }
  const sent = await sendWithKey(s, { method, host, path, target, headers, body }, { fetchFn });
  if (sent.error) return { ok: false, why: (await sent.error.text().catch(() => "")).slice(0, 300) || "it could not be sent" };
  let said = "";
  try { said = (await sent.r.text()).slice(0, 4000); } catch { said = ""; }
  for (const k of sent.keys) said = said.split(k).join("[hidden]");
  return { ok: true, status: sent.r.status, text: said.replace(/[\p{Cc}\p{Cf}]/gu, (ch) => (ch === "\n" || ch === "\t" ? ch : "")).slice(0, 2000) };
}

/** What a chat's machine gets of the keys now: where they apply, never their values. */
export const machineKeyRules = (list) => (Array.isArray(list) ? list : []).map((s) => ({ kind: s.kind, hosts: s.hosts, paths: s.paths, egress: true }));
