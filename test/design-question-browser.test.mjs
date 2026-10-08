// THE DESIGNER'S QUESTION ON A FIRST BUILD, AS THE PAGE SHOWS IT (2026-10-08,
// the ninth Build batch), in a real Chromium with every server answer
// supplied. When the corrective design attempt finds a decision only the
// customer can make, the build answers `intent: 'clarify'` at `stage:
// 'design'`; the page opens the first build's existing question round with the
// model's own words, and the answer runs the same brief again with it.
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
const SITE_ID = "site_1727000000000_dq0001";
const BRIEF = "Harbour Loaf, a bakery in Leeds. People order loaves online.";
const ASK = { text: "Should people pay when they order online, or when they collect in the shop?", options: ["When they order", "When they collect"] };

async function openApp(answers) {
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
      if (p === "/api/site/route") return json(route, { ok: true, intent: "build", cost: 0 });
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

test("the designer's question opens the first build's question round — its own words and answers — and the answer runs the same brief again with it", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp([
    { body: { ok: false, stage: "design", intent: "clarify", question: ASK, cost: 0, designRecovery: { attempts: ["malformed:repair"], outcome: "question" } } },
    { body: { ok: false, error: "stopped here", msg: "stopped here" }, status: 503 },
  ]);
  try {
    await send(page, BRIEF);
    await page.waitForFunction((t) => document.getElementById("stThread").innerText.includes(t), ASK.text, { timeout: 10000 });
    const said = await threadText(page);
    assert.match(said, /When they order/);
    assert.match(said, /When they collect/);
    assert.doesNotMatch(said, /didn.t finish|couldn.t|failed/i, "the question was told as a failure");
    await shot(page, "design-question.png");
    await page.click('.st-opt[data-ans="When they collect"]');
    await page.waitForFunction(() => window.__dqDone || true);
    await page.waitForTimeout(800);
    const b = builds(posts);
    assert.equal(b.length, 2, "the answer did not run the build again: " + JSON.stringify(posts.map((x) => x.path)));
    assert.equal(b[1].body.brief, BRIEF, "the brief was not the original");
    assert.deepEqual(b[1].body.qa, [{ q: ASK.text, a: "When they collect" }]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a designer's question with NO answers offered is still a question: the words alone, and a typed reply answers it", { skip: SKIP }, async () => {
  const q = { text: "What should the shop be called on the site?", options: [] };
  const { page, browser, posts, errors } = await openApp([
    { body: { ok: false, stage: "design", intent: "clarify", question: q, cost: 0 } },
    { body: { ok: false, error: "stopped here", msg: "stopped here" }, status: 503 },
  ]);
  try {
    await send(page, BRIEF);
    await page.waitForFunction((t) => document.getElementById("stThread").innerText.includes(t), q.text, { timeout: 10000 });
    await send(page, "Harbour Loaf Bakery");
    await page.waitForTimeout(800);
    const b = builds(posts);
    assert.equal(b.length, 2);
    assert.equal(b[1].body.brief, BRIEF);
    assert.deepEqual(b[1].body.qa, [{ q: q.text, a: "Harbour Loaf Bakery" }]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("CONTROL: a question whose answers are not words is no question — the build's ordinary end is shown, nothing is asked", { skip: SKIP }, async () => {
  const { page, browser, errors } = await openApp([
    { body: { ok: false, stage: "design", intent: "clarify", question: { text: "Pick one", options: [null, {}] }, cost: 0 } },
  ]);
  try {
    await send(page, BRIEF);
    await page.waitForTimeout(1200);
    const said = await threadText(page);
    assert.doesNotMatch(said, /Pick one/);
    assert.equal(await page.evaluate((id) => !!(JSON.parse(localStorage.getItem("zephyr_sites_v1")) || []).find((s) => s.id === id && s.clarify), SITE_ID), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
