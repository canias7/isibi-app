// SKILLS AND SUBAGENTS, CLAUDE CODE'S WAY (2026-11-28; Claude Code's skills, sub-agents and memory docs, read in full that day):
// YAML frontmatter and every skill field; the substitutions; dynamic context under the permission checks; allowed-tools as a
// grant for the turn and disallowed-tools as a removal; context: fork through the agent tool; nested and subfolder skills;
// paths; subagent skills, memory, omitClaudeMd, permissionMode; recursive agent files; the nesting depth limit; Explore and
// Plan without CLAUDE.md and the git snapshot. The model is stubbed: no paid call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const K = await import("../container/coder-skills.mjs");
const G = await import("../container/coder-agents.mjs");
const A = await import("../container/coder-agent.mjs");
const ROOT = "/work/shop";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const sys = (req) => String(((req.messages || []).find((m) => m.role === "system") || {}).content || "");
const skill = (text, name = "x", dir = ROOT + "/.claude/skills/" + name) => ({ ...K.skillFrom(text, name, dir) });

async function job(steps, { text = "go", skills = [], rules = null, mode = "acceptEdits", exec = null, deps = {}, opts = {}, sub = null } = {}) {
  const events = [], seen = [], cmds = [];
  let n = 0;
  await A.runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); if (sub && isSub(req)) return sub(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { cmds.push(x.command); if (exec) { const r = await exec(x); if (r) return r; } return /--porcelain=v1/.test(x.command) ? { code: 0, output: "__git_rc=128\n" } : { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-1128", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async () => ({ choice: "yes" }), toolSearch: "false", nestedSkills: false, ...deps,
  }, { text, mode, skills, rules, ...opts });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return typeof m.content === "string" ? m.content.replace(/^\[Subagent output: [^\n]*\]\n/, "") : m.content; return ""; };
  return { events, seen, told, cmds };
}

test("S1 the frontmatter is YAML: multi-line values and lists; booleans take yes/no/on/off/1/0; a bad YAML loads with no fields", () => {
  const s = skill("---\nname: mig\ndescription: >\n  Migrate a\n  component\nwhen_to_use: |\n  When asked to migrate\narguments:\n  - issue\n  - branch\nallowed-tools:\n  - Bash(git add *)\n  - Read\ndisallowed-tools: AskUserQuestion, Write\nargument-hint: [issue] [branch]\ndisable-model-invocation: Yes\nuser-invocable: off\nmodel: grok-4.7\neffort: high\ncontext: fork\nagent: Explore\nbackground: no\npaths: \"src/**/*.ts, lib/*.js\"\nshell: powershell\n---\nBody");
  assert.equal(s.description, "Migrate a component");
  assert.equal(s.whenToUse, "When asked to migrate");
  assert.deepEqual(s.argNames, ["issue", "branch"]);
  assert.deepEqual(s.allowed, ["Bash(git add *)", "Read"]);
  assert.deepEqual(s.disallowed, ["AskUserQuestion", "Write"]);
  assert.equal(s.argHint, "[issue] [branch]");
  assert.equal(s.model, false); assert.equal(s.user, false);
  assert.equal(s.modelName, "grok-4.7"); assert.equal(s.effort, "high");
  assert.equal(s.fork, true); assert.equal(s.agent, "Explore"); assert.equal(s.background, false);
  assert.deepEqual(s.paths, ["src/**/*.ts", "lib/*.js"]);
  assert.equal(s.shell, "powershell");
  const bad = skill("---\nname: oops\n\tdescription: tabbed\n---\nFirst line\n", "folder");
  assert.equal(bad.name, "folder");
  assert.equal(bad.description, "First line");
  assert.equal(K.boolOf("ON", false), true); assert.equal(K.boolOf("0", true), false); assert.equal(K.boolOf("maybe", true), true);
  // (A command file takes every field except name and paths.)
  const c = K.skillFrom("---\nname: other\npaths: a/**\n---\nx", "frontend:component", "/d", { command: true });
  assert.equal(c.name, "frontend:component"); assert.deepEqual(c.paths, []);
});

