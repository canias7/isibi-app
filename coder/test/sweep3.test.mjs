// SWEEP 3 (2026-11-14, round 3): Coder's copied texts against Claude Code 2.1.325's raw program (/opt/claude-code/bin/claude),
// each read in its bytes, blank lines kept, with Coder's swaps ("the owner", "chat", "Coder", Coder's tool names). One test per
// file changed, each pinning the new text exactly.
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = "/work/shop";
const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const NEEDS = " This requires explicit approval and cannot be auto-allowed by permission rules.";

test("SW1 coder-checks.mjs: a read-back cut has a blank line before \"... [N lines truncated] ...\"; a control character is refused as Claude Code's schema refuses it (an input error, zod's issue as JSON), for bash, powershell and monitor alike", async () => {
  const K = await import("../container/coder-checks.mjs");
  const out = Array.from({ length: 10 }, (_, i) => "line " + i).join("\n");
  assert.equal(K.bashResultText({ output: out, readBack: 20 }), "line 0\nline 1\nline 2\n\n... [8 lines truncated] ...");
  const refused = "error: InputValidationError: [\n  {\n    \"code\": \"custom\",\n    \"path\": [\n      \"command\"\n    ],\n    \"message\": \"command contains control characters that would be hidden in the approval dialog\"\n  }\n]";
  assert.equal(K.CONTROL_MESSAGE, "command contains control characters that would be hidden in the approval dialog");
  assert.equal(K.CONTROL_REFUSED, refused);
  assert.equal(K.commandProblem("echo a\u0007b"), refused);
  assert.equal(K.commandProblem("Write-Output \"a\u001bb\"", { powershell: true }), refused);
  // A hook's rewrite with one: Claude Code's "… failed schema validation: <zod's issue> / The tool input from the model was valid; …".
  const { checkHookInput } = await import("../container/coder-hookcheck.mjs");
  const r = await checkHookInput({ name: "bash", tool: "Bash", input: { command: "echo a\u0007b" }, params: { type: "object", properties: { command: { type: "string" } }, required: ["command"] }, check: (a) => { const bad = K.commandProblem(a.command); return bad ? { error: bad } : { args: a }; } });
  assert.deepEqual(r, { ok: false, message: "PreToolUse hook for Bash returned updatedInput that failed schema validation: " + refused.slice("error: InputValidationError: ".length) + "\nThe tool input from the model was valid; the hook's rewrite of it was not." });
});

