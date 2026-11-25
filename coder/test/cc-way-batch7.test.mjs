// "GO CLAUDE CODE WAY", BATCH 7 (2026-11-22): the items of this batch Coder now does as Claude Code does, each with the case
// that failed before it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, realpath } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = await import("../container/server.mjs");
const A = await import("../container/coder-agent.mjs");
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/shop-b7";

/** One message on a pretend machine: what Grok was offered and told, the cards, the commands run. */
async function job(steps, { mode = "auto", answers = [], ...opts } = {}) {
  const events = [], cards = [], ran = [], sent = [];
  let n = 0, a = 0;
  const r = await A.runCoder({
    send: async (req) => { sent.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { if (/coder-tools\.mjs|--porcelain=v1/.test(String(x.command))) return { code: 0, output: "" }; ran.push(x); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-b7",
    where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[a++] || { choice: "no" }; },
  }, { text: "go", mode, rules: { allow: [], ask: [], deny: [] }, ...opts });
  const told = (id) => { const m = r.messages.find((x) => x.role === "tool" && x.tool_call_id === id); return m ? String(m.content) : ""; };
  return { r, events, cards, ran, sent, told };
}
const offered = (req, tool) => (req.tools || []).find((t) => t.function && t.function.name === tool);

// ── M-b-08: LIMITED IS A FIXED LIST, AS IN CLAUDE CODE'S CLOUD ───────────────────────────────────────────────────────
test("M-b-08 on Limited network the environment's list is fixed, as in Claude Code's cloud: the machine never turns per-command hosts on, bash is not offered allowed_domains, and Auto refuses a list in plain words; None and Full as before", async () => {
  assert.equal(S.hostListsFor("limited"), "fixed");
  assert.equal(S.hostListsFor("trusted"), "fixed");
  assert.equal(S.hostListsFor("none"), "none");
  assert.equal(S.hostListsFor("full"), null);
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /hostLists: hostListsFor\(nn\.mode\), /, "the machine passes the fixed list, never \"on\"");
  assert.doesNotMatch(src, /a command can name the hosts it needs beyond this list in its allowed_domains/, "Coder is no longer told it can widen the list");
  const npm = (id = "b1") => say("", [call("bash", { command: "npm install left-pad", description: "Install", allowed_domains: ["registry.npmjs.org"] }, id)]);
  const t = await job([npm(), say("ok")], { hostLists: "fixed", checker: true });
  assert.equal(offered(t.sent[0], "bash").function.parameters.properties.allowed_domains, undefined, "not offered");
  assert.equal(t.told("b1"), A.HOSTS_FIXED);
  assert.match(A.HOSTS_FIXED, /^allowed_domains is not available in this chat: on Limited network access, this chat's environment allows only the hosts on its list/);
  assert.equal(t.ran.length, 0);
  assert.equal(t.cards.length, 0);
  // (Before: with the gate up the machine passed "on", and the same list was opened for the command.)
  const before = await job([npm(), say("ok")], { hostLists: "on", checker: true });
  assert.ok(offered(before.sent[0], "bash").function.parameters.properties.allowed_domains, "the old way, kept switched off, still offered it");
  // Accept edits: ignored, as in any mode but Auto.
  const ae = await job([npm(), say("ok")], { mode: "acceptEdits", hostLists: "fixed", answers: [{ choice: "yes" }] });
  assert.notEqual(ae.told("b1"), A.HOSTS_FIXED);
});

// ── M-f-30: RULE AND INSTRUCTION FILES THAT ARE LINKS INSIDE THE PROJECT ──────────────────────────────────────────────
test("M-f-30 a rule file or a rules folder that is a link inside the project loads, as in Claude Code (\"The .claude/rules/ directory supports symlinks\"); CLAUDE.md may link to AGENTS.md; a link out of the project does not load and the chat says so; a loop is passed by; a Read deny rule on the target still holds", async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "coder-b7-links-")));
  const out = await realpath(await mkdtemp(join(tmpdir(), "coder-b7-out-")));
  await writeFile(join(dir, "AGENTS.md"), "Agents: use tabs.");
  await symlink("AGENTS.md", join(dir, "CLAUDE.md"));
  await mkdir(join(dir, ".claude", "rules"), { recursive: true });
  await mkdir(join(dir, "shared-rules", "deep"), { recursive: true });
  await writeFile(join(dir, "shared-rules", "style.md"), "Style: short lines.");
  await writeFile(join(dir, "shared-rules", "deep", "tests.md"), "Tests: one per fix.");
  await writeFile(join(dir, "docs.md"), "Docs: plain English.");
  await writeFile(join(dir, ".env"), "TOKEN=not-a-real-one");
  await writeFile(join(out, "secret.md"), "SECRET OUTSIDE");
  await symlink("../../shared-rules", join(dir, ".claude", "rules", "shared"));
  await symlink("../../docs.md", join(dir, ".claude", "rules", "docs.md"));
  await symlink(join(out, "secret.md"), join(dir, ".claude", "rules", "outside.md"));
  await symlink("..", join(dir, "shared-rules", "deep", "loop"));
  await symlink("../../.env", join(dir, ".claude", "rules", "env.md"));
  const withhold = (rel) => (rel === ".env" ? "a Read deny rule covers it" : "");
  const r = await S.repoInstructions(dir, { withhold });
  const names = r.notes.map((n) => n.name);
  assert.deepEqual(names, ["CLAUDE.md", ".claude/rules/docs.md", ".claude/rules/shared/deep/tests.md", ".claude/rules/shared/style.md"]);
  assert.equal(r.notes[0].text, "Agents: use tabs.", "CLAUDE.md read through its link to AGENTS.md, and AGENTS.md not read twice");
  assert.equal(r.notes.find((n) => n.name === ".claude/rules/docs.md").text, "Docs: plain English.");
  assert.ok(!JSON.stringify(r).includes("SECRET OUTSIDE"), "a link out of the project is never read");
  assert.ok(!JSON.stringify(r.notes).includes("not-a-real-one"), "a Read deny rule on the target holds through a link");
  assert.deepEqual(r.linkedOut, [".claude/rules/outside.md"]);
  assert.equal(r.rulesCut, undefined, "the loop was passed by, not counted to the guard");
  assert.equal(S.linkedOutNote(r.linkedOut), "Not loaded: this rule file links to a place outside the project: .claude/rules/outside.md. Claude Code treats such a link as an outside import, which loads only once you approve it, and Coder has no such approval.");
  // After a summary, the top file is read again through its link.
  assert.deepEqual(await S.topNotes(dir, [{ name: "CLAUDE.md", text: "old" }]), [{ name: "CLAUDE.md", text: "Agents: use tabs." }]);
  // A top file that links out of the project: not read (as before).
  const d2 = await realpath(await mkdtemp(join(tmpdir(), "coder-b7-links2-")));
  await symlink(join(out, "secret.md"), join(d2, "CODER.md"));
  assert.deepEqual((await S.repoInstructions(d2)).notes, []);
  // A subfolder's own CLAUDE.md that is a link inside it, found when a file there is touched.
  const d3 = await realpath(await mkdtemp(join(tmpdir(), "coder-b7-links3-")));
  await mkdir(join(d3, "pkg", "src"), { recursive: true });
  await writeFile(join(d3, "pkg", "NOTES.md"), "Pkg: build with make.");
  await symlink("NOTES.md", join(d3, "pkg", "CLAUDE.md"));
  await writeFile(join(d3, "pkg", "src", "a.js"), "x");
  assert.deepEqual(await S.folderNotes(d3, "pkg/src/a.js", new Set(), {}), ["— pkg/CLAUDE.md:\nPkg: build with make."]);
  // The machine says so at the job's start.
  assert.match(readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8"), /if \(ins\.linkedOut && ins\.linkedOut\.length\) t\.events\.push\(\{ at: Date\.now\(\), type: "note", text: linkedOutNote\(ins\.linkedOut\) \}\);/);
});

