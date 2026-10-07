// Getting a site its Neon backend: ONE PROJECT PER SITE, a database inside it,
// and the two rows that remember both.
//
// Per-site rather than per-user (changed 2026-07-29, owner's call) buys genuine
// isolation: a connection string can be handed to somebody without exposing that
// owner's other sites, each site scales to zero on its own, and deleting a site
// means deleting a project rather than dropping one database out of a shared one.
// The cost is the project CAP — Neon limits projects per account, and this
// multiplies consumption of that limit by sites-per-user rather than by users.
//
// This is the step where a failure costs something that is not recoverable by
// retrying. A Neon project is a CAPPED, billed resource, and the only record
// that a user has one is a Supabase row — so a project created and not written
// down is invisible: the next build sees no row, creates another, and the orphan
// bills forever with nothing pointing at it. The original build of this code
// awaited both writes without checking either, which is very likely how the two
// loose projects in the handoff notes got there.
//
// Every side effect is injected, the way publish-pages.mjs and site-data.mjs
// take theirs, so the ordering and the failure paths can be driven against fakes
// with no Neon project and no Supabase.

/**
 * ── EVERY CREATE IS WRITTEN DOWN BEFORE IT CAN LEAVE ANYTHING BEHIND (2026-10-07) ──
 *
 * A Neon project is billed and capped, and the slug's `site_project` row is
 * the only thing that makes one the site's. This module used to drop a
 * project whenever it could not see a row naming it, and to write a project
 * down only after a drop had failed — so two defects stood, both reproduced
 * against it (`test/late-provision.test.mjs`):
 *
 *   * "No row" is never a stable answer. A claim in flight — this attempt's
 *     own, whose answer timed out, or an earlier attempt's — can land after
 *     the read. An earlier attempt's project was settled against a reading
 *     taken before its claim became visible: dropped while recorded, a second
 *     project made, the claim lost to the first, and the build carried on
 *     inside the project it had just deleted.
 *   * A drop that failed and a note that failed were both swallowed, so the
 *     project was untracked and the next attempt made a second one.
 *
 * So the order is reversed and one rule decides every drop:
 *
 *   1. AN ATTEMPT IS WRITTEN DOWN FIRST. Before the create, a note keyed by a
 *      fresh attempt id: the account, the slug, when, and the project's name,
 *      which carries the attempt (`projectNameForSite`). No note, no create.
 *      The project's id is added the moment it is known.
 *   2. A PROJECT IS DROPPED ONLY WHEN THE SLUG'S ROW NAMES ANOTHER ONE. The
 *      row is an insert-if-absent claim and nothing rewrites it, so once it
 *      names another project ours can never be named: that answer cannot be
 *      overtaken by a claim still in flight, which "no row" always can. (The
 *      one other drop is a project whose create threw, by the attempt that
 *      made it, before anything else could know of it — `ATTEMPT_LEASE_MS`.)
 *   3. EVERY OTHER UNRECORDED PROJECT IS CLAIMED, never dropped: the same
 *      atomic claim any create makes. It lands (the project is the site's),
 *      or the row says who holds the slug (rule 2), or nothing can be
 *      established and the note stays.
 *   4. NOTHING NEW IS MADE WHILE THIS ACCOUNT'S EARLIER ATTEMPT IS UNSETTLED:
 *      an attempt still running, a create whose outcome is not known, a
 *      project that could not be claimed, a listing or a row that could not
 *      be read. The attempt stops with every open note named
 *      (`reconcile_project`), and the note stays for the next attempt or the
 *      owner. Another account's note is never touched and never read as ours.
 *   5. A NOTE IS CLEARED ONLY WHEN ITS PROJECT IS THE SITE'S, GONE, BEING TORN
 *      DOWN OR DROPPED UNDER RULE 2 — OR WHEN NEON ITSELF REFUSED ITS CREATE.
 *      A clear that fails leaves a note the next attempt settles the same way,
 *      at no cost but a read.
 *   6. AN UNCERTAIN CREATE STAYS UNCERTAIN (corrected the same day, Codex's
 *      review). Only a refusal Neon itself answered (`refused`, judged in
 *      `site-db.mjs` where the status and the body are both known) says
 *      nothing was made. A 503 or any other 5xx, a 408, 409 or 429, a timeout,
 *      a dropped connection or an answer that cannot be read may each come
 *      back after the project was made — reproduced: a provider that made the
 *      project and answered 503 left one project and no note, and the retry a
 *      second. So the note is kept, the project is looked for by its attempt's
 *      name and claimed when it is found, and when it is not, nothing is
 *      concluded: no Neon document bounds how soon a new project appears in
 *      its listing, so neither time passing nor a search that finds nothing
 *      makes it "never made". A search that did not reach its end — a repeated
 *      cursor, a full page with no cursor, the page limit, a malformed answer,
 *      a read that failed — says less still. The note stays, nothing new is
 *      made for the site, and the owner settles it by hand if no project ever
 *      carries its name.
 *
 * Notes never carry a connection string — it holds a password; a project
 * claimed from a note has its connection read from Neon (`adoptProject`).
 */

