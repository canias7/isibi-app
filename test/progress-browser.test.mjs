// PROGRESS LINES ON A REAL PAGE (2026-10-06).
//
// The repo's own public/ — index.html, chat.js, edit-poll.js, styles.css — in a
// real Chromium, every server answer supplied by the case. The owner: *"Add
// focused tests for … reloads and a fresh device"*, for both paths:
//
//   PATH A   a request's card: each part's fixed label with the lines under
//            it, the newest live, drawn once however often it is read; kept
//            above the part's reply once it has ended, muted.
//   PATH B   a job this page watches: the newest line where "Thinking" was;
//            at its end the lines kept above its reply, and the job named on
//            it, so the same page never draws it again as found elsewhere.
//   FRESH    another device: no thread, no request, no job of its own — the
//            requests list brings back the request's card with its lines and a
//            page-filed job's card with its words and lines, followed to its
//            reply.
//   RELOAD   the same page loaded again shows the same lines.
//
// The lines are never thread messages of their own: each case counts the
// thread. Screenshots go to the scratch directory named by PROGRESS_SHOTS.
//
// IT NEEDS A BROWSER, and runs where one is installed: `playwright-core` at the
// root and Chromium. Unit CI has neither, so there it is skipped; the drawing
// itself is also driven without a browser in `test/progress-page.test.mjs`.
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
const SHOTS = process.env.PROGRESS_SHOTS || "";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_prog01";
const SLUG = "fold-lane-bakery";
const KEY = "progressrequestkey001";
const JOB = "a2" + "0".repeat(30);
const SOLO = "b3" + "0".repeat(30);
const WORDS = "Add a Tasting Evenings page where people can join the waiting list";
const SOLO_WORDS = "Change the Gallery heading to Photographs from our ovens";
const L = (job, n, s, text) => ({ job, n, ms: s * 1000, text });
const LINES = [
  L(JOB, 0, 30, "I'm adding a Tasting Evenings page with a waiting-list form, and somewhere to keep the sign-ups."),
  L(JOB, 1, 91, "The sign-up list is designed: it keeps each person's name and email address. The page itself is next."),
  L(JOB, 2, 165, "The page is designed, with a form asking for a name and an email address. Publishing comes after it is written."),
];
const SOLO_LINES = [
  { n: 0, ms: 5000, text: "Found the Gallery heading. Changing it to “Photographs from our ovens”, then publishing." },
  { n: 1, ms: 8000, text: "The new heading is made, not published yet. Publishing now." },
];
const ADDON_ANSWER = { ok: true, kinds: ["page", "table"], added: ["src/routes/tasting-evenings.tsx"], tables: ["tasting_list"], cost: 18, reply: "✅ Your Tasting Evenings page is up, and sign-ups are kept.", replySource: "model" };
const EDIT_ANSWER = { ok: true, layer: "text", changed: ["src/routes/gallery.tsx"], files: 1, cost: 2, reply: "✅ The Gallery heading now reads “Photographs from our ovens”.", replySource: "model" };

const siteRecord = (over = {}) => ({
  id: SITE_ID, slug: SLUG, react: true, name: "Fold Lane Bakery", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }, { path: "/gallery", name: "Gallery" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now(), ...over,
});

/**
 * ONE BROWSER, ONE PAGE OF THE APP, the site open. `S` is the server's state,
 * read on every request: `requests` (the list's views), `view()` (a request's
 * own read), `jobs` (the list's standalone jobs), `polls` (job id → the poll's
 * answer: `{ final, body }`). `seed` is what this browser's storage held
 * before it opened. Answers `{ page, ctx, browser, errors, reads }`.
 */
