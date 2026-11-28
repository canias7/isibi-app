// The hooks round of 2026-11-27, part 2: the rows of the comparison sheet still "Only Claude Code" that fit a cloud chat
// (skill and agent frontmatter hooks, once, reloadSkills, initialUserMessage, continue:false after a call, the Notification
// types, permission_suggestions setMode entries, SessionEnd with a background command running, the ask label), and the page's
// Escape, which must stop only a job running at that moment.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import * as H from "../container/coder-hooks.mjs";
import * as F from "../container/coder-fmhooks.mjs";
import { skillFrom } from "../container/coder-skills.mjs";
import { parseAgentFile } from "../container/coder-agents.mjs";
import { hookFactsFor } from "../src/coder-hookfacts.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

const SKILL_MD = `---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: '"\${CLAUDE_PROJECT_DIR}"/scripts/security-check.sh'
          once: true
  UserPromptSubmit:
    - hooks:
        - type: command
          command: ./prompt-check.sh
---
Check before you run anything.`;

/** Coder's loop with hooks on a pretend machine (as hooks.test.mjs's), with more deps and options. */
async function hooked(steps, hooks, { hookRun = () => ({}), text = "go", messages = [], answers = [], deps = {}, opts = {} } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], hookCalls = [], cards = [];
  let n = 0, k = 0;
  const r = await runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push({ input, command: x.command });
        const a = (await hookRun(input, x.command)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      ran.push(x.command);
      return { code: /exit 3/.test(String(x.command)) ? 3 : 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-b1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; },
    ...deps,
  }, { text, mode: "auto", messages, hooks: H.hooksFrom({ hooks }, "settings").list, ...opts });
  return { r, events, seen, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), hookCalls, cards };
}
const store = () => { let v = []; return { get: () => v, set: (x) => { v = x; } }; };

test("HKB1 frontmatter YAML: the docs' skill example parses to Claude Code's settings shape; once is kept for skill hooks only", () => {
  const h = F.frontmatterHooks(SKILL_MD);
  assert.deepEqual(h.PreToolUse[0], { matcher: "Bash", hooks: [{ type: "command", command: '"${CLAUDE_PROJECT_DIR}"/scripts/security-check.sh', once: true }] });
  assert.deepEqual(F.yamlParse("a: [x, y]\nb: |\n  one\n  two\nc: 'it''s'\nd: 3\ne: false"), { a: ["x", "y"], b: "one\ntwo", c: "it's", d: 3, e: false });
  assert.equal(F.yamlParse("a: b\n  c: d"), undefined, "bad indentation doesn't parse");
  const sk = skillFrom(SKILL_MD, "x", "/work/shop/.claude/skills/x");
  assert.equal(sk.name, "secure-operations");
  assert.ok(sk.hooks && sk.hooks.PreToolUse);
  assert.equal(skillFrom("---\nname: plain\n---\nbody", "plain", "/d").hooks, undefined);
  assert.equal(H.hooksFrom({ hooks: sk.hooks }, "skill").list.find((x) => x.event === "PreToolUse").once, true);
  assert.equal(H.hooksFrom({ hooks: sk.hooks }, "settings").list.find((x) => x.event === "PreToolUse").once, undefined, "once is ignored in settings");
  const list = F.skillHooksOf(sk).list;
  assert.deepEqual(list.map((x) => [x.event, x.skill, x.source]), [["PreToolUse", "secure-operations", "skill"], ["UserPromptSubmit", "secure-operations", "skill"]]);
});

