// isibi React build-service (runs inside the container). Deps are pre-baked into
// the image, so a build is just: write the generated source over the template →
// `vite build` → return the static dist. No npm install per build.
//
// Contract:
//   POST /build   { "files": { "<relpath>": "<utf8 source>", ... } }
//     → 200 { "ok": true, "files": { "index.html": {"t":"..."} , "assets/x.js": {"b":"<base64>"}, ... } }
//     → 200 { "ok": false, "error": "<build stderr, trimmed>" }   (compile failed)
//   GET  /health  → 200 "ok"
//
// The Worker sends the AI-generated app files (index.html, src/**, and may
// override vite/tailwind/postcss config); everything writes UNDER /app which
// already has node_modules. Output is read from /app/dist.
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
// NOTE: vision-render (Playwright) is loaded LAZILY inside /critique — never at startup — so the build service
// starts and serves /build even if Playwright/Chromium aren't present. /critique degrades to {ok:false} then.

const APP = process.env.APP_DIR || "/app"; // overridable for local testing
const SRC = path.join(APP, "src");
const DIST = path.join(APP, "dist");
const MAX_BODY = 12 * 1024 * 1024; // 12 MB of source in
const BUILD_TIMEOUT = 90_000;

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

// Only allow writes to a safe allowlist of relative paths under /app (never
// escape the dir, never touch node_modules or package.json).
function safeRel(rel) {
  const p = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  if (p.startsWith("/") || p.includes("..")) return null;
  if (p === "package.json" || p.startsWith("node_modules")) return null;
  if (!/^(index\.html|vite\.config\.js|postcss\.config\.js|tailwind\.config\.js|src\/.+)$/.test(p)) return null;
  return p;
}

// Reset src/ for a fresh build. src/ must be wiped so one site's pages can't leak into the next, but the shipped
// UI kit (components/, lib/, main.jsx, index.css) lives there too — so restore it from the pristine copy the image
// baked at /app/.template-src. Without this the generated pages import components that no longer exist and every
// build fails to compile. Falls back to an empty src/ if the copy is missing (older image).
const TEMPLATE_SRC = path.join(APP, ".template-src");
function wipeSrc() {
  try { fs.rmSync(SRC, { recursive: true, force: true }); } catch {}
  try {
    if (fs.existsSync(TEMPLATE_SRC)) { fs.cpSync(TEMPLATE_SRC, SRC, { recursive: true }); return; }
  } catch {}
  fs.mkdirSync(SRC, { recursive: true });
}
function wipeDist() { try { fs.rmSync(DIST, { recursive: true, force: true }); } catch {} }

function runBuild() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vite", "build", "--logLevel", "warn"], { cwd: APP, env: { ...process.env, NODE_ENV: "production" } });
    let err = "", out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    const to = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve({ code: -1, err: "build timed out after 90s" }); }, BUILD_TIMEOUT);
    child.on("close", (code) => { clearTimeout(to); resolve({ code, err: (err + "\n" + out).trim() }); });
    child.on("error", (e) => { clearTimeout(to); resolve({ code: -1, err: String(e && e.message || e) }); });
  });
}

// ADVISORY type check. Vite/esbuild strips types without checking them, so tsc is the only thing that
// actually enforces the kit's prop contracts. It runs AFTER a successful build and its findings are returned
// for the repair loop to act on — it can NEVER fail a build. A customer getting nothing because of a type
// error is a worse outcome than a shipped app with a type error in it.
const TSC_TIMEOUT = 45_000;
function runTypecheck() {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.join(APP, "tsconfig.json"))) return resolve({ ran: false, errors: [] });
    const child = spawn("npx", ["tsc", "--noEmit", "--pretty", "false"], { cwd: APP, env: { ...process.env } });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const to = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve({ ran: false, errors: [], note: "typecheck timed out" }); }, TSC_TIMEOUT);
    child.on("close", () => {
      clearTimeout(to);
      const errors = out.split("\n")
        .filter((l) => /error TS\d+/.test(l))
        // The router is code-generated after this runs, so its absence is expected, not a finding.
        .filter((l) => !/Cannot find module '\.\.?\/(routes|App)/.test(l))
        .slice(0, 40);
      resolve({ ran: true, errors });
    });
    child.on("error", () => { clearTimeout(to); resolve({ ran: false, errors: [] }); });
  });
}

// ── RUNTIME SMOKE CHECK ───────────────────────────────────────────────────────
// esbuild does not resolve names, so a page that references an undefined variable compiles perfectly
// and then white-screens in the browser. The build reports ok:true and the customer gets a blank
// page. Every route is loaded headlessly here instead, and anything thrown is returned for the fix
// loop — ADVISORY, exactly like the typecheck: a customer getting nothing is worse than a customer
// getting an app with one broken page, so this can never fail a build on its own.

/**
 * The hash URLs the built app actually serves, read from the GENERATED src/routes.ts rather than
 * re-deriving them. That file is the router's own source of truth, so the two cannot disagree.
 */
