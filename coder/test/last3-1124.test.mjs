// FOUR LIVE FINDINGS OF 2026-11-24, MADE CLAUDE CODE'S: a helper started with isolation "worktree" works in its worktree
// (its file tools and commands, its full paths into the chat's checkout too) and is kept with its path and branch when it
// changed something; WebFetch keeps a fetch's cookies across its redirects, so GitHub's chain to raw.githubusercontent.com
// ends in the REDIRECT DETECTED note; Artifact publish of a file outside the working folders asks on a card, then publishes;
// a message the running job could not take is never shown as sent with no word, and a push with a file over GitHub's 100 MB
// limit names the file and the limit. The model is stubbed: no paid call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const W = await import("../container/coder-worktree.mjs");
const F = await import("../container/coder-webfetch.mjs");
const S = await import("../container/server.mjs");
const RT = await import("../src/coder-routes.mjs");

const ROOT = "/data/coder/projects/last3";
const WT = ROOT + "/.claude/worktrees/agent-1-x";
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 3, out: 2 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const told = (r, id) => String((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "");
const reqOf = (x) => { const c = String(x.command || ""); if (typeof x.payload === "string" && c.includes("@REQUEST")) return JSON.parse(x.payload); const m = /^node --no-warnings \S+ ([A-Za-z0-9+/=]+)$/.exec(c); return m ? JSON.parse(Buffer.from(m[1], "base64").toString("utf8")) : null; };
const base = (send, extra = {}) => ({ send, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "last3", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false", ...extra });

async function isoRun({ finish }) {
  const tools = [], cmds = [], subSys = [];
  const exec = async (x) => {
    const c = String(x.command || "");
    cmds.push(c);
    const q = reqOf(x);
    if (q) { tools.push({ ...q, toolCwd: x.toolCwd }); return { code: 0, output: q.tool === "write" ? "File created successfully at: " + q.args.path : "" }; }
    if (c.includes("worktree add")) return { code: 0, output: W.MARK + " OK " + WT + "|worktree-agent-1-x|" + ROOT + "\n" };
    if (c.includes("git status --porcelain")) return { code: 0, output: W.MARK + " " + finish + "\n" };
    return { code: 0, output: "" };
  };
  let mi = 0, sub = 0;
  const main = [say("", [call("agent", { run_in_background: false, description: "iso", prompt: "Create file iso.txt containing hi, then reply DONE", isolation: "worktree" }, "a1")]), say("ok")];
  const send = async (req) => {
    if (isSub(req)) { if (!sub) subSys.push(req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n")); sub++; return sub === 1 ? say("", [call("write", { path: ROOT + "/iso.txt", content: "hi" }, "w1"), call("bash", { command: "cat iso.txt" }, "b1")]) : say("", [call("subagent_handback", { message: "DONE" }, "h")]); }
    return main[Math.min(mi++, main.length - 1)];
  };
  const r = await A.runCoder(base(send, { exec }), { text: "go", mode: "bypassPermissions", rules: { allow: [], ask: [], deny: [] } });
  return { r, tools, cmds, subSys };
}

test("L1 (row 8) a helper with isolation worktree writes in its worktree, even by a full path into the chat's folder, and is kept with its path and branch", async () => {
  const { r, tools, cmds, subSys } = await isoRun({ finish: "KEPT" });
  const w = tools.find((t) => t.tool === "write");
  assert.ok(w, "the write ran");
  assert.equal(w.args.path, WT + "/iso.txt", "the full path into the chat's folder is the worktree's file");
  assert.equal(w.toolCwd, WT, "the file tools' short paths count from the worktree");
  assert.ok(cmds.some((c) => c.startsWith("( cd -- '" + WT + "' || exit 1\ncat iso.txt")), "its command ran in the worktree");
  assert.match(subSys[0], /You are operating in an isolated git worktree at .*agent-1-x/);
  assert.match(told(r, "a1"), /worktreePath: .*agent-1-x\nworktreeBranch: worktree-agent-1-x/);
});

test("L2 a helper's worktree with nothing changed is removed, and no path is returned", async () => {
  const { r } = await isoRun({ finish: "REMOVED" });
  assert.doesNotMatch(told(r, "a1"), /worktreePath/);
});

test("L3 inFolder: full paths outside the chat's checkout stay as they are; the worktree is the helper's project", () => {
  const f = A.inFolder({ root: ROOT, exec: async (o) => o }, WT);
  assert.equal(f.root, WT);
  assert.equal(f.where("/etc/hosts"), "/etc/hosts");
  assert.equal(f.where(ROOT + "/src/a.js"), WT + "/src/a.js");
  assert.equal(f.where(WT + "/b.js"), WT + "/b.js");
  assert.deepEqual(f.mapArgs("read", { path: ROOT + "/a" }), { path: WT + "/a" });
  assert.deepEqual(f.mapArgs("bash", { command: "ls " + ROOT }), { command: "ls " + ROOT }, "only file tools' paths");
});

test("L4 the machine gives a tool call its own folder (toolCwd) only inside the chat's folder", () => {
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /toolCwd\.startsWith\(dir \+ "\/"\) \? \{ CODER_CWD: toolCwd \}/);
});

/** Two local servers like GitHub's chain: github's (127.0.0.1) sets a cookie and sends the client round once, then on. */
async function githubLike({ cookieFirst }) {
  const raw = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("Hello World!"); });
  await new Promise((r) => raw.listen(0, "127.0.0.1", r));
  const rawUrl = "https://localhost:" + raw.address().port + "/octocat/Hello-World/master/README";
  let hits = 0;
  const gh = http.createServer((req, res) => {
    hits++;
    if (cookieFirst && !/_gh_sess=1/.test(String(req.headers.cookie || ""))) { res.writeHead(302, { location: req.url, "set-cookie": "_gh_sess=1; path=/; HttpOnly" }); return res.end(); }
    res.writeHead(302, { location: rawUrl }); res.end();
  });
  await new Promise((r) => gh.listen(0, "127.0.0.1", r));
  const url = "https://127.0.0.1:" + gh.address().port + "/octocat/Hello-World/raw/master/README";
  const request = (u, o) => F.requestOnce(u.replace(/^https:/, "http:"), o);
  return { url, rawUrl, request, hits: () => hits, close: () => { gh.close(); raw.close(); } };
}

test("L5 (row 376) WebFetch: GitHub's redirect to raw.githubusercontent.com, another host, is the REDIRECT DETECTED note on the first hop", async () => {
  const s = await githubLike({ cookieFirst: false });
  try {
    const got = await F.fetchPage({ url: s.url }, { request: s.request });
    assert.equal(got.facts.kind, "redirect");
    assert.equal(got.facts.redirectUrl, s.rawUrl);
    assert.equal(s.hits(), 1, "one hop");
    assert.match(F.redirectText(got.facts, { prompt: "what does it say" }), /^REDIRECT DETECTED/);
  } finally { s.close(); }
});

test("L6 WebFetch keeps a fetch's cookies across its redirects: a site that sets one and sends the client back gets it, not ten loops", async () => {
  const s = await githubLike({ cookieFirst: true });
  try {
    const got = await F.fetchPage({ url: s.url }, { request: s.request });
    assert.equal(got.facts.kind, "redirect");
    assert.equal(got.facts.redirectUrl, s.rawUrl);
    assert.equal(s.hits(), 2);
  } finally { s.close(); }
  const jar = new Map();
  assert.equal(F.keepCookies(jar, "h", ["a=1; Path=/", "b=2"]), true);
  assert.equal(F.keepCookies(jar, "h", "a=1"), false);
  assert.deepEqual([...jar.get("h")], [["a", "1"], ["b", "2"]]);
});

test("L7 (row 24) Artifact publish of a file outside the working folders asks on a card, then reads it with the owner's yes and publishes", async () => {
  const events = [], reads = [], api = [];
  const steps = [say("", [call("artifact", { file_path: "/tmp/p4.html", title: "P4 audit" }, "p1")]), say("Done.")];
  let n = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const q = reqOf(x);
      if (q && q.tool === "send_file") { reads.push(q); return q.outside === true ? { code: 0, output: JSON.stringify({ path: q.args.path, name: "p4.html", size: 11, data: Buffer.from("<h1>p4</h1>").toString("base64") }) } : { code: 1, output: "error: that path is outside the project" }; }
      return { code: 0, output: "" };
    },
    envApi: async (q) => { api.push(q); return { ok: true, text: "Published", id: "pabcdefghij", version: 1 }; },
    emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "last3", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false",
    ask: async (pid) => ({ choice: "yes", _e: events.find((e) => e.type === "permission" && e.pid === pid) }),
  }, { text: "go", mode: "default", rules: { allow: [], ask: [], deny: [] } });
  const cards = events.filter((e) => e.type === "permission");
  assert.ok(cards.length >= 1, "a card was shown");
  assert.match(JSON.stringify(cards[0]), /outside the working folders/);
  assert.equal(reads.length, 2);
  assert.equal(reads[1].outside, true, "read again with the owner's yes");
  assert.ok(api.some((q) => q.op === "publish" && q.html.includes("p4")), "published");
  assert.match(told(r, "p1"), /^Published/);
});

