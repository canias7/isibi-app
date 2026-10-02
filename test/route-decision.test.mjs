// WHERE A ROUTING ANSWER CAME FROM: THE MODEL, A FALLBACK, OR A RULE, WITH A
// FIXED CODE FOR EVERY FALLBACK AND NORMALIZATION BRANCH (the router audit,
// 2026-10-02, on the owner's word).
//
// The route's answer and the model's answer were not the same thing, and the
// reply could not say which it was: several unusable answers become `addon`
// on a live site, fields are dropped or rewritten, and two rules decide with
// no model asked. Test 11's run 88 proved its saved row and could not prove
// the model's own choice (the audit's R3). The route's reply now carries a
// `decision`: its source, every code that applied from `ROUTE_REASONS`, and
// the model's own intent and layer read only from their fixed lists.
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. Every code is reached here by the
// branch that names it, through the real readers and the real `routeMessage`,
// and the reply of the real `POST /api/site/route` carries the decision. The
// readers' results are unchanged with or without a trace. It cannot show what
// a real model answers: that is the routing batch's job, and nothing here is
// evidence about it.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTE_REASONS, ROUTE_SOURCES, routeDecision, readRouting, readEdit, readAlso, routeMessage, digestLists,
  siteDigest, EDIT_LAYERS, MAX_MESSAGE, MAX_CLARIFY,
} from "../builder/site-ask.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };
const toolReply = (input) => ({ content: [{ type: "tool_use", name: "route_message", input }], usage: { input_tokens: 900, output_tokens: 60 } });
const CODES = Object.keys(ROUTE_REASONS);

/** One routing call through the real `routeMessage`, the model answering `input` (or `reply` whole). */
async function routed(input, opts = {}, reply) {
  const sent = [];
  const deps = { send: async (req) => { sent.push(req); return reply !== undefined ? reply : toolReply(input); } };
  const r = await routeMessage(deps, { message: "make it so", site: SITE, hasSite: true, ...opts });
  return { r, sent };
}

/** The question a first build may ask, readable. */
const QUESTION = { text: "What do visitors do?", options: ["Book", "Order"] };

