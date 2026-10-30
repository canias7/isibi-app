// OUT OF CREDITS ON A REAL PAGE (owner, 2026-10-26, variant C) and THE CONTEXT
// RING (the same day). The repo's own public/ in a real Chromium, every server
// answer supplied by the case. Shown:
//   - a request with parts paused for credits: the slim black bar on top of the
//     box ("Out of credits · N tasks paused", the box ticked, Add Credits), the
//     pill "N tasks waiting for credits";
//   - unticking posts `{ auto: false }` to the request's credits route, and a
//     reload reads the tick from the server's view, never from this browser;
//   - credits added while unticked: Continue replaces Add Credits; pressing it
//     posts `{ resume: true }`; resumed, the bar says "Credits added";
//   - Add Credits opens the existing credits flow;
//   - the context line above the box is gone; a ring sits just left of Send and
//     opens the same details on hover.
// Screenshots go to the directory named by CREDIT_SHOTS.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";
const SHOTS = process.env.CREDIT_SHOTS || "";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_crdt01";
const SLUG = "driftwood-daughters";
const K = "crrequestkeyaaaa0001";
const J = (c) => c.repeat(32);
const said = (title) => ({ title, planned: "p", doing: "d", waiting: "w", unconfirmed: "u", done: "Done " + title + ".", partial: "pa", notdone: "n" });

function view(S) {
  const paused = S.resumed ? 0 : 4;
  const parts = [{ n: 0, words: "Change the heading font", status: "done", jobs: [J("a")], charged: 2, route: "look", said: said("Heading font") }];
  for (let i = 1; i <= 4; i++) parts.push({ n: i, words: "part " + i, status: S.resumed ? "ready" : "credits", why: S.resumed ? null : "insufficient", jobs: [], charged: 0, said: said(["Members area", "Reviews", "Map", "Countdown"][i - 1]) });
  return {
    key: K, state: S.resumed ? "running" : "credits", ended: false, stop: false, at: Date.now() - 300000, updatedAt: Date.now(), parts,
    ...(paused ? { credits: { paused, auto: S.auto, ready: S.ready } } : {}),
    ...(S.resumed ? { creditsResumedAt: Date.now() } : {}),
  };
}
const siteRecord = () => ({
  id: SITE_ID, slug: SLUG, react: true, name: "Driftwood & Daughters", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }], msgs: [{ r: "u", t: "Six changes at once please." }, { r: "a", t: "I'll take the next round for Driftwood & Daughters in six pieces at once." }], updatedAt: Date.now(), createdAt: Date.now(),
});

