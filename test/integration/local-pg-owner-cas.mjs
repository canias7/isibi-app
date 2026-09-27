// THE OWNER ROUTE'S CONDITIONAL WRITE, ON A REAL POSTGRESQL.
//
// The canary's D1 recovery read the price as 4.6, another writer set 5.2, and
// the recovery's plain PATCH (`UPDATE … WHERE id=?`) put 4.5 over it and
// reported the row restored. The fix is the owner route's conditional form,
// `{$set, $if}`: the condition goes into the one UPDATE's own WHERE, so
// Postgres judges it against the row as it stands when the write runs. This
// proves that on a real database, with the statement the real route builds:
//
//   * the statement is captured from `handleOwnerWrite` itself (site-owner.mjs)
//     and its placeholders converted by the real `toPgPlaceholders`/`pgParams`
//     (site-db.mjs), the way the Worker sends it;
//   * the parameters go UNTYPED, as the Neon HTTP driver sends them (psql 16's
//     `\bind`), so Postgres casts each to its column's type;
//   * a competing write lands (a) before the statement and (b) WHILE IT RUNS —
//     another transaction holds the row, the conditional UPDATE waits on its
//     lock, and is judged against the row that transaction committed.
//   * the plain statement is run through the same cases, so the defect is shown
//     on the same database.
//
// NEEDS A LOCAL POSTGRES and nothing else — no Neon, no Supabase, no network.
//   pg_ctlcluster 16 main start
//   node test/integration/local-pg-owner-cas.mjs
// It creates its own throwaway database and drops it at the end.
import { execFileSync, spawn } from "node:child_process";
import { handleOwnerWrite } from "../../site-owner.mjs";
import { sqlIdent } from "../../site-schema.mjs";
import { toPgPlaceholders, pgParams } from "../../site-db.mjs";
import { restorePlan, probeBody } from "../../scripts/canary-rows.mjs";

const DB = process.env.PROBE_DB || ("ownercas_" + process.pid);
const AS_POSTGRES = (() => { try { return process.getuid() === 0; } catch { return false; } })();
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const psqlCmd = (db, extra = "") => `psql -X -v ON_ERROR_STOP=1 -A -t ${extra} -d ${shq(db)}`;
const sh = (cmd) => (AS_POSTGRES ? ["su", ["postgres", "-c", cmd]] : ["sh", ["-c", cmd]]);

