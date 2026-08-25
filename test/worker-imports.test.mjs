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
 *
 * LINE COMMENTS FIRST, AND BLOCK OPENERS ONLY AT THE START OF A LINE. Both
 * halves are load-bearing, and the naive order was a live hole (found
 * 2026-08-14): `// \`/api/*\` IS DELIBERATELY LEFT ALONE` at worker.js:6689 is a
 * LINE comment whose text contains `/*`, so a block-first blanker read it as an
 * opener and ran to the next real `*​/` — **2,592 lines away**, at 9281.
 *
 * MEASURED: of the 115,502 non-space characters in that span, the old order left
 * ONE visible. So the guard written after the `OWN_ZONES` outage — the one whose
 * whole job is catching a name used without being imported — could not see the
 * serve path, the SPA fallback, the uploads routes or the Turnstile config at
 * all, while reporting a clean file.
 *
 * Blanking line comments first removes that opener. Anchoring the block opener
 * at line-start removes the second one, `"https://*.supabase.co"` in the CSP
 * (57,001 more characters) — a `/*` that has bitten here has always been
 * mid-line inside a string, and a real block comment always starts its own line.
 * After both, the largest block match is 1,594 characters and is a real JSDoc.
 */
const blank = (src) => src
  .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "));

/**
 * Does this source USE this name — the one reading, shared by the check and by
 * the test that drives it.
 *
 * A CALL OR AN INDEX for any name; a BARE READ as well when the name is
 * UPPER_SNAKE. The narrowing is what makes the bare form affordable: worker.js
 * carries thousands of lines of model prompts, and an English sentence does not
 * contain `MAX_FILES_PER_SITE`. Measured over the 235 UPPER_SNAKE exports the
 * scan sees, against comment-blanked source: zero false alarms.
 */
const usesName = (name, src) =>
  new RegExp(`(^|[^.\\w$])${name}\\s*[[(]`, "m").test(src) ||
  (/^[A-Z][A-Z0-9_]*$/.test(name) && new RegExp(`(^|[^.\\w$])${name}\\b`, "m").test(src));

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

test("a BARE read of an UPPER_SNAKE constant counts as using it", () => {
  // DRIVEN, because the check above cannot exercise this on its own: every name
  // it would catch this way is now imported, so it `continue`s before reaching
  // the widened branch. A mutation proved that — replacing the bare arm with
  // `false` passed the entire suite, so the fix for the bug that motivated it
  // was held by nothing.
  //
  // The narrowing to UPPER_SNAKE is what makes it affordable, and it is measured
  // rather than assumed: worker.js carries thousands of lines of model prompts,
  // and an English sentence does not contain `MAX_FILES_PER_SITE`.
  // DRIVES THE REAL `usesName`, never a copy of it. A restated rule is a second
  // reader that agrees today and diverges silently — a mutation proved exactly
  // that: replacing the widened arm in the check left this test green, because
  // it was asserting its own copy.
  const bareUsed = usesName;
  // The exact shape that was live and unseen for the life of the code.
  assert.ok(bareUsed("MAX_FILES_PER_SITE", "const room = Math.max(0, MAX_FILES_PER_SITE - objs.length);"),
    "the arithmetic read that was a caught ReferenceError still does not count as usage");
  assert.ok(bareUsed("OWN_ZONES", "const z = OWN_ZONES[0];"), "the call/index form regressed");
  // A camelCase name keeps the narrow rule — that is where the prose lives.
  assert.ok(!bareUsed("normalizeHostname", "// normalizeHostname explains itself here"),
    "a camelCase name is matched bare, which is what the prose narrowing forbids");
  // A property access is not a free variable.
  assert.ok(!bareUsed("MAX_UPLOAD_BYTES", "const n = limits.MAX_UPLOAD_BYTES;"),
    "a property of the same name reads as a bare global");
});

