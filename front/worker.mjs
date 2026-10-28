// gofarther-front: the front door for customer sites (2026-10-27).
//
// It answers `*.gofarther.app` and customers' own domains once its routes are
// moved here (owner's word, a separate step). Today it does three things and
// owns nothing else:
//
//   1. Strips headers only the platform may set (`x-gf-*` and the draft
//      preview header), so a visitor can never pose as the platform.
//   2. Hands the request to the platform Worker through a SERVICE BINDING
//      (`PLATFORM`): private, not over the internet, and a fixed link to our
//      own code, which is what Cloudflare says service bindings are for. The
//      platform still does the per-site work (the host → site lookup, the
//      dispatch with each site's limits, uploads, data, redirects), and those
//      pieces move in here, or into the site Workers, step by step.
//   3. Marks every answer `x-served-by: gofarther-front`, so `curl -I` shows
//      which door a visit came through.
//
// It holds no secret and no bucket: nothing here can reach a site's files or
// database. Since 2026-10-28 it also calls each site's Worker itself (below).

export const SERVED_BY = "gofarther-front";

/** Headers a visitor must never be able to send on to the platform. */
export function isPlatformHeader(name) {
  const n = String(name || "").toLowerCase();
  return n.startsWith("x-gf-") || n === "x-site-preview";
}

/**
 * THE APP'S OWN HOSTS PASS THROUGH UNTOUCHED (2026-10-27, found live after
 * deploy 2281): the catch-all route on gofarther.dev's zone also catches
 * gofarther.dev and www, and build jobs call `https://gofarther.dev/api/job/…`
 * with `x-gf-*` headers the platform reads (conditional writes, replay
 * markers). Stripping them there would turn conditional writes into blind
 * ones. Only customer sites' hosts are cleaned.
 */
export const APP_HOSTS = new Set(["gofarther.dev", "www.gofarther.dev"]);
export function isAppHost(request) {
  try { return APP_HOSTS.has(new URL(request.url).hostname.toLowerCase()); } catch { return false; }
}

export function cleanRequest(request) {
  if (isAppHost(request)) return request;
  const h = new Headers(request.headers);
  for (const k of [...h.keys()]) if (isPlatformHeader(k)) h.delete(k);
  return new Request(request, { headers: h });
}

function mark(res) {
  const out = new Response(res.body, res);
  out.headers.set("x-served-by", SERVED_BY);
  return out;
}

// ── THE FRONT DOOR ROUTES SITES ITSELF (2026-10-28) ─────────────────────────
//
// The owner's rule: a site's visitors go to that site's own Worker, and our
// platform Worker is for building. So the door asks what an address is (the
// platform keeps the names, renames and custom domains, and answers
// `/__gf/route` with a slug, a redirect or "gone"), keeps that answer in the
// edge cache for a minute, and calls the site's Worker DIRECTLY through
// the dispatch namespace, with each site's limits. The app, draft previews and
// anything without a site of its own go to the platform as before.
export const ROUTE_TTL_S = 60;
export const SITE_CPU_MS = 300;
export const SITE_SUBREQUESTS = 50;
import { setPublishedSiteHeaders } from "../site-headers.mjs";
export const APP_ZONE = "gofarther.dev";

/** What an address is, from the edge cache or (once a minute) the platform. */
export async function routeFor(env, host, deps = {}) {
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== "undefined" ? caches.default : null);
  const key = new Request("https://route.gofarther.internal/" + encodeURIComponent(host));
  if (cache) {
    const hit = await cache.match(key).catch(() => null);
    if (hit) return hit.json();
  }
  let r;
  try {
    const res = await env.PLATFORM.fetch(new Request("https://" + APP_ZONE + "/__gf/route?host=" + encodeURIComponent(host)));
    r = res.ok ? await res.json() : { to: "platform" };
  } catch { return { to: "platform" }; }
  if (cache && r && !r.to) {
    const keep = Response.json(r, { headers: { "cache-control": "public, max-age=" + ROUTE_TTL_S } });
    await cache.put(key, keep).catch(() => {});
  }
  return r || { to: "platform" };
}

const plain = (body, status, extra = {}) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...extra } });

async function toPlatform(env, request) {
  try { return await env.PLATFORM.fetch(request); }
  catch { return plain("This site can't be reached right now.", 502); }
}

export async function handle(request, env, deps = {}) {
  if (!env || !env.PLATFORM) return plain("This site can't be reached right now.", 503, { "retry-after": "30" });
  if (isAppHost(request)) return toPlatform(env, request);
  const clean = cleanRequest(request);
  const url = new URL(clean.url);
  const route = env.SITES ? await routeFor(env, url.hostname.toLowerCase(), deps) : { to: "platform" };
  if (route.gone) return plain("This address is no longer in use.", 404, { "cache-control": "no-store" });
  if (route.redirect) return Response.redirect("https://" + route.redirect + url.pathname + url.search, 301);
  if (!route.slug) return toPlatform(env, clean);
  // THE SITE'S OWN WORKER, directly. A site with no script yet (building, or
  // the coming-soon page) is the platform's.
  let res;
  try {
    res = await env.SITES.get("site-" + route.slug, {}, { limits: { cpuMs: SITE_CPU_MS, subRequests: SITE_SUBREQUESTS } }).fetch(clean);
  } catch (e) {
    if (/not found/i.test(String((e && e.message) || e))) return toPlatform(env, clean);
    return plain("This site can't be reached right now.", 502);
  }
  const h = setPublishedSiteHeaders(new Headers(res.headers), APP_ZONE);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env) {
    return mark(await handle(request, env));
  },
};
