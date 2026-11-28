// SUBAGENTS AS CLAUDE CODE'S (2026-11-28, its sub-agents and skills docs): connector (MCP) tools inherited unless `tools`
// restricts them, and the agent's own mcpServers; the Skill tool in subagents; a forked skill's step named by its agent type;
// agent memory read-only in plan mode; a new chat's / menu from GitHub; allowed-tools grants end with the turn; Explore and
// Plan start without CLAUDE.md.
import { test } from "node:test";
import assert from "node:assert/strict";

const K = await import("../container/coder-skills.mjs");
const G = await import("../container/coder-agents.mjs");
const A = await import("../container/coder-agent.mjs");
const M = await import("../container/coder-agentmcp.mjs");
const R = await import("../src/coder-repo-skills.mjs");
const ROOT = "/work/shop";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const sys = (req) => String(((req.messages || []).find((m) => m.role === "system") || {}).content || "");
const skill = (text, name = "x") => ({ ...K.skillFrom(text, name, ROOT + "/.claude/skills/" + name) });
const agentExec = (files) => async (x) => (x.command.startsWith("find .claude/agents") ? { code: 0, output: files.map((f) => G.AGENT_FILES_MARK + f.file + "\n" + f.text + "\n").join("") } : null);

async function job(steps, { text = "go", skills = [], rules = null, mode = "auto", exec = null, deps = {}, opts = {}, sub = null } = {}) {
  const events = [], seen = [];
  let n = 0;
  await A.runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); if (sub && isSub(req)) return sub(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { if (exec) { const r = await exec(x); if (r) return r; } return /--porcelain=v1/.test(x.command) ? { code: 0, output: "__git_rc=128\n" } : { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-1128b", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async () => ({ choice: "yes" }), toolSearch: "false", nestedSkills: false, ...deps,
  }, { text, mode, skills, rules, ...opts });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { events, seen, told };
}
const CONN = [
  { name: "mcp__linear__search", label: "Linear: search", description: "Search Linear", server: "linear", readOnly: true, parameters: { type: "object", properties: { q: { type: "string" } } } },
  { name: "mcp__github__issues", label: "GitHub: issues", description: "List issues", server: "github", readOnly: true, parameters: { type: "object", properties: {} } },
];
const subTools = (t) => t.seen.filter(isSub).map((r) => (r.tools || []).map((x) => x.function.name));

test("P1 subagentConnectors: inherit all; tools mcp__server__* or an exact name; disallowedTools mcp__server, mcp__*; web-fetch none", () => {
  const names = (l) => l.map((t) => t.name);
  assert.deepEqual(names(G.subagentConnectors(CONN, "general-purpose")), ["mcp__linear__search", "mcp__github__issues"]);
  assert.deepEqual(names(G.subagentConnectors(CONN, "Explore")), ["mcp__linear__search", "mcp__github__issues"]);
  assert.deepEqual(G.subagentConnectors(CONN, "web-fetch"), []);
  assert.deepEqual(names(G.subagentConnectors(CONN, "x", { tools: ["Read", "mcp__github__*"], disallowedTools: [] })), ["mcp__github__issues"]);
  assert.deepEqual(names(G.subagentConnectors(CONN, "x", { tools: ["mcp__linear__search"], disallowedTools: [] })), ["mcp__linear__search"]);
  assert.deepEqual(names(G.subagentConnectors(CONN, "x", { tools: ["Read"], disallowedTools: [] })), [], "a tools list without MCP entries gives none");
  assert.deepEqual(names(G.subagentConnectors(CONN, "x", { tools: [], disallowedTools: ["mcp__github"] })), ["mcp__linear__search"]);
  assert.deepEqual(G.subagentConnectors(CONN, "x", { tools: [], disallowedTools: ["mcp__*"] }), []);
  // (A tools list of only MCP entries is not "zero tools".)
  assert.ok(!G.resolveAgentTools("x", { name: "x", tools: ["mcp__github__*"], disallowedTools: [] }).error);
});

