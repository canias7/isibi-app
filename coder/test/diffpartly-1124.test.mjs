// THE "TOOL PARAMETERS & LIMITS" TAB'S ✗ AND ~ ROWS MADE CLAUDE CODE'S (2026-11-24): hooks get a helper agent's, Projects'
// and Artifact's result objects; exit_worktree refuses a worktree whose state git could not give; a foreground `sleep N`
// alone is refused; a WebFetch redirect to another host is returned, not followed; saved and plugin skills that set
// allowed-tools ask; a question card whose job paused counts down; a path outside the working folders asks on a card.
// The model is stubbed: no paid call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const W = await import("../container/coder-worktree.mjs");
const B = await import("../container/coder-bashcheck.mjs");
const F = await import("../container/coder-webfetch.mjs");
const P = await import("../container/coder-projects.mjs");
const CP = await import("../container/coder-plugins.mjs");
const SP = await import("../src/coder-plugins.mjs");
const MK = await import("../src/coder-marketplace.mjs");
const PK = await import("../container/coder-park.mjs");

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 3, out: 2 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/dp-1124";
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const told = (r, id) => String((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "");
const hookExec = (calls, other = async () => ({ code: 0, output: "" })) => async (x) => {
  const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
  if (mark && x.hook === true) { calls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
  return other(x);
};
const postHooks = H.hooksFrom({ hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "post.sh" }] }] } }, "settings").list;

