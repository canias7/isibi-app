// READ(…) AND EDIT(…) RULES (Bash docs, the owner, 2026-11-10: "yea do all 4"): Claude Code's file permission rules in
// Coder, on its own file tools and on the files Coder's commands read and write. Each case is from Claude Code's
// permissions docs ("Read and Edit") or its own words (2.1.322).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const F = await import("../container/coder-filerules.mjs");
const P = await import("../container/coder-perms.mjs");
const S = await import("../container/coder-search.mjs");
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
  // (In an allow list too, as Claude Code 2.1.325 matches it: its one library for all allow rules takes a `!` rule as gitignore
  // does. Round 4, 2026-11-14.)
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], ROOT + "/c/sample.env", "allow"), "");
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], ROOT + "/c/prod.env", "allow"), "Read(*.env)");
  // Parentheses need no escaping; a class and a folder-only pattern.
  assert.equal(hit(["Edit(./Finance (2024)/**)"], ROOT + "/Finance (2024)/q.xlsx", "deny", "Edit"), "Edit(./Finance (2024)/**)");
  assert.equal(hit(["Read(*.[ch])"], ROOT + "/x/y.c"), "Read(*.[ch])");
  assert.equal(hit(["Read(secrets/)"], ROOT + "/a/secrets/k"), "Read(secrets/)");
  // A rule on the whole tool, as Read or Read(*): every path. Read(**) is a path rule (round 4): every path below the project,
  // nothing outside it. Edit rules are not Read rules.
  for (const r of ["Read", "Read(*)"]) assert.equal(hit([r], "/anywhere/at/all"), r);
  assert.equal(hit(["Read(**)"], "/anywhere/at/all"), "");
  assert.equal(hit(["Read(**)"], ROOT + "/deep/a.txt"), "Read(**)");
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
  for (const r of ["Read", "Read(*)"]) assert.deepEqual(P.parseRule(r), { tool: "Read", spec: null }, r);
  assert.deepEqual(P.parseRule("Read(**)"), { tool: "Read", spec: "**" }, "a path rule (round 4)");
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
  // A tool of Claude Code's that Coder has no copy of is still refused. (NotebookEdit is Coder's notebook_edit since 2026-11-17:
  // its whole-tool rule applies, and a path in one is kept but never matches, as Write's.)
  for (const r of ["Agent"]) assert.equal(P.ruleSaved(r), false, r);
  for (const r of ["NotebookEdit", "NotebookEdit(*)", "NotebookEdit(docs/**)"]) assert.equal(P.ruleSaved(r), true, r);
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
  // (Claude Code 2.1.322's sentence for the whole command, as its command-line version gave it for every way of naming the
  // file, 2026-11-11.)
  assert.equal(d("cat config/.env", deny).why, "Permission to use Bash with command cat config/.env has been denied.");
  assert.equal(d("grep TOKEN < .env", deny).why, "Permission to use Bash with command grep TOKEN < .env has been denied.");
  assert.equal(d("echo hi > secrets/a.txt", deny).why, "Permission to use Bash with command echo hi > secrets/a.txt has been denied.");
  assert.deepEqual([d("make | tee secrets/log.txt", deny).verdict, d("make | tee secrets/log.txt", deny).why], ["deny", "Permission to use Bash with command make | tee secrets/log.txt has been denied."]);
  assert.deepEqual([d("rm secrets/k", deny, "acceptEdits").verdict, d("rm secrets/k", deny, "acceptEdits").why], ["deny", "Permission to use Bash with command rm secrets/k has been denied."]);
  assert.equal(d("cp .env /tmp/x", deny).rule, "Read(.env)", "cp reads its source");
  assert.equal(d("head -5 ~/.ssh/id_rsa", deny).rule, "Read(~/.ssh/**)");
  assert.equal(d("cat secrets/*", { deny: ["Read(secrets/**)"] }).verdict, "deny", "a wildcard: the folder it reads");
  assert.equal(d("cat README.md && echo ok > out.txt", deny).verdict, "allow", "other files: as before");
  // Ask: the owner's rule asks each time (no "don't ask again").
  const a = d("cat notes.md", { ask: ["Read(*.md)"] });
  // (In Claude Code 2.1.325's words since round 6: its card's line for a rule, "Ask rule … overrides auto mode for this
  // command." in Auto, "Permission rule … requires confirmation for this command." otherwise.)
  assert.deepEqual([a.verdict, a.rule, a.why, a.suggest, a.byRule], ["ask", "Read(*.md)", "Ask rule Read(*.md) overrides auto mode for this command.", null, true]);
  assert.equal(d("cat notes.md", { ask: ["Read(*.md)"] }, "plan").why, "Permission rule Read(*.md) requires confirmation for this command.");
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
  // (Read's own words for a Read path rule, Claude Code 2.1.325's Read validateInput, since 2026-11-14.)
  assert.deepEqual(fd("read", ROOT + "/.env", { deny: ["Read(.env)"] }), { verdict: "deny", rule: "Read(.env)", why: "File is in a directory that is denied by your permission settings." });
  assert.equal(fd("edit", ROOT + "/.env", { deny: ["Read(.env)"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be edited.");
  assert.equal(fd("write", ROOT + "/.env", { deny: ["Read(.env)"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be written.");
  assert.equal(fd("edit", ROOT + "/locked/a.js", { deny: ["Edit(locked/**)"] }).why, "File is in a directory that is denied by your permission settings.");
  assert.equal(fd("grep", ROOT + "/secrets", { deny: ["Read(secrets/**)"] }).verdict, "deny", "Claude Code applies Read deny rules to that directory");
  assert.equal(fd("grep", ROOT, { deny: ["Read(secrets/**)"] }).verdict, "", "a search of a folder above it runs (its results are trimmed)");
  assert.equal(fd("write", ROOT + "/a.js", { deny: ["Write"] }).why, "Permission to use Write has been denied.");
  assert.equal(fd("read", ROOT + "/a.js", { deny: ["Read"] }).why, "Permission to use Read has been denied.");
  assert.deepEqual(fd("read", ROOT + "/a.md", { ask: ["Read(*.md)"] }), { verdict: "ask", rule: "Read(*.md)", why: "Coder requested permissions to read from /work/shop/a.md, but you haven't granted it yet." });
  assert.equal(fd("edit", ROOT + "/a.md", { ask: ["Read(*.md)"] }).verdict, "", "edits go by Edit ask rules");
  // In Coder's loop.
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const tools = [], events = [], cards = [], reqs = [];
  let n = 0;
  const steps = [
    say("", [call("read", { path: ".env" }, "r1"), call("edit", { path: ".env", old_string: "a", new_string: "b" }, "e1"), call("write", { path: "secrets/k.txt", content: "x" }, "w1")]),
    say("", [call("grep", { pattern: "TOKEN" }, "g1"), call("read", { path: "docs/a.md" }, "r2")]),
    say("Done."),
  ];
  const exec = async (x) => {
    const b = String(x.command).split(" ").pop();
    let t = "?";
    try { const q = JSON.parse(Buffer.from(b, "base64").toString("utf8")); t = q.tool; reqs.push(q); } catch { /* a command */ }
    tools.push(t);
    if (t === "grep") return { code: 0, output: "Found 2 files\nsecrets/k.txt\nsrc/a.js" };
    if (t === "read") return { code: 0, output: "     1\t# docs\n" };
    return { code: 0, output: "ok" };
  };
  const r = await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p.replace(/^\.\//, "")),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; },
  }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: ["Read(docs/**)"], deny: ["Read(.env)", "Edit(secrets/**)"] } });
  const out = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.equal(out("r1"), "File is in a directory that is denied by your permission settings.");
  assert.equal(out("e1"), "File is covered by a Read deny rule in your permission settings and cannot be edited.");
  assert.equal(out("w1"), "File is in a directory that is denied by your permission settings.");
  assert.ok(!tools.includes("edit") && !tools.includes("write"), "nothing was touched: " + tools.join(","));
  // (A search's results leave out what a Read deny rule covers inside the search itself, as Claude Code's do, since
  // 2026-11-14: its run gets the owner's Read deny rules, coder-search.mjs; search.test.mjs SR7 runs it.)
  assert.deepEqual(reqs.find((q) => q.tool === "grep").ctx.deny, { rules: ["Read(.env)"], sources: null, root: ROOT, cwd: ROOT, home: "" });
  assert.equal(out("g1"), "Found 2 files\nsecrets/k.txt\nsrc/a.js");
  assert.equal(cards.length, 1);
  assert.deepEqual([cards[0].tool, cards[0].path, cards[0].why, cards[0].rules], ["read", "docs/a.md", "Coder requested permissions to read from /work/shop/docs/a.md, but you haven't granted it yet.", undefined]);
  assert.match(out("r2"), /# docs/, "Yes: it was read");
  // An @-mentioned file a Read deny rule covers is left out, with no word of it ("A refused file leaves nothing in the
  // conversation"); a folder's listing leaves out the names it covers.
  const A = await import("../container/coder-agent.mjs");
  const reads = [];
  const note = await A.mentionNote({ exec: async (x) => { const b = String(x.command).split(" ").pop(); const q = JSON.parse(Buffer.from(b, "base64").toString("utf8")); reads.push(q.tool + ":" + q.args.path); return q.tool === "read" && q.args.path === "conf" ? { code: 1, output: "error: conf is a folder, not a file" } : q.tool === "listing" ? { code: 0, output: ".env\napp.json" } : { code: 0, output: "     1\tx\n" }; }, root: ROOT }, [".env", "conf", "a.js"], { denied: (p) => /(^|\/)\.env$/.test(p) });
  assert.deepEqual(reads, ["read:conf", "listing:conf", "read:a.js"]);
  assert.doesNotMatch(JSON.stringify(note), /\.env/);
  assert.match(JSON.stringify(note), /app\.json/);
});

test("CD382e the page: a card for a read or a search a rule asks about shows its path; a folder's Read rule is offered as 'reading /tmp/data/'; the rules list says how file rules are written", () => {
  const src = read("public/coder.js");
  assert.match(src, /read: 'Read file', grep: 'Search files', glob: 'Find files', lsp: 'Code lookup'/);
  assert.match(src, /else if \(\/\^\(read\|grep\|glob\|lsp\)\$\/\.test\(e\.tool \|\| ''\)\) body = '<pre class="cd-perm-pre">' \+ esc\(e\.path \|\| ''\) \+ '<\/pre>';/);
  const shown = new Function("return " + src.slice(src.indexOf("const ruleShown = ") + "const ruleShown = ".length, src.indexOf(";\n", src.indexOf("const ruleShown = "))))();
  assert.equal(shown("Read(//tmp/data/**)"), "reading /tmp/data/");
  assert.equal(shown("Read(//tmp/run \\[1\\]/**)"), "reading /tmp/run [1]/");
  assert.equal(shown("Bash(npm test *)"), "npm test *");
  // (Where a path counts from, as it is since round 4: a relative one from the folder Coder is in, and for a deny or ask rule
  // from the project and the working folders too. Round 5.)
  assert.match(src, /For files, <code>Read\(\.\/\.env\)<\/code> or <code>Edit\(src\/\*\*\)<\/code>, written as in a \.gitignore: <code>\/\/<\/code> starts at the machine\\'s root, <code>~\/<\/code> at Coder\\'s home, <code>\/<\/code> at the project, and any other path at the folder Coder is in\. Deny and ask rules with such a path also apply from the project and the working folders\./);
  assert.doesNotMatch(src, /any other path at the project/);
  // The machine's image has the new module.
  assert.match(read("container/Dockerfile"), / coder-perms\.mjs coder-filerules\.mjs coder-hooks\.mjs /);
});

test("CD382f a Read(**) or Edit(**) rule is a path rule, in a path rule's words (Claude Code's parser makes only an empty or \"*\" content the whole tool): read's and write's and edit's refusals are their own (\"File is in a directory that is denied by your permission settings.\"), a match only where a link leads is the read check's; an LSP rule on the whole tool or an input asks in Claude Code's words, after a Read ask rule on the file", () => {
  const fd = (tool, path, rules, extra = {}) => P.fileToolDecision(tool, path, { rules, root: ROOT, home: HOME, ...extra });
  const DIR = "File is in a directory that is denied by your permission settings.";
  // Read's: a path rule (Read(**) too) in the Read tool's own words (Claude Code 2.1.325's validateInput); the whole tool's.
  for (const r of ["Read(**)", "Read(src/**)", "Read(//**)"]) assert.deepEqual(fd("read", ROOT + "/src/a.js", { deny: [r] }), { verdict: "deny", rule: r, why: DIR }, r);
  for (const r of ["Read", "Read(*)"]) assert.equal(fd("read", ROOT + "/src/a.js", { deny: [r] }).why, "Permission to use Read has been denied.", r);
  // A link to a denied file: the path asked for is not covered, where it leads is (Claude Code's read check, after its
  // validateInput passed the path as asked).
  const real = (p) => (p === ROOT + "/key" ? HOME + "/.ssh/id_rsa" : p);
  assert.equal(fd("read", ROOT + "/key", { deny: ["Read(~/.ssh/**)"] }, { real }).why, "Permission to read /work/shop/key has been denied.");
  // Grep's, Glob's and LSP's: their read check's words, as before.
  assert.equal(fd("grep", ROOT + "/src", { deny: ["Read(**)"] }).why, "Permission to read /work/shop/src has been denied.");
  assert.equal(fd("lsp", ROOT + "/src/a.js", { deny: ["Read(**)"] }).why, "Permission to read /work/shop/src/a.js has been denied.");
  // Edit's and Write's: an Edit path rule, Edit(**) too, in their own words; the whole tool's as before.
  for (const tool of ["edit", "write"]) {
    assert.deepEqual(fd(tool, ROOT + "/src/a.js", { deny: ["Edit(**)"] }), { verdict: "deny", rule: "Edit(**)", why: DIR }, tool);
    assert.equal(fd(tool, ROOT + "/src/a.js", { deny: ["Edit(*)"] }).why, "Permission to use " + (tool === "edit" ? "Edit" : "Write") + " has been denied.", tool);
  }
  // Their asks in a path rule's words (Claude Code's since round 5): Read(**) and Edit(**) the same as any path.
  assert.equal(fd("read", ROOT + "/a.md", { ask: ["Read(**)"] }).why, "Coder requested permissions to read from /work/shop/a.md, but you haven't granted it yet.");
  assert.equal(fd("edit", ROOT + "/a.md", { ask: ["Edit(**)"] }).why, "Coder requested permissions to write to /work/shop/a.md, but you haven't granted it yet.");
  // LSP: a rule on the whole tool, or on one of its inputs, in Claude Code's words ("Claude requested permissions to use LSP,
  // but you haven't granted it yet."); a Read ask rule on its file first, as Claude Code's own read check of the file asks
  // before them, in that check's words, as Grep's and Glob's ("Claude requested permissions to read from <path>, but you
  // haven't granted it yet.", its Yx; round 3, 2026-11-14).
  const lsp = (rules) => P.fileToolDecision("lsp", ROOT + "/src/a.py", { rules: { allow: [], ask: [], deny: [], ...rules }, root: ROOT, input: { operation: "hover", filePath: "src/a.py", line: 1, character: 1 } });
  const USE = "Coder requested permissions to use LSP, but you haven't granted it yet.";
  for (const r of ["LSP", "LSP(*)", "LS*"]) assert.deepEqual(lsp({ ask: [r] }), { verdict: "ask", rule: r, why: USE }, r);
  assert.deepEqual(lsp({ ask: ["LSP(operation:hover)"] }), { verdict: "ask", rule: "LSP(operation:hover)", why: USE });
  for (const r of ["LSP", "LSP(operation:hover)"]) assert.deepEqual(lsp({ ask: [r, "Read(src/**)"] }), { verdict: "ask", rule: "Read(src/**)", why: "Coder requested permissions to read from /work/shop/src/a.py, but you haven't granted it yet." }, r);
  assert.equal(lsp({ ask: ["LSP"], deny: ["Read(src/**)"] }).verdict, "deny", "a deny first");
  assert.deepEqual(lsp({ ask: ["Grep"] }), { verdict: "", rule: "", why: "" }, "another tool's rule");
});

// ── ROUND 3 (2026-11-14, the owner: "yes pls all of that") ──────────────────────────────────────────────────────────────
test("CD382g the owner's additional working folders work with Coder's file tools, as Claude Code's (\"Files in additional directories follow the same permission rules as the original working directory\"): read, write, edit, grep and glob there (they were refused as outside the project while Coder was told to work there), never their .git; Coder's machine names them to the tools (CODER_WORK_DIRS); a relative deny or ask rule applies there too (Claude Code 2.1.325: \"they now also apply in added directories\"), an allow rule's does not", async () => {
  const { mkdtemp, mkdir, writeFile, readFile: rf } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  // The rules: a relative deny or ask path in each working folder too; an anchored one (/x) and an allow one only at the project.
  const W = "/work/extra", rc = { ...ctx, roots: [W] };
  assert.equal(hit(["Read(.env)"], W + "/.env", "deny", "Read", rc), "Read(.env)");
  assert.equal(hit(["Read(./secrets/**)"], W + "/a/secrets/k", "ask", "Read", rc), "Read(./secrets/**)");
  assert.equal(hit(["Read(config/app.json)"], W + "/config/app.json", "deny", "Read", rc), "Read(config/app.json)");
  assert.equal(hit(["Read(.env)"], W + "/.env"), "", "not without the working folders");
  assert.equal(hit(["Read(/.env)"], W + "/.env", "deny", "Read", rc), "", "/path: the project's only");
  assert.equal(hit(["Edit(src/**)"], W + "/src/a.js", "allow", "Edit", rc), "", "an allow rule: the project's folder only");
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], W + "/sample.env", "deny", "Read", rc), "", "a carve-out there too");
  // The file tools' decision, and the files a command names.
  const fd = (tool, p, rules) => P.fileToolDecision(tool, p, { rules: { allow: [], ask: [], deny: [], ...rules }, root: ROOT, home: HOME, roots: [W] });
  assert.deepEqual(fd("read", W + "/.env", { deny: ["Read(.env)"] }), { verdict: "deny", rule: "Read(.env)", why: "File is in a directory that is denied by your permission settings." });
  assert.equal(fd("grep", W, { ask: ["Read(.env)"] }).verdict, "", "a search of the folder, not of the file");
  assert.equal(fd("edit", W + "/.env", { deny: ["Read(.env)"] }).why, "File is covered by a Read deny rule in your permission settings and cannot be edited.");
  assert.equal(P.bashDecision("cat " + W + "/.env", { mode: "acceptEdits", rules: { allow: [], ask: [], deny: ["Read(.env)"] }, cwd: ROOT, workdirs: [ROOT, W], home: HOME }).verdict, "deny");
  assert.equal(P.bashDecision("cat " + W + "/.env", { mode: "acceptEdits", rules: { allow: [], ask: [], deny: ["Read(.env)"] }, cwd: ROOT, workdirs: [ROOT], home: HOME }).verdict, "ask", "not a working folder: outside, asked as before");
  // The tools script, as Coder's machine runs it.
  const top = await mkdtemp(join(tmpdir(), "coder-workdirs-"));
  const main = join(top, "shop"), extra = join(top, "notes"), outside = join(top, "secret");
  for (const d of [join(main, "src"), join(extra, "sub"), join(extra, ".git"), outside]) await mkdir(d, { recursive: true });
  await writeFile(join(extra, "sub", "b.txt"), "hello extra\n"); await writeFile(join(extra, ".git", "config"), "x\n"); await writeFile(join(outside, "s.txt"), "no\n");
  const tool = (name, args, work = extra) => { const r = spawnSync(process.execPath, ["--no-warnings", new URL("../container/coder-tools.mjs", import.meta.url).pathname, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: main, encoding: "utf8", env: { PATH: process.env.PATH, ...(work ? { CODER_WORK_DIRS: work } : {}) } }); return String(r.stdout || "").replace(/^\u0000coder-facts\u0000[^\n]*\n/, ""); };
  assert.match(tool("read", { path: join(extra, "sub", "b.txt") }), /^\s*1\thello extra/);
  assert.equal(tool("read", { path: join(extra, "sub", "b.txt") }, ""), "error: that path is outside the project", "only the owner's own");
  assert.equal(tool("read", { path: join(outside, "s.txt") }), "error: that path is outside the project", "nothing else");
  assert.equal(tool("read", { path: join(extra, ".git", "config") }), "error: the .git folder is off limits");
  assert.equal(tool("read", { path: join(extra, "nope.txt") }), "error: no such file: " + join(extra, "nope.txt") + ". Note: your current working directory is " + main + ".", "named by its full path");
  assert.ok(tool("write", { path: join(extra, "new.txt"), content: "made\n" }).startsWith("File created successfully at: " + join(extra, "new.txt") + " "));
  assert.match(tool("edit", { path: join(extra, "new.txt"), old_string: "made", new_string: "changed" }), /has been updated successfully/);
  assert.equal(await rf(join(extra, "new.txt"), "utf8"), "changed\n");
  if (spawnSync("rg", ["--version"]).status === 0) {
    assert.equal(tool("grep", { pattern: "hello", path: extra }), "Found 1 file\n" + join(extra, "sub", "b.txt"));
    assert.deepEqual(tool("glob", { pattern: "**/*.txt", path: extra }).split("\n").sort(), [join(extra, "new.txt"), join(extra, "sub", "b.txt")]);
    assert.equal(tool("grep", { pattern: "hello", path: extra }, ""), "error: that path is outside the project");
  }
  // A working folder around the project: the project's .git is still off limits, and its files are named as before.
  await mkdir(join(main, ".git"), { recursive: true }); await writeFile(join(main, ".git", "HEAD"), "ref\n"); await writeFile(join(main, "src", "a.js"), "a\n");
  assert.equal(tool("read", { path: join(main, ".git", "HEAD") }, top), "error: the .git folder is off limits");
  assert.equal(tool("read", { path: "nope.js" }, top), "error: no such file: nope.js. Note: your current working directory is " + main + ".");
  // Coder's machine names them to the tools, from the folders it worked out (addDirs), never from a variable of the owner's or
  // the repository's (CODER_… names are dropped from both).
  const server = read("container/server.mjs");
  assert.match(server, /CODER_OUTPUT_DIRS: bgDir \+ ":" \+ outDir, \.\.\.\(addDirs\.length \? \{ CODER_WORK_DIRS: addDirs\.join\(":"\) \} : \{\}\),/);
  assert.match(server, /export const REPO_ENV_OFF = [^\n]*\|CODER_\\w\*\|/);
  // Coder's loop: the rules' decision and the search's own check get the working folders.
  const agent = read("container/coder-agent.mjs");
  assert.match(agent, /fileToolDecision\(c\.name, fileTarget, \{ rules: ownRules, [^\n]*roots: workdirs\.slice\(1\) \}\)/);
  assert.match(agent, /home: deps\.home \|\| "", \.\.\.\(workdirs\.length > 1 \? \{ roots: workdirs\.slice\(1\) \} : \{\}\) \} \}\) \}\);/);
});

