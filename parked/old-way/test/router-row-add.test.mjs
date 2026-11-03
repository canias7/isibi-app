// PARKED (2026-11-03, park-old-way): the old-way half of test/router-row-add.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A NEW ENTRY IN A LIST THE SITE ALREADY KEEPS IS THE `addon` ANSWER (2026-10-01).
//
// Run 86 (Test 11): a new entry for a list the site's database already holds
// came back `intent=edit layer=data` from the real router (grok-4.6), and the
// press's route check refused it before the edit was posted. The router's tool
// said nowhere where a new row goes, and three sentences pointed at `data`: the
// edit/addon tie-break asked whether "the thing they name" exists (the list
// did), the data clause said to prefer it for "one row of something the site
// lists", and the system's cost rule said to pick the cheapest answer.
//
// The owner: *"Adding a NEW record to an existing table/list must select
// addon. The parent list already existing does not make the new item an edit.
// … Make this general across products, services, team members, etc. No
// bakery-specific rule or keyword override. Updating or deleting an existing
// row remains edit/data; preserve sorting scope and mixed-request handling. …
// Verify the actual request sent to the model; supplied model answers prove
// downstream handling, not real classification. Keep the canary's
// expected-addon guard."*
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT.
//  - The wording cases read what the router is TOLD: its tool and its system
//    prompt as defined.
//  - The request cases read the request the real `POST /api/site/route`
//    SENDS: to xAI, the default router and the one that answered run 86, and
//    to Anthropic.
//  - The route cases SUPPLY the router's answer and read what the route does
//    with it. That is downstream handling, never classification.
// None of it shows which answer a real model chooses; only a live press after
// a merge and a deploy can.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL, LIVE_SYSTEM, askRequest } from "../builder/site-ask.mjs";
import { readExpectRoute, routeVerdict } from "../../../scripts/canary-route.mjs";

const P = ASK_TOOL.input_schema.properties;
const INTENT = P.intent.description.split("\n");
const LAYER = P.layer.description.split("\n");
const ALSO = P.alsoAsked.description;
const SYSTEM = askRequest({ message: "x", site: { name: "s" }, hasSite: true }).system[0].text;

/** The one line of `lines` matching `re`, and where it is. */
function oneLine(lines, re, what) {
  const hits = lines.map((l, i) => [l, i]).filter(([l]) => re.test(l));
  assert.equal(hits.length, 1, what + ": expected exactly one line, found " + hits.length);
  return { line: hits[0][0], at: hits[0][1] };
}
/** A layer's clause: its opening line and every line after it, up to the next layer's. */
function clause(layer, next) {
  const at = LAYER.findIndex((l) => l.startsWith("\"" + layer + "\" — "));
  const end = LAYER.findIndex((l) => l.startsWith("\"" + next + "\" — "));
  assert.ok(at >= 0 && end > at, "the " + layer + " clause's landmarks moved");
  return LAYER.slice(at, end);
}

// The four places the rule is said, each found positively before anything is
// asserted about it. Read inside each case, so a wording without one fails the
// cases that need it and no others.
const addonEntry = () => oneLine(INTENT, /^A NEW ENTRY IN A LIST THE SITE ALREADY KEEPS IS AN ADDITION TOO:/, "the addon clause's new-entry line");
const tieBreak = () => oneLine(INTENT, /^THE QUESTION THAT SEPARATES EDIT FROM ADDON:/, "the edit/addon tie-break");
const DATA = clause("data", "text");
function costRule() {
  const m = /COST NEVER MAKES A NEW ENTRY AN EDIT:[^\n]*/.exec(SYSTEM);
  assert.ok(m, "the system's cost rule does not speak about a new entry");
  return m[0];
}

