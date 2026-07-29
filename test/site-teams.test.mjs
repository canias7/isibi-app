// Teams — the "ours" read model.
//
// One assertion matters more than the rest: a member with NO team must see only
// their own rows. The naive implementations of "same team" all get this wrong in
// the same direction, and the direction is outward — on a site where the owner
// has not set teams up, every member has a null team, so the bug shows every
// member every other member's records. It is the worst possible default and the
// easiest one to write.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  teamScoped, teamOf, teamReadScope, teamWriteScope, teamStamp,
  normalizeTeamName, normalizeTeamId, describeTeams, TEAM_DDL, MAX_TEAM_NAME,
} from "../site-teams.mjs";

const member = (o = {}) => ({ id: 7, role: "user", team_id: null, ...o });

// ------------------------------------------------------------- when it applies

test("teamScope only means anything on a `user` table", () => {
  // `feed` is already shared with everyone and `collect`/`display` have no owner
  // to have a team — same rule teamRead follows.
  assert.equal(teamScoped({ teamScope: true, access: "user" }), true);
  for (const access of ["feed", "admin", "collect", "display"]) {
    assert.equal(teamScoped({ teamScope: true, access }), false, access);
  }
  assert.equal(teamScoped({ access: "user" }), false, "not declared");
  assert.equal(teamScoped(null), false);
  assert.equal(teamScoped({}), false);
});

// ------------------------------------------------------------- THE rule

test("a member with NO team sees ONLY their own rows", () => {
  // The one that matters. `team_id = NULL` matching other null rows would show
  // every teamless member every other teamless member's records — and before an
  // owner sets teams up, that is everybody on the site.
  const s = teamReadScope(member({ team_id: null }));
  assert.equal(s.sql, '"owner_id"=?');
  assert.deepEqual(s.vals, [7]);
  assert.ok(!/team_id/.test(s.sql), "a teamless member's query must not mention team_id at all");
});

test("...and that holds for every shape a missing team can arrive in", () => {
  // `0` is the one to watch: it is a legitimate-looking integer that no team can
  // have, and binding it would match rows stamped by a bug rather than none.
  for (const bad of [null, undefined, 0, -1, "", "none", NaN, "abc", {}, []]) {
    const s = teamReadScope(member({ team_id: bad }));
    assert.equal(s.sql, '"owner_id"=?', JSON.stringify(bad));
    assert.equal(teamOf(member({ team_id: bad })), null, JSON.stringify(bad));
  }
});

test("a member WITH a team sees their own rows and the team's", () => {
  const s = teamReadScope(member({ id: 7, team_id: 3 }));
  assert.equal(s.sql, '("owner_id"=? OR "team_id"=?)');
  assert.deepEqual(s.vals, [7, 3]);
  // Parenthesised, or ANDing it onto a caller's filters re-associates and the
  // OR escapes the filter — which widens the read to the whole team regardless
  // of what was asked for.
  assert.ok(s.sql.startsWith("(") && s.sql.endsWith(")"), "the clause must be self-contained: " + s.sql);
});

test("a team id is only ever a positive integer", () => {
  assert.equal(teamOf(member({ team_id: 3 })), 3);
  assert.equal(teamOf(member({ team_id: "3" })), 3, "it arrives from the database as either");
  assert.equal(teamOf(member({ team_id: 3.5 })), null);
  assert.equal(teamOf(null), null);
  assert.equal(teamOf(undefined), null);
});

// ------------------------------------------------------------- writes

test("the team can EDIT the team's rows — the difference from teamRead", () => {
  // teamRead is a read widening only: a manager sees their reports' rows and
  // still writes their own. A flat team owns its records jointly, and a CRM
  // where a colleague cannot correct a deal is not a CRM.
  const v = member({ id: 7, team_id: 3 });
  assert.deepEqual(teamWriteScope(v), teamReadScope(v));
});

test("a teamless member can still only edit their own", () => {
  const v = member({ team_id: null });
  assert.equal(teamWriteScope(v).sql, '"owner_id"=?');
});

test("a write stamps who made it AND which team it belongs to", () => {
  const s = teamStamp(member({ id: 7, team_id: 3 }));
  assert.deepEqual(s.cols, ["owner_id", "team_id"]);
  assert.deepEqual(s.vals, [7, 3]);
});