// ── EVERY CODE, BY THE BRANCH THAT NAMES IT ────────────────────────────────
//
// Each case gives the call, the code it must produce, and the source that code
// makes the decision. A code missing from this table fails the coverage test
// below: a declared reason nothing can reach is a dead promise.
const CASES = [
  ["no-message", () => routed(null, { message: "   " }), "rule"],
  ["request-failed", () => routed({ intent: "edit", layer: "data" }, { site: { ...SITE, name: { toString: 1 } } }), "fallback"],
  ["send-failed", async () => {
    const r = await routeMessage({ send: async () => { throw new Error("upstream"); } }, { message: "x", site: SITE, hasSite: true });
    return { r, sent: [] };
  }, "fallback"],
  ["no-tool-call", () => routed(null, {}, { content: [{ type: "text", text: "hello" }] }), "fallback"],
  ["intent-unknown", () => routed({ intent: "redesign" }), "fallback"],
  ["clarify-closed", () => routed({ intent: "clarify", question: QUESTION }), "fallback"],
  ["clarify-unreadable", () => routed({ intent: "clarify", question: { text: "", options: [] } }, { firstBuild: true, hasSite: false, site: {} }), "fallback"],
  ["work-without-site", () => routed({ intent: "edit", layer: "look" }, { hasSite: false }), "fallback"],
  ["ask-empty", () => routed({ intent: "ask", answer: "  " }), "fallback"],
  ["ask-while-answering", () => routed({ intent: "ask", answer: "Sure" }, { answering: true }), "fallback"],
  ["ask-with-attachment", () => routed({ intent: "ask", answer: "Nice logo" }, { attached: true }), "fallback"],
  ["layer-missing", () => routed({ intent: "edit" }), "fallback"],
  ["layer-unknown", () => routed({ intent: "edit", layer: "menu" }), "fallback"],
  ["page-missing", () => routed({ intent: "edit", layer: "page" }), "fallback"],
  // A PLAIN EDIT of a page the site was not said to have (2026-10-02, the
  // audit's W5): a removal or a move of one stays the edit it is, below.
  ["page-unknown", () => routed({ intent: "edit", layer: "page", page: "/blog" }), "fallback"],
  // A CONVERSION THAT RUNS THE WHOLE MESSAGE DROPS THE HELD-BACK PART (W5): an
  // answer naming no step split nothing anyone can trust.
  ["also-dropped", () => routed({ intent: "edit", alsoAsked: "and a map" }), "fallback"],
  ["page-normalized", () => routed({ intent: "edit", layer: "page", page: "Book/" }), "model"],
  // The same code from the look layer's own branch, which keeps a page the
  // site does not list (the sweep found this branch unreached, 2026-10-02).
  ["page-normalized", () => routed({ intent: "edit", layer: "look", page: "Book/" }), "model"],
  ["page-unreadable", () => routed({ intent: "edit", layer: "look", page: "?x=1" }), "model"],
  ["page-unchecked", () => routed({ intent: "edit", layer: "page", page: "/book" }, { site: { ...SITE, pages: [] } }), "model"],
  ["page-ignored", () => routed({ intent: "edit", layer: "nav", page: "/book" }), "model"],
  ["remove-not-true", () => routed({ intent: "edit", layer: "nav", remove: "true" }), "model"],
  ["remove-ignored", () => routed({ intent: "edit", layer: "data", remove: true }), "model"],
  ["tab-not-true", () => routed({ intent: "edit", layer: "logo", tab: "yes" }), "model"],
  ["tab-ignored", () => routed({ intent: "edit", layer: "nav", tab: true }), "model"],
  ["rename-with-remove", () => routed({ intent: "edit", layer: "page", page: "/book", remove: true, rename: "/booking" }), "model"],
  ["rename-not-path", () => routed({ intent: "edit", layer: "page", page: "/book", rename: "Booking" }), "model"],
  ["rename-same-page", () => routed({ intent: "edit", layer: "page", page: "/book", rename: "/book/" }), "model"],
  ["rename-normalized", () => routed({ intent: "edit", layer: "page", page: "/book", rename: "/Booking/" }), "model"],
  ["rename-ignored", () => routed({ intent: "edit", layer: "look", rename: "/x" }), "model"],
  ["edit-fields-ignored", () => routed({ intent: "addon", layer: "nav" }), "model"],
  ["also-not-text", () => routed({ intent: "addon", alsoAsked: ["a", "b"] }), "model"],
  ["also-too-long", () => routed({ intent: "addon", alsoAsked: "x".repeat(MAX_MESSAGE + 1) }), "model"],
  ["also-ignored", () => routed({ intent: "build", alsoAsked: "and a map" }), "model"],
  ["answer-ignored", () => routed({ intent: "addon", answer: "On it." }), "model"],
  ["question-ignored", () => routed({ intent: "addon", question: QUESTION }), "model"],
  ["question-clipped", () => routed({ intent: "clarify", question: { text: "word ".repeat(80), options: ["Book", "Order"] } }, { firstBuild: true, hasSite: false, site: {} }), "model"],
  ["options-changed", () => routed({ intent: "clarify", question: { text: "Which?", options: ["Book", "book", "Order"] } }, { firstBuild: true, hasSite: false, site: {} }), "model"],
  // As many options as were given, one of them cut to a button's length: a
  // change no count can see (the sweep found it unreached, 2026-10-02).
  ["options-changed", () => routed({ intent: "clarify", question: { text: "Which?", options: ["Book", "word ".repeat(20).trim()] } }, { firstBuild: true, hasSite: false, site: {} }), "model"],
  ["message-cut", () => routed({ intent: "edit", layer: "look" }, { message: "a".repeat(MAX_MESSAGE + 5) }), "model"],
  ["brief-cut", () => routed({ intent: "build" }, { firstBuild: true, hasSite: false, site: {}, brief: "b".repeat(MAX_MESSAGE + 5) }), "model"],
  ["pages-cut", () => routed({ intent: "edit", layer: "look" }, { site: { ...SITE, pages: Array.from({ length: 30 }, (_, i) => "/p" + i) } }), "model"],
  ["tables-cut", () => routed({ intent: "edit", layer: "look" }, { site: { ...SITE, tables: ["services", 7] } }), "model"],
  ["tables-filled", () => routed({ intent: "edit", layer: "data" }, { tablesFilled: true }), "model"],
];

