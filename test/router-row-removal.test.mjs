// A ROW THE SITE STORES, TAKEN OFF ITS LIST, IS THE `data` ANSWER (2026-09-30).
//
// Found while preparing Lane 4's delete: the router's tool gave "take that
// entry off the list" two answers. `look`'s removal clause claimed EVERY
// removal ("TAKING SOMETHING OFF THE SITE IS THIS LAYER, whatever the something
// is"), a whole page its one exception, and `data`'s clause claimed one row of
// something the site lists. On the look door no lane deletes a row (`backend`
// is the rules rung), while the data step deletes one itself. And look's reach
// under `alsoAsked`, which the closing whole-message rule reads, said "taking
// something off" with no exception at all.
//
// The owner: *"Removing an existing stored database row must reach the data
// route. Preserve whole-page deletion and existing handling of other removals.
// Preserve the whole-message rule based on what each route can execute across
// its targets. Do not decide or change add-row routing, reordering, or the
// other pending product decisions. Use a universal rule, with no fixture names
// or keyword shortcuts."*
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. The first cases read what the
// router is TOLD: the tool as defined, and the request the real
// `POST /api/site/route` sends. The route cases supply the router's answer and
// read what the route does with it. None of it shows which answer a real model
// chooses; only a live press after a merge and a deploy can.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { ASK_TOOL, EDIT_LAYERS, REMOVABLE_LAYERS, readEdit } from "../builder/site-ask.mjs";
import { readExpectRoute, routeVerdict } from "../scripts/canary-route.mjs";

const P = ASK_TOOL.input_schema.properties;
const LAYER = P.layer.description;
const ALSO = P.alsoAsked.description;
const LINES = LAYER.split("\n");

/** A layer's clause: its opening line and every line after it, up to the next layer's. */
function clause(layer, next) {
  const at = LINES.findIndex((l) => l.startsWith("\"" + layer + "\" — "));
  const end = LINES.findIndex((l) => l.startsWith("\"" + next + "\" — "));
  assert.ok(at >= 0 && end > at, "the " + layer + " clause's landmarks moved");
  return LINES.slice(at, end);
}
/** The one line of `lines` matching `re`, and where it is. */
function oneLine(lines, re, what) {
  const hits = lines.map((l, i) => [l, i]).filter(([l]) => re.test(l));
  assert.equal(hits.length, 1, what + ": expected exactly one line, found " + hits.length);
  return { line: hits[0][0], at: hits[0][1] };
}

const DATA = clause("data", "text");
const LOOK = clause("look", "rules");
const REACH = ALSO.split("\n").find((l) => l.startsWith("SEVERAL CHANGES ARE ONE TURN"));
// The three new sentences, found positively before anything is asserted about
// what they must not say. Read inside each case, so a wording without them
// fails the cases that need them and no others.
const dataRow = () => oneLine(DATA, /^TAKING AN EXISTING ROW OFF/, "the data clause's row removal");
const lookRow = () => oneLine(LOOK, /^THE SECOND IS A ROW THE SITE STORES\./, "look's stored-row exception");
function reachRow() {
  assert.ok(REACH, "look's reach under alsoAsked could not be found");
  const m = /taking something off \(but not a row the site stores: that is "data"\)/.exec(REACH);
  assert.ok(m, "look's reach still claims every removal, a stored row's included: " + REACH);
  return m[0];
}

test("taking an existing stored row off its list is `data`, said in the data clause", () => {
  const row = dataRow();
  const s = row.line;
  assert.match(s, /IS THIS LAYER TOO/, "the data clause does not claim a row taken off");
  assert.match(s, /EXISTING ROW/, "the claim is not limited to a row that exists");
  assert.match(s, /row is deleted from the table that holds it/, "the data clause does not say the row is deleted");
  // THE TARGETS: a row lives once, in its table, and every page listing it is
  // served from there, so the one answer reaches every page it is on.
  assert.match(s, /every page showing that list stops showing it/);
  // It follows the clause's own opening line, which still names the tables.
  assert.equal(row.at, 1, "the row sentence is not the data clause's second line");
  assert.match(DATA[0], /The tables it has are named above\./);
});

