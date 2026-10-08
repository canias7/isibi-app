// A BUILD'S OUTCOME, AS THE PAGE SHOWS IT (2026-10-08, the sixth batch), in a
// real Chromium with every server answer supplied: the reply writer's account
// when there is one, and otherwise a fixed outage line with the recorded
// facts — never the old fixed sentences beside either.
//
// A first build's message was cut to 2,000 characters and a typed answer to a
// question to 200, in the page, before anything was sent — and the thread
// then showed the cut copy as what they had said. Now both go whole up to the
// one-message policy, and past it the words go back in the box and nothing is
// sent, as a message to a live site always has.
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
const SITE_ID = "site_1727000000000_fact01";
const words = (n, tail) => ("Harbour Loaf bakes overnight sourdough in Leeds and wants a page people can order from. ".repeat(Math.ceil(n / 80))).slice(0, n - tail.length) + tail;

async function openApp(site, answer = null) {
  site = { ...site, __answer: answer };
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1320, height: 900 } });
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    localStorage.setItem("zephyr_sites_v1", JSON.stringify([sd]));
  }, site);
  const posts = [];
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (req.method() === "POST") { let b = null; try { b = JSON.parse(req.postData() || "null"); } catch { b = null; } posts.push({ path: p, body: b }); }
      // THE ROUTER, ANSWERED: a question stays a question; anything else is a build that ends here.
      if (p === "/api/site/route") return json(route, { ok: true, intent: "build", cost: 0 });
      if (p === "/api/site/react-build" && site.__answer) return json(route, site.__answer);
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
const newSite = (over = {}) => ({ id: SITE_ID, react: true, name: "New site", msgs: [], updatedAt: Date.now(), createdAt: Date.now(), ...over });
async function send(page, text) {
  await page.evaluate((t) => { const ta = document.getElementById("stRevise"); ta.value = t; ta.dispatchEvent(new Event("input")); }, text);
  await page.click("#stSend");
  await page.waitForTimeout(400);
}
const threadText = (page) => page.evaluate(() => document.getElementById("stThread").innerText);


const FACTS = {
  pictures: [
    { page: "/", describe: "a loaf on the counter", status: "made" },
    { page: "/", describe: "the ovens at dawn", status: "failed" },
    { page: "/", describe: "the Saturday queue", status: "not-offered", why: "cap" },
  ],
  sources: [
    { url: "https://a.example/", status: "used" },
    { url: "https://b.example/", status: "partial", kept: 11000, chars: 14000, allowance: 16000 },
    { url: "https://c.example/", status: "unopened", reason: "one build opens at most 2 links" },
  ],
  unwritten: [{ section: "the price list for every loaf" }],
};
const BUILT = { ok: true, slug: "harbour-loaf", url: "/s/harbour-loaf/", page: "app", cost: 31, files: ["index.tsx"], notes: "Built Harbour Loaf.",
  contextNote: "OLD CONTEXT SENTENCE", imagesNote: "OLD IMAGES SENTENCE", buildFacts: FACTS };

test("the reply writer's account is shown, and the old fixed sentences are not shown beside it", { skip: SKIP }, async () => {
  const told = "I made the loaf photo; the ovens one didn't come back, and the Saturday queue is past this build's six. I read a.example in full, only part of b.example, and didn't open c.example. The price list couldn't be written — ask again.";
  const { page, browser, errors } = await openApp(newSite(), { ...BUILT, reply: told, replySource: "model" });
  try {
    await send(page, "Harbour Loaf. Like https://a.example https://b.example https://c.example");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.ok(t.includes(told), "the model's account is not on the page: " + t.slice(-600));
    assert.doesNotMatch(t, /OLD CONTEXT SENTENCE|OLD IMAGES SENTENCE/);
    assert.doesNotMatch(t, /couldn't write up this build's details/);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build-told-by-model.png") }); }
    assert.deepEqual(errors.filter((e) => !/localStorage/.test(e)), []);
  } finally { await browser.close(); }
});

test("with the writer unavailable: one fixed outage line, then the recorded facts as they are — no invented account, no old sentences", { skip: SKIP }, async () => {
  const { page, browser, errors } = await openApp(newSite(), { ...BUILT, replyState: "unavailable", replyWhy: "send", settlement: { recovered: true, outcome: "not-published", refunded: 6, short: false } });
  try {
    await send(page, "Harbour Loaf. Like https://a.example https://b.example https://c.example");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    for (const want of [/I couldn't write up this build's details just now\. What was recorded:/, /Pictures made: “a loaf on the counter”/, /Pictures tried, not returned: “the ovens at dawn”/, /Pictures not offered \(at most 6 per build\): “the Saturday queue”/,
      /Link used: a\.example/, /Link partly used: b\.example \(first 11000 of 14000 characters\)/, /Link not opened: c\.example/, /Section left out: “the price list for every loaf”/, /Refund: 6 credits returned\./]) assert.match(t, want);
    assert.doesNotMatch(t, /OLD CONTEXT SENTENCE|OLD IMAGES SENTENCE/);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build-facts-unavailable.png") }); }
    assert.deepEqual(errors.filter((e) => !/localStorage/.test(e)), []);
  } finally { await browser.close(); }
});

test("CONTROL: an answer with no facts and no reply keeps the old notes, unchanged", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...BUILT, buildFacts: undefined });
  try {
    await send(page, "Harbour Loaf");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.match(t, /OLD CONTEXT SENTENCE/);
    assert.match(t, /OLD IMAGES SENTENCE/);
  } finally { await browser.close(); }
});
