// The landing page's "AI models" dropdown — one nav item, four groups in it.
//
// Two properties, both of which fail SILENTLY and neither of which any other
// test in this repo would notice, because the unit suite never loads chat.js.
//
// 1. THE PANEL MUST NOT PRINT A MODEL ID. The labels are already public — the
//    in-app picker shows "Veo 3.1" — but the ids behind them are
//    `fal-ai/veo3.1` and `bytedance/seedance-2.0/…`, and naming the provider is
//    the one thing worker.js's director prompt forbids outright. A marketing
//    page that leaks `fal-ai/` undoes that rule on the most public surface we
//    have, and it would look completely normal on screen.
//
// 2. THE LISTS MUST NOT BE A SECOND COPY. Video/image/audio come from
//    MODEL_LISTS, the array the picker itself renders. Restated here, the two
//    drift the moment a model is added or dropped — Ray 3.2 and OmniHuman were
//    removed on 2026-07-17, and a hand-written marketing list would still be
//    advertising both.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const CHAT = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "chat.js"), "utf8");
const HTML = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "index.html"), "utf8");
const CSS = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "styles.css"), "utf8");

// The renderer, isolated. Read as a slice rather than by importing, because
// chat.js is a browser script with no exports.
const renderer = (() => {
  const i = CHAT.indexOf("function fillModelsMenu");
  assert.ok(i > 0, "fillModelsMenu must exist — every check below is about it");
  const j = CHAT.indexOf("\nfunction wireModelsMenu", i);
  assert.ok(j > i, "fillModelsMenu must be followed by wireModelsMenu");
  return CHAT.slice(i, j);
})();

test("the renderer never reads a model id", () => {
  // The whole leak in one line: `m.id` anywhere in the render loop puts
  // `fal-ai/…` on a public page.
  assert.equal(/\bm\.id\b|\.id\b/.test(renderer), false,
    "openModelsPanel must emit label/note only — an id is a provider path");
});

test("the renderer writes text, never markup", () => {
  // Model notes are ours today, but a note is content, and innerHTML on content
  // is how a list becomes an injection point the day one is templated.
  const assigns = renderer.match(/\.innerHTML\s*=\s*[^;]+/g) || [];
  for (const a of assigns) {
    assert.match(a, /innerHTML\s*=\s*''/, "the only innerHTML allowed is clearing the list: " + a.slice(0, 60));
  }
  assert.match(renderer, /\.textContent\s*=/, "names and notes go in by textContent");
});

test("video, image and audio come FROM MODEL_LISTS, not a second copy", () => {
  const i = CHAT.indexOf("const MODELS_TAB");
  const tabs = CHAT.slice(i, CHAT.indexOf("\n};", i));
  for (const kind of ["video", "image", "audio"]) {
    assert.match(tabs, new RegExp("MODEL_LISTS\\." + kind + "\\b"),
      kind + " must read MODEL_LISTS." + kind + " — a restated list drifts from the picker");
  }
});

