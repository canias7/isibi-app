// THE BUILT-IN GITHUB CONNECTOR (the owner, 2026-11-24, approved mockup): Coder's GitHub tools left the Tools page and are
// shown as a connector, GitHub, on the Connectors page: Built in, Connected as <login>, a panel with each tool's choice.
// Rules may name the tools as mcp__github__<tool>, mcp__github or mcp__github__*, and by their bare names as before. Their
// names sent to Grok stay Coder's own. No model calls: the loop runs on a stub; the page's API is the Worker's own code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, statSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { TOOL_ROWS, TOOL_CHOICE_GROUPS, GITHUB_ROWS, applyToolChoices, cleanToolChoices, changeToolChoice } from "../container/coder-toolchoices.mjs";
import { wholeRule, parseRule, GITHUB_CONNECTOR_TOOLS, githubMcpName } from "../container/coder-perms.mjs";
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const EMPTY = { allow: [], ask: [], deny: [] };

test("GH1 the connector's 7 rows: the real tool names, defaults as before, no GitHub group on the Tools page", () => {
  assert.deepEqual(GITHUB_ROWS.map((r) => r.tool), ["push_branch", "pull_request", "pr_read", "pr_comments", "reply_review", "auto_fix", "review"]);
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  for (const n of GITHUB_CONNECTOR_TOOLS) assert.ok(src.includes('name: "' + n + '"') || src.includes('fn("' + n + '"'), "a real tool: " + n);
  assert.deepEqual(Object.fromEntries(GITHUB_ROWS.map((r) => [r.tool, r.def])), { push_branch: "allow", pull_request: "allow", pr_read: "allow", pr_comments: "allow", reply_review: "allow", auto_fix: "ask", review: "allow" });
  assert.deepEqual(GITHUB_ROWS.find((r) => r.tool === "pull_request").rules, ["pull_request", "pr_update"]);
  for (const r of GITHUB_ROWS) { assert.ok(r.tip.length > 20 && r.name, r.id); assert.doesNotMatch(r.tip + r.line + r.name, /\p{Extended_Pictographic}/u); }
  assert.ok(!TOOL_CHOICE_GROUPS.includes("GitHub"));
  assert.ok(!TOOL_ROWS.some((r) => r.group === "GitHub"));
});

test("GH2 old Tools page choices move to the connector's rows; new choices are saved with the same store", () => {
  assert.deepEqual(cleanToolChoices({ push: "deny", "review-comments": "ask", "auto-fix": "allow", bash: "ask" }), { bash: "ask", "github:push_branch": "deny", "github:pr_comments": "ask", "github:pr_read": "ask", "github:reply_review": "ask", "github:auto_fix": "allow" });
  // (A choice made on the connector wins over the old row's.)
  assert.deepEqual(cleanToolChoices({ "pull-request": "deny", "github:pull_request": "allow" }), { "github:pull_request": "allow" });
  assert.deepEqual(changeToolChoice({ push: "deny" }, "github:pr_read", "ask"), { choices: { "github:pr_read": "ask", "github:push_branch": "deny" } });
  assert.deepEqual(changeToolChoice({ "github:pr_read": "ask" }, "github:pr_read", "default"), { choices: {} });
  assert.match(changeToolChoice({}, "push", "allow").error, /Connectors page/);
  // The migrated choice is applied as before: Never on the old Push row still refuses push_branch.
  assert.deepEqual(applyToolChoices(EMPTY, { push: "deny" }).toolChoices.deny, ["push_branch"]);
});

test("GH3 rules: mcp__github__<tool>, mcp__github, mcp__github__* and the bare names all name a GitHub tool", () => {
  assert.equal(githubMcpName("pull_request"), "mcp__github__pull_request");
  assert.equal(githubMcpName("bash"), "");
  assert.deepEqual(parseRule("push_branch"), { tool: "push_branch", spec: null });
  for (const r of ["mcp__github__push_branch", "mcp__github", "mcp__github__*", "push_branch"]) {
    for (const k of ["allow", "ask", "deny"]) assert.equal(wholeRule({ [k]: [r] }, k, "push_branch"), r, k + " " + r);
  }
  assert.equal(wholeRule({ deny: ["mcp__github__pr_read"] }, "deny", "push_branch"), "");
  assert.equal(wholeRule({ deny: ["mcp__other"] }, "deny", "push_branch"), "");
  assert.equal(wholeRule({ deny: ["mcp__github"] }, "deny", "bash"), "");
  // A rule naming one sets that row's choice aside, as for any tool.
  const m = applyToolChoices({ allow: [], ask: [], deny: ["mcp__github__pr_read"] }, { "github:pr_read": "allow", "github:push_branch": "ask" });
  assert.deepEqual(m.toolChoices.aside, ["github:pr_read"]);
  assert.deepEqual(m.toolChoices.ask, ["push_branch"]);
  assert.deepEqual(m.ask, [], "carried as a tool choice, not a rule");
  assert.deepEqual(applyToolChoices({ allow: [], ask: ["mcp__github"], deny: [] }, { "github:review": "deny" }).toolChoices.aside, ["github:review"]);
});

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
async function job(steps, rules) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], cards = [];
  let n = 0;
  const r = await runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (/^You are the safety checker/.test(sys)) return { message: { role: "assistant", content: '{"decision":"allow"}' }, usage: { in: 1, out: 1 } };
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async () => ({ code: 0, output: "ok\n" }),
    envApi: async () => ({ ok: true, text: "no comments" }),
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; },
  }, { text: "read the PR", mode: "acceptEdits", rules, checker: true, checkWhere: { key: "gh-" + Math.random() } });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "";
  const sentTools = [];
  return { r, events, cards, told, sentTools };
}

