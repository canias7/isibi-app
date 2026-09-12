// THE REFRESH BUTTON RELOADS THE FRAME THE PANEL ACTUALLY DRAWS (2026-09-12,
// owner, pointing at the icon: "WHAT DOES THIS BUTTON DOES ?" → "YES FIX IT").
//
// IT DID NOTHING ON ANY REAL SITE, and it read as correct from every angle but
// the one that mattered. The handler was the static-site version:
//
//     if (f && curHtml) loadSitePreview(f, curHtml, site.slug);
//
// `curHtml` is a page's STORED HTML, from before React. A React site's pages
// are written with `html: ''` (chat.js, the route derivation), so the gate was
// false and every click fell through — while the render three hundred lines up
// points the frame at the LIVE site through `loadSiteFrame`.
//
// IT IS THE SAME SHAPE AS THE PUBLISH BUTTON one control to the left, fixed the
// same night: a handler gated on the legacy path while the thing it acts on
// moved to the React one. `isReact ? '' : …` there, `if (curHtml)` here.
//
// SO EVERY CASE HERE DRIVES THE REAL HANDLER, carried out of chat.js rather
// than retyped. A text read is exactly what missed this: the line is
// well-formed, its landmarks are all present, and it is dead.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

/** A top-level function, landmark to landmark — never a byte window. */
function fn(head) {
  const at = CHAT.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  const end = CHAT.indexOf("\n}", at);
  assert.ok(end > at, head + " has no closing landmark — re-derive this window");
  return CHAT.slice(at, end + 2);
}

/**
 * The handler block, carried out whole.
 *
 * THE ANCHOR IS ASSERTED UNIQUE. There are two reload handlers in this file —
 * `stReload` and the Data panel's `stDataReload` — and a needle like
 * `rl.onclick` matches both; the first draft of this reader took the wrong one
 * and blew up on a duplicate `const`. That was luck: it could equally have
 * driven the other button and passed.
 */
function handlerSource() {
  const lines = CHAT.split("\n");
  const hits = lines.map((l, i) => (l.includes("getElementById('stReload')") ? i : -1)).filter((i) => i >= 0);
  assert.equal(hits.length, 1, "the stReload anchor is not unique — it would drive the wrong button");
  const from = hits[0];
  const end = lines.indexOf("  };", from);
  assert.ok(end > from, "the handler has no closing landmark — re-derive this window");
  return lines.slice(from, end + 1).join("\n");
}

/**
 * Press Refresh for real, with everything it closes over handed in.
 *
 * Returns what it DID: which loader was called, with what, and whether the
 * collected errors were cleared and the badge repainted.
 */
function press({ isReact, curHtml, previewV = 1, path = "/", presses = 1 }) {
  const calls = [];
  const site = { id: "s1", slug: "hey", url: "https://hey.gofarther.app/", active: path, previewV };
  const active = { path };
  const sitePreviewErrs = { ["s1|" + path]: [{ msg: "a stale error from the page that was on screen" }] };
  const scope = {
    document: { getElementById: () => ({}) },
    isReact, curHtml, site, active, sitePreviewErrs,
    previewErrKey: () => "s1|" + path,
    // The REAL builder, so the URL under test is the product's own.
    sitePreviewSrc: new Function(fn("function sitePreviewSrc(site, path)") + "; return sitePreviewSrc;")(),
    loadSiteFrame: (f, url) => calls.push({ via: "loadSiteFrame", url }),
    loadSitePreview: (f, html, slug) => calls.push({ via: "loadSitePreview", html: String(html).slice(0, 12), slug }),
    paintPreviewErrBadge: () => calls.push({ via: "paintPreviewErrBadge" }),
  };
  // `rl` IS NOT HANDED IN. The carried block opens with its own
  // `const rl = document.getElementById('stReload')`, so a parameter of that
  // name is a duplicate declaration and the whole scope refuses to compile —
  // the recorded "a re-anchor lands in a scope it did not write; check the name
  // is free", met on this file's first run. The button is handed back through
  // the lookup instead, which drives the real declaration rather than bypassing it.
  const names = Object.keys(scope);
  const button = new Function(...names, handlerSource() + "\nreturn rl;")(...names.map((n) => scope[n]));
  assert.ok(button && typeof button.onclick === "function", "the handler bound nothing to the button");
  for (let i = 0; i < presses; i++) button.onclick();
  return { calls, errs: sitePreviewErrs["s1|" + path], site };
}

// ── THE DEFECT ──────────────────────────────────────────────────────────────

