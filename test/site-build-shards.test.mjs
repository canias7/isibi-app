// THE SITE-BUILD HARNESS IN SHARDS, AND THE GATE THAT ANSWERS FOR THEM (2026-10-01).
//
// `test/integration/site-build.mjs` was 18 of the 24½ minutes `site build` took
// (run 36832053168): one real build after another, through one service. It now
// runs as four shards at once, each on its own runner, and a gate job answers
// for the run. Each half of that can go wrong without anything turning red:
//
//   - a section that reads a name another section declares works when the file
//     runs whole and fails, or quietly reads `undefined`, when they are apart;
//   - a section in no shard, a shard the workflow never starts, or a run whose
//     report never arrives is coverage that did not happen, and looks like none
//     was missing;
//   - a gate that counted the reports it was given, rather than the plan it
//     should have been given, would pass a run that skipped a shard.
//
// This file holds each of those without starting a build. The harness itself
// proves the sections still pass apart; this proves nothing can go missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  planOf, triggerGlobs, covers, fingerprint, fingerprintAt, treeOf, verdict, readReports, HARNESS, WORKFLOW,
} from "../scripts/site-build-gate.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(import.meta.url)("typescript");
const SRC = fs.readFileSync(path.join(ROOT, HARNESS), "utf8");
const WF = fs.readFileSync(path.join(ROOT, WORKFLOW), "utf8");
const GATE = path.join(ROOT, "scripts", "site-build-gate.mjs");

// ── READING THE HARNESS: ITS SHAPE, BY THE PARSER ──────────────────────────────

const isSection = (s) => ts.isIfStatement(s) && ts.isCallExpression(s.expression) &&
  ts.isIdentifier(s.expression.expression) && s.expression.expression.text === "SECTION";

