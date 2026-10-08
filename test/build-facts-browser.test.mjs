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

async function openApp(site, answer = null, status = 200) {
  site = { ...site, __answer: answer, __status: status };
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
      if (p === "/api/site/react-build" && site.__answer) return json(route, site.__answer, site.__status || 200);
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
    { page: "/", describe: "a loaf on the counter", status: "made", stage: "published", url: "/uploads/x/loaf.png" },
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
    for (const want of [/I couldn't write up this build's details just now\. What was recorded:/, /Pictures made and shown on a published page: “a loaf on the counter”/, /Pictures tried, not returned: “the ovens at dawn”/, /Pictures not offered \(at most 6 per build\): “the Saturday queue”/,
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

// ── THE SEVENTH BATCH: what a FAILED answer carries is shown too ───────────
//
// `buildToldLines` ran only in the success branch, so a failed resume's or a
// lost build's narration, facts and refund vanished from the chat whenever
// the answer was an error response. Each case below is an error status the
// page reads through its generic failure branch.

const LOST = { ok: false, lost: true, stage: "queue", job: "j1", refunded: 6, cost: 0, msg: "That build was lost on our side, and the 6 credits it took have been returned.",
  buildFacts: { sources: FACTS.sources, settlement: { recovered: true, outcome: "not-published", why: "fence", refunded: 6, short: false } } };

test("7: a lost build's 410, NARRATED — the fixed failure sentence, then the model's account and the refund line", { skip: SKIP }, async () => {
  const told = "Your build stopped before it went live, so I returned the 6 credits; I had read a.example in full and part of b.example.";
  const { page, browser, errors } = await openApp(newSite(), { ...LOST, reply: told, replySource: "model" }, 410);
  try {
    await send(page, "Harbour Loaf. Like https://a.example https://b.example https://c.example");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.ok(t.includes("That build was lost on our side"), "the fixed failure sentence is gone: " + t.slice(-600));
    assert.ok(t.includes(told), "the narration carried by the error response is not on the page: " + t.slice(-600));
    assert.match(t, /Refund: 6 credits returned\./);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build-failed-narrated.png") }); }
    assert.deepEqual(errors.filter((e) => !/localStorage/.test(e)), []);
  } finally { await browser.close(); }
});

test("7: a failed resume's 500 with the writer UNAVAILABLE — the outage line and the recorded facts", { skip: SKIP }, async () => {
  const body = { ok: false, stage: "resume", error: "the build failed", cost: 0, msg: "The build failed and nothing was charged.", replyState: "unavailable", replyWhy: "send",
    buildFacts: { pictures: [{ page: "/", describe: "a loaf on the counter", status: "made", stage: "in-source", url: "/u/a.jpg" }], sources: FACTS.sources } };
  const { page, browser } = await openApp(newSite(), body, 500);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.ok(t.includes("The build failed and nothing was charged."));
    assert.match(t, /I couldn't write up this build's details just now\. What was recorded:/);
    assert.match(t, /Pictures made, in the pages, not published: “a loaf on the counter”/);
    assert.match(t, /Link partly used: b\.example/);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build-failed-unavailable.png") }); }
  } finally { await browser.close(); }
});

test("7: narration NEVER ATTEMPTED (the switch off) — a plain heading, never a claim that the writer failed", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...LOST, replyState: "not-attempted", replyWhy: "off" }, 410);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.match(t, /What was recorded about this build:/);
    assert.doesNotMatch(t, /couldn't write up/, "a writer that was never asked is said to have failed");
    assert.match(t, /Link used: a\.example/);
    assert.match(t, /Refund: 6 credits returned\./);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build-failed-not-attempted.png") }); }
  } finally { await browser.close(); }
});

test("7 CONTROL: an error response with no facts and no narration — only the fixed failure sentence, as before", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ok: false, error: "x", msg: "That didn't come together — nothing was charged." }, 500);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.ok(t.includes("That didn't come together — nothing was charged."));
    assert.doesNotMatch(t, /What was recorded|couldn't write up|Refund:/);
  } finally { await browser.close(); }
});

// ── THE EIGHTH BATCH: ordinary inline failures told, outages fixed, pictures by render ──

