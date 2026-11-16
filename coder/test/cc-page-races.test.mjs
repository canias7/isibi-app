// TWO PAGE RACES FROM A LIVE TEST (2026-11-16): Enter in a new chat still loading dropped the message; a click on a card was
// lost when the chat redrew under it while Coder worked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

async function openPage(browser, { slowOpen = 0, card = false } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { posts: [], answers: [], opens: 0 };
  const perm = { type: "permission", pid: "p1abc", tool: "bash", lines: ["npm test"], at };
  const project = () => ({ id: "c1", title: "New chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: card ? "running" : "idle", mode: "default", turn: card ? 1 : 0, at });
  const events = card ? [{ type: "user", text: "Run the tests", at }, perm] : [];
  const api = (method, p, body) => {
    if (method === "POST" && p === "/api/coder/projects/c1/message") { st.posts.push(JSON.parse(body || "{}")); return { project: { ...project(), status: "running" } }; }
    if (method === "POST" && /\/answer$/.test(p)) { st.answers.push(JSON.parse(body || "{}")); return { ok: true }; }
    // (While Coder works: every poll brings a fresh step, so the chat redraws.)
    if (p === "/api/coder/projects/c1/state") return { running: card, events: [], next: events.length, project: { ...project(), now: Date.now() } };
    return {
      "GET /api/coder/github": { connected: true, login: "ana" },
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
    if (u.pathname.startsWith("/api/")) {
      if (u.pathname === "/api/coder/projects/c1" && route.request().method() === "GET" && slowOpen) { st.opens++; await new Promise((r) => setTimeout(r, slowOpen)); }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(route.request().method(), u.pathname, route.request().postData())) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}

test("Enter in a new chat that is still loading sends the message once it has loaded", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, { slowOpen: 2500 });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    const long = Array.from({ length: 24 }, (_, i) => "Line " + (i + 1) + " of the task.").join("\n");
    await page.fill("#cdIn", long);
    await page.press("#cdIn", "Enter");
    await page.waitForFunction(() => document.querySelector("#cdLog") && /Line 24 of the task/.test(document.querySelector("#cdLog").textContent), null, { timeout: 10000 });
    for (let k = 0; k < 50 && !st.posts.length; k++) await page.waitForTimeout(100);
    assert.equal(st.posts.length, 1);
    assert.equal(st.posts[0].text, long);
    assert.equal(await page.inputValue("#cdIn"), "");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a click on a permission card lands while the chat keeps redrawing", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, { card: true });
    await page.waitForSelector("[data-perm-choice]", { timeout: 15000 });
    // The chat really redraws under the card (its node is drawn afresh).
    await page.evaluate(() => { window.__card = document.querySelector(".cd-perm.is-live"); });
    await page.waitForTimeout(2500);
    assert.equal(await page.evaluate(() => document.querySelector(".cd-perm.is-live") === window.__card), false);
    // A press and a release with redraws between them still answer.
    const b = await page.locator('[data-perm-choice="yes"]').boundingBox();
    await page.mouse.move(b.x + 5, b.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector(".cd-perm-opt.is-sent"), null, { timeout: 5000 });
    assert.ok(st.answers.length >= 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

