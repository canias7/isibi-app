import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { snapshot, rollback, movePrefix, listUnder, LIVE, PREV } from "../site-versions.mjs";

/**
 * A fake R2 that PAGINATES, because the real one does and the loop that walks it
 * is the part most likely to be wrong. A fake that returns everything in one
 * page proves nothing about cursor handling — the same lesson `setTotp`'s fake
 * taught by being more capable than the real thing.
 */
function fakeR2(seed = {}, { pageSize = 2 } = {}) {
  const m = new Map(Object.entries(seed));
  return {
    m,
    list: async ({ prefix, cursor }) => {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? keys.indexOf(cursor) + 1 : 0;
      const slice = keys.slice(start, start + pageSize);
      const last = slice[slice.length - 1];
      const more = start + pageSize < keys.length;
      return { objects: slice.map((k) => ({ key: k })), truncated: more, cursor: more ? last : undefined };
    },
    get: async (k) => (m.has(k) ? { body: m.get(k).body, httpMetadata: m.get(k).httpMetadata } : null),
    put: async (k, body, o) => { m.set(k, { body, httpMetadata: (o && o.httpMetadata) || {} }); },
    delete: async (k) => { m.delete(k); },
  };
}
const file = (body, ct) => ({ body, httpMetadata: { contentType: ct } });
const keysUnder = (r2, p) => [...r2.m.keys()].filter((k) => k.startsWith(p)).sort();

const built = (n) => ({
  ["sites/cafe/index.html"]: file("<h1>v" + n + "</h1>", "text/html"),
  ["sites/cafe/assets/app.js"]: file("//v" + n, "text/javascript"),
  ["sites/cafe/assets/app.css"]: file("body{}", "text/css"),
});

test("listUnder follows the cursor to the end", async () => {
  const r2 = fakeR2(built(1), { pageSize: 1 });
  const got = await listUnder(r2, LIVE("cafe"));
  assert.equal(got.length, 3, JSON.stringify(got));
  // `rel` is the path WITHIN the site, which is what makes a copy a rename.
  assert.deepEqual(got.map((o) => o.rel).sort(), ["assets/app.css", "assets/app.js", "index.html"]);
});

test("a first publish has nothing to keep, and that is not an error", async () => {
  const r2 = fakeR2({});
  const out = await snapshot(r2, "cafe");
  assert.deepEqual(out, { kept: 0, overflow: 0 });
});

test("a publish keeps the build it is about to destroy", async () => {
  const r2 = fakeR2(built(1));
  const out = await snapshot(r2, "cafe");
  assert.equal(out.kept, 3);
  // MOVED, not copied: the live prefix is empty and ready for the new build.
  assert.deepEqual(keysUnder(r2, LIVE("cafe")), []);
  assert.equal(keysUnder(r2, PREV("cafe")).length, 3);
  assert.equal(r2.m.get("prev/cafe/index.html").body, "<h1>v1</h1>");
});

test("THE CONTENT TYPE TRAVELS WITH THE BYTES", async () => {
  // Lost, the bundle comes back as application/octet-stream and the browser
  // refuses to execute it — the site renders blank, which reads as "the rollback
  // destroyed my site" rather than as a missing header.
  const r2 = fakeR2(built(1));
  await snapshot(r2, "cafe");
  assert.equal(r2.m.get("prev/cafe/assets/app.js").httpMetadata.contentType, "text/javascript");
  assert.equal(r2.m.get("prev/cafe/index.html").httpMetadata.contentType, "text/html");
});

test("the destination is cleared first, or a rollback is neither version", async () => {
  // The previous build had a page this one does not. Copied over the top, that
  // page survives and keeps being served: the result is a mixture of two builds,
  // which is worse than either.
  const r2 = fakeR2({ ...built(2), "prev/cafe/gone.html": file("<p>old page</p>", "text/html") });
  await snapshot(r2, "cafe");
  assert.equal(r2.m.has("prev/cafe/gone.html"), false, "a stale file must not survive into the snapshot");
  assert.equal(keysUnder(r2, PREV("cafe")).length, 3);
});

test("rollback puts the previous build back", async () => {
  const r2 = fakeR2(built(1));
  await snapshot(r2, "cafe");            // v1 parked
  for (const [k, v] of Object.entries(built(2))) r2.m.set(k, v);   // v2 published
  const out = await rollback(r2, "cafe");
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(r2.m.get("sites/cafe/index.html").body, "<h1>v1</h1>");
  assert.equal(r2.m.get("sites/cafe/assets/app.js").httpMetadata.contentType, "text/javascript");
});