/**
 * HOW LONG AN ATTEMPT'S NOTE IS ITS OWN, from the moment it was written.
 *
 * The create is bounded: Neon's POST is cut at 30 s and retried only on a
 * 423, which means "not done", six times 1.5 s apart (`neonApi`), and
 * `waitForProject` gives up after 90 s — under five minutes in all, before
 * the claim's 15 s. Within the lease another attempt leaves a note whose
 * create has not come back alone (`in-progress`), and the attempt alone may
 * drop a project its create threw over, because nothing else can know of it
 * yet; it checks its own clock against half the lease before it does. A note
 * older than the lease is anybody's to settle under rules 2–6.
 *
 * WHAT THE LEASE DOES NOT DO (corrected the same day): it never proves a
 * create made nothing. A note past its lease whose project no search finds
 * stays exactly as open as it was (rule 6).
 */
export const ATTEMPT_LEASE_MS = 15 * 60 * 1000;

const said = (e) => String((e && e.message) || e).slice(0, 200);
const isGone = (e) => !!e && typeof e === "object" && (e.gone === true || e.status === 404);
const nowOf = (deps) => (typeof deps.now === "function" ? Number(deps.now()) : Date.now());
const noteKey = (n) => String((n && (n.attempt || n.projectId)) || "");
/** Why a search for an attempt's project did not reach its end (`findSiteProjects`), as an open note names it. */
const SEARCH_SHORT = { "repeated-cursor": "search-repeated-cursor", "no-cursor": "search-no-cursor", "page-limit": "search-page-limit", malformed: "search-malformed" };

