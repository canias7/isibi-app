// THE REPOSITORY'S SKILLS, CLAUDE CODE'S WAY (the audit, 2026-11-20): .claude/skills/<name>/SKILL.md and .claude/commands/*.md
// are read on the machine; Coder is told each one's name and description, loads one with its skill tool, and the owner runs
// one with /name. Skill(name) rules apply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const K = await import("../container/coder-skills.mjs");
const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-perms.mjs");
const ROOT = "/work/shop";

const DEPLOY = { name: "deploy-notes", description: "Write release notes for a deploy", body: "Read the git log.\nWrite notes for $ARGUMENTS.", dir: "/work/shop/.claude/skills/deploy-notes", model: true, user: true };
const SECRET = { name: "owner-only", description: "Only the owner runs this", body: "Do the owner's thing.", dir: "/x", model: false, user: true };

test("SK1 skills are read from .claude/skills/*/SKILL.md and .claude/commands/*.md, with their front matter", () => {
  const d = mkdtempSync(join(tmpdir(), "coder-skills-"));
  try {
    mkdirSync(join(d, ".claude/skills/deploy-notes"), { recursive: true });
    writeFileSync(join(d, ".claude/skills/deploy-notes/SKILL.md"), "---\nname: deploy-notes\ndescription: \"Write release notes\"\n---\n\nRead the git log.\n");
    mkdirSync(join(d, ".claude/skills/quiet"), { recursive: true });
    writeFileSync(join(d, ".claude/skills/quiet/SKILL.md"), "---\ndisable-model-invocation: true\n---\n# Quiet\n\nOnly when asked.\n");
    mkdirSync(join(d, ".claude/commands"), { recursive: true });
    writeFileSync(join(d, ".claude/commands/fix-lint.md"), "Run the linter and fix what it finds.\n");
    const s = K.readSkills(d);
    assert.deepEqual(s.map((x) => x.name), ["deploy-notes", "quiet", "fix-lint"]);
    assert.equal(s[0].description, "Write release notes");
    assert.equal(s[1].model, false);
    assert.equal(s[1].description, "Quiet");
    assert.equal(s[2].description, "Run the linter and fix what it finds.");
    assert.deepEqual(K.readSkills(join(d, "none")), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("SK2 the listing, the loaded text, the owner's /name and Skill(name) rules", () => {
  assert.equal(K.skillsListing([DEPLOY, SECRET]), "The following skills are available for use with the skill tool:\n\n- deploy-notes: Write release notes for a deploy");
  assert.match(K.skillLoaded(DEPLOY, "v2"), /^Base directory for this skill: \/work\/shop\/\.claude\/skills\/deploy-notes\n\nRead the git log\.\nWrite notes for v2\.$/);
  assert.match(K.skillLoaded({ ...DEPLOY, body: "Hi." }, "x y"), /Hi\.\n\nARGUMENTS: x y$/);
  assert.equal(K.slashSkill("/deploy-notes v3", [DEPLOY]).args, "v3");
  assert.equal(K.slashSkill("/compact", [DEPLOY]), null);
  assert.equal(K.skillRule({ deny: ["Skill(deploy-notes)"] }, "deny", "deploy-notes", P.parseRule), "Skill(deploy-notes)");
  assert.equal(K.skillRule({ deny: ["Skill(deploy*)"] }, "deny", "deploy-notes", P.parseRule), "Skill(deploy*)");
  assert.equal(K.skillRule({ deny: ["Skill(other)"] }, "deny", "deploy-notes", P.parseRule), "");
  assert.ok(P.parseRule("Skill"));
});

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
async function job(steps, { text = "write the notes", skills = [DEPLOY, SECRET], rules = null } = {}) {
  const events = [], seen = [];
  let n = 0;
  await A.runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => (/--porcelain=v1/.test(x.command) ? { code: 0, output: "__git_rc=128\n" } : { code: 0, output: "ok\n" }),
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-sk", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async () => ({ choice: "yes" }),
  }, { text, mode: "acceptEdits", skills, rules });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { events, seen, told };
}

test("SK3 Coder is told the skills, has the skill tool, and loading one gives its whole text", async () => {
  const t = await job([say("", [call("skill", { skill: "deploy-notes", args: "v9" }, "s1")]), say("done")]);
  const first = JSON.stringify(t.seen[0].messages);
  assert.match(first, /- deploy-notes: Write release notes for a deploy/);
  assert.doesNotMatch(first, /owner-only/);
  assert.ok(t.seen[0].tools.some((x) => x.function && x.function.name === "skill"));
  assert.match(t.told("s1"), /^Launching skill: deploy-notes\n\nBase directory for this skill: .*\n\nRead the git log\.\nWrite notes for v9\./);
  assert.ok(t.events.some((e) => e.type === "skills" && e.list.some((x) => x.name === "deploy-notes")));
  const t2 = await job([say("", [call("skill", { skill: "owner-only" }, "s2")]), say("done")]);
  assert.match(t2.told("s2"), /Unknown skill/);
  // (No skills: no tool, no listing.)
  const t3 = await job([say("hi")], { skills: [] });
  assert.ok(!t3.seen[0].tools.some((x) => x.function && x.function.name === "skill"));
});

test("SK4 the owner's /name loads the skill with the message; a Skill(name) deny rule refuses it", async () => {
  let t = await job([say("done")], { text: "/deploy-notes v4" });
  assert.match(JSON.stringify(t.seen[0].messages), /<command-name>\/deploy-notes<\/command-name>\\nBase directory for this skill: [^"]*Write notes for v4\./);
  t = await job([say("", [call("skill", { skill: "deploy-notes" }, "s3")]), say("done")], { rules: { allow: [], ask: [], deny: ["Skill(deploy-notes)"] } });
  assert.match(t.told("s3"), /has been denied/);
  t = await job([say("done")], { text: "/deploy-notes v4", rules: { allow: [], ask: [], deny: ["Skill"] } });
  assert.doesNotMatch(JSON.stringify(t.seen[0].messages), /command-name/);
  assert.ok(!t.seen[0].tools.some((x) => x.function && x.function.name === "skill"));
});

test("SK5 the machine passes the repository's skills, the page lists them in its / menu, and the 'no skills' remark is gone", () => {
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /skills: gloopy \|\| body\.github === true \? \[\] : \(\(\) => \{ try \{ return (?:withOwnerSkills\()?readSkills\(dir\)/); // (and the owner's saved and plugins' skills: plugins-tools.test.mjs)
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /\[\.\.\.SLASH, \.\.\.skillsSlash\(\)\]/);
  assert.doesNotMatch(readFileSync(new URL("../container/coder-tools.mjs", import.meta.url), "utf8"), /as Coder has no skills/);
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /coder-skills\.mjs/);
});
