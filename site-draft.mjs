// THE DRAFT, AND THE ONE DOOR TO THE LIVE SITE (owner, 2026-10-15).
//
// "Only an explicit click on the Publish button may make changes live."
// Build, Edit, Add-on — and every parallel task, recovery, answered
// question and finished chain — save their result as a DRAFT: a staged
// version (`builds/<slug>/<version>/`, immutable once its manifest lands)
// named by the draft record `site-drafts/<slug>.json`, with its own preview. The
// live site — the pointer, the site script, the sidecar, the live marker —
// moves only when the owner presses Publish, and then to exactly the version
// they approved: the version is named by the click, staged builds never
// change, so a task still running, or an edit made after, is a later draft
// and cannot slip into that publication.
//
// Pure helpers over a `deps` of `{ get, put }` (R2-shaped), so the Worker and
// the tests read and write the record the same way.

import { isHeldObject } from "./site-builds.mjs";

// ITS OWN NAMESPACE (2026-10-15, the draft-first round on current main): the
// owner's video and audio kept before a site exists live under `drafts/<uid>/`
// (`site-media.mjs`), so the site's draft record does not share that prefix.
export const DRAFT_KEY = (slug) => "site-drafts/" + slug + ".json";
/** One task's held backend and library changes, immutable once written. */
export const HELD_KEY = (slug, id) => "site-drafts/" + slug + "/held/" + id + ".json";
/**
 * THE OWNER'S PUBLICATION IN PROGRESS, AND ITS JOURNAL: one at a time per
 * site, under its own prefix so the recovery sweep lists publications and
 * nothing else.
 */
export const PUBLISHING_KEY = (slug) => "site-publishing/" + slug + ".json";
export const PUBLISHING_PREFIX = "site-publishing/";
const VERSION_ID = /^\d{14}-[a-z0-9]{6}$/;
export const isDraftVersion = (v) => typeof v === "string" && VERSION_ID.test(v);

/** Is draft-first publishing on? `DRAFT_FIRST=on` (the owner's switch while the branch is unmerged). */
export function draftFirst(env) {
  return !!env && String(env.DRAFT_FIRST || "").toLowerCase() === "on";
}

/**
 * The draft record, or null when the site has none. Throws when one stands
 * and cannot be read: cannot-tell is never "no draft".
 */
export async function readDraft(deps, slug) {
  const o = await deps.get(DRAFT_KEY(slug));
  if (!o) return { draft: null, etag: null };
  const t = await o.text();
  // HELD ABSENT (2026-10-15): no draft — and its etag, so the first save is
  // conditional on that object, never "only if absent".
  if (isHeldObject(o, t)) return { draft: null, etag: String(o.etag || "") || null };
  const d = JSON.parse(t);
  if (!d || !isDraftVersion(d.version)) throw new Error("draft unreadable");
  return {
    draft: {
      version: d.version,
      build: typeof d.build === "string" ? d.build : "",
      base: isDraftVersion(d.base) ? d.base : "",
      job: typeof d.job === "string" ? d.job : null,
      at: typeof d.at === "string" ? d.at : "",
      history: Array.isArray(d.history) ? d.history.filter(isDraftVersion).slice(-20) : [],
      preview: PREVIEW_TOKEN.test(String(d.preview || "")) ? d.preview : "",
      ...readRevisions(d),
    },
    etag: String(o.etag || "") || null,
  };
}

/**
 * Record `version` as the site's draft, conditionally on the record read
 * (`etag`, or absent): a draft saved by another task meanwhile is read again
 * and this one written over it only when it is newer — versions sort by
 * their minting time — so the draft is always the latest saved version, and
 * each earlier one stays in `history`, still publishable by name.
 *
 * EVERY SAVE IS A REVISION (2026-10-15, the draft-first round): the owner
 * publishes a numbered revision — a code version and the backend and library
 * changes held with it (`held`, the journal written first by `writeHeld`).
 * A save of an older version keeps it in `history`; its held changes, if any,
 * still become a revision on the newest code.
 */
export async function saveDraftRecord(deps, slug, { version, build = "", base = "", job = null, held = null, now = () => new Date(), token = newPreviewToken }) {
  if (!isDraftVersion(version)) throw new Error("not a version: " + version);
  const heldRef = held && typeof held.id === "string" ? held : null;
  for (let i = 0; i < 6; i++) {
    const { draft, etag } = await readDraft(deps, slug);
    if (draft && draft.version === version && !heldRef) return { ok: true, draft, same: true };
    const at = now().toISOString();
    const history = draft ? [...draft.history.filter((v) => v !== draft.version && v !== version), draft.version] : [];
    // A NEWER DRAFT ALREADY STANDS AND THIS SAVE CARRIES HELD CHANGES
    // (2026-10-16, Codex's reproduction): its code is not in the newer draft,
    // so a revision of its held changes on the newer code would publish them
    // without the code they came with, and the caller would bill both as done.
    // NOTHING IS WRITTEN: the caller is told `older`, the immutable journal
    // it flushed stays unreferenced (never applied), and the task runs again
    // on the newer draft, holding its changes afresh — once.
    if (draft && draft.version > version && heldRef) return { ok: false, older: true, error: "older", version: draft.version };
    if (draft && draft.version >= version) {
      // A NEWER DRAFT ALREADY STANDS: this version is kept in its history only;
      // its held changes, if any, are the next revision on the newest code.
      const keep = { ...draftRecordOut(draft), history: [...draft.history.filter((v) => v !== version), ...(draft.version === version ? [] : [version])].sort().slice(-20) };
      if (heldRef) Object.assign(keep, addRevision(draft, { version: draft.version, held: heldRef, job, at }));
      const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(keep), "application/json", { etagMatches: etag });
      if (put) { if (heldRef) await foldHeld(deps, slug, readBack(keep)); return { ok: true, draft: readBack(keep), older: draft.version !== version, revision: keep.rev }; }
      continue;
    }
    const rec = {
      v: 2, version, build: String(build || ""), base: isDraftVersion(base) ? base : "", job: job ? String(job) : null, at,
      history: history.slice(-20), preview: (draft && draft.preview) || token(),
      ...addRevision(draft, { version, held: heldRef, job, at }),
    };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" });
    if (put) { if (heldRef) await foldHeld(deps, slug, readBack(rec)); return { ok: true, draft: readBack(rec), revision: rec.rev }; }
  }
  return { ok: false, error: "the draft kept changing under this save" };
}
/**
 * A VERSIONS RESTORE IS THE DRAFT'S NEW STARTING POINT (2026-10-18, audit
 * A06-2). The restore moves the live site back to `version`; the draft record
 * still named the newer version, so the panel offered it as unpublished, the
 * next edit's repair copied its pages back over the restored ones, and the
 * next Publish quietly undid the restore. Here the restored version becomes
 * the draft's version and base, as a revision already published. Only on a
 * draft with nothing unpublished (`unpublished: true` otherwise, nothing
 * written): held work is never thrown away by a restore. Read and written on
 * the etag, as every save is.
 */
export async function rebaseDraft(deps, slug, { version, build = "", now = () => new Date() }) {
  if (!isDraftVersion(version)) throw new Error("not a version: " + version);
  for (let i = 0; i < 6; i++) {
    const { draft, etag } = await readDraft(deps, slug);
    if (!draft) return { ok: true, none: true };
    if (draft.rev > draft.applied) return { ok: false, unpublished: true, error: "the draft has unpublished changes" };
    if (draft.version === version) return { ok: true, same: true, draft };
    const at = now().toISOString();
    const rec = {
      ...draftRecordOut(draft), version, build: String(build || ""), base: version, job: null, at,
      history: [...draft.history.filter((v) => v !== draft.version && v !== version), draft.version].slice(-20),
      ...addRevision(draft, { version, at, applied: draft.rev + 1 }),
    };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", { etagMatches: etag });
    if (put) return { ok: true, draft: readBack(rec), revision: rec.rev };
  }
  return { ok: false, error: "the draft kept changing under this restore" };
}
/**
 * DISCARD THE DRAFT (2026-10-18, the owner's word, after audit A06-2): the
 * owner's own choice to drop every unpublished revision and start again from
 * the live version — the one way to restore an older version while changes
 * are held. The published revisions stay as they were; the dropped ones leave
 * the list, so nothing reads them as published; their held journals are never
 * replayed (the next range starts after the new revision). `live` is the live
 * pointer (`{ version, build }`). Read and written on the etag.
 */
