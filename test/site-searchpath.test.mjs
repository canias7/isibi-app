// EVERY FUNCTION THE ENGINE CREATES PINS `search_path`.
//
// Not "the model's functions do" — EVERY one, asserted as a CENSUS over the DDL
// the engine really sends, so a function added next month fails by existing.
// That shape is deliberate and it is the second thing this file is about.
//
// THE FIRST IS WHY THE PIN IS THERE. A model function is SECURITY DEFINER (it is
// the point of the feature: a `collect` table has no read policy, so only a
// function running as the owner can hand a row back), and an unpinned definer
// function resolves names through the CALLER'S `search_path`. The argument for
// leaving them unpinned was a permission claim — that the escalation needs a
// `CREATE` privilege no live role holds — and `test/integration/local-pg-searchpath.mjs`
// measured it FALSE on a real PostgreSQL 16: `TEMP` is granted to PUBLIC by
// Postgres's own default and an unlisted `pg_temp` is searched FIRST for
// relations, so a role refused `SELECT` on the table outright creates
// `pg_temp.<table>` and the definer function counts the attacker's rows. No
// `CREATE` anywhere, and the caller never touches its own `search_path`.
//
// WHY A UNIT CENSUS AND NOT ONLY THAT PROBE: the probe needs a local Postgres
// and is run by hand, exactly like `local-pg-grants.mjs` and
// `local-pg-recover.mjs`. CI reads this file. And when the pin was added, the
// WHOLE suite stayed green — the existing `functionSql` guard asserts
// `create.includes(" SECURITY DEFINER ")`, which a new trailing clause does not
// disturb. A change nothing could see is a change nothing will notice being
// undone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { functionSql, FN_SEARCH_PATH, APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK, APP_TEAM_FN } from "../site-rls.mjs";
import { applySiteSchema } from "../site-schema.mjs";

/**
 * Run the real engine with the wire stubbed and collect every statement it SENT.
 * No database, no network — the same seam `local-pg-grants.mjs` uses, which is
 * what makes a census of the real DDL possible in a unit test at all.
 */
