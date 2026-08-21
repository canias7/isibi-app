// A REVISE MUST NOT RE-LEVEL A TABLE THE SITE ALREADY HAS.
//
// Measured 2026-08-21 on the real modules. A site whose `menu_items` is
// `display` (public read, no visitor writes), revised to add a `photo` column —
// which `EDIT_RULE` explicitly invites and which is the ordinary edit — came out
// of `normalizeSchema` + `fillFromStored` as `collect`, so `applySiteSchema`
// emitted `GRANT INSERT … TO anonymous` and dropped the SELECT policy. Any
// stranger who knew the slug could write rows into the business's menu through
// the Data API, and no visitor could read it. Reported as `ok: true`, and
// permanent, because `_meta` is the only copy the request path reads.
//
// TWO CAUSES, so two halves, and either alone leaves the hole open:
//
//   `coerceTable` STAMPED `"collect"` over an absent level, which is
//   indistinguishable from a designer that said `collect` — so `fillFromStored`,
//   whose whole job is absent-means-unchanged, could never restore this one
//   field. That covers the OMISSION, which is what the rule tells the model to do.
//
//   `keepStoredAccess` drops a level that WAS declared, because the tool is a
//   schema and an answer to it may be compliance rather than intent. That covers
//   the case where the model fills the field in anyway.
//
// DRIVEN THROUGH THE REAL CHAIN rather than a hand-built spec, because the
// coercion IS the bug: a test that hands `fillFromStored` a shape the pipeline
// never produces passes while the pipeline is broken. The one thing faked is the
// database — `applySiteSchema` needs a live Postgres, and `fillFromStored` is
// exported precisely so the composition is provable without one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeSchema, fillFromStored } from "../site-schema.mjs";
import { grantsFor, policiesFor } from "../site-rls.mjs";
import { resolveAccess } from "../site-access.mjs";
import { keepStoredAccess, ACCESS_AXES } from "../builder/site-edit.mjs";
import { ADDON_TABLE_FIELDS } from "../builder/site-addon.mjs";

// What the site stored on its first build: a public menu nobody may write to.
// This is `norm.push`'s shape — the resolved access, the columns that were
// really created — because that is what `loadSiteSchema` hands `fillFromStored`.
const STORED_MENU = {
  name: "menu_items", access: "display", read: undefined, write: undefined,
  columns: ["name", "price"],
};

/** The route's own chain, minus the database: normalise, then fill from stored. */
function applied(declared, { stored = STORED_MENU, known = ["menu_items"] } = {}) {
  const spec = keepStoredAccess(normalizeSchema({ tables: [declared] }), known).spec;
  const t = spec.tables[0];
  if (stored) fillFromStored(t, stored);
  return t;
}

const grants = (t) => grantsFor({ ...t, access: t.access }).join("\n");
const policies = (t) => policiesFor({ ...t, access: t.access }).join("\n");

/* ── the bug, both directions ───────────────────────────────────────────── */

for (const [label, declared] of [
  // The literal instruction in EDIT_RULE: name the table, add the column, say
  // nothing else. This is the shape a model doing as it is told produces.
  ["an omitted level", { name: "menu_items", columns: [{ name: "name" }, { name: "price" }, { name: "photo" }] }],
  // Compliance rather than intent. The tool is a schema; a model filling it in
  // is not deciding who may read a real business's menu.
  ["a declared `collect`", { name: "menu_items", access: "collect", columns: [{ name: "photo" }] }],
  // The same answer wearing the axes instead of the preset name.
  ["a declared write:anyone pair", { name: "menu_items", read: "none", write: "anyone", columns: [{ name: "photo" }] }],
  // An unrecognised level used to be stamped `collect` too, so it flipped the
  // table just as hard as a real answer did.
  ["an unrecognised level", { name: "menu_items", access: "readonly", columns: [{ name: "photo" }] }],
]) {
  test(`a revise re-declaring an existing table keeps its stored access — ${label}`, () => {
    const t = applied(declared);

    // THE PROPERTY, not the spelling: what the site permits after the apply.
    assert.deepEqual(resolveAccess(t), { read: "public", write: "none" },
      "the stored level must survive a re-declaration");

    // And the two statements that were actually measured going wrong. A grant is
    // the whole security model here — `policiesFor` cannot save a table the
    // grants have opened, and no policy can save one the grants have closed.
    assert.doesNotMatch(grants(t), /GRANT INSERT[^\n]*anonymous/,
      "a stranger must not be able to write to the business's menu");
    assert.match(grants(t), /GRANT SELECT[^\n]*anonymous/,
      "the site's own menu page has to keep reading it");
    assert.match(policies(t), /CREATE POLICY[\s\S]*FOR SELECT/,
      "with RLS on, no SELECT policy means no rows for anyone");

    // The column the edit was actually about still lands.
    assert.ok(t.columns.some((c) => c.name === "photo"), "the requested column was lost");
  });
}

