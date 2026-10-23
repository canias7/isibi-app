// THE PAGE AND THE SERVER TOGETHER, UNDER DRAFT-FIRST (2026-10-16, the
// frontend batch).
//
// The repo's own public/ in Chromium, and every request the work makes —
// routing a message, following its request, each job's answer, the draft's
// state, Publish, and the frame's own loads of the live address and of the
// draft's preview host — answered by the REAL Worker over the request-flow
// platform (`test/fixtures/request-flow.mjs`: the queue, `edit_jobs`, the
// ledger, R2, the dispatch stub). The node side delivers the queue and runs
// the sweep while the page polls, as the platform's own Cloudflare would.
// Model answers are supplied (no model call, no spending). What it shows:
//   DFU1 a change asked in the composer is saved as a draft: the card says
//        "Saved as a draft", the frame moves to the draft's preview host and
//        is served the draft's version, the bar says "Draft preview · not
//        published", and the live pointer, the live script and the live
//        address (`/s/<slug>/`, served the live version) do not move;
//   DFU2 a reload reads it back the same (the request listed and followed,
//        the frame on the draft);
//   DFU3 Publish in the panel publishes that revision (the real route), the
//        chip says Published and the frame is the live address again, now
//        served the published version.
// Screenshots go to the directory named by DRAFT_SHOTS, when set. Skipped
// where no browser is installed (unit CI): the same client functions run on
// CI in `test/draft-ui.test.mjs`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { platform, pump, tick, sendMessage, settle, T, TOKEN } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { DRAFT_KEY } from "../site-draft.mjs";

blockNetwork();

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";
const SHOTS = process.env.DRAFT_SHOTS || "";

const ORIGIN = "https://gofarther.dev";
const PICKER_KEY = "zephyr_build_picker_v1";
const SITE_ID = "site_1727000000000_draft1";
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));

function bakery() {
  const compiler = installCompiler();
  const P = platform({
    slug: "dfu-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], liveScripts: true,
    answers: {
      route: () => ROUTE_TEXT,
      // WHICHEVER LINE THE PAGE HOLDS NOW, moved on to the next.
      [T.text]: (args) => { const from = [TT_LATER, TT_TO, TT_FROM].find((l) => lineId(args, "visit.tsx", l) >= 0); const to = from === TT_FROM ? TT_TO : from === TT_TO ? TT_LATER : TT_TO; return { edits: [{ id: lineId(args, "visit.tsx", from), to }] }; },
    },
  });
  return { P, compiler };
}
const pointerOf = (P) => JSON.parse(bare(P.readObj("current/" + P.slug + ".json"))).version;
const draftOf = (P) => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };

/** One request from the page, answered by the real Worker inside the platform. */
async function forward(P, worker, req, url, host = "gofarther.dev") {
  const headers = { "content-type": req.headers()["content-type"] || "application/json" };
  // THE OWNER'S SIGN-IN, as the platform's stand-in knows it.
  if (url.pathname.startsWith("/api/")) headers.Authorization = TOKEN;
  const body = req.postData();
  return P.run(async () => {
    const ctx = makeCtx();
    const go = (async () => {
      const res = await worker.fetch(new Request("https://" + host + url.pathname + url.search, { method: req.method(), headers, body: body && !["GET", "HEAD"].includes(req.method()) ? body : undefined }), P.env, ctx);
      await Promise.allSettled(ctx.pending);
      const out = {};
      res.headers.forEach((v, k) => { out[k] = v; });
      return { status: res.status, headers: out, body: Buffer.from(await res.arrayBuffer()) };
    })();
    P.track(go);
    return go;
  });
}

/**
 * THE APP, OPEN ON THE SITE, OVER THE PLATFORM: the repo's own public/, every
 * request the work makes answered by the real Worker (`REAL`), the frame's
 * addresses too, and the node side delivering the queue and running the sweep
 * while the page polls. Answers what a case drives and reads.
 */
