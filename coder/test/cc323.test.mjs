// CLAUDE CODE 2.1.323'S BASH-TOOL CHANGES, COPIED INTO CODER (2026-11-13; the owner: "Yes all 7"). Each case below was
// first read in Claude Code's own program (2.1.323) and, where it says so, tried in its command-line version with Haiku.
import { test } from "node:test";
import assert from "node:assert/strict";

const P = await import("../container/coder-perms.mjs");
const B = await import("../container/coder-bashcheck.mjs");
const W = "/tmp/proj";
const decide = (command, rules = {}, mode = "acceptEdits") => P.bashDecision(command, { mode, rules: { allow: [], deny: [], ask: [], ...rules }, cwd: W, workdirs: [W], home: "/home/dev" });
const verdict = (command, rules, mode) => decide(command, rules, mode).verdict;

test("CD550 deny and ask rules catch a command run through sudo or env with settings written together (Claude Code 2.1.323: \"Fixed Bash deny and ask rules missing some commands run through sudo, env and similar wrappers\"): `sudo -nu root touch x` meets a rule on touch, as `sudo -u root touch x` did", () => {
  // (Before, `-nu` was read as a setting without a value, so `root` was taken for the program, and in Auto the command ran
  // past a deny rule on touch.)
  for (const command of ["sudo -nu root touch x", "sudo -Eu root touch x", "env -iu FOO touch x", "sudo -nu root /usr/bin/touch x", "sudo -u root touch x", "sudo -n -u root touch x"]) {
    for (const mode of ["auto", "acceptEdits", "plan"]) {
      assert.equal(verdict(command, { deny: ["Bash(touch:*)"] }, mode), "deny", command + " · " + mode);
      assert.equal(verdict(command, { deny: ["Bash(touch *)"] }, mode), "deny", command + " · " + mode);
    }
    const d = decide(command, { ask: ["Bash(touch:*)"] }, "auto");
    assert.equal(d.verdict, "ask", command);
    assert.match(String(d.why), /Bash\(touch:\*\)/);
  }
  // (After sudo, a word with = is sudo's own setting, not the program: `sudo NODE_ENV=1 touch x`.)
  assert.equal(verdict("sudo NODE_ENV=1 touch x", { deny: ["Bash(touch:*)"] }, "auto"), "deny");
  // (Nothing else changes: no rule, and Auto lets it through to its own checks.)
  assert.equal(verdict("sudo -nu root touch x", {}, "auto"), "allow");
});

test("CD551 the dangerous-delete check reads past sudo and env with settings written together too: `sudo -nu root rm -rf /` and `env -iu FOO rm -rf ~` are flagged, as `sudo -u root rm -rf /` was", () => {
  const opts = { cwd: W, home: "/home/dev", workdirs: [W] };
  for (const [command, target] of [["sudo -nu root rm -rf /", "/"], ["env -iu FOO rm -rf ~", "~"], ["sudo -Eu root rm -rf /etc", "/etc"], ["sudo -u root rm -rf /", "/"]])
    assert.match(B.dangerousRm(command, opts), new RegExp("^Dangerous rm operation detected: '" + target.replace(/[/~]/g, "\\$&") + "'"), command);
  assert.equal(B.dangerousRm("sudo -nu root rm -rf /tmp/proj/build", opts), "");
});

