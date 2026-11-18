// CODER'S START-UP LINE LIKE CLAUDE CODE ON THE WEB (2026-11-16): "Setting up a cloud container ›", "Cloning repository Ns ›",
// "Running setup script ›", then a folded "Initialized session ›"; dots and seconds on an awake machine; "Ran a command ›".
// Each step is named only when the server says it is happening (owner, 2026-11-16): never from a timer on the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { phaseOf, setPhase, startupEvent } from "../container/server.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CD_SHOTS || "";
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

test("machine: the phase is said only while a cold job starts, and the start-up step has each part's time", () => {
  const t = { running: true, cold: true, phase: "container", phaseAt: 1 };
  assert.deepEqual(phaseOf(t), { phase: "container", phaseAt: 1 });
  setPhase(t, "clone");
  assert.equal(phaseOf(t).phase, "clone");
  assert.ok(t.phaseAt > 1);
  assert.deepEqual(phaseOf({ ...t, cold: false }), {}, "an awake machine names no step");
  setPhase(t, "ready");
  assert.deepEqual(phaseOf(t), {}, "ready: the startup step takes over");
  const e = startupEvent({ got: 1000, cloneStart: 1500, cloneEnd: 3500, ready: 4000 });
  assert.equal(e.type, "startup");
  assert.deepEqual(e.steps, [{ k: "container", ms: 500 }, { k: "clone", ms: 2000 }]);
  const noSetup = startupEvent({ got: 1000, cloneStart: 1500, cloneEnd: 3500, setupEnd: 3600, ready: 4000 });
  assert.ok(!noSetup.steps.some((x) => x.k === "setup"), "no setup step when no script ran");
});

test("code: the machine sets each phase where the step really starts; the Worker passes it on; Gloopy has none", () => {
  const m = read("container/server.mjs"), w = read("src/coder-routes.mjs"), js = read("public/coder.js");
  assert.match(m, /if \(!existsSync\(join\(dir, "\.git"\)\)\) setPhase\(t, "clone"\)/);
  assert.match(m, /t\.timing\.setupStart = Date\.now\(\);\n\s*t\.cold = !gloopy; setPhase\(t, "setup"\)/);
  assert.match(m, /setPhase\(t, "ready"\);\n\s*if \(t\.cold\) t\.events\.push\(startupEvent/);
  assert.match(m, /t\.cold = !gloopy && /);
  assert.match(m, /running: t\.running, \.\.\.phaseOf\(t\)/);
  assert.match(w, /\.\.\.\(phase \|\| \{\}\)/);
  assert.match(w, /phase: "container", phaseAt: Number\(starting\.at\)/);
  // No step is guessed on the page: it is only what a look at the chat said (bootSeen).
  const wk = js.slice(js.indexOf("function workingHTML"), js.indexOf("function stepLineHTML"));
  assert.match(wk, /const ph = b && b\.phase \? b\.phase : '';/);
  assert.doesNotMatch(wk, /setTimeout|setInterval/);
});

/** The page in Chromium with a fake Coder whose /state says what the test sets (`st.state`). */
async function openPage(browser, events = null) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { running: false, state: {}, events: events || [{ type: "user", text: "Hi", at: at - 60000 }], fresh: [] };
  const project = () => ({ id: "c1", title: "New chat", repo: "ana/shop", base: "main", branch: "coder/c1", status: st.running ? "running" : "done", mode: "acceptEdits", turn: 1, at, marks: [] });
  const api = (method, p) => {
    if (method === "POST" && p === "/api/coder/projects/c1/message") { st.running = true; return { project: project() }; }
    if (method === "GET" && p === "/api/coder/projects/c1/state") { const ev = st.fresh; st.fresh = []; return { running: st.running, events: ev, next: 9, project: project(), ...st.state }; }
    return {
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events: st.events, queue: [] },
      "GET /api/coder/projects/c1/env": { envId: "default", name: "Default", isDefault: true, environments: [{ id: "default", name: "Default" }] },
      "GET /api/coder/projects/c1/connectors": { connectors: [] },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/") && route.request().method() === "POST" && u.pathname.endsWith("/message") && st.hold) await st.hold;
    if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(route.request().method(), u.pathname)) });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#gfApp .cd-user", { timeout: 15000 });
  return { page, st, errors };
}
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); };
const words = (page) => page.locator("#gfApp .cd-boot-w").first().textContent();

