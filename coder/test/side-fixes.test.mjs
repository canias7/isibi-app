// THE THREE FOUND IN THE SIDE-CASE LIVE TEST OF 2026-11-13 (the owner: "yea fix all 3, merge and deploy then test it on low pls").
//   1. PowerShell dropped table output: Coder's script ended with `exit`; Claude Code 2.1.323's ends with `$host.SetShouldExit`.
//   2. Rewind's box in a read-only chat said the undo went "on the branch, never deleted from GitHub".
//   3. A job from GitHub with auto mode off was refused "by the Coder auto mode classifier", though no checker ran.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync, existsSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("CD566 PowerShell's script is Claude Code's (2.1.323): its line before the command (not before one that must lead), the command, the exit code and folder saved, then SetShouldExit (exit only in restricted language mode)", async () => {
  const PS = await import("../container/coder-ps.mjs");
  // Claude Code's own line, word for word (its Sir in 2.1.323).
  assert.equal(PS.PS_PREAMBLE, "try { $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8' } catch {}; if ($ExecutionContext.SessionState.LanguageMode -eq 'FullLanguage') { try { $OutputEncoding = [System.Text.UTF8Encoding]::new() } catch {}; if ($null -ne $PSStyle) { try { $PSStyle.OutputRendering = 'PlainText' } catch {} } }; ");
  const lines = PS.psScript("Get-ChildItem").split("\n");
  assert.deepEqual(lines, [
    PS.PS_PREAMBLE + "Get-ChildItem",
    "$__coderOk = $?",
    "$__coderCode = if (-not $__coderOk) { if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 } } else { 0 }",
    "if ($env:CODER_PS_CWD) { try { (Get-Location).ProviderPath | Set-Content -NoNewline -LiteralPath $env:CODER_PS_CWD } catch {} }",
    "if ($ExecutionContext.SessionState.LanguageMode -eq 'FullLanguage') { $host.SetShouldExit($__coderCode) } else { exit $__coderCode }",
  ]);
  // What must open a script gets nothing before it (Claude Code's Hve): using, param(, an attribute, a named block; after
  // blank space, `;` and comments. A type's static call, `[Math]::…`, is no attribute.
  for (const c of ["param($x) $x", "using namespace System.IO\n[IO.Path]::GetTempPath()", "  ;# a note\n<# block #>\nparam()", "[CmdletBinding()] param()", "begin { 1 } end { 2 }", "process{ $_ }", "dynamicparam { }", "clean { }"]) {
    assert.equal(PS.psMustLead(c), true, c);
    assert.equal(PS.psScript(c).split("\n")[0], c.split("\n")[0], c);
  }
  for (const c of ["Get-ChildItem", "[Math]::Round(2.5)", "Write-Output 'param('", "# param(\nGet-Date", "beginning", "$using = 1"]) assert.equal(PS.psMustLead(c), false, c);
  // The command that runs it (the owner's `!` and the tool alike) carries this script.
  const cmd = PS.psCommand("Get-ChildItem");
  const sent = /-Command '((?:[^']|'\\'')*)'/.exec(cmd)[1].replace(/'\\''/g, "'");
  assert.equal(sent, PS.psScript("Get-ChildItem"));
  assert.doesNotMatch(sent, /^exit \$__coderCode$/m);
});