test("SW2 coder-bashcheck.mjs: Claude Code 2.1.325's words for a variable target (the command from rm on, what the variable is set from, its advice), a backslash, a top-level name and a mounted drive, and \"rmdir\" for an rmdir", async () => {
  const { dangerousRm, shownWords } = await import("../container/coder-bashcheck.mjs");
  const ctx = { cwd: "/work/proj", home: "/home/dev", workdirs: ["/work/proj"] };
  const rm = (c) => dangerousRm(c, ctx);
  // A variable set from a folder (Claude Code's jRe, its derived case).
  const derived = (inv, name, value, becomes) => "Dangerous rm operation detected in `" + inv + "`. This command sets $" + name + " from `" + value + "`, which " + becomes + ", so this rm can remove that directory. A `${" + name + ":?}` guard does not help, because $" + name + " is not empty." + NEEDS + "\n\nUse a literal absolute path instead.";
  assert.equal(rm("D=$(pwd); rm -rf \"$D\""), derived("rm -rf \"$D\"", "D", "$(pwd)", "prints the current directory"));
  assert.equal(rm("D=$(git rev-parse --show-toplevel) && rm -rf \"$D\"/*"), derived("rm -rf \"$D\"/*", "D", "$(git rev-parse --show-toplevel)", "prints a git value such as the repository root"));
  assert.equal(rm("D=$(dirname \"$0\"); rm -rf $D"), derived("rm -rf $D", "D", "$(dirname \"$0\")", "prints the current directory (as `.`) when its input is empty"));
  assert.equal(rm("D=$(cd \"$1\" && pwd); rm -rf \"$D\""), derived("rm -rf \"$D\"", "D", "$(cd \"$1\" && pwd)", "prints the current directory when its input is empty (`cd \"\"` stays put)"));
  assert.equal(rm("D=$PWD; E=$D; rm -rf \"$E\""), derived("rm -rf \"$E\"", "E", "$PWD", "is the current directory"), "a copy: what its source was set from");
  // A variable that may be empty (its jRe, with each kind of advice).
  const variable = (inv, target, vars, hint, where = "") => "Dangerous rm operation detected in `" + inv + "`" + where + ". The target '" + target + "' is a shell variable expansion: when " + vars + " is unset or empty it becomes `/`, `/*` or a top-level path." + NEEDS + "\n\nThis check does not fire on a target that cannot expand to the filesystem root: " + hint + ".";
  assert.equal(rm("rm -rf \"$DIR\"/*"), variable("rm -rf \"$DIR\"/*", "\"$DIR\"/*", "$DIR", "rewrite it as `\"${DIR:?}\"/*`, which makes the shell stop with an error instead of running rm when $DIR is unset or empty, or use a literal absolute path"));
  assert.equal(rm("rm -rf ${X}/*"), variable("rm -rf ${X}/*", "${X}/*", "$X", "rewrite it as `\"${X:?}\"/*`, which makes the shell stop with an error instead of running rm when $X is unset or empty, or use a literal absolute path"));
  assert.equal(rm("rm -rf $1/"), variable("rm -rf $1/", "$1/", "$1", "bind $1 (in an inline `sh -c` script, single-quote the script so this shell does not expand the positional) or use a literal absolute path"));
  assert.equal(rm("rm -rf $HOME/*"), variable("rm -rf $HOME/*", "$HOME/*", "$HOME", "use a literal absolute path: $HOME is normally set, so a guard on it would not stop this rm"));
  assert.equal(rm("echo $(rm -rf \"$X\"/*)"), variable("rm -rf \"$X\"/*", "\"$X\"/*", "$X", "rewrite it as `\"${X:?}\"/*`, which makes the shell stop with an error instead of running rm when $X is unset or empty, or use a literal absolute path", " (inside a command substitution)"));
  assert.equal(rm("rmdir $X/"), variable("rmdir $X/", "$X/", "$X", "rewrite it as `\"${X:?}\"/`, which makes the shell stop with an error instead of running rmdir when $X is unset or empty, or use a literal absolute path").replace("Dangerous rm operation", "Dangerous rmdir operation"));
  // A long command: its first 120 characters and "…", then the target when it was cut off.
  const long = "rm -rf " + "a".repeat(130) + " \"$X\"/*";
  assert.ok(rm(long).startsWith("Dangerous rm operation detected in `" + long.slice(0, 120) + "\u2026 \"$X\"/*`. The target '\"$X\"/*' is"));
  const long2 = "rm -rf \"$X\"/* " + "b".repeat(130);
  assert.ok(rm(long2).startsWith("Dangerous rm operation detected in `" + long2.slice(0, 120) + "\u2026`. The target '\"$X\"/*' is"));
  assert.equal(shownWords("rm -rf $(pwd)/x \"$(pwd)\" `id`"), "rm -rf $(\u2026)/x \"$(pwd)\" $(\u2026)", "unquoted substitutions as $(…), quoted ones as written");
  // A backslash, a top-level name after an expansion, a mounted drive: each with its paragraph of advice.
  assert.equal(rm("rm -rf \\\\"), "Dangerous rm operation detected: '\\\\'\n\nA backslash-only target is the drive root in Git Bash on Windows." + NEEDS + "\n\nWrite the directory you mean as a path, for example /c/work/build or C:/work/build.");
  assert.equal(rm("rm -rf \"$TMPDIR/mnt\""), "Dangerous rm operation detected: '\"$TMPDIR/mnt\"'\n\nThe target starts with a shell expansion this check cannot read and ends in a top-level directory name: if the expansion is empty, this removes '/mnt'." + NEEDS + "\n\nUse a literal absolute path instead.");
  assert.equal(rm("rm -rf /mnt/c/*"), "Dangerous rm operation detected: '/mnt/c/*'\n\nThis command would remove a mounted drive, the folder that holds mounted drives, or a file or folder at the top level of a drive." + NEEDS + "\n\nIf you meant something deeper inside, name it by its full path.");
  assert.equal(rm("rmdir /usr"), "Dangerous rmdir operation detected: '/usr'\n\nThis command would remove a critical system directory." + NEEDS);
  // Unchanged: a guarded variable, and a folder inside a variable set from one.
  assert.equal(rm("rm -rf \"${DIR:?}\"/*"), "");
  assert.equal(rm("D=$(pwd); rm -rf \"$D/dist\""), "");
});