test("CD552 an allow rule whose * is joined to the program's name doesn't stretch that name into a setting (Claude Code 2.1.323: \"Fixed Bash allow rules with an attached wildcard, such as Bash(ls*), skipping the permission prompt in some cases; a rule that names a variable, such as Bash(NODE_ENV*), now asks\"; and \"Fixed Bash allow rules written with combined sudo flags skipping the permission prompt in some cases\")", () => {
  // The rule, the command, and what Claude Code 2.1.323 did with it: the first nine tried in its command-line version
  // (Haiku, one rule per run, 2026-11-13), the rest read in its program (its `qpr`).
  const cases = [
    ["Bash(NODE_ENV=prod node -e 0)", "NODE_ENV=prod node -e 0", "allow"],
    ["Bash(NODE_ENV=prod node *)", "NODE_ENV=prod node -e 0", "allow"],
    ["Bash(node*)", "NODE_ENV=prod node -e 0", "allow"],
    ["Bash(FOO*)", "NODE_ENV=prod node -e 0", "ask"],
    ["Bash(NODE*)", "NODE_ENV=prod node -e 0", "ask"],
    ["Bash(NODE_ENV=*)", "NODE_ENV=prod node -e 0", "allow"],
    ["Bash(nod*)", "NODE_ENV=prod node -e 0", "allow"],
    ["Bash(NODE_ENV=prod*)", "NODE_ENV=prod node -e 0", "allow"],
    ["Bash(NODE_ENV*)", "NODE_ENV=prod node -e 0", "ask"],
    ["Bash(NODE_ENV*)", "NODE_ENV=1 touch x", "ask"],
    ["Bash(FOO*)", "FOO=1 node -e 0", "ask"],
    ["Bash(ls*)", "ls=1 touch x", "ask"],
    ["Bash(sudo NODE_ENV*)", "sudo NODE_ENV=1 touch x", "ask"],
    ["Bash(sudo -Eu root NODE_ENV*)", "sudo -Eu root NODE_ENV=1 touch x", "ask"],
    // (Letters, digits, a dash, a dot or a slash after it are the same word: still approved.)
    ["Bash(ls*)", "ls -la", "allow"],
    ["Bash(ls*)", "lsof -v", "allow"],
    ["Bash(ls*)", "lsblk", "allow"],
    ["Bash(git*)", "git-lfs version", "allow"],
    ["Bash(./run*)", "./run.sh --x", "allow"],
    ["Bash(make *)", "make build", "allow"],
  ];
  for (const [rule, command, want] of cases) assert.equal(verdict(command, { allow: [rule] }), want, rule + " · " + command);
  // (The check itself, for a rule's text and one form of a command.)
  assert.equal(P.starStretchesProgram("NODE_ENV*", "NODE_ENV=1 touch x"), true);
  assert.equal(P.starStretchesProgram("NODE_ENV=*", "NODE_ENV=1 touch x"), false);
  assert.equal(P.starStretchesProgram("ls *", "ls=1 touch x"), false);
  assert.equal(P.starStretchesProgram("ls*", "lsof -i"), false);
  assert.equal(P.starStretchesProgram("ls*", "ls$IFS-la"), true);
});

test("CD553 a Bash allow rule with a * in a variable's value gets Claude Code 2.1.323's warning (\"Added a start-up warning for Bash allow rules with a * in a variable's value, such as Bash(PORT=* npm run dev)\"), in its words, before the wildcard-before-the-command one", () => {
  assert.deepEqual(P.ruleWarning("allow", "Bash(PORT=* npm run dev)"), {
    warning: "Bash(PORT=* npm run dev) has a * in a variable's value. A * also matches spaces, so this rule can also approve a different command that has npm later in the line, without a prompt. Give the variable an exact value instead.",
    notice: "Allow rule Bash(PORT=* npm run dev) allows any command at the * in its value · use an exact value",
  });
  assert.match(P.ruleWarning("allow", "Bash(A=1 B=* make *)").warning, /has make later in the line/);
  // (Its word is the start of the next one, up to a *: `Bash(PORT=* np*)` names "np".)
  assert.match(P.ruleWarning("allow", "Bash(PORT=* np* run)").warning, / has np later in the line/);
  // (None: an operator or a redirection after the settings, no word after them, a * only after the program, a :* rule, or
  // a deny or ask rule.)
  for (const r of ["Bash(PORT=* | cat)", "Bash(PORT=* > x)", "Bash(PORT=*)", "Bash(PORT=* *)", "Bash(PORT=3000 npm *)"]) assert.equal(P.ruleWarning("allow", r), null, r);
  // (A rule ending in :* gets the older warning about mixing * with :*, as in Claude Code.)
  assert.match(P.ruleWarning("allow", "Bash(PORT=*:*)").warning, /mixes \* with the trailing :\* prefix syntax/);
  for (const k of ["deny", "ask"]) assert.equal(P.ruleWarning(k, "Bash(PORT=* npm run dev)"), null);
  // (The older warning stays for its own rules.)
  assert.match(P.ruleWarning("allow", "Bash(git * main)").warning, /has a wildcard before the rest of the command/);
});

