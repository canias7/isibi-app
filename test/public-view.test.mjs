// The public projection: declared everywhere, created nowhere.
//
// WHY THIS EXISTS. `publicView` was offered to the DESIGNER ("USE THIS WITH A
// BOOKING TABLE so the page can grey out slots that are already taken"), stated
// to the GENERATOR ("usePublicRows: YES — anyone may read appointment_date,
// appointment_time"), and refused by the lint when absent — and no line of code
// ever created it. It appeared in site-schema.mjs only in the parser and the
// `_meta` copy: no DDL, no grant, no object in the database.
//
// Measured live 2026-08-04 on `build smoke`: a generated barber shop asked its
// own database for today's bookings, on its own home page, and got 403. Three of
// the run's five failures were that one read.
//
// It is the parsed-but-inert pattern this repo has hit at five layers before,
// made worse by being advertised as working at two of them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publicViewSql, publicViewPredicate, DATA_API_ROLES } from "../site-rls.mjs";
import { publicViewName, hasPublicView } from "../site-access.mjs";

const COLS = ["appointment_date", "appointment_time", "status", "customer_name", "email"];
const booking = (pv) => ({ name: "bookings", access: "collect", publicView: pv });
const sqlOf = (t, cols = COLS, names) => publicViewSql(t, cols, names).join("\n");

test("a declared projection becomes a real view, granted to a stranger", () => {
  const sql = sqlOf(booking({ columns: ["appointment_date", "appointment_time"] }));
  assert.match(sql, /CREATE VIEW "bookings_public"/);
  assert.match(sql, /SELECT "appointment_date", "appointment_time" FROM "bookings"/);
  assert.match(sql, new RegExp(`GRANT SELECT ON "bookings_public" TO ${DATA_API_ROLES.anon};`));
  assert.match(sql, new RegExp(`GRANT SELECT ON "bookings_public" TO ${DATA_API_ROLES.user};`));
});

test("the view runs as its owner, or it publishes nothing at all", () => {
  // THE WHOLE MECHANISM. The table underneath is `collect` — RLS gives a stranger
  // no SELECT policy on it, deliberately. `security_invoker = false` makes the
  // view run as its owner, who bypasses that, so the projection is readable while
  // the table is not. Set it to true and this feature silently returns zero rows
  // on every site: it compiles, it grants, it 200s, and the list is always empty.
  //
  // Stated rather than left to the Postgres default, so a future default cannot
  // change it quietly.
  const sql = sqlOf(booking({ columns: ["appointment_date"] }));
  assert.match(sql, /security_invoker = false/);
  // And a barrier, so a crafted predicate cannot see rows the WHERE excluded.
  assert.match(sql, /security_barrier = true/);
});

test("the drop always runs, even for a table with no projection at all", () => {
  // A revise that REMOVES a publicView must take the view with it. Without this
  // the old view stands, still granted, still publishing the columns the owner
  // just asked to stop publishing.
  const sql = sqlOf({ name: "bookings", access: "collect" });
  assert.match(sql, /DROP VIEW IF EXISTS "bookings_public";/);
  assert.ok(!/CREATE VIEW/.test(sql), "nothing declared, nothing created");
});

test("a filter that will not compile means NO view, not a view without it", () => {
  // The one direction that must never fail quietly. `status:ne:cancelled` dropped
  // is a view that also publishes the cancellations — more rows, to more
  // strangers, with every test still green.
  const sql = sqlOf(booking({
    columns: ["appointment_date"],
    where: ["status:ne:cancelled", "nonsense-not-a-predicate"],
  }));
  assert.ok(!/CREATE VIEW/.test(sql), "one uncompilable filter must sink the whole view");
  assert.match(sql, /DROP VIEW IF EXISTS/, "and the old one must still go");
});

test("a filter naming a column the table does not have also sinks it", () => {
  const sql = sqlOf(booking({ columns: ["appointment_date"], where: ["nosuchcol:eq:x"] }));
  assert.ok(!/CREATE VIEW/.test(sql));
});

test("a projected column the table does not have sinks it", () => {
  // `columns` is what was really CREATED, not what the spec asked for. A view
  // over a missing column fails to compile, which is the 403 wearing a new cause.
  const sql = sqlOf(booking({ columns: ["appointment_date", "invented_column"] }));
  assert.ok(!/CREATE VIEW/.test(sql));
});

test("filters compile to the SQL they claim", () => {
  const known = new Set(COLS);
  assert.equal(publicViewPredicate("status:ne:cancelled", known), `"status" <> 'cancelled'`);
  assert.equal(publicViewPredicate("appointment_date:gte:2026-08-04", known), `"appointment_date" >= '2026-08-04'`);
  assert.equal(publicViewPredicate("status:isnull:", known), `"status" IS NULL`);
  assert.equal(publicViewPredicate("status:notnull:", known), `"status" IS NOT NULL`);
  assert.equal(publicViewPredicate("status:in:booked,held", known), `"status" IN ('booked', 'held')`);
  assert.equal(publicViewPredicate("status:nin:cancelled,noshow", known), `"status" NOT IN ('cancelled', 'noshow')`);
  assert.equal(publicViewPredicate("appointment_date:between:2026-01-01,2026-12-31", known),
    `"appointment_date" BETWEEN '2026-01-01' AND '2026-12-31'`);
  assert.equal(publicViewPredicate("status:startswith:conf", known), `"status" LIKE 'conf%'`);
});

