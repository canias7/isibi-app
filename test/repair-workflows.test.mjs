// A REPAIR STEP MUST NOT REPORT `tee`'s STATUS.
//
// Both repair workflows end their command in `| tee <log>`, so the log survives
// a failure and can be uploaded `if: always()`. That is worth keeping. What it
// costs, unless the shell is said out loud, is the step's own exit status:
// GitHub's UNSPECIFIED Linux shell is `bash -e {0}` — `set -e` with NO
// `pipefail` — and a pipeline's status is its LAST command's. `tee` succeeds
// whatever Node did. So a refused identity, a failed backfill, or a `--verify`
// whose three counts disagree all produce a GREEN step.
//
// That is the worst direction available here. Every one of those scripts was
// given an explicit verify mode precisely so a failed postcondition exits
// nonzero, and a workflow that swallows it puts the old defect back one layer
// up — a verification that PRINTS its failure and REPORTS success.
//
// ── WHY THIS DRIVES THE COMMAND INSTEAD OF GREPPING FOR `shell: bash` ────────
//
// A grep for the spelling is a claim about the file. The property is about what
// BASH DOES with the command, and the two come apart: `shell: sh` would match a
// loose grep and reintroduce the bug; a future command that ends in something
// other than `tee` would keep the spelling and no longer need it.
//
// So the shell is DERIVED FROM THE WORKFLOW and the real `run:` text is
// EXECUTED under it, with `node` replaced by a stub whose exit code the case
// chooses. Delete `shell: bash` and this file goes red for the real reason: the
// failing stub's step exits 0. That is the observable half — see this
// repository's recorded "a test-side mutant is usually inert by construction;
// give the property an observable half and mutate THAT".
//
// The DEFAULT-shell case is the control. Without it, "the failing stub exits
// nonzero" could be true for some reason that has nothing to do with pipefail,
// and the guard would be asserting a coincidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
// THE REAL PARSER, because the question is what the script MAKES of the argv
// the step builds, and a second model of it here would be two copies of one
// thing — the class that let the shell and the confirm gate disagree.
import { parseArgs, writesReference, writesMeta } from "../scripts/backend-repair.mjs";

const DIR = ".github/workflows";

// GitHub's own mapping, from the runner's documented defaults. `""` is a step
// that names no shell; the DIFFERENCE between the two rows is `pipefail`, which
// is the entire subject of this file.
const SHELL_ARGV = {
  "": ["-e"],
  bash: ["--noprofile", "--norc", "-eo", "pipefail"],
};

// A shell whose argv carries pipefail. Asked of the ARGV rather than of the
// name, so a shell added to the table above is judged by what it DOES — which
// is what makes `shell: sh` fail here rather than pass a name check.
//
// DELIBERATE REDUNDANCY, DECLARED because a sweep cannot say so and the next
// session deletes what nothing appears to need: this predicate is a SECOND wall
// behind `SHELL_ARGV` itself. With the workflows correct, replacing its body
// with `true` changes no result — the cases still EXECUTE under the argv the
// table gives, and that is what decides the exit status. Its own value shows
// only when a workflow names a shell this file has no row for, or names one
// whose row lacks pipefail. So the observable mutants for this property are on
// `SHELL_ARGV` and on the workflow files, not on this line.
const keepsPipeFailure = (shell) =>
  Object.prototype.hasOwnProperty.call(SHELL_ARGV, shell) &&
  SHELL_ARGV[shell].join(" ").includes("pipefail");

/**
 * One named step's `shell:` and its `run:` block, read out of the file.
 *
 * Line-based, the way every other workflow reader here is, because this
 * repository has no YAML dependency. The block scalar ends where the
 * indentation returns to the `run:` key's own level — not at a fixed line
 * count, which would be this file's recorded "never size a source-read window".
 */
