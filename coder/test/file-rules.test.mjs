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
  for (const r of ["NotebookEdit", "Agent"]) assert.equal(P.ruleSaved(r), false, r);
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
  // (Read's own words for a Read path rule, Claude Code 2.1.325's Read validateInput, since 2026-11-14.)
  assert.deepEqual(fd("read", ROOT + "/.env", { deny: ["Read(.env)"] }), { verdict: "deny", rule: "Read(.env)", why: "File is in a directory that is denied by your permission settings." });
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
  assert.deepEqual(reqs.find((q) => q.tool === "grep").ctx.deny, { rules: ["Read(.env)"], sources: null, root: ROOT, home: "" });
  assert.equal(out("g1"), "Found 2 files\nsecrets/k.txt\nsrc/a.js");
  assert.equal(cards.length, 1);
  assert.deepEqual([cards[0].tool, cards[0].path, cards[0].why, cards[0].rules], ["read", "docs/a.md", "Your rule Read(docs/**) asks first for reading /work/shop/docs/a.md.", undefined]);
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
  assert.match(src, /For files, <code>Read\(\.\/\.env\)<\/code> or <code>Edit\(src\/\*\*\)<\/code>, written as in a \.gitignore: <code>\/\/<\/code> starts at the machine\\'s root, <code>~\/<\/code> at Coder\\'s home, any other path at the project\./);
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
  // Their asks were already a path rule's words (Coder's card): Read(**) and Edit(**) the same as any path.
  assert.equal(fd("read", ROOT + "/a.md", { ask: ["Read(**)"] }).why, "Your rule Read(**) asks first for reading /work/shop/a.md.");
  assert.equal(fd("edit", ROOT + "/a.md", { ask: ["Edit(**)"] }).why, "Your rule Edit(**) asks first for editing /work/shop/a.md.");
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
