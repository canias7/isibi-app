// A build step that fails must say why — even when it said nothing.
//
// WHY THIS EXISTS. `build smoke` reported, against the deployed Worker:
//
//   page=placeholder stage=build error=build failed problems=[]
//
// "build failed" is the least useful sentence this service can produce: it names
// the step we already knew and adds nothing. It was the `|| "build failed"`
// fallback firing because the step exited non-zero having written to NEITHER
// stream — and a step that writes nothing usually never got to, because it was
// killed rather than because it failed.
//
// `run()` was resolving `{code, out, err}` and DISCARDING the signal. A killed
// process closes with `code: null` plus the signal that killed it, and
// `null !== 0` reads as an ordinary non-zero exit, so a SIGKILL was reported as
// a build that failed for no stated reason.
//
// Same family as `detail: "{}"`, `upstream: null`, `no JSON` and the swallowed
// `catch {}`: the system knew something and threw it away.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { exitReason } from "../builder/exit-reason.mjs";

/** Run a real child and hand back what `run()` hands back. */
function realRun(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", args]);
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code, signal) => resolve({ code, signal, out, err }));
  });
}

test("a process killed with no output names the signal, not 'build failed'", async () => {
  // DRIVEN BY A REAL KILL, not a hand-written {code:null,signal:"SIGKILL"}.
  // The whole bug was a wrong belief about what node reports when a child dies,
  // so a fabricated object would have asserted the belief rather than tested it.
  const r = await realRun("process.kill(process.pid, 'SIGKILL')");
  assert.equal(r.code, null, "node reports a killed child as code null — the premise");
  assert.equal(r.signal, "SIGKILL");
  assert.equal(r.out + r.err, "", "and it gets no chance to say anything");

  const said = exitReason("vite build", r);
  assert.match(said, /SIGKILL/);
  assert.match(said, /vite build/, "which step died is half the answer");
  assert.match(said, /instance was stopped|resource limit/,
    "a killed step must name what could have killed it, or the reader has nowhere to start");
  // MEASURED, not assumed: the container is standard-1 (4 GiB) and vite peaks at
  // 618 MiB here, so memory is the weaker candidate. Asserting it as the cause
  // would send whoever reads this message chasing the wrong thing first.
  assert.ok(!/usually means the container ran out of memory/.test(said),
    "do not assert a cause the measurements argue against");
  assert.ok(!/^build failed$/.test(said));
});

test("a signal that is not SIGKILL is reported without guessing at memory", async () => {
  const r = await realRun("process.kill(process.pid, 'SIGTERM')");
  const said = exitReason("tsc", r);
  assert.match(said, /SIGTERM/);
  assert.ok(!/resource limit/.test(said),
    "SIGTERM is a polite request to stop, not a kill — offering causes for it would be inventing them");
});

test("a silent non-zero exit reports the code", async () => {
  const r = await realRun("process.exit(7)");
  assert.equal(r.out + r.err, "");
  const said = exitReason("vite build", r);
  assert.match(said, /code 7/);
  assert.match(said, /wrote nothing/);
});

test("real output always wins over the synthesised reason", async () => {
  const r = await realRun("console.error('Could not resolve @/nope'); process.exit(1)");
  const said = exitReason("vite build", r);
  assert.match(said, /Could not resolve @\/nope/);
  assert.ok(!/code 1/.test(said), "the tool's own diagnosis is the answer; do not decorate it");
});

test("which stream leads is stated, not swapped at the call site", async () => {
  // tsc reports on stdout and everything else on stderr. The first draft passed
  // `{...tsc, err: tsc.out, out: tsc.err}` — correct, and it reads as a bug.
  const r = await realRun("console.log('OUT'); console.error('ERR')");
  assert.match(exitReason("tsc", r, { stdoutFirst: true }), /^OUT/);
  assert.match(exitReason("vite build", r), /^ERR/);
});

