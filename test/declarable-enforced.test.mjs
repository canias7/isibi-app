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
function cutSchemaSource() {
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
  return src;
}

function enforcementSource() {
  const src = cutSchemaSource();
  // Enforcement is not only DDL. `confirm` is acted on by the Worker's write
  // path through `site-mail.mjs` — no column, no policy, no trigger — so a
  // scan limited to the schema and RLS files would call it dead while it works.
  // Each file listed here is a place a declared feature can genuinely be READ;
  // adding one is how a new KIND of enforcement joins, and leaving it out is
  // what made this test fail the first time `confirm` existed.
  // `site-webhooks.mjs` is the third KIND, joining for exactly the reason the
  // paragraph above describes: `firesFor` reads `def.webhooks` on the write
  // path and turns it into an outbound POST — no column, no policy, no trigger,
  // and nothing in the schema or RLS files to find. Left out, this guard would
  // correctly report a feature that works as dead.
  // `builder/page-gen.mjs` is the FOURTH kind, and it is the weakest one — being
  // DESCRIBED to the generator rather than kept by the database. It is here for
  // `defaultSort` and the admission is worth making precisely: reads go straight
  // from the published page to Neon's Data API, which orders by whatever
  // `useRows` asks for, so no trigger, policy or constraint can decide a
  // default order. Telling the generator is not merely the cheapest enforcement
  // available — it is the ONLY one, and a field nobody is told about is worth
  // exactly nothing, which is what `defaultSort` was.
  //
  // Safe to add because the scan counts PROPERTY READS (`t.defaultSort`) rather
  // than name mentions, and this file's prose about dead features — it names
  // `roundRobin` and `sla` in a comment — is blanked before the scan sees it.
  return [src, blankComments(read("site-rls.mjs")), blankComments(read("site-mail.mjs")),
    blankComments(read("site-webhooks.mjs")), blankComments(read("builder/page-gen.mjs"))].join("\n");
}

test("the design_schema tool offers a list this test can read", () => {
  const props = declarableProps();
  assert.ok(props.length >= 8, `only ${props.length} declarable properties found — the scan broke`);
  for (const core of ["name", "access", "columns"]) assert.ok(props.includes(core), "missing " + core);
});

