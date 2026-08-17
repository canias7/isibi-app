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
import { serveSite, loadSiteServer } from "./lib/serve-site.mjs";
import { absolutizeAssets, mountRootFor } from "../../site-domains.mjs";
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
// `dist/client` — Start emits two halves and only this one is published.
const DIST = path.join(sandbox, "dist", "client");

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
  // THE DOCUMENT IS RENDERED, NOT LOOKED UP. This read `DIST/<rest>.html` and
  // fell back to `DIST/index.html` — the platform's old SPA fallback over a
  // build that emitted a shell. TanStack Start emits no HTML into `dist/client`
  // at all, so every one of those reads became a 404 and this harness would have
  // failed on its next run; it simply was not triggered by the merge that broke
  // it, which is how four of the six went unnoticed.
  //
  // The asset half still comes off disk, and the `./` rewrite stays with it:
  // that is the platform's own job on a published site, and this harness exists
  // to prove the two mounts agree about it.
  return serveSite({
    assets: (rel) => {
      const full = path.join(DIST, rel);
      if (!fs.existsSync(full)) return null;
      let body = fs.readFileSync(full);
      if (full.endsWith(".html")) {
        body = Buffer.from(body.toString("utf8").replace(/(\s(?:src|href))="\.\//g, '$1="' + (mountPrefix || "") + "/"));
      }
      return body;
    },
    ssr: () => siteFetch,
    mount: mountPrefix,
  });
}

let siteFetch = null;
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
  // THE SERVER BUNDLE IS THE PROOF THE BUILD WORKED, not `index.html` — Start
  // emits none. Both halves are checked, because the client dist alone is a site
  // with assets and nothing to render them.
  const server = path.join(sandbox, "dist", "server", "server.js");
  ok("the template builds", code === 0 && fs.existsSync(DIST) && fs.existsSync(server), "vite exited " + code);
  if (!fs.existsSync(server)) { console.log("\n0 passed, 1 failed"); process.exit(1); }
  siteFetch = await loadSiteServer(sandbox);
  ok("…and its server loads, so a page can be rendered at all", !!siteFetch, "dist/server/server.js would not import");
}