test("a value with a quote in it cannot end the string it is in", () => {
  // This DDL is built by string concatenation because a VIEW definition takes no
  // bind parameters, and the value comes from a model-written schema. So the
  // quoting is the only thing between that and arbitrary SQL.
  const known = new Set(["status"]);
  const got = publicViewPredicate("status:eq:o'brien", known);
  assert.equal(got, `"status" = 'o''brien'`);
  const inj = publicViewPredicate("status:eq:x'; DROP TABLE bookings; --", known);
  assert.equal(inj, `"status" = 'x''; DROP TABLE bookings; --'`,
    "the quote must be doubled, leaving one literal rather than two statements");
  // A value spanning the whole where-clause must still land inside the literal.
  const sql = publicViewSql(
    { name: "bookings", publicView: { columns: ["status"], where: ["status:eq:a' OR '1'='1"] } },
    ["status"],
  ).join("\n");
  assert.match(sql, /WHERE "status" = 'a'' OR ''1''=''1'/);
});

test("a LIKE value cannot smuggle a wildcard", () => {
  const known = new Set(["status"]);
  // Unescaped, `100%` as a `startswith` would match anything beginning "100".
  assert.equal(publicViewPredicate("status:startswith:100%", known), `"status" LIKE '100\\%%'`);
  assert.equal(publicViewPredicate("status:contains:a_b", known), `"status" LIKE '%a\\_b%'`);
});

test("the declared limit is deliberately NOT compiled into the view", () => {
  // A LIMIT inside a view applies BEFORE the caller's filter, so
  // `?appointment_date=eq.2026-08-04` against a 500-row view silently misses
  // bookings. That is a wrong answer, not a smaller one. Asserted so the absence
  // reads as a decision rather than an oversight — the parser still accepts the
  // field, and somebody will otherwise "fix" it back in.
  const sql = sqlOf(booking({ columns: ["appointment_date"], limit: 50 }));
  assert.ok(!/\bLIMIT\b/.test(sql), "a view-level LIMIT would make a filtered read wrong");
});

test("a declared table already holding the view's name is refused", () => {
  const sql = sqlOf(booking({ columns: ["appointment_date"] }), COLS, new Set(["bookings", "bookings_public"]));
  assert.ok(!/CREATE VIEW/.test(sql));
});

test("THE CHAIN: declared, created, fetched — the three names agree", () => {
  // This feature was dead because four layers described it and one never acted.
  // The check runs end to end on the source, because any single link looking
  // right is exactly how it stayed broken.
  const schema = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const gen = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");

  // 1. the digest tells the model it works
  assert.match(gen, /usePublicRows: YES/);
  // 2. something CREATES it — the link that was missing.
  //
  // NOT just "publicViewSql is called". That version survived a mutation: strip
  // `.concat(pubSql)` from the apply loop and the call still stands there with
  // its result discarded, which is the live bug wearing a fix. The same shape as
  // the invite-code guard that passed while the normalized code was computed and
  // then ignored. So the statements have to reach the thing that RUNS them.
  const assigned = /const (\w+) = publicViewSql\(/.exec(schema);
  assert.ok(assigned, "nothing builds the view DDL at all");
  const loop = schema.split("\n").find((l) => /for \(const stmt of /.test(l));
  assert.ok(loop, "the statement-executing loop is gone — retarget this test");
  assert.ok(loop.includes(assigned[1]),
    "the view DDL is built and then dropped on the floor, so every usePublicRows call is still a 403");
  // and that loop is the one that actually talks to Postgres
  const at = schema.indexOf(loop);
  assert.match(schema.slice(at, at + 400), /await sqlQuery\(/,
    "that loop does not execute anything");
  // 3. and the client asks for the view, not the table
  const suffix = publicViewName("X").slice(1);
  assert.ok(rows.includes('const view = table + "' + suffix + '"'),
    `rows.ts must fetch the view; publicViewName says the suffix is "${suffix}"`);
  // 4. and the lint's question is still the same one the DDL asks
  assert.ok(hasPublicView({ publicView: { columns: ["a"] } }));
  assert.ok(!hasPublicView({ publicView: { columns: [] } }));
});

test("a public read does not order by a column the projection cannot have", () => {
  // `pgQuery` defaults to `order=id.desc`, and the schema engine REFUSES `id` in
  // a projection — so the default asks Postgres to sort by a column the view does
  // not have. It only bit when the caller passed params, which the taken-slots
  // call always does (a date filter). That is the exact URL the smoke logged.
  const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  const at = rows.indexOf("export function usePublicRows");
  assert.ok(at > 0);
  const body = rows.slice(at, at + 1400);
  assert.match(body, /noDefaultOrder:\s*true/,
    "usePublicRows must opt out of the id default, or a filtered read is a 400");
});
