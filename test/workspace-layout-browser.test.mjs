// THE WORKSPACE LAYOUT (owner, 2026-11-01): "the projects are going to be on
// top. And there's going to be a conversations [bar] on the left that would
// have different agents there later." The repo's own public/ runs in a real
// Chromium with every server answer supplied and four projects: the strip sits
// above the toolbar with the open project marked, the /home card opens a
// project, the wheel scrolls the row sideways, the conversations bar lists one
// agent ("Sites agent", never a site) and closes and reopens, and the chat
// column closes and reopens.
//
// IT NEEDS A BROWSER: `playwright-core` at the root and Chromium. Skipped
// where there is none (unit CI).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUB = process.env.GF_PUB_DIR || new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";
const ORIGIN = "https://gofarther.test";

const mk = (i, slug, name) => ({ id: "site_17270000000" + i + "_wl", chat: "site_17270000000" + i + "_wl", slug, react: true, name, url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/", name: "Home" }], msgs: [{ r: "u", t: "Make " + name }, { r: "a", t: "Draft of " + name + "." }], updatedAt: Date.now() - i * 3600e3, createdAt: Date.now() - i * 3600e3 });
const SITES = [mk(1, "wl-bakery", "Harbour Loaf"), mk(2, "wl-florist", "Willow Florist"), mk(3, "wl-guitar", "Fretwork Guitar"), mk(4, "wl-cafe", "Oak and Ash"), mk(5, "wl-barber", "Sharp Barber")];

async function openApp({ width = 1440, height = 860, ls = {}, sites = SITES, start = "/projects/" + SITES[0].id } = {}) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addInitScript(({ sites, ls }) => {
    try { localStorage.length; } catch (e) { return; }
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600e3, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    if (!sessionStorage.getItem("wl")) { sessionStorage.setItem("wl", "1"); localStorage.setItem("zephyr_sites_v1", JSON.stringify(sites)); for (const k in ls) localStorage.setItem(k, ls[k]); }
  }, { sites, ls });
  const hosts = new Map(sites.map((s) => [s.slug + ".gofarther.app", s]));
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (hosts.has(url.hostname)) return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><h1>" + hosts.get(url.hostname).name + "</h1>" });
    if (url.origin !== ORIGIN) return json({});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      if (p === "/api/site/list") return json({ ok: true, complete: true, sites: sites.map((s) => ({ id: s.id, chat: s.id, slug: s.slug, name: s.slug, title: s.name, updatedAt: s.updatedAt, createdAt: s.createdAt })) });
      if (p === "/api/site/routes") return json({ ok: true, slug: url.searchParams.get("slug"), routes: ["/"] });
      if (p.startsWith("/api/site/requests/")) return json({ ok: true, requests: [] });
      if (/\/question$/.test(p)) return json({ ok: true, question: null });
      if (p.startsWith("/api/credits")) return json({ credits: 48 });
      return json({ ok: true });
    }
    const file = p === "/" || p.startsWith("/projects") || /^\/home(\/|$)/.test(p) ? "/index.html" : p;
    const fp = path.join(PUB, file);
    if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
    const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(ORIGIN + start, { waitUntil: "load" });
  await page.waitForSelector(start.includes("site_") ? ".st-topbar" : "#stPrompt", { timeout: 15000 });
  await page.waitForTimeout(800);
  return { page, errors, close: () => browser.close() };
}