test("every reason code is reached by the branch that names it, and gives the source it should", async () => {
  for (const [code, run, source] of CASES) {
    const { r } = await run();
    assert.ok(r.decision && Array.isArray(r.decision.reasons), code + ": no decision on the result");
    assert.ok(r.decision.reasons.includes(code), `${code}: not reported; got ${JSON.stringify(r.decision.reasons)}`);
    assert.equal(r.decision.source, source, `${code}: the source is ${r.decision.source}, not ${source}`);
  }
});

// DECIDED IN THE WORKER, NOT IN THE ROUTER MODULE: the zero-balance rule. Its
// case is the real route's, below ("…and the zero-balance rule").
const ROUTE_ONLY = ["no-credits"];

test("every declared code has a case, and no case names a code that is not declared", () => {
  const covered = new Set([...CASES.map(([code]) => code), ...ROUTE_ONLY]);
  assert.ok(CODES.length > 0, "the list is empty, so this would pass on nothing");
  for (const code of CODES) assert.ok(covered.has(code), `${code} is declared and nothing reaches it`);
  for (const code of covered) assert.ok(CODES.includes(code), `${code} has a case and is not declared`);
  for (const [code, v] of Object.entries(ROUTE_REASONS)) {
    assert.ok(["rule", "fallback", "changed", "context"].includes(v.kind), `${code} has the kind ${v.kind}`);
    assert.ok(typeof v.what === "string" && v.what.length > 10, `${code} says nothing about what it means`);
  }
  assert.ok(Object.isFrozen(ROUTE_REASONS) && Object.values(ROUTE_REASONS).every(Object.isFrozen), "the list can be widened at run time");
});

test("a model answer used exactly as given reports the model and no reasons", async () => {
  const clean = [
    [{ intent: "edit", layer: "data" }, {}],
    [{ intent: "edit", layer: "page", page: "/book" }, {}],
    [{ intent: "edit", layer: "logo", tab: true }, {}],
    [{ intent: "edit", layer: "page", page: "/book", remove: true }, {}],
    [{ intent: "edit", layer: "look", page: "/book" }, {}],
    [{ intent: "addon", alsoAsked: "and a gallery" }, {}],
    [{ intent: "ask", answer: "Two pages." }, {}],
    [{ intent: "build" }, {}],
    [{ intent: "clarify", question: QUESTION }, { firstBuild: true, hasSite: false, site: {} }],
  ];
  for (const [input, opts] of clean) {
    const { r } = await routed(input, opts);
    assert.deepEqual(r.decision.reasons, [], JSON.stringify(input) + " reported a change it did not have");
    assert.equal(r.decision.source, "model", JSON.stringify(input));
    assert.equal(r.decision.raw.intent, input.intent);
  }
});

