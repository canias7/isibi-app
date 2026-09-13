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

import {
  CLIENT_ROLES, readAcls, grantsFromAcls, aclSummary, tableWideWrites,
  planSite, applyPlan, verifySite,
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
