// A HELD SCHEMA TRIED ON A COPY OF THE SITE'S DATABASE (2026-10-22, decide-3a).
//
// Audit A04-3: under DRAFT_FIRST an add-on's database changes on a published
// site are HELD in the draft and applied only at Publish, so the add-on's own
// reply said every designed function and job was made before any database had
// accepted them. The owner chose option A: right after the add-on designs a
// change that will be held, apply it to a short-lived Neon branch (a
// copy-on-write copy of the site's project) through the same `applySiteSchema`
// Publish uses, read what the copy accepted and refused, and delete the branch.
//
// What the copy refused feeds the answer exactly as a live apply's refusal
// does: a function it refused is in `functionErrors` and never in
// `functions` (so the add-on names it and leaves its jobs out, the existing
// rule), and a refused statement that stops the whole apply (a table) is
// thrown as the live apply's would be. What it accepted is held as before.
//
// NEVER A BLOCKER: a missing Neon key, a site with no project row of its own,
// a failed branch create, an unreachable copy — each answers `ran: false` with
// its reason, and the add-on holds as it did before this existed. The branch
// is deleted in a `finally`; one whose delete did not land is removed by the
// next rehearsal on the same project (`staleRehearsalBranches`, at most three
// a time, older than 15 minutes).
//
// Pure: every network step is injected (`deps`), so the tests drive it with no
// network.

/** `ADDON_DRY_RUN`: on unless set to "off". */
export function addonDryRunOn(env) {
  const v = env && typeof env.ADDON_DRY_RUN === "string" ? env.ADDON_DRY_RUN.trim().toLowerCase() : "";
  return v !== "off";
}

/** A Postgres refusal (a five-character SQLSTATE), as opposed to the network or our own stop. */
export function pgRefusal(e) {
  const code = e && typeof e.code === "string" ? e.code : "";
  return /^[0-9A-Z]{5}$/.test(code) ? { code, message: String((e && (e.detail || e.message)) || "").slice(0, 300) } : null;
}

/** The database and role a site's connection string names, or null. */
export function connParts(conn) {
  try {
    const u = new URL(String(conn || ""));
    const db = decodeURIComponent(u.pathname.replace(/^\//, ""));
    const role = decodeURIComponent(u.username || "");
    return db && role ? { db, role } : null;
  } catch { return null; }
}

/**
 * Try `spec` on a branch of the site's project.
 *
 * deps: `project(env, slug)` → the site's project row (`neon_project`,
 * `neon_branch`); `create(env, projectId, parentId, now)` → `{ branchId }`;
 * `connFor(env, projectId, branchId, db, role)` → conn; `del(env, projectId,
 * branchId)`; `stale(env, projectId, now)` → branch ids; `apply(conn, spec)` →
 * `applySiteSchema`'s answer; `clock()` → ms.
 *
 * Answers `{ ran: false, why }`, `{ ran: true, ms, deleted, made }` or
 * `{ ran: true, ms, deleted, refused: { code, message } }`.
 */
export async function rehearseHeldSchema({ env, slug, conn, spec, deps }) {
  const clock = (deps && deps.clock) || Date.now;
  if (!addonDryRunOn(env)) return { ran: false, why: "switched-off" };
  if (!env || !env.NEON_API_KEY) return { ran: false, why: "no-neon-key" };
  const parts = connParts(conn);
  if (!parts) return { ran: false, why: "no-database" };
  let project;
  try { project = await deps.project(env, slug); }
  catch { return { ran: false, why: "project-unreadable" }; }
  const projectId = project && typeof project.neon_project === "string" ? project.neon_project : "";
  if (!projectId) return { ran: false, why: "no-project" };
  const parentId = project && typeof project.neon_branch === "string" ? project.neon_branch : "";
  const t0 = clock();
  let swept = 0;
  try {
    for (const id of (await deps.stale(env, projectId, t0)) || []) {
      try { await deps.del(env, projectId, id); swept++; } catch { /* the next rehearsal tries again */ }
    }
  } catch { /* a listing that fails sweeps nothing */ }
  let branchId = "";
  try { ({ branchId } = await deps.create(env, projectId, parentId, t0)); }
  catch (e) {
    // A create that answered and then failed to settle still made a branch.
    const made = e && typeof e.branchId === "string" ? e.branchId : "";
    let deleted = !made;
    if (made) { try { await deps.del(env, projectId, made); deleted = true; } catch { /* swept later */ } }
    return { ran: false, why: "branch-create-failed", deleted, swept, ms: clock() - t0 };
  }
  let out;
  try {
    const bconn = await deps.connFor(env, projectId, branchId, parts.db, parts.role);
    const made = await deps.apply(bconn, spec);
    out = { ran: true, made: {
      tables: Array.isArray(made) ? made.slice() : [],
      functions: Array.isArray(made && made.functions) ? made.functions.slice() : [],
      functionErrors: Array.isArray(made && made.functionErrors) ? made.functionErrors.slice() : [],
      refusedRules: Array.isArray(made && made.refusedRules) ? made.refusedRules.slice() : [],
    } };
  } catch (e) {
    const refused = pgRefusal(e);
    out = refused ? { ran: true, refused } : { ran: false, why: "copy-unreachable" };
  } finally {
    let deleted = false;
    try { await deps.del(env, projectId, branchId); deleted = true; } catch { /* swept later */ }
    out = { ...(out || { ran: false, why: "copy-unreachable" }), deleted, swept, ms: clock() - t0 };
  }
  return out;
}

/**
 * WHAT IS HELD AND WHAT IS ANSWERED, from a rehearsal. `held` is today's
 * answer for a held schema (`heldMade(spec)`: every declared table and
 * function, `held: true`). Not run (or switched off): exactly today's
 * `{ spec, made: held }`. Refused as a whole: throws, as the live apply would.
 * Otherwise a function the copy refused is taken out of the held spec and of
 * `made.functions`, and named in `made.functionErrors`; a job on it is taken
 * out of the held spec too; the copy's refused rules ride on
 * `made.refusedRules`.
 */
export function heldFromRehearsal(spec, held, r) {
  if (!r || r.ran !== true) return { spec, made: held };
  if (r.refused) {
    throw Object.assign(new Error("the database refused this change: " + r.refused.message), { detail: "the database refused this change (" + r.refused.code + "): " + r.refused.message, refusedByCopy: true });
  }
  const errs = (r.made && r.made.functionErrors) || [];
  const dead = new Set(errs.map((e) => String((e && e.name) || "").toLowerCase()).filter(Boolean));
  const made = held.slice();
  made.held = true;
  made.rehearsed = true;
  made.functions = (held.functions || []).filter((n) => !dead.has(String(n).toLowerCase()));
  if (errs.length) made.functionErrors = errs.slice();
  const rules = (r.made && r.made.refusedRules) || [];
  if (rules.length) made.refusedRules = rules.slice();
  if (!dead.size) return { spec, made };
  const kept = { ...spec };
  if (Array.isArray(spec.functions)) kept.functions = spec.functions.filter((f) => !dead.has(String((f && f.name) || "").toLowerCase()));
  if (Array.isArray(spec.jobs)) kept.jobs = spec.jobs.filter((j) => !dead.has(String((j && j.fn) || "").toLowerCase()));
  return { spec: kept, made };
}