test("P2 a subagent gets the chat's connector tools and calls them; a custom agent's tools list narrows them", async () => {
  const called = [];
  const mcp = async (name) => { called.push(name); return { text: "3 issues" }; };
  const t = await job([say("", [call("agent", { description: "look", prompt: "find issues", subagent_type: "general-purpose", run_in_background: false }, "a1")]), say("done")], {
    deps: { mcp }, opts: { connectors: CONN },
    sub: (req) => (req.messages.some((m) => m.role === "tool") ? say("", [call("subagent_handback", { message: "found 3" }, "h")]) : say("", [call("mcp__github__issues", {}, "m1")])),
  });
  const tl = subTools(t)[0];
  assert.ok(tl.includes("mcp__linear__search") && tl.includes("mcp__github__issues"), tl.join(","));
  assert.deepEqual(called, ["mcp__github__issues"]);
  const files = [{ file: ".claude/agents/gh.md", text: "---\nname: gh\ndescription: GitHub only\ntools: Read, mcp__github__*\n---\nYou read GitHub." }];
  const t2 = await job([say("", [call("agent", { description: "gh", prompt: "go", subagent_type: "gh", run_in_background: false }, "a1")]), say("done")], {
    deps: { mcp }, opts: { connectors: CONN }, exec: agentExec(files), sub: () => say("", [call("subagent_handback", { message: "ok" }, "h")]),
  });
  const tl2 = subTools(t2)[0];
  assert.ok(tl2.includes("mcp__github__issues") && !tl2.includes("mcp__linear__search") && tl2.includes("read") && !tl2.includes("bash"), tl2.join(","));
});

test("P3 mcpServers: an inline http server connects when the agent starts (trusted repo), its tools reach it, and it disconnects at the end; untrusted is skipped", async () => {
  const log = [];
  const fetchFn = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    log.push(init.method + " " + (body ? body.method : ""));
    const json = (v) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json", "mcp-session-id": "S1" } });
    if (init.method === "DELETE") return new Response("", { status: 200 });
    if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {} } });
    if (body.method === "notifications/initialized") return new Response("", { status: 202 });
    if (body.method === "tools/list") return new Response("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "shot", description: "Screenshot", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }] } }) + "\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
    if (body.method === "tools/call") return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "pic taken" }] } });
    return json({ jsonrpc: "2.0", id: body.id, error: { message: "no" } });
  };
  const files = [{ file: ".claude/agents/web.md", text: "---\nname: web\ndescription: Browser\nmcpServers:\n  - browser:\n      type: http\n      url: https://mcp.example.com/mcp\n  - linear\n---\nYou browse." }];
  let result = "";
  const t = await job([say("", [call("agent", { description: "web", prompt: "shoot", subagent_type: "web", run_in_background: false }, "a1")]), say("done")], {
    deps: { fetch: fetchFn, mcp: async () => ({ text: "x" }) }, opts: { connectors: CONN, repoTrusted: true }, exec: agentExec(files),
    sub: (req) => { const tr = req.messages.find((m) => m.role === "tool"); if (tr) { result = tr.content; return say("", [call("subagent_handback", { message: "ok" }, "h")]); } return say("", [call("mcp__browser__shot", {}, "m1")]); },
  });
  assert.ok(subTools(t)[0].includes("mcp__browser__shot"));
  assert.match(result, /pic taken/);
  assert.deepEqual(log, ["POST initialize", "POST notifications/initialized", "POST tools/list", "POST tools/call", "DELETE "]);
  // (Not trusted yet: Claude Code "skips every inline server in that agent file".)
  log.length = 0;
  const t2 = await job([say("", [call("agent", { description: "web", prompt: "shoot", subagent_type: "web", run_in_background: false }, "a1")]), say("done")], {
    deps: { fetch: fetchFn, mcp: async () => ({ text: "x" }) }, opts: { connectors: CONN, repoTrusted: false }, exec: agentExec(files), sub: () => say("", [call("subagent_handback", { message: "ok" }, "h")]),
  });
  assert.deepEqual(log, []);
  assert.ok(!subTools(t2)[0].includes("mcp__browser__shot"));
  assert.ok(t2.events.some((e) => e.type === "note" && /inline MCP servers .* skipped/.test(e.text)));
  // (stdio is not run on Coder's machine.)
  assert.match((await M.connectInline("pw", { type: "stdio", command: "npx" })).error, /stdio/);
  assert.deepEqual(M.splitMcpServers(["slack", { pw: { type: "http", url: "https://x" } }]), { refs: ["slack"], inline: [{ name: "pw", config: { type: "http", url: "https://x" } }] });
});

