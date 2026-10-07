// THE PREVIEW FRAME, AND WHAT A LOOK AT IT BUILT UP, KEPT WHILE THE PAGE POLLS
// (2026-10-05, run 101).
//
// The owner: *"Preserve the preview iframe and its state during chat/progress
// polling while still showing actual published changes and updating progress;
// verify this through real browser behavior, including iframe identity, load
// counts and preserved scroll or form state."*
//
// Run 101's reopened tab asked for the same `?v=11` seventeen times in two
// minutes, once after each of the page's own readings of a running request:
// every reading drew the whole workspace, frame included, and a new frame
// loaded the site again. Here the repo's own public/ runs in a real Chromium,
// every server answer supplied, and the preview serves a long page with a form:
// it is scrolled and typed into, the page reads a running request again and
// again — its card moving from "Queued" to "In progress" — and then the
// request's jobs publish. What is measured, from the browser itself:
//   - the frame element's identity (a mark set on it survives, or does not);
//   - every load of the preview's address (from the browser's own requests);
//   - the frame's own scroll position and the words typed into its form;
//   - that the workspace really was drawn again meanwhile (the thread element
//     is replaced on every drawing), and that the card shows the progress;
//   - that the published changes load the frame at most once each, at a new
//     address every time, and that it ends on the newest — changes found
//     together loading it once (2026-10-07, `sitePreviewHold`).
// Three different sites: a bakery's home page, a teacher's site open on a
// page other than home, and a draft that has never been published (its frame
// is drawn from stored HTML, not from an address). And the two cases where a
// fresh frame is right: another site opened, the Code tab and back.
//
// IT NEEDS A BROWSER, and runs where one is installed: `playwright-core` at the
// root (`npm i --no-save`, the template's version) and Chromium. Unit CI has
// neither, so there it is skipped; `test/preview-keep.test.mjs` holds the same
// rules in source on CI.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const ORIGIN = "https://gofarther.test";

/**
 * A preview long enough to scroll, with a form to type into. `v` is the
 * address the page asked for; `published` is what the SERVER has published at
 * the moment it serves — tracked by the server alone (2026-10-07, Codex's
 * review: the content was checked against the count of reloads, so a frame
 * reloaded at the wrong moment, or not at all, could still pass).
 */
const previewPage = (title, v, published) => "<!doctype html><html><head><title>" + title + "</title></head><body style='margin:0'>" +
  "<h1 id='v'>" + title + " — version " + v + "</h1>" +
  "<p id='pub'>published " + published + "</p>" +
  "<div style='height:1600px;background:linear-gradient(#fff,#eee)'>a long page</div>" +
  "<form><label>Your name <input id='name' name='name'></label><label>A note <textarea id='note' name='note'></textarea></label></form>" +
  "<div style='height:1600px'>more page</div></body></html>";

/**
 * One page load of the app with one site open, everything a server says
 * supplied. `site` is the record the browser holds; `request` (react sites) is
 * a request another browser sent, read by its key: `phase()` is "working" or
 * "finished", and the page's readings of it are counted.
 */
