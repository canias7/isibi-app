// THE LANDING'S CHATBOX IS THE BUILDER'S BOX, AND THE LANDING MAY ONLY PLACE IT.
//
// The owner held the landing (gofarther.dev, signed in and signed out) beside the
// builder's "What are we building?" screen on 2026-09-23 and asked for the
// landing's box to look like the builder's — then for the Video / App doors above
// it to go, and for the box to say "hey". The landing's box had been its own
// pencil-drawn copy of a composer, and a copy drifts: that is how the two had come
// to look different at all.
//
// So the landing's box wears the builder composer's own classes, and a landing
// rule may place it but never restyle it. Four properties:
//
//   1. the same class on each of the four parts — box, field, row, send — and the
//      ids NOT shared, because the builder binds its box by getElementById and
//      #marketing comes first in the document;
//   2. no landing rule sets a look property on those parts, and no composer rule
//      is scoped to the builder's page (`.st-hero .st-in` was, and so could only
//      ever reach the builder's copy);
//   3. the default channel's placeholder is "hey", from its one writer;
//   4. in a real browser, every computed property that makes the look is equal.
//      CI installs no browser, so 4 SKIPS there — said, never passed silently.
//      1–3 are what CI holds; 4 is what sees an INHERITED difference, which none
//      of them can: it measured the landing's 17px / 1.55 text context making
//      the same box 2.34px taller.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const blank = (m) => m.replace(/[^\n]/g, " ");
// Comments blanked, length-preserving: the landing's own note on this box names
// every class asserted here, and the sheet's notes quote `.st-hero .st-in`.
const HTML = read("public/index.html").replace(/<!--[\s\S]*?-->/g, blank);
const CSS = read("public/styles.css").replace(/\/\*[\s\S]*?\*\//g, blank);
const JS = read("public/chat.js");

/** Where `id="<id>"` is written — refused if it is written twice, because an
 *  ambiguous anchor asserts about whichever copy it happens to find. */
function idAt(src, id) {
  const needle = `id="${id}"`;
  const at = src.indexOf(needle);
  assert.ok(at > 0, `${needle} is not in the source`);
  assert.equal(src.lastIndexOf(needle), at, `${needle} is written twice`);
  return at;
}
/** The opening tag that carries the id. */
function tagOf(src, id) {
  const at = idAt(src, id);
  return src.slice(src.lastIndexOf("<", at), src.indexOf(">", at) + 1);
}
function classOf(src, id) {
  const m = /\sclass="([^"]*)"/.exec(tagOf(src, id));
  assert.ok(m, `the tag carrying id="${id}" has no class`);
  return m[1];
}
/** The class of the nearest `<div class="…">` opened before the id — the element
 *  that holds it. */
function holderOf(src, id) {
  const at = idAt(src, id);
  const open = src.lastIndexOf('<div class="', at);
  assert.ok(open >= 0, `nothing holds id="${id}"`);
  return /<div class="([^"]*)"/.exec(src.slice(open))[1];
}

test("the landing's box wears the builder composer's classes, part for part", () => {
  const parts = [
    ["box (what holds the field)", holderOf(HTML, "crtLandInput"), holderOf(JS, "stPrompt")],
    ["field", classOf(HTML, "crtLandInput"), classOf(JS, "stPrompt")],
    ["row (what holds the send button)", holderOf(HTML, "crtLandSend"), holderOf(JS, "stGen")],
    ["send button", classOf(HTML, "crtLandSend"), classOf(JS, "stGen")],
  ];
  for (const [part, landing, builder] of parts) {
    assert.ok(builder.trim(), `the builder's ${part} has no class to share`);
    assert.equal(landing, builder,
      `the landing's ${part} is "${landing}" and the builder's is "${builder}" — two classes are two looks`);
  }
});

test("…and keeps its own ids: a shared one would hand the builder's handlers to the landing", () => {
  // renderSites binds `stPrompt` and `stGen` by getElementById, and #marketing
  // comes BEFORE the app shell in the document — so a copy of either id on the
  // landing is the one found, and the builder's own button stops building.
  for (const id of ["stPrompt", "stGen"]) {
    assert.ok(!HTML.includes(`id="${id}"`), `index.html carries the builder's id="${id}"`);
  }
  for (const id of ["crtChatbox", "crtLandInput", "crtLandSend"]) {
    assert.ok(!JS.includes(`id="${id}"`), `chat.js draws the landing's id="${id}" a second time`);
  }
  // alive: each side really does carry ids of its own
  idAt(HTML, "crtLandSend");
  idAt(JS, "stGen");
});

