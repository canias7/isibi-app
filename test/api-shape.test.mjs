// WHAT A CONNECTION SAYS ABOUT ITSELF, and whether a page written from it
// really renders (task #185, 2026-09-19).
//
// ⚠ THE CLAIM THIS FILE MAKES AND THE ONE IT DOES NOT. Everything here
// establishes that a page written against a DECLARED shape renders that
// shape's values, and that a page written against a different shape renders
// nothing — the failure the whole tier had. It establishes NOTHING about
// whether the service an owner names really sends that shape. Those are two
// claims and the second is closed by a real call to a real service, which is
// the owner's decision and happens nowhere in this repository.
//
// A TYPE ANNOTATION IS NOT RENDERING PROOF, which is why this file renders.
// Measured with the template's own esbuild before any of it was written: two
// pages differing only in `useApi<Rates>(…)` against `useApi(…)` emit
// byte-identical JavaScript (408 bytes, sha256 73a4782b79a186d0, both
// non-empty). TypeScript is erased. So the annotation cannot be the evidence,
// and neither can a typecheck: a page that invents its own type typechecks
// CLEAN (tsc --strict exit 0) while reading a field that is not there.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  cleanShape, cleanParams, cleanCredential, typeFromShape, shapeJson,
  paramLine, readHint, apiDetailLines, missingRequired, credentialNote,
  SHAPE_LEAVES, PARAM_TYPES, MAX_PARAMS, MAX_SHAPE_DEPTH, MAX_SHAPE_NODES,
} from "../site-api-shape.mjs";
import { normalizeApi, declFingerprint } from "../site-apis.mjs";

const ROOT = new URL("../", import.meta.url);
const TEMPLATE = path.join(ROOT.pathname, "builder/lovable/template");
const rootRequire = createRequire(import.meta.url);
const ts = rootRequire("typescript");

// The template's own packages first — the shape the real bundle sees — then
// the root's, which CI installs. Neither is a skip: `test/kit-form.test.mjs`
// records why (a guard that never runs in CI proves nothing there).
function resolver() {
  const tries = [];
  try {
    const r = createRequire(path.join(TEMPLATE, "package.json"));
    r.resolve("react"); r.resolve("react-dom/server");
    tries.push(r);
  } catch { /* not installed here */ }
  tries.push(rootRequire);
  return (id) => {
    let last;
    for (const r of tries) { try { return r(id); } catch (e) { last = e; } }
    throw new Error("cannot load " + id + " from the template or the root: " + (last && last.message));
  };
}

/**
 * Render one page's source with `useApi` answering whatever the case says.
 *
 * THE STUB IS THE PROVIDER, and it answers the three states TanStack Query
 * really produces — `{isLoading:true}`, `{data}` and `{error}` — so a page that
 * draws only the third is visibly a page with a blank where the other two go.
 */
