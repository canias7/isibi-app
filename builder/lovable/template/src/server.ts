// A PUBLISHED SITE, AS A WORKER — and under Start it is the SERVER ENTRY rather
// than a script wrapping one.
//
// `tanstackStart({ start: { entry: "src/server.ts" } })` makes Start's own build
// bundle this file, so the site is ONE vite build instead of three. What went:
// the separate `vite build --config vite.worker.config.mjs` pass, the staging of
// `site-worker-entry.js` and `site-config.js` into the template, the SSR build
// for the prerender, and `packageWorker`'s shell splicing — with it the
// `[object Object]` class of bug, where `String()` turned a dist entry into
// fifteen literal characters and served them as every page's whole document.
//
// WHY A WORKER AT ALL. A published site was static files on R2: an empty
// `<div id="root">` plus a bundle, with a build-time prerender filling that div
// in so a link preview and a crawler see a real page. That step was best-effort
// by design and on 2026-08-16 it produced nothing on a real build — the child
// was killed 4.4s in, wrote nothing to either stream, and the site published
// blank to anything that does not run JavaScript. Nothing failed. Rendering at
// REQUEST time removes the step and therefore the failure.
//
// A WORKER CANNOT LOAD CODE AT RUNTIME — no eval, no dynamic import of anything
// not bundled at upload — so "one Worker that renders whichever site was asked
// for" is impossible. That is what forces a script per site and therefore the
// dispatch namespace. Stated because it is the first design anybody reaches for
// and the runtime refuses it, not our architecture.
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { SITE_BUILD, SITE_SLUG, SITE_VERSION, SITE_PARENT } from "./site-brand";
import { setSiteMeta, type SiteMeta } from "./site-runtime";
import { runSiteEffects, type EffectEnv } from "./lib/site-effects";
import { rescopeCookie } from "./lib/effects/site-cookie.mjs";
import { serveUpload, visitorUpload, type FilesEnv } from "./lib/site-files";
import { siteCheckout, stripeSiteWebhook, type PayEnv } from "./lib/site-pay";
import { siteApi, siteHook, type ConnectEnv } from "./lib/site-connect";
import { siteSeoFile, siteRedirect, absolutized, type AddressEnv } from "./lib/site-addresses";
import { siteError, countVisit, type TelemetryEnv } from "./lib/site-telemetry";
import { tooMany, visitorIp, limited } from "./lib/site-limit";
import { siteJob, JOB_HEADER, type JobEnv } from "./lib/site-jobs-run";
import { siteTick, type RetryEnv } from "./lib/site-webhook-retry";

// ── THIS SCRIPT READS ITS OWN PREFIX (stage 7, 2026-09-05) ────────────────────
//
// A publish stages its dist under `builds/<slug>/<version>/client/` and never
// changes it; the version is baked here beside the build id. So the assets
// this document names are the ones under this script's own prefix, whatever
// is published after it — uploading a script can never point a live page at
// files that are not there, and an old script keeps serving its own build
// until the new one is live.
//
// ONE FALLBACK HOP, and it is the in-session grace the platform's sweep used
// to give by deferring deletes: a visitor holding the PREVIOUS build's
// document asks this script for that build's chunk, which lives under the
// parent's prefix — or under the frozen `sites/<slug>/` for a site whose last
// publish was made before this. A script built before this has no version
// and reads `sites/<slug>/` exactly as it always did.
const OWN_ASSETS = SITE_VERSION ? "builds/" + SITE_SLUG + "/" + SITE_VERSION + "/client" : "sites/" + SITE_SLUG;
const PARENT_ASSETS = SITE_VERSION
  ? (SITE_PARENT ? "builds/" + SITE_SLUG + "/" + SITE_PARENT + "/client" : "sites/" + SITE_SLUG)
  : "";

// KEPT IN STEP WITH `site-meta.mjs`'s `SITE_LIVE_FILE` BY A TEST. The template is
// built separately and cannot import it, and a mismatch here is silent in the
// worst direction: the probe misses forever and every page of every site 404s.
const LIVE_FILE = "site.live";

