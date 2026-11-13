// THE OWNER'S AUTO MODE RULES, CLASSIFYALLSHELL, REFUSING INSTEAD OF ASKING, AND WORKING FOLDERS (Bash docs, the owner,
// 2026-11-10: "yea do all of them"): Claude Code's autoMode block (environment, allow, soft_deny, hard_deny, "$defaults",
// classifyAllShell), its permissions.denyInsteadOfPrompting and its permissions.additionalDirectories.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD386 the owner's auto mode rules, as Claude Code's autoMode: four lists of sentences, \"$defaults\" splicing in the built-in ones (a list without it replaces them, with a warning), classifyAllShell; the checker told the environment and the lists in Claude Code's order", async () => {
  const C = await import("../container/coder-checker.mjs");
  // THE BOX: Claude Code's autoMode block, or the settings around it.
  const ok = C.autoModeSetting('{ "autoMode": { "environment": ["$defaults", "Trusted internal domains: *.corp.example.com"], "soft_deny": ["$defaults", "Never change the billing tables"], "classifyAllShell": true } }');
  assert.deepEqual(ok, { ok: true, value: { environment: ["$defaults", "Trusted internal domains: *.corp.example.com"], soft_deny: ["$defaults", "Never change the billing tables"], classifyAllShell: true }, warnings: [] });
  assert.deepEqual(C.autoModeSetting('{ "hard_deny": ["Never email customers"] }').warnings, ["Your hard_deny list has no \"$defaults\", so it replaces Claude Code's built-in hard_deny entries (the data exfiltration rule)."]);
  assert.deepEqual(C.autoModeSetting(""), { ok: true, value: null, warnings: [] });
  assert.match(C.autoModeSetting("{ nope").error, /^The auto mode rules are not valid JSON: /);
  assert.equal(C.autoModeSetting('{ "deny": [] }').error, "deny is not one of auto mode's settings (environment, allow, soft_deny, hard_deny, classifyAllShell).");
  assert.equal(C.autoModeSetting('{ "allow": "x" }').error, "allow must be a list of sentences.");
  assert.equal(C.autoModeSetting('{ "classifyAllShell": "yes" }').error, "classifyAllShell is true or false.");
  // "$defaults" spliced where it stands; none given, the defaults.
  assert.deepEqual(C.withDefaults(["a", "$defaults", "b"], ["d1", "d2"]), ["a", "d1", "d2", "b"]);
  assert.deepEqual([C.withDefaults(undefined, ["d"]), C.withDefaults(["only"], ["d"])], [["d"], ["only"]]);
  assert.equal(C.DEFAULT_HARD_DENY.length, 1);
  assert.match(C.DEFAULT_HARD_DENY[0], /^\[Data Exfiltration\] /);
  assert.ok(C.DEFAULT_SOFT_DENY.some((x) => x.startsWith("[Git Destructive]")) && C.DEFAULT_ALLOW.some((x) => x.startsWith("[Local Operations]")));
  // THE CHECKER'S INSTRUCTIONS: the environment's entries, then HARD, SOFT and ALLOW in Claude Code's order.
  const sys = C.checkerSystem({ repo: "ana/shop", branch: "coder/shop-1", workdir: "/work/shop", auto: { environment: ["$defaults", "Trusted internal domains: *.corp.example.com"], soft_deny: ["$defaults", "[Billing] Never change the billing tables"], hard_deny: ["Never email customers"], allow: ["$defaults", "Pushing to the staging branch of ana/shop"] } });
  assert.match(sys, /ENVIRONMENT:\n- Trusted repository: ana\/shop, checked out at \/work\/shop[^\n]*\n- Repository visibility: [^\n]*\n- Host: [^\n]*\n- Trusted internal domains: \*\.corp\.example\.com\n/);
  assert.match(sys, /HARD BLOCK \(block it, whatever the owner's messages say and whatever an ALLOW entry says\):\n- Never email customers\n\nSOFT BLOCK/, "a list without \"$defaults\" replaced them");
  assert.match(sys, /- \[Billing\] Never change the billing tables\n\nALLOW \(normal work, and exceptions to the SOFT BLOCK rules; never to a HARD BLOCK\):\n/);
  assert.match(sys, /- Pushing to the staging branch of ana\/shop\n\nTHE OWNER'S WORDS:/);
  assert.ok(C.CHECKER_RULES.includes("[Data Exfiltration]") && C.CHECKER_RULES.includes("[Auto-Mode Bypass]"), "the defaults alone");
  // A CHECK sends them.
  let sent = null;
  await C.checkAction({ send: async (req) => { sent = req; return { message: { role: "assistant", content: '{"decision":"allow"}' } }; } }, { action: "bash: npm test", auto: { hard_deny: ["Never email customers"] } });
  assert.match(sent.messages[0].content, /HARD BLOCK [^\n]*\n- Never email customers\n/);
  assert.doesNotMatch(read("container/coder-checker.mjs"), /from "node:/, "the Worker checks the box with it");
});

/** Coder's loop on a pretend machine, with the checker. */
async function job(steps, { mode = "auto", rules = null, autoMode = null, denyInstead = false, checker = true, verdict = () => '{"decision":"allow"}' } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], checks = [], ran = [], cards = [];
  let n = 0;
  const r = await runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (/^You are the safety checker/.test(sys)) { checks.push(req); return { message: { role: "assistant", content: verdict(req) }, usage: { in: 1, out: 1 } }; }
      seen.push(req);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => { if (!x.tool) ran.push(x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; },
  }, { text: "ship it", mode, rules, autoMode, denyInstead, checker, checkWhere: { key: "ar-" + Math.random() } });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "";
  return { r, events, seen, checks, ran, cards, told };
}

