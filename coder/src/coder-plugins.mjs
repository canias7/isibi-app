/**
 * PLUGINS, SAVED SKILLS AND SHARED ONBOARDING GUIDES, THE WORKER'S SIDE (the owner, 2026-11-23: "every Claude Code tool, none
 * skipped"; Claude Code's tools reference: ListPlugins, SearchPlugins, SuggestPluginInstall, ListSkills, SearchSkills,
 * SuggestSkills, propose_skills, ShareOnboardingGuide, ShowOnboardingRolePicker; container/coder-plugins.mjs has the tools).
 *
 * A PLUGIN, as in Claude Code (plugins.md: "a self-contained directory of components that extends Claude Code"): a name, a
 * description and any of skills, commands, agents, hooks and connectors, installed or removed as one unit. Claude Code keeps
 * the plugins enabled for a claude.ai account; Coder keeps them per owner here:
 *   - coder/<uid>/plugins.json: [{ ...plugin, at }] the installed plugins (a copy, so a plugin later dropped from the catalog
 *     still works for whoever installed it);
 *   - coder/<uid>/skills.json: [{ name, description, body, at }] the owner's saved skills (Claude Code's skills on a claude.ai
 *     account), at most SAVED_SKILLS_MAX;
 *   - coder-shared/guide-<hex>.json: { uid, id, guide: { name, text, at } } an ONBOARDING.md shared by share_onboarding_guide,
 *     opened through the same read-only link as a shared chat (/?share=<id>).
 * What an installed plugin does: its skills and commands are skills in every Coder chat of the owner (as Claude Code namespaces
 * them, "plugin-name:skill"); its connectors are added to the owner's Connectors (signed in there, with Connect); its agents
 * and hooks are kept and shown with it.
 *
 * THE MACHINE'S QUESTIONS come through Coder's environment API (coder-envapi.mjs: pluginsApi), with the job's pass; THE
 * PAGE'S through /api/coder/plugins and /api/coder/owner-skills (handlePluginRoutes).
 */
import { readConnectors, writeConnectors, cleanUrl, sameServer, CATALOG as CONNECTOR_CATALOG, CONNECTORS_MAX, removeConnector } from "./coder-mcp.mjs";
import { fetchMarketplace, downloadPlugin, MARKETPLACES_MAX, TRUST_WARNING, autoUpdateDefault, sourceText, tierOf, pluginRootOf, pluginDataOf } from "./coder-marketplace.mjs";
import { seal, unseal } from "./coder-github.mjs";

export const SAVED_SKILLS_MAX = 50;
export const PLUGINS_MAX = 30;
export const GUIDE_MAX = 100_000;
export const SKILL_BODY_MAX = 20_000;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const sk = (name, description, body) => ({ name, description, body });

/** THE BUILT-IN CATALOG: a few plugins worth having for work on code. Each skill's text is what Coder follows. */
export const PLUGIN_CATALOG = Object.freeze([
  {
    name: "code-review", category: "Quality", roles: ["fullstack"],
    description: "A careful review of the chat's changes before they are pushed: bugs, edge cases, missing tests and risky edits.",
    skills: [sk("review-changes", "Review this chat's changes for bugs, edge cases and missing tests before pushing.",
      "Review the changes on this chat's branch.\n\n1. Run `git diff` against the base branch and read every changed file in full, not only the diff.\n2. For each change, look for: wrong logic, off-by-one errors, unhandled errors and empty inputs, races, secrets in code, and anything that breaks an existing caller.\n3. Check that each behaviour change has a test; name the tests that are missing.\n4. Report findings as a short list, most serious first, each with file:line and a one-line fix. Say plainly when you found nothing.")],
    commands: [sk("pre-push", "Run the checks a change needs before it is pushed.", "Before pushing: run the repository's tests and linter (read package.json, Makefile or CI config to find them), fix what fails, then summarise what ran and what passed.")],
    // (Its agent, written as Claude Code's agents/<name>.md: frontmatter, then the system prompt. The agent tool runs it as
    // subagent_type "code-review:code-reviewer".)
    agents: [{ file: "code-reviewer.md", text: "---\nname: code-reviewer\ndescription: Reviews changed code for bugs, edge cases and missing tests. Use after a change is written, before it is pushed.\ntools: Read, Grep, Glob, Bash\n---\nYou are a careful code reviewer. Read the diff against the base branch (git diff) and every changed file in full. Report each real problem with its file:line, what goes wrong and the input that triggers it, most severe first. Change nothing: you only read and report." }],
    hooks: {}, connectors: [],
  },
  {
    name: "testing", category: "Quality", roles: [],
    description: "Write tests in the repository's own style, run them, and keep them fast.",
    skills: [sk("write-tests", "Add tests for a change, in the style the repository already uses.",
      "Find how this repository tests things (its test folder, framework and naming). Write tests for the change: the normal case, the edge cases, and one for each bug fixed. Run them, and make sure a test fails without the change. Keep each test small and independent.")],
    // (Its hooks, as a plugin's hooks/hooks.json: they join the owner's hooks while the plugin is installed.)
    commands: [], agents: [], hooks: { PostToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "echo '{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"(testing plugin) A file changed: add or update a test for it before you finish.\"}}'" }] }] }, connectors: [],
  },
  {
    name: "frontend", category: "Web", roles: ["frontend"],
    description: "Polished, accessible web pages: layout on phones, keyboard use, contrast and loading states.",
    skills: [sk("ui-polish", "Check and improve a page's layout, accessibility and states.",
      "For the page or component in question: check it at phone width (375px) and desktop; every control reachable and usable by keyboard with a visible focus; labels on inputs and buttons; text contrast at least 4.5:1; loading, empty and error states drawn. Fix what is missing, then show a screenshot.")],
    commands: [], agents: [], hooks: {}, connectors: [],
  },
  {
    name: "database", category: "Data", roles: ["backend"],
    description: "Safe schema changes and queries, with the Neon and Supabase connectors.",
    skills: [sk("safe-migrations", "Plan and write a database migration that can't lose data.",
      "Write migrations that are safe to run on live data: add before you remove, backfill in batches, never drop a column in the same release that stops writing it, and give every migration a way back. Show the SQL and say how long it locks each table.")],
    commands: [], agents: [], hooks: {}, connectors: ["Neon", "Supabase"],
  },
  {
    name: "project-tracking", category: "Planning", roles: [],
    description: "Turn Linear issues into branches and pull requests, and keep the issue up to date.",
    skills: [sk("issue-to-pr", "Take an issue from Linear to a finished change.",
      "Read the issue with the Linear connector, restate what done looks like, make the change with tests, and leave a comment on the issue saying what changed and where.")],
    commands: [], agents: [], hooks: {}, connectors: ["Linear"],
  },
  {
    name: "monitoring", category: "Operations", roles: ["devops"],
    description: "Find and fix production errors from Sentry, and read Cloudflare logs.",
    skills: [sk("debug-from-sentry", "Fix an error reported in Sentry.",
      "Read the Sentry issue (stack trace, release, how often), find the code it points at, reproduce it with a test, fix it, and say which release the fix will reach.")],
    commands: [], agents: [], hooks: {}, connectors: ["Sentry", "Cloudflare Logs"],
  },
  {
    name: "docs-writer", category: "Writing", roles: [],
    description: "Clear READMEs, changelogs and onboarding guides for the repository.",
    skills: [sk("write-docs", "Write or update documentation for the repository.", "Write for a newcomer: what it is, how to run it, how to test it, where things live. Short sentences, real commands that work, no guesses: run each command before you write it down.")],
    commands: [sk("changelog", "Write a changelog entry from the branch's commits.", "Read the commits on this branch since the base, group them into Added, Changed and Fixed, and write a short changelog entry in plain words.")],
    agents: [], hooks: {}, connectors: [],
  },
]);