async function openApp({ site, request = null, extraSites = [] }) {
  const frameLoads = [];
  let requestReads = 0;
  // HOW MANY PARTS HAVE PUBLISHED, IN ORDER — the server's own record of the
  // site's latest published version, which the preview serves (`published`).
  let done = 0;
  const view = () => {
    const all = request ? request.parts.length : 0;
    const parts = request.parts.map((p, i) => ({
      n: i, words: p.words, charged: 0, route: p.route || "text",
      ...(i < done
        ? { status: "done", ids: [p.job], jobs: [p.job] }
        // PROGRESS WITHOUT A PUBLISH: the next part queued, then in progress; the ones after it wait for it.
        : { status: i === done ? (requestReads < 3 && done === 0 ? "queued" : "started") : "blocked", ids: [], jobs: [] }),
    }));
    const ended = done >= all;
    return { key: request.key, state: ended ? "done" : "running", ended, stop: false, at: Date.now() - 60000, updatedAt: Date.now(), routedUnsaid: 0, parts };
  };
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1320, height: 860 } });
  await ctx.addInitScript(({ sites }) => {
    try { localStorage.length; } catch (e) { return; }
    localStorage.setItem("zephyr_session_v1", JSON.stringify({ access_token: "t", refresh_token: "r", expires_at: Date.now() + 3600 * 1000, user: { id: "u-1", email: "owner@example.com" } }));
    localStorage.setItem("zephyr_owner_v1", "u-1");
    if (!localStorage.getItem("zephyr_sites_v1")) localStorage.setItem("zephyr_sites_v1", JSON.stringify(sites));
  }, { sites: [site, ...extraSites] });
  const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
  const hostOf = (s) => (s.url ? new URL(s.url).hostname : "");
  const hosts = new Map([site, ...extraSites].filter((s) => s.url).map((s) => [hostOf(s), s]));
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (hosts.has(url.hostname)) {
      // EVERY LOAD OF A PREVIEW ADDRESS, as the browser asked for it.
      frameLoads.push({ host: url.hostname, path: url.pathname + url.search, at: Date.now() });
      const v = url.searchParams.get("v") || "?";
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: previewPage(hosts.get(url.hostname).name, v, done) });
    }
    if (url.origin !== ORIGIN) return json(route, {});
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      const slug = site.slug;
      if (request && p === "/api/site/requests/" + slug) return json(route, { ok: true, requests: [view()] });
      if (p.startsWith("/api/site/requests/")) return json(route, { ok: true, requests: [] });
      if (request && p === "/api/site/request/" + slug + "/" + request.key) { requestReads++; return json(route, { ok: true, request: view() }); }
      const at = request ? request.parts.findIndex((x) => p === "/api/site/edit/" + x.job) : -1;
      if (at >= 0) return at < done ? json(route, request.parts[at].answer, 200, { "x-gf-edit": "final" }) : json(route, { ok: true, status: "building" });
      if (p === "/api/site/routes") {
        const s = [site, ...extraSites].find((x) => x.slug === url.searchParams.get("slug"));
        return json(route, { ok: true, slug: url.searchParams.get("slug"), routes: s ? s.pages.map((x) => x.path) : ["/"] });
      }
      if (/^\/api\/site\/[^/]+\/question$/.test(p)) return json(route, { ok: true, question: null });
      if (p === "/api/site/list") return json(route, { ok: true, sites: [] });
      if (p === "/api/credits" || p === "/api/credits/balance") return json(route, { credits: 48 });
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
  await page.goto(ORIGIN + "/projects/" + site.id, { waitUntil: "load" });
  await page.waitForFunction(() => { const f = document.getElementById("stFrame"); return !!(f && f.getAttribute("src")); }, null, { timeout: 15000 });
  /** The preview's own document, wherever the frame now points. */
  const frame = async () => {
    for (const until = Date.now() + 15000; Date.now() < until;) {
      const handle = await page.$("#stFrame");
      const f = handle && (await handle.contentFrame());
      if (f) {
        const ready = await f.evaluate(() => !!document.getElementById("name")).catch(() => false);
        if (ready) return f;
      }
      await page.waitForTimeout(100);
    }
    throw new Error("the preview never showed its page");
  };
  return {
    page, ctx, browser, errors, frameLoads, frame,
    reads: () => requestReads,
    // THE NEXT PART PUBLISHES (or the first `n`): the server's latest published version moves on.
    publish: (n = done + 1) => { done = Math.min(n, request.parts.length); },
    published: () => done,
    close: () => browser.close(),
    // THE FRAME ELEMENT'S IDENTITY: a mark set on the element itself, which a new element would not carry.
    markFrame: (m) => page.evaluate((mm) => { document.getElementById("stFrame").__keep = mm; }, m),
    frameMark: () => page.evaluate(() => { const f = document.getElementById("stFrame"); return f ? (f.__keep || null) : "no frame"; }),
    // A DRAWING HAPPENED: the thread element is replaced by every one.
    markThread: () => page.evaluate(() => { document.getElementById("stThread").__drawn = 1; }),
    threadRedrawn: () => page.evaluate(() => { const t = document.getElementById("stThread"); return !!t && t.__drawn !== 1; }),
    thread: () => page.evaluate(() => (document.getElementById("stThread") || {}).textContent || ""),
    src: () => page.evaluate(() => { const f = document.getElementById("stFrame"); return f ? f.getAttribute("src") : null; }),
  };
}

