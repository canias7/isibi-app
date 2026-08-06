// The landing page's four model tabs — LLM · Video · Image · Audio.
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

test("every kind the nav offers is a kind the panel can render", () => {
  // Derived at both ends. A tab whose kind has no entry opens an empty popup,
  // which reads as a broken page rather than as a missing case.
  const navKinds = [...HTML.matchAll(/data-models="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(navKinds.length >= 4, "expected the four model tabs in index.html, found " + navKinds.length);
  const i = CHAT.indexOf("const MODELS_TAB");
  const tabs = CHAT.slice(i, CHAT.indexOf("\n};", i));
  for (const k of navKinds) {
    assert.match(tabs, new RegExp("^\\s*" + k + ":", "m"), "nav offers '" + k + "' but MODELS_TAB has no such key");
  }
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
  const block = CSS.slice(CSS.indexOf("four model tabs"));
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
