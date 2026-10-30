// EVERY PROJECT ON THE SERVER FROM ITS FIRST SECOND (owner's decision, 2026-10-30).
//
//   1. Pressing send on the start screen creates the project ON THE SERVER, in
//      the owner's account, with its chat, before any building starts.
//   2. The projects page shows the SERVER's list; the browser keeps a copy only
//      to paint at once, and the server's answer replaces it.
//   3. No "only on this device" cards, no trimming that drops projects, no
//      local/server merge.
//   4. Deletes happen on the server; every device follows.
//
// A project is its chat (`chat/<uid>/<chat>.json`): the Worker's list route
// names every chat no site has claimed as a project not built yet. The Worker
// cases drive the real routes with Supabase's rows and the R2 bucket kept in
// memory (`fixtures/projects-server.mjs`). The browser cases run the real page
// (public/) in Chromium, two "devices" (two browser contexts, each with its own
// localStorage) talking to that same in-memory server through the real Worker;
// the build itself is answered with a failure here, so nothing is built and
// no model is called. They need a browser and are skipped where none is.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { projectsServer } from "./fixtures/projects-server.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const SiteList = createRequire(import.meta.url)("../public/site-list.js");

// ── WHICH RECORDS A DEVICE DROPS ────────────────────────────────────────────

test("a record is dropped as deleted elsewhere only on a complete answer, and only once confirmed before the list was asked", () => {
  const rows = [{ id: "site_1_kept", chat: "site_1_kept", slug: "" }, { id: "srv_live-1", slug: "live-1" }];
  const local = [
    { id: "site_1_kept", srv: true, srvAt: 1 },
    { id: "site_2_gone", srv: true, srvAt: 1 },
    { id: "site_3_new", srv: true, srvAt: 50 },
    { id: "site_4_unsaved" },
    { id: "site_5_old", slug: "live-1", srv: true, srvAt: 1 },
  ];
  assert.deepEqual(SiteList.deletedElsewhere(rows, local, true, 10), ["site_2_gone"]);
  assert.deepEqual(SiteList.deletedElsewhere(rows, local, false, 10), [], "an incomplete answer deleted a record");
  assert.deepEqual(SiteList.deletedElsewhere(null, local, true, 10), []);
});

const UID = "11111111-2222-3333-4444-555555555555";
const put = (srv, chat, body) => srv.call("/api/site/chat/" + chat, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseRev: 0, msgs: [], name: "New website", slug: "", ...body }) });
const list = async (srv) => { const r = await srv.call("/api/site/list"); assert.equal(r.status, 200, r.text); return r.json; };

// ── THE WORKER ──────────────────────────────────────────────────────────────

test("a project created before its build is listed at once, with its chat as its id", async () => {
  const srv = projectsServer({ uid: UID });
  const c = await put(srv, "site_100_abcde", { brief: "A bakery in Leeds" });
  assert.equal(c.status, 200, c.text);
  const l = await list(srv);
  assert.equal(l.complete, true);
  assert.deepEqual(l.sites.map((s) => [s.id, s.chat, s.slug, s.state]), [["site_100_abcde", "site_100_abcde", "", "unbuilt"]]);
  assert.equal(l.sites[0].brief, "A bakery in Leeds");
  // the facts ride on the object, so the list needs no read of the chat
  const meta = srv.bucket.store.get("chat/" + UID + "/site_100_abcde.json").meta;
  assert.equal(meta.slug, "");
  assert.equal(meta.brief, "A bakery in Leeds");
});

test("once its build claims a site, the project is that one row, not two", async () => {
  const srv = projectsServer({ uid: UID });
  await put(srv, "site_101_abcde", { brief: "cafe" });
  srv.rows.push({ slug: "cafe-1", uid: UID, chat: "site_101_abcde" });
  const l = await list(srv);
  assert.deepEqual(l.sites.map((s) => [s.id, s.slug, s.state]), [["site_101_abcde", "cafe-1", "built"]]);
});

test("a site built before chats were bound takes the newest chat naming it; older copies are not projects", async () => {
  const srv = projectsServer({ uid: UID });
  srv.rows.push({ slug: "old-1", uid: UID, chat: "" }, { slug: "plain-1", uid: UID, chat: "" });
  await put(srv, "site_200_aaaaa", { slug: "old-1" });
  await new Promise((r) => setTimeout(r, 5));
  await put(srv, "site_201_bbbbb", { slug: "old-1" });
  const l = await list(srv);
  const ids = Object.fromEntries(l.sites.map((s) => [s.slug, s.id]));
  assert.equal(ids["old-1"], "site_201_bbbbb");
  assert.equal(ids["plain-1"], "srv_plain-1");
  assert.equal(l.sites.length, 2, JSON.stringify(l.sites));
});

