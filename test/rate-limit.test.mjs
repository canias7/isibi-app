// The throttle on the one API anyone on the internet can call.
//
// Two ways this goes wrong and both are tested here. Too loose and a stranger
// fills a barber shop's booking table with junk or burns their Neon compute.
// Too sticky — a window a blocked caller keeps EXTENDING — and a shared office
// IP is locked out of a site for as long as anyone keeps clicking, which is the
// bug the existing `authThrottle` shipped with.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  limitFor, makeLimiter, bucketKey, tooMany,
  DEFAULT_READ_PER_MIN, DEFAULT_WRITE_PER_MIN, WINDOW_MS,
} from "../rate-limit.mjs";

// A hand-cranked clock: windows have to be testable without sleeping.
function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

// ─────────────────────────────────────────────────────────── which limit applies

test("the defaults apply when nothing is declared", () => {
  assert.equal(limitFor({ method: "GET" }), DEFAULT_READ_PER_MIN);
  assert.equal(limitFor({ method: "POST" }), DEFAULT_WRITE_PER_MIN);
  assert.equal(limitFor({}), DEFAULT_READ_PER_MIN, "no method at all reads as a read");
  assert.notEqual(DEFAULT_READ_PER_MIN, DEFAULT_WRITE_PER_MIN, "a write must not be as cheap as a read");
});

test("only GET counts as a read", () => {
  // Everything else writes a row, including the verbs the API refuses — those
  // should be throttled before they are rejected, not after.
  for (const m of ["POST", "PATCH", "DELETE", "PUT", "post"]) {
    assert.equal(limitFor({ method: m }), DEFAULT_WRITE_PER_MIN, m);
  }
  assert.equal(limitFor({ method: "get" }), DEFAULT_READ_PER_MIN, "case-insensitive");
});

test("the app's own rateLimits beat the defaults, per verb", () => {
  const spec = { rateLimits: { read: 20, write: 5 } };
  assert.equal(limitFor({ spec, method: "GET" }), 20);
  assert.equal(limitFor({ spec, method: "POST" }), 5);
});

test("a half-declared rateLimits only overrides the verb it names", () => {
  assert.equal(limitFor({ spec: { rateLimits: { write: 5 } }, method: "GET" }), DEFAULT_READ_PER_MIN);
  assert.equal(limitFor({ spec: { rateLimits: { read: 20 } }, method: "POST" }), DEFAULT_WRITE_PER_MIN);
});

test("a table's own rateLimit is a WRITE limit and wins", () => {
  // This is what the schema engine has parsed all along: rateLimit/writeLimit/
  // throttle/maxPerMinute are all the same thing, a cap on submissions.
  const spec = { rateLimits: { read: 20, write: 5 } };
  const def = { rateLimit: 2 };
  assert.equal(limitFor({ spec, def, method: "POST" }), 2);
  assert.equal(limitFor({ spec, def, method: "GET" }), 20, "and it does NOT cap reads");
  assert.equal(limitFor({ def, method: "GET" }), DEFAULT_READ_PER_MIN);
});

test("most-specific wins even when it is looser", () => {
  // Deliberate: both numbers are the site owner's own. Neither is a floor being
  // raised by a stranger, so the more specific declaration is the intent.
  assert.equal(limitFor({ spec: { rateLimits: { write: 5 } }, def: { rateLimit: 200 }, method: "POST" }), 200);
});

test("a nonsense limit falls through instead of being obeyed", () => {
  // `rateLimit: 0` is what the schema engine stores for "not declared", so it
  // must not read as "zero requests allowed" and lock the table shut.
  for (const bad of [0, -1, NaN, null, undefined, "", "abc", {}, []]) {
    assert.equal(limitFor({ def: { rateLimit: bad }, method: "POST" }), DEFAULT_WRITE_PER_MIN, JSON.stringify(bad));
    assert.equal(limitFor({ spec: { rateLimits: { write: bad } }, method: "POST" }), DEFAULT_WRITE_PER_MIN, JSON.stringify(bad));
    assert.equal(limitFor({ spec: { rateLimits: { read: bad } }, method: "GET" }), DEFAULT_READ_PER_MIN, JSON.stringify(bad));
  }
});

