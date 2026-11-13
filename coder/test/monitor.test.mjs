// CLAUDE CODE'S MONITOR (the owner, 2026-11-10: "yea do all 4"; Claude Code's tools reference: "Runs a command in the
// background and feeds each output line back to Claude, so it can react to log entries, file changes, or polled status
// mid-conversation"): Coder's monitor tool, its lines given to Coder as events at each step (and an idle chat woken for
// them), its deadline (5 minutes unless asked, 30 at most), and a stop for one that prints too much.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const SV = await import("../container/server.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

test("CD381 the monitor tool: Claude Code's inputs (command, description, timeout_ms), run the bash way in the background (the same checks and rules), its deadline 5 minutes unless asked and 30 at most, and what Coder is told when it starts", async () => {
  const tool = A.CODER_TOOLS.find((t) => t.function.name === "monitor").function;
  // (Or a WebSocket, `ws`, in place of the command: CD385.)
  assert.deepEqual(Object.keys(tool.parameters.properties), ["command", "ws", "description", "timeout_ms"]);
  assert.deepEqual(tool.parameters.required, ["description"]);
  assert.match(tool.description, /every stdout line comes to you as an event while you work/);
  assert.match(tool.description, /default 300000, 5 minutes; at most 1800000, 30 minutes/);
  assert.deepEqual([A.monitorMs(undefined), A.monitorMs(600000), A.monitorMs(99_999_999), A.monitorMs(5)], [300000, 600000, 1800000, 1000]);
  // It goes the bash way: in the background, marked, with its deadline.
  const execs = [], events = [];
  let k = 0;
  const turns = [say("", [call("monitor", { command: "tail -f build.log | grep --line-buffered ERROR", description: "Errors in the build log", timeout_ms: 600000 })]), say("watching")];
  await A.runCoder({ send: async () => turns[k++], exec: async (o) => { execs.push(o); return { code: 0, output: "", background: true, pid: 4242, log: "/srv/coder-bg/bg-1.log", jobId: "job1", errLog: "/home/dev/.coder-monitors/abc.err" }; }, emit: (e) => events.push(e) }, { text: "watch the build log for errors" });
  // (Coder's own looks at its background jobs at the end of a job are tool calls: only the commands it ran count here.)
  const runs = execs.filter((e) => !e.tool);
  assert.equal(runs.length, 1);
  assert.deepEqual([runs[0].monitor, runs[0].inBg, runs[0].limitMs, runs[0].desc], [true, true, 600000, "Errors in the build log"]);
  assert.ok(events.some((e) => e.type === "bash" && e.monitor === true && e.desc === "Errors in the build log"), "the chat shows it as a monitor");
  const res = events.find((e) => e.type === "result");
  // (Claude Code 2.1.322's words; where its output and stderr go are no part of them: Bash docs pass 9.)
  assert.match(res.output, /^Monitor started \(task job1, expires in 10m unless the source ends first; you get one notice at expiry \u2014 re-arm if you still need the watch\)\. You will be notified on each event\. Keep working \u2014 do not poll or sleep\. Events may arrive while you are waiting for the owner \u2014 an event is not their reply\.$/);
  // The same rules as bash: a deny rule for the command stops it.
  const execs2 = [];
  let k2 = 0;
  const turns2 = [say("", [call("monitor", { command: "rm -rf build && watch ls", description: "x" })]), say("ok")];
  await A.runCoder({ send: async () => turns2[k2++], exec: async (o) => { execs2.push(o); return { code: 0, output: "" }; }, emit: () => {} }, { text: "go", rules: { allow: [], ask: [], deny: ["Bash(rm *)"] } });
  assert.equal(execs2.filter((e) => !e.tool).length, 0, "a Bash deny rule refuses a monitor's command too");
  // Coder's old monitor (a look at a background command's output) is gone, as Claude Code's TaskOutput is: Coder reads the file.
  assert.equal(A.CODER_TOOLS.filter((t) => t.function.name === "monitor").length, 1);
  assert.doesNotMatch(read("container/coder-agent.mjs"), /wait_s \(0-60\) waits first/);
  assert.match(read("container/coder-agent.mjs"), /then read its output file \(and curl to check a server\), stop_job when done\. To be told when something happens/);
  // The auto mode checker sees a monitor as it sees bash (it runs a command).
  assert.match(read("container/coder-checker.mjs"), /const LOOKUPS = new Set\(\["read", "grep", "glob", "lsp", "todo", "review", "ask_user"\]\);/);
  // With background commands off (CODER_DISABLE_BACKGROUND_TASKS), a monitor still runs (Claude Code: "the Monitor tool still run[s]").
  assert.match(read("container/server.mjs"), /stopAtTimeout: !!sleepFirst \|\| \(t\.noBg && !monitor\) \}\)/);
});

