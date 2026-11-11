// BASH DOCS PASS 8 (the owner, 2026-11-11: "go back to Claude Code docs and see if we're missing anything", then "Yes pls"
// to building all of it): what seven separate readings of Claude Code's docs and changelog found still missing, each test
// checked against Claude Code's own words (its docs, and its program, version 2.1.322).
import { test } from "node:test";
import assert from "node:assert/strict";

const P = await import("../container/coder-perms.mjs");
const B = await import("../container/coder-bashcheck.mjs");
const S = await import("../container/coder-shell.mjs");
const ROOT = "/work/shop";
const R = (k, list) => ({ allow: [], ask: [], deny: [], [k]: list });

test("CD408 the wrappers Claude Code looks past, by its own tables (its aer, ler, der, ier and CT): a deny rule on `git push` refuses it behind time -p, watch -d, flock -n, setsid -w, exec -a and the rest, and behind a path (/usr/bin/git); the risky-rm check sees through them; `command -v` and flagged xargs are matched as themselves", () => {
  const deny = R("deny", ["Bash(git push *)"]);
  const behind = [
    "git push origin main", "time git push", "time -p git push", "time -p -- git push", "nohup git push", "timeout 30 git push",
    "timeout -s KILL 30 git push", "timeout --signal=TERM 5m git push", "nice -n 5 git push", "nice -10 git push", "stdbuf -oL git push",
    "command git push", "builtin git push", "noglob git push", "watch -d git push", "watch -n 2 git push", "watch --interval 2 -d git push",
    "flock -n /tmp/l git push", "flock -w 5 /tmp/l git push", "flock /tmp/l -c 'git push'", "setsid -w git push", "setsid git push",
    "exec -a name git push", "chrt 5 git push", "chrt -p 5 git push", "taskset 0x3 git push", "taskset -c 1 git push",
    "ionice -c 2 -n 7 git push", "strace -o /tmp/t git push", "ltrace -o /tmp/t git push", "unshare -w /tmp git push",
    "nsenter -t 1 git push", "env -S 'git push'", "env FOO=1 git push", "sudo -u root git push", "doas -u root git push",
    "pkexec --user root git push", "xargs git push", "FOO=bar git push", "/usr/bin/git push origin main", "time -p watch -d nice -n 2 git push",
  ];
  for (const c of behind) for (const m of ["acceptEdits", "plan", "auto"]) assert.deepEqual([P.bashDecision(c, { mode: m, rules: deny }).verdict, P.bashDecision(c, { mode: m, rules: deny }).rule], ["deny", "Bash(git push *)"], c + " in " + m);
  // The wrapper form itself is matched too (Claude Code tries every form).
  assert.equal(P.bashDecision("watch -d git push", { mode: "auto", rules: R("deny", ["Bash(watch *)"]) }).verdict, "deny");
  assert.equal(P.bashDecision("timeout 30 make", { mode: "auto", rules: R("deny", ["Bash(timeout *)"]) }).verdict, "deny");
  // Ask rules the same.
  assert.equal(P.bashDecision("time -p git push", { mode: "auto", rules: R("ask", ["Bash(git push *)"]) }).byRule, true);
  // Not stripped: the query form `command -v` (it runs nothing). (xargs with settings: Claude Code matches it as an xargs
  // command; Coder's deny rules look inside it anyway, stricter, kept as the owner chose: "leave the deliberate ones".)
  assert.equal(P.bashDecision("command -v git", { mode: "auto", rules: R("deny", ["Bash(git *)"]) }).verdict, "allow");
  assert.equal(P.bashDecision("xargs -n1 git push", { mode: "auto", rules: deny }).verdict, "deny");
  // bash's `time` keyword takes -p: the command is what follows.
  assert.deepEqual(S.parseShell("time -p git status").commands[0].words.map((w) => w.text), ["git", "status"]);
  assert.equal(P.bashDecision("time -p git status", { mode: "plan", rules: R("allow", []) }).verdict, "allow", "read-only behind time -p");
  // The steps, first to last.
  const steps = S.unwrapSteps(S.parseShell("FOO=1 watch -d nice -n 2 git push").commands[0].words).map((s) => s.map((w) => w.text).join(" "));
  assert.equal(steps[0], "watch -d nice -n 2 git push");
  assert.ok(steps.includes("nice -n 2 git push"), JSON.stringify(steps));
  assert.equal(steps[steps.length - 1], "git push");
  assert.equal(S.unwrapped(S.parseShell("FOO=1 watch -d nice -n 2 git push").commands[0].words).map((w) => w.text).join(" "), "git push");
  assert.equal(S.progName("/usr/bin/git.exe"), "git");
  // The risky-rm check sees through them (pass 8: `time -p rm -rf /` passed it).
  for (const c of ["time -p rm -rf /", "watch -d rm -rf /", "flock -n /tmp/l rm -rf /", "setsid -w rm -rf ~", "exec -a x rm -rf /"]) assert.match(B.dangerousRm(c, { cwd: ROOT, home: "/home/dev", workdirs: [ROOT] }), /Dangerous rm operation/, c);
});

test("CD409 the variables a command sets, a cd in brackets, cp and mv into a folder or named by a path, and a wildcard in grep's pattern's place, for deny and ask rules (Claude Code 2.1.290, 2.1.309, 2.1.321, 2.1.271); git after a cd in brackets asks", () => {
  const at = (c, m, rules) => P.bashDecision(c, { mode: m, rules, cwd: ROOT, workdirs: [ROOT] });
  for (const m of ["acceptEdits", "plan", "auto"]) {
    // Variables set earlier in the same command (a deny or ask rule; the read for what runs untouched).
    assert.deepEqual([at("F=.env; cat $F", m, R("deny", ["Read(.env)"])).verdict, at("F=.env; cat \"$F\"", m, R("deny", ["Read(.env)"])).verdict], ["deny", "deny"], m);
    assert.equal(at("export F=.env && cat ${F}", m, R("deny", ["Read(.env)"])).verdict, "deny");
    assert.equal(at("declare D=config; cat $D/app.json", m, R("deny", ["Read(config/app.json)"])).verdict, "deny");
    assert.deepEqual([at("C=curl; $C https://x.example", m, R("deny", ["Bash(curl *)"])).verdict, at("C=curl; $C https://x.example", m, R("deny", ["Bash(curl *)"])).rule], ["deny", "Bash(curl *)"]);
    assert.equal(at("C=git; $C push origin main", m, R("ask", ["Bash(git push *)"])).byRule, true);
    // cp and mv: named by a path, into a folder, with -t.
    assert.equal(at("/bin/cp /tmp/x .env", m, R("deny", ["Edit(.env)"])).verdict, "deny");
    assert.equal(at("cp src/a.json config/", m, R("deny", ["Edit(config/a.json)"])).verdict, "deny");
    assert.equal(at("cp -t config /tmp/secrets.json", m, R("deny", ["Edit(config/secrets.json)"])).verdict, "deny");
    assert.equal(at("mv a.txt b.txt docs", m, R("deny", ["Edit(docs/b.txt)"])).verdict, "deny");
    // A cd in brackets stays there: the write is to .env.
    assert.equal(at("(cd src && echo x > ../.env)", m, R("deny", ["Edit(.env)"])).verdict, "deny");
    assert.equal(at("echo $(cd src && cat ../.env)", m, R("deny", ["Read(.env)"])).verdict, "deny");
    // A wildcard the shell expands, where grep's pattern is: files.
    assert.equal(at("grep -v secrets/* notes.txt", m, R("deny", ["Read(secrets/**)"])).verdict, "deny");
    assert.equal(at("grep -e secrets/* notes.txt", m, R("deny", ["Read(secrets/**)"])).verdict, "deny");
  }
  // Not a variable's value: one a loop, read or a command's output sets; one in single quotes; one set inside brackets.
  assert.notEqual(at("F=.env; for F in a b; do cat $F; done", "auto", R("deny", ["Read(.env)"])).verdict, "deny");
  assert.notEqual(at("F=.env; read F; cat $F", "auto", R("deny", ["Read(.env)"])).verdict, "deny");
  assert.notEqual(at("F=$(cat name); cat $F", "auto", R("deny", ["Read(.env)"])).verdict, "deny");
  assert.notEqual(at("F=.env; echo '$F'", "auto", R("deny", ["Read(.env)"])).verdict, "deny");
  assert.notEqual(at("(F=.env); cat $F", "auto", R("deny", ["Read(.env)"])).verdict, "deny");
  // What runs without asking is read as before (the variables are for deny and ask rules only).
  assert.equal(at("C=cat; $C notes.txt", "plan", R("allow", [])).verdict, "ask");
  // A quoted pattern stays a pattern.
  assert.equal(at("grep \"secrets/*\" notes.txt", "auto", R("deny", ["Read(secrets/**)"])).verdict, "allow");
  // git after a cd in brackets asks, and is no whole read-only command for Auto's checker; without the cd it runs.
  assert.equal(at("(cd src && git log)", "plan", R("allow", [])).verdict, "ask");
  assert.equal(at("git log", "plan", R("allow", [])).verdict, "allow");
  assert.deepEqual([P.wholeReadOnly("(cd src && git log)"), P.wholeReadOnly("cd src && git log"), P.wholeReadOnly("git log"), P.wholeReadOnly("cd src && ls")], [false, false, true, true]);
});

