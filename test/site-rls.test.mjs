// Row-level security for a site's tables.
//
// These policies are ADDITIONAL to the Worker's enforcement, not a replacement,
// and every test here is written on that basis: the question is never "does this
// stop a stranger" — `site-data.mjs` already does — it is "would this be right if
// it were the only thing standing there", because when Neon's Data API is turned
// on it will be.
//
// The failures that matter all run in the same direction: a policy that permits
// more than the Worker does. A policy that permits less is a broken feature; one
// that permits more is somebody's bookings on the open internet.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { policiesFor, grantsFor, APP_USER_FN, APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK, SESSION_JWT_EXT, POLICY_PREFIX } from "../site-rls.mjs";

const sql = (t) => policiesFor(t).join("\n");
const T = (over) => ({ name: "things", access: "user", columns: [{ name: "title" }], ...over });

// --------------------------------------------------------------- the identity fn

test("identity uses Neon's own pg_session_jwt, with a fallback that can still parse", () => {
  // `pg_session_jwt` verifies the session JWT inside Postgres and exposes
  // `auth.user_id()`. It is on the available list (0.5.0), which I only found by
  // asking pg_available_extensions instead of guessing four names — the first
  // version of this file hand-rolled the same thing out of PostgREST's claims
  // setting, and I had flagged that as a guess.
  assert.match(SESSION_JWT_EXT, /CREATE EXTENSION IF NOT EXISTS pg_session_jwt/);
  assert.match(APP_USER_FN_NATIVE, /auth\.user_id\(\)/);

  // Both forms exist because the fallback is not dead weight: a project without the
  // extension would otherwise define a function referencing one that does not
  // exist, which fails to PARSE, and every policy built on it fails with it.
  assert.match(APP_USER_FN_FALLBACK, /current_setting\('request\.jwt\.claims',\s*true\)/,
    "missing_ok — without it the fallback RAISES on every connection with no claims set");

  for (const fn of [APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK, APP_USER_FN]) {
    assert.match(fn, /RETURNS uuid/, "owner_id is a uuid, so this must be too");
    // STABLE, not VOLATILE: called per row, and the planner must be free to hoist
    // it out of the scan.
    assert.match(fn, /STABLE/);
    // OR REPLACE, because applySiteSchema re-runs on every revise.
    assert.match(fn, /CREATE OR REPLACE FUNCTION app_user_id/);
  }
});

