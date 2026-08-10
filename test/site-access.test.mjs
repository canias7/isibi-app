// The rules about who may do what, tested at the leaf.
//
// These are enforced in site-data.mjs and PREDICTED in builder/page-gen.mjs, and
// they have drifted between the two before. Driving them here means both callers
// are reading something that is actually pinned down.
import { test } from "node:test";
import { lintPages } from "../builder/page-gen.mjs";
import assert from "node:assert/strict";
import {
  resolveAccess, ACCESS_PRESETS, READ_LEVELS, WRITE_LEVELS,
  MANAGED_COLUMNS, isManagedColumn, ACCESS_LEVELS, normalizeAccess,
  normalizeRole, rolesForSchema, teamReadable, DEFAULT_ROLE, whyNotReadable, needsMember, canReadAccess, canWriteAccess, canMemberWrite, readNeedsMember, accessLabel } from "../site-access.mjs";

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

test("an unreadable access declaration falls back to the CLOSED pair", () => {
  // THE DIRECTION IS THE WHOLE POINT. A typo, a renamed level, a model that
  // invents a word, a stored schema from a future version — all of them land
  // here, and the fallback decides whether an unrecognised table is world
  // readable or invisible. `collect` reads nothing, so a mistake costs a broken
  // feature; `display` reads everything, so a mistake costs somebody's rows.
  // A mutation flipping this to `display` survived the whole suite.
  for (const bad of ["displayy", "DISPLAY_", "public", "", null, undefined, 7, {}, ["display"]]) {
    assert.deepEqual(resolveAccess({ access: bad }), { read: "none", write: "anyone" }, String(bad));
  }
  // …and a real one still resolves, or the loop passes on a function that
  // answers "closed" to everything.
  assert.deepEqual(resolveAccess({ access: "display" }), { read: "public", write: "none" });
  // The same rule on each axis independently: an unrecognised half falls back to
  // the preset's, never to the most permissive value.
  assert.deepEqual(resolveAccess({ access: "collect", read: "everyone" }), { read: "none", write: "anyone" });
  assert.deepEqual(resolveAccess({ access: "display", write: "all" }), { read: "public", write: "none" });
});

test("every access level has a preset, and every preset is a level", () => {
  // WHAT THE UNREACHABLE `||` IN `resolveAccess` ACTUALLY PROTECTS. A mutation
  // changing its fallback survives, because `normalizeAccess` can only return a
  // key that exists — so the branch is inert and asserting it directly proves
  // nothing. The real hazard is a SIXTH level added to one constant and not the
  // other, which is what this checks, derived from both.
  assert.deepEqual([...ACCESS_LEVELS].sort(), Object.keys(ACCESS_PRESETS).sort(),
    "ACCESS_LEVELS and ACCESS_PRESETS disagree — a level with no preset falls back to collect silently");
  // …and each preset names real values on both axes, or a typo would resolve to
  // a pair the policy builder has no branch for and emit no policy at all.
  for (const [name, pair] of Object.entries(ACCESS_PRESETS)) {
    assert.ok(READ_LEVELS.includes(pair.read), name + " has an unknown read level: " + pair.read);
    assert.ok(WRITE_LEVELS.includes(pair.write), name + " has an unknown write level: " + pair.write);
  }
});

/* ── the predicates answer on the PAIR, not the preset name ──────────────── */

test("all five presets answer exactly as they always did", () => {
  // THE SAFETY ARGUMENT, and the same one the pair axes shipped with: this
  // rewrote the predicates every access decision on every generated page runs
  // through, so the presets are diffed against what they meant BEFORE rather
  // than reasoned about. Any change here is a change to every existing site.
  const was = {
    //          needsMember, canRead, anonWrite, memberWrite
    display: [false, true, false, false],
    collect: [false, false, true, false],
    user:    [true, false, false, true],
    feed:    [true, false, false, true],
    admin:   [true, false, false, false],
  };
  for (const [p, expected] of Object.entries(was)) {
    assert.deepEqual(
      [needsMember(p), canReadAccess(p), canWriteAccess(p), canMemberWrite(p)],
      expected, p + " no longer means what it meant");
    // …and the TABLE form must agree with the string form, or a caller that
    // passes one gets a different answer from a caller that passes the other.
    assert.deepEqual(
      [needsMember({ access: p }), canReadAccess({ access: p }), canWriteAccess({ access: p }), canMemberWrite({ access: p })],
      expected, p + ": the table form disagrees with the string form");
  }
});