function renderPage(src, answer) {
  const req = resolver();
  const React = req("react");
  const server = req("react-dom/server");
  const js = ts.transpileModule(src, {
    fileName: "page.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const local = (id) => {
    // The one module a generated page reads its data through. Stubbed, because
    // the subject is the PAGE and not the hook — and the hook is the provider
    // seam, which is exactly where a stub belongs.
    if (id === "@/lib/rows") return { useApi: () => answer };
    if (id === "react/jsx-runtime") return req("react/jsx-runtime");
    if (id === "react") return React;
    throw new Error("the page reached for " + id + ", which this render does not provide");
  };
  new Function("require", "module", "exports", js)(local, mod, mod.exports);
  const Page = mod.exports.Page || mod.exports.default;
  assert.equal(typeof Page, "function", "the page source exports no component");
  return server.renderToStaticMarkup(React.createElement(Page));
}

// THE SHAPE A SERVICE REALLY SENDS, and the one a page writer with nothing to
// go on invents. They are the same subject and they disagree about every field
// name, which is the whole of the defect.
const REAL = { current: { temp_c: 18.5, condition: { text: "Light rain" } }, forecast: [{ day: "Sat", high: 21 }] };
const DECLARED = { current: { temp_c: "number", condition: { text: "string" } }, forecast: [{ day: "string", high: "number" }] };

test("a sketch is a tree of TYPE names, and a value is refused", () => {
  const ok = cleanShape(DECLARED);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.shape, DECLARED, "a clean sketch comes back as itself");
  assert.equal(shapeJson(ok.shape), JSON.stringify(DECLARED), "printed in declaration order");

  // A SAMPLE IS NOT A SKETCH. This is the mistake a model makes when it reaches
  // for an example answer, and a page written against a sample hardcodes
  // today's values.
  assert.equal(cleanShape({ current: { temp_c: 18.5 } }).ok, false, "a real number read as a sketch");
  assert.equal(cleanShape({ current: { temp_c: "18.5" } }).why, "shape-leaf", "a quoted value is not a type name");
  assert.equal(cleanShape({ t: "String" }).ok, true, "a leaf's case is folded, because that is spelling and not meaning");
  for (const leaf of SHAPE_LEAVES) assert.equal(cleanShape({ a: leaf }).ok, true, leaf + " is a leaf");

  // ABSENT IS THE ORDINARY ANSWER and is not a failure: it is every connection
  // stored before today.
  for (const empty of [undefined, null, ""]) assert.equal(cleanShape(empty), null, "nothing declared is null, never a refusal");

  // ONE ELEMENT SAYS "EVERY ENTRY LOOKS LIKE THIS". Two say two things and a
  // guess between them is a page reading the wrong one.
  assert.deepEqual(cleanShape([{ a: "string" }]).shape, [{ a: "string" }]);
  assert.deepEqual(cleanShape([]).shape, ["unknown"], "an empty list is a list of unknowns");
  assert.equal(cleanShape([{ a: "string" }, { b: "number" }]).why, "shape-array");

  assert.equal(cleanShape({}).why, "shape-empty", "an object with no keys describes nothing");
  assert.equal(cleanShape({ ["x".repeat(65)]: "string" }).why, "shape-key");
  assert.equal(cleanShape({ "a\u0000b": "string" }).why, "shape-key", "a control character never reaches a prompt");

  // THE BOUNDS ARE REAL AND BOTH ARE DRIVEN, because this goes into a prompt.
  let deep = "string";
  for (let i = 0; i < MAX_SHAPE_DEPTH + 2; i++) deep = { n: deep };
  assert.equal(cleanShape(deep).why, "shape-too-deep");
  const wide = {};
  for (let i = 0; i < MAX_SHAPE_NODES + 5; i++) wide["k" + i] = "string";
  assert.equal(cleanShape(wide).why, "shape-too-big");
});

test("the TypeScript type is derived from the sketch, never invented", () => {
  // THE POINT OF THIS FUNCTION: the annotation stops being a guess. An invented
  // `T` typechecks clean against the wrong field names — measured, tsc --strict
  // exit 0 — so handing the writer the exact type is what makes the type agree
  // with the data rather than with the guess that produced it.
  assert.equal(typeFromShape(cleanShape(DECLARED).shape),
    "{ current: { temp_c: number; condition: { text: string } }; forecast: { day: string; high: number }[] }");
  assert.equal(typeFromShape(cleanShape({ "content-type": "string" }).shape), '{ "content-type": string }',
    "a key that is not a plain identifier is quoted, or the type does not parse");
  assert.equal(typeFromShape(cleanShape(["string"]).shape), "string[]");
  assert.equal(typeFromShape("unknown"), "unknown");
});

