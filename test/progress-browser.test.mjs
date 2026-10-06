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
// SUPPLIED MODEL ANSWERS, in the first person the instructions ask for (the
// owner, 2026-10-06: *"conversational and first-person … These are tone
// examples, not templates"*) — what a case hands the page, never a template.
const LINES = [
  L(JOB, 0, 30, "I've worked out what to add: a Tasting Evenings page with a waiting-list form, and somewhere to keep the sign-ups."),
  L(JOB, 1, 91, "I've designed the sign-up list — it keeps each person's name and email address. Next I'll design the page itself."),
  L(JOB, 2, 165, "I've designed the page, with a form asking for a name and an email address. I'm building it now."),
];
const SOLO_LINES = [
  { n: 0, ms: 5000, text: "I found the Gallery heading and I'm changing it to “Photographs from our ovens”." },
  { n: 1, ms: 8000, text: "I've made the new heading in the builder, and I'm putting it on your site now." },
];
// EACH TASK'S OWN LINES, one per state (seven since the outcome round,
// 2026-10-06); the page shows the one its status is in.
const SAID_A = {
  planned: "I'll add a Tasting Evenings page where people can join the waiting list.",
  doing: "I'm adding your Tasting Evenings page with its waiting-list form.",
  waiting: "I need your answer before I can add the Tasting Evenings page.",
  unconfirmed: "I tried to add your Tasting Evenings page, but I can't tell yet whether it went through.",
  done: "I've added your Tasting Evenings page with its waiting list.",
  partial: "I've added part of the Tasting Evenings page, but not all of it.",
  notdone: "I couldn't add the Tasting Evenings page.",
};
const SAID_SOLO = {
  planned: "Okay, I'll update the Gallery heading to “Photographs from our ovens”.",
  doing: "I'm updating the Gallery heading now.",
  waiting: "I need a quick answer from you before I update the Gallery heading.",
  unconfirmed: "I tried to update the Gallery heading, but I can't tell yet whether it went through.",
  done: "I've updated the Gallery heading to “Photographs from our ovens”.",
  partial: "I've updated part of the Gallery heading, but not all of it.",
  notdone: "I couldn't update the Gallery heading.",
};
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
/** Each part's title on the thread's cards, in order. */
const titles = (page) => page.$$eval(".st-req-part .st-req-words", (els) => els.map((e) => e.textContent));

