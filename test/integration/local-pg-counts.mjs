// A LIVE PROBE: the read-only aggregate's NARROW TEXT-DATE EXCEPTION, driven
// against a REAL PostgreSQL.
//
// Owner, 2026-09-16: *"Finish the baseline with a narrowly scoped exception for
// exactly repairbench-1 → bookings → drop_off_day… Return only date-shaped
// values and aggregate counts. If values cannot safely be treated as dates,
// report the number of invalid rows without printing those values or raw
// database errors. Do not silently discard invalid rows."*
//
// The unit guards prove what `countsPlan` EMITS and what `countsOf` does with a
// fixture's rows. What they cannot prove is what PostgreSQL does with that
// statement — and this exception exists precisely because a text column can
// hold anything, so the only evidence worth having is a real column holding
// real rubbish.
//
// NOTHING IS TYPED HERE. The statement comes out of the real `countsPlan`, run
// verbatim; the reading comes out of the real `countsOf`.
//
// FOUR THINGS IT ANSWERS, and the last is why the design is what it is:
//   1. A CUSTOMER NAME IN THE DATE COLUMN NEVER LEAVES THE DATABASE. The
//      projection replaces it with NULL, so the wire carries a count and no
//      text. Asserted against the RAW psql output, not against the parsed
//      answer — a reader that drops it is not the same as it never arriving.
//   2. INVALID AND GENUINELY ABSENT ARE TWO DIFFERENT ANSWERS. `bad` separates
//      them, so neither is folded into the other.
//   3. NOTHING IS DISCARDED: grouped + unusable = every row in the table,
//      compared against an independent `COUNT(*)`.
//   4. THE NEGATIVE CONTROL — `::date` on the same column fails with a message
//      that QUOTES THE OFFENDING VALUE. That is the leak the shape regex
//      exists to avoid, and it is measured rather than asserted from the docs.
//
// AND IT WRITES NOTHING: every statement the aggregate issues is captured and
// checked for a write verb, and the table's row count is read before and after.
//
// NEEDS A LOCAL POSTGRES and nothing else — no Neon, no Supabase, no network.
//   sudo pg_ctlcluster 16 main start
//   node test/integration/local-pg-counts.mjs
// It creates its own throwaway database and drops it at the end.
import { execFileSync } from "node:child_process";
import { countsPlan, countsOf, columnInventory, calendarDate, errCode,
  COUNTS_TEXT_DATE, countsTextDateAllowed } from "../../scripts/backend-repair.mjs";

const DB = process.env.PROBE_DB || ("countsprobe_" + process.pid);
const NULLMARK = "␀NULL␀"; // cannot occur in data; psql prints it for NULL

function findPsql() {
  for (const c of ["psql", "/usr/lib/postgresql/16/bin/psql", "/usr/bin/psql"]) {
    try { execFileSync("sh", ["-c", `command -v ${c} >/dev/null 2>&1 || test -x ${c}`]); return c; } catch { /* next */ }
  }
  return "";
}
const PSQL = findPsql();
if (!PSQL) {
  console.error("no psql on this machine. This probe needs a local PostgreSQL:");
  console.error("  apt-get install -y postgresql && pg_ctlcluster 16 main start");
  process.exit(1);
}
const AS_POSTGRES = (() => { try { return process.getuid() === 0; } catch { return false; } })();

/** Run one statement and hand back `{ok, out, err}` — a failure is DATA here,
 *  because the negative control is a statement that must fail. */
