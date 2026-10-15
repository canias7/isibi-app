// THE COMPOSER AND THE FILES PANEL, IN A REAL BROWSER, OVER THE REAL ROUTES
// (2026-10-15, Codex's review of `7ca339d1`).
//
// The repo's own public/ — index.html, chat.js, site-media.js — in Chromium,
// with every request the media work makes (start, parts, complete, status,
// abort, the library's list, delete, and `/u/` serving) answered by the REAL
// Worker over R2 as the binding behaves, and everything else supplied. Small
// local fixtures (`test/fixtures/media/`) are chosen through the page's own
// file pickers. What it shows:
//   1. a video attached in the composer whose answer to `complete` is lost,
//      and whose status cannot be read for a while: the chip says it is being
//      checked — never "not uploaded" — and turns ready once the server can
//      be asked; nothing is aborted, one file is stored;
//   2. the message carries the file by name and address;
//   3. after a reload, the same file attached again is reused, not re-sent;
//   4. the Files panel lists it as a video, replaces it through Replace (same
//      address, one file), adds a recording through Add a file, and deletes it.
// Screenshots of the composer's states go to the scratch directory named by
// MEDIA_SHOTS, when set. Skipped where no browser is installed.
//
// WHAT THIS CANNOT SHOW: proprietary codecs (this Chromium has no H.264/AAC
// decoder, so the MP4/MOV/M4A/AAC fixtures are not played here — see
// `test/media-playback.test.mjs`), Safari and Firefox, and a real network.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const ORIGIN = "https://gofarther.test";
const SITE_ID = "site_1727000000000_media1";
const SLUG = "media-ui";
const fixture = (n) => readFileSync(new URL("./fixtures/media/" + n, import.meta.url));
const SHOTS = process.env.MEDIA_SHOTS || "";

/**
 * THE APP, OPEN ON THE SITE: the repo's own public/ served, every media request
 * answered by the real Worker (`gate` can lose the first answers to `complete`
 * and darken status), the rest supplied. Shared by both cases (2026-10-15).
 */
async function openApp(browser, { worker, env, seen, gate, site, onRouted = () => {} }) {
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 } });
  await ctx.addInitScript(({ site: s }) => {
    try { localStorage.length; } catch (e) { return; }
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    if (!localStorage.getItem("zephyr_sites_v1")) localStorage.setItem("zephyr_sites_v1", JSON.stringify([s]));
  }, { site });
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === SLUG + ".gofarther.app") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><h1>Media Bakery</h1>" });
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    const real = p.startsWith("/api/site/" + SLUG + "/media") || p.startsWith("/api/site/" + SLUG + "/uploads") || p.startsWith("/u/");
    if (real) {
      const kind = /\/complete$/.test(p) ? "complete" : req.method() === "GET" && /\/media\/[a-f0-9]{32}$/.test(p) ? "status" : req.method() === "PUT" ? "part" : req.method() === "DELETE" ? "delete" : req.method() + " " + p.split("/").slice(0, 5).join("/");
      seen.push(kind);
      if (kind === "status" && gate.darkStatus) return route.abort("connectionreset");
      const headers = {};
      for (const [k, v] of Object.entries(req.headers())) if (/^(authorization|content-type|range|if-none-match)$/.test(k)) headers[k] = v;
      const body = req.postDataBuffer();
      if (body) headers["content-length"] = String(body.length);
      const r = await worker.fetch(new Request("https://gofarther.dev" + p + url.search, { method: req.method(), headers, body: body && req.method() !== "GET" && req.method() !== "HEAD" ? body : undefined }), env, makeCtx());
      const buf = Buffer.from(await r.arrayBuffer());
      // THE ANSWER IS LOST AFTER THE SERVER HAS DONE THE WORK.
      if (kind === "complete" && gate.loseComplete > 0) { gate.loseComplete--; return route.abort("connectionreset"); }
      const out = {};
      r.headers.forEach((v, k) => { out[k] = v; });
      return route.fulfill({ status: r.status, headers: out, body: buf });
    }
    if (p.startsWith("/api/")) {
      if (p === "/api/site/route") { onRouted(req.postDataJSON()); return json(route, { ok: true, intent: "ask", answer: "Noted.", replyFrom: "router" }); }
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
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
  const chip = () => page.evaluate(() => [...document.querySelectorAll(".st-att-state")].map((e) => e.textContent));
  const attach = async (name, mimeType) => {
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#stPlus")]);
    // FROM DISK, as a file chooser gives it: the same file keeps its own
    // last-modified time, as it does when an owner picks it again.
    await chooser.setFiles(new URL("./fixtures/media/" + name, import.meta.url).pathname);
  };
  await page.goto(ORIGIN + "/projects/" + SITE_ID, { waitUntil: "load" });
  await page.waitForSelector("#stPlus", { timeout: 20000 });
  return { ctx, page, errors, chip, attach };
}