async function openApp(P, site) {
  const worker = await loadWorker();
  const frames = [];
  const gates = { draftFailures: 0, failedDraftReads: 0, draftReads: 0 };
  let driving = true;
  const driver = (async () => {
    while (driving) {
      if (P.queue.length) await pump(P);
      else await tick(P);
      await new Promise((r) => setTimeout(r, 250));
    }
  })();
  const browser = await chromium.launch({ executablePath: EXE });
  const close = async () => { await browser.close().catch(() => {}); driving = false; await driver; };
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 } });
  await ctx.addInitScript(({ site: s, KEY }) => {
    try { localStorage.length; } catch (e) { return; }
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    // THE MODEL THE PLATFORM'S SUPPLIED ANSWERS STAND IN FOR.
    localStorage.setItem(KEY, "sonnet");
    if (!localStorage.getItem("zephyr_sites_v1")) localStorage.setItem("zephyr_sites_v1", JSON.stringify([s]));
  }, { site, KEY: PICKER_KEY });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const REAL = [/^\/api\/site\/route$/, /^\/api\/site\/request\//, /^\/api\/site\/requests\//, /^\/api\/site\/edit\//, /^\/api\/site\/[a-z0-9-]+\/(draft|publish|question)$/];
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    // THE FRAME: the app's own `/s/<slug>/` (which sends the browser on to
    // the site's address), the site's address, and the draft's preview
    // host — every one the real Worker's.
    // A redirect fulfilled through the route is not followed by the frame
    // (measured), so the Worker's own redirect is followed here, to the
    // address it names, and that address is asked of the Worker too.
    let at = url;
    if (url.origin === ORIGIN && url.pathname.startsWith("/s/")) {
      const r = await forward(P, worker, req, url);
      frames.push({ host: "app", path: url.pathname, status: r.status, location: r.headers.location || "" });
      if (!(r.status === 301 && r.headers.location && new URL(r.headers.location).hostname === P.slug + ".gofarther.app")) return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
      at = new URL(r.headers.location);
    }
    const draftHost = at.hostname.startsWith(P.slug + "--draft-");
    if (draftHost || at.hostname === P.slug + ".gofarther.app") {
      const r = await forward(P, worker, req, at, at.hostname);
      const version = r.headers["x-site-version"] || "";
      frames.push({ host: draftHost ? "draft" : "live", path: at.pathname, status: r.status, version });
      // WHAT THE SCRIPT SERVED, SHOWN: the dispatch stub answers with its stamps, not a page.
      return route.fulfill({ status: r.status, contentType: "text/html", body: "<!doctype html><body style=\"font:16px system-ui;padding:24px\"><h1>" + (draftHost ? "Draft" : "Live") + " site</h1><p>version " + version + "</p></body>" });
    }
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (REAL.some((re) => re.test(p))) {
      // A READING OF THE DRAFT THAT FAILS, when a case asks for one (2026-10-16).
      if (/\/draft$/.test(p) && gates.draftFailures > 0) { gates.draftFailures--; gates.failedDraftReads++; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "unavailable" }) }); }
      if (/\/draft$/.test(p)) gates.draftReads++;
      const r = await forward(P, worker, req, url);
      return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
    }
    if (p.startsWith("/api/")) {
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48, draftFirst: true });
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      if (p.endsWith("/share")) return json(route, { share: "" });
      return json(route, { ok: true });
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
  page.on("dialog", (d) => d.accept());
  const frameSrc = () => page.evaluate(() => (document.getElementById("stFrame") || {}).src || "");
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); };
  await page.goto(ORIGIN + "/projects/" + site.id, { waitUntil: "load" });
  await page.waitForSelector("#stRevise", { timeout: 20000 });
  return { worker, page, frames, errors, frameSrc, shot, close, gates };
}