// ── MISS-62: /context, WHAT FILLS THE CONVERSATION ───────────────────────────────────────────────────────────────────
test("MISS-62 /context as Claude Code's: the machine counts what fills the conversation at each job's end by Claude Code's parts (System prompt, System tools, MCP tools, Memory files, Skills, Messages, Free space, Autocompact buffer), with the memory files by name; the Worker keeps it on the chat and /clear empties it; no AI call", async () => {
  const K = await import("../container/coder-compact.mjs");
  const R = await import("../src/coder-routes.mjs");
  const L = K.compactLimits({ contextWindow: 500_000, enabled: true });
  const msgs = [{ role: "user", content: "x".repeat(4000) }, { role: "assistant", content: "y".repeat(400) }, { role: "user", appNote: true, skillsList: "s", content: "z".repeat(800) }];
  const u = K.contextUsage({ system: "a".repeat(4000), tools: [{ type: "function", function: { name: "bash", description: "b".repeat(3960) } }], connectors: [{ name: "mcp__docs__search", description: "c".repeat(396) }], memory: [{ name: "Project (CLAUDE.md)", text: "m".repeat(2000) }, { name: "Auto memory", text: "" }], messages: msgs, limits: L, window: 500_000, model: "grok-4.7" });
  assert.deepEqual(u.parts.map((p) => p.name), ["System prompt", "System tools", "MCP tools", "Memory files", "Skills", "Messages", "Tool results"]);
  const by = Object.fromEntries(u.parts.map((p) => [p.name, p.tokens]));
  assert.equal(by["System prompt"], 1000);
  assert.ok(by["System tools"] > 990 && by["System tools"] < 1100);
  assert.ok(by["MCP tools"] > 100 && by["MCP tools"] < 140);
  assert.equal(by["Memory files"], 500);
  assert.equal(by.Skills, 200);
  assert.ok(by.Messages > 0);
  assert.equal(u.used, u.parts.reduce((n, p) => n + p.tokens, 0));
  assert.equal(u.buffer, 500_000 - L.threshold, "the room auto-compact keeps");
  assert.equal(u.free, 500_000 - u.buffer - u.used);
  assert.deepEqual(u.memory, [{ name: "Project (CLAUDE.md)", tokens: 500 }], "an empty file is not listed");
  assert.equal(u.connectors[0].name, "mcp__docs__search");
  assert.equal(u.level, "ok");
  // Near the limit: Claude Code's warning.
  const big = K.contextUsage({ messages: [{ role: "user", content: "x".repeat((L.threshold - 10_000) * 4) }], limits: L, window: 500_000 });
  assert.equal(big.level, "warn");
  assert.match(big.warning, /^Context left until auto-compact: \d+%$/);
  // A real job hands it back with its result (Coder's chats only), the instruction files and memory by name.
  const t = await job([say("done")], { mode: "acceptEdits", context: [{ key: "i:CLAUDE.md", text: "THE REPO'S OWN INSTRUCTIONS (CLAUDE.md)\nUse tabs." }, { key: "i:YOUR MEMORY FOR THIS REPO", text: "YOUR MEMORY FOR THIS REPO (empty so far)." }, { key: "s:cwd", text: "The working folder: /w" }] });
  assert.ok(t.r.context, "the job's result carries it");
  assert.deepEqual(t.r.context.memory.map((m) => m.name), ["Project (CLAUDE.md)", "Auto memory"]);
  assert.ok(t.r.context.parts.find((p) => p.name === "System tools").tokens > 0);
  assert.equal(t.sent.length, 1, "no extra AI call");
  // The Worker keeps it, checked, on the chat; /clear empties it.
  const kept = R.contextKept(t.r.context);
  assert.equal(kept.window, t.r.context.window);
  assert.deepEqual(kept.parts, t.r.context.parts);
  assert.equal(R.contextKept({ window: 0 }), null);
  assert.equal(R.contextKept("x"), null);
  assert.equal(R.contextKept({ ...t.r.context, parts: [{ name: "Messages", tokens: -5 }], level: "nope" }).parts[0].tokens, 0);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /usage: usageSummary\(s\.result\.usage, meta\.turn\), \.\.\.\(contextKept\(s\.result\.context\) \? \{ context: contextKept\(s\.result\.context\) \} : \{\}\),/);
  assert.match(routes, /const next = \{ \.\.\.fresh, marks: \[\], sessionClear: true, rewinding: null, context: null, goal: null, at: Date\.now\(\) \};/);
});