async function openApp(S) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd.site]));
  }, { site: siteRecord() });
  const calls = [];
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Driftwood</title><h1>Driftwood &amp; Daughters</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (req.method() !== "GET") calls.push({ method: req.method(), path: p, body: req.postData() ? JSON.parse(req.postData()) : null });
      if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [view(S)] });
      if (p === "/api/site/request/" + SLUG + "/" + K + "/credits") {
        const b = JSON.parse(req.postData() || "{}");
        if (typeof b.auto === "boolean") S.auto = b.auto;
        if (b.resume === true) { if (!S.ready) return json(route, { ok: false, error: "no-credits", request: view(S) }, 409); S.resumed = true; }
        return json(route, { ok: true, request: view(S) });
      }
      if (p === "/api/site/request/" + SLUG + "/" + K) return json(route, { ok: true, request: view(S) });
      if (p.endsWith("/context")) return json(route, { ok: true, window: 500000, tokens: 61000, used: 0.122, compactAt: 0.8, model: S.model || "", parts: { fixed: 40000, summary: 0, conversation: 21000 } });
      if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/"] });
      if (p === "/api/site/" + SLUG + "/question") return json(route, { ok: true, question: null });
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 0 });
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
  await page.waitForFunction(() => !!document.getElementById("stThread"), null, { timeout: 15000 });
  return { page, ctx, browser, errors, calls };
}
const shot = async (page, name, clip) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  if (clip) { await page.screenshot({ path: path.join(SHOTS, name), clip }); return; }
  const el = await page.$(".st-rail");
  await (el || page).screenshot({ path: path.join(SHOTS, name) });
};
const railClip = async (page) => {
  const r = await page.$eval(".st-rail", (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  return { x: r.x, y: Math.max(0, r.y + r.height - 380), width: Math.min(470, r.width), height: 380 };
};

test("CREDIT PAUSE — the bar on top of the box, the pill, the stored tick (and a reload), Continue once credits are added, the resume line; the context ring left of Send", { skip: SKIP, timeout: 180000 }, async () => {
  const S = { auto: true, ready: false, resumed: false, model: "grok-4.7" };
  let app = await openApp(S);
  try {
    let { page } = app;
    await page.waitForSelector(".st-cred", { timeout: 20000 });
    assert.match(await page.textContent(".st-cred-txt"), /Out of credits · 4 tasks paused/);
    assert.match(await page.textContent(".st-cred-chk"), /Continue when topped up/);
    assert.equal(await page.$eval('.st-cred input[data-cred="auto"]', (e) => e.checked), true, "the box is not ticked by default");
    assert.equal((await page.textContent(".st-cred-btn")).trim(), "Add Credits");
    assert.equal(await page.$(".st-cred .st-x, .st-cred [aria-label='Close']"), null, "the bar has a close");
    // ON TOP OF THE BOX: its bottom meets the box's top, the same width.
    const geo = await page.evaluate(() => { const a = document.querySelector(".st-cred").getBoundingClientRect(); const b = document.querySelector(".st-comp").getBoundingClientRect(); return { gap: b.top - a.bottom, w: Math.abs(a.width - b.width), bg: getComputedStyle(document.querySelector(".st-cred")).backgroundColor }; });
    assert.ok(Math.abs(geo.gap) <= 1, "the bar is not attached to the box: " + JSON.stringify(geo));
    assert.ok(geo.w <= 1, "the bar is not the box's width: " + JSON.stringify(geo));
    assert.equal(geo.bg, "rgb(13, 27, 42)"); // the landing's ink (owner, 2026-10-30), was #111
    assert.equal((await page.textContent(".st-bg-pill")).trim(), "4 tasks waiting for credits ▾");
    // THE CONTEXT LINE IS GONE; THE RING SITS JUST LEFT OF SEND.
    assert.equal(await page.$(".st-rail > .st-ctxl"), null, "the context line above the box is back");
    const order = await page.$$eval(".st-comp-row > *", (els) => els.map((e) => e.id || e.className));
    const iRing = order.indexOf("stCtxLine"), iSend = order.indexOf("stSend");
    assert.ok(iRing >= 0 && iSend === iRing + 1, "the ring is not just left of Send: " + JSON.stringify(order));
    await shot(page, "1-paused-ticked.png", await railClip(page));
    await shot(page, "1-paused-ticked-full.png");
    // ADD CREDITS opens the existing credits flow.
    await page.click('.st-cred-btn[data-cred="add"]');
    await page.waitForSelector(".credits-overlay", { timeout: 5000 });
    await page.evaluate(() => document.querySelector(".credits-overlay").remove());
    // UNTICK: stored on the request, server-side.
    await page.click(".st-cred-chk");
    for (let i = 0; i < 40 && !app.calls.some((c) => c.path.endsWith("/credits")); i++) await page.waitForTimeout(50);
    assert.deepEqual(app.calls.filter((c) => c.path.endsWith("/credits")).map((c) => c.body), [{ auto: false }]);
    assert.equal(S.auto, false);
    await page.waitForFunction(() => { const i = document.querySelector('.st-cred input[data-cred="auto"]'); return i && !i.checked; });
    await shot(page, "2-paused-unticked.png", await railClip(page));
    // A RELOAD, IN A FRESH BROWSER: the tick comes from the server.
    await app.browser.close();
    S.ready = true; // credits were added; unticked, so nothing resumed
    app = await openApp(S);
    page = app.page;
    await page.waitForSelector(".st-cred", { timeout: 20000 });
    assert.equal(await page.$eval('.st-cred input[data-cred="auto"]', (e) => e.checked), false, "the tick did not survive a reload");
    assert.equal((await page.textContent(".st-cred-btn")).trim(), "Continue", "Continue does not replace Add Credits once credits were added");
    await shot(page, "3-topped-up-unticked-continue.png", await railClip(page));
    await page.click('.st-cred-btn[data-cred="continue"]');
    for (let i = 0; i < 40 && !app.calls.some((c) => c.body && c.body.resume === true); i++) await page.waitForTimeout(50);
    assert.deepEqual(app.calls.filter((c) => c.path.endsWith("/credits")).map((c) => c.body), [{ resume: true }]);
    await page.waitForSelector(".st-cred-ok", { timeout: 10000 });
    assert.match(await page.textContent(".st-cred-ok"), /Credits added · picking up where it stopped/);
    await shot(page, "4-resumed.png", await railClip(page));
    // THE RING'S DETAILS ON HOVER: the same as the line's.
    await page.hover("#stCtxLine");
    await page.waitForSelector(".st-ctxr-pop", { state: "visible", timeout: 5000 });
    assert.match(await page.textContent(".st-ctxr-pop"), /Context · this chat/);
    assert.match(await page.textContent(".st-ctxr-pop"), /%/);
    await shot(page, "5-context-ring-hover.png", await railClip(page));
    assert.deepEqual(app.errors, []);
  } finally { await app.browser.close(); }
});
