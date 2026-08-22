// The Grok translator, driven both ways.
//
// The properties here are not evenly important. The billing one — cached tokens
// subtracted out of `in` — is the one that costs real money if it is wrong, and
// it is wrong in the direction of OVERCHARGING a customer, which is the exact
// 35% bug this repo already shipped once by summing the four token kinds.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isXaiModel, toXaiRequest, fromXaiResponse, xaiSkipped, xaiErrorDetail, XAI_ENDPOINT } from "../builder/model-xai.mjs";
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
/**
 * `worker.js` WITH ITS COMMENTS BLANKED, length-preserving, so an index found
 * here still points at the same byte in the real source.
 *
 * PROSE DESCRIBING A THING CONTAINS THAT THING'S SPELLING — recorded in this
 * repo in a lint, a router guard, an absence check, a scope scan, a mutation
 * and several source-reads. It bit here on 2026-08-22: a comment explaining
 * that a malformed tool would kill a build at `stage: "design"` became the
 * FIRST occurrence of that literal in the file, so a check anchored on it
 * walked into the paragraph instead of the branch.
 *
 * WHOLE-LINE ONLY, and that is the rule this repo learned the expensive way: a
 * blanket `/\/\*[\s\S]*?\*\//` on this file eats 46% of it, because a stray
 * `/*` inside a string or a regex runs to the next real terminator. Blanking
 * only lines that ARE comments cannot do that.
 */
const WORKER_CODE = WORKER
  .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\*.*$/gm, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\/\*+.*$/gm, (m) => " ".repeat(m.length));
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
    // THE ARGUMENT, NOT THE ARGUMENT LIST. Pinned to `(env, req)` exactly, this
    // went red the day the build budget became a third parameter — reporting
    // "must send through callBuilderModel" about a call that does exactly that.
    // What has to hold is that `req` is what gets sent, however many arguments
    // ride after it.
    assert.match(body, /await callBuilderModel\(env, req[,)]/, `${fn} must send through callBuilderModel`);
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

test("an xAI error body is translated too, or `billing` and `upstreamType` are dead for every Grok build", () => {
  // THE TRANSLATION STOPPED AT THE HAPPY PATH. `toXaiRequest` and
  // `fromXaiResponse` exist so no line downstream knows which provider
  // answered; the ERROR body went through raw, and `upstreamKind` parses
  // Anthropic's envelope. So the two fields built to diagnose a provider
  // failure were supplied by a parser reading a shape that never arrives —
  // and the one actionable message on the build path could not fire.
  const anth = JSON.parse(xaiErrorDetail(JSON.stringify({ error: { message: "You exceeded your current quota", type: "insufficient_quota" } })));
  assert.equal(anth.error.type, "insufficient_quota");
  assert.match(anth.error.message, /exceeded your current quota/);

  // `error` AS A STRING is the shape that produced two nulls: `err.type` and
  // `err.message` are both undefined on it, so nothing downstream had anything
  // to read. The code carries the type here.
  const str = JSON.parse(xaiErrorDetail(JSON.stringify({ error: "Your credit balance is too low", code: "insufficient_quota" })));
  assert.equal(str.error.type, "insufficient_quota");
  assert.match(str.error.message, /credit balance is too low/);

  // NOT JSON AT ALL — a proxy's HTML, a gateway's plain text. No type to
  // report, and the prose is the only thing there is, so it must still ride as
  // the message rather than being dropped.
  const html = JSON.parse(xaiErrorDetail("<html>502 Bad Gateway</html>"));
  assert.equal(html.error.type, null);
  assert.match(html.error.message, /502 Bad Gateway/);

  // IT NEVER INVENTS A TYPE, the same shape check `upstreamKind` applies —
  // this must not become a second channel for arbitrary upstream text.
  for (const junk of ["Not A Code", "a".repeat(60), "with spaces", "<script>"]) {
    assert.equal(JSON.parse(xaiErrorDetail(JSON.stringify({ error: { message: "x", type: junk } }))).error.type, null, junk);
  }
  // …and nothing throws on any shape, since this runs inside a catch on the
  // build path: a throw here would replace a diagnosable failure with an
  // undiagnosable one.
  for (const bad of [null, undefined, "", "[]", "null", "7", '{"a":1}']) {
    assert.doesNotThrow(() => JSON.parse(xaiErrorDetail(bad)), String(bad));
  }
});

