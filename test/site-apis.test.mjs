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
const go = (d, over = {}) => callApi(d, { slug: "cafe", api: normalizeApi(DECL), params: { base: "EUR" }, now: 1, ...over });

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
  assert.notEqual(cacheKey("cafe", normalizeApi(DECL), { base: "EUR" }), cacheKey("cafe", normalizeApi(DECL), { base: "GBP" }));
});

test("and different SITES never share one", () => {
  const api = normalizeApi(DECL);
  assert.notEqual(cacheKey("cafe", api, { base: "EUR" }), cacheKey("barber", api, { base: "EUR" }));
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
  const i = worker.indexOf("      apis: {");
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
test("a POST really is cached like a GET — the premise of the wording below", () => {
  // Asserted rather than assumed, because the guidance is only worth having
  // while this is true. If POSTs ever stop being cached, this fails first and
  // the wording should go with it.
  assert.equal(normalizeApi({ name: "n", url: "https://x.example/n", method: "POST", body: "{}" }).ttl, 60,
    "a POST no longer gets the default cache window — re-read the method guidance");
  assert.equal(normalizeApi({ name: "n", url: "https://x.example/n" }).ttl, 60);
  // And the key does not separate them, which is safe only because a name maps
  // to exactly one declaration.
  assert.equal(cacheKey("s", { name: "n", params: [] }, {}), cacheKey("s", { name: "n", params: [] }, {}));
});

test("the tool tells the model a POST here must not DO anything", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
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
  // cacheKey carries a slug, a name and up to 8 params of 200 chars — past KV's
  // 512-byte key limit, where a write just fails and the cache silently never
  // works.
  const long = cacheKey("s".repeat(80), { name: "n".repeat(40), params: ["a", "b", "c", "d", "e", "f", "g", "h"] },
    Object.fromEntries("abcdefgh".split("").map((k) => [k, "v".repeat(200)])));
  const id = await kvKeyFor(long);
  assert.ok(id.length < 512, "the key must fit in KV");
  assert.match(id, /^api:[0-9a-f]{64}$/, "namespaced apart from route:, and a real digest");

  // A COLLISION HERE SERVES ONE SITE'S DATA TO ANOTHER, so the inputs that must
  // differ must produce different keys.
  const a = await kvKeyFor(cacheKey("barber", { name: "rates", params: ["base"] }, { base: "GBP" }));
  const b = await kvKeyFor(cacheKey("cafe", { name: "rates", params: ["base"] }, { base: "GBP" }));
  const c = await kvKeyFor(cacheKey("barber", { name: "rates", params: ["base"] }, { base: "EUR" }));
  assert.notEqual(a, b, "two sites must not share an entry");
  assert.notEqual(a, c, "two parameter sets must not share an entry");
  assert.equal(a, await kvKeyFor(cacheKey("barber", { name: "rates", params: ["base"] }, { base: "GBP" })),
    "and the same question must hit the same entry");
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