test("a fallback names itself and keeps the model's own answer, read only from the fixed lists", async () => {
  const { r } = await routed({ intent: "edit", layer: "page", page: "/blog" });
  assert.equal(r.intent, "addon", "the conversion itself must not move: this is reporting only");
  assert.deepEqual(r.decision, { source: "fallback", reasons: ["page-unknown"], raw: { intent: "edit", layer: "page" } });
  // AND SAYS WHY, TO THE STEP IT REACHES (2026-10-02, the audit's W5/W24).
  assert.deepEqual(r.handOver, { from: "route", reason: "page-unknown", page: "/blog" });
  // A REMOVAL OR A MOVE OF A PAGE THE SITE DOES NOT HAVE IS NOT AN ADDITION
  // (W5): it stays the model's edit, and the page step answers it with the
  // site's real pages at no cost — the add-on step was handed a removal it
  // could not make while the addition beside it waited.
  for (const extra of [{ remove: true }, { rename: "/journal" }]) {
    const kept = await routed({ intent: "edit", layer: "page", page: "/blog", alsoAsked: "make it so", ...extra });
    assert.equal(kept.r.intent, "edit", JSON.stringify(extra));
    assert.equal(kept.r.layer, "page", JSON.stringify(extra));
    assert.equal(kept.r.page, "/blog", JSON.stringify(extra));
    assert.equal(kept.r.alsoAsked, "make it so", "the part held back was lost from an edit that stood: " + JSON.stringify(extra));
    assert.equal(kept.r.handOver, undefined, JSON.stringify(extra));
    assert.deepEqual(kept.r.decision.reasons, [], JSON.stringify(extra));
  }
  // FREE TEXT NEVER RIDES: a layer or intent outside the lists is "other", absent is "none".
  const odd = await routed({ intent: "edit; DROP TABLE", layer: "nav and colours" });
  assert.deepEqual(odd.r.decision.raw, { intent: "other", layer: "other" });
  assert.ok(!JSON.stringify(odd.r.decision).includes("DROP"), "the model's own text reached the decision");
  const none = await routed(null, {}, { content: [] });
  assert.deepEqual(none.r.decision.raw, { intent: "none", layer: "none" });
  const nonString = await routed({ intent: ["edit"], layer: { name: "data" } });
  assert.deepEqual(nonString.r.decision.raw, { intent: "other", layer: "other" }, "a non-string was read as a name");
});

test("a rule and a failed call carry no model answer at all", async () => {
  const { r: empty } = await routed(null, { message: "" });
  assert.deepEqual(empty.decision, { source: "rule", reasons: ["no-message"] });
  const { r: failed } = await CASES.find(([c]) => c === "send-failed")[1]();
  assert.equal(failed.failed, true);
  assert.deepEqual(failed.decision, { source: "fallback", reasons: ["send-failed"] });
  assert.ok(!Object.hasOwn(failed.decision, "raw"), "a call that failed reported a model answer");
});

test("a brief whose toString throws still ends as request-failed, as before the codes existed", async () => {
  // The context codes read the same caller values the request does, so they sit
  // inside its catch: from the public body, `brief: {toString: 1}` must not crash.
  const r = await routeMessage({ send: async () => toolReply({ intent: "build" }) },
    { message: "a cafe", firstBuild: true, brief: { toString: 1 }, qa: [], hasSite: false });
  assert.equal(r.failed, true);
  assert.equal(r.intent, "build");
  assert.deepEqual(r.decision, { source: "fallback", reasons: ["request-failed"] });
});

test("the decision only grows: reasons keep their order, a repeat is kept once, an unknown code is dropped", () => {
  const d = routeDecision(["message-cut", "page-normalized", "page-normalized", "invented", 7, null, "page-unknown"], { intent: "edit", layer: "page" });
  assert.deepEqual(d.reasons, ["message-cut", "page-normalized", "page-unknown"]);
  assert.equal(d.source, "fallback");
  assert.equal(routeDecision(["no-credits", "page-unknown"]).source, "rule", "a rule outranks a fallback");
  assert.equal(routeDecision(["tables-filled", "message-cut"]).source, "model", "context codes leave the source alone");
  assert.equal(routeDecision([]).source, "model");
  assert.equal(routeDecision("page-unknown").source, "model", "a non-list was read as codes");
  assert.deepEqual(ROUTE_SOURCES, ["model", "fallback", "rule"]);
  for (const c of CODES) assert.ok(ROUTE_SOURCES.includes(routeDecision([c]).source));
});

