// The landing page's "AI models" panel — one tab, four groups inside it.
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
  const i = CHAT.indexOf("function openModelsPanel");
  assert.ok(i > 0, "openModelsPanel must exist — every check below is about it");
  const j = CHAT.indexOf("\nfunction closeModelsPanel", i);
  assert.ok(j > i, "openModelsPanel must be followed by closeModelsPanel");
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

test("the nav is ONE tab and it renders every group", () => {
  const nav = [...HTML.matchAll(/data-models="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(nav, ["all"], "the landing has one AI models tab, not one per kind");
  // And the renderer must not still be keyed off a kind argument, or the single
  // tab passes "all" into a lookup that has no such entry and opens empty.
  assert.match(CHAT, /function openModelsPanel\(\s*\)/, "openModelsPanel takes no kind — it renders all groups");
});

test("a group list cannot be crushed instead of scrolling", () => {
  // Flex items shrink by default, so without flex:0 0 auto each group is
  // squashed to fit the panel: twelve video models rendered as three and a
  // half, and the container reported NO overflow, because nothing overflowed —
  // everything had been compressed. It looked like a working panel with a
  // short list.
  const grp = CSS.slice(CSS.indexOf(".mdl-group{"), CSS.indexOf(".mdl-gh{"));
  assert.match(grp, /flex\s*:\s*0\s+0\s+auto/, ".mdl-group must not shrink, or its list gets clipped");
  const groups = CSS.slice(CSS.indexOf(".mdl-groups{"), CSS.indexOf(".mdl-group{"));
  assert.match(groups, /overflow-y\s*:\s*auto/, "the group column is what scrolls");
  assert.match(groups, /min-height\s*:\s*0/, "a flex child needs min-height:0 to scroll rather than grow");
});

test("the panel's markup exists and the close button is wired", () => {
  for (const id of ["modelsPanel", "mdlTitle", "mdlSub", "mdlList", "mdlClose"]) {
    assert.match(HTML, new RegExp('id="' + id + '"'), "index.html is missing #" + id);
  }
  assert.match(CHAT, /mdlClose[\s\S]{0,160}closeModelsPanel/, "the ✕ must call closeModelsPanel");
  assert.match(CHAT, /Escape[\s\S]{0,120}closeModelsPanel/, "Esc must close it");
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
  const at = CSS.indexOf(".mdl-card{");
  assert.ok(at > 0, "the model-panel CSS block must be findable by its first rule");
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
