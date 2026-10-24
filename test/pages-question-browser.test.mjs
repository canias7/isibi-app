// THE PAGE WRITER'S QUESTION ON A FIRST BUILD, AS THE PAGE SHOWS IT
// (2026-10-24, build questions), in a real Chromium with every server answer
// supplied. The build answers `intent: 'clarify'` at `stage: 'pages'` with the
// id the server kept it under and the slug (`askSlug`); the page opens the
// first build's question round, the answer is routed naming that question, and
// the build runs again with the brief the server holds. A question no longer
// live builds nothing.
//
// Screenshots go to $CONTENT_SHOTS when it is set.

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
const SHOTS = process.env.CONTENT_SHOTS || "";
const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_pq0001";
const BRIEF = "Harbour Loaf, a bakery in Leeds. People order loaves online.";
const ASK = { text: "Do people collect their loaves, or do you deliver?", options: ["Collection only", "We deliver"] };
const QID = "0123456789abcdef0123456789abcdef";

async function openApp(answers, routeAnswer = { body: { ok: true, intent: "build", cost: 0 } }) {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1320, height: 900 } });
  const site = { id: SITE_ID, react: true, name: "New site", msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd]));
  }, site);
  const posts = [];
  let builds = 0;
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (req.method() === "POST") { let bd = null; try { bd = JSON.parse(req.postData() || "null"); } catch { bd = null; } posts.push({ path: p, body: bd }); }
      if (p === "/api/site/route") return json(route, routeAnswer.body, routeAnswer.status || 200);
      if (p === "/api/site/react-build") { const a = answers[Math.min(builds, answers.length - 1)]; builds++; return json(route, a.body, a.status || 200); }
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      return json(route, { ok: false, error: "stopped here", msg: "stopped here" }, 503);
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
  await page.waitForFunction(() => !!document.getElementById("stRevise"), null, { timeout: 15000 });
  return { page, browser: b, posts, errors };
}
async function send(page, text) {
  await page.evaluate((t) => { const ta = document.getElementById("stRevise"); ta.value = t; ta.dispatchEvent(new Event("input")); }, text);
  await page.click("#stSend");
}
const threadText = (page) => page.evaluate(() => document.getElementById("stThread").innerText);
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); };
const builds = (posts) => posts.filter((x) => x.path === "/api/site/react-build");


// THE REQUEST AS THE SERVER KEPT IT: the same brief, told apart here so the
// case can see which one the build ran.
const HELD = BRIEF + " (as kept)";
const PAGES_Q = { ok: false, stage: "pages", intent: "clarify", question: { id: QID, ...ASK }, askSlug: "harbour-loaf", cost: 0 };

test("the page writer's question opens the round; the answer names the kept question and its slug, and the build runs again with the brief the server holds", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp([
    { body: PAGES_Q },
    { body: { ok: false, error: "stopped here", msg: "stopped here" }, status: 503 },
  ], { body: { ok: true, intent: "build", cost: 1, ask: { answered: true, round: 1, context: [{ q: ASK.text, a: "Collection only", by: "build:pages" }] }, instruction: HELD } });
  try {
    await send(page, BRIEF);
    await page.waitForFunction((t) => document.getElementById("stThread").innerText.includes(t), ASK.text, { timeout: 10000 });
    const said = await threadText(page);
    assert.match(said, /Collection only/);
    assert.match(said, /We deliver/);
    assert.doesNotMatch(said, /didn.t finish|couldn.t|failed/i, "the question was told as a failure");
    const kept = await page.evaluate((id) => (JSON.parse(localStorage.getItem("zephyr_sites_v1")) || []).find((s) => s.id === id).clarify, SITE_ID);
    assert.equal(kept.askId, QID, "the kept question's id is not on the round");
    assert.equal(kept.askSlug, "harbour-loaf");
    await shot(page, "pages-question.png");
    await page.click('.st-pick-opt[data-pick="Collection only"]');
    await shot(page, "pages-question-picked.png");
    await page.click('.st-pick-continue[data-pick-go]');
    await page.waitForTimeout(900);
    const rt = posts.filter((x) => x.path === "/api/site/route");
    assert.equal(rt.length >= 1, true, "the answer was not routed");
    const last = rt[rt.length - 1].body;
    assert.deepEqual(last.ask, { id: QID, chosen: true }, "the answer did not name the kept question");
    assert.equal(last.slug, "harbour-loaf");
    assert.equal(last.firstBuild, true);
    const b = builds(posts);
    assert.equal(b.length, 2, "the answer did not run the build again: " + JSON.stringify(posts.map((x) => x.path)));
    assert.equal(b[1].body.brief, HELD, "the build did not run the request the server holds");
    assert.deepEqual(b[1].body.qa, [{ q: ASK.text, a: "Collection only" }]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a kept question already answered elsewhere builds nothing: the route's sentence is said and the round ends", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp([{ body: PAGES_Q }], {
    status: 409, body: { ok: false, error: "stale-question", why: "closed", cost: 0, msg: "That question was already answered or set aside, so I didn't act on your reply. Tell me what you'd like and I'll take it from there." },
  });
  try {
    await send(page, BRIEF);
    await page.waitForFunction((t) => document.getElementById("stThread").innerText.includes(t), ASK.text, { timeout: 10000 });
    await page.click('.st-pick-opt[data-pick="We deliver"]');
    await page.click('.st-pick-continue[data-pick-go]');
    await page.waitForFunction(() => /already answered/.test(document.getElementById("stThread").innerText), null, { timeout: 10000 });
    await shot(page, "pages-question-stale.png");
    assert.equal(builds(posts).length, 1, "a closed question built again");
    assert.equal(await page.evaluate((id) => !!(JSON.parse(localStorage.getItem("zephyr_sites_v1")) || []).find((s) => s.id === id).clarify, SITE_ID), false, "the round stayed open");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("CONTROL: a pages question with no kept id still opens the round, answered from this browser as before", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp([
    { body: { ok: false, stage: "pages", intent: "clarify", question: ASK, cost: 0 } },
    { body: { ok: false, error: "stopped here", msg: "stopped here" }, status: 503 },
  ]);
  try {
    await send(page, BRIEF);
    await page.waitForFunction((t) => document.getElementById("stThread").innerText.includes(t), ASK.text, { timeout: 10000 });
    await page.click('.st-pick-opt[data-pick="We deliver"]');
    await page.click('.st-pick-continue[data-pick-go]');
    await page.waitForTimeout(900);
    const rt = posts.filter((x) => x.path === "/api/site/route");
    assert.equal(rt[rt.length - 1].body.ask, undefined, "an answer named a question the server never kept");
    const b = builds(posts);
    assert.equal(b.length, 2);
    assert.deepEqual(b[1].body.qa, [{ q: ASK.text, a: "We deliver" }]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("\"Skip — just build it\" under a pages question builds with `noAsk`, so no writer asks again", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp([
    { body: PAGES_Q },
    { body: { ok: false, error: "stopped here", msg: "stopped here" }, status: 503 },
  ]);
  try {
    await send(page, BRIEF);
    await page.waitForFunction((t) => document.getElementById("stThread").innerText.includes(t), ASK.text, { timeout: 10000 });
    await page.click("text=Skip \u2014 just build it");
    await page.waitForTimeout(900);
    const b = builds(posts);
    assert.equal(b.length, 2, "skip did not build");
    assert.equal(b[1].body.noAsk, true, "the skipped build may ask again");
    assert.equal(b[0].body.noAsk, undefined, "OBSERVER: the first build already said noAsk");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
