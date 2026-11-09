// BACKGROUND COMMANDS, SEEN AND STOPPED BY CODER'S SERVICE (live test, 2026-11-08, issue #12 on the test
// repository: in the admin sandbox, `monitor` said "[not running]" while `python3 -m http.server` served,
// and `stop_job` said "[stopped job1]" but the server kept listening: both ran `kill` inside the sandbox,
// where the machine's process numbers mean nothing). Now the service that started the command answers both.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test("CD199 the agent asks Coder's service whether a background job runs, and has the service stop it (never a kill inside the sandbox); without the service (a test machine), the commands of before", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const steps = [
    say("", [call("bash", { command: "python3 -m http.server 8000", run_in_background: true }, "b1")]),
    say("", [call("monitor", { job: "job1" }, "m1")]),
    say("", [call("stop_job", { job: "job1" }, "s1")]),
    say("", [call("monitor", { job: "job1" }, "m2")]),
    say("", [call("stop_job", { job: "job1" }, "s2")]),
    say("Done.", []),
  ];
  let n = 0, running = true;
  const sent = [], asked = [];
  const events = [];
  await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async ({ command }) => { sent.push(command); return command.startsWith("python3") ? { code: -1, background: true, pid: 4242, log: "/srv/bg/bg-1.log", output: "" } : { code: 0, output: "Serving HTTP on 0.0.0.0 port 8000\n" }; },
    bg: { alive: async (pid) => { asked.push(["alive", pid]); return running; }, stop: async (pid) => { asked.push(["stop", pid]); running = false; return true; } },
    emit: (e) => events.push(e),
  }, { text: "serve the folder" });
  const out = (id) => events.find((e) => e.type === "result" && e.id === id).output;
  assert.equal(out("m1"), "Serving HTTP on 0.0.0.0 port 8000\n[still running]", "the service says it runs");
  assert.equal(out("s1"), "[stopped job1]");
  assert.equal(out("m2"), "Serving HTTP on 0.0.0.0 port 8000\n[not running]");
  assert.equal(out("s2"), "[job1 had already ended]");
  // The round's end asks too (a background command that ended is told once, like Claude Code's notice); once stopped, no more.
  assert.deepEqual(asked, [["alive", 4242], ["alive", 4242], ["alive", 4242], ["alive", 4242], ["stop", 4242], ["alive", 4242], ["alive", 4242]]);
  assert.ok(!sent.some((c) => /kill/.test(c)), "no kill sent as a command: " + JSON.stringify(sent));
  assert.deepEqual(sent.filter((c) => c.startsWith("tail")), ["tail -n 40 /srv/bg/bg-1.log", "tail -n 40 /srv/bg/bg-1.log"]);

  // Without the service's help: the commands of before.
  n = 0; sent.length = 0; events.length = 0;
  await runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec: async ({ command }) => { sent.push(command); return command.startsWith("python3") ? { code: -1, background: true, pid: 4242, log: "/srv/bg/bg-1.log", output: "" } : { code: 0, output: "" }; }, emit: (e) => events.push(e) }, { text: "serve" });
  assert.ok(sent.some((c) => c.includes("kill -0 4242")) && sent.some((c) => c.includes("kill -TERM -- -4242")));
});

test("CD200 on Coder's machine: a real background command is reported running, stopped for real by stop_job (with what it started), then reported ended; another job's process can never be stopped this way", async () => {
  const { createApp } = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-bgw-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-bgg-")), memRoot: await mkdtemp(join(tmpdir(), "coder-bgm-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-bgb-")) };
  const steps = [
    say("", [call("bash", { command: "node -e \"setInterval(() => {}, 1000)\" & node -e \"console.log('child', process.pid); setInterval(() => {}, 1000)\"", run_in_background: true }, "b1")]),
    say("", [call("monitor", { job: "job1", wait_s: 1 }, "m1")]),
    say("", [call("stop_job", { job: "job1" }, "s1")]),
    say("", [call("monitor", { job: "job1" }, "m2")]),
    say("Done.", []),
  ];
  let n = 0;
  const app = createApp({ ...roots, send: async () => steps[Math.min(n++, steps.length - 1)] });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "bg-test1", text: "go", messages: [] }) });
    let st;
    for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=bg-test1&since=0")).json(); if (st.result) break; await new Promise((r) => setTimeout(r, 100)); }
    const res = (id) => (st.events.find((e) => e.type === "result" && e.id === id) || {}).output || "";
    assert.match(res("m1"), /child \d+/, res("m1"));
    assert.match(res("m1"), /\[still running\]$/, res("m1"));
    const child = Number(/child (\d+)/.exec(res("m1"))[1]);
    assert.equal(res("s1"), "[stopped job1]");
    assert.match(res("m2"), /\[not running\]$/);
    assert.equal(alive(child), false, "what it started is gone too");
  } finally { srv.close(); }
});

test("CD201 Coder is told its network setting when it is Full too (live test, 2026-11-08: asked which setting its environment has, it could not tell); a limited one is said as before", async () => {
  const { createApp } = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-nw-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-nwg-")), memRoot: await mkdtemp(join(tmpdir(), "coder-nwm-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-nwb-")) };
  const seen = [];
  const app = createApp({ ...roots, send: async (req) => { seen.push(req); return say("Done.", []); } });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "nw-test1", text: "go", messages: [], setup: { script: "", network: { mode: "full" } } }) });
    for (let i = 0; i < 100 && !seen.length; i++) await new Promise((r) => setTimeout(r, 50));
    assert.match(seen[0].messages[0].content, /\n\nNETWORK: FULL\. This chat's environment allows any site on the internet \(the owner can limit it in Environment, Network access\)\./);
  } finally { srv.close(); }
});
