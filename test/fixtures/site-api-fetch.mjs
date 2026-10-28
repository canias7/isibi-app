// THE SITE'S OWN CONNECTION ROUTE AS THE PAGE'S FETCH (2026-10-28: the site's
// own Worker). A visitor's `/api/db/<slug>/api/<name>` is answered by the
// site's Worker (`siteApi` in the template's `lib/site-connect.ts`), with the
// owner's keys given to it as its own variables and the connection from the
// schema given at publish (`SITE_SPEC`); the platform only passes the call on.
// So the page's relative call goes to the REAL template handler, loaded for
// real, and the only stand-in is the third-party service: the same shape
// `platformFetch` in `site-render.mjs` gives `renderRouteSource`.
import { loadTemplate } from "./template-ts.mjs";

export async function siteApiFetch({ slug, api, secrets = {}, service, origin }) {
  const { siteApi } = await loadTemplate("lib/site-connect.ts");
  const upstream = [];
  const routed = [];
  const env = { SITE_SPEC: JSON.stringify({ tables: [], apis: [api] }), ...secrets };
  const base = origin || "https://" + slug + ".gofarther.app";
  const fetch_ = async (input, init) => {
    const raw = String(input && input.url ? input.url : input);
    if (raw.startsWith("/api/")) {
      routed.push(raw);
      const url = new URL(base + raw);
      const req = new Request(url, { method: (init && init.method) || "GET", headers: init && init.headers, body: init && init.body });
      const res = await siteApi(req, env, url, slug);
      return res || new Response(JSON.stringify({ error: "not this site's route" }), { status: 404 });
    }
    upstream.push(raw);
    return service ? service(raw, init) : new Response("{}", { headers: { "content-type": "application/json" } });
  };
  return { fetch: fetch_, upstream, routed };
}