export async function discardDraft(deps, slug, { live, now = () => new Date() }) {
  if (!live || !isDraftVersion(live.version)) return { ok: false, error: "the site has no live version to go back to" };
  for (let i = 0; i < 6; i++) {
    const { draft, etag } = await readDraft(deps, slug);
    if (!draft) return { ok: true, none: true };
    if (!(draft.rev > draft.applied) && draft.version === live.version) return { ok: true, same: true, draft };
    const at = now().toISOString();
    const kept = { ...draft, revs: draft.revs.filter((r) => r.n <= draft.applied) };
    const rec = {
      ...draftRecordOut(draft), version: live.version, build: String(live.build || ""), base: live.version, job: null, at,
      history: [...draft.history.filter((v) => v !== draft.version && v !== live.version), draft.version].slice(-20),
      ...addRevision(kept, { version: live.version, at, applied: draft.rev + 1 }),
    };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", { etagMatches: etag });
    if (put) return { ok: true, draft: readBack(rec), dropped: draft.rev - draft.applied };
  }
  return { ok: false, error: "the draft kept changing — try again" };
}
/**
 * A SAVE THAT HELD CHANGES FOLDS ITS REVISION INTO THE CUMULATIVE RECORD at
 * once (`heldRange`), so a draft that grows by saves alone never leaves a
 * long run of journals for the next reader. Best effort: the save stands
 * whatever happens here, and a reader folds in whatever is missing.
 */
async function foldHeld(deps, slug, draft) {
  try { await heldRange(deps, slug, draft, { from: draft.applied }); } catch { /* the next reader */ }
}

/**
 * A REVISION OF HELD CHANGES ONLY (a data or rules edit, a pageless add-on, a
 * library change): the code stays the draft's — or, with no draft yet, the
 * live version (`liveVersion`) — and the held journal rides with it.
 */
export async function sealHeldRevision(deps, slug, { held, job = null, liveVersion = "", now = () => new Date(), token = newPreviewToken } = {}) {
  if (!held || typeof held.id !== "string") throw new Error("nothing held to seal");
  for (let i = 0; i < 6; i++) {
    const { draft, etag } = await readDraft(deps, slug);
    const version = draft ? draft.version : liveVersion;
    if (!isDraftVersion(version)) return { ok: false, error: "the site has no version to hold changes against" };
    const at = now().toISOString();
    const rec = draft
      ? { ...draftRecordOut(draft), ...addRevision(draft, { version, held, job, at }) }
      : { v: 2, version, build: "", base: version, job: job ? String(job) : null, at, history: [], preview: token(), ...addRevision(null, { version, held, job, at, applied: 0 }) };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" });
    if (put) { await foldHeld(deps, slug, readBack(rec)); return { ok: true, draft: readBack(rec), revision: rec.rev }; }
  }
  return { ok: false, error: "the draft kept changing under this save" };
}

/**
 * THE OWNER'S PUBLICATION RECORDED: `applied` moves to the revision
 * published (never back), with the row ids its inserts were given (`refs`),
 * so a later revision's change to such a row finds it.
 */
export async function markApplied(deps, slug, { revision, refs = {} } = {}) {
  for (let i = 0; i < 6; i++) {
    const { draft, etag } = await readDraft(deps, slug);
    if (!draft) return { ok: false, error: "no draft" };
    if (draft.applied >= revision) return { ok: true, draft, already: true };
    // PUBLISHED NOW: what falls past the history kept is trimmed (never anything unpublished).
    const kept = retain(draft.revs, revision, draft.trimmed);
    const rec = { ...draftRecordOut(draft), revs: kept.revs, ...(kept.trimmed ? { trimmed: kept.trimmed } : {}), applied: revision, refs: { ...draft.refs, ...refs } };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", { etagMatches: etag });
    if (put) return { ok: true, draft: readBack(rec) };
  }
  return { ok: false, error: "the draft kept changing under this save" };
}

// ── REVISIONS ────────────────────────────────────────────────────────────────
//
// NO COUNT LIMIT ON WORK NOT YET PUBLISHED (2026-10-16, the owner: *"There must
// be no artificial change-count limit that forces publication or loses pending
// work."*). The list was cut to its last 60 revisions on every read and every
// save, so a draft past 60 changes silently lost its oldest unpublished ones:
// Codex's reproductions showed 100 held additions publishing only 41–100, and
// one held addition followed by 99 code saves vanishing from the draft's
// effective state. Now the record keeps EVERY revision past `applied` — the
// unpublished work, and so any revision a publication is releasing (it is past
// `applied` until `markApplied`) — and only revisions already published are
// trimmed, to the latest `KEEP_PUBLISHED`, for the panel's history. What was
// trimmed is recorded (`trimmed`: the highest revision dropped and when it was
// saved), so a reader proving a job's absence from the list knows which jobs
// could have been dropped (`revisionsTrimmed`).
export const KEEP_PUBLISHED = 20;
function readTrimmed(t) {
  return t && typeof t === "object" && Number.isSafeInteger(t.n) && t.n > 0 ? { n: t.n, at: typeof t.at === "string" ? t.at : "" } : null;
}
/** Keep every revision past `applied`, and the latest published ones; `{ revs, trimmed }`. */
function retain(revs, applied, trimmed) {
  const published = revs.filter((r) => r.n <= applied);
  const drop = published.slice(0, Math.max(0, published.length - KEEP_PUBLISHED));
  if (!drop.length) return { revs, trimmed };
  const last = drop[drop.length - 1];
  const at = [trimmed && trimmed.at, ...drop.map((r) => r.at)].filter(Boolean).sort().pop() || "";
  return { revs: revs.filter((r) => !drop.includes(r)), trimmed: { n: Math.max(last.n, trimmed ? trimmed.n : 0), at } };
}
function readRevisions(d) {
  const all = (Array.isArray(d.revs) ? d.revs : [])
    .filter((r) => r && Number.isSafeInteger(r.n) && r.n > 0 && isDraftVersion(r.version))
    .map((r) => ({ n: r.n, version: r.version, at: typeof r.at === "string" ? r.at : "", job: typeof r.job === "string" ? r.job : null, held: typeof r.held === "string" && HELD_ID.test(r.held) ? r.held : null, ops: Number.isSafeInteger(r.ops) ? r.ops : 0 }))
    .sort((a, b) => a.n - b.n);
  // A RECORD WRITTEN BEFORE REVISIONS (the first draft-first commit): its
  // draft is revision 1, nothing published through it.
  if (!all.length && isDraftVersion(d.version)) all.push({ n: 1, version: d.version, at: typeof d.at === "string" ? d.at : "", job: null, held: null, ops: 0 });
  const rev = Math.max(Number.isSafeInteger(d.rev) ? d.rev : 0, all.length ? all[all.length - 1].n : 0);
  const applied = Number.isSafeInteger(d.applied) && d.applied >= 0 ? Math.min(d.applied, rev) : 0;
  const refs = {};
  if (d.refs && typeof d.refs === "object" && !Array.isArray(d.refs)) {
    for (const [k, v] of Object.entries(d.refs)) if (REF.test(k) && Number.isSafeInteger(v)) refs[k] = v;
  }
  // NOTHING PAST `applied` IS DROPPED ON A READ: the record is read as stored.
  return { rev, revs: all, applied, refs, trimmed: readTrimmed(d.trimmed) };
}
function addRevision(draft, { version, held = null, job = null, at, applied = null }) {
  const prev = draft ? draft.revs : [];
  const n = (draft ? draft.rev : 0) + 1;
  const r = { n, version, at, job: job ? String(job) : null, held: held ? held.id : null, ops: held && Array.isArray(held.ops) ? held.ops.length : 0 };
  const app = applied !== null ? applied : draft ? draft.applied : 0;
  const kept = retain([...prev, r], app, draft ? draft.trimmed : null);
  return { rev: n, revs: kept.revs, applied: app, refs: draft ? draft.refs : {}, ...(kept.trimmed ? { trimmed: kept.trimmed } : {}) };
}
/** The record as stored, from what `readDraft` answered. */
function draftRecordOut(d) {
  return { v: 2, version: d.version, build: d.build, base: d.base, job: d.job, at: d.at, history: d.history, preview: d.preview, rev: d.rev, revs: d.revs, applied: d.applied, refs: d.refs, ...(d.trimmed ? { trimmed: d.trimmed } : {}) };
}
function readBack(rec) {
  return { version: rec.version, build: rec.build || "", base: rec.base || "", job: rec.job || null, at: rec.at || "", history: rec.history || [], preview: rec.preview || "", ...readRevisions(rec) };
}

