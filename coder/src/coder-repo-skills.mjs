// A NEW CHAT'S / MENU BEFORE ITS FIRST MESSAGE (2026-11-28; Claude Code lists a project's skills in its / menu as soon as the
// session starts: "Claude Code loads project skills from .claude/skills/ in the directory where you start it"). Coder's
// machine names the repository's skills only when a message runs, so a brand-new chat's / menu had none until then. The
// Worker now reads them from GitHub when the chat is made (the repository's .claude/skills/<name>/SKILL.md and
// .claude/commands/**.md, the same files the machine reads, coder-skills.mjs) and keeps them as the chat's first `skills`
// step, with the owner's saved and plugin skills, as the machine sends it. The machine's own list replaces it at the first
// message.
import { frontmatterOf } from "../container/coder-yaml.mjs";

export const REPO_SKILLS_FILES_MAX = 40;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const str = (v) => (v === null || v === undefined || typeof v === "object" ? "" : String(v).trim());
const off = (v) => /^(false|no|off|0)$/i.test(str(v));

/** The skill files of a repository's tree (GitHub's recursive tree entries): [{ path, name, command }]. */
export function skillFilesOf(tree) {
  const out = [];
  for (const x of Array.isArray(tree) ? tree : []) {
    if (!x || x.type !== "blob" || typeof x.path !== "string") continue;
    let m = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(x.path);
    if (m && !/^(synced|anthropic-skills.*)$/i.test(m[1])) { out.push({ path: x.path, name: m[1], command: false }); continue; }
    m = /^\.claude\/commands\/((?:[^/]+\/){0,5})([^/]+)\.md$/i.exec(x.path);
    if (m) { const parts = [...m[1].split("/").filter(Boolean), m[2]]; if (parts.every((p) => NAME_RE.test(p))) out.push({ path: x.path, name: parts.join(":"), command: true }); }
  }
  return out.slice(0, REPO_SKILLS_FILES_MAX);
}

/** One file's entry for the / menu ({ name, description, hint? }), or null when the owner can't run it (user-invocable: false). */
export function menuEntryOf(text, file) {
  const s = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const meta = frontmatterOf(s) || {};
  const head = /^---\n(?:[\s\S]*?\n)?---[ \t]*(?:\n|$)/.exec(s);
  const body = head ? s.slice(head[0].length) : s;
  if (off(meta["user-invocable"])) return null;
  const own = file.command ? "" : str(meta.name);
  const name = NAME_RE.test(own) ? own : file.name;
  const first = body.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) || "";
  const description = (str(meta.description) || first).replace(/\s+/g, " ").slice(0, 200);
  const hint = Array.isArray(meta["argument-hint"]) ? "[" + meta["argument-hint"].join(" ") + "]" : str(meta["argument-hint"]);
  return { name, description, ...(hint ? { hint: hint.slice(0, 100) } : {}) };
}

const b64Text = (b) => { try { const bin = atob(String(b || "").replace(/\s+/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); } catch { return ""; } };

/**
 * THE REPOSITORY'S SKILLS FOR THE / MENU: `ghFn(path)` → { ok, data } (GitHub's API as the owner). `extra`: the owner's saved
 * and plugin skills ({ name, description }). → the list for a `skills` step ([] when there are none or GitHub can't say).
 */
export async function repoSkillsMenu(ghFn, repo, ref, extra = []) {
  const out = [], seen = new Set();
  const add = (e) => { if (e && e.name && !seen.has(e.name.toLowerCase())) { seen.add(e.name.toLowerCase()); out.push(e); } };
  try {
    const tree = await ghFn("/repos/" + repo + "/git/trees/" + encodeURIComponent(ref) + "?recursive=1");
    const files = tree && tree.ok && tree.data ? skillFilesOf(tree.data.tree) : [];
    // (A skill's name wins over a command's, as on the machine.)
    files.sort((a, b) => Number(a.command) - Number(b.command));
    const texts = await Promise.all(files.map((f) => ghFn("/repos/" + repo + "/contents/" + f.path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(ref)).then((r) => (r && r.ok && r.data && typeof r.data.content === "string" ? b64Text(r.data.content) : null)).catch(() => null)));
    files.forEach((f, i) => { if (texts[i] !== null) add(menuEntryOf(texts[i], f)); });
  } catch { /* none from GitHub */ }
  for (const s of Array.isArray(extra) ? extra : []) if (s && typeof s.name === "string") add({ name: s.name, description: String(s.description || "").replace(/\s+/g, " ").slice(0, 200) });
  return out.slice(0, 100);
}
