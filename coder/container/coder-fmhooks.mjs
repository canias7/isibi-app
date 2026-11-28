// HOOKS IN SKILL AND AGENT FRONTMATTER, AND THE HOOK PIECES AROUND THEM (the hooks round of 2026-11-27, part 2: "Finish matching
// Coder's hooks to Claude Code"). Claude Code's hooks reference, "Hooks in skills and agents": "hooks can be defined directly
// in skills and subagents using frontmatter, in the same configuration format as settings-based hooks":
// - Skill hooks "don't run before you or Claude invoke the skill. They're removed when you exit or leave the conversation
//   with a command such as /clear"; `once`: "removes the hook after its first successful run. A run that fails, blocks with
//   exit code 2, or times out leaves the hook in place … Only honored for hooks declared in skill frontmatter".
// - Subagent hooks: "runs them only while that subagent is running and removes them when it finishes. Claude Code converts a
//   Stop hook here to SubagentStop". "Frontmatter hooks in a project subagent run only after you accept the workspace trust
//   dialog for the folder the agent file came from" (Coder's "Trust this repository's settings").
// - "Each source of skills … can register at most 1,024 hooks. Those hooks' matchers can total at most 16,384 characters."
// - The ask prompt's label: "[settings] for a hook from any settings file or from agent frontmatter, [plugin:<name>] for a
//   plugin's hook, or [skill] for a hook from skill frontmatter".
// - PermissionRequest's permission_suggestions: addRules for "don't ask again", setMode for a card's mode options.
// Pure functions; coder-agent.mjs and coder-agents.mjs use them. No node: imports.
import { hooksFrom } from "./coder-hooks.mjs";
import { yamlParse, frontmatterOf, frontmatterHooks } from "./coder-yaml.mjs";
export { yamlParse, frontmatterOf, frontmatterHooks };

export const SKILL_SOURCE_HOOKS_MAX = 1024, SKILL_SOURCE_MATCHER_MAX = 16_384;

/**
 * A SKILL'S FRONTMATTER HOOKS, ready to register when the skill is invoked: each marked with its skill (source "skill"),
 * `once` kept. `{ list, problems }`.
 */
export function skillHooksOf(skill) {
  if (!skill || !skill.hooks) return { list: [], problems: [] };
  const r = hooksFrom({ hooks: skill.hooks }, "skill");
  return { list: r.list.map((h) => ({ ...h, skill: String(skill.name || "").slice(0, 64) })), problems: r.problems };
}

/**
 * SKILL HOOKS REGISTERED SO FAR, plus one more skill's (Claude Code's limits per source of skills: 1,024 hooks and 16,384
 * matcher characters; a skill past them "registers none of its hooks"). A skill already registered is not added twice.
 * `source`: the skill's source ("project", "personal" or a plugin's name). → { list, added, refused }.
 */
export function registerSkillHooks(registered, skill, source = "project") {
  const now = Array.isArray(registered) ? registered : [];
  const name = String((skill && skill.name) || "");
  if (!name || now.some((h) => h && h.skill === name)) return { list: now, added: 0, refused: "" };
  const mine = skillHooksOf(skill).list.map((h) => ({ ...h, skillSource: source }));
  if (!mine.length) return { list: now, added: 0, refused: "" };
  const same = now.filter((h) => h && (h.skillSource || "project") === source);
  const count = same.length + mine.length;
  const chars = [...same, ...mine].reduce((n, h) => n + String(h.matcher || "").length, 0);
  if (count > SKILL_SOURCE_HOOKS_MAX || chars > SKILL_SOURCE_MATCHER_MAX) return { list: now, added: 0, refused: "Skill " + name + " registers none of its hooks: its source would pass " + (count > SKILL_SOURCE_HOOKS_MAX ? SKILL_SOURCE_HOOKS_MAX + " hooks" : SKILL_SOURCE_MATCHER_MAX + " matcher characters") + "." };
  return { list: [...now, ...mine], added: mine.length, refused: "" };
}

/** Whether a `once` hook's run counts as its first successful one (not a failure, an exit-2 block or a timeout). */
export const onceSucceeded = (run, result) => !!(result && result.kind === "ok" && !(run && run.timedOut));

