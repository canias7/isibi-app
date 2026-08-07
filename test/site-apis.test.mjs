import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeApi, secretsNeeded, fill, takeParams, cacheKey, callApi, apiFor,
  MAX_RESPONSE, MAX_PER_MINUTE, TIMEOUT_MS, MAX_TTL,
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