test("CD567 Rewind's box in a read-only chat says the undo stays on Coder's machine, not on GitHub", () => {
  const ui = read("public/coder.js");
  assert.match(ui, /const kept = S\.project\.readOnly \? 'kept on Coder\\'s machine \(you can\\'t push to this repository, so nothing goes to GitHub\)' : 'on the branch, never deleted from GitHub';/);
  assert.match(ui, /It is undone with a new commit ' \+ kept \+ '\. '/);
  assert.match(ui, /Code changes are undone with new commits ' \+ kept \+ '\. '/);
  assert.doesNotMatch(ui, /It is undone with a new commit on the branch, never deleted from GitHub/);
});

test("CD568 a job from GitHub with auto mode off: Grok is told Claude Code's words for a session that can't ask (no checker's), the chat says why plainly", async () => {
  const C = await import("../container/coder-checker.mjs");
  const A = await import("../container/coder-agent.mjs");
  // Claude Code 2.1.323's DHn and wgo, with "owner" for "user".
  assert.equal(C.noPromptDenied("Bash"), "Permission to use Bash has been denied. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the owner's request, STOP and explain to the owner what you were trying to do and why you need this permission. Let the owner decide how to proceed.");
  assert.equal(A.AUTO_OFF_GITHUB, "Not run: auto mode is off in your settings, and no one can approve a command that changes things in a job started from GitHub.");
  // Live, from a GitHub job (no card can be answered there), a command that changes things, and one PowerShell call.
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const steps = [say("", [call("bash", { command: "git status --short" }, "b1"), call("bash", { command: "touch x.txt" }, "b2")]), say("done")];
  let n = 0;
  const events = [], seen = [], ran = [];
  await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { ran.push(x.command); return { code: 0, output: "" }; },
    emit: (e) => events.push(e), here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
  }, { text: "go", mode: "auto", github: true, autoOff: true, checker: true, checkWhere: { key: "k1", repo: "ana/shop", branch: "coder/shop-1" } });
  assert.deepEqual(ran.filter((c) => !/coder-tools\.mjs/.test(c)), ["git status --short"], "the read-only one ran, unchecked");
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  assert.equal(told("b2"), C.noPromptDenied("Bash"));
  assert.deepEqual(events.filter((e) => e.type === "result" && e.id === "b2").map((e) => [e.output, e.denied, e.ran]), [[A.AUTO_OFF_GITHUB, true, false]]);
});

// FOUND IN THE LIVE TEST OF THE FIXES ABOVE (deploy 173, Low effort): the tables were still empty, and an error came back as
// CLIXML. The cause: Coder's machine says TERM=linux, which gives pwsh no width (-1); and Coder sent the script with
// -EncodedCommand, which Claude Code uses only inside its sandbox (it starts pwsh with `-Command`).
test("CD569 pwsh starts as Claude Code starts it (-Command and the script, exactly), with Claude Code's NO_COLOR and PYTHONIOENCODING for the tool, a width for its tables when TERM is linux or not set, and none of it left in Coder's shell; a PowerShell hook the same (no NO_COLOR, as Claude Code)", async () => {
  const PS = await import("../container/coder-ps.mjs");
  const H = await import("../container/coder-hooks.mjs");
  assert.equal(PS.pwshRun("Get-Date"), "pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command 'Get-Date'");
  assert.equal(PS.pwshRun("Get-Date", { bypass: false }), "pwsh -NoProfile -NonInteractive -Command 'Get-Date'");
  assert.equal(PS.psShellWord("it's"), "'it'\\''s'");
  assert.doesNotMatch(PS.psCommand("Get-Date"), /EncodedCommand/);
  assert.doesNotMatch(H.hookShell({ type: "command", shell: "powershell", command: "Get-Date" }, "M", "/w"), /EncodedCommand/);
  // A stand-in pwsh on the PATH writes down what it was given; real shells run Coder's command.
  const dir = mkdtempSync(join(tmpdir(), "cd569-"));
  try {
    const bin = join(dir, "bin"), out = join(dir, "out"), moved = realpathSync(mkdtempSync(join(tmpdir(), "cd569-moved-")));
    mkdirSync(bin);
    writeFileSync(join(bin, "pwsh"), "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\000' \"$a\"; done > \"$FAKE_OUT.args\"\nprintf 'TERM=%s\\nNO_COLOR=%s\\nPYTHONIOENCODING=%s\\n' \"${TERM-unset}\" \"${NO_COLOR-unset}\" \"${PYTHONIOENCODING-unset}\" > \"$FAKE_OUT.env\"\nif [ -n \"${CODER_PS_CWD:-}\" ] && [ -n \"${FAKE_CWD:-}\" ]; then printf '%s' \"$FAKE_CWD\" > \"$CODER_PS_CWD\"; fi\nexit \"${FAKE_EXIT:-0}\"\n");
    chmodSync(join(bin, "pwsh"), 0o755);
    const tricky = "Write-Output 'it''s'; \"$env:HOME `t $(Get-Date)\"\n# a note with \\ and ! and \"quotes\"\nparam? no: [Math]::Round(2.5) | % { $_ }\n'@ here @'";
    const run = (shell, line, env) => {
      const r = spawnSync(shell, ["-c", line], { env: { PATH: bin + ":" + process.env.PATH, HOME: dir, FAKE_OUT: out, ...env }, encoding: "utf8", cwd: dir });
      const args = existsSync(out + ".args") ? readFileSync(out + ".args", "utf8").split("\0").slice(0, -1) : [];
      const seen = existsSync(out + ".env") ? Object.fromEntries(readFileSync(out + ".env", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {};
      rmSync(out + ".args", { force: true }); rmSync(out + ".env", { force: true });
      return { stdout: r.stdout, stderr: r.stderr, args, seen };
    };
    const after = "; echo \"code=$? pwd=$(pwd) TERM=${TERM-unset} NO_COLOR=${NO_COLOR-unset} PYTHONIOENCODING=${PYTHONIOENCODING-unset}\"";
    const shells = ["bash", ...(spawnSync("zsh", ["-c", "true"]).status === 0 ? ["zsh"] : [])];
    for (const shell of shells) {
      // TERM=linux (Coder's machine, and Claude Code's cloud machine): xterm-256color for pwsh alone; NO_COLOR and
      // PYTHONIOENCODING set for it; its exit code and folder come back; the shell's own variables are as they were.
      let r = run(shell, PS.psCommand(tricky) + after, { TERM: "linux", FAKE_EXIT: "3", FAKE_CWD: moved });
      assert.deepEqual(r.args, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS.psScript(tricky)], shell);
      assert.deepEqual(r.seen, { TERM: "xterm-256color", NO_COLOR: "1", PYTHONIOENCODING: "utf-8:surrogateescape" }, shell);
      assert.equal(r.stdout.trim(), "code=3 pwd=" + moved + " TERM=linux NO_COLOR=unset PYTHONIOENCODING=unset", shell + " " + r.stderr);
      // No TERM at all (bash then calls it dumb, unexported): the same width.
      r = run(shell, PS.psCommand("Get-ChildItem", { bypass: false }) + after, {});
      assert.deepEqual(r.args, ["-NoProfile", "-NonInteractive", "-Command", PS.psScript("Get-ChildItem")], shell);
      assert.equal(r.seen.TERM, "xterm-256color", shell);
      assert.match(r.stdout, /^code=0 pwd=/, shell);
      // The owner's own: their TERM kept; their NO_COLOR and PYTHONIOENCODING kept; FORCE_COLOR set, so no NO_COLOR.
      r = run(shell, PS.psCommand("Get-ChildItem") + after, { TERM: "screen", NO_COLOR: "", PYTHONIOENCODING: "latin-1" });
      assert.deepEqual(r.seen, { TERM: "screen", NO_COLOR: "", PYTHONIOENCODING: "latin-1" }, shell);
      r = run(shell, PS.psCommand("Get-ChildItem") + after, { TERM: "linux", FORCE_COLOR: "1" });
      assert.deepEqual(r.seen, { TERM: "xterm-256color", NO_COLOR: "unset", PYTHONIOENCODING: "utf-8:surrogateescape" }, shell);
    }
    // A PowerShell hook (inside the hook's own subshell, run as Coder runs a hook): -Command and its command with Claude Code's
    // ending, the width; no NO_COLOR or PYTHONIOENCODING (Claude Code sets those for its tool, not for hooks).
    const hookPart = (line) => line.slice(line.indexOf("(\n") + 2, line.indexOf("\n) < \"$__in\""));
    for (const shell of ["bash", "sh"]) {
      const part = hookPart(H.hookShell({ type: "command", shell: "powershell", command: tricky, event: "PreToolUse" }, "M", "/w"));
      const r = run(shell, "(" + part + ")" + after, { TERM: "linux", FAKE_EXIT: "2" });
      assert.deepEqual(r.args, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", tricky + H.PS_HOOK_EXIT2], shell);
      assert.deepEqual(r.seen, { TERM: "xterm-256color", NO_COLOR: "unset", PYTHONIOENCODING: "unset" }, shell);
      assert.match(r.stdout, /^code=2 pwd=\S+ TERM=linux /, shell);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
