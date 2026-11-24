// Coder's approval card as design 16 (the owner, 2026-11-24): one quiet indented line, the tool's icon (GitHub's mark for
// GitHub's tools), a short label with a grey line under it, pills "Allow ↵", "Always for <scope>", "Deny esc". Real clicks and
// keys: Allow, Always (Cmd/Ctrl+Enter), Esc, a reply typed in the box (deny and tell Coder), the diff toggle, the answered line.
// ASKCARD_SHOTS=<folder> also saves screenshots, light and dark.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const SHOTS = process.env.ASKCARD_SHOTS || "";

const at = Date.now();
const BASH = { type: "permission", pid: "pbash", tool: "bash", lines: ["npm install express"], desc: "Install express", why: "Coder wants to run a command that changes the project.", rules: ["Bash(npm install *)"], at };
const PR = { type: "permission", pid: "ppr", tool: "pull_request", what: "Open a pull request: Fix login redirect loop", why: "Coder wants to use pull_request.", at };
const EDIT = { type: "permission", pid: "pedit", tool: "edit", path: "src/auth/login.js", change: { kind: "update", lines: ["@@ -12,3 +12,4 @@", " const next = params.get('next');", "-if (next) redirect(next);", "+if (next && next.startsWith('/')) redirect(next);", "+else redirect('/home');"] }, why: "Do you want to make this edit to src/auth/login.js?", rules: ["Edit(src/**)"], at };

async function openPage(browser, cards, { dark = false } = {}) {
  const ORIGIN = "https://gofarther.test";
  const st = { answers: [], out: [] };
  const project = () => ({ id: "c1", title: "Login fix", repo: "isibi/app", base: "main", branch: "fix/login-redirect", status: "running", mode: "default", turn: 1, at });
  const api = (method, p, body) => {
    if (method === "POST" && /\/answer$/.test(p)) { const a = JSON.parse(body || "{}"); st.answers.push(a); st.out.push({ type: "permanswer", pid: a.pid, choice: a.choice, ...(a.comment ? { comment: a.comment } : {}), at: Date.now() }); return [200, { ok: true }]; }
    if (p === "/api/coder/projects/c1/state") { const ev = st.out.splice(0); return [200, { running: true, events: ev, next: 1, project: { ...project(), now: Date.now() } }]; }
    if (p === "/api/coder/projects/c1/env") return [200, { envId: "e1", name: "Work", isDefault: false, script: "", vars: [], secrets: [], network: { mode: "trusted", hosts: [], defaults: true }, repos: ["isibi/app"] }];
    return [200, {
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events: [{ type: "user", text: "Fix the login redirect and open a pull request.", at }, ...cards], queue: [] },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {}];
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, serviceWorkers: "block", colorScheme: dark ? "dark" : "light", deviceScaleFactor: SHOTS ? 2 : 1 });
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
  await page.waitForSelector(".cd-pl.is-live", { timeout: 15000 });
  return { page, st, errors, ctx };
}
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png") }); };
const line = (page, pid) => page.locator('.cd-pl[data-perm="' + pid + '"]');
const answered = (page, pid) => page.waitForSelector('.cd-pl.is-done[data-perm="' + pid + '"] .cd-pl-ans', { timeout: 15000 });

