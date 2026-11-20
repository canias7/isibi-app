// THE REPOSITORY'S SKILLS, CLAUDE CODE'S WAY (the audit, 2026-11-20; Claude Code's skills docs and its cloud docs: "Your repo's
// `.claude/skills/`, `.claude/agents/`, `.claude/commands/` | Yes | Part of the clone"): a skill is a folder under
// .claude/skills with a SKILL.md (front matter with its name and description, then its instructions); a file under
// .claude/commands is one too (its name the file's). Coder is told each skill's name and description, loads one's whole text
// with its skill tool (Claude Code's Skill) when the task matches, and the owner runs one by typing /name. Front-matter
// options past the name, the description, disable-model-invocation and user-invocable (allowed-tools, context: fork, hooks,
// paths) are not read yet.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const SKILLS_MAX = 50;
export const SKILL_TEXT_MAX = 20_000;
export const SKILL_DESC_MAX = 250;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** A SKILL.md's front matter and body: { meta: { key: value }, body }. Only simple `key: value` lines are read. */
export function frontMatter(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(s);
  if (!m) return { meta: {}, body: s };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    meta[kv[1].toLowerCase()] = v;
  }
  return { meta, body: s.slice(m[0].length) };
}

const isTrue = (v) => /^true$/i.test(String(v || "").trim());
const isFalse = (v) => /^false$/i.test(String(v || "").trim());

/** One skill from its file's text: { name, description, body, dir, model, user } or null. */
export function skillFrom(text, fallbackName, dir) {
  const { meta, body } = frontMatter(text);
  const name = NAME_RE.test(String(meta.name || "").trim()) ? String(meta.name).trim() : fallbackName;
  if (!NAME_RE.test(String(name || ""))) return null;
  // (No description: Claude Code takes the first paragraph of the instructions.)
  const first = body.split(/\r?\n\s*\r?\n/).map((p) => p.replace(/^#+\s*/gm, "").trim()).find(Boolean) || "";
  const description = String(meta.description || first).replace(/\s+/g, " ").trim().slice(0, SKILL_DESC_MAX);
  return { name, description, body: body.slice(0, SKILL_TEXT_MAX), dir, model: !isTrue(meta["disable-model-invocation"]), user: !isFalse(meta["user-invocable"]) };
}

/** The skills of the project at `root`: .claude/skills/<name>/SKILL.md, then .claude/commands/<name>.md (a skill's name wins). */
export function readSkills(root) {
  const out = [], seen = new Set();
  const add = (s) => { if (s && !seen.has(s.name.toLowerCase()) && out.length < SKILLS_MAX) { seen.add(s.name.toLowerCase()); out.push(s); } };
  const list = (d) => { try { return readdirSync(d).sort(); } catch { return []; } };
  const text = (f) => { try { const st = statSync(f); return st.isFile() && st.size <= 256 * 1024 ? readFileSync(f, "utf8") : null; } catch { return null; } };
  const sk = join(String(root || "/"), ".claude", "skills");
  for (const d of list(sk)) { const t = text(join(sk, d, "SKILL.md")); if (t !== null) add(skillFrom(t, d, join(sk, d))); }
  const cm = join(String(root || "/"), ".claude", "commands");
  for (const f of list(cm)) { if (!/\.md$/i.test(f)) continue; const t = text(join(cm, f)); if (t !== null) add(skillFrom(t, f.replace(/\.md$/i, ""), cm)); }
  return out;
}

/** What Coder is told of the skills it may load: Claude Code's listing, each skill's name and description. */
export function skillsListing(skills) {
  const mine = (Array.isArray(skills) ? skills : []).filter((s) => s && s.model);
  if (!mine.length) return "";
  return "The following skills are available for use with the skill tool:\n\n" + mine.map((s) => "- " + s.name + ": " + s.description).join("\n");
}

/** A skill's whole text as it is loaded, with its arguments ($ARGUMENTS, or added after it as Claude Code adds them). */
export function skillLoaded(skill, args = "") {
  const a = String(args || "").trim();
  let body = String(skill.body || "");
  if (body.includes("$ARGUMENTS")) body = body.split("$ARGUMENTS").join(a);
  else if (a) body += "\n\nARGUMENTS: " + a;
  return "Base directory for this skill: " + skill.dir + "\n\n" + body.trim();
}

/** The owner's "/name args" when name is a skill they may run: { skill, args } or null. */
export function slashSkill(text, skills) {
  const m = /^\/([A-Za-z0-9][\w-]{0,63})(?:\s+([\s\S]*))?$/.exec(String(text || "").trim());
  if (!m) return null;
  const skill = (Array.isArray(skills) ? skills : []).find((s) => s && s.user && s.name.toLowerCase() === m[1].toLowerCase());
  return skill ? { skill, args: String(m[2] || "").trim() } : null;
}

/** Claude Code's Skill(name) rules: the rule of `kind` that names this skill (bare Skill is the whole tool's), or "". */
export function skillRule(rules, kind, name, parse) {
  for (const r of Array.isArray(rules && rules[kind]) ? rules[kind] : []) {
    const x = parse(r);
    if (!x || x.tool !== "Skill" || x.spec === null) continue;
    const spec = x.spec.replace(/:\*$/, "*");
    if (spec === name || (spec.endsWith("*") && name.startsWith(spec.slice(0, -1)))) return r;
  }
  return "";
}

/** The skill tool's definition, as Grok is given it. */
export const SKILL_TOOL = Object.freeze({
  type: "function",
  function: {
    name: "skill",
    description: "Load a skill's full instructions into the conversation. The skills this repository has are listed in a note from Coder's app. When the owner's task matches a skill's description, call this with its name before doing the task, then follow what it says. When the owner types /<skill-name>, the skill is already loaded for you.",
    parameters: { type: "object", properties: { skill: { type: "string", description: "The skill's name, as listed" }, args: { type: "string", description: "Optional arguments for the skill" } }, required: ["skill"] },
  },
});