test("a chat naming an address no site holds is a deleted site's, and is not listed", async () => {
  const srv = projectsServer({ uid: UID });
  await put(srv, "site_300_ccccc", { slug: "gone-1" });
  const l = await list(srv);
  assert.deepEqual(l.sites, []);
  assert.equal(l.complete, true);
});

test("a chat written before the list facts existed is read once and listed", async () => {
  const srv = projectsServer({ uid: UID });
  await srv.bucket.put("chat/" + UID + "/site_400_ddddd.json", JSON.stringify({ v: 1, rev: 3, updatedAt: 7, name: "Old cafe", slug: "", msgs: [{ r: "u", t: "an old cafe" }] }));
  const l = await list(srv);
  assert.deepEqual(l.sites.map((s) => [s.id, s.state, s.brief, s.title]), [["site_400_ddddd", "unbuilt", "an old cafe", "Old cafe"]]);
});

test("a chat store that cannot be listed leaves the sites standing and says the answer is not complete", async () => {
  const srv = projectsServer({ uid: UID });
  srv.rows.push({ slug: "cafe-2", uid: UID, chat: "site_500_eeeee" });
  srv.bucket.failList = true;
  const l = await list(srv);
  assert.equal(l.complete, false, "an unread store must never read as every project listed");
  assert.deepEqual(l.sites.map((s) => s.slug), ["cafe-2"]);
});

test("a deleted project is gone from the list every device reads", async () => {
  const srv = projectsServer({ uid: UID });
  await put(srv, "site_600_fffff", {});
  assert.equal((await list(srv)).sites.length, 1);
  const d = await srv.call("/api/site/chat/site_600_fffff", { method: "DELETE" });
  assert.equal(d.status, 200);
  assert.deepEqual((await list(srv)).sites, []);
});

test("only the caller's own chats are listed", async () => {
  const srv = projectsServer({ uid: UID });
  await srv.bucket.put("chat/someone-else/site_700_ggggg.json", JSON.stringify({ v: 1, rev: 1, updatedAt: 1, name: "", slug: "", msgs: [] }));
  assert.deepEqual((await list(srv)).sites, []);
});

test("the list facts stay under R2's two kilobytes, whatever was typed", async () => {
  const { chatStoreApi } = await loadWorkerModule();
  const m = chatStoreApi.chatListMeta({ name: "\u{1F600}".repeat(500), slug: "a".repeat(200), brief: "\u{1F600}".repeat(900), updatedAt: 1, msgs: [{ r: "u", t: "\u{1F600}".repeat(900) }] });
  const bytes = Object.entries(m).reduce((n, [k, v]) => n + Buffer.byteLength(k) + Buffer.byteLength(v), 0);
  assert.ok(bytes <= 2048, bytes + " bytes");
});

// ── THE PAGE, IN A REAL BROWSER ─────────────────────────────────────────────

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";
const ORIGIN = "https://gofarther.test";
const SHOTS = process.env.GF_SHOTS || "";

/**
 * One device: a browser context with its own localStorage, signed in as UID,
 * whose /api/ requests are answered by the real Worker over `srv`. The build
 * is answered with a failure (`builds` records what the server held then).
 */
async function device(browser, srv, { seed = null, holdList = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const log = [];
  const builds = [];
  const errors = [];
  await ctx.addInitScript(({ uid, seed }) => {
    try { localStorage.length; } catch (e) { return; }
    if (!localStorage.getItem("zephyr_session_v1")) {
      localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: uid, email: "owner@example.com" } }));
      localStorage.setItem("zephyr_owner_v1", uid);
      for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, v);
    }
  }, { uid: UID, seed });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== ORIGIN) return route.fulfill({ status: 204, body: "" });
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      log.push(req.method() + " " + p);
      if (p === "/api/site/react-build" || p === "/api/site/build" || p.startsWith("/api/site/react-build")) {
        builds.push({ at: Date.now(), chats: [...srv.bucket.store.keys()], list: (await srv.call("/api/site/list")).json });
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "the build failed early (test)" }) });
      }
      if (p === "/api/site/list" && holdList) await holdList();
      if (p === "/api/site/list" || p.startsWith("/api/site/chat/")) {
        const r = await srv.call(p + url.search, { method: req.method(), headers: { "content-type": "application/json" }, body: ["GET", "HEAD"].includes(req.method()) ? undefined : req.postData() });
        return route.fulfill({ status: r.status, contentType: "application/json", body: r.text });
      }
      if (p === "/api/credits" || p === "/api/credits/balance") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ credits: 48 }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    const file = p === "/" || p.startsWith("/projects") ? "/index.html" : p;
    const fp = path.join(PUB, file);
    if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
    const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, log, builds, errors };
}
const cards = (page) => page.evaluate(() => [...document.querySelectorAll("#viewSites .st-card")].map((c) => ({ id: c.dataset.open, name: (c.querySelector(".st-card-name") || {}).textContent || "", sub: (c.querySelector(".st-card-meta .st-card-sub") || {}).textContent || "" })));
const waitCards = (page, pred, arg) => page.waitForFunction(pred, arg, { timeout: 20000 });
const shot = async (page, name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, name), fullPage: false }); };