test("CD382h an allow rule Read(*), Edit(*), Write(*), Grep(*), Glob(*) or LSP(*) covers the working folders only, as Claude Code 2.1.325's (its Lg: the path \"*\", no longer the whole tool), with its warning in its words when it is saved (\"Permission allow rule \"LSP(*)\" adds nothing to LSP's default, …\"); the tool's name alone still allows every path; a deny or ask rule X(*) is still the whole tool", () => {
  assert.equal(F.starAllowTool("Read(*)"), "Read");
  assert.equal(F.starAllowTool("LSP()"), "LSP");
  for (const t of ["Read", "Read(**)", "Read(src/*)", "Bash(*)", "WebFetch(*)"]) assert.equal(F.starAllowTool(t), "", t);
  // As an allow rule: inside the project only.
  assert.equal(hit(["Read(*)"], ROOT + "/deep/a.txt", "allow"), "Read(*)");
  assert.equal(hit(["Read(*)"], "/etc/hostname", "allow"), "", "outside: no longer");
  assert.equal(hit(["Read"], "/etc/hostname", "allow"), "Read", "the tool's name alone: every path");
  assert.equal(hit(["Edit(*)"], "/tmp/x.txt", "allow", "Edit"), "");
  // As a deny or ask rule: the whole tool, as before.
  assert.equal(hit(["Read(*)"], "/etc/hostname", "deny"), "Read(*)");
  assert.equal(hit(["Read(*)"], "/etc/hostname", "ask"), "Read(*)");
  // So a command that reads or writes outside the project is no longer let through by it; the name alone still lets it.
  const bd = (cmd, allow) => P.bashDecision(cmd, { mode: "acceptEdits", rules: { allow, ask: [], deny: [] }, cwd: ROOT, workdirs: [ROOT], home: HOME }).verdict;
  assert.deepEqual([bd("cat /etc/hostname", ["Read(*)"]), bd("cat /etc/hostname", ["Read"])], ["ask", "allow"]);
  assert.deepEqual([bd("cp a.txt /tmp/x.txt", ["Edit(*)"]), bd("cp a.txt /tmp/x.txt", ["Edit"])], ["ask", "allow"]);
  // Its warning, in Claude Code's words (xkt; with Coder's name, and without the switch Anthropic has for it).
  const said = (t) => P.ruleWarning("allow", t);
  assert.deepEqual(said("LSP(*)"), { warning: 'Permission allow rule "LSP(*)" adds nothing to LSP\'s default, which already runs without asking in the working directories. "LSP" alone allows every path. Older versions of Coder treat "LSP(*)" as "LSP".', notice: "" });
  for (const t of ["Read", "Grep", "Glob"]) assert.equal(said(t + "(*)").warning, 'Permission allow rule "' + t + '(*)" adds nothing to ' + t + '\'s default, which already runs without asking in the working directories. "' + t + '" alone allows every path. Older versions of Coder treat "' + t + '(*)" as "' + t + '".');
  for (const t of ["Edit", "Write"]) assert.equal(said(t + "(*)").warning, 'Permission allow rule "' + t + '(*)" lets ' + t + ' run without asking only in the working directories. "' + t + '" alone allows every path. Older versions of Coder treat "' + t + '(*)" as "' + t + '".');
  for (const k of ["deny", "ask"]) assert.equal(P.ruleWarning(k, "LSP(*)"), null, k);
  assert.equal(said("LSP"), null);
  assert.equal(P.ruleSaved("LSP(*)"), true, "still saved");
  assert.match(P.ruleProblem("LSP()"), /^Empty parentheses\./, "LSP() refused as before, as Claude Code's settings check refuses it");
});

