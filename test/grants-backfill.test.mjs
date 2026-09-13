// ── THE GRANTS BACKFILL (2026-09-13) ────────────────────────────────────────
//
// Owner: "inventory existing sites that need their permissions updated. Prepare
// a targeted backfill with a preview of affected tables, verification, and
// recovery steps. Preserve site data and existing access rules."
//
// WHAT IT IS FOR. `applySiteSchema` re-issues REVOKE-then-GRANT for every table
// on every call, so one ordinary schema touch column-scopes a site's write
// grants. But it has three callers and all three are customer-driven, and
// `site_rebuild` does not call it — so a site built before the fix keeps its
// table-wide grants until its owner next changes something schema-shaped, which
// may be never. This is the deliberate sweep.
//
// WHAT THIS FILE CAN SETTLE. The plan, the statements, the verification and the
// rollback are pure functions over an injected `sql`, and they are driven here
// against a fake. That Postgres then behaves as the statements say is proved by
// `test/integration/local-pg-grants.mjs`, which runs the whole cycle — preview,
// apply, verify, apply again, rollback — against a real PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CLIENT_ROLES, readAcls, grantsFromAcls, aclSummary, tableWideWrites,
  planSite, applyPlan, verifySite, safeErr,
} from "../scripts/grants-backfill.mjs";
import { grantsFor, DATA_API_ROLES } from "../site-rls.mjs";

/**
 * A fake Postgres that answers the three shapes the planner asks for.
 *
 * It is deliberately NOT a general SQL engine: it matches on the landmark each
 * query carries, so a query that changes shape stops being answered rather than
 * quietly getting the wrong rows.
 */
function fakeDb({ meta, columns, acls = {} }) {
  const issued = [];
  const sql = async (text, params = []) => {
    issued.push({ text: String(text).replace(/\s+/g, " ").trim(), params });
    if (/FROM _meta WHERE k='schema'/.test(text)) return meta === null ? [] : [{ v: JSON.stringify(meta) }];
    if (/FROM pg_attribute a\s+JOIN pg_class c/.test(text) && /attisdropped/.test(text)) {
      const out = [];
      for (const [tbl, cols] of Object.entries(columns)) for (const col of cols) out.push({ tbl, col });
      return out;
    }
    if (/aclexplode/.test(text)) return acls[params[0]] || [];
    return [];
  };
  return { sql, issued };
}

const acl = (kind, grantee, priv, col = null) => ({ kind, col, grantee, priv });
/** A pre-fix `collect` table: table-wide INSERT to both client roles. */
const OLD_COLLECT = [acl("table", "anonymous", "INSERT"), acl("table", "authenticated", "INSERT")];
/** A pre-fix member-write table. */
const OLD_OWN = ["SELECT", "INSERT", "UPDATE", "DELETE"].map((p) => acl("table", "authenticated", p));

const SPEC = [
  { name: "requests", access: "collect", columns: ["name", "email", "detail"] },
  { name: "saved", access: "user", columns: ["title", "note"] },
  { name: "menu", access: "display", columns: ["dish", "price"] },
];
const COLUMNS = {
  requests: ["id", "name", "email", "detail", "created_at"],
  saved: ["id", "title", "note", "owner_id", "created_at", "updated_at"],
  menu: ["id", "dish", "price"],
};

test("the client roles are the emitter's own, never a second list", () => {
  assert.deepEqual([...CLIENT_ROLES].sort(), Object.values(DATA_API_ROLES).sort());
  // THE OBSERVER IS ALIVE: an empty role list would satisfy a `deepEqual` of two
  // empties, and then the whole backfill would look at nothing.
  assert.ok(CLIENT_ROLES.length >= 2, "the Data API has fewer roles than the backfill expects");
});

test("readAcls keeps only the client roles — a grant to the owner is not this backfill's business", async () => {
  const { sql } = fakeDb({
    meta: { tables: SPEC }, columns: COLUMNS,
    acls: { requests: [...OLD_COLLECT, acl("table", "postgres", "SELECT"), acl("table", "some_other_role", "INSERT")] },
  });
  const got = await readAcls(sql, "requests");
  assert.deepEqual(got.map((g) => g.grantee).sort(), ["anonymous", "authenticated"]);
});

