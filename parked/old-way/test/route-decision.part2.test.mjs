// PARKED (2026-11-03, park-old-way): this whole file — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { ROUTE_REASONS } from "../../../builder/route-shared.mjs";
import { MAX_INPUT_CHARS } from "../../../builder/input-budget.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };
const toolReply = (input) => ({ content: [{ type: "tool_use", name: "route_message", input }], usage: { input_tokens: 900, output_tokens: 60 } });
const CODES = Object.keys(ROUTE_REASONS);

/** The question a first build may ask, readable. */
const QUESTION = { text: "What do visitors do?", options: ["Book", "Order"] };

// DECIDED IN THE WORKER, NOT IN THE ROUTER MODULE: the zero-balance rule. Its
// case is the real route's, below ("…and the zero-balance rule"). (The route's
// two question checks that stopped a request — `clarify-repeat` and
// `clarify-no-room` — are gone since the owner's second review, 2026-10-02: a
// question already answered is the router's own `clarify-reused` and
// `clarify-again`, in the table above, and no request runs out of room.)
// 2026-10-24, addon-existing: `addon-existing` and `clarify-part` are also the
// route's (`builder/addon-existing.mjs`, applied in worker.js), and their cases
// are in test/addon-existing.test.mjs.
// "agent": the route's no-router answer (2026-11-02, agent-only; its cases are test/agent-only.test.mjs).
const ROUTE_ONLY = ["no-credits", "addon-existing", "clarify-part", "agent"];

// ── THE REAL ROUTE ─────────────────────────────────────────────────────────

/**
 * One `POST /api/site/route` through the real Worker; the model answers `input`,
 * the balance reads `balance`. THE SITE'S OWN PAGES (2026-10-03): `owner` is who
 * `site_backends` names (the caller by default) and `stored` the pages the
 * site's store holds, so the route reads the site's own list; `owner: null`
 * makes that read impossible and the browser's list is all there is.
 */
const CALLER = "33333333-3333-3333-3333-333333333333";
async function route({ input, balance = 50, body = {}, owner = CALLER, stored = ["index.tsx", "visit.tsx"] } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  let model = 0;
  const asked = [];
  const quiet = console.error;
  console.error = () => {};
  globalThis.fetch = async (req, init) => {
    const u = String((req && req.url) || req || "");
    if (u.includes("/auth/v1/user")) return json({ id: "33333333-3333-3333-3333-333333333333", email: "owner@example.com" });
    if (u.includes("/rpc/get_credits")) return json(balance);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner }] : []);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.startsWith("https://api.anthropic.com/")) {
      model++;
      asked.push(typeof (init && init.body) === "string" ? init.body : "");
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "route_message", input }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message: "Add our Instagram to the footer.", site: { name: "Harbour Loaf", url: "https://x.gofarther.app", pages: ["/", "/visit"], tables: ["loaves"] }, picker: "sonnet", firstBuild: false, brief: "", qa: [], answering: false, attached: false, slug: "x", hasSite: true, ...body }),
    }), {
      ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc",
      SITES_BUCKET: { get: async (k) => (k === "source/x/pages.json" ? { text: async () => JSON.stringify(stored.map((path) => ({ path, source: "x" }))) } : null), put: async () => ({ etag: "e" }), head: async () => null, delete: async () => {} },
    }, makeCtx());
    return { status: res.status, body: await res.json(), model, asked };
  } finally {
    globalThis.fetch = real;
    console.error = quiet;
  }
}

test("the route's reply carries the decision: the model's own, a fallback, and the zero-balance rule", async () => {
  const own = await route({ input: { intent: "addon" } });
  assert.equal(own.status, 200);
  assert.equal(own.body.intent, "addon");
  // THE ROUTE READ THE SITE'S OWN PAGES (2026-10-03): a context code, the
  // model's answer its own. AND ITS TABLES (2026-10-05): this stub's site has
  // no database, which the route reads as none and says (`tables-none`).
  assert.deepEqual(own.body.decision, { source: "model", reasons: ["tables-none", "pages-filled"], raw: { intent: "addon", layer: "none" } });

  // A PAGE THE SITE'S OWN LIST DOES NOT HAVE is an addition on that page.
  const converted = await route({ input: { intent: "edit", layer: "page", page: "/blog" } });
  assert.equal(converted.body.intent, "addon", "the route's answer moved: this change is reporting only");
  assert.deepEqual(converted.body.decision, { source: "fallback", reasons: ["tables-none", "pages-filled", "page-unknown"], raw: { intent: "edit", layer: "page" } });
  // THE HAND-OVER RIDES THE ROUTE'S REPLY (2026-10-02, the audit's W24), so the
  // browser posts it to the add-on step: why it came, and the page.
  assert.deepEqual(converted.body.handOver, { from: "route", reason: "page-unknown", page: "/blog" });
  assert.equal(own.body.handOver, undefined, "a model's own add-on answer carried a hand-over");

  // AND ONE MISSING FROM A LIST THE ROUTE COULD NOT CONFIRM — not this
  // owner's to read — stays the edit it is, for the edit step to check against
  // the site (2026-10-03): never read as a page the site lacks.
  // (Its own slug: the owner lookup is cached per slug for five minutes.)
  const unverified = await route({ input: { intent: "edit", layer: "page", page: "/blog" }, owner: null, body: { slug: "y" } });
  assert.equal(unverified.body.intent, "edit");
  assert.equal(unverified.body.page, "/blog");
  assert.deepEqual(unverified.body.decision, { source: "model", reasons: ["page-unverified"], raw: { intent: "edit", layer: "page" } });
  assert.equal(unverified.body.handOver, undefined);

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
  assert.deepEqual(r.body.decision.reasons, ["tables-none", "pages-filled", "also-ignored"]);
  assert.equal(r.body.decision.source, "model");
});

