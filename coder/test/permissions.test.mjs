// PERMISSION MODES AND RULES, LIKE CLAUDE CODE'S (the owner, 2026-11-09: "lets build the permission things", with the
// Claude app's mode menu: Auto, Accept edits, Plan; "something like this"). Each case against Claude Code's docs and
// Claude Code 2.1.319's own lists, read that day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShell } from "../container/coder-shell.mjs";
import { MODES, MODE_NAMES, MODE_INFO, normMode, commandReadOnly, bashDecision, fetchDecision, docSite, parseRule, bashSpecMatches, suggestFor, fileCommandTargets, readCommand, REJECTED, REJECTED_SAID, PLAN_NOTE, PLAN_EXITED, AUTO_EXITED, planApproved } from "../container/coder-perms.mjs";

const ROOT = "/work/shop";
const isProtected = (p) => { const rel = p.startsWith(ROOT + "/") ? p.slice(ROOT.length + 1) : ""; return /(^|\/)(\.git|\.husky|\.vscode)(\/|$)/.test(rel) || /(^|\/)\.bashrc$/.test(rel) ? "protected" : ""; };
const decide = (mode, command, rules = {}) => bashDecision(command, { mode, rules, cwd: ROOT, workdirs: [ROOT], isProtected });
const ro = (c) => parseShell(c).commands.every((x) => commandReadOnly(x));

test("CD305 the three modes of Claude Code's cloud sessions, named and described as in the Claude app", () => {
  assert.deepEqual(MODES, ["auto", "acceptEdits", "plan"]);
  assert.deepEqual(MODE_NAMES, { auto: "Auto", acceptEdits: "Accept edits", plan: "Plan" });
  assert.equal(MODE_INFO.auto, "Coder handles permission decisions");
  assert.equal(MODE_INFO.acceptEdits, "Automatically accept all file edits");
  assert.equal(MODE_INFO.plan, "Create a plan before making changes");
  assert.equal(normMode("bypassPermissions"), "auto"); // (Claude Code: "Bypass permissions isn't available in cloud sessions")
  assert.equal(normMode(undefined), "auto");
  assert.equal(normMode("plan"), "plan");
});

test("CD306 Claude Code's read-only commands run in every mode: its lists of commands and of each one's safe options", () => {
  for (const c of ["ls -la", "pwd", "git status", "git log --oneline -5", "git diff HEAD~1", "git show --stat", "git branch", "git branch -a", "git tag -l 'v1*'", "git remote -v", "git config --get user.name", "git stash list", "git rev-parse --show-toplevel",
    "grep -rn foo src", "grep -A3 foo f", "rg foo", "cat package.json | jq .name", "echo hi", "node -v", "wc -l src/*.js", "find . -name '*.js'", "sort -u f", "uniq -c", "date", "date +%Y", "sleep 5",
    "test -f x", "[ -f x ]", "true", "cd src", "which node", "ps aux", "ps -ef", "sed -n '1,5p' f", "sed 's/a/b/g' f", "head -20 f", "timeout 30 rg foo", "LANG=C ls", "xargs grep foo", "cat f 2>/dev/null", "du -sh .", "diff a b", "stat f", "file f", "tree -L 2"])
    assert.ok(ro(c), "read-only: " + c);
  for (const c of ["npm test", "git branch feature", "git branch -D x", "git config user.name x", "git remote add a b", "git log --format=%G?", "git checkout x", "git -C x status", "git push",
    "rg --pre cat foo", "echo $HOME", "find . -name *.js", "find . -delete", "find . -exec rm {} ;", "sort -o out f", "uniq a b", "date 1200", "ps auxe", "ps aux -e", "sed -e 's/x/y/w out' f", "sed -i 's/a/b/' f",
    "pwd x", "FOO=1 ls", "xargs rm", "./ls", "python3 -c 'print(1)'", "curl https://example.com", "tree -o out", "hostname newname", "cat $(echo x)", "ls {a,b}"])
    assert.ok(!ro(c), "asks: " + c);
});

