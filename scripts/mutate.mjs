#!/usr/bin/env node
// A mutation sweep runner, rebuilt to this repo's own recorded rules.
//
//   * REPLACE THROUGH A FUNCTION, never a replacement string: `$'` and `$&` in
//     a replacement are read by String.replace as "the text after/of the match"
//     — the trap that landed a mutant nobody wrote, past a checksum, on 1c.
//   * VERIFY THE LANDED TEXT IS THE WRITTEN TEXT, and that the file's checksum
//     moved. "A mutant that never applied" reads exactly like a killed one.
//   * REFUSE AN AMBIGUOUS ANCHOR (indexOf !== lastIndexOf): a mutant whose
//     anchor is a substring of another's silently mutates the wrong site.
//   * RESTORE ON EVERY EXIT PATH. A killed sweep leaves a live mutant in the
//     tree; the rule is in CLAUDE.md and has been broken anyway.
import fs from "node:fs";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const [, , specPath, ...testFiles] = process.argv;
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const files = [...new Set(spec.flatMap((m) => m.files))];
const original = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
const sum = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

let restored = false;
const restore = () => {
  if (restored) return;
  restored = true;
  for (const [f, text] of original) fs.writeFileSync(f, text);
};
// A SIGNAL RESTORES AND THEN **STOPS**, and until 2026-09-11 it did neither —
// which was MEASURED rather than reasoned about, because the obvious fix is
// inert. Installing a listener for SIGTERM/SIGINT/SIGHUP REPLACES Node's default,
// which is to die; and a handler is dispatched through the event loop, which a
// loop of `execFileSync` calls never returns to. So the listener swallowed the
// signal and the sweep ran to completion: `kill` did nothing at all, and a second
// `kill` did nothing either. Measured on a four-iteration loop — the handler
// never fired once and the process exited 0.
//
// SO THE LOOP AWAITS (see `runTests`), which is what gives the handler a turn
// between mutants. Adding `process.exit()` to a handler that never runs would
// have read like a fix and changed nothing — the recorded inert-mutant shape,
// in a fix rather than in a mutant. `exit` is the one that must NOT exit again.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { console.error("\nstopped by " + sig + " — the tree is back as it was."); restore(); process.exit(130); });
}
process.on("exit", restore);
process.on("uncaughtException", (e) => { restore(); console.error(e); process.exit(1); });

// A RUN THAT COULD NOT BE READ IS NOT A RED RUN, and until 2026-09-11 this told
// them apart by not asking. `execFileSync`'s default `maxBuffer` is 1 MB; the
// TAP output of the whole suite is several times that, so a GREEN tree threw
// ENOBUFS and the bare `catch` read it as "the mutant was killed". Every mutant
// would have "died", the baseline check would have refused a tree that was fine,
// and the summary would have been a clean sweep that tested nothing. The
// recorded "a failure that cannot name itself", in the instrument.
//
// NOTHING IS BUFFERED NOW, so that class cannot come back by being raised to a
// number somebody later finds too big: the output is DRAINED and counted, never
// collected. Nothing here reads the TAP text — the exit code is the whole answer
// — so keeping it was only ever a way to run out of memory.
const runTests = () => new Promise((resolve) => {
  // A CLEAN CHILD ENVIRONMENT. `node --test` stamps NODE_TEST_CONTEXT on what it
  // spawns; a nested `node --test` that sees it reports through the parent
  // protocol instead of exiting non-zero, so a real failure comes back GREEN.
  // That is how a sweep run from inside a test reported a survivor for a mutant
  // that dies by hand.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const p = spawn("node", ["--test", ...testFiles], { stdio: ["ignore", "pipe", "pipe"], env });
  let read = 0;
  p.stdout.on("data", (b) => { read += b.length; });
  p.stderr.on("data", (b) => { read += b.length; });
  const cannotTell = (why) => {
    console.error("THE RUNNER COULD NOT READ THE TEST RUN (" + why + ") — this is not a kill.");
    restore();
    process.exit(2);
  };
  p.on("error", (e) => cannotTell(e.code || e.message));
  p.on("close", (code, signal) => {
    // ONLY A REAL TEST FAILURE IS A KILL. A signal, a missing binary, or a run
    // that produced no output at all is this runner failing, and reporting that
    // as a kill is how a sweep proves nothing and says it proved everything.
    if (signal || typeof code !== "number") return cannotTell(signal || "no exit code");
    if (!read) return cannotTell("the test run printed nothing");
    resolve(code === 0);
  });
});

console.log("baseline…");
if (!await runTests()) { console.error("BASELINE IS NOT GREEN — a sweep from a red tree proves nothing."); restore(); process.exit(1); }
console.log("baseline green\n");

const killed = [], survived = [], unapplied = [];
for (const m of spec) {
  const file = m.files[0];
  const before = original.get(file);
  const first = before.indexOf(m.from);
  if (first < 0) { unapplied.push(`${m.label} — anchor not found`); continue; }
  if (first !== before.lastIndexOf(m.from)) { unapplied.push(`${m.label} — anchor is ambiguous`); continue; }

  // The function form: the replacement is taken literally, whatever it contains.
  const after = before.replace(m.from, () => m.to);
  if (after === before) { unapplied.push(`${m.label} — replacement changed nothing`); continue; }
  fs.writeFileSync(file, after);
  const landed = fs.readFileSync(file, "utf8");
  if (landed !== after || sum(landed) === sum(before)) { unapplied.push(`${m.label} — the landed text is not the written text`); fs.writeFileSync(file, before); continue; }
  if (m.to && !landed.includes(m.to)) { unapplied.push(`${m.label} — the written text is not in the file`); fs.writeFileSync(file, before); continue; }

  const green = await runTests();
  fs.writeFileSync(file, before);

  const isControl = !!m.control;
  if (green && isControl) { killed.push(`CONTROL SURVIVED (correct): ${m.label}`); console.log(`  ok  ${m.label}`); }
  else if (!green && isControl) { survived.push(`CONTROL WAS KILLED (wrong — the control must be behaviour-free): ${m.label}`); console.log(`  !!  ${m.label}`); }
  else if (green) { survived.push(m.label); console.log(`  SURVIVED  ${m.label}`); }
  else { killed.push(m.label); console.log(`  killed    ${m.label}`); }
}

restore();
const controls = spec.filter((m) => m.control).length;
console.log(`\n${spec.length - controls} mutants, ${killed.length - controls} killed, ${survived.length} survived, ${unapplied.length} never applied, ${controls} comment-only controls`);
if (survived.length) console.log("SURVIVORS:\n" + survived.map((s) => "  - " + s).join("\n"));
if (unapplied.length) console.log("NEVER APPLIED:\n" + unapplied.map((s) => "  - " + s).join("\n"));
process.exit(survived.length || unapplied.length ? 1 : 0);
