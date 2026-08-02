// Every family reference app, built and driven for real.
//
// WHY THIS IS THE ONLY HONEST CHECK for src/family-pages. Each family app
// declares its own routes — /listing, /guide, /event — and createFileRoute's
// path union comes from the generated route tree's module augmentation. The
// TEMPLATE's tree registers only the reference site's routes, so a static tsc
// over family-pages either refuses every non-"/" path (checked against the
// template tree) or checks nothing (excluded). The configuration in which
// these files are real is a SITE BUILD: their files posted as src/routes,
// `tsr generate` run over them, tsc + vite on the result. That is what this
// does, per family, through the same build-server a customer build uses.
//
// And compiling is not working — this repo has proven that more times than it
// has fingers — so every page of every family is then loaded in a real
// browser: it must render actual nodes, must not trip the error boundary, and
// must not throw. Screenshots land in FAM_SHOTS if set, so the render can be
// LOOKED at, which is how the grey charts and the white-glow shadows were
// caught after every typecheck in the repo passed.
//
// $0: no model call, no Neon project. One build server, one sequential build
// per family. FAM_ONLY=store,workspace scopes the run while iterating on one
// family's pages; unset, every family builds, which is what CI does.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { FAMILIES, READY_FAMILIES } from "../../builder/site-layouts.mjs";
import { THEME_SHORTLIST, resolveTheme } from "../../builder/site-theme-registry.mjs";

const ROOT = path.join(import.meta.dirname, "../..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");
const PORT = 17910;
const SHOTS = process.env.FAM_SHOTS || "";
// Optional and OFF by default, so CI keeps testing what it has always tested:
// that every family's pages build and render at all. `FAM_THEME=auto` gives each
// family a different theme off the shortlist so a human can look at 26 real
// sites rather than 26 copies of one palette; `FAM_THEME=<name>` pins one.
const THEME_MODE = process.env.FAM_THEME || "";
// Deterministic, not random: the same family gets the same theme every run, so
// two runs can be compared and a bad pairing can be reported by name.
const themeFor = (name, i) =>
  !THEME_MODE ? null
  : THEME_MODE === "auto" ? THEME_SHORTLIST[i % THEME_SHORTLIST.length]
  : (resolveTheme(THEME_MODE) ? THEME_MODE : null);

