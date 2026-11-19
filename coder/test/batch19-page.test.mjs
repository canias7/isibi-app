// Claude Code fixes, batch 19: the page (a new permission card does not take the keyboard from a box being typed in; a refused
// Archive of an environment says why inside the dialog).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

async function openPage(browser, { running = false, archive = null } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { answers: [], card: false, sentCard: false, archives: 0 };
  const perm = { type: "permission", pid: "p1abc", tool: "bash", lines: ["npm test"], at };
  const project = () => ({ id: "c1", title: "Old name", repo: "ana/shop", base: "main", branch: "coder/c1", status: running ? "running" : "idle", mode: "default", turn: 1, at });
  const api = (method, p, body) => {
    if (method === "POST" && /\/answer$/.test(p)) { st.answers.push(JSON.parse(body || "{}")); return [200, { ok: true }]; }
    if (method === "POST" && p === "/api/coder/environments/e1") { st.archives++; return archive || [200, { ok: true }]; }
    if (p === "/api/coder/projects/c1/state") {
      const give = st.card && !st.sentCard; if (give) st.sentCard = true;
      return [200, { running, events: give ? [perm] : [], next: give ? 2 : (st.sentCard ? 2 : 1), project: { ...project(), now: Date.now() } }];
    }
    if (p === "/api/coder/projects/c1/env") return [200, { envId: "e1", name: "Work", isDefault: false, script: "", vars: [], secrets: [], network: { mode: "trusted", hosts: [], defaults: true }, repos: ["ana/shop"] }];
    return [200, {
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events: [{ type: "user", text: "Run the tests", at }], queue: [] },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {}];
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
    if (u.pathname.startsWith("/api/")) { const [status, j] = api(route.request().method(), u.pathname, route.request().postData()); return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(j) }); }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors };
}

test("B19 I37 a permission card that comes while the Rename box is being typed in does not take the keyboard; with nothing typed in it does", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    let { page, st, errors } = await openPage(browser, { running: true });
    await page.waitForSelector("#cdTitleMore", { timeout: 15000 });
    await page.click("#cdTitleMore"); await page.click("#cdRename");
    await page.waitForSelector("#cdTitleIn");
    await page.fill("#cdTitleIn", "New name ");
    st.card = true;
    await page.waitForSelector(".cd-perm.is-live", { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "cdTitleIn");
    await page.keyboard.type("2");
    await page.waitForTimeout(2000); // (redraws while Coder works)
    assert.deepEqual(st.answers, [], "the digit answered nothing");
    assert.equal(await page.inputValue("#cdTitleIn"), "New name 2");
    assert.deepEqual(errors, []);
    await page.context().close();

    // Nothing being typed in: the card takes the keyboard, and 1 answers it.
    ({ page, st, errors } = await openPage(browser, { running: true }));
    await page.waitForSelector("#cdTitleMore", { timeout: 15000 });
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    st.card = true;
    await page.waitForSelector(".cd-perm.is-live", { timeout: 10000 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".cd-perm"))), true);
    await page.keyboard.press("1");
    for (let k = 0; k < 30 && !st.answers.length; k++) await page.waitForTimeout(100);
    assert.equal(st.answers.length, 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("B19 M-g-26 a refused Archive of an environment shows the server's words inside the dialog", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    for (const [archive, words] of [[[409, { error: "A running chat still uses it." }], "A running chat still uses it."], [[500, {}], "It could not be archived."]]) {
      const { page, st, errors } = await openPage(browser, { archive });
      await page.waitForSelector("#cdEnv", { timeout: 15000 });
      await page.click("#cdEnv");
      await page.waitForSelector("#envArchive", { timeout: 10000 });
      await page.click("#envArchive");
      await page.click(".cd-sure-yes");
      await page.waitForSelector(".cd-em-archive-err", { timeout: 5000 });
      assert.equal(st.archives, 1);
      assert.equal((await page.textContent(".cd-em-archive-err")).trim(), words);
      assert.equal(await page.isVisible("#envArchive"), true, "the dialog stays open");
      // Pressing Archive again clears the old words.
      await page.click("#envArchive");
      assert.equal(await page.$(".cd-em-archive-err"), null);
      await page.click(".cd-sure-no");
      assert.deepEqual(errors, []);
      await page.context().close();
    }
  } finally { await browser.close(); }
});
