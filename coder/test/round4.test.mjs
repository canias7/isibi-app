// ROUND 4 (the owner, 2026-11-11: "yes copy all of them"): the eight differences Claude Code's command-line version (2.1.322,
// in its cloud setting, with Haiku) showed next to Coder's round 3, and what checking them there turned up. Every expected
// answer below is the one Claude Code gave for the same command and rules on 2026-11-11.
import { test } from "node:test";
import assert from "node:assert/strict";

const P = await import("../container/coder-perms.mjs");
const B = await import("../container/coder-bashcheck.mjs");
const SH = await import("../container/coder-shell.mjs");
const H = await import("../container/coder-hooks.mjs");
const A = await import("../container/coder-agent.mjs");

const W = "/data/work/demo";
const decide = (c, rules = {}, mode = "acceptEdits") => P.bashDecision(c, { mode, byCommand: false, rules: { allow: [], ask: [], deny: [], ...rules }, cwd: W, workdirs: [W], home: "/data/home" });
const G = (c) => "Permission to use Bash with command " + c + " has been denied.";
const OPS = "This command uses shell operators that require approval for safety";
const BR = "A group in braces or double parentheses in this command can't be checked before it runs";
const PAR = "A group in parentheses in this command can't be checked before it runs";
const CANT = "This command can't be checked before it runs";
const ESC = "Text with escape codes in this command can't be checked before it runs";
const FUNC = "A function definition in this command can't be checked before it runs";
const COUNT = "A counting for loop in this command can't be checked before it runs";
const head = (raw, after) => "command head " + raw + (after ? " after " + after : "") + " — a $'…' word the shell decodes before looking the command up";

test("CD513 a Read or Edit deny rule refuses a command in Claude Code's sentence for the whole command, every way the file is named", () => {
  const S1 = { deny: ["Bash(git push *)", "Bash(rm *)", "Read(.env)", "Edit(.env)", "Read(r39secrets/**)", "Bash(echo hi > r39-out.txt)"] };
  for (const c of ["F=.env; cat $F", "git diff --no-index /dev/null .env", "grep -v r39secrets/* README.md", "cp README.md .env"]) assert.deepEqual([decide(c, S1).verdict, decide(c, S1).why], ["deny", G(c)], c);
  const S5 = { deny: ["Read(*.env)", "Read(!sample.env)", "Edit(*.env)"] };
  for (const c of ["cat prod.env", "cat ./prod.env", "cat " + W + "/prod.env", "cat < prod.env", "head -1 prod.env", "echo hi > prod.env", "cp sample.env prod.env", "git diff --no-index /dev/null prod.env"]) assert.deepEqual([decide(c, S5).verdict, decide(c, S5).why], ["deny", G(c)], c);
  assert.equal(decide("cat sample.env", S5).verdict, "allow", "the ! rule");
});

