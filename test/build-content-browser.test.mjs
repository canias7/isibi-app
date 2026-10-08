// THE COMPOSER KEEPS A FIRST BUILD'S WORDS WHOLE (2026-10-08, the content-
// preservation batch), in a real Chromium with every server answer supplied.
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
const SITE_ID = "site_1727000000000_cont01";
const words = (n, tail) => ("Harbour Loaf bakes overnight sourdough in Leeds and wants a page people can order from. ".repeat(Math.ceil(n / 80))).slice(0, n - tail.length) + tail;

async function openApp(site) {
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

test("a first build's message past the old 2,000 characters is sent whole", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp(newSite());
  try {
    const END = " — and a Saturday counter for collection.";
    const msg = words(5000, END);
    await send(page, msg);
    const route = posts.find((x) => x.path === "/api/site/route");
    assert.ok(route, "nothing was sent: " + posts.map((x) => x.path).join(","));
    assert.equal(route.body.message, msg, "the first build's message was cut before it was sent");
    assert.ok((await threadText(page)).includes("Saturday counter for collection"), "the thread shows a cut copy");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a first build's message past one message is not sent, is said with its numbers, and goes back in the box", { skip: SKIP }, async () => {
  const { page, browser, posts, errors } = await openApp(newSite());
  try {
    const msg = words(16001, ".");
    await send(page, msg);
    assert.deepEqual(posts.filter((x) => x.path === "/api/site/route" || x.path === "/api/site/react-build"), [], "a message past the policy was sent");
    const t = await threadText(page);
    assert.match(t, /16,001 characters, more than one message can hold \(16,000/);
    assert.equal(await page.evaluate(() => document.getElementById("stRevise").value), msg, "the words were not given back");
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "first-build-too-long.png") }); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a typed answer to a first-build question past the old 200 characters is sent whole", { skip: SKIP }, async () => {
  const site = newSite({
    clarify: { brief: "A sourdough bakery in Leeds.", qa: [], imgs: [] },
    msgs: [{ r: "u", t: "A sourdough bakery in Leeds." }, { r: "a", t: "What should people be able to do on the site?", q: "What should people be able to do on the site?", opts: ["Order loaves", "See opening hours"] }],
  });
  const { page, browser, posts, errors } = await openApp(site);
  try {
    const ANS = words(600, " — and pay at the door, never online.");
    await send(page, ANS);
    const route = posts.find((x) => x.path === "/api/site/route");
    assert.ok(route, "the answer was not sent: " + posts.map((x) => x.path).join(","));
    const qa = route.body.qa || [];
    assert.equal(qa.length, 1);
    assert.equal(qa[0].a, ANS, "the typed answer was cut before it was sent");
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "first-build-long-answer.png") }); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
