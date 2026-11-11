// BASH DOCS PASS 9, PART C (the owner, 2026-11-11: "Yes pls" to building pass 9's list in order; part C: the rules and
// "don't ask again"): each test checked against Claude Code's own program, 2.1.322 (its uPn, mso, ter, FD, CT and hY).
import { test } from "node:test";
import assert from "node:assert/strict";

const P = await import("../container/coder-perms.mjs");
const SH = await import("../container/coder-shell.mjs");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
// (The command itself, not one inside a $( ) of it: the parts at the top.)
const suggest = (c) => { const cmds = SH.parseShell(c).commands; return P.suggestFor(cmds.find((x) => !x.depth) || cmds[0]); };
const decide = (c, allow, o = {}) => P.bashDecision(c, { mode: "acceptEdits", rules: { allow, ask: [], deny: [] }, cwd: "/w", workdirs: ["/w"], home: "/h", byCommand: false, isProtected: () => "", ...o });

test("CD467 the rule \"Yes, and don't ask again\" saves is Claude Code's own (its uPn): the first two words and * when the second looks like a subcommand and the first is no shell or wrapper, past the variables in front it counts as safe; a heredoc's command; a part over several lines, its first line; otherwise the command itself", () => {
  // Claude Code's rule for each of these 38 commands, from its program (a port of uPn run side by side with Coder's).
  const cc = {
    "ls -la": "ls -la", "ls": "ls", "pytest tests/": "pytest tests/", "pytest": "pytest", "mkdir -p a/b": "mkdir -p a/b", "echo hello": "echo hello *",
    "python3 script.py": "python3 script.py", "python3 -m pytest tests": "python3 -m pytest tests", "npm run build": "npm run *", "npm test": "npm test *",
    "npm install lodash": "npm install *", "git commit -m x": "git commit *", "git push origin main": "git push *", "cargo build --release": "cargo build *",
    "make": "make", "make test": "make test *", "docker compose up -d": "docker compose *", "./scripts/test.sh fast": "./scripts/test.sh fast *",
    "./gradlew build": "./gradlew build *", "node --test": "node --test", "node server.js": "node server.js", "go test ./...": "go test *",
    "NODE_ENV=test npm test": "npm test *", "FOO=1 npm test": "FOO=1 npm test", "touch a.txt": "touch a.txt", "rm -rf build": "rm -rf build",
    "curl https://example.com": "curl https://example.com", "tsc --noEmit": "tsc --noEmit", "npx prettier --write .": "npx prettier *",
    "pip install -r requirements.txt": "pip install *", "kubectl get pods": "kubectl get *", "gh pr list": "gh pr *", "terraform plan": "terraform plan *",
    "jq .name package.json": "jq .name package.json", "sed -i s/a/b/ f.txt": "sed -i s/a/b/ f.txt", "timeout 30 npm test": "timeout 30 npm test",
    "cat <<EOF\nhi\nEOF": "cat *", "git status": "git status *",
  };
  for (const [c, want] of Object.entries(cc)) assert.equal(suggest(c), want, c);
  // Its pieces: a locale only as LANG's value; a value that looks like a path is no safe variable; its wrappers and shells.
  assert.equal(P.ruleShape("LANG=C.UTF-8 git log --oneline"), "git log *");
  assert.equal(P.ruleShape("LANG=klingon git log"), "LANG=klingon git log");
  assert.equal(P.ruleShape("NODE_ENV=../x npm test"), "NODE_ENV=../x npm test");
  assert.equal(P.ruleShape("sudo apt-get update"), "sudo apt-get update");
  assert.equal(P.ruleShape("bash run.sh"), "bash run.sh");
  assert.equal(P.ruleShape("git commit -m 'a\nb'"), "git commit -m 'a *", "several lines: the first one and *, as Claude Code's");
  assert.equal(P.ruleShape("NODE_ENV=test cat <<EOF\nx\nEOF"), "cat *");
  assert.ok(P.safeLeadVar("CI", "true") && !P.safeLeadVar("FOO", "1") && !P.safeLeadVar("TZ", "/etc/x"));
  // Kept from Coder: none when the program is worked out as it runs, or a command substitution runs; no exact rule with *.
  for (const c of ["$CMD x", "$HOME/bin/tool x", "echo $(date)", "rm *.log"]) assert.equal(suggest(c), null, c);
  assert.equal(suggest("eval echo hi"), "eval echo hi", "eval and the rest of Claude Code's list: only an exact rule can approve them");
  // A compound command: one rule per part that asked (Claude Code: up to five), the same rule once.
  assert.deepEqual(decide("npm test && npm run build && npm run lint", []).suggest, ["Bash(npm test *)", "Bash(npm run *)"]);
});