// ── ROUND 4 (2026-11-14, the owner: "yes" to copying Claude Code 2.1.325 for each) ─────────────────────────────────────────
// Each expected value below was worked out with Claude Code 2.1.325's own functions (its `_t`, `At`, `Nr`, `Fc`, `Jt`, `ic`
// and `wfn`, and its copy of the ignore library, read from /opt/claude-code/bin/claude), not from Coder's.
test("CD382i a path rule matches as Claude Code 2.1.325 matches it, with its own matcher (the ignore library's): a relative path with two parts is anchored where it counts from (Read(config/app.json), Read(src/*)), only a single folder's x/** matches at any depth in a deny or ask rule; letters in either case; the first rule that matches is the one named; a pattern the library can't use guards its literal path in a deny or ask rule and approves nothing in an allow one; a `!` rule carves out of allow rules too", () => {
  for (const kind of ["deny", "ask"]) {
    assert.equal(hit(["Read(config/app.json)"], ROOT + "/config/app.json", kind), "Read(config/app.json)", kind);
    assert.equal(hit(["Read(config/app.json)"], ROOT + "/x/config/app.json", kind), "", kind + ": anchored (Coder had matched it at any depth)");
    assert.equal(hit(["Read(./config/app.json)"], ROOT + "/x/config/app.json", kind), "", kind);
    assert.equal(hit(["Read(src/*)"], ROOT + "/src/a.js", kind), "Read(src/*)", kind);
    assert.equal(hit(["Read(src/*)"], ROOT + "/src/deep/a.js", kind), "Read(src/*)", kind + ": src/deep is matched as a folder");
    assert.equal(hit(["Read(src/*)"], ROOT + "/vendor/src/a.js", kind), "", kind + ": anchored");
    assert.equal(hit(["Read(docs/*.md)"], ROOT + "/sub/docs/a.md", kind), "", kind + ": anchored");
    assert.equal(hit(["Read(secrets/**)"], ROOT + "/a/b/secrets/k", kind), "Read(secrets/**)", kind + ": a single folder's x/**, any depth");
    assert.equal(hit(["Read(**/src/*)"], ROOT + "/vendor/src/a.js", kind), "Read(**/src/*)", kind + ": **/ at any depth");
  }
  // Letters in either case: the ignore library's default, as Claude Code creates it.
  assert.equal(hit(["Read(.ENV)"], ROOT + "/.env"), "Read(.ENV)");
  assert.equal(hit(["Edit(SRC/**)"], ROOT + "/src/a.ts", "allow", "Edit"), "Edit(SRC/**)");
  // The first rule that matches since the last `!` one that did (the library's own order).
  assert.equal(hit(["Read(.env)", "Read(**/.env)"], ROOT + "/a/.env"), "Read(.env)");
  assert.equal(hit(["Read(*.env)", "Read(!*.env)", "Read(prod.env)"], ROOT + "/c/prod.env"), "Read(prod.env)");
  // A pattern the library skips (a comment's #): a deny or ask rule guards the literal path; an allow rule approves nothing.
  assert.equal(hit(["Read(#notes)"], ROOT + "/#notes"), "Read(#notes)");
  assert.equal(hit(["Read(#notes)"], ROOT + "/#notes", "allow"), "");
  // A `!` rule in an allow list carves out of the allow rules (Claude Code keeps one library for all of them).
  assert.equal(hit(["Read(*.env)", "Read(!sample.env)"], ROOT + "/c/sample.env", "allow"), "");
  // The docs' table, unchanged: Edit(src/**) as an allow rule at the top only, as a deny or ask rule at any depth; /src/** and
  // **/src/** the same in every rule type; src/components/** anchored.
  assert.equal(hit(["Edit(src/components/**)"], ROOT + "/x/src/components/a.js", "deny", "Edit"), "");
  assert.equal(hit(["Edit(src/**)"], ROOT + "/vendor/pkg/src/lib.js", "allow", "Edit"), "");
  assert.equal(hit(["Edit(src/**)"], ROOT + "/vendor/pkg/src/lib.js", "deny", "Edit"), "Edit(src/**)");
  // The search's own globs are as Claude Code's (its DHr): a relative rule at any depth, as before.
  assert.deepEqual(S.denyGlobs({ rules: ["Read(config/app.json)", "Read(src/*)", "Read(/top.txt)"], root: ROOT }, ROOT), ["!**/config/app.json", "!**/src/*", "!/top.txt"]);
});

test("CD382j Read(**) and Edit(**) are path rules, as in Claude Code 2.1.325 (its parser makes only an empty or \"*\" content the whole tool): a deny takes no tool away from Coder, and each call on a path below the folders a relative rule counts from is refused (a path outside them is not covered); Read(*) and Read are still the whole tool", async () => {
  assert.deepEqual(P.parseRule("Edit(**)"), { tool: "Edit", spec: "**" });
  assert.equal(P.wholeRule({ deny: ["Read(**)"] }, "deny", "Read"), "", "not the whole tool");
  assert.equal(P.wholeRule({ deny: ["Read(*)"] }, "deny", "Read"), "Read(*)");
  const fd = (tool, p, rules) => P.fileToolDecision(tool, p, { rules: { allow: [], ask: [], deny: [], ...rules }, root: ROOT, home: HOME });
  assert.deepEqual(fd("read", ROOT + "/src/a.js", { deny: ["Read(**)"] }), { verdict: "deny", rule: "Read(**)", why: "File is in a directory that is denied by your permission settings." });
  assert.equal(fd("read", "/etc/hostname", { deny: ["Read(**)"] }).verdict, "", "outside the project: not covered");
  assert.equal(fd("edit", "/tmp/x.txt", { deny: ["Edit(**)"] }).verdict, "");
  assert.equal(P.bashDecision("cat /etc/hostname", { mode: "auto", rules: { allow: [], ask: [], deny: ["Read(**)"] }, cwd: ROOT, workdirs: [ROOT], home: HOME }).verdict, "allow", "a command reading outside the project");
  assert.equal(P.bashDecision("cat a.txt", { mode: "auto", rules: { allow: [], ask: [], deny: ["Read(**)"] }, cwd: ROOT, workdirs: [ROOT], home: HOME }).verdict, "deny");
  // The search's glob for it, Claude Code's: nothing below the folder searched.
  assert.deepEqual(S.denyGlobs({ rules: ["Read(**)"], root: ROOT }, ROOT), ["!**/**"]);
  // In Coder's loop: the read tool is offered, and a read of a file of the project is refused in Read's words.
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const seen = [], ran = [];
  let n = 0;
  const steps = [say("", [call("read", { path: "a.txt" }, "r1"), call("edit", { path: "a.txt", old_string: "a", new_string: "b" }, "e1")]), say("Done.")];
  const r = await runCoder({
    send: async (q) => { seen.push(q); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { ran.push(String(x.command)); return { code: 0, output: "ok" }; }, emit: () => {},
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false",
  }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: [], deny: ["Read(**)", "Edit(**)"] } });
  const offered = (seen[0].tools || []).map((t) => t.function.name);
  assert.ok(offered.includes("read") && offered.includes("edit") && offered.includes("write") && offered.includes("grep"), offered.join(","));
  const out = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.equal(out("r1"), "File is in a directory that is denied by your permission settings.");
  assert.equal(out("e1"), "File is in a directory that is denied by your permission settings.");
  assert.ok(!ran.some((c) => /coder-tools\.mjs/.test(c)), "nothing read or changed");
});