// ── the sheet ────────────────────────────────────────────────────────────────
/** Every innermost rule: its selectors, one by one, and the properties it sets. */
function rules(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({
      selectors: m[1].split(",").map((s) => s.trim()).filter(Boolean),
      props: m[2].split(";").map((d) => d.split(":")[0].trim().toLowerCase()).filter(Boolean),
    });
  }
  return out;
}
// A selector that reaches the box through something only the landing has.
const LANDING_HOOK = /\.crt-inbox\s+\.st-|#crtChatbox|#crtLandInput|#crtLandSend|\.crt-chatbox-soon(?![\w-])/;
// Where the box sits, the text context it sits in, and the dimmed coming-soon
// state. Nothing here draws the box: no background, border, radius, shadow,
// padding or colour, which are the builder's rules to set.
const PLACE_OR_STATE = new Set(["width", "margin-top", "font-size", "line-height", "max-height",
  "opacity", "filter", "cursor", "pointer-events"]);
const COMPOSER = /\.(st-new|st-new-foot|st-in|st-gen)(?![\w-])/;
const BUILDER_PAGE = /\.(st-hero|st-page|view-sites)(?![\w-])|#viewSites/;

function audit(css) {
  const landing = [], restyle = [], composer = [], scoped = [];
  for (const r of rules(css)) {
    for (const s of r.selectors) {
      if (LANDING_HOOK.test(s)) {
        landing.push(s);
        for (const p of r.props) if (!PLACE_OR_STATE.has(p)) restyle.push(`${s} { ${p} }`);
      }
      if (COMPOSER.test(s)) {
        composer.push(s);
        if (BUILDER_PAGE.test(s)) scoped.push(s);
      }
    }
  }
  return { landing, restyle, composer, scoped };
}

test("a landing rule may place the box or dim it, never restyle it", () => {
  const { landing, restyle } = audit(CSS);
  assert.ok(landing.length >= 1, "no landing rule reaches the box — the scan is reading nothing");
  assert.deepEqual(restyle, [], "a landing rule sets a look property on the builder's box, so the two stop looking alike");
});

test("no composer rule is scoped to the builder's page", () => {
  const { composer, scoped } = audit(CSS);
  assert.ok(composer.length >= 4, `only ${composer.length} composer rule(s) read — the scan is not seeing the sheet`);
  assert.deepEqual(scoped, [], "a composer rule reaches only the builder's copy, and the landing's box goes without it");
});

test("PLANTED: a restyling landing rule and a page-scoped composer rule are both caught", () => {
  const { restyle, scoped } = audit(CSS + "\n.crt-inbox .st-new{border-radius:14px}\n.st-hero .st-in{width:100%}\n");
  assert.deepEqual(restyle, [".crt-inbox .st-new { border-radius }"]);
  assert.deepEqual(scoped, [".st-hero .st-in"]);
});

// ── the placeholder ──────────────────────────────────────────────────────────
/** The channels as index.html serves them, in order. */
const CHANNELS = [...HTML.matchAll(/<li class="crt-opt[^"]*"[^>]*>/g)].map(([tag]) => ({
  kind: /data-kind="([^"]*)"/.exec(tag)[1],
  live: /data-live="([^"]*)"/.exec(tag)[1],
  panel: /data-panel="([^"]*)"/.exec(tag)[1],
}));
/** paintCrt — the placeholder's one writer — run on its own, against a document
 *  holding the channel list and the two elements it touches. */
function placeholderFor(channels, selected) {
  const start = JS.indexOf("function paintCrt() {");
  const end = JS.indexOf("\n}\n", start);
  assert.ok(start >= 0 && end > start, "paintCrt is not in chat.js");
  const input = { placeholder: "" };
  const box = { classList: { toggle() {} } };
  const opts = channels.map((c) => ({ dataset: c, classList: { toggle() {} }, setAttribute() {} }));
  const document = {
    querySelectorAll: (q) => (q === "#crtMenu .crt-opt" ? opts : []),
    getElementById: (id) => ({ crtLandInput: input, crtChatbox: box }[id] || null),
  };
  const paintCrt = new Function("document", "crtSel", "crtShowPanel",
    JS.slice(start, end + 2) + "\nreturn paintCrt;")(document, selected, () => {});
  paintCrt();
  return input.placeholder;
}

