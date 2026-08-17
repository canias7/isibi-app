// Published versions of a site, and rolling one back.
//
// A publish used to be destructive in both directions: it wiped the prefix and
// wrote the new dist over it, so the previous build was gone the moment the new
// one landed. The workspace offered a "Restore" button anyway — which only ever
// rewrote localStorage and could not touch the published files, because there
// was nothing to restore them FROM. Two lies stacked: a control that did
// nothing, over a store that kept nothing.
//
// So versions are real objects now. Every publish copies the dist it just wrote
// to `versions/<slug>/<id>/`, and a rollback copies one back over `sites/<slug>/`
// through the same write-then-sweep path a publish uses. The live site is never
// half-written in either direction.
//
// WHY A COPY AND NOT A POINTER. Serving `/s/<slug>/` from a version prefix would
// be cheaper — one metadata write instead of ~20 object copies — and it puts a
// lookup on the visitor path, which is the thing `site-routing.mjs` exists to
// remove. The published prefix stays the one place a visitor's request resolves
// to, and versioning is entirely an owner-side concern.
//
// Injected deps like the rest of the site-* modules, so all of this is tested
// with no R2 and no Worker.

/** How many builds a site keeps. Past this the oldest is dropped on publish. */
export const MAX_VERSIONS = 10;

/** Anything longer is a caller inventing labels, not a build describing itself. */
const MAX_LABEL = 80;

const P_SITE = (slug) => "sites/" + String(slug).toLowerCase() + "/";
const P_VERS = (slug) => "versions/" + String(slug).toLowerCase() + "/";

/**
 * A version id that sorts chronologically as a STRING.
 *
 * R2 lists lexicographically and nothing else records the order, so the id has
 * to carry it: zero-padded millis, then a short random tail. The tail is not
 * decoration — two publishes inside the same millisecond would otherwise be one
 * id, and the second would silently overwrite the first.
 *
 * `now` and `rand` are injected because the module must stay pure: a test that
 * cannot fix the clock cannot assert ordering at all.
 */
export function versionId(now, rand) {
  const ms = Math.max(0, Math.floor(Number(now) || 0));
  const tail = String(rand == null ? "" : rand).replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  return String(ms).padStart(14, "0") + "-" + (tail || "000000");
}

/**
 * The name a build wears in the Versions list.
 *
 * Labelled with the BRAND, every row read "Sharp Fade Barbers" and the only
 * thing telling three builds apart was the timestamp — which makes the list
 * nearly useless for the one question it is opened to answer: which of these do
 * I want back. A revise is named by the change the customer asked for, in their
 * own words.
 *
 * One line and one clause: an instruction can be a paragraph, and a paragraph
 * in a list row is a row nobody reads. Never empty — an unlabelled row is
 * indistinguishable from a broken one.
 */
export function versionLabel({ revise, changeNote, brand } = {}) {
  const said = String(changeNote == null ? "" : changeNote).replace(/\s+/g, " ").trim();
  if (revise && said) {
    const one = said.split(/(?<=[.!?])\s/)[0] || said;
    return one.length > 60 ? one.slice(0, 57).trimEnd() + "\u2026" : one;
  }
  if (revise) return "Revised";
  const b = String(brand == null ? "" : brand).replace(/\s+/g, " ").trim();
  return b ? "Built " + b.slice(0, 54) : "First build";
}

/** Only ids we mint. A caller-supplied key must never be able to address anything else. */
export function isVersionId(id) {
  return /^[0-9]{14}-[a-z0-9]{1,6}$/.test(String(id || ""));
}

/**
 * deps:
 *   list(prefix)                    → [{key, size, uploaded?}]
 *   copy(fromKey, toKey)            → void
 *   remove(key)                     → void
 *   put(key, text, contentType)     → void   (metadata only)
 *   read(key)                       → string | null
 */

/** Where a version keeps the script that serves it. Not a published file — it
 *  lives under `versions/`, which nothing serves, so it can never be fetched. */
const WORKER_FILE = "_worker.js";

/**
 * Archive the dist that was just published, and prune the oldest beyond the cap.
 *
 * THE SCRIPT IS PART OF THE VERSION, and under TanStack Start it is the part
 * that MATTERS. Measured on a real build: the server bundle bakes in that
 * build's own content-hashed client asset names (`index-Cn8EPcR-.js` and
 * friends, one occurrence each), and `dist/client` contains no HTML at all — so
 * a document exists only because a script renders it, and only THAT build's
 * script can name THAT build's assets.
 *
 * WITHOUT THIS A ROLLBACK COULD NOT WORK EITHER WAY. Restore the files and keep
 * the standing script and its document names assets that are gone: a blank page.
 * Restore them and drop the script — which is what the route did, on the stated
 * reasoning that dropping it "puts the site back on the static path" — and there
 * is no static path any more, so the site 404s at its own front door. That
 * reasoning was exactly true while a published site was documents plus a bundle
 * and became false the day the document started being rendered.
 *
 * A VERSION WITH NO SCRIPT IS STILL RESTORABLE, and must be: every version
 * archived before this carries real prerendered documents, so the static path is
 * genuinely what it should go back to. `worker` on the manifest is what tells
 * the two apart, and its absence means the old behaviour, unchanged.
 *
 * BEST-EFFORT BY CONSTRUCTION, and the caller must treat it that way: the site
 * is already live by the time this runs, so a failed archive costs a rollback
 * point and nothing else. Failing a publish that succeeded would be trading a
 * real site for a bookkeeping entry.
 */
