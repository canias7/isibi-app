// CLAUDE CODE'S MONITOR ON A WEBSOCKET, ITS MONITOR RULES, AND CODER_SHELL (Bash docs, the owner, 2026-11-10: "yea do all of
// them"): the `ws` source ("Each text frame is an event; binary frames are reported as a placeholder line. Socket close ends
// the watch"), its questions and refusals, rules that name Monitor, and zsh for Coder's commands (CLAUDE_CODE_SHELL).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const ZSH = ["/usr/bin/zsh", "/bin/zsh"].find((p) => existsSync(p)) || "";

test("CD385 Monitor's WebSocket input and rules, in Claude Code's words: the url and protocols checked; a rule denying every Bash command refuses it, one asking for every Bash command asks only the owner; Monitor rules join Bash's for a monitor's command and are set aside in Auto", async () => {
  const P = await import("../container/coder-perms.mjs");
  const C = await import("../container/coder-checker.mjs");
  const w = (ws, more = {}) => P.wsProblem({ ws, description: "Feed", ...more });
  assert.deepEqual([w({ url: "wss://feed.example.com/v1?x=1" }), w({ url: "ws://feed.example.com:8080/", protocols: ["graphql-ws", "v2.chat"] })], ["", ""]);
  assert.equal(w({ url: "https://feed.example.com" }), "url must be a valid ASCII ws:// or wss:// URL with no userinfo or whitespace");
  assert.equal(w({ url: "wss://me:secret@feed.example.com" }), "url must be a valid ASCII ws:// or wss:// URL with no userinfo or whitespace");
  assert.equal(w({ url: "wss://féed.example.com" }), "url must be a valid ASCII ws:// or wss:// URL with no userinfo or whitespace");
  assert.equal(w({ url: "wss://feed.example.com/‮" }), "url contains control characters that would be hidden in the approval dialog");
  assert.equal(w({ url: "wss://x.io", protocols: ["a b"] }), "protocol must be an RFC 6455 token");
  assert.equal(w({ url: "wss://x.io", protocols: ["a", "a"] }), "protocols must be unique");
  assert.equal(P.wsProblem({ ws: { url: "wss://x.io" }, command: "tail -f x", description: "x" }), "ws cannot be combined with command: give one of them");
  // THE QUESTIONS (Claude Code's tools reference).
  assert.deepEqual(P.wsDecision({ rules: { deny: ["Bash(*)"] } }), { verdict: "deny", why: "Permission to use Monitor has been denied: it runs code as Bash does, and a rule denies Bash." });
  assert.equal(P.MONITOR_BASH_DENIED, "Permission to use Monitor has been denied: it runs code as Bash does, and a rule denies Bash.");
  assert.deepEqual(P.wsDecision({ rules: { deny: ["Monitor"] } }).why, "Permission to use Monitor has been denied.");
  assert.deepEqual([P.wsDecision({ rules: { ask: ["Bash"] }, mode: "auto" }).strict, P.wsDecision({ rules: { ask: ["Monitor"] }, mode: "auto" }).strict], [true, undefined]);
  assert.deepEqual([P.wsDecision({ rules: { allow: ["Monitor"] }, mode: "acceptEdits" }).verdict, P.wsDecision({ rules: { allow: ["Monitor"] }, mode: "auto" }).verdict, P.wsDecision({ mode: "plan" }).verdict, P.wsDecision({ mode: "auto" }).verdict], ["allow", "check", "ask", "check"]);
  assert.deepEqual(P.wsDecision({ rules: { allow: ["Bash"] }, mode: "acceptEdits" }).verdict, "ask", "a Bash allow rule is no Monitor allow rule");
  // MONITOR RULES: kept as rules; for a monitor's command they are Bash's; in Auto their allow rules are set aside.
  assert.deepEqual([P.parseRule("Monitor"), P.parseRule("Monitor(*)"), P.parseRule("Monitor(tail -f *)")], [{ tool: "Monitor", spec: null }, { tool: "Monitor", spec: null }, { tool: "Monitor", spec: "tail -f *" }]);
  assert.deepEqual(P.monitorRules({ allow: ["Monitor(tail -f *)", "Bash(npm test)", "Read(.env)"], ask: ["Monitor"], deny: ["Monitor(rm *)"] }, "acceptEdits"), { allow: ["Bash(tail -f *)", "Bash(npm test)", "Read(.env)"], ask: ["Bash"], deny: ["Bash(rm *)"], named: { "allow:Bash(tail -f *)": "Monitor(tail -f *)", "ask:Bash": "Monitor", "deny:Bash(rm *)": "Monitor(rm *)" } });
  assert.deepEqual(P.monitorRules({ allow: ["Monitor", "Bash(npm test)"] }, "auto").allow, ["Bash(npm test)"]);
  assert.deepEqual([C.droppedInAuto("Monitor"), C.droppedInAuto("Monitor(tail -f x)"), C.droppedInAuto("Bash(npm test)")], [true, true, false]);
  assert.equal(P.ruleSaved("Monitor(tail -f *)"), true);
  assert.match(read("src/coder-routes.mjs"), /Write, Grep, Glob or Monitor" \}, 400\);/);
  assert.doesNotMatch(read("container/coder-perms.mjs"), /from "node:/);
});

/** A small WebSocket server on this computer (RFC 6455; its frames unmasked): `script(sock, frame)` says what it sends. */
async function wsServer(script) {
  const frame = (op, payload, fin = true) => { const p = Buffer.from(payload); const n = p.length; const h = n < 126 ? Buffer.from([(fin ? 0x80 : 0) | op, n]) : n < 65536 ? (() => { const b = Buffer.alloc(4); b[0] = (fin ? 0x80 : 0) | op; b[1] = 126; b.writeUInt16BE(n, 2); return b; })() : (() => { const b = Buffer.alloc(10); b[0] = (fin ? 0x80 : 0) | op; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })(); return Buffer.concat([h, p]); };
  const seen = { protocols: [], pongs: 0, closes: 0 };
  const srv = http.createServer((q, r) => { r.writeHead(400); r.end(); });
  srv.on("upgrade", (req, sock) => {
    seen.protocols.push(req.headers["sec-websocket-protocol"] || "");
    const acc = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n");
    sock.on("data", (d) => { if ((d[0] & 0x0f) === 10) seen.pongs++; if ((d[0] & 0x0f) === 8) seen.closes++; });
    sock.on("error", () => {});
    script(sock, frame);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { url: "ws://127.0.0.1:" + srv.address().port + "/feed?room=1", seen, close: () => { srv.close(); srv.closeAllConnections?.(); } };
}

test("CD385b the WebSocket watch on Coder's machine: each text message one event (however many lines), a binary one a placeholder, fragments joined, pings answered; it ends with the close code, at a message over 1 MiB, or when the socket drops; never a private address", async () => {
  const T = await import("../container/coder-tools.mjs");
  const run = async (url, more = {}) => { let out = ""; await T.toolWsWatch({ url, ...more }, { out: (t) => (out += t), allowPrivate: true }); return out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); };
  const s1 = await wsServer((sock, frame) => {
    sock.write(frame(1, "deploy started\nstep 1 of 3"));
    sock.write(frame(1, "half ", false)); sock.write(frame(0, "and half", true));
    sock.write(frame(2, Buffer.alloc(512)));
    sock.write(frame(9, "ping"));
    setTimeout(() => { const b = Buffer.alloc(8); b.writeUInt16BE(4001, 0); b.write("finished", 2); sock.write(frame(8, b)); }, 80);
  });
  try {
    assert.deepEqual(await run(s1.url, { protocols: ["chat", "v2"] }), ["deploy started\nstep 1 of 3", "half and half", "[binary frame, 512 bytes]", { close: 4001, reason: "finish" }]);
    await new Promise((ok) => setTimeout(ok, 150));
    assert.deepEqual([s1.seen.protocols[0], s1.seen.pongs, s1.seen.closes], ["chat, v2", 1, 1], "the protocols offered; its ping answered; its close answered");
  } finally { s1.close(); }
  const s2 = await wsServer((sock, frame) => sock.write(frame(1, "x".repeat(1024 * 1024 + 1))));
  try { assert.deepEqual(await run(s2.url), [{ tooBig: 1048577 }]); } finally { s2.close(); }
  const s3 = await wsServer((sock, frame) => { sock.write(frame(1, "only this")); setTimeout(() => sock.destroy(), 50); });
  try { assert.deepEqual(await run(s3.url), ["only this", { close: 1006 }], "dropped without a close: 1006"); } finally { s3.close(); }
  // From the command line: never a private address ("Claude Code denies URLs that point at a private, link-local, or
  // cloud-metadata address").
  for (const url of ["ws://127.0.0.1:9/x", "ws://169.254.169.254/latest", "ws://[::1]:9/", "ws://10.0.0.5/"]) { let out = ""; await T.toolWsWatch({ url }, { out: (t) => (out += t) }); assert.deepEqual(JSON.parse(out), { error: "that address is on a private network" }, url); }
  assert.match(read("container/coder-tools.mjs"), /ws_watch: toolWsWatch \};/);
});

/** Coder's loop with a WebSocket monitor on a pretend machine. */
async function job(steps, { mode = "acceptEdits", rules = null, answers = [], hookRun = null, hooks = null, checker = false, checkerSays = () => '{"decision":"allow"}', execs = [], github = false } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const events = [], seen = [], cards = [], checks = [];
  let n = 0, k = 0;
  const r = await runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (/^You are the safety checker/.test(sys)) { checks.push(req); return { message: { role: "assistant", content: checkerSays(req) }, usage: { in: 1, out: 1 } }; }
      seen.push(req);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const a = (hookRun && (await hookRun(JSON.parse(x.payload)))) || {}; return { code: a.code || 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
      if (x.envReset) return { code: 0, output: "" };
      execs.push(x);
      if (x.ws) return { code: -1, background: true, pid: 777, log: "/srv/coder-bg/bg-9.log", jobId: "job3" };
      return { code: 0, output: "ok\n", ...(x.monitor ? { background: true, pid: 778, log: "/srv/coder-bg/bg-8.log", jobId: "job4" } : {}) };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ...(github ? {} : { ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; } }),
  }, { text: "watch the deploy feed", mode, rules, checker, checkWhere: { key: "ws-" + Math.random() }, github, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}) });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "";
  return { r, events, seen, cards, checks, execs, told };
}
const wsCall = (id = "m1", ws = { url: "wss://feed.example.com/deploys", protocols: ["v1"] }) => call("monitor", { ws, description: "Deploy feed", timeout_ms: 600000 }, id);