test("HKB2 skill hooks: none before the skill is invoked; once it is, its PreToolUse hook runs, and `once` removes it after its first successful run", async () => {
  const sk = { ...skillFrom(SKILL_MD, "x", "/work/shop/.claude/skills/x"), model: true, user: true };
  const kept = store();
  const t = await hooked([
    say("", [call("bash", { command: "ls", description: "List" }, "b0")]),
    say("", [call("skill", { skill: "secure-operations" }, "s1")]),
    say("", [call("bash", { command: "ls", description: "List" }, "b1")]),
    say("", [call("bash", { command: "ls", description: "List" }, "b2")]),
    say("done"),
  ], {}, { deps: { skillHooks: kept }, opts: { skills: [sk] } });
  const pre = t.hookCalls.filter((c) => c.input.hook_event_name === "PreToolUse");
  assert.deepEqual(pre.map((c) => c.input.tool_use_id), ["b1"], "not on b0 (before the skill), once on b1, removed for b2");
  assert.deepEqual(kept.get().map((x) => x.event), ["UserPromptSubmit"], "the rest stays registered for the chat");
  // A once hook whose run fails stays.
  const kept2 = store();
  const t2 = await hooked([
    say("", [call("skill", { skill: "secure-operations" }, "s1")]),
    say("", [call("bash", { command: "ls", description: "List" }, "b1")]),
    say("", [call("bash", { command: "ls", description: "List" }, "b2")]),
    say("done"),
  ], {}, { deps: { skillHooks: kept2 }, opts: { skills: [sk] }, hookRun: () => ({ code: 1, stderr: "broke" }) });
  assert.equal(t2.hookCalls.filter((c) => c.input.hook_event_name === "PreToolUse").length, 2, "a failed run leaves it in place");
});

test("HKB3 a skill's UserPromptSubmit hook starts with the next prompt; /clear removes the chat's skill hooks", async () => {
  const sk = { ...skillFrom(SKILL_MD, "x", "/work/shop/.claude/skills/x"), model: true, user: true };
  const kept = store();
  const t1 = await hooked([say("done")], {}, { text: "/secure-operations check", deps: { skillHooks: kept }, opts: { skills: [sk] } });
  assert.equal(t1.hookCalls.filter((c) => c.input.hook_event_name === "UserPromptSubmit").length, 0, "not on the prompt that invoked it");
  assert.equal(kept.get().length, 2);
  const t2 = await hooked([say("done")], {}, { text: "next", messages: [{ role: "user", content: "x" }, { role: "assistant", content: "y" }], deps: { skillHooks: kept }, opts: { skills: [sk] } });
  assert.equal(t2.hookCalls.filter((c) => c.input.hook_event_name === "UserPromptSubmit").length, 1, "on the next one");
  await hooked([say("done")], {}, { text: "fresh", deps: { skillHooks: kept }, opts: { skills: [sk], cleared: true } });
  assert.deepEqual(kept.get(), [], "the conversation after /clear has none");
  // Claude Code's limits per source: past 1,024 hooks a skill registers none of its hooks.
  const many = Array.from({ length: 1024 }, (_, i) => ({ event: "PreToolUse", matcher: "M" + i, type: "command", command: "x", skill: "a" + i, skillSource: "project" }));
  const r = F.registerSkillHooks(many, sk, "project");
  assert.equal(r.added, 0);
  assert.match(r.refused, /registers none of its hooks/);
  assert.equal(F.registerSkillHooks([], sk, "project").added, 2);
  assert.equal(F.registerSkillHooks(F.registerSkillHooks([], sk).list, sk).added, 0, "a skill registers once");
});

test("HKB4 agent frontmatter hooks: read from its file, run only inside it, Stop becomes SubagentStop; a project agent's wait for trust; a plugin's are ignored", () => {
  const md = "---\nname: checker\ndescription: Checks things\nhooks:\n  PreToolUse:\n    - matcher: Bash\n      hooks:\n        - type: command\n          command: ./check.sh\n  Stop:\n    - hooks:\n        - type: command\n          command: ./done.sh\n---\nYou check.";
  const def = parseAgentFile(md, ".claude/agents/checker.md").def;
  assert.equal(def.name, "checker");
  assert.ok(def.hooks.PreToolUse && def.hooks.Stop);
  const fm = F.agentHooksOf(def, { trusted: true });
  assert.deepEqual(fm.own.map((h) => [h.event, h.agent, h.source]), [["PreToolUse", "checker", "agent"]]);
  assert.deepEqual(fm.stop.map((h) => h.event), ["SubagentStop"]);
  assert.deepEqual(F.agentHooksOf(def, { trusted: false }), { own: [], stop: [], held: true });
  assert.deepEqual(F.agentHooksOf({ ...def, plugin: "p" }, { trusted: true }).own, []);
  assert.equal(F.hookSourceLabel(fm.own[0]), "[settings]", "agent frontmatter hooks are labelled [settings]");
  // Wired: the subagent's run gets them, its parent's SubagentStop gets the Stop ones, and trust comes from the repository's switch.
  const ag = read("container/coder-agents.mjs"), cd = read("container/coder-agent.mjs"), sv = read("container/server.mjs");
  assert.match(ag, /k\.agentHooks\(entry\.def\)/);
  assert.match(cd, /agentHooks: \(def\) => agentHooksOf\(def, \{ trusted: repoTrusted === true \}\)/);
  assert.match(ag, /fm\.own\.length \? \{ hooks: fm\.own \}/);
  assert.match(cd, /hooks: Array\.isArray\(fmOwn\) && fmOwn\.length \? \[\.\.\.hookList, \.\.\.fmOwn\] : hookList/);
  assert.match(sv, /repoTrusted: !!\(body\.rules && body\.rules\.trust === true\)/);
});

