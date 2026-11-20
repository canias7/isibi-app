// BIGGER CLAUDE CODE FIXES, PART 10 (2026-11-20), on the real page with stand-ins for sign-in, GitHub and Grok:
// the Rewind list says under each message how many files it changed (Claude Code's rewind menu), and the Repositories
// screen has Claude Code's "Disconnect GitHub", which says the sign-in stays valid on GitHub until removed there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

async function openPage(browser) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { posts: [], connected: true };
  const events = [{ type: "user", text: "First: read the code", at }, { type: "user", text: "Second: fix the bug", at }, { type: "user", text: "Third: old job", at }, { type: "user", text: "Fourth: just a question", at }];
  const project = () => ({ id: "c1", title: "Chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "default", turn: 4, at,
    marks: [{ turn: 1, ev: 0 }, { turn: 2, ev: 1 }, { turn: 3, ev: 2 }, { turn: 4, ev: 3 }],
    commits: [{ turn: 2, sha: "a", edited: ["src/a.js", "src/b.js"], tracked: true }, { turn: 2, sha: "b", edited: ["src/a.js"], tracked: true }, { turn: 3, sha: "c" }] });
  const api = (method, p, body) => {
    if (method === "POST" && p === "/api/coder/github/disconnect") { st.posts.push(p); st.connected = false; return { ok: true }; }
    if (p === "/api/coder/projects/c1/state") return { running: false, events: [], next: events.length, project: { ...project(), now: Date.now() } };
    return {
      "GET /api/coder/github": st.connected ? { connected: true, login: "ana" } : { connected: false },
      "GET /api/coder/github/repos": { repos: [{ repo: "ana/shop" }] },
      "GET /api/coder/review/settings": { repos: {} },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events, queue: [] },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(api(route.request().method(), u.pathname, route.request().postData())) });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}

test("M-a-15: the Rewind list says under each message how many files it changed, none, or unknown", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.waitForFunction(() => /Fourth: just a question/.test(document.querySelector("#cdLog").textContent), null, { timeout: 10000 });
    await page.fill("#cdIn", "/rewind");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector(".cd-pick-col .cd-pick-sub", { timeout: 10000 });
    const rows = await page.$$eval(".cd-pick-col button:not(.cd-sure-no)", (bs) => bs.map((b) => [b.querySelector(".cd-pick-main").textContent, b.querySelector(".cd-pick-sub").textContent]));
    assert.deepEqual(rows, [["Fourth: just a question", "No code changes"], ["Third: old job", "Code changes unknown"], ["Second: fix the bug", "2 files changed"], ["First: read the code", "No code changes"]]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("L-ops-20: Disconnect GitHub asks first, says the sign-in stays valid on GitHub, then forgets Coder's copy", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser);
    await page.waitForSelector("#cdSideRepos", { timeout: 15000, state: "attached" });
    await page.evaluate(() => document.querySelector("#cdSideRepos").click());
    await page.waitForSelector("#cdDisconnectGh", { timeout: 10000 });
    await page.click("#cdDisconnectGh");
    await page.waitForSelector(".cd-sure-box", { timeout: 5000 });
    const text = await page.textContent(".cd-sure-box");
    assert.match(text, /Disconnect GitHub\?/);
    assert.match(text, /chats lose GitHub access until you connect again/);
    assert.match(text, /stays valid on GitHub: to cancel it there, remove Coder under GitHub's Settings > Applications > Authorized GitHub Apps/);
    // Cancel does nothing.
    await page.click(".cd-sure-no");
    assert.equal(st.posts.length, 0);
    await page.click("#cdDisconnectGh");
    await page.click(".cd-sure-yes");
    await page.waitForSelector("#cdConnect", { timeout: 10000 });
    assert.deepEqual(st.posts, ["/api/coder/github/disconnect"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
