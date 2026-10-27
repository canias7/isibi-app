// Re-scoping the session cookie a site's auth server sets.
//
// Neon's managed Better Auth is COOKIE-based — measured 2026-08-04 by asking it
// what it sends, after two fixes built on vendor documentation turned out to
// describe a deployment with the bearer plugin enabled, which this is not.
// Sign-in answers with `set-cookie` and nothing else.
//
// The cookie cannot be passed through untouched, for two separate reasons:
//
//   `Domain` names the AUTH SERVER'S host. Arriving from gofarther.dev, a browser
//   refuses a cookie for a domain it is not on — so the session would be dropped
//   silently and every later call would look signed out.
//
//   `Path` is the security one. Every published site is served from ONE origin,
//   so a cookie at `Path=/` is sent to every other site on gofarther.dev: one barber
//   shop's customer session travelling to a stranger's site, by construction.
//   Pinned to `/api/db/<slug>/` it reaches that slug's auth and data calls and
//   nothing else.
//
// Everything else — HttpOnly, Secure, SameSite, Max-Age, Expires — is left
// exactly as the auth server set it. Those are its decisions about its own
// credential, and rewriting them would be this proxy overruling the thing that
// owns the session.

/** Attributes we replace rather than pass through. */
const DROP = new Set(["domain", "path"]);

/**
 * @param {string|null} setCookie the auth server's `Set-Cookie`, or null
 * @param {string} path the prefix this cookie may be sent to
 * @returns {string|null} the rewritten header, or null if there was nothing
 */
export function rescopeCookie(setCookie, path) {
  if (!setCookie || typeof setCookie !== "string") return null;
  const parts = setCookie.split(";");
  const pair = parts[0].trim();
  // No `name=value` means nothing worth setting; passing it on would put a
  // malformed cookie in front of a browser for no gain.
  if (!pair || pair.indexOf("=") < 1) return null;
  const kept = [pair];
  for (const raw of parts.slice(1)) {
    const attr = raw.trim();
    if (!attr) continue;
    const name = attr.split("=")[0].trim().toLowerCase();
    if (DROP.has(name)) continue;
    kept.push(attr);
  }
  // Path last so it cannot be shadowed by one that was already there — the
  // filter above removes those, and this belt-and-braces makes the scoping
  // impossible to lose by editing the loop.
  kept.push("Path=" + path);
  return kept.join("; ");
}
