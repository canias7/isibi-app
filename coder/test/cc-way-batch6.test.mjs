// "GO CLAUDE CODE WAY", BATCH 6 (2026-11-22): the items of this batch Coder now does as Claude Code does, each with the case
// that failed before it.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = await import("../container/server.mjs");
const C = await import("../container/coder-context.mjs");
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const HERE = (p) => new URL("../" + p, import.meta.url);

/** Coder's real machine service, with a scripted Grok (as context-cache.test.mjs's): `job(body, steps)` runs one message. */
async function machine() {
  const roots = {};
  for (const k of ["root", "gitRoot", "memRoot", "bgRoot"]) roots[k] = await realpath(await mkdtemp(join(tmpdir(), "coder-b6-" + k + "-")));
  let steps = [], n = 0;
  const seen = [];
  const srv = http.createServer(S.createApp({ ...roots, send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; } }));
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const job = async (body, list) => {
    steps = list; n = 0; seen.length = 0;
    const r = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(r.status, 200, await r.text());
    let st;
    for (let i = 0; i < 300; i++) { st = await (await fetch(base + "/state?project=" + body.project + "&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.ok(st.result, "the job ended");
    await fetch(base + "/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: body.project }) });
    return { st, sent: seen.slice(), result: st.result };
  };
  return { roots, job, close: () => srv.close() };
}
/** Everything the job's first request to Grok carried in the conversation (the context's notes). */
const told = (sent) => sent[0].messages.filter((m) => C.isContextNote(m) || m.ctx).map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");

test("MISS-69 the instruction files and memory switches, as Claude Code's: CLAUDE_CODE_DISABLE_AUTO_MEMORY (1 off, 0 forced on), autoMemoryEnabled in the repository's settings, CLAUDE_CODE_DISABLE_CLAUDE_MDS (no instruction files and no memory)", async () => {
  // The switches themselves.
  assert.equal(S.memoryOn({}), true);
  assert.equal(S.memoryOn({ CODER_DISABLE_AUTO_MEMORY: "1" }), false);
  assert.equal(S.memoryOn({ CODER_AUTO_MEMORY_ENABLED: "false" }), false);
  assert.equal(S.memoryOn({ CODER_AUTO_MEMORY_ENABLED: "false", CODER_DISABLE_AUTO_MEMORY: "0" }), true, "the variable wins over the key, in either direction");
  assert.equal(S.memoryOn({ CODER_AUTO_MEMORY_ENABLED: "true", CODER_DISABLE_AUTO_MEMORY: "1" }), false);
  assert.equal(S.memoryOn({ CODER_DISABLE_CODER_MDS: "1", CODER_DISABLE_AUTO_MEMORY: "0" }), false, "no instruction files means no memory either");
  assert.equal(S.instructionsOn({}), true);
  assert.equal(S.instructionsOn({ CODER_DISABLE_CODER_MDS: "1" }), false);
  // Claude Code's names, typed in the Environment window or in the repository's settings.
  assert.equal(S.ownerCoderVars({ CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" }).CODER_DISABLE_AUTO_MEMORY, "1");
  assert.equal(S.ownerCoderVars({ CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" }).CODER_DISABLE_CODER_MDS, "1");
  const d = mkdtempSync(join(tmpdir(), "coder-b6mem-"));
  mkdirSync(join(d, ".claude"));
  writeFileSync(join(d, ".claude", "settings.json"), JSON.stringify({ autoMemoryEnabled: false }));
  assert.equal(S.memoryOn(S.withRepoOwn({}, S.repoSettings(d, { trust: false }).own)), false, "the repository's autoMemoryEnabled: false");
  assert.equal(S.memoryOn(S.withRepoOwn(S.ownerCoderVars({ CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0" }), S.repoSettings(d, { trust: false }).own)), true, "the owner's 0 forces it on");
  writeFileSync(join(d, ".claude", "settings.json"), JSON.stringify({ env: { CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" } }));
  assert.equal(S.instructionsOn(S.withRepoOwn({}, S.repoSettings(d, { trust: false }).own)), false, "its env block");

  // A real job on Coder's machine.
  const m = await machine();
  try {
    const memory = "- tests: npm test\nStyle: keep answers short";
    const prep = async (project, settings) => {
      const dir = join(m.roots.root, project);
      await mkdir(join(dir, ".claude"), { recursive: true });
      await writeFile(join(dir, "CODER.md"), "Use tabs.");
      if (settings) await writeFile(join(dir, ".claude", "settings.json"), JSON.stringify(settings));
      return dir;
    };
    // On (the default): the memory and its style lines are told, and come back for the Worker to keep.
    await prep("mem-on");
    const on = await m.job({ project: "mem-on", text: "hi", messages: [], memory }, [say("ok")]);
    assert.match(told(on.sent), /YOUR MEMORY FOR THIS REPO, kept between chats/);
    assert.match(told(on.sent), /THE OWNER'S STYLE/);
    assert.match(told(on.sent), /THE REPO'S OWN INSTRUCTIONS \(CODER\.md\)/);
    assert.match(String(on.result.memory), /- tests: npm test/, "the memory comes back");
    // Off by the variable: not told, not written on the machine, and nothing sent back, so the Worker's copy stays as it was.
    await prep("mem-off");
    const off = await m.job({ project: "mem-off", text: "hi", messages: [], memory, setup: { vars: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" } } }, [say("ok")]);
    assert.doesNotMatch(told(off.sent), /YOUR MEMORY FOR THIS REPO/);
    assert.doesNotMatch(told(off.sent), /THE OWNER'S STYLE/);
    assert.doesNotMatch(told(off.sent), /npm test/);
    assert.match(told(off.sent), /THE REPO'S OWN INSTRUCTIONS \(CODER\.md\)/, "the instruction files still load");
    assert.equal(off.result.memory, undefined, "nothing for the Worker to save over its copy");
    assert.equal(off.result.memoryFiles, undefined);
    assert.equal(existsSync(join(m.roots.memRoot, "mem-off", "MEMORY.md")), false, "not written on the machine");
    // Off by the repository's autoMemoryEnabled: false.
    await prep("mem-repo", { autoMemoryEnabled: false });
    const repo = await m.job({ project: "mem-repo", text: "hi", messages: [], memory }, [say("ok")]);
    assert.doesNotMatch(told(repo.sent), /YOUR MEMORY FOR THIS REPO/);
    assert.equal(repo.result.memory, undefined);
    // ...and forced back on by the owner's CLAUDE_CODE_DISABLE_AUTO_MEMORY=0.
    await prep("mem-forced", { autoMemoryEnabled: false });
    const forced = await m.job({ project: "mem-forced", text: "hi", messages: [], memory, setup: { vars: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0" } } }, [say("ok")]);
    assert.match(told(forced.sent), /YOUR MEMORY FOR THIS REPO/);
    assert.equal(typeof forced.result.memory, "string");
    // CLAUDE_CODE_DISABLE_CLAUDE_MDS: no instruction file and no memory.
    await prep("mds-off");
    const mds = await m.job({ project: "mds-off", text: "hi", messages: [], memory, setup: { vars: { CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" } } }, [say("ok")]);
    assert.doesNotMatch(told(mds.sent), /THE REPO'S OWN INSTRUCTIONS/);
    assert.doesNotMatch(told(mds.sent), /Use tabs/);
    assert.doesNotMatch(told(mds.sent), /YOUR MEMORY FOR THIS REPO/);
    assert.equal(mds.result.memory, undefined);
  } finally { m.close(); }
});

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("M-d-48 a repository added to a chat that is already going, between jobs, as Claude Code adds one to a running cloud session: refused only while Coder works, waits on a card or rewinds; the next job carries it; taking one away stays a before-the-first-message thing", async () => {
  const { handleCoder, extraFor, REPO_ADD_BUSY, REPO_REMOVE_LATE } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-b6r";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const key = "coder/" + uid + "/" + id + "/meta.json";
  const setMeta = (o) => bucket.put(key, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 3, status: "idle", ...o }));
  const fetchFn = async (url) => { const u = String(url); const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s }); if (/\/repos\/ana\/(api|web)$/.test(u)) return J({ default_branch: "main", permissions: { push: true } }); return J({}, 404); };
  const deps = { fetchFn, authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async () => Response.json({}) }) };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const add = (repo) => go("projects/" + id + "/repos", { method: "POST", body: JSON.stringify({ repo }) });
  // While Coder works: not now (it is opened by the next job).
  await setMeta({ status: "running", at: Date.now() });
  const busy = await add("ana/api");
  assert.equal(busy.status, 409);
  assert.equal((await busy.json()).error, REPO_ADD_BUSY);
  assert.equal(REPO_ADD_BUSY, "Coder is still working: add the repository once it is done.");
  // While a rewind holds the chat: not now either.
  await setMeta({ rewinding: { id: "r1", at: Date.now(), what: "restore" } });
  assert.equal((await add("ana/api")).status, 409);
  // Between jobs, after three messages: added, and the next job carries it on the chat's branch.
  await setMeta({});
  const ok = await add("ana/api");
  assert.equal(ok.status, 200, "added mid-chat");
  const p = (await ok.json()).project;
  assert.deepEqual(p.repos, [{ repo: "ana/api", base: "main" }]);
  assert.deepEqual(extraFor(p), [{ repo: "ana/api", base: "main", branch: "coder/" + id }]);
  // Taking it away after the first message: refused, in plain words.
  const gone = await go("projects/" + id + "/repos?repo=ana%2Fapi", { method: "DELETE" });
  assert.equal(gone.status, 409);
  assert.equal((await gone.json()).error, REPO_REMOVE_LATE);
  // The page: "+ Repository" shows after the first message too (not while Coder works), the list loads for a chat that has
  // started, and the × to take one away stays before the first message only.
  const page = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(page, /\(S\.project && !S\.running && !S\.ending && !S\.rewinding && !S\.project\.parked && S\.allRepos && S\.allRepos\.length > 1 && \(S\.project\.repos \|\| \[\]\)\.length < 3/);
  assert.match(page, /title="Add another repository to this chat \(the next message opens it\)"/);
  assert.match(page, /if \(S\.allRepos \|\| !S\.project\) return;/);
  assert.match(page, /\(!S\.project\.turn && !S\.running \? '<button type="button" data-unrepo=/);
});

test("MISS-61 /clear (and /reset, /new), Claude Code's \"Starts a fresh conversation with empty context in the same cloud session\": what Coder reads is emptied, the earlier conversation is kept beside it, the shown history stays above a line, the Rewind list starts again; while Coder works it waits as a command; the next job runs SessionEnd (\"clear\") and SessionStart (\"clear\") hooks", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  assert.ok(R.isClearCmd("/clear") && R.isClearCmd("/reset") && R.isClearCmd("/new") && R.isClearCmd("  /CLEAR  "));
  assert.ok(!R.isClearCmd("/clearly") && !R.isClearCmd("clear") && !R.isClearCmd("/compact"));
  const uid = "user-1234567890abcdef", id = "shop-b6c";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const k = (f) => "coder/" + uid + "/" + id + "/" + f;
  const convo = [{ role: "user", content: "make the shop" }, { role: "assistant", content: "Made it." }];
  await bucket.put(k("meta.json"), JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 2, status: "idle", marks: [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 3, msg: 2 }], commits: [{ sha: "a".repeat(40), title: "Make the shop" }] }));
  await bucket.put(k("messages.json"), JSON.stringify(convo));
  await bucket.put(k("events.json"), JSON.stringify([{ type: "user", text: "make the shop", at: 1 }, { type: "done", text: "Made it.", at: 2 }]));
  const turns = [];
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async (req) => { if (new URL(req.url).pathname === "/turn") turns.push(1); return Response.json({ ok: true }); } }) };
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const say = (text) => go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text }) });
  const r = await say("/clear");
  assert.equal(r.status, 200, await r.clone().text());
  const d = await r.json();
  assert.equal(d.cleared, true);
  assert.equal(d.reload, true, "the page loads the chat again");
  assert.equal(turns.length, 0, "no job, no Grok call, no machine");
  assert.deepEqual(JSON.parse(bucket.m.get(k("messages.json"))), [], "what Coder reads is empty");
  const kept = [...bucket.m.keys()].filter((x) => /\/cleared-\d+\.json$/.test(x));
  assert.equal(kept.length, 1, "the earlier conversation is kept, not deleted");
  assert.deepEqual(JSON.parse(bucket.m.get(kept[0])), convo);
  const ev = JSON.parse(bucket.m.get(k("events.json")));
  assert.equal(ev.length, 3, "the shown history stays");
  assert.deepEqual([ev[2].type, ev[2].text], ["note", R.CLEARED_NOTE]);
  assert.equal(R.CLEARED_NOTE, "/clear · Started a new conversation with empty context. Coder's machine, its files and the branch stay as they are, and so does the memory.");
  const meta = JSON.parse(bucket.m.get(k("meta.json")));
  assert.deepEqual(meta.marks, [], "the Rewind list starts again from here");
  assert.equal(meta.sessionClear, true, "the next job runs the clear hooks");
  assert.equal(meta.branch, "coder/" + id);
  assert.equal(meta.commits.length, 1, "the code and its commits are untouched");
  // Not with pictures or line comments.
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "/reset", comments: [{ file: "a.js", line: 1, quote: "x", text: "y" }] }) })).status, 400);
  // While Coder works: it waits as a command ("Runs when Coder is done"), never handed to the running job.
  await bucket.put(k("meta.json"), JSON.stringify({ ...meta, status: "running", at: Date.now() }));
  const q = await (await say("/new")).json();
  assert.equal(q.queued, true);
  assert.equal(q.queue[q.queue.length - 1].cmd, "clear");
  assert.equal(q.queue[q.queue.length - 1].later, undefined);
  // The next job: the flag goes with it once and is then dropped.
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /const clearOn = meta\.sessionClear \? \{ cleared: true \} : \{\};/);
  assert.match(routes, /\.\.\.lastAtOn, \.\.\.clearOn, text: takeUp/);
  assert.match(routes, /status: "running", at: Date\.now\(\), starting: null, start: claim\.id, sessionClear: undefined,/);
  assert.match(readFileSync(HERE("container/server.mjs"), "utf8"), /cleared: !gloopy && body\.cleared === true,/);
  // The page: /clear in the / list with Claude Code's other names; picked or typed, it goes to the Worker.
  const page = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(page, /\['\/clear', 'Start a new conversation with empty context', \['reset', 'new'\]\]/);

  // On Coder's machine: the first job after it runs SessionEnd with reason "clear", then SessionStart with source "clear".
  const A = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const calls = [];
  const hooks = H.hooksFrom({ hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "end.sh" }] }], SessionStart: [{ matcher: "clear", hooks: [{ type: "command", command: "start.sh" }] }] } }, "settings").list;
  const loop = (o) => A.runCoder({
    send: async () => ({ message: { role: "assistant", content: "ok" }, usage: { in: 1, out: 1 } }),
    exec: async (x) => { const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command)); if (mark && x.hook === true) { calls.push(JSON.parse(x.payload)); return { code: 0, output: mark[0] + "\n" }; } return { code: 0, output: "ok\n" }; },
    emit: () => {}, here: () => "/work/shop", root: "/work/shop", chatId: id, where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
  }, { text: "hi", messages: [], hooks, ...o });
  await loop({ cleared: true });
  assert.deepEqual(calls.map((c) => [c.hook_event_name, c.reason || c.source]), [["SessionEnd", "clear"], ["SessionStart", "clear"]]);
  calls.length = 0;
  await loop({});
  assert.deepEqual(calls.map((c) => c.hook_event_name), [], "a chat's first message is \"startup\", which this matcher leaves out, and no SessionEnd");
});

test("M-a-33 grep and glob reach .git as Claude Code's own Grep and Glob do (tried on Claude Code's real tools): a search of the folders around it leaves .git out, a path inside .git is searched, and glob lists what is in it; through the chat's gitfile, shown as .git/..., never a credentials file", async () => {
  const { spawnSync } = await import("node:child_process");
  const { gitDirFor } = await import("../container/server.mjs");
  const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const tool = (cwd, name, args) => { const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd, encoding: "utf8", env: { PATH: process.env.PATH } }); return String(r.stdout || "").replace(/^\u0000coder-facts\u0000[^\n]*\n/, ""); };
  const top = await mkdtemp(join(tmpdir(), "coder-b6git-"));
  const work = join(top, "work", "chat1"), gitRoot = join(top, "git");
  const gd = gitDirFor(work, gitRoot);
  for (const d of [work, join(gd, "refs", "heads")]) await mkdir(d, { recursive: true });
  await writeFile(join(gd, "HEAD"), "ref: refs/heads/main\n");
  await writeFile(join(gd, "refs", "heads", "main"), "0123456789abcdef0123456789abcdef01234567\n");
  await writeFile(join(gd, "credentials"), "ref: refs/heads/secret\n");
  await writeFile(join(work, ".git"), "gitdir: " + gd + "\n");
  await writeFile(join(work, "notes.txt"), "see refs/heads/main\n");
  // A search of the project: .git left out (Claude Code's Grep: "does not go into version-control folders").
  assert.equal(tool(work, "grep", { pattern: "gitdir" }), "No files found");
  assert.match(tool(work, "grep", { pattern: "refs/heads" }), /^Found 1 file\nnotes\.txt$/);
  // A path inside .git: searched, shown as asked (was: "the .git folder is off limits").
  assert.match(tool(work, "grep", { pattern: "refs/heads", path: ".git" }), /^Found 1 file\n\.git\/HEAD$/);
  assert.match(tool(work, "grep", { pattern: "^ref:", path: ".git/HEAD", output_mode: "content" }), /ref: refs\/heads\/main/);
  // Glob lists what is in .git, like any hidden folder.
  const listed = tool(work, "glob", { pattern: "**/*", path: ".git" }).split("\n").sort();
  assert.deepEqual(listed, [".git/HEAD", ".git/refs/heads/main"]);
  // Never a file named for credentials, as the read tool keeps it; and writing in .git is still refused.
  assert.equal(tool(work, "grep", { pattern: "secret", path: ".git/credentials" }), "error: the .git folder is off limits");
  assert.equal(tool(work, "write", { path: ".git/zz.txt", content: "x" }), "error: the .git folder is off limits");
});

test("M-a-08 Rewind's Restore code as Claude Code's checkpoints: the files go back on Coder's machine with no new commit and nothing pushed; what they are then is kept for the next job's commit, so a later Rewind to before that job puts them back as the restore left them", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  // The plan: a commit's `prior` (a restore's saved copy) wins over its parent for the files it names.
  const blob = "b".repeat(40);
  const commits = [
    { sha: "a1", turn: 1, title: "One", edited: ["src/app.js"], tracked: true },
    { sha: "d4", turn: 4, title: "Four", edited: ["src/app.js", "src/new.js"], tracked: true, prior: { "src/app.js": { blob, mode: "100644" }, "src/new.js": null } },
  ];
  assert.deepEqual(R.restorePlan(commits, 4).items, [{ path: "src/app.js", blob, mode: "100644" }, { path: "src/new.js", gone: true }]);
  assert.deepEqual(R.restorePlan(commits, 1).items, [{ path: "src/app.js", before: "a1" }, { path: "src/new.js", gone: true }], "a file first changed in a job that began after a restore goes back to the restore's state");
  assert.equal(R.restoreKept(false), "not committed: your next message's save takes it to the branch");
  // The Worker's Rewind: no push, the files' states kept on the chat for the next commit.
  const uid = "user-1234567890abcdef", id = "shop-b6w";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const k = (f) => "coder/" + uid + "/" + id + "/" + f;
  await bucket.put(k("meta.json"), JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 2, status: "idle", pushed: true, unpushed: 0, commits: [{ sha: "a1", turn: 1, title: "One", edited: ["src/app.js"], tracked: true }, { sha: "c2", turn: 2, title: "Two", edited: ["src/app.js", "src/new.js"], tracked: true }], marks: [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 2, msg: 2 }] }));
  await bucket.put(k("events.json"), JSON.stringify([{ type: "user", text: "a" }, { type: "done", text: "b" }, { type: "user", text: "c" }, { type: "done", text: "d" }]));
  await bucket.put(k("messages.json"), JSON.stringify([{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }, { role: "assistant", content: "d" }]));
  const asked = [];
  const deps = { fetchFn: async () => new Response("{}"), authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async (req) => { const b = await req.json(); asked.push([new URL(req.url).pathname, b]); return Response.json(new URL(req.url).pathname === "/restore" ? { ok: true, restored: ["src/app.js", "src/new.js"], removed: ["src/new.js"], skipped: [], prior: { "src/app.js": { blob, mode: "100644" }, "src/new.js": null, "not/restored.js": { blob, mode: "100644" } } } : { ok: true }); } }) };
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const r = await (await go("projects/" + id + "/rewind", { method: "POST", body: JSON.stringify({ turn: 2, code: true }) })).json();
  assert.deepEqual(asked.map((a) => a[0]), ["/restore"], "only the restore: no push");
  assert.deepEqual(r.project.commits.map((c) => c.sha), ["a1"]);
  assert.deepEqual(r.project.restoredPrior, { "src/app.js": { blob, mode: "100644" }, "src/new.js": null }, "only the files it restored");
  assert.match(JSON.parse(bucket.m.get(k("events.json"))).at(-1).text, /not committed: your next message's save takes it to the branch/);
  // The next job's save keeps them with its first new commit, and forgets them then.
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /const firstNew = meta\.restoredPrior && typeof meta\.restoredPrior === "object" \? commits\.find\(\(c\) => c && !knownShas\.has\(c\.sha\)\) : null;/);
  assert.match(routes, /if \(firstNew\) commits = commits\.map\(\(c\) => \(c === firstNew \? \{ \.\.\.c, prior: meta\.restoredPrior \} : c\)\);/);
  assert.match(routes, /\.\.\.\(firstNew \? \{ restoredPrior: undefined \} : \{\}\)/);
  // The page's Rewind box says so.
  const page = readFileSync(HERE("public/coder.js"), "utf8");
  assert.match(page, /They are put back on Coder\\'s machine with no new commit, as Claude Code\\'s checkpoints do; your next message\\'s save takes them to the branch\. /);
  assert.doesNotMatch(page, /It is undone with a new commit ' \+ kept/);
});
