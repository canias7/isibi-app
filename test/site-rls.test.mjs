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
import { policiesFor, grantsFor, APP_USER_FN, APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK, SESSION_JWT_EXT, SESSION_JWT_GRANTS, APP_TEAM_FN, POLICY_PREFIX } from "../site-rls.mjs";

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
  // MEMBERSHIP STILL COMES FROM NEON AUTH — it moved one level down, into
  // `app_team_id()`, because a policy that selects from `neon_auth.member` is
  // evaluated as the caller and the caller cannot reach it. This assertion used
  // to read the policy text; pointed there now it would pass vacuously for every
  // level, so it follows the fact instead of the file.
  assert.match(s, /app_team_id\(\)/);
  assert.match(APP_TEAM_FN, /neon_auth\.member/, "membership comes from Neon Auth, not a table of ours");
  assert.match(APP_TEAM_FN, /"organizationId"/);
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
  // Checked on `app_team_id`, not on `neon_auth.member`: no policy names that
  // table any more, so the old pattern would be satisfied by every level for a
  // reason having nothing to do with teamScope. A guard that cannot fail is
  // worse than no guard — it reads as coverage.
  for (const access of ["feed", "admin", "display", "collect"]) {
    assert.ok(!/app_team_id/.test(sql(T({ access, teamScope: true }))), access);
  }
  assert.match(sql(T({ access: "user", teamScope: true })), /app_team_id/,
    "and the one level that DOES widen must still widen, or the loop above proves nothing");

  // THE LOOP ABOVE PASSES FOR A REASON THAT IS NOT THE CONDITION IT LOOKS LIKE
  // IT IS TESTING — found by mutation. Only the `user` branch uses the widened
  // clause at all; `feed` reads its own, and the other three return before it.
  // So relaxing the `access === "user"` guard changes no SQL and the loop stays
  // green.
  //
  // What that guard really protects is an AGREEMENT WITH THE COLUMN: the schema
  // engine stamps `team_id` only on a `user` table that declared teamScope, so a
  // policy widening any other level would name a column that does not exist,
  // fail to CREATE — which applySiteSchema logs and carries on from — and leave
  // that table with no read policy, i.e. invisible to its own members. Asserted
  // from both files, so the two conditions cannot drift apart.
  const rls = fs.readFileSync(new URL("../site-rls.mjs", import.meta.url), "utf8");
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(rls, /t\.teamScope && access === "user"/, "the policy's condition changed");
  assert.match(engine, /t\.teamScope && access === "user"\) cols\.push\('"team_id" UUID'\)/,
    "the column's condition changed, so the policy may now reference a column no table has");
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
  // ONE STATEMENT PER ROLE, and the role is `anonymous` — Neon has no `anon`.
  // Both changed on 2026-08-04: the old spelling named a role that does not
  // exist, and Postgres refuses the whole statement, so pairing them meant
  // `authenticated` lost its grant too and no table was reachable by anybody.
  assert.deepEqual(grantsFor(T({ access: "display" })), [
    'GRANT SELECT ON "things" TO anonymous;',
    'GRANT SELECT ON "things" TO authenticated;',
  ]);
  // The important one: a collect table must never be granted SELECT.
  const collect = grantsFor(T({ access: "collect" })).join("");
  assert.match(collect, /GRANT INSERT/);
  assert.ok(!/SELECT/.test(collect), "a booking form must not be readable: " + collect);
  // And a member table is never granted to the anonymous role. Matched as a
  // whole word: `/anon/` also matches inside `anonymous`, which happens to be
  // right here but is true by accident rather than by the assertion meaning it.
  for (const access of ["user", "feed", "admin"]) {
    assert.ok(!/\banonymous\b/.test(grantsFor(T({ access })).join("")),
      access + " must not be granted to the anonymous role");
  }
});

// ---------------------------------------------- reachable, not merely defined

test("the native identity function runs as its definer", () => {
  // THE FAILURE THIS ENCODES, measured live 2026-08-05: the function existed,
  // the owner could run it, every grant on every table was correct — and every
  // member read answered `42501 permission denied for schema auth`, because the
  // native body calls `auth.user_id()` and neither Data API role had USAGE on
  // that schema. `display` and `collect` never call it, so the two levels with
  // live coverage were the two that could not break.
  //
  // The obvious fix was to grant them USAGE. Measured against a real project:
  // both statements raised NO error and the privilege stayed false, so that
  // schema is Neon's to open and not ours. Definer rights sidestep it.
  assert.match(APP_USER_FN_NATIVE, /SECURITY DEFINER/);
  assert.match(APP_USER_FN_NATIVE, /SET search_path = pg_catalog/,
    "an unpinned definer function lets a role that can create a schema choose what it runs");
  // The fallback stays INVOKER: it reads a GUC anyone may read, so definer
  // rights there would be privilege bought for nothing.
  assert.ok(!/SECURITY DEFINER/.test(APP_USER_FN_FALLBACK));
});