const DESIGN_STOP = { ok: false, stage: "design", cost: 0, msg: "CANNED DESIGNER SENTENCE", unusable: true,
  buildFacts: { failure: { kind: "design-unusable", cost: 0, short: false } } };

test("8: an ordinary inline failure on the ERROR branch, narrated — the model's account leads, the canned sentence is not shown, the cost label is", { skip: SKIP }, async () => {
  const told = "The designer didn't give me a plan I could build from, so nothing was built and nothing was charged.";
  const { page, browser, errors } = await openApp(newSite(), { ...DESIGN_STOP, reply: told, replySource: "model" }, 503);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.ok(t.includes("⚠️ " + told), "the model's account does not lead: " + t.slice(-600));
    assert.doesNotMatch(t, /CANNED DESIGNER SENTENCE/);
    assert.match(t, /Cost: nothing charged\./);
    assert.doesNotMatch(t, /builder is busy|temporarily unavailable/, "an ordinary stop was shown as an outage");
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build8-design-told.png") }); }
    assert.deepEqual(errors.filter((e) => !/localStorage/.test(e)), []);
  } finally { await browser.close(); }
});

test("8: the same stop with the writer UNAVAILABLE — a plain state line, the outage note and the recorded labels; still no canned explanation", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...DESIGN_STOP, replyState: "unavailable", replyWhy: "send" }, 503);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.match(t, /The build didn’t finish\./);
    assert.match(t, /I couldn't write up this build's details just now/);
    assert.match(t, /Build stopped: the designer’s plan was unusable/);
    assert.match(t, /Cost: nothing charged\./);
    assert.doesNotMatch(t, /CANNED DESIGNER SENTENCE/);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build8-design-unavailable.png") }); }
  } finally { await browser.close(); }
});

test("8: an ordinary stop on the SUCCESS branch (a placeholder build, 200) — told the same way, not as a built site", { skip: SKIP }, async () => {
  const told = "I couldn't write the pages this time; your site shows a simple placeholder for now. Send it again to retry.";
  const body = { ok: true, slug: "harbour-loaf", url: "/s/harbour-loaf/", page: "placeholder", cost: 12, notes: "CANNED PAGES SENTENCE", reply: told, replySource: "model",
    buildFacts: { failure: { kind: "generate-failed", cost: 12, short: false } } };
  const { page, browser } = await openApp(newSite(), body, 200);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.ok(t.includes("⚠️ " + told), t.slice(-600));
    assert.doesNotMatch(t, /CANNED PAGES SENTENCE|✅ Built/);
    assert.match(t, /Cost: 12 credits\./);
  } finally { await browser.close(); }
});

test("8: a fixed REFUSAL (402) carrying a refund keeps its own sentence and shows the refund beside it", { skip: SKIP }, async () => {
  const body = { ok: false, error: "not enough credits", need: "credits", cost: 20, msg: "A build needs about 20 credits and you have 3.",
    settlement: { recovered: true, outcome: "not-published", refunded: 2, short: false } };
  const { page, browser } = await openApp(newSite(), body, 402);
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.match(t, /⚡ A build needs about 20 credits and you have 3\./);
    assert.match(t, /Refund: 2 credits returned\./);
  } finally { await browser.close(); }
});

test("8: the picture labels follow the same outcome the writer is told — shown, unconfirmed, not shown", { skip: SKIP }, async () => {
  const pictures = [
    { page: "/", describe: "the loaf", status: "made", stage: "published", url: "/u/1.jpg" },
    { page: "/", describe: "the ovens", status: "made", stage: "unconfirmed", url: "/u/2.jpg" },
    { page: "/", describe: "the queue", status: "made", stage: "not-shown", url: "/u/3.jpg" },
  ];
  const { page, browser } = await openApp(newSite(), { ...BUILT, buildFacts: { pictures }, replyState: "unavailable", replyWhy: "send" });
  try {
    await send(page, "Harbour Loaf.");
    await page.waitForTimeout(800);
    const t = await threadText(page);
    assert.match(t, /Pictures made and shown on a published page: “the loaf”/);
    assert.match(t, /Pictures made, in the published files, not confirmed on a page: “the ovens”/);
    assert.match(t, /Pictures made, in the files, not shown on any page: “the queue”/);
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "build8-picture-labels.png") }); }
  } finally { await browser.close(); }
});