// `createStartHandler` RETURNS THE FETCH FUNCTION, not an object carrying one.
// Start's own generated entry reads `createServerEntry({ fetch: createStartHandler(…) })`.
const startFetch = createStartHandler(defaultStreamHandler);

// DECLARED STRUCTURALLY RATHER THAN IMPORTED. The alternative is
// `@cloudflare/workers-types`, a dependency in every published site's tree for
// one interface — and this is the whole surface used: a get, and what an object
// answers. A narrower type is also a better one here, because it says exactly
// what the entry is allowed to do with the bucket.
type SiteObject = { body: ReadableStream | null; text(): Promise<string>; writeHttpMetadata(h: Headers): void };
type Env = {
  SITES?: { get(key: string): Promise<SiteObject | null>; head(key: string): Promise<unknown> };
  // This site's own database addresses, both public (2026-10-27): the Data API
  // and the auth server that mints a visitor token. Given at upload, never a key.
  DATA_API_BASE?: string;
  AUTH_BASE?: string;
  // 2026-10-27: this site saves its own visitors' rows and runs what follows
  // them (lib/site-effects.ts). Whether the bucket above is its own, and its
  // form settings; the owner's keys, address and limited login arrive as the
  // other named values (`EffectEnv`).
  OWN_BUCKET?: string;
  SITE_TABLES?: string;
  [name: string]: unknown;
};
type Bucket = { get(key: string): Promise<SiteObject | null>; put(key: string, v: string): Promise<unknown> };
type Ctx = { waitUntil(p: Promise<unknown>): void };

