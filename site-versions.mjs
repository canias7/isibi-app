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

/**
 * Archive the dist that was just published, and prune the oldest beyond the cap.
 *
 * BEST-EFFORT BY CONSTRUCTION, and the caller must treat it that way: the site
 * is already live by the time this runs, so a failed archive costs a rollback
 * point and nothing else. Failing a publish that succeeded would be trading a
 * real site for a bookkeeping entry.
 */
export async function archiveVersion(deps, { slug, id, label, files } = {}) {
  if (!isVersionId(id)) return { ok: false, error: "bad version id" };
  const names = (Array.isArray(files) ? files : []).filter((f) => typeof f === "string" && f);
  if (!names.length) return { ok: false, error: "nothing to archive" };
  const dest = P_VERS(slug) + id + "/";
  for (const rel of names) await deps.copy(P_SITE(slug) + rel, dest + rel);
  // The manifest is what makes a version restorable: R2 has no way to ask "which
  // objects belonged to this build", and a rollback that guessed from a prefix
  // listing would resurrect anything that had ever been copied in beside them.
  await deps.put(dest + "_manifest.json", JSON.stringify({
    id, at: Number(String(id).slice(0, 14)) || 0,
    label: String(label || "Build").slice(0, MAX_LABEL),
    files: names,
  }), "application/json");
  const pruned = await pruneVersions(deps, { slug });
  return { ok: true, id, files: names.length, pruned };
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
 * does not. `index.html` is copied LAST so a visitor never sees a pointer to a
 * bundle that is not fully there yet.
 */
export async function rollbackVersion(deps, { slug, id } = {}) {
  if (!isVersionId(id)) return { ok: false, error: "no such version", status: 404 };
  const src = P_VERS(slug) + id + "/";
  let manifest = null;
  try { manifest = JSON.parse(await deps.read(src + "_manifest.json")); } catch { manifest = null; }
  const names = (manifest && Array.isArray(manifest.files) ? manifest.files : []).filter(Boolean);
  if (!names.length) return { ok: false, error: "no such version", status: 404 };

  const ordered = names.slice().sort((a, b) =>
    (/^index\.html$/i.test(a) ? 1 : 0) - (/^index\.html$/i.test(b) ? 1 : 0));
  for (const rel of ordered) await deps.copy(src + rel, P_SITE(slug) + rel);

  const keep = new Set(names);
  let swept = 0;
  for (const o of (await deps.list(P_SITE(slug))) || []) {
    const rel = String((o && o.key) || "").slice(P_SITE(slug).length);
    if (!rel || keep.has(rel)) continue;
    await deps.remove(o.key); swept++;
  }
  return { ok: true, id, files: names.length, swept };
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
