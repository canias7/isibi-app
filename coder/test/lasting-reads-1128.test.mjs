// A LASTING "ALWAYS FOR READING /etc/" COVERS THE WHOLE CHAT, AND CODER'S OWN AGENT OUTPUT FILES ARE READ WITHOUT ASKING
// (live retest, 2026-11-28; Claude Code's sub-agents and permissions docs: "your lasting answer applies to the whole session,
// including your main conversation"; its task output files are read without a prompt). The model is stubbed: no paid call.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-perms.mjs");
const G = await import("../container/coder-agents.mjs");
const ROOT = "/work/shop";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const isSummary = (req) => Array.isArray(req.tools) && !req.tools.length;

async function job(main, { answers = [], rules = null } = {}) {
  const asks = [], events = [], ran = [];
  let n = 0, k = 0;
  const sub = (req) => (req.messages.some((m) => m.role === "tool") ? say("Listed.") : say("", [call("bash", { command: "ls /etc | head -3", description: "List /etc" }, "s" + ++k)]));
  await A.runCoder({
    send: async (req) => { if (isSummary(req)) return say("SUMMARY"); if (isSub(req)) return sub(req); return main[Math.min(n++, main.length - 1)]; },
    exec: async (x) => { if (/--porcelain=v1/.test(x.command)) return { code: 0, output: "__git_rc=128\n" }; ran.push(x.command); return { code: 0, output: "a\nb\nc\n" }; },
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "lasting-1128", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    // (The machine's copy of the rules, read afresh before each tool call: a new object each time, without the card's rule.)
    rulesNow: () => ({ allow: [...((rules && rules.allow) || [])], ask: [], deny: [] }),
    ask: async (q) => { asks.push(q); return answers.shift() || { choice: "yes" }; }, toolSearch: "false", nestedSkills: false,
  }, { text: "go", mode: "default", ...(rules ? { rules } : {}) });
  return { asks, events, ran };
}

const lsEtc = (x) => x.filter((c) => /ls \/etc/.test(c)).length;

test("LR1 the bash check: a Read(//etc/**) rule lets `ls /etc | head -3` run, and Coder's agent output folder is its own", () => {
  const ctx = (m, extra = {}) => ({ mode: m, cwd: ROOT, workdirs: [ROOT], home: "/home/dev", ownDirs: [], ...extra });
  assert.equal(P.bashDecision("ls /etc | head -3", ctx("default")).verdict, "ask");
  assert.deepEqual(P.bashDecision("ls /etc | head -3", ctx("default")).suggest, ["Read(//etc/**)"]);
  for (const m of ["default", "acceptEdits", "plan"]) assert.equal(P.bashDecision("ls /etc | head -3", ctx(m, { rules: { allow: ["Read(//etc/**)"] } })).verdict, "allow", m);
  assert.equal(P.bashDecision("cat " + G.OUTPUT_DIR + "/agent-1.output", ctx("default", { ownDirs: A.ownDirsOf({}) })).verdict, "allow");
  assert.ok(A.ownDirsOf({ ownDirs: ["/data/bg"] }).includes("/data/bg") && A.ownDirsOf({}).includes(G.OUTPUT_DIR));
});

test("LR2 two helpers in a row: after \"Always\" on the first one's card, the second's same command runs without a card, and so does the main chat's", async () => {
  const r = await job([
    say("", [call("agent", { description: "one", prompt: "run ls /etc | head -3", run_in_background: false }, "a1")]),
    say("", [call("agent", { description: "two", prompt: "run ls /etc | head -3", run_in_background: false }, "a2")]),
    say("", [call("bash", { command: "ls /etc", description: "List /etc" }, "b1")]),
    say("Done."),
  ], { answers: [{ choice: "always" }] });
  assert.equal(r.asks.length, 1, "one card only: " + JSON.stringify(r.asks.map((q) => q && (q.why || q.command))).slice(0, 400));
  assert.equal(lsEtc(r.ran), 3, "all three ran: " + JSON.stringify(r.ran));
  assert.ok(JSON.stringify(r.events).includes("Read(//etc/**)"), "the rule step for the Worker to keep: " + JSON.stringify(r.events.map((e) => e && e.type)));
});

test("LR3 the next message: the kept rule, given back as the chat's rules, covers a helper and the main chat", async () => {
  const r = await job([
    say("", [call("agent", { description: "again", prompt: "run ls /etc | head -3", run_in_background: false }, "a1")]),
    say("", [call("bash", { command: "ls /etc | head -3", description: "List /etc" }, "b1")]),
    say("Done."),
  ], { rules: { allow: ["Read(//etc/**)"], ask: [], deny: [] } });
  assert.equal(r.asks.length, 0);
  assert.equal(lsEtc(r.ran), 2);
});

test("LR4 a saved skill with no folder is loaded without a made-up base directory to read from; one with a folder keeps it", async () => {
  const K = await import("../container/coder-skills.mjs");
  const Pl = await import("../container/coder-plugins.mjs");
  const [saved] = Pl.withOwnerSkills([], [{ name: "notes", description: "d", body: "Write notes." }]);
  const t = K.skillLoaded(saved, "");
  assert.ok(t.startsWith(K.NO_FOLDER_SKILL + "\n\n"), t);
  assert.doesNotMatch(t, /Base directory|no folder\)/);
  assert.match(K.skillLoaded({ name: "x", body: "Hi.", dir: "/work/shop/.claude/skills/x" }), /^Base directory for this skill: \/work\/shop\/\.claude\/skills\/x\n\nHi\.$/);
  assert.ok((await K.renderSkill(saved, "")).text.startsWith(K.NO_FOLDER_SKILL));
});