test("an omitted level is restored even when the route knew no table names", () => {
  // THE HALF THAT ONLY `coerceTable` CAN COVER, and the reason both are needed.
  // `keepStoredAccess` is fed `editState.tables`, which is empty whenever the
  // `_meta` read failed — a Neon blip on a revise — and the route deliberately
  // strips nothing then, because it cannot tell an existing table from a new one.
  // `applySiteSchema` does its OWN stored-schema read, so `fillFromStored` still
  // has the answer; it could only use it once the normaliser stopped stamping
  // over the silence. Without this the commonest edit there is re-levels the
  // table on exactly the run where something else already went wrong.
  const t = applied({ name: "menu_items", columns: [{ name: "photo" }] }, { known: [] });
  assert.deepEqual(resolveAccess(t), { read: "public", write: "none" });
  assert.doesNotMatch(grants(t), /GRANT INSERT[^\n]*anonymous/);
});

/* ── and the same chain must still do what a build needs ────────────────── */

test("a FIRST build keeps the level it declares, and an undeclared one is collect", () => {
  // No stored self and no known names — nothing to keep, so nothing may change.
  const spec = keepStoredAccess(
    normalizeSchema({
      tables: [
        { name: "menu_items", access: "display", columns: [{ name: "name" }] },
        { name: "enquiries", columns: [{ name: "email" }] },
      ],
    }),
    [],
  ).spec;
  assert.deepEqual(resolveAccess(spec.tables[0]), { read: "public", write: "none" });
  assert.match(grantsFor(spec.tables[0]).join("\n"), /GRANT SELECT[^\n]*anonymous/);

  // The fail-safe direction the tool's own `required: ["name","columns"]` relies
  // on: silence resolves to write-only, readable by nobody.
  assert.deepEqual(resolveAccess(spec.tables[1]), { read: "none", write: "anyone" });
  assert.doesNotMatch(grantsFor(spec.tables[1]).join("\n"), /GRANT SELECT[^\n]*anonymous/);
});

test("a NEW table declared on a revise keeps the level it was just given", () => {
  // The half that stops the guard being a different bug. A revise legitimately
  // adds a table, and stripping its level would make every table added after a
  // site exists come out `collect` — an invisible gallery instead of an open menu.
  const spec = keepStoredAccess(
    normalizeSchema({ tables: [{ name: "gallery", access: "display", columns: [{ name: "photo" }] }] }),
    ["menu_items", "enquiries"],
  ).spec;
  assert.deepEqual(resolveAccess(spec.tables[0]), { read: "public", write: "none" });
});

test("a `user` table re-declared bare does not become publicly writable either", () => {
  // The inverse direction, and the one that leaks rather than breaks: a private
  // per-member table flipped to `collect` gains `GRANT INSERT … TO anonymous`.
  const t = applied(
    { name: "bookings", columns: [{ name: "note" }] },
    { stored: { name: "bookings", access: "user", columns: ["slot"] }, known: ["bookings"] },
  );
  assert.deepEqual(resolveAccess(t), { read: "own", write: "own" });
  assert.doesNotMatch(grants(t), /GRANT INSERT[^\n]*anonymous/);
});

/* ── the guard itself ───────────────────────────────────────────────────── */

test("keepStoredAccess drops all three axes, and only on a table the site has", () => {
  const spec = {
    tables: [
      { name: "menu_items", access: "collect", read: "none", write: "anyone", columns: [] },
      { name: "gallery", access: "collect", columns: [] },
    ],
  };
  const { spec: out, held } = keepStoredAccess(spec, ["MENU_ITEMS"]);
  // Case-insensitive, because `_meta` and the designer need not agree on casing.
  for (const k of ACCESS_AXES) assert.equal(k in out.tables[0], false, `${k} survived on a known table`);
  assert.equal(out.tables[1].access, "collect", "an unknown table must be untouched");
  assert.deepEqual(held, [{ table: "menu_items", fields: ["access", "read", "write"] }]);
});

