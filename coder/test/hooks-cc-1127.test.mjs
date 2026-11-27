// The hooks round of 2026-11-27: Coder's hooks matched to Claude Code's hooks reference.
import test from "node:test";
import assert from "node:assert/strict";
import * as H from "../container/coder-hooks.mjs";
import * as E from "../container/coder-hookevents.mjs";
import { sessionCrons, cronState } from "../container/coder-schedule.mjs";
import { hookFactsFor } from "../src/coder-hookfacts.mjs";
import { MODEL_HOOKS_AT_ONCE } from "../container/coder-agent.mjs";
import { HANDBACK_CONTENT } from "../container/coder-agents.mjs";

const NEW = ["InstructionsLoaded", "UserPromptExpansion", "PreModelSwitch", "PostModelSwitch", "ConfigChange", "DirectoryAdded", "WorktreeCreate", "WorktreeRemove"];

test("HK1 the new events are Coder's, with Claude Code's hook types, matchers, timeouts and permission_mode", () => {
  for (const e of NEW) assert.ok(H.HOOK_EVENTS.includes(e), e);
  assert.deepEqual(H.typesFor("UserPromptExpansion"), ["command", "http", "mcp_tool", "prompt", "agent"]);
  for (const e of NEW.filter((x) => x !== "UserPromptExpansion")) assert.deepEqual(H.typesFor(e), ["command", "http", "mcp_tool"], e);
  assert.equal(H.timeoutFor("PreModelSwitch"), 30);
  assert.equal(H.timeoutFor("PostModelSwitch"), 30);
  assert.equal(H.timeoutFor("ConfigChange"), 600);
  const all = H.hooksFrom({ hooks: { WorktreeCreate: [{ matcher: "zzz", hooks: [{ type: "command", command: "x" }] }], ConfigChange: [{ matcher: "skills", hooks: [{ type: "command", command: "y" }] }] } }).list;
  assert.equal(H.hooksFor(all, "WorktreeCreate", "").length, 1); // no matcher support: ignored
  assert.equal(H.hooksFor(all, "ConfigChange", "user_settings").length, 0);
  assert.equal(H.hooksFor(all, "ConfigChange", "skills").length, 1);
  assert.equal(H.hookInput("ConfigChange", {}, {}).permission_mode, undefined);
  assert.equal(H.hookInput("UserPromptExpansion", {}, {}).permission_mode, "auto");
});

test("HK2 agent_id and agent_type on every hook that fires inside a subagent; the event's own fields win", () => {
  const i = H.hookInput("PreToolUse", { agent: { id: "agent-1", type: "Explore" } }, { tool_name: "Bash" });
  assert.equal(i.agent_id, "agent-1");
  assert.equal(i.agent_type, "Explore");
  assert.equal(H.hookInput("PreToolUse", {}, {}).agent_id, undefined);
  assert.equal(H.hookInput("SubagentStop", { agent: { id: "a", type: "Plan" } }, { agent_id: "b", agent_type: "Explore" }).agent_id, "b");
});

test("HK3 mcp_tool onFailure block: a failure, a timeout, or an answer that is no hook output blocks as exit 2; unset stays non-blocking", () => {
  const s = H.hooksFrom({ hooks: { PreToolUse: [{ hooks: [{ type: "mcp_tool", server: "a", tool: "b", onFailure: "block" }] }] } });
  const h = s.list[0];
  assert.equal(h.onFailure, "block");
  assert.equal(H.hookResult("PreToolUse", { mcp: { ok: false }, stderr: "not connected" }, h).kind, "block");
  assert.equal(H.hookResult("PreToolUse", { mcp: { ok: false }, timedOut: true }, h).kind, "block");
  assert.equal(H.hookResult("PreToolUse", { mcp: { ok: true }, stdout: "hello" }, h).kind, "block");
  assert.equal(H.hookResult("PreToolUse", { mcp: { ok: true }, stdout: "{}" }, h).kind, "ok");
  assert.equal(H.hookResult("PreToolUse", { mcp: { ok: true }, stdout: "{\"reason\":\"x\"}" }, h).kind, "block");
  assert.equal(H.hookResult("PreToolUse", { mcp: { ok: false }, stderr: "boom" }, { ...h, onFailure: undefined }).kind, "error");
  assert.equal(H.hookResult("Stop", { mcp: { ok: false }, stderr: "boom" }, h).kind, "error"); // "no effect" on Stop
  assert.match(H.hookResult("PreToolUse", { mcp: { ok: false }, stderr: "x" }, h).reason, /blocking because onFailure is "block"/);
});

test("HK4 at most 12 prompt or agent hooks at once (already Coder's)", () => assert.equal(MODEL_HOOKS_AT_ONCE, 12));