test("CD410 the gate refuses a local address in every network setting, Full too, and one written as numbers, in Claude Code's words (its sandbox proxy: \"Connection to myapp.test blocked: resolved to a loopback address\"); the command's note names why", async () => {
  const net = await import("node:net");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const X = await import("../container/coder-proxy.mjs");
  assert.deepEqual(["127.0.0.1", "::1", "169.254.169.254", "10.1.2.3", "fdaa::3", "8.8.8.8"].map(X.localKind), ["loopback", "loopback", "link-local", "private", "private", ""]);
  assert.equal(X.LOCAL_REFUSED("myapp.test", "loopback"), "Connection to myapp.test blocked: resolved to a loopback address");
  const ask = (px, text) => new Promise((ok) => {
    let b = "";
    const s = net.connect(px.port, "127.0.0.1", () => s.write(text));
    const done = () => { clearTimeout(timer); s.destroy(); ok(b); };
    const timer = setTimeout(done, 8000);
    s.on("data", (x) => { b += x; if (/^HTTP\/1\.1 200 Connection Established\r\n\r\n/.test(b)) done(); });
    s.on("close", done); s.on("error", done);
  });
  const px = await X.startProxy({ dir: join(await mkdtemp(join(tmpdir(), "coder-p8-")), "px") });
  try {
    // Full: every local address, by name or by number.
    px.setNetwork({ mode: "full" });
    const t0 = Date.now();
    const a = await ask(px, "CONNECT 127.0.0.1:8080 HTTP/1.1\r\nHost: x\r\n\r\n");
    assert.match(a, /^HTTP\/1\.1 403 Forbidden/);
    assert.match(a, /Connection to 127\.0\.0\.1 blocked: resolved to a loopback address$/);
    assert.match(await ask(px, "CONNECT localhost:8080 HTTP/1.1\r\nHost: x\r\n\r\n"), /^HTTP\/1\.1 403 Forbidden[\s\S]*Connection to localhost blocked: resolved to a loopback address$/);
    assert.match(await ask(px, "GET http://169.254.169.254/latest/meta-data HTTP/1.1\r\nHost: 169.254.169.254\r\nConnection: close\r\n\r\n"), /^HTTP\/1\.1 403[\s\S]*Connection to 169\.254\.169\.254 blocked: resolved to a link-local address$/);
    assert.match(await ask(px, "CONNECT [::1]:8080 HTTP/1.1\r\nHost: x\r\n\r\n"), /^HTTP\/1\.1 40[03]/);
    const seen = px.blockedSince(t0);
    assert.ok(seen.some((x) => x.host === "127.0.0.1" && x.why === "resolved to a loopback address"), JSON.stringify(seen));
    assert.match(X.blockedNote(seen), /127\.0\.0\.1 \(resolved to a loopback address\)/);
    // Limited settings: refused too (localhost can't even be put on the list).
    px.setNetwork({ mode: "custom", hosts: ["localhost"] });
    assert.match(await ask(px, "CONNECT localhost:8080 HTTP/1.1\r\nHost: x\r\n\r\n"), /^HTTP\/1\.1 403 Forbidden/);
  } finally { px.close && px.close(); }
});

test("CD411 Accept edits is Claude Code's cloud \"default\" for commands (its permission-modes docs: \"Accept edits corresponds to `default` mode: cloud sessions pre-approve file edits regardless of mode … Cloud sessions still honor `defaultMode: \\\"acceptEdits\\\"` from settings\"): a command that changes files asks, unless the repository's settings say acceptEdits; their defaultMode \"plan\" starts a new chat in Plan, \"auto\" is not taken from a project", async () => {
  const at = (c, extra = {}, rules = R("allow", [])) => P.bashDecision(c, { mode: "acceptEdits", rules, cwd: ROOT, workdirs: [ROOT], ...extra });
  for (const c of ["mkdir build", "touch notes.md", "rm old.txt", "rmdir empty", "cp a.txt b.txt", "mv a.txt b.txt", "sed -i 's/a/b/' x.txt", "echo hi > notes.md"]) {
    assert.equal(at(c, { byCommand: false }).verdict, "ask", c + ": cloud default");
    assert.equal(at(c).verdict, "allow", c + ": the repository's acceptEdits");
  }
  assert.equal(at("echo hi | tee notes.md", { byCommand: false }).verdict, "ask", "tee: asked either way (no file command of acceptEdits)");
  for (const c of ["ls", "git status", "cat README.md", "grep -r TODO ."]) assert.equal(at(c, { byCommand: false }).verdict, "allow", c + ": only reads");
  // (A redirection inside the project asks in Claude Code's "default" whatever rule matches, its RZt: "… needs approval. The
  // path is inside the working directories for this session …"; Bash docs pass 9, pass 8 had let Bash(echo *) approve it.)
  assert.deepEqual([at("echo hi > notes.md", { byCommand: false }, R("allow", ["Bash(echo *)"])).verdict, at("echo hi > notes.md", { byCommand: false }, R("allow", ["Bash(echo *)"])).why], ["ask", "Output redirection to '" + ROOT + "/notes.md' needs approval. The path is inside the working directories for this session ('" + ROOT + "'), and Coder asks before a shell command creates, changes or removes files there."]);
  assert.equal(at("mkdir build", { byCommand: false }, R("allow", ["Bash(mkdir *)"])).verdict, "allow");
  assert.equal(P.bashDecision("mkdir build", { mode: "plan", rules: R("allow", []), cwd: ROOT, workdirs: [ROOT], byCommand: false }).verdict, "ask", "Plan as before");
  // PowerShell's file commands the same.
  const { fakeParse } = await import("./ps-fake.mjs");
  const ps = (c, byCommand) => P.psDecision(c, { mode: "acceptEdits", rules: R("allow", []), parsed: fakeParse(c), cwd: ROOT, pathAbs: (x) => ROOT + "/" + x, inside: () => true, byCommand });
  assert.deepEqual([ps("Set-Content notes.txt hi", false).verdict, ps("Set-Content notes.txt hi", true).verdict], ["ask", "allow"]);
  // What Coder is told.
  const A = await import("../container/coder-agent.mjs");
  assert.match(A.modeSystem("acceptEdits", { fileEdits: false }), /your file edits in the project run without asking; a command that changes files \(mkdir, touch, rm, mv, cp, sed -i, a > redirect and the like\), any other command that is not read-only/);
  assert.match(A.modeSystem("acceptEdits"), /your file edits and file commands in the project \(mkdir, touch, rm, mv, cp, sed -i\) run without asking/);
  // The repository's defaultMode.
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const SV = await import("../container/server.mjs");
  const repo = (mode) => { const d = mkdtempSync(join(tmpdir(), "coder-p8dm-")); mkdirSync(join(d, ".claude")); writeFileSync(join(d, ".claude", "settings.json"), JSON.stringify({ permissions: { defaultMode: mode } })); return d; };
  assert.deepEqual(["acceptEdits", "plan", "default", "auto", "bypassPermissions", "dontAsk"].map((m) => SV.repoSettings(repo(m)).defaultMode), ["acceptEdits", "plan", "default", "", "", ""]);
  const src = (await import("node:fs")).readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /fileEdits: repoSet\.defaultMode === "acceptEdits", startMode: repoSet\.defaultMode/);
  // "plan" from the repository: a new chat starts in Plan; not a chat that has messages.
  const run = async (messages) => {
    const events = [], modes = [];
    await A.runCoder({ send: async () => ({ message: { role: "assistant", content: "ok" }, usage: { in: 1, out: 1 } }), exec: async () => ({ code: 0, out: "" }), emit: (e) => events.push(e), setMode: (m) => modes.push(m), root: ROOT }, { text: "hi", messages, mode: "acceptEdits", startMode: "plan" });
    return { events, modes };
  };
  const first = await run([]);
  assert.deepEqual(first.modes, ["plan"]);
  assert.ok(first.events.some((e) => e.type === "mode" && e.mode === "plan" && e.by === "settings"));
  assert.ok(first.events.some((e) => e.type === "note" && /start chats in Plan mode/.test(e.text)));
  assert.deepEqual((await run([{ role: "user", content: "earlier" }, { role: "assistant", content: "ok" }])).modes, []);
  assert.match((await import("node:fs")).readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), /e\.by === "autoOff" \|\| e\.by === "settings"/);
});

