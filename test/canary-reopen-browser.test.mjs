// THE CLOSED-TAB PREVIEW CHECK, PROVEN ON THE REAL PAGE (2026-10-05, run 101).
//
// The owner: *"Correct the closed-tab preview test to capture the reopened
// tab's own initial address before reconciliation and prove the test fails
// when reconciliation is disabled."*
//
// Run 101's shape, in a real Chromium on the repo's own public/, every server
// answer supplied, one browser holding the site's record across two tabs:
//   1. the first tab opens the site and its preview address is read (`?v=0`,
//      what the canary reads before a send) while the page's first look at the
//      site's requests is held back;
//   2. that look lands: an earlier request's finished job is reconciled and
//      the first tab moves its own preview (`?v=1`), as run 101's moved to
//      `?v=9`; a request still running is among them;
//   3. the first tab is closed while that request runs; it then finishes;
//   4. a second tab opens the site, at the address the first left stored.
// The second tab is given either the page as it is, or the page with its
// reconcile cut out (`siteReqRefresh`, which applies a job the page did not
// apply itself, made to do nothing) — served to that tab alone, so the first
// tab still moves its preview exactly as run 101's did. The canary's own
// `liveChecks` then judges message 1's preview against the second tab's own
// first address, read off the frame's loads as the canary reads it: passing
// with the reconcile, failing without it — where the baseline read before the
// send passes both.
//
// IT NEEDS A BROWSER, and runs where one is installed (`playwright-core` at the
// root and Chromium). Unit CI has neither, so there it is skipped; the same
// shape runs on CI through the stand-in app in `test/canary-requests.test.mjs`
// ("LV IN RUN 101'S SHAPE").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { liveChecks, previewVOf } from "../scripts/canary-requests.mjs";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const ORIGIN = "https://gofarther.test";
const SLUG = "reopen-bakery";
const SITE_ID = "site_1727000000000_reopen";
const SITE_URL = "https://" + SLUG + ".gofarther.app/";
const OLD_KEY = "earlierrequest0000001";
const KEY = "closedtabrequest00001";
const OLD_JOB = "e1" + "0".repeat(30);
const JOB = "e2" + "0".repeat(30);
const CHAT = readFileSync(path.join(PUB, "chat.js"), "utf8");
const RECONCILE = "function siteReqRefresh(origin, httpOk, body, addon) {";
assert.ok(CHAT.includes(RECONCILE), "the reconcile is gone from chat.js — this case would cut nothing");
const CHAT_CUT = CHAT.replace(RECONCILE, RECONCILE + " return;");

const edit = (words) => ({ ok: true, layer: "text", layers: ["text"], lanes: [], moved: [], changed: [words], files: 12, cost: 2, applied: 1, photos: 0, reply: "✅ " + words, replySource: "model" });
const part = (words, done, job) => ({ n: 0, words, route: "text", charged: 0, status: done ? "done" : "started", ids: [job], jobs: done ? [job] : [] });

