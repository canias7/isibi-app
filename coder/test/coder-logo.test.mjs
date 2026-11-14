// CODER'S LOGO, THE TYPEWRITER (the owner, 2026-11-14: "that will be the logo for Coder, but you're gonna make it. You're
// going to make it in code, not an image … Just a typewriter, like moving the keys and moving the tip, like, you know, like
// if it's actually typing"): drawn once in public/coder-logo.js, moved by public/coder-logo.css, and shown in Coder's tab on
// the left, its chat's bar and its empty chat. Still unless it types: while Coder works on a message, and one line on a
// hover or a click; never with reduced motion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PUB = new URL("../public/", import.meta.url).pathname;
const LINE_MS = Number(/const LINE_MS = (\d+);/.exec(read("public/coder-logo.js"))[1]);

/** coder-logo.js run on its own, with only what it needs of a page: a clock, timers and the logos it finds. */
function logoScript({ reduced = false } = {}) {
  const clock = { now: 0 }, timers = [], logos = [];
  const window = { matchMedia: () => ({ matches: reduced }) };
  const document = { addEventListener: () => {}, querySelectorAll: () => logos };
  vm.runInNewContext(read("public/coder-logo.js"), {
    window, document, performance: { now: () => clock.now },
    setTimeout: (fn, ms) => { timers.push({ fn, ms, on: true }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].on = false; },
  });
  /** A logo on the page: its classes (cls) and the CSS variables set on it (vars). */
  const logo = () => {
    const cls = new Set(["cl-logo"]), vars = {};
    const s = { cls, vars, classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)), contains: (c) => cls.has(c) }, style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } } };
    logos.push(s);
    return s;
  };
  return { window, clock, timers, logo };
}

