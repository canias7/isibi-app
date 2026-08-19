// A FILE `grep` WILL NOT READ IS A FILE EVERY GUARD SILENTLY SKIPS.
//
// One stray control byte makes `file` call a source file binary and makes
// `grep` skip it entirely — so it looks exactly like a file with nothing to
// report, while every source-reading check in this repo (and there are dozens
// of them, from the import scan to the prompt-wording guards) quietly stops
// covering it. The failure has no symptom of its own.
//
// FOURTH RECORDED INSTANCE, AND THE FIRST ONE ANYTHING WAS WATCHING FOR.
// `charts/lib/pharma.tsx` and `ui/pivot-table.tsx` held a NUL, and
// `ui/terminal-output.tsx` an ESC; all three were rewritten as escape sequences
// on 2026-07-31. The fourth arrived in `builder/site-tweak.mjs` on 2026-08-19
// as a NUL inside a `.join()` where a space was meant — and the whole suite was
// GREEN, because a NUL is a perfectly good separator. The only symptom was
// `grep` answering "binary file matches" on a file that had just been written.
//
// THE ESCAPE SEQUENCE STAYS LEGAL, which is the point: what is forbidden here
// is the raw byte, not the character. A file that needs one writes it as an
// escape, exactly as those three now do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Tab, newline and carriage return are the three control bytes that belong in
// text. Everything else below 32 does not.
const ALLOWED = new Set([9, 10, 13]);

test("no source file in the tree carries a raw control byte", () => {
  // `public/mkt` IS CAPTURED BUILD OUTPUT, not source. Those four demo pages
  // are prerendered React documents committed as marketing artefacts, and their
  // NUL sits inside a serialised router payload that upstream wrote — nothing
  // in this repo reads them with `grep`, and rewriting somebody else's
  // serialisation would change what the demo renders. Scoped out honestly
  // rather than papered over: what this guard is about is SOURCE.
  const skip = new Set(["node_modules", ".git", "dist", ".wrangler", "test-results", "coverage", "mkt"]);
  const exts = /\.(mjs|js|cjs|ts|tsx|json|css|md|yml|yaml|html|sh)$/;
  const bad = [];
  let seen = 0;

  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!exts.test(e.name)) continue;
      seen++;
      const buf = readFileSync(p);
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] < 32 && !ALLOWED.has(buf[i])) {
          bad.push(p.replace(ROOT, "") + " — 0x" + buf[i].toString(16).padStart(2, "0") + " at byte " + i);
          break;
        }
      }
    }
  };
  walk(ROOT);

  // A WALK THAT READ NOTHING PASSES THIS PERFECTLY, which is the shape this
  // repo has shipped before (`[].every(…)` reporting a page clean while the
  // render had failed). The floor is what stops a broken skip-list from
  // reporting a clean tree.
  assert.ok(seen > 500, "only " + seen + " source files were read — the walk broke");
  assert.deepEqual(bad, [], "\n" + bad.join("\n"));
});

test("…and the check can actually see one", () => {
  // The negative, or the sweep above is satisfied by a predicate that never
  // fires. Driven over bytes rather than over a file, so it needs nothing on
  // disk to be broken on purpose.
  const has = (s) => [...Buffer.from(s)].some((b) => b < 32 && !ALLOWED.has(b));
  assert.equal(has('const a = "x";\n\tconst b = 1;\r\n'), false, "ordinary source reads as binary");
  assert.equal(has("join(\"" + String.fromCharCode(0) + "\")"), true, "a NUL slipped past");
  assert.equal(has(String.fromCharCode(27) + "[31m"), true, "an ESC slipped past");
  assert.equal(has(String.fromCharCode(7)), true, "a BEL slipped past");
  // The escape SEQUENCE is two ordinary characters and must stay legal — that
  // is how the three files fixed in 2026-07-31 carry theirs.
  assert.equal(has("\\u0000"), false, "an escape sequence is being read as a raw byte");
});
