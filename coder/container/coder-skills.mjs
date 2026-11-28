// THE REPOSITORY'S SKILLS, CLAUDE CODE'S WAY (the audit, 2026-11-20; Claude Code's skills docs and its cloud docs: "Your repo's
// `.claude/skills/`, `.claude/agents/`, `.claude/commands/` | Yes | Part of the clone"): a skill is a folder under
// .claude/skills with a SKILL.md (front matter, then its instructions); a file under .claude/commands is one too (its name the
// file's, a subfolder's path joined with ":"). Coder is told each skill's name and description, loads one's whole text with its
// skill tool (Claude Code's Skill) when the task matches, and the owner runs one by typing /name.
//
// SKILLS AND SUBAGENTS ROUND (2026-11-28; Claude Code's skills docs, read in full that day): the front matter is read as YAML
// (coder-yaml.mjs), so multi-line values and lists work; every field of the docs' table is read (when_to_use, argument-hint,
// arguments, allowed-tools, disallowed-tools, model, effort, context, agent, background, hooks, paths, shell); the listing caps
// description + when_to_use at 1,536 characters and shows < and > as &lt; and &gt;; the substitutions $ARGUMENTS, $ARGUMENTS[N],
// $N, $name, ${CLAUDE_SKILL_DIR}, ${CLAUDE_SESSION_ID}, ${CLAUDE_EFFORT} and ${CLAUDE_PROJECT_DIR}, with \$ escapes; dynamic
// context (!`cmd` and ```! blocks, run by coder-agent.mjs under the permission checks); nested .claude/skills folders, loaded
// when Coder first touches a file there, named dir:skill when their name clashes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { frontmatterOf, frontmatterHooks } from "./coder-yaml.mjs";
import { globAny } from "./coder-globs.mjs";

export const SKILLS_MAX = 100;
export const SKILL_TEXT_MAX = 20_000;
/** Claude Code: "the combined description and when_to_use text is truncated at 1,536 characters in the skill listing". */
export const SKILL_DESC_MAX = 1536;
/** Claude Code's substitution of a !`cmd` when skill shell execution is off. */
export const SHELL_OFF_TEXT = "[shell command execution disabled by policy]";
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

/** A SKILL.md's front matter and body: { meta, body }. Claude Code: YAML that doesn't parse leaves "no fields set". */
export function frontMatter(text) {
  const s = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---\n(?:[\s\S]*?\n)?---[ \t]*(?:\n|$)/.exec(s);
  if (!m) return { meta: {}, body: s };
  const meta = frontmatterOf(s) || {};
  return { meta, body: s.slice(m[0].length) };
}

/** Claude Code: "Boolean fields accept yes, no, on, off, 1, and 0 in any letter case, in addition to true and false". */
export function boolOf(v, dflt) {
  if (v === true || v === false) return v;
  if (v === 1 || v === 0) return v === 1;
  const t = String(v ?? "").trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(t)) return true;
  if (["false", "no", "off", "0"].includes(t)) return false;
  return dflt;
}

/** A list field: a YAML list, or a string split on commas and spaces outside parentheses (Bash(git add *) stays whole). */
export function listOf(v, { spaces = true } = {}) {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (v === null || v === undefined || typeof v === "object") return [];
  const s = String(v), out = [];
  let cur = "", depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "," || (spaces && /\s/.test(ch)))) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const str = (v) => (v === null || v === undefined || typeof v === "object" ? "" : String(v).trim());

/**
 * One skill from its file's text: { name, description, whenToUse, argHint, argNames, allowed, disallowed, modelName, effort,
 * fork, agent, background, paths, shell, body, dir, model, user, hooks?, asks? } or null. `command`: a .claude/commands file,
 * which takes every field "except name and paths".
 */
