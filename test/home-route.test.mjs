// THE SIGNED-IN HOME HAS ITS OWN ADDRESS (2026-11-01, owner: "Yes do it with
// /home"). Signed in, `/` and the bare `/projects` become `/home` (the sites
// screen, nothing open), the logo goes to `/home` instead of the landing in a
// signed-in state, and signed out `/` is still the landing. The Worker serves
// the app shell for `/home`. Driven: the real Worker, and the repo's own
// public/ in a real Chromium with auth and the network stubbed.
// Screenshots go to the directory named by HOME_SHOTS.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";
const SHOTS = process.env.HOME_SHOTS || "";
const W = await loadWorkerModule();

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_home01";
const SLUG = "tidewater-books";
const UID = "u-home-1";
const site = {
  id: SITE_ID, slug: SLUG, react: true, name: "Tidewater Books", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: 1727000000000, createdAt: 1727000000000,
};

test("HR1 the Worker serves the app shell for /home (and /home/), not for /homeX", async () => {
  const asked = [];
  const env = { ASSETS: { fetch: async (u) => { asked.push(new URL(u.url || u).pathname); return new Response("shell", { status: 200 }); } } };
  const go = (p) => W.default.fetch(new Request("https://gofarther.dev" + p), env, { waitUntil() {}, passThroughOnException() {} });
  for (const p of ["/home", "/home/"]) {
    asked.length = 0;
    const r = await go(p);
    assert.equal(r.status, 200, p);
    assert.deepEqual(asked, ["/"], p + " was not served the app shell");
  }
  asked.length = 0;
  await go("/homeX");
  assert.deepEqual(asked, ["/homeX"], "/homeX must fall through to the asset handler");
});

async function open(browser, startPath, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (!sd.signedIn || localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: sd.uid, email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", sd.uid);
    localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd.site]));
  }, { uid: UID, site, signedIn });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><h1>Tidewater</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.includes("/auth/v1/user")) return json(route, { id: UID, email: "owner@example.com" });
    if (p.startsWith("/api/")) {
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 150 });
      return json(route, { ok: true });
    }
    const file = p === "/" || p.startsWith("/projects") || /^\/home(\/|$)/.test(p) ? "/index.html" : p;
    const fp = path.join(PUB, file);
    if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
    const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(ORIGIN + startPath, { waitUntil: "load" });
  return { page, ctx, errors };
}
const until = async (fn, ms = 15000, what = "condition") => {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error("timed out waiting for " + what); await new Promise((r) => setTimeout(r, 100)); }
};
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none"; }, sel);
const pathOf = (page) => page.evaluate(() => location.pathname);
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); };

test("HR2 signed in on / → /home/projects, the app shell shown and the landing hidden; bare /projects and /home → /home/projects", { skip: SKIP, timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const A = await open(browser, "/", true);
    await until(async () => (await pathOf(A.page)) === "/home/projects", 15000, "/home/projects");
    assert.equal(await shown(A.page, "#marketing"), false, "the landing is shown signed in");
    assert.equal(await shown(A.page, ".shell"), true, "the app shell is hidden");
    await until(() => A.page.evaluate(() => document.getElementById("viewSites")?.classList.contains("active")), 10000, "the sites view");
    await A.page.waitForTimeout(800);
    await shot(A.page, "home-route-1.png");
    console.log("# HR2 URL " + A.page.url());
    assert.deepEqual(A.errors, []);
    await A.ctx.close();
    // 2026-11-01: every old address forwards to the Sites agent's, adding no entry.
    for (const [from, to] of [["/projects", "/home/projects"], ["/home", "/home/projects"], ["/home/accounting", "/home/projects"], ["/projects/" + SITE_ID, "/home/projects/" + SITE_ID]]) {
      const B = await open(browser, from, true);
      await until(async () => (await pathOf(B.page)) === to, 15000, from + " → " + to);
      // A new page holds about:blank and the address it opened: 2. A forward that pushed would make it 3.
      assert.equal(await B.page.evaluate(() => history.length), 2, from + " forwarded with a new history entry");
      await B.ctx.close();
    }
  } finally { await browser.close(); }
});

test("HR3 signed in, the logo goes to /home/projects (push), never the landing; Back returns to the project", { skip: SKIP, timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const A = await open(browser, "/home/projects/" + SITE_ID, true);
    await until(async () => (await pathOf(A.page)) === "/home/projects/" + SITE_ID, 15000, "the project");
    await A.page.waitForTimeout(500);
    await A.page.locator('[data-act="landing"]:visible').first().click();
    await until(async () => (await pathOf(A.page)) === "/home/projects", 5000, "the logo to reach /home/projects");
    assert.equal(await shown(A.page, "#marketing"), false, "the logo showed the landing while signed in");
    assert.equal(await shown(A.page, ".shell"), true, "the app shell is hidden after the logo");
    await A.page.waitForTimeout(600);
    await shot(A.page, "home-route-2.png");
    console.log("# HR3 URL " + A.page.url());
    await A.page.goBack();
    await until(async () => (await pathOf(A.page)) === "/home/projects/" + SITE_ID, 5000, "Back to the project");
    assert.deepEqual(A.errors, []);
    await A.ctx.close();
  } finally { await browser.close(); }
});

test("HR4 signed out, / is the landing and /home falls back to it at /", { skip: SKIP, timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    for (const start of ["/", "/home"]) {
      const A = await open(browser, start, false);
      await until(() => shown(A.page, "#marketing"), 10000, "the landing");
      assert.equal(await pathOf(A.page), "/", start + " signed out did not land on /");
      await A.page.evaluate(() => goLanding());
      assert.equal(await shown(A.page, "#marketing"), true);
      assert.equal(await pathOf(A.page), "/");
      await A.ctx.close();
    }
  } finally { await browser.close(); }
});