test("L8 Artifact publish outside the working folders: a no publishes nothing", async () => {
  const events = [], api = [];
  const steps = [say("", [call("artifact", { file_path: "/tmp/p4.html" }, "p1")]), say("Done.")];
  let n = 0;
  await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { const q = reqOf(x); return q && q.tool === "send_file" ? { code: 1, output: "error: that path is outside the project" } : { code: 0, output: "" }; },
    envApi: async (q) => { api.push(q); return { ok: true }; },
    emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "last3", where: (p) => p, toolSearch: "false",
    ask: async () => ({ choice: "no" }),
  }, { text: "go", mode: "default", rules: { allow: [], ask: [], deny: [] } });
  assert.equal(api.filter((q) => q.op === "publish").length, 0);
});

test("L9 a push answer with no reason (the machine busy) says why, not just 'the push failed'", () => {
  const p = RT.pushAnswer({ error: "busy" });
  assert.equal(p.ok, false);
  assert.match(p.why, /a job was still running on Coder's machine/);
  assert.equal(RT.pushAnswer({ ok: true, pushed: true }).ok, true);
  assert.equal(RT.pushAnswer(null).ok, false);
  assert.equal(RT.pushAnswer({ ok: false, why: "x" }).why, "x");
});

test("L10 a message the running job could not take is said under the box, never left as a silent 'sent'", () => {
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /handed = await post\("\/queue"/);
  assert.match(routes, /!\(handed && handed\.ok === true\)\) await saveNow\(\)/);
  assert.match(routes, /notRead: true, error: "Coder's job is finishing, so it could not read your message/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /q\.data\.queued\) \{ S\.queue = q\.data\.queue \|\| \[\]; boxEmpty\(\); S\.error = q\.data\.error \? String\(q\.data\.error\) : ''/);
});

test("L11 a push with a file over GitHub's 100 MB limit is not sent, and names the file and the limit", async () => {
  assert.equal(S.GITHUB_FILE_MAX, 104857600);
  const why = S.bigFilesWhy([{ path: ".hk/big.bin", size: 150 * 1048576, commit: "abc1234" }]);
  assert.match(why, /GitHub rejects files larger than 100 MB/);
  assert.match(why, /\.hk\/big\.bin \(150\.0 MB, in commit abc1234\)/);
  assert.deepEqual(S.ghLargeFiles("remote: error: File .hk/big.bin is 150.00 MB; this exceeds GitHub's file size limit of 100.00 MB\nremote: error: GH001: Large files detected."), [{ path: ".hk/big.bin", size: 157286400 }]);
  // A real repository: a commit not on origin with a file over a (test-sized) limit is found.
  const top = mkdtempSync(join(tmpdir(), "big-"));
  const d = join(top, "chat");
  execFileSync("mkdir", ["-p", d]);
  const g = (...a) => execFileSync("git", ["-C", d, ...a], { stdio: "pipe" });
  g("init", "-q"); g("config", "user.email", "t@t"); g("config", "user.name", "t");
  writeFileSync(join(d, "small.txt"), "x"); writeFileSync(join(d, "big.bin"), Buffer.alloc(2048));
  g("add", "."); g("commit", "-qm", "one");
  const o = { gitDir: join(d, ".git"), root: top };
  const big = await S.bigFilesToPush(d, o, { max: 1024 });
  assert.deepEqual(big.map((x) => [x.path, x.size]), [["big.bin", 2048]]);
});
