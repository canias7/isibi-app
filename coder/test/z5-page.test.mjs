// CLAUDE CODE PARITY, PASS Z5 (2026-11-23), page side: the question card's auto-continue countdown (askUserQuestionTimeout)
// and the answer it sends with `afk`; /goal's bar and verdict lines; the Settings row. Screenshots go to Z5_SHOTS when set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const SHOTS = process.env.Z5_SHOTS || "";

async function openPage(browser, { askTimeout = "60s", events = [], running = true, goal = null, focused = false } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { posts: [] };
  const proj = (id) => ({ id, title: "Chat " + id, repo: "ana/" + id, base: "main", branch: "coder/" + id, status: running ? "running" : "idle", mode: "default", turn: 1, at, ...(goal ? { goal } : {}) });
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, onChange: () => {} };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  if (!focused) await page.addInitScript(() => { document.hasFocus = () => false; });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    const m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) {
      if (m === "POST") st.posts.push({ path: u.pathname, ...JSON.parse(route.request().postData() || "{}") });
      const one = u.pathname.match(/^\/api\/coder\/projects\/(\w+)$/);
      let body = { ok: true };
      if (u.pathname === "/api/coder/github") body = { connected: true, login: "ana" };
      else if (u.pathname === "/api/coder/projects") body = { projects: [proj("a")] };
      else if (one && m === "GET") body = { project: proj(one[1]), events, next: events.length, queue: [] };
      else if (u.pathname === "/api/coder/settings") body = { prefs: { askTimeout } };
      else if (/\/state$/.test(u.pathname)) body = { running, events: [], next: events.length, project: proj("a") };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.clock.install();
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}
const openChat = async (page) => {
  await page.click('.gf-item[data-chat="a"]');
  await page.waitForFunction(() => document.querySelector("#cdIn") && document.body.textContent.includes("ana/a"), null, { timeout: 10000 });
};
const Q = { type: "question", pid: "pabc123", text: "Which database should the sign-up page save to?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "Already in the project." }, { label: "SQLite", description: "A single file." }] };

test("Z5-P1 the question card goes on by itself after askUserQuestionTimeout away: countdown for the last 20s, picks sent with afk", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, { events: [{ type: "user", text: "Build the sign-up page" }, Q] });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await openChat(page);
    await page.waitForSelector(".cd-ask.is-live", { timeout: 10000 });
    await page.clock.runFor(45_000);
    assert.match(await page.textContent(".cd-ask-wait"), /^Continuing without you in (1[0-9]|20)s · press any key to wait$/);
    if (SHOTS) await page.screenshot({ path: SHOTS + "/z5-question-countdown.png" });
    // A key restarts the timer.
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true })));
    await page.clock.runFor(2_000);
    assert.equal(await page.textContent(".cd-ask-wait"), "Needs your input");
    await page.clock.runFor(61_000);
    for (let k = 0; k < 50 && !st.posts.some((p) => /\/answer$/.test(p.path)); k++) await page.waitForTimeout(50);
    const ans = st.posts.find((p) => /\/answer$/.test(p.path));
    assert.deepEqual({ pid: ans.pid, choice: ans.choice, afk: ans.afk, answers: ans.answers }, { pid: "pabc123", choice: "answers", afk: 60000, answers: [{ options: [0], other: "" }] });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Z5-P2 never times out while the window has focus, or with the default \"never\"", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    for (const o of [{ focused: true }, { askTimeout: "never" }]) {
      const { page, st } = await openPage(browser, { events: [Q], ...o });
      await page.waitForSelector("#cdIn", { timeout: 15000 });
      await openChat(page);
      await page.waitForSelector(".cd-ask.is-live", { timeout: 10000 });
      await page.clock.runFor(700_000);
      await page.waitForTimeout(200);
      assert.ok(!st.posts.some((p) => /\/answer$/.test(p.path)), JSON.stringify(o));
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Z5-P3 /goal: the active bar above the box and each verdict in the chat", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const events = [{ type: "user", text: "npm test passes and the lint step is clean" }, { type: "text", text: "Ran the tests: 2 failing." }, { type: "goal", state: "working", condition: "npm test passes and the lint step is clean", reason: "Two tests in test/auth still fail.", turns: 1 }, { type: "text", text: "Fixed both; npm test and lint pass." }, { type: "goal", state: "met", condition: "npm test passes and the lint step is clean", reason: "npm test exited 0 and lint printed no errors.", turns: 2 }];
    const { page, errors } = await openPage(browser, { running: false, events, goal: { condition: "npm test passes and the lint step is clean", at: Date.now() - 300_000, turns: 1, tokens: 1200, reason: "" } });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await openChat(page);
    await page.waitForSelector(".cd-goalline.is-met", { timeout: 10000 });
    assert.match(await page.textContent(".cd-goalbar"), /◎ \/goal active · \d+m/);
    assert.match(await page.textContent(".cd-goalline.is-working"), /Goal not yet met · check 1Two tests in test\/auth still fail\./);
    assert.match(await page.textContent(".cd-goalline.is-met"), /Goal achieved: npm test passes/);
    if (SHOTS) await page.screenshot({ path: SHOTS + "/z5-goal.png" });
    // The Settings row for askUserQuestionTimeout.
    await page.evaluate(() => window.dispatchEvent(new Event("gf:settings")));
    await page.waitForSelector("#cdSetAskTo", { timeout: 5000 });
    assert.deepEqual(await page.$$eval("#cdSetAskTo option", (o) => o.map((x) => x.value)), ["never", "60s", "5m", "10m"]);
    if (SHOTS) await page.locator("#cdSetAskTo").evaluate((x) => x.closest("label").scrollIntoView());
    if (SHOTS) await page.locator(".cd-settings").screenshot({ path: SHOTS + "/z5-settings-ask-timeout.png" });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
