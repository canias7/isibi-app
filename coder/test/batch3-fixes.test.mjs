// CLAUDE CODE FIXES, BATCH 3 (2026-11-19): each against Claude Code's docs or changelog.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleHoldsSecret } from "../container/coder-agent.mjs";

const ROOT = "/work/shop";
const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
export async function job(steps, { mode = "acceptEdits", answers = [], rules = null, extra = {}, deps = {} } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], cards = [];
  let n = 0, k = 0;
  const r = await runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { ran.push(x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || null; },
    ...deps,
  }, { text: "go", mode, rules, ...extra });
  return { r, events, seen, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), cards };
}

test("B3-01 'don't ask again' on a rule that holds a secret keeps it for this chat only, not in the repository's rules", async () => {
  for (const c of ["API_KEY=sk9fj2kd8s7a6d5f4g3h npm test", "mysql -pHunter2pass -e 'select 1'", "curl -u admin:s3cretpw https://x.example/api", "curl -H 'Authorization: Bearer ab12cd34ef56gh78ij90' https://x.example"])
    assert.ok(ruleHoldsSecret("Bash(" + c + ")"), c);
  for (const c of ["Bash(npm test *)", "Bash(npm run *)", "Bash(FOO=1 npm test)", "Read(//tmp/**)", "Bash(git commit *)"]) assert.ok(!ruleHoldsSecret(c), c);
  const cmd = "API_KEY=sk9fj2kd8s7a6d5f4g3h npm test";
  const a = await job([say("", [call("bash", { command: cmd }, "b1")]), say("", [call("bash", { command: cmd }, "b2")]), say("Done.")], { answers: [{ choice: "always" }] });
  assert.equal(a.cards.length, 1, "allowed for the rest of the chat");
  assert.ok(!(a.r.rulesAdded || []).some((r) => /sk9fj2/.test(r)), "not saved with the repository's rules");
  assert.ok(a.r.sessionRules && a.r.sessionRules.allow.some((r) => /sk9fj2/.test(r)), "kept as the chat's own");
  const b = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("Done.")], { answers: [{ choice: "always" }] });
  assert.deepEqual(b.r.rulesAdded, ["Bash(npm test *)"]);
});

test("B3-02 the tools that post on GitHub, and the gh note, say a bare @name notifies its owner (Claude Code 2.1.309)", async () => {
  const { CODER_TOOLS, MACHINE_TOOLS, GH_MENTIONS } = await import("../container/coder-agent.mjs");
  assert.match(GH_MENTIONS, /Write a bare @name only for a real login you mean to notify/);
  for (const n of ["pull_request", "pr_update", "reply_review"]) {
    const t = CODER_TOOLS.find((x) => (x.function || x).name === n);
    assert.ok((t.function || t).description.includes(GH_MENTIONS), n);
  }
  assert.ok(MACHINE_TOOLS.includes(GH_MENTIONS));
});

test("B3-03 a chat's session rules: when its deny or ask rules cannot all be kept, its allow rules are dropped too (Claude Code)", async () => {
  const { sessionRulesOf } = await import("../src/coder-routes.mjs");
  const deny = Array.from({ length: 60 }, (_, i) => "Bash(rm" + i + " *)");
  const a = sessionRulesOf({ allow: ["Bash(npm test *)"], deny, ask: [] });
  assert.equal(a.deny.length, 50);
  assert.deepEqual(a.allow, []);
  const b = sessionRulesOf({ allow: ["Bash(npm test *)"], deny: deny.slice(0, 10), ask: [] });
  assert.deepEqual([b.allow, b.deny.length], [["Bash(npm test *)"], 10]);
});

test("B3-04 with the admin sandbox, a proposed setup script may use sudo and admin commands on any line (Claude Code: 'Scripts run as root')", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const { envAnswer, APPLIES_TO, ENV_TOOLS } = await import("../container/coder-envtools.mjs");
  const envApi = (script) => async (body) => envAnswer({ envId: "default", list: [{ id: "default", name: "Default", repos: [] }], data: { default: { script, vars: {}, secrets: [], network: { mode: "trusted", hosts: [], defaults: true } } }, repos: ["ana/shop"] }, body);
  const was = "echo ok > ran.txt", line = "sudo npm install -g pnpm";
  const args = { environment_name: "Default", applies_to: APPLIES_TO, reason: "pnpm", setup_script: was + "\n" + line, script_change: "replaces the existing setup script" };
  const go = async (box) => {
    let n = 0; const seen = [], events = [];
    const turns = [say("", [call("bash", { command: line }, "r1")]), say("", [call("update_environment", args, "u1")]), say("ok")];
    await runCoder({ send: async (q) => { seen.push(q); return turns[Math.min(n++, turns.length - 1)]; }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), envApi: envApi(was), ask: async () => ({ choice: "park" }) }, { text: "add pnpm", setupScript: was, mode: "auto", box });
    return { seen, cards: events.filter((e) => e.type === "envchange") };
  };
  const on = await go(true);
  assert.equal(on.cards.length, 1, "proposed");
  const off = await go(false);
  assert.equal(off.cards.length, 0);
  assert.match(JSON.stringify(off.seen[2].messages), /only plain lines like `apt-get install -y jq`/);
  const upd = ENV_TOOLS.find((t) => (t.function || t).name === "update_environment");
  assert.match(JSON.stringify(upd), /the script runs as admin on Ubuntu 24.04, so apt install, sudo and other admin steps work on any line/);
});

