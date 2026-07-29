// Teams: the group a site's members belong to.
//
// The schema engine has described three read models — `user` is private-to-me,
// `feed` is everyone-sees-everything, `admin` is a shared CMS — and a business
// tool needs a fourth: OURS. A CRM's deals belong to the team, not to whoever
// happened to type them in and not to every visitor on the internet.
//
// The foundation was already half-built and completely dead. `teamScope` has
// been parsed since the schema engine was written, `applySiteSchema` has been
// stamping a `team_id INTEGER` column onto tables that declare it, and `team_id`
// is in MANAGED_COLUMNS so nobody can write it from a request body — and NO
// query has ever read it or set it. Same shape as `unique`, `teamRead`, `mask`
// and `publicView` before it. This is the reader.
//
// It is deliberately built on that column rather than on a new `org_id`: a
// parallel concept would leave the old one dead forever, which is the failure
// this file exists to end.
//
// How it differs from `teamRead`, which also widens a `user` table:
//
//   teamRead   a HIERARCHY. A manager sees their direct reports' rows, via
//              `manager_id`. Read widening ONLY — a manager still writes only
//              their own rows.
//   teamScope  a FLAT GROUP. Everyone on the team shares the team's rows, via
//              `team_id`, and may EDIT them. That is what "our deals" means; a
//              CRM where a colleague cannot correct a record is not one.
//
// Everything here is pure. The SQL lives in site-data.mjs and the DDL in
// site-schema.mjs; every decision that is wrong-in-a-way-nobody-notices is here.

import { normalizeAccess } from "./site-access.mjs";

/**
 * Is this table shared across a team?
 *
 * Only meaningful on `user`, exactly like `teamReadable`: `feed` is already
 * shared with everyone, and `collect`/`display` have no owner to have a team.
 */
export function teamScoped(def) {
  return !!(def && def.teamScope) && normalizeAccess(def.access) === "user";
}

/**
 * The team a request acts as, or null.
 *
 * A member belongs to at most ONE team. Multi-team membership is a real thing
 * and deliberately not built: it forces every request to answer "which team am
 * I acting in", which is a whole class of bug (a stale active team, a token
 * minted for a team somebody has since left) in exchange for a case a small
 * business tool does not have. A join table can replace this column later
 * without changing any of the rules below.
 *
 * Coerced to a positive integer. It comes from `_users.team_id` rather than from
 * a request, so this is defence in depth rather than validation — but a `0` or a
 * NaN reaching the SQL below would widen a read instead of narrowing it.
 */
export function teamOf(visitor) {
  const n = Number(visitor && visitor.team_id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * What a member may SEE on a team-scoped table.
 *
 * Returns {sql, vals} to be ANDed onto the caller's own filters, never to
 * replace them — the same rule the owner scoping follows, so no query string can
 * widen it.
 *
 * THE important case: a member with NO team sees only their own rows. Not "every
 * row whose team is also null", which is what a naive `team_id = ?` with a null
 * binding *looks* like it might do and what an `IS NOT DISTINCT FROM` would
 * actually do — that would show every teamless member every other teamless
 * member's records. On a site where the owner has not set teams up yet, that is
 * every member on the site.
 */
export function teamReadScope(visitor) {
  const team = teamOf(visitor);
  if (team === null) return { sql: '"owner_id"=?', vals: [visitor.id] };
  return { sql: '("owner_id"=? OR "team_id"=?)', vals: [visitor.id, team] };
}

/**
 * What a member may CHANGE on a team-scoped table.
 *
 * The same set they can see, and this is the deliberate difference from
 * `teamRead`. A flat team owns its records jointly; a CRM where a colleague
 * cannot correct a deal is not a CRM. It is opt-in by the schema — a
 * customer-facing members area simply does not declare `teamScope`.
 */
export const teamWriteScope = teamReadScope;

/**
 * What a write stamps.
 *
 * `owner_id` as well as `team_id`, always: knowing WHO created a row is not
 * something a team model should throw away, and `owner_id` is what still
 * scopes the row for a member who has no team.
 */
export function teamStamp(visitor) {
  const team = teamOf(visitor);
  const cols = ["owner_id"], vals = [visitor.id];
  if (team !== null) { cols.push("team_id"); vals.push(team); }
  return { cols, vals };
}

// ------------------------------------------------------------- the team itself

export const MAX_TEAM_NAME = 60;

/** A team's name, as an owner typed it. Shape only; it is display text. */
export function normalizeTeamName(name) {
  const n = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
  return n && n.length <= MAX_TEAM_NAME ? n : null;
}

/**
 * An id off a request, for assigning a member to a team.
 *
 * `null` is a legitimate value — it means "no team" and is how an owner takes
 * somebody OUT of one — so this returns three things rather than two: a number,
 * `null` to clear, or `undefined` for "not a usable value, change nothing".
 * Collapsing clear-it and nonsense into one answer is how a typo silently
 * removes somebody from their team.
 */
export function normalizeTeamId(value) {
  if (value === null || value === "" || value === "none") return null;
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** One row per team. Applied lazily and idempotently, like the rest. */
export const TEAM_DDL = [
  `CREATE TABLE IF NOT EXISTS _teams (
     id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')))`,
];

/** What the owner sees. Member counts come from the caller; this shapes them. */
export function describeTeams(rows, counts) {
  const by = counts && typeof counts === "object" ? counts : {};
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.id != null)
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name == null ? "" : r.name),
      createdAt: r.created_at || null,
      members: Number(by[String(r.id)] || 0),
    }));
}
