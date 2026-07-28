// The edge routing table for published sites.
//
// It sits in front of every visitor read, so its failure modes matter more than
// its speed: a route that outlives its database, a cached miss that keeps a
// still-building site broken, or a KV outage that takes the sites down with it.
// All three are tested. Supabase remains the source of truth, so the worst KV
// can do is be slow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupRoute, saveRoute, dropRoute, routeKey } from "../site-routing.mjs";

const CONN = "postgres://u:p@h/site_cafe";

function kvFake(over = {}) {
  const store = new Map();
  const calls = { get: [], put: [], delete: [] };
  const kv = {
    get: async (k) => { calls.get.push(k); if (over.getThrows) throw new Error("kv down"); return store.get(k) ?? null; },
    put: async (k, v) => { calls.put.push([k, v]); if (over.putThrows) throw new Error("kv write failed"); store.set(k, v); },
    delete: async (k) => { calls.delete.push(k); if (over.deleteThrows) throw new Error("kv delete failed"); store.delete(k); },
  };
  return { kv, store, calls };
}

function harness(over = {}) {
  const { kv, store, calls } = kvFake(over);
  const source = { hits: 0 };
  const deps = {
    kv: over.noKv ? null : kv,
    fromSource: async (slug) => { source.hits++; return over.sourceReturns !== undefined ? over.sourceReturns : (slug === "cafe" ? CONN : null); },
    onBackfillError: () => {},
  };
  return { deps, store, calls, source };
}

test("keys are namespaced and case-insensitive", () => {
  assert.equal(routeKey("cafe"), "route:cafe");
  assert.equal(routeKey("CAFE"), "route:cafe", "slugs are lowercased everywhere else too");
});

test("a KV hit skips Supabase entirely", async () => {
  const { deps, store, source } = harness();
  store.set("route:cafe", CONN);
  assert.equal(await lookupRoute(deps, "cafe"), CONN);
  assert.equal(source.hits, 0, "this is the whole point — no cross-region hop");
});

test("a miss falls back to Supabase and backfills", async () => {
  const { deps, store, calls, source } = harness();
  assert.equal(await lookupRoute(deps, "cafe"), CONN);
  assert.equal(source.hits, 1);
  assert.deepEqual(calls.put, [["route:cafe", CONN]]);
  assert.equal(store.get("route:cafe"), CONN, "the next request will not need Supabase");
});

test("an unknown slug is never written", async () => {
  // A slug that does not resolve is usually a build still finishing. Caching the
  // miss would keep a brand-new site broken until the entry expired — and KV
  // entries written without a TTL do not expire at all.
  const { deps, calls } = harness();
  assert.equal(await lookupRoute(deps, "not-a-site"), null);
  assert.deepEqual(calls.put, []);
});

test("with no KV binding it behaves exactly as before", async () => {
  // The namespace does not exist yet. The code has to ship and deploy safely
  // without it, falling back to the Supabase path.
  const { deps, source } = harness({ noKv: true });
  assert.equal(await lookupRoute(deps, "cafe"), CONN);
  assert.equal(source.hits, 1);
});

test("a KV read failure degrades to Supabase, it does not fail the request", async () => {
  const { deps, source } = harness({ getThrows: true });
  assert.equal(await lookupRoute(deps, "cafe"), CONN);
  assert.equal(source.hits, 1, "KV being down must not take the published sites down");
});

test("a KV write failure still returns the answer", async () => {
  const { deps, source } = harness({ putThrows: true });
  assert.equal(await lookupRoute(deps, "cafe"), CONN);
  assert.equal(source.hits, 1);
});

test("KV errors are reported, not swallowed silently", async () => {
  // A namespace that is failing every write would otherwise look exactly like
  // one that is working, just slower — indefinitely.
  const seen = [];
  const { deps } = harness({ getThrows: true });
  deps.onBackfillError = (e) => seen.push(String(e.message));
  await lookupRoute(deps, "cafe");
  assert.deepEqual(seen, ["kv down"]);
});

test("an empty-string value is treated as a miss", async () => {
  // A truthiness bug here would return "" as a connection string and every
  // query would fail with something unrelated to the real cause.
  const { deps, store, source } = harness();
  store.set("route:cafe", "");
  assert.equal(await lookupRoute(deps, "cafe"), CONN);
  assert.equal(source.hits, 1);
});

test("saveRoute writes at build time", async () => {
  const { deps, store } = harness();
  assert.equal(await saveRoute(deps, "cafe", CONN), true);
  assert.equal(store.get("route:cafe"), CONN);
});

test("saveRoute is a no-op without a binding or a connection", async () => {
  const { deps: noKv } = harness({ noKv: true });
  assert.equal(await saveRoute(noKv, "cafe", CONN), false);
  const { deps, calls } = harness();
  assert.equal(await saveRoute(deps, "cafe", ""), false);
  assert.equal(await saveRoute(deps, "cafe", null), false);
  assert.deepEqual(calls.put, [], "never write an empty route");
});

test("saveRoute failing does not throw into the build", async () => {
  // The site is already built and published by then; losing the fast path is
  // not a reason to fail it.
  const { deps } = harness({ putThrows: true });
  assert.equal(await saveRoute(deps, "cafe", CONN), false);
});

test("dropRoute removes the entry", async () => {
  const { deps, store } = harness();
  store.set("route:cafe", CONN);
  assert.equal(await dropRoute(deps, "cafe"), true);
  assert.equal(store.has("route:cafe"), false);
});

test("dropRoute survives a KV failure and a missing binding", async () => {
  const { deps } = harness({ deleteThrows: true });
  assert.equal(await dropRoute(deps, "cafe"), false);
  const { deps: noKv } = harness({ noKv: true });
  assert.equal(await dropRoute(noKv, "cafe"), false);
});

test("a deleted route cannot be resurrected by a stale read", async () => {
  // The ordering that matters: drop the route, and a later lookup must go to
  // Supabase (which no longer has the row) rather than serving the old string
  // at a database that has been dropped.
  const { deps, store } = harness({ sourceReturns: null });
  store.set("route:cafe", CONN);
  await dropRoute(deps, "cafe");
  assert.equal(await lookupRoute(deps, "cafe"), null);
});
