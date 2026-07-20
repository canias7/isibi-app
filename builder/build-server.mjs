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
import path from "node:path";

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

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
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