test("every group the order names is a group the panel can render", () => {
  // Derived at both ends. MODELS_ORDER drives the render loop, so a key in it
  // with no MODELS_TAB entry is a group that silently never appears — and
  // silently-absent is exactly how a whole tier of this codebase has died
  // before. Checked the other way too: a defined group left out of the order is
  // written, styled and unreachable.
  const i = CHAT.indexOf("const MODELS_ORDER");
  const order = [...CHAT.slice(i, CHAT.indexOf("\n", i)).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(order.length >= 4, "expected four groups in MODELS_ORDER, found " + order.length);
  const j = CHAT.indexOf("const MODELS_TAB");
  const tabs = CHAT.slice(j, CHAT.indexOf("\n};", j));
  const defined = [...tabs.matchAll(/^\s*([a-z]+):\s*\{/gm)].map((m) => m[1]);
  for (const k of order) {
    assert.ok(defined.includes(k), "MODELS_ORDER names '" + k + "' but MODELS_TAB has no such key");
  }
  for (const k of defined) {
    assert.ok(order.includes(k), "MODELS_TAB defines '" + k + "' but MODELS_ORDER never renders it");
  }
});

test("the nav is ONE item and the menu is filled at boot", () => {
  const nav = [...HTML.matchAll(/data-models="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(nav, ["all"], "the landing has one AI models item, not one per kind");
  // It opens on HOVER via CSS, so nothing renders it on click — it must be
  // filled at boot or the first hover shows an empty box.
  assert.match(CHAT, /\bfillModelsMenu\(\);/, "fillModelsMenu must be called at boot");
  assert.match(CHAT, /\bwireModelsMenu\(\);/, "wireModelsMenu must be called at boot");
});

test("the menu OPENS on hover, in CSS, and is hidden until then", () => {
  // The property that makes it a dropdown rather than a panel that is simply
  // always there: hidden by default, revealed by the wrapper being hovered.
  const drop = CSS.slice(CSS.indexOf(".mdl-drop{"), CSS.indexOf(".mkt-drop:hover"));
  assert.match(drop, /visibility\s*:\s*hidden/, ".mdl-drop must start hidden");
  const open = CSS.slice(CSS.indexOf(".mkt-drop:hover"));
  assert.match(open.slice(0, 260), /visibility\s*:\s*visible/, "hover must reveal it");
  // :focus-within is not optional — hover alone is unreachable by keyboard.
  assert.match(CSS, /\.mkt-drop:focus-within \.mdl-drop/, "the menu must open on keyboard focus too");
});

test("the gap under the trigger is PADDING, never margin", () => {
  // Margin there is dead space outside the hover area: the pointer un-hovers
  // the wrapper on its way down and the menu shuts mid-travel.
  const drop = CSS.slice(CSS.indexOf(".mdl-drop{"), CSS.indexOf(".mkt-drop:hover"));
  assert.match(drop, /padding-top\s*:/, "the gap must be padding on .mdl-drop");
  assert.equal(/margin-top\s*:/.test(drop), false, "a margin gap breaks the hover traverse");
});

test("the nav stacks above the landing headline", () => {
  // .crt-topbar and .crt-crest were BOTH z-index 3, and the crest comes later
  // in the DOM — so "Generate the impossible." painted straight through the
  // middle of the open menu. Every geometry and DOM check passed while it did.
  const zi = (sel) => {
    // Anchored at LINE START. Unanchored, `.crt-crest` first matched
    // `.mkt-crt .crt-crest{top:…}` — a compound selector carrying no z-index —
    // and the check failed on a rule it was never asking about.
    const m = CSS.match(new RegExp("^\\" + sel + "\\s*\\{([^}]*)\\}", "m"));
    assert.ok(m, sel + " must exist as a rule of its own");
    const z = m[1].match(/z-index\s*:\s*(\d+)/);
    assert.ok(z, sel + " must declare a z-index for this comparison to mean anything");
    return +z[1];
  };
  assert.ok(zi(".crt-topbar") > zi(".crt-crest"),
    "the nav must paint above the headline, or the dropdown opens underneath it");
});

test("a column break cannot separate a heading from its own rows", () => {
  // The groups are laid out in CSS columns. Without break-inside:avoid a group
  // can split across the gap, leaving "AUDIO MODELS" at the foot of one column
  // and its three models at the head of the next — a heading labelling nothing,
  // above a list labelled by whatever sits above it.
  const grp = CSS.slice(CSS.indexOf(".mdl-group{"), CSS.indexOf(".mdl-gh{"));
  assert.match(grp, /break-inside\s*:\s*avoid/, ".mdl-group must not break across columns");
  const groups = CSS.slice(CSS.indexOf(".mdl-groups{"), CSS.indexOf(".mdl-group{"));
  assert.match(groups, /column-count\s*:\s*2/, "nineteen models read as two columns, not one long tube");
});

test("the menu's markup exists and sits inside the hover wrapper", () => {
  for (const id of ["modelsPanel", "mdlSub", "mdlList"]) {
    assert.match(HTML, new RegExp('id="' + id + '"'), "index.html is missing #" + id);
  }
  // There is no title element and no close button any more: the nav item IS the
  // title, and the menu closes by the pointer leaving. What must hold is that
  // the panel is a DESCENDANT of .mkt-drop — :hover on the wrapper is the only
  // thing opening it, so a panel moved outside can never be shown at all.
  const wrap = HTML.slice(HTML.indexOf('<div class="mkt-drop">'));
  const close = wrap.indexOf("</nav>");
  assert.ok(wrap.indexOf('id="modelsPanel"') > 0 && wrap.indexOf('id="modelsPanel"') < close,
    "#modelsPanel must live inside .mkt-drop, or hover can never reveal it");
  assert.match(HTML, /aria-haspopup/, "the trigger should announce that it opens a menu");
});

test("the panel's CSS uses only tokens this theme actually defines", () => {
  // `--surface` was written here and does not exist in this theme: the rows fell
  // back to transparent, the list's hairline colour showed through, and twelve
  // rows rendered as one grey block. It passed every check and was found by
  // looking — the same failure as the 70 charts that rendered grey.
  const defined = new Set([...CSS.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  // Anchored on the first RULE of the block, not on its comment. The comment
  // was renamed when the four tabs became one, indexOf returned -1, and the
  // slice silently became one character — caught only because the vacuity
  // assertion below exists. A guard anchored on prose is a guard that stops
  // guarding the next time somebody edits the prose.
  const at = CSS.indexOf(".mkt-drop{");
  assert.ok(at > 0, "the model-menu CSS block must be findable by its first rule");
  const block = CSS.slice(at);
  const used = new Set([...block.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
  const missing = [...used].filter((v) => !defined.has(v));
  assert.deepEqual(missing, [], "undefined CSS variables in the model-tab block: " + missing.join(", "));
  assert.ok(used.size > 0, "the block must actually use tokens, or this check is vacuous");
});

test("a long note cannot push the model name out of its row", () => {
  // The flex min-width trap, hit three times in this file already.
  const row = CSS.slice(CSS.indexOf(".mdl-row{"), CSS.indexOf(".mdl-name{"));
  assert.match(row, /min-width\s*:\s*0/, ".mdl-row needs min-width:0 or a long note overflows");
});
