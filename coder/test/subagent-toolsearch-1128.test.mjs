// SUBAGENTS: TOOL SEARCH AND "DON'T ASK AGAIN" (2026-11-28, from a live test on gofarther.dev): a helper asked to call the
// chat's mcpdemo connector tool had no way to call it, and a helper's card for a file search outside the project had only
// Allow / Switch to Auto / Deny. As Claude Code: a subagent inherits the chat's MCP tools and, when the chat defers them, finds
// them with tool search; a connector off for the chat (or denied) stays away; a subagent's connector card is the chat's own
// card and waits for the answer; and a read outside the working folders offers that folder's Read rule ("don't ask again"),
// which, taken on a helper's card, covers the whole chat.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-perms.mjs");
const ROOT = "/work/shop";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder/.test(String(m.content)));
const names = (req) => (req.tools || []).map((t) => t.function.name);
const CONN = [{ name: "mcp__mcpdemo__echo", label: "mcpdemo: echo", description: "Echo a message back", server: "mcpdemo", readOnly: false, parameters: { type: "object", properties: { text: { type: "string" } } } }];
const agentCall = (prompt = "go") => call("agent", { description: "helper", prompt, subagent_type: "general-purpose", run_in_background: false }, "a1");

async function job({ main, sub, mode = "auto", rules = null, deps = {}, connectors = CONN, choice = "yes" }) {
  const seen = [], events = [], asked = [];
  let n = 0;
  await A.runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); if (isSub(req)) return sub(req); return main[Math.min(n++, main.length - 1)]; },
    exec: async (x) => (/--porcelain=v1/.test(x.command) ? { code: 0, output: "__git_rc=128\n" } : { code: 0, output: "ok\n" }),
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "c-1128ts", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { asked.push(pid); return { choice }; }, nestedSkills: false, ...deps,
  }, { text: "go", mode, rules, connectors });
  return { seen, events, asked, subs: seen.filter(isSub) };
}

test("TS1 the chat defers its connectors: a subagent gets tool_search, not the tool; it loads it and calls it", async () => {
  const called = [];
  const t = await job({
    main: [say("", [agentCall("call the mcpdemo echo tool")]), say("done")],
    deps: { mcp: async (name, args) => { called.push([name, args]); return { text: "echo: hi" }; } },
    sub: (req) => {
      const tr = req.messages.filter((m) => m.role === "tool");
      if (!tr.length) return say("", [call("tool_search", { query: "select:mcp__mcpdemo__echo", max_results: 5 }, "s1")]);
      if (tr.length === 1) return say("", [call("mcp__mcpdemo__echo", { text: "hi" }, "m1")]);
      return say("", [call("subagent_handback", { message: "it said echo: hi" }, "h")]);
    },
  });
  const mainTools = names(t.seen.find((r) => !isSub(r)));
  assert.ok(mainTools.includes("tool_search") && !mainTools.includes("mcp__mcpdemo__echo"), "the chat defers it: " + mainTools.join(","));
  const first = names(t.subs[0]);
  assert.ok(first.includes("tool_search"), "the subagent has tool_search: " + first.join(","));
  assert.ok(!first.includes("mcp__mcpdemo__echo"), "deferred in the subagent too");
  assert.ok(t.subs[0].messages.some((m) => m.role === "user" && /mcp__mcpdemo__echo/.test(String(m.content))), "tool search's note names it");
  assert.ok(names(t.subs[1]).includes("mcp__mcpdemo__echo"), "loaded from the next request on");
  assert.deepEqual(called, [["mcp__mcpdemo__echo", { text: "hi" }]]);
  // (Its card is the chat's own permission card, answered, not Gloopy's card that ends the helper's turn.)
  assert.ok(t.events.some((e) => e.type === "permission" && e.agent && /mcpdemo/.test(JSON.stringify(e))), "a permission card");
  assert.ok(!t.events.some((e) => e.type === "approval"), "not Gloopy's approval card");
});

