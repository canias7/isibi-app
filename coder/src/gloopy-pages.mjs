// GLOOPY'S PAGES, KEPT AND SHOWN BY CODER'S WORKER (owner, 2026-11-09: "lets focus on the tools"; Grok Bot's Pages:
// "something a Bot builds for you to read, such as a report, a memo, a dashboard, a tracker, or an explainer").
// Gloopy publishes an HTML file with its `page` tool; the Worker keeps it (coder/<uid>/gloopy/pages/<id>.html, and a
// list in pages.json) when the turn ends, and the owner opens it from a card in the chat.
//
// SAFE TO OPEN: a page is made by the AI, often from what web pages say, so it never runs as gofarther.dev. It is shown
// from its own short-lived signed address (pagePass, 10 minutes), with its own rules (PAGE_CSP): a sandbox of its own
// (no access to the app, its sign-in or anything stored for the site), nothing sent anywhere (connect-src 'none'), no
// forms, scripts and styles only from three code libraries' addresses, and only gofarther.dev may show it in a frame.
// A new page is the owner's alone; sharing one comes later.

/** At most this many pages per person, each at most PAGE_MAX (as Gloopy's machine reads them). */
export const PAGES_MAX = 100, PAGE_MAX = 512 * 1024;
/** How long an address that opens a page works. */
export const PAGE_PASS_MS = 10 * 60 * 1000;
export const PAGE_ID = /^p[a-z0-9]{10}$/;
export const PAGE_CSP = [
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
// (`ns`: whose pages. "gloopy", Gloopy's, as always; "artifacts", Coder's artifacts (src/coder-artifacts.mjs, 2026-11-23),
// kept the same way in their own folder: coder/<uid>/artifacts/.)
export const PAGE_NS = Object.freeze(["gloopy", "artifacts"]);
const nsOf = (ns) => (PAGE_NS.includes(ns) ? ns : "gloopy");
const listKey = (uid, ns = "gloopy") => ["coder", uid, nsOf(ns), "pages.json"].join("/");
const fileKey = (uid, id, ns = "gloopy") => ["coder", uid, nsOf(ns), "pages", id + ".html"].join("/");
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const words = (t, max) => String(t == null ? "" : t).replace(/\s+/g, " ").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().slice(0, max);

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}

/** A person's pages: [{ id, title, version, at, updated, size }], newest first. */
export async function readPages(bucket, uid, ns = "gloopy") {
  const l = await getJson(bucket, listKey(uid, ns), []);
  return (Array.isArray(l) ? l : []).filter((p) => p && PAGE_ID.test(p.id) && typeof p.title === "string").map((p) => ({ id: p.id, title: words(p.title, 80), version: Number(p.version) || 1, at: Number(p.at) || 0, updated: Number(p.updated) || 0, size: Number(p.size) || 0, ...(p.public === true ? { public: true } : {}) })).slice(0, PAGES_MAX);
}

/** The list as Gloopy is told of it with each message. */
export const pagesForTurn = (list) => list.map((p) => ({ id: p.id, title: p.title, version: p.version }));

/**
 * THE PAGES A TURN PUBLISHED, kept (each checked again here): a new one gets its place in the list (at most PAGES_MAX);
 * one published again is its next version. Answers how many were kept.
 */
