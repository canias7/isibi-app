// Team-shared rows, on Neon Auth's organizations.
//
// A rewrite rather than a restore: membership used to live in our own `_teams`
// table with an integer `_users.team_id`, and it is Better Auth's
// `neon_auth.member.organizationId` now — a UUID, read off a join.
//
// Almost every test here guards ONE direction, because every naive
// implementation of "same team" fails outward: it shows members each other's
// records. And since a site starts with nobody in an organization, that is the
// DEFAULT state, not an edge case.
import { test } from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { teamScoped, teamOf, teamReadScope, teamStamp, teamEditScope } from "../site-teams.mjs";

const ORG = "9f8b1c2d-3e4a-4b5c-8d9e-0f1a2b3c4d5e";
const OTHER = "11111111-2222-4333-8444-555555555555";
const ME = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

const withTeam = { id: ME, role: "user", team_id: ORG };
const teamless = { id: ME, role: "user", team_id: null };

// ------------------------------------------------------------ which tables

test("only a `user` table that declares teamScope is team-shared", () => {
  assert.equal(teamScoped({ access: "user", teamScope: true }), true);
  assert.equal(teamScoped({ access: "user" }), false, "opt-in — a plain user table is private");
  // The other levels already answer this question: feed is everyone, admin is a
  // shared CMS, collect and display have no owner at all.
  for (const access of ["feed", "admin", "collect", "display"]) {
    assert.equal(teamScoped({ access, teamScope: true }), false, access);
  }
  assert.equal(teamScoped(null), false);
  assert.equal(teamScoped({}), false);
});

// ------------------------------------------------------------ what a team is

test("a team id must be a UUID — an organization id is not an integer any more", () => {
  assert.equal(teamOf(withTeam), ORG);
  // It reaches SQL against a `uuid` column, so a malformed one is a Postgres type
  // error rather than an empty result. Refused here instead.
  for (const bad of [7, "7", "abc", "9f8b1c2d-3e4a", "' OR 1=1--", true, {}, []]) {
    assert.equal(teamOf({ id: ME, team_id: bad }), null, JSON.stringify(bad));
  }
});

test("absent, null and empty all mean no team", () => {
  for (const t of [null, undefined, ""]) assert.equal(teamOf({ id: ME, team_id: t }), null, JSON.stringify(t));
  assert.equal(teamOf({ id: ME }), null);
  assert.equal(teamOf(null), null);
});

// ------------------------------------------------- THE assertion that matters

test("a member with NO team sees ONLY their own rows", () => {
  // The one that decides whether this feature is safe. `IS NOT DISTINCT FROM`
  // would match null to null, and since every member is teamless before an owner
  // creates an organization, that bug shows the whole site to everybody.
  const r = teamReadScope(teamless);
  assert.equal(r.sql, '"owner_id"=?');
  assert.deepEqual(r.vals, [ME]);
  assert.ok(!/team_id/.test(r.sql), "a teamless read must not mention team_id at all: " + r.sql);
  assert.ok(!r.vals.includes(null), "a null must never become a matchable value");
});

test("two teamless members never see each other", () => {
  const a = teamReadScope({ id: "aaaaaaaa-1111-4111-8111-111111111111", team_id: null });
  const b = teamReadScope({ id: "bbbbbbbb-2222-4222-8222-222222222222", team_id: null });
  assert.notDeepEqual(a.vals, b.vals, "each must be scoped to their own id and nothing else");
});

test("a member WITH a team sees their own rows and the team's", () => {
  const r = teamReadScope(withTeam);
  assert.match(r.sql, /owner_id/);
  assert.match(r.sql, /team_id/);
  assert.deepEqual(r.vals, [ME, ORG]);
});

test("the clause is PARENTHESISED, or ANDing it on lets the OR escape the filters", () => {
  // `WHERE status='x' AND owner_id=? OR team_id=?` re-associates: the OR binds
  // loosest, so the whole filtered read becomes "…or anything in my team",
  // ignoring status entirely.
  const r = teamReadScope(withTeam);
  assert.ok(r.sql.startsWith("(") && r.sql.endsWith(")"), "must be wrapped: " + r.sql);
});

