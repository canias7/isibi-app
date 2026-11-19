// Claude Code fixes, batch 10 (2026-11-19): audit items L-second-11, 12, 13, 14, 17, 19, L-machine-19, M-e-31, M-g-25.
import { test } from "node:test";
import assert from "node:assert/strict";

const P = await import("../container/coder-perms.mjs");
const S = await import("../container/coder-ps.mjs");
const Q = await import("../container/coder-psparse.mjs");
const A = await import("../container/coder-agent.mjs");
const { fakeParse } = await import("./ps-fake.mjs");
const ROOT = "/work/shop", HOME = "/home/dev";

test("B10-1 L-second-11: a rule on a search tool's input may use * after the colon; a path-style :* is still refused", async () => {
  for (const r of ["Glob(pattern:*.env)", "Grep(output_mode:*)", "Grep(glob:*.env)", "Glob(pattern:**/*.env)"]) assert.equal(P.ruleProblem(r), "", r);
  assert.match(P.ruleProblem("Glob(src/:*)"), /only for Bash prefix rules/);
  assert.match(P.ruleProblem("Read(src:*)"), /only for Bash prefix rules/);
  const R = await import("../src/coder-routes.mjs");
  const bucket = { m: new Map(), async get(k) { return this.m.has(k) ? { text: async () => this.m.get(k) } : null; }, async put(k, v) { this.m.set(k, String(v)); } };
  await R.changeRules(bucket, "u1", "ana/shop", "deny", ["Glob(pattern:*.env)"]);
  assert.deepEqual((await R.rulesOf(bucket, "u1", "ana/shop")).deny, ["Glob(pattern:*.env)"]);
});

test("B10-2 L-second-12: deny and ask rules on a WebSocket monitor's own inputs apply", () => {
  const input = { ws: { url: "wss://x.example/feed" }, description: "feed", timeout_ms: 60000 };
  for (const mode of ["auto", "acceptEdits", "plan"]) assert.equal(P.wsDecision({ rules: { deny: ["Monitor(timeout_ms:*)"] }, mode, input }).verdict, "deny", mode);
  assert.equal(P.wsDecision({ rules: { ask: ["Monitor(description:*)"] }, mode: "auto", input }).verdict, "ask");
  assert.equal(P.wsDecision({ rules: { deny: ["Monitor(description:other)"] }, mode: "auto", input }).verdict, "check");
  assert.equal(P.wsDecision({ rules: { deny: ["Bash(timeout:*)"] }, mode: "auto", input }).verdict, "check", "Bash's setting rules stay off a ws watch");
});

test("B10-3 L-second-13: git checkout <file> and git switch -f / --discard-changes count as discarding work", () => {
  for (const c of ["git checkout b.txt", "git checkout HEAD b.txt", "git switch -f main", "git switch --discard-changes main"]) assert.equal(P.discardsWork(c), true, c);
  for (const c of ["git checkout -b new", "git switch main", "git status"]) assert.equal(P.discardsWork(c), false, c);
});

test("B10-4 L-second-14 and M-e-31: cp --parents is checked where it really writes; a cp's source is only read", () => {
  const d = (command, rules, mode = "auto") => P.bashDecision(command, { mode, rules, cwd: ROOT, workdirs: [ROOT], home: HOME });
  for (const mode of ["auto", "acceptEdits", "plan"]) {
    assert.equal(d("cp --parents src/x.js docs/", { deny: ["Edit(./docs/src/**)"] }, mode).verdict, "deny", mode);
    assert.equal(d("cp src/x.js docs/src/", { deny: ["Edit(./docs/src/**)"] }, mode).verdict, "deny", mode);
  }
  const ed = { deny: ["Edit(/secret.txt)"] };
  for (const mode of ["auto", "acceptEdits"]) {
    assert.notEqual(d("cp secret.txt copy.txt", ed, mode).verdict, "deny", mode);
    assert.notEqual(d("cp secret.txt out/", ed, mode).verdict, "deny", mode);
  }
  assert.equal(d("cp secret.txt copy.txt", { deny: ["Edit(/copy.txt)"] }).verdict, "deny");
  assert.equal(d("cp secret.txt copy.txt", { deny: ["Read(/secret.txt)"] }).verdict, "deny");
  assert.equal(d("mv secret.txt x", ed).verdict, "deny", "mv changes its source");
  assert.notEqual(d("cp -r src backup", { deny: ["Edit(/src/**)"] }).verdict, "deny");
});