// ── FIX 4: WRITES INTO PROTECTED FILES FROM A COMMAND ─────────────────────────────────────────────────────────────────
const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const { fakeParse, parseOf, pipeline, cmdAst, str } = await import("./ps-fake.mjs");
/** Coder's loop on a pretend machine: each step one call; `answer` for every card. */
async function loop(calls, { mode = "acceptEdits", rules = {}, answer = "yes", powershell = false, parse = fakeParse } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], cards = [], ran = [];
  let n = 0;
  const steps = [...calls.map((c, k) => say("", [call(c.ps ? "powershell" : "bash", { command: c.ps || c.sh, ...(c.ps ? { description: "Run" } : {}) }, "c" + k)])), say("Done.")];
  await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { if (/coder-tools\.mjs/.test(String(x.command))) return { code: 0, output: "" }; if (!/^__s=/.test(String(x.command))) ran.push(x.shown || x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-cc323",
    where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p.replace(/^\.\//, "")),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: answer }; },
    psParse: async (cmd) => parse(cmd),
  }, { text: "go", mode, rules: { allow: [], ask: [], deny: [], ...rules }, ...(powershell ? { powershell: { bypass: true } } : {}) });
  return { cards, ran };
}

test("CD554 a bash command that writes into .git, .claude or another protected place asks every time, as Claude Code 2.1.323 does (\"Fixed Bash permission prompts offering \\\"don't ask again\\\" for commands that write to sensitive paths such as .git or .claude, where the saved rule did not stop the next prompt\"): only a one-time Yes, and no rule of the owner's passes it", async () => {
  for (const [sh, why] of [
    ["echo x > .git/config", "Coder requested permissions to edit /work/shop/.git/config which is a sensitive file."],
    ["echo x >> .claude/notes.md", "Coder requested permissions to edit /work/shop/.claude/notes.md which is a sensitive file."],
    // (Claude Code's own other words for its settings file, tried with Haiku: "Claude requested permissions to write to
    // /tmp/cc-danger/work/.claude/settings.json, but you haven't granted it yet.")
    ["echo '{}' >> .claude/settings.json", "Coder requested permissions to write to /work/shop/.claude/settings.json, but you haven't granted it yet."],
    ["touch .claude/settings.local.json", "Coder requested permissions to write to /work/shop/.claude/settings.local.json, but you haven't granted it yet."],
    ["echo x | tee .husky/pre-commit", "Coder requested permissions to edit /work/shop/.husky/pre-commit which is a sensitive file."],
    ["cp a .git/hooks/pre-commit", "Coder requested permissions to edit /work/shop/.git/hooks/pre-commit which is a sensitive file."],
  ]) {
    for (const mode of ["acceptEdits", "auto", "plan"]) {
      const r = await loop([{ sh }], { mode, answer: "no" });
      assert.equal(r.cards.length, 1, sh + " · " + mode);
      assert.equal(r.cards[0].why, why, sh);
      assert.equal(r.cards[0].rules, undefined, "no \"don't ask again\": " + sh);
      assert.equal(r.cards[0].toAuto, undefined);
      assert.deepEqual(r.ran, [], "No: nothing ran");
    }
  }
  // No rule passes it: an Edit rule for the file, the command's own exact rule, or a wide Bash rule (Claude Code: tried with
  // the first two, "Claude requested permissions to edit /tmp/cc-danger/work/.git/config which is a sensitive file." each time).
  for (const allow of [["Edit(.git/**)"], ["Edit(/work/shop/.git/config)"], ["Bash(echo x > .git/config)"], ["Bash(echo *)"]]) {
    const r = await loop([{ sh: "echo x > .git/config" }], { rules: { allow }, answer: "no" });
    assert.equal(r.cards.length, 1, JSON.stringify(allow));
    assert.deepEqual(r.ran, []);
  }
  // A second time in the same job asks again, whatever was answered the first time.
  const twice = await loop([{ sh: "echo x > .git/config" }, { sh: "echo x > .git/config" }], { answer: "always" });
  assert.equal(twice.cards.length, 2);
  assert.equal(twice.ran.length, 2, "each Yes ran it once");
});

