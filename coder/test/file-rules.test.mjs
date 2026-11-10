// READ(…) AND EDIT(…) RULES (Bash docs, the owner, 2026-11-10: "yea do all 4"): Claude Code's file permission rules in
// Coder, on its own file tools and on the files Coder's commands read and write. Each case is from Claude Code's
// permissions docs ("Read and Edit") or its own words (2.1.322).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const F = await import("../container/coder-filerules.mjs");
const P = await import("../container/coder-perms.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ROOT = "/work/shop", HOME = "/home/dev";
const ctx = { root: ROOT, home: HOME };
const hit = (list, path, kind = "deny", tool = "Read", c = ctx) => F.fileRuleHit(list, tool, path, kind, c);

test("CD382 a Read or Edit rule's path, as Claude Code reads it: gitignore patterns with four anchors (//, ~/, / and the project), any depth for a bare name, a single folder at any depth only in deny and ask rules, `!` carve-outs from the plain relative rules before them, and links", () => {
  // "Read(.env) and Read(**/.env) are equivalent": any .env at or under the project, none above it.
  for (const r of ["Read(.env)", "Read(**/.env)", "Read(./.env)"]) {
    assert.equal(hit([r], ROOT + "/.env"), r);
    assert.equal(hit([r], ROOT + "/config/deep/.env"), r);
    assert.equal(hit([r], "/work/.env"), "", "not in a parent folder");
  }
  assert.equal(hit(["Read(//**/.env)"], "/etc/app/.env"), "Read(//**/.env)", "anywhere on the machine");
  // The four anchors: //path from the root, ~/path from Coder's home, /path from the project (Coder's rules are kept per
  // repository, as Claude Code's local settings, "<primary working directory>/path").
  assert.equal(hit(["Edit(//tmp/scratch.txt)"], "/tmp/scratch.txt", "deny", "Edit"), "Edit(//tmp/scratch.txt)");
  assert.equal(hit(["Read(~/.zshrc)"], HOME + "/.zshrc"), "Read(~/.zshrc)");
  assert.equal(hit(["Read(~/.zshrc)"], HOME + "/a/.zshrc"), "", "anchored at the home folder");
  assert.equal(hit(["Edit(/docs/**)"], ROOT + "/docs/a.md", "deny", "Edit"), "Edit(/docs/**)");
  assert.equal(hit(["Edit(/docs/**)"], "/docs/a.md", "deny", "Edit"), "", "not /docs");
  assert.equal(hit(["Read(/.env)"], ROOT + "/a/.env"), "", "/.env: the project's top only");
  // Claude Code's table: a top src/ and a nested vendor/pkg/src/.
  const top = ROOT + "/src/app.ts", nested = ROOT + "/vendor/pkg/src/lib.js";
  const row = (rule, kind) => [!!hit([rule], top, kind, "Edit"), !!hit([rule], nested, kind, "Edit")];
  assert.deepEqual(row("Edit(src/**)", "allow"), [true, false]);
  assert.deepEqual(row("Edit(src/**)", "deny"), [true, true]);
  assert.deepEqual(row("Edit(src/**)", "ask"), [true, true]);
  assert.deepEqual(row("Edit(/src/**)", "deny"), [true, false]);
  assert.deepEqual(row("Edit(**/src/**)", "allow"), [true, true]);
  assert.equal(hit(["Edit(src/components/**)"], ROOT + "/x/src/components/a.js", "deny", "Edit"), "", "every other shape: anchored");
  // `!` carve-outs: "Read(*.env) followed by Read(!sample.env) blocks every file whose name ends in .env at any depth, except
  // files named sample.env"; "A ! rule listed first carves nothing out"; it can't reach a ~/ rule; nor reopen a file in a
  // folder blocked as a whole.
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], ROOT + "/c/sample.env"), "");
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], ROOT + "/c/prod.env"), "Read(*.env)");
  assert.equal(hit(["Read(!sample.env)", "Read(*.env)"], ROOT + "/c/sample.env"), "Read(*.env)");
  assert.equal(hit(["Read(~/notes/**)", "Read(!~/notes/public/**)"], HOME + "/notes/public/x"), "Read(~/notes/**)");
  assert.equal(hit(["Read(secrets/**)", "Read(!secrets/public/**)"], ROOT + "/secrets/public/a.txt"), "Read(secrets/**)");
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], ROOT + "/c/sample.env", "allow"), "Read(*.env)", "a ! rule is a deny or ask pattern: in an allow list it carves nothing out");
  // Parentheses need no escaping; a class and a folder-only pattern.
  assert.equal(hit(["Edit(./Finance (2024)/**)"], ROOT + "/Finance (2024)/q.xlsx", "deny", "Edit"), "Edit(./Finance (2024)/**)");
  assert.equal(hit(["Read(*.[ch])"], ROOT + "/x/y.c"), "Read(*.[ch])");
  assert.equal(hit(["Read(secrets/)"], ROOT + "/a/secrets/k"), "Read(secrets/)");
  // A rule on the whole tool, as Read, Read(*) or Read(**): every path. Edit rules are not Read rules.
  for (const r of ["Read", "Read(*)", "Read(**)"]) assert.equal(hit([r], "/anywhere/at/all"), r);
  assert.equal(hit(["Edit(.env)"], ROOT + "/.env"), "");
  // Links: a deny rule matches the path asked for or where it leads; an allow rule only when both match ("with
  // Read(./project/**) allowed and Read(~/.ssh/**) denied, a symlink at ./project/key pointing to ~/.ssh/id_rsa is blocked").
  const real = (p) => (p === ROOT + "/key" ? HOME + "/.ssh/id_rsa" : p);
  assert.equal(hit(["Read(~/.ssh/**)"], ROOT + "/key", "deny", "Read", { ...ctx, real }), "Read(~/.ssh/**)");
  assert.equal(hit(["Read(./**)"], ROOT + "/key", "allow", "Read", { ...ctx, real }), "");
  assert.equal(hit(["Read(./**)"], ROOT + "/a.txt", "allow", "Read", { ...ctx, real }), "Read(./**)");
  // "A deny or ask rule written through a symlinked directory with a //, ~/, or / pattern also applies at the directory's real
  // location" (on Coder's machine, /etc stays /etc; here /data is a link to /mnt/data).
  const real2 = (p) => (p === "/data" || p.startsWith("/data/") ? "/mnt" + p : p);
  assert.equal(hit(["Read(//data/**)"], "/mnt/data/x.csv", "deny", "Read", { ...ctx, real: real2 }), "Read(//data/**)");
  // "Claude Code escapes gitignore pattern characters in that path, such as [, ], and *, so the generated rule matches only the
  // literal path you approved": a folder's Read rule, as saved for a cd.
  assert.equal(F.readRuleFor("/tmp/foo"), "Read(//tmp/foo/**)");
  assert.equal(F.readRuleFor("/tmp/run [1]"), "Read(//tmp/run \\[1\\]/**)");
  assert.equal(hit([F.readRuleFor("/tmp/run [1]")], "/tmp/run [1]/a", "allow"), "Read(//tmp/run \\[1\\]/**)");
  assert.equal(hit([F.readRuleFor("/tmp/run [1]")], "/tmp/run 1/a", "allow"), "");
  assert.equal(F.readRuleFor("/"), "", "none for the root");
  // No node: module (the Worker loads the rules module, and so this one).
  assert.doesNotMatch(read("container/coder-filerules.mjs"), /from "node:/);
});