test("both push expressions are really removed, or this test proves nothing", () => {
  // The guard rests entirely on those two being cut. If the cut silently fails,
  // every property looks enforced and the whole file is a no-op that passes.
  // SCOPED TO THE SCHEMA SOURCE, not the whole bundle. `enforcementSource()`
  // concatenates four other files, and any of them using `out.push({` for its
  // own unrelated reasons makes this read as a failed cut — which is exactly
  // what happened when `repairImports` was added to page-gen.mjs. The cut is a
  // fact about site-schema.mjs; assert it about site-schema.mjs.
  const src = cutSchemaSource();
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

test("the designer is told publicView is what makes a listing browsable", () => {
  // THE FAILURE THIS COMES FROM was a whole site, not a missing enhancement.
  // The description named ONE use — greying out taken booking slots — so a
  // marketplace brief ("people post their own events to sell") produced an
  // `events` table at access "user" with no publicView. Measured 2026-08-10:
  // that is 401 to a signed-out visitor and own-rows-only to a signed-in one,
  // so nobody could browse a single listing, page generation had no home page
  // it could honestly write, and the build returned no pages at all.
  //
  // Asserted because a rule nobody holds is one a later edit quietly drops, and
  // this one is invisible when it goes: the schema still applies, the database
  // still comes up, and the site simply cannot be built.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("            publicView: {");
  assert.ok(at > 0, "the publicView field is gone from the designer's tool");
  const desc = w.slice(at, at + 2200);
  assert.match(desc, /VISITORS POST ROWS THAT OTHER VISITORS MUST BROWSE/,
    "the browse case is not named, so the designer only learns the booking-slot use");
  assert.match(desc, /marketplace/i, "the shape it applies to is not named");
  assert.match(desc, /401/, "the consequence of leaving it off is not stated");
  // …and the original booking-slot use is still there. Replacing one case with
  // the other trades this bug for the one it was written to fix.
  assert.match(desc, /BOOKING TABLE/, "the taken-slots use was lost");
});

test("the designer's own prompt offers all three member shapes, not two", () => {
  // THE SENTENCE THAT CAUSED IT, and this is why the fixes above were not
  // enough. `publicView`'s description and the read/write pair were both added
  // after the 2026-08-10 marketplace failure — and the SYSTEM PROMPT kept
  // saying "anything a visitor keeps as 'theirs' → a 'user' table (or 'feed'
  // when members are meant to see each other's)". A marketplace IS things
  // visitors keep as theirs, so the model was steered into the one shape a
  // stranger cannot read, by the most authoritative text in the call, while
  // the correction sat in a per-field description it only reads if it is
  // already looking at that field.
  //
  // Measured 2026-08-20: `schema gen eval` browsable 3 pass / 2 FAIL, both
  // marketplace samples, "no table a signed-out visitor can read" — the same
  // failure the axes were built to end, ten days later.
  //
  // NOT ANOTHER PARAGRAPH — a correction. The prompt enumerated two of three
  // options and the missing one is exactly the cell CLAUDE.md calls "the
  // commonest missing": anyone reads, members write their own.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('text: "You design the data model behind a small business website.');
  assert.ok(at > 0, "the designer's system prompt is gone — re-point this guard");
  const sys = w.slice(at, w.indexOf("}]", at));

  // ALL THREE NAMED. `user` and `feed` alone are what shipped the bug.
  for (const [needle, why] of [
    [/'user'/, "the private-per-member shape is not named"],
    [/'feed'/, "the members-see-each-other shape is not named"],
    [/read: \\"public\\"/, "the public-read/own-write PAIR is not offered — this is the cell a marketplace needs"],
  ]) assert.match(sys, needle, why);

  // AND THE CONSEQUENCE OF THE WRONG ONE IS STATED. Naming the third option
  // without saying why the other two hide a listing leaves the model with
  // three choices and no way to pick — the state `publicView` was in when its
  // description named only the booking slot.
  assert.match(sys, /401/, "the designer is not told what a stranger actually gets from a 'user' table");
  assert.match(sys, /signed-OUT|signed-out|never signed in/,
    "nothing in the prompt puts the designer in a stranger's shoes, which is the question it keeps getting wrong");

  // THE TEST A MARKETPLACE FAILS, phrased so the model applies it per table.
  assert.match(sys, /marketplace|listings|classifieds|directory/i,
    "the shapes this applies to are not named, so the rule reads as abstract");
});

// ─────────────────────────────────────────────────────────────────────────────
// A FIELD THE TOOL TELLS THE MODEL TO OMIT MAY NOT BE REQUIRED.
//
// `access` was both, and the contradiction cost a whole class of site. Its
// description ends "when none of them is the shape you need, set `read` and
// `write` instead and LEAVE THIS OUT" — while `required` named it. A model
// doing what it was told produced an invalid tool call; a model satisfying the
// schema had to name a preset it had just been told did not fit, and resolved
// that by picking the nearest one. That is how a marketplace ends up with
// private listings: the exact failure the read/write pair was added to prevent
// (measured live 2026-08-10, the site came out as the placeholder).
//
// Asserted as a PROPERTY rather than as "access is not required", so the next
// field to grow an omit-instruction is caught too — this tool has 21 per-table
// fields and 16 top-level ones, and three of them already say it.
/**
 * ONE PASS THAT KNOWS ABOUT BOTH, because neither order works alone.
 *
 * Blank comments first and a `//` inside a string literal — `"https://…"`, which
 * the `apis` field is full of — eats to the end of the line and destroys the
 * braces after it. That is the recorded worker.js trap ("a whole-file comment
 * blanker CANNOT be used on worker.js"; a stray `/*` in a string once ate 46% of
 * it). Blank strings first and a quote inside a comment opens a string that
 * never closes. So this walks once, tracking both states.
 *
 * `strings` chooses which view comes out: false keeps string CONTENT, which is
 * what the omit-instruction is read from; true blanks it, which is what brace
 * counting has to run on. Offsets are identical either way — blank, never
 * delete, so a span found in one indexes correctly into the other.
 */
const blankNonCode = (s, { strings }) => {
  const out = s.split("");
  const blank = (i) => { if (s[i] !== "\n") out[i] = " "; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "/" && s[i + 1] === "/") { while (i < s.length && s[i] !== "\n") blank(i++); continue; }
    if (c === "/" && s[i + 1] === "*") {
      const end = s.indexOf("*/", i + 2);
      const stop = end < 0 ? s.length : end + 2;
      while (i < stop) blank(i++);
      i--; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\") { if (strings) { blank(i); blank(i + 1); } i += 2; continue; }
        if (strings) blank(i);
        i++;
      }
      continue;
    }
  }
  return out.join("");
};

/**
 * A schema field's own text, with any nested `items:`/`properties:` block
 * removed. Without this a parent inherits every child's wording: `tables`
 * contains `access`, whose description says "leave this out", so the parent
 * reads as telling the model to omit it.
 */
const ownText = (body) => {
  let out = body;
  for (const key of ["items:", "properties:"]) {
    for (;;) {
      const at = out.indexOf(key);
      if (at < 0) break;
      const span = balanced(out, at, "{", "}");
      if (!span) break;
      out = out.slice(0, at) + out.slice(span[1]);
    }
  }
  return out;
};