test("HKB5 SessionStart's reloadSkills reads the skills again; initialUserMessage is the first turn, the owner's prompt next", async () => {
  let reloaded = 0;
  const later = { name: "late", description: "Installed by a hook", body: "late skill", dir: "/d", model: true, user: true };
  const t = await hooked([say("done")], { SessionStart: [{ hooks: [{ type: "command", command: "./ss.sh" }] }] }, {
    text: "hello",
    hookRun: () => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", reloadSkills: true, initialUserMessage: "Read TODO.md first." } }) }),
    deps: { reloadSkills: async () => { reloaded++; return [later]; } },
  });
  assert.equal(reloaded, 1);
  const msgs = t.seen[0].messages.filter((m) => m.role === "user").map((m) => String(m.content));
  const a = msgs.findIndex((m) => m === "Read TODO.md first."), b = msgs.findIndex((m) => m.startsWith("hello"));
  assert.ok(a >= 0 && b > a, "the hook's message, then the owner's");
  assert.ok(msgs.some((m) => m.includes("- late: Installed by a hook")), "the reloaded skill is listed for this message");
  const o = H.hooksOutcome("SessionStart", [{ hook: { type: "command" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "SessionStart", reloadSkills: true, initialUserMessage: "x".repeat(12000) } } } }]);
  assert.equal(o.reloadSkills, true);
  assert.ok(o.initialUserMessage.length < 12000, "capped as Claude Code caps it");
});

test("HKB6 continue:false on PreToolUse: the call runs, then Coder stops, even when the call fails", async () => {
  const t = await hooked([say("", [call("bash", { command: "exit 3", description: "Fail" }, "b1")]), say("never")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./stop.sh" }] }] }, {
    hookRun: () => ({ stdout: '{"continue":false,"stopReason":"Enough for today"}' }),
  });
  assert.equal(t.ran.length, 1, "the call ran");
  assert.equal(t.seen.length, 1, "no model call after it");
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "Enough for today"));
});

test("HKB7 permission_suggestions: addRules and setMode entries, as the card's options", () => {
  const re = (r) => H.ruleEntry(r);
  assert.deepEqual(F.permissionSuggestions({ tool: "edit", rules: ["Edit(src/**)"], toEdits: true, toAuto: true }, { ruleEntry: re }), [
    { type: "addRules", rules: [{ toolName: "Edit", ruleContent: "src/**" }], behavior: "allow", destination: "localSettings" },
    { type: "setMode", mode: "auto", destination: "session" },
    { type: "setMode", mode: "acceptEdits", destination: "session" },
  ]);
  assert.deepEqual(F.permissionSuggestions({ tool: "edit", toAuto: true }, { autoOff: true, ruleEntry: re }), [], "no Auto option when Auto is off");
  assert.deepEqual(F.permissionSuggestions({ tool: "bash", rules: ["Bash(x)"], secret: true }, { ruleEntry: re }), [], "a one-time Yes only");
  assert.deepEqual(F.permissionSuggestions({ tool: "plan" }).map((x) => x.mode), ["auto", "acceptEdits"]);
  assert.deepEqual(F.permissionSuggestions({ tool: "plan", withheld: true }), []);
  assert.match(read("container/coder-agent.mjs"), /const sugg = permissionSuggestions\(card, \{ autoOff: autoOff === true, ruleEntry \}\);/);
});