test("HK5 WorktreeCreate's path: a command hook's last non-empty line (ANSI stripped), an HTTP hook's worktreePath; failures and bad paths refused", () => {
  assert.deepEqual(E.worktreeHookPath([{ code: 0, stdout: "banner\n\x1b[32m/w/feature\x1b[0m\n\n" }], "/r"), { path: "/w/feature" });
  assert.deepEqual(E.worktreeHookPath([{ code: 0, stdout: "../wt/x" }], "/r/sub"), { path: "/r/wt/x" });
  assert.deepEqual(E.worktreeHookPath([{ http: { status: 200, body: JSON.stringify({ hookSpecificOutput: { hookEventName: "WorktreeCreate", worktreePath: "/h/p" } }) } }]), { path: "/h/p" });
  assert.ok(E.worktreeHookPath([{ code: 1, stdout: "/x", stderr: "nope" }]).error);
  assert.ok(E.worktreeHookPath([{ code: 0, stdout: "" }]).error);
  assert.ok(E.worktreeHookPath([{ code: 0, stdout: "/a/../b" }]).error);
  assert.ok(E.worktreeHookPath([]).error);
});

test("HK6 WorktreeRemove: non-zero with the folder still there fails; a hook that deleted it first counts as removed", () => {
  assert.equal(E.worktreeRemoveFailed([{ code: 1, stderr: "x" }], true), "");
  assert.match(E.worktreeRemoveFailed([{ code: 1, stderr: "x" }], false), /exited 1/);
  assert.equal(E.worktreeRemoveFailed([{ code: 0 }], false), "");
  assert.match(E.enterHookWorktreeScript("/w/a"), /hook-worktrees/);
  assert.match(E.leaveHookWorktreeScript({ path: "/w/a", origin: "/r" }), /LEFT/);
});

test("HK7 InstructionsLoaded: the instruction files at session start and lazy loads; never AGENTS.md", () => {
  const pieces = [{ key: "i:CLAUDE.md" }, { key: "i:CLAUDE.local.md" }, { key: "i:AGENTS.md" }, { key: "i:.claude/rules/ts.md" }, { key: "i:YOUR MEMORY FOR THIS REPO" }, { key: "s:X" }];
  assert.deepEqual(E.instructionFiles(pieces, "/repo"), [
    { file_path: "/repo/CLAUDE.md", memory_type: "Project", load_reason: "session_start" },
    { file_path: "/repo/CLAUDE.local.md", memory_type: "Local", load_reason: "session_start" },
    { file_path: "/repo/.claude/rules/ts.md", memory_type: "Project", load_reason: "session_start" },
  ]);
  assert.equal(E.instructionFiles(pieces, "/repo", "compact")[0].load_reason, "compact");
  const out = "file text\n\n" + E.LAZY_HEAD + ", from…:\n— .claude/rules/api.md:\nrule\n\n— src/CLAUDE.md:\nnested";
  assert.deepEqual(E.lazyInstructionFiles(out, "/repo", "/repo/src/a.ts"), [
    { file_path: "/repo/.claude/rules/api.md", memory_type: "Project", load_reason: "path_glob_match", trigger_file_path: "/repo/src/a.ts" },
    { file_path: "/repo/src/CLAUDE.md", memory_type: "Project", load_reason: "nested_traversal", trigger_file_path: "/repo/src/a.ts" },
  ]);
  assert.equal(H.hooksOutcome("InstructionsLoaded", [{ hook: { type: "command" }, result: { kind: "ok", json: { systemMessage: "x", continue: false } } }]).messages.length, 0);
});

test("HK8 PreModelSwitch and PostModelSwitch: inputs without Claude's cache-cost fields; deny > ask > allow; exit 2 blocks; PostModelSwitch text goes to Coder", () => {
  assert.deepEqual(E.modelSwitchFields({ from: "grok-4.7", to: "grok-5", source: "command" }), { from_model: "grok-4.7", to_model: "grok-5", requested_model: "grok-5", source: "command" });
  assert.equal(E.modelSwitchFields({ from: "a", to: "a" }), null);
  const h = { type: "command", command: "x" };
  const run = (json) => ({ hook: h, result: { kind: "ok", json } });
  const o = H.hooksOutcome("PreModelSwitch", [run({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "allow" } }), run({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "ask", permissionDecisionReason: "sure?" } }), run({ systemMessage: "costly" })]);
  assert.equal(o.decision, "ask");
  assert.deepEqual(o.messages, ["costly"]);
  assert.equal(H.hooksOutcome("PreModelSwitch", [{ hook: h, result: { kind: "block", json: null, reason: "retired" } }]).decision, "deny");
  assert.equal(H.hooksOutcome("PreModelSwitch", [{ hook: h, result: { kind: "block", json: null, reason: "retired" } }]).reason, "retired");
  assert.deepEqual(H.hooksOutcome("PostModelSwitch", [{ hook: h, result: { kind: "ok", json: null, text: "On Grok 5, plan first." } }]).context, ["On Grok 5, plan first."]);
  assert.match(H.badShape("PreModelSwitch", { hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "defer" } }), /permissionDecision/);
  assert.match(E.modelBlockedText("a", "b", "no"), /PreModelSwitch hook blocked the switch to b: no/);
});