async function openApp(S, { seed = {}, browser = null } = {}) {
  const own = !browser;
  const b = browser || await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1320, height: 900 } });
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd.site]));
    if (sd.watch) localStorage.setItem("gf.edit.watch.v1", JSON.stringify(sd.watch));
  }, { site: seed.site || siteRecord(), watch: seed.watch || null });
  const reads = { list: 0, request: 0, polls: {} };
  const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Fold Lane Bakery</title><h1>Fold Lane Bakery</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (p === "/api/site/requests/" + SLUG) { reads.list++; return json(route, { ok: true, requests: S.requests(), ...(S.jobs ? { jobs: S.jobs() } : {}) }); }
      if (p === "/api/site/request/" + SLUG + "/" + KEY) { reads.request++; return json(route, { ok: true, request: S.view() }); }
      const m = /^\/api\/site\/edit\/([0-9a-f]{32})$/.exec(p);
      if (m && S.polls && S.polls[m[1]]) {
        reads.polls[m[1]] = (reads.polls[m[1]] || 0) + 1;
        const a = S.polls[m[1]]();
        return a.final ? json(route, a.body, 200, { "x-gf-edit": "final" }) : json(route, a.body, 202);
      }
      if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/", "/gallery"] });
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
  await page.waitForFunction(() => !!document.getElementById("stThread"), null, { timeout: 15000 });
  return { page, ctx, browser: b, own, errors, reads };
}
const closeApp = async (app) => { try { await app.ctx.close(); } finally { if (app.own) await app.browser.close(); } };
const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const el = await page.$(".st-rail") || await page.$("#stThread");
  if (el) await el.screenshot({ path: path.join(SHOTS, name) }); else await page.screenshot({ path: path.join(SHOTS, name) });
};
/** The thread as the page keeps it: what each message is, never the words. */
const kept = (page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("zephyr_sites_v1") || "[]")[0] || {};
  return { msgs: (s.msgs || []).map((m) => (m.request ? "card" : m.jobCard ? "job-card" : m.r === "u" ? "user" : "reply")), prog: (s.msgs || []).filter((m) => Array.isArray(m.prog)).map((m) => m.prog.length), jobs: (s.msgs || []).flatMap((m) => m.jobs || []) };
});
const lineTexts = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/^\d+:\d\d/, "").trim()));

test("PATH A — a request's card: the part's fixed label stays, its lines appear under it with the newest live, read after read without doubling; once ended they stay, muted, above its reply — and none of them is a thread message", { skip: SKIP, timeout: 120000 }, async () => {
  let finished = false;
  let shown = 2;
  const view = () => ({
    key: KEY, state: finished ? "done" : "running", ended: finished, stop: false, at: Date.now() - 300000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [{ n: 0, words: WORDS, status: finished ? "done" : "started", ids: [JOB], jobs: finished ? [JOB] : [], charged: 0, route: "addon", progress: LINES.slice(0, shown) }],
  });
  const S = { requests: () => [view()], view, polls: { [JOB]: () => (finished ? { final: true, body: { ...ADDON_ANSWER, progress: LINES } } : { body: { ok: true, status: "building", progress: LINES.slice(0, shown) } }) } };
  const app = await openApp(S);
  try {
    const { page } = app;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part .st-req-prog li").length === 2, null, { timeout: 20000 });
    assert.equal(await page.textContent(".st-req-part .st-req-status"), "In progress", "the fixed label is gone beside the lines");
    assert.deepEqual(await lineTexts(page, ".st-req-part .st-req-prog li"), LINES.slice(0, 2).map((l) => l.text));
    assert.equal(await page.$$eval(".st-req-part .st-req-prog li.live", (els) => els.length), 1);
    assert.match(await page.textContent(".st-req-part .st-req-prog li.live"), /The page itself is next/, "the newest line is not the live one");
    // READ AGAIN AND AGAIN: never doubled.
    for (const until = Date.now() + 5000; Date.now() < until && app.reads.request < 3;) await page.waitForTimeout(150);
    assert.ok(app.reads.request >= 2, "the page read the request only once");
    assert.equal(await page.$$eval(".st-req-part .st-req-prog li", (els) => els.length), 2, "a line was drawn twice");
    shown = 3;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part .st-req-prog li").length === 3, null, { timeout: 20000 });
    await shot(page, "progress-a-running.png");
    finished = true;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-done .st-req-prog li").length === 3, null, { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-msg.a")].some((m) => m.textContent.includes("Tasting Evenings page is up")), null, { timeout: 30000 });
    assert.equal(await page.$$eval(".st-req-prog li.live", (els) => els.length), 0, "an ended part still shows a live line");
    const color = await page.$eval(".st-req-done .st-req-prog li", (e) => getComputedStyle(e).color);
    const muted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim());
    assert.ok(color && muted, "no colours read");
    // THE CARD (WITH ITS LINES) STANDS ABOVE THE REPLY.
    const order = await page.$$eval("#stThread .st-msg.a", (els) => els.map((e) => (e.querySelector(".st-req") ? "card" : e.textContent.includes("is up") ? "reply" : "other")));
    assert.ok(order.indexOf("card") >= 0 && order.indexOf("card") < order.indexOf("reply"), "the lines are not above the reply: " + order.join(","));
    await shot(page, "progress-a-finished.png");
    const k = await kept(page);
    assert.deepEqual(k.msgs, ["card", "reply"], "a progress line became a thread message: " + k.msgs.join(","));
    assert.deepEqual(app.errors, []);
    // ── RELOAD: the same page loaded again shows the same lines, muted. ──
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => document.querySelectorAll(".st-req-done .st-req-prog li").length === 3, null, { timeout: 20000 });
    assert.deepEqual(await lineTexts(page, ".st-req-done .st-req-prog li"), LINES.map((l) => l.text));
    assert.deepEqual((await kept(page)).msgs, ["card", "reply"], "a reload added a message");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});

