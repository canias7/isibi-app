// Every feature the designer can DECLARE must be acted on by something.
//
// WHY THIS EXISTS. This repo has now shipped the same bug at least six times:
// a schema feature that is parsed, validated, stored in `_meta`, described to
// the model as available — and enforced by nothing. `teamScope` was dead at five
// separate layers. `unique`, `uniqueCI`, `maxRows` and `noOverlap` were fully
// implemented and undeclarable, so two customers booked the same 14:00 slot and
// both were accepted. `publicView` was the reverse: declarable, advertised at two
// layers, and never created, so a generated barber shop's own home page got a 403
// from its own database (measured live 2026-08-04).
//
// Each time it was found by a human noticing. This makes it fail instead.
//
// THE INVARIANT, precisely: a property the `design_schema` tool offers is a
// PROMISE. Something in the schema engine or the RLS layer has to keep it. The
// two places that mention every property regardless — the parser's `out.push`
// and the normaliser's `norm.push` — are excluded, because appearing in those is
// exactly what "parsed and inert" looks like.
//
// The opposite direction is NOT asserted here, deliberately. A feature that is
// implemented and undeclarable is dead weight, not a lie: no site can be broken
// by it, because no site can ask for it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");

/** Blank comments, preserving offsets — never delete, or every later index shifts. */
const blankComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

/** The span of a balanced `{...}` or `(...)` starting at `from`. */
function balanced(src, from, open, close) {
  const start = src.indexOf(open, from);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (!depth) return [start, i + 1]; }
  }
  return null;
}

/** Every table property the design_schema tool offers the model. */
function declarableProps() {
  const w = blankComments(read("worker.js"));
  const at = w.indexOf('name: "design_schema"');
  assert.ok(at > 0, "the design_schema tool is gone — retarget this test");
  const tablesAt = w.indexOf("tables:", at);
  const span = balanced(w, w.indexOf("properties:", tablesAt), "{", "}");
  assert.ok(span, "could not read the table item's properties block");
  const props = w.slice(span[0], span[1]);
  const out = [];
  for (const m of props.matchAll(/([a-zA-Z_]\w*)\s*:\s*\{/g)) {
    const pre = props.slice(0, m.index);
    if (pre.split("{").length - pre.split("}").length === 1) out.push(m[1]);
  }
  return out;
}

/**
 * The schema engine and the RLS layer, with the two "mentions everything"
 * expressions cut out.
 *
 * `parseSchemaSpec`'s `out.push({...})` and `applySiteSchema`'s `norm.push({...})`
 * name every property there is. A feature that appears ONLY in those has been
 * read and written down and never acted on, which is the exact failure.
 */
function enforcementSource() {
  let src = blankComments(read("site-schema.mjs"));
  for (const marker of ["out.push({", "norm.push({"]) {
    for (;;) {
      const at = src.indexOf(marker);
      if (at < 0) break;
      const span = balanced(src, at + marker.length - 1, "{", "}");
      if (!span) break;
      src = src.slice(0, at) + " ".repeat(span[1] - at) + src.slice(span[1]);
    }
  }
  return src + "\n" + blankComments(read("site-rls.mjs"));
}

test("the design_schema tool offers a list this test can read", () => {
  const props = declarableProps();
  assert.ok(props.length >= 8, `only ${props.length} declarable properties found — the scan broke`);
  for (const core of ["name", "access", "columns"]) assert.ok(props.includes(core), "missing " + core);
});

test("both push expressions are really removed, or this test proves nothing", () => {
  // The guard rests entirely on those two being cut. If the cut silently fails,
  // every property looks enforced and the whole file is a no-op that passes.
  const src = enforcementSource();
  assert.ok(!/out\.push\(\{/.test(src) && !/norm\.push\(\{/.test(src),
    "the parser/normaliser expressions were not removed — every property would read as enforced");
  // And something must survive, or the cut removed the file.
  assert.match(src, /CREATE TABLE|ALTER TABLE/, "the cut removed too much");
});

test("EVERY declarable feature is acted on somewhere", () => {
  const src = enforcementSource();
  const dead = declarableProps().filter((p) => {
    // `name`, `access` and `columns` are the substrate, not features; they are
    // covered by every other test in the suite and their names are too common to
    // scan for honestly.
    if (["name", "access", "columns"].includes(p)) return false;
    // A PROPERTY READ — `t.publicView`, `def.noOverlap` — not merely the name
    // occurring somewhere. The first draft matched the bare name and a mutation
    // walked straight through it: renaming the real `t.noOverlap` still left the
    // word in a neighbouring string, so "enforced" was satisfied by a mention.
    // Reading the field is the weakest thing that can honestly be called acting
    // on it.
    return !new RegExp("\\.\\s*" + p + "\\b").test(src);
  });
  assert.deepEqual(dead, [],
    "the designer can declare these and nothing enforces them — a site asks for a " +
    "guarantee it does not get, silently, which is how publicView shipped a 403 " +
    "on every booking page");
});

test("mask is NOT declarable, because nothing can enforce it", () => {
  // Removed from the tool 2026-08-04 rather than implemented, and that is the
  // decision to preserve. `maskFields()` was called from `site-data.mjs`'s read
  // path, and that file was deleted on 2026-07-30 when reads moved to Neon's
  // Data API — so the Worker is no longer on the read path and cannot redact
  // anything on the way out.
  //
  // It cannot move into the database either, as specified: `mask` names OUR
  // application roles ("staff"), and Postgres knows only `anonymous` and
  // `authenticated`. Column-level GRANTs express that coarser split, but they
  // break `select=*`, which is what every read this platform makes sends.
  //
  // So the choice was a feature that lies or no feature. Same call, for the same
  // reason, that pulled `teamRead` and `teamScope` out when their enforcement went.
  const w = blankComments(read("worker.js"));
  const at = w.indexOf('name: "design_schema"');
  const span = balanced(w, w.indexOf("properties:", w.indexOf("tables:", at)), "{", "}");
  assert.ok(!declarableProps().includes("mask"),
    "mask is offered to the designer again — an owner asking for a phone number " +
    "to be redacted would get it served in full to every reader");
  assert.ok(!/redact/i.test(w.slice(span[0], span[1])),
    "the tool still describes redaction to the model");
});
