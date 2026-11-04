// STOP AND THE QUEUE, FIVE FIXES (owner, 2026-11-03), ON A REAL PAGE. Built on
// msg-queue-browser's page. SQ1 ✕ that fails brings the chip back; SQ2 a
// resumed message waiting its turn has its own ✕; SQ3 Stop while the message
// is still on its way stops its request on the server; SQ4 send while busy
// says so and keeps the words.
//
// (was) THE MESSAGE QUEUE ON A REAL PAGE (2026-11-02, the owner's look, option 1):
// "add a gallery" working on the thread; "hey" and a third message sent after
// it wait in line, NOT on the thread, as small chips inside the typing box
// ("⏱ <words> ✕"), oldest first. ✕ cancels one on the server (the request's
// stop). When a queued message starts, its chip goes and it appears on the
// thread as a normal bubble with its working line.
//
// The repo's own public/ in a real Chromium; every server answer supplied.
// The screenshot goes to MQ_SHOT when set. Needs playwright-core and Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const SKIP = !(chromium && existsSync(EXE)) && "no browser here";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_mqueue1";
const SLUG = "copper-kettle-pottery";
const KA = "mqrequestkeyaaaa0001";
const KB = "mqrequestkeybbbb0002";
const KC = "mqrequestkeycccc0003";
const LONG = "Change the button colour to a warm terracotta on every page";
const T0 = Date.now() - 60000;

const one = (key, at, words, status, extra = {}) => ({ key, state: "running", ended: false, stop: false, one: true, at, updatedAt: Date.now(), ...extra, parts: [{ n: 0, words, status, jobs: [], progress: [] }] });
const viewA = () => one(KA, T0, "add a gallery", "started");
const viewB = (S) => one(KB, T0 + 10000, "hey", S.started ? "started" : "ready", S.started ? {} : { queued: true });
const viewC = (S) => (S.cancelled ? one(KC, T0 + 20000, LONG, "cancelled", { ended: true, stop: true, state: "stopped", dropped: true }) : one(KC, T0 + 20000, LONG, "ready", { queued: true }));


async function openPage({ deleteFails = false, resumed = false, routeHangs = false } = {}) {
  const S = { cancelled: false };
  const calls = [];
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 }, reducedMotion: "reduce" });
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd.site]));
  }, { site: {
    id: SITE_ID, slug: SLUG, react: true, name: "Copper Kettle Pottery", url: "https://" + SLUG + ".gofarther.app/",
    pages: [{ path: "/", name: "Home" }], updatedAt: Date.now(), createdAt: Date.now(),
    msgs: [{ r: "u", t: "add a gallery", req: KA, at: T0 }, { r: "a", t: "", request: KA }, { r: "u", t: LONG, req: KC, at: T0 + 20000 }, { r: "a", t: "", request: KC }],
  } });
  const vc = () => (S.cancelled ? one(KC, T0 + 20000, LONG, "cancelled", { ended: true, stop: true, state: "stopped", dropped: true })
    : one(KC, T0 + 20000, LONG, "ready", { queued: true, ...(resumed ? { resumed: true } : {}) }));
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Copper Kettle</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (req.method() !== "GET" && (p.startsWith("/api/site/request/") || p === "/api/site/route")) calls.push([req.method(), p, req.postData() || ""]);
      if (p === "/api/site/route") { if (routeHangs) return; return json(route, { ok: true }); }
      if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [one(KA, T0, "add a gallery", "started"), ...(S.cancelled ? [] : [vc()])] });
      if (p === "/api/site/request/" + SLUG + "/" + KA) return json(route, { ok: true, request: one(KA, T0, "add a gallery", "started") });
      if (p === "/api/site/request/" + SLUG + "/" + KC) {
        if (req.method() === "DELETE") { if (deleteFails) return json(route, { ok: false }, 503); S.cancelled = true; }
        return json(route, { ok: true, request: vc() });
      }
      if (p.startsWith("/api/site/request/" + SLUG + "/")) return json(route, { ok: false }, 404);
      if (p === "/api/site/" + SLUG + "/question") return json(route, { ok: true, question: null });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
      return json(route, { ok: true });
    }
    const file = p === "/" || p.startsWith("/projects") ? "/index.html" : p;
    const fp = path.join(PUB, file);
    if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
    const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : "application/octet-stream";
    return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
  await page.waitForSelector("#stThread");
  return { page, calls, errors, S, close: () => browser.close() };
}

