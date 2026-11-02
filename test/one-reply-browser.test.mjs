// ONE REPLY PER MESSAGE, ON A REAL PAGE (2026-11-01). The repo's own public/
// (index.html, chat.js, styles.css) in a real Chromium; every server answer is
// supplied by the case. A message split in two: part 0's own job reply says
// the header link "was not done", while part 1 linked it. The page shows the
// task line (progress words only), then the request's ONE reply, once, then
// the key box; neither part's own reply is shown as a conclusion.
// The screenshot goes to the path named by ONE_REPLY_SHOT.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const SKIP = !(chromium && existsSync(EXE)) && "no browser here (playwright-core and Chromium are not installed)";
const SHOT = process.env.ONE_REPLY_SHOT || "";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1730000000000_frtwrk";
const SLUG = "fretwork-1";
const K = "rqonereplybrowser01";
const J = (c) => c.repeat(32);
const said = (title) => ({ title, planned: "p", doing: "d", waiting: "w", unconfirmed: "u", done: "Done " + title + ".", partial: "pa", notdone: "Not done: " + title });
const NEED = { name: "RESEND_API_KEY", service: "Resend", why: "Sends you an email for each new booking" };
const REPLY = "Your new Events page is live, and it is linked in the site header. To send booking emails, paste your Resend key in the box below. This used 6 credits.";
const MESSAGE = "Add an events page, link it in the header, and email me bookings";

function view() {
  return {
    key: K, state: "done", ended: true, stop: false, at: Date.now() - 240000, updatedAt: Date.now(), one: true,
    reply: { for: "end:2:0", text: REPLY, source: "model" },
    parts: [
      { n: 0, words: "Add an events page", status: "done", jobs: [J("a")], ids: [J("a")], charged: 3, said: said("Events page"), work: { changed: ["src/routes/events.tsx"], added: ["src/routes/events.tsx"] } },
      { n: 1, words: "link it in the header, and email me bookings", status: "done", jobs: [J("b")], ids: [J("b")], charged: 3, said: said("Header link"), needKeys: [NEED], work: { changed: ["src/components/site-header.tsx"] } },
    ],
  };
}
const JOB_BODY = {
  [J("a")]: { ok: true, layer: "agent", cost: 3, msg: "Added the events page. Linking it in the header was not done.", reply: "I added the events page. Linking it in the header was not done.", replySource: "model" },
  [J("b")]: { ok: true, layer: "agent", cost: 3, msg: "Linked it in the header.", reply: "I linked the events page in the header.", replySource: "model" },
};
const siteRecord = () => ({
  id: SITE_ID, slug: SLUG, react: true, name: "Fretwork", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }],
  msgs: [{ r: "u", t: MESSAGE }],
  updatedAt: Date.now(), createdAt: Date.now(),
});

test("ONE REPLY: the task line, then the message's one reply once, then the key box; no part's reply as a conclusion", { skip: SKIP, timeout: 120000 }, async () => {
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
    const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    let polls = 0;
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Fretwork</title><h1>Fretwork</h1>" });
      if (url.origin !== ORIGIN) return json(route, {});
      const p = url.pathname;
      if (p.startsWith("/api/")) {
        if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [view()], needKeys: [NEED] });
        if (p === "/api/site/request/" + SLUG + "/" + K) { polls++; return json(route, { ok: true, request: view(), needKeys: [NEED] }); }
        const jm = /^\/api\/site\/edit\/([0-9a-f]{32})$/.exec(p);
        if (jm && JOB_BODY[jm[1]]) return json(route, JOB_BODY[jm[1]], 200, { "x-gf-edit": "final" });
        if (p === "/api/site/" + SLUG + "/secrets") return json(route, { ok: true, secrets: [] });
        if (p.endsWith("/context")) return json(route, { ok: true, window: 500000, tokens: 61000, used: 0.122, compactAt: 0.8, model: "", parts: { fixed: 40000, summary: 0, conversation: 21000 } });
        if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/", "/events"] });
        if (p === "/api/site/" + SLUG + "/question") return json(route, { ok: true, question: null });
        if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
        if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 40 });
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
    await page.waitForFunction((t) => (document.getElementById("stThread") || {}).textContent.includes(t), REPLY.slice(0, 40), { timeout: 20000 });
    await page.waitForSelector(".st-keycard [data-kc-row='RESEND_API_KEY']", { timeout: 20000 });
    await page.waitForTimeout(1500);
    const thread = await page.textContent("#stThread");
    // ONCE, after however many readings.
    assert.equal(thread.split(REPLY.slice(0, 40)).length - 1, 1, "the one reply is not shown exactly once");
    // NO PART'S OWN REPLY AS A CONCLUSION: neither part 0's wrong "not done" nor part 1's own.
    assert.ok(!/was not done/i.test(thread), "a part's own 'not done' was shown: " + thread);
    assert.ok(!thread.includes("I linked the events page in the header."), "a part's own reply was shown");
    assert.ok(!/didn.t work|Not done/i.test(thread), "a conclusion on the task line");
    // THE KEY BOX COMES AFTER THE REPLY.
    const order = await page.evaluate((t) => {
      const th = document.getElementById("stThread");
      const kids = [...th.children];
      const r = kids.findIndex((el) => el.textContent.includes(t));
      const k = kids.findIndex((el) => el.matches(".st-keycard"));
      return { r, k };
    }, REPLY.slice(0, 40));
    assert.ok(order.r >= 0 && order.k > order.r, JSON.stringify(order));
    assert.ok(polls >= 1);
    assert.deepEqual(errors, []);
    if (SHOT) {
      mkdirSync(path.dirname(SHOT), { recursive: true });
      await page.evaluate(() => { const t = document.getElementById("stThread"); if (t) t.scrollTop = t.scrollHeight; });
      const rail = await page.$(".st-rail");
      await (rail || page).screenshot({ path: SHOT });
    }
  } finally { await browser.close(); }
});