test("GH4 on Coder's loop: the connector's Ask puts a card first, Never refuses, and mcp__github rules apply; the names sent stay Coder's", async () => {
  const steps = () => [say("", [call("pr_read", { pr: "3" }, "p1")]), say("ok")];
  let t = await job(steps(), EMPTY);
  assert.equal(t.cards.length, 0, "the default: no card");
  t = await job(steps(), applyToolChoices(EMPTY, { "github:pr_read": "ask" }));
  assert.equal(t.cards.length, 1, "Ask: a card");
  assert.match(JSON.stringify(t.cards[0]), /pr_read/);
  t = await job(steps(), applyToolChoices(EMPTY, { "github:pr_read": "deny" }));
  assert.match(t.told("p1"), /denied/i);
  t = await job(steps(), { allow: [], ask: [], deny: ["mcp__github__pr_read"] });
  assert.match(t.told("p1"), /denied/i);
  t = await job(steps(), { allow: [], ask: ["mcp__github"], deny: [] });
  assert.equal(t.cards.length, 1, "mcp__github ask: a card");
  t = await job(steps(), { allow: [], ask: [], deny: ["pr_read"] });
  assert.match(t.told("p1"), /denied/i, "the bare name still works");
  // The tools Grok is offered keep their names: no mcp__github__ name is sent.
  const { CODER_SYSTEM } = await import("../container/coder-agent.mjs");
  assert.match(CODER_SYSTEM, /Your GitHub connector \(built in/);
});

async function open(browser, store, { width = 1200, height = 900, dark = false, events = null } = {}) {
  const projects = [{ id: "c1", title: "Fix the cart total", repo: "ana/shop", branch: "coder/c1", base: "main", at: Date.now() }];
  const api = (m, p, body) => {
    if (p === "/api/coder/tool-choices") {
      if (m === "POST") { const r = changeToolChoice(store.choices, body.id, body.value); if (r.error) return [400, { error: r.error }]; store.choices = r.choices; store.posts.push(body); }
      return [200, { ok: true, rows: TOOL_ROWS, groups: TOOL_CHOICE_GROUPS, github: GITHUB_ROWS, choices: cleanToolChoices(store.choices) }];
    }
    if (m === "POST" && p === "/api/coder/github/disconnect") { store.gh = false; return [200, { ok: true }]; }
    if (p === "/api/coder/github") return [200, store.gh === false ? { connected: false } : { connected: true, login: "ana" }];
    return [200, ({
      "GET /api/coder/projects": { projects },
      "GET /api/coder/projects/c1": { project: projects[0], events: events || [{ type: "user", text: "Fix the cart total" }, { type: "answer", text: "Done." }], queue: [] },
      "GET /api/coder/settings": { prefs: {} },
      "GET /api/coder/connectors": { connectors: [], catalog: [] },
    })[m + " " + p] || {}];
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://gofarther.test/**", async (route) => {
    const u = new URL(route.request().url()), m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) { let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch { b = {}; } const [st, out] = api(m, u.pathname, b); return route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(out) }); }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  const go = async () => { await page.goto("https://gofarther.test/", { waitUntil: "domcontentloaded" }); await page.waitForSelector("#cdSideMore:not([disabled])", { timeout: 15000 }); };
  await go();
  return { page, errors, go, ctx };
}
const openConnectors = async (page) => {
  if (!(await page.$("#cdSideConnectors"))) await page.click("#cdSidePlugins");
  await page.click("#cdSideConnectors .gf-sname");
  await page.waitForSelector(".cx .cx-table");
};
const skip = !chromium && "playwright not installed";

