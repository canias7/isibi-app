// BASH DOCS PASS 9, PART F (the owner, 2026-11-11: "Yes pls" to building pass 9's list in order; part F: the page, with
// screenshots): a step that never ran is not counted as one that ran; a saved key that is never sent says so and why;
// Claude Code's three network levels; the variable names commands never get, named.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const A = await import("../container/coder-agent.mjs");
const S = await import("../container/server.mjs");
const SEC = await import("../container/coder-secrets.mjs");
const R = await import("../src/coder-routes.mjs");
const HERE = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const ui = readFileSync(HERE("public/coder.js"), "utf8");
const css = readFileSync(HERE("public/coder.css"), "utf8");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

/** One job of Coder's loop, its machine stood in for. */
async function job(steps, { mode = "auto", opts = {}, answers = [], messages } = {}) {
  const events = [], ran = [];
  let n = 0, k = 0;
  await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { if (x.hook === true || x.tool) return { code: 0, output: "" }; ran.push(x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-f1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async () => answers[k++] || { choice: "yes" },
  }, { text: "go", mode, ...(messages ? { messages } : {}), ...opts });
  const result = (id) => events.find((e) => e.type === "result" && e.id === id);
  return { events, ran, result };
}
/** A function of the page, taken from its source as it is. */
const pageFn = (start, end = "\n  }\n") => { const a = ui.indexOf(start), b = ui.indexOf(end, a); assert.ok(a > 0, start); return ui.slice(a, b + end.length); };

