// KEEP GOING FROM WHERE IT LEFT OFF (2026-10-31): a part that paused for
// credits keeps its unsaved files, and the resumed part starts from them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carryKey, makeCarry, applyCarry, fromFileMap, carryRequest } from "../builder/agent-carry.mjs";

const HOME = "home v1", HEAD = "header v1";
const site = { pages: [{ path: "index.tsx", source: HOME }], parts: [{ name: "site-header", source: HEAD }], css: "a{}" };
const stopped = { pages: [{ path: "index.tsx", source: HOME }, { path: "gallery.tsx", source: "gallery half" }], parts: [{ name: "site-header", source: "header + Gallery link" }], css: "a{}", changed: ["gallery.tsx", "-parts/site-header"], removed: [] };

test("AC1 the carry is keyed by the request part, the same for every attempt", () => {
  assert.equal(carryKey("northline-climbing", "771846a2-p1-2"), "carry/northline-climbing/771846a2-p1.json");
  assert.equal(carryKey("northline-climbing", "771846a2-p1-7"), carryKey("northline-climbing", "771846a2-p1-2"));
  assert.notEqual(carryKey("s", "k-p0-1"), carryKey("s", "k-p1-1"));
  assert.equal(carryKey("s", "8367ff86"), "", "a key that is not a part's carries nothing");
  assert.equal(carryKey("../x", "k-p1-1"), "");
});

test("AC2 the carry holds each written file with the site text it started from", () => {
  const c = makeCarry(site, stopped, "it wrote the page");
  assert.deepEqual(Object.keys(c.files).sort(), ["-parts/site-header", "gallery.tsx"]);
  assert.equal(c.files["gallery.tsx"].base, null);
  assert.equal(c.files["-parts/site-header"].base, HEAD);
  assert.equal(c.files["gallery.tsx"].source, "gallery half");
  assert.equal(makeCarry(site, { ...site, changed: [], removed: [] }), null, "nothing written, nothing carried");
});

test("AC3 resuming starts from the carried files when the site has not moved", () => {
  const ap = applyCarry(makeCarry(site, stopped, ""), site);
  assert.deepEqual(ap.kept.sort(), ["-parts/site-header", "gallery.tsx"]);
  assert.deepEqual(ap.stale, []);
  const w = fromFileMap(ap.files, site.css);
  assert.equal(w.pages.find((p) => p.path === "gallery.tsx").source, "gallery half");
  assert.equal(w.parts.find((p) => p.name === "site-header").source, "header + Gallery link");
  assert.equal(w.pages.find((p) => p.path === "index.tsx").source, HOME);
  assert.equal(w.css, "a{}");
});

test("AC4 a file another part saved since is not overwritten: the site's text wins", () => {
  const moved = { ...site, parts: [{ name: "site-header", source: "header + phone 0113 496 0000" }] };
  const ap = applyCarry(makeCarry(site, stopped, ""), moved);
  assert.deepEqual(ap.kept, ["gallery.tsx"]);
  assert.deepEqual(ap.stale, ["-parts/site-header"]);
  assert.equal(fromFileMap(ap.files).parts[0].source, "header + phone 0113 496 0000");
  const words = carryRequest("add a Gallery page", ap, "");
  assert.match(words, /Keep going from where it left off/);
  assert.match(words, /gallery\.tsx/);
  assert.match(words, /done again on the current text: -parts\/site-header/);
});

test("AC5 an unreadable carry, or one with nothing left to keep, starts from the site", () => {
  assert.equal(applyCarry(null, site), null);
  assert.equal(applyCarry({ v: 2 }, site), null);
  const allMoved = { ...site, pages: [...site.pages, { path: "gallery.tsx", source: "someone else's" }], parts: [{ name: "site-header", source: "x" }] };
  assert.equal(applyCarry(makeCarry(site, stopped, ""), allMoved).files, null);
});

test("AC6 the route keeps a carry on a credit pause, reads it on the next attempt, and clears it after", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("async function runAgentChange("), b = src.indexOf("async function recompileAndPublish(env, {");
  assert.ok(a > 0 && b > a);
  const fn = src.slice(a, b).replace(/\/\/[^\n]*/g, "");
  assert.match(fn, /carryKey\(slug, rowKey\)/);
  assert.match(fn, /applyCarry\(c, before\)/);
  assert.match(fn, /runOnce\(ask0, start\)/);
  const pause = fn.slice(fn.indexOf('ag.stopped === "no-credits") {'));
  assert.match(pause.slice(0, 400), /makeCarry\(before, ag/);
  assert.match(pause.slice(0, 400), /SITES_BUCKET\.put\(cKey/);
  assert.match(fn, /ag\.stopped !== "no-credits"\) \{ try \{ await env\.SITES_BUCKET\.delete\(cKey\)/);
});

test("AC7 a save refused for credits pauses the part with its finished files, as a stop mid-work does", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function runAgentChange("), src.indexOf("async function recompileAndPublish(env, {")).replace(/\/\/[^\n]*/g, "");
  const at = fn.indexOf('!out.ok && out.detail === "insufficient"');
  assert.ok(at > 0 && at < fn.indexOf("if (!out.ok) {"), "checked before the save's ordinary failure");
  const branch = fn.slice(at, fn.indexOf("if (!out.ok) {"));
  assert.match(branch, /makeCarry\(before, ag/);
  assert.match(branch, /fail\(402, \{ ok: false, error: "unbilled", detail: "insufficient"/);
  assert.match(branch, /undoEntries\(\)/);
});