/** A fresh attempt id, 12 hex characters; a dep can supply its own (tests). */
function newAttempt(deps) {
  if (typeof deps.attemptId === "function") return String(deps.attemptId());
  const b = new Uint8Array(6);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** A note rewritten with what is now known. Best effort: the note it replaces still stands, and its name still finds the project. */
async function keepNote(deps, slug, note) {
  try { await deps.noteUnrecorded(slug, note); return true; }
  catch (e) {
    deps.warn?.("UNRECORDED NEON PROJECT " + (note.projectId || "(not yet known)") + " for " + slug + " (attempt " + noteKey(note) + ": " + note.why + ") — its note could not be updated: " + said(e));
    return false;
  }
}
/** A settled note removed. A clear that fails leaves a note the next attempt settles again (rule 5). */
async function clearNote(deps, slug, note) {
  try { await deps.clearUnrecorded?.(slug, noteKey(note)); }
  catch (e) { deps.warn?.("could not clear the settled note " + noteKey(note) + " for " + slug + ": " + said(e)); }
}

/**
 * DROP A PROJECT NO ROW CAN EVER NAME — called only under rule 2, or by the
 * attempt that made it inside its lease. "gone" (Neon answers 404) is as good
 * as dropped; "failed" is logged by name, and the caller keeps its note.
 */
async function dropUnnamed(deps, projectId, why) {
  if (!projectId) return "gone";
  try { await deps.dropProject(projectId); return "dropped"; }
  catch (e) {
    if (isGone(e)) return "gone";
    deps.warn?.("ORPHANED NEON PROJECT " + projectId + " (" + why + ") — the drop failed; its note keeps it: " + said(e));
    return "failed";
  }
}

/**
 * WHAT THE SLUG'S ROW SAYS ABOUT ONE PROJECT: `ours` (it names it), `other`
 * (it names another — under rule 2 ours can never be named), `none`, or
 * `unknown` (the read failed). Only `other` ever leads to a drop.
 */
async function recordedAs(deps, slug, projectId) {
  try {
    const row = await deps.lookupProject(slug);
    if (!row) return { state: "none", row: null };
    return { state: String(row.neon_project) === String(projectId) ? "ours" : "other", row };
  } catch (e) { return { state: "unknown", row: null, error: e }; }
}

/**
 * CLAIM THE SLUG'S ROW FOR ONE PROJECT — the atomic insert-if-absent, then
 * the row read back wherever its answer does not settle it. A claim that
 * found no row is made once more: a write that did not land lands now, or the
 * row says who holds the slug. `claimed` absent is an older dep that cannot
 * tell, read as claimed, exactly as before.
 */
async function claimFor(deps, slug, uid, proj) {
  let last = null;
  for (let round = 0; round < 2; round++) {
    let saved;
    try { saved = await deps.saveProject(slug, uid, proj); } catch (e) { saved = { ok: false, error: e }; }
    if (saved && saved.ok === true && (saved.claimed === true || saved.claimed === undefined)) return { state: "ours", row: null, saved };
    const rec = await recordedAs(deps, slug, proj.neon_project);
    last = { ...rec, saved };
    if (rec.state !== "none") return last;
  }
  return last;
}
const claimDetail = (c) => String((c && c.saved && (c.saved.detail || (c.saved.error && c.saved.error.message))) || (c && c.error && c.error.message) || "").slice(0, 300);

/**
 * SETTLE ONE NOTE OF THIS ACCOUNT'S. Answers `{row}` when the slug's row is
 * now known (the noted project claimed, or another project holding the slug),
 * `{settled}` when the note is done with, or `{open}` when nothing safe can be
 * concluded — the note then stays exactly as it is.
 */
async function settleNote(deps, { slug, uid, note, own = false }) {
  const open = (reason, extra = {}) => ({ open: { attempt: note.attempt || null, projectId: note.projectId || null, reason, ...extra } });
  let n = note;
  // A NOTE ITS OWN ATTEMPT SETTLED, WHOSE CLEAR FAILED (rule 5): Neon refused
  // the create, or the attempt that made the project removed it. Nothing stands.
  if (!n.projectId && (n.refused === true || n.removed === true)) {
    await clearNote(deps, slug, n);
    return { settled: n.refused === true ? "refused" : "removed" };
  }
  if (!n.projectId) {
    // NO ID YET: a create still running, or one whose outcome is not known
    // (rule 6, `uncertain`). Another attempt's create that has not come back
    // is left to it while its lease runs; anything else is looked for by the
    // attempt's own name — found, it is claimed below; not found, nothing is
    // concluded and the note stays, whatever its age.
    // (An attempt's own call passes its note already marked uncertain.)
    const age = nowOf(deps) - Date.parse(String(n.at || ""));
    if (n.uncertain !== true && !(age >= ATTEMPT_LEASE_MS)) return open("in-progress");
    if (typeof deps.findProjects !== "function") return open("cannot-search");
    let found;
    try { found = await deps.findProjects(slug, n); } catch (e) { return open("search-failed", { detail: said(e) }); }
    if (!found || typeof found !== "object" || !Array.isArray(found.projects)) return open("search-unreadable");
    const ids = [...new Set(found.projects.map((p) => p && p.id).filter(Boolean).map(String))];
    if (ids.length > 1) return open("several-projects", { found: ids.slice(0, 5) });
    if (!ids.length) {
      // A SEARCH THAT DID NOT REACH ITS END says nothing; one that did, and
      // found nothing, proves nothing either (rule 6). Each says which.
      if (found.complete !== true) return open(SEARCH_SHORT[found.reason] || "search-incomplete");
      if (own) return open("create-outcome-unknown");
      // A CREATE NOBODY HEARD BACK FROM may still be landing while its lease
      // runs; past it, or once an answer came, it is only not seen (yet).
      return open(n.answered === undefined && !(age >= ATTEMPT_LEASE_MS) ? "in-progress" : "not-visible");
    }
    n = { ...n, projectId: ids[0], why: String(n.why || "") + "; found by its attempt's name" };
    await keepNote(deps, slug, n);
  }
  const id = String(n.projectId);
  const rec = await recordedAs(deps, slug, id);
  if (rec.state === "unknown") return open("row-unreadable", { detail: said(rec.error) });
  if (rec.state === "ours") {
    assertProjectOurs(rec.row, uid, slug);
    await clearNote(deps, slug, n);
    return { row: rec.row };
  }
  if (rec.state === "other") return { row: rec.row, ...(await dropNoted(deps, slug, n, rec.row)) };
  // NO ROW: claim the slug for it (rule 3) — never dropped while a claim may land.
  if (typeof deps.adoptProject !== "function" || typeof deps.tearingDown !== "function") return open("cannot-claim");
  try {
    // A PROJECT BEING TORN DOWN is a deleted site's, queued for removal: never claimed.
    if (await deps.tearingDown(id)) { await clearNote(deps, slug, n); return { settled: "tearing-down" }; }
  } catch (e) { return open("teardown-unreadable", { detail: said(e) }); }
  let made;
  try { made = await deps.adoptProject(id, { branchId: n.branchId || null, roleName: n.roleName || null }); }
  catch (e) {
    if (isGone(e)) { await clearNote(deps, slug, n); return { settled: "gone" }; }
    return open("claim-unreadable", { detail: said(e) });
  }
  if (!made || !made.conn) return open("claim-unreadable");
  const proj = { neon_project: id, neon_branch: made.branchId || n.branchId || null, neon_role: made.roleName || n.roleName || null, neon_conn: made.conn };
  const c = await claimFor(deps, slug, uid, proj);
  if (c.state === "ours") {
    const row = c.row || { uid, ...proj };
    assertProjectOurs(row, uid, slug);
    await clearNote(deps, slug, n);
    return { row, adopted: true };
  }
  if (c.state === "other") return { row: c.row, ...(await dropNoted(deps, slug, n, c.row)) };
  return open("claim-unsettled", { detail: claimDetail(c) });
}

/** Rule 2 for a noted project: the row names another, so it is dropped; a drop that fails keeps its note. */
async function dropNoted(deps, slug, n, row) {
  const d = await dropUnnamed(deps, n.projectId, "an earlier attempt's project; the site's row names " + row.neon_project);
  if (d === "failed") { await keepNote(deps, slug, { ...n, why: String(n.why || "") + "; the slug's row names another project and its removal failed" }); return { leftover: String(n.projectId) }; }
  await clearNote(deps, slug, n);
  return {};
}

/** The error every unsettled state stops a create with — each open note named, for the next attempt and the owner. */
function unsettled(message, open) {
  const list = open.map((o) => ({ attempt: o.attempt || null, projectId: o.projectId || null, reason: o.reason }));
  return Object.assign(new Error(message), {
    stage: "reconcile_project", reconcile: true, open: list,
    detail: list.map((o) => o.reason + (o.projectId ? " " + o.projectId : "") + (o.attempt ? " (attempt " + o.attempt + ")" : "")).join("; ").slice(0, 300),
  });
}

/**
 * SETTLE THIS ACCOUNT'S EARLIER ATTEMPTS FOR THE SLUG. With `creating` (no
 * row yet) an attempt that cannot be settled stops the create (rule 4),
 * unless a row is established along the way — a noted project claimed, or
 * another holding the slug — which the caller then uses rather than making
 * anything. Without it (the site already has its project) every leftover is
 * settled where it safely can be, and nothing stops.
 */
async function settleAttempts(deps, { slug, uid, creating }) {
  if (typeof deps.unrecorded !== "function" || typeof deps.noteUnrecorded !== "function") {
    if (creating) throw unsettled("this caller keeps no record of its attempts, so no database project is made", [{ reason: "no-notes" }]);
    return { row: null };
  }
  let notes;
  try { notes = await deps.unrecorded(slug); }
  catch (e) {
    if (!creating) { deps.warn?.("attempt notes for " + slug + " could not be read: " + said(e)); return { row: null }; }
    throw unsettled("an earlier attempt's database project could not be checked", [{ reason: "notes-unreadable" }]);
  }
  let row = null;
  const open = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    if (!note || typeof note !== "object" || !noteKey(note)) continue;
    // ANOTHER ACCOUNT'S NOTE is never settled, claimed or dropped by this one.
    if (String(note.uid || "") !== String(uid)) continue;
    const r = await settleNote(deps, { slug, uid, note });
    if (r.row) row = r.row;
    if (r.open) open.push(r.open);
  }
  if (open.length) {
    if (creating && !row) throw unsettled("an earlier attempt's database project needs settling before another is made", open);
    deps.warn?.("attempt notes for " + slug + " left open: " + open.map((o) => o.reason + (o.projectId ? " " + o.projectId : "")).join("; ").slice(0, 300));
  }
  return { row };
}