test("keepStoredAccess reports nothing when nothing was overruled", () => {
  // `held` is what the route puts on the response, so a plain column edit must
  // not read as a refused access change on every revise.
  const spec = normalizeSchema({ tables: [{ name: "menu_items", columns: [{ name: "photo" }] }] });
  const { held, spec: out } = keepStoredAccess(spec, ["menu_items"]);
  assert.deepEqual(held, []);
  assert.equal(out.tables[0], spec.tables[0], "an untouched table should not be copied");
});

test("an empty or missing known set is a no-op, and a junk one cannot throw", () => {
  const spec = normalizeSchema({ tables: [{ name: "menu_items", access: "display", columns: [] }] });
  for (const known of [[], null, undefined, new Set(), [null, "", 0]]) {
    const out = keepStoredAccess(spec, known);
    assert.deepEqual(out.held, [], JSON.stringify(known));
    assert.equal(out.spec.tables[0].access, "display", JSON.stringify(known));
  }
  assert.deepEqual(keepStoredAccess(null, ["x"]).held, []);
  assert.deepEqual(keepStoredAccess({}, ["x"]).held, []);
});

/* ── the wiring, which is where features of this shape die ──────────────── */

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
// Comments explain a bug and therefore SPELL it, so an absence or an ordering
// read against raw text matches the prose and passes against broken code — the
// trap this repo has recorded ten-plus times. Blanked line-wise and
// length-preserving, so every index stays valid.
//
// MEASURED INERT TODAY, said plainly rather than left looking load-bearing: no
// comment in `worker.js` currently spells `keepStoredAccess(` or
// `spec = heldAccess.spec`, so raw and blanked give the same answer on every
// assertion below. It stays because the comments beside this wiring are long and
// argue about `keepStoredAccess` by name, and one worked example added to that
// prose is all it takes — at which point the negative below would false-alarm on
// correct code and the ordering check would pass against a deleted call.
const blanked = worker.split("\n").map((l) => (l.trim().startsWith("//") ? " ".repeat(l.length) : l)).join("\n");

test("the build/revise route guards the spec it applies", () => {
  const call = blanked.indexOf("keepStoredAccess(spec,");
  assert.ok(call > 0, "the route does not call keepStoredAccess at all");
  const apply = blanked.indexOf("applySiteSchema(db, spec)");
  assert.ok(apply > 0, "could not find the build route's apply");
  assert.ok(call < apply, "the guard must run before the schema is applied");

  // It has to REPLACE the spec, not merely be called: a guard whose answer is
  // discarded is the wiring failure this repo has recorded a dozen times, and
  // from outside it is byte-identical to no guard at all.
  const between = blanked.slice(call, apply);
  assert.match(between, /spec\s*=\s*heldAccess\.spec/, "the guarded spec is computed and thrown away");

  // Fed from the site's own stored table names. An empty set silently switches
  // the guard off, so what it is fed is as load-bearing as the call.
  assert.match(blanked.slice(call, call + 200), /editState\s*&&\s*editState\.tables/);
});

test("the rules lane may still change access, which is why the guard is not in applySiteSchema", () => {
  // Stated as an assertion rather than a comment because it is the reason this
  // fix lives at one call site instead of in the schema engine. A later "tidy-up"
  // that clamps access inside `applySiteSchema` would silently break the one
  // lane whose entire job is moving it, and nothing else would notice.
  const rules = blanked.indexOf("applySiteSchema(rdb,");
  assert.ok(rules > 0, "could not find the rules lane's apply");
  const window = blanked.slice(Math.max(0, rules - 1200), rules);
  // A NEGATIVE OVER A WINDOW IS TRIVIALLY TRUE OF NOTHING, so prove the window
  // is really the rules lane's dep object before reading an absence from it.
  assert.match(window, /apply:\s*async/, "the window is not the rules lane's own wiring");
  assert.doesNotMatch(window, /keepStoredAccess\(/,
    "the rules lane must NOT be guarded — changing access is what it is for");
});

test("the addon lane's allow-list names none of the access axes", () => {
  // Derived rather than restated: the two lanes have to agree about which fields
  // are the access question, and the addon lane expresses it as an allow-list of
  // what MAY be taken. A fourth axis added to one and not the other is how this
  // comes back.
  for (const k of ACCESS_AXES) {
    assert.equal(ADDON_TABLE_FIELDS.includes(k), false, `${k} must never be adoptable from a designer`);
  }
  assert.ok(ADDON_TABLE_FIELDS.length, "an empty allow-list would pass this vacuously");
});
