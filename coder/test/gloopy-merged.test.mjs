// GLOOPY'S WORK MERGED WITH MAIN (owner, 2026-11-13: "merge carefully so we can have that code , i said carefully cuz
// theres old code there"; then the Gloopy chat's branch, claude/keen-goodall-8ghmph). What the merge itself had to get
// right: one engine for both agents without either's names hiding the other's, Gloopy's turn kept apart from Coder's
// own hooks, checker and permission rules, and one page with two views that never both answer the same menu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

/** The local names a function's destructured options bind (`a = 1`, `b: c = 2`, `...d`), at the top level of `{ … }`. */
function optionNames(src, head) {
  const a = src.indexOf(head);
  assert.ok(a >= 0, head);
  const b = src.indexOf("} = {}) {", a);
  const sig = src.slice(a + head.length, b);
  const items = [];
  let depth = 0, cur = "", q = "";
  for (const ch of sig) {
    if (q) { cur += ch; if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { q = ch; cur += ch; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) { items.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) items.push(cur.trim());
  return items.map((x) => { const m = /^(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_$][\w$]*))?/.exec(x); return m ? m[2] || m[1] : null; }).filter(Boolean);
}
/** A module's own top-level names: its functions, constants and imports. */
function topNames(src) {
  const top = new Set();
  for (const m of src.matchAll(/^(?:export )?(?:async )?function\*? ([A-Za-z_$][\w$]*)/gm)) top.add(m[1]);
  for (const m of src.matchAll(/^(?:export )?(?:const|let|var) ([A-Za-z_$][\w$]*)/gm)) top.add(m[1]);
  for (const m of src.matchAll(/^import \{([^}]*)\} from/gm)) for (const part of m[1].split(",")) { const n = part.trim().split(/\s+as\s+/).pop().trim(); if (n) top.add(n); }
  return top;
}

test("GM1 no option of the turn (runCoder) or of the machine (createApp) hides one of its module's own names (found in the merge: Gloopy's helper option `ownerSaid` hid main's check of the owner's words, so every protected-file ask in Coder's turns failed with \"ownerSaid is not a function\")", () => {
  for (const [file, head] of [["container/coder-agent.mjs", "export async function runCoder(deps, {"], ["container/server.mjs", "export function createApp({"]]) {
    const src = read(file);
    const names = optionNames(src, head);
    assert.ok(names.length > 20, file + ": its options are read");
    const top = topNames(src);
    assert.deepEqual(names.filter((n) => top.has(n)), [], file);
  }
  // The helper's option keeps its name outside (Gloopy's helpers pass it), and is `ownerSaidList` inside the turn.
  const agent = read("container/coder-agent.mjs");
  assert.match(agent, /ownerSaid: ownerSaidList = null,/);
  assert.match(agent, /const checkConvo = Array\.isArray\(ownerSaidList\) \? ownerSaidList\.filter\(/);
  assert.match(agent, /^function ownerSaid\(convo, want\) \{/m);
  assert.match(agent, /asHelper: true, ownerSaid: said, browserRules, /);
  // (Gloopy's browser rules are `browserRules` in the turn; `rules` are Coder's own permission rules.)
  assert.ok(optionNames(agent, "export async function runCoder(deps, {").includes("rulesIn"), "browserRules: rulesIn");
  assert.match(agent, /browserRules: rulesIn = \[\],/);
  assert.match(agent, /const browserRules = cleanRules\(rulesIn\);/);
});

test("GM2 a turn given Gloopy's helper option still asks before a command writes a protected file, as Coder's turns do", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const ROOT = "/work/shop";
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const run = async (extra) => {
    const events = [], cards = [], ran = [];
    let n = 0;
    const steps = [say("", [call("bash", { command: "echo x > .git/config" }, "c0")]), say("Done.")];
    const out = await runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => { if (/coder-tools\.mjs/.test(String(x.command))) return { code: 0, output: "" }; if (!/^__s=/.test(String(x.command))) ran.push(x.shown || x.command); return { code: 0, output: "ok\n" }; },
      emit: (e) => events.push(e), here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-gm2",
      where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p.replace(/^\.\//, "")),
      ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "no" }; },
    }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: [], deny: [] }, ...extra });
    return { out, cards, ran, errors: events.filter((e) => e.type === "error") };
  };
  for (const extra of [{}, { ownerSaid: ["Email my boss that all is good"] }]) {
    const r = await run(extra);
    assert.deepEqual(r.errors, [], JSON.stringify(extra));
    assert.equal(r.cards.length, 1, "asked: " + JSON.stringify(extra));
    assert.equal(r.cards[0].why, "Coder requested permissions to edit /work/shop/.git/config which is a sensitive file.");
    assert.deepEqual(r.ran, [], "No: nothing ran");
  }
});