test("CD385c a WebSocket watch in Coder's loop: asked about on a card (no \"don't ask again\") unless a Monitor allow rule covers it; judged by the checker in Auto; refused under a rule denying every Bash command (Coder has no monitor tool then); under one asking for every Bash command only the owner approves it; then opened as a monitor whose events are its messages", async () => {
  const A = await import("../container/coder-agent.mjs");
  // ASKED in Accept edits: the card names the address; Yes opens it as a monitor in the background.
  let t = await job([say("", [wsCall()]), say("Watching.")]);
  assert.deepEqual([t.cards.length, t.cards[0].tool, t.cards[0].url, t.cards[0].desc, t.cards[0].rules], [1, "monitor", "wss://feed.example.com/deploys", "Deploy feed", undefined]);
  assert.equal(t.cards[0].why, "Coder wants to open a WebSocket to feed.example.com and watch its messages.");
  const x = t.execs.find((e) => e.ws);
  assert.deepEqual([x.monitor, x.inBg, x.limitMs, x.desc], [true, true, 600000, "Deploy feed"]);
  const req = JSON.parse(Buffer.from(/coder-tools\.mjs (\S+)$/.exec(x.command)[1], "base64").toString("utf8"));
  assert.deepEqual(req, { tool: "ws_watch", args: { url: "wss://feed.example.com/deploys", protocols: ["v1"] } });
  // (Claude Code 2.1.322's words for any monitor; Bash docs pass 9.)
  assert.match(t.told("m1"), /^Monitor started \(task job3, expires in 10m unless the source ends first; you get one notice at expiry \u2014 re-arm if you still need the watch\)\. You will be notified on each event\. Keep working \u2014 do not poll or sleep\. Events may arrive while you are waiting for the owner \u2014 an event is not their reply\.$/);
  assert.ok(t.events.some((e) => e.type === "bash" && e.id === "m1" && e.command === "WebSocket wss://feed.example.com/deploys" && e.monitor === true && e.ws === true));
  // No: not opened.
  t = await job([say("", [wsCall()]), say("ok")], { answers: [{ choice: "no" }] });
  assert.equal(t.execs.filter((e) => e.ws).length, 0);
  // A Monitor allow rule: no card (outside Auto).
  t = await job([say("", [wsCall()]), say("ok")], { rules: { allow: ["Monitor"] } });
  assert.deepEqual([t.cards.length, t.execs.filter((e) => e.ws).length], [0, 1]);
  // AUTO: the checker judges it (a Monitor allow rule set aside); blocked, it is not opened.
  t = await job([say("", [wsCall()]), say("ok")], { mode: "auto", checker: true, rules: { allow: ["Monitor"] }, checkerSays: () => '{"decision":"block","rule":"Data Exfiltration","reason":"an unknown host"}' });
  assert.deepEqual([t.checks.length, t.cards.length, t.execs.filter((e) => e.ws).length], [1, 0, 0]);
  assert.match(t.checks[0].messages[1].content, /THE ACTION TO JUDGE:\nmonitor: open a WebSocket to wss:\/\/feed\.example\.com\/deploys \(protocols v1\) \(Deploy feed\)/);
  assert.match(t.told("m1"), /\[Data Exfiltration\] an unknown host/);
  // A RULE DENYING EVERY BASH COMMAND: no monitor tool at all, and a call refused in Claude Code's words.
  t = await job([say("", [wsCall()]), say("ok")], { rules: { deny: ["Bash"] } });
  assert.ok(!t.seen[0].tools.some((x) => x.function && x.function.name === "monitor"));
  assert.equal(t.told("m1"), "Permission to use Monitor has been denied: it runs code as Bash does, and a rule denies Bash.");
  t = await job([say("", [call("monitor", { command: "tail -f log", description: "Log" }, "m2")]), say("ok")], { rules: { deny: ["Bash(*)"] } });
  assert.equal(t.told("m2"), "Permission to use Monitor has been denied: it runs code as Bash does, and a rule denies Bash.");
  // A RULE ASKING FOR EVERY BASH COMMAND: the owner is asked, and a PreToolUse hook's allow does not approve it.
  t = await job([say("", [wsCall()]), say("ok")], { mode: "auto", rules: { ask: ["Bash"] }, hooks: { PreToolUse: [{ matcher: "Monitor", hooks: [{ type: "command", command: "allow.sh" }] }] }, hookRun: () => ({ stdout: '{"hookSpecificOutput":{"permissionDecision":"allow"}}' }) });
  assert.deepEqual([t.cards.length, t.cards[0] && t.cards[0].byRule], [1, true]);
  assert.match(t.cards[0].why, /^Your rule Bash asks first for every command, and a WebSocket watch runs code as Bash does, so only you can approve it\.$/);
  // Where no one can answer (a job from GitHub): the checker, or with none, it is opened.
  t = await job([say("", [wsCall()]), say("ok")], { github: true });
  assert.equal(t.execs.filter((e) => e.ws).length, 1);
  // ITS INPUT CHECKED first, in Claude Code's words.
  t = await job([say("", [wsCall("m3", { url: "https://feed.example.com" })]), say("ok")]);
  assert.deepEqual([t.cards.length, t.told("m3")], [0, "error: url must be a valid ASCII ws:// or wss:// URL with no userinfo or whitespace"]);
  // A MONITOR'S COMMAND UNDER MONITOR RULES: Monitor(tail -f *) allows it without a card in Accept edits.
  t = await job([say("", [call("monitor", { command: "tail -f logs/app.log", description: "App log" }, "m4")]), say("ok")], { rules: { allow: ["Monitor(tail -f *)"] } });
  assert.deepEqual([t.cards.length, t.execs.filter((e) => e.monitor).length], [0, 1]);
  t = await job([say("", [call("monitor", { command: "tail -f logs/app.log", description: "App log" }, "m4")]), say("ok")], { rules: { deny: ["Monitor(tail *)"] } });
  assert.equal(t.execs.filter((e) => e.monitor).length, 0, "a Monitor deny rule refuses it");
  // HOW IT ENDED, told to Coder and shown under its step.
  const said = (end) => A.monitorSaid({ id: "job3", desc: "Deploy feed", lines: [], end });
  assert.equal(said({ code: 0, why: "exit", ws: { close: 1000 } }), 'Monitor "Deploy feed" (job3) ended: the WebSocket closed with code 1000.');
  assert.equal(said({ code: 0, why: "exit", ws: { close: 4001, reason: "deploy done" } }), 'Monitor "Deploy feed" (job3) ended: the WebSocket closed with code 4001 (deploy done).');
  assert.equal(said({ code: 0, why: "exit", ws: { tooBig: 2000000 } }), 'Monitor "Deploy feed" (job3) ended: a message was larger than 1 MiB (2000000 bytes). Subscribe to a filtered feed if the server has one.');
  assert.equal(said({ code: 0, why: "exit", ws: { error: "blocked by this repo's network list: feed.example.com (ask the owner with update_environment, add_allowed_hosts)" } }), "Monitor \"Deploy feed\" (job3) ended: the WebSocket could not be opened: blocked by this repo's network list: feed.example.com (ask the owner with update_environment, add_allowed_hosts).");
  assert.equal(said({ code: 143, why: "limit", ws: { close: 1006 } }), 'Monitor "Deploy feed" (job3) reached its deadline and ended. Start it again if you still need it.');
  assert.deepEqual([A.monitorEndLabel({ why: "exit", code: 0, ws: { close: 1000 } }), A.monitorEndLabel({ why: "exit", code: 0, ws: { close: 1011 } }), A.monitorEndLabel({ why: "exit", code: 0, ws: { error: "x" } })], [{ ok: true, label: "" }, { ok: false, label: "closed 1011" }, { ok: false, label: "could not connect" }]);
  // The page: its card, and how it ended ("closed (code 1000)").
  const page = read("public/coder.js");
  assert.match(page, /const wsEnd = \(w\) => \(w\.error \? 'could not connect' : w\.tooBig \? 'ended: a message over 1 MiB' : 'closed \(code ' \+ esc\(String\(w\.close\)\) \+ '\)'\);/);
  assert.match(page, /monitor: 'WebSocket watch'/);
  assert.match(page, /else if \(e\.tool === 'monitor'\) body = /);
});

