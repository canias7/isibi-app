// BASH DOCS PASS 9, PART B (the owner, 2026-11-11: "Yes pls" to building pass 9's list in order; part B: how Claude Code's
// cloud machine runs commands): each test checked against Claude Code's own words, its docs, its program (2.1.322), and
// what its cloud machine does, seen in a cloud session on 2026-11-11.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const S = await import("../container/server.mjs");
const C = await import("../container/coder-checks.mjs");
const PX = await import("../container/coder-proxy.mjs");
const P = await import("../container/coder-perms.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const ZSH = ["/usr/bin/zsh", "/bin/zsh", "/usr/local/bin/zsh"].find((z) => existsSync(z)) || "";
const ROOT = "/work/shop";
const decide = (c, o = {}) => P.bashDecision(c, { mode: o.mode || "acceptEdits", rules: o.rules || { allow: [], ask: [], deny: [] }, cwd: ROOT, workdirs: [ROOT], home: "/home/dev", byCommand: o.byCommand === true, isProtected: () => "", ...(o.scratch ? { scratch: o.scratch } : {}), ...(o.real ? { real: o.real } : {}) });
const run = (cmd, args, opts = {}) => new Promise((ok) => execFile(cmd, args, { encoding: "utf8", ...opts }, (e, stdout, stderr) => ok({ code: e ? e.code : 0, stdout, stderr })));

/** One job on a machine made here: the model's replies in turn, then "Done."; the job's state once it ends. */
async function job(project, replies, body = {}, { onSend = null } = {}) {
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), home = await mkdtemp(join(tmpdir(), "coder-home-"));
  const mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  let n = 0;
  const srv = http.createServer(S.createApp({ root, home, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async (req) => { const k = n++; if (onSend) await onSend(k, req, join(root, project)); return k < replies.length ? replies[k] : say("Done."); } }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const res = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "go", messages: [], mode: "acceptEdits", ...body }) });
    assert.equal(res.status, 200);
    let st;
    const answered = new Set();
    for (let i = 0; i < 600; i++) {
      st = await (await fetch(base + "/state?project=" + project + "&since=0")).json();
      if (st.result) break;
      // (A card that asks is answered Yes, as the owner would: Coder's cloud Accept edits asks where Claude Code's "default" does.)
      for (const e of st.events) if (e.type === "permission" && !answered.has(e.pid)) { answered.add(e.pid); await fetch(base + "/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, pid: e.pid, choice: "yes" }) }); }
      await new Promise((ok) => setTimeout(ok, 50));
    }
    assert.ok(st.result, "the job ended");
    return { st, dir: join(root, project), home, asked: answered.size, out: (id) => (st.events.find((e) => e.type === "result" && e.id === id) || {}).output };
  } finally { await new Promise((r) => srv.close(r)); }
}

