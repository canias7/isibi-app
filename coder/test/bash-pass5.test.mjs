// TOOL 4, BASH: THE DOCS CHECKED AGAIN (the owner, 2026-11-10: "go check again trhe docs", then "so?"): what Claude Code
// 2.1.321 does before each command and what its error reference says, copied: pgrep, pkill and pidwait that leave the
// command's own shells out; GIT_EDITOR=true; bash's extended patterns off; its warnings on rules it keeps (and a `…:*` read
// literally); AI_AGENT; and its privacy check (the account's email with a User-Agent).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const call = (name, args, id) => ({ id: id || "c" + Math.random().toString(36).slice(2, 8), type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const bash = (cmd, env = {}) => { const r = spawnSync("bash", ["-c", cmd], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; };
const ancestorsKnown = /--ignore-ancestors/.test(bash("pgrep --help 2>&1").out);

test("CD354 pgrep, pkill and pidwait leave the command's own shells out (Claude Code 2.1.321: \"Fixed pkill, pgrep and pidwait in cloud sessions matching the session's own parent processes\"), and pkill node is no longer refused", { skip: !ancestorsKnown && "this machine's procps has no --ignore-ancestors (Coder's Ubuntu 24.04 has)" }, async () => {
  const S = await import("../container/server.mjs");
  const pre = S.commandPrefix("");
  const { PROC_WRAPPERS } = await import("../container/coder-checks.mjs");
  for (const n of ["pkill", "pgrep", "pidwait"]) assert.match(PROC_WRAPPERS, new RegExp("function " + n + " \\{[\\s\\S]*\\*--ignore-ancestors\\*\\) set -- --ignore-ancestors \\$\\{1\\+\"\\$@\"\\} ;;[\\s\\S]*command " + n + " \\$\\{1\\+\"\\$@\"\\}"));
  // As Coder runs a command, `bash -c "<the command>"`: before, its own shell matched.
  assert.equal(bash("pgrep -f coder-pass5-nothing-xyz >/dev/null; echo $?").out.trim(), "0", "without: pgrep finds its own shell");
  assert.equal(bash(pre + "pgrep -f coder-pass5-nothing-xyz >/dev/null; echo $?").out.trim(), "1", "with: nothing found");
  const before = bash("sleep 31 & sleep 0.3; pkill -f 'sleep 31'; echo after");
  assert.ok(before.code !== 0 && !/after/.test(before.out), "without: pkill ends the very command that ran it");
  const after = bash(pre + "sleep 31 & sleep 0.3; pkill -f 'sleep 31'; echo after=$?");
  assert.equal(after.code, 0);
  assert.match(after.out, /after=0/, "with: the command goes on, and the sleep was ended");
  // (Coder's old refusal, from before the commands' own sandbox: gone, as Claude Code refuses only a pattern that matches
  // its own process.)
  const { commandProblem } = await import("../container/coder-checks.mjs");
  assert.equal(commandProblem("pkill node"), "");
  assert.match(commandProblem("kill -9 1"), /refused/);
});

