// THE SITE'S OWN TESTS, RUN (2026-10-30, the site agent's `run_tests`).
//
// In the container. The tests and the site's server functions run in a
// sandboxed child (`test-runner-child.mjs`: no environment, Node's permission
// model, an unprivileged user, no network — `fetch` gone, `site.fetch` recorded
// and answered from the test's fakes, a throwaway in-memory database). Pages are
// driven HERE, in headless Chromium (the render check's own launcher), against a
// PRIVATE copy of the draft built from the workspace (`makePrivateSite`): never
// the live site. The browser may reach that copy and nothing else, and its calls
// to the site's functions are answered by the child, with the same database and
// fakes the test sees. One run is capped at `TEST_RUN_MS`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { renderAs, startSiteServer } from "./site-ssr.mjs";
import { isServerPart } from "./server-code.mjs";
import { toJs, hooksIn } from "./server-dryrun.mjs";
import { TEST_RUN_MS, TEST_ONE_MS, cleanTests, testRefusal } from "./site-tests.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEST_CHILD = path.join(HERE, "test-runner-child.mjs");
export const TEST_DB = path.join(HERE, "test-db.mjs");
const FN_PATH = /^\/api\/db\/[^/]+\/fn\/([a-z0-9][a-z0-9-]{0,62})\/?$/i;
const MAX_SHOTS = 2;

/** The child's command line: only its own two files may be read. */
export function childArgs() {
  return ["--permission", "--allow-fs-read=" + TEST_CHILD, "--allow-fs-read=" + TEST_DB, TEST_CHILD];
}

/**
 * Run the site's tests. Never throws: `{ ran: false, why }` when it could not.
 * `serve(files)` → `{ base, close }` builds and serves the private copy, asked
 * only when a test opens a page. `chromium` is playwright's (loaded when absent).
 */