function stepOf(file, name) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const lines = src.split("\n");
  const head = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.ok(head >= 0, `${file}: no step named ${JSON.stringify(name)}`);
  const dash = lines[head].indexOf("- ");

  let shell = "";
  let runAt = -1;
  for (let i = head + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    // The next list item at this level ends the step.
    if (l.indexOf("- ") === dash && /^\s*- /.test(l)) break;
    const sh = l.match(/^\s*shell:\s*(\S+)\s*$/);
    if (sh) shell = sh[1];
    if (/^\s*run:\s*\|\s*$/.test(l)) { runAt = i; break; }
  }
  assert.ok(runAt >= 0, `${file}: step ${name} has no block-scalar run:`);

  const runIndent = lines[runAt].search(/\S/);
  const body = [];
  for (let i = runAt + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) { body.push(""); continue; }
    if (l.search(/\S/) <= runIndent) break;
    body.push(l.slice(runIndent + 2));
  }
  const run = body.join("\n").trimEnd();
  assert.ok(run, `${file}: step ${name} has an empty run:`);

  // A run block carrying a GitHub expression is not the text bash receives, so
  // executing it here would be testing a different command. Both of ours take
  // their inputs through `env:`, and this keeps it that way.
  assert.ok(!run.includes("${{"), `${file}: ${name} run: interpolates — the executed text is not what bash gets`);
  return { shell, run };
}

/**
 * Run a step's real command with `node` replaced by a stub exiting `code`.
 *
 * `shell` decides the argv, so the caller can ask what the workflow declares OR
 * what GitHub would use with nothing declared.
 */
