// Batch 231 — SOCIAL SHARE COUNTERS. Per-URL per-network share tallies. Covers increment (atomic, per
// network), aggregate read (total + by_network), top URLs, network normalization, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 231");
const slug = "b231";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const inc = (url, network) => c.post(`/api/db/${slug}/share-counts/increment`, { url, network }).then((r) => r.json);
const read = (url) => c.get(`/api/db/${slug}/share-counts?url=${encodeURIComponent(url)}`).then((r) => r.json);
const top = (q) => c.get(`/api/db/${slug}/share-counts/top${q || ""}`).then((r) => r.json);
const P1 = "https://site.x/post/1", P2 = "https://site.x/post/2";

// --- Increment per network ---
t.eq((await inc(P1, "twitter")).count, 1, "first twitter share → 1");
t.eq((await inc(P1, "twitter")).count, 2, "second → 2");
let r = await inc(P1, "facebook");
t.eq(r.count, 1, "facebook is a separate tally");
t.eq(r.total, 3, "…total across networks is 3");

// --- Aggregate read ---
let a = await read(P1);
t.eq(a.total, 3, "read total 3");
t.eq(a.by_network.twitter, 2, "…twitter 2");
t.eq(a.by_network.facebook, 1, "…facebook 1");

// --- Unshared URL reads zero ---
t.eq((await read("https://site.x/nope")).total, 0, "an unshared URL → total 0");

// --- Network normalization (case/punct stripped) ---
await inc(P1, "Twitter");
t.eq((await read(P1)).by_network.twitter, 3, "'Twitter' normalizes to the same 'twitter' bucket");

// --- Top URLs ---
await inc(P2, "twitter"); await inc(P2, "twitter"); await inc(P2, "twitter"); await inc(P2, "twitter"); await inc(P2, "twitter");
let tp = (await top()).top;
t.eq(tp[0].url, P2, "P2 (5 shares) tops the chart");
t.eq(tp[0].total, 5, "…with total 5");
t.eq((await top("?limit=1")).top.length, 1, "limit caps the list");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/share-counts/increment`, { network: "twitter" })).status, 400, "missing url → 400");
t.eq((await c.post(`/api/db/${slug}/share-counts/increment`, { url: P1 })).status, 400, "missing network → 400");
t.eq((await c.get(`/api/db/${slug}/share-counts`)).status, 400, "read with no ?url → 400");

t.done(); h.restore();