test("HKB8 a hook's ask names its source on the card: [settings], [plugin:<name>], [skill]", async () => {
  assert.deepEqual([F.hookSourceLabel({ source: "settings" }), F.hookSourceLabel({ source: "project" }), F.hookSourceLabel({ source: "plugin", plugin: "lint" }), F.hookSourceLabel({ source: "skill", skill: "x" })], ["[settings]", "[settings]", "[plugin:lint]", "[skill]"]);
  const o = H.hooksOutcome("PreToolUse", [{ hook: { type: "command", source: "plugin", plugin: "lint" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask" } } } }], { tool: "Bash" });
  assert.equal(o.from.plugin, "lint");
  const t = await hooked([say("", [call("bash", { command: "ls", description: "List" }, "b1")]), say("ok")], { PreToolUse: [{ hooks: [{ type: "command", command: "ask.sh" }] }] }, {
    hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"watched"}}' }),
  });
  assert.equal(t.cards[0].hookFrom, "[settings]");
  assert.doesNotMatch(read("public/coder.js"), /hookFrom/, "no hooks UI on the page (owner, 2026-11-27): the label goes with the card's event only");
});

test("HKB9 Notification types: auth_success and auth_storage_failure from a connector's sign-in, idle_prompt a minute after the job, the elicitation dialogs", async () => {
  assert.deepEqual(F.authNotifications([{ type: "auth_success", connector: "Linear" }, { type: "x" }, { type: "auth_storage_failure", connector: "Box" }]).map((n) => n.notification_type), ["auth_success", "auth_storage_failure"]);
  const meta = { turn: 2, prefsSeen: 1000 };
  assert.deepEqual(hookFactsFor(meta, { auth: [{ type: "auth_success", connector: "Linear", at: 500 }, { type: "auth_success", connector: "Box", at: 2000 }], now: 3000 }).facts.auth, [{ type: "auth_success", connector: "Box" }]);
  assert.equal(hookFactsFor({ turn: 0 }, { auth: [{ type: "auth_success", at: 5 }] }).facts, null, "none on a chat's first message");
  const t = await hooked([say("done")], { Notification: [{ matcher: "auth_success|auth_storage_failure", hooks: [{ type: "command", command: "./n.sh" }] }] }, { opts: { hookFacts: { auth: [{ type: "auth_storage_failure", connector: "Box" }] } } });
  const n = t.hookCalls.find((c) => c.input.hook_event_name === "Notification");
  assert.deepEqual([n.input.notification_type, n.input.message], ["auth_storage_failure", "Signed in to Box, but the sign-in could not be saved"]);
  assert.match(read("src/coder-mcp.mjs"), /noteAuth\(bucket, p\.uid, \{ type: "auth_storage_failure"/);
  assert.equal(F.IDLE_PROMPT_MS, 60000);
  assert.equal(F.ELICIT_NOTIFY_MS, 6000);
  assert.match(read("container/coder-agent.mjs"), /mode === "url" \? "elicitation_url_dialog" : "elicitation_dialog"/);
});

/** A machine of Coder's in this test (as round6.test.mjs's), and a message to it with `hooks`; resolves once the job ended. */
async function machine(sendSteps, opts = {}) {
  const S = await import("../container/server.mjs");
  const r = { root: await mkdtemp(join(tmpdir(), "coder-rootb-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-gitb-")), memRoot: await mkdtemp(join(tmpdir(), "coder-memb-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-bgb-")), home: await mkdtemp(join(tmpdir(), "coder-homeb-")) };
  let n = 0;
  const app = S.createApp({ ...r, send: async () => sendSteps[Math.min(n++, sendSteps.length - 1)], ...opts });
  const srv = http.createServer(app);
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const turn = async (project, hooks) => {
    const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "go", messages: [], hooks }) });
    assert.equal(sent.status, 200);
    let st;
    for (let i = 0; i < 400; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.ok(st && st.result, "the message ended");
    return st;
  };
  return { app, srv, r, turn, base };
}

test("HKB10 idle_prompt: the chat's Notification hooks a minute after its job ends (here at once)", async () => {
  const m = await machine([say("ready")], { idlePromptMs: 0 });
  const project = "hkb-idle-" + process.pid;
  try {
    await m.turn(project, { hooks: { Notification: [{ matcher: "idle_prompt", hooks: [{ type: "command", command: "cat > \"$CLAUDE_PROJECT_DIR/idle.json\"" }] }] } });
    assert.equal(await m.app.idleNow(project), 1);
    const got = JSON.parse(await readFile(join(m.r.root, project, "idle.json"), "utf8"));
    assert.deepEqual([got.hook_event_name, got.notification_type], ["Notification", "idle_prompt"]);
  } finally { m.srv.close(); }
});

test("HKB11 SessionEnd hooks run when the machine stops while a background command still runs", async () => {
  const m = await machine([say("", [call("bash", { command: "sleep 4", description: "Wait", run_in_background: true }, "bg1")]), say("started")]);
  const project = "hkb-bgend-" + process.pid;
  try {
    const st = await m.turn(project, { hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "cat > \"$CLAUDE_PROJECT_DIR/end.json\"" }] }] } });
    assert.ok(Array.isArray(st.result.background) && st.result.background.length >= 1, "the command is still running");
    assert.ok(await m.app.sessionEnd("other", { signal: "SIGTERM" }) >= 1);
    const got = JSON.parse(await readFile(join(m.r.root, project, "end.json"), "utf8"));
    assert.deepEqual([got.hook_event_name, got.reason], ["SessionEnd", "other"]);
    await fetch(m.base + "/bgstop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, id: st.result.background[0].id }) }).catch(() => {});
  } finally { m.srv.close(); }
});

