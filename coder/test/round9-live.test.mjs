// THE ROUND 9 LIVE FAILURES (2026-11-21, docs/live-tests/2026-11-21-audit-fixes.md): an unknown /command and a whole
// command's name with Enter, tried with real key presses in the page; the memory folder's commands; git config's reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

async function openPage(browser, { failA = false, events = [] } = {}) {
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
      else if (one && m === "GET") body = { project: proj(one[1]), events, queue: [] };
      else if (u.pathname === "/api/coder/settings") body = { prefs: {} };
      else if (/\/state$/.test(u.pathname)) body = { running: false, events, next: events.length, project: proj(u.pathname.split("/")[4]) };
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

const ANSWERED = [{ type: "user", text: "hi", at: 1 }, { type: "text", text: "Hello.", at: 2 }, { type: "done", at: 3 }];

test("R9a /nosuchthing + Enter in a chat that has had an answer (no skills step): the box empties, the chat says Unknown command, nothing is sent", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, { events: ANSWERED });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await openChat(page, "a");
    await page.click("#cdIn");
    await page.keyboard.type("/nosuchthing");
    await page.waitForFunction(() => /No commands match/.test(document.body.textContent), null, { timeout: 5000 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    assert.equal(await page.inputValue("#cdIn"), "");
    assert.match(await page.textContent("#cdLog"), /Unknown command: \/nosuchthing/);
    assert.deepEqual(st.posts, [], "nothing goes to the AI");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("R9b Enter on a command's whole name runs it (/autocompact alone says the window; /init and /review are sent); Enter on part of a name still picks", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, { events: ANSWERED });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await openChat(page, "b");
    await page.click("#cdIn");
    await page.keyboard.type("/autocompact");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    assert.equal(await page.inputValue("#cdIn"), "");
    assert.match(await page.textContent("#cdLog"), /Auto-compact window: auto/);
    for (const c of ["/review", "/init", "/compact"]) {
      await page.click("#cdIn");
      await page.keyboard.type(c);
      await page.keyboard.press("Enter");
      for (let k = 0; k < 30 && !st.posts.some((p) => p.text === c); k++) await page.waitForTimeout(100);
      assert.ok(st.posts.some((p) => p.text === c), c + " is sent");
      // (The first empties the box; the ones after it go while that turn runs, as Claude Code's queued messages.)
      if (c === "/review") { for (let k = 0; k < 30 && (await page.inputValue("#cdIn")) !== ""; k++) await page.waitForTimeout(100); assert.equal(await page.inputValue("#cdIn"), "", c); }
      else await page.fill("#cdIn", "");
    }
    await page.click("#cdIn");
    await page.keyboard.type("/autoc");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    assert.equal(await page.inputValue("#cdIn"), "/autocompact ", "part of a name picks the entry");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("R9c the chat's memory folder reaches the real command check (decideIn), and the read block lets file tools at the folder itself through", () => {
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  const decideIn = agent.slice(agent.indexOf("const decideIn = async"), agent.indexOf("\n", agent.indexOf("const decideIn = async")));
  assert.match(decideIn, /planFile: planPath\(\), memoryDir: typeof deps\.memFile === "string" && deps\.memFile \? pathPosix\.dirname\(deps\.memFile\) : ""/);
  assert.match(agent, /isMemoryPath\(targetOf\(\), deps\.memFile\) \|\| pathPosix\.normalize\(String\(targetOf\(\) \|\| ""\)\)\.replace\(\/\\\/\+\$\/, ""\) === pathPosix\.dirname\(deps\.memFile\)/);
});

test("R9d git config's reads (--get, --get-regexp, --get-all, --list, -l) run without asking; its writes still ask", async () => {
  const P = await import("../container/coder-perms.mjs");
  const d = (c) => P.bashDecision(c, { mode: "acceptEdits", cwd: "/w", workdirs: ["/w"] }).verdict;
  for (const c of ["git config --get-regexp '^branch\\.'", "git config --get user.name", "git config --get-all remote.origin.fetch", "git config --list", "git config -l", "git config --list --show-origin"]) assert.equal(d(c), "allow", c);
  for (const c of ["git config user.name x", "git config --unset user.name", "git config --add a.b c", "git config --list --add a.b c", "git config --get-regexp x --file /etc/x", "git config --replace-all a.b c", "git config -e"]) assert.equal(d(c), "ask", c);
});
