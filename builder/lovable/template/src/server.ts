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
import { SITE_SLUG } from "./site-brand";
import { setSiteMeta, type SiteMeta } from "./site-runtime";

// `createStartHandler` RETURNS THE FETCH FUNCTION, not an object carrying one.
// Start's own generated entry reads `createServerEntry({ fetch: createStartHandler(…) })`.
const startFetch = createStartHandler(defaultStreamHandler);

// DECLARED STRUCTURALLY RATHER THAN IMPORTED. The alternative is
// `@cloudflare/workers-types`, a dependency in every published site's tree for
// one interface — and this is the whole surface used: a get, and what an object
// answers. A narrower type is also a better one here, because it says exactly
// what the entry is allowed to do with the bucket.
type SiteObject = { body: ReadableStream | null; text(): Promise<string>; writeHttpMetadata(h: Headers): void };
type Env = { SITES?: { get(key: string): Promise<SiteObject | null> } };

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
let loaded = false;

async function loadMeta(env: Env): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
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
    // sustained outage — the isolate recycles soon enough.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ASSETS STAY ON R2, and this is a cost decision rather than a detail.
    // Putting a JavaScript bundle or a stylesheet through compute is paying per
    // request for what a CDN does for nothing, on the files requested most.
    // Only the document is rendered.
    if (isAsset(url.pathname)) {
      const obj = env.SITES && (await env.SITES.get("sites/" + SITE_SLUG + url.pathname));
      if (!obj) return new Response("Not found", { status: 404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      // TRUE BY CONSTRUCTION rather than optimistic: vite content-hashes every
      // emitted asset name, so a file at this address can never change.
      h.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(obj.body, { headers: h });
    }

    await loadMeta(env);
    return startFetch(request);
  },
};
