// ONE PUBLISH OF GRACE, and the one rule that makes it safe.
//
// Write-then-sweep fixed the click-through 404 for a visitor ARRIVING during a
// republish and not for one already there: a generated site is code-split one
// chunk per route with content-hashed names, so somebody with the page open
// still holds the old document, and clicking to a route they have not visited
// asks for a chunk the sweep had just deleted. On every republish.
//
// Driven with a fake store, which is the point — the decisions here are about
// which keys survive, and none of them needs R2, a container or a model call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sweepPlan, sweepAfterPublish, P_ORPHANS, MAX_DEFER } from "../site-sweep.mjs";

/** A store that records what was deleted and what was written. */
function fakeStore(objects = {}) {
  const store = new Map(Object.entries(objects));
  const removed = [];
  return {
    store, removed,
    deps: {
      list: async (prefix) => [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k })),
      read: async (k) => (store.has(k) ? store.get(k) : null),
      remove: async (k) => { store.delete(k); removed.push(k); },
      write: async (k, t) => { store.set(k, t); },
      now: () => "2026-08-15T00:00:00.000Z",
    },
  };
}

const marker = (keys) => JSON.stringify({ at: null, keys });

test("nothing is deleted on the first publish — it is only marked", () => {
  const plan = sweepPlan({ wrote: ["index.html", "assets/new.js"], live: ["index.html", "assets/old.js"], marked: null });
  assert.deepEqual(plan.remove, [], "the old chunk went immediately — the in-session 404 is back");
  assert.deepEqual(plan.defer, ["assets/old.js"]);
});

test("the SECOND publish deletes what the first one marked", () => {
  const plan = sweepPlan({
    wrote: ["index.html", "assets/newer.js"],
    live: ["index.html", "assets/old.js", "assets/new.js"],
    marked: ["assets/old.js"],
  });
  assert.deepEqual(plan.remove, ["assets/old.js"], "the deferred chunk was never collected");
  assert.deepEqual(plan.defer, ["assets/new.js"], "this publish's leftovers were not deferred");
});

test("A KEY THIS PUBLISH WROTE IS NEVER DELETED, whatever the marker says", () => {
  // THE ONE DANGEROUS FAILURE, and it is not hypothetical: `rollbackVersion`
  // republishes an OLD build, so keys the previous publish marked as orphaned
  // are live again by design. Without this rule the marker deletes the site it
  // has just restored.
  const plan = sweepPlan({
    wrote: ["index.html", "assets/old.js"],
    live: ["index.html", "assets/old.js", "assets/new.js"],
    marked: ["assets/old.js", "assets/gone.js"],
  });
  assert.ok(!plan.remove.includes("assets/old.js"), "a rollback deleted the build it had just restored");
  assert.ok(!plan.defer.includes("assets/old.js"), "a live key was queued for deletion");
  // …and a marked key that really is stale still goes.
  assert.deepEqual(plan.remove, [], "gone.js is not in the listing, so there is nothing to delete");
  assert.deepEqual(plan.defer, ["assets/new.js"]);
});

test("a marker naming keys that are already gone deletes nothing and reports nothing", () => {
  const plan = sweepPlan({ wrote: ["index.html"], live: ["index.html"], marked: ["assets/vanished.js"] });
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.defer, []);
});

test("a LOST marker costs one round of cleanup, never a leak", () => {
  // The self-healing property, and the reason this is safe to deploy: the
  // deferred list is recomputed from a LIVE listing every time and never carried
  // forward from the marker, so an orphan is still an orphan next publish.
  const live = ["index.html", "assets/a.js", "assets/b.js"];
  const lost = sweepPlan({ wrote: ["index.html"], live, marked: null });
  assert.deepEqual(lost.remove, [], "a lost marker deleted something");
  assert.deepEqual(lost.defer.sort(), ["assets/a.js", "assets/b.js"], "a lost marker forgot the orphans forever");
  // Next round, with the marker intact, they all go.
  const next = sweepPlan({ wrote: ["index.html"], live, marked: lost.defer });
  assert.deepEqual(next.remove.sort(), ["assets/a.js", "assets/b.js"]);
});

test("the marker is capped, and the ASSETS are what it keeps", () => {
  // A marker that grows without bound is a worse failure than one rare
  // in-session 404 — and the in-session case IS a code-split chunk, so when
  // something has to be dropped it is not those.
  const live = [];
  for (let i = 0; i < 30; i++) live.push("old" + i + ".txt");
  for (let i = 0; i < 30; i++) live.push("assets/chunk" + i + ".js");
  const plan = sweepPlan({ wrote: [], live, marked: null, cap: 30 });
  assert.equal(plan.defer.length, 30);
  assert.equal(plan.overflow, 30);
  assert.ok(plan.defer.every((k) => k.startsWith("assets/")), "the cap dropped the chunks and kept the rest");
  assert.equal(plan.remove.length, 30, "the overflow must be deleted now, not silently kept");
  assert.equal(MAX_DEFER > 100, true, "the real cap is roughly ten builds of slack");
});

