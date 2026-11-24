// THE FRONTEND AUDIT OF 2026-11-24 ("sometimes does things that are just wrong"): each fix tried in the page, with real
// mouse clicks and keys, against stubbed answers; and the Worker's part (one chat per pick, waiting messages' ids).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

const PUB = process.env.FA_PUB || new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.FA_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const skip = !chromium && "playwright not installed";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The page with Coder's API stubbed. `api(method, path, body, st)` answers what it knows (or undefined for the defaults);
 * `slow[method + " " + path]` holds an answer back for that many ms.
 */
async function openPage(browser, { api = () => undefined, slow = {}, project = null, events = [], dark = false, width = 1200 } = {}) {
  const ORIGIN = "https://gofarther.test";
  const st = { calls: [], posts: [] };
  const p0 = project || { id: "c1", title: "Fix the tests", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "default", turn: 1, at: Date.now() };
  const defaults = (m, p) => ({
    "GET /api/coder/github": { connected: true, login: "ana" },
    "GET /api/coder/projects": { projects: [p0] },
    ["GET /api/coder/projects/" + p0.id]: { project: p0, events, queue: [] },
    "GET /api/coder/settings": { prefs: {}, pick: { model: "grok-4", effort: "low", mode: "default" } },
    "GET /api/coder/github/repos": { repos: [{ repo: "ana/shop" }, { repo: "ana/blog" }] },
    ["GET /api/coder/projects/" + p0.id + "/env"]: { envId: "e1", name: "Staging", environments: [{ id: "e1", name: "Staging" }] },
    ["GET /api/coder/projects/" + p0.id + "/branches"]: { branches: ["main", "dev"] },
  }[m + " " + p]);
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) {
      const body = req.postData();
      const key = m + " " + u.pathname;
      st.calls.push({ key, body: body ? JSON.parse(body) : null, at: Date.now(), search: u.search });
      if (m !== "GET") st.posts.push({ key, body: body ? JSON.parse(body) : null });
      if (u.pathname.endsWith("/stream")) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      if (slow[key]) await wait(slow[key]);
      let got = await api(m, u.pathname, body ? JSON.parse(body) : null, st, u);
      if (got === undefined) got = defaults(m, u.pathname);
      if (got === undefined) got = { ok: true };
      const status = got && got.__status ? got.__status : 200;
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(got) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  return { page, st, errors, ctx };
}
const shot = async (page, name, sel) => { if (!SHOTS) return; if (sel) await page.locator(sel).first().screenshot({ path: path.join(SHOTS, name) }); else await page.screenshot({ path: path.join(SHOTS, name) }); };
const clickCenter = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };

// ── THE WORKER ──
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function worker() {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const fetchFn = async (u) => (String(u).includes("/repos/ana/shop") ? Response.json({ full_name: "ana/shop", default_branch: "main", permissions: { push: true } }) : new Response("{}", { status: 404 }));
  const go = async (p, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + p, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn, authUser: async () => ({ id: uid, email: "Me@x.y" }), container: () => ({ fetch: async () => Response.json({ ok: true }) }) }); return { status: r.status, data: await r.json() }; };
  return { R, go, bucket, uid };
}

test("FA1 a new chat asked for twice with the same name is made once (a double click, a request sent again)", async () => {
  const w = await worker();
  const a = await w.go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop", cid: "nabc12345" }) });
  const b = await w.go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop", cid: "nabc12345" }) });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.data.project.id, b.data.project.id);
  assert.equal(b.data.again, true);
  assert.equal((await w.go("projects")).data.projects.length, 1);
  // (Another name is another chat; no name, as before.)
  const c = await w.go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop", cid: "nxyz98765" }) });
  assert.notEqual(c.data.project.id, a.data.project.id);
  assert.equal((await w.go("projects")).data.projects.length, 2);
});