test("CD382k a relative rule's path counts from the folder Coder's commands are in, as Claude Code's from its current folder (2.1.325's wfn): a deny or ask rule from that folder, then the project's, then each other working folder; an allow rule from that folder alone; Coder's loop, its commands and its searches give that folder", async () => {
  const SUB = ROOT + "/sub", W = "/work/extra";
  const at = (cwd, more = []) => ({ ...ctx, cwd, roots: more });
  // Deny and ask: the current folder, and the project's too ("no longer covering the project after a cd" fixed in 2.1.325).
  for (const kind of ["deny", "ask"]) {
    assert.equal(hit(["Read(config/app.json)"], SUB + "/config/app.json", kind, "Read", at(SUB)), "Read(config/app.json)", kind);
    assert.equal(hit(["Read(config/app.json)"], ROOT + "/config/app.json", kind, "Read", at(SUB)), "Read(config/app.json)", kind);
    assert.equal(hit(["Read(config/app.json)"], W + "/config/app.json", kind, "Read", at(SUB, [W])), "Read(config/app.json)", kind);
    assert.equal(hit(["Read(.env)"], "/work/.env", kind, "Read", at(SUB)), "", kind + ": not above the project");
  }
  // Allow: the current folder alone (the project's own, as before, when Coder is in it; /path stays the project's).
  assert.equal(hit(["Edit(src/**)"], SUB + "/src/a.ts", "allow", "Edit", at(SUB)), "Edit(src/**)");
  assert.equal(hit(["Edit(src/**)"], ROOT + "/src/a.ts", "allow", "Edit", at(SUB)), "");
  assert.equal(hit(["Edit(/src/**)"], ROOT + "/src/a.ts", "allow", "Edit", at(SUB)), "Edit(/src/**)");
  assert.equal(hit(["Edit(src/**)"], ROOT + "/src/a.ts", "allow", "Edit"), "Edit(src/**)", "no current folder given: the project's");
  // (An allow rule X(*) is no pattern: Claude Code's Lha approves a path in the working folders, the project's and the others.)
  assert.equal(hit(["Read(*)"], ROOT + "/src/a.ts", "allow", "Read", at(SUB)), "Read(*)");
  assert.equal(hit(["Read(*)"], W + "/a.txt", "allow", "Read", at(SUB, [W])), "Read(*)");
  assert.equal(hit(["Read(*)"], "/etc/hostname", "allow", "Read", at(SUB, [W])), "");
  // The file tools' decision and a command's files.
  assert.equal(P.fileToolDecision("read", SUB + "/config/app.json", { rules: { allow: [], ask: [], deny: ["Read(config/app.json)"] }, root: ROOT, cwd: SUB }).verdict, "deny");
  assert.equal(P.fileToolDecision("read", SUB + "/config/app.json", { rules: { allow: [], ask: [], deny: ["Read(config/app.json)"] }, root: ROOT }).verdict, "", "from the project only, without it");
  const bd = (cmd, cwd) => P.bashDecision(cmd, { mode: "auto", rules: { allow: [], ask: [], deny: ["Read(config/app.json)"] }, cwd, workdirs: [ROOT], home: HOME }).verdict;
  assert.deepEqual([bd("cat config/app.json", SUB), bd("cat ../config/app.json", SUB), bd("cat x/config/app.json", ROOT)], ["deny", "deny", "allow"]);
  // Coder's loop: its current folder (deps.here) goes to the rules' checks and to the search.
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const reqs = [];
  let n = 0;
  const steps = [say("", [call("read", { path: "config/app.json" }, "r1"), call("read", { path: "x/config/app.json" }, "r2"), call("grep", { pattern: "k" }, "g1")]), say("Done.")];
  const r = await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { const b = String(x.command).split(" ").pop(); try { reqs.push(JSON.parse(Buffer.from(b, "base64").toString("utf8"))); } catch { /* a command */ } return { code: 0, output: "     1\tx\n" }; },
    emit: () => {}, here: () => SUB, root: ROOT, where: (p) => (p.startsWith("/") ? p : SUB + "/" + p), toolSearch: "false",
  }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: [], deny: ["Read(config/app.json)"] } });
  const out = (id) => r.messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
  assert.equal(out("r1"), "File is in a directory that is denied by your permission settings.");
  assert.match(out("r2"), /\tx/, "anchored: x/config/app.json is read");
  assert.equal(reqs.find((q) => q.tool === "grep").ctx.deny.cwd, SUB);
  // The search's own check counts from that folder too (coder-search.mjs, as the tools script runs it).
  assert.match(read("container/coder-search.mjs"), /\.\.\.\(typeof deny\.cwd === "string" && deny\.cwd \? \{ cwd: deny\.cwd \} : \{\}\)/);
});

test("CD382l (D3 of recheck 3) the chat's own plan file, in a plansDirectory under .claude (\".claude/plans\"), is written without the protected-file card in every mode, as Claude Code's \"Plan files for current session are allowed for writing\" (its exceptions to .claude: \"The current session's own plan files … in the plansDirectory you set\"); another file there still asks; the owner's deny and ask rules still apply to it", async () => {
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const PF = await import("../container/coder-plan-file.mjs");
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const root = await mkdtemp(join(tmpdir(), "coder-d3-"));
  await mkdir(join(root, ".claude", "plans"), { recursive: true });
  const run = async (mode, calls, rules = {}, answers = []) => {
    const box = PF.planStore({ dir: await mkdtemp(join(tmpdir(), "coder-d3-dir-")), stateFile: join(await mkdtemp(join(tmpdir(), "coder-d3-st-")), "plan.json"), rand: () => 0, custom: { dir: join(root, ".claude", "plans"), root } });
    const f = await box.name("Fix the cart");
    const events = [], cards = [], wrote = [];
    let n = 0, k = 0;
    const steps = [say("", calls(f)), say("Done.")];
    const r = await runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); if (tm) { const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")); if (q.tool === "write") { wrote.push(q.args.path); await writeFile(q.args.path, q.args.content); return { code: 0, output: "File created successfully at: " + q.args.path }; } } return { code: 0, output: "ok" }; },
      emit: (e) => events.push(e), here: () => root, root, chatId: "d3", where: (p) => (p.startsWith("/") ? p : join(root, p)),
      ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || null; },
      plan: box, toolSearch: "false",
    }, { text: "Fix the cart", mode, messages: [], rules: { allow: [], ask: [], deny: [], ...rules } });
    return { f, cards, wrote, told: (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content };
  };
  for (const mode of ["plan", "acceptEdits", "auto"]) {
    const t = await run(mode, (f) => [call("write", { path: f, content: "1. Fix it\n" }, "w1")]);
    assert.equal(t.cards.length, 0, mode + ": no card for the chat's own plan file");
    assert.deepEqual(t.wrote, [t.f], mode);
    assert.equal(t.told("w1"), "File created successfully at: " + t.f, mode);
  }
  // Another file in that folder is still a protected file of the project: asked.
  const other = await run("acceptEdits", () => [call("write", { path: ".claude/plans/notes.md", content: "x" }, "w2")], {}, [{ choice: "yes" }]);
  assert.equal(other.cards.length, 1);
  // (In Claude Code's words since round 6, Write's own check of a protected path, by its path in full.)
  assert.match(other.cards[0].why, /^Coder requested permissions to edit \/\S*\/\.claude\/plans\/notes\.md which is a sensitive file\.$/);
  // The owner's deny and ask rules still apply to the plan file (Claude Code checks them before its plan files' exception).
  const denied = await run("acceptEdits", (f) => [call("write", { path: f, content: "x" }, "w3")], { deny: ["Edit(.claude/**)"] });
  assert.equal(denied.told("w3"), "File is in a directory that is denied by your permission settings.");
  assert.deepEqual(denied.wrote, []);
  const asked = await run("acceptEdits", (f) => [call("write", { path: f, content: "x" }, "w4")], { ask: ["Edit(.claude/plans/**)"] }, [{ choice: "yes" }]);
  assert.equal(asked.cards.length, 1);
  assert.match(asked.cards[0].why, /^Coder requested permissions to write to \/.*\/\.claude\/plans\/[^/]+\.md, but you haven't granted it yet\.$/);
});

test("CD382p (round 5) read's, write's and edit's ask cards in Claude Code 2.1.325's words, as grep's, glob's and lsp's: a path rule's \"Coder requested permissions to read from <path>, but you haven't granted it yet.\" (Read rules) or \"… to write to <path> …\" (Edit rules, both tools), first; a rule on the whole tool alone \"Coder requested permissions to use Read (Write, Edit) …\", but \"… write to <path> …\" for write and edit in Auto; the path as Claude Code writes it; told to Coder where no one can answer", async () => {
  const fd = (tool, path, rules, extra = {}) => P.fileToolDecision(tool, path, { rules: { allow: [], ask: [], deny: [], ...rules }, root: ROOT, home: HOME, ...extra });
  const READ = (p) => "Coder requested permissions to read from " + p + ", but you haven't granted it yet.";
  const WRITE = (p) => "Coder requested permissions to write to " + p + ", but you haven't granted it yet.";
  const USE = (t) => "Coder requested permissions to use " + t + ", but you haven't granted it yet.";
  const f = ROOT + "/src/a.md";
  // A path rule: its file check's words, in every mode; it is the card's rule, a rule on the whole tool beside it or not.
  assert.deepEqual(fd("read", f, { ask: ["Read(src/**)"] }), { verdict: "ask", rule: "Read(src/**)", why: READ(f) });
  for (const tool of ["write", "edit"]) for (const mode of ["acceptEdits", "auto", "plan"]) assert.deepEqual(fd(tool, f, { ask: ["Edit(*.md)"] }, { mode }), { verdict: "ask", rule: "Edit(*.md)", why: WRITE(f) }, tool + " " + mode);
  assert.deepEqual(fd("read", f, { ask: ["Read", "Read(src/**)"] }), { verdict: "ask", rule: "Read(src/**)", why: READ(f) }, "the file check asks first");
  assert.deepEqual(fd("write", f, { ask: ["Write", "Edit(src/**)"] }, { mode: "acceptEdits" }), { verdict: "ask", rule: "Edit(src/**)", why: WRITE(f) });
  // A rule on the whole tool alone (its name, X(*), a wildcard naming it, Edit's for write too, as Coder matches them).
  for (const r of ["Read", "Read(*)", "Re*"]) assert.deepEqual(fd("read", f, { ask: [r] }, { mode: "auto" }), { verdict: "ask", rule: r, why: USE("Read") }, r);
  assert.equal(fd("write", f, { ask: ["Write"] }, { mode: "acceptEdits" }).why, USE("Write"));
  assert.equal(fd("edit", f, { ask: ["Edit(*)"] }, { mode: "plan" }).why, USE("Edit"));
  assert.equal(fd("write", f, { ask: ["Edit"] }).why, USE("Write"));
  assert.equal(fd("edit", f, { ask: ["*"] }, { mode: "auto" }).why, WRITE(f), "Auto: write's and edit's own check asks");
  assert.equal(fd("write", f, { ask: ["Write"] }, { mode: "auto" }).why, WRITE(f));
  // A path with control characters, as Claude Code writes one (its Hc): "&#10;"; grep's, glob's and lsp's too.
  const odd = ROOT + "/a\nb.md";
  assert.equal(fd("read", odd, { ask: ["Read(**)"] }).why, READ(ROOT + "/a&#10;b.md"));
  assert.equal(fd("grep", odd, { ask: ["Read(**)"] }).why, READ(ROOT + "/a&#10;b.md"));
  assert.equal(P.ccPath("/x\u0007y z\u0085"), "/x&#7;y&#8232;z&#133;");
  // Deny rules keep their own words; no rule, no card.
  assert.equal(fd("read", f, { deny: ["Read(src/**)"] }).why, "File is in a directory that is denied by your permission settings.");
  assert.deepEqual(fd("write", f, { ask: ["Read(src/**)"] }), { verdict: "", rule: "", why: "" });
  // In Coder's loop: the card's words; where no one can answer, Coder is told them (as for a page fetch), the step too.
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const run = async (mode, ask) => {
    const events = [], cards = [];
    let n = 0;
    const steps = [say("", [call("edit", { path: "src/a.md", old_string: "a", new_string: "b" }, "e1"), call("read", { path: "src/a.md" }, "r1")]), say("Done.")];
    const r = await runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)], exec: async () => ({ code: 0, output: "ok" }), emit: (e) => events.push(e),
      here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
      ...(ask ? { ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; } } : {}),
    }, { text: "go", mode, rules: { allow: [], ask: ["Edit(src/**)", "Read"], deny: [] } });
    return { cards, events, told: (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content };
  };
  let t = await run("acceptEdits", true);
  assert.deepEqual(t.cards.map((c) => [c.tool, c.path, c.why, c.byRule]), [["edit", "src/a.md", WRITE(f), true], ["read", "src/a.md", USE("Read"), true]]);
  t = await run("acceptEdits", false);
  assert.equal(t.told("e1"), WRITE(f));
  assert.equal(t.told("r1"), USE("Read"));
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "e1").output, WRITE(f));
});

