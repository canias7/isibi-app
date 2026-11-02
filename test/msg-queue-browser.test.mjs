// THE MESSAGE QUEUE ON A REAL PAGE (2026-11-02, the owner's look, option 1):
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

test("MQB queued messages are chips in the typing box, not bubbles; ✕ cancels one on the server; a started one becomes a bubble with its working line", { skip: SKIP, timeout: 120000 }, async () => {
  const S = { started: false, cancelled: false };
  const calls = [];
  const browser = await chromium.launch({ executablePath: EXE });
  try {
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
      msgs: [
        { r: "u", t: "add a gallery", req: KA, at: T0 }, { r: "a", t: "", request: KA },
        { r: "u", t: "hey", req: KB, at: T0 + 10000 }, { r: "a", t: "", request: KB },
        { r: "u", t: LONG, req: KC, at: T0 + 20000 }, { r: "a", t: "", request: KC },
      ],
    } });
    const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Copper Kettle</title><h1 style='font-family:serif'>Copper Kettle Pottery</h1>" });
      if (url.origin !== ORIGIN) return json(route, {});
      const p = url.pathname;
      if (p.startsWith("/api/")) {
        if (req.method() !== "GET" && p.startsWith("/api/site/request/")) calls.push([req.method(), p]);
        if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [viewA(), viewB(S), ...(S.cancelled ? [] : [viewC(S)])] });
        if (p === "/api/site/request/" + SLUG + "/" + KA) return json(route, { ok: true, request: viewA() });
        if (p === "/api/site/request/" + SLUG + "/" + KB) return json(route, { ok: true, request: viewB(S) });
        if (p === "/api/site/request/" + SLUG + "/" + KC) { if (req.method() === "DELETE") S.cancelled = true; return json(route, { ok: true, request: viewC(S) }); }
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
    await page.waitForFunction(() => document.querySelectorAll(".st-comp #stQueue .st-qchip").length === 2, null, { timeout: 20000 });
    // THE CHIPS, IN ORDER, INSIDE THE BOX ABOVE THE PLACEHOLDER.
    const chips = await page.$$eval("#stQueue .st-qchip", (els) => els.map((e) => e.textContent.trim()));
    assert.equal(chips[0], "hey");
    assert.deepEqual(await page.$eval(".st-qchip", (e) => [getComputedStyle(e, "::before").content, getComputedStyle(e.querySelector(".st-qx"), "::after").content]), ["\"\u23f1\"", "\"\u2715\""], "the chip is not ⏱ … ✕");
    assert.equal(chips[1], "Change the button colour to\u2026");
    assert.equal(await page.$eval("#stQueue", (q) => q.nextElementSibling.id), "stRevise", "the chips are not above the text box");
    const bg = await page.$eval(".st-qchip", (e) => getComputedStyle(e).backgroundColor);
    assert.equal(bg, "rgb(240, 236, 230)");
    // NOT ON THE THREAD: only the gallery and its working line.
    const thread = await page.textContent("#stThread");
    assert.match(thread, /add a gallery/);
    assert.match(thread, /Working on it/);
    assert.doesNotMatch(thread, /\bhey\b|terracotta|Queued/, "a queued message is on the thread");
    if (process.env.MQ_SHOT) await page.screenshot({ path: process.env.MQ_SHOT });
    // ✕ ON THE SECOND: the server's stop for that request, and its chip goes.
    await page.click('[data-queue-cancel="' + KC + '"]');
    await page.waitForFunction(() => document.querySelectorAll("#stQueue .st-qchip").length === 1, null, { timeout: 10000 });
    for (let i = 0; i < 40 && !calls.length; i++) await page.waitForTimeout(50);
    assert.deepEqual(calls, [["DELETE", "/api/site/request/" + SLUG + "/" + KC]]);
    // THE COMPOSER'S STOP STOPS THE RUNNING ONE (the gallery), never the queued hey, though hey is newer.
    calls.length = 0;
    await page.evaluate((id) => siteStopWork(siteById(id)), SITE_ID);
    for (let i = 0; i < 40 && !calls.length; i++) await page.waitForTimeout(50);
    assert.deepEqual(calls, [["DELETE", "/api/site/request/" + SLUG + "/" + KA]], "Stop picked a queued request");
    // …AND WITH NOTHING RUNNING, ONLY A QUEUED ONE, STOP HAS NOTHING TO STOP (only its ✕ cancels it).
    const onlyQueued = await page.evaluate(({ id, ka }) => {
      const s = siteById(id);
      const copy = { ...s, requests: { ...s.requests, [ka]: { ...s.requests[ka], view: { ...s.requests[ka].view, ended: true, state: "done" } } } };
      const w = siteRunningWork(copy);
      return w && w.kind === "request" ? w.key : null;
    }, { id: SITE_ID, ka: KA });
    assert.equal(onlyQueued, null, "Stop would stop a queued message");
    // HEY'S TURN: its chip goes, it is a bubble with its working line.
    S.started = true;
    await page.waitForFunction(() => !document.querySelector("#stQueue .st-qchip") && document.querySelectorAll("#stThread .st-req-working").length === 2, null, { timeout: 30000 });
    const after = await page.textContent("#stThread");
    assert.ok(after.indexOf("hey") > after.indexOf("add a gallery"));
    assert.doesNotMatch(after, /terracotta/, "a cancelled queued message came onto the thread");
    if (process.env.MQ_SHOT2) await page.screenshot({ path: process.env.MQ_SHOT2 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
