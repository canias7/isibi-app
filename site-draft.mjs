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
  const d = JSON.parse(await o.text());
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
    if (draft && draft.version >= version) {
      // A NEWER DRAFT ALREADY STANDS: this version is kept in its history only;
      // its held changes, if any, are the next revision on the newest code.
      const keep = { ...draftRecordOut(draft), history: [...draft.history.filter((v) => v !== version), ...(draft.version === version ? [] : [version])].sort().slice(-20) };
      if (heldRef) Object.assign(keep, addRevision(draft, { version: draft.version, held: heldRef, job, at }));
      const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(keep), "application/json", { etagMatches: etag });
      if (put) return { ok: true, draft: readBack(keep), older: draft.version !== version, revision: keep.rev };
      continue;
    }
    const rec = {
      v: 2, version, build: String(build || ""), base: isDraftVersion(base) ? base : "", job: job ? String(job) : null, at,
      history: history.slice(-20), preview: (draft && draft.preview) || token(),
      ...addRevision(draft, { version, held: heldRef, job, at }),
    };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" });
    if (put) return { ok: true, draft: readBack(rec), revision: rec.rev };
  }
  return { ok: false, error: "the draft kept changing under this save" };
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
    if (put) return { ok: true, draft: readBack(rec), revision: rec.rev };
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
    const rec = { ...draftRecordOut(draft), applied: revision, refs: { ...draft.refs, ...refs } };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", { etagMatches: etag });
    if (put) return { ok: true, draft: readBack(rec) };
  }
  return { ok: false, error: "the draft kept changing under this save" };
}

// ── REVISIONS ────────────────────────────────────────────────────────────────
const MAX_REVS = 60;
function readRevisions(d) {
  const revs = (Array.isArray(d.revs) ? d.revs : [])
    .filter((r) => r && Number.isSafeInteger(r.n) && r.n > 0 && isDraftVersion(r.version))
    .map((r) => ({ n: r.n, version: r.version, at: typeof r.at === "string" ? r.at : "", job: typeof r.job === "string" ? r.job : null, held: typeof r.held === "string" && HELD_ID.test(r.held) ? r.held : null, ops: Number.isSafeInteger(r.ops) ? r.ops : 0 }))
    .sort((a, b) => a.n - b.n).slice(-MAX_REVS);
  // A RECORD WRITTEN BEFORE REVISIONS (the first draft-first commit): its
  // draft is revision 1, nothing published through it.
  if (!revs.length && isDraftVersion(d.version)) revs.push({ n: 1, version: d.version, at: typeof d.at === "string" ? d.at : "", job: null, held: null, ops: 0 });
  const rev = Math.max(Number.isSafeInteger(d.rev) ? d.rev : 0, revs.length ? revs[revs.length - 1].n : 0);
  const applied = Number.isSafeInteger(d.applied) && d.applied >= 0 ? Math.min(d.applied, rev) : 0;
  const refs = {};
  if (d.refs && typeof d.refs === "object" && !Array.isArray(d.refs)) {
    for (const [k, v] of Object.entries(d.refs)) if (REF.test(k) && Number.isSafeInteger(v)) refs[k] = v;
  }
  return { rev, revs, applied, refs };
}
function addRevision(draft, { version, held = null, job = null, at, applied = null }) {
  const prev = draft ? draft.revs : [];
  const n = (draft ? draft.rev : 0) + 1;
  const r = { n, version, at, job: job ? String(job) : null, held: held ? held.id : null, ops: held && Array.isArray(held.ops) ? held.ops.length : 0 };
  return { rev: n, revs: [...prev, r].slice(-MAX_REVS), applied: applied !== null ? applied : draft ? draft.applied : 0, refs: draft ? draft.refs : {} };
}
/** The record as stored, from what `readDraft` answered. */
function draftRecordOut(d) {
  return { v: 2, version: d.version, build: d.build, base: d.base, job: d.job, at: d.at, history: d.history, preview: d.preview, rev: d.rev, revs: d.revs, applied: d.applied, refs: d.refs };
}
function readBack(rec) {
  return { version: rec.version, build: rec.build || "", base: rec.base || "", job: rec.job || null, at: rec.at || "", history: rec.history || [], preview: rec.preview || "", ...readRevisions(rec) };
}