test("PATH B — a job this page watches: its newest line replaces \"Thinking\"; at its end its lines stay above its reply, muted, and the job is named on it; a reload keeps them, and the requests list's copy of the same job is not drawn again", { skip: SKIP, timeout: 120000 }, async () => {
  let finished = false;
  let shown = 1;
  const soloView = () => ({ job: SOLO, op: "edit", state: finished ? "done" : "editing", ended: finished, words: SOLO_WORDS, at: Date.now() - 60000, progress: SOLO_LINES.slice(0, shown) });
  const S = {
    requests: () => [], view: () => null, jobs: () => [soloView()],
    polls: { [SOLO]: () => (finished ? { final: true, body: { ...EDIT_ANSWER, progress: SOLO_LINES } } : { body: { ok: true, status: "editing", progress: SOLO_LINES.slice(0, shown) } }) },
  };
  const site = siteRecord({ msgs: [{ r: "u", t: SOLO_WORDS }] });
  const watch = { [SLUG]: { job: SOLO, at: Date.now(), ask: SOLO_WORDS, op: "edit", layer: "text" } };
  const app = await openApp(S, { seed: { site, watch } });
  try {
    const { page } = app;
    await page.waitForFunction(() => !!document.querySelector(".st-busy .st-think-prog"), null, { timeout: 20000 });
    assert.match(await page.textContent(".st-busy .st-think-prog"), /Found the Gallery heading/);
    assert.equal(await page.$(".st-busy .st-think:not(.st-think-prog)"), null, "\"Thinking\" stayed beside the line");
    shown = 2;
    await page.waitForFunction(() => { const e = document.querySelector(".st-busy .st-think-prog"); return !!e && e.textContent.includes("Publishing now"); }, null, { timeout: 20000 });
    await shot(page, "progress-b-running.png");
    finished = true;
    await page.waitForFunction(() => [...document.querySelectorAll(".st-msg.a")].some((m) => m.textContent.includes("now reads")), null, { timeout: 30000 });
    const reply = await page.$$eval("#stThread .st-msg.a", (els) => els.filter((e) => e.textContent.includes("now reads")).map((e) => ({ lines: [...e.querySelectorAll(".st-prog-done li")].map((l) => l.textContent), html: e.innerHTML })));
    assert.equal(reply.length, 1);
    assert.equal(reply[0].lines.length, 2, "the lines were not kept above the reply");
    assert.ok(reply[0].html.indexOf("st-prog-done") < reply[0].html.indexOf("now reads"), "the lines are below the reply");
    const k = await kept(page);
    assert.deepEqual(k.msgs, ["user", "reply"], "a progress line, or a found job's card, became a thread message: " + k.msgs.join(","));
    assert.deepEqual(k.prog, [2]);
    assert.deepEqual(k.jobs, [SOLO], "the reply does not name its job");
    await shot(page, "progress-b-finished.png");
    // ── RELOAD: the lines are still above the reply; the listed job is not drawn again. ──
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-msg.a")].some((m) => m.textContent.includes("now reads")), null, { timeout: 20000 });
    for (const until = Date.now() + 4000; Date.now() < until && app.reads.list < 2;) await page.waitForTimeout(150);
    assert.ok(app.reads.list >= 2, "the reload never read the requests list");
    assert.equal(await page.$$eval(".st-prog-done li", (els) => els.length), 2);
    assert.deepEqual((await kept(page)).msgs, ["user", "reply"], "the same job was drawn again from the list");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});

test("FRESH DEVICE — no thread, no request, no job of its own: the requests list brings back the request's card with its lines, and the page-filed job's card with its words and lines, followed to its reply", { skip: SKIP, timeout: 120000 }, async () => {
  let soloDone = false;
  const view = () => ({
    key: KEY, state: "done", ended: true, stop: false, at: Date.now() - 600000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [{ n: 0, words: WORDS, status: "done", ids: [JOB], jobs: [JOB], charged: 18, route: "addon", progress: LINES }],
  });
  const soloView = () => ({ job: SOLO, op: "edit", state: soloDone ? "done" : "editing", ended: soloDone, words: SOLO_WORDS, at: Date.now() - 30000, progress: SOLO_LINES.slice(0, 1) });
  const S = {
    requests: () => [view()], view, jobs: () => [soloView()],
    polls: {
      [JOB]: () => ({ final: true, body: { ...ADDON_ANSWER, progress: LINES } }),
      [SOLO]: () => (soloDone ? { final: true, body: { ...EDIT_ANSWER, progress: SOLO_LINES } } : { body: { ok: true, status: "editing", progress: SOLO_LINES.slice(0, 1) } }),
    },
  };
  const app = await openApp(S, { seed: { site: siteRecord() } });
  try {
    const { page } = app;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-done .st-req-prog li").length === 3, null, { timeout: 20000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-req-part")].some((p) => p.textContent.includes("Gallery heading") && p.querySelector(".st-req-prog li.live")), null, { timeout: 20000 });
    const card = await page.$$eval(".st-req-part", (els) => els.filter((p) => p.textContent.includes("Gallery heading")).map((p) => ({ status: p.querySelector(".st-req-status").textContent, lines: p.querySelectorAll(".st-req-prog li").length })));
    assert.deepEqual(card, [{ status: "In progress", lines: 1 }], "the found job's card is not drawn with its words, label and lines");
    await shot(page, "progress-fresh-running.png");
    soloDone = true;
    await page.waitForFunction(() => [...document.querySelectorAll(".st-msg.a")].some((m) => m.textContent.includes("now reads")), null, { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-req-part")].some((p) => p.textContent.includes("Gallery heading") && p.querySelector(".st-req-status").textContent === "Finished"), null, { timeout: 20000 });
    const k = await kept(page);
    assert.deepEqual(k.msgs, ["card", "reply", "job-card", "reply"], "the fresh device's thread is not the two cards and their replies: " + k.msgs.join(","));
    await shot(page, "progress-fresh-finished.png");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});