// ── ROUND 5 (2026-11-14, the owner: "Yes pls" to the last differences round 4's rules helper found) ──
// Coder's loop with its tools run for real on a project (coder-tools.mjs, as Coder's machine runs it).
// (Round 6: `hookRun(input)` answers a command hook with its stdout; `home`, the AI's home folder (the tools script's too, as
// on Coder's machine); `ask`, the owner's cards; `toolReqs`, each request the tools script got.)
async function realLoop(d, steps, { rules = {}, mode = "acceptEdits", hooks = null, here = d, hookRun = null, home = undefined, ask = null } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const H = await import("../container/coder-hooks.mjs");
  const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const events = [], hookCalls = [], ran = [], toolReqs = [];
  let n = 0;
  const r = await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); return { code: 0, output: (hookRun ? String(hookRun(input) || "") : "") + "\n" + mark[0] + "\n" }; }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (!tm) { ran.push(String(x.command)); return { code: 0, output: "ok\n" }; }
      const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
      toolReqs.push(req);
      const out = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: d, encoding: "utf8", env: { PATH: process.env.PATH, ...(here !== d ? { CODER_CWD: here } : {}), ...(home !== undefined ? { HOME: home } : {}) } });
      return { code: out.status, output: out.stdout };
    },
    emit: (e) => events.push(e), here: () => here, root: d, chatId: "r5", where: (p) => (p.startsWith("/") ? p : here + "/" + p),
    ask: ask || (async () => ({ choice: "yes" })), toolSearch: "false", ...(home !== undefined ? { home } : {}),
  }, { text: "go", mode, messages: [], rules: { allow: [], ask: [], deny: [], ...rules }, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}) });
  const told = (id) => ((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "").replace(/^\u0000coder-facts\u0000[^\n]*\n/, "");
  return { r, events, hookCalls, ran, told, toolReqs };
}
const callR = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const sayR = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD382m (round 5) a grep or glob of the project's own folder under a Read(**) deny rule runs and finds no files, as Claude Code 2.1.325's does (its Grep and Glob check their folder's own path, as any path is checked, and their search leaves out each file the rule covers); a folder below the project is still refused; nothing inside a folder is tried for it", async () => {
  const fd = (tool, p, rules, cwd) => P.fileToolDecision(tool, p, { rules: { allow: [], ask: [], deny: [], ...rules }, root: ROOT, home: HOME, ...(cwd ? { cwd } : {}) });
  for (const t of ["grep", "glob"]) {
    assert.deepEqual(fd(t, ROOT, { deny: ["Read(**)"] }), { verdict: "", rule: "", why: "" }, t + ": the project's own folder");
    assert.equal(fd(t, ROOT, { ask: ["Read(**)"] }).verdict, "", t + ": no card for it either");
    assert.deepEqual(fd(t, ROOT + "/src", { deny: ["Read(**)"] }), { verdict: "deny", rule: "Read(**)", why: "Permission to read /work/shop/src has been denied." }, t);
    assert.equal(fd(t, ROOT + "/src", { ask: ["Read(**)"] }).why, "Coder requested permissions to read from /work/shop/src, but you haven't granted it yet.", t);
  }
  // (The folder's own path only, as Claude Code's Yx checks it: a rule for what is in a folder leaves its search to run.)
  assert.equal(fd("grep", ROOT + "/src", { deny: ["Read(src/*)"] }).verdict, "");
  assert.equal(fd("grep", ROOT + "/secrets", { deny: ["Read(secrets/)"] }).verdict, "");
  assert.equal(fd("grep", ROOT + "/secrets", { deny: ["Read(secrets/**)"] }).verdict, "deny", "a folder's x/** is the folder");
  // (From a subfolder, the project's folder counts too for a deny rule: that subfolder is below it.)
  assert.equal(fd("glob", ROOT + "/sub", { deny: ["Read(**)"] }, ROOT + "/sub").verdict, "deny");
  // Coder's loop, its tools run for real.
  if (spawnSync("rg", ["--version"]).status !== 0) return;
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = await mkdtemp(join(tmpdir(), "coder-r5-search-"));
  await mkdir(join(d, "src"), { recursive: true });
  await writeFile(join(d, "a.js"), "TODO one\n"); await writeFile(join(d, "src", "b.js"), "TODO two\n");
  const t = await realLoop(d, [sayR("", [callR("grep", { pattern: "TODO" }, "g1"), callR("glob", { pattern: "**/*.js" }, "g2"), callR("grep", { pattern: "TODO", path: "src" }, "g3"), callR("read", { path: "a.js" }, "r1")]), sayR("Done.")], { rules: { deny: ["Read(**)"] } });
  assert.equal(t.told("g1"), "No files found");
  assert.equal(t.told("g2"), "No files found");
  assert.equal(t.told("g3"), "Permission to read " + join(d, "src") + " has been denied.");
  assert.equal(t.told("r1"), "File is in a directory that is denied by your permission settings.");
  // Without the rule, the same searches find the files.
  const t2 = await realLoop(d, [sayR("", [callR("grep", { pattern: "TODO" }, "g1")]), sayR("Done.")]);
  assert.match(t2.told("g1"), /^Found 2 files\n/);
});

test("CD382n (round 5) a command that writes the chat's own plan file, in a plansDirectory under .claude, runs as Claude Code 2.1.325's does (its \"Plan files for current session are allowed for writing\", in its check of each path a file command or an output redirection names, before its protected paths): no protected-file card for >, >>, tee, touch, rm, cp, mv or sed -i on it; a wildcard, a ~, a cd before it, a link or another file there still asks; the owner's deny rules still apply; the plan file outside the project is read and written as the scratch folder is", async () => {
  const A = await import("../container/coder-agent.mjs");
  const PF = ROOT + "/.claude/plans/fix-the-cart.md", OTHER = ROOT + "/.claude/plans/notes.md";
  const isProt = (full) => { const rel = full.startsWith(ROOT + "/") ? full.slice(ROOT.length + 1) : ""; return rel ? A.protectedFile(rel) || A.protectedFile(rel + "/x") : ""; };
  const bd = (cmd, mode, o = {}) => P.bashDecision(cmd, { mode, rules: { allow: [], ask: [], deny: [], ...(o.rules || {}) }, cwd: ROOT, workdirs: [ROOT], isProtected: isProt, real: o.real || ((p) => p), home: HOME, scratch: ["/tmp/scratch"], planFile: "planFile" in o ? o.planFile : PF, byCommand: o.byCommand ?? true });
  const deps = { root: ROOT, home: HOME, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p) };
  const ca = (cmd, o = {}) => A.commandAsk(cmd, deps, ROOT, { real: o.real || ((p) => p), allowed: () => false, planFile: "planFile" in o ? o.planFile : PF });
  const forms = [`echo "1. Fix it" > .claude/plans/fix-the-cart.md`, "echo more >> " + PF, "printf x | tee .claude/plans/fix-the-cart.md", "touch .claude/plans/fix-the-cart.md", "rm .claude/plans/fix-the-cart.md", "cp /tmp/scratch/p.md .claude/plans/fix-the-cart.md", "mv /tmp/scratch/p.md .claude/plans/fix-the-cart.md", "sed -i s/a/b/ .claude/plans/fix-the-cart.md"];
  for (const cmd of forms) {
    assert.equal(ca(cmd), null, cmd + ": no protected-file card");
    assert.equal(ca(cmd, { planFile: "" }).kind, "protected", cmd + ": a .claude file of the project otherwise");
    assert.doesNotMatch(bd(cmd, "acceptEdits").why, /sensitive file/, cmd);
  }
  // In Accept edits (the repository's own acceptEdits): as any file of the project, the file commands and redirections run.
  for (const cmd of [forms[0], forms[1], forms[3], forms[4], forms[7]]) assert.equal(bd(cmd, "acceptEdits").verdict, "allow", cmd);
  // In Claude Code's cloud "default": a redirection runs; a file command asks as any command does.
  assert.equal(bd(forms[0], "acceptEdits", { byCommand: false }).verdict, "allow");
  assert.deepEqual([bd(forms[3], "acceptEdits", { byCommand: false }).verdict, bd(forms[3], "acceptEdits", { byCommand: false }).why], ["ask", "This command requires approval"]);
  // Still asked: another file in that folder, a wildcard, a link, a folder named as the file, a cd before it.
  assert.equal(ca("echo x > .claude/plans/notes.md").kind, "protected");
  assert.equal(bd("echo x > .claude/plans/notes.md", "acceptEdits").why, "Coder requested permissions to edit " + OTHER + " which is a sensitive file.");
  assert.equal(bd("echo x > .claude/plans/*.md", "acceptEdits").why, "Shell expansion syntax in paths requires manual approval");
  assert.equal(ca("echo x > " + PF, { real: (p) => (p === PF ? "/etc/passwd" : p) }).kind, "protected", "through a link");
  assert.match(bd("echo x > " + PF, "acceptEdits", { real: (p) => (p === PF ? ROOT + "/.claude/settings.json" : p) }).why, /sensitive file/);
  assert.equal(ca("mkdir -p .claude/plans/fix-the-cart.md/x").kind, "protected");
  assert.equal(ca("cd .claude/plans && rm fix-the-cart.md"), null, "after a cd: the plan file there");
  assert.equal(ca("cd .claude/plans && rm notes.md").kind, "protected");
  assert.match(bd("cd .claude/plans && rm fix-the-cart.md", "acceptEdits").why, /^Commands that change directories and perform write operations require explicit approval/);
  assert.match(bd("cd .claude/plans && echo x > fix-the-cart.md", "acceptEdits").why, /^Commands that change directories and write via output redirection require explicit approval/);
  // Plan mode changes no files with a command, the plan file's included (Coder's Plan mode, as before).
  assert.equal(bd(forms[0], "plan").verdict, "ask");
  // The owner's deny and ask rules come first (Claude Code checks them before its plan files' exception).
  assert.equal(bd(forms[0], "acceptEdits", { rules: { deny: ["Edit(.claude/**)"] } }).verdict, "deny");
  assert.equal(bd(forms[0], "acceptEdits", { rules: { ask: ["Edit(.claude/plans/**)"] } }).why, "Permission rule Edit(.claude/plans/**) requires confirmation for this command.");
  // The plan file in the chat's own plans folder, outside the project: written and read as the scratch folder is ("… allowed
  // for reading" too); another file beside it is outside the project, asked.
  const MEM = "/srv/coder-memory/shop.plans/fix-the-cart.md";
  assert.equal(bd("echo x > " + MEM, "acceptEdits", { planFile: MEM }).verdict, "allow");
  assert.equal(bd("cat " + MEM, "acceptEdits", { planFile: MEM }).verdict, "allow");
  assert.equal(bd("cat " + MEM, "acceptEdits", { planFile: "" }).verdict, "ask");
  assert.equal(bd("cat /srv/coder-memory/shop.plans/other.md", "acceptEdits", { planFile: MEM }).verdict, "ask");
  assert.equal(P.readBlockWhy("cat " + MEM, { cwd: ROOT, workdirs: [ROOT], home: HOME, ownDirs: [MEM] }), "", "the read block lets it be read (Coder's loop names it)");
  // Coder's loop passes the chat's plan file to these checks.
  const agent = read("container/coder-agent.mjs");
  assert.equal((agent.match(/scratch: \[SCRATCH\], planFile: planPath\(\)/g) || []).length, 4);
  assert.match(agent, /commandAsk\(command, deps, where0, \{ real: [^\n]*, planFile: planPath\(\) \}\)/);
  assert.equal((agent.match(/SCRATCH, \.\.\.\(planPath\(\) \? \[planPath\(\)\] : \[\]\)\]/g) || []).length, 2);
  // In Coder's loop, with its plan file in .claude/plans: the command runs with no card; another file there gets the card.
  const { mkdtemp, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const PFS = await import("../container/coder-plan-file.mjs");
  const { runCoder } = await import("../container/coder-agent.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-r5-plan-"));
  await mkdir(join(root, ".claude", "plans"), { recursive: true });
  for (const mode of ["acceptEdits", "auto"]) {
    const box = PFS.planStore({ dir: await mkdtemp(join(tmpdir(), "coder-r5-pd-")), stateFile: join(await mkdtemp(join(tmpdir(), "coder-r5-st-")), "plan.json"), rand: () => 0, custom: { dir: join(root, ".claude", "plans"), root } });
    const f = await box.name("Fix the cart");
    const events = [], ran = [], cards = [];
    let n = 0;
    const steps = [sayR("", [callR("bash", { command: "echo '1. Fix it' > " + f, description: "Write the plan" }, "b1")]), sayR("", [callR("bash", { command: "echo x > .claude/plans/notes.md", description: "Write notes" }, "b2")]), sayR("Done.")];
    await runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => { ran.push(String(x.command)); return { code: 0, output: "" }; },
      emit: (e) => events.push(e), here: () => root, root, chatId: "r5p", where: (p) => (p.startsWith("/") ? p : join(root, p)),
      ask: async (pid) => { cards.push(events.find((e) => e.pid === pid)); return { choice: "no" }; },
      plan: box, toolSearch: "false",
    }, { text: "Fix the cart", mode, messages: [], rules: { allow: [], ask: [], deny: [] } });
    assert.ok(ran.some((c) => c.includes("echo '1. Fix it' > " + f)), mode + ": the plan file's command ran");
    assert.equal(cards.length, 1, mode + ": one card, for notes.md: " + JSON.stringify(cards.map((c) => c && c.why)));
    assert.match(String(cards[0].why || ""), /notes\.md which is a sensitive file/, mode);
    assert.ok(!ran.some((c) => c.includes("notes.md")), mode + ": No: not run");
  }
});

