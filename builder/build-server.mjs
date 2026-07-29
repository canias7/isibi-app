// isibi SITE build-service (runs inside the container). Forks ../builder-game/build-server.mjs
// with kaplay swapped back out for the React template, and a `tsc --noEmit` gate in
// front of `vite build` — GENERATOR.md's definition of done is both, so a page that
// only happens to bundle is still a failure here.
//
// Contract:
//   POST /build   { "files": { "index.tsx": "<tsx source>", ... },   // relative to src/routes/
//                   "slug":  "<site slug>",                          // OPTIONAL, baked as VITE_SITE_SLUG
//                   "title": "<brand>" }                             // OPTIONAL, the <title> tag
//     → 200 { "ok": true,  "files": {…dist…}, "ms": N }
//     → 200 { "ok": false, "error": "<tsc output>",  "stage": "typecheck" }
//     → 200 { "ok": false, "error": "<vite stderr>", "stage": "build" }
//   GET  /health  → 200 "ok"
//
// Every build starts from the same shell. src/routes is reset to the pristine copy
// baked into the image (__root.tsx only) before the generated files land, so the
// previous build's pages — and the template's own reference page, which queries a
// schema this site does not have — can never leak into someone's site.
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const APP = process.env.APP_DIR || "/app";
const ROUTES = path.join(APP, "src", "routes");
const ROUTES_BASE = path.join(APP, ".routes-base");
const INDEX_BASE = path.join(APP, ".index-base.html");
const DIST = path.join(APP, "dist");
const GEN = path.join(APP, "src", "routeTree.gen.ts");
const MAX_BODY = 4 * 1024 * 1024;
const STEP_TIMEOUT = 150_000;

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

// Allowlist writes under src/routes: a .tsx file, no traversal, and never the
// root layout or the generated route tree.
function safeRoute(rel) {
  const p = path.normalize(String(rel)).replace(/\\/g, "/").replace(/^(\.\.(\/|$))+/, "").replace(/^\/+/, "");
  if (!p || p.startsWith("/") || p.includes("..")) return null;
  const bare = p.replace(/^(?:src\/)?routes\//, "");
  if (!/^[a-z0-9_$][a-z0-9._$\/-]*\.tsx$/i.test(bare)) return null;
  if (/^__root\.tsx$/i.test(bare) || /routeTree\.gen/i.test(bare)) return null;
  return bare;
}

function resetRoutes() {
  try { fs.rmSync(ROUTES, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(ROUTES, { recursive: true });
  for (const name of fs.readdirSync(ROUTES_BASE)) {
    fs.copyFileSync(path.join(ROUTES_BASE, name), path.join(ROUTES, name));
  }
  try { fs.rmSync(GEN, { force: true }); } catch {}
  try { fs.rmSync(DIST, { recursive: true, force: true }); } catch {}
}

// The published tab should carry the business's name, not the template's "App".
function writeIndexHtml(title) {
  let html = fs.readFileSync(INDEX_BASE, "utf8");
  const t = String(title || "").trim().slice(0, 70);
  if (t) {
    const esc = t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + esc + "</title>");
  }
  fs.writeFileSync(path.join(APP, "index.html"), html);
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: APP, env: { ...process.env, ...(env || {}) } });
    let err = "", out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    const to = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve({ code: -1, out, err: "timed out after " + Math.round(STEP_TIMEOUT / 1000) + "s" }); }, STEP_TIMEOUT);
    child.on("close", (code) => { clearTimeout(to); resolve({ code, out, err }); });
    child.on("error", (e) => { clearTimeout(to); resolve({ code: -1, out, err: String((e && e.message) || e) }); });
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

// One build at a time. Not an optimisation — a correctness requirement.
//
// `getContainer(env.SITE_BUILD_CONTAINER)` is called with no id, so EVERY build
// on the platform lands in this one container, and a build wipes a shared
// src/routes (and dist, and the generated route tree) before writing its own
// pages. Two arriving together destroy each other: observed 2026-07-29 with two
// real builds a second apart — one returned a build failure with no files, the
// other returned a bundle containing neither site's content, and a third run had
// one customer's pages published to another customer's slug.
//
// Serialised rather than given a directory each. A per-build working copy would
// allow real parallelism, but it multiplies disk and memory per concurrent build
// in a container sized for one, and this is the fix that cannot itself be
// subtly wrong. Cloudflare scales container INSTANCES; this only has to make one
// instance honest.
let _chain = Promise.resolve();
function oneAtATime(fn) {
  // The chain is normalised: the result value is dropped so a finished build's
  // whole dist is not retained by the queue, and a rejection is swallowed so it
  // cannot surface as an unhandled one. Not exercised by the handler below,
  // which catches everything itself — kept because those are properties of the
  // primitive rather than of its current only caller.
  const done = _chain.then(fn, fn);
  _chain = done.then(() => {}, () => {});
  return done;
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
    const t0 = Date.now();
    return oneAtATime(async () => {
    try {
      resetRoutes();
      writeIndexHtml(payload.title);
      let wrote = 0;
      for (const [rel, content] of Object.entries(files)) {
        const safe = safeRoute(rel);
        if (!safe || typeof content !== "string") continue;
        const full = path.join(ROUTES, safe);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
        wrote++;
      }
      if (!wrote) return send(res, 400, { ok: false, error: "no valid route files written" });

      // `tsr generate` first: main.tsx imports src/routeTree.gen.ts, so without it
      // the typecheck fails on the template rather than on the generated pages.
      const buildEnv = { NODE_ENV: "production" };
      const slug = String((payload.slug || "")).replace(/[^a-z0-9-]/gi, "").slice(0, 80);
      if (slug) buildEnv.VITE_SITE_SLUG = slug;

      const gen = await run("npx", ["tsr", "generate"], buildEnv);
      if (gen.code !== 0 || !fs.existsSync(GEN)) {
        return send(res, 200, { ok: false, stage: "routes", error: ((gen.err || "") + "\n" + (gen.out || "")).trim().slice(0, 4000) || "could not generate the route tree", ms: Date.now() - t0 });
      }

      const tsc = await run("npx", ["tsc", "--noEmit"], buildEnv);
      if (tsc.code !== 0) {
        // tsc reports on stdout; keep the first errors, which are the causes —
        // the tail is usually the same mistake echoed through the tree.
        return send(res, 200, { ok: false, stage: "typecheck", error: ((tsc.out || "") + "\n" + (tsc.err || "")).trim().slice(0, 6000), ms: Date.now() - t0 });
      }

      const build = await run("npx", ["vite", "build", "--logLevel", "warn"], buildEnv);
      if (build.code !== 0) {
        return send(res, 200, { ok: false, stage: "build", error: ((build.err || "") + "\n" + (build.out || "")).trim().slice(0, 4000) || "build failed", ms: Date.now() - t0 });
      }

      const dist = collectDist();
      if (!dist["index.html"]) return send(res, 200, { ok: false, stage: "build", error: "build produced no index.html", ms: Date.now() - t0 });
      return send(res, 200, { ok: true, files: dist, ms: Date.now() - t0 });
    } catch (e) {
      return send(res, 200, { ok: false, stage: "build", error: String((e && e.message) || e).slice(0, 2000), ms: Date.now() - t0 });
    }
    });
  });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("isibi site build-service on :" + PORT));
