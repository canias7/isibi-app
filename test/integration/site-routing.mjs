// EVERY PAGE OF EVERY PUBLISHED SITE USED TO HAVE THE SAME ADDRESS.
//
// The template ran on `createHashHistory()`, so a barber shop's booking page was
// `…/#/book`. A fragment never reaches a server, and three things followed: a
// search engine saw ONE page per site (the Services and Booking pages could not
// be indexed at all), every shared link previewed the home page whatever you
// copied, and `logSiteHit` recorded every visit in a site's life as "/".
//
// It was hash routing for a reason — `/s/<slug>/book` looked for a `book.html`
// that vite never emits, and 404'd. The Worker answers that now, so pages have
// real addresses; this proves the two halves work TOGETHER, which is the only
// way either is worth anything.
//
// Two mounts, because one bundle serves both and a build-time constant would be
// wrong on one of them: `/s/<slug>/` on our own domain, and `/` on the owner's
// custom domain, where the Worker rewrites the Host. The basepath is derived at
// runtime from `import.meta.url` precisely so neither has to be guessed.
//
// $0: no model call, no container, no Neon project. Needs the template built.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "builder/lovable/template");
// BUILT INTO A SANDBOX, like every other integration test here, rather than read
// out of the template's own `dist`. That directory exists on a machine where
// somebody has run a build by hand and NOT on a fresh checkout — so reading it
// makes this pass locally and fail in CI on a missing file, which is the exact
// trap the workflow already records for the browser steps.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-routing-"));
const DIST = path.join(sandbox, "dist");

// Use whatever Chromium is on the machine — same reasoning as site-runtime.mjs.
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-headless-shell-linux64/chrome-headless-shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) for (const rel of rels) {
      const p = path.join(root, dir, rel);
      if (fs.existsSync(p)) found.push(p);
    }
  } catch { /* let playwright resolve its own */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}

const MIME = { js: "text/javascript", css: "text/css", svg: "image/svg+xml", woff2: "font/woff2", woff: "font/woff", html: "text/html; charset=utf-8", txt: "text/plain", json: "application/json" };

// The Worker's serving rules, reproduced exactly: an extensionless miss falls
// back to the app shell, an asset never does, and `./` in HTML is rewritten to
// the mount root. Kept in step with worker.js by `site-routing-rules` below,
// which reads the real source — a harness that drifts from the thing it stands
// in for is worse than no harness (the `setTotp` lesson).
function serve(mountPrefix) {
  return http.createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (mountPrefix && !p.startsWith(mountPrefix)) { res.writeHead(404); return res.end("not found"); }
    const rest = p.slice(mountPrefix.length).replace(/^\/+/, "").replace(/\/+$/, "");
    const ext = ((rest.split("/").pop() || "").match(/\.([a-z0-9]{1,8})$/i) || [])[1];
    let full = path.join(DIST, rest === "" ? "index.html" : ext ? rest : rest + ".html");
    if (!fs.existsSync(full)) {
      if (!ext && rest !== "") full = path.join(DIST, "index.html");   // the fallback
      else { res.writeHead(404); return res.end("not found"); }
    }
    const kind = full.endsWith(".html") ? "html" : ((full.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || "");
    let body = fs.readFileSync(full);
    if (kind === "html") {
      body = Buffer.from(body.toString("utf8").replace(/(\s(?:src|href))="\.\//g, '$1="' + (mountPrefix || "") + "/"));
    }
    res.writeHead(200, { "content-type": MIME[kind] || "application/octet-stream" });
    res.end(body);
  });
}

let passed = 0, failed = 0;
const ok = (n, c, x) => { c ? (passed++, console.log("  ok   " + n)) : (failed++, console.log("  FAIL " + n + (x ? "  -> " + String(x).slice(0, 220) : ""))); };

if (!fs.existsSync(path.join(TEMPLATE, "node_modules"))) {
  console.error("the template's dependencies are not installed — run `npm ci` in " + TEMPLATE);
  process.exit(1);
}
fs.cpSync(TEMPLATE, sandbox, { recursive: true, filter: (src) => !/(^|[\\/])(node_modules|dist|dist-ssr)$/.test(src) });
fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(sandbox, "node_modules"), "dir");
{
  const sh = (cmd, args) => new Promise((r) => spawn(cmd, args, { cwd: sandbox, stdio: ["ignore", "ignore", "inherit"] }).on("close", r));
  await sh("npx", ["tsr", "generate"]);
  const code = await sh("npx", ["vite", "build", "--logLevel", "error"]);
  ok("the template builds", code === 0 && fs.existsSync(path.join(DIST, "index.html")), "vite exited " + code);
  if (!fs.existsSync(path.join(DIST, "index.html"))) { console.log("\n0 passed, 1 failed"); process.exit(1); }
}

