// IMMUTABLE PUBLISHING (stage 7 of the architecture plan, owner 2026-09-05:
// "ok go").
//
// A publish used to be a write over the ONE live prefix: `sites/<slug>/` was
// the assets, the marker and the served files at once, every publish wrote its
// dist over the previous build's and swept what it did not write, the script
// in the dispatch namespace named THAT prefix, and a rollback copied an old
// dist back over the same keys. Two writers to one address, and everything
// that went wrong under it was a window: a script uploaded ahead of its files
// 404ing every stylesheet, a visitor mid-session asking for a chunk the sweep
// had just removed, a rollback half-copied, a publish that died between the
// files and the script.
//
// NOW EVERY BUILD HAS ITS OWN PREFIX, WRITTEN ONCE AND NEVER CHANGED:
//
//   builds/<slug>/<version>/client/…            the dist (assets, sitemap, robots, card)
//   builds/<slug>/<version>/server.js           the script module, when packaged
//   builds/<slug>/<version>/state/pages.json    the page source that produced it
//   builds/<slug>/<version>/state/parts.json    the site's own components
//   builds/<slug>/<version>/state/config.json   the look, css, logo, icon, translations
//   builds/<slug>/<version>/state/sidecar.json  the publish-time head at that version
//   builds/<slug>/<version>/manifest.json       written LAST — a prefix with one is whole
//   current/<slug>.json                         THE ONE MUTABLE OBJECT: {version, build, parent, job, activatedAt}
//
// The script bakes `SITE_VERSION` and reads ITS OWN prefix (`src/server.ts`),
// so uploading it can never point a live document at assets that are not
// there: the files are staged before the gate, the pointer moves, then the
// script goes up, and the OLD script keeps serving its own prefix until the
// new one is live. A rollback is the same activation with an older version.
//
// THE POINTER LIVES OUTSIDE THE SERVED PREFIX — `current/<slug>.json`, not the
// plan's `sites/<slug>/current.json` — for the reason the sidecar and the
// orphan marker do: `sites/<slug>/` is served verbatim by every script built
// before this (a `/current.json` would be fetchable) and it is the prefix the
// legacy sweep wipes. One key, one reader, never served.
//
// WHAT IS FROZEN. A script built before this has no `SITE_VERSION` and reads
// `sites/<slug>/` for ever, so that prefix is never written or swept by a
// version-aware publish: it stays as it was until the site's next publish
// uploads a version-aware script — whose first fallback hop is exactly that
// prefix, so a visitor holding the old document still finds the old chunks.
//
// ONE FALLBACK HOP, BAKED. `SITE_PARENT` is the pointer's version when the
// build started; a request the new prefix cannot answer is tried once against
// the parent's (or `sites/<slug>/` when there is none) and then 404s. That is
// the in-session grace `site-sweep.mjs` gave by deferring deletes one publish,
// expressed as a read instead of a delayed delete — and pruning keeps the
// pointer's version and its parent for the same reason.
//
// Injected deps like `site-versions.mjs`, so every decision here is driven
// with a fake store and no Worker:
//
//   put(key, body, contentType, onlyIf?) → the stored object ({etag}) or NULL when
//                                          `onlyIf` did not hold (R2's own contract)
//   get(key)                             → { text(), etag } | null
//   list(prefix)                         → [{ key }]
//   remove(key)                          → void
//   mime(rel)                            → the content type for a published file
import { versionId, isVersionId, MAX_VERSIONS } from "./site-versions.mjs";

export { isVersionId };

/** The build prefixes of one site. Lower-cased like every key builder here. */
export const P_BUILDS = (slug) => "builds/" + String(slug || "").toLowerCase() + "/";
/** One build's prefix. */
export const buildPrefix = (slug, version) => P_BUILDS(slug) + String(version) + "/";
/** The one mutable object: which build is live. */
export const POINTER_KEY = (slug) => "current/" + String(slug || "").toLowerCase() + ".json";

export const CLIENT_DIR = "client/";
export const SERVER_FILE = "server.js";
export const STATE_DIR = "state/";
export const MANIFEST_FILE = "manifest.json";

/**
 * The config fields a build BAKES, and therefore the ones a version's state
 * carries and a rollback restores. `verify` (the owner's Search Console tag)
 * and `share` (their chosen card) are settings made against the SITE, not
 * inputs to a build — restoring a version must not take them back.
 */