test("CD382b Read and Edit rules are saved and applied; Claude Code's error for :* in a file rule; Write, Glob and Grep rules with a path are kept but never match, with its warning; whole-tool Write, Grep, Glob and LSP rules apply to Coder's tools", async () => {
  assert.deepEqual(P.parseRule("Read(./.env)"), { tool: "Read", spec: "./.env" });
  assert.deepEqual(P.parseRule("Edit(src/**)"), { tool: "Edit", spec: "src/**" });
  for (const r of ["Read", "Read(*)", "Read(**)"]) assert.deepEqual(P.parseRule(r), { tool: "Read", spec: null }, r);
  for (const t of ["Write", "Grep", "Glob", "LSP"]) assert.deepEqual(P.parseRule(t), { tool: t, spec: null });
  // Claude Code: 'The ":*" syntax is only for Bash prefix rules', with its suggestion and examples.
  assert.equal(P.ruleProblem("Read(src:*)"), 'The ":*" syntax is only for Bash prefix rules. Use glob patterns like "*" or "**" for file matching. Examples: Read(*.ts) - matches .ts files, Read(src/**) - matches all files in src, Read(**/*.test.ts) - matches test files');
  assert.equal(P.ruleSaved("Edit(x:*)"), false);
  // "It checks file permissions against Edit and Read rules only … It keeps the rule": its warning in full, and its row for a
  // deny or ask rule ("⚠ Deny rule Write(docs/**) never matches · use Edit(docs/**)"); none for an allow rule's row.
  assert.equal(P.ruleSaved("Write(docs/**)"), true);
  assert.equal(P.parseRule("Write(docs/**)"), null, "never matches");
  assert.deepEqual(P.ruleWarning("deny", "Write(docs/**)"), { warning: "Write(docs/**) is not matched by file permission checks — only Edit(path) rules are. Use Edit(docs/**) instead (Edit rules cover all file-editing tools).", notice: "Deny rule Write(docs/**) never matches · use Edit(docs/**)" });
  assert.deepEqual(P.ruleWarning("allow", "Glob(src/**)"), { warning: "Glob(src/**) is not matched by file permission checks — only Read(path) rules are. Use Read(src/**) instead (Read rules cover all file-reading tools).", notice: "" });
  assert.equal(P.ruleSaved("Edit(file_path:a.js)"), true);
  assert.match(P.ruleWarning("deny", "Edit(file_path:a.js)").warning, /targets file_path as a raw string and will not match — use Edit\(…\) for Edit's own matcher\.$/);
  assert.equal(P.ruleWarning("deny", "Read(./.env)"), null);
  // A tool of Claude Code's that Coder has no copy of is still refused.
  for (const r of ["NotebookEdit", "WebSearch", "Agent"]) assert.equal(P.ruleSaved(r), false, r);
  // The Worker takes them, and its message names them.
  const R = await import("../src/coder-routes.mjs");
  const bucket = { m: new Map(), async get(k) { return this.m.has(k) ? { text: async () => this.m.get(k) } : null; }, async put(k, v) { this.m.set(k, String(v)); } };
  await R.changeRules(bucket, "u1", "ana/shop", "deny", ["Read(./.env)", "Edit(secrets/**)", "Write"]);
  assert.deepEqual((await R.rulesOf(bucket, "u1", "ana/shop")).deny, ["Read(./.env)", "Edit(secrets/**)", "Write"]);
  assert.match(read("src/coder-routes.mjs"), /Read\(\.\/\.env\), Edit\(src\/\*\*\), Read, Edit, Write, Grep, Glob or Monitor/);
});

test("CD382c the files Coder's commands name go by the owner's Read and Edit rules, in every mode: a deny refuses (cat, head, < file, > file, tee, rm, cp's source) in Claude Code's words; an ask asks; allow rules open paths outside the project, never a protected file and never in Plan; a cd outside is offered its own Read rule", () => {
  const d = (command, rules, mode = "auto", extra = {}) => P.bashDecision(command, { mode, rules, cwd: ROOT, workdirs: [ROOT], home: HOME, isProtected: (p) => (p.includes("/.claude/") ? "protected" : ""), ...extra });
  const deny = { deny: ["Read(.env)", "Edit(secrets/**)", "Read(~/.ssh/**)"] };
  // Deny, in auto mode too ("Deny rules block in every mode"), each in Claude Code's words for that path.
  assert.deepEqual([d("cat .env", deny).verdict, d("cat .env", deny).rule], ["deny", "Read(.env)"]);
  assert.equal(d("cat config/.env", deny).why, "cat in '/work/shop/config/.env' was blocked. For security, Coder may only concatenate files from the allowed working directories for this session: '/work/shop'.");
  assert.equal(d("grep TOKEN < .env", deny).why, "Input redirection from '/work/shop/.env' was blocked. For security, Coder may only read files in the allowed working directories for this session: '/work/shop'.");
  assert.equal(d("echo hi > secrets/a.txt", deny).why, "Output redirection to '/work/shop/secrets/a.txt' was blocked. For security, Coder may only write to files in the allowed working directories for this session: '/work/shop'.");
  assert.equal(d("make | tee secrets/log.txt", deny).verdict, "deny");
  assert.equal(d("rm secrets/k", deny, "acceptEdits").verdict, "deny");
  assert.equal(d("cp .env /tmp/x", deny).rule, "Read(.env)", "cp reads its source");
  assert.equal(d("head -5 ~/.ssh/id_rsa", deny).rule, "Read(~/.ssh/**)");
  assert.equal(d("cat secrets/*", { deny: ["Read(secrets/**)"] }).verdict, "deny", "a wildcard: the folder it reads");
  assert.equal(d("cat README.md && echo ok > out.txt", deny).verdict, "allow", "other files: as before");
  // Ask: the owner's rule asks each time (no "don't ask again").
  const a = d("cat notes.md", { ask: ["Read(*.md)"] });
  assert.deepEqual([a.verdict, a.rule, a.why, a.suggest, a.byRule], ["ask", "Read(*.md)", "Your rule Read(*.md) asks first for this command.", null, true]);
  // Allow: a read outside the project (which asks in Accept edits and Plan) is open by a Read rule; a write outside, in Accept
  // edits, by an Edit rule ("A rule such as Bash(git commit *) allows the command, not the target").
  assert.equal(d("cat /etc/hostname", {}, "acceptEdits").verdict, "ask");
  assert.equal(d("cat /etc/hostname", { allow: ["Read(//etc/**)"] }, "acceptEdits").verdict, "allow");
  assert.equal(d("wc -l < /etc/hosts", { allow: ["Read(//etc/**)"] }, "plan").verdict, "allow");
  assert.equal(d("echo x > /tmp/out.txt", {}, "acceptEdits").verdict, "ask");
  assert.equal(d("echo x > /tmp/out.txt", { allow: ["Edit(//tmp/**)"] }, "acceptEdits").verdict, "allow");
  assert.equal(d("mkdir /tmp/newdir && touch /tmp/newdir/a", { allow: ["Edit(//tmp/**)"] }, "acceptEdits").verdict, "allow");
  assert.equal(d("echo x > /tmp/out.txt", { allow: ["Edit(//tmp/**)"] }, "plan").verdict, "ask", "Plan mode changes no files");
  assert.equal(d("echo x > ~/out.txt", { allow: ["Edit(~/**)"] }, "acceptEdits").verdict, "ask", "a target that starts with ~ needs your approval");
  assert.equal(d("echo hi > .claude/settings.json", { allow: ["Edit(.claude/**)"] }, "acceptEdits").verdict, "ask", "allow rules do not pre-approve protected-path writes");
  // A cd out of the project: "generate their own Read rule for that path"; with it, the cd and the reads there run, and a path
  // that climbs out of that folder still asks.
  assert.deepEqual(d("cd /tmp/data && ls", {}, "acceptEdits").suggest, ["Read(//tmp/data/**)"]);
  assert.deepEqual(d("cd /tmp/data && npm test", {}, "acceptEdits").suggest, ["Read(//tmp/data/**)", "Bash(npm test *)"]);
  assert.equal(d("cd /tmp/data && git status", {}, "acceptEdits").suggest, null, "git after a cd: never offered");
  assert.equal(d("cd /tmp/data && ls", { allow: ["Read(//tmp/data/**)"] }, "acceptEdits").verdict, "allow");
  assert.equal(d("cd /tmp/data && cat ../../etc/passwd", { allow: ["Read(//tmp/data/**)"] }, "acceptEdits").verdict, "ask");
  // The files a command names, as the rules see them.
  // (sed reads the file it names, and sed -i changes it too.)
  assert.deepEqual(P.commandFiles(P.readCommand("sed -i s/a/b/ x.txt > /tmp/o < in.txt", { cwd: ROOT }), { cwd: ROOT }).map((f) => [f.tool, f.path, f.how]), [["Read", ROOT + "/x.txt", "cmd"], ["Edit", ROOT + "/x.txt", "cmd"], ["Read", ROOT + "/x.txt", "cmd"], ["Read", ROOT + "/in.txt", "in"], ["Edit", "/tmp/o", "out"]]);
});

test("CD382d Coder's file tools go by them too: a Read deny refuses read, grep and glob (and the folder a search starts in) in Claude Code's words before anything runs; a Read deny refuses write and edit too; an Edit deny refuses them; an ask rule asks on a card; a search's results leave out what a deny rule covers; an @-mentioned file a rule covers is left out", async () => {
  const fd = (tool, path, rules) => P.fileToolDecision(tool, path, { rules, root: ROOT, home: HOME });
  assert.deepEqual(fd("read", ROOT + "/.env", { deny: ["Read(.env)"] }), { verdict: "deny", rule: "Read(.env)", why: "Permission to read /work/shop/.env has been denied." });
  assert.equal(fd("edit", ROOT + "/.env", { deny: ["Read(.env)"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be edited.");
  assert.equal(fd("write", ROOT + "/.env", { deny: ["Read(.env)"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be written.");
  assert.equal(fd("edit", ROOT + "/locked/a.js", { deny: ["Edit(locked/**)"] }).why, "File is in a directory that is denied by your permission settings.");
  assert.equal(fd("grep", ROOT + "/secrets", { deny: ["Read(secrets/**)"] }).verdict, "deny", "Claude Code applies Read deny rules to that directory");
  assert.equal(fd("grep", ROOT, { deny: ["Read(secrets/**)"] }).verdict, "", "a search of a folder above it runs (its results are trimmed)");
  assert.equal(fd("write", ROOT + "/a.js", { deny: ["Write"] }).why, "Permission to use Write has been denied.");
  assert.equal(fd("read", ROOT + "/a.js", { deny: ["Read"] }).why, "Permission to use Read has been denied.");
  assert.deepEqual(fd("read", ROOT + "/a.md", { ask: ["Read(*.md)"] }), { verdict: "ask", rule: "Read(*.md)", why: "Your rule Read(*.md) asks first for reading /work/shop/a.md." });
  assert.equal(fd("edit", ROOT + "/a.md", { ask: ["Read(*.md)"] }).verdict, "", "edits go by Edit ask rules");
  // In Coder's loop.
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const tools = [], events = [], cards = [];
  let n = 0;
  const steps = [
    say("", [call("read", { path: ".env" }, "r1"), call("edit", { path: ".env", old_string: "a", new_string: "b" }, "e1"), call("write", { path: "secrets/k.txt", content: "x" }, "w1")]),
    say("", [call("grep", { pattern: "TOKEN" }, "g1"), call("read", { path: "docs/a.md" }, "r2")]),
    say("Done."),
  ];
  const exec = async (x) => {
    const b = String(x.command).split(" ").pop();
    let t = "?";
    try { t = JSON.parse(Buffer.from(b, "base64").toString("utf8")).tool; } catch { /* a command */ }
    tools.push(t);
    if (t === "grep") return { code: 0, output: "./secrets/k.txt:1:TOKEN=1\n./src/a.js:3:const TOKEN = env.TOKEN;\n./.env:1:TOKEN=2" };
    if (t === "read") return { code: 0, output: "     1\t# docs\n" };
    return { code: 0, output: "ok" };
  };
  const r = await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p.replace(/^\.\//, "")),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; },
  }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: ["Read(docs/**)"], deny: ["Read(.env)", "Edit(secrets/**)"] } });
  const out = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.equal(out("r1"), "Permission to read /work/shop/.env has been denied.");
  assert.equal(out("e1"), "File is covered by a Read deny rule in your permission settings and cannot be edited.");
  assert.equal(out("w1"), "File is in a directory that is denied by your permission settings.");
  assert.ok(!tools.includes("edit") && !tools.includes("write"), "nothing was touched: " + tools.join(","));
  assert.equal(out("g1"), "./secrets/k.txt:1:TOKEN=1\n./src/a.js:3:const TOKEN = env.TOKEN;", "the .env line is left out");
  assert.equal(cards.length, 1);
  assert.deepEqual([cards[0].tool, cards[0].path, cards[0].why, cards[0].rules], ["read", "docs/a.md", "Your rule Read(docs/**) asks first for reading /work/shop/docs/a.md.", undefined]);
  assert.match(out("r2"), /# docs/, "Yes: it was read");
  assert.equal(A_without("./.env:1:x\n./b.js:2:y", (p) => p === "./.env"), "./b.js:2:y");
  assert.equal(A_without("./.env:1:x", (p) => p === "./.env"), "no matches", "all left out: no matches");
  // An @-mentioned file a Read deny rule covers is left out, with no word of it ("A refused file leaves nothing in the
  // conversation"); a folder's listing leaves out the names it covers.
  const A = await import("../container/coder-agent.mjs");
  const reads = [];
  const note = await A.mentionNote({ exec: async (x) => { const b = String(x.command).split(" ").pop(); const q = JSON.parse(Buffer.from(b, "base64").toString("utf8")); reads.push(q.tool + ":" + q.args.path); return q.tool === "read" && q.args.path === "conf" ? { code: 1, output: "error: conf is a folder, not a file" } : q.tool === "listing" ? { code: 0, output: ".env\napp.json" } : { code: 0, output: "     1\tx\n" }; }, root: ROOT }, [".env", "conf", "a.js"], { denied: (p) => /(^|\/)\.env$/.test(p) });
  assert.deepEqual(reads, ["read:conf", "listing:conf", "read:a.js"]);
  assert.doesNotMatch(JSON.stringify(note), /\.env/);
  assert.match(JSON.stringify(note), /app\.json/);
});
const { withoutDenied: A_without } = await import("../container/coder-agent.mjs");

test("CD382e the page: a card for a read or a search a rule asks about shows its path; a folder's Read rule is offered as 'reading /tmp/data/'; the rules list says how file rules are written", () => {
  const src = read("public/coder.js");
  assert.match(src, /read: 'Read file', grep: 'Search files', glob: 'Find files', lsp: 'Code lookup'/);
  assert.match(src, /else if \(\/\^\(read\|grep\|glob\|lsp\)\$\/\.test\(e\.tool \|\| ''\)\) body = '<pre class="cd-perm-pre">' \+ esc\(e\.path \|\| ''\) \+ '<\/pre>';/);
  const shown = new Function("return " + src.slice(src.indexOf("const ruleShown = ") + "const ruleShown = ".length, src.indexOf(";\n", src.indexOf("const ruleShown = "))))();
  assert.equal(shown("Read(//tmp/data/**)"), "reading /tmp/data/");
  assert.equal(shown("Read(//tmp/run \\[1\\]/**)"), "reading /tmp/run [1]/");
  assert.equal(shown("Bash(npm test *)"), "npm test *");
  assert.match(src, /For files, <code>Read\(\.\/\.env\)<\/code> or <code>Edit\(src\/\*\*\)<\/code>, written as in a \.gitignore: <code>\/\/<\/code> starts at the machine\\'s root, <code>~\/<\/code> at Coder\\'s home, any other path at the project\./);
  // The machine's image has the new module.
  assert.match(read("container/Dockerfile"), / coder-perms\.mjs coder-filerules\.mjs coder-hooks\.mjs /);
});
