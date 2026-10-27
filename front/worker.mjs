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
// database.

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

export default {
  async fetch(request, env) {
    if (!env || !env.PLATFORM) return mark(new Response("This site can't be reached right now.", { status: 503, headers: { "retry-after": "30", "content-type": "text/plain; charset=utf-8" } }));
    let res;
    try { res = await env.PLATFORM.fetch(cleanRequest(request)); }
    catch { return mark(new Response("This site can't be reached right now.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } })); }
    return mark(res);
  },
};
