// CLAUDE CODE'S Projects TOOL AND CLAUDE IN CHROME'S BROWSER TOOLS IN CODER (2026-11-23): container/coder-projects.mjs,
// src/coder-owner-projects.mjs and public/coder-projects.js; container/coder-chrome.mjs on a second hub of
// container/gloopy-browser.mjs (Gloopy's own browser unchanged).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";
import { existsSync, statSync, readFileSync, mkdtempSync, writeFileSync, mkdirSync, linkSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as W from "../src/coder-owner-projects.mjs";
import * as P from "../container/coder-projects.mjs";
import * as CH from "../container/coder-chrome.mjs";
import * as N from "../container/coder-extra-names.mjs";
import { CODER_TOOLS, GITHUB_TOOLS, NOT_FROM_GITHUB } from "../container/coder-agent.mjs";
import { DEFERRED_TOOLS, SEARCH_HINTS } from "../container/coder-toolsearch.mjs";
import { CC_TOOL } from "../container/coder-hooks.mjs";
import { BROWSER_ACTIONS, UPLOAD_MAX, uploadMaxOf, makeBrowserHub, hasBrowser } from "../container/gloopy-browser.mjs";

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const PUB = new URL("../public/", import.meta.url).pathname;
const SHOTS = process.env.CODER_SHOTS || "";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); } };
}
const rq = (method, p, body) => new Request("https://x.test/api/coder/" + p, { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });

test("names: projects and the nine browser tools are offered in Coder's chats only, all held back with hints, with Claude Code's names", () => {
  const names = CODER_TOOLS.map((t) => t.function.name);
  for (const n of N.EXTRA_DEFERRED) {
    assert.ok(names.includes(n), n);
    assert.ok(!GITHUB_TOOLS.some((t) => t.function.name === n), n);
    assert.ok(NOT_FROM_GITHUB.includes(n), n);
    assert.ok(DEFERRED_TOOLS.includes(n), n + " held back");
    assert.ok(SEARCH_HINTS[n], n + " hint");
  }
  assert.equal(CC_TOOL.projects, "Projects");
  assert.equal(CC_TOOL.javascript_tool, "mcp__claude-in-chrome__javascript_tool");
  assert.doesNotMatch(read("container/coder-extra-names.mjs"), /from "node:/);
  const pr = P.PROJECTS_TOOL.function.parameters;
  assert.deepEqual(Object.keys(pr.properties).sort(), ["content", "local_path", "method", "n", "path", "present_to_user", "query"]);
  assert.deepEqual(pr.properties.method.enum, ["project_info", "project_read", "project_search", "project_write", "project_delete"]);
  assert.match(read("container/Dockerfile"), / coder-projects\.mjs coder-chrome\.mjs coder-extra-names\.mjs /);
});

test("Worker: the attached project's five methods give Claude Code's result objects", async () => {
  const b = fakeBucket();
  assert.match((await W.projectsCall(b, "u1", { method: "project_info" })).error, /no project is attached/);
  const c = await W.createProject(b, "u1", { name: "Shop", description: "The shop", instructions: "Use British spelling." });
  assert.ok(c.ok && c.project.active, "the first project is attached");
  const w = await W.projectsCall(b, "u1", { method: "project_write", path: "notes/a.md", content: "Refunds take five days.\nShipping is free.", present_to_user: true, local_path: "a.md" });
  assert.equal(w.method, "project_write"); assert.equal(w.replaced, false); assert.match(w.doc_uuid, /^[0-9a-f-]{36}$/); assert.equal(w.present_to_user, true); assert.equal(w.local_path, "a.md");
  const w2 = await W.projectsCall(b, "u1", { method: "project_write", path: "notes/a.md", content: "Refunds take five days." });
  assert.equal(w2.replaced, true); assert.equal(w2.doc_uuid, w.doc_uuid); assert.ok(!("present_to_user" in w2));
  const info = await W.projectsCall(b, "u1", { method: "project_info" });
  assert.deepEqual(Object.keys(info), ["method", "name", "description", "instructions", "docs", "files", "sync_sources", "knowledge"]);
  assert.equal(info.instructions, "Use British spelling.");
  assert.deepEqual(info.docs.map((d) => d.path), ["notes/a.md"]);
  assert.equal(info.files[0].file_kind, "md");
  assert.deepEqual(info.knowledge, { knowledge_size: 23, max_knowledge_size: W.MAX_KNOWLEDGE });
  const r = await W.projectsCall(b, "u1", { method: "project_read", path: "notes/a.md" });
  assert.equal(r.content, "Refunds take five days."); assert.equal(r.file_kind, "md"); assert.ok(r.created_at);
  for (let i = 0; i < 8; i++) await W.projectsCall(b, "u1", { method: "project_write", path: "d" + i + ".txt", content: "refunds " + i });
  const s = await W.projectsCall(b, "u1", { method: "project_search", query: "refunds" });
  assert.equal(s.rag, true); assert.equal(s.hits.length, 5, "n is 5 by default");
  assert.ok(s.hits.every((h) => h.name && h.doc_uuid && h.text));
  assert.equal((await W.projectsCall(b, "u1", { method: "project_search", query: "refunds", n: 2 })).hits.length, 2);
  const d = await W.projectsCall(b, "u1", { method: "project_delete", path: "notes/a.md" });
  assert.deepEqual(d, { method: "project_delete", path: "notes/a.md", deleted: true });
  const d2 = await W.projectsCall(b, "u1", { method: "project_delete", path: "notes/a.md" });
  assert.equal(d2.deleted, false); assert.match(d2.notice, /no document/);
  assert.match((await W.projectsCall(b, "u1", { method: "project_write", path: "../x", content: "x" })).error, /relative document path/);
  assert.match((await W.projectsCall(b, "u1", { method: "project_read", path: "nope.md" })).error, /no document/);
  assert.match((await W.projectsCall(b, "u1", { method: "project_write", path: "big.txt", content: "x".repeat(W.DOC_MAX + 1) })).error, /at most/);
  // (Another owner sees none of it.)
  assert.match((await W.projectsCall(b, "u2", { method: "project_info" })).error, /no project is attached/);
  // (A project with no documents: no index, a docs list instead.)
  const e = await W.createProject(b, "u3", { name: "Empty" });
  assert.ok(e.ok);
  assert.deepEqual(await W.projectsCall(b, "u3", { method: "project_search", query: "x" }), { method: "project_search", rag: false, docs: [], notice: "The project has no documents yet." });
});

test("Worker: the page's routes make, change, attach and delete projects and their documents", async () => {
  const b = fakeBucket();
  const go = async (m, p, body) => { const r = await W.handleOwnerProjectRoutes(rq(m, p, body), b, "u1", p.split("?")[0].split("/")); return [r.status, await r.json()]; };
  assert.equal(await W.handleOwnerProjectRoutes(rq("GET", "projects"), b, "u1", ["projects"]), null, "the chats' list is not this");
  let [st, j] = await go("POST", "owner-projects", { name: "" });
  assert.equal(st, 400);
  [st, j] = await go("POST", "owner-projects", { name: "One" });
  const one = j.project.id;
  [st, j] = await go("POST", "owner-projects", { name: "Two" });
  const two = j.project.id;
  assert.equal(j.project.active, false, "the first stays attached");
  [st, j] = await go("PATCH", "owner-projects/" + two, { active: true, instructions: "Be brief." });
  assert.equal(j.project.active, true);
  [st, j] = await go("POST", "owner-projects/" + two + "/doc", { path: "a.md", content: "hello" });
  assert.equal(st, 200); assert.equal(j.project.docs[0].size, 5);
  [st, j] = await go("GET", "owner-projects/" + two + "/doc?path=a.md");
  assert.equal(j.content, "hello");
  [st, j] = await go("GET", "owner-projects");
  assert.equal(j.active, two); assert.equal(j.projects.length, 2); assert.ok(!("content" in j.projects[1].docs[0]), "no document's text in the list");
  [st] = await go("DELETE", "owner-projects/" + two + "/doc?path=a.md");
  assert.equal(st, 200);
  [st] = await go("DELETE", "owner-projects/" + two);
  [st, j] = await go("GET", "owner-projects");
  assert.equal(j.active, ""); assert.deepEqual(j.projects.map((p) => p.id), [one]);
  assert.match(read("src/coder-routes.mjs"), /handleOwnerProjectRoutes\(request, bucket, uid, parts\)/);
  assert.match(read("src/coder-envapi.mjs"), /projectsApi\(bucket, uid, body\)/);
});

test("machine: the projects tool checks Claude Code's inputs, reads local_path inside the working folder, and puts a long read in local_file", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "pj-root-"));
  writeFileSync(path.join(root, "spec.md"), "# Spec\nAll of it.");
  assert.match(P.checkProjectsInput({ method: "project_write", path: "a", content: "x", local_path: "spec.md" }, root).error, /exactly one/);
  assert.match(P.checkProjectsInput({ method: "project_write", path: "a" }, root).error, /exactly one/);
  assert.match(P.checkProjectsInput({ method: "project_write", path: "a", local_path: "../etc/passwd" }, root).error, /inside the working directory/);
  assert.match(P.checkProjectsInput({ method: "project_read" }, root).error, /needs path/);
  assert.match(P.checkProjectsInput({ method: "project_search" }, root).error, /needs query/);
  assert.match(P.checkProjectsInput({ method: "project_search", query: "x", n: 0 }, root).error, /n must/);
  assert.match(P.checkProjectsInput({ method: "nope" }, root).error, /method is one of/);
  assert.equal(P.checkProjectsInput({ method: "project_write", path: "s.md", local_path: "spec.md" }, root).body.content, "# Spec\nAll of it.");
  const b = fakeBucket();
  await W.createProject(b, "u1", { name: "P" });
  const deps = { root, envApi: (body) => W.projectsCall(b, "u1", body) };
  const run = async (args) => { const ev = [], out = []; await P.projectsTool({ args, id: "t1", deps, emit: (e) => ev.push(e), reply: (t) => out.push(t), dir: path.join(root, ".reads") }); return { ev, text: out[0] }; };
  const w = await run({ method: "project_write", path: "spec.md", local_path: "spec.md", present_to_user: true });
  assert.deepEqual(Object.keys(JSON.parse(w.text)), ["method", "path", "doc_uuid", "replaced", "present_to_user", "local_path"]);
  assert.ok(w.ev.some((e) => e.type === "note" && /wrote spec\.md/.test(e.text)), "the owner is told about the deliverable");
  await run({ method: "project_write", path: "long.txt", content: "y".repeat(P.READ_INLINE_MAX + 10) });
  const r = JSON.parse((await run({ method: "project_read", path: "long.txt" })).text);
  assert.ok(!("content" in r) && r.local_file && readFileSync(r.local_file, "utf8").length === P.READ_INLINE_MAX + 10);
  const small = JSON.parse((await run({ method: "project_read", path: "spec.md" })).text);
  assert.equal(small.content, "# Spec\nAll of it.");
  assert.match((await run({ method: "project_read" })).text, /needs path/);
});