test("AC1 design 16: the line, its pills and the always scope; a click on Allow answers yes and the line says Allowed once", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    for (const dark of SHOTS ? [false, true] : [false]) {
      const { page, st, errors, ctx } = await openPage(browser, [BASH], { dark });
      const l = line(page, "pbash");
      assert.match(await l.locator(".cd-pl-t").innerText(), /^Run npm install express$/);
      assert.match(await l.locator(".cd-pl-d").innerText(), /Install express/);
      assert.deepEqual(await l.locator(".cd-pl-btn").evaluateAll((bs) => bs.map((b) => [b.dataset.permChoice, b.querySelector("span").textContent, b.querySelector("kbd") ? b.querySelector("kbd").textContent : ""])), [["yes", "Allow", "↵"], ["always", "Always for npm install *", ""], ["no", "Deny", "esc"]]);
      assert.equal(await l.locator('[data-perm-choice="always"]').innerText(), "Always for npm install *");
      assert.equal(await page.locator(".cd-permhint").innerText(), "Reply to deny and tell Coder what to do instead");
      assert.equal(await page.locator(".cd-pl .cd-perm-q, .cd-pl .cd-perm-note").count(), 0, "no old question line or note box");
      await shot(page, "bash-" + (dark ? "dark" : "light"));
      await l.locator('[data-perm-choice="yes"]').click();
      await answered(page, "pbash");
      assert.deepEqual(st.answers.map((a) => a.choice), ["yes"]);
      assert.equal(await page.locator('.cd-pl[data-perm="pbash"] .cd-pl-ans').innerText(), "Allowed once");
      assert.equal(await page.locator(".cd-permhint").count(), 0);
      await shot(page, "answered-" + (dark ? "dark" : "light"));
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test("AC2 keys: Enter allows, Cmd/Ctrl+Enter always (its scope in the answered line), Esc denies; several cards wait at once", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, [BASH, PR, EDIT]);
    assert.equal(await page.locator(".cd-pl.is-live").count(), 3);
    await line(page, "pbash").focus(); await page.keyboard.press("Control+Enter");
    await answered(page, "pbash");
    assert.match(await page.locator('.cd-pl[data-perm="pbash"] .cd-pl-ans').innerText(), /^Always allowed for npm install \*$/);
    await line(page, "ppr").focus(); await page.keyboard.press("Escape");
    await answered(page, "ppr");
    assert.equal(await page.locator('.cd-pl[data-perm="ppr"] .cd-pl-ans').innerText(), "Denied");
    await line(page, "pedit").focus(); await page.keyboard.press("Enter");
    await answered(page, "pedit");
    assert.deepEqual(st.answers.map((a) => [a.pid, a.choice]), [["pbash", "always"], ["ppr", "no"], ["pedit", "yes"]]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("AC3 the GitHub line has GitHub's mark; a reply typed in the box denies it and tells Coder; the answered line says why", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    for (const dark of SHOTS ? [false, true] : [false]) {
      const { page, st, errors, ctx } = await openPage(browser, [PR], { dark });
      const l = line(page, "ppr");
      assert.equal(await l.locator(".cd-pl-t").innerText(), "Create pull request Fix login redirect loop");
      assert.equal(await l.locator(".cd-pl-ic.is-gh svg path").count(), 1);
      assert.equal(await l.locator('[data-perm-choice="always"]').count(), 0, "no rule from the server: no Always");
      await shot(page, "github-pr-" + (dark ? "dark" : "light"));
      if (dark) { await ctx.close(); continue; }
      await page.click("#cdIn");
      await page.keyboard.type("Make it a draft first");
      await page.keyboard.press("Enter");
      await answered(page, "ppr");
      assert.deepEqual(st.answers, [{ pid: "ppr", choice: "no", comment: "Make it a draft first" }]);
      assert.equal(await page.locator('.cd-pl[data-perm="ppr"] .cd-pl-ans').innerText(), "Denied: Make it a draft first");
      assert.equal(await page.inputValue("#cdIn"), "");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test("AC4 a file edit: Show changes opens the diff under the line and Hide changes closes it; it stays answerable", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    for (const dark of SHOTS ? [false, true] : [false]) {
      const { page, st, errors, ctx } = await openPage(browser, [EDIT], { dark });
      const l = line(page, "pedit");
      assert.equal(await l.locator(".cd-pl-t").innerText(), "Edit src/auth/login.js");
      assert.match(await l.locator(".cd-pl-d").innerText(), /\+2 −1 lines/);
      assert.equal(await l.locator(".cd-perm-pre").count(), 0);
      await l.locator("[data-perm-open]").click();
      await page.waitForSelector('.cd-pl[data-perm="pedit"] .cd-perm-pre');
      assert.equal(await l.locator(".cd-dl-add").count(), 2);
      assert.equal(await l.locator("[data-perm-open]").innerText(), "Hide changes");
      await shot(page, "edit-diff-" + (dark ? "dark" : "light"));
      await l.locator("[data-perm-open]").click();
      await page.waitForFunction(() => !document.querySelector('.cd-pl[data-perm="pedit"] .cd-perm-pre'));
      await l.locator('[data-perm-choice="always"]').click();
      await answered(page, "pedit");
      assert.deepEqual(st.answers.map((a) => a.choice), ["always"]);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});