test("CD555 a PowerShell command that writes a protected file asks first in every mode too (Claude Code: in Accept edits Set-Content, Add-Content, Clear-Content and Remove-Item run on in-scope paths, \"The same scope and protected-path rules apply\"): Coder had let `Add-Content .bashrc x` run unasked", async () => {
  const sens = (p) => "Coder requested permissions to edit /work/shop/" + p + " which is a sensitive file.";
  for (const [ps, why] of [
    ["Add-Content .bashrc x", sens(".bashrc")],
    ["Remove-Item .husky/pre-commit", sens(".husky/pre-commit")],
    ["Set-Content -Path .claude/settings.json -Value x", "Coder requested permissions to write to /work/shop/.claude/settings.json, but you haven't granted it yet."],
    ["Set-Content -LiteralPath '.claude/notes.md' -Value x", sens(".claude/notes.md")],
    ["Copy-Item x.txt -Destination .husky/pre-commit", sens(".husky/pre-commit")],
    ["Move-Item .bashrc old.txt", sens(".bashrc")],
    ["Rename-Item notes.txt .bashrc", sens(".bashrc")],
    ["New-Item -Path . -Name .envrc -ItemType File", sens(".envrc")],
    ["New-Item -ItemType Directory .vscode", sens(".vscode")],
    ["Out-File -FilePath .npmrc -InputObject x", sens(".npmrc")],
    ["Invoke-WebRequest https://example.com/x -OutFile .mcp.json", sens(".mcp.json")],
    ["Remove-Item .git/hooks/pre-commit", sens(".git/hooks/pre-commit")],
    // (A write into .git by Set-Content keeps Claude Code's own question for it.)
    ["Set-Content .git/config x", "Command writes to .git/ — hooks or config planted there execute on the next git operation."],
  ]) {
    const r = await loop([{ ps }], { powershell: true, answer: "no" });
    assert.equal(r.cards.length, 1, ps);
    assert.equal(r.cards[0].why, why, ps);
    assert.equal(r.cards[0].rules, undefined, "no \"don't ask again\": " + ps);
    assert.deepEqual(r.ran, [], ps);
  }
  // A redirection into one (the machine's real parser gives it; built by hand here).
  const redirected = (cmd) => parseOf(cmd, [pipeline(cmd, [{ ...cmdAst(cmd, str("Write-Output"), str("x")), redirections: [{ type: "FileRedirectionAst", append: true, fromStream: "Output", locationText: ".zshrc" }] }])]);
  const rr = await loop([{ ps: "Write-Output x >> .zshrc" }], { powershell: true, answer: "no", parse: redirected });
  assert.equal(rr.cards.length, 1);
  assert.equal(rr.cards[0].why, sens(".zshrc"));
  // No rule passes it.
  for (const allow of [["PowerShell(Add-Content *)"], ["PowerShell(Add-Content .bashrc x)"], ["Edit(.bashrc)"]]) {
    const r = await loop([{ ps: "Add-Content .bashrc x" }], { powershell: true, rules: { allow }, answer: "no" });
    assert.equal(r.cards.length, 1, JSON.stringify(allow));
  }
  // Reading one, or writing its name as text, is no write to it: these run in Accept edits as before.
  for (const ps of ["Get-Content .bashrc", "Set-Content notes.txt -Value .bashrc", "Add-Content log.txt .bashrc", "Set-Content ./notes.txt x"]) {
    const r = await loop([{ ps }], { powershell: true });
    assert.equal(r.cards.length, 0, ps);
    assert.equal(r.ran.length, 1, ps);
  }
});

