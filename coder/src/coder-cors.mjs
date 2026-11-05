// WHICH PAGE MAY CALL CODER FROM THE BROWSER (2026-11-05): only the builder's own.
/** The browser may call this Worker only from the builder's own page. */
export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.APP_ORIGIN || "https://gofarther.dev");
  if (origin !== allowed) return {};
  return { "access-control-allow-origin": allowed, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-max-age": "600", vary: "Origin" };
}