test("a teamless member's write stamps an owner and no team", () => {
  // Not `team_id = null` explicitly: the column defaults to null, and writing it
  // would be indistinguishable from a bug that cleared somebody's team.
  const s = teamStamp(member({ team_id: null }));
  assert.deepEqual(s.cols, ["owner_id"]);
  assert.deepEqual(s.vals, [7]);
});

test("the stamp never takes a team from the request", () => {
  // The visitor is RESOLVED from a verified session; a body cannot reach here.
  // `team_id` is in MANAGED_COLUMNS for the same reason, and this is the second
  // lock: even if that list changed, the stamp reads the visitor and nothing else.
  const src = fs.readFileSync(new URL("../site-teams.mjs", import.meta.url), "utf8");
  const i = src.indexOf("export function teamStamp");
  const body = src.slice(i, src.indexOf("\n}", i));
  assert.ok(!/body|params|searchParams|request/.test(body),
    "teamStamp must read the visitor only: " + body);
});

// ------------------------------------------------------------- owner input

test("a team name is trimmed, collapsed and bounded", () => {
  assert.equal(normalizeTeamName("  Sales   Team "), "Sales Team");
  assert.equal(normalizeTeamName("x".repeat(MAX_TEAM_NAME)), "x".repeat(MAX_TEAM_NAME));
  for (const bad of ["", "   ", null, undefined, "x".repeat(MAX_TEAM_NAME + 1)]) {
    assert.equal(normalizeTeamName(bad), null, JSON.stringify(bad));
  }
});

test("clearing a team and mistyping one are DIFFERENT answers", () => {
  // `null` means "take them out of the team" and is a real thing an owner does.
  // Collapsing it with nonsense is how a typo silently removes somebody.
  assert.equal(normalizeTeamId(null), null);
  assert.equal(normalizeTeamId(""), null);
  assert.equal(normalizeTeamId("none"), null);
  assert.equal(normalizeTeamId(3), 3);
  assert.equal(normalizeTeamId("3"), 3);
  assert.equal(normalizeTeamId(undefined), undefined, "absent means change nothing");
  for (const junk of ["abc", 0, -1, 2.5, {}, []]) {
    assert.equal(normalizeTeamId(junk), undefined, JSON.stringify(junk) + " must not read as `clear it`");
  }
});

// ------------------------------------------------------------- the list

test("the owner's team list carries a member count", () => {
  const out = describeTeams(
    [{ id: 1, name: "Sales", created_at: "2026-07-29 10:00:00" }, { id: 2, name: "Support" }],
    { 1: 4 },
  );
  assert.deepEqual(out.map((t) => [t.id, t.name, t.members]), [[1, "Sales", 4], [2, "Support", 0]]);
  assert.equal(out[0].createdAt, "2026-07-29 10:00:00");
  assert.equal(out[1].createdAt, null);
});

test("junk rows do not become junk teams", () => {
  assert.deepEqual(describeTeams(null, null), []);
  assert.deepEqual(describeTeams([null, {}, { name: "no id" }], {}), []);
});

test("the DDL creates the table the column points at", () => {
  // `team_id` has been stamped onto tables since the schema engine was written
  // with no `_teams` anywhere — a foreign key to nothing.
  assert.equal(TEAM_DDL.length, 1);
  assert.match(TEAM_DDL[0], /CREATE TABLE IF NOT EXISTS _teams/);
  assert.match(TEAM_DDL[0], /name TEXT NOT NULL/);
});

test("deleting a team releases its members FIRST", () => {
  // Ordering, not presence. Postgres reuses identity values after a delete in
  // some configurations, and a `team_id` left pointing at a gone team would be
  // inherited wholesale by whichever team next takes that id — every record of
  // one group silently readable by an unrelated one.
  //
  // A source check because the route lives in worker.js, which cannot be
  // imported; a mutation removing the release survived every behavioural test.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = worker.indexOf('const tid = Number(tm[2]);');
  assert.ok(i > 0, "the team delete moved");
  const body = worker.slice(i, i + 900);
  const release = body.indexOf("UPDATE _users SET team_id=NULL");
  const drop = body.indexOf("DELETE FROM _teams");
  assert.ok(release > 0, "members must be released when their team is deleted");
  assert.ok(drop > 0, "the team must actually be deleted");
  assert.ok(release < drop, "the release has to happen BEFORE the drop, or a failed drop leaves a dangling team_id");
});
