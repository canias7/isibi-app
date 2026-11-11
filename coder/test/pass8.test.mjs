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