test("CD307 Accept edits: file edits and mkdir, touch, rm, rmdir, mv, cp, sed inside the project run; any other command asks, with Claude Code's 'don't ask again' rule", () => {
  for (const c of ["mkdir -p src/utils && touch src/utils/a.js", "rm -rf node_modules", "cp -r src dist", "mv a.txt b.txt", "echo hi > notes.md", "sed -i 's/a/b/' src/cart.js", "rm *.log", "touch a b", "cd src && ls", "ls > out.txt", "rmdir empty"])
    assert.equal(decide("acceptEdits", c).verdict, "allow", c);
  const ask = (c) => decide("acceptEdits", c);
  assert.deepEqual(ask("npm test").suggest, ["Bash(npm test *)"]);
  assert.equal(ask("npm test").why, "This command requires approval");
  // (Pass 9: Claude Code's own rule shapes, its uPn: two words when the second looks like a subcommand, else the command.)
  assert.deepEqual(ask("npm run build").suggest, ["Bash(npm run *)"]);
  assert.deepEqual(ask("git commit -m 'fix the cart'").suggest, ["Bash(git commit *)"]);
  assert.deepEqual(ask("python3 test.py").suggest, ["Bash(python3 test.py)"]);
  assert.deepEqual(ask("timeout 60 npm test").suggest, ["Bash(timeout 60 npm test)"]);
  assert.deepEqual(ask("NODE_ENV=test npm test").suggest, ["Bash(npm test *)"]);
  // A rule for each part that needs asking (Claude Code: "approving git status && npm test saves a rule for npm test").
  assert.deepEqual(ask("git status && npm test && npm run lint").suggest, ["Bash(npm test *)", "Bash(npm run *)"]);
  // Only a one-time Yes when no rule could cover it: git after a cd, a write or read outside the project.
  for (const c of ["cd src && git status", "echo hi > /tmp/notes.md", "cat < /etc/passwd"]) assert.equal(ask(c).suggest, null, c);
  // (Pass 9: code given inline and an unknown setting in front get the command itself, as Claude Code's uPn gives them.)
  assert.deepEqual(ask("python3 -c 'print(1)'").suggest, ["Bash(python3 -c 'print(1)')"]);
  assert.deepEqual(ask("FOO=1 npm test").suggest, ["Bash(FOO=1 npm test)"]);
  // A cd out of the project gets its own Read rule for that folder (Claude Code: "Subcommands like cd into a directory outside
  // your working directories generate their own Read rule for that path").
  assert.deepEqual(ask("cd /tmp && ls").suggest, ["Read(//tmp/**)"]);
  // Outside the project, or a protected file: asked, never approved by a rule.
  assert.equal(ask("rm /tmp/x").verdict, "ask");
  assert.equal(ask("mv a.txt ../b.txt").verdict, "ask");
  assert.match(ask("echo x > .husky/pre-commit").why, /^Coder requested permissions to edit \S+\/\.husky\/pre-commit which is a sensitive file\.$/);
  assert.equal(ask("rm -rf .husky").suggest, null);
  assert.match(ask("rm -rf .husky").why, /^Coder requested permissions to edit \S+\/\.husky which is a sensitive file\.$/);
  // touch with anything beyond plain file paths asks (Claude Code: "an option, a glob, or a prefix such as timeout 5").
  assert.equal(ask("timeout 5 touch a").verdict, "ask");
  assert.equal(ask("touch -d yesterday a").verdict, "ask");
  // A wildcard that could reach a dot-folder asks.
  assert.equal(ask("rm .*").verdict, "ask");
});

test("CD308 Plan: reads and Claude Code's read-only commands run; anything that changes something asks; Auto runs everything", () => {
  assert.equal(decide("plan", "ls").verdict, "allow");
  assert.equal(decide("plan", "git log --oneline | head -5").verdict, "allow");
  assert.equal(decide("plan", "npm test").verdict, "ask");
  assert.equal(decide("plan", "mkdir x").verdict, "ask");
  assert.match(decide("plan", "echo x > notes.md").why, /Plan mode changes no files/);
  assert.equal(decide("plan", "echo x > notes.md").suggest, null);
  for (const c of ["npm test", "rm -rf node_modules", "curl https://example.com", "cd /tmp && ls"]) assert.equal(decide("auto", c).verdict, "allow", c);
  // A command that can't be read through asks (Claude Code: "Commands the analysis can't parse").
  assert.equal(decide("acceptEdits", "echo 'open").verdict, "ask");
});

test("CD309 rules: deny, then ask, then allow; * is any text, a trailing ' *' also matches the bare command, ':*' is ' *'", () => {
  assert.deepEqual(parseRule("Bash(npm test *)"), { tool: "Bash", spec: "npm test *" });
  assert.deepEqual(parseRule("Bash"), { tool: "Bash", spec: null });
  assert.deepEqual(parseRule("Bash(*)"), { tool: "Bash", spec: null });
  assert.deepEqual(parseRule("WebFetch(domain:example.com)"), { tool: "WebFetch", spec: "domain:example.com" });
  assert.deepEqual(parseRule("Read(./.env)"), { tool: "Read", spec: "./.env" }, "a file rule (file-rules.test.mjs)");
  // (Pass 6: WebSearch, Grok's own web search, takes a rule on the whole tool.)
  assert.deepEqual(parseRule("WebSearch"), { tool: "WebSearch", spec: null });
  assert.equal(parseRule("WebSearch(x)"), null);
  assert.equal(parseRule("WebFetch(https://x)"), null);
  // Its table of what each rule matches.
  assert.ok(bashSpecMatches("npm run build", "npm run build") && !bashSpecMatches("npm run build", "npm run build --watch"));
  assert.ok(bashSpecMatches("npm run *", "npm run build") && bashSpecMatches("npm run *", "npm run") && !bashSpecMatches("npm run *", "npm install"));
  assert.ok(bashSpecMatches("git log * main", "git log --oneline main") && !bashSpecMatches("git log * main", "git log main"));
  assert.ok(bashSpecMatches("ls *", "ls -la") && bashSpecMatches("ls *", "ls") && !bashSpecMatches("ls *", "lsof"));
  assert.ok(bashSpecMatches("ls*", "lsof"));
  assert.ok(bashSpecMatches("* --help *", "npm --help x") && !bashSpecMatches("* --help *", "npm --help"));
  assert.ok(bashSpecMatches("ls:*", "ls -la"));
  const rules = { allow: ["Bash(npm test *)", "Bash(git commit:*)"], ask: ["Bash(git push *)"], deny: ["Bash(rm -rf *)"] };
  assert.equal(decide("acceptEdits", "npm test", rules).verdict, "allow");
  assert.equal(decide("acceptEdits", "npm test -- --watch", rules).verdict, "allow");
  assert.equal(decide("acceptEdits", "npm testx", rules).verdict, "ask");
  assert.equal(decide("acceptEdits", "git commit -m x", rules).verdict, "allow");
  assert.equal(decide("acceptEdits", "timeout 30 npm test", rules).verdict, "allow"); // (wrappers stripped)
  assert.equal(decide("acceptEdits", "FOO=bar npm test", rules).verdict, "ask"); // (an allow rule never matches past an unknown setting)
  // Ask rules prompt even in Auto, nested ones too; deny rules refuse in every mode.
  assert.equal(decide("auto", "git push origin main", rules).verdict, "ask");
  assert.equal(decide("auto", "echo $(git push)", rules).verdict, "ask");
  assert.equal(decide("auto", "git push origin main", rules).byRule, true);
  const d = decide("auto", "rm -rf build", rules);
  assert.equal(d.verdict, "deny");
  assert.equal(d.why, "Permission to use Bash with command rm -rf build has been denied.");
  assert.equal(decide("acceptEdits", "npm test && rm -rf x", rules).verdict, "deny");
  assert.equal(decide("auto", "FOO=1 rm -rf x", rules).verdict, "deny"); // (deny matches past any setting)
});

