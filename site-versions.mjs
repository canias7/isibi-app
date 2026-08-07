// Undo for a published site.
//
// THE GAP THIS FILLS. The builder's loop is describe → build → REVISE, and until
// now a revise was irreversible: `writeSiteDistToR2` wipes the published prefix
// before writing, so the previous build was destroyed with nothing kept
// anywhere. An owner says "add a gallery", the regenerated pages come back worse
// — which is a real outcome, since page generation is ONE model call with no
// repair pass — and the site they were happy with is gone. That is the worst
// property a build tool can have, and it is why the Versions panel has been dead.
//
// ONE PREVIOUS BUILD, AND IT IS A SWAP RATHER THAN A COPY. Two reasons. A single
// version is what an owner reaches for ("put it back the way it was") and an
// unbounded history is storage that grows on every revise forever, on files that
// are already the largest thing we keep per site. And swapping means the undo
// itself can be undone — somebody who rolls back and realises the new one WAS
// better has not been punished for looking.
//
// Deliberately a separate TOP-LEVEL prefix, not `sites/<slug>-prev/`. The wipe
// lists `sites/<slug>/` and a neighbouring key differing by one character is the
// kind of thing that survives review and then deletes the backup the first time
// somebody makes the prefix match looser.

export const LIVE = (slug) => "sites/" + slug + "/";
export const PREV = (slug) => "prev/" + slug + "/";

/**
 * Everything under a prefix, as {key, rel} — `rel` being the path within the
 * site, which is what makes a copy between prefixes a rename rather than a
 * parse. Follows the cursor and stops when it is absent as well as when the page
 * is not truncated, the same way `deleteSitePrefix` does: a truncated page with
 * no cursor would otherwise re-request forever.
 */
export async function listUnder(deps, prefix) {
  const out = [];
  let cursor;
  for (;;) {
    const page = await deps.list({ prefix, cursor });
    for (const o of (page.objects || [])) out.push({ key: o.key, rel: o.key.slice(prefix.length) });
    if (!page.truncated || !page.cursor) return out;
    cursor = page.cursor;
  }
}

/**
 * Move every object from one prefix to another, replacing whatever was there.
 *
 * R2 has no server-side copy for this, so it is read-then-write per object. A
 * built site is a handful of files (an index, a bundle, a stylesheet), so the
 * cost is small and bounded by `max` — which exists so a pathological dist
 * cannot turn one publish into thousands of operations.
 *
 * THE CONTENT TYPE TRAVELS WITH THE BYTES. Losing it would serve the bundle as
 * application/octet-stream and the browser would refuse to execute it: the site
 * would come back looking blank, which reads as "the rollback destroyed my site"
 * rather than "a header went missing".
 */
export async function movePrefix(deps, from, to, { max = 200 } = {}) {
  const src = await listUnder(deps, from);
  if (!src.length) return { moved: 0, cleared: 0, overflow: 0 };

  // The destination is cleared FIRST. Copying over the top would leave any file
  // the new build does not have — a page deleted by a revise — sitting there and
  // still being served, which is how a rollback produces a site that is neither
  // version.
  const stale = await listUnder(deps, to);
  for (const o of stale) await deps.delete(o.key);

  let moved = 0;
  for (const o of src.slice(0, max)) {
    const got = await deps.get(o.key);
    if (!got) continue;
    await deps.put(to + o.rel, got.body, { httpMetadata: got.httpMetadata });
    // WRITE THEN DELETE, never the other way round. Interrupted between the two
    // the object exists twice, which the next move cleans up; interrupted the
    // other way it exists nowhere. R2 has no rename, so this pair IS the move —
    // and leaving the delete out (as the first version of this did) makes it a
    // copy, which the swap in `rollback` then spreads across three prefixes.
    await deps.delete(o.key);
    moved++;
  }
  return { moved, cleared: stale.length, overflow: Math.max(0, src.length - max) };
}

/**
 * Keep the current build as the undo point, just before it is overwritten.
 *
 * Returns `{kept:0}` on a first build rather than failing: there is nothing to
 * keep, which is a normal state and not an error. NEVER THROWS — this runs
 * inside publishing, and a site must not fail to go live because its safety net
 * could not be written. The caller reports what happened.
 */
export async function snapshot(deps, slug) {
  try {
    const r = await movePrefix(deps, LIVE(slug), PREV(slug));
    return { kept: r.moved, overflow: r.overflow };
  } catch (e) {
    return { kept: 0, error: String((e && e.message) || e).slice(0, 200) };
  }
}

/**
 * Put the previous build back, and keep the current one so the undo is
 * reversible.
 *
 * Ordered so that a failure loses nothing: the live copy is parked in a third
 * place before anything is overwritten, and only then does the previous build
 * become live. Done as two moves in the other order, a crash between them leaves
 * the site with no live copy at all.
 */
export async function rollback(deps, slug) {
  const prev = await listUnder(deps, PREV(slug));
  // Not an error, and the caller says so to the owner: a site built once has
  // nothing to go back to, which is most sites most of the time.
  if (!prev.length) return { ok: false, reason: "no previous build" };

  const HOLD = "swap/" + slug + "/";
  const parked = await movePrefix(deps, LIVE(slug), HOLD);
  const restored = await movePrefix(deps, PREV(slug), LIVE(slug));
  const swapped = await movePrefix(deps, HOLD, PREV(slug));
  return { ok: true, restored: restored.moved, kept: parked.moved, swapped: swapped.moved };
}