test("every failure that reports a child process goes through it", () => {
  // DERIVED AT BOTH ENDS: the subprocess names come from `run()`'s own call
  // sites, and every failure whose message is built from one of them must use
  // exitReason. A step still assembling its own string is one that can go silent
  // again, which is the entire failure this replaces.
  //
  // Aimed at exactly those, and no wider. The first draft demanded it of EVERY
  // `ok:false` and flagged two that report no subprocess at all — "build
  // produced no index.html" and the catch-all, whose messages are already the
  // whole answer. A guard that fires on correct code gets loosened rather than
  // obeyed, and then it protects nothing.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  // `timed()` counts as a spawn: it is the wrapper that records how long each
  // sub-step took, and it exists because one `ms` for tsr + tsc + vite could not
  // tell a kit that is getting expensive from a site that is getting big.
  // Collapsing the three direct calls into it turned this scan up to ONE name and
  // the guard went red — correctly, since a derivation that stops finding its
  // subjects must fail rather than pass vacuously. Both spellings are accepted,
  // and the wrapper is held to actually spawning something.
  const names = [...src.matchAll(/const (\w+) = await (?:run|timed)\(/g)].map((m) => m[1]);
  assert.ok(names.length >= 3, `only ${names.length} subprocess call sites found — the scan stopped working`);
  // `timed` takes an optional `fn` now, for the prerender — which runs in this
  // process rather than as a subprocess. So it spawns CONDITIONALLY, and the
  // assertion has to say that rather than demanding an unconditional `run(`,
  // which is what went red. The property that matters is unchanged: the wrapper
  // must still be capable of spawning, or naming it as a call site is a lie.
  assert.match(src, /const timed = async \([^)]*\) => \{[\s\S]{0,320}?await run\(/,
    "timed() no longer spawns anything, so naming it as a subprocess call site is a lie");
  assert.match(src, /const timed = async \(key, cmd, args, fn\)/,
    "the in-process form is gone — if every step is a subprocess again, simplify this back");

  const stages = [...src.matchAll(/ok: false, stage: "(\w+)", error: (.+?), ms:/g)];
  assert.ok(stages.length >= 3, `only ${stages.length} failing stages found — the scan stopped working`);

  // Blank string literals before looking for an identifier, or `"vite build"`
  // reads as a use of the variable `build`. Blanked, not removed, so nothing
  // shifts. This repo has been bitten by scanning code with its strings intact.
  //
  // ── AND COMMENTS GO FIRST, BECAUSE PROSE CONTAINS APOSTROPHES ─────────────
  //
  // The string blanker treats `'` as a delimiter, so ONE unpaired apostrophe in
  // a comment — "the owner's call" — opens a string that runs to the next one
  // and blanks every line between them. Measured: adding a single such comment
  // to build-server.mjs blanked `const run = (...) => runStep(` two hundred
  // lines below it, and this guard went red reporting that run() had stopped
  // delegating. A false alarm on correct code, which this repo rates worse
  // than the miss.
  //
  // WHOLE-LINE COMMENTS ONLY, deliberately: blanking from any `//` eats the
  // rest of a line holding a URL, which is the rule site-locale.mjs's own
  // guard already lives under.
  //
  // AND A STRING MAY NOT CROSS A NEWLINE, which is what made the old form
  // destructive rather than merely wrong. `[^'\\]` matches `\n`, so an unpaired
  // quote opened a "string" that ran to the next one FILE-WIDE and blanked
  // every line between — and `" ".repeat(m.length)` turns those newlines into
  // spaces, so the blanked source came back with FEWER LINES than the original.
  // A quoted JS string cannot contain a raw newline anyway (a template literal
  // can, and uses a backtick, which is not matched here), so excluding it is
  // both correct and what bounds the damage to one line.
  const bare = (s) => s
    .replace(/^[ \t]*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length))
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => " ".repeat(m.length));
  const reportsAChild = ([, , expr]) => names.some((n) => new RegExp("\\b" + n + "\\b").test(bare(expr)));

  const relevant = stages.filter(reportsAChild);
  assert.ok(relevant.length >= 3,
    `only ${relevant.length} failures reference a subprocess — the identifier scan stopped working`);
  const handRolled = relevant.filter(([, , expr]) => !/exitReason\(/.test(expr));
  assert.deepEqual(handRolled.map(([, stage]) => stage), [],
    "these build their own error string, so they can still report a killed step as nothing");

  // THE SPAWN MUST CARRY THE SIGNAL, or exitReason can never see one — and it
  // is now one file over. `run()` in build-server.mjs is a thin wrapper that
  // delegates to `runStep`, which is where the child and its `close` handler
  // actually live; the extraction happened so this layer could be DRIVEN rather
  // than only read (build-server.mjs listens on a port at import time and
  // cannot be imported by a test, run-step.mjs can).
  //
  // So the assertion follows the property to wherever the spawn is, and holds
  // the delegation as well: re-inlining the spawn into the wrapper without the
  // signal is exactly the regression this line existed for, and reading only
  // the wrapper's file would miss it in both directions.
  const stepSrc = fs.readFileSync(new URL("../builder/run-step.mjs", import.meta.url), "utf8");
  assert.match(stepSrc, /child\.on\("close", \(code, signal\)/,
    "the spawn drops the signal again, so a SIGKILL reads as an ordinary non-zero exit");
  assert.match(bare(src), /const run = \([^)]*\) =>\s*runStep\(/,
    "run() no longer delegates to runStep — whatever spawns now has to be the thing carrying the signal");
});