test("CD468 a rule \"don't ask again\" saved approves that command the next time, in Claude Code's way of matching it", () => {
  // (Commands that ask in Coder's cloud Accept edits; one that only reads runs without asking.)
  for (const c of ["npm run build", "python3 -c 'print(1)'", "FOO=1 npm test", "timeout 30 npm test", "pytest tests/", "node --test", "git -C x status", "watch ls", "env A=1 npm test", "make", "touch a.txt", "docker compose up -d", "./gradlew build"]) {
    const d = decide(c, []);
    assert.equal(d.verdict, "ask", c);
    assert.ok(Array.isArray(d.suggest) && d.suggest.length, c);
    assert.equal(decide(c, d.suggest).verdict, "allow", c + " with " + d.suggest.join(", "));
  }
  // The exact rule approves no other command; the prefix one only its own.
  assert.equal(decide("ls -la /", ["Bash(ls -la)"]).verdict, "ask");
  assert.equal(decide("npm install x", ["Bash(npm run *)"]).verdict, "ask");
  assert.equal(decide("FOO=2 npm test", ["Bash(FOO=1 npm test)"]).verdict, "ask");
});

test("CD469 an allow rule is tried against the command as typed too, and past timeout with its own settings (Claude Code's hY: the command without its redirections, and its CT form)", () => {
  const rows = [
    ["NODE_ENV=production npm run build", "Bash(NODE_ENV=production npm run *)", "allow"],
    ["NODE_ENV=production npm run build", "Bash(npm run *)", "allow"],
    ["FOO=1 npm run build", "Bash(npm run *)", "ask"],
    ["FOO=1 npm run build", "Bash(FOO=1 npm run *)", "allow"],
    ["timeout -s KILL 30 npm test", "Bash(npm test *)", "allow"],
    ["timeout --signal=KILL 30 npm test", "Bash(npm test *)", "allow"],
    ["timeout -k 5 30 npm test", "Bash(npm test *)", "allow"],
    ["timeout -kKILL 30s npm test", "Bash(npm test *)", "allow"],
    ["timeout -s KILL 30 npm test", "Bash(timeout -s KILL 30 npm *)", "allow"],
    ["timeout --bogus 30 npm test", "Bash(npm test *)", "ask"],
    ["nice -n 5 timeout 30 npm test", "Bash(npm test *)", "allow"],
    ["watch -n 1 npm test", "Bash(watch *)", "ask"],
    ["npm testx", "Bash(npm test *)", "ask"],
  ];
  for (const [c, rule, want] of rows) assert.equal(decide(c, [rule]).verdict, want, c + " / " + rule);
  // A deny rule is not loosened by any of it.
  assert.equal(P.bashDecision("timeout -s KILL 30 npm test", { mode: "acceptEdits", rules: { allow: ["Bash(npm test *)"], ask: [], deny: ["Bash(npm test *)"] }, cwd: "/w", workdirs: ["/w"] }).verdict, "deny");
});

