// CLAUDE CODE'S EnterWorktree, ExitWorktree, EndConversation, SendFeedback AND ReportFindings (2026-11-23,
// container/coder-worktree.mjs). A scripted AI (no model is called); the worktree scripts run in real git in a temporary folder.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runCoder, CODER_TOOLS, NOT_FROM_GITHUB } from "../container/coder-agent.mjs";
import { DEFERRED_TOOLS } from "../container/coder-toolsearch.mjs";
import { CC_TOOL } from "../container/coder-hooks.mjs";
import { slashTurn } from "../src/coder-routes.mjs";
import * as W from "../container/coder-worktree.mjs";

const call = (name, args, id = name + Math.random().toString(36).slice(2, 7)) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(req); return steps[Math.min(i++, steps.length - 1)]; } }; };
const toolMsgs = (s) => s.seen.at(-1).messages.filter((m) => m.role === "tool").map((m) => m.content);
const sh = (cwd, script) => { try { return { code: 0, output: execFileSync("bash", ["-c", script], { cwd, encoding: "utf8" }) }; } catch (e) { return { code: e.status, output: String(e.stdout || "") }; } };
async function repo() {
  const d = realpathSync(await mkdtemp(join(tmpdir(), "wt-")));
  const g = (...a) => execFileSync("git", ["-C", d, ...a], { encoding: "utf8" });
  g("init", "-q", "-b", "main"); g("config", "user.email", "t@t"); g("config", "user.name", "t");
  await writeFile(join(d, "a.txt"), "a\n"); g("add", "."); g("commit", "-q", "-m", "one");
  return { d, g };
}

test("WT1 the five tools: ReportFindings upfront, the other four held back, Claude Code's names for hooks, none of the four from GitHub", () => {
  const names = CODER_TOOLS.map((t) => t.function.name);
  for (const n of ["report_findings", "enter_worktree", "exit_worktree", "send_feedback", "end_conversation"]) assert.ok(names.includes(n), n);
  for (const n of ["enter_worktree", "exit_worktree", "send_feedback", "end_conversation"]) { assert.ok(DEFERRED_TOOLS.includes(n), n); assert.ok(NOT_FROM_GITHUB.includes(n), n); }
  assert.ok(!DEFERRED_TOOLS.includes("report_findings"));
  assert.deepEqual([CC_TOOL.enter_worktree, CC_TOOL.exit_worktree, CC_TOOL.end_conversation, CC_TOOL.send_feedback, CC_TOOL.report_findings], ["EnterWorktree", "ExitWorktree", "EndConversation", "SendFeedback", "ReportFindings"]);
  assert.match(W.END_CONVERSATION_DESCRIPTION, /ONLY in two situations/);
  assert.match(W.SEND_FEEDBACK_DESCRIPTION, /Nothing is sent anywhere/);
});

test("WT2 input checks", () => {
  assert.match(W.checkEnterWorktree({ name: "a", path: "/x" }).error, /mutually exclusive/);
  assert.match(W.checkEnterWorktree({ name: "../x" }).error, /Invalid worktree name/);
  assert.deepEqual(W.checkEnterWorktree({ name: "feat/one" }).args, { name: "feat/one" });
  assert.match(W.checkExitWorktree({ action: "delete" }).error, /keep.*remove/);
  assert.match(W.checkEndConversation({ reason: "bored" }).error, /abuse/);
  assert.match(W.checkSendFeedback({ title: "x" }).error, /details/);
  assert.match(W.checkReportFindings({ findings: [{ file: "a.js", summary: "s" }] }).error, /failure_scenario/);
  assert.match(W.checkReportFindings({ findings: [{ file: "a.js", summary: "s", failure_scenario: "f", line: 0 }] }).error, /line/);
  assert.match(W.checkReportFindings({ findings: [{ file: "a.js", summary: "s", failure_scenario: "f", category: "Not A Slug" }] }).error, /kebab/);
  const ok = W.checkReportFindings({ level: "high", findings: [{ file: "./a.js", line: 3, summary: "s", failure_scenario: "f", category: "correctness" }] });
  assert.deepEqual(ok.args, { level: "high", findings: [{ file: "a.js", line: 3, summary: "s", failure_scenario: "f", category: "correctness" }] });
});

