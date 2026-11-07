// YOUR GITHUB LOGIN NEVER ENTERS CODER'S MACHINE (owner, 2026-11-07: "Do 1
// and 3"). Like Claude Code, whose docs say: "GitHub credentials are stored
// encrypted on Anthropic's servers and never enter the session VM. The VM holds
// a short-lived credential scoped to that session, and GitHub traffic goes
// through an Anthropic proxy that attaches the GitHub credential on the server
// side." and "The GitHub proxy rejects branch deletions and pushes of anything
// other than a branch, such as a tag."
//
// Coder's machine is given only a short-lived pass for its chat (made here, for
// one chat and one turn, until a time). Its git talks to this address of
// Coder's Worker with that pass; the Worker checks it, adds the owner's GitHub
// login, and passes the request on to GitHub. Git may read the chat's own
// repositories, and push only to the chat's own branch (made or moved, never
// deleted); the one other push is the very first commit of an empty
// repository's main branch, which Coder makes when it opens one. No tags.

import { userToken } from "./coder-github.mjs";

export const GIT_PATH = "/api/coder/git/";
/** A pass lasts 3 hours: a job works 45 minutes at most, after a setup of up to 5, then its save. */
export const GIT_PASS_MS = 3 * 60 * 60 * 1000;
/** The largest push the Worker takes (Cloudflare's own limit for a request is 100 MB). */
export const GIT_BODY_MAX = 95 * 1024 * 1024;
const ZERO = /^0{40}$/;

const enc = new TextEncoder();
const b64url = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const text = (s, status = 400) => new Response(s + "\n", { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });

/** The pass for one chat's git, for one turn, until a time: only the Worker can make it (CODER_TOKEN_KEY). */
export async function gitPass(env, chat, turn, until) {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return "";
  const k = await crypto.subtle.importKey("raw", enc.encode("coder-git-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode("git:" + chat + ":" + turn + ":" + until)));
}

/**
 * WHAT THE MACHINE'S GIT IS GIVEN for a job (or an Undo): the Worker's git
 * address and the pass, as git headers. Never the login itself.
 */
export async function gitAccess(env, uid, id, turn, now = Date.now()) {
  const until = now + GIT_PASS_MS, chat = uid + "/" + id;
  const pass = await gitPass(env, chat, turn, until);
  if (!pass) return null;
  const base = String(env.CODER_PUBLIC_URL || "https://coder.gofarther.dev").replace(/\/+$/, "");
  return { remote: base + GIT_PATH, headers: ["X-Coder-Chat: " + chat, "X-Coder-Turn: " + turn, "X-Coder-Until: " + until, "X-Coder-Git: " + pass] };
}

/** The ref changes a push asks for (git's own format), or null when they cannot be read. */
export async function pushCommands(buf, encoding = "") {
  let bytes = new Uint8Array(buf);
  if (/gzip/i.test(String(encoding))) {
    try { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()); } catch { return null; }
  }
  const dec = new TextDecoder(), cmds = [];
  let i = 0;
  while (i + 4 <= bytes.length) {
    const len = parseInt(dec.decode(bytes.subarray(i, i + 4)), 16);
    if (!Number.isInteger(len)) return null;
    if (len === 0) return cmds; // the end of the commands (the pack follows)
    if (len < 4 || i + len > bytes.length) return null;
    const line = dec.decode(bytes.subarray(i + 4, i + len)).split("\0")[0].replace(/\n$/, "");
    i += len;
    if (line.startsWith("shallow ")) continue;
    const c = /^([0-9a-f]{40}) ([0-9a-f]{40}) (refs\/\S+)$/.exec(line);
    if (!c) return null;
    cmds.push({ old: c[1], new: c[2], ref: c[3] });
  }
  return null;
}

/**
 * `/api/coder/git/<owner>/<repo>.git/(info/refs|git-upload-pack|git-receive-pack)`
 * from Coder's machine, with its pass in X-Coder-Chat, -Turn, -Until and -Git.
 */
export async function handleGit(request, env, { fetchFn = fetch, now = Date.now() } = {}) {
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return text("storage is not available", 503);
  const url = new URL(request.url);
  const m = /^\/api\/coder\/git\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/(info\/refs|git-upload-pack|git-receive-pack)$/.exec(url.pathname);
  if (!m) return text("not a git address", 404);
  const [, owner, name, what] = m;
  const service = what === "info/refs" ? url.searchParams.get("service") : what;
  if (service !== "git-upload-pack" && service !== "git-receive-pack") return text("not a git service");
  if (request.method !== (what === "info/refs" ? "GET" : "POST")) return text("method", 405);
  const h = (k) => String(request.headers.get(k) || "");
  const chat = h("x-coder-chat"), turn = h("x-coder-turn"), until = h("x-coder-until");
  const c = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/.exec(chat);
  if (!c || !/^\d{1,9}$/.test(turn) || !/^\d{13}$/.test(until)) return text("not a job's git", 403);
  const want = await gitPass(env, chat, turn, until);
  if (!want || !same(want, h("x-coder-git"))) return text("not this job's pass", 403);
  if (Number(until) <= now) return text("this pass has ended", 403);
  const [, uid, id] = c;
  let meta = null;
  try { const o = await bucket.get("coder/" + uid + "/" + id + "/meta.json"); meta = o ? JSON.parse(await o.text()) : null; } catch { meta = null; }
  if (!meta || String(meta.turn) !== turn) return text("that chat has moved on", 403);
  // Only the chat's own repositories.
  const full = (owner + "/" + name).toLowerCase();
  const repos = [{ repo: meta.repo, base: meta.base }, ...(Array.isArray(meta.repos) ? meta.repos : [])].filter((r) => r && typeof r.repo === "string");
  const mine = repos.find((r) => r.repo.toLowerCase() === full);
  if (!mine) return text("not one of this chat's repositories", 403);
  // A READ-ONLY REPOSITORY (owner item 5): the owner may read it, never push to it; Coder's work stays on its machine.
  const readOnly = mine.repo === meta.repo ? meta.readOnly === true : mine.readOnly === true;
  if (readOnly && service === "git-receive-pack") return text("you can read " + mine.repo + " but not push to it, so Coder keeps its work on its machine", 403);
  let body;
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length")) > GIT_BODY_MAX) return text("that push is too large", 413);
    body = await request.arrayBuffer();
    if (body.byteLength > GIT_BODY_MAX) return text("that push is too large", 413);
    if (service === "git-receive-pack") {
      const cmds = await pushCommands(body, request.headers.get("content-encoding"));
      if (!cmds || !cmds.length) return text("that push could not be read");
      for (const x of cmds) {
        const own = x.ref === "refs/heads/" + meta.branch;
        const firstMain = x.ref === "refs/heads/" + String(mine.base || "main") && ZERO.test(x.old);
        if (ZERO.test(x.new)) return text("Coder never deletes a branch", 403);
        if (!own && !firstMain) return text("Coder pushes only to its own branch " + meta.branch, 403);
      }
    }
  }
  const t = await userToken(env, bucket, uid, { fetchFn });
  if (!t) return text("connect GitHub again: the connection has ended", 403);
  const headers = { authorization: "Basic " + btoa("x-access-token:" + t.token), "user-agent": "gofarther-coder" };
  for (const k of ["content-type", "accept", "git-protocol", "content-encoding"]) { const v = request.headers.get(k); if (v) headers[k] = v; }
  let r;
  try { r = await fetchFn("https://github.com/" + owner + "/" + name + ".git/" + what + url.search, { method: request.method, headers, ...(body !== undefined ? { body } : {}), redirect: "manual" }); }
  catch { return text("GitHub could not be reached", 502); }
  // A PUBLIC REPOSITORY GITHUB KEEPS FROM THE OWNER'S LOGIN (one Coder's app is not on): read with no login
  // at all, as anyone may (like Claude Code: "a session can clone any public repository").
  if (readOnly && [401, 403, 404].includes(r.status)) {
    delete headers.authorization;
    try { r = await fetchFn("https://github.com/" + owner + "/" + name + ".git/" + what + url.search, { method: request.method, headers, ...(body !== undefined ? { body } : {}), redirect: "manual" }); }
    catch { return text("GitHub could not be reached", 502); }
  }
  // Only the headers git needs come back (nothing GitHub might echo of the login).
  const out = new Headers();
  for (const k of ["content-type", "cache-control", "expires", "pragma"]) { const v = r.headers.get(k); if (v) out.set(k, v); }
  return new Response(r.body, { status: r.status, headers: out });
}