test("CD385d the machine reads a WebSocket monitor's file: each JSON line a message (one event, its lines kept together), how it ended kept apart and told with its end", async () => {
  const S = await import("../container/server.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-wsm-"));
  const log = join(dir, "bg-1.log");
  writeFileSync(log, JSON.stringify("line one\nline two") + "\n" + JSON.stringify("[binary frame, 9 bytes]") + "\n" + JSON.stringify({ close: 1001, reason: "going away" }) + "\n\n[finished, exit code 0]\n");
  const j = { project: "wsm-1", id: "job1", pid: 999999, monitor: true, ws: true, log, readAt: 0, part: "", pending: [], dropped: 0, end: null, told: false, deadline: Date.now() + 60_000 };
  assert.equal(S.readMonitor(j), 2);
  assert.deepEqual([j.pending, j.wsEnd], [["line one\nline two", "[binary frame, 9 bytes]"], { close: 1001, reason: "going away" }]);
  S.JOBS.set(j.pid, j);
  try {
    j.end = { code: 0, why: "exit", at: Date.now() };
    const news = S.monitorNews("wsm-1");
    assert.deepEqual(news.map((n) => [n.lines, n.end]), [[["line one\nline two", "[binary frame, 9 bytes]"], { code: 0, why: "exit", ws: { close: 1001, reason: "going away" }, events: 2, ...(Number(j.deadline) > Number(j.at) ? { ms: j.deadline - j.at } : {}) }]]);
  } finally { S.JOBS.delete(j.pid); }
  assert.match(read("container/server.mjs"), /\.\.\.\(ws \? \{ ws: true \} : \{\}\) \} : \{\}\) \}\);/, "a monitor started with ws is marked");
});