test("FA2 messages that waited go out with an id of their own, so a start sent again never runs one twice", async () => {
  const { queuedMid } = await import("../src/coder-routes.mjs");
  assert.deepEqual(queuedMid([{ qid: "qabc", text: "x", mid: "mpage12345" }]), { mid: "mpage12345" });
  assert.deepEqual(queuedMid([{ qid: "qabc123", text: "x" }]), { mid: "qqabc123" });
  const two = queuedMid([{ qid: "qa1", text: "x", mid: "m11111111" }, { qid: "qb2", text: "y" }]);
  assert.match(two.mid, /^qs[A-Za-z0-9]{8,40}$/);
  assert.deepEqual(queuedMid([]), {});
  // (Every place that sends what waits gives one.)
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.equal((src.match(/fromQueue: true \}\)/g) || []).length, 0, "no start of waiting messages without its id");
});

test("FA3 dark theme: made from the light style sheets and up to date", () => {
  const r = spawnSync(process.execPath, [new URL("../make-dark-css.mjs", import.meta.url).pathname, "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const html = readFileSync(PUB + "index.html", "utf8");
  assert.ok(html.indexOf("/coder-dark.css") > html.indexOf("/coder-projects.css"), "loaded last");
  // (The stray tooltip rule that made it pale on a light page is gone.)
  assert.doesNotMatch(readFileSync(PUB + "app.css", "utf8"), /prefers-color-scheme/);
});

// ── THE PAGE ──
test("FA4 picking a repository: busy at once, a double click makes one chat, with its name", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, st, errors } = await openPage(browser, {
      slow: { "POST /api/coder/projects": 1200 },
      api: (m, p, body) => {
        if (m === "GET" && p === "/api/coder/projects") return { projects: [] };
        if (m === "POST" && p === "/api/coder/projects") return { project: { id: "n1", title: "", repo: body.repo, base: "main", branch: "coder/n1", status: "idle", mode: "default", turn: 0, at: Date.now() } };
        if (p === "/api/coder/projects/n1") return { project: { id: "n1", title: "", repo: "ana/blog", base: "main", branch: "coder/n1", status: "idle", mode: "default", turn: 0, at: Date.now() }, events: [], queue: [] };
      },
    });
    await page.waitForSelector('.cd-repo[data-repo="ana/blog"]', { timeout: 15000 });
    await page.dblclick('.cd-repo[data-repo="ana/blog"]');
    await page.waitForSelector('.cd-repo.is-busy[data-repo="ana/blog"]', { timeout: 2000 });
    assert.match(await page.textContent(".cd-repo.is-busy"), /Opening…/);
    assert.equal(await page.$eval('.cd-repo[data-repo="ana/shop"]', (b) => b.disabled), true);
    await shot(page, "J-after-repo-busy.png", ".cd-repos");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#cdIn", { timeout: 8000 });
    const made = st.posts.filter((x) => x.key === "POST /api/coder/projects");
    assert.equal(made.length, 1, "one chat");
    assert.match(made[0].body.cid, /^n[a-z0-9]{8,}$/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA5 opening Coder: a neutral loading state, never 'Connect GitHub' or an empty new chat before the last chat", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser, { slow: { "GET /api/coder/github": 700, "GET /api/coder/projects/c1": 900 }, events: [{ type: "user", text: "Run the tests", at: Date.now() - 60000 }, { type: "done", text: "All green.", at: Date.now() - 50000 }] });
    const seen = new Set();
    const t0 = Date.now();
    let shotTaken = false;
    while (Date.now() - t0 < 4000) {
      const s = await page.evaluate(() => ({ side: (document.querySelector("#gfRecents") || {}).textContent || "", main: (document.querySelector("#gfApp") || {}).textContent || "" }));
      if (/Connect GitHub to start/.test(s.side)) seen.add("connect");
      if (/What should we work on/.test(s.main)) seen.add("empty");
      if (/Loading chat/.test(s.main)) { seen.add("loading"); if (!shotTaken) { shotTaken = true; await shot(page, "F-after-loading.png"); } }
      if (/All green/.test(s.main)) break;
      await wait(60);
    }
    assert.ok(!seen.has("connect"), "no Connect GitHub while loading");
    assert.ok(!seen.has("empty"), "no empty new chat before the last chat");
    assert.ok(seen.has("loading"));
    await page.waitForFunction(() => /All green/.test(document.querySelector("#gfApp").textContent));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA6 a reload while Coder sets up: your bubble, the timer from when it was sent, the branch and environment chips", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const sentAt = Date.now() - 42000;
    const p = { id: "c1", title: "Add a README", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "default", turn: 1, at: sentAt, asked: { turn: 1, at: sentAt, text: "Add a README with setup steps" } };
    const { page, errors } = await openPage(browser, {
      project: p,
      api: (m, path) => (path === "/api/coder/projects/c1/state" ? { running: true, events: [], next: 0, project: p, phase: "container", phaseAt: sentAt } : undefined),
    });
    await page.waitForFunction(() => /Add a README with setup steps/.test(document.querySelector("#cdLog") ? document.querySelector("#cdLog").textContent : ""), null, { timeout: 15000 });
    await page.waitForSelector(".cd-boot-s, .cd-wait .cd-boot-s");
    const secs = Number((await page.textContent(".cd-boot-s")).replace(/\D/g, ""));
    assert.ok(secs >= 40, "timer from when it was sent, got " + secs);
    await page.waitForSelector(".cd-pick-ro.cd-pick-branch");
    await page.waitForSelector(".cd-pick-ro.cd-pick-env");
    assert.match(await page.textContent(".cd-pick-ro.cd-pick-branch"), /coder\/c1/);
    assert.match(await page.textContent(".cd-pick-ro.cd-pick-env"), /Staging/);
    await shot(page, "C-after-reload-running.png");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA7 Stop shows at once after sending, Enter queues a second message, Stop works while the first is on its way", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const p = { id: "c1", title: "", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "default", turn: 0, at: Date.now() };
    const { page, st, errors } = await openPage(browser, {
      project: p,
      slow: { "POST /api/coder/projects/c1/message": 4000 },
      api: (m, path, body, s) => {
        if (m === "POST" && path === "/api/coder/projects/c1/message") {
          const n = s.posts.filter((x) => x.key === "POST /api/coder/projects/c1/message").length;
          return n === 1 ? { __status: 409, error: "This message didn't start: Coder was stopped, or another message started first. Send it again if you still want it." } : { ok: true, queued: true, qid: "q1", queue: [{ qid: "q1", text: body.text, at: Date.now() }], project: { ...p, status: "running" } };
        }
        if (m === "POST" && path === "/api/coder/projects/c1/stop") return { ok: true, reload: true };
        if (path === "/api/coder/projects/c1/state") return { running: true, events: [], next: 0, project: { ...p, status: "running" }, phase: "container", phaseAt: Date.now() };
      },
    });
    await page.waitForSelector("#cdIn", { timeout: 15000 });
    await page.click("#cdIn");
    await page.keyboard.type("Run the tests");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#cdStop", { timeout: 600 });
    await shot(page, "D-after-stop-at-once.png", ".cd-composewrap");
    await page.click("#cdIn");
    await page.keyboard.type("And then lint");
    await page.keyboard.press("Enter");
    for (let k = 0; k < 40 && st.posts.filter((x) => x.key === "POST /api/coder/projects/c1/message").length < 2; k++) await wait(50);
    const msgs = st.posts.filter((x) => x.key === "POST /api/coder/projects/c1/message");
    assert.equal(msgs.length, 2, "the second went out while the first was on its way");
    assert.equal(msgs[1].body.text, "And then lint");
    await page.waitForFunction(() => /And then lint/.test(document.querySelector("#cdLog").textContent));
    assert.equal(await page.inputValue("#cdIn"), "");
    await page.click("#cdStop");
    for (let k = 0; k < 40 && !st.posts.some((x) => x.key === "POST /api/coder/projects/c1/stop"); k++) await wait(50);
    assert.ok(st.posts.some((x) => x.key === "POST /api/coder/projects/c1/stop"));
    // (The first start's late 409 after the Stop puts nothing back in the box.)
    await wait(4200);
    assert.equal(await page.inputValue("#cdIn"), "");
    assert.equal(await page.$(".cd-errbar"), null);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA8 live: a new title and the end of the job reach the sidebar without a reload", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const p = { id: "c1", title: "Run the tests", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "default", turn: 1, at: Date.now() };
    let looks = 0;
    const { page, errors } = await openPage(browser, {
      project: p,
      events: [{ type: "user", text: "Run the tests", at: Date.now() }],
      api: (m, path) => {
        // (The answer is shown and the job ends on the page while the Worker still saves it: the chat's record still says
        // "running", with its old title, for a long while; the chat list already has the new title.)
        if (path === "/api/coder/projects/c1/state") { looks++; return looks < 3 ? { running: true, events: [], next: 1, project: p } : { running: false, events: [{ type: "done", text: "Done.", at: Date.now() }], next: 2, project: p }; }
        if (m === "GET" && path === "/api/coder/projects/c1" && looks >= 3) return { project: p, events: [{ type: "user", text: "Run the tests", at: Date.now() }], queue: [] };
        if (m === "GET" && path === "/api/coder/projects" && looks >= 3) return { projects: [{ ...p, status: "running", title: "Make the tests pass" }] };
      },
    });
    await page.waitForSelector('.gf-item[data-chat="c1"] .gf-dot', { timeout: 15000 });
    await page.waitForFunction(() => /Make the tests pass/.test(document.querySelector('.gf-item[data-chat="c1"]').textContent), null, { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('.gf-item[data-chat="c1"] .gf-dot'), null, { timeout: 5000 });
    await shot(page, "E-after-sidebar-live.png", "#gfRecents");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA9 More > Tools opens on a click in the middle of the item, the ! sits at its right edge; Hooks opens the hooks list", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser, {
      api: (m, path) => {
        if (path === "/api/coder/tool-choices") return { rows: [], groups: [], choices: {} };
        if (m === "GET" && path === "/api/coder/settings") return { prefs: { hooks: JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "npx prettier --write ." }] }] } }) }, pick: { model: "grok-4", effort: "low" } };
        if (path === "/api/coder/plugins") return { installed: [] };
      },
    });
    await page.waitForSelector("#cdSideMore:not([disabled])", { timeout: 15000 });
    await page.click("#cdSideMore");
    await page.waitForSelector("#cdSideTools");
    const btn = await page.locator("#cdSideTools").boundingBox(), bang = await page.locator("#cdSideTools .gf-sinfo").boundingBox();
    assert.ok(bang.x + bang.width >= btn.x + btn.width - 16, "the ! at the right edge");
    await shot(page, "G-after-more-menu.png", "#gfColTools");
    await clickCenter(page, "#cdSideTools");
    await page.waitForSelector(".cd-tools-modal", { timeout: 3000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".cd-tools-modal"));
    await page.click("#cdSidePlugins");
    await page.waitForSelector("#cdSideHooks");
    await clickCenter(page, "#cdSideHooks");
    await page.waitForSelector(".gf-sidelist", { timeout: 3000 });
    const txt = await page.textContent(".gf-sidelist");
    assert.match(txt, /Hooks[\s\S]*PostToolUse · Edit\|Write[\s\S]*npx prettier --write/);
    assert.equal(await page.$("#cdSetHooks"), null, "not Settings");
    await shot(page, "M-after-hooks-list.png", ".gf-sidelist");
    await page.click("#cdHooksEdit");
    await page.waitForSelector("#cdSetHooks", { timeout: 3000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA10 Esc and a click outside close the title menu, the row menu and the Environment window", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors } = await openPage(browser, {
      api: (m, path) => (path === "/api/coder/projects/c1/env" ? { envId: "e1", name: "Staging", environments: [{ id: "e1", name: "Staging" }], script: "", vars: [], varsText: "", secrets: [], network: { mode: "full", hosts: [] } } : undefined),
    });
    await page.waitForSelector("#cdTitleMore", { timeout: 15000 });
    await page.click("#cdTitleMore");
    await page.waitForSelector(".cd-title-menu");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".cd-title-menu"));
    await page.click("#cdTitleMore");
    await page.waitForSelector(".cd-title-menu");
    await page.mouse.click(700, 500);
    await page.waitForFunction(() => !document.querySelector(".cd-title-menu"), null, { timeout: 2000 });
    await shot(page, "H-after-title-menu-closed.png");
    await page.hover('.gf-item[data-chat="c1"]');
    await page.click('[data-rowmenu="c1"]');
    await page.waitForSelector(".gf-rowmenu");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".gf-rowmenu"), null, { timeout: 2000 });
    await page.click("#cdEnv");
    await page.waitForSelector("#envWrap", { timeout: 3000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#envWrap"), null, { timeout: 2000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA11 a question Coder waits on shows only that it needs your input: no working dots, no Stop", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const p = { id: "c1", title: "Pick a stack", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "default", turn: 1, at: Date.now() };
    const q = { type: "question", pid: "pq1", text: "Which framework?", questions: [{ question: "Which framework?", header: "Stack", options: [{ label: "React" }, { label: "Vue" }] }], at: Date.now() };
    const { page, errors } = await openPage(browser, {
      project: p,
      events: [{ type: "user", text: "Set up the app", at: Date.now() - 5000 }, q],
      api: (m, path) => (path === "/api/coder/projects/c1/state" ? { running: true, events: [], next: 2, project: p } : undefined),
    });
    await page.waitForSelector(".cd-ask.is-live", { timeout: 15000 });
    await page.waitForSelector(".cd-ask-wait");
    await wait(800);
    assert.equal(await page.$(".cd-wait-dots"), null);
    assert.equal(await page.$(".cd-wait"), null);
    assert.equal(await page.$("#cdStop"), null);
    await shot(page, "K-after-question-waits.png");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA12 removing a chat: greyed out with Removing… until the server says it is gone", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const other = { id: "c2", title: "Old idea", repo: "ana/blog", base: "main", branch: "coder/c2", status: "idle", mode: "default", turn: 1, at: Date.now() - 1000 };
    let gone = false;
    const { page, errors } = await openPage(browser, {
      slow: { "DELETE /api/coder/projects/c2": 1500 },
      api: (m, path) => {
        if (m === "GET" && path === "/api/coder/projects") return { projects: [{ id: "c1", title: "Fix the tests", repo: "ana/shop", status: "idle", at: Date.now() }, ...(gone ? [] : [other])] };
        if (m === "DELETE" && path === "/api/coder/projects/c2") { gone = true; return { ok: true }; }
      },
    });
    await page.waitForSelector('.gf-item[data-chat="c2"]', { timeout: 15000 });
    await page.hover('.gf-item[data-chat="c2"]');
    await page.click('.gf-item[data-chat="c2"] .gf-x');
    await page.click(".cd-sure .cd-sure-yes");
    await page.waitForSelector('.gf-item.is-removing[data-chat="c2"]', { timeout: 1000 });
    assert.match(await page.textContent('.gf-item[data-chat="c2"]'), /Removing…/);
    await shot(page, "L-after-removing.png", "#gfRecents");
    await page.waitForFunction(() => !document.querySelector('.gf-item[data-chat="c2"]'), null, { timeout: 5000 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA13 See changes says it is loading; a step not run says why", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const now = Date.now();
    const { page, errors } = await openPage(browser, {
      slow: { "GET /api/coder/projects/c1/changes": 1500 },
      project: { id: "c1", title: "Clean up", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "default", turn: 1, at: now, commits: [{ sha: "abcdef1", turn: 1 }] },
      events: [{ type: "user", text: "Delete the build folder", at: now - 9000 }, { type: "bash", id: "b1", command: "rm -rf build", at: now - 8000 }, { type: "result", id: "b1", code: -1, ran: false, output: "Not run: you said no." }, { type: "done", text: "Left it as it is.", at: now - 7000 }],
      api: (m, path) => (path === "/api/coder/projects/c1/changes" ? { files: [], add: 0, del: 0 } : undefined),
    });
    await page.waitForSelector(".cd-st-why", { timeout: 15000 });
    assert.equal(await page.textContent(".cd-st-why"), "you said no.");
    assert.equal(await page.getAttribute(".cd-st-bad", "title"), "you said no.");
    await shot(page, "M-after-not-run-reason.png", "#cdLog");
    await page.click("#cdChanges");
    await page.waitForSelector(".cd-changes-loading", { timeout: 1000 });
    assert.match(await page.textContent(".cd-changes"), /Loading changes…/);
    await shot(page, "M-after-changes-loading.png");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA14 quick chat switches never show the chat clicked before; the model and mode picks do not revert", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const a = { id: "ca", title: "Chat A", repo: "ana/shop", base: "main", branch: "coder/ca", status: "idle", mode: "default", turn: 1, at: Date.now() };
    const b = { id: "cb", title: "Chat B", repo: "ana/shop", base: "main", branch: "coder/cb", status: "idle", mode: "default", turn: 1, at: Date.now() - 10 };
    let modeAsked = 0;
    const { page, st, errors } = await openPage(browser, {
      project: { ...a, id: "c0", title: "Start" },
      slow: { "GET /api/coder/projects/ca": 1500, "POST /api/coder/projects/c0/mode": 1500 },
      api: (m, path) => {
        if (m === "GET" && path === "/api/coder/projects") return { projects: [{ ...a, id: "c0", title: "Start" }, a, b] };
        if (path === "/api/coder/projects/ca") return { project: a, events: [{ type: "user", text: "message in A", at: Date.now() }], queue: [] };
        if (path === "/api/coder/projects/cb") return { project: b, events: [{ type: "user", text: "message in B", at: Date.now() }], queue: [] };
        if (path === "/api/coder/projects/c0/mode") { modeAsked++; return { project: { ...a, id: "c0", mode: "acceptEdits", modeAt: Date.now() } }; }
      },
    });
    await page.waitForSelector("#cdMode", { timeout: 15000 });
    // The model, then the mode: the pick keeps its mode, and the mode stays shown while it is being saved.
    await page.selectOption("#cdModel", { index: 0 });
    await page.click("#cdMode");
    await page.click('[data-mode="acceptEdits"]');
    await wait(300);
    assert.match(await page.getAttribute("#cdMode", "class"), /is-acceptEdits/);
    await wait(1600);
    assert.match(await page.getAttribute("#cdMode", "class"), /is-acceptEdits/);
    assert.equal(modeAsked, 1);
    const saved = st.posts.filter((x) => x.key === "POST /api/coder/settings").pop();
    if (saved) assert.equal(saved.body.mode, "default", "the pick kept its mode");
    // A, then B before A has loaded.
    await page.click('.gf-item[data-chat="ca"]');
    await wait(100);
    await page.click('.gf-item[data-chat="cb"]');
    await page.waitForFunction(() => /message in B/.test(document.querySelector("#cdLog").textContent));
    await wait(1800);
    const log = await page.textContent("#cdLog");
    assert.match(log, /message in B/);
    assert.doesNotMatch(log, /message in A/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("FA15 dark mode: the page, the sidebar and the chat are dark; light mode stays light", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    for (const dark of [true, false]) {
      const { page, errors, ctx } = await openPage(browser, { dark, events: [{ type: "user", text: "Run the tests", at: Date.now() - 60000 }, { type: "done", text: "All green.", at: Date.now() - 50000 }] });
      await page.waitForFunction(() => /All green/.test(document.querySelector("#gfApp").textContent), null, { timeout: 15000 });
      const lum = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : -1; };
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const side = await page.evaluate(() => getComputedStyle(document.querySelector(".gf-sidewrap")).backgroundColor);
      const box = await page.evaluate(() => { let el = document.querySelector("#cdIn"); while (el && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(el).backgroundColor)) el = el.parentElement; return el ? getComputedStyle(el).backgroundColor : ""; });
      const text = await page.evaluate(() => getComputedStyle(document.querySelector("#cdLog .cd-thread")).color);
      if (dark) { assert.ok(lum(bg) < 0.25 && lum(side) < 0.3 && lum(box) < 0.3, [bg, side, box].join(" ")); assert.ok(lum(text) > 0.7, text); }
      else { assert.ok(lum(bg) > 0.9 && lum(side) > 0.85, [bg, side].join(" ")); assert.ok(lum(text) < 0.3, text); }
      await shot(page, dark ? "I-after-dark.png" : "I-after-light.png");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});