/**
 * MAKE THE SITE'S PROJECT — written down first (rule 1), claimed, and every
 * outcome settled by the rules above. Answers the project row the slug's row
 * names: ours, or — after a lost race — the one that holds the slug.
 */
async function makeProject(deps, { slug, uid }) {
  const attempt = newAttempt(deps);
  const startedAt = nowOf(deps);
  let note = { slug, uid, attempt, why: "a database project is being made for the site", at: new Date(startedAt).toISOString() };
  try { const name = typeof deps.projectName === "function" ? deps.projectName(slug, attempt) : null; if (name) note.name = String(name); } catch { /* the id alone still names the note */ }
  try { await deps.noteUnrecorded(slug, note); }
  catch (e) {
    throw Object.assign(new Error("could not write the attempt down, so no database project was made"), { stage: "note_attempt", detail: said(e) });
  }
  let made;
  try {
    made = await deps.createProject(slug, attempt);
  } catch (e) {
    if (e && typeof e === "object" && !e.stage) e.stage = "create_project";
    if (e && e.projectId) {
      // NEON MADE IT AND THE CALL THREW AFTER — the response-shape guard or
      // `waitForProject`, both after the POST (measured 2026-08-21: no id
      // travelled, so the project was invisible; `projectFromCreate` attaches
      // it now). The note does not name it yet and no search runs inside the
      // lease, so nothing else can know of it: dropped as before — and when
      // that cannot be done, named on the note for the next attempt to claim.
      const ownWindow = nowOf(deps) - startedAt < ATTEMPT_LEASE_MS / 2;
      const d = ownWindow ? await dropUnnamed(deps, e.projectId, "the create call threw after Neon had made it") : "outside-lease";
      if (d === "dropped" || d === "gone") {
        // MARKED REMOVED BEFORE IT GOES — only once the project is gone, so no
        // other attempt can claim one being dropped — and a clear that fails
        // is settled next time (rule 5).
        await keepNote(deps, slug, { ...note, removed: true, why: "the create call threw after Neon had made it; this attempt removed the project" });
        await clearNote(deps, slug, note);
        throw e;
      }
      await keepNote(deps, slug, { ...note, projectId: String(e.projectId), why: "the create call threw after Neon had made it" + (d === "failed" ? "; its removal failed" : "") });
      e.recorded = "unknown";
      throw e;
    }
    // NO ID. A REFUSAL NEON ITSELF ANSWERED made nothing (rule 5): the note
    // goes and the next attempt is free. ANYTHING ELSE MAY HAVE MADE A
    // PROJECT (rule 6) — a 503 among them, which used to clear the note: kept,
    // marked uncertain, looked for now by the attempt's name and claimed when
    // found; when not, the note stays open, nothing new is made for the site,
    // and the failure says a database may have been started.
    const st = e && typeof e === "object" ? Number(e.status) : NaN;
    if (e && typeof e === "object" && e.refused === true) {
      // MARKED REFUSED BEFORE IT GOES, so a clear that fails is settled by the
      // next attempt (rule 5) rather than left as a create nobody can finish.
      await keepNote(deps, slug, { ...note, refused: true, answered: st, why: "Neon refused the create (" + st + "); nothing was made" });
      await clearNote(deps, slug, note);
      throw e;
    }
    note = { ...note, uncertain: true, ...(Number.isFinite(st) && st > 0 ? { answered: st } : {}), why: (Number.isFinite(st) && st > 0 ? "the create was answered " + st : "the create's answer never came back or could not be read") + "; whether it made a project is not known" };
    await keepNote(deps, slug, note);
    const r = await settleNote(deps, { slug, uid, note, own: true });
    if (r.row) return assertProjectOurs(r.row, uid, slug);
    if (e && typeof e === "object" && !r.settled) {
      e.recorded = "unknown";
      if (r.open) e.open = [r.open];
    }
    throw e;
  }
  const proj = { neon_project: made.projectId, neon_branch: made.branchId, neon_role: made.roleName, neon_conn: made.conn };
  note = { ...note, projectId: String(made.projectId), branchId: made.branchId || null, roleName: made.roleName || null, why: "made; its row is being written" };
  await keepNote(deps, slug, note);
  const c = await claimFor(deps, slug, uid, proj);
  if (c.state === "ours") {
    // A ROW NAMING OUR PROJECT UNDER ANOTHER ACCOUNT is never built on: its owner is read first.
    const row = c.row ? assertProjectOurs(c.row, uid, slug) : { uid, ...proj };
    await clearNote(deps, slug, note);
    return row;
  }
  if (c.state === "other") {
    // LOST THE SLUG RACE — CONVERGE, DO NOT ORPHAN. Another build of this
    // free name recorded its project between our lookup and our claim (the
    // 2026-08-13 audit: both racers used to "succeed" by upsert, the winner's
    // live site ended up on the loser's project, and the loser's billed on
    // with no teardown entry). The row is read BEFORE anything is dropped, and
    // it names another project, so ours can never be named (rule 2) — the
    // first version dropped first and read after. The converge is
    // ownership-checked: two accounts racing one name get a 409, never one
    // account's database inside the other's project (2026-08-21).
    const d = await dropUnnamed(deps, made.projectId, "lost the slug race");
    if (d === "failed") await keepNote(deps, slug, { ...note, why: "lost the slug race; its removal failed" });
    else await clearNote(deps, slug, note);
    return assertProjectOurs(c.row, uid, slug);
  }
  await keepNote(deps, slug, { ...note, why: c.state === "unknown" ? "whether its row was saved could not be read back" : "its row could not be written and no row names it" });
  throw Object.assign(new Error("could not record the Neon project"), { detail: claimDetail(c), stage: "save_project", recorded: "unknown" });
}