/** The harness's try block split into preamble, sections and tail, by the parser. */
function shapeOf(src) {
  const sf = ts.createSourceFile("/virtual/harness.mjs", src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const tries = sf.statements.filter(ts.isTryStatement);
  assert.equal(tries.length, 1, "the harness should have exactly one top-level try");
  const body = tries[0].tryBlock.statements;
  const first = body.findIndex(isSection);
  assert.ok(first > 0, "no SECTION(...) blocks, or no preamble before them");
  let last = body.length - 1;
  while (last >= 0 && !isSection(body[last])) last--;
  const sections = body.slice(first, last + 1).map((s) => {
    assert.ok(isSection(s), "a statement between two sections belongs to none of them: " + s.getText(sf).slice(0, 120));
    const args = s.expression.arguments;
    assert.ok(ts.isStringLiteral(args[0]), "a section's name must be a string literal");
    assert.ok(ts.isNumericLiteral(args[1]), `section ${args[0].text}: its shard must be a number literal`);
    let needs = [];
    if (args[2]) {
      assert.ok(ts.isObjectLiteralExpression(args[2]) && args[2].properties.length === 1 &&
        args[2].properties[0].name.getText(sf) === "needs" && ts.isArrayLiteralExpression(args[2].properties[0].initializer),
        `section ${args[0].text}: the third argument may only be { needs: [...] }`);
      needs = args[2].properties[0].initializer.elements.map((e) => {
        assert.ok(ts.isStringLiteral(e), `section ${args[0].text}: needs must be string literals`);
        return e.text;
      });
    }
    assert.equal(args.length <= 3, true, `section ${args[0].text}: too many arguments`);
    assert.ok(ts.isBlock(s.thenStatement) && !s.elseStatement, `section ${args[0].text} must be a plain block with no else`);
    return { name: args[0].text, shard: Number(args[1].text), needs, node: s.thenStatement, text: s.thenStatement.getText(sf) };
  });
  return { sf, preamble: body.slice(0, first), sections, tail: body.slice(last + 1) };
}

/**
 * Every way one section could depend on another through the program itself,
 * resolved by TypeScript's own binder rather than by matching names:
 *   - a name resolved to a declaration inside ANOTHER section (a hoisted `var`);
 *   - a name that resolves nowhere while another section declares it (a block-
 *     scoped binding read from outside its block: a throw in shard mode);
 *   - an assignment to a binding declared outside every section;
 *   - a property write, a mutating call or a `delete` on an object bound outside
 *     every section.
 * Globals (`fetch`, `JSON`) resolve nowhere and are declared nowhere, so they
 * pass without a list of them to keep.
 */
function crossings(src) {
  const FILE = "/virtual/harness.mjs";
  const host = ts.createCompilerHost({});
  const real = { getSourceFile: host.getSourceFile, fileExists: host.fileExists, readFile: host.readFile };
  host.getSourceFile = (f, v) => (f === FILE ? ts.createSourceFile(f, src, v, true, ts.ScriptKind.JS) : real.getSourceFile.call(host, f, v));
  host.fileExists = (f) => f === FILE || real.fileExists.call(host, f);
  host.readFile = (f) => (f === FILE ? src : real.readFile.call(host, f));
  const prog = ts.createProgram([FILE], {
    allowJs: true, checkJs: false, noLib: true, noResolve: true, types: [],
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  }, host);
  const sf = prog.getSourceFile(FILE);
  const checker = prog.getTypeChecker();
  const tryStmt = sf.statements.find(ts.isTryStatement);
  const secs = tryStmt.tryBlock.statements.filter(isSection)
    .map((s) => ({ name: s.expression.arguments[0].text, node: s.thenStatement }));
  const secOf = (pos) => secs.find((s) => pos >= s.node.getStart(sf) && pos < s.node.getEnd());
  const declsOf = (id) => {
    let sym = checker.getSymbolAtLocation(id);
    if (sym && ts.isShorthandPropertyAssignment(id.parent)) sym = checker.getShorthandAssignmentValueSymbol(id.parent);
    return ((sym && sym.declarations) || []).filter((d) => d.getSourceFile() === sf);
  };
  const outer = (id) => declsOf(id).some((d) => !secOf(d.getStart(sf)));
  const root = (e) => { while (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) e = e.expression; return ts.isIdentifier(e) ? e : null; };
  const isAssign = (n) => ts.isBinaryExpression(n) &&
    n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
  const MUTATORS = new Set(["push", "pop", "shift", "unshift", "splice", "set", "delete", "clear", "add", "sort", "reverse", "fill", "copyWithin"]);

  // Every name each section declares, at any depth.
  const declaredIn = new Map(secs.map((s) => [s, new Set()]));
  for (const s of secs) {
    const visit = (n) => {
      if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name && ts.isIdentifier(n.name)) declaredIn.get(s).add(n.name.text);
      if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) declaredIn.get(s).add(n.name.text);
      ts.forEachChild(n, visit);
    };
    visit(s.node);
  }

  const out = [];
  let refs = 0;
  for (const s of secs) {
    const visit = (n) => {
      if (ts.isIdentifier(n)) {
        const p = n.parent;
        const isName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) ||
          (ts.isMethodDeclaration(p) && p.name === n) || (ts.isPropertyDeclaration(p) && p.name === n) ||
          (ts.isLabeledStatement(p) && p.label === n) || ((ts.isBreakStatement(p) || ts.isContinueStatement(p)) && p.label === n) ||
          (ts.isBindingElement(p) && p.propertyName === n);
        if (!isName) {
          refs++;
          const decls = declsOf(n);
          for (const d of decls) {
            const ds = secOf(d.getStart(sf));
            if (ds && ds !== s) out.push(`${s.name} reads ${n.text}, declared in ${ds.name}`);
          }
          if (!decls.length && !checker.getSymbolAtLocation(n)) {
            for (const [o, names] of declaredIn) if (o !== s && names.has(n.text)) out.push(`${s.name} reads ${n.text}, which only ${o.name} declares`);
          }
        }
      }
      if (isAssign(n) && ts.isIdentifier(n.left) && outer(n.left)) out.push(`${s.name} assigns ${n.left.text}, which every section shares`);
      if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
        (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken) &&
        ts.isIdentifier(n.operand) && outer(n.operand)) out.push(`${s.name} assigns ${n.operand.text}, which every section shares`);
      if (isAssign(n) && (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left))) {
        const r = root(n.left);
        if (r && outer(r)) out.push(`${s.name} writes into ${r.text}, which every section shares`);
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && MUTATORS.has(n.expression.name.text)) {
        const r = root(n.expression.expression);
        if (r && outer(r)) out.push(`${s.name} calls ${n.expression.name.text}() on ${r.text}, which every section shares`);
      }
      if (ts.isDeleteExpression(n)) {
        const r = root(n.expression);
        if (r && outer(r)) out.push(`${s.name} deletes from ${r.text}, which every section shares`);
      }
      ts.forEachChild(n, visit);
    };
    visit(s.node);
  }
  return { out, refs, sections: secs.length };
}