export const STATE_CONFIG_FIELDS = ["look", "css", "logo", "icon", "langStrings"];

/** A version id, minted BEFORE the compile so the container can bake it. */
export function mintVersion(now = Date.now(), rand = Math.random().toString(36).slice(2)) {
  return versionId(now, rand);
}

/** The same rule `writeSiteDistToR2` applied to a dist entry's name. */
export const safeRel = (rel) => String(rel).replace(/[^a-z0-9/._-]/gi, "-");

/** Only the baked fields of a config, as the text a state snapshot stores. */
export function stateConfigOf(config) {
  const out = {};
  const c = config && typeof config === "object" ? config : {};
  for (const f of STATE_CONFIG_FIELDS) if (c[f] !== undefined && c[f] !== null) out[f] = c[f];
  return out;
}

function bodyOf(v) {
  if (v && typeof v.t === "string") return v.t;
  if (v && typeof v.b === "string") {
    const bin = atob(v.b); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  return null;
}

/**
 * Stage one build under its own prefix. EVERYTHING HERE IS ADDITIVE: nothing
 * live is read or changed, so a caller may abandon a staged build at any
 * point (a gate that refuses, a job that dies) and the site is exactly as it
 * was. The manifest is written LAST, so a prefix that has one is complete and
 * one that does not is a build that never finished staging — `listBuilds`
 * offers only the first kind.
 *
 * `files` is the dist as the container returned it (rel → {t|b}); the client
 * files land under `client/`, the script under `server.js`, the state under
 * `state/`. Throws on a failed write: staging runs before the gate, and a
 * publish whose build could not be staged has nothing to activate.
 */
export async function stageBuild(deps, { slug, version, files, worker, state, manifest } = {}) {
  if (!isVersionId(version)) return { ok: false, error: "bad version id" };
  if (!slug) return { ok: false, error: "no slug" };
  const dest = buildPrefix(slug, version);
  const names = [];
  for (const [rel, v] of Object.entries(files || {})) {
    const body = bodyOf(v);
    if (body == null) continue;
    const safe = safeRel(rel);
    await deps.put(dest + CLIENT_DIR + safe, body, deps.mime ? deps.mime(safe) : "application/octet-stream");
    names.push(safe);
  }
  if (!names.length) return { ok: false, error: "nothing to stage" };
  let hasWorker = false;
  if (worker && typeof worker.code === "string" && worker.code) {
    await deps.put(dest + SERVER_FILE, worker.code, "application/javascript");
    hasWorker = true;
  }
  const st = state || {};
  const stateWrites = [
    ["pages.json", st.pages], ["parts.json", st.parts], ["config.json", st.config], ["sidecar.json", st.sidecar],
  ];
  for (const [name, text] of stateWrites) {
    if (typeof text !== "string") continue;
    await deps.put(dest + STATE_DIR + name, text, "application/json");
  }
  const m = manifest || {};
  await deps.put(dest + MANIFEST_FILE, JSON.stringify({
    version, kind: "build",
    build: typeof (worker && worker.build) === "string" ? worker.build : (typeof m.build === "string" ? m.build : ""),
    parent: typeof m.parent === "string" ? m.parent : "",
    job: typeof m.job === "string" ? m.job : null,
    label: String(m.label || "Build").slice(0, 80),
    langs: Array.isArray(m.langs) ? m.langs : [],
    routes: Array.isArray(m.routes) ? m.routes : [],
    files: names,
    worker: hasWorker,
    at: Number(String(version).slice(0, 14)) || 0,
    created: typeof m.created === "string" ? m.created : new Date(Number(String(version).slice(0, 14)) || 0).toISOString(),
  }), "application/json");
  return { ok: true, version, files: names.length, worker: hasWorker };
}

/**
 * Which build is live, or null when the site has never published under this
 * layout. Carries the object's etag, which is what activation's conditional
 * write is keyed on. A pointer that cannot be parsed THROWS — a caller on the
 * serve path catches and falls back; a caller about to activate must not
 * guess at what it is replacing.
 */
export async function readPointer(deps, slug) {
  const o = await deps.get(POINTER_KEY(slug));
  if (!o) return null;
  const p = JSON.parse(await o.text());
  if (!p || !isVersionId(p.version)) throw new Error("pointer unreadable");
  return {
    version: p.version, build: typeof p.build === "string" ? p.build : "",
    parent: isVersionId(p.parent) ? p.parent : "", job: typeof p.job === "string" ? p.job : null,
    activatedAt: typeof p.activatedAt === "string" ? p.activatedAt : "",
    etag: String(o.etag || ""),
  };
}

/**
 * Make a staged build the live one.
 *
 * THE ORDER IS THE WHOLE SAFETY ARGUMENT, and every step reads the one before:
 *
 *   1. the POINTER, conditionally — `onlyIf` on the etag the caller read
 *      immediately after its gate was granted, so a holder that lost its lease
 *      and stalled cannot move the pointer once anyone else has. A condition
 *      that fails answers `superseded` and touches nothing else.
 *   2. the SIDECAR, before the script: a site script reads its head once per
 *      isolate, so a new isolate of the new script must find the new routes,
 *      redirects and description already there.
 *   3. the LIVE MARKER at its old address, where every script — old and new —
 *      probes for it.
 *   4. the SCRIPT, through the caller's uploader. The old script keeps serving
 *      its own prefix until this lands; a failed upload leaves the pointer
 *      ahead of the live script, which is the state stage 3b's reconcile
 *      reads (pointer names the job's version, live is older: retry is safe).
 *   5. the caller's COMMIT (`edit_committed`), only after the script is up.
 *   6. the caller's STATE COPY into the editable locations, best-effort: the
 *      site is live by now, and a failed copy costs the next edit its anchor
 *      rather than the customer their site — the standing rule for every
 *      write after the commit point.
 */
export async function activateBuild(deps, {
  slug, version, build = "", parent = "", job = null, expectEtag, sidecar, sidecarKey, liveKey,
  putWorker, commit, afterActivate, now,
} = {}) {
  if (!isVersionId(version)) return { ok: false, error: "bad version id" };
  const at = typeof now === "string" ? now : new Date().toISOString();
  const pointer = { version, build: String(build || ""), parent: isVersionId(parent) ? parent : "", job: job || null, activatedAt: at };
  const onlyIf = typeof expectEtag === "string" && expectEtag ? { etagMatches: expectEtag } : undefined;
  const moved = await deps.put(POINTER_KEY(slug), JSON.stringify(pointer), "application/json", onlyIf);
  if (moved === null) return { ok: false, error: "superseded" };
  if (typeof sidecar === "string" && sidecarKey) {
    try { await deps.put(sidecarKey, sidecar, "application/json"); }
    catch (e) { if (deps.log) deps.log("sidecar write failed", slug, e && e.message); }
  }
  if (liveKey) {
    try { await deps.put(liveKey, "1", "text/plain"); }
    catch (e) { if (deps.log) deps.log("live marker write failed", slug, e && e.message); }
  }
  let worker = null;
  if (typeof putWorker === "function") worker = await putWorker();
  const uploaded = !(worker && worker.ok === false);
  if (uploaded && typeof commit === "function") await commit();
  if (typeof afterActivate === "function") {
    try { await afterActivate(); }
    catch (e) { if (deps.log) deps.log("state copy failed", slug, e && e.message); }
  }
  return { ok: true, version, pointer, worker, uploaded };
}

/** Every complete build of a site, newest first. Reads manifests only. */
export async function listBuilds(deps, slug) {
  const prefix = P_BUILDS(slug);
  const objs = (await deps.list(prefix)) || [];
  const ids = new Set();
  for (const o of objs) {
    const id = String((o && o.key) || "").slice(prefix.length).split("/")[0];
    if (isVersionId(id)) ids.add(id);
  }
  const out = [];
  for (const id of ids) {
    let m = null;
    try { const o = await deps.get(prefix + id + "/" + MANIFEST_FILE); m = o ? JSON.parse(await o.text()) : null; } catch { m = null; }
    // A prefix with no readable manifest never finished staging — or lost the
    // one file that says which of its objects belong to it. Not offered.
    if (!m || !Array.isArray(m.files) || !m.files.length) continue;
    out.push({
      id, at: Number(m.at) || 0, label: String(m.label || "Build").slice(0, 80), files: m.files.length,
      build: typeof m.build === "string" ? m.build : "", parent: isVersionId(m.parent) ? m.parent : "",
      // WHICH JOB STAGED IT (stage 3b): the reconcile finds a job's own version
      // by this, so a row that never recorded its build id is still decidable.
      job: typeof m.job === "string" ? m.job : null,
      layout: "build",
      // The script is what renders a document; a build staged without one can
      // still be listed, and a restore of it says so rather than serving nothing.
      ...(m.worker === true ? {} : { restorable: false }),
    });
  }
  return out.sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** Everything a restore needs, read off the prefix. Null when there is no such build. */
export async function readBuild(deps, slug, version) {
  if (!isVersionId(version)) return null;
  const dest = buildPrefix(slug, version);
  const text = async (key) => { const o = await deps.get(key); return o ? await o.text() : null; };
  let manifest = null;
  try { const t = await text(dest + MANIFEST_FILE); manifest = t ? JSON.parse(t) : null; } catch { manifest = null; }
  if (!manifest || !Array.isArray(manifest.files) || !manifest.files.length) return null;
  return {
    manifest,
    worker: manifest.worker === true ? await text(dest + SERVER_FILE) : null,
    pages: await text(dest + STATE_DIR + "pages.json"),
    parts: await text(dest + STATE_DIR + "parts.json"),
    config: await text(dest + STATE_DIR + "config.json"),
    sidecar: await text(dest + STATE_DIR + "sidecar.json"),
  };
}

/**
 * Drop the oldest builds past the cap — whole prefixes — and NEVER one in
 * `keep`: the pointer's version and its parent, which is what a session on
 * the previous build still asks for. The cap counts kept builds too, so a
 * nonsense cap keeps more, never fewer (the `pruneVersions` rule).
 */
export async function pruneBuilds(deps, { slug, keep = [], cap = MAX_VERSIONS } = {}) {
  const want = Math.floor(Number(cap));
  const lim = Number.isFinite(want) && want >= 1 ? want : MAX_VERSIONS;
  const prefix = P_BUILDS(slug);
  const objs = (await deps.list(prefix)) || [];
  const ids = [...new Set(objs.map((o) => String((o && o.key) || "").slice(prefix.length).split("/")[0]).filter(isVersionId))].sort();
  const safe = new Set((Array.isArray(keep) ? keep : []).filter(isVersionId));
  const doomed = new Set(ids.slice(0, Math.max(0, ids.length - lim)).filter((id) => !safe.has(id)));
  if (!doomed.size) return 0;
  for (const o of objs) {
    const id = String((o && o.key) || "").slice(prefix.length).split("/")[0];
    if (doomed.has(id)) await deps.remove(o.key);
  }
  return doomed.size;
}

/** Every build object of a site and its pointer, for the delete path. */
export async function deleteAllBuilds(deps, slug) {
  let n = 0;
  for (const o of (await deps.list(P_BUILDS(slug))) || []) { await deps.remove(o.key); n++; }
  try { await deps.remove(POINTER_KEY(slug)); } catch { /* a pointer that is not there */ }
  return n;
}

/**
 * Where a published file lives, for the platform's own readers (the fallback
 * serve path, the card lookup): under the pointer's build when the site has
 * one, and under the frozen legacy prefix otherwise.
 */
export function assetKeyFor(pointer, slug, rel) {
  const r = String(rel || "").replace(/^\/+/, "");
  return pointer && isVersionId(pointer.version)
    ? buildPrefix(slug, pointer.version) + CLIENT_DIR + r
    : "sites/" + String(slug || "").toLowerCase() + "/" + r;
}

// ── THE EDITABLE COPY KNOWS WHICH BUILD IT CAME FROM (stage 6, 2026-09-05) ──
//
// Activation copies a version's state into the editable locations LAST and
// best-effort (step 6 above), so a job that dies between the pointer write and
// that copy leaves the live site one version ahead of what the next edit
// reads — and that edit then publishes the previous version's pages with its
// own change, quietly undoing the one before it. So the copy ends with a
// MARKER naming the version it was copied from, and a job about to read the
// editable state asks first whether the marker names the pointer's version;
// when it does not, it repairs the copy from that version's own state before
// reading. The marker is written after the copy, never before: a copy that
// died leaves the previous marker, which is exactly the disagreement the
// repair reads.

/** Where the editable copy records the version it was copied from. */
export const HEAD_KEY = (slug) => "source/" + String(slug || "").toLowerCase() + "/head.json";

/**
 * The config fields a repair restores: the version's baked look, and NEVER
 * the translation cache — `langStrings` is written before a publish as a
 * cache, a translation bought is a translation still right when its publish
 * fails, and restoring an older cache would buy them all again.
 */
export const REPAIR_CONFIG_FIELDS = STATE_CONFIG_FIELDS.filter((f) => f !== "langStrings");

/** Those fields off a config, in one fixed order. */
export function repairConfigOf(config) {
  const out = {};
  const c = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  for (const f of REPAIR_CONFIG_FIELDS) if (c[f] !== undefined) out[f] = c[f];
  return out;
}

/** Deep equality that does not care about key order — two configs that
 *  serialise differently and mean the same must not read as drift. */
export function sameJson(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined).sort();
  const kb = Object.keys(b).filter((k) => b[k] !== undefined).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => sameJson(a[k], b[k]));
}

