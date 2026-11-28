// CLAUDE CODE'S PLUGIN, SKILL AND ONBOARDING TOOLS IN CODER (the owner, 2026-11-23: "every Claude Code tool, none skipped"):
// ListPlugins, SearchPlugins, SuggestPluginInstall, ListSkills, SearchSkills, SuggestSkills, propose_skills,
// ShareOnboardingGuide and ShowOnboardingRolePicker (container/coder-plugins.mjs, src/coder-plugins.mjs, public/coder-plugins.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, statSync, readFileSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as W from "../src/coder-plugins.mjs";
import * as C from "../container/coder-plugins.mjs";
import { CODER_TOOLS, GITHUB_TOOLS, runCoder } from "../container/coder-agent.mjs";
import { DEFERRED_TOOLS, SEARCH_HINTS } from "../container/coder-toolsearch.mjs";
import { CC_TOOL } from "../container/coder-hooks.mjs";

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

function fakeBucket() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
  };
}
const req = (method, body) => new Request("https://x.test/api/coder/plugins", { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });

test("tools: all nine offered in Coder's chats, none from GitHub; four upfront, five held back with hints; Claude Code's names", () => {
  const names = CODER_TOOLS.map((t) => t.function.name);
  for (const n of C.PLUGIN_TOOL_NAMES) { assert.ok(names.includes(n), n); assert.ok(!GITHUB_TOOLS.some((t) => t.function.name === n), n); }
  assert.deepEqual([...C.PLUGIN_DEFERRED].sort(), ["list_plugins", "list_skills", "propose_skills", "search_skills", "share_onboarding_guide"]);
  for (const n of C.PLUGIN_DEFERRED) { assert.ok(DEFERRED_TOOLS.includes(n), n); assert.ok(SEARCH_HINTS[n], n); }
  for (const n of ["search_plugins", "suggest_plugin_install", "suggest_skills", "show_onboarding_role_picker"]) assert.ok(!DEFERRED_TOOLS.includes(n), n);
  assert.equal(CC_TOOL.search_plugins, "SearchPlugins");
  assert.equal(CC_TOOL.suggest_plugin_install, "SuggestPluginInstall");
  assert.equal(CC_TOOL.share_onboarding_guide, "ShareOnboardingGuide");
  assert.equal(CC_TOOL.show_onboarding_role_picker, "ShowOnboardingRolePicker");
  assert.equal(CC_TOOL.propose_skills, "propose_skills");
  // (The tool-search module stays free of Node modules: the Worker loads it.)
  assert.doesNotMatch(read("container/coder-plugin-names.mjs"), /from "node:/);
  assert.match(read("container/Dockerfile"), / coder-plugins\.mjs coder-plugin-names\.mjs /);
});

test("Worker: install keeps the plugin and adds its connectors (not signed in); again is a no-op; remove takes back the unsigned ones", async () => {
  const b = fakeBucket();
  assert.match((await W.installPlugin(b, "u1", "nope")).error, /No plugin called "nope"/);
  const r = await W.installPlugin(b, "u1", "database", { now: 5 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ["Neon", "Supabase"]);
  assert.match(r.plugin.contents, /1 skill, Neon and Supabase connectors/);
  const conns = JSON.parse(b.m.get("connectors/u1.json"));
  assert.deepEqual(conns.map((c) => [c.name, c.status, c.fromPlugin]), [["Neon", "auth", "database"], ["Supabase", "auth", "database"]]);
  assert.equal((await W.installPlugin(b, "u1", "database")).already, true);
  assert.equal((await W.readPlugins(b, "u1")).length, 1);
  // (A connector the owner signed in to stays when the plugin goes.)
  conns[0].status = "ok"; b.m.set("connectors/u1.json", JSON.stringify(conns));
  assert.equal((await W.removePlugin(b, "u1", "database")).ok, true);
  assert.deepEqual(JSON.parse(b.m.get("connectors/u1.json")).map((c) => c.name), ["Neon"]);
  assert.deepEqual(await W.readPlugins(b, "u1"), []);
  assert.match((await W.removePlugin(b, "u1", "database")).error, /No installed plugin/);
});

test("Worker: saved skills and plugins' skills (plugin:skill) are the owner's skills; names checked; catalog skills added by name", async () => {
  const b = fakeBucket();
  assert.match((await W.saveSkill(b, "u1", { name: "bad name!", body: "x" })).error, /needs a name/);
  assert.equal((await W.saveSkill(b, "u1", { name: "deploy-check", description: "Before deploys", instructions: "Run the tests." })).ok, true);
  await W.installPlugin(b, "u1", "docs-writer");
  const all = await W.ownerSkills(b, "u1");
  assert.deepEqual(all.map((s) => [s.name, s.source]), [["deploy-check", "saved"], ["docs-writer:write-docs", "plugin docs-writer"], ["docs-writer:changelog", "plugin docs-writer"]]);
  const res = await W.handlePluginRoutes(new Request("https://x.test/", { method: "POST", body: JSON.stringify({ name: "commit-messages" }) }), b, "u1", ["owner-skills"]);
  assert.equal(res.status, 200);
  const list = await (await W.handlePluginRoutes(new Request("https://x.test/"), b, "u1", ["owner-skills"])).json();
  assert.deepEqual(list.saved.map((s) => s.name), ["deploy-check", "commit-messages"]);
  assert.equal(list.catalog.find((s) => s.name === "commit-messages").saved, true);
  assert.deepEqual(list.plugin.map((s) => s.name), ["docs-writer:write-docs", "docs-writer:changelog"]);
  assert.equal(list.saved[0].body, undefined, "the list carries no instructions");
  assert.equal((await W.handlePluginRoutes(new Request("https://x.test/", { method: "DELETE" }), b, "u1", ["owner-skills", "deploy-check"])).status, 200);
  assert.deepEqual((await W.readSavedSkills(b, "u1")).map((s) => s.name), ["commit-messages"]);
  assert.equal(await W.handlePluginRoutes(new Request("https://x.test/"), b, "u1", ["projects"]), null);
});

test("Worker routes: GET /plugins (installed and catalog), POST installs, DELETE removes; the machine's questions", async () => {
  const b = fakeBucket();
  let r = await (await W.handlePluginRoutes(req("GET"), b, "u1", ["plugins"])).json();
  assert.deepEqual(r.installed, []);
  assert.ok(r.catalog.length >= 5 && r.catalog.every((p) => p.installed === false && p.contents));
  assert.equal((await W.handlePluginRoutes(req("POST", { name: "testing" }), b, "u1", ["plugins"])).status, 200);
  r = await (await W.handlePluginRoutes(req("GET"), b, "u1", ["plugins"])).json();
  assert.deepEqual(r.installed.map((p) => p.name), ["testing"]);
  assert.equal(r.catalog.find((p) => p.name === "testing").installed, true);
  assert.equal((await W.handlePluginRoutes(req("POST", { name: "zzz" }), b, "u1", ["plugins"])).status, 400);
  // (The machine's: plugins_list, plugins_search, plugins_install, skills_owner, skills_catalog, guide_share.)
  assert.deepEqual((await W.pluginsApi({}, b, "u1", {}, { action: "plugins_list" })).plugins.map((p) => p.name), ["testing"]);
  const s = await W.pluginsApi({}, b, "u1", {}, { action: "plugins_search", query: "sentry errors" });
  assert.equal(s.plugins[0].name, "monitoring");
  assert.equal((await W.pluginsApi({}, b, "u1", {}, { action: "plugins_search", query: "" })).plugins.find((p) => p.name === "testing").installed, true);
  assert.equal(await W.pluginsApi({}, b, "u1", {}, { action: "get" }), null);
  assert.equal((await W.handlePluginRoutes(new Request("https://x.test/", { method: "DELETE" }), b, "u1", ["plugins", "testing"])).status, 200);
  assert.match(read("src/coder-envapi.mjs"), /const p = await pluginsApi\(env, bucket, uid, meta, body\); if \(p\) return answer\(p\);/);
  assert.match(read("src/coder-routes.mjs"), /const p = await handlePluginRoutes\(request, bucket, uid, parts, \{ env \}\); if \(p\) return p;/);
});

test("Worker: an onboarding guide is shared under a new link and read through the shared view; a chat's id is not a guide's", async () => {
  const b = fakeBucket();
  b.m.set("coder/u1/github.json", JSON.stringify({ login: "ana" }));
  assert.match((await W.shareGuide({}, b, "u1", { text: "  " })).error, /empty/);
  const r = await W.pluginsApi({ CODER_PUBLIC_URL: "https://test.gofarther.dev/" }, b, "u1", { repo: "ana/shop" }, { action: "guide_share", name: "ONBOARDING.md", text: "# Welcome\n\nRun npm test." });
  assert.match(r.url, /^https:\/\/test\.gofarther\.dev\/\?share=guide-[0-9a-f]{16}$/);
  const g = await W.sharedGuide(b, r.id, "u2");
  assert.equal(g.shared.title, "ONBOARDING.md");
  assert.equal(g.shared.owner, "ana");
  assert.equal(g.shared.repo, "ana/shop");
  assert.equal(g.shared.mine, false);
  assert.deepEqual(g.events, [{ type: "done", text: "# Welcome\n\nRun npm test." }]);
  assert.equal(await W.sharedGuide(b, "abc123", "u2"), null);
  assert.equal(await W.sharedGuide(b, "guide-0000000000000000", "u2"), null);
});

test("machine: the owner's saved and plugins' skills join the repository's (whose names win) for the skill tool", () => {
  const repo = [{ name: "deploy", description: "d", body: "b", dir: "/r", model: true, user: true }];
  const out = C.withOwnerSkills(repo, [{ name: "deploy", body: "x" }, { name: "docs-writer:changelog", description: "Changelog", body: "Write it.", source: "plugin docs-writer" }, { name: "bad name", body: "x" }, null]);
  assert.deepEqual(out.map((s) => [s.name, s.source || "repo"]), [["deploy", "repo"], ["docs-writer:changelog", "plugin docs-writer"]]);
  assert.match(read("container/server.mjs"), /withOwnerSkills\(readSkills\(dir\), body\.ownerSkills\)/);
  assert.match(read("src/coder-routes.mjs"), /path === "\/turn" && body && typeof body === "object" && !body\.agent \? \{ \.\.\.body, ownerSkills: await ownerSkills\(bucket, uid\)/);
});

/** pluginTool with a stand-in Coder's server, cards and answers. */
function harness({ api = {}, answer = null, owner = null, root = "/nowhere", skills = [] } = {}) {
  const events = [], replies = [], calls = [];
  const ctx = (args) => ({
    args, id: "t1", root, skills,
    deps: { envApi: async (body) => { calls.push(body); const f = api[body.action]; return typeof f === "function" ? f(body) : f || { error: "error: no" }; } },
    emit: (e) => events.push(e), reply: (t) => replies.push(String(t)),
    canAsk: () => true,
    askQuestions: async (ev) => { events.push({ type: "question", ...ev }); return answer; },
    askOwner: async (card) => { events.push({ type: "permission", ...card }); return owner; },
    answerOutcome: (a) => (a.choice === "stop" ? "stop" : a.choice === "none" ? "no" : a.choice === "no" ? (a.comment ? "said" : "no") : "go"),
  });
  return { events, replies, calls, run: (name, args = {}) => C.pluginTool(name, ctx(args)) };
}
const catalogApi = async (body) => W.pluginsApi({}, fakeBucket(), "u1", {}, body);

test("search_plugins and list_plugins answer from Coder's server; suggest_plugin_install shows the card and goes on", async () => {
  const h = harness({ api: { plugins_search: catalogApi, plugins_list: { ok: true, plugins: [] } } });
  await h.run("search_plugins", { query: "database migrations" });
  assert.match(h.replies[0], /^Plugins matching "database migrations":\n- database: /);
  assert.match(h.replies[0], /Contains: 1 skill, Neon and Supabase connectors\./);
  await h.run("list_plugins");
  assert.match(h.replies[1], /no plugins installed/);
  await h.run("suggest_plugin_install", { plugins: ["database", "nope"], reason: "You asked about migrations." });
  const card = h.events.find((e) => e.type === "plugins_suggest");
  assert.deepEqual(card.plugins.map((p) => p.name), ["database"]);
  assert.equal(card.reason, "You asked about migrations.");
  assert.match(h.replies[2], /^ok: the owner now sees a card suggesting database \(Install, Not now\)\. Not in the catalog, left out: nope\. Carry on/);
  await h.run("suggest_plugin_install", { plugins: ["zzz"] });
  assert.match(h.replies[3], /^error: no plugin in the catalog/);
});

test("list_skills, search_skills, suggest_skills and propose_skills", async () => {
  const h = harness({ skills: [{ name: "deploy", description: "How we deploy" }, { name: "docs-writer:changelog", description: "Write a changelog", source: "plugin docs-writer" }], api: { skills_catalog: { ok: true, skills: W.SKILL_CATALOG.map((s) => ({ name: s.name, description: s.description, saved: s.name === "explain-code" })) } } });
  await h.run("list_skills");
  assert.equal(h.replies[0], "Skills you can load with the skill tool:\n- deploy [repository]: How we deploy\n- docs-writer:changelog [plugin docs-writer]: Write a changelog");
  await h.run("search_skills", { query: "commit changelog" });
  assert.match(h.replies[1], /Skills you can load now:\n- docs-writer:changelog/);
  assert.match(h.replies[1], /Skills the owner can add \(offer with suggest_skills\):\n- commit-messages: /);
  await h.run("suggest_skills", { skills: ["security-check", "nope"] });
  assert.deepEqual(h.events.find((e) => e.type === "skills_suggest").skills.map((s) => s.name), ["security-check"]);
  await h.run("propose_skills", { skills: [{ name: "bad name", description: "x", instructions: "y" }] });
  assert.match(h.replies[3], /^error: each skill needs a name/);
  await h.run("propose_skills", { skills: [{ name: "release-notes", description: "When releasing", instructions: "List the merged PRs." }] });
  assert.deepEqual(h.events.find((e) => e.type === "skills_propose").skills, [{ name: "release-notes", description: "When releasing", body: "List the merged PRs." }]);
  assert.equal(h.calls.filter((c) => c.action === "skills_owner").length, 0, "no extra server call per turn");
});

test("share_onboarding_guide: asks first; Yes uploads ONBOARDING.md and gives the link; No ends the turn; no file says so", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "guide-"));
  let h = harness({ root });
  await h.run("share_onboarding_guide");
  assert.match(h.replies[0], /there is no ONBOARDING\.md/);
  mkdirSync(path.join(root, "docs"));
  writeFileSync(path.join(root, "docs", "ONBOARDING.md"), "# Hi\n");
  h = harness({ root, owner: { choice: "yes" }, api: { guide_share: (b) => ({ ok: true, url: "https://gofarther.dev/?share=guide-0123456789abcdef", seen: b }) } });
  assert.equal(await h.run("share_onboarding_guide"), "");
  const card = h.events.find((e) => e.type === "permission");
  assert.match(card.what, /^Share docs\/ONBOARDING\.md as a link/);
  assert.deepEqual(h.calls.find((c) => c.action === "guide_share"), { action: "guide_share", name: "ONBOARDING.md", text: "# Hi\n" });
  assert.ok(h.events.some((e) => e.type === "guide_shared" && e.url.endsWith("guide-0123456789abcdef")));
  assert.match(h.replies[0], /^Shared docs\/ONBOARDING\.md: https:\/\/gofarther\.dev\/\?share=guide-/);
  h = harness({ root, owner: { choice: "no" } });
  assert.equal(await h.run("share_onboarding_guide"), "no");
  assert.equal(h.calls.length, 0);
  h = harness({ root, owner: { choice: "stop" } });
  assert.equal(await h.run("share_onboarding_guide"), "stop");
});

