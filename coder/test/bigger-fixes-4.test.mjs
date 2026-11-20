// BIGGER CLAUDE CODE FIXES, PART 4 (the owner, 2026-11-20: "yes start the 63 in batches"): audit items I26, I11, M-g-04,
// M-a-26 and M-e-43, each done the Claude Code way.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const C = await import("../container/coder-checks.mjs");
const H = await import("../container/coder-hooks.mjs");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

async function loop(steps, { out = () => "ok\n", hookRun = null, hooks = null, mode = "acceptEdits", answers = [] } = {}) {
  const events = [], seen = [], ran = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const a = (hookRun && (await hookRun(JSON.parse(x.payload)))) || {}; return { code: 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" }; }
      if (x.hook === true) return { code: 0, output: "" };
      ran.push(x.shown || x.command);
      return { code: 0, output: out(x) };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-c1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid, o = {}) => { if (o.gone) for (let w = 0; w < 50 && !o.gone(); w++) await new Promise((ok) => setTimeout(ok, 2)); return o.gone && o.gone() ? { choice: "gone" } : answers[k++] || { choice: "no" }; },
  }, { text: "go", mode, rules: null, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}) });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { r, events, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), told };
}

test("BF401 (I26) a repository hook's PermissionRequest allow rule lasts for this chat only, whatever destination it names, as in Claude Code's cloud, where each session is a fresh machine", async () => {
  const PR = { PermissionRequest: [{ matcher: "Bash", hooks: [{ type: "command", command: "check" }] }] };
  const hookRun = (i) => (i.hook_event_name === "PermissionRequest" ? { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedPermissions: [{ type: "addRules", rules: [{ toolName: "Bash", ruleContent: "npm install *" }], behavior: "allow", destination: "localSettings" }, { type: "addRules", rules: [{ toolName: "Bash", ruleContent: "make *" }], behavior: "allow", destination: "userSettings" }] } } }) } : {});
  const t = await loop([say("", [call("bash", { command: "npm install left-pad" }, "b1"), call("bash", { command: "npm install lodash" }, "b2")]), say("ok")], { hooks: PR, hookRun });
  assert.deepEqual(t.ran, ["npm install left-pad", "npm install lodash"], "the rule covered the second command in this job");
  assert.deepEqual(t.r.rulesAdded || [], [], "nothing for the Worker to save in the owner's lasting rules");
  assert.ok(!t.events.some((e) => e.type === "rule"));
  assert.deepEqual(t.r.sessionRules.allow.sort(), ["Bash(make *)", "Bash(npm install *)"], "kept with this chat");
  // The next chat (a fresh run with no session rules) asks again.
  const again = await loop([say("", [call("bash", { command: "npm install lodash" }, "b1")]), say("ok")], { answers: [{ choice: "no" }] });
  assert.ok(again.events.some((e) => e.type === "permission"), "a card in the next chat");
  // "Always allow" on a card still saves, as before.
  const always = await loop([say("", [call("bash", { command: "npm install lodash" }, "b1")]), say("ok")], { answers: [{ choice: "always" }] });
  assert.ok((always.r.rulesAdded || []).length >= 1, "the owner's own choice is saved");
});

test("BF402 (I11) Grok gets a tool's result unchanged, like Claude Code; key-shaped text is hidden only in what the page shows", async () => {
  const body = "STRIPE=pk_live_abcdefgh1234\nAuthorization: Bearer test-token-1234567890\n";
  // A command's output.
  let t = await loop([say("", [call("bash", { command: "cat cfg.txt" }, "b1")]), say("ok")], { out: () => body });
  assert.match(t.told("b1"), /pk_live_abcdefgh1234/);
  assert.match(t.told("b1"), /Bearer test-token-1234567890/);
  const shown = t.events.find((e) => e.type === "result" && e.id === "b1").output;
  assert.doesNotMatch(shown, /pk_live_abcdefgh1234|test-token-1234567890/);
  assert.match(shown, /\[hidden\]/);
  // A file read.
  t = await loop([say("", [call("read", { path: "cfg.txt" }, "r1")]), say("ok")], { out: (x) => (/coder-tools\.mjs/.test(String(x.command)) ? "1\tSTRIPE=pk_live_abcdefgh1234\n" : "ok\n") });
  assert.match(t.told("r1"), /pk_live_abcdefgh1234/, "the read gives the real text, so a whole-file write keeps it");
  assert.doesNotMatch(t.events.find((e) => e.type === "result" && e.id === "r1").output, /pk_live_abcdefgh1234/);
  // The cutting helpers.
  assert.equal(C.capText("k=pk_live_abcdefgh1234"), "k=pk_live_abcdefgh1234");
  assert.equal(C.capOutput("k=pk_live_abcdefgh1234"), "k=[hidden]");
  assert.match(C.bashResultText({ output: body, hide: (x) => x }), /pk_live_abcdefgh1234/);
  assert.doesNotMatch(C.bashResultText({ output: body }), /pk_live_abcdefgh1234/);
  // A diff where only hidden text changed: one line, marked.
  assert.deepEqual(A.hiddenDiff(["@@ -1,2 +1,2 @@", "-k=pk_live_abcdefgh", "-x=1", "+k=pk_live_zzzzzzzz", "+x=2", " y"]), ["@@ -1,2 +1,2 @@", " k=[hidden]  (hidden text changed)", "-x=1", "+x=2", " y"]);
  assert.deepEqual(A.hiddenDiff(["-a", "+b"]), ["-a", "+b"]);
  assert.deepEqual(A.hiddenDiff(["-same", "+same"]), ["-same", "+same"], "a real unchanged pair is left alone");
});

test("BF403 (M-g-04) a PowerShell command defining a function under a built-in command's name is refused in every mode, as Claude Code's changelog says; a new name keeps today's behaviour", async () => {
  const P = await import("../container/coder-perms.mjs");
  const { parseOf, pipeline, cmdAst, str } = await import("./ps-fake.mjs");
  const PP = await import("../container/coder-psparse.mjs");
  const def = (cmd, name) => parseOf(cmd, [{ type: "FunctionDefinitionAst", text: "function " + name + " { Remove-Item $args }", functionNames: [name], nestedCommands: [cmdAst("Remove-Item $args", str("Remove-Item"), str("$args"))] }, pipeline(name + " a.txt", [cmdAst(name + " a.txt", str(name), str("a.txt"))])]);
  for (const name of ["Get-Content", "gc", "ls", "Write-Output", "global:Get-ChildItem"]) {
    const cmd = "function " + name + " { Remove-Item $args }; " + name + " a.txt";
    for (const mode of ["auto", "acceptEdits", "plan"]) {
      const d = P.psDecision(cmd, { mode, parsed: def(cmd, name), rules: { allow: ["PowerShell(*)"], ask: [], deny: [] } });
      assert.equal(d.verdict, "deny", name + " in " + mode);
      assert.match(d.why, /Give the function a different name/);
    }
  }
  const cmd = "function Clean-Up { Remove-Item $args }; Clean-Up a.txt";
  assert.notEqual(P.psDecision(cmd, { mode: "acceptEdits", parsed: def(cmd, "Clean-Up") }).redefines, true);
  assert.equal(PP.psRedefines(def(cmd, "Clean-Up")), "");
  // The parse script asks PowerShell for each function's name.
  assert.match(PP.PS_PARSE_SCRIPT, /FunctionDefinitionAst\]\}, \$true\) \| ForEach-Object \{ \$_\.Name \}/);
});