test("tableWideWrites names ONLY a table-level write — not SELECT, not DELETE, not a column grant", () => {
  const mixed = [
    acl("table", "anonymous", "INSERT"),
    acl("table", "authenticated", "UPDATE"),
    acl("table", "authenticated", "SELECT"),   // a read is not what the fix removes
    acl("table", "authenticated", "DELETE"),   // DELETE is a row verb and stays table-wide
    acl("column", "authenticated", "INSERT", "title"), // already column-scoped
  ];
  assert.deepEqual(tableWideWrites(mixed), ["anonymous INSERT", "authenticated UPDATE"]);
  // THE CONTROL: a table already put right reports nothing, so the census is a
  // measurement and not a list of every table there is.
  assert.deepEqual(tableWideWrites([acl("table", "authenticated", "SELECT"), acl("column", "authenticated", "UPDATE", "title")]), []);
});

test("planSite flags exactly the tables carrying a table-wide client write", async () => {
  const { sql } = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT, saved: OLD_OWN, menu: [] } });
  const plan = await planSite(sql, "site");
  assert.equal(plan.tables.length, 3);
  const needing = plan.tables.filter((t) => t.changes).map((t) => t.table);
  assert.deepEqual(needing.sort(), ["requests", "saved"]);
  // The read-only table is the live control: reported, and reported as fine.
  const menu = plan.tables.find((t) => t.table === "menu");
  assert.ok(menu && !menu.changes, "the read-only table was flagged, so the census flags everything");
});

test("the plan's statements ARE the emitter's — asserted by identity, never respelled", async () => {
  const { sql } = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT } });
  const plan = await planSite(sql, "site");
  for (const t of plan.tables) {
    const spec = SPEC.find((s) => s.name === t.table);
    const present = spec.columns.filter((c) => COLUMNS[t.table].includes(c));
    assert.deepEqual(t.statements, grantsFor(spec, present),
      t.table + ": the backfill respelled the grants instead of asking the emitter for them");
  }
});

test("the grant names only columns the table REALLY has, and says which it left out", async () => {
  // `title` was declared and never created — a site whose last apply died
  // part-way, or a `_meta` written before a column was dropped. A GRANT naming
  // it fails WHOLE, which would leave the table with no write grant at all.
  const spec = [{ name: "saved", access: "user", columns: ["title", "note", "ghost"] }];
  const { sql } = fakeDb({ meta: { tables: spec }, columns: { saved: ["id", "title", "note", "owner_id"] }, acls: { saved: OLD_OWN } });
  const plan = await planSite(sql, "site");
  const t = plan.tables[0];
  assert.deepEqual(t.writable, ["title", "note"]);
  assert.deepEqual(t.missingColumns, ["ghost"], "a column the table has not got was not named");
  assert.ok(!t.statements.some((s) => /ghost/.test(s)), "the grant names a column the table has not got, so it would fail whole");
});

test("a table the database does not have is SKIPPED and said, never grant-attempted", async () => {
  const spec = [{ name: "gone", access: "collect", columns: ["a"] }];
  const { sql } = fakeDb({ meta: { tables: spec }, columns: { other: ["id"] } });
  const plan = await planSite(sql, "site");
  assert.match(plan.tables[0].skipped, /does not exist/);
  const issued = [];
  await applyPlan(async (text) => { issued.push(String(text)); return []; }, plan, {});
  assert.equal(issued.filter((s) => /^\s*(GRANT|REVOKE)/.test(s)).length, 0, "a missing table was still granted on");
});

test("planSite writes nothing — every statement it issues is a read", async () => {
  const fake = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT, saved: OLD_OWN } });
  await planSite(fake.sql, "site");
  assert.ok(fake.issued.length > 0, "the planner asked nothing at all");
  for (const q of fake.issued) {
    assert.ok(/^\s*(SELECT|WITH)\b/i.test(q.text), "the preview issued a statement that is not a read: " + q.text.slice(0, 80));
  }
});

test("planSite says why rather than throwing when there is nothing to plan from", async () => {
  const noMeta = fakeDb({ meta: null, columns: COLUMNS });
  assert.match((await planSite(noMeta.sql, "s")).error, /no _meta\.schema/);
  const empty = fakeDb({ meta: { tables: [] }, columns: COLUMNS });
  assert.match((await planSite(empty.sql, "s")).error, /declares no tables/);
});

test("verifySite FAILS when the REVOKE landed and the GRANT did not", async () => {
  const { sql: planSql } = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT, saved: OLD_OWN } });
  const plan = await planSite(planSql, "site");
  // A site in the half-applied state: nothing table-wide, and no column grant
  // either. It satisfies "the old broad privilege is gone" perfectly and cannot
  // take a booking — which is why the verification has a second assertion.
  const half = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: [], saved: [], menu: [] } });
  const rows = await verifySite(half.sql, plan);
  const req = rows.find((r) => r.table === "requests");
  assert.equal(req.ok, false, "a table with no grant at all passed verification");
  assert.deepEqual(req.tableWideWrites, [], "the first assertion was satisfied, as it must be for this case to mean anything");
  // And the read-only table is the control: no write grant is CORRECT there.
  assert.equal(rows.find((r) => r.table === "menu").ok, true);
});