let failed = 0;
const ok = (label) => console.log("  ok   " + label);
const bad = (label, detail) => { failed++; console.log("  FAIL " + label + (detail ? "\n" + String(detail).slice(0, 500) : "")); };

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const d of fs.readdirSync(root)) {
      for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
        const p = path.join(root, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch { /* fall through to playwright's own resolution */ }
  return null;
}

// A sandbox copy so the real template's src/routes is never touched — the
// build server RESETS routes between builds, which on the real template would
// delete the reference site.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-famapps-"));
let server = null, web = null, browser = null, current = null;

try {
  fs.cpSync(TEMPLATE, sandbox, { recursive: true, filter: (s) => !/(^|[\\/])(node_modules|dist)$/.test(s) });
  fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(sandbox, "node_modules"), "dir");
  fs.mkdirSync(path.join(sandbox, ".routes-base"), { recursive: true });
  fs.copyFileSync(path.join(sandbox, "src/routes/__root.tsx"), path.join(sandbox, ".routes-base/__root.tsx"));
  fs.copyFileSync(path.join(sandbox, "index.html"), path.join(sandbox, ".index-base.html"));
  fs.copyFileSync(path.join(sandbox, "src/styles.css"), path.join(sandbox, ".styles-base.css"));
  for (const f of fs.readdirSync(path.join(sandbox, "src/routes"))) {
    if (f !== "__root.tsx") fs.rmSync(path.join(sandbox, "src/routes", f), { force: true });
  }

  server = spawn("node", [path.join(ROOT, "builder", "build-server.mjs")], {
    env: { ...process.env, APP_DIR: sandbox, PORT: String(PORT), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let up = false;
  for (let i = 0; i < 240 && !up; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/health`); up = true; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) throw new Error("build server never came up");

  // Serves whatever the LAST build produced, at /s/<slug>/ like production.
  web = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const m = u.pathname.match(/^\/s\/[^/]+\/?(.*)$/);
    const rel = m ? (m[1] || "index.html") : "index.html";
    const f = current && (current[rel] || current["index.html"]);
    if (!f) { res.writeHead(404); return res.end("nf"); }
    const ext = (rel.match(/\.([a-z0-9]+)$/i) || [])[1] || "html";
    res.writeHead(200, { "content-type": { js: "text/javascript", css: "text/css", svg: "image/svg+xml", html: "text/html; charset=utf-8" }[ext] || "application/octet-stream" });
    res.end(f.t != null ? f.t : Buffer.from(f.b, "base64"));
  });
  await new Promise((r) => web.listen(PORT + 1, r));

  const exe = findChromium();
  browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport: { width: 880, height: 800 } })).newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

  // The families, then whichever VARIANT apps exist. A variant is the same
  // family's declared pages arranged differently, so it builds identically —
  // only the folder and the slug differ. Discovered from disk rather than from
  // the module, because a variant app is optional: nineteen are declarable and
  // they land a few at a time.
  const VDIR = path.join(TEMPLATE, "src/variant-pages");
  const variantApps = fs.existsSync(VDIR)
    ? fs.readdirSync(VDIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  const APPS = [
    ...READY_FAMILIES.map((n) => ({ id: n, family: n, dir: path.join(TEMPLATE, "src/family-pages", n) })),
    ...variantApps.map((d) => ({
      id: d, family: d.slice(0, d.indexOf("__")), dir: path.join(VDIR, d),
    })),
  ];

  const ONLY = new Set((process.env.FAM_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean));
  for (const app of APPS.filter((a) => ONLY.size === 0 || ONLY.has(a.id))) {
    const name = app.id;
    const dir = app.dir;
    const files = {};
    for (const p of FAMILIES[app.family].pages) {
      files[p.file + ".tsx"] = fs.readFileSync(path.join(dir, p.file + ".tsx"), "utf8");
    }

    const built = await (await fetch(`http://127.0.0.1:${PORT}/build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files, slug: "f-" + name, title: name, theme: themeFor(name, APPS.findIndex((a) => a.id === name)) }),
    })).json();
    if (!built.ok) { bad(`${name} refused at ${built.stage}`, built.error); continue; }
    current = built.files;

    // Every declared page, loaded fresh (goto, not hashchange — a full load per
    // route also proves each one boots from a cold start).
    for (const p of FAMILIES[app.family].pages) {
      const route = p.file === "index" ? "/" : "/" + p.file;
      pageErrors.length = 0;
      await page.goto(`http://127.0.0.1:${PORT + 1}/s/f-${name}/?v=${name}-${p.file}#${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const d = await page.evaluate(() => ({
        nodes: document.querySelectorAll("#root *").length,
        boundary: /didn.t load|something went wrong/i.test(document.body.innerText),
      }));
      const label = `${name} ${route}`;
      // The floor catches a BLANK render (chrome alone is ~5-10 nodes), not a
      // sparse one — transactional's status page is 26 nodes and correct; that
      // family's whole discipline is showing nothing it doesn't need.
      if (d.nodes < 20) bad(`${label} rendered almost nothing (${d.nodes} nodes)`);
      else if (d.boundary) bad(`${label} tripped the error boundary`);
      else if (pageErrors.length) bad(`${label} threw`, pageErrors.join(" | "));
      else ok(`${label} — ${d.nodes} nodes`);
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.addStyleTag({ content: "header{position:static !important}" });
        // VIEWPORT FRAMES, NOT fullPage. A theme with a `backdrop` emits
        // `background-attachment: fixed`, and a full-page capture paints it
        // across ONE viewport height and leaves the rest flat — which reads as a
        // hard band through the middle of the page and looks exactly like a
        // broken theme. Caught in theme-render.mjs first; same trap here the
        // moment FAM_THEME is used.
        await page.screenshot({ path: path.join(SHOTS, `fam-${name}--${p.file}.png`) });
        for (let n = 1; n <= 2; n++) {
          await page.evaluate((k) => window.scrollTo(0, k * window.innerHeight), n);
          await page.waitForTimeout(150);
          await page.screenshot({ path: path.join(SHOTS, `fam-${name}--${p.file}-${n + 1}.png`) });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    }
  }
} catch (e) {
  bad("harness", e && e.stack || e);
} finally {
  if (browser) try { await browser.close(); } catch { /* closing */ }
  if (web) try { web.close(); } catch { /* closing */ }
  if (server) try { server.kill("SIGKILL"); } catch { /* closing */ }
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* tmp */ }
}

console.log(`\nfamily apps: ${failed === 0 ? "all pages built and rendered" : failed + " failure(s)"}`);
process.exit(failed ? 1 : 0);