test("…and the worker translates at the boundary rather than passing the raw body on", () => {
  // BOTH ENDS: the module can be perfectly right and never reached — the layer
  // this repo has lost twelve features in.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*\bxaiErrorDetail\b[^}]*\} from "\.\/builder\/model-xai\.mjs"/,
    "naming it without importing it is a ReferenceError on the build path");
  assert.match(w, /e\.detail = xaiErrorDetail\(await r\.text\(\)/,
    "the xAI error body is passed through raw again, so upstreamKind reads a shape that never arrives");
  // AND THE CODE IS BELIEVED. Matching a fixed token is what a wording match
  // can never be: stable across a provider rewording its own message.
  assert.match(w, /type === "insufficient_quota"/,
    "an exhausted account is diagnosed only by its prose again");
});

test("A BUILDER MODEL CALL IS BOUNDED — every fetch in it, both providers", () => {
  // THE ONLY UNBOUNDED FETCHES IN THE FILE, and what that cost was measured
  // rather than argued: an Arabic brief on Grok ran 25m46s without answering
  // and was stopped only by a CI job cap. The customer was left a claimed slug,
  // a live Neon project, a five-credit charge and no site, after 27 minutes of
  // waiting with nothing said. Reachable from a browser by anyone whose brief
  // happens to be the slow shape.
  //
  // DERIVED OVER THE FUNCTION BODY, not pinned to today's two call sites. The
  // bug WAS one unbounded fetch, so a third provider added later has to be
  // covered without anybody remembering this file.
  const at = WORKER.indexOf("async function callBuilderModel(");
  assert.ok(at > 0, "callBuilderModel moved — rescope this");
  const body = WORKER.slice(at, WORKER.indexOf("\nasync function anthropicMessages(", at));
  assert.ok(body.length > 500, "the callBuilderModel window is empty — rescope this");

  const calls = [...body.matchAll(/\bfetch\(/g)];
  assert.ok(calls.length >= 2, "expected a fetch per provider; found " + calls.length);
  for (const m of calls) {
    // Read to the end of this call by bracket depth — a request init is full of
    // braces and a flat scan has been written wrong here four times.
    let i = m.index + m[0].length - 1, d = 0;
    while (i < body.length) {
      if (body[i] === "(") d++;
      else if (body[i] === ")" && --d === 0) break;
      i++;
    }
    assert.ok(d === 0, "could not find the end of a fetch call — the depth scan is broken, not the code");
    // RESOLVED TO ITS DEFINITION, never matched as a spelling. This pinned
    // `AbortSignal.timeout(BUILDER_CALL_MS)` literally and went red the day the
    // build budget made the bound the SOONER of that ceiling and what is left of
    // the build — a correct change failing a check about how the expression is
    // written. The property is that every fetch carries a signal and that its
    // bound derives from `BUILDER_CALL_MS`, whether directly or through a local.
    const init = body.slice(m.index, i + 1);
    const sig = init.match(/signal:\s*AbortSignal\.timeout\(([^)]*)\)/);
    assert.ok(sig, "a builder model call is unbounded again — a hung provider waits forever and charges for it");
    const arg = sig[1].trim();
    if (!/\bBUILDER_CALL_MS\b/.test(arg)) {
      // A local. It must be defined IN THIS FUNCTION and must name the ceiling —
      // otherwise a bound could quietly become an unrelated number and the check
      // would still pass because a signal is present.
      const def = body.match(new RegExp("\\b(?:const|let)\\s+" + arg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=([^;]*);"));
      assert.ok(def, `the bound \`${arg}\` is not defined inside callBuilderModel — it could be anything`);
      assert.match(def[1], /\bBUILDER_CALL_MS\b/,
        `the bound \`${arg}\` no longer derives from BUILDER_CALL_MS — the per-call ceiling is gone`);
    }
  }

  // THE VALUE HAS TO BIND WITHOUT REFUSING HONEST BUILDS, and both directions
  // are real. Too tight refuses a slow build that would have finished — the
  // slowest MEASURED generation is 156s; too loose does not bound the 1546s
  // hang this exists for. Asserted as a range rather than a number, so tuning
  // inside the safe band does not fail a test about a property.
  const ms = Number(/const BUILDER_CALL_MS = (\d+)/.exec(WORKER)[1]);
  assert.ok(ms >= 300000, "the builder bound would refuse builds that legitimately take minutes");
  assert.ok(ms <= 900000, "the builder bound is loose enough that the measured 26-minute hang still nearly passes");

  // NOT A BLANKET RULE ON EVERY FETCH, and that was measured before choosing:
  // 18 of the 127 `fetch(` calls in this file carry no signal, and most are
  // legitimate — the Worker's own entry dispatch, pass-throughs, wrappers whose
  // caller supplies the init, and the container calls that have their own
  // STEP_TIMEOUT. A rule flagging all 18 is a false alarm on correct code,
  // which this repo rates worse than the miss.
});

test("a timeout is told from a provider outage, by NAME", () => {
  // Without asking, a timeout has no HTTP response — `status` undefined,
  // nothing for `upstreamKind` to read — so it fell through to "The designer is
  // busy", blaming the provider for a ceiling of ours and inviting a retry into
  // the same wait.
  assert.match(WORKER, /const isCallTimeout = \(e\) =>[^\n]*e\.name === "TimeoutError"/,
    "the timeout is no longer recognised by the name the runtime actually throws");
  // AbortError too: the same abort reaches different runtimes under both names,
  // and this code runs in workerd while its tests run in Node.
  assert.match(WORKER, /const isCallTimeout = \(e\) =>[^\n]*e\.name === "AbortError"/,
    "only one of the two abort names is recognised");
  // NEVER BY MESSAGE. That string is the runtime's and differs between engines
  // — the cross-engine comparison this repo has already been bitten by twice.
  assert.ok(!/isCallTimeout[\s\S]{0,200}?e\.message/.test(WORKER),
    "the timeout is recognised by its message, which differs between workerd and Node");

  // AND THE DESIGN REFUSAL SAYS SO, and says the money is back. That branch
  // reported nothing about cost at all, so somebody watching a build fail could
  // not tell whether they had paid for it.
  // ANCHORED ON THE BRANCH, NOT ON A BYTE COUNT. This read
  // `slice(indexOf('stage: "design"') - 2000, +400)` and went red the moment a
  // comment was written above the design call — a test about a timeout arm
  // failing because a paragraph elsewhere pushed the condition out of a
  // window. This repo's most repeated own-goal, and it had already been
  // recorded three times before this one; the rule is never to size a
  // source-read window in bytes.
  //
  // The refusal begins at the `catch` that owns it, so the window runs from
  // there to the stage it names — a span that grows and shrinks with the
  // branch itself and cannot be outrun by prose above it.
  // AGAINST BLANKED COMMENTS, because a paragraph elsewhere that merely NAMES
  // this stage is not the branch and must not be found instead of it.
  const stageAt = WORKER_CODE.indexOf('stage: "design"');
  assert.ok(stageAt > 0, "the design refusal is gone — this check is measuring nothing");
  const catchAt = WORKER_CODE.lastIndexOf("catch (e) {", stageAt);
  assert.ok(catchAt > 0 && stageAt - catchAt < 6000,
    "the design refusal is no longer inside a catch — retarget this check rather than widening it");
  const seg = WORKER.slice(catchAt, stageAt + 400);

  // THE CONDITION ITSELF, NOT MERELY PRESENT SOMEWHERE IN THE BRANCH. Found by
  // mutation: `/isCallTimeout\(e\)/` alone is satisfied by
  // `false && isCallTimeout(e)`, which leaves the arm dead and the timeout
  // wearing "the designer is busy" — a presence standing in for a property, the
  // third instance of that shape in one sitting. So the colon, the call and the
  // `?` are asserted as one, which nothing can be short-circuited into.
  //
  // WHAT THIS CAN AND CANNOT PROVE, said plainly rather than implied: it holds
  // the branch's SHAPE. Proving that a real timeout produces this message needs
  // the route driven with a fetch that never resolves, which is a different and
  // much larger harness; the predicate's own rule (name, never message) is
  // asserted above and is the half that would silently rot.
  assert.match(seg, /:\s*isCallTimeout\(e\)\s*\n?\s*\?/,
    "a design timeout wears the provider's 'busy' message again — the arm is present but not the condition");
  assert.match(seg, /nothing was charged/, "the timeout no longer tells the customer they were not charged");
  assert.match(seg, /cost: 0,/, "the design refusal is silent about money again");
});