async function emitted(spec) {
  const statements = [];
  const real = globalThis.fetch;
  const quiet = console.error;
  console.error = () => {};
  globalThis.fetch = async (_url, init) => {
    let q = "";
    try { q = JSON.parse(String((init && init.body) || "{}")).query || ""; } catch { /* not ours */ }
    if (q) statements.push(String(q));
    // Refuse Neon's extension so the engine takes its own FALLBACK identity
    // function — the form this change also moved, and the one a census that only
    // ever saw the native form would never look at.
    if (/pg_session_jwt/.test(q)) return new Response(JSON.stringify({ message: "no extension" }), { status: 400 });
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try { await applySiteSchema("postgresql://u:p@ep-x.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; console.error = quiet; }
  return statements;
}

/**
 * A spec that reaches as much of the trigger surface as one table can, so the
 * census below is over a wide sample rather than over the two functions this
 * change was written about. Every flag here emits at least one
 * `CREATE OR REPLACE FUNCTION` through `pgTrigger`.
 */
const WIDE = {
  tables: [
    { name: "owners", access: "display", columns: ["title"] },
    {
      name: "jobs", access: "user", enforceRefs: true, trash: true, ordered: true,
      timestamps: true, audit: true, history: true, sync: true, maxRows: 50,
      slug: "title", sequence: { field: "number", prefix: "J", pad: 4 },
      transitions: { status: { new: ["open"], open: ["done"] } },
      columns: ["title", "status", { name: "owners_id", type: "int", ref: "owners" }],
    },
  ],
  functions: [
    { name: "count_jobs", returns: "bigint", language: "sql", body: "SELECT count(*) FROM jobs" },
    { name: "count_plpgsql", returns: "bigint", language: "plpgsql",
      body: "DECLARE n bigint; BEGIN SELECT count(*) INTO n FROM jobs; RETURN n; END;" },
    { name: "inner_count", returns: "bigint", language: "sql", definer: false, body: "SELECT count(*) FROM jobs" },
  ],
};

const CREATE_FN = /CREATE (?:OR REPLACE )?FUNCTION/i;

/**
 * The path a CREATE statement pins, or "" when it pins nothing.
 *
 * READ FROM THE STATEMENT AND NOT FROM `FN_SEARCH_PATH`, which is what makes the
 * census a census. A sweep survivor is why: a mutant that pinned the trigger
 * functions with a hardcoded `pg_temp, public` — the order the fix exists to
 * stop — passed every assertion, because the census asked whether a pin was
 * PRESENT and case 3 asked about the constant that mutant no longer used.
 * Presence is not the property; order is.
 */
function pinnedPath(stmt) {
  const m = String(stmt).match(/SET\s+search_path\s*=\s*([^\n]*?)\s+AS\s/i)
    || String(stmt).match(/SET\s+search_path\s*=\s*([a-z_, ]+)\s*$/i);
  return m ? m[1].trim() : "";
}
/** `pg_temp` last, or unlisted-and-therefore-first, which is the default it replaced. */
function safelyPinned(stmt) {
  const parts = pinnedPath(stmt).split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts[parts.length - 1] === "pg_temp";
}

test("1. THE CENSUS: every function the engine creates pins search_path", async () => {
  const statements = await emitted(structuredClone(WIDE));
  const creates = statements.filter((s) => CREATE_FN.test(s));
  // THE OBSERVER, PROVED ALIVE FIRST. `[].every(...)` is true, and a census that
  // found nothing would pass this file while the whole surface went unpinned.
  // The floor is deliberately well under what this spec really emits, so an
  // unrelated flag losing a trigger does not read as the pin being gone.
  assert.ok(creates.length >= 8, `the census found only ${creates.length} CREATE FUNCTION statements`);
  const named = (s) => (s.match(/FUNCTION\s+"?([a-z0-9_]+)/i) || [])[1] || s.slice(0, 60);
  assert.deepEqual(creates.filter((s) => !/SET search_path\s*=/.test(s)).map(named), [],
    "these are created with no search_path pinned at all");
  // AND PINNED SAFELY, which is a different question — see `safelyPinned`.
  assert.deepEqual(creates.filter((s) => !safelyPinned(s)).map((s) => named(s) + "=" + pinnedPath(s)), [],
    "these pin a path that still searches pg_temp before public");
});

test("2. the census sees BOTH emitters, not one of them twice", async () => {
  // `functionSql` writes the model's; `pgTrigger` writes the engine's. A census
  // over a spec with no triggers would pass while every trigger went unpinned,
  // and one over a spec with no functions would pass the other way round — so
  // the two groups are counted apart rather than summed.
  const statements = await emitted(structuredClone(WIDE));
  const creates = statements.filter((s) => CREATE_FN.test(s));
  const model = creates.filter((s) => /"(count_jobs|count_plpgsql|inner_count)"/.test(s));
  const triggers = creates.filter((s) => /RETURNS TRIGGER/i.test(s));
  assert.equal(model.length, 3, "all three declared functions reached the wire");
  assert.ok(triggers.length >= 5, `only ${triggers.length} trigger functions — the sample is too thin to be a census`);
  for (const s of [...model, ...triggers]) assert.ok(safelyPinned(s), s.slice(0, 140));
});

test("3. `pg_temp` LAST is the whole of the fix, so the ORDER is the assertion", () => {
  // Asserted as a POSITION, not as a string. `pg_temp, public` parses, pins, and
  // reads like a pin while leaving the hole exactly where it was — Postgres
  // searches the path in order, so `pg_temp` first is the default it replaced.
  const parts = FN_SEARCH_PATH.split(",").map((s) => s.trim());
  assert.ok(parts.includes("pg_temp"), `pg_temp must be named at all: ${FN_SEARCH_PATH}`);
  assert.equal(parts[parts.length - 1], "pg_temp", `pg_temp must be LAST: ${FN_SEARCH_PATH}`);
  // And `public` must still be on it, or every model body — which is written
  // unqualified, because nothing ever asks it to qualify — stops resolving.
  assert.ok(parts.includes("public"), `public must stay resolvable: ${FN_SEARCH_PATH}`);
});

test("4. the pin is on the INVOKER form too, because an invoker callee runs as the definer", () => {
  // A SECURITY INVOKER function called from inside a SECURITY DEFINER one runs
  // with the DEFINER's rights, so an unpinned `definer: false` callee is the same
  // hole one hop along — measured in the live probe as `via-invoker=1` before the
  // change. A model may declare both and call one from the other; nothing stops
  // it, and nothing should have to.
  const [inv] = functionSql({ name: "f", args: [], returns: "void", body: "SELECT 1", language: "sql", definer: false });
  const [def] = functionSql({ name: "g", args: [], returns: "void", body: "SELECT 1", language: "sql" });
  assert.ok(!inv.includes("SECURITY DEFINER"), inv);
  assert.ok(def.includes(" SECURITY DEFINER "), def);
  for (const s of [inv, def]) assert.ok(s.includes(" SET search_path = " + FN_SEARCH_PATH + " "), s);
});

test("5. the pin sits before AS, and the body's delimiters are untouched", () => {
  // The SET clause takes a COMMA LIST and `AS` ends it. That it parses at all is
  // measured — a `pg_temp AS $isibi$` that Postgres read as three path entries
  // would be a create that fails at apply time on every site, and no unit test
  // reading strings could tell. `local-pg-searchpath.mjs` is where it is proved
  // against a real server; this is the shape that reached it.
  const [create] = functionSql({
    name: "booking_by_claim", args: [{ name: "tok", type: "uuid" }],
    returns: "setof appointments", body: "SELECT * FROM appointments WHERE claim_token = tok",
    language: "sql", definer: true,
  });
  assert.match(create, /SECURITY DEFINER SET search_path = public, pg_temp AS \$isibi\$/);
  assert.equal((create.match(/\$isibi\$/g) || []).length, 2, create);
});

test("6. it changes name resolution and NOT privilege — the other statements are byte-identical", () => {
  // A pin that quietly widened or narrowed the reach of a function would be a
  // worse bug than the one it fixes. `local-pg-searchpath.mjs` asserts the whole
  // ACL surface against a real catalog; this asserts the three statements that
  // decide it have not moved at all.
  const f = { name: "peek", args: [{ name: "tok", type: "uuid" }], returns: "text", body: "SELECT 1", language: "sql" };
  const pub = functionSql(f);
  assert.equal(pub.length, 4);
  assert.equal(pub[1], 'REVOKE ALL ON FUNCTION "peek"(uuid) FROM PUBLIC');
  assert.equal(pub[2], 'GRANT EXECUTE ON FUNCTION "peek"(uuid) TO anonymous');
  assert.equal(pub[3], 'GRANT EXECUTE ON FUNCTION "peek"(uuid) TO authenticated');
  // An internal function still gets the revoke and NO grant — the pin must not
  // have made a second door into the one function nobody may call.
  const int = functionSql({ ...f, internal: true });
  assert.equal(int.length, 2);
  assert.equal(int[1], 'REVOKE ALL ON FUNCTION "peek"(uuid) FROM PUBLIC');
});

test("7. all three identity helpers pin, and the fallback qualifies its own call", () => {
  // The native form and the team lookup have pinned since they were written. The
  // FALLBACK had not, and the comment above the native one said why in a
  // sentence that is true about the wrong axis: "it reads a GUC anyone may read,
  // so definer rights would be privilege bought for nothing". Invoker settles
  // whose PRIVILEGES run; it settles nothing about whose NAMES resolve — and
  // every RLS policy on the platform calls this function, so a redirected
  // `app_user_id()` answers an attacker-chosen uuid.
  for (const [what, ddl] of [["native", APP_USER_FN_NATIVE], ["fallback", APP_USER_FN_FALLBACK], ["team", APP_TEAM_FN]]) {
    // `pg_temp` LAST here too, and it is not decoration. These three were
    // `pg_catalog` alone and were safe — MEASURED — but safe only because every
    // relation in their bodies is schema-qualified, which is an argument about
    // the bodies rather than about the pin. `SET search_path = pg_catalog,
    // public` with an unqualified body is redirected exactly as an unpinned one
    // is, measured in the same probe, so naming `public` is not the fix and
    // naming `pg_temp` is.
    assert.match(ddl, /SET search_path = pg_catalog, pg_temp AS/, what + " must pin with pg_temp last");
  }
  // Pinned AND qualified, like the two it now matches: the pin is what holds and
  // the qualification is what survives somebody widening the pin later.
  assert.match(APP_USER_FN_FALLBACK, /pg_catalog\.current_setting\(/);
  // `public` is deliberately NOT on these three — they name nothing outside the
  // catalog except through a schema-qualified reference, so widening the path
  // would be undoing the pin for no gain.
  assert.ok(!/SET search_path = [^\n]*\bpublic\b/.test(APP_USER_FN_FALLBACK), APP_USER_FN_FALLBACK);
});
