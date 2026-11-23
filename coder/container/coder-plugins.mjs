/**
 * CLAUDE CODE'S PLUGIN, SKILL AND ONBOARDING TOOLS, IN CODER'S CHATS (the owner, 2026-11-23: "every Claude Code tool, none
 * skipped"; Claude Code's tools reference and its plugins, skills and cloud docs):
 *   list_plugins            ListPlugins             the owner's installed plugins (held back)
 *   search_plugins          SearchPlugins           the plugin catalog and the installed plugins
 *   suggest_plugin_install  SuggestPluginInstall    a card of suggested plugins with Install and Not now; Coder carries on
 *                                                   ("You don't have to respond, and Claude carries on with the task either way")
 *   list_skills             ListSkills              the repository's skills, the owner's saved ones and their plugins' (held back)
 *   search_skills           SearchSkills            the same, and the skills that can be added, searched (held back)
 *   suggest_skills          SuggestSkills           a card of skills to add (Add, Not now)
 *   propose_skills          propose_skills          a card of skills Coder wrote, for the owner to review and save (held back)
 *   share_onboarding_guide  ShareOnboardingGuide    ONBOARDING.md as a share link, after the owner's Yes (held back)
 *   show_onboarding_role_picker ShowOnboardingRolePicker  the role chips; waits for the pick, and installs its plugin
 * The owner's plugins, saved skills and shared guides are kept by Coder's Worker (src/coder-plugins.mjs), asked through the
 * environment API (deps.envApi), as pr_read is. The cards are drawn by public/coder.js; Install, Add and Save there go to the
 * Worker's own routes.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CC_TOOL } from "./coder-hooks.mjs";

import { PLUGIN_TOOL_NAMES, PLUGIN_DEFERRED, PLUGIN_CC_NAMES, PLUGIN_HINTS } from "./coder-plugin-names.mjs";
export { PLUGIN_TOOL_NAMES, PLUGIN_DEFERRED, PLUGIN_CC_NAMES, PLUGIN_HINTS };
Object.assign(CC_TOOL, PLUGIN_CC_NAMES);
/** The roles the picker shows ("the role list is defined by the client"); the Worker's ROLES map each to its plugin. */
export const ROLE_OPTIONS = Object.freeze([
  { id: "frontend", label: "Frontend", description: "Web pages and apps people use", plugin: "frontend" },
  { id: "backend", label: "Backend", description: "Servers, APIs and databases", plugin: "database" },
  { id: "fullstack", label: "Full-stack", description: "A bit of everything", plugin: "code-review" },
  { id: "devops", label: "DevOps", description: "Deploys, monitoring and incidents", plugin: "monitoring" },
]);
export const GUIDE_FILES = Object.freeze(["ONBOARDING.md", "docs/ONBOARDING.md", ".claude/ONBOARDING.md"]);
export const GUIDE_MAX = 100_000;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const fn = (name, description, properties, required) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const PLUGIN_WORDS = "A plugin bundles skills, commands, agents, hooks and connectors, installed or removed as one unit; it stays installed for all the owner's chats.";
export const PLUGIN_TOOLS = Object.freeze([
  fn("search_plugins", "Search the plugin catalog and the owner's installed plugins. " + PLUGIN_WORDS + " Use it when the owner's task could use a plugin or they ask about plugins; then offer one with suggest_plugin_install. Returns each plugin's name, description, what it contains and whether it is installed.", { query: { type: "string", description: "What to look for (e.g. \"database\", \"review\", \"sentry\")" } }, ["query"]),
  fn("suggest_plugin_install", "Show the owner a card of suggested plugins from the catalog, each with Install, and Not now. " + PLUGIN_WORDS + " You may suggest plugins without being asked when one fits the task. The owner does not have to answer: carry on with the task either way. Find names with search_plugins first.", { plugins: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" }, description: "The catalog names of 1 to 3 plugins" }, reason: { type: "string", description: "One sentence: why these help with the owner's task" } }, ["plugins"]),
  fn("suggest_skills", "Show the owner a card of skills they can add (Add, Not now). A skill is saved instructions you load with the skill tool when a task matches. Use it when one of the skills that can be added (search_skills lists them) fits the task. The owner does not have to answer: carry on either way.", { skills: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" }, description: "Names of 1 to 4 skills that can be added" }, reason: { type: "string", description: "One sentence: why" } }, ["skills"]),
  fn("show_onboarding_role_picker", "Show a row of role chips so the owner can pick their role (or type one) and get a matching plugin installed. Use it when onboarding the owner to Coder, or when they ask to set Coder up for their kind of work. Takes no arguments; waits until the owner picks or closes it. Returns { role } or { dismissed: true }.", {}, []),
  fn("list_plugins", "List the plugins the owner has installed in Coder (not the catalog: use search_plugins for that), with what each contains.", {}, []),
  fn("list_skills", "List every skill you can load with the skill tool: the repository's (.claude/skills and .claude/commands), the owner's saved skills, and the skills of their installed plugins (named plugin:skill).", {}, []),
  fn("search_skills", "Search the skills you can load and the skills the owner can add (offer one of those with suggest_skills).", { query: { type: "string", description: "What to look for" } }, ["query"]),
  fn("propose_skills", "Show the owner a card of new skills you wrote, for them to review and save to their skills (each with Save). Use it when you notice instructions worth keeping for later chats (a workflow the owner repeats, a checklist they gave you). Each skill: a short name (letters, digits, - and _), a one-line description of when to use it, and its full instructions.", { skills: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, instructions: { type: "string" } }, required: ["name", "description", "instructions"] } } }, ["skills"]),
  fn("share_onboarding_guide", "Upload the repository's ONBOARDING.md (at its root, docs/ or .claude/) and return a share link teammates can open on gofarther.dev. Call it after the guide is written and saved. The owner is asked first.", {}, []),
]);

/** The guide file in the repository at `root`: { path, text } or { error }. */
export function readGuide(root) {
  for (const rel of GUIDE_FILES) {
    const f = join(String(root || "/"), rel);
    try {
      const st = statSync(f);
      if (!st.isFile()) continue;
      if (st.size > GUIDE_MAX * 4) return { error: "error: " + rel + " is too big to share (over " + GUIDE_MAX + " characters)" };
      const text = readFileSync(f, "utf8");
      if (text.length > GUIDE_MAX) return { error: "error: " + rel + " is too big to share (over " + GUIDE_MAX + " characters)" };
      if (!text.trim()) return { error: "error: " + rel + " is empty" };
      return { path: rel, text };
    } catch { /* next */ }
  }
  return { error: "error: there is no ONBOARDING.md in the repository (looked at " + GUIDE_FILES.join(", ") + "). Write it first, then call share_onboarding_guide." };
}

/**
 * The repository's skills (coder-skills.mjs readSkills), then the owner's saved skills and their plugins' skills, which the
 * Worker sends with the turn (`ownerSkills`), as skills the skill tool can load. A repository skill's name wins.
 */
export function withOwnerSkills(repo, owner) {
  const out = Array.isArray(repo) ? repo.slice() : [];
  const seen = new Set(out.map((s) => String(s.name).toLowerCase()));
  for (const s of Array.isArray(owner) ? owner.slice(0, 100) : []) {
    if (!s || typeof s.name !== "string" || typeof s.body !== "string" || !/^[a-z0-9][\w:-]{0,128}$/i.test(s.name) || seen.has(s.name.toLowerCase())) continue;
    seen.add(s.name.toLowerCase());
    out.push({ name: s.name, description: String(s.description || "").replace(/\s+/g, " ").slice(0, 250), body: s.body.slice(0, 20_000), dir: "(" + String(s.source || "saved").slice(0, 80) + ": no folder)", model: true, user: true, source: String(s.source || "saved").slice(0, 80) });
  }
  return out.slice(0, 100);
}

const line = (p) => "- " + p.name + (p.installed ? " (installed)" : "") + ": " + p.description + " Contains: " + p.contents + ".";
const skillLine = (s) => "- " + s.name + " [" + (s.source || "repository") + "]: " + s.description;

/**
 * ONE CALL OF THESE TOOLS. ctx: { args, id, deps, emit, reply, scrub, askQuestions(event), askOwner(card), answerOutcome(a),
 * canAsk(), skills (the chat's skill list), root }. Returns "stop" or "no" when the owner's answer ends the turn, else "".
 */
export async function pluginTool(name, ctx) {
  const { args = {}, id, deps, emit, reply } = ctx;
  const scrub = ctx.scrub || ((s) => s);
  const api = async (body) => {
    if (!deps || typeof deps.envApi !== "function") return { error: "error: Coder's server could not be reached" };
    try { return (await deps.envApi(body)) || { error: "error: Coder's server did not answer" }; } catch { return { error: "error: Coder's server could not be reached" }; }
  };
  const step = (verb, command) => emit({ type: "bash", id, tool: name, verb, command: scrub(String(command)).slice(0, 120) });
  const done = (text, ok = true) => { emit({ type: "result", id, code: ok ? 0 : 1, output: String(text).slice(0, 2000) }); reply(text); return ""; };
  const repoSkills = () => (Array.isArray(ctx.skills) ? ctx.skills : []).map((s) => ({ name: s.name, description: s.description, source: s.source || "repository" }));

  if (name === "list_plugins") {
    step("List", "installed plugins");
    const r = await api({ action: "plugins_list" });
    if (!Array.isArray(r.plugins)) return done(r.error || "error: Coder's server did not answer", false);
    return done(r.plugins.length ? "The owner's installed plugins:\n" + r.plugins.map(line).join("\n") : "The owner has no plugins installed. search_plugins finds plugins in the catalog.");
  }
  if (name === "search_plugins") {
    const q = String(args.query || "").slice(0, 200);
    step("Search", "plugins for " + JSON.stringify(q));
    const r = await api({ action: "plugins_search", query: q });
    if (!Array.isArray(r.plugins)) return done(r.error || "error: Coder's server did not answer", false);
    return done(r.plugins.length ? "Plugins matching " + JSON.stringify(q) + ":\n" + r.plugins.map(line).join("\n") + "\n\nOffer one that fits with suggest_plugin_install." : "No plugin matches " + JSON.stringify(q) + ".");
  }
  if (name === "suggest_plugin_install") {
    const want = (Array.isArray(args.plugins) ? args.plugins : [args.plugins]).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean).slice(0, 3);
    if (!want.length) return done("error: name 1 to 3 plugins from search_plugins", false);
    const r = await api({ action: "plugins_search", query: "" });
    if (!Array.isArray(r.plugins)) return done(r.error || "error: Coder's server did not answer", false);
    const found = want.map((n) => r.plugins.find((p) => p.name === n)).filter(Boolean);
    const missing = want.filter((n) => !found.some((p) => p.name === n));
    if (!found.length) return done("error: no plugin in the catalog is called " + missing.join(", ") + ". Find names with search_plugins.", false);
    emit({ type: "plugins_suggest", id, reason: scrub(String(args.reason || "")).slice(0, 300), plugins: found.map((p) => ({ name: p.name, description: p.description, contents: p.contents, installed: !!p.installed })) });
    return done("ok: the owner now sees a card suggesting " + found.map((p) => p.name).join(", ") + " (Install, Not now)." + (missing.length ? " Not in the catalog, left out: " + missing.join(", ") + "." : "") + " Carry on with the task; an installed plugin's skills are ready from the owner's next message.");
  }
  if (name === "list_skills") {
    step("List", "skills");
    const all = repoSkills();
    return done(all.length ? "Skills you can load with the skill tool:\n" + all.map(skillLine).join("\n") : "There are no skills yet: none in the repository (.claude/skills), none saved by the owner, and none from plugins. search_skills finds skills the owner can add.");
  }
  if (name === "search_skills") {
    const q = String(args.query || "").slice(0, 200);
    step("Search", "skills for " + JSON.stringify(q));
    const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    const hit = (s) => !words.length || words.some((w) => (s.name + " " + s.description).toLowerCase().includes(w));
    const mine = repoSkills().filter(hit);
    const r = await api({ action: "skills_catalog" });
    const add = Array.isArray(r.skills) ? r.skills.filter((s) => !s.saved && hit(s)) : [];
    return done((mine.length ? "Skills you can load now:\n" + mine.map(skillLine).join("\n") : "No skill you can load matches " + JSON.stringify(q) + ".") + (add.length ? "\n\nSkills the owner can add (offer with suggest_skills):\n" + add.map((s) => "- " + s.name + ": " + s.description).join("\n") : ""));
  }
  if (name === "suggest_skills") {
    const want = (Array.isArray(args.skills) ? args.skills : [args.skills]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4);
    const r = await api({ action: "skills_catalog" });
    if (!Array.isArray(r.skills)) return done(r.error || "error: Coder's server did not answer", false);
    const found = want.map((n) => r.skills.find((s) => s.name === n)).filter(Boolean);
    if (!found.length) return done("error: none of those can be added. search_skills lists the skills the owner can add.", false);
    emit({ type: "skills_suggest", id, reason: scrub(String(args.reason || "")).slice(0, 300), skills: found.map((s) => ({ name: s.name, description: s.description, saved: !!s.saved })) });
    return done("ok: the owner now sees a card suggesting the skill" + (found.length > 1 ? "s " : " ") + found.map((s) => s.name).join(", ") + " (Add, Not now). Carry on with the task.");
  }
  if (name === "propose_skills") {
    const list = (Array.isArray(args.skills) ? args.skills : []).slice(0, 4).map((s) => ({ name: String((s && s.name) || "").trim(), description: String((s && s.description) || "").replace(/\s+/g, " ").trim().slice(0, 250), body: String((s && (s.instructions ?? s.body)) || "").slice(0, 20_000) }));
    const bad = list.filter((s) => !NAME_RE.test(s.name) || !s.body.trim());
    if (!list.length || bad.length) return done("error: each skill needs a name (letters, digits, - and _, at most 64 characters), a description and its instructions" + (bad.length ? " (not right: " + bad.map((s) => JSON.stringify(s.name.slice(0, 64))).join(", ") + ")" : ""), false);
    emit({ type: "skills_propose", id, skills: list.map((s) => ({ name: s.name, description: scrub(s.description), body: scrub(s.body) })) });
    return done("ok: the owner now sees a card proposing " + list.map((s) => s.name).join(", ") + "; each one they save is a skill in their later chats. Carry on.");
  }
  if (name === "share_onboarding_guide") {
    const g = readGuide(ctx.root);
    step("Share", g.path || "ONBOARDING.md");
    if (g.error) return done(g.error, false);
    // (Claude Code's ShareOnboardingGuide needs permission: the owner's Yes on a card first.)
    const card = { tool: "share_onboarding_guide", id, what: "Share " + g.path + " as a link anyone signed in to Coder can open", why: "Coder wants to upload " + g.path + " (" + g.text.length + " characters) and make a share link.", told: "Permission to use ShareOnboardingGuide was not given." };
    const a = typeof ctx.askOwner === "function" && (typeof ctx.canAsk !== "function" || ctx.canAsk()) ? await ctx.askOwner(card) : null;
    if (!a) return done(card.told, false);
    const o = ctx.answerOutcome(a);
    if (o === "stop") return "stop";
    if (o === "said") return done("The owner said no to sharing: " + String(a.comment || ""), false);
    if (o === "no" || o === "time") { emit({ type: "result", id, code: -1, ran: false, output: "Not shared: you said no." }); reply("The owner said no: the guide was not shared."); return "no"; }
    const r = await api({ action: "guide_share", name: g.path.split("/").pop(), text: g.text });
    if (!r.url) return done(r.error || "error: the guide could not be shared", false);
    emit({ type: "guide_shared", id, url: r.url, name: g.path });
    return done("Shared " + g.path + ": " + r.url + "\nGive the owner this link; teammates open it on gofarther.dev.");
  }
  if (name === "show_onboarding_role_picker") {
    if (typeof ctx.canAsk === "function" && !ctx.canAsk()) return done(JSON.stringify({ dismissed: true }) + "\n(No one can answer here.)");
    const a = await ctx.askQuestions({ kind: "role_picker", questions: [{ question: "What kind of work do you do?", header: "Your role", options: ROLE_OPTIONS.map((r) => ({ label: r.label, description: r.description })), multiSelect: false }] });
    if (a.choice === "stop") return "stop";
    const p = a.choice === "answers" && Array.isArray(a.picks) && a.picks[0] ? a.picks[0] : null;
    const picked = p && Array.isArray(p.options) && p.options.length ? ROLE_OPTIONS[p.options[0]] : null;
    const typed = p && !picked && typeof p.other === "string" ? p.other.trim().slice(0, 100) : "";
    if (!picked && !typed) return done(JSON.stringify(a.choice === "chat" ? { dismissed: true, said: String(a.text || "").slice(0, 2000) } : { dismissed: true }));
    if (!picked) return done(JSON.stringify({ role: typed }) + "\nNo plugin matches that role by name; search_plugins can find one.");
    const ins = await api({ action: "plugins_install", name: picked.plugin });
    if (ins.ok) emit({ type: "note", text: "Installed the " + picked.plugin + " plugin for your role (" + picked.label + ")." });
    return done(JSON.stringify({ role: picked.label, ...(ins.ok ? { installed: picked.plugin } : {}) }) + (ins.ok ? "\nThe " + picked.plugin + " plugin is installed: " + ins.plugin.contents + "." + (ins.added && ins.added.length ? " Its connectors (" + ins.added.join(", ") + ") are in the owner's Connectors, to sign in with Connect." : "") : "\n" + (ins.error || "The matching plugin could not be installed.")));
  }
  return done("Error: No such tool available: " + name, false);
}