function run(db, sql, extra = "") {
  const cmd = `${PSQL} -X -A -t -P null='${NULLMARK}' -F '\t' -v ON_ERROR_STOP=1 ${extra} -d ${db} -c ${JSON.stringify(sql)}`;
  const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  try {
    const out = AS_POSTGRES ? execFileSync("su", ["postgres", "-c", cmd], opts)
      : execFileSync("sh", ["-c", cmd], opts);
    return { ok: true, out: String(out), err: "" };
  } catch (e) {
    return { ok: false, out: String((e && e.stdout) || ""), err: String((e && e.stderr) || e) };
  }
}
function must(db, sql) {
  const r = run(db, sql);
  if (!r.ok) { console.error(`SETUP FAILED on: ${sql}\n${r.err}`); cleanup(); process.exit(1); }
  return r.out;
}
function admin(sql) {
  const cmd = `${PSQL} -X -d postgres -c ${JSON.stringify(sql)}`;
  const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  try {
    AS_POSTGRES ? execFileSync("su", ["postgres", "-c", cmd], opts) : execFileSync("sh", ["-c", cmd], opts);
    return true;
  } catch { return false; }
}
function cleanup() { admin(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`); }

let checks = 0, failed = 0;
function ok(cond, name, detail = "") {
  checks++;
  if (cond) console.log(`  ok   ${name}${detail ? " — " + detail : ""}`);
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
}

// ── THE DATA ────────────────────────────────────────────────────────────────
// A `text` date column holding exactly what a text date column can hold: real
// dates at different frequencies, a genuinely absent one, an empty string,
// free text that is somebody's NAME, and a string that is date-SHAPED and not
// a date. The name is the row that matters: it is what a leak would look like.
const NAME_IN_THE_DATE_COLUMN = "Alice Bloom, 07700 900123";
const ROWS = [
  ["2026-10-01", "Ada"], ["2026-10-01", "Bo"], ["2026-10-01", "Cy"],  // 3 — busiest
  ["2026-10-03", "Di"], ["2026-10-03", "Ed"],                          // 2
  ["2026-09-30", "Fi"],                                                // 1
  [null, "Gil"],                                                       // genuinely absent
  ["", "Hal"],                                                         // empty string: not date-shaped
  [NAME_IN_THE_DATE_COLUMN, "Ivy"],                                    // the leak case
  ["2026-13-45", "Jo"],                                                // date-SHAPED, not a date
  ["2026-02-29", "Kit"],                                               // shaped, and 2026 is not a leap year
];

console.log(`\ncounts-aggregate probe — database ${DB}\n`);
cleanup();
if (!admin(`CREATE DATABASE ${DB}`)) { console.error("could not create the probe database"); process.exit(1); }

/** A SQL string literal. `JSON.stringify` writes DOUBLE quotes, which Postgres
 *  reads as an identifier — the fixture's first run asked for a column named
 *  "Ada". Single quotes, doubled inside. */
const lit = (s) => s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;

must(DB, `CREATE TABLE bookings (id serial PRIMARY KEY, customer_name text, bike text, drop_off_day text)`);
for (const [day, who] of ROWS) {
  must(DB, `INSERT INTO bookings (customer_name, bike, drop_off_day) VALUES (${lit(who)}, 'a bike', ${lit(day)})`);
}
// A SECOND TABLE WITH THE SAME COLUMN NAME, so "the exception is a triple" is
// tested against a real catalog rather than only against a fixture.
must(DB, `CREATE TABLE repairs (id serial PRIMARY KEY, drop_off_day text)`);
must(DB, `INSERT INTO repairs (drop_off_day) VALUES ('2026-10-01')`);

const totalRows = Number(must(DB, `SELECT COUNT(*) FROM bookings`).trim());
ok(totalRows === ROWS.length, "the fixture landed", `${totalRows} row(s)`);

// ── THE INVENTORY, out of the catalog rather than typed ─────────────────────
const catalog = must(DB,
  `SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c ` +
  `WHERE c.table_schema = 'public' ORDER BY 1, c.ordinal_position`)
  .trim().split("\n").filter(Boolean)
  .map((l) => { const [t, c, ty] = l.split("\t"); return { t, c, ty }; });
const inv = columnInventory(catalog);
ok(inv.bookings.includes("drop_off_day text"), "the catalog says the column is text", JSON.stringify(inv.bookings));

// ── ARM 1: the exception is a TRIPLE ────────────────────────────────────────
console.log("\narm 1 — the exception covers exactly one site, table and column");
const plan = countsPlan(inv, "bookings", "drop_off_day", "repairbench-1");
ok(plan.ok === true && plan.textDate === true, "repairbench-1 bookings.drop_off_day is allowed", plan.why || "");
ok(countsPlan(inv, "bookings", "drop_off_day", "fretwork-1").why === "not-a-date-column", "another SITE is refused");
ok(countsPlan(inv, "repairs", "drop_off_day", "repairbench-1").why === "not-a-date-column", "another TABLE with the same column name is refused");
ok(countsPlan(inv, "bookings", "customer_name", "repairbench-1").why === "not-a-date-column", "the customer name is still refused");
ok(countsPlan(inv, "bookings", "bike", "repairbench-1").why === "not-a-date-column", "another text column on the same table is refused");
ok(COUNTS_TEXT_DATE.length === 1, "there is exactly one exception", JSON.stringify(COUNTS_TEXT_DATE.map((e) => `${e.slug}.${e.table}.${e.column}`)));

// ── ARM 2: run the REAL statement, and read the RAW output ──────────────────
console.log("\narm 2 — the statement runs, and no text leaves the database");
const raw = run(DB, plan.sql);
ok(raw.ok, "the aggregate ran", raw.ok ? "" : raw.err.split("\n")[0]);
console.log(`  statement: ${plan.sql}`);
const rawLines = raw.out.trim().split("\n").filter(Boolean);
console.log(`  raw rows:\n${rawLines.map((l) => "    " + JSON.stringify(l)).join("\n")}`);

// THE ASSERTION THAT MATTERS, MADE AGAINST THE RAW BYTES. A reader that drops
// a value is not the same claim as a value that never arrived.
ok(!raw.out.includes("Alice"), "the raw answer does not contain the name in the date column");
ok(!raw.out.includes("900123"), "the raw answer does not contain the phone number in the date column");
for (const [, who] of ROWS) ok(!new RegExp(`\\b${who}\\b`).test(raw.out), `the raw answer does not contain the customer "${who}"`);
// EVERY VALUE IS DATE-SHAPED OR THE NULL MARKER. There is nowhere else for a
// value to sit, which is the projection being the wall rather than the reader.
const rawVals = rawLines.map((l) => l.split("\t")[0]);
ok(rawVals.every((v) => v === NULLMARK || /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)),
  "every value on the wire is date-shaped or NULL", JSON.stringify(rawVals));

// ── ARM 3: invalid and absent are two answers, and nothing is discarded ─────
console.log("\narm 3 — invalid, absent and usable are three different answers");
const sent = [];
const sql = async (q) => {
  sent.push(q);
  const r = run(DB, q);
  if (!r.ok) throw Object.assign(new Error("probe query failed"), { code: "XX000", detail: r.err });
  return r.out.trim().split("\n").filter(Boolean).map((l) => {
    const [v, bad, n] = l.split("\t");
    return { v: v === NULLMARK ? null : v, bad: bad === "t", n };
  });
};
const agg = await countsOf(sql, plan);
console.log(`  read: ${JSON.stringify(agg)}`);
ok(sent.length === 1 && sent[0] === plan.sql, "one statement, and it is the planned one");
ok(agg.rows[0] && agg.rows[0].value === "2026-10-01" && agg.rows[0].count === 3, "busiest first", JSON.stringify(agg.rows[0]));
ok(agg.rows.map((r) => r.count).join(",") === "3,2,1,1", "the groups are in descending count order", JSON.stringify(agg.rows.map((r) => r.count)));
const absent = agg.rows.find((r) => r.value === null);
ok(absent && absent.count === 1, "the genuinely absent row is its own group and is NOT counted invalid", JSON.stringify(absent));
// The three unusable rows: the empty string and the name (refused by Postgres's
// own regex, `bad: true`) and `2026-13-45` plus `2026-02-29` (date-SHAPED, and
// refused by the calendar check in this process).
ok(agg.invalid === 4, "every unusable row is counted", `invalid=${agg.invalid}`);
const shown = agg.rows.reduce((a, r) => a + r.count, 0);
ok(shown + agg.invalid === agg.total, "the arithmetic closes", `${shown} + ${agg.invalid} = ${agg.total}`);
ok(agg.total === totalRows, "the total is every row in the table, read independently", `${agg.total} vs ${totalRows}`);
ok(!agg.rows.some((r) => r.value !== null && !calendarDate(r.value)), "no reported value is an impossible date");
ok(calendarDate("2026-02-29") === false && calendarDate("2024-02-29") === true, "the calendar check knows leap years");

// ── ARM 4: the negative control — why there is no cast ───────────────────────
console.log("\narm 4 — the NEGATIVE CONTROL: a cast would have printed the value");
const cast = run(DB, `SELECT "drop_off_day"::date AS v, COUNT(*) AS n FROM "bookings" GROUP BY 1 ORDER BY 2 DESC, 1`);
ok(!cast.ok, "the cast approach fails on this data", cast.ok ? "it succeeded" : cast.err.split("\n")[0].slice(0, 120));
// THE PROPERTY IS "the message quotes the offending VALUE", not "the message
// quotes the name": Postgres stops at the FIRST value it cannot cast, which on
// this fixture is the empty string. The first draft asserted the name and went
// red for that reason — this repository's own "assert the property, not the
// spelling", met in a probe's own control.
ok(/invalid input syntax for type date: "/.test(cast.err),
  "and its message quotes the value it choked on", cast.err.split("\n")[0].trim());
// THEN THE LEAK ITSELF, DEMONSTRATED: restricted to the row holding a name, the
// same cast prints that name. This is the one arm that shows what the shape
// regex is for, so it names the row rather than relying on fixture order.
const castName = run(DB, `SELECT "drop_off_day"::date FROM "bookings" WHERE "bike" = 'a bike' AND "customer_name" = 'Ivy'`);
ok(!castName.ok && castName.err.includes("Alice Bloom, 07700 900123"),
  "cast over the row holding a name PRINTS THE NAME — the leak this design avoids",
  castName.err.split("\n")[0].trim());
// AND THE SHAPE OF WHAT THE SCRIPT WOULD PRINT INSTEAD: a SQLSTATE and nothing
// else. `errCode` is what stands between that message and the log.
const thrown = await countsOf(async () => { throw Object.assign(new Error(cast.err), { code: "22007" }); }, plan)
  .then(() => null, (e) => e);
ok(thrown !== null, "a failing read throws rather than answering an empty reading");
ok(errCode(thrown) === "22007", "the SQLSTATE is readable", errCode(thrown));
ok(!errCode(thrown).includes("Alice") && errCode(thrown).length === 5, "and it can carry nothing but five characters");
for (const [what, junk] of [
  ["null", null], ["undefined", undefined], ["no code at all", {}],
  ["a code that is not a SQLSTATE", { code: "not a sqlstate" }], ["a numeric code", { code: 42 }],
  ["an Error whose MESSAGE is the leak", new Error(NAME_IN_THE_DATE_COLUMN)],
]) ok(errCode(junk) === "", `${what} answers "" rather than falling back to the message`);

// ── ARM 5: nothing was written ──────────────────────────────────────────────
console.log("\narm 5 — the mode wrote nothing");
ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i.test(sent.join("\n")),
  "no statement the aggregate issued carries a write verb");
const after = Number(must(DB, `SELECT COUNT(*) FROM bookings`).trim());
ok(after === totalRows, "the table holds exactly the rows it held", `${after} vs ${totalRows}`);
const afterCols = must(DB, `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public'`).trim();
ok(Number(afterCols) === catalog.length, "the schema is unchanged", `${afterCols} column(s)`);
ok(countsTextDateAllowed("repairbench-1", "bookings", "drop_off_day") === true, "the predicate is exported and answers");

cleanup();
console.log(`\n${checks - failed}/${checks} checks passed, ${failed} failed.\n`);
process.exit(failed ? 1 : 0);