test("CD310 'don't ask again' suggestions: Claude Code's own (Bash docs pass 9, its uPn): the first two words and * when the second looks like a subcommand, else the command itself; none for a command whose program is worked out when it runs", () => {
  const s = (c) => suggestFor(parseShell(c).commands[0]);
  assert.equal(s("npm test"), "npm test *");
  assert.equal(s("npm run build -- --watch"), "npm run *");
  assert.equal(s("yarn build"), "yarn build *");
  assert.equal(s("git push origin main"), "git push *");
  assert.equal(s("npx prettier --write ."), "npx prettier *");
  assert.equal(s("make build"), "make build *");
  assert.equal(s("./gradlew test"), "./gradlew test *");
  // The command itself: a second word that is no subcommand, a wrapper or shell first, a single word.
  for (const c of ["python3 -m pytest -q", "node scripts/build.js", "pytest tests/", "node --test", "curl https://example.com", "rm /tmp/x", "python3 -c 'print(1)'", "node -e 'x'", "bash -c 'ls'", "watch ls", "sudo apt-get update", "env A=1 npm test", "find . -delete", "git -C x status", "node"]) assert.equal(s(c), c, c);
  for (const c of ["$CMD x", "$HOME/bin/tool x", "rm *.log"]) assert.equal(s(c), null, c);
});

test("CD311 WebFetch: Claude Code's pre-approved documentation sites and rules; Accept edits and Plan ask for any other site, Auto doesn't", () => {
  assert.ok(docSite("https://developer.mozilla.org/en-US/docs/Web"));
  assert.ok(docSite("https://docs.python.org/3/"));
  assert.ok(docSite("https://go.dev/doc/install"));
  assert.ok(!docSite("https://go.dev/blog"));
  assert.ok(docSite("https://github.com/anthropics/claude-code"));
  // (Claude Code 2.1.323 pre-approves all of github.com/anthropics, and only repository pages under anthropic-experimental:
  // the owner, 2026-11-14, "start fixing and filling in gaps on those tools".)
  assert.ok(docSite("https://github.com/anthropics/claude-code/issues/1"));
  assert.ok(!docSite("https://github.com/anthropic-experimental/x/issues/1"));
  assert.ok(docSite("https://github.com/anthropic-experimental/x/blob/main/README.md"));
  assert.ok(!docSite("https://github.com/someone/x"));
  assert.ok(!docSite("https://example.com"));
  const f = (mode, url, rules = {}) => fetchDecision(url, { mode, rules });
  assert.equal(f("acceptEdits", "https://developer.mozilla.org/x").verdict, "allow");
  assert.equal(f("acceptEdits", "https://example.com/x").verdict, "ask");
  assert.deepEqual(f("acceptEdits", "https://example.com/x").suggest, ["WebFetch(domain:example.com)"]);
  assert.equal(f("plan", "https://example.com/x").verdict, "ask");
  assert.equal(f("auto", "https://example.com/x").verdict, "allow");
  assert.equal(f("auto", "https://example.com/x", { ask: ["WebFetch(domain:example.com)"] }).verdict, "ask");
  assert.equal(f("plan", "https://a.example.com/x", { allow: ["WebFetch(domain:*.example.com)"] }).verdict, "allow");
  assert.equal(f("acceptEdits", "https://developer.mozilla.org/x", { deny: ["WebFetch(domain:developer.mozilla.org)"] }).verdict, "deny");
});