test("WL 1 — the projects strip sits above the toolbar, open, with the open project marked and the /home cards in one row", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp({ ls: { gf_projects_strip_v1: "open" } });
  try {
    const r = await app.page.evaluate(() => {
      const strip = document.querySelector("#stProjects");
      const bar = document.querySelector(".st-topbar");
      const row = document.querySelector("#stProjRow");
      const open = row && row.querySelectorAll(".st-card.st-card-open");
      return {
        strip: !!strip, above: !!(strip && bar && strip.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1),
        tab: (document.querySelector("#stProjTab") || {}).textContent || "",
        cards: row ? row.querySelectorAll(".st-pair > .st-card").length : 0,
        openCount: open ? open.length : 0,
        openId: open && open[0] ? open[0].dataset.open : "",
        badge: open && open[0] ? (open[0].querySelector(".st-card-badge") || {}).textContent : "",
        border: open && open[0] ? getComputedStyle(open[0]).borderTopWidth : "",
        badgeOffThumb: open && open[0] ? open[0].querySelector(".st-card-badge").getBoundingClientRect().top >= open[0].querySelector(".st-card-prev").getBoundingClientRect().bottom : false,
        oneRow: row ? new Set([...row.querySelectorAll(".st-pair")].map((p) => Math.round(p.getBoundingClientRect().top))).size : 0,
        sameWidth: row && row.querySelector(".st-pair") ? Math.round(row.querySelector(".st-pair").getBoundingClientRect().width) : 0,
      };
    });
    assert.ok(r.strip && r.above, "the strip is above the toolbar");
    assert.match(r.tab, /Harbour Loaf/); assert.match(r.tab, /5 projects/);
    assert.equal(r.cards, 5);
    assert.equal(r.openCount, 1); assert.equal(r.openId, SITES[0].id);
    assert.equal(r.badge, "Open"); assert.equal(r.border, "3px");
    assert.equal(r.badgeOffThumb, true, "the Open mark covers the thumbnail");
    assert.equal(r.oneRow, 1);
    assert.equal(r.sameWidth, 349);
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test("WL 2 — clicking a card in the row opens that project and closes the row; the tab toggles it and is remembered", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp({ ls: { gf_projects_strip_v1: "open" } });
  try {
    await app.page.click('#stProjRow .st-card[data-open="' + SITES[2].id + '"] .st-card-meta');
    await app.page.waitForFunction((id) => location.pathname === "/home/projects/" + id, SITES[2].id, { timeout: 5000 });
    const after = await app.page.evaluate(() => ({ hidden: document.querySelector("#stProjRow").hidden, name: document.querySelector(".st-ws-name").textContent, pref: localStorage.getItem("gf_projects_strip_v1") }));
    assert.equal(after.hidden, true); assert.equal(after.name, "Fretwork Guitar"); assert.equal(after.pref, "closed");
    await app.page.click("#stProjTab");
    const mark = await app.page.evaluate(() => ({ hidden: document.querySelector("#stProjRow").hidden, open: (document.querySelector("#stProjRow .st-card-open") || {}).dataset?.open, pref: localStorage.getItem("gf_projects_strip_v1") }));
    assert.equal(mark.hidden, false); assert.equal(mark.open, SITES[2].id); assert.equal(mark.pref, "open");
  } finally { await app.close(); }
});

test("WL 3 — the mouse wheel scrolls the row sideways, with no scrollbar showing", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp({ width: 1100, ls: { gf_projects_strip_v1: "open" } });
  try {
    const row = await app.page.$("#stProjRow");
    const box = await row.boundingBox();
    const before = await app.page.evaluate(() => { const r = document.querySelector("#stProjRow"); r.scrollLeft = 0; return { w: r.scrollWidth, c: r.clientWidth, sb: getComputedStyle(r).scrollbarWidth }; });
    assert.ok(before.w > before.c, "the row overflows");
    assert.equal(before.sb, "none");
    await app.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await app.page.mouse.wheel(0, 300);
    await app.page.waitForTimeout(300);
    const left = await app.page.evaluate(() => document.querySelector("#stProjRow").scrollLeft);
    assert.ok(left > 100, "scrollLeft moved: " + left);
  } finally { await app.close(); }
});

test("WL 4 — the conversations bar has exactly one entry, Sites agent, and closes and reopens (remembered)", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp();
  try {
    const items = await app.page.$$eval("#stConv .st-conv-item .st-conv-name", (l) => l.map((x) => x.textContent.trim()));
    assert.equal(await app.page.$$eval("#stConv .st-conv-item", (l) => l.length), 1);
    assert.deepEqual(items, ["Sites agent"]);
    // FAR LEFT, THE WHOLE PAGE'S HEIGHT (owner: "the conversations take the whole
    // entire page"): from the very top to the bottom, left of the strip, the
    // toolbar and the chat; the logo at its top; the top bar hidden beside it.
    const place = await app.page.evaluate(() => {
      const c = document.querySelector("#stConv").getBoundingClientRect();
      const strip = document.querySelector("#stProjects").getBoundingClientRect();
      const bar = document.querySelector(".st-topbar").getBoundingClientRect();
      const logo = document.querySelector("#gfConvLogo");
      return { top: c.top, bottom: innerHeight - c.bottom, left: c.left,
        leftOf: c.right <= Math.min(strip.left, bar.left, document.querySelector(".st-rail").getBoundingClientRect().left),
        logo: !!logo && logo.getBoundingClientRect().top < strip.top && logo.textContent.trim() === "Go Farther",
        topNav: getComputedStyle(document.querySelector("#topNav")).display };
    });
    assert.ok(place.top <= 1 && place.left <= 1, "the bar does not start at the page's top left: " + JSON.stringify(place));
    assert.ok(place.bottom <= 1, "the bar does not run to the bottom: " + JSON.stringify(place));
    assert.ok(place.leftOf, "the strip, the toolbar or the chat is not to the bar's right");
    assert.ok(place.logo, "the logo is not at the bar's top");
    assert.equal(place.topNav, "none", "the top bar still shows beside the bar");
    await app.page.click("#gfConvClose");
    let s = await app.page.evaluate(() => ({ closed: document.querySelector("#stConv").classList.contains("closed"), w: document.querySelector("#stConv").getBoundingClientRect().width, open: getComputedStyle(document.querySelector("#gfConvOpen")).display, pref: localStorage.getItem("gf_conv_bar_v1") }));
    assert.ok(s.closed && s.w < 60 && s.open !== "none"); assert.equal(s.pref, "closed");
    assert.ok(await app.page.evaluate(() => { const c = document.querySelector("#stConv").getBoundingClientRect(); return c.top <= 1 && innerHeight - c.bottom <= 1; }), "the closed strip does not run the whole height");
    await app.page.click("#gfConvOpen");
    s = await app.page.evaluate(() => ({ closed: document.querySelector("#stConv").classList.contains("closed"), w: document.querySelector("#stConv").getBoundingClientRect().width }));
    assert.ok(!s.closed && s.w > 150);
  } finally { await app.close(); }
});