test("SW3 coder-shell.mjs: commands inside $( ), `…`, <( ) and ${…$( )…} are marked inSubst; a subshell's and the top level's are not", async () => {
  const { parseShell } = await import("../container/coder-shell.mjs");
  const marked = (c) => parseShell(c).commands.map((x) => [x.words.map((w) => w.text).join(" "), !!x.inSubst]);
  const sorted = (c) => marked(c).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(sorted("echo $(rm -rf x)"), [["echo $(rm -rf x)", false], ["rm -rf x", true]]);
  assert.deepEqual(sorted("echo `id`"), [["echo `id`", false], ["id", true]]);
  assert.deepEqual(sorted("diff <(ls a) b"), [["diff b", false], ["ls a", true]]);
  assert.deepEqual(sorted("(cd x && make)"), [["cd x", false], ["make", false]]);
  assert.deepEqual(sorted("echo \"${X:-$(pwd)}\""), [["$(pwd)", true], ["echo ${X:-$(pwd)}", false], ["pwd", true]]);
});

test("SW4 coder-checker.mjs: no verdict and the stop after ten, in Claude Code 2.1.325's words (\"…, so auto mode cannot determine the safety of <tool>\", its closing notes; \"… so <tool> was not run and this turn has ended\"; \"… so Coder stopped\")", async () => {
  const C = await import("../container/coder-checker.mjs");
  const NOTE = "Note: reading files, searching code, and other read-only operations do not require the classifier and can still be used.";
  assert.equal(C.READ_ONLY_NOTE, NOTE);
  assert.equal(C.noVerdictTold("grok-4.7", "hard", "it declined to judge this action", "bash"), "grok-4.7 gave no verdict (it declined to judge this action), so auto mode cannot determine the safety of bash. This is a hard failure, not a transient one: the check cannot or does not judge this request, so retrying this action will get the same answer. Don't retry it. Continue with other tasks that don't require it; if it is essential, stop and tell the owner that auto mode could not evaluate it. " + NOTE);
  assert.equal(C.noVerdictTold("grok-4.7", "transient", "its answer could not be read", "web_fetch"), "grok-4.7 gave no verdict (its answer could not be read), so auto mode cannot determine the safety of web_fetch. This is a transient failure of the check, not a judgment about the action: a later response may get a verdict. You may try the action again once, as-is. Repeated attempts are slowed by a growing delay, and after 10 responses in a row without a verdict the turn stops. If it keeps failing, continue with other tasks that don't require this action and come back to it later. " + NOTE);
  assert.equal(C.noVerdictStopTold("web_search"), "Auto mode is unavailable: the server returned no safety verdict for 10 responses in a row, so web_search was not run and this turn has ended. Wait for the owner's next message before doing anything further.");
  assert.equal(C.NO_VERDICT_STOP_SHOWN, "Auto mode is unavailable \u2014 the server returned no safety verdict for the last 10 responses, so Coder stopped. Send a message to try again, or switch out of auto mode.");
  assert.equal(C.checkUnavailable("grok-4.7", "bash", "rate-limited"), "grok-4.7 is temporarily unavailable (rate-limited), so auto mode cannot determine the safety of bash right now. Wait a moment and then try this action again. If it keeps failing, continue with other tasks that don't require this action and come back to it later. " + NOTE);
});

