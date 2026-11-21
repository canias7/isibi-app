// A DELETE THAT FAILS IN THE BROWSER (live test, 2026-11-21): a chat waiting on its card, removed from Recents, and the
// DELETE answered with a 500 (or no answer at all) before it reached the server. The page must say so, in its box "The chat
// was not removed", and leave the chat exactly as it was: never Stopped, never "not run", until the server says it is gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

async function openPage(browser, failWith) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { deletes: 0, other: [] };
  const perm = { type: "permission", pid: "p1abc", tool: "bash", lines: ["npm test"], at };
  const project = () => ({ id: "c1", title: "Card chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "default", turn: 1, at });
  const events = [{ type: "user", text: "Run the tests", at }, perm];
  const api = (method, p) => {
    if (p === "/api/coder/projects/c1/state") return { running: true, events: [], next: events.length, project: { ...project(), now: Date.now() } };
    return {
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events, queue: [] },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => { if (window.__tokenThrows) throw new Error('renewal broke'); return 't'; }, proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    const m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) {
      if (m === "DELETE") {
        st.deletes++;
        if (failWith === "network") return route.abort();
        if (failWith === "html") return route.fulfill({ status: 500, contentType: "text/html", body: "<h1>Internal Server Error</h1>" });
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Something broke" }) });
      }
      if (m !== "GET") st.other.push(m + " " + u.pathname);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(m, u.pathname)) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}

for (const failWith of ["json", "html", "network", "throws"]) {
  test("a failed delete (" + failWith + ") shows its box and leaves the chat as it was", { skip: !chromium && "playwright not installed" }, async () => {
    const browser = await chromium.launch();
    try {
      const { page, st, errors } = await openPage(browser, failWith);
      await page.waitForSelector("[data-perm-choice]", { timeout: 15000 });
      const log = () => page.evaluate(() => (document.querySelector("#cdLog") || {}).textContent || "");
      const before = await log();
      await page.hover('.gf-item[data-chat="c1"]');
      await page.click('.gf-x[data-remove="c1"]', { force: true });
      if (failWith === "throws") await page.evaluate(() => { window.__tokenThrows = true; });
      await page.click(".cd-sure-yes");
      await page.waitForSelector("#cdRemoveFailed", { timeout: 5000 });
      assert.match(await page.textContent("#cdRemoveFailed"), /The chat was not removed/);
      await page.waitForTimeout(1500);
      assert.ok(await page.$("#cdRemoveFailed"), "the box stays until OK");
      assert.equal(st.deletes, failWith === "throws" ? 0 : 1);
      await page.evaluate(() => { window.__tokenThrows = false; });
      assert.deepEqual(st.other, [], "nothing but the DELETE was sent");
      assert.ok(await page.$('.gf-item[data-chat="c1"]'), "the chat stays in Recents");
      assert.ok(await page.$("[data-perm-choice]"), "its card still waits");
      const after = await log();
      assert.doesNotMatch(after, /Stopped|not run/);
      assert.equal(/Stopped|not run/.test(before), false);
      await page.click("#cdRemoveFailed .cd-sure-yes");
      assert.equal(await page.$("#cdRemoveFailed"), null);
      assert.deepEqual(errors, [], "no uncaught error on the page");
    } finally { await browser.close(); }
  });
}
