// THE TOOLS PAGE (the owner, 2026-11-24, from the approved mockup: "BUILD IT"): the sidebar's More holds Tools alone (Settings
// and Notifications stay in the gear's menu); the page has every group and row from the mockup, each "!" explains its tool
// on hover, on tap and on keyboard focus, and a choice is saved and still there after a reload. The API is the Worker's own
// code (container/coder-toolchoices.mjs) behind a stub; no model calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, statSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { TOOL_ROWS, TOOL_CHOICE_GROUPS, changeToolChoice } from "../container/coder-toolchoices.mjs";
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const GROUPS = ["Files", "Commands", "Web", "Helpers", "Scheduling", "Sharing", "Side copies", "Connectors", "Plugins and skills", "Other"];

async function open(browser, store, { width = 1200, height = 900, dark = false, touch = false, extra = {} } = {}) {
  const projects = [{ id: "c1", title: "Fix the cart total", repo: "ana/shop", branch: "coder/c1", base: "main", at: Date.now() }];
  const api = (m, p, body) => {
    if (p === "/api/coder/tool-choices") {
      if (m === "POST") { const r = changeToolChoice(store.choices, body.id, body.value); if (r.error) return [400, { error: r.error }]; store.choices = r.choices; store.posts.push(body); }
      return [200, { ok: true, rows: TOOL_ROWS, groups: TOOL_CHOICE_GROUPS, choices: store.choices }];
    }
    if (extra[m + " " + p]) return [200, extra[m + " " + p]];
    return [200, ({
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects },
      "GET /api/coder/projects/c1": { project: projects[0], events: [{ type: "user", text: "Fix the cart total" }, { type: "answer", text: "Done." }], queue: [] },
      "GET /api/coder/settings": { prefs: {} },
      "GET /api/coder/connectors": { connectors: [] },
    })[m + " " + p] || {}];
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", colorScheme: dark ? "dark" : "light", hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e) + (process.env.TP_DEBUG ? e.stack : "")));
  await page.route("https://gofarther.test/**", async (route) => {
    const u = new URL(route.request().url()), m = route.request().method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) { let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch { b = {}; } const [st, out] = api(m, u.pathname, b); return route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(out) }); }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  const go = async () => { await page.goto("https://gofarther.test/", { waitUntil: "domcontentloaded" }); await page.waitForSelector("#cdSideMore:not([disabled])", { timeout: 15000 }); };
  await go();
  return { page, errors, go, ctx };
}
const openTools = async (page) => {
  if (!(await page.$("#cdSideTools"))) await page.click("#cdSideMore");
  await page.click("#cdSideTools .gf-sname");
  await page.waitForSelector(".cd-tools .cd-tl-row");
};

