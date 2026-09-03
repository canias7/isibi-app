// One submission, once — the store's decisions driven, and every hop from the
// kit's header to the Worker's replay read off the source.
//
// The failure this exists to catch is the one the module's own comment names:
// a double-click writing two bookings. The store is small; what has to stay
// true is WHERE it sits on the write path (after the spam gate, before the
// upstream write), WHAT it remembers (a success and nothing else) and WHEN the
// page renews its key (after a success and never before).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  takeIdemKey, idemId, idemStorable, replayHeaders, makeIdem,
  IDEM_HEADER, IDEM_TTL_S, IDEM_MAX_BODY, IDEM_REPLAY_HEADER,
} from "../site-idem.mjs";

const KEY = "3f9c2b1a4d5e6f708192a3b4c5d6e7f8";

// ── the key ──────────────────────────────────────────────────────────────────

test("a key is read from the header, whatever its case, and only when it is a key", () => {
  assert.equal(takeIdemKey(new Headers({ "Idempotency-Key": KEY })), KEY);
  assert.equal(takeIdemKey(new Headers({ "IDEMPOTENCY-KEY": KEY })), KEY);
  assert.equal(takeIdemKey(new Headers()), null);
  assert.equal(takeIdemKey(null), null);
  // Too short to be unguessable, too long to be a KV key, or not a key at all —
  // none may become a shared bucket every request falls into.
  for (const bad of ["short", "x".repeat(65), "has space in it 1234", "key/with/slashes/1", ""]) {
    assert.equal(takeIdemKey(new Headers({ [IDEM_HEADER]: bad })), null, JSON.stringify(bad));
  }
});

test("the id is scoped by site and by what was submitted to", () => {
  assert.equal(idemId("Cafe", "data/bookings", KEY), "idem:cafe:data/bookings:" + KEY);
  assert.notEqual(idemId("cafe", "data/bookings", KEY), idemId("cafe", "data/reviews", KEY),
    "one key reused across two forms must not hand the second the first's answer");
  assert.notEqual(idemId("cafe", "checkout", KEY), idemId("bar", "checkout", KEY));
});

test("only a success is worth remembering, and not a huge one", () => {
  for (const s of [200, 201, 204]) assert.equal(idemStorable(s, "{}"), true, s);
  for (const s of [400, 403, 409, 422, 500, 503, 0, undefined]) assert.equal(idemStorable(s, "{}"), false, String(s));
  assert.equal(idemStorable(201, "x".repeat(IDEM_MAX_BODY)), true);
  assert.equal(idemStorable(201, "x".repeat(IDEM_MAX_BODY + 1)), false);
});

test("a replay is marked as one, and carries the answer's own content type", () => {
  assert.deepEqual(replayHeaders({ ct: "application/json; charset=utf-8" }),
    { "content-type": "application/json; charset=utf-8", [IDEM_REPLAY_HEADER]: "1" });
  assert.equal(replayHeaders({})["content-type"], "application/json");
});

// ── the store ────────────────────────────────────────────────────────────────

const V = { status: 201, body: '{"id":7}', ct: "application/json" };

test("written, then read back from memory with no shared layer at all", async () => {
  const s = makeIdem();
  const e = s.for("cafe", "data/bookings", KEY);
  assert.equal(await e.read(), null);
  assert.equal(await e.write(V), true);
  assert.deepEqual(await e.read(), V);
  assert.equal(s.size(), 1);
});

test("a refusal is NOT remembered — the corrected retry carries the same key", async () => {
  const puts = [];
  const s = makeIdem({ put: async (id, v) => { puts.push([id, v]); } });
  const e = s.for("cafe", "data/bookings", KEY);
  assert.equal(await e.write({ status: 409, body: '{"code":"overlap"}', ct: "application/json" }), false);
  assert.equal(await e.read(), null);
  assert.deepEqual(puts, [], "and the shared layer was never written");
});

test("memory misses fall through to the shared layer, and warm memory on a hit", async () => {
  let gets = 0;
  const s = makeIdem({ get: async () => { gets++; return V; } });
  const e = s.for("cafe", "data/bookings", KEY);
  assert.deepEqual(await e.read(), V);
  assert.deepEqual(await e.read(), V);
  assert.equal(gets, 1, "the second read came from memory");
});

