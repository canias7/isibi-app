// CODER'S CHAT LIKE CLAUDE CODE ON THE WEB (the owner's recording, 2026-11-15): "Working… 3s" with a live counter until the
// first step; "✓ Just now", copy and rewind under the owner's messages; copy, thumbs up and down and the time under Coder's
// answers; "Enter to send, Ctrl+Enter to queue for later" while Coder works; the panel on the right on a desktop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CD_SHOTS || "";

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

/** The page in a real Chromium, signed in, with a fake Coder: one chat with a message and Coder's answer. */
async function openPage(browser, { width = 1400, height = 900, starting = false, connectors = [{ id: "a", name: "Linear", on: true, tools: [] }, { id: "b", name: "Notion", on: true, tools: [] }, { id: "c", name: "Sentry", on: false, tools: [] }], store = null } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { running: false, sent: 0, starting };
  const events = [
    { type: "user", text: "Fix the login button", at: at - 5 * 60000 },
    { type: "done", text: "Fixed: the button now signs you in.", at: at - 4 * 60000 },
  ];
  const project = () => ({ id: "c1", title: "Fix the login button", repo: "ana/shop", base: "main", branch: "coder/c1", status: st.running ? "running" : "done", mode: "acceptEdits", turn: 1, at, marks: [{ turn: 1, ev: 0 }], ...(st.running && st.starting ? { starting: { id: "s", at } } : {}) });
  const api = (method, p) => {
    if (method === "POST" && p === "/api/coder/projects/c1/message") { st.running = true; st.sent++; return { project: project() }; }
    return {
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events, queue: [] },
      "GET /api/coder/projects/c1/state": { running: st.running, events: [], next: 2, project: project() },
      "GET /api/coder/projects/c1/env": { envId: "default", name: "Default", isDefault: true, environments: [{ id: "default", name: "Default" }] },
      "GET /api/coder/projects/c1/connectors": { connectors },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  await ctx.addInitScript((s) => {
    window.__copied = [];
    try { Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.__copied.push(t); } }, configurable: true }); } catch { /* */ }
    if (s !== null) try { localStorage.setItem("cd.rpanel", s); } catch { /* */ }
  }, store);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e) + (process.env.CD_DEBUG ? e.stack : "")));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(route.request().method(), u.pathname)) });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#gfApp .cd-meta-u", { timeout: 15000 });
  return { page, st, errors };
}
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); };

