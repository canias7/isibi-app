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
import { execFileSync } from "node:child_process";
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
for (const sig of ["exit", "SIGINT", "SIGTERM", "SIGHUP", "uncaughtException"]) {
  process.on(sig, (e) => { restore(); if (sig === "uncaughtException") { console.error(e); process.exit(1); } });
}

const runTests = () => {
  try {
    execFileSync("node", ["--test", ...testFiles], { stdio: "pipe", encoding: "utf8" });
    return true;   // green: nothing caught the mutant
  } catch { return false; }   // red: killed
};

console.log("baseline…");
if (!runTests()) { console.error("BASELINE IS NOT GREEN — a sweep from a red tree proves nothing."); restore(); process.exit(1); }
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

  const green = runTests();
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