test("a nonsense cap falls back to the default rather than deleting everything", () => {
  const live = ["assets/a.js", "assets/b.js"];
  for (const bad of [-1, NaN, "many", null, undefined]) {
    const plan = sweepPlan({ wrote: [], live, marked: null, cap: bad });
    assert.equal(plan.defer.length, 2, String(bad));
  }
});

// ───────────────────────────────────────────────────── the whole round, driven

test("two publishes in a row: the first defers, the second collects", async () => {
  const f = fakeStore({
    "sites/x/index.html": "a", "sites/x/assets/old.js": "a",
  });
  const one = await sweepAfterPublish(f.deps, { slug: "x", wrote: new Set(["index.html", "assets/new.js"]) });
  assert.equal(one.removed, 0);
  assert.equal(one.deferred, 1);
  assert.equal(one.hadMarker, false);
  assert.ok(f.deps.read(P_ORPHANS("x")), "the marker was not written");
  assert.deepEqual(JSON.parse(f.store.get(P_ORPHANS("x"))).keys, ["assets/old.js"]);
  assert.deepEqual(f.removed, [], "the first publish deleted something");

  const two = await sweepAfterPublish(f.deps, { slug: "x", wrote: new Set(["index.html", "assets/new.js"]) });
  assert.equal(two.removed, 1);
  assert.equal(two.hadMarker, true);
  assert.deepEqual(f.removed, ["sites/x/assets/old.js"]);
  assert.deepEqual(JSON.parse(f.store.get(P_ORPHANS("x"))).keys, [], "the marker was not cleared once it had settled");
});

test("the marker lives OUTSIDE the served prefix", () => {
  // `sites/<slug>/` is what `/s/<slug>/` serves to the public. A marker written
  // there is a list of a customer's file names on their own website — the same
  // reason the page SOURCE lives under `source/` and the backups under
  // `backups/`.
  assert.ok(!P_ORPHANS("x").startsWith("sites/"), P_ORPHANS("x"));
  assert.equal(P_ORPHANS("x"), "orphans/x.json");
});

test("an unreadable listing deletes nothing AND marks nothing", async () => {
  // Marking an empty list here would tell the next publish there is nothing to
  // clean up, which is the one way a lost round could become a permanent leak.
  const f = fakeStore({ "sites/x/index.html": "a" });
  f.deps.list = async () => { throw new Error("R2 down"); };
  const out = await sweepAfterPublish(f.deps, { slug: "x", wrote: new Set(["index.html"]) });
  assert.equal(out.ok, false);
  assert.match(out.error, /list failed/);
  assert.equal(f.store.has(P_ORPHANS("x")), false, "a marker was written from a listing we never got");
  assert.deepEqual(f.removed, []);
});

test("an unreadable MARKER still writes a new one", async () => {
  // A marker that cannot be READ must not stop the marker being WRITTEN: that
  // combination is what turns one bad round into a permanent stall.
  const quiet = console.error; console.error = () => {};
  try {
    const f = fakeStore({ "sites/x/index.html": "a", "sites/x/assets/old.js": "a", [P_ORPHANS("x")]: "{not json" });
    const out = await sweepAfterPublish(f.deps, { slug: "x", wrote: new Set(["index.html"]) });
    assert.equal(out.hadMarker, false, "junk parsed as a marker");
    assert.equal(out.removed, 0);
    assert.deepEqual(JSON.parse(f.store.get(P_ORPHANS("x"))).keys, ["assets/old.js"]);
  } finally { console.error = quiet; }
});

test("one failed delete does not abandon the rest", async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const f = fakeStore({
      "sites/x/index.html": "a", "sites/x/a.js": "a", "sites/x/b.js": "a",
      [P_ORPHANS("x")]: marker(["a.js", "b.js"]),
    });
    const realRemove = f.deps.remove;
    f.deps.remove = async (k) => { if (k.endsWith("a.js")) throw new Error("nope"); return realRemove(k); };
    const out = await sweepAfterPublish(f.deps, { slug: "x", wrote: new Set(["index.html"]) });
    assert.equal(out.removed, 1, "the second delete was abandoned after the first failed");
    assert.deepEqual(f.removed, ["sites/x/b.js"]);
  } finally { console.error = quiet; }
});

