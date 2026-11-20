// CLAUDE CODE FIXES, BATCH 24 (2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bashDecision, BASH_TOO_LONG } from "../container/coder-perms.mjs";

const ROOT = "/work/shop";
const decide = (command, rules = {}) => bashDecision(command, { mode: "default", rules, cwd: ROOT, workdirs: [ROOT] });

test("M-a-21: a command whose variables grow into very long text is refused quickly, in Claude Code's words", () => {
  const names = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let cmd = "A=xxxxxxxx";
  for (let k = 1; k < names.length; k++) cmd += "; " + names[k] + "=$" + names[k - 1] + "$" + names[k - 1] + "$" + names[k - 1] + "$" + names[k - 1];
  cmd += "; echo $Z";
  const t0 = Date.now();
  const d = decide(cmd);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(d.verdict, "deny");
  assert.equal(d.why, BASH_TOO_LONG);
});

test("M-a-21: an ordinary variable is unaffected", () => {
  assert.notEqual(decide("X=1; echo $X").why, BASH_TOO_LONG);
});

test("I70: a deny rule with many stars against a long command finishes at once and still matches", async () => {
  const { bashSpecMatches, ruleWildcardMatches } = await import("../container/coder-perms.mjs");
  const spec = Array.from({ length: 20 }, () => "a").join("*") + "*b";
  const text = Array.from({ length: 40 }, () => "a a a a a a a a").join(" ");
  const t0 = Date.now();
  assert.equal(bashSpecMatches(spec, text), false);
  assert.equal(ruleWildcardMatches(spec, text), false);
  const d = decide(text, { deny: ["Bash(" + spec + ")"] });
  assert.ok(Date.now() - t0 < 1000, "took " + (Date.now() - t0) + " ms");
  assert.notEqual(d.verdict, "deny");
  assert.equal(bashSpecMatches("git * push * main", "git -C x push origin main"), true);
  assert.equal(bashSpecMatches("npm run *", "npm run"), true);
  assert.equal(ruleWildcardMatches("rm *", "rm"), true);
});

test("M-c-16: a hook answer of the wrong shape is a non-blocking error and nothing in it applies", async () => {
  const { hookResult } = await import("../container/coder-hooks.mjs");
  const bad = JSON.stringify({ continue: "no", decision: "deny", hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "yes", additionalContext: "x" } });
  const r = hookResult("PreToolUse", { code: 0, stdout: bad, stderr: "" }, { type: "command", command: "x" });
  assert.equal(r.kind, "error");
  assert.equal(r.json, null);
  assert.match(r.notice, /^Hook JSON output validation failed — continue: expected boolean/);
  const blocked = hookResult("PreToolUse", { code: 0, stdout: bad, stderr: "" }, { type: "command", command: "x", onFailure: "block" });
  assert.equal(blocked.kind, "block");
  const two = hookResult("PreToolUse", { code: 2, stdout: bad, stderr: "no" }, { type: "command", command: "x" });
  assert.equal(two.kind, "block"); assert.equal(two.json, null); assert.equal(two.reason, "no");
  const good = JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "r" } });
  const ok = hookResult("PreToolUse", { code: 0, stdout: good, stderr: "" }, { type: "command", command: "x" });
  assert.equal(ok.kind, "ok"); assert.equal(ok.json.hookSpecificOutput.permissionDecision, "deny");
});

test("M-g-22: a chat Auto mode stopped shows a failed mark and a 'Coder stopped' notification, not 'Coder finished'", async () => {
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const src = /function desktopNews\(before, now, o\) \{[\s\S]*?\n  \}/.exec(ui)[0];
  const desktopNews = new Function(src + "; return desktopNews;")();
  const run = { id: "a", title: "Fix", repo: "o/r", status: "running" };
  assert.deepEqual(desktopNews([run], [{ ...run, status: "failed", ran: 1000 }], { decides: true, actions: true }), [{ id: "a", title: "Coder stopped · Fix", body: "Auto mode stopped the job. Open the chat to try again." }]);
  assert.match(ui, /x\.status === 'failed' \? '<i class="gf-failed" title="Coder stopped: auto mode could not check its steps">/);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /status: s\.result\.status === "done" \? "idle" : s\.result\.status/);
});