test("GM3 Gloopy's turn on the machine: its own instructions, tools and settings, with none of Coder's hooks, Auto checker or permission rules; its browser rules as browserRules; Coder's turn unchanged", () => {
  const server = read("container/server.mjs");
  const line = server.split("\n").find((l) => l.startsWith("      const gloopyOpts = gloopy ? {"));
  assert.ok(line, "Gloopy's options, apart");
  assert.match(line, /^      const gloopyOpts = gloopy \? \{ system: GLOOPY_SYSTEM, /);
  assert.match(line, /browserRules: Array\.isArray\(body\.rules\) \? body\.rules : \[\],/);
  assert.match(line, /, hooks: \[\], checker: false, rules: null, sessionRules: null \} : \{\};$/);
  assert.doesNotMatch(line, /[{ ]rules: Array\.isArray/, "the browser rules never go in as Coder's permission rules");
  // Given last, so they win for Gloopy; a Coder turn gets {} (its own options as before).
  assert.match(server, /\n      runCoder\(turnDeps, \{ notices, [^\n]*, \.\.\.gloopyOpts \}\)\n/);
  // Gloopy's notes are backed up before the end is handed out, and what its turn left waiting is kept before it is over.
  assert.match(server, /\.then\(async \(r\) => \{ const memory = await readMemory\(memFile\); if \(gloopy\) await Promise\.race\(\[backupGloopy\(\)/);
  assert.match(server, /\{ const r = t\.result; if \(gloopy && r && \(r\.approvalRequest \|\| r\.signinRequest \|\| r\.cardRequest \|\| r\.keyRequest\)\) pending\.set\(project, [^\n]*\n\s+if \(t\.writes\) t\.writes\.check = null;\n\s+t\.ended = Date\.now\(\);\n\s+t\.running = false;/);
  // The same start twice is one turn (Gloopy's), and a turn has both sides' fields.
  assert.match(server, /const t = \{ running: true, stop: false, events: \[\], result: null, fg: new Set\(\), started: Date\.now\(\), resume: null, queue: \[\], mode: normMode\(body\.mode\), answers: new Map\(\), asking: "", writes: \{ check: null \}, start \};/);
  // The link from the owner's computer comes as an upgrade on main's server, which still runs the SessionEnd hooks on stop.
  assert.match(server, /const srv = http\.createServer\(app\);\n\s+srv\.on\("upgrade", app\.upgrade\);\n\s+srv\.listen\(8080/);
  assert.match(server, /handle\.sessionEnd = sessionEnd;\n[^\n]*\n\s+handle\.upgrade = upgrade;\n\s+handle\.tunnel = tunnel;\n\s+return handle;/);
});

test("GM4 one page, two views (Coder's and Gloopy's): the mode and connectors chips and the mode keys are Coder's alone; Settings, Connectors and Notifications open once, in the view that is showing; Gloopy's /compact answer is still shown", () => {
  const ui = read("public/coder.js");
  assert.match(ui, /window\.CoderView = makeView\('coder'\);\n\s+window\.GloopyView = makeView\('gloopy'\);/);
  assert.match(ui, /\(S\.project && !GLOOPY \? modeHTML\(\) : ''\) \+/);
  assert.match(ui, /\(S\.project && !GLOOPY \? '<button type="button" class="cd-pick cd-connchip" id="cdConnChip"/);
  assert.match(ui, /if \(!S\.modeKeys && !GLOOPY\) \{/);
  const shown = "if \\(S\\.root && S\\.root\\.isConnected && S\\.root\\.getClientRects\\(\\)\\.length\\)";
  for (const [ev, fn] of [["gf:notify", "showNotifications"], ["gf:settings", "showSettings"], ["gf:connectors", "showConnectors"]]) {
    assert.match(ui, new RegExp("window\\.addEventListener\\('" + ev + "', \\(\\) => \\{ " + shown + " " + fn + "\\(\\); \\}\\);"), ev);
  }
  assert.match(ui, /if \(back && !GLOOPY\) \{ history\.replaceState/, "a connector's sign-in comes back to Coder's view");
  // Gloopy's Worker still makes /compact's summary itself (Coder's runs on its machine, as a turn).
  assert.match(ui, /if \(r\.data\.compacted \|\| r\.data\.handled\) \{ S\.project = r\.data\.project;/);
  // A message sent while Coder works waits in its queue; Gloopy's chat sends once Gloopy is done.
  assert.match(ui, /if \(S\.running\) \{\n\s+if \(GLOOPY\) return;[^\n]*\n\s+if \(pics\.length \|\| comments\.length \|\| att\.length \|\| !text\)/);
  // Auto mode's countdown runs once, in Coder's view (each view runs the page's code once).
  assert.match(ui, /\n  if \(!GLOOPY\) setInterval\(\(\) => \{ document\.querySelectorAll\('\[data-block-at\]'\)/);
  // No @-file list in Gloopy's chat.
  assert.match(ui, /const m = GLOOPY \? null : \/\(\^\|\\s\)@\(\[\\w\.\/-\]\*\)\$\/\.exec\(before\);/);
});

test("GM5 in a real browser: Coder's tab keeps its chips, Gloopy's has neither; each of Settings, Connectors and Notifications opens once from either tab, in that tab's words", async (t) => {
  const { hasBrowser } = await import("../container/gloopy-browser.mjs");
  if (!hasBrowser()) return t.skip("no Playwright Chromium on this machine");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const PUB = new URL("../public/", import.meta.url).pathname;
  const ORIGIN = "https://gofarther.test";
  const now = Date.now();
  const project = { id: "c1", title: "Fix the login button", repo: "ana/shop", base: "main", branch: "coder/c1", status: "done", mode: "acceptEdits", turn: 1, at: now };
  const API = {
    "GET /api/coder/github": { connected: true, login: "ana" },
    "GET /api/coder/projects": { projects: [project] },
    "GET /api/coder/projects/c1": { project, events: [{ type: "user", text: "Why?", at: now - 9000 }, { type: "done", text: "Because.", at: now - 8000 }], queue: [] },
    "GET /api/coder/gloopy": { gloopy: { id: "g1" }, browser: true, cards: [], logins: [] },
    "GET /api/coder/projects/g1": { project: { id: "g1", title: "Gloopy", agent: "gloopy", status: "done", turn: 1, at: now }, events: [{ type: "user", text: "Hi", at: now - 9000 }, { type: "done", text: "Hello.", at: now - 8000 }], queue: [] },
    "GET /api/coder/connectors": { ok: true, connectors: [], catalog: [], callback: "", later: [] },
    "GET /api/coder/settings": { prefs: {} },
    "GET /api/coder/push/settings": { decides: true, actions: true, devices: 0 },
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block" })).newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(ORIGIN + "/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
      if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(API[route.request().method() + " " + u.pathname] || {}) });
      const file = path.join(PUB, u.pathname === "/" || u.pathname === "/gloopy" ? "index.html" : u.pathname);
      if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
    });
    await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
    const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
    const shown = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.getClientRects().length).length, sel);
    const closeAll = () => page.evaluate(() => document.querySelectorAll(".cd-sure, .cx").forEach((x) => x.remove()));
    const menu = async (id) => { await page.click("#gfGear"); await page.click("#" + id); await page.waitForTimeout(700); };
    await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#gfApp #cdIn", { timeout: 15000 });
    assert.equal(await shown("#gfApp #cdMode"), 1, "Coder's mode chip");
    assert.equal(await shown("#gfApp #cdConnChip"), 1, "Coder's connectors chip");
    await page.click('.gf-tab[data-agent="gloopy"]');
    await page.waitForSelector("#gfGloopyApp #cdIn", { timeout: 15000 });
    assert.equal(await shown("#gfGloopyApp #cdMode"), 0, "no mode chip in Gloopy's chat");
    assert.equal(await shown("#gfGloopyApp #cdConnChip"), 0, "no connectors chip in Gloopy's chat");
    assert.equal(await page.getAttribute("#gfGloopyApp #cdIn", "placeholder"), "Ask Gloopy anything");
    for (const tab of ["gloopy", "coder"]) {
      await page.click('.gf-tab[data-agent="' + tab + '"]');
      await page.waitForTimeout(300);
      await menu("gfSettings");
      assert.equal(await count(".cd-settings"), 1, "Settings from " + tab);
      await closeAll();
      await menu("gfConnectors");
      assert.equal(await count(".cx"), 1, "Connectors from " + tab);
      await closeAll();
      await menu("gfNotify");
      assert.equal(await count(".cd-sure"), 1, "Notifications from " + tab);
      assert.match(await page.locator(".cd-sure").innerText(), new RegExp("Like Claude Code’s: " + (tab === "gloopy" ? "Gloopy" : "Coder") + " tells you"));
      await closeAll();
    }
    // The mode menu's keys open Coder's menu once.
    await page.focus("#gfApp #cdIn");
    await page.keyboard.press("Control+Shift+M");
    await page.waitForTimeout(300);
    assert.equal(await shown(".cd-modes"), 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
