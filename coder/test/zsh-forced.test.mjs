// ZSH'S FORCED REDIRECTIONS (2026-11-20, audit I34): Coder runs commands in zsh, where `>! file` writes to `file`.
// Claude Code checks every output redirection's file against Edit rules, protected paths and the working folders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShell } from "../container/coder-shell.mjs";
import { bashDecision, readCommand } from "../container/coder-perms.mjs";
import { writeTargets } from "../container/coder-bashcheck.mjs";

const ROOT = "/work/shop";
const isProtected = (p) => { const rel = p.startsWith(ROOT + "/") ? p.slice(ROOT.length + 1) : ""; return /(^|\/)(\.git|\.husky)(\/|$)/.test(rel) ? "protected" : ""; };
const decide = (mode, command, rules = {}) => bashDecision(command, { mode, rules, cwd: ROOT, workdirs: [ROOT], isProtected });
const FORMS = [">!", ">>!", "&>!", ">&!", "&>>!", ">>&!", ">|", ">>|", "&>|", ">&|", "&>>|"];

test("ZF1 every zsh forced form names the real file, never '!' or '|'", () => {
  for (const f of FORMS) for (const cmd of ["echo x " + f + " .env", "echo x " + f + ".env"]) {
    const r = parseShell(cmd);
    assert.equal(r.ok, true, cmd);
    const x = r.commands[0].redirects[0];
    assert.equal(x.target.text, ".env", cmd);
    const t = writeTargets(cmd).targets.map((y) => y.path);
    assert.deepEqual(t, [".env"], cmd);
    const w = readCommand(cmd, { cwd: ROOT }).writes.map((y) => y.path);
    assert.ok(w.includes(ROOT + "/.env") && !w.some((p) => /[!|]$/.test(p)), cmd + " " + JSON.stringify(w));
  }
});

test("ZF2 a deny Edit rule on the real file stops every forced form in Auto, Accept edits and Plan", () => {
  for (const mode of ["auto", "acceptEdits", "plan"]) for (const f of FORMS) {
    const d = decide(mode, "echo x " + f + " .env", { deny: ["Edit(./.env)"] });
    assert.equal(d.verdict, "deny", mode + " " + f);
  }
});

test("ZF3 a forced write to a protected file asks; outside the project asks", () => {
  assert.equal(decide("acceptEdits", "echo x >! .husky/pre-commit").verdict, "ask");
  assert.notEqual(decide("acceptEdits", "echo x >! /etc/x").verdict, "allow");
});
