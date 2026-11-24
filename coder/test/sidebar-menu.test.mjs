// THE SIDEBAR'S MENU (owner, 2026-11-23, with a picture of the Claude app's sidebar): under Repositories, Search, Artifacts,
// Plugins (folds open: Installed plugins, Skills, Commands, Helpers, Hooks, Connectors) and More (Tools, Permission rules,
// Projects), since the owner's approved side menu of 2026-11-24.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";

async function open(browser, width = 1200) {
  const projects = [
    { id: "c1", title: "Fix the cart total", repo: "ana/shop", branch: "coder/c1", base: "main", at: Date.now() },
    { id: "c2", title: "Add dark mode", repo: "ana/blog", branch: "coder/c2", base: "main", at: Date.now() - 1000 },
  ];
  const events = [
    { type: "user", text: "Make a chart" },
    { type: "skills", list: [{ name: "deploy", description: "How we deploy the shop" }] },
    { type: "file", id: "f1", name: "chart.png", size: 2048, caption: "Sales chart" },
    { type: "answer", text: "Done." },
  ];
  const api = (m, p) => ({
    "GET /api/coder/github": { connected: true, login: "ana" },
    "GET /api/coder/projects": { projects },
    "GET /api/coder/projects/c1": { project: projects[0], events, queue: [] },
    "GET /api/coder/settings": { prefs: {} },
    "GET /api/coder/connectors": { connectors: [] },
  }[m + " " + p] || {});
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://gofarther.test/**", async (route) => {
    const u = new URL(route.request().url()), m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(m, u.pathname)) });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto("https://gofarther.test/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#cdSidePlugins:not([disabled])", { timeout: 15000 });
  return { page, errors };
}

test("sidebar: Plugins and More sit under Repositories; Plugins and More fold open", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser);
    const order = await page.$$eval(".gf-nav", (b) => b.map((x) => x.id));
    assert.deepEqual(order.slice(order.indexOf("cdSideRepos"), order.indexOf("cdSideRepos") + 3), ["cdSideRepos", "cdSidePlugins", "cdSideMore"]);
    assert.equal(await page.$("#cdSideConnectors"), null, "Plugins starts folded");
    await page.click("#cdSidePlugins");
    assert.deepEqual(await page.$$eval('.gf-sub[aria-label="Plugins"] .gf-sname', (b) => b.map((x) => x.textContent)), ["Installed plugins", "Skills", "Commands", "Helpers", "Hooks", "Connectors"]);
    await page.click("#cdSideMore");
    // (Since 2026-11-24 More holds Tools alone; Settings and Notifications are in the gear's menu: tools-page.test.mjs.)
    assert.deepEqual(await page.$$eval('.gf-sub[aria-label="More"] .gf-sname', (b) => b.map((x) => x.textContent)), ["Tools", "Permission rules", "Projects"]);
    for (const id of ["cdSideSettings", "cdSideNotify"]) assert.equal(await page.$("#" + id), null, id);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "sidebar-menu.png") });
    assert.equal(await page.$("#cdSideSearch"), null);
    assert.equal(await page.$("#cdSideArtifacts"), null);
    // Hooks opens Settings with Advanced open.
    await page.click("#cdSideHooks .gf-sname");
    await page.waitForSelector("#cdSetHooks");
    assert.equal(await page.$eval("#cdSetAdv", (d) => d.open), true);
    await page.click("#cdSetDone");
    // Skills in an open chat.
    await page.click('.gf-item[data-chat="c1"]');
    await page.waitForSelector(".cd-filecard");
    await page.click("#cdSideSkills .gf-sname");
    assert.match(await page.textContent(".gf-sidelist"), /\/deploy[\s\S]*How we deploy the shop/);
    await page.click(".gf-sidelist .cd-notify-done");
    assert.equal(await page.$(".gf-sidelist"), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
