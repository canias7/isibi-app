// PARKED (2026-11-03, park-old-way): the old-way half of test/site-map.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE ONE SITE MAP (2026-10-26): builder/site-map.mjs, its slices, the text
// step's reach into shared parts, and the worker's save/restore wiring.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteMap, mapFor, factKind, quotedElsewhere, partsImported, mapKey, mapVersionKey } from "../../../builder/site-map.mjs";
import { runTextEdit, scopedText, textItems } from "../../../builder/site-apply.mjs";
import { routeInventory } from "../../../builder/route-inventory.mjs";

const pages = [
  { path: "index.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Fold Lane Bakery</h1><p>Sourdough loaf £4.50</p><Footer/></main>}` },
  { path: "contact.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Contact us</h1><p>Write to us any time.</p><a href="mailto:hi@fold.test">Email</a><Footer/></main>}` },
];
const parts = [{ name: "footer", source: `export function Footer(){return <footer><p>Mon–Fri 8am–4pm</p><p>12 Mill Lane, Leeds LS1 4AB</p><p>0113 496 0123</p></footer>}` }];
const spec = { tables: [{ name: "orders", columns: [{ name: "id", notnull: true }, { name: "email", notnull: true, type: "text" }, { name: "note" }, { name: "status", notnull: true, default: "'new'" }] }] };
const map = () => buildSiteMap({ pages, parts, spec, css: ":root{--primary: #222;} body{font-family:'Inter',sans-serif}", version: "v1" });

// ── ALWAYS CURRENT (the owner, 2026-10-26): every way the site changes ──────
// Each change path is listed with the mechanism that keeps the map current.
// A path either refreshes the saved map itself, or is covered by the
// read-time rebuild: no reader is handed the saved copy on trust, and a copy
// served because a rebuild failed is marked `stale: true`.
const CHANGE_PATHS = {
  "first build": "build", "revise": "build",
  "text edit": "spine", "data edit": "read", "rules edit": "read", "look edit": "spine", "picture edit": "spine",
  "logo edit": "spine", "nav edit": "spine", "page edit": "spine", "frame edit": "spine", "add-on": "spine",
  "publish": "spine", "page removal": "spine", "page rename": "spine",
  "restore / rollback": "restore", "discard draft": "read", "draft save under draft-first": "read",
  "schema / table change": "read", "access-rule change": "read", "Data-panel structural edit": "read",
  "uploads library change": "read",
};
test("every change path refreshes the map or is covered by the read-time rebuild; no reader trusts a saved copy", () => {
  const w = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const body = (name) => { const a = w.indexOf("async function " + name + "("); assert.ok(a > 0, name); return w.slice(a, w.indexOf("\n}\n", a)); };
  const mech = {
    build: () => /if \(out && out\.page === "app"\) await refreshSiteMap\(env, slug, /.test(w),
    spine: () => /if \(!unsaved\.length\) await refreshSiteMap\(env, slug, version\);/.test(body("recompileAndPublish")),
    restore: () => /await restoreSiteMap\(env, slug, id\);/.test(body("restoreVersion")),
    read: () => /await refreshSiteMap\(env, slug, null\)/.test(body("currentSiteMap")) && /stale: true/.test(body("currentSiteMap")),
  };
  for (const [path, m] of Object.entries(CHANGE_PATHS)) assert.ok(mech[m] && mech[m](), path + " is not kept current (" + m + ")");
  // THE SAVED COPY IS READ ONLY BY `currentSiteMap` (its marked fallback).
  assert.equal([...w.matchAll(/await loadSiteMap\(/g)].length, 1, "a reader takes the saved map on trust");
  assert.ok(body("currentSiteMap").includes("await loadSiteMap("));
  // EVERY OTHER READER BUILDS FROM WHAT ITS OWN REQUEST JUST READ.
  const readers = [...w.matchAll(/mapFor\("(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(readers, ["addon", "diagnose", "frame", "reply", "rowNote", "text"], "a new map reader: decide how it stays current, then list it here");
  assert.ok(/currentSiteMap\(env, slug\); map = cur/.test(w), "list_site reads the current map");
});