/**
 * A PROJECT ROW IS AN OWNERSHIP RECORD, and this module used to reuse one
 * without ever reading the owner off it.
 *
 * `lookupSite` decides ownership for `site_backends` — it returns `{conn, uid}`
 * and throws `conflict` when the uid differs, because "ownership belongs in the
 * layer that returns the connection". `lookupProject` is the parallel slug-keyed
 * lookup and had no such check, so when `site_project` held a row and
 * `site_backends` did not — which is exactly what any failure between the two
 * writes leaves behind — a DIFFERENT account building that slug was silently
 * given the first account's project. Measured 2026-08-21: account B's database
 * was created inside account A's project and B's returned connection string was
 * A's host, role and PASSWORD. A deleting their account cascades `site_project`,
 * which enqueues that project for teardown and destroys B's live site.
 *
 * It also closes the same hole in the race converge below: the losing racer used
 * to adopt the winner's project unconditionally, so two DIFFERENT accounts
 * racing one free slug produced precisely that cross-account state by design.
 *
 * ABSENT `uid` IS A REFUSAL, NOT A SHRUG. `site_project.uid` is NOT NULL
 * (measured against the live schema 2026-08-21, and all 11 rows carry one), so a
 * row can never lack an owner — an absent KEY means the dep's SELECT did not ask
 * for it, i.e. our own wiring is wrong. Failing open there is the bug this
 * function exists to close, and it would be silent; failing closed is loud, is
 * fixed by one column in one SELECT, and cannot mis-decide anything.
 */
function assertProjectOurs(proj, uid, slug) {
  if (!proj) return proj;
  if (!("uid" in proj)) {
    throw Object.assign(new Error("the site's project row was read without its owner"), {
      stage: "project_owner",
      detail: "lookupProject(" + slug + ") must select uid — site_project.uid is NOT NULL, so an absent key means the SELECT did not ask for it",
    });
  }
  if (String(proj.uid) !== String(uid)) {
    throw Object.assign(new Error("that name is taken"), { stage: "project_owner", conflict: true });
  }
  return proj;
}