test("a bad team id degrades to own-rows, never to a broken query", () => {
  const r = teamReadScope({ id: ME, team_id: "not-a-uuid" });
  assert.equal(r.sql, '"owner_id"=?');
  assert.deepEqual(r.vals, [ME]);
});

// ------------------------------------------------------------- what a write stamps

test("a write always stamps the owner, and the team only when there is one", () => {
  const withT = teamStamp(withTeam);
  assert.deepEqual(withT.cols, ["owner_id", "team_id"]);
  assert.deepEqual(withT.vals, [ME, ORG]);

  const without = teamStamp(teamless);
  assert.deepEqual(without.cols, ["owner_id"]);
  assert.deepEqual(without.vals, [ME]);
  // Not a null team_id: the row is theirs alone, and stays theirs if they later
  // join an organization rather than retroactively appearing in it.
  assert.equal(without.cols.length, without.vals.length);
});

test("the stamp and the read agree about what a team is", () => {
  // One `teamOf` for both, because a write that stamps a team the read does not
  // recognise writes rows their author cannot see.
  const odd = { id: ME, team_id: "NOT-A-UUID" };
  assert.deepEqual(teamStamp(odd).cols, ["owner_id"]);
  assert.equal(teamReadScope(odd).sql, '"owner_id"=?');
});

test("editing uses the same scope as reading — the difference from teamRead", () => {
  // `teamRead` was a hierarchy that widened READS only. A team shares its rows for
  // writing too, because a tool where a colleague cannot correct a record is not
  // the tool anybody asked for.
  assert.deepEqual(teamEditScope(withTeam), teamReadScope(withTeam));
  assert.deepEqual(teamEditScope(teamless), teamReadScope(teamless));
});

// ---------------------------------------------- reachable, asserted as a CHAIN
//
// `teamScope` was dead at FIVE separate layers over its life: parsed but with no
// DDL, DDL but no reader, a reader but nothing populating it, populated but
// dropped from the visitor object, and — the last one — stripped by the
// normaliser every schema passes through. Each time, four of the five links were
// fine and the feature did nothing.
//
// So this asserts the whole chain from the source, because any one link missing
// makes the rest useless, and every previous fix was verified by looking at the
// link that happened to be in mind.
test("teamScope is reachable end to end", () => {
  const at = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  const worker = at("worker.js"), data = at("site-data.mjs"), schema = at("site-schema.mjs");

  // 1. the designer can ask for it
  assert.match(worker, /teamScope: \{\s*\n\s*type: "boolean"/, "the designer must be able to declare it");
  // 2. it survives the normaliser's allow-list — the fifth layer it died at
  assert.match(schema, /teamScope: !!t\.teamScope/, "normalizeSchema must carry it into _meta");
  // 3. the table gets somewhere to hold a team, as a UUID
  assert.match(schema, /"team_id" UUID/, "an organization id is a uuid, not an integer");
  assert.ok(!/"team_id" INTEGER/.test(schema), "the pre-Neon-Auth integer shape must be gone");
  // 4. the visitor query reads it OFF NEON AUTH, not off a table of ours
  assert.match(worker, /neon_auth\.member/, "membership comes from Better Auth's organization plugin");
  assert.match(worker, /AS team_id/, "the visitor query must select it");
  // 5. ...and the visitor OBJECT carries it. This is the link the fourth failure
  //    was: selected correctly, then left out of the returned object, so every
  //    member resolved as teamless.
  assert.match(worker, /team_id: u\.team_id/, "the resolved visitor must carry it");
  // 6. the read path widens on it, and 7. a write stamps it
  assert.match(data, /teamScoped\(def\)/, "the read path must act on it");
  assert.match(data, /teamStamp\(visitor\)/, "and a write must stamp it");
});