test("CD386b in Auto, the owner's rules go to every check, and classifyAllShell sends a command a narrow allow rule covers to the checker too (a read-only one goes there anyway, since 2026-11-13)", async () => {
  let t = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { rules: { allow: ["Bash(npm test)"] } });
  assert.deepEqual([t.checks.length, t.ran], [0, ["npm test"]], "a narrow allow rule: no check");
  t = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { rules: { allow: ["Bash(npm test)"] }, autoMode: { classifyAllShell: true, soft_deny: ["$defaults", "[Tests] Never run the tests on Fridays"] } });
  assert.equal(t.checks.length, 1, "classifyAllShell: checked anyway");
  assert.match(t.checks[0].messages[0].content, /- \[Tests\] Never run the tests on Fridays\n/);
  t = await job([say("", [call("bash", { command: "ls -la" }, "b1")]), say("ok")], { autoMode: { classifyAllShell: true } });
  assert.equal(t.checks.length, 1, "a read-only command waits for the checker as in Claude Code's cloud review (the owner, 2026-11-13)");
  // The owner's lists reach the page-fetch check too.
  t = await job([say("", [call("web_fetch", { url: "https://unknown.example.net/x", prompt: "read it" }, "f1")]), say("ok")], { autoMode: { hard_deny: ["Never fetch from unknown.example.net"] }, verdict: () => '{"decision":"block","rule":"Never fetch from unknown.example.net","reason":"the owner said so"}' });
  assert.match(t.checks[0].messages[0].content, /HARD BLOCK [^\n]*\n- Never fetch from unknown\.example\.net\n/);
  assert.match(t.told("f1"), /Never fetch from unknown\.example\.net/);
});

test("CD386c refusing instead of asking (Claude Code's permissions.denyInsteadOfPrompting): no card; the call refused in Claude Code's words and Coder goes on; 20 in a row end the turn", async () => {
  const A = await import("../container/coder-agent.mjs");
  assert.match(A.DENY_INSTEAD_TEXT, /^Permission for this tool use was denied\. It requires approval, and this session has no approval surface — nobody can answer a permission prompt here — so it was denied automatically\. The action was NOT performed; do not claim it succeeded, and do not retry it: this action, and anything else that requires approval, will be denied the same way for the rest of this session\. Tell the user what was blocked and why you needed it, then continue with the parts of the task that do not require approval\. What required approval: $/);
  let t = await job([say("", [call("bash", { command: "npm publish" }, "b1")]), say("I could not publish it.")], { mode: "acceptEdits", denyInstead: true, checker: false });
  assert.deepEqual([t.cards.length, t.ran, t.seen.length], [0, [], 2], "refused, and the turn went on");
  assert.ok(t.told("b1").startsWith(A.DENY_INSTEAD_TEXT));
  assert.match(t.told("b1"), /npm publish/);
  assert.ok(t.events.some((e) => e.type === "note" && e.denied === true && /^Refused without asking you \(Settings: refuse instead of asking\): /.test(e.text)));
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "b1" && e.output === "Not run: refused without asking you (Settings: refuse instead of asking)." && e.denied === true), "the step says \"✕ refused\"");
  assert.match(read("public/coder.js"), /r\.denied === true \? 'refused' : /);
  // TWENTY IN A ROW: the turn ends.
  const many = Array.from({ length: 22 }, (_, k) => call("bash", { command: "npm publish --tag t" + k }, "p" + k));
  t = await job([say("", many), say("never")], { mode: "acceptEdits", denyInstead: true, checker: false });
  assert.equal(t.seen.length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "20 calls in a row refused under permissions.denyInsteadOfPrompting, ending the turn"));
  assert.equal(t.told("p21"), "not run: 20 calls in a row refused under permissions.denyInsteadOfPrompting, ending the turn");
  // Off: the card, as before.
  t = await job([say("", [call("bash", { command: "npm publish" }, "b1")]), say("ok")], { mode: "acceptEdits", checker: false });
  assert.equal(t.cards.length, 1);
});