test("look's removal clause excepts a stored row for `data`, after a whole page and before everything else", () => {
  // The general claim and its examples are kept: every other removal is
  // still worked out on `look`.
  const claim = oneLine(LOOK, /^TAKING SOMETHING OFF THE SITE IS THIS LAYER, whatever the something is/, "look's removal claim");
  assert.match(claim.line, /3D/);
  assert.match(claim.line, /QR/);
  // THE FIRST EXCEPTION, unchanged in what it does: a whole page is `page`
  // with `remove`, and nowhere else.
  const page = oneLine(LOOK, /^THE FIRST EXCEPTION IS A WHOLE PAGE\./, "the whole-page exception");
  assert.match(page.line, /is layer "page" with `remove` — a page is deleted there and nowhere else\.$/);
  // THE SECOND: an existing entry of a list the site keeps in its tables is
  // `data`, and nowhere else.
  const row = lookRow();
  const s = row.line;
  assert.match(s, /An existing entry taken off one of the lists kept in the tables named above is layer "data"/);
  assert.match(s, /its row is deleted there and nowhere else\.$/);
  // "ANYTHING ELSE" IS READ WITH BOTH EXCEPTIONS ALREADY SAID.
  const rest = oneLine(LOOK, /anything else OFF a page that stays is this layer/, "look's residual claim");
  assert.ok(claim.at < page.at && page.at < row.at && row.at < rest.at,
    "the exceptions are not between the claim and the sentence that gives look everything else: " + [claim.at, page.at, row.at, rest.at]);
});

test("look's reach, which the whole-message rule reads, names no stored row", () => {
  reachRow();
  // The closing rule itself is untouched: still the layer field's last line,
  // still pointing at that reach, and silent about rows.
  const last = LINES[LINES.length - 1];
  assert.match(last, /^ONE ANSWER FOR THE WHOLE MESSAGE/);
  assert.match(last, /what it reaches is listed under `alsoAsked`/);
  assert.doesNotMatch(last, /\brow\b/i, "the whole-message rule itself was reworded");
  // And a data change beside a change of another kind is still a legitimate
  // hold, which is what keeps a row taken off in a mixed message on `data`.
  assert.match(ALSO, /a change to what the site's lists hold \("data"\)[^.]*beside a change of another kind/);
});

test("the rule is universal: it quotes layers only and names no table, site or customer sentence", () => {
  const added = [dataRow().line, lookRow().line, reachRow()];
  for (const s of added) {
    const quoted = [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const q of quoted) assert.ok(EDIT_LAYERS.includes(q), "a new sentence quotes something that is not a layer: " + q);
  }
  // The tables are named by the digest the router is sent ("named above"),
  // never here: the observer is alive because the reference is found first.
  assert.match(added[1], /the tables named above/);
  // No fixture: none of the live test sites, their tables or the prepared
  // request's words.
  for (const s of added) {
    assert.doesNotMatch(s, /fretwork|lesson|tune-up|price list|bakery|loaves|gallery|fold-lane|lido/i, "a new sentence names a fixture: " + s);
  }
});

test("the removal sentences say nothing about adding or ordering, and the data clause speaks of adding only to send a new entry to addon", () => {
  for (const s of [dataRow().line, lookRow().line, reachRow()]) {
    assert.doesNotMatch(s, /\badd/i, "a removal sentence speaks about adding a row: " + s);
    assert.doesNotMatch(s, /\border|\bsort|\bfirst\b/i, "a removal sentence speaks about order: " + s);
  }
  // REVISED 2026-10-01. This case read "the open decisions stay open" and
  // required the data clause to say nothing about adding, because the owner
  // had not decided where a new row goes. After run 86 the owner did: *"Adding
  // a NEW record to an existing table/list must select addon."* So the data
  // clause now speaks about adding exactly once, and only to say a new entry
  // is not this layer; the rule's own guards are `router-row-add.test.mjs`.
  const adding = DATA.filter((l) => /\badd/i.test(l));
  assert.equal(adding.length, 1, "the data clause speaks about adding on " + adding.length + " lines, not one");
  assert.match(adding[0], /A NEW ENTRY IS NOT THIS LAYER: adding one to any of those lists is intent "addon"/);
  assert.match(P.intent.description, /"addon" — ADDING SOMETHING THE SITE DOES NOT HAVE YET/);
  // `remove` is still asked for exactly the layers that carry it; `data` is
  // not one of them, because the data step deletes its own rows.
  assert.ok(!REMOVABLE_LAYERS.includes("data"));
  assert.doesNotMatch(P.remove.description, /"data"/, "the remove flag is now asked of data answers");
});

// ─────────────────────────────────────────────────────────────────────────────
// THROUGH THE REAL ROUTING ROUTE. The router's answer is SUPPLIED; what is read
// is the request it was sent and what the route hands on.

const OWNER = { id: "55555555-5555-5555-5555-555555555555", email: "owner@example.com" };
const MESSAGE = "We don't run the evening workshop any more, please take it off the list.";
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

async function route(answer) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  const router = [];
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(OWNER);
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/rpc/use_credits")) return json(1);
    if (u.includes("/rest/v1/")) return json([]);
    if (u.startsWith("https://api.anthropic.com/")) {
      router.push(JSON.parse(String((init && init.body) || "{}")));
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: ASK_TOOL.name, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    return new Response("unavailable", { status: 503 });
  };
  try {
    // A browser that built the site sends its tables, so nothing is looked up.
    const site = { name: "row-removal", url: "https://row-removal.gofarther.app", pages: ["/", "/workshops"], tables: ["workshops", "bookings"] };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/route", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ message: MESSAGE, site, picker: "sonnet", firstBuild: false, brief: MESSAGE, qa: [], answering: false, attached: false, slug: "row-removal", hasSite: true }),
    }), { ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: JSON.parse(await res.text()), router };
  } finally {
    globalThis.fetch = real;
  }
}
const PRESS = readExpectRoute("intent=edit layer=data alsoAsked=none");

