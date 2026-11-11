// BASH DOCS PASS 8, PART D (the owner, 2026-11-11: "Yes pls" to building all of it): the PowerShell tool's details, each
// test checked against Claude Code's own words (its docs, and its program, version 2.1.322).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const H = await import("../container/coder-hooks.mjs");
const Q = await import("../container/coder-psparse.mjs");
const P = await import("../container/coder-perms.mjs");
const C = await import("../container/coder-checker.mjs");
const { fakeParse } = await import("./ps-fake.mjs");
const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const CHECKER = /^You are the safety checker of Coder's auto mode/;
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

/** Coder's loop on a pretend machine (as pass 7's); `run` answers each command. */
async function job(steps, { hooks = null, hookRun = () => ({}), mode = "auto", answers = [], checker = false, rules = null, extra = {}, run = () => ({ code: 0, output: "ok\n" }) } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], cards = [], checks = [], execs = [], hookExecs = [];
  let n = 0, k = 0;
  await runCoder({
    send: async (req) => {
      const sys = req.messages && req.messages[0] && req.messages[0].content;
      if (CHECKER.test(String(sys || ""))) { checks.push(req); return { message: { role: "assistant", content: '{"decision":"allow"}' }, usage: { in: 100, out: 5 } }; }
      seen.push(req);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { hookExecs.push(x); const a = (await hookRun(JSON.parse(x.payload))) || {}; return { code: 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" }; }
      if (/coder-tools\.mjs/.test(String(x.command))) return { code: 0, output: "" };
      execs.push(x);
      return run(x);
    },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-p8d", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; },
    psParse: async (cmd) => fakeParse(cmd),
  }, { text: "go", mode, rules, checker, checkWhere: { key: "chat-" + Math.random().toString(36).slice(2), repo: "ana/shop", branch: "coder/shop-1" }, powershell: { bypass: true }, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { events, seen, cards, checks, execs, hookExecs, told };
}
const ps = (command, id = "p1", more = {}) => [say("", [call("powershell", { command, description: "Run", ...more }, id)]), say("ok")];
const where = { cwd: ROOT, home: "/home/dev", pathAbs: (p) => { const abs = p.startsWith("/") ? p : join(ROOT, p); return abs.replace(/\/+$/, "") || "/"; }, inside: (p) => { const abs = p.startsWith("/") ? p : join(ROOT, p); return abs === ROOT || abs.startsWith(ROOT + "/"); } };
const decide = (command, mode = "acceptEdits", rules = {}, input = null) => P.psDecision(command, { mode, rules: { allow: [], ask: [], deny: [], ...rules }, parsed: fakeParse(command), ...where, ...(input ? { input: { command, ...input } } : {}) });

test("CD419 PowerShell's exit codes, Claude Code 2.1.322's own rules: the last part's program, the search before its formatting cmdlets when nothing was printed, robocopy's and where.exe's codes, never \"normal\" after a && or when a command was not found", async () => {
  const em = (cmd, code, out = "") => Q.psExitOf(cmd, code, out);
  // Searches and git diff/grep, alone or through Select-Object and the other formatting cmdlets (its n4r set).
  for (const c of ["rg TODO", "grep x f", "egrep x f", "fgrep x f", "findstr x f", "findstr.exe x f", "git grep x", "rg TODO | Select-Object -First 5", "rg TODO | Sort-Object | ft", "rg TODO | Group-Object | Out-String", "rg x | Get-Unique", "rg x 2>&1 | Select-Object -First 1", "& \"C:\\Tools\\rg.exe\" foo", "rg TODO # a note"]) assert.deepEqual(em(c, 1), { isError: false, message: "No matches found" }, c);
  assert.deepEqual(em("git diff | Select-Object -First 3", 1), { isError: false, message: "Files differ" }, "git diff through a formatter that printed nothing");
  assert.deepEqual(em("git -C sub diff", 1), { isError: false, message: "Files differ" });
  // A quoted | is no pipe (its 2.1.302 fix: "quoted search patterns containing | being reported as failures").
  assert.deepEqual(em('rg "a|b" src', 1), { isError: false, message: "No matches found" });
  assert.deepEqual(em("rg 'a|b' src", 1), { isError: false, message: "No matches found" });
  // Errors: Out-Null and Out-File are none of its formatters; sort is no alias of Sort-Object there; brackets leave no feeder.
  for (const c of ["rg TODO | Out-Null", "rg TODO | Out-File x.txt", "rg foo | sort", "(rg foo) | Select-Object -First 1", "find . -name x", "Get-Item nope", "rg foo; Write-Output done"]) assert.equal(em(c, 1).isError, true, c);
  // It printed: the formatter's own code.
  assert.equal(em("git diff | Select-Object -First 3", 1, "diff --git a/x b/x").isError, true);
  // Codes past 1, and 0.
  assert.deepEqual(em("rg TODO", 2), { isError: true, message: "" });
  assert.deepEqual(em("Get-ChildItem", 0), { isError: false, message: "" });
  // robocopy: 0 to 7 are not failures, in its words.
  assert.deepEqual([0, 1, 2, 3, 8].map((k) => em("robocopy a b", k)), [{ isError: false, message: "No files copied (already in sync)" }, { isError: false, message: "Files copied successfully" }, { isError: false, message: "Robocopy completed (no errors)" }, { isError: false, message: "Files copied successfully" }, { isError: true, message: "" }]);
  // where.exe, fc.exe: only typed with .exe and when they printed something (`where` alone is Where-Object).
  assert.deepEqual(em("where.exe node", 1, "INFO: Could not find files for the given pattern(s)."), { isError: false, message: "No matching files found" });
  assert.equal(em("where.exe node", 1).isError, true);
  assert.equal(em("where node", 1, "x").isError, true);
  assert.deepEqual(em("fc.exe a.txt b.txt", 1, "Comparing files"), { isError: false, message: "Files differ" });
  // Never normal: after a &&, a command not found, findstr's own complaint.
  assert.equal(em("cd sub && rg foo", 1).isError, true, "after a &&");
  assert.equal(em("rg foo", 1, "rg : The term 'rg' is not recognized as a name of a cmdlet, function, script file, or executable program.").isError, true);
  assert.equal(em("rg foo", 1, "CommandNotFoundException").isError, true);
  assert.equal(em("findstr x y", 1, "FINDSTR: Cannot open y").isError, true);
  // The part whose code it is.
  assert.deepEqual(Q.psLastSegment("rg TODO | Select-Object -First 5"), { segment: " Select-Object -First 5", andGated: false, feeder: "rg TODO " });
  assert.deepEqual(Q.psLastSegment("Write-Output a & rg foo"), { segment: " rg foo", andGated: false, feeder: undefined });
  assert.equal(Q.psLastSegment("a && b").andGated, true);
  assert.deepEqual(Q.psProgram('& "C:\\Program Files\\Git\\bin\\git.exe" diff'), { base: "git", hadNativeExt: true, nativeExt: "exe" });
  // In the loop: told as an error or not, from what the command printed.
  let t = await job(ps("git diff | Select-Object -First 3"), { mode: "acceptEdits", rules: { allow: ["PowerShell(git diff *)", "PowerShell(Select-Object *)"], deny: [], ask: [] }, run: () => ({ code: 1, output: "" }) });
  assert.doesNotMatch(t.told("p1"), /Exit code 1/);
  t = await job(ps("rg TODO | Out-Null"), { mode: "acceptEdits", rules: { allow: ["PowerShell(rg *)", "PowerShell(Out-Null)"], deny: [], ask: [] }, run: () => ({ code: 1, output: "" }) });
  assert.match(t.told("p1"), /Exit code 1/);
  assert.match(read("container/coder-agent.mjs"), /const em = c\.ps \? psExitOf\(command, code, noCwdMarks\(String\(\(r && r\.output\) \|\| ""\)\)\) : exitMeaning\(command, code\);/);
});

test("CD420 a program by path or with a dot (dotnet.exe, ./build.ps1) is allowed only by a rule whose first word names it, as typed (Claude Code 2.1.322: \"PowerShell(dotnet.exe build *)\" pre-approves it; PowerShell(*) or PowerShell(dot*) never do); a rule that is the whole command allows it, chains too", async () => {
  const v = (cmd, allow, mode = "acceptEdits") => decide(cmd, mode, { allow }).verdict;
  assert.equal(v("dotnet.exe build src", ["PowerShell(dotnet.exe build *)"]), "allow");
  assert.equal(v("DotNet.EXE build src", ["PowerShell(dotnet.exe build *)"]), "allow", "case aside");
  for (const r of ["PowerShell(*)", "PowerShell", "PowerShell(dot*)", "PowerShell(dotnet build *)", "PowerShell(* build *)"]) assert.equal(v("dotnet.exe build src", [r]), "ask", r);
  assert.equal(v("./build.ps1 -Release", ["PowerShell(./build.ps1 *)"]), "allow");
  assert.equal(v("./build.ps1 -Release", ["PowerShell(./build.ps1 -Release)"]), "allow");
  assert.equal(v("& ./build.ps1 -Release", ["PowerShell(./build.ps1 *)"]), "ask", "typed after & : not its name as typed");
  assert.equal(v("dotnet build src", ["PowerShell(dotnet build *)"]), "allow", "a program by name, as before");
  // In Auto, the rule decides whether the checker is asked.
  assert.equal(decide("dotnet.exe build src", "auto", { allow: ["PowerShell(dotnet.exe build *)"] }).covered, true);
  assert.equal(decide("dotnet.exe build src", "auto", { allow: ["PowerShell(dotnet*)"] }).covered, false);
  // A rule that is exactly the whole command (Claude Code's own rule for it, "don't ask again"): several commands, a chain.
  assert.equal(v("git status; git log -1", ["PowerShell(git status; git log -1)"]), "allow");
  assert.equal(v("git status; git log -1", ["PowerShell(GIT STATUS; git log -1)"]), "allow", "case aside");
  // A chain asks even when each part is allowed (Claude Code 2.1.322: a statement that is no plain pipeline needs approval),
  // offering the chain's own rule, which then allows it.
  const chain = decide("git status && git log -1", "acceptEdits", { allow: ["PowerShell(git status)", "PowerShell(git log *)"] });
  assert.deepEqual([chain.verdict, chain.suggest], ["ask", ["PowerShell(git status && git log -1)"]]);
  assert.equal(v("git status && git log -1", ["PowerShell(git status && git log -1)"]), "allow");
  // Its deny rules still reach each part of a chain.
  assert.equal(decide("git status && git push", "acceptEdits", { allow: ["PowerShell(git status && git push)"], deny: ["PowerShell(git push *)"] }).verdict, "deny");
  // In the loop, as Claude Code's: "don't ask again" first saves each part's rule; the chain then asks once more, offering its
  // own rule; after that, no card.
  const one = (id) => call("powershell", { command: "npm install && npm test", description: "Build" }, id);
  const steps = [say("", [one("p1")]), say("", [one("p2")]), say("", [one("p3")]), say("ok")];
  const t = await job(steps, { mode: "acceptEdits", rules: { allow: [], deny: [], ask: [] }, answers: [{ choice: "always" }, { choice: "always" }] });
  assert.deepEqual(t.cards.map((c) => c.rules), [["PowerShell(npm install)", "PowerShell(npm test)"], ["PowerShell(npm install && npm test)"]]);
  assert.equal(t.execs.filter((x) => x.ps === true).length, 3);
});

test("CD421 rules on a PowerShell call's settings, as Bash's (Claude Code's \"Match by input parameter\": deny and ask rules only; \"You can't match a tool's primary content field this way: command for Bash and PowerShell\"): PowerShell(run_in_background:true) refuses a background call; PowerShell(command:…) never matches, with Claude Code's warning", async () => {
  assert.equal(decide("Get-ChildItem", "acceptEdits", { deny: ["PowerShell(run_in_background:true)"] }, { run_in_background: true }).verdict, "deny");
  assert.equal(decide("Get-ChildItem", "acceptEdits", { deny: ["PowerShell(run_in_background:true)"] }, { run_in_background: false }).verdict, "allow");
  assert.equal(decide("Get-ChildItem", "acceptEdits", { deny: ["PowerShell(run_in_background:true)"] }, {}).verdict, "allow", "a setting the call leaves out is never matched");
  const a = decide("Get-ChildItem", "auto", { ask: ["PowerShell(timeout:*)"] }, { timeout: 5000 });
  assert.deepEqual([a.verdict, a.rule, a.byRule], ["ask", "PowerShell(timeout:*)", true]);
  assert.equal(decide("npm test", "acceptEdits", { allow: ["PowerShell(run_in_background:true)"] }, { run_in_background: true }).verdict, "ask", "an allow rule on a setting establishes nothing");
  // PowerShell(command:…): kept, never matching, with Claude Code's words.
  assert.equal(P.parseRule("PowerShell(command:rm *)"), null);
  assert.equal(P.ruleSaved("PowerShell(command:rm *)"), true);
  assert.equal(P.ruleWarning("deny", "PowerShell(command:rm *)").warning, 'Permission deny rule "PowerShell(command:rm *)" targets command as a raw string and will not match — use PowerShell(…) for PowerShell\'s own matcher.');
  assert.equal(P.ruleWarning("allow", "PowerShell(command:rm *)"), null, "an allow one without a word, as Claude Code keeps it");
  // In the loop: refused, in Claude Code's words; a foreground call runs.
  const steps = [say("", [call("powershell", { command: "npm run dev", description: "Serve", run_in_background: true }, "p1"), call("powershell", { command: "Get-ChildItem", description: "List" }, "p2")]), say("ok")];
  const t = await job(steps, { mode: "acceptEdits", rules: { allow: [], deny: ["PowerShell(run_in_background:true)"], ask: [] } });
  assert.match(t.told("p1"), /Permission to use PowerShell with command npm run dev has been denied\./);
  assert.ok(t.execs.some((x) => x.ps === true && x.shown === "Get-ChildItem"));
  assert.ok(!t.execs.some((x) => x.shown === "npm run dev"));
});

test("CD422 Auto mode drops Claude Code's own list of broad rules (2.1.322's lists, word for word): PowerShell(*), PowerShell(pwsh *), PowerShell(iex *), PowerShell(npm.exe run *) and the rest; Bash(python -c *) but not Bash(make *); with classifyAllShell every Bash and PowerShell allow rule", async () => {
  for (const r of ["PowerShell", "PowerShell(*)", "PowerShell( * )", "PowerShell(pwsh *)", "PowerShell(pwsh.exe *)", "PowerShell(powershell:*)", "PowerShell(cmd *)", "PowerShell(iex *)", "PowerShell(Invoke-Expression *)", "PowerShell(Start-Process *)", "PowerShell(Add-Type *)", "PowerShell(New-Object *)", "PowerShell(node -e *)", "PowerShell(python *)", "PowerShell(npm.exe run *)", "PowerShell(npx *)", "PowerShell(wsl *)"]) assert.equal(C.droppedInAuto(r), true, r);
  for (const r of ["PowerShell(Get-ChildItem *)", "PowerShell(dotnet build *)", "PowerShell(npm test)", "PowerShell(python manage.py test)", "PowerShell(git status)"]) assert.equal(C.droppedInAuto(r), false, r);
  for (const r of ["Bash", "Bash(*)", "Bash(python3 *)", "Bash(python -c *)", "Bash(python -m pytest *)", "Bash(npm run *)", "Bash(npx *)", "Bash(node:*)", "Bash(sudo *)", "Bash(env *)", "Bash(xargs *)", "Bash(ssh *)", "Bash(bash -c *)"]) assert.equal(C.droppedInAuto(r), true, r);
  for (const r of ["Bash(npm test *)", "Bash(npm run build)", "Bash(npm run build *)", "Bash(make *)", "Bash(python -m http.server *)", "Bash(python3 manage.py test)", "WebFetch(domain:x.com)"]) assert.equal(C.droppedInAuto(r), false, r);
  for (const r of ["Bash(npm test)", "PowerShell(Get-ChildItem)"]) assert.equal(C.droppedInAuto(r, { classifyAllShell: true }), true, r);
  assert.equal(C.droppedInAuto("Monitor(tail -f x)"), true);
  // In the loop: a blanket PowerShell rule no longer skips the checker; a narrow one does; classifyAllShell sends it anyway.
  const rules = (allow) => ({ allow, deny: [], ask: [] });
  let t = await job(ps("npm install"), { checker: true, rules: rules(["PowerShell(*)"]) });
  assert.equal(t.checks.length, 1, "PowerShell(*) is dropped in Auto");
  t = await job(ps("npm install"), { checker: true, rules: rules(["PowerShell(npm install)"]) });
  assert.equal(t.checks.length, 0, "a narrow rule stays");
  t = await job(ps("npm install"), { checker: true, rules: rules(["PowerShell(npm install)"]), extra: { autoMode: { classifyAllShell: true } } });
  assert.equal(t.checks.length, 1, "classifyAllShell");
});

test("CD423 a PowerShell card offers no \"Yes, and switch to auto mode\" (Claude Code 2.1.322 offers none there); a Bash card in Accept edits still does", async () => {
  let t = await job(ps("npm install"), { mode: "acceptEdits", rules: { allow: [], deny: [], ask: [] }, answers: [{ choice: "no" }] });
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].toAuto, undefined);
  t = await job([say("", [call("bash", { command: "npm install", description: "Install" }, "b1")]), say("ok")], { mode: "acceptEdits", rules: { allow: [], deny: [], ask: [] }, answers: [{ choice: "no" }] });
  assert.equal(t.cards[0].toAuto, true);
});

test("CD424 in Accept edits a PowerShell file command whose positional argument has a quote character still asks (Claude Code's docs: \"such as the apostrophe in Set-Content .\\notes.txt \\\"It's done\\\", still prompts even on in-scope paths … Pass the content through a named parameter such as -Value\"), in its words", async () => {
  const WHY = "Paths containing quote characters cannot be statically validated and require manual approval";
  assert.equal(P.PS_QUOTED_WHY, WHY);
  assert.equal(decide("Set-Content ./notes.txt \"It is done\"").verdict, "allow");
  const q = decide("Set-Content ./notes.txt \"It's done\"");
  assert.deepEqual([q.verdict, q.why], ["ask", WHY]);
  assert.equal(decide("Set-Content -Path ./notes.txt -Value \"It's done\"").verdict, "allow", "through -Value");
  assert.equal(decide("Add-Content ./log.txt \"don't\"").verdict, "ask");
  assert.equal(decide("Remove-Item './it\u2019s.txt'").verdict, "ask", "a curly quote too");
  // A command that only reads, named a path with a quote in it, asks too (the same path check of Claude Code's).
  assert.equal(decide("Get-Content \"./it's.txt\"", "plan").verdict, "ask");
  assert.equal(decide("Get-Content ./notes.txt", "plan").verdict, "allow");
  // In the loop: a card, with that reason.
  const t = await job(ps("Set-Content ./notes.txt \"It's done\""), { mode: "acceptEdits", rules: { allow: [], deny: [], ask: [] }, answers: [{ choice: "no" }] });
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].why, WHY);
});

