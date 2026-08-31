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

/** One opaque mid-grey pixel — what an upload stands in as. See the `/u/` branch. */
const ONE_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

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

// The file a route was prerendered to. IMPORTED, not redeclared: it is the
// inverse of `routeOf` and lives beside it, so the two cannot drift.
//
// IMPORTED AND RE-EXPORTED, never `export { X } from` alone — that form creates
// NO local binding, so `fileForRoute(p)` below is a ReferenceError. It took the
// real container to say so: every unit test passed and the build service died at
// the first prerender.
import { fileForRoute } from "./site-addon.mjs";
export { fileForRoute };

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
function serveDist(dir, ssrFetch) {
  return http.createServer(async (req, res) => {
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
    // AN UPLOAD IS SERVED, NOT 404'd, and it is the same argument as the `/api/`
    // stub above: those files live in R2 under `uploads/<slug>/` and there is no
    // R2 near this container, so a page referencing one is CORRECT and would be
    // reported broken. `/u/…` carries an extension, so without this it fell
    // through to the asset branch and 404'd out of the dist — a console error
    // and a broken image on every picture-led site, in a verdict that goes to
    // the customer. A false alarm this repo rates strictly worse than the miss.
    //
    // It reaches the logo too, which the container bakes as `/u/<slug>/…`, so
    // this was every site with a logo as well as every site with a photograph.
    //
    // A REAL IMAGE RATHER THAN A 204: the contrast pass added in Round 18 asks
    // whether text sits over a picture, and a body-less response leaves nothing
    // for it to see — so the scrim-over-photo hero would go back to being
    // measured against whatever is behind it. One opaque pixel, stretched by the
    // kit's own `object-cover`, is exactly the solid block a photograph will be.
    if (p.startsWith("/u/")) {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(ONE_PIXEL);
      return;
    }
    // The browser asks for this on every load whether or not the site has one;
    // a 404 here would be reported as a console error on every page.
    if (p === "/favicon.ico" && !fs.existsSync(path.join(dir, "favicon.ico"))) { res.writeHead(204); res.end(); return; }

    // An extensionless path is a ROUTE — serve the document that route was
    // prerendered to. Anything with an extension is an asset and is served as
    // itself, so a genuinely missing bundle still 404s rather than being handed
    // an HTML page and reported as some stranger error.
    const isAsset = /\.[a-z0-9]+$/i.test(p);

    // A DOCUMENT COMES FROM THE SERVER BUNDLE, NOT A FILE. Under Start there are
    // no prerendered HTML files — the document is rendered per request — so
    // without this every route 404s and the check reports a blank site.
    //
    // THIS MAKES THE CHECK STRICTLY BETTER, which is worth stating because it
    // reads like a workaround. It used to inspect a build-time SNAPSHOT; it now
    // inspects the bytes a visitor actually receives, from the same code that
    // will serve them. A snapshot that was wrong in a way the live page was not
    // could produce a finding nobody could reproduce.
    if (!isAsset && ssrFetch) {
      try {
        const out = await ssrFetch(new Request("http://127.0.0.1" + raw));
        const body = Buffer.from(await out.arrayBuffer());
        const ct = out.headers.get("content-type") || "text/html; charset=utf-8";
        res.writeHead(out.status, { "content-type": ct });
        res.end(body);
      } catch (e) {
        // 500 WITH THE REASON, never a silent 200. A render that throws is
        // exactly what this check exists to find, and swallowing it here would
        // report the page as clean.
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("ssr threw: " + String((e && e.message) || e));
      }
      return;
    }

    const rel = isAsset ? p.replace(/^\/+/, "") : fileForRoute(p);
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
 * Is Chromium's own sandbox actually confining the model's code?
 *
 * THE ROOT CHECK IS THE WHOLE ANSWER, and finding that out is the point of this
 * function existing at all. Chromium refuses to run as root with its sandbox on,
 * and **Playwright silently adds `--no-sandbox` for you when the parent process
 * is root** — so a launch that omits the flag and SUCCEEDS proves nothing.
 *
 * Measured here, against a real browser: launching with no `--no-sandbox` in the
 * arguments came back happy, reported itself sandboxed, rendered a page — and
 * the spawned process's real argv contained `--no-sandbox` all along. A first
 * draft of this shipped exactly that as a security improvement: an unsandboxed
 * browser wearing `sandboxed: true`, which is strictly worse than the honest
 * `--no-sandbox` it replaced. (And the measurement that caught it needed two
 * attempts — the first `ps` pattern matched this very node process. A harness
 * that cannot fail honestly is worse than none, one layer up.)
 *
 * So the verdict is derived from the condition that decides it rather than from
 * a launch outcome, and the flag is passed explicitly when we are root — which
 * is what Playwright would do anyway, so no behaviour changes and nothing new
 * can fail. It flips to `true` on its own the day the build service runs as a
 * non-root user, which is the real fix and is a Dockerfile change.
 */
export function chromiumSandboxed() {
  return typeof process.getuid === "function" ? process.getuid() !== 0 : false;
}

// A CEILING ON WHAT IS ASKED, because this crosses into the page once per route
// per viewport and the stylesheet is the model's. `MAX_CSS` is 60,000
// characters, which is thousands of rules; a sheet that large is not one
// somebody is waiting on a per-selector verdict for.
const MAX_SELECTORS = 300;

/**
 * Which of these selectors match at least one element on THIS page.
 *
 * RUNS IN THE PAGE, so it is the browser's own selector engine giving the
 * answer — not a parser of ours agreeing with itself. That is the entire point:
 * the question "does `header button` match anything" has exactly one authority,
 * and it is the thing that will actually render the site.
 *
 * A SELECTOR THAT THROWS IS TREATED AS A HIT, not as a miss. `querySelectorAll`
 * throws on a syntax it does not know, and an unparseable selector is a
 * different complaint from a selector that points at nothing — reporting it
 * here would put "this matches nothing on your page" in front of a customer
 * about a rule the browser could not even read. Cannot-tell must never read as
 * nothing-there, which is the rule `loadConfig` and the design tool already
 * follow two layers up.
 */
function countSelectors(list) {
  const out = [];
  for (const sel of list) {
    try { if (document.querySelectorAll(sel).length > 0) out.push(sel); }
    catch { out.push(sel); }
  }
  return out;
}

export async function launchChromium(chromium) {
  const sandboxed = chromiumSandboxed();
  const args = sandboxed ? ["--disable-dev-shm-usage"] : ["--no-sandbox", "--disable-dev-shm-usage"];
  const opts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  return { browser: await chromium.launch({ ...opts, args }), sandboxed };
}

/**
 * One self-contained HTML document → a PNG at exactly the given size. The
 * share card's rasteriser (site-card.mjs composes the strings; this module
 * drives the browser), and it lives HERE because `render-sandbox.test.mjs`
 * bans `import(` from build-server.mjs outright — the module-registry leak
 * and the model-bundle-in-our-process boundary — so the one playwright-core
 * import stays in the file that has always owned it.
 *
 * Throws on any failure; the caller decides what a failure costs (for the
 * card: the card, never the build).
 */
export async function screenshotHtml(html, { width, height }) {
  const { chromium } = await import("playwright-core");
  const { browser } = await launchChromium(chromium);
  try {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(String(html), { waitUntil: "load", timeout: 10000 });
    return await page.screenshot({ type: "png", timeout: 10000 });
  } finally { await browser.close(); }
}

/**
 * Look at every route the router has, at every width.
 *
 * `routes` is what the site's own router declares, so this checks the documents
 * a visitor really gets rather than a list of what should exist.
 *
 * `serverDown` is optional and answers `""` while the site's server is healthy
 * and a REASON once it is not. It exists because those are the two cases this
 * check must never confuse:
 *
 *   THE BUNDLE WOULD NOT LOAD → every extensionless path fell through to the
 *   static branch, `dist/client` holds no HTML at all under Start, every route
 *   404'd, `page.goto` came back not-ok, and `readPage` turned that into a
 *   `threw` finding for EVERY route at EVERY width — on a build that compiled,
 *   bundled and published perfectly. `renderReport` still answered `ok: true`,
 *   so `renderNote` was not suppressed and the customer was told their site's
 *   every page threw an error. A false alarm from the one check whose charter is
 *   that a false alarm is strictly worse than a miss, repeated on every later
 *   text fix and colour change, because the same report rides on every edit lane.
 *
 * So an unavailable server is reported as a check that could not run, and the
 * pages are not blamed for it.
 */
export async function checkRender(distDir, routes, ssrFetch, serverDown, opts = null) {
  const list = (Array.isArray(routes) ? routes : []).filter(Boolean);
  // ── DOES THE MODEL'S STYLESHEET POINT AT ANYTHING? (2026-08-31, run 96) ────
  //
  // The selectors arrive already filtered to the ones a zero-match verdict is
  // sound for — see `plainSelectors` in `site-freecss.mjs`, which is where the
  // judgement lives and where the reasoning for each exclusion is written down.
  // This function's only job is to COUNT, against the real DOM, which is the
  // one thing no amount of reading the stylesheet can do.
  //
  // UNIONED ACROSS ROUTES AND VIEWPORTS: a selector that matches on any page is
  // alive. A multi-page site whose rule hits only the menu page is not a dead
  // rule, and asking per-page would report one on every other page.
  const selectors = Array.isArray(opts && opts.selectors)
    ? opts.selectors.filter((s) => typeof s === "string" && s).slice(0, MAX_SELECTORS)
    : [];
  const hit = new Set();
  // PAGES SUCCESSFULLY PROBED, and the whole soundness of the answer rests on
  // it. If nothing loaded, every selector matches nothing and a reader with no
  // floor calls the entire stylesheet dead — the "a negative assertion must
  // prove its observer is alive" trap, in the one place where tripping it would
  // tell a customer their working edit did nothing.
  let looked = 0;
  // THE VERDICT, DERIVED ONCE, at whichever return the run reaches. Written as
  // a function rather than assembled at each of the three exits because a
  // classification repeated per call site is the thing this repo's `settle`
  // comment already warns about: a new exit tomorrow gets it by saying nothing.
  //
  // NOTHING IS REPORTED WHEN NOTHING WAS ASKED, so a build that sent no
  // stylesheet — every site before free CSS, and every cheap edit that leaves
  // the look alone — produces a byte-identical report to the one it produced
  // before this existed.
  const tally = () => (selectors.length
    ? { deadSelectors: selectors.filter((s) => !hit.has(s)), selectorsLooked: looked }
    : {});
  // THE VERDICT IS ASKED FOR, NEVER DEFAULTED. This was a local initialised to
  // `true` and overwritten only after the browser launched, so every failure
  // before that — a port that would not listen, a missing `playwright-core`, a
  // Chromium that would not start — reported a run whose sandbox state was never
  // determined as confined. That is the one direction this signal must not fail
  // in, and it is the same defect this function's own docstring describes at
  // length, reappearing in the error path rather than the happy one.
  const sandboxed = chromiumSandboxed();
  if (!list.length) return renderReport([], { ok: false, error: "no routes to look at", sandboxed });

  // WHY THERE IS NOTHING TO LOOK AT, IN ONE EXPRESSION. Either the caller has
  // told us its server is down, or there is no server AND no document on disk to
  // fall back to — which is derived from the dist rather than assuming Start, so
  // a build that really does ship HTML still gets checked.
  const unavailable = (typeof serverDown === "function" ? String(serverDown() || "") : "")
    || (!ssrFetch && !fs.existsSync(path.join(distDir, fileForRoute("/")))
      ? "the site's server did not start, so there were no pages to look at"
      : "");
  if (unavailable) return renderReport([], { ok: false, error: unavailable, sandboxed });

  let server = null, browser = null, cut = false;
  const seen = [];
  try {
    server = serveDist(distDir, ssrFetch);
    await new Promise((ok, no) => { server.once("error", no); server.listen(0, ok); });
    const port = server.address().port;

    const { chromium } = await import("playwright-core");
    browser = (await launchChromium(chromium)).browser;

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
            // COUNTED HERE, INSIDE THE TRY AND AFTER THE NAV CHECK, so a route
            // that 404'd or threw contributes neither a hit nor a `looked`.
            // `routePaths()` currently offers the `-parts/` components as if
            // they were routes and they answer 404, so this distinction is not
            // hypothetical on any site with a generated component.
            looked++;
            if (selectors.length) {
              for (const s of await page.evaluate(countSelectors, selectors)) hit.add(s);
            }
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
    // AND ASKED AGAIN AT THE END, because the server can go down PART-WAY —
    // killed for wedging on one route, or gone of its own accord — and every
    // route after that point failed to load for a reason that is ours rather
    // than the site's. `seen` is kept so a page really looked at is still
    // counted, and `ok:false` is what stops the customer being told anything
    // about a run that could not finish.
    const stopped = typeof serverDown === "function" ? String(serverDown() || "") : "";
    if (stopped) return renderReport(seen, { ok: false, error: stopped, cut, sandboxed, ...tally() });
    return renderReport(seen, { cut, sandboxed, ...tally() });
  } catch (e) {
    // The check could not run. Reported as such rather than as a clean pass —
    // a broken harness that reads as "we looked and it was fine" is the silent
    // skip this codebase has already been bitten by three times.
    return renderReport(seen, { ok: false, error: String((e && e.message) || e), cut, sandboxed, ...tally() });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise((r) => server.close(r));
  }
}
