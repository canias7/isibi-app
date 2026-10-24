// A FIRST BUILD'S MODEL-WRITTEN REPLY IS THE MESSAGE (2026-10-24), in a real
// Chromium with the real public/chat.js and every server answer supplied. Live
// on driftwood-and-daughters the reply writer's account went only into the
// note above the steps while the bubble said "Built “X”. Tell me what to
// change.". Now the bubble carries it, the note does not repeat it, a
// placeholder build keeps its own honest line, and with the writer
// unreachable the left-out and no-database facts are listed.
//
// Screenshots go to $REPLY_SHOTS when it is set.

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
const SHOTS = process.env.REPLY_SHOTS || "";
const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_bubl01";
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



// The last assistant message, split into its note and its own words (the
// bubble), each read from the rendered page.
const lastMsg = (page) => page.evaluate(() => {
  const ms = Array.from(document.querySelectorAll("#stThread .st-msg.a")).filter((m) => !m.hidden);
  const m = ms[ms.length - 1];
  if (!m) return { note: null, body: null };
  const note = m.querySelector(".st-note");
  const c = m.cloneNode(true);
  c.querySelectorAll(".st-note, ul, .st-acts, .st-why, details, button").forEach((x) => x.remove());
  document.body.appendChild(c); const body = c.innerText.trim(); c.remove();
  return { note: note ? note.innerText : "", body };
});
const shot = async (page, name) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

const TOLD = "Driftwood and Daughters is live with a home page, a menu and a visit page. The booking form you mentioned isn't in this first build; ask for it next.";
const BUILT = { ok: true, slug: "driftwood-and-daughters", url: "/s/driftwood-and-daughters/", page: "app", cost: 18, files: ["index.tsx"],
  tokensNote: "TOKENS NOTE STAYS", builtNote: "BUILT NOTE STAYS",
  buildFacts: { notBuilt: ["a booking form"], noDatabase: true } };

test("a finished first build: the model's reply is the bubble, not the fixed line, and the note does not repeat it", { skip: SKIP }, async () => {
  const { page, browser, errors } = await openApp(newSite(), { ...BUILT, reply: TOLD, replySource: "model" });
  try {
    await send(page, "Driftwood and Daughters, a seaside cafe");
    await page.waitForFunction((x) => document.getElementById("stThread").innerText.includes(x), TOLD, { timeout: 15000 }).catch(() => {});
    await shot(page, "model-reply.png");
    const m = await lastMsg(page);
    assert.ok(m.body && m.body.includes(TOLD), "the bubble lacks the model reply: " + m.body);
    assert.doesNotMatch(m.body, /Tell me what to change/);
    assert.ok(!m.note.includes(TOLD), "the note repeats the reply: " + m.note);
    assert.match(m.note, /TOKENS NOTE STAYS/);
    assert.match(m.note, /BUILT NOTE STAYS/);
    assert.deepEqual(errors.filter((e) => !/localStorage/.test(e)), []);
  } finally { await browser.close(); }
});

test("the model reply wins over the builder's own `notes` too", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...BUILT, notes: "BUILDER NOTES", reply: TOLD, replySource: "model" });
  try {
    await send(page, "Driftwood and Daughters, a seaside cafe");
    await page.waitForTimeout(800);
    const m = await lastMsg(page);
    assert.ok(m.body.includes(TOLD));
    assert.doesNotMatch(m.body, /BUILDER NOTES/);
  } finally { await browser.close(); }
});

test("a placeholder build never shows a success reply, even with a model reply on the answer", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...BUILT, page: "placeholder", reply: TOLD, replySource: "model" });
  try {
    await send(page, "Driftwood and Daughters, a seaside cafe");
    await page.waitForTimeout(800);
    const m = await lastMsg(page);
    assert.doesNotMatch(m.body, /is live with a home page/);
    assert.match(m.body, /didn’t finish building/);
  } finally { await browser.close(); }
});

test("with the writer unreachable: the fixed line stays the bubble and the note lists left-out and no-database facts", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...BUILT, replyState: "unavailable" });
  try {
    await send(page, "Driftwood and Daughters, a seaside cafe");
    await page.waitForTimeout(800);
    await shot(page, "writer-unavailable.png");
    const m = await lastMsg(page);
    assert.match(m.body, /Built .*Tell me what to change/);
    assert.match(m.note, /Asked for, not built yet \(ask for it next\): “a booking form”/);
    assert.match(m.note, /No database yet/);
  } finally { await browser.close(); }
});

test("CONTROL: no model reply and no facts: the builder's notes are the bubble, as before", { skip: SKIP }, async () => {
  const { page, browser } = await openApp(newSite(), { ...BUILT, buildFacts: undefined, notes: "BUILDER NOTES" });
  try {
    await send(page, "Driftwood and Daughters, a seaside cafe");
    await page.waitForTimeout(800);
    const m = await lastMsg(page);
    assert.match(m.body, /BUILDER NOTES/);
  } finally { await browser.close(); }
});
