// The Grok translator, driven both ways.
//
// The properties here are not evenly important. The billing one — cached tokens
// subtracted out of `in` — is the one that costs real money if it is wrong, and
// it is wrong in the direction of OVERCHARGING a customer, which is the exact
// 35% bug this repo already shipped once by summing the four token kinds.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isXaiModel, toXaiRequest, fromXaiResponse, xaiSkipped, XAI_ENDPOINT } from "../builder/model-xai.mjs";
import { contextSummary, contextSentence } from "../builder/site-context.mjs";

/* --------------------------------------------------------- which provider */

test("isXaiModel routes grok to xAI and everything else to Anthropic", () => {
  assert.equal(isXaiModel("grok-4.6"), true);
  assert.equal(isXaiModel("grok-5"), true, "a later grok must route without a new entry");
  assert.equal(isXaiModel("claude-sonnet-5"), false);
  assert.equal(isXaiModel("claude-opus-5"), false);
  assert.equal(isXaiModel(""), false);
  assert.equal(isXaiModel(null), false);
  assert.equal(isXaiModel(undefined), false);
  // Not stringified into a match: a body that is not a string is not a model id.
  assert.equal(isXaiModel(["grok-4.6"]), false);
});

/* ------------------------------------------------------------ the request */

const REQ = {
  model: "grok-4.6",
  max_tokens: 24000,
  system: [{ type: "text", cache_control: { type: "ephemeral" }, text: "You design data models." }],
  tools: [{ name: "design_schema", description: "Design it", input_schema: { type: "object", properties: { brand: { type: "string" } }, required: ["brand"] }, cache_control: { type: "ephemeral" } }],
  tool_choice: { type: "tool", name: "design_schema" },
  messages: [{ role: "user", content: "a barber shop in Leeds" }],
};

test("the request becomes OpenAI-shaped, with the system block first", () => {
  const { body } = toXaiRequest(REQ);
  assert.equal(body.model, "grok-4.6");
  assert.equal(body.max_tokens, 24000);
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /You design data models/);
  assert.deepEqual(body.messages[1], { role: "user", content: "a barber shop in Leeds" });
});

test("tools take the nested chat/completions form and the forced choice survives", () => {
  const { body } = toXaiRequest(REQ);
  assert.equal(body.tools.length, 1);
  assert.equal(body.tools[0].type, "function");
  assert.equal(body.tools[0].function.name, "design_schema");
  // The schema travels as `parameters` — the whole point of the call is
  // structured output against it, so losing it produces free-form prose.
  assert.deepEqual(body.tools[0].function.parameters, REQ.tools[0].input_schema);
  // FORCED STAYS FORCED. Degrading this to "auto" lets the model answer in prose
  // and turns a working build into the no-tool-call diagnostic.
  assert.deepEqual(body.tool_choice, { type: "function", function: { name: "design_schema" } });
});

test("cache_control markers are dropped, not passed through", () => {
  const { body } = toXaiRequest(REQ);
  // xAI has no per-block marker; sending one is at best ignored and at worst a
  // 400 on an unknown field.
  assert.doesNotMatch(JSON.stringify(body), /cache_control/);
  // What replaces it: sticky routing for the prefix cache, keyed per call site.
  assert.equal(body.prompt_cache_key, "gofarther-design_schema");
});

test("an image crosses as a data URI and a PDF is dropped AND counted", () => {
  const { body, droppedDocs } = toXaiRequest({
    ...REQ,
    messages: [{ role: "user", content: [
      { type: "text", text: "use this" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } },
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: "BBBB" } },
    ] }],
  });
  const parts = body.messages[1].content;
  assert.equal(parts.length, 2, "the PDF must not survive as an unreadable part");
  assert.equal(parts[1].image_url.url, "data:image/jpeg;base64,AAAA");
  // REPORTED, because a build that silently ignored the customer's attached
  // price list is indistinguishable from one that read it and disagreed.
  assert.equal(droppedDocs, 1);
});

test("A DROPPED PDF REACHES THE CUSTOMER'S SENTENCE, not just a log line", () => {
  // The count was the whole report, and its only reader anywhere was a
  // `console.error` — while the comment above `contentPart` said "the caller
  // can tell them". One line of a Cloudflare log is not a surface a small
  // business has, and the Attach control's documented headline use is a menu or
  // a price list, so this is the customer's most concrete input going missing.
  const { skipped } = toXaiRequest({
    ...REQ,
    messages: [{ role: "user", content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: "BBBB" } },
      { type: "text", text: "use this" },
    ] }],
  });
  assert.equal(skipped.length, 1);
  // Driven all the way through the real reporting chain, because a `{name,
  // reason}` that never becomes a sentence is the same silence one layer down.
  const s = contextSentence(contextSummary({ skipped }));
  assert.match(s, /Couldn't use the PDF you attached/);
  assert.match(s, /can't read PDFs/);
  assert.match(s, /Builder picker|paste/, "the refusal must say what to do instead");
  // A build with no PDF says nothing extra, so an ordinary response is
  // byte-identical to what it was before this existed.
  assert.deepEqual(toXaiRequest(REQ).skipped, []);
  assert.equal(contextSummary({ skipped: [] }).skipped, undefined);
});