test("the code: the working line, the rows under messages, the queue's words and the panel are Coder's only", () => {
  const js = read("public/coder.js"), css = read("public/coder.css");
  assert.match(js, /function workingHTML\(lastUser\)/);
  assert.match(js, /'Enter to send, Ctrl\+Enter to queue for later'/);
  assert.match(js, /\(GLOOPY \? '' : userMetaHTML\(e, i, mark\)\)/);
  assert.match(js, /\(GLOOPY \? '' : aiMetaHTML\(e, i\)\)/);
  assert.match(js, /localStorage\.getItem\('cd\.rpanel'\)/);
  assert.match(css, /@media \(min-width: 1100px\)/);
  // Gloopy's look stays: every new rule is under #gfApp.
  const added = css.slice(css.indexOf("LIKE CLAUDE CODE ON THE WEB"));
  for (const line of added.split("\n").filter((l) => /\{/.test(l) && !/^\s*@|^\s*\d|keyframes|^\/\*/.test(l.trim()))) assert.match(line, /#gfApp/, line);
});

test("relative times: Just now, minutes, hours, days", () => {
  const js = read("public/coder.js");
  const src = js.slice(js.indexOf("function relTime"), js.indexOf("const META_ICON"));
  const relTime = new Function(src + "; return relTime;")();
  const now = Date.now();
  assert.equal(relTime(now - 5000), "Just now");
  assert.equal(relTime(now - 2 * 60000), "2m ago");
  assert.equal(relTime(now - 3 * 3600000), "3h ago");
  assert.equal(relTime(now - 2 * 86400000), "2d ago");
});

test("in Chromium: rows under messages, copy, thumbs, rewind, Working… counter, the queue's words and the panel", { skip: !chromium && "Playwright is not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser);
    // 2. Under the owner's message: ✓ 5m ago, copy and rewind; under Coder's answer: copy, 👍, 👎 and the time.
    assert.equal(await page.textContent("#gfApp .cd-meta-u .cd-meta-t"), "✓ 5m ago");
    assert.equal(await page.locator("#gfApp .cd-meta-u [data-rewind-to]").count(), 1);
    assert.equal(await page.textContent("#gfApp .cd-meta-a .cd-meta-t"), "4m ago");
    await page.click("#gfApp .cd-meta-u [data-copy-ev]");
    await page.click("#gfApp .cd-meta-a [data-copy-ev]");
    await page.waitForFunction(() => window.__copied.length === 2);
    assert.deepEqual(await page.evaluate(() => window.__copied), ["Fix the login button", "Fixed: the button now signs you in."]);
    await page.click('#gfApp [data-rate="up"]');
    assert.equal(await page.getAttribute('#gfApp [data-rate="up"]', "aria-pressed"), "true");
    await page.click('#gfApp [data-rate="down"]');
    assert.equal(await page.getAttribute('#gfApp [data-rate="up"]', "aria-pressed"), "false");
    assert.equal(await page.getAttribute('#gfApp [data-rate="down"]', "aria-pressed"), "true");
    // 4. No panel on the right (owner, 2026-11-16: "dont put this pls, i dont like it"), and no button for it.
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#gfApp .cd-rpanel").count(), 0);
    assert.equal(await page.locator("#gfApp #cdRpToggle").count(), 0);
    // Rewind opens the rewind window for that message.
    await page.click("#gfApp .cd-meta-u [data-rewind-to]");
    await page.waitForSelector(".cd-sure-box:has-text('Rewind to this message?')");
    await shot(page, "p-rewind.png");
    await page.keyboard.press("Escape");
    await page.locator(".cd-sure").evaluateAll((w) => w.forEach((x) => x.remove()));
    // 1 and 3. A message: "Working… Ns" counting, the box's words, Stop stays.
    await page.fill("#cdIn", "Run the tests");
    await page.press("#cdIn", "Enter");
    // (2026-11-16: no step named by the server: the dots and the seconds.)
    await page.waitForSelector("#gfApp .cd-wait");
    const a = await page.textContent("#gfApp .cd-wait .cd-boot-s");
    await page.waitForTimeout(2600);
    const b = await page.textContent("#gfApp .cd-wait .cd-boot-s");
    assert.match(a, /^\d+s$/); assert.ok(parseInt(b) >= parseInt(a) + 2 || (parseInt(b) >= 2 && parseInt(b) > parseInt(a)), a + " → " + b);
    assert.equal(await page.getAttribute("#cdIn", "placeholder"), "Enter to send, Ctrl+Enter to queue for later");
    assert.equal(await page.locator("#gfApp #cdStop").count(), 1);
    assert.equal(await page.locator("#gfApp .cd-meta-u .cd-meta-t").last().textContent(), "✓ Just now");
    await shot(page, "p-working.png");
    assert.deepEqual(errors, []);
    await page.context().close();
  } finally { await browser.close(); }
});

test("in Chromium: the dots while the chat's start is marked and no step is named; no panel on a narrow screen", { skip: !chromium && "Playwright is not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page } = await openPage(browser, { starting: true });
    await page.fill("#cdIn", "Go");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector("#gfApp .cd-wait");
    assert.equal(await page.locator("#gfApp .cd-boot-w").count(), 0);
    await shot(page, "p-starting.png");
    await page.context().close();
    const narrow = await openPage(browser, { width: 900 });
    assert.equal(await narrow.page.locator("#gfApp .cd-rpanel").isVisible().catch(() => false), false);
    await narrow.page.context().close();
  } finally { await browser.close(); }
});
