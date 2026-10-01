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
import { ASK_TOOL, askRequest } from "../builder/site-ask.mjs";
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

test("the note calling a new row the owner's open decision is gone, and the rule's note replaces it", () => {
  const src = readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  // The note sat in the data clause's removal comment; find that first.
  const at = src.indexOf("// ── A ROW TAKEN OFF IS THIS LAYER TOO (2026-09-30)");
  const end = src.indexOf("\"TAKING AN EXISTING ROW OFF", at);
  assert.ok(at > 0 && end > at, "the data clause's removal comment moved");
  assert.doesNotMatch(src, /open decision/i, "a note still calls where a new row goes an open decision");
  assert.match(src.slice(at, end), /A NEW ROW IS NOT THIS LAYER \(owner,\s+\/\/\s+2026-10-01\)/);
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
  assert.ok(props.intent.description.includes(addonEntry().line), "the addon clause's new-entry line is not in the request");
  assert.ok(props.intent.description.includes(tieBreak().line), "the tie-break as sent is not the new one");
  assert.ok(props.layer.description.includes(DATA[0]), "the data clause as sent is not the new one");
  const system = (body.messages || []).find((m) => m && m.role === "system");
  assert.ok(system && String(system.content).includes(costRule()), "the system's cost rule as sent does not speak about a new entry");
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
  assert.ok(props.intent.description.includes(addonEntry().line));
  assert.ok(props.intent.description.includes(tieBreak().line));
  assert.ok(props.layer.description.includes(DATA[0]));
  assert.ok(String(body.system && body.system[0] && body.system[0].text).includes(costRule()));
  assert.match(String(body.messages[0].content), /Its database tables are: services, team\./);
});

test("a supplied addon answer for a new entry goes on as an addon, nothing held back, and the expected-addon press would post it", async () => {
  for (const message of [NEW_SERVICE, NEW_MEMBER]) {
    const r = await route(message, { intent: "addon" });
    assert.equal(r.body.intent, "addon", message);
    assert.ok(!r.body.layer, "an addon answer carries a layer: " + r.body.layer);
    assert.ok(!r.body.alsoAsked, "a single new entry was held back");
    assert.ok(ADDON_PRESS.ok);
    assert.deepEqual(routeVerdict(ADDON_PRESS.expect, r.body), { ok: true, diffs: [] });
  }
});

test("run 86's answer is passed on as given, never rewritten by the words, and the expected-addon guard still refuses it", async () => {
  // NO KEYWORD OVERRIDE. The route does not read the message for "add" and
  // change the model's answer: an `edit` + `data` answer to a new entry comes
  // out exactly as it went in, whichever way the sentence is put.
  for (const message of [NEW_SERVICE, NEW_MEMBER]) {
    const r = await route(message, { intent: "edit", layer: "data" });
    assert.equal(r.body.intent, "edit", message);
    assert.equal(r.body.layer, "data", message);
    // And the canary's route check refuses it before anything is posted.
    const v = routeVerdict(ADDON_PRESS.expect, r.body);
    assert.equal(v.ok, false, "the expected-addon press would post a data edit for a new entry");
    assert.deepEqual(v.diffs.map((d) => d.key), ["intent"]);
  }
});

test("controls: changing or deleting an existing entry, and sorting it across the site, still go on as data edits", async () => {
  for (const message of [UPDATE, DELETE, SORT]) {
    const r = await route(message, { intent: "edit", layer: "data" });
    assert.equal(r.body.intent, "edit", message);
    assert.equal(r.body.layer, "data", message);
    assert.ok(!r.body.alsoAsked, message);
    assert.deepEqual(routeVerdict(DATA_PRESS.expect, r.body), { ok: true, diffs: [] });
  }
});

test("mixed requests keep their handling: the hold rule and the whole-message rule are unchanged", async () => {
  // The words that decide a hold: an addition beside a change, and a change
  // beside an addition when the answer is addon.
  assert.match(ALSO, /something to ADD that the site does not have yet beside a change/);
  assert.match(ALSO, /a change beside an addition when you answered "addon"/);
  assert.match(ALSO, /a change to what the site's lists hold \("data"\)[^.]*beside a change of another kind/);
  // The whole-message rule is still the layer field's last word.
  assert.match(LAYER[LAYER.length - 1], /^ONE ANSWER FOR THE WHOLE MESSAGE/);
  // And through the route: an addon answer holding back a change to an
  // existing entry is handed on with its hold, word for word.
  const held = "change the price of window cleaning to £30";
  const r = await route("Put gutter cleaning on our services list at £60, and " + held + ".", { intent: "addon", alsoAsked: held });
  assert.equal(r.body.intent, "addon");
  assert.equal(r.body.alsoAsked, held);
});