test("SW5 coder-agent.mjs: the changed-on-disk note, the scratchpad line, and Auto's no-verdict words in a job (the tool named; at the tenth, that call and the rest of its response told the stop, the owner shown Claude Code's line)", async () => {
  const A = await import("../container/coder-agent.mjs");
  const C = await import("../container/coder-checker.mjs");
  const lead = "Note: src/a.js changed on disk since you last read it. That's usually deliberate, so take it as the current state rather than reverting it; if the change looks wrong, say so rather than undoing it yourself \u2014 otherwise no need to call it out. ";
  assert.equal(A.changedOnDiskNote("src/a.js", { lines: "     1\tconst a = 2;" }), lead + "Here are the relevant changes (shown with line numbers):\n     1\tconst a = 2;");
  assert.equal(A.changedOnDiskNote("src/a.js", { big: true }), lead + "The changes are not shown here; use read if you need the current content.");
  assert.ok(A.CODER_SYSTEM.includes("\n- Scratchpad directory: /tmp/coder-scratch \u2014 always use it for temporary files (intermediate results, scripts, outputs that don't belong in the project) instead of `/tmp` or other system temp directories; it is chat-specific, isolated from the project, and can generally be used without permission prompts. A reboot or routine cleanup can clear it, so anything the owner will want to keep belongs somewhere durable instead. Only use `/tmp` if the owner explicitly asks. Whenever you name a file in it to the owner, write the file's complete absolute path in one piece, not a bare filename, a path that starts at the scratchpad folder, or the directory followed by filenames: a shortened path is read against the working directory and leads nowhere.\n"));
  // A job in Auto whose checker never gives a verdict.
  const job = async (steps) => {
    const events = [], seen = [], sleeps = [];
    let n = 0;
    const r = await A.runCoder({
      send: async (req) => {
        if (/THE ACTION TO JUDGE:/.test(String((req.messages[1] || {}).content || ""))) return { message: { role: "assistant", content: "hmm" }, usage: { in: 10, out: 1 } };
        seen.push(req);
        return steps[Math.min(n++, steps.length - 1)];
      },
      exec: async () => ({ code: 0, output: "ok\n" }),
      emit: (e) => events.push(e), sleep: async (ms) => { sleeps.push(ms); },
      here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-sw5", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
      ask: async () => ({ choice: "yes" }),
    }, { text: "work on the shop", mode: "auto", checker: true, checkWhere: { key: "chat-sw5-" + Math.random().toString(36).slice(2), repo: "ana/shop", branch: "coder/shop-1" } });
    // (The turn ends at the stop, so no later request carries those replies: the job's own messages.)
    const told = (id) => { const m = (r.messages || []).find((x) => x.role === "tool" && x.tool_call_id === id); return m ? m.content : ""; };
    return { events, told, seen, sleeps };
  };
  const steps = [...Array.from({ length: 9 }, (_, i) => say("", [call("bash", { command: "npm install " + i }, "c" + i)])), say("", [call("bash", { command: "npm install 9" }, "c9"), call("web_fetch", { url: "https://example.com", prompt: "x" }, "f9")]), say("ok")];
  const t = await job(steps);
  assert.equal(t.told("c0"), C.noVerdictTold("The classifier", "transient", "its answer could not be read", "bash"));
  assert.ok(t.told("c0").startsWith("The classifier gave no verdict (its answer could not be read), so auto mode cannot determine the safety of bash. This is a transient failure"));
  assert.equal(t.told("c9"), "Auto mode is unavailable: the server returned no safety verdict for 10 responses in a row, so bash was not run and this turn has ended. Wait for the owner's next message before doing anything further.");
  assert.equal(t.told("f9"), "Auto mode is unavailable: the server returned no safety verdict for 10 responses in a row, so web_fetch was not run and this turn has ended. Wait for the owner's next message before doing anything further.");
  assert.deepEqual(t.events.filter((e) => e.type === "error").map((e) => e.text), ["Auto mode is unavailable \u2014 the server returned no safety verdict for the last 10 responses, so Coder stopped. Send a message to try again, or switch out of auto mode."]);
});

test("SW6 coder-ps.mjs: the PowerShell description's line break before <example>, its background line with the background time limit, and its Start-Sleep lines, as Claude Code 2.1.325's in a cloud session; none of the two with background commands off", async () => {
  const { psDescription } = await import("../container/coder-ps.mjs");
  const d = psDescription({});
  assert.ok(d.includes("on its own line \u2014 indenting it is a parse error:\n<example>\ngit commit -m @'\nCommit message here.\n"));
  assert.ok(d.includes("\n  - If the output exceeds 30000 characters, output will be truncated before being returned to you.\n  - You can use the `run_in_background` parameter to run the command in the background. Only use this if you don't need the result immediately and are OK being notified when the command completes later. You do not need to check the output right away - you'll be notified when it finishes. With `run_in_background` the timeout is instead how long the command may run in the background (default 1800000ms / 30 minutes, max 7200000ms / 2 hours); at that limit it is stopped and you are notified.\n  - Avoid using PowerShell to run commands"));
  assert.ok(d.includes("the working directory is already set to the correct project directory automatically.\n  - Avoid unnecessary `Start-Sleep` commands:\n    - Do not sleep between commands that can run immediately \u2014 just run them.\n    - If your command is long running and you would like to be notified when it finishes \u2014 simply run your command using `run_in_background`. There is no need to sleep in this case.\n    - Do not retry failing commands in a sleep loop \u2014 diagnose the root cause or consider an alternative approach.\n    - If waiting for a background task you started with `run_in_background`, you will be notified when it completes \u2014 do not poll.\n    - If you must poll an external process, use a check command rather than sleeping first.\n    - If you must sleep, keep the duration short to avoid blocking the owner.\n  - For git commands:\n"));
  assert.match(psDescription({ bgDefaultMs: 600000, bgMaxMs: 10800000 }), /\(default 600000ms \/ 10 minutes, max 10800000ms \/ 3 hours\); at that limit it is stopped and you are notified\.\n/);
  const off = psDescription({ background: false });
  assert.ok(!off.includes("run_in_background") && !off.includes("Start-Sleep"));
  assert.ok(off.includes("project directory automatically.\n  - For git commands:\n"));
});