/**
 * THIS JOB'S OWN SAVE, PROVEN FROM THE DURABLE RECORD (2026-10-16, Codex's
 * review of `74cbce6b`): the revision a save writes names its job, its code
 * version and its held journal together, in one conditional write. So a
 * revision carrying this job's id AND its version (a code save) or its held
 * journal (a held-only save) — or both, when it carried both — is proof that
 * exactly this job's work became part of the saved draft. A draft merely
 * existing, its selected version, or this version standing in `history`
 * (where an older code-only save is kept, refused) proves nothing. Null when
 * no such revision is there; `trimmed` tells a caller that an old revision
 * could have fallen off the record's bounded list, so absence is not proof.
 */
export function savedRevision(draft, { job = null, version = null, held = null } = {}) {
  if (!draft || !Array.isArray(draft.revs)) return null;
  if (!job && !version && !held) return null;
  return draft.revs.find((r) => (!job || r.job === String(job))
    && (!version || r.version === version)
    && (!held || r.held === held)) || null;
}
/**
 * WHETHER A JOB'S REVISION COULD HAVE BEEN TRIMMED FROM THE LIST: only
 * published revisions are ever trimmed, all saved no later than `trimmed.at`.
 * A job that began (`since`) well after that — past a margin for clocks that
 * disagree — saved nothing that was trimmed, so its absence is proof; one that
 * began before, or whose start is not known, may have been dropped. A record
 * cut by the earlier 60-revision limit carries no `trimmed`: sixty revisions
 * starting past revision 1 say so, with no time, so nothing is proved by it.
 */
export const TRIM_CLOCK_MARGIN_MS = 10 * 60 * 1000;
/** The earlier code's limit: a record it cut holds exactly this many, from past revision 1. */
export const LEGACY_MAX_REVS = 60;
export function revisionsTrimmed(draft, { since = null } = {}) {
  if (!draft || !Array.isArray(draft.revs)) return false;
  const t = readTrimmed(draft.trimmed);
  if (!t) return draft.revs.length >= LEGACY_MAX_REVS && draft.revs[0].n > 1;
  const began = typeof since === "number" ? since : Date.parse(String(since || ""));
  const cut = Date.parse(t.at);
  if (!Number.isFinite(began) || !Number.isFinite(cut)) return true;
  return began <= cut + TRIM_CLOCK_MARGIN_MS;
}

/** A revision of this record, by its number, or null. */
export function revisionOf(draft, n) {
  if (!draft || !Number.isSafeInteger(n)) return null;
  return draft.revs.find((r) => r.n === n) || null;
}

/**
 * A VERSION ID THAT SORTS AFTER THE DRAFT'S (2026-10-16): the draft keeps the
 * newest version it is given, so a version minted by a clock behind another
 * isolate's would save as older and lose its change. Under draft-first a
 * publish mints with this: the later of now and one millisecond past `prev`.
 */
export function mintAfter(prev, now = Date.now(), rand = Math.random().toString(36).slice(2)) {
  const m = /^(\d{14})-/.exec(String(prev || ""));
  const after = m ? Number(m[1]) + 1 : 0;
  const ms = Math.max(Math.floor(Number(now) || 0), after);
  const tail = String(rand == null ? "" : rand).replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  return String(ms).padStart(14, "0") + "-" + (tail || "000000");
}

/**
 * THE VERSIONS THIS DRAFT HOLDS THAT WERE NEVER PUBLISHED (2026-10-18, audit
 * A11-1/A38-1): every version a revision past `applied` carries, and the
 * draft's own — less any version a published revision carries. Back online
 * never activates one of these: under draft-first the newest saved build is
 * usually the owner's unapproved draft. (The Versions restore is batch 2.)
 * A version the record does not name (built before draft-first, or published
 * and trimmed) is not in it.
 */
export function unpublishedVersions(draft) {
  const out = new Set();
  if (!draft || !Array.isArray(draft.revs)) return out;
  const applied = Number.isSafeInteger(draft.applied) ? draft.applied : 0;
  const pub = new Set(draft.revs.filter((r) => r.n <= applied).map((r) => r.version));
  for (const r of draft.revs) if (r.n > applied && !pub.has(r.version)) out.add(r.version);
  if (isDraftVersion(draft.version) && !pub.has(draft.version)) out.add(draft.version);
  return out;
}

/** May `version` be published from this draft record? The draft itself, or one of its saved predecessors. */
export function publishable(draft, version) {
  if (!draft || !isDraftVersion(version)) return false;
  return draft.version === version || draft.history.includes(version);
}

/**
 * THE REVISION THE OWNER'S CLICK NAMES (2026-10-15): `{ revision }` (what the
 * Publish panel shows), or a bare `{ version }` — the newest revision that
 * carries that version. Both given, they must agree. `{ ok, rev }` or
 * `{ ok: false, status, error }`. A revision at or below the one published is
 * `already`. Nothing newer is ever reached for: the click names the release.
 */
export function chooseRevision(draft, { revision = null, version = "" } = {}) {
  if (!draft) return { ok: false, status: 409, error: "this site has no saved draft — nothing was published" };
  let rev = null;
  if (Number.isSafeInteger(revision) && revision > 0) {
    rev = revisionOf(draft, revision);
    if (!rev) return { ok: false, status: 409, error: "that revision is not a saved draft of this site — nothing was published" };
    if (version && rev.version !== version) return { ok: false, status: 409, error: "that revision and that version do not match — nothing was published" };
  } else if (isDraftVersion(version)) {
    const list = draft.revs.filter((r) => r.version === version);
    rev = list.length ? list[list.length - 1] : null;
    if (!rev) return { ok: false, status: 409, error: "that version is not a saved draft of this site — nothing was published" };
  } else return { ok: false, status: 400, error: "name the revision to publish" };
  return { ok: true, rev, already: rev.n <= draft.applied };
}

/**
 * WHAT THE OWNER SEES: `published` (nothing saved beyond the live version),
 * `saved` (a draft newer than the live site, nothing running), `processing`
 * (a task for this site still running — its result will be a later draft).
 */
export function draftState({ draft = null, live = null, running = 0, publishing = null } = {}) {
  const liveVersion = live && live.version ? live.version : "";
  // AHEAD: a code version the live site is not on, or held changes not yet
  // published (a revision past `applied` that carries a journal).
  const revs = draft && Array.isArray(draft.revs) ? draft.revs : [];
  const appliedN = draft && Number.isSafeInteger(draft.applied) ? draft.applied : 0;
  const heldAhead = revs.some((r) => r.n > appliedN && r.held);
  const ahead = !!(draft && ((draft.version && draft.version !== liveVersion) || heldAhead));
  return {
    state: publishing ? "publishing" : running > 0 ? "processing" : ahead ? "saved" : liveVersion ? "published" : "unpublished",
    live: liveVersion || null,
    draft: draft ? draft.version : null,
    revision: draft && Number.isSafeInteger(draft.rev) ? draft.rev : 0,
    applied: appliedN,
    unpublished: ahead,
    neverPublished: !liveVersion,
    running,
  };
}

// ── THE DRAFT'S PREVIEW ─────────────────────────────────────────────────────
//
// A draft is seen before it is published: its own script, uploaded under a
// name no live address dispatches to (`draft-<slug>`, beside the live
// `site-<slug>`), served at `<slug>--draft-<token>.gofarther.app`. The token
// is kept in the draft record, so the address is unguessable and stable for
// the site; the platform sends the preview script the one header that lets it
// render without the live marker (a first build has none yet), and strips that
// header from every other request.
const PREVIEW_TOKEN = /^[0-9a-f]{12}$/;
function newPreviewToken() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const PREVIEW_HEADER = "x-site-preview";
export function previewScriptName(slug) {
  const s = String(slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return s ? "draft-" + s : "";
}
/** The preview host label of a site's draft, or "" when the label would be too long for DNS (63). */
export function previewLabel(slug, token) {
  const l = String(slug || "") + "--draft-" + String(token || "");
  return PREVIEW_TOKEN.test(String(token || "")) && l.length <= 63 ? l : "";
}
/** `<slug>--draft-<token>` → `{ slug, token }`, or null. */
export function previewOf(label) {
  const m = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)--draft-([0-9a-f]{12})$/.exec(String(label || "").toLowerCase());
  return m ? { slug: m[1], token: m[2] } : null;
}

/**
 * SAVE A STAGED VERSION AS THE DRAFT, in place of activating it — called with
 * the same options an activation takes, of which it uses its own: the draft
 * record first (so a copy that dies half-written is repaired from this
 * version, as a pointer-first activation is), then the editable copy
 * (`afterActivate`) unless a newer draft already stands, then the preview
 * script (best-effort: a preview that did not upload is said, never a lost
 * change), then the job's commit. Nothing live is touched: no pointer, no
 * sidecar, no live marker, no site script.
 */
