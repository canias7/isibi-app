// EVERY NAME `worker.js` USES FROM A SITE MODULE MUST BE IMPORTED.
//
// `cfZoneId` read `OWN_ZONES` and worker.js never imported it. That is a
// ReferenceError on the FIRST line of the function, outside every try — so it
// propagated through `cfHostname`, past both of its catches, to the route's
// generic 500. Every Cloudflare custom-hostname call the platform ever made
// threw before it reached the API, and custom domains could not register a
// single hostname.
//
// Nothing could see it. It is not a syntax error, `node --check` passes, the
// unit suite never loads worker.js as a module (it cannot — it is a Worker
// entrypoint), and the route answered a plausible 500 that read like a backend
// fault. It only fires when that exact line runs.
//
// The check is derived at both ends: the names each site module EXPORTS, versus
// what worker.js imports and declares. No hand-written list, because a list is
// the thing that rots.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const worker = readFileSync(new URL("worker.js", root), "utf8");

/**
 * Comments BLANKED, not removed, so offsets stay valid against the real text —
 * this repo's standing rule. Needed because the modules explain themselves at
 * length and prose mentions plenty of exported names.
 */
const blank = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));

/** Import statements name things; they do not USE them. */
const stripImports = (src) => src.replace(/^import .*$/gm, (m) => " ".repeat(m.length));

// TWO VIEWS OF THE SAME FILE, and mixing them up cost a round: `declared` must
// still SEE the import statements (that is where the names are bound), while
// `code` must not (an import names a thing, it does not use it).
const declared = blank(worker);
const code = stripImports(declared);

/** name -> module, for everything our own site-*.mjs modules export. */
function exportsOfSiteModules() {
  const out = new Map();
  for (const f of readdirSync(root).filter((f) => /^site-[\w-]+\.mjs$/.test(f))) {
    const src = blank(readFileSync(new URL(f, root), "utf8"));
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      out.set(m[1], f);
    }
  }
  return out;
}

/** Every name worker.js brings into scope: imports, and its own declarations. */
function inScope(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      // `a as b` binds b.
      names.add((t.split(/\s+as\s+/).pop() || t).trim());
    }
  }
  for (const m of src.matchAll(/import\s+(\w+)\s+from/g)) names.add(m[1]);
  for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/(?:^|[\s;({])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  return names;
}

test("the scan can see worker.js and the site modules at all", () => {
  // Every assertion below is trivially true against an empty scan, which is the
  // failure this repo keeps recording. Anchored on facts that are true today
  // and would break loudly if the scan stopped reading.
  const exp = exportsOfSiteModules();
  assert.ok(exp.size > 40, `only found ${exp.size} site-module exports — the scan broke`);
  assert.equal(exp.get("OWN_ZONES"), "site-domains.mjs", "the name this test exists for is not being found");
  const scope = inScope(declared);
  assert.ok(scope.size > 200, `only ${scope.size} names in scope — the scan broke`);
  assert.ok(scope.has("normalizeHostname"), "named imports are not being read");
  assert.ok(scope.has("cfZoneId"), "local function declarations are not being read");
});

test("worker.js imports every site-module export it references", () => {
  const exported = exportsOfSiteModules();
  const scope = inScope(declared);

  const missing = [];
  for (const [name, mod] of exported) {
    if (scope.has(name)) continue;
    // USED IN A CODE SHAPE — called `name(` or indexed `name[` — rather than
    // merely appearing.
    //
    // worker.js carries thousands of lines of model prompts inside template
    // literals, and "settings" and "fill" both occur in that prose. A first
    // draft tried to blank string literals to exclude them, which means lexing
    // nested templates with a hand-rolled scanner: it got them wrong, and worse,
    // a scanner that over-blanks HIDES real code, which is the direction that
    // costs a bug rather than a false alarm.
    //
    // What this trades away, stated because a silent gap is the thing this file
    // is about: a bare read like `const x = MAX_BODY;` is not matched. Every
    // failure seen so far has been a call or an index — `OWN_ZONES[0]` is the
    // one this test was written for — and a guard that fires on real bugs beats
    // a wider one that gets switched off for crying wolf.
    const used = new RegExp(`(^|[^.\\w$])${name}\\s*[[(]`, "m").test(code);
    if (used) missing.push(`${name} (exported by ${mod})`);
  }
  assert.deepEqual(missing, [],
    "worker.js references these without importing them — a ReferenceError the moment that line runs");
});

test("OWN_ZONES specifically, because it decides who may be served as us", () => {
  // Not covered by the general check alone: this one is read by `cfZoneId`,
  // which is on the path of EVERY custom-hostname call, and a ReferenceError
  // there is indistinguishable from a backend fault at the client.
  assert.match(worker, /import \{[^}]*\bOWN_ZONES\b[^}]*\} from "\.\/site-domains\.mjs"/);
  assert.match(code, /OWN_ZONES\[0\]/, "cfZoneId no longer reads it — re-point this test");
});
