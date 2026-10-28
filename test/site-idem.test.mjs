// One submission, once — the store's decisions driven, and every hop from the
// kit's header to the Worker's replay read off the source.
//
// The failure this exists to catch is the one the module's own comment names:
// a double-click writing two bookings. The store is small; what has to stay
// true is WHERE it sits on the write path (before the spam gate and the
// upstream write), WHAT it remembers (a success and nothing else) and WHEN the
// page renews its key (after a success and never before).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
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

const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

// The replay store moved into the site's own Worker (2026-10-28: the site's own
// Worker): `ownDataWrite` in builder/lovable/template/src/server.ts keeps the
// first 2xx answer in the site's own bucket at `idem/<table>/<key>`. server.ts
// imports TanStack Start, which is not installed here, so the handler and the
// helpers above it are cut out by landmark, transpiled and run for real; the
// follow-ups (`runSiteEffects`) are counted by a stand-in.
let serverLoads = 0;
async function loadOwnDataWrite() {
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const part = between(src, "let anonTok = \"\";", "\n// ── THIS SITE SIGNS ITS OWN VISITORS IN", "ownDataWrite and its helpers");
  assert.match(part, /export async function ownDataWrite\(/);
  // The site's own limiter (lib/site-limit.ts), real, beside it.
  const lim = fs.readFileSync(new URL("../builder/lovable/template/src/lib/site-limit.ts", import.meta.url), "utf8").replace(/^export /gm, "");
  const body = "const SITE_SLUG = 'ember-cart';\nconst runSiteEffects = (...a) => globalThis.__siteEffects(...a);\n" + lim + "\n" + part;
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import("data:text/javascript," + encodeURIComponent(js + "\n// " + ++serverLoads))).ownDataWrite;
}
function ownSite({ upstream = () => new Response('[{"id":1}]', { status: 201, headers: { "content-type": "application/json" } }), failGet = false } = {}) {
  const store = new Map();
  const bucket = {
    get: async (k) => { if (failGet) throw new Error("down"); return store.has(k) ? { text: async () => store.get(k) } : null; },
    put: async (k, v) => { store.set(k, v); },
  };
  const env = { DATA_API_BASE: "https://ep-1.data.neon.tech/rest", AUTH_BASE: "https://ep-1.auth.neon.tech/auth", SITE_TABLES: "[]", OWN_BUCKET: "1", SITES: bucket };
  const ups = [], effects = [];
  return { store, env, ups, effects, upstream,
    install() {
      const real = globalThis.fetch;
      globalThis.__siteEffects = async (...a) => { effects.push(a); return []; };
      globalThis.fetch = async (u, init = {}) => { ups.push([String(u), init.method, String(init.body)]); return upstream(); };
      return () => { globalThis.fetch = real; delete globalThis.__siteEffects; };
    } };
}
const press = (write, site, { method = "POST", key = KEY, body = '{"name":"Ada"}', table = "bookings" } = {}) => {
  const url = new URL(`https://ember-cart.gofarther.app/api/db/ember-cart/data/${table}`);
  const headers = { "content-type": "application/json", authorization: "Bearer visitor" };
  if (key) headers["Idempotency-Key"] = key;
  return write(new Request(url, { method, headers, body }), site.env, url);
};

test("the site's store is its own bucket, keyed by table and key, and outlives the request", async () => {
  // A store made per request forgets the first press before the second arrives;
  // the bucket is the site's own, so it is shared by every isolate.
  const write = await loadOwnDataWrite();
  const site = ownSite();
  const restore = site.install();
  try {
    const first = await press(write, site);
    assert.equal(first.status, 201);
    assert.deepEqual([...site.store.keys()], ["idem/bookings/" + KEY]);
    const kept = JSON.parse(site.store.get("idem/bookings/" + KEY));
    assert.deepEqual([kept.status, kept.body], [201, '[{"id":1}]']);
    // A fresh copy of the handler (another isolate) still replays from the bucket.
    const again = await press(await loadOwnDataWrite(), site);
    assert.equal(again.status, 201);
    assert.equal(again.headers.get("x-idempotent-replay"), "1");
    assert.equal(await again.text(), '[{"id":1}]');
    assert.equal(site.ups.length, 1, "the second press never reached the database");
    // The scope is the table: the same key on another table is another press.
    await press(write, site, { table: "orders" });
    assert.equal(site.ups.length, 2);
    // A read failure of the memory is no memory: the press goes through.
    const down = ownSite({ failGet: true });
    const r2 = down.install();
    try { assert.equal((await press(write, down)).status, 201); assert.equal(down.ups.length, 1); } finally { r2(); }
  } finally { restore(); }
});

test("the site reads the key BEFORE the upstream write, compares the contents, and stores only what came back", async () => {
  const write = await loadOwnDataWrite();
  const site = ownSite();
  const restore = site.install();
  try {
    await press(write, site, { body: '{"name":"Ada","cf-turnstile-response":"tok-1"}' });
    // A double-click sends one single-use spam token twice (audit A30-4); the
    // token is dropped before the contents are compared, so the second press
    // is replayed, not refused or written again.
    const second = await press(write, site, { body: '{"name":"Ada","cf-turnstile-response":"tok-2"}' });
    assert.equal(second.headers.get("x-idempotent-replay"), "1");
    assert.equal(site.ups.length, 1, "a replay that still reaches Postgres is the bug");
    assert.equal(site.ups[0][2], '{"name":"Ada"}', "the token never reaches the database");
    assert.equal(site.effects.length, 1, "the follow-ups ran once, for the write, never for the replay");
    // Another submission under the same key is not replayed (audit A30-5).
    const other = await press(write, site, { body: '{"name":"Bo"}' });
    assert.equal(other.headers.get("x-idempotent-replay"), null);
    assert.equal(site.ups.length, 2);
  } finally { restore(); }

  // A refusal is not remembered: the retry goes through.
  let n = 0;
  const flaky = ownSite({ upstream: () => (++n === 1 ? new Response('{"message":"no"}', { status: 409 }) : new Response("[]", { status: 201 })) });
  const r2 = flaky.install();
  try {
    assert.equal((await press(write, flaky)).status, 409);
    assert.equal(flaky.store.size, 0);
    assert.equal(flaky.effects.length, 0);
    assert.equal((await press(write, flaky)).status, 201);
    assert.equal(flaky.ups.length, 2);
  } finally { r2(); }

  // Scoped to a data POST: a PATCH with a key is not remembered.
  const patch = ownSite();
  const r3 = patch.install();
  try {
    await press(write, patch, { method: "PATCH" });
    await press(write, patch, { method: "PATCH" });
    assert.equal(patch.store.size, 0);
    assert.equal(patch.ups.length, 2);
  } finally { r3(); }
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