test("verifySite passes on the state the fix really leaves", async () => {
  const { sql: planSql } = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT, saved: OLD_OWN } });
  const plan = await planSite(planSql, "site");
  const done = fakeDb({
    meta: { tables: SPEC }, columns: COLUMNS,
    acls: {
      requests: ["name", "email", "detail"].flatMap((c) => CLIENT_ROLES.map((r) => acl("column", r, "INSERT", c))),
      saved: ["title", "note"].flatMap((c) => ["INSERT", "UPDATE"].map((p) => acl("column", "authenticated", p, c)))
        .concat([acl("table", "authenticated", "SELECT"), acl("table", "authenticated", "DELETE")]),
      menu: [acl("table", "anonymous", "SELECT")],
    },
  });
  for (const r of await verifySite(done.sql, plan)) assert.equal(r.ok, true, r.table + " failed verification on the state the fix leaves");
});

test("the rollback puts back what was recorded — the REVOKE first, then one statement per role", () => {
  const out = grantsFromAcls("saved", OLD_OWN);
  const lastRevoke = out.findLastIndex((s) => /^REVOKE /.test(s));
  const firstGrant = out.findIndex((s) => /^GRANT /.test(s));
  assert.ok(firstGrant > lastRevoke, "a GRANT was emitted before the REVOKE, which takes it straight back off");
  for (const role of CLIENT_ROLES) assert.ok(out.includes(`REVOKE ALL ON "saved" FROM ${role};`), "no revoke for " + role);
  assert.deepEqual(out.filter((s) => /^GRANT /.test(s)), [`GRANT DELETE, INSERT, SELECT, UPDATE ON "saved" TO authenticated;`]);
});

test("the rollback restores a COLUMN grant as one statement per role, verbs together", () => {
  const cols = [
    acl("column", "authenticated", "INSERT", "title"), acl("column", "authenticated", "INSERT", "note"),
    acl("column", "authenticated", "UPDATE", "title"), acl("column", "authenticated", "UPDATE", "note"),
    acl("table", "authenticated", "SELECT"),
  ];
  const out = grantsFromAcls("saved", cols).filter((s) => /^GRANT /.test(s));
  assert.deepEqual(out, [
    `GRANT SELECT ON "saved" TO authenticated;`,
    `GRANT INSERT ("note", "title"), UPDATE ("note", "title") ON "saved" TO authenticated;`,
  ]);
});

test("a rollback of NOTHING recorded is a revoke and no grant — never a silent no-op", () => {
  const out = grantsFromAcls("saved", []);
  assert.equal(out.filter((s) => /^GRANT /.test(s)).length, 0);
  assert.equal(out.filter((s) => /^REVOKE /.test(s)).length, CLIENT_ROLES.length);
});

test("aclSummary is stable, so a before and an after compare equal when nothing moved", () => {
  const a = aclSummary([acl("column", "authenticated", "UPDATE", "note"), acl("column", "authenticated", "INSERT", "title")]);
  const b = aclSummary([acl("column", "authenticated", "INSERT", "title"), acl("column", "authenticated", "UPDATE", "note")]);
  assert.equal(JSON.stringify(a), JSON.stringify(b), "the same privileges in a different order read as a change");
});

test("applyPlan reports a refusal rather than throwing, so one bad table cannot stop a sweep", async () => {
  const { sql: planSql } = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT, saved: OLD_OWN } });
  const plan = await planSite(planSql, "site");
  const failing = async (text) => { if (/ON "saved"/.test(text)) throw new Error("permission denied"); return []; };
  const failures = await applyPlan(failing, plan, {});
  assert.ok(failures.length > 0, "a refused statement was swallowed");
  assert.ok(failures.every((f) => f.table === "saved"), "a refusal on one table was reported against another");
});

// ── NOTHING THIS SCRIPT PRINTS MAY CARRY A CONNECTION STRING ────────────────
//
// Owner, 2026-09-13: "Report affected tables and any unresolved database
// identities without exposing credentials."
//
// The script holds one live database credential per site and never logs one
// deliberately. The risk is the accidental path — a driver error whose MESSAGE
// quotes the URL it was handed — which is how credentials usually reach a log.
// So the scrubber is driven here for what it must remove AND what it must not
// touch, the call sites are DRIVEN rather than read where a fake can reach
// them, and a census covers the paths a fake cannot.