test("S2 the listing: description + when_to_use capped at 1,536 characters, < and > as &lt; &gt;, disable-model-invocation and paths skills held back", () => {
  assert.equal(K.SKILL_DESC_MAX, 1536);
  const long = skill("---\ndescription: " + "a".repeat(1500) + "\nwhen_to_use: " + "b".repeat(100) + "\n---\nx", "long");
  const ls = K.skillsListing([long, skill("---\ndescription: use <branch>\n---\nx", "br"), skill("---\ndescription: d\ndisable-model-invocation: true\n---\nx", "quiet"), skill("---\ndescription: ts only\npaths: src/**\n---\nx", "ts")]);
  const line = ls.split("\n").find((l) => l.startsWith("- long: "));
  assert.equal(line.length, "- long: ".length + 1536);
  assert.match(ls, /- br: use &lt;branch&gt;/);
  assert.doesNotMatch(ls, /quiet|- ts:/);
  const ts = skill("---\ndescription: ts only\npaths: src/**\n---\nx", "ts");
  assert.equal(K.pathsMatch(ts, "src/a/b.ts"), true);
  assert.equal(K.pathsMatch(ts, "lib/a.ts"), false);
  assert.match(K.skillsListing([{ ...ts, active: true }]), /- ts: ts only/);
});

test("S3 substitutions: $ARGUMENTS, $ARGUMENTS[N], $N, $name, ${CLAUDE_*}, \\$ escapes, quoting, ARGUMENTS: when nothing took them", () => {
  const s = skill("---\narguments: [issue, branch]\n---\nFix $issue on $branch. $0|$1|$2|$ARGUMENTS[1]|$ARGUMENTS. Costs \\$1.00, \\\\$0. ${CLAUDE_SKILL_DIR} ${CLAUDE_SESSION_ID} ${CLAUDE_EFFORT} ${CLAUDE_PROJECT_DIR} $HOME", "fix");
  const out = K.skillLoaded(s, "\"big bug\" main", { sessionId: "sess", effort: "low", projectDir: ROOT });
  assert.match(out, /Fix big bug on main\. big bug\|main\|\$2\|main\|"big bug" main\. Costs \$1\.00, \\\\big bug\. \/work\/shop\/\.claude\/skills\/fix sess low \/work\/shop \$HOME$/);
  // (A named placeholder with no argument is empty; a value holding $1 stays literal.)
  assert.match(K.skillLoaded(s, ""), /^Base directory[^\n]*\n\nFix  on \./);
  const p = skill("---\n---\nSummarize $0", "sum");
  assert.match(K.skillLoaded(p, "\"$ARGUMENTS from yesterday\""), /Summarize \$ARGUMENTS from yesterday$/);
  assert.match(K.skillLoaded(skill("---\n---\nHi $2", "h"), "one"), /Hi \$2\n\nARGUMENTS: one$/);
  assert.match(K.skillLoaded(skill("---\n---\nHi", "h"), "x y"), /Hi\n\nARGUMENTS: x y$/);
  assert.deepEqual(K.splitArgs("\"hello world\" second 'a b'"), ["hello world", "second", "a b"]);
});

test("S4 dynamic context: !`cmd` at a line start or after a space, ```! blocks, run in order; a failed command aborts; off gives Claude Code's placeholder", async () => {
  const s = skill("---\n---\nDiff: !`git diff`\nKEY=!`not run`\n```!\nnode -v\ngit status\n```\nEnd $ARGUMENTS", "ctx");
  const pieces = K.bodyPieces(s.body).filter((p) => p.cmd !== undefined).map((p) => p.cmd);
  assert.deepEqual(pieces, ["git diff", "node -v\ngit status"]);
  const ran = [];
  const r = await K.renderSkill(s, "!`rm -rf /`", { run: async (c) => { ran.push(c); return { output: "<" + c + ">\n" }; } });
  assert.deepEqual(ran, ["git diff", "node -v\ngit status"], "an argument can't add a command");
  assert.match(r.text, /Diff: <git diff>\nKEY=!`not run`\n<node -v\ngit status>\nEnd !`rm -rf \/`$/);
  const f = await K.renderSkill(s, "", { run: async () => ({ error: "Shell command failed for pattern \"!`git diff`\": boom" }) });
  assert.match(f.error, /^Shell command failed for pattern/);
  const off = await K.renderSkill(s, "", { off: true, run: async () => { throw new Error("never"); } });
  assert.match(off.text, /Diff: \[shell command execution disabled by policy\]/);
  assert.equal(K.exitOk("grep x y", 1), true); assert.equal(K.exitOk("ls x", 1), false); assert.equal(K.exitOk("grep x y", 2), false);
});