test("browser: Claude Code's upload checks (10 MB in all, credential names, hard links, Read deny rules, the working folder)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ch-root-"));
  mkdirSync(path.join(root, ".ssh")); mkdirSync(path.join(root, "store"));
  for (const f of [".env", ".env.local", "server.pem", "tls.key", ".ssh/config", "a.txt", "secret.txt"]) writeFileSync(path.join(root, f), "x");
  writeFileSync(path.join(root, "store/pkg.js"), "x"); linkSync(path.join(root, "store/pkg.js"), path.join(root, "linked.js"));
  writeFileSync(path.join(root, "six.bin"), Buffer.alloc(6 * 1024 * 1024)); writeFileSync(path.join(root, "five.bin"), Buffer.alloc(5 * 1024 * 1024));
  for (const f of [".env", ".env.local", "server.pem", "tls.key", ".ssh/config"]) assert.match(CH.checkUploads([f], { root }).error, /credentials/, f);
  assert.match(CH.checkUploads(["linked.js"], { root }).error, /more than one hard link/);
  assert.match(CH.checkUploads(["six.bin", "five.bin"], { root }).error, /10 MB/);
  assert.deepEqual(CH.checkUploads(["six.bin"], { root }).files.map((f) => f.size), [6 * 1024 * 1024], "over Gloopy's 5 MB, under 10");
  assert.match(CH.checkUploads(["../x"], { root }).error, /not inside/);
  assert.match(CH.checkUploads(["secret.txt"], { root, readDenied: (f) => f.endsWith("secret.txt") }).error, /denies reading/);
  assert.equal(CH.checkUploads(["a.txt"], { root }).files[0].name, "a.txt");
});