test("the engine tries the native form first and falls back rather than giving up", () => {
  // Without a fallback, one unavailable extension leaves a site with no
  // app_user_id() at all — and a policy referencing a missing function refuses
  // everything, so the site's own members can read nothing.
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(engine, /SESSION_JWT_EXT/, "the extension must be attempted");
  assert.match(engine, /jwtExt \? APP_USER_FN_NATIVE : APP_USER_FN_FALLBACK/, "and decide from whether it worked");
  assert.match(engine, /if \(jwtExt\) \{ try \{ await sqlQuery\(uuid, APP_USER_FN_FALLBACK\)/,
    "a native form refused for some other reason must still leave a working function");
});


// --------------------------------------------------------------- always true

test("RLS is enabled on every table, whatever its access level", () => {
  for (const access of ["display", "collect", "user", "feed", "admin"]) {
    assert.match(sql(T({ access })), /ENABLE ROW LEVEL SECURITY/, access);
  }
});

test("policies are dropped before they are created, so a revise is idempotent", () => {
  // CREATE POLICY has no IF NOT EXISTS and applySiteSchema re-runs in full, so
  // without the drops every revise would log four failures and change nothing.
  const s = sql(T({ access: "user" }));
  const dropAt = s.indexOf("DROP POLICY");
  const createAt = s.indexOf("CREATE POLICY");
  assert.ok(dropAt >= 0 && createAt > dropAt, "drops must come first:\n" + s);
  assert.match(s, /DROP POLICY IF EXISTS/, "the first run has nothing to drop");
});

test("EVERY policy shape is dropped, not only the ones this level creates", () => {
  // The case this exists for is a revise that CHANGES a table's access level. A
  // `display` table that becomes `user` would otherwise keep its old
  // "USING (true)" read policy and stay readable by everyone — the new policy is
  // added alongside, and Postgres ORs permissive policies together.
  const s = sql(T({ access: "user" }));
  for (const shape of ["read", "insert", "update", "delete"]) {
    assert.ok(s.includes('DROP POLICY IF EXISTS "' + POLICY_PREFIX + 'things_' + shape + '"'), shape + " is not dropped:\n" + s);
  }
});

// --------------------------------------------------------------- per level

test("display: anyone reads, and there is NO write policy", () => {
  const s = sql(T({ access: "display" }));
  assert.match(s, /FOR SELECT USING \(true\)/);
  assert.ok(!/FOR INSERT|FOR UPDATE|FOR DELETE/.test(s), "content is the owner's, changed through their own door:\n" + s);
});

test("collect: anyone writes and NOBODY reads — enforced by omission", () => {
  // The absence of a SELECT policy is what makes it write-only. With RLS on, no
  // policy means no rows, so this cannot be weakened by putting a filter in the
  // wrong clause. A booking form must submit and must never list other people's
  // bookings.
  const s = sql(T({ access: "collect" }));
  assert.match(s, /FOR INSERT WITH CHECK \(true\)/);
  assert.ok(!/FOR SELECT/.test(s), "a collect table must have no read policy at all:\n" + s);
});

test("user: own rows only, on reads AND writes", () => {
  const s = sql(T({ access: "user" }));
  assert.match(s, /FOR SELECT USING \(\("things"\."owner_id" = app_user_id\(\)\)\)/);
  assert.match(s, /FOR UPDATE USING/);
  assert.match(s, /FOR DELETE USING/);
  // WITH CHECK on the new row for an insert, or a member could create a row owned
  // by somebody else.
  assert.match(s, /FOR INSERT WITH CHECK \("things"\."owner_id" = app_user_id\(\)\)/);
  // An UPDATE needs both: USING to reach the existing row, WITH CHECK so it cannot
  // be reassigned to another owner on the way out.
  const upd = s.split("\n").find((l) => /FOR UPDATE/.test(l));
  assert.match(upd, /USING .*WITH CHECK/, upd);
});

test("feed: any signed-in member reads, each writes only their own", () => {
  const s = sql(T({ access: "feed" }));
  assert.match(s, /FOR SELECT USING \(app_user_id\(\) IS NOT NULL\)/);
  assert.match(s, /FOR INSERT WITH CHECK \("things"\."owner_id" = app_user_id\(\)\)/);
  // The read is shared and the write is not. If the write policy ever read the
  // same clause as the read, any member could edit anybody's post.
  const ins = s.split("\n").find((l) => /FOR INSERT/.test(l));
  assert.ok(!/IS NOT NULL/.test(ins), "a feed WRITE must be scoped to the author: " + ins);
});

test("feed and user are NOT readable to somebody signed out", () => {
  // app_user_id() is NULL with no claims, so both clauses are false. Asserted
  // because "signed out" is the state every uninvited visitor is in.
  for (const access of ["feed", "user"]) {
    const s = sql(T({ access }));
    const read = s.split("\n").find((l) => /FOR SELECT/.test(l));
    assert.ok(/app_user_id\(\)/.test(read), access + " read must depend on identity: " + read);
    assert.ok(!/USING \(true/.test(read), access + " must not be world-readable: " + read);
  }
});

test("admin: reads for anyone signed in, and writing is REFUSED at the database", () => {
  // `writeRoles` names roles that mean something to this application and nothing
  // to Postgres, so the write stays the Worker's decision. Omitting the policy
  // refuses it here, which is the safe direction — the Worker's own door still
  // allows it.
  const s = sql(T({ access: "admin", writeRoles: ["editor"] }));
  assert.match(s, /FOR SELECT USING \(app_user_id\(\) IS NOT NULL\)/);
  assert.ok(!/FOR INSERT|FOR UPDATE|FOR DELETE/.test(s), "no write policy:\n" + s);
});

// --------------------------------------------------------------- teams

test("a team-shared table widens to the caller's organization", () => {
  const s = sql(T({ access: "user", teamScope: true }));
  assert.match(s, /neon_auth\.member/, "membership comes from Neon Auth, not a table of ours");
  assert.match(s, /"organizationId"/);
});

test("a member in NO organization still sees only their own rows", () => {
  // The assertion that matters, restated at the database. The subquery returns
  // NULL for a member in no organization, and `team_id = NULL` is NULL rather than
  // true — correct by accident, so the IS NOT NULL is written explicitly.
  const s = sql(T({ access: "user", teamScope: true }));
  assert.match(s, /"team_id" IS NOT NULL AND/,
    "without this the null case rests on NULL comparison semantics rather than on intent:\n" + s);
});

test("teamScope on a non-user table is ignored, as it is everywhere else", () => {
  for (const access of ["feed", "admin", "display", "collect"]) {
    assert.ok(!/neon_auth\.member/.test(sql(T({ access, teamScope: true }))), access);
  }
});

// --------------------------------------------------------------- trash

test("a soft-deleted row is invisible to a reader, not just to the Worker", () => {
  // Without this the Data API would serve rows the site itself treats as deleted.
  for (const access of ["display", "user", "feed", "admin"]) {
    const s = sql(T({ access, trash: true }));
    const read = s.split("\n").find((l) => /FOR SELECT/.test(l));
    assert.match(read, /"deleted_at" IS NULL/, access + ": " + read);
  }
});

test("the trash clause is ANDed, never ORed", () => {
  // ORed, it would make every row visible whenever it is not deleted — which is
  // most rows — and silently drop the owner scope.
  const read = sql(T({ access: "user", trash: true })).split("\n").find((l) => /FOR SELECT/.test(l));
  assert.match(read, /AND "things"\."deleted_at" IS NULL/, read);
  // \bOR\b, not /OR /: the first draft of this matched the "OR" inside "FOR
  // SELECT" and failed on a correct policy.
  assert.ok(!/\bOR\b[^)]*deleted_at/.test(read), read);
});

// --------------------------------------------------------------- identifiers

test("a table name is quoted, and a quote in it cannot break out", () => {
  const s = sql(T({ name: 'we"ird' }));
  assert.match(s, /"we""ird"/, "a double quote must be doubled, not passed through:\n" + s);
});

// --------------------------------------------------------------- grants

test("policies are applied BEFORE the grants that make a table reachable", () => {
  // Policies decide what a role MAY see; a GRANT decides whether it can ask at
  // all. Both are applied now that the Data API is on — and the ORDER is the
  // property worth pinning: granting first leaves a window, however short, where a
  // role can ask and no policy has decided what it may see.
  //
  // This test previously asserted the OPPOSITE (that no grant was applied yet), and
  // it fired the moment grants arrived. That is the intended lifecycle: the guard
  // made the exposing change impossible to slip in quietly.
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const call = engine.match(/policiesFor\([^)]*\)[\s\S]{0,60}?grantsFor/);
  assert.ok(call, "the engine must apply policies then grants, in that order, in one list");
});

test("a grant never gives more than the level allows", () => {
  assert.deepEqual(grantsFor(T({ access: "display" })), ['GRANT SELECT ON "things" TO anon, authenticated;']);
  // The important one: a collect table must never be granted SELECT.
  const collect = grantsFor(T({ access: "collect" })).join("");
  assert.match(collect, /GRANT INSERT/);
  assert.ok(!/SELECT/.test(collect), "a booking form must not be readable: " + collect);
  // And a member table is never granted to anon.
  for (const access of ["user", "feed", "admin"]) {
    assert.ok(!/anon/.test(grantsFor(T({ access })).join("")), access + " must not be granted to anon");
  }
});