/**
 * THE PREVIEW'S HEAD IS ITS VERSION'S OWN (2026-10-16, after Codex's review of
 * `fbd53dca`). A draft save used to write the version's sidecar to one shared
 * `sitemeta-draft/<slug>.json`, unfenced: an older save paused before that
 * write and resumed after a newer save finished left the draft on the newer
 * version with the OLDER head. Nothing is written for it now: the preview copy
 * of the site's script reads the sidecar staged with the version it serves
 * (`builds/<slug>/<version>/state/sidecar.json`, `server.ts`), immutable.
 */
const PREVIEW_CHECKS = 3;
/**
 * THE TICK'S REGISTER FOR ONE SITE'S PREVIEW (2026-10-16; since the review of
 * `6d075aeb` it decides nothing about readiness — the claims below do):
 * `{ v, state: "ready" | "pending" | "stuck", up, tries, next, at, error }`,
 * written only by `runPreviewRecovery` (worker.js) over the etag it read: how
 * many times it has tried, when it may try again, and whether it gave up. A
 * claim made after a `stuck` register unsticks it. It names no work to redo:
 * recovery uploads a staged version's own script, never builds or charges.
 */
export const PREVIEW_STATE_KEY = (slug) => "preview-state/" + String(slug || "") + ".json";
/** How many times the tick tries one site's preview before calling it stuck. */
export const PREVIEW_TRIES = 12;
/** The wait before the tick's next try: doubling from two minutes, at most an hour. */
export const previewBackoff = (tries) => Math.min(60 * 60 * 1000, 2 * 60 * 1000 * 2 ** Math.max(0, tries - 1));

