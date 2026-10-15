// THE DRAFT, AND THE ONE DOOR TO THE LIVE SITE (owner, 2026-10-15).
//
// "Only an explicit click on the Publish button may make changes live."
// Build, Edit, Add-on — and every parallel task, recovery, answered
// question and finished chain — save their result as a DRAFT: a staged
// version (`builds/<slug>/<version>/`, immutable once its manifest lands)
// named by the draft record `drafts/<slug>.json`, with its own preview. The
// live site — the pointer, the site script, the sidecar, the live marker —
// moves only when the owner presses Publish, and then to exactly the version
// they approved: the version is named by the click, staged builds never
// change, so a task still running, or an edit made after, is a later draft
// and cannot slip into that publication.
//
// Pure helpers over a `deps` of `{ get, put }` (R2-shaped), so the Worker and
// the tests read and write the record the same way.

export const DRAFT_KEY = (slug) => "drafts/" + slug + ".json";
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
 */
export async function saveDraftRecord(deps, slug, { version, build = "", base = "", job = null, now = () => new Date(), token = newPreviewToken }) {
  if (!isDraftVersion(version)) throw new Error("not a version: " + version);
  for (let i = 0; i < 6; i++) {
    const { draft, etag } = await readDraft(deps, slug);
    if (draft && draft.version === version) return { ok: true, draft, same: true };
    const history = draft ? [...draft.history.filter((v) => v !== draft.version && v !== version), draft.version] : [];
    if (draft && draft.version > version) {
      // A NEWER DRAFT ALREADY STANDS: this one is kept in its history only.
      const keep = { ...draft, history: [...draft.history.filter((v) => v !== version), version].sort().slice(-20) };
      const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(keep), "application/json", { etagMatches: etag });
      if (put) return { ok: true, draft: keep, older: true };
      continue;
    }
    const rec = { v: 1, version, build: String(build || ""), base: isDraftVersion(base) ? base : "", job: job ? String(job) : null, at: now().toISOString(), history: history.slice(-20), preview: (draft && draft.preview) || token() };
    const put = await deps.put(DRAFT_KEY(slug), JSON.stringify(rec), "application/json", etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" });
    if (put) return { ok: true, draft: rec };
  }
  return { ok: false, error: "the draft kept changing under this save" };
}

/** May `version` be published from this draft record? The draft itself, or one of its saved predecessors. */
export function publishable(draft, version) {
  if (!draft || !isDraftVersion(version)) return false;
  return draft.version === version || draft.history.includes(version);
}

/**
 * WHAT THE OWNER SEES: `published` (nothing saved beyond the live version),
 * `saved` (a draft newer than the live site, nothing running), `processing`
 * (a task for this site still running — its result will be a later draft).
 */
export function draftState({ draft = null, live = null, running = 0 } = {}) {
  const liveVersion = live && live.version ? live.version : "";
  const ahead = !!(draft && draft.version && draft.version !== liveVersion);
  return {
    state: running > 0 ? "processing" : ahead ? "saved" : "published",
    live: liveVersion || null,
    draft: draft ? draft.version : null,
    unpublished: ahead,
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
export async function saveAsDraft(deps, { slug, version, build = "", base = "", job = null, afterActivate, commit, preview } = {}) {
  let rec;
  try { rec = await saveDraftRecord(deps, slug, { version, build, base, job }); }
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
  return { ok: true, draft: true, version, uploaded: false, older: !!rec.older, record: rec.draft, previewed };
}