test("DFU1–DFU3 THE PAGE UNDER DRAFT-FIRST, OVER THE REAL ROUTES: a change saved as a draft shows in the frame from the draft's preview host while live stays put; a reload reads it back; Publish makes it live and the frame returns to the live address", { skip: SKIP, timeout: 240000 }, async () => {
  const { P, compiler } = bakery();
  let app = null;
  try {
    // PUBLISHED ONCE BEFORE THE SWITCH: the live site visitors use.
    {
      const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      await settle(P, r.key, { rounds: 20 });
    }
    const v0 = pointerOf(P);
    const live0 = P.liveScript();
    P.env.DRAFT_FIRST = "on";
    const site = { id: SITE_ID, slug: P.slug, react: true, name: "Harbour Loaf", url: "/s/" + P.slug + "/", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], active: "/visit", msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
    app = await openApp(P, site);
    const { worker, page, frames, errors, frameSrc, shot } = app;
    await page.waitForFunction(() => /\/s\//.test((document.getElementById("stFrame") || {}).src || ""), null, { timeout: 15000 });

    // DFU1 — THE CHANGE, ASKED IN THE COMPOSER.
    await page.fill("#stRevise", "Change our TikTok link on the Visit page to @harbourloafbakery.");
    await page.click("#stSend");
    await page.waitForFunction(() => [...document.querySelectorAll(".st-req-status")].some((e) => /Saved as a draft/.test(e.textContent)), null, { timeout: 90000 });
    await page.waitForFunction((slug) => ((document.getElementById("stFrame") || {}).src || "").includes(slug + "--draft-"), P.slug, { timeout: 30000 });
    await page.waitForFunction(() => /Draft preview/.test((document.querySelector(".st-frame-url") || {}).textContent || ""), null, { timeout: 30000 });
    const d1 = draftOf(P);
    assert.ok(d1 && d1.rev >= 1 && d1.version && d1.version !== v0, "no new draft revision: " + JSON.stringify(d1));
    assert.match(await frameSrc(), new RegExp("^https://" + P.slug + "--draft-" + d1.preview + "\\.gofarther\\.app/visit\\?v=\\d+$"));
    await page.waitForFunction(() => !/updating/.test((document.querySelector(".st-frame-url") || {}).textContent || ""), null, { timeout: 30000 });
    const draftLoad = frames.filter((f) => f.host === "draft").pop();
    assert.deepEqual([draftLoad && draftLoad.status, draftLoad && draftLoad.version], [200, d1.version], "the draft's preview host did not serve the draft: " + JSON.stringify(frames));
    // NOTHING LIVE MOVED.
    assert.equal(pointerOf(P), v0, "the live pointer moved before Publish");
    assert.equal(P.liveScript(), live0, "the live script moved before Publish");
    const liveNow = await forward(P, worker, { headers: () => ({}), postData: () => null, method: () => "GET" }, new URL("https://" + P.slug + ".gofarther.app/visit"), P.slug + ".gofarther.app");
    assert.equal(liveNow.headers["x-site-version"], v0, "the live address serves something other than the live version");
    const chip = await page.textContent("#stDraftState");
    assert.match(chip, /Saved · not published/);
    await shot("dfu1-draft-saved");

    // DFU2 — A RELOAD READS IT BACK.
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#stRevise", { timeout: 20000 });
    await page.waitForFunction((slug) => ((document.getElementById("stFrame") || {}).src || "").includes(slug + "--draft-"), P.slug, { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".st-req-status")].some((e) => /Saved as a draft/.test(e.textContent)), null, { timeout: 30000 });
    assert.equal(pointerOf(P), v0);
    await shot("dfu2-after-reload");

    // DFU3 — PUBLISH, IN THE PANEL.
    await page.click("#stPublish");
    await page.waitForSelector("#spPublishDraft:not([disabled])", { timeout: 15000 });
    await shot("dfu3-publish-panel");
    const livesBefore = frames.filter((f) => f.host === "live").length;
    const pubAnswer = page.waitForResponse((r) => r.url().endsWith("/publish"), { timeout: 30000 });
    await page.click("#spPublishDraft");
    const pa = await pubAnswer;
    const sent = JSON.parse(pa.request().postData() || "{}");
    assert.deepEqual([pa.status(), sent.revision, sent.version], [200, d1.rev, d1.version], "Publish did not name the revision the panel showed");
    await page.waitForFunction(() => /^Published$/.test((document.getElementById("stDraftState") || {}).textContent || ""), null, { timeout: 30000 });
    await page.waitForFunction(() => /\/s\//.test((document.getElementById("stFrame") || {}).src || ""), null, { timeout: 30000 });
    assert.equal(pointerOf(P), d1.version, "Publish did not make the draft's revision live");
    assert.equal(P.liveScript(), d1.version);
    await page.waitForFunction(() => !/Draft preview/.test((document.querySelector(".st-frame-url") || {}).textContent || ""), null, { timeout: 15000 });
    // THE APP'S ADDRESS SENDS THE FRAME ON TO THE SITE'S: waited for, by the loads the Worker answered.
    for (let i = 0; i < 100 && frames.filter((f) => f.host === "live").length <= livesBefore; i++) await new Promise((r) => setTimeout(r, 100));
    const liveLoad = frames.filter((f) => f.host === "live").pop() || {};
    assert.deepEqual([liveLoad.status, liveLoad.version], [200, d1.version], "the frame's live address is not served the published version: " + JSON.stringify(frames.slice(-3)));
    await shot("dfu3-published");
    assert.deepEqual(errors, [], "the page threw");
  } finally {
    if (app) await app.close();
    await P.settle();
    P.close(); compiler.uninstall();
  }
});

// ── DFU4: TWO PARTS, ONE WAITING ON THE OTHER, AND A QUESTION ON THE PAGE ────
const ADD = "add a gallery page";
const NEEDS = "Change the site description to mention our gallery page";
const Q = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
const GPAGE = (p, name) => ({ path: p, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });

test("DFU4 ONE MESSAGE, TWO PARTS, UNDER DRAFT-FIRST, ON THE PAGE: the part that needs the other says which part it waits for; the other asks, and the question answered on the page resumes it; both end saved as a draft, the live site untouched until Publish", { skip: SKIP, timeout: 240000 }, async () => {
  const compiler = installCompiler();
  const { writtenPage } = await import("./fixtures/addon-route.mjs");
  let descs = 0;
  const P = platform({
    slug: "dfu4-" + Math.random().toString(16).slice(2, 8), liveScripts: true,
    answers: {
      route: [
        // THE FIRST, BEFORE THE SWITCH: published, so there is a live site to keep untouched.
        { intent: "edit", layer: "look" },
        { intent: "edit", layer: "look", alsoAsked: [ADD], dependsOn: [{ change: 0, after: [1] }] },
        { intent: "clarify", question: Q },
        { intent: "addon", answered: true },
        { intent: "edit", layer: "look" },
      ],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: NEEDS }] }, "lane:description": () => (descs++ ? "Sourdough, and a gallery of our loaves." : "Sourdough from the harbour."),
      [T.adds]: { kinds: ["page"] }, "add:page": { page: [GPAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  });
  let app = null;
  try {
    // PUBLISHED ONCE, so there is a live site to keep untouched.
    {
      const r0 = await sendMessage(P, { message: NEEDS + "." });
      assert.equal(r0.status, 200, JSON.stringify(r0.body));
      const { rec } = await settle(P, r0.key, { rounds: 20 });
      assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts[0]));
    }
    P.env.DRAFT_FIRST = "on";
    const pointer0 = P.readObj("current/" + P.slug + ".json");
    assert.ok(pointer0, "the site was never published");
    const live0 = P.liveScript();
    const site = { id: "site_1727000000000_draft4", slug: P.slug, react: true, name: "Harbour Loaf", url: "/s/" + P.slug + "/", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
    app = await openApp(P, site);
    const { page, errors, shot } = app;
    // THE LAST CARD: the earlier request (before the switch) keeps its own above it.
    // A SPLIT MESSAGE IS ONE PARALLEL CARD (2026-10-23): each part's small label (`.st-par-tag`).
    const labels = () => page.evaluate(() => { const c = [...document.querySelectorAll(".st-par")].pop(); return c ? [...c.querySelectorAll(".st-par-tag")].map((e) => e.textContent) : []; });

    await page.fill("#stRevise", NEEDS + ", and " + ADD + ".");
    await page.click("#stSend");
    // THE WAITING PART NAMES THE PART IT WAITS FOR; THE OTHER ASKS.
    await page.waitForFunction(() => { const c = [...document.querySelectorAll(".st-par")].pop(); return !!c && [...c.querySelectorAll(".st-par-tag")].some((e) => e.textContent === "waiting for part 2"); }, null, { timeout: 60000 });
    await page.waitForSelector("[data-ask-pick]", { timeout: 60000 });
    assert.deepEqual(await labels(), ["waiting for part 2", "needs you"]);
    await shot("dfu4-waiting-and-question");
    // THE ANSWER, ON THE PAGE.
    await page.click("[data-ask-pick] >> text=Loaves");
    await page.click("[data-ask-go]");
    await page.waitForFunction(() => { const c = [...document.querySelectorAll(".st-par")].pop(); const l = c ? [...c.querySelectorAll(".st-par-tag")].map((e) => e.textContent) : []; return l.length === 2 && l.every((t) => t === "saved as draft"); }, null, { timeout: 120000 });
    assert.ok(P.pages().includes("gallery.tsx"), "the gallery was not made");
    // THE LIVE SITE DID NOT MOVE.
    assert.equal(P.readObj("current/" + P.slug + ".json"), pointer0, "the live pointer moved before Publish");
    assert.equal(P.liveScript(), live0, "the live script moved before Publish");
    await page.waitForFunction((slug) => ((document.getElementById("stFrame") || {}).src || "").includes(slug + "--draft-"), P.slug, { timeout: 30000 });
    await shot("dfu4-both-saved");
    assert.deepEqual(errors, [], "the page threw");
  } finally {
    if (app) await app.close();
    await P.settle();
    P.close(); compiler.uninstall();
  }
});