// THE PAGE'S ESC (the bug of 2026-11-27: Escape after a settings or environment window had closed saved a stop, and the next
// message ended at once with "Stopped."): escStop, run on its own with a pretend page.
function escKit(S0, { dialog = false, active = null } = {}) {
  const src = read("public/coder.js");
  const fn = (name) => { const i = src.indexOf("  function " + name + "("); assert.ok(i > 0, name); let d = 0, j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1); } return ""; };
  const stops = [];
  const ctx = {
    S: S0, GLOOPY: false, stops,
    document: { querySelector: () => (dialog ? {} : null), activeElement: active, body: {}, documentElement: {} },
    liveCardEl: () => null, waitsOnYou: () => false, slashMatches: () => [], mentionMatches: () => [],
    stop: () => { stops.push(S0.project && S0.project.id); },
  };
  vm.runInNewContext(fn("escCanStop") + "\n" + fn("escStop") + "\nthis.escStop = escStop;", ctx);
  const key = (o = {}) => { let prevented = false; const e = { key: "Escape", defaultPrevented: false, isComposing: false, repeat: false, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...o, preventDefault: () => { prevented = true; } }; return { did: ctx.escStop(e), prevented }; };
  return { key, stops };
}
const root = { isConnected: true, getClientRects: () => [1], contains: () => true };

test("HKB12 Esc stops only a job running at that moment: never with none running, never saved for the next job, never under a window", () => {
  // No job running (the bug: after a window closed): nothing happens, and nothing is kept for later.
  const idle = { phase: "chat", project: { id: "c1", status: "idle" }, running: false, root };
  const k1 = escKit(idle);
  assert.deepEqual([k1.key().did, k1.stops], [false, []]);
  // The next job starts: the earlier Esc did not carry over to it.
  idle.running = true; idle.project.status = "running";
  assert.deepEqual(k1.stops, [], "no stop was waiting for it");
  // Pressed while it runs: that job stops, once.
  assert.deepEqual([k1.key().did, k1.stops], [true, ["c1"]]);
  // While a window is open, its own Esc closes it: no stop.
  const k2 = escKit({ phase: "chat", project: { id: "c2", status: "running" }, running: true, root }, { dialog: true });
  assert.deepEqual([k2.key().did, k2.stops], [false, []]);
  // The Environment window or a menu open: no stop. A key another handler took (defaultPrevented): no stop.
  const k3 = escKit({ phase: "chat", project: { id: "c3", status: "running" }, running: true, showEnv: true, root });
  assert.equal(k3.key().did, false);
  const k4 = escKit({ phase: "chat", project: { id: "c4", status: "running" }, running: true, root });
  assert.equal(k4.key({ defaultPrevented: true }).did, false);
  assert.equal(k4.key({ repeat: true }).did, false, "a held key doesn't repeat stops");
  // Already stopping, or the job saving its end: no second stop.
  const k5 = escKit({ phase: "chat", project: { id: "c5", status: "running" }, running: true, stopping: true, root });
  assert.equal(k5.key().did, false);
  const k6 = escKit({ phase: "chat", project: { id: "c6", status: "running" }, running: true, ending: true, root });
  assert.equal(k6.key().did, false);
  // Text in the box keeps its own Esc.
  const k7 = escKit({ phase: "chat", project: { id: "c7", status: "running" }, running: true, root }, { active: { id: "cdIn", value: "half a message" } });
  assert.equal(k7.key().did, false);
  // stop() itself sends nothing when there is nothing to stop, so no stop can be saved for a later job.
  const src = read("public/coder.js");
  assert.match(src, /if \(!GLOOPY && !S\.running && !onWay && !\(S\.sending && S\.sendingFor === id\) && !S\.project\.parked\) return;/);
  assert.match(src, /document\.addEventListener\('keydown', \(e\) => \{ escStop\(e\); \}\)/);
});