test("the system's cost rule cannot make a new entry an edit", () => {
  const pick = SYSTEM.indexOf("Pick the cheapest one that can honestly do the job");
  assert.ok(pick > 0, "the cost rule moved");
  const rule = SYSTEM.indexOf("COST NEVER MAKES A NEW ENTRY AN EDIT:");
  const end = SYSTEM.indexOf("\n\n", pick);
  assert.ok(pick < rule && rule < end, "the new-entry sentence is not in the cost rule's own paragraph");
  const s = costRule();
  assert.match(s, /is an "addon" even though the list already exists/);
  assert.match(s, /for a list an edit only changes or takes away the entries that are already there\./);
  // One system text for every message about a site that exists.
  assert.equal(askRequest({ message: "y", site: { name: "z" }, hasSite: true }).system[0].text, SYSTEM);
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ROUTING ROUTE. The router's answer is SUPPLIED; what is read
// is the request it was sent and what the route hands on.

const OWNER = { id: "66666666-6666-6666-6666-666666666666", email: "owner@example.com" };
// A site with two lists, neither of them a fixture's.
const SITE = { name: "row-add", url: "https://row-add.gofarther.app", pages: ["/", "/services", "/team"], tables: ["services", "team"] };
// A new entry with no "add" in it, and one with.
const NEW_SERVICE = "We've started offering gutter cleaning at £60, please put it on our services list.";
const NEW_MEMBER = "Add a new team member: Priya, our junior stylist.";
const UPDATE = "Change the price of window cleaning to £30.";
const DELETE = "We no longer do window cleaning, please take it off the services list.";
const SORT = "Show our services cheapest first.";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

/** One routing call through the real route. `picker` unset is what the canary sends. */
async function route(message, answer, { picker } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(OWNER);
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.startsWith("https://api.x.ai/")) {
      sent.push({ provider: "xai", url: u, body: JSON.parse(String((init && init.body) || "{}")) });
      return json({ choices: [{ message: { content: "", tool_calls: [{ id: "c1", type: "function", function: { name: ASK_TOOL.name, arguments: JSON.stringify(answer) } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (u.startsWith("https://api.anthropic.com/")) {
      sent.push({ provider: "anthropic", url: u, body: JSON.parse(String((init && init.body) || "{}")) });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    // The browser that built the site sends its tables, so nothing is looked up.
    const body = { message, site: SITE, firstBuild: false, brief: message, qa: [], answering: false, attached: false, slug: "row-add", hasSite: true };
    if (picker) body.picker = picker;
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify(body),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: JSON.parse(await res.text()), sent };
  } finally {
    globalThis.fetch = real;
  }
}
// Test 11's route box, unchanged: the canary's expected-addon guard.
const ADDON_PRESS = readExpectRoute("intent=addon alsoAsked=none");
const DATA_PRESS = readExpectRoute("intent=edit layer=data alsoAsked=none");
// What a live site is sent (router-b1); the first build's tool above keeps its own words.
const LIVE_INTENT_SENT = LIVE_ASK_TOOL.input_schema.properties.intent.description;

test("the request the real route sends to xAI, the default router, carries every sentence of the rule", async () => {
  const r = await route(NEW_SERVICE, { intent: "addon" });
  assert.equal(r.status, 200);
  assert.equal(r.sent.length, 1, "the router was not asked exactly once");
  const { provider, body } = r.sent[0];
  assert.equal(provider, "xai", "with no picker the router is not xAI, the one that answered run 86");
  assert.match(String(body.model), /^grok/);
  // THE REQUEST AS IT LEFT, not the module's constant.
  const tool = (body.tools || []).find((t) => t && t.function && t.function.name === ASK_TOOL.name);
  assert.ok(tool, "the routing tool is not in the request");
  const props = tool.function.parameters.properties;
  // A SITE THAT EXISTS IS SENT THE LIVE TOOL'S ONE RULE (2026-10-25, router-b1):
  // the new entry is an addon in `intent`'s addon clause and its single test.
  assert.equal(props.intent.description, LIVE_INTENT_SENT, "the intent rule as sent is not the live tool's");
  assert.match(props.intent.description, /a new entry in a list it keeps \(a product, service, dish, class, event, team member: the list existing does not make the entry exist\)/);
  assert.match(props.intent.description, /ASKED OF THE THING ITSELF AND NEVER OF WHAT IT GOES INTO/);
  assert.match(props.layer.description, /"data" — [^\n]*A NEW entry is intent "addon"\./);
  const system = (body.messages || []).find((m) => m && m.role === "system");
  assert.ok(system && String(system.content) === LIVE_SYSTEM, "the system as sent is not the live one");
  assert.doesNotMatch(String(system.content), /cheapest one that can honestly do the job/, "the cost tie-break still reaches a live site");
  // Forced to the tool, so the answer is a field the route reads.
  assert.deepEqual(body.tool_choice, { type: "function", function: { name: ASK_TOOL.name } });
  // What "listed above" points at, and the customer's own sentence, are in the
  // same request.
  const user = (body.messages || []).find((m) => m && m.role === "user");
  assert.match(String(user && user.content), /Its database tables are: services, team\./);
  assert.ok(String(user.content).includes(NEW_SERVICE), "the customer's message is not in the request");
});

test("the request the real route sends to Anthropic carries the same sentences", async () => {
  const r = await route(NEW_MEMBER, { intent: "addon" }, { picker: "sonnet" });
  assert.equal(r.status, 200);
  assert.equal(r.sent.length, 1);
  const { provider, body } = r.sent[0];
  assert.equal(provider, "anthropic");
  const tool = (body.tools || []).find((t) => t && t.name === ASK_TOOL.name);
  assert.ok(tool, "the routing tool is not in the request");
  const props = tool.input_schema.properties;
  assert.equal(props.intent.description, LIVE_INTENT_SENT);
  assert.match(props.layer.description, /"data" — [^\n]*A NEW entry is intent "addon"\./);
  assert.equal(String(body.system && body.system[0] && body.system[0].text), LIVE_SYSTEM);
  assert.match(String(body.messages[0].content), /Its database tables are: services, team\./);
});