test("BROWSER: send creates the project on the server before the build; a failed build stays listed; a second device sees it; a delete on one is followed by the other", { skip: SKIP, timeout: 120000 }, async () => {
  const srv = projectsServer({ uid: UID });
  srv.rows.push({ slug: "harbour-loaf", uid: UID, chat: "site_1_harbour", created_at: "2026-10-02T00:00:00Z" });
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const one = await device(browser, srv);
    await one.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await waitCards(one.page, () => document.querySelectorAll("#viewSites .st-card").length === 1);
    await one.page.fill("#stPrompt", "A flower shop in Bristol called Petal & Stem");
    await one.page.click("#stGen");
    await one.page.waitForFunction(() => true);
    for (let i = 0; i < 100 && !one.builds.length; i++) await one.page.waitForTimeout(100);
    assert.equal(one.builds.length, 1, "the build was never sent: " + one.log.join(", "));
    const b = one.builds[0];
    const made = b.chats.filter((k) => k !== "chat/" + UID + "/site_1_harbour.json");
    assert.equal(made.length, 1, "no project on the server when the build started: " + b.chats.join(", "));
    const id = made[0].slice(("chat/" + UID + "/").length, -5);
    assert.ok(b.list.sites.some((s) => s.id === id && s.state === "unbuilt"), "the list did not name the new project when the build started");
    assert.ok(one.log.indexOf("PUT /api/site/chat/" + id) < one.log.findIndex((l) => /react-build|\/build$/.test(l)), "the project was written after the build was asked for: " + one.log.join(", "));
    // the build failed early: back on the projects page, the project is listed
    await one.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await waitCards(one.page, (want) => [...document.querySelectorAll("#viewSites .st-card")].some((c) => c.dataset.open === want), id);
    const c1 = await cards(one.page);
    assert.deepEqual(c1.map((c) => c.id).sort(), [id, "site_1_harbour"].sort());
    assert.match(c1.find((c) => c.id === id).sub, /Not built yet/);
    assert.doesNotMatch(c1.map((c) => c.sub).join(" "), /only on this device/);
    await shot(one.page, "after-device-1.png");

    // A SECOND DEVICE, its localStorage empty: the same projects, the same ids.
    const two = await device(browser, srv);
    await two.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await waitCards(two.page, () => document.querySelectorAll("#viewSites .st-card").length === 2);
    assert.deepEqual((await cards(two.page)).map((c) => c.id).sort(), [id, "site_1_harbour"].sort());
    await shot(two.page, "after-device-2.png");
    // and it opens: the project's own chat is read
    await two.page.click('#viewSites .st-card[data-open="' + id + '"]');
    await two.page.waitForFunction((want) => location.pathname === "/projects/" + want, id, { timeout: 10000 });
    assert.ok(two.log.includes("GET /api/site/chat/" + id), "the second device never read the project's chat");

    // DELETED ON THE SECOND DEVICE, on the server
    await two.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await waitCards(two.page, () => document.querySelectorAll("#viewSites .st-card").length === 2);
    await two.page.click('#viewSites .st-card-del[data-del="' + id + '"]');
    await two.page.click(".go-confirm-yes");
    await waitCards(two.page, () => document.querySelectorAll("#viewSites .st-card").length === 1);
    assert.ok(two.log.includes("DELETE /api/site/chat/" + id), "the delete never reached the server");
    assert.ok(!srv.bucket.store.has("chat/" + UID + "/" + id + ".json"));
    // …AND THE FIRST DEVICE FOLLOWS: the card goes, and so does its record there
    await one.page.reload({ waitUntil: "load" });
    await waitCards(one.page, (want) => ![...document.querySelectorAll("#viewSites .st-card")].some((c) => c.dataset.open === want) && document.querySelectorAll("#viewSites .st-card").length === 1, id);
    await one.page.waitForFunction((want) => !JSON.parse(localStorage.getItem("zephyr_sites_v1") || "[]").some((s) => s.id === want), id, { timeout: 10000 });
    assert.deepEqual(one.errors.concat(two.errors).filter((e) => !/ResizeObserver/.test(e)), []);
  } finally { await browser.close(); }
});