// ── the rules this harness copies must still be the rules worker.js applies ──
{
  const w = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  ok("worker.js still falls back on an extensionless miss",
    w.includes('if (!obj && !ext && rest !== "") {'));
  ok("…and still rewrites relative asset roots for the mount it is serving",
    /replace\(\/\(\\s\(\?:src\|href\)\)="\\\.\\\/\/g, '\$1="' \+ mountRoot\)/.test(w) ||
    w.includes(`replace(/(\\s(?:src|href))="\\.\\//g, '$1="' + mountRoot)`),
    "the rewrite this harness reproduces is gone from worker.js");
}

// playwright is one of the TEMPLATE's devDependencies, not the root's. A bare
// `import("playwright")` resolves from THIS file and throws ERR_MODULE_NOT_FOUND
// in CI — which is exactly what it did, and theme-render.mjs already carries a
// comment saying so. Resolved from the template's package.json like the other
// two browser tests here.
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");

for (const [label, prefix, port] of [["served at /s/<slug>/ (our domain)", "/s/demo", 8123], ["served at / (a custom domain)", "", 8124]]) {
  console.log("\n" + label);
  const srv = serve(prefix);
  await new Promise((r) => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}${prefix}`;
  const browser = await chromium.launch({ executablePath: findChromium() || undefined });
  try {
    const page = await browser.newPage();
    const missing = [];
    page.on("response", (r) => { if (r.status() >= 400 && /\.(js|css|svg|woff2?)(\?|$)/.test(r.url())) missing.push(r.status() + " " + r.url().split("/").pop()); });
    const threw = [];
    page.on("pageerror", (e) => threw.push(String(e.message).slice(0, 140)));

    await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
    ok("the home page renders", (await page.locator("#root *").count()) > 0);

    await page.goto(base + "/book", { waitUntil: "networkidle", timeout: 30000 });
    ok("a deep link renders instead of 404ing", (await page.locator("#root *").count()) > 0);
    ok("and its address carries no #", !page.url().includes("#"), page.url());

    // THE ASSERTION THAT HAS TO BE REAL — and the weak version of it passed
    // against a broken build. `url.endsWith("/book")` is true simply because we
    // navigated there: with the basepath wrong, the router matches nothing and
    // renders Not Found at that same URL. Only the CONTENT says which route
    // resolved. Verified by mutation: `basepath: "/"` at a sub-path mount makes
    // this line, and only this line, go red.
    const body = await page.locator("#root").innerText();
    ok("and it is the BOOK route, not a miss rendered at /book",
      /Book a chair/i.test(body), body.slice(0, 180).replace(/\s+/g, " "));

    ok("no asset 404'd", missing.length === 0, missing.join(", "));
    ok("nothing threw", threw.length === 0, threw.join(" | "));
    await page.close();
  } catch (e) {
    failed++;
    console.log("  FAIL could not drive the built app -> " + String(e && e.message).slice(0, 220));
  } finally {
    await browser.close().catch(() => {});
    srv.close();
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