test("a shared value in the wrong shape is a miss, never a replay of garbage", async () => {
  for (const junk of [null, "string", 42, { status: "201", body: "{}" }, { status: 201 }, []]) {
    const s = makeIdem({ get: async () => junk });
    assert.equal(await s.for("cafe", "x", KEY).read(), null, JSON.stringify(junk));
  }
});

test("the shared layer throwing on either side is a miss or a silent write, never an error", async () => {
  const s = makeIdem({ get: async () => { throw new Error("kv down"); }, put: async () => { throw new Error("kv down"); } });
  const e = s.for("cafe", "data/bookings", KEY);
  assert.equal(await e.read(), null);
  assert.equal(await e.write(V), true, "memory still holds it");
  assert.deepEqual(await e.read(), V);
});

test("an answer expires after the window", async () => {
  let t = 1_000_000;
  const s = makeIdem({ now: () => t });
  const e = s.for("cafe", "data/bookings", KEY);
  await e.write(V);
  t += IDEM_TTL_S * 1000 - 1;
  assert.deepEqual(await e.read(), V);
  t += 2;
  assert.equal(await e.read(), null);
  assert.equal(IDEM_TTL_S, 600);
});

test("per-call io wins over the factory's, which is how a per-request env binds to a long-lived store", async () => {
  const s = makeIdem({ get: async () => { throw new Error("factory get should not run"); } });
  const e = s.for("cafe", "x", KEY, { get: async () => V });
  assert.deepEqual(await e.read(), V);
  // And `null` per call means "no shared layer this time", not "use the factory's".
  const s2 = makeIdem({ get: async () => V });
  assert.equal(await s2.for("cafe", "y", KEY, { get: null }).read(), null);
});

test("memory is bounded: expired entries go first, then the oldest", async () => {
  let t = 0;
  const s = makeIdem({ now: () => t, maxMemory: 3 });
  for (let i = 0; i < 3; i++) { await s.for("cafe", "x", KEY.slice(0, 30) + String(i).padStart(2, "0")).write(V); }
  assert.equal(s.size(), 3);
  await s.for("cafe", "x", KEY.slice(0, 30) + "99").write(V);
  assert.equal(s.size(), 3, "the oldest was dropped to make room");
  t += IDEM_TTL_S * 1000 + 1;
  await s.for("cafe", "x", KEY.slice(0, 30) + "98").write(V);
  assert.equal(s.size(), 1, "every expired entry went before anything else did");
});

// ── the wire ─────────────────────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