test("S5 in a chat: a skill's commands run under the rules (allowed-tools lets one run; a deny aborts the skill); disableSkillShellExecution", async () => {
  const sk = { ...skill("---\ndescription: Stage changes\nallowed-tools: Bash(git status *)\n---\nStatus: !`git status --short`", "stage") };
  let t = await job([say("", [call("skill", { skill: "stage" }, "s1")]), say("done")], { skills: [sk], mode: "default", exec: async (x) => (x.command === "git status --short" ? { code: 0, output: "M a.js\n" } : null) });
  assert.match(t.told("s1"), /Status: M a\.js/);
  t = await job([say("", [call("skill", { skill: "stage" }, "s1")]), say("done")], { skills: [sk], mode: "default", rules: { allow: [], ask: [], deny: ["Bash(git status *)"] } });
  assert.match(t.told("s1"), /^Shell command permission check failed for pattern "!`git status --short`"/);
  assert.ok(!t.cmds.includes("git status --short"));
  const loose = { ...skill("---\ndescription: d\n---\nX: !`curl -s https://example.com`", "loose") };
  t = await job([say("", [call("skill", { skill: "loose" }, "s1")]), say("done")], { skills: [loose], mode: "default" });
  assert.match(t.told("s1"), /permission check failed/, "outside Auto, a command that isn't allowed aborts");
  t = await job([say("", [call("skill", { skill: "stage" }, "s1")]), say("done")], { skills: [sk], mode: "default", opts: { skillShellOff: true } });
  assert.match(t.told("s1"), /Status: \[shell command execution disabled by policy\]/);
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /j\.disableSkillShellExecution === true\) out\.skillShellOff = true/);
  assert.match(server, /skillShellOff: repoSet\.skillShellOff === true/);
});

test("S6 allowed-tools no longer asks; it pre-approves its tools for the turn; disallowed-tools removes tools for the turn", async () => {
  assert.equal(K.skillAsks({ "allowed-tools": "Read" }), "");
  const sk = { ...skill("---\ndescription: d\nallowed-tools: Bash(npm publish *)\ndisallowed-tools: Write, Bash(rm *)\n---\nGo", "rel") };
  assert.deepEqual(K.skillDenied(sk), ["Write", "Bash"]);
  assert.deepEqual(K.skillGrant({ ...sk, allowed: ["Bash(${CLAUDE_SKILL_DIR}/run.sh *)"] }), ["Bash(" + ROOT + "/.claude/skills/rel/run.sh *)"]);
  let asked = 0;
  const t = await job([say("", [call("skill", { skill: "rel" }, "s1")]), say("", [call("write", { path: "a.txt", content: "x" }, "w1")]), say("done")], { skills: [sk], mode: "default", deps: { ask: async () => { asked++; return { choice: "yes" }; } } });
  assert.equal(asked, 0, "loading the skill didn't ask");
  assert.match(t.told("s1"), /^Launching skill: rel/);
  assert.match(t.told("w1"), /denied|not allowed|No such tool/i);
});

test("S7 context: fork runs the skill as a subagent of its agent type, with the skill's text as its prompt", async () => {
  const sk = { ...skill("---\ndescription: Research\ncontext: fork\nagent: Explore\nbackground: false\n---\nResearch $ARGUMENTS thoroughly.", "deep") };
  let prompt = "", system = "";
  const t = await job([say("", [call("skill", { skill: "deep", args: "auth" }, "s1")]), say("done")], { skills: [sk], mode: "auto", sub: (req) => { prompt = JSON.stringify(req.messages.filter((m) => m.role === "user")); system = sys(req); return say("", [call("subagent_handback", { message: "found it" }, "h")]); } });
  assert.match(prompt, /Research auth thoroughly\./);
  assert.match(system, /You are an Explore agent/);
  assert.match(t.told("s1"), /^found it/);
  // (The owner's /name for a forked skill starts it too; in the background by default.)
  let ran = 0;
  const bg = { ...skill("---\ndescription: Bg\ncontext: fork\n---\nDo $0.", "bgjob") };
  const t2 = await job([say("done")], { text: "/bgjob it", skills: [bg], mode: "auto", sub: () => { ran++; return say("", [call("subagent_handback", { message: "bg done" }, "h")]); } });
  assert.equal(ran, 1);
  assert.match(JSON.stringify(t2.seen.find((r) => !isSub(r)).messages), /<command-name>\/bgjob<\/command-name>\\nAsync agent launched successfully/);
});