test("TS2 tool search off for the chat: the subagent gets the connector tool upfront and no tool_search", async () => {
  const t = await job({ main: [say("", [agentCall()]), say("done")], deps: { toolSearch: "false", mcp: async () => ({ text: "x" }) }, sub: () => say("", [call("subagent_handback", { message: "ok" }, "h")]) });
  const tl = names(t.subs[0]);
  assert.ok(tl.includes("mcp__mcpdemo__echo") && !tl.includes("tool_search"), tl.join(","));
});

test("TS3 a connector denied for the chat, or none sent (off for this chat): the subagent has neither it nor tool_search for it", async () => {
  const denied = await job({ main: [say("", [agentCall()]), say("done")], rules: { allow: [], ask: [], deny: ["mcp__mcpdemo"] }, deps: { mcp: async () => ({ text: "x" }) }, sub: (req) => (req.messages.some((m) => m.role === "tool") ? say("", [call("subagent_handback", { message: "ok" }, "h")]) : say("", [call("tool_search", { query: "select:mcp__mcpdemo__echo" }, "s1")])) });
  for (const r of denied.subs) assert.ok(!names(r).includes("mcp__mcpdemo__echo"), names(r).join(","));
  assert.ok(!names(denied.subs[0]).includes("tool_search"));
  const off = await job({ main: [say("", [agentCall()]), say("done")], connectors: [], deps: { mcp: async () => ({ text: "x" }) }, sub: () => say("", [call("subagent_handback", { message: "ok" }, "h")]) });
  assert.ok(!names(off.subs[0]).some((n) => n === "tool_search" || n.startsWith("mcp__")), names(off.subs[0]).join(","));
});

test("TS4 a read outside the working folders offers that folder's Read rule, as a cd out of the project does", () => {
  const d = (command) => P.bashDecision(command, { mode: "acceptEdits", rules: { allow: [], ask: [], deny: [] }, cwd: ROOT, workdirs: [ROOT], home: "/home/dev" });
  assert.deepEqual(d("find /tmp/data -name '*.md'").suggest, ["Read(//tmp/data/**)"]);
  assert.deepEqual(d("grep -rn foo /tmp/data").suggest, ["Read(//tmp/data/**)"]);
  assert.deepEqual(d("cat /etc/hosts").suggest, ["Read(//etc/**)"]);
  assert.deepEqual(d("find /tmp/data -name x | xargs ls").suggest, ["Read(//tmp/data/**)", "Bash(xargs ls)"]);
  assert.equal(d("find / -name x").suggest, null, "none for the root");
  assert.equal(d("cat /etc/hosts > /tmp/out").suggest, null, "none when a rule could not cover it all (a write out of the project)");
  // (Allowed by that rule, it runs without asking.)
  const ok = P.bashDecision("find /tmp/data -name '*.md'", { mode: "acceptEdits", rules: { allow: ["Read(//tmp/data/**)"], ask: [], deny: [] }, cwd: ROOT, workdirs: [ROOT], home: "/home/dev" });
  assert.equal(ok.verdict, "allow");
});

test("TS5 a helper's card offers what the chat's own card offers for the same command, and its don't-ask-again covers the chat", async () => {
  const cmd = { command: "find /tmp/data -name '*.md'", description: "find notes" };
  const mainOnly = await job({ mode: "acceptEdits", main: [say("", [call("bash", cmd, "b0")]), say("done")], sub: () => say("ok") });
  const mainCard = mainOnly.events.find((e) => e.type === "permission");
  assert.deepEqual(mainCard.rules, ["Read(//tmp/data/**)"]);
  const t = await job({ mode: "acceptEdits", choice: "always",
    main: [say("", [agentCall("find the notes")]), say("", [call("bash", cmd, "b2")]), say("done")],
    sub: (req) => (req.messages.some((m) => m.role === "tool") ? say("", [call("subagent_handback", { message: "found" }, "h")]) : say("", [call("bash", cmd, "m1")])),
  });
  const cards = t.events.filter((e) => e.type === "permission");
  assert.equal(cards.length, 1, "asked once: the helper's always covers the chat's own later call");
  assert.equal(cards[0].agent, "helper");
  assert.deepEqual(cards[0].rules, mainCard.rules, "the same lasting option as the chat's card");
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "b2" && e.code === 0), "the chat's own call ran");
});