/** SKILLS TO ADD (Claude Code's SuggestSkills: "claude.ai skills you can add"): standalone skills, saved to the owner's skills. */
export const SKILL_CATALOG = Object.freeze([
  sk("commit-messages", "Write clear commit messages from the staged changes.", "Read `git diff --staged`. Write a subject line under 60 characters in the imperative, then a blank line and a short body saying why, not how."),
  sk("explain-code", "Explain how a part of the code works, in plain words.", "Find the entry point, follow the path the data takes, and explain it in plain words with the file:line of each step. Draw a small diagram in text when it helps."),
  sk("refactor-safely", "Change the shape of code without changing what it does.", "Make sure tests cover the code first (add them if not). Change in small steps, running the tests after each. Never mix a refactor with a behaviour change in one commit."),
  sk("security-check", "Look for common security problems in the changes.", "Check the changes for injection (SQL, shell, HTML), secrets in code or logs, missing auth checks, unsafe redirects and SSRF. Report each with file:line and a fix."),
]);

/** The roles of ShowOnboardingRolePicker ("the role list is defined by the client"), each with its matching plugin. */
export const ROLES = Object.freeze([
  { id: "frontend", label: "Frontend", description: "Web pages and apps people use", plugin: "frontend" },
  { id: "backend", label: "Backend", description: "Servers, APIs and databases", plugin: "database" },
  { id: "fullstack", label: "Full-stack", description: "A bit of everything", plugin: "code-review" },
  { id: "devops", label: "DevOps", description: "Deploys, monitoring and incidents", plugin: "monitoring" },
]);

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
const pluginsKey = (uid) => "coder/" + uid + "/plugins.json";
const skillsKey = (uid) => "coder/" + uid + "/skills.json";
const sharedKey = (id) => "coder-shared/" + id + ".json";
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, n);

/** One skill as kept: { name, description, body } or null. */
export function cleanSkill(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  const body = clip(raw.body ?? raw.instructions, SKILL_BODY_MAX).trim();
  if (!NAME_RE.test(name) || !body) return null;
  // (What makes loading it ask first: its allowed-tools, disallowed-tools or hooks, kept from its SKILL.md. 2026-11-24.)
  const asks = typeof raw.asks === "string" && /^[a-z, -]{1,60}$/.test(raw.asks) ? raw.asks : "";
  return { name, description: clip(raw.description, 250).replace(/\s+/g, " ").trim() || body.split("\n")[0].slice(0, 250), body, ...(asks ? { asks } : {}) };
}