export function routeUrlsFrom(src = SRC) {
  const f = path.join(src, "routes.ts");
  if (!fs.existsSync(f)) return ["/"];
  const urls = [...fs.readFileSync(f, "utf8").matchAll(/to:\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  return urls.length ? [...new Set(urls)] : ["/"];
}

/**
 * Is this console error a real fault, or the smoke check's own environment?
 *
 * React 19 does NOT rethrow a render error to window.onerror — it logs it — and the app shell still
 * renders around the hole, so neither "did anything throw" nor "did anything mount" catches the
 * commonest white-screen. A console error carrying a real exception name is the reliable signal.
 * The check runs with no backend reachable, so a data-driven page will always fail its requests;
 * those are expected and must not be reported as faults.
 */
export function isRealRuntimeError(text) {
  const line = String(text || "").split("\n")[0];
  if (!/^(?:Uncaught\s+)?(?:[A-Z]\w*)?Error: /.test(line)) return false;
  return !/Failed to fetch|NetworkError|ERR_|net::|fetch failed|Load failed|401|403|404/i.test(line);
}

async function smokeTest(dist) {
  let chromium, dir, served, browser;
  // Resolve from the APP, then from here. `createRequire(import.meta.url)` alone resolves upward
  // from THIS file, so in any layout where the deps live with the app rather than beside the
  // service — the eval runner, a scaffolded /tmp/buildapp — the package is never found and the
  // check silently reports itself skipped. That is the fourth time this exact resolution mistake
  // has hidden the smoke check, and the first one caught by an actual run rather than by reading.
  for (const root of [APP, path.dirname(fileURLToPath(import.meta.url))]) {
    try { ({ chromium } = createRequire(path.join(root, "package.json"))("playwright-core")); break; } catch {}
  }
  if (!chromium) { try { ({ chromium } = createRequire(import.meta.url)("playwright-core")); } catch {} }
  if (!chromium) return { ran: false, reason: `playwright-core not resolvable from ${APP}`, errors: [] };
  try {
    dir = writeDistToTemp(dist);
    served = await serveDir(dir);
    const { chromiumExecutable } = await import("./vision-render.mjs");
    browser = await chromium.launch({ executablePath: chromiumExecutable(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const errors = [];
    // ONE PAGE PER ROUTE. Sharing a page looks cheaper and is wrong: this is a hash-routed SPA, so
    // a second goto only changes the route — the document is never reloaded. When React dies on one
    // route the root stays unmounted, and EVERY later route then reports "rendered nothing". A real
    // run showed exactly that: one genuine crash on /credit-limit produced three more findings on
    // routes that were fine, and the crash was attributed by reading the CURRENT hash, so the
    // labelling drifted too. Isolation costs a browser page and buys a trustworthy result.
    for (const url of routeUrlsFrom()) {
      const page = await browser.newPage();
      const here = [];
      page.on("pageerror", (e) => here.push(String(e).split("\n")[0]));
      page.on("console", (m) => { if (m.type() === "error" && isRealRuntimeError(m.text())) here.push(m.text().split("\n")[0].slice(0, 200)); });
      // Webfonts are not reachable from the build sandbox; a hanging request would look like a
      // broken app rather than a missing network.
      await page.route("**://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
      await page.route("**://fonts.gstatic.com/**", (r) => r.fulfill({ status: 200, body: "" }));
      // The backend does not exist here. Left to fail, every data-driven page sits in its loading
      // state and "mounted empty" fires on pages that are perfectly fine. An empty result set is
      // the honest stand-in: the page gets data, renders its empty state, and a page that STILL
      // renders nothing is genuinely broken.
      await page.route("**/api/db/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows: [], total: 0 }) }));
      await page.goto(`${served.url}/#${url}`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      const empty = await page.evaluate(() => (document.getElementById("root")?.textContent || "").trim().length === 0).catch(() => false);
      if (empty) here.push("rendered nothing — the page mounted empty");
      for (const e of [...new Set(here)]) errors.push(`${url}: ${e}`);
      await page.close().catch(() => {});
    }
    return { ran: true, errors: errors.slice(0, 20) };
  } catch (e) {
    return { ran: false, reason: String((e && e.message) || e).slice(0, 200), errors: [] };
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { if (served) await served.close(); } catch {}
    try { if (dir) fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

function collectDist(dir = DIST, base = "") {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + "/" + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) Object.assign(out, collectDist(full, rel));
    else {
      const buf = fs.readFileSync(full);
      // Text for html/css/js/svg/json/map; base64 for anything binary (images/fonts).
      if (/\.(html|css|js|mjs|svg|json|map|txt|xml|webmanifest)$/i.test(name)) out[rel] = { t: buf.toString("utf8") };
      else out[rel] = { b: buf.toString("base64") };
    }
  }
  return out;
}

// ── Vision-critique support: write a dist map to a temp dir, serve it, and screenshot each route. ──
const CRIT_MAX_BODY = 24 * 1024 * 1024;
const CT = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", svg: "image/svg+xml", json: "application/json", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", map: "application/json", txt: "text/plain", webmanifest: "application/manifest+json" };

// Write a { rel: {t}|{b} } dist map into a fresh temp dir; returns the dir path.
function writeDistToTemp(dist) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crit-"));
  for (const [rel, v] of Object.entries(dist)) {
    const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
    if (safe.startsWith("/") || safe.includes("..")) continue;
    const full = path.join(dir, safe);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (v && typeof v.t === "string") fs.writeFileSync(full, v.t);
    else if (v && typeof v.b === "string") fs.writeFileSync(full, Buffer.from(v.b, "base64"));
  }
  return dir;
}

// Serve a static dir (SPA: unknown paths fall back to index.html for HashRouter). Returns { url, close }.
function serveDir(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((rq, rs) => {
      let p = decodeURIComponent((rq.url || "/").split("?")[0]);
      let file = path.join(dir, p);
      if (!file.startsWith(dir) || p === "/" || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, "index.html");
      if (!fs.existsSync(file)) { rs.writeHead(404); rs.end(); return; }
      const ext = (file.match(/\.([a-z0-9]+)$/i) || [])[1] || "";
      rs.writeHead(200, { "content-type": CT[ext.toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(file).pipe(rs);
    });
    srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); resolve({ url: "http://127.0.0.1:" + port, close: () => new Promise((r) => srv.close(r)) }); });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  // POST /critique { dist:{rel:{t|b}}, routes?, width?, height? } → { ok, shots:[{route, pngBase64}] }
  if (req.method === "POST" && req.url === "/critique") {
    let body = "", tooBig = false;
    req.on("data", (c) => { body += c; if (body.length > CRIT_MAX_BODY) { tooBig = true; req.destroy(); } });
    req.on("end", async () => {
      if (tooBig) return send(res, 413, { ok: false, error: "dist too large" });
      let payload; try { payload = JSON.parse(body); } catch { return send(res, 400, { ok: false, error: "invalid json" }); }
      const dist = payload && payload.dist;
      if (!dist || typeof dist !== "object" || !dist["index.html"]) return send(res, 400, { ok: false, error: "no dist (needs index.html)" });
      const routes = Array.isArray(payload.routes) && payload.routes.length ? payload.routes.slice(0, 12).map(String) : ["/"];
      let dir, served;
      try {
        const { renderRoutes } = await import("./vision-render.mjs"); // lazy: Playwright only loads here
        dir = writeDistToTemp(dist);
        served = await serveDir(dir);
        const shots = await renderRoutes({ url: served.url }, routes, { width: payload.width || 1280, height: payload.height || 900 });
        return send(res, 200, { ok: true, shots });
      } catch (e) {
        return send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 2000) });
      } finally {
        try { if (served) await served.close(); } catch {}
        try { if (dir) fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      }
    });
    return;
  }
  if (req.method !== "POST" || req.url !== "/build") { res.writeHead(404); res.end("nf"); return; }
  let body = "", tooBig = false;
  req.on("data", (c) => { body += c; if (body.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return send(res, 413, { ok: false, error: "source too large" });
    let payload; try { payload = JSON.parse(body); } catch { return send(res, 400, { ok: false, error: "invalid json" }); }
    const files = payload && payload.files;
    if (!files || typeof files !== "object") return send(res, 400, { ok: false, error: "no files" });
    try {
      wipeSrc(); wipeDist();
      let wrote = 0;
      for (const [rel, content] of Object.entries(files)) {
        const safe = safeRel(rel);
        if (!safe || typeof content !== "string") continue;
        const full = path.join(APP, safe);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
        wrote++;
      }
      if (!wrote) return send(res, 400, { ok: false, error: "no valid files written" });
      const r = await runBuild();
      if (r.code !== 0) return send(res, 200, { ok: false, error: (r.err || "build failed").slice(0, 4000) });
      const dist = collectDist();
      if (!dist["index.html"]) return send(res, 200, { ok: false, error: "build produced no index.html" });
      // Both advisory — the build already succeeded, so `ok` stays true whatever these say. The
      // smoke check catches what tsc cannot: a page that compiles and then throws in the browser.
      const types = await runTypecheck();
      const smoke = payload.smoke === false ? { ran: false, reason: "disabled by caller", errors: [] } : await smokeTest(dist);
      return send(res, 200, { ok: true, files: dist, typeErrors: types.errors, typecheckRan: types.ran, runtimeErrors: smoke.errors, smokeRan: smoke.ran, smokeReason: smoke.reason });
    } catch (e) {
      return send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 2000) });
    }
  });
});
// NO_SERVER lets a test import this module for its pure helpers (route derivation, the console-error
// filter) without binding a port — two test runs in CI would otherwise collide on 8080.
if (process.env.NO_SERVER !== "1") {
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => console.log("isibi build-service on :" + PORT));
}