test("CD498 a step that never ran (a deny rule, the owner's no, a read rule) has its result marked `ran: false`; a step that ran is not", async () => {
  // A command a deny rule refuses.
  let t = await job([say("", [call("bash", { command: "rm -rf build" }, "b1"), call("bash", { command: "ls" }, "b2")]), say("ok")], { opts: { rules: { deny: ["Bash(rm:*)"] } } });
  assert.equal(t.result("b1").ran, false, "refused by the rule");
  assert.equal(t.result("b1").code, -1);
  assert.equal(t.result("b2").ran, undefined, "ls ran");
  assert.deepEqual(t.ran, ["ls"]);
  // A command the owner said no to.
  t = await job([say("", [call("bash", { command: "touch notes.txt" }, "b1")]), say("ok")], { mode: "acceptEdits", opts: { fileEdits: false }, answers: [{ choice: "no" }] });
  assert.equal(t.result("b1").ran, false);
  assert.equal(t.result("b1").output, "Not run: you said no.");
  assert.deepEqual(t.ran, []);
  // A read a rule refuses (a file tool's refusal, code 1).
  t = await job([say("", [call("read", { path: ".env" }, "r1")]), say("ok")], { opts: { rules: { deny: ["Read(.env)"] } } });
  assert.equal(t.result("r1").ran, false);
  assert.equal(t.result("r1").code, 1);
  // Every refusal in the loop carries it: no `code: -1` result for a call that never ran is left without it.
  const agent = readFileSync(HERE("container/coder-agent.mjs"), "utf8");
  assert.equal((agent.match(/emit\(\{ type: "result", id: c\.id, code: -1, output:/g) || []).length, 0, "every refusal marked");
  assert.ok((agent.match(/code: -1, ran: false, output:/g) || []).length >= 28);
});

test("CD499 the page takes a step that never ran out of its group and out of the group's count (\"Ran 2 commands\" counts only commands that ran), as Claude Code takes a step that needs its own row out of its group; its state says \"not run\"", () => {
  const autoBlockOf = new Function("return " + pageFn("  function autoBlockOf(r) {").trim())();
  const neverRan = new Function("autoBlockOf", "return " + pageFn("  function neverRan(r) {").trim())(autoBlockOf);
  assert.equal(neverRan({ code: -1, ran: false, output: "Permission to use Bash with command rm -rf build has been denied." }), true);
  assert.equal(neverRan({ code: 1, ran: false, output: "x" }), true);
  assert.equal(neverRan({ code: 1, output: "No such file" }), false, "a failure ran");
  assert.equal(neverRan({ code: -1, output: "(stopped by the owner while it ran)" }), false);
  assert.equal(neverRan({ code: 0, output: "ok" }), false);
  assert.equal(neverRan(undefined), false, "still running");
  // Chats from before: their marks.
  assert.equal(neverRan({ code: -1, output: "x", notRun: "auto mode's check had no usable answer" }), true);
  assert.equal(neverRan({ code: -1, output: "PreToolUse:Bash hook error: [p.sh]: no", hookBlocked: true }), true);
  assert.equal(neverRan({ code: -1, output: "Not run: you said: later", denied: true }), true);
  assert.equal(neverRan({ code: -1, output: "Blocked by auto mode · [Irreversible Local Destruction] deletes files" }), true);
  // In the list of steps: flushed alone, between the groups before and after it.
  assert.match(ui, /if \(e\.id && lastStep\[e\.id\] !== i\) return;\n[\s\S]{0,500}if \(neverRan\(results\[e\.id\]\)\) \{ flush\(\); group\.push\(\[e, i\]\); flush\(\); return; \}\n\s+group\.push\(\[e, i\]\);/);
  // Its own row says why in a word: "not run" where it said "exit -1".
  assert.match(ui, /r\.denied === true \? 'refused' : r\.ran === false \? 'not run' : e\.tool \? 'error' : 'exit ' \+ esc\(r\.code\)/);
});

test("CD500 a saved key that is never sent says why and what to do (Claude Code: \"If the list marks a secret Not sent instead, the note under it says why and what to do\"; \"Two secrets whose hosts overlap without matching exactly get no marker\")", () => {
  const k = (hosts) => ({ hosts });
  assert.match(SEC.notSentWhy([k(["github.com"])], 0), /^GitHub never gets a saved key: Coder reaches GitHub with your GitHub sign-in/);
  assert.match(SEC.notSentWhy([k(["api.github.com", "github.com"])], 0), /^GitHub never gets/);
  assert.match(SEC.notSentWhy([k(["registry.npmjs.org", "pypi.org"])], 0), /^Public package registries never get a saved key \(registry\.npmjs\.org, pypi\.org\)\. For a private registry, save the key for that registry's own site\.$/);
  assert.equal(SEC.notSentWhy([k(["api.anthropic.com"])], 0), "The Anthropic API never gets a saved key (api.anthropic.com).", "no registry tip for it");
  assert.match(SEC.notSentWhy([k(["api.anthropic.com", "jsr.io"])], 0), /^The Anthropic API and the public package registries never get a saved key \(api\.anthropic\.com, jsr\.io\)\. For a private registry/);
  // The same site as a key saved before it: only the first is sent (Coder's proxy and server take the first that names a site).
  const two = [k(["api.example.com"]), k(["api.example.com"])];
  assert.equal(SEC.notSentWhy(two, 0), "", "the first is sent");
  assert.match(SEC.notSentWhy(two, 1), /^A key saved before this one names the same site \(api\.example\.com\), and only the first key for a site is sent\. Delete one of the two, or give this one other sites\.$/);
  // Overlapping without matching exactly: no mark (as Claude Code's list).
  assert.equal(SEC.notSentWhy([k(["*.example.com"]), k(["api.example.com"])], 1), "");
  // Some of its sites get it: no mark.
  assert.equal(SEC.notSentWhy([k(["github.com", "api.example.com"])], 0), "");
  assert.equal(SEC.notSentWhy([k(["*.github.com"])], 0), "", "a wildcard reaches other GitHub hosts' names");
  // Mixed reasons, every site covered: each reason said.
  const mixed = SEC.notSentWhy([k(["api.example.com"]), k(["github.com", "pypi.org", "api.example.com"])], 1);
  assert.match(mixed, /^GitHub never gets[\s\S]* Public package registries never get a saved key \(pypi\.org\)[\s\S]* A key saved before this one names the same site \(api\.example\.com\)/);
  // The machine never sends it either: the hosts that never get a key, as before.
  assert.equal(SEC.keyAllowed("github.com"), false);
  assert.equal(SEC.keyAllowed("api.example.com"), true);
  assert.equal(SEC.notSentWhy([], 0), "");
  assert.equal(SEC.notSentWhy([k([])], 0), "");
});

test("CD501 the page's list of saved keys carries the mark and its note, never a value; the page shows \"Not sent\" and the note under the key", () => {
  const hdr = (id, hosts) => ({ id, name: id, kind: "headers", hosts, headers: [{ name: "Authorization", prefix: "Bearer", value: "s3cret-" + id }], at: 1 });
  const list = R.secretList([hdr("a", ["api.example.com"]), hdr("b", ["registry.npmjs.org"]), hdr("c", ["api.example.com"])]);
  assert.equal(list.length, 3);
  assert.equal(list[0].notSent, undefined);
  assert.match(list[1].notSent, /^Public package registries never get a saved key/);
  assert.match(list[2].notSent, /A key saved before this one names the same site/);
  assert.doesNotMatch(JSON.stringify(list), /s3cret/, "no value");
  assert.match(ui, /\(x\.notSent \? ' <em class="cd-em-notsent">Not sent<\/em>' : ''\)/);
  assert.match(ui, /\(x\.notSent \? '<small class="cd-em-why">' \+ esc\(x\.notSent\) \+ '<\/small>' : ''\)/);
  assert.match(css, /\.cd-em-notsent\{/);
  assert.match(css, /\.cd-em-li small\.cd-em-why\{white-space:normal;/, "the note wraps");
});

test("CD502 the network levels as Claude Code now names them: None, Limited (Allow package managers + Allowed domains) and Full; Trusted opens as Limited with the box checked, Custom as Limited with its list; saved under the old names so what an environment reaches does not change", () => {
  const NET = new Function("return " + pageFn("  const NET = {", "};\n").trim().replace(/^const NET = /, "").replace(/;$/, ""))();
  assert.deepEqual(Object.keys(NET), ["none", "limited", "full"]);
  assert.deepEqual(Object.values(NET).map((x) => x[0]), ["None", "Limited", "Full"]);
  assert.match(NET.limited[1], /while Allow package managers is checked, plus the domains you list/);
  const netLevel = new Function("return " + pageFn("  const netLevel = ", ";\n").trim().replace(/^const netLevel = /, "").replace(/;$/, ""))();
  assert.deepEqual(["none", "trusted", "custom", "full", undefined].map(netLevel), ["none", "limited", "limited", "full", "limited"]);
  const netSaved = new Function("return " + pageFn("  const netSaved = ", ";\n").trim().replace(/^const netSaved = /, "").replace(/;$/, ""))();
  assert.equal(netSaved({ mode: "limited", defaults: true, hosts: [] }), "trusted", "box checked, no domains: as Trusted was");
  assert.equal(netSaved({ mode: "limited", defaults: true, hosts: ["api.example.com"] }), "custom");
  assert.equal(netSaved({ mode: "limited", defaults: false, hosts: [] }), "custom", "box cleared: nothing but keyed sites");
  assert.equal(netSaved({ mode: "none", defaults: true, hosts: [] }), "none");
  assert.equal(netSaved({ mode: "full", defaults: true, hosts: [] }), "full");
  const limitedWords = new Function("return " + pageFn("  const limitedWords = (n) => {", "\n  };\n").trim().replace(/^const limitedWords = /, "").replace(/;$/, ""))();
  assert.equal(limitedWords({ mode: "trusted", hosts: ["old.example.com"], defaults: false }), "package managers", "Trusted reaches the default list only");
  assert.equal(limitedWords({ mode: "custom", hosts: ["a.example.com", "b.example.com"], defaults: true }), "package managers + 2 domains");
  assert.equal(limitedWords({ mode: "custom", hosts: ["a.example.com"], defaults: false }), "1 domain");
  assert.equal(limitedWords({ mode: "custom", hosts: [], defaults: false }), "no domains");
  // The same reach as before, on the machine: Trusted and Custom-with-the-box are one thing.
  for (const h of ["registry.npmjs.org", "api.example.com"]) assert.equal(SEC.hostAllowed(h, { mode: "trusted" }), SEC.hostAllowed(h, { mode: "custom", hosts: [], defaults: true }), h);
  // The dialog: the box and the list under Limited; Trusted opens with the box checked and no domains of its own.
  assert.match(ui, /f\.mode === 'limited' \? '<label class="cd-envnet"><input type="checkbox" id="envDefaults"' \+ \(f\.defaults \? ' checked' : ''\) \+ '> <span><b>Allow package managers<\/b>/);
  assert.match(ui, /<label class="cd-em-l">Allowed domains<\/label>/);
  assert.match(ui, /mode: netLevel\(n0\.mode\), hosts: n0\.mode === 'trusted' \? \[\] : \[\.\.\.\(n0\.hosts \|\| \[\]\)\], defaults: n0\.mode === 'trusted' \|\| n0\.defaults !== false/);
  assert.match(ui, /envPost\(\{ network: \{ mode: netSaved\(f\), hosts: f\.hosts, defaults: f\.defaults, denied: f\.denied \|\| \[\] \} \}\)/);
  assert.match(ui, /NET\[netLevel\(n\.mode\)\]\[0\] \+ \(netLevel\(n\.mode\) === 'limited' \? ' · ' \+ limitedWords\(n\) : ''\)/);
  assert.match(ui, /It starts on Limited network access with package managers allowed/);
  assert.doesNotMatch(ui, /'Trusted'|'Custom'|Also include the default list/);
});

test("CD503 Coder proposes a new environment's level by the new names (none, limited, full): limited is saved as before (trusted); the machine's note names the level Limited", async () => {
  const tool = A.CODER_TOOLS.find((x) => x.function.name === "propose_env");
  assert.deepEqual(tool.function.parameters.properties.network.enum, ["none", "limited", "full"]);
  const ran = [{ role: "assistant", content: "", tool_calls: [call("bash", { command: "mkdir -p cache" }, "m1")] }, { role: "tool", tool_call_id: "m1", content: "exit code 0\n" }];
  const card = async (network) => {
    const t = await job([say("", [call("propose_env", { kind: "new_environment", name: "blog", ...(network ? { network } : {}), script: "mkdir -p cache", reason: "r" }, "p1")])], { messages: ran });
    return t.events.find((e) => e.type === "envchange").network;
  };
  assert.equal(await card("limited"), "trusted");
  assert.equal(await card(undefined), "trusted");
  assert.equal(await card("trusted"), "trusted", "the old name still works");
  assert.equal(await card("none"), "none");
  assert.equal(await card("full"), "full");
  assert.equal(await card("custom"), "trusted", "anything else: the default");
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /"The environment changed: network " \+ \(\{ none: "None", trusted: "Limited", full: "Full", custom: "Limited" \}\[nn\.mode\]/);
  assert.match(ui, /esc\(NET\[netLevel\(e\.network\)\]\[0\]\)/, "the card shows the new name");
});

test("CD504 the variable names commands never get are named on the page (they were dropped without a word): one list for the machine and the page", () => {
  assert.deepEqual(SEC.varsDropped({ PATH: "/x", HOME: "/h", LD_PRELOAD: "x", NODE_OPTIONS: "x", CDPATH: "x", OTEL_EXPORTER_OTLP_ENDPOINT: "x", CLAUDE_CODE_OTEL_DIAG_STDERR: "1", USER: "me", SHELL: "zsh", BASH_ENV: "x", ENV: "x", SHELLOPTS: "x", BASHOPTS: "x" }),
    ["PATH", "HOME", "LD_PRELOAD", "NODE_OPTIONS", "CDPATH", "OTEL_EXPORTER_OTLP_ENDPOINT", "CLAUDE_CODE_OTEL_DIAG_STDERR", "USER", "SHELL", "BASH_ENV", "ENV", "SHELLOPTS", "BASHOPTS"]);
  assert.deepEqual(SEC.varsDropped({ USER_POOL_ID: "x", HOMEBREW_PREFIX: "x", PATHS: "x", NODE_ENV: "x", CODER_SHELL_PREFIX: "x", ENVIRONMENT: "x" }), [], "whole names only; Coder's settings are not dropped");
  assert.deepEqual(SEC.varsDropped(null), []);
  // The machine drops exactly those (and keeps reading CODER_… as settings).
  const kept = S.safeVars({ PATH: "/x", HOME: "/h", OTEL_SERVICE_NAME: "x", NODE_ENV: "production", USER_POOL_ID: "p", CODER_SHELL_PREFIX: "x" });
  assert.deepEqual(Object.keys(kept), ["NODE_ENV", "USER_POOL_ID"]);
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /VAR_DROPPED_RE\.test\(k\) \|\| \/\^CODER_\/i\.test\(k\)/);
  // The Worker sends the names; the page shows them on the variables page and its row.
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /varsText: toEnv\(e\.vars\), varsDropped: varsDropped\(e\.vars\),/);
  assert.match(ui, /\(\(e\.varsDropped \|\| \[\]\)\.length \? '<p class="cd-em-help cd-em-warnnote">Not given to commands: ' \+ esc\(e\.varsDropped\.join\(', '\)\) \+ '\. Coder\\'s machine keeps its own PATH, HOME, SHELL and USER/);
  assert.match(ui, /' · ' \+ e\.varsDropped\.length \+ ' not given to commands'/);
});

test("CD505 a background command Coder stops itself shows \"stopped\" on its own step (live test after deploy 123: it said \"running\" after Coder's stop, because a job Coder stops gets no end notice); a chat from before is read by Claude Code's words", async () => {
  // The agent: its stop's result names the job it stopped; a stop that found nothing running names none.
  const steps = [say("", [call("bash", { command: "python3 -m http.server 8000", run_in_background: true }, "b1")]), say("", [call("stop_job", { job: "job1" }, "s1")]), say("", [call("stop_job", { job: "job1" }, "s2")]), say("Done.")];
  let n = 0, running = true;
  const events = [];
  await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async ({ command }) => (command.startsWith("python3") ? { code: -1, background: true, pid: 4242, log: "/srv/bg/bg-1.log", output: "" } : { code: 0, output: "" }),
    bg: { alive: async () => running, stop: async () => { running = false; return true; } },
    emit: (e) => events.push(e),
  }, { text: "serve the folder" });
  const res = (id) => events.find((e) => e.type === "result" && e.id === id);
  assert.equal(res("s1").stoppedJob, "job1");
  assert.equal(res("s2").stoppedJob, undefined, "it was not running: nothing stopped");
  // The page: how each background command ended, from notes and from Coder's stops.
  const bgEndsOf = new Function("return " + pageFn("  function bgEndsOf(events) {").trim())();
  const ends = bgEndsOf([
    { type: "note", job: "job1", end: { ok: true, label: "ended" } },
    { type: "note", jobs: ["job2"] },
    { type: "result", id: "s1", code: 0, output: "Successfully stopped task: job3 (sleep 300)", stoppedJob: "job3" },
    { type: "result", id: "s2", code: 0, output: "Successfully stopped task: job4 (tail -f /dev/null)" },
    { type: "result", id: "s3", code: 1, output: "Task job5 is not running (status: completed)" },
  ]);
  assert.deepEqual(ends, { job1: { ok: true, label: "ended" }, job2: { ok: false, label: "stopped" }, job3: { ok: false, label: "stopped" }, job4: { ok: false, label: "stopped" } });
  assert.match(ui, /S\.bgEnded = bgEndsOf\(S\.events\);/);
});

test("CD506 every hook finds the chat's scratch folder it is told about (live test after deploy 124: in a new chat the first PreToolUse hook ran before any command had made it: \"Directory nonexistent\"); the same line Coder's commands start with", async () => {
  const H = await import("../container/coder-hooks.mjs");
  for (const h of [{ type: "command", command: "echo hi" }, { type: "command", command: "/opt/check", args: ["--fast"] }, { type: "command", shell: "powershell", command: "Write-Output hi" }]) {
    assert.ok(H.hookShell(h, "MARK", "/work/shop").startsWith(H.HOOK_SCRATCH_MAKE), "made first, whatever the hook's kind");
  }
  // The same command as the one every command starts with (SCRATCH_MAKE), and it works in plain sh: made once, private.
  assert.equal(H.HOOK_SCRATCH_MAKE.replace(/; $/, "\n"), S.SCRATCH_MAKE);
  assert.equal(H.hookInput("PreToolUse", { cwd: "/w" }).scratchpad_dir, "/tmp/coder-scratch", "the folder hooks are told about is that one");
  const { mkdtempSync, statSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const base = mkdtempSync((process.env.TMPDIR || tmpdir()) + "/cd506-");
  const line = H.HOOK_SCRATCH_MAKE.split("/tmp/coder-scratch").join(base + "/scratch");
  execFileSync("sh", ["-c", line + line + "echo ok"]);
  assert.equal(statSync(base + "/scratch").mode & 0o777, 0o700);
  rmSync(base, { recursive: true, force: true });
});

test("CD507 a running monitor is read every 200 ms, Claude Code's batching, so a busy command meets its limits as there (live test after deploy 124: read every 5 seconds, a 10-lines-a-second loop made 17 big events a minute and was never limited; Claude Code's own suppressed events after 10 and stopped it at 30 seconds)", async () => {
  const { mkdtempSync, writeFileSync, appendFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync((process.env.TMPDIR || tmpdir()) + "/cd507-");
  const log = dir + "/bg-1.log";
  writeFileSync(log, "");
  const j = { project: "shop-cd507", id: "job1", pid: 999507, log, command: "while true; do echo tick; sleep 0.1; done", desc: "Ticks", mark: "0123456789abcd07", monitor: true, readAt: 0, part: "", pending: [], dropped: 0, end: null, told: false, stopping: "", at: 0, deadline: Infinity };
  S.JOBS.set(j.pid, j);
  try {
    // Two lines every 200 ms (10 a second), each read one event.
    const t0 = 5_000_000;
    let k = 0, now = t0;
    for (; k < 200 && !j.stopping; k++) { now = t0 + k * S.MONITOR_BATCH_MS; appendFileSync(log, "tick\ntick\n"); assert.equal(S.readMonitors(now), 1); }
    assert.equal(j.stopping, "flood", "stopped for flooding");
    const secs = (now - t0) / 1000;
    assert.ok(secs > 30 && secs < 33, "after about 30 seconds of it (" + secs + "s)");
    const events = j.pending.filter((e) => e === "tick\ntick");
    const notices = j.pending.filter((e) => /^\[\d+ events suppressed — output rate too high\. Consider using stop_job to restart this monitor with a more selective filter\.\]$/.test(e));
    assert.ok(events.length >= 10 && events.length <= 30, "10 at once, then one every 2 seconds (" + events.length + ")");
    assert.ok(notices.length >= 10, "the skipped ones said, as they were in Claude Code (" + notices.length + ")");
    assert.match(j.floodNote, /^\[Monitor stopped — too much output \(\d+ events suppressed over 3\ds\)\. Restart with a more selective source\.\]$/);
    // An ended or stopping monitor is not read again.
    assert.equal(S.readMonitors(now + 200), 0);
  } finally { S.JOBS.delete(999507); rmSync(dir, { recursive: true, force: true }); }
  // On the real machine only: a machine made in a test reads its monitors on its own clock.
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /if \(liveFetch\) \{\n\s+const monitorTimer = setInterval\(\(\) => \{ try \{ readMonitors\(\); \} catch \{ \/\* next time \*\/ \} \}, MONITOR_BATCH_MS\);/);
  assert.equal(S.MONITOR_BATCH_MS, 200);
});