/** Each hook handler as "Event (matcher)", for the page. */
export function hookEvents(h) {
  if (!h || typeof h !== "object" || Array.isArray(h)) return [];
  const out = [];
  for (const [ev, groups] of Object.entries(h.hooks && typeof h.hooks === "object" ? h.hooks : h)) for (const g of Array.isArray(groups) ? groups : []) for (const _h of g && Array.isArray(g.hooks) ? g.hooks : []) out.push(ev + (g.matcher ? " (" + g.matcher + ")" : ""));
  return out;
}
/** How many hook handlers a plugin's hooks (Claude Code's hooks.json shape, { Event: [{ matcher, hooks: [...] }] }) hold. */
export function hookCount(h) {
  if (!h || typeof h !== "object" || Array.isArray(h)) return 0;
  let n = 0;
  for (const groups of Object.values(h.hooks && typeof h.hooks === "object" ? h.hooks : h)) for (const g of Array.isArray(groups) ? groups : []) n += g && Array.isArray(g.hooks) ? g.hooks.length : 0;
  return n;
}
/** A plugin agent's name (its file's frontmatter name, else the file name). */
export function agentName(a) {
  if (!a) return "";
  if (typeof a === "string") return a;
  const m = /^---\r?\n[\s\S]*?^name:\s*(.+)$/m.exec(String(a.text || ""));
  return (m ? m[1].trim().replace(/^["']|["']$/g, "") : String(a.file || a.name || "").replace(/\.md$/, "")).slice(0, 64);
}
/** What a plugin contains, in a few words ("2 skills, 1 command, Neon and Supabase connectors"). */
export function contentsOf(p) {
  const n = (a, w) => (a && a.length ? a.length + " " + w + (a.length === 1 ? "" : "s") : "");
  return [n(p.skills, "skill"), n(p.commands, "command"), n(p.agents, "agent"), n(Array.from({ length: hookCount(p.hooks) }), "hook"), p.connectors && p.connectors.length ? p.connectors.join(" and ") + " connector" + (p.connectors.length === 1 ? "" : "s") : ""].filter(Boolean).join(", ") || "nothing yet";
}
/** A plugin as the page and the machine see it (no skill text). */
export const pluginOut = (p, installed = false, secretsSet = null) => ({ name: p.name, description: p.description, category: p.category || "", contents: contentsOf(p), skills: (p.skills || []).map((s) => s.name), commands: (p.commands || []).map((s) => s.name), agents: (p.agents || []).map((a) => (a && a.sub ? a.sub + ":" : "") + agentName(a)), hooks: hookEvents(p.hooks), connectors: [...(p.connectors || []), ...Object.keys(p.mcpServers || {}).map((k) => "plugin:" + (p.manifestName || p.name) + ":" + k)], installed, ...(p.at ? { at: p.at } : {}),
  // (2026-11-28: its id, switch, version and settings, as Claude Code's Installed tab shows them. A sensitive option's value is
  // never sent: only whether it is set.)
  ...(installed ? { id: p.marketplace ? p.name + "@" + p.marketplace : p.name, enabled: typeof p.enabled === "boolean" ? p.enabled : p.defaultEnabled !== false } : {}),
  ...(p.marketplace ? { marketplace: p.marketplace } : {}), ...(p.manifestName && p.manifestName !== p.name ? { ns: p.manifestName } : {}), ...(p.version ? { version: p.version } : {}), ...(p.displayName ? { displayName: p.displayName } : {}), ...(p.homepage ? { homepage: p.homepage } : {}), ...(p.author ? { author: p.author } : {}),
  ...(p.localServers && p.localServers.length ? { localServers: p.localServers.slice() } : {}), ...(p.skipped && p.skipped.length ? { skipped: p.skipped.slice() } : {}),
  ...(p.userConfig && Object.keys(p.userConfig).length ? { userConfig: Object.fromEntries(Object.entries(p.userConfig).map(([k, o]) => [k, { ...o, ...(o.sensitive ? { set: !!(secretsSet && secretsSet.includes(k)) } : { value: p.config && k in p.config ? p.config[k] : o.default ?? "" }) }])) } : {}) });

export async function readPlugins(bucket, uid) {
  const v = await getJson(bucket, pluginsKey(uid), []);
  return (Array.isArray(v) ? v : []).filter((p) => p && NAME_RE.test(String(p.name || ""))).slice(0, PLUGINS_MAX);
}
export async function readSavedSkills(bucket, uid) {
  const v = await getJson(bucket, skillsKey(uid), []);
  return (Array.isArray(v) ? v : []).map((x) => { const s = cleanSkill(x); return s ? { ...s, at: Number(x.at) || 0 } : null; }).filter(Boolean).slice(0, SAVED_SKILLS_MAX);
}

/**
 * A PLUGIN'S ID, as Claude Code writes it in enabledPlugins (plugins/loading.md "Find where a plugin came from"):
 * name@marketplace for one from a marketplace; a built-in catalog plugin keeps its bare name (it is Coder's own, like a
 * plugin synced from claude.ai, which loads as name@synced).
 */
export const pluginId = (p) => (p && p.marketplace ? p.name + "@" + p.marketplace : String((p && p.name) || ""));
/** The name its components are namespaced under: the manifest's name (Claude Code's "Entry name and manifest name"). */
export const nsOf = (p) => String((p && (p.manifestName || p.name)) || "");
/** On or off (Claude Code's defaultEnabled: "Whether the plugin starts enabled when the user hasn't set it"; true by default). */
export const isEnabled = (p) => (p && typeof p.enabled === "boolean" ? p.enabled : !(p && p.defaultEnabled === false));
const findPlugin = (list, id) => { const want = String(id || "").trim().toLowerCase(); return list.find((x) => pluginId(x) === want) || list.find((x) => !x.marketplace && x.name === want) || (want.includes("@") ? null : list.find((x) => x.name === want)) || null; };

/** Installs a catalog plugin: kept for the owner, its connectors added to their Connectors. → { ok, plugin, added } or { error }. */
export async function installPlugin(bucket, uid, name, { now = Date.now(), catalog = PLUGIN_CATALOG } = {}) {
  const want = String(name || "").trim().toLowerCase();
  const p = catalog.find((x) => x.name === want);
  if (!p) return { error: "No plugin called \"" + clip(name, 64) + "\" is in the catalog." };
  const list = await readPlugins(bucket, uid);
  if (list.some((x) => !x.marketplace && x.name === p.name)) return { ok: true, plugin: pluginOut(p, true), added: [], already: true };
  if (list.length >= PLUGINS_MAX) return { error: "You have " + PLUGINS_MAX + " plugins, the most there can be. Remove one first." };
  // (Its connectors: added to the owner's list as not signed in yet; Connect in Connectors signs in. One already there is kept.)
  const added = [];
  const conns = await readConnectors(bucket, uid);
  for (const cn of p.connectors || []) {
    const k = CONNECTOR_CATALOG.find((x) => x.name === cn);
    const url = k && cleanUrl(k.url);
    if (!url || conns.some((x) => sameServer(x.url, url)) || conns.length >= CONNECTORS_MAX) continue;
    conns.push({ id: "c" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36)).join("").slice(0, 9), name: k.name, url, auth: "none", tools: [], status: "auth", at: now, fromPlugin: p.name });
    added.push(k.name);
  }
  if (added.length) await writeConnectors(bucket, uid, conns);
  await putJson(bucket, pluginsKey(uid), [...list, { ...JSON.parse(JSON.stringify(p)), at: now }]);
  return { ok: true, plugin: pluginOut(p, true), added };
}

// ── MARKETPLACES (src/coder-marketplace.mjs: Claude Code's, added by Git URL; its download and archive limits) ──
const marketsKey = (uid) => "coder/" + uid + "/marketplaces.json";
export async function readMarketplaces(bucket, uid) { const v = await getJson(bucket, marketsKey(uid), []); return (Array.isArray(v) ? v : []).filter((m) => m && typeof m.name === "string" && Array.isArray(m.plugins)).slice(0, MARKETPLACES_MAX); }
/** Whether a marketplace auto-updates: its own switch, else Claude Code's default for its name. */
export const autoUpdateOf = (mk) => (mk && typeof mk.autoUpdate === "boolean" ? mk.autoUpdate : autoUpdateDefault(mk && mk.name));
/** Adds a marketplace (or refreshes one of the same name, keeping its auto-update switch). → { ok, marketplace } or { error }. */
export async function addMarketplace(bucket, uid, source, { fetchFn = fetch, now = Date.now() } = {}) {
  const r = await fetchMarketplace(source, { fetchFn });
  if (r.error) return { error: r.error };
  const all = await readMarketplaces(bucket, uid);
  const was = all.find((m) => m.name === r.marketplace.name);
  const list = all.filter((m) => m.name !== r.marketplace.name);
  if (list.length >= MARKETPLACES_MAX) return { error: "You have " + MARKETPLACES_MAX + " marketplaces, the most there can be. Remove one first." };
  const mk = { ...r.marketplace, at: was ? was.at || now : now, lastUpdated: now, ...(was && typeof was.autoUpdate === "boolean" ? { autoUpdate: was.autoUpdate } : {}) };
  await putJson(bucket, marketsKey(uid), [...list, mk]);
  return { ok: true, marketplace: mk };
}
/** Refreshes a marketplace from its source (Claude Code's `marketplace update`). */
export async function refreshMarketplace(bucket, uid, name, opts = {}) {
  const mk = (await readMarketplaces(bucket, uid)).find((m) => m.name === String(name || "").toLowerCase());
  if (!mk) return { error: "No marketplace has that name." };
  return addMarketplace(bucket, uid, sourceText(mk.source), opts);
}
export async function setMarketplaceAutoUpdate(bucket, uid, name, on) {
  const list = await readMarketplaces(bucket, uid);
  const mk = list.find((m) => m.name === String(name || "").toLowerCase());
  if (!mk) return { error: "No marketplace has that name." };
  mk.autoUpdate = on === true;
  await putJson(bucket, marketsKey(uid), list);
  return { ok: true, autoUpdate: mk.autoUpdate };
}
/**
 * Removes a marketplace and, as Claude Code does ("remove the marketplace too, which uninstalls every plugin you installed
 * from it"), uninstalls its plugins. → { ok, removed: [ids] }.
 */
export async function removeMarketplace(bucket, uid, name, env = null) {
  const list = await readMarketplaces(bucket, uid);
  if (!list.some((m) => m.name === name)) return { error: "No marketplace has that name." };
  const removed = [];
  for (const p of await readPlugins(bucket, uid)) if (p.marketplace === name) { await removePlugin(bucket, uid, pluginId(p), env); removed.push(pluginId(p)); }
  await putJson(bucket, marketsKey(uid), list.filter((m) => m.name !== name));
  return { ok: true, removed };
}

/** Where a plugin version's zip is kept (the whole plugin folder, so its scripts and bin/ reach the machine). */
export const pluginZipKey = (uid, id, version) => "coder/" + uid + "/plugin-zips/" + String(id).replace(/[^\w@.-]/g, "-") + "/" + String(version).replace(/[^\w.-]/g, "-").slice(0, 80) + ".zip";
/** A plugin's MCP servers as Coder connectors: the remote ones (url), each named plugin:<plugin>:<server> as Claude Code names them. */
function serverConnectors(p, id, now) {
  const out = [], local = [];
  for (const [k, v] of Object.entries(p.mcpServers || {})) {
    const url = typeof v.url === "string" && !String(v.url).includes("${") ? cleanUrl(v.url) : null;
    if (url) out.push({ id: "c" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36)).join("").slice(0, 9), name: clip("plugin:" + nsOf(p) + ":" + k, 60), url, auth: "none", tools: [], status: "auth", at: now, fromPlugin: id });
    else local.push(k);
  }
  return { out, local };
}

/**
 * Installs plugin `name` from marketplace `market`: downloaded within Claude Code's limits, its zip kept whole, its remote MCP
 * servers added to the owner's Connectors. `accepted`: the owner saw Claude Code's trust warning ("Make sure you trust a plugin
 * before installing, updating, or using it"), which the page shows before every marketplace install. → { ok, plugin, added }.
 */
