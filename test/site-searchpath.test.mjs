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
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { functionSql, FN_SEARCH_PATH, APP_USER_FN_NATIVE, APP_USER_FN_FALLBACK, APP_TEAM_FN } from "../site-rls.mjs";
import { applySiteSchema, normalizeSchema } from "../site-schema.mjs";

/**
 * Run the real engine with the wire stubbed and collect every statement it SENT.
 * No database, no network — the same seam `local-pg-grants.mjs` uses, which is
 * what makes a census of the real DDL possible in a unit test at all.
 */
async function emitted(spec, meta) {
  const statements = [];
  const real = globalThis.fetch;
  const quiet = console.error;
  console.error = () => {};
  globalThis.fetch = async (_url, init) => {
    let body = {};
    try { body = JSON.parse(String((init && init.body) || "{}")); } catch { /* not ours */ }
    const q = String(body.query || "");
    const params = Array.isArray(body.params) ? body.params : [];
    if (q) statements.push(q);
    // `meta` is the box case 8 needs: what `_meta.schema` REALLY persists, which
    // is not the spec the engine was handed. The write is PARAMETERISED, so a
    // seam reading only `query` never sees it.
    if (meta) {
      if (/_meta/i.test(q) && /INSERT|UPDATE/i.test(q)) {
        for (const v of params) { try { const o = JSON.parse(v); if (o && o.tables) meta.value = o; } catch { /* another column */ } }
      }
      if (/FROM _meta/i.test(q)) {
        return new Response(JSON.stringify({ command: "SELECT", rowCount: meta.value ? 1 : 0,
          rows: meta.value ? [{ v: JSON.stringify(meta.value) }] : [], fields: [] }),
          { status: 200, headers: { "content-type": "application/json" } });
      }
    }
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

test("8. THE SCOPE: a next schema change re-pins the engine's functions and NOT the model's", async () => {
  // **THIS CASE EXISTS BECAUSE A CLAIM I MADE WAS WRONG**, and the corrected
  // scope is the deliverable. The integration probe's first upgrade arm stood a
  // site up on the pre-fix DDL and replayed the ORIGINAL statements over it —
  // full function bodies and all — and read the resulting pin as "its next
  // schema change upgrades it". A real next change is composed from what
  // `_meta.schema` PERSISTED, and that is a different thing.
  //
  // `applySiteSchema` writes a function to `_meta` as `{name, args, returns,
  // internal}` with NO BODY, and `normalizeSchema` drops a bodiless function —
  // correctly, since a body is what makes one. So the next change re-declares
  // every TABLE and therefore re-emits every TRIGGER function, and re-creates
  // the identity helpers unconditionally, and **never mentions the model's
  // function at all**.
  const meta = { value: null };
  await emitted({
    // `audit` is what gives a table trigger functions. `trash` adds a COLUMN and
    // no function — measured, after this case first read as a product failure.
    tables: [{ name: "bookings", access: "collect", columns: ["who"], audit: true }],
    functions: [{ name: "count_bookings", returns: "bigint", language: "sql", body: "SELECT count(*) FROM bookings" }],
  }, meta);

  const persisted = (meta.value && meta.value.functions) || [];
  assert.equal(persisted.length, 1, "the observer is alive — something was persisted");
  assert.ok(!("body" in persisted[0]), "a persisted function carries no body: " + JSON.stringify(persisted[0]));
  assert.equal(normalizeSchema(structuredClone(meta.value)).functions, undefined,
    "a bodiless function does not survive normalizeSchema — which is the whole mechanism");

  // The next change, composed the way an addon composes one.
  const next = await emitted({
    ...JSON.parse(JSON.stringify(meta.value)),
    tables: [...meta.value.tables, { name: "notes", access: "display", columns: ["title"] }],
  });
  const creates = next.filter((s) => CREATE_FN.test(s));
  const names = creates.map((s) => (s.match(/FUNCTION\s+"?([a-z0-9_]+)/i) || [])[1]);

  // WHAT IS RE-PINNED — asserted, because "the pin reaches nothing" would be as
  // wrong as the claim this case replaces.
  assert.ok(names.includes("app_user_id") && names.includes("app_team_id"), names.join(","));
  assert.ok(names.some((n) => /^trg_bookings_/.test(n)), "the existing table's trigger function: " + names.join(","));
  for (const s of creates) assert.ok(safelyPinned(s), "re-issued unpinned: " + s.slice(0, 120));

  // WHAT IS NOT. Both spellings, because `ALTER FUNCTION … SET search_path` is
  // the other way it could be reached and the engine does not emit one.
  assert.ok(!next.some((s) => /count_bookings/i.test(s) && /(CREATE|ALTER)\s+(OR REPLACE\s+)?FUNCTION/i.test(s)),
    "nothing may re-declare the model's function: " + next.filter((s) => /count_bookings/i.test(s)).join(" | "));
  assert.ok(!next.some((s) => /ALTER\s+FUNCTION/i.test(s)), "no ALTER FUNCTION anywhere");

  // AND THE ONE PATH THAT DOES REACH IT, so the scope names a remedy rather than
  // only a gap: an addon that re-declares the function WITH a body.
  const redeclared = await emitted({
    ...JSON.parse(JSON.stringify(meta.value)),
    functions: [{ name: "count_bookings", returns: "bigint", language: "sql", body: "SELECT count(*) FROM bookings" }],
  });
  const again = redeclared.filter((s) => /CREATE OR REPLACE FUNCTION "count_bookings"/.test(s));
  assert.equal(again.length, 1, "a re-declared function is re-emitted");
  assert.ok(safelyPinned(again[0]), again[0].slice(0, 140));
});

test("9. the pin TRUSTS public, so `public` unwritable stays a requirement", () => {
  // `SET search_path = public, pg_temp` closes the `pg_temp` vector and says
  // nothing whatever about a `public` an untrusted role can write to. Asserted
  // as a PROPERTY OF THE CONSTANT so that a later widening — `public` swapped
  // for a schema somebody can create in, or a second schema appended — has to
  // be a deliberate edit to this list rather than a quiet one.
  //
  // WHERE THE EVIDENCE FOR THE REQUIREMENT LIVES, kept separate on purpose:
  // the LIVE reading is `neon-e2e`'s four `has_schema_privilege` checks against
  // a real Neon project, and nothing in this suite can stand in for it.
  const parts = FN_SEARCH_PATH.split(",").map((s) => s.trim());
  assert.deepEqual(parts, ["public", "pg_temp"],
    "the trusted set is exactly `public` — anything else added here is a new trust assumption");
});

// ── The probe's own baseline ─────────────────────────────────────────────────
//
// `local-pg-searchpath.mjs` proves the mechanism by replaying the PRE-FIX
// engine beside the fixed one, so its `OLD_REF` default IS the control. Two
// moving forms have already been tried and both stopped being a control the
// moment the pin landed — `HEAD` on the first run after the commit, and
// `origin/main` one merge later. The command in CLAUDE.md has to keep working
// after this ships, which is when somebody reruns it.
const PROBE = readFileSync(new URL("./integration/local-pg-searchpath.mjs", import.meta.url), "utf8");

/** The literal the probe falls back to when nobody passes `OLD_REF=`. */
function probeDefaultRef(src) {
  const m = /const OLD_REF\s*=\s*process\.env\.OLD_REF\s*\|\|\s*"([^"]*)"/.exec(src);
  return m ? m[1] : null;
}

test("10. the probe's default baseline is an immutable sha, and the unpinned check is kept", () => {
  const ref = probeDefaultRef(PROBE);
  assert.ok(ref, "local-pg-searchpath.mjs no longer falls back to a default OLD_REF at all");

  // THE SHAPE IS THE PROPERTY, not the particular sha: what makes the run
  // reproducible is that the ref cannot move, and every moving form this could
  // drift back to is a NAME. A hex object id is the only thing git will not
  // re-point. (`0fff5317` is `71c2c4b8^`; case 11 asks git whether it is really
  // pre-fix, which is a question only a full clone can answer.)
  assert.match(ref, /^[0-9a-f]{7,40}$/,
    `OLD_REF's default is \`${ref}\`, which is a NAME and therefore moves. ` +
    "A branch, a tag or HEAD carries the pin the day this merges and the probe " +
    "then reports the FIX as broken. Use an immutable sha before the pin.");

  // …AND THE REFUSAL IS RETAINED. An immutable sha makes the default
  // reproducible; it says nothing about an `OLD_REF=` somebody passes, and
  // nothing about a later edit moving the default to a different sha that
  // happens to be post-fix. The run-time check is what covers both, so a
  // mutant that drops it must be red. Asserted as the CONDITION and the exit,
  // never as the block's prose: this file records that spelling guards go red
  // on honest edits, and both landmarks are proved present first.
  const at = PROBE.indexOf("const oldModelDdl");
  const end = PROBE.indexOf("console.log(\"\\n─ replaying both trees ─\")", at);
  assert.ok(at > 0 && end > at, "the baseline refusal's landmarks moved — re-anchor rather than delete");
  const block = PROBE.slice(at, end);
  assert.match(block, /\/search_path\/\.test\(oldModelDdl\)/,
    "the refusal no longer asks whether the baseline's MODEL function already pins");
  assert.match(block, /process\.exit\(2\)/,
    "the refusal no longer exits nonzero, so a bad baseline runs every BEFORE case anyway");
});

// The object is only present in a FULL clone. `actions/checkout@v4` defaults to
// `fetch-depth: 1`, so CI holds one commit and cannot answer this; it SKIPS
// there, visibly, rather than passing and claiming to have checked. Case 10 is
// the half that runs everywhere.
const HAVE_BASELINE = (() => {
  const ref = probeDefaultRef(PROBE);
  if (!ref) return false;
  const r = spawnSync("git", ["cat-file", "-e", ref + "^{commit}"], { cwd: new URL("../", import.meta.url) });
  return r.status === 0;
})();

test("11. …and that sha's tree really is pre-fix — asked of git, not of this file", {
  skip: !HAVE_BASELINE && "the baseline commit is not in this clone (a shallow checkout holds one commit)",
}, () => {
  const ref = probeDefaultRef(PROBE);
  const root = new URL("../", import.meta.url);
  const show = (path) => {
    const r = spawnSync("git", ["show", `${ref}:${path}`], { cwd: root, encoding: "utf8", maxBuffer: 64e6 });
    assert.equal(r.status, 0, `git could not read ${path} at ${ref}`);
    return r.stdout;
  };

  // ASK GIT, NOT THE FILESYSTEM — this repository's own recorded rule, and the
  // question is exactly "what did the repository hold before the pin".
  assert.ok(!show("site-rls.mjs").includes("FN_SEARCH_PATH"),
    `${ref} already has the pin: it is not a control, and every BEFORE arm of the probe would invert`);
  assert.ok(!/search_path/.test(show("site-schema.mjs")),
    `${ref}'s trigger functions already pin, so the trigger arm of the probe has no control`);

  // And it has to be REACHABLE from what main holds, or "an immutable sha"
  // becomes a sha only this branch can resolve.
  const anc = spawnSync("git", ["merge-base", "--is-ancestor", ref, "HEAD"], { cwd: root });
  assert.equal(anc.status, 0, `${ref} is not an ancestor of HEAD — a baseline nobody else can resolve`);
});