// The page: /context in the / list; typed, it shows the chat's breakdown as Claude Code's grid and list, with nothing sent.
import { createRequire } from "node:module";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
async function openChat(browser, project, events) {
  const ORIGIN = "https://gofarther.test";
  const st = { posts: [] };
  const api = (m, p) => ({
    "GET /api/coder/github": { connected: true, login: "ana" },
    "GET /api/coder/projects": { projects: [project] },
    ["GET /api/coder/projects/" + project.id]: { project, events, queue: [] },
    "GET /api/coder/settings": { prefs: {} },
  }[m + " " + p] || {});
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url()), m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) { if (m !== "GET") st.posts.push(m + " " + u.pathname); return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(m, u.pathname)) }); }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}
test("MISS-62 the page: /context shows the grid, the parts and the memory files, and sends nothing; before any answer it says when it will show", { skip: !chromium && "playwright not installed" }, async () => {
  const at = Date.now();
  const context = { model: "grok-4.7", window: 500000, used: 41200, parts: [{ name: "System prompt", tokens: 3300 }, { name: "System tools", tokens: 12400 }, { name: "MCP tools", tokens: 1200 }, { name: "Memory files", tokens: 2100 }, { name: "Skills", tokens: 0 }, { name: "Messages", tokens: 22200 }], free: 425800, buffer: 33000, memory: [{ name: "Project (CLAUDE.md)", tokens: 1800 }, { name: "Auto memory", tokens: 300 }], connectors: [{ name: "mcp__docs__search", tokens: 1200 }], level: "ok", warning: "" };
  const project = { id: "c1", title: "Shop fixes", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "acceptEdits", turn: 1, at, context };
  const events = [{ type: "user", text: "Fix the cart", at }, { type: "text", text: "Fixed the cart total.", at }, { type: "done", at }];
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openChat(browser, project, events);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.fill("#cdIn", "/context");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector(".cd-ctx", { timeout: 5000 });
    const text = await page.textContent(".cd-ctx");
    assert.match(text, /^Context Usage/);
    assert.match(text, /Grok 4\.7 · 41\.2k\/500k tokens \(8%\)/);
    for (const line of ["System prompt: 3.3k tokens (0.7%)", "System tools: 12.4k tokens (2.5%)", "MCP tools: 1.2k tokens (0.2%)", "Memory files: 2.1k tokens (0.4%)", "Messages: 22.2k tokens (4.4%)", "Free space: 426k (85%)", "Autocompact buffer: 33k tokens (6.6%)", "└ mcp__docs__search: 1.2k tokens", "└ Project (CLAUDE.md): 1.8k tokens", "└ Auto memory: 300 tokens"]) assert.ok(text.includes(line), line + " in " + text);
    assert.ok(!text.includes("Skills:"), "an empty part is left out");
    assert.equal(await page.$$eval(".cd-ctx-grid i", (l) => l.length), 100);
    assert.equal(await page.$$eval(".cd-ctx-grid .cd-ctx-buf", (l) => l.length), 7);
    assert.equal(await page.inputValue("#cdIn"), "", "the box empties");
    assert.deepEqual(st.posts, [], "nothing is sent: no AI call");
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "context.png"), fullPage: false });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const b2 = await chromium.launch();
  try {
    const { page } = await openChat(b2, { ...project, context: null }, events);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.fill("#cdIn", "/context");
    await page.press("#cdIn", "Enter");
    await page.waitForFunction(() => document.body.textContent.includes("No context usage yet: it shows after Coder's next answer."), null, { timeout: 5000 });
  } finally { await b2.close(); }
  const src = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(src, /\['\/context', 'Visualize current context usage as a colored grid'\]/);
});