test("CD556 what each writing cmdlet changes (psWriteTargets): its path settings and unnamed words, not Copy-Item's source or the text Set-Content writes; New-Item's -Name and Rename-Item's new name in their folder", async () => {
  const { psWriteTargets, psCommands } = await import("../container/coder-psparse.mjs");
  const t = (cmd) => psWriteTargets(psCommands(fakeParse(cmd))[0]);
  assert.deepEqual(t("Set-Content a.txt hello"), ["a.txt"]);
  assert.deepEqual(t("Set-Content -Encoding utf8 -Path a.txt -Value hello"), ["a.txt"]);
  assert.deepEqual(t("Add-Content -Path a.txt hello"), ["a.txt"]);
  assert.deepEqual(t("Remove-Item -Force a b"), ["a", "b"]);
  assert.deepEqual(t("Copy-Item src.txt dst.txt"), ["dst.txt"]);
  assert.deepEqual(t("Copy-Item -Path src.txt -Destination dst.txt"), ["dst.txt"]);
  assert.deepEqual(t("Move-Item a b"), ["a", "b"]);
  assert.deepEqual(t("Rename-Item src/a.txt b.txt"), ["src/a.txt", "src/b.txt"]);
  assert.deepEqual(t("Rename-Item -Path a.txt -NewName .bashrc"), ["a.txt", "./.bashrc"]);
  assert.deepEqual(t("New-Item -Path cfg -Name .npmrc"), ["cfg", "cfg/.npmrc"]);
  assert.deepEqual(t("Expand-Archive a.zip out"), ["out"]);
  assert.deepEqual(t("Invoke-WebRequest https://example.com -OutFile f.bin"), ["f.bin"]);
  assert.deepEqual(t("Get-Content a.txt"), []);
});

