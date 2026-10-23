// WORK IN THE BACKGROUND ON A REAL PAGE (2026-10-23, the owner's approved mock,
// option A: the pill above the message box).
//
// The repo's own public/ — index.html, chat.js, edit-poll.js, styles.css — in a
// real Chromium, every server answer supplied by the case (requests list,
// request reads, the routing route, the per-part stop). Shown:
//   - the box keeps Send (no Stop) while two requests' parts run, and Enter
//     sends;
//   - the pill counts what is unfinished; it opens the panel: the header's
//     counts, one row per part with its dot, name and one line; ▴ closes it;
//   - a row opens that part's own view: the fixed bar, what was asked, every
//     line; the box follows the newest line, and once scrolled up a new line
//     shows "↓ new", which jumps back down; Back returns to the list;
//   - Stop on a part and Remove on a waiting part post the per-part stop with
//     that part; Stop all stops each request with work left;
//   - a question sent while they run is answered on the thread, and no stop,
//     cancel or request write is made;
//   - a reload brings the pill back.
// Screenshots go to the directory named by BG_SHOTS.
//
// IT NEEDS A BROWSER (playwright-core at the root and Chromium); without one it
// is skipped. The logic is also driven without a browser in
// `test/background-work.test.mjs`.
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
const SHOTS = process.env.BG_SHOTS || "";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_bgwk01";
const SLUG = "bookfold-shop";
const KA = "bgrequestkeyaaaa0001";
const KB = "bgrequestkeybbbb0002";
const J = (c) => c.repeat(32);
// SUPPLIED MODEL WORDS, in the shape the task-lines writer gives them (`said`,
// with a title) and the progress writer's lines — never asserted as wording.
const said = (title, doing, done) => ({ title, planned: "I'll do " + title + ".", doing, waiting: "I need you for " + title + ".", unconfirmed: "u", done, partial: "pa", notdone: "I couldn't do " + title + "." });
const LONG = [
  "I've planned the page: a book list, a search box, genre buttons and a reserve form.",
  "Setting up a place to keep your books and reservations — only you will see reservations.",
  "Writing the book list now, with title, author, condition and price.",
  "The list is done. Now the search box: it matches titles and authors as you type.",
  "Writing the search and genre filter now.",
  "Adding the Reserve button: it asks for a name and email and holds the book for three days.",
  "Checking the reserve form sends to your inbox.",
  "Making the list read well on a phone.",
  "Giving each book a small cover frame.",
  "Adding a note under the search box for books not listed.",
  "Checking every link on the page goes somewhere.",
  "Putting the Bookshop page in your menu.",
];

function viewA(S) {
  return {
    key: KA, state: "running", ended: false, stop: false, at: Date.now() - 300000, updatedAt: Date.now(),
    opening: "I'll work on these three side by side.",
    parts: [
      { n: 0, words: "Add a Bookshop page with search and a reserve button", status: "started", ids: [J("a")], jobs: [], charged: 0, route: "addon", said: said("Bookshop page", "I'm adding your Bookshop page.", "I've added your Bookshop page."), progress: LONG.slice(0, S.lines).map((text, i) => ({ job: J("a"), n: i, ms: i * 1000, text })) },
      { n: 1, words: "change Saturday hours to 8am–7pm", status: "blocked", needs: [0], ids: [], jobs: [], charged: 0, said: said("Saturday hours", "d", "Done.") },
      { n: 2, words: "fill in a search description", status: "done", ids: [J("c")], jobs: [J("c")], charged: 1, route: "text", draft: { revision: 4, preview: "ready" }, said: said("Search description", "d", "I've written your search description.") },
    ],
  };
}
function viewB() {
  return {
    key: KB, state: "running", ended: false, stop: false, at: Date.now() - 200000, updatedAt: Date.now(),
    parts: [{ n: 0, words: "make the buttons rounder", status: "started", ids: [J("b")], jobs: [], charged: 0, route: "look", said: said("Rounder buttons", "I'm making your buttons rounder.", "Done."), progress: [{ job: J("b"), n: 0, ms: 1000, text: "Checking the new style on every page…" }] }],
  };
}
const siteRecord = () => ({
  id: SITE_ID, slug: SLUG, react: true, name: "Bookfold", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }, { path: "/bookshop", name: "Bookshop" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now(),
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
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Bookfold</title><h1>Bookfold</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (req.method() !== "GET") calls.push({ method: req.method(), path: p, body: req.postData() ? JSON.parse(req.postData()) : null });
      if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: S.ended ? [] : [viewA(S), viewB()] });
      if (p === "/api/site/request/" + SLUG + "/" + KA + "/stop") return json(route, { ok: true, request: viewA(S) });
      if (p === "/api/site/request/" + SLUG + "/" + KA) return json(route, { ok: true, request: viewA(S) });
      if (p === "/api/site/request/" + SLUG + "/" + KB) return json(route, { ok: true, request: viewB() });
      // A QUESTION: the routing route answers it at once, as `intent: "ask"` does.
      if (p === "/api/site/route") return json(route, { ok: true, intent: "ask", answer: "Libre Baskerville for headings and Source Sans for body text.", replyFrom: "conversation", cost: 1 });
      if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/", "/bookshop"] });
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
  return { page, ctx, browser, errors, calls };
}
const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const el = await page.$(".st-rail");
  await (el || page).screenshot({ path: path.join(SHOTS, name) });
};