export async function runSiteTests({ parts = [], tests = [], pages = [], css = null, tables = [], only = "", files = null, ts = null, serve = null, chromium = null, timeoutMs = TEST_RUN_MS, testMs = TEST_ONE_MS, spawnFn = spawn, wrap = null } = {}) {
  const t0 = Date.now();
  let list = cleanTests(tests);
  if (Array.isArray(files) && files.length) list = list.filter((t) => files.includes(t.name));
  if (!list.length) return { ran: false, why: Array.isArray(files) && files.length ? "none of those test files exist" : "there are no tests yet: write \"-tests/<name>.test.ts\" first", results: [] };
  let compiler = ts;
  if (!compiler) { try { compiler = createRequire(import.meta.url)("typescript"); } catch { return { ran: false, why: "no compiler", results: [] }; } }
  const results = [];
  const testsJs = [];
  for (const t of list) {
    let js;
    try { js = toJs(compiler, t.source); } catch (e) { results.push({ file: t.name, name: "(load)", ok: false, error: "does not compile: " + String((e && e.message) || e).slice(0, 300) }); continue; }
    const why = testRefusal(js);
    if (why) { results.push({ file: t.name, name: "(load)", ok: false, error: why }); continue; }
    testsJs.push({ file: t.name, js });
  }
  const fns = (Array.isArray(parts) ? parts : []).filter(isServerPart).map((p) => ({ name: p.name.replace(/^server-/, ""), js: toJs(compiler, p.source), hooks: hooksIn(p.source) }));
  if (!testsJs.length) return { ran: true, ms: Date.now() - t0, results, shots: [] };

  const as = renderAs();
  let site = null, browser = null, context = null;
  const pagesOpen = new Map();
  const shots = [];
  const blocked = new Set();
  let child;
  return new Promise((resolve) => {
    let done = false;
    const finish = async (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child && child.kill("SIGKILL"); } catch { /* gone */ }
      try { if (browser) await browser.close(); } catch { /* gone */ }
      try { if (site && typeof site.close === "function") await site.close(); } catch { /* gone */ }
      resolve({ ...v, ms: Date.now() - t0, results: [...results, ...(v.results || [])], shots, ...(blocked.size ? { blocked: [...blocked].slice(0, 20) } : {}) });
    };
    const timer = setTimeout(() => finish({ ran: true, timedOut: true, results: [{ file: "", name: "(run)", ok: false, error: "the run hit its " + Math.round(timeoutMs / 1000) + " s cap and was stopped" }] }), timeoutMs);
    const base = [process.execPath, ...childArgs()];
    const [cmd, ...args] = typeof wrap === "function" ? wrap(base, as) : base;
    try {
      child = spawnFn(cmd, args, { env: {}, stdio: ["pipe", "pipe", "pipe"], ...(as && typeof wrap !== "function" ? { uid: as.uid, gid: as.gid } : {}) });
    } catch (e) { return finish({ ran: false, why: "could not start: " + String((e && e.message) || e).slice(0, 120) }); }
    let err = "";
    child.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
    const toChild = (o) => { try { child.stdin.write(JSON.stringify(o) + "\n"); } catch { /* gone */ } };
    let seq = 0;
    const waiting = new Map();
    const askChild = (op, args) => new Promise((ok, no) => { const id = "p" + ++seq; waiting.set(id, { ok, no }); toChild({ rpc: id, op, ...args }); });

    async function openBrowser() {
      if (context) return;
      if (typeof serve !== "function") throw new Error("pages cannot be opened here");
      site = await serve({ pages, parts, css });
      if (!site || typeof site.base !== "string") throw new Error("the private copy of the site could not be built: " + String((site && site.why) || "no answer").slice(0, 300));
      const pw = chromium || (await import("playwright-core")).chromium;
      const { launchChromium } = await import("./render-check.mjs");
      browser = (await launchChromium(pw)).browser;
      context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
      const own = new URL(site.base).host;
      await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
        if (u.host !== own) { blocked.add(u.host); return route.abort("blockedbyclient"); }
        const m = u.pathname.match(FN_PATH);
        if (!m) return route.continue();
        try {
          const req = route.request();
          const a = await askChild("fn", { name: m[1], method: req.method(), url: "https://test-site.example" + u.pathname + u.search, headers: { ...(await req.allHeaders()), "cf-connecting-ip": "203.0.113.7" }, body: req.postData() });
          return route.fulfill({ status: a.status, headers: a.headers, body: a.body });
        } catch (e) { return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: String((e && e.message) || e).slice(0, 200) }) }); }
      });
    }
    async function pageAct({ id, act, args = [] }) {
      if (act === "open") {
        await openBrowser();
        const p = await context.newPage();
        pagesOpen.set(id, p);
        await p.goto(new URL(String(args[0] || "/"), site.base).href, { waitUntil: "load", timeout: 20000 });
        return true;
      }
      const p = pagesOpen.get(id);
      if (!p) throw new Error("that page is closed");
      const sel = String(args[0] || "");
      switch (act) {
        case "goto": await p.goto(new URL(sel || "/", site.base).href, { waitUntil: "load", timeout: 20000 }); return true;
        case "click": await p.locator(sel).first().click({ timeout: 5000 }); return true;
        case "fill": await p.locator(sel).first().fill(String(args[1] ?? ""), { timeout: 5000 }); return true;
        case "select": await p.locator(sel).first().selectOption(String(args[1] ?? ""), { timeout: 5000 }); return true;
        case "check": await p.locator(sel).first().check({ timeout: 5000 }); return true;
        case "text": return (await p.locator(sel || "body").first().innerText({ timeout: 5000 })).slice(0, 20000);
        case "count": return await p.locator(sel).count();
        case "url": return new URL(p.url()).pathname + new URL(p.url()).search;
        case "waitFor":
          if (/^\d+$/.test(sel)) { await p.waitForTimeout(Math.min(10000, Number(sel))); return true; }
          await p.locator(sel).first().waitFor({ timeout: 10000 }); return true;
        case "screenshot": {
          const png = await p.screenshot({ fullPage: false });
          if (shots.length < MAX_SHOTS) shots.push({ label: "test page " + new URL(p.url()).pathname, png: png.toString("base64"), media_type: "image/png" });
          return { bytes: png.length };
        }
        case "close": await p.close(); pagesOpen.delete(id); return true;
        default: throw new Error("no such page action: " + act);
      }
    }

    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      if (buf.length > 5_000_000) return finish({ ran: false, why: "the tests wrote too much" });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.done) return finish({ ran: true, results: Array.isArray(m.done.results) ? m.done.results : [] });
        if (m.reply != null) { const w = waiting.get(m.reply); if (w) { waiting.delete(m.reply); if (m.error) w.no(new Error(m.error)); else w.ok(m.value); } continue; }
        if (m.rpc != null && m.op === "page") {
          pageAct(m).then((value) => toChild({ reply: m.rpc, value }), (e) => toChild({ reply: m.rpc, error: String((e && e.message) || e).split("\n")[0].slice(0, 400) }));
        }
      }
    });
    child.on("error", (e) => finish({ ran: false, why: String((e && e.message) || e).slice(0, 160) }));
    child.on("close", () => setTimeout(() => finish({ ran: false, why: "the test process ended without an answer" + (err ? ": " + err.split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300) : "") }), 20));
    toChild({ init: { parts: fns, tests: testsJs, tables: Array.isArray(tables) ? tables : [], only: String(only || ""), testMs } });
  });
}