test("tools page: More holds Tools alone; Settings and Notifications stay in the gear's menu", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser, { choices: {}, posts: [] });
    await page.click("#cdSideMore");
    const sub = await page.$$eval('.gf-sub[aria-label="More"] .gf-sname', (b) => b.map((x) => x.textContent.trim()));
    assert.deepEqual(sub, ["Tools", "Permission rules", "Projects"]);
    for (const id of ["cdSideTools", "cdSideRules", "cdSideProjects"]) assert.ok(await page.$("#" + id + " > svg"), id + ": a line icon");
    assert.doesNotMatch(await page.textContent(".gf-sub"), /\p{Extended_Pictographic}/u);
    for (const id of ["cdSideSettings", "cdSideNotify"]) assert.equal(await page.$("#" + id), null);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "sidebar-more-open.png"), clip: { x: 0, y: 0, width: 520, height: 600 } });
    // The gear: Settings, then Notifications.
    await page.click("#gfGear"); await page.click("#gfSettings");
    await page.waitForSelector(".cd-settings");
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.querySelectorAll(".cd-sure").forEach((x) => x.remove()));
    await page.click("#gfGear"); await page.click("#gfNotify");
    await page.waitForSelector(".cd-notify");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("tools page: every group and row, the !, a choice saved and still there after a reload", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const store = { choices: {}, posts: [] };
    const { page, errors, go } = await open(browser, store);
    await openTools(page);
    assert.equal(await page.textContent(".cd-tools .cd-sure-title"), "Tools");
    assert.equal(await page.textContent(".cd-tools .cd-sure-text"), "For each tool: ask you first, always allow it, or never use it. Your rules and the repository's rules come first. Coder's safety checks run either way.");
    assert.deepEqual(await page.$$eval(".cd-tl-sec", (x) => x.map((y) => y.textContent)), GROUPS);
    const names = await page.$$eval(".cd-tl-row", (x) => x.map((y) => y.querySelector("b").firstChild.textContent));
    assert.equal(names.length, 38);
    for (const n of ["Read", "Bash", "PowerShell", "WebFetch", "Browser", "Agent", "CronCreate", "Artifact", "EnterWorktree", "Connector tools", "Skill", "Projects", "Task list", "EndConversation"]) assert.ok(names.includes(n), n);
    for (const n of ["Push", "Auto-fix", "Pull request", "Review comments"]) assert.ok(!names.includes(n), "GitHub rows moved to the Connectors page: " + n);
    assert.ok(!(await page.$$eval(".cd-tl-sec", (x) => x.map((y) => y.textContent))).includes("GitHub"), "no GitHub group");
    // Nothing chosen: each row shows its default, marked "(default)"; no Reset in its menu.
    assert.equal(await page.$$eval(".cd-tl-def", (x) => x.length), 38);
    assert.equal(await page.$eval('[data-tool="bash"] select', (s) => s.options[s.selectedIndex].text), "Ask");
    assert.equal(await page.$eval('[data-tool="read"] select', (s) => s.options[s.selectedIndex].text), "Always allow");
    assert.equal(await page.$('[data-tool="bash"] option[value="default"]'), null);
    // Off or not in every chat: still shown, with a note.
    assert.match(await page.textContent('[data-tool="powershell"]'), /Off unless/);
    assert.doesNotMatch(await page.textContent(".cd-tools"), /\p{Extended_Pictographic}/u);
    // The "!": hidden, then shown on hover.
    const tip = '[data-tool="bash"] .cd-ti-tip';
    assert.equal(await page.isVisible(tip), false);
    await page.hover('[data-tool="bash"] .cd-ti');
    assert.equal(await page.isVisible(tip), true);
    assert.match(await page.textContent(tip), /Commands that only read things always run\./);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "tools-desktop-tooltip.png") });
    await page.mouse.move(5, 5);
    // ... and on keyboard focus.
    await page.focus(".cd-tl-x");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.closest(".cd-tl-row").dataset.tool), "read");
    assert.equal(await page.isVisible('[data-tool="read"] .cd-ti-tip'), true);
    await page.evaluate(() => document.activeElement.blur());
    if (SHOTS) { await page.evaluate(() => { document.querySelector(".cd-tools").scrollTop = 0; }); await page.screenshot({ path: path.join(SHOTS, "tools-desktop.png") }); }
    // A choice: Bash to Never.
    await page.selectOption('[data-tool="bash"] select', "deny");
    await page.waitForFunction(() => { const s = document.querySelector('[data-tool="bash"] select'); return s && !s.disabled && s.value === "deny" && !document.querySelector('[data-tool="bash"] .cd-tl-def'); });
    assert.deepEqual(store.posts, [{ id: "bash", value: "deny" }]);
    assert.ok(await page.$('[data-tool="bash"] .cd-tl-pick.is-deny'));
    assert.ok(await page.$('[data-tool="bash"] option[value="default"]'), "Reset to default once chosen");
    // A reload: still Never.
    await go();
    await openTools(page);
    assert.equal(await page.$eval('[data-tool="bash"] select', (s) => s.value), "deny");
    assert.equal(await page.$('[data-tool="bash"] .cd-tl-def'), null);
    assert.ok(await page.$('[data-tool="read"] .cd-tl-def'));
    // Reset to default: nothing stored for it again.
    await page.selectOption('[data-tool="bash"] select', "default");
    await page.waitForSelector('[data-tool="bash"] .cd-tl-def');
    assert.deepEqual(store.choices, {});
    assert.equal(await page.$eval('[data-tool="bash"] select', (s) => s.value), "ask");
    await page.keyboard.press("Escape");
    assert.equal(await page.$(".cd-tools"), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("tools page: phone width, the ! opens on a tap; dark mode", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser, { choices: { workflow: "allow", "endconversation": "ask" }, posts: [] }, { width: 390, height: 844, touch: true });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("gf:side", { detail: true })));
    await page.waitForTimeout(200);
    await openTools(page);
    const box = await page.$eval(".cd-tools", (b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, sw: b.scrollWidth, cw: b.clientWidth }; });
    assert.ok(box.l >= 0 && box.r <= 390, JSON.stringify(box));
    assert.ok(box.sw <= box.cw + 1, "no sideways scroll");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "tools-phone.png") });
    await page.tap('[data-tool="agent"] .cd-ti');
    assert.equal(await page.isVisible('[data-tool="agent"] .cd-ti-tip'), true);
    const t = await page.$eval('[data-tool="agent"] .cd-ti-tip', (x) => { const r = x.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    assert.ok(t.l >= 0 && t.r <= 390, "the tip fits the phone: " + JSON.stringify(t));
    if (SHOTS) { await page.$eval('[data-tool="agent"]', (x) => x.scrollIntoView({ block: "center" })); await page.screenshot({ path: path.join(SHOTS, "tools-phone-tooltip.png") }); }
    await page.tap('[data-tool="agent"] .cd-ti');
    assert.equal(await page.isVisible('[data-tool="agent"] .cd-ti-tip'), false);
    assert.equal(await page.$eval('[data-tool="workflow"] select', (s) => s.value), "allow");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const b2 = await chromium.launch();
  try {
    const { page, errors } = await open(b2, { choices: { bash: "deny", read: "ask" }, posts: [] }, { dark: true });
    await openTools(page);
    const bg = await page.$eval(".cd-tools", (b) => getComputedStyle(b).backgroundColor);
    assert.equal(bg, "rgb(38, 38, 36)");
    await page.hover('[data-tool="read"] .cd-ti');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "tools-dark.png") });
    assert.deepEqual(errors, []);
  } finally { await b2.close(); }
});