/** A revision of this record, by its number, or null. */
export function revisionOf(draft, n) {
  if (!draft || !Number.isSafeInteger(n)) return null;
  return draft.revs.find((r) => r.n === n) || null;
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
export async function saveAsDraft(deps, { slug, version, build = "", base = "", job = null, afterActivate, commit, preview, held = null } = {}) {
  let rec;
  try {
    // THE TASK'S HELD BACKEND AND LIBRARY CHANGES go into the same revision as
    // its code (2026-10-15): written first, immutable, named by the record.
    // A HOLD (its ops written now) or a reference already written (a build
    // whose generation finished in a later invocation carries `{ id, ops }`).
    let ref = held && typeof held.flush === "function" ? await held.flush()
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
    if (e && e.code === "TURN_FENCED") throw e;
    return { ok: false, error: "draft: " + String((e && e.message) || e) };
  }
  if (!rec.ok) return { ok: false, error: rec.error || "draft" };
  if (!rec.older && typeof afterActivate === "function") await afterActivate();
  let previewed = null;
  if (typeof preview === "function") {
    try { previewed = await preview(rec.draft); } catch (e) { previewed = { ok: false, error: String((e && e.message) || e) }; }
  }
  if (typeof commit === "function") await commit();
  return { ok: true, draft: true, version, uploaded: false, older: !!rec.older, record: rec.draft, revision: rec.revision || (rec.draft && rec.draft.rev) || 0, previewed };
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
 */
export async function heldRange(deps, slug, draft, { from = 0, to = Infinity } = {}) {
  const out = [];
  if (!draft) return out;
  for (const r of draft.revs) {
    if (r.n <= from || r.n > to || !r.held) continue;
    const o = await deps.get(HELD_KEY(slug, r.held));
    if (!o) throw new Error("held changes missing: revision " + r.n);
    const j = JSON.parse(await o.text());
    if (!j || !Array.isArray(j.ops)) throw new Error("held changes unreadable: revision " + r.n);
    out.push({ n: r.n, ops: j.ops.filter((x) => x && HELD_KINDS.includes(x.kind)) });
  }
  return out;
}
/** Every unpublished held op of the draft, flattened in order (what the next task and the preview read). */
export async function unpublishedOps(deps, slug, draft) {
  if (!draft) return [];
  return (await heldRange(deps, slug, draft, { from: draft.applied })).flatMap((r) => r.ops);
}

/** The schema as the draft has it: the latest held schema, or the live one. */
export function specOverlay(liveSpec, ops) {
  let spec = liveSpec;
  for (const o of ops || []) if (o.kind === "schema" && o.spec && typeof o.spec === "object") spec = o.spec;
  return spec;
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
  for (const o of ops || []) {
    if (o.kind === "seed" && !tableExists && !out.length && o.seed && Array.isArray(o.seed[t])) {
      for (const v of o.seed[t]) if (v && typeof v === "object") out.push({ ...v, id: nextTemp-- });
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
 * WHAT A PUBLICATION OF THESE OPS DOES, in the order it is done: the latest
 * schema, the latest jobs, the starter rows, the row changes (updates and
 * removals of rows the live database has, by id; a change to a row held as
 * new folded into its insert, or — when that insert was published earlier —
 * to the id it was given, `refs`), the inserts, and the library changes.
 * `{ ok, plan }` or `{ ok: false, error }` for a change whose row cannot be
 * found.
 */
export function publishPlan(ops, { refs = {} } = {}) {
  const plan = { spec: null, jobs: null, seeds: [], changes: [], inserts: [], media: [], alias: [] };
  const inserts = new Map();
  for (const o of ops || []) {
    if (o.kind === "schema") plan.spec = o.spec;
    else if (o.kind === "jobs") plan.jobs = Array.isArray(o.jobs) ? o.jobs : [];
    else if (o.kind === "seed") plan.seeds.push({ spec: o.spec, seed: o.seed });
    else if (o.kind === "media-replace" || o.kind === "media-delete" || o.kind === "upload-delete") plan.media.push(o);
    else if (o.kind === "alias") plan.alias.push(o);
    else if (o.kind === "row") {
      if (o.op === "insert") { inserts.set(o.ref, { table: o.table, values: { ...(o.values || {}) }, ref: o.ref }); continue; }
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
      plan.changes.push({ table: o.table, op: o.op, id: o.id, values: o.values || {} });
    }
  }
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

// ── THE PUBLICATION, AS PHASES (2026-10-15, the owner's coherence correction) ──
//
// A database and a site script cannot change in one atomic step, so a
// publication is a journal of phases, each recorded before the next:
//   start     — preflight: nothing written. A refusal here changes nothing.
//   prepared  — what no visitor of the live version can see is in place:
//               tables the live site does not have yet, and their starter rows.
//   switched  — the approved version is live (pointer and script, through the
//               conditional activation and its own undo). From here the
//               publication only rolls FORWARD.
//   finished  — every remaining change applied; the draft record says so.
// Before `switched` a stop leaves the live site as it was (the prepared new
// tables are unused by it). After `switched` the remaining steps are each
// repeatable or exactly-once, recorded in `done`, and a stop is finished —
// by the owner's next click or by the recovery sweep — never undone, and never
// with any revision but the one the click named.
export const PUBLICATION_PHASES = Object.freeze(["start", "prepared", "switched", "finished"]);
/** The steps after the switch, in order. */
export const FINISH_STEPS = Object.freeze(["address", "schema", "jobs", "seeds", "changes", "inserts", "library"]);
/** A journal entry for the owner's click on revision `n` of `version`. */
export function newJournal({ slug, n, version, uid = "", now = Date.now(), id }) {
  return { v: 1, slug, n, version, uid: String(uid || ""), id, running: true, at: now, phase: "start", done: [], refs: {}, error: null, attempts: 0 };
}
/** A journal as stored, read strictly: null when it is not one. */
export function readJournal(t) {
  let j;
  try { j = typeof t === "string" ? JSON.parse(t) : t; } catch { return null; }
  if (!j || typeof j !== "object" || !Number.isSafeInteger(j.n) || !isDraftVersion(j.version) || !PUBLICATION_PHASES.includes(j.phase)) return null;
  return {
    ...j,
    done: Array.isArray(j.done) ? j.done.filter((d) => typeof d === "string") : [],
    refs: j.refs && typeof j.refs === "object" && !Array.isArray(j.refs) ? j.refs : {},
    running: j.running === true, at: Number(j.at) || 0, attempts: Number(j.attempts) || 0,
  };
}
/** Is this journal's publication being run right now (a runner that has written within `staleMs`)? */
export const journalLive = (j, { now = Date.now(), staleMs } = {}) => !!(j && j.running && j.at > now - staleMs);
/**
 * WHAT A CLICK ON REVISION `n` DOES, given the journal that stands:
 *   start      — no publication stands: begin one;
 *   busy       — one is running now (202 for the same revision, 409 another);
 *   resume     — the same revision stopped, or its runner died: carry it on;
 *   finishFirst— another revision already switched and did not finish: finish
 *                that one (it was approved) before beginning this one;
 *   replace    — another revision stopped before its switch: nothing of it is
 *                live, so it is set aside.
 */
export function clickPlan(j, n, { now = Date.now(), staleMs } = {}) {
  if (!j || j.phase === "finished") return "start";
  if (journalLive(j, { now, staleMs })) return "busy";
  if (j.n === n) return "resume";
  return j.phase === "switched" ? "finishFirst" : "replace";
}