test("a numeric string is still a number", () => {
  // parseInt lives in the schema engine, but _meta is JSON that has round-tripped
  // through Postgres and back.
  assert.equal(limitFor({ def: { rateLimit: "7" }, method: "POST" }), 7);
  assert.equal(limitFor({ spec: { rateLimits: { read: "9" } }, method: "GET" }), 9);
});

// ────────────────────────────────────────────────────────────────── the counting

test("a caller gets exactly `limit` requests, then 429", () => {
  const l = makeLimiter({ now: clock().now });
  for (let i = 1; i <= 3; i++) {
    const r = l.hit("k", 3);
    assert.equal(r.ok, true, `request ${i}`);
    assert.equal(r.remaining, 3 - i);
  }
  const r = l.hit("k", 3);
  assert.equal(r.ok, false);
  assert.equal(r.limit, 3);
});

test("the window RESETS, and a blocked caller cannot postpone it", () => {
  // The bug this file exists to prevent. Counting with ttl-cache re-stamps the
  // expiry on every set, so a caller who keeps retrying while blocked never gets
  // a fresh window — one bad minute locks a shared IP out indefinitely.
  const k = clock();
  const l = makeLimiter({ windowMs: 1000, now: k.now });
  for (let i = 0; i < 5; i++) l.hit("k", 2);
  assert.equal(l.hit("k", 2).ok, false);

  // Hammer it through the whole window; the reset must still arrive on time.
  for (let i = 0; i < 9; i++) { k.advance(100); assert.equal(l.hit("k", 2).ok, false, `at +${(i + 1) * 100}ms`); }
  k.advance(100);
  assert.equal(l.hit("k", 2).ok, true, "the window ended on schedule despite continuous traffic");
});

test("the window is measured from the first hit, not the last", () => {
  const k = clock();
  const l = makeLimiter({ windowMs: 1000, now: k.now });
  l.hit("k", 2);
  k.advance(900);
  l.hit("k", 2);
  assert.equal(l.hit("k", 2).ok, false, "still inside the first window");
  k.advance(100);
  assert.equal(l.hit("k", 2).ok, true, "1000ms after the FIRST hit");
});

test("retryAfter counts down and is never zero", () => {
  const k = clock();
  const l = makeLimiter({ windowMs: 60_000, now: k.now });
  assert.equal(l.hit("k", 1).retryAfter, 60);
  k.advance(59_500);
  const r = l.hit("k", 1);
  assert.equal(r.ok, false);
  assert.equal(r.retryAfter, 1, "500ms left rounds up to 1, never 0 — a client must not retry instantly");
});

test("separate keys are separate budgets", () => {
  const l = makeLimiter({ now: clock().now });
  l.hit("a", 1); l.hit("a", 1);
  assert.equal(l.hit("a", 1).ok, false);
  assert.equal(l.hit("b", 1).ok, true, "one flooder must not block everyone else");
});

test("the limit is read per call, so a schema change takes effect at once", () => {
  const l = makeLimiter({ now: clock().now });
  l.hit("k", 1);
  assert.equal(l.hit("k", 1).ok, false);
  assert.equal(l.hit("k", 10).ok, true, "a revise that raises the cap is not stuck behind a cached limit");
});

test("the table is bounded, and it drops expired entries before live ones", () => {
  // An attacker rotating source IPs would otherwise grow an isolate's memory
  // until it was evicted.
  const k = clock();
  const l = makeLimiter({ windowMs: 1000, max: 10, now: k.now });
  for (let i = 0; i < 10; i++) l.hit(`old-${i}`, 100);
  k.advance(1001);
  for (let i = 0; i < 200; i++) l.hit(`new-${i}`, 100);
  assert.ok(l.size <= 11, `bounded, got ${l.size}`);
  // The newest counters survived — an eviction must not hand the current
  // flooder a fresh allowance.
  assert.equal(l.hit("new-199", 100).remaining, 98);
});