test("CD412 a chat's background commands keep its saved keys and `gh` after its job ends (Claude Code: a saved key \"applies in every session that runs in the environment … until you delete it\"), and a network change reaches them; GitHub Actions logs come through their redirect (Claude Code 2.1.318)", async () => {
  const { handleEgress, egressPass, LOG_PATH, LOG_HOSTS } = await import("../src/coder-egress.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_BUCKET: bucket };
  const UID = "user-1234567890abcdef", ID = "shop-p8a1";
  await saveConnection(env, bucket, UID, { access: "ghu_owner_login" }, "ana");
  const setMeta = (o = {}) => bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, repo: "ana/shop", status: "running", turn: 4, ...o }));
  const sent = [];
  let reply = () => new Response("{\"ok\":1}", { status: 200, headers: { "content-type": "application/json" } });
  const fetchFn = async (url, init = {}) => { sent.push({ url: String(url), auth: init.headers && init.headers.authorization }); return reply(String(url)); };
  const pass = await egressPass(env, UID + "/" + ID, "4");
  const call = (url) => handleEgress(new Request("https://gofarther.dev/api/coder/egress", { method: "POST", headers: { "x-coder-chat": UID + "/" + ID, "x-coder-turn": "4", "x-coder-egress": pass, "x-coder-url": url, "x-coder-method": "GET" } }), env, { fetchFn });
  // After the job: refused with nothing left running, let through while a background command runs (that chat's last job only).
  await setMeta({ status: "done" });
  let r = await call("https://api.github.com/repos/ana/shop/pulls");
  assert.deepEqual([r.status, await r.text()], [403, "that job is not running"]);
  await setMeta({ status: "done", background: [{ id: "b1", command: "npm run dev" }] });
  r = await call("https://api.github.com/repos/ana/shop/pulls");
  assert.equal(r.status, 200);
  await setMeta({ status: "done", turn: 5, background: [{ id: "b1", command: "npm run dev" }] });
  assert.equal((await call("https://api.github.com/repos/ana/shop/pulls")).status, 403, "an older job's pass");
  // Actions logs: GitHub's redirect to its log storage is followed here, without the login.
  await setMeta();
  assert.ok(LOG_PATH.test("/repos/ana/shop/actions/runs/12/logs") && LOG_PATH.test("/repos/ana/shop/actions/jobs/34/logs") && LOG_PATH.test("/repos/ana/shop/actions/runs/12/attempts/2/logs"));
  assert.ok(LOG_HOSTS.test("pipelines.actions.githubusercontent.com") && LOG_HOSTS.test("productionresultssa1.blob.core.windows.net") && !LOG_HOSTS.test("evil.example.com"));
  reply = (u) => u.startsWith("https://api.github.com/") ? new Response(null, { status: 302, headers: { location: "https://pipelines.actions.githubusercontent.com/logs/34?sig=abc" } }) : new Response("2026-11-11 step 1 ok\nerror: test failed\n", { status: 200, headers: { "content-type": "text/plain" } });
  sent.length = 0;
  r = await call("https://api.github.com/repos/ana/shop/actions/jobs/34/logs");
  assert.deepEqual([r.status, await r.text()], [200, "2026-11-11 step 1 ok\nerror: test failed\n"]);
  assert.deepEqual(sent.map((x) => [x.url, x.auth]), [["https://api.github.com/repos/ana/shop/actions/jobs/34/logs", "Bearer ghu_owner_login"], ["https://pipelines.actions.githubusercontent.com/logs/34?sig=abc", undefined]]);
  // Not followed: another host, or another path.
  reply = () => new Response(null, { status: 302, headers: { location: "https://evil.example.com/x" } });
  assert.equal((await call("https://api.github.com/repos/ana/shop/actions/jobs/34/logs")).status, 302);
  assert.equal((await call("https://api.github.com/repos/ana/shop/pulls")).status, 302);
  // A network change reaches a chat whose background commands run (the machine, and the Worker's list of chats to tell).
  const fs = await import("node:fs");
  assert.match(fs.readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8"), /const bgRunning = \[\.\.\.JOBS\.values\(\)\]\.some\(\(j\) => j\.project === project && !j\.end\);\n\s+if \(!t \|\| \(!t\.running && !bgRunning\)\) return send\(200, \{ ok: true, applied: false \}\);/);
  assert.match(fs.readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), /if \(!m \|\| \(m\.status !== "running" && !bgOn\) \|\|/);
});

test("CD413 an idle chat is woken at once when a background command of its ends or a monitor of its prints (Claude Code's tools reference: \"You keep working in the same session and Claude interjects when an event arrives\"), not at the next minute: its machine asks Coder's server with the chat's last job's pass, once for each new piece of news", async () => {
  const W = await import("../src/coder-watch.mjs");
  const { egressPass } = await import("../src/coder-egress.mjs");
  const S8 = await import("../container/server.mjs");
  assert.equal(W.WAKE_PATH, "/api/coder/wake");
  assert.equal(S8.WAKE_PATH, W.WAKE_PATH, "the same path on both sides");
  // THE WORKER: only the chat's last job's pass, the job not running; then the every-minute look's own check, for that chat.
  const m = new Map();
  const bucket = { async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 9).toString("base64"), CODER_BUCKET: bucket };
  const UID = "user-1234567890abcdef", ID = "shop-p8w1", now = 50_000_000;
  const setMeta = (o = {}) => bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, status: "done", turn: 4, ...o }));
  await setMeta();
  await W.watchBackground(bucket, { uid: UID, email: "me@x.y", id: ID }, now - 60_000);
  let machine = { ok: true, background: [{ id: "b1" }], untold: 1, hooks: 0, running: false };
  const calls = [];
  const coder = async (req, user) => {
    const u = new URL(req.url);
    calls.push([req.method, u.pathname, user.id, req.method === "POST" ? await req.json() : null]);
    if (u.pathname.endsWith("/background")) return Response.json(machine);
    return Response.json({ ok: true });
  };
  const wake = async ({ turn = "4", pass, method = "POST" } = {}) => {
    const p = pass === undefined ? await egressPass(env, UID + "/" + ID, turn) : pass;
    const r = await W.handleWake(new Request("https://gofarther.dev/api/coder/wake", { method, headers: { "x-coder-chat": UID + "/" + ID, "x-coder-turn": turn, "x-coder-egress": p } }), env, { coder }, { now });
    return [r.status, await r.json()];
  };
  assert.equal((await wake({ method: "GET" }))[0], 405);
  assert.deepEqual(await wake({ pass: "x".repeat(43) }), [403, { ok: false, error: "not this job's pass" }]);
  assert.deepEqual(await wake({ pass: "" }), [403, { ok: false, error: "not this job's pass" }]);
  assert.deepEqual(await wake({ turn: "3" }), [403, { ok: false, error: "not the chat's last job" }], "an older job's pass");
  await setMeta({ status: "running" });
  assert.deepEqual(await wake(), [409, { ok: false, error: "a job is running" }], "a running job is told by its own loop");
  assert.equal(calls.length, 0, "none of them reached the chat");
  await setMeta();
  assert.deepEqual(await wake(), [200, { ok: true, checked: 1, woken: 1, left: 0 }]);
  assert.deepEqual(calls, [["GET", "/api/coder/projects/" + ID + "/background", UID, null], ["POST", "/api/coder/projects/" + ID + "/message", UID, { fromBackground: true }]], "the turn that tells Coder, as the owner");
  // Nothing new: the chat is looked at and left alone; nothing running and nothing to tell: off the list, as every minute.
  calls.length = 0;
  machine = { ok: true, background: [{ id: "b1" }], untold: 0, hooks: 0, running: false };
  assert.deepEqual(await wake(), [200, { ok: true, checked: 1, woken: 0, left: 0 }]);
  machine = { ok: true, background: [], untold: 0, hooks: 0, running: false };
  assert.deepEqual(await wake(), [200, { ok: true, checked: 1, woken: 0, left: 1 }]);
  assert.equal(m.has(W.bgKey(UID, ID)), false);
  // The every-minute look still counts the same way (its check is now shared).
  await W.watchBackground(bucket, { uid: UID, email: "me@x.y", id: ID }, now - 60_000);
  machine = { ok: true, background: [{ id: "b1" }], untold: 1, hooks: 0, running: false };
  assert.deepEqual(await W.runBackgroundJobs(env, { coder }, now), { checked: 1, woken: 1, left: 0 });
  // THE MACHINE: the pass of the chat's last job, kept when it started; a request when news comes and the chat has no job.
  const P8 = "shop-p8m1", PID = 990_413;
  S8.noteWake(P8, { url: "https://gofarther.dev/api/coder/egress", chat: "u/" + P8, turn: 4 });
  assert.equal(S8.WAKES.has(P8), false, "no pass, no wake");
  S8.noteWake(P8, { url: "https://gofarther.dev/api/coder/egress", chat: "u/" + P8, turn: 4, pass: "pass-4" });
  const sent = [];
  let status = 409;
  const fetchFn = async (url, init) => { sent.push({ url, chat: init.headers["x-coder-chat"], turn: init.headers["x-coder-turn"], pass: init.headers["x-coder-egress"], method: init.method }); return { status }; };
  const idle = new Map();
  const look = async (at, turnsOf = idle) => { await Promise.all(S8.wakeIdle(fetchFn, { now: at, turnsOf })); return sent.length; };
  try {
    assert.equal(await look(now), 0, "no news, no request");
    S8.JOBS.set(PID, { project: P8, id: "job7", pid: PID, end: { code: 0, why: "exit", at: now }, told: false });
    assert.equal(await look(now, new Map([[P8, { running: true }]])), 0, "a job running here is told by its own loop");
    assert.equal(await look(now), 1);
    assert.deepEqual(sent[0], { url: "https://gofarther.dev/api/coder/wake", chat: "u/" + P8, turn: "4", pass: "pass-4", method: "POST" });
    assert.equal(await look(now + 1000), 1, "not again within " + S8.WAKE_GAP_MS + " ms");
    assert.equal(await look(now + S8.WAKE_GAP_MS), 2, "the server said its job had not ended yet (409): tried again");
    status = 200;
    assert.equal(await look(now + 2 * S8.WAKE_GAP_MS), 3);
    assert.equal(await look(now + 3 * S8.WAKE_GAP_MS), 3, "told: not again for the same news");
    // A monitor's new lines are new news.
    S8.JOBS.set(PID + 1, { project: P8, id: "mon2", pid: PID + 1, monitor: true, end: null, readAt: 120, pending: ["ERROR: build failed"] });
    assert.equal(await look(now + 4 * S8.WAKE_GAP_MS), 4);
    S8.JOBS.get(PID + 1).readAt = 240;
    S8.JOBS.get(PID + 1).pending.push("ERROR: again");
    assert.equal(await look(now + 5 * S8.WAKE_GAP_MS), 5);
    // A server that never says yes: WAKE_TRIES tries for the same news, then the every-minute look's turn.
    status = 503;
    S8.JOBS.get(PID + 1).readAt = 300;
    let at = now + 6 * S8.WAKE_GAP_MS;
    for (let i = 0; i < S8.WAKE_TRIES + 3; i++, at += S8.WAKE_GAP_MS) await look(at);
    assert.equal(sent.length, 5 + S8.WAKE_TRIES);
    // A failed request counts as a try, and never throws.
    S8.JOBS.get(PID + 1).readAt = 360;
    const before = sent.length;
    await Promise.all(S8.wakeIdle(async () => { throw new Error("offline"); }, { now: at, turnsOf: idle }));
    assert.equal(sent.length, before);
    // A newer job's pass replaces the old one.
    S8.noteWake(P8, { url: "https://gofarther.dev/api/coder/egress", chat: "u/" + P8, turn: 5, pass: "pass-5" });
    status = 200;
    S8.JOBS.get(PID + 1).readAt = 420;
    await look(at + S8.WAKE_GAP_MS);
    assert.deepEqual([sent.at(-1).turn, sent.at(-1).pass], ["5", "pass-5"]);
  } finally {
    S8.JOBS.delete(PID);
    S8.JOBS.delete(PID + 1);
    S8.WAKES.delete(P8);
  }
  // WIRED: the machine keeps each job's pass and looks every few seconds (the real machine only); the Worker's route.
  const fs = await import("node:fs");
  const server = fs.readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const fail = \(status, why\) => \{[^\n]*\n\s+\/\/ \(This job's pass, for the chat's wake once it has ended: wakeIdle\.\)\n\s+noteWake\(project, body\.egress\);/);
  assert.match(server, /const jobTimer = setInterval\(\(\) => \{ try \{ checkJobs\(\); \} catch \{ \/\* next time \*\/ \} try \{ if \(liveFetch\) wakeIdle\(liveFetch\); \} catch \{ \/\* next time \*\/ \} \}, JOB_CHECK_MS\);/);
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /\} else if \(url\.pathname === WAKE_PATH && env\.CODER_ON === "on"\) \{[\s\S]{0,400}res = await handleWake\(request, env, \{ coder \}\);/);
  assert.ok(worker.indexOf("url.pathname === WAKE_PATH") < worker.indexOf('url.pathname.startsWith("/api/coder/")'), "before the signed-in routes");
});

