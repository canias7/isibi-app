// The build checklist (2026-10-22, idea #14): derived from the design answer
// in code, checked against what the build published, told in one line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checklistFromDesign, verifyChecklist, checklistLine } from "../builder/build-checklist.mjs";
import { pageNotes, NOTE_FIELDS } from "../builder/build-answer.mjs";

const plan = {
  purpose: "A bakery",
  pages: [{ path: "/", name: "Home" }, { path: "/menu", name: "Menu" }, { path: "/gallery", name: "Gallery" }],
  shape: [
    { path: "/", sections: ["hero with the loaf", "menu teaser grid", "opening hours card"] },
    { path: "/menu", sections: ["menu list"] },
  ],
};
const spec = { tables: [{ name: "orders" }, { name: "bookings" }] };
const files = ["src/routes/index.tsx", "src/routes/menu.tsx", "src/routes/gallery.tsx", "src/routes/-parts/Card.tsx"];

test("the checklist is derived from the design: pages, their bands, tables", () => {
  const items = checklistFromDesign({ plan, spec });
  assert.deepEqual(items.filter((i) => i.kind === "page").map((i) => [i.path, i.name, i.sections]),
    [["/", "Home", 3], ["/menu", "Menu", 1], ["/gallery", "Gallery", 0]]);
  assert.equal(items.filter((i) => i.kind === "band").length, 4);
  assert.deepEqual(items.filter((i) => i.kind === "table").map((i) => i.name), ["orders", "bookings"]);
  for (const v of [undefined, null, {}, { plan: "x" }, { plan: { pages: "x" } }]) assert.deepEqual(checklistFromDesign(v), []);
});

test("everything published and rendered: every item done", () => {
  const items = checklistFromDesign({ plan, spec });
  const r = verifyChecklist(items, { pages: { page: "app", files, render: { ok: true, findings: [] } }, tables: ["orders", "bookings"] });
  assert.equal(r.length, items.length);
  assert.ok(r.every((x) => x.done === true && typeof x.why === "string"), JSON.stringify(r));
  assert.equal(checklistLine(r), "Built: Home (3 sections), Menu, Gallery, the orders table, the bookings table.");
});

test("a salvage stub is not built, and its bands are not either", () => {
  const items = checklistFromDesign({ plan, spec: {} });
  const r = verifyChecklist(items, { pages: { page: "app", files, salvaged: ["menu.tsx"] } });
  const menu = r.find((x) => x.item.kind === "page" && x.item.path === "/menu");
  assert.deepEqual([menu.done, menu.why], [false, "stub"]);
  assert.ok(r.filter((x) => x.item.kind === "band" && x.item.path === "/menu").every((x) => !x.done && x.why === "page-stub"));
  assert.equal(checklistLine(r), "Built: Home (3 sections), Gallery. Not built: Menu (it would not compile, so it's a placeholder).");
});

test("a missing table, and no database at all", () => {
  const items = checklistFromDesign({ plan: { pages: [{ path: "/", name: "Home" }] }, spec });
  const r = verifyChecklist(items, { pages: { page: "app", files }, tables: ["orders"] });
  assert.deepEqual(r.filter((x) => x.item.kind === "table").map((x) => [x.item.name, x.done, x.why]), [["orders", true, "provisioned"], ["bookings", false, "not-provisioned"]]);
  assert.match(checklistLine(r), /Not built: the bookings table \(the database did not take it\)\.$/);
  const none = verifyChecklist(items, { pages: { page: "app", files }, tables: null });
  assert.ok(none.filter((x) => x.item.kind === "table").every((x) => !x.done && x.why === "no-database"));
});

test("a band its writer refused is left out, and a page that threw is not built", () => {
  const items = checklistFromDesign({ plan, spec: {} });
  const r = verifyChecklist(items, { pages: { page: "app", files, unwritten: [{ section: "menu teaser grid" }],
    render: { ok: true, findings: [{ route: "/gallery", kind: "threw", detail: "x" }, { route: "/", kind: "contrast" }] } } });
  const band = r.find((x) => x.item.kind === "band" && x.item.line === "menu teaser grid");
  assert.deepEqual([band.done, band.why], [false, "unwritten"]);
  assert.equal(checklistLine(r), "Built: Home (2 sections, 1 left out), Menu. Not built: Gallery (it threw an error in the browser check).");
});

test("a page whose file was never written is not built", () => {
  const r = verifyChecklist(checklistFromDesign({ plan, spec: {} }), { pages: { page: "app", files: ["src/routes/index.tsx", "src/routes/menu.tsx"] } });
  assert.deepEqual(r.find((x) => x.item.path === "/gallery" && x.item.kind === "page").why, "missing");
});

test("a build that did not publish the app checks nothing", () => {
  const items = checklistFromDesign({ plan, spec });
  for (const pages of [null, { page: "placeholder", files: [] }]) assert.deepEqual(verifyChecklist(items, { pages }), []);
  assert.equal(checklistLine([]), "");
});

test("the reply line reaches the answer through pageNotes and the browser's note block", () => {
  const planned = checklistFromDesign({ plan, spec: {} });
  const n = pageNotes({ page: "app", files, salvaged: ["gallery.tsx"], planned });
  assert.match(n.builtNote, /^Built: Home \(3 sections\), Menu\. Not built: Gallery/);
  assert.ok(Array.isArray(n.checklist));
  assert.equal("builtNote" in pageNotes({ page: "app", files }), false, "no plan, no line");
  assert.ok(NOTE_FIELDS.includes("builtNote"));
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /typeof d\.builtNote === 'string'/);
  assert.match(chat, /'renderNote', 'builtNote'\]/);
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /checklistFromDesign\(\{ plan, spec \}\)/);
  assert.equal((worker.match(/\.\.\.pageNotes\(pages, \{ tables: /g) || []).length, 2, "both build answers pass the made tables");
});