test("browser: Plan mode asks before a tab opens (tabs_create_mcp, createIfEmpty, a batch with either or gif_creator), nothing else", async () => {
  assert.equal(CH.planAsks("tabs_context_mcp", {}), false);
  assert.equal(CH.planAsks("tabs_context_mcp", { createIfEmpty: true }), true);
  assert.equal(CH.planAsks("tabs_create_mcp", {}), true);
  assert.equal(CH.planAsks("navigate", { url: "x" }), false);
  assert.equal(CH.planAsks("browser_batch", { actions: [{ tool: "read_page" }] }), false);
  assert.equal(CH.planAsks("browser_batch", { actions: [{ tool: "gif_creator" }] }), true);
  assert.equal(CH.planAsks("browser_batch", { actions: [{ tool: "tabs_context_mcp", input: { createIfEmpty: true } }] }), true);
  const asked = [];
  const hub = { act: async () => ({ text: "Page: x" }), running: async () => false, describe: async () => ({ url: "about:blank", title: "" }) };
  const ctx = (plan, answer) => ({ args: { createIfEmpty: true }, id: "t", deps: { chrome: hub }, emit: () => {}, reply: (t) => asked.push(["reply", t]), plan, canAsk: () => true, askOwner: async (card) => { asked.push(["card", card.tool]); return answer; }, answerOutcome: (a) => (a.choice === "yes" ? "yes" : "no") });
  assert.equal(await CH.chromeTool("tabs_context_mcp", ctx(true, { choice: "no" })), "no");
  assert.deepEqual(asked.slice(0, 1), [["card", "tabs_context_mcp"]]);
  asked.length = 0;
  await CH.chromeTool("tabs_context_mcp", ctx(true, { choice: "yes" }));
  assert.deepEqual(JSON.parse(asked.find((x) => x[0] === "reply")[1]), { tabs: [{ tabId: 1, url: "about:blank", title: "" }] });
  asked.length = 0;
  await CH.chromeTool("tabs_context_mcp", ctx(false, null));
  assert.ok(!asked.some((x) => x[0] === "card"), "no card outside Plan mode");
  const none = [];
  await CH.chromeTool("navigate", { args: { url: "x" }, id: "t", deps: {}, emit: () => {}, reply: (t) => none.push(t) });
  assert.match(none[0], /no browser on this computer/);
});

test("browser: javascript_tool results up to 60,000 characters stay in the chat; longer ones are saved to a file", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ch-js-"));
  let size = 0;
  const hub = { act: async () => ({ text: "" }), running: async () => true, describe: async () => null, evaluate: async () => ({ result: "a".repeat(size) }) };
  const run = async () => { const out = []; await CH.chromeTool("javascript_tool", { args: { action: "javascript_exec", text: "x" }, id: "t", deps: { chrome: hub }, emit: () => {}, reply: (t) => out.push(t), dir }); return out[0]; };
  size = 60_000;
  assert.ok((await run()).startsWith("a".repeat(60_000)));
  size = 60_001;
  const t = await run();
  assert.match(t, /60001 characters, over 60000, so it was saved to /);
  assert.equal(readdirSync(dir).length, 1);
});

