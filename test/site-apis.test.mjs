import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeApi, secretsNeeded, fill, takeParams, cacheKey, callApi, apiFor,
  MAX_RESPONSE, MAX_PER_MINUTE, TIMEOUT_MS, MAX_TTL, kvKeyFor, kvEligible, KV_MIN_TTL,
} from "../site-apis.mjs";

const DECL = {
  name: "rates",
  url: "https://api.example.com/v1/latest?base={{param.base}}&key={{RATES_KEY}}",
  headers: { Authorization: "Bearer {{RATES_KEY}}", Accept: "application/json" },
  params: ["base"],
  cacheSeconds: 60,
};
const SECRETS = { RATES_KEY: "sk_live_rates_key" };

function deps(over = {}) {
  const sent = [];
  const store = new Map();
  const { res, throws, ...rest } = over;
  const d = {
    secrets: SECRETS,
    fetch: async (url, init) => {
      sent.push({ url, init });
      if (throws) { const e = new Error("boom " + url); e.name = throws; throw e; }
      return res || {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ usd: 1.09 }),
      };
    },
    cacheGet: async (k) => store.get(k) || null,
    cacheSet: async (k, v) => { store.set(k, v); },
    ...rest,
  };
  d.sent = sent;
  d.store = store;
  return d;
}
// `ownerId` is supplied by default because it is not optional in production:
// without one `cacheKey` answers null and NOTHING is cached, which is the
// fail-safe and would make every cache test below pass for the wrong reason.
// The tests that care about its absence pass `ownerId: null` explicitly.
const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const go = (d, over = {}) =>
  callApi(d, { ownerId: OWNER_A, slug: "cafe", api: normalizeApi(DECL), params: { base: "EUR" }, now: 1, ...over });
const keyOf = (over = {}) =>
  cacheKey({ ownerId: OWNER_A, slug: "cafe", api: normalizeApi(DECL), params: { base: "EUR" }, ...over });

// ------------------------------------------------------------------- shape

test("a declaration is normalised, or it is not a declaration", () => {
  const a = normalizeApi(DECL);
  assert.equal(a.name, "rates");
  assert.equal(a.method, "GET");
  assert.deepEqual(a.params, ["base"]);
  assert.equal(a.ttl, 60);
  for (const bad of [null, {}, { name: "x" }, { url: "https://x" }, { name: "9x", url: "https://x" }, { name: "a b", url: "https://x" }]) {
    assert.equal(normalizeApi(bad), null, JSON.stringify(bad));
  }
});

test("only GET and POST, whatever was asked for", () => {
  for (const m of ["DELETE", "PUT", "PATCH", "TRACE", "", "get"]) {
    const a = normalizeApi({ ...DECL, method: m });
    assert.ok(a.method === "GET" || a.method === "POST", m);
    assert.notEqual(a.method, m.toUpperCase() === "POST" ? "GET" : a.method === "POST" ? "GET" : "POST");
  }
  assert.equal(normalizeApi({ ...DECL, method: "post" }).method, "POST");
  assert.equal(normalizeApi({ ...DECL, method: "DELETE" }).method, "GET");
});

test("headers that would redirect or leak are dropped", () => {
  const a = normalizeApi({ ...DECL, headers: { Host: "evil.example", Cookie: "a=b", "Content-Length": "4", "X-Ok": "yes", "bad header!": "x" } });
  assert.deepEqual(Object.keys(a.headers), ["X-Ok"]);
});

test("the cache window is clamped, never trusted", () => {
  assert.equal(normalizeApi({ ...DECL, cacheSeconds: -5 }).ttl, 0);
  assert.equal(normalizeApi({ ...DECL, cacheSeconds: 999999 }).ttl, MAX_TTL);
  assert.equal(normalizeApi({ ...DECL, cacheSeconds: "nonsense" }).ttl, 60, "the default when unreadable");
});

test("secretsNeeded finds every placeholder, wherever it is", () => {
  assert.deepEqual(secretsNeeded(normalizeApi(DECL)).sort(), ["RATES_KEY"]);
  const a = normalizeApi({ ...DECL, method: "POST", body: '{"k":"{{BODY_KEY}}"}', headers: { "X-A": "{{HEAD_KEY}}" } });
  assert.deepEqual(secretsNeeded(a).sort(), ["BODY_KEY", "HEAD_KEY", "RATES_KEY"]);
});

// --------------------------------------------------------------- filling in