test("the route names the table names it filled in, through the decision", async () => {
  // Lane 1d fills the names only for a verified owner; this stub's ownership read
  // answers no owner, so nothing is filled and the code must not appear.
  const r = await route({ input: { intent: "edit", layer: "data" }, owner: null, body: { slug: "z", site: { name: "x", pages: ["/"], tables: [] } } });
  assert.equal(r.body.tablesFilled, undefined);
  assert.ok(!r.body.decision.reasons.includes("tables-filled"), "a fill that did not happen was reported");
});

test("BEHAVIOUR, NOT SPELLING (2026-10-15): `answering`, `picked` and `attached` sent to the real route reach the router — an ask answer is refused for a button press, and kept for a typed reply, an attachment and a plain question", async () => {
  // The source guards in site-ask.test.mjs read worker.js for `answering:
  // rb.answering === true`; this is the same contract through the real route,
  // so a wrapper that drops a flag fails here whatever the text says.
  //
  // RESTATED FOR THE COMBINED CANDIDATE (2026-10-15, main 8e24ca5b + new
  // 22779ea5). main wrote this case against the earlier rule — `answering` or
  // `attached` alone refused an ask answer. new narrowed that rule on purpose
  // (5f425ceb, "ask-while-answering", builder/site-ask.mjs): only an answer
  // PICKED from our options is not conversation; a typed reply may be a side
  // question and a file may be talked about, so both stay "ask". The case
  // keeps its purpose — each flag proven to reach the router through the real
  // route — under the rule the candidate carries.
  const ask = { intent: "ask", answer: "Sure, the footer can hold it." };
  const plain = await route({ input: ask, body: { slug: "ans-plain", answering: false, attached: false } });
  assert.equal(plain.body.intent, "ask", "a plain question's ask answer was not kept — the control is dead");
  // A BUTTON PRESS: `picked` reaches the decision reader, which refuses "ask".
  const picked = await route({ input: ask, body: { slug: "ans-yes", answering: true, picked: true } });
  assert.notEqual(picked.body.intent, "ask", "`picked` did not reach the router's reader");
  assert.equal(picked.body.decision.source, "fallback");
  // A TYPED REPLY on a site: its ask answer is kept.
  const typed = await route({ input: ask, body: { slug: "ans-typed", answering: true } });
  assert.equal(typed.body.intent, "ask", "a typed reply's ask answer was refused");
  // …AND `answering` REACHES THE ROUTER where our questions are asked — a first
  // build (`canClarify`): its own instruction for a typed reply is sent with it,
  // and not without it.
  const TYPED = /THEIR MESSAGE IS A TYPED REPLY WHILE YOUR LAST QUESTION IS ON SCREEN/;
  const first = { slug: "", hasSite: false, firstBuild: true, site: {}, brief: "A bakery", qa: [{ q: "What do visitors do?", a: "" }] };
  const typedFirst = await route({ input: { intent: "build" }, body: { ...first, answering: true } });
  const plainFirst = await route({ input: { intent: "build" }, body: { ...first, answering: false } });
  assert.ok(typedFirst.asked.length && TYPED.test(typedFirst.asked[0]), "`answering` did not reach the router's instructions");
  assert.ok(plainFirst.asked.length && !TYPED.test(plainFirst.asked[0]), "the typed-reply instruction is sent when nobody is answering — the observer is dead");
  // AN ATTACHMENT: talked about, not refused.
  const attached = await route({ input: ask, body: { slug: "ans-att", attached: true } });
  assert.equal(attached.body.intent, "ask", "an ask answer about an attachment was refused");
});