test("a page written against the DECLARED shape renders it; the same page against an invented one renders nothing", () => {
  // ⚠ THIS IS THE ACCEPTANCE THE TYPE ANNOTATION CANNOT GIVE. Both pages are
  // valid TypeScript, both compile, both ship. One draws the forecast and the
  // other draws a blank — and the only difference is whether the field names
  // came from a declaration or from a guess.
  const page = `
import { useApi } from "@/lib/rows";
type Weather = ${typeFromShape(cleanShape(DECLARED).shape)};
export function Page() {
  const q = useApi<Weather>("weather", { city: "Leeds" });
  if (q.isLoading) return <p data-slot="waiting">Checking the forecast…</p>;
  if (q.error) return <p data-slot="failed">The forecast is not available right now.</p>;
  return (
    <section>
      <p data-slot="now">{q.data?.current?.temp_c}°C, {q.data?.current?.condition?.text}</p>
      <ul>{(q.data?.forecast ?? []).map((d) => <li key={d.day}>{d.day}: {d.high}</li>)}</ul>
    </section>
  );
}`;
  const shown = renderPage(page, { data: REAL });
  assert.match(shown, /18\.5°C/, "the declared path did not reach the page: " + shown);
  assert.match(shown, /Light rain/, shown);
  assert.match(shown, /Sat: 21/, "the nested list entry did not render: " + shown);

  // THE CONTROL, and it is what makes the assertion above mean anything: the
  // page a writer produces with no declaration to read. `type Weather = {
  // temperature: number; summary: string }` is a perfectly reasonable guess at
  // a weather API, it typechecks against its own invention, and it renders an
  // empty panel against the answer the service really sends.
  const guessed = `
import { useApi } from "@/lib/rows";
type Weather = { temperature: number; summary: string };
export function Page() {
  const q = useApi<Weather>("weather", { city: "Leeds" });
  if (q.isLoading) return <p data-slot="waiting">Checking the forecast…</p>;
  if (q.error) return <p data-slot="failed">The forecast is not available right now.</p>;
  return <section><p data-slot="now">{q.data?.temperature}°C, {q.data?.summary}</p></section>;
}`;
  const blank = renderPage(guessed, { data: REAL });
  assert.doesNotMatch(blank, /18\.5/, "the control is not a control — the guessed page found the data");
  assert.doesNotMatch(blank, /Light rain/, blank);
  assert.match(blank, /<p data-slot="now">°C, <\/p>/,
    "the guessed page renders a panel with nothing in it, which is the defect: " + blank);

  // AND THE TWO OTHER STATES, which no page rule anywhere asked for until this
  // round — measured, the word "loading" did not occur in `page-gen.mjs` at
  // all. A third-party read crosses the internet, answers 503 until the owner's
  // key is in the vault and 502/504 when the service is down; a page with no
  // branch for either draws a blank in exactly those cases.
  assert.match(renderPage(page, { isLoading: true }), /Checking the forecast…/);
  assert.match(renderPage(page, { error: new Error("upstream 502") }), /not available right now/);
});