test("the comment blanker does not eat the file it is meant to read", () => {
  // THE FAILURE THIS EXISTS FOR IS SILENT AND TOTAL: an over-blanking scanner
  // hides real code, so every assertion below it passes against a file nobody
  // read. It happened here — 2,592 lines of the serve path were blanked to a
  // single character and the suite stayed green for as long as that lasted.
  //
  // Asserted on the PROPERTY, not on the spelling of the regexes, so a future
  // rewrite of the blanker is judged by whether it works rather than by how it
  // is written.
  //
  // AND THE PROPERTY IS PER LINE, NOT A RATIO — because the ratio was measuring
  // the wrong thing and was one comment away from firing on correct code. It was
  // `kept > 0.45` over the whole file, and a whole-line comment contributes its
  // full length to the denominator and nothing to the numerator, so what it
  // really asserted is "worker.js is less than 55% comments by character". This
  // repo puts its reasoning in comments as a matter of policy, so that threshold
  // falls a little further on every documented change and eventually goes red on
  // one that is entirely correct — the false alarm this file rates strictly
  // worse than the miss. It hit exactly 45.0% and failed on the 2026-08-25
  // container work, which added no code to the serve path at all.
  //
  // EVERY TOP-LEVEL DECLARATION MUST SURVIVE BYTE FOR BYTE, AT ITS OWN LINE.
  // That is the failure stated directly — a runaway swallowing 2,592 lines of
  // the serve path swallows dozens of declarations with it — and the count moves
  // with the CODE rather than with how much prose sits around it.
  //
  // A LINE-CARRIES-NO-MARKER RULE WAS TRIED FIRST AND IS WRONG, which is worth
  // recording because it looks right: the middle lines of a block comment carry
  // no `//`, no `/*` and no `*/` either, so it reported 1,058 lines eaten
  // against a perfectly correct blanker — first hit worker.js:815, the second
  // line of a JSDoc header.
  //
  // AGAINST `declared`, NOT `code`. `code` is `stripImports(declared)` — a
  // second, deliberate transform that blanks every `import` line. This check is
  // about the COMMENT blanker, so it is asked of the comment blanker's output.
  const rawLines = worker.split("\n");
  const cutLines = declared.split("\n");
  assert.equal(cutLines.length, rawLines.length,
    "the blanker changed the line count — it is deleting rather than blanking, so every offset below it is wrong");
  const DECL = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+[A-Za-z_$]/;
  const eaten = [];
  let decls = 0;
  for (let i = 0; i < rawLines.length; i++) {
    if (!DECL.test(rawLines[i])) continue;
    decls++;
    if (cutLines[i] !== rawLines[i]) eaten.push(i + 1);
  }
  assert.equal(eaten.length, 0,
    `the blanker ate ${eaten.length} top-level declarations (first: worker.js:${eaten[0]}) — real code is invisible to the scan`);
  // AND IT MUST HAVE HAD SOMETHING TO LOOK AT. A blanker that returned the file
  // untouched passes the check above perfectly, and so does one run over an
  // empty string — the vacuous-clean shape this file records repeatedly.
  assert.ok(decls > 200, `only ${decls} declarations were compared — the scan is not seeing worker.js`);

  // A RUNAWAY IS ONE ENORMOUS MATCH, which is the shape that distinguishes it
  // from a file that is simply well commented. The largest legitimate block
  // comment in this repo is a JSDoc header of ~1.6k characters.
  let biggest = 0;
  for (const m of worker.replace(/^[ \t]*\/\/.*$/gm, (x) => " ".repeat(x.length)).matchAll(/^[ \t]*\/\*[\s\S]*?\*\//gm)) {
    biggest = Math.max(biggest, m[0].length);
  }
  assert.ok(biggest < 8000, `a single block-comment match spans ${biggest} characters — a \`/*\` inside a string has opened a runaway`);

  // AND THE TWO KNOWN OPENERS ARE STILL IN THE FILE, so this test cannot pass
  // by them having been edited away rather than by the blanker being correct.
  assert.match(worker, /`\/api\/\*` IS DELIBERATELY LEFT ALONE/,
    "the line comment that caused the runaway is gone — re-point this test at whatever replaced it");
  assert.ok(worker.includes("/*.supabase.co"), "the CSP wildcard that caused the second runaway is gone — re-point this test");

  // The span they used to swallow must be readable.
  assert.ok(code.includes("servedAtRoot(url.pathname)"), "the hostname-rewrite guard is invisible to the scan");
  assert.ok(code.includes("MAX_FILES_PER_SITE - objs.length"), "the upload-headroom trim is invisible to the scan");
});

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
    // THE GAP THAT USED TO BE STATED HERE WAS A LIVE BUG, found 2026-08-14.
    // The note read: "a bare read like `const x = MAX_BODY;` is not matched.
    // Every failure seen so far has been a call or an index." By then
    // `MAX_FILES_PER_SITE - objs.length` was already in `buySitePhotos`,
    // unimported — a ReferenceError inside a try whose catch logs "upload
    // headroom check failed", so the owner's 200-file allowance had NEVER once
    // been enforced against generated photographs and the only trace was a log
    // line that reads like R2 being unavailable.
    //
    // A BARE READ COUNTS WHEN THE NAME IS UPPER_SNAKE, which is exactly the
    // narrowing that makes it affordable: the prose problem above is real, and
    // an English sentence does not contain `MAX_FILES_PER_SITE`. Same trick the
    // block-scope scan uses one test over (`if (!/[a-z][A-Z]/.test(name))`).
    //
    // MEASURED before widening, because a false alarm here is worse than the
    // miss: over the 235 UPPER_SNAKE exports the scan sees, the bare form flags
    // EIGHT — and all eight are the name appearing in a `//` or JSDoc comment
    // ABOUT that constant, none in prompt prose. With comment-opening lines
    // blanked it is ZERO, and removing the real import still reports the bug.
    if (usesName(name, code)) missing.push(`${name} (exported by ${mod})`);
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
    //
    // A COMMENT CONTRIBUTES NO BRACES. Prose is full of them — a documented
    // `:root{--radius:0}`, a character class carrying a brace, half a JSON
    // shape — and counting those moves the block's end. It fails BOTH ways: an
    // unmatched `}` closes the block early and every name above it is reported
    // as a runtime ReferenceError, an unmatched `{` closes it late and a real
    // out-of-scope read is hidden. Measured on the integration scan below,
    // where one comment accused two innocent helpers.
    let depth = 0, close = -1;
    for (let j = i; j < lines.length && close < 0; j++) {
      if (wholeLineComment(lines[j])) continue;
      const step = scanBraces(lines[j], depth);
      depth = step.depth;
      if (step.closed) close = j;
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

// The names a request handler binds for itself. Short and closed on purpose:
// this is a list of things that are ONLY ever legal inside the router, so a
// top-level function naming one is always wrong.
const HANDLER_LOCALS = ["du", "au", "ou", "gu", "request", "url", "ctx", "body"];

/** Top-level `function name(params) { … }`, matched by brace depth. */
function topLevelFunctions(src) {
  const out = [];
  for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gm)) {
    let i = src.indexOf("{", m.index), depth = 0, end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (!depth) { end = i; break; } }
    }
    if (end > 0) out.push({ name: m[1], params: m[2], start: m.index, body: src.slice(m.index, end + 1) });
  }
  return out;
}

