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

test("both write paths use it, so they cannot disagree", async () => {
  // There are two doors onto the same tables — the visitor's and the owner's —
  // and the owner's was written without this mapping. Asserted on the source so
  // a third door cannot quietly restate it.
  const fs = await import("node:fs");
  for (const f of ["site-data.mjs", "site-owner.mjs"]) {
    const src = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.match(src, /constraintError/, `${f} must map constraints through the shared rule`);
    assert.ok(!/null value in column/.test(src), `${f} has its own copy of the mapping`);
  }
});
