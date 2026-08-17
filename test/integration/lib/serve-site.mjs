// Serving a built site to a browser, the way production does.
//
// WHY THIS EXISTS. Four harnesses each stood up their own static server over the
// build's dist and answered `dist["index.html"]` for anything they did not have
// — the SPA fallback, which is exactly what the platform Worker used to do. Then
// TanStack Start removed the shell: `dist/client` contains no HTML at all,
// because the document is `__root.tsx` rendered per request. Every one of those
// four servers started answering "Not found" — nine characters — for every page
// of every site, and each one failed in a different workflow on a different day.
//
// Fixing them one at a time is what produced this file. The fact "where does a
// document come from" now has ONE copy, and `test/dockerfile.test.mjs` asserts
// no harness keeps a second.
//
// THE SPLIT IS THE SITE'S OWN RULE, not an approximation of it: a path with an
// extension is an asset, anything else is a route. `src/server.ts` decides it
// the same way, and they must agree — a request classified as a page here and an
// asset there is a page that renders in CI and 404s live.
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MIME = {
  js: "text/javascript", mjs: "text/javascript", css: "text/css",
  svg: "image/svg+xml", json: "application/json", txt: "text/plain",
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", ico: "image/x-icon",
  woff2: "font/woff2", woff: "font/woff", map: "application/json",
};

/**
 * Load the built server's `fetch` out of a sandbox.
 *
 * CACHE-BUSTED PER CALL, and that is not caution. A harness builds many sites in
 * one process — `family-apps` builds a hundred — so Node's module cache would
 * hand back the FIRST site's renderer for every one after it, and every
 * assertion from the second onward would be about somebody else's pages. The
 * container guards the same class with `resetRoutes`.
 *
 * NULL RATHER THAN A THROW: a bundle that will not load is a thing the caller
 * should report against its own site, not a crash in a helper.
 */
export async function loadSiteServer(sandbox) {
  try {
    const file = path.join(sandbox, "dist", "server", "server.js");
    const mod = await import(pathToFileURL(file).href + "?b=" + Date.now());
    const srv = mod && mod.default;
    if (!srv || typeof srv.fetch !== "function") return null;
    // `{}` as env: the entry skips its liveness probe when there is no bucket
    // binding, and serves assets from R2 only — which the caller does instead.
    return (request) => srv.fetch(request, {});
  } catch {
    return null;
  }
}

/** Is this a request for a file rather than a page? The site's own rule. */
export function isAsset(pathname) {
  const last = String(pathname || "").split("/").pop() || "";
  return last.includes(".");
}

/**
 * An http server that serves one built site.
 *
 * `assets` answers a dist-relative path with `{t}` or `{b}` (the build service's
 * own shape) or a Buffer, or null.
 *
 * `ssr` IS A GETTER, NOT A FETCH FUNCTION, and that is the contract rather than
 * a convenience. These harnesses stand the server up ONCE and then build many
 * sites through it, so a fetch captured at construction is the bundle that
 * existed before the first build — which is none, and every page answers "no
 * server bundle". Measured exactly that way: 9 chars became 31, which is that
 * sentence. Resolving per request is what keeps the server pointed at the site
 * currently under test.
 *
 * `mount` is the path prefix the site is served under, and defaults to `/` —
 * which is where a published site really is, since `cleanSlug` refuses an edge
 * hyphen and every site therefore has a pretty host. A harness that needs to
 * prove the workspace mount can pass one.
 *
 * `extra` runs first and may answer a request itself — a stubbed data API, say.
 * It is treated as having handled the request if it returns truthy OR if it
 * simply ENDED the response, and the second half is what makes it usable: these
 * stubs are long chains of `return send(res, …)` and `return pgError(res, …)`,
 * and requiring each to also answer `true` means editing dozens of call sites
 * with a regex — which is how a multi-line one gets missed. Asking the response
 * whether it was written cannot miss one.
 */
export function serveSite({ assets, ssr, mount = "", extra = null }) {
  const currentSsr = () => (typeof ssr === "function" ? ssr() : null);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (extra && ((await extra(req, res, url)) || res.writableEnded)) return;

      if (mount && !url.pathname.startsWith(mount)) { res.writeHead(404); return res.end("not found"); }
      const rel = url.pathname.slice(mount.length).replace(/^\/+/, "");

      if (isAsset(rel)) {
        const f = assets ? assets(rel) : null;
        if (!f) { res.writeHead(404); return res.end("not found"); }
        const ext = ((rel.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "").toLowerCase();
        res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
        return res.end(Buffer.isBuffer(f) ? f : f.t != null ? f.t : Buffer.from(f.b, "base64"));
      }

      // NO SHELL FALLBACK. This is the whole point: the document is rendered,
      // not looked up, so an address the site does not have gets the router's
      // own 404 rather than the home page's markup at the wrong URL.
      const fetchSite = currentSsr();
      if (!fetchSite) { res.writeHead(503); return res.end("no server bundle in the sandbox"); }
      const r = await fetchSite(new Request("http://127.0.0.1" + "/" + rel + url.search));
      const body = await r.text();
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "text/html; charset=utf-8" });
      return res.end(body);
    } catch (e) {
      // NAMED, never swallowed. A renderer that throws is exactly what these
      // harnesses exist to catch, and a bare 500 with no words reads as the
      // harness being broken rather than the site.
      res.writeHead(500);
      res.end("ssr threw: " + String((e && e.stack) || e).slice(0, 500));
    }
  });
}
