// EVERYTHING SERVER (2026-10-30, owner: "EVERYTHING SERVER"): the chat, the
// media upload records and the start screen's settings follow the ACCOUNT, not
// the browser. Two "devices" — two fresh browser contexts, each with its own
// empty localStorage, signed in to the same account — run the repo's own
// public/ in a real Chromium, and every `/api/site/account-state` and
// `/api/site/chat/<id>` call is answered by THE REAL WORKER (worker.js's own
// routes, over one in-memory bucket the two devices share). Shown:
//   - what device A holds (a chat, builder/effort/kind, an upload record, the
//     credit gauge's mark) reaches the account, and device B opens on it;
//   - the account's chat replaces B's stale cached copy;
//   - a chat write the server refuses is said on the screen and written again,
//     never left in the browser alone;
//   - the pricing page has no countdown.
// Screenshots go to the directory named by ACCOUNT_SHOTS.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";
const SHOTS = process.env.ACCOUNT_SHOTS || "";
const W = await loadWorkerModule();

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_acct01";
const SLUG = "tidewater-books";
const UID = "u-acct-1";

function bucket() {
  const m = new Map(); let n = 0;
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { etag: v.etag, text: async () => v.body } : null; },
    async put(k, body, o = {}) {
      const cur = m.get(k), oi = o.onlyIf || {};
      if (oi.etagMatches && (!cur || cur.etag !== oi.etagMatches)) return null;
      if (oi.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n); m.set(k, { body: String(body), etag }); return { etag };
    },
    async delete(k) { m.delete(k); },
  };
}
const realFetch = globalThis.fetch;
const site = (msgs) => ({
  id: SITE_ID, slug: SLUG, react: true, name: "Tidewater Books", url: "https://" + SLUG + ".gofarther.app/",
  pages: [{ path: "/", name: "Home" }], msgs, updatedAt: 1727000000000, createdAt: 1727000000000,
});

/** One device: a fresh context whose storage holds only what `seed` says. */
async function device(browser, env, seed, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((sd) => {
    try { localStorage.length; } catch (e) { return; }
    if (localStorage.getItem("zephyr_session_v1")) return;
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: sd.uid, email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", sd.uid);
    for (const [k, v] of Object.entries(sd.seed)) localStorage.setItem(k, v);
  }, { uid: UID, seed });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const seen = [];
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><h1>Tidewater</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      // THE REAL WORKER for the account's own records.
      if (p === "/api/site/account-state" || /^\/api\/site\/chat\/[^/]+$/.test(p)) {
        seen.push(req.method() + " " + p);
        if (opts.failChatPuts && req.method() === "PUT" && p.startsWith("/api/site/chat/") && opts.failChatPuts.n > 0) { opts.failChatPuts.n--; return json(route, { error: "not saved" }, 503); }
        const r = await W.default.fetch(new Request(ORIGIN + p + url.search, { method: req.method(), headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, ...(req.postData() ? { body: req.postData() } : {}) }), env, { waitUntil() {}, passThroughOnException() {} });
        return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text() });
      }
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 150 });
      if (p.endsWith("/context")) return json(route, { ok: true, window: 500000, tokens: 1000, used: 0.01, compactAt: 0.8, model: "", parts: { fixed: 1000, summary: 0, conversation: 0 } });
      if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/"] });
      return json(route, { ok: true });
    }
    const file = p === "/" || p.startsWith("/projects") ? "/index.html" : p;
    const fp = path.join(PUB, file);
    if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
    const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
  });
  const page = await ctx.newPage();
  DBG = () => ({ seen, errors });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
  await page.waitForFunction(() => !!document.getElementById("stThread"), null, { timeout: 15000 });
  return { page, ctx, errors, seen };
}
let DBG = null;
const until = async (fn, ms = 15000, what = "condition") => {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error("timed out waiting for " + what + (DBG ? " " + JSON.stringify(DBG()) : "")); await new Promise((r) => setTimeout(r, 100)); }
};
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); };
const ls = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);

