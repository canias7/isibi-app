// WHAT A THEMED SITE ACTUALLY LOOKS LIKE.
//
// theme-seam.mjs proves the theme's CSS reaches the dist. That is not the same
// as the site looking right, and this repo has the scar to prove it: all 70
// charts once rendered GREY while typechecking perfectly, because they asked for
// `hsl(var(--chart-1))` against a v4 token that already holds a complete colour.
// Nothing in the suite could see it. It was found by LOOKING at a render.
//
// So this builds real sites with a real theme and a real structure, serves them
// the way production does, and photographs each in both modes. It asserts what a
// picture can be checked against — that the two modes actually differ, that the
// page is not blank, that nothing threw — and leaves the judgement of whether it
// looks GOOD to the person reading the screenshots, which is the only place that
// judgement can live.
//
// $0: no model call, no Neon project. The pages are the template's own reference
// app; only the theme and the structure vary.
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import { serveSite, loadSiteServer } from "./lib/serve-site.mjs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = path.join(import.meta.dirname, "../..");
const TEMPLATE = path.join(ROOT, "builder/lovable/template");
const BUILD_PORT = 8461, SITE_PORT = 8462;
const OUT = process.env.SHOT_DIR || path.join(os.tmpdir(), "theme-render");

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      for (const rel of rels) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) found.push(p);
      }
    }
  } catch { /* fall through to playwright's own lookup */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}
const chromiumPath = findChromium();

// Which looks to photograph. Deliberately spread: a print theme, a dark one, a
// loud one and a quiet one, so a change that only breaks one family of them
// cannot pass unseen. `zine` and `bauhaus` sit OFF the 100-name shortlist on
// purpose — the enum bounds what the designer picks, the registry keeps all
// 500, and these two are the living proof a registry-only theme still renders.
const CASES = (process.env.THEME_CASES || "broadsheet,editorial,zine,bauhaus")
  .split(",").map((s) => s.trim()).filter(Boolean);

// A NAME ON THE WIRE AGAIN (2026-08-27, owner's call). This harness has now
// crossed the seam in BOTH directions: it posted `theme: <name>` for a day
// after the registry left the product — `writeTheme` was handed
// `payload.seeds`, which was `undefined`, and all four sites were built on the
// TEMPLATE'S OWN palette while the screenshots were filed as the theme's — and
// then posted `seeds` for the registry-less week. The registry is back in the
// product, so the name is the payload again, and what these screenshots show is
// richer than the seeds era could: the FULL theme — its axes, its world layer,
// its typefaces — not just its three anchor colours.

const SERVICES = [
  { id: 1, name: "Skin fade", description: "Clippers, blended to the skin.", price: 28, duration_minutes: 45, created_at: "2026-08-02 10:00:00" },
  { id: 2, name: "Beard trim", description: "Shaped and hot-towelled.", price: 15, duration_minutes: 20, created_at: "2026-08-02 10:00:00" },
  { id: 3, name: "Cut and finish", description: "Scissor cut, washed and dried.", price: 34, duration_minutes: 60, created_at: "2026-08-02 10:00:00" },
];

let passed = 0, failed = 0;
const ok = (n, c, x) => { c ? (passed++, console.log("  ok   " + n)) : (failed++, console.log("  FAIL " + n + (x ? "\n       -> " + String(x).slice(0, 400) : ""))); };

const ROUTES = Object.fromEntries(
  fs.readdirSync(path.join(TEMPLATE, "src/routes"))
    .filter((f) => f.endsWith(".tsx") && f !== "__root.tsx")
    .map((f) => [f, fs.readFileSync(path.join(TEMPLATE, "src/routes", f), "utf8")]),
);

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "theme-render-"));
let buildSrv = null, siteSrv = null, browser = null;
let dist = {};
// Reloaded after every build — see `serveSite`: the server is resolved per
// request precisely because the site under test changes underneath it.
let siteFetch = null;
fs.mkdirSync(OUT, { recursive: true });

const send = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(obj));
};

