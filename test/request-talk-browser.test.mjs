// A MESSAGE ON AN EXISTING SITE TALKS WHILE IT WORKS, ON A REAL PAGE
// (2026-11-02, request-talk). Every message on a site is a request; while its
// part's job runs, the request view names that job (`live`) and the page
// follows the job's talk (`/api/site/build/<job>/stream`) under the message:
// the lines so far, newest last, the sentence being written last — like a
// first build — until the job ends and the one reply takes their place. A
// reload follows it again. With no talk connection, the view's own lines for
// the running job are shown (the poll). A split's rows each show their own
// newest line. The server half is `test/request-talk.test.mjs`.
//
// The repo's own public/ in a real Chromium; every server answer supplied.
// The screenshot goes to RT_SHOT when set. Needs playwright-core and Chromium.
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
const SITE_ID = "site_1727000000000_rtalk01";
const SLUG = "copper-kettle-pottery";
const KA = "rtrequestkeyaaaa0001";
const J1 = "a".repeat(32);
const J2 = "b".repeat(32);
const J3 = "c".repeat(32);
const T0 = Date.now() - 60000;
const LINES = ["Read the home page and the shop page.", "Wrote the checkout step with Stripe.", "Built the site; it compiled cleanly."];
const REPLY = "Card payments are on: customers pay with Stripe at checkout.";

const part = (n, words, extra) => ({ n, words, status: "started", jobs: [], progress: [], ...extra });

async function open(S, browser) {
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
    msgs: [{ r: "u", t: S.words, req: KA, at: T0 }, { r: "a", t: "", request: KA }],
  } });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Copper Kettle</title><h1 style='font-family:serif'>Copper Kettle Pottery</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      const m = /^\/api\/site\/build\/([0-9a-f]{32})\/stream$/.exec(p);
      if (m) {
        S.streams.push(m[1]);
        const t = S.talk && S.talk[m[1]];
        if (!t) return json(route, { error: "not available" }, 404);
        return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": open\n\ndata: " + JSON.stringify({ lines: t.lines.map((text, n) => ({ n: n + 1, text })), live: t.live || "", closed: false }) + "\n\n" });
      }
      if (p === "/api/site/requests/" + SLUG) return json(route, { ok: true, requests: [S.view()] });
      if (p === "/api/site/request/" + SLUG + "/" + KA) return json(route, { ok: true, request: S.view() });
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
  return { page, errors };
}
const liveLines = (page) => page.$$eval("#stThread .st-req-live li", (els) => els.map((e) => [e.textContent.trim(), e.className]));