test("BROWSER: the cached list paints first and the server's answer replaces it whole", { skip: SKIP, timeout: 60000 }, async () => {
  const srv = projectsServer({ uid: UID });
  srv.rows.push({ slug: "now-real", uid: UID, chat: "site_2_nowreal" });
  let release;
  const held = new Promise((r) => { release = r; });
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const cached = [{ id: "site_3_cached", chat: "site_3_cached", slug: "cached-one", name: "cached-one", title: "Cached One", db: false, offline: false, createdAt: 1, updatedAt: 2 }];
    const d = await device(browser, srv, { seed: { ["gf_projects_v1:" + UID]: JSON.stringify(cached) }, holdList: () => held });
    await d.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await waitCards(d.page, () => document.querySelectorAll("#viewSites .st-card").length === 1);
    assert.deepEqual((await cards(d.page)).map((c) => c.id), ["site_3_cached"], "the cached copy did not paint first");
    release();
    await waitCards(d.page, () => { const c = [...document.querySelectorAll("#viewSites .st-card")]; return c.length === 1 && c[0].dataset.open === "site_2_nowreal"; });
    const kept = await d.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), "gf_projects_v1:" + UID);
    assert.deepEqual(kept.map((r) => r.id), ["site_2_nowreal"], "the cache was not replaced by the server's answer");
  } finally { await browser.close(); }
});

test("BROWSER: an old local-only project is created on the server once, and an empty one stays labelled until deleted", { skip: SKIP, timeout: 60000 }, async () => {
  const srv = projectsServer({ uid: UID });
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const old = [
      { id: "site_9_oldcafe", name: "Old Cafe", msgs: [{ r: "u", t: "A cafe by the canal" }, { r: "a", t: "Building..." }], createdAt: 5, updatedAt: 5, html: "" },
      { id: "site_9_empty", name: "New website", msgs: [], createdAt: 4, updatedAt: 4, html: "" },
    ];
    const d = await device(browser, srv, { seed: { zephyr_sites_v1: JSON.stringify(old) } });
    await d.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await shot(d.page, "migration-before-save.png");
    for (let i = 0; i < 100 && !srv.bucket.store.has("chat/" + UID + "/site_9_oldcafe.json"); i++) await d.page.waitForTimeout(100);
    const saved = JSON.parse(srv.bucket.store.get("chat/" + UID + "/site_9_oldcafe.json").body);
    assert.equal(saved.msgs.length, 2, "the old thread was not kept");
    assert.ok(!srv.bucket.store.has("chat/" + UID + "/site_9_empty.json"), "an empty record was written as a project");
    await waitCards(d.page, () => { const c = [...document.querySelectorAll("#viewSites .st-card")]; return c.length === 2 && /Not built yet/.test(c.map((x) => x.textContent).join(" ")); });
    const c = await cards(d.page);
    assert.match(c.find((x) => x.id === "site_9_oldcafe").sub, /Not built yet/);
    assert.match(c.find((x) => x.id === "site_9_empty").sub, /Not saved to your account yet/);
    // a second device sees the saved one, and never the empty one
    const two = await device(browser, srv);
    await two.page.goto(ORIGIN + "/projects", { waitUntil: "load" });
    await waitCards(two.page, () => document.querySelectorAll("#viewSites .st-card").length === 1);
    assert.deepEqual((await cards(two.page)).map((x) => x.id), ["site_9_oldcafe"]);
    // the empty one is deleted on this device alone, with a confirmation
    await d.page.click('#viewSites .st-card-del[data-del="site_9_empty"]');
    await d.page.click(".go-confirm-yes");
    await waitCards(d.page, () => document.querySelectorAll("#viewSites .st-card").length === 1);
    assert.ok(!d.log.includes("DELETE /api/site/chat/site_9_empty"));
  } finally { await browser.close(); }
});
