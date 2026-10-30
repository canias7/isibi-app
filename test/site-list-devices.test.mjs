// EVERY DEVICE LISTS THE SAME SITES THE SAME WAY (2026-10-21, owner: "i have
// different sites in laptop and desktop").
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const SiteList = require("../public/site-list.js");

const rows = [
  { slug: "the-table", name: "the-table", title: "The Table", updatedAt: 3000, createdAt: 1000 },
  { slug: "fold-lane-bakery", name: "fold-lane-bakery", title: "", updatedAt: 2000, createdAt: 900 },
];

test("the order is the server's: a browser's own last-touched time no longer reorders the list", () => {
  const laptop = SiteList.projects(rows, [{ id: "a", slug: "fold-lane-bakery", name: "Fold Lane", updatedAt: 9_999_999 }]);
  const desktop = SiteList.projects(rows, []);
  assert.deepEqual(laptop.map((s) => s.slug), desktop.map((s) => s.slug));
  assert.deepEqual(desktop.map((s) => s.slug), ["the-table", "fold-lane-bakery"]);
});

test("the name is the server's when it keeps one, the same on every device; the browser's otherwise", () => {
  const laptop = SiteList.projects(rows, [{ id: "a", slug: "the-table", name: "New website" }, { id: "b", slug: "fold-lane-bakery", name: "Fold Lane Bakery" }]);
  const desktop = SiteList.projects(rows, []);
  assert.equal(laptop.find((s) => s.slug === "the-table").name, "The Table");
  assert.equal(desktop.find((s) => s.slug === "the-table").name, "The Table");
  assert.equal(laptop.find((s) => s.slug === "fold-lane-bakery").name, "Fold Lane Bakery", "with no server name the browser's still stands");
  assert.equal(desktop.find((s) => s.slug === "fold-lane-bakery").name, "fold-lane-bakery");
});

test("the server keeps the name: written by each build, sent as `title`, and the list survives a missing column", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /ctx\.waitUntil\(rememberSiteTitle\(env, next\.slug, next\.name, cu\.id\)\)/, "the chat save does not record the name");
  assert.match(w, /site_backends\?slug=eq\.\$\{encodeURIComponent\(slug\)\}&uid=eq\.\$\{encodeURIComponent\(uid\)\}/, "the name can be written onto another account's row");
  assert.match(w, /title: typeof r\.display_name === "string" \? r\.display_name\.slice\(0, 80\) : ""/);
  assert.match(w, /if \(lb && lb\.status === 400\) \{/, "a missing column would blank every device's list");
  assert.match(readFileSync(new URL("../supabase/proposed/site_display_name.sql", import.meta.url), "utf8"), /add column if not exists display_name text/);
  const c = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  // 2026-10-30: no "only on this device" card; a project not built yet is the
  // server's and says so, and a record not saved to the account yet says that.
  assert.doesNotMatch(c, /only on this device \\u00b7/, "the device-only card is back");
  assert.match(c, /s\.localOnly \? 'Not saved to your account yet \\u00b7 ' : !s\.slug \? /, "an unsaved record looks like a project on the account");
  assert.match(c, /d\.unpublished === true && typeof d\.preview === 'string' && SITE_DRAFT_HOST\.test\(d\.preview\)/, "an unpublished card shows the placeholder");
});