/** The hooks left after a `once` hook ran successfully: that one removed (by identity), the rest kept. */
export const withoutHook = (list, hook) => (Array.isArray(list) ? list.filter((h) => h !== hook && !(h && hook && h.once && h.skill === hook.skill && h.event === hook.event && h.matcher === hook.matcher && h.command === hook.command && h.prompt === hook.prompt && h.url === hook.url)) : []);

/**
 * A SUBAGENT'S FRONTMATTER HOOKS (`def.hooks`, Claude Code's settings shape): `own` run inside the subagent's loop while it
 * runs; `stop` its Stop hooks turned into SubagentStop (and its own SubagentStop ones), run when it finishes. Not for a
 * project agent before the owner trusts the repository (`trusted`), and never for a plugin's agent ("Ignored for plugin
 * agents: hooks"). `once` is not honored here.
 */
export function agentHooksOf(def, { trusted = false } = {}) {
  const none = { own: [], stop: [], held: false };
  if (!def || !def.hooks || def.plugin) return none;
  if (!trusted) return { ...none, held: true };
  const r = hooksFrom({ hooks: def.hooks }, "agent");
  const tag = (h) => ({ ...h, agent: String(def.name || "").slice(0, 64) });
  const own = [], stop = [];
  for (const h of r.list) {
    if (h.event === "Stop") stop.push(tag({ ...h, event: "SubagentStop" }));
    else if (h.event === "SubagentStop") stop.push(tag(h));
    else own.push(tag(h));
  }
  return { own, stop, held: false };
}

/** The label of the hook an ask came from, for its card: [settings] (any settings file, agent frontmatter), [plugin:<name>], [skill]. */
export function hookSourceLabel(h) {
  if (!h) return "";
  if (h.source === "plugin" || h.plugin) return "[plugin:" + String(h.plugin || "unknown") + "]";
  if (h.source === "skill" || h.skill) return "[skill]";
  return "[settings]";
}

/**
 * A CARD'S permission_suggestions FOR ITS PERMISSIONREQUEST HOOKS, matching the options the card shows (the page's
 * permOptions): addRules for "Yes, and don't ask again for …" (not when the card offers only a one-time Yes); setMode
 * "auto" for "Yes, and switch to auto mode"; setMode "acceptEdits" for "Yes, allow all edits during this session"; a
 * plan's "Yes, and use auto mode" and "Yes, auto-accept edits". `ruleEntry` turns a rule into Claude Code's entry.
 */
export function permissionSuggestions(card, { autoOff = false, ruleEntry = null } = {}) {
  const c = card && typeof card === "object" ? card : {};
  const mode = (m) => ({ type: "setMode", mode: m, destination: "session" });
  if (c.tool === "plan") return c.withheld ? [] : [...(autoOff ? [] : [mode("auto")]), mode("acceptEdits")];
  const partial = Number(c.more) > 0 || !!(c.change && (Number(c.change.more) > 0 || c.change.cut === true)) || c.secret === true || (Array.isArray(c.lines) && c.lines.some((l) => String(l).includes("[hidden]")));
  if (partial) return [];
  const out = [];
  if (Array.isArray(c.rules) && c.rules.length && typeof ruleEntry === "function") for (const r of c.rules) { const e = ruleEntry(r); if (e) out.push({ type: "addRules", rules: [e], behavior: "allow", destination: "localSettings" }); }
  if (c.toAuto && !autoOff) out.push(mode("auto"));
  if (c.toEdits) out.push(mode("acceptEdits"));
  return out;
}

/** The Notification hook inputs for what a connector's sign-in did since the chat's last message (the Worker's hookFacts.auth). */
export function authNotifications(list) {
  const out = [];
  for (const a of Array.isArray(list) ? list.slice(0, 10) : []) {
    if (!a || (a.type !== "auth_success" && a.type !== "auth_storage_failure")) continue;
    const name = String(a.connector || "a connector").slice(0, 80);
    out.push({ notification_type: a.type, message: a.type === "auth_success" ? "Signed in to " + name : "Signed in to " + name + ", but the sign-in could not be saved", title: a.type === "auth_success" ? "Sign-in finished" : "Sign-in not saved" });
  }
  return out;
}

/** How long after a job ends with nobody writing the idle_prompt notification fires (Claude Code: "about 60 seconds"). */
export const IDLE_PROMPT_MS = 60_000;
/** How long an MCP form or link waits unanswered before its notification (Claude Code: "about six seconds"). */
export const ELICIT_NOTIFY_MS = 6_000;
