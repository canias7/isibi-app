// A LIVE SITE'S OWN WORKER, AS FAR AS ITS FILES GO (2026-10-28: the site's own
// Worker). On the site's own address `/u/<slug>/<file>` is answered only by the
// site's Worker, from its bucket; the platform passes the call on. With own
// buckets off a site's bucket IS the shared one, so the stand-in serves the
// case's own store through the template's REAL `serveUpload` (loaded for real).
// Anything else the script is asked answers `page`, marked with the live
// version when one is given, as the cases' earlier stubs did.
import { loadTemplate } from "./template-ts.mjs";

export async function siteWorkersServingFiles(store, { version = "" } = {}) {
  const { serveUpload } = await loadTemplate("lib/site-files.ts");
  const dispatched = [];
  return {
    dispatched,
    get: (name) => ({
      fetch: async (req) => {
        const url = new URL(req.url);
        dispatched.push({ name, path: url.pathname });
        const m = /^site-(.+)$/.exec(String(name || ""));
        if (m && url.pathname.startsWith("/u/")) {
          const r = await serveUpload(req, { SITES: store, OWN_BUCKET: "1" }, url, m[1]);
          if (r) return r;
        }
        return new Response("page", { headers: version ? { "x-site-version": version } : {} });
      },
    }),
  };
}