test("CD312 what Coder is told: Claude Code's own words for No, plan mode and an approved plan", () => {
  assert.equal(REJECTED, "The owner doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the owner to tell you how to proceed.");
  assert.ok(REJECTED_SAID.endsWith("To tell you how to proceed, the owner said:\n"));
  assert.match(PLAN_NOTE, /^Plan mode is active\. The owner indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools/);
  assert.match(PLAN_NOTE, /call exit_plan_mode with the whole plan as its `plan` argument/);
  assert.equal(PLAN_EXITED, "## Exited Plan Mode\n\nYou have exited plan mode. You can now make edits, run tools, and take actions.");
  assert.match(AUTO_EXITED, /^## Exited Auto Mode\n/);
  assert.equal(planApproved("1. Add the cart"), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n## Approved Plan:\n1. Add the cart");
  assert.equal(planApproved(""), "The owner has approved exiting plan mode. You can now proceed.");
});

test("CD313 the files a command writes and Accept edits' file commands, read like Claude Code's checks", () => {
  const r = readCommand("cd src && cat a > out.txt; make | tee build.log 2>&1 >/dev/null", { cwd: ROOT });
  assert.deepEqual(r.writes.map((x) => x.path), [ROOT + "/src/out.txt", ROOT + "/src/build.log"]);
  assert.equal(r.cdAway, true);
  const t = (c) => fileCommandTargets(parseShell(c).commands[0], ROOT);
  assert.deepEqual(t("mkdir -p a/b"), { paths: [ROOT + "/a/b"], sure: true });
  // (dist may be a folder: what cp would write there counts for the owner's rules, Bash docs pass 8, CD409.)
  assert.deepEqual(t("cp -r src dist"), { paths: [ROOT + "/src", ROOT + "/dist"], sure: true, maybe: [ROOT + "/dist/src"] });
  assert.deepEqual(t("cp -r src dist/"), { paths: [ROOT + "/src", ROOT + "/dist/src"], sure: true });
  // (-t names the folder; the files it writes there stand for it: Bash docs pass 8, CD409.)
  assert.deepEqual(t("mv -t out a b"), { paths: [ROOT + "/a", ROOT + "/b", ROOT + "/out/a", ROOT + "/out/b"], sure: true });
  assert.deepEqual(t("rm src/*.log"), { paths: [ROOT + "/src/*"], sure: true });
  assert.equal(t("rm $X").sure, false);
  assert.equal(t("cp --backup a b").sure, false);
  assert.equal(t("npm test"), null);
  assert.equal(t("sed 's/a/b/' f"), null); // (sed changes files only with -i)
  assert.deepEqual(t("sed -i.bak -e 's/a/b/' f.js"), { paths: [ROOT + "/f.js"], sure: true });
});

// ── CODER'S LOOP: THE CARD WAITS FOR THE OWNER'S ANSWER, IN THE TURN ─────────
const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** Coder's loop with a scripted Grok, a pretend machine, and the owner's answers (one per card, in order). */
async function job(steps, { mode = "acceptEdits", answers = [], rules = null, modeOf = null, text = "go" } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], cards = [];
  let n = 0, k = 0, modeSet = null;
  const r = await runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { ran.push(x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || null; },
    ...(modeOf ? { mode: () => modeSet || modeOf(n), setMode: (m) => { modeSet = m; } } : {}),
  }, { text, mode, rules });
  return { r, events, seen, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), cards };
}

test("CD314 Accept edits: a command that is not read-only waits on a card (Claude Code's Bash prompt); Yes runs it, and Coder goes on in the same turn", async () => {
  const { r, ran, cards, seen } = await job([say("", [call("bash", { command: "npm test", description: "Run the tests" }, "b1")]), say("12 tests pass.")], { answers: [{ choice: "yes", comment: "only the cart ones matter" }] });
  assert.equal(cards.length, 1);
  assert.deepEqual([cards[0].tool, cards[0].id, cards[0].desc, cards[0].lines, cards[0].why, cards[0].rules, cards[0].toAuto], ["bash", "b1", "Run the tests", ["npm test"], "This command requires approval", ["Bash(npm test *)"], true]);
  assert.deepEqual(ran, ["npm test"]);
  assert.equal(r.status, "done");
  assert.equal(r.mode, "acceptEdits");
  const result = seen[1].messages.find((m) => m.role === "tool" && m.tool_call_id === "b1");
  assert.match(result.content, /\n\n\(The owner approved this with a note: only the cart ones matter\)$/, "Claude Code: a Yes's comment comes after the result");
  // What the system tells Grok of the mode.
  assert.match(seen[0].messages[0].content, /PERMISSION MODE: Accept edits \(the owner's pick\)/);
});

test("CD315 'Yes, and don't ask again' saves the rule for this repo and the same command runs without a card after; 'Yes, and switch to auto mode' switches the chat to Auto", async () => {
  const a = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("", [call("bash", { command: "npm test -- --watch=false" }, "b2")]), say("Done.")], { answers: [{ choice: "always" }] });
  assert.equal(a.cards.length, 1, "the second npm test is allowed by the new rule");
  assert.deepEqual(a.ran, ["npm test", "npm test -- --watch=false"]);
  assert.deepEqual(a.r.rulesAdded, ["Bash(npm test *)"]);
  const b = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("", [call("bash", { command: "npm run build" }, "b2")]), say("Done.")], { answers: [{ choice: "auto" }] });
  assert.equal(b.cards.length, 1, "in Auto nothing asks");
  assert.deepEqual(b.ran, ["npm test", "npm run build"]);
  assert.equal(b.r.mode, "auto");
  assert.ok(b.events.some((e) => e.type === "mode" && e.mode === "auto" && e.by === "card"));
  assert.ok(b.seen[1].messages.some((m) => m.role === "user" && /The owner's permission mode is now Auto\./.test(m.content)));
  // (Claude Code 2.1.325's auto mode reminder, "## Auto Mode Active", with Coder's names.)
  assert.match(b.seen[1].messages[0].content, /PERMISSION MODE: Auto \(the owner's pick\)\.\n## Auto Mode Active\n\nBias toward working without stopping for clarifying questions/);
});

test("CD316 No stops the turn with Claude Code's words (its other calls are not run); No with a note goes on with the note; Stop while it waits stops", async () => {
  const a = await job([say("", [call("bash", { command: "npm test" }, "b1"), call("bash", { command: "npm run lint" }, "b2")]), say("never")], { answers: [{ choice: "no" }] });
  assert.equal(a.r.status, "done");
  assert.deepEqual(a.ran, []);
  const msgs = a.r.messages;
  assert.equal(msgs.find((m) => m.tool_call_id === "b1").content, REJECTED);
  assert.equal(msgs.find((m) => m.tool_call_id === "b2").content, "The owner doesn't want to take this action right now. STOP what you are doing and wait for the owner to tell you how to proceed.");
  assert.ok(a.events.some((e) => e.type === "result" && e.id === "b1" && e.output === "Not run: you said no."));
  assert.ok(a.events.some((e) => e.type === "permanswer" && e.choice === "no"));
  const b = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("OK, only the linter then.")], { answers: [{ choice: "no", comment: "run the linter instead" }] });
  assert.equal(b.seen.length, 2, "it goes on");
  assert.equal(b.seen[1].messages.find((m) => m.tool_call_id === "b1").content, REJECTED_SAID + "run the linter instead");
  const c = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("never")], { answers: [{ choice: "stop" }] });
  assert.equal(c.r.status, "stopped");
});

