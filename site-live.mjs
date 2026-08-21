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
 * THE FILES ARE HALF A SITE. THE SCRIPT IS THE OTHER HALF.
 *
 * `rollbackVersion` RETURNS the archived script rather than uploading it — that
 * module is driveable with a fake store and no Cloudflare account, so the caller
 * owns the dispatch namespace — and its docstring states the contract in as many
 * words: "a version WITH a script needs it uploaded, and one WITHOUT needs
 * whatever is standing taken down". `/versions/restore` obeys it. This module
 * dropped `out.worker` on the floor.
 *
 * WHAT THAT COST, and why it is not cosmetic: `takeOffline` deliberately removes
 * the script BEFORE it wipes R2, because the script renders the document from its
 * own baked shell and would otherwise keep serving a fully rendered page over no
 * assets. So by the time anybody says "put it back" there is NO script standing —
 * and under Start there is no static path to fall back to either (`dist/client`
 * holds no HTML, measured). The platform's static branch finds nothing and
 * answers 404. Every address: the site's own hostname, `/s/<slug>/`, and any
 * custom domain. The response said `{ok:true, live:true, msg:"✅ Back online"}`.
 *
 * IT NEEDS TWO DEPS, NOT ONE, and the split is the contract rather than tidiness:
 * a version with a script and a version without need OPPOSITE actions, and the
 * decision is exactly the thing that was missing. `putWorker` for the first,
 * `dropWorker` for the second — each maps to one real function at the call site,
 * so neither can be half-wired without showing up here.
 *
 * A version with no script is a PRE-START archive: those carry real prerendered
 * documents, so the static path genuinely is where they belong, and leaving a
 * newer script over them would name assets the restore has just swept away.
 */
async function settleWorker(deps, { slug, code, build }) {
  const has = typeof code === "string" && !!code;
  const fn = has ? (deps && deps.putWorker) : (deps && deps.dropWorker);
  const how = has ? "upload" : "drop";
  // A CALLER THAT HAS NOT WIRED THIS CANNOT BE TOLD THE SITE IS LIVE. The
  // precedent one module over (`rollbackVersion`'s optional `sweep`) makes a
  // missing dep behave "exactly as before" — right there, because before was
  // correct. Here before was the bug, so the safe direction is the opposite:
  // report that the script half did not happen and let the caller fall through
  // to the recompile, which uploads one of its own.
  if (typeof fn !== "function") return { ok: false, how, reason: "no-dep" };
  let r = null;
  try { r = has ? await fn({ slug, code, build }) : await fn({ slug }); }
  catch (e) { return { ok: false, how, error: e }; }
  // `null` IS NOT A FAILURE — it is what both of these answer when the dispatch
  // namespace is not configured at all, which is a platform with no scripts
  // anywhere rather than this site's problem. Same reading as `/versions/restore`,
  // which treats only an explicit `ok === false` as a failure.
  if (r && r.ok === false) return { ok: false, how, status: r.status, error: r.error };
  // PAST TENSE ON SUCCESS, PRESENT ON A FAILURE — `uploaded`/`dropped` say what
  // happened, `upload`/`drop` say what was attempted. The caller puts one of
  // these on the response either way, and "dropped" on a refusal would read as a
  // script that was taken down when in fact nothing was.
  return { ok: true, how: has ? "uploaded" : "dropped" };
}

/**
 * Put it back at the same address.
 *
 * `deps.rollback({slug, id})`          → restore an archived version.
 * `deps.putWorker({slug, code, build})`→ upload that version's own script.
 * `deps.dropWorker({slug})`            → take down whatever script is standing.
 * `deps.recompile({slug})`             → rebuild from the stored source and publish.
 *
 * NO MODEL CALL ON ANY PATH, so coming back is free. A version restore is also
 * containerless; the recompile fallback costs container time and nothing else,
 * which is worth saying to somebody who is waiting.
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
    if (out && out.ok) {
      // AFTER THE FILES, ALWAYS. `rollbackVersion` has already copied them by
      // the time it returns, which is why the script rides on the RETURN rather
      // than being something a caller could sequence wrongly: a script uploaded
      // first serves a document naming assets that are not back yet.
      const w = await settleWorker(deps, { slug, code: out.worker, build: out.build });
      if (w.ok) {
        return {
          ok: true, live: true, how: "version", files: out.files,
          // WHICH OF THE TWO HAPPENED, because they are not the same site.
          // "uploaded" is the archived script serving again; "dropped" is a
          // pre-Start version back on the static path it belongs to. A boolean
          // cannot tell those apart, and the owner has no other signal.
          worker: w.how,
          msg: "✅ Back online at the same address.",
        };
      }
      // THE FILES ARE BACK AND THE SITE IS NOT SERVING, which is the one outcome
      // this route must never report as success. The recompile below publishes
      // its own script, so it is a real recovery rather than a retry of the same
      // failure — and with no source there is nothing left to try.
      if (!hasSource) {
        return {
          ok: false, reason: "worker", worker: w.how,
          msg: "Your pages are back but the site isn't serving them yet — I couldn't put its script up. Try again in a moment.",
        };
      }
    // A VERSION THAT WILL NOT RESTORE FALLS THROUGH TO THE RECOMPILE rather than
    // failing. The archive is best-effort by design — an unreadable manifest is
    // exactly the case `listVersions` is written to skip — and the source is a
    // second, independent copy. Refusing whenever the convenience path fails
    // would strand a site while the real way back was available all along. So
    // this refuses ONLY when there is nothing left to fall through to.
    } else if (!hasSource) {
      return { ok: false, reason: "restore", msg: "Couldn't put it back just now — try again in a moment." };
    }
  }
  let pub = null;
  try { pub = await deps.recompile({ slug }); } catch (e) { pub = { ok: false, error: e }; }
  if (!pub || !pub.ok) return { ok: false, reason: "recompile", msg: "Couldn't put it back just now — try again in a moment." };
  // THE SAME HALF-SITE ON THE OTHER BRANCH. `recompileAndPublish` uploads the
  // script itself and reports `worker.uploaded === false` ONLY when the upload
  // really failed (nothing to upload answers `null` and says nothing) — so this
  // is the recompile's version of exactly the defect above, and reading `pub.ok`
  // alone would call a 404 site live for the same reason.
  if (pub.worker && pub.worker.uploaded === false) {
    return {
      ok: false, reason: "worker", worker: "upload", files: pub.files,
      msg: "Your pages are back but the site isn't serving them yet — I couldn't put its script up. Try again in a moment.",
    };
  }
  return { ok: true, live: true, how: "recompile", files: pub.files, msg: "✅ Back online at the same address." };
}