test("pressing Refresh on a React site really reloads the frame", () => {
  // THE CASE THIS FILE EXISTS FOR. Before the fix this did nothing at all.
  const { calls } = press({ isReact: true, curHtml: "", previewV: 4 });
  const load = calls.find((c) => c.via === "loadSiteFrame");
  assert.ok(load, "Refresh does nothing on a React site — the legacy gate is back");
  assert.match(load.url, /^https:\/\/hey\.gofarther\.app\//, "it reloaded something other than the site");
});

test("...and the cache-buster MOVES, or the iframe keeps the page it has", () => {
  // Assigning `fr.src` a value it already holds does not reload an iframe, so a
  // re-point without a bump is a button that looks wired and is inert — the
  // right symptom fixed by the wrong cause, which this panel has cost three
  // rounds of once already.
  const { calls, site } = press({ isReact: true, curHtml: "", previewV: 4, presses: 2 });
  const urls = calls.filter((c) => c.via === "loadSiteFrame").map((c) => c.url);
  assert.equal(urls.length, 2, "two presses did not produce two loads");
  assert.notEqual(urls[0], urls[1], "both presses asked for the SAME url — the second reloads nothing");
  assert.equal(site.previewV, 6, "previewV did not advance once per press");
});

test("it reloads the PICKED page, not the home page", () => {
  // A SWEEP SURVIVOR, and the reason was this file's own fixtures: every press
  // above uses the default `path: "/"`, where `sitePreviewSrc(site, '/')` and
  // `sitePreviewSrc(site, active.path)` answer the same string. So a handler
  // hardcoded to the home page passed every case. The recorded "a fixture too
  // shallow to separate the two readings" — when a mutant survives, ask what
  // input would make the two readings differ.
  const { calls } = press({ isReact: true, curHtml: "", path: "/press", previewV: 2 });
  const load = calls.find((c) => c.via === "loadSiteFrame");
  assert.ok(load, "Refresh did nothing on a sub-page");
  assert.equal(load.url, "https://hey.gofarther.app/press?v=3",
    "Refresh reloads the home page whatever the picker says");
});

test("a refresh is a fresh page load, so the collected errors go with it", () => {
  // Kept, they would leave "Fix with AI" offering errors from a page no longer
  // on screen. The render's own rule on the branch below says exactly this.
  const { calls, errs } = press({ isReact: true, curHtml: "" });
  assert.deepEqual(errs, [], "the stale preview errors survived the refresh");
  assert.ok(calls.some((c) => c.via === "paintPreviewErrBadge"), "the badge still shows a count for errors that were cleared");
});

// ── WHAT MUST NOT REGRESS ───────────────────────────────────────────────────

test("a site that really has stored HTML still uses the legacy loader", () => {
  // The branch is kept rather than deleted: it is what a legacy static site is
  // for, and it is the branch that has always worked. Dropping it would trade
  // one dead case for another.
  const { calls } = press({ isReact: false, curHtml: "<!doctype html><h1>x</h1>" });
  const load = calls.find((c) => c.via === "loadSitePreview");
  assert.ok(load, "the legacy preview path was lost with the fix");
  assert.equal(load.slug, "hey", "the legacy loader no longer gets the slug");
});

test("a project with neither does nothing, and does not throw", () => {
  // A new project has no stored HTML and is not React yet. The button is
  // reachable, so the branch has to be safe rather than merely unlikely.
  const { calls, site } = press({ isReact: false, curHtml: "" });
  assert.deepEqual(calls, [], "it acted on a project with nothing to show");
  assert.equal(site.previewV, 1, "it burned a cache-buster on a project with no preview");
});

// ── ONE EXPRESSION FOR THE PREVIEW'S URL ────────────────────────────────────

test("every caller asks sitePreviewSrc — there are no copies of the arithmetic", () => {
  // It was written inline TWICE (the render and `switchSitePage`) and this fix
  // needed it a third time. Three copies of "which URL is this site's preview"
  // is the recorded two-lists-of-the-same-thing trap with a URL as its subject,
  // and the drift is silent: a frame pointed at a path the router redirects
  // away from reads as a slow site, not as a bug.
  const uses = (CHAT.match(/sitePreviewSrc\(/g) || []).length;
  assert.equal(uses, 4, "one definition plus three callers; a changed count means one moved or went");
  // The old inline spelling is gone from every call site — asserted over the
  // whole file, so a fourth copy pasted in tomorrow fails by existing. The one
  // survivor is the helper's own body.
  const inline = (CHAT.match(/previewV \|\| 1/g) || []).length;
  assert.equal(inline, 1, "the URL arithmetic is written out at a call site again");
});

test("the builder addresses a real path, never a fragment", () => {
  // A fragment is inert under browser history: it was right while the generated
  // app was hash-routed, and became the reason the frame stayed on the home
  // page whatever the picker said.
  const build = new Function(fn("function sitePreviewSrc(site, path)") + "; return sitePreviewSrc;")();
  const site = { url: "https://hey.gofarther.app/", previewV: 2 };
  assert.equal(build(site, "/press"), "https://hey.gofarther.app/press?v=2");
  assert.equal(build(site, "/"), "https://hey.gofarther.app/?v=2", "the home page grew a segment");
  assert.equal(build(site, undefined), "https://hey.gofarther.app/?v=2", "no page must read as the home page");
  assert.equal(build({ url: "https://hey.gofarther.app/" }, "/"), "https://hey.gofarther.app/?v=1",
    "a site that has never been revised must still get a cache-buster");
  for (const p of ["/press", "/", null]) assert.ok(!build(site, p).includes("#"), "a fragment is back in the preview URL");
});