try {
  fs.cpSync(TEMPLATE, sandbox, { recursive: true, filter: (s) => !/(^|[\\/])(node_modules|dist)$/.test(s) });
  fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(sandbox, "node_modules"), "dir");
  fs.mkdirSync(path.join(sandbox, ".routes-base"), { recursive: true });
  fs.copyFileSync(path.join(sandbox, "src/routes/__root.tsx"), path.join(sandbox, ".routes-base/__root.tsx"));
  fs.copyFileSync(path.join(sandbox, "src/styles.css"), path.join(sandbox, ".styles-base.css"));

  buildSrv = spawn("node", [path.join(ROOT, "builder/build-server.mjs")], {
    env: { ...process.env, APP_DIR: sandbox, PORT: String(BUILD_PORT), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  buildSrv.stderr.on("data", (d) => process.stderr.write("  [build] " + d));
  let up = false;
  for (let i = 0; i < 80 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${BUILD_PORT}/health`)).ok; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!up) throw new Error("build service never came up");

  // Serves the current dist plus a stub of the Data API, exactly as
  // site-runtime.mjs does — a page with no data renders its error state, and an
  // error state is not what anybody wants to look at when judging a theme.
  // THE DOCUMENT COMES FROM THE BUILT SERVER, not from a dist file. Under
  // TanStack Start `dist/client` has no HTML at all, and this served
  // `dist["index.html"]` for every address — measured as "9 chars" (the router's
  // own Not found) on all four themes, light and dark. One helper now, shared
  // with every other harness that stands a site up.
  siteSrv = serveSite({
    assets: (rel) => dist[rel] || null,
    ssr: () => siteFetch,
    extra: (req, res, url) => {
      const m = url.pathname.match(/^\/api\/db\/([^/]+)\/data\/([^/]+)$/);
      if (!m) return false;
      send(res, 200, m[2] === "services" ? SERVICES : []);
      return true;
    },
  });
  await new Promise((r) => siteSrv.listen(SITE_PORT, r));

  // playwright is one of the TEMPLATE's devDependencies, not the root's — the
  // root package.json is what wrangler bundles. Resolved from there, exactly as
  // site-runtime.mjs does; a bare `import("playwright")` throws here, which is
  // how every screenshot step in this repo once silently produced nothing.
  const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");
  // The pinned playwright and the pre-installed browser build usually disagree,
  // and downloading a matching one is slow and sometimes blocked. The build
  // number is not what this is about.
  browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});

  const signature = {};
  for (const theme of CASES) {
    const built = await (await fetch(`http://127.0.0.1:${BUILD_PORT}/build`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: ROUTES, slug: "look", title: "Cutler Row", theme }),
    })).json();
    ok(`${theme}: builds`, built.ok === true, built.stage + ": " + built.error);
    if (!built.ok) continue;
    // By ID — `applied: true` alone was satisfied once by a build that applied
    // a DIFFERENT look than the one these screenshots were filed under.
    ok(`${theme}: the theme applied`, built.theme && built.theme.applied === true && built.theme.theme === theme,
      JSON.stringify(built.theme));
    dist = built.files;
    siteFetch = await loadSiteServer(sandbox);

    const shots = {};
    for (const mode of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      // AT `/`, which is where a published site really is: `cleanSlug` refuses an
      // edge hyphen, so every slug is a legal DNS label and every site has a
      // pretty host. It was `/s/look/` from when that was a second render mount.
      await page.goto(`http://127.0.0.1:${SITE_PORT}/`, { waitUntil: "networkidle" });
      if (mode === "dark") {
        await page.evaluate(() => document.documentElement.classList.add("dark"));
        await page.waitForTimeout(250);
      }
      // VIEWPORT, NOT fullPage — and this is a correctness fix, not a
      // preference. A theme with a `backdrop` emits
      // `background-attachment: fixed`, and a full-page capture paints a fixed
      // background across ONE viewport height and leaves the rest flat. The
      // first run of this harness produced a hard grey band cutting through the
      // middle of bauhaus's price list, which reads exactly like a broken theme
      // and is a screenshot artifact. A harness that cannot fail honestly is
      // worse than no harness; this is what a visitor actually sees.
      //
      // AND THE BACKDROP IS REACHABLE AGAIN (2026-08-27): a theme name carries
      // the whole theme, `bauhaus` in this very case list declares
      // `backdrop: "wash"`, so `background-attachment: fixed` is emitted on this
      // run and a stitched capture would be the same lie it was the first time.
      const shot = path.join(OUT, `${theme}-${mode}.png`);
      await page.screenshot({ path: shot });
      // The rest of the page still has to be looked at, so it is captured as its
      // own scrolled frames rather than one lying stitch.
      for (let n = 1; n <= 2; n++) {
        await page.evaluate((i) => window.scrollTo(0, i * window.innerHeight), n);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(OUT, `${theme}-${mode}-${n + 1}.png`) });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const text = await page.locator("body").innerText();
      // A blank page screenshots perfectly well, which is how a broken render
      // gets sent out as a good one — asserted on the DOM, not on the file.
      ok(`${theme}/${mode}: the page has content`, text.length > 200, `${text.length} chars`);
      ok(`${theme}/${mode}: no runtime error`, errors.length === 0, errors.join("\n"));
      // PAPER, INK AND ACCENT — the three colours a palette is authored from, so
      // two looks can only collide here by being the same design. Background and
      // ink alone would false-alarm on a pair differing only in their accent,
      // which is an ordinary thing for two themes to be, and a check that cries
      // wolf on correct work is worse than the miss it prevents.
      shots[mode] = await page.evaluate(() => {
        const b = getComputedStyle(document.body);
        return [b.backgroundColor, b.color,
          getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()].join("|");
      });
      await ctx.close();
    }
    // Both modes rendering identically means the theme's `.dark` block never
    // landed — the site would look correct in one mode and wrong in the other,
    // and a single screenshot would never show it.
    ok(`${theme}: light and dark actually differ`, shots.light !== shots.dark, `both were ${shots.light}`);
    signature[theme] = shots.light;
  }

  // AND THE ONE ASSERTION THAT COULD NOT PASS ON AN UNTHEMED SITE. Every check
  // above is about ONE build, and the template's own shadcn palette has a `.dark`
  // block of its own — so "the page has content", "nothing threw" and even "light
  // and dark differ" were all satisfied, four times over, on the day these sites
  // were built with no palette at all. Four builds differing ONLY in their seeds
  // must paint four different pages; identical ones mean the seeds reached the
  // stylesheet and not the screen, which is the failure this harness exists for
  // and the only one a picture alone cannot be checked against.
  const looks = CASES.filter((t) => signature[t]);
  if (looks.length < 2) {
    console.log(`  skip the themes-differ check: ${looks.length} look(s) rendered, it needs 2+`);
  } else {
    const distinct = new Set(looks.map((t) => signature[t]));
    ok("the looks render as different pages, not one palette four times",
      distinct.size === looks.length,
      looks.map((t) => `${t} ${signature[t]}`).join("\n          "));
  }
  console.log("\nscreenshots in " + OUT);
} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + ((e && (e.stack || e.message)) || e));
} finally {
  if (browser) { try { await browser.close(); } catch {} }
  if (siteSrv) { try { siteSrv.close(); } catch {} }
  if (buildSrv) { try { buildSrv.kill("SIGKILL"); } catch {} }
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch {}
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