test("CD317 Plan mode: read-only commands run; a file edit waits on a card; exit_plan_mode shows the plan; approved with Accept edits, plan mode ends and Coder starts in the same turn", async () => {
  const steps = [
    say("", [call("bash", { command: "ls src" }, "b1")]),
    say("", [call("write", { path: "notes.md", content: "x\n" }, "w1")]),
    say("", [call("exit_plan_mode", { plan: "1. Add a total() test\n2. Fix the cart" }, "x1")]),
    say("", [call("bash", { command: "npm test" }, "b2")]),
    say("Done."),
  ];
  const { r, cards, seen, ran } = await job(steps, { mode: "plan", answers: [{ choice: "no", comment: "no files yet, just plan" }, { choice: "acceptEdits" }, { choice: "yes" }] });
  assert.match(seen[0].messages[0].content, /PERMISSION MODE: Plan \(the owner's pick\)\.\nPlan mode is active\./);
  // (Offered: one of the tools Claude Code defers, named in tool search's note until loaded; tool-search.test.mjs.)
  const offered = (q) => [...q.tools.map((t) => t.function.name), ...q.messages.filter((m) => m.toolsAnnounced).flatMap((m) => m.toolsAnnounced.added)];
  assert.ok(offered(seen[0]).includes("exit_plan_mode"));
  assert.deepEqual(cards.map((c) => c.tool), ["write", "plan", "bash"], "ls ran without a card");
  assert.equal(cards[0].path, "notes.md");
  assert.equal(cards[0].why, "Plan mode is on: files change only after you approve the plan.");
  assert.deepEqual(cards[0].change.lines, ["+x"]);
  assert.equal(cards[1].plan, "1. Add a total() test\n2. Fix the cart");
  assert.deepEqual(ran, ["ls src", "npm test"]);
  const approved = seen[3].messages.find((m) => m.tool_call_id === "x1").content;
  assert.equal(approved, "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n## Approved Plan:\n1. Add a total() test\n2. Fix the cart");
  // ("## Exited Plan Mode" as its own note after the approval, before the next step, as Claude Code's plan_mode_exit.)
  assert.match(seen[3].messages.at(-1).content, /^\(Note from Coder's app, not the owner:\n## Exited Plan Mode\n\nYou have exited plan mode\. You can now make edits, run tools, and take actions\./);
  assert.ok(!seen[3].tools.some((t) => t.function.name === "exit_plan_mode"), "no way out of a mode it is not in");
  assert.match(seen[3].messages[0].content, /PERMISSION MODE: Accept edits/);
  assert.equal(r.mode, "acceptEdits");
  assert.equal(cards[2].toAuto, true);
});

test("CD318 a plan declined with what to change keeps plan mode and Coder revises it; exit_plan_mode outside plan mode is refused", async () => {
  const a = await job([say("", [call("exit_plan_mode", { plan: "1. Rewrite everything" }, "x1")]), say("", [call("exit_plan_mode", { plan: "1. Fix only the cart" }, "x2")]), say("Done.")], { mode: "plan", answers: [{ choice: "no", comment: "smaller, just the cart" }, { choice: "auto" }] });
  assert.equal(a.seen[1].messages.find((m) => m.tool_call_id === "x1").content, REJECTED_SAID + "smaller, just the cart");
  // (exit_plan_mode, one of the tools Claude Code defers, called before it was loaded: tool-search.test.mjs.)
  assert.ok(a.seen[1].messages.some((m) => m.toolsAnnounced && m.toolsAnnounced.added.includes("exit_plan_mode")), "still in plan mode");
  assert.match(a.seen[1].messages[0].content, /PERMISSION MODE: Plan/, "still in plan mode");
  assert.equal(a.r.mode, "auto");
  const b = await job([say("", [call("exit_plan_mode", { plan: "x" }, "x1")]), say("ok")], { mode: "auto" });
  assert.equal(b.seen[1].messages.find((m) => m.tool_call_id === "x1").content, "error: You are not in plan mode. To enter plan mode, call the enter_plan_mode tool first. If your plan was already approved, continue with implementation.");
});

test("CD319 the owner changes the mode while Coder works: from its next step on, with Claude Code's '## Exited Plan Mode' note", async () => {
  // Plan for the first round, then the owner picks Accept edits.
  const { seen, cards, r } = await job([say("", [call("bash", { command: "ls" }, "b1")]), say("", [call("bash", { command: "mkdir build" }, "b2")]), say("Done.")], { mode: "plan", modeOf: (n) => (n < 1 ? "plan" : "acceptEdits") });
  assert.equal(cards.length, 0, "mkdir runs without asking in Accept edits");
  const note = seen[1].messages.at(-1);
  assert.equal(note.role, "user");
  assert.match(note.content, /## Exited Plan Mode\n\nYou have exited plan mode\. You can now make edits, run tools, and take actions\.\n\nThe owner's permission mode is now Accept edits\./);
  assert.equal(r.mode, "acceptEdits");
});

test("CD320 web pages: Accept edits asks for a site that isn't pre-approved documentation (Yes, don't ask again for the domain, No); rules: deny refuses, ask asks even in Auto with only a one-time Yes", async () => {
  const a = await job([say("", [call("web_fetch", { url: "https://example.com/api", prompt: "the endpoints" }, "f1")]), say("ok")], { answers: [{ choice: "no", comment: "use the docs in the repo" }] });
  assert.deepEqual([a.cards[0].tool, a.cards[0].url, a.cards[0].rules], ["web_fetch", "https://example.com/api", ["WebFetch(domain:example.com)"]]);
  const b = await job([say("", [call("web_fetch", { url: "https://developer.mozilla.org/en-US/docs/Web/API/fetch", prompt: "x" }, "f1")]), say("ok")]);
  assert.equal(b.cards.length, 0, "pre-approved documentation");
  const c = await job([say("", [call("bash", { command: "git push origin main" }, "b1")]), say("ok")], { mode: "auto", rules: { ask: ["Bash(git push *)"] }, answers: [{ choice: "yes" }] });
  assert.equal(c.cards.length, 1);
  assert.equal(c.cards[0].rules, undefined, "an ask rule's card offers no 'don't ask again'");
  assert.equal(c.cards[0].toAuto, undefined);
  const d = await job([say("", [call("bash", { command: "rm -rf build" }, "b1")]), say("ok")], { mode: "auto", rules: { deny: ["Bash(rm -rf *)"] } });
  assert.equal(d.cards.length, 0);
  assert.equal(d.r.messages.find((m) => m.tool_call_id === "b1").content, "Permission to use Bash with command rm -rf build has been denied.");
  assert.deepEqual(d.ran, []);
});

test("CD321 a dangerous removal: in Auto, a card that blocks it by itself after 2 minutes (Claude Code 2.1.281, fix 5 of \"Yes all 7\"), refused when no one answers; asked once in Accept edits; a protected file is asked on the card in every mode, never with 'don't ask again'", async () => {
  const { RM_REFUSED, RM_TIMED_OUT } = await import("../container/coder-agent.mjs");
  const a = await job([say("", [call("bash", { command: "rm -rf /" }, "b1")]), say("ok")], { mode: "auto" });
  assert.ok(a.r.messages.find((m) => m.tool_call_id === "b1").content.startsWith(RM_REFUSED));
  assert.equal(a.cards.length, 1);
  assert.ok(a.cards[0].blockAt > 0);
  assert.equal(a.events.find((e) => e.type === "result" && e.id === "b1").output, RM_TIMED_OUT);
  assert.deepEqual(a.ran, []);
  const b = await job([say("", [call("bash", { command: "rm -rf /" }, "b1")]), say("ok")], { answers: [{ choice: "no", comment: "don't" }] });
  assert.equal(b.cards.length, 1);
  assert.match(b.cards[0].why, /^Dangerous rm operation detected/);
  assert.equal(b.cards[0].rules, undefined);
  const c = await job([say("", [call("bash", { command: "cp hook.sh .husky/pre-commit" }, "b1")]), say("ok")], { mode: "auto", answers: [{ choice: "no", comment: "leave the hooks" }] });
  assert.equal(c.cards.length, 1, "a file command writing a protected file asks in Auto too");
  assert.match(c.cards[0].why, /^Coder requested permissions to edit \S+\/\.husky\/pre-commit which is a sensitive file\.$/);
  assert.equal(c.cards[0].rules, undefined);
  const d = await job([say("", [call("write", { path: ".husky/pre-commit", content: "npm test\n" }, "w1")]), say("ok")], { mode: "auto", answers: [{ choice: "no", comment: "not now" }] });
  assert.equal(d.cards[0].tool, "write");
  assert.match(d.cards[0].why, /^\.husky\/pre-commit is a protected file/);
});

test("CD322 Coder's machine: the turn starts in the chat's mode, the owner's answer reaches the waiting step (/answer, only for the card that waits), and the mode changes while it runs (/mode)", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp } = await import("../container/server.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  const seen = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "npm --version" }, "s1")]), say("", [call("bash", { command: "npm --version" }, "s2")]), say("Done.")];
  const srv = http.createServer(createApp({ root, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { seen.push(req); return steps[Math.min(n++, 2)]; } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const state = () => fetch(base + "/state?project=shop-pm1&since=0").then((r) => r.json());
  try {
    assert.deepEqual(await post("/mode", { project: "shop-pm1", mode: "plan" }), { ok: false, notRunning: true });
    await post("/turn", { project: "shop-pm1", text: "go", messages: [], mode: "acceptEdits", rules: { allow: [] } });
    let card = null;
    for (let i = 0; i < 200 && !card; i++) { card = (await state()).events.find((e) => e.type === "permission"); if (!card) await new Promise((ok) => setTimeout(ok, 30)); }
    assert.ok(card, "the card is in the chat while the step waits");
    assert.equal(card.tool, "bash");
    assert.deepEqual(card.rules, ["Bash(npm --version)"], "no subcommand: the command as it is");
    assert.equal((await post("/answer", { project: "shop-pm1", pid: "p9zzzzzz", choice: "yes" })).ok, false, "not the card that waits");
    assert.equal((await post("/answer", { project: "shop-pm1", pid: card.pid, choice: "maybe" })).ok, false);
    assert.deepEqual(await post("/answer", { project: "shop-pm1", pid: card.pid, choice: "yes" }), { ok: true });
    // The owner picks Auto while it works: the second command runs without a card.
    assert.deepEqual(await post("/mode", { project: "shop-pm1", mode: "auto" }), { ok: true });
    assert.equal((await post("/mode", { project: "shop-pm1", mode: "bypassPermissions" })).ok, false);
    let st; for (let i = 0; i < 200; i++) { st = await state(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 30)); }
    assert.equal(st.result.status, "done");
    assert.equal(st.result.mode, "auto");
    assert.equal(st.events.filter((e) => e.type === "permission").length, 1);
    assert.ok(st.events.some((e) => e.type === "permanswer" && e.choice === "yes"));
  } finally { await post("/stop", { project: "shop-pm1" }).catch(() => {}); await new Promise((ok) => srv.close(ok)); }
});

// ── CODER'S WORKER: THE CHAT'S MODE, THE ANSWERS, THE RULES ─────────────────
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function worker({ status = "idle", result = null, events = [] } = {}) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-pm2";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status, at: Date.now(), title: "x", mode: "acceptEdits" }));
  const toMachine = [];
  let claimed = false;
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (req.method === "POST") toMachine.push({ p, body: await req.clone().json().catch(() => null) });
    if (p === "/mode") return Response.json({ ok: true });
    if (p === "/answer") { const b = await req.json(); return Response.json(b.pid === "p1abcdef" ? { ok: true } : { ok: false, why: "That card is no longer waiting for an answer." }); }
    if (p === "/state") return Response.json(!result ? { running: status === "running", events: [] } : { running: false, events, next: events.length, result });
    if (p === "/claim") { const first = !claimed; claimed = true; return Response.json({ ok: first }); }
    if (p === "/push") return Response.json({ ok: true, pushed: false });
    if (p === "/turn") return Response.json({ ok: true });
    return Response.json({ ok: true });
  } });
  const go = async (path, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box }); return { status: r.status, data: await r.json() }; };
  return { R, bucket, uid, id, mk, go, toMachine, meta: () => JSON.parse(bucket.m.get(mk)) };
}