test("SQ1 ✕ on a waiting message whose cancel fails: the chip comes back", { skip: SKIP, timeout: 90000 }, async () => {
  const P = await openPage({ deleteFails: true });
  try {
    await P.page.waitForFunction(() => document.querySelectorAll("#stQueue .st-qchip").length === 1, null, { timeout: 20000 });
    await P.page.click('#stQueue [data-queue-cancel="' + KC + '"]');
    for (let i = 0; i < 60 && !P.calls.some((c) => c[0] === "DELETE"); i++) await P.page.waitForTimeout(50);
    assert.ok(P.calls.some((c) => c[0] === "DELETE" && c[1].endsWith(KC)), "no cancel was sent");
    await P.page.waitForFunction(() => document.querySelectorAll("#stQueue .st-qchip").length === 1, null, { timeout: 10000 });
    assert.deepEqual(P.errors, []);
  } finally { await P.close(); }
});

test("SQ2 a message waiting its turn again (resumed) has its own ✕, which cancels it", { skip: SKIP, timeout: 90000 }, async () => {
  const P = await openPage({ resumed: true });
  try {
    await P.page.waitForSelector('#stThread .st-req-waitx[data-queue-cancel="' + KC + '"]', { timeout: 20000 });
    await P.page.click('#stThread .st-req-waitx[data-queue-cancel="' + KC + '"]');
    for (let i = 0; i < 60 && !P.calls.some((c) => c[0] === "DELETE"); i++) await P.page.waitForTimeout(50);
    assert.ok(P.calls.some((c) => c[0] === "DELETE" && c[1] === "/api/site/request/" + SLUG + "/" + KC), JSON.stringify(P.calls));
    assert.deepEqual(P.errors, []);
  } finally { await P.close(); }
});

test("SQ3 Stop while the message is still on its way stops its request on the server, under the message's own key", { skip: SKIP, timeout: 90000 }, async () => {
  const P = await openPage({ routeHangs: true });
  try {
    // NOTHING RUNNING: the gallery has ended, so this message is the work.
    await P.page.evaluate(({ id, ka, kc }) => { const s = siteById(id); s.requests[ka].view = { ...s.requests[ka].view, ended: true, state: "done" }; if (s.requests[kc]) s.requests[kc].view = { ...s.requests[kc].view, ended: true, state: "stopped" }; }, { id: SITE_ID, ka: KA, kc: KC });
    await P.page.evaluate((id) => siteSend("make the header blue"), SITE_ID);
    for (let i = 0; i < 100 && !P.calls.some((c) => c[1] === "/api/site/route"); i++) await P.page.waitForTimeout(50);
    const sent = P.calls.find((c) => c[1] === "/api/site/route");
    assert.ok(sent, "the message was not sent");
    const key = JSON.parse(sent[2]).idem;
    assert.ok(typeof key === "string" && key, "the message went without its key");
    await P.page.evaluate((id) => siteStopWork(siteById(id)), SITE_ID);
    for (let i = 0; i < 100 && !P.calls.some((c) => c[0] === "DELETE"); i++) await P.page.waitForTimeout(50);
    assert.ok(P.calls.some((c) => c[0] === "DELETE" && c[1] === "/api/site/request/" + SLUG + "/" + key), "Stop did not stop the request on the server: " + JSON.stringify(P.calls.map((c) => c.slice(0, 2))));
    assert.deepEqual(P.errors, []);
  } finally { await P.close(); }
});

test("SQ4 send while something is still working: the words stay in the box and it says so", { skip: SKIP, timeout: 90000 }, async () => {
  const P = await openPage();
  try {
    await P.page.evaluate(() => { siteBusy = true; siteBusyFor = null; });
    await P.page.fill("#stRevise", "and a footer");
    await P.page.evaluate(() => { const b = document.getElementById("stSend"); if (b) b.click(); else { const t = document.getElementById("stRevise"); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); } });
    await P.page.waitForTimeout(300);
    assert.equal(await P.page.$eval("#stRevise", (t) => t.value), "and a footer", "the words left the box");
    const toast = await P.page.evaluate(() => document.body.innerText);
    assert.match(toast, /Still working on your last message/);
    assert.ok(!P.calls.some((c) => c[1] === "/api/site/route"), "it was sent while busy");
  } finally { await P.close(); }
});