/** Scroll the preview and type into its form; what the frame then holds. */
async function lookAround(app) {
  const f = await app.frame();
  // TYPED FIRST, SCROLLED LAST: typing scrolls the field into view, so the scroll set after it is the one held.
  await f.fill("#name", "Ada Lovelace");
  await f.fill("#note", "Two loaves on Saturday, please.");
  await f.evaluate(() => window.scrollTo(0, 900));
  return frameState(app);
}
async function frameState(app) {
  const f = await app.frame();
  return f.evaluate(() => ({
    scroll: Math.round(window.scrollY),
    name: document.getElementById("name").value,
    note: document.getElementById("note").value,
    version: document.getElementById("v").textContent,
    published: Number((document.getElementById("pub").textContent.match(/published (\d+)/) || [])[1]),
  }));
}
const waitFor = async (app, cond, ms, what) => {
  for (const until = Date.now() + ms; Date.now() < until;) { if (await cond()) return; await app.page.waitForTimeout(150); }
  throw new Error("timed out waiting for " + what);
};

/**
 * THE LOADS AFTER THE PUBLISHES: each at a newer address than the one before,
 * none repeated, at most one per published change, the last the frame's own.
 * ONE MOVE PER MOVE SINCE 2026-10-07: the address counts the preview's moves,
 * and changes a reading finds together are one move (`sitePreviewHold`), so
 * two published changes load the frame once or twice, never three times.
 */
function assertNewerEachTime(loads, at, published, src) {
  assert.ok(loads.length >= 1 && loads.length <= published, "loads after " + published + " published change(s): " + JSON.stringify(loads));
  const vs = loads.map((l) => { const u = new URL("https://x" + l); assert.equal(u.pathname, at, "a load left the picked page: " + l); return Number(u.searchParams.get("v")); });
  vs.forEach((v, i) => assert.ok(i === 0 ? v >= 1 : v > vs[i - 1], "a load did not move to a newer address: " + JSON.stringify(loads)));
  assert.equal(new URL(src).search, "?v=" + vs[vs.length - 1], "the last load is not the frame's address: " + JSON.stringify({ loads, src }));
}

const editAnswer = (changed, words) => ({
  ok: true, layer: "text", layers: ["text"], lanes: [], moved: [], changed: [words], files: 12, cost: 2, applied: 1, photos: 0,
  reply: "✅ " + words, replySource: "model",
});
const addonAnswer = (page, table) => ({
  ok: true, kinds: ["page", "table"], added: ["src/routes/" + page.slice(1) + ".tsx"], changed: [], tables: [table], cost: 9,
  reply: "✅ Your new page is up.", replySource: "model",
});

/**
 * THE CASE, for a published site: look around in the preview, let the page
 * read the running request until its card shows the progress, and check the
 * frame stayed — then let the jobs publish and check each loads once.
 */
async function watchAndPublish({ site, request, path: at = "/" }) {
  const app = await openApp({ site, request });
  try {
    const base = site.url.replace(/\/$/, "");
    const host = new URL(site.url).hostname;
    const loadsOf = () => app.frameLoads.filter((l) => l.host === host).map((l) => l.path);
    await app.frame();
    const start = await app.src();
    assert.equal(start, base + (at === "/" ? "/" : at) + "?v=0", "the frame did not open on the picked page");
    const looked = await lookAround(app);
    assert.deepEqual({ scroll: looked.scroll, name: looked.name }, { scroll: 900, name: "Ada Lovelace" }, "the look itself did not take");
    await app.markFrame("kept-1");
    await app.markThread();
    const loadsBefore = loadsOf().length;
    const readsBefore = app.reads();
    // THE POLLING: the page reads the request again and again; its card moves from Queued to In progress.
    await waitFor(app, async () => app.reads() >= readsBefore + 4 && /In progress/.test(await app.thread()), 40000, "four more readings and the card's progress");
    const during = {
      mark: await app.frameMark(),
      redrawn: await app.threadRedrawn(),
      loads: loadsOf().slice(loadsBefore),
      state: await frameState(app),
      card: (await app.thread()).match(/In progress|Waiting for another part/g) || [],
    };
    // THE PUBLISHES, ONE PART AT A TIME: the server's published version moves
    // on, the page reads it and moves the preview — and the frame's CONTENT is
    // checked against the server's own record of what is published, never
    // against how many times the frame loaded or what address it was given.
    const stages = [];
    let last = start;
    for (let k = 1; k <= request.parts.length; k++) {
      app.publish(k);
      const reply = String(request.parts[k - 1].answer.reply).replace(/^✅ /, "");
      await waitFor(app, async () => {
        const src = await app.src();
        return (await app.thread()).includes(reply) && src !== last && loadsOf().includes(new URL(src).pathname + new URL(src).search);
      }, 40000, "published change " + k + " to load");
      last = await app.src();
      await app.page.waitForTimeout(800);
      stages.push({ published: app.published(), src: await app.src(), state: await frameState(app), mark: await app.frameMark() });
    }
    await app.page.waitForTimeout(2500);
    const after = {
      mark: await app.frameMark(),
      loads: loadsOf().slice(loadsBefore),
      src: await app.src(),
      state: await frameState(app),
      published: app.published(),
      stages,
    };
    return { during, after, errors: app.errors, readsDuring: app.reads() - readsBefore };
  } finally {
    await app.close();
  }
}