test("CD381b a monitor's lines come to Coder as events at each step (and wake an idle chat): read from its output file as they arrive, whole lines only, never the end line; told once how it ended; one that prints too many lines is stopped", async () => {
  // THE MACHINE: a monitor job with a real output file.
  const dir = mkdtempSync(join(tmpdir(), "mon-"));
  const log = join(dir, "bg-1.log");
  writeFileSync(log, "");
  const j = { project: "shop-m1", id: "job7", pid: 999971, log, command: "tail -f x", desc: "The server's log", mark: "0123456789abcde0", monitor: true, readAt: 0, part: "", pending: [], dropped: 0, end: null, told: false, stopping: "", deadline: Date.now() + 60_000 };
  SV.JOBS.set(j.pid, j);
  try {
    appendFileSync(log, "listening on 3000\nGET / 200\nhalf a li");
    assert.equal(SV.readMonitor(j), 2);
    assert.deepEqual(SV.untoldOf("shop-m1").map((x) => x.id), ["job7"], "lines waiting: the chat is woken for them");
    // (The lines read together are one event, as Claude Code's batcher makes one of lines that come close together: Bash
    // docs pass 9.)
    assert.deepEqual(SV.monitorNews("shop-m1"), [{ id: "job7", desc: "The server's log", lines: ["listening on 3000\nGET / 200"], dropped: 0 }]);
    assert.deepEqual(SV.monitorNews("shop-m1"), [], "given once");
    appendFileSync(log, "ne\nGET /api 500\n[finished, exit code 0]\n");
    j.end = { code: 0, why: "", at: Date.now() };
    assert.deepEqual(SV.monitorNews("shop-m1"), [{ id: "job7", desc: "The server's log", lines: ["half a line\nGET /api 500"], dropped: 0, end: { code: 0, why: "", events: 2, ...(Number(j.deadline) > Number(j.at) ? { ms: j.deadline - j.at } : {}) } }], "the rest, and how it ended; never the end line");
    assert.equal(j.told, true);
    assert.deepEqual(SV.monitorNews("shop-m1"), []);
    // ONE THAT PRINTS TOO MANY LINES is stopped (its mark kept or not as Settings say).
    const log2 = join(dir, "bg-2.log");
    writeFileSync(log2, Array.from({ length: 450 }, (_, i) => "line " + i).join("\n") + "\n");
    const j2 = { project: "shop-m1", id: "job8", pid: 999972, log: log2, command: "yes", desc: "Too much", mark: "0123456789abcde1", monitor: true, readAt: 0, part: "", pending: [], dropped: 0, end: null, told: false, stopping: "" };
    SV.JOBS.set(j2.pid, j2);
    // (Claude Code's limits: 10 events at once, then one every 2 seconds; past that they are counted, and after 30 seconds of
    // that it is stopped. One read of 450 lines is one event, cut at 3,000 characters.)
    const t0 = 1_000_000;
    SV.readMonitor(j2, { now: t0 });
    assert.equal(j2.pending.length, 1);
    assert.ok(j2.pending[0].endsWith("\n...(truncated)") && j2.pending[0].length <= 3000 + 16);
    for (let k = 1; k <= 12; k++) { appendFileSync(log2, "more " + k + "\n"); SV.readMonitor(j2, { now: t0 + k }); }
    assert.equal(j2.pending.length, 10, "ten at once");
    assert.equal(j2.suppressed, 3);
    assert.ok(!j2.stopping, "not stopped yet");
    // Still too fast, two a second, for 30 seconds more: stopped, in Claude Code's words.
    for (let k = 1; k <= 80 && !j2.stopping; k++) { appendFileSync(log2, "flood " + k + "\n"); SV.readMonitor(j2, { now: t0 + 12 + k * 500 }); }
    assert.equal(j2.stopping, "flood");
    assert.match(j2.floodNote, /^\[Monitor stopped \u2014 too much output \(\d+ events suppressed over 3\ds\)\. Restart with a more selective source\.\]$/);
    // The wake turn's notices leave monitors out (their news comes at each step).
    assert.match(read("container/server.mjs"), /const notices = untoldOf\(project\)\.filter\(\(j\) => j\.end && !j\.monitor && !j\.hook\)\.map/);
    // Its stderr goes to a file of its own, in Coder's home, so its output file holds only its events.
    assert.match(read("container/server.mjs"), /if \(errLog\) command = "mkdir -p \\"\$HOME\/\.coder-monitors\\" 2>\/dev\/null; exec 2>>\\"\$HOME\/\.coder-monitors\/" \+ mark \+ "\.err\\"\\n" \+ command;/);
  } finally { SV.JOBS.delete(999971); SV.JOBS.delete(999972); }
  // CODER'S LOOP: each step, the news first, as a note from Coder's app; the chat shows it.
  assert.equal(A.monitorSaid({ id: "job7", desc: "The server's log", lines: ["GET /api 500"], dropped: 3, end: { why: "flood" } }), "Monitor event: \"The server's log\" (job7)\nGET /api 500\n\n(3 more lines were left out: too many at once)\n\nMonitor \"The server's log\" (job7) was stopped: it printed too many lines. Start it again with a tighter filter (grep --line-buffered, or awk with fflush()) if you still need it.");
  assert.match(A.monitorSaid({ id: "job1", desc: "Deploy", lines: [], end: { why: "limit" } }), /^Monitor "Deploy" \(job1\) reached its deadline and ended\. Start it again if you still need it\.$/);
  assert.match(A.monitorSaid({ id: "job1", desc: "Deploy", lines: [], end: { why: "exit", code: 2 } }), /script failed \(exit 2\)\.$/);
  // Every other way it can end, in words (the owner's Stop, too much output, low memory, the machine's own stop).
  assert.deepEqual(["owner", "size", "memory", "lost", "coder"].map((why) => A.monitorSaid({ id: "job1", desc: "Deploy", lines: [], end: { why } }).replace(/^Monitor "Deploy" \(job1\) /, "")), ["was stopped by the owner.", "was stopped: its output passed 5 GB.", "was stopped: Coder's machine was low on memory.", "was stopped by Coder's machine before it ended. Start it again if you still need it.", "stopped."], "stopped by Coder: Claude Code's \"Monitor … stopped\"");
  // And on the step that started it, as a background command's end: a ✓ for exit 0, else what ended it.
  assert.deepEqual([{ why: "exit", code: 0 }, { why: "", code: 0 }, { why: "exit", code: 3 }, { why: "limit" }, { why: "flood" }, { why: "owner" }].map(A.monitorEndLabel), [{ ok: true, label: "" }, { ok: true, label: "" }, { ok: false, label: "exit 3" }, { ok: false, label: "deadline" }, { ok: false, label: "too many lines" }, { ok: false, label: "stopped" }]);
  // Its end is told with its lines, never again as a background command's (the round's own check skips monitors), and a
  // monitor still running from an earlier message is known as one.
  assert.match(read("container/coder-agent.mjs"), /if \(j\.monitor && typeof deps\.monitorNews === "function"\) continue;/);
  assert.match(read("container/server.mjs"), /cwd: j\.cwd, \.\.\.\(j\.monitor \? \{ monitor: true \} : \{\}\) \}\)\),/);
  // An idle chat woken for them: no message, only the news; Coder still answers it.
  const sent = [], events = [];
  let news = [{ id: "job7", desc: "The server's log", lines: ["GET /api 500"], dropped: 0 }];
  await A.runCoder({ send: async (req) => { sent.push(req.messages); return say("I saw a 500"); }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), monitorNews: () => { const n = news; news = []; return n; } }, { messages: [{ role: "user", content: "watch the server" }, { role: "assistant", content: "Watching." }], text: "" });
  assert.equal(sent.length, 1);
  assert.match(sent[0].at(-1).content, /^\(Note from Coder's app, not the owner: Monitor event: "The server's log" \(job7\)\nGET \/api 500\)$/);
  const ev = events.find((e) => e.type === "note" && e.monitor);
  assert.deepEqual(ev.monitor, { job: "job7", desc: "The server's log", lines: ["GET /api 500"] });
});