test("CD414 a repository's .claude/settings.json sets Coder's own command settings by Claude Code's names (its env: \"timeouts and limits, and feature toggles: at startup from every settings file\"; its bashOutputMaxChars, defaultShell and respondToBashCommands keys from \"Any file\"), under the owner's own (Claude Code: the launch environment \"takes precedence instead\")", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const SV = await import("../container/server.mjs");
  const d = mkdtempSync(join(tmpdir(), "coder-p8own-"));
  mkdirSync(join(d, ".claude"));
  writeFileSync(join(d, ".claude", "settings.json"), JSON.stringify({
    env: { BASH_DEFAULT_TIMEOUT_MS: "300000", BASH_MAX_TIMEOUT_MS: 900000, BASH_MAX_OUTPUT_LENGTH: "50000", CLAUDE_CODE_USE_POWERSHELL_TOOL: "1", CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: true, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1", CLAUDE_CODE_TOOL_MEMORY_LIMIT: "4G", CLAUDE_ENV_FILE: ".venv/env.sh", CLAUDE_CODE_SHELL: "/bin/zsh", CODER_SHELL: "bash", CODER_DISABLE_SUBSTITUTION_RM_PROMPT: "1", FOO: "1" },
    bashOutputMaxChars: 64000, defaultShell: "powershell", respondToBashCommands: false,
  }));
  // A later file wins (settings.local.json over settings.json), as for the commands' env.
  writeFileSync(join(d, ".claude", "settings.local.json"), JSON.stringify({ env: { BASH_DEFAULT_TIMEOUT_MS: "240000" } }));
  const s = SV.repoSettings(d);
  assert.deepEqual(s.own, { BASH_DEFAULT_TIMEOUT_MS: "240000", BASH_MAX_TIMEOUT_MS: "900000", BASH_MAX_OUTPUT_LENGTH: "50000", CODER_USE_POWERSHELL_TOOL: "1", CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR: "true", CODER_DISABLE_BACKGROUND_TASKS: "1", CODER_TOOL_MEMORY_LIMIT: "4G", CODER_ENV_FILE: ".venv/env.sh", CODER_SHELL: "/bin/zsh", CODER_BASH_OUTPUT_MAX_CHARS: "64000", CODER_DEFAULT_SHELL: "powershell", CODER_RESPOND_TO_BASH_COMMANDS: "false" }, "Claude Code's names only: never Coder's own (CODER_SHELL, CODER_DISABLE_SUBSTITUTION_RM_PROMPT)");
  // The commands' env as before: Claude Code's names reach them, Coder's never.
  assert.deepEqual([s.env.FOO, s.env.BASH_DEFAULT_TIMEOUT_MS, s.env.CLAUDE_CODE_SHELL, s.env.CODER_SHELL, s.env.CODER_DISABLE_SUBSTITUTION_RM_PROMPT], ["1", "240000", "/bin/zsh", undefined, undefined]);
  assert.deepEqual(SV.repoSettings(d, { github: true }).own, {}, "nothing in a job from GitHub");
  // What Coder's settings read: the repository's under the owner's variables.
  const owner = { BASH_DEFAULT_TIMEOUT_MS: "60000", CODER_SHELL: "bash", CODER_RESPOND_TO_BASH_COMMANDS: "true" };
  const v = SV.withRepoOwn(owner, s.own);
  assert.deepEqual([v.BASH_DEFAULT_TIMEOUT_MS, v.CODER_SHELL, v.CODER_RESPOND_TO_BASH_COMMANDS, v.BASH_MAX_TIMEOUT_MS, v.CODER_DISABLE_BACKGROUND_TASKS], ["60000", "bash", "true", "900000", "1"]);
  assert.deepEqual(owner, { BASH_DEFAULT_TIMEOUT_MS: "60000", CODER_SHELL: "bash", CODER_RESPOND_TO_BASH_COMMANDS: "true" }, "the owner's left as they were");
  assert.deepEqual(SV.withRepoOwn(null, null), {});
  const only = SV.withRepoOwn({}, s.own);
  assert.deepEqual([SV.bashTimeouts(only).defaultMs, SV.bashTimeouts(only).maxMs], [240000, 900000]);
  assert.deepEqual(SV.bashOutputLimits(only), { inlineMax: 64000, readBack: 64000 }, "bashOutputMaxChars over BASH_MAX_OUTPUT_LENGTH, as in Claude Code");
  assert.deepEqual([SV.varOn(only.CODER_DISABLE_BACKGROUND_TASKS), SV.varOn(only.CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR), SV.varOn(only.CODER_USE_POWERSHELL_TOOL)], [true, true, true]);
  assert.equal(SV.memorySize(only.CODER_TOOL_MEMORY_LIMIT).bytes, 4 * 1024 ** 3);
  assert.equal(SV.envFileLine(only.CODER_ENV_FILE, "/work/shop"), "if [ -r '/work/shop/.venv/env.sh' ]; then . '/work/shop/.venv/env.sh'; fi\n");
  // What Coder is told names the repository's file and Claude Code's name.
  assert.deepEqual([SV.REPO_OWN_FROM.CODER_SHELL, SV.REPO_OWN_FROM.CODER_DISABLE_BACKGROUND_TASKS, SV.REPO_OWN_FROM.CODER_BASH_OUTPUT_MAX_CHARS, SV.REPO_OWN_FROM.BASH_MAX_OUTPUT_LENGTH], ["CLAUDE_CODE_SHELL", "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS", "bashOutputMaxChars", "BASH_MAX_OUTPUT_LENGTH"]);
  // Wired: every one of Coder's settings is read from them, after the repository's file is.
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /const ownerRaw = body\.setup && body\.setup\.vars && typeof body\.setup\.vars === "object" \? body\.setup\.vars : \{\};\n\s+const rawVars = withRepoOwn\(ownerRaw, repoSet\.own\);/);
  assert.ok(src.indexOf("const repoSet = repoSettings(dir") < src.indexOf("const rawVars = withRepoOwn("));
  assert.match(src, /"Every command starts there \(" \+ \(fromRepo\("CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR"\) \? "this repository's \.claude\/settings\.json sets CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR" : "the owner's variables set CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR"\)/);
});

