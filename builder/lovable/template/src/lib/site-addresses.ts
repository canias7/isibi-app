// THIS SITE'S OWN ADDRESSES (2026-10-27): robots.txt and sitemap.xml with this
// address's own origin, an old page's 301 to where it went, and the document's
// `./` asset links made absolute for the address it was served at. The rules are
// the platform's own (`./effects/site-seo.mjs`, `./effects/site-domains.mjs`,
// copied byte for byte); the platform no longer has to do any of it.
import { substituteOrigin, manifestFromCsv, decideFallback } from "./effects/site-seo.mjs";
import { mountRootFor, absolutizeAssets, isAppHostname } from "./effects/site-domains.mjs";

type Obj = { text(): Promise<string> };
export type AddressEnv = { SITES?: { get(k: string): Promise<Obj | null> } };
const own = { "x-site-data": "own" };

/** robots.txt and sitemap.xml, on the site's own hosts. The workspace address keeps the platform's. */
export async function siteSeoFile(request: Request, env: AddressEnv, url: URL, prefixes: (string | null)[]): Promise<Response | null> {
  const p = url.pathname.toLowerCase();
  if (p !== "/robots.txt" && p !== "/sitemap.xml") return null;
  if (!env.SITES || isAppHostname(url.hostname) || (request.method !== "GET" && request.method !== "HEAD")) return null;
  for (const pre of prefixes) {
    if (!pre) continue;
    const obj = await env.SITES.get(pre + p);
    if (!obj) continue;
    const ctype = p === "/robots.txt" ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8";
    return new Response(substituteOrigin(await obj.text(), url.origin), {
      headers: { ...own, "content-type": ctype, "cache-control": "public, max-age=60", "x-content-type-options": "nosniff" },
    });
  }
  return null;
}

/** A moved or deleted page's 301, read off the site's own live head; null for anything else. */
export async function siteRedirect(env: AddressEnv, url: URL, slug: string): Promise<Response | null> {
  try {
    const last = url.pathname.split("/").pop() || "";
    if (/\.[a-z0-9]{1,8}$/i.test(last) || !env.SITES) return null;
    const obj = await env.SITES.get("sitemeta/" + slug + ".json");
    if (!obj) return null;
    const side = JSON.parse(await obj.text()) as { held?: string; routesCsv?: string; redirectsCsv?: string };
    if (!side || side.held === "absent") return null;
    const verdict = decideFallback(manifestFromCsv(side.routesCsv, side.redirectsCsv), url.pathname);
    if (verdict.kind !== "redirect") return null;
    const mount = isAppHostname(url.hostname) ? "/s/" + slug : "";
    return new Response(null, { status: 301, headers: { ...own, location: url.origin + mount + verdict.to + url.search, "cache-control": "public, max-age=600" } });
  } catch { return null; }
}

/** The document, its `./` links absolute for the address it was served at. */
export async function absolutized(res: Response, url: URL, slug: string): Promise<Response> {
  if (!/text\/html/i.test(res.headers.get("content-type") || "")) return res;
  const h = new Headers(res.headers);
  h.set("x-site-data", "own");
  h.delete("content-length");
  return new Response(absolutizeAssets(await res.text(), mountRootFor(url.hostname, slug)), { status: res.status, headers: h });
}
