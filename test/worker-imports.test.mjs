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

test("no import into worker.js collides with a name it declares itself", () => {
  // THE MIRROR OF THE TEST ABOVE, and it cost a failed deploy to learn.
  //
  // That one asks whether every name worker.js USES is imported. This one asks
  // whether every name it IMPORTS is free — because `IMAGE_USD` was imported
  // from publish-pages.mjs into a file that already had `const IMAGE_USD = {…}`
  // of its own, the per-model price map for the customer-driven image
  // generator. Two different prices, one identifier.
  //
  // NOTHING BUT THE DEPLOY COULD SEE IT. `node --check` passed, all 1,632 tests
  // passed (no test can import a Worker entrypoint), and esbuild refused it at
  // the wrangler step: "The symbol IMAGE_USD has already been declared". The
  // whole platform stopped deploying over a name.
  //
  // Aliasing on import (`IMAGE_USD as SITE_PHOTO_USD`) is the fix, which is why
  // this reads the binding rather than the exported name.
  const imported = new Map();          // bound name -> the module it came from
  for (const m of declared.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      imported.set((t.split(/\s+as\s+/).pop() || t).trim(), m[2]);
    }
  }
  assert.ok(imported.size > 40, `only ${imported.size} imported bindings — the scan broke`);
  assert.ok(imported.has("SITE_PHOTO_USD"), "the alias this test exists for is not being read");

  // Top-level declarations only. A `const` inside a function shadows an import
  // legally and is not what breaks a build.
  const own = new Set();
  for (const m of code.matchAll(/^(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) own.add(m[1]);
  for (const m of code.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) own.add(m[1]);
  assert.ok(own.size > 100, `only ${own.size} top-level declarations — the scan broke`);
  assert.ok(own.has("IMAGE_USD"), "the declaration that caused this is not being found");

  const clashes = [...imported].filter(([name]) => own.has(name))
    .map(([name, mod]) => name + " (imported from " + mod + ", also declared in worker.js)");
  assert.deepEqual(clashes, [], "these will fail the bundler at deploy time — alias the import");
});

test("no block-scoped const/let in worker.js is read after its block closes", () => {
  // THE CLASS `node --check`, THE BUNDLER AND ALL 1,638 TESTS ARE BLIND TO.
  //
  // `vidRefN` was declared inside `if (kind !== "audio") { … }` and read ~40
  // lines after that block closed. JS parses it fine (the name could be a
  // global), esbuild bundles it without a word — verified against a minimal
  // repro — and no test can import a Worker entrypoint. So it only fired at
  // runtime: every director call with a Seedance clip attached threw
  // `ReferenceError: vidRefN is not defined`, AFTER the fee was debited and
  // outside every try/catch, and the client's catch swallowed it. Dead feature,
  // silent charges, since it shipped.
  //
  // Deliberately NARROW rather than a real scope analyser: only names declared
  // EXACTLY ONCE in the file are considered, so shadowing in another block can
  // never produce a false alarm. That is enough to catch this shape, and a
  // guard that cries wolf gets deleted.
  const src = code;
  const lines = src.split("\n");

  // How many times each identifier is declared with const/let anywhere.
  const declCount = new Map();
  for (const m of src.matchAll(/(?:^|[\s;({])(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    declCount.set(m[1], (declCount.get(m[1]) || 0) + 1);
  }

  const offenders = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(lines[i]);
    if (!m) continue;
    const name = m[2];
    if (declCount.get(name) !== 1) continue;          // shadowed somewhere: skip
    if (m[1].length < 8) continue;                    // top-of-handler depth: fine
    // CAMELCASE ONLY, and this narrowing is what makes the check usable rather
    // than noise. The first draft flagged `owner`, `live`, `total`, `note`,
    // `item`, `reply` — every one a false alarm from `tr.at("owner")`,
    // `item.live`, `parsed.reply` and from PROSE inside the director's prompt
    // templates. Blanking string literals whole-file is the trap this repo has
    // already recorded (hand-lexing nested templates gets them wrong, and an
    // over-blanking scanner HIDES real code). An identifier with an internal
    // capital does not appear in English prose or as a stray property name,
    // which is enough to catch this shape: `vidRefN`, `audRefN`,
    // `clipIsSeedanceRef` all qualify. KNOWN GAP, stated rather than papered
    // over: an all-lowercase block-scoped name read out of scope is not caught.
    if (!/[a-z][A-Z]/.test(name)) continue;

    // Walk forward until the brace depth relative to the declaration goes
    // negative — that is the line its enclosing block closes on.
    let depth = 0, close = -1;
    for (let j = i; j < lines.length && close < 0; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth < 0) { close = j; break; } }
      }
    }
    if (close < 0) continue;                          // never closes: top level

    const re = new RegExp("\\b" + name.replace(/\$/g, "\\$") + "\\b");
    for (let j = close + 1; j < lines.length; j++) {
      if (re.test(lines[j])) {
        offenders.push(name + " declared at " + (i + 1) + ", block closes at " +
          (close + 1) + ", read at " + (j + 1));
        break;
      }
    }
  }
  assert.deepEqual(offenders, [], "these are ReferenceErrors at runtime");
});