test("the pre-call answer and the translator's agree, and only for grok", () => {
  // The route cannot use the translator's copy: `contextSummary` — the one
  // thing that reports refused attachments — is built BEFORE page generation
  // and is provider-blind, so the drop has to be knowable from the blocks and
  // the model alone. Two answers to one question is how they come to disagree,
  // so both are asserted against each other rather than each against a fixture.
  const blocks = [
    { type: "image", source: { type: "base64", media_type: "image/png", data: "AA" } },
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: "BB" } },
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: "CC" } },
  ];
  // Exactly how `pagesRequest` and `designSiteSchema` place them: blocks first,
  // then the text, in the user message.
  const req = { ...REQ, messages: [{ role: "user", content: [...blocks, { type: "text", text: "a cafe" }] }] };
  assert.deepEqual(xaiSkipped(blocks, "grok-4.6"), toXaiRequest(req).skipped);
  assert.match(xaiSkipped(blocks, "grok-4.6")[0].name, /^2 PDFs/, "the count must survive into the name");

  // NOT ON THE ANTHROPIC PATH, which reads PDFs natively — reporting a refusal
  // there would tell a customer their menu was ignored when it was read.
  assert.deepEqual(xaiSkipped(blocks, "claude-sonnet-5"), []);
  assert.deepEqual(xaiSkipped(blocks, undefined), []);
  // Junk in never throws: this sits on the build path, before the model call.
  for (const bad of [null, undefined, "no", [null, 7, {}]]) assert.doesNotThrow(() => xaiSkipped(bad, "grok-4.6"));
  assert.deepEqual(xaiSkipped([{ type: "image" }], "grok-4.6"), [], "an image is not a dropped document");
});

test("a request with no tools or no forced choice still translates", () => {
  const { body } = toXaiRequest({ model: "grok-4.6", max_tokens: 100, messages: [{ role: "user", content: "hi" }] });
  assert.equal(body.tools, undefined);
  assert.equal(body.tool_choice, undefined);
  assert.equal(body.messages.length, 1);
  // Nothing throws on junk, because a translator that throws turns a provider
  // difference into a 500 on the build path.
  assert.doesNotThrow(() => toXaiRequest(null));
  assert.doesNotThrow(() => toXaiRequest({ system: 7, messages: "no", tools: "no" }));
});

/* ----------------------------------------------------------- the response */

const RES = {
  choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ id: "c1", function: { name: "design_schema", arguments: '{"brand":"Fade & Co","tables":[{"name":"bookings"}]}' } }] } }],
  usage: { prompt_tokens: 5000, completion_tokens: 900, prompt_tokens_details: { cached_tokens: 4200 } },
};

test("a tool call arrives as a tool_use block with PARSED input", () => {
  const j = fromXaiResponse(RES);
  // Read exactly the way both call sites read it.
  const use = j.content.find((b) => b && b.type === "tool_use");
  assert.ok(use, "the callers find their answer by scanning for type tool_use");
  assert.equal(use.input.brand, "Fade & Co");
  assert.equal(use.input.tables[0].name, "bookings");
  assert.equal(j.stop_reason, "tool_calls");
});

test("CACHED TOKENS ARE SUBTRACTED OUT OF `in` — the billing property", () => {
  const j = fromXaiResponse(RES);
  // OpenAI's prompt_tokens INCLUDES cached; Anthropic's input_tokens excludes
  // them. Passing it straight through prices 4,200 cached tokens at the fresh
  // rate instead of 0.25x.
  assert.equal(j.usage.input_tokens, 800, "5000 prompt - 4200 cached");
  assert.equal(j.usage.cache_read_input_tokens, 4200);
  assert.equal(j.usage.output_tokens, 900);
  // xAI has no write surcharge, so those tokens are already inside `in` at the
  // ordinary rate and must not be double-counted into the 1.25x column.
  assert.equal(j.usage.cache_creation_input_tokens, 0);
});

test("no cache details reported reads as a fully fresh call", () => {
  const j = fromXaiResponse({ choices: [{ message: {} }], usage: { prompt_tokens: 300, completion_tokens: 10 } });
  assert.equal(j.usage.input_tokens, 300);
  assert.equal(j.usage.cache_read_input_tokens, 0);
});

