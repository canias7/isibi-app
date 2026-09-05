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
type Env = { SITES?: { get(key: string): Promise<SiteObject | null>; head(key: string): Promise<unknown> } };

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
  async fetch(request: Request, env: Env): Promise<Response> {
    return stamp(await site.fetch(request, env));
  },
};

const site = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ASSETS STAY ON R2, and this is a cost decision rather than a detail.
    // Putting a JavaScript bundle or a stylesheet through compute is paying per
    // request for what a CDN does for nothing, on the files requested most.
    // Only the document is rendered.
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
    if (env.SITES) {
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

    await loadMeta(env);
    return startFetch(request);
  },
};
