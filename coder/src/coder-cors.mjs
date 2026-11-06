// WHICH PAGE MAY CALL CODER FROM ANOTHER ADDRESS (2026-11-05): only gofarther.dev.
// The sign-in proof travels next to the token (x-coder-proof, the audit, 2026-11-06).
/** The browser may call this Worker only from gofarther.dev. */
export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.APP_ORIGIN || "https://gofarther.dev");
  if (origin !== allowed) return {};
  return { "access-control-allow-origin": allowed, "access-control-allow-headers": "authorization, content-type, x-coder-proof", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS", "access-control-max-age": "600", vary: "Origin" };
}

