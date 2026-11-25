// EACH MESSAGE AND STEP ONCE, AND THE WAITING CARD'S KEYS FROM THE BOX (live, 2026-11-25, deploy a8566f52, Grok on Low):
// every exchange of a chat showed twice; Esc did not deny the waiting card unless the card was clicked first.
// Bug 1's cause: while a message was still on its way (a new machine takes 20 s and more to set up), the page's idle look at
// the open chat (every 20 s) saw the new turn, loaded the chat and followed the job; the message's own answer then followed
// the job again from its first step, and the page added every step it had already drawn a second time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
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

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const keyOf = (e) => JSON.stringify(e);
const twice = (list) => list.filter((e, i) => list.findIndex((x) => keyOf(x) === keyOf(e)) !== i);

test("DE1 the Worker and Coder's real machine (a stand-in model): a command allowed on its card, then an edit denied on its card; the chat's saved log holds each step once, each message once", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp } = await import("../container/server.mjs");
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const dirs = await Promise.all(["root", "mem", "git", "bgr"].map((x) => mkdtemp(join(tmpdir(), "coder-de1-" + x + "-"))));
  let n = 0;
  const send = async (req) => {
    const ms = req.messages || [];
    if (ms.at(-1) && ms.at(-1).role === "tool") return say("Done.");
    const u = [...ms].reverse().find((x) => x.role === "user");
    return say("I'll write a.txt.", [call("bash", { command: "echo " + (/edit/.test(String(u && u.content)) ? "card" : "hi") + " > a.txt" }, "b" + n++)]);
  };
  const srv = http.createServer(createApp({ root: dirs[0], memRoot: dirs[1], gitRoot: dirs[2], bgRoot: dirs[3], send }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port;
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const uid = "user-1234567890abcdef", id = "shop-de1";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json", ek = "coder/" + uid + "/" + id + "/events.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "", base: "", branch: "", turn: 0, saved: 0, status: "idle", at: Date.now(), title: "", mode: "default" }));
  const box = () => ({ fetch: async (req) => { const u = new URL(req.url); const body = req.method === "GET" ? undefined : await req.text(); const r = await fetch(base + u.pathname + u.search, { method: req.method, headers: { "content-type": "application/json" }, body }); return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } }); } });
  const go = async (p, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + p, { ...init, headers: { "content-type": "application/json" } }), env, { waitUntil: (x) => x.catch(() => {}) }, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box }); return { status: r.status, data: await r.json().catch(() => null) }; };
  const meta = () => JSON.parse(m.get(mk));
  // One message: the page's looks while it works (the same start looked at twice, as two tabs or a look begun again do).
  const turn = async (text, choice) => {
    assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text, mid: "m" + Math.random().toString(36).slice(2, 12), mode: "default" }) })).status, 200);
    let card = null;
    for (let i = 0; i < 300 && !card; i++) { const s = await go("projects/" + id + "/state?since=0&early=1"); card = (s.data.events || []).find((e) => e.type === "permission"); if (!card) await new Promise((ok) => setTimeout(ok, 20)); }
    assert.ok(card, "the card waits");
    assert.equal((await go("projects/" + id + "/answer", { method: "POST", body: JSON.stringify({ pid: card.pid, choice }) })).status, 200);
    for (let i = 0; i < 300 && !(meta().status !== "running" && meta().saved >= meta().turn); i++) { await go("projects/" + id + "/state?since=0&early=1"); await go("projects/" + id + "/state?since=0&turn=" + meta().turn); await new Promise((ok) => setTimeout(ok, 20)); }
    assert.equal(meta().status, "idle");
  };
  try {
    await turn("run: echo hi > a.txt", "yes");
    await turn("Use your file edit tool to change a.txt", "no");
    const saved = JSON.parse(m.get(ek));
    assert.deepEqual(twice(saved), [], "no step saved twice");
    assert.deepEqual(saved.filter((e) => e.type === "user").map((e) => e.text), ["run: echo hi > a.txt", "Use your file edit tool to change a.txt"]);
    assert.deepEqual(saved.filter((e) => e.type === "permanswer").map((e) => e.choice), ["yes", "no"]);
    assert.equal(saved.filter((e) => e.type === "startup").length <= 2, true);
    // The page's load of the chat: each once too.
    const open = await go("projects/" + id);
    assert.deepEqual(twice(open.data.events), []);
  } finally { await fetch(base + "/stop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id }) }).catch(() => {}); await new Promise((ok) => { srv.close(ok); srv.closeAllConnections && srv.closeAllConnections(); }); }
});