/**
 * deps:
 *   lookupSite(slug)            → conn | null      does this slug already have a database
 *   lookupProject(slug)         → proj | null      does this SITE already have a Neon project
 *   createProject(slug, attempt)→ {projectId, branchId, roleName, conn}
 *   dropProject(projectId)      → void             only for a project no row can ever name
 *                                                  (see the rules above); a 404 is gone
 *   saveProject(slug, uid, proj)→ {ok, claimed?}   ATOMIC insert of the site_project row —
 *                                                  claimed:false = the slug's row already existed
 *                                                  (another racer got there first); absent = the
 *                                                  dep cannot tell, treated as claimed
 *   enableAuth(proj, dbName)    → void             turn Neon Auth on; idempotent
 *   createDatabase(proj, slug)  → dbName
 *   saveBackend(slug, uid, db)  → {ok, claimed?}   ATOMIC insert of the site_backends row —
 *                                                  same contract as saveProject
 *   connFor(projectConn, dbName)→ conn
 *   dbNameFor(slug)             → dbName
 *   missingServices(conn)       → ["auth"|"data"]  OPTIONAL — which _meta service endpoints
 *                                                  the site lacks, asked through the same
 *                                                  reader the proxy uses; drives the reuse-
 *                                                  path heal and nothing else
 *   noteUnrecorded(slug, rec)   → void             REQUIRED TO MAKE A PROJECT — write (or
 *                                                  rewrite) one attempt's note, keyed by
 *                                                  `rec.attempt` (an older note: `projectId`):
 *                                                  `{slug, uid, attempt, name, projectId?,
 *                                                  branchId?, roleName?, why, at}`, never a
 *                                                  connection; throws when it cannot
 *   unrecorded(slug)            → [rec]            REQUIRED TO MAKE A PROJECT — every note for
 *                                                  this slug, of every account; throws when it
 *                                                  cannot tell
 *   clearUnrecorded(slug, key)  → void             an attempt settled, its note gone
 *   projectName(slug, attempt)  → name             OPTIONAL — the name `createProject` gives
 *                                                  that attempt's project, for the note
 *   findProjects(slug, note)    → {complete, projects:[{id}], reason?}
 *                                                  the projects carrying the note's attempt
 *                                                  name, and whether the listing was seen to
 *                                                  its end (`reason` says why not); throws
 *                                                  when the listing cannot be read
 *   adoptProject(id, hint)      → {branchId, roleName, conn}   a noted project's connection,
 *                                                  read from Neon; throws `gone` on a 404
 *   tearingDown(id)             → bool             is the project queued for teardown; throws
 *                                                  when it cannot tell
 *   attemptId() / now()                            OPTIONAL — test seams
 *   saveProject's `claimed: null` means its answer could not be read: the row is
 *   read back before anything is concluded, never read as a lost race. Without
 *   the two note deps NO PROJECT IS MADE: nothing could find it again.
 *
 * `lookupProject` MUST return the row's `uid`. See `assertProjectOurs`.
 */
