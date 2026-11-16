// CLAUDE CODE'S "SUGGESTED CONNECTORS" CARD (owner, 2026-11-16): after a connector search, the owner's connectors with
// Connect, Use or Reconnect, and "Browse more connectors".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { suggestConnectorsFor } from "../container/coder-agent.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

test("agent: a search naming connectors, or finding nothing, shows the card; select: never", () => {
  assert.equal(suggestConnectorsFor("connector tools about issues", 3), true);
  assert.equal(suggestConnectorsFor("mcp linear", 1), true);
  assert.equal(suggestConnectorsFor("jira tickets", 0), true);
  assert.equal(suggestConnectorsFor("web fetch", 1), false);
  assert.equal(suggestConnectorsFor("select:web_fetch", 0), false);
  assert.equal(suggestConnectorsFor("", 0), false);
  const src = read("container/coder-agent.mjs");
  assert.match(src, /if \(!gTs && !github && suggestConnectorsFor\(c\.args && c\.args\.query, \(r\.loaded \|\| \[\]\)\.length\)\) emit\(\{ type: "connectors_suggest"/);
});

test("page: Coder's tab only, styles under #gfApp", () => {
  const js = read("public/coder.js"), css = read("public/coder.css");
  assert.match(js, /e\.type === 'connectors_suggest'\) \{ if \(!GLOOPY\) out\.push\(suggestHTML\(e\)\)/);
  for (const l of css.slice(css.indexOf("Suggested connectors")).split("\n").filter((l) => /\{/.test(l) && !/^\s*@/.test(l))) assert.match(l, /#gfApp/, l);
});

test("page in Chromium: the card's rows, buttons and presses", { skip: !chromium }, async () => {
  const browser = await chromium.launch();
  try {
    const ORIGIN = "https://gofarther.test", at = Date.now();
    let conns = [
      { id: "z", name: "Zapier", status: "ok", on: false, tools: [] },
      { id: "l", name: "Linear", status: "ok", on: true, tools: [] },
      { id: "n", name: "Neon", status: "error", on: true, tools: [] },
      { id: "s", name: "Sentry", status: "auth", on: true, tools: [] },
    ];
    const posts = [];
    const events = [
      { type: "user", text: "search your connector tools for anything about issues", at: at - 60000 },
      { type: "connectors_suggest", id: "t1", query: "connector issues", at: at - 50000 },
      { type: "done", text: "Here are your connectors.", at: at - 40000 },
    ];
    const project = () => ({ id: "c1", title: "Issues", repo: "ana/shop", base: "main", branch: "coder/c1", status: "done", mode: "acceptEdits", turn: 1, at, marks: [] });
    const api = (m, p, body) => {
      if (m === "POST") posts.push([p, body]);
      if (m === "POST" && p === "/api/coder/projects/c1/connectors") { const off = JSON.parse(body).off; conns = conns.map((c) => ({ ...c, on: !off.includes(c.id) })); return { connectors: conns }; }
      if (m === "POST" && p === "/api/coder/connectors/n") return { connector: { id: "n", name: "Neon", status: "error", error: "timeout", tools: [] } };
      return { "GET /api/coder/github": { connected: true, login: "ana" }, "GET /api/coder/projects": { projects: [project()] },
        "GET /api/coder/projects/c1": { project: project(), events, queue: [] }, "GET /api/coder/projects/c1/state": { running: false, events: [], next: 3, project: project() },
        "GET /api/coder/projects/c1/connectors": { connectors: conns }, "GET /api/coder/connectors": { connectors: [], catalog: [] }, "GET /api/coder/settings": { prefs: {} } }[m + " " + p] || {};
    };
    const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
    const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
    const ctx = await browser.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2, serviceWorkers: "block", colorScheme: "light" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(ORIGIN + "/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
      if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(route.request().method(), u.pathname, route.request().postData())) });
      const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
      if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
    });
    await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
    await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#gfApp .cd-sg .cd-sg-row", { timeout: 15000 });
    const card = page.locator("#gfApp .cd-sg");
    assert.match(await card.locator(".cd-sg-head").innerText(), /^Suggested connectors$/);
    const rows = await card.locator(".cd-sg-row").evaluateAll((els) => els.map((e) => [e.querySelector("b").textContent, e.dataset.sgState, (e.querySelector("button,.cd-sg-on") || {}).textContent]));
    assert.deepEqual(rows, [["Zapier", "use", "Use"], ["Linear", "on", "On"], ["Neon", "reconnect", "Reconnect"], ["Sentry", "connect", "Connect"]]);
    assert.equal(await card.locator(".cd-sg-err").innerText(), "Can’t reach Neon right now. It may need to be reconnected.");
    assert.equal(await card.locator('.cd-sg-row img[src="/logos/neon.svg"]').count(), 1);
    if (process.env.SG_SHOT) await card.screenshot({ path: process.env.SG_SHOT });
    // Use: this chat's switch on, and the card says so.
    await card.locator('[data-sg-act="use"]').click();
    await page.waitForSelector("#gfApp .cd-sg-note");
    assert.equal(await card.locator(".cd-sg-note").innerText(), "Zapier is on for this session.");
    assert.deepEqual(JSON.parse(posts.find((x) => x[0] === "/api/coder/projects/c1/connectors")[1]).off, []);
    assert.equal(await card.locator('.cd-sg-row[data-sg-state="use"]').count(), 0);
    // Reconnect: the connector's own check.
    await card.locator('[data-sg-act="reconnect"]').click();
    await page.waitForFunction(() => /Neon: timeout/.test(document.querySelector("#gfApp .cd-sg-note").textContent));
    assert.ok(posts.some((x) => x[0] === "/api/coder/connectors/n"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// CLAUDE CODE'S SUGGESTED CONNECTORS AS ITS OWN TOOL (2026-11-16): in a live test "Search connector tools" ran a tool search
// that found request_secret, so no card showed; Claude Code showed it. Now Coder has suggest_connectors.
test("suggest_connectors: offered in Coder's chats (not from GitHub), named for connector questions, always shows the card", async () => {
  const { runCoder, CODER_TOOLS, GITHUB_TOOLS, CODER_SYSTEM, SUGGEST_CONNECTORS_WORDS } = await import("../container/coder-agent.mjs");
  assert.ok(CODER_TOOLS.some((t) => t.function.name === "suggest_connectors"));
  assert.ok(!GITHUB_TOOLS.some((t) => t.function.name === "suggest_connectors"));
  for (const ask of ["search connector tools", "what connectors do I have", "connect Linear"]) assert.ok(SUGGEST_CONNECTORS_WORDS.toLowerCase().includes(ask.toLowerCase()), ask);
  assert.match(SUGGEST_CONNECTORS_WORDS, /instead of tool_search or request_secret/);
  assert.match(CODER_SYSTEM, /suggest_connectors \(the Suggested connectors card/);
  const call = (name, args) => ({ id: "s1", type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const events = [], seen = []; let n = 0;
  const turns = [say("", [call("suggest_connectors", { query: "connector tools" })]), say("Here are your connectors.")];
  await runCoder({ send: async (q) => { seen.push(q); return turns[n++]; }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e) }, { text: "Search connector tools" });
  assert.ok(events.some((e) => e.type === "connectors_suggest" && e.id === "s1" && e.query === "connector tools"));
  const last = seen[1].messages.filter((m) => m.role === "tool").pop();
  assert.match(String(last.content), /Suggested connectors card/);
});