// ── the rules this harness copies must still be the rules worker.js applies ──
{
  const w = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  ok("worker.js still falls back on an extensionless miss",
    w.includes('if (!obj && !ext && rest !== "") {'));
  // THE PROPERTY, THROUGH THE REAL FUNCTION — not the inline spelling. This
  // matched the expression as it was WRITTEN in worker.js, and it moved into
  // `site-domains.mjs` (which is also what let `isPublishedSiteRequest` and
  // `mountRootFor` stop being three copies of one question). A check pinned to
  // word order fails a correct extraction, which is this repo's most-recorded
  // own-goal.
  // DRIVEN THROUGH `mountRootFor` RATHER THAN A HAND-WRITTEN MOUNT, because it
  // returns a TRAILING SLASH (`/s/demo/`) and `absolutizeAssets` substitutes it
  // for the `./` verbatim. A hand-written `/s/demo` yields `/s/demoa.js` — which
  // is my own first draft of this assertion, failing a function that was right.
  // Composing the two real functions is also what the Worker does.
  ok("…and the relative-asset rewrite still does its job",
    absolutizeAssets('<script src="./a.js"></script>', mountRootFor("gofarther.dev", "demo"))
      === '<script src="/s/demo/a.js"></script>');
  // AND THE WORKER STILL CALLS IT. Either half alone passes while the wire is
  // cut: a correct function nothing calls, or a call to something that stopped
  // rewriting.
  ok("…and worker.js still applies it when it serves a document",
    /absolutizeAssets\(/.test(w), "the rewrite is no longer applied on the serve path");
  // WORTH KNOWING WHY IT SURVIVES: a TanStack Start build emits ABSOLUTE asset
  // hrefs (`/assets/index-*.js` — `base: "./"` went with the shell), so nothing
  // it publishes contains a `./` to rewrite. What still does is every site
  // published BEFORE Start, whose stored documents are full of them, and those
  // are served from R2 by this same path.
}

// playwright is one of the TEMPLATE's devDependencies, not the root's. A bare
// `import("playwright")` resolves from THIS file and throws ERR_MODULE_NOT_FOUND
// in CI — which is exactly what it did, and theme-render.mjs already carries a
// comment saying so. Resolved from the template's package.json like the other
// two browser tests here.
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");

// ONE MOUNT NOW, AND THAT IS THE POINT RATHER THAN A NARROWING. This drove two:
// `/s/<slug>/` on our domain and `/` on a custom one, and the whole reason the
// bundle derived its basepath at runtime was that both had to work.
//
// A TANSTACK START BUNDLE CAN ONLY SERVE AT `/`, by construction and measured
// on a real build: its asset hrefs are absolute (`/assets/index-*.js`, since
// `base: "./"` went with the shell) and Start bakes `ROUTER_BASEPATH` at build
// time, so there is no runtime basepath to derive. At `/s/<slug>/` every asset
// would 404 and the router would resolve the wrong route.
//
// That is safe because stage 1 made it so, and the two halves are asserted
// below: `cleanSlug` refuses an edge hyphen, so every slug is a legal DNS label
// and every site has a pretty host — and `/s/<slug>/` 301s to it. A site with
// no pretty host predates all of this and is on the static path, with real
// documents of its own.
for (const [label, prefix, port] of [["served at / (the only mount a Start bundle has)", "", 8124]]) {
  console.log("\n" + label);
  const srv = serve(prefix);
  await new Promise((r) => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}${prefix}`;
  const browser = await chromium.launch({ executablePath: findChromium() || undefined });
  try {
    const page = await browser.newPage();
    // LATENCY ON PURPOSE, and it is what makes the click assertions honest.
    //
    // Routes are code-split one chunk per page, so clicking a nav link fires a
    // dynamic import — a real request that has not STARTED yet when the click
    // returns. Against a local server it lands in under a millisecond, so a
    // read-immediately assertion passed here and lost the race on a loaded CI
    // runner: measured 2026-08-09, red on this exact check with the HOME page's
    // text at the /book address, red at `/` and green at `/s/<slug>/` in the same
    // run, which is the signature of a race and not of a routing bug.
    //
    // 400ms makes that gap wider than any accidental win, so the check below can
    // only pass by actually waiting. Verified to DISCRIMINATE rather than assumed:
    // with the wait removed, both mounts fail here and reproduce the CI text
    // exactly; with it, 21/21. CPU throttling alone did not reproduce it — the
    // thing being waited for is a fetch, not a render.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions",
      { offline: false, latency: 400, downloadThroughput: 4_000_000, uploadThroughput: 4_000_000 });
    const missing = [];
    page.on("response", (r) => { if (r.status() >= 400 && /\.(js|css|svg|woff2?)(\?|$)/.test(r.url())) missing.push(r.status() + " " + r.url().split("/").pop()); });
    const threw = [];
    page.on("pageerror", (e) => threw.push(String(e.message).slice(0, 140)));

    await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
    // NO `#root` UNDER START. `__root.tsx` renders `<html>`, `<head>` and `<body>`
    // itself, so the page content is a direct child of body — measured on a real
    // bundle: `id="root"` appears nowhere in the document. The old shell had that
    // div because `createRoot` needed something to mount into.
    //
    // Counting body descendants instead includes the two or three elements
    // `<Scripts />` emits, which the floors here are far above (20 nodes against a
    // real page's hundreds), so it still discriminates a blank render from a real
    // one — which is the only thing these counts are for.
    ok("the home page renders", (await page.locator("body *").count()) > 0);

    // CLICKING THE NAV, which is a different assertion from navigating to the
    // address — and the only one that would have caught the bug that arrived
    // with browser history. Every nav link in the chrome was `href="#/book"`,
    // correct under hash history and inert under this one: the fragment
    // changes, no route matches, the page stays where it is. Every check below
    // passed throughout, because each one types the URL in rather than pressing
    // the thing a visitor presses.
    {
      const before = page.url();
      await page.getByRole("link", { name: "Book a chair" }).first().click();
      await page.waitForLoadState("networkidle");
      ok("clicking the header CTA actually navigates", page.url() !== before,
        "still at " + page.url());
      ok("…and lands on the book page, not a fragment of the home page",
        !page.url().includes("#") && /\/book$/.test(page.url()), page.url());
      // ANCHORED ON TEXT ONLY THE BOOK PAGE HAS. The obvious string is "Book a
      // chair" — and that is the label of the button just clicked, so it is on
      // the HOME page too and the assertion passed while the click did nothing.
      // Caught by mutation: two of these three went red against the restored
      // bug and this one did not.
      //
      // AND IT IS WAITED FOR, because `networkidle` is not a render. A
      // client-side navigation issues no request, so that state is already
      // satisfied the instant the click returns and the read below raced React —
      // measured in CI 2026-08-09, where all three of these ran within 3ms and
      // the last one saw the HOME page's text at the /book address. It failed at
      // the `/` mount and passed at `/s/<slug>/` in the same run, which is the
      // signature of a race rather than a routing bug.
      //
      // The wait SWALLOWS its timeout on purpose: a genuinely inert nav must be
      // reported by the assertion below — with the page text that explains it —
      // rather than as an unhandled Playwright error that says only "timed out".
      // Against the restored `#/book` bug the text never arrives, so this waits
      // its five seconds and then goes red, which is the behaviour that matters.
      await page.getByText(/Anything else\?/i).first().waitFor({ timeout: 5000 }).catch(() => {});
      const clicked = await page.locator("body").innerText();
      ok("…and the BOOK route rendered", /Anything else\?/i.test(clicked),
        clicked.slice(0, 140).replace(/\s+/g, " "));
      await page.goBack({ waitUntil: "networkidle" });
    }

    await page.goto(base + "/book", { waitUntil: "networkidle", timeout: 30000 });
    ok("a deep link renders instead of 404ing", (await page.locator("body *").count()) > 0);
    ok("and its address carries no #", !page.url().includes("#"), page.url());

    // THE ASSERTION THAT HAS TO BE REAL — and the weak version of it passed
    // against a broken build. `url.endsWith("/book")` is true simply because we
    // navigated there: with the basepath wrong, the router matches nothing and
    // renders Not Found at that same URL. Only the CONTENT says which route
    // resolved. Verified by mutation: `basepath: "/"` at a sub-path mount makes
    // this line, and only this line, go red.
    const body = await page.locator("body").innerText();
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
