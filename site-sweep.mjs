/**
 * WHAT A PUBLISH IS ALLOWED TO DELETE, AND WHEN.
 *
 * `writeSiteDistToR2` writes the new build and then sweeps everything under
 * `sites/<slug>/` that it did not write. Write-then-sweep was itself a fix: the
 * old order wiped the prefix first, so for the length of ~20 R2 puts the site was
 * half-deleted and a visitor clicking through to a code-split route fetched a
 * chunk that had been removed and not yet rewritten.
 *
 * IT FIXED THAT FOR NEW VISITORS AND NOT FOR IN-SESSION ONES, which is the gap
 * this module closes. A generated site is code-split one chunk per route, and the
 * names are content-hashed — so a visitor who had the site OPEN when it was
 * republished still holds the OLD document, and clicking to a route they have not
 * visited asks for a chunk name that no longer exists. A hard 404 mid-session, on
 * every republish: every revise, every text fix, every colour change, every
 * picture swap. The publish docstring's "atomic from a visitor's side" was true
 * of the arriving visitor and of nobody already there.
 *
 * THE FIX IS ONE PUBLISH OF GRACE, and the honest way to do it is a marker
 * OUTSIDE the served prefix recording what the last publish decided to orphan.
 * This publish deletes what the last one marked, and marks what this one
 * orphaned. So a chunk survives until the publish after the one that replaced it.
 *
 * SELF-HEALING, WHICH IS THE PROPERTY THAT MAKES IT SAFE TO DEPLOY. The deferred
 * list is recomputed from a LIVE listing every time, never carried forward from
 * the marker — so a marker that could not be read, or was never written, costs
 * one round of deleting and nothing else. An orphan is still an orphan next
 * publish. The failure mode is delayed cleanup, never a leak and never a loss.
 *
 * THE ONE DANGEROUS FAILURE IS DELETING SOMETHING LIVE, and it has exactly one
 * guard: a key this publish just wrote is never removed, whatever the marker
 * says. That is not hypothetical — `rollbackVersion` republishes an OLD build, so
 * keys the previous publish marked as orphaned are live again, by design.
 *
 * A plain module with no bindings: the Worker supplies list/read/write/remove, so
 * every decision here is driven in a unit test with a fake R2.
 */

/** The marker, deliberately NOT under `sites/<slug>/` — that prefix is public. */
export const P_ORPHANS = (slug) => "orphans/" + String(slug) + ".json";

/**
 * How many keys a marker may carry.
 *
 * A dist is ~20-40 files, so this is roughly ten builds of slack. Overflow is
 * deleted NOW rather than written: a marker that grows without bound is a worse
 * failure than one rare in-session 404, and reaching this at all means something
 * upstream is wrong.
 */
export const MAX_DEFER = 400;

/**
 * Split the stale keys into "delete now" and "keep one more publish".
 *
 * Pure, and every input is a plain list of RELATIVE keys (no `sites/<slug>/`
 * prefix), so the caller owns the prefix in exactly one place.
 */
export function sweepPlan({ wrote, live, marked, cap = MAX_DEFER } = {}) {
  const kept = wrote instanceof Set ? wrote : new Set(Array.isArray(wrote) ? wrote : []);
  const present = new Set((Array.isArray(live) ? live : []).map(String).filter(Boolean));
  // A marker we could not read is NOT an empty marker in any meaningful sense —
  // both mean "delete nothing this round" — but they are kept apart so the caller
  // can say which happened rather than reporting a clean sweep either way.
  const prev = Array.isArray(marked) ? marked.map(String).filter(Boolean) : [];

  // DELETE: marked last time, still there, and not written again by this publish.
  // The last clause is the whole safety property, and a rollback is what makes it
  // load-bearing rather than defensive.
  const remove = [...new Set(prev)].filter((k) => present.has(k) && !kept.has(k));
  const doomed = new Set(remove);

  // DEFER: everything else that is stale. Recomputed from the live listing, never
  // taken from the marker, which is what makes a lost marker cost one round.
  let defer = [...present].filter((k) => !kept.has(k) && !doomed.has(k));

  // Over the cap, the ASSETS are the ones worth keeping: the in-session 404 is a
  // code-split chunk being fetched by a page that is already open, and everything
  // else under here has a stable name and was overwritten rather than orphaned.
  let overflow = [];
  const lim = Number.isFinite(cap) && cap >= 0 ? Math.floor(cap) : MAX_DEFER;
  if (defer.length > lim) {
    const ranked = defer.slice().sort((a, b) => (/^assets\//i.test(b) ? 1 : 0) - (/^assets\//i.test(a) ? 1 : 0));
    overflow = ranked.slice(lim);
    defer = ranked.slice(0, lim);
  }
  return { remove: remove.concat(overflow), defer, deferred: defer.length, overflow: overflow.length };
}

/**
 * Run one publish's sweep: read the marker, delete what it named, mark what is
 * stale now.
 *
 * BEST-EFFORT TO THE BONE. The build has already succeeded and the site is
 * already published by the time this runs, so nothing here may throw past it —
 * a failed sweep costs storage, a throw would cost the response. Every step is
 * fenced separately, because a marker that cannot be READ must not stop the
 * marker being WRITTEN: that combination is what would turn one bad round into a
 * permanent stall.
 */
export async function sweepAfterPublish(deps, { slug, wrote, cap = MAX_DEFER } = {}) {
  const prefix = "sites/" + String(slug) + "/";
  let live = [];
  try {
    live = ((await deps.list(prefix)) || []).map((o) => String((o && o.key) || "").slice(prefix.length)).filter(Boolean);
  } catch (e) {
    // AN UNREADABLE LISTING DELETES NOTHING AND MARKS NOTHING. Marking an empty
    // list here would tell the NEXT publish there is nothing to clean up, which
    // is the one way a lost round could become a permanent leak.
    return { ok: false, error: "list failed: " + ((e && e.message) || e), removed: 0, deferred: 0 };
  }

  let marked = null;
  try {
    const raw = await deps.read(P_ORPHANS(slug));
    const j = raw ? JSON.parse(raw) : null;
    if (j && Array.isArray(j.keys)) marked = j.keys;
  } catch (e) { console.error("orphan marker unreadable:", slug, e && e.message); }

  const plan = sweepPlan({ wrote, live, marked, cap });

  let removed = 0;
  for (const rel of plan.remove) {
    try { await deps.remove(prefix + rel); removed++; } catch (e) { console.error("sweep delete failed:", slug, rel, e && e.message); }
  }

  let markedOk = true;
  try {
    // WRITTEN EVEN WHEN EMPTY, so a site that has settled clears its own marker
    // rather than leaving the last list to be re-deleted (harmlessly, but the
    // next round's `remove` would name keys that no longer exist and the count
    // would read as work that did not happen).
    await deps.write(P_ORPHANS(slug), JSON.stringify({ at: deps.now ? deps.now() : null, keys: plan.defer }));
  } catch (e) { markedOk = false; console.error("orphan marker write failed:", slug, e && e.message); }

  return { ok: true, removed, deferred: plan.deferred, overflow: plan.overflow, hadMarker: marked !== null, markedOk };
}