test("the router is sent the rule and the tables it points at", async () => {
  const r = await route({ intent: "edit", layer: "data" });
  assert.equal(r.status, 200);
  assert.equal(r.router.length, 1, "the router was not asked exactly once");
  const sent = r.router[0];
  const tool = (sent.tools || []).find((t) => t && t.name === ASK_TOOL.name);
  assert.ok(tool, "the routing tool is not in the request");
  // THE REQUEST AS IT LEFT, not the module's constant.
  const layer = tool.input_schema.properties.layer.description;
  assert.ok(layer.includes(dataRow().line), "the data clause's row sentence is not in the request");
  assert.ok(layer.includes(lookRow().line), "look's stored-row exception is not in the request");
  assert.ok(tool.input_schema.properties.alsoAsked.description.includes(reachRow()), "look's reach in the request still claims a stored row");
  // "The tables named above" has a referent in the same request.
  assert.match(String(sent.messages[0].content), /Its database tables are: workshops, bookings\./);
});

test("the answer the rule asks for goes on as a data edit, and the prepared press would post it", async () => {
  const r = await route({ intent: "edit", layer: "data" });
  assert.equal(r.body.intent, "edit");
  assert.equal(r.body.layer, "data");
  assert.ok(!r.body.remove, "a data answer carries the page removal flag");
  assert.ok(!r.body.alsoAsked, "a single row removal was held back");
  assert.ok(PRESS.ok);
  assert.deepEqual(routeVerdict(PRESS.expect, r.body), { ok: true, diffs: [] });
  // A removal flag the model sets anyway is dropped for `data`: the data step
  // decides which row goes, never a flag on the routing answer.
  assert.deepEqual(readEdit({ layer: "data", remove: true }, ["/"]), { intent: "edit", answer: "", layer: "data" });
});

test("the answer the old wording invited is refused by the prepared press before anything is posted", async () => {
  const r = await route({ intent: "edit", layer: "look" });
  assert.equal(r.body.layer, "look");
  const v = routeVerdict(PRESS.expect, r.body);
  assert.equal(v.ok, false, "the press's route check would post a look answer for a row removal");
  assert.deepEqual(v.diffs.map((d) => d.key), ["layer"]);
});

test("controls: a whole page and every other removal keep their answers", () => {
  // A whole page is still `page` with its flag.
  assert.deepEqual(readEdit({ layer: "page", page: "/workshops", remove: true }, ["/", "/workshops"]).remove, true);
  // A removal on a door layer still carries its flag to the lane door.
  for (const layer of ["picture", "nav", "logo"]) {
    assert.equal(readEdit({ layer, remove: true }, ["/"]).remove, true, layer + " lost its removal flag");
  }
});