test("…and the undo is itself undoable", async () => {
  // Somebody who rolls back and realises the new one WAS better must not be
  // punished for looking. That is why this is a swap and not a restore.
  const r2 = fakeR2(built(1));
  await snapshot(r2, "cafe");
  for (const [k, v] of Object.entries(built(2))) r2.m.set(k, v);
  await rollback(r2, "cafe");
  assert.equal(r2.m.get("sites/cafe/index.html").body, "<h1>v1</h1>");
  const again = await rollback(r2, "cafe");
  assert.equal(again.ok, true);
  assert.equal(r2.m.get("sites/cafe/index.html").body, "<h1>v2</h1>", "the swap must go both ways");
});

test("nothing is left in the holding prefix", async () => {
  // The live copy is parked in a third place so a failure mid-swap cannot leave
  // the site with no live copy — but it must not stay there, or the next
  // rollback finds somebody else's leftovers.
  const r2 = fakeR2(built(1));
  await snapshot(r2, "cafe");
  for (const [k, v] of Object.entries(built(2))) r2.m.set(k, v);
  await rollback(r2, "cafe");
  assert.deepEqual(keysUnder(r2, "swap/cafe/"), []);
});

test("a site built once has nothing to go back to", async () => {
  const r2 = fakeR2(built(1));
  const out = await rollback(r2, "cafe");
  assert.equal(out.ok, false);
  assert.match(out.reason, /no previous build/);
  // …and it must not have damaged the live site on the way to saying so.
  assert.equal(r2.m.get("sites/cafe/index.html").body, "<h1>v1</h1>");
});

test("ONE SITE'S SNAPSHOT IS NOT ANOTHER'S", async () => {
  const r2 = fakeR2({ ...built(1), "sites/cafe-two/index.html": file("<h1>other</h1>", "text/html") });
  await snapshot(r2, "cafe");
  // `sites/cafe/` must not match `sites/cafe-two/`. A prefix that differs by one
  // character is exactly the sort of thing a looser match would swallow, which
  // is why the snapshot lives at a separate top level rather than beside it.
  assert.equal(r2.m.get("sites/cafe-two/index.html").body, "<h1>other</h1>");
  assert.deepEqual(keysUnder(r2, "prev/cafe-two/"), []);
});

test("a pathological dist is capped rather than unbounded", async () => {
  const many = {};
  for (let i = 0; i < 40; i++) many["sites/cafe/f" + i + ".html"] = file("x", "text/html");
  const r2 = fakeR2(many);
  const out = await movePrefix(r2, LIVE("cafe"), PREV("cafe"), { max: 10 });
  assert.equal(out.moved, 10);
  // Reported, never silent: a snapshot quietly holding a quarter of the site
  // restores a broken one, which is worse than refusing.
  assert.equal(out.overflow, 30);
});

test("snapshot NEVER throws — a site must not fail to publish over its undo point", async () => {
  const broken = { ...fakeR2({}), list: async () => { throw new Error("R2 down"); } };
  const out = await snapshot(broken, "cafe");
  assert.equal(out.kept, 0);
  assert.match(out.error, /R2 down/);
});

test("the Worker snapshots BEFORE it wipes, and exposes a rollback", () => {
  // RAW, not comment-blanked, which is this repo's standing rule for worker.js
  // and one I broke writing this: stripping /* */ across six thousand lines eats
  // from any /* inside a string or regex to the next */, and it swallowed this
  // entire region — reporting present code as missing. Every pattern below
  // carries a "(" so it cannot match prose instead.
  const code = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");

  const fn = code.slice(code.indexOf("async function writeSiteDistToR2"), code.indexOf("async function writeSiteDistToR2") + 1400);
  const snapAt = fn.indexOf("snapshotSite(");
  const wipeAt = fn.indexOf("deleteSitePrefix(");
  // ORDER IS THE WHOLE PROPERTY. Snapshotting after the wipe keeps an empty
  // directory and calls it a backup — and both anchors are checked to exist
  // first, because indexOf returns -1 and `-1 < n` is vacuously true, which is
  // exactly how the stripe-webhook ordering assertions passed on a deleted
  // signature check.
  assert.ok(snapAt >= 0, "the publish must keep the build it is replacing");
  assert.ok(wipeAt >= 0, "the wipe must still be there");
  assert.ok(snapAt < wipeAt, "the snapshot must come BEFORE the wipe");

  assert.match(code, /rollbackSite\(r2Deps\(env\), ownerSlug\)/, "the rollback route must call it for the authorised slug");
  assert.match(code, /\\\/rollback\$/, "…and the route must be matched");
});