/** A small source in the harness's own shape, for driving the readers. */
const shaped = (preamble, a, b) => [
  "let passed = 0;",
  "const outerList = [];",
  "let shared = 0;",
  "try {",
  preamble,
  '  if (SECTION("a", 1)) {',
  a,
  "  }",
  '  if (SECTION("b", 2)) {',
  b,
  "  }",
  "  closeSection();",
  "  completed = true;",
  "} catch (e) {}",
].join("\n");

// ── THE READERS, DRIVEN BOTH WAYS FIRST ────────────────────────────────────────

test("the cross-section reader is alive: it flags each kind of coupling, and passes what is clean", () => {
  // THE OBSERVER, PROVED ALIVE before it is believed. A reader that resolved
  // nothing would report the real harness clean; so each kind of coupling is
  // planted in a source of the harness's own shape and must be named.
  const clean = shaped("  const base = 1;", "  const x = base + 1; fetch(String(x));", "  const x = base + 2; JSON.stringify({ x });");
  assert.deepEqual(crossings(clean).out, [], "two sections with their own same-named locals, reading the preamble, are independent");
  const cases = [
    ["a const read from another section", shaped("", "  const fromA = 1;", "  console.log(fromA);"), /b reads fromA, which only a declares/],
    ["a hoisted var read from another section", shaped("", "  var hoisted = 1;", "  console.log(hoisted);"), /b reads hoisted, declared in a/],
    ["an outer binding assigned", shaped("", "  shared = 2;", "  console.log(shared);"), /a assigns shared, which every section shares/],
    ["an outer binding incremented", shaped("", "  shared++;", ""), /a assigns shared/],
    ["an outer object written into", shaped("", "  outerList[0] = 1;", ""), /a writes into outerList/],
    ["an outer array mutated", shaped("", "  outerList.push(1);", ""), /a calls push\(\) on outerList/],
    ["a key deleted from an outer object", shaped("", "  delete outerList.length;", ""), /a deletes from outerList/],
  ];
  for (const [what, src, want] of cases) {
    const found = crossings(src).out;
    assert.ok(found.some((f) => want.test(f)), `${what} went unnoticed: ${JSON.stringify(found)}`);
  }
});

test("the shape reader is alive: a statement between two sections, and a non-literal shard, are refused", () => {
  const fine = shaped("  const base = 1;", "  ok(1);", "  ok(2);");
  assert.deepEqual(shapeOf(fine).sections.map((x) => [x.name, x.shard]), [["a", 1], ["b", 2]], "the reader does not read a well-formed source");
  assert.throws(() => shapeOf(fine.replace('  if (SECTION("b", 2)) {', '  stray();\n  if (SECTION("b", 2)) {')),
    /belongs to none of them/);
  assert.throws(() => shapeOf(shaped("  const base = 1;", "  ok(1);", "  ok(2);").replace('SECTION("b", 2)', 'SECTION("b", n)')), /number literal/);
  assert.throws(() => shapeOf(shaped("  const base = 1;", "  ok(1);", "  ok(2);").replace('SECTION("b", 2)', 'SECTION("b", 2, { after: ["a"] })')), /may only be/);
});

// ── THE REAL HARNESS ────────────────────────────────────────────────────────────

const SHAPE = shapeOf(SRC);
const SHARDS = Number((SRC.match(/^const SHARDS = (\d+);$/m) || [])[1]);

