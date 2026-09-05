// THE MIGRATION RECORD (stage 8, 2026-09-05, owner: "keep going").
//
// An addition that touches the site's database used to apply its schema BEFORE
// the page call and the compile, and a publish that then failed kept the
// schema and said nothing: run 33 left a `waiting_list` table on fretwork-1
// with no page showing it, and no record anywhere said which job made it, what
// it made, or that the page never came. Now the schema is applied AFTER the
// compile and the render check — nothing in either needs it (the render check
// answers every `/api/` request with `[]`; the page call reads the spec) — and
// under a record: written `pending` before the first statement, marked
// `applied` once the page is live, `applied_without_page` when the publish
// after it failed (the tables stand, and the reply says so), `failed` when the
// apply itself refused (nothing activated, the refund clean). One record per
// job, newest first, bounded, at `source/<slug>/migrations.json` — the answer
// store's own pattern: a record nothing can read is where the answer was.
//
// NO AUTOMATIC REVERSAL, by the owner's rule. A table this job created, with
// zero rows and nothing referencing it, MAY be dropped — by the deferred DELETE
// step and nothing else; `normalizeSchema` never drops. The record is what that
// step will read to know which job created which table.
//
// Dependency-free: driven by test/site-migrations.test.mjs; worker.js reads and
// writes the store and hands the engine's report in.

export const MIGRATIONS_KEY = (slug) => "source/" + String(slug || "").toLowerCase() + "/migrations.json";
/** How many records a site keeps — the newest; a site with more additions than this has a log, not a ledger. */
export const MAX_MIGRATIONS = 50;
export const MIGRATION_STATES = Object.freeze(["pending", "applied", "applied_without_page", "failed"]);

/** The list as stored, tolerant of anything that is not one: junk reads as empty. */
export function readMigrations(text) {
  if (text == null) return [];
  let v;
  try { v = typeof text === "string" ? JSON.parse(text) : text; } catch { return []; }
  const list = Array.isArray(v) ? v : (v && Array.isArray(v.migrations) ? v.migrations : []);
  return list.filter((m) => m && typeof m === "object" && typeof m.job === "string" && m.job);
}

const names = (v) => (Array.isArray(v) ? v : []).map((x) => (x && typeof x === "object" ? x.name : x)).map((x) => String(x || "").toLowerCase()).filter(Boolean).slice(0, 40);

/**
 * A fresh `pending` record for one job: what this addition DESIGNED for the
 * database, before anything is applied. `version` is the publish's version id
 * when there is one (the page path; the pageless path has none).
 */
export function newMigration({ job, slug, at, version = null, added = [], altered = [], functions = [], apis = [], jobs = [], provisioned = false } = {}) {
  return {
    job: String(job || ""),
    slug: String(slug || "").toLowerCase(),
    at: typeof at === "string" ? at : new Date(Number(at) || Date.now()).toISOString(),
    version: typeof version === "string" && version ? version : null,
    status: "pending",
    provisioned: provisioned === true,
    tables: { added: names(added), altered: names(altered), applied: [], refused: [] },
    functions: { designed: names(functions), made: [], errors: [] },
    apis: names(apis),
    jobs: names(jobs),
    seeded: null,
    publish: null,
  };
}

/**
 * The engine's own report folded onto a record: the tables it applied (the
 * `made` list), the constraints it refused (`refusedRules`, one per table and
 * feature), the functions it made and the ones the database refused. Never a
 * guess at a table the engine did not name.
 */
export function withApplied(entry, made, { seeded = null } = {}) {
  const applied = Array.isArray(made) ? made.map((t) => String(t || "").toLowerCase()).filter(Boolean) : [];
  const refused = (made && Array.isArray(made.refusedRules) ? made.refusedRules : []).slice(0, 20)
    .map((r) => ({ table: String((r && r.table) || ""), feature: String((r && r.feature) || ""), rule: String((r && r.rule) || "").slice(0, 80), why: String((r && r.why) || "").slice(0, 160) }));
  const fnMade = names(made && made.functions);
  const fnErrors = (made && Array.isArray(made.functionErrors) ? made.functionErrors : []).slice(0, 6)
    .map((e) => ({ name: String((e && e.name) || ""), error: String((e && e.error) || "").slice(0, 160) }));
  return {
    ...entry,
    tables: { ...(entry.tables || {}), applied, refused },
    functions: { ...(entry.functions || {}), made: fnMade, errors: fnErrors },
    seeded: seeded && typeof seeded === "object" ? seeded : entry.seeded || null,
  };
}

/** The list with this record in front of it — replacing its job's earlier record, if any — and cut to the cap. */
export function upsertMigration(list, entry) {
  const rest = readMigrations(list).filter((m) => m.job !== entry.job);
  return [entry, ...rest].slice(0, MAX_MIGRATIONS);
}

/**
 * Move one job's record to a state, with whatever the mover knows: the publish
 * outcome, the version that went live, the error. Answers the new list and the
 * moved record; a job with no record answers the list unchanged and `null`.
 */
export function markMigration(list, job, status, patch = {}) {
  if (!MIGRATION_STATES.includes(status)) throw new Error("not a migration state: " + status);
  const all = readMigrations(list);
  const at = all.findIndex((m) => m.job === String(job || ""));
  if (at < 0) return { list: all, entry: null };
  const entry = { ...all[at], ...patch, status, settledAt: new Date().toISOString() };
  const out = all.slice();
  out[at] = entry;
  return { list: out, entry };
}

/** The record that is still `pending` for this job, if any. */
export function pendingMigration(list, job) {
  return readMigrations(list).find((m) => m.job === String(job || "") && m.status === "pending") || null;
}

/**
 * What the customer is told when the database changed and the page did not
 * publish. Said in the reply's own words, before the compile sentence — the
 * tables are live, so "your site is untouched" would be a lie.
 */
export function migrationNote(entry) {
  if (!entry || entry.status !== "applied_without_page") return "";
  const t = (entry.tables && entry.tables.applied) || [];
  const f = (entry.functions && entry.functions.made) || [];
  const what = [];
  if (t.length) what.push("now storing " + t.join(", "));
  if (f.length) what.push("the function" + (f.length > 1 ? "s " : " ") + f.join(", "));
  if ((entry.jobs || []).length) what.push("the scheduled job" + (entry.jobs.length > 1 ? "s " : " ") + entry.jobs.join(", "));
  return "The database changes for this were made" + (what.length ? " — " + what.join(", ") + " — " : " ") +
    "but the page didn't publish, so the site is showing what it showed before. Ask again and I'll add the page without making the tables twice.";
}

/** The shape a reply carries: the record less nothing, so a reader can say what stands. */
export function migrationSummary(entry) {
  if (!entry) return undefined;
  return {
    job: entry.job, status: entry.status, version: entry.version || null,
    tables: (entry.tables && entry.tables.applied) || [], refused: (entry.tables && entry.tables.refused) || [],
    functions: (entry.functions && entry.functions.made) || [], functionErrors: (entry.functions && entry.functions.errors) || [],
    apis: entry.apis || [], jobs: entry.jobs || [],
  };
}
