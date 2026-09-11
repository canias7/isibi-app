// THE THING THAT RUNS THE GUARDS IS NOT ITSELF GUARDED, until this file.
//
// `scripts/mutate.mjs` decides what every sweep in this repository means, and
// nothing anywhere asserted anything about it. That is the recorded shape this
// file already names for CI triggers — the instrument fails silently and in the
// safe-looking direction, because a sweep that proves nothing still prints a
// summary that looks exactly like a sweep that proved everything.
//
// Two of its properties have already gone wrong in practice and each cost a
// session:
//
//   1. `execFileSync`'s 1 MB `maxBuffer` made a GREEN tree throw ENOBUFS, which
//      the bare `catch` read as "the mutant was killed" (2026-09-11).
//   2. A SIGNAL RESTORED AND DID NOT EXIT (2026-09-11, found by killing a sweep
//      to make way for an urgent fix and watching it keep going). Installing a
//      listener for SIGTERM/SIGINT/SIGHUP REPLACES Node's default, which is to
//      exit — so `kill` put the tree back and the sweep carried on mutating it.
//      Two writers to the working tree, one of whom believes the other stopped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(here, "../scripts/mutate.mjs");
/**
 * The runner's source with WHOLE-LINE comments blanked, length preserved.
 *
 * PROSE CONTAINS THE THING IT FORBIDS, and it did here on the first run: the
 * runner explains at length why it is no longer on `execFileSync` and no longer
 * sets `maxBuffer`, so a scan forbidding those words found them in the very
 * paragraphs saying they are gone, and reported correct code as broken — the
 * failure this repository rates as worse than a miss.
 *
 * WHOLE-LINE ONLY, never a general `//` blanker: that would eat the `)` after a
 * URL in a string and swallow the rest of the file.
 */
const CODE = fs.readFileSync(RUNNER, "utf8").split("\n")
  .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

/**
 * A whole sweep in a temp directory: one file to mutate, one test that passes,
 * and a spec joining them. The runner resolves `m.files` and its test arguments
 * against the CWD, so giving it its own CWD is what keeps this off the real
 * tree — a guard on a tool that mutates files must not mutate the repository.
 */
function sandbox({ slow = 0 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-sweep-"));
  fs.writeFileSync(path.join(dir, "target.txt"), "ORIGINAL\n");
  // THE SANDBOX'S TEST REALLY READS THE TARGET, so the mutant is really killed.
  // A test that looked at nothing would make the runner report a survivor and
  // exit non-zero, and the control would then be asserting "the runner noticed
  // it could not tell" rather than "the runner can tell".
  fs.writeFileSync(path.join(dir, "ok.test.mjs"), [
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    'import fs from "node:fs";',
    'import path from "node:path";',
    // A DELAY, NOT AN ORDERING ASSERTION. It exists so the signal has a process
    // to land on; nothing here reads a clock or compares two timings, so the
    // recorded "timers drift under sweep load" failure has nothing to bite.
    'test("the target is untouched", async () => {',
    "  await new Promise((r) => setTimeout(r, " + slow + "));",
    '  assert.equal(fs.readFileSync(path.join(process.cwd(), "target.txt"), "utf8"), "ORIGINAL\\n");',
    "});",
  ].join("\n"));
  fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify([
    { label: "the only mutant", files: ["target.txt"], from: "ORIGINAL", to: "MUTATED" },
  ]));
  return dir;
}

const run = (dir, onLine) => new Promise((resolve) => {
  // A CLEAN ENVIRONMENT, and this is the whole reason the first draft of these
  // guards reported a survivor for a mutant that is plainly killed by hand.
  // `node --test` sets NODE_TEST_CONTEXT in everything it spawns; the sweep
  // runner's own `node --test` inherited it, decided it was already inside a
  // test runner, and reported through the parent protocol instead of exiting
  // non-zero — so a real failure came back as green. A nested runner must not be
  // told it is nested. `NODE_OPTIONS` goes for the same reason.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_OPTIONS;
  const p = spawn(process.execPath, [RUNNER, "spec.json", "ok.test.mjs"], { cwd: dir, env });
  let out = "";
  p.stdout.on("data", (b) => { out += b; if (onLine) onLine(String(b), p); });
  p.stderr.on("data", (b) => { out += b; });
  p.on("exit", (code, signal) => resolve({ code, signal, out }));
});

