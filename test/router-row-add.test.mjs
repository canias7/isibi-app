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
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL } from "../builder/route-shared.mjs";
import { askRequest } from "../parked/old-way/builder/site-ask.mjs";
import { readExpectRoute, routeVerdict } from "../scripts/canary-route.mjs";

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

test("the addon clause claims a new entry in a list the site already keeps, for every kind of list", () => {
  const open = oneLine(INTENT, /^"addon" — ADDING SOMETHING THE SITE DOES NOT HAVE YET\./, "the addon clause");
  const entry = addonEntry();
  const edit = oneLine(INTENT, /^"edit" is for what the site ALREADY HAS, changed/, "the edit sentence after the addon clause");
  assert.ok(open.at < entry.at && entry.at < edit.at, "the new-entry line is not inside the addon clause: " + [open.at, entry.at, edit.at]);
  const s = entry.line;
  // GENERAL: kinds of list, never one site's.
  for (const kind of ["product", "service", "team member"]) assert.ok(s.includes(kind), "the line does not name a " + kind);
  assert.match(s, /is a new row in a table the site already has\./);
  assert.match(s, /The list existing does not make it an edit/);
  // Its examples are both answered "addon", and one has no "add" in it: the
  // word does not decide, the entry not existing yet does.
  const quoted = [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(quoted[quoted.length - 1], "addon", "the examples are not answered addon: " + quoted);
  const examples = quoted.slice(0, -1);
  assert.ok(examples.length >= 2, "fewer than two examples: " + examples);
  assert.ok(examples.some((e) => !/\badd/i.test(e)), "every example says \"add\", so the word could be read as the rule");
  assert.match(s, /because that entry does not exist yet\.$/);
});

test("the tie-break asks of the thing itself, never of the list it goes into", () => {
  const t = tieBreak();
  // The question is kept; what it is asked OF is new.
  assert.match(t.line, /does the thing they name exist on the site now\? It does — "edit"\. It does not — "addon"\./);
  assert.match(t.line, /ASK IT OF THE THING ITSELF, NEVER OF WHAT IT GOES INTO/);
  assert.match(t.line, /a new entry in a list the site already keeps does not exist yet, so it is "addon" however long the list has been there/);
  // An entry that exists stays an edit, changed or taken off.
  assert.match(t.line, /Changing an entry that is already there, or taking one off, is "edit"\./);
  assert.match(t.line, /The pages and tables it has are listed above\.$/);
  // The field still ends as it did: unsure is addon, and a removal never is.
  const n = INTENT.length;
  assert.match(INTENT[n - 2], /^WHEN YOU CANNOT TELL, ANSWER "addon"/);
  assert.match(INTENT[n - 1], /^A REMOVAL IS NEVER AN ADDON\./);
  assert.ok(t.at < n - 2, "the tie-break moved below the closing lines");
});

test("the data clause keeps the rows the site already stores and sends a new entry to addon, however cheap it is", () => {
  const open = DATA[0];
  // CHANGING AN ENTRY STAYS HERE: the clause still opens on the content the
  // site stores, one of many.
  assert.match(open, /^"data" — the content the site STORES and shows in a list: a price, a menu item, a service, an opening time, a team member\./);
  assert.match(open, /ASK YOURSELF WHETHER IT IS ONE OF MANY/);
  // ITS COST PREFERENCE NAMES ONLY A ROW THAT EXISTS. Found positively before
  // the old wording is ruled out, so the observer is alive.
  assert.match(open, /prefer it whenever the thing being changed is a row the site already stores\./);
  assert.doesNotMatch(open, /one row of something the site lists/, "the old preference, which also claimed a new row, is back");
  // A NEW ENTRY GOES TO THE ADD-ON STEP, whatever this layer costs.
  assert.match(open, /A NEW ENTRY IS NOT THIS LAYER: adding one to any of those lists is intent "addon", not an edit, however cheap this layer is and however long the list has been there\./);
  assert.match(open, /The tables it has are named above\.$/);
  // TAKING AN ENTRY OFF STAYS HERE: still the clause's second line.
  assert.match(DATA[1], /^TAKING AN EXISTING ROW OFF ONE OF THOSE LISTS IS THIS LAYER TOO/);
  // SORTING SCOPE IS UNTOUCHED: the whole site only, never a page left out.
  const sort = oneLine(DATA, /^SORTING ONE OF THOSE LISTS ACROSS THE WHOLE SITE IS THIS LAYER TOO/, "the sort sentence");
  assert.match(sort.line, /THIS LAYER CANNOT LEAVE A PAGE OUT/);
  assert.match(sort.line, /ONE page they name is "page"/);
});

test("the rule is general: it names kinds of list, never a site, a table or the prepared request", () => {
  const said = [addonEntry().line, tieBreak().line, DATA[0], costRule()];
  for (const s of said) {
    assert.doesNotMatch(s, /bakery|bakes?\b|loaf|loaves|bread|rye|caraway|focaccia|fold-lane|fretwork|lesson|lido|washhouse|harbour|forno|\borders\b/i,
      "a sentence names a fixture: " + s);
  }
  // The tables are named by the digest the router is sent, never here: the
  // reference is found first, so the observer is alive.
  assert.match(tieBreak().line, /The pages and tables it has are listed above\./);
  assert.match(DATA[0], /The tables it has are named above\./);
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
