// PARKED (2026-11-03, park-old-way): the old-way half of test/site-access-revise.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { normalizeSchema, fillFromStored } from "../../../site-schema.mjs";
import { grantsFor, policiesFor } from "../../../site-rls.mjs";
import { resolveAccess } from "../../../site-access.mjs";
import { keepStoredAccess, ACCESS_AXES } from "../../../builder/site-edit.mjs";
import { ADDON_TABLE_FIELDS } from "../../../builder/site-addon.mjs";

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

/* ── the wiring, which is where features of this shape die ──────────────── */

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
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