test("CD382o (round 5) a hook's `if` on Read, Edit, Write or NotebookEdit matches as Claude Code 2.1.325's (its akt): the path in full from the folder Coder's commands are in; a relative pattern from that folder too (it had counted from the project), `/` from the project, `//` the machine's root, `~/` the home folder; else a pattern that starts with `*`, or has no `*`, as text against the whole path; `X()` is the whole tool; another tool with a path in its input never matches", async () => {
  const SUB = ROOT + "/sub";
  const m = (rule, tool, input, cwd = SUB) => P.ifRuleMatches(rule, tool, input, { cwd, root: ROOT, home: HOME });
  assert.equal(m("Edit(src/**)", "Edit", { file_path: SUB + "/src/a.ts" }), true);
  assert.equal(m("Edit(src/**)", "Edit", { file_path: "src/a.ts" }), true, "a short path, from that folder");
  assert.equal(m("Edit(src/**)", "Edit", { file_path: ROOT + "/src/a.ts" }), false, "not from the project any more");
  assert.equal(m("Edit(src/**)", "Edit", { file_path: ROOT + "/src/a.ts" }, ROOT), true, "from the project when Coder is there");
  assert.equal(m("Edit(./src/**)", "Edit", { file_path: SUB + "/src/a.ts" }), true);
  assert.equal(m("Edit(/src/**)", "Edit", { file_path: ROOT + "/src/a.ts" }), true, "/ is the project");
  assert.equal(m("Edit(/src/**)", "Edit", { file_path: SUB + "/src/a.ts" }), false);
  assert.equal(m("Read(//etc/**)", "Read", { file_path: "/etc/hosts" }), true);
  assert.equal(m("Read(~/notes/**)", "Read", { file_path: "~/notes/a.md" }), true);
  assert.equal(m("Write(*.ts)", "Write", { file_path: "/tmp/x.ts" }), true, "a pattern that starts with * also as text: anywhere");
  assert.equal(m("Write(*.ts)", "Write", { file_path: "/tmp/x.js" }), false);
  assert.equal(m("Read(/tmp/x.txt)", "Read", { file_path: "/tmp/x.txt" }), true, "one with no * also as the whole path's text");
  assert.equal(m("Read(src/a.ts)", "Read", { file_path: ROOT + "/src/a.ts" }), false, "anchored at the folder Coder is in");
  assert.equal(m("Read(s*/a.ts)", "Read", { file_path: ROOT + "/src/a.ts" }), false, "a * in the middle: the folder's pattern only");
  assert.equal(m("NotebookEdit(*.ipynb)", "NotebookEdit", { notebook_path: SUB + "/n.ipynb" }), true);
  assert.equal(m("Read()", "Read", { file_path: "/x" }), true, "X() is the whole tool, as X and X(*)");
  assert.equal(m("LSP(src/**)", "LSP", { path: SUB + "/src/a.ts" }), false, "no path matcher for LSP's hooks");
  assert.equal(m("mcp__docs__open(src/**)", "mcp__docs__open", { path: SUB + "/src/a.ts" }), false, "nor a connector's");
  // A hook's `if` as Coder's loop checks it: the folder Coder's commands are in comes in the call's ctx.
  const H = await import("../container/coder-hooks.mjs");
  const all = [{ event: "PreToolUse", matcher: "Read|Edit|Write", command: "fmt.sh", if: "Edit(src/**)", timeout: 600 }];
  const run = (fp, cwd) => H.hooksFor(all, "PreToolUse", "Edit", { tool: "Edit", input: { file_path: fp }, ctx: { cwd, root: ROOT, home: HOME } }).length;
  assert.deepEqual([run(SUB + "/src/a.ts", SUB), run(ROOT + "/src/a.ts", SUB), run(ROOT + "/src/a.ts", ROOT)], [1, 0, 1]);
  // (Both places a PreToolUse hook starts: in its turn, and with its group before the turn reaches it; round 5's flow.)
  const agentSrc = read("container/coder-agent.mjs");
  assert.match(agentSrc, /const pre = preEarly \? await preEarly : await runHooks\("PreToolUse", tool, \{ tool_name: tool, tool_input: input, tool_use_id: c\.id \}, \{ tool, input, ctx: \{ cwd: hookCtx\(\)\.cwd, root: deps\.root \|\| "\/", home: deps\.home \|\| "" \}/);
  assert.match(agentSrc, /runHooks\("PreToolUse", tool, \{ tool_name: tool, tool_input: input, tool_use_id: x\.id \}, \{ tool, input, ctx: \{ cwd: hookCtx\(\)\.cwd, root: deps\.root \|\| "\/", home: deps\.home \|\| "" \} \}\)/);
  // Coder's loop: with its commands in a subfolder, a PreToolUse hook `if: "Read(src/**)"` runs for src/ there, not the project's.
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = await mkdtemp(join(tmpdir(), "coder-r5-hook-"));
  await mkdir(join(d, "sub", "src"), { recursive: true }); await mkdir(join(d, "src"), { recursive: true });
  await writeFile(join(d, "sub", "src", "a.txt"), "sub\n"); await writeFile(join(d, "src", "b.txt"), "top\n");
  const t = await realLoop(d, [sayR("", [callR("read", { path: "src/a.txt" }, "r1"), callR("read", { path: join(d, "src", "b.txt") }, "r2")]), sayR("Done.")], { here: join(d, "sub"), hooks: { PreToolUse: [{ matcher: "Read", hooks: [{ type: "command", command: "check.sh", if: "Read(src/**)" }] }] } });
  // (Its input carries the path in full, as Claude Code's hooks get it: round 6, R6R1.)
  assert.deepEqual(t.hookCalls.map((x) => x.tool_input.file_path), [join(d, "sub", "src", "a.txt")]);
  assert.match(t.told("r1"), /\tsub/);
  assert.match(t.told("r2"), /\ttop/);
});

// ── ROUND 6 (2026-11-14, the owner: "do what claude code does") ──

test("R6R1 (round 6) read's, write's and edit's path reaches their hooks in full, as Claude Code 2.1.325's Read, Write and Edit give theirs (its hooks reference: \"tool_input.file_path is always absolute: Claude Code expands ~ and relative paths before hooks run\"; its program's backfillObservableInput and Nb): from the folder Coder's commands are in, ~ the home folder, on PreToolUse, PermissionRequest, PostToolUse and PostToolUseFailure; PostToolBatch gets Grok's own input; grep's, glob's and lsp's are left as given; the tool runs with Grok's spelling unless a hook names another file; the chat keeps what Grok wrote", async () => {
  const H = await import("../container/coder-hooks.mjs");
  // Claude Code's expandPath, case by case (its P, then Nb's check that a second expansion changes nothing).
  const at = { cwd: ROOT + "/sub", home: HOME };
  const cases = [["src/a.ts", ROOT + "/sub/src/a.ts"], ["./src/a.ts", ROOT + "/sub/src/a.ts"], ["../x.ts", ROOT + "/x.ts"], ["  src/a.ts ", ROOT + "/sub/src/a.ts"],
    ["", ROOT + "/sub"], [".", ROOT + "/sub"], ["src/", ROOT + "/sub/src"], [ROOT + "/./a//b.ts", ROOT + "/a/b.ts"], ["/a/b/", "/a/b/"], ["//etc/hosts", "/etc/hosts"],
    ["/a/../../b", "/b"], ["~", HOME], ["~/", HOME], ["~/notes/a.md", HOME + "/notes/a.md"], ["~/a/", HOME + "/a/"], ["~/../x", "/home/x"], ["~dev/x", ROOT + "/sub/~dev/x"]];
  for (const [given, full] of cases) assert.equal(H.hookPath(given, at), full, JSON.stringify(given));
  // Paths Claude Code's file tools refuse before any hook stay as given: white space at the end once made plain, a NUL byte,
  // over 4,096 characters; and a ~ one with no home folder known.
  for (const given of ["a /.", "x\u0000y", "a".repeat(4097)]) assert.equal(H.hookPath(given, at), given);
  assert.equal(H.hookPath("~/x", { cwd: ROOT }), "~/x");
  // The input: both of Coder's names, in full, for read, write and edit only; without `at`, as Grok gave it.
  assert.deepEqual(H.hookToolInput("write", { path: "src/a.ts", content: "x" }, at), { path: ROOT + "/sub/src/a.ts", content: "x", file_path: ROOT + "/sub/src/a.ts" });
  assert.deepEqual(H.hookToolInput("read", { file_path: "~/n.md" }, at), { file_path: HOME + "/n.md" });
  assert.deepEqual(H.hookToolInput("edit", { path: "a.ts", old_string: "a", new_string: "b" }), { path: "a.ts", old_string: "a", new_string: "b", file_path: "a.ts" });
  assert.deepEqual(H.hookToolInput("grep", { pattern: "x", path: "src" }, at), { pattern: "x", path: "src" });
  assert.deepEqual(H.hookToolInput("glob", { pattern: "*.ts", path: "src" }, at), { pattern: "*.ts", path: "src" });
  assert.deepEqual(H.hookToolInput("lsp", { operation: "hover", filePath: "src/a.ts", line: 1, character: 1 }, at), { operation: "hover", filePath: "src/a.ts", line: 1, character: 1 });
  // A hook's new input: the same file, Grok's own spelling (Claude Code's vCr); another file, in full (its Dgr).
  assert.deepEqual(H.givenPathKept("write", { path: ROOT + "/sub/src/a.ts", content: "y" }, { path: "src/a.ts" }, at), { path: "src/a.ts", content: "y" });
  assert.deepEqual(H.givenPathKept("write", { path: "./src/a.ts", content: "y" }, { path: "src/a.ts" }, at), { path: "src/a.ts", content: "y" });
  assert.deepEqual(H.givenPathKept("edit", { path: "src/b.ts" }, { file_path: "src/a.ts" }, at), { path: ROOT + "/sub/src/b.ts" });
  assert.deepEqual(H.givenPathKept("grep", { pattern: "x", path: "src" }, { pattern: "x", path: "lib" }, at), { pattern: "x", path: "src" });

  // In Coder's loop, its commands in a subfolder.
  const { mkdtemp, mkdir, writeFile, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = await mkdtemp(join(tmpdir(), "coder-r6-full-"));
  const sub = join(d, "sub");
  await mkdir(join(sub, "src"), { recursive: true });
  await writeFile(join(sub, "src", "a.txt"), "one\n");
  const hooks = {
    PreToolUse: [{ matcher: "Read|Write|Edit", hooks: [{ type: "command", command: "pre.sh" }] }],
    PermissionRequest: [{ matcher: "Write", hooks: [{ type: "command", command: "perm.sh" }] }],
    PostToolUse: [{ matcher: "Read|Write|Edit", hooks: [{ type: "command", command: "post.sh" }] }],
    PostToolUseFailure: [{ matcher: "Read", hooks: [{ type: "command", command: "fail.sh" }] }],
    PostToolBatch: [{ hooks: [{ type: "command", command: "batch.sh" }] }],
  };
  const hookRun = (i) => {
    const ti = i.tool_input || {};
    if (i.hook_event_name === "PermissionRequest") return JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } });
    if (i.hook_event_name !== "PreToolUse" || i.tool_name !== "Write") return "";
    // The same file, its text changed; or another file, named from the folder Coder is in.
    if (String(ti.file_path).endsWith("/b.txt")) return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { ...ti, content: "TWO\n" } } });
    if (String(ti.file_path).endsWith("/c.txt")) return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { file_path: "src/d.txt", content: "dee\n" } } });
    return "";
  };
  // (The card for e.txt waits until a hook decides: no answer of the owner's.)
  const ask = (pid, o = {}) => new Promise((ok) => { const t = setInterval(() => { if (o.gone && o.gone()) { clearInterval(t); ok({ choice: "gone" }); } }, 2); });
  const t = await realLoop(d, [
    sayR("", [callR("read", { path: "src/a.txt" }, "r1"), callR("read", { path: "src/none.txt" }, "r2")]),
    sayR("", [callR("write", { path: "src/b.txt", content: "two\n" }, "w1")]),
    sayR("", [callR("write", { path: "src/c.txt", content: "see\n" }, "w2")]),
    sayR("", [callR("write", { path: "src/e.txt", content: "e\n" }, "w3")]),
    sayR("Done."),
  ], { here: sub, home: HOME, hooks, hookRun, ask, rules: { ask: ["Edit(src/e.txt)"] } });
  const ev = (name, tool) => t.hookCalls.filter((x) => x.hook_event_name === name && (!tool || x.tool_name === tool));
  const full = (f) => join(sub, "src", f);
  assert.deepEqual(ev("PreToolUse", "Read").map((x) => [x.tool_input.file_path, x.tool_input.path]), [[full("a.txt"), full("a.txt")], [full("none.txt"), full("none.txt")]]);
  assert.deepEqual(ev("PostToolUse", "Read").map((x) => x.tool_input.file_path), [full("a.txt")]);
  assert.deepEqual(ev("PostToolUseFailure", "Read").map((x) => x.tool_input.file_path), [full("none.txt")]);
  assert.deepEqual(ev("PermissionRequest", "Write").map((x) => x.tool_input.file_path), [full("e.txt")]);
  // PostToolBatch: Grok's own input, as Claude Code gives that event its model's tool calls.
  assert.deepEqual(ev("PostToolBatch")[0].tool_calls.map((x) => x.tool_input.file_path), ["src/a.txt", "src/none.txt"]);
  // The tools ran with Grok's own spelling; the hook's same-file rewrite too; its other file in full.
  const writes = t.toolReqs.filter((q) => q.tool === "write").map((q) => [q.args.path, q.args.content]);
  assert.deepEqual(writes, [["src/b.txt", "TWO\n"], [full("d.txt"), "dee\n"], ["src/e.txt", "e\n"]]);
  assert.deepEqual(t.toolReqs.filter((q) => q.tool === "read").map((q) => q.args.path), ["src/a.txt", "src/none.txt"]);
  assert.equal(await readFile(full("b.txt"), "utf8"), "TWO\n");
  assert.equal(await readFile(full("d.txt"), "utf8"), "dee\n");
  assert.equal(await readFile(full("e.txt"), "utf8"), "e\n");
  // Its PostToolUse hooks see the file it wrote, in full.
  assert.deepEqual(ev("PostToolUse", "Write").map((x) => x.tool_input.file_path), [full("b.txt"), full("d.txt"), full("e.txt")]);
  // The chat keeps the calls as Grok wrote them.
  const asked = t.r.messages.filter((m) => m.role === "assistant" && Array.isArray(m.tool_calls)).flatMap((m) => m.tool_calls.map((c) => JSON.parse(c.function.arguments).path));
  assert.deepEqual(asked, ["src/a.txt", "src/none.txt", "src/b.txt", "src/c.txt", "src/e.txt"]);
  // Where Coder's loop builds them: every tool event but PostToolBatch with the path in full.
  const agentSrc = read("container/coder-agent.mjs");
  assert.match(agentSrc, /const pathAt = \(\) => \(\{ cwd: hookCtx\(\)\.cwd, home: String\(deps\.home \|\| ""\) \}\);/);
  assert.equal((agentSrc.match(/hookToolInput\((?:x|c)\.name, (?:c\.)?args, pathAt\(\)\)/g) || []).length, 3, "PreToolUse: its if, its group's start, its turn");
  assert.match(agentSrc, /hookToolInput\(card\.hookTool \|\| card\.tool, callArgs, pathAt\(\)\)/);
  assert.match(agentSrc, /const callInput = \(c, at = pathAt\(\)\) =>/);
  assert.match(agentSrc, /tool_input: sentInput\(c\)/);
  assert.match(agentSrc, /hookInputCheck\(c\.name, u, "PreToolUse", c\.args\)/);
  assert.match(agentSrc, /hookInputCheck\(name0, upd, "PermissionRequest", callArgs\)/);
});