test("CD323 the Worker: the mode menu changes the chat's mode (and its running job's, from its next step); a pick other than Plan is where new chats start; /plan before a message switches to Plan", async () => {
  const w = await worker({ status: "running" });
  assert.equal((await w.go("projects/" + w.id + "/mode", { method: "POST", body: JSON.stringify({ mode: "bypassPermissions" }) })).status, 400);
  const a = await w.go("projects/" + w.id + "/mode", { method: "POST", body: JSON.stringify({ mode: "plan" }) });
  assert.deepEqual([a.status, a.data.told, w.meta().mode], [200, true, "plan"]);
  assert.ok(w.meta().modeAt > 0);
  assert.deepEqual(w.toMachine.find((x) => x.p === "/mode").body, { project: w.id, mode: "plan" });
  assert.equal((await w.go("settings")).data.pick.mode, "auto", "Plan is for one chat only");
  await w.go("projects/" + w.id + "/mode", { method: "POST", body: JSON.stringify({ mode: "acceptEdits" }) });
  assert.equal((await w.go("settings")).data.pick.mode, "acceptEdits", "new chats start in it");
  // /plan alone: only the mode.
  const v = await worker();
  const p = await v.go("projects/" + v.id + "/message", { method: "POST", body: JSON.stringify({ text: "/plan" }) });
  assert.deepEqual([p.status, p.data.mode, v.meta().mode], [200, "plan", "plan"]);
  assert.equal(v.toMachine.filter((x) => x.p === "/turn").length, 0, "no job");
});