test("S8 nested skills load when a file there is touched, dir:skill on a clash; .claude/commands subfolders are dir:name", () => {
  const d = mkdtempSync(join(tmpdir(), "coder-skills-1128-"));
  try {
    mkdirSync(join(d, ".claude/skills/deploy"), { recursive: true });
    writeFileSync(join(d, ".claude/skills/deploy/SKILL.md"), "---\ndescription: Root deploy\n---\nroot");
    mkdirSync(join(d, ".claude/commands/frontend"), { recursive: true });
    writeFileSync(join(d, ".claude/commands/frontend/component.md"), "Make a component");
    mkdirSync(join(d, "apps/web/.claude/skills/deploy"), { recursive: true });
    writeFileSync(join(d, "apps/web/.claude/skills/deploy/SKILL.md"), "---\ndescription: Web deploy\n---\nweb");
    mkdirSync(join(d, "apps/web/.claude/skills/lint"), { recursive: true });
    writeFileSync(join(d, "apps/web/.claude/skills/lint/SKILL.md"), "---\ndescription: Web lint\n---\nlint");
    mkdirSync(join(d, "node_modules/x/.claude/skills/bad"), { recursive: true });
    writeFileSync(join(d, "node_modules/x/.claude/skills/bad/SKILL.md"), "bad");
    const root = K.readSkills(d);
    assert.deepEqual(root.map((s) => s.name), ["deploy", "frontend:component"]);
    assert.ok(K.slashSkill("/frontend:component x", root));
    const roots = K.nestedSkillRoots(d);
    assert.deepEqual(roots, ["apps/web"]);
    const loaded = new Set();
    assert.equal(K.nestedSkillsFor(d, "README.md", roots, loaded, root).skills.length, 0);
    const got = K.nestedSkillsFor(d, "apps/web/src/app.ts", roots, loaded, root);
    assert.deepEqual(got.skills.map((s) => s.name), ["apps/web:deploy", "lint"]);
    assert.match(got.skills[0].description, /Web deploy \(for the files in apps\/web\/\)/);
    assert.equal(K.nestedSkillsFor(d, "apps/web/other.ts", roots, loaded, root).skills.length, 0, "once");
    assert.ok(K.slashSkill("/apps/web:deploy", [...root, ...got.skills.map((s) => ({ ...s, user: true }))]));
    assert.match(K.skillsListing([...root, ...got.skills]), /When skills share a name, invoke the one whose directory holds the files/);
    // (A deny rule naming the bare name also blocks the nested one.)
    const P = { parseRule: (r) => { const m = /^(\w+)(?:\((.*)\))?$/.exec(r); return m ? { tool: m[1], spec: m[2] === undefined ? null : m[2] } : null; } };
    assert.equal(K.skillRule({ deny: ["Skill(deploy)"] }, "deny", "apps/web:deploy", P.parseRule), "Skill(deploy)");
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("S9 argument-hint goes to the page's / menu; the page shows it and takes nested names", async () => {
  const sk = { ...skill("---\ndescription: Fix\nargument-hint: [issue-number]\n---\nFix $0", "fix-issue") };
  const t = await job([say("done")], { skills: [sk] });
  const ev = t.events.find((e) => e.type === "skills");
  assert.deepEqual(ev.list[0], { name: "fix-issue", description: "Fix", hint: "[issue-number]" });
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /x\.hint \? String\(x\.hint\)\.slice\(0, 100\) \+ ' · ' : ''/);
});

test("S10 agent files: YAML frontmatter with skills, memory, omitClaudeMd, initialPrompt, permissionMode and mcpServers; recursive discovery; a custom agent named like a built-in replaces it", () => {
  const p = G.parseAgentFile("---\nname: api-dev\ndescription: Builds APIs\ntools:\n  - Read\n  - Bash\nskills:\n  - api-conventions\n  - errors\nmemory: project\nomitClaudeMd: true\ninitialPrompt: Start here\npermissionMode: manual\nmcpServers:\n  - github\n  - playwright:\n      type: stdio\n      command: npx\nbackground: yes\n---\nYou build APIs.");
  assert.deepEqual(p.def.tools, ["Read", "Bash"]);
  assert.deepEqual(p.def.skills, ["api-conventions", "errors"]);
  assert.equal(p.def.memory, "project"); assert.equal(p.def.omitClaudeMd, true); assert.equal(p.def.initialPrompt, "Start here");
  assert.equal(p.def.permissionMode, "default");
  assert.equal(p.def.mcpServers[0], "github"); assert.equal(p.def.mcpServers[1].playwright.command, "npx");
  assert.equal(p.def.background, true);
  assert.equal(G.parseAgentFile("---\nname: x\n\tdescription: y\n---\n").skip, "its YAML doesn't parse");
  assert.match(G.agentFilesScript(), /find \.claude\/agents -type f -name '\*\.md'.*LC_ALL=C sort/); // (from each folder up to the top since 2026-11-28: subagents-cc-1128b SR10)
  const { defs } = G.customAgentsFrom([{ file: ".claude/agents/review/explore.md", text: "---\nname: Explore\ndescription: Mine\nmodel: grok-4.7\n---\nMy explorer." }]);
  assert.equal(defs[0].name, "Explore");
});

test("S11 permissionMode follows Claude Code's rules against the chat's mode", () => {
  const def = (m) => ({ name: "a", permissionMode: m });
  assert.equal(G.agentModeOf("auto", def("plan")), "auto");
  assert.equal(G.agentModeOf("acceptEdits", def("default")), "acceptEdits");
  assert.equal(G.agentModeOf("plan", def("acceptEdits")), "plan");
  assert.equal(G.agentModeOf("default", def("acceptEdits")), "acceptEdits");
  assert.equal(G.agentModeOf("default", def("bypassPermissions")), "default");
  assert.equal(G.agentModeOf("default", def("auto"), { autoOff: true }), "default");
  assert.equal(G.agentModeOf("default", { ...def("plan"), plugin: "p" }), "default", "ignored for plugin agents");
  assert.equal(G.agentModeOf("default", null), "default");
});

test("S12 what a subagent starts with: Explore, Plan and web-fetch skip CLAUDE.md (and the first two the git status); omitClaudeMd; never the chat's memory", () => {
  const ctx = [
    { key: "i:CLAUDE.md", text: "THE REPO'S OWN INSTRUCTIONS (CLAUDE.md), from the repository's files." },
    { key: "i:MORE OF THE REPO'S INSTRUCTIONS", text: "\n\nMORE OF THE REPO'S INSTRUCTIONS load when …" },
    { key: "i:YOUR MEMORY FOR THIS REPO", text: "YOUR MEMORY FOR THIS REPO …" },
    { key: "i:GIT STATUS", text: "GIT STATUS …" },
    { key: "s:GIT", text: "GIT notes" },
  ];
  const keys = (c) => c.map((p) => p.key);
  assert.deepEqual(keys(G.subagentContext(ctx, "general-purpose")), ["i:CLAUDE.md", "i:MORE OF THE REPO'S INSTRUCTIONS", "i:GIT STATUS", "s:GIT"]);
  assert.deepEqual(keys(G.subagentContext(ctx, "Explore")), ["s:GIT"]);
  assert.deepEqual(keys(G.subagentContext(ctx, "Plan")), ["s:GIT"]);
  assert.deepEqual(keys(G.subagentContext(ctx, "mine", { name: "mine", omitClaudeMd: true })), ["i:GIT STATUS", "s:GIT"]);
  assert.deepEqual(keys(G.subagentContext(ctx, "Explore", { name: "Explore" })), ["i:CLAUDE.md", "i:MORE OF THE REPO'S INSTRUCTIONS", "i:GIT STATUS", "s:GIT"], "a custom Explore loads them");
});

test("S13 agent memory: user, project and local folders; the first 200 lines or 25KB of MEMORY.md", () => {
  assert.equal(G.agentMemoryDir({ name: "rev", memory: "project" }, { root: ROOT }), ROOT + "/.claude/agent-memory/rev");
  assert.equal(G.agentMemoryDir({ name: "rev", memory: "local" }, { root: ROOT }), ROOT + "/.claude/agent-memory-local/rev");
  assert.equal(G.agentMemoryDir({ name: "rev", memory: "user" }, { home: "/home/dev" }), "/home/dev/.claude/agent-memory/rev");
  assert.equal(G.memoryHead(Array.from({ length: 300 }, (_, i) => "l" + i).join("\n")).split("\n").length, 200);
  assert.ok(Buffer.byteLength(G.memoryHead("x".repeat(40_000))) <= 25_000);
  assert.match(G.memoryPrompt("/m", "- [a](a.md)"), /YOUR AGENT MEMORY[\s\S]*MEMORY\.md:\n- \[a\]\(a\.md\)/);
});

test("S14 a custom agent's preloaded skills and memory reach its system prompt; memory turns on read, write and edit", async () => {
  const agents = [{ file: ".claude/agents/api.md", text: "---\nname: api\ndescription: APIs\ntools: Bash\nskills: [conv, quiet]\nmemory: project\n---\nYou build APIs." }];
  const conv = { ...skill("---\ndescription: Conventions\n---\nUse REST in ${CLAUDE_SKILL_DIR}.", "conv") };
  const quiet = { ...skill("---\ndescription: q\ndisable-model-invocation: true\n---\nSECRET", "quiet") };
  let system = "", tools = [];
  await job([say("", [call("agent", { description: "api", prompt: "build", subagent_type: "api", run_in_background: false }, "a1")]), say("done")], {
    skills: [conv, quiet], mode: "auto",
    exec: async (x) => (x.command.includes("find .claude/agents") ? { code: 0, output: G.AGENT_FILES_MARK + agents[0].file + "\n" + agents[0].text + "\n" } : /MEMORY\.md/.test(x.command) ? { code: 0, output: "- [style](style.md)\n" } : null),
    sub: (req) => { system = sys(req); tools = (req.tools || []).map((t) => t.function.name); return say("", [call("subagent_handback", { message: "ok" }, "h")]); },
  });
  assert.match(system, /<preloaded-skill name="conv">\nBase directory for this skill: \/work\/shop\/\.claude\/skills\/conv\n\nUse REST in \/work\/shop\/\.claude\/skills\/conv\.\n<\/preloaded-skill>/);
  assert.doesNotMatch(system, /SECRET/, "a disable-model-invocation skill isn't preloaded");
  assert.match(system, /YOUR AGENT MEMORY \(persistent, kept across chats\) is the folder \/work\/shop\/\.claude\/agent-memory\/api\/[\s\S]*- \[style\]\(style\.md\)/);
  for (const n of ["bash", "read", "write", "edit"]) assert.ok(tools.includes(n), n);
});

test("S15 the nesting depth limit: CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH (3 by default) withholds the agent tool at the limit", async () => {
  assert.equal(G.spawnDepthOf({}), 3); assert.equal(G.spawnDepthOf({ CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1" }), 1);
  const toolsAt = async (env) => {
    let got = null;
    await job([say("", [call("agent", { description: "o", prompt: "outer", run_in_background: false }, "a1")]), say("done")], { mode: "auto", deps: { spawnEnv: env }, sub: (req) => { got = got || (req.tools || []).map((t) => t.function.name); return say("", [call("subagent_handback", { message: "ok" }, "h")]); } });
    return got;
  };
  assert.ok((await toolsAt({})).includes("agent"), "depth 1 of 3 can nest");
  assert.ok(!(await toolsAt({ CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1" })).includes("agent"), "1 turns nesting off");
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /spawnEnv: \{ \.\.\.\(\(repoSet && repoSet\.env\) \|\| \{\}\), \.\.\.rawVars \}/);
});

test("S16 Agent(type) in the deny rules turns that subagent type off; others still start", async () => {
  let ran = 0;
  const t = await job([say("", [call("agent", { description: "e", prompt: "look", subagent_type: "Explore", run_in_background: false }, "a1"), call("agent", { description: "p", prompt: "plan", subagent_type: "Plan", run_in_background: false }, "a2")]), say("done")], { mode: "auto", rules: { allow: [], ask: [], deny: ["Agent(Explore)"] }, sub: () => { ran++; return say("", [call("subagent_handback", { message: "ok" }, "h")]); } });
  assert.match(t.told("a1"), /Permission to use Agent with subagent_type Explore has been denied/);
  assert.match(t.told("a2"), /^ok/);
  assert.equal(ran, 1);
});
