// THE "TOOL PARAMETERS & LIMITS" TAB'S LIVE TEST (2026-11-24): the differences from Claude Code it found, fixed. No paid
// calls: nothing here reaches a model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, openSync, closeSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const C = await import("../container/coder-checks.mjs");
const T = await import("../container/coder-tools.mjs");
const A = await import("../container/coder-agent.mjs");
const TOOLS = join(import.meta.dirname, "../container/coder-tools.mjs");

test("PF1 a pkill whose pattern names Coder's own service (coder, server.mjs, node) is refused by the pattern itself, in Claude Code's words; pgrep is not needed", () => {
  const run = (cmd) => spawnSync("bash", ["-c", C.PROC_WRAPPERS + cmd + "; echo code=$?"], { encoding: "utf8" });
  for (const cmd of ["pkill -f coder", "pkill -9 -f server.mjs", "pkill node", "pkill --signal 0 -f 'node server'", "pkill -f gofarther-coder"]) {
    const r = run(cmd);
    assert.match(r.stdout, /code=1\n$/, cmd);
    assert.equal(r.stderr.trim(), C.pkillRefusal(process.pid), cmd);
  }
  const other = run("pkill --signal 0 -f zzz-no-such-process-zzz");
  assert.match(other.stdout, /code=1\n$/);
  assert.equal(other.stderr.trim(), "", "a pattern that names nothing of Coder's runs");
});

test("PF2 edit refuses a file never read in this chat, in Claude Code's words, wherever it is (the scratch folder, /tmp); once read it goes through", () => {
  const dir = mkdtempSync(join(tmpdir(), "pf2-"));
  const seen = mkdtempSync(join(tmpdir(), "pf2-seen-"));
  mkdirSync(T.SCRATCH, { recursive: true });
  const out = mkdtempSync(join(T.SCRATCH, "pf2-out-"));
  const tool = (name, args) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", timeout: 20_000, env: { ...process.env, CODER_SEEN_DIR: seen } }).stdout || "");
  mkdirSync(join(out, "pp"));
  const f = join(out, "pp", "f.txt");
  writeFileSync(f, "one\ntwo\n");
  assert.equal(tool("file_check", { tool: "edit", args: { path: f, old_string: "one", new_string: "1" } }), "error: " + T.EDIT_NOT_READ);
  assert.equal(tool("edit", { path: f, old_string: "one", new_string: "1" }), "error: File has not been read yet. Read it first before writing to it.");
  writeFileSync(join(dir, "a.txt"), "x\n");
  assert.equal(tool("edit", { path: "a.txt", old_string: "x", new_string: "y" }), "error: " + T.EDIT_NOT_READ, "in the project too");
  tool("read", { path: f });
  assert.equal(tool("file_check", { tool: "edit", args: { path: f, old_string: "one", new_string: "1" } }), "ok");
  assert.match(tool("edit", { path: f, old_string: "one", new_string: "1" }), /has been updated successfully/);
});

test("PF3 WebSearch titles: a page that redirects is followed to its real <title>", async () => {
  const { EventEmitter } = await import("node:events");
  const got = JSON.parse(await T.toolPageTitles({ urls: ["http://a.org/", "https://b.org/"] }, { get: (u, headers, onRes) => {
    const res = new EventEmitter();
    if (u.href === "http://a.org/") { res.statusCode = 301; res.headers = { location: "https://www.a.org/home" }; }
    else { res.statusCode = 200; res.headers = { "content-type": "text/html" }; }
    setImmediate(() => { onRes(res); res.emit("data", Buffer.from("<title>" + (u.hostname === "www.a.org" ? "A, moved" : "B page") + "</title>")); res.emit("end"); });
    const req = new EventEmitter(); req.destroy = () => {}; return req;
  } }));
  assert.deepEqual(got, { "http://a.org/": "A, moved", "https://b.org/": "B page" });
});