test("CD324 the Worker: the owner's answer reaches the step that waits (only that card, only while the job runs); each turn gets the chat's mode and the repo's rules", async () => {
  const w = await worker({ status: "running" });
  assert.deepEqual((await w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "always" }) })).data, { ok: true });
  assert.deepEqual(w.toMachine.find((x) => x.p === "/answer").body, { project: w.id, pid: "p1abcdef", choice: "always", comment: "" });
  const late = await w.go("projects/" + w.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p2zzzzzz", choice: "yes" }) });
  assert.deepEqual([late.status, late.data.error], [409, "That card is no longer waiting for an answer."]);
  const idle = await worker();
  assert.equal((await idle.go("projects/" + idle.id + "/answer", { method: "POST", body: JSON.stringify({ pid: "p1abcdef", choice: "yes" }) })).status, 409);
  // The rules for its repository, as the owner keeps them.
  await idle.R.changeRules(idle.bucket, idle.uid, "ana/shop", "allow", ["Bash(npm test *)"]);
  await idle.R.changeRules(idle.bucket, idle.uid, "ana/shop", "deny", ["Bash(git push *)"]);
  await idle.go("projects/" + idle.id + "/message", { method: "POST", body: JSON.stringify({ text: "run the tests" }) });
  const turn = idle.toMachine.find((x) => x.p === "/turn").body;
  assert.equal(turn.mode, "acceptEdits");
  assert.deepEqual(turn.rules, { allow: ["Bash(npm test *)"], ask: [], deny: ["Bash(git push *)"], dirs: [] });
});