test("CD415 a chat's SessionStart hooks run as \"resume\" on its first message after its machine started again (Claude Code's cloud runs them \"on every session including resumed\"), with what resuming costs (Claude Code 2.1.251's four fields, \"when source is resume … and the transcript contains at least one response\"); not on later messages; a title from a summary's SessionStart is not taken", async () => {
  const A = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const now = 1_800_000_000_000;
  // What resuming costs: about 4 characters a token, Grok 4.7's $2.00 a million input tokens, its cache likely gone after 5 minutes.
  assert.deepEqual(A.resumeCost({ chars: 729_360, lastAt: now - 5_400_000, now }), { seconds_since_last_response: 5400, context_tokens: 182340, prompt_cache_likely_expired: true, estimated_cache_write_usd: 0.3647 });
  assert.deepEqual(A.resumeCost({ chars: 4000, lastAt: now - 60_000, now }), { seconds_since_last_response: 60, context_tokens: 1000, prompt_cache_likely_expired: false, estimated_cache_write_usd: 0.002 });
  assert.deepEqual(A.resumeCost({ chars: 400, lastAt: 0, now }), { context_tokens: 100, prompt_cache_likely_expired: true, estimated_cache_write_usd: 0.0002 }, "no last time known: that field left out");
  assert.deepEqual(A.resumeCost({ chars: 400, lastAt: now + 5000, now }), { context_tokens: 100, prompt_cache_likely_expired: true, estimated_cache_write_usd: 0.0002 }, "a time ahead of now is not used");
  // In Coder's loop.
  const run = async ({ messages = [], resumed = false, lastAt = 0, matcher = "startup|resume", stdout = "Packages are installed." } = {}) => {
    const calls = [], seen = [];
    await A.runCoder({
      send: async (req) => { seen.push(req); return { message: { role: "assistant", content: "ok" }, usage: { in: 1, out: 1 } }; },
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { calls.push(JSON.parse(x.payload)); return { code: 0, output: stdout + "\n" + mark[0] + "\n" }; }
        return { code: 0, output: "ok\n" };
      },
      emit: () => {}, now: () => now,
      here: () => "/work/shop", root: "/work/shop", chatId: "shop-r1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    }, { text: "go on", messages, resumed, lastAt, hooks: H.hooksFrom({ hooks: { SessionStart: [{ matcher, hooks: [{ type: "command", command: "bash \"$CLAUDE_PROJECT_DIR\"/scripts/install_pkgs.sh" }] }] } }, "settings").list });
    return { calls, msgs: seen[0].messages.map((m) => m.content) };
  };
  const earlier = [{ role: "user", content: "make the shop" }, { role: "assistant", content: "Made it." }];
  let t = await run({ messages: earlier, resumed: true, lastAt: now - 5_400_000 });
  assert.equal(t.calls.length, 1);
  const inp = t.calls[0];
  assert.deepEqual([inp.hook_event_name, inp.source, inp.seconds_since_last_response, inp.prompt_cache_likely_expired], ["SessionStart", "resume", 5400, true]);
  assert.ok(Number.isInteger(inp.context_tokens) && inp.context_tokens > A.CODER_SYSTEM.length / 4, "the system text and the chat so far");
  assert.equal(inp.estimated_cache_write_usd, Math.round(inp.context_tokens * 0.02) / 10000);
  assert.equal(t.msgs[t.msgs.indexOf("go on") - 1], "(Note from Coder's app, not the owner: SessionStart hook additional context: Packages are installed.)", "before the message, after the chat so far");
  // A later message on the same machine: not again; a hook only for "startup": not on a resume.
  assert.equal((await run({ messages: earlier, resumed: false })).calls.length, 0);
  assert.equal((await run({ messages: earlier, resumed: true, matcher: "startup" })).calls.length, 0);
  // A chat's first message: "startup", without the four fields; a resumed chat Coder never answered: "resume", without them.
  t = await run({ messages: [], resumed: true });
  assert.deepEqual([t.calls[0].source, "context_tokens" in t.calls[0]], ["startup", false]);
  t = await run({ messages: [{ role: "user", content: "make the shop" }], resumed: true, lastAt: now - 1000 });
  assert.deepEqual([t.calls[0].source, "context_tokens" in t.calls[0], "seconds_since_last_response" in t.calls[0]], ["resume", false, false]);
  // Wired: the machine marks a chat's first job since it started; the Worker sends the chat's last activity.
  const fs = await import("node:fs");
  const server = fs.readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const resumed = !SEEN_CHATS\.has\(project\) && Array\.isArray\(body\.messages\) && body\.messages\.length > 0;\n\s+SEEN_CHATS\.add\(project\);/);
  assert.match(server, /startMode: repoSet\.defaultMode, resumed, lastAt: Number\(body\.lastAt\) \|\| 0/);
  const routes = fs.readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /const lastAtOn = messages\.length && Number\(meta\.at\) > 0 \? \{ lastAt: Number\(meta\.at\) \} : \{\};/);
  assert.match(routes, /\.\.\.bgOn, \.\.\.lastAtOn, text: /);
  // A summary's SessionStart (source "compact") sets no title (Claude Code: sessionTitle "Applies when source is startup, resume, or fork").
  const agent = fs.readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agent, /if \(o\.sessionTitle && !\(event === "SessionStart" && value === "compact"\)\) sessionTitle = /);
});