test("R6R2 (round 6) a PowerShell command that writes or reads the chat's own plan file runs as Claude Code 2.1.325's does: its PowerShell path check gives each path a cmdlet or redirection names to the same check as Bash's (its Fe, then nPo, Rre and Pot), where \"Plan files for current session are allowed for writing\" (and \"… for reading\") comes before its protected paths and working folders; no protected-file card for it in .claude/plans, and outside the project it is in scope; a quote, a variable, a wildcard, `..` after a folder, a link or another file still ask; a redirection to it asks as any redirection does", async () => {
  const A = await import("../container/coder-agent.mjs");
  const PSF = await import("./ps-fake.mjs");
  const PF = ROOT + "/.claude/plans/fix-the-cart.md";
  const o = { planFile: PF, cwd: ROOT, home: HOME, real: (p) => p };
  // Which words name it.
  for (const w of [".claude/plans/fix-the-cart.md", ".claude\\plans\\fix-the-cart.md", PF, "./.claude/plans/fix-the-cart.md", "../shop/.claude/plans/fix-the-cart.md"]) assert.equal(P.psPlanFile(w, o), true, w);
  for (const w of [".claude/plans/notes.md", ".claude/plans/x/../fix-the-cart.md", ".claude/plans/*.md", "$HOME/fix-the-cart.md", "'.claude/plans/fix-the-cart.md'", "FileSystem::" + PF, "~user/x", "//srv/x", "c:/x", ""]) assert.equal(P.psPlanFile(w, o), false, w);
  assert.equal(P.psPlanFile(PF, { ...o, real: () => "/etc/passwd" }), false, "not through a link");
  assert.equal(P.psPlanFile(PF, { ...o, planFile: "" }), false, "no plan file");
  assert.equal(P.psPlanFile("~/plans/p.md", { ...o, planFile: HOME + "/plans/p.md" }), true, "~ is the home folder");
  // Its protected-file question: not for the plan file; for another file in that folder, as before.
  const deps = { root: ROOT, home: HOME, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p) };
  const abs = (w) => (String(w).startsWith("/") ? String(w) : ROOT + "/" + String(w).replace(/\\/g, "/"));
  const plan = (w) => P.psPlanFile(w, o);
  for (const cmd of ["Set-Content -Path .claude/plans/fix-the-cart.md -Value x", "Add-Content .claude/plans/fix-the-cart.md x", "Remove-Item .claude/plans/fix-the-cart.md", "Out-File -FilePath .claude/plans/fix-the-cart.md -InputObject x", "Copy-Item notes.md -Destination .claude/plans/fix-the-cart.md"]) {
    assert.equal(A.psProtectedAsk(PSF.fakeParse(cmd), deps, abs, plan), null, cmd);
    assert.equal(A.psProtectedAsk(PSF.fakeParse(cmd), deps, abs).kind, "protected", cmd + ": a protected file of the project otherwise");
  }
  assert.equal(A.psProtectedAsk(PSF.fakeParse("Set-Content -Path .claude/plans/notes.md -Value x"), deps, abs, plan).kind, "protected");
  // In scope where it is outside the project (the chat's own plans folder): written and read in Accept edits as a project file.
  const MEM = "/srv/coder-memory/shop.plans/fix-the-cart.md";
  const inside = (w) => P.psPlanFile(w, { ...o, planFile: MEM }) || abs(w).startsWith(ROOT + "/");
  const pd = (cmd, mode = "acceptEdits", ins = inside) => P.psDecision(cmd, { mode, rules: {}, parsed: PSF.fakeParse(cmd), pathAbs: abs, inside: ins, cwd: ROOT, home: HOME, byCommand: true, dirs: [ROOT] });
  const outsideOnly = (w) => abs(w).startsWith(ROOT + "/");
  for (const cmd of ["Set-Content -Path " + MEM + " -Value x", "Add-Content " + MEM + " x", "Get-Content " + MEM]) {
    assert.equal(pd(cmd).verdict, "allow", cmd);
    assert.equal(pd(cmd, "acceptEdits", outsideOnly).verdict, "ask", cmd + ": outside the project otherwise");
  }
  assert.equal(pd("Set-Content -Path /srv/coder-memory/shop.plans/other.md -Value x").verdict, "ask", "another file beside it");
  assert.equal(pd("Set-Content -Path " + MEM + " -Value x", "plan").verdict, "ask", "Plan mode changes no files with a command");
  // Coder's loop gives the chat's plan file to both checks.
  const agentSrc = read("container/coder-agent.mjs");
  assert.match(agentSrc, /const psPlan = \(p\) => psPlanFile\(p, \{ planFile: planPath\(\), cwd: where0 \|\| deps\.root \|\| "\/", home: deps\.home \|\| "", real: \(q\) => realPath\(q\) \}\);/);
  assert.match(agentSrc, /const psInside = \(p\) => \{ if \(psPlan\(p\)\) return true;/);
  assert.match(agentSrc, /psProtectedAsk\(await psParse\(command\), deps, psAbs, psPlan\)/);

  // In Coder's loop, its plan file in .claude/plans, then in its own plans folder outside the project.
  const { mkdtemp, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const PFS = await import("../container/coder-plan-file.mjs");
  const { runCoder } = await import("../container/coder-agent.mjs");
  const root = await mkdtemp(join(tmpdir(), "coder-r6-ps-"));
  await mkdir(join(root, ".claude", "plans"), { recursive: true });
  const psLoop = async (cmds, { mode = "acceptEdits", custom = true, parse = PSF.fakeParse } = {}) => {
    const box = PFS.planStore({ dir: await mkdtemp(join(tmpdir(), "coder-r6-pd-")), stateFile: join(await mkdtemp(join(tmpdir(), "coder-r6-st-")), "plan.json"), rand: () => 0, ...(custom ? { custom: { dir: join(root, ".claude", "plans"), root } } : {}) });
    const f = await box.name("Fix the cart");
    const events = [], ran = [], cards = [];
    let n = 0;
    const steps = [...cmds(f).map((ps, k) => sayR("", [callR("powershell", { command: ps, description: "Run" }, "p" + k)])), sayR("Done.")];
    await runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => { if (/coder-tools\.mjs/.test(String(x.command))) return { code: 0, output: "" }; if (!/^__s=/.test(String(x.command))) ran.push(String(x.shown || x.command)); return { code: 0, output: "ok\n" }; },
      emit: (e) => events.push(e), here: () => root, root, home: HOME, chatId: "r6ps", where: (p) => (p.startsWith("/") ? p : join(root, p)),
      ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "no" }; },
      psParse: async (cmd) => parse(cmd), plan: box, toolSearch: "false",
    }, { text: "Fix the cart", mode, messages: [], rules: { allow: [], ask: [], deny: [] }, powershell: { bypass: true } });
    return { f, ran, cards };
  };
  for (const mode of ["acceptEdits", "auto"]) {
    const t = await psLoop((f) => ["Set-Content -Path " + f + " -Value x", "Set-Content -Path .claude/plans/notes.md -Value x"], { mode });
    assert.ok(t.ran.some((c) => c.includes("Set-Content -Path " + t.f)), mode + ": the plan file's command ran");
    assert.equal(t.cards.length, 1, mode + ": one card, for notes.md: " + JSON.stringify(t.cards.map((c) => c && c.why)));
    assert.match(String(t.cards[0].why || ""), /notes\.md which is a sensitive file/, mode);
    assert.ok(!t.ran.some((c) => c.includes("notes.md")), mode + ": No: not run");
  }
  // Outside the project (no plansDirectory): written and read in Accept edits with no card.
  const out = await psLoop((f) => ["Set-Content -Path " + f + " -Value x", "Get-Content " + f], { custom: false });
  assert.equal(out.cards.length, 0, JSON.stringify(out.cards.map((c) => c && c.why)));
  assert.equal(out.ran.length, 2);
  // A redirection to it asks as any PowerShell redirection does, in Claude Code's words, and not as a protected file.
  const redirected = (cmd) => { const target = cmd.slice(cmd.indexOf("> ") + 2); return PSF.parseOf(cmd, [PSF.pipeline(cmd, [{ ...PSF.cmdAst(cmd, PSF.str("Write-Output"), PSF.str("x")), redirections: [{ type: "FileRedirectionAst", append: false, fromStream: "Output", locationText: target }] }])]); };
  const rr = await psLoop((f) => ["Write-Output x > " + f], { parse: redirected });
  assert.equal(rr.cards.length, 1);
  assert.equal(rr.cards[0].why, "Command contains file redirections that could write to arbitrary paths");
});