// ── FIX 5: AUTO'S 2-MINUTE QUESTION FOR A DANGEROUS REMOVAL ───────────────────────────────────────────────────────────
test("CD557 in Auto a dangerous removal is asked about on a card that blocks it by itself after 2 minutes (Claude Code 2.1.281: \"wait 2 minutes for an answer, then deny the command with a rewrite hint so unattended sessions keep going\"); after 3 such cards in a row that no one answered, none is shown (\"already gone unanswered 3 times in this session, so it was not shown again\"); an answer starts the count again", async () => {
  const A = await import("../container/coder-agent.mjs");
  const C = await import("../container/coder-checker.mjs");
  const WHY = "Dangerous rm operation detected: '~'";
  /** A job in `mode` on a pretend machine whose clock the card's wait moves on; `answer` null: no one answers. */
  async function rmJob(key, answer, { mode = "auto", github = false, rmChecksOff = null, command = "rm -rf ~" } = {}) {
    const events = [], cards = [], ran = [], asks = [];
    let n = 0, clock = 5_000_000;
    const steps = [say("", [call("bash", { command }, "b1")]), say("ok")];
    const r = await A.runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => { if (/coder-tools\.mjs|--porcelain=v1/.test(String(x.command))) return { code: 0, output: "" }; ran.push(x.command); return { code: 0, output: "ok\n" }; },
      emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-rm",
      where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), now: () => clock,
      ...(github ? {} : { ask: async (pid, o) => { asks.push(o); cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); if (answer === null) { clock = o.until + 1; return null; } return { choice: answer }; } }),
    }, { text: "go", mode, github, rules: { allow: [], ask: [], deny: [] }, checkWhere: { key, repo: "ana/shop", branch: "coder/shop-1" }, ...(rmChecksOff ? { rmChecksOff } : {}) });
    const told = r.messages.find((m) => m.role === "tool" && m.tool_call_id === "b1");
    return { events, cards, ran, asks, told: told ? told.content : "", start: 5_000_000 };
  }
  const key = "chat-rm-" + Math.random().toString(36).slice(2);
  // No answer: the card waits 2 minutes (its own time limit, given to the machine's wait), then the removal is blocked and
  // Coder goes on; Grok gets Claude Code's words.
  const t1 = await rmJob(key, null);
  assert.equal(t1.cards.length, 1);
  assert.equal(t1.cards[0].blockAt, t1.start + 120_000);
  assert.equal(t1.asks[0].until, t1.start + 120_000);
  assert.equal(t1.cards[0].rules, undefined, "only Yes and No");
  assert.deepEqual(t1.ran, []);
  assert.equal(t1.events.find((e) => e.type === "result" && e.id === "b1").output, "Not run: no answer within 2 minutes, so Coder blocked it.");
  assert.ok(t1.told.startsWith("Permission for this command was denied by a built-in Coder safety check, not by the owner. "));
  assert.match(t1.told, /Only a person may approve such a removal, and no person did \(the permission prompt timed out, or none was shown\)\. The command was NOT run;/);
  assert.match(t1.told, /What was flagged: Dangerous rm operation detected: '~'/);
  assert.doesNotMatch(t1.told, /already gone unanswered/);
  assert.equal(C.checkerState(key).rmUnanswered, 1);
  // Two more unanswered: 3 in a row. The next is not shown at all.
  await rmJob(key, null); await rmJob(key, null);
  assert.equal(C.checkerState(key).rmUnanswered, 3);
  const t4 = await rmJob(key, null);
  assert.equal(t4.cards.length, 0);
  assert.deepEqual(t4.ran, []);
  assert.equal(t4.told, A.rmDenied(t4.told.slice(t4.told.indexOf("What was flagged: ") + 18), 3));
  assert.match(t4.told, /no person did \(the permission prompt timed out, or none was shown\)\. The prompt for such removals has already gone unanswered 3 times in this session, so it was not shown again\. The command was NOT run;/);
  // An answer, No or Yes, starts the count again; Yes runs it.
  const k2 = "chat-rm-" + Math.random().toString(36).slice(2);
  await rmJob(k2, null); await rmJob(k2, null);
  const no = await rmJob(k2, "no");
  assert.equal(no.cards.length, 1);
  assert.deepEqual(no.ran, []);
  assert.equal(C.checkerState(k2).rmUnanswered, 0);
  const yes = await rmJob(k2, "yes");
  assert.deepEqual(yes.ran, ["rm -rf ~"]);
  assert.equal(C.checkerState(k2).rmUnanswered, 0);
  // Where no one can answer (a job from GitHub): refused at once, no card, no count in the words.
  const g = await rmJob("chat-rm-gh-" + Math.random(), null, { github: true });
  assert.equal(g.cards.length, 0);
  assert.match(g.told, /no person did \(the permission prompt timed out, or none was shown\)\. The command was NOT run;/);
  // The environment's CODER_DISABLE_DANGEROUS_RM_TIMEOUT turns the card off (Claude Code's
  // CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT); with no checker to decide, refused.
  const off = await rmJob("chat-rm-off-" + Math.random(), null, { rmChecksOff: { timeout: true } });
  assert.equal(off.cards.length, 0);
  assert.match(off.told, /Dangerous rm operation detected/);
  // Accept edits asks as before, with no time limit; and Plan where the checker reviews commands, as Auto.
  const ae = await rmJob("chat-rm-ae-" + Math.random(), "no", { mode: "acceptEdits" });
  assert.equal(ae.cards.length, 1);
  assert.equal(ae.cards[0].blockAt, undefined);
  assert.match(ae.cards[0].why, new RegExp("^" + WHY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // The page: Claude Code's line, counting down, under the card's reason; "Blocked" once no one answered in time.
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /'⚠ Coder will automatically block this request in ' \+ m \+ ':' \+ String\(sec\)\.padStart\(2, '0'\) \+ ', to avoid holding up an unattended session'/);
  assert.match(page, /if \(c === 'none' && Number\(e\.blockAt\) > 0\) return '<span class="cd-perm-no">✕ Blocked<\/span> · no answer within 2 minutes';/);
  assert.match(readFileSync(new URL("../public/coder.css", import.meta.url), "utf8"), /\.cd-perm-timer \{/);
  const blockLeft = new Function("return " + page.slice(page.indexOf("function blockLeft(at)"), page.indexOf("\n  }\n", page.indexOf("function blockLeft(at)")) + 4))();
  assert.equal(blockLeft(Date.now() + 119_400), "⚠ Coder will automatically block this request in 1:59, to avoid holding up an unattended session");
  assert.equal(blockLeft(Date.now() - 5), "⚠ Coder will automatically block this request in 0:00, to avoid holding up an unattended session");
});