test("CD470 rules on a monitor's own settings: Monitor(timeout_ms:*) and the like match what Coder asked the monitor for; Bash's (Bash(run_in_background:true)) are on Bash calls only; hooks see a monitor's own input", async () => {
  const mr = (rules) => P.monitorRules({ allow: [], ask: [], deny: [], ...rules }, "acceptEdits");
  const d = (rules, input) => P.bashDecision(input.command, { mode: "acceptEdits", rules: mr(rules), cwd: "/w", workdirs: ["/w"], home: "/h", input, settings: P.MONITOR_SETTINGS });
  const inp = { command: "tail -f log.txt", description: "watch log", timeout_ms: 600000 };
  assert.notEqual(d({ deny: ["Bash(run_in_background:true)"] }, inp).verdict, "deny");
  assert.equal(d({ deny: ["Monitor(timeout_ms:*)"] }, inp).verdict, "deny");
  assert.notEqual(d({ deny: ["Monitor(timeout_ms:*)"] }, { command: "tail -f log.txt" }).verdict, "deny", "a setting not given never matches");
  assert.equal(d({ ask: ["Monitor(description:*deploy*)"] }, { ...inp, description: "watch the deploy" }).verdict, "ask");
  assert.equal(d({ deny: ["Bash(tail *)"] }, inp).verdict, "deny", "a rule on the command still applies");
  assert.equal(P.bashDecision("tail -f log.txt", { mode: "acceptEdits", rules: { allow: [], ask: [], deny: ["Bash(run_in_background:true)"] }, cwd: "/w", workdirs: ["/w"], input: { command: "tail -f log.txt", run_in_background: true } }).verdict, "deny", "on a Bash call, as before");
  assert.equal(P.ifRuleMatches("Monitor(timeout_ms:*)", "Monitor", inp), true);
  assert.equal(P.ifRuleMatches("Monitor(timeout_ms:*)", "Monitor", { command: "x" }), false);
  // In Coder's loop: a monitor under Bash(run_in_background:true) runs; under Monitor(timeout_ms:*) it is refused; a
  // PostToolUse hook gets the monitor's own input.
  const { runCoder } = await import("../container/coder-agent.mjs");
  const run = async (rules, hooks = null) => {
    const events = [], execs = [], hookInputs = [];
    let n = 0;
    await runCoder({
      send: async () => (n++ === 0 ? say("", [call("monitor", { command: "tail -f log.txt", description: "Log", timeout_ms: 600000 }, "m1")]) : say("ok")),
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { hookInputs.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
        if (x.envReset) return { code: 0, output: "" };
        execs.push(x);
        return { code: 0, output: "ok\n", ...(x.monitor ? { background: true, pid: 778, log: "/srv/coder-bg/bg-8.log", jobId: "job4" } : {}) };
      },
      emit: (e) => events.push(e), here: () => "/work/shop", root: "/work/shop", ask: async () => ({ choice: "yes" }),
    }, { text: "go", mode: "acceptEdits", rules: { allow: ["Monitor(tail -f *)"], ask: [], deny: [], ...rules }, ...(hooks ? { hooks } : {}) });
    return { events, execs, hookInputs };
  };
  let t = await run({ deny: ["Bash(run_in_background:true)"] });
  assert.equal(t.execs.filter((e) => e.monitor).length, 1);
  t = await run({ deny: ["Monitor(timeout_ms:*)"] });
  assert.equal(t.execs.filter((e) => e.monitor).length, 0);
  t = await run({}, [{ event: "PostToolUse", matcher: "Monitor", type: "command", command: "log.sh" }]);
  const post = t.hookInputs.find((h) => h.hook_event_name === "PostToolUse");
  assert.ok(post, "the hook ran");
  assert.equal(post.tool_name, "Monitor");
  assert.deepEqual([post.tool_input.command, post.tool_input.timeout_ms, "run_in_background" in post.tool_input], ["tail -f log.txt", 600000, false]);
});