test("side menu: Plugins holds the plugin parts with their notes; the ! never opens the item; Commands and Helpers list plugins' own", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await open(browser, { choices: {}, posts: [] }, { extra: { "GET /api/coder/plugins": { installed: [{ name: "shipit", commands: ["pre-push"], agents: ["code-reviewer"], skills: [] }], catalog: [] } } });
    await page.click("#cdSidePlugins");
    await page.click("#cdSideMore");
    const names = await page.$$eval('.gf-sub[aria-label="Plugins"] .gf-sname', (b) => b.map((x) => x.textContent));
    assert.deepEqual(names, ["Installed plugins", "Skills", "Commands", "Helpers", "Hooks", "Connectors"]);
    const tips = await page.$$eval(".gf-sub .gf-stip", (b) => b.map((x) => x.textContent));
    assert.equal(tips.length, 9);
    for (const t of tips.slice(1, 6)) assert.match(t, /Plugins can add their own\.$/);
    // Hover shows the note beside the sidebar.
    await page.hover("#cdSidePluginsList .gf-sinfo");
    assert.equal(await page.isVisible("#cdSidePluginsList .gf-stip"), true);
    assert.match(await page.textContent("#cdSidePluginsList .gf-stip"), /^Bundles you install in one go\./);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "side-menu-tip.png"), clip: { x: 0, y: 0, width: 700, height: 640 } });
    // A click on the ! shows the note and opens nothing.
    await page.click("#cdSideCommands .gf-sinfo");
    assert.equal(await page.$(".gf-sidelist"), null);
    assert.equal(await page.isVisible("#cdSideCommands .gf-stip"), true);
    await page.click("#cdSideCommands .gf-sinfo");
    await page.mouse.move(900, 600);
    // Commands: Coder's own, and the plugin's.
    await page.click("#cdSideCommands .gf-sname");
    await page.waitForSelector(".gf-sidelist");
    const cmds = await page.textContent(".gf-sidelist");
    assert.match(cmds, /\/compact/);
    assert.match(cmds, /\/shipit:pre-push[\s\S]*From the shipit plugin/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "commands-list.png") });
    await page.click(".gf-sidelist .cd-notify-done");
    await page.click("#cdSideHelpers .gf-sname");
    await page.waitForSelector(".gf-sidelist");
    const helpers = await page.$$eval(".gf-sidelist li b", (b) => b.map((x) => x.textContent));
    assert.deepEqual(helpers, ["general-purpose", "Explore", "Plan", "web-fetch"]); // (Plugins' helpers are not shown on the page: owner, 2026-11-28.)
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "helpers-list.png") });
    await page.click(".gf-sidelist .cd-notify-done");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
