// What a database constraint means to whoever hit it.
//
// A constraint firing is almost never a server fault — it is the caller being
// told something true. Reported as a 500 it reads as "the site is broken", the
// caller retries the identical request, and nobody learns anything. Measured
// live 2026-07-28: the owner adding a row with a required column left out got
// exactly that 500.
import { test } from "node:test";
import assert from "node:assert/strict";
import { constraintError } from "../site-errors.mjs";

const err = (m) => new Error(m);

test("a missing required field names the column", () => {
  // So a form can point at the field instead of just failing.
  const r = constraintError(err('null value in column "customer_email" violates not-null constraint'));
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "required");
  assert.equal(r.body.field, "customer_email");
  assert.equal(r.body.error, "customer email is required", "underscores are not shown to a person");
});

test("a duplicate is 409 and says so", () => {
  for (const m of ['duplicate key value violates unique constraint "x"', "UNIQUE constraint failed: t.c"]) {
    const r = constraintError(err(m));
    assert.equal(r.status, 409, m);
    assert.equal(r.body.code, "duplicate");
  }
});

test("a double booking is not a server error", () => {
  // The whole point of noOverlap: "that time is already taken" is useful,
  // "something went wrong" is not.
  for (const m of ["conflicting key value violates exclusion constraint", 'violates "bookings_nooverlap"']) {
    const r = constraintError(err(m));
    assert.equal(r.status, 409, m);
    assert.equal(r.body.code, "overlap");
  }
});

test("the remaining constraints map to something a caller can act on", () => {
  const cases = [
    ["missing parent row", 400, "bad_ref"],
    ["row limit reached for table", 409, "full"],
    ["new row violates check constraint", 400, "invalid"],
    ["invalid input syntax for type integer", 400, "invalid"],
    ["value out of range", 400, "invalid"],
  ];
  for (const [msg, status, code] of cases) {
    const r = constraintError(err(msg));
    assert.equal(r.status, status, msg);
    assert.equal(r.body.code, code, msg);
  }
});

test("something that is genuinely OURS returns null", () => {
  // Saying "that already exists" about a dropped connection sends the caller
  // looking for a problem they do not have. null means: log it, answer 500.
  for (const m of ["fetch failed", "connection terminated", 'relation "x" does not exist', "syntax error at or near", ""]) {
    assert.equal(constraintError(err(m)), null, m);
  }
  assert.equal(constraintError(null), null);
  assert.equal(constraintError(undefined), null);
  assert.equal(constraintError({}), null);
});

test("it reads `detail` too, which is where the driver puts it", () => {
  assert.equal(constraintError({ detail: "duplicate key value violates unique constraint" }).body.code, "duplicate");
});

test("nobody keeps their own copy of the mapping", async () => {
  // There were two doors onto the same tables — the visitor's and the owner's —
  // and the owner's was written without this mapping, so a missing required field
  // answered 500 and the owner had no idea which field they had missed.
  //
  // Derived, and derived as an EXCLUSION rather than a list of files: the visitor's
  // door (site-data.mjs) was deleted 2026-07-30 when the data routes moved to
  // Neon's Data API, and a named list went red on a deletion that had nothing to do
  // with this invariant. What matters is that the raw Postgres strings appear in
  // exactly ONE place, whatever the callers happen to be called.
  const fs = await import("node:fs");
  const all = fs.readdirSync(new URL("../", import.meta.url)).filter((f) => /^site-.*\.mjs$/.test(f));
  assert.ok(all.length > 5, "no site modules found — this test is watching nothing");
  for (const f of all) {
    if (f === "site-errors.mjs") continue; // this IS the mapping
    const src = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!/null value in column/.test(src), f + " keeps its own copy of the constraint mapping");
    assert.ok(!/duplicate key value violates/.test(src), f + " keeps its own copy of the constraint mapping");
  }
});

test("the mapping is not orphaned — something still routes through it", async () => {
  // The other half. The exclusion above passes perfectly on a codebase where
  // NOTHING calls constraintError and every write answers 500.
  const fs = await import("node:fs");
  const all = fs.readdirSync(new URL("../", import.meta.url)).filter((f) => /^site-.*\.mjs$/.test(f) && f !== "site-errors.mjs");
  const users = all.filter((f) => /constraintError/.test(fs.readFileSync(new URL("../" + f, import.meta.url), "utf8")));
  assert.ok(users.length >= 1,
    "nothing maps constraints through the shared rule any more, so a missing required field is a 500 again");
});

