// A SECURITY CHECK ON EACH EDIT, LIKE CLAUDE CODE'S (owner, 2026-11-07, item 12: "nothing checks each
// edit as Coder writes"; Claude Code's security-guidance docs: a pattern match on what Claude writes, no
// model call, the warning added for its next step, once per pattern per file; a repo's own rules in
// .claude/security-patterns.yaml). Coder's: container/coder-security.mjs, .coder/security-patterns.*.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const C = await import("../container/coder-security.mjs");

test("CD160 Coder's own rules catch the risky kinds Claude Code names (dynamic code, unsafe deserialization, DOM injection, workflow files), and a few more, without crying wolf at look-alikes; each once a job for each file", () => {
  const warn = (rel, text) => C.checkEdit(rel, text, C.BUILTIN_RULES, new Set());
  const yes = [
    ["a.js", "const v = eval(input);", "eval"],
    ["a.py", "x = eval(s)", "eval"],
    ["a.js", "const f = new Function('a', body);", "new_function"],
    ["a.py", "os.system('rm ' + name)", "os_system"],
    ["a.py", "subprocess.run(cmd, shell=True)", "shell_true"],
    ["a.js", "require('child_process').exec(cmd)", "child_process_exec"],
    ["a.js", "import { exec } from \"node:child_process\";", "child_process_exec"],
    ["a.py", "data = pickle.loads(blob)", "pickle"],
    ["a.py", "cfg = yaml.load(f)", "yaml_load"],
    ["a.jsx", "<div dangerouslySetInnerHTML={{ __html: html }} />", "dangerously_set_inner_html"],
    ["a.js", "el.innerHTML = userText;", "inner_html"],
    ["a.js", "el.insertAdjacentHTML('beforeend', html)", "inner_html"],
    ["a.js", "document.write(x)", "document_write"],
    ["a.py", "cur.execute(f\"SELECT * FROM users WHERE id = {uid}\")", "sql_from_text"],
    ["a.js", "db.query(`SELECT * FROM t WHERE id = ${id}`)", "sql_from_text"],
    ["k.pem", "-----BEGIN RSA PRIVATE KEY-----\nMIIE", "private_key"],
    [".github/workflows/ci.yml", "on: push", "workflow_file"],
  ];
  for (const [rel, text, rule] of yes) assert.match(warn(rel, text), new RegExp("^SECURITY CHECK of this edit to " + rel.replace(/[.]/g, "\\.") + " \\(Coder's check on each edit; it blocks nothing\\):\\n(.*\\n)*- " + rule + ": "), rel + ": " + text);
  const no = [
    ["a.py", "model.eval()"], ["a.js", "const m = re.exec(s);"], ["a.py", "cfg = yaml.load(f, Loader=yaml.SafeLoader)"], ["a.py", "cfg = yaml.safe_load(f)"],
    ["a.js", "if (el.innerHTML == '') {}"], ["a.js", "el.textContent = userText;"], ["a.py", "cur.execute(\"SELECT * FROM t WHERE id = ?\", (uid,))"],
    ["a.py", "subprocess.run(['ls', '-l'])"], ["a.js", "const { execFile } = require('child_process');"], ["docs/ci.md", "on: push"],
  ];
  for (const [rel, text] of no) assert.equal(warn(rel, text), "", rel + ": " + text);
  // ONCE A JOB FOR EACH FILE.
  const shown = new Set();
  assert.notEqual(C.checkEdit("a.js", "eval(x)", C.BUILTIN_RULES, shown), "");
  assert.equal(C.checkEdit("a.js", "eval(y)", C.BUILTIN_RULES, shown), "", "the same rule, the same file: once");
  assert.notEqual(C.checkEdit("b.js", "eval(y)", C.BUILTIN_RULES, shown), "", "another file: again");
  // What went in: the whole file for write, the new text for edit; nothing for other tools.
  assert.equal(C.editedText("write", { content: "x" }), "x");
  assert.equal(C.editedText("edit", { old_string: "eval(a)", new_string: "safe(a)" }), "safe(a)");
  assert.equal(C.editedText("read", { path: "a" }), null);
});