test("B3-05 a redirect or tee after a cd is checked where it lands, against the protected paths (Claude Code checks it 'as if Claude wrote or read that file directly'); a target with a variable is asked about", async () => {
  const A = await import("../container/coder-agent.mjs");
  const deps = { root: ROOT, here: () => ROOT };
  const kind = (c) => { const a = A.commandAsk(c, deps, ROOT); return a ? a.kind : null; };
  for (const c of ["cd .husky && echo x > pre-commit", "cd .git/hooks && echo x > pre-commit", "cd .claude && echo {} > settings.json", "cd .husky && tee pre-commit", "(cd .husky; echo x > pre-commit)", "D=.husky; echo x > $D/pre-commit"]) assert.equal(kind(c), "protected", c);
  for (const c of ["cd src && echo x > a.txt", "echo x > a.txt", "cd .husky && ls 2>/dev/null"]) assert.equal(kind(c), null, c);
  // In a job from GitHub, refused.
  const t = await job([say("", [call("bash", { command: "cd .husky && echo x > pre-commit" }, "b1")]), say("Done.")], { mode: "auto", extra: { github: true } });
  assert.deepEqual(t.ran, []);
});

test("B3-06 a write or an edit through a folder link that lands in a protected folder asks, naming where it leads, in Auto too; refused from GitHub; the tools refuse .git through a link", async () => {
  const { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, realpathSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const R = realpathSync(mkdtempSync(join(tmpdir(), "b3-link-")));
  for (const d of [".claude", ".husky", ".git/hooks", "src"]) mkdirSync(join(R, d), { recursive: true });
  writeFileSync(join(R, ".husky", "pre-push"), "x\n");
  symlinkSync(".claude", join(R, "c")); symlinkSync(".husky", join(R, "h")); symlinkSync(".git", join(R, "g")); symlinkSync("src", join(R, "s"));
  const { runCoder } = await import("../container/coder-agent.mjs");
  const go = async (args, { mode = "auto", github = false, tool = "write" } = {}) => {
    const events = [], cards = []; let n = 0;
    const steps = [say("", [call(tool, args, "w1")]), say("Done.")];
    await runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "ok\n" }), emit: (e) => events.push(e), here: () => R, root: R, where: (p) => (p.startsWith("/") ? p : R + "/" + p),
      ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "no" }; } }, { text: "go", mode, github });
    return { events, cards };
  };
  for (const [p, real] of [["c/settings.json", ".claude/settings.json"], ["h/pre-commit", ".husky/pre-commit"]]) {
    for (const mode of ["auto", "acceptEdits"]) {
      const r = await go({ path: p, content: "x\n" }, { mode });
      assert.equal(r.cards.length, 1, p + " " + mode);
      assert.match(JSON.stringify(r.cards[0]), new RegExp("which leads to " + real.replace(/\./g, "\\.")));
    }
    const g = await go({ path: p, content: "x\n" }, { github: true });
    assert.ok(g.events.some((e) => e.type === "result" && e.ran === false), "refused from GitHub");
  }
  const e = await go({ path: "h/pre-push", old_string: "x", new_string: "y" }, { tool: "edit" });
  assert.equal(e.cards.length, 1);
  const plain = await go({ path: "s/a.txt", content: "x\n" });
  assert.equal(plain.cards.length, 0, "an ordinary link is unchanged");
  // The tools script on the machine: .git through a link is off limits.
  const { execFileSync } = await import("node:child_process");
  const tools = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  let out = "";
  try { out = execFileSync("node", [tools, Buffer.from(JSON.stringify({ tool: "write", args: { path: "g/hooks/pre-commit", content: "x" } })).toString("base64")], { cwd: R, encoding: "utf8" }); } catch (x) { out = String(x.stdout || "") + String(x.stderr || ""); }
  assert.match(out, /\.git folder is off limits/);
});

test("B3-07 a PowerShell write through a folder link: into a protected folder it keeps its card in Auto (viaLink), out of the project it asks naming where it leads, as a bash command's does", async () => {
  const A = await import("../container/coder-agent.mjs");
  const PSF = await import("./ps-fake.mjs");
  const P = "/work/shop";
  const links = { [P + "/lnk_h"]: P + "/.husky", [P + "/lnk_out"]: "/tmp/elsewhere" };
  const named = (w) => (String(w).startsWith("/") ? String(w) : P + "/" + String(w).replace(/\\/g, "/"));
  const abs = (w) => { const n = named(w); for (const [l, to] of Object.entries(links)) if (n === l || n.startsWith(l + "/")) return to + n.slice(l.length); return n; };
  const deps = { root: P, where: (p) => (p.startsWith("/") ? p : P + "/" + p) };
  const ask = (cmd, o = {}) => A.psProtectedAsk(PSF.fakeParse(cmd), deps, abs, () => false, { named, command: cmd, ...o });
  for (const cmd of ["Set-Content -Path lnk_out/n.txt -Value x", "Remove-Item lnk_out/o.txt"]) {
    const a = ask(cmd);
    assert.equal(a && a.kind, "link", cmd);
    assert.match(a.paths[0], /which leads to \/tmp\/elsewhere/);
  }
  assert.equal(ask("Set-Content -Path lnk_out/n.txt -Value x", { allowed: () => true }), null, "an Edit allow rule opens it");
  const h = ask("Set-Content -Path lnk_h/pre-push -Value x");
  assert.deepEqual([h.kind, h.viaLink, h.paths[0]], ["protected", true, "lnk_h/pre-push (which leads to .husky/pre-push)"]);
  // Named directly, as before: protected, no link.
  const d = ask("Set-Content -Path .husky/pre-push -Value x");
  assert.deepEqual([d.kind, d.viaLink], ["protected", undefined]);
  assert.equal(ask("Set-Content -Path src/a.txt -Value x"), null);
});