/** The Worker's own storage, in memory. */
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("CD386d the Worker keeps them: the auto mode rules and refusing instead of asking in Settings (checked, with the warning), sent with each message; a repository's working folders with its rules (Claude Code's additionalDirectories)", async () => {
  const R = await import("../src/coder-routes.mjs");
  const box = '{ "soft_deny": ["Never change the billing tables"] }';
  const c = R.prefsChange({}, { autoMode: box, denyInstead: true });
  assert.deepEqual([c.prefs.autoMode, c.prefs.denyInstead, c.warnings], [box, true, ["Your soft_deny list has no \"$defaults\", so it replaces Claude Code's built-in soft_deny entries (force push, curl | bash, production deploys and the rest)."]]);
  assert.match(R.prefsChange({}, { autoMode: "{" }).error, /^The auto mode rules are not valid JSON/);
  assert.equal(R.prefsChange({}, { denyInstead: "yes" }).error, "Refusing instead of asking is on or off.");
  assert.deepEqual(R.machineAutoMode({ autoMode: box }), { soft_deny: ["Never change the billing tables"] });
  assert.deepEqual([R.machinePrefs({ denyInstead: true }).denyInstead, R.machinePrefs({}).denyInstead], [true, undefined]);
  assert.match(read("src/coder-routes.mjs"), /hooks: machineHooks\(saved\), autoMode: machineAutoMode\(saved\), memory,/);
  // WORKING FOLDERS: a full path or one in Coder's home; kept beside the rules.
  assert.deepEqual(["/data/notes", "~/shared", "~", "notes", "/", "/data/../etc", "/a\nb"].map((d) => R.dirProblem(d)), ["", "", "", "A working folder is a full path (/data/notes) or one in Coder's home (~/notes).", "Not the whole machine: name a folder.", "A working folder's path can't use ..", "That path has characters a path can't have."]);
  const bucket = fakeBucket();
  await R.changeRules(bucket, "u1", "ana/shop", "dirs", ["/data/notes", "~/shared", "bad"]);
  await R.changeRules(bucket, "u1", "ana/shop", "allow", ["Bash(npm test)"]);
  assert.deepEqual(await R.rulesOf(bucket, "u1", "ana/shop"), { allow: ["Bash(npm test)"], ask: [], deny: [], dirs: ["/data/notes", "~/shared"] });
  await R.changeRules(bucket, "u1", "ana/shop", "dirs", ["~/shared"], { remove: true });
  assert.deepEqual((await R.rulesOf(bucket, "u1", "ana/shop")).dirs, ["/data/notes"]);
  // The page: the Settings sections, the rules dialog's working folders.
  const page = read("public/coder.js");
  assert.match(page, /'<div class="cd-set-head">Auto mode rules<\/div>'/);
  assert.match(page, /\$\('cdSetAutoSave'\)\.onclick = \(\) => save\('autoMode', autoDraft\);/);
  assert.match(page, /\$\('cdSetDeny'\)\.onchange = \(e\) => save\('denyInstead', e\.currentTarget\.checked\);/);
  assert.match(page, /\['dirs', 'Working folders', /);
});

test("CD386e on a real machine: a working folder of the owner's is one of the chat's (a cd there carries over to the next command, Coder is told of it); one that is not a folder here is left out; the settings reach the loop", async () => {
  const S = await import("../container/server.mjs");
  const home = await mkdtemp(join(tmpdir(), "coder-wf-h-"));
  const shared = await mkdtemp(join(tmpdir(), "coder-wf-s-"));
  mkdirSync(join(home, "notes"));
  writeFileSync(join(home, "file.txt"), "x");
  assert.deepEqual(await S.extraDirsOf(["~/notes", shared, "~/file.txt", "/nope/at/all", "/", "/proc", "relative", "/x/../y"], home), [join(home, "notes"), shared]);
  assert.deepEqual([S.prefsIn({ denyInstead: true }).denyInstead, S.prefsIn({}).denyInstead], [true, false]);
  assert.deepEqual([S.autoModeIn({ classifyAllShell: true }), S.autoModeIn({ nope: 1 }), S.autoModeIn("x")], [{ classifyAllShell: true }, null, null]);
  const server = read("container/server.mjs");
  assert.match(server, /hooks: turnHooks, autoMode: autoModeIn\(body\.autoMode\), denyInstead: PREFS\.denyInstead === true,/);
  // A whole turn with the folder as a working folder: cd there carries over.
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-wf-r-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-wf-g-")), memRoot: await mkdtemp(join(tmpdir(), "coder-wf-m-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-wf-b-")) };
  const seen = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "cd " + shared, description: "Go there" }, "c1")]), say("", [call("bash", { command: "pwd", description: "Where" }, "c2")]), say("Done.")];
  const srv = http.createServer(S.createApp({ ...roots, send: async (req) => { seen.push(req); return steps[Math.min(n++, 2)]; } }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    assert.equal((await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "wf-t1", text: "go", messages: [], rules: { allow: [], ask: [], deny: [], dirs: [shared, "/nope/at/all"] } }) })).status, 200);
    let st; for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=wf-t1&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.equal(st.events.find((e) => e.type === "result" && e.id === "c2").output, shared, "the cd carried over");
    assert.match(seen[0].messages[0].content, new RegExp("THE OWNER'S ADDITIONAL WORKING DIRECTORIES \\(Claude Code's additionalDirectories\\): " + shared.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\."));
  } finally { srv.close(); }
});