test("B10-5 L-second-19: a PowerShell command that could not be read asks in every mode, Auto too; deny rules still refuse; the protected-file card still names the file", () => {
  const cmd = "Set-Content -Path .husky/pre-commit -Value x # `u{41}";
  const bad = Q.psParseFail(cmd, "bad escape", "x");
  for (const mode of ["auto", "acceptEdits", "plan"]) {
    const r = P.psDecision(cmd, { mode, parsed: bad, cwd: ROOT, home: HOME });
    assert.equal(r.verdict, "ask", mode);
    assert.match(r.why, /could not fully check your permission rules/i);
  }
  const t = Q.psParseFail("Get-ChildItem", "timed out", "PwshTimeout");
  assert.equal(P.psDecision("Get-ChildItem", { mode: "auto", parsed: t }).verdict, "ask");
  assert.equal(P.psDecision(cmd, { mode: "auto", parsed: bad, rules: { deny: ["PowerShell(Set-Content *)"] } }).verdict, "deny");
  const deps = { root: ROOT, home: HOME };
  const abs = (w) => (w.startsWith("/") ? w : ROOT + "/" + w);
  const ask = A.psProtectedAsk(bad, deps, abs, () => false, { command: cmd });
  assert.ok(ask && ask.kind === "protected" && ask.paths.some((p) => p.includes(".husky/pre-commit")), JSON.stringify(ask));
});

test("B10-6 L-machine-19: a PowerShell rule on the cmdlet covers all the short names Coder knows", () => {
  for (const [k, v] of Object.entries(Q.PS_CC_ALIASES)) assert.equal(S.PS_ALIASES[k], v.toLowerCase(), k);
  for (const k of Object.keys(S.PS_ALIASES)) assert.ok(k in Q.PS_CC_ALIASES || ["sort", "gm", "diff", "compare"].includes(k), k);
  assert.equal(S.psRuleMatches("Rename-Item *", "rni a b"), true);
  assert.equal(S.psRuleMatches("Import-Module *", "ipmo ./x.psm1"), true);
  assert.equal(S.psRuleMatches("New-Item *", "md build"), true);
});

test("B10-7 L-second-17: Select-String with a named -Pattern still has its file checked", () => {
  const paths = (cmd) => Q.psPathArgs(Q.psCommands(fakeParse(cmd)).find((c) => c.elementType === "CommandAst"));
  assert.deepEqual(paths("Select-String -Pattern alpha ../outside/o.txt"), ["../outside/o.txt"]);
  assert.deepEqual(paths("Select-String -SimpleMatch -Pattern alpha ../outside/o.txt"), ["../outside/o.txt"]);
  assert.deepEqual(paths("Select-String -patt alpha ../outside/o.txt"), ["../outside/o.txt"]);
  assert.deepEqual(paths("Select-String alpha src/a.txt"), ["src/a.txt"]);
  assert.deepEqual(paths("Select-String -Pattern alpha src/a.txt"), ["src/a.txt"]);
});

test("B10-8 M-g-25: a Read ask on a link says where the link leads", () => {
  const real = (p) => (p === ROOT + "/key" ? ROOT + "/secrets/id_rsa" : p);
  const d = P.fileToolDecision("read", ROOT + "/key", { rules: { ask: ["Read(secrets/**)"] }, root: ROOT, home: HOME, real });
  assert.equal(d.verdict, "ask");
  assert.equal(d.leadsTo, ROOT + "/secrets/id_rsa");
  const plain = P.fileToolDecision("read", ROOT + "/secrets/a", { rules: { ask: ["Read(secrets/**)"] }, root: ROOT, home: HOME, real: (p) => p });
  assert.equal(plain.verdict, "ask");
  assert.equal(plain.leadsTo, undefined);
});