test("a live counter survives a burst of new keys when there is room", () => {
  const k = clock();
  const l = makeLimiter({ windowMs: 1000, max: 50, now: k.now });
  l.hit("victim", 3); l.hit("victim", 3);
  for (let i = 0; i < 20; i++) l.hit(`other-${i}`, 3);
  assert.equal(l.hit("victim", 3).ok, true);
  assert.equal(l.hit("victim", 3).ok, false, "and its count was never lost");
});

test("a broken window is refused rather than silently disabling the limiter", () => {
  for (const bad of [0, -1, NaN, "60000", null]) {
    assert.throws(() => makeLimiter({ windowMs: bad }), /windowMs/, JSON.stringify(bad));
  }
});

// ───────────────────────────────────────────────────────────────── which bucket

test("reads share one bucket per site, writes get one per table", () => {
  // Reads: the budget protects Neon compute, and a page with five lists should
  // not therefore be allowed five times the reads.
  const a = bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "menu", method: "GET" });
  const b = bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "hours", method: "GET" });
  assert.equal(a, b);
  // Writes: a table declaring 5/min must not be sharing those 5 with the
  // contact form.
  const c = bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "bookings", method: "POST" });
  const d = bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "messages", method: "POST" });
  assert.notEqual(c, d);
});

test("a read and a write never share a bucket", () => {
  const r = bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "bookings", method: "GET" });
  const w = bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "bookings", method: "POST" });
  assert.notEqual(r, w, "300 reads would otherwise consume the 60 writes");
});

test("buckets are per IP and per site", () => {
  const base = { ip: "1.1.1.1", slug: "cafe", table: "bookings", method: "POST" };
  // Per-site alone would let one attacker lock every visitor out of a site.
  assert.notEqual(bucketKey(base), bucketKey({ ...base, ip: "2.2.2.2" }));
  // Per-IP alone would let a busy site throttle a visitor on an unrelated one.
  assert.notEqual(bucketKey(base), bucketKey({ ...base, slug: "barber" }));
});

test("slug and table are case-folded, so casing cannot buy a second budget", () => {
  assert.equal(
    bucketKey({ ip: "1.1.1.1", slug: "Cafe", table: "Bookings", method: "POST" }),
    bucketKey({ ip: "1.1.1.1", slug: "cafe", table: "bookings", method: "POST" }),
  );
});

test("an unknown IP shares one bucket rather than going unlimited", () => {
  const k = { slug: "cafe", table: "bookings", method: "POST" };
  assert.equal(bucketKey({ ...k, ip: "" }), bucketKey({ ...k, ip: null }));
  assert.equal(bucketKey({ ...k, ip: undefined }), bucketKey(k));
  assert.match(bucketKey(k), /unknown/);
});

test("the IP cannot collide its way into someone else's bucket", () => {
  // Everything before the IP is fixed-shape, so a crafted address is only ever
  // its own key.
  const k = { slug: "cafe", table: "bookings", method: "POST" };
  assert.notEqual(bucketKey({ ...k, ip: "x" }), bucketKey({ ...k, slug: "cafe:bookings:x", ip: "" }));
});

// ─────────────────────────────────────────────────────────────────── the answer

test("429 carries Retry-After and a message a visitor can act on", () => {
  const r = tooMany({ limit: 60, retryAfter: 42 });
  assert.equal(r.status, 429);
  assert.equal(r.headers["Retry-After"], "42");
  assert.equal(r.body.code, "rate_limit");
  assert.match(r.body.error, /try again/i);
});

test("Retry-After is always present, even with nothing to say", () => {
  assert.equal(tooMany({}).headers["Retry-After"], "60");
});

test("the window is a minute, which is what every limit above is per", () => {
  assert.equal(WINDOW_MS, 60_000);
});