test("RTB1 one part: the job's live talk is drawn under the message as it comes, newest last, the sentence being written last; a reload follows it again; the reply replaces it", { skip: SKIP, timeout: 120000 }, async () => {
  const S = { words: "Take card payments with Stripe", ended: false, streams: [], talk: { [J1]: { lines: LINES.slice(0, 1), live: "" } } };
  S.view = () => S.ended
    ? { key: KA, state: "done", ended: true, stop: false, one: true, at: T0, updatedAt: Date.now(), reply: { text: REPLY, for: "end:1:0" }, parts: [{ n: 0, words: S.words, status: "done", jobs: [], progress: [] }] }
    : { key: KA, state: "running", ended: false, stop: false, one: true, at: T0, updatedAt: Date.now(), parts: [part(0, S.words, { live: J1 })] };
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const { page, errors } = await open(S, browser);
    await page.waitForFunction(() => document.querySelectorAll("#stThread .st-req-live li").length === 1, null, { timeout: 20000 });
    assert.deepEqual((await liveLines(page)).map((x) => x[0]), LINES.slice(0, 1));
    assert.equal(await page.$("#stThread .st-req-working"), null, "the bare working line is still drawn beside the steps");
    // THE NEXT TWO LINES, AND THE SENTENCE BEING WRITTEN, AS THEY COME.
    S.talk[J1] = { lines: LINES, live: "Checking the checkout page in a browser" };
    await page.waitForFunction(() => document.querySelectorAll("#stThread .st-req-live li").length === 4, null, { timeout: 20000 });
    const got = await liveLines(page);
    assert.deepEqual(got.map((x) => x[0]), [...LINES, "Checking the checkout page in a browser"], "not the lines, newest last, the sentence last");
    assert.equal(got[3][1], "live", "the sentence being written is not the live one");
    assert.ok(S.streams.every((j) => j === J1), "followed another job");
    if (process.env.RT_SHOT) await page.screenshot({ path: process.env.RT_SHOT });
    // A RELOAD MID-RUN FOLLOWS IT AGAIN.
    const before = S.streams.length;
    await page.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelectorAll("#stThread .st-req-live li").length === 4, null, { timeout: 20000 });
    assert.ok(S.streams.length > before, "the reload did not follow the job's talk again");
    // THE JOB ENDS: THE ONE REPLY TAKES THEIR PLACE.
    S.ended = true;
    await page.waitForFunction((t) => document.querySelector("#stThread").textContent.includes(t), REPLY, { timeout: 30000 });
    assert.equal(await page.$("#stThread .st-req-live"), null, "the live steps stayed after the reply");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("RTB2 a part resumed by an answer: only its running job's lines are drawn, from the view when there is no talk connection (the poll)", { skip: SKIP, timeout: 120000 }, async () => {
  const S = { words: "Take card payments", streams: [], talk: {} };
  // THE QUESTION'S JOB (J2) SAID ITS LINE BEFORE THE ANSWER; THE RESUMED JOB (J1) IS RUNNING.
  S.view = () => ({ key: KA, state: "running", ended: false, stop: false, one: true, at: T0, updatedAt: Date.now(), parts: [part(0, S.words, { answer: "Stripe (recommended)", live: J1, progress: [{ job: J2, n: 1, text: "Asked which payment service you use." }, { job: J1, n: 1, text: LINES[1] }] })] });
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const { page, errors } = await open(S, browser);
    await page.waitForFunction(() => document.querySelectorAll("#stThread .st-req-live li").length === 1, null, { timeout: 20000 });
    assert.deepEqual((await liveLines(page)).map((x) => x[0]), [LINES[1]]);
    assert.ok(S.streams.includes(J1), "the resumed job's talk was never asked for");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("RTB3 a split: each running row shows its own newest line", { skip: SKIP, timeout: 120000 }, async () => {
  const S = { words: "Add a gallery and a contact form", streams: [], talk: { [J2]: { lines: ["Read the home page.", "Wrote the /gallery page."] }, [J3]: { lines: ["Lined up changes to the contact table, saved at the end."] } } };
  S.view = () => ({ key: KA, state: "running", ended: false, stop: false, one: true, at: T0, updatedAt: Date.now(),
    // THE AGENT'S SPLIT: two parts handed out by part 0 (`parent`), each its own job.
    parts: [part(1, "Add a gallery", { live: J2, parent: 0 }), part(2, "Add a contact form", { live: J3, parent: 0 })] });
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const { page, errors } = await open(S, browser);
    // THE TASK BOX (two parts): opened, each row's line is its own job's newest.
    await page.waitForSelector('[data-bg="open"]', { timeout: 20000 });
    await page.click('[data-bg="open"]');
    const want = ["Wrote the /gallery page.", "Lined up changes to the contact table, saved at the end."];
    await page.waitForFunction((w) => { const t = [...document.querySelectorAll(".st-bg-row .st-bg-sub")].map((e) => e.textContent.trim()); return JSON.stringify(t) === JSON.stringify(w); }, want, { timeout: 20000 });
    if (process.env.RT_SHOT2) await page.screenshot({ path: process.env.RT_SHOT2 });
    // AND A ROW OPENED SHOWS ITS JOB'S EVERY LINE.
    await page.click('[data-bg-row="' + KA + '|1"]');
    await page.waitForFunction(() => document.querySelectorAll(".st-bg-jobview .st-bg-lines li").length === 2, null, { timeout: 10000 });
    assert.deepEqual(await page.$$eval(".st-bg-jobview .st-bg-lines li", (els) => els.map((e) => e.textContent.trim())), ["Read the home page.", "Wrote the /gallery page."]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