test("nothing here throws, whatever the store does", async () => {
  const quiet = console.error; console.error = () => {};
  try {
    // The build has already succeeded and the site is already published by the
    // time this runs — a failed sweep costs storage, a throw would cost the
    // response.
    const f = fakeStore({ "sites/x/index.html": "a" });
    f.deps.read = async () => { throw new Error("no"); };
    f.deps.write = async () => { throw new Error("no"); };
    f.deps.remove = async () => { throw new Error("no"); };
    const out = await sweepAfterPublish(f.deps, { slug: "x", wrote: new Set([]) });
    assert.equal(out.ok, true);
    assert.equal(out.markedOk, false, "a failed marker write was reported as a success");
  } finally { console.error = quiet; }
});

// ─────────────────────────────────────────────────────────────────── wiring

test("BOTH publish paths get the grace period", () => {
  // A rollback IS a publish — it writes a full dist and orphans whatever the
  // build it replaced was using — so sweeping immediately there reopens exactly
  // the 404 this closes, on the one action somebody takes when their site is
  // already visibly wrong. The wiring layer is where this repo has recorded
  // twelve dead features, so both ends are read.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /import \{[^}]*sweepAfterPublish[^}]*\} from "\.\/site-sweep\.mjs"/,
    "the Worker does not import the sweep");
  assert.match(worker, /await sweepAfterPublish\(sweepDeps\(env\), \{ slug, wrote \}\)/,
    "the ordinary publish no longer defers");
  assert.doesNotMatch(worker, /deleteSitePrefix\(env, slug, wrote\)/,
    "the immediate sweep is back on the publish path");
  // The rollback goes through the deps that carry it, at every call site.
  const calls = [...worker.matchAll(/rollbackVersion\((\w+)\(env\)/g)].map((m) => m[1]);
  assert.ok(calls.length >= 2, `only ${calls.length} rollback call sites found — the scan stopped matching`);
  for (const d of calls) assert.equal(d, "versionDepsWithSweep", "a rollback call site sweeps immediately");
});

test("rollbackVersion USES the sweep when it is given one", async () => {
  // Asserted through the module rather than by reading the Worker: an injected
  // dep that nothing calls is the exact shape of the twelve dead features.
  const { rollbackVersion } = await import("../site-versions.mjs");
  const seen = [];
  const deps = {
    read: async () => JSON.stringify({ files: ["index.html", "assets/a.js"] }),
    copy: async () => {},
    list: async () => { throw new Error("the immediate sweep ran instead of the deferred one"); },
    remove: async () => { throw new Error("the immediate sweep ran instead of the deferred one"); },
    sweep: async (a) => { seen.push(a); return { removed: 3, deferred: 2 }; },
  };
  const out = await rollbackVersion(deps, { slug: "x", id: "01786752000000-a1b2c3" });
  assert.equal(out.ok, true);
  assert.equal(out.swept, 3);
  assert.equal(out.deferred, 2);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].slug, "x");
  // The restored files are what must never be deleted — this is the argument
  // that makes the "never delete what this publish wrote" rule load-bearing.
  assert.deepEqual([...seen[0].wrote].sort(), ["assets/a.js", "index.html"]);
});

test("without a sweep dep, a rollback behaves exactly as it did before", async () => {
  // Which is what keeps the fallback honest rather than dead: this module is
  // driveable with nothing but a fake store.
  const { rollbackVersion } = await import("../site-versions.mjs");
  const removed = [];
  const out = await rollbackVersion({
    read: async () => JSON.stringify({ files: ["index.html"] }),
    copy: async () => {},
    list: async () => [{ key: "sites/x/stale.js" }, { key: "sites/x/index.html" }],
    remove: async (k) => removed.push(k),
  }, { slug: "x", id: "01786752000000-a1b2c3" });
  assert.equal(out.ok, true);
  assert.deepEqual(removed, ["sites/x/stale.js"]);
});

test("deleting a site takes the marker with it", () => {
  // It lives outside `sites/<slug>/` precisely so the served prefix cannot
  // expose it — and is therefore not touched by the prefix sweep. Keyed by slug
  // and nothing else would ever find it again: the class of leak `neon_teardown`
  // and the version archive each have their own line for.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("async function deleteSiteFor(");
  assert.ok(at > 0, "deleteSiteFor moved — rescope this");
  const body = worker.slice(at, worker.indexOf("\n}\n", at));
  assert.ok(body.length > 2000, "the deleteSiteFor window is small — rescope this");
  assert.match(body, /SITES_BUCKET\.delete\(P_ORPHANS\(dslug\)\)/, "the orphan marker outlives the site");
});
