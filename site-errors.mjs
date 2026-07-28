// What a database constraint MEANS to whoever hit it.
//
// A constraint firing is almost never a server fault — it is the caller being
// told something true: that time is taken, that field is required, that name is
// already used. Reported as a 500 it reads as "the site is broken", the caller
// retries the identical request, and the owner learns nothing.
//
// One copy, because there are two write paths onto the same tables — the public
// one a visitor uses (`site-data.mjs`) and the owner's (`site-owner.mjs`) — and
// they must say the same thing about the same constraint. The owner's path was
// written without this and answered 500 to a missing required field, which is
// how the gap surfaced.
//
// A leaf module with no imports, like site-access.mjs, so both sides can read it
// without dragging the Postgres driver along.

/**
 * Map a thrown database error to a caller-facing answer.
 * Returns {status, body:{error, code, field?}}, or null when it is genuinely
 * ours — the caller should log that and answer 500.
 */
export function constraintError(e) {
  const msg = String((e && (e.message || e.detail)) || "");

  if (/duplicate key|unique constraint/i.test(msg)) {
    return { status: 409, body: { error: "that already exists", code: "duplicate" } };
  }
  if (/missing parent/i.test(msg)) {
    return { status: 400, body: { error: "that refers to something that doesn't exist", code: "bad_ref" } };
  }
  if (/row limit reached/i.test(msg)) {
    return { status: 409, body: { error: "no more room", code: "full" } };
  }
  // EXCLUDE USING gist refusing an overlapping interval — a double booking.
  if (/conflicting key value violates exclusion constraint|_nooverlap/i.test(msg)) {
    return { status: 409, body: { error: "that time is already taken", code: "overlap" } };
  }
  // A required field left out is the sender's mistake. Name the column so a form
  // can point at the field instead of just failing.
  const notNull = msg.match(/null value in column "([^"]+)"/i);
  if (notNull) {
    return {
      status: 400,
      body: { error: notNull[1].replace(/_/g, " ") + " is required", code: "required", field: notNull[1] },
    };
  }
  if (/violates check constraint|invalid input syntax|out of range/i.test(msg)) {
    return { status: 400, body: { error: "some of that isn't valid", code: "invalid" } };
  }
  // Not a constraint. A dropped connection, a syntax error we generated, a
  // missing table — those are ours, and saying "that already exists" about them
  // would send the caller looking for a problem they do not have.
  return null;
}
