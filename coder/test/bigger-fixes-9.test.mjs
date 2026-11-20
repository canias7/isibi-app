// BIGGER CLAUDE CODE FIXES, PART 9 (2026-11-20), in a real browser with the page's own coder.js and coder.css and stand-ins
// for the Worker: a step waiting for your yes does not read "Ran"; the chat stays where you scrolled; a resend after a failed
// send keeps its id; a long chat draws only its newest steps; the @ list is asked for again after a failed load and after a job.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const skip = !chromium && "playwright not installed";

/** The page on one chat, c1. `h` answers the Worker: { events, running, state(), message(body), files() }. */
async function openPage(browser, h) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const project = () => ({ id: "c1", title: "Chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: h.running ? "running" : "idle", mode: "default", turn: 1, at });
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
      let out = { status: 200, body: {} };
      if (m === "POST" && u.pathname === "/api/coder/projects/c1/message") out = h.message ? h.message(JSON.parse(route.request().postData() || "{}")) : out;
      else if (u.pathname === "/api/coder/projects/c1/state") out = { status: 200, body: h.state ? h.state() : { running: !!h.running, events: [], next: h.events.length, project: project() } };
      else if (u.pathname === "/api/coder/projects/c1/files") out = h.files ? h.files() : { status: 200, body: { files: [] } };
      else out = { status: 200, body: { "GET /api/coder/github": { connected: true, login: "ana" }, "GET /api/coder/projects": { projects: [project()] }, "GET /api/coder/projects/c1": { project: project(), events: h.events, queue: [] }, "GET /api/coder/settings": { prefs: {} } }[m + " " + u.pathname] || {} };
      if (out === "drop") return route.abort();
      return route.fulfill({ status: out.status, contentType: "application/json", body: JSON.stringify(out.body) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#cdIn", { timeout: 15000 });
  return { page, errors, project };
}

test("F9-1 a step waiting for your yes reads 'Run …', not 'Ran …', and is left out of the group's count; a refused step reads 'Run …' too", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    const events = [
      { type: "user", text: "Run the tests", at },
      { type: "bash", id: "s1", command: "ls", at }, { type: "result", id: "s1", code: 0, output: "a", at },
      { type: "bash", id: "s2", command: "pwd", at }, { type: "result", id: "s2", code: 0, output: "/", at },
      { type: "bash", id: "s3", command: "npm test", at },
      { type: "permission", pid: "p1abc", id: "s3", tool: "bash", lines: ["npm test"], at },
    ];
    const { page, errors } = await openPage(browser, { events, running: true });
    await page.waitForSelector(".cd-cmd.is-wait");
    const wait = await page.textContent(".cd-cmd.is-wait .cd-cmd-row");
    assert.match(wait, /^\s*Run\b/, wait);
    assert.doesNotMatch(wait, /\bRan\b/);
    assert.match(wait, /waiting for you/);
    const head = await page.textContent(".cd-group-head");
    assert.match(head, /\b2\b/, head);
    assert.doesNotMatch(head, /\b3\b/, head);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const b2 = await chromium.launch();
  try {
    const at = Date.now();
    const events = [{ type: "user", text: "x", at }, { type: "bash", id: "r1", command: "rm -rf build", at }, { type: "result", id: "r1", code: 1, ran: false, denied: true, output: "", at }, { type: "done", text: "ok", at }];
    const { page } = await openPage(b2, { events, running: false });
    await page.waitForSelector(".cd-cmd.is-bad");
    const row = await page.textContent(".cd-cmd.is-bad .cd-cmd-row");
    assert.match(row, /^\s*Run\b/, row);
    assert.match(row, /refused/);
  } finally { await b2.close(); }
});

test("F9-2 the chat stays where you scrolled while Coder works when a new step comes; at the bottom it follows new steps", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    const events = [{ type: "user", text: "Go", at }];
    for (let i = 0; i < 120; i++) events.push({ type: "text", text: "Paragraph " + i + " " + "word ".repeat(30), at });
    let n = 0;
    const extra = [];
    const h = { events, running: true, state: () => ({ running: true, events: extra.splice(0), next: events.length + (n += 0), project: { id: "c1", title: "Chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", turn: 1, at } }) };
    const { page, errors } = await openPage(browser, h);
    await page.waitForFunction(() => document.querySelector("#cdLog") && document.querySelector("#cdLog").scrollHeight > 3000);
    await page.evaluate(() => { document.querySelector("#cdLog").scrollTop = 1200; });
    // A new step arrives with the next look.
    extra.push({ type: "bash", id: "n1", command: "npm test", at: Date.now() });
    await page.waitForSelector('[data-step="n1"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    const top = await page.evaluate(() => document.querySelector("#cdLog").scrollTop);
    assert.ok(Math.abs(top - 1200) < 5, "stayed where it was scrolled, at " + top);
    // At the bottom: a new step is followed.
    await page.evaluate(() => { const l = document.querySelector("#cdLog"); l.scrollTop = l.scrollHeight; });
    extra.push({ type: "result", id: "n1", code: 0, output: "ok", at: Date.now() }, { type: "text", text: "More " + "word ".repeat(200), at: Date.now() });
    await page.waitForFunction(() => /More word/.test(document.querySelector("#cdLog").textContent), null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const gap = await page.evaluate(() => { const l = document.querySelector("#cdLog"); return l.scrollHeight - l.scrollTop - l.clientHeight; });
    assert.ok(gap < 5, "followed to the bottom, " + gap + " px left");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("F9-3 a resend of an unchanged message after a failed send carries the same id; a changed message gets a new one", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    const posts = [];
    let fail = true;
    const h = { events: [{ type: "user", text: "hi", at }, { type: "done", text: "Hello", at }], running: false, message: (b) => { posts.push(b); if (fail) return { status: 503, body: { error: "busy" } }; return { status: 200, body: { project: { id: "c1", status: "running", turn: 2 } } }; } };
    const { page, errors } = await openPage(browser, h);
    await page.fill("#cdIn", "Fix the login page");
    await page.press("#cdIn", "Enter");
    await page.waitForFunction(() => document.querySelector("#cdIn").value === "Fix the login page", null, { timeout: 10000 });
    await page.press("#cdIn", "Enter");
    await page.waitForFunction(() => document.querySelector("#cdIn").value === "Fix the login page", null, { timeout: 10000 });
    await page.waitForTimeout(200);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].mid, posts[1].mid, "the same message keeps its id");
    await page.fill("#cdIn", "Fix the signup page");
    await page.press("#cdIn", "Enter");
    await page.waitForFunction(() => document.querySelector("#cdIn").value === "Fix the signup page", null, { timeout: 10000 });
    await page.waitForTimeout(200);
    assert.notEqual(posts[2].mid, posts[1].mid, "a changed message is a new one");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("F9-4 a long chat draws only its newest steps, with Show earlier for the rest", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    const events = [];
    for (let t = 0; t < 60; t++) {
      events.push({ type: "user", text: "Message " + t, at });
      for (let k = 0; k < 30; k++) { const id = "t" + t + "k" + k; events.push({ type: "bash", id, command: "echo " + k, at }, { type: "result", id, code: 0, output: String(k), at }); }
      events.push({ type: "done", text: "Done " + t, at });
    }
    const { page, errors } = await openPage(browser, { events, running: false });
    await page.waitForSelector("#cdEarlier");
    const shown = await page.$$eval(".cd-user", (x) => x.length);
    assert.ok(shown < 60 && shown > 0, shown + " messages drawn");
    assert.match(await page.textContent("#cdLog"), /Message 59/);
    assert.doesNotMatch(await page.textContent("#cdLog"), /Message 0\b/);
    await page.click("#cdEarlier");
    await page.waitForFunction(() => document.querySelectorAll(".cd-user").length === 60);
    assert.equal(await page.$("#cdEarlier"), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("F9-5 the @ list: a failed first load is asked for again; a job's end refreshes it, so a file made by the job shows", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    let loads = 0, running = false;
    let list = ["src/app.js"];
    const proj = () => ({ id: "c1", title: "Chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: running ? "running" : "idle", turn: 1, at });
    const h = {
      events: [{ type: "user", text: "hi", at }, { type: "done", text: "Hello", at }],
      get running() { return running; },
      files: () => { loads++; return loads === 1 ? { status: 502, body: { error: "the file list could not be read from GitHub" } } : { status: 200, body: { files: list } }; },
      state: () => ({ running, events: [], next: 2, project: proj() }),
      message: () => { running = true; return { status: 200, body: { project: { ...proj(), status: "running" } } }; },
    };
    const { page, errors } = await openPage(browser, h);
    await page.type("#cdIn", "@app");
    await page.waitForTimeout(500);
    await page.fill("#cdIn", "");
    await page.type("#cdIn", "@app");
    await page.waitForFunction(() => /src\/app\.js/.test(document.body.textContent), null, { timeout: 10000 });
    assert.equal(loads, 2, "asked again after the failure");
    // A job makes a file; when it ends, the list is asked for again.
    await page.fill("#cdIn", "Make a page");
    await page.press("#cdIn", "Enter");
    await page.waitForTimeout(800);
    list = ["src/app.js", "src/new-page.js"];
    running = false;
    await page.waitForFunction(() => true);
    const before = loads;
    for (let i = 0; i < 40 && loads === before; i++) await page.waitForTimeout(250);
    assert.ok(loads > before, "refreshed after the job ended");
    await page.fill("#cdIn", "");
    await page.type("#cdIn", "@new");
    await page.waitForFunction(() => /src\/new-page\.js/.test(document.body.textContent), null, { timeout: 10000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
