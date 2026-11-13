// THE THREE FOUND IN THE SIDE-CASE LIVE TEST OF 2026-11-13 (the owner: "yea fix all 3, merge and deploy then test it on low pls").
//   1. PowerShell dropped table output: Coder's script ended with `exit`; Claude Code 2.1.323's ends with `$host.SetShouldExit`.
//   2. Rewind's box in a read-only chat said the undo went "on the branch, never deleted from GitHub".
//   3. A job from GitHub with auto mode off was refused "by the Coder auto mode classifier", though no checker ran.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  const sent = Buffer.from(/-EncodedCommand ([A-Za-z0-9+/=]+)/.exec(cmd)[1], "base64").toString("utf16le");
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