test("P4 subagents have the Skill tool and load skills; disallowedTools: Skill takes it away", async () => {
  const sk = skill("---\ndescription: Conventions\n---\nUse REST.", "conv");
  let loaded = "";
  const t = await job([say("", [call("agent", { description: "x", prompt: "go", subagent_type: "Explore", run_in_background: false }, "a1")]), say("done")], {
    skills: [sk], sub: (req) => { const tr = req.messages.find((m) => m.role === "tool"); if (tr) { loaded = tr.content; return say("", [call("subagent_handback", { message: "ok" }, "h")]); } return say("", [call("skill", { skill: "conv" }, "s1")]); },
  });
  assert.ok(subTools(t)[0].includes("skill"));
  assert.match(loaded, /^Launching skill: conv[\s\S]*Use REST\./);
  assert.ok(!t.events.some((e) => e.type === "skills" && /-/.test(String(e.id || ""))), "the / menu list comes from the chat only");
  const files = [{ file: ".claude/agents/ns.md", text: "---\nname: ns\ndescription: d\ndisallowedTools: Skill\n---\nNo skills." }];
  const t2 = await job([say("", [call("agent", { description: "x", prompt: "go", subagent_type: "ns", run_in_background: false }, "a1")]), say("done")], { skills: [sk], exec: agentExec(files), sub: () => say("", [call("subagent_handback", { message: "ok" }, "h")]) });
  assert.ok(!subTools(t2)[0].includes("skill"));
});

test("P5 a forked skill's step is named by the agent type it runs as", async () => {
  assert.equal(G.forkLabel({ name: "deep", agent: "Explore" }), "Explore: deep");
  assert.equal(G.forkLabel({ name: "deep" }), "general-purpose: deep");
  const sk = skill("---\ndescription: Research\ncontext: fork\nagent: Explore\nbackground: false\n---\nResearch it.", "deep");
  const t = await job([say("", [call("skill", { skill: "deep" }, "s1")]), say("done")], { skills: [sk], sub: () => say("", [call("subagent_handback", { message: "ok" }, "h")]) });
  const step = t.events.find((e) => e.type === "bash" && e.tool === "agent" && e.id === "s1-fork");
  assert.equal(step.command, "Explore: deep");
  assert.ok(!t.events.some((e) => e.type === "bash" && /Skill deep/.test(String(e.command || ""))));
});

test("P6 agent memory in plan mode is read, not written: no write or edit tool, and a read-only memory prompt", async () => {
  assert.deepEqual(G.memoryToolsFor("plan"), ["read"]);
  assert.deepEqual(G.memoryToolsFor("auto"), ["read", "write", "edit"]);
  assert.match(G.memoryPrompt("/m", "", { readOnly: true }), /plan mode, which is read-only[\s\S]*do not write/);
  const files = [{ file: ".claude/agents/rev.md", text: "---\nname: rev\ndescription: Reviews\ntools: Grep\nmemory: project\n---\nYou review." }];
  let system = "", tools = [];
  await job([say("", [call("agent", { description: "rev", prompt: "review", subagent_type: "rev", run_in_background: false }, "a1")]), say("done")], {
    mode: "plan", exec: agentExec(files), sub: (req) => { system = sys(req); tools = (req.tools || []).map((x) => x.function.name); return say("done reviewing"); },
  });
  assert.ok(tools.includes("read") && !tools.includes("write") && !tools.includes("edit"), tools.join(","));
  assert.match(system, /You are in plan mode, which is read-only/);
  // (Outside plan mode, as before: read, write and edit; disallowedTools still wins.)
  const files2 = [{ file: ".claude/agents/rev.md", text: "---\nname: rev\ndescription: Reviews\ntools: Grep\ndisallowedTools: Write\nmemory: project\n---\nYou review." }];
  await job([say("", [call("agent", { description: "rev", prompt: "review", subagent_type: "rev", run_in_background: false }, "a1")]), say("done")], {
    exec: agentExec(files2), sub: (req) => { tools = (req.tools || []).map((x) => x.function.name); return say("", [call("subagent_handback", { message: "ok" }, "h")]); },
  });
  assert.ok(tools.includes("edit") && !tools.includes("write"), tools.join(","));
});