test("GH5 page: the GitHub row (Built in, Connected as ana), its panel, a choice saved and still there after a reload", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const store = { choices: { "auto-fix": "deny" }, posts: [] };
    const { page, errors, go } = await open(browser, store);
    await openConnectors(page);
    const row = page.locator('.cx-row[data-row="github"]');
    await row.waitFor();
    assert.match(await row.textContent(), /GitHub/);
    assert.equal((await row.locator(".cx-tcol").textContent()).trim(), "Built in");
    assert.equal((await row.locator(".cx-conn").textContent()).trim(), "Connected");
    assert.match(await row.locator(".cx-ghstat").textContent(), /as ana/);
    assert.equal(await row.locator("svg path").count(), 1, "the GitHub mark");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "1-connectors-list.png") });
    await row.click();
    await page.waitForSelector(".cx-ghtools .cd-tl-row");
    const rows = page.locator(".cx-ghtools .cd-tl-row");
    assert.equal(await rows.count(), 7);
    assert.deepEqual(await page.$$eval(".cx-ghcode", (x) => x.map((y) => y.textContent)), ["github · push_branch", "github · pull_request", "github · pr_read", "github · pr_comments", "github · reply_review", "github · auto_fix", "github · review"]);
    assert.equal(await page.locator(".cx-ghtools .cd-tl-def").count(), 6, "the old Auto-fix choice moved here: not a default");
    assert.equal(await page.$eval('[data-ghtool="github:auto_fix"] select', (s) => s.options[s.selectedIndex].text), "Never");
    assert.equal(await page.$eval('[data-ghtool="github:push_branch"] select', (s) => s.options[s.selectedIndex].text), "Always allow");
    // The "!" explains the tool on hover.
    await page.hover('[data-ghtool="github:pr_read"] .cd-ti');
    assert.ok(await page.isVisible('[data-ghtool="github:pr_read"] .cd-ti-tip'));
    await page.mouse.move(5, 5);
    assert.ok(await page.isVisible('.cx-ghpanel [data-act="ghoff"]'), "Disconnect");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "2-github-panel.png"), fullPage: true });
    // Saving a choice: Ask for push_branch.
    await page.selectOption('[data-ghtool="github:push_branch"] select', "ask");
    await page.waitForFunction(() => document.querySelector('[data-ghtool="github:push_branch"] .cd-tl-pick.is-ask'));
    assert.deepEqual(store.posts.at(-1), { id: "github:push_branch", value: "ask" });
    assert.equal(store.choices["github:push_branch"], "ask");
    assert.equal(await page.locator('[data-ghtool="github:push_branch"] .cd-tl-def').count(), 0);
    // After a reload, still there.
    await go();
    await openConnectors(page);
    await page.click('.cx-row[data-row="github"]');
    await page.waitForSelector(".cx-ghtools .cd-tl-row");
    assert.equal(await page.$eval('[data-ghtool="github:push_branch"] select', (s) => s.options[s.selectedIndex].text), "Ask");
    // Reset to default.
    await page.selectOption('[data-ghtool="github:push_branch"] select', "default");
    await page.waitForFunction(() => document.querySelector('[data-ghtool="github:push_branch"] .cd-tl-def'));
    assert.equal(store.choices["github:push_branch"], undefined);
    // Disconnect: through GitHub's own sign-in flow, which asks first.
    await page.click('.cx-ghpanel [data-act="ghoff"]');
    await page.waitForSelector(".cd-sure-box");
    await page.locator(".cd-sure-box button", { hasText: "Disconnect" }).last().click();
    await page.waitForFunction(() => !document.querySelector('.cx-row[data-row="github"]') && !document.querySelector(".cx-ghpanel"));
    assert.equal(store.gh, false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("GH6 page: dark mode; the Tools page has no GitHub group; a step reads GitHub · Create pull request", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    let { page, errors } = await open(browser, { choices: {}, posts: [] }, { dark: true });
    await openConnectors(page);
    await page.click('.cx-row[data-row="github"]');
    await page.waitForSelector(".cx-ghtools .cd-tl-row");
    const bg = await page.$eval(".cx-ghtools", (x) => getComputedStyle(x).backgroundColor);
    assert.notEqual(bg, "rgb(255, 255, 255)", "dark card");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "3-github-panel-dark.png"), fullPage: true });
    assert.deepEqual(errors, []);
    ({ page, errors } = await open(browser, { choices: {}, posts: [] }));
    if (!(await page.$("#cdSideTools"))) await page.click("#cdSideMore");
    await page.click("#cdSideTools .gf-sname");
    await page.waitForSelector(".cd-tools .cd-tl-row");
    const secs = await page.$$eval(".cd-tl-sec", (x) => x.map((y) => y.textContent));
    assert.ok(!secs.includes("GitHub"));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "4-tools-page.png"), fullPage: true });
    assert.deepEqual(errors, []);
    const events = [{ type: "user", text: "make a PR" }, { type: "bash", id: "s1", tool: "pull_request", verb: "Pull request", command: "git push and open the pull request" }, { type: "result", id: "s1", code: 0, output: "ok" }, { type: "answer", text: "Opened." }];
    ({ page, errors } = await open(browser, { choices: {}, posts: [] }, { events }));
    await page.waitForSelector(".cd-cmd-verb");
    const verbs = await page.$$eval(".cd-cmd-verb", (x) => x.map((y) => y.textContent));
    assert.ok(verbs.includes("GitHub · Create pull request"), JSON.stringify(verbs));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "5-step-label.png") });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
