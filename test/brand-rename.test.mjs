// The rename of 2026-08-30: the product is "Go Farther" everywhere a person can
// read it, and is STILL "isibi" everywhere a machine already wrote it down.
//
// Both halves matter, and the second is the one that needs a test. A future
// session — or a search-and-replace run by someone tidying up — will see the
// leftovers and finish the job. This file is why they must not, with the
// consequence written next to each one.
//
// It also pins the trap that makes a naive replace catastrophic: the literal
// substring "isibi" sits inside the ordinary word "visibility" (v-ISIBI-lity),
// about a hundred times. A case-insensitive replace of "isibi" corrupts every
// one of them, and the corruption compiles as far as the first render.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseSchemaSpec } from "../site-schema.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// The list is NOT here. It is docs/owner-notes.md's "Names that must not be
// renamed" table — where a human actually looks before running a replace — and
// this file reads it. A copy here would be a second list of the same thing,
// which is the failure mode this codebase names most often: the two do not
// disagree on the day they are written, they disagree the day somebody edits
// one. Adding a row to that table is what puts a name under guard.
const NOTES = read("docs/owner-notes.md");
const PROTECTED = (() => {
  const at = NOTES.indexOf("## Names that must not be renamed");
  assert.ok(at > 0, "owner-notes must carry the do-not-rename section — it is the source of this test");
  const end = NOTES.indexOf("\n## ", at + 1);
  const section = NOTES.slice(at, end > at ? end : NOTES.length);
  // first cell of every table row, unescaped
  const names = [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1].replace(/\\\|/g, "|"));
  assert.ok(names.length >= 12,
    "expected the protected-name table, parsed " + names.length + " rows — has the table's shape changed?");
  return names;
})();

// Where the names live. Derived by SEARCHING rather than by listing files
// beside each name, so this cannot go stale against a refactor that moves one.
const SOURCES = (() => {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "docs", "test", "public"].includes(e.name)) continue;
      const full = path.join(dir, e.name), r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) { walk(full, r); continue; }
      if (!/\.(js|mjs|jsonc|json|ts|tsx|css|yml)$/.test(e.name)) continue;
      if (e.name === "package-lock.json") continue;
      out.push([r, fs.readFileSync(full, "utf8")]);
    }
  };
  walk(ROOT, "");
  // public/ is excluded above because it is customer-facing and must be clean;
  // the storage keys are the one thing there that must NOT be — add them back.
  for (const f of fs.readdirSync(path.join(ROOT, "public")).filter((x) => x.endsWith(".js"))) {
    out.push(["public/" + f, read("public/" + f)]);
  }
  assert.ok(out.length > 20, "expected the platform's source, found " + out.length + " files");
  return out;
})();

for (const name of PROTECTED) {
  test(`the tree still contains ${name}`, () => {
    const where = SOURCES.filter(([, src]) => src.includes(name)).map(([f]) => f);
    assert.ok(where.length > 0,
      JSON.stringify(name) + " is gone from the source.\n\n" +
      "It was NOT left behind by accident — docs/owner-notes.md, \"Names that must not be\n" +
      "renamed\", says what it is for and what breaks without it. If the rename really\n" +
      "has to reach this string, it needs a migration, not an edit; and if the string\n" +
      "is genuinely retired, take its row out of that table and this test goes with it.");
  });
}

test("the schema parser still accepts the pre-rename filename", () => {
  // The one token the rename DID reach on a customer-visible surface, and it
  // only reached it because the parser was widened first. A build whose output
  // still carries isibi.schema.json must keep parsing: read as "no such file"
  // it does not fail loudly — it reads as a site that declared no database, and
  // the build quietly provisions nothing.
  //
  // Driven through the real function rather than by reading its regex out of
  // the source: the first version of this scraped the pattern with /\/[^/]+\//
  // and stopped at the first escaped slash inside it, reporting a parser that
  // was right there as missing. Behaviour is the property; the spelling is not.
  const spec = { tables: [{ name: "orders", fields: [] }] };
  for (const name of ["isibi.schema.json", "gofarther.schema.json", "src/gofarther.schema.json"]) {
    const files = { [name]: JSON.stringify(spec), "index.html": "<!doctype html>" };
    assert.deepEqual(parseSchemaSpec(files), spec, name + " must still be recognised");
    assert.equal(name in files, false, name + " must be stripped, never shipped as an asset");
  }
  assert.equal(parseSchemaSpec({ "notgofarther.schema.json": "{}" }), null,
    "a longer filename must not match");
  assert.equal(parseSchemaSpec({ "index.html": "x" }), null,
    "a build that declares no database must still answer null");
});

test("a naive replace has not eaten the word 'visibility'", () => {
  // The reason the sweep was done by hand. `sed s/isibi/gofarther/gI` over this
  // tree rewrites ~107 occurrences of visibility/Visibility/VISIBILITY into
  // nonsense, and most of them are in CSS, where nothing throws — the page just
  // stops hiding things.
  let count = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist"].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(js|mjs|ts|tsx|css|html)$/.test(e.name)) continue;
      count += (fs.readFileSync(full, "utf8").match(/visibility/gi) || []).length;
    }
  };
  walk(ROOT);
  assert.ok(count > 60,
    "only " + count + " occurrences of 'visibility' left in the tree — a case-insensitive " +
    "replace of 'isibi' rewrites that word, and this is what it looks like afterwards");
});

test("nothing a customer reads still says isibi or Zephyr", () => {
  // Scoped to what actually ships to a person: the app's own pages and scripts,
  // the installed-PWA manifest, and the README that is copied into every
  // exported customer project. Storage keys are excluded by the filter below —
  // they are data, and the test after this one says why.
  const surfaces = [
    "public/index.html", "public/confirm.html", "public/privacy.html",
    "public/terms.html", "public/data-deletion.html", "public/site.webmanifest",
    "public/chat.js", "public/auth.js", "public/styles.css",
    "builder/lovable/template/README.md",
  ];
  for (const f of surfaces) {
    const src = read(f)
      // persisted keys are data, not copy. The `*` matters: chat.js clears our
      // storage with startsWith('zephyr_'), a bare prefix with nothing after
      // the underscore, and a `+` here reported that line as customer-facing
      // copy — a guard going red for something nobody did.
      .replace(/zephyr[_-][A-Za-z0-9_]*/gi, "")
      .replace(/[A-Za-z]isibi|isibi[a-z]/g, "");  // visibility and friends
    for (const word of ["isibi", "Isibi", "ISIBI", "zephyr", "Zephyr", "ZEPHYR"]) {
      assert.equal(src.includes(word), false,
        f + " still shows a customer the word " + JSON.stringify(word));
    }
  }
});