export async function archiveVersion(deps, { slug, id, label, files, worker } = {}) {
  if (!isVersionId(id)) return { ok: false, error: "bad version id" };
  const names = (Array.isArray(files) ? files : []).filter((f) => typeof f === "string" && f);
  if (!names.length) return { ok: false, error: "nothing to archive" };
  const dest = P_VERS(slug) + id + "/";
  for (const rel of names) await deps.copy(P_SITE(slug) + rel, dest + rel);

  // THE SCRIPT FIRST, THEN THE MANIFEST THAT CLAIMS IT. The manifest's `worker`
  // flag is what a rollback trusts, and a flag set over a write that failed is a
  // version that reports itself restorable and restores a site with no document
  // — strictly worse than one that honestly says it has no script, because that
  // one still falls back to the static path.
  let hasWorker = false;
  if (typeof worker === "string" && worker) {
    try { await deps.put(dest + WORKER_FILE, worker, "application/javascript"); hasWorker = true; }
    catch (e) { hasWorker = false; }
  }

  // The manifest is what makes a version restorable: R2 has no way to ask "which
  // objects belonged to this build", and a rollback that guessed from a prefix
  // listing would resurrect anything that had ever been copied in beside them.
  await deps.put(dest + "_manifest.json", JSON.stringify({
    id, at: Number(String(id).slice(0, 14)) || 0,
    label: String(label || "Build").slice(0, MAX_LABEL),
    files: names,
    ...(hasWorker ? { worker: true } : {}),
  }), "application/json");
  const pruned = await pruneVersions(deps, { slug });
  return { ok: true, id, files: names.length, worker: hasWorker, pruned };
}

/** Newest first. Reads manifests only — the object bodies are never touched. */
export async function listVersions(deps, { slug } = {}) {
  const prefix = P_VERS(slug);
  const objs = await deps.list(prefix);
  const ids = new Set();
  for (const o of objs || []) {
    const rest = String((o && o.key) || "").slice(prefix.length);
    const id = rest.split("/")[0];
    if (isVersionId(id)) ids.add(id);
  }
  const out = [];
  for (const id of ids) {
    let m = null;
    try { m = JSON.parse(await deps.read(prefix + id + "/_manifest.json")); } catch { m = null; }
    // A version with no readable manifest is not offered. Restoring one would
    // mean guessing its file list, and a wrong guess publishes a mixture of two
    // builds — which is worse than the version simply not being there.
    if (m && Array.isArray(m.files) && m.files.length) {
      out.push({ id, at: Number(m.at) || 0, label: String(m.label || "Build").slice(0, MAX_LABEL), files: m.files.length });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? 1 : -1));
}

/**
 * Put a saved version back on the live prefix.
 *
 * SAME WRITE-THEN-SWEEP AS A PUBLISH, and for the same reason: copy every file
 * of the version in first, then remove what the live prefix has that the version
 * does not. EVERY DOCUMENT is copied LAST — not just `index.html` — so a visitor
 * never sees a pointer to a bundle that is not fully there yet.
 *
 * It was `index.html` alone, which was the whole truth exactly while a site was
 * one HTML file plus a bundle. Each route is prerendered to its own document
 * now, and those have stable names, so `book.html` copied before the assets it
 * names is a blank page at a public URL for the length of the restore. Same
 * one-file sort, same fix, as the publish path this mirrors.
 *
 * AND THE SCRIPT COMES BACK WITH THEM — see `archiveVersion` for why it has to.
 * It is returned rather than uploaded here, because this module's whole point is
 * that it can be driven with a fake store and no Cloudflare account; the caller
 * owns the dispatch namespace. `worker` is the code when the version has one and
 * `null` when it does not, and the caller must read the two differently: a
 * version WITH a script needs it uploaded, and one WITHOUT needs whatever is
 * standing taken down, which is what puts a pre-Start version back on the
 * static path it really belongs to.
 *
 * AFTER THE FILES, always. The script serves this site's assets out of R2 and
 * its document names them, so uploading it before they are copied in means every
 * stylesheet and bundle 404s for as long as the copies take — the same ordering
 * argument as `putSiteWorker`, and the reason `worker` rides on the RETURN rather
 * than being something the caller could sequence wrongly.
 */
