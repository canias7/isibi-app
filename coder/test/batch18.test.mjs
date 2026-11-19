// CLAUDE CODE FIXES, BATCH 18 (2026-11-19): page items, each kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
function cut(head) {
  const start = ui.indexOf(head);
  assert.ok(start >= 0, head);
  return ui.slice(start, ui.indexOf("\n  }\n", start) + 4);
}
function fn(heads, names, pre = "", args = [], vals = []) {
  return new Function(...args, pre + heads.map(cut).join("\n") + "\nreturn { " + names + " };")(...vals);
}

// The page's formatting, run on its own (inline kept simple).
function formatter() {
  const pre = ui.slice(ui.indexOf("  const SEP_ROW ="), ui.indexOf("  function tableHTML(")) +
    "const inline = (s) => String(s).replace(/</g, '&lt;');\nconst esc = inline;\n";
  return fn(["  function tableHTML(", "  const TABLE_ROWS = 200;\n  function blocks("], "blocks", pre);
}

test("L-page-28 thousands of tiny tables format quickly, with no call into itself", () => {
  const { blocks } = formatter();
  const text = Array.from({ length: 5000 }, (_, i) => "word " + i + "\n| a | b |\n|---|---|\n| " + i + " | x |").join("\n");
  const t = Date.now();
  const html = blocks(text);
  assert.ok(Date.now() - t < 1000, "well under a second");
  assert.equal(html.split("<table>").length - 1, 5000);
  assert.match(html, /<p>word 4999<\/p>/);
});

test("L-page-28 a table over 200 rows shows 200 and '… N more rows'", () => {
  const { blocks } = formatter();
  const text = "| n | m |\n|---|---|\n" + Array.from({ length: 300 }, (_, i) => "| " + i + " | x |").join("\n") + "\nafter";
  const html = blocks(text);
  assert.equal(html.split("<tr>").length - 1, 201, "the head and 200 rows");
  assert.match(html, /… 100 more rows/);
  assert.match(html, /<p>after<\/p>/);
});

test("L-page-28 a message that cannot be formatted shows as plain text", () => {
  const esc = (s) => String(s).replace(/</g, "&lt;");
  const boom = () => { throw new RangeError("Maximum call stack size exceeded"); };
  const { prose } = fn(["  function prose("], "prose", "", ["blocks", "esc", "noColor"], [boom, esc, (t) => t]);
  assert.equal(prose("a <b>\nc"), "<p>a &lt;b><br>c</p>");
  assert.match(ui, /setTimeout\(tick, threw \? POLL_MS : 150\)/);
});

function changesHarness(answers) {
  const S = { project: { id: "p" }, compareBranches: [] };
  let drew = 0;
  const call = (url) => answers.shift()(url);
  const { loadChanges, loadCompareBranches } = fn(["  async function loadChanges(", "  async function loadCompareBranches("], "loadChanges, loadCompareBranches", "", ["S", "call", "draw"], [S, call, () => drew++]);
  return { S, loadChanges, loadCompareBranches };
}

test("L-page-31 a slow answer for an earlier branch pick does not replace the later pick's changes", async () => {
  let slow;
  const { S, loadChanges } = changesHarness([
    () => new Promise((r) => { slow = r; }),
    async () => ({ status: 200, data: { against: "dev", files: [{ path: "dev.js" }] } }),
  ]);
  S.compareAgainst = "old";
  const first = loadChanges();
  S.compareAgainst = "dev";
  await loadChanges();
  slow({ status: 200, data: { against: "old", files: [{ path: "old.js" }] } });
  await first;
  assert.equal(S.changes.files[0].path, "dev.js");
});

test("L-page-32 a failed branch list is asked for again on the next See changes", async () => {
  const urls = [];
  const { S, loadChanges } = changesHarness([
    async (u) => (urls.push(u), { status: 502, data: null }),
    async (u) => (urls.push(u), { status: 200, data: { files: [] } }),
    async (u) => (urls.push(u), { status: 200, data: { branches: ["main", "dev"] } }),
    async (u) => (urls.push(u), { status: 200, data: { files: [] } }),
  ]);
  S.compareBranches = null;
  await loadChanges();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(S.compareBranches, null, "failed: not counted as loaded");
  await loadChanges();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(S.compareBranches, ["main", "dev"]);
  assert.equal(urls.filter((u) => /branches\?all=1/.test(u)).length, 2);
});