test("DP1 (rows 5-8, 414-416, 421) a PostToolUse hook gets the Agent call's result object, not its text", async () => {
  const hookCalls = [];
  let mi = 0;
  const main = [say("", [call("agent", { description: "fruit", prompt: "say KIWI", run_in_background: false }, "a1")]), say("ok")];
  const send = async (req) => (isSub(req) ? say("KIWI BANANA2") : main[Math.min(mi++, main.length - 1)]);
  const r = await A.runCoder({ send, exec: hookExec(hookCalls), emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "dp-1124", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false" }, { text: "go", mode: "auto", rules: { allow: [], ask: [], deny: [] }, hooks: postHooks });
  assert.match(told(r, "a1"), /KIWI BANANA2/, "Coder still reads the text");
  const post = hookCalls.find((c) => c.hook_event_name === "PostToolUse" && c.tool_name === "Agent");
  assert.ok(post, "the Agent call's PostToolUse hook ran");
  const o = post.tool_response;
  assert.equal(typeof o, "object");
  assert.equal(o.status, "completed");
  assert.equal(o.content[0].text, "KIWI BANANA2");
  for (const k of ["agentId", "resolvedModel", "totalToolUseCount", "totalDurationMs", "totalTokens", "usage", "toolStats", "prompt"]) assert.ok(k in o, k);
  for (const k of ["readCount", "searchCount", "bashCount", "editFileCount", "linesAdded", "linesRemoved", "otherToolCount"]) assert.equal(typeof o.toolStats[k], "number", k);
  assert.equal(typeof o.usage.input_tokens, "number");
  assert.ok(!("modelsUsed" in o), "modelsUsed only on a swap");
});

test("DP2 (rows 235, 243) Projects hands its result object to the hooks; Coder still reads the JSON", async () => {
  let facts = null; const said = [];
  await P.projectsTool({ args: { method: "project_info" }, id: "p1", deps: { envApi: async (b) => ({ ok: true, method: b.method, name: "Shop", docs: [{ path: "a.md", created_at: null }] }) }, emit: () => {}, reply: (t) => said.push(t), facts: (o) => { facts = o; } });
  assert.deepEqual(facts, { method: "project_info", name: "Shop", docs: [{ path: "a.md", created_at: null }] });
  assert.deepEqual(JSON.parse(said[0]), facts);
});

test("DP3 (row 427) Artifact's publish and list hand their result objects to the hooks", () => {
  const src = readFileSync(new URL("../container/coder-resources.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(typeof h\.facts === "function"\) h\.facts\(out\);/);
  assert.match(src, /if \(typeof h\.facts === "function"\) h\.facts\(facts\);/);
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agent, /resourceToolCall\(c, \{ facts: \(o\) => toolFacts\.set\(c\.id, o\)/);
  assert.match(agent, /projectsTool\(\{ args: c\.args \|\| \{\}, id: c\.id, deps, emit, reply, scrub, root: deps\.root, facts: \(o\) => toolFacts\.set\(c\.id, o\) \}\)/);
});

test("DP4 (rows 134, 135) exit_worktree: an uncommitted file is counted; a state git could not give refuses; Claude Code's words", () => {
  const dir = mkdtempSync(join(tmpdir(), "dp-wt-"));
  const sh = (c, cwd = dir) => execSync(c, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  sh("git init -q -b main . && git commit -q --allow-empty -m one && git worktree add -q .claude/worktrees/wt1 -b worktree-wt1");
  const wt = join(dir, ".claude/worktrees/wt1");
  writeFileSync(join(wt, "dirty.txt"), "x\n");
  const script = join(dir, "..", "dp-facts-" + Date.now() + ".sh");
  writeFileSync(script, W.exitFactsScript());
  const out = sh("bash " + script, wt);
  const m = W.markOf(out);
  assert.equal(m.kind, "STATE");
  const st = W.exitState(m.rest);
  assert.equal(st.files, 1);
  assert.equal(W.exitRefusedText(st), "Worktree has 1 uncommitted file. Removing will discard this work permanently. Confirm with the user, then re-invoke with discard_changes: true — or use action: \"keep\" to preserve the worktree.");
  const unknown = W.exitState(st.top + "|b|" + st.main + "|?|0");
  assert.equal(unknown.files, -1);
  assert.match(W.atRiskWords(unknown), /uncommitted changes that could not be checked/);
  assert.match(W.exitFactsScript(), /--untracked-files=all/);
});

test("DP5 (row 434) a foreground `sleep N` alone, N of 2 or more, is refused in Claude Code's words; shorter ones run", () => {
  assert.equal(B.sleepBlocked("sleep 20"), "Blocked: sleep 20. Run blocking commands in the background with run_in_background: true — you'll get a completion notification when done. For streaming events (watching logs, polling APIs), use the monitor tool. If you genuinely need a delay (rate limiting, deliberate pacing), keep it under 2 seconds.");
  assert.match(B.sleepBlocked("sleep 2"), /^Blocked: sleep 2\./);
  for (const c of ["sleep 1", "sleep 1.5", "sleep 5 && npm test", "echo a; sleep 9"]) assert.equal(B.sleepBlocked(c), "", c);
  assert.match(B.sleepBlocked("sleep 30"), /^Blocked: standalone sleep 30\./);
  assert.match(A.sleepBlockFor("sleep 20"), /run_in_background/);
});

test("DP6 (row 376) WebFetch: a redirect to another host comes back with its URL; a same-host one is followed", async () => {
  const hops = [];
  const request = async (u) => {
    hops.push(u);
    if (u === "https://github.com/octocat/Hello-World/raw/master/README") return { status: 302, statusText: "Found", headers: { location: "https://raw.githubusercontent.com/octocat/Hello-World/master/README" } };
    if (u === "https://example.com/a") return { status: 301, statusText: "Moved", headers: { location: "/b" } };
    return { status: 200, statusText: "OK", headers: { "content-type": "text/plain" }, body: Buffer.from("hello") };
  };
  const r = await F.fetchPage({ url: "https://github.com/octocat/Hello-World/raw/master/README" }, { request });
  assert.deepEqual(r.facts, { kind: "redirect", originalUrl: "https://github.com/octocat/Hello-World/raw/master/README", redirectUrl: "https://raw.githubusercontent.com/octocat/Hello-World/master/README", statusCode: 302 });
  assert.equal(hops.length, 1, "the other host is not fetched");
  assert.match(F.redirectText(r.facts, { prompt: "read it" }), /^REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically\./);
  const s = await F.fetchPage({ url: "https://example.com/a" }, { request });
  assert.equal(s.text, "hello");
  assert.equal(hops.at(-1), "https://example.com/b");
});

// (2026-11-28, Claude Code's skills docs: allowed-tools pre-approves tools for the turn instead of asking; a skill's hooks still
// ask. skills-agents-1128.test.mjs.)
test("DP7 (row 326) a saved or plugin skill that sets hooks keeps it, so loading it asks first; allowed-tools is read as a grant", async () => {
  const got = CP.withOwnerSkills([], [{ name: "tooly", body: "---\nallowed-tools: Bash(ls *)\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks:\n        - type: command\n          command: echo hi\n---\nrun ls" }, { name: "plug:x", body: "do x", asks: "hooks", source: "plugin plug" }, { name: "plain", body: "---\nallowed-tools: Read\n---\nhi" }]);
  assert.deepEqual(got.map((s) => s.asks), ["hooks", "hooks", undefined]);
  assert.deepEqual(got[2].allowed, ["Read"]);
  assert.equal(SP.cleanSkill({ name: "x", body: "b", asks: "allowed-tools" }).asks, "allowed-tools");
  assert.equal(SP.cleanSkill({ name: "x", body: "b", asks: "<script>" }).asks, undefined);
  assert.equal(MK.asksOf({ "allowed-tools": "Bash(ls *)", description: "d" }), "allowed-tools");
  // In Manual (default) mode the card shows; the owner's no stops the skill.
  const events = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => [say("", [call("skill", { skill: "tooly" }, "s1")])][n++] || say("ok"),
    exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), here: () => ROOT, root: ROOT,
    ask: async () => ({ choice: "no" }),
  }, { text: "go", mode: "default", skills: got });
  const card = events.find((e) => e.type === "permission" && e.tool === "skill");
  assert.ok(card, "a card");
  assert.match(card.why, /hooks/);
  assert.doesNotMatch(told(r, "s1"), /Launching skill/);
});

test("DP8 (rows 31, 247, 248) question auto-continue counts down on a card whose job paused, and its afk goes with the answer", () => {
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /const askWaitsOn = \(pid\) => !!\(S\.running \|\| \(S\.project && S\.project\.parked && S\.project\.parked\.pid === pid\)\);/);
  assert.match(page, /!askWaitsOn\(x\.pid\)/);
  assert.deepEqual(PK.parkAnswer("question", { choice: "skip", afk: 60000 }), { choice: "skip", afk: 60000 });
  assert.deepEqual(PK.parkAnswer("question", { choice: "answers", picks: [], afk: 300000 }), { choice: "answers", picks: [], afk: 300000 });
  assert.deepEqual(PK.parkAnswer("question", { choice: "skip", afk: 5 }), { choice: "skip" });
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /resume: \{ pid, answer: \{[^\n]*afk: Number\(body\.afk\)/);
});

test("DP9 (rows 139, 256, 408) a path outside the working folders asks on a card; a yes runs the call again with outside", async () => {
  const runs = [], events = [];
  let n = 0;
  const exec = async (x) => {
    const m = / ([A-Za-z0-9+/=]{20,})$/.exec(String(x.command));
    const req = m ? JSON.parse(Buffer.from(m[1], "base64").toString("utf8")) : null;
    if (req && req.tool === "grep") { runs.push(req); return req.outside ? { code: 0, output: "/etc/hostname" } : { code: 1, output: "error: that path is outside the project" }; }
    return { code: 0, output: "" };
  };
  const r = await A.runCoder({
    send: async () => [say("", [call("grep", { pattern: "x", path: "/etc", output_mode: "files_with_matches" }, "g1")])][n++] || say("ok"),
    exec, emit: (e) => events.push(e), here: () => ROOT, root: ROOT, ask: async () => ({ choice: "yes" }),
  }, { text: "go", mode: "default", searchTools: true });
  const card = events.find((e) => e.type === "permission" && e.tool === "grep");
  assert.ok(card, "a card");
  assert.equal(card.why, "Coder wants to search /etc, which is outside the working folders.");
  assert.deepEqual(runs.map((q) => q.outside === true), [false, true]);
  assert.match(told(r, "g1"), /\/etc\/hostname/);
  assert.equal(A.outsideTold("write", "/tmp/e.txt"), "Coder requested permissions to edit /tmp/e.txt, but you haven't granted it yet.");
});

test("DP10 the tools script reads outside the working folders only with the request's outside", async () => {
  const T = await import("../container/coder-tools.mjs");
  const f = join(mkdtempSync(join(tmpdir(), "dp-out-")), "r.txt");
  writeFileSync(f, "outside\n");
  await assert.rejects(T.toolRead({ path: f }), /outside the project/);
  T.allowOutside(true);
  try { assert.match(String(await T.toolRead({ path: f })), /outside/); } finally { T.allowOutside(false); }
});
