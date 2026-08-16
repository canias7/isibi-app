// A PUBLISHED SITE, AS A WORKER. One of these per site, uploaded into a
// Workers-for-Platforms dispatch namespace and reached by the platform Worker.
//
// WHY THIS EXISTS AT ALL. A published site was static files on R2: an empty
// `<div id="root">` plus a bundle, with `prerender()` filling that div in at
// BUILD time so a link preview and a crawler see a real page. That step is
// best-effort by design, and on 2026-08-16 it produced nothing on a real
// build — the child was killed by SIGTERM 4.4s in, wrote nothing to either
// stream, and the site published blank to anything that does not run
// JavaScript. Nothing failed. Rendering at REQUEST time removes the step and
// therefore the failure: there is no build-time artefact left to be missing.
//
// NOT TANSTACK START, and the reason is worth keeping. Start is the obvious
// answer and it is a framework migration; `entry-server.tsx` has exported
// `render(pathname) => html` since the prerender shipped, so the template
// ALREADY server-renders and has done on every build. What was missing was
// somewhere to run it per request, which is this file. The generator, the
// component kit, the routes and the template are untouched.
//
// A WORKER CANNOT LOAD CODE AT RUNTIME — no eval, no dynamic import of
// anything not bundled at upload. So "one Worker that renders whichever site
// was asked for" is impossible, and that is what forces a script per site and
// therefore the dispatch namespace. Stated because it is the first design
// somebody reaches for and the runtime refuses it, not our architecture.
// EXTENSIONLESS, so vite resolves `entry-server.tsx` — the SOURCE — and the
// whole Worker is one build pass. Pointing at the already-built SSR output
// instead would need two passes and would make the Worker's contents depend on
// which of them ran last.
import { render } from "./entry-server";
import { SHELL, SLUG, ROUTES } from "./site-config.js";

// THE SHELL IS BAKED IN, NOT FETCHED. It is byte-identical for every request
// to this site, so reading it from R2 would put a round trip in front of every
// page view to learn something known at upload time.
const SLOT = '<div id="root">';

/**
 * Where the rendered markup goes, computed once per isolate rather than per
 * request. A shell with no root div is a template we did not build and there
 * is nothing to inject into — `null`, and the caller serves it untouched
 * rather than guessing.
 */
const SPLIT = (() => {
  const at = SHELL.indexOf(SLOT);
  if (at < 0) return null;
  const close = SHELL.indexOf("</div>", at);
  if (close < 0) return null;
  return { open: SHELL.slice(0, at + SLOT.length), close: SHELL.slice(close) };
})();

/**
 * Is this a request for a file rather than a page?
 *
 * The same rule the platform Worker's SPA fallback already uses: a path with
 * an extension is an asset, anything else is a route. Kept as a predicate
 * because the two must agree — a request classified as a page here and as an
 * asset there is a page that 404s on one mount and renders on the other.
 */
export function isAsset(pathname) {
  const last = String(pathname || "").split("/").pop() || "";
  return last.includes(".");
}

/**
 * Whether this path is one of the site's own routes.
 *
 * A site with no route list has no opinion — it renders everything, which is
 * what every site published before the manifest existed does. That is the
 * SAFE direction: being wrong here means a real page 404s, and a 404 on a
 * working page is worse than a 200 on a missing one.
 */
export function isKnownRoute(pathname) {
  if (!Array.isArray(ROUTES) || !ROUTES.length) return true;
  const p = String(pathname || "/").replace(/\/+$/, "") || "/";
  return ROUTES.includes(p);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ASSETS STAY ON R2, and this is a cost decision rather than a detail.
    // Putting a JavaScript bundle or a stylesheet through compute is paying
    // per request for something a CDN does for nothing, on the files that are
    // requested most. Only the document is rendered.
    if (isAsset(url.pathname)) {
      const key = "sites/" + SLUG + url.pathname;
      const obj = env.SITES && (await env.SITES.get(key));
      if (!obj) return new Response("Not found", { status: 404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      h.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(obj.body, { headers: h });
    }

    // A RENDER FAILURE MUST NEVER BE AN OUTAGE, and this matters far more here
    // than it did at build time. A prerender that failed cost a snapshot; a
    // render that fails now is a visitor looking at the site. So anything that
    // goes wrong falls back to the shell — the empty div plus the bundle,
    // which is exactly what every site served before this existed. The page
    // still works, it is merely blank to a crawler for that request.
    let body = "";
    try {
      if (SPLIT) body = await render(url.pathname);
    } catch (e) {
      console.error("render failed:", SLUG, url.pathname, String((e && e.message) || e));
    }

    const html = SPLIT ? SPLIT.open + body + SPLIT.close : SHELL;

    // 404 IS A STATUS, NOT A PAGE. The router draws its own not-found
    // component either way, so the body is unchanged — what changes is that a
    // crawler is told the address is not real. Serving 200 for every typo is
    // the soft-404 that made a deleted page's old link look alive.
    const status = isKnownRoute(url.pathname) ? 200 : 404;

    return new Response(html, {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // NOT `immutable`, and not long. The document is now produced per
        // request precisely so it can change when the owner edits their site;
        // caching it for a year would undo the whole point of moving here.
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  },
};