export async function rollbackVersion(deps, { slug, id } = {}) {
  if (!isVersionId(id)) return { ok: false, error: "no such version", status: 404 };
  const src = P_VERS(slug) + id + "/";
  let manifest = null;
  try { manifest = JSON.parse(await deps.read(src + "_manifest.json")); } catch { manifest = null; }
  const names = (manifest && Array.isArray(manifest.files) ? manifest.files : []).filter(Boolean);
  if (!names.length) return { ok: false, error: "no such version", status: 404 };

  // READ BEFORE ANYTHING IS COPIED. A version that claims a script and cannot
  // produce one must not half-restore: the files would already be back, the
  // standing script would still name the previous build's assets, and the site
  // would be blank with the customer told it was restored. Refusing here leaves
  // them the site they had.
  let worker = null;
  if (manifest && manifest.worker === true) {
    try { worker = await deps.read(src + WORKER_FILE); } catch { worker = null; }
    if (typeof worker !== "string" || !worker) {
      return { ok: false, error: "that version's script is missing, so it cannot be put back", status: 409 };
    }
  }

  const ordered = names.slice().sort((a, b) =>
    (/\.html$/i.test(a) ? 1 : 0) - (/\.html$/i.test(b) ? 1 : 0));
  for (const rel of ordered) await deps.copy(src + rel, P_SITE(slug) + rel);

  const keep = new Set(names);

  // THE SAME ONE-PUBLISH GRACE THE ORDINARY PUBLISH GETS, when the caller wires
  // it. A rollback IS a publish — it writes a full dist and orphans whatever the
  // build it replaced was using — so sweeping immediately here reopens exactly
  // the in-session 404 `sweepAfterPublish` closes, on the one action somebody
  // takes when their site is already visibly wrong.
  //
  // AND IT IS THE CASE THAT MAKES THE SWEEP'S SAFETY RULE LOAD-BEARING: a
  // rollback republishes an OLD build, so keys the previous publish marked as
  // orphaned are live again. "Never delete what this publish just wrote" is what
  // stops the marker deleting the site it has just restored.
  //
  // Injected rather than imported so this module stays driveable with nothing but
  // a fake store, and OPTIONAL so a caller that has not wired it behaves exactly
  // as this did before — which is what keeps the fallback below honest rather
  // than dead.
  if (typeof deps.sweep === "function") {
    const s = await deps.sweep({ slug, wrote: keep });
    return { ok: true, id, files: names.length, worker, swept: (s && s.removed) || 0, deferred: (s && s.deferred) || 0 };
  }

  let swept = 0;
  for (const o of (await deps.list(P_SITE(slug))) || []) {
    const rel = String((o && o.key) || "").slice(P_SITE(slug).length);
    if (!rel || keep.has(rel)) continue;
    await deps.remove(o.key); swept++;
  }
  return { ok: true, id, files: names.length, worker, swept };
}

/** Drop the oldest versions past the cap. Whole prefixes, manifest included. */
export async function pruneVersions(deps, { slug, cap = MAX_VERSIONS } = {}) {
  // A CAP THAT MAKES NO SENSE KEEPS MORE, NEVER FEWER. `Math.max(1, …)` on a
  // raw number reads -1 as "keep one" and deletes almost the whole archive —
  // pruning HARDER than the default, which is the one direction a nonsense
  // value must never take. Deleting too little costs storage; deleting too much
  // destroys the only record that a build ever existed. Same fail-safe
  // direction as the retention default in `site-audit.mjs`.
  const want = Math.floor(Number(cap));
  const lim = Number.isFinite(want) && want >= 1 ? want : MAX_VERSIONS;
  const prefix = P_VERS(slug);
  const objs = (await deps.list(prefix)) || [];
  const ids = [...new Set(objs.map((o) => String((o && o.key) || "").slice(prefix.length).split("/")[0])
    .filter(isVersionId))].sort();
  const doomed = ids.slice(0, Math.max(0, ids.length - lim));
  if (!doomed.length) return 0;
  const dead = new Set(doomed);
  let n = 0;
  for (const o of objs) {
    const id = String((o && o.key) || "").slice(prefix.length).split("/")[0];
    if (dead.has(id)) { await deps.remove(o.key); n++; }
  }
  return doomed.length;
}

/**
 * Every version object of a site, for the delete path.
 *
 * Deleting a site has to take its archive with it, or the storage outlives the
 * thing it belonged to — the same leak `neon_teardown` exists to stop, one
 * resource over. Returned as a count so the delete response can say so.
 */
export async function deleteAllVersions(deps, { slug } = {}) {
  let n = 0;
  for (const o of (await deps.list(P_VERS(slug))) || []) { await deps.remove(o.key); n++; }
  return n;
}