test("WT3 the worktree scripts in real git: create under .claude/worktrees, refuse to remove work at risk, remove when clean", async () => {
  const { d, g } = await repo();
  const m = W.markOf(sh(d, W.enterNewScript("one")).output);
  assert.equal(m.kind, "OK");
  const [wt, br] = m.rest.split("|");
  assert.equal(wt, join(d, ".claude/worktrees/one")); assert.equal(br, "worktree-one");
  assert.ok(existsSync(join(wt, "a.txt")));
  // A second with the same name is refused; from inside a worktree a new one is refused too.
  assert.equal(W.markOf(sh(d, W.enterNewScript("one")).output).kind, "ERR");
  assert.match(W.markOf(sh(wt, W.enterNewScript("two")).output).rest, /Already in a worktree/);
  // Not in a worktree: nothing to exit.
  assert.equal(W.markOf(sh(d, W.exitFactsScript()).output).kind, "NONE");
  // An uncommitted file and a commit: at risk.
  await writeFile(join(wt, "b.txt"), "b\n");
  let st = W.exitState(W.markOf(sh(wt, W.exitFactsScript()).output).rest);
  assert.equal(st.files, 1); assert.equal(st.top, wt); assert.equal(st.main, d);
  execFileSync("git", ["-C", wt, "add", "."]); execFileSync("git", ["-C", wt, "commit", "-q", "-m", "two"]);
  st = W.exitState(W.markOf(sh(wt, W.exitFactsScript()).output).rest);
  assert.equal(st.commits, 1);
  assert.match(W.exitRefusedText(st), /1 commit not pushed/);
  // Enter by path from the main checkout: allowed under .claude/worktrees/ without asking.
  assert.equal(W.markOf(sh(d, W.enterPathScript(wt)).output).kind, "OK");
  // Remove (the owner confirmed): the worktree and its branch go.
  assert.equal(W.markOf(sh(wt, W.exitScript({ top: st.top, main: st.main, branch: st.branch, remove: true })).output).kind, "OK");
  assert.ok(!existsSync(wt));
  assert.doesNotMatch(g("branch"), /worktree-one/);
});

test("WT4 report_findings: a findings card with the list as text; Coder is told not to repeat it", async () => {
  const ev = [];
  const s = scripted([say("", [call("report_findings", { findings: [{ file: "src/a.js", line: 12, summary: "Off by one.", failure_scenario: "With 0 items the loop reads items[-1].", category: "correctness" }] }, "r1")]), say("One finding.")]);
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => ev.push(e) }, { text: "/code-review" });
  assert.equal(r.status, "done");
  const card = ev.find((e) => e.type === "findings");
  assert.equal(card.findings[0].file, "src/a.js");
  assert.match(card.text, /src\/a\.js:12 \[correctness\]/);
  assert.ok(toolMsgs(s).some((t) => /Reported 1 finding .*Don't repeat/.test(t)));
  // A bad finding is refused, with no card.
  const ev2 = [];
  const s2 = scripted([say("", [call("report_findings", { findings: [{ file: "a" }] })]), say("x")]);
  await runCoder({ send: s2.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => ev2.push(e) }, { text: "go" });
  assert.ok(!ev2.some((e) => e.type === "findings"));
  assert.ok(toolMsgs(s2).some((t) => /^error: finding 1 needs summary/.test(t)));
});