/** The offenders, as a function so a mutant source can be driven through it. */
function handlerLocalLeaks(src) {
  const bad = [];
  for (const fn of topLevelFunctions(src)) {
    const params = new Set(fn.params.split(",").map((s) => s.trim().split("=")[0].replace(/^\.\.\./, "").trim()));
    for (const n of HANDLER_LOCALS) {
      if (params.has(n)) continue;
      // Bound inside the body by any ordinary form: a declaration, a catch
      // binding, a for-of head, or an arrow parameter.
      if (new RegExp("(?:const|let|var|catch\\s*\\(|for\\s*\\(\\s*(?:const|let)\\s+)\\s*" + n + "\\b").test(fn.body)) continue;
      if (new RegExp("\\(\\s*(?:[\\w$]+\\s*,\\s*)*" + n + "\\s*(?:,[^)]*)?\\)\\s*=>").test(fn.body)) continue;
      for (const m of fn.body.matchAll(new RegExp("(?:^|[^.\\w$'\"`])(" + n + ")\\s*[.\\[]", "g"))) {
        // Prose, not code. `// … a timeout of the whole request.` is a real
        // line in this file and was the scan's only false alarm. Filtered PER
        // LINE rather than by blanking comments whole-file — that is the trap
        // already recorded here: one stray `/*` inside a string ate 46% of
        // worker.js. A `//` inside a string earlier on the same line can hide
        // a real read, which is a false negative and the safe direction.
        const lineStart = fn.body.lastIndexOf("\n", m.index) + 1;
        const before = fn.body.slice(lineStart, m.index + m[0].indexOf(n));
        if (before.includes("//") || /^\s*\*/.test(before)) continue;
        bad.push(fn.name + " reads `" + n + "` @" + src.slice(0, fn.start + m.index).split("\n").length);
        break;
      }
    }
  }
  return bad;
}

test("no top-level function in worker.js reads a request-handler local", () => {
  // THE SAME RUNTIME CLASS AS `vidRefN`, ARRIVING FROM THE OTHER DIRECTION —
  // and the guard above cannot see it. That one walks FORWARD from a
  // declaration to find a read after its block closes. This one is a read
  // BEFORE the declaration, in a different function entirely: `deleteSiteFor`
  // was extracted out of the delete route and kept `du.id`, while `du` is a
  // `const` in the router ~3,700 lines below. `node --check` passes, esbuild
  // bundles it, and no test can import a Worker entrypoint — so it only fires
  // at runtime, and here inside a `try` whose `catch` logs, which is how the
  // legacy-project branch became silently dead rather than loudly broken.
  //
  // A general free-variable analyser was tried first and abandoned with
  // measurements, because an unusable guard gets deleted: the symmetric
  // backward scan flagged 30 candidates (`to`, `db`, `note`, `path` — prose
  // and property names), and a full per-function scope check flagged 1,113,
  // dominated by keywords and comment text. Both need a real parser, and there
  // is none in this repo. So the check is narrowed to the names that can only
  // ever mean the router — which is exactly the hazard an extraction creates.
  assert.deepEqual(handlerLocalLeaks(code), [], "these are ReferenceErrors at runtime");
});