test("KEEP 1 — a bakery's home page: the page reads its running request again and again, the card shows the progress, and the frame — the same element — is never loaded again, still scrolled and still holding what was typed; each published change then loads it once", { skip: SKIP, timeout: 150000 }, async () => {
  const site = {
    id: "site_1727000000000_keep01", slug: "keep-bakery-1", react: true, name: "Harbour Loaf", url: "https://keep-bakery-1.gofarther.app/",
    pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now(),
  };
  const request = {
    key: "keeprequestbakery0001",
    parts: [
      { words: "Change the Visit heading to 'Find us on the street'", job: "b1" + "0".repeat(30), answer: editAnswer(["visit.tsx"], "The Visit heading now reads “Find us on the street”.") },
      { words: "Add a Bake List page where people can join", job: "b2" + "0".repeat(30), route: "addon", answer: addonAnswer("/bake-list", "bake_list") },
    ],
  };
  const r = await watchAndPublish({ site, request });
  assert.deepEqual(r.errors, []);
  assert.ok(r.readsDuring >= 4, "the page did not keep reading the request");
  assert.equal(r.during.redrawn, true, "the workspace was never drawn again while the request was read — nothing was tested");
  assert.ok(r.during.card.includes("In progress"), "the card never showed the progress");
  assert.equal(r.during.mark, "kept-1", "a reading replaced the frame element");
  assert.deepEqual(r.during.loads, [], "the frame was loaded again while nothing was published");
  assert.equal(r.during.state.scroll, 900, "the preview's scroll was lost to a reading");
  assert.equal(r.during.state.name, "Ada Lovelace", "what was typed into the preview's form was lost to a reading");
  assert.equal(r.during.state.note, "Two loaves on Saturday, please.");
  assert.equal(r.during.state.published, 0, "the frame showed a version the server had not published");
  // EACH PUBLISHED CHANGE, ONE AT A TIME: one load, at a new address, in the
  // same element, SHOWING WHAT THE SERVER HAS PUBLISHED — its own record,
  // never the count of loads.
  assert.equal(r.after.stages.length, 2);
  r.after.stages.forEach((st, i) => {
    assert.equal(st.published, i + 1, "the server's record did not move on");
    assert.equal(st.state.published, st.published, "after published change " + (i + 1) + " the frame shows version " + st.state.published + " while the server has published " + st.published);
    assert.equal(st.mark, "kept-1", "a published change replaced the frame element rather than moving it");
  });
  assert.equal(r.after.mark, "kept-1", "a published change replaced the frame element rather than moving it");
  assertNewerEachTime(r.after.loads, "/", 2, r.after.src);
  assert.equal(r.after.loads.length, 2, "a published change loaded the frame more or less than once: " + JSON.stringify(r.after.loads));
  assert.equal(r.after.state.published, r.after.published, "the frame does not show the latest published version");
  assert.equal(r.after.state.name, "", "the frame did not load the new page");
});

test("KEEP 2 — a teacher's site open on a page other than home: the frame stays on that page through the readings, and the published change loads that same page once", { skip: SKIP, timeout: 150000 }, async () => {
  const site = {
    id: "site_1727000000000_keep02", slug: "keep-strings-2", react: true, name: "Fretwork Lessons", url: "https://keep-strings-2.gofarther.app/",
    pages: [{ path: "/", name: "Home" }, { path: "/lessons", name: "Lessons" }, { path: "/prices", name: "Prices" }], active: "/lessons",
    msgs: [], updatedAt: Date.now(), createdAt: Date.now(),
  };
  const request = {
    key: "keeprequeststrings002",
    parts: [{ words: "Change the Lessons heading to 'Guitar lessons for every level'", job: "c1" + "0".repeat(30), answer: editAnswer(["lessons.tsx"], "The Lessons heading now reads “Guitar lessons for every level”.") }],
  };
  const r = await watchAndPublish({ site, request, path: "/lessons" });
  assert.deepEqual(r.errors, []);
  assert.equal(r.during.redrawn, true);
  assert.equal(r.during.mark, "kept-1");
  assert.deepEqual(r.during.loads, []);
  assert.deepEqual([r.during.state.scroll, r.during.state.name], [900, "Ada Lovelace"]);
  assert.equal(r.during.state.published, 0);
  assertNewerEachTime(r.after.loads, "/lessons", 1, r.after.src);
  assert.equal(new URL(r.after.src).pathname, "/lessons", "the published change moved the frame off the picked page");
  assert.equal(r.after.mark, "kept-1");
  // THE CONTENT IS WHAT THE SERVER HAS PUBLISHED, on the page picked.
  assert.equal(r.after.stages[0].state.published, 1, "the frame does not show the published change");
  assert.equal(r.after.state.published, r.after.published);
});

