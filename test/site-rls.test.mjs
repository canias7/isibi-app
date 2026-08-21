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
import { policiesFor, grantsFor, publicViewSql, liveConditions, APP_USER_FN, APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK, SESSION_JWT_EXT, SESSION_JWT_GRANTS, APP_TEAM_FN, POLICY_PREFIX } from "../site-rls.mjs";
import { ACCESS_PRESETS, resolveAccess } from "../site-access.mjs";

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
  // ASSERTED AS AN AGREEMENT BETWEEN THE TWO FILES, not as a spelling. This
  // pinned the literal `t.teamScope && access === "user"` in both, and went red
  // on a correct change — the read/write split, where the condition became
  // "the read is own-scoped" and stayed exactly as narrow. Word order again.
  //
  // What it protects is unchanged and is the reason it must not simply be
  // deleted: the policy widens to the team, and the ENGINE stamps the column
  // that clause names. Widen on a condition the engine does not stamp on and
  // the policy names a column that does not exist, fails to CREATE — which
  // applySiteSchema logs and carries on from — and the table is left with NO
  // read policy at all, i.e. invisible to its own members.
  const rls = fs.readFileSync(new URL("../site-rls.mjs", import.meta.url), "utf8");
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const norm = (x) => x.replace(/resolveAccess\(t\)/g, "rw").replace(/\s+/g, " ").trim();
  const policyCond = (rls.match(/const ours = \(([^)]*\)?[^)]*)\)\s*\n/) || [])[1];
  const columnCond = (engine.match(/if \((t\.teamScope[^)]*(?:\([^)]*\))?[^)]*)\) cols\.push\('"team_id" UUID/) || [])[1];
  assert.ok(policyCond, "the policy's team-widening condition could not be read");
  assert.ok(columnCond, "the engine's team_id condition could not be read");
  assert.equal(norm(policyCond).replace(/^t && /, ""), norm(columnCond),
    "the policy widens on a different condition than the one the column is stamped on:\n  policy: " +
    norm(policyCond) + "\n  column: " + norm(columnCond));
  // …and both are still NARROW. Two conditions can agree perfectly and both be
  // wrong — `true` on each side would pass the equality above.
  assert.match(norm(policyCond), /teamScope/, "the policy no longer requires teamScope at all");
  assert.match(norm(policyCond), /read === "own"/, "the policy widens on something other than an own-scoped read");
});