async function run({ cutReconcile }) {
  const tabs = new Map();
  const frameLoads = [];
  let finished = false;
  let release;
  const held = new Promise((r) => { release = r; });
  let firstLook = true;
  const oldView = () => ({ key: OLD_KEY, state: "done", ended: true, stop: false, at: Date.now() - 3600000, updatedAt: Date.now() - 3500000, routedUnsaid: 0, parts: [part("Change the Order heading", true, OLD_JOB)] });
  const view = () => ({ key: KEY, state: finished ? "done" : "running", ended: finished, stop: false, at: Date.now() - 60000, updatedAt: Date.now(), routedUnsaid: 0, parts: [part("Change the Visit heading to 'Find us on the street'", finished, JOB)] });
  const site = { id: SITE_ID, slug: SLUG, react: true, name: "Harbour Loaf", url: SITE_URL, pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 } });
    await ctx.addInitScript(({ s }) => {
      try { localStorage.length; } catch (e) { return; }
      localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
      localStorage.setItem("zephyr_owner_v1", "u-1");
      if (!localStorage.getItem("zephyr_sites_v1")) localStorage.setItem("zephyr_sites_v1", JSON.stringify([s]));
    }, { s: site });
    const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    const tabOf = (req) => { try { return tabs.get(req.frame().page()) || 0; } catch { return 0; } };
    await ctx.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname === SLUG + ".gofarther.app") {
        // EVERY ADDRESS A PREVIEW FRAME ASKS FOR, by the tab that asked — the canary's own record.
        frameLoads.push({ tab: tabOf(req), path: url.pathname + url.search });
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Harbour Loaf</title><h1>Harbour Loaf " + url.search + "</h1>" });
      }
      if (url.origin !== ORIGIN) return json(route, {});
      const p = url.pathname;
      if (p.startsWith("/api/")) {
        if (p === "/api/site/requests/" + SLUG) {
          // THE FIRST TAB'S FIRST LOOK IS HELD until the address before the send has been read.
          if (firstLook) { firstLook = false; await held; }
          return json(route, { ok: true, requests: [oldView(), view()] });
        }
        if (p === "/api/site/request/" + SLUG + "/" + OLD_KEY) return json(route, { ok: true, request: oldView() });
        if (p === "/api/site/request/" + SLUG + "/" + KEY) return json(route, { ok: true, request: view() });
        if (p === "/api/site/edit/" + OLD_JOB) return json(route, edit("The Order heading now reads “Order a loaf”."), 200, { "x-gf-edit": "final" });
        if (p === "/api/site/edit/" + JOB) return finished ? json(route, edit("The Visit heading now reads “Find us on the street”."), 200, { "x-gf-edit": "final" }) : json(route, { ok: true, status: "building" });
        if (p === "/api/site/routes") return json(route, { ok: true, slug: SLUG, routes: ["/"] });
        if (p === "/api/site/" + SLUG + "/question") return json(route, { ok: true, question: null });
        if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
        if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
        return json(route, { ok: true });
      }
      const file = p === "/" || p.startsWith("/projects") ? "/index.html" : p;
      if (file === "/chat.js") {
        // THE RECONCILE CUT, FOR THE SECOND TAB ALONE.
        const body = cutReconcile && tabOf(req) === 2 ? CHAT_CUT : CHAT;
        return route.fulfill({ status: 200, contentType: "application/javascript", body });
      }
      const fp = path.join(PUB, file);
      if (!existsSync(fp)) return route.fulfill({ status: 404, body: "" });
      const ct = fp.endsWith(".js") ? "application/javascript" : fp.endsWith(".css") ? "text/css" : fp.endsWith(".html") ? "text/html" : fp.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: ct, body: readFileSync(fp) });
    });
    const src = (pg) => pg.evaluate(() => { const f = document.getElementById("stFrame"); return f ? f.getAttribute("src") : null; });
    const errors = [];
    // 1. THE FIRST TAB, its address read before the send.
    const one = await ctx.newPage();
    tabs.set(one, 1);
    one.on("pageerror", (e) => errors.push("tab 1: " + e));
    await one.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
    await one.waitForFunction(() => { const f = document.getElementById("stFrame"); return !!(f && f.getAttribute("src")); }, null, { timeout: 15000 });
    const typed = await src(one);
    // 2. ITS FIRST LOOK LANDS: the earlier request's job reconciled, the first tab's own preview moved.
    release();
    await one.waitForFunction((was) => { const f = document.getElementById("stFrame"); return !!f && f.getAttribute("src") !== was; }, typed, { timeout: 30000 });
    const movedTo = await src(one);
    // 3. CLOSED WHILE THE REQUEST RUNS; THEN IT FINISHES.
    await one.close();
    finished = true;
    // 4. THE TAB OPENED AFTERWARDS, in the same browser.
    const two = await ctx.newPage();
    tabs.set(two, 2);
    two.on("pageerror", (e) => errors.push("tab 2: " + e));
    await two.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
    await two.waitForFunction((k) => {
      const all = JSON.parse(localStorage.getItem("zephyr_sites_v1") || "[]");
      return !!(all[0] && all[0].requests && all[0].requests[k] && all[0].requests[k].closed);
    }, KEY, { timeout: 40000 });
    await two.waitForTimeout(1500);
    const done = await src(two);
    // THE REOPENED TAB'S OWN FIRST ADDRESS, as the canary captures it: the first its frame asked for.
    const first = frameLoads.find((f) => f.tab === 2);
    const step = {
      n: 1, sent: true, mode: "away", say: "Change the Visit heading", typed: { frame: typed }, view: { frame: done },
      away: { closed: true, ended: true, reopened: { ok: true, closed: true, why: "", frameTab: 2, firstFrame: first ? first.path : null } },
      otherReplies: [], replyWatch: { attributed: [] }, at: 0, thread: [], jobs: [JOB], network: [],
    };
    const checks = liveChecks({ steps: [step], tables: null, newPages: null, frameLoads }).filter((c) => /^message 1: (the preview was given|that tab's preview)/.test(c.name));
    return { typed, movedTo, done, first: first ? first.path : null, checks, frameLoads, errors };
  } finally {
    await browser.close();
  }
}

test("REOPEN 1 — run 101's shape on the real page: with the reconcile, the reopened tab moves past the address it opened at and both preview checks pass", { skip: SKIP, timeout: 120000 }, async () => {
  const r = await run({ cutReconcile: false });
  assert.deepEqual(r.errors, []);
  assert.equal(r.typed, SITE_URL + "?v=0", "the first tab did not start where a fresh browser starts");
  assert.equal(r.movedTo, SITE_URL + "?v=1", "the first tab did not move its own preview on its first look");
  assert.equal(r.first, "/?v=1", "the reopened tab did not open at the address the first tab left");
  assert.equal(r.done, SITE_URL + "?v=2", "the reopened tab did not reconcile the request that ended while it was closed");
  assert.equal(r.checks.length, 2);
  assert.deepEqual(r.checks.filter((c) => !c.ok).map((c) => c.name + " — " + c.why), []);
});

test("REOPEN 2 — the same, with the reconcile cut from the reopened tab: both preview checks fail; the baseline read before the send would have passed them", { skip: SKIP, timeout: 120000 }, async () => {
  const r = await run({ cutReconcile: true });
  assert.deepEqual(r.errors, []);
  assert.equal(r.movedTo, SITE_URL + "?v=1", "the first tab must still move its preview, as run 101's did");
  assert.equal(r.first, "/?v=1");
  assert.equal(r.done, SITE_URL + "?v=1", "the reopened tab moved with its reconcile cut — nothing was disabled");
  assert.deepEqual(r.checks.filter((c) => !c.ok).map((c) => c.name), [
    "message 1: the preview was given a newer address once it was done than the tab opened afterwards first showed",
    "message 1: that tab's preview loaded the newer address",
  ]);
  // THE OLD BASELINE ON THIS VERY RUN: the address before the send is older than the one shown, and that tab loaded it.
  assert.ok(previewVOf(r.done) > previewVOf(r.typed), "the old baseline would not have passed this run");
  assert.ok(r.frameLoads.some((f) => f.tab === 2 && f.path === "/?v=1"));
});