test("CD381c the page shows a monitor's step with the eye, and each event with the lines it printed and how it ended; never markup", () => {
  const src = read("public/coder.js");
  const grab = (name) => src.slice(src.indexOf("  function " + name + "("), src.indexOf("\n  }\n", src.indexOf("  function " + name + "(")) + 4);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const ends = src.slice(src.indexOf("  const MONITOR_END = "), src.indexOf("\n", src.indexOf("  const MONITOR_END = ")));
  const STEP_ICON = { bash: "b", monitor_job: "m" };
  const { monitorHTML } = new Function("esc", "STEP_ICON", ends + grab("noColor") + grab("stepIcon") + grab("monitorHTML") + "return { monitorHTML };")(esc, STEP_ICON);
  const h = monitorHTML({ job: "job7", desc: "The <server>'s log", lines: ["GET /api 500", "<b>x</b>"], dropped: 2, end: { why: "exit", code: 0 } });
  assert.match(h, /<b>Monitor event<\/b> · The &lt;server&gt;&#39;s log · ended \(exit 0\)/);
  assert.match(h, /<pre class="cd-monev-lines">GET \/api 500\n&lt;b&gt;x&lt;\/b&gt;\n\(2 more left out\)<\/pre>/);
  assert.match(h, /<path d="m"\/>/, "the eye");
  assert.match(monitorHTML({ desc: "Deploy", lines: [], end: { why: "limit" } }), /<b>Monitor<\/b> · Deploy · reached its deadline<\/span><\/div><\/div>$/);
  assert.match(src, /else if \(e\.type === 'note'\) out\.push\(e\.monitor && typeof e\.monitor === 'object' \? monitorHTML\(e\.monitor\) : /);
  assert.match(src, /const k = e\.tool === 'monitor' \|\| e\.monitor === true \? 'monitor_job' : /);
  // The group line says "started 1 monitor" (a step of the old monitor, in an old chat, still "checked 1 background job").
  const gw = src.slice(src.indexOf("  function groupWords("), src.indexOf("\n  }\n", src.indexOf("  function groupWords(")) + 4);
  const { groupWords } = new Function(gw + "return { groupWords };")();
  assert.equal(groupWords([{ tool: "monitor_start" }, { tool: "monitor_start" }, { tool: "" }]).line, "Started 2 monitors, ran 1 command");
  assert.equal(groupWords([{ tool: "monitor" }]).line, "Checked 1 background job");
  // (Any other step's kind is its tool, by kindOf, since Gloopy's chat merged in, 2026-11-13.)
  assert.match(src, /tool: !e\.tool && e\.monitor === true \? 'monitor_start' : kindOf\(e\)/);
  assert.match(src, /return 'pay_result'; return e\.tool \|\| ''; \};/);
});