test("parameters keep both shapes, and the names are derived rather than maintained", () => {
  // EVERY CONNECTION STORED BEFORE TODAY is a plain array of strings and must
  // normalise to exactly the list it always did — the names go into
  // `declFingerprint`, so a change here re-keys every cached answer on the
  // platform.
  const old = cleanParams(["city", "units", "city", "Bad Name", 7, "units"]);
  assert.deepEqual(old.names, ["city", "units"], "deduped, lowercased, junk dropped");
  assert.equal(old.info, null, "nothing was said, so nothing rides beside the names");

  const rich = cleanParams([{ name: "city", type: "string", required: true, description: "the town or postcode" }, "units"]);
  assert.deepEqual(rich.names, ["city", "units"]);
  assert.deepEqual(rich.info, [{ name: "city", type: "string", required: true, note: "the town or postcode" }, { name: "units" }],
    "one entry per name, in the same order — a reader pairing by index must be able to");
  assert.deepEqual(rich.info.map((r) => r.name), rich.names, "the two lists are one walk and cannot drift");

  // REQUIRED IS ONLY EVER `true`. A string read as required turns every call
  // into a 400; a junk value read as required does the same.
  for (const v of ["true", "false", 1, 0, "yes", null, {}]) {
    assert.equal(cleanParams([{ name: "a", required: v }]).info, null, JSON.stringify(v) + " is not a required flag");
  }
  assert.equal(cleanParams([{ name: "a", type: "date" }]).info, null, "a type outside the closed list says nothing");
  for (const t of PARAM_TYPES) assert.equal(cleanParams([{ name: "a", type: t }]).info[0].type, t);

  const many = cleanParams(Array.from({ length: MAX_PARAMS + 4 }, (_, i) => "p" + i));
  assert.equal(many.names.length, MAX_PARAMS, "capped where it always was");

  // ⚠ AND RE-READING A STORED DECLARATION MUST PUT THE TWO BACK TOGETHER —
  // found by the end-to-end route case and by nothing else. Once a connection
  // is in `_meta.schema` its `params` is the list of NAMES, so a second pass
  // over that alone answers `info: null` and every type, flag and sentence is
  // gone one hop after being stored. Measured before the second argument
  // existed: the store kept `returns` and `credential` and lost `paramInfo`,
  // and the page prompt named no parameter at all.
  const again = normalizeApi(normalizeApi({ name: "w", url: "https://a.test/x",
    params: [{ name: "city", type: "string", required: true, description: "the town" }] }));
  assert.deepEqual(again.paramInfo, [{ name: "city", type: "string", required: true, note: "the town" }],
    "a stored connection lost what its parameters are on the way back in");
  assert.deepEqual(again.params, ["city"]);

  // PAIRED BY NAME, NEVER BY POSITION: `normalizeApi` drops a malformed name,
  // which shifts every index behind it.
  const shifted = cleanParams(["city", "units"], [{ name: "units", required: true }, { name: "city", type: "string" }]);
  assert.deepEqual(shifted.info, [{ name: "city", type: "string" }, { name: "units", required: true }],
    "the metadata was paired by position: " + JSON.stringify(shifted.info));
  // A STORED ENTRY FOR A NAME THAT IS NOT DECLARED IS IGNORED, and a declared
  // name with no stored entry keeps its bare row.
  const odd = cleanParams(["city"], [{ name: "ghost", required: true }]);
  assert.deepEqual(odd.names, ["city"]);
  assert.equal(odd.info, null, "an entry for a parameter the connection does not have said something about it");
});

test("a required blank the caller did not fill is named, before anything is called", () => {
  const api = normalizeApi({ name: "weather", url: "https://api.test/x?c={{param.city}}",
    params: [{ name: "city", required: true }, { name: "units" }] });
  assert.deepEqual(missingRequired(api, { units: "c" }), ["city"]);
  assert.deepEqual(missingRequired(api, { city: "Leeds" }), [], "the required one was supplied");
  // AN EMPTY STRING IS NOT A VALUE HERE. `fill` substitutes a blank as "" and
  // plenty of services answer 200 to that with a default — the page then
  // renders something plausible and wrong, which is the failure this exists to
  // stop rather than a formality.
  assert.deepEqual(missingRequired(api, { city: "" }), ["city"], "an empty string is the blank, not a filling of it");

  // A CONNECTION THAT DECLARED NO METADATA REQUIRES NOTHING, which is every
  // connection on the platform today.
  const plain = normalizeApi({ name: "weather", url: "https://api.test/x", params: ["city"] });
  assert.equal(plain.paramInfo, undefined);
  assert.deepEqual(missingRequired(plain, {}), []);
});