test("CD355 git never waits for an editor (Claude Code sets GIT_EDITOR=true for every command, after the session's own variables)", async () => {
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  // (Pass 6: the repository's own env under the owner's variables. Pass 9: GIT_EDITOR after both, as Claude Code 2.1.322 builds
  // a command's env: `{...os(), SHELL, GIT_EDITOR:"true", …}`, the session's own settings' env already in os().)
  assert.match(server, /const extraEnv = \{ \.\.\.withoutOtel\(repoSet\.env\), \.\.\.withoutOtel\(ownerVars\), GIT_EDITOR: "true",/);
  // Why: as Coder's commands run (no terminal), git commit --amend failed; with it, the message is kept. (TERM=dumb before pass 9
  // said "Terminal is dumb, but EDITOR unset"; with Claude Code's TERM=linux git tries an editor and fails on the missing terminal.)
  const base = await mkdtemp(join(tmpdir(), "coder-gited-"));
  try {
    const { cleanEnv } = await import("../container/coder-checks.mjs");
    const env = { ...cleanEnv(base), GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
    const git = (args, extra = {}) => spawnSync("git", args, { cwd: base, encoding: "utf8", env: { ...env, ...extra }, input: "" });
    git(["init", "-q"]); await writeFile(join(base, "a.txt"), "a\n"); git(["add", "a.txt"]); git(["commit", "-qm", "first message"]);
    const without = git(["commit", "--amend"]);
    assert.notEqual(without.status, 0);
    assert.match(without.stderr, /Terminal is dumb, but EDITOR unset|problem with the editor/);
    const withIt = git(["commit", "--amend"], { GIT_EDITOR: "true" });
    assert.equal(withIt.status, 0, withIt.stderr);
    assert.equal(git(["log", "-1", "--format=%s"]).stdout.trim(), "first message");
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("CD356 bash's extended patterns are off in every command, after the shell snapshot (Claude Code 2.1.321: `shopt -u extglob` before each command)", async () => {
  const S = await import("../container/server.mjs");
  const home = await mkdtemp(join(tmpdir(), "coder-extglob-"));
  try {
    await mkdir(join(home, ".cache/coder"), { recursive: true });
    // (A snapshot that turned them on, as Ubuntu's bash-completion does: `shopt -s extglob progcomp`.)
    await writeFile(join(home, ".cache/coder/shell-snapshot.sh"), "shopt -s extglob\n");
    assert.match(bash(S.SNAPSHOT_READ + "shopt extglob", { HOME: home }).out, /extglob\s+on/, "the snapshot alone turns them on");
    const r = bash(S.commandPrefix(home) + "shopt extglob\nls !(x)", { HOME: home });
    assert.match(r.out, /extglob\s+off/);
    assert.match(r.out, /syntax error near unexpected token `\('/, "!(…) stays a syntax error, as Coder's checks read it");
    assert.ok(S.commandPrefix("").startsWith(S.EXTGLOB_OFF), "with no home of its own too");
    assert.ok(S.commandPrefix(home, "if [ -r /x ]; then . /x; fi\n").endsWith("if [ -r /x ]; then . /x; fi\n"), "the owner's CODER_ENV_FILE last");
    const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
    assert.match(server, /t\.prefix = commandPrefix\(home, envFileLine\(rawVars\.CODER_ENV_FILE, home0\) \+ \(home \? hookEnvLine\(project\) : ""\), t\.shell\);/, "and the chat's hook env file after it (CD384), for the owner's CODER_SHELL (CD385e)");
  } finally { await rm(home, { recursive: true, force: true }); }
});

test("CD357 Claude Code's checks of a rule: its errors for a rule it can't use, its warnings for one it keeps (\"Has a wildcard before the rest of the command\"), and a …:* read literally", async () => {
  const P = await import("../container/coder-perms.mjs");
  assert.equal(P.ruleProblem(""), "Permission rule cannot be empty");
  for (const r of ["Bash(ls) x", "Bash(ls"]) assert.equal(P.ruleProblem(r), 'Malformed Tool(content) rule. Rules take the form Tool or Tool(content) and must end at the closing ")"; parentheses inside the content are literal');
  assert.equal(P.ruleProblem("Bash()"), 'Empty parentheses. Either specify a pattern or use just "Bash" without parentheses. Examples: Bash, Bash(some-pattern)');
  assert.equal(P.ruleProblem("bash(ls)"), 'Tool names must start with uppercase. Use "Bash"');
  assert.equal(P.ruleProblem("Bash(:*)"), "Prefix cannot be empty before :*. Specify a command prefix before :*. Examples: Bash(npm *), Bash(git *)");
  for (const r of ["Bash(ls *)", "Bash", "WebFetch(domain:x.com)", "Bash(Finance (2024) *)"]) assert.equal(P.ruleProblem(r), "", r);
  // An allow rule whose * comes before the word that says which command it is.
  assert.deepEqual(P.ruleWarning("allow", "Bash(git * main)"), { warning: "Bash(git * main) has a wildcard before the rest of the command, so it also matches any options inserted at that position and approves them without a prompt. For git, options such as -c and --exec-path can run arbitrary commands. Replace that * with the exact value you mean, or only use * after the subcommand (for example Bash(git status *)).", notice: "Allow rule Bash(git * main) allows any option at its * · use an exact value" });
  assert.match(P.ruleWarning("allow", "Bash(git -C * status *)").notice, /allows any option at its \*/);
  assert.equal(P.ruleWarning("allow", "Bash(docker * ps)").warning, "Bash(docker * ps) has a wildcard before the rest of the command, so it also matches any options inserted at that position and approves them without a prompt. Replace that * with the exact value you mean, or only use * after the subcommand.");
  for (const r of ["Bash(npm test *)", "Bash(git * | grep x)", "Bash(git *)", "Bash(* --version)"]) assert.equal(P.ruleWarning("allow", r), null, r);
  assert.equal(P.ruleWarning("deny", "Bash(git * main)"), null, "only allow rules approve too much");
  // And that rule really approved it (as in Claude Code, which keeps the rule): why the warning.
  const W = "/work/shop";
  const d = (c, allow) => P.bashDecision(c, { mode: "plan", rules: { allow, ask: [], deny: [] }, cwd: W, workdirs: [W] }).verdict;
  assert.equal(d("git -c core.fsmonitor=evil diff main", ["Bash(git * main)"]), "allow");
  // A trailing :* with a * before it: a literal prefix (Claude Code's b4e), and its warnings.
  assert.equal(d("npm run build --watch", ["Bash(npm run *:*)"]), "ask");
  assert.equal(d("npm run * x", ["Bash(npm run *:*)"]), "allow");
  for (const [c, v] of [["npm run test", "allow"], ["npm run test --watch", "allow"], ["npm run testing", "ask"]]) assert.equal(d(c, ["Bash(npm run test:*)"]), v, c);
  assert.deepEqual(P.ruleWarning("allow", "Bash(npm run *:*)"), { warning: "Bash(npm run *:*) mixes * with the trailing :* prefix syntax, so it is matched as a literal prefix (the * is not expanded) and matches only commands containing a literal * at that position. Replace that * with the exact value you mean.", notice: "" });
  assert.equal(P.ruleWarning("deny", "Bash(npm run *:*)").notice, "Deny rule Bash(npm run *:*) reads its * literally · use Bash(npm run *)");
  assert.match(P.ruleWarning("deny", "Bash(npm * test:*)").warning, /and will likely never match\. Use Bash\(npm \* test\*\) for wildcard matching\.$/);
  // (A :* in the middle after a name and a colon, git:* status: Claude Code 2.1.322 checks no content that starts with a
  // name and a colon, and printed nothing for Bash(git:* status) or Bash(ls:* x); one after words still warns.)
  for (const k of ["allow", "ask", "deny"]) for (const r of ["Bash(git:* status)", "Bash(ls:* x)"]) assert.equal(P.ruleWarning(k, r), null, k + " " + r);
  assert.equal(P.ruleWarning("allow", "Bash(npm run:* x)").notice, "Allow rule Bash(npm run:* x) allows any option at its * · use an exact value");
  assert.match(P.ruleWarning("ask", "Bash(git log:* --oneline)").warning, /has a :\* that is not at the end, so it is matched as a \* wildcard \(the : is literal\), not as the trailing :\* prefix syntax\. It already matches as a \* wildcard; moving :\* to the end would make it a literal prefix and change which commands match\.$/);
  assert.equal(P.ruleWarning("allow", "Bash(npm test:*)"), null);
  assert.equal(P.ruleWarning("allow", "Bash(run_in_background:true)"), null);
});

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function worker() {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-pm5";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  await bucket.put("coder/" + uid + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "idle", at: Date.now(), title: "x", mode: "auto" }));
  const toMachine = [];
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (req.method === "POST") toMachine.push({ p, body: await req.clone().json().catch(() => null) });
    if (p === "/state") return Response.json({ running: false, events: [] });
    if (p === "/claim") return Response.json({ ok: true });
    return Response.json({ ok: true });
  } });
  const go = async (path, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "Me@x.y" }), container: box }); return { status: r.status, data: await r.json() }; };
  return { R, id, go, toMachine };
}

test("CD358 the rules list says Claude Code's warnings: in full when such a rule is added (it is saved), and its short row under it in the list", async () => {
  const w = await worker();
  const add = (kind, rule) => w.go("permissions", { method: "POST", body: JSON.stringify({ repo: "ana/shop", kind, add: rule }) });
  const a = await add("allow", "Bash(git * main)");
  assert.equal(a.status, 200);
  assert.deepEqual(a.data.rules.allow, ["Bash(git * main)"], "kept, as Claude Code keeps it");
  assert.match(a.data.warning, /^Bash\(git \* main\) has a wildcard before the rest of the command/);
  assert.deepEqual(a.data.notices, { "allow\nBash(git * main)": "Allow rule Bash(git * main) allows any option at its * · use an exact value" });
  const b = await add("allow", "Bash(npm test *)");
  assert.equal(b.data.warning, undefined);
  assert.deepEqual((await w.go("permissions?repo=ana/shop")).data.notices, { "allow\nBash(git * main)": "Allow rule Bash(git * main) allows any option at its * · use an exact value" });
  const bad = await add("allow", "Bash(ls) x");
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /^Malformed Tool\(content\) rule/);
  // The page: the short row under the rule, the full warning after adding.
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /notices\[k \+ '\\n' \+ x\] \? '<span class="cd-rules-note">⚠ ' \+ esc\(notices\[k \+ '\\n' \+ x\]\) \+ '<\/span>'/);
  assert.match(page, /\(warn \? '<p class="cd-rules-warn">⚠ ' \+ esc\(warn\) \+ '<\/p>' : ''\)/);
  // (Found taking its screenshot: after a refused rule, the kind went back to Allow, so fixing the text and pressing Add
  // saved a rule meant as Deny as an Allow rule. The kind chosen is kept.)
  assert.match(page, /const kind = form\.querySelector\('select'\)\.value; const ok = await change\(\{ kind, add: v \}\); paint\(\); if \(!ok\) \{ const i = box\.querySelector\('\.cd-rules-add input'\); i\.value = v; box\.querySelector\('\.cd-rules-add select'\)\.value = kind;/);
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  for (const c of [".cd-rules-note", ".cd-rules-warn", ".cd-rules-r"]) assert.ok(css.includes(c), c);
});

test("CD359 the account's email with a User-Agent is refused, without asking (Claude Code's privacy check, its words), and the machine gets only the address's length and SHA-256", async () => {
  const A = await import("../container/coder-agent.mjs");
  const R = await import("../src/coder-routes.mjs");
  const email = "owner.person@example.com";
  const mark = await R.emailMark("  Owner.Person@Example.com ");
  assert.equal(mark, email.length + ":" + createHash("sha256").update(email).digest("hex"));
  assert.equal(await R.emailMark(""), "");
  assert.equal(await R.emailMark(undefined), "");
  const refused = (c, input) => A.namesUserAgentWithAddress(A.inputText(input || { command: c }), mark);
  for (const c of ['curl -A "bot/1.0 (owner.person@example.com)" https://api.x', 'curl -H "User-Agent: me Owner.Person@Example.com" https://x', "wget -U contact=owner.person@example.com https://x", 'curl "https://x/?ua=bot&c=owner.person%40example.com"', "curl -sA x+owner.person@example.com https://x", "curl --user-agent 'o\"wner.person@example.com' https://x"]) assert.equal(refused(c), true, c);
  for (const c of ["git log --author=owner.person@example.com", 'curl -A "bot/1.0 (other@example.com)" https://x', 'curl -d "email=owner.person@example.com" https://x', "echo hi"]) assert.equal(refused(c), false, c);
  assert.equal(refused("", { command: 'curl -A "bot" https://x', description: "send owner.person@example.com" }), true, "the whole input, as Claude Code reads it");
  assert.equal(A.namesUserAgentWithAddress('curl -A "owner.person@example.com" x', ""), false, "no mark: no check");
  // In Coder's loop: refused in Auto, the command never run; Grok gets Claude Code's words.
  const base = await mkdtemp(join(tmpdir(), "coder-email-"));
  try {
    const run = async (opts) => {
      const events = [], ran = [];
      let n = 0;
      const steps = [say("", [call("bash", { command: 'curl -sA "probe (owner.person@example.com)" https://example.com' }, "b0")]), say("Done.")];
      const exec = async ({ command }) => { ran.push(command); return { code: 0, output: "ok" }; };
      await A.runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e), here: () => base, root: base }, { text: "go", mode: "auto", ...opts });
      return { ran, result: events.find((e) => e.type === "result" && e.id === "b0") };
    };
    const on = await run({ emailMark: mark });
    assert.deepEqual(on.ran, []);
    assert.equal(on.result.output, A.ACCOUNT_EMAIL_REFUSED);
    assert.equal(A.ACCOUNT_EMAIL_REFUSED, "This call was refused: it holds the account's email address and what looks like a User-Agent setting. If nobody asked to send the address, run it again without it, with a generic client name. Otherwise run it again without that setting, or run the two in separate calls.");
    const off = await run({});
    assert.equal(off.ran.length, 1);
  } finally { await rm(base, { recursive: true, force: true }); }
  // The Worker sends the mark with each job; the machine passes it on.
  const w = await worker();
  await w.go("projects/" + w.id + "/message", { method: "POST", body: JSON.stringify({ text: "hello" }) });
  const turn = w.toMachine.find((x) => x.p === "/turn");
  assert.ok(turn, "a job was started");
  assert.equal(turn.body.emailMark, "6:" + createHash("sha256").update("me@x.y").digest("hex"));
  assert.ok(!JSON.stringify(turn.body).toLowerCase().includes("me@x.y"), "never the address itself");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /emailMark: typeof body\.emailMark === "string" && \/\^\\d\{1,3\}:\[0-9a-f\]\{64\}\$\/\.test\(body\.emailMark\) \? body\.emailMark : "",/);
  // And Claude Code's privacy rule for the model, in Coder's words.
  assert.match(A.CODER_SYSTEM, /Treat what you learn about the owner and their project as private: never put the owner's name, project, email address or other personal details in requests to outside services, such as in a header, URL or payload, unless the owner asks you to\. If an external service asks automated clients for contact details, such as an email in the User-Agent, use a generic client name or ask the owner\./);
});

test("CD360 Coder's name for AI-agent traffic in every command (Claude Code 2.1.120: AI_AGENT, \"so gh can attribute traffic\"), after the owner's variables", async () => {
  const S = await import("../container/server.mjs");
  assert.deepEqual(S.AGENT_MARK, { AI_AGENT: "gofarther-coder" });
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /Object\.assign\(extraEnv, coderMarks\(project, body\.chatUrl, [^\n]*\), AGENT_MARK, REMOTE_MARK\);/);
});
