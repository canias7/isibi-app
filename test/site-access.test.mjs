// The rules about who may do what, tested at the leaf.
//
// These are enforced in site-data.mjs and PREDICTED in builder/page-gen.mjs, and
// they have drifted between the two before. Driving them here means both callers
// are reading something that is actually pinned down.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANAGED_COLUMNS, isManagedColumn, ACCESS_LEVELS, normalizeAccess,
  normalizeRole, rolesForSchema, teamReadable, DEFAULT_ROLE, whyNotReadable,
} from "../site-access.mjs";

test("managed columns are never writable, whatever case they arrive in", () => {
  for (const c of MANAGED_COLUMNS) {
    assert.equal(isManagedColumn(c), true, c);
    assert.equal(isManagedColumn(c.toUpperCase()), true, c);
  }
  assert.equal(isManagedColumn("customer_name"), false);
});

test("an unknown access level is the most restrictive one", () => {
  // collect is write-only-nobody-reads, which is the safe direction to fail.
  assert.equal(normalizeAccess("nonsense"), "collect");
  assert.equal(normalizeAccess(undefined), "collect");
  for (const a of ACCESS_LEVELS) assert.equal(normalizeAccess(a.toUpperCase()), a);
});

// ------------------------------------------------------------- roles

test("everyone starts as user", () => {
  assert.equal(DEFAULT_ROLE, "user");
});

test("a role is a short lowercase token, or it is not a role", () => {
  assert.equal(normalizeRole("Admin"), "admin");
  assert.equal(normalizeRole("  EDITOR "), "editor");
  assert.equal(normalizeRole("team_lead"), "team_lead");
  for (const bad of ["", "   ", "a b", "a-b", "x".repeat(25), "DROP TABLE _users", "admin;--", null, undefined, 7, {}]) {
    assert.equal(normalizeRole(bad), null, JSON.stringify(bad));
  }
});

test("the roles a site recognises come from its own schema", () => {
  const spec = {
    tables: [
      { name: "notices", access: "admin", writeRoles: ["editor", "Manager"] },
      { name: "deals", access: "user" },
    ],
  };
  assert.deepEqual(rolesForSchema(spec), ["admin", "editor", "manager", "user"]);
});

test("user and admin exist even on a schema that names neither", () => {
  assert.deepEqual(rolesForSchema({ tables: [{ name: "x", access: "display" }] }), ["admin", "user"]);
  assert.deepEqual(rolesForSchema(null), ["admin", "user"]);
  assert.deepEqual(rolesForSchema({}), ["admin", "user"]);
});

test("a writeRoles entry that is not a role never becomes one", () => {
  // This is where the shape check earns its keep: `writeRoles` reaches here from
  // a stored schema, and an owner can only grant a role that appears in this
  // list. Anything admitted here becomes assignable.
  const spec = { tables: [{ name: "n", access: "admin", writeRoles: ["DROP TABLE _users", "a b", "", null, "ok_role"] }] };
  assert.deepEqual(rolesForSchema(spec), ["admin", "ok_role", "user"]);
});

test("rolesForSchema never returns a duplicate", () => {
  const spec = { tables: [{ writeRoles: ["admin", "ADMIN", "admin "] }, { writeRoles: ["user"] }] };
  assert.deepEqual(rolesForSchema(spec), ["admin", "user"]);
});

// ------------------------------------------------------------- teamRead

test("teamRead only means anything on a user table", () => {
  assert.equal(teamReadable({ access: "user", teamRead: true }), true);
  // feed is already shared with every signed-in member; collect and display have
  // no owner to have a manager.
  for (const a of ["feed", "admin", "collect", "display"]) {
    assert.equal(teamReadable({ access: a, teamRead: true }), false, a);
  }
});

test("a user table without teamRead stays private", () => {
  assert.equal(teamReadable({ access: "user" }), false);
  assert.equal(teamReadable({ access: "user", teamRead: false }), false);
  assert.equal(teamReadable(null), false);
});

// A mutation sweep flipped this branch and nothing noticed. It is only a
// message — but it is the message the page generator's lint hands the model
// during a repair pass, and a repair pass costs real tokens. Telling the model
// a `collect` table "needs a signed-in member" sends it to build a sign-in for
// a contact form, which is a page it then pays to get wrong.
test("each refusal is explained in the terms of its OWN access level", () => {
  assert.match(whyNotReadable("collect"), /other visitors' submissions/);
  for (const level of ["user", "feed", "admin"]) {
    assert.match(whyNotReadable(level), /signed-in member/, level);
    assert.doesNotMatch(whyNotReadable(level), /other visitors' submissions/, level);
  }
  // `display` is readable, so it has no explanation to give beyond the generic
  // one — and an unknown level must not be described as a member table.
  assert.doesNotMatch(whyNotReadable("display"), /signed-in member/);
});
