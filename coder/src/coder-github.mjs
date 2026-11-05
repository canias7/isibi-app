// CODER AND GITHUB (2026-11-05, the owner: "users can have their own GitHub
// account and the code goes through their GitHub account").
//
// A GITHUB APP the owner registers. Each user signs in to it with their own
// GitHub account and picks the repositories Coder may use. What they grant is a
// user access token (8 hours) and a refresh token (6 months); both are kept
// ENCRYPTED in Coder's bucket (AES-GCM, key CODER_TOKEN_KEY), never shown to
// the AI and never given to a command it runs. Coder's own code uses the token
// to clone, push a branch and open a pull request, as that user.
//
// Settings (Coder's Worker): GITHUB_APP_CLIENT_ID, GITHUB_APP_SLUG and
// CODER_PUBLIC_URL as plain settings; GITHUB_APP_CLIENT_SECRET and
// CODER_TOKEN_KEY (32 random bytes, base64) as secrets.

export const GITHUB_API = "https://api.github.com";
export const GITHUB_WEB = "https://github.com";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_EARLY_MS = 5 * 60 * 1000;

export function githubReady(env) {
  return !!(env && env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET && env.CODER_TOKEN_KEY && env.CODER_PUBLIC_URL);
}

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function keyBytes(env) {
  const raw = unb64(String(env.CODER_TOKEN_KEY || ""));
  if (raw.length !== 32) throw new Error("CODER_TOKEN_KEY must be 32 bytes, base64");
  return raw;
}

// ── THE SIGN-IN'S STATE: which user started it, signed, so the callback (a plain
// browser visit from GitHub, with no sign-in header) knows whose it is. ───────
async function hmac(env, text) {
  const k = await crypto.subtle.importKey("raw", await keyBytes(env), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}
export async function makeState(env, uid, now = Date.now()) {
  const body = uid + "." + now;
  return body + "." + (await hmac(env, "gh-state:" + body));
}
/** The user id a state was made for, or null when it is forged, malformed or older than 15 minutes. */
export async function readState(env, state, now = Date.now()) {
  const m = /^([A-Za-z0-9-]{1,64})\.(\d{10,16})\.([A-Za-z0-9_-]{20,})$/.exec(String(state || ""));
  if (!m) return null;
  if (!(now - Number(m[2]) >= 0 && now - Number(m[2]) < STATE_MAX_AGE_MS)) return null;
  const want = await hmac(env, "gh-state:" + m[1] + "." + m[2]);
  return want === m[3] ? m[1] : null;
}

/** Where the user signs in with GitHub. */
export function signInUrl(env, state) {
  const u = new URL(GITHUB_WEB + "/login/oauth/authorize");
  u.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
  u.searchParams.set("redirect_uri", String(env.CODER_PUBLIC_URL).replace(/\/+$/, "") + "/api/coder/github/callback");
  u.searchParams.set("state", state);
  return u.toString();
}
/** Where the user picks which repositories Coder may use. */
export function installUrl(env) {
  return env.GITHUB_APP_SLUG ? GITHUB_WEB + "/apps/" + encodeURIComponent(env.GITHUB_APP_SLUG) + "/installations/new" : "";
}

// ── THE TOKENS ───────────────────────────────────────────────────────────────
async function tokenCall(env, params, fetchFn) {
  const r = await fetchFn(GITHUB_WEB + "/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("GitHub would not give a token: " + String(j.error || r.status));
  const now = Date.now();
  return {
    access: j.access_token,
    refresh: j.refresh_token || "",
    expires: j.expires_in ? now + Number(j.expires_in) * 1000 : 0,
    refreshExpires: j.refresh_token_expires_in ? now + Number(j.refresh_token_expires_in) * 1000 : 0,
  };
}
export const exchangeCode = (env, code, fetchFn = fetch) => tokenCall(env, { code: String(code || "") }, fetchFn);
export const refreshToken = (env, refresh, fetchFn = fetch) => tokenCall(env, { grant_type: "refresh_token", refresh_token: refresh }, fetchFn);

export async function seal(env, obj) {
  const k = await crypto.subtle.importKey("raw", await keyBytes(env), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}
export async function unseal(env, box) {
  const k = await crypto.subtle.importKey("raw", await keyBytes(env), "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

const tokenKey = (uid) => "coder/" + uid + "/github.json";

export async function saveConnection(env, bucket, uid, tok, login = "") {
  await bucket.put(tokenKey(uid), JSON.stringify({ login, at: Date.now(), box: await seal(env, tok) }), { httpMetadata: { contentType: "application/json" } });
}
export async function forgetConnection(bucket, uid) { if (typeof bucket.delete === "function") await bucket.delete(tokenKey(uid)); }

/**
 * The user's GitHub token, refreshed when it is about to expire; `null` when they
 * never connected, or the connection can no longer be renewed (they sign in again).
 */
export async function userToken(env, bucket, uid, { fetchFn = fetch, now = Date.now() } = {}) {
  const o = await bucket.get(tokenKey(uid));
  if (!o) return null;
  let rec, tok;
  try { rec = JSON.parse(await o.text()); tok = await unseal(env, rec.box); } catch { return null; }
  if (!tok.expires || tok.expires - now > REFRESH_EARLY_MS) return { token: tok.access, login: rec.login || "" };
  if (!tok.refresh || (tok.refreshExpires && tok.refreshExpires <= now)) return null;
  let fresh;
  try { fresh = await refreshToken(env, tok.refresh, fetchFn); } catch { return null; }
  await saveConnection(env, bucket, uid, fresh, rec.login || "");
  return { token: fresh.access, login: rec.login || "" };
}

// ── THE GITHUB API, AS THE USER ──────────────────────────────────────────────
export async function gh(token, path, { method = "GET", body = null, fetchFn = fetch } = {}) {
  const r = await fetchFn(GITHUB_API + path, {
    method,
    headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "gofarther-coder", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data: j };
}

/** The repositories this user let Coder use (through the app's installations): `[{ repo, branch, private }]`. */
export async function listRepos(token, fetchFn = fetch) {
  const inst = await gh(token, "/user/installations?per_page=100", { fetchFn });
  if (!inst.ok) throw new Error("GitHub would not list the installations: " + inst.status);
  const out = [];
  for (const i of (inst.data && inst.data.installations) || []) {
    const r = await gh(token, "/user/installations/" + i.id + "/repositories?per_page=100", { fetchFn });
    if (!r.ok) continue;
    for (const x of (r.data && r.data.repositories) || []) out.push({ repo: x.full_name, branch: x.default_branch || "main", private: !!x.private });
  }
  return out;
}

/** The pull request for `head` into `base`: opened, or the one already open. `{ url, number }` or null. */
export async function openPullRequest(token, repo, { head, base, title, body }, fetchFn = fetch) {
  const made = await gh(token, "/repos/" + repo + "/pulls", { method: "POST", body: { head, base, title, body }, fetchFn });
  if (made.ok && made.data) return { url: made.data.html_url, number: made.data.number };
  const owner = repo.split("/")[0];
  const open = await gh(token, "/repos/" + repo + "/pulls?state=open&head=" + encodeURIComponent(owner + ":" + head), { fetchFn });
  const pr = open.ok && Array.isArray(open.data) ? open.data[0] : null;
  return pr ? { url: pr.html_url, number: pr.number } : null;
}

/** A repository's name, as GitHub writes it: owner/name. */
export const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
/** A branch name we may use. */
export const BRANCH = /^[A-Za-z0-9._/-]{1,100}$/;