test("a secret is substituted and a parameter is URL-ENCODED", () => {
  const f = fill("https://x/?q={{param.base}}&k={{RATES_KEY}}", { secrets: SECRETS, params: { base: "a b&evil=1" } });
  assert.equal(f.missing, null);
  assert.ok(f.text.includes("k=sk_live_rates_key"));
  // The injection this exists to stop: unencoded, that `&` appends a query
  // parameter of the caller's choosing to the OWNER's request.
  assert.ok(!f.text.includes("&evil=1"), f.text);
  assert.ok(f.text.includes("a%20b%26evil%3D1"), f.text);
});

test("a MISSING secret refuses rather than sending an empty one", () => {
  // `Authorization: Bearer ` is a request some APIs answer 200 to with public
  // data, so the page would render something plausible and wrong.
  const f = fill("k={{NOPE}}", { secrets: SECRETS, params: {} });
  assert.equal(f.missing, "NOPE");
  assert.ok(!f.text.includes("k=&") && f.text.includes("{{NOPE}}"), "and it is not blanked out");
});

test("an undeclared parameter is blank, not passed through", () => {
  const f = fill("q={{param.other}}", { secrets: SECRETS, params: {} });
  assert.equal(f.text, "q=");
  assert.equal(f.missing, null, "a missing PARAM is not a missing SECRET");
});

test("takeParams is an allow-list", () => {
  const api = normalizeApi(DECL);
  const sp = new URLSearchParams({ base: "EUR", host: "evil.example", key: "stolen" });
  assert.deepEqual(takeParams(api, sp), { base: "EUR" });
});

test("a parameter cannot be arbitrarily long", () => {
  const sp = new URLSearchParams({ base: "x".repeat(5000) });
  assert.equal(takeParams(normalizeApi(DECL), sp).base.length, 200);
});

// ------------------------------------------------------------------ calling

test("the upstream is called with the filled url and headers", async () => {
  const d = deps();
  const r = await go(d);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { usd: 1.09 });
  assert.equal(d.sent.length, 1);
  assert.ok(d.sent[0].url.includes("base=EUR"));
  assert.ok(d.sent[0].url.includes("key=sk_live_rates_key"));
  assert.equal(d.sent[0].init.headers.Authorization, "Bearer sk_live_rates_key");
});

test("NOTHING from upstream comes back except status and body", async () => {
  // Their headers can carry set-cookie onto our origin, and rate-limit or debug
  // headers echo the key back — the credential leaving by the door it entered.
  const d = deps({
    res: {
      status: 200,
      headers: new Headers({ "content-type": "application/json", "set-cookie": "sid=1", "x-api-key": SECRETS.RATES_KEY }),
      text: async () => "{}",
    },
  });
  const r = await go(d);
  assert.deepEqual(Object.keys(r).sort(), ["body", "contentType", "status"]);
  assert.ok(!JSON.stringify(r).includes(SECRETS.RATES_KEY));
});

test("a missing secret is 503 and names nothing to the visitor", async () => {
  const d = deps({ secrets: {} });
  const r = await go(d);
  assert.equal(r.status, 503);
  assert.equal(d.sent.length, 0, "nothing is sent");
  assert.ok(!JSON.stringify(r.body).includes("RATES_KEY"), "the visitor learns no key names");
  assert.equal(r.missing, "RATES_KEY", "the owner's log does");
});

test("a blocked destination is refused before the call", async () => {
  const d = deps();
  const api = normalizeApi({ ...DECL, url: "http://169.254.169.254/latest/meta-data/" });
  const r = await callApi(d, { slug: "cafe", api, params: {} });
  assert.equal(r.status, 502);
  assert.equal(d.sent.length, 0);
  assert.ok(r.refused);
});

test("plain http is refused too", async () => {
  const d = deps();
  const api = normalizeApi({ ...DECL, url: "http://api.example.com/x" });
  assert.equal((await callApi(d, { slug: "cafe", api, params: {} })).status, 502);
  assert.equal(d.sent.length, 0);
});

test("a timeout never quotes the request", async () => {
  // The url can carry the key in a query string, and an exception message
  // quotes the request.
  const d = deps({ throws: "TimeoutError" });
  const r = await go(d);
  assert.equal(r.status, 504);
  assert.ok(!JSON.stringify(r).includes(SECRETS.RATES_KEY), JSON.stringify(r));
  assert.ok(!JSON.stringify(r).includes("api.example.com"), JSON.stringify(r));
  assert.equal(r.reason, "TimeoutError");
});

test("an oversized response is refused rather than rendered", async () => {
  const d = deps({ res: { status: 200, headers: new Headers(), text: async () => "x".repeat(MAX_RESPONSE + 1) } });
  assert.equal((await go(d)).status, 502);
});