test("CD325 the Worker keeps the rules per repository (Claude Code's /permissions: list, add, remove; a rule moves between allow, ask and deny), and saves 'don't ask again' rules and a card's mode switch when the job ends", async () => {
  const w = await worker();
  assert.equal((await w.go("permissions?repo=bad")).status, 400);
  assert.deepEqual((await w.go("permissions?repo=ana/shop")).data.rules, { allow: [], ask: [], deny: [], dirs: [] });
  assert.equal((await w.go("permissions", { method: "POST", body: JSON.stringify({ repo: "ana/shop", kind: "allow", add: "NotebookEdit" }) })).status, 400);
  await w.go("permissions", { method: "POST", body: JSON.stringify({ repo: "ana/shop", kind: "allow", add: "Bash(npm test *)" }) });
  await w.go("permissions", { method: "POST", body: JSON.stringify({ repo: "ana/shop", kind: "ask", add: "Bash(git push *)" }) });
  const moved = await w.go("permissions", { method: "POST", body: JSON.stringify({ repo: "ana/shop", kind: "deny", add: "Bash(npm test *)" }) });
  assert.deepEqual(moved.data.rules, { allow: [], ask: ["Bash(git push *)"], deny: ["Bash(npm test *)"], dirs: [] });
  const gone = await w.go("permissions", { method: "POST", body: JSON.stringify({ repo: "ana/shop", kind: "ask", remove: "Bash(git push *)" }) });
  assert.deepEqual(gone.data.rules.ask, []);
  // The job's end: the rule it added and the mode a card switched to.
  const at = Date.now() + 1000;
  const j = await worker({ status: "running", result: { status: "done", summary: "Done.", messages: [], mode: "auto", rulesAdded: ["Bash(npm run build *)"] }, events: [{ type: "permission", pid: "p1abcdef", tool: "bash" }, { type: "mode", mode: "auto", by: "card", at }] });
  await j.go("projects/" + j.id + "/state?since=0");
  assert.equal(j.meta().mode, "auto");
  assert.deepEqual((await j.R.rulesOf(j.bucket, j.uid, "ana/shop")).allow, ["Bash(npm run build *)"]);
  // A switch older than the owner's own pick is not kept.
  const k = await worker({ status: "running", result: { status: "done", summary: "Done.", messages: [], mode: "auto" }, events: [{ type: "mode", mode: "auto", by: "card", at: 5 }] });
  await k.bucket.put(k.mk, JSON.stringify({ ...k.meta(), mode: "plan", modeAt: 10 }));
  await k.go("projects/" + k.id + "/state?since=0");
  assert.equal(k.meta().mode, "plan");
});

test("CD326 a step waiting on the owner is pushed to their phone (Claude Code notifies when it needs your input)", async () => {
  const { pushesFor } = await import("../src/coder-push.mjs");
  const meta = { title: "Fix the cart" };
  assert.deepEqual(pushesFor([{ type: "permission", tool: "bash", desc: "Run the tests", lines: ["npm test"] }], meta), [{ kind: "actions", title: "Coder needs your approval · Fix the cart", body: "Run: Run the tests" }]);
  assert.deepEqual(pushesFor([{ type: "permission", tool: "plan", plan: "1. x" }], meta), [{ kind: "actions", title: "Coder's plan is ready · Fix the cart", body: "Approve it, or say what to change." }]);
  assert.equal(pushesFor([{ type: "permission", tool: "web_fetch", url: "https://example.com/a" }], meta)[0].body, "Fetch a page from example.com");
  assert.equal(pushesFor([{ type: "permission", tool: "edit", path: "src/cart.js" }], meta)[0].body, "Edit src/cart.js");
});

test("CD327 the page: the mode's chip beside the model and effort, its menu like the Claude app's (each mode's line, a check, keys 1-3, Ctrl/Cmd+Shift+M), the cards that wait with Claude Code's choices, and the rules", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(page, /\{ id: 'auto', name: 'Auto', info: 'Coder handles permission decisions', icon: 'auto' \}/);
  assert.match(page, /\{ id: 'acceptEdits', name: 'Accept edits', info: 'Automatically accept all file edits', icon: 'edits' \}/);
  assert.match(page, /\{ id: 'plan', name: 'Plan', info: 'Create a plan before making changes', icon: 'plan' \}/);
  // (Not in Gloopy's chat, which has no permission modes: merged 2026-11-13.)
  assert.match(page, /\(S\.project && !GLOOPY \? modeHTML\(\) : ''\)/, "in the box's bottom row");
  assert.match(page, /if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.shiftKey && !e\.altKey && \(e\.key === 'M' \|\| e\.key === 'm'\)\)/);
  assert.match(page, /call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/mode', \{ method: 'POST', body: JSON\.stringify\(\{ mode: m \}\) \}\)/);
  // Claude Code's choices, and the plan's.
  assert.match(page, /const o = \[\['yes', 'Yes'\]\];/);
  assert.match(page, /o\.push\(\['always', 'Yes, and don\\'t ask again for ' \+/);
  assert.match(page, /if \(e\.toAuto && !S\.autoOff\) o\.push\(\['auto', 'Yes, and switch to auto mode'\]\);/);
  assert.match(page, /o\.push\(\['no', e\.tool === 'web_fetch' \? 'No, and tell Coder what to do differently' : 'No'\]\);/);
  assert.match(page, /return \[\['auto', 'Yes, and use auto mode'\], \['acceptEdits', 'Yes, and accept edits'\], \['no', 'No, keep planning'\]\]\.filter\(\(\[c\]\) => !\(S\.autoOff && c === 'auto'\)\);/);
  assert.match(page, /call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\) \+ '\/answer', \{ method: 'POST', body: JSON\.stringify\(\{ pid, choice, comment, \.\.\.\(plan !== null \? \{ plan \} : \{\}\) \}\) \}\)/);
  assert.match(page, /else if \(e\.type === 'permission'\) out\.push\(permHTML\(e\)\);/);
  assert.match(page, /state === 'wait' \? '<span class="cd-st cd-st-wait">waiting for you<\/span>'/);
  assert.match(page, /call\('\/permissions\?repo=' \+ encodeURIComponent\(repo\)\)/);
  assert.ok(!/localStorage/.test(page.slice(page.indexOf("THE PERMISSION MODE (the owner"))), "nothing kept in the browser");
  for (const c of [".cd-mode-btn", ".cd-modes", ".cd-mode-row", ".cd-perm ", ".cd-perm-opt", ".cd-plan-body", ".cd-st-wait", ".cd-rules-add"]) assert.ok(css.includes(c + (c.endsWith(" ") ? "" : " ")) || css.includes(c + ","), c);
});