test("CD514 a hook's block in Claude Code's words: PreToolUse \"hook error: <reason>\" (\"Blocked by hook\" with none), exit 2 \"[command hook]: <stderr>\" (\"No stderr output\"), another event's \"blocking error from command: \\\"command hook\\\": …\", a Stop hook's \"Stop hook feedback:\" and a new line; a hook named by its kind", () => {
  const hook = { type: "command", command: "i=$(cat); case \"$i\" in *) exit 0;; esac" };
  const run = (event, r, tool = "Bash") => H.hooksOutcome(event, [{ hook, result: H.hookResult(event, r, hook) }], { tool });
  const J = (o) => JSON.stringify(o);
  const pre = (o) => run("PreToolUse", { code: 0, stdout: J(o), stderr: "" });
  const d1 = pre({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "r39 hook says no", additionalContext: "The hook word is PINEAPPLE" } });
  assert.deepEqual([d1.decision, d1.reason, d1.context], ["deny", "PreToolUse:Bash hook error: r39 hook says no", ["The hook word is PINEAPPLE"]]);
  assert.equal(pre({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" } }).reason, "PreToolUse:Bash hook error: Blocked by hook");
  assert.equal(pre({ decision: "block", reason: "r39 legacy block" }).reason, "PreToolUse:Bash hook error: r39 legacy block");
  assert.equal(run("PreToolUse", { code: 2, stdout: "", stderr: "r39 exit two says no\n" }).reason, "PreToolUse:Bash hook error: [command hook]: r39 exit two says no");
  assert.equal(run("PreToolUse", { code: 2, stdout: "", stderr: "" }).reason, "PreToolUse:Bash hook error: [command hook]: No stderr output");
  // (Exit 2 reads no JSON, as in Claude Code.)
  assert.equal(run("PreToolUse", { code: 2, stdout: J({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "json" } }), stderr: "from stderr" }).reason, "PreToolUse:Bash hook error: [command hook]: from stderr");
  assert.deepEqual(run("PostToolUse", { code: 0, stdout: J({ decision: "block", reason: "r39 post says no" }), stderr: "" }).blocks, ['PostToolUse:Bash hook blocking error from command: "command hook": r39 post says no']);
  assert.deepEqual(run("PostToolUse", { code: 2, stdout: "", stderr: "r39 post exit two\n" }).blocks, ['PostToolUse:Bash hook blocking error from command: "command hook": [command hook]: r39 post exit two']);
  assert.deepEqual(run("PostToolUse", { code: 2, stdout: "", stderr: "" }).blocks, ['PostToolUse:Bash hook blocking error from command: "command hook": [command hook]: No stderr output']);
  assert.deepEqual(run("Stop", { code: 0, stdout: J({ decision: "block", reason: "r39 stop says run echo two" }), stderr: "" }, "").blocks, ['Stop hook feedback:\nr39 stop says run echo two\n\nStop hook blocking error from command: "command hook": r39 stop says run echo two']);
  assert.deepEqual(run("Stop", { code: 2, stdout: "", stderr: "r39 stop exit two\n" }, "").blocks, ["Stop hook feedback:\n[command hook]: r39 stop exit two"]);
  // Each kind by its name, never its command or address (Claude Code's cloud).
  assert.deepEqual([{ command: "x" }, { type: "command", command: "/a/b.sh" }, { type: "http", url: "https://h.example/p" }, { type: "prompt", prompt: "p" }, { type: "agent", prompt: "p" }].map(H.hookName), ["[command hook]", "[command hook]", "[http hook]", "[prompt hook]", "[agent hook]"]);
  assert.deepEqual(run("PreToolUse", { code: 1, stdout: "", stderr: "oops" }).notices, ["PreToolUse:Bash hook error: [command hook]: Failed with non-blocking status code: oops"]);
});

test("CD515 a hook answer with no event name: Claude Code's note, word for word (\"Hook JSON output validation failed — …\", the hook's output, the shape it expects); a wrong name keeps \"Hook returned incorrect event name\"", () => {
  const json = { hookSpecificOutput: { permissionDecision: "deny", permissionDecisionReason: "no event name" } };
  const t = H.wrongEvent("PreToolUse", json);
  assert.equal(t, 'Hook JSON output validation failed — hookSpecificOutput is missing required field "hookEventName"\n\nThe hook\'s output was: ' + JSON.stringify(json, null, 2) + "\n\nExpected schema:\n" + H.HOOK_SHAPE);
  assert.equal(t.length, 1933, "Claude Code's note for this hook was 1,933 characters");
  assert.ok(H.HOOK_SHAPE.startsWith('{\n  "continue": "boolean (optional)",\n  "suppressOutput": "boolean (optional)",'));
  assert.ok(H.HOOK_SHAPE.endsWith('    "for Stop / SubagentStop": {\n      "hookEventName": "\\"Stop\\" | \\"SubagentStop\\"",\n      "additionalContext": "string (optional) - Feedback for the model; the conversation continues so the model can act on it"\n    }\n  }\n}'));
  assert.match(H.wrongEvent("PreToolUse", { hookSpecificOutput: { hookEventName: "PostToolUse" } }), /^Hook returned incorrect event name: expected 'PreToolUse' but got 'PostToolUse'\./);
  const hook = { type: "command", command: "x" };
  const o = H.hooksOutcome("PreToolUse", [{ hook, result: H.hookResult("PreToolUse", { code: 0, stdout: JSON.stringify(json), stderr: "" }, hook) }], { tool: "Bash" });
  assert.deepEqual([o.decision, o.notices.length], ["", 1], "the command runs; the owner sees the note");
  assert.ok(o.notices[0].startsWith("PreToolUse:Bash hook error: [command hook]: Hook JSON output validation failed"));
});

test("CD516 $\"…\" and $'…': Claude Code asks (\"This command can't be checked before it runs\", \"Text with escape codes …\", or its command head check, after a wrapper too); no rule can name such a command, but a rule on another part still refuses; in Auto Coder still holds it to the rules; the rm check still sees through both", () => {
  const RM = { deny: ["Bash(rm *)", "Bash(git push *)"] };
  for (const [c, rules, why] of [
    ['$"rm" -f x', RM, CANT], ["echo $\"hello\"", {}, CANT], ['$"ls"', {}, CANT], ["echo $\"rm\"", RM, CANT],
    ["$'rm' -f x", RM, head("$'rm'")], ["$'touch' r39-x.txt", { allow: ["Bash(touch *)"] }, head("$'touch'")], ["command $'ls' x", {}, head("$'ls'", "command")],
    ["$'ls' -a", {}, ESC], ["$'ls'", {}, ESC], ["l$'s' -a", {}, ESC], ["echo $'a\\tb'", { allow: ["Bash(echo *)"] }, ESC],
  ]) assert.deepEqual([decide(c, rules).verdict, decide(c, rules).why], ["ask", why], c);
  for (const c of ["git push --dry-run origin HEAD; echo $\"x\"", '"rm" -f x']) assert.deepEqual([decide(c, RM).verdict, decide(c, RM).why], ["deny", G(c)], c);
  for (const c of ["echo '$\"x\"'", "echo plain"]) assert.equal(decide(c).verdict, "allow", c);
  // A Read deny rule can't name the file of a command whose name can't be read either: Claude Code asks.
  assert.deepEqual([decide("$'cat' .env x", { deny: ["Read(.env)"] }).verdict, decide("$'cat' .env x", { deny: ["Read(.env)"] }).why], ["ask", head("$'cat'")]);
  // Auto: still refused by the rule (the checker would otherwise judge it).
  for (const c of ['$"rm" -f x', "$'rm' -f x"]) assert.equal(decide(c, RM, "auto").verdict, "deny", c);
  for (const c of ['$"rm" -rf /', "$'rm' -rf /", "command $'rm' -rf ~"]) assert.ok(B.dangerousRm(c, { cwd: W, home: "/data/home", workdirs: [W] }), c);
});

test("CD517 brackets and braces ask as in Claude Code, even for a command that only reads, and no allow rule passes them: ( … ) \"shell operators\" (a ; of its own inside: \"can't be checked\"; with a redirection or after time: \"a group in parentheses\"), { …; } and (( … )), a function, a counting for loop, {a,b} and {1..3}; a deny rule inside still refuses; Auto leaves them to its checker", () => {
  const AL = { allow: ["Bash(echo *)", "Bash(ls *)", "Bash(touch *)", "Bash(npm *)"] };
  for (const [c, why] of [
    ["(ls)", OPS], ["(ls) && pwd", OPS], ["ls && (pwd)", OPS], ["ls | (cat)", OPS], ["! (ls)", OPS], ["if (ls); then pwd; fi", OPS], ["(touch r39-z.txt)", OPS], ["npm test && (npm run lint)", OPS], ["(cd /tmp) && git status", OPS], ["(cd /etc && cat passwd)", OPS], ["(cat /etc/hostname)", OPS], ["ls; (pwd)", OPS],
    ["(ls; pwd)", CANT], ["(cd src; cat /etc/hostname)", CANT],
    ["(ls) > /dev/null", PAR], ["time (ls)", PAR],
    ["{ ls; }", BR], ["{ ls; } > /dev/null", BR], ["{ touch r39-y.txt; }", BR], ["((1+1))", BR], ["(( $(id) )) && ls", BR],
    ["f() { ls; }", FUNC], ["function g { ls; }", FUNC], ["for ((i=0;i<2;i++)); do echo $i; done", COUNT],
    ["echo {a,b}", "Brace expansion"], ["ls src/{a,b}", "Brace expansion"], ["echo {1..3}", "A brace pattern in this command can't be checked before it runs"],
  ]) {
    assert.deepEqual([decide(c, AL).verdict, decide(c, AL).why], ["ask", why], c);
    assert.equal(decide(c, AL, "plan").verdict, "ask", "plan: " + c);
    assert.equal(decide(c, {}, "auto").verdict, "allow", "auto, the checker's: " + c);
  }
  for (const c of ["echo a{b", "echo \"{a,b}\"", "if true; then ls; fi", "echo x", "ls"]) assert.equal(decide(c, AL).verdict, "allow", c);
  assert.deepEqual([decide("(git push --dry-run origin HEAD)", { deny: ["Bash(git push *)"] }).verdict, decide("(git push --dry-run origin HEAD)", { deny: ["Bash(git push *)"] }).why], ["deny", G("(git push --dry-run origin HEAD)")]);
  assert.equal(P.wholeReadOnly("(ls)"), false);
});

test("CD518 echo <1-3>: the card names Claude Code's check of the whole text, not the rm check's; in Auto it is still refused as one that can't be checked", async () => {
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const job = async (mode) => {
    const events = [], seen = [], cards = [];
    let n = 0;
    const steps = [say("", [call("bash", { command: "echo <1-3>", description: "x" }, "b1")]), say("ok")];
    await A.runCoder({
      send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
      exec: async (x) => (x.tool ? { code: 0, output: "" } : { code: 0, output: "1\n" }),
      emit: (e) => events.push(e),
      here: () => W, root: W, home: "/data/home", chatId: "demo-r4", where: (p) => (p.startsWith("/") ? p : W + "/" + p),
      ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "no" }; },
    }, { text: "go", mode });
    const told = () => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === "b1") return String(m.content); return ""; };
    return { cards, told: told() };
  };
  const a = await job("acceptEdits");
  assert.equal(a.cards.length, 1);
  assert.equal(a.cards[0].why, "Contains zsh <N-M> numeric-range glob");
  const b = await job("auto");
  assert.equal(b.cards.length, 0);
  assert.match(b.told, /could not be checked for dangerous rm operations/);
  assert.deepEqual(SH.textReasons("echo <1-3>"), ["Contains zsh <N-M> numeric-range glob"]);
});