test("a non-json answer comes back as text, not as a parse failure", async () => {
  const d = deps({ res: { status: 200, headers: new Headers({ "content-type": "text/csv" }), text: async () => "a,b\n1,2" } });
  const r = await go(d);
  assert.equal(r.status, 200);
  assert.equal(r.body, "a,b\n1,2");
  assert.equal(r.contentType, "text/plain");
});

test("json that will not parse is passed through as text", async () => {
  const d = deps({ res: { status: 200, headers: new Headers({ "content-type": "application/json" }), text: async () => "{not json" } });
  assert.equal((await go(d)).body, "{not json");
});

// ------------------------------------------------------------------ caching

test("a second identical read does not spend the owner's quota", async () => {
  const d = deps();
  await go(d);
  const r = await go(d);
  assert.equal(d.sent.length, 1, "one upstream call");
  assert.equal(r.cached, true);
  assert.deepEqual(r.body, { usd: 1.09 });
});

test("different parameters are different answers", async () => {
  const d = deps();
  await go(d, { params: { base: "EUR" } });
  await go(d, { params: { base: "GBP" } });
  assert.equal(d.sent.length, 2);
  assert.notEqual(await keyOf({ params: { base: "EUR" } }), await keyOf({ params: { base: "GBP" } }));
  // An absent parameter is not the same request as a supplied one, and both
  // are keyed rather than one falling through to the other's answer.
  assert.notEqual(await keyOf({ params: {} }), await keyOf({ params: { base: "EUR" } }));
});

test("and different SITES never share one", async () => {
  assert.notEqual(await keyOf({ slug: "cafe" }), await keyOf({ slug: "barber" }));
});

test("a FAILURE is never cached", async () => {
  // Held for an hour, somebody else's thirty-second blip becomes an hour of a
  // broken page with nothing the owner can do but wait.
  for (const status of [500, 502, 401, 404, 429]) {
    const d = deps({ res: { status, headers: new Headers(), text: async () => "no" } });
    await go(d);
    await go(d);
    assert.equal(d.sent.length, 2, "status " + status);
  }
});

test("ttl 0 means never cached", async () => {
  const d = deps();
  const api = normalizeApi({ ...DECL, cacheSeconds: 0 });
  await callApi(d, { slug: "cafe", api, params: {} });
  await callApi(d, { slug: "cafe", api, params: {} });
  assert.equal(d.sent.length, 2);
});

// ------------------------------------------------------------------ lookup

test("apiFor resolves only what the site declared", () => {
  const spec = { apis: [DECL] };
  assert.equal(apiFor(spec, "rates").name, "rates");
  assert.equal(apiFor(spec, "RATES").name, "rates", "case-folded");
  assert.equal(apiFor(spec, "other"), null);
  assert.equal(apiFor({ apis: [] }, "rates"), null);
  assert.equal(apiFor(null, "rates"), null);
  assert.equal(apiFor({}, "rates"), null);
});

// ------------------------------------------------------------------ wiring

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const has = (re, why) => assert.ok(re.test(worker), why);