test("where the key comes from is DERIVED from the declaration, never claimed", () => {
  const withKey = [{ name: "rates", credential: { service: "Open Exchange Rates", url: "https://openexchangerates.org/signup", note: "free tier covers 1,000 calls" } }];
  assert.match(credentialNote(withKey, ["RATES_KEY"]), /comes from Open Exchange Rates at https:\/\/openexchangerates\.org\/signup \(free tier covers 1,000 calls\)/);

  // ⚠ "SUPPORT CONNECTIONS NEEDING NO KEY" IS ENFORCED RATHER THAN PROMISED.
  // The secrets list comes from `secretsNeeded`, which reads the declaration's
  // own `{{SECRET}}` placeholders — so a model that wrongly declares credential
  // guidance for a keyless connection cannot produce a go-and-get-a-key
  // instruction. Driven with the claim PRESENT and the secrets EMPTY, which is
  // the only arrangement that can separate the two.
  assert.equal(credentialNote(withKey, []), "That connection needs no key, so it is answering already.",
    "a keyless connection was told to go and find a key");
  assert.equal(credentialNote([], ["RATES_KEY"]), "", "no connection, nothing to say");
  assert.equal(credentialNote([{ name: "rates" }], ["RATES_KEY"]), "",
    "a key is needed and nobody said where it comes from — the destination sentence already covers that");

  assert.equal(cleanCredential({ url: "http://insecure.example/keys" }).why, "credential-url",
    "an http sign-up page is a link this platform put in front of its own customer");
  assert.equal(cleanCredential(["a"]).why, "credential-shape");
  assert.equal(cleanCredential({}), null, "nothing said is nothing stored");
  assert.equal(cleanCredential(undefined), null);
  assert.deepEqual(cleanCredential({ service: "X", signup: "https://x.test/k" }).credential, { service: "X", url: "https://x.test/k" },
    "`signup` is the other word a model reaches for");
});

test("the three ride the stored declaration, and a connection without them is byte for byte what it was", () => {
  // THE NEGATIVE CONTROL, and it is the whole compatibility claim: every
  // connection on the platform today declares none of the three.
  const before = { name: "weather", url: "https://api.test/v1?c={{param.city}}", method: "GET", headers: { Authorization: "Bearer {{W_KEY}}" }, params: ["city"], cacheSeconds: 300 };
  const plain = normalizeApi(before);
  assert.deepEqual(Object.keys(plain), ["name", "url", "method", "headers", "params", "body", "ttl"],
    "a connection declaring none of the three gained a key on the wire");

  const rich = normalizeApi({ ...before, returns: DECLARED, credential: { service: "WeatherAPI", url: "https://weatherapi.test/signup" },
    params: [{ name: "city", type: "string", required: true, description: "the town" }] });
  assert.deepEqual(rich.returns, DECLARED, "the sketch did not survive the engine's allow-list");
  assert.deepEqual(rich.paramInfo, [{ name: "city", type: "string", required: true, note: "the town" }]);
  assert.deepEqual(rich.credential, { service: "WeatherAPI", url: "https://weatherapi.test/signup" });
  assert.deepEqual(rich.params, ["city"], "the names are still a list of names");

  // ⚠ THE ENGINE IS TOLERANT WHERE THE ADDON'S CLEANER REFUSES. This function
  // is what every STORED spec passes through on its way to being served, so a
  // sketch that cannot be read must leave the connection working — guidance is
  // not the feature.
  const bad = normalizeApi({ ...before, returns: { t: 42 }, credential: { url: "http://x.test" } });
  assert.equal(bad.returns, undefined, "an unreadable sketch is dropped, never thrown");
  assert.equal(bad.credential, undefined);
  assert.deepEqual(bad.params, ["city"], "and the connection still works");

  // ⚠ NONE OF THE THREE IS IN THE CACHE FINGERPRINT, and this is the assertion
  // that keeps a documentation fix from being billed as a configuration change:
  // the fingerprint decides which cached answers survive, so putting a
  // parameter's description in it would drop every stored answer on that
  // connection and put the owner's third-party quota back on the next page
  // view. The parameter NAMES are in it and stay in it — they really do decide
  // the request.
  assert.equal(declFingerprint(rich), declFingerprint(plain),
    "a change to what a connection SAYS re-keyed its cache");
  assert.notEqual(declFingerprint(normalizeApi({ ...before, params: ["town"] })), declFingerprint(plain),
    "a parameter NAME must still re-key it — this observer has to be alive in both directions");
});

/**
 * The PUBLIC serving route, driven through the real Worker.
 *
 * `missingRequired` is proved at the module above; what only a drive can
 * establish is the ORDER — that the refusal happens before anything reaches
 * the third party, which is the whole point of it. `upstream` counts every
 * request that is not this platform's own, so "nothing was called" is an
 * assertion rather than a hope.
 */
