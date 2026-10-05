// THE PREVIEW FRAME'S ADDRESS, READ OFF A REAL PAGE (2026-10-05).
//
// The owner: *"test the rendered iframe URL, not merely previewV increasing."*
// The repo's own public/ — index.html, chat.js and the rest — in a real
// Chromium, every server answer supplied; the address is read from the frame
// the workspace drew (`#stFrame`), as the panel shows it. Two cases, both on a
// site record with no `previewV` (a fresh browser's, or one adopted from the
// list): another browser's addition finishing while the page watches, and the
// owner's reproduction — the page's first read of the request failing while
// the job finishes, the next read finding it done.
//
// IT NEEDS A BROWSER, and runs where one is installed: `playwright-core` at the
// root (`npm i --no-save`, the template's version) and Chromium. Unit CI has
// neither, so there it is skipped; the same refresh path runs on CI through the
// render's own frame step in `test/request-reconcile.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_recon1";
const SLUG = "fold-lane-bakery";
const KEY = "otherbrowserrequest001";
const JOB = "a1" + "0".repeat(30);
const WORDS = "Add a gallery page where people can book a table";
const ANSWER = {
  ok: true, kinds: ["page", "table"], added: ["src/routes/gallery.tsx"], tables: ["bookings"], cost: 9,
  reply: "✅ Your Gallery page is up, and people can book a table from it.", replySource: "model",
};

/** One page load of the app, the site open; `failFirstRead` fails the page's first read of the request. */
async function run({ failFirstRead = false } = {}) {
  let finished = false;
  let requestReads = 0;
  const frameLoads = [];
  const view = () => ({
    key: KEY, state: finished ? "done" : "running", ended: finished, stop: false, at: Date.now() - 120000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [{ n: 0, words: WORDS, status: finished ? "done" : "started", ids: finished ? [JOB] : [], jobs: finished ? [JOB] : [], charged: 0, route: "addon" }],
  });
  const site = {
    id: SITE_ID, slug: SLUG, react: true, name: "Fold Lane Bakery", url: "https://" + SLUG + ".gofarther.app/",
    pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now(),
  };
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 } });
    await ctx.addInitScript(({ site: s }) => {
      try { localStorage.length; } catch (e) { return; }
      localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
      localStorage.setItem("zephyr_owner_v1", "u-1");
      if (!localStorage.getItem("zephyr_sites_v1")) localStorage.setItem("zephyr_sites_v1", JSON.stringify([s]));
    }, { site });
    const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    await ctx.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === SLUG + ".gofarther.app") {
        frameLoads.push(url.pathname + url.search);
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Fold Lane Bakery</title><h1>Fold Lane Bakery</h1>" });
      }
      if (url.origin !== ORIGIN) return json(route, {});
      const p = url.pathname;
      if (p.startsWith("/api/")) {
        if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [view()] });
        if (p === "/api/site/request/" + SLUG + "/" + KEY) {
          requestReads++;
          if (failFirstRead && requestReads === 1) return json(route, { error: "unavailable" }, 503);
          return json(route, { ok: true, request: view() });
        }
        if (p === "/api/site/edit/" + JOB) return finished ? json(route, ANSWER, 200, { "x-gf-edit": "final" }) : json(route, { ok: true, status: "building" });
        if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: finished ? ["/", "/gallery"] : ["/"] });
        if (p === "/api/site/" + SLUG + "/question") return json(route, { ok: true, question: null });
        if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
        if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
        return json(route, { ok: true });
      }
      const file = p === "/" || p.startsWith("/projects") ? "/index.html" : p;
      const fp = path.join(PUB, file);
      if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
      const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
    const src = () => page.evaluate(() => { const f = document.getElementById("stFrame"); return f ? f.getAttribute("src") : null; });
    await page.waitForFunction(() => !!document.getElementById("stFrame"), null, { timeout: 15000 });
    // THE FIRST READ HAS HAPPENED (and, here, failed) BEFORE THE JOB FINISHES.
    for (const until = Date.now() + 15000; Date.now() < until && requestReads < 1;) await page.waitForTimeout(100);
    const before = await src();
    finished = true;
    await page.waitForFunction((was) => { const f = document.getElementById("stFrame"); return !!f && f.getAttribute("src") !== was; }, before, { timeout: 30000 });
    // THE REQUEST SETTLES: its reply on the thread, the record saved.
    await page.waitForFunction(() => {
      const all = JSON.parse(localStorage.getItem("zephyr_sites_v1") || "[]");
      return !!(all[0] && all[0].requests && Object.values(all[0].requests).some((r) => r && r.closed));
    }, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const after = await src();
    const kept = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("zephyr_sites_v1") || "[]")[0];
      return { pages: (s.pages || []).map((p) => p.path), tables: s.tables || [], undo: s.undoRows || null, said: (s.msgs || []).filter((m) => m.r === "a" && m.job).length };
    });
    return { before, after, kept, requestReads, frameLoads, errors };
  } finally {
    await browser.close();
  }
}

test("BROWSER 1 — a fresh browser watching another browser's addition finish: the frame the workspace drew asks for a new address", { skip: SKIP, timeout: 90000 }, async () => {
  const r = await run();
  assert.deepEqual(r.errors, []);
  assert.equal(r.before, "https://" + SLUG + ".gofarther.app/?v=0");
  assert.equal(r.after, "https://" + SLUG + ".gofarther.app/?v=1", "the frame kept the address it had");
  assert.ok(r.frameLoads.includes("/?v=1"), "the new address was never fetched");
  assert.deepEqual(r.kept, { pages: ["/", "/gallery"], tables: ["bookings"], undo: null, said: 1 });
});

test("BROWSER 2 — the owner's reproduction: the first read of the request fails, the job finishes, the next read finds it done — the frame asks for a new address, the tables and pages follow", { skip: SKIP, timeout: 90000 }, async () => {
  const r = await run({ failFirstRead: true });
  assert.deepEqual(r.errors, []);
  assert.ok(r.requestReads >= 2, "the failed read was never followed by another");
  assert.equal(r.before, "https://" + SLUG + ".gofarther.app/?v=0");
  assert.equal(r.after, "https://" + SLUG + ".gofarther.app/?v=1", "the late first read took the job for something the loaded site showed");
  assert.deepEqual(r.kept, { pages: ["/", "/gallery"], tables: ["bookings"], undo: null, said: 1 });
});