/** The marker, or null when there is none or it cannot be read as one. */
export async function readHead(deps, slug) {
  let o = null;
  try { o = await deps.get(HEAD_KEY(slug)); } catch { return null; }
  if (!o) return null;
  try {
    const h = JSON.parse(await o.text());
    if (!h || !isVersionId(h.version)) return null;
    return { version: h.version, at: typeof h.at === "string" ? h.at : "" };
  } catch { return null; }
}

/** Written AFTER a copy, naming the version copied. */
export async function writeHead(deps, slug, version, now) {
  if (!isVersionId(version)) throw new Error("head marker: bad version id");
  const at = typeof now === "string" ? now : new Date().toISOString();
  await deps.put(HEAD_KEY(slug), JSON.stringify({ version, at }), "application/json");
  return { version, at };
}

/**
 * Does the editable copy need repairing from the pointer's version?
 *
 *   no-pointer  the site has never published under this layout: its editable
 *               state is the legacy layout's and nothing here knows better
 *   no-head     a pointer and no marker: the copy predates the marker, or the
 *               first copy after it died before the marker — either way the
 *               version's state IS the live site's, so copying it is right,
 *               and safe because a claim holds the site while it happens
 *   behind      the marker names another version than the pointer: a copy
 *               that never finished, on a publish or on a restore
 *   same        the copy is the pointer's
 */