export async function installFromMarketplace(bucket, uid, name, market, { fetchFn = fetch, now = Date.now(), accepted = true } = {}) {
  const mk = (await readMarketplaces(bucket, uid)).find((m) => m.name === String(market || "").toLowerCase());
  if (!mk) return { error: "No marketplace called \"" + clip(market, 64) + "\" has been added." };
  const entry = mk.plugins.find((p) => p.name === String(name || "").trim().toLowerCase());
  if (!entry) return { error: "The marketplace " + mk.name + " has no plugin called \"" + clip(name, 64) + "\"." };
  if (accepted !== true) return { error: "Read the trust warning and choose Install: " + TRUST_WARNING, trust: TRUST_WARNING };
  const id = entry.name + "@" + mk.name;
  const list = await readPlugins(bucket, uid);
  const was = list.find((x) => pluginId(x) === id);
  if (!was && list.length >= PLUGINS_MAX) return { error: "You have " + PLUGINS_MAX + " plugins, the most there can be. Remove one first." };
  const got = await downloadPlugin(mk, entry, { fetchFn });
  if (got.error) return { error: got.error };
  const zipKey = pluginZipKey(uid, id, got.version);
  await bucket.put(zipKey, got.bytes, { httpMetadata: { contentType: "application/zip" } });
  const conns = await readConnectors(bucket, uid);
  const { out, local } = serverConnectors(got.plugin, id, now);
  const added = [];
  for (const c of out) if (!conns.some((x) => x.fromPlugin === id && x.name === c.name) && conns.length < CONNECTORS_MAX) { conns.push(c); added.push(c.name); }
  if (added.length) await writeConnectors(bucket, uid, conns);
  const rec = { ...got.plugin, zip: { key: zipKey, base: got.base }, ...(local.length ? { localServers: local } : {}), at: was ? was.at || now : now, updatedAt: now,
    ...(was && typeof was.enabled === "boolean" ? { enabled: was.enabled } : {}), ...(was && was.config ? { config: was.config } : {}) };
  await putJson(bucket, pluginsKey(uid), [...list.filter((x) => pluginId(x) !== id), rec]);
  if (was && was.zip && was.zip.key !== zipKey) await bucket.delete(was.zip.key).catch(() => {});
  return { ok: true, plugin: pluginOut(rec, true), added, version: got.version };
}

/**
 * UPDATES ONE PLUGIN, CLAUDE CODE'S WAY (plugins/loading.md "Versions and updates"): its marketplace is refreshed first, then the
 * version is computed again (the manifest's version, the entry's, else the commit SHA or archive digest); the same version keeps
 * the installed copy ("<name> is already at the latest version (<version>)"). The owner's on/off switch and settings stay.
 */
export async function updatePlugin(bucket, uid, id, { fetchFn = fetch, now = Date.now() } = {}) {
  const list = await readPlugins(bucket, uid);
  const p = findPlugin(list, id);
  if (!p) return { error: "No installed plugin has that name." };
  if (!p.marketplace) return { ok: true, same: true, version: p.version || "", note: nsOf(p) + " is one of Coder's built-in plugins: it updates with Coder." };
  const r = await refreshMarketplace(bucket, uid, p.marketplace, { fetchFn, now });
  const mk = r.ok ? r.marketplace : (await readMarketplaces(bucket, uid)).find((m) => m.name === p.marketplace);
  if (!mk) return { error: "Its marketplace " + p.marketplace + " is no longer added." };
  const entry = mk.plugins.find((x) => x.name === p.name);
  if (!entry) return { error: p.name + " is no longer listed in " + mk.name + "." };
  const got = await downloadPlugin(mk, entry, { fetchFn });
  if (got.error) return { error: got.error };
  if (got.version === p.version && got.version !== "unknown") return { ok: true, same: true, version: got.version, note: pluginId(p) + " is already at the latest version (" + got.version + ")." };
  const done = await installFromMarketplace(bucket, uid, p.name, p.marketplace, { fetchFn, now });
  return done.ok ? { ...done, updated: true, from: p.version || "", note: "Plugin updated: " + pluginId(p) + " · " + (p.version || "?") + " → " + done.version } : done;
}

/**
 * AUTO-UPDATE (plugins/loading.md "When auto-update runs": after the first message of a session, every marketplace with
 * auto-update on is refreshed and its plugins updated; they load in the next session). Coder runs it once an hour at most per
 * owner, when a chat starts a job. → { ok, updated: [ids] }.
 */
export const AUTO_UPDATE_EVERY = 60 * 60 * 1000;
export async function autoUpdatePlugins(bucket, uid, { fetchFn = fetch, now = Date.now() } = {}) {
  const on = (await readMarketplaces(bucket, uid)).filter(autoUpdateOf);
  if (!on.length) return { ok: true, updated: [] };
  const k = "coder/" + uid + "/plugins-autoupdate.json";
  const last = await getJson(bucket, k, {});
  if (now - (Number(last && last.at) || 0) < AUTO_UPDATE_EVERY) return { ok: true, updated: [], skipped: true };
  await putJson(bucket, k, { at: now });
  const updated = [];
  for (const mk of on) {
    for (const p of await readPlugins(bucket, uid)) if (p.marketplace === mk.name) { const r = await updatePlugin(bucket, uid, pluginId(p), { fetchFn, now }).catch(() => null); if (r && r.updated) updated.push(pluginId(p)); }
  }
  return { ok: true, updated };
}

/**
 * THE ON/OFF SWITCH (Claude Code's enable and disable: "To stop it without uninstalling, disable the plugin"). Off, its skills,
 * commands, agents and hooks leave every chat and its connectors are switched off; on, they are back.
 */
export async function setPluginEnabled(bucket, uid, id, on) {
  const list = await readPlugins(bucket, uid);
  const p = findPlugin(list, id);
  if (!p) return { error: "No installed plugin has that name." };
  p.enabled = on === true;
  await putJson(bucket, pluginsKey(uid), list);
  const conns = await readConnectors(bucket, uid);
  let n = 0;
  for (const c of conns) if (c.fromPlugin === pluginId(p)) { c.disabled = !p.enabled; n++; }
  if (n) await writeConnectors(bucket, uid, conns);
  return { ok: true, enabled: p.enabled };
}

/**
 * A PLUGIN'S userConfig VALUES (plugins-reference "User configuration": "Non-sensitive values are saved under pluginConfigs";
 * "Sensitive values go to the platform's secure credential store instead"). Coder keeps the sensitive ones sealed, as it keeps
 * the owner's GitHub token and environment secrets (coder-github.mjs seal); they are never sent to the page, which only learns
 * that one is set. An empty sensitive field keeps the value already set.
 */