const VAULT = { SITE_SECRETS_KEY: "test-vault-key-0123456789", SUPABASE_SERVICE_KEY: "k", SUPABASE_ANON_KEY: "a" };

// ⚠ EACH CALL NEEDS ITS OWN SLUG. `siteBackendBySlug` is memoized per slug for
// five minutes and the schema read is cached beside it, so two calls under one
// name answer from the FIRST one's spec — measured: the third case here, on a
// connection declaring no required parameter at all, came back "this connection
// needs city" from the case above it. A cache shared between cases makes every
// case after the first a test of the first one's data.
let served = 0;

async function serve(query, { api, secrets = { W_KEY: "real-key" }, answer = { temp_c: 18.5 } } = {}) {
  const slug = "fw-serve-" + (++served);
  const { hit } = await import("./fixtures/worker-harness.mjs");
  const { encryptSecret } = await import("../site-secrets.mjs");
  // ⚠ A REAL CIPHERTEXT, MINTED WITH THE VAULT KEY THE ROUTE WILL READ IT
  // WITH. A first draft answered the literal "stub" and every control came back
  // 503 — `readSecret` DECRYPTS, so a fixture that skips that hop cannot tell a
  // site with no key from one whose key does not open, and the case would have
  // been about the fixture rather than about the wall.
  const vault = {};
  for (const [k, v] of Object.entries(secrets)) vault[k] = await encryptSecret(VAULT, v);
  const real = globalThis.fetch;
  const upstream = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    // `SUPABASE_URL` IS A MODULE CONSTANT, not an env binding — a first draft
    // of this fixture overrode the env and matched on its own hostname, so
    // nothing matched, the backend row never resolved and the route answered
    // its own "no such connection" 404. Match on the PATH, which is what the
    // route really asks for whatever host it asks.
    if (url.includes("/rest/v1/")) {
      // The site's row and its owner's project, which is how a slug becomes a
      // connection string — TWO reads, and the second is where the endpoint and
      // credentials live. Both are this platform's own and neither is the
      // service.
      // THE DATABASE NAME IS PER CALL TOO, not only the slug: the stored schema
      // is cached by CONNECTION STRING, so three cases sharing one `neon_db`
      // all read the first one's spec however many slugs they use. Measured —
      // the third case, on a connection declaring no required parameter, came
      // back "this connection needs city" from the case above it.
      if (url.includes("site_backends")) return json([{ uid: "u-1", brief: "", neon_db: slug.replace(/-/g, "_") }]);
      if (url.includes("site_project")) return json([{ uid: "u-1", neon_conn: "postgres://u:p@ep-serve.neon.tech/neondb" }]);
      return json([{ uid: "u-1" }]);
    }
    if (url.includes("neon.tech/sql")) {
      const q = String((() => { try { return JSON.parse(String(init && init.body) || "{}").query; } catch { return ""; } })());
      // AN ABSENT ROW is how a site with no key in the vault really reads —
      // `readSecret` answers null on a missing cipher — so the empty case is
      // the real shape and not a shortcut.
      // ROWS ARE ARRAYS WITH `fields`, which is Neon's own wire shape, and the
      // COLUMN NAME is what the driver maps them onto — `siteApiDeps` reads
      // `rows[0].cipher`, so a fixture naming that column `v` answers
      // `undefined` and the case reads as a site with no key in the vault.
      const wantSecret = /_secrets/i.test(q);
      const name = (() => { try { return (JSON.parse(String(init && init.body) || "{}").params || [])[0]; } catch { return null; } })();
      const rows = wantSecret
        ? (name && vault[name] ? [[vault[name]]] : [])
        : [[JSON.stringify({ tables: [], apis: [api] })]];
      return json({ command: "SELECT", rowCount: rows.length, rows, fields: [{ name: wantSecret ? "cipher" : "v", dataTypeID: 25 }] });
    }
    upstream.push(url);
    return json(answer);
  };
  try {
    const r = await hit("/api/db/" + slug + "/api/weather" + query, {
      env: VAULT,
    });
    return { ...r, upstream };
  } finally { globalThis.fetch = real; }
}