test("CD416 Auto mode's details, as Claude Code's docs and program give them: every part allowed or read-only needs no check; Plan's checker only while Auto mode is available, and a dangerous removal there is handled as in Auto; protected-path writes go to the checker; git status before a command that can discard work; a mode switched during a check asks; no verdict: hard (denied once, retrying won't help) or transient (a growing delay, the turn stops after ten); block counts kept; Claude Code's default rules; the dim \"Not run\" row", async () => {
  const A = await import("../container/coder-agent.mjs");
  const C = await import("../container/coder-checker.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const CHECK = /THE ACTION TO JUDGE:/;
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const job = async (steps, { mode = "auto", verdict = () => '{"decision":"allow"}', answers = [], rules = null, checker = true, checkerInPlan = true, autoOff = false, github = false, modeFn = null, hooks = null, hookRun = () => ({}), gitOut = null, keep = null, key = "chat-" + Math.random().toString(36).slice(2) } = {}) => {
    const events = [], seen = [], checks = [], ran = [], cards = [], sleeps = [], hookCalls = [];
    let n = 0, k = 0;
    await A.runCoder({
      send: async (req) => {
        if (CHECK.test(String((req.messages[1] || {}).content || ""))) { checks.push(req); const v = verdict(String(req.messages[1].content).split("THE ACTION TO JUDGE:\n")[1] || "", checks.length); if (v instanceof Error) throw v; return { message: { role: "assistant", content: v }, usage: { in: 100, out: 5 } }; }
        seen.push(req);
        return steps[Math.min(n++, steps.length - 1)];
      },
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (await hookRun(input)) || {}; return { code: a.code || 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
        if (/--porcelain=v1/.test(x.command)) return { code: 0, output: gitOut === null ? "__git_rc=128\n" : gitOut };
        ran.push(x.command);
        return { code: 0, output: "ok\n" };
      },
      emit: (e) => events.push(e), sleep: async (ms) => { sleeps.push(ms); },
      here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-p8a", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
      ...(modeFn ? { mode: modeFn } : {}), ...(keep ? { checkerKeep: keep } : {}),
      ...(github ? {} : { ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; } }),
    }, { text: "work on the shop", mode, rules, checker, checkerInPlan, autoOff, github, checkWhere: { key, repo: "ana/shop", branch: "coder/shop-1" }, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}) });
    const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
    return { events, checks, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), cards, sleeps, hookCalls, told, results: (id) => events.filter((e) => e.type === "result" && e.id === id) };
  };
  const one = (command, id = "b1") => [say("", [call("bash", { command }, id)]), say("ok")];
  const R = { allow: ["Bash(npm test *)", "Bash(npm test)"], ask: [], deny: [] };
  // EVERY PART ALLOWED BY A RULE OR READ-ONLY (Claude Code: "All pipeline commands are individually allowed, some only by the
  // read-only allowlist"): no check; a part neither is checked.
  let t = await job(one("ls && npm test"), { rules: R });
  assert.deepEqual([t.checks.length, t.ran], [0, ["ls && npm test"]]);
  assert.equal((await job(one("npm test && rm notes.txt"), { rules: R })).checks.length, 1);
  assert.equal((await job(one("ls > out.txt && npm test"), { rules: R })).checks.length, 1, "a redirection needs every part allowed by a rule");
  // PLAN: the checker reviews what Plan would ask, only while Auto mode is available ("Auto mode not available …: commands
  // outside the built-in read-only set prompt for approval").
  t = await job(one("npm install"), { mode: "plan" });
  assert.deepEqual([t.checks.length, t.cards.length], [1, 0]);
  t = await job(one("npm install"), { mode: "plan", autoOff: true });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1], "Auto mode off: asked");
  // A dangerous removal in Plan with the checker: as in Auto (refused away from a terminal); without it: asked.
  t = await job(one("rm -rf ~"), { mode: "plan" });
  assert.deepEqual([t.checks.length, t.cards.length, t.ran.length], [0, 0, 0]);
  assert.match(t.told("b1"), /Dangerous rm operation detected: '~'/);
  t = await job(one("rm -rf ~"), { mode: "plan", checkerInPlan: false, answers: [{ choice: "no" }] });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1]);
  // From GitHub with Auto mode off: nothing can approve, so a command that changes things is refused; a read-only one runs.
  t = await job(one("npm install"), { github: true, autoOff: true });
  assert.deepEqual([t.checks.length, t.ran.length], [0, 0]);
  assert.match(t.told("b1"), /auto mode is off in this account's settings, and no one can approve a command that changes things in a job started from GitHub/);
  assert.deepEqual((await job(one("git status"), { github: true, autoOff: true })).ran, ["git status"]);
  // PROTECTED-PATH WRITES: the checker in Auto and in Plan, told which paths; through a link, still asked.
  t = await job(one("echo x > .git/hooks/pre-commit"), { mode: "plan" });
  assert.deepEqual([t.checks.length, t.cards.length], [1, 0]);
  assert.match(String(t.checks[0].messages[1].content), /IT WRITES PROTECTED PATHS \(repository state or Coder's own settings\): \.git\/hooks\/pre-commit/);
  t = await job(one("echo x > .git/hooks/pre-commit"), { mode: "plan", autoOff: true, answers: [{ choice: "no" }] });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1], "no checker in Plan: asked");
  const { mkdtempSync, mkdirSync, symlinkSync, realpathSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = realpathSync(mkdtempSync(join(tmpdir(), "coder-p8pl-")));
  mkdirSync(join(d, ".git", "hooks"), { recursive: true });
  symlinkSync(join(d, ".git", "hooks"), join(d, "hk"));
  // (The machine's way of following links: a file not made yet resolves through its folders.)
  const real = (p) => B.realPath(p);
  const viaLink = A.commandAsk("echo x > hk/pre-commit", { root: d, where: (p) => (p.startsWith("/") ? p : d + "/" + p) }, d, { real });
  assert.deepEqual([viaLink.kind, viaLink.viaLink], ["protected", true]);
  assert.equal(A.commandAsk("echo x > .git/hooks/pre-commit", { root: d, where: (p) => (p.startsWith("/") ? p : d + "/" + p) }, d, { real }).viaLink, undefined);
  // GIT STATUS FIRST, for a command that can discard uncommitted work (untracked files listed whatever git's settings say).
  t = await job(one("git reset --hard"), { gitOut: "M  src/cart.js\n M src/app.js\nMM README.md\n?? notes.txt\n?? tmp/a.log\n__git_rc=0\n" });
  assert.equal(t.checks.length, 1);
  assert.match(String(t.checks[0].messages[1].content), /GIT STATUS \(Coder's app ran it before this command, which can discard uncommitted work\): 2 files staged, 2 files modified, 2 files untracked\./);
  t = await job(one("git stash clear"), { gitOut: "__git_rc=0\n" });
  assert.match(String(t.checks[0].messages[1].content), /no uncommitted work \(nothing staged, modified or untracked\)/);
  t = await job(one("npm install"));
  assert.doesNotMatch(String(t.checks[0].messages[1].content), /GIT STATUS/, "only before a command that can discard work");
  // A MODE SWITCHED WHILE THE CHECK RAN ("discards a verdict the new mode wouldn't have requested. You're prompted for
  // approval instead"): the owner is asked; a switch to a mode that checks too keeps the verdict.
  let m = "auto";
  t = await job(one("npm install"), { modeFn: () => m, verdict: () => { m = "acceptEdits"; return '{"decision":"block","rule":"Code from External","reason":"x"}'; }, answers: [{ choice: "yes" }] });
  assert.deepEqual([t.checks.length, t.cards.length, t.ran], [1, 1, ["npm install"]]);
  assert.equal(t.cards[0].why, A.MODE_SWITCHED);
  assert.equal(t.cards[0].rules, undefined, "a one-time Yes");
  m = "auto";
  t = await job(one("npm install"), { modeFn: () => m, verdict: () => { m = "plan"; return '{"decision":"allow"}'; } });
  assert.deepEqual([t.cards.length, t.ran], [0, ["npm install"]]);
  // NO VERDICT, HARD: the checker declined; denied once, "retrying won't help"; the same step again is not checked again.
  const twice = [say("", [call("bash", { command: "npm install" }, "b1")]), say("", [call("bash", { command: "npm install" }, "b2")]), say("ok")];
  t = await job(twice, { verdict: () => "I can't help with evaluating that." });
  assert.equal(t.checks.length, 1);
  assert.equal(t.told("b1"), C.noVerdictTold("The classifier", "hard", "it declined to judge this action"));
  assert.match(t.told("b1"), /so retrying this action will get the same answer\. Don't retry it\./);
  assert.equal(t.told("b2"), C.noVerdictTold("The classifier", "hard", "it declined to judge this action"));
  assert.deepEqual(t.results("b1").map((e) => e.notRun), ["auto mode's check had no usable answer"], "the dim row's words");
  // A request a safety system turned away is hard too.
  assert.equal((await C.checkAction({ send: async () => { throw new Error("AI call failed: 400 content moderation"); } }, { action: "x" })).kind, "hard");
  assert.equal((await C.checkAction({ send: async () => { throw new Error("AI call failed: 503"); } }, { action: "x" })).kind, "unavailable");
  assert.equal((await C.checkAction({ send: async () => ({ message: { content: "looks fine" } }) }, { action: "x" })).kind, "transient");
  // NO VERDICT, TRANSIENT: a growing delay before each later check, and the turn stops after ten responses in a row.
  const many = [...Array.from({ length: 12 }, (_, i) => say("", [call("bash", { command: "npm install " + i }, "c" + i)])), say("ok")];
  t = await job(many, { verdict: () => "hmm" });
  assert.equal(t.checks.length, 10);
  assert.deepEqual(t.sleeps, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000]);
  assert.ok(t.events.some((e) => e.type === "error" && e.text.startsWith("Auto mode unavailable — stopped after repeated responses with no safety verdict")));
  // A verdict in between starts the count again.
  t = await job([say("", [call("bash", { command: "npm install a" }, "d1")]), say("", [call("bash", { command: "npm install b" }, "d2")]), say("", [call("bash", { command: "npm install c" }, "d3")]), say("ok")], { verdict: (a, nth) => (nth === 2 ? '{"decision":"allow"}' : "hmm") });
  assert.deepEqual(t.sleeps, [1000], "after a verdict, no wait");
  // A PermissionDenied hook's retry is not passed on for a denial with no verdict (Claude Code ignores it there).
  t = await job(one("npm install"), { verdict: () => "hmm", hooks: { PermissionDenied: [{ hooks: [{ type: "command", command: "retry.sh" }] }] }, hookRun: () => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionDenied", retry: true } }) }) });
  assert.equal(t.hookCalls.length, 1);
  assert.match(t.hookCalls[0].reason, /^Auto mode could not evaluate this action and is blocking it for safety/);
  assert.doesNotMatch(t.told("b1"), /may retry/);
  // BLOCK COUNTS KEPT for the chat between its machine's sleeps ("The total counter persists for the session").
  let saved = { row: 2, total: 7, paused: false, byRow: false };
  const keep = { load: () => saved, save: (o) => { saved = o; } };
  const st = C.checkerState("chat-kept-" + Math.random(), keep);
  assert.deepEqual({ ...st }, { row: 2, total: 7, paused: false, byRow: false });
  assert.equal(C.countBlock(st), true, "the third in a row, counted from before the sleep");
  assert.deepEqual(saved, { row: 3, total: 8, paused: true, byRow: true });
  C.resume(st);
  assert.deepEqual(saved, { row: 0, total: 8, paused: false, byRow: true });
  assert.deepEqual({ ...C.checkerState("chat-bad-" + Math.random(), { load: () => ({ row: -1, total: "x", paused: "yes" }) }) }, { row: 0, total: 0, paused: false, byRow: false }, "nonsense read as nothing");
  const fs = await import("node:fs");
  const server = fs.readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /checkerKeep: checksKeep\(join\(memRoot, project \+ "\.checks\.json"\)\),/);
  // CLAUDE CODE'S DEFAULT RULES (its `claude auto-mode defaults`, 2.1.322), the ones Coder's machine can meet.
  const names = (list) => list.map((x) => /^\[([^\]]+)\]/.exec(x)[1]);
  for (const r0 of ["Code That Leaks When Run", "Remote Shell Writes", "Sensitive Remote Exec", "Production Reads", "Blind Apply", "Protected-Scope IaC Apply", "Logging/Audit Tampering", "Account & Standing-Rule Changes", "TLS/Auth Weaken", "Secret-Store Writes", "DNS / Domain / Cert Changes", "Shared Cluster Mutation", "Irreversible Deletion (general)", "Unverifiable Deletion Scope", "Create RCE Surface", "Expose Local Services", "Credential Materialization", "PII Data Handling", "Exfil Scouting", "Command Network Lists", "Create Public Surface", "Public Data-Sharing Upload", "Package Registry Bypass", "Instruction Poisoning", "Merge Without Review", "Self-Approval", "ChatOps Trigger Comments", "Feature Flag Writes", "Node Lifecycle Operations", "Cluster-Wide Workload Creation", "Real-World Transactions", "Third-Party Attack"]) assert.ok(names(C.DEFAULT_SOFT_DENY).includes(r0), r0);
  for (const r0 of ["Toolchain Bootstrap", "Memory Directory", "CLAUDE.md Content"]) assert.ok(names(C.DEFAULT_ALLOW).includes(r0), r0);
  assert.equal(new Set(names(C.DEFAULT_SOFT_DENY)).size, C.DEFAULT_SOFT_DENY.length, "no rule twice");
  // THE PAGE: a dim "Not run" row under the step, "not run" on its right, never a red error.
  const page = fs.readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /: state === 'bad' && r && typeof r\.notRun === 'string' && r\.notRun \? '<span class="cd-st cd-st-notrun">not run<\/span>'/);
  assert.match(page, /\(r && typeof r\.notRun === 'string' && r\.notRun \? '<div class="cd-notrun">Not run · ' \+ esc\(r\.notRun\) \+ '<\/div>' : ''\)/);
  const css = fs.readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(css, /\.cd-notrun \{[^}]*color: #9ca3af;/);
});

test("CD417 hooks meeting commands, as Claude Code's hooks reference gives them: a PermissionRequest hook's updatedInput (\"re-evaluated against deny and ask rules\") and updatedPermissions; its suggestions as {toolName, ruleContent} entries; the path placeholder in exec form and PowerShell's ${env:…}; a PowerShell call named PowerShell; `if: PowerShell(…)`; no PostToolUseFailure for a call that never ran, and input checks before PreToolUse; a Bash matcher on a Monitor command; CwdChanged clears only its own variables; \"defer\" ignored", async () => {
  const A = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const PS = await import("../container/coder-ps.mjs");
  const { fakeParse: psFake } = await import("./ps-fake.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const loop = async (steps, hooks, { hookRun = () => ({}), mode = "acceptEdits", rules = null, answers = [], ps = false } = {}) => {
    const events = [], seen = [], ran = [], hookCalls = [], cards = [];
    let n = 0, k = 0;
    const r = await A.runCoder({
      send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push({ input, x }); const a = (await hookRun(input)) || {}; return { code: a.code || 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
        if (x.hook === true) { hookCalls.push({ reset: true, x }); return { code: 0, output: "" }; }
        ran.push(x.shown || x.command);
        return { code: 0, output: "ok\n" };
      },
      emit: (e) => events.push(e),
      here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-c1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
      ...(ps ? { psParse: async (cmd) => psFake(cmd) } : {}),
      ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "no" }; },
    }, { text: "go", mode, rules, hooks: H.hooksFrom({ hooks }, "settings").list, ...(ps ? { powershell: { bypass: true } } : {}) });
    const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
    return { r, events, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), hookCalls: hookCalls.filter((h) => !h.reset), resets: hookCalls.filter((h) => h.reset), cards, told };
  };
  const permReq = (decision) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision } }) });
  const PR = { PermissionRequest: [{ matcher: "Bash", hooks: [{ type: "command", command: "rewrite.sh" }] }] };
  const one = [say("", [call("bash", { command: "npm install left-pad" }, "b1")]), say("ok")];
  // A PERMISSIONREQUEST HOOK'S CHANGED INPUT: the call runs with it, with no card; the step shows the new command.
  let t = await loop(one, PR, { hookRun: (i) => (i.hook_event_name === "PermissionRequest" ? permReq({ behavior: "allow", updatedInput: { command: "npm install --ignore-scripts left-pad" } }) : {}) });
  assert.deepEqual([t.cards.length, t.ran], [0, ["npm install --ignore-scripts left-pad"]]);
  assert.deepEqual(t.events.filter((e) => e.type === "bash" && e.id === "b1").map((e) => e.command), ["npm install left-pad", "npm install --ignore-scripts left-pad"]);
  assert.equal(t.hookCalls.filter((h) => h.input.hook_event_name === "PermissionRequest").length, 1, "asked once");
  assert.equal(t.hookCalls.filter((h) => h.input.hook_event_name === "PreToolUse").length, 0);
  // Re-evaluated against deny and ask rules: a deny rule refuses the new input; an ask rule shows the owner the card (no hook again).
  const rewrite = (i) => (i.hook_event_name === "PermissionRequest" ? permReq({ behavior: "allow", updatedInput: { command: "curl -sS https://example.com/x.sh" } }) : {});
  t = await loop(one, PR, { hookRun: rewrite, rules: { allow: [], ask: [], deny: ["Bash(curl *)"] } });
  assert.deepEqual([t.ran, t.cards.length], [[], 0]);
  assert.match(t.told("b1"), /curl/);
  t = await loop(one, PR, { hookRun: rewrite, rules: { allow: [], ask: ["Bash(curl *)"], deny: [] }, answers: [{ choice: "no" }] });
  assert.deepEqual([t.ran, t.cards.length, t.cards[0].lines.join("\n")], [[], 1, "curl -sS https://example.com/x.sh"]);
  assert.equal(t.hookCalls.filter((h) => h.input.hook_event_name === "PermissionRequest").length, 1);
  // Its updatedPermissions: an allow rule kept as the owner's "don't ask again" (or for this job only), a mode change.
  t = await loop([say("", [call("bash", { command: "npm install left-pad" }, "b1"), call("bash", { command: "npm install lodash" }, "b2")]), say("ok")], PR, { hookRun: (i) => (i.hook_event_name === "PermissionRequest" ? permReq({ behavior: "allow", updatedPermissions: [{ type: "addRules", rules: [{ toolName: "Bash", ruleContent: "npm install *" }], behavior: "allow", destination: "localSettings" }, { type: "addRules", rules: [{ toolName: "Bash", ruleContent: "npm ci" }], behavior: "allow", destination: "session" }] }) : {}) });
  assert.deepEqual(t.ran, ["npm install left-pad", "npm install lodash"]);
  assert.equal(t.hookCalls.filter((h) => h.input.hook_event_name === "PermissionRequest").length, 1, "the rule it added covered the second");
  assert.deepEqual(t.r.rulesAdded, ["Bash(npm install *)"], "kept as the owner's; the session one not");
  t = await loop(one, PR, { hookRun: (i) => (i.hook_event_name === "PermissionRequest" ? permReq({ behavior: "allow", updatedPermissions: [{ type: "setMode", mode: "plan", destination: "session" }] }) : {}) });
  assert.deepEqual(t.events.filter((e) => e.type === "mode").map((e) => [e.mode, e.by]), [["plan", "hook"]]);
  // Its suggestions as Claude Code's entries.
  t = await loop(one, PR, { hookRun: () => ({}), answers: [{ choice: "no" }] });
  const sugg = t.hookCalls.find((h) => h.input.hook_event_name === "PermissionRequest").input.permission_suggestions;
  assert.ok(Array.isArray(sugg) && sugg.length > 0);
  assert.deepEqual(sugg[0].rules[0], { toolName: "Bash", ruleContent: t.cards[0].rules[0].slice(5, -1) });
  assert.deepEqual([H.ruleEntry("Bash"), H.ruleEntry("Bash(*)"), H.ruleEntry("Bash(npm test)"), H.entryRule({ toolName: "Bash", ruleContent: "npm test" }), H.entryRule({ toolName: "WebFetch" })], [{ toolName: "Bash" }, { toolName: "Bash" }, { toolName: "Bash", ruleContent: "npm test" }, "Bash(npm test)", "WebFetch"]);
  // THE PATH PLACEHOLDER: exec form gets the path itself; PowerShell's shell form gets ${env:…}; Bash's shell form reads the variable.
  const sh = H.hookShell({ type: "command", command: "node", args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/check.js", "--fix"] }, "MARK", "/work/shop");
  assert.match(sh, /\n'node' '\/work\/shop\/\.claude\/hooks\/check\.js' '--fix'\n/);
  const pw = H.hookShell({ type: "command", shell: "powershell", command: "& \"${CLAUDE_PROJECT_DIR}\\.claude\\hooks\\check.ps1\"" }, "MARK", "/work/shop");
  const enc = /-EncodedCommand (\S+)/.exec(pw)[1];
  // (With Claude Code's ending after it, so a program's exit 2 blocks: Bash docs pass 9.)
  assert.equal(Buffer.from(enc, "base64").toString("utf16le"), "& \"${env:CLAUDE_PROJECT_DIR}\\.claude\\hooks\\check.ps1\"" + H.PS_HOOK_EXIT2);
  assert.match(H.hookShell({ type: "command", command: "bash \"${CLAUDE_PROJECT_DIR}\"/x.sh" }, "MARK", "/work/shop"), /\nbash "\$\{CLAUDE_PROJECT_DIR\}"\/x\.sh\n/, "the shell expands it");
  // A POWERSHELL CALL IS "PowerShell" after its PreToolUse hooks too; `if: PowerShell(…)` matches its commands.
  t = await loop([say("", [call("powershell", { command: "Get-ChildItem" }, "p1")]), say("ok")], { PostToolUse: [{ matcher: "PowerShell", hooks: [{ type: "command", command: "post.sh" }] }], PreToolUse: [{ matcher: "Bash|PowerShell", hooks: [{ type: "command", if: "PowerShell(Get-ChildItem *)", command: "pre.sh" }] }] }, { ps: true });
  assert.deepEqual(t.hookCalls.map((h) => [h.input.hook_event_name, h.input.tool_name]), [["PreToolUse", "PowerShell"], ["PostToolUse", "PowerShell"]]);
  assert.deepEqual(PS.psAllParts("Get-ChildItem | ForEach-Object { Remove-Item $_ }; Write-Output \"$(Get-Date)\""), ["Get-ChildItem", "ForEach-Object { Remove-Item $_ }", "Remove-Item $_", "Write-Output \"$(Get-Date)\"", "Get-Date"]);
  // NEVER RAN: no PostToolUseFailure; a command that fails its input checks fires no PreToolUse either.
  const both = { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUseFailure: [{ matcher: "Bash", hooks: [{ type: "command", command: "fail.sh" }] }], PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "post.sh" }] }] };
  t = await loop([say("", [call("bash", { command: "git push" }, "b1")]), say("ok")], both, { rules: { allow: [], ask: [], deny: ["Bash(git push *)"] } });
  assert.deepEqual(t.hookCalls.map((h) => h.input.hook_event_name), ["PreToolUse"], "a denial fires PreToolUse only");
  t = await loop([say("", [call("bash", { command: "sleep 40" }, "b1")]), say("ok")], both);
  assert.deepEqual([t.hookCalls.length, /^Blocked: standalone sleep 40/.test(t.told("b1"))], [0, true], "rejected before hooks run");
  t = await loop([say("", [call("bash", { command: "printf 'a\u0007b'" }, "b1")]), say("ok")], both);
  assert.deepEqual([t.hookCalls.length, t.told("b1")], [0, "Command contains control characters that would be hidden in the approval dialog (in Coder, the chat and the owner's card show the command). Write them as escapes instead, such as printf '\\033[1m' or $'\\r'."]);
  // A BASH MATCHER ON A MONITOR'S COMMAND: a Bash call; its allow and updatedInput no effect; never for a WebSocket watch, nor
  // when its `if` names Monitor; a matcher that includes Monitor gets the Monitor call.
  const hooks6 = [{ event: "PreToolUse", matcher: "Bash", type: "command", command: "a.sh" }, { event: "PreToolUse", matcher: "Bash|Monitor", type: "command", command: "b.sh" }, { event: "PreToolUse", matcher: "Bash", type: "command", command: "c.sh", if: "Monitor(tail *)" }, { event: "PreToolUse", matcher: ".*", type: "command", command: "d.sh", if: "Bash(tail *)" }];
  const mon = { tool: "Monitor", input: { command: "tail -f app.log" }, ctx: {} };
  assert.deepEqual(H.hooksFor(hooks6, "PreToolUse", "Monitor", mon).map((h) => [h.command, !!h.asBash, !!h.noGrant]), [["a.sh", true, true], ["b.sh", false, false], ["d.sh", false, true]]);
  assert.deepEqual(H.hooksFor(hooks6, "PreToolUse", "Monitor", { ...mon, ws: true }).map((h) => h.command), ["b.sh", "d.sh"], "a WebSocket watch: no Bash matcher");
  assert.deepEqual(H.hooksFor(hooks6, "PostToolUse", "Monitor", mon).map((h) => h.command), [], "PostToolUse: none of these");
  assert.deepEqual(H.asBashInput({ hook_event_name: "PreToolUse", tool_name: "Monitor", tool_input: { command: "tail -f app.log", description: "Watch the log", timeout_ms: 60000 } }), { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "tail -f app.log", description: "Watch the log", run_in_background: true } });
  const grant = { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { command: "x" }, additionalContext: "hi" } } };
  assert.deepEqual(H.withoutGrant("PreToolUse", grant).json, { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: "hi" } });
  assert.deepEqual(H.withoutGrant("PreToolUse", { kind: "ok", json: { hookSpecificOutput: { permissionDecision: "deny" } } }).json.hookSpecificOutput.permissionDecision, "deny", "a deny still counts");
  assert.deepEqual(H.withoutGrant("PermissionRequest", { kind: "ok", json: { hookSpecificOutput: { decision: { behavior: "allow" } } } }).json.hookSpecificOutput.decision, undefined);
  // CWDCHANGED CLEARS ONLY ITS OWN VARIABLES (and FileChanged's); SessionStart's stay. "defer" is ignored.
  t = await loop([say("", [call("bash", { command: "cd app" }, "b1")]), say("ok")], { SessionStart: [{ hooks: [{ type: "command", command: "s.sh" }] }], CwdChanged: [{ hooks: [{ type: "command", command: "c.sh" }] }] });
  assert.deepEqual(t.hookCalls.map((h) => [h.input.hook_event_name, h.x.hookEnv]), [["SessionStart", "session"]], "(no cd in this stand-in)");
  assert.deepEqual(t.resets.map((h) => h.x.hookEnv), ["session", "cwd"], "both emptied at a chat's start");
  const agentSrc = (await import("node:fs")).readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agentSrc, /await resetHookEnv\(\["cwd"\]\); await runHooks\("CwdChanged"/);
  const out = H.hooksOutcome("PreToolUse", [{ hook: { type: "command", command: "d.sh" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "defer" } }, text: "" } }], { tool: "Bash" });
  assert.deepEqual([out.decision, out.blocks], ["", []], "defer: ignored, the normal permission flow goes on");
  // The page shows a step once, with its last command.
  const page = (await import("node:fs")).readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /S\.events\.forEach\(\(e, i\) => \{ if \(e\.type === 'bash' && e\.id\) lastStep\[e\.id\] = i; \}\);/);
  assert.match(page, /if \(e\.type === 'bash'\) \{ if \(!e\.id \|\| lastStep\[e\.id\] === i\) group\.push\(\[e, i\]\); return; \}/);
});