test("HK9 ConfigChange blocks silently; DirectoryAdded's systemMessage goes to Coder, not the owner", () => {
  const h = { type: "command", command: "x" };
  const c = H.hooksOutcome("ConfigChange", [{ hook: h, result: { kind: "ok", json: { decision: "block", reason: "no", systemMessage: "s" } } }]);
  assert.equal(c.decision, "block");
  assert.equal(c.messages.length, 0);
  const d = H.hooksOutcome("DirectoryAdded", [{ hook: h, result: { kind: "ok", json: { systemMessage: "deps installed", continue: false } } }]);
  assert.deepEqual(d.context, ["deps installed"]);
  assert.equal(d.messages.length, 0);
  assert.equal(d.stop, null);
});

test("HK10 UserPromptExpansion's input for built-in prompt commands and skills; others none; a block", () => {
  assert.deepEqual(E.expansionOf("/init keep it short"), { expansion_type: "slash_command", command_name: "init", command_args: "keep it short", command_source: "builtin", prompt: "/init keep it short" });
  assert.equal(E.expansionOf("/deploy now", { name: "deploy" }).command_name, "deploy");
  assert.equal(E.expansionOf("/deploy now", { name: "deploy" }).command_source, "projectSettings");
  assert.equal(E.expansionOf("/model grok"), null);
  assert.equal(E.expansionOf("hello"), null);
  const o = H.hooksOutcome("UserPromptExpansion", [{ hook: { type: "command", command: "x" }, result: { kind: "ok", json: { decision: "block", reason: "not here", hookSpecificOutput: { hookEventName: "UserPromptExpansion", additionalContext: "ctx" } } } }]);
  assert.equal(o.decision, "block");
  assert.equal(o.reason, "not here");
});

test("HK11 Stop and SubagentStop: background_tasks with subagents and workflows; session_crons from the chat's crons and wake-up", () => {
  const jobs = new Map([["b1", { desc: "npm run dev", command: "npm run dev", done: false }], ["b2", { done: true }]]);
  const bg = new Map([["agent-1", { kind: "agent", done: false, entry: { description: "Find endpoints", type: "Explore" } }], ["wf1", { kind: "workflow", done: false, entry: { description: "workflow “audit”" } }]]);
  assert.deepEqual(E.backgroundTasks(jobs, bg), [
    { id: "b1", type: "shell", status: "running", description: "npm run dev", command: "npm run dev" },
    { id: "agent-1", type: "subagent", status: "running", description: "Find endpoints", agent_type: "Explore" },
    { id: "wf1", type: "workflow", status: "running", description: "workflow “audit”", name: "audit" },
  ]);
  const st = cronState({ crons: [{ id: "abcd1234", cron: "0 9 * * 1-5", prompt: "standup", recurring: true, durable: false, at: 1, next: 2, tz: "UTC" }, { id: "ffff0000", cron: "0 1 * * *", prompt: "kept", recurring: true, durable: true, at: 1, next: 2, tz: "UTC" }], wake: { at: Date.UTC(2026, 10, 27, 14, 5), prompt: "check CI" } });
  assert.deepEqual(sessionCrons(st), [{ id: "abcd1234", schedule: "0 9 * * 1-5", recurring: true, prompt: "standup" }, { id: "wakeup", schedule: "5 14 27 11 *", recurring: false, prompt: "check CI" }]);
  assert.match(sessionCrons({ ...st, crons: [{ ...st.crons[0], prompt: "x".repeat(1200) }], wake: null })[0].prompt, /… \[\+200 chars\]$/);
});

test("HK12 a subagent's own transcript: sidechain lines with its agentId; the Agent tool's content after a handback is a note", () => {
  const t = H.transcriptLines([{ role: "user", content: "hi" }], { session: "s", agent: "agent-1" });
  const l = JSON.parse(t.lines[0]);
  assert.equal(l.isSidechain, true);
  assert.equal(l.agentId, "agent-1");
  assert.equal(JSON.parse(H.transcriptLines([{ role: "user", content: "hi" }], { session: "s" }).lines[0]).isSidechain, false);
  assert.match(HANDBACK_CONTENT, /SubagentHandback/);
});

test("HK13 the Worker's facts: a model switch, a Settings change, folders added; none on a chat's first message", () => {
  assert.equal(hookFactsFor({ turn: 0 }, { model: "b" }).facts, null);
  const r = hookFactsFor({ turn: 2, lastModel: "a", prefsSeen: 100, dirsSeen: ["/x"] }, { model: "b", via: "command", prefsAt: 200, dirs: ["/x", "/y"], now: 300 });
  assert.deepEqual(r.facts, { modelSwitch: { from: "a", to: "b", source: "command", requested: "b" }, configChanges: [{ source: "user_settings" }], dirsAdded: ["/y"] });
  assert.deepEqual(r.seen, { lastModel: "b", prefsSeen: 300, dirsSeen: ["/x", "/y"] });
  assert.equal(hookFactsFor({ turn: 2, lastModel: "a", prefsSeen: 100, dirsSeen: [] }, { model: "a", prefsAt: 50 }).facts, null);
});