// ── FIX 6: CLAUDE CODE'S CLAUDE_CODE_STRICT_INLINE_SHELL_RM_PROMPT ────────────────────────────────────────────────────
test("CD558 -c scripts and eval text that can't be read before they run, with no rm in them: not flagged by the rm check, as Claude Code 2.1.323 did with these 11 commands both with and without its CLAUDE_CODE_STRICT_INLINE_SHELL_RM_PROMPT (tried with Haiku, 2026-11-13; each ran)", () => {
  const o = { cwd: "/tmp/cc-danger/work", home: "/tmp/cc-danger/home", workdirs: ["/tmp/cc-danger/work"] };
  for (const c of [
    'bash -c "$CMD"', "sh -c \"$1\" _ 'echo hi'", "bash -c \"$(printf 'echo hi')\"", 'eval "$X"',
    "bash -c '$P -rf /tmp/cc-danger/work/zz'", "sh -c '\"$0\" -rf /tmp/cc-danger/work/zz' echo",
    "bash -c \"$(printf 'ec%s' ho) -rf /tmp/cc-danger/work/zz\"", "bash -c 'for f in x1 x2; do $CMD \"$f\"; done'",
    "bash -c 'f() { $CMD x1; }; f'", "bash -c 'P=$(printf ec%s ho); $P -rf /tmp/cc-danger/work/zz'", "bash -c 'read -r P <<< echo; $P -rf /tmp/cc-danger/work/zz'",
  ]) assert.equal(B.dangerousRm(c, o), "", c);
  // (One that runs rm on a target known only when it runs is still flagged, as in Claude Code.)
  assert.match(B.dangerousRm('bash -c "rm -rf $DIR"', o), /^Dangerous rm operation in a shell -c script/);
});

