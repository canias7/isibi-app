// THE APP'S PAGE (2026-11-05: gofarther.dev is now only Coder): public/ served
// by Coder's own Worker. Any path that is not a file gets the page.
// The page's safety headers: scripts only from here, calls only to here and to
// sign-in (Supabase), fonts from Google, never inside another site's frame.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://ujrqdmmtcptvimazlhom.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
export function withPageHeaders(res) {
  const out = new Response(res.body, res);
  out.headers.set("content-security-policy", CSP);
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  out.headers.set("x-frame-options", "DENY");
  out.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return out;
}

/** The page or one of its files, with the safety headers. */
export async function servePage(request, env) {
  let res = await env.ASSETS.fetch(request);
  if (res.status === 404) res = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
  return withPageHeaders(res);
}