test("Gloopy's browser is as it was: no new action for its AI, 5 MB uploads, no javascript unless the hub asks for it", () => {
  assert.deepEqual([...BROWSER_ACTIONS], ["open", "look", "click", "hover", "type", "press", "select", "scroll", "back", "screenshot", "upload"]);
  assert.equal(uploadMaxOf(undefined), UPLOAD_MAX); assert.equal(uploadMaxOf("abc"), UPLOAD_MAX); assert.equal(uploadMaxOf(String(10 * 1024 * 1024)), 10 * 1024 * 1024);
  const srv = read("container/server.mjs");
  assert.match(srv, /const browserHub = \(\) => \(hub \|\|= makeBrowserHub\(\{ dir: browserRoot \|\| \(data \? join\(data, "browser"\)/, "Gloopy's hub made as before");
  assert.match(srv, /coderBrowserHub = \(\) => \(coderHub \|\|= makeBrowserHub\(\{ dir: \(browserRoot \? browserRoot \+ "-coder" : data \? join\(data, "coder-browser"\)/);
  assert.match(srv, /\.\.\.\(!gloopy && hasBrowser \? \{ chrome: coderBrowserHub\(\) \} : \{\}\)/);
});

const listen = async (srv) => { await new Promise((r) => srv.listen(0, "127.0.0.1", r)); return "http://127.0.0.1:" + srv.address().port; };

test("browser for real (where Chromium is installed): Coder's hub runs javascript and takes a 6 MB upload; Gloopy's kind of hub refuses both", async (t) => {
  if (!hasBrowser()) return t.skip("no Playwright Chromium on this machine");
  let got = 0;
  const site = http.createServer((req, res) => {
    if (req.method === "POST") { req.on("data", (c) => { got += c.length; }); req.on("end", () => { res.end("<title>Sent</title><p>ok</p>"); }); return; }
    res.setHeader("content-type", "text/html");
    res.end('<title>Shop</title><h1>Hello</h1><form method="post" enctype="multipart/form-data"><label>File <input type="file" name="f"></label><button>Send</button></form>');
  });
  const base = await listen(site);
  const root = mkdtempSync(path.join(tmpdir(), "ch-real-"));
  writeFileSync(path.join(root, "six.bin"), Buffer.alloc(6 * 1024 * 1024, 1));
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "ch-hub-")), "coder-browser"), gdir = path.join(mkdtempSync(path.join(tmpdir(), "ch-ghub-")), "browser");
  const hub = makeBrowserHub({ dir, uploadMax: 10 * 1024 * 1024, allowEval: true }), ghub = makeBrowserHub({ dir: gdir });
  const call = async (name, args) => { const out = []; await CH.chromeTool(name, { args, id: "t", deps: { chrome: hub }, emit: () => {}, reply: (x) => out.push(x), root }); return out[0]; };
  try {
    assert.match(await call("navigate", { url: base + "/" }), /Page: Shop/);
    assert.match(await call("javascript_tool", { text: "document.querySelector('h1').textContent + ' ' + (6 * 7)" }), /^Hello 42/);
    assert.match(await call("javascript_tool", { text: "Promise.resolve({ a: [1, 2] })" }), /^\{"a":\[1,2\]\}/);
    const look = await call("read_page", {});
    const ref = (/button "File" \[ref=(e\d+)\]|textbox "File" \[ref=(e\d+)\]|"File"[^\n]*\[ref=(e\d+)\]/.exec(look) || []).slice(1).find(Boolean);
    assert.ok(ref, "the file field has a ref:\n" + look);
    assert.match(await call("file_upload", { paths: ["six.bin"], ref }), /Uploaded six\.bin/);
    const tabs = JSON.parse(await call("tabs_context_mcp", {}));
    assert.equal(tabs.tabs[0].title, "Shop");
    // (Gloopy's hub, made as server.mjs makes it: no javascript, and its 5 MB.)
    await ghub.act({ action: "open", url: base + "/" });
    await assert.rejects(ghub.evaluate("1"), /javascript is not available/);
    await assert.rejects(ghub.stage({ name: "big.bin", data: Buffer.alloc(5.5 * 1024 * 1024, 1).toString("base64") }), /over 5 MB/);
  } finally {
    site.close();
    spawnSync("pkill", ["-f", "gloopy-browser.mjs serve " + dir]);
    spawnSync("pkill", ["-f", "gloopy-browser.mjs serve " + gdir]);
  }
});

async function openPage(browser, { width = 1000, dark = false } = {}) {
  const at = Date.now();
  const project = () => ({ id: "c1", title: "Docs", repo: "ana/shop", base: "main", branch: "coder/c1", status: "done", mode: "acceptEdits", turn: 1, at, marks: [] });
  const b = fakeBucket();
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://gofarther.test/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/coder/owner-projects")) {
      const r = await W.handleOwnerProjectRoutes(new Request(u.href, { method: route.request().method(), body: route.request().postData() || undefined }), b, "u1", u.pathname.slice("/api/coder/".length).split("/"));
      return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text() });
    }
    if (u.pathname.startsWith("/api/")) {
      const data = { "/api/coder/github": { connected: true, login: "ana" }, "/api/coder/projects": { projects: [project()] }, "/api/coder/projects/c1": { project: project(), events: [{ type: "user", text: "hi" }, { type: "done", text: "Hello." }], queue: [] }, "/api/coder/settings": { prefs: {} }, "/api/coder/connectors": { connectors: [], catalog: [] } }[u.pathname] || {};
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto("https://gofarther.test/", { waitUntil: "domcontentloaded" });
  return { page, errors, bucket: b };
}

test("page in Chromium: Plugins ▸ Projects makes a project, attaches it, adds and opens a document; the panel is inside #gfApp", { skip: !chromium && "playwright not installed" }, async () => {
  const browser = await chromium.launch();
  try {
    const { page, errors, bucket } = await openPage(browser);
    await page.waitForSelector("#cdSidePlugins:not([disabled])", { timeout: 15000 });
    await page.click("#cdSidePlugins");
    await page.click("#cdSideProjects");
    await page.waitForSelector("#gfApp .cpj-panel .cpj-empty");
    if (SHOTS) await page.locator("#gfApp .cpj-panel").screenshot({ path: path.join(SHOTS, "z6-projects-empty.png") });
    await page.click('#gfApp .cpj-panel [data-cpj="new"]');
    await page.fill('#gfApp .cpj-panel input[name="name"]', "Billing service");
    await page.fill('#gfApp .cpj-panel input[name="description"]', "Invoices, refunds and the payment provider");
    await page.fill('#gfApp .cpj-panel textarea[name="instructions"]', "Target the release branch. Never touch migrations without asking.");
    if (SHOTS) await page.locator("#gfApp .cpj-panel").screenshot({ path: path.join(SHOTS, "z6-projects-new.png") });
    await page.click('#gfApp .cpj-panel button[type="submit"]');
    await page.waitForSelector('#gfApp .cpj-panel .cpj-top .cpj-on');
    await page.click('#gfApp .cpj-panel [data-cpj="add"]');
    await page.fill('#gfApp .cpj-panel input[name="path"]', "docs/refunds.md");
    await page.fill('#gfApp .cpj-panel textarea[name="content"]', "# Refunds\nRefunds go back to the card within five working days.");
    await page.click('#gfApp .cpj-panel form[data-cpj-form="doc"] button[type="submit"]');
    await page.waitForSelector('#gfApp .cpj-panel [data-cpj="view"]');
    await page.click('#gfApp .cpj-panel [data-cpj="view"]');
    await page.waitForSelector("#gfApp .cpj-panel .cpj-view pre");
    assert.match(await page.textContent("#gfApp .cpj-view pre"), /five working days/);
    if (SHOTS) await page.locator("#gfApp .cpj-panel").screenshot({ path: path.join(SHOTS, "z6-projects-project.png") });
    // (What Coder's tool now sees: the same project, attached.)
    const info = await W.projectsCall(bucket, "u1", { method: "project_info" });
    assert.equal(info.name, "Billing service"); assert.deepEqual(info.docs.map((d) => d.path), ["docs/refunds.md"]);
    await page.click('#gfApp .cpj-panel [data-cpj="back"]');
    await page.waitForSelector("#gfApp .cpj-panel .cpj-list");
    if (SHOTS) await page.locator("#gfApp .cpj-panel").screenshot({ path: path.join(SHOTS, "z6-projects-list.png") });
    assert.match(read("public/coder-projects.css"), /^\/\*[^*]*\*\/\n(#gfApp [^\n]+\n|@media[^\n]+#gfApp[^\n]+\n)+$/, "every rule is under #gfApp");
    await page.keyboard.press("Escape");
    assert.equal(await page.$("#gfApp .cpj-panel"), null);
    // (At phone width it fits.)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.CoderProjectsUI.projectsPanel());
    await page.waitForSelector("#gfApp .cpj-panel .cpj-list");
    assert.ok(await page.$eval("#gfApp .cpj-panel", (el) => el.scrollWidth <= el.clientWidth + 1));
    if (SHOTS) await page.locator("#gfApp .cpj-panel").screenshot({ path: path.join(SHOTS, "z6-projects-phone.png") });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
