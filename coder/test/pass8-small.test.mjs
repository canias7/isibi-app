// BASH DOCS PASS 8, PART E (the owner, 2026-11-11: "Yes pls" to building all of it): the small differences left, each test
// checked against Claude Code's own words (its docs, and its program, version 2.1.322).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-perms.mjs");
const C = await import("../container/coder-checks.mjs");
const SH = await import("../container/coder-shell.mjs");
const R = await import("../src/coder-routes.mjs");
const S = await import("../container/server.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

test("CD426 the low-memory warning (Claude Code's CLAUDE_CODE_WARN_MEMORY_FREE_GIB: \"Low memory: … is available to this session.\"), in Settings; it and the low-disk warning off unless chosen, and said again only after the figure was back above 1.25 times the line, as Claude Code's", async () => {
  // Settings: both off by default, as Claude Code's are unless set.
  assert.deepEqual([R.prefsOf({}).diskWarnGib, R.prefsOf({}).memWarnGib], [0, 0]);
  assert.equal(R.prefsChange({}, { memWarnGib: 4 }).prefs.memWarnGib, 4);
  assert.equal(R.prefsChange({}, { memWarnGib: 3 }).error, "The low-memory warning is one of 0, 1, 2, 4, 8 GB (0 is off).");
  assert.equal(R.machinePrefs({ memWarnGib: 4 }).memWarnGib, 4);
  assert.equal(S.prefsIn({ memWarnGib: 4 }).memWarnGib, 4);
  assert.equal(S.prefsIn({}).memWarnGib, 0);
  // What is available: MemAvailable, or less under the chat's commands' memory cap.
  const fake = (f) => (f === "/proc/meminfo" ? "MemTotal: 16000000 kB\nMemAvailable: 8000000 kB\n" : f.endsWith("memory.max") ? "4294967296\n" : f.endsWith("memory.current") ? "1073741824\n" : "");
  assert.equal(S.memAvailable("", fake), 8000000 * 1024);
  assert.equal(S.memAvailable("/sys/fs/cgroup/coder-bash-x", fake), 3 * 1024 ** 3);
  assert.equal(S.memAvailable("", () => { throw new Error("no"); }), null);
  // Claude Code's words.
  assert.equal(A.MEM_LOW(1.5 * 1024 ** 3), "Low memory: 1.5 GB is available to this session.");
  // In the loop: once below the line, again only after 1.25 times it.
  let avail = 1.5 * 1024 ** 3;
  const run = async (gib = 2) => {
    const sent = [], events = [];
    await A.runCoder({ send: async (req) => { sent.push(req.messages); return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), memFree: () => avail, root: "/work/mem-test" }, { text: "hi", memWarnGib: gib });
    return { told: sent[0].some((m) => m.appNote === true && String(m.content).includes("Low memory: ")), shown: events.some((e) => e.type === "note" && String(e.text).startsWith("Low memory: ")) };
  };
  A.MEM_TOLD.clear();
  assert.deepEqual(await run(), { told: true, shown: true });
  assert.deepEqual(await run(), { told: false, shown: false }, "still low");
  avail = 2.2 * 1024 ** 3;
  assert.deepEqual(await run(), { told: false, shown: false }, "above the line, under 1.25 times it: not armed again");
  avail = 1.8 * 1024 ** 3;
  assert.deepEqual(await run(), { told: false, shown: false });
  avail = 2.6 * 1024 ** 3;
  await run();
  avail = 1 * 1024 ** 3;
  assert.deepEqual(await run(), { told: true, shown: true }, "said again after 2.5 GB");
  A.MEM_TOLD.clear();
  assert.deepEqual(await run(0), { told: false, shown: false }, "off");
  // The page: the choice beside the disk one, both "Off (default)".
  const page = read("public/coder.js");
  assert.match(page, /<select id="cdSetMem" aria-label="Low-memory warning">/);
  assert.match(page, /'Off \(default\)', prefs\.diskWarnGib === g/);
  assert.match(read("container/server.mjs"), /memFree: \(\) => memAvailable\(t\.memCg\),/);
});

test("CD427 CLAUDE_CODE_REMOTE=true in every command's environment and the setup script's (Claude Code: \"Set automatically to true when Claude Code is running as a cloud session. Read this from a hook or setup script\"); no OTEL_* variable reaches a command (Claude Code deletes them)", () => {
  assert.deepEqual(S.REMOTE_MARK, { CLAUDE_CODE_REMOTE: "true" });
  const server = read("container/server.mjs");
  assert.match(server, /AGENT_MARK, REMOTE_MARK\);/, "the AI's commands");
  assert.match(server, /extraEnv: \{ GOFARTHER_CODER: "1", \.\.\.REMOTE_MARK,/, "the setup script");
  assert.deepEqual(S.withoutOtel({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://x", otel_service_name: "a", CLAUDE_CODE_OTEL_DIAG_STDERR: "1", NODE_ENV: "test" }), { NODE_ENV: "test" });
  assert.match(server, /\.\.\.withoutOtel\(repoSet\.env\), \.\.\.withoutOtel\(ownerVars\),/);
});

test("CD428 zsh: the snapshot lists options with KSH_OPTION_PRINT off (Claude Code 2.1.321: \"Fixed Bash commands coming back empty for zsh users whose .zshrc sets KSH_OPTION_PRINT\"), and zsh's bare glob qualifiers are off in every command, as Claude Code's own line has it (NO_EXTENDED_GLOB NO_BARE_GLOB_QUAL)", { timeout: 60_000 }, () => {
  assert.match(S.SNAPSHOT_TAKE_ZSH, /\nunsetopt kshoptionprint 2>\/dev\/null\nfor o in \$\(setopt\)/);
  assert.equal(S.EXTGLOB_OFF_ZSH, "setopt NO_EXTENDED_GLOB NO_BARE_GLOB_QUAL NO_KSH_GLOB 2>/dev/null || true\n");
  let zsh = "";
  try { zsh = execFileSync("bash", ["-c", "command -v zsh"], { encoding: "utf8" }).trim(); } catch { zsh = ""; }
  if (!zsh) return;
  // Tried with real zsh: a .zshrc that sets KSH_OPTION_PRINT, an alias of its own.
  const home = mkdtempSync(join(tmpdir(), "coder-zsh-"));
  try {
    writeFileSync(join(home, ".zshrc"), "setopt KSH_OPTION_PRINT\nalias ll=\"ls -ld\"\n");
    const env = { ...process.env, HOME: home, ZDOTDIR: home };
    const q = (s) => "'" + s.replace(/'/g, "'\\''") + "'";
    const runIn = (snap) => { execFileSync("bash", ["-c", snap], { env, timeout: 20000 }); return execFileSync("zsh", ["-c", S.SNAPSHOT_READ_ZSH + S.EXTGLOB_OFF_ZSH + "eval " + q("echo hello; ll / | cut -c1-1")], { env, encoding: "utf8", timeout: 20000 }); };
    // Before: every option set from the "name on/off" list, so the command printed nothing.
    let before = "";
    try { before = runIn(S.SNAPSHOT_TAKE_ZSH.replace("\nunsetopt kshoptionprint 2>/dev/null", "")); } catch (e) { before = String(e.stdout || ""); }
    assert.equal(before, "", "the old snapshot: nothing back");
    assert.equal(runIn(S.SNAPSHOT_TAKE_ZSH), "hello\nd\n", "now: the output, and the .zshrc's alias");
    // A bare glob qualifier (*(e:…:), run for each file the * matches) runs nothing.
    writeFileSync(join(home, "a.txt"), "x");
    let qual = "";
    try { qual = execFileSync("zsh", ["-c", S.EXTGLOB_OFF_ZSH + "echo *(e:'touch ran-it':)"], { env, cwd: home, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { qual = String(e.stderr || ""); }
    assert.equal(existsSync(join(home, "ran-it")), false, qual);
    // (Without that line, zsh runs it: what the line stops.)
    try { execFileSync("zsh", ["-c", "echo *(e:'touch ran-it':)"], { env, cwd: home, stdio: "ignore" }); } catch { /* no match is an error too */ }
    assert.equal(existsSync(join(home, "ran-it")), true, "zsh's default runs the qualifier's code");
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("CD429 the bash tool's description says the real timeouts (Claude Code's: \"up to ${max}ms … By default, your command will timeout after ${default}ms\", as BASH_DEFAULT_TIMEOUT_MS and BASH_MAX_TIMEOUT_MS set them) and the real shell's startup file", () => {
  const bash = (o) => A.toolsFor(A.CODER_TOOLS, o).find((t) => t.function.name === "bash").function;
  assert.equal(A.toolsFor(A.CODER_TOOLS, {}), A.CODER_TOOLS, "the defaults: as written");
  const f = bash({ defaultMs: 300000, maxMs: 1200000, bgDefaultMs: 3600000 });
  assert.match(f.description, /`timeout` in milliseconds: 300000 by default, at most 1200000;/);
  assert.match(f.description, /reaches its time limit: 60 minutes,/);
  assert.match(f.parameters.properties.timeout.description, /^Optional timeout in milliseconds \(default 300000, at most 1200000\)\. With run_in_background: its time limit in the background \(default 3600000, at most 7200000\)$/);
  const z = bash({ shell: "/usr/bin/zsh" });
  assert.match(z.description, /^Run ONE shell command \(zsh\)/);
  assert.match(z.description, /\(~\/\.zshrc, as it was when this message started\)/);
  // With background commands off, the same numbers.
  assert.match(bash({ noBg: true, defaultMs: 300000, maxMs: 1200000 }).description, /`timeout` in milliseconds: 300000 by default, at most 1200000; a command still running then is stopped/);
});

test("CD430 an output file cut at its limit says so, in Claude Code's words (\"Output exceeded the 64MB persist limit; only the first 64MB were saved to: …\")", () => {
  const big = "x".repeat(40_000);
  assert.match(C.bashResultText({ output: big, size: 40_000, file: "/out/a.txt" }), /^<persisted-output>\nOutput too large \(39\.1KB\)\. Full output saved to: \/out\/a\.txt\n/);
  assert.match(C.bashResultText({ output: big, size: 90 * 1024 * 1024, file: "/out/a.txt", truncatedAt: 64 * 1024 * 1024 }), /^<persisted-output>\nOutput exceeded the 64MB persist limit; only the first 64MB were saved to: \/out\/a\.txt\n\nPreview \(first 2KB\):\n/);
  assert.match(read("container/coder-agent.mjs"), /truncatedAt: r && Number\(r\.truncatedAt\) > 0 \? Number\(r\.truncatedAt\) : 0, \.\.\.\(c\.ps \? \{ tool: "PowerShell" \} : \{\}\) \}\);/);
});

test("CD431 a monitor at its deadline: how many events it delivered, and with none, Claude Code's \"widen the filter if silence was unexpected\"", () => {
  assert.equal(A.monitorSaid({ id: "m1", desc: "ready", lines: [], end: { why: "limit", events: 0, ms: 1_800_000 } }), "Monitor \"ready\" (m1) expired after 30m with no events delivered. Re-arm it if you still need the watch — and widen the filter if silence was unexpected.");
  assert.equal(A.monitorSaid({ id: "m2", desc: "errors", lines: [], end: { why: "limit", events: 1, ms: 300_000 } }), "Monitor \"errors\" (m2) expired after 5m with 1 event delivered. Re-arm it if you still need the watch.");
  assert.match(A.monitorSaid({ id: "m3", desc: "x", lines: [], end: { why: "limit", events: 4, ms: 300_000 } }), /with 4 events delivered\./);
  // The machine counts them.
  // (Each look that read lines is one event, as Claude Code counts the events it delivered: Bash docs pass 9.)
  const dir = mkdtempSync(join(tmpdir(), "p8e-mon-"));
  const log = join(dir, "bg-9.log");
  writeFileSync(log, "a\nb\n");
  S.JOBS.set(999001, { project: "p8e-mon", id: "m9", monitor: true, desc: "d", log, readAt: 0, part: "", pending: [], at: 1000, deadline: 1000 + 300_000, end: null, told: false });
  try {
    assert.deepEqual(S.monitorNews("p8e-mon").map((n) => n.lines), [["a\nb"]]);
    appendFileSync(log, "c\n");
    S.readMonitor(S.JOBS.get(999001));
    S.JOBS.get(999001).end = { code: 143, why: "limit" };
    const n = S.monitorNews("p8e-mon")[0];
    assert.deepEqual([n.lines, n.end.events, n.end.ms], [["c"], 2, 300_000]);
  } finally { S.JOBS.delete(999001); rmSync(dir, { recursive: true, force: true }); }
});

test("CD432 the settings a command may be given in front and still only read: Claude Code 2.1.322's own list and check (GOOS, CGO_ENABLED, DEBIAN_FRONTEND, GIT_TERMINAL_PROMPT yes; DEBUG, VERBOSE, LC_MESSAGES no; a path as a value no)", () => {
  const v = (c) => P.bashDecision(c, { mode: "plan", rules: { allow: [], ask: [], deny: [] }, cwd: "/w", workdirs: ["/w"] }).verdict;
  for (const c of ["GOOS=linux ls", "CGO_ENABLED=0 ls", "DEBIAN_FRONTEND=noninteractive ls", "GIT_TERMINAL_PROMPT=0 git status", "LANG=C.UTF-8 ls", "NODE_ENV=production ls", "TZ=UTC ls"]) assert.equal(v(c), "allow", c);
  for (const c of ["DEBUG=1 ls", "VERBOSE=1 ls", "LC_MESSAGES=C ls", "LANG=../x ls", "TERM=/tmp/x ls", "NO_COLOR+=1 ls", "FOO=bar ls"]) assert.equal(v(c), "ask", c);
});

test("CD433 \"don't ask again\" never offers a rule wider than the command: past a wrapper it can't see through, the command itself (Claude Code refuses a prefix rule for its wrappers and shells, and saves the command); no exact rule with a * in it", () => {
  const s = (c) => P.suggestFor(SH.parseShell(c).commands[0]);
  assert.equal(s("timeout -s KILL 30 npm install"), "timeout -s KILL 30 npm install", "not timeout *");
  assert.equal(s("strace -f ./a.out"), "strace -f ./a.out");
  // (Pass 9: Claude Code's own rule, its uPn: timeout is one of its wrappers, so the command itself.)
  assert.equal(s("timeout 30 npm install"), "timeout 30 npm install");
  assert.equal(s("rm *.log"), null, "rm *.log as a rule would allow any rm ending in .log");
  assert.equal(s("rm build.log"), "rm build.log");
  assert.equal(s("npm install"), "npm install *");
});

test("CD434 a rule the owner changes while Coder works counts from the next tool call (Claude Code: rule changes take effect at the next tool call): the Worker gives each running chat of that repository its new rules, its machine keeps them with the repository's own from the job's start", async () => {
  let rulesNow = null;
  const cards = [], events = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "npm install", description: "Install" }, "b1")]), say("", [call("bash", { command: "npm install", description: "Install" }, "b2")]), say("done")];
  await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => (/coder-tools\.mjs/.test(String(x.command)) ? { code: 0, output: "" } : { code: 0, output: "ok\n" }),
    emit: (e) => events.push(e),
    ask: async (pid) => { cards.push(pid); rulesNow = { allow: ["Bash(npm install)"], ask: [], deny: [] }; return { choice: "yes" }; },
    rulesNow: () => rulesNow,
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-rules",
  }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: [], deny: [] } });
  assert.equal(cards.length, 1, "asked the first time; the rule added meanwhile allows the second");
  // The machine and the Worker.
  const server = read("container/server.mjs");
  assert.match(server, /if \(url\.pathname === "\/rules" && req\.method === "POST"\) \{/);
  // (Pass 9: the owner's rules kept, to go with the repository's own as they are now, read again when its files change.)
  assert.match(server, /t\.ownerRules = \{ allow: r\.allow, ask: r\.ask, deny: r\.deny \};\n\s+t\.rulesNext = withRepoRules\(t\.ownerRules, t\.repoSet\) \|\| \{ allow: \[\], ask: \[\], deny: \[\] \};/);
  assert.match(server, /rulesNow: \(\) => \{ repoNow\(\); return t\.rulesNext \|\| null; \},/);
  const routes = read("src/coder-routes.mjs");
  assert.match(routes, /await tellRunning\(r, rules\);/);
  assert.match(routes, /if \(!m \|\| m\.repo !== repoName \|\| m\.status !== "running"\) return;/);
});

test("CD435 a note goes with Yes and No only (Claude Code: \"don't ask again\" and \"switch to auto mode\" take none)", async () => {
  const page = read("public/coder.js");
  // (A plan's card sends its words with every Yes since 2026-11-14, as Claude Code 2.1.325: test/plan-mode.test.mjs PM26.)
  assert.match(page, /const comment = !isPlan && \(choice === 'always' \|\| choice === 'auto'\) \? '' : String/);
  const told = async (answer) => {
    const seen = [];
    let n = 0;
    const steps = [say("", [call("bash", { command: "npm install", description: "Install" }, "b1")]), say("done")];
    await A.runCoder({
      send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
      exec: async (x) => (/coder-tools\.mjs/.test(String(x.command)) ? { code: 0, output: "" } : { code: 0, output: "ok\n" }),
      emit: () => {}, ask: async () => answer,
      here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-note",
    }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: [], deny: [] } });
    // (The call's result, and what Grok gets right after the round's results.)
    for (const req of seen) { const i = req.messages.findIndex((m) => m.role === "tool" && m.tool_call_id === "b1"); if (i >= 0) return [req.messages[i].content, String((req.messages[i + 1] || {}).content || "")]; }
    return ["", ""];
  };
  // (Since fix round 3, 2026-11-14, as Claude Code gives them: exactly as typed, the owner's own text right after the round's
  // results, never wrapped in a sentence nor in the result: test/cards-park.test.mjs CP13.)
  const yes = await told({ choice: "yes", comment: "use the lockfile" });
  assert.equal(yes[1], "use the lockfile");
  assert.doesNotMatch(yes[0], /lockfile|with a note/);
  const always = await told({ choice: "always", comment: "use the lockfile" });
  assert.ok(!always.join("\n").includes("use the lockfile"));
});

test("CD436 a chat with several repositories reads no repository's .claude settings: rules, env, command settings or hooks (Claude Code's cloud session then works from a folder outside all of them)", () => {
  const d = mkdtempSync(join(tmpdir(), "coder-several-"));
  try {
    mkdirSync(join(d, ".claude"));
    writeFileSync(join(d, ".claude", "settings.json"), JSON.stringify({ permissions: { deny: ["Bash(curl *)"] }, env: { FOO: "1" }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] } }));
    const one = S.repoSettings(d, {}), many = S.repoSettings(d, { several: true });
    assert.deepEqual([one.deny, one.env], [["Bash(curl *)"], { FOO: "1" }], "one repository: its settings");
    assert.deepEqual([many.deny, many.env], [[], {}], "several: none");
    assert.equal(S.hooksForTurn(d, null).length, 1);
    assert.equal(S.hooksForTurn(d, null, { several: true }).length, 0);
    assert.equal(S.hooksForTurn(d, { hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }, { several: true }).length, 1, "the owner's own still");
  } finally { rmSync(d, { recursive: true, force: true }); }
  const server = read("container/server.mjs");
  assert.match(server, /github: body\.github === true, several: extraRepos\(body\)\.length > 0 \}\);\n/);
});