/**
 * The PRIVATE copy of the draft: the workspace built in a folder of its own
 * (the agent shell's sandbox: the template's files, its packages linked), as
 * the compile builds it (`tsr generate`, `vite build`), then served on a local
 * port by the render check's own server over its own server bundle. Removed
 * when closed. Never the shared build folder, never the live site.
 */
export function makePrivateSite({ app, routesBase, stylesBase, prepareSandbox, writeSiteFiles, serveDist, root = path.join(os.tmpdir(), "gf-site-tests"), stepMs = 120_000, spawnFn = spawn } = {}) {
  return async ({ pages = [], parts = [], css = null } = {}) => {
    const dir = path.join(root, randomUUID());
    const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } };
    try {
      prepareSandbox(dir, { app, routesBase });
      writeSiteFiles(dir, { pages, parts, css }, { routesBase, stylesBase });
      const step = (args) => new Promise((ok) => {
        const c = spawnFn("npx", args, { cwd: dir, env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "ignore", "pipe"] });
        let e = "";
        c.stderr.on("data", (d) => { e = (e + d).slice(-1500); });
        const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch { /* gone */ } }, stepMs);
        c.on("close", (code) => { clearTimeout(t); ok({ code, e }); });
        c.on("error", (x) => { clearTimeout(t); ok({ code: -1, e: String(x && x.message) }); });
      });
      for (const args of [["tsr", "generate"], ["vite", "build", "--logLevel", "warn"]]) {
        const r = await step(args);
        if (r.code !== 0) { cleanup(); return { why: args.join(" ") + " failed: " + r.e.trim().slice(-300) }; }
      }
      const ssr = await startSiteServer(path.join(dir, "dist", "server", "server.js"), { cwd: dir, lifetimeMs: TEST_RUN_MS + 30_000 });
      if (!ssr.fetch) { cleanup(); return { why: "the site's server did not start: " + String(ssr.down()).slice(0, 200) }; }
      const server = serveDist(path.join(dir, "dist", "client"), ssr.fetch);
      await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
      return {
        base: "http://127.0.0.1:" + server.address().port + "/",
        close: async () => { try { server.close(); } catch { /* gone */ } try { ssr.stop(); } catch { /* gone */ } cleanup(); },
      };
    } catch (e) { cleanup(); return { why: String((e && e.message) || e).slice(0, 300) }; }
  };
}
