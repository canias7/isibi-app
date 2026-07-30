// The "ours" read model, on Neon Auth's organizations.
//
// The schema engine describes three read models and a business tool needs a
// fourth: `user` is private-to-me, `feed` is everyone-sees-everything, `admin` is
// a shared CMS — and a CRM's deals belong to the TEAM.
//
// This is a REWRITE, not a restore. The version deleted on 2026-07-30 kept its
// own `_teams` table and a `team_id INTEGER` on a hand-rolled `_users`, with
// routes for an owner to create a team and assign somebody to it. Neon Auth ships
// that: `neon_auth.organization`, `neon_auth.member` (`userId`, `organizationId`,
// `role`) and `neon_auth.invitation`, all maintained by Better Auth's organization
// plugin. So membership is no longer ours to store — the visitor resolver reads it
// off the join, and everything here is the same pure decision layer over a
// different source.
//
// Two consequences of that swap, both deliberate:
//   - a team id is a UUID now, not a sequential integer, so `team_id` on an
//     application table is a UUID column;
//   - there are no team CRUD routes here any more. Creating an organization and
//     adding people to it is Better Auth's API, reached through the same
//     /api/db/<slug>/auth/* proxy the rest of identity goes through.
//
// Pure. Everything takes the resolved visitor as an argument, so all of it is
// driven in test/site-teams.test.mjs with no database.

/** Does this table share its rows across a team? */
export function teamScoped(def) {
  return !!(def && def.teamScope) && String((def && def.access) || "").toLowerCase() === "user";
}

/**
 * The team this visitor acts in, or null.
 *
 * `null` is the case that matters and it is the common one: before an owner sets
 * any organization up, EVERY member is teamless. One place decides what counts as
 * a team so the read scope and the write stamp cannot disagree about it.
 */
export function teamOf(visitor) {
  const t = visitor && visitor.team_id;
  if (t === null || t === undefined || t === "") return null;
  const s = String(t);
  // A uuid, because that is what `neon_auth.organization.id` is. Refused rather
  // than passed through, since it reaches SQL against a `uuid` column and a
  // malformed one is a type error rather than an empty result.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

/**
 * The read scope for a team-shared table.
 *
 * THE ASSERTION THAT MATTERS: a member with NO team sees ONLY their own rows.
 * Every naive implementation gets this wrong in the same outward direction —
 * `team_id IS NOT DISTINCT FROM team_id` matches null to null, so before any
 * organization exists every member would see every other member's records. And
 * since a site starts with nobody in a team, that is not an edge case, it is the
 * default state.
 *
 * The clause is PARENTHESISED. ANDed onto a caller's filters without it, the OR
 * re-associates and escapes them, which turns a filtered read into a full one.
 */
export function teamReadScope(visitor) {
  const team = teamOf(visitor);
  const me = visitor && visitor.id;
  if (!team) return { sql: '"owner_id"=?', vals: [me] };
  return { sql: '("owner_id"=? OR "team_id"=?)', vals: [me, team] };
}

/**
 * What a write stamps.
 *
 * `owner_id` always — who made it. `team_id` only when there is a team, so a
 * teamless member's row is theirs alone and stays that way if they later join one.
 * Both come from the VERIFIED visitor and never from the body; both are managed
 * columns, so a sender cannot claim either.
 */
export function teamStamp(visitor) {
  const team = teamOf(visitor);
  const cols = ["owner_id"], vals = [visitor && visitor.id];
  if (team) { cols.push("team_id"); vals.push(team); }
  return { cols, vals };
}

/**
 * Whether this visitor may EDIT a given row's team.
 *
 * The difference from `teamRead`, which was a hierarchy and widened reads only: a
 * team shares its rows for writing as well, because a tool where a colleague
 * cannot correct a record is not the tool anybody asked for.
 */
export function teamEditScope(visitor) {
  return teamReadScope(visitor);
}