test("THE COMPOSER AND THE FILES PANEL: a lost answer is checked, not failed; a reload reuses; the panel lists, replaces, adds and deletes", { skip: SKIP, timeout: 180000 }, async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = envFor(store);
  const seen = [];
  let routed = null;
  const gate = { loseComplete: 1, darkStatus: true };
  const site = { id: SITE_ID, slug: SLUG, react: true, name: "Media Bakery", url: "https://" + SLUG + ".gofarther.app/", pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
  const media = () => [...store.store.keys()].filter((k) => k.startsWith("uploads/" + SLUG + "/"));

  await withWire({}, async () => {
    const browser = await chromium.launch({ executablePath: EXE });
    try {
      const { page, errors, chip, attach } = await openApp(browser, { worker, env, seen, gate, site, onRouted: (b) => { routed = b; } });

      // ── 1. THE ANSWER TO `complete` IS LOST, AND STATUS CANNOT BE READ ──
      await attach("clip.webm", "video/webm");
      await page.waitForFunction(() => [...document.querySelectorAll(".st-att-state")].some((e) => /checking it finished/.test(e.textContent)), null, { timeout: 30000 });
      assert.deepEqual(await chip(), ["Video · checking it finished…"], "an unconfirmed upload was not said as being checked");
      if (SHOTS) await page.locator(".st-att").first().screenshot({ path: path.join(SHOTS, "chip-checking.png") }).catch(() => {});
      assert.equal(media().length, 1, "the server's file is not there");
      assert.equal(seen.includes("delete"), false, "the page aborted an upload the server had saved");
      // THE CONNECTION COMES BACK: the chip's own check finds it ready.
      gate.darkStatus = false;
      await page.waitForFunction(() => [...document.querySelectorAll(".st-att-state")].some((e) => /ready/.test(e.textContent)), null, { timeout: 30000 });
      assert.deepEqual(await chip(), ["Video · ready"]);
      if (SHOTS) await page.locator(".st-att").first().screenshot({ path: path.join(SHOTS, "chip-ready.png") }).catch(() => {});
      assert.equal(seen.filter((k) => k === "part").length, 1, JSON.stringify(seen));
      assert.equal(media().length, 1, "a duplicate asset was made");
      const name = media()[0].split("/").pop();

      // ── 2. THE MESSAGE CARRIES IT BY NAME AND ADDRESS ──
      await page.fill("#stRevise", "Put this video on the home page");
      await page.click("#stSend");
      await page.waitForFunction(() => true);
      for (let i = 0; i < 100 && !routed; i++) await page.waitForTimeout(100);
      assert.ok(routed, "the message was never sent");
      assert.match(routed.message, new RegExp('\\[Attached video "clip\\.webm": /u/' + SLUG + "/" + name + "\\]"));

      // ── 3. RELOADED, THE SAME FILE ATTACHED AGAIN IS REUSED ──
      const partsBefore = seen.filter((k) => k === "part").length;
      const startsBefore = seen.filter((k) => /^POST .*\/media$/.test(k)).length;
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector("#stPlus", { timeout: 20000 });
      await attach("clip.webm", "video/webm");
      await page.waitForFunction(() => [...document.querySelectorAll(".st-att-state")].some((e) => /ready/.test(e.textContent)), null, { timeout: 30000 });
      assert.equal(seen.filter((k) => k === "part").length, partsBefore, "the same file was sent again after a reload");
      assert.equal(seen.filter((k) => /^POST .*\/media$/.test(k)).length, startsBefore, "a second upload was started");
      assert.equal(media().length, 1, "a duplicate asset was made");

      // ── 4. THE FILES PANEL ──
      await page.evaluate((id) => siteFiles(siteById(id)), SITE_ID);
      await page.waitForSelector(".fl-ismedia", { timeout: 20000 });
      const tiles = () => page.evaluate(() => [...document.querySelectorAll(".fl-item")].map((f) => ({ media: f.classList.contains("fl-ismedia"), video: !!f.querySelector("video"), audio: !!f.querySelector("audio"), use: !!f.querySelector(".fl-use"), rep: !!f.querySelector(".fl-rep") })));
      assert.deepEqual(await tiles(), [{ media: true, video: true, audio: false, use: true, rep: true }]);
      if (SHOTS) await page.locator("#flList").screenshot({ path: path.join(SHOTS, "panel-video.png") }).catch(() => {});
      // REPLACE: the same address, still one file.
      const completesBefore = store.calls.filter((c) => c === "complete").length;
      const [rep] = await Promise.all([page.waitForEvent("filechooser"), page.click(".fl-rep")]);
      await rep.setFiles({ name: "clip v2.webm", mimeType: "video/webm", buffer: fixture("clip.webm") });
      for (let i = 0; i < 200 && store.calls.filter((c) => c === "complete").length === completesBefore; i++) await page.waitForTimeout(100);
      assert.equal(store.calls.filter((c) => c === "complete").length, completesBefore + 1, "the replacement never finished");
      assert.deepEqual(media(), ["uploads/" + SLUG + "/" + name], "a replacement moved the file or made another");
      // ADD A RECORDING through the panel's own button.
      const [add] = await Promise.all([page.waitForEvent("filechooser"), page.click("#flAdd")]);
      await add.setFiles({ name: "tone.mp3", mimeType: "audio/mpeg", buffer: fixture("tone.mp3") });
      await page.waitForFunction(() => document.querySelectorAll(".fl-ismedia").length === 2, null, { timeout: 30000 });
      assert.equal(media().length, 2);
      // DELETE IT: the × on its tile.
      const audioName = media().find((k) => k.endsWith(".mp3")).split("/").pop();
      await page.click('.fl-del[data-file="' + audioName + '"]');
      await page.waitForFunction(() => document.querySelectorAll(".fl-ismedia").length === 1, null, { timeout: 30000 });
      assert.deepEqual(media(), ["uploads/" + SLUG + "/" + name], "the recording was not deleted, or the video went with it");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
});

test("REATTACHED AFTER A DELETE OR A REPLACEMENT: the composer sends the file again as its own — never the deleted file, never the replacement's bytes — and reuses it when nothing changed", { skip: SKIP, timeout: 180000 }, async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = envFor(store);
  const seen = [];
  let routed = null;
  const gate = { loseComplete: 0, darkStatus: false };
  const site = { id: SITE_ID, slug: SLUG, react: true, name: "Media Bakery", url: "https://" + SLUG + ".gofarther.app/", pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now() };
  const media = () => [...store.store.keys()].filter((k) => k.startsWith("uploads/" + SLUG + "/")).map((k) => k.split("/").pop());
  const original = fixture("clip.webm");
  const parts = () => seen.filter((k) => k === "part").length;
  await withWire({}, async () => {
    const browser = await chromium.launch({ executablePath: EXE });
    try {
      const { page, errors, chip, attach } = await openApp(browser, { worker, env, seen, gate, site, onRouted: (b) => { routed = b; } });
      const ready = () => page.waitForFunction(() => { const c = [...document.querySelectorAll(".st-att-state")]; return c.length === 1 && /ready/.test(c[0].textContent); }, null, { timeout: 30000 });
      const clear = async () => { while (await page.locator("[data-media]").count()) await page.locator("[data-media]").first().click(); };

      await attach("clip.webm", "video/webm");
      await ready();
      const [n1] = media();
      // THE CONTROL: nothing changed, so attached again it is reused, not sent.
      await clear();
      const before = parts();
      await attach("clip.webm", "video/webm");
      await ready();
      assert.equal(parts(), before, "an unchanged file was sent again");
      assert.deepEqual(media(), [n1]);

      // DELETED in the library, then attached again: sent again, as a new file.
      await clear();
      assert.equal(await page.evaluate((u) => apiFetch(u, { method: "DELETE" }).then((r) => r.status), "/api/site/" + SLUG + "/uploads/" + n1), 200);
      assert.deepEqual(media(), []);
      await attach("clip.webm", "video/webm");
      await ready();
      assert.deepEqual(await chip(), ["Video · ready"]);
      assert.equal(parts(), before + 1, "a deleted file was reused instead of sent again");
      const [n2] = media();
      assert.notEqual(n2, n1);

      // REPLACED at its address with other bytes, by the page's own uploader…
      const newer = Buffer.concat([Buffer.from(original), Buffer.alloc(64, 7)]);
      const rep = await page.evaluate(async ({ slug, name, b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const f = new File([bytes], "clip v2.webm", { type: "video/webm", lastModified: 5 });
        const r = await SiteMedia.upload(f, { api: mediaApi(mediaBase(slug)), base: mediaBase(slug), store: mediaStore(), replace: name });
        return { ok: r.ok, name: r.file && r.file.name };
      }, { slug: SLUG, name: n2, b64: newer.toString("base64") });
      assert.deepEqual(rep, { ok: true, name: n2 });
      assert.deepEqual(Buffer.from(store.raw("uploads/" + SLUG + "/" + n2)), newer);
      // …THEN THE ORIGINAL ATTACHED AGAIN: its own bytes at a new address.
      await clear();
      const beforeOrig = parts();
      await attach("clip.webm", "video/webm");
      await ready();
      assert.ok(parts() > beforeOrig, "the replacement was reused for the original attachment");
      const n3 = media().find((n) => n !== n2);
      assert.ok(n3, "the original was not stored as its own file");
      assert.deepEqual(Buffer.from(store.raw("uploads/" + SLUG + "/" + n3)), Buffer.from(original), "the original attachment is not its own bytes");
      assert.deepEqual(Buffer.from(store.raw("uploads/" + SLUG + "/" + n2)), newer, "the replacement was touched");
      // AND THE MESSAGE NAMES THE ORIGINAL'S ADDRESS, not the replacement's.
      await page.fill("#stRevise", "Use this clip on the home page");
      await page.click("#stSend");
      for (let i = 0; i < 100 && !routed; i++) await page.waitForTimeout(100);
      assert.ok(routed, "the message was never sent");
      assert.match(routed.message, new RegExp("/u/" + SLUG + "/" + n3));
      assert.doesNotMatch(routed.message, new RegExp(n2 + "|" + n1));
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
});
