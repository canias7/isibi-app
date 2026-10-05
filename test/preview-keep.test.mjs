// THE PREVIEW FRAME OUTLIVES A REPAINT — the rules, on CI (2026-10-05, run 101).
//
// The real behaviour is measured in a real Chromium by
// `test/preview-keep-browser.test.mjs` (the frame's identity, its loads, its
// scroll and its form, through a request the page polls), which CI skips: it
// has no browser. These cases run the same functions, carried out of chat.js
// landmark to landmark, so CI holds the rules too:
//   - `paintWorkspace` keeps the frame element, never takes it or any element
//     above it out of the tree, gives every element on that path the new
//     markup's attributes and replaces everything beside the path — and draws
//     the markup whole whenever keeping would be wrong;
//   - `loadSiteFrame` navigates only to an address the frame does not have;
//   - `loadSitePreview` loads a draft again only when it changed, or when
//     Refresh asks;
//   - the workspace render paints through `paintWorkspace`, and the frame's
//     markup says whose it is.
// The DOM here is a small stand-in written for these cases: elements,
// attributes, text, and a parser for the plain markup the cases hand it. It
// counts every time a node leaves the tree, which is what reloads a frame.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end in chat.js");
  return CHAT.slice(open, shut + 3);
}
const cutLine = (head) => { const at = CHAT.indexOf("\n" + head); assert.ok(at > 0, head + " is gone"); return CHAT.slice(at, CHAT.indexOf("\n", at + 1) + 1); };

