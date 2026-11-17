// PROMPT SUGGESTIONS (Claude Code's: after Claude answers, a grey suggested next prompt in the message box; Tab or Right
// arrow takes it, typing hides it; promptSuggestionEnabled turns it off). Coder's final answer carries it as a hidden line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const A = await import("../container/coder-agent.mjs");
const R = await import("../src/coder-routes.mjs");
const S = await import("../container/server.mjs");
const PUB = new URL("../public/", import.meta.url).pathname;
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
let SUGGEST_OFF = false;
const store = null;
async function openPage0(browser, { width = 1400, height = 900, starting = false, connectors = [{ id: "a", name: "Linear", on: true, tools: [] }, { id: "b", name: "Notion", on: true, tools: [] }, { id: "c", name: "Sentry", on: false, tools: [] }], store = null, deviceScaleFactor = 1 } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { running: false, sent: 0, starting };
  const events = [
    { type: "user", text: "Fix the login button", at: at - 5 * 60000 },
    { type: "done", text: "Fixed: the button now signs you in.", suggest: "now run the tests", at: at - 4 * 60000 },
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
      "GET /api/coder/settings": { prefs: { suggestOff: SUGGEST_OFF } },
    }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, serviceWorkers: "block" });
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

const openPage = (o = {}) => openPage0(o.browser, o);

test("splitSuggest takes the hidden line off the answer", () => {
  assert.deepEqual(A.splitSuggest("Fixed both.\n<next-prompt>now fix both bugs and rerun the tests</next-prompt>"), { text: "Fixed both.", next: "now fix both bugs and rerun the tests" });
  assert.deepEqual(A.splitSuggest("Hi!"), { text: "Hi!", next: "" });
  assert.deepEqual(A.splitSuggest("Done.\n<next-prompt>open a pull request"), { text: "Done.", next: "open a pull request" });
});

const say = (content) => ({ message: { role: "assistant", content }, usage: { in: 1, out: 1 } });
async function turn(opts) {
  const events = [], seen = [];
  await A.runCoder({ send: async (q) => { seen.push(q); return say("All set.\n<next-prompt>open a pull request</next-prompt>"); }, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), here: () => "/w", root: "/w", chatId: "s1", where: (p) => p }, { text: "hi", mode: "auto", messages: [], ...opts });
  return { done: events.find((e) => e.type === "done"), system: seen[0].messages[0].content };
}
test("Coder's final answer carries the suggestion with no extra model call; off leaves the prompt alone", async () => {
  const on = await turn({ suggest: true });
  assert.equal(on.done.text, "All set.");
  assert.equal(on.done.suggest, "open a pull request");
  assert.ok(on.system.includes("<next-prompt>"));
  const off = await turn({});
  assert.equal(off.done.suggest, undefined);
  assert.ok(!off.system.includes("<next-prompt>"));
  const plan = await turn({ suggest: true, mode: "plan" });
  assert.equal(plan && plan.done ? plan.done.suggest : undefined, undefined);
});

test("the setting: on by default, saved and sent to the machine", () => {
  assert.equal(R.prefsOf({}).suggestOff, false);
  assert.equal(R.prefsChange({}, { suggestOff: true }).prefs.suggestOff, true);
  assert.ok(R.prefsChange({}, { suggestOff: "x" }).error);
  assert.equal(R.machinePrefs({ suggestOff: true }).suggestOff, true);
  assert.equal(R.machinePrefs({}).suggestOff, undefined);
  assert.equal(S.prefsIn({ suggestOff: true }).suggestOff, true);
});

test("the page: grey suggestion, Tab takes it, typing hides it, off in Settings hides it", { skip: !chromium }, async () => {
  const browser = await chromium.launch();
  try {
    SUGGEST_OFF = false;
    let { page, errors } = await openPage0(browser, { deviceScaleFactor: 2 });
    const box = page.locator("#cdIn");
    assert.equal(await box.getAttribute("placeholder"), "now run the tests");
    assert.equal(await box.getAttribute("data-suggest"), "now run the tests");
    if (process.env.SUGGEST_SHOT) await page.screenshot({ path: process.env.SUGGEST_SHOT });
    await box.focus(); await page.keyboard.press("Tab");
    assert.equal(await box.inputValue(), "now run the tests");
    await box.fill(""); await page.keyboard.type("x");
    assert.equal(await box.getAttribute("data-suggest"), null);
    assert.deepEqual(errors, []);
    await page.context().close();
    ({ page, errors } = await openPage0(browser, {}));
    await page.locator("#cdIn").focus(); await page.keyboard.type("f");
    assert.equal(await page.locator("#cdIn").inputValue(), "f");
    assert.notEqual(await page.locator("#cdIn").getAttribute("placeholder"), "now run the tests");
    await page.context().close();
    SUGGEST_OFF = true;
    ({ page, errors } = await openPage0(browser, {}));
    assert.notEqual(await page.locator("#cdIn").getAttribute("placeholder"), "now run the tests");
    await page.context().close();
  } finally { await browser.close(); }
});