// THE AUDIT'S TOOL-HOOK GAPS (2026-11-27): GitHub tools by their connector names, the push card's hook tool, the checker's
// PermissionDenied on a push, PostToolUseFailure after a crash, Edit's Claude Code input names.
test("HKB13 GitHub tools reach hooks as mcp__github__<tool>, with the github server", () => {
  assert.deepEqual(["push_branch", "pull_request", "pr_read", "review"].map((t) => H.ccTool(t)), ["mcp__github__push_branch", "mcp__github__pull_request", "mcp__github__pr_read", "mcp__github__review"]);
  assert.deepEqual(H.withMcpServer("PreToolUse", { tool_name: "mcp__github__push_branch" }).mcp_server, { name: "github", source: "claudeai" });
  const all = H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "mcp__github__.*", hooks: [{ type: "command", command: "x" }] }] } }).list;
  assert.equal(H.hooksFor(all, "PreToolUse", H.ccTool("push_branch")).length, 1);
});

test("HKB14 the push's card is the GitHub tool's for PermissionRequest; a checker refusal of a push fires PermissionDenied; a crash runs PostToolUseFailure", () => {
  const cd = read("container/coder-agent.mjs");
  assert.match(cd, /const ghTool = githubMcpName\(kind\) \|\| kind;/);
  assert.match(cd, /const card = \{ tool: "bash", hookTool: ghTool, id,/);
  assert.match(cd, /askOwner\(\{ tool: "bash", hookTool: ghTool, id,/);
  assert.match(cd, /const more = c \? await deniedHooks\(c, why0\) : "";/);
  assert.match(cd, /pushGate\(c\.id, "push_branch", "", c\)/);
  assert.match(cd, /pushGate\(c\.id, "pull_request", one\.title, c\)/);
  assert.match(cd, /resultsSeen\.set\(calls\[i\]\.id, \{ \.\.\.\(was \|\| \{\}\), code: 1, ok: false, ran: true, crashed: true \}\)/);
  assert.match(cd, /if \(hookList\.length && !\(postFor && postFor\.id !== calls\[i\]\.id\)\) postFor = calls\[i\];/);
});

test("HKB15 Read, Write and Edit hook input: file_path only, and Edit's old_string/new_string even when Grok sent old_str/new_str", async () => {
  assert.deepEqual(H.hookToolInput("edit", { path: "a.ts", old_str: "a", new_str: "b" }), { file_path: "a.ts", old_string: "a", new_string: "b" });
  assert.deepEqual(H.hookToolInput("read", { path: "/w/a.ts" }), { file_path: "/w/a.ts" });
  assert.deepEqual(H.toolInputFromHook("edit", { file_path: "a.ts", old_string: "a", new_string: "b" }), { path: "a.ts", old_string: "a", new_string: "b" });
  const t = await hooked([say("", [call("edit", { path: "src/a.ts", old_str: "x", new_str: "y" }, "e1")]), say("ok")], { PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "deny.sh" }] }] }, { hookRun: () => ({ code: 2, stderr: "no" }) });
  const pre = t.hookCalls.find((c) => c.input.hook_event_name === "PreToolUse");
  assert.deepEqual([pre.input.tool_input.old_string, pre.input.tool_input.new_string, pre.input.tool_input.old_str, pre.input.tool_input.path, pre.input.tool_input.file_path], ["x", "y", undefined, undefined, "/work/shop/src/a.ts"]);
});