test("TWO DEVICES, ONE ACCOUNT — the chat, the upload records and the builder settings follow the account; the account's chat replaces a stale cache", { skip: SKIP, timeout: 120000 }, async () => {
  globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: UID }), { status: 200 }) : realFetch(u, o);
  const env = { SITES_BUCKET: bucket() };
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const media = JSON.stringify({ "fp-hero.mp4": { at: Date.now(), session: "sess_hero", base: "/api/site/" + SLUG + "/media", name: "hero.mp4" } });
    const msgsA = [{ r: "u", t: "A bookshop on the harbour, please." }, { r: "a", t: "Tidewater Books is up — the harbour photo leads." }];
    const A = await device(browser, env, {
      zephyr_sites_v1: JSON.stringify([site(msgsA)]),
      zephyr_build_picker_v1: "opus", zephyr_build_effort_v2: "low", zephyr_build_kind_v1: "ios",
      "gf-media-uploads": media, zephyr_cred_max_v1: "8000",
    });
    // A's records reach the account (the real Worker's store).
    const chatKey = "chat/" + UID + "/" + SITE_ID + ".json";
    await until(() => env.SITES_BUCKET.m.has(chatKey), 15000, "A's chat on the server");
    await until(() => {
      const o = env.SITES_BUCKET.m.get("acct/" + UID + ".json");
      if (!o) return false;
      const st = JSON.parse(o.body).state;
      return st.picker?.v === "opus" && st.effort?.v === "low" && st.kind?.v === "ios" && st.mediaUploads?.v === media && st.credMax?.v === "8000";
    }, 15000, "A's settings on the server");
    assert.deepEqual(JSON.parse(env.SITES_BUCKET.m.get(chatKey).body).msgs, msgsA);
    assert.deepEqual(A.errors, []);
    await A.ctx.close();

    // B: a fresh browser. Its only copy of the site is the list row, holding a
    // STALE cached chat: the account's answer replaces it.
    const B = await device(browser, env, { zephyr_sites_v1: JSON.stringify([site([{ r: "u", t: "stale words only this browser had cached" }])]) });
    await until(async () => (await B.page.textContent("#stThread")).includes("the harbour photo leads"), 15000, "B to show the account's chat");
    assert.ok(!(await B.page.textContent("#stThread")).includes("stale words"), "the cached copy was not replaced");
    assert.equal(await ls(B.page, "zephyr_build_picker_v1"), "opus");
    assert.equal(await ls(B.page, "zephyr_build_effort_v2"), "low");
    assert.equal(await ls(B.page, "zephyr_build_kind_v1"), "ios");
    assert.equal(await ls(B.page, "gf-media-uploads"), media, "the upload record is on the second device");
    assert.equal(await ls(B.page, "zephyr_cred_max_v1"), "8000", "the gauge's mark is the account's");
    // The gauge drawn against the account's mark: 150 of 8000, nearly empty.
    const off = await B.page.evaluate(() => { setCredits(150); const a = document.getElementById("credArc"); return a ? parseFloat(a.style.strokeDashoffset) : null; });
    assert.ok(off !== null && off > 36, "the gauge is not drawn against the account's mark: " + off);
    assert.equal(await ls(B.page, "zephyr_cred_max_v1"), "8000", "drawing the gauge here never lowered the account's mark");
    await shot(B.page, "device-b-opened.png");
    assert.deepEqual(B.errors, []);
    await B.ctx.close();
  } finally { await browser.close(); globalThis.fetch = realFetch; }
});

test("A CHAT WRITE THE SERVER REFUSES is said on the screen and written again, never kept only here", { skip: SKIP, timeout: 120000 }, async () => {
  globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: UID }), { status: 200 }) : realFetch(u, o);
  const env = { SITES_BUCKET: bucket() };
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const fail = { n: 1 };
    const msgs = [{ r: "u", t: "Kept on the account, eventually." }];
    const D = await device(browser, env, { zephyr_sites_v1: JSON.stringify([site(msgs)]) }, { failChatPuts: fail });
    const chatKey = "chat/" + UID + "/" + SITE_ID + ".json";
    await until(async () => /not saved to your account yet/.test((await D.page.textContent("#sbToast").catch(() => "")) || ""), 15000, "the not-saved notice");
    await shot(D.page, "chat-not-saved.png");
    assert.equal(fail.n, 0);
    assert.ok(!env.SITES_BUCKET.m.has(chatKey));
    await until(() => env.SITES_BUCKET.m.has(chatKey), 20000, "the retried write");
    assert.deepEqual(JSON.parse(env.SITES_BUCKET.m.get(chatKey).body).msgs, msgs);
    await until(async () => /Chat saved to your account/.test((await D.page.textContent("#sbToast").catch(() => "")) || ""), 5000, "the saved notice");
    assert.deepEqual(D.errors, []);
    await D.ctx.close();
  } finally { await browser.close(); globalThis.fetch = realFetch; }
});

test("THE PRICING PAGE HAS NO COUNTDOWN", { skip: SKIP, timeout: 60000 }, async () => {
  globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: UID }), { status: 200 }) : realFetch(u, o);
  const env = { SITES_BUCKET: bucket() };
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const P = await device(browser, env, { zephyr_sites_v1: JSON.stringify([site([])]) });
    await P.page.evaluate(() => openCredits(false));
    await P.page.waitForSelector(".up-overlay .up-h1", { timeout: 5000 });
    assert.equal(await P.page.$(".up-segs, .up-seg, #upcD, .up-promo-timer"), null, "the countdown is still drawn");
    assert.equal(await ls(P.page, "zephyr_offer_end_v1"), null, "an offer end date was stored");
    await shot(P.page, "pricing-no-countdown.png");
    await P.ctx.close();
  } finally { await browser.close(); globalThis.fetch = realFetch; }
});