export async function keepPages(bucket, uid, requests, now = Date.now(), ns = "gloopy") {
  const reqs = (Array.isArray(requests) ? requests : []).filter((r) => r && PAGE_ID.test(r.id) && typeof r.html === "string" && words(r.title, 80)).slice(0, 5);
  if (!reqs.length) return 0;
  const list = await readPages(bucket, uid, ns);
  let kept = 0;
  for (const r of reqs) {
    const size = enc.encode(r.html).length;
    if (size > PAGE_MAX) continue;
    const old = list.find((p) => p.id === r.id);
    if (!old && list.length >= PAGES_MAX) continue;
    await bucket.put(fileKey(uid, r.id, ns), r.html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
    if (old) Object.assign(old, { title: words(r.title, 80), version: old.version + 1, updated: now, size });
    else list.unshift({ id: r.id, title: words(r.title, 80), version: 1, at: now, updated: now, size });
    // (A public link, Coder's artifacts only: on or off as the request says; left as it was when it says nothing.)
    const page = old || list[0];
    if (typeof r.public === "boolean") { if (r.public) page.public = true; else delete page.public; }
    kept++;
  }
  await bucket.put(listKey(uid, ns), JSON.stringify(list), { httpMetadata: { contentType: "application/json" } });
  return kept;
}

/** A page taken away: its file and its place in the list. */
export async function removePage(bucket, uid, id, ns = "gloopy") {
  const list = await readPages(bucket, uid, ns);
  if (!list.some((p) => p.id === id)) return false;
  await bucket.put(listKey(uid, ns), JSON.stringify(list.filter((p) => p.id !== id)), { httpMetadata: { contentType: "application/json" } });
  if (typeof bucket.delete === "function") await bucket.delete(fileKey(uid, id, ns));
  return true;
}

async function passKey(env) {
  const raw = String((env && env.CODER_TOKEN_KEY) || "");
  if (raw.length < 32) return null;
  return crypto.subtle.importKey("raw", enc.encode("coder-page-v1|" + raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
/** The signed part of a page's address: whose page, which, and until when. */
export async function pagePass(env, uid, id, until, ns = "gloopy") {
  const k = await passKey(env);
  return k ? b64url(await crypto.subtle.sign("HMAC", k, enc.encode((nsOf(ns) === "gloopy" ? "page:" : "page:" + nsOf(ns) + ":") + uid + ":" + id + ":" + until))) : "";
}
/** The address that opens one of the owner's pages, for the next PAGE_PASS_MS (the page asks for it with their sign-in). */
export const PAGE_PATHS = Object.freeze({ gloopy: "/api/coder/gloopy-page/", artifacts: "/api/coder/artifact-page/" });
export async function pageAddress(env, uid, id, now = Date.now(), ns = "gloopy") {
  const until = now + PAGE_PASS_MS;
  const t = await pagePass(env, uid, id, until, ns);
  return t ? PAGE_PATHS[nsOf(ns)] + encodeURIComponent(uid) + "/" + id + "?e=" + until + "&t=" + t : "";
}

/**
 * A PAGE, SHOWN (a plain visit, no sign-in header: the signed address says whose it is): its HTML with its own rules
 * (PAGE_CSP), never kept by a browser's cache; anything wrong is a plain "not found".
 */
export async function servePageFile(env, bucket, uid, id, url, now = Date.now(), ns = "gloopy") {
  const nope = () => new Response("This page could not be opened. Open it again from " + (nsOf(ns) === "gloopy" ? "Gloopy's chat" : "the chat") + ".", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const until = Number(url.searchParams.get("e"));
  const given = String(url.searchParams.get("t") || "");
  if (!PAGE_ID.test(id) || !uid || !/^[\w-]{1,80}$/.test(uid) || !Number.isFinite(until) || until < now || until > now + PAGE_PASS_MS + 60_000 || !given) return nope();
  const want = await pagePass(env, uid, id, until, ns);
  if (!want || want.length !== given.length) return nope();
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  if (diff) return nope();
  const o = await bucket.get(fileKey(uid, id, ns));
  if (!o) return nope();
  return new Response(await o.text(), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": PAGE_CSP, "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "private, no-store" } });
}

// ── A PUBLIC LINK (Coder's artifacts, 2026-11-23; Claude Code: "You can share it with a public link") ──────────────────

/** The signed part of an artifact's public link: it works while the artifact is marked public, and never expires on its own. */
export async function publicPass(env, uid, id) {
  const k = await passKey(env);
  return k ? b64url(await crypto.subtle.sign("HMAC", k, enc.encode("public:artifacts:" + uid + ":" + id))) : "";
}
/** An artifact's public link (whole, with the site's address), or "" when Coder's key is not set. */
export async function publicAddress(env, uid, id) {
  const t = await publicPass(env, uid, id);
  const origin = String((env && (env.APP_ORIGIN || env.CODER_PUBLIC_URL)) || "https://gofarther.dev").replace(/\/+$/, "");
  return t ? origin + "/api/coder/artifact/" + encodeURIComponent(uid) + "/" + id + "?k=" + t : "";
}
/**
 * AN ARTIFACT, OPENED FROM ITS PUBLIC LINK (no sign-in): only while it is marked public (taking the link away turns it
 * off), with the same rules as every page (PAGE_CSP); anything wrong is a plain "not found".
 */
export async function servePublicArtifact(env, bucket, uid, id, url) {
  const nope = () => new Response("This page is not shared, or no longer exists.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const given = String(url.searchParams.get("k") || "");
  if (!PAGE_ID.test(id) || !uid || !/^[\w-]{1,80}$/.test(uid) || !given) return nope();
  const want = await publicPass(env, uid, id);
  if (!want || want.length !== given.length) return nope();
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  if (diff) return nope();
  const p = (await readPages(bucket, uid, "artifacts")).find((x) => x.id === id);
  if (!p || p.public !== true) return nope();
  const o = await bucket.get(fileKey(uid, id, "artifacts"));
  if (!o) return nope();
  return new Response(await o.text(), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": PAGE_CSP, "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" } });
}