// ── DFU6: A REFUSED CLAIM, A FAILED READ AND A SECOND REVISION, FOLLOWED WITHOUT A RELOAD ──
test("DFU6 THE PAGE FOLLOWS THE PREVIEW TO READY ON ITS OWN — a second change whose preview claim is refused, the page's next reading of the draft failing: the page keeps reading on its backoff, the owner's read repairs the preview, and the frame is served the new revision — no reload, nothing live", { skip: SKIP, timeout: 240000 }, async () => {
  const { P, compiler } = bakery();
  let app = null;
  try {
    const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    await settle(P, r0.key, { rounds: 20 });
    const v0 = pointerOf(P);
    P.env.DRAFT_FIRST = "on";
    const site = { id: "site_1727000000000_draft6", slug: P.slug, react: true, name: "Harbour Loaf", url: "/s/" + P.slug + "/", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], active: "/visit", msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
    app = await openApp(P, site);
    const { page, frames, errors, shot, gates } = app;
    const draftLoads = () => frames.filter((f) => f.host === "draft");
    const settledBar = () => page.waitForFunction(() => { const t = (document.querySelector(".st-frame-url") || {}).textContent || ""; return /Draft preview/.test(t) && !/updating|checking|couldn/.test(t); }, null, { timeout: 60000 });
    // THE FIRST CHANGE: saved, its preview ready.
    await page.fill("#stRevise", "Change our TikTok link on the Visit page to @harbourloafbakery.");
    await page.click("#stSend");
    await page.waitForFunction((slug) => ((document.getElementById("stFrame") || {}).src || "").includes(slug + "--draft-"), P.slug, { timeout: 60000 });
    await settledBar();
    const v1 = draftOf(P).version;
    // THE SECOND: its claim refused (no upload), and the page's next reading of the draft fails.
    P.failPut((k) => k.startsWith("preview-claims/" + P.slug + "/"));
    gates.draftFailures = 1;
    const loadsBefore = draftLoads().length;
    await page.fill("#stRevise", "Change our TikTok link on the Visit page to @harbourloaf.");
    await page.click("#stSend");
    // FOLLOWED TO READY ON ITS OWN: the frame is served the second revision.
    let v2 = null;
    for (let i = 0; i < 900; i++) {
      const d = draftOf(P);
      if (d.version !== v1) v2 = d.version;
      if (v2 && draftLoads().slice(loadsBefore).some((f) => f.version === v2)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(v2, "the second change was not saved");
    assert.ok(draftLoads().slice(loadsBefore).some((f) => f.status === 200 && f.version === v2), "the frame was never served the second revision: " + JSON.stringify(draftLoads().slice(loadsBefore)));
    assert.equal(gates.failedDraftReads, 1, "the failed reading was not met");
    await settledBar();
    assert.equal(pointerOf(P), v0, "something went live without a click");
    await shot("dfu6-followed-to-ready");
    assert.deepEqual(errors, [], "the page threw");
  } finally {
    if (app) await app.close();
    await P.settle();
    P.close(); compiler.uninstall();
  }
});