test("the Worker's store is ONE, at module scope, bound to the request's KV per call", () => {
  assert.match(worker, /\nconst SITE_IDEM = makeIdem\(\);/, "a store made per request forgets the first press before the second arrives");
  const fn = between(worker, "function idemFor(env, slug, scope, key) {", "\nasync function proxySiteService(");
  assert.match(fn, /env && env\.SITE_API_CACHE/, "the KV namespace is not read");
  assert.match(fn, /SITE_IDEM\.for\(slug, scope, key, \{/);
  assert.match(fn, /kv\.get\(id, \{ type: "json" \}\)/);
  assert.match(fn, /kv\.put\(id, JSON\.stringify\(v\), \{ expirationTtl: ttl \}\)/);
  assert.match(fn, /get: kv \? .* : null/, "without KV the get must be null, not a call on undefined");
});

test("the data proxy reads the key AFTER the spam gate and BEFORE the upstream write, and stores only what came back", () => {
  const proxy = between(worker, "async function proxySiteService(", "\n// ── Cloudflare for SaaS");
  const gate = proxy.indexOf("const gate = await turnstileGate(");
  const read = proxy.indexOf("const prior = await idem.read();");
  const upstream = proxy.indexOf("const r = await fetch(target, {");
  const write = proxy.indexOf("idem.write({ status: r.status, body, ct:");
  const notify = proxy.indexOf("notifyOwnerOfSubmission(env, ctx, {");
  for (const [n, i] of Object.entries({ gate, read, upstream, write, notify })) assert.ok(i > 0, `landmark missing: ${n}`);
  assert.ok(gate < read, "the replay must not skip the spam gate's strip of the token");
  assert.ok(read < upstream, "a replay that still reaches Postgres is the bug");
  assert.ok(upstream < write && write < notify, "the answer is remembered after the upstream and before the slow hooks");
  // Scoped to a data POST and to the table, never to a read or a member edit.
  const scope = between(proxy, "let idem = null;", "const prior = await idem.read();");
  assert.match(scope, /which === "data" && request\.method === "POST"/);
  assert.match(scope, /takeIdemKey\(request\.headers\)/);
  assert.match(scope, /"data\/" \+ String\(path\)\.split\("\/"\)\[0\]\.toLowerCase\(\)/, "the scope is not the table");
  assert.match(proxy, /if \(prior\) return new Response\(prior\.body, \{ status: prior\.status, headers: replayHeaders\(prior\) \}\);/);
  // Off the customer's wait when the runtime allows it.
  const after = between(proxy, "idem.write({ status: r.status, body, ct:", "// TELL THE OWNER A BOOKING ARRIVED.");
  assert.match(after, /ctx\.waitUntil\(w\); else await w;/);
});

test("checkout honours the same key, cloning the answer so the customer still gets theirs", () => {
  const route = between(worker, 'url.pathname.endsWith("/checkout")', 'url.pathname.endsWith("/uploads")');
  const key = route.indexOf("const ckey = takeIdemKey(request.headers);");
  const read = route.indexOf("const prior = cidem ? await cidem.read() : null;");
  const call = route.indexOf("const cres = await handleCheckout({");
  const clone = route.indexOf("await cres.clone().text()");
  const write = route.indexOf("cidem.write({ status: cres.status, body: ctext,");
  for (const [n, i] of Object.entries({ key, read, call, clone, write })) assert.ok(i > 0, `landmark missing: ${n}`);
  assert.ok(key < read && read < call && call < clone && clone < write);
  assert.match(route, /idemFor\(env, cslug, "checkout", ckey\)/);
  assert.match(route, /return cres;/);
});

test("the kit sends the header on every submission and checkout, and renews the key ONLY after a success", () => {
  assert.match(rows, /const IDEM_HEADER = "Idempotency-Key";/);
  assert.equal("Idempotency-Key".toLowerCase(), IDEM_HEADER, "the kit and the Worker spell the header differently");
  const mint = between(rows, "function useIdemKey() {", "/** PostgREST's equality filter");
  assert.match(mint, /React\.useRef<string \| null>\(null\)/, "the key must live for the component, not per render");
  assert.match(mint, /renew: \(\) => \{ ref\.current = freshKey\(\); \}/);
  assert.match(rows, /crypto\.randomUUID\(\)\.replace\(\/-\/g, ""\)/, "the key is not unguessable");

  const create = between(rows, "export function useCreateRow<T = Row>(table: string) {", "/** One line of a basket.");
  assert.match(create, /const idem = useIdemKey\(\);/);
  assert.match(create, /headers: idem\.header\(\),/, "the header is minted and never sent");
  const sendAt = create.indexOf("await send<unknown>(base(table), {");
  const renewAt = create.indexOf("idem.renew();");
  const finallyAt = create.indexOf("} finally {");
  assert.ok(sendAt > 0 && renewAt > sendAt && renewAt < finallyAt,
    "renew must follow the send inside the try — renewing before it, or in finally, makes a refused retry a new submission");

  const checkout = between(rows, "export function useCheckout(table: string) {", "export type UpdateArg<T>");
  assert.match(checkout, /\.\.\.idem\.header\(\)/, "checkout does not carry the key");
  const okAt = checkout.indexOf("idem.renew();");
  const throwAt = checkout.indexOf('throw new Error(data?.error || "We couldn\'t start that payment.");');
  const goAt = checkout.indexOf("window.location.href = data.url as string;");
  assert.ok(throwAt > 0 && okAt > throwAt && okAt < goAt, "checkout renews before it knows the session opened, or never");
});