test("the handler-local scan actually fires on the shape it was written for", () => {
  // The scan is a regex over prose-heavy source, so "it found nothing" has to
  // be distinguished from "it can find nothing". Driven over a mutant rather
  // than asserted on the source, or a scan broken into matching zero things
  // would pass the test above forever.
  const mutant = code.replace("const legacy = await userSiteProject(env, uid);",
    "const legacy = await userSiteProject(env, du.id);");
  assert.notEqual(mutant, code, "the anchor this mutation needs is gone — re-point it");
  const leaks = handlerLocalLeaks(mutant);
  assert.equal(leaks.length, 1, "expected exactly the re-introduced leak, got: " + leaks.join(", "));
  assert.match(leaks[0], /^deleteSiteFor reads `du`/);
});

// ── the same class, in the integration scripts ───────────────────────────────

/**
 * Names read after the block that declares them closes.
 *
 * TWO NARROWINGS, both measured on a clean file rather than guessed, because a
 * guard that cries wolf is one somebody deletes:
 *
 *   - three characters or more, or `(v) => v.id` is flagged;
 *   - and never a name that is a PARAMETER anywhere in the file, or
 *     `(res) => res.headers` is flagged — `res` clears the length rule.
 *
 * Both are shadowing, which is legal and common; neither can hide the shape
 * this exists for, since `browser` is a parameter nowhere.
 *
 * KNOWN GAPS, stated rather than papered over: a short name read out of scope
 * is not caught, nor is one declared more than once anywhere in the file, nor
 * one that happens to share a name with some parameter.
 */
// A LINE THAT IS NOTHING BUT A COMMENT. Anchored at the start on purpose: a
// mid-line `//` is as likely to be inside `"https://…"` as to open a comment,
// and truncating there would delete real code from the count.
const wholeLineComment = (l) => /^\s*(\/\/|\*)/.test(l);

/**
 * The braces one line contributes to BLOCK depth, with anything inside `[…]`
 * skipped — and the skip is the whole reason this exists.
 *
 * SIXTH FALSE ALARM FROM THIS SCAN, and the second from a REGEX literal: a
 * character class is allowed to hold an unmatched brace, so
 * `/defaultViewTransition:\s*([^,}\s]+)/` contributes a closing brace that
 * closes nothing. Measured 2026-08-20 on a correct change — it took an
 * arrow-function `const` to read as out of scope one line after its own
 * declaration, which is the least plausible finding this scan can produce and
 * still cost a hunt. A check that cries wolf on correct code is worse here than
 * the miss it prevents, which is why the SCAN moves rather than the code.
 *
 * SAFE BECAUSE BRACES INSIDE BRACKETS ARE BALANCED IN REAL CODE. The shapes
 * that put one there are `const [{ a }] = xs` and `x[`a${b}c`]`, both balanced,
 * so skipping the pair leaves the count exactly where it was. What is NOT
 * balanced is precisely the case being fixed: a lone brace in a character class
 * or a string. Per line, because a character class cannot span one — a
 * destructuring that does simply behaves as it did before.
 *
 * SHARED BY BOTH WALKS rather than written twice, the `wholeLineComment` rule:
 * two copies of "what counts as a brace" is two things that can disagree, and
 * the disagreement is silent.
 */
function scanBraces(line, depth) {
  let br = 0;
  for (const ch of line) {
    if (ch === "[") br++;
    else if (ch === "]") br = Math.max(0, br - 1);
    else if (br > 0) continue;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < 0) return { depth, closed: true }; }
  }
  return { depth, closed: false };
}