// ── MISS-54: SHARE A CHAT BY ITS LINK ───────────────────────────────────────────────────────────────────────────────
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
test("MISS-54 a chat is shared as Claude Code's on a personal plan: Private (the start) or Public, where anyone signed in to Coder opens its link and sees the chat as it is then, read only, with the owner's GitHub name; Private again and the link stops working; nothing can be changed through it; deleting the chat takes the link away", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y,friend@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  const me = "user-1234567890abcdef", friend = "user-fedcba0987654321", id = "shop-b7s";
  await saveConnection(env, bucket, me, { access: "ghu_user" }, "ana");
  const k = (f) => "coder/" + me + "/" + id + "/" + f;
  await bucket.put(k("meta.json"), JSON.stringify({ id, title: "Fix the cart", repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, status: "idle" }));
  await bucket.put(k("events.json"), JSON.stringify([{ type: "user", text: "Fix the cart", at: 1 }, { type: "bash", id: "b1", verb: "Ran", command: "npm test", at: 2 }, { type: "done", text: "Fixed. The key was sk-ant-api03-" + "x".repeat(40), at: 3 }]));
  let who = { id: me, email: "me@x.y" };
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => who, container: () => ({ fetch: async () => Response.json({ ok: true }) }) };
  const go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const share = (visibility) => go("projects/" + id + "/share", { method: "POST", body: JSON.stringify({ visibility }) });
  // Private to start with: a friend's link finds nothing.
  who = { id: friend, email: "friend@x.y" };
  let r = await go("shared/" + id);
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, "This chat isn't shared: it is private, or it no longer exists.");
  // Only the owner can change it (the friend has no such chat).
  assert.equal((await share("public")).status, 404);
  who = { id: me, email: "me@x.y" };
  assert.equal((await share("everyone")).status, 400);
  r = await share("public");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).project.visibility, "public");
  // The friend opens it: the chat as it is, read only, the owner's GitHub name, keys hidden.
  who = { id: friend, email: "friend@x.y" };
  r = await go("shared/" + id);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.deepEqual(d.shared, { id, title: "Fix the cart", repo: "ana/shop", branch: "coder/" + id, base: "main", at: d.shared.at, owner: "ana", mine: false });
  assert.deepEqual(d.events.map((e) => e.type), ["user", "bash", "done"]);
  assert.ok(!JSON.stringify(d).includes("sk-ant-api03-"), "a key in the chat is hidden");
  // Nothing changes through it: the friend's own routes never reach the owner's chat.
  for (const [path, init] of [["projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "hi" }) }], ["projects/" + id, { method: "DELETE" }], ["projects/" + id + "/share", { method: "POST", body: JSON.stringify({ visibility: "private" }) }]]) assert.equal((await go(path, init)).status, 404, path);
  // Someone not let into Coder can't open it either.
  who = { id: "user-0000000000000000", email: "stranger@x.y" };
  assert.equal((await go("shared/" + id)).status, 403);
  // Private again: the link stops working.
  who = { id: me, email: "me@x.y" };
  assert.equal((await share("private")).status, 200);
  who = { id: friend, email: "friend@x.y" };
  assert.equal((await go("shared/" + id)).status, 404);
  // Public, then the chat deleted: its link goes with it.
  who = { id: me, email: "me@x.y" };
  await share("public");
  assert.ok(bucket.m.has("coder-shared/" + id + ".json"));
  assert.equal((await go("projects/" + id, { method: "DELETE" })).status, 200);
  assert.ok(!bucket.m.has("coder-shared/" + id + ".json"));
  who = { id: friend, email: "friend@x.y" };
  assert.equal((await go("shared/" + id)).status, 404);
  // A bad id.
  assert.equal((await go("shared/..%2F..%2Fx")).status, 404);
});

test("MISS-54 the page: Share in the chat's ▾ menu, Private or Public with Claude Code's warning and Copy link; the link opens the chat read only, with no message box and nothing to answer", { skip: !chromium && "playwright not installed" }, async () => {
  const at = Date.now();
  const project = { id: "c1", title: "Shop fixes", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "acceptEdits", turn: 1, at };
  const events = [{ type: "user", text: "Fix the cart", at }, { type: "bash", id: "b1", verb: "Ran", command: "npm test", at }, { type: "done", text: "Fixed the cart **total**.", at }];
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openChat(browser, project, events);
    await page.route("https://gofarther.test/api/coder/projects/c1/share", (route) => { st.posts.push("share " + route.request().postData()); return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, visibility: JSON.parse(route.request().postData()).visibility, project: { ...project, visibility: JSON.parse(route.request().postData()).visibility } }) }); });
    await page.waitForSelector("#cdTitleMore", { timeout: 15000 });
    await page.click("#cdTitleMore");
    await page.click("#cdShare");
    await page.waitForSelector(".cd-share");
    assert.match(await page.textContent(".cd-share"), /Share chat.*Private.*Only you can see this chat\..*Public.*Anyone signed in to Coder can open the link\..*Check your chat before sharing\. Chats may contain code and credentials from private GitHub repositories\./s);
    assert.equal(await page.$("#cdShareLink"), null, "no link while private");
    await page.click('[data-share-vis="public"]');
    await page.waitForSelector("#cdShareLink");
    assert.equal(await page.inputValue("#cdShareLink"), "https://gofarther.test/?share=c1");
    assert.deepEqual(st.posts, ['share {"visibility":"public"}']);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "share.png") });
    await page.click("#cdShareDone");
    assert.equal(await page.$(".cd-share"), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  // The link: read only.
  const b2 = await chromium.launch();
  try {
    const ctx = await b2.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'friend@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
    const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    const asked = [];
    await page.route("https://gofarther.test/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
      if (u.pathname.startsWith("/api/")) { asked.push(route.request().method() + " " + u.pathname); return route.fulfill({ contentType: "application/json", body: JSON.stringify(u.pathname === "/api/coder/shared/c1" ? { ok: true, shared: { id: "c1", title: "Shop fixes", repo: "ana/shop", branch: "coder/c1", base: "main", at, owner: "ana", mine: false }, events } : u.pathname === "/api/coder/settings" ? { prefs: {} } : {}) }); }
      const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
      if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
    });
    await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
    await page.goto("https://gofarther.test/?share=c1", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".cd-shared", { timeout: 15000 });
    const text = await page.textContent(".cd-shared");
    assert.match(text, /Shop fixes/);
    assert.match(text, /Shared by ana · Read only/);
    assert.match(text, /Fix the cart/);
    assert.match(text, /Ran npm test/);
    assert.match(await page.innerHTML(".cd-shared"), /Fixed the cart <b>total<\/b>\./, "the answer as the chat shows it");
    assert.equal(await page.$("#cdIn"), null, "no message box");
    assert.equal(await page.$("[data-perm-choice]"), null);
    assert.ok(!asked.some((x) => !x.startsWith("GET ")), "nothing but reading");
    // (Live test r11, 2026-11-23: the side said "Connect GitHub to start." on a shared chat's page. Now it says what this is,
    // and New chat and Repositories lead back to the owner's own page.)
    const side = await page.evaluate(() => document.body.innerText);
    assert.doesNotMatch(side, /Connect GitHub to start\./);
    assert.match(side, /You are viewing a shared chat\. Your chats/);
    assert.equal(await page.$eval("#cdSideNew", (b) => b.disabled), false);
    assert.equal(await page.$eval("#cdSideRepos", (b) => b.disabled), false);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "shared-view.png") });
    assert.deepEqual(errors, []);
  } finally { await b2.close(); }
});