test("CD385e CODER_SHELL (Claude Code's CLAUDE_CODE_SHELL): bash or zsh by name or by its full path in /bin, /usr/bin or /usr/local/bin, anything else bash; zsh's snapshot and patterns; the command run in it, its folder followed; zsh on Coder's machine; hooks stay in bash", async () => {
  const S = await import("../container/server.mjs");
  const R = await import("../container/coder-room.mjs");
  const SB = await import("../container/coder-sandbox.mjs");
  const has = (p) => p === "/usr/bin/zsh" || p === "/bin/zsh" || p === "/usr/bin/bash";
  assert.deepEqual(["", "zsh", "/usr/bin/zsh", "/bin/zsh", "fish", "/home/dev/zsh", "/usr/bin/bash", "bash", "/opt/zsh"].map((v) => S.shellOf(v, { exists: has })), ["/usr/bin/zsh", "/usr/bin/zsh", "/usr/bin/zsh", "/bin/zsh", "bash", "bash", "/usr/bin/bash", "bash", "bash"]);
  assert.equal(S.shellOf("zsh", { exists: () => false }), "bash", "not on this machine: bash");
  // (Unset: the machine's zsh, as Claude Code's cloud sessions run commands; without one, bash. Bash docs pass 9.)
  assert.equal(S.shellOf("", { exists: () => false }), "bash");
  assert.equal(S.shellOf(undefined, { exists: (p) => p === "/bin/zsh" }), "/bin/zsh");
  assert.ok(S.commandPrefix("/h", "", "/usr/bin/zsh").startsWith(S.SNAPSHOT_READ_ZSH + S.EXTGLOB_OFF_ZSH + "unalias pkill"));
  assert.ok(S.commandPrefix("/h").startsWith(S.SNAPSHOT_READ + S.EXTGLOB_OFF), "bash as before");
  assert.match(S.SNAPSHOT_TAKE_ZSH, /zsh -i -c '\n/);
  assert.equal(S.SNAPSHOT_FILE_ZSH, ".cache/coder/shell-snapshot.zsh");
  assert.deepEqual(R.roomArgs(1001, 1001, "echo hi", undefined, "/usr/bin/zsh").slice(-3), ["/usr/bin/zsh", "-c", "echo hi"]);
  assert.deepEqual(SB.sandboxArgs(42, "/w", "ls", { shell: "/usr/bin/zsh" }).slice(-3, -1), ["/usr/bin/zsh", "-c"]);
  assert.match(read("container/Dockerfile"), /rbenv git-lfs tmux vim nano file tree wget rsync sqlite3 sudo zsh \\/);
  const server = read("container/server.mjs");
  assert.match(server, /t\.shell = shellOf\(rawVars\.CODER_SHELL\);/);
  assert.match(server, /shellPrefix: ps \|\| noPrefix \? "" : t\.shellPrefix \|\| "", shell: t\.shell \|\| "bash", merge: true \}\)/, "the AI's commands (and the owner's !), never Coder's tools or hooks, nor PowerShell's (pass 8, CD425)");
  if (!ZSH) return;
  // FOR REAL: in zsh, with the prelude, its folder followed.
  const dir = await mkdtemp(join(tmpdir(), "coder-zsh-"));
  mkdirSync(join(dir, "sub"));
  const r = await S.execIn(dir, S.commandPrefix("", "", ZSH) + "echo $ZSH_VERSION | cut -c1; arr=(a b c); echo $arr[1]; type pgrep | cut -d' ' -f1-4; cd sub", 20, { uid: null, shell: ZSH, follow: true });
  assert.deepEqual([r.code, r.output.trim().split("\n")], [0, ["5", "a", "pgrep is a shell"]]);
  assert.equal(r.ended, join(dir, "sub"));
  // A whole turn in zsh: the snapshot of the AI's ~/.zshrc (an alias), and Coder told its shell.
  const { createApp } = S;
  const home = await mkdtemp(join(tmpdir(), "coder-zh-"));
  writeFileSync(join(home, ".zshrc"), "alias hi='echo hi from zshrc'\nsetopt nonomatch\n");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-zr-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-zg-")), memRoot: await mkdtemp(join(tmpdir(), "coder-zm-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-zb-")), home };
  const seen = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "hi; echo $ZSH_NAME", description: "Hi" }, "z1")]), say("Done.")];
  const srv = http.createServer(createApp({ ...roots, send: async (req) => { seen.push(req); return steps[Math.min(n++, 1)]; } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    assert.equal((await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "zsh-t1", text: "go", messages: [], setup: { vars: { CODER_SHELL: "zsh" } } }) })).status, 200);
    let st; for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=zsh-t1&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.equal(st.events.find((e) => e.type === "result" && e.id === "z1").output, "hi from zshrc\nzsh");
    assert.match(seen[0].messages[0].content, /YOUR SHELL: your commands run in zsh \(\/(usr\/)?bin\/zsh\), the owner's CODER_SHELL, not bash/);
  } finally { srv.close(); }
});