test("KEEP 3 — a draft never published, drawn from stored HTML: repaints keep the frame and the page in it; Refresh still loads it afresh", { skip: SKIP, timeout: 90000 }, async () => {
  const html = previewPage("Willow Florist", "draft");
  const site = {
    id: "site_1727000000000_keep03", react: false, name: "Willow Florist",
    pages: [{ path: "/", name: "Home", html }], active: "/", msgs: [{ r: "u", t: "Make a florist's site" }, { r: "a", t: "Here is a first draft." }],
    updatedAt: Date.now(), createdAt: Date.now(),
  };
  const app = await openApp({ site });
  try {
    const first = await app.src();
    assert.match(first, /^blob:/, "a draft's frame is drawn from a blob of its stored page");
    const looked = await lookAround(app);
    assert.deepEqual([looked.scroll, looked.name], [900, "Ada Lovelace"]);
    await app.markFrame("draft-kept");
    await app.markThread();
    // CHAT ACTIVITY: the workspace drawn again, as every reply and every step of progress draws it.
    for (let i = 0; i < 5; i++) { await app.page.evaluate(() => renderSites()); await app.page.waitForTimeout(120); }
    assert.equal(await app.threadRedrawn(), true, "the workspace was not drawn again — nothing was tested");
    assert.equal(await app.frameMark(), "draft-kept", "a repaint replaced the draft's frame");
    assert.equal(await app.src(), first, "a repaint gave the draft's frame a new address");
    const kept = await frameState(app);
    assert.deepEqual([kept.scroll, kept.name, kept.note], [900, "Ada Lovelace", "Two loaves on Saturday, please."], "a repaint lost the look at the draft");
    // REFRESH: the one press that asks for the same draft again.
    await app.page.click("#stReload");
    await waitFor(app, async () => (await app.src()) !== first, 10000, "Refresh to load the draft again");
    const fresh = await frameState(app);
    assert.deepEqual([fresh.scroll, fresh.name], [0, ""], "Refresh did not load the draft afresh");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});

test("KEEP 4 — where a fresh frame is right it is still made: the Code tab and back, and another site opened", { skip: SKIP, timeout: 90000 }, async () => {
  const one = {
    id: "site_1727000000000_keep04", slug: "keep-cafe-4", react: true, name: "Corner Cafe", url: "https://keep-cafe-4.gofarther.app/",
    pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now(),
  };
  const two = {
    id: "site_1727000000000_keep05", slug: "keep-gym-5", react: true, name: "North Gym", url: "https://keep-gym-5.gofarther.app/",
    pages: [{ path: "/", name: "Home" }], msgs: [], updatedAt: Date.now(), createdAt: Date.now(),
  };
  const app = await openApp({ site: one, extraSites: [two] });
  try {
    await app.frame();
    await app.markFrame("cafe-frame");
    await app.page.click('[data-view="code"]');
    await app.page.waitForFunction(() => !document.getElementById("stFrame"), null, { timeout: 10000 });
    await app.page.click('[data-view="preview"]');
    await app.page.waitForFunction(() => !!document.getElementById("stFrame"), null, { timeout: 10000 });
    assert.equal(await app.frameMark(), null, "the preview came back on the old frame element");
    await app.frame();
    await app.markFrame("cafe-again");
    // ANOTHER SITE: its own frame, at its own address.
    await app.page.evaluate((id) => openProject(id), two.id);
    await app.page.waitForFunction((u) => { const f = document.getElementById("stFrame"); return !!(f && (f.getAttribute("src") || "").startsWith(u)); }, two.url, { timeout: 10000 });
    assert.equal(await app.frameMark(), null, "another site was shown in the first site's frame element");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.close();
  }
});
