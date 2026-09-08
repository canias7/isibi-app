// IS THIS SITE OFF THE WEB — the server's own answer, not the browser's.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// "Take it offline" / "Put it back online" worked on the server and the ONLY
// record of which state a site was in lived in `localStorage`, written by
// `siteSetLive` in the browser that pressed the button. So a site taken off the
// web on a laptop read as live on a phone, and the panel showed the wrong one of
// its two faces there. Giving that panel a Cloud card (2026-09-08) made the gap
// reachable rather than theoretical, and the owner's answer was "fix the offline
// flag on the server too".
//
// ── A TIMESTAMP, NOT A BOOLEAN, AND THE REASON IS THE CONTAINER ─────────────
//
// `takeOffline` records nothing today: it drops the site's Worker script and
// wipes `sites/<slug>/`, and "offline" is simply the absence of anything
// serving. It does NOT touch `source/`, `builds/` or the pointer — measured —
// so an ordinary edit afterwards recompiles, activates and uploads a script,
// and the site is live again WITHOUT `putBackOnline` ever running.
//
// A boolean would therefore have to be cleared by every path that republishes.
// Most of those now run INSIDE the site's container, where Supabase is reached
// through the job gateway, whose table allowlist admits no PATCH at all — so
// the clear would be refused on exactly the common path, and closing that would
// mean widening a security wall to keep a convenience field honest.
//
// A TIMESTAMP needs no such write. `offline_at` records the moment of the
// switch, and a site is off the web only while nothing has been published
// SINCE — which the reader below decides by comparing it with the site's own
// latest build, a fact `/api/site/list` already reads for its "last touched"
// date. The flag ages out of the way on its own; nothing has to remember to
// clear it, and no wall moves.
//
// ── AND CANNOT-TELL IS ITS OWN ANSWER ──────────────────────────────────────
//
// `null` means we do not know, and it is NEVER folded into `false`. The build
// read is enrichment and is allowed to fail (the route keeps its list standing
// when it does), and without it a set `offline_at` cannot be judged stale or
// current. Reading that as "online" would tell somebody their site is up when
// it may be down — on the one field whose whole job is to say which.

/** Spelled ONCE, across the migration, the two writes and the read. */
export const OFFLINE_COLUMN = "offline_at";

/** A timestamp as milliseconds, or 0 for anything unusable. Never coerced. */
export function offlineStamp(v) {
  if (typeof v !== "string" || !v) return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Is the site off the web?
 *
 * `offAt`   — the row's `offline_at`, or null/absent if it was never switched.
 * `builtAt` — the site's latest build time, or `undefined` when it COULD NOT BE
 *             READ (which is different from a site that has never built, 0).
 *
 * Answers `true`, `false`, or `null` for "cannot tell". A site with no
 * `offline_at` is online without needing the build read at all — that is every
 * site on the platform today, so the unknown answer is rare by construction.
 */
export function siteOffline(offAt, builtAt) {
  const off = offlineStamp(offAt);
  // NEVER SWITCHED IS ONLINE, and it needs no second fact to say so.
  if (!off) return false;
  // Switched, but we could not read what has happened since.
  if (builtAt === undefined || builtAt === null) return null;
  const built = typeof builtAt === "number" && Number.isFinite(builtAt) ? builtAt : 0;
  // A PUBLISH AFTER THE SWITCH PUT IT BACK UP. Strictly after: a build stamped
  // in the same millisecond as the switch is the publish the switch replaced,
  // and reading that as "back online" would answer live for a site that was
  // just taken down.
  return !(built > off);
}
