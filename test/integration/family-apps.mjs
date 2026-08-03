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
// FAM_MEASURE=1 adds a second pass that MEASURES the render rather than
// looking at it, and it exists because one bug class was found by eye three
// separate times in one session and never by anything automatic: a component
// that grids to three columns inside a half-width parent, because Tailwind's
// breakpoints are the VIEWPORT's and the CSS is therefore correct. It reports
// two things — a grid child too narrow for the sentence in it, and content
// wider than a box that nothing clips, which is the one that rendered two real
// figures as a third that did not exist.
//
// It runs at 1280 rather than at this harness's 880, and that is load bearing:
// 880 is BELOW the lg breakpoint, so every two-column layout collapses to one
// full-width column and the bug cannot occur there at all. Measuring at 880
// reports a clean sweep on a page that is visibly broken at 1280.
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
// Off by default while it is being calibrated: it REPORTS, it does not fail.
const MEASURE = process.env.FAM_MEASURE === "1";
// Optional and OFF by default, so CI keeps testing what it has always tested:
// that every family's pages build and render at all. `FAM_THEME=auto` gives each
// family a different theme off the shortlist so a human can look at 26 real
// sites rather than 26 copies of one palette; `FAM_THEME=<name>` pins one.
const THEME_MODE = process.env.FAM_THEME || "";
// The screenshot width. 880 by default, and that default is deliberate — see the
// note above the measure pass. But a SIDEBAR family collapses to one column
// below Tailwind's lg breakpoint, so at 880 the first shot of every such page is
// the rail alone and the layout the family is FOR cannot be looked at. FAM_WIDTH
// is how a human sees it. It does not touch the measure pass, which pins 1280 of
// its own accord for a different reason.
const SHOT_WIDTH = Number(process.env.FAM_WIDTH) || 880;
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
  const page = await (await browser.newContext({ viewport: { width: SHOT_WIDTH, height: 800 } })).newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

  const APPS = READY_FAMILIES.map((n) => ({
    id: n, family: n, dir: path.join(TEMPLATE, "src/family-pages", n),
  }));

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
      if (MEASURE) {
        // A SECOND, WIDER VIEWPORT — and this is the whole reason the measure
        // is a separate pass rather than a field on the check above. The
        // harness renders at 880, which is BELOW Tailwind's lg breakpoint, so
        // every `lg:grid-cols-[1.15fr_1fr]` two-column layout collapses to one
        // full-width column. The narrow-column bug cannot occur at 880 — the
        // parent is never narrow — so measuring there reports a clean sweep on
        // a page that is visibly broken at 1280.
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.waitForTimeout(150);
        const m = await page.evaluate(() => {
          const out = { cramped: [], spilling: [], orphans: [] };
          // ORPHANED LIST ITEMS. A kit component whose root is an <li> reads as
          // a "row" — BundleRow, and it is not the only one — so it gets
          // dropped into a `<div className="grid gap-4">`, which is invalid
          // HTML and paints the browser's default bullet and indent on every
          // one of them. Measured: broadband's package table rendered as a
          // bulleted list and looked like unstyled markup.
          //
          // NOTHING ELSE IN THIS REPO CAN SEE IT. tsc has no opinion about
          // where JSX lands, vite bundles it, the page renders and does not
          // throw, and at 880 it reads as merely a bit odd rather than wrong.
          // Same family as the cramped and spilling rules: correct code, wrong
          // picture, and only the DOM knows.
          for (const li of document.querySelectorAll("#root li")) {
            const p = li.parentElement;
            if (!p) continue;
            const t = p.tagName;
            if (t === "UL" || t === "OL" || t === "MENU") continue;
            out.orphans.push({ parent: t, text: (li.textContent || "").trim().slice(0, 48) });
          }
          // Each rule narrows with a CHEAP DOM predicate before reading any
          // style: getComputedStyle over every node costs about twenty seconds
          // a page, which turns a sweep of 290 pages into two hours. Grid
          // containers are found by class (Tailwind always writes `grid`), and
          // a spill is ruled out by scrollWidth before an ancestor is read.
          //
          // CRAMPED: a grid child a hundred-odd pixels wide holding a whole
          // sentence. Tailwind's breakpoints are the VIEWPORT's, so
          // `lg:grid-cols-3` still makes three columns inside a half-width
          // parent — the CSS is correct and the result is four-word lines.
          for (const el of document.querySelectorAll("#root [class*=grid]")) {
            const cs = getComputedStyle(el);
            if (cs.display !== "grid") continue;
            if (cs.gridTemplateColumns.split(" ").filter(Boolean).length < 2) continue;
            for (const kid of el.children) {
              const kw = kid.getBoundingClientRect().width;
              if (!(kw > 0 && kw < 160)) continue;
              // FLOW TEXT ONLY — absolutely-positioned subtrees are skipped.
              // An overlay caption, badge or ribbon sits ON the child rather
              // than wrapping inside it, so it is no part of the problem this
              // rule looks for. Without this the first four findings of a
              // 290-page sweep were all one artifact: SafeImage's placeholder
              // paints the alt as an overlay caption, so a card reading
              // "Theo Marsh / Design lead" counted as
              // "Theo MarshTheo MarshDesign lead" — 31 characters where 21 are
              // real, and a real photograph would have had none of them.
              //
              // Computed only for children already known to be narrow, so the
              // per-node getComputedStyle stays off the hot path.
              let text = "";
              (function walk(n) {
                for (const c of n.childNodes) {
                  if (c.nodeType === 3) { text += c.nodeValue; continue; }
                  if (c.nodeType !== 1) continue;
                  const pos = getComputedStyle(c).position;
                  if (pos === "absolute" || pos === "fixed") continue;
                  walk(c);
                }
              })(kid);
              text = text.trim().replace(/\s+/g, " ");
              if (text.length < 30) continue;
              // How many lines it actually wraps to, which is what decides
              // legibility: 154px over three lines is a card, 110px over
              // seven is the bug. Width alone cannot tell those apart, which
              // is why the first threshold flagged a SpecRow that renders
              // perfectly well.
              const lh = parseFloat(getComputedStyle(kid).lineHeight) || 20;
              const lines = Math.round(kid.getBoundingClientRect().height / lh);
              // FOUR, and the number is calibrated against renders rather than
              // chosen. A SpecRow value in a 154px card wraps to three and is
              // perfectly legible — I looked. All four of the bugs this rule
              // exists for were more: TrustStrip put "Checkable on the
              // register" over five lines in ~100px, and TeamGrid put a name
              // on two and a role on four.
              if (lines < 4) continue;
              out.cramped.push({ w: Math.round(kw), chars: text.length, lines, text: text.slice(0, 48) });
            }
          }
          // SPILLING: content wider than its box with NOTHING between it and
          // the root that clips or scrolls. Inside a clipping ancestor the
          // result is truncation, which is deliberate and visible; with no
          // clipping ancestor it is painted across whatever sits beside it,
          // which is the failure that rendered two real figures as a third.
          for (const el of document.querySelectorAll("#root *")) {
            if (el.children.length || !el.textContent.trim()) continue;
            const w = el.clientWidth;
            if (!w || el.scrollWidth <= w + 2) continue;
            let contained = false;
            for (let a = el; a && a.id !== "root"; a = a.parentElement) {
              const acs = getComputedStyle(a);
              if (acs.overflowX !== "visible" || acs.overflowY !== "visible") { contained = true; break; }
            }
            if (!contained) {
              out.spilling.push({ w, need: el.scrollWidth, text: el.textContent.trim().slice(0, 48) });
            }
          }
          return out;
        });
        await page.setViewportSize({ width: SHOT_WIDTH, height: 800 });
        for (const c of m.cramped) console.log(`  cramped  ${label}  ${c.w}px · ${c.chars} chars · ~${c.lines} lines — ${JSON.stringify(c.text)}`);
        for (const c of m.spilling) console.log(`  spilling ${label}  ${c.w}px box, ${c.need}px content — ${JSON.stringify(c.text)}`);
        for (const c of m.orphans) console.log(`  orphan   ${label}  <li> inside <${c.parent}> — ${JSON.stringify(c.text)}`);
      }
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