// ── A SMALL DOM ─────────────────────────────────────────────────────────────
const VOID = new Set(["br", "img", "input", "meta", "link", "hr"]);
let detached = [];
class Node0 {
  constructor() { this.parentNode = null; this.childNodes = []; }
  get parentElement() { return this.parentNode && this.parentNode.tagName ? this.parentNode : null; }
  remove() {
    if (!this.parentNode) return;
    const p = this.parentNode;
    p.childNodes.splice(p.childNodes.indexOf(this), 1);
    this.parentNode = null;
    // A NODE LEAVING THE TREE, recorded with everything under it: a frame among them would reload.
    if (p.inDoc) detached.push(this);
  }
  get inDoc() { let n = this; while (n.parentNode) n = n.parentNode; return n.isDocument === true; }
  _insert(nodes, at) {
    for (const nd of nodes) { if (nd.parentNode) nd.remove(); nd.parentNode = this; }
    this.childNodes.splice(at, 0, ...nodes);
  }
  before(...nodes) { const p = this.parentNode; p._insert(nodes, p.childNodes.indexOf(this)); }
  after(...nodes) { const p = this.parentNode; p._insert(nodes, p.childNodes.indexOf(this) + 1); }
  querySelector(sel) {
    assert.ok(/^#[\w-]+$/.test(sel), "the stand-in DOM answers only an #id: " + sel);
    const id = sel.slice(1);
    const walk = (n) => { for (const c of n.childNodes) { if (c.tagName && c.getAttribute("id") === id) return c; const f = c.tagName ? walk(c) : null; if (f) return f; } return null; };
    return walk(this);
  }
  set innerHTML(html) { for (const c of [...this.childNodes]) c.remove(); this._insert(parse(html), 0); }
}
class Text0 extends Node0 { constructor(t) { super(); this.text = t; } }
class El extends Node0 {
  constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.attrs = new Map(); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  removeAttribute(k) { this.attrs.delete(k); }
  hasAttribute(k) { return this.attrs.has(k); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get src() { return this.getAttribute("src") || ""; }
  set src(v) { this.srcSets = (this.srcSets || 0) + 1; this.setAttribute("src", v); }
  get content() { return this._content || (this._content = new Node0()); }
  set innerHTML(html) {
    if (this.tagName === "TEMPLATE") { this.content.childNodes = []; this.content._insert(parse(html), 0); return; }
    super.innerHTML = html;
  }
}
function parse(html) {
  const root = new Node0();
  let cur = root;
  const re = /<\/([a-z0-9-]+)>|<([a-z0-9-]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>|([^<]+)/gi;
  for (const m of html.matchAll(re)) {
    if (m[1]) { cur = cur.parentNode || root; continue; }
    if (m[4]) { cur._insert([new Text0(m[4])], cur.childNodes.length); continue; }
    const el = new El(m[2]);
    for (const a of (m[3] || "").matchAll(/([a-z-]+)="([^"]*)"/gi)) el.setAttribute(a[1], a[2]);
    cur._insert([el], cur.childNodes.length);
    if (!VOID.has(m[2].toLowerCase())) cur = el;
  }
  const out = root.childNodes.slice();
  for (const n of out) n.parentNode = null;
  return out;
}
function docWith(viewHtml) {
  const doc = new Node0();
  doc.isDocument = true;
  const view = new El("div");
  view.setAttribute("id", "viewSites");
  doc._insert([view], 0);
  view.innerHTML = viewHtml;
  return { doc, view };
}
const textOf = (n) => (n.text !== undefined ? n.text : n.childNodes.map(textOf).join(""));

// THE REAL FUNCTIONS, run against the stand-in.
const SRC = [cut("function paintWorkspace("), cut("function loadSiteFrame("), cut("function frameSandbox("), cutLine("const FRAME_SANDBOX ="),
  cut("function loadSitePreview("), cut("function sitePreviewHtml("), "let sitePrevUrl = null;"].join("\n");
const fns = new Function("document", "location", "URL", "Blob", SRC + "\nreturn { paintWorkspace, loadSiteFrame, loadSitePreview };")(
  { createElement: (t) => new El(t) },
  { href: "https://gofarther.dev/projects", origin: "https://gofarther.dev" },
  // THE REAL URL, with the two blob calls a draft needs (a spread would lose the constructor `frameSandbox` uses).
  class extends URL { static createObjectURL() { return "blob:https://gofarther.dev/" + (++blobs); } static revokeObjectURL() {} },
  globalThis.Blob,
);
let blobs = 0;

/** A workspace as the render draws it, in miniature: the rail beside the stage, the frame inside it. */
const workspace = ({ site = "site_a", thread = "Hello", wsClass = "st-ws", dev = "desktop", frame = true, url = "x", style = "" } = {}) =>
  '<div class="' + wsClass + '"' + (style ? ' style="' + style + '"' : "") + '><div class="st-topbar"><span class="st-ws-name">' + url + '</span></div><div class="st-body">' +
  '<div class="st-rail"><div class="st-thread" id="stThread">' + thread + '</div></div>' +
  '<div class="st-stage" id="stStage" data-dev="' + dev + '">' +
  (frame ? '<div class="st-frame"><div class="st-frame-bar"><span class="st-frame-url">' + url + '</span></div><iframe id="stFrame" sandbox="allow-scripts" data-site="' + site + '" title="Site preview"></iframe></div>'
    : '<div class="st-code">the code</div>') +
  '<div class="st-fixbar" id="stFixBar">' + thread.length + '</div></div><div class="st-mob">phone</div></div></div>';

test("A REPAINT KEEPS THE FRAME: the same element, never out of the tree; every element above it kept and given the new markup's attributes; everything beside the path the new markup's", () => {
  const { view } = docWith(workspace({ thread: "Queued", url: "bakery.gofarther.app/" }));
  const fr = view.querySelector("#stFrame");
  fr.setAttribute("src", "https://bakery.gofarther.app/?v=3");
  fr.liveDocument = "scrolled to 900, a name typed";
  const oldThread = view.querySelector("#stThread");
  const oldStage = view.querySelector("#stStage");
  detached = [];
  fns.paintWorkspace(view, workspace({ thread: "In progress", wsClass: "st-ws st-mob-open", dev: "phone", url: "bakery.gofarther.app/" }));
  assert.equal(view.querySelector("#stFrame"), fr, "the repaint replaced the frame element");
  assert.equal(fr.liveDocument, "scrolled to 900, a name typed");
  assert.equal(fr.getAttribute("src"), "https://bakery.gofarther.app/?v=3", "the repaint touched the frame's address");
  assert.ok(!detached.some((n) => n === fr || n === fr.parentNode || n === oldStage), "the frame or an element above it left the tree — a real frame reloads on that");
  assert.equal(view.querySelector("#stStage"), oldStage, "the stage on the frame's path was replaced");
  assert.equal(oldStage.getAttribute("data-dev"), "phone", "an element on the path kept its old attributes");
  assert.equal(view.childNodes[0].getAttribute("class"), "st-ws st-mob-open", "the workspace kept its old class");
  // EVERYTHING BESIDE THE PATH IS THE NEW MARKUP'S: the thread, the fix bar, the frame's own bar.
  assert.notEqual(view.querySelector("#stThread"), oldThread, "the thread beside the path was kept");
  assert.equal(textOf(view.querySelector("#stThread")), "In progress", "the progress was not drawn");
  assert.equal(textOf(view.querySelector("#stFixBar")), String("In progress".length));
  // AN ATTRIBUTE THE NEW MARKUP NO LONGER HAS GOES: the panel's width, once nobody holds one.
  const { view: v2 } = docWith(workspace({ style: "--mob-w:520px" }));
  v2.querySelector("#stFrame").setAttribute("src", "https://bakery.gofarther.app/?v=3");
  fns.paintWorkspace(v2, workspace());
  assert.equal(v2.childNodes[0].getAttribute("style"), null, "the kept workspace still carries a width the new markup dropped");
  // AND THE ORDER IS THE NEW MARKUP'S, the kept element in its own place.
  const stageKids = oldStage.childNodes.map((c) => c.getAttribute("class"));
  assert.deepEqual(stageKids, ["st-frame", "st-fixbar"]);
  const body = oldStage.parentNode;
  assert.deepEqual(body.childNodes.map((c) => c.getAttribute("class")), ["st-rail", "st-stage", "st-mob"]);
});

test("A REPAINT DRAWS THE MARKUP WHOLE when keeping would be wrong: no frame in the new markup, a frame not pointed yet, another site's frame, or a different shape", () => {
  const point = (view) => { const f = view.querySelector("#stFrame"); f.setAttribute("src", "https://a.gofarther.app/?v=1"); return f; };
  // THE CODE TAB: no frame in the new markup.
  let { view } = docWith(workspace());
  let fr = point(view);
  fns.paintWorkspace(view, workspace({ frame: false }));
  assert.equal(view.querySelector("#stFrame"), null);
  assert.ok(textOf(view).includes("the code"));
  // A FRAME NOT YET POINTED ANYWHERE: there is nothing in it to keep.
  ({ view } = docWith(workspace()));
  fr = view.querySelector("#stFrame");
  fns.paintWorkspace(view, workspace({ thread: "again" }));
  assert.notEqual(view.querySelector("#stFrame"), fr, "a frame with no address was kept");
  // ANOTHER SITE.
  ({ view } = docWith(workspace({ site: "site_a" })));
  fr = point(view);
  fns.paintWorkspace(view, workspace({ site: "site_b" }));
  assert.notEqual(view.querySelector("#stFrame"), fr, "another site was drawn in this site's frame element");
  assert.equal(view.querySelector("#stFrame").getAttribute("data-site"), "site_b");
  // A DIFFERENT SHAPE: the frame one level deeper.
  ({ view } = docWith(workspace()));
  fr = point(view);
  fns.paintWorkspace(view, workspace().replace('<div class="st-frame">', '<div class="st-wrap"><div class="st-frame">').replace("</iframe></div>", "</iframe></div></div>"));
  assert.notEqual(view.querySelector("#stFrame"), fr, "a frame in a different place was kept");
  // AND NO FRAME BEFORE: drawn whole.
  ({ view } = docWith(workspace({ frame: false })));
  fns.paintWorkspace(view, workspace());
  assert.ok(view.querySelector("#stFrame"));
});

test("THE FRAME IS NAVIGATED ONLY TO AN ADDRESS IT DOES NOT HAVE: the same one is skipped, a new one loads with its flags first", () => {
  const fr = new El("iframe");
  assert.equal(fns.loadSiteFrame(fr, "https://a.gofarther.app/?v=1"), true);
  assert.equal(fr.srcSets, 1);
  assert.match(fr.getAttribute("sandbox"), /allow-same-origin/, "another origin's frame was not given its own origin");
  assert.equal(fns.loadSiteFrame(fr, "https://a.gofarther.app/?v=1"), false, "the address it already had was loaded again");
  assert.equal(fr.srcSets, 1, "the frame's src was assigned again — a real frame reloads on that");
  assert.equal(fns.loadSiteFrame(fr, "https://a.gofarther.app/?v=2"), true, "a new address was skipped");
  assert.equal(fr.srcSets, 2);
  assert.equal(fns.loadSiteFrame(fr, ""), false);
  assert.equal(fns.loadSiteFrame(null, "https://a.gofarther.app/?v=3"), false);
});

test("A DRAFT IS LOADED AGAIN ONLY WHEN IT CHANGED, or when Refresh asks", () => {
  const fr = new El("iframe");
  const page = "<!doctype html><html><head><title>Willow</title></head><body><h1>Willow Florist</h1></body></html>";
  assert.equal(fns.loadSitePreview(fr, page, "willow"), true);
  const first = fr.getAttribute("src");
  assert.equal(fns.loadSitePreview(fr, page, "willow"), false, "the same draft was loaded again");
  assert.equal(fr.getAttribute("src"), first);
  assert.equal(fns.loadSitePreview(fr, page, "willow", true), true, "Refresh did not load the draft again");
  assert.notEqual(fr.getAttribute("src"), first);
  assert.equal(fns.loadSitePreview(fr, page.replace("Willow Florist", "Willow & Rose"), "willow"), true, "a changed draft was not loaded");
});

test("THE WORKSPACE RENDER PAINTS THROUGH paintWorkspace, and the frame's markup says whose it is", () => {
  const render = cut("function renderSiteWorkspace(");
  const code = render.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(code.includes("paintWorkspace(view,"), "the render no longer paints through paintWorkspace");
  assert.ok(!/\bview\.innerHTML\s*=/.test(code), "the render assigns the workspace's markup directly again, frame and all");
  assert.match(code, /<iframe id="stFrame" sandbox="' \+ FRAME_SANDBOX \+ '" data-site="' \+ esc\(site\.id\) \+ '"/,
    "the frame's markup does not carry its site — every repaint would keep or drop it blind");
  // THE DRAFT'S STALE ERRORS ARE CLEARED BY A LOAD, never by a repaint that kept the page.
  assert.match(code, /if \(loadSitePreview\(fr, curHtml, site\.slug\)\) sitePreviewErrs\[/);
});