// ── THIS SITE ANSWERS ITS OWN VISITORS' READS (2026-10-27) ──────────────────
//
// GET and HEAD on `/api/db/<this site>/data/…` go straight to this site's own
// Data API, as the visitor (their own sign-in token) or as an anonymous
// visitor (a short-lived token the auth server mints, no secret involved).
// The database's row rules decide what anyone may read. Writes are not handled
// here: the platform keeps them, with the spam gate and what follows a form.
// Marked `x-site-data: own` so the platform knows the answer is this one.
let anonTok = "";
let anonAt = 0;
async function anonToken(env: Env): Promise<string> {
  if (anonTok && Date.now() - anonAt < 60_000) return anonTok;
  const r = await fetch(env.AUTH_BASE + "/token/anonymous", { headers: { accept: "application/json" } });
  if (!r.ok) return "";
  const text = await r.text();
  let tok = "";
  try { const j = JSON.parse(text); tok = j.token || j.access_token || j.accessToken || j.jwt || ""; } catch { /* below */ }
  if (!tok) { const m = /\b(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/.exec(text); tok = m ? m[1] : ""; }
  if (tok) { anonTok = tok; anonAt = Date.now(); }
  return tok;
}

// ── THIS SITE SAVES ITS OWN VISITORS' ROWS (phase A, 2026-10-27) ────────────
//
// POST / PATCH / PUT / DELETE on its own data path, only when this site holds
// its own note key and its own bucket. The spam check is off for now (owner,
// 2026-10-27: a later addition), so its token field is dropped. A press sent
// twice with one idempotency key is answered once: the first 2xx answer is
// kept in the site's own bucket for 10 minutes and replayed. What follows a
// row change (emails, texts, webhooks) runs here too, after the answer, with
// this site's own keys (lib/site-effects.ts).
const WRITE = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const IDEM_RE = /^[A-Za-z0-9_-]{16,64}$/;
const IDEM_TTL_MS = 600_000;
const hexOf = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
async function hmacHex(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hexOf(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}
function dropChallenge(text: string): string {
  try {
    const o = JSON.parse(text);
    if (o && typeof o === "object" && !Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, "cf-turnstile-response")) {
      delete o["cf-turnstile-response"];
      return JSON.stringify(o);
    }
  } catch { /* not JSON: as sent */ }
  return text;
}

export async function ownDataWrite(request: Request, env: Env, url: URL, ctx?: Ctx): Promise<Response | null> {
  if (!WRITE.has(request.method)) return null;
  if (!env.DATA_API_BASE || !env.AUTH_BASE || !env.SITE_TABLES || env.OWN_BUCKET !== "1" || !env.SITES) return null;
  const prefix = "/api/db/" + SITE_SLUG + "/data/";
  if (!url.pathname.toLowerCase().startsWith(prefix)) return null;
  const path = url.pathname.slice(prefix.length);
  if (!/^[a-z0-9_][a-z0-9/._-]{0,79}$/i.test(path)) return null;
  // Writes per visitor per minute — the platform's old ceiling, kept here.
  const wait = tooMany("write|" + visitorIp(request), 60);
  if (wait) return limited(wait);
  const bucket = env.SITES as unknown as Bucket;
  const sent = dropChallenge(await request.text());

  const key = request.method === "POST" ? request.headers.get("idempotency-key") : null;
  const idemKey = key && IDEM_RE.test(key) ? "idem/" + path.split("/")[0].toLowerCase() + "/" + key : "";
  const fp = idemKey ? await hmacHex("fp", sent) : "";
  if (idemKey) {
    try {
      const prior = await bucket.get(idemKey);
      if (prior) {
        const p = JSON.parse(await prior.text());
        if (Date.now() - Number(p.at) < IDEM_TTL_MS && p.fp === fp) {
          return new Response(p.body, { status: p.status, headers: { "content-type": p.ct || "application/json", "x-idempotent-replay": "1", "x-site-data": "own" } });
        }
      }
    } catch { /* a memory that cannot be read is no memory: the press goes through */ }
  }

  const h = new Headers();
  for (const k of ["accept", "prefer", "authorization", "cookie", "content-type"]) { const v = request.headers.get(k); if (v) h.set(k, v); }
  try { h.set("origin", new URL(env.DATA_API_BASE).origin); } catch { /* answered below */ }
  if (!h.has("authorization")) {
    const tok = await anonToken(env).catch(() => "");
    if (!tok) return null;
    h.set("authorization", "Bearer " + tok);
  }
  let r: Response;
  try { r = await fetch(env.DATA_API_BASE + "/" + path + url.search, { method: request.method, headers: h, body: sent }); }
  catch { return Response.json({ error: "couldn't reach that just now" }, { status: 503, headers: { "x-site-data": "own" } }); }
  const body = await r.text();
  const ct = r.headers.get("content-type") || "application/json";

  if (r.status >= 200 && r.status < 300) {
    if (idemKey && body.length <= 64 * 1024) {
      const keep = bucket.put(idemKey, JSON.stringify({ at: Date.now(), fp, status: r.status, body, ct })).catch(() => {});
      if (ctx) ctx.waitUntil(keep); else await keep;
    }
    // WHAT FOLLOWS, run here: the owner's email, the confirmation, the text,
    // the webhook — with this site's own keys (lib/site-effects.ts).
    const follow = runSiteEffects(env as unknown as EffectEnv, ctx, { slug: SITE_SLUG, method: request.method, path, search: url.search || "", sent, body }).catch(() => []);
    if (ctx) ctx.waitUntil(follow); else await follow;
  }
  const out = new Headers({ "content-type": ct, "x-site-data": "own" });
  const cr = r.headers.get("content-range");
  if (cr) out.set("content-range", cr);
  return new Response(body, { status: r.status, headers: out });
}

// ── THIS SITE SIGNS ITS OWN VISITORS IN (2026-10-27) ────────────────────────
//
// `/api/db/<this site>/auth/…` goes straight to this site's own auth server.
// The session cookie it answers with is kept for this site's API paths only
// (`rescopeCookie`, the platform's own rule, copied), and the two session
// headers the auth server hands back are passed on as they came.
export async function ownAuth(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!env.AUTH_BASE || !env.SITE_TABLES) return null;
  const prefix = "/api/db/" + SITE_SLUG + "/auth/";
  if (!url.pathname.toLowerCase().startsWith(prefix)) return null;
  const path = url.pathname.slice(prefix.length);
  if (!/^[a-z0-9][a-z0-9/._-]{0,79}$/i.test(path) || path.split("/").includes("..")) return null;
  // Sign-in, sign-up and reset tries per visitor per minute; reads are free.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const wait = tooMany("auth|" + visitorIp(request), 20);
    if (wait) return limited(wait);
  }
  const h = new Headers();
  for (const k of ["content-type", "authorization", "accept", "prefer", "cookie"]) { const v = request.headers.get(k); if (v) h.set(k, v); }
  try { h.set("origin", new URL(env.AUTH_BASE).origin); } catch { /* answered below */ }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  let r: Response;
  try { r = await fetch(env.AUTH_BASE + "/" + path + url.search, { method: request.method, headers: h, body, redirect: "follow" }); }
  catch { return Response.json({ error: "couldn't reach that just now" }, { status: 503, headers: { "x-site-data": "own" } }); }
  const out = new Headers({ "content-type": r.headers.get("content-type") || "application/json", "x-site-data": "own" });
  const cookie = rescopeCookie(r.headers.get("set-cookie"), "/api/db/" + SITE_SLUG + "/");
  if (cookie) out.set("set-cookie", cookie);
  for (const k of ["set-auth-token", "set-auth-jwt"]) { const v = r.headers.get(k); if (v) out.set(k, v); }
  return new Response(await r.text(), { status: r.status, headers: out });
}