test("show_onboarding_role_picker: waits for the pick, installs its plugin, returns { role }; typed, skipped", async () => {
  let h = harness({ answer: { choice: "answers", picks: [{ options: [1], other: "" }] }, api: { plugins_install: (b) => W.installPlugin(fakeBucket(), "u1", b.name) } });
  await h.run("show_onboarding_role_picker");
  const q = h.events.find((e) => e.type === "question");
  assert.equal(q.kind, "role_picker");
  assert.deepEqual(q.questions[0].options.map((o) => o.label), ["Frontend", "Backend", "Full-stack", "DevOps"]);
  assert.deepEqual(h.calls, [{ action: "plugins_install", name: "database" }]);
  assert.match(h.replies[0], /^\{"role":"Backend","installed":"database"\}\nThe database plugin is installed/);
  h = harness({ answer: { choice: "answers", picks: [{ options: [], other: "Data scientist" }] } });
  await h.run("show_onboarding_role_picker");
  assert.match(h.replies[0], /^\{"role":"Data scientist"\}/);
  h = harness({ answer: { choice: "skip" } });
  await h.run("show_onboarding_role_picker");
  assert.equal(h.replies[0], '{"dismissed":true}');
});

test("in Coder's loop: search_plugins reaches Coder's server and its answer goes back to Grok", async () => {
  const call = (name, args) => ({ id: "s1", type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const turns = [say("", [call("search_plugins", { keywords: ["review"] })]), say("The code-review plugin fits.")];
  const seen = [], events = [], api = []; let n = 0;
  await runCoder({ send: async (q) => { seen.push(q); return turns[n++]; }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), envApi: async (b) => { api.push(b); return catalogApi(b); } }, { text: "Any plugins for reviews?" });
  assert.deepEqual(api, [{ action: "plugins_search", keywords: ["review"] }]);
  assert.ok(seen[0].tools.some((t) => t.function.name === "search_plugins"));
  assert.ok(!seen[0].tools.some((t) => t.function.name === "list_plugins"), "list_plugins is held back");
  assert.match(String(seen[1].messages.filter((m) => m.role === "tool").pop().content), /- code-review: /);
  assert.ok(events.some((e) => e.type === "bash" && e.tool === "search_plugins"));
});

async function openPage(browser, { events = [], width = 1000 } = {}) {
  const at = Date.now();
  const project = () => ({ id: "c1", title: "Onboarding", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "acceptEdits", turn: 1, at, marks: [] });
  let installed = [];
  const saved = [];
  const posts = [];
  const catalog = W.PLUGIN_CATALOG.map((p) => W.pluginOut(p, false));
  const api = (m, p, body) => {
    if (m !== "GET") posts.push([m, p, body]);
    if (p === "/api/coder/plugins" && m === "POST") { const n = JSON.parse(body).name; installed.push(n); return [200, { ok: true, plugin: { name: n }, added: n === "database" ? ["Neon", "Supabase"] : [] }]; }
    if (p.startsWith("/api/coder/plugins/") && m === "DELETE") { installed = installed.filter((x) => x !== decodeURIComponent(p.split("/").pop())); return [200, { ok: true }]; }
    if (p === "/api/coder/plugins") return [200, { ok: true, installed: catalog.filter((x) => installed.includes(x.name)).map((x) => ({ ...x, installed: true })), catalog: catalog.map((x) => ({ ...x, installed: installed.includes(x.name) })) }];
    if (p === "/api/coder/owner-skills" && m === "POST") { saved.push(JSON.parse(body)); return [200, { ok: true }]; }
    if (p === "/api/coder/owner-skills") return [200, { ok: true, saved: saved.filter((s) => s.description).map((s) => ({ name: s.name, description: s.description })), plugin: [{ name: "docs-writer:changelog", description: "Write a changelog entry", source: "plugin docs-writer" }], catalog: W.SKILL_CATALOG.map((s) => ({ name: s.name, description: s.description, saved: saved.some((x) => x.name === s.name) })) }];
    if (p === "/api/coder/projects/c1/answer") return [200, { ok: true }];
    return [200, { "GET /api/coder/github": { connected: true, login: "ana" }, "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events, queue: [] }, "GET /api/coder/projects/c1/state": { running: true, events: [], next: events.length, project: project() },
      "GET /api/coder/settings": { prefs: {} }, "GET /api/coder/connectors": { connectors: [], catalog: [] } }[m + " " + p] || {}];
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, serviceWorkers: "block", colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://gofarther.test/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) { const [status, data] = api(route.request().method(), u.pathname, route.request().postData()); return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) }); }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto("https://gofarther.test/", { waitUntil: "domcontentloaded" });
  return { page, errors, posts, saved };
}

test("page in Chromium: the cards (plugins, skills, proposed skills, shared guide, role picker) and their buttons", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    const events = [
      { type: "user", text: "Set me up, and suggest what would help with our database work", at: at - 9000 },
      { type: "plugins_suggest", id: "t1", reason: "You work on database migrations.", plugins: [{ name: "database", description: W.PLUGIN_CATALOG[3].description, contents: W.contentsOf(W.PLUGIN_CATALOG[3]), installed: false }, { name: "code-review", description: W.PLUGIN_CATALOG[0].description, contents: W.contentsOf(W.PLUGIN_CATALOG[0]), installed: false }], at: at - 8000 },
      { type: "skills_suggest", id: "t2", reason: "Clear commit messages help your team.", skills: [{ name: "commit-messages", description: W.SKILL_CATALOG[0].description, saved: false }], at: at - 7000 },
      { type: "skills_propose", id: "t3", skills: [{ name: "release-notes", description: "Write release notes from merged pull requests.", body: "List the pull requests merged since the last tag, group them, and write short notes." }], at: at - 6000 },
      { type: "guide_shared", id: "t4", name: "ONBOARDING.md", url: "https://gofarther.dev/?share=guide-0123456789abcdef", at: at - 5000 },
      { type: "question", pid: "p1abcdef", kind: "role_picker", questions: [{ question: "What kind of work do you do?", header: "Your role", options: C.ROLE_OPTIONS.map((r) => ({ label: r.label, description: r.description })), multiSelect: false }], at: at - 4000 },
    ];
    const { page, errors, posts, saved } = await openPage(browser, { events });
    await page.waitForSelector("#gfApp .cpx-card .cpx-row", { timeout: 15000 });
    const cards = page.locator("#gfApp .cpx-card");
    assert.deepEqual(await cards.locator(".cpx-head b").allInnerTexts(), ["Suggested plugins", "Suggested skills", "Proposed skills", "Onboarding guide shared", "What kind of work do you do?"]);
    if (SHOTS) await cards.nth(0).screenshot({ path: path.join(SHOTS, "card-suggested-plugins.png") });
    // Install: Coder's Worker installs it, and the card says so.
    await cards.nth(0).locator('[data-cpx="install"][data-cpx-name="database"]').click();
    await page.waitForFunction(() => /database is installed for all your chats\. Sign in to Neon and Supabase in Connectors\./.test((document.querySelector("#gfApp .cpx-card .cpx-note") || {}).textContent || ""));
    assert.deepEqual(posts.find((x) => x[1] === "/api/coder/plugins").slice(0, 3), ["POST", "/api/coder/plugins", '{"name":"database"}']);
    assert.equal(await cards.nth(0).locator(".cpx-on").innerText(), "Installed");
    if (SHOTS) await cards.nth(0).screenshot({ path: path.join(SHOTS, "card-plugin-installed.png") });
    // Not now closes the card's buttons.
    await cards.nth(0).locator('[data-cpx="close"]').click();
    assert.equal(await cards.nth(0).locator('[data-cpx="install"]').count(), 0);
    // Add a suggested skill.
    if (SHOTS) await cards.nth(1).screenshot({ path: path.join(SHOTS, "card-suggested-skills.png") });
    await cards.nth(1).locator('[data-cpx="add-skill"]').click();
    await page.waitForFunction(() => /commit-messages is added/.test(document.querySelectorAll("#gfApp .cpx-card")[1].textContent));
    assert.deepEqual(saved[0], { name: "commit-messages" });
    // Review and save a proposed skill (its instructions go with it).
    await cards.nth(2).locator('[data-cpx="show"]').click();
    assert.match(await cards.nth(2).locator(".cpx-body").innerText(), /List the pull requests merged/);
    if (SHOTS) await cards.nth(2).screenshot({ path: path.join(SHOTS, "card-proposed-skills.png") });
    await cards.nth(2).locator('[data-cpx="save-skill"]').click();
    await page.waitForFunction(() => /release-notes is saved/.test(document.querySelectorAll("#gfApp .cpx-card")[2].textContent));
    assert.deepEqual(saved[1], { name: "release-notes", description: "Write release notes from merged pull requests.", body: "List the pull requests merged since the last tag, group them, and write short notes." });
    if (SHOTS) await cards.nth(3).screenshot({ path: path.join(SHOTS, "card-guide-shared.png") });
    assert.equal(await cards.nth(3).locator("a").getAttribute("href"), "https://gofarther.dev/?share=guide-0123456789abcdef");
    // The role picker: chips while Coder waits; a chip sends the pick to the waiting step.
    const roles = cards.nth(4);
    assert.deepEqual(await roles.locator(".cpx-chip").allInnerTexts(), ["Frontend", "Backend", "Full-stack", "DevOps"]);
    if (SHOTS) await page.locator("#gfApp .cpx-roles").screenshot({ path: path.join(SHOTS, "card-role-picker.png") });
    await roles.locator('.cpx-chip[data-cpx-k="1"]').click();
    await page.waitForFunction(() => document.querySelector("#gfApp .cpx-roles .cpx-chip").disabled);
    const ans = posts.find((x) => x[1] === "/api/coder/projects/c1/answer");
    assert.deepEqual(JSON.parse(ans[2]), { pid: "p1abcdef", choice: "answers", answers: [{ options: [1], other: "" }] });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("page in Chromium: the sidebar's Plugins ▸ Plugins panel (install, remove, search) and Skills (all kinds)", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors, posts } = await openPage(browser, { events: [{ type: "user", text: "hi" }, { type: "skills", list: [{ name: "deploy", description: "How we deploy the shop" }] }, { type: "done", text: "Hello." }] });
    await page.waitForSelector("#cdSidePlugins:not([disabled])", { timeout: 15000 });
    await page.click("#cdSidePlugins");
    // (The owner's approved side menu, 2026-11-24: the plugin parts only, each with a "!" note.)
    const order = await page.$$eval(".gf-sub .gf-sname", (b) => b.map((x) => x.textContent));
    assert.deepEqual(order, ["Installed plugins", "Skills", "Commands", "Helpers", "Hooks", "Connectors"]);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "sidebar-plugins-menu.png") });
    await page.click("#cdSidePluginsList .gf-sname");
    await page.waitForSelector(".cpx-panel .cpx-empty");
    assert.match(await page.textContent(".cpx-panel"), /No plugins installed yet/);
    await page.click('.cpx-panel [data-pp-tab="catalog"]');
    await page.waitForSelector('.cpx-panel [data-pp="install"][data-pp-name="frontend"]');
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "panel-plugins-discover.png") });
    await page.click('.cpx-panel [data-pp="install"][data-pp-name="frontend"]');
    await page.waitForFunction(() => /frontend is installed\./.test(document.querySelector(".cpx-panel").textContent));
    await page.fill(".cpx-panel .cpx-q", "sentry");
    assert.deepEqual(await page.$$eval(".cpx-panel .cpx-prow b", (b) => b.map((x) => x.textContent)), ["monitoring"]);
    await page.click('.cpx-panel [data-pp-tab="installed"]');
    await page.fill(".cpx-panel .cpx-q", "");
    await page.waitForSelector('.cpx-panel [data-pp="remove"][data-pp-name="frontend"]');
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "panel-plugins-installed.png") });
    await page.click('.cpx-panel [data-pp="remove"][data-pp-name="frontend"]');
    await page.waitForFunction(() => /frontend is removed\./.test(document.querySelector(".cpx-panel").textContent));
    assert.ok(posts.some((x) => x[0] === "DELETE" && x[1] === "/api/coder/plugins/frontend"));
    await page.click('.cpx-panel [data-pp="done"]');
    // Skills: the repository's, saved, plugins' and ones to add.
    await page.click("#cdSideSkills .gf-sname");
    await page.waitForSelector(".cpx-panel [data-sk='add']");
    const txt = await page.textContent(".cpx-panel");
    assert.match(txt, /This repository[\s\S]*\/deploy[\s\S]*How we deploy the shop[\s\S]*Your saved skills[\s\S]*From your plugins[\s\S]*docs-writer:changelog[\s\S]*Skills you can add[\s\S]*commit-messages/);
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "panel-skills.png") });
    await page.click(".cpx-panel [data-sk='add'][data-sk-name='security-check']");
    await page.waitForFunction(() => /security-check is added/.test(document.querySelector(".cpx-panel").textContent));
    await page.click(".cpx-panel .cd-notify-done");
    assert.equal(await page.$(".cpx-panel"), null);
    // DARK (2026-11-23, second pass): both panels take the chat cards' dark colours.
    await page.emulateMedia({ colorScheme: "dark" });
    if (!(await page.$("#cdSidePluginsList"))) await page.click("#cdSidePlugins");
    await page.click("#cdSidePluginsList .gf-sname");
    await page.click('.cpx-panel [data-pp-tab="catalog"]');
    await page.waitForSelector('.cpx-panel [data-pp="install"][data-pp-name="frontend"]');
    assert.equal(await page.$eval(".cpx-panel", (el) => getComputedStyle(el).backgroundColor), "rgb(38, 38, 36)");
    assert.equal(await page.$eval(".cpx-panel .cpx-btn", (el) => getComputedStyle(el).backgroundColor), "rgb(47, 46, 43)");
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "p2-panel-plugins-dark.png") });
    await page.click('.cpx-panel [data-pp="done"]');
    await page.click("#cdSideSkills .gf-sname");
    await page.waitForSelector(".cpx-panel [data-sk='add']");
    assert.equal(await page.$eval(".cpx-panel", (el) => getComputedStyle(el).backgroundColor), "rgb(38, 38, 36)");
    if (SHOTS) await page.locator(".cpx-panel").screenshot({ path: path.join(SHOTS, "p2-panel-skills-dark.png") });
    await page.click(".cpx-panel .cd-notify-done");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