test("CD519 a hook's note carries the hook's name as Claude Code writes it: \"PreToolUse:Bash hook additional context: …\", \"PostToolUse:Bash …\", \"SessionStart …\", \"UserPromptSubmit …\"", async () => {
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const seen = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "ls", description: "x" }, "b1")]), say("ok")];
  const answer = (ev) => JSON.stringify({ hookSpecificOutput: { hookEventName: ev, additionalContext: ev + " says hi" } });
  await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); return { code: 0, output: answer(input.hook_event_name) + "\n" + mark[0] + "\n" }; }
      if (x.hook === true || x.tool) return { code: 0, output: "" };
      return { code: 0, output: "a.txt\n" };
    },
    emit: () => {},
    here: () => W, root: W, home: "/data/home", chatId: "demo-r4b", where: (p) => (p.startsWith("/") ? p : W + "/" + p),
  }, { text: "go", mode: "auto", hooks: H.hooksFrom({ hooks: Object.fromEntries(["PreToolUse", "PostToolUse", "SessionStart", "UserPromptSubmit"].map((e) => [e, [{ hooks: [{ type: "command", command: "h.sh" }] }]])) }, "settings").list });
  const all = seen.at(-1).messages.map((m) => String(m.content || "")).join("\n");
  for (const t of ["PreToolUse:Bash hook additional context: PreToolUse says hi", "PostToolUse:Bash hook additional context: PostToolUse says hi", "SessionStart hook additional context: SessionStart says hi", "UserPromptSubmit hook additional context: UserPromptSubmit says hi"]) assert.ok(all.includes(t), t);
  assert.ok(!/PreToolUse hook additional context/.test(all));
});

