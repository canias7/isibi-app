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
import { renderRoutes } from "./vision-render.mjs";

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

function wipeSrc() { try { fs.rmSync(SRC, { recursive: true, force: true }); } catch {} fs.mkdirSync(SRC, { recursive: true }); }
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
      return send(res, 200, { ok: true, files: dist });
    } catch (e) {
      return send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 2000) });
    }
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi build-service on :" + PORT));