test("DRIVEN: a signal stops the sweep — it does not restore and carry on", async () => {
  const dir = sandbox({ slow: 2500 });
  try {
    // SENT ON THE PROCESS'S OWN WORD, never on a timer of ours: the runner says
    // "baseline green" when it is about to start mutating, so that is the moment
    // there is something to interrupt.
    let sent = false;
    const r = await run(dir, (chunk, p) => {
      if (!sent && chunk.includes("baseline green")) { sent = true; p.kill("SIGTERM"); }
    });
    assert.ok(sent, "the runner never reported a green baseline — re-derive this sandbox");
    // IT EXITED. Before the fix this assertion is what fails: the handler ran,
    // the file went back, and the process stayed alive mutating it.
    assert.notEqual(r.code, null, "the sweep ignored SIGTERM and kept running (exit code " + r.code + ")");
    assert.notEqual(r.code, 0, "a killed sweep reported success");
    // AND IT PUT THE FILE BACK, which is the half that was never broken and must
    // not break while fixing the half that was.
    assert.equal(fs.readFileSync(path.join(dir, "target.txt"), "utf8"), "ORIGINAL\n",
      "a killed sweep left its mutant in the tree");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("DRIVEN: an ordinary sweep kills what it can, and puts the file back", async () => {
  // THE CONTROL. Without it, a runner that exited immediately on startup would
  // satisfy every assertion above — "it stopped and the file is unchanged" is
  // also true of a runner that never ran. This one requires it to have gone all
  // the way through: a green baseline, a mutant applied, a real test failure read
  // as the kill, the summary, and the file back as it was.
  const dir = sandbox();
  try {
    const r = await run(dir);
    assert.equal(r.code, 0, "a clean sweep did not finish:\n" + r.out);
    assert.match(r.out, /baseline green/, "the runner never checked the baseline");
    assert.match(r.out, /1 mutants, 1 killed/, "the runner could not tell a real test failure from a survivor:\n" + r.out);
    assert.equal(fs.readFileSync(path.join(dir, "target.txt"), "utf8"), "ORIGINAL\n",
      "the sweep did not put the file back");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the loop AWAITS, which is the only reason a signal can ever be heard", () => {
  // MEASURED, and the measurement is what makes this assertion worth having: a
  // four-iteration loop of `execFileSync` with a SIGTERM handler installed
  // swallowed the signal ENTIRELY — the handler never fired and the process
  // exited 0. A handler is dispatched through the event loop, and a synchronous
  // loop never returns to it. So "restore, then exit" written inside that handler
  // is a fix that reads perfectly and does nothing.
  const src = CODE;
  assert.ok(!/execFileSync/.test(src),
    "the test run is synchronous again — a signal cannot be heard, so the sweep cannot be stopped");
  assert.match(src, /const green = await runTests\(\)/, "the loop no longer awaits, so the handler gets no turn");
});

test("only a real test failure counts as a kill, and nothing is buffered", () => {
  const src = CODE;
  // THE FIRST VERSION OF THIS COST A SESSION: `execFileSync`'s default
  // `maxBuffer` is 1 MB and the TAP output of this suite is several times that,
  // so a green tree threw ENOBUFS and the bare `catch` read it as a kill. Raising
  // the buffer fixed that run and left the class; DRAINING the output removes it,
  // because nothing here reads the TAP text — the exit code is the whole answer.
  assert.ok(!/maxBuffer/.test(src), "the output is collected again, so a big enough run can still blow the buffer");
  assert.match(src, /read \+= b\.length/, "the child's output is not drained — a full pipe deadlocks the run");
  // CANNOT-TELL IS ITS OWN ANSWER, never a kill.
  assert.match(src, /cannotTell/, "the runner cannot tell a test failure from its own failure");
  for (const shape of [/signal \|\| typeof code !== "number"/, /if \(!read\)/]) {
    assert.match(src, shape, "a run that did not really report is being counted as an answer");
  }
  // AND IT VERIFIES THE LANDED TEXT, because `String.prototype.replace` reads
  // `$'` and `$&` in a replacement string as the text around the match — the
  // trap that landed a mutant nobody wrote, past a checksum.
  assert.match(src, /replace\([^)]*,\s*\(\)\s*=>/, "the replacement is a string again, so `$'` in a mutant is re-interpreted");
});
