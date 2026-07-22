// isibi GAME build-service (runs inside the container). Forks ../builder/build-server.mjs
// (the React app builder) with the engine swapped for kaplay + a RUNTIME SMOKE TEST.
//
// A game that merely COMPILES can still crash on frame 1 or render nothing, so after
// `vite build` we boot the built game in headless Chromium, feed it synthetic input,
// and capture runtime errors + a non-blank-canvas check. That result drives the
// Worker's Phase-4 auto-fix loop.
//
// Contract:
//   POST /build   { "files": { "<relpath>": "<utf8 source>", ... },
//                   "assets": { "<name>": "<base64>", ... },   // OPTIONAL sprites/sounds
//                   "smoke": true }
//     → 200 { "ok": true,  "files": {…dist…}, "smoke": { "passed": bool, "errors": [...], "blank": bool, "ms": N } }
//     → 200 { "ok": false, "error": "<build stderr>", "stage": "build" }   (compile failed)
//   GET  /health  → 200 "ok"
//
// `assets` are binary game assets (generated sprite PNGs w/ alpha, sound WAV/MP3).
// They're written to public/assets/<name>; Vite copies public/ verbatim into dist/,
// so the game loads them by relative path (assets/<name>) and they're self-contained
// (the smoke test serves the dist locally, so no cross-origin fetch).
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { smokeTest } from "./smoke.mjs";

const APP = process.env.APP_DIR || "/app";
const SRC = path.join(APP, "src");
const DIST = path.join(APP, "dist");
const ASSETS = path.join(APP, "public", "assets");
const MAX_BODY = 12 * 1024 * 1024;
const BUILD_TIMEOUT = 90_000;

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

// Allowlist writes under /app: index.html, vite config, and src/** only.
function safeRel(rel) {
  const p = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  if (p.startsWith("/") || p.includes("..")) return null;
  if (p === "package.json" || p.startsWith("node_modules")) return null;
  if (!/^(index\.html|vite\.config\.js|src\/.+)$/.test(p)) return null;
  return p;
}

function wipeSrc() { try { fs.rmSync(SRC, { recursive: true, force: true }); } catch {} fs.mkdirSync(SRC, { recursive: true }); }
function wipeDist() { try { fs.rmSync(DIST, { recursive: true, force: true }); } catch {} }
function wipeAssets() { try { fs.rmSync(ASSETS, { recursive: true, force: true }); } catch {} fs.mkdirSync(ASSETS, { recursive: true }); }
// Write binary game assets to public/assets/<name>. Names are sanitised to a flat
// filename (no path traversal); only known media extensions are allowed.
function writeAssets(assets) {
  let n = 0;
  for (const [name, b64] of Object.entries(assets || {})) {
    if (typeof b64 !== "string") continue;
    const safe = String(name).replace(/[^a-z0-9._-]/gi, "-");
    if (!/\.(png|jpg|jpeg|webp|mp3|wav|ogg)$/i.test(safe)) continue;
    try { fs.writeFileSync(path.join(ASSETS, safe), Buffer.from(b64, "base64")); n++; } catch {}
  }
  return n;
}

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
      wipeSrc(); wipeDist(); wipeAssets();
      writeAssets(payload.assets);
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
      if (r.code !== 0) return send(res, 200, { ok: false, error: (r.err || "build failed").slice(0, 4000), stage: "build" });
      const dist = collectDist();
      if (!dist["index.html"]) return send(res, 200, { ok: false, error: "build produced no index.html", stage: "build" });
      // Phase 4: runtime smoke test (skippable via {smoke:false} for a raw build).
      let smoke = null;
      if (payload.smoke !== false) {
        try { smoke = await smokeTest(DIST); }
        catch (e) { smoke = { passed: false, errors: ["smoke harness error: " + String(e && e.message || e)], blank: false, ms: 0 }; }
      }
      return send(res, 200, { ok: true, files: dist, smoke });
    } catch (e) {
      return send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 2000), stage: "build" });
    }
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi game build-service on :" + PORT));