// ── ONE CLAIM PER UPLOADING WRITER (2026-10-16, Codex's review of `6d075aeb`) ──
//
// One shared mark could not carry several writers: an older save paused inside
// its upload, a newer save finished and marked the preview ready, the older
// upload landed and its process stopped for good — the preview served OLD, the
// mark said ready, and the tick skipped it for ever. So every writer that may
// put a preview script up — a save, or the tick itself — first writes its OWN
// claim, `preview-claims/<slug>/<at>-<rand>.json`, create-only, its time in the
// key. With no claim written it uploads nothing. It removes only its own
// claim, and only once it has confirmed the draft's selected version is up;
// otherwise the claim stays as the durable evidence that an upload may have
// landed out of order. A writer starts no upload later than
// `PREVIEW_UPLOAD_WINDOW_MS` after its claim, and an upload is abandoned by
// `PREVIEW_FLIGHT_MS` (the dispatch call's own limit), so a claim older than
// `PREVIEW_LAND_MS` can no longer land anything: the tick then puts the
// selected version up under a claim of its own and, confirmed, clears every
// claim it read. A save is ready only when its own version is confirmed AND no
// other writer's claim stands.
// ── WHAT THE PREVIEW IS CONFIRMED TO SERVE (2026-10-16, Codex's review of
// `44676fcd`) ────────────────────────────────────────────────────────────────
//
// An empty claim list is not proof that the selected draft is serving: a save
// whose claim could not be written uploads nothing and leaves no claim, and
// the list read empty while the preview still served the version before. So
// readiness is read from POSITIVE evidence: the version a writer CONFIRMED up
// (`convergePreview` ready: its own upload succeeded and the draft still
// selected it), recorded here before that writer drops its claim, and only
// ever moved forward — versions sort by their minting time and the draft's
// selected version never goes back, so an older confirmation arriving late
// never overwrites a newer one. The preview is ready when this record names
// the draft's selected version AND no writer's claim stands (an upload that
// may still land out of order).
export const PREVIEW_UP_KEY = (slug) => "preview-up/" + String(slug || "") + ".json";
/** The version the preview was last confirmed serving, or null; throws when it cannot be read (cannot-tell is never "none"). */
export async function readPreviewUp(deps, slug) {
  const o = await deps.get(PREVIEW_UP_KEY(slug));
  if (!o) return null;
  const t = await o.text();
  if (isHeldObject(o, t)) return null;
  const j = JSON.parse(t);
  return j && isDraftVersion(j.version) ? { version: j.version, at: Number(j.at) || 0 } : null;
}
/** Record `version` as confirmed up, forward only. True when the record names it (or a newer version) afterwards. */
export async function markPreviewUp(deps, slug, version, at = Date.now()) {
  if (!isDraftVersion(version)) return false;
  for (let i = 0; i < 4; i++) {
    let cur = null, etag = null, held = false;
    try {
      const o = await deps.get(PREVIEW_UP_KEY(slug));
      if (o) { etag = String(o.etag || "") || null; const t = await o.text(); held = isHeldObject(o, t); if (!held) cur = JSON.parse(t); }
    } catch { return false; }
    if (cur && isDraftVersion(cur.version) && cur.version >= version) return true;
    let put = null;
    try { put = await deps.put(PREVIEW_UP_KEY(slug), JSON.stringify({ v: 1, version, at }), "application/json", etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" }); } catch { put = null; }
    if (put) return true;
  }
  return false;
}
/**
 * THE PREVIEW'S STATE FOR THE DRAFT AS READ: `ready` (confirmed serving its
 * selected version, nothing still landing), `pending` (not yet: an upload
 * standing, or nothing confirmed for this version), `failed` (the tick gave
 * up on it: `register.state === "stuck"`), `unknown` (the evidence could not
 * be read), or null when the draft has no preview. `claims` and `up` are the
 * reads, or an Error when a read failed.
 */
export function previewReadiness(draft, { up, claims, register = null } = {}) {
  if (!draft || !draft.preview || !isDraftVersion(draft.version)) return null;
  if (up instanceof Error || claims instanceof Error || !Array.isArray(claims)) return "unknown";
  if (up && up.version === draft.version && claims.length === 0) return "ready";
  if (register && register.state === "stuck") return "failed";
  return "pending";
}
export const PREVIEW_CLAIMS_PREFIX = (slug) => "preview-claims/" + String(slug || "") + "/";
export const PREVIEW_UPLOAD_WINDOW_MS = 5 * 60 * 1000;
/** Kept equal to `DISPATCH_CALL_MS` (builder/site-dispatch.mjs) by a test. */
export const PREVIEW_FLIGHT_MS = 10 * 60 * 1000;
export const PREVIEW_LAND_MS = PREVIEW_UPLOAD_WINDOW_MS + PREVIEW_FLIGHT_MS + 60 * 1000;
const CLAIM_KEY = /^preview-claims\/[^/]+\/(\d{13})-[a-z0-9]{6,16}\.json$/;
/** When a claim was made, read off its key; null for a key that is not a claim. */
export const claimAt = (key) => { const m = CLAIM_KEY.exec(String(key || "")); return m ? Number(m[1]) : null; };
/** Write a writer's own claim (create-only): `{ key, at }`, or null when it could not be written. */
export async function claimPreview(deps, slug, at = Date.now()) {
  const key = PREVIEW_CLAIMS_PREFIX(slug) + String(Math.floor(at)).padStart(13, "0") + "-" + randomHex(6) + ".json";
  try {
    const put = await deps.put(key, JSON.stringify({ v: 1, at }), "application/json", { etagDoesNotMatch: "*" });
    return put ? { key, at } : null;
  } catch { return null; }
}
/** Every claim standing for a site: `[{ key, at }]`. Throws when it cannot be read: cannot-tell is never "none". */
export async function previewClaims(deps, slug) {
  const rows = await deps.list(PREVIEW_CLAIMS_PREFIX(slug));
  return rows.map((r) => ({ key: String(r.key), at: claimAt(r.key) })).filter((c) => c.at !== null);
}
/** Remove claims (never throws; one left behind is settled by the tick, at worst redundantly). */
export async function dropClaims(deps, keys) {
  for (const k of keys) { try { await deps.remove(k); } catch { /* the tick */ } }
}

/**
 * BRING THE PREVIEW TO THE DRAFT'S SELECTED VERSION: `mine` uploaded first when
 * an `upload` is given, then — up to `checks` times — the draft read and, when
 * what was last confirmed up is not its version, that version's own script put
 * up (`repreview`). An upload that failed or lost its answer confirms nothing:
 * what serves is then unknown and the next round tries again. `ready` only when
 * the last upload this call made succeeded AND the draft still selects it.
 */
export async function convergePreview(deps, slug, { mine = null, upload = null, repreview = null, checks = PREVIEW_CHECKS, deadline = Infinity, now = () => Date.now() } = {}) {
  const standing = async () => {
    try { const { draft } = await readDraft(deps, slug); return { known: true, v: draft && typeof draft.version === "string" ? draft.version : null }; }
    catch { return { known: false, v: null }; }
  };
  let up = null, error = "", attempts = 0, repaired = false;
  // NO UPLOAD STARTS PAST THE CLAIM'S WINDOW: past it, the claim may be
  // settled by the tick as unable to land anything more. Asked here before
  // each attempt AND handed to the upload itself as `go`, which asks the
  // advancing clock again immediately before the external call — after any
  // staged-build read the upload makes first (2026-10-16, Codex's review of
  // `dbf7a2c8`).
  const go = () => now() <= deadline;
  const tryUp = async (fn, v) => {
    if (!go()) { up = null; error = "past the preview's upload window"; return false; }
    attempts++;
    let r;
    try { r = await fn({ go }); } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    if (r && r.ok === true) { up = v; return true; }
    up = null;
    error = String((r && r.error) || "the preview did not go up").slice(0, 200);
    return false;
  };
  if (mine && typeof upload === "function") await tryUp(upload, mine);
  let s = await standing();
  for (let i = 0; i < checks && s.known && s.v && s.v !== up && typeof repreview === "function" && go(); i++) {
    const want = s.v;
    if ((await tryUp((o) => repreview(want, o), want)) && want !== mine) repaired = true;
    s = await standing();
  }
  const ready = !!(s.known && s.v && up === s.v);
  if (!ready && !error) error = !s.known ? "the draft could not be read" : !s.v ? "there is no draft" : !go() ? "past the preview's upload window" : "the preview is not on the draft's version yet";
  // `absent`: the draft is READ and there is none — nothing to show, as
  // opposed to a draft that could not be read.
  return { ready, version: s.v, up, attempts, repaired, absent: !!(s.known && !s.v), ...(ready ? {} : { error }) };
}
export async function saveAsDraft(deps, { slug, version, build = "", base = "", job = null, afterActivate, commit, preview, repreview = null, held = null, clock = () => Date.now() } = {}) {
  let rec, ref = null;
  // THE PREVIEW'S CLAIM BEFORE THE DRAFT'S RECORD (2026-10-16, Codex's review
  // of `6d075aeb`): a save that stops between recording the draft and putting
  // its preview up leaves this claim, and the tick puts the selected version
  // up; one that stops before the record leaves a claim with nothing to
  // repair, which the tick settles harmlessly. A claim that cannot be written
  // means no upload at all (below): never an untracked one.
  const claim = typeof preview === "function" ? await claimPreview(deps, slug, clock()) : null;
  const unclaim = async () => { if (claim) await dropClaims(deps, [claim.key]); };
  // AFTER A WRITE WHOSE OUTCOME IS UNCERTAIN (2026-10-16, Codex's review of
  // `dbf7a2c8`): a record write can land and lose its answer. The claim is
  // removed only when the durable state shows the write did NOT land — the
  // draft read, and it selects some other version, or there is none; when it
  // selects this version, or cannot be read, the claim stays and the tick
  // puts the selected version's preview up (or, finding no draft at all,
  // clears it).
  const settleUncertain = async () => {
    if (!claim) return { landed: null };
    let landed = null;
    try { const { draft } = await readDraft(deps, slug); landed = !!(draft && draft.version === version); } catch { landed = null; }
    if (landed === false) await unclaim();
    return { landed };
  };
  try {
    // THE TASK'S HELD BACKEND AND LIBRARY CHANGES go into the same revision as
    // its code (2026-10-15): written first, immutable, named by the record.
    // A HOLD (its ops written now) or a reference already written (a build
    // whose generation finished in a later invocation carries `{ id, ops }`).
    ref = held && typeof held.flush === "function" ? await held.flush()
      : held && typeof held.id === "string" && HELD_ID.test(held.id) && Array.isArray(held.ops) ? { id: held.id, ops: held.ops } : null;
    // A REFERENCE CARRIED BY A RECORD (a build's resume) is written here if it
    // is not yet: create-only, so one already there is kept as it is.
    if (ref && ref.ops.length && !(held && typeof held.flush === "function")) {
      await deps.put(HELD_KEY(slug, ref.id), JSON.stringify({ v: 1, id: ref.id, ops: ref.ops }), "application/json", { etagDoesNotMatch: "*" });
    }
    if (ref && !ref.ops.length) ref = null;
    rec = await saveDraftRecord(deps, slug, { version, build, base, job, held: ref });
  }
  catch (e) {
    // THE WRITE'S OUTCOME FROM THE DURABLE RECORD (2026-10-16, Codex's review
    // of `74cbce6b`): a record write that landed and lost its answer is this
    // job's save, proven by its own revision (`savedRevision`) — then the save
    // goes on as saved, once: no resend, no regeneration, no second journal.
    let proven = null, now = null;
    try { now = (await readDraft(deps, slug)).draft; proven = savedRevision(now, { job, version, held: ref && ref.ops && ref.ops.length ? ref.id : null }); } catch { proven = null; }
    if (proven) rec = { ok: true, draft: now, revision: proven.n, reconciled: true };
    else {
      const { landed } = await settleUncertain();
      if (e && e.code === "TURN_FENCED") throw e;
      return { ok: false, error: "draft: " + String((e && e.message) || e), ...(landed !== false && claim ? { recoverable: true, landed } : {}) };
    }
  }
  if (!rec.ok) { await unclaim(); return { ok: false, error: rec.error || "draft", ...(rec.older ? { older: true, version: rec.version } : {}) }; }
  // A NEWER DRAFT ALREADY STOOD (2026-10-16): the draft the owner will publish
  // does not hold this save's code. It is not committed or billed as done;
  // the caller is told `older`, and the request runs the part again on the
  // newer draft. A save that carried held changes is refused before anything
  // is written (`saveDraftRecord`); one that carried only code is kept in the
  // history, still publishable by name, and refused here.
  if (rec.older) { await unclaim(); return { ok: false, error: "older", older: true, version: rec.draft && rec.draft.version }; }
  // THE EDITABLE COPY FOLLOWS ONLY WHILE THIS VERSION IS THE DRAFT'S: a save
  // proven after the fact that a newer one has since overtaken leaves the
  // copy to that one (every job puts it back from the draft's version before
  // it reads, `ensureEditableState`).
  if (!rec.older && typeof afterActivate === "function" && (!rec.draft || rec.draft.version === version)) await afterActivate();
  // THE PREVIEW SHOWS THE DRAFT'S VERSION, whichever save finishes last
  // (2026-10-16, after Codex's reviews of `fbd53dca`, `ea9a2b71` and
  // `6d075aeb`). A save overtaken after its record puts no script up. Under
  // its own claim (above) a save brings the preview to the draft's selected
  // version (`convergePreview`); confirmed, it removes ITS claim and is ready
  // only if no other writer's claim stands — another upload may still land
  // over it. Unconfirmed, its claim stays, and the tick finishes the work
  // with nobody's browser open. `previewed.ok` says the preview is READY and
  // is kept apart from the save, which stands either way (`ok` above).
  let previewed = null;
  if (typeof preview === "function") {
    if (!claim) previewed = { ok: false, pending: true, recoverable: false, error: "the preview's recovery could not be recorded, so no preview was put up" };
    else {
      let first = null;
      try { const { draft } = await readDraft(deps, slug); first = draft && typeof draft.version === "string" ? draft.version : null; } catch { first = null; }
      if (first && first !== version) {
        // NOTHING UPLOADED: the claim has nothing to cover.
        await unclaim();
        previewed = { ok: false, superseded: true, version: first, pending: false };
      } else {
        const c = await convergePreview(deps, slug, { mine: version, upload: (o) => preview(rec.draft, o), repreview, deadline: claim.at + PREVIEW_UPLOAD_WINDOW_MS, now: clock });
        let others = null;
        // CONFIRMED: recorded as the positive evidence of what serves BEFORE
        // the claim goes; a record that could not be written keeps the claim,
        // and the tick puts it up and records it.
        const marked = c.ready ? await markPreviewUp(deps, slug, c.version, clock()) : false;
        if (c.ready && marked) {
          await unclaim();
          try { others = (await previewClaims(deps, slug)).filter((x) => x.key !== claim.key); } catch { others = null; }
        }
        const ready = c.ready && marked && Array.isArray(others) && others.length === 0;
        const error = c.error || (!ready && c.ready ? (!marked ? "the preview is up, but that could not be recorded" : others === null ? "the preview's other uploads could not be read" : "another upload of the preview may still land") : "");
        previewed = {
          ok: ready, version: c.version, superseded: !!c.version && c.version !== version, repaired: c.repaired,
          pending: !ready, recoverable: !ready, ...(error ? { error } : {}),
        };
      }
    }
  }
  if (typeof commit === "function") await commit();
  return { ok: true, draft: true, version, uploaded: false, older: !!rec.older, record: rec.draft, revision: rec.revision || (rec.draft && rec.draft.rev) || 0, previewed, ...(rec.reconciled ? { reconciled: true } : {}) };
}

// ── HELD CHANGES: THE BACKEND AND THE LIBRARY (2026-10-15) ──────────────────
//
// A site that is live has one database and one library, which visitors use
// now. Under draft-first, what a task changes there on a published site is
// HELD: kept as a journal in the draft, read by the next task and by the
// preview as if it had been made, and applied to the live database and
// library only by the owner's Publish of a revision that carries it. Before a
// site's first publication nobody uses its database or library, so a task
// writes them directly — except scheduled jobs, which would run by
// themselves: those are always held until the first Publish.
//
// An op is one of:
//   { kind: "schema", spec }            the merged schema (the latest wins)
//   { kind: "jobs", jobs }              the scheduled jobs (the latest wins)
//   { kind: "seed", spec, seed }        starter rows for tables (seeded only when empty)
//   { kind: "row", table, op: "insert", values, ref }
//   { kind: "row", table, op: "update", id | ref, values }
//   { kind: "row", table, op: "remove", id | ref }
//   { kind: "media-replace", name, with }   a file's new bytes, uploaded under another name
//   { kind: "media-delete", name }          a video or recording taken off
//   { kind: "upload-delete", file }         a picture or document taken off
//   { kind: "alias", action: "rename", from, to }   the site's address, moved
//   { kind: "alias", action: "forget", name }       an old address, let go
const HELD_ID = /^[a-f0-9]{24}$/;
const REF = /^[a-f0-9]{24}:\d{1,4}$/;
export const HELD_KINDS = Object.freeze(["schema", "jobs", "seed", "row", "media-replace", "media-delete", "upload-delete", "alias"]);

/**
 * One task's holding place: ops collected in memory, written once (`flush`)
 * as an immutable journal when the task saves its revision. A task that
 * fails holds nothing: its ops are never written.
 */
export function newHold(deps, slug, { id = randomHex(12) } = {}) {
  const ops = [];
  let written = null;
  return {
    id,
    ops,
    add(op) {
      if (written) throw new Error("this hold was already written");
      if (!op || !HELD_KINDS.includes(op.kind)) throw new Error("not a held op: " + JSON.stringify(op));
      if (op.kind === "row" && op.op === "insert" && !op.ref) op = { ...op, ref: id + ":" + ops.filter((o) => o.kind === "row" && o.op === "insert").length };
      ops.push(op);
      return op;
    },
    get empty() { return ops.length === 0; },
    async flush() {
      if (written) return written;
      if (!ops.length) return null;
      const put = await deps.put(HELD_KEY(slug, id), JSON.stringify({ v: 1, id, ops }), "application/json", { etagDoesNotMatch: "*" });
      if (!put) throw new Error("held changes could not be written");
      written = { id, ops: ops.slice() };
      return written;
    },
  };
}

/**
 * THE HELD OPS OF REVISIONS (from, to], in order: `[{ n, ops }]`. Throws when
 * a journal a revision names cannot be read — cannot-tell is never "nothing
 * held".
 *
 * ONE CUMULATIVE RECORD, NOT ONE READ PER REVISION (2026-10-16, Codex's review
 * of `44676fcd`). With no count limit on the draft, reading every journal on
 * every read made the preview's data, the next task and publication cost one
 * storage read per held revision — measured: 10, 100, 500 and 1,000 reads for
 * as many revisions, on every read. The unpublished held ops are now also kept
 * together (`HELD_SUM_KEY`): each revision's entry `{ n, held, count }` and
 * the ops in order. It is a cache that is never trusted beyond what it can
 * prove: an entry is used for a revision only when both its number and its
 * journal id match the draft's revision, and journals are immutable and named
 * by a random id, so a matching entry holds exactly that journal's ops. A
 * revision with no matching entry is read from its journal, as before, and
 * the record is rewritten (conditionally; a write that loses is simply not
 * kept) with every unpublished revision now known — entries at or below
 * `applied` dropped, so a publication shrinks it rather than invalidating it.
 * Exact revision ranges, the journals themselves and recovery's reads of
 * them are unchanged. Reads now cost the record plus one read per revision
 * not yet in it.
 */
export const HELD_SUM_KEY = (slug) => "site-drafts/" + slug + "/held-sum.json";
// THE OBJECT'S ETAG IS KEPT WHATEVER ITS BODY SAYS (2026-10-16, Codex's review
// of `668ebc87`): a record that would not parse used to come back with no etag,
// so the rewrite was create-only against an object that existed — refused
// every time, and every read paid one journal read per revision for ever. A
// body that cannot be used is replaced, conditionally on the object read; only
// a read that failed outright leaves no etag (and then nothing is written over
// what could not be seen: the create-only write simply loses).
async function readHeldSum(deps, slug) {
  let o;
  try { o = await deps.get(HELD_SUM_KEY(slug)); } catch { return { sum: null, etag: null, unread: true }; }
  if (!o) return { sum: null, etag: null };
  const etag = String(o.etag || "") || null;
  try {
    const t = await o.text();
    if (isHeldObject(o, t)) return { sum: null, etag };
    const j = JSON.parse(t);
    if (!j || !Array.isArray(j.entries) || !Array.isArray(j.ops)) return { sum: null, etag };
    // THE ENTRIES MUST ACCOUNT FOR THE OPS EXACTLY, or none of it is used.
    let at = 0;
    const map = new Map();
    for (const e of j.entries) {
      if (!e || !Number.isSafeInteger(e.n) || typeof e.held !== "string" || !HELD_ID.test(e.held) || !Number.isSafeInteger(e.count) || e.count < 0) return { sum: null, etag };
      map.set(e.n, { held: e.held, ops: j.ops.slice(at, at + e.count) });
      at += e.count;
    }
    if (at !== j.ops.length) return { sum: null, etag };
    return { sum: map, etag };
  } catch { return { sum: null, etag }; }
}
export async function heldRange(deps, slug, draft, { from = 0, to = Infinity } = {}) {
  const out = [];
  if (!draft) return out;
  const { sum, etag } = await readHeldSum(deps, slug);
  const known = new Map();
  let learned = false;
  // EVERY UNPUBLISHED HELD REVISION is resolved (the range asked for is a
  // slice of them), so the record written back covers the whole draft.
  const lo = Math.min(from, draft.applied);
  for (const r of draft.revs) {
    if (r.n <= lo || !r.held) continue;
    const e = sum && sum.get(r.n);
    if (e && e.held === r.held) { known.set(r.n, e.ops); continue; }
    if (r.n <= from || r.n > to) continue;
    const o = await deps.get(HELD_KEY(slug, r.held));
    if (!o) throw new Error("held changes missing: revision " + r.n);
    const j = JSON.parse(await o.text());
    if (!j || !Array.isArray(j.ops)) throw new Error("held changes unreadable: revision " + r.n);
    known.set(r.n, j.ops.filter((x) => x && HELD_KINDS.includes(x.kind)));
    learned = true;
  }
  for (const r of draft.revs) {
    if (r.n <= from || r.n > to || !r.held) continue;
    out.push({ n: r.n, ops: known.get(r.n) });
  }
  // THE RECORD, REWRITTEN when it learned a revision or holds published ones.
  const keep = draft.revs.filter((r) => r.held && r.n > draft.applied && known.has(r.n));
  const stale = !!sum && [...sum.keys()].some((n) => n <= draft.applied || !keep.some((r) => r.n === n));
  // AN UNUSABLE RECORD STANDING (it exists, its body could not be used) is
  // replaced even when nothing new was learned, so the next read uses it.
  const unusable = !sum && !!etag;
  if ((learned || stale || unusable) && typeof deps.put === "function") {
    const body = { v: 1, entries: keep.map((r) => ({ n: r.n, held: r.held, count: known.get(r.n).length })), ops: keep.flatMap((r) => known.get(r.n)) };
    try { await deps.put(HELD_SUM_KEY(slug), JSON.stringify(body), "application/json", etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" }); } catch { /* a cache: the journals stand */ }
  }
  return out;
}
/** Every unpublished held op of the draft, flattened in order (what the next task and the preview read). */
export async function unpublishedOps(deps, slug, draft) {
  if (!draft) return [];
  return (await heldRange(deps, slug, draft, { from: draft.applied })).flatMap((r) => r.ops);
}

/**
 * TWO SPECS AS ONE, BY NAME (2026-10-18, audit A06-3 and A04-1): tables,
 * functions, outside connections and jobs keyed by lower-cased name, the
 * later entry winning; every other key from `next`. A held change adds to the
 * schema the draft already has, never replaces it — so an empty later spec
 * keeps what came before. No `base` answers `next`.
 */
export const SPEC_LISTS = ["tables", "functions", "apis", "jobs"];
function byName(a, b) {
  const m = new Map();
  for (const x of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (x && typeof x === "object" && x.name) m.set(String(x.name).toLowerCase(), x);
  }
  return [...m.values()];
}
export function mergeSpec(base, next) {
  if (!base || typeof base !== "object") return next;
  if (!next || typeof next !== "object") return base;
  const out = { ...next };
  for (const k of SPEC_LISTS) {
    if (!Array.isArray(base[k]) && !Array.isArray(next[k])) continue;
    out[k] = byName(base[k], next[k]);
  }
  return out;
}

/**
 * WHAT A REVISE BUILD HOLDS (2026-10-18, A06-3 writer): its own spec merged
 * by name over the draft's overlay, so the held op never names fewer tables
 * than the draft has; `null` when it declares no table, function or api,
 * because there is nothing to apply. No overlay readable: its spec as given.
 */
export function reviseHeldSpec(overlay, spec) {
  const s = spec && typeof spec === "object" ? spec : {};
  if (!["tables", "functions", "apis"].some((k) => Array.isArray(s[k]) && s[k].length)) return null;
  return overlay && typeof overlay === "object" ? mergeSpec(overlay, s) : s;
}

/**
 * STARTER ROWS HAVE REFS (2026-10-18, A28-3): each row of a held seed op is
 * `seed:<table>:<n>:<place>` (n: the how-manyth held seed op for that table,
 * place: the row's index in it), so a later held update or removal of a
 * starter row names it and is folded into it at Publish, never sent as a
 * negative id that matches nothing live.
 */
const DROPPED = Symbol("dropped");
export const STARTER_MISSING = "a held change names a starter row that cannot be found";
function forSeedRows(o, count, each) {
  if (!o.seed || typeof o.seed !== "object") return;
  for (const t of Object.keys(o.seed)) {
    if (!Array.isArray(o.seed[t])) continue;
    const n = count.get(t) || 0;
    count.set(t, n + 1);
    o.seed[t].forEach((v, place) => { if (v && typeof v === "object") each("seed:" + t + ":" + n + ":" + place, t, v, place); });
  }
}

/**
 * THE HELD OPS COMBINED, ONE FUNCTION FOR EVERY READER (2026-10-18): the
 * schema over `liveSpec` and the jobs, each merged by name in order, skipping
 * any op whose `key` is in `setAside` (and every op after `upTo`, when given).
 * `spec` is `liveSpec` when no schema op is held; `jobs` is null when no jobs
 * op is held.
 */
export function combineHeld(liveSpec, ops, { upTo, setAside = [] } = {}) {
  const aside = new Set(Array.isArray(setAside) ? setAside : []);
  let spec = liveSpec, jobs = null, held = false;
  const seedRefs = new Set(), seedCount = new Map();
  const list = Array.isArray(ops) ? ops : [];
  const end = Number.isInteger(upTo) ? Math.min(upTo, list.length) : list.length;
  for (let i = 0; i < end; i++) {
    const o = list[i];
    if (!o || (o.key !== undefined && aside.has(o.key))) continue;
    if (o.kind === "schema" && o.spec && typeof o.spec === "object") { spec = held ? mergeSpec(spec, o.spec) : mergeSpec(liveSpec, o.spec); held = true; }
    else if (o.kind === "jobs") jobs = byName(jobs, Array.isArray(o.jobs) ? o.jobs : []);
    else if (o.kind === "seed") forSeedRows(o, seedCount, (ref) => seedRefs.add(ref));
    else if (o.kind === "row" && o.op !== "insert" && !o.ref && Number(o.id) < 0) return { ok: false, error: STARTER_MISSING };
    else if (o.kind === "row" && typeof o.ref === "string" && o.ref.startsWith("seed:") && !seedRefs.has(o.ref)) return { ok: false, error: STARTER_MISSING };
  }
  return { ok: true, spec, jobs, held };
}

/** The schema as the draft has it: the held schemas merged by name over the live one. */
export function specOverlay(liveSpec, ops) {
  return combineHeld(liveSpec, ops).spec;
}

/**
 * A TABLE'S ROWS AS THE DRAFT HAS THEM: the live rows with the held row
 * changes and starter rows applied. A held new row has a negative id (its
 * place among the held inserts), and `tempRefs` maps it back to the insert
 * it came from, so a task that changes it changes that insert.
 */
export function rowsOverlay(table, rows, ops, { tableExists = true } = {}) {
  const t = String(table || "");
  let out = (Array.isArray(rows) ? rows : []).map((r) => ({ ...r }));
  const tempRefs = new Map();
  const tempOf = new Map();
  let nextTemp = -1;
  const seedCount = new Map();
  for (const o of ops || []) {
    if (o.kind === "seed") {
      const show = !tableExists && !out.length;
      forSeedRows(o, seedCount, (ref, st, v) => {
        if (!show || st !== t) return;
        const id = nextTemp--;
        tempRefs.set(id, ref);
        tempOf.set(ref, id);
        out.push({ ...v, id });
      });
      continue;
    }
    if (o.kind !== "row" || o.table !== t) continue;
    if (o.op === "insert") {
      const id = nextTemp--;
      tempRefs.set(id, o.ref);
      tempOf.set(o.ref, id);
      out.push({ ...(o.values || {}), id });
      continue;
    }
    const target = o.ref ? tempOf.get(o.ref) : o.id;
    if (target === undefined) continue;
    if (o.op === "remove") out = out.filter((r) => Number(r.id) !== Number(target));
    else if (o.op === "update") out = out.map((r) => (Number(r.id) === Number(target) ? { ...r, ...(o.values || {}) } : r));
  }
  return { rows: out, tempRefs };
}

/**
 * WHAT A PUBLICATION OF THESE OPS DOES, in the order it is done: the held
 * schemas and jobs merged by name, the starter rows, the row changes (updates and
 * removals of rows the live database has, by id; a change to a row held as
 * new folded into its insert, or — when that insert was published earlier —
 * to the id it was given, `refs`), the inserts, and the library changes.
 * `{ ok, plan }` or `{ ok: false, error }` for a change whose row cannot be
 * found.
 */
export function publishPlan(ops, { refs = {} } = {}) {
  const plan = { spec: null, jobs: null, seeds: [], changes: [], inserts: [], media: [], alias: [] };
  const inserts = new Map();
  const starters = new Map(), seedCount = new Map();
  for (const o of ops || []) {
    // HELD SCHEMAS AND JOBS MERGE BY NAME (2026-10-18, A06-3, A04-1): a later
    // op adds to the earlier ones, never replaces them.
    if (o.kind === "schema") plan.spec = plan.spec ? mergeSpec(plan.spec, o.spec) : o.spec;
    else if (o.kind === "jobs") plan.jobs = byName(plan.jobs, Array.isArray(o.jobs) ? o.jobs : []);
    else if (o.kind === "seed") {
      // STARTER ROWS ARE COPIED SO A HELD CHANGE CAN FOLD INTO ONE (A28-3).
      const seed = {};
      for (const t of Object.keys(o.seed || {})) seed[t] = Array.isArray(o.seed[t]) ? o.seed[t].map((v) => (v && typeof v === "object" ? { ...v } : v)) : o.seed[t];
      plan.seeds.push({ spec: o.spec, seed });
      forSeedRows(o, seedCount, (ref, t, v, place) => starters.set(ref, { rows: seed[t], place }));
    }
    else if (o.kind === "media-replace" || o.kind === "media-delete" || o.kind === "upload-delete") plan.media.push(o);
    else if (o.kind === "alias") plan.alias.push(o);
    else if (o.kind === "row") {
      if (o.op === "insert") { inserts.set(o.ref, { table: o.table, values: { ...(o.values || {}) }, ref: o.ref }); continue; }
      if (o.ref && starters.has(o.ref)) {
        const st = starters.get(o.ref);
        if (st.rows[st.place] === DROPPED) return { ok: false, error: STARTER_MISSING };
        if (o.op === "remove") st.rows[st.place] = DROPPED;
        else Object.assign(st.rows[st.place], o.values || {});
        continue;
      }
      if (typeof o.ref === "string" && o.ref.startsWith("seed:")) return { ok: false, error: STARTER_MISSING };
      if (o.ref) {
        const ins = inserts.get(o.ref);
        if (ins) {
          if (o.op === "remove") inserts.delete(o.ref);
          else Object.assign(ins.values, o.values || {});
          continue;
        }
        if (!Object.hasOwn(refs, o.ref)) return { ok: false, error: "a held change names a new row that was never published (" + o.ref + ")" };
        plan.changes.push({ table: o.table, op: o.op, id: refs[o.ref], values: o.values || {} });
        continue;
      }
      // A NEGATIVE ID IS A HELD ROW'S PLACE, NEVER A LIVE ROW (A28-3).
      if (Number(o.id) < 0) return { ok: false, error: STARTER_MISSING };
      plan.changes.push({ table: o.table, op: o.op, id: o.id, values: o.values || {} });
    }
  }
  for (const sd of plan.seeds) for (const t of Object.keys(sd.seed)) if (Array.isArray(sd.seed[t])) sd.seed[t] = sd.seed[t].filter((v) => v !== DROPPED);
  plan.inserts = [...inserts.values()];
  // SEVERAL MOVES OF THE ADDRESS ARE ONE: from where it was to where the last
  // one put it — so a name only the draft ever had never becomes a redirect.
  // A move back to where it started is no move. Forgets stay as they are.
  const moves = plan.alias.filter((a) => a.action === "rename");
  if (moves.length) {
    const from = moves[0].from, to = moves[moves.length - 1].to;
    plan.alias = [...(from !== to ? [{ kind: "alias", action: "rename", from, to }] : []), ...plan.alias.filter((a) => a.action !== "rename")];
  }
  return { ok: true, plan };
}

function randomHex(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * THE SITE'S ADDRESS AS THE DRAFT HAS IT: the last held rename's new name, or
 * `live` (the name it answers to now). A forget does not move the address.
 */
export function addressOverlay(live, ops) {
  let name = live;
  for (const o of ops || []) if (o.kind === "alias" && o.action === "rename" && typeof o.to === "string") name = o.to;
  return name;
}
/** The names the draft lets go of (held forgets), and any later rename back to one of them cancels it. */
export function forgottenInDraft(ops) {
  const out = new Set();
  for (const o of ops || []) {
    if (o.kind !== "alias") continue;
    if (o.action === "forget" && typeof o.name === "string") out.add(o.name);
    if (o.action === "rename" && typeof o.to === "string") out.delete(o.to);
  }
  return out;
}

// ── THE PUBLICATION, AS PHASES (2026-10-15, the owner's coherence correction;
// recovery corrected after Codex's two reproductions) ────────────────────────
//
// A database and a site script cannot change in one atomic step, so a
// publication is a journal of phases. EVERY SIDE EFFECT IS PRECEDED BY A
// CHECKPOINT THAT NAMES IT, so a runner that stops anywhere leaves a journal
// that says what MAY have happened, and recovery asks the world what did:
//   start     — preflight: nothing written. A refusal here changes nothing.
//   prepared  — what no visitor of the live version can see is in place:
//               tables the live site does not have yet, and their starter rows.
//   switching — THE INTENT, stored before the pointer and script move, with
//               the live version it replaces (`from`). A journal in this phase
//               may or may not be live: recovery reads the pointer — on the
//               approved version, the switch happened; still on `from`, the
//               switch is made (it was approved); anything else, the live site
//               moved on and the publication is set aside.
//   switched  — the approved version is live. From here the publication only
//               rolls FORWARD, step by recorded step.
//   finished  — every change applied and the draft record marked; the journal
//               stays as a tombstone (below).
//   retired   — set aside before anything of it went live.
// A journal is NEVER DELETED: R2 has no conditional delete, so a read-then-
// delete can remove a journal another runner wrote in between. Retiring is a
// conditional write (on the etag the retiring runner holds) of `finished` or
// `retired`, and a new publication is written conditionally over it.
export const PUBLICATION_PHASES = Object.freeze(["start", "prepared", "switching", "switched", "finished", "retired"]);
/** Phases after which nothing remains to be done. */
export const CLOSED_PHASES = Object.freeze(["finished", "retired"]);
/** The steps after the switch, in order. */
export const FINISH_STEPS = Object.freeze(["address", "schema", "jobs", "seeds", "changes", "inserts", "library"]);
/** A journal entry for the owner's click on revision `n` of `version`. */
export function newJournal({ slug, n, version, uid = "", now = Date.now(), id }) {
  return { v: 1, slug, n, version, uid: String(uid || ""), id, running: true, at: now, phase: "start", from: null, done: [], refs: {}, error: null, attempts: 0 };
}
/** A journal as stored, read strictly: null when it is not one. */
export function readJournal(t) {
  let j;
  try { j = typeof t === "string" ? JSON.parse(t) : t; } catch { return null; }
  if (!j || typeof j !== "object" || !Number.isSafeInteger(j.n) || !isDraftVersion(j.version) || !PUBLICATION_PHASES.includes(j.phase)) return null;
  // THE VERSION IT REPLACES must be known to a switch: "" (no live version) or a version.
  if (j.phase === "switching" && !(j.from === "" || isDraftVersion(j.from))) return null;
  return {
    ...j,
    from: j.from === "" || isDraftVersion(j.from) ? j.from : null,
    done: Array.isArray(j.done) ? j.done.filter((d) => typeof d === "string") : [],
    refs: j.refs && typeof j.refs === "object" && !Array.isArray(j.refs) ? j.refs : {},
    running: j.running === true, at: Number(j.at) || 0, attempts: Number(j.attempts) || 0,
  };
}
/** Is nothing left to do for this journal? */
export const journalClosed = (j) => !j || CLOSED_PHASES.includes(j.phase);
// ── A STOP THAT WILL NOT CLEAR ON ITS OWN (2026-10-18, audit A06-4/A09-3) ────
// Postgres refusing a held value (class 22), a rule (class 23), or a table or
// column that is not there is the same answer every time it is asked; asked
// again every two minutes it never finishes, and every later Publish meets
// it first. Such a stop is BLOCKED: kept with its reason, never retried by the
// sweep, and said to the owner. Anything else is temporary and is retried on a
// doubling pause — 2, 4, 8 … minutes, never more than 30 — and blocked after
// `PUBLISH_MAX_ATTEMPTS`.
export const PUBLISH_MAX_ATTEMPTS = 8;
export function publishStopKind(e) {
  const code = e && typeof e.code === "string" ? e.code : "";
  return /^(22|23)[0-9A-Z]{3}$/.test(code) || code === "42P01" || code === "42703" ? "permanent" : "temporary";
}
/** When a temporary stop is tried again, after its `attempts`-th failure. */
export const publishNextTry = (attempts, now) => now + Math.min(2 ** Math.max(0, attempts - 1) * 2 * 60 * 1000, 30 * 60 * 1000);
/** Is this journal stopped on something it cannot finish by itself? */
export const journalBlocked = (j) => !!(j && !journalClosed(j) && j.blocked && typeof j.blocked === "object");
/** Is this journal's publication being run right now (a runner that has written within `staleMs`)? */
export const journalLive = (j, { now = Date.now(), staleMs } = {}) => !!(j && !journalClosed(j) && j.running && j.at > now - staleMs);
/** May any of this journal's revision be live? (`switching` may; `switched` is.) */
export const journalMayBeLive = (j) => !!(j && (j.phase === "switching" || j.phase === "switched"));
/**
 * WHAT A CLICK ON REVISION `n` DOES, given the journal that stands:
 *   start      — none stands, or it is closed: begin one (written over it);
 *   busy       — one is running now (202 for the same revision, 409 another);
 *   resume     — the same revision stopped, or its runner died: carry it on;
 *   finishFirst— another revision that may be live did not finish: finish (or
 *                reconcile) that one — it was approved — before this one;
 *   replace    — another revision stopped before its intent to switch: nothing
 *                of it is live, so it is set aside.
 */
export function clickPlan(j, n, { now = Date.now(), staleMs } = {}) {
  if (journalClosed(j)) return "start";
  if (journalLive(j, { now, staleMs })) return "busy";
  if (j.n === n) return "resume";
  // A BLOCKED REVISION IS NEVER RUN AGAIN FOR ANOTHER ONE'S CLICK: it would
  // stop the same way, and the newer revision behind it every time.
  if (journalBlocked(j)) return "blocked";
  return journalMayBeLive(j) ? "finishFirst" : "replace";
}