test("BACKGROUND WORK — Send while parts run; the pill, the panel, a part's own view with its scroll box and ↓ new, Back, Stop, Remove, Stop all, a question answered without touching the work, and a reload", { skip: SKIP, timeout: 180000 }, async () => {
  const S = { lines: 12, ended: false };
  const app = await openApp(S);
  const { page } = app;
  try {
    // THE PILL, once the requests list has brought both requests back.
    await page.waitForSelector(".st-bg-pill", { timeout: 20000 });
    assert.equal((await page.textContent(".st-bg-pill")).trim(), "3 things in progress ▾");
    // SEND, NEVER STOP, while they run.
    assert.ok(await page.$("#stSend"), "the box has no Send while parts run");
    assert.equal(await page.$("#stStop"), null, "the box shows Stop while parts run");
    await shot(page, "1-pill-closed.png");
    // THE PANEL.
    await page.click(".st-bg-pill");
    await page.waitForSelector(".st-bg-pane .st-bg-row");
    assert.equal((await page.textContent(".st-bg-top > span")).trim(), "4 things · 2 in progress");
    const rows = await page.$$eval(".st-bg-row", (els) => els.map((e) => ({ cls: e.className, name: e.querySelector(".st-bg-name").textContent, sub: e.querySelector(".st-bg-sub").textContent })));
    assert.deepEqual(rows.map((r) => r.name), ["Bookshop page", "Saturday hours", "Search description", "Rounder buttons"]);
    assert.deepEqual(rows.map((r) => r.cls.match(/st-par-(\w+)/)[1]), ["run", "wait", "done", "run"]);
    assert.equal(rows[0].sub, LONG[11], "a working row does not show its newest line");
    assert.equal(rows[1].sub, "Next — after Bookshop page");
    assert.match(rows[2].sub, /^Saved as draft · just now$/);
    assert.ok(await page.$('.st-bg-top [data-bg="stopall"]'), "no Stop all");
    await shot(page, "2-panel-open-4-jobs.png");
    // A ROW: its own view.
    await page.click('.st-bg-row[data-bg-row="' + KA + '|0"]');
    await page.waitForSelector(".st-bg-jobview .st-bg-scroll");
    assert.match(await page.textContent(".st-bg-jobview .st-bg-top"), /‹ Back · Bookshop page/);
    assert.match(await page.textContent(".st-bg-jobview .st-bg-top"), /Stop/);
    assert.match(await page.textContent(".st-bg-asked"), /You asked: “Add a Bookshop page with search and a reserve button”/);
    assert.equal(await page.$$eval(".st-bg-jobview .st-req-prog li", (els) => els.length), 12);
    const box = () => page.$eval(".st-bg-jobview .st-bg-scroll", (b) => ({ top: b.scrollTop, h: b.scrollHeight, c: b.clientHeight, over: getComputedStyle(b).overflowY }));
    let b = await box();
    assert.ok(b.h > b.c, "the part's view does not scroll inside its own box: " + JSON.stringify(b));
    assert.equal(b.over, "auto");
    assert.ok(b.top + b.c >= b.h - 8, "a working part does not follow its newest line: " + JSON.stringify(b));
    // THE PANEL'S HEIGHT IS BOUNDED, the bar outside the scroll box.
    const pane = await page.$eval(".st-bg-pane", (e) => e.getBoundingClientRect().height);
    assert.ok(pane <= 900 * 0.45 + 1, "the panel is taller than its maximum: " + pane);
    assert.equal(await page.$eval(".st-bg-jobview .st-bg-top", (e) => !!e.closest(".st-bg-scroll")), false, "the bar scrolls with the box");
    // SCROLLED UP, THEN A NEW LINE: "↓ new".
    await page.$eval(".st-bg-jobview .st-bg-scroll", (bx) => { bx.scrollTop = 0; bx.dispatchEvent(new Event("scroll")); });
    assert.equal(await page.$eval(".st-bg-new", (e) => e.hidden), true, "↓ new shows before any new line");
    S.lines = 14; LONG.push("Adding a small sign-up for new arrivals.", "Writing the line under the page title.");
    await page.waitForFunction(() => document.querySelectorAll(".st-bg-jobview .st-req-prog li").length === 14, null, { timeout: 30000 });
    await page.waitForFunction(() => { const n = document.querySelector(".st-bg-new"); return n && !n.hidden; }, null, { timeout: 5000 });
    b = await box();
    assert.ok(b.top + b.c < b.h - 8, "the box jumped down although the customer scrolled up");
    await shot(page, "3-job-view-long-progress-new.png");
    await page.click(".st-bg-new");
    b = await box();
    assert.ok(b.top + b.c >= b.h - 8, "↓ new did not jump down");
    assert.equal(await page.$eval(".st-bg-new", (e) => e.hidden), true);
    // STOP THIS PART: the per-part stop, with its part.
    await page.click('.st-bg-jobview [data-bg="stop"]');
    await page.waitForFunction(() => true);
    for (let i = 0; i < 40 && !app.calls.some((c) => c.path.endsWith("/stop")); i++) await page.waitForTimeout(50);
    assert.deepEqual(app.calls.filter((c) => c.path.endsWith("/stop")).map((c) => [c.method, c.path, c.body]), [["POST", "/api/site/request/" + SLUG + "/" + KA + "/stop", { part: 0 }]]);
    // BACK, THEN REMOVE ON THE WAITING PART.
    await page.click('.st-bg-jobview [data-bg="back"]');
    await page.waitForSelector('.st-bg-row[data-bg-row="' + KA + '|1"]');
    await page.click('.st-bg-row[data-bg-row="' + KA + '|1"]');
    await page.waitForSelector('.st-bg-jobview [data-bg="stop"]');
    assert.equal((await page.textContent('.st-bg-jobview [data-bg="stop"]')).trim(), "Remove");
    assert.match(await page.textContent(".st-bg-jobview .st-bg-scroll"), /Starts when Bookshop page is done/);
    await page.click('.st-bg-jobview [data-bg="stop"]');
    for (let i = 0; i < 40 && app.calls.filter((c) => c.path.endsWith("/stop")).length < 2; i++) await page.waitForTimeout(50);
    assert.deepEqual(app.calls.filter((c) => c.path.endsWith("/stop"))[1].body, { part: 1 });
    await page.click('.st-bg-jobview [data-bg="back"]');
    // ▴ CLOSES IT.
    await page.click('.st-bg-top [data-bg="close"]');
    await page.waitForSelector(".st-bg-pill");
    // A QUESTION WHILE THEY RUN: Enter sends it; the answer is on the thread; no stop or cancel is made.
    const before = app.calls.length;
    await page.fill("#stRevise", "What fonts is the site using?");
    await page.press("#stRevise", "Enter");
    await page.waitForFunction(() => [...document.querySelectorAll("#stThread .st-msg.a")].some((m) => m.textContent.includes("Libre Baskerville")), null, { timeout: 20000 });
    const after = app.calls.slice(before);
    assert.deepEqual(after.map((c) => c.method + " " + c.path), ["POST /api/site/route"], "the question touched the running work: " + JSON.stringify(after));
    assert.equal(after[0].body.message, "What fonts is the site using?");
    assert.ok(await page.$(".st-bg-pill"), "the pill went away for a question");
    assert.ok(await page.$("#stSend"));
    await shot(page, "4-question-answered-while-working.png");
    // STOP ALL: each request with work left, through its own stop.
    await page.click(".st-bg-pill");
    await page.click('.st-bg-top [data-bg="stopall"]');
    for (let i = 0; i < 40 && app.calls.filter((c) => c.method === "DELETE").length < 2; i++) await page.waitForTimeout(50);
    assert.deepEqual(app.calls.filter((c) => c.method === "DELETE").map((c) => c.path).sort(), ["/api/site/request/" + SLUG + "/" + KA, "/api/site/request/" + SLUG + "/" + KB].sort());
    // A RELOAD brings the pill back.
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".st-bg-pill", { timeout: 20000 });
    assert.match(await page.textContent(".st-bg-pill"), /things in progress/);
    assert.deepEqual(app.errors, []);
  } finally { await app.ctx.close(); await app.browser.close(); }
});
