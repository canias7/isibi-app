// Taking a published site off the web, and putting it back.
//
// WHAT WAS THERE BEFORE: nothing. `public/chat.js` had an Unpublish button that
// POSTed `/api/site/unpublish`, a route with ZERO occurrences in `worker.js`, and
// on failure told the owner "couldn't take it offline just now — try again". So
// the site stayed up and they retried forever. Its neighbours in the same panel
// were no better — `/api/site/publish` and `/api/site/preview` are equally
// absent, and the publish button posted `p.html`, the D1-era HTML page format
// deleted on 2026-07-27.
//
// THE NEED IS REAL EVEN THOUGH THE PANEL WAS A RELIC. A refit, a seasonal
// closure, a site built before launch, a dispute with a customer — the only
// removal that worked was `DELETE /api/site/<slug>`, which drops the Neon
// database and every booking in it, permanently. Between "live" and "destroyed"
// there was nothing.
//
// GOING OFFLINE MUST NEVER BE A ONE-WAY DOOR, and that is the whole decision in
// this module. Wiping `sites/<slug>/` is cheap and instant; what makes it SAFE is
// that two independent ways back survive it — the version archive under
// `versions/<slug>/`, and the page source under `source/<slug>/`. If neither is
// there, this REFUSES rather than leaving somebody with a site that can only be
// recreated by paying for a fresh build that re-rolls all their copy.
//
// Plain module with its side effects injected, like `site-versions.mjs` beside
// it, so every decision here is tested with no R2, no container and no Worker.

/**
 * Which way back a site has, and therefore whether it may go offline at all.
 *
 * A VERSION IS PREFERRED OVER A RECOMPILE, and the difference is not speed. A
 * version is the exact bytes that were live — same hashed asset names, same
 * prerendered HTML. A recompile produces an equivalent site from the same
 * source, which is nearly always the same thing and is not guaranteed to be:
 * the container's toolchain moves. Restoring what was actually there beats
 * rebuilding something that should match it.
 */
export function wayBack({ versions, hasSource } = {}) {
  const list = Array.isArray(versions) ? versions.filter((v) => v && v.id) : [];
  if (list.length) return { how: "version", id: list[0].id };
  if (hasSource) return { how: "recompile" };
  return { how: null };
}

/**
 * Take the site off the web.
 *
 * `deps.versions({slug})` → the archive, newest first.
 * `deps.hasSource({slug})` → is the stored page source readable?
 * `deps.wipe({slug})`     → remove every object under the live prefix.
 *
 * REFUSES WITH NO WAY BACK. The alternative is a button that quietly turns a
 * reversible action into a permanent one, which is the shape of the bug this
 * module replaces rather than a new version of it.
 */
export async function takeOffline(deps, { slug } = {}) {
  if (!slug) return { ok: false, reason: "no-slug" };
  let versions = [], hasSource = false;
  try { versions = (await deps.versions({ slug })) || []; } catch { versions = []; }
  try { hasSource = !!(await deps.hasSource({ slug })); } catch { hasSource = false; }

  const back = wayBack({ versions, hasSource });
  if (!back.how) {
    return {
      ok: false, reason: "no-way-back",
      msg: "I can't take this one offline — there's no saved copy to put back, so it would be gone for good. " +
        "Make any change first and I'll have one.",
    };
  }
  let removed = 0;
  try { removed = (await deps.wipe({ slug })) || 0; }
  catch (e) { return { ok: false, reason: "wipe", error: e, msg: "Couldn't take it offline just now — your site is still up. Try again." }; }
  return {
    ok: true, live: false, removed, back: back.how,
    // WHAT SURVIVES IS THE HALF THEY ARE ANXIOUS ABOUT. Somebody taking their
    // shop's website down mid-refit wants to hear that the bookings are still
    // there before they hear how many files went.
    msg: "⏹ Taken offline — the link now returns Not Found. Your pages, bookings, members and settings are all still here; " +
      "say “put the site back online” whenever you're ready.",
  };
}

/**
 * Put it back at the same address.
 *
 * `deps.rollback({slug, id})`   → restore an archived version.
 * `deps.recompile({slug})`      → rebuild from the stored source and publish.
 *
 * NO MODEL CALL ON EITHER PATH, so coming back is free. A version restore is
 * also containerless; the recompile fallback costs container time and nothing
 * else, which is worth saying to somebody who is waiting.
 */
export async function putBackOnline(deps, { slug } = {}) {
  if (!slug) return { ok: false, reason: "no-slug" };
  let versions = [], hasSource = false;
  try { versions = (await deps.versions({ slug })) || []; } catch { versions = []; }
  try { hasSource = !!(await deps.hasSource({ slug })); } catch { hasSource = false; }

  const back = wayBack({ versions, hasSource });
  if (!back.how) {
    return { ok: false, reason: "no-way-back", msg: "There's no saved copy of this site to put back — tell me what to build and I'll make it again." };
  }
  if (back.how === "version") {
    let out = null;
    try { out = await deps.rollback({ slug, id: back.id }); } catch (e) { out = { ok: false, error: e }; }
    if (out && out.ok) return { ok: true, live: true, how: "version", files: out.files, msg: "✅ Back online at the same address." };
    // A VERSION THAT WILL NOT RESTORE FALLS THROUGH TO THE RECOMPILE rather than
    // failing. The archive is best-effort by design — an unreadable manifest is
    // exactly the case `listVersions` is written to skip — and the source is a
    // second, independent copy. Refusing here would strand a site over a
    // convenience path when the real one was available all along.
    if (!hasSource) return { ok: false, reason: "restore", msg: "Couldn't put it back just now — try again in a moment." };
  }
  let pub = null;
  try { pub = await deps.recompile({ slug }); } catch (e) { pub = { ok: false, error: e }; }
  if (!pub || !pub.ok) return { ok: false, reason: "recompile", msg: "Couldn't put it back just now — try again in a moment." };
  return { ok: true, live: true, how: "recompile", files: pub.files, msg: "✅ Back online at the same address." };
}
