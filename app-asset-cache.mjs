// HOW THE APP'S OWN SCRIPTS AND STYLESHEETS ARE CACHED (2026-11-02, owner:
// "do it, but do it carefully").
//
// Before this, every file under public/ was served `max-age=0,
// must-revalidate`: a returning visitor asked again for each of the ten scripts
// and two stylesheets on every visit (a 304 each, but a round trip each).
//
// THE SCHEME. The app shell's HTML names each local script and stylesheet with
// the deploy's id appended (`/chat.js?v=<12 hex of DEPLOY_ID>`). A request
// carrying exactly the CURRENT id is answered `immutable` for a year; anything
// else (no `v`, an old `v`, a Worker with no DEPLOY_ID) is answered exactly as
// before. A deploy changes DEPLOY_ID, so the next HTML names new URLs, which no
// browser has cached.
//
// WHY THE ID MUST MATCH, not merely be present: during a rollout an old Worker
// version can answer a request the new HTML made. It then serves its own (old)
// bytes under the new URL, and if it called that immutable the browser would
// keep the old file under the new name for a year. Matching means only the
// version whose id is in the URL ever promises the bytes.
//
// WHY THE HTML'S ETAG IS REWRITTEN: the HTML stays revalidated, but its ETag
// comes from the file's bytes, which a deploy that changes only chat.js leaves
// untouched. A browser would get a 304 and keep the old HTML naming the old
// `v`, still immutable in its cache, and run the old code for good. The ETag
// is therefore the deploy id plus the file's own, so a new deploy never 304s.

export const IMMUTABLE = "public, max-age=31536000, immutable";

// The deploy id as the URL carries it, or "" when there is none (a hand
// `wrangler deploy`, a local run). "" turns the whole scheme off.
export function assetVersion(env) {
  const v = env && typeof env.DEPLOY_ID === "string" ? env.DEPLOY_ID.trim() : "";
  return /^[0-9a-f]{7,64}$/i.test(v) ? v.slice(0, 12).toLowerCase() : "";
}

const LOCAL_SCRIPT = /(<script\b[^>]*?\ssrc=")(\/(?!\/)[^"?#]+\.js)(")/gi;
const LOCAL_STYLE = /(<link\b[^>]*?\shref=")(\/(?!\/)[^"?#]+\.css)(")/gi;

// Appends `?v=<v>` to every same-origin, root-relative script src and
// stylesheet href that has no query yet. Nothing else in the page moves.
export function versionHtml(html, v) {
  if (!v) return html;
  return html
    .replace(LOCAL_SCRIPT, (_, a, p, b) => a + p + "?v=" + v + b)
    .replace(LOCAL_STYLE, (_, a, p, b) => a + p + "?v=" + v + b);
}

function etagMatches(header, etag) {
  if (!header) return false;
  const bare = (t) => t.trim().replace(/^W\//, "");
  return header.split(",").some((t) => t.trim() === "*" || bare(t) === bare(etag));
}

// `res` is what env.ASSETS answered for `request`. Returns it unchanged unless
// it is (a) a versioned .js/.css whose `v` is this deploy's, which gains the
// long cache, or (b) a 200 HTML page outside /mkt/ (the vendored demos keep
// their own hashed names), which is versioned as above.
export async function versionAppAsset(request, env, res) {
  const v = assetVersion(env);
  if (!v || !res || request.method !== "GET") return res;
  let url;
  try { url = new URL(request.url); } catch { return res; }
  if (res.status !== 200) return res;
  if (/\.(?:js|css)$/i.test(url.pathname)) {
    if (url.searchParams.get("v") !== v) return res;
    const h = new Headers(res.headers);
    h.set("cache-control", IMMUTABLE);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }
  const type = res.headers.get("content-type") || "";
  if (!/^text\/html/i.test(type) || url.pathname.startsWith("/mkt/")) return res;
  const html = versionHtml(await res.text(), v);
  const h = new Headers(res.headers);
  h.delete("content-length");
  const own = (res.headers.get("etag") || "").replace(/^W\//, "").replace(/"/g, "");
  const etag = `W/"${v}-${own}"`;
  h.set("etag", etag);
  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    h.delete("content-type");
    return new Response(null, { status: 304, headers: h });
  }
  return new Response(html, { status: 200, statusText: res.statusText, headers: h });
}