function runStep({ run, shell, code, log, env }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repair-step-"));
  try {
    const shim = path.join(dir, "node");
    // THE STUB RECORDS ITS OWN ARGV, so a case can ask what the workflow really
    // handed the script. That is the only way to see a forwarded input: a form
    // field that is taken and never passed on is this repository's own wiring
    // defect, and from outside "the owner left it blank" and "we dropped it"
    // are the same missing flag.
    fs.writeFileSync(
      shim,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${path.join(dir, "argv.txt")}"\n` +
        `echo "backend repair: five sites"\necho "identity not proven for repairbench-1" >&2\nexit ${code}\n`,
    );
    fs.chmodSync(shim, 0o755);
    const script = path.join(dir, "step.sh");
    fs.writeFileSync(script, run + "\n");

    const argv = SHELL_ARGV[shell];
    assert.ok(argv, `no argv recorded for shell ${JSON.stringify(shell)}`);
    const r = spawnSync("bash", [...argv, script], {
      cwd: dir,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, MODE: "verify", SLUG: "", ...(env || {}) },
      encoding: "utf8",
    });
    const logPath = path.join(dir, log);
    const argvPath = path.join(dir, "argv.txt");
    return {
      status: r.status,
      logged: fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : null,
      argv: fs.existsSync(argvPath) ? fs.readFileSync(argvPath, "utf8").split("\n").filter(Boolean) : null,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const STEPS = [
  { file: "backend-repair.yml", name: "backend repair", log: "backend-repair.log" },
  { file: "repairbench-count-fix.yml", name: "repairbench count fix", log: "repairbench-count-fix.log" },
];

for (const s of STEPS) {
  test(`${s.file}: a failing repair fails the step, and the log survives`, () => {
    const { shell, run } = stepOf(s.file, s.name);
    assert.ok(keepsPipeFailure(shell), `${s.file}: step ${s.name} declares shell ${JSON.stringify(shell)}, which does not preserve a pipeline failure`);

    const bad = runStep({ run, shell, code: 1, log: s.log });
    assert.notEqual(bad.status, 0, `${s.file}: node exited 1 and the step exited ${bad.status}`);

    // The log is the half that must NOT be traded away for the exit code.
    assert.ok(bad.logged, `${s.file}: the log is missing on a failure — the artifact upload would have nothing`);
    assert.match(bad.logged, /identity not proven/, `${s.file}: the log lost the failure's own words`);
  });

  test(`${s.file}: a successful repair still passes, with its log`, () => {
    const { shell, run } = stepOf(s.file, s.name);
    const ok = runStep({ run, shell, code: 0, log: s.log });
    assert.equal(ok.status, 0, `${s.file}: node exited 0 and the step exited ${ok.status}`);
    assert.ok(ok.logged, `${s.file}: the log is missing on a success`);
  });

  test(`${s.file}: the CONTROL — the same command under GitHub's default shell exits 0`, () => {
    // This is the defect, reproduced. It is what makes the first case an
    // assertion about pipefail rather than about anything else in the command,
    // and it is why `shell:` cannot be dropped as tidying-up.
    const { run } = stepOf(s.file, s.name);
    const bad = runStep({ run, shell: "", code: 1, log: s.log });
    assert.equal(bad.status, 0, `${s.file}: expected the unspecified shell to swallow the failure`);
    assert.ok(bad.logged, `${s.file}: the log is written either way`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EVERY FORM FIELD REALLY REACHES THE SCRIPT (2026-09-16)
//
// The read-only aggregate takes a table and a column off the dispatch form, and
// a field that is TAKEN and never PASSED ON is this repository's most repeated
// defect: the form looks right, the script looks right, and from outside "the
// owner left it blank" and "the step dropped it" are the same missing flag —
// which here would mean an aggregate over a table nobody asked about, or a
// `counts` run silently answering as a `preview`.
//
// Driven, not grepped: the step's real `run:` text is executed under the shell
// it declares, with `node` replaced by a stub that records its argv.
// ─────────────────────────────────────────────────────────────────────────────
test("backend-repair.yml: the mode, slug, table and column all reach the script", () => {
  const { shell, run } = stepOf("backend-repair.yml", "backend repair");
  const r = runStep({
    run, shell, code: 0, log: "backend-repair.log",
    env: { MODE: "counts", SLUG: "repairbench-1", TABLE: "bookings", COLUMN: "drop_off_day" },
  });
  assert.ok(r.argv, "the stub was never reached — the step did not run node at all");
  assert.deepEqual(r.argv, [
    "scripts/backend-repair.mjs", "--counts",
    "--slug", "repairbench-1", "--table", "bookings", "--column", "drop_off_day",
  ], "the step handed the script: " + JSON.stringify(r.argv));

  // THE CONTROL, and it is the reason the case above is about forwarding rather
  // than about the flags happening to be there: with the two fields blank, the
  // script is handed NEITHER — so an unconditional `--table ''` would be caught
  // here, and a dropped forwarding would be caught above.
  const bare = runStep({
    run, shell, code: 0, log: "backend-repair.log",
    env: { MODE: "preview", SLUG: "", TABLE: "", COLUMN: "" },
  });
  assert.deepEqual(bare.argv, ["scripts/backend-repair.mjs", "--preview"],
    "a blank form still handed the script: " + JSON.stringify(bare.argv));
});

// ─────────────────────────────────────────────────────────────────────────────
// A FORM VALUE CANNOT CHANGE THE MODE (2026-09-16, owner)
//
// THE DEFECT, REPRODUCED BEFORE IT WAS FIXED. The step built one string and
// expanded it UNQUOTED. With `mode: counts`, `column: "drop_off_day --apply"`
// and `confirm` empty, the shell word-split that value and the script was
// handed `--counts … --column drop_off_day --apply`; the old parser let the
// LAST mode flag win, so the run was a full **apply** — and the confirm gate,
// which asks `startsWith(inputs.mode, 'apply')` and had seen `counts`, demanded
// no word. **A value became a mode, and the approval gate was asked about a
// different run from the one that executed.**
//
// THE PROPERTY, and it is the one that makes the gate mean anything: for every
// value a person can type into the form, either the parser selects EXACTLY the
// mode the gate was asked about, or it refuses outright. There is no third
// answer, and "it refused" is a safe one — nothing is read or written.
//
// DRIVEN SHELL → ARGV → PARSER, because that is where the two came apart. The
// step's own `run:` text executes under the shell it declares, a stub records
// the argv, and the REAL `parseArgs` reads it. Neither half alone sees this:
// the shell test cannot say what the script makes of the words, and a parser
// test cannot say what the shell hands it.
// ─────────────────────────────────────────────────────────────────────────────
test("backend-repair.yml: a slug, table or column can never change the mode or add an option", () => {
  const { shell, run } = stepOf("backend-repair.yml", "backend repair");

  // Every shape a word-split leaves behind, plus the mode names themselves as
  // bare values. Each is tried in ALL THREE value fields, because the three are
  // separate `if` blocks and a fix applied to one is not a fix.
  const NASTY = [
    "drop_off_day --apply",          // the owner's own reproduction
    "--apply",                       // the whole value is a flag
    "x --apply-reference",           // the narrower writing mode
    "x --verify --slug other-site",  // a second slug as well as a second mode
    "; node -e 1",                   // a command separator
    "$(echo --apply)",               // a substitution
    "`echo --apply`",                // the older substitution spelling
    "--table bookings",              // a value naming another option
  ];
  // ── AND A SEPARATE LIST THAT MUST ARRIVE WHOLE, which is what makes the
  // ── quoting a wall rather than a coincidence.
  //
  // A SWEEP FOUND THIS GAP. Allowing "or it was refused" everywhere is the
  // right SAFETY property and a useless REGRESSION one: with the quotes gone
  // the parser catches every split, so three mutants that reverted the array
  // SURVIVED a census that only ever asked for safety. A value with a space is
  // a thing a person can legitimately type, and only the array delivers it —
  // unquoted, `a b c` splits and the parser refuses `b`. So these must parse,
  // and parse to the value the form was given.
  const PLAIN = ["a b c", "two words", "trailing space "];

  let asserted = 0;
  for (const mode of ["preview", "counts", "verify", "apply", "apply-reference"]) {
    for (const field of ["SLUG", "TABLE", "COLUMN"]) {
      for (const nasty of NASTY) {
        const env = { MODE: mode, SLUG: "repairbench-1", TABLE: "bookings", COLUMN: "drop_off_day" };
        env[field] = nasty;
        const r = runStep({ run, shell, code: 0, log: "backend-repair.log", env });
        assert.ok(r.argv, `the step never reached node for ${field}=${JSON.stringify(nasty)}`);

        const got = parseArgs(r.argv.slice(1));
        const where = `${mode} / ${field}=${JSON.stringify(nasty)} -> ${JSON.stringify(r.argv)}`;
        if (got.error) { asserted++; continue; }     // refused is a safe answer

        // THE MODE IS THE FORM'S, EXACTLY. This is the assertion the defect
        // broke, and the one the confirm gate's correctness rests on.
        assert.equal(got.mode, mode, `a ${field} value selected a different mode — ${where}`);
        // …AND THE WRITE BOUNDARY FOLLOWS FROM IT: a read-only mode that came
        // out of the form still writes nothing, whatever was typed.
        if (!mode.startsWith("apply")) {
          assert.equal(writesReference(got.mode), false, `a ${field} value opened the reference write — ${where}`);
          assert.equal(writesMeta(got.mode), false, `a ${field} value opened the _meta write — ${where}`);
        }
        // NO OPTION WAS ADDED: the two fields the caller did not touch keep the
        // values the form gave them.
        for (const [k, e] of [["slug", "SLUG"], ["table", "TABLE"], ["column", "COLUMN"]]) {
          if (e !== field) assert.equal(got[k], env[e], `a ${field} value changed ${k} — ${where}`);
        }
        asserted++;
      }
    }
  }
  // A PLAIN MULTI-WORD VALUE SURVIVES AS ONE VALUE — the array's own property,
  // and the one a refusal cannot satisfy.
  let whole = 0;
  for (const field of ["SLUG", "TABLE", "COLUMN"]) {
    for (const plain of PLAIN) {
      const env = { MODE: "counts", SLUG: "repairbench-1", TABLE: "bookings", COLUMN: "drop_off_day" };
      env[field] = plain;
      const r = runStep({ run, shell, code: 0, log: "backend-repair.log", env });
      const got = parseArgs(r.argv.slice(1));
      const where = `${field}=${JSON.stringify(plain)} -> ${JSON.stringify(r.argv)}`;
      assert.equal(got.error, "", `a plain value was split and refused — ${where}`);
      assert.equal(got.mode, "counts", `a plain value changed the mode — ${where}`);
      assert.equal(got[field.toLowerCase()], plain, `a plain value did not arrive whole — ${where}`);
      whole++;
    }
  }

  // THE OBSERVER, PROVED ALIVE. A loop that ran zero times passes every
  // assertion in it.
  assert.equal(asserted, 5 * 3 * NASTY.length, "the census did not run every combination");
  assert.equal(whole, 3 * PLAIN.length, "the whole-value census did not run every combination");

  // ── AND THE ORDINARY PRESSES STILL WORK, which is what stops the walls above
  // ── from being satisfied by a step that refuses everything.
  const counts = runStep({
    run, shell, code: 0, log: "backend-repair.log",
    env: { MODE: "counts", SLUG: "repairbench-1", TABLE: "bookings", COLUMN: "drop_off_day" },
  });
  assert.deepEqual(parseArgs(counts.argv.slice(1)),
    { mode: "counts", slug: "repairbench-1", table: "bookings", column: "drop_off_day", error: "" },
    "an ordinary counts press no longer parses: " + JSON.stringify(counts.argv));

  const apply = runStep({
    run, shell, code: 0, log: "backend-repair.log",
    env: { MODE: "apply", SLUG: "repairbench-1", TABLE: "", COLUMN: "" },
  });
  assert.deepEqual(parseArgs(apply.argv.slice(1)),
    { mode: "apply", slug: "repairbench-1", table: "", column: "", error: "" },
    "an explicitly confirmed apply no longer parses: " + JSON.stringify(apply.argv));
  assert.equal(writesMeta("apply"), true, "the confirmed apply stopped being a write");

  // AND THE GATE COVERS EXACTLY THE MODES THAT WRITE — read out of the file
  // rather than recalled, because the whole defect was the gate and the parser
  // answering about different things.
  const wf = fs.readFileSync(path.join(DIR, "backend-repair.yml"), "utf8");
  assert.match(wf, /if: \$\{\{ startsWith\(github\.event\.inputs\.mode, 'apply'\) \}\}/);
  assert.match(wf, /"\$\{args\[@\]\}"/, "the arguments are no longer passed as a quoted array");
  assert.doesNotMatch(wf, /node scripts\/backend-repair\.mjs .*\$S\b/, "the unquoted string expansion is back");
});

// A CENSUS, not a list of two. A third repair workflow, or a second piped step
// in one of these, is covered by existing rather than by being remembered.
test("every workflow step that pipes into tee preserves the pipeline's failure", () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  assert.ok(files.length > 20, `only ${files.length} workflows found — the scan is not reading the directory`);

  let piped = 0;
  const loose = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(DIR, file), "utf8").split("\n");
    // Walk each step: remember the shell seen since the last `- ` item, and
    // judge any `| tee` that appears before the next one.
    let shell = "";
    let inRun = false;
    let runIndent = -1;
    for (const l of lines) {
      if (/^\s*- /.test(l)) { shell = ""; inRun = false; }
      const sh = l.match(/^\s*shell:\s*(\S+)\s*$/);
      if (sh) shell = sh[1];
      if (/^\s*run:\s*\|\s*$/.test(l)) { inRun = true; runIndent = l.search(/\S/); continue; }
      if (inRun && l.trim() && l.search(/\S/) <= runIndent) inRun = false;

      const isRunText = inRun || /^\s*(?:- )?run:\s*\S/.test(l);
      if (!isRunText) continue;
      if (!/\|\s*tee\b/.test(l)) continue;
      piped++;
      if (!keepsPipeFailure(shell)) loose.push(`${file}: ${l.trim().slice(0, 70)} (shell: ${shell || "unspecified"})`);
    }
  }

  // A negative assertion has to prove its observer is alive: without a floor on
  // what was SCANNED, a scan that matched nothing passes.
  assert.ok(piped >= 2, `the scan found ${piped} piped commands — it is not matching`);
  assert.deepEqual(loose, [], `these steps pipe into tee under a shell that reports tee's status:\n  ${loose.join("\n  ")}`);
});