function psql(db, input) {
  const [bin, args] = sh(psqlCmd(db));
  return execFileSync(bin, args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
function one(db, sql) { return psql(db, sql + "\n").trim(); }

try { execFileSync(...sh("psql -X -At -c 'select 1'"), { stdio: "ignore" }); } catch {
  console.error("no local PostgreSQL answering. Start one:  pg_ctlcluster 16 main start");
  process.exit(1);
}

const COLS = ["name", "description", "price", "photo", "created_at"];
const SPEC = { table: "loaves", id: 6, match: { name: "Sea Salt Focaccia" }, field: "price", from: "4.5", to: "4.6" };
const SEED = [
  [1, "Country White", "Our everyday loaf.", "4.8"],
  [6, "Sea Salt Focaccia", "A tray bake, heavy on the oil, finished with flaky salt.", "4.5"],
];

/** The UPDATE the real route builds for a PATCH body, captured, not written by hand. */
async function captured(table, body) {
  const seen = [];
  const deps = {
    ownerOf: async () => "owner", dbFor: async () => "db",
    loadSchema: async () => ({ tables: [{ name: table, read: "public", write: "none", columns: COLS.map((name) => ({ name })) }] }),
    query: async (_db, sql, args) => { seen.push({ sql, args }); return sql.startsWith("UPDATE") ? [] : [{ id: 6 }]; },
    exec: async (_db, sql, args) => { seen.push({ sql, args }); return { changes: 1 }; },
    ident: sqlIdent, nowSql: () => "now()",
  };
  await handleOwnerWrite(deps, { slug: "probe", table, uid: "owner", method: "PATCH", rowId: "6", body });
  const u = seen.find((x) => x.sql.startsWith("UPDATE"));
  if (!u) throw new Error("the route built no UPDATE for " + JSON.stringify(body));
  return u;
}

/** Run a captured statement with untyped parameters; answer its command tag. */
function bound({ sql, args }) {
  return toPgPlaceholders(sql) + " \\bind " + pgParams(args).map((v) => "'" + String(v).replace(/'/g, "''") + "'").join(" ") + " \\g\n";
}
function tagOf(out) {
  const m = /UPDATE (\d+)\s*$/.exec(out.trim().split("\n").pop() || "");
  return m ? Number(m[1]) : null;
}
function runBound(stmt) {
  const [bin, args] = sh(psqlCmd(DB));
  const t0 = Date.now();
  const out = execFileSync(bin, args, { input: bound(stmt), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  return { tag: tagOf(out), ms: Date.now() - t0 };
}

function reset(table, type, price) {
  psql(DB, `DROP TABLE IF EXISTS ${table};
CREATE TABLE ${table} (id serial PRIMARY KEY, name text, description text, price ${type}, photo text, created_at text);
${SEED.map(([id, name, d, p]) => `INSERT INTO ${table} (id, name, description, price, created_at) VALUES (${id}, '${name.replace(/'/g, "''")}', '${d.replace(/'/g, "''")}', '${p}', '2026-08-21 23:06:23');`).join("\n")}
UPDATE ${table} SET price = '${price}' WHERE id = 6;\n`);
}
const read = (table, col = "price") => one(DB, `SELECT ${col} FROM ${table} WHERE id = 6`);

/**
 * Another transaction takes the row, holds it, then commits `set`. Answers
 * `{ done }` once the row is TAKEN — an object, because an async function that
 * returns a promise is adopted by `await`, which waited for the commit and made
 * the first cut of this probe run every "concurrent" case one after the other.
 */
async function holdThenCommit(table, set, holdMs = 1500) {
  const [bin, args] = sh(psqlCmd(DB));
  const child = spawn(bin, args, { stdio: ["pipe", "ignore", "pipe"] });
  child.stdin.end(`BEGIN;\nUPDATE ${table} SET ${set} WHERE id = 6;\nSELECT pg_sleep(${holdMs / 1000});\nCOMMIT;\n`);
  const done = new Promise((res) => child.on("exit", res));
  // Until the other transaction's UPDATE has taken the row.
  for (let i = 0; i < 100; i++) {
    const n = one(DB, `SELECT count(*) FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE c.relname = '${table}' AND l.mode = 'RowExclusiveLock' AND l.granted AND l.pid <> pg_backend_pid()`);
    if (n !== "0") return { done };
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("the other transaction never took the row");
}

let failed = 0;
const results = [];
function expect(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}\n        got  ${JSON.stringify(got)}${ok ? "" : `\n        want ${JSON.stringify(want)}`}`);
}

execFileSync(...sh(`psql -X -q -c ${shq(`DROP DATABASE IF EXISTS ${DB}`)} -c ${shq(`CREATE DATABASE ${DB}`)}`), { stdio: "ignore" });
try {
  for (const [table, type, readAs] of [
    // REAL is what the site engine gives a `number` column, and what run 40
    // read live: the driver hands it back as a JS number.
    ["loaves", "REAL", 4.6],
    // NUMERIC comes back as a string, in the scale it was written with.
    ["loaves_n", "NUMERIC", "4.60"],
  ]) {
    const pre = [{ id: 1, name: "Country White", price: 4.8 }, { id: 6, name: "Sea Salt Focaccia", price: readAs }];
    const plan = restorePlan(pre, SPEC, typeof readAs === "number" ? 4.5 : "4.5");
    if (plan.act !== "patch") throw new Error("the recovery's plan is not a write: " + JSON.stringify(plan));
    const cas = await captured(table, plan.body);
    const plain = await captured(table, plan.body.$set);
    const probe = await captured(table, probeBody(SPEC));
    results.push(`── ${type}: the recovery's body ${JSON.stringify(plan.body)}\n   conditional: ${cas.sql}\n   plain:       ${plain.sql}`);

    reset(table, type, readAs);
    expect(`${type} control — nothing else wrote: the conditional write lands`, [runBound(cas).tag, read(table)], [1, "4.5"]);

    reset(table, type, readAs);
    psql(DB, `UPDATE ${table} SET price = 5.2 WHERE id = 6;\n`);
    expect(`${type} another writer set 5.2 before the write: nothing is written`, [runBound(cas).tag, read(table)], [0, "5.2"]);
    reset(table, type, readAs);
    psql(DB, `UPDATE ${table} SET price = 5.2 WHERE id = 6;\n`);
    expect(`${type} THE DEFECT — the plain statement overwrites 5.2`, [runBound(plain).tag, read(table)], [1, "4.5"]);

    reset(table, type, readAs);
    let other = await holdThenCommit(table, "price = 5.2");
    let r = runBound(cas);
    await other.done;
    expect(`${type} another writer holds the row and commits 5.2 WHILE the write waits (${r.ms} ms): nothing is written`, [r.tag, read(table), r.ms >= 700], [0, "5.2", true]);
    reset(table, type, readAs);
    other = await holdThenCommit(table, "price = 5.2");
    r = runBound(plain);
    await other.done;
    expect(`${type} THE DEFECT under the same race — the plain statement waits (${r.ms} ms), then overwrites 5.2`, [r.tag, read(table), r.ms >= 700], [1, "4.5", true]);

    reset(table, type, readAs);
    other = await holdThenCommit(table, "description = 'changed by somebody'");
    r = runBound(cas);
    await other.done;
    expect(`${type} another writer changes ANOTHER field while the write waits (${r.ms} ms): the price is written, the other field kept`,
      [r.tag, read(table), read(table, "description"), r.ms >= 700], [1, "4.5", "changed by somebody", true]);

    reset(table, type, readAs);
    psql(DB, `UPDATE ${table} SET name = 'Baguette' WHERE id = 6;\n`);
    expect(`${type} the row was renamed: nothing is written`, [runBound(cas).tag, read(table)], [0, typeof readAs === "number" ? "4.6" : "4.60"]);

    reset(table, type, readAs);
    const before = one(DB, `SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM ${table} t`);
    const xmin = read(table, "xmin");
    expect(`${type} the probe (a condition no row can meet) matches nothing and changes nothing`,
      [runBound(probe).tag, one(DB, `SELECT md5(string_agg(t::text, '|' ORDER BY id)) FROM ${table} t`) === before, read(table, "xmin") === xmin], [0, true, true]);
  }
  // WHY THE PARAMETERS MUST STAY UNTYPED: a float8-typed 4.6 never equals a
  // REAL 4.6 (the REAL is widened to 4.599999904632568). Not a product path —
  // the reason the route sends the value untyped and lets Postgres cast it.
  reset("loaves", "REAL", 4.6);
  expect("REAL 4.6 against an untyped '4.6' vs a float8 4.6",
    one(DB, "SELECT (price IS NOT DISTINCT FROM '4.6')::text || ',' || (price IS NOT DISTINCT FROM 4.6::float8)::text FROM loaves WHERE id = 6"), "true,false");
} finally {
  execFileSync(...sh(`psql -X -q -c ${shq(`DROP DATABASE IF EXISTS ${DB}`)}`), { stdio: "ignore" });
}

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