/** The page (public/) in a real Chromium, signed in, with a fake Coder: one empty chat, which runs once a message is sent. */
async function openPage(browser, { reduced = false } = {}) {
  const ORIGIN = "https://gofarther.test";
  const at = Date.now();
  const st = { running: false, sent: 0 };
  const project = () => ({ id: "c1", title: "Fix the login button", repo: "ana/shop", base: "main", branch: "coder/c1", status: st.running ? "running" : "done", mode: "acceptEdits", turn: 1, at });
  const api = (method, p) => {
    if (method === "POST" && p === "/api/coder/projects/c1/message") { st.running = true; st.sent++; return { project: project() }; }
    return {
      "GET /api/coder/github": { connected: true, login: "ana" },
      "GET /api/coder/projects": { projects: [project()] },
      "GET /api/coder/projects/c1": { project: project(), events: [], queue: [] },
      "GET /api/coder/projects/c1/state": { running: st.running, events: [], next: 0, project: project() },
      "GET /api/coder/settings": { prefs: {} },
    }[method + " " + p] || {};
  };
  const AUTH = "window.Auth = { isSignedIn: () => true, accessToken: async () => 't', proof: () => 'p', email: () => 'ana@test.dev', end: () => {}, justEnded: () => false, refresh: async () => 't', signOut: async () => {}, signIn: async () => ({}), signUp: async () => ({}), verifyCode: async () => ({}) };";
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block", reducedMotion: reduced ? "reduce" : "no-preference" })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(ORIGIN + "/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/auth.js") return route.fulfill({ contentType: "text/javascript", body: AUTH });
    if (u.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(api(route.request().method(), u.pathname)) });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname);
    if (!file.startsWith(PUB) || !existsSync(file) || statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await page.route(/^(?!https:\/\/gofarther\.test).*/, (route) => route.abort());
  await page.goto(ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#gfApp .cd-cl-fig svg.cl-logo", { timeout: 15000 });
  /** Each logo on the page: where it is, its size, whether it types, and how far into its line (ms). */
  const logos = () => page.evaluate((LINE) => [...document.querySelectorAll("svg.cl-logo")].map((s) => {
    const r = s.getBoundingClientRect();
    const going = s.getAnimations({ subtree: true }).filter((a) => a.playState === "running");
    const car = going.find((a) => a.animationName === "clg-car");
    return { where: s.closest(".gf-tab") ? "tab" : s.closest(".cd-cl-av") ? "bar" : s.closest(".cd-cl-fig") ? "empty" : "?", w: Math.round(r.width), h: Math.round(r.height), run: s.classList.contains("cl-run"), moving: going.length, into: car ? car.effect.getComputedTiming().progress * LINE : null };
  }), LINE_MS);
  return { page, st, errors, logos };
}

test("TW1 (2026-11-14) Coder's tab on the left shows the typewriter, not the 💻 emoji: drawn into the tab by app.js, as Gloopy's figure is; no teal circle behind it; the page loads the logo's style, and its script before coder.js and app.js", () => {
  const html = read("public/index.html"), app = read("public/app.js"), css = read("public/app.css");
  assert.doesNotMatch(html, /&#x1F4BB;|💻/, "no laptop emoji");
  assert.match(html, /<button type="button" class="gf-tab" data-agent="coder" title="Coder" aria-label="Coder"><span class="gf-av gf-av-coder" id="gfTabCoder" aria-hidden="true"><\/span><\/button>/);
  assert.match(app, /\$\('gfTabGloopy'\)\.innerHTML = window\.gloopyHTML\(34\);\n[^\n]*\n\s+if \(window\.coderLogoHTML\) \$\('gfTabCoder'\)\.innerHTML = window\.coderLogoHTML\(34\);/);
  assert.match(css, /\.gf-av-coder \{ border-radius: 0; overflow: visible; \}/);
  assert.doesNotMatch(css, /\.gf-av-coder \{[^}]*background/, "no circle behind it");
  assert.equal(html.split('<link rel="stylesheet" href="/coder-logo.css" />').length, 2, "its style, once");
  // (Deferred scripts run in their order, so window.coderLogoHTML is there when coder.js and app.js draw.)
  const at = (f) => html.indexOf('<script src="' + f + '" defer></script>');
  assert.ok(at("/coder-logo.js") > 0 && at("/coder-logo.js") < at("/coder.js") && at("/coder.js") < at("/app.js"));
});

test("TW2 the typewriter is drawn once, in coder-logo.js (window.coderLogoHTML, as gloopy.js draws Gloopy), for Coder's tab (34 px), its chat's bar (26 px, after ☰, before the chat's name) and its empty chat (120 px); with no ids, so it can be on the page three times; still while Coder is not working", () => {
  const js = read("public/coder-logo.js"), ui = read("public/coder.js");
  assert.equal(js.match(/const DRAWING = \[/g).length, 1);
  for (const f of ["index.html", "app.js", "coder.js", "gloopy.js", "auth.js", "app.css", "coder.css", "gloopy.css"]) assert.doesNotMatch(read("public/" + f), /clg-/, f + " draws none of it itself");
  assert.match(ui, /const coderFig = \(h\) => \(typeof window\.coderLogoHTML === 'function' \? window\.coderLogoHTML\(h\) : ''\);/);
  assert.match(ui, /'<button type="button" class="cd-menu" id="cdMenu" aria-label="Chats">☰<\/button>' \+\n\s+'<span class="cd-cl-av" aria-hidden="true">' \+ coderFig\(26\) \+ '<\/span>' \+\n\s+\(p \? '<b class="cd-title-bar"/);
  assert.match(ui, /\(empty && !GLOOPY \? '<div class="cd-empty"><div class="cd-cl-fig" aria-hidden="true">' \+ coderFig\(120\) \+ '<\/div><b>What should we work on in '/);
  assert.equal(ui.match(/coderFig\(/g).length, 2, "in Coder's chat: its bar and its empty chat");
  const { window } = logoScript();
  const svg = window.coderLogoHTML(34);
  assert.match(svg, /^<svg class="cl-logo" viewBox="0 0 100 100" width="34" height="34" aria-hidden="true" focusable="false">/);
  assert.doesNotMatch(svg, /\sid="/, "no ids");
  // The paper and its lines, the roller and knobs, the return lever, the ribbon, the two type bars, the keys and the space bar.
  for (const part of ["clg-car", "clg-lever", "clg-feed", "clg-l2", "clg-l3", "clg-rb", "clg-bl", "clg-br", "clg-sp", "clg-k0", "clg-k10"]) assert.match(svg, new RegExp('class="' + part + '"'), part);
  assert.doesNotMatch(svg, /cl-run|style=/, "still");
  assert.match(window.coderLogoHTML(120), /width="120" height="120"/);
});

test("TW3 it moves only while it types (cl-run), only by transforms and opacity, every moving part on one line's clock; never with reduced motion, nor in a phone's closed side; only Coder's chat says Coder is working", () => {
  const css = read("public/coder-logo.css"), js = read("public/coder-logo.js"), ui = read("public/coder.js");
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const frames = new Map([...plain.matchAll(/@keyframes ([\w-]+)\{((?:[^{}]*\{[^{}]*\})*)\}/g)].map((m) => [m[1], m[2]]));
  const rest = plain.replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})*\}/g, "");
  const runs = [...rest.matchAll(/([^{}\n]+?)\s*\{\s*animation:\s*([^;}]+);\s*\}/g)].map((m) => ({ sel: m[1].trim(), value: m[2].trim() }));
  const drawing = /const DRAWING = \[([\s\S]*?)\]\.join\(''\);/.exec(js)[1];
  assert.ok(frames.size >= 10, "its moving parts");
  for (const [name, body] of frames) {
    const props = new Set([...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]));
    assert.deepEqual([...props].filter((p) => !["transform", "opacity", "animation-timing-function"].includes(p)), [], name + " moves only by transform and opacity");
    const r = runs.filter((x) => x.value.startsWith(name + " "));
    assert.equal(r.length, 1, name + " is played once");
    assert.equal(r[0].sel, ".cl-run ." + name, name + " plays only while it types");
    assert.equal(r[0].value, name + " var(--cl-t) linear var(--cl-d, 0ms) var(--cl-n, infinite)", name + " on the line's clock");
    assert.match(drawing, new RegExp('class="(clg-m )?' + name + '"'), name + " is a part of the drawing");
  }
  // Every other animation rule is the one that stops it.
  assert.deepEqual(runs.filter((x) => !frames.has(x.value.split(" ")[0])).map((x) => x.sel + " " + x.value), [".cl-logo * none !important"]);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.cl-logo \* \{ animation: none !important; \} \}/);
  assert.match(css, /@media \(max-width: 760px\) \{ body:not\(\.gf-side-open\) \.gf-rail \.cl-logo \* \{ animation-play-state: paused; \} \}/);
  assert.match(read("public/app.css"), /@media \(max-width: 760px\) \{\n\s+\.gf-sidewrap \{ position: fixed;[^}]*transform: translateX\(-100%\)/, "(that is when the side is off the screen)");
  assert.equal(Number(/--cl-t: (\d+)ms;/.exec(css)[1]), LINE_MS, "one line, as long in the script as in the style");
  assert.match(css, /\.cl-once \{ --cl-n: 1; \}/);
  assert.match(js, /const WHEN = \{ working: true, hover: true, click: true \};/, "when it types: easy to change");
  // Only Coder's view says whether Coder is working (Gloopy's chat never makes it type), each time it draws.
  assert.match(ui, /function draw\(scroll\) \{\n\s+const root = S\.root;\n\s+if \(!root \|\| !root\.isConnected\) return;\n\s+\/\/ CODER'S LOGO TYPES WHILE CODER WORKS[^\n]*\n\s+if \(!GLOOPY && window\.coderLogo\) window\.coderLogo\.busy\(S\.phase === 'chat' && S\.running\);/);
  assert.equal(ui.match(/coderLogo\.busy\(/g).length, 1);
});

test("TW4 while Coder works, a logo drawn again (the chat's bar is redrawn every 1.5 seconds) goes on where the others are; when Coder is done each finishes its line, then is still; with reduced motion it never types", () => {
  const { window, clock, timers, logo } = logoScript();
  const tab = logo();
  clock.now = 1000;
  window.coderLogo.busy(true);
  assert.ok(tab.cls.has("cl-run"), "the tab's logo types");
  assert.equal(tab.vars["--cl-d"], "-0ms", "from the start of a line");
  clock.now = 1600;
  assert.match(window.coderLogoHTML(26), /^<svg class="cl-logo cl-run" viewBox="0 0 100 100" width="26" height="26" style="--cl-d:-600ms"/, "the bar's, drawn again, 600 ms into the line too");
  clock.now = 1000 + LINE_MS + 200;
  assert.match(window.coderLogoHTML(26), /style="--cl-d:-200ms"/, "a line later: 200 ms into the next");
  window.coderLogo.busy(true);
  assert.equal(timers.length, 0, "(told again: nothing changes)");
  clock.now = 1000 + LINE_MS + 300;
  window.coderLogo.busy(false);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, LINE_MS - 300, "it stops at the end of its line");
  assert.ok(tab.cls.has("cl-run"), "and types till then");
  assert.match(window.coderLogoHTML(26), /cl-run/, "as does one drawn meanwhile");
  timers[0].fn();
  assert.ok(!tab.cls.has("cl-run") && !("--cl-d" in tab.vars), "then still");
  assert.doesNotMatch(window.coderLogoHTML(26), /cl-run|style=/);
  // Working again before its last line ends: it goes on, in step.
  clock.now = 10000;
  window.coderLogo.busy(true);
  clock.now = 10500;
  window.coderLogo.busy(false);
  window.coderLogo.busy(true);
  assert.equal(timers.at(-1).on, false, "the stop was called off");
  assert.ok(tab.cls.has("cl-run"));
  assert.match(window.coderLogoHTML(26), /style="--cl-d:-500ms"/);
  // Reduced motion: never.
  const r = logoScript({ reduced: true });
  const t2 = r.logo();
  r.window.coderLogo.busy(true);
  assert.ok(!t2.cls.has("cl-run"));
  assert.doesNotMatch(r.window.coderLogoHTML(26), /cl-run/);
});

test("TW5 in a real browser: a line of typing ends as it began (every part where it was, the paper's lines in the same places, as dark), so the logo can type line after line, or stop at a line's end, with no jump; in between, it moves", async (t) => {
  const { hasBrowser } = await import("../container/gloopy-browser.mjs");
  if (!hasBrowser()) return t.skip("no Playwright Chromium on this machine");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><style>.held * { animation-play-state: paused !important; }' + read("public/coder-logo.css") + '</style><div id="w"></div><script>' + read("public/coder-logo.js") + "</script>");
    // Every shape that shows (the paper's letters, the spools and the lever's knob too): where it is on the screen, how
    // visible (with its groups'), its colour.
    const pose = (at) => page.evaluate((at) => {
      const w = document.getElementById("w");
      w.innerHTML = window.coderLogoHTML(160);
      const s = w.firstChild;
      if (at !== null) { s.classList.add("cl-run", "held"); s.style.setProperty("--cl-d", "-" + at + "ms"); }
      const shown = [];
      for (const e of s.querySelectorAll("rect, path, ellipse, circle")) {
        let o = 1;
        for (let n = e; n !== s; n = n.parentNode) o *= Number(getComputedStyle(n).opacity);
        if (o < 0.01) continue;
        const r = e.getBoundingClientRect();
        shown.push([r.x, r.y, r.width, r.height].map((v) => v.toFixed(1)).join(" ") + " " + o.toFixed(2) + " " + getComputedStyle(e).fill + " " + getComputedStyle(e).stroke);
      }
      return shown.sort();
    }, at);
    const still = await pose(null);
    assert.ok(still.length > 30);
    assert.deepEqual(await pose(0), still, "a line starts from the drawing at rest");
    assert.deepEqual(await pose(LINE_MS - 1), still, "and ends there");
    // (A key down and a bar up; the paper going up, the carriage sliding back; a key on the next line.)
    for (const at of [450, 1300, 2050]) assert.notDeepEqual(await pose(at), still, "it moves at " + at + " ms");
  } finally {
    await browser.close();
  }
});

test("TW6 in a real browser, the page: Coder's tab shows the typewriter at 34 px (no emoji), its chat's bar at 26 and its empty chat at 120, all still; a hover on the tab, or a click on a logo, types one line, then it is still again; a message makes the tab's and the bar's type in step through the bar's redraws, until Coder is done", async (t) => {
  const { hasBrowser } = await import("../container/gloopy-browser.mjs");
  if (!hasBrowser()) return t.skip("no Playwright Chromium on this machine");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  try {
    const { page, st, errors, logos } = await openPage(browser);
    const one = async (where) => (await logos()).find((x) => x.where === where);
    assert.deepEqual((await logos()).map((x) => [x.where, x.w, x.h, x.run, x.moving]), [["tab", 34, 34, false, 0], ["bar", 26, 26, false, 0], ["empty", 120, 120, false, 0]]);
    assert.equal((await page.textContent('.gf-tab[data-agent="coder"]')).trim(), "", "no emoji in the tab");
    const movingIn = (sel) => page.waitForFunction((sel) => { const s = document.querySelector(sel); return s && s.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length > 10; }, sel, { timeout: 3000 });
    // A hover on Coder's tab: one line, then still, by itself.
    await page.mouse.move(700, 700);
    await page.hover('.gf-tab[data-agent="coder"]');
    await movingIn("#gfTabCoder svg.cl-logo");
    assert.equal((await one("empty")).moving, 0, "the others don't");
    await page.waitForFunction(() => !document.querySelector("svg.cl-logo.cl-run"), null, { timeout: LINE_MS + 3000 });
    assert.equal((await one("tab")).moving, 0, "still again");
    // A click on the empty chat's logo: the same.
    await page.click("#gfApp .cd-cl-fig svg.cl-logo");
    await movingIn("#gfApp .cd-cl-fig svg.cl-logo");
    await page.waitForFunction(() => !document.querySelector("svg.cl-logo.cl-run"), null, { timeout: LINE_MS + 3000 });
    // A message: Coder works, and the tab's and the bar's logos type.
    await page.mouse.move(700, 120);
    await page.click("#gfApp .cd-start");
    await page.waitForFunction(() => document.querySelectorAll("svg.cl-logo.cl-run").length === 2, null, { timeout: 8000 });
    assert.equal(st.sent, 1);
    await movingIn("#gfApp .cd-cl-av svg.cl-logo");
    // The bar is drawn again (each 1.5-second look at the chat): its new logo goes on with the line, not from its start.
    const bar = () => page.evaluate((LINE) => { const s = document.querySelector("#gfApp .cd-cl-av svg"); const a = s.getAnimations({ subtree: true }).find((x) => x.animationName === "clg-car"); s.dataset.seen = "1"; return { at: performance.now(), into: a.effect.getComputedTiming().progress * LINE }; }, LINE_MS);
    const before = await bar();
    await page.waitForFunction(() => !document.querySelector("#gfApp .cd-cl-av svg[data-seen]"), null, { timeout: 6000 });
    const after = await bar();
    const off = (a, b) => { const d = Math.abs(a - b) % LINE_MS; return Math.min(d, LINE_MS - d); };
    assert.ok(off(after.into, before.into + (after.at - before.at)) < 200, "the line goes on through the redraw (" + Math.round(before.into) + " ms, then " + Math.round(after.into) + " ms " + Math.round(after.at - before.at) + " ms later)");
    assert.match(await page.getAttribute("#gfApp .cd-cl-av svg", "style"), /^--cl-d:-\d+ms$/, "the new one starts where the line is");
    const [tab, b2] = [await one("tab"), await one("bar")];
    assert.ok(off(tab.into, b2.into) < 400, "the tab's and the bar's in step (" + Math.round(tab.into) + " and " + Math.round(b2.into) + " ms into the line)");
    // Coder is done: each finishes its line, then all are still.
    st.running = false;
    await page.waitForFunction(() => !document.querySelector("svg.cl-logo.cl-run"), null, { timeout: 1500 + LINE_MS + 3000 });
    assert.deepEqual((await logos()).map((x) => [x.where, x.moving]), [["tab", 0], ["bar", 0]]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("TW7 in a real browser with reduced motion: nothing moves, on a hover, a click, or while Coder works (and a logo told to type stays still)", async (t) => {
  const { hasBrowser } = await import("../container/gloopy-browser.mjs");
  if (!hasBrowser()) return t.skip("no Playwright Chromium on this machine");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  try {
    const { page, st, errors, logos } = await openPage(browser, { reduced: true });
    const moving = async () => (await logos()).reduce((n, x) => n + x.moving, 0);
    await page.mouse.move(700, 700);
    await page.hover('.gf-tab[data-agent="coder"]');
    await page.click("#gfApp .cd-cl-fig svg.cl-logo");
    await page.waitForTimeout(200);
    assert.equal(await moving(), 0);
    await page.click("#gfApp .cd-start");
    await page.waitForFunction(() => document.querySelector("#gfApp #cdStop"), null, { timeout: 8000 });
    await page.waitForTimeout(1800);
    assert.equal(st.sent, 1);
    assert.equal(await moving(), 0, "Coder works, the logo is still");
    assert.equal(await page.locator("svg.cl-logo.cl-run").count(), 0);
    await page.evaluate(() => document.querySelectorAll("svg.cl-logo").forEach((s) => s.classList.add("cl-run")));
    await page.waitForTimeout(100);
    assert.equal(await moving(), 0, "the style stops it too");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("svg.cl-logo .clg-car")).animationName), "none");
    st.running = false;
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("TW8 the logo's two files are served like the page's others (Coder's Worker, from public/, with the page's safety headers: scripts only from its own address, no inline script needed); the service worker keeps no copy of anything, so there is no list to add them to", async () => {
  for (const f of ["coder-logo.js", "coder-logo.css"]) assert.ok(existsSync(PUB + f), f);
  assert.match(read("wrangler.jsonc"), /"assets": \{ "directory": "\.\/public", "binding": "ASSETS", "run_worker_first": true \}/, "public/ is what the Worker serves");
  assert.match(read("worker.js"), /res = await servePage\(request, env\);/);
  const { servePage } = await import("../src/coder-page.mjs");
  const served = [];
  const env = { ASSETS: { fetch: async (req) => {
    const p = new URL(req.url).pathname;
    served.push(p);
    const f = path.join(PUB, p);
    return f.startsWith(PUB) && existsSync(f) && statSync(f).isFile() ? new Response(readFileSync(f), { headers: { "content-type": p.endsWith(".css") ? "text/css" : "text/javascript" } }) : new Response("nope", { status: 404 });
  } } };
  for (const f of ["/coder-logo.js", "/coder-logo.css"]) {
    const r = await servePage(new Request("https://gofarther.dev" + f), env);
    assert.equal(r.status, 200, f);
    assert.equal(await r.text(), read("public" + f), f + ", as it is");
    const csp = r.headers.get("content-security-policy");
    assert.match(csp, /script-src 'self'(;|$)/, "a script from the page's own address");
    assert.match(csp, /style-src 'self' 'unsafe-inline'/, "(its --cl-d style attribute is allowed)");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  }
  assert.deepEqual(served, ["/coder-logo.js", "/coder-logo.css"], "each is its own file, not the page");
  assert.doesNotMatch(read("public/index.html").replace(/<script src="\/[\w.-]+" defer><\/script>/g, ""), /<script/, "no inline script");
  const sw = read("public/sw.js");
  assert.match(sw, /It caches nothing and\n\/\/ handles no requests: the page always comes from the network\./);
  assert.doesNotMatch(sw, /addEventListener\(\s*["']fetch["']|caches\./, "no fetch handler, no cache");
});

test("TW9 (2026-11-14, the owner: \"lets make it a bit more real, like more present\") more real: a shadow under it, feet, light and shade as shapes of their own (no gradients, so still no ids), the roller's knobs with grips, the ribbon spools and the type basket on its deck, and typewriter letters on the paper (strokes, not text), the same line each time; the ribbon lifts to the paper as each bar strikes", () => {
  const { window } = logoScript();
  const svg = window.coderLogoHTML(160);
  assert.doesNotMatch(svg, /\sid="|url\(#|Gradient/, "no ids, so no gradients");
  assert.match(svg, /^<svg class="cl-logo"[^>]*><ellipse cx="50" cy="94.4" rx="46" ry="3.4" fill="#0d1b2a" opacity=".14"\/>/, "first, its shadow on the desk");
  assert.equal((svg.match(/<ellipse cx="(25.4|74.6)" /g) || []).length, 6, "two ribbon spools (the ribbon, its metal, its hub)");
  assert.match(svg, /<path d="M36.8 56.6A13.2 5.2 0 0 1 63.2 56.6Z" fill="#5e1b15"\/>/, "the type basket's slot");
  // Red, the owner's pick of four colours (2026-11-14), with a gold type bar that shows against it.
  assert.ok(svg.includes('fill="#c0392b"/>') && svg.includes('stroke="#f2c14e"') && !svg.includes("#0f766e"), "red, with a gold type bar");
  assert.equal((svg.match(/L[\d.]+ [\d.]+(?=M|")/g) || []).length >= 12, true, "its bars at rest, fanned");
  assert.equal((svg.match(/<rect x="(9.2|11.2|13.2|86|88|90)" y="39.6" width=".8" height="9.8"/g) || []).length, 6, "the knobs' grips");
  assert.equal((svg.match(/<rect x="(13|78)" y="90.6" width="9" height="4.2"/g) || []).length, 2, "its feet");
  // The paper: typewriter letters drawn as strokes (no text, so the same on every computer and nothing for the page's
  // search or a copy), every line "fix bug": each line the one under it moved up a line, letter for letter, so a line
  // ends as the drawing began. The line's last 3 letters, and the next line's first 3, show as their bars strike.
  assert.doesNotMatch(svg, /<text/);
  const letters = [...svg.matchAll(/<path(?: class="([^"]+)")? d="([^"]+)" fill="none" stroke="#0d1b2a" stroke-width=".72"/g)].map((m) => ({ cls: m[1] || "", d: m[2] }));
  assert.equal(letters.length, 21, "the faint line (6), the line done (6), the line being typed (6) and the next line's first 3");
  assert.deepEqual(letters.filter((l) => l.cls).map((l) => l.cls), ["clg-m clg-m5", "clg-m clg-m6", "clg-m clg-m7", "clg-m clg-n1", "clg-m clg-n2", "clg-m clg-n3"]);
  const at = (d) => [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const shape = (d) => d.replace(/M-?[\d.]+ -?[\d.]+/g, "M");
  const lines = [letters.slice(0, 6), letters.slice(6, 12), letters.slice(12, 18), letters.slice(18)];
  for (let k = 1; k < lines.length; k++) lines[k].forEach((l, i) => {
    const up = lines[k - 1][i];
    assert.equal(shape(l.d), shape(up.d), "line " + k + ", letter " + i + ": the same letter as the line above");
    assert.deepEqual(at(l.d).map(([x, y]) => [x, Math.round((y - 6) * 100) / 100]), at(up.d), "one line (6) lower");
  });
  assert.equal(new Set(lines[1].map((l) => shape(l.d))).size, 6, "six different letters: f, i, x, b, u, g");
  assert.ok(svg.includes('<g class="clg-l3" opacity=".3">') && svg.includes('<g class="clg-l2">'));
  // The ribbon: at rest below the line; lifted once for each strike of a bar, and down again before the next.
  const css = read("public/coder-logo.css");
  const kf = /@keyframes clg-rb\{(.*)\}\n/.exec(css)[1];
  const steps = [...kf.matchAll(/([\d.]+)%\{transform:([^;}]+)/g)].map((m) => [Number(m[1]), m[2]]);
  assert.deepEqual(steps[0], [0, "none"]);
  assert.deepEqual(steps.at(-1), [100, "none"], "a line ends with the ribbon where it began");
  const lifts = steps.filter(([, t]) => t !== "none");
  assert.equal(lifts.length, 12, "six strikes, up and held");
  const strikes = [];
  for (const k of ["bl", "br"]) {
    const bar = new RegExp("@keyframes clg-" + k + "\\{(.*)\\}").exec(css)[1];
    for (const m of bar.matchAll(/([\d.]+)%\{transform:none\}/g)) strikes.push(Number(m[1]));
  }
  assert.equal(strikes.length, 6);
  for (const s of strikes) assert.ok(lifts.some(([p]) => Math.abs(p - s) < 0.5), "the ribbon is up as the bar strikes at " + s + "%");
});
