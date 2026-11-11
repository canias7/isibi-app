// TOOL 4, BASH: THE LAST GAPS FROM THE CLAUDE CODE DOCS CHECK (the owner, 2026-11-09: "what about claude code docs , we got
// everything ?"). Each one against Claude Code's docs and Claude Code 2.1.319's own code, read that day (its words quoted).
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, symlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(req); return steps[Math.min(i++, steps.length - 1)]; } }; };
const page = () => readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
const serverSrc = () => readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function serve(handle) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, r));
  return { base: "http://127.0.0.1:" + srv.address().port, close: () => new Promise((r) => srv.close(r)) };
}
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
async function fakeRemote(repo = "ana/shop") {
  const root = await mkdtemp(join(tmpdir(), "coder-gh-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  execFileSync("mkdir", ["-p", join(root, repo.split("/")[0])]);
  execFileSync("git", ["clone", "-q", "--bare", work, join(root, repo + ".git")]);
  return { remote: root + "/" };
}
const roots = async () => ({ gitRoot: await mkdtemp(join(tmpdir(), "coder-git-")), memRoot: await mkdtemp(join(tmpdir(), "coder-mem-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-bgr-")) });
/** A chat on Coder's Worker, with a stand-in machine that records what it is asked. */
async function worker(id, machine) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  await bucket.put("coder/" + uid + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 1, status: "idle", at: Date.now(), title: "x" }));
  const box = () => ({ fetch: async (req) => machine(new URL(req.url), req) });
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box });
  return { R, env, go };
}

test("CD291 (docs check: Claude Code's \"Take back what you queued\") a waiting ! command comes back only into an empty box with nothing else waiting (\"Claude Code takes back queued shell commands only when the input box is empty and you have nothing else queued … Otherwise it leaves them in the queue … and runs them after the turn ends\"); a message comes back as before", () => {
  const ui = page();
  assert.match(ui, /const SHELL_TAKEBACK = 'A ! command comes back only when the message box is empty and nothing else is waiting\. Otherwise it runs when Coder is done\.';/);
  const h = ui.indexOf("on('[data-unqueue]'");
  const rule = ui.indexOf("if (it && it.shell && (String(S.draft || '').trim() || waiting.length > 1)) { S.error = SHELL_TAKEBACK; return draw(); }", h);
  assert.ok(h > 0 && rule > h, "the rule is in the ✕ handler");
  assert.ok(rule < ui.indexOf("/queue', { method: 'POST'", h), "checked before the Worker is asked to take it back");
  assert.match(ui, /const waiting = queuedNow\(\), it = waiting\.find\(\(q\) => q\.qid === qid\);/);
  // What waits is what the list shows: one Coder already read is not counted.
  assert.match(ui, /function queuedNow\(\) \{\n\s+const read = new Set\(S\.events\.filter\(\(e\) => e\.type === 'user' && e\.qid\)\.map\(\(e\) => e\.qid\)\);\n\s+return \(Array\.isArray\(S\.queue\) \? S\.queue : \[\]\)\.filter\(\(q\) => q && q\.qid && !read\.has\(q\.qid\)\);\n\s+\}/);
  assert.match(ui, /function queueHTML\(\) \{\n\s+const list = queuedNow\(\);/);
});

test("CD292 (docs check: Claude Code's tasks list shows a background task's output) a background command's output from its row in the list: its last 40 lines (no secrets, no colour codes, a progress bar's last state, never Coder's folder line, never through a link), and its output file's path; on Coder's machine, the Worker and the page", async () => {
  const S = await import("../container/server.mjs");
  const { CWD_MARK } = await import("../container/coder-agent.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-bgout-"));
  const log = join(dir, "bg-1.log");
  const lines = Array.from({ length: 50 }, (_, i) => "line " + (i + 1));
  await writeFile(log, lines.join("\n") + "\n\x1b[32mgreen\x1b[0m\nbuild 10%\rbuild 55%\rbuild 100%\n" + CWD_MARK + "abc:/work\nkey ghp_" + "a".repeat(30) + "\n\n");
  const got = await S.logTail(log);
  assert.equal(got.length, 40);
  assert.deepEqual(got.slice(-4), ["line 50", "green", "build 100%", "key [hidden]"]);
  assert.equal(got[0], "line 14");
  // A big log: only its end is read, and its first line, cut there, is left out.
  const big = join(dir, "big.log");
  await writeFile(big, "x".repeat(70 * 1024) + "\nlast line\n");
  assert.deepEqual(await S.logTail(big), ["last line"]);
  // Never through a link; nothing when there is no file.
  const secret = join(dir, "secret.txt");
  await writeFile(secret, "TOP SECRET\n");
  await symlink(secret, join(dir, "bg-2.log"));
  assert.deepEqual(await S.logTail(join(dir, "bg-2.log")), []);
  assert.deepEqual(await S.logTail(join(dir, "none.log")), []);
  // The machine: the chat's own one, by its id.
  const fake = 2_000_000_000 + Math.floor(Math.random() * 1000);
  S.JOBS.set(fake, { project: "shop-out1", id: "job7", pid: fake, log, command: "npm run dev", desc: "Start the dev server", cwd: dir, at: Date.now(), moved: false, deadline: Date.now() + 60_000, box: false, end: null, told: false, stopping: "" });
  const { base, close } = await serve(S.createApp({ root: dir, ...await roots() }));
  try {
    const o = await (await fetch(base + "/bgout?project=shop-out1&id=job7")).json();
    assert.deepEqual([o.ok, o.id, o.file, o.lines.length, o.lines.at(-1)], [true, "job7", log, 40, "key [hidden]"]);
    assert.equal((await (await fetch(base + "/bgout?project=shop-other&id=job7")).json()).ok, false, "never another chat's");
    assert.equal((await (await fetch(base + "/bgout?project=shop-out1&id=job8")).json()).why, "that background command is not running");
  } finally { S.JOBS.delete(fake); await close(); }
  // The Worker: GET background?output=<id> asks the machine; a bad id is refused before it.
  const asked = [];
  const { go } = await worker("shop-out2", async (u) => {
    if (u.pathname === "/bgout") { asked.push(u.search); return u.searchParams.get("id") === "job3" ? Response.json({ ok: true, id: "job3", file: "/srv/coder-bg/shop-out2/bg-1.log", lines: ["ready on :3000"], ended: { code: 0, why: "exit" } }) : Response.json({ ok: false, why: "that background command is not running" }); }
    return Response.json({ ok: true });
  });
  const ok = await go("projects/shop-out2/background?output=job3");
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, id: "job3", file: "/srv/coder-bg/shop-out2/bg-1.log", lines: ["ready on :3000"], ended: { code: 0, why: "exit" } });
  assert.deepEqual(asked, ["?project=shop-out2&id=job3"]);
  const gone = await go("projects/shop-out2/background?output=job4");
  assert.deepEqual([gone.status, (await gone.json()).error], [404, "that background command is not running"]);
  assert.equal((await go("projects/shop-out2/background?output=..%2Fx")).status, 400);
  assert.equal(asked.length, 2, "a bad id never reaches the machine");
  // The page: Output on each row; its lines, newest at the bottom, looked at again every 3 seconds while open, and its file.
  const ui = page();
  assert.match(ui, /const BG_OUT_POLL_MS = 3000;/);
  assert.match(ui, /data-bg-out="' \+ esc\(b\.id\) \+ '" aria-expanded="/);
  assert.match(ui, /'<div class="cd-bg-file">Full output: <code>' \+ esc\(o\.file\) \+ '<\/code><\/div>'/);
  assert.match(ui, /call\('\/projects\/' \+ encodeURIComponent\(id\) \+ '\/background\?output=' \+ encodeURIComponent\(o\.id\)\)/);
  assert.match(ui, /if \(!o\.error && bgList\(\)\.some\(\(b\) => b\.id === o\.id\)\) S\.bgOutTimer = setTimeout\(bgOutTick, BG_OUT_POLL_MS\);/);
  assert.match(ui, /stopBgWatch\(\); stopBgOut\(\); S\.bgOut = null;/, "closed when another chat opens");
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(css, /\.cd-bg-outlines \{ margin: 0; max-height: 220px; overflow: auto;/);
});

