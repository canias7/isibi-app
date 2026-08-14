// The container half of 1.t — open the built pages in a real browser and look.
//
// This file OBSERVES and `site-render.mjs` JUDGES. Everything here is I/O: a
// static server, a browser, a loop. Every threshold and every decision about
// what a number means lives in the module, which has no browser and is tested
// with literal objects — so the part where a mistake produces a false alarm on a
// customer's perfectly good site is the part that can be driven without any of
// this.
//
// IT CANNOT FAIL A BUILD, and that is structural rather than a promise: the one
// exported function has a `try` around everything and returns a report either
// way. A build whose pages compiled and whose database is live must never be
// lost because a browser would not start.
//
// The browser is the DISTRO Chromium, driven by `playwright-core` — the same
// arrangement `builder-game/smoke.mjs` has been using, rather than Playwright's
// own download. It is the smaller image and it is the pattern already proven
// here.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { VIEWPORTS, MAX_OPENS, OVERLAY_TRIGGERS, probe, probeOverlay, renderReport } from "./site-render.mjs";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json",
};

// The whole check, worst case. A build is 20-40s and this normally costs ~6, but
// one page that never settles must not be able to double the wait a customer is
// sitting through — so the loop stops and reports what it has rather than
// running to completion.
const TOTAL_MS = 25000;
const NAV_MS = 6000;
// Let lazy images below the fold start. `loading="lazy"` means an image that has
// not begun loading reports `complete === false` and is correctly not called
// broken — but then a genuinely broken one below the fold is never seen either.
// Scrolling to the bottom and back is what makes the check reach the whole page.
const SETTLE_MS = 250;