export function skillFrom(text, fallbackName, dir, { command = false } = {}) {
  const { meta, body } = frontMatter(text);
  const own = command ? "" : str(meta.name);
  const name = NAME_RE.test(own) ? own : fallbackName;
  if (!/^[A-Za-z0-9][\w./:-]{0,200}$/.test(String(name || ""))) return null;
  // (No description: Claude Code "uses the first non-empty line of the markdown content".)
  const first = body.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) || "";
  const description = (str(meta.description) || first).replace(/\s+/g, " ").trim().slice(0, SKILL_DESC_MAX);
  const whenToUse = str(meta.when_to_use).replace(/\s+/g, " ").slice(0, SKILL_DESC_MAX);
  const hint = Array.isArray(meta["argument-hint"]) ? "[" + meta["argument-hint"].join(" ") + "]" : str(meta["argument-hint"]);
  const effort = str(meta.effort).toLowerCase();
  const sk = {
    name, description, ...(whenToUse ? { whenToUse } : {}), ...(hint ? { argHint: hint.slice(0, 200) } : {}),
    argNames: listOf(meta.arguments).filter((n) => /^[A-Za-z_]\w*$/.test(n)).slice(0, 20),
    allowed: listOf(meta["allowed-tools"]).slice(0, 50), disallowed: listOf(meta["disallowed-tools"]).slice(0, 50),
    modelName: str(meta.model), effort: EFFORTS.includes(effort) ? effort : "",
    fork: str(meta.context).toLowerCase() === "fork", agent: str(meta.agent), background: boolOf(meta.background, true),
    paths: command ? [] : listOf(meta.paths, { spaces: false }).slice(0, 100), shell: str(meta.shell).toLowerCase() === "powershell" ? "powershell" : "bash",
    body: body.slice(0, SKILL_TEXT_MAX), dir, model: !boolOf(meta["disable-model-invocation"], false), user: boolOf(meta["user-invocable"], true),
  };
  const hooks = skillHooksField(text);
  if (hooks) sk.hooks = hooks;
  const asks = skillAsks(meta);
  if (asks) sk.asks = asks;
  return sk;
}

/** A skill's frontmatter hooks (Claude Code's "Hooks in skills and agents"; coder-fmhooks.mjs), or null. */
function skillHooksField(text) { try { return frontmatterHooks(text); } catch { return null; } }

const list = (d) => { try { return readdirSync(d).sort(); } catch { return []; } };
const textOf = (f) => { try { const st = statSync(f); return st.isFile() && st.size <= 256 * 1024 ? readFileSync(f, "utf8") : null; } catch { return null; } };
const isDir = (f) => { try { return statSync(f).isDirectory(); } catch { return false; } };

/** The skills in one `.claude` folder's skills/ (and commands/, unless `commands` is false). */
function skillsIn(claudeDir, { commands = true } = {}) {
  const out = [];
  const sk = join(claudeDir, "skills");
  for (const d of list(sk)) { if (/^(synced|anthropic-skills.*)$/i.test(d)) continue; const t = textOf(join(sk, d, "SKILL.md")); if (t !== null) { const s = skillFrom(t, d, join(sk, d)); if (s) out.push(s); } }
  if (!commands) return out;
  // (Claude Code: "File in a subdirectory of .claude/commands/: Subdirectory path relative to commands/ with each / replaced by
  // :, then the file name without extension".)
  const walk = (dir, prefix, depth) => {
    for (const f of list(dir)) {
      const full = join(dir, f);
      if (isDir(full)) { if (depth < 5 && !f.startsWith(".")) walk(full, prefix + f + ":", depth + 1); continue; }
      if (!/\.md$/i.test(f)) continue;
      const t = textOf(full);
      const base = f.replace(/\.md$/i, "");
      if (t === null || !NAME_RE.test(base) || prefix.split(":").some((p) => p && !NAME_RE.test(p))) continue;
      const s = skillFrom(t, prefix + base, dir, { command: true });
      if (s) { s.command = true; out.push(s); }
    }
  };
  walk(join(claudeDir, "commands"), "", 0);
  return out;
}