/** The real shape: a Neon pooled DSN, as `site_project.neon_conn` stores it. */
const DSN = "postgresql://neondb_owner:npg_7HqR2xVtLmZ0@ep-still-frost-a4d91x.us-east-1.aws.neon.tech/site_fretwork_1?sslmode=require";

test("the scrubber takes the credential out of a real connection string and leaves the host", () => {
  const out = safeErr(new Error(`connect ECONNREFUSED for ${DSN}`));
  assert.ok(!out.includes("npg_7HqR2xVtLmZ0"), `the password survived: ${out}`);
  assert.ok(!out.includes("neondb_owner"), `the user survived: ${out}`);
  assert.ok(out.includes("postgresql://***@"), `the scheme and the mask are not there: ${out}`);
  // THE HOST IS DELIBERATELY KEPT. The owner asked for the database identities
  // reported; the credential is the half that must go, and the identity is the
  // half that answers the question.
  assert.ok(out.includes("ep-still-frost-a4d91x.us-east-1.aws.neon.tech"), `the host was lost too: ${out}`);
  assert.ok(out.includes("connect ECONNREFUSED"), `the message itself was lost: ${out}`);
});

test("the scrubber is the URL's grammar, not a list of secrets — any scheme, and every one in the message", () => {
  const two = safeErr(new Error(`fell back from ${DSN} to postgres://other:sec@db.example.com/x`));
  assert.ok(!/npg_7HqR2xVtLmZ0|other:sec/.test(two), `one of two credentials survived: ${two}`);
  assert.equal((two.match(/\*\*\*@/g) || []).length, 2, `both should be masked: ${two}`);
  // A LIST WOULD HAVE TO NAME THE SCHEME. This one does not.
  assert.ok(!/user:pw/.test(safeErr("mysql+aiomysql://user:pw@h/db")), "an unfamiliar scheme was let through");
});

test("the scrubber is a FALSE ALARM in nothing it is handed — the control that keeps it from eating the answer", () => {
  // Ordinary URLs have no credential and must come back byte for byte: a
  // scrubber that mangles the host is one nobody can diagnose a failure from.
  for (const plain of [
    "GET https://ujrqdmmtcptvimazlhom.supabase.co/rest/v1/site_project?select=slug failed with 503",
    "permission denied for table requests",
    "the owner is aniascristian@gmail.com",
    "no route matched postgresql://",
  ]) assert.equal(safeErr(plain), plain, `it changed something with no credential in it: ${plain}`);
});

test("the scrubber answers a string for anything it is handed, so no call site can print [object Object]", () => {
  assert.equal(safeErr(null), "");
  assert.equal(safeErr(undefined), "");
  assert.equal(typeof safeErr({}), "string");
  // POSTGRES PUTS ITS OWN TEXT IN `detail`, which is why `applyPlan` read it
  // before the scrubber existed. Both halves are asserted, and the second is
  // the one that matters: a reader that stops reading `detail` answers
  // "[object Object]" — which carries no password and satisfies an
  // absence check perfectly, while the failure stops being diagnosable. The
  // recorded "a negative assertion must prove its observer is alive", met by
  // a sweep survivor on this very case.
  const detail = safeErr({ detail: `column "id" of relation "requests" — reached at ${DSN}` });
  assert.ok(!detail.includes("npg_7HqR2xVtLmZ0"), `a driver's \`detail\` is not scrubbed: ${detail}`);
  assert.match(detail, /column "id" of relation "requests"/, "a driver's `detail` is not read at all, so the failure cannot name itself");
});

test("applyPlan's REPORTED failure is scrubbed — the call site DRIVEN, never read", async () => {
  const { sql: planSql } = fakeDb({ meta: { tables: SPEC }, columns: COLUMNS, acls: { requests: OLD_COLLECT, saved: OLD_OWN } });
  const plan = await planSite(planSql, "site");
  const leaky = async () => { throw new Error(`could not reach ${DSN}`); };
  const failures = await applyPlan(leaky, plan, {});
  assert.ok(failures.length > 0, "nothing was reported, so this case proves nothing");
  for (const f of failures) {
    assert.ok(!f.err.includes("npg_7HqR2xVtLmZ0"), `a reported failure carries the password: ${f.err}`);
    assert.ok(f.err.includes("could not reach"), `the failure stopped saying what happened: ${f.err}`);
  }
});