/** The file a route was prerendered to — the same name `prerender()` writes. */
export function fileForRoute(route) {
  const r = String(route || "/");
  return r === "/" ? "index.html" : r.replace(/^\//, "") + ".html";
}

/**
 * The dist, served the way the Worker serves a published site.
 *
 * A ROUTE PATH MAPS TO ITS PRERENDERED FILE, and getting this wrong is not a
 * detail. Loading `/index.html` directly puts that string in the address bar,
 * the router matches no route against it, and every page renders NOT FOUND —
 * measured, and it came back as `blank: only 9 characters`, which is the exact
 * length of "Not found". A harness that reports every correct page as broken is
 * worse than no harness.
 *
 * THE DATA API IS STUBBED EMPTY, and that is the decision that makes this check
 * honest at all. A generated page calls `/api/db/<slug>/data/<table>` on load
 * and there is no database anywhere near this container — so unstubbed, EVERY
 * site with a list would log a failed request and render its error state, and
 * the check would report a fault on every build it ever ran. An empty array is
 * also the truthful stand-in: it is exactly what a `collect` table returns on a
 * fresh site, and it exercises the empty state the generator is required to
 * write for every list.
 *
 * Auth answers 401, because a visitor arriving at a published site IS signed
 * out. Anything else would render the member view to a stranger and report on a
 * page no visitor sees.
 */
function serveDist(dir) {
  return http.createServer((req, res) => {
    const raw = String(req.url || "/");
    // `decodeURIComponent` THROWS ON A MALFORMED PERCENT-SEQUENCE, and an
    // uncaught throw in a Node request handler does not 500 — it kills the
    // process. That is the whole build service, mid-build, for every customer
    // queued behind it, and Cloudflare reports the restart as "the container is
    // not running": the two-messages-one-cause misdiagnosis the Dockerfile warns
    // reads as flaky infrastructure. The input is a model-written href or `src`
    // — `/services/50%-off` is enough, and the WHATWG URL parser hands the `%`
    // through untouched — so it is deterministic for that site: every rebuild
    // kills the container again and the site can never be built.
    //
    // The raw path is the right fallback: a path we cannot decode is served as
    // written, which 404s honestly instead of taking everything down.
    const bare = raw.split("?")[0];
    let p;
    try { p = decodeURIComponent(bare); } catch { p = bare; }

    if (p.startsWith("/api/")) {
      const body = /\/auth\//.test(p) ? '{"error":"signed out"}' : "[]";
      res.writeHead(/\/auth\//.test(p) ? 401 : 200, { "content-type": "application/json" });
      res.end(body);
      return;
    }
    // The browser asks for this on every load whether or not the site has one;
    // a 404 here would be reported as a console error on every page.
    if (p === "/favicon.ico" && !fs.existsSync(path.join(dir, "favicon.ico"))) { res.writeHead(204); res.end(); return; }

    // An extensionless path is a ROUTE — serve the document that route was
    // prerendered to. Anything with an extension is an asset and is served as
    // itself, so a genuinely missing bundle still 404s rather than being handed
    // an HTML page and reported as some stranger error.
    const rel = /\.[a-z0-9]+$/i.test(p) ? p.replace(/^\/+/, "") : fileForRoute(p);
    const fp = path.join(dir, rel);
    if (!fp.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
      res.end(d);
    });
  });
}

/**
 * Open the overlays this page has, and measure each one.
 *
 * NEVER THROWS AND NEVER FAILS THE PAGE. A trigger that will not open, a click
 * that misses, a panel that never appears — all of them return nothing rather
 * than a finding, because the alternative is reporting a fault on every page
 * with a control this harness happens not to be able to drive.
 *
 * `force` is deliberate: a trigger under a sticky header is covered at some
 * scroll positions, and Playwright's actionability check would refuse the click
 * and turn an ordinary page into a timeout.
 */
async function openOverlays(page) {
  const out = [];
  let handles = [];
  try { handles = await page.$$(OVERLAY_TRIGGERS.join(", ")); } catch { return out; }
  for (const h of handles.slice(0, MAX_OPENS)) {
    try {
      await h.click({ timeout: 1500, force: true });
      await page.waitForTimeout(180);          // the open animation
      out.push(await page.evaluate(probeOverlay));
      // Escape, so the next trigger is not behind the panel just opened. If it
      // does not close, the next measurement simply re-reads the same panel and
      // `readPage` dedupes it — harmless either way.
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(120);
    } catch { /* a control we could not drive is not a finding */ }
  }
  return out;
}

/**
 * Look at every prerendered route at every width.
 *
 * `routes` is what `prerender()` actually wrote, so this checks the documents a
 * visitor really gets rather than a list of what should exist.
 */
export async function checkRender(distDir, routes) {
  const list = (Array.isArray(routes) ? routes : []).filter(Boolean);
  if (!list.length) return renderReport([], { ok: false, error: "no prerendered routes to look at" });

  let server = null, browser = null, cut = false;
  const seen = [];
  try {
    server = serveDist(distDir);
    await new Promise((ok, no) => { server.once("error", no); server.listen(0, ok); });
    const port = server.address().port;

    const { chromium } = await import("playwright-core");
    const opts = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
    if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
    browser = await chromium.launch(opts);

    const until = Date.now() + TOTAL_MS;
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      try {
        for (const route of list) {
          // OUT OF TIME IS RECORDED, NOT JUST OBEYED. Without `cut`, a run that
          // stopped at the budget produced findings from the pages it reached
          // and a report byte-identical to one that looked at everything and
          // found nothing — "we checked and it was fine" said about pages
          // nobody opened. Live renderMs sits at ~30s against a 25s loop
          // budget, so real multi-page sites reach this: it is the ordinary
          // path, not the edge. Phone runs first, so what truncation costs is
          // desktop coverage first, and the report says so.
          if (Date.now() > until) { cut = true; break; }
          const page = await ctx.newPage();
          const pageErrors = [], consoleErrors = [];
          page.on("pageerror", (e) => pageErrors.push(String((e && e.message) || e).slice(0, 200)));
          page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(String(m.text()).slice(0, 200)); });
          const obs = { route, viewport: vp.name };
          try {
            // THE ROUTE, not the file. The address bar is what the router
            // matches on, and `/index.html` matches nothing.
            const url = `http://127.0.0.1:${port}${route}`;
            const r = await page.goto(url, { waitUntil: "load", timeout: NAV_MS });
            if (!r || !r.ok()) throw new Error("the page did not load (" + (r ? r.status() : "no response") + ")");
            // Bottom and back, so a lazy image below the fold has started.
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(SETTLE_MS);
            await page.evaluate(() => window.scrollTo(0, 0));
            Object.assign(obs, await page.evaluate(probe));
            // AND THEN OPEN THINGS, which is the only way to see a modal at all.
            // Same page, same browser — the static pass has already paid for the
            // load, so this is a few hundred milliseconds rather than a second
            // visit. PHONE ONLY: a hamburger sheet is the case, it is where the
            // bug was found, and doing it twice doubles the cost for a panel
            // whose colours do not change with the width.
            if (vp.name === "phone") obs.overlays = await openOverlays(page);
          } catch (e) {
            obs.error = String((e && e.message) || e).slice(0, 200);
          }
          obs.pageErrors = pageErrors;
          obs.consoleErrors = consoleErrors;
          seen.push(obs);
          await page.close().catch(() => {});
        }
      } finally { await ctx.close().catch(() => {}); }
    }
    return renderReport(seen, { cut });
  } catch (e) {
    // The check could not run. Reported as such rather than as a clean pass —
    // a broken harness that reads as "we looked and it was fine" is the silent
    // skip this codebase has already been bitten by three times.
    return renderReport(seen, { ok: false, error: String((e && e.message) || e), cut });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise((r) => server.close(r));
  }
}