test("CD425 CODER_SHELL_PREFIX wraps only what Claude Code's CLAUDE_CODE_SHELL_PREFIX wraps (\"Bash tool calls, hook commands … PowerShell hooks and exec-form hooks run without the prefix\"): never a PowerShell command, an exec-form hook or a PowerShell hook", async () => {
  const hooks = { PreToolUse: [{ matcher: "*", hooks: [
    { type: "command", command: "echo shell-form" },
    { type: "command", command: "/opt/hooks/check.sh", args: ["--json"] },
    { type: "command", command: "Write-Output ps", shell: "powershell" },
  ] }] };
  const t = await job([say("", [call("bash", { command: "ls", description: "List" }, "b1")]), say("ok")], { hooks });
  const by = (re) => t.hookExecs.find((x) => re.test(String(x.command)));
  assert.equal(by(/echo shell-form/).noPrefix, false, "a shell-form bash hook: wrapped");
  assert.equal(by(/'\/opt\/hooks\/check\.sh' '--json'/).noPrefix, true, "an exec-form hook: not");
  assert.equal(by(/pwsh -NoProfile/).noPrefix, true, "a PowerShell hook: not");
  // The machine: a PowerShell command (the AI's or the owner's !) and a hook marked so never get the prefix.
  const server = read("container/server.mjs");
  assert.match(server, /shellPrefix: ps \|\| noPrefix \? "" : t\.shellPrefix \|\| "", shell: t\.shell \|\| "bash", merge: true \}\)/);
  assert.match(server, /\.\.\.\(hook \? \{ quietMs: hookQuietMs, shellPrefix: noPrefix \? "" : t\.shellPrefix \|\| "" \} : \{\}\)/);
  assert.match(server, /prefix: "", \.\.\.\(capped \? \{ memCg: t\.memCgNow\(\) \} : \{\}\), shellPrefix: noPrefix \? "" : t\.shellPrefix \|\| "", extraEnv:/, "a background hook too");
  assert.match(server, /hook: true, noPrefix: h\.type === "command" && \(Array\.isArray\(h\.args\) \|\| h\.shell === "powershell"\) \}\)/, "SessionEnd's");
});
