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
  paramLine, readHint, apiDetailLines, missingRequired, credentialNote, secretsNeeded,
  SHAPE_LEAVES, PARAM_TYPES, MAX_PARAMS, MAX_SHAPE_DEPTH, MAX_SHAPE_NODES,
  MAX_CREDENTIAL_SAID, SHAPE_TOP,
} from "../site-api-shape.mjs";
import { normalizeApi, declFingerprint, secretsNeeded as apiSecretsNeeded } from "../site-apis.mjs";
import { API_ITEM } from "../builder/site-table.mjs";
import { addTool } from "../builder/site-add.mjs";
import { toXaiRequest } from "../builder/model-xai.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";

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

test("what may sit at the ROOT of a sketch is one rule, and the tool declares exactly it", () => {
  // ⚠ THE TWO HAD DRIFTED, WHICH IS WHY THIS IS A CENSUS AND NOT A PAIR OF
  // ASSERTIONS. `API_ITEM.returns` said `type: "object"` while `cleanShape`
  // walked a top-level ARRAY perfectly happily — so the commonest list
  // endpoint there is could be described by the pipeline and not by the tool,
  // and a model obeying the schema had no way to say so. One definition now:
  // the tool's type IS `SHAPE_TOP`, and this asks BOTH ends of every probe so
  // widening either alone is a red run.
  const probes = [
    { what: "an object", v: { a: "string" }, json: "object" },
    { what: "a top-level list", v: [{ a: "string" }], json: "array" },
    { what: "an empty list", v: [], json: "array" },
    { what: "a bare leaf name", v: "string", json: "string" },
    { what: "a number", v: 42, json: "number" },
    { what: "a boolean", v: true, json: "boolean" },
  ];
  for (const p of probes) {
    const admits = API_ITEM.properties.returns.type.includes(p.json);
    const clean = cleanShape(p.v);
    const accepts = !!(clean && clean.ok);
    assert.equal(accepts, admits,
      p.what + ": the tool " + (admits ? "admits" : "refuses") + " it and the cleaner " + (accepts ? "accepts" : "refuses") + " it");
  }
  // THE OBSERVER IS ALIVE IN BOTH DIRECTIONS — a rule admitting everything and
  // a rule admitting nothing both satisfy a loop that only ever agrees.
  assert.ok(probes.some((p) => cleanShape(p.v) && cleanShape(p.v).ok), "no probe is accepted");
  assert.ok(probes.some((p) => { const c = cleanShape(p.v); return c && !c.ok; }), "no probe is refused");

  assert.deepEqual(API_ITEM.properties.returns.type, SHAPE_TOP.slice(),
    "the tool's type is a second copy of what the root may be");
  assert.deepEqual(SHAPE_TOP, ["object", "array"]);
  assert.notEqual(API_ITEM.properties.returns.type, SHAPE_TOP,
    "the frozen constant itself went onto the wire, where a tool consumer could freeze the platform's own rule");

  // A BARE LEAF IS OUT ON PURPOSE. `returns: "a list of exchange rates"` is
  // what a model writes when it reaches for prose, and it is named rather than
  // folded into the nesting refusals.
  assert.equal(cleanShape("a list of exchange rates").why, "shape-top");
  assert.equal(cleanShape("string").why, "shape-top", "a leaf NAME is still not a whole answer");
  assert.equal(cleanShape(42).why, "shape-top");
  assert.equal(cleanShape(""), null, "an empty string is nothing declared, not a refusal");
  // AND NESTED LEAVES ARE UNTOUCHED, which is the whole of what a sketch is.
  assert.deepEqual(cleanShape({ a: "string" }).shape, { a: "string" });
  assert.deepEqual(cleanShape([{ a: "string" }]).shape, [{ a: "string" }]);

  // THE TOOL SAYS IT IN WORDS TOO, because the type alone leaves a model to
  // guess what an array at the root would mean.
  assert.match(API_ITEM.properties.returns.description, /when the WHOLE answer is a list/);
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

  // ⚠ AND THE TOOL MUST OFFER WHAT THE CLEANER CAN STORE, which is the same
  // drift `returns` had and was caught the same way — by a sweep mutant that
  // put `items: {type:"string"}` back on `params` with every case still green.
  // A bare-string item is the shape every connection stored before today, and
  // as the OFFER it is a tool that can never be told a type, a required flag
  // or a description: the pipeline keeps all three and no model can say one.
  // Censused BOTH WAYS, because a tool offering more than the cleaner keeps is
  // a field answered and silently dropped.
  const offered = API_ITEM.properties.params.items;
  assert.equal(offered.type, "object", "the tool asks for a bare name, so the three below are unreachable");
  // The one rename, stated once: the tool says `description` and the store says
  // `note`. Everything else is the same word at both ends.
  const STORED_AS = { name: "name", type: "type", required: "required", description: "note" };
  const full = cleanParams([{ name: "city", type: "string", required: true, description: "the town or postcode" }]);
  assert.deepEqual(Object.keys(offered.properties).sort(), Object.keys(STORED_AS).sort(),
    "the tool's parameter properties and the mapping have drifted");
  assert.deepEqual(Object.keys(full.info[0]).sort(), Object.values(STORED_AS).sort(),
    "the cleaner keeps a field the tool does not offer, or drops one it does");
  assert.deepEqual(offered.properties.type.enum, PARAM_TYPES, "the offered types are a second copy of the accepted ones");

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

  // ⚠ A PADDED NAME IS DROPPED, NEVER REPAIRED, and the cost of repairing it is
  // not in this function at all: `normalizeApi` has lowercased and matched
  // without trimming since it was written, so every connection on the platform
  // normalises to exactly the list it normalised to yesterday — which is what
  // keeps `declFingerprint`, and therefore every cached answer, where it is.
  // A one-character widening here re-keys a stranger's cache for a name nobody
  // has ever declared.
  assert.deepEqual(cleanParams([" city ", "units"]).names, ["units"],
    "a padded name was repaired, which re-keys a stored connection's cache");

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

test("where the key comes from is DERIVED from EACH connection's own declaration, never claimed", () => {
  // ⚠ PER CONNECTION, AND THE FIXTURE HAS TO BE A REAL DECLARATION FOR THAT TO
  // MEAN ANYTHING. The old one was `{name, credential}` with no url at all, so
  // it needed no key by accident — a fixture less capable than the thing it
  // stood for, in the one field the whole derivation reads.
  const KEYED = { name: "rates", url: "https://oxr.test/latest?app_id={{RATES_KEY}}",
    credential: { service: "Open Exchange Rates", url: "https://openexchangerates.org/signup", note: "free tier covers 1,000 calls" } };
  // MISLEADING METADATA ON A KEYLESS CONNECTION: it names a service and a
  // sign-up page, and it carries no `{{SECRET}}` anywhere. The declaration is
  // the authority and the claim is ignored.
  const FREE = { name: "tides", url: "https://tides.test/today",
    credential: { service: "TideWatch", url: "https://tidewatch.test/signup" } };

  assert.match(credentialNote([KEYED]), /comes from Open Exchange Rates at https:\/\/openexchangerates\.org\/signup \(free tier covers 1,000 calls\)/);

  // ALONE. It used to answer "That connection needs no key, so it is answering
  // already" — a claim about a third party nobody had called. What this
  // platform knows is what the OWNER has left to do, which is nothing.
  assert.equal(credentialNote([FREE]), "tides needs no key, so there is nothing to paste for it.");

  // ⚠ MIXED, WHICH IS THE ARRANGEMENT A FLAT SECRETS LIST CANNOT READ. The
  // list is non-empty because of the KEYED one, so every connection in the
  // request took the keyed branch and the keyless one's metadata was printed
  // as provenance.
  const mixed = credentialNote([KEYED, FREE]);
  assert.match(mixed, /The key for rates comes from Open Exchange Rates/, mixed);
  assert.match(mixed, /tides needs no key, so there is nothing to paste for it\.$/, mixed);
  assert.doesNotMatch(mixed, /TideWatch/, "the keyless connection's credential claim was believed: " + mixed);

  // A SECRET IN A HEADER OR A BODY COUNTS, because `fill` refuses on all three
  // — the sentence and the refusal read the same declaration.
  assert.match(credentialNote([{ name: "rates", url: "https://oxr.test/latest",
    headers: { Authorization: "Bearer {{RATES_KEY}}" }, credential: { service: "OXR" } }]), /The key for rates comes from OXR\./);
  assert.match(credentialNote([{ name: "rates", url: "https://oxr.test/q", method: "POST", body: "{\"k\":\"{{RATES_KEY}}\"}",
    credential: { service: "OXR" } }]), /The key for rates comes from OXR\./);

  assert.equal(credentialNote([]), "", "no connection, nothing to say");
  assert.equal(credentialNote([{ ...KEYED, credential: undefined }]), "",
    "a key is needed and nobody said where it comes from — the destination sentence already covers that");
  assert.equal(credentialNote(null), "", "a reply with no connections at all");

  // BOTH HALVES ARE CAPPED, so one reply is a sentence rather than a page.
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const lots = credentialNote(many(6, (i) => ({ ...KEYED, name: "r" + i })));
  assert.equal(lots.split("The key for").length - 1, MAX_CREDENTIAL_SAID, lots);
  const frees = credentialNote(many(6, (i) => ({ ...FREE, name: "t" + i })));
  assert.equal(frees, "t0, t1, t2 need no key, so there is nothing to paste for them.", frees);

  // ONE READER, AND IT IS THE ONE THE CALL PATH REFUSES WITH. `site-apis.mjs`
  // re-exports this rather than keeping a second copy of the pattern — a fork
  // is how a connection gets told it needs no key while `fill` refuses the
  // call for a missing one.
  assert.equal(apiSecretsNeeded, secretsNeeded, "the request path and the sentence read different declarations");
  assert.deepEqual(secretsNeeded(KEYED), ["RATES_KEY"]);
  assert.deepEqual(secretsNeeded(FREE), []);

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
// ⚠ EACH CALL NEEDS ITS OWN SLUG. `siteBackendBySlug` is memoized per slug for
// five minutes and the schema read is cached beside it, so two calls under one
// name answer from the FIRST one's spec — measured: the third case here, on a
// connection declaring no required parameter at all, came back "this connection
// needs city" from the case above it. A cache shared between cases makes every
// case after the first a test of the first one's data.
let served = 0;

/**
 * ONE PLATFORM STUB, SHARED WITH THE RENDER. `platformFetch` answers Supabase,
 * Neon and the service; this adds nothing to it but the request. Two copies of
 * that stub is how a case here and a case there start disagreeing about what a
 * site's own row looks like.
 */
async function serve(query, { api, secrets = { W_KEY: "real-key" }, answer = { temp_c: 18.5 } } = {}) {
  const slug = "fw-serve-" + (++served);
  const { platformFetch, makeVault } = await import("./fixtures/site-render.mjs");
  const { hit } = await import("./fixtures/worker-harness.mjs");
  const vault = await makeVault(secrets);
  const plat = await platformFetch({ slug, api, vault,
    service: () => new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } }) });
  const real = globalThis.fetch;
  globalThis.fetch = plat.fetch;
  try {
    const r = await hit("/api/db/" + slug + "/api/weather" + query, {
      env: { SITE_SECRETS_KEY: vault.key, SUPABASE_SERVICE_KEY: "k", SUPABASE_ANON_KEY: "a" },
    });
    return { ...r, upstream: plat.upstream };
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

// ── THE PROVIDER'S OWN WIRE FORM ────────────────────────────────────────────
//
// ⚠ THREE CLAIMS, KEPT APART, because only the first two happen here.
//
//   DOCUMENTED COMPATIBILITY — the forms the outgoing schema uses are standard
//   JSON Schema, and `additionalProperties` as an open-key permission is what
//   `builder/site-table.mjs` already uses twice for a map whose keys are the
//   customer's own (`searchWeights`, `computed`).
//
//   LOCAL VALIDATION — a checker implementing the rule xAI DOCUMENTS (an object
//   is closed unless its schema says otherwise) admits a real object sketch and
//   a real top-level list against the schema as `toXaiRequest` really sends it.
//
//   PROVIDER ACCEPTANCE — NOT ESTABLISHED, here or anywhere in this repository.
//   That needs one real call to xAI, which costs money and is the owner's; no
//   paid probe is authorized. The type union on this same field carries the
//   same caveat and for the same reason.
//
// WHY A LOCAL CHECKER RATHER THAN A VALIDATOR OFF THE SHELF: the rule under
// test is the provider's DEPARTURE from JSON Schema's default, so a
// spec-conformant validator would admit the closed object and prove nothing.
// The departure is one branch, written out below and mutated by the sweep.
test("a sketch's own field names survive onto the wire, in the request the provider really gets", async () => {
  // The documented rule, and the one branch that is not JSON Schema's own is
  // marked. `null` is "admitted"; a string is why it was refused.
  const admits = (schema, v, at = "$") => {
    if (!schema || typeof schema !== "object") return null;   // no schema: unconstrained
    const want = schema.type === undefined ? null : (Array.isArray(schema.type) ? schema.type : [schema.type]);
    const raw = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
    const jt = raw === "number" && Number.isInteger(v) ? "integer" : raw;
    if (want && !want.includes(jt) && !(jt === "integer" && want.includes("number"))) {
      return at + ": a " + jt + " where the schema says " + want.join("|");
    }
    if (Array.isArray(v)) {
      if (schema.items === undefined) return null;            // no `items`: entries unconstrained
      for (let i = 0; i < v.length; i++) {
        const bad = admits(schema.items, v[i], at + "[" + i + "]");
        if (bad) return bad;
      }
      return null;
    }
    if (v && typeof v === "object") {
      const props = schema.properties || {};
      for (const k of Object.keys(v)) {
        if (Object.hasOwn(props, k)) {
          const bad = admits(props[k], v[k], at + "." + k);
          if (bad) return bad;
          continue;
        }
        // ⚠ THE DEPARTURE, and the whole subject of this case: absent reads as
        // FALSE. Under JSON Schema's own default this branch would admit.
        const extra = schema.additionalProperties;
        if (extra === undefined || extra === false) return at + "." + k + ": the schema admits no such key";
        if (extra === true) continue;
        const bad = admits(extra, v[k], at + "." + k);
        if (bad) return bad;
      }
      return null;
    }
    return null;
  };

  // THE TWO SKETCHES ARE ONES THE PRODUCT REALLY ACCEPTS, asserted first — or
  // this case could prove the wire admits something `cleanShape` refuses,
  // which is the drift it exists to stop rather than a property worth having.
  const OBJ = { current: { temp_c: "number", condition: { text: "string" } },
    forecast: [{ day: "string", high: "number" }] };
  const LIST = [{ id: "number", title: "string" }];
  assert.equal(cleanShape(OBJ).ok, true, "the object sketch is not one the cleaner takes");
  assert.equal(cleanShape(LIST).ok, true, "the list sketch is not one the cleaner takes");

  // THE SCHEMA AS IT REALLY GOES OUT — walked out of the request BODY and not
  // out of the module, because the translation is the hop under test. This
  // repo's own wiring trap: a permission perfect in the source and dropped one
  // hop later is indistinguishable from one nobody wrote.
  const tool = addTool("api");
  const { body } = toXaiRequest({
    model: "grok-4.6", max_tokens: 8000,
    messages: [{ role: "user", content: "connect the forecast service" }],
    tools: [tool], tool_choice: { type: "tool", name: tool.name },
  });
  const fn = (body.tools || []).find((t) => t.function && t.function.name === tool.name);
  assert.ok(fn, "the api tool did not survive the translation: " + JSON.stringify(Object.keys(body)));
  const sent = fn.function.parameters.properties.api.items.properties.returns;

  assert.equal(admits(sent, OBJ), null, "the object sketch is refused on the wire: " + admits(sent, OBJ));
  assert.equal(admits(sent, LIST), null, "the list sketch is refused on the wire: " + admits(sent, LIST));

  // THE OBSERVER PROVED ALIVE, and in the direction that matters: take the
  // permission away and the SAME checker must refuse the SAME sketch.
  const closed = { ...sent };
  delete closed.additionalProperties;
  assert.ok(admits(closed, OBJ), "the checker admits an object with no key permission, so it proves nothing");

  // AND THE LIST BRANCH WAS NEVER AT RISK — said out loud rather than implied,
  // because it is why there is no `items` belt beside the permission. A
  // top-level list declares no object schema anywhere for the rule to close.
  assert.equal(admits(closed, LIST), null, "the list sketch depends on the object permission, so the reasoning is wrong");

  // THE TYPE UNION SURVIVES THE SAME HOP, and it is a COPY: the platform's own
  // frozen rule must never be the thing on the wire.
  assert.deepEqual(sent.type, ["object", "array"], "the root rule did not reach the provider: " + JSON.stringify(sent.type));
  assert.notEqual(sent.type, SHAPE_TOP, "the platform's own frozen constant went onto the wire");

  // BOTH DOORS, and they are one object: the design step asks for a connection
  // too, so a permission on one tool and not the other is a first build whose
  // sketches are refused and an addon whose are not.
  const design = await readSchemaTool();
  const designItem = design.tool.input_schema.properties.backend.properties.apis.items;
  assert.equal(designItem.properties.returns.additionalProperties, true,
    "the design step's own connection schema admits no field names");
  assert.equal(designItem, API_ITEM, "the design step reads its own copy of what a connection declares");
  assert.equal(tool.input_schema.properties.api.items, API_ITEM, "the addon step reads its own copy");
});