test("WT5 send_feedback: a draft card only, nothing sent (no command, no request), at most three a job", async () => {
  const ev = []; let execs = 0;
  const fb = { title: "grep keeps timing out", area: "grep", details: "Searching the whole repo times out after 20s." };
  const s = scripted([say("", [call("send_feedback", fb), call("send_feedback", fb), call("send_feedback", fb), call("send_feedback", fb)]), say("Drafted.")]);
  await runCoder({ send: s.send, exec: async () => { execs++; return { code: 0, output: "" }; }, emit: (e) => ev.push(e) }, { text: "file feedback" });
  const cards = ev.filter((e) => e.type === "feedback");
  assert.equal(cards.length, 3);
  assert.equal(cards[0].text, "grep keeps timing out (grep)\n\nSearching the whole repo times out after 20s.");
  assert.ok(toolMsgs(s).some((t) => /Nothing has been sent/.test(t)));
  assert.ok(toolMsgs(s).some((t) => /already showed 3 draft cards/.test(t)));
  assert.equal(ev.filter((e) => e.type === "feedback_count").length, 1);
});

test("WT6 end_conversation ends the job with no further answer; a bad reason is refused", async () => {
  const ev = [];
  const s = scripted([say("", [call("end_conversation", { reason: "owner_request" })]), say("should never be asked")]);
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => ev.push(e) }, { text: "yes, end it" });
  assert.equal(r.status, "done"); assert.equal(r.ended, true);
  assert.equal(s.seen.length, 1);
  assert.ok(ev.some((e) => e.type === "ended" && e.reason === "owner_request"));
  const s2 = scripted([say("", [call("end_conversation", { reason: "tired" })]), say("ok")]);
  const r2 = await runCoder({ send: s2.send, exec: async () => ({ code: 0, output: "" }) }, { text: "x" });
  assert.notEqual(r2.ended, true);
});

test("WT7 enter_worktree and exit_worktree through the chat's shell; removing work at risk is refused without discard_changes", async () => {
  const { d } = await repo();
  let cwd = d;
  // The chat's shell: each command starts where the last one ended (as Coder's machine does).
  const exec = async ({ command }) => { const r = sh(cwd, command + "\necho \"@@PWD $(pwd -P)\""); const p = /@@PWD (.*)/.exec(r.output); if (p) cwd = p[1].trim(); return { code: r.code, output: r.output.replace(/@@PWD .*\n?/, "") }; };
  const s = scripted([say("", [call("enter_worktree", { name: "fix" })]), say("", [call("bash", { command: "echo x > new.txt" })]), say("", [call("exit_worktree", { action: "remove" })]), say("", [call("exit_worktree", { action: "keep" })]), say("Done.")]);
  await runCoder({ send: s.send, exec, emit: () => {} }, { text: "do it in a worktree" });
  const t = toolMsgs(s);
  assert.ok(t.some((x) => /Created worktree at .*\.claude\/worktrees\/fix on branch worktree-fix/.test(x)), t.join("\n"));
  assert.ok(t.some((x) => /Worktree has 1 uncommitted file\. Removing it would discard this work/.test(x)));
  assert.ok(t.some((x) => /Exited the worktree\. Your work is preserved/.test(x)));
  assert.equal(cwd, d);
  assert.ok(existsSync(join(d, ".claude/worktrees/fix/new.txt")));
});

test("WT8 /code-review asks for report_findings; the page draws the cards; the CSS is scoped; a chat that ended takes no messages", () => {
  assert.match(slashTurn("/code-review").text, /call report_findings once/);
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  for (const k of ["e.type === 'findings'", "e.type === 'feedback'", "e.type === 'ended'", "function findingsHTML"]) assert.ok(js.includes(k), k);
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  for (const line of css.split("\n").filter((l) => /\.cd-(findings|finding|fbcard|sev|cat)\b/.test(l))) assert.match(line, /^#gfApp /, line);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /meta\.convoEnded === true && !wake\) return json\(\{ error: "Coder ended this conversation/);
  assert.match(routes, /s\.result\.ended === true \? \{ convoEnded: true \}/);
});