test("CD418 hook input as Claude Code's common fields give it: prompt_id, one per message of the owner's (\"Absent until the first user input\"), and duration_ms on PostToolUseFailure too", async () => {
  const A = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const run = async (text) => {
    const inputs = [];
    let n = 0;
    const steps = [say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")];
    await A.runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { inputs.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
        return { code: 1, output: "1 test failed\n" };
      },
      emit: () => {}, here: () => "/work/shop", root: "/work/shop", chatId: "shop-c2", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
      ask: async () => ({ choice: "yes" }),
    }, { text, mode: "auto", hooks: H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUseFailure: [{ matcher: "Bash", hooks: [{ type: "command", command: "fail.sh" }] }] } }, "settings").list });
    return inputs;
  };
  const a = await run("run the tests"), b = await run("again");
  assert.deepEqual(a.map((x) => x.hook_event_name), ["PreToolUse", "PostToolUseFailure"]);
  assert.match(a[0].prompt_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(a[1].prompt_id, a[0].prompt_id, "the same message, the same id");
  assert.notEqual(b[0].prompt_id, a[0].prompt_id, "a new message, a new id");
  assert.ok(Number.isInteger(a[1].duration_ms) && a[1].duration_ms >= 0, "duration_ms on a failure");
  assert.equal("prompt_id" in (await run(""))[0], false, "no message of the owner's: none");
  assert.deepEqual(Object.keys(H.hookInput("Stop", { session: "s", promptId: "p-1" })), ["session_id", "prompt_id", "cwd", "permission_mode", "hook_event_name"]);
});