test("a required blank stops the request BEFORE the service is called", async () => {
  const api = { name: "weather", url: "https://api.test/v1?c={{param.city}}&k={{W_KEY}}",
    params: [{ name: "city", type: "string", required: true, description: "the town" }], cacheSeconds: 0 };

  const short = await serve("", { api });
  assert.equal(short.status, 400, "a missing required parameter was not refused: " + short.text);
  assert.match(short.text, /city/, "the refusal does not name the blank a developer has to fill: " + short.text);
  assert.deepEqual(short.upstream, [], "the owner's quota was spent on a request that could never work");

  // THE CONTROL, without which the assertion above is satisfied by a route that
  // refuses everything: the same connection, the blank filled, really reaches
  // the service.
  const full = await serve("?city=Leeds", { api });
  assert.equal(full.status, 200, full.text);
  assert.equal(full.upstream.length, 1, "the supplied parameter did not reach the service: " + JSON.stringify(full.upstream));
  assert.match(full.upstream[0], /c=Leeds/, full.upstream[0]);
  assert.match(full.upstream[0], /k=real-key/, "the platform substitutes the key; the page never sees it");

  // AND A CONNECTION THAT DECLARED NO METADATA REQUIRES NOTHING — every
  // connection on the platform today, and it must go on being called.
  const plain = await serve("", { api: { name: "weather", url: "https://api.test/v1?k={{W_KEY}}", params: ["city"], cacheSeconds: 0 } });
  assert.equal(plain.status, 200, plain.text);
  assert.equal(plain.upstream.length, 1, "a connection with no required parameters stopped being called");
});

test("a key the vault does not hold refuses, and says nothing about the key", async () => {
  // THE EXISTING WALL, asserted here because this round put a new refusal above
  // it: `fill` answers `missing` rather than substituting an empty string,
  // because `Authorization: Bearer ` is a request some services answer 200 to
  // with degraded data — a page rendering something plausible and wrong.
  const api = { name: "weather", url: "https://api.test/v1?c={{param.city}}&k={{W_KEY}}",
    params: [{ name: "city", required: true }], cacheSeconds: 0 };
  const r = await serve("?city=Leeds", { api, secrets: {} });
  assert.equal(r.status, 503, r.text);
  assert.deepEqual(r.upstream, [], "a request went out with the key blank");
  assert.doesNotMatch(r.text, /W_KEY/, "the response names the site's own credential: " + r.text);
  assert.match(r.text, /isn't set up yet/, r.text);
});

test("the facts a page writer needs have ONE definition, and none for a connection that declared nothing", () => {
  const api = normalizeApi({ name: "weather", url: "https://api.test/v1?c={{param.city}}",
    params: [{ name: "city", type: "string", required: true, description: "the town or postcode" }, { name: "units" }],
    returns: DECLARED });
  const lines = apiDetailLines(api);
  assert.deepEqual(lines, [
    "city: string, REQUIRED — the town or postcode",
    "units: optional",
    'it answers {"current":{"temp_c":"number","condition":{"text":"string"}},"forecast":[{"day":"string","high":"number"}]} — read those exact field names, nothing else is there',
    'so the page writes useApi<{ current: { temp_c: number; condition: { text: string } }; forecast: { day: string; high: number }[] }>("weather", { city, units })',
  ], "the shared block is not what both prompt composers print");

  // EMPTY FOR A CONNECTION THAT DECLARED NONE OF IT, which is what keeps the
  // page catalogue's per-connection line and the addon directive's bullet byte
  // for byte what they were.
  assert.deepEqual(apiDetailLines(normalizeApi({ name: "weather", url: "https://api.test/v1", params: ["city"] })), []);
  assert.deepEqual(apiDetailLines(null), []);

  assert.equal(paramLine({ name: "a" }), "a: optional", "a bare name still says whether it may be left out");
  assert.equal(paramLine({}), "", "nothing to say about nothing");
  assert.equal(readHint({ name: "x" }), 'useApi("x")', "no parameters, no braces");
});