// ── THE READERS' RESULTS DID NOT MOVE ──────────────────────────────────────
//
// Reporting only: every reader returns exactly what it returned before, with or
// without a trace. Every case above is replayed through `readRouting` both ways.
test("readRouting, readEdit and readAlso return the same with and without a trace", async () => {
  const opts = [{}, { hasSite: true, pages: SITE.pages }, { hasSite: true, pages: [] }, { canClarify: true }, { hasSite: true, answering: true, attached: true, pages: SITE.pages }];
  const inputs = [
    { intent: "edit", layer: "page", page: "/blog", remove: true }, { intent: "edit", layer: "page", page: "Book/", rename: "/Booking/" },
    { intent: "edit", layer: "look", page: "?x", rename: "/x", tab: true, remove: true }, { intent: "edit", layer: "nav", page: "/b", remove: "true", tab: true },
    { intent: "addon", layer: "nav", answer: "ok", question: QUESTION, alsoAsked: ["x"] }, { intent: "build", alsoAsked: "a map" },
    { intent: "ask", answer: "hi" }, { intent: "ask", answer: " " }, { intent: "clarify", question: QUESTION }, { intent: "clarify", question: { text: "", options: [] } },
    { intent: "redesign" }, { intent: "edit" }, { intent: "edit", layer: "menu" }, { intent: "edit", layer: "logo", tab: "yes" },
    { intent: "addon", alsoAsked: "x".repeat(MAX_MESSAGE + 1) },
  ];
  for (const o of opts) {
    for (const input of inputs) {
      const reply = toolReply(input);
      const trace = { reasons: [], input: undefined };
      assert.deepEqual(readRouting(reply, { ...o, trace }), readRouting(reply, o), JSON.stringify({ input, o }));
      assert.deepEqual(readEdit(input, o.pages, { reasons: [] }), readEdit(input, o.pages));
      assert.deepEqual(readAlso(input, { reasons: [] }), readAlso(input));
    }
  }
  assert.deepEqual(readRouting({ content: [] }, { hasSite: true, trace: { reasons: [] } }), readRouting({ content: [] }, { hasSite: true }));
  assert.deepEqual(readEdit(null, [], { reasons: [] }), readEdit(null, []));
});

test("the digest the router is shown is unchanged, and digestLists says when it was cut", () => {
  const many = { ...SITE, pages: [...Array.from({ length: 30 }, (_, i) => "/p" + i), 9, ""], tables: ["a", "", 3] };
  assert.equal(siteDigest(SITE), "The site is called Sharp Fade. It is published at /s/sharp-fade/. Its pages are: /, /book. Its database tables are: services, bookings.");
  const l = digestLists(many);
  assert.equal(l.pages.length, 24);
  assert.deepEqual(l.tables, ["a"]);
  assert.equal(l.pagesCut, true);
  assert.equal(l.tablesCut, true);
  assert.deepEqual(digestLists(SITE), { pages: SITE.pages, tables: SITE.tables, pagesCut: false, tablesCut: false });
  assert.deepEqual(digestLists(null), { pages: [], tables: [], pagesCut: false, tablesCut: false });
  assert.ok(siteDigest(many).includes("/p23") && !siteDigest(many).includes("/p24"), "the digest stopped showing 24 pages");
});

test("the context codes describe what the model was really shown", async () => {
  const long = "a".repeat(MAX_MESSAGE + 5);
  const { r, sent } = await routed({ intent: "edit", layer: "look" }, { message: long });
  const content = String(sent[0].messages[0].content);
  assert.ok(content.includes("a".repeat(MAX_MESSAGE)) && !content.includes("a".repeat(MAX_MESSAGE + 1)), "the message was not cut where the code says");
  assert.ok(r.decision.reasons.includes("message-cut"));
  const exact = await routed({ intent: "edit", layer: "look" }, { message: "a".repeat(MAX_MESSAGE) });
  assert.ok(!exact.r.decision.reasons.includes("message-cut"), "a message of exactly the limit was called cut");
  const closed = await routed({ intent: "build" }, { firstBuild: true, hasSite: false, site: {}, brief: "b".repeat(MAX_MESSAGE + 5), qa: Array.from({ length: MAX_CLARIFY }, () => ({ q: "q", a: "a" })) });
  assert.ok(!closed.r.decision.reasons.includes("brief-cut"), "a brief the model is never shown was called cut");
});