export async function ownDataRead(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!env.DATA_API_BASE || !env.AUTH_BASE) return null;
  const prefix = "/api/db/" + SITE_SLUG + "/data/";
  if (!url.pathname.toLowerCase().startsWith(prefix)) return null;
  const path = url.pathname.slice(prefix.length);
  if (!/^[a-z0-9_][a-z0-9/._-]{0,79}$/i.test(path)) return null;
  const h = new Headers();
  for (const k of ["accept", "prefer", "authorization", "cookie"]) { const v = request.headers.get(k); if (v) h.set(k, v); }
  try { h.set("origin", new URL(env.DATA_API_BASE).origin); } catch { /* a base we cannot parse answers below */ }
  if (!h.has("authorization")) {
    const tok = await anonToken(env).catch(() => "");
    if (!tok) return null;
    h.set("authorization", "Bearer " + tok);
  }
  let r: Response;
  try { r = await fetch(env.DATA_API_BASE + "/" + path + url.search, { method: request.method, headers: h }); }
  catch { return null; }
  const out = new Headers({ "content-type": r.headers.get("content-type") || "application/json", "x-site-data": "own" });
  const cr = r.headers.get("content-range");
  if (cr) out.set("content-range", cr);
  return new Response(request.method === "HEAD" ? null : await r.text(), { status: r.status, headers: out });
}

/** Is this a request for a file rather than a page?
 *
 *  The same rule the platform Worker's fallback uses: a path with an extension
 *  is an asset, anything else is a route. They must agree — a request
 *  classified as a page here and an asset there is a page that 404s on one
 *  mount and renders on the other. */
export function isAsset(pathname: string): boolean {
  const last = String(pathname || "").split("/").pop() || "";
  return last.includes(".");
}

// READ ONCE PER ISOLATE, not once per request. See `site-runtime.ts` for why a
// module-scope cache is safe here and nowhere else: one dispatch script serves
// exactly one site, so there is no second site's meta to confuse this with.
//
// `loaded` is separate from the value because NULL IS A REAL ANSWER — a site
// whose designer wrote no description — and keying on the value alone would
// re-read R2 on every request for exactly those sites.
//
// READ AGAIN AFTER `META_TTL_MS` (audit A11-4, 2026-10-23). The owner's panels
// (verification, share picture, description) and the rename lane patch the
// sidecar without a new script and tell the owner it is live; read once, a
// warm isolate served the old head until Cloudflare recycled it. Now a patch
// is served within half a minute, at one R2 read per isolate per half minute.
// A failed re-read keeps the head already held.
const META_TTL_MS = 30_000;
let loaded = false;
let loadedAt = 0;