test("DE2 the Worker's save adds only the steps the chat does not hold yet (newSteps): the same step sent again is left out; steps without a time are kept", async () => {
  const { newSteps } = await import("../src/coder-routes.mjs");
  const a = { at: 5, type: "user", text: "go" }, b = { at: 6, type: "text", text: "ok" }, c = { at: 7, type: "done", text: "ok" };
  assert.deepEqual(newSteps([a, b], [a, b, c]), [c]);
  assert.deepEqual(newSteps([], [a, a, b]), [a, b]);
  assert.deepEqual(newSteps([a], [{ ...a, text: "go again" }]), [{ ...a, text: "go again" }], "a different step at the same time is kept");
  assert.deepEqual(newSteps([{ type: "note", text: "x" }], [{ type: "note", text: "x" }]), [{ type: "note", text: "x" }], "no time: kept as before");
  assert.deepEqual(newSteps(null, null), []);
  assert.match(readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), /const fresh = newSteps\(old, Array\.isArray\(all\.events\) \? all\.events : \[\]\);/);
});

/** A first message whose start takes a while (a new machine), with the job's steps on the machine as it goes (`since`). */
async function firstMessage(browser, { during }) {
  const p = { id: "c1", title: "", repo: "ana/shop", base: "main", branch: "coder/c1", status: "idle", mode: "default", turn: 0, at: Date.now() };
  const run = { ...p, title: "run: echo hi > a.txt", status: "running", turn: 1, asked: { turn: 1, at: Date.now(), text: "run: echo hi > a.txt" } };
  let sentAt = 0;
  const steps = () => (!sentAt || Date.now() - sentAt < 400 ? [] : [{ type: "startup", at: sentAt + 1, ms: 30, steps: [] }, { type: "user", text: "run: echo hi > a.txt", at: sentAt + 2 }, { type: "text", text: "I'll create it.", at: sentAt + 3 }, { type: "bash", id: "b1", command: "echo hi > a.txt", at: sentAt + 4 }, { type: "permission", pid: "p1abcdef", tool: "bash", id: "b1", lines: ["echo hi > a.txt"], rules: ["Bash(echo hi > a.txt)"], at: sentAt + 5 }]);
  const o = await openPage(browser, {
    project: p,
    slow: { "POST /api/coder/projects/c1/message": 5000 },
    api: (m, pth, body, st, u) => {
      if (m === "POST" && pth === "/api/coder/projects/c1/message") return { ok: true, project: run };
      if (m === "GET" && pth === "/api/coder/projects/c1" && sentAt) return { project: { ...run }, events: [], queue: [] };
      if (pth === "/api/coder/projects/c1/state") { const since = Number(u.searchParams.get("since")) || 0, ev = steps(); return sentAt ? { running: true, events: ev.slice(since), next: Math.max(since, ev.length), project: run } : { running: false, events: [], next: 0, project: p }; }
    },
  });
  await o.page.waitForSelector("#cdIn", { timeout: 15000 });
  await o.page.click("#cdIn");
  await o.page.keyboard.type("run: echo hi > a.txt");
  sentAt = Date.now();
  await o.page.keyboard.press("Enter");
  await during(o.page);
  await o.page.waitForSelector(".cd-pl.is-live", { timeout: 15000 });
  await wait(6500);
  return o;
}
const bubbles = (page) => page.evaluate(() => [...document.querySelectorAll("#cdLog .cd-user .cd-bubble")].map((b) => b.textContent));