test("PATH A — a request's card: the part's fixed label stays, its lines appear under it with the newest live, read after read without doubling; once ended they stay, muted, above its reply — and none of them is a thread message. The part is named by its words until the model's lines for it come, then by the line for its state: doing while it runs, done once it has", { skip: SKIP, timeout: 120000 }, async () => {
  let finished = false;
  let shown = 2;
  let named = false;
  const view = () => ({
    key: KEY, state: finished ? "done" : "running", ended: finished, stop: false, at: Date.now() - 300000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [{ n: 0, words: WORDS, status: finished ? "done" : "started", ids: [JOB], jobs: finished ? [JOB] : [], charged: 0, route: "addon", progress: LINES.slice(0, shown), ...(named ? { said: SAID_A } : {}) }],
  });
  const S = { requests: () => [view()], view, polls: { [JOB]: () => (finished ? { final: true, body: { ...ADDON_ANSWER, progress: LINES } } : { body: { ok: true, status: "building", progress: LINES.slice(0, shown) } }) } };
  const app = await openApp(S);
  try {
    const { page } = app;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part .st-req-prog li").length === 2, null, { timeout: 20000 });
    assert.equal(await page.textContent(".st-req-part .st-req-status"), "In progress", "the fixed label is gone beside the lines");
    assert.deepEqual(await lineTexts(page, ".st-req-part .st-req-prog li"), LINES.slice(0, 2).map((l) => l.text));
    assert.equal(await page.$$eval(".st-req-part .st-req-prog li.live", (els) => els.length), 1);
    assert.match(await page.textContent(".st-req-part .st-req-prog li.live"), /design the page itself/, "the newest line is not the live one");
    // READ AGAIN AND AGAIN: never doubled.
    for (const until = Date.now() + 5000; Date.now() < until && app.reads.request < 3;) await page.waitForTimeout(150);
    assert.ok(app.reads.request >= 2, "the page read the request only once");
    assert.equal(await page.$$eval(".st-req-part .st-req-prog li", (els) => els.length), 2, "a line was drawn twice");
    // NAMED BY ITS WORDS, as they are, until its lines come; then by the line for running.
    assert.deepEqual(await titles(page), [WORDS], "the part was not named by its words before its lines came");
    named = true;
    await page.waitForFunction((t) => [...document.querySelectorAll(".st-req-part .st-req-words")].some((e) => e.textContent === t), SAID_A.doing, { timeout: 20000 });
    shown = 3;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part .st-req-prog li").length === 3, null, { timeout: 20000 });
    assert.deepEqual(await titles(page), [SAID_A.doing]);
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
    assert.deepEqual(await titles(page), [SAID_A.done], "the finished part was not named by its done line");
    await shot(page, "progress-a-finished.png");
    const k = await kept(page);
    assert.deepEqual(k.msgs, ["card", "reply"], "a progress line became a thread message: " + k.msgs.join(","));
    assert.deepEqual(app.errors, []);
    // ── RELOAD: the same page loaded again shows the same lines, muted. ──
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => document.querySelectorAll(".st-req-done .st-req-prog li").length === 3, null, { timeout: 20000 });
    assert.deepEqual(await lineTexts(page, ".st-req-done .st-req-prog li"), LINES.map((l) => l.text));
    assert.deepEqual(await titles(page), [SAID_A.done], "a reload lost the part's line");
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
    assert.match(await page.textContent(".st-busy .st-think-prog"), /found the Gallery heading/);
    assert.equal(await page.$(".st-busy .st-think:not(.st-think-prog)"), null, "\"Thinking\" stayed beside the line");
    shown = 2;
    await page.waitForFunction(() => { const e = document.querySelector(".st-busy .st-think-prog"); return !!e && e.textContent.includes("putting it on your site now"); }, null, { timeout: 20000 });
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

test("FRESH DEVICE — no thread, no request, no job of its own: the requests list brings back the request's card with its lines, and the page-filed job's card with its lines, followed to its reply — each named by the model's line for its state", { skip: SKIP, timeout: 120000 }, async () => {
  let soloDone = false;
  const view = () => ({
    key: KEY, state: "done", ended: true, stop: false, at: Date.now() - 600000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [{ n: 0, words: WORDS, status: "done", ids: [JOB], jobs: [JOB], charged: 18, route: "addon", progress: LINES, said: SAID_A }],
  });
  // EACH ANSWER CARRIES THE JOB'S OWN OUTCOME, as the server serves it (2026-10-06).
  const soloView = () => ({ job: SOLO, op: "edit", state: soloDone ? "done" : "editing", ended: soloDone, outcome: soloDone ? "done" : "running", words: SOLO_WORDS, at: Date.now() - 30000, progress: SOLO_LINES.slice(0, 1), said: SAID_SOLO });
  const S = {
    requests: () => [view()], view, jobs: () => [soloView()],
    polls: {
      [JOB]: () => ({ final: true, body: { ...ADDON_ANSWER, progress: LINES } }),
      [SOLO]: () => (soloDone ? { final: true, body: { ...EDIT_ANSWER, outcome: "done", progress: SOLO_LINES, said: SAID_SOLO } } : { body: { ok: true, status: "editing", outcome: "running", progress: SOLO_LINES.slice(0, 1), said: SAID_SOLO } }),
    },
  };
  const app = await openApp(S, { seed: { site: siteRecord() } });
  try {
    const { page } = app;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-done .st-req-prog li").length === 3, null, { timeout: 20000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-req-part")].some((p) => p.textContent.includes("Gallery heading") && p.querySelector(".st-req-prog li.live")), null, { timeout: 20000 });
    const card = await page.$$eval(".st-req-part", (els) => els.filter((p) => p.textContent.includes("Gallery heading")).map((p) => ({ status: p.querySelector(".st-req-status").textContent, lines: p.querySelectorAll(".st-req-prog li").length })));
    assert.deepEqual(card, [{ status: "In progress", lines: 1 }], "the found job's card is not drawn with its label and lines");
    assert.deepEqual(await titles(page), [SAID_A.done, SAID_SOLO.doing], "the cards were not named by the lines for their states");
    await shot(page, "progress-fresh-running.png");
    soloDone = true;
    await page.waitForFunction(() => [...document.querySelectorAll(".st-msg.a")].some((m) => m.textContent.includes("now reads")), null, { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-req-part")].some((p) => p.textContent.includes("Gallery heading") && p.querySelector(".st-req-status").textContent === "Finished"), null, { timeout: 20000 });
    assert.deepEqual(await titles(page), [SAID_A.done, SAID_SOLO.done], "the finished job's card was not named by its done line");
    const k = await kept(page);
    assert.deepEqual(k.msgs, ["card", "reply", "job-card", "reply"], "the fresh device's thread is not the two cards and their replies: " + k.msgs.join(","));
    await shot(page, "progress-fresh-finished.png");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});

test("TENSES — one request, three parts: each named by the model's line for the state it is in — the one finished in the past, the one running in the present, the one waiting on it in the future — and each moves to its next line as its status moves, nothing put before the customer's words", { skip: SKIP, timeout: 120000 }, async () => {
  const MENU_WORDS = "put a link to it in the menu";
  const SAID_MENU = {
    planned: "Once the page is ready, I'll add a link to it in your menu.",
    doing: "I'm adding the link to your menu now.",
    waiting: "I need your answer before I add the link to your menu.",
    unconfirmed: "I tried to add the link to your menu, but I can't tell yet whether it went through.",
    done: "I've added a link to it in your menu.",
    partial: "I've added part of the link to your menu.",
    notdone: "I couldn't add the link to your menu.",
  };
  const JOB3 = "c4" + "0".repeat(30);
  let stage = 0;
  const part = (n, words, status, said, extra = {}) => ({ n, words, status, ids: [], jobs: [], charged: 0, route: n === 1 ? "addon" : "edit", said, ...extra });
  const view = () => ({
    key: KEY, state: stage < 2 ? "running" : "done", ended: stage >= 2, stop: false, at: Date.now() - 300000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [
      part(0, SOLO_WORDS, "done", SAID_SOLO, { ids: [SOLO], jobs: [SOLO] }),
      part(1, WORDS, stage === 0 ? "started" : "done", SAID_A, { ids: [JOB], jobs: stage === 0 ? [] : [JOB], progress: LINES.slice(0, 2) }),
      part(2, MENU_WORDS, stage === 0 ? "blocked" : stage === 1 ? "started" : "done", SAID_MENU, { ids: stage === 0 ? [] : [JOB3], jobs: stage >= 2 ? [JOB3] : [] }),
    ],
  });
  const S = {
    requests: () => [view()], view,
    polls: {
      [SOLO]: () => ({ final: true, body: { ...EDIT_ANSWER } }),
      [JOB]: () => (stage === 0 ? { body: { ok: true, status: "building", progress: LINES.slice(0, 2) } } : { final: true, body: { ...ADDON_ANSWER } }),
      [JOB3]: () => (stage < 2 ? { body: { ok: true, status: "editing" } } : { final: true, body: { ok: true, layer: "nav", changed: ["src/routes/index.tsx"], cost: 2, reply: "✅ Tasting Evenings is in your menu.", replySource: "model" } }),
    },
  };
  const app = await openApp(S);
  try {
    const { page } = app;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part").length === 3, null, { timeout: 20000 });
    assert.deepEqual(await titles(page), [SAID_SOLO.done, SAID_A.doing, SAID_MENU.planned]);
    for (const t of await titles(page)) assert.ok(![SOLO_WORDS, WORDS, MENU_WORDS].some((w) => t.includes(w)), "a customer's words were shown, or put after a prefix: " + t);
    await shot(page, "names-tenses.png");
    stage = 1;
    await page.waitForFunction((t) => [...document.querySelectorAll(".st-req-part .st-req-words")].some((e) => e.textContent === t), SAID_MENU.doing, { timeout: 20000 });
    assert.deepEqual(await titles(page), [SAID_SOLO.done, SAID_A.done, SAID_MENU.doing]);
    stage = 2;
    await page.waitForFunction((t) => [...document.querySelectorAll(".st-req-part .st-req-words")].some((e) => e.textContent === t), SAID_MENU.done, { timeout: 30000 });
    assert.deepEqual(await titles(page), [SAID_SOLO.done, SAID_A.done, SAID_MENU.done]);
    await shot(page, "names-tenses-finished.png");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});

// ── THE OUTCOME ROUND (2026-10-06) ───────────────────────────────────────────

// THE CANARY'S OWN READER, cut from scripts/canary-ui.mjs and run on the page
// exactly as the canary runs it (`page.evaluate(readComposerInPage)`).
const CANARY = readFileSync(new URL("../scripts/canary-ui.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const READER = (() => {
  const head = "\nfunction readComposerInPage() {";
  const at = CANARY.indexOf(head);
  assert.ok(at > 0 && CANARY.indexOf(head, at + 1) < 0, "the canary's reader is gone from scripts/canary-ui.mjs, or is not one");
  const end = CANARY.indexOf("\n}\n", at);
  return CANARY.slice(at + 1, end + 2);
})();
const NO_MATCH = "I couldn't find a heading called “Gallery” on that page, so nothing was changed.";

test("CANARY — THE REPLY READ APART FROM THE PROGRESS KEPT ABOVE IT: a watched job fails with two lines kept above its warning; the canary's own reader, on the real page, reads the reply's text beginning with the warning and carrying no kept line, and the lines apart (`progress`); the failure check passes on those replies — where the message read whole, as before, did not", { skip: SKIP, timeout: 120000 }, async () => {
  const { newReplies, failureVerdict } = await import("../scripts/canary-ui.mjs");
  let finished = false;
  const FAILED = { ok: false, error: "no-match", msg: NO_MATCH, cost: 0, refunded: 1, layer: "data" };
  const S = {
    requests: () => [], view: () => null, jobs: () => [],
    polls: { [SOLO]: () => (finished ? { final: true, body: { ...FAILED, progress: SOLO_LINES } } : { body: { ok: true, status: "editing", progress: SOLO_LINES.slice(0, 1) } }) },
  };
  const site = siteRecord({ msgs: [{ r: "u", t: SOLO_WORDS }] });
  const watch = { [SLUG]: { job: SOLO, at: Date.now(), ask: SOLO_WORDS, op: "edit", layer: "data" } };
  const app = await openApp(S, { seed: { site, watch } });
  try {
    const { page } = app;
    await page.waitForFunction(() => !!document.querySelector(".st-busy .st-think-prog"), null, { timeout: 20000 });
    finished = true;
    await page.waitForFunction((m) => [...document.querySelectorAll(".st-msg.a")].some((e) => e.textContent.includes(m)), NO_MATCH, { timeout: 30000 });
    assert.equal(await page.$$eval(".st-msg.a .st-prog-done li", (els) => els.length), 2, "the lines were not kept above the reply");
    const s = await page.evaluate("(" + READER + ")()");
    const replies = newReplies(1, s.messages);
    assert.equal(replies.length, 1, JSON.stringify(s.messages.map((m) => m.text)));
    const reply = replies[0];
    assert.ok(reply.text.startsWith("⚠️"), "the reply as the canary reads it does not begin with its warning: " + JSON.stringify(reply.text.slice(0, 80)));
    assert.ok(reply.text.includes(NO_MATCH));
    for (const l of SOLO_LINES) assert.ok(!reply.text.includes(l.text), "a kept line was read as part of the reply");
    assert.deepEqual(reply.progress, SOLO_LINES.map((l) => l.text), "the kept lines were not read apart");
    const step = (texts) => ({ replies: texts, reply: texts.join("\n"), network: [{ method: "GET", path: "/api/site/edit/" + SOLO, status: 422, final: true, res: FAILED }] });
    assert.deepEqual(failureVerdict(step(replies.map((m) => m.text)), { error: "no-match" }).ok, true, "the failure check missed the warning on the reply's own text");
    // AS BEFORE: the message read whole begins with the kept lines, and the check misses it.
    const whole = await page.$$eval(".st-msg.a", (els, m) => els.filter((e) => e.textContent.includes(m)).map((e) => String(e.innerText).replace(/⧉\s*$/, "").trim()), NO_MATCH);
    assert.ok(!whole[0].startsWith("⚠️"), "the case no longer shows the old reading's failure");
    assert.equal(failureVerdict(step(whole), { error: "no-match" }).ok, false);
    await shot(page, "canary-reply-with-kept-lines.png");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});

test("OUTCOMES — ANOTHER DEVICE'S CARDS SAY WHAT REALLY HAPPENED: a job done only in part is Partly done with its partial line; one held for review is Checking it published with its unconfirmed line, never its doing line; one waiting on the customer, its waiting line; one handed on, Handed over — each from the server's outcome", { skip: SKIP, timeout: 120000 }, async () => {
  const J = (c) => c + "5" + "0".repeat(30);
  const cards = [
    { job: J("d"), outcome: "partial", label: "Partly done", which: "partial", answer: { ok: true, kinds: ["page", "frame"], added: ["src/routes/gallery.tsx"], skipped: ["frame"], cost: 6, reply: "I added the gallery page, but I couldn't put a link to it in your menu.", replySource: "model" } },
    { job: J("e"), outcome: "unverified", label: "Checking it published", which: "unconfirmed", answer: { ok: true, kinds: ["page"], added: ["src/routes/gallery.tsx"], cost: 6, reply: "I couldn't confirm the gallery page went live; I'm checking.", replySource: "model" } },
    { job: J("f"), outcome: "waiting", label: "Waiting for your answer", which: "waiting", answer: { ok: false, error: "clarify", clarify: { id: "q".repeat(32).slice(0, 32), text: "Which photos should lead?", options: ["Bread", "Cakes"] }, cost: 0, reply: "Which photos should lead the gallery?", replySource: "model" } },
    { job: J("a"), outcome: "handoff", label: "Handed over", which: "planned", answer: { ok: false, escalate: true, layer: "text", cost: 0 } },
  ];
  const listed = cards.map((c, i) => ({ job: c.job, op: "edit", state: c.outcome === "unverified" ? "failed" : "done", ended: true, outcome: c.outcome, words: SOLO_WORDS, at: Date.now() - (60000 - i * 1000), progress: [], said: SAID_SOLO }));
  const S = {
    requests: () => [], view: () => null, jobs: () => listed,
    polls: Object.fromEntries(cards.map((c) => [c.job, () => ({ final: true, body: { ...c.answer, outcome: c.outcome, said: SAID_SOLO } })])),
  };
  const app = await openApp(S, { seed: { site: siteRecord() } });
  try {
    const { page } = app;
    await page.waitForFunction((n) => document.querySelectorAll(".st-req-part").length === n, cards.length, { timeout: 20000 });
    for (const until = Date.now() + 8000; Date.now() < until && cards.some((c) => !app.reads.polls[c.job]);) await page.waitForTimeout(150);
    await page.waitForTimeout(400);
    const drawn = await page.$$eval(".st-req-part", (els) => els.map((p) => ({ words: p.querySelector(".st-req-words").textContent, label: p.querySelector(".st-req-status").textContent })));
    assert.deepEqual(drawn, cards.map((c) => ({ words: SAID_SOLO[c.which], label: c.label })), "the cards do not say each job's real outcome");
    for (const d of drawn) assert.notEqual(d.words, SAID_SOLO.doing, "an ended job was named by its doing line");
    await shot(page, "outcome-cards.png");
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});

test("CARDS — THE CANARY'S READER READS A REQUEST'S CARD AS DRAWN (2026-10-06, the progress live check): a fresh device's page draws the request the list names, and the canary's own reader, on the real page, reads each part's own words (the model's line for its state), its label, its lines without their times, the newest live while it runs, and the lines for every state as the page keeps them; ended, each part shows its done line and no live line", { skip: SKIP, timeout: 120000 }, async () => {
  const { progressSnapshot } = await import("../scripts/canary-ui.mjs");
  let ended = false;
  const view = () => ({
    key: KEY, state: ended ? "done" : "running", ended, stop: false, at: Date.now() - 60000, updatedAt: Date.now(), routedUnsaid: 0,
    parts: [
      { n: 0, words: WORDS, status: ended ? "done" : "started", ids: [JOB], jobs: ended ? [JOB] : [], charged: 0, route: "addon", progress: LINES.slice(0, ended ? 3 : 2), said: SAID_A },
      { n: 1, words: SOLO_WORDS, status: ended ? "done" : "ready", ids: ended ? [SOLO] : [], jobs: ended ? [SOLO] : [], charged: 0, route: "text", said: SAID_SOLO },
    ],
  });
  const S = {
    requests: () => [view()], view, jobs: () => [],
    polls: { [JOB]: () => ({ final: true, body: { ...ADDON_ANSWER, progress: LINES } }), [SOLO]: () => ({ final: true, body: { ...EDIT_ANSWER } }) },
  };
  const app = await openApp(S, { seed: { site: siteRecord() } });
  try {
    const { page } = app;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part .st-req-prog li").length === 2, null, { timeout: 20000 });
    const s = await page.evaluate("(" + READER + ")()");
    const running = progressSnapshot(s, KEY);
    assert.ok(running, "the reader found no card for the request: " + JSON.stringify(Object.keys(s.cards || {})));
    assert.equal(running.ended, false);
    assert.deepEqual(running.parts.map((p) => [p.n, p.status, p.words, p.label]), [[0, "started", SAID_A.doing, "In progress"], [1, "ready", SAID_SOLO.planned, "Next"]]);
    assert.deepEqual(running.parts[0].lines, LINES.slice(0, 2).map((l) => l.text), "the lines were not read without their times");
    assert.equal(running.parts[0].live, LINES[1].text, "the newest line was not read as live");
    assert.deepEqual(running.parts[1].lines, []);
    assert.deepEqual(running.parts[0].said, SAID_A, "the lines for every state were not read as the page keeps them");
    ended = true;
    await page.waitForFunction(() => document.querySelectorAll(".st-req-part .st-req-prog li").length === 3 && !document.querySelector(".st-req-prog li.live"), null, { timeout: 30000 });
    const s2 = await page.evaluate("(" + READER + ")()");
    const done = progressSnapshot(s2, KEY);
    assert.equal(done.ended, true);
    assert.deepEqual(done.parts.map((p) => [p.status, p.words, p.live]), [["done", SAID_A.done, ""], ["done", SAID_SOLO.done, ""]]);
    assert.deepEqual(done.parts[0].lines, LINES.map((l) => l.text));
    assert.deepEqual(app.errors, []);
  } finally { await closeApp(app); }
});
