// THE CHANGED-FILES BOX UNDER CODER'S ANSWER, LIKE CLAUDE CODE ON THE WEB (2026-11-16): "Created 2 files" with Undo, a row
// per file with +N −M, "See all" past three files; Coder's only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOT = process.env.CD_FILES_SHOT || "";

function logic() {
  const js = read("public/coder.js");
  const src = js.slice(js.indexOf("const FILES_BOX_ROWS"), js.indexOf("function filesBoxHTML"));
  return new Function(src + "; return { turnFiles, filesBoxWords };")();
}
const w = (id, tool, p, kind, add, del) => [{ type: "bash", id, tool, command: p }, { type: "result", id, code: 0, change: { kind, add, del, lines: [] } }];

test("the files of a turn: writes, edits and a command's files, added up per file", () => {
  const { turnFiles, filesBoxWords } = logic();
  const ev = [
    { type: "user", text: "old" }, ...w("o", "write", "old.js", "create", 9, 0), { type: "done", text: "x" },
    { type: "user", text: "new" }, ...w("a", "write", "src/a.js", "create", 3, 0), ...w("b", "edit", "src/b.js", "update", 2, 1), ...w("b2", "edit", "src/b.js", "update", 1, 1),
    { type: "bash", id: "c", command: "npm run fmt" }, { type: "result", id: "c", code: 0, files: { files: [{ path: "src/c.js", kind: "delete", del: 4 }] } },
    { type: "done", text: "y" },
  ];
  const f = turnFiles(ev, ev.length - 1);
  assert.deepEqual(f.map((x) => [x.path, x.kind, x.add, x.del]), [["src/a.js", "create", 3, 0], ["src/b.js", "update", 3, 2], ["src/c.js", "delete", 0, 4]]);
  assert.equal(filesBoxWords(f), "Changed 3 files");
  assert.equal(filesBoxWords(f.slice(0, 1)), "Created 1 file");
  assert.equal(filesBoxWords(f.slice(1, 2)), "Edited 1 file");
  assert.deepEqual(turnFiles(ev, 3).map((x) => x.path), ["old.js"]);
  assert.deepEqual(turnFiles([{ type: "user" }, { type: "done" }], 1), []);
});

test("the code: Coder's only, its CSS under #gfApp, See all opens See changes, Undo restores code only", () => {
  const js = read("public/coder.js"), css = read("public/coder.css");
  assert.match(js, /\(GLOOPY \? '' : aiMetaHTML\(e, i\)\)/);
  assert.match(js, /function aiMetaHTML\(e, i\) \{\n.*\n    return filesBoxHTML\(i\) \+/);
  assert.match(js, /rewind\(Number\(e\.currentTarget\.dataset\.filesUndo\), 'code', \{ undo: true \}\)/);
  assert.match(js, /\[data-files-all\]', 'click', \(\) => \{ S\.showChanges = true; loadChanges\(\)/);
  for (const l of css.slice(css.indexOf("THE CHANGED-FILES BOX")).split("\n").filter((l) => /\{/.test(l) && !/^\s*@/.test(l))) assert.match(l, /#gfApp/, l);
});

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }

/** The page in a real Chromium, signed in, with a fake Coder: one chat with a message and Coder's answer. */
async function openPage(browser, { events: evIn = null, commits = [], marks = [{ turn: 1, ev: 0 }],  width = 1400, height = 900, starting = false, connectors = [{ id: "a", name: "Linear", on: true, tools: [] }, { id: "b", name: "Notion", on: true, tools: [] }, { id: "c", name: "Sentry", on: false, tools: [] }], store = null } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { running: false, sent: 0, starting };
  const events = evIn || [
    { type: "user", text: "Fix the login button", at: at - 5 * 60000 },
    { type: "done", text: "Fixed: the button now signs you in.", at: at - 4 * 60000 },
  ];
  const project = () => ({ id: "c1", title: "Fix the login button", repo: "ana/shop", base: "main", branch: "coder/c1", status: st.running ? "running" : "done", mode: "acceptEdits", turn: 1, at, marks, commits, ...(st.running && st.starting ? { starting: { id: "s", at } } : {}) });
  const api = (method, p) => {
    if (method === "POST" && p === "/api/coder/projects/c1/rewind") { st.rewound = st.body; return { project: project(), events }; }
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
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: "block" });
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
    if (u.pathname.startsWith("/api/") && route.request().method() === "POST") st.body = route.request().postDataJSON();
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
const turn = (at) => [
  { type: "user", text: "Add a hello page", at: at - 60000 },
  ...w("a", "write", "public/hello.html", "create", 12, 0), ...w("b", "write", "public/hello.css", "create", 3, 0),
  { type: "done", text: "Added the hello page.", at: at - 30000 },
];

test("in the page: the box, its rows, Undo and See all", { skip: !chromium && "Playwright's Chromium is not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const at = Date.now();
    const { page, st, errors } = await openPage(browser, { width: 900, events: turn(at), commits: [{ turn: 1, sha: "abc", edited: ["public/hello.html"], tracked: true }] });
    await page.waitForSelector("#gfApp .cd-fbox");
    assert.equal(await page.textContent("#gfApp .cd-fbox-head span"), "Created 2 files");
    assert.deepEqual(await page.$$eval("#gfApp .cd-fbox-n", (a) => a.map((x) => [x.textContent, x.title])), [["hello.html", "public/hello.html"], ["hello.css", "public/hello.css"]]);
    assert.equal(await page.textContent("#gfApp .cd-fbox-row .cd-add"), "+12");
    assert.equal(await page.$("#gfApp .cd-fbox-all"), null);
    if (SHOT) await (await page.$("#gfApp .cd-fbox")).screenshot({ path: SHOT });
    await page.click("#gfApp .cd-fbox-undo");
    await page.waitForFunction(() => !document.querySelector("#gfApp .cd-sure"));
    await page.waitForTimeout(300);
    assert.deepEqual(st.rewound, { turn: 1, code: true, chat: false, undo: true }, "the Undo button asks for an undo's wording");
    assert.deepEqual(errors, []);
    await page.context().close();

    // Four files: two rows and See all, which opens See changes; no code to restore: no Undo.
    const four = [{ type: "user", text: "x", at: at - 9000 }, ...w("1", "write", "a.js", "create", 1, 0), ...w("2", "edit", "b.js", "update", 1, 1), ...w("3", "edit", "c.js", "update", 2, 0), ...w("4", "edit", "d.js", "update", 0, 2), { type: "done", text: "ok", at: at - 1000 }];
    const p2 = await openPage(browser, { events: four, commits: [] });
    await p2.page.waitForSelector("#gfApp .cd-fbox");
    assert.equal(await p2.page.textContent("#gfApp .cd-fbox-head span"), "Changed 4 files");
    assert.equal((await p2.page.$$("#gfApp .cd-fbox-row")).length, 2);
    assert.equal(await p2.page.$("#gfApp .cd-fbox-undo"), null);
    await p2.page.click("#gfApp .cd-fbox-all");
    await p2.page.waitForSelector("#cdChanges[aria-pressed=true]");
    await p2.page.context().close();
  } finally { await browser.close(); }
});