test("every check after the preamble sits in exactly one section, and the file ends the way the gate reads it", () => {
  assert.ok(Number.isInteger(SHARDS) && SHARDS >= 2, "the harness declares no `const SHARDS = n;` of two or more");
  assert.ok(SHAPE.sections.length >= 20, `only ${SHAPE.sections.length} sections — the reader has stopped seeing them`);
  const pre = SHAPE.preamble.map((s) => s.getText(SHAPE.sf)).join("\n");
  assert.match(pre, /spawn\("node", \[path\.join\(ROOT, "builder", "build-server\.mjs"\)\]/, "the preamble no longer starts the service");
  assert.match(pre, /ok\("the build service answers \/health", up\)/, "the preamble no longer checks /health");
  assert.ok(!/\bok\(/.test(pre.replace(/ok\("the build service answers \/health", up\)/, "")),
    "a check other than /health sits in the preamble, so it runs in every shard and is counted four times");
  assert.deepEqual(SHAPE.tail.map((s) => s.getText(SHAPE.sf)), ["closeSection();", "completed = true;"],
    "after the last section the try block must close it and mark the run complete, and do nothing else");
});

test("each section has a unique name, a shard that exists, and at least one check; every shard has work", () => {
  const names = SHAPE.sections.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, "two sections share a name: " + names.join(", "));
  for (const s of SHAPE.sections) {
    assert.match(s.name, /^[a-z0-9-]+$/, `section name ${JSON.stringify(s.name)} is not kebab-case — the gate's reader would not see it`);
    assert.ok(Number.isInteger(s.shard) && s.shard >= 1 && s.shard <= SHARDS, `section ${s.name} is in shard ${s.shard}, not 1 to ${SHARDS}`);
    assert.match(s.text, /\bok\(/, `section ${s.name} checks nothing`);
  }
  for (let n = 1; n <= SHARDS; n++) {
    assert.ok(SHAPE.sections.some((s) => s.shard === n), `shard ${n} has no sections — its runner would prove nothing`);
  }
});

test("a section that relies on an earlier build's leftovers names it, and shares its shard", () => {
  const seen = [];
  for (const s of SHAPE.sections) {
    for (const n of s.needs) {
      const dep = seen.find((x) => x.name === n);
      assert.ok(dep, `section ${s.name} needs ${n}, which is not above it`);
      assert.equal(dep.shard, s.shard, `section ${s.name} needs ${n}, which runs in shard ${dep.shard}, not ${s.shard}`);
    }
    seen.push(s);
  }
  // THE THREE FOUND BY READING THE FILE, pinned by what they assert, so the
  // `needs` cannot be dropped while the checks that motivate it stay.
  const by = (name) => SHAPE.sections.find((s) => s.name === name);
  const reset = SHAPE.sections.find((s) => /the previous build's extra route is gone/.test(s.text));
  assert.ok(reset && reset.needs.length, "the routes-reset check has lost the builds it relies on");
  const leak = SHAPE.sections.find((s) => /a build that sends no logo carries none/.test(s.text));
  const logoBuild = SHAPE.sections.find((s) => /logo: "\/u\//.test(s.text) && SHAPE.sections.indexOf(s) < SHAPE.sections.indexOf(leak));
  assert.ok(leak && logoBuild && leak.needs.includes(logoBuild.name),
    "the no-logo-leak check does not need the earlier build that HAD a logo, so in a fresh shard it would pass over nothing");
  const lang = SHAPE.sections.find((s) => /a build that names no language keeps the one the template had/.test(s.text));
  const langBuild = SHAPE.sections.find((s) => /lang: "pt-BR"/.test(s.text));
  assert.ok(lang && langBuild && lang.needs.includes(langBuild.name),
    "the language check does not need the earlier build that set one");
  assert.ok(by(reset.needs[0]), "routes-reset needs a section that does not exist");
});

test("no section reads, writes or mutates anything another section owns (resolved by TypeScript's binder)", () => {
  const { out, refs, sections } = crossings(SRC);
  assert.equal(sections, SHAPE.sections.length);
  assert.ok(refs > 2000, `only ${refs} names resolved — the reader has stopped looking inside the sections`);
  assert.deepEqual(out, [], "sections that are not independent:\n  " + out.join("\n  "));
});

test("the stopping check, which ends the service, is the last section of the file and so the last of its shard", () => {
  const stop = SHAPE.sections.findIndex((s) => /server\.kill\("SIGTERM"\)/.test(s.text));
  assert.ok(stop !== -1, "no section sends SIGTERM — the stopping check is gone");
  assert.equal(stop, SHAPE.sections.length - 1, "a section runs after the one that stops the service");
});

test("the gate reads the same plan from the text as the parser does", () => {
  // The gate cannot load TypeScript on a bare runner, so it reads the SECTION
  // lines with a regex; this is what makes that regex trustworthy.
  const plan = planOf(SRC);
  assert.equal(plan.shards, SHARDS);
  assert.deepEqual(plan.sections, SHAPE.sections.map(({ name, shard, needs }) => ({ name, shard, needs })));
});

test("the report the harness writes carries exactly the fields the gate reads", () => {
  const sf = SHAPE.sf;
  const fn = (name) => sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name && s.name.text === name);
  const keysOf = (node, varName) => {
    let found = null;
    const visit = (n) => {
      if (ts.isVariableDeclaration(n) && n.name.getText(sf) === varName && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
        found = n.initializer.properties.map((p) => p.name.getText(sf));
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };
  assert.deepEqual(keysOf(fn("writeReport"), "report"), [
    "v", "harness", "harnessSha256", "sha", "mode", "shard", "shards", "port", "completed", "abortedIn", "passed", "failed", "preamble", "sections"]);
  assert.deepEqual(keysOf(fn("SECTION"), "s"), ["name", "shard", "needs", "ran", "checks", "failed", "ms"]);
  assert.match(SRC, /^const preamble = \{ checks: \[\], failed: 0 \};$/m);
});

// ── THE WORKFLOW ────────────────────────────────────────────────────────────────

/** Job ids and their raw text, from the `jobs:` block. */
function jobsIn(src) {
  const body = src.slice(src.indexOf("\njobs:\n") + 7);
  const out = new Map();
  let cur = null;
  for (const line of body.split("\n")) {
    const m = line.match(/^ {2}([A-Za-z_][\w-]*):\s*$/);
    if (m) { cur = m[1]; out.set(cur, ""); continue; }
    if (cur) out.set(cur, out.get(cur) + line + "\n");
  }
  return out;
}
const JOBS = jobsIn(WF);

test("the workflow starts every shard the harness declares, and each one runs as itself and reports", () => {
  const shards = JOBS.get("shards");
  assert.ok(shards, "no `shards` job");
  const m = shards.match(/^ {8}shard: \[([\d, ]+)\]\s*$/m);
  assert.ok(m, "the shards job has no `shard: [...]` matrix");
  assert.deepEqual(m[1].split(",").map((s) => Number(s.trim())), Array.from({ length: SHARDS }, (_, i) => i + 1),
    "the matrix does not start exactly the shards the harness declares");
  assert.match(shards, /fail-fast: false/, "one failing shard would cancel the others");
  assert.match(shards, /^ {6}- run: node test\/integration\/site-build\.mjs\n(?: {8}.*\n)*? {10}SITE_BUILD_SHARD: \$\{\{ matrix\.shard \}\}\n {10}SITE_BUILD_REPORT: site-build-report-\$\{\{ matrix\.shard \}\}\.json\n/m,
    "the harness step does not run as its matrix shard and write its report");
  assert.match(shards, /name: site-build-report-\$\{\{ matrix\.shard \}\}\n {10}path: site-build-report-\$\{\{ matrix\.shard \}\}\.json\n {10}if-no-files-found: error/,
    "the report is not uploaded under the name the gate downloads, or a missing one is not an error");
  assert.match(shards, /- uses: actions\/upload-artifact@v4\n {8}if: always\(\)/, "a failing shard's report would not be uploaded");
  assert.equal(/SITE_BUILD_SECTIONS/.test(WF), false, "CI must never run a hand-picked set of sections");
});

test("the gate waits on every other job, runs unless cancelled, and judges by the plan", () => {
  const gate = JOBS.get("gate");
  assert.ok(gate, "no gate job");
  const needs = (gate.match(/^ {4}needs: \[([^\]]*)\]\s*$/m) || [])[1];
  assert.ok(needs, "the gate needs nothing");
  assert.deepEqual(needs.split(",").map((s) => s.trim()).sort(), [...JOBS.keys()].filter((j) => j !== "gate").sort(),
    "a job the gate does not wait on can fail, or never run, under a green gate");
  assert.match(gate, /^ {4}if: \$\{\{ !cancelled\(\) \}\}\s*$/m,
    "without !cancelled() the gate is SKIPPED when a job fails, and names nothing; with always() it runs on a cancelled run");
  assert.match(gate, /^ {4}name: all checks\s*$/m);
  assert.match(gate, /pattern: site-build-report-\*\n {10}path: site-build-reports\n {10}merge-multiple: true/);
  assert.match(gate, /- run: node scripts\/site-build-gate\.mjs gate site-build-reports\n {8}env:\n {10}NEEDS: \$\{\{ toJSON\(needs\) \}\}/,
    "the gate script is not given the jobs' results");
});

test("superseded runs are cancelled on the two free check workflows, and nowhere else", () => {
  const dir = path.join(ROOT, ".github", "workflows");
  const cancelling = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
    .filter((f) => /cancel-in-progress:\s*true/.test(fs.readFileSync(path.join(dir, f), "utf8"))).sort();
  // A deploy, a paid smoke or a canary cancelled halfway leaves work half done;
  // only the two free, read-only check workflows may drop a run for a newer one.
  assert.deepEqual(cancelling, ["site-build.yml", "unit.yml"]);
  for (const f of cancelling) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    assert.match(src, /^concurrency:\n {2}group: [\w-]+-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: true$/m,
      `${f}: the group must be per branch, or one branch's push cancels another's run`);
  }
});

test("dependency caching is kept in every job that installs", () => {
  for (const [job, text] of JOBS) {
    if (!/npm ci/.test(text)) continue;
    assert.match(text, /cache: npm\n {10}cache-dependency-path: builder\/lovable\/template\/package-lock\.json/, `${job} installs without the npm cache`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, ".github/workflows/unit.yml"), "utf8"), /cache: npm/);
});

test("the trigger names every file the workflow's scripts import, so the inputs fingerprint is complete", () => {
  // THE GAP THIS CLOSED: the shared site server (`test/integration/lib/`) and
  // the theme fixtures were imported by these jobs and named by no trigger, so
  // a change to them alone ran nothing here — and a fingerprint over the
  // trigger would have called a run evidence for inputs it never read.
  const globs = triggerGlobs(WF);
  const scripts = new Set();
  for (const m of WF.matchAll(/node\s+(?:--test\s+)?((?:"[^"]+"\s*)+|\S+\.mjs)/g)) {
    for (const s of m[1].matchAll(/"?((?:test|scripts|builder)\/[\w./-]+\.mjs)"?/g)) scripts.add(s[1]);
  }
  assert.ok(scripts.size >= 13, `only ${scripts.size} scripts found in the workflow — the reader is not seeing its steps`);
  const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g;
  const seen = new Set();
  const queue = [...scripts];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} is run or imported and does not exist`);
    for (const m of fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(SPEC)) {
      const to = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
      if (/\.(m?js|json)$/.test(to) && !to.startsWith("..")) queue.push(to);
    }
  }
  assert.ok(seen.size > 50, `only ${seen.size} files in the import graph — the walk has stopped`);
  const missed = [...seen].filter((f) => !globs.some((g) => covers(g, f))).sort();
  assert.deepEqual(missed, [], "these feed the site-build checks and a change to them runs nothing:\n  " + missed.join("\n  "));
  // The data two fixtures read with fs rather than import.
  for (const dir of ["test/fixtures/generated/", "test/fixtures/corpus/"]) {
    assert.ok(globs.some((g) => covers(g, dir + "x")), `${dir} is read by a fixture these jobs use and is not in the trigger`);
  }
});

// ── THE FINGERPRINT ─────────────────────────────────────────────────────────────

test("the glob reader knows the trigger's three shapes and refuses any other", () => {
  assert.equal(covers("builder/**", "builder/a/b.mjs"), true);
  assert.equal(covers("builder/**", "builderx/a.mjs"), false);
  assert.equal(covers("*.mjs", "site-ask.mjs"), true);
  assert.equal(covers("*.mjs", "test/x.mjs"), false, "a root glob reaches into a directory");
  assert.equal(covers("worker.js", "worker.js"), true);
  assert.equal(covers("worker.js", "public/worker.js"), false);
  assert.throws(() => covers("builder/*.mjs", "builder/a.mjs"), /does not understand the glob/);
  assert.deepEqual(triggerGlobs(WF).slice(0, 2), ["builder/**", "worker.js"]);
});

test("the fingerprint moves with an input and with nothing else", () => {
  const globs = ["builder/**", "worker.js"];
  const base = [{ path: "worker.js", blob: "a1" }, { path: "builder/x.mjs", blob: "b1" }, { path: "docs/n.md", blob: "c1" }];
  const f = fingerprint(base, globs);
  assert.equal(f.files, 2);
  assert.match(f.hash, /^[0-9a-f]{16}$/);
  assert.equal(fingerprint([...base].reverse(), globs).hash, f.hash, "the order git lists files in changed the hash");
  assert.equal(fingerprint(base.map((e) => (e.path === "docs/n.md" ? { ...e, blob: "c2" } : e)), globs).hash, f.hash,
    "a docs change moved the fingerprint, so docs-only commits would need a new run");
  assert.notEqual(fingerprint(base.map((e) => (e.path === "worker.js" ? { ...e, blob: "a2" } : e)), globs).hash, f.hash,
    "a change to worker.js did not move the fingerprint, so stale evidence would match it");
  assert.notEqual(fingerprint([...base, { path: "builder/new.mjs", blob: "d1" }], globs).hash, f.hash, "an added input did not move it");
});

test("the fingerprint reads git's own tree, with the trigger as it stood at that commit", () => {
  const head = fingerprintAt("HEAD");
  assert.match(head.hash, /^[0-9a-f]{16}$/);
  assert.ok(head.files > 1000, `only ${head.files} files — the tree reader has stopped`);
  const wf = execFileSync("git", ["show", "HEAD:" + WORKFLOW], { cwd: ROOT, encoding: "utf8" });
  assert.deepEqual(head, fingerprint(treeOf("HEAD"), triggerGlobs(wf)));
});

// ── THE GATE'S VERDICT ──────────────────────────────────────────────────────────

const PLAN = planOf(SRC);
const HSHA = crypto.createHash("sha256").update(SRC).digest("hex");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const NEEDS_OK = Object.fromEntries([...JOBS.keys()].filter((j) => j !== "gate").map((j) => [j, { result: "success" }]));

/** The reports a clean run writes, in the shape `writeReport` gives them. */
function cleanReports() {
  return Array.from({ length: PLAN.shards }, (_, i) => {
    const shard = i + 1;
    const sections = PLAN.sections.map((s) => ({
      name: s.name, shard: s.shard, needs: s.needs, ran: s.shard === shard,
      checks: s.shard === shard ? [`${s.name} one`, `${s.name} two`] : [], failed: 0, ms: s.shard === shard ? 1500 : 0,
    }));
    const passed = 1 + sections.reduce((a, s) => a + s.checks.length, 0);
    return { file: `site-build-report-${shard}.json`, report: {
      v: 1, harness: HARNESS, harnessSha256: HSHA, sha: SHA, mode: "shard", shard, shards: PLAN.shards, port: 8123,
      completed: true, abortedIn: null, passed, failed: 0, preamble: { checks: ["the build service answers /health"], failed: 0 }, sections,
    } };
  });
}
const judge = (over = {}) => verdict({ needs: NEEDS_OK, reports: cleanReports(), plan: PLAN, sha: SHA, harnessSha256: HSHA, ...over });
const edit = (shard, fn) => cleanReports().map((r) => (r.report.shard === shard ? (fn(r.report), r) : r));

test("a clean run passes, counting every section once and the shared preamble once", () => {
  const v = judge();
  assert.deepEqual(v.problems, []);
  assert.equal(v.ok, true);
  assert.equal(v.total, PLAN.sections.length * 2 + 1);
  assert.equal(v.rows.length, PLAN.sections.length);
});

test("the gate refuses every way coverage can go missing, and says which", () => {
  const firstOf = (shard) => PLAN.sections.find((s) => s.shard === shard).name;
  const cases = [
    ["a job skipped", { needs: { ...NEEDS_OK, theme: { result: "skipped" } } }, /job theme finished skipped/],
    ["a job cancelled", { needs: { ...NEEDS_OK, shards: { result: "cancelled" } } }, /job shards finished cancelled/],
    ["a job failed", { needs: { ...NEEDS_OK, kit: { result: "failure" } } }, /job kit finished failure/],
    ["no jobs at all", { needs: {} }, /given no jobs/],
    ["a shard's report missing", { reports: cleanReports().filter((r) => r.report.shard !== 2) }, /shard 2: no report/],
    ["no reports at all", { reports: [] }, /shard 1: no report/],
    ["a report from another commit", { reports: edit(3, (r) => { r.sha = "f".repeat(40); }) }, /shard 3 ran on "f{40}"/],
    ["a report from another harness", { reports: edit(1, (r) => { r.harnessSha256 = "0".repeat(64); }) }, /shard 1 ran a different harness/],
    ["a whole-file run passed off as a shard", { reports: edit(4, (r) => { r.mode = "all"; }) }, /only shard runs are evidence/],
    ["a hand-picked run passed off as a shard", { reports: edit(4, (r) => { r.mode = "sections"; }) }, /only shard runs are evidence/],
    ["a shard that stopped partway", { reports: edit(2, (r) => { r.completed = false; r.abortedIn = firstOf(2); }) }, /did not reach the end .*stopped in/],
    ["a failed check", { reports: edit(3, (r) => { r.failed = 1; }) }, /shard 3 has 1 failed check/],
    ["a failed check inside a section", { reports: edit(3, (r) => { r.sections.find((s) => s.ran).failed = 1; }) }, /failed check\(s\)/],
    ["a shard reported twice", { reports: [...cleanReports(), cleanReports()[0]] }, /shard 1 reported twice/],
    ["a section that ran nowhere", { reports: edit(1, (r) => { r.sections.find((s) => s.ran).ran = false; }) }, /ran 0 times, not once/],
    ["a section run twice", { reports: edit(1, (r) => { r.sections.find((s) => s.shard === 2).ran = true; }) }, /ran 2 times, not once/],
    ["a section run in the wrong shard", { reports: cleanReports().map((r) => {
      const s = r.report.sections.find((x) => x.name === firstOf(1));
      s.ran = r.report.shard === 2;
      if (s.ran) s.checks = ["moved"];
      return r;
    }) }, /ran in shard 2; the harness puts it in 1/],
    ["a section that checked nothing", { reports: edit(4, (r) => { r.sections.find((s) => s.ran).checks = []; }) }, /ran no checks/],
    ["a shard that saw fewer sections", { reports: edit(2, (r) => { r.sections.pop(); }) }, /saw sections/],
    ["a report of a different shard count", { reports: edit(2, (r) => { r.shards = PLAN.shards + 1; }) }, /harness of \d+ shards/],
    ["an unreadable report", { reports: [...cleanReports(), { file: "junk.json", report: null }] }, /junk\.json is not a report/],
    ["a preamble that failed", { reports: edit(1, (r) => { r.preamble.failed = 1; }) }, /preamble did not pass/],
  ];
  for (const [what, over, want] of cases) {
    const v = judge(over);
    assert.equal(v.ok, false, `${what}: the gate passed it`);
    assert.ok(v.problems.some((p) => want.test(p)), `${what}: not named — ${JSON.stringify(v.problems)}`);
  }
});

test("the gate, as CI runs it: green on a clean set of reports, red when a shard's is missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"));
  try {
    for (const r of cleanReports()) fs.writeFileSync(path.join(dir, r.file), JSON.stringify(r.report));
    const env = { ...process.env, NEEDS: JSON.stringify(NEEDS_OK), GITHUB_SHA: SHA, GITHUB_STEP_SUMMARY: "" };
    const run = () => {
      try { return { code: 0, out: execFileSync("node", [GATE, "gate", dir], { cwd: ROOT, env, encoding: "utf8" }) }; }
      catch (e) { return { code: e.status, out: String(e.stdout) }; }
    };
    const green = run();
    assert.equal(green.code, 0, green.out);
    assert.match(green.out, /ALL CHECKS: \d+ checks in \d+ sections across \d+ shards, every job green/);
    assert.match(green.out, /site build inputs [0-9a-f]{16} \(\d+ files\)/);
    fs.rmSync(path.join(dir, "site-build-report-3.json"));
    const red = run();
    assert.equal(red.code, 1, red.out);
    assert.match(red.out, /NOT PASSED:[\s\S]*shard 3: no report/);
    assert.equal(readReports(path.join(dir, "absent")).length, 0, "a missing directory is no reports, not a crash");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