test("the marketplace cell reads publicly and writes per member", () => {
  // THE CELL THE PAIR AXES EXIST FOR, and the one every predicate got wrong:
  // they took an access STRING through `normalizeAccess`, which collapses
  // anything unknown to "collect", so a pair-declared table answered as
  // write-only. `lintPages` then refused a correct page with `access
  // "undefined" — reading it returns 403`.
  const t = { name: "listings", read: "public", write: "own" };
  assert.equal(canReadAccess(t), true, "the public cannot read a public table");
  assert.equal(readNeedsMember(t), false, "reading a public table is being made to require a sign-in");
  assert.equal(canMemberWrite(t), true, "a member cannot write their own listing");
  assert.equal(canWriteAccess(t), false, "a stranger can write a member-owned table");
});

test("`readNeedsMember` is NOT `needsMember`, and the difference is the pair", () => {
  // Conflating them is wrong in both directions. The marketplace cell involves
  // members (they write) while its read is open to anyone — asking the broad
  // question made the lint demand useMember() before listing rows the whole
  // public can see. The five presets never separated the two because in all
  // five the read and the write agree about needing an identity.
  const mk = { read: "public", write: "own" };
  assert.equal(needsMember(mk), true, "the table does involve members");
  assert.equal(readNeedsMember(mk), false, "…but reading it does not");
  // On every preset the two still agree, which is why this never surfaced.
  for (const p of ["display", "collect", "user", "feed", "admin"]) {
    assert.equal(needsMember(p), readNeedsMember(p) || canMemberWrite(p),
      p + ": the broad and narrow questions disagree on a preset");
  }
});

test("a pair table is NAMED to the customer, never as `undefined`", () => {
  assert.equal(accessLabel("display"), "display", "a preset must keep its familiar name");
  assert.equal(accessLabel({ access: "collect" }), "collect");
  assert.equal(accessLabel({ read: "public", write: "own" }), "read public / write own");
  // The failure it replaces: the lint printed `t.access` straight into a message.
  assert.ok(!/undefined/.test(accessLabel({ read: "public", write: "own" })));
  assert.ok(!/undefined/.test(accessLabel({})));
});

test("the LINT accepts the marketplace page it used to refuse", () => {
  // The whole point of the pair axes, refused by our own lint: `lists
  // "listings", which is access "undefined" — reading it returns 403`, printing
  // the literal word "undefined" to the customer. Driven through the real lint
  // rather than through the predicates, because the predicates were only half
  // of it — with them fixed the lint then demanded `useMember()` to read a
  // PUBLIC table, which is the same bug wearing the other face.
  const page = (src) => [{ path: "src/routes/index.tsx", source: 'import { useRows } from "@/lib/rows";\n' + src }];
  const list = (table) => page('export default function H(){ const q = useRows("' + table + '"); return <div>{String(q.data)}</div>; }');
  const lint = (t, table) => lintPages(list(table), { tables: [t] });

  assert.deepEqual(lint({ name: "listings", read: "public", write: "own", columns: [{ name: "title" }] }, "listings"), [],
    "a correct marketplace page is still refused");
  assert.deepEqual(lint({ name: "menu", access: "display", columns: [{ name: "title" }] }, "menu"), [],
    "a display table is refused");
  // AND THE REAL ERRORS ARE STILL CAUGHT, or this loosened the lint instead of
  // fixing it — which is strictly worse, because a page that 403s in front of a
  // customer is what the rule exists to stop.
  assert.match(lint({ name: "bk", access: "collect", columns: [{ name: "e" }] }, "bk")[0] || "",
    /returns 403/, "a write-only table is no longer refused");
  assert.match(lint({ name: "saved", access: "user", columns: [{ name: "e" }] }, "saved")[0] || "",
    /useMember/, "a member table no longer asks for a sign-in");
});