async function loadMeta(env: Env, previewing = false): Promise<void> {
  if (loaded && Date.now() - loadedAt < META_TTL_MS) return;
  loaded = true;
  loadedAt = Date.now();
  try {
    // A DRAFT'S PREVIEW READS THE HEAD OF THE VERSION IT SERVES (2026-10-16,
    // after Codex's review of `fbd53dca`): its description, address and
    // redirects, not the live site's. They are the bytes staged with that
    // version (`builds/<slug>/<version>/state/sidecar.json`), written once
    // before the version was saved and never again, and the ones Publish of
    // that version writes live — so no later or earlier save can put another
    // version's head under this script. One preview copy serves only previews,
    // so the cache is this version's. A version staged without one (or a
    // script built before versions) reads the live head, as before.
    if (previewing && SITE_VERSION) {
      const own = env.SITES && (await env.SITES.get("builds/" + SITE_SLUG + "/" + SITE_VERSION + "/state/sidecar.json"));
      if (own) { setSiteMeta(JSON.parse(await own.text()) as SiteMeta); return; }
    }
    // OUTSIDE `sites/<slug>/`, deliberately. The asset branch below serves that
    // prefix verbatim, so a meta file under it would be fetchable at
    // `/site-meta.json`. Nothing in it is secret, but a file the site never
    // meant to publish is not one to publish by accident.
    const obj = env.SITES && (await env.SITES.get("sitemeta/" + SITE_SLUG + ".json"));
    if (obj) setSiteMeta(JSON.parse(await obj.text()) as SiteMeta);
  } catch {
    // A BLIP COSTS THE SHARE TAGS, NEVER THE PAGE. Every field here is
    // decoration on top of a document that renders perfectly without it, so the
    // failure mode is a plainer link preview rather than a site that is down.
    // `loaded` is already true, so this is not retried on every request of a
    // sustained outage — only once `META_TTL_MS` has passed again.
  }
}