test("finish_reason length becomes max_tokens, so the truncation guards fire", () => {
  // Both call sites already refuse a truncated answer, because half-written JSON
  // parses into a page whose last file ends mid-expression.
  const j = fromXaiResponse({ ...RES, choices: [{ ...RES.choices[0], finish_reason: "length" }] });
  assert.equal(j.stop_reason, "max_tokens");
});

test("arguments that do not parse produce NO tool_use", () => {
  // A malformed answer must reach the callers' `shape` diagnostic rather than
  // becoming a half-built page.
  for (const args of ['{"brand":"Fade', "", "not json"]) {
    const j = fromXaiResponse({ choices: [{ message: { tool_calls: [{ function: { name: "design_schema", arguments: args } }] } }] });
    assert.equal(j.content.find((b) => b.type === "tool_use"), undefined, `arguments ${JSON.stringify(args)} must not read as an answer`);
  }
});

test("arguments that parse to a non-object produce NO tool_use", () => {
  // `null`, `[]` and `7` all parse cleanly and none of them is an input object;
  // passing one through gives the callers something they cannot read fields off.
  for (const args of ["null", "[]", "7", '"a string"']) {
    const j = fromXaiResponse({ choices: [{ message: { tool_calls: [{ function: { name: "x", arguments: args } }] } }] });
    assert.equal(j.content.find((b) => b.type === "tool_use"), undefined, `arguments ${args} must not read as an answer`);
  }
});

test("a prose answer with no tool call is readable and reports its shape", () => {
  const j = fromXaiResponse({ choices: [{ finish_reason: "stop", message: { content: "I can't do that." } }], usage: {} });
  assert.equal(j.content.find((b) => b.type === "tool_use"), undefined);
  assert.equal(j.content[0].type, "text");
  // The callers build their diagnostic from stop_reason + the block types.
  assert.equal(j.stop_reason, "stop");
  assert.deepEqual(j.content.map((b) => b.type), ["text"]);
});

test("junk never throws — a provider difference must not become a 500", () => {
  for (const bad of [null, undefined, {}, { choices: [] }, { choices: "no" }, { choices: [{ message: { tool_calls: "no" } }] }]) {
    assert.doesNotThrow(() => fromXaiResponse(bad));
    const j = fromXaiResponse(bad);
    assert.ok(Array.isArray(j.content));
    assert.equal(typeof j.usage.input_tokens, "number");
  }
});

/* ------------------------------------------------------------- the wiring */

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CODE = WORKER.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

test("both builder calls go through the one provider decision", () => {
  // The failure this prevents: one call site converted and the other still
  // posting a grok model id to Anthropic, which 400s on a path nobody drove.
  for (const fn of ["designSiteSchema", "generateSitePages"]) {
    const at = CODE.indexOf(`async function ${fn}(`);
    assert.ok(at > 0, `could not find ${fn} — this check would be vacuous`);
    // Bounded by the NEXT function rather than a byte count. `designSiteSchema`
    // carries the whole tool request inline and outran a 4,000-byte window on
    // the first run — the sized-window own-goal this repo has recorded a dozen
    // times, hit again in the test written the same hour as the warning.
    const next = CODE.indexOf("\nasync function ", at + 10);
    const body = CODE.slice(at, next > at ? next : CODE.length);
    assert.ok(body.length > 500, `${fn}'s body did not slice — this check would be vacuous`);
    assert.match(body, /await callBuilderModel\(env, req\)/, `${fn} must send through callBuilderModel`);
    assert.doesNotMatch(body, /fetch\("https:\/\/api\.anthropic\.com/, `${fn} must not keep its own provider fetch`);
  }
});

test("the xAI branch refuses a missing key by name, before spending a request", () => {
  const at = CODE.indexOf("async function callBuilderModel(");
  const body = CODE.slice(at, CODE.indexOf("async function anthropicMessages("));
  assert.ok(body.length > 200, "could not find callBuilderModel — this check would be vacuous");
  assert.match(body, /XAI_API_KEY/);
  // Named rather than sent as `undefined`: an unset key otherwise comes back a
  // 401 that reads exactly like a wrong key, and those need opposite fixes.
  assert.ok(body.indexOf("!env.XAI_API_KEY") < body.indexOf("fetch(XAI_ENDPOINT"),
    "the key check must come before the request");
  assert.match(body, /isXaiModel\(req\.model\)/);
});

test("the endpoint is xAI's chat completions", () => {
  assert.equal(XAI_ENDPOINT, "https://api.x.ai/v1/chat/completions");
});