test("R6R5 (round 6) read, write, edit and lsp take their path as Claude Code 2.1.325's Read, Write, Edit and LSP do (its St) before they use it, as grep and glob already did: trimmed, `~` and `~/` the home folder, a short one from the folder Coder's commands are in; the project-only rule stays, so a ~ path outside the project is refused as any outside path; the checks, the card and the step name the file the tool opens; the chat keeps what Grok wrote", async () => {
  const A = await import("../container/coder-agent.mjs");
  const { mkdtemp, mkdir, writeFile, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  // The agent's view of a file tool's path: as the tool opens it.
  const deps = { root: ROOT, home: HOME, where: (p) => (p.startsWith("/") ? p : ROOT + "/sub/" + p) };
  assert.equal(A.toolFullPath(deps, " src/a.ts "), ROOT + "/sub/src/a.ts");
  assert.equal(A.toolFullPath(deps, "~/notes.md"), HOME + "/notes.md");
  assert.equal(A.toolFullPath(deps, "~"), HOME);
  assert.equal(A.toolFullPath(deps, "  "), ROOT + "/sub/.");
  assert.equal(A.toolFullPath(deps, "~user/x"), ROOT + "/sub/~user/x", "~user is no home folder");
  assert.equal(A.toolFullPath({ ...deps, home: "" }, "~/x"), ROOT + "/sub/~/x", "no home known: as written");
  assert.equal(A.toolProjectPath(deps, " src/a.ts"), "sub/src/a.ts");
  assert.equal(A.toolProjectPath(deps, "~/notes.md"), HOME + "/notes.md", "outside the project: in full");
  // The tools script on its own: read, write, edit and lsp's file check.
  const d = await mkdtemp(join(tmpdir(), "coder-r6-tilde-"));
  await mkdir(join(d, "sub", "src"), { recursive: true }); await mkdir(join(d, "home"), { recursive: true });
  await writeFile(join(d, "sub", "src", "a.txt"), "one\n"); await writeFile(join(d, "home", "n.md"), "home note\n");
  const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const tool = (req, home) => { const o = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: d, encoding: "utf8", env: { PATH: process.env.PATH, CODER_CWD: join(d, "sub"), HOME: home } }); return { code: o.status, out: o.stdout.replace(/^\u0000coder-facts\u0000[^\n]*\n/, "").trimEnd() }; };
  const inHome = join(d, "home"), outHome = await mkdtemp(join(tmpdir(), "coder-r6-home-"));
  assert.match(tool({ tool: "read", args: { path: "  src/a.txt\t" } }, inHome).out, /\tone/);
  assert.match(tool({ tool: "read", args: { path: "~/n.md" } }, inHome).out, /\thome note/, "~ is the home folder (here inside the project)");
  assert.deepEqual(tool({ tool: "read", args: { path: "~/n.md" } }, outHome), { code: 1, out: "error: that path is outside the project" }, "outside the project: refused as any outside path");
  assert.equal(tool({ tool: "write", args: { path: " ~/w.txt ", content: "w\n" } }, inHome).code, 0);
  assert.equal(await readFile(join(d, "home", "w.txt"), "utf8"), "w\n");
  assert.equal(tool({ tool: "edit", args: { path: "~/w.txt", old_string: "w", new_string: "W" } }, inHome).code, 0);
  assert.equal(await readFile(join(d, "home", "w.txt"), "utf8"), "W\n");
  assert.deepEqual(tool({ tool: "write", args: { path: "~/x.txt", content: "x" } }, outHome), { code: 1, out: "error: that path is outside the project" });
  assert.deepEqual(tool({ tool: "lsp_file", args: { filePath: " src/a.txt " } }, inHome), { code: 0, out: "ok" }, "lsp's file check: the trimmed file");
  assert.match(tool({ tool: "lsp_file", args: { filePath: "~/none.ts" } }, inHome).out, /^error: File does not exist: ~\/none\.ts$/, "its words name the path as Grok wrote it, as Claude Code's do");
  // Coder's loop, its commands in sub, its home inside the project: Grok's spellings with spaces and ~.
  const cards = [];
  const t = await realLoop(d, [
    sayR("", [callR("read", { path: " src/a.txt " }, "r1"), callR("read", { path: " .env" }, "r2")]),
    sayR("", [callR("write", { path: "~/notes.md", content: "n\n" }, "w1")]),
    sayR("", [callR("write", { path: " .bashrc", content: "b\n" }, "w2")]),
    sayR("Done."),
  ], { here: join(d, "sub"), home: inHome, rules: { deny: ["Read(.env)"] }, ask: async (pid) => { cards.push(pid); return { choice: "no" }; } });
  assert.match(t.told("r1"), /\tone/);
  // The owner's deny rule meets the file the tool would open (before, " .env" passed the check as another name).
  assert.equal(t.told("r2"), "File is in a directory that is denied by your permission settings.");
  assert.match(t.told("w1"), /^File created successfully at: .*\/home\/notes\.md/);
  assert.equal(await readFile(join(d, "home", "notes.md"), "utf8"), "n\n");
  // A protected file named with a space before it: still a protected file, asked on a card (No: not written).
  const w2card = t.events.find((e) => e.type === "permission");
  assert.equal(cards.length, 1);
  assert.match(String(w2card.why), /sub\/\.bashrc/);
  assert.match(t.told("w2"), /^The owner doesn't want to proceed/);
  // The steps name the file the tool opened, as the project names it.
  assert.deepEqual(t.events.filter((e) => e.type === "bash").map((e) => [e.id, e.command]), [["r1", "sub/src/a.txt"], ["r2", "sub/.env"], ["w1", "home/notes.md"], ["w2", "sub/.bashrc"]]);
  // The chat keeps what Grok wrote, as Claude Code's transcript keeps its model's input.
  const asked = t.r.messages.filter((m) => m.role === "assistant" && Array.isArray(m.tool_calls)).flatMap((m) => m.tool_calls.map((c) => JSON.parse(c.function.arguments).path));
  assert.deepEqual(asked, [" src/a.txt ", " .env", "~/notes.md", " .bashrc"]);
  // A ~ path outside the project: the step in full; read in Auto, as Claude Code's Read reads outside the working folders there
  // (2026-11-18, the owner: "Yes pls"; with no one to answer, no question); not there, in the words of a missing file.
  const o = await realLoop(d, [sayR("", [callR("read", { path: "~/n2.md" }, "h1")]), sayR("Done.")], { here: join(d, "sub"), home: outHome });
  assert.equal(o.told("h1"), "error: no such file: " + join(outHome, "n2.md") + ". Note: your current working directory is " + join(d, "sub") + ".");
  assert.deepEqual(o.events.filter((e) => e.type === "bash").map((e) => e.command), [join(outHome, "n2.md")]);
});

test("R6R6 (round 6) PostToolBatch gets each call's input as Grok sent it, as Claude Code 2.1.325 gives that event its model's own tool calls (the reply's tool_use blocks): not a PreToolUse hook's rewrite of it, nor Coder's fixes of an input", async () => {
  const { mkdtemp, mkdir, writeFile, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = await mkdtemp(join(tmpdir(), "coder-r6-batch-"));
  await mkdir(join(d, "src"), { recursive: true });
  await writeFile(join(d, "src", "a.txt"), "TODO one\n");
  const hooks = { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolBatch: [{ hooks: [{ type: "command", command: "batch.sh" }] }] };
  const hookRun = (i) => (i.hook_event_name === "PreToolUse" ? JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { ...i.tool_input, content: "REWRITTEN\n" } } }) : "");
  const t = await realLoop(d, [
    sayR("", [callR("grep", { pattern: "TODO", file_path: "src", "-i": "true" }, "g1"), callR("read", { path: "src/a.txt" }, "r1")]),
    sayR("", [callR("write", { path: "src/b.txt", content: "mine\n" }, "w1")]),
    sayR("Done."),
  ], { hooks, hookRun });
  const batches = t.hookCalls.filter((x) => x.hook_event_name === "PostToolBatch");
  assert.equal(batches.length, 2);
  // Grep's input as sent: `file_path` and the text "true", which Coder's check fixed (path, true) before the call ran.
  assert.deepEqual(batches[0].tool_calls.map((x) => [x.tool_name, x.tool_input]), [["Grep", { pattern: "TODO", file_path: "src", "-i": "true" }], ["Read", { path: "src/a.txt", file_path: "src/a.txt" }]]);
  assert.ok(t.toolReqs.some((q) => q.tool === "grep" && q.args.path === "src" && q.args["-i"] === true), "the search ran with the fixed input");
  // The write ran with the hook's text; the batch shows Grok's.
  assert.equal(await readFile(join(d, "src", "b.txt"), "utf8"), "REWRITTEN\n");
  assert.deepEqual(batches[1].tool_calls.map((x) => x.tool_input), [{ path: "src/b.txt", content: "mine\n", file_path: "src/b.txt" }]);
  // And its tool response is the call's answer, as before.
  assert.match(String(batches[1].tool_calls[0].tool_response), /^File created successfully at: src\/b\.txt/);
  assert.match(read("container/coder-agent.mjs"), /tool_input: sentInput\(c\), tool_use_id: c\.id/);
});