test("the auth-schema grants are still emitted, and nothing depends on them", () => {
  const both = SESSION_JWT_GRANTS.join("\n");
  assert.match(both, /GRANT USAGE ON SCHEMA auth TO anonymous;/);
  assert.match(both, /GRANT USAGE ON SCHEMA auth TO authenticated;/);
  // ONE STATEMENT PER ROLE, the same reason as the table grants: `TO a, b` is a
  // single statement, so a role name that stops existing takes the other with it.
  assert.equal(SESSION_JWT_GRANTS.length, 2);
  for (const g of SESSION_JWT_GRANTS) assert.ok(!/,/.test(g), "one role per statement: " + g);
  // It is only the NATIVE body that needs them — the fallback reads a GUC.
  assert.match(APP_USER_FN_NATIVE, /auth\.user_id\(\)/);
  assert.ok(!/auth\.user_id/.test(APP_USER_FN_FALLBACK), "the fallback must not depend on that schema");
});

test("the schema engine applies those grants, and only on the native path", () => {
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  // Derived from the source rather than from a comment: a constant exported and
  // never executed is the exact shape of the eleven schema features this repo
  // found parsed, stored and acted on by nothing.
  assert.match(engine, /SESSION_JWT_GRANTS/, "the engine must import it");
  const loop = engine.match(/if\s*\(jwtExt\)\s*\{[\s\S]{0,400}?SESSION_JWT_GRANTS[\s\S]{0,300}?\}/);
  assert.ok(loop, "the grants must run inside the jwtExt branch, not unconditionally");
  assert.match(loop[0], /sqlQuery\(/, "and must actually be executed");
});

test("the team clause calls a function instead of reading neon_auth inline", () => {
  const team = sql(T({ access: "user", teamScope: true }));
  // The same permission wall one table over: a policy that selects from
  // `neon_auth.member` is evaluated as the CALLER, who has no access to it. The
  // fix is not another grant — that table is every member of every organization
  // on the site, and one policy clause is not a reason to publish it.
  assert.ok(!/neon_auth/.test(team), "the policy must not reach neon_auth directly: " + team);
  assert.match(team, /app_team_id\(\)/);
  // Compared as TEXT on both sides. `team_id` is uuid and `organizationId` is
  // whatever Neon's managed Better Auth made it; `uuid = text` is not an
  // operator, so a type guess is a policy that fails to CREATE.
  assert.match(team, /"team_id"::text = app_team_id\(\)/);
  assert.match(APP_TEAM_FN, /RETURNS text/);
  // A table that is not team-scoped must not widen at all.
  assert.ok(!/app_team_id/.test(sql(T({ access: "user" }))), "own-rows only unless declared");
});

test("app_team_id runs as its definer, with the search path pinned", () => {
  assert.match(APP_TEAM_FN, /SECURITY DEFINER/);
  // Without this a role that can create a schema ahead of the search path
  // chooses what the definer executes. Every name in the body is qualified for
  // the same reason.
  assert.match(APP_TEAM_FN, /SET search_path = pg_catalog/);
  assert.match(APP_TEAM_FN, /neon_auth\.member/);
  assert.match(APP_TEAM_FN, /public\.app_user_id\(\)/);
  // It takes NO ARGUMENT, which is what makes the definer rights safe: there is
  // no id to pass, so it can only ever answer for the caller.
  assert.match(APP_TEAM_FN, /FUNCTION app_team_id\(\)/);
});

test("the schema engine creates app_team_id", () => {
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  // The whole statement, with `await` anchored straight after the brace. Written
  // as a bare mention of the call it passed against
  // `try { if (false) await sqlQuery(uuid, APP_TEAM_FN); }` — the same survivor
  // shape as `} finally { if (false)` earlier in this repo. A named constant
  // that is imported and never actually executed is exactly how eleven schema
  // features ended up parsed, stored and acted on by nothing.
  assert.match(engine, /try \{ await sqlQuery\(uuid, APP_TEAM_FN\); \}/);
});
