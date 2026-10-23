// Audit round 2, group 3 (2026-10-23): findings re-checked against today's
// code. Records: docs/history/2026-10-23-r2-g3.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carryPanelFields } from "../site-meta.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// ── A33-5 ────────────────────────────────────────────────────────────────────
// A restore (Versions, and Back online through the same function) wrote the
// version's staged origin: after a rename-lane rename, that is the old name,
// which 301s, so every canonical and og:url pointed at a redirect.
test("A33-5 a restore keeps the live address, not the restored version's old name", () => {
  const ver = JSON.stringify({ origin: "https://fretwork-1.gofarther.app/", description: "d" });
  const live = JSON.stringify({ origin: "https://crookes-guitar.gofarther.app/", description: "d" });
  const out = JSON.parse(carryPanelFields(ver, live, ver, { origin: true }));
  assert.equal(out.origin, "https://crookes-guitar.gofarther.app/");
  // Without the option the version's own origin stands (Publish of a rename).
  assert.equal(JSON.parse(carryPanelFields(ver, live, ver)).origin, "https://fretwork-1.gofarther.app/");

  const rs = worker.indexOf("async function restoreVersion(");
  const rsEnd = worker.indexOf("putWorker:", rs);
  assert.ok(rs > 0 && rsEnd > rs, "restoreVersion landmarks");
  assert.match(worker.slice(rs, rsEnd), /sidecar: await withPanelFields\(deps, slug, [^\n]*, \{ origin: true \}\), sidecarKey/,
    "restoreVersion does not carry the live address");
  // Back online is this same function.
  assert.match(worker, /rollback: \(\{ slug, id \}\) => restoreVersion\(env, slug, id\),/);
});

// ── A33-8 ────────────────────────────────────────────────────────────────────
// The share picture was built on the storage slug's host: after a rename and a
// forget of that address, every og:image answered 404.
test("A33-8 the share picture is built on the public name's host and follows a rename", async () => {
  const { rehostShareImage } = await import("../site-domains.mjs");
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
  assert.match(worker, /async function shareOriginFor\(env, slug\) \{\n  const host = siteHostFor\(await publicNameFor\(env, slug\)\);/);
  // Every place a rename writes the live address moves the picture with it.
  assert.equal((worker.match(/\.origin = addressOf\(([\w.]+)\);(?: |\n\s*)rehostShareImage\(\w+, \1\);/g) || []).length, 3,
    "a rename writes the address without moving the share picture");
  assert.equal((worker.match(/\.origin = addressOf\(/g) || []).length, 3, "a new address writer appeared");
});