// WHICH BUILD ANSWERED. Stamped on EVERY response, and the two failure modes
// this exists for are both reasons it cannot be document-only.
//
// A dispatch-namespace script does not start serving the moment its upload is
// accepted, so "the publish route returned 200" and "the site is serving that
// build" are different facts — measured twice live, where a read 0.2s after a
// revise came back with the PREVIOUS build's stylesheet. The platform waits on
// this header before it calls a publish done, and the builder's preview reloads
// on the back of that, so without it the customer reloads into their old site
// and concludes the change did nothing.
//
// ON THE 404s TOO, deliberately. A FIRST build uploads its script before the
// site is browsable, and the take-down probe below answers 404 for a site whose
// files are not there yet — so a document-only stamp would be invisible on
// exactly the build that most needs confirming, and the wait would time out on
// every new site.
//
// The header is the build id and nothing else: no timing, no slug, no version
// of ours. It is also the answer to "which build is this site actually
// serving", which until now could only be inferred from asset hashes — and two
// runs of this platform were spent doing exactly that inference, wrongly.
const stamp = (res: Response): Response => {
  try {
    const h = new Headers(res.headers);
    h.set("x-site-build", SITE_BUILD);
    // AND WHICH VERSION — the prefix this script serves. Empty on a script
    // built before the layout existed, and then not sent at all.
    if (SITE_VERSION) h.set("x-site-version", SITE_VERSION);
    // THE BODY IS PASSED THROUGH, NOT READ. Start streams its SSR response, so
    // buffering it here would hold every page until the last byte and give up
    // the streaming the handler exists to do.
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch {
    // A HEADER IS NEVER WORTH A PAGE. If a response cannot be re-wrapped for
    // any reason, the visitor gets the original — the platform then fails to
    // confirm and says so, which is the cheap half of the pair.
    return res;
  }
};

export default {
  async fetch(request: Request, env: Env, ctx?: Ctx): Promise<Response> {
    return stamp(await site.fetch(request, env, ctx));
  },
};

const site = {
  async fetch(request: Request, env: Env, ctx?: Ctx): Promise<Response> {
    const url = new URL(request.url);

    const own = (await ownDataRead(request, env, url)) || (await ownDataWrite(request, env, url, ctx)) || (await ownAuth(request, env, url))
      || (await serveUpload(request, env as unknown as FilesEnv, url, SITE_SLUG)) || (await visitorUpload(request, env as unknown as FilesEnv, url, SITE_SLUG))
      || (await siteCheckout(request, env as unknown as PayEnv, url, SITE_SLUG, ctx)) || (await stripeSiteWebhook(request, env as unknown as PayEnv, url, SITE_SLUG, ctx))
      || (await siteApi(request, env as unknown as ConnectEnv, url, SITE_SLUG)) || (await siteHook(request, env as unknown as ConnectEnv, url, SITE_SLUG))
      || (await siteError(request, env as unknown as TelemetryEnv, url, SITE_SLUG, ctx))
      // Spam protection is off for now (owner, 2026-10-27): the widget asks, and is told none.
      || (url.pathname.toLowerCase() === "/api/db/" + SITE_SLUG + "/turnstile" ? Response.json({}, { headers: { "x-site-data": "own", "cache-control": "public, max-age=60" } }) : null)
      || (await siteJob(request, env as unknown as JobEnv, url))
      || (await siteTick(request, env as unknown as RetryEnv, url, SITE_SLUG, JOB_HEADER));
    if (own) return own;

    // ASSETS STAY ON R2, and this is a cost decision rather than a detail.
    // Putting a JavaScript bundle or a stylesheet through compute is paying per
    // request for what a CDN does for nothing, on the files requested most.
    // Only the document is rendered.
    const seo = await siteSeoFile(request, env as unknown as AddressEnv, url, [OWN_ASSETS, PARENT_ASSETS]);
    if (seo) return seo;

    if (isAsset(url.pathname)) {
      let obj = env.SITES && (await env.SITES.get(OWN_ASSETS + url.pathname));
      // The one hop back — see `PARENT_ASSETS` above. Never for a versionless
      // script, whose own prefix IS the legacy one.
      if (!obj && PARENT_ASSETS) obj = env.SITES && (await env.SITES.get(PARENT_ASSETS + url.pathname));
      if (!obj) return new Response("Not found", { status: 404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      // TRUE BY CONSTRUCTION rather than optimistic: vite content-hashes every
      // emitted asset name, so a file at this address can never change.
      h.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(obj.body, { headers: h });
    }

    // ── IS THIS SITE STILL PUBLISHED? ────────────────────────────────────────
    //
    // A MISS IS PERMANENT, A THROW IS TRANSIENT, and the two must not be
    // confused — the distinction the R2-shell entry drew explicitly and which
    // was lost when the shell went.
    //
    // The old design got this for free: a page WAS a document in R2, so wiping
    // `sites/<slug>/` made every route 404 and that miss was the take-down.
    // Under Start the document renders from this bundle and needs no R2 at all,
    // so without this probe a deleted site keeps serving — measured by the
    // container harness as "200 — a deleted site is still serving". Both site
    // deletion and the offline switch rest on it.
    //
    // NOT CACHED, unlike the meta above: "take this site offline" that waits for
    // an isolate to recycle is not offline. It is one R2 head per document, and
    // that is CHEAPER than the get the old shell read cost on the same path, so
    // it is not a new expense — it is the old one, smaller.
    // A DRAFT'S PREVIEW (draft-first, 2026-10-15). The platform sends this
    // header only from its own draft route, to the preview copy of this
    // script, and strips it from every request it forwards to a live one —
    // so a draft is seen before the site is live (a first build has no live
    // marker yet), and nothing a visitor sends can switch the probe off.
    const previewing = request.headers.get("x-site-preview") === "1";
    if (env.SITES && !previewing) {
      let live = true;
      try {
        live = (await env.SITES.head("sites/" + SITE_SLUG + "/" + LIVE_FILE)) !== null;
      } catch {
        // Transient. An R2 blip must not take a live site down, so an
        // unanswerable question keeps the site up — being wrong that way serves
        // a page that should be gone for a few seconds, and being wrong the
        // other way takes every published site down during an R2 incident.
        live = true;
      }
      if (!live) return new Response("Not found", { status: 404 });
    }

    await loadMeta(env, previewing);
    const page = await startFetch(request);
    // AN ADDRESS THE SITE DOES NOT HAVE: a moved or deleted page goes where it
    // went (previews never redirect: the draft's own routes are what they show).
    if (page.status === 404 && !previewing) {
      const moved = await siteRedirect(env as unknown as AddressEnv, url, SITE_SLUG);
      if (moved) return moved;
    }
    if (!previewing) countVisit(request, env as unknown as TelemetryEnv, page, url, SITE_SLUG, ctx);
    return absolutized(page, url, SITE_SLUG);
  },
};