test("CD455 commands run in zsh where it is installed, as Claude Code's cloud machine's do (its shell list, [\"zsh\",\"bash\"]; seen in /usr/bin/zsh); CODER_SHELL takes a full path anywhere that names bash or zsh and is there (Claude Code's CLAUDE_CODE_SHELL)", async () => {
  assert.equal(S.shellOf(undefined, { exists: (p) => p === "/usr/bin/zsh" }), "/usr/bin/zsh");
  assert.equal(S.shellOf("", { exists: (p) => p === "/bin/zsh" }), "/bin/zsh");
  assert.equal(S.shellOf("", { exists: () => false }), "bash", "no zsh: bash");
  assert.equal(S.shellOf("/opt/homebrew/bin/zsh", { exists: (p) => p === "/opt/homebrew/bin/zsh" }), "/opt/homebrew/bin/zsh");
  assert.equal(S.shellOf("/nix/store/x1-bash-5.2/bin/bash", { exists: () => true }), "/nix/store/x1-bash-5.2/bin/bash");
  assert.equal(S.shellOf("/opt/x/zsh", { exists: () => false }), "bash", "not there: bash");
  for (const bad of ["/opt/fish", "/tmp/evil-zsh", "/opt/zsh;id", "/opt/my zsh/zsh", "zsh5"]) assert.equal(S.shellOf(bad, { exists: () => true }), "bash", bad);
  // On this machine: no CODER_SHELL, and a command's shell is zsh when zsh is here.
  const { out } = await job("shop-zsh", [say("", [call("bash", { command: "echo \"[${ZSH_VERSION:-none}]\"" }, "z1")])]);
  if (ZSH) assert.match(out("z1"), /^\[\d+\.\d+/); else assert.equal(out("z1"), "[none]");
});

test("CD456 where bash and zsh read a command differently, it asks, in Claude Code's words (its checks of the whole text, before its parser): escaped blanks, a word joined across lines, ~[…], =cmd, <N-M>, a brace with a quote; zsh's own builtins; zsh's `cd OLD NEW`", () => {
  const asks = {
    "echo a\\ b": "Contains backslash-escaped whitespace",
    "ec\\\nho hi": "Contains backslash-escaped whitespace",
    "ls ~[foo]": "Contains zsh ~[ dynamic directory syntax",
    "echo =ls": "Contains zsh =cmd equals expansion",
    "ls <1-5>": "Contains zsh <N-M> numeric-range glob",
    "echo {a,'b'}": "Contains brace with quote character (expansion obfuscation)",
    "zmodload zsh/net/tcp": "Zsh builtin 'zmodload' can bypass security checks",
    "ztcp example.com 80": "Zsh builtin 'ztcp' can bypass security checks",
    "sysopen -r -u 3 /etc/passwd": "Zsh builtin 'sysopen' can bypass security checks",
    "cd src lib": P.CD_TWO_WHY,
  };
  for (const [c, why] of Object.entries(asks)) assert.deepEqual([decide(c).verdict, decide(c).why], ["ask", why], c);
  assert.equal(P.CD_TWO_WHY, "cd with two or more directory arguments requires manual approval. zsh's \"cd OLD NEW\" form substitutes OLD→NEW in $PWD, producing a target path that cannot be statically validated.");
  // Not these: a line continued after a space, a brace inside quotes, `a==b`, an assignment.
  const zshWhy = /^(Contains (backslash-escaped whitespace|zsh|brace with quote)|Zsh builtin)/;
  for (const c of ["echo a \\\nb", "echo '{\"a\":1}'", "echo \"{x'}\"", "test a == b", "X=1 echo $X", "echo a=b", "git log --format=%H"]) assert.doesNotMatch(decide(c).why || "", zshWhy, c);
  assert.equal(decide("echo a \\\nb").verdict, "allow");
  assert.equal(decide("echo '{\"a\":1}'").verdict, "allow");
  // (Claude Code's list of zsh builtins: 44 names, its tZe.)
  for (const n of ["zmodload", "emulate", "sysopen", "sysread", "syswrite", "sysseek", "zpty", "ztcp", "zsocket", "zf_rm", "zf_mv", "zf_ln", "zf_chmod", "zf_chown", "zf_mkdir", "zf_rmdir", "zf_chgrp"]) assert.ok(P.ZSH_DANGEROUS.has(n), n);
  // An exact rule for the whole command still approves it as written (Claude Code: rules match the text as typed).
  assert.equal(decide("echo =ls", { rules: { allow: ["Bash(echo =ls)"], ask: [], deny: [] } }).verdict, "allow");
});

test("CD457 the machine's presets are Claude Code's cloud machine's: TERM=linux, no LANG, CI or NO_COLOR, DEBIAN_FRONTEND=noninteractive, PYTHONUNBUFFERED=1, IS_SANDBOX=1; git never prompts and turns git@github.com: into https; the AWS and Google tools get its \"proxy-injected\" placeholders", () => {
  const e = C.cleanEnv("/work/p");
  assert.deepEqual([e.TERM, e.DEBIAN_FRONTEND, e.PYTHONUNBUFFERED, e.IS_SANDBOX], ["linux", "noninteractive", "1", "1"]);
  for (const k of ["LANG", "CI", "NO_COLOR"]) assert.equal(k in e, false, k);
  assert.deepEqual([e.GIT_TERMINAL_PROMPT, e.GIT_ASKPASS, e.GCM_INTERACTIVE, e.GH_NO_UPDATE_NOTIFIER], ["0", "", "never", "1"]);
  assert.deepEqual([e.GIT_CONFIG_COUNT, e.GIT_CONFIG_KEY_0, e.GIT_CONFIG_VALUE_0, e.GIT_CONFIG_KEY_1, e.GIT_CONFIG_VALUE_1, e.GIT_CONFIG_KEY_2, e.GIT_CONFIG_VALUE_2],
    ["3", "credential.interactive", "false", "url.https://github.com/.insteadOf", "git@github.com:", "url.https://github.com/.insteadOf", "ssh://git@github.com/"]);
  assert.deepEqual([e.AWS_ACCESS_KEY_ID, e.AWS_SECRET_ACCESS_KEY, e.CLOUDSDK_AUTH_ACCESS_TOKEN], ["proxy-injected", "proxy-injected", "proxy-injected"]);
  // Root's own commands: the presets, not the AI's git or placeholder ones.
  const r = C.cleanEnv(null, { root: true });
  assert.equal(r.TERM, "linux");
  for (const k of ["AWS_ACCESS_KEY_ID", "GIT_CONFIG_COUNT"]) assert.equal(k in r, false, k);
  // Real git with that env: the address is rewritten, and no password is ever waited for.
  assert.equal(spawnSync("git", ["config", "--get-all", "url.https://github.com/.insteadOf"], { encoding: "utf8", env: { ...e, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).stdout, "git@github.com:\nssh://git@github.com/\n");
  assert.equal(spawnSync("git", ["config", "--get", "credential.interactive"], { encoding: "utf8", env: { ...e, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).stdout.trim(), "false");
});

test("CD458 the owner's and the repository's variables win over the machine's presets (JAVA_HOME, TERM …), never over its PATH and HOME; names that only start with PATH, HOME, SHELL or USER reach commands; CDPATH never does; GIT_EDITOR is always true (Claude Code sets it after the session's own)", async () => {
  const vars = { TERM: "xterm-256color", JAVA_HOME: "/opt/jdk", USER_POOL_ID: "pool-1", PATH_PREFIX: "/p", HOMEBREW_NO_AUTO_UPDATE: "1", SHELLCHECK_OPTS: "-x", PATH: "/evil", HOME: "/evil", CDPATH: "/evil", GIT_EDITOR: "vim" };
  const kept = S.safeVars(vars);
  for (const k of ["TERM", "JAVA_HOME", "USER_POOL_ID", "PATH_PREFIX", "HOMEBREW_NO_AUTO_UPDATE", "SHELLCHECK_OPTS"]) assert.equal(kept[k], vars[k], k);
  for (const k of ["PATH", "HOME", "CDPATH"]) assert.equal(k in kept, false, k);
  const { out } = await job("shop-vars", [say("", [call("bash", { command: "printf '%s|' \"$TERM\" \"$JAVA_HOME\" \"$USER_POOL_ID\" \"$PATH_PREFIX\" \"${CDPATH}\" \"$GIT_EDITOR\"; case \"$PATH:$HOME\" in */evil*) echo BAD;; *) echo ok;; esac" }, "v1")])], { setup: { vars } });
  // (CDPATH empty: zsh always has one, tied to its cdpath list; the owner's never reaches it.)
  assert.equal(out("v1"), "xterm-256color|/opt/jdk|pool-1|/p||true|ok");
});

test("CD459 every tool's own proxy and certificate settings, as Claude Code's cloud machine gives its commands (seen 2026-11-11): Yarn, npm, global-agent, Electron, Docker, gcloud, fsspec, Java (with a trust store holding the gate's certificate), and the certificate files of AWS, Cargo, Deno, gRPC, Hex, httplib2, Nix, pip and uv", async () => {
  const p = "http://cmd:" + "a".repeat(32) + "@127.0.0.1:4567";
  const t = PX.toolProxyEnv(p, 4567, "localhost,127.0.0.1,::1", "a".repeat(32), "/srv/b.pem", "/srv/java-cacerts");
  for (const k of ["YARN_HTTPS_PROXY", "YARN_HTTP_PROXY", "npm_config_https_proxy", "npm_config_proxy", "GLOBAL_AGENT_HTTPS_PROXY", "GLOBAL_AGENT_HTTP_PROXY", "DOCKER_HTTPS_PROXY", "DOCKER_HTTP_PROXY"]) assert.equal(t[k], p, k);
  assert.deepEqual([t.npm_config_noproxy, t.GLOBAL_AGENT_NO_PROXY, t.ELECTRON_GET_USE_PROXY], ["localhost,127.0.0.1,::1", "localhost,127.0.0.1,::1", "1"]);
  assert.deepEqual([t.CLOUDSDK_PROXY_TYPE, t.CLOUDSDK_PROXY_ADDRESS, t.CLOUDSDK_PROXY_PORT, t.CLOUDSDK_PROXY_USERNAME, t.CLOUDSDK_PROXY_PASSWORD], ["http", "127.0.0.1", "4567", "cmd", "a".repeat(32)]);
  assert.equal(t.FSSPEC_GCS, '{"session_kwargs": {"trust_env": true}}');
  assert.equal(t.JAVA_TOOL_OPTIONS, "-Djavax.net.ssl.trustStore=/srv/java-cacerts -Djavax.net.ssl.trustStoreType=JKS -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=4567 -Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=4567 -Dhttp.nonProxyHosts=localhost|127.0.0.1|::1 -Daether.connector.http.useSystemProperties=true");
  for (const k of ["CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE", "HTTPLIB2_CA_CERTS", "AWS_CA_BUNDLE", "DENO_CERT", "CARGO_HTTP_CAINFO", "PIP_CERT", "GRPC_DEFAULT_SSL_ROOTS_FILE_PATH", "NIX_SSL_CERT_FILE", "HEX_CACERTS_PATH"]) assert.equal(t[k], "/srv/b.pem", k);
  assert.deepEqual([t.DENO_TLS_CA_STORE, t.UV_NATIVE_TLS], ["system,mozilla", "true"]);
  // No pass: no gcloud login for the proxy; no Java store: Java's own.
  const t0 = PX.toolProxyEnv("http://127.0.0.1:1", 1, "localhost", "", "/b", "");
  assert.equal("CLOUDSDK_PROXY_USERNAME" in t0, false);
  assert.ok(!t0.JAVA_TOOL_OPTIONS.includes("trustStore"));
  // A real gate: its env has them all; with Java here, a real Java request goes through it, the owner's key added on the way.
  const dir = await mkdtemp(join(tmpdir(), "coder-pxb-"));
  const certs = await mkdtemp(join(tmpdir(), "coder-upb-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(certs, "k"), "-out", join(certs, "c"), "-days", "2", "-subj", "/CN=api.example.com", "-addext", "subjectAltName=DNS:api.example.com"], { stdio: "ignore" });
  const up = https.createServer({ key: readFileSync(join(certs, "k")), cert: readFileSync(join(certs, "c")) }, (q, r) => r.end("auth=" + (q.headers.authorization || "none")));
  await new Promise((ok) => up.listen(0, "127.0.0.1", ok));
  const px = await PX.startProxy({ dir, upstream: { host: "127.0.0.1", port: up.address().port, ca: readFileSync(join(certs, "c")) } });
  try {
    const env = px.env();
    for (const k of ["YARN_HTTPS_PROXY", "npm_config_https_proxy", "JAVA_TOOL_OPTIONS", "CLOUDSDK_PROXY_PORT", "AWS_CA_BUNDLE", "UV_NATIVE_TLS"]) assert.ok(env[k], k);
    assert.equal(env.CLOUDSDK_PROXY_PORT, String(px.port));
    const haveJava = existsSync("/usr/bin/java") && existsSync("/usr/bin/keytool") && ["/etc/ssl/certs/java/cacerts", "/usr/lib/jvm/java-21-openjdk-amd64/lib/security/cacerts"].some((f) => existsSync(f));
    if (haveJava) {
      assert.match(env.JAVA_TOOL_OPTIONS, new RegExp("-Djavax\\.net\\.ssl\\.trustStore=" + dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/java-cacerts "));
      const list = spawnSync("keytool", ["-list", "-keystore", join(dir, "java-cacerts"), "-storepass", "changeit", "-alias", "coder-gate"], { encoding: "utf8" });
      assert.equal(list.status, 0, list.stderr);
      // (Kept while the gate's certificate is older; made again when it is newer.)
      const was = statSync(join(dir, "java-cacerts")).mtimeMs;
      assert.equal(PX.javaTrustStore(dir, px.caFile, ["/etc/ssl/certs/java/cacerts"], ["/usr/bin/keytool"]), join(dir, "java-cacerts"));
      assert.equal(statSync(join(dir, "java-cacerts")).mtimeMs, was);
      px.setSecrets([{ host: "api.example.com", header: "Authorization", value: "Bearer sk_test_JAVA" }]);
      const src = join(certs, "Fetch.java");
      writeFileSync(src, "import java.net.URI;\nimport java.net.http.*;\npublic class Fetch { public static void main(String[] a) throws Exception { HttpClient c = HttpClient.newBuilder().proxy(java.net.ProxySelector.getDefault()).build(); HttpResponse<String> r = c.send(HttpRequest.newBuilder(URI.create(a[0])).build(), HttpResponse.BodyHandlers.ofString()); System.out.println(r.statusCode() + \" \" + r.body()); } }\n");
      const r = await run("java", [src, "https://api.example.com/v1"], { env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, timeout: 90_000 });
      assert.equal(r.stdout.trim(), "200 auth=Bearer sk_test_JAVA", r.stderr);
    }
    // No Java store or keytool here: none, and Java keeps its own.
    assert.equal(PX.javaTrustStore(await mkdtemp(join(tmpdir(), "coder-nj-")), px.caFile, ["/nonexistent/cacerts"], ["/usr/bin/keytool"]), "");
  } finally { await px.close(); up.close(); }
});

test("CD460 a scratchpad folder for each chat (Claude Code's: \"always use it for temporary files … instead of /tmp\", and \"Scratchpad files for current session are allowed for writing\"): Coder is told; a command's write there never asks for its path; made private before each command; in each hook's input as scratchpad_dir", () => {
  // (Claude Code 2.1.325's line, word for word from its raw program, with "chat" and "the owner": sweep 3.)
  assert.ok(A.CODER_SYSTEM.includes("\n- Scratchpad directory: /tmp/coder-scratch \u2014 always use it for temporary files (intermediate results, scripts, outputs that don't belong in the project) instead of `/tmp` or other system temp directories; it is chat-specific, isolated from the project, and can generally be used without permission prompts. A reboot or routine cleanup can clear it, so anything the owner will want to keep belongs somewhere durable instead. Only use `/tmp` if the owner explicitly asks. Whenever you name a file in it to the owner, write the file's complete absolute path in one piece, not a bare filename, a path that starts at the scratchpad folder, or the directory followed by filenames: a shortened path is read against the working directory and leads nowhere.\n"));
  const sc = { scratch: ["/tmp/coder-scratch"] };
  // A read-only command's output there: no asking (Claude Code's redirect check lets its scratchpad through).
  assert.equal(decide("echo hi > /tmp/coder-scratch/notes.txt", sc).verdict, "allow");
  assert.equal(decide("git diff > /tmp/coder-scratch/d.patch", sc).verdict, "allow");
  assert.equal(decide("echo hi > /tmp/coder-scratch/notes.txt").verdict, "ask", "not without it");
  assert.equal(decide("echo hi > /tmp/other.txt", sc).verdict, "ask");
  assert.equal(decide("echo hi > /tmp/coder-scratchy/x", sc).verdict, "ask", "a folder that only starts the same");
  // A file command: its paths pass, and the command is then as any other: asked in Coder's cloud Accept edits (Claude Code's
  // "default"), run in the repository's acceptEdits. (Claude Code: its path check gives "passthrough", then rules decide.)
  assert.equal(decide("mkdir -p /tmp/coder-scratch/a", sc).verdict, "ask");
  assert.equal(decide("mkdir -p /tmp/coder-scratch/a", { ...sc, byCommand: true }).verdict, "allow");
  assert.equal(decide("touch /etc/x", { ...sc, byCommand: true }).verdict, "ask");
  // Through a link that leads out: asked; Plan changes no files, there either.
  const link = decide("echo hi > /tmp/coder-scratch/link/x", { ...sc, real: (p) => (p.startsWith("/tmp/coder-scratch/link") ? p.replace("/tmp/coder-scratch/link", "/etc") : p) });
  assert.equal(link.verdict, "ask");
  assert.equal(decide("echo hi > /tmp/coder-scratch/n.txt", { ...sc, mode: "plan" }).verdict, "ask");
  // Made before each command, for the AI's user only.
  assert.equal(S.SCRATCH_MAKE, "[ -d /tmp/coder-scratch ] || mkdir -m 700 -p /tmp/coder-scratch 2>/dev/null\n");
  assert.ok(S.commandPrefix("/home/dev").includes(S.SCRATCH_MAKE));
  const tmp = spawnSync("bash", ["-c", S.SCRATCH_MAKE.replace(/\/tmp\/coder-scratch/g, "$T") + "stat -c %a \"$T\""], { encoding: "utf8", env: { PATH: process.env.PATH, T: join(tmpdir(), "coder-scr-" + process.pid) } });
  assert.equal(tmp.stdout.trim(), "700");
  // Hooks get it, after cwd, as Claude Code's common fields put it.
  const keys = Object.keys(H.hookInput("Stop", { session: "s", promptId: "p-1" }));
  assert.deepEqual(keys.slice(0, 4), ["session_id", "prompt_id", "cwd", "scratchpad_dir"]);
  assert.equal(H.hookInput("Stop", { session: "s" }).scratchpad_dir, "/tmp/coder-scratch");
});

test("CD461 a command's output and its errors come back in the order printed, as Claude Code's do (one file for both): before, Coder read them apart and errors landed after everything else", async () => {
  const { out } = await job("shop-order", [say("", [call("bash", { command: "echo one; echo two >&2; echo three; echo four >&2; exit 3" }, "o1")])]);
  assert.equal(out("o1"), "Exit code 3\none\ntwo\nthree\nfour");
});

test("CD462 commands that only read, several in one reply, run at the same time (Claude Code runs a Bash call alongside others when it only reads): each starts in the order asked, the results come back in that order; one that changes something, has hooks, or runs in the background runs in its turn", async () => {
  const started = [], finished = [], log = [];
  let open = 0, most = 0, asked = 0;
  const exec = async ({ command }) => {
    started.push(command); log.push("start:" + command); open++; most = Math.max(most, open);
    await new Promise((ok) => setTimeout(ok, command.includes("slow") ? 120 : 20));
    open--; finished.push(command); log.push("end:" + command);
    return { code: 0, output: command.replace(/^echo /, "") + "\n" };
  };
  const ask = async () => { asked++; return { choice: "yes" }; };
  const calls = [call("bash", { command: "echo slow" }, "1"), call("bash", { command: "echo b" }, "2"), call("bash", { command: "echo c" }, "3"), call("bash", { command: "touch x.txt" }, "4"), call("bash", { command: "echo d" }, "5")];
  const seen = [];
  let n = 0;
  const r = await A.runCoder({ root: ROOT, here: () => ROOT, home: "/home/dev", exec, ask, send: async (req) => { n++; if (n === 1) return say("", calls); seen.push(...req.messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id + "=" + String(m.content).trim())); return say("Done."); } }, { text: "go", mode: "acceptEdits", rules: { allow: ["Bash(touch *)"], ask: [], deny: [] } });
  assert.equal(r.status, "done");
  assert.deepEqual(started.slice(0, 3), ["echo slow", "echo b", "echo c"], "the run of three starts in the order asked");
  assert.equal(most, 3, "all three at once");
  assert.ok(finished.indexOf("echo b") < finished.indexOf("echo slow"), "the slow one did not hold the others up");
  assert.ok(log.indexOf("start:touch x.txt") > log.indexOf("end:echo slow"), "the write waits its turn");
  assert.ok(log.indexOf("start:echo d") > log.indexOf("end:touch x.txt"), "and the one after it its own");
  assert.equal(asked, 0);
  assert.deepEqual(seen.map((x) => x.split("=")[0]), ["1", "2", "3", "4", "5"], "results in the order asked");
  // With a hook, each in its turn (a PreToolUse hook could change or stop any of them).
  started.length = 0; finished.length = 0; log.length = 0; open = 0; most = 0; n = 0;
  await A.runCoder({ root: ROOT, here: () => ROOT, home: "/home/dev", exec, ask, send: async () => { n++; return n === 1 ? say("", calls.slice(0, 3)) : say("Done."); } }, { text: "go", mode: "acceptEdits", hooks: [{ event: "PreToolUse", matcher: "Bash", type: "command", command: "true" }] });
  assert.equal(most, 1);
});

test("CD463 numbers as Claude Code reads them (its mp: 300_000, 300,000, 3e5), for BASH_DEFAULT_TIMEOUT_MS and BASH_MAX_TIMEOUT_MS", () => {
  assert.equal(S.envNumber("300_000"), 300000);
  assert.equal(S.envNumber("300,000"), 300000);
  assert.equal(S.envNumber("3e5"), 300000);
  assert.equal(S.envNumber(" 42 "), 42);
  assert.equal(S.envNumber("1_000_000"), 1000000);
  assert.ok(Number.isNaN(S.envNumber("abc")));
  assert.equal(S.envNumber("12_34"), 12, "not grouped by three: read as far as it goes, as parseInt");
  const t = S.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: "300_000", BASH_MAX_TIMEOUT_MS: "1,200,000" });
  assert.deepEqual([t.defaultMs, t.maxMs], [300000, 1200000]);
});

test("CD464 the gate's refusals say why in a header too, as Claude Code's proxy's (x-deny-reason: host_not_allowed); a command that failed hears which connections to allowed sites failed while it ran, in Claude Code's words, and where to see them all", async () => {
  // The note itself (Claude Code's v0t, seen in a cloud session).
  const k = "connect_unreachable", why = PX.FAIL_KINDS[k];
  assert.equal(why, "the host is allowed for this session, but the egress proxy could not connect to it, for example because the name has no public DNS record or the host is down or on a private network; changing the allowed domains does not help");
  const at = (host) => ({ ts: "t", kind: k, detail: "d", host });
  assert.equal(PX.failedNote([at("a.example.com:443")], 1, "http://127.0.0.1:9/__agentproxy/status"),
    "[agent-proxy] While this command ran, 1 connection through the agent proxy failed:\n- a.example.com:443 — connect_unreachable (" + why + ")\nFor details: curl -sS http://127.0.0.1:9/__agentproxy/status");
  const many = [at("a:443"), at("b:443"), at("a:443"), at("c:80"), at("d:443")];
  const note = PX.failedNote(many, 7, "http://s");
  assert.match(note, /^\[agent-proxy\] While this command ran, 7 connections through the agent proxy failed:\n- d:443 — connect_unreachable \(/, "the newest first");
  assert.match(note, /\n- a:443 — connect_unreachable \([^)]*\) ×2\n/);
  assert.match(note, /\n- and 1 more\n\(oldest 2 not shown\)\nFor details: curl -sS http:\/\/s$/);
  assert.match(PX.failedNote([at("x".repeat(90) + ":443")], 1, "http://s"), /- x{80}… \[\+14 chars\] —/);
  assert.equal(PX.failedNote([], 0, "http://s"), "");
  assert.equal(PX.failedNote([at("a:443")], 1, ""), "", "no status page: none, as Claude Code's");
  // A real gate.
  const dir = await mkdtemp(join(tmpdir(), "coder-pxf-"));
  const px = await PX.startProxy({ dir, systemCa: "/nonexistent", javaCa: [], keytool: [] });
  try {
    px.setNetwork({ mode: "limited", hosts: ["no-such-host-q8z1.invalid", "other-missing-7c.invalid"] });
    const c0 = px.failCount();
    const curl = (url, extra = []) => run("curl", ["-sS", "-m", "20", "-o", "/dev/null", "-D", "-", "--noproxy", "", "-x", "http://127.0.0.1:" + px.port, ...extra, url], { env: { PATH: process.env.PATH } });
    const blocked = await curl("https://blocked.example.org/", ["--proxy-header", "X-Probe: 1"]);
    assert.match(blocked.stderr + blocked.stdout, /403/);
    const plain = await curl("http://blocked.example.org/");
    assert.match(plain.stdout, /^x-deny-reason: host_not_allowed\r?$/im);
    const raw = await new Promise((ok) => { const s = net.connect(px.port, "127.0.0.1", () => s.write("CONNECT blocked.example.org:443 HTTP/1.1\r\nHost: blocked.example.org:443\r\n\r\n")); let b = ""; s.on("data", (d) => { b += d; }); s.on("close", () => ok(b)); s.on("error", () => ok(b)); });
    assert.match(raw, /^HTTP\/1\.1 403 Forbidden\r\n[\s\S]*\r\nX-Deny-Reason: host_not_allowed\r\n/);
    assert.equal(px.failCount(), c0, "a block is not such a failure (Coder's own note names blocks)");
    const one = await curl("https://no-such-host-q8z1.invalid/");
    assert.match(one.stderr, /CONNECT tunnel failed, response 502/);
    await curl("https://no-such-host-q8z1.invalid/");
    const p2 = await curl("http://other-missing-7c.invalid/x");
    assert.match(p2.stdout, /^HTTP\/1\.1 502/);
    assert.equal(px.failCount() - c0, 3);
    const text = px.failedSince(c0);
    assert.equal(text, "[agent-proxy] While this command ran, 3 connections through the agent proxy failed:\n- other-missing-7c.invalid:80 — connect_unreachable (" + why + ")\n- no-such-host-q8z1.invalid:443 — connect_unreachable (" + why + ") ×2\nFor details: curl -sS http://127.0.0.1:" + px.port + "/__agentproxy/status");
    assert.equal(px.failedSince(px.failCount()), "", "none since");
    // Its status page: what the gate is, its recent failures and blocks; never a secret.
    px.setSecrets([{ host: "api.example.com", header: "Authorization", value: "Bearer sk_live_NEVERSHOWN" }]);
    const st = await run("curl", ["-sS", "--noproxy", "*", "http://127.0.0.1:" + px.port + "/__agentproxy/status"]);
    const page = JSON.parse(st.stdout);
    assert.equal(page.enabled, true);
    assert.equal(page.port, px.port);
    assert.deepEqual(page.recentRelayFailures.map((f) => [f.kind, f.host]), [[k, "no-such-host-q8z1.invalid:443"], [k, "no-such-host-q8z1.invalid:443"], [k, "other-missing-7c.invalid:80"]]);
    assert.ok(page.recentBlocks.some((b) => b.host === "blocked.example.org"));
    assert.doesNotMatch(st.stdout, /sk_live|api\.example\.com/);
  } finally { await px.close(); }
  // Coder's loop adds the note only to a command that failed, after a blank line (Claude Code: only when the result is an error).
  const results = [];
  const notes = { f1: { code: 6, output: "curl: (56) CONNECT tunnel failed, response 502\n", failNote: "[agent-proxy] NOTE" }, f2: { code: 0, output: "fine\n", failNote: "[agent-proxy] NOTE" }, f3: { code: 1, output: "", failNote: "[agent-proxy] NOTE" } };
  let n = 0;
  await A.runCoder({ root: ROOT, here: () => ROOT, home: "/home/dev", ask: async () => ({ choice: "yes" }), exec: async ({ command }) => notes[command.split(" ")[1]], emit: (e) => { if (e.type === "result") results.push(e); }, send: async () => { n++; return n === 1 ? say("", [call("bash", { command: "curl f1" }, "f1"), call("bash", { command: "grep f2 x" }, "f2"), call("bash", { command: "grep f3 x" }, "f3")]) : say("Done."); } }, { text: "go", mode: "acceptEdits", rules: { allow: ["Bash(curl *)"], ask: [], deny: [] } });
  const outOf = (id) => results.find((e) => e.id === id).output;
  assert.equal(outOf("f1"), "Exit code 6\ncurl: (56) CONNECT tunnel failed, response 502\n\n[agent-proxy] NOTE");
  assert.equal(outOf("f2"), "fine");
  assert.doesNotMatch(outOf("f3"), /agent-proxy/, "grep's exit 1 is no failure");
});

test("CD465 four more of Claude Code's command settings can come from a repository's .claude/settings.json, as in Claude Code 2.1.322 (none on its list of names project settings can't set): CLAUDE_CODE_SHELL_PREFIX, CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE, CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP, CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS; the owner's own win", async () => {
  assert.deepEqual([S.REPO_OWN_ENV.CLAUDE_CODE_SHELL_PREFIX, S.REPO_OWN_ENV.CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE, S.REPO_OWN_ENV.CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP, S.REPO_OWN_ENV.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS],
    ["CODER_SHELL_PREFIX", "CODER_TOOL_MEMORY_CGROUP_EXCLUDE", "CODER_DISABLE_BG_SHELL_PRESSURE_REAP", "CODER_SESSIONEND_HOOKS_TIMEOUT_MS"]);
  const d = await mkdtemp(join(tmpdir(), "coder-own4-"));
  await mkdir(join(d, ".claude"));
  await writeFile(join(d, ".claude", "settings.json"), JSON.stringify({ env: { CLAUDE_CODE_SHELL_PREFIX: "/opt/audit/log.sh", CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE: "none", CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP: "1", CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS: "5000" } }));
  const rs = S.repoSettings(d, {});
  assert.deepEqual(rs.own, { CODER_SHELL_PREFIX: "/opt/audit/log.sh", CODER_TOOL_MEMORY_CGROUP_EXCLUDE: "none", CODER_DISABLE_BG_SHELL_PRESSURE_REAP: "1", CODER_SESSIONEND_HOOKS_TIMEOUT_MS: "5000" });
  assert.deepEqual(S.withRepoOwn({ CODER_SHELL_PREFIX: "/mine.sh" }, rs.own).CODER_SHELL_PREFIX, "/mine.sh");
  // (Coder's own names never come from a repository's env.)
  assert.ok(S.REPO_ENV_OFF.test("CODER_SHELL_PREFIX"));
});

test("CD466 a repository's settings files changed while Coder works count from its next step, as Claude Code \"watches your settings files and reloads them when they change … including edits to permissions, hooks\": a new deny rule stops the next command, a new hook runs; a read block they turn on stays on for the job", async () => {
  // The files' stamp: changed by a write, a new file or a removed one; nothing read.
  const d = await mkdtemp(join(tmpdir(), "coder-stamp-"));
  const s0 = S.repoFilesStamp(d);
  await mkdir(join(d, ".claude"));
  await writeFile(join(d, ".claude", "settings.local.json"), "{}");
  const s1 = S.repoFilesStamp(d);
  assert.notEqual(s1, s0);
  await writeFile(join(d, ".claude", "settings.local.json"), "{\"a\":1}");
  assert.notEqual(S.repoFilesStamp(d), s1);
  assert.equal(S.repoFilesStamp(d), S.repoFilesStamp(d));
  // A job: after its first command, the repository's file gets a deny rule and a PostToolUse hook.
  const settings = { permissions: { deny: ["Bash(echo two)"] }, hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ran >> hook-ran.txt" }] }] } };
  const { out, dir } = await job("shop-live", [say("", [call("bash", { command: "echo one" }, "l1")]), say("", [call("bash", { command: "echo two" }, "l2")]), say("", [call("bash", { command: "echo three" }, "l3")])], {}, {
    onSend: async (k, _req, pdir) => { if (k === 1) { await mkdir(join(pdir, ".claude"), { recursive: true }); await writeFile(join(pdir, ".claude", "settings.json"), JSON.stringify(settings)); } },
  });
  assert.equal(out("l1"), "one");
  assert.notEqual(out("l2"), "two");
  assert.match(out("l2"), /denied|deny/i);
  assert.equal(out("l3"), "three");
  assert.equal(readFileSync(join(dir, "hook-ran.txt"), "utf8"), "ran\n", "the new hook ran once, after the third");
  // The loop's side: new hooks and blocks from the machine before each step; a read block stays on once on.
  let blocks = null, hooksNow = null, k = 0;
  const seen = [];
  await A.runCoder({ root: ROOT, here: () => ROOT, home: "/home/dev", ask: async () => ({ choice: "no" }), exec: async ({ command }) => { seen.push(command); return { code: 0, output: "x\n" }; }, rulesNow: () => null, hooksNow: () => hooksNow, blocksNow: () => blocks,
    send: async () => { k++; if (k === 1) return say("", [call("bash", { command: "cat /etc/hostname" }, "b1")]); if (k === 2) { blocks = { read: true, write: false }; return say("", [call("bash", { command: "cat /etc/hostname" }, "b2")]); } if (k === 3) { blocks = { read: false, write: false }; return say("", [call("bash", { command: "cat /etc/hostname" }, "b3")]); } return say("Done."); } },
    { text: "go", mode: "acceptEdits", rules: { allow: ["Read(//etc/**)"], ask: [], deny: [] } });
  assert.deepEqual(seen, ["cat /etc/hostname"], "after the block came on, the read outside ran no more, and its removal did not lift it");
});