test("WL 5 — the chat column closes and reopens; on a phone the bar is hidden and the strip starts collapsed", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp();
  try {
    const vis = () => app.page.evaluate(() => getComputedStyle(document.querySelector(".st-rail")).display !== "none");
    assert.equal(await vis(), true);
    await app.page.click("#stRailToggle");
    assert.equal(await vis(), false);
    await app.page.click("#stRailToggle");
    assert.equal(await vis(), true);
  } finally { await app.close(); }
  const phone = await openApp({ width: 390, height: 844 });
  try {
    const r = await phone.page.evaluate(() => ({ conv: getComputedStyle(document.querySelector("#stConv")).display, rowHidden: document.querySelector("#stProjRow").hidden }));
    assert.equal(r.conv, "none"); assert.equal(r.rowHidden, true);
  } finally { await phone.close(); }
});

test("WL 6 — a new account at /home: forwarded to /home/projects, the empty strip, one agent, the chat closed to its strip, today's box", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp({ sites: [], start: "/home" });
  try {
    const r = await app.page.evaluate(() => ({
      path: location.pathname,
      strip: (document.querySelector("#stProjects") || {}).textContent || "",
      agents: [...document.querySelectorAll("#stConv .st-conv-item")].map((x) => x.textContent.trim()),
      chatStrip: !!document.querySelector(".st-chatstrip"),
      rail: !!document.querySelector(".st-rail"),
      hero: (document.querySelector(".st-hero h1") || {}).textContent || "",
      grid: !!document.querySelector(".st-grid"),
      barTop: document.querySelector("#stConv").getBoundingClientRect().top,
      logo: (document.querySelector("#gfConvLogo") || {}).textContent || "",
    }));
    assert.ok(r.barTop <= 1, "the bar does not start at the page's top");
    assert.equal(r.logo.trim(), "Go Farther");
    assert.equal(r.path, "/home/projects");
    assert.match(r.strip, /No projects yet/); assert.match(r.strip, /Your sites will appear here/);
    assert.deepEqual(r.agents, ["Sites agentReady when you are"]);
    assert.equal(r.chatStrip, true); assert.equal(r.rail, false);
    assert.equal(r.hero, "What are we building?");
    assert.equal(r.grid, false, "sites are listed only in the strip");
    assert.deepEqual(app.errors, []);
  } finally { await app.close(); }
});

test("WL 7 — the first message moves the address to /home/projects/<the new site's id> and opens its chat", { skip: SKIP, timeout: 60000 }, async () => {
  const app = await openApp({ sites: [], start: "/home/projects" });
  try {
    await app.page.fill("#stPrompt", "A site for my bakery");
    await app.page.click("#stGen");
    await app.page.waitForFunction(() => /^\/home\/projects\/site_[0-9]+_[a-z0-9]+$/.test(location.pathname), null, { timeout: 5000 });
    await app.page.waitForSelector(".st-ws .st-rail", { timeout: 5000 });
    const r = await app.page.evaluate(() => ({ path: location.pathname, open: siteOpenId, user: (document.querySelector("#stThread") || {}).textContent || "" }));
    assert.equal(r.path, "/home/projects/" + r.open);
    assert.match(r.user, /bakery/);
  } finally { await app.close(); }
});