test("SW7 coder-psparse.mjs: Claude Code 2.1.325's parse script (a line break first; a string whose value is --% said in hasStopParsingValue), and that field read as Claude Code reads it", async () => {
  const Q = await import("../container/coder-psparse.mjs");
  assert.ok(Q.PS_PARSE_SCRIPT.startsWith("\nfunction Write-Result($Json) {\n"));
  assert.ok(Q.PS_PARSE_SCRIPT.includes("        $hasStopParsing = $true; break\n    }\n}\n$hasStopParsingValue = $null -ne $ast.Find({ param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst] -and ($n.Value -replace '[\\u2013\\u2014\\u2015]','-') -eq '--%' }, $true)\n\n$statements = [System.Collections.ArrayList]::new()\n"));
  assert.ok(Q.PS_PARSE_SCRIPT.includes("    hasStopParsing = $hasStopParsing\n    hasStopParsingValue = $hasStopParsingValue\n    originalCommand = $Command\n"));
  assert.equal(Q.PS_PARSE_SCRIPT.length, 11128);
  const raw = (more) => ({ valid: true, errors: [], statements: [], variables: [], hasStopParsing: false, originalCommand: "x", ...more });
  assert.equal(Q.psTransform(raw({ hasStopParsingValue: false })).hasStopParsing, false);
  assert.equal(Q.psTransform(raw({ hasStopParsingValue: true })).hasStopParsing, true);
  assert.equal(Q.psTransform(raw({})).hasStopParsing, true, "left out: counted as there (Claude Code: `!== false`)");
  assert.equal(Q.psTransform(raw({ hasStopParsing: true, hasStopParsingValue: false })).hasStopParsing, true);
  assert.equal(Q.psSafetyWhy(Q.psTransform(raw({ hasStopParsingValue: true }))), "Command uses stop-parsing token (--%)");
});

test("SW8 coder-tools.mjs: the note after reading a file that is not valid UTF-8, and edit's and write's refusal of one, in Claude Code 2.1.325's words", async () => {
  const T = await import("../container/coder-tools.mjs");
  assert.equal(T.NOT_UTF8_NOTE, "[This file is not valid UTF-8: it uses a legacy encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. Its undecodable bytes show above as U+FFFD. edit and write will refuse it: change it with a shell command that keeps its encoding, or ask the owner whether to convert it to UTF-8.]");
  assert.equal(T.NOT_UTF8_REFUSED, "is not valid UTF-8: it uses a legacy encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. These tools write UTF-8 (or UTF-16LE behind its byte-order mark) and never convert a file's encoding on their own, so nothing was written. If the file is text, make the change with a shell command that reads and writes it in its own encoding (iconv, or PowerShell Get-Content/Set-Content -Encoding), or ask the owner whether to convert it to UTF-8 first. To replace the whole file with new UTF-8 text anyway, delete it first, then write it.");
});

test("SW9 coder-webfetch.mjs: the read-on note is headed with Coder's tool name, web_fetch", async () => {
  const W = await import("../container/coder-webfetch.mjs");
  assert.equal(W.readOnNote(0, 100000, 250000), "\n\n[web_fetch note: this page's text is 250000 characters long and the answer above covers only characters 0 to 100000; the final 150000 were not read \u2014 to read on, call web_fetch again with the same url and offset: 100000.]");
});
