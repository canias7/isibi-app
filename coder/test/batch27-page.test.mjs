// CLAUDE CODE FIXES, BATCH 27 (2026-11-19), page side.
// I57: a message's answer belongs to the chat it was sent from (Claude Code: typed text never goes to another conversation,
// and an unsent message stays with its own session when you switch away and back).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

async function openPage(browser, { failA = false } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { posts: [] };
  const proj = (id) => ({ id, title: "Chat " + id, repo: "ana/" + id, base: "main", branch: "coder/" + id, status: "idle", mode: "default", turn: 0, at });
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
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
      const msg = u.pathname.match(/^\/api\/coder\/projects\/(\w+)\/message$/);
      if (m === "POST" && msg) {
        st.posts.push({ chat: msg[1], ...JSON.parse(route.request().postData() || "{}") });
        if (msg[1] === "a") {
          await new Promise((r) => setTimeout(r, 3000));
          if (failA) return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Server error" }) });
        }
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ project: { ...proj(msg[1]), status: "running", turn: 1 } }) });
      }
      const one = u.pathname.match(/^\/api\/coder\/projects\/(\w+)$/);
      let body = {};
      if (u.pathname === "/api/coder/github") body = { connected: true, login: "ana" };
      else if (u.pathname === "/api/coder/projects") body = { projects: [proj("a"), proj("b")] };
      else if (one && m === "GET") body = { project: proj(one[1]), events: [], queue: [] };
      else if (u.pathname === "/api/coder/settings") body = { prefs: {} };
      else if (/\/state$/.test(u.pathname)) body = { running: false, events: [], next: 0, project: proj(u.pathname.split("/")[4]) };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}

const openChat = async (page, id) => {
  await page.click('.gf-item[data-chat="' + id + '"]');
  await page.waitForFunction((x) => document.querySelector("#cdIn") && document.body.textContent.includes("ana/" + x), id, { timeout: 10000 });
};

test("I57: a message's answer stays with its own chat; Enter in another chat posts to that chat", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser);
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await openChat(page, "a");
    await page.fill("#cdIn", "Work in chat A");
    await page.press("#cdIn", "Enter");
    await page.waitForTimeout(300);
    await openChat(page, "b");
    await page.fill("#cdIn", "Typed in chat B");
    await page.waitForTimeout(3500);
    assert.equal(await page.inputValue("#cdIn"), "Typed in chat B");
    assert.doesNotMatch(await page.textContent("#cdLog"), /Work in chat A/);
    await page.press("#cdIn", "Enter");
    for (let k = 0; k < 50 && st.posts.length < 2; k++) await page.waitForTimeout(100);
    assert.deepEqual(st.posts.map((p) => [p.chat, p.text]), [["a", "Work in chat A"], ["b", "Typed in chat B"]]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("I57: a message that fails after the owner switched chats goes back into its own chat's box", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser, { failA: true });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await openChat(page, "a");
    await page.fill("#cdIn", "Work in chat A");
    await page.press("#cdIn", "Enter");
    await page.waitForTimeout(300);
    await openChat(page, "b");
    await page.waitForTimeout(3500);
    assert.equal(await page.inputValue("#cdIn"), "");
    await openChat(page, "a");
    assert.equal(await page.inputValue("#cdIn"), "Work in chat A");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("M-d-10: an idle open chat shows a job started elsewhere without a click", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const ORIGIN = "https://gofarther.test";
    const at = Date.now();
    let started = false;
    const proj = () => ({ id: "a", title: "Chat a", repo: "ana/a", base: "main", branch: "coder/a", status: started ? "running" : "idle", mode: "default", turn: started ? 1 : 0, at });
    const events = () => (started ? [{ type: "user", text: "From GitHub: fix the login page", at }] : []);
    const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
    const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.route(ORIGIN + "/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
      if (u.pathname.startsWith("/api/")) {
        let body = {};
        if (u.pathname === "/api/coder/github") body = { connected: true, login: "ana" };
        else if (u.pathname === "/api/coder/projects") body = { projects: [proj()] };
        else if (u.pathname === "/api/coder/projects/a") body = { project: proj(), events: events(), queue: [] };
        else if (u.pathname === "/api/coder/settings") body = { prefs: {} };
        else if (/\/state$/.test(u.pathname)) body = { running: started, events: [], next: events().length, project: proj() };
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      }
      const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
      if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
    });
    await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
    await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.waitForTimeout(500);
    started = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(() => /fix the login page/.test((document.querySelector("#cdLog") || {}).textContent || ""), null, { timeout: 5000 });
  } finally { await browser.close(); }
});