function outOfScopeReads(src) {
  const lines = src.split("\n");
  const declCount = new Map();
  for (const m of src.matchAll(/(?:^|[\s;({])(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[=;]/g)) {
    declCount.set(m[1], (declCount.get(m[1]) || 0) + 1);
  }
  // DESTRUCTURED declarations count too. Without this, `const { page, errors } =
  // await newPage()` was invisible, so a name bound there looked like it was
  // declared exactly once somewhere else and read out of scope here.
  for (const m of src.matchAll(/(?:^|[\s;({])(?:const|let)\s*[{[]([^}\]]*)[}\]]\s*=/g)) {
    for (const t of m[1].split(",")) {
      const n = t.trim().split(":").pop().split("=")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) declCount.set(n, (declCount.get(n) || 0) + 1);
    }
  }
  // Every name bound as a parameter, by any of the ordinary forms.
  const params = new Set();
  for (const m of src.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const t of m[1].split(",")) {
      const n = t.trim().split("=")[0].replace(/^\.\.\./, "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) params.add(n);
    }
  }
  for (const m of src.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g)) params.add(m[1]);
  for (const m of src.matchAll(/function\s*[A-Za-z_$\w]*\s*\(([^()]*)\)/g)) {
    for (const t of m[1].split(",")) {
      const n = t.trim().split("=")[0].replace(/^\.\.\./, "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) params.add(n);
    }
  }
  for (const m of src.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) params.add(m[1]);
  const bad = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[=;]/.exec(lines[i]);
    if (!m) continue;
    const name = m[2];
    if (declCount.get(name) !== 1 || m[1].length < 4 || name.length < 3 || params.has(name)) continue;
    // Comments contribute no braces — see the walk above, same rule, same
    // reason. It is applied through `wholeLineComment` rather than restated so
    // the two scans cannot disagree about what a comment is.
    let depth = 0, close = -1;
    for (let j = i; j < lines.length && close < 0; j++) {
      if (wholeLineComment(lines[j])) continue;
      const step = scanBraces(lines[j], depth);
      depth = step.depth;
      if (step.closed) close = j;
    }
    if (close < 0) continue;
    const re = new RegExp("(^|[^.\\w$])" + name.replace(/\$/g, "\\$") + "\\s*[.([]");
    for (let j = close + 1; j < lines.length; j++) {
      if (wholeLineComment(lines[j])) continue;
      const hit = re.exec(lines[j]);
      // PROSE, NOT CODE — `"…with no lint problems."` matched `problems.` and
      // was the third false alarm this scan produced on a clean tree. Counted
      // PER LINE rather than by blanking strings whole-file, which is the trap
      // already recorded here: one stray delimiter eats the rest of the file
      // and HIDES real code, which is the direction that costs a bug.
      // THE DELIMITER IS PART OF THE MATCH, which is what made this miss.
      // `(^|[^.\w$])` consumes the character before the name — and for
      // `"menu.tsx": MENU` that character IS the opening quote, so slicing to
      // `hit.index` left it out of the count and an object key read as an
      // identifier. Fourth false alarm from this scan, and the first that
      // survived to a red run: it accused a `const menu` that was used entirely
      // inside its own block.
      const before = hit ? lines[j].slice(0, hit.index + (hit[1] ? hit[1].length : 0)) : "";
      const inString = ((before.match(/"/g) || []).length % 2) || ((before.match(/'/g) || []).length % 2) ||
        ((before.match(/`/g) || []).length % 2);
      // A TAG NAME IS NOT A VARIABLE READ. Fifth false alarm from this scan, and
      // the first from a REGEX literal, where the quote count above cannot help:
      // `/<body[^>]*>/` matched a `const body` declared in a block far above,
      // because `<` satisfies the "not a word character" prefix and `[` looks
      // like an index. Measured 2026-08-20 on a correct change; it also took the
      // mutant test below red, since that one asserts exactly ONE finding.
      //
      // NARROW ON PURPOSE — `<` immediately against the name, no space, which is
      // the tag shape in a regex, a string and JSX alike. A real comparison is
      // written `a < b`, and even `a <b` costs a miss rather than a false alarm.
      // In JSX `<Foo` IS a reference, and a component is imported at module
      // scope rather than block-scoped, so excluding it costs this scan nothing.
      const isTag = hit && /<\/?$/.test(before);
      if (hit && !inString && !isTag) {
        bad.push(name + " declared at " + (i + 1) + ", block closes at " + (close + 1) + ", read at " + (j + 1));
        break;
      }
    }
  }
  return bad;
}

test("no integration script reads a block-scoped name after its block closes", () => {
  // THIRD INSTANCE OF THIS BUG IN ONE DAY, and the third one written from
  // scratch: `vidRefN` in worker.js, `du.id` in `deleteSiteFor`, and then the
  // revise journey in build-smoke.mjs reusing `browser` from the render section
  // above it — a `let` declared inside that block and closed in its own
  // `finally`.
  //
  // These scripts are the ones nothing else can check: they are not imported by
  // the unit suite (they talk to a deployed Worker), `node --check` accepts an
  // out-of-scope read without a word, and the only other signal is a red CI run
  // that spent a real build to produce it.
  const dir = new URL("../test/integration/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length >= 3, "only " + files.length + " integration scripts found — the scan broke");
  for (const f of files) {
    assert.deepEqual(outOfScopeReads(readFileSync(new URL(f, dir), "utf8")), [],
      f + ": these are ReferenceErrors at runtime");
  }
});

test("the integration scope scan fires on the shape it was written for", () => {
  // Driven over a mutant rather than asserted on the source: a scan broken into
  // matching nothing would pass the test above forever.
  const src = readFileSync(new URL("../test/integration/build-smoke.mjs", import.meta.url), "utf8");
  const mutant = src.replace(
    "        jb = await chromium.launch({ executablePath: findChromium() || undefined });\n        const pg2 = await jb.newPage();",
    "        const pg2 = await browser.newPage();");
  assert.notEqual(mutant, src, "the anchor this mutation needs is gone — re-point it");
  const found = outOfScopeReads(mutant);
  assert.equal(found.length, 1, "expected exactly the re-introduced read, got: " + found.join(" ; "));
  assert.match(found[0], /^browser declared at/);

  // AND IT MUST NOT FIRE ON A QUOTED KEY. The delimiter is consumed by the
  // match, so `"menu.tsx": MENU` read as an identifier until the count included
  // it — and the accusation landed on a `const menu` used entirely inside its
  // own block. Both directions, because a scan narrowed until it matches nothing
  // passes the test above forever.
  const quoted = [
    "function f() {",
    "  if (true) {",
    "    const menu = 1;",
    "    use(menu);",
    "  }",
    '  post({ files: { "index.tsx": INDEX, "menu.tsx": MENU } });',
    "}",
  ].join("\n");
  assert.deepEqual(outOfScopeReads(quoted), [], "a quoted object key is being read as an identifier");

  // The same shape with a REAL out-of-scope read still reports.
  const real = quoted.replace('  post({ files: { "index.tsx": INDEX, "menu.tsx": MENU } });', "  use(menu.length);");
  assert.equal(outOfScopeReads(real).length, 1, "narrowed so far it no longer catches the real thing");

  // AND IT MUST NOT FIRE ON A TAG NAME IN A REGEX. The quote count cannot see
  // inside a `/.../` literal, so `<body[^>]*>` read as an index into a `const
  // body` declared in a block above it. Both directions, because a scan
  // narrowed until it matches nothing passes the test above forever.
  const tag = [
    "function f() {",
    "  if (true) {",
    "    const body = 1;",
    "    use(body);",
    "  }",
    "  const t = (html.match(/<body[^>]*>([\\s\\S]*)<\\/body>/i) || [])[1];",
    "  return t;",
    "}",
  ].join("\n");
  assert.deepEqual(outOfScopeReads(tag), [], "a tag name inside a regex is being read as an identifier");

  // The same file with a genuine out-of-scope read still reports, so the
  // exemption above cannot have switched the scan off for that name.
  const tagReal = tag.replace("  return t;", "  return body.length;");
  assert.equal(outOfScopeReads(tagReal).length, 1,
    "the tag exemption swallowed a real read of the same name");
});

test("a brace in a comment does not move where the block closes", () => {
  // PROSE IS FULL OF BRACES — a documented `:root{--radius:0}`, a character
  // class carrying one, half a JSON shape. Before the depth walk skipped
  // comment lines, a single unmatched one closed the enclosing block early and
  // every name declared above it was reported as a runtime ReferenceError.
  // Measured in build-smoke.mjs: one comment accused two innocent helpers.
  //
  // THE ASSERTION IS THE LINE, NOT THE COUNT, and that is what makes it
  // discriminate. Both the broken and the fixed scan report `helperOne` — the
  // broken one blames the IN-BLOCK read on line 4, the fixed one the genuine
  // out-of-scope read on line 7. A test counting findings passes either way.
  const src = [
    "function outer() {",
    "    const helperOne = (x) => x;",
    "    // a comment mentioning a lone } brace",
    "    const helperTwo = (x) => helperOne(x);",
    "    return helperTwo(1);",
    "}",
    "helperOne(2);",
  ].join("\n");
  const found = outOfScopeReads(src);
  assert.equal(found.length, 1, "expected only the real read, got: " + found.join(" ; "));
  assert.equal(found[0], "helperOne declared at 2, block closes at 6, read at 7",
    "the comment's brace moved the block");

  // AND THE COMMENT IS WHAT IS BEING TESTED: the identical source without it
  // must reach the same verdict, or this proves nothing about comments.
  const noComment = src.split("\n").filter((l) => !l.includes("//")).join("\n");
  assert.equal(outOfScopeReads(noComment)[0], "helperOne declared at 2, block closes at 5, read at 6",
    "the control case does not behave as the commented one");
});

test("every depth walk in this file skips comment lines", () => {
  // THERE ARE TWO OF THESE WALKS — one over worker.js, one over the integration
  // scripts — and only the second is reachable through `outOfScopeReads`, so
  // the test above holds exactly half of the fix. MEASURED: deleting the skip
  // from the worker walk survived the entire suite.
  //
  // Merging the two would be the better answer and they are not the same scan
  // (different read patterns, and only one has the camelCase filter), so this
  // asserts the shared property instead: whatever walks brace depth here must
  // ask `wholeLineComment` first. Derived, so a third walk is covered without
  // anybody remembering this test.
  const self = readFileSync(new URL("./worker-imports.test.mjs", import.meta.url), "utf8");
  const walks = [...self.matchAll(/for \(let j = i; j < lines\.length && close < 0; j\+\+\) \{\n((?:[^\n]*\n){3})/g)];
  assert.ok(walks.length >= 2, "found " + walks.length + " depth walks — the scan for them broke");
  for (const w of walks) {
    assert.match(w[1], /if \(wholeLineComment\(lines\[j\]\)\) continue;/,
      "a depth walk counts braces inside comments: " + w[1].trim());
    // AND THE SAME ARGUMENT FOR THE BRACES THEMSELVES. A walk that counts them
    // inline is one that counts the unmatched `}` in a regex character class —
    // the sixth false alarm this scan produced, and it accused an arrow
    // function of being out of scope one line below its own declaration. Both
    // go through `scanBraces` so there is ONE answer to what a brace is.
    assert.match(w[1], /scanBraces\(lines\[j\], depth\)/,
      "a depth walk counts braces itself rather than through the shared reading: " + w[1].trim());
  }
});

test("nothing re-exports a name it also uses — that binds nothing", () => {
  // `export { X } from "./y.mjs"` FORWARDS X and creates NO local binding, so a
  // call to `X(...)` in the same file is a ReferenceError at runtime. Nothing
  // static catches it: `node --check` passes, esbuild bundles it, and every one
  // of this repo's 2,766 unit tests stayed green while the build service died at
  // the first prerender of every build (found 2026-08-14, by the container
  // harness, on a re-export added the same hour).
  //
  // The fix is always the two-line form — `import { X } …; export { X };` — which
  // binds AND forwards. Derived over every module rather than pinned to the one
  // that broke.
  const files = [];
  for (const d of [new URL("./", root), new URL("./builder/", root)]) {
    for (const f of readdirSync(d)) if (f.endsWith(".mjs")) files.push(new URL(f, d));
  }
  assert.ok(files.length > 20, `only ${files.length} modules scanned — the walk broke`);

  let seen = 0;
  const bad = [];
  for (const f of files) {
    const src = blank(readFileSync(f, "utf8"));
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?/gm)) {
      seen++;
      const rest = src.slice(0, m.index) + src.slice(m.index + m[0].length);
      for (const raw of m[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        // Used as a value — called, or opened as a JSX/generic — anywhere else.
        if (name && new RegExp(`(^|[^.\\w$])${name}\\s*[(<]`, "m").test(rest)) {
          bad.push(String(f).split("/").pop() + " re-exports " + name + " and calls it — that is a ReferenceError");
        }
      }
    }
  }
  // A scan that stops matching reports a clean repo. There is at least one such
  // statement today (render-check.mjs forwards fileForRoute); if that stops being
  // true this check is free, and should be re-pointed rather than left looking busy.
  assert.ok(seen >= 1, "no `export { … } from` statements found at all — the scan has drifted");
  assert.deepEqual(bad, [], bad.join("\n  "));
});

/**
 * Split on TOP-LEVEL commas only.
 *
 * A declarator list is full of commas that belong to something else — an
 * object literal, a call, an array — and this repo has written the flat
 * version four separate times and had to fix it each time.
 */
function splitTopLevel(src) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) { out.push(src.slice(start, i)); start = i + 1; }
  }
  out.push(src.slice(start));
  return out;
}

test("the build response reads only fields the build RESULT carries", () => {
  // THE `du.id` CLASS, AND I SHIPPED IT. `sourceStored` was declared inside
  // `buildAndPublishPages` and named in the response literal inside
  // `handleRequest`, ~5,000 lines away — a ReferenceError on EVERY build.
  // `node --check` passes, esbuild bundles it, 3,788 unit tests stayed green,
  // and the route answered `500 {}`. Caught by `confirm smoke` and
  // `member smoke` going red in CI.
  //
  // THE EXISTING SCANNER CANNOT SEE IT: that one walks FORWARD from a
  // declaration looking for a read after its block closes, and this is a read
  // in a DIFFERENT function that never mentions the declaration at all.
  //
  // So this asks the narrow question instead: every bare identifier in the
  // build response literal must be something `handleRequest` really binds.
  // Narrow deliberately — a general free-variable analyser was tried in this
  // repo and abandoned with measurements (1,113 candidates, dominated by prose
  // and property names), and a false alarm on correct code is worse than the
  // miss this leaves.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("        cost: schemaCost + pages.cost,");
  assert.ok(at > 0, "the build response literal moved — rescope this");
  const start = w.lastIndexOf("return Response.json({", at);
  const end = w.indexOf("\n      });", at);
  assert.ok(start > 0 && end > start, "the response literal scan lost its bounds");
  // Comments blanked first: this file states its reasoning between the lines,
  // and prose about a variable spells that variable.
  const lit = w.slice(start, end).replace(/\/\/[^\n]*/g, "");

  // The values, not the keys: `foo: bar` — we care about `bar`.
  // BARE READS ONLY. The first draft matched every identifier in a value
  // expression and flagged 38 names on perfectly correct code — property
  // accesses (`pages.seedTopUp`), nested object KEYS, and `typeof`. That is the
  // false-alarm rate this repo rates strictly worse than the miss, so the scan
  // is narrowed to what it is actually for: a name read on its own, not
  // preceded by a dot and not itself a key.
  //
  // NARROW DELIBERATELY. A general free-variable analyser was tried here and
  // abandoned with measurements — 1,113 candidates, dominated by prose and
  // property names. What this catches is the shape that shipped: a local from
  // ANOTHER function named bare in this literal.
  const named = new Set();
  for (const m of lit.matchAll(/^\s*[A-Za-z_$][\w$]*:\s*([^,\n]+),?\s*$/gm)) {
    const value = String(m[1]);
    // Blank out property accesses and nested keys before looking for bare reads.
    const bare = value
      .replace(/\.\s*[A-Za-z_$][\w$]*/g, ".")          // `x.y` -> `x.`
      .replace(/[A-Za-z_$][\w$]*\s*:/g, ":")            // nested `k:` -> `:`
      .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');       // strings
    for (const id of bare.matchAll(/(?<![.\w$])([a-z_$][\w$]*)\b(?!\s*\()/g)) named.add(id[1]);
  }
  for (const kw of ["typeof", "await", "new", "in", "of", "instanceof", "void", "return", "if", "else"]) named.delete(kw);
  assert.ok(named.size > 5, "the identifier scan found only " + named.size + " — it has stopped scanning");

  // What the ENCLOSING FUNCTION binds before that point, plus the globals and
  // the module scope. A name it never binds is the bug.
  //
  // THE ENCLOSING FUNCTION IS `runSiteBuild` SINCE 2026-08-23, not
  // `handleRequest`. The build moved out of the request handler so a queue
  // consumer could call it — the connection only survives 30 seconds of
  // `waitUntil` and a build takes ten minutes — and this guard immediately
  // reported fifteen names as unbound on a change whose body was proved
  // byte-identical. It was right: the scope really did change, and pointing it
  // at the old function would have left it scanning a region the literal is no
  // longer in, which is the vacuous direction.
  const fnAt = w.indexOf("async function runSiteBuild(");
  assert.ok(fnAt > 0 && fnAt < start, "the build function moved or was renamed — rescope this");
  const body = w.slice(fnAt, start);
  // THE PARAMETERS ARE DERIVED, NOT RETYPED. A hand-written list is a second
  // copy of the signature, and the way it drifts is a renamed parameter reading
  // as an unbound name — a false alarm on correct code, which this repo rates
  // worse than the miss. Covers `(request, env, { rec, tr, budget })`.
  const sig = w.slice(fnAt, w.indexOf(") {", fnAt));
  const bound = new Set(["undefined", "null", "true", "false", "Math", "String", "Number", "Object", "Array", "JSON", "Date", "Boolean", "e", "r", "d"]);
  for (const p of sig.slice(sig.indexOf("(") + 1).matchAll(/[A-Za-z_$][\w$]*/g)) bound.add(p[0]);
  assert.ok(bound.has("env") && bound.has("request"), "the signature scan found no parameters — rescope this");
  // EVERY DECLARATOR, not just the first. `let designed = null, seedUsage =
  // null, seedTopUp = null;` binds three names, and reading only the first
  // flagged two of them as unbound — a false alarm on perfectly correct code,
  // which is the failure mode this repo rates strictly worse than the miss.
  for (const m of body.matchAll(/\b(?:const|let|var)\s+([^;\n]+)/g)) {
    for (const part of splitTopLevel(m[1])) {
      const n = part.trim().replace(/=[\s\S]*/, "").trim();
      if (/^[a-z_$][\w$]*$/.test(n)) bound.add(n);
    }
  }
  for (const m of body.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const n = part.split(":").pop().trim().replace(/=.*/, "").trim();
      if (/^[a-z_$][\w$]*$/.test(n)) bound.add(n);
    }
  }
  // Module scope: anything declared or imported at the top level.
  for (const m of w.matchAll(/^(?:export )?(?:async )?function ([A-Za-z_$][\w$]*)/gm)) bound.add(m[1]);
  for (const m of w.matchAll(/^(?:export )?(?:const|let|var) ([A-Za-z_$][\w$]*)/gm)) bound.add(m[1]);
  for (const m of w.matchAll(/^import \{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const n = part.split(" as ").pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) bound.add(n);
    }
  }
  const loose = [...named].filter((n) => !bound.has(n));
  assert.deepEqual(loose, [],
    "the build response names something handleRequest never binds — a ReferenceError on every build: " + loose.join(", "));
});