test("every layer the router names can be reported as the model's own", async () => {
  for (const layer of EDIT_LAYERS) {
    const input = layer === "page" ? { intent: "edit", layer, page: "/book" } : { intent: "edit", layer };
    const { r } = await routed(input);
    assert.equal(r.decision.raw.layer, layer);
    assert.equal(r.decision.source, "model", layer);
  }
});

// ── THE REAL ROUTE ─────────────────────────────────────────────────────────

/** One `POST /api/site/route` through the real Worker; the model answers `input`, the balance reads `balance`. */
async function route({ input, balance = 50, body = {} } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  let model = 0;
  const quiet = console.error;
  console.error = () => {};
  globalThis.fetch = async (req) => {
    const u = String((req && req.url) || req || "");
    if (u.includes("/auth/v1/user")) return json({ id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" });
    if (u.includes("/rpc/get_credits")) return json(balance);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.startsWith("https://api.anthropic.com/")) {
      model++;
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "route_message", input }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message: "Add our Instagram to the footer.", site: { name: "Harbour Loaf", url: "https://x.gofarther.app", pages: ["/", "/visit"], tables: ["loaves"] }, picker: "sonnet", firstBuild: false, brief: "", qa: [], answering: false, attached: false, slug: "x", hasSite: true, ...body }),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json(), model };
  } finally {
    globalThis.fetch = real;
    console.error = quiet;
  }
}

test("the route's reply carries the decision: the model's own, a fallback, and the zero-balance rule", async () => {
  const own = await route({ input: { intent: "addon" } });
  assert.equal(own.status, 200);
  assert.equal(own.body.intent, "addon");
  assert.deepEqual(own.body.decision, { source: "model", reasons: [], raw: { intent: "addon", layer: "none" } });

  const converted = await route({ input: { intent: "edit", layer: "page", page: "/blog" } });
  assert.equal(converted.body.intent, "addon", "the route's answer moved: this change is reporting only");
  assert.deepEqual(converted.body.decision, { source: "fallback", reasons: ["page-unknown"], raw: { intent: "edit", layer: "page" } });
  // THE HAND-OVER RIDES THE ROUTE'S REPLY (2026-10-02, the audit's W24), so the
  // browser posts it to the add-on step: why it came, and the page.
  assert.deepEqual(converted.body.handOver, { from: "route", reason: "page-unknown", page: "/blog" });
  assert.equal(own.body.handOver, undefined, "a model's own add-on answer carried a hand-over");

  const broke = await route({ balance: 0, input: { intent: "addon" } });
  assert.equal(broke.body.intent, "build");
  assert.equal(broke.model, 0, "a model was asked at a zero balance");
  assert.deepEqual(broke.body.decision, { source: "rule", reasons: ["no-credits"] });

  const empty = await route({ input: { intent: "addon" }, body: { message: "  " } });
  assert.equal(empty.model, 0);
  assert.deepEqual(empty.body.decision, { source: "rule", reasons: ["no-message"] });
});

test("the route's decision holds codes and fixed names only, never the customer's words or the model's text", async () => {
  const r = await route({ input: { intent: "ask", answer: "Footer? Sure: Instagram", alsoAsked: "secret words" }, body: { message: "Add our Instagram to the footer: @harbourloaf." } });
  const d = JSON.stringify(r.body.decision);
  for (const words of ["Instagram", "harbourloaf", "secret", "Footer"]) assert.ok(!d.includes(words), `the decision carries "${words}"`);
  assert.deepEqual(r.body.decision.reasons, ["also-ignored"]);
  assert.equal(r.body.decision.source, "model");
});

test("the route names the table names it filled in, through the decision", async () => {
  // Lane 1d fills the names only for a verified owner; this stub's ownership read
  // answers no owner, so nothing is filled and the code must not appear.
  const r = await route({ input: { intent: "edit", layer: "data" }, body: { site: { name: "x", pages: ["/"], tables: [] } } });
  assert.equal(r.body.tablesFilled, undefined);
  assert.ok(!r.body.decision.reasons.includes("tables-filled"), "a fill that did not happen was reported");
});