test("policiesFor never reads the raw `access` field — only the resolved pair", () => {
  // THE PAIR BUG, GUARDED AT THE ONE PLACE IT WOULD COST THE MOST. `access` is a
  // shorthand AND a field `normalizeSchema` stamps onto every table that declared
  // a read/write pair instead — so the raw value names a preset the designer
  // never wrote. Five readers have already made that mistake; this function held
  // a `const access` binding of exactly that shape, declared and never used,
  // until it was deleted. The invariant is that the binding cannot come back.
  const rls = fs.readFileSync(new URL("../site-rls.mjs", import.meta.url), "utf8");
  const at = rls.indexOf("export function policiesFor");
  assert.ok(at > 0, "policiesFor could not be found — retarget this guard");
  const end = rls.indexOf("\nexport ", at + 10);
  assert.ok(end > at, "the end of policiesFor could not be found — retarget this guard");
  // COMMENTS BLANKED BEFORE JUDGING, and this is not optional: the comment that
  // now sits at the top of that function explains the bug by NAMING `t.access`,
  // so an absence guard reading raw source fails against its own fix. Blanked
  // rather than removed, so nothing else here shifts.
  const code = rls.slice(at, end)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  // The floor first — a slice that stopped matching would report a clean
  // function and prove nothing.
  assert.match(code, /resolveAccess\(t\)/, "policiesFor no longer resolves the pair at all");
  assert.doesNotMatch(code, /\.access\b/,
    "policiesFor reads the raw `access` field again — decide from resolveAccess(t) instead");
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
  // THE GRANTS, apart from the REVOKEs that now lead every list. Grants used to
  // be additive-only — nothing ever took one back — so `retired` withdrew
  // nothing and a removed booking form kept accepting submissions.
  assert.deepEqual(grantsFor(T({ access: "display" })).filter((s) => /^GRANT /.test(s)), [
    'GRANT SELECT ON "things" TO anonymous;',
    'GRANT SELECT ON "things" TO authenticated;',
  ]);
  // …and the revokes come FIRST, or a re-issued privilege is taken straight
  // back off and every table is unreachable.
  const all = grantsFor(T({ access: "display" }));
  assert.match(all[0], /^REVOKE ALL ON "things" FROM anonymous;/);
  assert.match(all[1], /^REVOKE ALL ON "things" FROM authenticated;/);
  assert.ok(all.findIndex((s) => /^GRANT /.test(s)) > all.findLastIndex((s) => /^REVOKE /.test(s)),
    "a grant is issued before the revoke that would undo it");
  // The important one: a collect table must never be granted SELECT.
  const collect = grantsFor(T({ access: "collect" })).join("");
  assert.match(collect, /GRANT INSERT/);
  assert.ok(!/SELECT/.test(collect), "a booking form must not be readable: " + collect);
  // And a member table is never granted to the anonymous role. Matched as a
  // whole word: `/anon/` also matches inside `anonymous`, which happens to be
  // right here but is true by accident rather than by the assertion meaning it.
  // GRANTS ONLY. Every list now leads with `REVOKE ALL … FROM anonymous`, which
  // names the role while doing the exact opposite of granting to it — so a
  // string search over the whole list reports the role as granted on a table
  // that has just had its privileges taken away.
  for (const access of ["user", "feed", "admin"]) {
    const granted = grantsFor(T({ access })).filter((x) => /^GRANT /.test(x)).join("");
    assert.ok(!/\banonymous\b/.test(granted), access + " must not be granted to the anonymous role");
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

test("owner_id fills itself in, or the member tier can read and never write", () => {
  // Nothing stamps it any more: the Worker's data path did, and it went with
  // `site-data.mjs` on 2026-07-30. So a member's insert reached Postgres with
  // `owner_id` NULL, `WITH CHECK (owner_id = app_user_id())` evaluated NULL, and
  // every write answered 403 while every read worked. Measured live 2026-08-05.
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  assert.match(engine, /cols\.push\('"owner_id" UUID DEFAULT app_user_id\(\)'\)/,
    "a fresh table's owner_id must fill itself in");
  // The revise path needs its OWN statement — `ADD COLUMN IF NOT EXISTS` does
  // nothing when the column is already there, so every site built before this
  // would keep refusing writes forever.
  assert.match(engine, /ALTER COLUMN "owner_id" SET DEFAULT app_user_id\(\)/,
    "an existing table never gains the default from ADD COLUMN IF NOT EXISTS");
  // AND THE POLICY STAYS. The default is for a client that omits the column; the
  // WITH CHECK is what stops one that SENDS it claiming another member's id.
  // Dropping either leaves a hole the other does not cover.
  assert.match(sql(T({ access: "user" })), /FOR INSERT WITH CHECK \("things"\."owner_id" = app_user_id\(\)\)/);
});

test("a team-scoped row stamps the caller's team, safely", () => {
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  // Same reason owner_id defaults to the caller: nothing stamps it since the
  // Worker's data path went, so a row created by a member carried team_id NULL
  // and their colleagues could not see it — the widening quietly did nothing.
  assert.match(engine, /cols\.push\('"team_id" UUID DEFAULT ' \+ TEAM_DEFAULT\)/);
  assert.match(engine, /ALTER COLUMN "team_id" SET DEFAULT ' \+ TEAM_DEFAULT/,
    "an existing table never gains a default from ADD COLUMN IF NOT EXISTS");
  // ONE CONSTANT, both call sites. Two spellings would be a table whose
  // behaviour depends on when it was built.
  const uses = engine.match(/TEAM_DEFAULT/g) || [];
  assert.equal(uses.length, 3, "declared once, used at both the create and the revise: " + uses.length);
  // THE CAST IS GUARDED, and that is the whole decision. `app_team_id()` returns
  // text and a bare `::uuid` on anything else THROWS, which would make every
  // write to a team table fail. Guarded, a non-uuid becomes NULL — the row is
  // not shared, which is the failure an owner can live with. Measured: the
  // column really is uuid, so this is expected to take; the guard is for the
  // deployment where that stops being true.
  const decl = engine.match(/const TEAM_DEFAULT = "([^"]+)"/);
  assert.ok(decl, "TEAM_DEFAULT is no longer a single literal");
  assert.match(decl[1], /CASE WHEN app_team_id\(\) ~\*/, "a bare cast would throw on every write: " + decl[1]);
  assert.match(decl[1], /THEN app_team_id\(\)::uuid END/);
  // `~*`, because a uuid can arrive uppercased and `~` would reject it.
  assert.ok(!/ ~ /.test(decl[1]), "case-sensitive matching drops an uppercased uuid: " + decl[1]);
});

/* ---------------------------- read and write as two axes, not five bundles */

test("the five presets emit EXACTLY what they always did", () => {
  // THE WHOLE SAFETY ARGUMENT FOR THIS CHANGE. Splitting access into a
  // read/write pair rewrote the security layer of every published site, and the
  // only responsible way to do that is to prove the five existing levels come
  // out unchanged and the new cells are purely additive.
  //
  // Asserted as PROPERTIES of each preset rather than as a captured string, so
  // it keeps meaning something after a deliberate future change to the SQL.
  const kinds = (t) => policiesFor(t).filter((x) => x.startsWith("CREATE POLICY"))
    .map((x) => (x.match(/FOR (\w+)/) || [])[1]).join(",");
  const expect = {
    display: "SELECT",
    collect: "INSERT",
    user: "SELECT,INSERT,UPDATE,DELETE",
    feed: "SELECT,INSERT,UPDATE,DELETE",
    admin: "SELECT",
  };
  for (const [access, want] of Object.entries(expect)) {
    assert.equal(kinds({ name: "t", access }), want, access);
    // …and declaring the same thing as a pair reaches identical SQL, which is
    // what makes the presets presets rather than a parallel implementation.
    const pair = ACCESS_PRESETS[access];
    assert.deepEqual(policiesFor({ name: "t", ...pair }), policiesFor({ name: "t", access }),
      access + " declared as a pair produces different policies than the preset");
    assert.deepEqual(grantsFor({ name: "t", ...pair }), grantsFor({ name: "t", access }),
      access + " declared as a pair produces different grants than the preset");
  }
});

test("a read of `none` emits no SELECT policy AND no SELECT grant", () => {
  // The write-only guarantee, which used to be a property of the NAME `collect`
  // and is now a property of the axis. Both halves matter: a policy with no
  // grant is unreachable, a grant with no policy returns nothing — and the
  // protection is the ABSENCE of the statement, which no filter in the wrong
  // clause can weaken.
  for (const t of [{ name: "t", access: "collect" }, { name: "t", read: "none", write: "anyone" },
                   { name: "t", read: "none", write: "own" }]) {
    assert.ok(!policiesFor(t).some((x) => /FOR SELECT/.test(x)), "a SELECT policy was emitted: " + JSON.stringify(t));
    assert.ok(!grantsFor(t).some((x) => /GRANT SELECT/.test(x)), "a SELECT grant was emitted: " + JSON.stringify(t));
  }
  // …and a readable table really does get both, or the loop above passes on a
  // builder that has stopped emitting anything at all.
  const open = { name: "t", read: "public", write: "none" };
  assert.ok(policiesFor(open).some((x) => /FOR SELECT USING \(true/.test(x)));
  assert.ok(grantsFor(open).some((x) => /GRANT SELECT ON "t" TO anonymous/.test(x)));
});

test("anyone-writes never gets UPDATE or DELETE, on any pair", () => {
  // An anonymous visitor may leave a row and must never reach one again — not
  // their own, since nothing proves it is theirs, and certainly not anybody
  // else's. True of `collect` today; now true of the axis, so a new cell that
  // opens the reads cannot quietly open the edits with them.
  for (const read of ["none", "members", "public"]) {
    const p = policiesFor({ name: "t", read, write: "anyone" });
    assert.ok(!p.some((x) => /FOR (UPDATE|DELETE)/.test(x)), "read:" + read + " let an anonymous visitor edit rows");
    assert.ok(p.some((x) => /FOR INSERT/.test(x)), "read:" + read + " cannot be written at all");
  }
});

test("the cell this was built for: anyone reads, members write their own", () => {
  // The marketplace / classifieds / job board / public reviews shape, which the
  // five names could not express at all — `display` is public but nobody writes,
  // `feed` is member-written but needs a sign-in to read.
  const t = { name: "listings", read: "public", write: "own" };
  const p = policiesFor(t), g = grantsFor(t);
  assert.match(p.find((x) => /FOR SELECT/.test(x)), /USING \(true/, "the public cannot read the listings");
  assert.match(p.find((x) => /FOR INSERT/.test(x)), /owner_id" = app_user_id\(\)/, "a member could post as somebody else");
  assert.match(p.find((x) => /FOR UPDATE/.test(x)), /owner_id" = app_user_id\(\)/, "a member could edit somebody else's listing");
  // THE GRANT THE FIRST DRAFT DROPPED. The member branch returned early and
  // discarded the anonymous SELECT collected above, so the one cell this whole
  // change exists for published a table the public still could not read. Caught
  // by printing the new cells rather than by trusting the composition.
  assert.ok(g.some((x) => /GRANT SELECT ON "listings" TO anonymous/.test(x)),
    "the public has no SELECT grant, so the listings 403 however open the policy is");
  assert.ok(g.some((x) => /GRANT SELECT, INSERT, UPDATE, DELETE ON "listings" TO authenticated/.test(x)));
});

test("own-read with anyone-write is refused, because it cannot mean anything", () => {
  // "Own" needs an identity to be own OF and an anonymous insert has none, so
  // the row would be owned by nobody and readable by nobody. That is `read:
  // "none"` wearing a misleading name, and it resolves to exactly that rather
  // than emitting a policy that silently matches no row ever.
  assert.deepEqual(resolveAccess({ read: "own", write: "anyone" }), { read: "none", write: "anyone" });
  assert.deepEqual(policiesFor({ name: "t", read: "own", write: "anyone" }),
    policiesFor({ name: "t", access: "collect" }), "it must degrade to exactly collect");
});

test("a payable table gets no public insert, however its access was spelled", () => {
  // The security model is the MISSING GRANT, not a validation. Keyed on the
  // write axis now, so a payable table declared as a pair is protected too —
  // keyed on the name `collect`, it would not have been.
  for (const t of [{ name: "orders", access: "collect", payment: { from: "products" } },
                   { name: "orders", read: "none", write: "anyone", payment: { from: "products" } },
                   { name: "orders", read: "public", write: "anyone", payment: { from: "products" } }]) {
    assert.deepEqual(grantsFor(t).filter((s) => /^GRANT (INSERT|UPDATE|DELETE|ALL)/.test(s)), [],
      "a payable table is writable without going through checkout: " + JSON.stringify(t));
  }
  // …and without payment it IS insertable, or the loop passes on a builder that
  // grants nothing to anybody.
  assert.ok(grantsFor({ name: "orders", access: "collect" }).some((x) => /GRANT INSERT/.test(x)));
});

test("every column a policy names is one the engine actually stamps", () => {
  // THE INVARIANT BEHIND BOTH `owner_id` AND `team_id`, asserted as an agreement
  // between the two files rather than as a spelling in either. A policy naming a
  // column the engine did not create fails to CREATE — which applySiteSchema
  // logs and carries on from — leaving the table with NO policy of that kind:
  // silently readable by nobody, or writable by nobody, with a green build.
  //
  // A mutation stopping `owner_id` from ever being stamped survived the whole
  // suite, because nothing tied the policy's reference to the column's creation.
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const stampsOwner = /if \(rw\.write === "own" \|\| rw\.read === "own"\) \{ cols\.push\('"owner_id" UUID/.test(engine);
  assert.ok(stampsOwner, "the engine no longer stamps owner_id on member-scoped writes");

  // Now drive it: every pair whose POLICIES mention owner_id must be a pair the
  // engine stamps it for, and every pair it stamps for must have a policy using
  // it — checked in both directions so neither side can drift alone.
  for (const read of ["none", "own", "members", "public"]) {
    for (const write of ["none", "own", "members", "anyone"]) {
      const pair = resolveAccess({ read, write });
      const sql = policiesFor({ name: "t", read, write }).join("\n");
      const named = /owner_id/.test(sql);
      const stamped = pair.write === "own" || pair.read === "own";
      assert.equal(named, stamped,
        `read:${read} write:${write} — policies ${named ? "name" : "do not name"} owner_id but the engine ` +
        `${stamped ? "stamps" : "does not stamp"} it`);
    }
  }
});

/* ------------------------------- expiring and scheduled rows hide themselves */

test("an expired row and an unpublished row are hidden by the POLICY", () => {
  // THEIR OWN COMMENTS IN THE SCHEMA ENGINE CLAIMED THIS AND IT WAS NOT TRUE.
  // `expires` says "reads hide rows past it", `scheduled` says "hidden until
  // this time" — that filtering lived in the Worker's own read path, deleted
  // when the data layer moved to Neon. The columns stayed and the WHERE that
  // used them did not, so an expiring offer never expired.
  //
  // In the POLICY rather than in the generated page, deliberately: a rule the
  // model must remember on every list of every page is one it will eventually
  // forget, and forgetting means a shop advertising last month's price.
  const sel = (t) => policiesFor(t).find((x) => /FOR SELECT/.test(x)) || "";
  assert.match(sel({ name: "offers", access: "display", expires: true }),
    /"offers"\."expires_at" IS NULL OR "offers"\."expires_at" > to_char\(now\(\)/,
    "an expired row is still served");
  assert.match(sel({ name: "posts", access: "display", scheduled: true }),
    /"posts"\."publish_at" IS NULL OR "posts"\."publish_at" <= to_char\(now\(\)/,
    "a row is public before its publish date");
  // NULL MEANS "NEVER EXPIRES" / "ALREADY LIVE", and it has to be admitted
  // explicitly: `expires_at > now` is NULL for an unset column, which is not
  // true, so every row without a date would vanish. This is the clause that
  // decides whether the feature is useful or catastrophic.
  for (const t of [{ name: "t", access: "display", expires: true }, { name: "t", access: "display", scheduled: true }]) {
    assert.match(sel(t), /IS NULL OR/, "a row with no date set would be hidden: " + JSON.stringify(t));
  }
  // …and a table declaring neither is untouched, so no existing site changes.
  assert.equal(sel({ name: "t", access: "display" }).includes("expires_at"), false);
  assert.equal(sel({ name: "t", access: "display" }).includes("publish_at"), false);
  // All three filters compose rather than replacing each other.
  const all = sel({ name: "t", access: "display", trash: true, expires: true, scheduled: true });
  for (const c of ["deleted_at", "expires_at", "publish_at"]) assert.ok(all.includes(c), c + " was lost when combined");
});

test("the filters are on the READ, never on the write", () => {
  // An owner must still be able to edit a row that has expired or has not gone
  // live yet — that is the whole point of a publish date. Applied to the write
  // policies too, a scheduled post could not be corrected before it appeared.
  const p = policiesFor({ name: "t", access: "user", expires: true, scheduled: true });
  for (const x of p) {
    if (/FOR (INSERT|UPDATE|DELETE)/.test(x)) {
      assert.ok(!/expires_at|publish_at/.test(x), "a write policy filters on time: " + x);
    }
  }
});

test("a retired table gets no policy, not just no grant", () => {
  // TWO HALVES OF ONE ANSWER THAT DISAGREED. `grantsFor` honoured `retired` and
  // this function ignored it entirely — so retiring a booking form dropped its
  // policy shapes and then RE-CREATED `FOR INSERT WITH CHECK (true)` on the way
  // out. With the grant that nothing revoked, the removed form went on accepting
  // submissions from anyone.
  for (const access of ["display", "collect", "user", "feed", "admin"]) {
    const out = policiesFor({ name: "t", access, retired: true });
    assert.deepEqual(out.filter((s) => /^CREATE POLICY/.test(s)), [],
      access + ": a retired table is given a policy");
    // The DROPs must still run — that is what makes retiring take effect on a
    // table that already had policies.
    assert.ok(out.some((s) => /^DROP POLICY IF EXISTS/.test(s)),
      access + ": retiring stops dropping the policies it already had");
  }
  // …and the un-retired case still creates something, or this proves nothing.
  assert.ok(policiesFor({ name: "t", access: "display" }).some((s) => /^CREATE POLICY/.test(s)));
});

test("a payable table gets no write policy on any pair", () => {
  // The only way an order may exist is POST /api/db/<slug>/checkout, which
  // prices the basket from the site's own rows and inserts on the OWNER's
  // connection — bypassing RLS. So a write policy here grants nothing the
  // platform needs and is one mistake away from mattering.
  const READ = ["none", "own", "members", "public"], WRITE = ["none", "own", "members", "anyone"];
  for (const read of READ) for (const write of WRITE) {
    const out = policiesFor({ name: "orders", read, write, payment: { from: "products", amount: "price" } });
    const writes = out.filter((s) => /^CREATE POLICY[\s\S]*FOR (INSERT|UPDATE|DELETE)/.test(s));
    assert.deepEqual(writes, [], `payable read=${read} write=${write} still has a write policy`);
  }
  // Reads are untouched — a customer must still see what they are buying.
  assert.ok(policiesFor({ name: "orders", read: "public", write: "own", payment: { from: "p", amount: "price" } })
    .some((s) => /FOR SELECT/.test(s)), "a payable table stopped being readable");
  // And an ORDINARY table still gets its write policy, or this removed the tier.
  assert.ok(policiesFor({ name: "b", access: "collect" }).some((s) => /FOR INSERT/.test(s)));
});

/* ---------------------------------------------------------------------------
 * THE 4x4 GRID, ASKED OF ALL THREE OBJECTS AT ONCE.
 *
 * All three failures below are the same shape: a rule applied to one object in
 * the grid and not to its partner. `retired` was honoured by `policiesFor` and
 * `grantsFor` and ignored by `publicViewSql`; the `live` clause was added to
 * `policiesFor` and to nothing else; the REVOKE pair was emitted on eight of the
 * sixteen cells while its own comment claimed every table. A fix aimed at the
 * one cell each finding named would have left the other fifteen, so every
 * assertion here is driven over the whole grid AND over the five presets — and
 * each is paired with a floor, since a loop over an emitter that has stopped
 * emitting anything satisfies every absence in it.
 * ------------------------------------------------------------------------- */

const READS = ["none", "own", "members", "public"];
const WRITES = ["none", "own", "members", "anyone"];
/** Every way a table's access can be spelled: the 16 cells and the 5 shorthands. */
const CELLS = [];
for (const read of READS) for (const write of WRITES) CELLS.push({ read, write });
for (const access of Object.keys(ACCESS_PRESETS)) CELLS.push({ access });
const cellName = (c) => c.access ? `access:${c.access}` : `read:${c.read} write:${c.write}`;

/** The projection a real booking table declares — the case both view findings name. */
const PV = { columns: ["appointment_date", "appointment_time"], where: ["status:ne:cancelled"] };
const PV_COLS = ["appointment_date", "appointment_time", "status"];

test("a retired table publishes NOTHING — not its rows, and not a projection of them", () => {
  // MEASURED BEFORE THE FIX, on `{name:"bookings", access:"collect", retired:true,
  // publicView:{columns:[...]}}`: policiesFor emitted the DROPs and stopped,
  // grantsFor emitted only the two REVOKEs — and publicViewSql went on to
  // `CREATE VIEW … security_invoker = false` and `GRANT SELECT … TO anonymous`.
  // applySiteSchema runs the three lists in order, so the retire was undone one
  // statement later, on that apply and on every apply after it.
  //
  // Asserted over the CONCATENATION rather than over publicViewSql alone,
  // because that is what the engine actually executes — a per-function
  // assertion passes while the three lists still disagree with each other.
  for (const cell of CELLS) {
    const t = { name: "bookings", ...cell, retired: true, publicView: PV };
    const all = policiesFor(t).concat(grantsFor(t)).concat(publicViewSql(t, PV_COLS));
    const opens = all.filter((s) => /^(CREATE POLICY|CREATE VIEW|GRANT )/.test(s));
    assert.deepEqual(opens, [],
      cellName(cell) + ": a retired table still opens something:\n" + opens.join("\n"));
    // …and the withdrawal has to TAKE EFFECT on a table that already had these
    // objects, which is what the unconditional DROPs are for.
    assert.ok(all.some((s) => /^DROP VIEW IF EXISTS "bookings_public";/.test(s)),
      cellName(cell) + ": retiring stops dropping the view it already published");
    assert.ok(all.some((s) => /^DROP POLICY IF EXISTS/.test(s)), cellName(cell));
    assert.ok(all.some((s) => /^REVOKE ALL ON "bookings"/.test(s)), cellName(cell));
  }
  // THE FLOOR. Un-retired, the same table really does create and grant the view
  // — without this every assertion above is satisfied by an emitter that has
  // stopped producing a projection at all.
  const live = publicViewSql({ name: "bookings", access: "collect", publicView: PV }, PV_COLS);
  assert.ok(live.some((s) => /^CREATE VIEW "bookings_public"/.test(s)), live.join("\n"));
  assert.ok(live.some((s) => /^GRANT SELECT ON "bookings_public" TO anonymous;/.test(s)));
  // Reversible in both directions, like the grants: the withdrawal is the
  // absence of the CREATE, not a destroyed declaration.
  assert.deepEqual(publicViewSql({ name: "bookings", access: "collect", publicView: PV, retired: false }, PV_COLS), live);
});

test("the public projection hides the same rows the read policy hides", () => {
  // THE VIEW IS `security_invoker = false`, so it runs as the table owner and
  // bypasses RLS entirely — the read policy's `live` clause never applies to it.
  // Measured before the fix on a table carrying all three flags: the view came
  // out as a bare `SELECT <cols> FROM <table>`, so a cancelled booking greyed
  // out its slot for ever, an expired offer stayed published and a scheduled
  // post went public before its date, on exactly the path a stranger reads.
  //
  // DRIVEN THROUGH `liveConditions` rather than against a pattern, so this is an
  // agreement between the two objects rather than two spellings that can drift.
  const FLAGS = [{ trash: true }, { expires: true }, { scheduled: true },
                 { trash: true, expires: true, scheduled: true }];
  for (const cell of CELLS) for (const flags of FLAGS) {
    const t = { name: "bookings", ...cell, ...flags, publicView: PV };
    const want = liveConditions(t);
    assert.ok(want.length, "the fixture declares no live flags at all: " + JSON.stringify(flags));
    const create = publicViewSql(t, PV_COLS).find((s) => /^CREATE VIEW/.test(s));
    assert.ok(create, cellName(cell) + " " + JSON.stringify(flags) + ": no view was created");
    for (const cond of want) {
      assert.ok(create.includes(cond),
        cellName(cell) + " " + JSON.stringify(flags) + ": the view publishes rows the policy hides — missing " +
        cond + "\n" + create);
    }
    // The DECLARED filter is not replaced by them. Losing it fails outward:
    // `status:ne:cancelled` dropped is a view that also publishes the
    // cancellations, which is the one direction that must never happen quietly.
    assert.ok(create.includes(`"status" <> 'cancelled'`), create);
    // ANDed, never ORed — ORed, `deleted_at IS NULL` would publish every live
    // row regardless of the declared filter.
    assert.ok(!/\bOR\b\s+"bookings"\."deleted_at"/.test(create), create);
  }
  // AND THE TWO OBJECTS AGREE, checked where both exist: every condition the
  // SELECT policy applies is one the view applies. A view filtering MORE than
  // the policy would be a smaller answer; filtering less is the bug.
  for (const cell of CELLS) {
    const t = { name: "bookings", ...cell, trash: true, expires: true, scheduled: true, publicView: PV };
    const sel = policiesFor(t).find((s) => /FOR SELECT/.test(s));
    if (!sel) continue; // read:none has no read policy at all — by design
    const create = publicViewSql(t, PV_COLS).find((s) => /^CREATE VIEW/.test(s));
    for (const cond of liveConditions(t)) {
      assert.ok(sel.includes(cond) && create.includes(cond),
        cellName(cell) + ": the policy and the projection disagree about " + cond);
    }
  }
  // …AND A TABLE DECLARING NONE OF THEM IS UNTOUCHED, so no existing site's
  // projection changes shape.
  const plain = publicViewSql({ name: "bookings", access: "collect", publicView: PV }, PV_COLS)
    .find((s) => /^CREATE VIEW/.test(s));
  assert.equal(plain.includes("deleted_at"), false, plain);
  assert.equal(plain.includes("expires_at"), false, plain);
  assert.equal(plain.includes("publish_at"), false, plain);
  assert.ok(plain.includes(`WHERE "status" <> 'cancelled'`), plain);
});

test("the live filter is driven by the FLAG, never by the projection's column list", () => {
  // NOT A STYLE CHOICE. The engine stamps `deleted_at`/`expires_at`/`publish_at`
  // into the DDL and NOT into `colNames`, which is what publicViewSql receives
  // as `columns` — so checking them against the projection's `known` set would
  // drop the filter on every table that has one, i.e. on all of them.
  const t = { name: "bookings", access: "collect", trash: true, expires: true, scheduled: true, publicView: PV };
  const create = publicViewSql(t, PV_COLS).find((s) => /^CREATE VIEW/.test(s));
  for (const c of ["deleted_at", "expires_at", "publish_at"]) {
    assert.ok(create.includes(c), c + " was dropped although the table declares it:\n" + create);
    assert.equal(PV_COLS.includes(c), false, c + " is in the fixture's column list, so this proves nothing");
  }
  // NULL means "never expires" / "already live", and it has to be admitted
  // explicitly or every row without a date set vanishes from the projection —
  // which for a booking table is every row.
  assert.ok(create.includes(`"bookings"."expires_at" IS NULL OR`), create);
  assert.ok(create.includes(`"bookings"."publish_at" IS NULL OR`), create);
});

test("EVERY cell revokes before it grants, and no privilege is granted twice", () => {
  // THE COMMENT ON THE REVOKE PAIR SAYS "emitted for EVERY table including a
  // retired one, which is what makes the withdrawal real". Measured across all
  // 16 cells, it was emitted on eight: the member-write branch returned a
  // freshly-built array instead of pushing onto `out`, so `revoke=N` on exactly
  // the write-own / write-members cells — including both member presets `user`
  // and `feed`. A revise moving a table toward a member-write shape left its
  // prior `GRANT INSERT … TO anonymous` standing for ever.
  for (const cell of CELLS) for (const extra of [{}, { payment: { from: "p", amount: "price" } }, { retired: true }]) {
    const g = grantsFor({ name: "t", ...cell, ...extra });
    const where = cellName(cell) + " " + JSON.stringify(extra);
    assert.equal(g[0], 'REVOKE ALL ON "t" FROM anonymous;', where);
    assert.equal(g[1], 'REVOKE ALL ON "t" FROM authenticated;', where);
    // ORDER, which is the half that makes it correct rather than merely present:
    // a REVOKE after a GRANT takes the privilege straight back off and the table
    // is unreachable by anybody.
    const firstGrant = g.findIndex((s) => /^GRANT /.test(s));
    const lastRevoke = g.findLastIndex((s) => /^REVOKE /.test(s));
    if (firstGrant >= 0) assert.ok(firstGrant > lastRevoke, where + ": a grant is undone by a later revoke");
    // NO GRANT IS REDUNDANT AGAINST ANOTHER. The member-write cells fold the
    // member's SELECT into the four-verb statement rather than emitting it
    // twice — the old returning form got that right by rebuilding the list from
    // scratch, and pushing onto `out` instead is where it could be lost.
    //
    // ASSERTED AS SUBSET-OF-ANOTHER, NOT AS AN EXACT DUPLICATE. The first draft
    // was `new Set(g).size === g.length`, which reads as this property and is
    // not it: `GRANT SELECT … TO authenticated` and `GRANT SELECT, INSERT,
    // UPDATE, DELETE … TO authenticated` are different strings, so a mutation
    // dropping the fold SURVIVED it while granting the same role SELECT twice.
    // A subset test is the property; it leaves the anyone-write cells alone,
    // where SELECT and INSERT go to one role in two statements and neither
    // contains the other.
    const granted = g.filter((s) => /^GRANT /.test(s)).map((s) => {
      const m = /^GRANT (.+) ON (".*?") TO (\w+);$/.exec(s);
      assert.ok(m, where + ": a grant this test cannot read — retarget it: " + s);
      return { stmt: s, table: m[2], role: m[3], verbs: new Set(m[1].split(",").map((v) => v.trim())) };
    });
    for (const a of granted) for (const b of granted) {
      if (a === b || a.role !== b.role || a.table !== b.table) continue;
      assert.ok(![...a.verbs].every((v) => b.verbs.has(v)),
        where + ": one grant subsumes another for the same role:\n" + a.stmt + "\n" + b.stmt);
    }
  }
  // THE FLOOR, per cell rather than once: without it every assertion above is
  // satisfied by an emitter that grants nothing to anybody. Exactly the cells
  // that should open something must open something.
  for (const cell of CELLS) {
    const { read, write } = resolveAccess(cell.access ? { access: cell.access } : cell);
    const opens = grantsFor({ name: "t", ...cell }).some((s) => /^GRANT /.test(s));
    assert.equal(opens, read !== "none" || write !== "none",
      cellName(cell) + (opens ? " grants something it should not" : " grants nothing at all"));
  }
});