test("EVERY catch that reads its error passes it through the scrubber — a census, so a sixth path fails by existing", () => {
  const src = readFileSync(new URL("../scripts/grants-backfill.mjs", import.meta.url), "utf8");
  // Line comments first, and length-preserving: this file's own prose names
  // `safeErr` while explaining it, and a comment is not a call site.
  const bare = src.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  const lines = bare.split("\n");
  const sites = [];
  lines.forEach((line, i) => {
    const m = /\bcatch\s*\(\(?(\w+)\)/.exec(line);
    if (!m) return;
    const body = line.slice(m.index + m[0].length);
    sites.push({ n: i + 1, bound: m[1], body, raw: src.split("\n")[i] });
  });
  // THE OBSERVER, ALIVE. A reader that matched no catch at all satisfies every
  // assertion below perfectly.
  assert.ok(sites.length >= 5, `only ${sites.length} catch sites found — the reader stopped matching`);

  for (const s of sites) {
    // The window is the LINE, so the line must hold the whole block. A
    // multi-line catch is not forbidden on principle — it is that this reader
    // would silently see only its first line, and a guard that reads half a
    // block is worse than none. It fails loudly and says to widen the reader.
    const opens = (s.body.match(/\{/g) || []).length;
    const closes = (s.body.match(/\}/g) || []).length;
    assert.equal(opens, closes, `the catch at line ${s.n} spans more than one line, so this census can only see its first — widen the reader before writing it:\n${s.raw}`);
    // A catch that never reads its error has nothing to leak.
    if (!new RegExp(`\\b${s.bound}\\b`).test(s.body)) continue;
    assert.match(s.body, /safeErr\(/, `the catch at line ${s.n} reads its error and prints it raw — a driver message can carry the whole DSN:\n${s.raw}`);
  }
});

// ── THE WORKFLOW THAT RUNS IT ──────────────────────────────────────────────
//
// The script cannot run from a session: every site's database is reached
// through `site_project.neon_conn`, readable only with the Supabase service
// key, which lives in Actions secrets and nowhere else. So the workflow IS the
// door, and its safety properties are the ones worth pinning: the default
// reads, an apply needs a word, and the recovery lands whether or not the run
// passed.
//
// That a push to main starts no workflow but the deploy is NOT asserted here —
// `test/merge-triggers.test.mjs` is the census over the whole directory, and a
// second copy of that rule is two lists of the same thing.
const PREVIEW_WF = readFileSync(new URL("../.github/workflows/grants-preview.yml", import.meta.url), "utf8");

test("the default mode READS: a dispatcher who changes nothing writes nothing", () => {
  const mode = /mode:\n(?:.*\n)*?\s+default:\s*'([a-z]+)'/.exec(PREVIEW_WF);
  assert.ok(mode, "the mode input has no default at all, so a blank box decides the mode");
  assert.equal(mode[1], "preview", "the default mode writes to customers' databases");
});

test("an APPLY needs the word, and the wall is a step of its own that runs first", () => {
  const step = /- name: refuse an apply that was not asked for\n([\s\S]*?)\n      - name: /.exec(PREVIEW_WF);
  assert.ok(step, "the refuse step is gone — an apply would run on a blank confirm box");
  assert.match(step[1], /if: \$\{\{ github\.event\.inputs\.mode == 'apply' \}\}/, "the wall no longer fires on an apply");
  assert.match(step[1], /!= "apply"/, "the wall stopped comparing against the word, so anything typed would pass");
  assert.match(step[1], /exit 1/, "the wall reports and carries on instead of stopping the run");
  // The wall must sit ABOVE the step that runs the script, or it refuses after
  // the writes: the recorded "a positional guard cannot see a dead branch",
  // inverted — here the position IS the property.
  assert.ok(PREVIEW_WF.indexOf("refuse an apply") < PREVIEW_WF.indexOf("grants-backfill.mjs"),
    "the wall runs after the script, so it can only refuse an apply that already happened");
});

test("the recovery lands whether or not the run passed — the half a failed apply needs most", () => {
  const up = /upload-artifact@v4\n([\s\S]*?)retention-days/.exec(PREVIEW_WF);
  assert.ok(up, "the before-state is never uploaded, so a half-applied run has nothing to roll back from");
  assert.match(up[1], /if: always\(\)/, "a failed run uploads nothing — exactly the run whose recorded state matters");
  assert.match(up[1], /grants-before-state\.json/);
  // And the script is told to write it on every mode that touches anything.
  assert.match(PREVIEW_WF, /--out grants-before-state\.json/, "the script is never asked to record the before-state");
});

test("rollback runs the rollback, never the apply", () => {
  const run = /if \[ "\$MODE" = "rollback" \]; then ([^;]*?); else/.exec(PREVIEW_WF.replace(/\n/g, " "));
  assert.ok(run, "the rollback branch is gone");
  assert.match(run[1], /--rollback /, "the rollback branch does not pass --rollback");
  assert.ok(!/--apply/.test(run[1]), "the rollback branch would apply");
});