test("PF4 a monitor whose end came with no code says Claude Code's \"ended without producing output (exit 0)\" from its log's real exit", async () => {
  const S = await import("../container/server.mjs");
  const dir = mkdtempSync(join(tmpdir(), "pf4-"));
  const log = join(dir, "m.log");
  writeFileSync(log, "\n[finished, exit code 0]\n");
  const pid = 999_000_001;
  S.JOBS.set(pid, { project: "shop-pf4", id: "job1", pid, log, command: "true", desc: "watch", monitor: true, at: Date.now(), end: { code: null, why: "exit", at: Date.now() }, told: false });
  try {
    const [n] = S.monitorNews("shop-pf4");
    assert.equal(n.end.code, 0);
    assert.match(A.monitorSaid(n), /ended without producing output \(exit 0\)/);
  } finally { S.JOBS.delete(pid); }
  assert.match(A.monitorSaid({ id: "j", desc: "d", lines: [], end: { code: 3, why: "exit", events: 0 } }), /script failed \(exit 3\)/);
});

test("PF5 a WebSocket monitor to a private address is refused by the private-address check, in Claude Code's words, before the network gate", async () => {
  assert.equal(T.PRIVATE_DEST, "Destination IP is in a private/reserved range");
  for (const u of ["ws://127.0.0.1:8080/", "ws://localhost/", "wss://10.0.0.5/", "ws://[::1]:9/", "ws://169.254.169.254/"]) assert.equal(T.wsPrivateHost(u), true, u);
  assert.equal(T.wsPrivateHost("wss://example.com/feed"), false);
  const said = [];
  await T.toolWsWatch({ url: "ws://127.0.0.1:1/" }, { out: (t) => said.push(t), proxy: "http://127.0.0.1:9" });
  assert.deepEqual(JSON.parse(said[0]), { error: T.PRIVATE_DEST });
});

test("PF6 a notebook's printed output is shown with its text; a stream with no text shows no empty [stdout]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pf6-"));
  const seen = mkdtempSync(join(tmpdir(), "pf6-seen-"));
  writeFileSync(join(dir, "n.ipynb"), JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [{ cell_type: "code", id: "c1", execution_count: 1, metadata: {}, source: "print('hi')", outputs: [{ output_type: "stream", name: "stdout", text: "hi\n" }, { output_type: "stream", name: "stderr", text: [] }, { output_type: "stream", stream: "stdout", data: { "text/plain": "old style\n" } }] }] }));
  const r = String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: "read", args: { path: "n.ipynb" } })).toString("base64")], { cwd: dir, encoding: "utf8", env: { ...process.env, CODER_SEEN_DIR: seen } }).stdout);
  assert.match(r, /\[stdout\]\nhi\n/);
  assert.match(r, /\[stdout\]\nold style/);
  assert.doesNotMatch(r, /\[stderr\]/);
});

test("PF7 artifact list results always carry Claude Code's truncated field", async () => {
  const src = (await import("node:fs")).readFileSync(join(import.meta.dirname, "../container/coder-resources.mjs"), "utf8");
  assert.match(src, /truncated: r\.truncated === true \|\|/);
});

test("PF8 a Bash timeout above 600000 is cut to 600000 and the result says so; one at or under it says nothing", () => {
  assert.equal(A.commandTimeoutS({ timeout: 900000 }), 600);
  assert.equal(A.timeoutCutNote({ timeout: 900000 }), "Note: timeout 900000 is over the maximum of 600000 ms (10 minutes), so it was cut to 600000.");
  assert.equal(A.timeoutCutNote({ timeout: 600000 }), "");
  assert.equal(A.timeoutCutNote({}), "");
  assert.equal(A.timeoutCutNote({ timeout: 1_300_000 }, { maxMs: 1_200_000 }), "Note: timeout 1300000 is over the maximum of 1200000 ms (20 minutes), so it was cut to 1200000.");
});