test("the landing's box says \"hey\", and nothing else writes that line", () => {
  // The landing as served: the channel list is hidden, and the channel tuned at
  // load is the first one.
  assert.match(JS, /\nlet crtSel = 0;\n/, "the channel tuned at load is no longer the first");
  assert.ok(CHANNELS.length >= 2, "the channel list was not read from index.html");
  assert.equal(placeholderFor(CHANNELS, 0), "hey");
  assert.equal(placeholderFor([], 0), "hey", "with no channel list at all the box must still say hey");
  // alive: the other channels say something else, so "hey" is a decision and not
  // a constant the reader happens to return
  for (let i = 1; i < CHANNELS.length; i++) assert.notEqual(placeholderFor(CHANNELS, i), "hey");
  // ONE WRITER: the markup carries no line of its own to disagree with it
  assert.match(tagOf(HTML, "crtLandInput"), /\splaceholder=""/,
    "index.html writes its own placeholder — a second copy of the line paintCrt owns");
});

// ── the real cascade ─────────────────────────────────────────────────────────
/** public/ over plain HTTP — the files the Worker serves, and nothing else. */
function serve(root) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
    ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json" };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
      res.end(fs.readFileSync(f));
    });
    srv.listen(0, "127.0.0.1", () => resolve({ url: "http://127.0.0.1:" + srv.address().port, close: () => srv.close() }));
  });
}
const LOOK = {
  box: ["width", "height", "padding-top", "padding-right", "padding-bottom", "padding-left", "border-top-width",
    "border-top-style", "border-top-color", "border-radius", "background-color", "background-image", "box-shadow"],
  field: ["font-family", "font-size", "line-height", "height", "color", "padding-top", "padding-left",
    "background-color", "border-top-style"],
  send: ["width", "height", "border-radius", "background-image", "background-color", "color", "box-shadow"],
};
function readLook({ sel, look }) {
  const out = {};
  for (const part of Object.keys(look)) {
    const el = document.querySelector(sel[part]);
    if (!el) { out[part] = null; continue; }
    const cs = getComputedStyle(el);
    out[part] = Object.fromEntries(look[part].map((k) => [k, cs.getPropertyValue(k)]));
  }
  out.placeholderColour = getComputedStyle(document.querySelector(sel.field), "::placeholder").color;
  return out;
}

test("in a real browser the two boxes compute the same look, property for property", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright-core")); }
  catch { t.skip("no browser driver here (CI installs none) — the four source checks above are what hold it there"); return; }
  const exe = "/opt/pw-browsers/chromium";
  let browser;
  try { browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {}); }
  catch (e) { t.skip("no browser to launch: " + String(e && e.message).split("\n")[0]); return; }
  const server = await serve(path.join(ROOT, "public"));
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Nothing leaves this machine. The fonts refuse too, which leaves both boxes on
    // the same fallback face: this compares the two boxes, not a font.
    await page.route("**/*", (r) => (r.request().url().startsWith(server.url) ? r.continue() : r.abort()));
    await page.goto(server.url + "/");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("marketing")).display !== "none");
    const landing = await page.evaluate(readLook, { look: LOOK, sel: { box: "#crtChatbox", field: "#crtLandInput", send: "#crtLandSend" } });
    assert.equal(await page.evaluate(() => document.getElementById("crtLandInput").placeholder), "hey");
    // The builder's start screen, drawn by the app's own renderSites() in the same page.
    await page.evaluate(() => {
      document.getElementById("marketing").style.display = "none";
      document.querySelector(".shell").style.display = "";
      showView("sites");
      renderSites();
    });
    const builder = await page.evaluate(readLook, { look: LOOK, sel: { box: "#viewSites .st-new", field: "#stPrompt", send: "#stGen" } });
    // alive: both boxes were really drawn and measured, not two empty readings
    assert.ok(builder.box && parseFloat(builder.box.height) > 0, "the builder's box was not drawn");
    assert.ok(landing.box && parseFloat(landing.box.height) > 0, "the landing's box was not drawn");
    assert.deepEqual(landing, builder, "the landing's box computes a different look from the builder's");
  } finally {
    await browser.close();
    server.close();
  }
});