// ── FIX 7: NO COMMAND WITHOUT THE ADMIN SANDBOX WHEN IT SHOULD BE ON ──────────────────────────────────────────────────
test("CD559 on a machine made for Coder's admin sandbox, when the sandbox can't start, no command runs outside it: the AI's commands and the owner's ! commands are refused in Claude Code's words for its strict sandbox mode, and the chat says why (live test, 2026-11-12: after a full wipe inside the sandbox, Coder ran the next commands outside it without a word)", async () => {
  const A = await import("../container/coder-agent.mjs");
  const S = await import("../container/server.mjs");
  const http = (await import("node:http")).default;
  const { mkdtemp } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = (n) => mkdtemp(join(tmpdir(), "coder-cc323-" + n + "-"));
  /** One message on Coder's real machine service; `sandbox`: made for one (with a kept disk); `shell`: the owner's ! command. */
  async function message(sandbox, { shell = "", setup = "" } = {}) {
    const r = { root: await dir("root"), gitRoot: await dir("git"), memRoot: await dir("mem"), bgRoot: await dir("bg"), home: await dir("home") };
    const project = "cc323-box-" + Math.random().toString(36).slice(2, 8);
    let n = 0;
    const seen = [];
    const steps = [say("", [call("bash", { command: "touch ran-by-coder.txt", description: "Make a file" }, "b1")]), say("Done.")];
    const app = S.createApp({ ...r, ...(sandbox ? { sandbox: true, data: await dir("data") } : {}), send: async (req) => { seen.push(req); return shell ? say("ok") : steps[Math.min(n++, steps.length - 1)]; } });
    const srv = http.createServer(app);
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    const base = "http://127.0.0.1:" + srv.address().port;
    try {
      const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: shell ? "" : "make the file", ...(shell ? { shell } : {}), ...(setup ? { setup: { script: setup } } : {}), messages: [], mode: "auto" }) });
      assert.equal(sent.status, 200);
      let st;
      for (let i = 0; i < 400; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
      assert.ok(st && st.result, "the message ended");
      return { events: st.events || [], dir: join(r.root, project), seen };
    } finally { srv.close(); }
  }
  // (In this test no sealed network room is made, so the sandbox, which runs in one, can't start.)
  const why = "the sealed network room it runs in could not be set up";
  const down = await message(true, { setup: "touch ran-by-setup.txt" });
  assert.ok(down.events.some((e) => e.type === "error" && e.text === A.boxDownShown(why)), "the chat says why");
  assert.equal(A.boxDownShown(why), "Coder's admin sandbox could not start on this chat's machine (the sealed network room it runs in could not be set up), so no command runs in this chat until it does. Send another message to try again; if it keeps failing, start a new chat.");
  const res = down.events.find((e) => e.type === "result" && e.id === "b1");
  assert.equal(res.output, A.boxDownTold(why));
  assert.match(res.output, /^The command did not run\. Coder's admin sandbox is on, so no command may run outside the sandbox, and the sandbox failed to start in this session \(the sealed network room it runs in could not be set up\)\. The owner can send another message to try starting the sandbox again, or start a new chat\. Changing the sandbox is for the owner to decide, not you\. So is running this command, or one that does the same, through another tool or program\.$/);
  assert.equal(existsSync(join(down.dir, "ran-by-coder.txt")), false, "not run");
  // (Nor the environment's setup script, which runs in the sandbox: said, and Coder is not told a setup failed.)
  assert.ok(down.events.some((e) => e.type === "note" && e.text === "Setup: not run, because Coder's admin sandbox could not start on this chat's machine."));
  assert.equal(existsSync(join(down.dir, "ran-by-setup.txt")), false);
  // The owner's own ! command: not run either. Its step says "not run" in the owner's words, not "exit -1" with the words
  // meant for the AI (live test, 2026-11-13); the AI, which answers it, is told why in the command's output.
  const own = await message(true, { shell: "touch ran-by-owner.txt" });
  const ownRes = own.events.find((e) => e.type === "result" && /^own/.test(String(e.id)));
  assert.ok(ownRes, JSON.stringify(own.events));
  assert.equal(ownRes.ran, false);
  assert.equal(ownRes.output, A.BOX_DOWN_OWN);
  assert.equal(A.BOX_DOWN_OWN, "Not run: Coder's admin sandbox could not start on this chat's machine.");
  assert.ok(own.events.some((e) => e.type === "error" && e.text === A.boxDownShown(why)), "the chat says why");
  const toAi = JSON.stringify((own.seen[0] || {}).messages || []);
  assert.ok(toAi.includes(JSON.stringify("<bash-input>touch ran-by-owner.txt</bash-input>")), toAi.slice(-600));
  assert.ok(toAi.includes(JSON.stringify("<bash-stdout>" + A.boxDownTold(why) + "</bash-stdout><bash-stderr></bash-stderr>")), toAi.slice(-900));
  assert.equal(existsSync(join(own.dir, "ran-by-owner.txt")), false);
  // A machine not made for one (this computer, the tests): commands run as before.
  const plain = await message(false);
  assert.equal(plain.events.some((e) => e.type === "error" && /admin sandbox/.test(String(e.text))), false);
  assert.equal(existsSync(join(plain.dir, "ran-by-coder.txt")), true, "run");
});