test("the route exists and reads the site's own vault", () => {
  has(/callApi\(/, "the module is called");
  const i = worker.indexOf("async function siteApiDeps(");
  assert.ok(i > 0, "the deps factory exists");
  const fn = worker.slice(i, i + 2200);
  assert.ok(/FROM _secrets WHERE name=\?/.test(fn), "secrets come from the site's own database");
  assert.ok(/readSecret\(/.test(fn), "and are decrypted, not read raw");
});

test("the SECRETS never reach the response", () => {
  const i = worker.indexOf('url.pathname.includes("/api/")');
  assert.ok(i > 0, "the dispatch exists");
  const block = worker.slice(i, i + 2500);
  // `out` carries `missing` and `refused` for the owner's log; only status and
  // body may be sent back.
  assert.ok(/Response\.json\(out\.body/.test(block), "only the body is returned");
  assert.ok(!/Response\.json\(out\)/.test(block), "never the whole decision object");
});

test("the DESIGNER can declare one, or nothing ever reaches this route", () => {
  // ANCHORED ON THE FIELD, NOT ITS INDENT. This pinned six spaces and
  // went red when `backend` nested it one level deeper — a test about
  // whitespace, on a claim about what the designer can declare.
  const i = worker.search(/^\s+apis: \{/m);
  assert.ok(i > 0, "the design_schema field exists");
  const field = worker.slice(i, i + 3000);
  assert.ok(/\{\{/.test(field), "the placeholder syntax is stated");
  assert.ok(/param\./.test(field), "and how a page passes a value");
});

test("the client can call it, or a page cannot use it", () => {
  const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  assert.ok(/export function useApi/.test(rows), "the hook exists");
  assert.ok(/\/api\/db\/\$\{siteSlug\(\)\}\/api\//.test(rows), "and points at the route");
});

test("a third-party read never follows a redirect", () => {
  // THE SSRF GUARD CHECKED THE FIRST HOP AND NONE OF THE OTHERS. The host is
  // validated before the call; with `redirect: "follow"` a 302 to an internal
  // address was then fetched WITH the owner's API key attached, and neither the
  // guard nor this function ever saw that URL. `emitWebhook` already refuses
  // redirects — this is the same rule on the read side.
  const src = fs.readFileSync(new URL("../site-apis.mjs", import.meta.url), "utf8");
  assert.match(src, /redirect: "manual"/, "a followed redirect escapes the host check");
  assert.ok(!/redirect: "follow"/.test(src), "the follow is back");
  assert.match(src, /res\.status >= 300 && res\.status < 400/,
    "a 3xx has to be refused, not read as an empty body");
});

// ─────────────────────────────────────────────────────────────────────────────
// A DECLARED POST IS CACHED, AND THE MODEL HAD NO WAY TO KNOW.
//
// `normalizeApi` gives every declaration a 60-second window by default and
// `cacheKey` is slug|name|params — no method, no body — so a POST is sent ONCE
// and then answered from the store for a minute without contacting the service
// at all. That is correct for what this field exists for: plenty of READ
// endpoints require POST (GraphQL, search, pricing), and caching them is the
// point, since every uncached read spends the OWNER's own quota.
//
// It is wrong the moment the POST does something. The first call lands, the
// next few silently do not, and it works again a minute later — which reads as
// the third party being flaky rather than as us not calling them.
//
// NOT FIXED BY REFUSING TO CACHE POSTS: that breaks the legitimate case and
// puts the owner's quota back on every page view. The behaviour is right and
// the INSTRUCTION was missing, so the instruction is what is pinned here.
test("a POST really is cached like a GET — the premise of the wording below", async () => {
  // Asserted rather than assumed, because the guidance is only worth having
  // while this is true. If POSTs ever stop being cached, this fails first and
  // the wording should go with it.
  assert.equal(normalizeApi({ name: "n", url: "https://x.example/n", method: "POST", body: "{}" }).ttl, 60,
    "a POST no longer gets the default cache window — re-read the method guidance");
  assert.equal(normalizeApi({ name: "n", url: "https://x.example/n" }).ttl, 60);
  // The key DOES separate them now, and that is a change from the note above:
  // `method` is in it and so is the declaration fingerprint, so a GET and a
  // POST can never answer from one another's entry even if a site somehow held
  // both under one name.
  const g = normalizeApi({ name: "n", url: "https://x.example/n" });
  const p = normalizeApi({ name: "n", url: "https://x.example/n", method: "POST", body: "{}" });
  assert.notEqual(
    await cacheKey({ ownerId: OWNER_A, slug: "s", api: g, params: {} }),
    await cacheKey({ ownerId: OWNER_A, slug: "s", api: p, params: {} }),
    "a GET and a POST are not one cached answer");
});

test("the tool tells the model a POST here must not DO anything", () => {
  // RE-ANCHORED 2026-09-03: the api item lives in builder/site-table.mjs now
  // (`API_ITEM`, lifted beside the table item for the addon step); the design
  // tool BINDS it, asserted beside, so the wording read here is on the wire.
  const w = fs.readFileSync(new URL("../builder/site-table.mjs", import.meta.url), "utf8");
  assert.match(fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8"), /items: API_ITEM,/, "the design tool no longer binds the shared api item, so this wording is not on the wire");
  const at = w.indexOf('method: { type: "string", enum: ["GET", "POST"]');
  assert.ok(at > 0, "the apis method field moved — retarget this test");
  // To the next field, never a byte count.
  const end = w.indexOf("headers: {", at);
  assert.ok(end > at, "the field after `method` moved — retarget this window");
  const desc = w.slice(at, end);

  // The legitimate case, so the model does not read this as "never POST" and
  // lose GraphQL and every search endpoint that requires one.
  assert.match(desc, /GraphQL|read endpoint requires POST|READ endpoint requires POST/i,
    "nothing says when a POST IS right, so the model will avoid it entirely");
  // THE CONSEQUENCE, which is the part it cannot infer from "POST only".
  assert.match(desc, /cached/i,
    "the model is not told the answer is cached, which is the whole reason an action fails intermittently");
  assert.match(desc, /sometimes and not others|once and then|not always/i,
    "the intermittent failure is not described, and 'cached' alone does not imply it");
  // And where an outbound action actually belongs, or the model has a rule with
  // nowhere to go.
  assert.match(desc, /function/i,
    "nothing points at where an outbound action does belong");
});

// ── the shared cache layer ─────────────────────────────────────────────────

test("a window KV cannot express stays in memory alone", () => {
  // KV refuses an expirationTtl under 60s. Rounding a 30-second stock level up
  // to 60 is a page showing a quantity that has already changed — and only the
  // declaration knows which windows matter.
  for (const t of [0, 1, 30, 59]) assert.equal(kvEligible(t), false, t + "s must not go to KV");
  for (const t of [60, 61, 3600]) assert.equal(kvEligible(t), true, t + "s may");
  assert.equal(KV_MIN_TTL, 60, "the floor is KV's own");
});

test("the KV key is hashed, namespaced, and separates what cacheKey separates", async () => {
  // cacheKey carries an owner, a slug, a name, a method, a 64-char digest and up
  // to 8 params of 200 chars — past KV's 512-byte key limit, where a write just
  // fails and the cache silently never works.
  const long = await cacheKey({
    ownerId: OWNER_A,
    slug: "s".repeat(80),
    api: normalizeApi({ name: "n".repeat(40), url: "https://x.example/" + "u".repeat(900), params: ["a", "b", "c", "d", "e", "f", "g", "h"] }),
    params: Object.fromEntries("abcdefgh".split("").map((k) => [k, "v".repeat(200)])),
  });
  const id = await kvKeyFor(long);
  assert.ok(long.length > 512, "the fixture must actually exceed KV's key limit, or this proves nothing");
  assert.ok(id.length < 512, "the key must fit in KV");
  assert.match(id, /^api:[0-9a-f]{64}$/, "namespaced apart from route:, and a real digest");

  // A COLLISION HERE SERVES ONE SITE'S DATA TO ANOTHER, so the inputs that must
  // differ must produce different keys.
  const at = (over) => cacheKey({ ownerId: OWNER_A, slug: "barber", api: normalizeApi(DECL), params: { base: "GBP" }, ...over })
    .then(kvKeyFor);
  const a = await at({});
  assert.notEqual(a, await at({ slug: "cafe" }), "two sites must not share an entry");
  assert.notEqual(a, await at({ params: { base: "EUR" } }), "two parameter sets must not share an entry");
  assert.notEqual(a, await at({ ownerId: OWNER_B }), "two OWNERS must not share an entry");
  assert.notEqual(a, await at({ api: normalizeApi({ ...DECL, url: DECL.url + "/v2" }) }),
    "a changed declaration must not answer from the old entry");
  assert.equal(a, await at({}), "and the same question must hit the same entry");
});

// ── what the key has to separate ───────────────────────────────────────────

test("TWO OWNERS ON ONE SLUG NEVER SHARE AN ANSWER", async () => {
  // The leak this closes, driven rather than reasoned. A slug is freed by a
  // delete and claimable by anybody, so owner A's site `cafe` can be gone and
  // owner B's site `cafe` can declare the same API name — and the cached answer
  // was fetched with A's API KEY, out of A's vault. Serving it to B is one
  // customer's paid third-party data handed to another.
  const d = deps();
  d.fetch = async (url) => {
    d.sent.push({ url });
    return { status: 200, headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ who: d.sent.length === 1 ? "A" : "B" }) };
  };
  const first = await go(d, { ownerId: OWNER_A });
  const second = await go(d, { ownerId: OWNER_B });
  assert.equal(d.sent.length, 2, "B's read must reach upstream rather than answering from A's entry");
  assert.deepEqual(first.body, { who: "A" });
  assert.deepEqual(second.body, { who: "B" });
  assert.notEqual(second.cached, true);
  // And the same owner asking again IS a hit, or the assertion above passes
  // against a cache that never works at all.
  const again = await go(d, { ownerId: OWNER_A });
  assert.equal(again.cached, true, "the cache must still be doing its job");
  assert.deepEqual(again.body, { who: "A" });
});

test("no owner means NO CACHE, never a shared one", async () => {
  // The fail-safe. A slug lookup that failed must not fall back to a key
  // without an owner in it, because that key is shared by everyone who ever
  // holds the slug. Uncached is slower; shared is somebody else's data.
  assert.equal(await keyOf({ ownerId: null }), null);
  assert.equal(await keyOf({ ownerId: "" }), null);
  assert.equal(await keyOf({ ownerId: undefined }), null);
  // THE CACHE IS NOT CONSULTED AT ALL, asserted rather than inferred from a
  // miss. A `null` key looks harmless in the fake — `Map.get(null)` is a miss —
  // but the Worker's real `cacheGet` hashes whatever it is handed, and
  // `sha256("null")` is a perfectly valid KV key SHARED by every site that ever
  // fails to resolve an owner. Nothing writes there today; not asking is what
  // keeps that true.
  const asked = [];
  const d = deps({ cacheGet: async (k) => { asked.push(k); return null; } });
  await go(d, { ownerId: null });
  await go(d, { ownerId: null });
  assert.equal(d.sent.length, 2, "both reads went upstream");
  assert.equal(d.store.size, 0, "and nothing was written under a shared key");
  assert.deepEqual(asked, [], "the cache is never even asked with a keyless request");
  // The same deps WITH an owner does ask, or the assertion above is satisfied
  // by a cache that is never consulted at all.
  await go(d, { ownerId: OWNER_A });
  assert.equal(asked.length, 1, "and it is asked when there is a key");
});

test("A CHANGED DECLARATION NEVER ANSWERS FROM THE OLD ONE", async () => {
  // Before the fingerprint the key was slug|name|params, so moving an endpoint,
  // rotating a header or switching to a POST left the key identical and the
  // page served the previous service's data for up to an hour — with nothing to
  // explain it and nothing the owner could do but wait.
  const changes = [
    ["the url", { url: "https://api.example.com/v2/rates" }],
    ["the method", { method: "POST", body: "{}" }],
    ["a header", { headers: { "X-Key": "{{RATES_KEY}}", "X-Ver": "2" } }],
    ["the declared parameters", { params: ["base", "quote"] }],
    ["the cache window", { cacheSeconds: 120 }],
  ];
  const base = await keyOf({});
  for (const [what, over] of changes) {
    const changed = await keyOf({ api: normalizeApi({ ...DECL, ...over }) });
    assert.notEqual(base, changed, "changing " + what + " must not reuse the old entry");
  }

  // THE BODY, ON ITS OWN, and this needs two POSTs to mean anything. Written as
  // one more entry in the list above it changed the METHOD too (the base
  // declaration is a GET), so the assertion held while the body was ignored
  // entirely — found by a mutation that dropped it from the fingerprint and
  // survived the whole suite. A POST body is the entire question being asked of
  // a GraphQL or pricing endpoint.
  const post = (body) => normalizeApi({ ...DECL, method: "POST", body });
  assert.notEqual(
    await keyOf({ api: post('{"q":1}') }), await keyOf({ api: post('{"q":2}') }),
    "two POSTs differing only in their body are two different questions");
  // COSMETIC EDITS MUST NOT DUMP THE CACHE, which is the other half and the
  // reason the fingerprint is canonicalised rather than a raw dump: renaming a
  // header's case or reordering headers and parameters is the same request.
  // TWO headers, in both orders — with one header a sort cannot be observed at
  // all, which is how a mutation removing it survived the first sweep.
  const twoWays = (order) => normalizeApi({
    ...DECL,
    headers: order === "ab" ? { "A-One": "1", "B-Two": "2" } : { "B-Two": "2", "A-One": "1" },
    params: order === "ab" ? ["base", "quote"] : ["quote", "base"],
  });
  assert.equal(await keyOf({ api: twoWays("ab") }), await keyOf({ api: twoWays("ba") }),
    "reordering headers and parameters is the same request, not a cache flush");
  assert.equal(
    await keyOf({ api: normalizeApi({ ...DECL, headers: { "x-key": "{{RATES_KEY}}" } }) }),
    await keyOf({ api: normalizeApi({ ...DECL, headers: { "X-Key": "{{RATES_KEY}}" } }) }),
    "and a header renamed only in case is one header on the wire");

  // Driven end to end as well as compared: a real second call after a real edit.
  const d = deps();
  await go(d);
  await go(d, { api: normalizeApi({ ...DECL, url: "https://api.example.com/v2/rates" }) });
  assert.equal(d.sent.length, 2, "the edited declaration really did reach upstream");
});

test("expiry is the DECLARATION's window, and an expired entry is refetched", async () => {
  // `cacheSeconds` is what decides, clamped into 0..MAX_TTL, and the store is
  // told the window in milliseconds rather than choosing one of its own.
  assert.equal(normalizeApi({ ...DECL, cacheSeconds: 3600 }).ttl, 3600);
  assert.equal(normalizeApi({ ...DECL, cacheSeconds: 99999 }).ttl, MAX_TTL, "clamped, never honoured beyond the cap");
  assert.equal(normalizeApi({ ...DECL, cacheSeconds: -5 }).ttl, 0);

  // A store that actually expires, so this is the behaviour and not the shape.
  let clock = 1_000_000;
  const live = new Map();
  const d = deps({
    cacheGet: async (k) => { const e = live.get(k); return e && e.until > clock ? e.v : null; },
    cacheSet: async (k, v, ms) => { live.set(k, { v, until: clock + ms }); },
  });
  const api = normalizeApi({ ...DECL, cacheSeconds: 60 });
  await go(d, { api });
  await go(d, { api });
  assert.equal(d.sent.length, 1, "inside the window it is one call");
  clock += 59_000;
  await go(d, { api });
  assert.equal(d.sent.length, 1, "still inside it");
  clock += 2_000;
  await go(d, { api });
  assert.equal(d.sent.length, 2, "past the declared window it goes upstream again");
  // The window handed to the store is the declaration's, in ms.
  assert.equal([...live.values()][0].until - clock + 61_000, 60_000 + 61_000 - 0 + 0 - 0,
    "sanity: the entry was stamped with the 60s window");
});

test("CONCURRENT MISSES stay in their own lane", async () => {
  // Two visitors on two sites hitting a cold cache at the same moment. What
  // must hold is that neither answer lands under the other's key — an
  // interleaved write is exactly where a shared or racy key would show up, and
  // it is the one ordering a sequential test never produces.
  const d = deps();
  let n = 0;
  d.fetch = async (url) => {
    const mine = ++n;
    // Yield mid-flight so the two calls really do interleave.
    await new Promise((r) => setTimeout(r, mine === 1 ? 5 : 1));
    d.sent.push({ url });
    return { status: 200, headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ n: mine }) };
  };
  const [a, b] = await Promise.all([
    go(d, { ownerId: OWNER_A, slug: "cafe" }),
    go(d, { ownerId: OWNER_B, slug: "cafe" }),
  ]);
  assert.notDeepEqual(a.body, b.body, "each got its own answer");
  assert.equal(d.store.size, 2, "and two entries were written, not one");
  // Each is now served from its OWN entry.
  assert.deepEqual((await go(d, { ownerId: OWNER_A, slug: "cafe" })).body, a.body);
  assert.deepEqual((await go(d, { ownerId: OWNER_B, slug: "cafe" })).body, b.body);

  // NOT DEDUPLICATED, and that is stated rather than asserted away: two
  // simultaneous misses on the SAME key are two upstream calls. A quota
  // inefficiency rather than a correctness fault, and single-flight could not
  // span isolates anyway — the shared layer is KV, which only helps once the
  // first answer has been written.
  //
  // THE UPSTREAM HAS TO BE SLOW FOR THIS TO BE THE REAL CASE, and the first
  // draft asserted it against an instantaneous fake and failed: with a fetch
  // that resolves immediately the first call runs to completion — cache write
  // included — before the second one resumes, so there was one call and it
  // looked like deduplication. That is a property of the fake, not of the code.
  // In production the fetch is the slow part, which is precisely what holds the
  // window open.
  const same = deps();
  same.fetch = async (url) => {
    await new Promise((r) => setTimeout(r, 10));
    same.sent.push({ url });
    return { status: 200, headers: new Headers({ "content-type": "application/json" }), text: async () => '{"usd":1}' };
  };
  await Promise.all([go(same), go(same)]);
  assert.equal(same.sent.length, 2, "two concurrent misses on one key are two calls today");
  assert.equal(same.store.size, 1, "and they converge on one entry, not two");
  await go(same);
  assert.equal(same.sent.length, 2, "after which it is served from the cache");
});

test("a body too large is refused BEFORE anything is cached", async () => {
  // The size limit predates this and must survive it: an over-large answer is
  // an error, and an error is never cached — so it must not be written under
  // the new key either.
  const big = "x".repeat(MAX_RESPONSE + 1);
  const d = deps({ res: { status: 200, headers: new Headers({ "content-type": "text/plain" }), text: async () => big } });
  const out = await go(d);
  assert.equal(out.status, 502);
  assert.equal(d.store.size, 0, "nothing is cached");
  await go(d);
  assert.equal(d.sent.length, 2, "and the next read is a real read, not a cached refusal");
  assert.ok(MAX_RESPONSE < 25 * 1024 * 1024, "and the limit must stay inside KV's own value ceiling");
});

test("a MISSING SECRET is never cached, and never becomes a sticky refusal", async () => {
  // 503 with a `missing` field, and if that were held for an hour the owner
  // would paste the key into Secrets and watch nothing change.
  const d = deps({ secrets: {} });
  const out = await go(d);
  assert.equal(out.status, 503);
  assert.ok(out.missing, "the owner's half of the story is reported");
  assert.equal(d.store.size, 0, "nothing cached");
  assert.equal(d.sent.length, 0, "and nothing was even sent — the secret is checked first");
  const fixed = deps();
  assert.equal((await go(fixed)).status, 200, "and the fix takes effect immediately");
});

test("the WIRING: the route resolves an owner and hands it over, and KV keys are hashed", () => {
  // Every one of these survived the first mutation sweep, because a module test
  // cannot see the layer that supplies its arguments — the shape this codebase
  // has recorded a dozen times. `cacheKey` can be perfect and the route can pass
  // nothing, at which point the whole feature is off and every unit test still
  // passes.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  const at = w.indexOf("const out = await callApi(");
  assert.ok(at > 0, "the API route's callApi moved — retarget this test");
  const block = w.slice(w.lastIndexOf("const params = takeParams(", at), at + 300);

  // RESOLVED, and from the lookup — not hardcoded to null, which is the
  // fail-safe and would silently disable caching for every site on the platform.
  assert.match(block, /const aowner = await siteOwnerBySlug\(slug, env\)/,
    "the route must look the owner up");
  assert.match(block, /callApi\([^)]*\), \{ ownerId: aowner,/,
    "and hand it to callApi — computed and dropped is the same as never computed");

  // KV KEYS ARE HASHED. cacheKey is now ~150 characters before parameters and
  // KV's key limit is 512 bytes, where an over-long key does not error — the
  // write simply fails and the cache silently never works.
  const put = w.slice(w.indexOf("cacheSet: async (k, v, ms)"), w.indexOf("cacheSet: async (k, v, ms)") + 700);
  assert.match(put, /const id = await kvKeyFor\(k\)/, "the KV write must hash the key");
  assert.match(put, /kv\.put\(id,/, "and put under the hash, not the raw key");
  const get = w.slice(w.indexOf("cacheGet: async (k)"), w.indexOf("cacheGet: async (k)") + 700);
  assert.match(get, /const id = await kvKeyFor\(k\)/, "and the read must hash it the same way");
  assert.match(get, /kv\.get\(id,/);
});

test("deleting a site forgets its cached OWNER, not just its connection", () => {
  // THE LEAK, SURVIVING INSIDE THE CACHE THAT CLOSES IT. `siteOwnerBySlug`
  // memoizes for five minutes and the whole reason the owner is in `cacheKey`
  // is that a freed slug can be taken by somebody else — so a site deleted at T
  // and re-claimed at T+1min resolves to the OLD owner for the next four. The
  // new owner's visitors are then keyed under the previous account and read
  // that account's cached third-party answers, fetched with their API key.
  //
  // Found by mutation: removing the invalidation passed the whole suite,
  // because a module test cannot see the route that populates the cache.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("_connCache.delete(dslug)");
  assert.ok(at > 0, "the delete route's connection invalidation moved — retarget this test");
  // Bounded by the teardown that follows, so this cannot be satisfied by an
  // invalidation somewhere else entirely.
  const block = w.slice(at, w.indexOf("dropRoute(", at));
  assert.match(block, /_ownerCache\.delete\(dslug\)/,
    "both slug-keyed caches must be forgotten together — the owner one decides the API cache key");
  // BEFORE the route is dropped, like the connection: everything here runs
  // ahead of teardown so no warm isolate can answer from a site that is going.
  assert.ok(w.indexOf("_ownerCache.delete(dslug)") < w.indexOf("dropRoute(", at),
    "the owner must be forgotten before the site is torn down");
});

test("callApi still works with no cache wired at all", async () => {
  // The whole KV layer is optional — no namespace is bound today — so the deps
  // it rides on must remain absent-safe.
  let calls = 0;
  const api = normalizeApi({ name: "r", url: "https://x.example.com/r", cacheSeconds: 3600 });
  const deps = { secrets: {}, blockedReason: () => null, fetch: async () => { calls++; return { status: 200, headers: { get: () => "application/json" }, text: async () => '{"ok":1}' }; } };
  const out = await callApi(deps, { slug: "s", api, params: {}, now: 1 });
  assert.equal(out.status, 200);
  assert.equal(calls, 1, "and the read still happens");
});