export function repairNeeded({ pointer, head } = {}) {
  if (!pointer || !isVersionId(pointer.version)) return { repair: false, why: "no-pointer" };
  if (!head || !isVersionId(head.version)) return { repair: true, why: "no-head" };
  if (head.version !== pointer.version) return { repair: true, why: "behind" };
  return { repair: false, why: "same" };
}

/**
 * Copy a version's state into the editable locations and mark it: the page
 * source and the parts as they are, the config through the caller's merge —
 * `mergeConfig(stateText)` answers whether it wrote — so the owner's own
 * settings survive, and the translation cache with them. NEVER THE SIDECAR:
 * the rename lane patches the live sidecar's origin without a publish, and a
 * copy of the version's would name the old address again. A build staged
 * without state (nothing to copy from) answers `no-state` and writes
 * nothing, the marker included.
 */
export async function repairEditable(deps, { slug, version, keys = {}, mergeConfig, now } = {}) {
  if (!isVersionId(version)) return { ok: false, why: "bad-version", wrote: [] };
  const dest = buildPrefix(slug, version) + STATE_DIR;
  const text = async (key) => { const o = await deps.get(key); return o ? await o.text() : null; };
  const wrote = [];
  const pages = await text(dest + "pages.json");
  if (typeof pages !== "string" || !keys.source) return { ok: false, why: "no-state", wrote };
  await deps.put(keys.source, pages, "application/json");
  wrote.push("source");
  const parts = await text(dest + "parts.json");
  if (typeof parts === "string" && keys.parts) { await deps.put(keys.parts, parts, "application/json"); wrote.push("parts"); }
  const config = await text(dest + "config.json");
  if (typeof config === "string" && typeof mergeConfig === "function" && (await mergeConfig(config)) === true) wrote.push("config");
  await writeHead(deps, slug, version, now);
  return { ok: true, why: "repaired", wrote, version };
}

/** Both layouts in one list, newest first — the Versions panel's answer. */
export function mergeVersions(legacy, builds) {
  const all = [...(Array.isArray(legacy) ? legacy : []), ...(Array.isArray(builds) ? builds : [])].filter((v) => v && isVersionId(v.id));
  const seen = new Set();
  return all.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true))).sort((a, b) => (a.id < b.id ? 1 : -1));
}