test("CD161 a repo's own rules (.coder/security-patterns.json, .yaml or .yml, Claude Code's fields): regex or substrings, paths and exclude_paths, a 1 KB reminder; bad ones skipped; 50 at most", async () => {
  // Claude Code's docs' own example, as YAML.
  const yaml = 'patterns:\n  - rule_name: internal_api_key\n    substrings: ["sk_live_", "AKIA"]\n    reminder: "Hardcoded API key prefix. Load credentials from the secret manager."\n  - rule_name: tenant_unfiltered_query\n    regex: "\\\\.objects\\\\.all\\\\(\\\\)"\n    paths: ["**/src/tenants/**"]\n    reminder: "Multi-tenant code must filter by org_id."\n  - rule_name: no_console\n    regex: console\\.log\n    exclude_paths:\n      - "scripts/**"\n    reminder: Use the logger.\n';
  const rules = C.parseRulesFile(yaml, "yaml");
  assert.deepEqual(rules.map((r) => [r.rule_name, r.substrings || String(r.regex), r.paths || r.exclude_paths || null]), [
    ["repo:internal_api_key", ["sk_live_", "AKIA"], null],
    ["repo:tenant_unfiltered_query", "/\\.objects\\.all\\(\\)/m", ["**/src/tenants/**"]],
    ["repo:no_console", "/console\\.log/m", ["scripts/**"]],
  ]);
  const w = (rel, text) => C.checkEdit(rel, text, rules, new Set());
  assert.match(w("app/settings.py", "KEY = 'sk_live_123'"), /- repo:internal_api_key: Hardcoded API key prefix\./);
  assert.match(w("src/tenants/views.py", "Org.objects.all()"), /- repo:tenant_unfiltered_query: Multi-tenant code must filter by org_id\./);
  assert.equal(w("src/billing/views.py", "Org.objects.all()"), "", "only its paths");
  assert.match(w("app/a.js", "console.log(x)"), /- repo:no_console: Use the logger\./);
  assert.equal(w("scripts/build.js", "console.log(x)"), "", "not its excluded paths");
  // JSON, the same fields; bad rules are skipped; a long reminder is cut at 1 KB.
  const json = JSON.stringify({ patterns: [
    { rule_name: "ok_one", regex: "TODO\\(security\\)", reminder: "R".repeat(5000) },
    { rule_name: "bad regex", regex: "(", reminder: "x" },
    { rule_name: "no_reminder", regex: "x" },
    { rule_name: "nothing_to_match", reminder: "x" },
    ...Array.from({ length: 80 }, (_, i) => ({ rule_name: "r" + i, substrings: ["zz" + i], reminder: "x" })),
  ] });
  const j = C.parseRulesFile(json, "json");
  assert.equal(j.length, 50, "50 at most");
  assert.equal(j[0].reminder.length, 1024);
  assert.equal(C.parseRulesFile("{broken", "json").length, 0);
  // READ FROM THE REPO by the service, beside Coder's own rules.
  const S = await import("../container/server.mjs");
  const dir = await mkdtemp(join(tmpdir(), "coder-sec-"));
  await mkdir(join(dir, ".coder"), { recursive: true });
  await writeFile(join(dir, ".coder", "security-patterns.yaml"), yaml);
  await writeFile(join(dir, ".coder", "security-patterns.json"), JSON.stringify({ patterns: [{ rule_name: "from_json", substrings: ["DROP TABLE"], reminder: "No." }] }));
  assert.deepEqual((await S.repoSecurityRules(dir)).map((r) => r.rule_name), ["repo:from_json", "repo:internal_api_key", "repo:tenant_unfiltered_query", "repo:no_console"]);
});

// ── A WHOLE JOB: Coder writes a risky line, and its next step is told ──
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
async function fakeRemote(repo = "ana/shop") {
  const root = await mkdtemp(join(tmpdir(), "coder-gh-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  await mkdir(join(work, ".coder"), { recursive: true });
  await writeFile(join(work, ".coder", "security-patterns.json"), JSON.stringify({ patterns: [{ rule_name: "no_md5", substrings: ["md5("], reminder: "MD5 is broken; use SHA-256." }] }));
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  execFileSync("mkdir", ["-p", join(root, repo.split("/")[0])]);
  execFileSync("git", ["clone", "-q", "--bare", work, join(root, repo + ".git")]);
  return { remote: root + "/" };
}

test("CD162 in a real job: after Coder writes a file with eval( and the repo's own risky text, its next step gets the warning with the tool's answer; a clean file gets none", async () => {
  const S = await import("../container/server.mjs");
  const { remote } = await fakeRemote();
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const steps = [
    { message: { role: "assistant", content: "", tool_calls: [call("write", { path: "app.js", content: "const v = eval(input);\nconst h = md5(v);\n" }, "w1"), call("write", { path: "ok.js", content: "export const a = 1;\n" }, "w2")] } },
    { message: { role: "assistant", content: "Done." } },
  ];
  let i = 0; const seen = [];
  const app = S.createApp({ root: await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-git-")), memRoot: await mkdtemp(join(tmpdir(), "coder-mem-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-bgr-")), proxyDir: await mkdtemp(join(tmpdir(), "coder-pxm-")), remote, send: async (q) => { seen.push(q); return steps[Math.min(i++, steps.length - 1)]; } });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const post = async (p, b) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
    assert.deepEqual(await post("/turn", { project: "shop-sec1", text: "go", messages: [], repo: "ana/shop", base: "main", branch: "coder/shop-sec1", token: "" }), { ok: true });
    let st; for (let k = 0; k < 200; k++) { st = await (await fetch(base + "/state?project=shop-sec1&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    assert.equal(st.result.status, "done");
    const tools = seen[1].messages.filter((m) => m.role === "tool");
    assert.match(tools[0].content, /SECURITY CHECK of this edit to app\.js \(Coder's check on each edit; it blocks nothing\):\n- eval: Dynamic code execution[^\n]*\n- repo:no_md5: MD5 is broken; use SHA-256\.\nFix it now unless it is safe here; if it is, say why in your answer\./);
    assert.doesNotMatch(tools[1].content, /SECURITY CHECK/, "a clean file: nothing");
  } finally { await new Promise((r) => srv.close(r)); }
});