test("in Chromium: each step only when the server names it; then Initialized session, folded; Ran a command", { skip: !chromium && "Playwright is not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser);
    // The chat's first answer is not there yet: a first message.
    st.events.length = 0;
    await page.fill("#cdIn", "Read the owner's preferences");
    await page.press("#cdIn", "Enter");
    // Nothing named yet by the server: only the dots and the seconds, however long it waits.
    await page.waitForSelector("#gfApp .cd-wait");
    await page.waitForTimeout(1500);
    assert.equal(await page.locator("#gfApp .cd-boot-w").count(), 0);
    await shot(page, "st-0-dots.png");
    const now = Date.now();
    st.state = { phase: "container", phaseAt: now - 3000 };
    await page.waitForSelector("#gfApp .cd-boot-w:has-text('Setting up a cloud container')");
    assert.match(await page.textContent("#gfApp .cd-boot .cd-boot-s"), /^[3-9]s$/, "counted from the server's phaseAt");
    await shot(page, "st-1-container.png");
    st.state = { phase: "clone", phaseAt: Date.now() - 2000, cold: true };
    await page.waitForSelector("#gfApp .cd-boot-w:has-text('Cloning repository')");
    await shot(page, "st-2-clone.png");
    st.state = { phase: "setup", phaseAt: Date.now(), cold: true };
    await page.waitForSelector("#gfApp .cd-boot-w:has-text('Running setup script')");
    await shot(page, "st-3-setup.png");
    // Ready: the machine's startup step; dots and seconds under it while Coder thinks.
    st.state = {};
    const t0 = Date.now();
    st.fresh = [{ type: "startup", at: t0, got: t0 - 9000, ms: 9000, steps: [{ k: "container", ms: 3000 }, { k: "clone", ms: 2000 }, { k: "setup", ms: 4000 }] }];
    await page.waitForSelector("#gfApp .cd-init-head");
    await page.waitForSelector("#gfApp .cd-wait");
    assert.equal(await page.locator("#gfApp .cd-boot-w").count(), 0);
    assert.match(await page.textContent("#gfApp .cd-init-head"), /^Initialized session ›$/);
    await shot(page, "st-4-initialized.png");
    // A step before Coder's first words: its description, live.
    st.fresh = [{ type: "bash", id: "b1", at: Date.now(), command: "cat docs/owner-preferences.md", desc: "Reading owner preferences" }];
    await page.waitForSelector("#gfApp .cd-boot-step .cd-boot-w:has-text('Reading owner preferences')");
    await shot(page, "st-5-step.png");
    // Done: the command folded, the answer, start-up quiet.
    st.fresh = [{ type: "result", id: "b1", code: 0, output: "..." }, { type: "done", text: "The owner likes plain English.", at: Date.now() }];
    st.running = false;
    await page.waitForSelector("#gfApp .cd-fold1 .cd-group-head:has-text('Ran a command')");
    assert.equal(await page.locator("#gfApp .cd-boot, #gfApp .cd-wait").count(), 0);
    await shot(page, "st-6-done-collapsed.png");
    await page.click("#gfApp .cd-init-head");
    await page.waitForSelector("#gfApp .cd-init-list");
    const list = await page.textContent("#gfApp .cd-init-list");
    for (const w of ["Set up a cloud container", "Cloned repository2s", "Ran setup script4s"]) assert.ok(list.includes(w), list);
    await page.click("#gfApp .cd-fold1 .cd-group-head");
    await page.waitForSelector("#gfApp .cd-fold1 .cd-cmd");
    await shot(page, "st-7-expanded.png");
    // A later message on an awake machine: the dots only.
    await page.fill("#cdIn", "Thanks");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector("#gfApp .cd-wait");
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("#gfApp .cd-boot-w").count(), 0);
    await shot(page, "st-8-awake.png");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("code: while the send is open the page looks at once, then every second; the Worker says the container step while starting or not answering yet", () => {
  const w = read("src/coder-routes.mjs"), js = read("public/coder.js");
  assert.match(js, /const SEND_WATCH_FIRST_MS = 500;/);
  assert.match(js, /const SEND_WATCH_MS = 1000;/);
  assert.match(js, /setTimeout\(\(\) => watchSend\(sent\), SEND_WATCH_FIRST_MS\);/);
  assert.match(w, /if \(Date\.now\(\) - \(meta\.at \|\| 0\) < START_GRACE_MS\) return json\(\{ ok: true, events: \[\], next: since, running: true, project: meta, phase: "container"/);
});

test("in Chromium: a new chat's first message shows Setting up a cloud container within a second, while the send is still open", { skip: !chromium && "Playwright is not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser);
    st.events.length = 0;
    let free; st.hold = new Promise((ok) => { free = ok; });
    // The Worker began setting up the machine 2 s ago (its starting mark: the chat says running), and the send has not answered.
    st.running = true;
    st.state = { phase: "container", phaseAt: Date.now() - 2000 };
    const t0 = Date.now();
    await page.fill("#cdIn", "Read the owner's preferences");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector("#gfApp .cd-boot-w:has-text('Setting up a cloud container')", { timeout: 2500 });
    assert.ok(Date.now() - t0 < 2500, "shown within the first look, not after 4 s");
    assert.match(await page.textContent("#gfApp .cd-boot .cd-boot-s"), /^[2-9]s$/, "counted from when the Worker began");
    await shot(page, "st-9-container-while-sending.png");
    st.hold = null; free();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("SL-LOOK (live, 2026-11-16) in a job's first minute a look at a machine that has not answered within START_LOOK_MS ends there and says the container step, so the page is told while it is real; later looks wait for the machine as before", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  const routes = await import("../src/coder-routes.mjs");
  assert.equal(routes.START_LOOK_MS, 1200);
  assert.match(src, /const young = meta\.status === "running" && since === 0 && Number\(meta\.turn\) <= 1 && Date\.now\(\) - Number\(meta\.at \|\| 0\) < 60_000;/, "only a new chat's first message before any step came back");
  assert.match(src, /s = young \? await Promise\.race\(\[look, new Promise\(\(res\) => setTimeout\(\(\) => res\(null\), START_LOOK_MS\)\)\]\) : await look;/);
  assert.match(src, /if \(Date\.now\(\) - \(meta\.at \|\| 0\) < START_GRACE_MS\) return json\(\{ ok: true, events: \[\], next: since, running: true, project: meta, phase: "container"/);
});

test("SL-SETUP (owner, 2026-11-16) the setup script is not a step in Coder's chat unless it failed; the start-up line says it ran", () => {
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(js, /if \(e\.tool === 'setup' && !GLOOPY && !\(results\[e\.id\] && Number\(results\[e\.id\]\.code\) !== 0\)\) return;/);
  assert.match(js, /setup: 'Ran setup script'/);
});

test("in Chromium: with the environment's saved copy, Claude Code's own start-up words (2026-11-18, the owner: \"match claude code pls\"; its start-up log): \"Restored saved setup\" when the chat started from it, \"Saving setup for next time\" when it makes it, named without a time between the machine and the clone; why a copy was not used is never shown", { skip: !chromium && "Playwright is not installed" }, async () => {
  const at = Date.now();
  const events = [
    { type: "user", text: "Hi", at: at - 60000 },
    { type: "startup", at: at - 59000, got: at - 63000, ms: 4000, steps: [{ k: "container", ms: 1000 }, { k: "restored", built: at - 3600e3 }, { k: "clone", ms: 3000 }] },
    { type: "done", text: "Hi.", at: at - 58000 },
    { type: "user", text: "Again", at: at - 30000 },
    { type: "startup", at: at - 29000, got: at - 38000, ms: 9000, steps: [{ k: "container", ms: 1000 }, { k: "saving" }, { k: "clone", ms: 2000 }, { k: "setup", ms: 6000 }], copyWhy: "late: this chat's machine was already started without it" },
    { type: "done", text: "Hi again.", at: at - 28000 },
  ];
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser, events);
    await page.waitForSelector("#gfApp .cd-init-head >> nth=1");
    await page.click("#gfApp .cd-init-head >> nth=0");
    await page.waitForSelector("#gfApp .cd-init.is-open");
    await page.click("#gfApp .cd-init:not(.is-open) .cd-init-head");
    await page.waitForFunction(() => document.querySelectorAll("#gfApp .cd-init.is-open").length === 2);
    const opened = await page.$$eval("#gfApp .cd-init.is-open", (ns) => ns.map((n) => [...n.querySelectorAll(".cd-init-list li")].map((l) => [l.querySelector("span").textContent, l.querySelector("b") ? l.querySelector("b").textContent : null])));
    assert.deepEqual(opened[0], [["Set up a cloud container", "1s"], ["Restored saved setup", null], ["Cloned repository", "3s"]], JSON.stringify(opened));
    assert.deepEqual(opened[1], [["Set up a cloud container", "1s"], ["Saving setup for next time", null], ["Cloned repository", "2s"], ["Ran setup script", "6s"]], JSON.stringify(opened));
    assert.ok(!(await page.textContent("#gfApp")).includes("already started without"), "why a copy was not used is never shown");
    assert.equal(await page.locator("#gfApp .cd-note").count(), 0);
    await shot(page, "st-9-saved-setup.png");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("in Chromium: a chat that starts from the environment's saved copy takes its repository from it and fetches it, in Claude Code's words (2026-11-18, the owner: \"finish this\"; its start-up log: \"Fetching repository\" from its saved setup): \"Fetching repository\" while it happens, \"Restored saved setup\" and \"Fetched repository\" once ready", { skip: !chromium && "Playwright is not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser);
    st.events.length = 0;
    await page.fill("#cdIn", "Run the tests");
    await page.press("#cdIn", "Enter");
    await page.waitForSelector("#gfApp .cd-wait");
    st.state = { phase: "fetch", phaseAt: Date.now() - 1000, cold: true };
    await page.waitForSelector("#gfApp .cd-boot-w:has-text('Fetching repository')");
    await shot(page, "st-10-fetching.png");
    const t0 = Date.now();
    st.state = {};
    st.fresh = [{ type: "startup", at: t0, got: t0 - 4000, ms: 4000, steps: [{ k: "container", ms: 1000 }, { k: "restored", built: t0 - 3600e3 }, { k: "fetch", ms: 2000 }] }];
    await page.waitForSelector("#gfApp .cd-init-head");
    st.fresh = [{ type: "done", text: "All 12 tests pass.", at: Date.now() }];
    st.running = false;
    await page.waitForFunction(() => document.querySelector("#gfApp").textContent.includes("All 12 tests pass.") && !document.querySelector("#gfApp .cd-wait"));
    await page.click("#gfApp .cd-init-head");
    await page.waitForSelector("#gfApp .cd-init-list");
    const items = await page.$$eval("#gfApp .cd-init-list li", (ls) => ls.map((l) => [l.querySelector("span").textContent, l.querySelector("b") ? l.querySelector("b").textContent : null]));
    assert.deepEqual(items, [["Set up a cloud container", "1s"], ["Restored saved setup", null], ["Fetched repository", "2s"]]);
    await shot(page, "st-11-fetched.png");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("code: the Worker passes the fetch step on; the machine names it only for a checkout that came with the copy", () => {
  const m = read("container/server.mjs"), w = read("src/coder-routes.mjs");
  assert.match(w, /\/\^\(container\|clone\|fetch\|setup\)\$\/\.test\(s\.phase\)/);
  assert.match(m, /if \(!existsSync\(join\(dir, "\.git"\)\)\) setPhase\(t, "clone"\);\n\s*else if \(copied && copied\.repo\) setPhase\(t, "fetch"\);/);
  const r = startupEvent({ got: 1000, cloneStart: 1500, cloneEnd: 3500, ready: 4000, fetched: true }, { restored: { at: 99 } });
  assert.deepEqual(r.steps, [{ k: "container", ms: 500 }, { k: "restored", built: 99 }, { k: "fetch", ms: 2000 }]);
});

test("machine: the start-up's record with the saved copy (Claude Code's steps): restored or saving after the machine, before the clone; why kept", () => {
  const r = startupEvent({ got: 1000, cloneStart: 1500, cloneEnd: 3500, ready: 4000 }, { restored: { at: 99 } });
  assert.deepEqual(r.steps, [{ k: "container", ms: 500 }, { k: "restored", built: 99 }, { k: "clone", ms: 2000 }]);
  const m = startupEvent({ got: 1000, cloneStart: 1500, cloneEnd: 3500, setupStart: 3600, setupEnd: 5600, ready: 6000 }, { saving: true, why: "" });
  assert.deepEqual(m.steps.map((x) => x.k), ["container", "saving", "clone", "setup"]);
  assert.equal(m.copyWhy, undefined);
  const w = startupEvent({ got: 1000, ready: 2000 }, { why: "missed: no room" });
  assert.equal(w.copyWhy, "missed: no room");
  assert.deepEqual(w.steps, [{ k: "container", ms: 1000 }]);
});