test("no field the tool tells the model to omit is also required", () => {
  // TWO VIEWS OF THE SAME TEXT, at identical offsets. `struct` has strings
  // blanked and is what the brace counting runs on; `w` keeps them and is what
  // the omit-instruction is read from — the instruction IS a string, so a scan
  // that blanks strings can never find it, and a scan that keeps them cannot
  // count braces. Blanking preserves offsets, so a span found in one indexes
  // correctly into the other.
  const src = read("worker.js");
  const w = blankNonCode(src, { strings: false });      // descriptions readable
  const struct = blankNonCode(src, { strings: true });  // braces countable
  // Found in `w`: `struct` has the literal blanked, so the anchor is not there.
  // Offsets are identical, so this index is valid against both.
  const at = w.indexOf('name: "design_schema"');
  assert.ok(at > 0, "the design_schema tool is gone — retarget this test");

  // "Leave this out", "LEAVE IT OUT", "Omit it" — the phrasings the tool really
  // uses, matched on the source rather than a retyped list. Checked against the
  // file so a rewording that loses every one of them fails here rather than
  // silently making this test vacuous.
  const OMIT = /leave (this|it|them) out|omit it/i;
  assert.ok(OMIT.test(w.slice(at, at + 42000)),
    "no omit-instruction found anywhere in the tool — the pattern has drifted, and this test now passes vacuously");

  /** Every `name: { … }` directly inside a properties block, with its own text. */
  const fieldsIn = (propsAt) => {
    const span = balanced(struct, propsAt, "{", "}");
    assert.ok(span, "could not read a properties block");
    const props = struct.slice(span[0], span[1]);
    const out = new Map();
    for (const m of props.matchAll(/([a-zA-Z_]\w*)\s*:\s*\{/g)) {
      const pre = props.slice(0, m.index);
      if (pre.split("{").length - pre.split("}").length !== 1) continue;
      const body = balanced(props, m.index + m[0].length - 1, "{", "}");
      // Sliced out of `w`, not `struct` — the description is what is being read.
      // NESTED BLOCKS CUT OUT FIRST. A field's body contains its children, so
      // `tables` inherited `access`'s "leave this out" and was reported as
      // contradicting itself. Only a field's OWN text may speak for it.
      if (body) out.set(m[1], ownText(w.slice(span[0] + body[0], span[0] + body[1])));
    }
    return out;
  };

  /**
   * The `required: [...]` belonging to the same object as a properties block.
   *
   * WALKED TO THE ENCLOSING BRACE, never a byte window. The first draft read
   * 400 characters past the properties block and went red the moment a comment
   * was written above `required:` — this repo's most repeated own-goal, and it
   * happened here again while writing the test for it. Depth is tracked from
   * the end of `properties`, and the scan stops at the `}` that closes the
   * object both keys live in, so a nested `required` cannot be picked up.
   */
  const requiredAfter = (propsAt) => {
    const span = balanced(struct, propsAt, "{", "}");
    let depth = 0;
    for (let i = span[1]; i < struct.length; i++) {
      const c = struct[i];
      if (c === "{" || c === "[") depth++;
      else if (c === "]") depth--;
      else if (c === "}") { if (depth === 0) return []; depth--; }
      else if (depth === 0 && c === "r" && struct.startsWith("required:", i)) {
        const m = /required:\s*\[([^\]]*)\]/.exec(w.slice(i, i + 600));
        if (m) return [...m[1].matchAll(/"([a-zA-Z_]\w*)"/g)].map((x) => x[1]);
      }
    }
    return [];
  };

  const tablesAt = struct.indexOf("tables:", at);
  const perTable = struct.indexOf("properties:", tablesAt);
  const topLevel = struct.indexOf("properties:", struct.indexOf("input_schema:", at));

  const checked = [];
  for (const [where, propsAt] of [["per-table", perTable], ["top-level", topLevel]]) {
    const fields = fieldsIn(propsAt);
    const required = new Set(requiredAfter(propsAt));
    assert.ok(fields.size > 5, where + ": read only " + fields.size + " fields — the scan is broken");
    assert.ok(required.size > 0, where + ": read no required list — the scan is broken");
    for (const [name, body] of fields) {
      if (!OMIT.test(body)) continue;
      checked.push(where + "." + name);
      assert.ok(!required.has(name),
        where + " field `" + name + "` tells the model to leave it out AND is in `required` — " +
        "a model obeying the description writes an invalid tool call, and one obeying the schema " +
        "overrides the instruction. Drop it from `required` or drop the instruction.");
    }
  }
  assert.ok(checked.length > 0,
    "found no field carrying an omit-instruction inside a properties block — the extraction is broken, " +
    "because `access` and `fonts` both carry one");
});