test("P7 a new chat's / menu: the repository's skills read from GitHub (skills, then commands; user-invocable: false left out)", async () => {
  const files = {
    ".claude/skills/deploy/SKILL.md": "---\ndescription: Deploy it\nargument-hint: [env]\n---\nGo",
    ".claude/skills/hidden/SKILL.md": "---\ndescription: h\nuser-invocable: false\n---\nx",
    ".claude/commands/ops/fix.md": "# Fix the build\nsteps",
    ".claude/commands/deploy.md": "dup",
  };
  const gh = async (p) => {
    if (p.includes("/git/trees/")) return { ok: true, data: { tree: [...Object.keys(files), "src/a.js"].map((path) => ({ path, type: "blob" })) } };
    const path = decodeURIComponent(p.split("/contents/")[1].split("?")[0]);
    return files[path] ? { ok: true, data: { content: Buffer.from(files[path]).toString("base64") } } : { ok: false };
  };
  const list = await R.repoSkillsMenu(gh, "o/r", "main", [{ name: "mine", description: "Saved" }]);
  assert.deepEqual(list, [{ name: "deploy", description: "Deploy it", hint: "[env]" }, { name: "ops:fix", description: "Fix the build" }, { name: "mine", description: "Saved" }]);
  assert.deepEqual(await R.repoSkillsMenu(async () => { throw new Error("down"); }, "o/r", "main"), []);
  const { readFileSync } = await import("node:fs");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /repoSkillsMenu\(\(p\) => ghRead\(t\.token, p, \{ fetchFn \}\), repo, base,[\s\S]{0,200}type: "skills", list/);
});

test("P8 allowed-tools grants last for the turn that loaded the skill: the next message asks again", async () => {
  const sk = skill("---\ndescription: d\nallowed-tools: Bash(npm publish *)\n---\nGo", "rel");
  let asked = 0;
  const ask = async () => { asked++; return { choice: "yes" }; };
  await job([say("", [call("skill", { skill: "rel" }, "s1")]), say("", [call("bash", { command: "npm publish x" }, "b1")]), say("done")], { skills: [sk], mode: "default", deps: { ask } });
  assert.equal(asked, 0, "granted in the turn that loaded it");
  const later = [{ role: "user", content: "/rel" }, { role: "assistant", content: "Launching skill: rel\n\nGo" }];
  await job([say("", [call("bash", { command: "npm publish x" }, "b2")]), say("done")], { text: "again", skills: [sk], mode: "default", deps: { ask }, opts: { messages: later } });
  assert.equal(asked, 1, "the next message's turn asks: the grant cleared");
});

test("P9 Explore and Plan start without CLAUDE.md; general-purpose has it", async () => {
  const context = [{ key: "i:CLAUDE.md", text: "THE REPO'S OWN INSTRUCTIONS (CLAUDE.md): ZEBRA-RULE" }];
  for (const [type, has] of [["Explore", false], ["Plan", false], ["general-purpose", true]]) {
    let body = "";
    await job([say("", [call("agent", { description: "x", prompt: "go", subagent_type: type, run_in_background: false }, "a1")]), say("done")], {
      opts: { context }, sub: (req) => { body = JSON.stringify(req.messages); return say("", [call("subagent_handback", { message: "ok" }, "h")]); },
    });
    assert.equal(/ZEBRA-RULE/.test(body), has, type);
  }
});