/** The skills of the project at `root`: .claude/skills/<name>/SKILL.md, then .claude/commands (a skill's name wins). */
export function readSkills(root) {
  const out = [], seen = new Set();
  for (const s of skillsIn(join(String(root || "/"), ".claude"))) {
    if (seen.has(s.name.toLowerCase()) || out.length >= SKILLS_MAX) continue;
    seen.add(s.name.toLowerCase()); out.push(s);
  }
  return out;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor", "target", "__pycache__", ".venv", "venv"]);
/**
 * THE FOLDERS BELOW `root` THAT HOLD A .claude/skills (Claude Code's nested skills: "Skills in a .claude/skills/ directory below
 * where you started don't load at startup. They load the first time Claude reads or edits a file in that subdirectory"). A
 * bounded walk: 8 levels, 4,000 folders; never into node_modules, .git, or .claude itself (its worktrees). → relative paths.
 */
export function nestedSkillRoots(root, { maxDirs = 4000, maxDepth = 8 } = {}) {
  const base = String(root || "");
  if (!base) return [];
  const out = [];
  let seen = 0;
  const walk = (rel, depth) => {
    if (seen++ > maxDirs || depth > maxDepth) return;
    for (const f of list(rel ? join(base, rel) : base)) {
      if (SKIP_DIRS.has(f) || f === ".claude" || (f.startsWith(".") && f !== ".github")) continue;
      const r = rel ? rel + "/" + f : f;
      if (!isDir(join(base, r))) continue;
      if (isDir(join(base, r, ".claude", "skills"))) out.push(r);
      walk(r, depth + 1);
    }
  };
  walk("", 0);
  return out.slice(0, 50);
}

/**
 * THE NESTED SKILLS A TOUCHED FILE BRINGS (`rel`: the file's path in the project): each folder of `roots` that holds the file
 * and isn't `loaded` yet. Claude Code: "When a nested skill's directory name matches another skill's name, both stay
 * available": the nested one is `<subdir>:<name>`, "Its description names the directory it applies to". → { skills, roots }.
 */
export function nestedSkillsFor(root, rel, roots, loaded, have) {
  const file = String(rel || "").replace(/^\.\//, "");
  const names = new Set((Array.isArray(have) ? have : []).map((s) => s && String(s.name).toLowerCase()));
  const skills = [], now = [];
  for (const r of Array.isArray(roots) ? roots : []) {
    if (loaded && loaded.has(r) || !(file === r || file.startsWith(r + "/"))) continue;
    now.push(r);
    if (loaded) loaded.add(r);
    for (const s of skillsIn(join(String(root), r, ".claude"), { commands: false })) {
      const clash = names.has(s.name.toLowerCase());
      const sk = clash ? { ...s, name: r + ":" + s.name, description: (s.description + " (for the files in " + r + "/)").slice(0, SKILL_DESC_MAX) } : s;
      if (names.has(sk.name.toLowerCase())) continue;
      names.add(sk.name.toLowerCase());
      skills.push({ ...sk, nested: r });
    }
  }
  return { skills, roots: now };
}

/** Whether a skill with `paths` is active for a touched file (Claude Code: "Glob patterns for the files that activate this skill"). */
export function pathsMatch(skill, rel) {
  if (!skill || !Array.isArray(skill.paths) || !skill.paths.length) return false;
  let p = String(rel || "").replace(/^\.\//, "");
  // (A nested skill's patterns are relative to its own folder.)
  if (skill.nested) { if (!p.startsWith(skill.nested + "/")) return false; p = p.slice(skill.nested.length + 1); }
  try { return globAny(skill.paths, p); } catch { return false; }
}

const esc = (t) => String(t).replace(/</g, "&lt;").replace(/>/g, "&gt;");
/**
 * What Coder is told of the skills it may load: Claude Code's listing, each skill's name and description (with when_to_use,
 * capped at 1,536 characters). A skill with `paths` is listed once a file it covers was touched (`active`).
 */
export function skillsListing(skills) {
  const mine = (Array.isArray(skills) ? skills : []).filter((s) => s && s.model && (!(Array.isArray(s.paths) && s.paths.length) || s.active));
  if (!mine.length) return "";
  const text = (s) => esc((s.description + (s.whenToUse ? " " + s.whenToUse : "")).slice(0, SKILL_DESC_MAX));
  const qualified = mine.some((s) => s.nested && s.name.includes(":"));
  return "The following skills are available for use with the skill tool:\n\n" + mine.map((s) => "- " + s.name + ": " + text(s)).join("\n")
    + (qualified ? "\n\nWhen skills share a name, invoke the one whose directory holds the files you're working on (dir:name)." : "");
}

/** Claude Code: "Indexed arguments use shell-style quoting, so wrap multi-word values in quotes to pass them as a single argument". */
export function splitArgs(a) {
  const out = [];
  let cur = "", q = "", any = false;
  for (let i = 0; i < a.length; i++) {
    const ch = a[i];
    if (q) { if (ch === q) q = ""; else if (ch === "\\" && q === '"' && i + 1 < a.length) cur += a[++i]; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; any = true; continue; }
    if (ch === "\\" && i + 1 < a.length) { cur += a[++i]; any = true; continue; }
    if (/\s/.test(ch)) { if (cur || any) out.push(cur); cur = ""; any = false; continue; }
    cur += ch;
  }
  if (cur || any) out.push(cur);
  return out;
}

/**
 * CLAUDE CODE'S SUBSTITUTIONS IN ONE PIECE OF A SKILL'S TEXT. `state.got` turns true when a placeholder received the arguments
 * (an indexed one with no argument stays as it is and doesn't count; a named one always does). A single backslash before an
 * argument token escapes it; "\\$1" keeps both backslashes and still expands. Values are inserted as literal text.
 */
function substitute(text, args, argv, names, state) {
  return String(text).replace(/(\\*)\$(ARGUMENTS\[(\d+)\]|ARGUMENTS|(\d+)|([A-Za-z_]\w*))/g, (all, bs, tok, idxA, idxN, nm) => {
    let val;
    if (tok === "ARGUMENTS") val = args;
    else if (idxA !== undefined || idxN !== undefined) { const n = Number(idxA ?? idxN); val = n < argv.length ? argv[n] : undefined; if (val === undefined) return bs.length === 1 ? "$" + tok : all; }
    else if (nm && names.includes(nm)) { const n = names.indexOf(nm); val = n < argv.length ? argv[n] : ""; }
    else return all;
    if (bs.length === 1) return "$" + tok;
    state.got = true;
    return bs + val;
  });
}
/** ${CLAUDE_SKILL_DIR}, ${CLAUDE_SESSION_ID}, ${CLAUDE_EFFORT} and ${CLAUDE_PROJECT_DIR} (not touched by a backslash). */
export function claudeVars(text, vars = {}) {
  const v = { CLAUDE_SKILL_DIR: vars.skillDir, CLAUDE_SESSION_ID: vars.sessionId, CLAUDE_EFFORT: vars.effort, CLAUDE_PROJECT_DIR: vars.projectDir };
  return String(text).replace(/\$\{(CLAUDE_SKILL_DIR|CLAUDE_SESSION_ID|CLAUDE_EFFORT|CLAUDE_PROJECT_DIR)\}/g, (all, k) => (v[k] === undefined || v[k] === null ? all : String(v[k])));
}

/**
 * A SKILL'S BODY IN PIECES: plain text, and its dynamic-context commands (Claude Code: "The inline form is only recognized when
 * ! appears at the start of a line or immediately after whitespace"; "For multi-line commands, use a fenced code block opened
 * with ```!"). Found in the original file once, so a value inserted later can't add a command.
 */
export function bodyPieces(body) {
  const out = [];
  const s = String(body || "");
  const fence = /^```![ \t]*\n([\s\S]*?)\n```[ \t]*$/gm;
  let at = 0, m;
  const inline = (t) => {
    const re = /(^|[ \t\n])!`([^`\n]+)`/g;
    let k = 0, x;
    while ((x = re.exec(t))) {
      const start = x.index + x[1].length;
      out.push({ text: t.slice(k, start) });
      out.push({ cmd: x[2], raw: "!`" + x[2] + "`" });
      k = start + x[0].length - x[1].length;
    }
    out.push({ text: t.slice(k) });
  };
  while ((m = fence.exec(s))) { inline(s.slice(at, m.index)); out.push({ cmd: m[1], raw: m[0], block: true }); at = m.index + m[0].length; }
  inline(s.slice(at));
  return out.filter((p) => p.cmd !== undefined || p.text);
}
/** Whether a skill's body has dynamic-context commands. */
export const hasShell = (skill) => bodyPieces(skill && skill.body).some((p) => p.cmd !== undefined);

const head = (skill) => "Base directory for this skill: " + skill.dir + "\n\n";
function prepared(skill, args, vars) {
  const a = String(args || "").trim();
  const argv = splitArgs(a);
  const names = Array.isArray(skill.argNames) ? skill.argNames : [];
  const state = { got: false };
  const v = { skillDir: skill.dir, ...vars };
  const pieces = bodyPieces(skill.body).map((p) => (p.cmd !== undefined ? { ...p, cmd: claudeVars(substitute(p.cmd, a, argv, names, state), v) } : { text: claudeVars(substitute(p.text, a, argv, names, state), v) }));
  return { pieces, tail: a && !state.got ? "\n\nARGUMENTS: " + a : "" };
}

/** A skill's whole text as it is loaded, with its arguments and variables (its !`cmd` commands left as they are). */
export function skillLoaded(skill, args = "", vars = {}) {
  const { pieces, tail } = prepared(skill, args, vars);
  return head(skill) + (pieces.map((p) => (p.cmd !== undefined ? p.raw : p.text)).join("") + tail).trim();
}

/**
 * A SKILL'S TEXT WITH ITS DYNAMIC CONTEXT RUN (Claude Code's "Inject dynamic context"): each command through `run(cmd)` →
 * { output } | { error } (the caller checks its permission and runs it as Claude's Bash does), or SHELL_OFF_TEXT when `off`
 * (disableSkillShellExecution). A failed command aborts the whole invocation. → { text } | { error }.
 */
export async function renderSkill(skill, args = "", { vars = {}, run = null, off = false } = {}) {
  const { pieces, tail } = prepared(skill, args, vars);
  let out = "";
  for (const p of pieces) {
    if (p.cmd === undefined) { out += p.text; continue; }
    if (off || typeof run !== "function") { out += off ? SHELL_OFF_TEXT : p.raw; continue; }
    let r;
    try { r = await run(p.cmd, p); } catch (e) { r = { error: "Shell command failed for pattern \"" + p.raw + "\": " + String((e && e.message) || e) }; }
    if (!r || r.error !== undefined) return { error: String((r && r.error) || "Shell command failed for pattern \"" + p.raw + "\"") };
    out += String(r.output ?? "").replace(/\n+$/, "");
  }
  return { text: head(skill) + (out + tail).trim() };
}

/** Claude Code's carveout: exit code 1 from search and comparison commands is a normal result. */
export function exitOk(cmd, code) {
  if (code === 0) return true;
  if (code !== 1) return false;
  const first = String(cmd || "").trim().split(/\s*(?:\|\||&&|;|\|)\s*/).pop().trim();
  return /^(?:grep|egrep|fgrep|rg|ag|diff|cmp|comm|test|\[|find|git\s+(?:diff|grep))\b/.test(first);
}

/** The owner's "/name args" when name is a skill they may run: { skill, args } or null. */
export function slashSkill(text, skills) {
  const m = /^\/([A-Za-z0-9][\w./-]{0,200}(?::[A-Za-z0-9][\w-]{0,63})*)(?:\s+([\s\S]*))?$/.exec(String(text || "").trim());
  if (!m) return null;
  const skill = (Array.isArray(skills) ? skills : []).find((s) => s && s.user && s.name.toLowerCase() === m[1].toLowerCase());
  return skill ? { skill, args: String(m[2] || "").trim() } : null;
}

/**
 * WHAT MAKES USING A SKILL ASK: its frontmatter hooks (Claude Code's tools reference, Skill: a skill that sets hooks "can bring
 * a permission prompt"). Not allowed-tools (Claude Code: it pre-approves tools for the turn, "even in a -p run in a folder
 * you've never trusted") and not disallowed-tools (it only narrows). 2026-11-28.
 */
export function skillAsks(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  return Object.prototype.hasOwnProperty.call(m, "hooks") ? "hooks" : "";
}

/** A skill's allowed-tools as permission rules for its turn, ${CLAUDE_SKILL_DIR} and ${CLAUDE_PROJECT_DIR} filled in. */
export function skillGrant(skill, vars = {}) {
  return (Array.isArray(skill && skill.allowed) ? skill.allowed : []).map((r) => claudeVars(r, { skillDir: skill.dir, ...vars }));
}
/** A skill's disallowed-tools as whole tools (an entry with a specifier still removes the whole tool), never EndConversation. */
export function skillDenied(skill) {
  return [...new Set((Array.isArray(skill && skill.disallowed) ? skill.disallowed : []).map((r) => String(r).replace(/\(.*\)$/, "").trim()).filter((r) => r && r !== "EndConversation"))];
}

/** Claude Code's Skill(name) rules: the rule of `kind` that names this skill (bare Skill is the whole tool's), or "". */
export function skillRule(rules, kind, name, parse) {
  // (Claude Code: a deny rule naming an unqualified name also blocks "A nested skill listed as apps/web:deploy".)
  const bare = kind === "deny" && String(name).includes(":") ? String(name).replace(/^.*:/, "") : "";
  for (const r of Array.isArray(rules && rules[kind]) ? rules[kind] : []) {
    const x = parse(r);
    if (!x || x.tool !== "Skill" || x.spec === null) continue;
    const spec = x.spec.replace(/:\*$/, "*").replace(/^skill:/, "");
    for (const n of bare ? [name, bare] : [name]) if (spec === n || (spec.endsWith("*") && n.startsWith(spec.slice(0, -1).trimEnd()))) return r;
  }
  return "";
}

/** The skill tool's definition, as Grok is given it. */
export const SKILL_TOOL = Object.freeze({
  type: "function",
  function: {
    name: "skill",
    description: "Load a skill's full instructions into the conversation. The skills this repository has are listed in a note from Coder's app. When the owner's task matches a skill's description, call this with its name before doing the task, then follow what it says. When the owner types /<skill-name>, the skill is already loaded for you. A skill whose frontmatter sets context: fork runs in a subagent instead, and its result comes back to you.",
    parameters: { type: "object", properties: { skill: { type: "string", description: "The skill's name, as listed" }, args: { type: "string", description: "Optional arguments for the skill" } }, required: ["skill"] },
  },
});
