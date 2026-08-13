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
import { VIEWPORTS, probe, renderReport } from "./site-render.mjs";

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
    const p = decodeURIComponent(raw.split("?")[0]);

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
 * Look at every prerendered route at every width.
 *
 * `routes` is what `prerender()` actually wrote, so this checks the documents a
 * visitor really gets rather than a list of what should exist.
 */
export async function checkRender(distDir, routes) {
  const list = (Array.isArray(routes) ? routes : []).filter(Boolean);
  if (!list.length) return renderReport([], { ok: false, error: "no prerendered routes to look at" });

  let server = null, browser = null;
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
          if (Date.now() > until) break;
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
    return renderReport(seen);
  } catch (e) {
    // The check could not run. Reported as such rather than as a clean pass —
    // a broken harness that reads as "we looked and it was fine" is the silent
    // skip this codebase has already been bitten by three times.
    return renderReport(seen, { ok: false, error: String((e && e.message) || e) });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise((r) => server.close(r));
  }
}