test("CD520 Claude Code's own answers on 2026-11-11, 69 commands: Coder gives the same verdict and the same words for each", () => {
  const RA = { deny: ["Bash(git push *)", "Bash(rm *)", "Read(.env)", "Edit(.env)", "Read(r39secrets/**)", "Bash(echo hi > r39-out.txt)"] };
  const RD = { deny: ["Read(*.env)", "Read(!sample.env)", "Edit(*.env)"] };
  const RV2 = { deny: ["Bash(rm *)", "Bash(git push *)"] };
  const RV6 = { allow: ["Bash(touch *)", "Bash(echo *)"], deny: ["Bash(git push *)"] };
  const RV8 = { allow: ["Bash(echo *)", "Bash(ls *)"] };
  const cases = [
    ...["time -p git push --dry-run origin HEAD", "/usr/bin/git push --dry-run origin HEAD", "flock -n r39.lock git push --dry-run origin HEAD", "setsid -w git push --dry-run origin HEAD", "A[0]=1 rm -f no-such-file-r39.txt", "X=rm export X; $X -f no-such-file-r39.txt", "echo $(( $(rm -f no-such-file-r39.txt; echo 1) + 1 ))", "F=.env; cat $F", "git diff --no-index /dev/null .env", "grep -v r39secrets/* README.md", "cp README.md .env", "echo hi > r39-out.txt"].map((c) => [c, RA, "deny", G(c)]),
    ["$\"rm\" -f no-such-file-r39.txt", RA, "ask", CANT],
    ...["cat ./prod.env", "cat " + W + "/prod.env", "cat < prod.env", "head -1 prod.env", "echo hi > prod.env", "cp sample.env prod.env", "git diff --no-index /dev/null prod.env", "cat prod.env"].map((c) => [c, RD, "deny", G(c)]),
    ["cat sample.env", RD, "allow", ""],
    ["(ls)", {}, "ask", OPS], ["{ ls; }", {}, "ask", BR], ["(ls) && pwd", {}, "ask", OPS], ["ls && (pwd)", {}, "ask", OPS], ["echo $\"hello\"", {}, "ask", CANT], ["ls <1-3>", {}, "ask", "Contains zsh <N-M> numeric-range glob"],
    ["$'rm' -f no-such-file-r39.txt", RV2, "ask", head("$'rm'")], ["\"rm\" -f no-such-file-r39.txt", RV2, "deny", G("\"rm\" -f no-such-file-r39.txt")], ["echo $\"rm\"", RV2, "ask", CANT], ["git push --dry-run origin HEAD; echo $\"x\"", RV2, "deny", G("git push --dry-run origin HEAD; echo $\"x\"")],
    ["$'ls' -a", {}, "ask", ESC], ["echo $'a\\tb'", {}, "ask", ESC], ["l$'s' -a", {}, "ask", ESC], ["$\"ls\"", {}, "ask", CANT], ["((1+1))", {}, "ask", BR], ["ls | (cat)", {}, "ask", OPS], ["if true; then ls; fi", {}, "allow", ""],
    ["(touch r39-z.txt)", RV6, "ask", OPS], ["{ touch r39-y.txt; }", RV6, "ask", BR], ["echo $'a\\tb'", RV6, "ask", ESC], ["$'touch' r39-x.txt", RV6, "ask", head("$'touch'")], ["(git push --dry-run origin HEAD)", RV6, "deny", G("(git push --dry-run origin HEAD)")], ["touch r39-w.txt", RV6, "allow", ""],
    ["f() { ls; }", { deny: ["Bash(rm *)"] }, "ask", FUNC], ["for ((i=0;i<2;i++)); do echo $i; done", {}, "ask", COUNT], ["echo {a,b}", {}, "ask", "Brace expansion"], ["echo '$\"x\"'", {}, "allow", ""], ["command $'ls' x", {}, "ask", head("$'ls'", "command")], ["$'ls'", {}, "ask", ESC], ["time (ls)", {}, "ask", PAR],
    ["! (ls)", RV8, "ask", OPS], ["if (ls); then pwd; fi", RV8, "ask", OPS], ["(ls) > /dev/null", RV8, "ask", PAR], ["{ ls; } > /dev/null", RV8, "ask", BR], ["echo {1..3}", RV8, "ask", "A brace pattern in this command can't be checked before it runs"], ["ls src/{a,b}", RV8, "ask", "Brace expansion"], ["function g { ls; }", RV8, "ask", FUNC], ["echo a{b", RV8, "allow", ""], ["echo \"{a,b}\"", RV8, "allow", ""], ["echo x", RV8, "allow", ""],
    ["echo =ls", {}, "ask", "Contains zsh =cmd equals expansion"], ["GOOS=linux ls", {}, "allow", ""], ["DEBUG=1 ls", {}, "ask", "This command requires approval"], ["(cd /tmp) && git status", {}, "ask", OPS],
    ["(ls; pwd)", {}, "ask", CANT], ["(cd src; cat a.js)", {}, "ask", CANT], ["(cat /etc/hostname)", {}, "ask", OPS],
  ];
  assert.equal(cases.length, 69);
  for (const [c, rules, v, why] of cases) {
    const d = decide(c, rules);
    assert.equal(d.verdict, v, c);
    if (v !== "allow") assert.equal(d.why, why, c);
  }
});
