// THE KEY BOX FOR A PART PAUSED FOR CREDITS, ON A REAL PAGE (2026-11-01,
// northline-climbing). The repo's own public/ (index.html, chat.js,
// key-card.js, styles.css) in a real Chromium; every server answer is supplied
// by the case. A request whose part asked for RESEND_API_KEY and then paused
// for credits shows the secure box under the thread, beside the paused bar,
// with a password input and no value anywhere in the page's own record.
// The screenshot goes to the directory named by KEY_SHOTS.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const SKIP = !(chromium && existsSync(EXE)) && "no browser here (playwright-core and Chromium are not installed)";
const SHOTS = process.env.KEY_SHOTS || "";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1730000000000_nlclmb";
const SLUG = "northline-climbing";
const K = "nlrequestkeyaaaa0001";
const J = (c) => c.repeat(32);
const said = (title) => ({ title, planned: "p", doing: "d", waiting: "w", unconfirmed: "u", done: "Done " + title + ".", partial: "pa", notdone: "n" });
const NEED = { name: "RESEND_API_KEY", service: "Resend", why: "Sends you an email for each new booking" };

function view() {
  return {
    key: K, state: "credits", ended: false, stop: false, at: Date.now() - 240000, updatedAt: Date.now(),
    credits: { paused: 1, auto: true, ready: false },
    parts: [
      { n: 0, words: "Make the header dark green", status: "done", jobs: [J("a")], charged: 2, said: said("Dark header") },
      { n: 1, words: "Add a members page", status: "done", jobs: [J("b")], charged: 4, said: said("Members page") },
      { n: 2, words: "Email me when someone books", status: "credits", why: "insufficient", jobs: [], charged: 0, needKeys: [NEED], said: said("Booking emails") },
    ],
  };
}
const siteRecord = () => ({
  id: SITE_ID, slug: SLUG, react: true, name: "Northline Climbing", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }],
  msgs: [{ r: "u", t: "Make the header dark green, add a members page, and email me when someone books." }, { r: "a", t: "The three changes will move forward side by side." }],
  updatedAt: Date.now(), createdAt: Date.now(),
});

test("A PART PAUSED FOR CREDITS AFTER ASKING FOR A KEY: the secure key box is shown, with its password input, and nothing of a value is kept", { skip: SKIP, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
    await ctx.addInitScript((sd) => {
      try { localStorage.length; } catch (e) { return; }
      if (localStorage.getItem("zephyr_session_v1")) return;
      localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
      localStorage.setItem("zephyr_owner_v1", "u-1");
      localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd.site]));
    }, { site: siteRecord() });
    const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Northline</title><h1>Northline Climbing</h1>" });
      if (url.origin !== ORIGIN) return json(route, {});
      const p = url.pathname;
      if (p.startsWith("/api/")) {
        if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [view()] });
        if (p === "/api/site/request/" + SLUG + "/" + K) return json(route, { ok: true, request: view() });
        if (p === "/api/site/" + SLUG + "/secrets") return json(route, { ok: true, secrets: [] });
        if (p.endsWith("/context")) return json(route, { ok: true, window: 500000, tokens: 61000, used: 0.122, compactAt: 0.8, model: "", parts: { fixed: 40000, summary: 0, conversation: 21000 } });
        if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/"] });
        if (p === "/api/site/" + SLUG + "/question") return json(route, { ok: true, question: null });
        if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
        if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 0 });
        return json(route, { ok: true });
      }
      const file = p === "/" || p.startsWith("/projects") || /^\/home\/?$/.test(p) ? "/index.html" : p;
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
    await page.waitForSelector(".st-keycard [data-kc-row='RESEND_API_KEY']", { timeout: 20000 });
    await page.waitForSelector(".st-cred", { timeout: 20000 });
    const input = await page.$(".st-keycard [data-kc-row='RESEND_API_KEY'] input");
    assert.equal(await input.getAttribute("type"), "password");
    assert.equal(await input.isVisible(), true, "the key box is not shown");
    assert.match(await page.textContent(".st-keycard"), /Keys your site needs[\s\S]*RESEND_API_KEY[\s\S]*Resend/);
    // NOTHING TYPED IS KEPT in the page's own record.
    await input.fill("re_sentinel_value_9f8e7d");
    const stored = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
    assert.ok(!stored.includes("re_sentinel_value_9f8e7d"), "a key value reached localStorage");
    await input.fill("");
    assert.deepEqual(errors, []);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.evaluate(() => { const t = document.getElementById("stThread"); if (t) t.scrollTop = t.scrollHeight; });
      const rail = await page.$(".st-rail");
      await (rail || page).screenshot({ path: path.join(SHOTS, "key-box-paused.png") });
    }
  } finally { await browser.close(); }
});