const pluginSecretsKey = (uid) => "coder/" + uid + "/plugin-secrets.json";
export async function readPluginSecrets(env, bucket, uid) {
  const o = await getJson(bucket, pluginSecretsKey(uid), null);
  if (!o || !o.box) return {};
  try { const v = await unseal(env, o.box); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export async function setPluginConfig(env, bucket, uid, id, values) {
  const list = await readPlugins(bucket, uid);
  const p = findPlugin(list, id);
  if (!p) return { error: "No installed plugin has that name." };
  const schema = p.userConfig || {};
  const v = values && typeof values === "object" ? values : {};
  const config = { ...(p.config || {}) };
  const secrets = await readPluginSecrets(env, bucket, uid);
  const mine = { ...(secrets[pluginId(p)] || {}) };
  for (const [k, o] of Object.entries(schema)) {
    if (!(k in v)) continue;
    let x = v[k];
    if (o.type === "number") { if (x === "" || x === null) { delete config[k]; continue; } x = Number(x); if (!Number.isFinite(x)) return { error: o.title + " must be a number." }; }
    else if (o.type === "boolean") x = x === true || x === "true";
    else if (o.multiple) x = (Array.isArray(x) ? x : String(x || "").split(",")).map((y) => clip(y, 500).trim()).filter(Boolean).slice(0, 50);
    else x = clip(x, 2000);
    if (o.options && o.options.length && x !== "" && !o.options.includes(x)) return { error: o.title + " must be one of " + o.options.join(", ") + "." };
    if (o.sensitive) { if (x !== "") mine[k] = x; continue; }
    if (x === "") delete config[k]; else config[k] = x;
  }
  const missing = Object.entries(schema).filter(([k, o]) => o.required && !(o.sensitive ? k in mine : k in config || o.default !== undefined)).map(([, o]) => o.title);
  p.config = config;
  await putJson(bucket, pluginsKey(uid), list);
  secrets[pluginId(p)] = mine;
  await putJson(bucket, pluginSecretsKey(uid), { box: await seal(env, secrets) });
  return { ok: true, ...(missing.length ? { missing } : {}) };
}
/** Every option's value for a plugin: { KEY: value } (sensitive ones included only when `withSecrets`). */
export function optionValues(p, secrets = {}, withSecrets = false) {
  const out = {};
  for (const [k, o] of Object.entries(p.userConfig || {})) {
    if (o.sensitive) { if (withSecrets && secrets && secrets[k] !== undefined) out[k] = secrets[k]; continue; }
    const v = p.config && k in p.config ? p.config[k] : o.default;
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Removes an installed plugin, its zip, its secrets, and the connectors it added (a catalog plugin's: those still not signed in). */
export async function removePlugin(bucket, uid, name, env = null) {
  const list = await readPlugins(bucket, uid);
  const p = findPlugin(list, name);
  if (!p) return { error: "No installed plugin has that name." };
  const id = pluginId(p);
  for (const c of await readConnectors(bucket, uid)) if (c.fromPlugin === id && (p.marketplace || c.status === "auth")) await removeConnector(bucket, uid, c.id);
  if (p.zip && p.zip.key) await bucket.delete(p.zip.key).catch(() => {});
  if (env) { const sec = await readPluginSecrets(env, bucket, uid); if (sec[id]) { delete sec[id]; await putJson(bucket, pluginSecretsKey(uid), { box: await seal(env, sec) }); } }
  await putJson(bucket, pluginsKey(uid), list.filter((x) => x !== p));
  return { ok: true };
}

export async function saveSkill(bucket, uid, raw, now = Date.now()) {
  const s = cleanSkill(raw);
  if (!s) return { error: "A skill needs a name (letters, digits, - and _, at most 64 characters) and its instructions." };
  const list = (await readSavedSkills(bucket, uid)).filter((x) => x.name.toLowerCase() !== s.name.toLowerCase());
  if (list.length >= SAVED_SKILLS_MAX) return { error: "You have " + SAVED_SKILLS_MAX + " saved skills, the most there can be. Remove one first." };
  const next = [...list, { ...s, at: now }];
  await putJson(bucket, skillsKey(uid), next);
  return { ok: true, skill: s };
}
export async function removeSkill(bucket, uid, name) {
  const list = await readSavedSkills(bucket, uid);
  const next = list.filter((x) => x.name.toLowerCase() !== String(name || "").toLowerCase());
  if (next.length === list.length) return { error: "No saved skill has that name." };
  await putJson(bucket, skillsKey(uid), next);
  return { ok: true };
}

/**
 * WHICH COPY LOADS WHEN NAMES CLASH (plugins/loading.md "Name conflicts": an installed marketplace plugin before a plugin synced
 * from claude.ai, which Coder's built-in catalog stands for; between two marketplace plugins of one manifest name, both load but
 * only the first holds the name's hooks). → the plugins in load order, each with `hooksLeftOut` when another holds its hooks.
 */
export function loadOrder(list) {
  const ordered = [...list.filter((p) => p.marketplace), ...list.filter((p) => !p.marketplace)];
  const held = new Map(), out = [];
  for (const p of ordered) {
    const ns = nsOf(p).toLowerCase();
    if (!p.marketplace && list.some((q) => q.marketplace && isEnabled(q) && nsOf(q).toLowerCase() === ns)) { out.push({ ...p, notLoaded: "the name \"" + nsOf(p) + "\" is already taken by " + pluginId(list.find((q) => q.marketplace && isEnabled(q) && nsOf(q).toLowerCase() === ns)) + ", which takes precedence" }); continue; }
    if (isEnabled(p) && held.has(ns)) out.push({ ...p, hooksLeftOut: held.get(ns) }); else { if (isEnabled(p) && hookCount(p.hooks)) held.set(ns, pluginId(p)); out.push(p); }
  }
  return out;
}
/**
 * A PLUGIN'S TEXT WITH ITS VARIABLES (plugins-reference "Environment variables" and "User configuration"): ${CLAUDE_PLUGIN_ROOT}
 * and ${CLAUDE_PLUGIN_DATA} in skill, agent and command content, and ${user_config.KEY} with the non-sensitive values only ("a
 * sensitive value there becomes a placeholder").
 */
export function withPluginVars(p, text) {
  if (!p || !p.marketplace) return String(text || "");
  const root = pluginRootOf(p.marketplace, p.name, p.version || "unknown"), data = pluginDataOf(pluginId(p));
  const opts = optionValues(p);
  return String(text || "").split("${CLAUDE_PLUGIN_ROOT}").join(root).split("${CLAUDE_PLUGIN_DATA}").join(data)
    .replace(/\$\{user_config\.([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => (p.userConfig && p.userConfig[k] && p.userConfig[k].sensitive ? "[sensitive value: " + k + "]" : k in opts ? (Array.isArray(opts[k]) ? opts[k].join(",") : String(opts[k])) : m));
}

/**
 * Every skill the owner has outside the repository: saved ones, then their enabled plugins' skills and commands
 * ("plugin:skill", the manifest's name first). `{ off: true }`: the skills of the plugins switched off instead (a repository's
 * enabledPlugins can turn one back on for its chats).
 */
export async function ownerSkills(bucket, uid, { off = false } = {}) {
  const out = off ? [] : (await readSavedSkills(bucket, uid)).map((s) => ({ name: s.name, description: s.description, body: s.body, ...(s.asks ? { asks: s.asks } : {}), source: "saved" }));
  for (const p of loadOrder(await readPlugins(bucket, uid))) {
    if (p.notLoaded || isEnabled(p) === off) continue;
    for (const s of [...(p.skills || []), ...(p.commands || [])]) {
      const c = cleanSkill({ ...s, body: withPluginVars(p, s.body) });
      if (!c) continue;
      const name = nsOf(p) + ":" + c.name;
      if (out.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
      out.push({ name, description: c.description, body: c.body, ...(c.asks ? { asks: c.asks } : {}), source: "plugin " + nsOf(p), plugin: pluginId(p), ...(p.marketplace && s.dir ? { dir: pluginRootOf(p.marketplace, p.name, p.version || "unknown") + "/" + s.dir } : {}) });
    }
  }
  return out.slice(0, SAVED_SKILLS_MAX * 2);
}

/**
 * WHAT INSTALLED PLUGINS ADD TO A TURN (Claude Code: "Plugin hooks run from the moment the plugin loads"; a plugin's agents
 * are subagents the Agent tool can use): { hooks: [{ plugin, id, enabled, root, data, options, hooks }], agents: [{ plugin, id,
 * enabled, file, sub, text }], files: [{ id, key, base, root, data }] }. Every installed plugin is listed with its switch, so a
 * repository's enabledPlugins can turn one on or off for its chats (the machine decides: container/coder-pluginfiles.mjs). Its
 * `files` are the zips the machine unpacks, so ${CLAUDE_PLUGIN_ROOT} holds the whole plugin. `env`: to read the sensitive
 * options, which reach the plugin's hooks only (CLAUDE_PLUGIN_OPTION_<KEY>, and ${user_config.KEY} in exec-form args).
 */
export async function ownerPluginParts(bucket, uid, env = null) {
  const out = { hooks: [], agents: [], files: [] };
  const secrets = env ? await readPluginSecrets(env, bucket, uid) : {};
  for (const p of loadOrder(await readPlugins(bucket, uid))) {
    if (p.notLoaded) continue;
    const id = pluginId(p), on = isEnabled(p);
    const where = p.marketplace ? { root: pluginRootOf(p.marketplace, p.name, p.version || "unknown"), data: pluginDataOf(id) } : {};
    if (p.marketplace && p.zip && p.zip.key) out.files.push({ id, enabled: on, key: p.zip.key, base: String(p.zip.base || ""), ...where });
    if (hookCount(p.hooks) && !p.hooksLeftOut) out.hooks.push({ plugin: nsOf(p), id, enabled: on, ...where, ...(p.marketplace ? { options: optionValues(p, secrets[id], true) } : {}), hooks: p.hooks.hooks && typeof p.hooks.hooks === "object" ? p.hooks.hooks : p.hooks });
    for (const a of Array.isArray(p.agents) ? p.agents : []) if (a && typeof a.text === "string") out.agents.push({ plugin: nsOf(p), id, enabled: on, file: clip(a.file, 120), ...(a.sub ? { sub: clip(a.sub, 120) } : {}), text: clip(withPluginVars(p, a.text), 20_000) });
  }
  out.agents = out.agents.slice(0, 30);
  return out;
}

/**
 * CLAUDE CODE'S SendFeedback QUEUE (tools-reference: "The queue holds 10 drafts across all your sessions, and when Claude
 * queues an eleventh, Claude Code deletes the oldest"; "A draft you leave in the queue expires after 30 days"): the owner's
 * drafts at coder/<uid>/feedback-drafts.json, [{ id, title, area, details, chat, at }]. Nothing is sent anywhere.
 */
export const FEEDBACK_QUEUE_MAX = 10;
export const FEEDBACK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const feedbackKey = (uid) => "coder/" + uid + "/feedback-drafts.json";
export async function readFeedback(bucket, uid, now = Date.now()) {
  const v = await getJson(bucket, feedbackKey(uid), []);
  return (Array.isArray(v) ? v : []).filter((d) => d && typeof d.id === "string" && now - (Number(d.at) || 0) < feedbackTtl(d)).slice(-FEEDBACK_QUEUE_MAX);
}
/** A draft's time to live: 30 days, or its chat's cleanupPeriodDays when that is shorter (Claude Code's; `keepDays`). */
export function feedbackTtl(d) {
  const k = Number(d && d.keepDays);
  return Number.isInteger(k) && k >= 1 && k < 30 ? k * 24 * 60 * 60 * 1000 : FEEDBACK_TTL_MS;
}
const feedbackSettingsKey = (uid) => "coder/" + uid + "/feedback-settings.json";
export async function feedbackOff(bucket, uid) { const v = await getJson(bucket, feedbackSettingsKey(uid), {}); return !!(v && v.off === true); }
/** Queues one draft: → { ok, id, queued, inChat, dropped }. */
export async function queueFeedback(bucket, uid, draft, chat = "", now = Date.now()) {
  if (await feedbackOff(bucket, uid)) return { error: "error: the owner turned Claude-drafted feedback off; nothing was drafted. Don't draft feedback in this chat.", off: true };
  const title = clip(draft && draft.title, 200).trim(), details = clip(draft && draft.details, 8000).trim(), area = clip(draft && draft.area, 80).trim();
  if (!title || !details) return { error: "error: give a title and the details" };
  const list = await readFeedback(bucket, uid, now);
  const id = "fb" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");
  const where = clip(chat, 200);
  const keepDays = Number(draft && draft.keepDays);
  list.push({ id, title, details, ...(area ? { area } : {}), chat: where, at: now, ...(Number.isInteger(keepDays) && keepDays >= 1 && keepDays < 30 ? { keepDays } : {}) });
  const dropped = Math.max(0, list.length - FEEDBACK_QUEUE_MAX);
  const kept = list.slice(dropped);
  await putJson(bucket, feedbackKey(uid), kept);
  return { ok: true, id, queued: kept.length, inChat: kept.filter((d) => d.chat === where).length, dropped };
}
/**
 * A DRAFT CARD'S STATE, SAVED WITH ITS CHAT (the retest of 2026-11-24: after a reload a dismissed card showed Review, Send and
 * Dismiss again, as its state lived only in the open page). coder/<uid>/<chat>/feedback-cards.json, { <draft id>: { review,
 * dismissed, sent, receipt, at } }, read back with the chat (GET /projects/<chat>, `fbCards`), as other cards' answers are.
 */
export const feedbackCardsKey = (uid, pid) => "coder/" + uid + "/" + pid + "/feedback-cards.json";
export async function readCardStates(bucket, uid, pid) {
  const v = await getJson(bucket, feedbackCardsKey(uid, pid), {});
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
export async function saveCardState(bucket, uid, pid, draftId, want, now = Date.now()) {
  if (!/^fb[0-9a-f]{10}$/.test(String(draftId || ""))) return { error: "No draft has that id." };
  const all = await readCardStates(bucket, uid, pid);
  const was = all[draftId] && typeof all[draftId] === "object" ? all[draftId] : {};
  const st = { ...was, ...(want.review !== undefined ? { review: want.review === true } : {}), ...(want.dismissed ? { dismissed: true } : {}), ...(want.sent ? { sent: true, receipt: clip(want.receipt, 80) } : {}), at: now };
  const keys = Object.keys(all).filter((k) => k !== draftId).sort((a, b) => (Number(all[a] && all[a].at) || 0) - (Number(all[b] && all[b].at) || 0)).slice(-49);
  const next = {}; for (const k of keys) next[k] = all[k]; next[draftId] = st;
  await putJson(bucket, feedbackCardsKey(uid, pid), next);
  return { ok: true, state: st };
}
export async function removeFeedback(bucket, uid, id) {
  const list = await readFeedback(bucket, uid);
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return { error: "No draft has that id." };
  await putJson(bucket, feedbackKey(uid), next);
  return { ok: true };
}

/**
 * SENDING A DRAFT (Claude Code: "Sending submits it like /feedback, deletes the local draft and shows '✓ Sent' (card) or a
 * receipt ID (queue). It carries your title, area and details, environment info (version, OS, model) ... and the conversation
 * only when Send transcript was yes"; "the working folder kept in the draft isn't sent"). Coder's feedback goes to Coder's own
 * inbox, coder-feedback/<receipt>.json, which Coder's makers read (Coder has no Anthropic feedback service).
 * opts: { transcript: boolean, events: the chat's events (read only when transcript is yes), model, version, ua }.
 */
export const CODER_VERSION = "2026.11.23";
/** The version Claude-drafted feedback needs (Claude Code: "needs Claude Code v2.1.238 or later"); Coder's first with it. */
export const FEEDBACK_SINCE = "2026.11.23";
export async function sendFeedback(bucket, uid, id, opts = {}, now = Date.now()) {
  const list = await readFeedback(bucket, uid, now);
  const d = list.find((x) => x.id === id);
  if (!d) return { error: "No draft has that id." };
  const receipt = "fbr_" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  const transcript = opts.transcript === true && Array.isArray(opts.events) ? opts.events.filter((e) => e && (e.type === "user" || e.type === "done" || e.type === "text")).slice(-200).map((e) => ({ type: e.type, text: clip(e.text, 4000) })) : null;
  // (The chat the draft came from, its "working folder", is never sent.)
  await putJson(bucket, "coder-feedback/" + receipt + ".json", { receipt, uid, title: d.title, ...(d.area ? { area: d.area } : {}), details: d.details, env: { version: CODER_VERSION, os: clip(opts.ua, 200), model: clip(opts.model, 80) }, ...(transcript ? { transcript } : {}), at: now });
  await putJson(bucket, feedbackKey(uid), list.filter((x) => x.id !== id));
  return { ok: true, receipt, sent: true, transcript: !!transcript };
}

/** Claude Code's keyword phrases (1 to 8, each 1 to 64 characters) as one query; a plain query string still works. */
export function keywordsQuery(body) {
  const k = body && body.keywords;
  if (Array.isArray(k)) return k.filter((x) => typeof x === "string").map((x) => x.slice(0, 64)).slice(0, 8).join(" ");
  return String((body && body.query) || "");
}

/** Word search: each entry with the words of the query it holds, best first. */
export function searchRows(rows, query, text) {
  const words = String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  if (!words.length) return rows.slice();
  return rows.map((r) => [words.reduce((n, w) => n + (String(r.name).toLowerCase().includes(w) ? 3 : 0) + (text(r).toLowerCase().includes(w) ? 1 : 0), 0), r]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).map(([, r]) => r);
}
const pluginText = (p) => [p.description, p.category, contentsOf(p), ...(p.skills || []).map((s) => s.name + " " + s.description), ...(p.connectors || [])].join(" ");

/** The shared guide: kept under a new share id. → { ok, id, url } or { error }. */
export async function shareGuide(env, bucket, uid, body, now = Date.now()) {
  const text = clip(body && body.text, GUIDE_MAX + 1);
  if (!text.trim()) return { error: "error: ONBOARDING.md is empty" };
  if (text.length > GUIDE_MAX) return { error: "error: ONBOARDING.md is over " + GUIDE_MAX + " characters" };
  const name = clip(body && body.name, 120).trim() || "ONBOARDING.md";
  const id = "guide-" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  await putJson(bucket, sharedKey(id), { uid, id, guide: { name, text, repo: clip(body && body.repo, 200), at: now } });
  return { ok: true, id, url: String((env && env.CODER_PUBLIC_URL) || "https://gofarther.dev").replace(/\/+$/, "") + "/?share=" + id };
}
/** A shared guide as the shared-chat view reads it (one answer holding the guide), or null when `id` is not a guide's. */
export async function sharedGuide(bucket, id, viewer) {
  if (!/^guide-[0-9a-f]{16}$/.test(String(id || ""))) return null;
  const rec = await getJson(bucket, sharedKey(id), null);
  if (!rec || !rec.guide || rec.id !== id) return null;
  const gh = await getJson(bucket, "coder/" + rec.uid + "/github.json", null);
  const owner = gh && typeof gh.login === "string" && gh.login ? gh.login : "A Coder user";
  return { ok: true, shared: { id, title: rec.guide.name || "ONBOARDING.md", repo: rec.guide.repo || "", branch: "", base: "", at: Number(rec.guide.at) || 0, owner, mine: rec.uid === viewer, guide: true }, events: [{ type: "done", text: String(rec.guide.text || "") }] };
}

/**
 * THE MACHINE'S QUESTIONS (coder-envapi.mjs, after its pass is checked): body.action of plugins_list, plugins_search,
 * plugins_install, skills_owner, skills_catalog, guide_share. null for any other action.
 */
export async function pluginsApi(env, bucket, uid, meta, body) {
  const a = String((body && body.action) || "");
  if (a === "plugins_list") {
    const mine = await readPlugins(bucket, uid);
    const q = keywordsQuery(body);
    return { ok: true, plugins: (q.trim() ? searchRows(mine, q, pluginText) : mine).map((p) => pluginOut(p, true)) };
  }
  if (a === "plugins_search") {
    const mine = await readPlugins(bucket, uid), names = new Set(mine.map((p) => p.name));
    const all = [...mine, ...PLUGIN_CATALOG.filter((p) => !names.has(p.name))];
    // (The owner's marketplaces' plugins too, named plugin@marketplace, as Claude Code names them.)
    const fromMarkets = [];
    for (const mk of await readMarketplaces(bucket, uid)) for (const p of mk.plugins) if (!mine.some((x) => x.name === p.name && x.marketplace === mk.name)) fromMarkets.push({ name: p.name + "@" + mk.name, description: p.description || "Plugin " + p.name, category: p.category || "", contents: "from the " + mk.name + " marketplace", skills: [], commands: [], agents: [], hooks: [], connectors: [], installed: false });
    const q = keywordsQuery(body);
    const hits = [...searchRows(all, q, pluginText).map((p) => pluginOut(p, names.has(p.name))), ...searchRows(fromMarkets, q, (p) => p.description + " " + p.category + " " + p.contents)];
    return { ok: true, plugins: hits.slice(0, q.trim() ? 10 : 200) };
  }
  // (A marketplace plugin is installed on the Plugins page, after Claude Code's trust warning: plugins/security.md.)
  if (a === "plugins_install") { const m = /^([^@]+)@(.+)$/.exec(String(body.name || "")); return m ? installFromMarketplace(bucket, uid, m[1], m[2], { accepted: body.accepted === true }) : installPlugin(bucket, uid, body.name); }
  if (a === "skills_owner") return { ok: true, skills: await ownerSkills(bucket, uid) };
  if (a === "skills_catalog") {
    const have = new Set((await readSavedSkills(bucket, uid)).map((s) => s.name.toLowerCase()));
    return { ok: true, skills: SKILL_CATALOG.map((s) => ({ name: s.name, description: s.description, saved: have.has(s.name) })) };
  }
  if (a === "feedback_queue") return queueFeedback(bucket, uid, body, String((meta && meta.branch) || ""));
  if (a === "guide_share") return shareGuide(env, bucket, uid, { ...body, repo: meta && meta.repo });
  return null;
}

/**
 * THE PAGE'S ROUTES (signed in): GET /plugins → { installed, catalog }; POST /plugins { name } installs; DELETE
 * /plugins/<name> removes. GET /owner-skills → { saved, plugin, catalog }; POST /owner-skills { name, description, body } or
 * { name } (a catalog skill) saves; DELETE /owner-skills/<name> removes. null when the path is not one of these.
 */
export async function handlePluginRoutes(request, bucket, uid, parts, { fetchFn = fetch, env = null } = {}) {
  if (parts[0] !== "plugins" && parts[0] !== "owner-skills" && parts[0] !== "feedback") return null;
  if (!bucket) return json({ error: "storage is not available" }, 503);
  const m = request.method;
  // (Claude Code's /feedback queue: GET lists the drafts, newest first; DELETE /feedback/<id> discards one.)
  if (parts[0] === "feedback") {
    if (parts.length === 1 && m === "GET") return json({ ok: true, drafts: (await readFeedback(bucket, uid)).reverse(), off: await feedbackOff(bucket, uid) });
    // (Turning Claude-drafted feedback off, or back on: Claude Code asks after a dismissal.)
    if (parts.length === 2 && parts[1] === "settings" && m === "POST") { let b = {}; try { b = await request.json(); } catch { b = {}; } await putJson(bucket, feedbackSettingsKey(uid), { off: b.off === true }); return json({ ok: true, off: b.off === true }); }
    if (parts.length === 2 && m === "DELETE") { const r = await removeFeedback(bucket, uid, decodeURIComponent(parts[1])); return json(r, r.ok ? 200 : 404); }
    // (Send: POST /feedback/<id>/send { transcript, project, model }: the chat's events are read here only when transcript is yes.)
    if (parts.length === 3 && parts[2] === "send" && m === "POST") {
      let b = {}; try { b = await request.json(); } catch { b = {}; }
      const pid = typeof b.project === "string" && /^[a-z0-9][a-z0-9-]{2,40}$/.test(b.project) ? b.project : "";
      const events = b.transcript === true && pid ? await getJson(bucket, "coder/" + uid + "/" + pid + "/events.json", []) : null;
      const r = await sendFeedback(bucket, uid, decodeURIComponent(parts[1]), { transcript: b.transcript === true, events, model: b.model, ua: request.headers.get("user-agent") || "" });
      if (r.ok && pid) await saveCardState(bucket, uid, pid, decodeURIComponent(parts[1]), { sent: true, receipt: r.receipt });
      return json(r, r.ok ? 200 : 404);
    }
    // (The card's state, saved with the chat: POST /feedback/<id>/state { project, dismissed?, review? }; read back with the chat.)
    if (parts.length === 3 && parts[2] === "state" && m === "POST") {
      let b = {}; try { b = await request.json(); } catch { b = {}; }
      const pid = typeof b.project === "string" && /^[a-z0-9][a-z0-9-]{2,40}$/.test(b.project) ? b.project : "";
      if (!pid) return json({ error: "give the chat" }, 400);
      const want = {};
      if (b.dismissed === true) want.dismissed = true;
      if (typeof b.review === "boolean") want.review = b.review;
      const r = await saveCardState(bucket, uid, pid, decodeURIComponent(parts[1]), want);
      return json(r, r.ok ? 200 : 400);
    }
    return json({ error: "method" }, 405);
  }
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  if (parts[0] === "plugins") {
    if (parts.length === 1 && m === "GET") {
      const mine = await readPlugins(bucket, uid), names = new Set(mine.filter((p) => !p.marketplace).map((p) => p.name));
      const secrets = env ? await readPluginSecrets(env, bucket, uid) : {};
      const order = loadOrder(mine);
      const markets = (await readMarketplaces(bucket, uid)).map((mk) => ({ name: mk.name, owner: mk.owner, source: mk.source, tier: tierOf(mk.name), autoUpdate: autoUpdateOf(mk), ...(mk.lastUpdated ? { lastUpdated: mk.lastUpdated } : {}), plugins: mk.plugins.map((p) => ({ name: p.name, description: p.description, category: p.category, ...(p.version ? { version: p.version } : {}), ...(p.homepage ? { homepage: p.homepage } : {}), installed: mine.some((x) => x.name === p.name && x.marketplace === mk.name) })) }));
      return json({ ok: true, trustWarning: TRUST_WARNING, installed: order.map((p) => ({ ...pluginOut(p, true, Object.keys(secrets[pluginId(p)] || {})), ...(p.notLoaded ? { notLoaded: p.notLoaded } : {}), ...(p.hooksLeftOut ? { hooksLeftOut: p.hooksLeftOut } : {}) })), catalog: PLUGIN_CATALOG.map((p) => pluginOut(p, names.has(p.name))), marketplaces: markets });
    }
    // (Marketplaces: POST /plugins/marketplaces { source } adds one by its Git URL; POST …/<name>/refresh reads it again; POST
    // …/<name>/auto { on } is its auto-update switch; DELETE /plugins/marketplaces/<name> removes it and its plugins.)
    if (parts[1] === "marketplaces") {
      if (parts.length === 2 && m === "POST") { const r = await addMarketplace(bucket, uid, (await body()).source, { fetchFn }); return json(r, r.ok ? 200 : 400); }
      if (parts.length === 4 && parts[3] === "refresh" && m === "POST") { const r = await refreshMarketplace(bucket, uid, decodeURIComponent(parts[2]), { fetchFn }); return json(r, r.ok ? 200 : 400); }
      if (parts.length === 4 && parts[3] === "auto" && m === "POST") { const r = await setMarketplaceAutoUpdate(bucket, uid, decodeURIComponent(parts[2]), (await body()).on === true); return json(r, r.ok ? 200 : 404); }
      if (parts.length === 3 && m === "DELETE") { const r = await removeMarketplace(bucket, uid, decodeURIComponent(parts[2]), env); return json(r, r.ok ? 200 : 404); }
      return json({ error: "method" }, 405);
    }
    if (parts.length === 1 && m === "POST") { const b = await body(); { const at = /^([^@]+)@(.+)$/.exec(String(b.name || "")); if (at && !b.marketplace) { b.name = at[1]; b.marketplace = at[2]; } } const r = b.marketplace ? await installFromMarketplace(bucket, uid, b.name, b.marketplace, { fetchFn, accepted: b.accepted === true }) : await installPlugin(bucket, uid, b.name); return json(r, r.ok ? 200 : 400); }
    // (One installed plugin, by its id (name@marketplace, or a catalog plugin's name): update, its on/off switch, its settings.)
    if (parts.length === 3 && m === "POST") {
      const id = decodeURIComponent(parts[1]);
      if (parts[2] === "update") { const r = await updatePlugin(bucket, uid, id, { fetchFn }); return json(r, r.ok ? 200 : 400); }
      if (parts[2] === "enabled") { const r = await setPluginEnabled(bucket, uid, id, (await body()).enabled === true); return json(r, r.ok ? 200 : 404); }
      if (parts[2] === "config") { if (!env) return json({ error: "settings are not available" }, 503); const r = await setPluginConfig(env, bucket, uid, id, (await body()).values); return json(r, r.ok ? 200 : 400); }
    }
    if (parts.length === 2 && m === "DELETE") { const r = await removePlugin(bucket, uid, decodeURIComponent(parts[1]), env); return json(r, r.ok ? 200 : 404); }
    return json({ error: "method" }, 405);
  }
  if (parts.length === 1 && m === "GET") {
    const saved = await readSavedSkills(bucket, uid), have = new Set(saved.map((s) => s.name.toLowerCase()));
    const plugin = (await ownerSkills(bucket, uid)).filter((s) => s.source !== "saved").map(({ body: _b, ...s }) => s);
    return json({ ok: true, saved: saved.map(({ body: _b, ...s }) => s), plugin, catalog: SKILL_CATALOG.map((s) => ({ name: s.name, description: s.description, saved: have.has(s.name) })) });
  }
  if (parts.length === 1 && m === "POST") {
    const b = await body();
    const fromCatalog = !b.body && !b.instructions ? SKILL_CATALOG.find((s) => s.name === String(b.name || "")) : null;
    const r = await saveSkill(bucket, uid, fromCatalog || b);
    return json(r, r.ok ? 200 : 400);
  }
  if (parts.length === 2 && m === "DELETE") { const r = await removeSkill(bucket, uid, decodeURIComponent(parts[1])); return json(r, r.ok ? 200 : 404); }
  return json({ error: "method" }, 405);
}