test("DE3 the page: the idle look at the open chat while the first message is still on its way (the live case) no longer draws the message and its steps twice", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    // (The idle look comes every 20 s, or when the tab is shown again: here, the tab shown again while the message starts.)
    const { page, errors } = await firstMessage(browser, { during: async (pg) => { await wait(700); await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); } });
    assert.deepEqual(await bubbles(page), ["run: echo hi > a.txt"]);
    assert.equal(await page.locator(".cd-init").count(), 1, "one Initialized session");
    assert.equal(await page.locator(".cd-pl.is-live").count(), 1, "one card");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("DE4 the page: a chat saved with steps twice (before this fix) shows each once; the same steps brought again by a look are not added", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const t = Date.now() - 60000;
    const turn = [{ type: "startup", at: t + 1, ms: 30, steps: [] }, { type: "user", text: "Use your file edit tool", at: t + 2 }, { type: "text", text: "I'll update a.txt.", at: t + 3 }, { type: "done", text: "Okay.", at: t + 4 }];
    const p = { id: "c1", title: "Edit", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "default", turn: 2, at: Date.now() };
    let looks = 0;
    const { page, errors } = await openPage(browser, {
      project: p, events: [...turn, ...turn],
      api: (m, pth) => (pth === "/api/coder/projects/c1/state" ? (looks++, { running: true, events: turn, next: turn.length, project: p }) : undefined),
    });
    await page.waitForFunction(() => /I'll update a\.txt\./.test((document.querySelector("#cdLog") || {}).textContent || ""), null, { timeout: 15000 });
    for (let i = 0; i < 100 && looks < 2; i++) await wait(50);
    await wait(300);
    assert.deepEqual(await bubbles(page), ["Use your file edit tool"]);
    assert.equal(await page.evaluate(() => (document.querySelector("#cdLog").textContent.match(/I'll update a\.txt\./g) || []).length), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// ── BUG 4: THE WAITING CARD'S KEYS WITHOUT CLICKING IT ──
async function cardPage(browser) {
  const p = { id: "c1", title: "Run", repo: "ana/shop", base: "main", branch: "coder/c1", status: "running", mode: "default", turn: 1, at: Date.now() };
  const card = { type: "permission", pid: "pkey1234", tool: "bash", id: "b1", lines: ["npm install express"], rules: ["Bash(npm install *)"], at: Date.now() };
  const answers = [];
  const o = await openPage(browser, {
    project: p, events: [{ type: "user", text: "Install express", at: Date.now() - 2000 }, { type: "bash", id: "b1", command: "npm install express", at: Date.now() - 1000 }, card],
    api: (m, pth, body) => {
      if (m === "POST" && /\/answer$/.test(pth)) { answers.push(body); return { ok: true }; }
      if (pth === "/api/coder/projects/c1/state") return { running: true, events: [], next: 3, project: p };
    },
  });
  await o.page.waitForSelector(".cd-pl.is-live", { timeout: 15000 });
  return { ...o, answers };
}
const answersSoon = async (answers, n = 1) => { for (let i = 0; i < 60 && answers.length < n; i++) await wait(50); return answers.map((a) => a.choice); };

test("DE5 Esc in the empty box denies the waiting card without clicking it; Esc with text in the box does not (the box keeps its own)", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    let { page, answers, errors } = await cardPage(browser);
    await page.click("#cdIn");
    await page.keyboard.type("wait");
    await page.keyboard.press("Escape");
    await wait(400);
    assert.deepEqual(answers, [], "typing in the box: Esc is the box's");
    assert.equal(await page.inputValue("#cdIn"), "wait");
    await page.fill("#cdIn", "");
    await page.keyboard.press("Escape");
    assert.deepEqual(await answersSoon(answers), ["no"]);
    assert.equal(answers[0].pid, "pkey1234");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("DE6 Enter in the empty box allows the waiting card, Cmd/Ctrl+Enter always; with text in the box Enter sends the reply as before (deny, and tell Coder); Esc with nothing focused denies", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    {
      const { page, answers } = await cardPage(browser);
      await page.click("#cdIn");
      await page.keyboard.press("Enter");
      assert.deepEqual(await answersSoon(answers), ["yes"]);
    }
    {
      const { page, answers } = await cardPage(browser);
      await page.click("#cdIn");
      await page.keyboard.press("Control+Enter");
      assert.deepEqual(await answersSoon(answers), ["always"]);
    }
    {
      const { page, answers } = await cardPage(browser);
      await page.click("#cdIn");
      await page.keyboard.type("use yarn instead");
      await page.keyboard.press("Enter");
      assert.deepEqual(await answersSoon(answers), ["no"], "the box's own Enter: a reply denies and tells Coder, never Allow");
      assert.equal(answers[0].comment, "use yarn instead");
    }
    {
      const { page, answers } = await cardPage(browser);
      await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
      await page.keyboard.press("Escape");
      assert.deepEqual(await answersSoon(answers), ["no"]);
    }
  } finally { await browser.close(); }
});