test("CD293 (docs check: Claude Code's CLAUDECODE=1 and, in its cloud sessions, CLAUDE_CODE_REMOTE_SESSION_ID, \"Read this to construct a link back to the session transcript\") every command of Coder's has GOFARTHER_CODER=1 and the chat's id and link, set after the owner's variables so none of theirs hides them; the setup script gets GOFARTHER_CODER=1", async () => {
  const S = await import("../container/server.mjs");
  assert.deepEqual(S.coderMarks("shop-x1", "https://gofarther.dev/?chat=shop-x1"), { GOFARTHER_CODER: "1", GOFARTHER_CODER_CHAT_ID: "shop-x1", GOFARTHER_CODER_CHAT_URL: "https://gofarther.dev/?chat=shop-x1" });
  for (const bad of ["http://gofarther.dev/?chat=x", "https://gofarther.dev/?chat=x\"; rm -rf ~", "https://gofarther.dev/x", 7]) assert.deepEqual(Object.keys(S.coderMarks("shop-x1", bad)), ["GOFARTHER_CODER", "GOFARTHER_CODER_CHAT_ID"], String(bad));
  const R = await import("../src/coder-routes.mjs");
  assert.equal(R.chatLinkOf({ APP_ORIGIN: "https://gofarther.dev/" }, "shop-x1"), "https://gofarther.dev/?chat=shop-x1");
  assert.equal(R.chatLinkOf({}, "a b"), "https://gofarther.dev/?chat=a%20b");
  // The Worker sends the chat's link with each turn.
  const turns = [];
  const { go } = await worker("shop-mk1", async (u, req) => { if (u.pathname === "/turn") turns.push(await req.json()); return Response.json({ ok: true }); });
  const r = await go("projects/shop-mk1/message", { method: "POST", body: JSON.stringify({ text: "hi" }) });
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.equal(turns.at(-1).chatUrl, "https://gofarther.dev/?chat=shop-mk1");
  // On Coder's machine: in a command of Coder's, whatever the owner's variables say.
  const { remote } = await fakeRemote();
  const rr = await roots();
  const root = await mkdtemp(join(tmpdir(), "coder-root-"));
  const s = scripted([say("", [call("bash", { command: "echo \"mark=$GOFARTHER_CODER id=$GOFARTHER_CODER_CHAT_ID url=$GOFARTHER_CODER_CHAT_URL\"", description: "Show the marks" })]), say("Done.", [])]);
  const { base, close } = await serve(S.createApp({ root, send: s.send, remote, ...rr }));
  try {
    const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    assert.equal((await post("/turn", { project: "shop-mk2", text: "go", messages: [], repo: "ana/shop", base: "main", branch: "coder/shop-mk2", token: "", chatUrl: "https://gofarther.dev/?chat=shop-mk2", setup: { vars: { GOFARTHER_CODER: "0", GOFARTHER_CODER_CHAT_ID: "someone-else" } } })).status, 200);
    let st;
    for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=shop-mk2&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    const res = st.events.find((e) => e.type === "result");
    assert.equal(res.output, "mark=1 id=shop-mk2 url=https://gofarther.dev/?chat=shop-mk2");
  } finally { await close(); }
  const src = serverSrc();
  assert.match(src, /Object\.assign\(extraEnv, coderMarks\(project, body\.chatUrl, body\.model \? pickModel\(body\.model, body\.effort\)\.effort : ""\), AGENT_MARK, REMOTE_MARK\);/);
  assert.match(src, /extraEnv: \{ GOFARTHER_CODER: "1", \.\.\.REMOTE_MARK, \.\.\.\(net\.limited \? proxyEnv : \{\}\) \}/, "the setup script (and CLAUDE_CODE_REMOTE: pass 8, CD427)");
  const A = await import("../container/coder-agent.mjs");
  assert.match(A.CODER_TOOLS.find((t) => t.function.name === "bash").function.description, /every one has GOFARTHER_CODER=1, and this chat's id and link in GOFARTHER_CODER_CHAT_ID and GOFARTHER_CODER_CHAT_URL/);
});

test("CD294 (docs check: Claude Code's respondToBashCommands, and its own code) the owner's ! command with CODER_RESPOND_TO_BASH_COMMANDS=false is recorded without an answer, after Claude Code's note; one moved to the background is never answered (Claude Code 2.1.319 answers neither); a background command's end in the same turn is still answered", async () => {
  const { runCoder, SHELL_CAVEAT } = await import("../container/coder-agent.mjs");
  assert.equal(SHELL_CAVEAT, "<local-command-caveat>The command below was run directly in Coder, not sent to you as a request, and its output goes straight to the owner. It's recorded here as context for later messages.</local-command-caveat>");
  // Off: run, shown, recorded; no AI call.
  let sent = 0, events = [];
  const quiet = await runCoder({ send: async () => { sent++; return say("x"); }, exec: async () => ({ code: 0, output: "a.txt\nb.txt\n" }), emit: (e) => events.push(e), here: () => "/w", root: "/w" }, { shell: "ls", respondToBash: false });
  assert.equal(sent, 0, "no answer");
  assert.deepEqual([quiet.status, quiet.quiet, quiet.summary], ["done", true, ""]);
  assert.deepEqual(quiet.messages.map((m) => m.content), [SHELL_CAVEAT, "<bash-input>ls</bash-input>", "<bash-stdout>a.txt\nb.txt</bash-stdout><bash-stderr></bash-stderr>"]);
  assert.deepEqual(events.map((e) => e.type), ["user", "bash", "result"], "the chat shows the command and what it printed, and nothing more");
  // Moved to the background: no answer, whatever the setting.
  sent = 0; events = [];
  const moved = await runCoder({ send: async () => { sent++; return say("x"); }, exec: async () => ({ code: -1, background: true, byUser: true, pid: 4242, log: "/srv/coder-bg/p/bg-1.log", jobId: "job2", output: "" }), emit: (e) => events.push(e), here: () => "/w", root: "/w" }, { shell: "npm run dev" });
  assert.equal(sent, 0);
  assert.equal(moved.messages[0].content, SHELL_CAVEAT);
  assert.match(moved.messages[2].content, /^<bash-stdout>Command was manually backgrounded by user with ID: job2\. Output is being written to: \/srv\/coder-bg\/p\/bg-1\.log/);
  // On: answered, no note (as before).
  sent = 0;
  const said = await runCoder({ send: async () => { sent++; return say("Two files."); }, exec: async () => ({ code: 0, output: "a.txt\nb.txt\n" }), here: () => "/w", root: "/w" }, { shell: "ls" });
  assert.deepEqual([sent, said.summary, said.messages[0].content], [1, "Two files.", "<bash-input>ls</bash-input>"]);
  // Off, but a background command ended: Coder answers that.
  sent = 0;
  const told = await runCoder({ send: async () => { sent++; return say("The build finished."); }, exec: async () => ({ code: 0, output: "ok\n" }), here: () => "/w", root: "/w" }, { shell: "ls", respondToBash: false, notices: [{ id: "job1", desc: "Build the site", command: "npm run build", log: "/x/bg-1.log", code: 0, why: "exit" }] });
  assert.deepEqual([sent, told.summary], [1, "The build finished."]);
  // The machine reads the setting from the environment's variables.
  const S = await import("../container/server.mjs");
  for (const v of ["false", "0", "no", "OFF"]) assert.equal(S.varOff(v), true, v);
  for (const v of ["", "true", "1", undefined]) assert.equal(S.varOff(v), false, String(v));
  assert.match(serverSrc(), /respondToBash: !varOff\(rawVars\.CODER_RESPOND_TO_BASH_COMMANDS\)/);
});

test("CD295 (docs check: Claude Code's Output limits, its bashOutputMaxChars setting and BASH_MAX_OUTPUT_LENGTH, as its own code applies them) CODER_BASH_OUTPUT_MAX_CHARS (clamped to 4,000-128,000) sizes what comes back inline and the read-back window; BASH_MAX_OUTPUT_LENGTH (up to 150,000) only the read-back window", async () => {
  const S = await import("../container/server.mjs");
  const L = S.bashOutputLimits;
  assert.deepEqual(L({}), { inlineMax: 30000, readBack: 30000 });
  assert.deepEqual(L({ CODER_BASH_OUTPUT_MAX_CHARS: "100000" }), { inlineMax: 100000, readBack: 100000 });
  assert.deepEqual(L({ CODER_BASH_OUTPUT_MAX_CHARS: "1000" }), { inlineMax: 4000, readBack: 4000 });
  assert.deepEqual(L({ CODER_BASH_OUTPUT_MAX_CHARS: "999999" }), { inlineMax: 128000, readBack: 128000 });
  assert.deepEqual(L({ BASH_MAX_OUTPUT_LENGTH: "150001" }), { inlineMax: 30000, readBack: 150000 });
  assert.deepEqual(L({ BASH_MAX_OUTPUT_LENGTH: "5000" }), { inlineMax: 30000, readBack: 5000 });
  assert.deepEqual(L({ BASH_MAX_OUTPUT_LENGTH: "90000", CODER_BASH_OUTPUT_MAX_CHARS: "50000" }), { inlineMax: 50000, readBack: 50000 }, "the setting wins");
  assert.deepEqual(L({ BASH_MAX_OUTPUT_LENGTH: "abc", CODER_BASH_OUTPUT_MAX_CHARS: "-3" }), { inlineMax: 30000, readBack: 30000 });
  // The result.
  const { bashResultText } = await import("../container/coder-checks.mjs");
  const fifty = "y".repeat(50_000);
  assert.equal(bashResultText({ output: fifty, inlineMax: 100000, readBack: 100000 }), fifty, "inline up to the setting");
  assert.match(bashResultText({ output: fifty, file: "/o/a.txt", size: 50_000 }), /^<persisted-output>\nOutput too large \(48\.8KB\)\. Full output saved to: \/o\/a\.txt/, "the default stays 30,000");
  const tenLines = Array.from({ length: 2000 }, (_, i) => "row " + i).join("\n");
  assert.equal(bashResultText({ output: tenLines, readBack: 5000 }), tenLines.slice(0, 5000) + " ... [" + tenLines.slice(5000).split("\n").length + " lines truncated] ...", "a read-back window under the output's size, as Claude Code's");
  const fail = "a".repeat(100_000) + "TAIL" + "b".repeat(60_000);
  assert.ok(bashResultText({ output: fail, isError: true, code: 1, readBack: 150_000 }).includes("TAIL") === false);
  const failEnd = bashResultText({ output: fail, isError: true, code: 1, readBack: 100_004 });
  assert.match(failEnd, /TAIL$/, "a failure's excerpt is cut from the read-back window");
  // On Coder's machine: the output file starts past the inline size.
  const dir = await mkdtemp(join(tmpdir(), "coder-lim-"));
  const r = await S.execIn(dir, "head -c 50000 /dev/zero | tr '\\0' z", 30, { spillDir: join(dir, "out"), spillAt: 100_000, keep: 110_000 });
  assert.deepEqual([r.code, r.output.length, r.file], [0, 50_000, undefined]);
  // Coder's bash says the size, and Coder is told when the environment sets one.
  const A = await import("../container/coder-agent.mjs");
  assert.match(A.toolsFor(A.CODER_TOOLS, { inlineMax: 100000 }).find((t) => t.function.name === "bash").function.description, /Output past 100,000 characters is saved to a file/);
  assert.match(serverSrc(), /"\\n\\nCOMMAND OUTPUT SIZES \(" \+ setBy\(t\.outLimits\.inlineMax !== OUT_INLINE \? "CODER_BASH_OUTPUT_MAX_CHARS" : "BASH_MAX_OUTPUT_LENGTH"\) \+ "\): output of a command that worked comes back inline up to "/);
  // The agent passes the chat's sizes to the result.
  const s = scripted([say("", [call("bash", { command: "cat big.txt" })]), say("ok", [])]);
  await A.runCoder({ send: s.send, exec: async () => ({ code: 0, output: fifty }) }, { text: "go", outLimits: { inlineMax: 100000, readBack: 100000 } });
  assert.equal(s.seen[1].messages.find((m) => m.role === "tool").content, fifty);
});

test("CD296 (docs check: Claude Code's CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, \"remove the run_in_background parameter … Claude Code then also stops moving … timed-out shell commands to the background automatically\") CODER_DISABLE_BACKGROUND_TASKS=1: bash has no run_in_background, a command is stopped at its timeout, the page has no Run in background, and the machine refuses a move", async () => {
  const A = await import("../container/coder-agent.mjs");
  const plain = A.CODER_TOOLS;
  assert.equal(A.toolsFor(plain), plain, "the same list otherwise");
  const off = A.toolsFor(plain, { noBg: true });
  const bash = off.find((t) => t.function.name === "bash");
  assert.deepEqual(Object.keys(bash.function.parameters.properties), ["command", "description", "timeout"]);
  assert.doesNotMatch(bash.function.description, /run_in_background|moved to the background|keeps running after your answer/);
  assert.ok(bash.function.description.includes(A.NO_BG_TIMEOUT));
  assert.deepEqual(off.filter((t) => t.function.name !== "bash"), plain.filter((t) => t.function.name !== "bash"), "the other tools as they are");
  assert.ok(plain.find((t) => t.function.name === "bash").function.parameters.properties.run_in_background, "the shared list is not changed");
  // In a job: the list sent, and a run_in_background given anyway runs in the foreground.
  const s = scripted([say("", [call("bash", { command: "npm run dev", run_in_background: true, description: "Start the dev server" })]), say("ok", [])]);
  const execs = [], events = [];
  await A.runCoder({ send: s.send, exec: async (o) => { execs.push(o); return { code: 143, output: "Command timed out after 120s", timedOut: true }; }, emit: (e) => events.push(e) }, { text: "go", noBg: true });
  assert.ok(!s.seen[0].tools.find((t) => t.function.name === "bash").function.parameters.properties.run_in_background);
  assert.deepEqual([execs[0].inBg, execs[0].timeoutS], [false, 120]);
  assert.equal(events.find((e) => e.type === "bash").noBg, true, "the page shows no Run in background");
  // On Coder's machine, the page and the note.
  const src = serverSrc();
  assert.match(src, /t\.noBg = varOn\(rawVars\.CODER_DISABLE_BACKGROUND_TASKS\);/);
  assert.match(src, /stopAtTimeout: !!sleepFirst \|\| \(t\.noBg && !monitor\)/, "(a monitor still runs: Claude Code's Monitor does, CD381)");
  assert.match(src, /if \(t && t\.noBg\) return send\(200, \{ ok: false, why: "background commands are off in this chat's environment \(CODER_DISABLE_BACKGROUND_TASKS\)" \}\);/);
  assert.match(src, /BACKGROUND COMMANDS ARE OFF \(" \+ setBy\("CODER_DISABLE_BACKGROUND_TASKS"\) \+ "\)/);
  assert.match(src, /const setBy = \(n\) => \(fromRepo\(n\) \? "this repository's \.claude\/settings\.json sets " \+ REPO_OWN_FROM\[n\] : "this chat's environment sets " \+ n\);/);
  const S = await import("../container/server.mjs");
  for (const v of ["1", "true", "YES", "on"]) assert.equal(S.varOn(v), true, v);
  for (const v of ["", "0", "false", undefined]) assert.equal(S.varOn(v), false, String(v));
  assert.match(page(), /\(e\.noBg \? '' : '<button type="button" class="cd-bgmove" data-bg-move="1"/);
});

test("CD297 (docs check: Claude Code's shell mode, \"history-based autocomplete: type a partial command and press Tab to complete from previous ! commands in the current project\" and \"live file path autocomplete\") in the ! box, Tab completes an earlier ! command (newest first, again for the one before; kept on the owner's account for the repository, so any chat and device has them), and a word with a / lists the folders and files under it", async () => {
  const ui = page();
  const a = ui.indexOf("  function shellPathMatches(list, token) {"), b = ui.indexOf("\n  }\n", a);
  const shellPathMatches = new Function("return " + ui.slice(a, b + 4).trim())();
  const files = ["src/app.js", "src/api/user.js", "src/api/cart.js", "src/App.css", "README.md", "docs/a.md"];
  assert.deepEqual(shellPathMatches(files, "src/"), ["src/api/", "src/App.css", "src/app.js"], "folders first");
  assert.deepEqual(shellPathMatches(files, "src/a"), ["src/api/", "src/App.css", "src/app.js"], "any case");
  assert.deepEqual(shellPathMatches(files, "./src/api/c"), ["./src/api/cart.js"], "./ kept");
  assert.deepEqual(shellPathMatches(files, "~/"), [], "the home folder is not the repository's");
  // The word is found after the "!" or a space, only in the ! box.
  assert.match(ui, /const sp = !m && \/\^!\/\.test\(input\.value\) \? \/\(\^!\\s\*\|\\s\)\(\[\\w\.~@\+-\]\*\\\/\[\\w\.\/~@\+-\]\*\)\$\/\.exec\(before\) : null;/);
  assert.match(ui, /return S\.mention && S\.mention\.shell \? pickShellPath\(pick\) : pickMention\(pick\);/);
  // Tab: earlier commands, this chat's and those this browser sent in the repository.
  assert.match(ui, /if \(!list\.length && e\.key === 'Tab' && !e\.shiftKey && \/\^!\/\.test\(input\.value\) && input\.selectionStart === input\.value\.length && shellTab\(input\)\) \{ e\.preventDefault\(\);/);
  assert.match(ui, /if \(\/\^!\\s\*\\S\/\.test\(text\)\) rememberShell\(text\);/);
  assert.match(ui, /S\.shellHist = Array\.isArray\(r\.data\.shellHistory\) \? r\.data\.shellHistory : \[\];/, "given with the chat");
  assert.match(ui, /const kept = \(Array\.isArray\(S\.shellHist\) \? S\.shellHist : \[\]\)\.filter/);
  // Coder's Worker keeps them on the account, per repository, newest first, once each; a command sent again from the queue
  // is not counted twice.
  const R = await import("../src/coder-routes.mjs");
  const hb = fakeBucket();
  await R.rememberShell(hb, "u1", "ana/shop", "npm test");
  await R.rememberShell(hb, "u1", "ana/shop", "ls -la");
  await R.rememberShell(hb, "u1", "ana/shop", "npm test");
  await R.rememberShell(hb, "u1", "ana/blog", "make");
  await R.rememberShell(hb, "u1", "not a repo", "rm x");
  assert.deepEqual(await R.shellHistoryOf(hb, "u1", "ana/shop"), ["npm test", "ls -la"]);
  assert.deepEqual(await R.shellHistoryOf(hb, "u1", "ana/blog"), ["make"]);
  assert.deepEqual(await R.shellHistoryOf(hb, "u2", "ana/shop"), [], "another account's are its own");
  for (let i = 0; i < 120; i++) await R.rememberShell(hb, "u1", "ana/shop", "echo " + i);
  assert.equal((await R.shellHistoryOf(hb, "u1", "ana/shop")).length, R.SHELL_HIST_MAX);
  const turns = [];
  const { go } = await worker("shop-hist1", async (u, req) => { if (u.pathname === "/turn") turns.push(await req.json()); return Response.json({ ok: true }); });
  assert.equal((await go("projects/shop-hist1/message", { method: "POST", body: JSON.stringify({ text: "! git status" }) })).status, 200);
  assert.equal(turns.at(-1).shell, "git status");
  assert.deepEqual((await (await go("projects/shop-hist1")).json()).shellHistory, ["git status"]);
  assert.doesNotMatch(ui.replace(/  const localNotifyOn = [^\n]*\n  const setLocalNotify = [^\n]*\n/, ""), /localStorage/, "nothing in the browser's storage");
  assert.match(ui, /const found = shellHistory\(\)\.filter\(\(c\) => c\.startsWith\(tab\.typed\) && c !== tab\.typed\);/);
  assert.match(ui, /then Coder answers what it printed · Tab completes<\/div>/);
});

test("CD298 (found while taking the screenshots) while Coder works the page redraws every 1.5 seconds, and a message can be typed then (the queue): the box keeps its cursor and selection through a redraw, and only text changed for it puts the cursor at the end", () => {
  const ui = page();
  const a = ui.indexOf("  function draw(scroll) {"), b = ui.indexOf("\n  }\n", a);
  const draw = ui.slice(a, b);
  assert.match(draw, /const was = focus \? \{ v: document\.activeElement\.value, a: document\.activeElement\.selectionStart, b: document\.activeElement\.selectionEnd, d: document\.activeElement\.selectionDirection, top: document\.activeElement\.scrollTop \} : null;/);
  assert.match(draw, /if \(was && i\.value === was\.v\) \{ i\.setSelectionRange\(was\.a, was\.b, was\.d \|\| 'none'\); i\.scrollTop = was\.top; \} else i\.setSelectionRange\(i\.value\.length, i\.value\.length\);/);
  assert.ok(draw.indexOf("const was = ") < draw.indexOf("root.innerHTML = "), "read before the box is drawn again");
});

test("CD299 (found in the screenshots) a background command's step shows how it ended once Coder is told (✓, a failure's exit code, or stopped), not \"running\" for ever; one lost with a restarted machine shows stopped", async () => {
  const A = await import("../container/coder-agent.mjs");
  assert.deepEqual(A.bgEndNotice({ id: "job1", desc: "Build", code: 0 }).end, { ok: true, label: "" });
  assert.deepEqual(A.bgEndNotice({ id: "job1", desc: "Build", code: 2 }).end, { ok: false, label: "exit 2" });
  assert.deepEqual(A.bgEndNotice({ id: "job1", command: "grep x f", code: 1 }).end, { ok: true, label: "" }, "grep's no match is no failure");
  assert.deepEqual(A.bgEndNotice({ id: "job1", desc: "Serve", why: "owner" }).end, { ok: false, label: "stopped" });
  assert.deepEqual(A.bgEndNotice({ id: "job1", desc: "Serve", why: "limit" }).end, { ok: false, label: "time limit" });
  const events = [];
  await A.runCoder({ send: async () => say("Noted."), exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e) }, { notices: [{ id: "job3", desc: "Build the site", command: "npm run build", log: "/x/bg-3.log", code: 0, why: "exit" }], lost: [{ id: "job4", desc: "Start the dev server" }] });
  const notes = events.filter((e) => e.type === "note");
  assert.deepEqual(notes.find((e) => e.job === "job3").end, { ok: true, label: "" });
  assert.deepEqual(notes.find((e) => Array.isArray(e.jobs)).jobs, ["job4"]);
  const ui = page();
  // (Since the live test after deploy 123, one function, bgEndsOf, which also reads Coder's own stops: CD505.)
  assert.match(ui, /if \(e\.type === 'note'\) \{ if \(e\.job && e\.end\) ends\[e\.job\] = e\.end; if \(Array\.isArray\(e\.jobs\)\) for \(const j of e\.jobs\) ends\[j\] = \{ ok: false, label: 'stopped' \}; \}/);
  assert.match(ui, /S\.bgEnded = bgEndsOf\(S\.events\);/);
  assert.match(ui, /end \? \(end\.ok \? 'ok' : 'bgend'\) : r\.background \? 'bg'/);
  assert.match(ui, /state === 'bgend' \? \(\/\^\(exit\|ended\)\/\.test/);
});

test("CD300 (found while preparing the live test after deploy 75) the open chat goes on looking while a background command ended and Coder is not told yet, so the turn that tells Coder (it starts by itself, within a minute) shows without a reload; after the owner's Stop too", () => {
  const ui = page();
  assert.match(ui, /function startBgWatch\(\) \{ stopBgWatch\(\); if \(S\.project && !S\.running && \(bgList\(\)\.length \|\| S\.bgUntold > 0\)\) S\.bgWatch = setTimeout\(bgTick, BG_POLL_MS\); \}/);
  assert.match(ui, /S\.background = r\.data\.background \|\| \[\];\n\s+S\.bgUntold = Number\(r\.data\.untold\) \|\| 0;/);
  assert.match(ui, /S\.bgUntold = Math\.max\(1, Number\(r\.data\.untold\) \|\| 0\);/, "a stop is told: the page waits for that turn");
  assert.match(ui, /stopBgWatch\(\); stopBgOut\(\); S\.bgOut = null; S\.bgUntold = 0;/, "another chat opened: none");
});

test("CD302 (the live test after deploy 75) read and grep open the chat's own command output (a background command's log, a long output's saved file), as Coder is told to and as Claude Code's Read opens its output files; never through a link out of those folders; nothing else outside the project, and no tool writes there", async () => {
  const { mkdtemp: mk } = await import("node:fs/promises");
  const proj = await mk(join(tmpdir(), "coder-proj-")), bg = await mk(join(tmpdir(), "coder-bgout-")), out = await mk(join(tmpdir(), "coder-out-")), other = await mk(join(tmpdir(), "coder-other-"));
  await writeFile(join(bg, "bg-1.log"), "tick 1\ntick 2\nall done\n");
  await writeFile(join(out, "abc123.txt"), Array.from({ length: 50 }, (_, i) => "row " + i).join("\n") + "\nthe needle\n");
  await writeFile(join(other, "secret.txt"), "not for Coder\n");
  await symlink(join(other, "secret.txt"), join(bg, "bg-2.log"));
  const tools = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const run = (fn, args) => { try { return execFileSync("node", ["--no-warnings", "--input-type=module", "-e", "const T = await import(" + JSON.stringify(tools) + "); process.stdout.write(String(await T." + fn + "(" + JSON.stringify(args) + ")));"], { cwd: proj, encoding: "utf8", env: { ...process.env, CODER_OUTPUT_DIRS: bg + ":" + out } }); } catch (e) { return "ERROR " + String(e.stderr || e.stdout || e.message); } };
  assert.match(run("toolRead", { path: join(bg, "bg-1.log") }), /^ +1\ttick 1\n +2\ttick 2\n +3\tall done$/, "a background command's log");
  assert.match(run("toolRead", { path: join(out, "abc123.txt"), offset: 51, limit: 1 }), /51\tthe needle/, "a long output's saved file, a part of it");
  assert.match(run("toolGrep", { pattern: "needle", path: join(out, "abc123.txt") }), /the needle/, "searched");
  assert.match(run("toolRead", { path: join(bg, "bg-2.log") }), /that path leads outside the project/, "never through a link out");
  assert.match(run("toolRead", { path: join(other, "secret.txt") }), /that path is outside the project/, "nothing else outside the project");
  assert.match(run("toolWrite", { path: join(bg, "bg-9.log"), content: "x" }), /outside the project/, "no tool writes there");
  assert.match(serverSrc(), /CODER_OUTPUT_DIRS: bgDir \+ ":" \+ outDir/, "the machine names the chat's two folders to its file tools");
});

test("CD303 (the live test after deploy 75) after a pause, Coder's machine wakes each kept background command's own starter too (tried for real in the admin sandbox in CD301)", async () => {
  const S = await import("../container/server.mjs");
  const woken = [];
  S.wakeStarters([{ pid: 4242 }, { pid: 0 }, null, { pid: "x" }, { pid: 77 }], { cont: (pid) => woken.push(pid) });
  assert.deepEqual(woken, [4242, 77]);
  assert.match(serverSrc(), /resumeAI\(p\.procs, \{ boxPid: boxKept \? boxKept\.pid : 0 \}\); wakeStarters\(live\); finish\(\);/);
  const init = readFileSync(new URL("../container/coder-sandbox-init.sh", import.meta.url), "utf8");
  assert.match(init, /\nset \+e\nwhile :; do sleep 3600 & wait \$! \|\| true; done\n$/, "the sandbox's first process collects what ends in it, and never ends");
});

test("CD304 (the owner, 2026-11-09: \"yes i want that\"; Claude Code's Claude-Session trailer and attribution.sessionUrl) each commit Coder makes for a chat ends with a Coder-Chat: <link> trailer, its undo's commit too, and its pull requests end \"Made with Coder: <link>\"; off when the environment sets CODER_CHAT_LINK=false", async () => {
  const S = await import("../container/server.mjs");
  const link = "https://gofarther.dev/?chat=shop-abcd";
  assert.equal(S.chatTrailer(link), "Coder-Chat: " + link);
  for (const bad of ["", "http://gofarther.dev/?chat=x", "https://x.dev/?chat=a\nCo-Authored-By: someone", undefined]) assert.equal(S.chatTrailer(bad), "", String(bad));
  // For real: a commit, then its undo, on Coder's branch.
  const { mkdtemp: mk, writeFile: wf } = await import("node:fs/promises");
  const { remote, bare } = await (async () => { const r = await fakeRemote(); return { remote: r.remote, bare: join(r.remote, "ana/shop.git") }; })();
  const gitRoot = await mk(join(tmpdir(), "coder-git-")), root = await mk(join(tmpdir(), "coder-w-"));
  const dir = join(root, "shop-abcd");
  assert.equal((await S.prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/shop-abcd", token: "", remote, gitRoot, root })).ok, true);
  await wf(join(dir, "index.html"), "<h1>Shop</h1>\n");
  const p = await S.pushRepo({ dir, repo: "ana/shop", branch: "coder/shop-abcd", token: "", message: "Added the home page", trailer: S.chatTrailer(link), remote, gitRoot, root });
  assert.equal(p.ok, true, p.why);
  assert.equal(git(bare, "log", "-1", "--format=%B", "coder/shop-abcd").trim(), "Added the home page\n\nCoder-Chat: " + link);
  const src = serverSrc();
  assert.match(src, /trailer: chatTrailer\(body\.chatUrl\), noPush: body\.noPush === true,/);
  assert.match(src, /const tr = chatTrailer\(body\.chatUrl\);\n\s+if \(tr\) await gitIn\(dir, \["commit", "--amend", "-q", "--no-edit", "--no-verify", "--trailer", tr\], o\);/, "the undo's commit too");
  // Coder's Worker: the link, unless the chat's environment turns it off; on every save, undo and pull request.
  const R = await import("../src/coder-routes.mjs");
  const E = await import("../src/coder-environments.mjs");
  const bucket = fakeBucket();
  const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), APP_ORIGIN: "https://gofarther.dev" };
  const meta = { id: "shop-abcd", repo: "ana/shop" };
  assert.equal(await R.chatLinkFor(env, bucket, "u1", meta, "shop-abcd"), link, "on by default");
  const envId = await E.envIdOf(bucket, "u1", meta);
  await E.writeEnvData(env, bucket, "u1", envId, { script: "", vars: { CODER_CHAT_LINK: "false" }, secrets: [], network: null });
  assert.equal(await R.chatLinkFor(env, bucket, "u1", meta, "shop-abcd"), "", "CODER_CHAT_LINK=false");
  assert.equal(R.madeWith(link), "\n\nMade with Coder: " + link);
  assert.equal(R.madeWith(""), "\n\nMade with Coder.");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.equal((routes.match(/chatUrl: await chatLinkFor\(env, bucket, uid, meta, id\)/g) || []).length, 4, "the save and the three undos");
  assert.equal((routes.match(/madeWith\(await chatLinkFor\(env, bucket, uid, meta, id\)\)/g) || []).length, 3, "the three ways a pull request is opened");
  assert.doesNotMatch(routes, /"\\n\\nMade with Coder\."/);
});
