// The cache that sits in front of every published site's data reads.
//
// It is a performance fix, which means its failure mode is not "slow" — it is
// "serves the wrong thing, confidently". A stale connection string points at a
// dropped database; a cached 404 keeps a freshly built site broken; an unbounded
// map lets anyone who scans slugs grow the isolate's memory. Each of those is
// tested here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCache, memoize } from "../ttl-cache.mjs";

// A hand-cranked clock: expiry has to be testable without sleeping.
function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("returns what was put in", () => {
  const c = makeCache({ ttlMs: 100 });
  c.set("a", "conn-1");
  assert.equal(c.get("a"), "conn-1");
  assert.equal(c.get("missing"), undefined);
});

test("an entry expires", () => {
  const k = clock();
  const c = makeCache({ ttlMs: 100, now: k.now });
  c.set("a", "conn-1");
  k.advance(99);
  assert.equal(c.get("a"), "conn-1");
  k.advance(1);
  assert.equal(c.get("a"), undefined, "exactly at the TTL it is gone");
});

test("an expired entry is dropped, not just hidden", () => {
  // Otherwise a scan across slugs would leave every miss resident forever.
  const k = clock();
  const c = makeCache({ ttlMs: 100, now: k.now });
  c.set("a", 1);
  k.advance(200);
  c.get("a");
  assert.equal(c.size, 0);
});

test("null and undefined are never cached", () => {
  // A slug that does not resolve is usually one whose build is still finishing.
  // Remembering the miss would keep a brand-new site broken for the whole TTL.
  const c = makeCache({ ttlMs: 1000 });
  c.set("pending-site", null);
  c.set("other", undefined);
  assert.equal(c.size, 0);
  assert.equal(c.get("pending-site"), undefined);
});

test("delete removes an entry immediately", () => {
  // This is what a site DELETE calls. A cached connection to a dropped database
  // answers reads with a connection error instead of a 404.
  const c = makeCache({ ttlMs: 100000 });
  c.set("gone", "conn-1");
  assert.equal(c.delete("gone"), true);
  assert.equal(c.get("gone"), undefined);
  assert.equal(c.delete("never-there"), false);
});

test("size is bounded", () => {
  const c = makeCache({ ttlMs: 100000, max: 3 });
  for (let i = 0; i < 50; i++) c.set("slug-" + i, i);
  assert.equal(c.size, 3, "an attacker walking slugs must not grow this without limit");
});

test("eviction drops the least recently USED, not the oldest set", () => {
  const c = makeCache({ ttlMs: 100000, max: 3 });
  c.set("a", 1); c.set("b", 2); c.set("c", 3);
  c.get("a");            // a is now the most recent
  c.set("d", 4);         // evicts b, the least recently touched
  assert.equal(c.get("a"), 1, "a was in active use and must survive");
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("c"), 3);
  assert.equal(c.get("d"), 4);
});

test("re-setting a key refreshes it rather than duplicating", () => {
  const k = clock();
  const c = makeCache({ ttlMs: 100, now: k.now });
  c.set("a", 1);
  k.advance(90);
  c.set("a", 2);
  k.advance(20);
  assert.equal(c.get("a"), 2, "the second write restarts the clock");
  assert.equal(c.size, 1);
});

test("a zero or missing ttl is refused", () => {
  // A cache that never expires is not a cache, it is a memory leak with a
  // correctness bug attached.
  for (const bad of [0, -1, undefined, NaN, "100"]) {
    assert.throws(() => makeCache({ ttlMs: bad }), /ttlMs/, String(bad));
  }
  assert.throws(() => makeCache(), /ttlMs/);
});

// ------------------------------------------------------------ memoize

test("memoize serves the cached value without calling again", async () => {
  const c = makeCache({ ttlMs: 1000 });
  let calls = 0;
  const load = memoize(c, async (k) => { calls++; return "conn-" + k; });
  assert.equal(await load("s1"), "conn-s1");
  assert.equal(await load("s1"), "conn-s1");
  assert.equal(calls, 1);
});

test("concurrent misses share one in-flight lookup", async () => {
  // The case that matters: a cold isolate serving a page with three lists fires
  // three identical resolutions at once. Without sharing, the cache is still
  // empty when each starts and saves nothing exactly when it is needed most.
  const c = makeCache({ ttlMs: 1000 });
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const load = memoize(c, async (k) => { calls++; await gate; return "conn-" + k; });

  const all = Promise.all([load("s1"), load("s1"), load("s1")]);
  release();
  assert.deepEqual(await all, ["conn-s1", "conn-s1", "conn-s1"]);
  assert.equal(calls, 1, "three concurrent callers, one lookup");
});

test("different keys are not shared", async () => {
  const c = makeCache({ ttlMs: 1000 });
  let calls = 0;
  const load = memoize(c, async (k) => { calls++; return "conn-" + k; });
  assert.deepEqual(await Promise.all([load("a"), load("b")]), ["conn-a", "conn-b"]);
  assert.equal(calls, 2);
});

test("a failed lookup is not remembered and does not wedge the key", async () => {
  // If the rejected promise stayed in the in-flight map, every later request for
  // that slug would get the same failure forever.
  const c = makeCache({ ttlMs: 1000 });
  let calls = 0;
  const load = memoize(c, async () => { calls++; if (calls === 1) throw new Error("supabase down"); return "conn-ok"; });
  await assert.rejects(load("s1"), /supabase down/);
  assert.equal(await load("s1"), "conn-ok", "the next caller retries rather than inheriting the failure");
});

test("a lookup that resolves to null is retried next time", async () => {
  const c = makeCache({ ttlMs: 1000 });
  let calls = 0;
  const load = memoize(c, async () => { calls++; return calls === 1 ? null : "conn-ok"; });
  assert.equal(await load("s1"), null);
  assert.equal(await load("s1"), "conn-ok", "a site mid-build must not be stuck as missing");
});

test("extra arguments reach the loader", async () => {
  // siteBackendBySlug is called (env, slug) but keyed on the slug — env has to
  // come through as a passenger, or the lookup cannot make its requests.
  const c = makeCache({ ttlMs: 1000 });
  const load = memoize(c, async (k, env) => `${k}:${env.tag}`);
  assert.equal(await load("s1", { tag: "prod" }), "s1:prod");
});