// THE LIVE TEST OF ac00a917 (2026-11-27): a hook-made worktree becomes the chat's folder; ConfigChange for Coder's own edit of
// .claude/settings.json mid-job; /add-dir.
test("HKB16 a worktree a WorktreeCreate hook made becomes one of the job's working folders, so the chat's shell stays in it and exit_worktree finds it", async () => {
  const cd = read("container/coder-agent.mjs"), sv = read("container/server.mjs");
  assert.match(cd, /command: enterHookWorktreeScript\(w\.path\), timeoutS: 120, here: true, follow: true, desc: "Enter worktree", addRoot: w\.path/);
  assert.match(sv, /toolCwd = "", addRoot = "" \}\) => \{\n\s+\/\/ \(A worktree a WorktreeCreate hook made, entered now: one of the job's working folders from here on\.\)\n\s+if \(typeof addRoot === "string" && addRoot\.startsWith\("\/"\)\) \{ const rp = await realpath\(addRoot\)/);
  assert.match(sv, /readFile\(join\(home \|\| DEV_HOME, "\.coder", "hook-worktrees"\), "utf8"\)/, "and in the chat's next messages, until it is left");
  // In the loop: the enter call passes the hook's path to the machine.
  const execs = [];
  const { runCoder } = await import("../container/coder-agent.mjs");
  await runCoder({
    send: (() => { let n = 0; return async () => [say("", [call("enter_worktree", { name: "x1" }, "w1")]), say("ok")][Math.min(n++, 1)]; })(),
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) return { code: 0, output: "/tmp/hkwt-90\n" + mark[0] + "\n" };
      execs.push(x);
      if (/hook-worktrees/.test(x.command) && /NOHOOKWT/.test(x.command)) return { code: 0, output: "@@CODER-WT NOHOOKWT\n" };
      if (/CODER-WT GONE 0/.test(x.command)) return { code: 0, output: "@@CODER-WT GONE 0\n" };
      if (/WorktreeCreate hook's path/.test(x.command)) return { code: 0, output: "@@CODER-WT OK /tmp/hkwt-90||/work/shop\n" };
      return { code: 0, output: "" };
    },
    emit: () => {}, here: () => "/work/shop", root: "/work/shop", chatId: "shop-wt", where: (p) => p, ask: async () => ({ choice: "yes" }),
  }, { text: "go", mode: "auto", messages: [], hooks: H.hooksFrom({ hooks: { WorktreeCreate: [{ hooks: [{ type: "command", command: "mk.sh" }] }] } }).list });
  assert.ok(execs.some((x) => x.addRoot === "/tmp/hkwt-90" && x.follow === true), "entered with its path as a working folder");
});

test("HKB17 ConfigChange fires when Coder edits the repository's settings mid-job: the job's first look is the hooks it started with", () => {
  assert.match(read("container/server.mjs"), /\n\s+t\.hooksNext = turnHooks;/);
});

test("HKB18 /add-dir <path>, Claude Code's: the folder joins the working folders, and DirectoryAdded gets source slash_command at the next message", () => {
  const pg = read("public/coder.js");
  assert.match(pg, /\['\/add-dir', 'Add a new working directory to the current session'\]/);
  assert.match(pg, /if \(!GLOOPY && \/\^\\\/add-dir\(\?:\\s\|\$\)\/i\.test\(text\)\) \{ boxEmpty\(\); addDirCmd\(/);
  assert.match(pg, /JSON\.stringify\(\{ repo: S\.project\.repo, kind: 'dirs', add: dir \}\)/);
  assert.ok(pg.indexOf("addDirCmd(text") < pg.indexOf("const u = !GLOOPY ? unknownSlash(text)"), "before Unknown command");
  assert.match(read("container/coder-agent.mjs"), /runHooks\("DirectoryAdded", "slash_command", \{ directory: dir, source: "slash_command" \}\)/);
});