export async function ensureSiteBackend(deps, { slug, uid }) {
  // OPTIONAL, like `deps.warn`. Provisioning is six Neon/Supabase calls behind
  // one number in the build trace, and a COLD provision (create the project,
  // poll until it exists, create the database, poll again, enable auth, enable
  // the Data API) takes tens of seconds while a WARM one — the slug already has
  // a database — is a single lookup. They were indistinguishable from outside.
  // Injected rather than returned, because the interesting case is the build
  // that THROWS half way through: a return value never arrives.
  const mark = (name) => { try { deps.mark?.(name); } catch { /* never break a build */ } };
  // Deliberately NOT the cached read used on the request path. This is the write
  // path: a cached connection string for a slug another isolate has since
  // deleted would send a schema apply at a dropped database. A build takes tens
  // of seconds, so one uncached lookup here costs nothing worth having.
  // `lookupSite` returns {conn, uid} so ownership is decided HERE, not only by
  // whatever the caller checked first. The route's own check is wrapped in a
  // try/catch and used to fail OPEN, so a Supabase hiccup during someone's build
  // let them adopt an existing slug: the lookup handed back the current owner's
  // connection and the schema apply, the seed and the publish all went at
  // another user's site. Ownership belongs in the layer that returns the
  // connection.
  const existing = await deps.lookupSite(slug);
  if (existing && existing.conn) {
    if (existing.uid && existing.uid !== uid) {
      throw Object.assign(new Error("that name is taken"), { stage: "owner", conflict: true });
    }
    // HEAL THE SERVICE ENDPOINTS, on the one path every recorded site takes.
    //
    // `auth_info` and `data_api` are written exactly once each, on the
    // non-reuse path, and both saves are best-effort — so a transient blip
    // during either one used to yield a build that answered ok:true over a
    // site whose every visitor read, form and sign-in answers 501, FOREVER:
    // this reuse path called zero deps, so no rebuild ever re-ran the enables
    // or the saves, while the 501's own copy promised a rebuild would fix it
    // (2026-08-14 audit). Now it does. `missingServices` asks the SAME reader
    // the proxy uses, so the heal and the 501 cannot disagree about what
    // "recorded" means.
    //
    // BEST-EFFORT END TO END, in both directions. A reader that cannot tell
    // answers nothing — a database blip must not read as "missing" and spend
    // Neon API calls on every build of every healthy site — and a heal that
    // fails must not fail a text edit that never needed the endpoint; the
    // next build retries it. An enable answering `info: null` saves nothing,
    // because overwriting a stored endpoint with null is the one way this
    // could make a site worse.
    if (deps.missingServices) {
      let missing = [];
      try { missing = (await deps.missingServices(existing.conn)) || []; } catch { missing = []; }
      if (Array.isArray(missing) && missing.length) {
        try {
          // Ownership is asked here too, for one rule rather than two. On this
          // path `lookupSite` has already settled that the SITE is ours, so a
          // project row wearing another uid is the cross-account state
          // `assertProjectOurs` now prevents — and enabling services inside
          // somebody else's project is not a thing to do quietly. The throw is
          // caught below, so this warns and skips the heal rather than failing
          // an edit that never needed the endpoint.
          const proj = assertProjectOurs(await deps.lookupProject(slug), uid, slug);
          if (proj) {
            const dbName = deps.dbNameFor(slug);
            if (missing.includes("auth") && deps.enableAuth) {
              const a = await deps.enableAuth(proj, dbName);
              if (a && a.info && deps.saveAuthInfo) await deps.saveAuthInfo(dbName, a.info);
            }
            if (missing.includes("data") && deps.enableData) {
              const d2 = await deps.enableData(proj, dbName);
              if (d2 && d2.info && deps.saveDataInfo) await deps.saveDataInfo(dbName, d2.info);
            }
            mark("heal");
          }
        } catch (e) { deps.warn?.("service heal failed for " + slug + ": " + ((e && e.message) || e)); }
      }
    }
    // LEFTOVERS OF EARLIER ATTEMPTS (2026-10-07): a lost race whose drop
    // failed leaves a noted project on a site that then finished, and this
    // path is the only one such a site takes again. Settled where it safely
    // can be (`settleAttempts` without `creating`), never stopping the call.
    try { await settleAttempts(deps, { slug, uid, creating: false }); }
    catch (e) { deps.warn?.("attempt notes for " + slug + " were not settled: " + said(e)); }
    mark("reuse");
    return existing.conn;
  }
  // Exists but with no usable connection recorded, owned by someone else: still
  // not ours to build over.
  if (existing && existing.uid && existing.uid !== uid) {
    throw Object.assign(new Error("that name is taken"), { stage: "owner", conflict: true });
  }

  // Keyed by SLUG now, not by uid. A retried build for the same site must find
  // the project it made last time — otherwise every retry creates another one
  // and burns the cap, which is the per-site version of the leak this module was
  // written to stop.
  //
  // AND OWNERSHIP-CHECKED. A project row for this slug is a record of who owns
  // the project; reusing one without reading its owner is how account B's
  // database ends up inside account A's project — see `assertProjectOurs`.
  let proj = assertProjectOurs(await deps.lookupProject(slug), uid, slug);
  // THIS ACCOUNT'S EARLIER ATTEMPTS, SETTLED BEFORE ANYTHING IS MADE
  // (2026-10-07, `settleAttempts`). Each note is judged against a fresh read of
  // the row, never against the one just taken: a claim that lands in between
  // makes its project the site's, and that project is used. With no row, a
  // noted project is claimed rather than dropped, and nothing new is made over
  // an attempt that cannot be settled. With a row, leftovers are settled where
  // they safely can be and nothing stops.
  if (!proj) {
    const s = await settleAttempts(deps, { slug, uid, creating: true });
    if (s.row) { proj = assertProjectOurs(s.row, uid, slug); mark("adopt"); }
  } else {
    await settleAttempts(deps, { slug, uid, creating: false });
  }
  if (!proj) {
    // MADE, WRITTEN DOWN FIRST, AND CLAIMED (`makeProject`). A create that
    // threw after Neon made the project, a claim whose answer was lost, and a
    // lost slug race are each settled there by the same rules; the converge
    // onto another racer's project is ownership-checked (`assertProjectOurs`),
    // so two accounts racing one free name get the 409 the slug race gives,
    // never one account's database inside the other's project.
    proj = await makeProject(deps, { slug, uid });
    mark("project");
  }

  // A retried build can hit an already-created database; that is success, not
  // failure — the schema apply below is additive and idempotent.
  // ── FROM HERE THE PROJECT IS THE SITE'S, RECORDED (2026-10-07) ──────────
  //
  // Every failure below leaves it recorded against the slug, and the next
  // attempt reuses it (`lookupProject`) rather than making another — so each
  // carries `recorded: true` and names its own stage, for the caller to say
  // that a database was started and kept rather than that nothing changed.
  const kept = (e, stage) => {
    if (e && typeof e === "object") {
      if (!e.stage && stage) e.stage = stage;
      e.recorded = true;
    }
    return e;
  };
  let dbName;
  try {
    dbName = await deps.createDatabase(proj, slug);
  } catch (e) {
    if (!/already exists/i.test(String((e && e.detail) || (e && e.message) || ""))) throw kept(e, "create_database");
    dbName = deps.dbNameFor(slug);
  }
  mark("database");

  // Neon Auth, every time — not only when the project was just created.
  //
  // AFTER the database, because the enable call has to NAME it: a site's
  // project holds two databases and Neon refuses to guess between them. Still
  // before the caller applies any schema, which is the ordering that matters —
  // `neon_auth` has to exist before a table can reference it.
  //
  // The whole backend is Neon (2026-07-30), so a site without auth enabled is a
  // site whose member pages return nothing. A project can exist without it: the
  // create succeeded and this call failed, or the project predates the change.
  // Since a retried build REUSES the project, enabling only at creation would
  // leave that site permanently broken while every retry reported success.
  //
  // Not best-effort. Identity is load-bearing now, and a build that quietly
  // produced a site nobody can sign in to is worse than one that failed and said
  // so — the caller can retry a failure, and cannot retry a success.
  //
  // The provisioning answer is KEPT, because it is where the site's auth endpoint
  // comes from and a published page has no other way to learn it. Recording it is
  // best-effort while enabling is not: auth being ON is what makes the site
  // usable, and a missing note of WHERE it is can be re-fetched by a later build
  // from a call that is idempotent anyway.
  let authInfo = null;
  if (deps.enableAuth) {
    try { authInfo = (await deps.enableAuth(proj, dbName)) || null; }
    catch (e) {
      // STATUS CARRIED THROUGH. Both of these wrappers kept `detail` and dropped
      // `status`, so a build that died here reported `upstream: null` and the
      // caller could not tell a 404 (wrong path) from a 401 (dead key) from a
      // 5xx. That is the whole reason the status was surfaced one layer up.
      throw kept(Object.assign(new Error("could not enable Neon Auth for this site"), {
        detail: String((e && (e.detail || e.message)) || "").slice(0, 300),
        status: e && e.status,
        stage: "enable_auth",
      }));
    }
    // LOGGED, NOT SWALLOWED. Best-effort is right — a site whose auth is ON but
    // whose endpoint was not written is still recoverable — but a `catch {}` with
    // no log is how a one-word bug (`.conn` for `.neon_conn`) survived from the
    // day it was written: it threw on every build of every site, and nothing
    // anywhere said so. The build still succeeds; somebody can now see why the
    // site is a shell.
    if (authInfo && authInfo.info && deps.saveAuthInfo) {
      try { await deps.saveAuthInfo(dbName, authInfo.info); }
      catch (e) { deps.warn?.("saveAuthInfo failed for " + slug + ": " + ((e && e.message) || e)); }
    }
    mark("auth");
  }

  // The Data API. Fatal for the same reason auth is: with the Worker's own row
  // routes gone this IS the site's backend, so a build that could not enable it
  // produced a site whose every list is empty and whose every form fails — and a
  // caller can retry a failure, not a success.
  if (deps.enableData) {
    let dataInfo = null;
    try { dataInfo = (await deps.enableData(proj, dbName)) || null; }
    catch (e) {
      throw kept(Object.assign(new Error("could not enable the Neon Data API for this site"), {
        detail: String((e && (e.detail || e.message)) || "").slice(0, 400),
        status: e && e.status,
        stage: "enable_data_api",
      }));
    }
    if (dataInfo && dataInfo.info && deps.saveDataInfo) {
      try { await deps.saveDataInfo(dbName, dataInfo.info); }
      catch (e) { deps.warn?.("saveDataInfo failed for " + slug + ": " + ((e && e.message) || e)); }
    }
    mark("data_api");
  }

  // The database exists now, but nothing points at it until this row lands: the
  // slug stays unclaimed and every read 404s. Reporting a successful build for a
  // site nobody can reach is worse than failing.
  let backend = { ok: false };
  try { backend = await deps.saveBackend(slug, uid, dbName); } catch (e) { backend = { ok: false, error: e }; }
  if (!backend || !backend.ok) {
    throw kept(Object.assign(new Error("could not record the site's database"), {
      detail: String((backend && backend.detail) || (backend && backend.error && backend.error.message) || "").slice(0, 300),
      stage: "save_backend",
    }));
  }
  // THE SLUG BELONGS TO WHOEVER RECORDED IT FIRST — enforced here, not merely
  // stated. Under the old upsert, two racers both "succeeded" and the LAST
  // writer owned the slug, silently unseating a build that had already
  // reported success. `claimed === false` means another build recorded this
  // slug while ours was provisioning; the honest answer is the same 409 the
  // route already gives a name that was taken before the build began — with a
  // refund and the message naming the cause. Nothing is orphaned by refusing:
  // the project is recorded in site_project (the claim above converged us onto
  // one project), and the winner is building on it.
  if (backend.claimed === false) {
    // …BUT OUR OWN ROW IS NOT SOMEBODY ELSE'S SITE, and this reported it as one.
    //
    // `claimed === false` says only that a row already exists. By here the
    // reuse branch has established that if one existed it belongs to THIS uid —
    // so the second cause is the caller's own row, skipped at the top because
    // `existing.conn` was null. `siteBackendRowFresh` answers conn:null whenever
    // the `site_project` row cannot be resolved, which is exactly what a
    // half-failed delete leaves behind (the `site_backends` DELETE is swallowed,
    // the `site_project` DELETE succeeds). Measured 2026-08-21: the owner
    // rebuilding their own slug got "That site name is taken by another
    // account", every retry repeated it, and each attempt created and recorded a
    // brand-new billed Neon project that no site would ever use.
    //
    // So ASK WHO HOLDS IT rather than inferring. One read on the losing path
    // only, mirroring the project race's read-back exactly, and it answers the
    // one question that matters — is the winner us? If it is, the row is ours,
    // the database name is derived from the slug so it already matches, and the
    // build continues: the site heals instead of being permanently unbuildable.
    //
    // A read-back that fails or finds nothing REFUSES. Fail-closed is the cheap
    // direction here: refusing costs the customer a retry, while adopting a slug
    // we cannot prove is ours writes a schema, seeds rows and publishes over
    // another account's site.
    let winner = null;
    try { winner = await deps.lookupSite(slug); } catch { winner = null; }
    if (!winner || !winner.uid || String(winner.uid) !== String(uid)) {
      throw Object.assign(new Error("that name is taken"), { stage: "save_backend", conflict: true });
    }
    mark("reclaim");
  }

  mark("record");
  return deps.connFor(proj.neon_conn, dbName);
}
