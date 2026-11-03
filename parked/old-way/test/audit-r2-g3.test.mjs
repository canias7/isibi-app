// PARKED (2026-11-03, park-old-way): the old-way half of test/audit-r2-g3.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Audit round 2, group 3 (2026-10-23): findings re-checked against today's
// code. Records: docs/history/2026-10-23-r2-g3.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carryPanelFields } from "../../../site-meta.mjs";

const worker = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

// ── A33-8 ────────────────────────────────────────────────────────────────────
// The share picture was built on the storage slug's host: after a rename and a
// forget of that address, every og:image answered 404.
test("A33-8 the share picture is built on the public name's host and follows a rename", async () => {
  const { rehostShareImage } = await import("../../../site-domains.mjs");
  const side = { origin: "https://crookes-guitar.gofarther.app/", image: "https://fretwork-1.gofarther.app/u/fretwork-1/shop.jpg" };
  rehostShareImage(side, "crookes-guitar");
  assert.equal(side.image, "https://crookes-guitar.gofarther.app/u/fretwork-1/shop.jpg", "the storage path is kept, the host moves");
  const card = { image: "https://fretwork-1.gofarther.app/card.png" };
  rehostShareImage(card, "crookes-guitar");
  assert.equal(card.image, "https://crookes-guitar.gofarther.app/card.png");
  const other = { image: "https://example.com/x.png" };
  rehostShareImage(other, "crookes-guitar");
  assert.equal(other.image, "https://example.com/x.png", "a host that is not one of our sites is moved");
  const none = { image: null };
  rehostShareImage(none, "crookes-guitar");
  assert.equal(none.image, null);

  const at = worker.indexOf("async function siteOgImage(");
  const body = worker.slice(at, worker.indexOf("\n}\n", at));
  assert.ok(at > 0 && body.length > 500, "siteOgImage landmarks");
  assert.match(body, /const base = await shareOriginFor\(env, slug\);/);
  assert.doesNotMatch(body, /siteOrigin\(slug/, "a share URL is still built on the storage slug's host");
  assert.match(worker, /async function shareOriginFor\(env, slug\) \{\n[\s\S]{0,160}const host = siteHostFor\(await publicNameFor\(env, slug, \{ fresh: true \}\)\);/);
  // Every place a rename writes the live address moves the picture with it.
  assert.equal((worker.match(/\.origin = addressOf\(([\w.]+)\);(?: |\n\s*)rehostShareImage\(\w+, \1\);/g) || []).length, 4,
    "a rename writes the address without moving the share picture");
  assert.equal((worker.match(/\.origin = addressOf\(/g) || []).length, 4, "a new address writer appeared (the agent's rename_site, fix-all, is the fourth)");
});
