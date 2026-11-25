// THE CONTEXT WINDOW CARD (design 3, 2026-11-25): the breakdown's numbers add up and its share is right; on the page, the chip
// at the end of the composer's row opens the card, the chevron folds it, Esc and a click outside close it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, statSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const K = await import("../container/coder-compact.mjs");

test("the breakdown: parts add up to the total, tool results split from messages, free + buffer + used = the window, autoPct", () => {
  const L = K.compactLimits({ contextWindow: 500_000, enabled: true });
  const messages = [
    { role: "user", content: "x".repeat(4000) },
    { role: "assistant", content: "", tool_calls: [{ id: "1", function: { name: "read", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "1", content: "f".repeat(12000) },
    { role: "assistant", content: "y".repeat(400) },
  ];
  const u = K.contextUsage({ system: "a".repeat(4000), tools: [{ function: { name: "bash", description: "b".repeat(3960) } }], messages, limits: L, window: 500_000, model: "grok-4.7" });
  const by = Object.fromEntries(u.parts.map((p) => [p.name, p.tokens]));
  assert.equal(by["Tool results"], 3000, "the tool message's 12,000 characters");
  assert.ok(by.Messages > 1000 && by.Messages < 1200);
  assert.equal(u.used, u.parts.reduce((n, p) => n + p.tokens, 0));
  assert.equal(u.free + u.buffer + u.used, 500_000);
  assert.equal(u.autoPct, Math.round((L.threshold / 500_000) * 100));
  // A real count from Grok's last answer: the total follows it, and the parts still add up.
  const real = [...messages.slice(0, 3), { role: "assistant", content: "done", tokens: 60_000 }];
  const r = K.contextUsage({ system: "a".repeat(4000), messages: real, limits: L, window: 500_000 });
  assert.ok(r.used >= 60_000, "the real count wins");
  assert.equal(r.used, r.parts.reduce((n, p) => n + p.tokens, 0));
  assert.ok(r.parts.find((p) => p.name === "Tool results").tokens > 0);
  const pct = Math.round((r.used / r.window) * 100);
  assert.ok(pct >= 12 && pct <= 13);
});

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
async function openChat(browser, project, events, { dark = false } = {}) {
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
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
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
const at = Date.now();
const ctxOf = (msgs, res) => ({ model: "grok-4.7", window: 500000, used: 3300 + 12400 + 1200 + 2100 + msgs + res, parts: [{ name: "System prompt", tokens: 3300 }, { name: "System tools", tokens: 12400 }, { name: "MCP tools", tokens: 1200 }, { name: "Memory files", tokens: 2100 }, { name: "Skills", tokens: 0 }, { name: "Messages", tokens: msgs }, { name: "Tool results", tokens: res }], free: 500000 - 40000 - (19000 + msgs + res), buffer: 40000, autoPct: 92, memory: [], connectors: [], level: "ok", warning: "" });
const project = (context) => ({ id: "c1", title: "Shop fixes", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "acceptEdits", turn: context ? 1 : 0, at, context });
const events = [{ type: "user", text: "Add rate limiting to the upload route", at }, { type: "text", text: "Added a limiter and four tests.", at }, { type: "done", at }];
const shot = async (page, name) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

test("the page: the chip shows the share, opens the card, the chevron folds it, Esc and a click outside close it; amber at 80%; a new chat says No messages yet", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openChat(browser, project(ctxOf(60000, 120000)), events);
    await page.waitForSelector("#cdCtxChip", { timeout: 15000 });
    assert.equal((await page.textContent("#cdCtxChip")).trim(), "40%");
    assert.ok(!(await page.$eval("#cdCtxChip", (b) => b.classList.contains("is-amber"))));
    await shot(page, "chip.png");
    await page.click("#cdCtxChip");
    await page.waitForSelector(".cd-ctxc", { timeout: 5000 });
    const text = await page.textContent(".cd-ctxc");
    for (const t of ["Context window", "40% used", "199k of 500k tokens", "Tools (built-in)", "12.4k", "2.5%", "Files read / tool results", "120k", "24.0%", "Free space", "Autocompact buffer", "Coder summarises the chat at 92%"]) assert.ok(text.includes(t), t + " in " + text);
    assert.equal(await page.$$eval(".cd-ctxc-list li", (l) => l.length), 9);
    assert.equal(await page.$$eval(".cd-ctxc-bar .cd-ctxc-s", (l) => l.length), 6, "one segment per part in use");
    assert.ok(await page.$(".cd-ctxc-buf"));
    assert.ok(await page.$("#cdCtxCompact"), "Compact now, wired to /compact");
    await shot(page, "card-open.png");
    await page.click("#cdCtxFold");
    await page.waitForSelector(".cd-ctxc.is-folded");
    assert.equal(await page.$(".cd-ctxc-list"), null, "folded: only the bar and the numbers");
    assert.ok((await page.textContent(".cd-ctxc")).includes("199k of 500k tokens"));
    await shot(page, "collapsed.png");
    await page.click("#cdCtxFold");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".cd-ctxc"));
    await page.click("#cdCtxChip");
    await page.waitForSelector(".cd-ctxc");
    await page.click(".cd-ctxc-list");
    assert.ok(await page.$(".cd-ctxc"), "a click inside keeps it open");
    await page.mouse.click(30, 300);
    await page.waitForFunction(() => !document.querySelector(".cd-ctxc"));
    await page.click("#cdCtxChip");
    await page.click("#cdCtxChip");
    assert.equal(await page.$(".cd-ctxc"), null, "the chip toggles it");
    assert.deepEqual(st.posts, [], "nothing sent");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const b2 = await chromium.launch();
  try {
    const { page } = await openChat(b2, project(ctxOf(150000, 260000)), events);
    await page.waitForSelector("#cdCtxChip", { timeout: 15000 });
    assert.equal((await page.textContent("#cdCtxChip")).trim(), "86%");
    assert.ok(await page.$eval("#cdCtxChip", (b) => b.classList.contains("is-amber")), "amber at 80% or more");
    await page.click("#cdCtxChip");
    await page.waitForSelector(".cd-ctxc");
    await shot(page, "near-full.png");
  } finally { await b2.close(); }
  const b3 = await chromium.launch();
  try {
    const { page } = await openChat(b3, project(ctxOf(60000, 120000)), events, { dark: true });
    await page.waitForSelector("#cdCtxChip", { timeout: 15000 });
    await page.click("#cdCtxChip");
    await page.waitForSelector(".cd-ctxc");
    await shot(page, "dark.png");
  } finally { await b3.close(); }
  const b4 = await chromium.launch();
  try {
    const { page } = await openChat(b4, project(null), []);
    await page.waitForSelector("#cdCtxChip", { timeout: 15000 });
    assert.equal((await page.textContent("#cdCtxChip")).trim(), "0%");
    await page.click("#cdCtxChip");
    await page.waitForSelector(".cd-ctxc");
    assert.ok((await page.textContent(".cd-ctxc")).includes("No messages yet"));
    await shot(page, "new-chat.png");
  } finally { await b4.close(); }
});
